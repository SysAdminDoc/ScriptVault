import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'modules/notifications.js'), 'utf8');
const originalNavigatorStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');

function createFreshNotificationSystem() {
  const fn = new Function('chrome', 'console', 'navigator', code + '\nreturn NotificationSystem;');
  return fn(globalThis.chrome, console, globalThis.navigator);
}

let NotificationSystem;

beforeEach(() => {
  globalThis.__resetStorageMock();
  NotificationSystem = createFreshNotificationSystem();
  chrome.tabs.create.mockResolvedValue({});
  chrome.notifications.create.mockClear();
  chrome.notifications.clear.mockClear();
  chrome.storage.local.get.mockClear();
  chrome.storage.local.set.mockClear();
  chrome.storage.local.remove.mockClear();
  chrome.storage.session.get.mockClear();
  chrome.storage.session.set.mockClear();
  chrome.storage.session.remove.mockClear();
  chrome.alarms.create.mockClear();
  chrome.alarms.clear.mockClear();
  chrome.alarms.get.mockReset();
  chrome.alarms.get.mockResolvedValue(null);
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalNavigatorStorageDescriptor) {
    Object.defineProperty(globalThis.navigator, 'storage', originalNavigatorStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.navigator, 'storage');
  }
});

describe('NotificationSystem runtime module', () => {
  it('stores click context in session storage and deep-links to the correct dashboard hash', async () => {
    await NotificationSystem.notifyUpdate({
      id: 'script alpha/beta',
      name: 'Alpha',
      version: '1.2.0',
    });

    const [notifId] = chrome.notifications.create.mock.calls[0];
    const key = `notifCtx_${notifId}`;

    expect((await chrome.storage.session.get(key))[key]).toEqual({
      action: 'openScript',
      scriptId: 'script alpha/beta',
    });

    await NotificationSystem.handleClick(notifId);

    expect(chrome.notifications.clear).toHaveBeenCalledWith(notifId);
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test-extension-id/pages/dashboard.html#script_script%20alpha%2Fbeta',
    });
    expect((await chrome.storage.session.get(key))[key]).toBeUndefined();
  });

  it('routes batch update notifications to the dashboard instead of a null script target', async () => {
    await NotificationSystem.notifyUpdate([
      { id: 'script_alpha', name: 'Alpha', version: '1.2.0' },
      { id: 'script_beta', name: 'Beta', version: '2.3.0' },
    ]);

    const [notifId] = chrome.notifications.create.mock.calls[0];
    const key = `notifCtx_${notifId}`;

    expect((await chrome.storage.session.get(key))[key]).toEqual({
      action: 'openDashboard',
    });

    await NotificationSystem.handleClick(notifId);

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test-extension-id/pages/dashboard.html',
    });
  });

  it('stores local click context with an alarm cleanup fallback when session storage is unavailable', async () => {
    const originalSession = chrome.storage.session;
    chrome.storage.session = undefined;

    try {
      await NotificationSystem.notifyUpdate({
        id: 'script_local',
        name: 'Local Fallback',
        version: '1.0.0',
      });

      const [notifId] = chrome.notifications.create.mock.calls[0];
      const key = `notifCtx_${notifId}`;
      expect((await chrome.storage.local.get(key))[key]).toEqual({
        action: 'openScript',
        scriptId: 'script_local',
      });
      expect(chrome.alarms.create).toHaveBeenCalledWith(`notifCtx_clean_${notifId}`, { delayInMinutes: 5 });

      await NotificationSystem.handleAlarm({ name: `notifCtx_clean_${notifId}` });

      expect((await chrome.storage.local.get(key))[key]).toBeUndefined();
    } finally {
      chrome.storage.session = originalSession;
    }
  });

  it('keeps update events in the weekly digest during quiet hours even when no notification is shown', async () => {
    await NotificationSystem.setPreferences({
      quietHoursEnabled: true,
      quietHoursStart: 0,
      quietHoursEnd: 24,
    });

    await NotificationSystem.notifyUpdate({
      id: 'script_quiet',
      name: 'Quiet Script',
      version: '3.0.0',
      oldVersion: '2.9.0',
    });

    const stored = await chrome.storage.local.get('weeklyDigest');

    expect(chrome.notifications.create).not.toHaveBeenCalled();
    expect(stored.weeklyDigest.updatedScripts).toEqual([
      expect.objectContaining({
        id: 'script_quiet',
        name: 'Quiet Script',
        version: '3.0.0',
        oldVersion: '2.9.0',
      }),
    ]);
  });

  it('resets consecutive error counts after an error notification is sent', async () => {
    await NotificationSystem.notifyError('script_error', new Error('boom 1'));
    await NotificationSystem.notifyError('script_error', new Error('boom 2'));
    await NotificationSystem.notifyError('script_error', new Error('boom 3'));

    const stored = await chrome.storage.local.get(['notifErrorCounts', 'notifRateLimits']);

    expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
    expect(stored.notifErrorCounts.script_error).toBe(0);
    expect(stored.notifRateLimits.script_error).toBeGreaterThan(0);
  });

  it('does not recreate the weekly digest alarm when it already exists', async () => {
    await NotificationSystem.setPreferences({ digest: true });
    chrome.alarms.create.mockClear();
    chrome.alarms.clear.mockClear();
    chrome.alarms.get.mockResolvedValue({
      name: NotificationSystem.ALARM_WEEKLY_DIGEST,
      periodInMinutes: 10080,
    });

    await NotificationSystem.scheduleDigest();

    expect(chrome.alarms.get).toHaveBeenCalledWith(NotificationSystem.ALARM_WEEKLY_DIGEST);
    expect(chrome.alarms.clear).not.toHaveBeenCalled();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it('skips invalid storage percentage copy when quota is unavailable during digest generation', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 2048, quota: 0 }),
      },
    });

    const summary = await NotificationSystem.generateDigest();
    const [, options] = chrome.notifications.create.mock.calls[0];

    expect(summary.storageUsage).toEqual({ used: 2048, quota: 0 });
    expect(summary.message).not.toContain('Infinity%');
    expect(summary.message).not.toContain('NaN%');
    expect(options.message).not.toContain('Infinity%');
    expect(options.message).not.toContain('NaN%');
  });
});
