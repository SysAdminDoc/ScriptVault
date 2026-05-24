// Release rollback and storage backward-compatibility drill.
//
// This test is intentionally command-shaped: `npm run release:rollback-drill`
// seeds the previous public chrome.storage.local shape, upgrades through the
// current v3 migration path, then verifies both current IDB reads and a
// simulated rollback reader can still recover the legacy snapshot.

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

const PREVIOUS_PUBLIC_BASELINE = '2.3.4';
const CURRENT_VERSION = JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8')).version;

function makeLegacyScript(id, name, version = PREVIOUS_PUBLIC_BASELINE) {
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

async function seedPreviousPublicStorage() {
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
      previousPublicBaseline: PREVIOUS_PUBLIC_BASELINE,
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
  it('upgrades legacy storage to current IDB while preserving rollback-readable legacy keys', async () => {
    const legacy = await seedPreviousPublicStorage();

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
      previousPublicBaseline: PREVIOUS_PUBLIC_BASELINE,
      currentVersion: CURRENT_VERSION,
    });
  });

  it('keeps legacy rollback data for the safety window, then wipes only after TTL', async () => {
    const migratedAt = Date.UTC(2026, 4, 24, 9, 30, 0);
    await seedPreviousPublicStorage();

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
