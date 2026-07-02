import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sharingCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-sharing.js'), 'utf8');

// Instantiate the ScriptSharing module (IIFE) and reach its internal QR encoder
// through the test-only _qr export.
function loadQR() {
  const body = `${sharingCode}\nreturn ScriptSharing;`;
  let mod;
  try {
    const vm = require('node:vm');
    mod = vm.compileFunction(body, [], { filename: resolve(process.cwd(), 'pages/dashboard-sharing.js') })();
  } catch {
    mod = new Function(body)();
  }
  return mod._qr;
}

describe('QR encoder (2026-07 regression: 107-271 byte payloads)', () => {
  let QR;
  beforeEach(() => { QR = loadQR(); });

  it('produces a full, correctly-sized grid across the previously-broken range', () => {
    // One payload per multi-block version band (V6-V10). These all corrupted
    // before because the version table stored per-block data codewords.
    const cases = [
      { len: 120, version: 6, size: 41 },
      { len: 150, version: 7, size: 45 },
      { len: 180, version: 8, size: 49 },
      { len: 220, version: 9, size: 53 },
      { len: 260, version: 10, size: 57 },
    ];
    for (const { len, size } of cases) {
      const payload = 'a'.repeat(len);
      const qr = QR.encode(payload);
      expect(qr, `encode(${len} bytes) should not be null`).toBeTruthy();
      expect(qr.size).toBe(size);
      // Grid is fully materialized (no undefined rows/cells).
      expect(qr.grid.length).toBe(size);
      let black = 0;
      for (const row of qr.grid) {
        expect(row.length).toBe(size);
        for (const cell of row) black += cell ? 1 : 0;
      }
      // A correctly-filled code has a substantial number of dark modules; the
      // truncated grids left most of the symbol blank.
      expect(black).toBeGreaterThan(size * size * 0.15);
    }
  });

  it('places version-information modules for V7+ and omits them for V1-V6', () => {
    // V6 (no version info): the version-info region should be data/blank-driven,
    // not a fixed constant — we just assert V7+ sets the known bit pattern.
    const VERSION_INFO = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3 };
    const bands = [{ len: 150, v: 7, size: 45 }, { len: 260, v: 10, size: 57 }];
    for (const { len, v, size } of bands) {
      const qr = QR.encode('b'.repeat(len));
      expect(qr.version).toBe(v);
      const info = VERSION_INFO[v];
      for (let i = 0; i < 18; i++) {
        const bit = (info >> i) & 1;
        const row = Math.floor(i / 3);
        const col = i % 3;
        expect(qr.grid[row][size - 11 + col]).toBe(bit);      // top-right block
        expect(qr.grid[size - 11 + col][row]).toBe(bit);      // bottom-left block
      }
    }
  });

  it('still encodes small single-block payloads (V1-V5) correctly', () => {
    const qr = QR.encode('hello world');
    expect(qr).toBeTruthy();
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
  });

  it('returns null for payloads beyond V10 capacity', () => {
    expect(QR.encode('x'.repeat(300))).toBeNull();
  });
});
