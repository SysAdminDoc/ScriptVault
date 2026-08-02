import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const backgroundCore = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const backgroundJs = readFileSync(resolve(ROOT, 'background.js'), 'utf8');
const registrationTs = readFileSync(resolve(ROOT, 'src/background/registration.ts'), 'utf8');
const firefoxSmoke = readFileSync(resolve(ROOT, 'scripts/smoke-firefox-sideload.mjs'), 'utf8');

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

// Regression: Firefox was excluded from per-script worldId, so every script
// matching a page shared one sandbox and only the first one executed. Verified
// against Firefox 154.0b1 — scripts 2..n were silently dead.
describe('per-script world isolation on Firefox', () => {
  function makeSupportsWorldId(userAgent, { configureWorld = true } = {}) {
    const src = [
      extractFn(backgroundCore, '_getChromeVersion'),
      extractFn(backgroundCore, '_isFirefoxRuntime'),
      extractFn(backgroundCore, '_supportsUserScriptsWorldId'),
      'return _supportsUserScriptsWorldId();',
    ].join('\n');
    const self = { navigator: { userAgent } };
    const chrome = { userScripts: configureWorld ? { configureWorld() {} } : {} };
    return new Function('self', 'chrome', src)(self, chrome);
  }

  const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0';
  const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36';
  const OLD_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';

  it('enables per-script worlds on Firefox when configureWorld exists', () => {
    expect(makeSupportsWorldId(FIREFOX_UA)).toBe(true);
  });

  it('falls back to the shared world on Firefox builds without configureWorld', () => {
    expect(makeSupportsWorldId(FIREFOX_UA, { configureWorld: false })).toBe(false);
  });

  it('keeps the Chrome 133+ floor unchanged', () => {
    expect(makeSupportsWorldId(CHROME_UA)).toBe(true);
    expect(makeSupportsWorldId(OLD_CHROME_UA)).toBe(false);
  });

  it('does not reintroduce the Firefox exclusion in runtime or extraction copies', () => {
    const runtimeFn = extractFn(backgroundCore, '_supportsUserScriptsWorldId');
    expect(runtimeFn).not.toMatch(/!\s*_isFirefoxRuntime\(\)\s*&&/);
    expect(backgroundJs).toContain('_supportsUserScriptsWorldId');
    expect(registrationTs).not.toMatch(/return\s+!isFirefoxRuntime\(\)\s*&&\s*getChromeMajorVersion\(\)\s*>=\s*133/);
  });

  it('drops worldId and retries rather than leaving a script unregistered', () => {
    expect(backgroundCore).toMatch(/registration\.worldId\s*&&\s*e\.message\?\.includes\('worldId'\)/);
    expect(registrationTs).toMatch(/registration\.worldId\s*&&\s*errMsg\?\.includes\('worldId'\)/);
  });
});

// The SPA scenario is the real-browser half of the Navigation API contract that
// tests/urlchange-wrapper.test.js can only cover at the jsdom level.
describe('Firefox SPA urlchange smoke contract', () => {
  it('drives routing from the page world so cross-world reach is what is proven', () => {
    expect(firefoxSmoke).toContain('spaUrlChangeSmoke');
    expect(firefoxSmoke).toContain('@grant window.onurlchange');
    expect(firefoxSmoke).toContain("history.pushState({}, '', '/spa-target/alpha')");
    expect(firefoxSmoke).toContain("window.navigation.navigate('/spa-target/beta')");
    expect(firefoxSmoke).toContain("location.hash = 'gamma'");
  });

  it('fails when the Navigation API is unreachable from the userscript world', () => {
    expect(firefoxSmoke).toContain('Navigation API is not reachable from the Firefox userscript world');
  });

  it('serves a router that intercepts so navigate() stays same-document', () => {
    expect(firefoxSmoke).toContain('spaPageServer');
    expect(firefoxSmoke).toContain('event.intercept(');
  });

  it('reports the SPA result in the smoke summary', () => {
    expect(firefoxSmoke).toMatch(/spaUrlChange:\s*spaResult/);
  });
});

// Firefox 154 ships privacy.userContext.enabled defaulted ON, so the pref value
// alone is not evidence that the sideload forced containers on.
describe('Firefox container assertion', () => {
  it('only fails when the container pref carries a user-set value', () => {
    expect(firefoxSmoke).toContain('prefHasUserValue');
    expect(firefoxSmoke).toMatch(/value\?\.enabled\s*&&\s*value\?\.userSet/);
  });
});
