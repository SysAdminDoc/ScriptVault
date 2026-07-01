import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const dashboardLinter = readFileSync(resolve(process.cwd(), 'pages/dashboard-linter.js'), 'utf8');

function extractCronSource(src) {
  const start = src.indexOf('const CRON_MONTH_NAMES');
  const end = src.indexOf('/** Execute a @crontab script', start);
  if (start < 0 || end < 0) throw new Error('Unable to extract cron helpers');
  return src.slice(start, end);
}

function extractCrontabExecutionSource(src) {
  const start = src.indexOf('async function executeWrappedScriptInTab');
  const end = src.indexOf('/** Create/refresh chrome alarms', start);
  if (start < 0 || end < 0) throw new Error('Unable to extract crontab execution source');
  return src.slice(start, end);
}

function createCronHarness() {
  const alarms = [];
  const debug = [];
  const chrome = {
    alarms: {
      create(name, options) {
        alarms.push({ name, options });
      },
    },
  };
  const debugLog = message => debug.push(String(message));
  const _body = `${extractCronSource(backgroundCore)}
return { parseCronExpression, nextCronFire, scheduleCrontabAlarm };`;
  let helpers;
  try { const vm = require('node:vm'); helpers = vm.compileFunction(_body, ['chrome', 'debugLog'], { filename: resolve(process.cwd(), 'background.core.js') })(chrome, debugLog); } catch { helpers = new Function('chrome', 'debugLog', _body)(chrome, debugLog); }
  return { ...helpers, alarms, debug };
}

function createLinter() {
  const _body = `${dashboardLinter}
return AdvancedLinter;`;
  try { const vm = require('node:vm'); const _fn = vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'pages/dashboard-linter.js') }); return _fn(); } catch { return new Function(_body)(); }
}

function localDate(year, month, day, hour, minute, second = 0) {
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function localParts(date) {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

function expectNext(expr, from, expectedParts) {
  const { nextCronFire } = createCronHarness();
  const result = nextCronFire(expr, from);
  expect(result.ok, result.error).toBe(true);
  expect(localParts(result.date)).toEqual(expectedParts);
  return result;
}

function userscriptWithCrontab(crontab) {
  return `// ==UserScript==
// @name Cron Test
// @version 1.0.0
// @description Cron lint test
// @author ScriptVault
// @match https://example.com/*
// @crontab ${crontab}
// ==/UserScript==
console.log("cron");`;
}

describe('@crontab next-fire engine', () => {
  it('matches representative cron expressions against local next-fire times', () => {
    expectNext('*/5 * * * *', localDate(2026, 6, 1, 9, 2, 30), [2026, 6, 1, 9, 5]);
    expectNext('0 */2 * * *', localDate(2026, 6, 1, 9, 30), [2026, 6, 1, 10, 0]);
    expectNext('30 9 * * 1', localDate(2026, 6, 1, 9, 29, 30), [2026, 6, 1, 9, 30]);
    expectNext('30 9 * * 1', localDate(2026, 6, 1, 9, 31), [2026, 6, 8, 9, 30]);
    expectNext('15 14 1,15 * *', localDate(2026, 6, 1, 14, 16), [2026, 6, 15, 14, 15]);
    expectNext('0 9-17/2 * * 1-5', localDate(2026, 6, 1, 9, 1), [2026, 6, 1, 11, 0]);
    expectNext('0 9 * * 5-7', localDate(2026, 6, 5, 9, 1), [2026, 6, 6, 9, 0]);
    expectNext('0 9 * jun mon', localDate(2026, 6, 1, 9, 1), [2026, 6, 8, 9, 0]);
  });

  it('rejects invalid expressions instead of silently falling back to hourly alarms', () => {
    const { nextCronFire } = createCronHarness();

    expect(nextCronFire('bad', localDate(2026, 6, 1, 9, 0))).toMatchObject({
      ok: false,
      error: expect.stringContaining('expected 5 fields'),
    });
    expect(nextCronFire('60 * * * *', localDate(2026, 6, 1, 9, 0))).toMatchObject({
      ok: false,
      error: expect.stringContaining('minute'),
    });
    expect(nextCronFire('0 0 31 2 *', localDate(2026, 1, 1, 0, 0))).toMatchObject({
      ok: false,
      error: expect.stringContaining('no matching fire time'),
    });
  });

  it('schedules one-shot alarms at the computed next fire time', () => {
    const { scheduleCrontabAlarm, alarms } = createCronHarness();
    const result = scheduleCrontabAlarm(
      { id: 'abc', meta: { name: 'Cron Test', crontab: '30 9 * * 1' } },
      localDate(2026, 6, 1, 9, 29, 30)
    );

    expect(result.ok).toBe(true);
    expect(alarms).toEqual([
      { name: 'crontab_abc', options: { when: result.when } },
    ]);
    expect(alarms[0].options).not.toHaveProperty('periodInMinutes');
  });

  it('keeps the crontab scheduler free of period fallbacks', () => {
    const cronSource = extractCronSource(backgroundCore);

    expect(cronSource).not.toContain('parseCronToMinutes');
    expect(cronSource).not.toContain('periodInMinutes');
    expect(cronSource).toContain('chrome.alarms.create(alarmName, { when: next.when })');
  });

  it('executes scheduled scripts outside the extension isolated world', () => {
    const executionSource = extractCrontabExecutionSource(backgroundCore);

    expect(executionSource).toContain('chrome.userScripts.execute');
    expect(executionSource).toContain("world: 'USER_SCRIPT'");
    expect(executionSource).toContain('chrome.scripting.executeScript');
    expect(executionSource).toContain("world: 'MAIN'");
    expect(executionSource).not.toContain("world: 'ISOLATED'");
    expect(executionSource).not.toContain('new Function');
  });

  it('blocks MAIN-world crontab fallback unless the script explicitly requests page context', () => {
    const executionSource = extractCrontabExecutionSource(backgroundCore);

    expect(executionSource).toContain('wantsPageContext');
    expect(executionSource).toContain('MAIN-world fallback blocked');
  });

  it('blocks MAIN-world runScriptNow fallback unless the script explicitly requests page context', () => {
    const runNowStart = backgroundCore.indexOf("case 'runScriptNow':");
    const runNowEnd = backgroundCore.indexOf("case 'getExtensionInfo':", runNowStart);
    const runNowSource = backgroundCore.slice(runNowStart, runNowEnd);

    expect(runNowSource).toContain('wantsPageContext');
    expect(runNowSource).toContain('MAIN-world fallback is not allowed');
    expect(runNowSource).toContain("inject-into");
  });

  it('routes context-menu script execution through the shared USER_SCRIPT-world helper', () => {
    const ctxStart = backgroundCore.indexOf("info.menuItemId.startsWith('scriptvault-ctx-')");
    const ctxEnd = backgroundCore.indexOf('// Feedback notification', ctxStart);
    expect(ctxStart).toBeGreaterThan(-1);
    expect(ctxEnd).toBeGreaterThan(ctxStart);
    const ctxSource = backgroundCore.slice(ctxStart, ctxEnd);

    expect(ctxSource).toContain('executeWrappedScriptInTab');
    expect(ctxSource).toContain('ctxWantsPage');
    expect(ctxSource).not.toContain('chrome.scripting.executeScript');
  });
});

describe('@crontab editor linting', () => {
  it('accepts valid five-field crontab metadata', () => {
    const linter = createLinter();
    const issues = linter.lint(userscriptWithCrontab('30 9 * * 1'));

    expect(issues.filter(issue => issue.ruleId === 'invalid-crontab')).toEqual([]);
  });

  it('surfaces invalid crontab metadata as an editor error', () => {
    const linter = createLinter();
    const issues = linter.lint(userscriptWithCrontab('60 * * * *'));
    const cronIssues = issues.filter(issue => issue.ruleId === 'invalid-crontab');

    expect(cronIssues).toHaveLength(1);
    expect(cronIssues[0]).toMatchObject({
      severity: 'error',
      message: expect.stringContaining('minute'),
    });
  });
});
