import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_VALUES_ACTIONS,
  handleGMValuesMessage,
  isGMValuesAction,
} from '../src/background/gm-values-handler.ts';

const originalScriptValues = globalThis.ScriptValues;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ScriptValues = {
    delete: vi.fn().mockResolvedValue(),
    deleteMultiple: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue({ value: 'stored' }),
    getAll: vi.fn().mockResolvedValue({ theme: 'dark' }),
    getStorageSize: vi.fn().mockResolvedValue({ bytes: 42 }),
    list: vi.fn().mockResolvedValue({ keys: ['theme'] }),
    set: vi.fn().mockResolvedValue({ success: true }),
    setAll: vi.fn().mockResolvedValue(),
  };
});

afterEach(() => {
  globalThis.ScriptValues = originalScriptValues;
});

describe('GM values handler', () => {
  it('exposes the exact value-storage action set', () => {
    expect([...GM_VALUES_ACTIONS]).toEqual([
      'deleteScriptValue',
      'getScriptStorage',
      'getScriptValues',
      'getStorageSize',
      'GM_deleteValue',
      'GM_deleteValues',
      'GM_getValue',
      'GM_getValues',
      'GM_listValues',
      'GM_setValue',
      'GM_setValues',
      'setScriptStorage',
    ]);
    expect(isGMValuesAction('GM_setValue')).toBe(true);
    expect(isGMValuesAction('GM_openInTab')).toBe(false);
  });

  it('forwards single-value operations to ScriptValues with sender tab context', async () => {
    await expect(handleGMValuesMessage('GM_getValue', {
      scriptId: 'script-1',
      key: 'theme',
      defaultValue: 'light',
    })).resolves.toEqual({ value: 'stored' });
    expect(globalThis.ScriptValues.get).toHaveBeenCalledWith('script-1', 'theme', 'light');

    await expect(handleGMValuesMessage(
      'GM_setValue',
      { scriptId: 'script-1', key: 'theme', value: 'dark' },
      { tab: { id: 8 } },
    )).resolves.toEqual({ success: true });
    expect(globalThis.ScriptValues.set).toHaveBeenCalledWith('script-1', 'theme', 'dark', 8);

    await expect(handleGMValuesMessage(
      'GM_deleteValue',
      { scriptId: 'script-1', key: 'theme' },
      {},
    )).resolves.toEqual({ success: true });
    expect(globalThis.ScriptValues.delete).toHaveBeenCalledWith('script-1', 'theme', null);
  });

  it('handles multi-value GM operations', async () => {
    await expect(handleGMValuesMessage('GM_listValues', { scriptId: 'script-1' }))
      .resolves.toEqual({ keys: ['theme'] });
    await expect(handleGMValuesMessage('GM_getValues', { scriptId: 'script-1' }))
      .resolves.toEqual({ theme: 'dark' });

    await expect(handleGMValuesMessage(
      'GM_setValues',
      { scriptId: 'script-1', values: { theme: 'dark' } },
      { tab: { id: 9 } },
    )).resolves.toEqual({ success: true });
    expect(globalThis.ScriptValues.setAll).toHaveBeenCalledWith('script-1', { theme: 'dark' }, 9);

    await expect(handleGMValuesMessage(
      'GM_deleteValues',
      { scriptId: 'script-1', keys: ['theme'] },
      { tab: { id: 9 } },
    )).resolves.toEqual({ success: true });
    expect(globalThis.ScriptValues.deleteMultiple).toHaveBeenCalledWith('script-1', ['theme'], 9);
  });

  it('preserves dashboard storage alias return shapes', async () => {
    await expect(handleGMValuesMessage('getScriptStorage', { scriptId: 'script-1' }))
      .resolves.toEqual({ values: { theme: 'dark' } });
    await expect(handleGMValuesMessage('getScriptValues', { scriptId: 'script-1' }))
      .resolves.toEqual({ values: { theme: 'dark' } });

    await expect(handleGMValuesMessage('setScriptStorage', {
      scriptId: 'script-1',
      values: { count: 1 },
    })).resolves.toEqual({ success: true });
    expect(globalThis.ScriptValues.setAll).toHaveBeenLastCalledWith('script-1', { count: 1 });

    await expect(handleGMValuesMessage('deleteScriptValue', {
      scriptId: 'script-1',
      key: 'count',
    })).resolves.toEqual({ success: true });
    expect(globalThis.ScriptValues.delete).toHaveBeenLastCalledWith('script-1', 'count');

    await expect(handleGMValuesMessage('getStorageSize', { scriptId: 'script-1' }))
      .resolves.toEqual({ bytes: 42 });
  });
});
