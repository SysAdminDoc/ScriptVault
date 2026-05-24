// ============================================================================
// Generated from src/bg/netlog.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const NetworkLog = (() => {
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

  // src/bg/netlog.ts
  var netlog_exports = {};
  __export(netlog_exports, {
    NetworkLog: () => NetworkLog
  });
  module.exports = __toCommonJS(netlog_exports);
  var NetworkLog = {
    _log: [],
    _maxEntries: 2e3,
    add(entry) {
      const full = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: Date.now(),
        ...entry
      };
      this._log.push(full);
      if (this._log.length > this._maxEntries) {
        this._log = this._log.slice(-this._maxEntries);
      }
    },
    getAll(filters = {}) {
      let results = [...this._log].reverse();
      if (filters.scriptId) {
        const scriptId = filters.scriptId;
        results = results.filter((e) => e.scriptId === scriptId);
      }
      if (filters.method) {
        const method = filters.method;
        results = results.filter((e) => e.method?.toUpperCase() === method.toUpperCase());
      }
      if (filters.domain) {
        const domain = filters.domain;
        results = results.filter((e) => {
          try {
            return new URL(e.url).hostname.includes(domain);
          } catch {
            return false;
          }
        });
      }
      if (filters.status) {
        if (filters.status === "error") {
          results = results.filter((e) => e.error || e.status != null && e.status >= 400);
        } else if (filters.status === "success") {
          results = results.filter((e) => !e.error && e.status != null && e.status < 400);
        }
      }
      return results.slice(0, filters.limit ?? 100);
    },
    getStats() {
      const byScript = {};
      const byDomain = {};
      let totalRequests = 0;
      let totalErrors = 0;
      let totalBytes = 0;
      for (const entry of this._log) {
        totalRequests++;
        if (entry.error || entry.status != null && entry.status >= 400) totalErrors++;
        totalBytes += entry.responseSize ?? 0;
        const sid = entry.scriptId ?? "unknown";
        const existingScript = byScript[sid];
        if (!existingScript) {
          byScript[sid] = { count: 0, errors: 0, bytes: 0, scriptName: entry.scriptName ?? sid };
        }
        const scriptEntry = byScript[sid];
        scriptEntry.count++;
        const isError = !!(entry.error || entry.status != null && entry.status >= 400);
        if (isError) scriptEntry.errors++;
        scriptEntry.bytes += entry.responseSize ?? 0;
        try {
          const domain = new URL(entry.url).hostname;
          const existingDomain = byDomain[domain];
          if (!existingDomain) {
            byDomain[domain] = { count: 0, errors: 0, bytes: 0 };
          }
          const domainEntry = byDomain[domain];
          domainEntry.count++;
          if (isError) domainEntry.errors++;
          domainEntry.bytes += entry.responseSize ?? 0;
        } catch {
        }
      }
      return { totalRequests, totalErrors, totalBytes, byScript, byDomain };
    },
    clear(scriptId) {
      if (scriptId) {
        this._log = this._log.filter((e) => e.scriptId !== scriptId);
      } else {
        this._log = [];
      }
    }
  };
  return module.exports.default || module.exports.NetworkLog || module.exports;
})();
