import { describe, it, expect } from 'vitest';
import { parseUserscript } from '../src/background/parser.ts';
import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

// Phase 39.11 — TM #2784 @match-top / @exclude-top top-level-origin gates.
//
// These tests are the canonical regression suite for the directive. They
// import directly from `src/background/parser.ts` and
// `src/background/wrapper-builder.ts` (NOT the in-test re-implementations
// in `parser.test.js`), so they would fail on TS-mirror drift — exactly
// the bug class that motivated their introduction.

describe('Phase 39.11 — parser: @match-top / @exclude-top', () => {
  it('collects @match-top into meta.matchTop', () => {
    const code = [
      '// ==UserScript==',
      '// @name TopGated',
      '// @match-top https://example.com/*',
      '// @match-top https://app.example.com/*',
      '// ==/UserScript==',
      '',
    ].join('\n');
    const { meta } = parseUserscript(code);
    expect(meta.matchTop).toEqual([
      'https://example.com/*',
      'https://app.example.com/*',
    ]);
    expect(meta.excludeTop).toEqual([]);
  });

  it('collects @exclude-top into meta.excludeTop', () => {
    const code = [
      '// ==UserScript==',
      '// @name TopBanned',
      '// @match https://*/*',
      '// @exclude-top https://admin.example.com/*',
      '// ==/UserScript==',
      '',
    ].join('\n');
    const { meta } = parseUserscript(code);
    expect(meta.excludeTop).toEqual(['https://admin.example.com/*']);
    expect(meta.matchTop).toEqual([]);
  });

  it('accepts the canonical camelCase form (matchTop / excludeTop) too', () => {
    const code = [
      '// ==UserScript==',
      '// @name CamelCase',
      '// @matchTop https://camel.example/*',
      '// @excludeTop https://snake.example/*',
      '// ==/UserScript==',
      '',
    ].join('\n');
    const { meta } = parseUserscript(code);
    expect(meta.matchTop).toEqual(['https://camel.example/*']);
    expect(meta.excludeTop).toEqual(['https://snake.example/*']);
  });

  it('supports comma-separated convenience syntax (Phase 36.6 parity)', () => {
    const code = [
      '// ==UserScript==',
      '// @name Multi',
      '// @match-top https://a.com/*,https://b.com/*,https://c.com/*',
      '// ==/UserScript==',
      '',
    ].join('\n');
    const { meta } = parseUserscript(code);
    expect(meta.matchTop).toEqual([
      'https://a.com/*',
      'https://b.com/*',
      'https://c.com/*',
    ]);
  });

  it('defaults to empty arrays when directives are absent', () => {
    const code = [
      '// ==UserScript==',
      '// @name Bare',
      '// @match https://example.com/*',
      '// ==/UserScript==',
      '',
    ].join('\n');
    const { meta } = parseUserscript(code);
    expect(meta.matchTop).toEqual([]);
    expect(meta.excludeTop).toEqual([]);
  });
});

describe('Phase 39.11 — wrapper-builder: top-origin guard', () => {
  function makeScript(matchTop, excludeTop) {
    return {
      id: 'phase-39-11-test',
      code: '// ==UserScript==\n// @name T\n// ==/UserScript==\n',
      enabled: true,
      position: 0,
      meta: {
        name: 'T',
        namespace: 'sv',
        version: '1',
        description: '',
        author: '',
        icon: '',
        icon64: '',
        homepage: '',
        homepageURL: '',
        website: '',
        source: '',
        updateURL: '',
        downloadURL: '',
        supportURL: '',
        license: '',
        copyright: '',
        contributionURL: '',
        match: [],
        include: [],
        exclude: [],
        excludeMatch: [],
        matchTop: matchTop,
        excludeTop: excludeTop,
        'run-at': 'document-idle',
        'inject-into': 'auto',
        noframes: false,
        unwrap: false,
        sandbox: '',
        'run-in': '',
        grant: [],
        require: [],
        resource: {},
        connect: [],
        'top-level-await': false,
        webRequest: null,
        priority: 0,
        weight: 0,
        antifeature: [],
        tag: [],
        compatible: [],
        incompatible: [],
      },
      createdAt: 0,
      updatedAt: 0,
    };
  }

  it('omits the guard block when both arrays are empty', () => {
    const wrapped = buildWrappedScript(makeScript([], []), [], 'test-ext-id', []);
    expect(wrapped).not.toContain('@match-top / @exclude-top Guard');
  });

  it('emits the guard when matchTop is non-empty', () => {
    const wrapped = buildWrappedScript(
      makeScript(['https://example.com/*'], []),
      [],
      'test-ext-id',
      [],
    );
    expect(wrapped).toContain('@match-top / @exclude-top Guard (Phase 39.11)');
    expect(wrapped).toContain('__matchTopPatterns');
    expect(wrapped).not.toContain('__excludeTopPatterns');
    expect(wrapped).toContain('https://example.com/*');
  });

  it('emits the guard when excludeTop is non-empty', () => {
    const wrapped = buildWrappedScript(
      makeScript([], ['https://admin.example/*']),
      [],
      'test-ext-id',
      [],
    );
    expect(wrapped).toContain('@match-top / @exclude-top Guard (Phase 39.11)');
    expect(wrapped).toContain('__excludeTopPatterns');
    expect(wrapped).not.toContain('__matchTopPatterns');
    expect(wrapped).toContain('https://admin.example/*');
  });

  it('emits both arrays when both are non-empty', () => {
    const wrapped = buildWrappedScript(
      makeScript(['https://a.com/*'], ['https://b.com/*']),
      [],
      'test-ext-id',
      [],
    );
    expect(wrapped).toContain('__matchTopPatterns');
    expect(wrapped).toContain('__excludeTopPatterns');
  });

  it('compiles a regex literal pattern into RegExp form in the guard', () => {
    const wrapped = buildWrappedScript(
      makeScript(['/example\\.com\\/(a|b)/i'], []),
      [],
      'test-ext-id',
      [],
    );
    expect(wrapped).toContain('new RegExp');
    expect(wrapped).toContain('example\\\\.com');
  });

  it('emits a defensive bail when top URL is unreadable (cross-origin)', () => {
    const wrapped = buildWrappedScript(
      makeScript(['https://example.com/*'], []),
      [],
      'test-ext-id',
      [],
    );
    // The guard treats opaque top frames as "no match" for match-top.
    expect(wrapped).toContain('Cross-origin top → cannot verify match-top → bail');
  });
});
