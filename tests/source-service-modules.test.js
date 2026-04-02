import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalNavigatorStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');

beforeEach(() => {
  globalThis.__resetStorageMock();
  chrome.tabs.create.mockResolvedValue({});
  chrome.notifications.create.mockClear();
  chrome.notifications.clear.mockClear();
  chrome.storage.local.get.mockClear();
  chrome.storage.local.set.mockClear();
  chrome.storage.local.remove.mockClear();
  chrome.storage.session.get.mockClear();
  chrome.storage.session.set.mockClear();
  chrome.storage.session.remove.mockClear();
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalNavigatorStorageDescriptor) {
    Object.defineProperty(globalThis.navigator, 'storage', originalNavigatorStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.navigator, 'storage');
  }
});

async function loadFreshNotificationSystem() {
  vi.resetModules();
  const mod = await import('../src/modules/notifications.ts');
  return mod.NotificationSystem;
}

async function loadFreshMigration() {
  vi.resetModules();
  const mod = await import('../src/modules/migration.ts');
  return mod.Migration;
}

describe('source notification system module', () => {
  it('stores click context in session storage and deep-links to the correct dashboard hash', async () => {
    const NotificationSystem = await loadFreshNotificationSystem();

    await NotificationSystem.notifyUpdate({
      id: 'script_alpha',
      name: 'Alpha',
      version: '1.2.0',
    });

    const [notifId] = chrome.notifications.create.mock.calls[0];
    const key = `notifCtx_${notifId}`;

    expect((await chrome.storage.session.get(key))[key]).toEqual({
      action: 'openScript',
      scriptId: 'script_alpha',
    });

    await NotificationSystem.handleClick(notifId);

    expect(chrome.notifications.clear).toHaveBeenCalledWith(notifId);
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test-extension-id/pages/dashboard.html#script_script_alpha',
    });
    expect((await chrome.storage.session.get(key))[key]).toBeUndefined();
  });

  it('falls back to legacy local click context entries so existing notifications still work after upgrade', async () => {
    const NotificationSystem = await loadFreshNotificationSystem();
    const legacyKey = 'notifCtx_legacy-notif';

    await chrome.storage.local.set({
      [legacyKey]: { action: 'openDashboard' },
    });

    await NotificationSystem.handleClick('legacy-notif');

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test-extension-id/pages/dashboard.html',
    });
    expect((await chrome.storage.local.get(legacyKey))[legacyKey]).toBeUndefined();
  });

  it('handles notification clicks when chrome.storage.session is unavailable', async () => {
    const NotificationSystem = await loadFreshNotificationSystem();
    const localOnlyKey = 'notifCtx_local-only-notif';
    const originalSession = chrome.storage.session;

    await chrome.storage.local.set({
      [localOnlyKey]: { action: 'openDashboard' },
    });

    chrome.storage.session = undefined;

    try {
      await NotificationSystem.handleClick('local-only-notif');
    } finally {
      chrome.storage.session = originalSession;
    }

    expect(chrome.notifications.clear).toHaveBeenCalledWith('local-only-notif');
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test-extension-id/pages/dashboard.html',
    });
    expect((await chrome.storage.local.get(localOnlyKey))[localOnlyKey]).toBeUndefined();
  });

  it('routes batch update notifications to the dashboard instead of a null script target', async () => {
    const NotificationSystem = await loadFreshNotificationSystem();

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

  it('keeps update events in the weekly digest during quiet hours even when no notification is shown', async () => {
    const NotificationSystem = await loadFreshNotificationSystem();

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

  it('skips invalid storage percentage copy when quota is unavailable during digest generation', async () => {
    const NotificationSystem = await loadFreshNotificationSystem();
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

describe('source migration module', () => {
  it('initializes notification preferences with the current quiet-hours schema', async () => {
    const Migration = await loadFreshMigration();

    await Migration.run();

    const stored = await chrome.storage.local.get(['notificationPrefs', 'sv_lastMigratedVersion']);

    expect(stored.notificationPrefs).toMatchObject({
      updates: true,
      errors: true,
      digest: false,
      security: true,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 7,
    });
    expect(stored.notificationPrefs.quietStart).toBeUndefined();
    expect(stored.notificationPrefs.quietEnd).toBeUndefined();
    expect(stored.sv_lastMigratedVersion).toBe('2.0.0');
  });
});
