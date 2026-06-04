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
const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const popupHtml = readFileSync(resolve(process.cwd(), 'pages/popup.html'), 'utf8');
const amoSourceReadme = readFileSync(resolve(process.cwd(), 'AMO-SOURCE-README.md'), 'utf8');
const storeCopyCheck = readFileSync(resolve(process.cwd(), 'scripts/check-permission-copy.mjs'), 'utf8');

function readPngDimensions(file) {
  const png = readFileSync(resolve(process.cwd(), file));
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe('Firefox AMO validation gate', () => {
  it('declares AMO data collection permissions explicitly', () => {
    const gecko = firefoxManifest.browser_specific_settings?.gecko;

    expect(gecko?.id).toBe('ScriptVault@sysadmindoc.dev');
    expect(gecko?.strict_min_version).toBe('140.0');
    expect(firefoxManifest.browser_specific_settings).not.toHaveProperty('gecko_android');
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
    expect(buildFirefox).toContain('git -C "$SCRIPT_DIR" archive --format=zip');
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

  it('pins Firefox polish UI gates, keyboard commands, and action icons', () => {
    expect(dashboardHtml).toContain('id="aboutBrowserBuild"');
    expect(dashboardHtml).toContain('id="firefoxSyncNote"');
    expect(dashboardHtml).toContain('id="firefoxCloudNote"');
    expect(dashboardJs).toContain('function getDashboardRuntimeDescriptor()');
    expect(dashboardJs).toContain('function applyRuntimeProviderGate()');
    expect(dashboardJs).toContain('supportedSyncProviders: isFirefox ? [');
    expect(dashboardJs).toContain("option.hidden = !supportedOption");
    expect(dashboardJs).toContain("option.disabled = !supportedOption");
    expect(firefoxSmoke).toContain('aboutBrowserBuild');
    expect(firefoxSmoke).toContain('unsupportedSyncOptions');
    expect(firefoxSmoke).toContain('popupWidthOk');
    expect(firefoxSmoke).toContain('themeChecks');

    expect(firefoxManifest.commands._execute_action.suggested_key.default).toBe('Alt+Shift+S');
    expect(firefoxManifest.commands.open_dashboard.suggested_key.default).toBe('Alt+Shift+D');
    expect(firefoxManifest.commands.toggle_scripts.suggested_key.default).toBe('Alt+Shift+E');
    expect(new Set(Object.values(firefoxManifest.commands).map(command => command.suggested_key.default)).size).toBe(3);

    for (const size of [16, 32, 48, 128]) {
      expect(firefoxManifest.icons[String(size)]).toBe(`images/icon${size}.png`);
      expect(readPngDimensions(`images/icon${size}.png`)).toEqual({ width: size, height: size });
    }
    expect(firefoxManifest.action.default_icon).toEqual({
      16: 'images/icon16.png',
      32: 'images/icon32.png',
    });
    expect(popupHtml).toContain('width: 360px;');
    expect(popupHtml).toContain('html[data-theme="light"]');
  });

  it('includes AMO source-review instructions and privacy rationale', () => {
    expect(amoSourceReadme).toContain('Reviewer Build Instructions');
    expect(amoSourceReadme).toContain('npm run firefox:package');
    expect(amoSourceReadme).toContain('scriptvault-firefox-v<version>.zip');
    expect(amoSourceReadme).toContain('scriptvault-firefox-source-v<version>.zip');
    expect(amoSourceReadme).toContain('AMO Data Collection Copy');
    expect(amoSourceReadme).toContain('Required data collection: `none`');
    expect(amoSourceReadme).toContain('Permission Rationale');
    expect(amoSourceReadme).toContain('Manual Submission Steps');
    expect(amoSourceReadme).toContain('unlisted');
    expect(storeCopyCheck).toContain("const amoSourceReadmePath = 'AMO-SOURCE-README.md'");
    expect(storeCopyCheck).toContain('amoSourceReadmeNeedles');
  });
});
