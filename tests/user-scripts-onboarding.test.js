import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const popupJs = readFileSync(resolve(process.cwd(), 'pages/popup.js'), 'utf8');
const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const messagesTs = readFileSync(resolve(process.cwd(), 'src/types/messages.ts'), 'utf8');
const setupDoctorTs = readFileSync(resolve(process.cwd(), 'src/modules/user-scripts-setup.ts'), 'utf8');
const edgeSmoke = readFileSync(resolve(process.cwd(), 'scripts/smoke-edge-sideload.mjs'), 'utf8');
const firefoxSmoke = readFileSync(resolve(process.cwd(), 'scripts/smoke-firefox-sideload.mjs'), 'utf8');
const edgeSmokeEvidence = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/audit/edge-smoke-3.11.0.json'), 'utf8'));

describe('Chrome userScripts onboarding diagnostics', () => {
  it('centralizes the live Chrome userScripts probe in the background worker', () => {
    expect(backgroundCore).toContain('async function probeUserScriptsAvailability()');
    expect(backgroundCore).toContain("await chrome.userScripts.getScripts();");
    expect(backgroundCore).toContain("setupState = 'firefox-user-scripts-permission';");
    expect(backgroundCore).toContain("setupState = 'allow-user-scripts-disabled';");
    expect(backgroundCore).toContain("setupState = 'developer-mode-disabled';");
    expect(backgroundCore).toContain("setupState = 'unsupported-browser';");
    expect(backgroundCore).toContain('Grant ScriptVault the optional Firefox userScripts permission, then refresh runtime status.');
    expect(backgroundCore).toContain('Open Extension Details, enable "Allow User Scripts" for ScriptVault, then refresh status; reload the extension if this banner remains.');
    expect(backgroundCore).toContain('Open chrome://extensions and enable Developer Mode to run userscripts.');
  });

  it('keeps repairRuntimeState on the live probe instead of stale cached settings', () => {
    const repairBlock = backgroundCore.match(/case 'repairRuntimeState': \{[\s\S]*?case 'getSetting':/);

    expect(repairBlock?.[0]).toContain('const status = await configureUserScriptsWorld();');
    expect(repairBlock?.[0]).toContain('if (status.userScriptsAvailable)');
    expect(repairBlock?.[0]).toContain('await registerAllScripts(true);');
    expect(repairBlock?.[0]).toContain('return { success: true, ...status };');
    expect(repairBlock?.[0]).not.toContain('settings._userScriptsAvailable !== false && !!chrome.userScripts');
  });

  it('surfaces the canonical setup state in popup and dashboard diagnostics', () => {
    expect(setupDoctorTs).toContain('export function buildSetupDoctorView');
    expect(setupDoctorTs).toContain("'host-permission-needed'");
    expect(dashboardHtml).toContain('../modules/user-scripts-setup.js');
    expect(popupJs).toContain('const setupDoctor = globalThis.UserScriptsSetupDoctor;');
    expect(popupJs).toContain('function buildPopupSetupFallback(message = \'\')');
    expect(popupJs).toContain('function buildPopupSetupDoctorView(status = {})');
    expect(popupJs).toContain("chrome.permissions.request({ permissions: ['userScripts'] })");
    expect(popupJs).toContain("if (setupStatus?.setupState === 'firefox-user-scripts-permission')");
    expect(popupJs).toContain('showSetupWarning(status);');
    expect(popupJs).toContain('elements.setupWarning.dataset.setupState = setupStatus.setupState || \'unknown\';');
    expect(popupJs).toContain('const targetUrl = setupStatus?.setupUrl ||');

    expect(dashboardJs).toContain("chrome.runtime.sendMessage({ action: 'getExtensionStatus' })");
    expect(dashboardJs).toContain('function buildSetupDoctorView(status = {}, options = {})');
    expect(dashboardJs).toContain("chrome.permissions.request({ permissions: ['userScripts'] })");
    expect(dashboardJs).toContain("if (setupView.actionKind === 'request-firefox-user-scripts')");
    expect(dashboardJs).toContain("banner.dataset.setupState = setupView.setupState || status?.setupState || 'unknown';");
    expect(dashboardJs).toContain("btnDirect.textContent = setupView.actionLabel || status?.setupAction || 'Open Extension Details';");
    expect(dashboardJs).toContain("chrome.tabs.create({ url: setupView.setupUrl || status?.setupUrl || 'chrome://extensions/?id=' + chrome.runtime.id });");
  });

  it('types the richer status response for TS consumers', () => {
    expect(messagesTs).toContain("type UserScriptsSetupState =");
    expect(messagesTs).toContain("'firefox-user-scripts-permission'");
    expect(messagesTs).toContain("'allow-user-scripts-disabled'");
    expect(messagesTs).toContain("'developer-mode-disabled'");
    expect(messagesTs).toContain('setupState: UserScriptsSetupState;');
    expect(messagesTs).toContain('repairRuntimeState: SuccessOrError<ExtensionStatusResponse>;');
  });

  it('pins setup doctor smoke, host recovery, update rehydration, and support evidence', () => {
    expect(edgeSmoke).toContain('enabledBefore');
    expect(edgeSmoke).toContain('enabledAfter');
    expect(edgeSmokeEvidence.checks.edgeUserScriptsToggle).toMatchObject({
      present: true,
      enabledBefore: false,
      enabledAfter: true,
    });

    expect(firefoxSmoke).toContain("initialStatus?.setupState === 'firefox-user-scripts-permission'");
    expect(firefoxSmoke).toContain('Firefox userScripts permission button');
    expect(firefoxSmoke).toContain('usedHeadlessPermissionGrant = true');
    expect(firefoxSmoke).toContain("chrome.runtime.sendMessage({ action: 'repairRuntimeState' })");

    expect(popupJs).toContain("setupState: 'host-permission-needed'");
    expect(popupJs).toContain("action: 'queueHostAccessRequest'");
    expect(popupJs).toContain("chrome.permissions.request({ origins: [status.pattern] })");
    expect(dashboardJs).toContain('requestCurrentHostAccessFromDashboard');
    expect(dashboardJs).toContain("chrome.permissions.request({ origins: [status.pattern] })");

    expect(backgroundCore).toContain('if (stored._lastRegisteredVersion !== currentVersion)');
    expect(backgroundCore).toContain('needsForceReregister = true;');
    expect(backgroundCore).toContain('await registerAllScripts(needsForceReregister);');

    expect(backgroundCore).toContain('registration: _lastRegistrationSweep');
    expect(backgroundCore).toContain('includesScriptSource: false');
    expect(backgroundCore).toContain('includesScriptNames: false');
    expect(backgroundCore).toContain('includesUrls: false');
  });

  it('keeps one-shot run messages typed and wired through popup and dashboard', () => {
    expect(backgroundCore).toContain("case 'runScriptNow':");
    expect(backgroundCore).toContain('await chrome.userScripts.execute({');
    expect(backgroundCore).toContain("return { success: true, mode: 'userScripts.execute' };");
    expect(backgroundCore).toContain("return { success: true, mode: 'scripting.executeScript' };");

    expect(popupJs).toContain("action: 'runScriptNow', scriptId, tabId: tab.id");
    expect(dashboardHtml).toContain('id="btnEditorRunNow"');
    expect(dashboardHtml).toContain('Run on Tab');
    expect(dashboardJs).toContain('function supportsOneShotRunNow()');
    expect(dashboardJs).toContain("state.runtimeDescriptor?.browserName === 'firefox'");
    expect(dashboardJs).toContain('version >= 135');
    expect(dashboardJs).toContain('async function getRunNowTargetTab()');
    expect(dashboardJs).toContain("protocol === 'http:' || protocol === 'https:' || protocol === 'file:'");
    expect(dashboardJs).toContain("action: 'runScriptNow'");
    expect(dashboardJs).toContain('scriptId,');
    expect(dashboardJs).toContain('tabId: targetTab.id');
    expect(dashboardJs).toContain("runButtonTask(event.currentTarget, () => runScriptOnceOnTab(), { busyLabel: tDashboard('runningEllipsis', 'Running...') })");
    expect(dashboardJs).toContain('[data-action="runNow"]');
    expect(messagesTs).toContain("interface RunScriptNow");
    expect(messagesTs).toContain("action: 'runScriptNow';");
    expect(messagesTs).toContain('| ToggleScript | RunScriptNow | DuplicateScript');
    expect(messagesTs).toContain("runScriptNow: SuccessOrError<{ mode: 'userScripts.execute' | 'scripting.executeScript' }>;");
  });
});
