// ============================================================================
// Generated from src/background/execution-telemetry.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ExecutionTelemetry = (() => {
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

  // src/background/execution-telemetry.ts
  var execution_telemetry_exports = {};
  __export(execution_telemetry_exports, {
    ExecutionTelemetry: () => ExecutionTelemetry,
    createExecutionTelemetryHandler: () => createExecutionTelemetryHandler,
    default: () => execution_telemetry_default,
    normalizeBridgeTelemetry: () => normalizeBridgeTelemetry
  });
  module.exports = __toCommonJS(execution_telemetry_exports);
  var COMPLETION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
  var COMPLETION_TTL_MS = 10 * 60 * 1e3;
  var COMPLETION_LIMIT = 4096;
  var BRIDGE_RATE_WINDOW_MS = 1e4;
  var BRIDGE_RATE_LIMIT = 60;
  var BRIDGE_RATE_KEY_LIMIT = 256;
  var MAX_DURATION_MS = 24 * 60 * 60 * 1e3;
  var MAX_RESPONSE_BYTES = 1024 * 1024 * 1024;
  function cleanString(value, maxLength) {
    return typeof value === "string" ? value.slice(0, maxLength) : "";
  }
  function cleanFiniteNumber(value, minimum, maximum) {
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum && number <= maximum ? number : void 0;
  }
  function cleanInteger(value, minimum, maximum) {
    const number = cleanFiniteNumber(value, minimum, maximum);
    return number !== void 0 && Number.isInteger(number) ? number : void 0;
  }
  function normalizeHeaders(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    const headers = {};
    for (const [rawName, rawValue] of Object.entries(value).slice(0, 64)) {
      const name = cleanString(rawName, 128).trim();
      const headerValue = cleanString(rawValue, 1024);
      if (name && headerValue) headers[name] = headerValue;
    }
    return Object.keys(headers).length > 0 ? headers : void 0;
  }
  function normalizeBridgeTelemetry(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const data = value;
    const kind = data.kind;
    if (kind !== "execution-error" && kind !== "execution-time" && kind !== "network") return null;
    if (kind === "execution-error") {
      const error2 = cleanString(data.error, 500);
      return error2 ? { kind, error: error2 } : null;
    }
    if (kind === "execution-time") {
      const duration2 = cleanFiniteNumber(data.duration, 0, MAX_DURATION_MS);
      return duration2 === void 0 ? null : { kind, duration: duration2 };
    }
    const url = cleanString(data.url, 4096);
    if (!url) return null;
    const normalized = {
      kind,
      url,
      method: cleanString(data.method, 16).toUpperCase() || "GET",
      type: cleanString(data.type, 32) || "fetch"
    };
    const status = cleanInteger(data.status, 0, 999);
    const duration = cleanFiniteNumber(data.duration, 0, MAX_DURATION_MS);
    const responseSize = cleanInteger(data.responseSize, 0, MAX_RESPONSE_BYTES);
    const statusText = cleanString(data.statusText, 256);
    const error = cleanString(data.error, 500);
    if (status !== void 0) normalized.status = status;
    if (duration !== void 0) normalized.duration = duration;
    if (responseSize !== void 0) normalized.responseSize = responseSize;
    if (statusText) normalized.statusText = statusText;
    if (error) normalized.error = error;
    return normalized;
  }
  function normalizeTrustedNetworkTelemetry(data) {
    const url = cleanString(data.url, 4096);
    if (!url) return null;
    const entry = {
      url,
      method: cleanString(data.method, 16).toUpperCase() || "GET",
      type: cleanString(data.type, 32) || "fetch"
    };
    const status = cleanInteger(data.status, 0, 999);
    const duration = cleanFiniteNumber(data.duration, 0, MAX_DURATION_MS);
    const responseSize = cleanInteger(data.responseSize, 0, MAX_RESPONSE_BYTES);
    const statusText = cleanString(data.statusText, 256);
    const error = cleanString(data.error, 500);
    const responseHeaders = normalizeHeaders(data.responseHeaders);
    if (status !== void 0) entry.status = status;
    if (duration !== void 0) entry.duration = duration;
    if (responseSize !== void 0) entry.responseSize = responseSize;
    if (statusText) entry.statusText = statusText;
    if (error) entry.error = error;
    if (responseHeaders) entry.responseHeaders = responseHeaders;
    return entry;
  }
  function senderRateKey(sender) {
    const tabId = sender?.tab?.id;
    if (!Number.isInteger(tabId) || Number(tabId) < 0) return null;
    const documentId = cleanString(sender.documentId, 256);
    const frameId = Number.isInteger(sender.frameId) && Number(sender.frameId) >= 0 ? Number(sender.frameId) : 0;
    return `${tabId}:${documentId || `frame-${frameId}`}`;
  }
  function setSenderContext(stats, sender) {
    if (typeof sender?.tab?.id === "number") stats.lastTabId = sender.tab.id;
    if (typeof sender?.documentId === "string") stats.lastDocumentId = sender.documentId;
    if (typeof sender?.frameId === "number") stats.lastFrameId = sender.frameId;
  }
  function defaultStats() {
    return { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 };
  }
  function createExecutionTelemetryHandler(dependencies) {
    const now = dependencies.now || Date.now;
    const completions = /* @__PURE__ */ new Map();
    const bridgeRates = /* @__PURE__ */ new Map();
    function pruneCompletions(timestamp) {
      for (const [key, state] of completions) {
        if (timestamp - state.timestamp > COMPLETION_TTL_MS) completions.delete(key);
      }
      while (completions.size > COMPLETION_LIMIT) {
        const oldest = completions.keys().next().value;
        if (typeof oldest !== "string") break;
        completions.delete(oldest);
      }
    }
    function claimCompletion(scriptId, completionId, stage) {
      if (typeof completionId !== "string" || !COMPLETION_ID_PATTERN.test(completionId)) return false;
      const timestamp = now();
      pruneCompletions(timestamp);
      const key = `${scriptId}:${completionId}`;
      const existing = completions.get(key);
      if (existing?.stages.has(stage)) return false;
      if (existing) {
        existing.timestamp = timestamp;
        existing.stages.add(stage);
        completions.delete(key);
        completions.set(key, existing);
      } else {
        completions.set(key, { timestamp, stages: /* @__PURE__ */ new Set([stage]) });
      }
      pruneCompletions(timestamp);
      return true;
    }
    function allowBridgeTelemetry(sender) {
      const key = senderRateKey(sender);
      if (!key) return false;
      const timestamp = now();
      const existing = bridgeRates.get(key);
      if (!existing || timestamp - existing.startedAt >= BRIDGE_RATE_WINDOW_MS) {
        bridgeRates.delete(key);
        bridgeRates.set(key, { startedAt: timestamp, count: 1 });
      } else if (existing.count >= BRIDGE_RATE_LIMIT) {
        return false;
      } else {
        existing.count += 1;
      }
      while (bridgeRates.size > BRIDGE_RATE_KEY_LIMIT) {
        const oldest = bridgeRates.keys().next().value;
        if (typeof oldest !== "string") break;
        bridgeRates.delete(oldest);
      }
      return true;
    }
    function retainEventUrl(url) {
      if (!url) return "";
      return dependencies.retainStatsUrl(url, dependencies.getStatsUrlRetention()) || "";
    }
    async function handleBridgeTelemetry(value, sender) {
      const data = normalizeBridgeTelemetry(value);
      if (!data) return { error: "Invalid page telemetry payload", trusted: false };
      if (!allowBridgeTelemetry(sender)) return { error: "Page telemetry rate limit exceeded", trusted: false };
      if (data.kind === "network") {
        dependencies.addNetworkLog({
          method: data.method,
          url: data.url || "",
          status: data.status,
          statusText: data.statusText,
          duration: data.duration,
          responseSize: data.responseSize,
          error: data.error,
          type: data.type
        });
      } else if (data.kind === "execution-time") {
        dependencies.recordDiagnostic(sender, {
          type: "run",
          duration: data.duration,
          url: retainEventUrl(cleanString(sender?.tab?.url, 2048))
        });
      } else {
        dependencies.recordDiagnostic(sender, {
          type: "error",
          error: data.error,
          url: retainEventUrl(cleanString(sender?.tab?.url, 2048))
        });
      }
      return { success: true, trusted: false };
    }
    async function handleTrustedTelemetry(action, value, sender) {
      const scriptId = cleanString(sender?.userScriptId, 256);
      if (!scriptId) return { error: "Authenticated script identity is required", trusted: false };
      const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const script = await dependencies.getScript(scriptId);
      if (!script) return { error: "Authenticated script is not installed", trusted: true };
      if (action === "netlog_record") {
        const entry = normalizeTrustedNetworkTelemetry(data);
        if (!entry) return { error: "Invalid network telemetry payload", trusted: true };
        dependencies.addNetworkLog({
          ...entry,
          scriptId,
          scriptName: cleanString(script.meta?.name || script.name, 256) || scriptId
        });
        return { ok: true, trusted: true };
      }
      const stage = action === "reportExecTime" ? "time" : "error";
      if (typeof data.completionId !== "string" || !COMPLETION_ID_PATTERN.test(data.completionId)) {
        return { error: "Invalid execution completion id", trusted: true };
      }
      const duration = action === "reportExecTime" ? cleanFiniteNumber(data.time, 0, MAX_DURATION_MS) : void 0;
      const error = action === "reportExecError" ? cleanString(data.error, 500) : "";
      if (action === "reportExecTime" && duration === void 0) {
        return { error: "Invalid execution duration", trusted: true };
      }
      if (action === "reportExecError" && !error) {
        return { error: "Invalid execution error", trusted: true };
      }
      if (!claimCompletion(scriptId, data.completionId, stage)) {
        return { success: true, trusted: true, duplicate: true };
      }
      const eventUrl = cleanString(data.url, 4096) || cleanString(sender?.tab?.url, 4096);
      const retainedUrl = retainEventUrl(eventUrl);
      const stats = script.stats || (script.stats = defaultStats());
      if (action === "reportExecTime") {
        stats.runs += 1;
        stats.totalTime += duration;
        stats.avgTime = stats.runs > 0 ? Math.round(stats.totalTime / stats.runs * 100) / 100 : 0;
        stats.lastRun = now();
        if (retainedUrl) stats.lastUrl = retainedUrl;
        else delete stats.lastUrl;
        setSenderContext(stats, sender);
        dependencies.recordDiagnostic(sender, { type: "run", scriptId, duration, url: retainedUrl });
        dependencies.scheduleStatsSave();
        try {
          const triggerResult = dependencies.triggerAfterScript(scriptId, {
            reason: "afterScript",
            tabId: typeof sender?.tab?.id === "number" ? sender.tab.id : void 0,
            url: eventUrl
          });
          Promise.resolve(triggerResult).catch((error2) => dependencies.onTriggerError?.(error2));
        } catch (error2) {
          dependencies.onTriggerError?.(error2);
        }
        return { success: true, trusted: true };
      }
      stats.errors += 1;
      stats.lastError = error;
      stats.lastErrorTime = now();
      setSenderContext(stats, sender);
      dependencies.recordDiagnostic(sender, { type: "error", scriptId, error, url: retainedUrl });
      if (dependencies.logExecutionError) {
        await dependencies.logExecutionError({
          scriptId,
          scriptName: cleanString(script.meta?.name || script.name, 256) || scriptId,
          error,
          stack: cleanString(data.stack, 8e3) || null,
          url: retainedUrl || null,
          source: cleanString(data.source, 4096) || null,
          line: cleanInteger(data.line, 1, 1e7) ?? null,
          col: cleanInteger(data.col, 1, 1e7) ?? null,
          generatedLine: cleanInteger(data.generatedLine, 1, 1e7) ?? null,
          generatedCol: cleanInteger(data.generatedCol, 1, 1e7) ?? null,
          context: "script-execution"
        });
      }
      dependencies.scheduleStatsSave();
      return { success: true, trusted: true };
    }
    return Object.freeze({ handleBridgeTelemetry, handleTrustedTelemetry });
  }
  var ExecutionTelemetry = Object.freeze({
    createExecutionTelemetryHandler,
    normalizeBridgeTelemetry
  });
  var execution_telemetry_default = ExecutionTelemetry;
  return module.exports.default || module.exports.ExecutionTelemetry || module.exports;
})();

if (typeof self !== 'undefined') {
  self.ExecutionTelemetry = ExecutionTelemetry;
}
