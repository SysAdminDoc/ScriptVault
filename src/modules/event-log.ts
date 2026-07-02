// ============================================================================
// Structured Event Logging
// ============================================================================
// Lightweight event ring for install/update/sync/toggle/registration operations.
// Privacy-safe: no script source, no full URLs (hostnames only).
// JSON-exportable for DevTools panel and support snapshot opt-in.

export type EventCategory =
  | 'install'
  | 'update'
  | 'sync'
  | 'toggle'
  | 'registration'
  | 'error'
  | 'security'
  | 'backup'
  | 'settings';

export type EventSeverity = 'info' | 'warn' | 'error';

export interface EventLogRecord {
  id: string;
  timestamp: number;
  category: EventCategory;
  severity: EventSeverity;
  action: string;
  detail: string;
  scriptId?: string | null;
  scriptName?: string | null;
  hostname?: string | null;
}

export interface EventLogEntry {
  category: EventCategory;
  severity?: EventSeverity;
  action: string;
  detail?: string;
  scriptId?: string | null;
  scriptName?: string | null;
  url?: string | null;
}

export interface EventLogFilters {
  category?: EventCategory;
  severity?: EventSeverity;
  startDate?: number;
  endDate?: number;
  scriptId?: string;
  search?: string;
}

export interface EventLogSummary {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

const STORAGE_KEY = 'eventLog';
let MAX_ENTRIES = 1000;
const SAVE_DEBOUNCE_MS = 300;

let _cache: EventLogRecord[] | null = null;
let _loadPromise: Promise<EventLogRecord[]> | null = null;
let _pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Internal Storage
// ---------------------------------------------------------------------------

async function _load(): Promise<EventLogRecord[]> {
  if (_cache !== null) return _cache;
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      _cache = (data[STORAGE_KEY] as EventLogRecord[] | undefined) || [];
      return _cache;
    })();
  }
  return _loadPromise;
}

async function _writeCacheToStorage(): Promise<void> {
  if (_cache === null) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: _cache });
}

function _scheduleSave(): void {
  if (_pendingSaveTimer) return;
  _pendingSaveTimer = setTimeout(() => {
    _pendingSaveTimer = null;
    _writeCacheToStorage().catch((e) => {
      console.warn('[EventLog] debounced save failed:', e?.message || e);
    });
  }, SAVE_DEBOUNCE_MS);
}

function _generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function _extractHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

async function log(entry: EventLogEntry): Promise<EventLogRecord> {
  const entries = await _load();
  const record: EventLogRecord = {
    id: _generateId(),
    timestamp: Date.now(),
    category: entry.category,
    severity: entry.severity || 'info',
    action: entry.action,
    detail: entry.detail || '',
    scriptId: entry.scriptId ?? null,
    scriptName: entry.scriptName ?? null,
    hostname: _extractHostname(entry.url),
  };

  entries.unshift(record);

  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }

  _scheduleSave();
  return record;
}

async function getAll(filters?: EventLogFilters): Promise<EventLogRecord[]> {
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
      const searchable = `${record.action} ${record.detail} ${record.scriptName || ''} ${record.hostname || ''}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

async function clear(): Promise<void> {
  _cache = [];
  if (_pendingSaveTimer) {
    clearTimeout(_pendingSaveTimer);
    _pendingSaveTimer = null;
  }
  await _writeCacheToStorage();
}

async function flush(): Promise<void> {
  if (_pendingSaveTimer) {
    clearTimeout(_pendingSaveTimer);
    _pendingSaveTimer = null;
  }
  await _writeCacheToStorage();
}

async function getSummary(): Promise<EventLogSummary> {
  const entries = await _load();
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let oldest: number | null = null;
  let newest: number | null = null;

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
    newestTimestamp: newest,
  };
}

function exportJSON(entries: EventLogRecord[]): string {
  return JSON.stringify({
    schema: 'scriptvault-event-log/v1',
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  }, null, 2);
}

function exportCSV(entries: EventLogRecord[]): string {
  const header = 'timestamp,category,severity,action,detail,scriptId,scriptName,hostname';
  const rows = entries.map((r) => {
    const ts = new Date(r.timestamp).toISOString();
    // Defang CSV formula injection (CWE-1236): a cell beginning with = + - @
    // or a control char is prefixed with ' so spreadsheet apps don't execute
    // it. Fields like action/detail/scriptName derive from script @name and
    // feed data. Matches error-log.exportCSV's mitigation.
    const esc = (s: string | null | undefined): string => {
      let str = String(s ?? '');
      if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
      return `"${str.replace(/"/g, '""')}"`;
    };
    return `${ts},${r.category},${r.severity},${esc(r.action)},${esc(r.detail)},${esc(r.scriptId)},${esc(r.scriptName)},${esc(r.hostname)}`;
  });
  return [header, ...rows].join('\n');
}

// Allow test overrides
function setMaxEntries(n: number): void {
  MAX_ENTRIES = n;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const EventLog = {
  log,
  getAll,
  clear,
  flush,
  getSummary,
  exportJSON,
  exportCSV,
  setMaxEntries,
};

export default EventLog;
