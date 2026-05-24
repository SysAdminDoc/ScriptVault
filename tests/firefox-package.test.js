import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const firefoxManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest-firefox.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const buildFirefox = readFileSync(resolve(process.cwd(), 'build-firefox.sh'), 'utf8');
const ciWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const registrationTs = readFileSync(resolve(process.cwd(), 'src/background/registration.ts'), 'utf8');

describe('Firefox AMO validation gate', () => {
  it('declares AMO data collection permissions explicitly', () => {
    const gecko = firefoxManifest.browser_specific_settings?.gecko;

    expect(gecko?.id).toBe('ScriptVault@sysadmindoc.dev');
    expect(gecko?.strict_min_version).toBe('140.0');
    expect(firefoxManifest.browser_specific_settings?.gecko_android?.strict_min_version).toBe('142.0');
    expect(gecko?.data_collection_permissions).toEqual({
      required: ['none'],
      optional: [
        'authenticationInfo',
        'technicalAndInteraction',
        'websiteActivity',
        'websiteContent',
      ],
    });
  });

  it('uses Firefox-compatible manifest shape for userScripts and sandboxing', () => {
    expect(firefoxManifest.permissions).not.toContain('userScripts');
    expect(firefoxManifest.optional_permissions).toContain('userScripts');
    expect(firefoxManifest.optional_permissions).not.toContain('identity');
    expect(firefoxManifest).not.toHaveProperty('sandbox');
    expect(firefoxManifest).not.toHaveProperty('content_security_policy');
  });

  it('builds, lints, packages, and sources Firefox artifacts through web-ext', () => {
    expect(packageJson.devDependencies['web-ext']).toMatch(/10\.2/);
    expect(packageJson.scripts['firefox:lint']).toBe('bash build-firefox.sh --lint --keep-build --no-source-zip --prepare-only');
    expect(packageJson.scripts['firefox:package']).toBe('bash build-firefox.sh --lint');
    expect(buildFirefox).toContain('npx web-ext lint');
    expect(buildFirefox).toContain('npx web-ext build');
    expect(buildFirefox).toContain('scriptvault-firefox-source-v${VERSION}.zip');
    expect(buildFirefox).not.toMatch(/^\s+lib\s*$/m);
    expect(ciWorkflow).toContain('npm run firefox:package');
    expect(ciWorkflow).toContain('scriptvault-firefox-package');
  });

  it('guards Chrome-only per-script worldId on Firefox in runtime and TS mirror', () => {
    expect(backgroundCore).toContain('function _supportsUserScriptsWorldId()');
    expect(backgroundCore).toContain('if (_supportsUserScriptsWorldId())');
    expect(registrationTs).toContain('function supportsUserScriptsWorldId(): boolean');
    expect(registrationTs).toContain('if (supportsUserScriptsWorldId())');
  });
});
