import type { BackgroundMessage, ResponseFor } from '../types/messages';

export type BackgroundAction = BackgroundMessage['action'];
export type BackgroundActionOrigin = 'extension-ui' | 'external-api' | 'gm-api' | 'telemetry';
type NarrowBackgroundMessage<Message, Action extends BackgroundAction> =
  Message extends { action: infer MessageAction }
    ? Action extends MessageAction
      ? Omit<Message, 'action'> & { action: Action }
      : never
    : never;

export type BackgroundMessageFor<Action extends BackgroundAction> =
  NarrowBackgroundMessage<BackgroundMessage, Action>;

export interface BackgroundActionContext<Action extends BackgroundAction> {
  action: Action;
  message: BackgroundMessageFor<Action>;
  sender: unknown;
}

export type BackgroundActionHandler<Action extends BackgroundAction> = (
  context: BackgroundActionContext<Action>,
) => ResponseFor<BackgroundMessageFor<Action>> | Promise<ResponseFor<BackgroundMessageFor<Action>>>;

export type BackgroundActionHandlers = {
  [Action in BackgroundAction]?: BackgroundActionHandler<Action>;
};

export interface BackgroundActionHandledResult {
  handled: true;
  action: BackgroundAction;
  response: unknown;
}

export interface BackgroundActionUnhandledResult {
  handled: false;
  action: string;
}

export type BackgroundActionDispatchResult =
  | BackgroundActionHandledResult
  | BackgroundActionUnhandledResult;

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
  'fetchScriptPreview',
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
  'getExecutionDiagnostics',
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
  'probeInstallDependency',
  'publicApi_clearAuditLog',
  'publicApi_getAuditLog',
  'publicApi_getLocalMcpBridgeConfig',
  'publicApi_getPermissions',
  'publicApi_getTrustedExtensionIds',
  'publicApi_getTrustedOrigins',
  'publicApi_handleWebMessage',
  'publicApi_setLocalMcpBridgeConfig',
  'publicApi_setTrustedExtensionIds',
  'publicApi_setTrustedOrigins',
  'queueHostAccessRequest',
  'queueUpdates',
  'recordBridgeTelemetry',
  'refreshSubscription',
  'refreshSubscriptions',
  'registerMenuCommand',
  'removeScriptFromFolder',
  'removeSubscription',
  'renameScriptValue',
  'reorderScripts',
  'repairRuntimeState',
  'reportCSPFailure',
  'reportDocumentReady',
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
  'reportDocumentReady',
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

export function createBackgroundDomainHandlers<
  const Actions extends readonly BackgroundAction[],
>(
  actions: Actions,
  handle: (
    context: BackgroundActionContext<Actions[number]>,
  ) => unknown | Promise<unknown>,
): Pick<BackgroundActionHandlers, Actions[number]> {
  const handlers: Partial<Record<BackgroundAction, BackgroundActionHandler<BackgroundAction>>> = {};
  for (const action of actions) {
    if (handlers[action]) {
      throw new Error(`Background domain declares duplicate action: ${action}`);
    }
    handlers[action] = context => handle(
      context as BackgroundActionContext<Actions[number]>,
    ) as never;
  }
  return Object.freeze(handlers) as Pick<BackgroundActionHandlers, Actions[number]>;
}

function normalizeBackgroundMessage(
  message: Record<string, unknown>,
  action: BackgroundAction,
): BackgroundMessage {
  const nested = message.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>), action } as BackgroundMessage;
  }
  return { ...message, action } as BackgroundMessage;
}

export function createBackgroundActionRegistry(initialHandlers: BackgroundActionHandlers = {}) {
  type UntypedHandler = (context: BackgroundActionContext<BackgroundAction>) => unknown | Promise<unknown>;
  const handlers = new Map<BackgroundAction, UntypedHandler>();

  function registerHandlers(nextHandlers: BackgroundActionHandlers): void {
    for (const [rawAction, handler] of Object.entries(nextHandlers)) {
      if (!isKnownBackgroundAction(rawAction) || typeof handler !== 'function') {
        throw new Error(`Cannot register unknown background action: ${rawAction}`);
      }
      if (handlers.has(rawAction)) {
        throw new Error(`Background action already has a handler: ${rawAction}`);
      }
      handlers.set(rawAction, handler as UntypedHandler);
    }
  }

  async function dispatch(message: unknown, sender: unknown): Promise<BackgroundActionDispatchResult> {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return { handled: false, action: String((message as { action?: unknown } | null)?.action) };
    }
    const record = message as Record<string, unknown>;
    const resolution = resolveBackgroundAction(record.action);
    if (!resolution.known) return { handled: false, action: resolution.action };
    const handler = handlers.get(resolution.action);
    if (!handler) return { handled: false, action: resolution.action };
    const normalizedMessage = normalizeBackgroundMessage(record, resolution.action);
    const response = await handler({
      action: resolution.action,
      message: normalizedMessage,
      sender,
    });
    return { handled: true, action: resolution.action, response };
  }

  function registeredActions(): BackgroundAction[] {
    return [...handlers.keys()];
  }

  registerHandlers(initialHandlers);
  return Object.freeze({ dispatch, registerHandlers, registeredActions });
}

export const MessageRouter = Object.freeze({
  BACKGROUND_MESSAGE_ACTIONS,
  createBackgroundActionRegistry,
  createBackgroundDomainHandlers,
  getBackgroundActionOrigin,
  isKnownBackgroundAction,
  resolveBackgroundAction,
});

export default MessageRouter;
