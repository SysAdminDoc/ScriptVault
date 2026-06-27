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
      { tab: { id: 7 } },
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
    expect(globalThis._notifCallbacks.get('status')).toEqual({
      tabId: 7,
      scriptId: 'script-1',
      hasOnclick: true,
      hasOndone: true,
      hasOnbuttonclick: true,
    });
    expect(globalThis.SessionState.persistNotifCallbacks).toHaveBeenCalledTimes(1);
    expect(chrome.alarms.create).toHaveBeenCalledWith('notif_clear_status', {
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
    await expect(handleGMNotificationMessage('GM_updateNotification', {}))
      .resolves.toEqual({ success: false, error: 'Missing notification id' });

    await expect(handleGMNotificationMessage('GM_updateNotification', {
      id: 'status',
      text: 'Updated',
      progress: -4.2,
      requireInteraction: false,
      buttons: [{ title: 'Ok' }],
    })).resolves.toEqual({ success: true });

    expect(chrome.notifications.update).toHaveBeenCalledWith('status', {
      message: 'Updated',
      type: 'progress',
      progress: 0,
      buttons: [{ title: 'Ok' }],
      requireInteraction: false,
    });

    chrome.notifications.update.mockRejectedValueOnce(new Error('gone'));
    await expect(handleGMNotificationMessage('GM_updateNotification', { id: 'missing' }))
      .resolves.toEqual({ success: false, error: 'gone' });
  });

  it('closes notifications and removes callback tracking', async () => {
    globalThis._notifCallbacks = new Map([
      ['status', { tabId: 7, scriptId: 'script-1', hasOnclick: true }],
    ]);

    await expect(handleGMNotificationMessage('GM_closeNotification', {}))
      .resolves.toEqual({ success: false, error: 'Missing notification id' });
    await expect(handleGMNotificationMessage('GM_closeNotification', { id: 'status' }))
      .resolves.toEqual({ success: true });

    expect(chrome.notifications.clear).toHaveBeenCalledWith('status');
    expect(globalThis._notifCallbacks.has('status')).toBe(false);

    chrome.notifications.clear.mockRejectedValueOnce(new Error('close failed'));
    await expect(handleGMNotificationMessage('GM_closeNotification', { id: 'again' }))
      .resolves.toEqual({ success: false, error: 'close failed' });
  });
});
