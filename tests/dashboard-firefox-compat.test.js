import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const compatSource = `${readFileSync(resolve(process.cwd(), 'pages/dashboard-firefox-compat.js'), 'utf8')}
globalThis.__FirefoxCompat = FirefoxCompat;`;

function loadFirefoxCompat({ chrome = {}, browser, userAgent = 'Mozilla/5.0 Firefox/140.0' } = {}) {
  const sandbox = {
    chrome,
    console: {
      error() {},
      warn() {},
    },
    navigator: { userAgent },
  };
  if (browser !== undefined) {
    sandbox.browser = browser;
  }
  vm.runInNewContext(compatSource, sandbox);
  return sandbox.__FirefoxCompat;
}

describe('Firefox dashboard compatibility layer', () => {
  it('does not create a fake sidePanel API on Firefox', () => {
    const chrome = { runtime: { id: 'scriptvault-test' } };
    const compat = loadFirefoxCompat({
      chrome,
      browser: { runtime: { id: 'firefox-test' } },
    });

    expect(Boolean(compat.isFirefox)).toBe(true);
    expect(compat.features.sidePanel).toBe(false);

    compat.polyfill();

    expect(chrome).not.toHaveProperty('sidePanel');
    expect(compat.getFeatureStatus().sidePanel).toMatchObject({
      available: false,
      polyfilled: false,
      badge: 'Not available on Firefox',
    });
  });

  it('preserves native Chromium sidePanel support', () => {
    const sidePanel = {
      open() {
        return Promise.resolve();
      },
      setOptions() {
        return Promise.resolve();
      },
    };
    const chrome = { runtime: { id: 'scriptvault-test' }, sidePanel };
    const compat = loadFirefoxCompat({
      chrome,
      userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36',
    });

    expect(compat.isChrome).toBe(true);
    expect(compat.features.sidePanel).toBe(true);

    compat.polyfill();

    expect(chrome.sidePanel).toBe(sidePanel);
    expect(compat.getFeatureStatus().sidePanel).toMatchObject({
      available: true,
      polyfilled: false,
    });
  });
});
