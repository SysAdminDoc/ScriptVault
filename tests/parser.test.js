import { describe, it, expect } from 'vitest';
import { parseUserscript } from '../src/background/parser.ts';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeScript(headers, body = '') {
  const lines = Object.entries(headers).flatMap(([k, v]) => {
    if (Array.isArray(v)) return v.map(val => `// @${k}  ${val}`);
    return [`// @${k}  ${v}`];
  });
  return `// ==UserScript==\n${lines.join('\n')}\n// ==/UserScript==\n${body}`;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('parseUserscript', () => {
  it('returns error when no metadata block is present', () => {
    const result = parseUserscript('console.log("hello");');
    expect(result.error).toBeDefined();
    expect(result.error).toContain('No metadata block');
  });

  it('parses a minimal script with defaults', () => {
    const code = '// ==UserScript==\n// @name Test\n// ==/UserScript==\nconsole.log(1);';
    const result = parseUserscript(code);
    expect(result.error).toBeUndefined();
    expect(result.meta.name).toBe('Test');
    expect(result.meta.version).toBe('1.0.0');
    expect(result.meta.namespace).toBe('scriptvault');
    expect(result.meta['run-at']).toBe('document-idle');
  });

  it('returns original code in the result', () => {
    const code = '// ==UserScript==\n// @name X\n// ==/UserScript==\nalert(1);';
    const result = parseUserscript(code);
    expect(result.code).toBe(code);
  });

  it('returns the raw metaBlock string', () => {
    const code = '// ==UserScript==\n// @name X\n// ==/UserScript==\n';
    const result = parseUserscript(code);
    expect(result.metaBlock).toContain('==UserScript==');
    expect(result.metaBlock).toContain('==/UserScript==');
  });

  it('parses scalar string fields', () => {
    const code = makeScript({
      name: 'My Script',
      namespace: 'https://example.com',
      version: '2.5.0',
      description: 'Does stuff',
      author: 'Alice',
      license: 'MIT',
    });
    const { meta } = parseUserscript(code);
    expect(meta.name).toBe('My Script');
    expect(meta.namespace).toBe('https://example.com');
    expect(meta.version).toBe('2.5.0');
    expect(meta.description).toBe('Does stuff');
    expect(meta.author).toBe('Alice');
    expect(meta.license).toBe('MIT');
  });

  it('parses multiple @match directives into an array', () => {
    const code = makeScript({
      name: 'Multi Match',
      match: ['https://example.com/*', 'https://test.com/*'],
    });
    const { meta } = parseUserscript(code);
    expect(meta.match).toEqual(['https://example.com/*', 'https://test.com/*']);
  });

  it('parses multiple @grant directives', () => {
    const code = makeScript({
      name: 'Grants',
      grant: ['GM_xmlhttpRequest', 'GM_setValue'],
    });
    const { meta } = parseUserscript(code);
    expect(meta.grant).toEqual(['GM_xmlhttpRequest', 'GM_setValue']);
  });

  it('defaults grant to ["none"] when no @grant is specified', () => {
    const code = makeScript({ name: 'No Grant' });
    const { meta } = parseUserscript(code);
    expect(meta.grant).toEqual(['none']);
  });

  it('parses @noframes as boolean true', () => {
    const code = '// ==UserScript==\n// @name NF\n// @noframes\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.noframes).toBe(true);
  });

  it('defaults noframes to false', () => {
    const code = makeScript({ name: 'Framed' });
    const { meta } = parseUserscript(code);
    expect(meta.noframes).toBe(false);
  });

  it('parses @nodownload as boolean true', () => {
    const code = '// ==UserScript==\n// @name ND\n// @nodownload\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.nodownload).toBe(true);
  });

  it('leaves nodownload falsy by default', () => {
    const code = makeScript({ name: 'Downloadable' });
    const { meta } = parseUserscript(code);
    expect(meta.nodownload).toBeFalsy();
  });

  it('parses @delay as integer milliseconds', () => {
    const code = '// ==UserScript==\n// @name Delayed\n// @delay 500\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.delay).toBe(500);
  });

  it('@delay clamps negative values to 0', () => {
    const code = '// ==UserScript==\n// @name Delayed\n// @delay -100\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.delay).toBe(0);
  });

  it('parses @unwrap as boolean true', () => {
    const code = '// ==UserScript==\n// @name UW\n// @unwrap\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.unwrap).toBe(true);
  });

  it('parses @top-level-await as boolean true', () => {
    const code = '// ==UserScript==\n// @name TLA\n// @top-level-await\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta['top-level-await']).toBe(true);
  });

  it('parses @priority as integer', () => {
    const code = makeScript({ name: 'Pri', priority: '5' });
    const { meta } = parseUserscript(code);
    expect(meta.priority).toBe(5);
  });

  it('defaults priority to 0 for non-numeric values', () => {
    const code = makeScript({ name: 'Pri', priority: 'abc' });
    const { meta } = parseUserscript(code);
    expect(meta.priority).toBe(0);
  });

  // Phase 11.7 — @weight (Userscripts/Safari) ─────────────────────────────
  it('parses @weight as integer in 1..999 range', () => {
    const code = makeScript({ name: 'Wt', weight: '42' });
    const { meta } = parseUserscript(code);
    expect(meta.weight).toBe(42);
  });

  it('clamps @weight above 999 down to 999', () => {
    const code = makeScript({ name: 'Wt', weight: '99999' });
    const { meta } = parseUserscript(code);
    expect(meta.weight).toBe(999);
  });

  it('clamps @weight below 1 up to 1', () => {
    const code = makeScript({ name: 'Wt', weight: '0' });
    const { meta } = parseUserscript(code);
    expect(meta.weight).toBe(1);
    const code2 = makeScript({ name: 'Wt', weight: '-50' });
    const { meta: meta2 } = parseUserscript(code2);
    expect(meta2.weight).toBe(1);
  });

  it('leaves @weight at default 0 when not specified', () => {
    const code = makeScript({ name: 'NoWt' });
    const { meta } = parseUserscript(code);
    expect(meta.weight).toBe(0);
  });

  it('ignores non-numeric @weight values', () => {
    const code = makeScript({ name: 'Wt', weight: 'oops' });
    const { meta } = parseUserscript(code);
    // Non-numeric leaves the default 0 in place rather than clamping to 1.
    expect(meta.weight).toBe(0);
  });

  it('parses @resource with name and URL', () => {
    const code = makeScript({ name: 'Res', resource: 'css https://example.com/style.css' });
    const { meta } = parseUserscript(code);
    expect(meta.resource.css).toBe('https://example.com/style.css');
  });

  it('parses @exclude-match into excludeMatch array', () => {
    const code = '// ==UserScript==\n// @name EM\n// @exclude-match https://ads.example.com/*\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.excludeMatch).toEqual(['https://ads.example.com/*']);
  });

  it('parses @webRequest as JSON and normalizes to a validated rule array', () => {
    const code = makeScript({ name: 'WR', webRequest: '{"selector":"*://example.com/*","action":"cancel"}' });
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toEqual([{ selector: '*://example.com/*', action: 'cancel' }]);
  });

  it('drops @webRequest rules that lack a valid action', () => {
    const code = makeScript({ name: 'WR', webRequest: '{"selector":"*://example.com/*"}' });
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('ignores invalid @webRequest JSON gracefully', () => {
    const code = makeScript({ name: 'WR', webRequest: 'not-json' });
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('parses localized metadata (e.g. @name:ja)', () => {
    const code = '// ==UserScript==\n// @name Test\n// @name:ja テスト\n// @description:fr Description en français\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.localized.ja.name).toBe('テスト');
    expect(meta.localized.fr.description).toBe('Description en français');
  });

  it('parses @run-at', () => {
    const code = makeScript({ name: 'RA', 'run-at': 'document-start' });
    const { meta } = parseUserscript(code);
    expect(meta['run-at']).toBe('document-start');
  });

  it('parses @inject-into', () => {
    const code = makeScript({ name: 'II', 'inject-into': 'page' });
    const { meta } = parseUserscript(code);
    expect(meta['inject-into']).toBe('page');
  });

  it('handles script with extra whitespace in metadata lines', () => {
    const code = '// ==UserScript==\n//   @name   Spaced   Out  \n// ==/UserScript==\n';
    const result = parseUserscript(code);
    expect(result.meta.name).toBe('Spaced   Out');
  });

  it('handles empty @grant value (pushes nothing)', () => {
    const code = '// ==UserScript==\n// @name EG\n// @grant\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    // Empty grant value is not pushed, so falls to default ['none']
    expect(meta.grant).toEqual(['none']);
  });

  it('parses localized metadata with multi-segment locale like zh-Hans', () => {
    // key.split(':') with "name:zh-Hans" yields ["name", "zh-Hans"] — locale should be "zh-Hans"
    const code = '// ==UserScript==\n// @name Test\n// @name:zh-Hans 简体中文测试\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    // The current split(':') only splits into two parts, so "zh-Hans" stays intact
    expect(meta.localized['zh-Hans']).toBeDefined();
    expect(meta.localized['zh-Hans'].name).toBe('简体中文测试');
  });

  // SECURITY: prototype pollution via @<base>:__proto__ <value>. Previously
  // the parser reached `meta.localized["__proto__"][baseKey] = value` which
  // mutates Object.prototype (the bracket accessor returns the prototype,
  // and the subsequent property assignment lands on it). Every {} in the
  // SW context then inherits the polluted property. Three cases pin the
  // contract: baseKey rejected, locale rejected, both rejected, plus a
  // post-parse check that Object.prototype is unchanged.
  describe('SECURITY: @name:__proto__ prototype-pollution rejection', () => {
    it('rejects @name:__proto__ <value> (locale = __proto__)', () => {
      const code = '// ==UserScript==\n// @name Safe\n// @name:__proto__ EVIL\n// ==/UserScript==\n';
      const { meta } = parseUserscript(code);
      // Reject quietly — the line is dropped.
      expect(meta.localized?.__proto__).toBeUndefined();
      // The smoking gun: no global pollution.
      expect({}.name).toBeUndefined();
      expect(({}).name).toBeUndefined();
    });

    it('rejects @__proto__:en <value> (baseKey = __proto__)', () => {
      const code = '// ==UserScript==\n// @name Safe\n// @__proto__:en EVIL\n// ==/UserScript==\n';
      const { meta } = parseUserscript(code);
      expect(meta.localized?.en?.__proto__).toBeUndefined();
      expect({}.name).toBeUndefined();
    });

    it('rejects @constructor:en and @prototype:en too', () => {
      const code = '// ==UserScript==\n// @name Safe\n// @constructor:en EVIL\n// @prototype:en EVIL\n// ==/UserScript==\n';
      const { meta } = parseUserscript(code);
      expect(meta.localized?.en?.constructor).toBeUndefined();
      expect(meta.localized?.en?.prototype).toBeUndefined();
    });

    it('Object.prototype.name remains untouched after parsing a malicious meta block', () => {
      // Run multiple malicious variants in sequence.
      const malicious = [
        '// @name:__proto__ EVIL',
        '// @__proto__:en EVIL',
        '// @name:constructor EVIL',
        '// @constructor:__proto__ EVIL',
        '// @prototype:__proto__ EVIL',
      ];
      for (const line of malicious) {
        const code = `// ==UserScript==\n// @name X\n${line}\n// ==/UserScript==\n`;
        parseUserscript(code);
        // After each, no pollution.
        expect({}.name).toBeUndefined();
        expect({}.constructor).toBe(Object);
        expect({}.hasOwnProperty).toBeDefined();
      }
    });
  });

  it('last @name wins when duplicated', () => {
    const code = '// ==UserScript==\n// @name First\n// @name Second\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.name).toBe('Second');
  });

  it('handles Windows-style \\r\\n line endings', () => {
    const code = '// ==UserScript==\r\n// @name WinScript\r\n// @version 1.2.3\r\n// @match https://example.com/*\r\n// ==/UserScript==\r\n';
    const { meta } = parseUserscript(code);
    expect(meta.name).toBe('WinScript');
    expect(meta.version).toBe('1.2.3');
    expect(meta.match.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores @resource with malformed value (single word, no URL)', () => {
    const code = makeScript({ name: 'BadRes', resource: 'onlyname' });
    const { meta } = parseUserscript(code);
    // resourceMatch regex requires "name URL" format — single word should not match
    expect(Object.keys(meta.resource)).toHaveLength(0);
  });

  it('keeps @grant none alongside other grants in the array', () => {
    const code = '// ==UserScript==\n// @name Mixed\n// @grant none\n// @grant GM_setValue\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    // Both values are pushed to the grant array
    expect(meta.grant).toContain('none');
    expect(meta.grant).toContain('GM_setValue');
    expect(meta.grant).toHaveLength(2);
  });

  // Phase 36.6 — comma-separated convenience syntax (VM #2403)
  it('splits comma-separated @match into multiple patterns', () => {
    const code = '// ==UserScript==\n// @name CSV\n// @match https://a.com/*,https://b.com/*,https://c.com/*\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.match).toEqual([
      'https://a.com/*',
      'https://b.com/*',
      'https://c.com/*',
    ]);
  });

  it('splits comma-separated @exclude-match into multiple patterns', () => {
    const code = '// ==UserScript==\n// @name CSV2\n// @match *://*/*\n// @exclude-match https://x.com/*, https://y.com/*\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.excludeMatch).toEqual(['https://x.com/*', 'https://y.com/*']);
  });

  it('preserves single @match without comma intact', () => {
    const code = '// ==UserScript==\n// @name Single\n// @match https://example.com/*\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.match).toEqual(['https://example.com/*']);
  });

  // Phase 36.4 — multi-word @tag preserved (VM v2.35.2 parity)
  it('preserves multi-word @tag values without splitting on whitespace', () => {
    const code = '// ==UserScript==\n// @name Tagged\n// @tag my util\n// @tag another tag\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.tag).toEqual(['my util', 'another tag']);
  });

  it('does not split @tag on commas (multi-word values may contain them)', () => {
    const code = '// ==UserScript==\n// @name Tagged2\n// @tag tools,utility\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    // Tag splitting on comma would mangle declarative single-tag values like
    // "v3.8, beta". We only desugar comma syntax for URL-pattern arrays.
    expect(meta.tag).toEqual(['tools,utility']);
  });

  describe('@require-provenance Phase A metadata parsing', () => {
    it('parses provenance bundle URLs and signer identities as ordered arrays', () => {
      const code = [
        '// ==UserScript==',
        '// @name Provenance',
        '// @require https://cdn.example.com/lib-a.js',
        '// @require-provenance https://cdn.example.com/lib-a.js.bundle',
        '// @require-identity https://github.com/exampleuser (issuer: https://github.com/login/oauth)',
        '// @require https://cdn.example.com/lib-b.js',
        '// @require-provenance https://cdn.example.com/lib-b.js.bundle',
        '// @require-identity https://accounts.google.com/example@example.com (issuer: https://accounts.google.com)',
        '// ==/UserScript==',
        'console.log("ok");'
      ].join('\n');

      const { meta } = parseUserscript(code);
      expect(meta.require).toEqual([
        'https://cdn.example.com/lib-a.js',
        'https://cdn.example.com/lib-b.js'
      ]);
      expect(meta.requireProvenance).toEqual([
        'https://cdn.example.com/lib-a.js.bundle',
        'https://cdn.example.com/lib-b.js.bundle'
      ]);
      expect(meta.requireIdentity).toEqual([
        'https://github.com/exampleuser (issuer: https://github.com/login/oauth)',
        'https://accounts.google.com/example@example.com (issuer: https://accounts.google.com)'
      ]);
    });

    it('defaults provenance metadata to empty arrays when omitted', () => {
      const { meta } = parseUserscript(makeScript({ name: 'No Provenance', require: 'https://cdn.example.com/lib.js' }));
      expect(meta.require).toEqual(['https://cdn.example.com/lib.js']);
      expect(meta.requireProvenance).toEqual([]);
      expect(meta.requireIdentity).toEqual([]);
    });

    it('splits comma-separated provenance and identity lists', () => {
      const code = [
        '// ==UserScript==',
        '// @name Provenance CSV',
        '// @require-provenance https://cdn.example.com/a.bundle, https://cdn.example.com/b.bundle',
        '// @require-identity https://github.com/a (issuer: https://github.com/login/oauth), https://github.com/b (issuer: https://github.com/login/oauth)',
        '// ==/UserScript==',
      ].join('\n');

      const { meta } = parseUserscript(code);
      expect(meta.requireProvenance).toEqual([
        'https://cdn.example.com/a.bundle',
        'https://cdn.example.com/b.bundle'
      ]);
      expect(meta.requireIdentity).toEqual([
        'https://github.com/a (issuer: https://github.com/login/oauth)',
        'https://github.com/b (issuer: https://github.com/login/oauth)'
      ]);
    });

    it('accepts canonical camelCase aliases used by stored metadata migrations', () => {
      const code = [
        '// ==UserScript==',
        '// @name Provenance Aliases',
        '// @requireProvenance https://cdn.example.com/a.bundle',
        '// @requireIdentity https://github.com/a (issuer: https://github.com/login/oauth)',
        '// ==/UserScript==',
      ].join('\n');

      const { meta } = parseUserscript(code);
      expect(meta.requireProvenance).toEqual(['https://cdn.example.com/a.bundle']);
      expect(meta.requireIdentity).toEqual(['https://github.com/a (issuer: https://github.com/login/oauth)']);
    });
  });
});
