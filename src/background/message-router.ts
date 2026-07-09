import type { BackgroundMessage } from '../types/messages';

export type BackgroundAction = BackgroundMessage['action'];
export type BackgroundActionOrigin = 'extension-ui' | 'external-api' | 'gm-api' | 'telemetry';

export const BACKGROUND_MESSAGE_ACTIONS = [
  'GM_audio_getState',
  'GM_audio_setMute',
  'GM_audio_unwatchState',
  'GM_audio_watchState',
  'GM_closeNotification',
  'GM_closeTab',
  'GM_cookie_delete',
  'GM_cookie_list',
  'GM_cookie_set',
  'GM_deleteValue',
  'GM_deleteValues',
  'GM_download',
  'GM_focusTab',
  'GM_getResourceText',
  'GM_getResourceURL',
  'GM_getTab',
  'GM_getTabs',
  'GM_getValue',
  'GM_getValues',
  'GM_listValues',
  'GM_loadScript',
  'GM_notification',
  'GM_openInTab',
  'GM_registerMenuCommand',
  'GM_saveTab',
  'GM_setValue',
  'GM_setValues',
  'GM_unregisterMenuCommand',
  'GM_updateNotification',
  'GM_webRequest',
  'GM_webSocket',
  'GM_webSocket_close',
  'GM_webSocket_send',
  'GM_webSocket_takeEvent',
  'GM_xmlhttpRequest',
  'GM_xmlhttpRequest_abort',
  'GM_xmlhttpRequest_result',
  'activateWorkspace',
  'addScriptToFolder',
  'addSubscription',
  'analyzeScript',
  'applyPendingUpdate',
  'applySafePendingUpdates',
  'applyUpdate',
  'chainDomEvent',
  'checkUpdates',
  'cleanupStorage',
  'clearErrorLog',
  'clearNetworkLog',
  'clearPendingUpdates',
  'clearRecentUpdates',
  'clearRestoreReceipts',
  'clearScriptConsole',
  'clearScriptStorage',
  'cloudExport',
  'cloudImport',
  'cloudStatus',
  'connectSyncProvider',
  'createBackup',
  'createFolder',
  'createScript',
  'createWorkspace',
  'deleteBackup',
  'deleteCollection',
  'deleteFolder',
  'deleteProfile',
  'deleteScript',
  'deleteScriptValue',
  'deleteWorkspace',
  'diagnoseScripts',
  'disconnectSyncProvider',
  'duplicateScript',
  'easyCloudConnect',
  'easyCloudDisconnect',
  'easyCloudStatus',
  'easyCloudSync',
  'emptyTrash',
  'executeMenuCommand',
  'exportAll',
  'exportBackup',
  'exportErrorLog',
  'exportZip',
  'factoryReset',
  'fetchResource',
  'forceUpdate',
  'generateDigest',
  'getAllScriptsValues',
  'getBackupSettings',
  'getBackups',
  'getCSPReports',
  'getChainDomEventTriggers',
  'getCollections',
  'getErrorLog',
  'getErrorLogGrouped',
  'getExtensionInfo',
  'getExtensionStatus',
  'getFolders',
  'getGistSettings',
  'getHostPermissionStatus',
  'getLastSyncResult',
  'getLiveReloadScripts',
  'getLocalHealthReport',
  'getMenuCommands',
  'getNetworkLog',
  'getNetworkLogStats',
  'getNotificationPrefs',
  'getOnDeviceAIStatus',
  'getPendingUpdates',
  'getProfiles',
  'getRecentUpdates',
  'getRestoreReceipt',
  'getRestoreReceipts',
  'getScript',
  'getScriptConsole',
  'getScriptSettings',
  'getScriptStats',
  'getScriptStorage',
  'getScriptValues',
  'getScripts',
  'getScriptsForUrl',
  'getSetting',
  'getSettings',
  'getStorageBreakdown',
  'getStorageSize',
  'getStorageUsage',
  'getSubscriptions',
  'getSyncProviderStatus',
  'getTrash',
  'getVersionHistory',
  'getWorkspaces',
  'importAll',
  'importBackup',
  'importFromZip',
  'importGreasemonkeyBackup',
  'importScript',
  'importTampermonkeyBackup',
  'importViolentmonkeyBackup',
  'inspectBackup',
  'installFromCode',
  'installFromUrl',
  'logError',
  'moveScriptToFolder',
  'netlog_record',
  'npmResolve',
  'npmResolveAll',
  'openDashboard',
  'permanentlyDelete',
  'prefetchResources',
  'prepareBackgroundRunnerDryRun',
  'publicApi_clearAuditLog',
  'publicApi_getAuditLog',
  'publicApi_getLocalMcpBridgeConfig',
  'publicApi_getPermissions',
  'publicApi_getTrustedExtensionIds',
  'publicApi_getTrustedOrigins',
  'publicApi_setLocalMcpBridgeConfig',
  'publicApi_setTrustedExtensionIds',
  'publicApi_setTrustedOrigins',
  'queueHostAccessRequest',
  'queueUpdates',
  'refreshSubscription',
  'refreshSubscriptions',
  'registerMenuCommand',
  'removeScriptFromFolder',
  'removeSubscription',
  'renameScriptValue',
  'reorderScripts',
  'repairRuntimeState',
  'reportCSPFailure',
  'reportExecError',
  'reportExecTime',
  'rescheduleChains',
  'rescheduleScript',
  'resetScriptSettings',
  'resetScriptStats',
  'resetSettings',
  'restart',
  'restoreBackup',
  'restoreFromTrash',
  'revokeSyncProvider',
  'rollbackRestore',
  'rollbackScript',
  'runChainNow',
  'runOnDeviceAI',
  'runScriptNow',
  'saveCollection',
  'saveGistSettings',
  'saveProfile',
  'saveScript',
  'saveWorkspace',
  'scriptConsoleCapture',
  'searchScripts',
  'setBackupSettings',
  'setLiveReload',
  'setNotificationPrefs',
  'setScriptSettings',
  'setScriptStorage',
  'setScriptValue',
  'setSettings',
  'signing_generateNewKeypair',
  'signing_getPublicKey',
  'signing_getTrustedKeys',
  'signing_sign',
  'signing_trustKey',
  'signing_untrustKey',
  'signing_verify',
  'signing_verifyRaw',
  'switchProfile',
  'sync',
  'syncDryRunPreview',
  'syncNow',
  'syncProviderHealth',
  'testSync',
  'toggleScript',
  'unregisterMenuCommand',
  'updateBadgeForTab',
  'updateFolder',
  'updateWorkspace',
  'userStyleClearPreview',
  'userStylePreviewDraft',
  'verifyBackup',
  'verifyRequireProvenancePreview',
] as const satisfies readonly BackgroundAction[];

type AssertNever<T extends never> = T;
type MissingBackgroundActions = Exclude<BackgroundAction, typeof BACKGROUND_MESSAGE_ACTIONS[number]>;
type ExtraBackgroundActions = Exclude<typeof BACKGROUND_MESSAGE_ACTIONS[number], BackgroundAction>;
type _MissingBackgroundActionCheck = AssertNever<MissingBackgroundActions>;
type _ExtraBackgroundActionCheck = AssertNever<ExtraBackgroundActions>;

const BACKGROUND_ACTION_SET: ReadonlySet<string> = new Set(BACKGROUND_MESSAGE_ACTIONS);

const TELEMETRY_ACTIONS = new Set<BackgroundAction>([
  'logError',
  'netlog_record',
  'reportCSPFailure',
  'reportExecError',
  'reportExecTime',
  'scriptConsoleCapture',
]);

export interface KnownBackgroundActionResolution {
  known: true;
  action: BackgroundAction;
  origin: BackgroundActionOrigin;
}

export interface UnknownBackgroundActionResolution {
  known: false;
  action: string;
}

export type BackgroundActionResolution =
  | KnownBackgroundActionResolution
  | UnknownBackgroundActionResolution;

export function isKnownBackgroundAction(action: unknown): action is BackgroundAction {
  return typeof action === 'string' && BACKGROUND_ACTION_SET.has(action);
}

export function getBackgroundActionOrigin(action: BackgroundAction): BackgroundActionOrigin {
  if (action.startsWith('GM_') || action.startsWith('registerMenuCommand') || action.startsWith('unregisterMenuCommand')) {
    return 'gm-api';
  }
  if (action.startsWith('publicApi_')) return 'external-api';
  if (TELEMETRY_ACTIONS.has(action)) return 'telemetry';
  return 'extension-ui';
}

export function resolveBackgroundAction(action: unknown): BackgroundActionResolution {
  if (!isKnownBackgroundAction(action)) {
    return { known: false, action: typeof action === 'string' ? action : String(action) };
  }
  return { known: true, action, origin: getBackgroundActionOrigin(action) };
}

export const MessageRouter = Object.freeze({
  BACKGROUND_MESSAGE_ACTIONS,
  getBackgroundActionOrigin,
  isKnownBackgroundAction,
  resolveBackgroundAction,
});

export default MessageRouter;
