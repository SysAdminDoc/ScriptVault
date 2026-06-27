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

type OpenTabTrackers = Map<number | undefined, { callerTabId: number; scriptId?: string }>;

type TabsRuntimeGlobal = typeof globalThis & {
  _openTabTrackers?: OpenTabTrackers;
  SessionState?: SessionStateRuntime;
};

declare const TabStorage: TabStorageRuntime;

const GM_TABS_ACTION_SET: ReadonlySet<string> = new Set(GM_TABS_ACTIONS);

function getTabsRuntimeGlobal(): TabsRuntimeGlobal {
  return globalThis as TabsRuntimeGlobal;
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
    case 'GM_getTab':
      if (!sender.tab?.id) return {};
      return TabStorage.get(sender.tab.id) as Record<string, unknown>;

    case 'GM_saveTab':
      if (!sender.tab?.id) return { error: 'GM_saveTab requires a tab context' };
      TabStorage.set(sender.tab.id, data.data);
      return { success: true };

    case 'GM_getTabs':
      return TabStorage.getAll();

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
      if (callerTabId && data.trackClose) {
        const runtime = getTabsRuntimeGlobal();
        if (!runtime._openTabTrackers) runtime._openTabTrackers = new Map();
        if (runtime._openTabTrackers.size > 1000) {
          const oldest = runtime._openTabTrackers.keys().next().value;
          runtime._openTabTrackers.delete(oldest);
        }
        runtime._openTabTrackers.set(tab.id, { callerTabId, scriptId: data.scriptId });
        runtime.SessionState?.persistOpenTabTrackers?.();
      }
      return { success: true, tabId: tab.id };
    }

    case 'GM_focusTab':
      if (sender.tab?.id) {
        await chrome.tabs.update(sender.tab.id, { active: true });
      }
      return { success: true };

    case 'GM_closeTab':
      if (data.tabId) {
        try { await chrome.tabs.remove(data.tabId); } catch (_) {}
      }
      return { success: true };

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
