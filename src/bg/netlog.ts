// ScriptVault - Network Request Logger
// Logs all GM_xmlhttpRequest calls for transparency and debugging

export interface NetLogEntry {
  id: string;
  timestamp: number;
  scriptId?: string;
  scriptName?: string;
  method?: string;
  url: string;
  status?: number;
  error?: string;
  responseSize?: number;
}

export interface NetLogFilters {
  scriptId?: string;
  method?: string;
  domain?: string;
  status?: 'error' | 'success';
  limit?: number;
}

interface ScriptStats {
  count: number;
  errors: number;
  bytes: number;
  scriptName: string;
}

interface DomainStats {
  count: number;
  errors: number;
  bytes: number;
}

export interface NetLogStats {
  totalRequests: number;
  totalErrors: number;
  totalBytes: number;
  byScript: Record<string, ScriptStats>;
  byDomain: Record<string, DomainStats>;
}

export type NetLogInput = Omit<NetLogEntry, 'id' | 'timestamp'> & Partial<Pick<NetLogEntry, 'id' | 'timestamp'>>;

export const NetworkLog = {
  _log: [] as NetLogEntry[],
  _maxEntries: 2000,

  add(entry: NetLogInput): void {
    const full: NetLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      ...entry
    };
    this._log.unshift(full);
    if (this._log.length > this._maxEntries) {
      this._log = this._log.slice(0, this._maxEntries);
    }
  },

  getAll(filters: NetLogFilters = {}): NetLogEntry[] {
    let results: NetLogEntry[] = this._log;
    if (filters.scriptId) {
      const scriptId: string = filters.scriptId;
      results = results.filter((e: NetLogEntry) => e.scriptId === scriptId);
    }
    if (filters.method) {
      const method: string = filters.method;
      results = results.filter((e: NetLogEntry) => e.method?.toUpperCase() === method.toUpperCase());
    }
    if (filters.domain) {
      const domain: string = filters.domain;
      results = results.filter((e: NetLogEntry) => {
        try { return new URL(e.url).hostname.includes(domain); } catch { return false; }
      });
    }
    if (filters.status) {
      if (filters.status === 'error') {
        results = results.filter((e: NetLogEntry) => e.error || (e.status != null && e.status >= 400));
      } else if (filters.status === 'success') {
        results = results.filter((e: NetLogEntry) => !e.error && e.status != null && e.status < 400);
      }
    }
    return results.slice(0, filters.limit ?? 100);
  },

  getStats(): NetLogStats {
    const byScript: Record<string, ScriptStats> = {};
    const byDomain: Record<string, DomainStats> = {};
    let totalRequests: number = 0;
    let totalErrors: number = 0;
    let totalBytes: number = 0;

    for (const entry of this._log) {
      totalRequests++;
      if (entry.error || (entry.status != null && entry.status >= 400)) totalErrors++;
      totalBytes += entry.responseSize ?? 0;

      // By script
      const sid: string = entry.scriptId ?? 'unknown';
      const existingScript: ScriptStats | undefined = byScript[sid];
      if (!existingScript) {
        byScript[sid] = { count: 0, errors: 0, bytes: 0, scriptName: entry.scriptName ?? sid };
      }
      const scriptEntry: ScriptStats = byScript[sid]!;
      scriptEntry.count++;
      const isError: boolean = !!(entry.error || (entry.status != null && entry.status >= 400));
      if (isError) scriptEntry.errors++;
      scriptEntry.bytes += entry.responseSize ?? 0;

      // By domain
      try {
        const domain: string = new URL(entry.url).hostname;
        const existingDomain: DomainStats | undefined = byDomain[domain];
        if (!existingDomain) {
          byDomain[domain] = { count: 0, errors: 0, bytes: 0 };
        }
        const domainEntry: DomainStats = byDomain[domain]!;
        domainEntry.count++;
        if (isError) domainEntry.errors++;
        domainEntry.bytes += entry.responseSize ?? 0;
      } catch {
        // invalid URL, skip domain tracking
      }
    }

    return { totalRequests, totalErrors, totalBytes, byScript, byDomain };
  },

  clear(scriptId?: string): void {
    if (scriptId) {
      this._log = this._log.filter((e: NetLogEntry) => e.scriptId !== scriptId);
    } else {
      this._log = [];
    }
  }
};
