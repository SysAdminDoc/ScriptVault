// ============================================================================
// v2 → v3 storage migration
// ----------------------------------------------------------------------------
// One-way migration: read the legacy `userscripts` blob and `values_*` keys
// from chrome.storage.local, write them to IndexedDB, mark the schema as v3.
// The legacy keys are kept for a 30-day safety window before final wipe so a
// rollback to v2.x is still recoverable.
// ============================================================================

import type { Script } from '../types/index';
import { ScriptsDAO, ValuesDAO, openScriptDB } from './script-db';

const SCHEMA_KEY = '_storageSchema';
const SCHEMA_TARGET = 3;
const LEGACY_USERSCRIPTS_KEY = 'userscripts';
const LEGACY_VALUE_PREFIX = 'values_';
const LEGACY_TOMBSTONE_KEY = '_v2LegacyTombstone';
const LEGACY_TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface LegacyTombstone {
  migratedAt: number;
  fromSchema?: number;
  toSchema?: number;
  scriptsMigrated?: number;
  valuesMigrated?: number;
}

export interface MigrationStatus {
  schemaVersion: number;
  migratedAt: number | null;
  scriptsMigrated: number;
  valuesMigrated: number;
}

export interface MigrationResult {
  ranMigration: boolean;
  scriptsMigrated: number;
  valuesMigrated: number;
  schemaVersion: number;
}

async function getSchemaVersion(): Promise<number> {
  const data = await chrome.storage.local.get(SCHEMA_KEY);
  const v = data[SCHEMA_KEY];
  return typeof v === 'number' ? v : 0;
}

async function setSchemaVersion(version: number): Promise<void> {
  await chrome.storage.local.set({ [SCHEMA_KEY]: version });
}

// Run the migration if needed. Idempotent — calling repeatedly after a
// successful migration is a cheap no-op (single chrome.storage read).
export async function ensureV3Migration(): Promise<MigrationResult> {
  const current = await getSchemaVersion();
  if (current >= SCHEMA_TARGET) {
    await openScriptDB(); // open even on no-op so subsequent calls are warm
    return {
      ranMigration: false,
      scriptsMigrated: 0,
      valuesMigrated: 0,
      schemaVersion: current,
    };
  }

  // Open IDB (creates schema if first run).
  await openScriptDB();

  const counts = await migrateLegacyToIDB();

  // Stamp tombstone metadata so a future cleanup pass knows when it's safe
  // to wipe the legacy chrome.storage keys.
  await chrome.storage.local.set({
    [LEGACY_TOMBSTONE_KEY]: {
      migratedAt: Date.now(),
      fromSchema: current,
      toSchema: SCHEMA_TARGET,
      scriptsMigrated: counts.scripts,
      valuesMigrated: counts.values,
    } satisfies LegacyTombstone,
  });
  await setSchemaVersion(SCHEMA_TARGET);

  return {
    ranMigration: true,
    scriptsMigrated: counts.scripts,
    valuesMigrated: counts.values,
    schemaVersion: SCHEMA_TARGET,
  };
}

interface MigrationCounts {
  scripts: number;
  values: number;
}

async function migrateLegacyToIDB(): Promise<MigrationCounts> {
  let scripts = 0;
  let values = 0;

  // ----- Scripts -----
  const scriptsBlob = await chrome.storage.local.get(LEGACY_USERSCRIPTS_KEY);
  const blob = scriptsBlob[LEGACY_USERSCRIPTS_KEY];
  if (blob && typeof blob === 'object') {
    const list = Object.values(blob as Record<string, Script>).filter(
      (s): s is Script => !!(s && typeof s === 'object' && (s as Script).id),
    );
    if (list.length > 0) {
      // Existing v3 rows take precedence — never clobber a record the user has
      // already touched on v3 (defensive: matters if a migration was retried).
      const existing = await ScriptsDAO.getAll();
      const existingIds = new Set(existing.map((s) => s.id));
      const fresh = list.filter((s) => !existingIds.has(s.id));
      if (fresh.length > 0) {
        await ScriptsDAO.bulkPut(fresh);
        scripts = fresh.length;
      }
    }
  }

  // ----- Values -----
  // Read the entire chrome.storage.local once and pluck `values_*` keys —
  // cheaper than N round-trips when the user has many scripts.
  const all = (await (chrome.storage.local.get as (k?: unknown) => Promise<Record<string, unknown>>)(undefined)) as Record<string, unknown>;
  const valueKeys = Object.keys(all).filter((k) => k.startsWith(LEGACY_VALUE_PREFIX));
  for (const storageKey of valueKeys) {
    const scriptId = storageKey.slice(LEGACY_VALUE_PREFIX.length);
    const bag = all[storageKey];
    if (!bag || typeof bag !== 'object') continue;
    const entries = Object.entries(bag as Record<string, unknown>);
    if (entries.length === 0) continue;
    const existingValues = await ValuesDAO.getAll(scriptId);
    const freshValues: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      if (Object.prototype.hasOwnProperty.call(existingValues, key)) continue;
      freshValues[key] = value;
    }
    const freshCount = Object.keys(freshValues).length;
    if (freshCount === 0) continue;
    await ValuesDAO.setAll(scriptId, freshValues);
    values += freshCount;
  }

  return { scripts, values };
}

// Background cleanup pass — call from an alarm/listener. Wipes the legacy
// chrome.storage.local keys once the tombstone has aged past TTL. Until then
// the data sits as a recovery safety net.
export async function maybeWipeLegacyData(now: number = Date.now()): Promise<boolean> {
  const data = await chrome.storage.local.get(LEGACY_TOMBSTONE_KEY);
  const tombstone = data[LEGACY_TOMBSTONE_KEY] as LegacyTombstone | undefined;
  if (!tombstone || typeof tombstone.migratedAt !== 'number') return false;
  if (now - tombstone.migratedAt < LEGACY_TOMBSTONE_TTL_MS) return false;

  // Schema must be v3 already — never wipe legacy data while still on v2.
  const version = await getSchemaVersion();
  if (version < SCHEMA_TARGET) return false;

  // Identify all legacy keys to remove.
  const all = (await (chrome.storage.local.get as (k?: unknown) => Promise<Record<string, unknown>>)(undefined)) as Record<string, unknown>;
  const toRemove: string[] = [];
  if (LEGACY_USERSCRIPTS_KEY in all) toRemove.push(LEGACY_USERSCRIPTS_KEY);
  for (const k of Object.keys(all)) {
    if (k.startsWith(LEGACY_VALUE_PREFIX)) toRemove.push(k);
  }
  toRemove.push(LEGACY_TOMBSTONE_KEY);

  if (toRemove.length > 0) {
    await chrome.storage.local.remove(toRemove);
  }
  return true;
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const [schemaVersion, tombstone, scriptCount] = await Promise.all([
    getSchemaVersion(),
    chrome.storage.local.get(LEGACY_TOMBSTONE_KEY).then(
      (d) => (d[LEGACY_TOMBSTONE_KEY] as LegacyTombstone | undefined) ?? null,
    ),
    ScriptsDAO.count().catch(() => 0),
  ]);
  return {
    schemaVersion,
    migratedAt: tombstone?.migratedAt ?? null,
    scriptsMigrated: tombstone?.scriptsMigrated ?? scriptCount,
    valuesMigrated: tombstone?.valuesMigrated ?? 0,
  };
}

// Constants exported for tests.
export const __testing = {
  SCHEMA_KEY,
  SCHEMA_TARGET,
  LEGACY_USERSCRIPTS_KEY,
  LEGACY_VALUE_PREFIX,
  LEGACY_TOMBSTONE_KEY,
  LEGACY_TOMBSTONE_TTL_MS,
};
