// ============================================================================
// Generated from src/modules/error-log.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ErrorLog = (() => {
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

  // src/modules/error-log.ts
  var error_log_exports = {};
  __export(error_log_exports, {
    _save: () => _save,
    clear: () => clear,
    default: () => error_log_default,
    exportCSV: () => exportCSV,
    exportJSON: () => exportJSON,
    exportText: () => exportText,
    flush: () => flush,
    getAll: () => getAll,
    getGrouped: () => getGrouped,
    getStats: () => getStats,
    log: () => log,
    logGMError: () => logGMError,
    logScriptError: () => logScriptError,
    registerGlobalHandlers: () => registerGlobalHandlers
  });
  module.exports = __toCommonJS(error_log_exports);
  var STORAGE_KEY = "errorLog";
  var MAX_ENTRIES = 500;
  var SAVE_DEBOUNCE_MS = 200;
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
        console.warn("[ErrorLog] debounced save failed:", e?.message || e);
      });
    }, SAVE_DEBOUNCE_MS);
  }
  async function flush() {
    if (_pendingSaveTimer) {
      clearTimeout(_pendingSaveTimer);
      _pendingSaveTimer = null;
    }
    await _writeCacheToStorage();
  }
  async function _save() {
    await flush();
  }
  async function log(entry) {
    let entries = await _load();
    const errorValue = entry.error;
    const errorObj = errorValue;
    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      scriptId: entry.scriptId || null,
      scriptName: entry.scriptName || null,
      error: typeof errorValue === "string" ? errorValue : errorObj?.message || String(errorValue),
      stack: (entry.stack || errorObj?.stack || "").slice(0, 8e3) || null,
      url: entry.url || null,
      source: typeof entry.source === "string" ? entry.source.slice(0, 4096) : null,
      line: entry.line ?? null,
      col: entry.col ?? null,
      generatedLine: entry.generatedLine ?? null,
      generatedCol: entry.generatedCol ?? null,
      context: entry.context || null
    };
    if (!record.scriptName && record.scriptId) {
      try {
        if (typeof ScriptStorage !== "undefined" && ScriptStorage) {
          const script = await ScriptStorage.get(record.scriptId);
          if (script?.meta?.name) record.scriptName = script.meta.name;
        }
      } catch (_) {
      }
    }
    entries.push(record);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES);
    }
    _cache = entries;
    _scheduleSave();
    return record;
  }
  async function getAll(filters) {
    let entries = await _load();
    if (!filters) return [...entries];
    if (filters.scriptId) {
      entries = entries.filter((e) => e.scriptId === filters.scriptId);
    }
    if (filters.startDate) {
      const start = typeof filters.startDate === "number" ? filters.startDate : new Date(filters.startDate).getTime();
      entries = entries.filter((e) => e.timestamp >= start);
    }
    if (filters.endDate) {
      const end = typeof filters.endDate === "number" ? filters.endDate : new Date(filters.endDate).getTime();
      entries = entries.filter((e) => e.timestamp <= end);
    }
    if (filters.errorType) {
      const type = filters.errorType.toLowerCase();
      entries = entries.filter((e) => {
        const msg = (e.error || "").toLowerCase();
        return msg.includes(type);
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      entries = entries.filter(
        (e) => (e.error || "").toLowerCase().includes(q) || (e.scriptName || "").toLowerCase().includes(q) || (e.stack || "").toLowerCase().includes(q) || (e.url || "").toLowerCase().includes(q) || (e.context || "").toLowerCase().includes(q)
      );
    }
    return entries;
  }
  async function getGrouped(filters) {
    const entries = await getAll(filters);
    const groups = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const key = `${entry.scriptId || ""}::${entry.error || ""}`;
      if (groups.has(key)) {
        const group = groups.get(key);
        group.count++;
        if (entry.timestamp < group.firstSeen) group.firstSeen = entry.timestamp;
        if (entry.timestamp > group.lastSeen) group.lastSeen = entry.timestamp;
        if (entry.stack && entry.timestamp >= group.lastSeen) {
          group.sampleStack = entry.stack;
        }
      } else {
        groups.set(key, {
          key,
          error: entry.error,
          scriptId: entry.scriptId,
          scriptName: entry.scriptName,
          count: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          sampleStack: entry.stack || null
        });
      }
    }
    return [...groups.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }
  async function exportJSON(filters) {
    const entries = await getAll(filters);
    return JSON.stringify({
      exported: (/* @__PURE__ */ new Date()).toISOString(),
      count: entries.length,
      entries
    }, null, 2);
  }
  async function exportText(filters) {
    const entries = await getAll(filters);
    const lines = [
      `ScriptVault Error Log - Exported ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `Total entries: ${entries.length}`,
      "=".repeat(80),
      ""
    ];
    for (const e of entries) {
      const time = new Date(e.timestamp).toISOString();
      lines.push(`[${time}] ${e.scriptName || e.scriptId || "Unknown"}`);
      lines.push(`  Error: ${e.error}`);
      if (e.url) lines.push(`  URL: ${e.url}`);
      if (e.source) lines.push(`  Source: ${e.source}${e.line != null ? `:${e.line}` : ""}${e.col != null ? `:${e.col}` : ""}`);
      if (e.context) lines.push(`  Context: ${e.context}`);
      if (e.stack) {
        lines.push("  Stack:");
        for (const sLine of e.stack.split("\n").slice(0, 5)) {
          lines.push(`    ${sLine.trim()}`);
        }
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  async function exportCSV(filters) {
    const entries = await getAll(filters);
    const headers = ["timestamp", "datetime", "scriptId", "scriptName", "error", "url", "source", "line", "col", "generatedLine", "generatedCol", "context"];
    const escapeCSV = (val) => {
      if (val == null) return "";
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const rows = [headers.join(",")];
    for (const e of entries) {
      rows.push([
        e.timestamp,
        new Date(e.timestamp).toISOString(),
        escapeCSV(e.scriptId),
        escapeCSV(e.scriptName),
        escapeCSV(e.error),
        escapeCSV(e.url),
        escapeCSV(e.source),
        e.line ?? "",
        e.col ?? "",
        e.generatedLine ?? "",
        e.generatedCol ?? "",
        escapeCSV(e.context)
      ].join(","));
    }
    return rows.join("\n");
  }
  async function clear(scriptId) {
    if (scriptId) {
      const entries = await _load();
      _cache = entries.filter((e) => e.scriptId !== scriptId);
    } else {
      _cache = [];
    }
    await flush();
  }
  async function getStats() {
    const entries = await _load();
    const byScript = {};
    for (const e of entries) {
      const key = e.scriptId || "unknown";
      if (!byScript[key]) {
        byScript[key] = { scriptId: e.scriptId, scriptName: e.scriptName, count: 0 };
      }
      byScript[key].count++;
    }
    const storageBytes = JSON.stringify(entries).length;
    return {
      total: entries.length,
      maxEntries: MAX_ENTRIES,
      byScript: Object.values(byScript).sort((a, b) => b.count - a.count),
      oldest: entries.length > 0 ? entries[0].timestamp : null,
      newest: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
      storageBytes
    };
  }
  function registerGlobalHandlers() {
    self.addEventListener("error", (event) => {
      log({
        scriptId: null,
        scriptName: "ServiceWorker",
        error: event.message || "Unknown error",
        stack: event.error?.stack || null,
        url: event.filename || null,
        line: event.lineno ?? null,
        col: event.colno ?? null,
        context: "global-error-handler"
      }).catch(() => {
      });
    });
    self.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      log({
        scriptId: null,
        scriptName: "ServiceWorker",
        error: reason?.message || String(reason),
        stack: reason?.stack || null,
        context: "unhandled-rejection"
      }).catch(() => {
      });
    });
    console.log("[ScriptVault] Error log global handlers registered");
  }
  async function logScriptError(scriptId, scriptName, errorData) {
    return log({
      scriptId,
      scriptName,
      error: errorData.message || errorData.error || "Script execution error",
      stack: errorData.stack || null,
      url: errorData.url || null,
      source: errorData.source || null,
      line: errorData.line ?? errorData.lineno ?? null,
      col: errorData.col ?? errorData.colno ?? null,
      generatedLine: errorData.generatedLine ?? null,
      generatedCol: errorData.generatedCol ?? null,
      context: "script-execution"
    });
  }
  async function logGMError(scriptId, scriptName, apiName, error) {
    const errorObj = error;
    return log({
      scriptId,
      scriptName,
      error: `GM API ${apiName}: ${typeof error === "string" ? error : errorObj?.message || String(error)}`,
      stack: errorObj?.stack || null,
      context: `gm-api-${apiName}`
    });
  }
  var ErrorLog = {
    get STORAGE_KEY() {
      return STORAGE_KEY;
    },
    get MAX_ENTRIES() {
      return MAX_ENTRIES;
    },
    set MAX_ENTRIES(value) {
      MAX_ENTRIES = Number.isFinite(value) && value > 0 ? Math.floor(value) : 500;
    },
    get SAVE_DEBOUNCE_MS() {
      return SAVE_DEBOUNCE_MS;
    },
    get _cache() {
      return _cache;
    },
    set _cache(value) {
      _cache = value;
      if (value === null) _loadPromise = null;
    },
    get _pendingSaveTimer() {
      return _pendingSaveTimer;
    },
    set _pendingSaveTimer(value) {
      _pendingSaveTimer = value;
    },
    log,
    getAll,
    getGrouped,
    exportJSON,
    exportText,
    exportCSV,
    clear,
    getStats,
    registerGlobalHandlers,
    logScriptError,
    logGMError,
    flush,
    _save
  };
  var error_log_default = ErrorLog;
  return module.exports.default || module.exports.ErrorLog || module.exports;
})();
