import type { BackgroundMessage } from '../types/messages';

export type GMAudioAction = Extract<BackgroundMessage['action'], `GM_audio_${string}`>;

export const GM_AUDIO_ACTIONS = [
  'GM_audio_getState',
  'GM_audio_setMute',
  'GM_audio_unwatchState',
  'GM_audio_watchState',
] as const satisfies readonly GMAudioAction[];

type AssertNever<T extends never> = T;
type MissingGMAudioActions = Exclude<GMAudioAction, typeof GM_AUDIO_ACTIONS[number]>;
type ExtraGMAudioActions = Exclude<typeof GM_AUDIO_ACTIONS[number], GMAudioAction>;
type _MissingGMAudioActionCheck = AssertNever<MissingGMAudioActions>;
type _ExtraGMAudioActionCheck = AssertNever<ExtraGMAudioActions>;

interface RuntimeMessageSender {
  tab?: {
    id?: number;
  };
  userScriptId?: string;
}

interface GMAudioPayload {
  mute?: boolean | { mute?: boolean };
  scriptId?: string;
}

interface SessionStateRuntime {
  persistAudioWatchedTabs?(): void;
}

type AudioRuntimeGlobal = typeof globalThis & {
  _audioWatchedTabs?: Set<string>;
  SessionState?: SessionStateRuntime;
};

const GM_AUDIO_ACTION_SET: ReadonlySet<string> = new Set(GM_AUDIO_ACTIONS);

function getSenderTabId(sender: RuntimeMessageSender | null | undefined): number | null {
  const tabId = sender?.tab?.id;
  return typeof tabId === 'number' ? tabId : null;
}

function getAudioRuntimeGlobal(): AudioRuntimeGlobal {
  return globalThis as AudioRuntimeGlobal;
}

function getOwnedScriptId(
  data: GMAudioPayload,
  sender: RuntimeMessageSender,
): string | null {
  const scriptId = sender.userScriptId || data.scriptId;
  return typeof scriptId === 'string' && scriptId ? scriptId : null;
}

function audioWatchKey(scriptId: string, tabId: number): string {
  return `${scriptId}:${tabId}`;
}

function persistAudioWatchedTabs(): void {
  try {
    getAudioRuntimeGlobal().SessionState?.persistAudioWatchedTabs?.();
  } catch (_) {
    // Persistence is best-effort; the live watch set still reflects the state.
  }
}

export function isGMAudioAction(action: unknown): action is GMAudioAction {
  return typeof action === 'string' && GM_AUDIO_ACTION_SET.has(action);
}

export async function handleGMAudioMessage(
  action: GMAudioAction,
  data: GMAudioPayload = {},
  sender: RuntimeMessageSender = {},
): Promise<Record<string, unknown>> {
  try {
    const tabId = getSenderTabId(sender);

    switch (action) {
      case 'GM_audio_setMute': {
        if (!tabId) return { error: 'No tab context' };
        const mute = typeof data.mute === 'object' ? !!data.mute?.mute : !!data.mute;
        await chrome.tabs.update(tabId, { muted: mute });
        return { success: true };
      }

      case 'GM_audio_getState': {
        if (!tabId) return { error: 'No tab context' };
        const tab = await chrome.tabs.get(tabId);
        return {
          muted: tab.mutedInfo?.muted || false,
          reason: tab.mutedInfo?.reason || 'user',
          audible: tab.audible || false,
        };
      }

      case 'GM_audio_watchState': {
        if (!tabId) return { error: 'No tab context' };
        const scriptId = getOwnedScriptId(data, sender);
        if (!scriptId) return { error: 'Missing script context' };
        const runtime = getAudioRuntimeGlobal();
        if (!runtime._audioWatchedTabs) runtime._audioWatchedTabs = new Set<string>();
        runtime._audioWatchedTabs.add(audioWatchKey(scriptId, tabId));
        persistAudioWatchedTabs();
        return { success: true };
      }

      case 'GM_audio_unwatchState': {
        const scriptId = getOwnedScriptId(data, sender);
        const runtime = getAudioRuntimeGlobal();
        if (typeof tabId === 'number' && scriptId && runtime._audioWatchedTabs?.delete(audioWatchKey(scriptId, tabId))) {
          persistAudioWatchedTabs();
        }
        return { success: true };
      }

      default:
        return { error: `Unsupported GM_audio action: ${action}` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export const GMAudioHandler = Object.freeze({
  GM_AUDIO_ACTIONS,
  handleGMAudioMessage,
  isGMAudioAction,
});

export default GMAudioHandler;
