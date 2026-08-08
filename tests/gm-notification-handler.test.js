import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_NOTIFICATION_ACTIONS,
  handleGMNotificationMessage,
  isGMNotificationAction,
} from '../src/background/gm-notification-handler.ts';

const originalNotifCallbacks = globalThis._notifCallbacks;
const originalSessionState = globalThis.SessionState;
const originalUpdate = chrome.notifications.update;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  globalThis._notifCallbacks = undefined;
  globalThis.SessionState = {
    persistNotifCallbacks: vi.fn(),
  };
  chrome.notifications.update = vi.fn().mockResolvedValue(true);
  chrome.notifications.create.mockImplementation((...args) => {
    const id = typeof args[0] === 'string' ? args[0] : 'notif-default';
    return Promise.resolve(id);
  });
});

afterEach(() => {
  vi.useRealTimers();
  globalThis._notifCallbacks = originalNotifCallbacks;
  globalThis.SessionState = originalSessionState;
  chrome.notifications.update = originalUpdate;
});

describe('GM notification handler', () => {
  it('exposes the exact notification action set', () => {
    expect([...GM_NOTIFICATION_ACTIONS]).toEqual([
      'GM_closeNotification',
      'GM_notification',
      'GM_updateNotification',
    ]);
    expect(isGMNotificationAction('GM_notification')).toBe(true);
    expect(isGMNotificationAction('GM_openInTab')).toBe(false);
  });

  it('creates notifications with platform clamps, callbacks, and long-timeout alarms', async () => {
    const longTitle = 'T'.repeat(140);
    const longText = 'M'.repeat(400);

    await expect(handleGMNotificationMessage(
      'GM_notification',
      {
        tag: 'status',
        title: longTitle,
        text: longText,
        progress: 150.8,
        requireInteraction: true,
        timeout: 60000,
        hasOnclick: true,
        hasOndone: true,
        hasOnbuttonclick: true,
        scriptId: 'script-1',
        buttons: [
          { title: 'A'.repeat(250), iconUrl: 'a.png' },
          { title: 'Second' },
          { title: 'Ignored' },
        ],
      },
      { tab: { id: 7 }, userScriptId: 'script-1' },
    )).resolves.toEqual({ success: true, id: 'status' });

    const [, options] = chrome.notifications.create.mock.calls[0];
    expect(options).toMatchObject({
      type: 'progress',
      iconUrl: 'images/icon128.png',
      progress: 100,
      requireInteraction: true,
      silent: false,
    });
    expect(options.title).toHaveLength(96);
    expect(options.title.endsWith('…')).toBe(true);
    expect(options.message).toHaveLength(280);
    expect(options.buttons).toHaveLength(2);
    expect(options.buttons[0].title).toHaveLength(200);
    expect(chrome.notifications.create).toHaveBeenCalledWith('script-1:status', expect.any(Object));
    expect(globalThis._notifCallbacks.get('script-1:status')).toEqual({
      tabId: 7,
      scriptId: 'script-1',
      publicId: 'status',
      hasOnclick: true,
      hasOndone: true,
      hasOnbuttonclick: true,
    });
    expect(globalThis.SessionState.persistNotifCallbacks).toHaveBeenCalledTimes(1);
    expect(chrome.alarms.create).toHaveBeenCalledWith('notif_clear_script-1:status', {
      delayInMinutes: 1,
    });
  });

  it('clears short-timeout notifications and removes callback tracking', async () => {
    vi.useFakeTimers();
    chrome.notifications.create.mockResolvedValueOnce('short-id');

    await expect(handleGMNotificationMessage(
      'GM_notification',
      {
        timeout: 25,
        hasOndone: true,
      },
      { tab: { id: 8 } },
    )).resolves.toEqual({ success: true, id: 'short-id' });

    expect(globalThis._notifCallbacks.has('short-id')).toBe(true);
    await vi.advanceTimersByTimeAsync(25);

    expect(chrome.notifications.clear).toHaveBeenCalledWith('short-id');
    expect(globalThis._notifCallbacks.has('short-id')).toBe(false);
  });

  it('updates notifications with partial fields and clear failure messages', async () => {
    globalThis._notifCallbacks = new Map([
      ['script-1:status', { tabId: 7, scriptId: 'script-1', publicId: 'status' }],
      ['script-1:missing', { tabId: 7, scriptId: 'script-1', publicId: 'missing' }],
    ]);
    await expect(handleGMNotificationMessage('GM_updateNotification', {}))
      .resolves.toEqual({ success: false, error: 'Missing notification id' });

    await expect(handleGMNotificationMessage('GM_updateNotification', {
      id: 'status',
      scriptId: 'script-1',
      text: 'Updated',
      progress: -4.2,
      requireInteraction: false,
      buttons: [{ title: 'Ok' }],
    }, { userScriptId: 'script-1' })).resolves.toEqual({ success: true });

    expect(chrome.notifications.update).toHaveBeenCalledWith('script-1:status', {
      message: 'Updated',
      type: 'progress',
      progress: 0,
      buttons: [{ title: 'Ok' }],
      requireInteraction: false,
    });

    chrome.notifications.update.mockRejectedValueOnce(new Error('gone'));
    await expect(handleGMNotificationMessage('GM_updateNotification', { id: 'missing' }, { userScriptId: 'script-1' }))
      .resolves.toEqual({ success: false, error: 'gone' });
  });

  it('closes notifications and removes callback tracking', async () => {
    globalThis._notifCallbacks = new Map([
      ['script-1:status', { tabId: 7, scriptId: 'script-1', publicId: 'status', hasOnclick: true }],
    ]);

    await expect(handleGMNotificationMessage('GM_closeNotification', {}))
      .resolves.toEqual({ success: false, error: 'Missing notification id' });
    await expect(handleGMNotificationMessage('GM_closeNotification', { id: 'status' }, { userScriptId: 'script-1' }))
      .resolves.toEqual({ success: true });

    expect(chrome.notifications.clear).toHaveBeenCalledWith('script-1:status');
    expect(globalThis._notifCallbacks.has('script-1:status')).toBe(false);

    globalThis._notifCallbacks.set('script-1:again', { tabId: 7, scriptId: 'script-1', publicId: 'again' });
    chrome.notifications.clear.mockRejectedValueOnce(new Error('close failed'));
    await expect(handleGMNotificationMessage('GM_closeNotification', { id: 'again' }, { userScriptId: 'script-1' }))
      .resolves.toEqual({ success: false, error: 'close failed' });
  });

  it('fails closed for cross-script and untracked update/close ids', async () => {
    globalThis._notifCallbacks = new Map([
      ['script-1:owned', { tabId: 7, scriptId: 'script-1', publicId: 'owned' }],
    ]);

    await expect(handleGMNotificationMessage(
      'GM_updateNotification',
      { id: 'owned' },
      { userScriptId: 'script-2' },
    )).resolves.toEqual({ success: false, error: 'Notification not owned by caller' });
    await expect(handleGMNotificationMessage(
      'GM_closeNotification',
      { id: 'missing' },
      { userScriptId: 'script-1' },
    )).resolves.toEqual({ success: false, error: 'Notification not owned by caller' });
    expect(chrome.notifications.update).not.toHaveBeenCalled();
    expect(chrome.notifications.clear).not.toHaveBeenCalled();
  });
});
