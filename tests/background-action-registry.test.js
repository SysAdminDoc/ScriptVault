import { describe, expect, it, vi } from 'vitest';
import { createBackgroundActionRegistry } from '../src/background/message-router.ts';
import {
  IMPORT_BACKGROUND_ACTIONS,
  createImportActionHandlers,
} from '../src/background/import-action-handler.ts';
import {
  EXECUTION_TELEMETRY_ACTIONS,
  createTelemetryActionHandlers,
} from '../src/background/telemetry-action-handler.ts';

describe('typed background action registry', () => {
  it('normalizes flat and nested runtime messages before dispatch', async () => {
    const save = vi.fn(async ({ message, sender }) => ({
      success: true,
      scriptId: message.id,
      script: { sender },
    }));
    const registry = createBackgroundActionRegistry({ saveScript: save });

    await expect(registry.dispatch({
      action: 'saveScript',
      data: { id: 'nested', code: '// nested' },
    }, { id: 'sender' })).resolves.toMatchObject({
      handled: true,
      action: 'saveScript',
      response: { success: true, scriptId: 'nested' },
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'saveScript',
      message: { action: 'saveScript', id: 'nested', code: '// nested' },
    }));
  });

  it('fails closed on duplicate and unknown registrations', async () => {
    const registry = createBackgroundActionRegistry({ getScripts: vi.fn() });
    expect(() => registry.registerHandlers({ getScripts: vi.fn() })).toThrow(
      'Background action already has a handler: getScripts',
    );
    expect(() => registry.registerHandlers({ unknownAction: vi.fn() })).toThrow(
      'Cannot register unknown background action: unknownAction',
    );
    await expect(registry.dispatch({ action: 'deleteEverything' }, {})).resolves.toEqual({
      handled: false,
      action: 'deleteEverything',
    });
  });

  it('routes import trust actions to one dependency surface', async () => {
    const dependencies = {
      importScript: vi.fn(async () => ({ success: true })),
      importAll: vi.fn(async () => ({ success: true })),
      importVendorBackup: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
      importFromZip: vi.fn(async () => ({ success: true, imported: 1, skipped: 0, errors: [] })),
    };
    const registry = createBackgroundActionRegistry(createImportActionHandlers(dependencies));

    await registry.dispatch({
      action: 'importGreasemonkeyBackup',
      data: { text: '{"scripts":[]}', overwrite: true },
    }, {});

    expect(registry.registeredActions()).toEqual(IMPORT_BACKGROUND_ACTIONS);
    expect(dependencies.importVendorBackup).toHaveBeenCalledWith(
      'greasemonkey',
      '{"scripts":[]}',
      expect.objectContaining({ action: 'importGreasemonkeyBackup', overwrite: true }),
    );
  });

  it('routes trusted and untrusted telemetry through distinct dependencies', async () => {
    const dependencies = {
      handleBridgeTelemetry: vi.fn(async () => ({ success: true, trusted: false })),
      handleTrustedTelemetry: vi.fn(async () => ({ success: true })),
    };
    const registry = createBackgroundActionRegistry(createTelemetryActionHandlers(dependencies));
    const sender = { tab: { id: 8 }, userScriptId: 'script-8' };

    await registry.dispatch({
      action: 'recordBridgeTelemetry',
      data: { kind: 'execution-time', duration: 12 },
    }, sender);
    await registry.dispatch({
      action: 'reportExecTime',
      data: { scriptId: 'spoofed', completionId: 'a'.repeat(16), time: 12 },
    }, sender);

    expect(registry.registeredActions()).toEqual(EXECUTION_TELEMETRY_ACTIONS);
    expect(dependencies.handleBridgeTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'execution-time', duration: 12 }),
      sender,
    );
    expect(dependencies.handleTrustedTelemetry).toHaveBeenCalledWith(
      'reportExecTime',
      expect.objectContaining({ scriptId: 'spoofed', time: 12 }),
      sender,
    );
  });
});
