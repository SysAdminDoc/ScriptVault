// ScriptVault - Network Request Logger
// Logs all GM_xmlhttpRequest calls for transparency and debugging

const NetworkLog = {
  _log: [],
  _maxEntries: 2000,

  add(entry) {
    this._log.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      ...entry
    });
    if (this._log.length > this._maxEntries) {
      this._log = this._log.slice(0, this._maxEntries);
    }
  },

  getAll(filters = {}) {
    let results = this._log;
    if (filters.scriptId) {
      results = results.filter(e => e.scriptId === filters.scriptId);
    }
    if (filters.method) {
      results = results.filter(e => e.method?.toUpperCase() === filters.method.toUpperCase());
    }
    if (filters.domain) {
      results = results.filter(e => {
        try { return new URL(e.url).hostname.includes(filters.domain); } catch { return false; }
      });
    }
    if (filters.status) {
      if (filters.status === 'error') {
        results = results.filter(e => e.error || (e.status && e.status >= 400));
      } else if (filters.status === 'success') {
        results = results.filter(e => !e.error && e.status && e.status < 400);
      }
    }
    return results.slice(0, filters.limit || 100);
  },

  getStats() {
    const byScript = {};
    const byDomain = {};
    let totalRequests = 0;
    let totalErrors = 0;
    let totalBytes = 0;

    for (const entry of this._log) {
      totalRequests++;
      if (entry.error || (entry.status && entry.status >= 400)) totalErrors++;
      totalBytes += entry.responseSize || 0;

      // By script
      const sid = entry.scriptId || 'unknown';
      if (!byScript[sid]) byScript[sid] = { count: 0, errors: 0, bytes: 0, scriptName: entry.scriptName || sid };
      byScript[sid].count++;
      const isError = !!(entry.error || (entry.status && entry.status >= 400));
      if (isError) byScript[sid].errors++;
      byScript[sid].bytes += entry.responseSize || 0;

      // By domain
      try {
        const domain = new URL(entry.url).hostname;
        if (!byDomain[domain]) byDomain[domain] = { count: 0, errors: 0, bytes: 0 };
        byDomain[domain].count++;
        if (isError) byDomain[domain].errors++;
        byDomain[domain].bytes += entry.responseSize || 0;
      } catch {}
    }

    return { totalRequests, totalErrors, totalBytes, byScript, byDomain };
  },

  clear(scriptId) {
    if (scriptId) {
      this._log = this._log.filter(e => e.scriptId !== scriptId);
    } else {
      this._log = [];
    }
  }
};
