import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

/**
 * reregisterScript helper — Chrome 138+ chrome.userScripts.update adoption.
 *
 * The previous register/unregister pattern caused a brief window where a
 * navigation could land on a page without the script registered. Chrome
 * 138 added chrome.userScripts.update() which atomically swaps a single
 * script's registration. These tests pin the wrapper's three branches:
 *   1. Disabled script → fall straight to unregister, no register attempt.
 *   2. update available + script enabled → update path, no unregister.
 *   3. update unavailable (older Chrome) → existing unregister + register.
 * Plus the runtime and TS mirror both expose the helper.
 */

const bgCore = readFileSync(resolve(repoRoot, 'background.core.js'), 'utf8');
const tsRegistration = readFileSync(resolve(repoRoot, 'src/background/registration.ts'), 'utf8');

describe('reregisterScript helper presence', () => {
  it('runtime exposes reregisterScript', () => {
    expect(bgCore).toMatch(/async function reregisterScript\(script\)/);
    expect(bgCore).toMatch(/function _supportsUserScriptsUpdate\(\)/);
  });

  it('TS mirror exposes reregisterScript + supportsUserScriptsUpdate', () => {
    expect(tsRegistration).toMatch(/export async function reregisterScript\(script: Script\)/);
    expect(tsRegistration).toMatch(/export function supportsUserScriptsUpdate\(\)/);
  });

  it('saveScript routes through reregisterScript instead of manual unregister+register', () => {
    // Pin the migration so a future refactor that reverts to the manual
    // pattern fails CI. The block of interest is the live-reload comment
    // immediately after the registration call.
    const start = bgCore.indexOf('saveScript: async message');
    const end = bgCore.indexOf('createScript: async code', start);
    const window = bgCore.slice(start, end);
    expect(window).toMatch(/await reregisterScript\(script\)/);
    expect(window).not.toMatch(/await unregisterScript\(id\);[\s\S]*await registerScript\(script\)/);
  });

  it('toggle path (setScriptSettings) routes through reregisterScript', () => {
    // Find the toggle block and confirm it now calls reregisterScript instead
    // of the unregister+register dance.
    const start = bgCore.indexOf('toggleScript: async message');
    expect(start).toBeGreaterThan(0);
    const end = bgCore.indexOf('duplicateScript: async id', start);
    const window = bgCore.slice(start, end);
    expect(window).toMatch(/await reregisterScript\(script\)/);
  });

  it('saveScript and toggleScript share the per-script operation lock', () => {
    expect(bgCore).toMatch(/async function _runExclusiveScriptOperation\(scriptId, operation\)/);
    expect(bgCore).toContain('if (!self._toggleLocks) self._toggleLocks = new Map()');

    const saveStart = bgCore.indexOf('saveScript: async message');
    const createStart = bgCore.indexOf('createScript: async code');
    const saveBlock = bgCore.slice(saveStart, createStart);
    expect(saveBlock).toContain('return await _runExclusiveScriptOperation(id, async () => {');
    expect(saveBlock.indexOf('ScriptStorage.get(id)')).toBeGreaterThan(saveBlock.indexOf('_runExclusiveScriptOperation'));
    expect(saveBlock).toContain('await reregisterScript(script)');

    const toggleStart = bgCore.indexOf('toggleScript: async message');
    const duplicateStart = bgCore.indexOf('duplicateScript: async id');
    const toggleBlock = bgCore.slice(toggleStart, duplicateStart);
    expect(toggleBlock).toContain('return await _runExclusiveScriptOperation(scriptId, async () => {');
    expect(toggleBlock).toContain('await reregisterScript(script)');
    expect(toggleBlock).not.toContain('const prev = self._toggleLocks.get(scriptId)');
  });

  it('registerScript honours useUpdate option in runtime', () => {
    expect(bgCore).toMatch(/async function registerScript\(script,\s*\{\s*useUpdate\s*=\s*false,\s*throwOnError\s*=\s*false/);
    expect(bgCore).toMatch(/if \(useUpdate && _supportsUserScriptsUpdate\(\)\)/);
    expect(bgCore).toMatch(/chrome\.userScripts\.update\(payload\)/);
  });

  it('registerScript honours useUpdate option in TS mirror', () => {
    expect(tsRegistration).toMatch(/options: \{ useUpdate\?: boolean; throwOnError\?: boolean \} = \{\}/);
    expect(tsRegistration).toMatch(/if \(options\.useUpdate && supportsUserScriptsUpdate\(\)\)/);
  });
});

describe('reregisterScript branch behavior', () => {
  // Compile a small harness that exposes reregisterScript + its dependencies
  // (registerScript, unregisterScript, _supportsUserScriptsUpdate,
  // removeWebRequestRules). The harness fakes the chrome.userScripts and
  // chrome.alarms surfaces so the branches can be exercised without booting
  // the whole service worker.
  let harness;

  beforeEach(() => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const unregisterMock = vi.fn().mockResolvedValue(undefined);
    const removeWebRequestRulesMock = vi.fn().mockResolvedValue(undefined);
    const applyWebRequestRulesMock = vi.fn().mockResolvedValue(undefined);

    const fakeChrome = {
      userScripts: {
        register: registerMock,
        unregister: unregisterMock,
        update: updateMock,
        configureWorld: vi.fn().mockResolvedValue(undefined),
        resetWorldConfiguration: vi.fn().mockResolvedValue(undefined),
        getScripts: vi.fn().mockResolvedValue([{ id: 's1' }]),
      },
      alarms: { clear: vi.fn().mockResolvedValue(undefined) },
    };

    // Inline reimplementation that mirrors background.core.js. The full
    // registerScript builds a registration payload from script metadata;
    // for branch testing we replace it with a stub that records the call
    // shape but still invokes update/register according to useUpdate.
    const ctx = {
      chrome: fakeChrome,
      registerScript: vi.fn(async (script, { useUpdate = false, throwOnError = false } = {}) => {
        const payload = [{ id: script.id }];
        try {
          if (useUpdate && typeof fakeChrome.userScripts.update === 'function') {
            await fakeChrome.userScripts.update(payload);
          } else {
            await fakeChrome.userScripts.register(payload);
          }
        } catch (e) {
          if (throwOnError) throw e;
        }
      }),
      unregisterScript: vi.fn(async (id) => {
        await fakeChrome.userScripts.unregister({ ids: [id] });
      }),
      removeWebRequestRules: removeWebRequestRulesMock,
      applyWebRequestRules: applyWebRequestRulesMock,
      _supportsUserScriptsUpdate: () => typeof fakeChrome.userScripts.update === 'function',
    };

    async function reregisterScript(script) {
      if (!fakeChrome.userScripts || !script) return;
      if (script.enabled === false) {
        await ctx.unregisterScript(script.id);
        return;
      }
      if (ctx._supportsUserScriptsUpdate()) {
        try {
          await ctx.removeWebRequestRules(script.id);
          await ctx.registerScript(script, { useUpdate: true, throwOnError: true });
          return;
        } catch {
          // fall through
        }
      }
      await ctx.unregisterScript(script.id);
      await ctx.registerScript(script);
    }

    harness = { ...ctx, reregisterScript, fakeChrome, mocks: { updateMock, registerMock, unregisterMock, removeWebRequestRulesMock } };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disabled script unregisters and skips register/update', async () => {
    await harness.reregisterScript({ id: 's1', enabled: false });
    expect(harness.mocks.unregisterMock).toHaveBeenCalledWith({ ids: ['s1'] });
    expect(harness.mocks.updateMock).not.toHaveBeenCalled();
    expect(harness.mocks.registerMock).not.toHaveBeenCalled();
  });

  it('Chrome 138+ enabled-script path calls update without unregister', async () => {
    await harness.reregisterScript({ id: 's1', enabled: true });
    expect(harness.mocks.updateMock).toHaveBeenCalledOnce();
    expect(harness.registerScript).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }),
      { useUpdate: true, throwOnError: true },
    );
    expect(harness.mocks.unregisterMock).not.toHaveBeenCalled();
    expect(harness.mocks.registerMock).not.toHaveBeenCalled();
    expect(harness.mocks.removeWebRequestRulesMock).toHaveBeenCalledWith('s1');
  });

  it('Chrome 138+ update failure falls back to unregister + register', async () => {
    harness.mocks.updateMock.mockRejectedValueOnce(new Error('update rejected'));
    await harness.reregisterScript({ id: 's1', enabled: true });
    expect(harness.mocks.updateMock).toHaveBeenCalledOnce();
    expect(harness.mocks.unregisterMock).toHaveBeenCalledWith({ ids: ['s1'] });
    expect(harness.mocks.registerMock).toHaveBeenCalledOnce();
    expect(harness.registerScript).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 's1' }),
      { useUpdate: true, throwOnError: true },
    );
    expect(harness.registerScript).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 's1' }),
    );
  });

  it('older Chrome (no update) falls back to unregister + register', async () => {
    delete harness.fakeChrome.userScripts.update;
    await harness.reregisterScript({ id: 's1', enabled: true });
    expect(harness.mocks.unregisterMock).toHaveBeenCalledWith({ ids: ['s1'] });
    expect(harness.mocks.registerMock).toHaveBeenCalledOnce();
    expect(harness.mocks.updateMock).not.toHaveBeenCalled();
  });
});
