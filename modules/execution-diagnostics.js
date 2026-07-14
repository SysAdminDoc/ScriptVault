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
    createExecutionDiagnosticsStore: () => createExecutionDiagnosticsStore,
    default: () => execution_diagnostics_default
  });
  module.exports = __toCommonJS(execution_diagnostics_exports);
  var DEFAULT_MAX_TABS = 64;
  var DEFAULT_MAX_DOCUMENTS_PER_TAB = 24;
  var DEFAULT_MAX_EVENTS_PER_DOCUMENT = 100;
  function boundedInteger(value, fallback, minimum = 1) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
  }
  function cleanString(value, maxLength) {
    return typeof value === "string" ? value.slice(0, maxLength) : "";
  }
  function emptySnapshot(tabId) {
    return {
      tabId,
      currentDocumentId: null,
      currentDocumentIdentity: null,
      documents: [],
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
  var ExecutionDiagnostics = Object.freeze({ createExecutionDiagnosticsStore });
  var execution_diagnostics_default = ExecutionDiagnostics;
  return module.exports.default || module.exports.ExecutionDiagnostics || module.exports;
})();

if (typeof self !== 'undefined') {
  self.ExecutionDiagnostics = ExecutionDiagnostics;
}
