// CI-friendly large-library perf gate. Runs the same shape as
// scripts/smoke-large-library.mjs at 1k entries and asserts that the
// authoritative MatchSet stays well inside the documented thresholds. The
// 10k pass lives in the standalone smoke script (npm run smoke:large-library)
// to keep this suite quick.
import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { MatchSet } from '../src/background/url-matcher.ts';

function generateScripts(count, { seed = 1 } = {}) {
  const hostnames = [
    'example.com', 'github.com', 'reddit.com', 'twitter.com', 'youtube.com',
    'wikipedia.org', 'amazon.com', 'stackoverflow.com', 'mozilla.org',
    'developer.mozilla.org', 'news.ycombinator.com', 'medium.com',
    'cloudflare.com', 'apple.com', 'microsoft.com'
  ];
  let rngState = seed;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };
  const scripts = [];
  for (let i = 0; i < count; i++) {
    const r = rng();
    let match, include;
    if (r < 0.9) {
      const host = hostnames[Math.floor(rng() * hostnames.length)];
      match = [`https://${host}/*`];
    } else if (r < 0.95) {
      match = ['<all_urls>'];
    } else {
      include = ['/^https?:\\/\\/[a-z]+\\.example\\.org\\/.*$/'];
      match = [];
    }
    scripts.push({
      id: `script_perf_${i}`,
      enabled: i % 5 !== 0,
      code: `// generated ${i}`,
      meta: {
        name: `Perf Script ${String(i).padStart(5, '0')}`,
        namespace: `scriptvault/perf/${i}`,
        version: '1.0.0',
        match: match || [],
        include: include || [],
        exclude: [],
        grant: ['none'],
        require: [],
        resource: {},
        'run-at': 'document-idle'
      }
    });
  }
  return scripts;
}

const PROBE_URLS = [
  'https://example.com/path/page',
  'https://github.com/user/repo',
  'https://reddit.com/r/programming',
  'https://docs.github.com/api',
  'https://www.amazon.com/dp/B08L5VWVS5',
  'https://en.wikipedia.org/wiki/JavaScript',
  'https://stackoverflow.com/questions/123',
  'https://news.ycombinator.com/item?id=42',
  'https://api.cloudflare.com/v1',
  'https://random.example.org/anything',
  'https://www.unknownhost.test/',
  'about:blank'
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

describe('large library perf — 1k synthetic dataset', () => {
  const scripts = generateScripts(1000);

  it('builds a MatchSet in under 200 ms', () => {
    const t0 = performance.now();
    const ms = new MatchSet(scripts);
    const t1 = performance.now();
    expect(ms.size).toBe(1000);
    expect(t1 - t0).toBeLessThan(200);
  });

  it('keeps getCandidates p99 under 20 ms over a 120-call basket', () => {
    const ms = new MatchSet(scripts);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      for (const url of PROBE_URLS) {
        const t0 = performance.now();
        ms.getCandidates(url);
        const t1 = performance.now();
        samples.push(t1 - t0);
      }
    }
    const p99 = percentile(samples, 99);
    expect(samples.length).toBeGreaterThanOrEqual(120);
    expect(p99).toBeLessThan(20);
  });

  it('keeps getMatching p99 under 50 ms over a 120-call basket', () => {
    const ms = new MatchSet(scripts);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      for (const url of PROBE_URLS) {
        const t0 = performance.now();
        ms.getMatching(url);
        const t1 = performance.now();
        samples.push(t1 - t0);
      }
    }
    const p99 = percentile(samples, 99);
    expect(p99).toBeLessThan(50);
  });

  it('substring-searches all 1k scripts in under 50 ms', () => {
    const term = 'Perf Script 00500';
    const t0 = performance.now();
    let hits = 0;
    for (const s of scripts) {
      if ((s.meta.name || '').includes(term)) hits++;
    }
    const t1 = performance.now();
    expect(hits).toBe(1);
    expect(t1 - t0).toBeLessThan(50);
  });

  it('localeCompare-sorts 1k scripts in under 80 ms', () => {
    const copy = scripts.slice();
    const t0 = performance.now();
    copy.sort((a, b) => (a.meta.name || '').localeCompare(b.meta.name || ''));
    const t1 = performance.now();
    expect(copy[0].meta.name).toBe('Perf Script 00000');
    expect(t1 - t0).toBeLessThan(80);
  });
});
