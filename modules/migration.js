// ============================================================================
// Generated from src/modules/migration.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const Migration = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/modules/migration.ts
  var migration_exports = {};
  __export(migration_exports, {
    Migration: () => Migration,
    default: () => migration_default
  });
  module.exports = __toCommonJS(migration_exports);
  var CURRENT_VERSION = "3.20.0";
  var MIGRATION_KEY = "sv_lastMigratedVersion";
  function compareVersions(v1, v2) {
    const p1 = v1.split(".").map(Number);
    const p2 = v2.split(".").map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] ?? 0;
      const b = p2[i] ?? 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }
  async function getAllScripts() {
    const data = await chrome.storage.local.get("userscripts");
    return data.userscripts && typeof data.userscripts === "object" && !Array.isArray(data.userscripts) ? data.userscripts : {};
  }
  async function migrateToV2() {
    console.log("[Migration] Running v1.x \u2192 v2.0 migration...");
    const installData = await chrome.storage.local.get("installDate");
    if (!installData.installDate) {
      await chrome.storage.local.set({ installDate: Date.now() });
    }
    const notifData = await chrome.storage.local.get("notificationPrefs");
    if (!notifData.notificationPrefs) {
      const prefs = {
        updates: true,
        errors: true,
        digest: false,
        security: true,
        quietHoursEnabled: false,
        quietHoursStart: 22,
        quietHoursEnd: 7
      };
      await chrome.storage.local.set({ notificationPrefs: prefs });
    }
    const backupData = await chrome.storage.local.get("backupSchedulerSettings");
    if (!backupData.backupSchedulerSettings) {
      const settings = {
        enabled: true,
        type: "weekly",
        hour: 3,
        day: 0,
        // Sunday
        maxBackups: 5,
        onChange: true
      };
      await chrome.storage.local.set({ backupSchedulerSettings: settings });
    }
    const scripts = await getAllScripts();
    let migrated = 0;
    for (const [id, script] of Object.entries(scripts)) {
      if (!script || typeof script !== "object" || Array.isArray(script)) continue;
      let changed = false;
      if (!script.settings || typeof script.settings !== "object" || Array.isArray(script.settings)) {
        script.settings = {};
        changed = true;
      }
      if (!script.stats || typeof script.stats !== "object" || Array.isArray(script.stats)) {
        script.stats = { runs: 0, totalTime: 0, avgTime: 0, errors: 0 };
        changed = true;
      }
      if (script.metadata && typeof script.metadata === "object" && !Array.isArray(script.metadata) && !script.meta) {
        script.meta = script.metadata;
        delete script.metadata;
        changed = true;
      }
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
    const deprecatedKeys = [
      "tm_settings",
      // Old Tampermonkey-named settings
      "lastChecked"
      // Replaced by lastUpdateCheck
    ];
    await chrome.storage.local.remove(deprecatedKeys).catch(() => {
    });
    const gamData = await chrome.storage.local.get("gamification");
    if (!gamData.gamification) {
      const gamification = {
        achievements: {},
        streaks: {
          daily: { current: 0, longest: 0, lastDate: null },
          creation: { current: 0, longest: 0, lastDate: null }
        },
        points: 0,
        level: 1,
        firstSeen: Date.now()
      };
      await chrome.storage.local.set({ gamification });
    }
    console.log("[Migration] v2.0 migration complete");
  }
  async function migrateScopedHostPermissionsOptIn() {
    const data = await chrome.storage.local.get("settings");
    const settings = data.settings;
    if (!settings || typeof settings !== "object") return;
    const record = settings;
    if (record.scopedHostPermissions !== true) return;
    delete record.scopedHostPermissions;
    await chrome.storage.local.set({ settings: record });
    console.log("[Migration] Reset scopedHostPermissions to the v3.19.2 default (off)");
  }
  async function run() {
    try {
      const data = await chrome.storage.local.get(MIGRATION_KEY);
      const persistedVersion = data[MIGRATION_KEY];
      const lastVersion = typeof persistedVersion === "string" && persistedVersion.trim() ? persistedVersion : "0.0.0";
      if (lastVersion === CURRENT_VERSION) return;
      console.log(`[Migration] Migrating from ${lastVersion} to ${CURRENT_VERSION}`);
      if (compareVersions(lastVersion, "2.0.0") < 0) {
        await migrateToV2();
      }
      if (compareVersions(lastVersion, "3.19.2") < 0) {
        await migrateScopedHostPermissionsOptIn();
      }
      await chrome.storage.local.set({ [MIGRATION_KEY]: CURRENT_VERSION });
      console.log("[Migration] Complete");
    } catch (e) {
      console.error("[Migration] Error:", e);
    }
  }
  var Migration = { run };
  var migration_default = Migration;
  return module.exports.default || module.exports.Migration || module.exports;
})();
