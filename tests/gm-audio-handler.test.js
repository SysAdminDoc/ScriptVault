import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_AUDIO_ACTIONS,
  handleGMAudioMessage,
  isGMAudioAction,
} from '../src/background/gm-audio-handler.ts';

const originalSessionState = globalThis.SessionState;
const originalAudioWatchedTabs = globalThis._audioWatchedTabs;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis._audioWatchedTabs = undefined;
});

afterEach(() => {
  globalThis.SessionState = originalSessionState;
  globalThis._audioWatchedTabs = originalAudioWatchedTabs;
});

describe('GM_audio handler', () => {
  it('exposes the exact GM_audio action set', () => {
    expect([...GM_AUDIO_ACTIONS]).toEqual([
      'GM_audio_getState',
      'GM_audio_setMute',
      'GM_audio_unwatchState',
      'GM_audio_watchState',
    ]);
    expect(isGMAudioAction('GM_audio_getState')).toBe(true);
    expect(isGMAudioAction('GM_xmlhttpRequest')).toBe(false);
  });

  it('sets tab mute state from boolean and object payloads', async () => {
    await expect(handleGMAudioMessage(
      'GM_audio_setMute',
      { mute: { mute: true } },
      { tab: { id: 7 } },
    )).resolves.toEqual({ success: true });

    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { muted: true });

    await expect(handleGMAudioMessage(
      'GM_audio_setMute',
      { mute: false },
      { tab: { id: 7 } },
    )).resolves.toEqual({ success: true });

    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { muted: false });
  });

  it('returns tab audio state with stable fallbacks', async () => {
    chrome.tabs.get.mockResolvedValueOnce({
      id: 9,
      mutedInfo: { muted: true, reason: 'extension' },
      audible: true,
    });

    await expect(handleGMAudioMessage(
      'GM_audio_getState',
      {},
      { tab: { id: 9 } },
    )).resolves.toEqual({
      muted: true,
      reason: 'extension',
      audible: true,
    });
  });

  it('persists watch and unwatch changes', async () => {
    const persistAudioWatchedTabs = vi.fn();
    globalThis.SessionState = { persistAudioWatchedTabs };

    await expect(handleGMAudioMessage(
      'GM_audio_watchState',
      {},
      { tab: { id: 11 } },
    )).resolves.toEqual({ success: true });

    expect(globalThis._audioWatchedTabs.has(11)).toBe(true);
    expect(persistAudioWatchedTabs).toHaveBeenCalledTimes(1);

    await expect(handleGMAudioMessage(
      'GM_audio_unwatchState',
      {},
      { tab: { id: 11 } },
    )).resolves.toEqual({ success: true });

    expect(globalThis._audioWatchedTabs.has(11)).toBe(false);
    expect(persistAudioWatchedTabs).toHaveBeenCalledTimes(2);
  });

  it('returns a clear error without tab context', async () => {
    await expect(handleGMAudioMessage('GM_audio_getState', {}, {}))
      .resolves.toEqual({ error: 'No tab context' });

    await expect(handleGMAudioMessage('GM_audio_unwatchState', {}, {}))
      .resolves.toEqual({ success: true });
  });
});
