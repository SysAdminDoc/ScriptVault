import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const firefoxManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest-firefox.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const buildFirefox = readFileSync(resolve(process.cwd(), 'build-firefox.sh'), 'utf8');
const runBash = readFileSync(resolve(process.cwd(), 'scripts/run-bash.mjs'), 'utf8');
const firefoxSmoke = readFileSync(resolve(process.cwd(), 'scripts/smoke-firefox-sideload.mjs'), 'utf8');
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
    expect(packageJson.devDependencies['web-ext']).toMatch(/10\.3/);
    expect(packageJson.scripts['firefox:lint']).toBe('node scripts/run-bash.mjs build-firefox.sh --lint --keep-build --no-source-zip --prepare-only');
    expect(packageJson.scripts['firefox:package']).toBe('node scripts/run-bash.mjs build-firefox.sh --lint');
    expect(packageJson.scripts['smoke:firefox']).toBe('node scripts/smoke-firefox-sideload.mjs');
    expect(buildFirefox).toContain('generate-manifest-firefox.mjs" --profile firefox --check');
    expect(buildFirefox).toContain('npx web-ext lint');
    expect(buildFirefox).toContain('npx web-ext build');
    expect(buildFirefox).toContain('scriptvault-firefox-source-v${VERSION}.zip');
    expect(buildFirefox).toContain('lib/acorn.min.js');
    expect(buildFirefox).toContain('lib/diff.min.js');
    expect(buildFirefox).not.toMatch(/^\s+lib\s*$/m);
    expect(ciWorkflow).toContain('npm run firefox:package');
    expect(ciWorkflow).toContain('scriptvault-firefox-package');
  });

  it('automates temporary Firefox sideload smoke through geckodriver', () => {
    expect(firefoxSmoke).toContain("const EXTENSION_ID = 'ScriptVault@sysadmindoc.dev'");
    expect(firefoxSmoke).toContain('/moz/addon/install');
    expect(firefoxSmoke).toContain('-remote-allow-system-access');
    expect(firefoxSmoke).toContain('ExtensionParent.GlobalManager.extensionMap.get');
    expect(firefoxSmoke).toContain('ExtensionPermissions.add');
    expect(firefoxSmoke).toContain('extension.baseURI.spec');
    expect(firefoxSmoke).toContain('Firefox userScripts permission button');
    expect(firefoxSmoke).toContain("action: 'saveScript'");
    expect(firefoxSmoke).toContain("action: 'toggleScript'");
    expect(firefoxSmoke).toContain('async function runtimeParitySmoke');
    expect(firefoxSmoke).toContain('async function dnrDynamicRuleSmoke');
    expect(firefoxSmoke).toContain('chrome.declarativeNetRequest');
    expect(firefoxSmoke).toContain('updateDynamicRules');
    expect(firefoxSmoke).toContain('async function sriRequireSmoke');
    expect(firefoxSmoke).toContain("['lvh.me', 'localtest.me']");
    expect(firefoxSmoke).toContain('urlForHost');
    expect(firefoxSmoke).toContain('@require ${serverUrl}/dependency.js#${integrity}');
    expect(firefoxSmoke).toContain('https://code.jquery.com/jquery-3.7.1.min.js');
    expect(firefoxSmoke).toContain('sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=');
    expect(firefoxSmoke).toContain('async function ed25519SigningSmoke');
    expect(firefoxSmoke).toContain("action: 'signing_generateNewKeypair'");
    expect(firefoxSmoke).toContain("action: 'signing_sign'");
    expect(firefoxSmoke).toContain("action: 'signing_verify'");
    expect(firefoxSmoke).toContain('async function webDavSyncSmoke');
    expect(firefoxSmoke).toContain("syncProvider: 'webdav'");
    expect(firefoxSmoke).toContain("action: 'syncProviderHealth'");
    expect(firefoxSmoke).toContain("action: 'syncDryRunPreview'");
    expect(firefoxSmoke).toContain("action: 'syncNow'");
    expect(firefoxSmoke).toContain('async function backupRoundTripSmoke');
    expect(firefoxSmoke).toContain("action: 'exportZip'");
    expect(firefoxSmoke).toContain("action: 'importFromZip'");
    expect(firefoxSmoke).toContain("action: 'importAll'");
    expect(firefoxSmoke).toContain('timestampsPreserved');
    expect(firefoxSmoke).toContain('jsonTimestampsPreserved');
    expect(firefoxSmoke).toContain('async function storageAndTrashSmoke');
    expect(firefoxSmoke).toContain('script_firefox_quota_');
    expect(firefoxSmoke).toContain("action: 'getStorageUsage'");
    expect(firefoxSmoke).toContain("action: 'restoreFromTrash'");
    expect(firefoxSmoke).toContain('restartFirefoxSession');
    expect(firefoxSmoke).toContain('firefoxProfileRestarted');
    expect(firefoxSmoke).toContain('ranOnTargetPage: runResult.ok');
    expect(firefoxSmoke).toContain('scriptvault-firefox-v${version}.zip');
  });

  it('aliases Firefox menus to the shared contextMenus runtime path', () => {
    expect(backgroundCore).toContain('!chrome.contextMenus && chrome.menus');
    expect(backgroundCore).toContain('chrome.contextMenus = chrome.menus');
  });

  it('prefers native Windows bash before generic WSL bash for packaging', () => {
    expect(runBash).toContain("process.platform === 'win32' ? windowsBashCandidates : posixBashCandidates");
    expect(runBash.indexOf("'C:\\\\Program Files\\\\Git\\\\bin\\\\bash.exe'")).toBeLessThan(runBash.indexOf("'bash'"));
  });

  it('guards Chrome-only per-script worldId on Firefox in runtime and TS mirror', () => {
    expect(backgroundCore).toContain('function _supportsUserScriptsWorldId()');
    expect(backgroundCore).toContain('if (_supportsUserScriptsWorldId())');
    expect(registrationTs).toContain('function supportsUserScriptsWorldId(): boolean');
    expect(registrationTs).toContain('if (supportsUserScriptsWorldId())');
  });
});
