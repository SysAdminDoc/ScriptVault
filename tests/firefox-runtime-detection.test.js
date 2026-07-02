import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The 2026-07 audit found _isFirefoxRuntime() in background.core.js returned
// true on Chrome: ScriptVault installs a `browser`->`chrome` alias for MV3
// compat, so `browser.runtime.id` was truthy on Chrome too. That misdetection
// showed Firefox setup instructions on Chrome and disabled per-script worldId
// isolation on Chrome 133+. The fix detects Firefox by user agent only (Firefox
// always reports `Firefox/<version>`), matching registration.ts.

function extractFn(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`${name} not found`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

const src = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

function makeDetector({ userAgent, chromeApi, browserApi }) {
  const body = extractFn(src, '_isFirefoxRuntime');
  // The function reads `self.navigator`, `browser`, and `chrome` from scope.
  const factory = new Function('self', 'browser', 'chrome', `${body}; return _isFirefoxRuntime;`);
  const selfObj = { navigator: { userAgent } };
  return factory(selfObj, browserApi, chromeApi)();
}

describe('_isFirefoxRuntime detection', () => {
  const chromeApi = { runtime: { id: 'abc' } };

  it('returns false on Chrome even when browser is aliased to chrome', () => {
    // The alias: browser === chrome (both truthy runtime.id).
    expect(makeDetector({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/138.0 Safari/537.36',
      chromeApi,
      browserApi: chromeApi,
    })).toBe(false);
  });

  it('returns true on Firefox by user agent', () => {
    expect(makeDetector({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0',
      chromeApi,
      browserApi: chromeApi,
    })).toBe(true);
  });

  it('does not misdetect a Gecko UA without the Firefox token as Firefox', () => {
    // Only the explicit Firefox/<version> token counts.
    expect(makeDetector({
      userAgent: 'Mozilla/5.0 Gecko',
      chromeApi,
      browserApi: chromeApi,
    })).toBe(false);
  });
});
