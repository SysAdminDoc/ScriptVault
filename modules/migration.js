// ScriptVault v2.0.0 — Migration System
// Handles data migration from v1.x to v2.0.0 on first run after update.
// Runs in the service worker context (no DOM).

const Migration = (() => {
  'use strict';

  const CURRENT_VERSION = '2.0.0';
  const MIGRATION_KEY = 'sv_lastMigratedVersion';

  /**
   * Check if migration is needed and run it.
   * Called on service worker startup.
   */
  async function run() {
    try {
      const data = await chrome.storage.local.get(MIGRATION_KEY);
      const lastVersion = data[MIGRATION_KEY] || '0.0.0';

      if (lastVersion === CURRENT_VERSION) return; // Already migrated

      console.log(`[Migration] Migrating from ${lastVersion} to ${CURRENT_VERSION}`);

      // Run migrations in order
      if (compareVersions(lastVersion, '2.0.0') < 0) {
        await migrateToV2();
      }

      // Mark migration complete
      await chrome.storage.local.set({ [MIGRATION_KEY]: CURRENT_VERSION });
      console.log('[Migration] Complete');
    } catch (e) {
      console.error('[Migration] Error:', e);
    }
  }

  /**
   * v1.x → v2.0.0 migration
   */
  async function migrateToV2() {
    console.log('[Migration] Running v1.x → v2.0 migration...');

    // 1. Set install date if not present (for CWS review prompt)
    const installData = await chrome.storage.local.get('installDate');
    if (!installData.installDate) {
      await chrome.storage.local.set({ installDate: Date.now() });
    }

    // 2. Initialize notification preferences with defaults
    const notifData = await chrome.storage.local.get('notificationPrefs');
    if (!notifData.notificationPrefs) {
      await chrome.storage.local.set({
        notificationPrefs: {
          updates: true,
          errors: true,
          digest: false,
          security: true,
          quietStart: null,
          quietEnd: null
        }
      });
    }

    // 3. Initialize backup scheduler defaults
    const backupData = await chrome.storage.local.get('backupSchedulerSettings');
    if (!backupData.backupSchedulerSettings) {
      await chrome.storage.local.set({
        backupSchedulerSettings: {
          enabled: true,
          type: 'weekly',
          hour: 3,
          day: 0, // Sunday
          maxBackups: 5,
          onChange: true
        }
      });
    }

    // 4. Migrate script settings format if needed
    // v1.x stored some settings differently
    const scripts = await getAllScripts();
    let migrated = 0;
    for (const [id, script] of Object.entries(scripts)) {
      let changed = false;

      // Ensure settings object exists
      if (!script.settings) {
        script.settings = {};
        changed = true;
      }

      // Ensure stats object exists
      if (!script.stats) {
        script.stats = { runs: 0, totalTime: 0, avgTime: 0, errors: 0 };
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
    const deprecatedKeys = [
      'tm_settings', // Old Tampermonkey-named settings
      'lastChecked',  // Replaced by lastUpdateCheck
    ];
    await chrome.storage.local.remove(deprecatedKeys).catch(() => {});

    // 6. Set default gamification state
    const gamData = await chrome.storage.local.get('gamification');
    if (!gamData.gamification) {
      await chrome.storage.local.set({
        gamification: {
          achievements: {},
          streaks: { daily: { current: 0, longest: 0, lastDate: null }, creation: { current: 0, longest: 0, lastDate: null } },
          points: 0,
          level: 1,
          firstSeen: Date.now()
        }
      });
    }

    console.log('[Migration] v2.0 migration complete');
  }

  /**
   * Get all scripts from storage (raw, without ScriptStorage cache)
   */
  async function getAllScripts() {
    const data = await chrome.storage.local.get('userscripts');
    return (data.userscripts && typeof data.userscripts === 'object') ? data.userscripts : {};
  }

  /**
   * Simple version comparison
   */
  function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] || 0, b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  return { run };
})();
