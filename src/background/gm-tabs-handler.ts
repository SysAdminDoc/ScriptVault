import type { BackgroundMessage } from '../types/messages';

export type GMTabsAction = Extract<
  BackgroundMessage['action'],
  | 'GM_closeTab'
  | 'GM_focusTab'
  | 'GM_getTab'
  | 'GM_getTabs'
  | 'GM_openInTab'
  | 'GM_saveTab'
>;

export const GM_TABS_ACTIONS = [
  'GM_closeTab',
  'GM_focusTab',
  'GM_getTab',
  'GM_getTabs',
  'GM_openInTab',
  'GM_saveTab',
] as const satisfies readonly GMTabsAction[];

type AssertNever<T extends never> = T;
type MissingGMTabsActions = Exclude<GMTabsAction, typeof GM_TABS_ACTIONS[number]>;
type ExtraGMTabsActions = Exclude<typeof GM_TABS_ACTIONS[number], GMTabsAction>;
type _MissingGMTabsActionCheck = AssertNever<MissingGMTabsActions>;
type _ExtraGMTabsActionCheck = AssertNever<ExtraGMTabsActions>;

interface RuntimeMessageSender {
  tab?: {
    id?: number;
    index?: number;
  };
  /** Set by Chrome for USER_SCRIPT-world senders; the authenticated identity. */
  userScriptId?: string;
}

interface GMTabsPayload {
  active?: boolean;
  background?: boolean;
  data?: unknown;
  insert?: boolean;
  scriptId?: string;
  setParent?: boolean;
  tabId?: number;
  trackClose?: boolean;
  url?: string;
}

interface TabStorageRuntime {
  get(tabId: number): unknown;
  getAll(): Record<string, unknown>;
  set(tabId: number, data: unknown): void;
}

interface TabCreateOptions {
  active: boolean;
  index?: number;
  openerTabId?: number;
  url: string;
}

interface SessionStateRuntime {
  persistOpenTabTrackers?(): void;
}

type OpenTabTrackers = Map<
  number | undefined,
  { callerTabId: number; scriptId?: string; trackClose?: boolean }
>;

type TabsRuntimeGlobal = typeof globalThis & {
  _openTabTrackers?: OpenTabTrackers;
  SessionState?: SessionStateRuntime;
};

declare const TabStorage: TabStorageRuntime;

const GM_TABS_ACTION_SET: ReadonlySet<string> = new Set(GM_TABS_ACTIONS);

function getTabsRuntimeGlobal(): TabsRuntimeGlobal {
  return globalThis as TabsRuntimeGlobal;
}

/**
 * Identity to scope per-tab storage and tab ownership by. Prefers the
 * browser-supplied `sender.userScriptId` and only falls back to the
 * caller-supplied field, matching gm-values-handler.
 */
function ownedScriptKey(data: GMTabsPayload, sender: RuntimeMessageSender): string {
  return sender.userScriptId || data.scriptId || '__unscoped__';
}

/**
 * TabStorage is a single bag per tab. Tampermonkey and Violentmonkey both scope
 * GM_getTab/GM_saveTab to the calling script; sharing one bag let any script on
 * the page read and overwrite another's state, and GM_getTabs handed every
 * open tab's bag to any caller that asked. Nest the per-script records inside
 * the per-tab entry so the storage module's API is unchanged.
 */
function readTabBag(tabId: number): Record<string, unknown> {
  const bag = TabStorage.get(tabId);
  return (bag && typeof bag === 'object') ? bag as Record<string, unknown> : {};
}

export function isGMTabsAction(action: unknown): action is GMTabsAction {
  return typeof action === 'string' && GM_TABS_ACTION_SET.has(action);
}

export async function handleGMTabsMessage(
  action: GMTabsAction,
  data: GMTabsPayload = {},
  sender: RuntimeMessageSender = {},
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'GM_getTab': {
      if (!sender.tab?.id) return {};
      const scoped = readTabBag(sender.tab.id)[ownedScriptKey(data, sender)];
      return (scoped && typeof scoped === 'object') ? scoped as Record<string, unknown> : {};
    }

    case 'GM_saveTab': {
      if (!sender.tab?.id) return { error: 'GM_saveTab requires a tab context' };
      const bag = readTabBag(sender.tab.id);
      bag[ownedScriptKey(data, sender)] = data.data;
      TabStorage.set(sender.tab.id, bag);
      return { success: true };
    }

    case 'GM_getTabs': {
      // Only this script's entries — never every tab's full bag.
      const key = ownedScriptKey(data, sender);
      const scopedByTab: Record<string, unknown> = {};
      for (const [tabId, bag] of Object.entries(TabStorage.getAll() || {})) {
        if (!bag || typeof bag !== 'object') continue;
        const entry = (bag as Record<string, unknown>)[key];
        if (entry !== undefined) scopedByTab[tabId] = entry;
      }
      return scopedByTab;
    }

    case 'GM_openInTab': {
      const openUrl = String(data.url || '');
      try {
        const parsed = new URL(openUrl);
        if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
          return { error: `GM_openInTab: scheme "${parsed.protocol}" is not allowed` };
        }
      } catch {
        return { error: 'GM_openInTab: invalid URL' };
      }

      const newTabOpts: TabCreateOptions = {
        url: openUrl,
        active: data.active !== undefined ? data.active : !data.background,
      };
      if (data.insert && sender.tab?.index !== undefined) {
        newTabOpts.index = sender.tab.index + 1;
      }
      if (data.setParent && sender.tab?.id) {
        newTabOpts.openerTabId = sender.tab.id;
      }

      const tab = await chrome.tabs.create(newTabOpts);
      const callerTabId = sender.tab?.id;
      // Record ownership unconditionally. It used to be gated on trackClose
      // (which only drives the onclose callback), so GM_closeTab had no
      // ownership record to check for the common case.
      if (callerTabId) {
        const runtime = getTabsRuntimeGlobal();
        if (!runtime._openTabTrackers) runtime._openTabTrackers = new Map();
        if (runtime._openTabTrackers.size > 1000) {
          const oldest = runtime._openTabTrackers.keys().next().value;
          runtime._openTabTrackers.delete(oldest);
        }
        runtime._openTabTrackers.set(tab.id, {
          callerTabId,
          scriptId: ownedScriptKey(data, sender),
          ...(data.trackClose ? { trackClose: true } : {}),
        });
        runtime.SessionState?.persistOpenTabTrackers?.();
      }
      return { success: true, tabId: tab.id };
    }

    case 'GM_focusTab':
      if (sender.tab?.id) {
        await chrome.tabs.update(sender.tab.id, { active: true });
      }
      return { success: true };

    case 'GM_closeTab': {
      if (!data.tabId) return { success: true };
      // data.tabId is entirely caller-supplied and tab ids are small sequential
      // integers, so without an ownership check any userscript could walk the id
      // space and close every tab in the browser. Permit only the script's own
      // tab or one it opened via GM_openInTab.
      const ownTabId = sender.tab?.id;
      const tracker = getTabsRuntimeGlobal()._openTabTrackers?.get(data.tabId);
      const ownsTarget = tracker?.scriptId === ownedScriptKey(data, sender);
      if (data.tabId !== ownTabId && !ownsTarget) {
        return { error: 'GM_closeTab: tab was not opened by this script' };
      }
      try { await chrome.tabs.remove(data.tabId); } catch (_) {}
      return { success: true };
    }

    default:
      return { error: `Unsupported GM tabs action: ${action}` };
  }
}

export const GMTabsHandler = Object.freeze({
  GM_TABS_ACTIONS,
  handleGMTabsMessage,
  isGMTabsAction,
});

export default GMTabsHandler;
