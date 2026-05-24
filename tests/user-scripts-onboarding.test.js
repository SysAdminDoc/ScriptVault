import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const popupJs = readFileSync(resolve(process.cwd(), 'pages/popup.js'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const messagesTs = readFileSync(resolve(process.cwd(), 'src/types/messages.ts'), 'utf8');

describe('Chrome userScripts onboarding diagnostics', () => {
  it('centralizes the live Chrome userScripts probe in the background worker', () => {
    expect(backgroundCore).toContain('async function probeUserScriptsAvailability()');
    expect(backgroundCore).toContain("await chrome.userScripts.getScripts();");
    expect(backgroundCore).toContain("setupState = 'allow-user-scripts-disabled';");
    expect(backgroundCore).toContain("setupState = 'developer-mode-disabled';");
    expect(backgroundCore).toContain("setupState = 'unsupported-browser';");
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
    expect(popupJs).toContain('function buildPopupSetupFallback(message = \'\')');
    expect(popupJs).toContain('showSetupWarning(status);');
    expect(popupJs).toContain('elements.setupWarning.dataset.setupState = status.setupState || \'unknown\';');
    expect(popupJs).toContain('const targetUrl = setupStatus?.setupUrl ||');

    expect(dashboardJs).toContain("chrome.runtime.sendMessage({ action: 'getExtensionStatus' })");
    expect(dashboardJs).toContain("banner.dataset.setupState = status?.setupState || 'unknown';");
    expect(dashboardJs).toContain("btnDirect.textContent = status?.setupAction || 'Open Extension Details';");
    expect(dashboardJs).toContain("chrome.tabs.create({ url: status?.setupUrl || 'chrome://extensions/?id=' + chrome.runtime.id });");
  });

  it('types the richer status response for TS consumers', () => {
    expect(messagesTs).toContain("type UserScriptsSetupState =");
    expect(messagesTs).toContain("'allow-user-scripts-disabled'");
    expect(messagesTs).toContain("'developer-mode-disabled'");
    expect(messagesTs).toContain('setupState: UserScriptsSetupState;');
    expect(messagesTs).toContain('repairRuntimeState: SuccessOrError<ExtensionStatusResponse>;');
  });
});
