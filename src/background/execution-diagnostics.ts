// ============================================================================
// Per-document execution diagnostics
// ============================================================================

export type ExecutionDiagnosticEventType = 'document-ready' | 'run' | 'error';

export interface ExecutionDiagnosticSender {
  documentId?: string;
  frameId?: number;
  tab?: {
    id?: number;
    url?: string;
  };
}

export interface ExecutionDiagnosticEventInput {
  type: ExecutionDiagnosticEventType;
  timestamp?: number;
  scriptId?: string;
  url?: string;
  duration?: number;
  error?: string;
}

export interface ExecutionDiagnosticEvent {
  type: ExecutionDiagnosticEventType;
  timestamp: number;
  scriptId?: string;
  url?: string;
  duration?: number;
  error?: string;
}

export interface ExecutionDiagnosticDocument {
  identity: string;
  documentId: string | null;
  topDocumentId: string | null;
  frameId: number;
  url: string;
  firstSeen: number;
  lastSeen: number;
  isCurrent: boolean;
  stale: boolean;
  runs: number;
  errors: number;
  eventCount: number;
  scriptIds: string[];
  events: ExecutionDiagnosticEvent[];
}

export interface ExecutionDiagnosticsSnapshot {
  tabId: number | null;
  currentDocumentId: string | null;
  currentDocumentIdentity: string | null;
  documents: ExecutionDiagnosticDocument[];
  summary: {
    currentDocuments: number;
    staleDocuments: number;
    currentEvents: number;
    staleEvents: number;
  };
}

interface InternalDocument {
  identity: string;
  documentId: string | null;
  topDocumentIdentity: string;
  frameId: number;
  url: string;
  firstSeen: number;
  lastSeen: number;
  runs: number;
  errors: number;
  eventCount: number;
  scriptIds: Set<string>;
  events: ExecutionDiagnosticEvent[];
}

interface InternalTab {
  currentDocumentIdentity: string | null;
  updatedAt: number;
  documents: Map<string, InternalDocument>;
}

export interface ExecutionDiagnosticsStore {
  record(sender: ExecutionDiagnosticSender, event: ExecutionDiagnosticEventInput): ExecutionDiagnosticsSnapshot | null;
  snapshot(tabId: number): ExecutionDiagnosticsSnapshot;
  clear(tabId?: number): void;
}

export interface ExecutionDiagnosticsLimits {
  maxTabs?: number;
  maxDocumentsPerTab?: number;
  maxEventsPerDocument?: number;
}

const DEFAULT_MAX_TABS = 64;
const DEFAULT_MAX_DOCUMENTS_PER_TAB = 24;
const DEFAULT_MAX_EVENTS_PER_DOCUMENT = 100;

function boundedInteger(value: unknown, fallback: number, minimum = 1): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function emptySnapshot(tabId: number | null): ExecutionDiagnosticsSnapshot {
  return {
    tabId,
    currentDocumentId: null,
    currentDocumentIdentity: null,
    documents: [],
    summary: {
      currentDocuments: 0,
      staleDocuments: 0,
      currentEvents: 0,
      staleEvents: 0,
    },
  };
}

function senderIdentity(sender: ExecutionDiagnosticSender): {
  tabId: number;
  frameId: number;
  documentId: string | null;
  identity: string;
} | null {
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId) || Number(tabId) < 0) return null;
  const frameId = Number.isInteger(sender.frameId) && Number(sender.frameId) >= 0
    ? Number(sender.frameId)
    : 0;
  const documentId = cleanString(sender.documentId, 256) || null;
  return {
    tabId: Number(tabId),
    frameId,
    documentId,
    identity: documentId || `legacy-frame:${frameId}`,
  };
}

export function createExecutionDiagnosticsStore(limits: ExecutionDiagnosticsLimits = {}): ExecutionDiagnosticsStore {
  const maxTabs = boundedInteger(limits.maxTabs, DEFAULT_MAX_TABS);
  const maxDocumentsPerTab = boundedInteger(limits.maxDocumentsPerTab, DEFAULT_MAX_DOCUMENTS_PER_TAB);
  const maxEventsPerDocument = boundedInteger(limits.maxEventsPerDocument, DEFAULT_MAX_EVENTS_PER_DOCUMENT);
  const tabs = new Map<number, InternalTab>();

  function evictTabs(): void {
    while (tabs.size > maxTabs) {
      const oldest = [...tabs.entries()].sort((left, right) => left[1].updatedAt - right[1].updatedAt)[0];
      if (!oldest) break;
      tabs.delete(oldest[0]);
    }
  }

  function evictDocuments(tab: InternalTab): void {
    while (tab.documents.size > maxDocumentsPerTab) {
      const candidates = [...tab.documents.values()]
        .filter(document => document.identity !== tab.currentDocumentIdentity)
        .sort((left, right) => {
          const leftIsCurrentGroup = left.topDocumentIdentity === tab.currentDocumentIdentity ? 1 : 0;
          const rightIsCurrentGroup = right.topDocumentIdentity === tab.currentDocumentIdentity ? 1 : 0;
          return leftIsCurrentGroup - rightIsCurrentGroup || left.lastSeen - right.lastSeen;
        });
      const oldest = candidates[0];
      if (!oldest) break;
      tab.documents.delete(oldest.identity);
    }
  }

  function snapshot(tabId: number): ExecutionDiagnosticsSnapshot {
    if (!Number.isInteger(tabId) || tabId < 0) return emptySnapshot(null);
    const tab = tabs.get(tabId);
    if (!tab) return emptySnapshot(tabId);

    const currentTop = tab.currentDocumentIdentity;
    const currentTopDocument = currentTop ? tab.documents.get(currentTop) : null;
    const documents = [...tab.documents.values()].map((document): ExecutionDiagnosticDocument => {
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
        events: document.events.map(event => ({ ...event })),
      };
    }).sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent) || right.lastSeen - left.lastSeen);

    return {
      tabId,
      currentDocumentId: currentTopDocument?.documentId || null,
      currentDocumentIdentity: currentTop,
      documents,
      summary: {
        currentDocuments: documents.filter(document => document.isCurrent).length,
        staleDocuments: documents.filter(document => document.stale).length,
        currentEvents: documents.filter(document => document.isCurrent).reduce((total, document) => total + document.eventCount, 0),
        staleEvents: documents.filter(document => document.stale).reduce((total, document) => total + document.eventCount, 0),
      },
    };
  }

  function record(sender: ExecutionDiagnosticSender, input: ExecutionDiagnosticEventInput): ExecutionDiagnosticsSnapshot | null {
    const identity = senderIdentity(sender);
    if (!identity) return null;
    const timestamp = Number.isFinite(input?.timestamp) ? Number(input.timestamp) : Date.now();
    let tab = tabs.get(identity.tabId);
    if (!tab) {
      tab = { currentDocumentIdentity: null, updatedAt: timestamp, documents: new Map() };
      tabs.set(identity.tabId, tab);
      evictTabs();
    }

    if (identity.frameId === 0 && (input.type === 'document-ready' || !tab.currentDocumentIdentity)) {
      tab.currentDocumentIdentity = identity.identity;
    }

    let document = tab.documents.get(identity.identity);
    if (!document) {
      const topDocumentIdentity = identity.frameId === 0
        ? identity.identity
        : (tab.currentDocumentIdentity || identity.identity);
      document = {
        identity: identity.identity,
        documentId: identity.documentId,
        topDocumentIdentity,
        frameId: identity.frameId,
        url: '',
        firstSeen: timestamp,
        lastSeen: timestamp,
        runs: 0,
        errors: 0,
        eventCount: 0,
        scriptIds: new Set(),
        events: [],
      };
      tab.documents.set(identity.identity, document);
    }

    const event: ExecutionDiagnosticEvent = {
      type: input.type,
      timestamp,
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
    if (input.type === 'run') {
      document.runs += 1;
      if (Number.isFinite(input.duration)) event.duration = Number(input.duration);
    }
    if (input.type === 'error') {
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

  function clear(tabId?: number): void {
    if (Number.isInteger(tabId) && Number(tabId) >= 0) tabs.delete(Number(tabId));
    else tabs.clear();
  }

  return Object.freeze({ record, snapshot, clear });
}

export const ExecutionDiagnostics = Object.freeze({ createExecutionDiagnosticsStore });

export default ExecutionDiagnostics;
