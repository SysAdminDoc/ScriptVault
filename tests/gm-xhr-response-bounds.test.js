// Content-Length is a hint a hostile host reachable under @connect can omit or
// lie about. Every GM_xmlhttpRequest response path must therefore trip its cap
// DURING the read — a post-hoc size check has already buffered the body, which
// is how a chunked multi-GB reply could OOM-kill the service worker (taking
// registration, sync and update checks with it) on every retry.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';
import { describe, expect, it } from 'vitest';

import { readResponseBytesBounded } from '../src/background/fetch-bounded.ts';

const ROOT = process.cwd();
const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const handlerSource = readFileSync(resolve(ROOT, 'src/background/gm-network-handler.ts'), 'utf8');

/** A chunked response with NO content-length, like the hostile case. */
function chunkedResponse(totalBytes, { chunkSize = 1024, headers = {} } = {}) {
  let sent = 0;
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    status: 200,
    ok: true,
    headers: { get: (name) => lower.get(String(name).toLowerCase()) ?? null },
    body: {
      getReader: () => ({
        read: async () => {
          if (sent >= totalBytes) return { done: true, value: undefined };
          const size = Math.min(chunkSize, totalBytes - sent);
          sent += size;
          return { done: false, value: new Uint8Array(size) };
        },
        cancel: async () => { sent = totalBytes; },
        releaseLock: () => {},
      }),
    },
    arrayBuffer: async () => new ArrayBuffer(totalBytes),
    text: async () => 'x'.repeat(totalBytes),
  };
}

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`not found: ${signature}`);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced: ${signature}`);
}

describe('readResponseBytesBounded', () => {
  it('rejects a chunked body that exceeds the cap with no content-length', async () => {
    await expect(readResponseBytesBounded(chunkedResponse(4096), 2048, 'Response'))
      .rejects.toThrow(/too large/);
  });

  it('stops reading rather than draining the whole body', async () => {
    let chunksServed = 0;
    let cancelled = false;
    const response = {
      headers: { get: () => null },
      body: {
        getReader: () => ({
          read: async () => { chunksServed += 1; return { done: false, value: new Uint8Array(1024) }; },
          cancel: async () => { cancelled = true; },
          releaseLock: () => {},
        }),
      },
    };
    await expect(readResponseBytesBounded(response, 4096, 'Response')).rejects.toThrow(/too large/);
    expect(cancelled).toBe(true);
    // 4096-byte cap over 1 KiB chunks: five reads at most, not unbounded.
    expect(chunksServed).toBeLessThanOrEqual(6);
  });

  it('refuses early on an honest oversized content-length without reading', async () => {
    let read = false;
    const response = {
      headers: { get: (n) => (String(n).toLowerCase() === 'content-length' ? '999999' : null) },
      body: { getReader: () => ({ read: async () => { read = true; return { done: true }; }, cancel: async () => {}, releaseLock: () => {} }) },
    };
    await expect(readResponseBytesBounded(response, 1024, 'Response')).rejects.toThrow(/too large/);
    expect(read).toBe(false);
  });

  it('returns the bytes for a body within the cap', async () => {
    const bytes = await readResponseBytesBounded(chunkedResponse(3000), 8192, 'Response');
    expect(bytes.byteLength).toBe(3000);
  });

  it('still refuses an oversized body when there is no stream to bound', async () => {
    const response = { headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(5000) };
    await expect(readResponseBytesBounded(response, 1024, 'Response')).rejects.toThrow(/too large/);
  });
});

describe('the core bridge ships the same byte-bounded reader', () => {
  function loadCoreReader() {
    // formatBytes lives in shared/utils.js, which the bundle loads before the
    // bridge; supply it rather than pulling in the whole bundle.
    const body = `${extractFunction(core, 'async function _readResponseBytesBounded(')}
return _readResponseBytesBounded;`;
    return compileFunction(body, ['formatBytes'], { filename: resolve(ROOT, 'background.core.js') })(
      (n) => `${n} B`,
    );
  }

  it('rejects an unbounded chunked body', async () => {
    const reader = loadCoreReader();
    await expect(reader(chunkedResponse(4096), 2048, 'Download')).rejects.toThrow(/too large/);
  });

  it('accepts a body within the cap', async () => {
    const reader = loadCoreReader();
    const bytes = await reader(chunkedResponse(1000), 8192, 'Download');
    expect(bytes.byteLength).toBe(1000);
  });
});

describe('every GM_xmlhttpRequest response path is bounded during the read', () => {
  it('routes text and json through the bounded text reader', () => {
    // No bare response.text() left on any GM_xmlhttpRequest read path.
    const xhrSection = handlerSource.slice(
      handlerSource.indexOf("if (data.responseType === 'arraybuffer')"),
      handlerSource.indexOf('const finalResponse = {'),
    );
    expect(xhrSection).not.toContain('await response.text()');
    expect(xhrSection).toContain("await _fetchTextBounded(response, maxBytes, 'Response')");
  });

  it('routes arraybuffer and blob through the bounded bytes reader', () => {
    const xhrSection = handlerSource.slice(
      handlerSource.indexOf("if (data.responseType === 'arraybuffer')"),
      handlerSource.indexOf('const finalResponse = {'),
    );
    expect(xhrSection).not.toContain('await response.arrayBuffer()');
    expect(xhrSection).not.toContain('await response.blob()');
    const bounded = xhrSection.match(/_readResponseBytesBounded\(response, maxBytes, 'Response'\)/g) || [];
    expect(bounded).toHaveLength(2);
  });

  it('keeps the declared-length pre-check as a cheap early refusal', () => {
    expect(handlerSource).toContain("parseInt(response.headers.get('content-length') || '0', 10)");
  });

  it('bounds the download fetch-bridge data URL the same way', () => {
    const fn = extractFunction(core, 'async function responseToDownloadDataUrl(');
    expect(fn).toContain('_readResponseBytesBounded(response, GM_DOWNLOAD_FETCH_MAX_BYTES');
    expect(fn).not.toContain('await response.arrayBuffer()');
  });
});
