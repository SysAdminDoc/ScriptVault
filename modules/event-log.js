// ============================================================================
// Generated from src/modules/event-log.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const EventLog = (() => {
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

  // src/modules/event-log.ts
  var event_log_exports = {};
  __export(event_log_exports, {
    EventLog: () => EventLog,
    default: () => event_log_default
  });
  module.exports = __toCommonJS(event_log_exports);
  var STORAGE_KEY = "eventLog";
  var MAX_ENTRIES = 1e3;
  var SAVE_DEBOUNCE_MS = 300;
  var _cache = null;
  var _loadPromise = null;
  var _pendingSaveTimer = null;
  async function _load() {
    if (_cache !== null) return _cache;
    if (!_loadPromise) {
      _loadPromise = (async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        _cache = data[STORAGE_KEY] || [];
        return _cache;
      })();
    }
    return _loadPromise;
  }
  async function _writeCacheToStorage() {
    if (_cache === null) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: _cache });
  }
  function _scheduleSave() {
    if (_pendingSaveTimer) return;
    _pendingSaveTimer = setTimeout(() => {
      _pendingSaveTimer = null;
      _writeCacheToStorage().catch((e) => {
        console.warn("[EventLog] debounced save failed:", e?.message || e);
      });
    }, SAVE_DEBOUNCE_MS);
  }
  function _generateId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function _extractHostname(url) {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
  async function log(entry) {
    const entries = await _load();
    const record = {
      id: _generateId(),
      timestamp: Date.now(),
      category: entry.category,
      severity: entry.severity || "info",
      action: entry.action,
      detail: entry.detail || "",
      scriptId: entry.scriptId ?? null,
      scriptName: entry.scriptName ?? null,
      hostname: _extractHostname(entry.url)
    };
    entries.unshift(record);
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }
    _scheduleSave();
    return record;
  }
  async function getAll(filters) {
    const entries = await _load();
    if (!filters) return [...entries];
    return entries.filter((record) => {
      if (filters.category && record.category !== filters.category) return false;
      if (filters.severity && record.severity !== filters.severity) return false;
      if (filters.scriptId && record.scriptId !== filters.scriptId) return false;
      if (filters.startDate && record.timestamp < filters.startDate) return false;
      if (filters.endDate && record.timestamp > filters.endDate) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = `${record.action} ${record.detail} ${record.scriptName || ""} ${record.hostname || ""}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }
  async function clear() {
    _cache = [];
    if (_pendingSaveTimer) {
      clearTimeout(_pendingSaveTimer);
      _pendingSaveTimer = null;
    }
    await _writeCacheToStorage();
  }
  async function flush() {
    if (_pendingSaveTimer) {
      clearTimeout(_pendingSaveTimer);
      _pendingSaveTimer = null;
    }
    await _writeCacheToStorage();
  }
  async function getSummary() {
    const entries = await _load();
    const byCategory = {};
    const bySeverity = {};
    let oldest = null;
    let newest = null;
    for (const record of entries) {
      byCategory[record.category] = (byCategory[record.category] || 0) + 1;
      bySeverity[record.severity] = (bySeverity[record.severity] || 0) + 1;
      if (oldest === null || record.timestamp < oldest) oldest = record.timestamp;
      if (newest === null || record.timestamp > newest) newest = record.timestamp;
    }
    return {
      total: entries.length,
      byCategory,
      bySeverity,
      oldestTimestamp: oldest,
      newestTimestamp: newest
    };
  }
  function exportJSON(entries) {
    return JSON.stringify({
      schema: "scriptvault-event-log/v1",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: entries.length,
      entries
    }, null, 2);
  }
  function exportCSV(entries) {
    const header = "timestamp,category,severity,action,detail,scriptId,scriptName,hostname";
    const rows = entries.map((r) => {
      const ts = new Date(r.timestamp).toISOString();
      const esc = (s) => {
        let str = String(s ?? "");
        if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
        return `"${str.replace(/"/g, '""')}"`;
      };
      return `${ts},${r.category},${r.severity},${esc(r.action)},${esc(r.detail)},${esc(r.scriptId)},${esc(r.scriptName)},${esc(r.hostname)}`;
    });
    return [header, ...rows].join("\n");
  }
  function setMaxEntries(n) {
    MAX_ENTRIES = n;
  }
  var EventLog = {
    log,
    getAll,
    clear,
    flush,
    getSummary,
    exportJSON,
    exportCSV,
    setMaxEntries
  };
  var event_log_default = EventLog;
  return module.exports.default || module.exports.EventLog || module.exports;
})();
