import { describe, it, expect, beforeEach } from 'vitest';

// Re-implement NetworkLog for testing (extracted from bg/netlog.js)

function createNetworkLog() {
  return {
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

        const sid = entry.scriptId || 'unknown';
        if (!byScript[sid]) byScript[sid] = { count: 0, errors: 0, bytes: 0, scriptName: entry.scriptName || sid };
        byScript[sid].count++;
        if (entry.error) byScript[sid].errors++;
        byScript[sid].bytes += entry.responseSize || 0;

        try {
          const domain = new URL(entry.url).hostname;
          if (!byDomain[domain]) byDomain[domain] = { count: 0, errors: 0, bytes: 0 };
          byDomain[domain].count++;
          if (entry.error) byDomain[domain].errors++;
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
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('NetworkLog', () => {
  let log;

  beforeEach(() => {
    log = createNetworkLog();
  });

  // ── add() ─────────────────────────────────────────────────────────────

  describe('add', () => {
    it('adds an entry to the log', () => {
      log.add({ url: 'https://example.com', method: 'GET', scriptId: 's1' });
      expect(log._log).toHaveLength(1);
    });

    it('prepends entries (newest first)', () => {
      log.add({ url: 'https://first.com', scriptId: 's1' });
      log.add({ url: 'https://second.com', scriptId: 's1' });
      expect(log._log[0].url).toBe('https://second.com');
      expect(log._log[1].url).toBe('https://first.com');
    });

    it('auto-generates id and timestamp', () => {
      log.add({ url: 'https://example.com' });
      expect(log._log[0].id).toBeDefined();
      expect(typeof log._log[0].id).toBe('string');
      expect(log._log[0].timestamp).toBeGreaterThan(0);
    });

    it('preserves entry properties', () => {
      log.add({ url: 'https://example.com', method: 'POST', scriptId: 'abc', responseSize: 512 });
      const entry = log._log[0];
      expect(entry.url).toBe('https://example.com');
      expect(entry.method).toBe('POST');
      expect(entry.scriptId).toBe('abc');
      expect(entry.responseSize).toBe(512);
    });

    it('enforces max entries limit', () => {
      const nl = createNetworkLog();
      nl._maxEntries = 5;
      for (let i = 0; i < 10; i++) {
        nl.add({ url: `https://example.com/${i}` });
      }
      expect(nl._log).toHaveLength(5);
      // Newest entries should be kept
      expect(nl._log[0].url).toBe('https://example.com/9');
    });
  });

  // ── getAll() ──────────────────────────────────────────────────────────

  describe('getAll', () => {
    beforeEach(() => {
      log.add({ url: 'https://api.example.com/data', method: 'GET', scriptId: 's1', status: 200 });
      log.add({ url: 'https://api.example.com/post', method: 'POST', scriptId: 's1', status: 201 });
      log.add({ url: 'https://cdn.other.com/lib.js', method: 'GET', scriptId: 's2', status: 200 });
      log.add({ url: 'https://api.example.com/fail', method: 'GET', scriptId: 's2', status: 500 });
      log.add({ url: 'https://api.example.com/err', method: 'GET', scriptId: 's1', error: 'timeout' });
    });

    it('returns all entries with no filter', () => {
      expect(log.getAll()).toHaveLength(5);
    });

    it('filters by scriptId', () => {
      const results = log.getAll({ scriptId: 's1' });
      expect(results).toHaveLength(3);
      expect(results.every(e => e.scriptId === 's1')).toBe(true);
    });

    it('filters by method (case-insensitive)', () => {
      const results = log.getAll({ method: 'post' });
      expect(results).toHaveLength(1);
      expect(results[0].method).toBe('POST');
    });

    it('filters by domain', () => {
      const results = log.getAll({ domain: 'cdn.other.com' });
      expect(results).toHaveLength(1);
      expect(results[0].url).toContain('cdn.other.com');
    });

    it('filters by domain partial match', () => {
      const results = log.getAll({ domain: 'example.com' });
      expect(results).toHaveLength(4);
    });

    it('filters by status "error"', () => {
      const results = log.getAll({ status: 'error' });
      expect(results).toHaveLength(2); // status 500 + error:'timeout'
    });

    it('filters by status "success"', () => {
      const results = log.getAll({ status: 'success' });
      expect(results).toHaveLength(3); // status 200, 201, 200
    });

    it('combines filters (scriptId + method)', () => {
      const results = log.getAll({ scriptId: 's1', method: 'GET' });
      expect(results).toHaveLength(2);
    });

    it('respects limit parameter', () => {
      const results = log.getAll({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('defaults limit to 100', () => {
      // add 150 entries
      for (let i = 0; i < 150; i++) {
        log.add({ url: `https://example.com/${i}`, scriptId: 'bulk' });
      }
      const results = log.getAll({ scriptId: 'bulk' });
      expect(results).toHaveLength(100);
    });

    it('returns empty array for no matches', () => {
      expect(log.getAll({ scriptId: 'nonexistent' })).toEqual([]);
    });

    it('handles entries with invalid URLs in domain filter', () => {
      log.add({ url: 'not-a-url', scriptId: 's3' });
      const results = log.getAll({ domain: 'example.com' });
      // Should not crash and should not include the bad URL
      expect(results.every(e => e.url.includes('example.com'))).toBe(true);
    });
  });

  // ── getStats() ────────────────────────────────────────────────────────

  describe('getStats', () => {
    beforeEach(() => {
      log.add({ url: 'https://api.example.com/a', scriptId: 's1', scriptName: 'Script One', status: 200, responseSize: 1024 });
      log.add({ url: 'https://api.example.com/b', scriptId: 's1', scriptName: 'Script One', status: 200, responseSize: 2048 });
      log.add({ url: 'https://cdn.other.com/c', scriptId: 's2', scriptName: 'Script Two', error: 'fail', responseSize: 0 });
    });

    it('counts total requests', () => {
      expect(log.getStats().totalRequests).toBe(3);
    });

    it('counts total errors', () => {
      expect(log.getStats().totalErrors).toBe(1);
    });

    it('sums total bytes', () => {
      expect(log.getStats().totalBytes).toBe(3072);
    });

    it('groups by script', () => {
      const stats = log.getStats();
      expect(stats.byScript.s1.count).toBe(2);
      expect(stats.byScript.s1.bytes).toBe(3072);
      expect(stats.byScript.s1.scriptName).toBe('Script One');
      expect(stats.byScript.s2.count).toBe(1);
      expect(stats.byScript.s2.errors).toBe(1);
    });

    it('groups by domain', () => {
      const stats = log.getStats();
      expect(stats.byDomain['api.example.com'].count).toBe(2);
      expect(stats.byDomain['cdn.other.com'].count).toBe(1);
    });

    it('returns zero stats for empty log', () => {
      const empty = createNetworkLog();
      const stats = empty.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalBytes).toBe(0);
    });

    it('handles entries with no scriptId as "unknown"', () => {
      log.add({ url: 'https://example.com/x', status: 200 });
      const stats = log.getStats();
      expect(stats.byScript.unknown).toBeDefined();
      expect(stats.byScript.unknown.count).toBe(1);
    });

    it('treats status >= 400 as error in stats', () => {
      log.add({ url: 'https://example.com/y', scriptId: 's3', status: 404, responseSize: 100 });
      const stats = log.getStats();
      expect(stats.totalErrors).toBe(2); // original 1 + new 404
    });
  });

  // ── clear() ───────────────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(() => {
      log.add({ url: 'https://a.com', scriptId: 's1' });
      log.add({ url: 'https://b.com', scriptId: 's2' });
      log.add({ url: 'https://c.com', scriptId: 's1' });
    });

    it('clears all entries when no scriptId given', () => {
      log.clear();
      expect(log._log).toHaveLength(0);
    });

    it('clears only entries for a specific scriptId', () => {
      log.clear('s1');
      expect(log._log).toHaveLength(1);
      expect(log._log[0].scriptId).toBe('s2');
    });

    it('does nothing if scriptId has no entries', () => {
      log.clear('nonexistent');
      expect(log._log).toHaveLength(3);
    });
  });
});
