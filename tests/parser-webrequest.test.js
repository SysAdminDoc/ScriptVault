import { describe, it, expect } from 'vitest';
import { parseUserscript } from '../src/background/parser.ts';

/**
 * @webRequest JSON shape validation.
 *
 * The parser accepts JSON.parse output for @webRequest then hands the result
 * to the DNR rule builder. Malformed payloads used to silently flow through
 * as `meta.webRequest = parsedJunk`, which forced the downstream rule
 * constructor to recover from unexpected shapes. The validator added in
 * commit-pending now drops entries that don't match the documented contract
 * before they reach DNR. These cases pin the validator behavior so a future
 * refactor that loosens validation fails CI loudly.
 */

function wrap(directives) {
  const lines = ['// ==UserScript==', '// @name Test', '// @namespace x'];
  for (const [k, v] of directives) lines.push(`// @${k} ${v}`);
  lines.push('// ==/UserScript==');
  return lines.join('\n') + '\n';
}

describe('@webRequest JSON validation', () => {
  it('accepts a single rule object with string action', () => {
    const code = wrap([['webRequest', '{"selector":{"include":["*://example.com/*"]},"action":"cancel"}']]);
    const { meta } = parseUserscript(code);
    expect(Array.isArray(meta.webRequest)).toBe(true);
    expect(meta.webRequest).toHaveLength(1);
    expect(meta.webRequest[0].action).toBe('cancel');
  });

  it('accepts an array of rules', () => {
    const code = wrap([
      [
        'webRequest',
        '[{"selector":{"include":["*://a.com/*"]},"action":"cancel"},{"selector":{"include":["*://b.com/*"]},"action":{"redirect":"https://c.com/"}}]',
      ],
    ]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toHaveLength(2);
    expect(meta.webRequest[1].action.redirect).toBe('https://c.com/');
  });

  it('drops rules without action', () => {
    const code = wrap([['webRequest', '{"selector":{"include":["*://example.com/*"]}}']]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('drops rules with non-array selector.include', () => {
    const code = wrap([['webRequest', '{"selector":{"include":"*://example.com/*"},"action":"cancel"}']]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('drops rules where action object lacks cancel/redirect', () => {
    const code = wrap([['webRequest', '{"selector":{"include":["*://example.com/*"]},"action":{"foo":"bar"}}']]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('returns null for completely malformed JSON', () => {
    const code = wrap([['webRequest', 'not-json']]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('filters mixed valid/invalid rules to keep only valid ones', () => {
    const code = wrap([
      [
        'webRequest',
        '[{"action":"cancel"},{"action":null},{"action":42},{"action":{"redirect":"https://x.test/"}}]',
      ],
    ]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toHaveLength(2);
    expect(meta.webRequest[0].action).toBe('cancel');
    expect(meta.webRequest[1].action.redirect).toBe('https://x.test/');
  });

  it('accepts Chrome DNR response-header conditions and header mutation actions', () => {
    const code = wrap([
      [
        'webRequest',
        '{"selector":{"url":"||example.com","responseHeaders":[{"header":"content-type","values":["text/html*"]}],"excludedResponseHeaders":[{"header":"x-scriptvault-skip"}]},"action":{"setResponseHeaders":{"x-scriptvault":"matched","x-remove":null}}}',
      ],
    ]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toHaveLength(1);
    expect(meta.webRequest[0].selector.responseHeaders[0]).toEqual({
      header: 'content-type',
      values: ['text/html*'],
    });
    expect(meta.webRequest[0].selector.excludedResponseHeaders[0]).toEqual({
      header: 'x-scriptvault-skip',
    });
    expect(meta.webRequest[0].action.setResponseHeaders['x-scriptvault']).toBe('matched');
    expect(meta.webRequest[0].action.setResponseHeaders['x-remove']).toBeNull();
  });

  it('drops malformed response-header conditions', () => {
    const code = wrap([[
      'webRequest',
      '{"selector":{"include":["*://example.com/*"],"responseHeaders":[{"values":["missing-header"]}]},"action":"cancel"}',
    ]]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('drops entries that are not objects', () => {
    const code = wrap([['webRequest', '[null, 42, "string", {"action":"cancel"}]']]);
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toHaveLength(1);
  });
});
