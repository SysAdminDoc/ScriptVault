import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Migration } from '../src/modules/migration.ts';

function createFreshMigration() {
  return Migration;
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  vi.clearAllMocks();
});

describe('Migration runtime module', () => {
  it('initializes notification preferences with the current quiet-hours schema', async () => {
    const Migration = createFreshMigration();

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
    expect(stored.sv_lastMigratedVersion).toBe('3.20.0');
  });

  it('does not downgrade an already-current migration stamp', async () => {
    const Migration = createFreshMigration();
    await chrome.storage.local.set({ sv_lastMigratedVersion: '3.20.0' });
    chrome.storage.local.set.mockClear();

    await Migration.run();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect((await chrome.storage.local.get('sv_lastMigratedVersion')).sv_lastMigratedVersion).toBe('3.20.0');
  });

  it('resets a persisted scopedHostPermissions opt-in to the v3.19.2 default', async () => {
    const Migration = createFreshMigration();
    await chrome.storage.local.set({
      sv_lastMigratedVersion: '2.3.0',
      settings: { enabled: true, scopedHostPermissions: true },
    });

    await Migration.run();

    const stored = await chrome.storage.local.get(['settings', 'sv_lastMigratedVersion']);
    expect(stored.settings.scopedHostPermissions).toBeUndefined();
    expect(stored.settings.enabled).toBe(true);
    expect(stored.sv_lastMigratedVersion).toBe('3.20.0');
  });

  it('normalizes legacy script records while preserving script ids', async () => {
    const Migration = createFreshMigration();
    await chrome.storage.local.set({
      userscripts: {
        legacy_a: {
          id: 'legacy_a',
          code: 'console.log("a")',
          metadata: { name: 'Legacy A' },
          createdAt: 100,
        },
      },
    });

    await Migration.run();

    const stored = await chrome.storage.local.get('userscripts');
    expect(stored.userscripts.legacy_a.meta).toEqual({ name: 'Legacy A' });
    expect(stored.userscripts.legacy_a.metadata).toBeUndefined();
    expect(stored.userscripts.legacy_a.settings).toEqual({});
    expect(stored.userscripts.legacy_a.stats).toEqual({
      runs: 0,
      totalTime: 0,
      avgTime: 0,
      errors: 0,
    });
    expect(stored.userscripts.legacy_a.installedAt).toBe(100);
  });

  it('is idempotent after migrating legacy script records', async () => {
    const Migration = createFreshMigration();
    await chrome.storage.local.set({
      userscripts: {
        legacy_a: {
          id: 'legacy_a',
          code: 'console.log("a")',
          metadata: { name: 'Legacy A' },
          createdAt: 100,
        },
      },
    });

    await Migration.run();
    const afterFirstRun = await chrome.storage.local.get(['userscripts', 'notificationPrefs', 'backupSchedulerSettings', 'gamification']);
    chrome.storage.local.set.mockClear();
    chrome.storage.local.remove.mockClear();

    await Migration.run();

    const afterSecondRun = await chrome.storage.local.get(['userscripts', 'notificationPrefs', 'backupSchedulerSettings', 'gamification']);
    expect(afterSecondRun).toEqual(afterFirstRun);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
  });

  it('recovers deterministically from malformed persisted versions and script records', async () => {
    const malformedStates = [
      { version: null, userscripts: null },
      { version: 42, userscripts: [] },
      { version: {}, userscripts: { null_record: null, string_record: 'bad' } },
      { version: true, userscripts: { array_record: [], number_record: 7 } },
      {
        version: '',
        userscripts: {
          recoverable: {
            id: 'recoverable',
            code: 'console.log("recoverable")',
            settings: 'invalid',
            stats: [],
            metadata: { name: 'Recovered' },
          },
        },
      },
    ];

    for (const state of malformedStates) {
      globalThis.__resetStorageMock();
      await chrome.storage.local.set({
        sv_lastMigratedVersion: state.version,
        userscripts: state.userscripts,
      });

      await expect(createFreshMigration().run()).resolves.toBeUndefined();
      const stored = await chrome.storage.local.get(['sv_lastMigratedVersion', 'userscripts']);
      expect(stored.sv_lastMigratedVersion).toBe('3.20.0');
      if (state.userscripts?.recoverable) {
        expect(stored.userscripts.recoverable.settings).toEqual({});
        expect(stored.userscripts.recoverable.stats).toEqual({
          runs: 0,
          totalTime: 0,
          avgTime: 0,
          errors: 0,
        });
        expect(stored.userscripts.recoverable.meta).toEqual({ name: 'Recovered' });
      }
    }
  });
});
