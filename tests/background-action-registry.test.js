import { describe, expect, it, vi } from 'vitest';
import {
  createBackgroundActionRegistry,
  createBackgroundDomainHandlers,
} from '../src/background/message-router.ts';
import {
  IMPORT_BACKGROUND_ACTIONS,
  createImportActionHandlers,
} from '../src/background/import-action-handler.ts';
import {
  EXECUTION_TELEMETRY_ACTIONS,
  createTelemetryActionHandlers,
} from '../src/background/telemetry-action-handler.ts';
import {
  UPDATE_BACKGROUND_ACTIONS,
  createUpdateActionHandlers,
} from '../src/background/update-action-handler.ts';
import {
  SYNC_BACKGROUND_ACTIONS,
  createSyncActionHandlers,
} from '../src/background/sync-action-handler.ts';
import {
  BACKUP_BACKGROUND_ACTIONS,
  createBackupActionHandlers,
} from '../src/background/backup-action-handler.ts';
import {
  ORGANIZATION_BACKGROUND_ACTIONS,
  createOrganizationActionHandlers,
} from '../src/background/organization-action-handler.ts';
import {
  SETTINGS_BACKGROUND_ACTIONS,
  createSettingsActionHandlers,
} from '../src/background/settings-action-handler.ts';
import {
  SECURITY_BACKGROUND_ACTIONS,
  createSecurityActionHandlers,
} from '../src/background/security-action-handler.ts';
import {
  DIAGNOSTICS_BACKGROUND_ACTIONS,
  createDiagnosticsActionHandlers,
} from '../src/background/diagnostics-action-handler.ts';
import {
  SCRIPT_BACKGROUND_ACTIONS,
  createScriptActionHandlers,
} from '../src/background/script-action-handler.ts';
import {
  DATA_BACKGROUND_ACTIONS,
  createDataActionHandlers,
} from '../src/background/data-action-handler.ts';
import {
  RUNTIME_BACKGROUND_ACTIONS,
  createRuntimeActionHandlers,
} from '../src/background/runtime-action-handler.ts';

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

  it('adapts an exhaustive domain action list into registry handlers', async () => {
    const handle = vi.fn(async ({ action, message }) => ({ action, value: message.value }));
    const handlers = createBackgroundDomainHandlers(
      ['GM_getValue', 'GM_setValue'],
      handle,
    );
    const registry = createBackgroundActionRegistry(handlers);

    await expect(registry.dispatch({
      action: 'GM_setValue',
      data: { scriptId: 'script-1', key: 'theme', value: 'dark' },
    }, { userScriptId: 'script-1' })).resolves.toMatchObject({
      handled: true,
      action: 'GM_setValue',
      response: { action: 'GM_setValue', value: 'dark' },
    });
    expect(() => createBackgroundDomainHandlers(
      ['GM_getValue', 'GM_getValue'],
      handle,
    )).toThrow('Background domain declares duplicate action: GM_getValue');
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

  it('routes update and subscription actions with normalized defaults', async () => {
    const dependencies = Object.fromEntries([
      'checkUpdates', 'queueUpdates', 'getPendingUpdates', 'clearPendingUpdates',
      'applyPendingUpdate', 'applySafePendingUpdates', 'getRecentUpdates',
      'clearRecentUpdates', 'forceUpdate', 'applyUpdate', 'getVersionHistory',
      'rollbackScript', 'getSubscriptions', 'addSubscription',
      'refreshSubscription', 'refreshSubscriptions', 'removeSubscription',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    dependencies.getRecentUpdates = vi.fn(() => []);
    dependencies.clearRecentUpdates = vi.fn();
    const registry = createBackgroundActionRegistry(createUpdateActionHandlers(dependencies));

    await registry.dispatch({ action: 'queueUpdates', scriptId: 'script-1' }, {});
    await registry.dispatch({
      action: 'refreshSubscription',
      data: { subscriptionId: 'subscription-1' },
    }, {});

    expect(registry.registeredActions()).toEqual(UPDATE_BACKGROUND_ACTIONS);
    expect(dependencies.queueUpdates).toHaveBeenCalledWith(
      'script-1',
      undefined,
      'manual-check',
    );
    expect(dependencies.refreshSubscription).toHaveBeenCalledWith('subscription-1');
  });

  it('routes sync aliases and keeps credential import/export opt-in', async () => {
    const dependencies = Object.fromEntries([
      'sync', 'test', 'getLastResult', 'health', 'preview', 'connect',
      'disconnect', 'status', 'export', 'import', 'cloudStatus',
      'easyCloudConnect', 'easyCloudDisconnect', 'easyCloudSync',
      'easyCloudStatus',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(createSyncActionHandlers(dependencies));

    await registry.dispatch({ action: 'syncNow' }, {});
    await registry.dispatch({ action: 'cloudExport', provider: 'webdav' }, {});
    await registry.dispatch({
      action: 'cloudImport',
      data: { provider: 'webdav', importSettings: true, trustImportedScripts: true },
    }, {});

    expect(registry.registeredActions()).toEqual(SYNC_BACKGROUND_ACTIONS);
    expect(dependencies.sync).toHaveBeenCalledTimes(1);
    expect(dependencies.export).toHaveBeenCalledWith('webdav', {
      includeSettings: true,
      includeStorage: true,
      includeSettingsCredentials: false,
    });
    expect(dependencies.import).toHaveBeenCalledWith('webdav', {
      importSettings: true,
      importStorage: true,
      importSettingsCredentials: false,
      trustImportedScripts: true,
    });
  });

  it('routes backup recovery actions with explicit default options', async () => {
    const dependencies = Object.fromEntries([
      'create', 'list', 'restore', 'verify', 'listReceipts', 'getReceipt',
      'rollback', 'clearReceipts', 'delete', 'import', 'export', 'inspect',
      'getSettings', 'setSettings',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(createBackupActionHandlers(dependencies));

    await registry.dispatch({ action: 'createBackup' }, {});
    await registry.dispatch({ action: 'rollbackRestore', receiptId: 'receipt-1' }, {});

    expect(registry.registeredActions()).toEqual(BACKUP_BACKGROUND_ACTIONS);
    expect(dependencies.create).toHaveBeenCalledWith('manual');
    expect(dependencies.rollback).toHaveBeenCalledWith('receipt-1', {});
  });

  it('routes profiles, collections, workspaces, and folders by typed IDs', async () => {
    const dependencies = Object.fromEntries([
      'getProfiles', 'switchProfile', 'saveProfile', 'deleteProfile',
      'getCollections', 'saveCollection', 'deleteCollection', 'getWorkspaces',
      'createWorkspace', 'saveWorkspace', 'activateWorkspace', 'updateWorkspace',
      'deleteWorkspace', 'getFolders', 'createFolder', 'updateFolder',
      'deleteFolder', 'addScriptToFolder', 'removeScriptFromFolder',
      'moveScriptToFolder',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(
      createOrganizationActionHandlers(dependencies),
    );

    await registry.dispatch({
      action: 'moveScriptToFolder',
      data: { scriptId: 'script-1', fromFolderId: 'old', toFolderId: 'new' },
    }, {});

    expect(registry.registeredActions()).toEqual(ORGANIZATION_BACKGROUND_ACTIONS);
    expect(dependencies.moveScriptToFolder).toHaveBeenCalledWith('script-1', 'old', 'new');
  });

  it('routes global and per-script settings through separate typed dependencies', async () => {
    const dependencies = Object.fromEntries([
      'getSettings', 'getExtensionStatus', 'getLocalHealthReport',
      'prepareBackgroundRunnerDryRun', 'repairRuntimeState', 'getSetting',
      'setSettings', 'resetSettings', 'getScriptSettings', 'setScriptSettings',
      'resetScriptSettings',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(createSettingsActionHandlers(dependencies));

    await registry.dispatch({
      action: 'setScriptSettings',
      data: { scriptId: 'script-1', settings: { runAt: 'document-start' } },
    }, {});

    expect(registry.registeredActions()).toEqual(SETTINGS_BACKGROUND_ACTIONS);
    expect(dependencies.setScriptSettings).toHaveBeenCalledWith(
      'script-1',
      { runAt: 'document-start' },
    );
  });

  it('routes signing and public API controls with fail-closed input checks', async () => {
    const dependencies = Object.fromEntries([
      'getPublicKey', 'sign', 'verify', 'verifyRaw', 'trustKey', 'untrustKey',
      'getTrustedKeys', 'generateKeypair', 'getTrustedOrigins',
      'setTrustedOrigins', 'getTrustedExtensionIds', 'setTrustedExtensionIds',
      'getLocalMcpBridgeConfig', 'setLocalMcpBridgeConfig', 'getPermissions',
      'getAuditLog', 'clearAuditLog', 'handleWebMessage',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(createSecurityActionHandlers(dependencies));

    await expect(registry.dispatch({ action: 'signing_sign', code: '' }, {}))
      .resolves.toMatchObject({ response: { error: 'No code provided' } });
    await registry.dispatch({
      action: 'publicApi_setLocalMcpBridgeConfig',
      data: { config: { enabled: true, origins: ['http://127.0.0.1:43110'] } },
    }, {});

    expect(registry.registeredActions()).toEqual(SECURITY_BACKGROUND_ACTIONS);
    expect(dependencies.sign).not.toHaveBeenCalled();
    expect(dependencies.setLocalMcpBridgeConfig).toHaveBeenCalledWith({
      enabled: true,
      origins: ['http://127.0.0.1:43110'],
    });
  });

  it('routes diagnostics, error reporting, and debugger state through typed dependencies', async () => {
    const dependencies = Object.fromEntries([
      'reportCspFailure', 'getCspReports', 'getNetworkLog',
      'getNetworkLogStats', 'clearNetworkLog', 'analyzeScript',
      'getOnDeviceAiStatus', 'runOnDeviceAi', 'getScriptStats',
      'getExecutionDiagnostics', 'resetScriptStats', 'reportDocumentReady',
      'npmResolve', 'npmResolveAll', 'logError', 'getErrorLog',
      'getErrorLogGrouped', 'exportErrorLog', 'clearErrorLog',
      'getNotificationPrefs', 'setNotificationPrefs', 'generateDigest',
      'captureScriptConsole', 'getScriptConsole', 'clearScriptConsole',
      'setLiveReload', 'getLiveReloadScripts',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(
      createDiagnosticsActionHandlers(dependencies),
    );

    await registry.dispatch({
      action: 'runOnDeviceAI',
      data: { mode: 'editor-explain', code: 'alert(1)' },
    }, {});
    await registry.dispatch({
      action: 'setLiveReload',
      data: { scriptId: 'script-1', enabled: true },
    }, {});

    expect(registry.registeredActions()).toEqual(DIAGNOSTICS_BACKGROUND_ACTIONS);
    expect(dependencies.runOnDeviceAi).toHaveBeenCalledWith({
      mode: 'editor-explain',
      code: 'alert(1)',
      metadata: null,
      analysis: null,
      prompt: '',
    });
    expect(dependencies.setLiveReload).toHaveBeenCalledWith('script-1', true);
  });

  it('routes script lifecycle and trash actions with normalized IDs', async () => {
    const dependencies = Object.fromEntries([
      'getScripts', 'getHostPermissionStatus', 'queueHostAccessRequest',
      'getScript', 'saveScript', 'createScript', 'deleteScript', 'getTrash',
      'restoreFromTrash', 'emptyTrash', 'rescheduleScript', 'restart',
      'permanentlyDelete', 'toggleScript', 'duplicateScript', 'searchScripts',
      'reorderScripts',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(createScriptActionHandlers(dependencies));

    await registry.dispatch({ action: 'deleteScript', data: { id: 'script-1' } }, {});
    await registry.dispatch({
      action: 'toggleScript',
      data: { scriptId: 'script-2', enabled: false },
    }, {});

    expect(registry.registeredActions()).toEqual(SCRIPT_BACKGROUND_ACTIONS);
    expect(dependencies.deleteScript).toHaveBeenCalledWith('script-1');
    expect(dependencies.toggleScript).toHaveBeenCalledWith({
      action: 'toggleScript',
      scriptId: 'script-2',
      enabled: false,
    });
  });

  it('routes values, export, quota, resource, and Gist actions through typed dependencies', async () => {
    const dependencies = Object.fromEntries([
      'prefetchResources', 'getAllScriptsValues', 'setScriptValue',
      'clearScriptStorage', 'renameScriptValue', 'exportAll',
      'getStorageUsage', 'getStorageBreakdown', 'cleanupStorage',
      'getGistSettings', 'saveGistSettings', 'exportZip',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(createDataActionHandlers(dependencies));

    await registry.dispatch({
      action: 'renameScriptValue',
      data: { scriptId: 'script-1', oldKey: 'theme', newKey: 'colorScheme' },
    }, {});
    await registry.dispatch({ action: 'exportAll' }, {});

    expect(registry.registeredActions()).toEqual(DATA_BACKGROUND_ACTIONS);
    expect(dependencies.renameScriptValue).toHaveBeenCalledWith(
      'script-1',
      'theme',
      'colorScheme',
    );
    expect(dependencies.exportAll).toHaveBeenCalledWith({});
  });

  it('routes install, execution, chain, shell, and reset actions through typed dependencies', async () => {
    const dependencies = Object.fromEntries([
      'installFromUrl', 'installFromCode', 'fetchScriptPreview',
      'probeInstallDependency', 'verifyRequireProvenancePreview',
      'fetchResource', 'getScriptsForUrl', 'diagnoseScripts',
      'updateBadgeForTab', 'runScriptNow', 'rescheduleChains', 'runChainNow',
      'getChainDomEventTriggers', 'chainDomEvent', 'previewUserStyle',
      'clearUserStylePreview', 'getExtensionInfo', 'openDashboard',
      'factoryReset',
    ].map(name => [name, vi.fn(async () => ({ success: true }))]));
    const registry = createBackgroundActionRegistry(createRuntimeActionHandlers(dependencies));

    await registry.dispatch({
      action: 'installFromCode',
      data: { code: '// demo', sourceUrl: 'https://example.test/demo.user.js' },
    }, {});
    await registry.dispatch({
      action: 'runChainNow',
      data: { chainId: 'chain-1', tabId: 7 },
    }, {});

    expect(registry.registeredActions()).toEqual(RUNTIME_BACKGROUND_ACTIONS);
    expect(dependencies.installFromCode).toHaveBeenCalledWith(
      '// demo',
      'https://example.test/demo.user.js',
      'install',
    );
    expect(dependencies.runChainNow).toHaveBeenCalledWith('chain-1', 'manual', 7);
  });
});
