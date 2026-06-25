// LR-003 regression test — offscreen.js AST detectors for indirect-eval,
// dynamic-property-call on globals, and Function-ctor via .apply/.call/.bind.
//
// Unit-tests the predicate functions in offscreen.js RISK_PATTERNS by
// extracting them and feeding hand-built AST nodes. We don't load acorn
// here — the test scope is the predicate logic itself, not the parser.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'offscreen.js'), 'utf8');

// Extract the RISK_PATTERNS array + the isIdent/isMember helpers into a
// fresh closure we can probe. We re-derive only what we need; the wider
// analyzer plumbing isn't needed for predicate tests.
function extractBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`Marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`End marker not found: ${endMarker}`);
  return src.slice(start, end);
}

const patternsArray = extractBetween(source, 'const RISK_PATTERNS = [', '\nfunction handleAnalyze');
const helpers = extractBetween(source, 'function isIdent(node, name)', '\nfunction handleAnalyze');

const _body = `${helpers}\n${patternsArray}\nreturn RISK_PATTERNS;`;
let RISK_PATTERNS;
try { const vm = require('node:vm'); RISK_PATTERNS = vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'offscreen.js') })(); } catch { RISK_PATTERNS = new Function(_body)(); }

function findPattern(id) {
  const p = RISK_PATTERNS.find(x => x.id === id);
  if (!p) throw new Error(`Pattern not found: ${id}`);
  return p;
}

// Tiny AST node builders so tests don't depend on acorn.
const id = (name) => ({ type: 'Identifier', name });
const lit = (value) => ({ type: 'Literal', value });
const mem = (object, property, computed = false) =>
  ({ type: 'MemberExpression', object, property, computed });
const call = (callee, args = []) =>
  ({ type: 'CallExpression', callee, arguments: args });
const seq = (...expressions) => ({ type: 'SequenceExpression', expressions });
const newExpr = (callee, args = []) => ({ type: 'NewExpression', callee, arguments: args });

// ── indirect-eval ─────────────────────────────────────────────────────────
describe('LR-003 — indirect-eval AST detector', () => {
  const detector = findPattern('indirect-eval');

  it('matches (0, eval)(x)', () => {
    // SequenceExpression [0, eval] → CallExpression with that as callee
    const node = call(seq(lit(0), id('eval')), [id('x')]);
    expect(detector.match(node)).toBe(true);
  });

  it('matches (foo, bar, eval)(x) — eval is the LAST in the sequence', () => {
    const node = call(seq(id('foo'), id('bar'), id('eval')), [id('x')]);
    expect(detector.match(node)).toBe(true);
  });

  it('does NOT match (eval, 0)(x) — eval is not the last element', () => {
    const node = call(seq(id('eval'), lit(0)), [id('x')]);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match plain eval(x) — handled by the literal eval detector', () => {
    const node = call(id('eval'), [id('x')]);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match (0, foo)(x) — no eval in the sequence', () => {
    const node = call(seq(lit(0), id('foo')), [id('x')]);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match (0, eval) standalone (no call)', () => {
    // SequenceExpression alone, not wrapped in a call
    const node = seq(lit(0), id('eval'));
    expect(detector.match(node)).toBe(false);
  });

  it('returns false on malformed AST without throwing', () => {
    expect(detector.match(null)).toBe(false);
    expect(detector.match({})).toBe(false);
    expect(detector.match({ type: 'CallExpression' })).toBe(false);
    expect(detector.match({ type: 'CallExpression', callee: { type: 'SequenceExpression' } })).toBe(false);
  });
});

// ── dynamic-property-call ─────────────────────────────────────────────────
describe('LR-003 — dynamic-property-call AST detector', () => {
  const detector = findPattern('dynamic-property-call');

  it('matches window[<computed identifier>](args)', () => {
    // window[x](args) where x is an Identifier (not a Literal)
    const node = call(mem(id('window'), id('x'), true), [id('a')]);
    expect(detector.match(node)).toBe(true);
  });

  it('matches globalThis[<computed identifier>](args)', () => {
    const node = call(mem(id('globalThis'), id('x'), true), []);
    expect(detector.match(node)).toBe(true);
  });

  it('matches self[<computed>] and unsafeWindow[<computed>]', () => {
    expect(detector.match(call(mem(id('self'), id('x'), true)))).toBe(true);
    expect(detector.match(call(mem(id('unsafeWindow'), id('x'), true)))).toBe(true);
  });

  it('does NOT match window["eval"](x) — static string literal covered elsewhere', () => {
    const node = call(mem(id('window'), lit('eval'), true), []);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match window.eval(x) — non-computed access (literal eval detector covers)', () => {
    const node = call(mem(id('window'), id('eval'), false), []);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match obj[handlerName](e) — receiver is not a global', () => {
    const node = call(mem(id('obj'), id('handlerName'), true), [id('e')]);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match window[<computed>] as a READ (no following call)', () => {
    // MemberExpression without CallExpression wrapper
    const node = mem(id('window'), id('x'), true);
    expect(detector.match(node)).toBe(false);
  });

  it('returns false on malformed AST', () => {
    expect(detector.match(null)).toBe(false);
    expect(detector.match({ type: 'CallExpression' })).toBe(false);
    expect(detector.match({ type: 'CallExpression', callee: { type: 'MemberExpression' } })).toBe(false);
  });
});

// ── function-ctor-apply ───────────────────────────────────────────────────
describe('LR-003 — function-ctor-apply AST detector', () => {
  const detector = findPattern('function-ctor-apply');

  it('matches Function.apply(null, ["return x"])', () => {
    const node = call(mem(id('Function'), id('apply')), [lit(null), { type: 'ArrayExpression' }]);
    expect(detector.match(node)).toBe(true);
  });

  it('matches Function.call(thisArg, body)', () => {
    const node = call(mem(id('Function'), id('call')), [lit(null), lit('body')]);
    expect(detector.match(node)).toBe(true);
  });

  it('matches Function.bind(thisArg)', () => {
    const node = call(mem(id('Function'), id('bind')), [lit(null)]);
    expect(detector.match(node)).toBe(true);
  });

  it('matches Function.prototype.apply(...)', () => {
    // Function.prototype.apply(...)  → MemberExpression with .object as
    // MemberExpression(Function, prototype) and .property as 'apply'
    const node = call(mem(mem(id('Function'), id('prototype')), id('apply')), []);
    expect(detector.match(node)).toBe(true);
  });

  it('matches Function.prototype.constructor.call(null, body)', () => {
    const node = call(
      mem(mem(mem(id('Function'), id('prototype')), id('constructor')), id('call')),
      [lit(null), lit('body')]
    );
    expect(detector.match(node)).toBe(true);
  });

  it('does NOT match Array.prototype.map.call(arr, fn) — different receiver', () => {
    const node = call(mem(mem(mem(id('Array'), id('prototype')), id('map')), id('call')), []);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match foo.apply(bar) — receiver is not Function', () => {
    const node = call(mem(id('foo'), id('apply')), [id('bar')]);
    expect(detector.match(node)).toBe(false);
  });

  it('does NOT match new Function() — handled by the function-ctor detector', () => {
    const node = newExpr(id('Function'), [lit('return x')]);
    expect(detector.match(node)).toBe(false);
  });

  it('returns false on malformed AST', () => {
    expect(detector.match(null)).toBe(false);
    expect(detector.match({ type: 'CallExpression', callee: null })).toBe(false);
    expect(detector.match({ type: 'CallExpression', callee: { type: 'Identifier', name: 'foo' } })).toBe(false);
  });
});

// ── pattern array integrity ───────────────────────────────────────────────
describe('LR-003 — pattern array integrity', () => {
  it('exports the 3 new detectors with required fields', () => {
    for (const id of ['indirect-eval', 'dynamic-property-call', 'function-ctor-apply']) {
      const p = findPattern(id);
      expect(p.label).toBeTypeOf('string');
      expect(p.risk).toBeTypeOf('number');
      expect(p.risk).toBeGreaterThan(0);
      expect(p.category).toMatch(/^(execution|obfuscation)$/);
      expect(p.desc).toBeTypeOf('string');
      expect(p.match).toBeTypeOf('function');
    }
  });

  it('all pattern ids are unique', () => {
    const ids = RISK_PATTERNS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
