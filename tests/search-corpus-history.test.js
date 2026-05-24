// Tests covering the v3.13.x P2 "search/index improvements + editor search
// history" slice. Two surfaces:
//   1. Dashboard search corpus widening — name/desc/author plus URL
//      patterns, tags, grants, source URLs, ISO last-run date are all
//      matched by a plain substring search.
//   2. Editor find-widget history persistence — sandbox forwards
//      searchString changes via postMessage('find-search'); adapter
//      persists FIFO 20 in chrome.storage.local under editorFindHistory.
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardCode = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const adapterCode = readFileSync(resolve(process.cwd(), 'pages/monaco-adapter.js'), 'utf8');
const sandboxCode = readFileSync(resolve(process.cwd(), 'pages/editor-sandbox.html'), 'utf8');

// Inline copy of buildScriptSearchCorpus so we can exercise its behavior in
// isolation without booting the dashboard module.
function buildScriptSearchCorpus(script) {
  if (!script) return '';
  const meta = script.metadata || {};
  const settings = script.settings || {};
  const parts = [];
  const push = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) { for (const item of value) push(item); return; }
    if (typeof value === 'object') { for (const item of Object.values(value)) push(item); return; }
    const str = String(value).trim();
    if (str) parts.push(str);
  };
  push(meta.name);
  push(meta.description);
  push(meta.author);
  push(meta.namespace);
  push(meta.version);
  push(meta.homepage);
  push(meta.supportURL);
  push(meta.updateURL);
  push(meta.downloadURL);
  push(meta.match);
  push(meta.include);
  push(meta.exclude);
  push(meta.grant);
  push(meta.tag);
  push(settings.userMatches);
  push(settings.userIncludes);
  push(settings.userExcludes);
  push(settings.tags);
  if (Number.isFinite(script.stats?.lastRun)) {
    try { push(new Date(script.stats.lastRun).toISOString().slice(0, 10)); } catch (_) {}
  }
  if (Number.isFinite(script.updatedAt)) {
    try { push(new Date(script.updatedAt).toISOString().slice(0, 10)); } catch (_) {}
  }
  return parts.join('\n').toLowerCase();
}

describe('buildScriptSearchCorpus', () => {
  it('includes match patterns so URL keywords match', () => {
    const script = {
      metadata: { name: 'Foo', match: ['https://api.example.com/*'] }
    };
    const corpus = buildScriptSearchCorpus(script);
    expect(corpus).toContain('api.example.com');
  });

  it('includes grants and tags', () => {
    const script = {
      metadata: {
        name: 'Foo',
        grant: ['GM_xmlhttpRequest', 'GM_setValue'],
        tag: ['util', 'qa']
      },
      settings: { tags: ['archive'] }
    };
    const corpus = buildScriptSearchCorpus(script);
    expect(corpus).toContain('gm_xmlhttprequest');
    expect(corpus).toContain('util');
    expect(corpus).toContain('archive');
  });

  it('includes source URL (downloadURL / updateURL)', () => {
    const script = {
      metadata: {
        name: 'Foo',
        downloadURL: 'https://greasyfork.org/scripts/12345/Foo.user.js',
        updateURL: 'https://openuserjs.org/install/me/Foo.meta.js'
      }
    };
    const corpus = buildScriptSearchCorpus(script);
    expect(corpus).toContain('greasyfork');
    expect(corpus).toContain('openuserjs');
  });

  it('includes user override patterns', () => {
    const script = {
      metadata: { name: 'Foo' },
      settings: {
        userMatches: ['https://internal.corp/*'],
        userExcludes: ['https://corp/auth/*']
      }
    };
    const corpus = buildScriptSearchCorpus(script);
    expect(corpus).toContain('internal.corp');
    expect(corpus).toContain('corp/auth');
  });

  it('includes ISO last-run date for date filtering', () => {
    const script = {
      metadata: { name: 'Foo' },
      stats: { lastRun: Date.UTC(2026, 4, 1) }, // 2026-05-01
      updatedAt: Date.UTC(2026, 4, 22)
    };
    const corpus = buildScriptSearchCorpus(script);
    expect(corpus).toContain('2026-05-01');
    expect(corpus).toContain('2026-05-22');
  });

  it('handles missing fields without throwing', () => {
    expect(buildScriptSearchCorpus(null)).toBe('');
    expect(buildScriptSearchCorpus({})).toBe('');
  });
});

describe('Dashboard search corpus source-of-truth', () => {
  it("calls buildScriptSearchCorpus inside getFilteredScripts", () => {
    expect(dashboardCode).toContain('const corpus = buildScriptSearchCorpus(s);');
  });

  it('uses corpus for substring matching', () => {
    expect(dashboardCode).toContain('matchesSearch = corpus.includes(effectiveSearch);');
  });

  it('uses corpus for regex matching', () => {
    expect(dashboardCode).toContain('matchesSearch = regexFilter.test(corpus);');
  });
});

describe('Editor find-widget search history', () => {
  it('sandbox listens for find-state changes and posts find-search messages', () => {
    expect(sandboxCode).toContain("editor.contrib.findController");
    expect(sandboxCode).toContain("findState.onFindReplaceStateChange");
    expect(sandboxCode).toContain("type: 'find-search'");
  });

  it('sandbox handles prime-find messages by seeding searchString', () => {
    expect(sandboxCode).toContain("'prime-find'");
    expect(sandboxCode).toContain("state.change({ searchString: String(msg.history[0]) }, false)");
  });

  it('adapter persists FIFO-20 history to chrome.storage.local', () => {
    expect(adapterCode).toContain("FIND_HISTORY_KEY = 'editorFindHistory'");
    expect(adapterCode).toContain('FIND_HISTORY_MAX = 20');
    expect(adapterCode).toContain('recordFindTerm');
    expect(adapterCode).toContain('chrome.storage.local.set({ [FIND_HISTORY_KEY]: dedup })');
  });

  it('adapter primes the sandbox on ready', () => {
    expect(adapterCode).toContain('primeEditorFindHistory()');
    expect(adapterCode).toContain("sendToFrame({ type: 'prime-find', history });");
  });

  it('adapter dedupes repeated terms before persisting', () => {
    expect(adapterCode).toContain('const dedup = [trimmed, ...list.filter(v => v !== trimmed)].slice(0, FIND_HISTORY_MAX);');
  });
});

// Functional test of the FIFO/dedup logic by re-implementing it against the
// shared chrome.storage.local mock.
describe('FIFO dedup behaviour', () => {
  const FIND_HISTORY_KEY = 'editorFindHistory';
  const FIND_HISTORY_MAX = 20;
  async function recordFindTerm(value) {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const data = await chrome.storage.local.get(FIND_HISTORY_KEY);
    const arr = Array.isArray(data?.[FIND_HISTORY_KEY]) ? data[FIND_HISTORY_KEY] : [];
    const dedup = [trimmed, ...arr.filter(v => v !== trimmed)].slice(0, FIND_HISTORY_MAX);
    await chrome.storage.local.set({ [FIND_HISTORY_KEY]: dedup });
  }
  beforeEach(() => { globalThis.__resetStorageMock(); });

  it('keeps newest first', async () => {
    await recordFindTerm('foo');
    await recordFindTerm('bar');
    const data = await chrome.storage.local.get(FIND_HISTORY_KEY);
    expect(data[FIND_HISTORY_KEY]).toEqual(['bar', 'foo']);
  });

  it('dedupes repeats but lifts them to the top', async () => {
    await recordFindTerm('foo');
    await recordFindTerm('bar');
    await recordFindTerm('foo');
    const data = await chrome.storage.local.get(FIND_HISTORY_KEY);
    expect(data[FIND_HISTORY_KEY]).toEqual(['foo', 'bar']);
  });

  it('caps at FIND_HISTORY_MAX entries', async () => {
    for (let i = 0; i < FIND_HISTORY_MAX + 5; i++) await recordFindTerm(`term-${i}`);
    const data = await chrome.storage.local.get(FIND_HISTORY_KEY);
    expect(data[FIND_HISTORY_KEY]).toHaveLength(FIND_HISTORY_MAX);
    // Newest first means term-(MAX+4) leads.
    expect(data[FIND_HISTORY_KEY][0]).toBe(`term-${FIND_HISTORY_MAX + 4}`);
  });

  it('ignores empty / whitespace terms', async () => {
    await recordFindTerm('');
    await recordFindTerm('   ');
    const data = await chrome.storage.local.get(FIND_HISTORY_KEY);
    expect(data[FIND_HISTORY_KEY] || []).toEqual([]);
  });
});
