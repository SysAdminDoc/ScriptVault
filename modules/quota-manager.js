// ============================================================================
// Generated from src/modules/quota-manager.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const QuotaManager = (() => {
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

  // src/modules/quota-manager.ts
  var quota_manager_exports = {};
  __export(quota_manager_exports, {
    QuotaManager: () => QuotaManager
  });
  module.exports = __toCommonJS(quota_manager_exports);
  var QUOTA_FALLBACK = 10 * 1024 * 1024;
  var QUOTA_UNLIMITED = 500 * 1024 * 1024;
  var WARNING_THRESHOLD = 0.85;
  var CRITICAL_THRESHOLD = 0.95;
  var PERSISTENCE_STATUS_KEY = "sv_storage_persistence";
  var _resolvedQuota = null;
  function measureStoredBytes(value) {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized.length : 0;
  }
  function countStoredScripts(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return 0;
  }
  function measureBinaryBytes(value) {
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") {
      const byteLength = value.byteLength;
      return typeof byteLength === "number" && Number.isFinite(byteLength) ? byteLength : 0;
    }
    if (typeof Blob !== "undefined" && value instanceof Blob) return value.size;
    return 0;
  }
  async function readIndexedDbBreakdown(categories) {
    let scripts = [];
    let scriptsRead = false;
    let scriptValuesRead = false;
    let backupsRead = false;
    if (typeof ScriptStorage !== "undefined" && typeof ScriptStorage?.getAll === "function") {
      try {
        scripts = await ScriptStorage.getAll();
        categories.scripts.count = scripts.length;
        categories.scripts.bytes = scripts.reduce((total, script) => total + measureStoredBytes(script), 0);
        scriptsRead = true;
      } catch (_) {
      }
    }
    if (scriptsRead && typeof ScriptValues !== "undefined" && typeof ScriptValues?.getAll === "function") {
      try {
        const valueBags = await Promise.all(scripts.map((script) => ScriptValues.getAll(script.id)));
        for (const values of valueBags) {
          categories.scriptValues.count += Object.keys(values || {}).length;
          categories.scriptValues.bytes += measureStoredBytes(values || {});
        }
        scriptValuesRead = true;
      } catch (_) {
        categories.scriptValues = { count: 0, bytes: 0 };
      }
    }
    if (typeof BackupsDAO !== "undefined" && typeof BackupsDAO?.list === "function" && typeof BackupsDAO?.get === "function") {
      try {
        const backupList = await BackupsDAO.list();
        const backups = await Promise.all(backupList.map((entry) => BackupsDAO.get(entry.id)));
        for (const backup of backups) {
          if (!backup) continue;
          const { data, ...metadata } = backup;
          categories.backups.count++;
          categories.backups.bytes += measureStoredBytes(metadata) + measureBinaryBytes(data);
        }
        backupsRead = true;
      } catch (_) {
        categories.backups = { count: 0, bytes: 0 };
      }
    }
    return { scripts: scriptsRead, scriptValues: scriptValuesRead, backups: backupsRead };
  }
  async function _getQuotaLimit() {
    if (_resolvedQuota !== null) return _resolvedQuota;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota) {
          _resolvedQuota = est.quota;
          return _resolvedQuota;
        }
      } catch (_) {
      }
    }
    try {
      const perms = await chrome.permissions.getAll();
      if (perms.permissions?.includes("unlimitedStorage")) {
        _resolvedQuota = QUOTA_UNLIMITED;
        return _resolvedQuota;
      }
    } catch (_) {
    }
    _resolvedQuota = QUOTA_FALLBACK;
    return _resolvedQuota;
  }
  async function getUsage() {
    const quotaLimit = await _getQuotaLimit();
    let bytesUsed;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        bytesUsed = typeof est.usage === "number" ? est.usage : await chrome.storage.local.getBytesInUse(void 0);
      } catch (_) {
        bytesUsed = await chrome.storage.local.getBytesInUse(void 0);
      }
    } else {
      bytesUsed = await chrome.storage.local.getBytesInUse(void 0);
    }
    const percentage = quotaLimit > 0 ? bytesUsed / quotaLimit : 0;
    const level = percentage >= CRITICAL_THRESHOLD ? "critical" : percentage >= WARNING_THRESHOLD ? "warning" : "ok";
    return { bytesUsed, quota: quotaLimit, percentage, level };
  }
  function normalizePersistenceStatus(value) {
    if (!value || typeof value !== "object") return null;
    const record = value;
    return {
      supported: record.supported === true,
      requested: record.requested === true,
      persisted: record.persisted === true,
      granted: record.granted === true,
      checkedAt: typeof record.checkedAt === "number" ? record.checkedAt : 0,
      reason: typeof record.reason === "string" ? record.reason : "",
      bytes: typeof record.bytes === "number" ? record.bytes : 0,
      error: typeof record.error === "string" ? record.error : ""
    };
  }
  async function getPersistenceStatus() {
    const data = await chrome.storage.local.get(PERSISTENCE_STATUS_KEY);
    return normalizePersistenceStatus(data[PERSISTENCE_STATUS_KEY]);
  }
  async function savePersistenceStatus(status) {
    await chrome.storage.local.set({ [PERSISTENCE_STATUS_KEY]: status });
    return status;
  }
  async function ensurePersistentStorageForWrite(options = {}) {
    const existing = await getPersistenceStatus();
    if (existing?.requested && !options.force) return existing;
    const reason = typeof options.reason === "string" && options.reason.trim() ? options.reason.trim() : "script-write";
    const bytes = Math.max(0, Number(options.bytes || 0) || 0);
    const now = Date.now();
    const storageApi = typeof navigator !== "undefined" ? navigator.storage : void 0;
    if (!storageApi?.persist) {
      return await savePersistenceStatus({
        supported: false,
        requested: true,
        persisted: false,
        granted: false,
        checkedAt: now,
        reason,
        bytes,
        error: "navigator.storage.persist is unavailable"
      });
    }
    try {
      const alreadyPersisted = typeof storageApi.persisted === "function" ? await storageApi.persisted() : false;
      const granted = alreadyPersisted ? true : await storageApi.persist();
      return await savePersistenceStatus({
        supported: true,
        requested: true,
        persisted: granted === true,
        granted: granted === true,
        checkedAt: Date.now(),
        reason,
        bytes,
        error: ""
      });
    } catch (error) {
      return await savePersistenceStatus({
        supported: true,
        requested: true,
        persisted: false,
        granted: false,
        checkedAt: Date.now(),
        reason,
        bytes,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  async function getBreakdown() {
    const all = await chrome.storage.local.get(void 0);
    const categories = {
      scripts: { count: 0, bytes: 0 },
      scriptValues: { count: 0, bytes: 0 },
      requireCache: { count: 0, bytes: 0 },
      resourceCache: { count: 0, bytes: 0 },
      backups: { count: 0, bytes: 0 },
      analytics: { count: 0, bytes: 0 },
      settings: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 }
    };
    const indexedDb = await readIndexedDbBreakdown(categories);
    for (const [key, value] of Object.entries(all)) {
      const size = measureStoredBytes(value);
      if (!indexedDb.scripts && key === "userscripts") {
        categories.scripts.count += countStoredScripts(value);
        categories.scripts.bytes += size;
      } else if (!indexedDb.scripts && key.startsWith("script_")) {
        categories.scripts.count++;
        categories.scripts.bytes += size;
      } else if (!indexedDb.scriptValues && (key.startsWith("values_") || key.startsWith("SV_GM_"))) {
        categories.scriptValues.count++;
        categories.scriptValues.bytes += size;
      } else if (key.startsWith("require_cache_")) {
        categories.requireCache.count++;
        categories.requireCache.bytes += size;
      } else if (key.startsWith("res_cache_")) {
        categories.resourceCache.count++;
        categories.resourceCache.bytes += size;
      } else if (!indexedDb.backups && (key.startsWith("autoBackup") || key === "autoBackups")) {
        categories.backups.count++;
        categories.backups.bytes += size;
      } else if (key.startsWith("sv_analytics") || key === "analytics" || key === "perfHistory") {
        categories.analytics.count++;
        categories.analytics.bytes += size;
      } else if (key === "settings" || key.startsWith("sv_") || key.startsWith("notification") || key.startsWith("gamification")) {
        categories.settings.count++;
        categories.settings.bytes += size;
      } else if (indexedDb.scripts && (key === "userscripts" || key.startsWith("script_")) || indexedDb.scriptValues && (key.startsWith("values_") || key.startsWith("SV_GM_")) || indexedDb.backups && (key.startsWith("autoBackup") || key === "autoBackups")) {
      } else {
        categories.other.count++;
        categories.other.bytes += size;
      }
    }
    return categories;
  }
  async function cleanup(options = {}) {
    const actions = [];
    let freedBytes = 0;
    const all = await chrome.storage.local.get(void 0);
    const keysToRemove = /* @__PURE__ */ new Set();
    const scheduleRemoval = (key) => {
      if (!(key in all) || keysToRemove.has(key)) return false;
      freedBytes += measureStoredBytes(all[key]);
      keysToRemove.add(key);
      return true;
    };
    if (options.requireCache !== false) {
      const expiredKeys = [];
      const now = Date.now();
      for (const [key, value] of Object.entries(all)) {
        const entry = value;
        if (key.startsWith("require_cache_") && entry && typeof entry === "object" && "timestamp" in entry) {
          const ts = entry.timestamp;
          if (now - ts > 7 * 24 * 60 * 60 * 1e3) {
            expiredKeys.push(key);
            freedBytes += measureStoredBytes(value);
          }
        }
        if (key.startsWith("res_cache_") && entry && typeof entry === "object" && "timestamp" in entry) {
          const ts = entry.timestamp;
          if (now - ts > 7 * 24 * 60 * 60 * 1e3) {
            expiredKeys.push(key);
            freedBytes += measureStoredBytes(value);
          }
        }
      }
      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys);
        actions.push(`Removed ${expiredKeys.length} expired cache entries`);
      }
    }
    if (options.errorLog !== false) {
      const errorLog = all.errorLog;
      if (errorLog && errorLog.length > 200) {
        const trimmed = errorLog.slice(-200);
        const removed = errorLog.length - trimmed.length;
        await chrome.storage.local.set({ errorLog: trimmed });
        actions.push(`Pruned ${removed} error log entries`);
        freedBytes += Math.max(0, measureStoredBytes(errorLog) - measureStoredBytes(trimmed));
      }
    }
    if (options.cspReports !== false) {
      const cspReports = all.sv_csp_reports;
      if (cspReports && cspReports.length > 100) {
        const trimmed = cspReports.slice(-100);
        await chrome.storage.local.set({ sv_csp_reports: trimmed });
        actions.push("Pruned old CSP reports");
        freedBytes += Math.max(0, measureStoredBytes(cspReports) - measureStoredBytes(trimmed));
      }
    }
    if (options.tombstones !== false) {
      const syncTombstones = all.syncTombstones;
      if (syncTombstones) {
        const now = Date.now();
        const cutoff = 30 * 24 * 60 * 60 * 1e3;
        const settings = all.settings;
        const lastSync = typeof settings?.lastSync === "number" && Number.isFinite(settings.lastSync) ? settings.lastSync : 0;
        let pruned = 0;
        const nextTombstones = { ...syncTombstones };
        for (const [id, ts] of Object.entries(syncTombstones)) {
          if (typeof ts === "number" && Number.isFinite(ts) && now - ts > cutoff && ts < lastSync) {
            delete nextTombstones[id];
            pruned++;
          }
        }
        if (pruned > 0) {
          if (Object.keys(nextTombstones).length === 0) {
            await chrome.storage.local.remove("syncTombstones");
          } else {
            await chrome.storage.local.set({ syncTombstones: nextTombstones });
          }
          actions.push(`Pruned ${pruned} sync tombstones`);
          freedBytes += Math.max(0, measureStoredBytes(syncTombstones) - (Object.keys(nextTombstones).length === 0 ? 0 : measureStoredBytes(nextTombstones)));
        }
      }
    }
    if (options.npmCache) {
      if (scheduleRemoval("npmCache")) {
        actions.push("Cleared npm package cache");
      }
    }
    if (options.analytics) {
      const analyticsKeys = Object.keys(all).filter((key) => key === "analytics" || key.startsWith("sv_analytics"));
      const removedAnalytics = analyticsKeys.filter((key) => scheduleRemoval(key));
      if (removedAnalytics.length > 0) {
        actions.push(`Cleared ${removedAnalytics.length} analytics entr${removedAnalytics.length === 1 ? "y" : "ies"}`);
      }
    }
    if (options.perfHistory) {
      if (scheduleRemoval("perfHistory")) {
        actions.push("Cleared performance history");
      }
    }
    if (keysToRemove.size > 0) {
      await chrome.storage.local.remove([...keysToRemove]);
    }
    return { freedBytes, actions };
  }
  async function autoCleanup() {
    const usage = await getUsage();
    if (usage.level === "ok") return null;
    console.log(`[QuotaManager] Storage at ${(usage.percentage * 100).toFixed(1)}% \u2014 running cleanup`);
    const result = await cleanup({
      npmCache: usage.level === "critical"
    });
    if (usage.level === "critical" && result.freedBytes < 5e5) {
      const aggressiveResult = await cleanup({ analytics: true, perfHistory: true, errorLog: true, cspReports: true });
      return {
        freedBytes: result.freedBytes + aggressiveResult.freedBytes,
        actions: [...result.actions, ...aggressiveResult.actions]
      };
    }
    return result;
  }
  var QuotaManager = { getUsage, getBreakdown, getPersistenceStatus, ensurePersistentStorageForWrite, cleanup, autoCleanup };
  return module.exports.default || module.exports.QuotaManager || module.exports;
})();
