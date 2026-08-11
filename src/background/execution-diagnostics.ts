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

export type ExecutionJournalOutcome = 'success' | 'failure';

export interface ExecutionJournalEntry {
  id: string;
  timestamp: number;
  tabId: number;
  frameId: number;
  outcome: ExecutionJournalOutcome;
  scriptId: string | null;
  origin: string;
  urlHash: string;
  duration: number | null;
  errorClass: string | null;
}

export interface ExecutionJournalSnapshot {
  entries: ExecutionJournalEntry[];
  latest: ExecutionJournalEntry | null;
  count: number;
  latestAgeMs: number | null;
  latestStale: boolean;
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
  journal: ExecutionJournalSnapshot;
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

export interface ExecutionDiagnosticsJournalLimits {
  maxEntries?: number;
  maxEntriesPerTab?: number;
  maxAgeMs?: number;
  maxSerializedBytes?: number;
  staleAfterMs?: number;
  now?: () => number;
}

export interface ExecutionDiagnosticsJournalStorage {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface ExecutionDiagnosticsJournalPersistence {
  hydrate(): Promise<{ loaded: number; error: string | null }>;
  schedule(): Promise<void>;
  clear(tabId?: number): Promise<void>;
  getStatus(): { lastError: string | null; lastWriteAt: number | null };
}

const DEFAULT_MAX_TABS = 64;
const DEFAULT_MAX_DOCUMENTS_PER_TAB = 24;
const DEFAULT_MAX_EVENTS_PER_DOCUMENT = 100;
const DEFAULT_MAX_JOURNAL_ENTRIES = 256;
const DEFAULT_MAX_JOURNAL_ENTRIES_PER_TAB = 32;
const DEFAULT_MAX_JOURNAL_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_JOURNAL_SERIALIZED_BYTES = 48 * 1024;
const DEFAULT_JOURNAL_STALE_AFTER_MS = 15 * 60 * 1000;
const JOURNAL_SCHEMA_VERSION = 1;
const JOURNAL_STORAGE_KEY = 'svExecutionJournal';
const JOURNAL_ID_LENGTH = 48;
const JOURNAL_ORIGIN_LENGTH = 256;
const JOURNAL_SCRIPT_ID_LENGTH = 256;
const JOURNAL_HASH_LENGTH = 8;
const JOURNAL_ERROR_LENGTH = 48;
const JOURNAL_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const JOURNAL_ERROR_CLASSES = [
  'AbortError',
  'EvalError',
  'NetworkError',
  'QuotaError',
  'RangeError',
  'ReferenceError',
  'ScriptError',
  'SecurityError',
  'SyntaxError',
  'TimeoutError',
  'TypeError',
  'URIError',
  'UnknownError',
] as const;

function boundedInteger(value: unknown, fallback: number, minimum = 1): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function boundedPositiveInteger(value: unknown, fallback: number, minimum = 1): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
  return unescape(encodeURIComponent(value)).length;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(JOURNAL_HASH_LENGTH, '0');
}

function normalizeOrigin(value: unknown): string {
  const raw = cleanString(value, JOURNAL_ORIGIN_LENGTH);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'file:') return '';
    return parsed.protocol === 'file:' ? 'file://' : parsed.origin.slice(0, JOURNAL_ORIGIN_LENGTH);
  } catch (_) {
    return '';
  }
}

export function redactExecutionUrl(value: unknown): { origin: string; urlHash: string } {
  const raw = cleanString(value, 4096);
  if (!raw) return { origin: '', urlHash: '' };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'file:') {
      return { origin: '', urlHash: '' };
    }
    const origin = parsed.protocol === 'file:' ? 'file://' : parsed.origin.slice(0, JOURNAL_ORIGIN_LENGTH);
    const pathAndQuery = `${parsed.pathname || '/'}${parsed.search || ''}`;
    return { origin, urlHash: stableHash(pathAndQuery) };
  } catch (_) {
    return { origin: '', urlHash: stableHash(raw).slice(0, JOURNAL_HASH_LENGTH) };
  }
}

export function classifyExecutionError(value: unknown): string {
  const raw = cleanString(value, 500);
  const match = raw.match(/\b(AbortError|EvalError|NetworkError|QuotaError|RangeError|ReferenceError|SecurityError|SyntaxError|TimeoutError|TypeError|URIError)\b/i);
  if (match) {
    const errorName = match[1] || '';
    const canonical = JOURNAL_ERROR_CLASSES.find(name => name.toLowerCase() === errorName.toLowerCase());
    if (canonical) return canonical;
  }
  return raw ? 'ScriptError' : 'UnknownError';
}

function emptyJournalSnapshot(): ExecutionJournalSnapshot {
  return { entries: [], latest: null, count: 0, latestAgeMs: null, latestStale: false };
}

function cloneJournalEntry(entry: ExecutionJournalEntry): ExecutionJournalEntry {
  return { ...entry };
}

function normalizeJournalEntry(value: unknown): ExecutionJournalEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const tabId = Number(input.tabId);
  const frameId = Number(input.frameId);
  const timestamp = Number(input.timestamp);
  const outcome = input.outcome === 'failure' ? 'failure' : input.outcome === 'success' ? 'success' : null;
  if (!Number.isInteger(tabId) || tabId < 0 || !Number.isInteger(frameId) || frameId < 0 ||
      !Number.isFinite(timestamp) || timestamp < 0 || !outcome) return null;
  const scriptId = cleanString(input.scriptId, JOURNAL_SCRIPT_ID_LENGTH) || null;
  const origin = normalizeOrigin(input.origin);
  const urlHash = /^[0-9a-f]{8}$/i.test(String(input.urlHash || ''))
    ? String(input.urlHash).toLowerCase()
    : '';
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
    errorClass: outcome === 'failure' ? classifyExecutionError(input.errorClass) : null,
  };
}

export interface ExecutionDiagnosticsJournalStore {
  record(sender: ExecutionDiagnosticSender, event: ExecutionDiagnosticEventInput): ExecutionJournalEntry | null;
  hydrate(value: unknown): number;
  snapshot(tabId: number | null, now?: number): ExecutionJournalSnapshot;
  clear(tabId?: number): void;
  toStorage(): { version: number; entries: ExecutionJournalEntry[] };
}

export function createExecutionDiagnosticsJournal(
  limits: ExecutionDiagnosticsJournalLimits = {},
): ExecutionDiagnosticsJournalStore {
  const maxEntries = boundedPositiveInteger(limits.maxEntries, DEFAULT_MAX_JOURNAL_ENTRIES);
  const maxEntriesPerTab = boundedPositiveInteger(limits.maxEntriesPerTab, DEFAULT_MAX_JOURNAL_ENTRIES_PER_TAB);
  const maxAgeMs = boundedPositiveInteger(limits.maxAgeMs, DEFAULT_MAX_JOURNAL_AGE_MS);
  const maxSerializedBytes = boundedPositiveInteger(limits.maxSerializedBytes, DEFAULT_MAX_JOURNAL_SERIALIZED_BYTES, 128);
  const staleAfterMs = boundedPositiveInteger(limits.staleAfterMs, DEFAULT_JOURNAL_STALE_AFTER_MS);
  const now = limits.now || Date.now;
  let sequence = 0;
  let entries: ExecutionJournalEntry[] = [];

  function payload(): { version: number; entries: ExecutionJournalEntry[] } {
    return { version: JOURNAL_SCHEMA_VERSION, entries: entries.map(cloneJournalEntry) };
  }

  function prune(timestamp: number): void {
    const cutoff = timestamp - maxAgeMs;
    entries = entries.filter(entry => entry.timestamp >= cutoff);

    const perTab = new Map<number, ExecutionJournalEntry[]>();
    for (const entry of entries) {
      const tabEntries = perTab.get(entry.tabId) || [];
      tabEntries.push(entry);
      perTab.set(entry.tabId, tabEntries);
    }
    const kept = new Set<ExecutionJournalEntry>();
    for (const tabEntries of perTab.values()) {
      tabEntries.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
      tabEntries.slice(-maxEntriesPerTab).forEach(entry => kept.add(entry));
    }
    entries = entries.filter(entry => kept.has(entry));
    entries.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
    if (entries.length > maxEntries) entries = entries.slice(-maxEntries);

    while (entries.length > 0 && utf8ByteLength(JSON.stringify(payload())) > maxSerializedBytes) {
      entries.shift();
    }
  }

  function record(sender: ExecutionDiagnosticSender, event: ExecutionDiagnosticEventInput): ExecutionJournalEntry | null {
    if (event?.type !== 'run' && event?.type !== 'error') return null;
    const tabId = Number(sender?.tab?.id);
    if (!Number.isInteger(tabId) || tabId < 0) return null;
    const frameId = Number.isInteger(sender?.frameId) && Number(sender.frameId) >= 0 ? Number(sender.frameId) : 0;
    const timestamp = Number.isFinite(event?.timestamp) ? Math.max(0, Number(event.timestamp)) : now();
    const redactedUrl = redactExecutionUrl(event?.url || sender?.tab?.url);
    const entry: ExecutionJournalEntry = {
      id: `${timestamp.toString(36)}-${(++sequence).toString(36)}`.slice(0, JOURNAL_ID_LENGTH),
      timestamp,
      tabId,
      frameId,
      outcome: event.type === 'error' ? 'failure' : 'success',
      scriptId: cleanString(event.scriptId, JOURNAL_SCRIPT_ID_LENGTH) || null,
      origin: redactedUrl.origin,
      urlHash: redactedUrl.urlHash,
      duration: Number.isFinite(event.duration) && Number(event.duration) >= 0 && Number(event.duration) <= JOURNAL_MAX_DURATION_MS
        ? Number(event.duration)
        : null,
      errorClass: event.type === 'error' ? classifyExecutionError(event.error) : null,
    };
    entries.push(entry);
    prune(timestamp);
    return entries.includes(entry) ? cloneJournalEntry(entry) : null;
  }

  function hydrate(value: unknown): number {
    const source = value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    const rawEntries = Array.isArray(source.entries) ? source.entries : [];
    entries = rawEntries.map(normalizeJournalEntry).filter((entry): entry is ExecutionJournalEntry => !!entry);
    sequence = entries.length;
    prune(now());
    return entries.length;
  }

  function snapshot(tabId: number | null, timestamp = now()): ExecutionJournalSnapshot {
    if (!Number.isInteger(tabId) || Number(tabId) < 0) return emptyJournalSnapshot();
    prune(timestamp);
    const matching = entries
      .filter(entry => entry.tabId === Number(tabId))
      .sort((left, right) => right.timestamp - left.timestamp || right.id.localeCompare(left.id));
    const latest = matching[0] || null;
    const latestAgeMs = latest ? Math.max(0, timestamp - latest.timestamp) : null;
    return {
      entries: matching.map(cloneJournalEntry),
      latest: latest ? cloneJournalEntry(latest) : null,
      count: matching.length,
      latestAgeMs,
      latestStale: latestAgeMs !== null && latestAgeMs >= staleAfterMs,
    };
  }

  function clear(tabId?: number): void {
    if (Number.isInteger(tabId) && Number(tabId) >= 0) {
      entries = entries.filter(entry => entry.tabId !== Number(tabId));
    } else {
      entries = [];
    }
  }

  return Object.freeze({ record, hydrate, snapshot, clear, toStorage: payload });
}

export function createExecutionDiagnosticsJournalPersistence(
  journal: ExecutionDiagnosticsJournalStore,
  storage: ExecutionDiagnosticsJournalStorage,
  storageKey = JOURNAL_STORAGE_KEY,
): ExecutionDiagnosticsJournalPersistence {
  let writeChain = Promise.resolve();
  let lastError: string | null = null;
  let lastWriteAt: number | null = null;

  async function hydrate(): Promise<{ loaded: number; error: string | null }> {
    try {
      const stored = await storage.get([storageKey]);
      const loaded = journal.hydrate(stored?.[storageKey]);
      lastError = null;
      return { loaded, error: null };
    } catch (error) {
      lastError = cleanString(error instanceof Error ? error.message : error, 256) || 'storage read failed';
      return { loaded: 0, error: lastError };
    }
  }

  function schedule(): Promise<void> {
    writeChain = writeChain.then(async () => {
      try {
        await storage.set({ [storageKey]: journal.toStorage() });
        lastError = null;
        lastWriteAt = Date.now();
      } catch (error) {
        lastError = cleanString(error instanceof Error ? error.message : error, 256) || 'storage write failed';
      }
    });
    return writeChain;
  }

  async function clear(tabId?: number): Promise<void> {
    journal.clear(tabId);
    await schedule();
  }

  return Object.freeze({
    hydrate,
    schedule,
    clear,
    getStatus: () => ({ lastError, lastWriteAt }),
  });
}

function emptySnapshot(tabId: number | null): ExecutionDiagnosticsSnapshot {
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
      journal: emptyJournalSnapshot(),
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

export const ExecutionDiagnostics = Object.freeze({
  createExecutionDiagnosticsJournal,
  createExecutionDiagnosticsJournalPersistence,
  createExecutionDiagnosticsStore,
});

export default ExecutionDiagnostics;
