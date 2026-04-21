// ============================================================================
// Error Reporting / Log Export
// ============================================================================

/** A single error log entry as stored in chrome.storage. */
export interface ErrorLogRecord {
  id: string;
  timestamp: number;
  scriptId: string | null;
  scriptName: string | null;
  error: string;
  stack: string | null;
  url: string | null;
  line: number | null;
  col: number | null;
  context: string | null;
}

/** Input shape accepted by ErrorLog.log(). */
export interface ErrorLogEntry {
  scriptId?: string | null;
  scriptName?: string | null;
  error: string | { message?: string; stack?: string } | unknown;
  stack?: string | null;
  url?: string | null;
  line?: number | null;
  col?: number | null;
  context?: string | null;
}

/** Filters for querying error log entries. */
export interface ErrorLogFilters {
  scriptId?: string;
  startDate?: number | string;
  endDate?: number | string;
  errorType?: string;
  search?: string;
}

/** A grouped error summary. */
export interface ErrorGroup {
  key: string;
  error: string;
  scriptId: string | null;
  scriptName: string | null;
  count: number;
  firstSeen: number;
  lastSeen: number;
  sampleStack: string | null;
}

/** Per-script stats inside getStats(). */
export interface ScriptErrorCount {
  scriptId: string | null;
  scriptName: string | null;
  count: number;
}

/** Return type for getStats(). */
export interface ErrorLogStats {
  total: number;
  maxEntries: number;
  byScript: ScriptErrorCount[];
  oldest: number | null;
  newest: number | null;
  storageBytes: number;
}

/** Script error data from content-world messages. */
export interface ScriptErrorData {
  message?: string;
  error?: string;
  stack?: string | null;
  url?: string | null;
  line?: number | null;
  lineno?: number | null;
  col?: number | null;
  colno?: number | null;
}

// ScriptStorage is a global in the service-worker context (loaded before this module).
// We declare it here so TypeScript doesn't complain about the runtime `typeof` check.
declare const ScriptStorage: { get(id: string): Promise<{ meta?: { name?: string } } | null> } | undefined;

const STORAGE_KEY = 'errorLog';
const MAX_ENTRIES = 500;

// In-memory cache; loaded on first access
let _cache: ErrorLogRecord[] | null = null;
// Pending load promise — ensures concurrent callers share one storage read
let _loadPromise: Promise<ErrorLogRecord[]> | null = null;

// ---------------------------------------------------------------------------
// Internal Storage
// ---------------------------------------------------------------------------

async function _load(): Promise<ErrorLogRecord[]> {
  if (_cache) return _cache;
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      _cache = (data[STORAGE_KEY] as ErrorLogRecord[] | undefined) || [];
      return _cache;
    })();
  }
  return _loadPromise;
}

async function _save(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: _cache });
}

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

/**
 * Log an error entry.
 * entry: { scriptId, scriptName?, error, stack?, url?, line?, col?, context? }
 */
export async function log(entry: ErrorLogEntry): Promise<ErrorLogRecord> {
  const entries = await _load();

  const errorValue = entry.error;
  const errorObj = errorValue as { message?: string; stack?: string } | undefined;

  const record: ErrorLogRecord = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    scriptId: (entry.scriptId as string) || null,
    scriptName: (entry.scriptName as string) || null,
    error: typeof errorValue === 'string'
      ? errorValue
      : (errorObj?.message || String(errorValue)),
    stack: (entry.stack as string) || errorObj?.stack || null,
    url: (entry.url as string) || null,
    line: entry.line ?? null,
    col: entry.col ?? null,
    context: (entry.context as string) || null,
  };

  // Resolve script name if not provided
  if (!record.scriptName && record.scriptId) {
    try {
      if (typeof ScriptStorage !== 'undefined' && ScriptStorage) {
        const script = await ScriptStorage.get(record.scriptId);
        if (script?.meta?.name) record.scriptName = script.meta.name;
      }
    } catch (_) { /* ignore */ }
  }

  entries.push(record);

  // FIFO: trim to max entries
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  _cache = entries;
  await _save();

  return record;
}

/**
 * Get all log entries, optionally filtered.
 * filters: { scriptId?, startDate?, endDate?, errorType?, search? }
 */
export async function getAll(filters?: ErrorLogFilters): Promise<ErrorLogRecord[]> {
  let entries = await _load();

  if (!filters) return [...entries];

  if (filters.scriptId) {
    entries = entries.filter(e => e.scriptId === filters.scriptId);
  }
  if (filters.startDate) {
    const start = typeof filters.startDate === 'number' ? filters.startDate : new Date(filters.startDate).getTime();
    entries = entries.filter(e => e.timestamp >= start);
  }
  if (filters.endDate) {
    const end = typeof filters.endDate === 'number' ? filters.endDate : new Date(filters.endDate).getTime();
    entries = entries.filter(e => e.timestamp <= end);
  }
  if (filters.errorType) {
    const type = filters.errorType.toLowerCase();
    entries = entries.filter(e => {
      const msg = (e.error || '').toLowerCase();
      return msg.includes(type);
    });
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(e =>
      (e.error || '').toLowerCase().includes(q) ||
      (e.scriptName || '').toLowerCase().includes(q) ||
      (e.stack || '').toLowerCase().includes(q) ||
      (e.url || '').toLowerCase().includes(q) ||
      (e.context || '').toLowerCase().includes(q)
    );
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Error Grouping
// ---------------------------------------------------------------------------

/**
 * Group identical errors by (error message + scriptId).
 * Returns array of { key, error, scriptId, scriptName, count, firstSeen, lastSeen, sampleStack }
 */
export async function getGrouped(filters?: ErrorLogFilters): Promise<ErrorGroup[]> {
  const entries = await getAll(filters);
  const groups = new Map<string, ErrorGroup>();

  for (const entry of entries) {
    const key = `${entry.scriptId || ''}::${entry.error || ''}`;

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.count++;
      if (entry.timestamp < group.firstSeen) group.firstSeen = entry.timestamp;
      if (entry.timestamp > group.lastSeen) group.lastSeen = entry.timestamp;
      // Keep the most recent stack trace
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
        sampleStack: entry.stack || null,
      });
    }
  }

  // Sort by most recent occurrence descending
  return [...groups.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}

// ---------------------------------------------------------------------------
// Export Formats
// ---------------------------------------------------------------------------

/**
 * Export as structured JSON string.
 */
export async function exportJSON(filters?: ErrorLogFilters): Promise<string> {
  const entries = await getAll(filters);
  return JSON.stringify({
    exported: new Date().toISOString(),
    count: entries.length,
    entries,
  }, null, 2);
}

/**
 * Export as human-readable text log.
 */
export async function exportText(filters?: ErrorLogFilters): Promise<string> {
  const entries = await getAll(filters);
  const lines: string[] = [
    `ScriptVault Error Log - Exported ${new Date().toISOString()}`,
    `Total entries: ${entries.length}`,
    '='.repeat(80),
    '',
  ];

  for (const e of entries) {
    const time = new Date(e.timestamp).toISOString();
    lines.push(`[${time}] ${e.scriptName || e.scriptId || 'Unknown'}`);
    lines.push(`  Error: ${e.error}`);
    if (e.url) lines.push(`  URL: ${e.url}${e.line != null ? `:${e.line}` : ''}${e.col != null ? `:${e.col}` : ''}`);
    if (e.context) lines.push(`  Context: ${e.context}`);
    if (e.stack) {
      lines.push('  Stack:');
      for (const sLine of e.stack.split('\n').slice(0, 5)) {
        lines.push(`    ${sLine.trim()}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export as CSV string.
 */
export async function exportCSV(filters?: ErrorLogFilters): Promise<string> {
  const entries = await getAll(filters);
  const headers = ['timestamp', 'datetime', 'scriptId', 'scriptName', 'error', 'url', 'line', 'col', 'context'];

  const escapeCSV = (val: string | number | null | undefined): string => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows: string[] = [headers.join(',')];
  for (const e of entries) {
    rows.push([
      e.timestamp,
      new Date(e.timestamp).toISOString(),
      escapeCSV(e.scriptId),
      escapeCSV(e.scriptName),
      escapeCSV(e.error),
      escapeCSV(e.url),
      e.line ?? '',
      e.col ?? '',
      escapeCSV(e.context),
    ].join(','));
  }

  return rows.join('\n');
}

// ---------------------------------------------------------------------------
// Management
// ---------------------------------------------------------------------------

/**
 * Clear all log entries, or entries for a specific script.
 */
export async function clear(scriptId?: string): Promise<void> {
  if (scriptId) {
    const entries = await _load();
    _cache = entries.filter(e => e.scriptId !== scriptId);
    await _save();
  } else {
    _cache = [];
    await _save();
  }
}

/**
 * Get error log statistics.
 * Returns { total, byScript, oldest, newest, storageBytes }
 */
export async function getStats(): Promise<ErrorLogStats> {
  const entries = await _load();

  const byScript: Record<string, ScriptErrorCount> = {};
  for (const e of entries) {
    const key = e.scriptId || 'unknown';
    if (!byScript[key]) {
      byScript[key] = { scriptId: e.scriptId, scriptName: e.scriptName, count: 0 };
    }
    byScript[key]!.count++;
  }

  const storageBytes = JSON.stringify(entries).length;

  return {
    total: entries.length,
    maxEntries: MAX_ENTRIES,
    byScript: Object.values(byScript).sort((a, b) => b.count - a.count),
    oldest: entries.length > 0 ? entries[0]!.timestamp : null,
    newest: entries.length > 0 ? entries[entries.length - 1]!.timestamp : null,
    storageBytes,
  };
}

// ---------------------------------------------------------------------------
// Capture Helpers
// ---------------------------------------------------------------------------

/**
 * Register global error listeners on the service worker.
 * Call once during service worker initialization.
 */
export function registerGlobalHandlers(): void {
  // Unhandled errors
  self.addEventListener('error', (event: ErrorEvent) => {
    log({
      scriptId: null,
      scriptName: 'ServiceWorker',
      error: event.message || 'Unknown error',
      stack: event.error?.stack || null,
      url: event.filename || null,
      line: event.lineno ?? null,
      col: event.colno ?? null,
      context: 'global-error-handler',
    }).catch(() => { /* prevent infinite loop */ });
  });

  // Unhandled promise rejections
  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    log({
      scriptId: null,
      scriptName: 'ServiceWorker',
      error: reason?.message || String(reason),
      stack: reason?.stack || null,
      context: 'unhandled-rejection',
    }).catch(() => { /* prevent infinite loop */ });
  });

  console.log('[ScriptVault] Error log global handlers registered');
}

/**
 * Log a script execution error (from USER_SCRIPT world messages).
 */
export async function logScriptError(
  scriptId: string,
  scriptName: string,
  errorData: ScriptErrorData,
): Promise<ErrorLogRecord> {
  return log({
    scriptId,
    scriptName,
    error: errorData.message || errorData.error || 'Script execution error',
    stack: errorData.stack || null,
    url: errorData.url || null,
    line: errorData.line ?? errorData.lineno ?? null,
    col: errorData.col ?? errorData.colno ?? null,
    context: 'script-execution',
  });
}

/**
 * Log a GM API call failure.
 */
export async function logGMError(
  scriptId: string,
  scriptName: string,
  apiName: string,
  error: string | { message?: string; stack?: string } | unknown,
): Promise<ErrorLogRecord> {
  const errorObj = error as { message?: string; stack?: string } | undefined;
  return log({
    scriptId,
    scriptName,
    error: `GM API ${apiName}: ${typeof error === 'string' ? error : (errorObj?.message || String(error))}`,
    stack: errorObj?.stack || null,
    context: `gm-api-${apiName}`,
  });
}

// ---------------------------------------------------------------------------
// Default export — preserves the object-style API for callers that expect it
// ---------------------------------------------------------------------------

const ErrorLog = {
  STORAGE_KEY,
  MAX_ENTRIES,
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
};

export default ErrorLog;
