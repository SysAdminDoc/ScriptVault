import { describe, expect, it } from 'vitest';

import {
  BACKGROUND_RUNNER_ALLOWED_GRANTS,
  DEFAULT_BACKGROUND_RUNNER_BUDGET,
  getUnsupportedBackgroundGrants,
  normalizeBackgroundGrant,
  normalizeBackgroundRunnerBudget,
  planBackgroundScript,
} from '../src/background/background-runner.ts';

function candidate(meta = {}, enabled = true) {
  return {
    enabled,
    meta: {
      background: true,
      grant: ['GM_getValue', 'GM_setValue', 'GM_notification'],
      crontab: '*/5 * * * *',
      ...meta,
    },
  };
}

describe('background runner planning contract', () => {
  it('keeps the future runner disabled behind experimentalBackgroundScripts', () => {
    const plan = planBackgroundScript(candidate(), { experimentalBackgroundScripts: false });

    expect(plan.status).toBe('gate-disabled');
    expect(plan.enabled).toBe(false);
    expect(plan.reason).toContain('experimentalBackgroundScripts');
  });

  it('rejects non-background and disabled candidates before runner eligibility', () => {
    expect(planBackgroundScript(candidate({ background: false }), { experimentalBackgroundScripts: true }).status)
      .toBe('not-background');
    expect(planBackgroundScript(candidate({}, false), { experimentalBackgroundScripts: true }).status)
      .toBe('script-disabled');
  });

  it('normalizes GM namespace aliases for the allowed DOM-less API surface', () => {
    expect(normalizeBackgroundGrant('GM.getValue')).toBe('GM_getValue');
    expect(normalizeBackgroundGrant('GM.xmlHttpRequest')).toBe('GM_xmlhttpRequest');
    expect(BACKGROUND_RUNNER_ALLOWED_GRANTS.has('GM_addElement')).toBe(false);

    const unsupported = getUnsupportedBackgroundGrants({
      grant: ['GM.getValue', 'GM_addElement', 'GM.openInTab', 'GM_registerMenuCommand'],
    });

    expect(unsupported).toEqual(['GM.openInTab', 'GM_addElement', 'GM_registerMenuCommand']);
  });

  it('requires a supported automatic trigger before reporting ready', () => {
    const missing = planBackgroundScript(candidate({ crontab: '' }), { experimentalBackgroundScripts: true });
    const ready = planBackgroundScript(candidate(), { experimentalBackgroundScripts: true });

    expect(missing.status).toBe('missing-trigger');
    expect(missing.enabled).toBe(false);
    expect(ready.status).toBe('ready');
    expect(ready.enabled).toBe(true);
    expect(ready.triggers).toEqual(['crontab']);
  });

  it('blocks unsupported grants before reporting ready', () => {
    const plan = planBackgroundScript(
      candidate({ grant: ['GM_getValue', 'GM_addElement', 'GM_openInTab'] }),
      { experimentalBackgroundScripts: true },
    );

    expect(plan.status).toBe('unsupported-grants');
    expect(plan.enabled).toBe(false);
    expect(plan.unsupportedGrants).toEqual(['GM_addElement', 'GM_openInTab']);
  });

  it('clamps budget overrides to the reviewed runner limits', () => {
    expect(DEFAULT_BACKGROUND_RUNNER_BUDGET).toEqual({
      timeoutMs: 30000,
      maxConcurrentPerScript: 1,
      maxQueuedRunsPerScript: 3,
    });
    expect(normalizeBackgroundRunnerBudget({
      timeoutMs: 120000,
      maxConcurrentPerScript: 9,
      maxQueuedRunsPerScript: -1,
    })).toEqual({
      timeoutMs: 60000,
      maxConcurrentPerScript: 1,
      maxQueuedRunsPerScript: 0,
    });
  });
});
