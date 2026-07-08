import { beforeEach, describe, expect, it, vi } from 'vitest';

function createDnrHarness({ initialRules = [], failUpdates = [] } = {}) {
  let liveRules = initialRules.map((rule) => ({ ...rule }));
  const failures = [...failUpdates];

  const getDynamicRules = vi.fn(async () => liveRules.map((rule) => ({ ...rule })));
  const updateDynamicRules = vi.fn(async ({ removeRuleIds = [], addRules = [] } = {}) => {
    const failure = failures.shift();
    if (failure) throw failure;

    if (removeRuleIds.length) {
      liveRules = liveRules.filter((rule) => !removeRuleIds.includes(rule.id));
    }
    if (addRules.length) {
      liveRules = [
        ...liveRules.filter((rule) => !addRules.some((added) => added.id === rule.id)),
        ...addRules.map((rule) => ({ ...rule })),
      ];
    }
  });

  chrome.declarativeNetRequest = {
    getDynamicRules,
    updateDynamicRules,
  };

  return {
    getDynamicRules,
    updateDynamicRules,
    liveRules: () => liveRules.map((rule) => ({ ...rule })),
  };
}

async function readStoredMap() {
  return (await chrome.storage.local.get('_webRequestRuleMap'))._webRequestRuleMap || {};
}

async function loadFreshDnrModule(scripts = []) {
  vi.resetModules();
  const debugLog = vi.fn();
  const getAll = vi.fn(async () => scripts);

  vi.doMock('../src/modules/storage.ts', () => ({
    debugLog,
    ScriptStorage: { getAll },
  }));

  const module = await import('../src/background/dnr-rules.ts');
  return { ...module, debugLog, getAll };
}

function scriptContext(overrides = {}) {
  const { meta = {}, ...rest } = overrides;
  return {
    id: 'script-a',
    meta: {
      name: 'Scoped Script',
      match: ['https://example.com/*'],
      include: [],
      connect: [],
      ...meta,
    },
    settings: {},
    ...rest,
  };
}

beforeEach(() => {
  globalThis.__resetStorageMock();
  vi.restoreAllMocks();
});

describe('source DNR GM_webRequest rules', () => {
  it('hydrates persisted rule ownership before removal after a module reload', async () => {
    const dnr = createDnrHarness();
    const first = await loadFreshDnrModule();

    const result = await first.applyWebRequestRules('script-a', [
      { selector: { url: '||example.com' }, action: { cancel: true } },
    ], { script: scriptContext() });

    const ruleId = dnr.liveRules()[0].id;
    expect(result).toMatchObject({ success: true, count: 1 });
    expect(ruleId).toBeGreaterThan(first.WEB_REQUEST_RULE_ID_BASE);
    expect(dnr.liveRules().map((rule) => rule.id)).toEqual([ruleId]);
    expect(dnr.liveRules()[0].condition.initiatorDomains).toEqual(['example.com']);
    expect(await readStoredMap()).toEqual({ 'script-a': [ruleId] });

    const afterRestart = await loadFreshDnrModule();
    await afterRestart.removeWebRequestRules('script-a');

    expect(dnr.liveRules()).toEqual([]);
    expect(await readStoredMap()).toEqual({});
  });

  it('rolls back newly added DNR rules when map persistence fails', async () => {
    const dnr = createDnrHarness();
    const module = await loadFreshDnrModule();
    chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA'));

    await module.applyWebRequestRules('script-b', [
      { selector: { url: '||rollback.example' }, action: { cancel: true } },
    ], { script: scriptContext({ id: 'script-b', meta: { match: ['https://rollback.example/*'] } }) });

    expect(dnr.liveRules()).toEqual([]);
    const addCall = dnr.updateDynamicRules.mock.calls.find(([arg]) => arg.addRules?.length);
    const addedRuleId = addCall?.[0]?.addRules?.[0]?.id;
    expect(addedRuleId).toBeGreaterThan(module.WEB_REQUEST_RULE_ID_BASE);
    expect(dnr.updateDynamicRules).toHaveBeenCalledWith(expect.objectContaining({
      addRules: expect.arrayContaining([expect.objectContaining({ id: addedRuleId })]),
    }));
    expect(dnr.updateDynamicRules).toHaveBeenCalledWith({ removeRuleIds: [addedRuleId] });
  });

  it('allocates unique rule IDs for scripts that collide under the legacy hash range', async () => {
    const dnr = createDnrHarness();
    const module = await loadFreshDnrModule();
    const collidingScriptIds = ['script-160', 'script-28001'];

    const legacyId = (scriptId) => {
      let h = 0;
      for (let i = 0; i < scriptId.length; i += 1) {
        h = (h * 31 + scriptId.charCodeAt(i)) & 0x7fffffff;
      }
      return (((h & 0x1fffff) << 10) | 0) + 1;
    };
    expect(legacyId(collidingScriptIds[0])).toBe(legacyId(collidingScriptIds[1]));

    for (const scriptId of collidingScriptIds) {
      const result = await module.applyWebRequestRules(scriptId, [
        { selector: { url: '||example.com' }, action: { cancel: true } },
      ], { script: scriptContext({ id: scriptId }) });
      expect(result).toMatchObject({ success: true, count: 1 });
    }

    const storedMap = await readStoredMap();
    const firstRuleId = storedMap[collidingScriptIds[0]][0];
    const secondRuleId = storedMap[collidingScriptIds[1]][0];
    expect(firstRuleId).toBeGreaterThan(module.WEB_REQUEST_RULE_ID_BASE);
    expect(secondRuleId).toBe(firstRuleId + 1);
    expect(dnr.liveRules().map((rule) => rule.id).sort((a, b) => a - b)).toEqual([firstRuleId, secondRuleId]);
  });

  it('keeps persisted ownership when DNR removal fails and the live rule still exists', async () => {
    const ruleId = 88123;
    const dnr = createDnrHarness({
      initialRules: [{ id: ruleId, condition: {}, action: { type: 'block' } }],
      failUpdates: [new Error('DNR unavailable')],
    });
    await chrome.storage.local.set({ _webRequestRuleMap: { 'script-c': [ruleId] } });
    const module = await loadFreshDnrModule();

    await module.removeWebRequestRules('script-c');

    expect(dnr.liveRules().map((rule) => rule.id)).toEqual([ruleId]);
    expect(await readStoredMap()).toEqual({ 'script-c': [ruleId] });

    await module.removeWebRequestRules('script-c');

    expect(dnr.liveRules()).toEqual([]);
    expect(await readStoredMap()).toEqual({});
  });

  it('reconciles orphaned persisted owners only after DNR removal succeeds', async () => {
    const orphanRuleId = 90101;
    const liveRuleId = 90202;
    const dnr = createDnrHarness({
      initialRules: [
        { id: orphanRuleId, condition: {}, action: { type: 'block' } },
        { id: liveRuleId, condition: {}, action: { type: 'block' } },
      ],
    });
    await chrome.storage.local.set({
      _webRequestRuleMap: {
        deleted: [orphanRuleId],
        live: [liveRuleId],
      },
    });
    const module = await loadFreshDnrModule([{ id: 'live' }]);

    await module.reconcileWebRequestRuleMap();

    expect(dnr.liveRules().map((rule) => rule.id)).toEqual([liveRuleId]);
    expect(await readStoredMap()).toEqual({ live: [liveRuleId] });
  });

  it('rejects rules targeting hosts outside script scope without @connect', async () => {
    const dnr = createDnrHarness();
    const module = await loadFreshDnrModule();

    const result = await module.applyWebRequestRules('script-scope', [
      { selector: { url: '||other.com' }, action: { cancel: true } },
    ], { script: scriptContext({ id: 'script-scope' }) });

    expect(result).toMatchObject({
      success: false,
      error: 'GM_webRequest target other.com blocked by script host scope',
    });
    expect(dnr.liveRules()).toEqual([]);
  });

  it('allows explicit @connect hosts while keeping DNR initiator scoped to run hosts', async () => {
    const dnr = createDnrHarness();
    const module = await loadFreshDnrModule();

    const result = await module.applyWebRequestRules('script-connect', [
      { selector: { include: ['||api.other.com'] }, action: 'cancel' },
    ], {
      script: scriptContext({
        id: 'script-connect',
        meta: {
          match: ['https://example.com/*'],
          connect: ['api.other.com'],
        },
      }),
    });

    expect(result).toMatchObject({ success: true, count: 1 });
    expect(dnr.liveRules()).toHaveLength(1);
    expect(dnr.liveRules()[0]).toMatchObject({
      condition: {
        urlFilter: '||api.other.com',
        initiatorDomains: ['example.com'],
      },
      action: { type: 'block' },
    });
  });

  it('translates response-header match conditions into DNR rules', async () => {
    const dnr = createDnrHarness();
    const module = await loadFreshDnrModule();

    const result = await module.applyWebRequestRules('script-response-headers', [
      {
        selector: {
          url: '||example.com',
          responseHeaders: [{ header: 'content-type', values: ['text/html*'] }],
          excludedResponseHeaders: [{ header: 'x-scriptvault-skip' }],
        },
        action: { setResponseHeaders: { 'x-scriptvault-matched': '1' } },
      },
    ], { script: scriptContext({ id: 'script-response-headers' }) });

    expect(result).toMatchObject({ success: true, count: 1 });
    expect(dnr.liveRules()).toHaveLength(1);
    expect(dnr.liveRules()[0]).toMatchObject({
      condition: {
        urlFilter: '||example.com',
        initiatorDomains: ['example.com'],
        responseHeaders: [{ header: 'content-type', values: ['text/html*'] }],
        excludedResponseHeaders: [{ header: 'x-scriptvault-skip' }],
      },
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: 'x-scriptvault-matched', operation: 'set', value: '1' }],
      },
    });
  });

  it('rejects CSP header stripping unless Modify CSP is explicitly enabled', async () => {
    const dnr = createDnrHarness();
    const module = await loadFreshDnrModule();
    const cspRule = {
      selector: { url: '||example.com' },
      action: { setResponseHeaders: { 'content-security-policy': null } },
    };

    const blocked = await module.applyWebRequestRules('script-csp', [cspRule], {
      script: scriptContext({ id: 'script-csp' }),
      settings: { modifyCSP: 'auto' },
    });
    expect(blocked).toMatchObject({
      success: false,
      error: 'GM_webRequest CSP header changes require Modify CSP = yes',
    });
    expect(dnr.liveRules()).toEqual([]);

    const allowed = await module.applyWebRequestRules('script-csp', [cspRule], {
      script: scriptContext({ id: 'script-csp' }),
      settings: { modifyCSP: 'yes' },
    });
    expect(allowed).toMatchObject({ success: true, count: 1 });
    expect(dnr.liveRules()).toHaveLength(1);
  });
});
