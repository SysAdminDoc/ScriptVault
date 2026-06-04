import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const chromeManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));
const firefoxManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest-firefox.json'), 'utf8'));
const background = readFileSync(resolve(process.cwd(), 'background.js'), 'utf8');

describe('module-mode service worker manifest', () => {
  it('uses a Chrome MV3 module service worker on a supported Chrome floor', () => {
    expect(chromeManifest.manifest_version).toBe(3);
    expect(Number.parseInt(chromeManifest.minimum_chrome_version, 10)).toBeGreaterThanOrEqual(124);
    expect(chromeManifest.background).toMatchObject({
      service_worker: 'background.js',
      type: 'module',
    });
  });

  it('keeps Firefox on the event-page background shape', () => {
    expect(firefoxManifest.background).toEqual({ scripts: ['background.js'] });
  });

  it('keeps the built worker compatible with a single-file module service worker', () => {
    expect(background).not.toMatch(/(?:self|globalThis)\.importScripts\s*\(/);
    expect(background).not.toMatch(/^\s*importScripts\s*\(/m);
    expect(background).not.toMatch(/^\s*import\s.+from\s/m);
    expect(background).not.toMatch(/^\s*export\s/m);
    expect(background).toContain('chrome.runtime.onMessage.addListener');
    expect(background).toContain('self.ensureInitialized = ensureInitialized;');
  });
});
