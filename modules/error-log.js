// ============================================================================
// Error Reporting / Log Export
// ============================================================================

const ErrorLog = {
  STORAGE_KEY: 'errorLog',
  MAX_ENTRIES: 500,
  // ERRLOG-PERF — debounce the storage.local.set call so a burst of N
  // errors per second pays the serialization cost ONCE per debounce
  // window instead of N times. Each save serializes the full 500-entry
  // log (~150KB), so the savings under bursty load are substantial.
  // 200ms is short enough that the in-memory cache + persisted state
  // stay near-identical for the dashboard view and long enough to
  // coalesce a meaningful burst. clear() and explicit flush() bypass
  // the debounce.
  SAVE_DEBOUNCE_MS: 200,

  // In-memory cache; loaded on first access
  _cache: null,
  _pendingSaveTimer: null,

  // ---------------------------------------------------------------------------
  // Core Operations
  // ---------------------------------------------------------------------------

  /**
   * Log an error entry.
   * entry: { scriptId, scriptName?, error, stack?, url?, line?, col?, context? }
   */
  async log(entry) {
    let entries = await this._load();

    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      scriptId: entry.scriptId || null,
      scriptName: entry.scriptName || null,
      error: typeof entry.error === 'string' ? entry.error : (entry.error?.message || String(entry.error)),
      stack: entry.stack || entry.error?.stack || null,
      url: entry.url || null,
      line: entry.line ?? null,
      col: entry.col ?? null,
      context: entry.context || null
    };

    // Resolve script name if not provided
    if (!record.scriptName && record.scriptId) {
      try {
        if (typeof ScriptStorage !== 'undefined') {
          const script = await ScriptStorage.get(record.scriptId);
          if (script?.meta?.name) record.scriptName = script.meta.name;
        }
      } catch (_) { /* ignore */ }
    }

    entries.push(record);

    // FIFO: trim to max entries
    if (entries.length > this.MAX_ENTRIES) {
      entries = entries.slice(-this.MAX_ENTRIES);
    }

    this._cache = entries;
    // ERRLOG-PERF — schedule (don't block) the persistence. Callers that
    // need an immediate flush (clear, factory reset, before-tab-close)
    // call ErrorLog.flush() explicitly.
    this._scheduleSave();

    return record;
  },

  /**
   * Get all log entries, optionally filtered.
   * filters: { scriptId?, startDate?, endDate?, errorType?, search? }
   */
  async getAll(filters) {
    let entries = await this._load();

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
  },

  // ---------------------------------------------------------------------------
  // Error Grouping
  // ---------------------------------------------------------------------------

  /**
   * Group identical errors by (error message + scriptId).
   * Returns array of { key, error, scriptId, scriptName, count, firstSeen, lastSeen, sampleStack }
   */
  async getGrouped(filters) {
    const entries = await this.getAll(filters);
    const groups = new Map();

    for (const entry of entries) {
      const key = `${entry.scriptId || ''}::${entry.error || ''}`;

      if (groups.has(key)) {
        const group = groups.get(key);
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
          sampleStack: entry.stack || null
        });
      }
    }

    // Sort by most recent occurrence descending
    return [...groups.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  },

  // ---------------------------------------------------------------------------
  // Export Formats
  // ---------------------------------------------------------------------------

  /**
   * Export as structured JSON string.
   */
  async exportJSON(filters) {
    const entries = await this.getAll(filters);
    return JSON.stringify({
      exported: new Date().toISOString(),
      count: entries.length,
      entries
    }, null, 2);
  },

  /**
   * Export as human-readable text log.
   */
  async exportText(filters) {
    const entries = await this.getAll(filters);
    const lines = [
      `ScriptVault Error Log - Exported ${new Date().toISOString()}`,
      `Total entries: ${entries.length}`,
      '='.repeat(80),
      ''
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
  },

  /**
   * Export as CSV string.
   *
   * Security: user-controlled fields (`scriptName`, `error`, `url`,
   * `context`) get **CSV formula injection** mitigation (CWE-1236 /
   * OWASP). Userscripts can throw `Error` instances with attacker-
   * controlled `.message`, and an attacker who knows the user exports
   * the error log could craft payloads like `=HYPERLINK("http://evil")`
   * or `+cmd|'/c calc'!A0` that Excel/LibreOffice/Numbers/Sheets
   * execute on open. The standard mitigation is to prefix any field
   * starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a literal
   * apostrophe, which the spreadsheet renders harmlessly.
   */
  async exportCSV(filters) {
    const entries = await this.getAll(filters);
    const headers = ['timestamp', 'datetime', 'scriptId', 'scriptName', 'error', 'url', 'line', 'col', 'context'];

    const escapeCSV = (val) => {
      if (val == null) return '';
      let str = String(val);
      // Formula-injection mitigation — defang any cell that a spreadsheet
      // would otherwise interpret as a formula. Apply BEFORE the quote
      // wrap so the apostrophe survives the surrounding quotes intact.
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = [headers.join(',')];
    for (const e of entries) {
      rows.push([
        // timestamp + datetime are extension-controlled numerics — safe
        // to write raw. Line/col are integers from chrome's error event.
        e.timestamp,
        new Date(e.timestamp).toISOString(),
        escapeCSV(e.scriptId),
        escapeCSV(e.scriptName),
        escapeCSV(e.error),
        escapeCSV(e.url),
        e.line ?? '',
        e.col ?? '',
        escapeCSV(e.context)
      ].join(','));
    }

    return rows.join('\n');
  },

  // ---------------------------------------------------------------------------
  // Management
  // ---------------------------------------------------------------------------

  /**
   * Clear all log entries, or entries for a specific script.
   */
  async clear(scriptId) {
    if (scriptId) {
      const entries = await this._load();
      this._cache = entries.filter(e => e.scriptId !== scriptId);
    } else {
      this._cache = [];
    }
    // ERRLOG-PERF — clear is user-initiated; flush immediately rather
    // than letting a 200ms debounce delay storage commit. Cancels any
    // pending debounced save so we don't double-write.
    await this.flush();
  },

  /**
   * Get error log statistics.
   * Returns { total, byScript, oldest, newest, storageBytes }
   */
  async getStats() {
    const entries = await this._load();

    const byScript = {};
    for (const e of entries) {
      const key = e.scriptId || 'unknown';
      if (!byScript[key]) {
        byScript[key] = { scriptId: e.scriptId, scriptName: e.scriptName, count: 0 };
      }
      byScript[key].count++;
    }

    const storageBytes = JSON.stringify(entries).length;

    return {
      total: entries.length,
      maxEntries: this.MAX_ENTRIES,
      byScript: Object.values(byScript).sort((a, b) => b.count - a.count),
      oldest: entries.length > 0 ? entries[0].timestamp : null,
      newest: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
      storageBytes
    };
  },

  // ---------------------------------------------------------------------------
  // Capture Helpers
  // ---------------------------------------------------------------------------

  /**
   * Register global error listeners on the service worker.
   * Call once during service worker initialization.
   */
  registerGlobalHandlers() {
    // Unhandled errors
    self.addEventListener('error', (event) => {
      this.log({
        scriptId: null,
        scriptName: 'ServiceWorker',
        error: event.message || 'Unknown error',
        stack: event.error?.stack || null,
        url: event.filename || null,
        line: event.lineno ?? null,
        col: event.colno ?? null,
        context: 'global-error-handler'
      }).catch(() => { /* prevent infinite loop */ });
    });

    // Unhandled promise rejections
    self.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.log({
        scriptId: null,
        scriptName: 'ServiceWorker',
        error: reason?.message || String(reason),
        stack: reason?.stack || null,
        context: 'unhandled-rejection'
      }).catch(() => { /* prevent infinite loop */ });
    });

    console.log('[ScriptVault] Error log global handlers registered');
  },

  /**
   * Log a script execution error (from USER_SCRIPT world messages).
   */
  async logScriptError(scriptId, scriptName, errorData) {
    return this.log({
      scriptId,
      scriptName,
      error: errorData.message || errorData.error || 'Script execution error',
      stack: errorData.stack || null,
      url: errorData.url || null,
      line: errorData.line ?? errorData.lineno ?? null,
      col: errorData.col ?? errorData.colno ?? null,
      context: 'script-execution'
    });
  },

  /**
   * Log a GM API call failure.
   */
  async logGMError(scriptId, scriptName, apiName, error) {
    return this.log({
      scriptId,
      scriptName,
      error: `GM API ${apiName}: ${typeof error === 'string' ? error : (error?.message || String(error))}`,
      stack: error?.stack || null,
      context: `gm-api-${apiName}`
    });
  },

  // ---------------------------------------------------------------------------
  // Internal Storage
  // ---------------------------------------------------------------------------

  async _load() {
    if (this._cache) return this._cache;
    const data = await chrome.storage.local.get(this.STORAGE_KEY);
    this._cache = data[this.STORAGE_KEY] || [];
    return this._cache;
  },

  // ERRLOG-PERF — schedule a debounced write. Multiple calls within the
  // SAVE_DEBOUNCE_MS window collapse into one storage.local.set.
  _scheduleSave() {
    if (this._pendingSaveTimer) return;
    this._pendingSaveTimer = setTimeout(() => {
      this._pendingSaveTimer = null;
      // Fire-and-forget — failures are logged but don't surface to
      // the original log() caller (whose return value didn't promise
      // persistence since this commit).
      this._writeCacheToStorage().catch((e) => {
        console.warn('[ErrorLog] debounced save failed:', e?.message || e);
      });
    }, this.SAVE_DEBOUNCE_MS);
  },

  /**
   * Flush any pending debounced save synchronously (well, awaitably).
   * Public API — call before factory reset / log export / tab close
   * when the caller needs a hard persistence guarantee.
   */
  async flush() {
    if (this._pendingSaveTimer) {
      clearTimeout(this._pendingSaveTimer);
      this._pendingSaveTimer = null;
    }
    await this._writeCacheToStorage();
  },

  async _writeCacheToStorage() {
    if (this._cache === null) return;
    await chrome.storage.local.set({ [this.STORAGE_KEY]: this._cache });
  },

  // Legacy alias retained for any external caller still invoking _save
  // directly. Now equivalent to flush() — bypass debounce.
  async _save() {
    await this.flush();
  }
};
