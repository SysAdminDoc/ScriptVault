// @vitest-environment node
// (jsdom's Blob has no .stream(); the real service-worker runtime does.)
// Pins backup-blob gzip compression (roadmap P2): _gzipBytes/_gunzipBytes
// round-trip losslessly and shrink compressible data; _storeBackupBlob marks
// records compressed and _getBackupBlob transparently gunzips (with backward-
// compatible reads of pre-compression records).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'modules/backup-scheduler.js'), 'utf8');

function extractFn(src, name) {
  const marker = `function ${name}(`;
  let start = src.indexOf(marker);
  if (start === -1) throw new Error(`${name} not found`);
  // Include a leading `async ` so extracted async helpers stay valid when eval'd.
  if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

const gzip = new Function(`${extractFn(code, '_gzipBytes')}; return _gzipBytes;`)();
const gunzip = new Function(`${extractFn(code, '_gunzipBytes')}; return _gunzipBytes;`)();

describe('backup blob gzip round-trip', () => {
  it('losslessly round-trips and shrinks compressible data', async () => {
    // Highly compressible: a repeated userscript-like body.
    const text = '// ==UserScript==\n// @name Repeated\n'.repeat(2000);
    const raw = new TextEncoder().encode(text);
    const gz = await gzip(raw);
    expect(gz.length).toBeLessThan(raw.length); // measurable size reduction
    const back = await gunzip(gz);
    expect(new TextDecoder().decode(back)).toBe(text);
  });

  it('round-trips arbitrary binary bytes', async () => {
    const raw = new Uint8Array(Array.from({ length: 256 }, (_, i) => (i * 7) % 256));
    const back = await gunzip(await gzip(raw));
    expect(Array.from(back)).toEqual(Array.from(raw));
  });
});

describe('backup blob store/read wiring', () => {
  it('stores the compressed flag and gunzips transparently, reading old records raw', () => {
    const store = extractFn(code, '_storeBackupBlob');
    const get = extractFn(code, '_getBackupBlob');
    // Store gzips when CompressionStream is present and records the flag.
    expect(store).toContain('CompressionStream');
    expect(store).toContain('compressed');
    expect(store).toContain('byteSize: raw.length');
    // Read only gunzips when the record is flagged (old records stay raw).
    expect(get).toContain('if (record.compressed)');
    expect(get).toContain('_gunzipBytes');
  });
});
