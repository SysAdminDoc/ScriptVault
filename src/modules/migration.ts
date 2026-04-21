// ScriptVault v2.0.0 — Migration System
// Handles data migration from v1.x to v2.0.0 on first run after update.
// Runs in the service worker context (no DOM).

import type { ScriptSettings, ScriptStats, ScriptMeta } from '../types/index';

const CURRENT_VERSION = '2.1.8';
const MIGRATION_KEY = 'sv_lastMigratedVersion';

/** Notification preferences stored in chrome.storage.local. */
interface NotificationPrefs {
  updates: boolean;
  errors: boolean;
  digest: boolean;
  security: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
}

/** Backup scheduler settings stored in chrome.storage.local. */
interface BackupSchedulerSettings {
  enabled: boolean;
  type: string;
  hour: number;
  day: number;
  maxBackups: number;
  onChange: boolean;
}

/** Gamification state stored in chrome.storage.local. */
interface GamificationState {
  achievements: Record<string, unknown>;
  streaks: {
    daily: { current: number; longest: number; lastDate: string | null };
    creation: { current: number; longest: number; lastDate: string | null };
  };
  points: number;
  level: number;
  firstSeen: number;
}

/**
 * Legacy script shape as it may appear in v1.x storage.
 * Has optional fields that don't exist on the v2 Script type.
 */
interface LegacyScript {
  id?: string;
  code?: string;
  enabled?: boolean;
  position?: number;
  meta?: ScriptMeta;
  metadata?: ScriptMeta;
  settings?: ScriptSettings;
  stats?: ScriptStats;
  createdAt?: number;
  updatedAt?: number;
  installedAt?: number;
  [key: string]: unknown;
}

/**
 * Simple version comparison.
 * Returns -1, 0, or 1 like Array.sort comparators.
 */
function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] ?? 0;
    const b = p2[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Get all scripts from storage (raw, without ScriptStorage cache).
 */
async function getAllScripts(): Promise<Record<string, LegacyScript>> {
  const data: { userscripts?: unknown } = await chrome.storage.local.get('userscripts');
  return (data.userscripts && typeof data.userscripts === 'object')
    ? data.userscripts as Record<string, LegacyScript>
    : {};
}

/**
 * v1.x -> v2.0.0 migration
 */
async function migrateToV2(): Promise<void> {
  console.log('[Migration] Running v1.x \u2192 v2.0 migration...');

  // 1. Set install date if not present (for CWS review prompt)
  const installData: { installDate?: unknown } = await chrome.storage.local.get('installDate');
  if (!installData.installDate) {
    await chrome.storage.local.set({ installDate: Date.now() });
  }

  // 2. Initialize notification preferences with defaults
  const notifData: { notificationPrefs?: unknown } = await chrome.storage.local.get('notificationPrefs');
  if (!notifData.notificationPrefs) {
    const prefs: NotificationPrefs = {
      updates: true,
      errors: true,
      digest: false,
      security: true,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 7,
    };
    await chrome.storage.local.set({ notificationPrefs: prefs });
  }

  // 3. Initialize backup scheduler defaults
  const backupData: { backupSchedulerSettings?: unknown } = await chrome.storage.local.get('backupSchedulerSettings');
  if (!backupData.backupSchedulerSettings) {
    const settings: BackupSchedulerSettings = {
      enabled: true,
      type: 'weekly',
      hour: 3,
      day: 0, // Sunday
      maxBackups: 5,
      onChange: true,
    };
    await chrome.storage.local.set({ backupSchedulerSettings: settings });
  }

  // 4. Migrate script settings format if needed
  // v1.x stored some settings differently
  const scripts = await getAllScripts();
  let migrated = 0;
  for (const [id, script] of Object.entries(scripts)) {
    let changed = false;

    // Ensure settings object exists
    if (!script.settings) {
      script.settings = {} as ScriptSettings;
      changed = true;
    }

    // Ensure stats object exists
    if (!script.stats) {
      script.stats = { runs: 0, totalTime: 0, avgTime: 0, errors: 0 } as ScriptStats;
      changed = true;
    }

    // Migrate old 'metadata' key to 'meta' if present
    if (script.metadata && !script.meta) {
      script.meta = script.metadata;
      delete script.metadata;
      changed = true;
    }

    // Ensure installedAt is set
    if (!script.installedAt && script.createdAt) {
      script.installedAt = script.createdAt;
      changed = true;
    }

    if (changed) {
      scripts[id] = script;
      migrated++;
    }
  }

  if (migrated > 0) {
    await chrome.storage.local.set({ userscripts: scripts });
    console.log(`[Migration] Migrated ${migrated} script(s)`);
  }

  // 5. Clean up deprecated storage keys
  const deprecatedKeys: string[] = [
    'tm_settings', // Old Tampermonkey-named settings
    'lastChecked',  // Replaced by lastUpdateCheck
  ];
  await chrome.storage.local.remove(deprecatedKeys).catch(() => {});

  // 6. Set default gamification state
  const gamData: { gamification?: unknown } = await chrome.storage.local.get('gamification');
  if (!gamData.gamification) {
    const gamification: GamificationState = {
      achievements: {},
      streaks: {
        daily: { current: 0, longest: 0, lastDate: null },
        creation: { current: 0, longest: 0, lastDate: null },
      },
      points: 0,
      level: 1,
      firstSeen: Date.now(),
    };
    await chrome.storage.local.set({ gamification });
  }

  console.log('[Migration] v2.0 migration complete');
}

/**
 * Check if migration is needed and run it.
 * Called on service worker startup.
 */
async function run(): Promise<void> {
  try {
    const data: { [key: string]: unknown } = await chrome.storage.local.get(MIGRATION_KEY);
    const lastVersion = (data[MIGRATION_KEY] as string | undefined) ?? '0.0.0';

    if (lastVersion === CURRENT_VERSION) return; // Already migrated

    console.log(`[Migration] Migrating from ${lastVersion} to ${CURRENT_VERSION}`);

    // Run migrations in order
    if (compareVersions(lastVersion, '2.0.0') < 0) {
      await migrateToV2();
    }

    // Mark migration complete
    await chrome.storage.local.set({ [MIGRATION_KEY]: CURRENT_VERSION });
    console.log('[Migration] Complete');
  } catch (e: unknown) {
    console.error('[Migration] Error:', e);
  }
}

export const Migration = { run } as const;
export default Migration;
