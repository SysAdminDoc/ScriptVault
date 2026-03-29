import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load the actual NetworkLog source
const code = readFileSync(resolve(__dirname, '../bg/netlog.js'), 'utf8');

function createNetworkLog() {
  const fn = new Function(code + '\nreturn NetworkLog;');
  return fn();
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

    it('assigns id and timestamp', () => {
      log.add({ url: 'https://example.com' });
      const entry = log._log[0];
      expect(entry.id).toBeTruthy();
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('stores entries in insertion order (oldest first)', () => {
      log.add({ url: 'https://first.com', scriptId: 's1' });
      log.add({ url: 'https://second.com', scriptId: 's2' });
      expect(log._log[0].url).toBe('https://first.com');
      expect(log._log[1].url).toBe('https://second.com');
    });

    it('enforces max entries', () => {
      log._maxEntries = 5;
      for (let i = 0; i < 10; i++) {
        log.add({ url: `https://example.com/${i}`, scriptId: 's1' });
      }
      expect(log._log).toHaveLength(5);
      // Oldest entries trimmed — newest 5 remain
      expect(log._log[0].url).toBe('https://example.com/5');
    });
  });

  // ── getAll() ───────────────────────────────────────────────────────────

  describe('getAll', () => {
    beforeEach(() => {
      log.add({ url: 'https://api.example.com/data', method: 'GET', scriptId: 's1', status: 200, responseSize: 500 });
      log.add({ url: 'https://cdn.example.com/lib.js', method: 'GET', scriptId: 's2', status: 200, responseSize: 1000 });
      log.add({ url: 'https://api.evil.com/track', method: 'POST', scriptId: 's1', error: 'Network error' });
      log.add({ url: 'https://api.example.com/update', method: 'PUT', scriptId: 's1', status: 500, responseSize: 100 });
    });

    it('returns all entries (newest first)', () => {
      const all = log.getAll();
      expect(all).toHaveLength(4);
      // getAll reverses: newest first
      expect(all[0].url).toContain('update');
    });

    it('filters by scriptId', () => {
      const s1 = log.getAll({ scriptId: 's1' });
      expect(s1).toHaveLength(3);
    });

    it('filters by method', () => {
      const posts = log.getAll({ method: 'POST' });
      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain('evil.com');
    });

    it('filters by domain', () => {
      const example = log.getAll({ domain: 'example.com' });
      expect(example).toHaveLength(3);
    });

    it('filters errors', () => {
      const errors = log.getAll({ status: 'error' });
      expect(errors).toHaveLength(2); // network error + 500
    });

    it('filters success', () => {
      const ok = log.getAll({ status: 'success' });
      expect(ok).toHaveLength(2);
    });

    it('respects limit', () => {
      const limited = log.getAll({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('default limit is 100', () => {
      for (let i = 0; i < 150; i++) {
        log.add({ url: `https://a.com/${i}`, scriptId: 'x' });
      }
      const all = log.getAll();
      expect(all).toHaveLength(100);
    });
  });

  // ── getStats() ─────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('aggregates totals', () => {
      log.add({ url: 'https://a.com', scriptId: 's1', status: 200, responseSize: 100, scriptName: 'Script1' });
      log.add({ url: 'https://b.com', scriptId: 's2', error: 'fail', responseSize: 0 });
      const stats = log.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalErrors).toBe(1);
      expect(stats.totalBytes).toBe(100);
    });

    it('groups by script', () => {
      log.add({ url: 'https://a.com', scriptId: 's1', status: 200, responseSize: 50, scriptName: 'A' });
      log.add({ url: 'https://b.com', scriptId: 's1', status: 200, responseSize: 50, scriptName: 'A' });
      log.add({ url: 'https://c.com', scriptId: 's2', status: 200, responseSize: 100 });
      const stats = log.getStats();
      expect(stats.byScript.s1.count).toBe(2);
      expect(stats.byScript.s1.bytes).toBe(100);
      expect(stats.byScript.s2.count).toBe(1);
    });

    it('groups by domain', () => {
      log.add({ url: 'https://api.example.com/1', scriptId: 's1', status: 200 });
      log.add({ url: 'https://api.example.com/2', scriptId: 's1', status: 200 });
      log.add({ url: 'https://other.com/x', scriptId: 's1', status: 200 });
      const stats = log.getStats();
      expect(stats.byDomain['api.example.com'].count).toBe(2);
      expect(stats.byDomain['other.com'].count).toBe(1);
    });

    it('uses unified isError for stats (error field OR status >= 400)', () => {
      log.add({ url: 'https://a.com', scriptId: 's1', status: 500, scriptName: 'X' });
      log.add({ url: 'https://b.com', scriptId: 's1', error: 'timeout', scriptName: 'X' });
      const stats = log.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.byScript.s1.errors).toBe(2);
    });
  });

  // ── clear() ────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('clears all entries', () => {
      log.add({ url: 'https://a.com', scriptId: 's1' });
      log.add({ url: 'https://b.com', scriptId: 's2' });
      log.clear();
      expect(log._log).toHaveLength(0);
    });

    it('clears only specific script', () => {
      log.add({ url: 'https://a.com', scriptId: 's1' });
      log.add({ url: 'https://b.com', scriptId: 's2' });
      log.clear('s1');
      expect(log._log).toHaveLength(1);
      expect(log._log[0].scriptId).toBe('s2');
    });
  });
});
