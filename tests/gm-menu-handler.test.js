import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_MENU_ACTIONS,
  handleGMMenuMessage,
  isGMMenuAction,
} from '../src/background/gm-menu-handler.ts';

const originalScriptStorage = globalThis.ScriptStorage;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__resetStorageMock();
  globalThis.ScriptStorage = {
    getAll: vi.fn().mockResolvedValue([]),
  };
});

afterEach(() => {
  globalThis.ScriptStorage = originalScriptStorage;
});

describe('GM menu handler', () => {
  it('exposes the exact menu action set', () => {
    expect([...GM_MENU_ACTIONS]).toEqual([
      'executeMenuCommand',
      'getMenuCommands',
      'GM_registerMenuCommand',
      'GM_unregisterMenuCommand',
      'registerMenuCommand',
      'unregisterMenuCommand',
    ]);
    expect(isGMMenuAction('GM_registerMenuCommand')).toBe(true);
    expect(isGMMenuAction('GM_audio_getState')).toBe(false);
  });

  it('registers and updates a menu command in session storage', async () => {
    await expect(handleGMMenuMessage('GM_registerMenuCommand', {
      scriptId: 'script-1',
      commandId: 'cmd-1',
      caption: 'Run audit',
      accessKey: 'r',
      autoClose: false,
      title: 'Run the current audit',
    })).resolves.toEqual({ success: true });

    await expect(handleGMMenuMessage('registerMenuCommand', {
      scriptId: 'script-1',
      commandId: 'cmd-1',
      caption: 'Run checks',
    })).resolves.toEqual({ success: true });

    const stored = await chrome.storage.session.get('menuCommands');
    expect(stored.menuCommands['script-1']).toEqual([{
      id: 'cmd-1',
      caption: 'Run checks',
      accessKey: '',
      autoClose: true,
      title: '',
    }]);
  });

  it('unregisters a menu command and removes the empty script bucket', async () => {
    await chrome.storage.session.set({
      menuCommands: {
        'script-1': [
          { id: 'cmd-1', caption: 'One', accessKey: '', autoClose: true, title: '' },
        ],
      },
    });

    await expect(handleGMMenuMessage('GM_unregisterMenuCommand', {
      scriptId: 'script-1',
      commandId: 'cmd-1',
    })).resolves.toEqual({ success: true });

    const stored = await chrome.storage.session.get('menuCommands');
    expect(stored.menuCommands).toEqual({});
  });

  it('flattens registered commands with script names for the dashboard', async () => {
    await chrome.storage.session.set({
      menuCommands: {
        'script-1': [
          { id: 'cmd-1', caption: 'Known', accessKey: '', autoClose: true, title: '' },
        ],
        missing: [
          { id: 'cmd-2', caption: 'Missing', accessKey: '', autoClose: true, title: '' },
        ],
      },
    });
    globalThis.ScriptStorage.getAll.mockResolvedValueOnce([
      { id: 'script-1', meta: { name: 'Workspace Helper' } },
    ]);

    await expect(handleGMMenuMessage('getMenuCommands'))
      .resolves.toEqual({
        commands: [{
          id: 'cmd-1',
          caption: 'Known',
          accessKey: '',
          autoClose: true,
          title: '',
          scriptId: 'script-1',
          scriptName: 'Workspace Helper',
        }],
      });
  });

  it('forwards execute requests to the sender tab when present', async () => {
    await expect(handleGMMenuMessage(
      'executeMenuCommand',
      { scriptId: 'script-1', commandId: 'cmd-1' },
      { tab: { id: 12 } },
    )).resolves.toEqual({ success: true });

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(12, {
      action: 'executeMenuCommand',
      data: { scriptId: 'script-1', commandId: 'cmd-1' },
    });

    vi.clearAllMocks();
    await expect(handleGMMenuMessage('executeMenuCommand', {
      scriptId: 'script-1',
      commandId: 'cmd-1',
    })).resolves.toEqual({ success: true });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
