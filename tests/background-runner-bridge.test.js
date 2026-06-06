import { describe, expect, it } from 'vitest';

import { prepareBackgroundRunnerPayload } from '../src/background/background-runner-bridge.ts';

function script({ grant = ['GM_getValue', 'GM_setValue', 'GM_notification'], code = 'GM_setValue("ok", true);', meta = {} } = {}) {
  const metaBlock = [
    '// ==UserScript==',
    '// @name Background Bridge Test',
    '// @namespace scriptvault.test',
    '// @version 1.0.0',
    '// @background',
    '// @crontab */10 * * * *',
    ...grant.map((item) => `// @grant ${item}`),
    '// ==/UserScript==',
  ].join('\n');
  return {
    id: 'background_bridge_test',
    enabled: true,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    settings: {},
    stats: { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: [],
    meta: {
      name: 'Background Bridge Test',
      namespace: 'scriptvault.test',
      version: '1.0.0',
      description: '',
      author: '',
      icon: '',
      icon64: '',
      homepage: '',
      homepageURL: '',
      website: '',
      source: '',
      updateURL: '',
      downloadURL: '',
      supportURL: '',
      license: '',
      copyright: '',
      contributionURL: '',
      match: [],
      include: [],
      exclude: [],
      excludeMatch: [],
      matchTop: [],
      excludeTop: [],
      'run-at': 'document-idle',
      'inject-into': 'auto',
      module: '',
      noframes: false,
      unwrap: false,
      sandbox: '',
      'run-in': '',
      grant,
      require: [],
      requireProvenance: [],
      requireIdentity: [],
      resource: {},
      connect: [],
      'top-level-await': false,
      webRequest: null,
      config: [],
      priority: 0,
      weight: 0,
      background: true,
      crontab: '*/10 * * * *',
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
      ...meta,
    },
    code: `${metaBlock}\n${code}`,
  };
}

describe('background runner bridge', () => {
  it('returns planner-disabled status without building a payload when the gate is off', () => {
    const result = prepareBackgroundRunnerPayload(script(), { experimentalBackgroundScripts: false });

    expect(result.status).toBe('gate-disabled');
    expect(result.executionEnabled).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.reason).toContain('experimentalBackgroundScripts');
  });

  it('prepares wrapper payload for eligible scripts without enabling execution', () => {
    const result = prepareBackgroundRunnerPayload(
      script(),
      { experimentalBackgroundScripts: true },
      { preloadedStorage: { ok: false }, now: () => 12345 },
    );

    expect(result.status).toBe('ready');
    expect(result.executionEnabled).toBe(false);
    expect(result.plan.enabled).toBe(true);
    expect(result.payload).toMatchObject({
      source: 'scriptvault-background-runner',
      scriptId: 'background_bridge_test',
      triggers: ['crontab'],
      preparedAt: 12345,
    });
    expect(result.payload.code).toContain('const __storage = Object.assign(Object.create(null), {"ok":false});');
    expect(result.reason).toContain('execution remains disabled');
  });

  it('reports wrapper-unsupported when the planner passes but wrapper construction rejects', () => {
    const result = prepareBackgroundRunnerPayload(
      script({ meta: { require: ['https://cdn.example.com/lib.js'] } }),
      { experimentalBackgroundScripts: true },
    );

    expect(result.plan.status).toBe('ready');
    expect(result.status).toBe('wrapper-unsupported');
    expect(result.executionEnabled).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.reason).toContain('@require');
  });

  it('carries reviewed budget clamps into prepared payloads', () => {
    const result = prepareBackgroundRunnerPayload(
      script(),
      { experimentalBackgroundScripts: true },
      { budget: { timeoutMs: 120000, maxQueuedRunsPerScript: -4 } },
    );

    expect(result.payload.budget).toEqual({
      timeoutMs: 60000,
      maxConcurrentPerScript: 1,
      maxQueuedRunsPerScript: 0,
    });
  });
});
