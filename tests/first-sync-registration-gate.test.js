import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const backgroundCore = readFileSync(resolve(root, 'src/background/core.ts'), 'utf8');
const registrationTs = readFileSync(resolve(root, 'src/background/registration.ts'), 'utf8');
const dashboardHtml = readFileSync(resolve(root, 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(root, 'pages/dashboard.js'), 'utf8');
const settingsDefaults = JSON.parse(readFileSync(resolve(root, 'src/config/settings-defaults.json'), 'utf8'));
const settingsSchema = JSON.parse(readFileSync(resolve(root, 'src/config/settings-schema.json'), 'utf8'));
const settingsTypes = readFileSync(resolve(root, 'src/types/settings.ts'), 'utf8');

function extractFunction(source, name) {
  const marker = source.indexOf(`function ${name}`);
  const asyncMarker = source.indexOf(`async function ${name}`);
  const start = asyncMarker >= 0 && (marker < 0 || asyncMarker < marker) ? asyncMarker : marker;
  if (start < 0) throw new Error(`Function ${name} not found`);
  const parameterClose = source.indexOf(')', start);
  const brace = parameterClose >= 0 ? source.indexOf('{', parameterClose) : source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} did not close`);
}

describe('first-sync registration gate', () => {
  it('keeps quarantined scripts out of every registration sweep', () => {
    for (const source of [backgroundCore, registrationTs]) {
      const functionSource = extractFunction(source, 'isScriptEligibleForRegistration')
        .replace(/^export\s+/, '')
        .replace(/: Script \| null \| undefined/g, '')
        .replace(/: boolean/g, '');
      const isEligible = new Function(`${functionSource}; return isScriptEligibleForRegistration;`)();
      expect(isEligible({ enabled: true, settings: {} })).toBe(true);
      expect(isEligible({ enabled: false, settings: {} })).toBe(false);
      expect(isEligible({
        enabled: true,
        settings: { _importQuarantine: { source: 'test' } },
      })).toBe(false);
    }

    const runNow = backgroundCore.slice(
      backgroundCore.indexOf("case 'runScriptNow':"),
      backgroundCore.indexOf("case 'rescheduleChains':"),
    );
    expect(runNow).toContain('script.settings?._importQuarantine');
    expect(runNow).toContain('Review and enable this quarantined import before running it');
  });

  it('defines an opt-in setting with dashboard load/save bindings', () => {
    expect(settingsDefaults.syncHoldExecutionUntilFirstSync).toBe(false);
    expect(settingsTypes).toContain('syncHoldExecutionUntilFirstSync: boolean;');
    expect(settingsSchema.classifications.visible).toContain('syncHoldExecutionUntilFirstSync');
    expect(settingsSchema.metadata.syncHoldExecutionUntilFirstSync).toMatchObject({
      type: 'boolean',
      control: 'checkbox',
      elementId: 'settingsSyncHoldUntilFirstSync',
      default: false
    });

    expect(dashboardHtml).toContain('id="settingsSyncHoldUntilFirstSync"');
    expect(dashboardHtml).toContain('Wait for first sync before running scripts');
    expect(dashboardJs).toContain("elements.settingsSyncHoldUntilFirstSync = document.getElementById('settingsSyncHoldUntilFirstSync')");
    expect(dashboardJs).toContain('elements.settingsSyncHoldUntilFirstSync.checked = s.syncHoldExecutionUntilFirstSync === true');
    expect(dashboardJs).toContain("settingsSyncHoldUntilFirstSync: ['syncHoldExecutionUntilFirstSync', 'checked']");
    expect(dashboardJs).toContain("saveSettingOrThrow('syncHoldExecutionUntilFirstSync'");
  });

  it('gates live registration before diff or full registration can run', () => {
    const registerAll = extractFunction(backgroundCore, 'registerAllScripts');
    const gateIndex = registerAll.indexOf('getFirstSyncRegistrationGate(registrationSettings)');
    expect(gateIndex).toBeGreaterThan(0);
    expect(registerAll.indexOf('chrome.userScripts.getScripts()')).toBeGreaterThan(gateIndex);
    expect(registerAll.indexOf('chrome.userScripts.unregister().catch')).toBeGreaterThan(gateIndex);
    expect(registerAll).toContain("status: 'sync-first-run-held'");
    expect(registerAll).toContain("mode: 'sync-hold'");
    expect(registerAll).toContain('notifyFirstSyncRegistrationTimeout()');
    expect(registerAll).toContain('const settings = registrationSettings');
  });

  it('mirrors the hold gate in the extracted registration source', () => {
    const registerAll = extractFunction(registrationTs, 'registerAllScripts');
    const gateIndex = registerAll.indexOf('getFirstSyncRegistrationGate(settings)');
    expect(gateIndex).toBeGreaterThan(0);
    expect(registerAll.indexOf('await chrome.userScripts.unregister().catch')).toBeGreaterThan(gateIndex);
    expect(registerAll.indexOf('const scripts: Script[] = await ScriptStorage.getAll()')).toBeGreaterThan(gateIndex);
    expect(registrationTs).toContain('const SYNC_FIRST_RUN_REGISTRATION_HOLD_MS = 90 * 1000;');
    expect(registrationTs).toContain('settings.syncHoldExecutionUntilFirstSync === true');
  });

  it('releases the gate after successful sync results', () => {
    const syncAction = extractFunction(backgroundCore, 'runCloudSyncAction');
    const alarmBlock = backgroundCore.slice(backgroundCore.indexOf("alarm.name === 'autoSync'"), backgroundCore.indexOf("alarm.name === SUBSCRIPTION_REFRESH_ALARM"));
    const releaseFn = extractFunction(backgroundCore, 'maybeRegisterScriptsAfterSuccessfulSync');

    expect(releaseFn).toContain('result.success !== true');
    expect(releaseFn).toContain('await clearFirstSyncRegistrationHoldMarker()');
    expect(releaseFn).toContain('await registerAllScripts(true)');
    expect(syncAction).toContain('await maybeRegisterScriptsAfterSuccessfulSync(result)');
    expect(backgroundCore).toContain('sync: () => runCloudSyncAction()');
    expect(alarmBlock).toContain('await maybeRegisterScriptsAfterSuccessfulSync(result)');
  });
});
