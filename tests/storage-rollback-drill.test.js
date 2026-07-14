// Release rollback and storage backward-compatibility drill.
//
// This test is intentionally command-shaped: `npm run release:rollback-drill`
// seeds both the actual previous-public v3 contract and the historical v2
// chrome.storage.local shape. It proves current migrations, prior-version
// reads/writes after store rollback, and current-version recovery afterward.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ScriptStorage, ScriptValues, SettingsManager, FolderStorage } from '../src/modules/storage.ts';
import { ScriptsDAO, ValuesDAO } from '../src/storage/script-db.ts';
import {
  ensureV3Migration,
  getMigrationStatus,
  maybeWipeLegacyData,
  __testing as migrationTesting,
} from '../src/storage/migration-v3.ts';

const PREVIOUS_PUBLIC_BASELINE = '3.19.1';
const LEGACY_V2_BASELINE = '2.3.4';
const CURRENT_VERSION = JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8')).version;

function makeLegacyScript(id, name, version = LEGACY_V2_BASELINE) {
  return {
    id,
    enabled: true,
    code: [
      '// ==UserScript==',
      `// @name ${name}`,
      `// @version ${version}`,
      '// @match https://example.com/*',
      '// ==/UserScript==',
      `console.log(${JSON.stringify(name)});`,
    ].join('\n'),
    meta: {
      name,
      namespace: 'rollback-drill',
      version,
      match: ['https://example.com/*'],
      grant: ['GM_getValue', 'GM_setValue'],
    },
    settings: { runInFrames: false },
    stats: { runs: 2, totalTime: 12, avgTime: 6, lastRun: 1710000000000, errors: 0 },
    versionHistory: [{ version: '2.3.3', code: '// old', timestamp: 1700000000000 }],
    createdAt: 1700000000000,
    updatedAt: 1710000000000,
  };
}

async function seedHistoricalV2Storage() {
  const alpha = makeLegacyScript('alpha', 'Rollback Alpha');
  const beta = makeLegacyScript('beta', 'Rollback Beta', '2.3.0');
  const legacy = {
    userscripts: { alpha, beta },
    values_alpha: { counter: 7, nested: { ok: true } },
    values_beta: { mode: 'safe' },
    settings: { theme: 'oled', autoUpdate: false },
    scriptFolders: [
      {
        id: 'folder_release',
        name: 'Release Drill',
        color: '#60a5fa',
        collapsed: false,
        scriptIds: ['alpha', 'beta'],
        createdAt: 1710000000000,
      },
    ],
    sv_releaseDrill: {
      previousPublicBaseline: LEGACY_V2_BASELINE,
      currentVersion: CURRENT_VERSION,
    },
  };
  await chrome.storage.local.set(legacy);
  return legacy;
}

async function readLegacyRollbackSnapshot() {
  return chrome.storage.local.get([
    'userscripts',
    'values_alpha',
    'values_beta',
    'settings',
    'scriptFolders',
    'sv_releaseDrill',
  ]);
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  SettingsManager.cache = null;
  ScriptStorage.cache = null;
  ScriptValues.cache = Object.create(null);
  ScriptValues.listeners.clear();
  ScriptValues._initPromises?.clear?.();
  for (const pending of ScriptValues.pendingNotifications.values()) {
    clearTimeout(pending.timeout);
  }
  ScriptValues.pendingNotifications.clear();
  FolderStorage.cache = null;
  vi.clearAllMocks();
});

describe(`release rollback storage drill (${PREVIOUS_PUBLIC_BASELINE} -> ${CURRENT_VERSION})`, () => {
  it('migrates the previous public v3 state, accepts rollback writes, and recovers them on return to current', async () => {
    const alpha = makeLegacyScript('alpha', 'Rollback Alpha', PREVIOUS_PUBLIC_BASELINE);
    const beta = makeLegacyScript('beta', 'Rollback Beta', PREVIOUS_PUBLIC_BASELINE);
    alpha.stats.lastUrl = 'https://example.com/private/account?token=secret';
    beta.stats.lastUrl = 'https://example.com/other/path#private';
    await ScriptsDAO.bulkPut([alpha, beta]);
    await ValuesDAO.set('alpha', 'counter', 7);
    await ValuesDAO.set('beta', 'mode', 'safe');
    await chrome.storage.local.set({
      _storageSchema: migrationTesting.SCHEMA_TARGET,
      settings: { theme: 'oled', autoUpdate: false, statsUrlRetention: 'full' },
      scriptFolders: [{
        id: 'folder_release',
        name: 'Release Drill',
        color: '#60a5fa',
        collapsed: false,
        scriptIds: ['alpha', 'beta'],
        createdAt: 1710000000000,
      }],
      sv_releaseDrill: { previousPublicBaseline: PREVIOUS_PUBLIC_BASELINE, currentVersion: CURRENT_VERSION },
    });

    // Current startup applies its one-time privacy/storage migration.
    expect((await SettingsManager.get()).statsUrlRetention).toBe('origin');
    expect((await ScriptStorage.get('alpha')).stats.lastUrl).toBe('https://example.com');
    expect((await ScriptsDAO.get('beta')).stats.lastUrl).toBe('https://example.com');

    // The store rolls back to the previous public package. Model its stable v3
    // DAO contract reading and writing user state after rollback.
    const rollbackAlpha = await ScriptsDAO.get('alpha');
    expect(rollbackAlpha.meta.version).toBe(PREVIOUS_PUBLIC_BASELINE);
    rollbackAlpha.enabled = false;
    rollbackAlpha.settings = { ...rollbackAlpha.settings, runInFrames: true };
    rollbackAlpha.stats.runs += 1;
    rollbackAlpha.stats.lastUrl = 'https://example.com';
    await ScriptsDAO.put(rollbackAlpha);
    await ValuesDAO.set('alpha', 'counter', 8);
    const rollbackSettings = (await chrome.storage.local.get('settings')).settings;
    await chrome.storage.local.set({ settings: { ...rollbackSettings, theme: 'light' } });

    // When a fixed current build returns, cold caches must recover every write
    // made by the rolled-back package without replaying or losing migration.
    ScriptStorage.invalidateCache();
    SettingsManager.cache = null;
    ScriptValues.cache = Object.create(null);
    ScriptValues._initPromises?.clear?.();
    expect(await ScriptStorage.get('alpha')).toMatchObject({
      enabled: false,
      settings: { runInFrames: true },
      stats: { runs: 3, lastUrl: 'https://example.com' },
    });
    expect(await ScriptValues.get('alpha', 'counter', 0)).toBe(8);
    expect(await SettingsManager.get('theme')).toBe('light');
    expect(await SettingsManager.get('statsUrlRetention')).toBe('origin');
  });

  it('upgrades historical v2 storage to current IDB while preserving rollback-readable legacy keys', async () => {
    const legacy = await seedHistoricalV2Storage();

    const migration = await ensureV3Migration();
    expect(migration).toEqual({
      ranMigration: true,
      scriptsMigrated: 2,
      valuesMigrated: 3,
      schemaVersion: migrationTesting.SCHEMA_TARGET,
    });

    const currentScripts = await ScriptStorage.getAll();
    expect(currentScripts.map((script) => script.id).sort()).toEqual(['alpha', 'beta']);
    expect((await ScriptsDAO.get('alpha'))?.code).toBe(legacy.userscripts.alpha.code);
    expect(await ValuesDAO.get('alpha', 'counter')).toBe(7);
    expect(await ScriptValues.get('beta', 'mode', null)).toBe('safe');

    const status = await getMigrationStatus();
    expect(status.schemaVersion).toBe(migrationTesting.SCHEMA_TARGET);
    expect(status.scriptsMigrated).toBe(2);
    expect(status.valuesMigrated).toBe(3);
    expect(typeof status.migratedAt).toBe('number');

    const rollbackSnapshot = await readLegacyRollbackSnapshot();
    expect(rollbackSnapshot.userscripts).toEqual(legacy.userscripts);
    expect(rollbackSnapshot.values_alpha).toEqual(legacy.values_alpha);
    expect(rollbackSnapshot.values_beta).toEqual(legacy.values_beta);
    expect(rollbackSnapshot.settings).toEqual(legacy.settings);
    expect(rollbackSnapshot.scriptFolders).toEqual(legacy.scriptFolders);
    expect(rollbackSnapshot.sv_releaseDrill).toEqual({
      previousPublicBaseline: LEGACY_V2_BASELINE,
      currentVersion: CURRENT_VERSION,
    });
  });

  it('keeps legacy rollback data for the safety window, then wipes only after TTL', async () => {
    const migratedAt = Date.UTC(2026, 4, 24, 9, 30, 0);
    await seedHistoricalV2Storage();

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(migratedAt);
    await ensureV3Migration();
    nowSpy.mockRestore();

    const beforeTtl = await maybeWipeLegacyData(migratedAt + migrationTesting.LEGACY_TOMBSTONE_TTL_MS - 1);
    expect(beforeTtl).toBe(false);
    expect((await readLegacyRollbackSnapshot()).userscripts.alpha.meta.name).toBe('Rollback Alpha');

    const afterTtl = await maybeWipeLegacyData(migratedAt + migrationTesting.LEGACY_TOMBSTONE_TTL_MS + 1);
    expect(afterTtl).toBe(true);

    const wiped = await chrome.storage.local.get([
      migrationTesting.LEGACY_USERSCRIPTS_KEY,
      `${migrationTesting.LEGACY_VALUE_PREFIX}alpha`,
      `${migrationTesting.LEGACY_VALUE_PREFIX}beta`,
      migrationTesting.LEGACY_TOMBSTONE_KEY,
      migrationTesting.SCHEMA_KEY,
    ]);
    expect(wiped[migrationTesting.LEGACY_USERSCRIPTS_KEY]).toBeUndefined();
    expect(wiped[`${migrationTesting.LEGACY_VALUE_PREFIX}alpha`]).toBeUndefined();
    expect(wiped[`${migrationTesting.LEGACY_VALUE_PREFIX}beta`]).toBeUndefined();
    expect(wiped[migrationTesting.LEGACY_TOMBSTONE_KEY]).toBeUndefined();
    expect(wiped[migrationTesting.SCHEMA_KEY]).toBe(migrationTesting.SCHEMA_TARGET);
  });
});
