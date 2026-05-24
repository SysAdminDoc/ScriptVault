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

beforeEach(() => {
  globalThis.__resetStorageMock();
  vi.restoreAllMocks();
});

describe('source DNR GM_webRequest rules', () => {
  it('hydrates persisted rule ownership before removal after a module reload', async () => {
    const dnr = createDnrHarness();
    const first = await loadFreshDnrModule();

    await first.applyWebRequestRules('script-a', [
      { selector: { url: '||example.com' }, action: { cancel: true } },
    ]);

    const ruleId = first._makeRuleId('script-a', 0);
    expect(dnr.liveRules().map((rule) => rule.id)).toEqual([ruleId]);
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
    ]);

    expect(dnr.liveRules()).toEqual([]);
    expect(dnr.updateDynamicRules).toHaveBeenCalledWith(expect.objectContaining({
      addRules: expect.arrayContaining([expect.objectContaining({ id: module._makeRuleId('script-b', 0) })]),
    }));
    expect(dnr.updateDynamicRules).toHaveBeenCalledWith({ removeRuleIds: [module._makeRuleId('script-b', 0)] });
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
});
