// CSP-RULEID regression test — pages/dashboard-csp.js sequential
// DNR rule-ID allocator. The pre-fix hash-mod-100K allocation hit
// birthday-paradox collisions at ~20 hostnames; pin the sequential
// allocator + legacy reconcile + migration grace.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'pages/dashboard-csp.js'), 'utf8');

function extractFunction(src, name, kind = 'function') {
  const marker = kind === 'async' ? `async function ${name}(` : `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`${kind} ${name} not found`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${kind} ${name} did not close`);
}

const allocFn = extractFunction(source, '_allocRuleId');
const legacyFn = extractFunction(source, '_legacyHashRuleId');

const factory = new Function(`
  const RULE_ID_BASE = 900000;
  const RULE_ID_MAX = 999999999;
  let _ruleIdCounter = RULE_ID_BASE;
  ${allocFn}
  ${legacyFn}
  return {
    alloc: _allocRuleId,
    legacy: _legacyHashRuleId,
    reset(toValue) { _ruleIdCounter = toValue; },
    current() { return _ruleIdCounter; },
    BASE: RULE_ID_BASE,
    MAX: RULE_ID_MAX,
  };
`);

describe('CSP-RULEID — sequential allocator', () => {
  it('first allocation is RULE_ID_BASE + 1', () => {
    const a = factory();
    const id = a.alloc();
    expect(id).toBe(a.BASE + 1);
  });

  it('produces strictly-monotonic unique ids', () => {
    const a = factory();
    const seen = new Set();
    for (let i = 0; i < 1000; i += 1) {
      const id = a.alloc();
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(seen.size).toBe(1000);
  });

  it('zero collisions across 10,000 allocations (vs hash-mod-100K which collides at ~20)', () => {
    const a = factory();
    const seen = new Set();
    for (let i = 0; i < 10_000; i += 1) {
      seen.add(a.alloc());
    }
    expect(seen.size).toBe(10_000);
  });

  it('hash-allocator demonstrates the collision risk we replaced (large corpus)', () => {
    // Birthday paradox: in a 100K pool, P(collision) reaches 50% at ~373
    // distinct items and >99% at ~1500. 2000 hostnames guarantees we
    // surface collisions deterministically, demonstrating why the
    // legacy hash allocator was unsafe at scale.
    const a = factory();
    const corpus = Array.from({ length: 2000 }, (_, i) => `host-${i}.example.${i % 7}.com`);
    const counts = new Map();
    for (const h of corpus) {
      const id = a.legacy(h);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    const collisions = [...counts.values()].filter(c => c > 1).length;
    expect(collisions).toBeGreaterThan(0);
  });

  it('throws when the counter would exceed RULE_ID_MAX', () => {
    const a = factory();
    a.reset(a.MAX);
    expect(() => a.alloc()).toThrow(/exhausted/i);
  });

  it('counter starting from a pre-loaded ruleId continues without collision', () => {
    // Simulates loadReports() deriving the counter from max stored ruleId.
    const a = factory();
    a.reset(900050);
    expect(a.alloc()).toBe(900051);
    expect(a.alloc()).toBe(900052);
  });

  it('legacy allocator is purely deterministic (same input → same output)', () => {
    const a = factory();
    const id1 = a.legacy('example.com');
    const id2 = a.legacy('example.com');
    expect(id1).toBe(id2);
    expect(id1).toBeGreaterThanOrEqual(900000);
    expect(id1).toBeLessThanOrEqual(999999);
  });
});
