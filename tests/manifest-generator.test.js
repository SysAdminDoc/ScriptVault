import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyManifestTransform,
  formatManifest,
  generateManifestForProfile,
  loadTransformationConfig,
} from '../scripts/generate-manifest-firefox.mjs';

const ROOT = process.cwd();
const chromeManifest = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8'));

async function profileConfig(name) {
  const config = await loadTransformationConfig(resolve(ROOT, 'manifest-firefox.transformations.json'));
  return config.profiles[name];
}

describe('manifest generator', () => {
  it('round-trips the committed Firefox manifest byte-for-byte', async () => {
    const generated = await generateManifestForProfile({ profile: 'firefox', rootDir: ROOT });
    const current = readFileSync(resolve(ROOT, 'manifest-firefox.json'), 'utf8');

    expect(generated.text).toBe(current);
    expect(generated.manifest.browser_specific_settings.gecko.strict_min_version).toBe('140.0');
    expect(generated.manifest.browser_specific_settings).not.toHaveProperty('gecko_android');
  });

  it('generates the Edge staging manifest from the shared profile', async () => {
    const generated = await generateManifestForProfile({ profile: 'edge', rootDir: ROOT });
    const expected = { ...chromeManifest };
    delete expected.update_url;

    expect(generated.text).toBe(`${JSON.stringify(expected, null, 2)}\n`);
    expect(generated.outputPath.endsWith('build-edge\\manifest.json') || generated.outputPath.endsWith('build-edge/manifest.json')).toBe(true);
  });

  it('keeps Firefox transformations idempotent', async () => {
    const config = await profileConfig('firefox');
    const once = applyManifestTransform(chromeManifest, config);
    const twice = applyManifestTransform(once, config);

    expect(twice).toEqual(once);
    expect(twice.permissions.filter((permission) => permission === 'menus')).toHaveLength(1);
    expect(twice.optional_permissions.filter((permission) => permission === 'userScripts')).toHaveLength(1);
  });

  it('keeps Firefox manifest schema-valid for the supported MV3 subset', async () => {
    const { manifest } = await generateManifestForProfile({ profile: 'firefox', rootDir: ROOT });

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({ scripts: ['background.js'] });
    expect(manifest.browser_specific_settings.gecko.id).toBe('ScriptVault@sysadmindoc.dev');
    expect(manifest.browser_specific_settings).not.toHaveProperty('gecko_android');
    expect(manifest.permissions).toContain('menus');
    expect(manifest.permissions).not.toContain('contextMenus');
    expect(manifest.permissions).not.toContain('contextualIdentities');
    expect(manifest.permissions).not.toContain('sidePanel');
    expect(manifest.permissions).not.toContain('offscreen');
    expect(manifest.optional_permissions).toContain('userScripts');
    expect(manifest.optional_permissions).not.toContain('identity');
    expect(manifest.optional_permissions).not.toContain('contextualIdentities');
    expect(manifest).not.toHaveProperty('minimum_chrome_version');
    expect(manifest).not.toHaveProperty('side_panel');
    expect(manifest).not.toHaveProperty('sandbox');
    expect(manifest).not.toHaveProperty('content_security_policy');
  });

  it('keeps Edge manifest schema-valid for Chromium MV3 packaging', async () => {
    const { manifest } = await generateManifestForProfile({ profile: 'edge', rootDir: ROOT });

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' });
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest).not.toHaveProperty('browser_specific_settings');
    expect(manifest).not.toHaveProperty('update_url');
  });

  it('formats transformed manifests as parseable JSON', async () => {
    for (const profile of ['firefox', 'edge']) {
      const config = await profileConfig(profile);
      const manifest = applyManifestTransform(chromeManifest, config);
      const text = formatManifest(manifest, config);

      expect(() => JSON.parse(text)).not.toThrow();
    }
  });
});
