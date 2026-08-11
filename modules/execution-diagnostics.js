// ============================================================================
// Generated from src/background/execution-diagnostics.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ExecutionDiagnostics = (() => {
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

  // src/background/execution-diagnostics.ts
  var execution_diagnostics_exports = {};
  __export(execution_diagnostics_exports, {
    ExecutionDiagnostics: () => ExecutionDiagnostics,
    classifyExecutionError: () => classifyExecutionError,
    createExecutionDiagnosticsJournal: () => createExecutionDiagnosticsJournal,
    createExecutionDiagnosticsJournalPersistence: () => createExecutionDiagnosticsJournalPersistence,
    createExecutionDiagnosticsStore: () => createExecutionDiagnosticsStore,
    default: () => execution_diagnostics_default,
    redactExecutionUrl: () => redactExecutionUrl
  });
  module.exports = __toCommonJS(execution_diagnostics_exports);
  var DEFAULT_MAX_TABS = 64;
  var DEFAULT_MAX_DOCUMENTS_PER_TAB = 24;
  var DEFAULT_MAX_EVENTS_PER_DOCUMENT = 100;
  var DEFAULT_MAX_JOURNAL_ENTRIES = 256;
  var DEFAULT_MAX_JOURNAL_ENTRIES_PER_TAB = 32;
  var DEFAULT_MAX_JOURNAL_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
  var DEFAULT_MAX_JOURNAL_SERIALIZED_BYTES = 48 * 1024;
  var DEFAULT_JOURNAL_STALE_AFTER_MS = 15 * 60 * 1e3;
  var JOURNAL_SCHEMA_VERSION = 1;
  var JOURNAL_STORAGE_KEY = "svExecutionJournal";
  var JOURNAL_ID_LENGTH = 48;
  var JOURNAL_ORIGIN_LENGTH = 256;
  var JOURNAL_SCRIPT_ID_LENGTH = 256;
  var JOURNAL_HASH_LENGTH = 8;
  var JOURNAL_MAX_DURATION_MS = 24 * 60 * 60 * 1e3;
  var JOURNAL_ERROR_CLASSES = [
    "AbortError",
    "EvalError",
    "NetworkError",
    "QuotaError",
    "RangeError",
    "ReferenceError",
    "ScriptError",
    "SecurityError",
    "SyntaxError",
    "TimeoutError",
    "TypeError",
    "URIError",
    "UnknownError"
  ];
  function boundedInteger(value, fallback, minimum = 1) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
  }
  function cleanString(value, maxLength) {
    return typeof value === "string" ? value.slice(0, maxLength) : "";
  }
  function boundedPositiveInteger(value, fallback, minimum = 1) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
  }
  function utf8ByteLength(value) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(value).byteLength;
    return unescape(encodeURIComponent(value)).length;
  }
  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(JOURNAL_HASH_LENGTH, "0");
  }
  function normalizeOrigin(value) {
    const raw = cleanString(value, JOURNAL_ORIGIN_LENGTH);
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "file:") return "";
      return parsed.protocol === "file:" ? "file://" : parsed.origin.slice(0, JOURNAL_ORIGIN_LENGTH);
    } catch (_) {
      return "";
    }
  }
  function redactExecutionUrl(value) {
    const raw = cleanString(value, 4096);
    if (!raw) return { origin: "", urlHash: "" };
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "file:") {
        return { origin: "", urlHash: "" };
      }
      const origin = parsed.protocol === "file:" ? "file://" : parsed.origin.slice(0, JOURNAL_ORIGIN_LENGTH);
      const pathAndQuery = `${parsed.pathname || "/"}${parsed.search || ""}`;
      return { origin, urlHash: stableHash(pathAndQuery) };
    } catch (_) {
      return { origin: "", urlHash: stableHash(raw).slice(0, JOURNAL_HASH_LENGTH) };
    }
  }
  function classifyExecutionError(value) {
    const raw = cleanString(value, 500);
    const match = raw.match(/\b(AbortError|EvalError|NetworkError|QuotaError|RangeError|ReferenceError|SecurityError|SyntaxError|TimeoutError|TypeError|URIError)\b/i);
    if (match) {
      const errorName = match[1] || "";
      const canonical = JOURNAL_ERROR_CLASSES.find((name) => name.toLowerCase() === errorName.toLowerCase());
      if (canonical) return canonical;
    }
    return raw ? "ScriptError" : "UnknownError";
  }
  function emptyJournalSnapshot() {
    return { entries: [], latest: null, count: 0, latestAgeMs: null, latestStale: false };
  }
  function cloneJournalEntry(entry) {
    return { ...entry };
  }
  function normalizeJournalEntry(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const input = value;
    const tabId = Number(input.tabId);
    const frameId = Number(input.frameId);
    const timestamp = Number(input.timestamp);
    const outcome = input.outcome === "failure" ? "failure" : input.outcome === "success" ? "success" : null;
    if (!Number.isInteger(tabId) || tabId < 0 || !Number.isInteger(frameId) || frameId < 0 || !Number.isFinite(timestamp) || timestamp < 0 || !outcome) return null;
    const scriptId = cleanString(input.scriptId, JOURNAL_SCRIPT_ID_LENGTH) || null;
    const origin = normalizeOrigin(input.origin);
    const urlHash = /^[0-9a-f]{8}$/i.test(String(input.urlHash || "")) ? String(input.urlHash).toLowerCase() : "";
    const duration = Number(input.duration);
    return {
      id: cleanString(input.id, JOURNAL_ID_LENGTH) || `${timestamp.toString(36)}-${tabId.toString(36)}-${frameId.toString(36)}`,
      timestamp,
      tabId,
      frameId,
      outcome,
      scriptId,
      origin,
      urlHash,
      duration: Number.isFinite(duration) && duration >= 0 && duration <= JOURNAL_MAX_DURATION_MS ? duration : null,
      errorClass: outcome === "failure" ? classifyExecutionError(input.errorClass) : null
    };
  }
  function createExecutionDiagnosticsJournal(limits = {}) {
    const maxEntries = boundedPositiveInteger(limits.maxEntries, DEFAULT_MAX_JOURNAL_ENTRIES);
    const maxEntriesPerTab = boundedPositiveInteger(limits.maxEntriesPerTab, DEFAULT_MAX_JOURNAL_ENTRIES_PER_TAB);
    const maxAgeMs = boundedPositiveInteger(limits.maxAgeMs, DEFAULT_MAX_JOURNAL_AGE_MS);
    const maxSerializedBytes = boundedPositiveInteger(limits.maxSerializedBytes, DEFAULT_MAX_JOURNAL_SERIALIZED_BYTES, 128);
    const staleAfterMs = boundedPositiveInteger(limits.staleAfterMs, DEFAULT_JOURNAL_STALE_AFTER_MS);
    const now = limits.now || Date.now;
    let sequence = 0;
    let entries = [];
    function payload() {
      return { version: JOURNAL_SCHEMA_VERSION, entries: entries.map(cloneJournalEntry) };
    }
    function prune(timestamp) {
      const cutoff = timestamp - maxAgeMs;
      entries = entries.filter((entry) => entry.timestamp >= cutoff);
      const perTab = /* @__PURE__ */ new Map();
      for (const entry of entries) {
        const tabEntries = perTab.get(entry.tabId) || [];
        tabEntries.push(entry);
        perTab.set(entry.tabId, tabEntries);
      }
      const kept = /* @__PURE__ */ new Set();
      for (const tabEntries of perTab.values()) {
        tabEntries.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
        tabEntries.slice(-maxEntriesPerTab).forEach((entry) => kept.add(entry));
      }
      entries = entries.filter((entry) => kept.has(entry));
      entries.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
      if (entries.length > maxEntries) entries = entries.slice(-maxEntries);
      while (entries.length > 0 && utf8ByteLength(JSON.stringify(payload())) > maxSerializedBytes) {
        entries.shift();
      }
    }
    function record(sender, event) {
      if (event?.type !== "run" && event?.type !== "error") return null;
      const tabId = Number(sender?.tab?.id);
      if (!Number.isInteger(tabId) || tabId < 0) return null;
      const frameId = Number.isInteger(sender?.frameId) && Number(sender.frameId) >= 0 ? Number(sender.frameId) : 0;
      const timestamp = Number.isFinite(event?.timestamp) ? Math.max(0, Number(event.timestamp)) : now();
      const redactedUrl = redactExecutionUrl(event?.url || sender?.tab?.url);
      const entry = {
        id: `${timestamp.toString(36)}-${(++sequence).toString(36)}`.slice(0, JOURNAL_ID_LENGTH),
        timestamp,
        tabId,
        frameId,
        outcome: event.type === "error" ? "failure" : "success",
        scriptId: cleanString(event.scriptId, JOURNAL_SCRIPT_ID_LENGTH) || null,
        origin: redactedUrl.origin,
        urlHash: redactedUrl.urlHash,
        duration: Number.isFinite(event.duration) && Number(event.duration) >= 0 && Number(event.duration) <= JOURNAL_MAX_DURATION_MS ? Number(event.duration) : null,
        errorClass: event.type === "error" ? classifyExecutionError(event.error) : null
      };
      entries.push(entry);
      prune(timestamp);
      return entries.includes(entry) ? cloneJournalEntry(entry) : null;
    }
    function hydrate(value) {
      const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const rawEntries = Array.isArray(source.entries) ? source.entries : [];
      entries = rawEntries.map(normalizeJournalEntry).filter((entry) => !!entry);
      sequence = entries.length;
      prune(now());
      return entries.length;
    }
    function snapshot(tabId, timestamp = now()) {
      if (!Number.isInteger(tabId) || Number(tabId) < 0) return emptyJournalSnapshot();
      prune(timestamp);
      const matching = entries.filter((entry) => entry.tabId === Number(tabId)).sort((left, right) => right.timestamp - left.timestamp || right.id.localeCompare(left.id));
      const latest = matching[0] || null;
      const latestAgeMs = latest ? Math.max(0, timestamp - latest.timestamp) : null;
      return {
        entries: matching.map(cloneJournalEntry),
        latest: latest ? cloneJournalEntry(latest) : null,
        count: matching.length,
        latestAgeMs,
        latestStale: latestAgeMs !== null && latestAgeMs >= staleAfterMs
      };
    }
    function clear(tabId) {
      if (Number.isInteger(tabId) && Number(tabId) >= 0) {
        entries = entries.filter((entry) => entry.tabId !== Number(tabId));
      } else {
        entries = [];
      }
    }
    return Object.freeze({ record, hydrate, snapshot, clear, toStorage: payload });
  }
  function createExecutionDiagnosticsJournalPersistence(journal, storage, storageKey = JOURNAL_STORAGE_KEY) {
    let writeChain = Promise.resolve();
    let lastError = null;
    let lastWriteAt = null;
    async function hydrate() {
      try {
        const stored = await storage.get([storageKey]);
        const loaded = journal.hydrate(stored?.[storageKey]);
        lastError = null;
        return { loaded, error: null };
      } catch (error) {
        lastError = cleanString(error instanceof Error ? error.message : error, 256) || "storage read failed";
        return { loaded: 0, error: lastError };
      }
    }
    function schedule() {
      writeChain = writeChain.then(async () => {
        try {
          await storage.set({ [storageKey]: journal.toStorage() });
          lastError = null;
          lastWriteAt = Date.now();
        } catch (error) {
          lastError = cleanString(error instanceof Error ? error.message : error, 256) || "storage write failed";
        }
      });
      return writeChain;
    }
    async function clear(tabId) {
      journal.clear(tabId);
      await schedule();
    }
    return Object.freeze({
      hydrate,
      schedule,
      clear,
      getStatus: () => ({ lastError, lastWriteAt })
    });
  }
  function emptySnapshot(tabId) {
    return {
      tabId,
      currentDocumentId: null,
      currentDocumentIdentity: null,
      documents: [],
      journal: emptyJournalSnapshot(),
      summary: {
        currentDocuments: 0,
        staleDocuments: 0,
        currentEvents: 0,
        staleEvents: 0
      }
    };
  }
  function senderIdentity(sender) {
    const tabId = sender?.tab?.id;
    if (!Number.isInteger(tabId) || Number(tabId) < 0) return null;
    const frameId = Number.isInteger(sender.frameId) && Number(sender.frameId) >= 0 ? Number(sender.frameId) : 0;
    const documentId = cleanString(sender.documentId, 256) || null;
    return {
      tabId: Number(tabId),
      frameId,
      documentId,
      identity: documentId || `legacy-frame:${frameId}`
    };
  }
  function createExecutionDiagnosticsStore(limits = {}) {
    const maxTabs = boundedInteger(limits.maxTabs, DEFAULT_MAX_TABS);
    const maxDocumentsPerTab = boundedInteger(limits.maxDocumentsPerTab, DEFAULT_MAX_DOCUMENTS_PER_TAB);
    const maxEventsPerDocument = boundedInteger(limits.maxEventsPerDocument, DEFAULT_MAX_EVENTS_PER_DOCUMENT);
    const tabs = /* @__PURE__ */ new Map();
    function evictTabs() {
      while (tabs.size > maxTabs) {
        const oldest = [...tabs.entries()].sort((left, right) => left[1].updatedAt - right[1].updatedAt)[0];
        if (!oldest) break;
        tabs.delete(oldest[0]);
      }
    }
    function evictDocuments(tab) {
      while (tab.documents.size > maxDocumentsPerTab) {
        const candidates = [...tab.documents.values()].filter((document) => document.identity !== tab.currentDocumentIdentity).sort((left, right) => {
          const leftIsCurrentGroup = left.topDocumentIdentity === tab.currentDocumentIdentity ? 1 : 0;
          const rightIsCurrentGroup = right.topDocumentIdentity === tab.currentDocumentIdentity ? 1 : 0;
          return leftIsCurrentGroup - rightIsCurrentGroup || left.lastSeen - right.lastSeen;
        });
        const oldest = candidates[0];
        if (!oldest) break;
        tab.documents.delete(oldest.identity);
      }
    }
    function snapshot(tabId) {
      if (!Number.isInteger(tabId) || tabId < 0) return emptySnapshot(null);
      const tab = tabs.get(tabId);
      if (!tab) return emptySnapshot(tabId);
      const currentTop = tab.currentDocumentIdentity;
      const currentTopDocument = currentTop ? tab.documents.get(currentTop) : null;
      const documents = [...tab.documents.values()].map((document) => {
        const isCurrent = !!currentTop && document.topDocumentIdentity === currentTop;
        const topDocument = tab.documents.get(document.topDocumentIdentity);
        return {
          identity: document.identity,
          documentId: document.documentId,
          topDocumentId: topDocument?.documentId || null,
          frameId: document.frameId,
          url: document.url,
          firstSeen: document.firstSeen,
          lastSeen: document.lastSeen,
          isCurrent,
          stale: !isCurrent,
          runs: document.runs,
          errors: document.errors,
          eventCount: document.eventCount,
          scriptIds: [...document.scriptIds].sort(),
          events: document.events.map((event) => ({ ...event }))
        };
      }).sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent) || right.lastSeen - left.lastSeen);
      return {
        tabId,
        currentDocumentId: currentTopDocument?.documentId || null,
        currentDocumentIdentity: currentTop,
        documents,
        journal: emptyJournalSnapshot(),
        summary: {
          currentDocuments: documents.filter((document) => document.isCurrent).length,
          staleDocuments: documents.filter((document) => document.stale).length,
          currentEvents: documents.filter((document) => document.isCurrent).reduce((total, document) => total + document.eventCount, 0),
          staleEvents: documents.filter((document) => document.stale).reduce((total, document) => total + document.eventCount, 0)
        }
      };
    }
    function record(sender, input) {
      const identity = senderIdentity(sender);
      if (!identity) return null;
      const timestamp = Number.isFinite(input?.timestamp) ? Number(input.timestamp) : Date.now();
      let tab = tabs.get(identity.tabId);
      if (!tab) {
        tab = { currentDocumentIdentity: null, updatedAt: timestamp, documents: /* @__PURE__ */ new Map() };
        tabs.set(identity.tabId, tab);
        evictTabs();
      }
      if (identity.frameId === 0 && (input.type === "document-ready" || !tab.currentDocumentIdentity)) {
        tab.currentDocumentIdentity = identity.identity;
      }
      let document = tab.documents.get(identity.identity);
      if (!document) {
        const topDocumentIdentity = identity.frameId === 0 ? identity.identity : tab.currentDocumentIdentity || identity.identity;
        document = {
          identity: identity.identity,
          documentId: identity.documentId,
          topDocumentIdentity,
          frameId: identity.frameId,
          url: "",
          firstSeen: timestamp,
          lastSeen: timestamp,
          runs: 0,
          errors: 0,
          eventCount: 0,
          scriptIds: /* @__PURE__ */ new Set(),
          events: []
        };
        tab.documents.set(identity.identity, document);
      }
      const event = {
        type: input.type,
        timestamp
      };
      const scriptId = cleanString(input.scriptId, 256);
      const url = cleanString(input.url || sender.tab?.url, 2048);
      if (scriptId) {
        event.scriptId = scriptId;
        document.scriptIds.add(scriptId);
      }
      if (url) {
        event.url = url;
        document.url = url;
      }
      if (input.type === "run") {
        document.runs += 1;
        if (Number.isFinite(input.duration)) event.duration = Number(input.duration);
      }
      if (input.type === "error") {
        document.errors += 1;
        const error = cleanString(input.error, 500);
        if (error) event.error = error;
      }
      document.lastSeen = timestamp;
      document.eventCount += 1;
      document.events.push(event);
      if (document.events.length > maxEventsPerDocument) {
        document.events.splice(0, document.events.length - maxEventsPerDocument);
      }
      tab.updatedAt = timestamp;
      evictDocuments(tab);
      return snapshot(identity.tabId);
    }
    function clear(tabId) {
      if (Number.isInteger(tabId) && Number(tabId) >= 0) tabs.delete(Number(tabId));
      else tabs.clear();
    }
    return Object.freeze({ record, snapshot, clear });
  }
  var ExecutionDiagnostics = Object.freeze({
    createExecutionDiagnosticsJournal,
    createExecutionDiagnosticsJournalPersistence,
    createExecutionDiagnosticsStore
  });
  var execution_diagnostics_default = ExecutionDiagnostics;
  return module.exports.default || module.exports.ExecutionDiagnostics || module.exports;
})();

if (typeof self !== 'undefined') {
  self.ExecutionDiagnostics = ExecutionDiagnostics;
}
