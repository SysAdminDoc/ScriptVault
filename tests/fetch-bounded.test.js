import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Extract _fetchTextBounded from background.core.js without inlining the
// rest of the SW module graph. The helper is self-contained; load the
// source as text, slice out the function, and Function-eval it.
const code = readFileSync(resolve(__dirname, '../background.core.js'), 'utf8');
const startMarker = '// Stream-read a fetch Response body up to `maxBytes`';
// The helper ends with a closing brace on its own line followed by a
// blank line; locate the function-end by scanning forward for the next
// top-level `function` declaration after the helper signature.
const startIdx = code.indexOf(startMarker);
if (startIdx === -1) {
  throw new Error('Could not locate _fetchTextBounded helper start');
}
const signatureIdx = code.indexOf('async function _fetchTextBounded', startIdx);
if (signatureIdx === -1) {
  throw new Error('Could not locate _fetchTextBounded signature');
}
// Walk brace depth from the function body start to find the matching `}`.
let braceStart = code.indexOf('{', signatureIdx);
if (braceStart === -1) throw new Error('Could not locate helper body open brace');
let depth = 1;
let i = braceStart + 1;
while (i < code.length && depth > 0) {
  const ch = code[i];
  if (ch === '{') depth++;
  else if (ch === '}') depth--;
  i++;
}
if (depth !== 0) throw new Error('Could not balance helper braces');
const helperSrc = code.slice(startIdx, i);

// Provide a formatBytes stub the helper depends on for error messages.
const fn = new Function('formatBytes', helperSrc + '\nreturn { _fetchTextBounded };');
const { _fetchTextBounded } = fn((n) => `${n}B`);

function bodyFromChunks(chunks) {
  let i = 0;
  return {
    getReader() {
      return {
        async read() {
          if (i >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[i++] };
        },
        async cancel() { /* ignore */ },
        releaseLock() { /* ignore */ },
      };
    }
  };
}

function makeResponse(text, { declaredLength, useStream = true } = {}) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const headers = new Map();
  if (declaredLength !== undefined) headers.set('content-length', String(declaredLength));
  return {
    headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
    body: useStream ? bodyFromChunks([bytes]) : null,
    async text() { return text; },
  };
}

describe('_fetchTextBounded — stream-bounded fetch helper', () => {
  it('returns the body text when within cap', async () => {
    const r = makeResponse('hello world');
    const text = await _fetchTextBounded(r, 100, 'Test');
    expect(text).toBe('hello world');
  });

  it('rejects on content-length above cap (pre-flight)', async () => {
    const r = makeResponse('payload', { declaredLength: 9_999_999 });
    await expect(_fetchTextBounded(r, 100, 'Test')).rejects.toThrow(/Test too large/);
  });

  it('rejects when streamed bytes exceed cap even with no/lying content-length', async () => {
    const big = 'x'.repeat(2000);
    // Server lies / omits content-length: declaredLength = 100 (or none).
    const r = makeResponse(big, { declaredLength: 100 });
    // Pre-flight passes (100 <= cap of 500). But the streamed body
    // overruns cap, so the stream loop aborts.
    await expect(_fetchTextBounded(r, 500, 'Test')).rejects.toThrow(/Test too large/);
  });

  it('falls back to buffered .text() when response.body is missing', async () => {
    const r = makeResponse('hello', { useStream: false });
    const text = await _fetchTextBounded(r, 100, 'Test');
    expect(text).toBe('hello');
  });

  it('rejects on buffered fallback path when text exceeds cap', async () => {
    const r = makeResponse('x'.repeat(2000), { useStream: false });
    await expect(_fetchTextBounded(r, 100, 'Test')).rejects.toThrow(/Test too large/);
  });

  it('handles multi-byte UTF-8 across chunk boundaries', async () => {
    // "あ" is 0xE3 0x81 0x82 in UTF-8. Split across two chunks.
    const part1 = new Uint8Array([0xE3, 0x81]);
    const part2 = new Uint8Array([0x82]);
    const r = {
      headers: { get: () => null },
      body: bodyFromChunks([part1, part2]),
      async text() { return 'あ'; },
    };
    const text = await _fetchTextBounded(r, 100, 'Test');
    expect(text).toBe('あ');
  });

  it('returns an empty string for an empty body', async () => {
    const r = makeResponse('');
    const text = await _fetchTextBounded(r, 100, 'Test');
    expect(text).toBe('');
  });
});
