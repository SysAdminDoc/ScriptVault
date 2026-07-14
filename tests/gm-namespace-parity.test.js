import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SOURCES = [
  ['core', 'src/background/core.ts'],
  ['wrapper', 'src/background/wrapper-builder.ts'],
];

const DIRECT_PROMISE_ALIASES = [
  'addElement',
  'focusTab',
  'head',
  'log',
  'getMenuCommands',
  'webRequest',
];

function readSource(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('GM namespace parity', () => {
  it('keeps direct GM.* aliases wired in both wrapper sources', () => {
    for (const [label, path] of SOURCES) {
      const source = readSource(path);
      for (const alias of DIRECT_PROMISE_ALIASES) {
        expect(source, `${label} missing GM.${alias}`).toContain(`${alias}:`);
      }
      expect(source, `${label} missing singular GM.cookie alias`).toContain('cookie: {');
      expect(source, `${label} missing GM.audio getter`).toContain('get audio()');
    }
  });

  it('keeps GM.fetch on the guarded GM_xmlhttpRequest network contract', () => {
    for (const [label, path] of SOURCES) {
      const source = readSource(path);
      expect(source, `${label} missing GM.fetch implementation`).toContain('async function GM_fetch');
      expect(source, `${label} missing GM.fetch namespace alias`).toContain('fetch: GM_fetch');
      expect(source, `${label} missing direct GM_fetch export`).toContain('window.GM_fetch = GM_fetch');
      expect(source, `${label} missing guarded XHR grant reuse`).toContain('allowFetchGrant');
      expect(source, `${label} missing streaming response support`).toContain('new ReadableStream');
      expect(source, `${label} missing streaming XHR bridge reuse`).toContain("responseType: 'stream'");
      expect(source, `${label} missing binary stream chunk transport`).toContain("streamEncoding: 'base64'");
      expect(source, `${label} missing privileged stream result polling`).toContain('takeStream: true');
      expect(source, `${label} missing fallback XHR bridge reuse`).toContain("_GM_xmlhttpRequestPromise({");
    }

    const core = readSource('src/background/core.ts');
    const networkHandler = readSource('src/background/gm-network-handler.ts');
    expect(core).not.toContain("case 'GM_fetch'");
    expect(core).toContain('GMNetworkHandler.GM_NETWORK_ACTIONS');
    expect(networkHandler).toContain("'GM_xmlhttpRequest'");

    const readme = readSource('README.md');
    expect(readme).toContain('`GM.fetch`');
    expect(readme).toContain('ReadableStream');
    expect(readme).toContain('@connect');
  });
});
