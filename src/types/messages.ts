/**
 * Typed message passing for ScriptVault.
 *
 * Every message between background ↔ popup/dashboard/sidepanel/content
 * is defined here as a discriminated union on `action`.
 *
 * Usage:
 *   import type { BackgroundMessage, ResponseFor } from '@types/messages';
 *   const msg: BackgroundMessage = { action: 'getScripts' };
 *   const res: ResponseFor<typeof msg> = await sendToBackground(msg);
 *   // res is typed as { scripts: Script[] }
 */

import type { Script, ScriptStats, ScriptTrustReceipt, VersionHistoryEntry } from './script';
import type { Settings } from './settings';

// ─── Script Management ───────────────────────────────────────────────

interface GetScripts {
  action: 'getScripts';
}
interface GetScriptsResponse {
  scripts: Script[];
}

interface GetScript {
  action: 'getScript';
  id: string;
}

interface SaveScript {
  action: 'saveScript';
  scriptId?: string;
  id?: string;
  code: string;
  enabled?: boolean;
  markModified?: boolean;
  trust?: {
    operation?: ScriptTrustReceipt['operation'];
    sourceUrl?: string;
    sourceKind?: ScriptTrustReceipt['source']['sourceKind'];
    sourceLabel?: string;
    suppressMetadataSourceFallback?: boolean;
    coalesceKey?: string;
    coalesceWindowMs?: number;
    recordReceipt?: boolean;
    optionalPermissions?: {
      requested?: string[];
      granted?: string[];
      denied?: string[];
      unavailable?: string[];
    } | null;
  };
}
interface SaveScriptResponse {
  success: true;
  scriptId: string;
  script: Script;
}

interface CreateScript {
  action: 'createScript';
  code: string;
}

interface DeleteScript {
  action: 'deleteScript';
  scriptId?: string;
  id?: string;
}

interface ToggleScript {
  action: 'toggleScript';
  scriptId?: string;
  id?: string;
  enabled: boolean;
}

interface RunScriptNow {
  action: 'runScriptNow';
  scriptId?: string;
  id?: string;
  tabId?: number;
}

interface UserStylePreviewDraft {
  action: 'userStylePreviewDraft';
  code: string;
  tabId?: number;
}

interface UserStyleClearPreview {
  action: 'userStyleClearPreview';
  tabId?: number;
}

interface UserStylePreviewResponse {
  success?: boolean;
  error?: string;
  tabId?: number;
  tabUrl?: string;
  styleName?: string;
  cssBytes?: number;
}

interface UserStyleClearPreviewResponse {
  success: boolean;
  cleared: number;
}

interface DuplicateScript {
  action: 'duplicateScript';
  id: string;
}

interface SearchScripts {
  action: 'searchScripts';
  query: string;
}

interface ReorderScripts {
  action: 'reorderScripts';
  orderedIds: string[];
}

interface ImportScript {
  action: 'importScript';
  code: string;
}

interface GetHostPermissionStatus {
  action: 'getHostPermissionStatus';
  url?: string;
  currentUrl?: string;
}

interface QueueHostAccessRequest {
  action: 'queueHostAccessRequest';
  url?: string;
  currentUrl?: string;
  tabId?: number;
  documentId?: string;
}

interface OpenDashboard {
  action: 'openDashboard';
  scriptId?: string;
  newScript?: boolean;
  tab?: string;
}

interface FactoryReset {
  action: 'factoryReset';
}

// ─── Trash ───────────────────────────────────────────────────────────

interface GetTrash {
  action: 'getTrash';
}
interface GetTrashResponse {
  trash: Script[];
}

interface RestoreFromTrash {
  action: 'restoreFromTrash';
  scriptId: string;
}

interface EmptyTrash {
  action: 'emptyTrash';
}

interface RescheduleScript {
  action: 'rescheduleScript';
  scriptId: string;
}

interface DiagnoseScripts {
  action: 'diagnoseScripts';
  url?: string;
}

interface PermanentlyDelete {
  action: 'permanentlyDelete';
  scriptId: string;
}

// ─── Script Values (GM_* storage) ────────────────────────────────────

interface GMGetValue {
  action: 'GM_getValue';
  scriptId: string;
  key: string;
  defaultValue?: unknown;
}

interface GMSetValue {
  action: 'GM_setValue';
  scriptId: string;
  key: string;
  value: unknown;
}

interface GMDeleteValue {
  action: 'GM_deleteValue' | 'deleteScriptValue';
  scriptId: string;
  key: string;
}

interface GMListValues {
  action: 'GM_listValues';
  scriptId: string;
}

interface GMGetValues {
  action: 'GM_getValues';
  scriptId: string;
}

interface GMSetValues {
  action: 'GM_setValues';
  scriptId: string;
  values: Record<string, unknown>;
}

interface GMDeleteValues {
  action: 'GM_deleteValues';
  scriptId: string;
  keys: string[];
}

interface GetScriptStorage {
  action: 'getScriptStorage' | 'getScriptValues';
  scriptId: string;
}

interface SetScriptStorage {
  action: 'setScriptStorage';
  scriptId: string;
  values: Record<string, unknown>;
}

interface GetStorageSize {
  action: 'getStorageSize';
  scriptId: string;
}

// ─── Tab Storage ─────────────────────────────────────────────────────

interface GMGetTab {
  action: 'GM_getTab';
}

interface GMSaveTab {
  action: 'GM_saveTab';
  data: unknown;
}

interface GMGetTabs {
  action: 'GM_getTabs';
}

// ─── Settings ────────────────────────────────────────────────────────

interface GetSettings {
  action: 'getSettings';
}
interface GetSettingsResponse {
  settings: Settings;
}

interface GetSetting {
  action: 'getSetting';
  key: string;
}

interface SetSettings {
  action: 'setSettings';
  settings: Partial<Settings>;
}

interface ResetSettings {
  action: 'resetSettings';
}

interface GetExtensionStatus {
  action: 'getExtensionStatus';
}

interface GetLocalHealthReport {
  action: 'getLocalHealthReport';
}

interface PrepareBackgroundRunnerDryRun {
  action: 'prepareBackgroundRunnerDryRun';
  scriptId: string;
}

type UserScriptsSetupState =
  | 'available'
  | 'firefox-user-scripts-permission'
  | 'allow-user-scripts-disabled'
  | 'developer-mode-disabled'
  | 'unsupported-browser';

interface ExtensionStatusResponse {
  userScriptsAvailable: boolean;
  setupRequired: boolean;
  setupMessage: string;
  chromeVersion: number;
  setupState: UserScriptsSetupState;
  setupTitle: string;
  setupAction: string;
  setupUrl: string;
  apiProbeError?: string;
}

type LocalHealthLevel = 'ok' | 'info' | 'warning' | 'critical' | 'unavailable' | 'error';

interface LocalHealthReportResponse {
  schema: 'scriptvault-local-health/v1';
  generatedAt: string;
  privacy: {
    localOnly: boolean;
    includesScriptSource: boolean;
    includesScriptNames: boolean;
    includesUrls: boolean;
    includesFileHandles: boolean;
    includesLocalPaths: boolean;
    includesExternalBeacons: boolean;
  };
  runtime: {
    userScriptsAvailable: boolean;
    setupRequired: boolean;
    setupState: UserScriptsSetupState;
    setupTitle: string;
    setupAction: string;
    setupMessage: string;
    chromeVersion: number;
    apiProbeError: string;
  };
  storage: {
    available: boolean;
    usageBytes: number;
    quotaBytes: number;
    usagePercent: number;
    usageFormatted: string;
    quotaFormatted: string;
    level: LocalHealthLevel;
    error?: string;
  };
  registration: {
    schema: 'scriptvault-registration-sweep/v1';
    generatedAt: string | null;
    status: string;
    mode: string;
    forceReregister: boolean;
    userScriptsAvailable: boolean | null;
    setupState: UserScriptsSetupState | 'unknown';
    enabledScripts: number;
    alreadyRegisteredScripts: number;
    registeredScripts: number;
    skippedScripts: number;
    staleUnregisteredScripts: number;
    failedScripts: number;
    staleUnregisterFailures: number;
    requirePreloadCount: number;
  };
  scripts: {
    total: number;
    enabled: number;
    disabled: number;
    registrationErrors: number;
    scriptsWithExecutionErrors: number;
    slowScripts: number;
    staleRemoteScripts: number;
    sourceIdentityChanged: number;
    userModified: number;
    syncLocked: number;
    managedScripts: number;
    backgroundScripts: {
      total: number;
      dormant: number;
      eligible: number;
      gateDisabled: number;
      missingTrigger: number;
      unsupportedGrants: number;
      scriptDisabled: number;
      unsupportedGrantNames: string[];
    };
    slowScriptThresholdMs: number;
    staleRemoteThresholdDays: number;
  };
  managedPolicy: {
    available: boolean;
    accessLevelControlAvailable: boolean;
    policyReadStatus: 'unsupported' | 'not-configured' | 'readable' | 'unavailable' | 'error';
    configuredEntries: number;
    configuredUrlEntries: number;
    configuredInlineEntries: number;
    configuredInvalidEntries: number;
    cleanupEnabled: boolean;
    installedManagedScripts: number;
    lastRun: null | {
      schema: 'scriptvault-managed-policy-run/v1';
      startedAt: string;
      finishedAt: string;
      status: 'not-configured' | 'applied' | 'partial' | 'failed' | 'pruned' | 'skipped' | 'unavailable';
      policyReadStatus: 'unsupported' | 'not-configured' | 'readable' | 'unavailable' | 'error';
      configuredEntries: number;
      attemptedEntries: number;
      installedEntries: number;
      failedEntries: number;
      skippedInvalidEntries: number;
      prunedScripts: number;
      pruneFailedScripts: number;
      cleanupEnabled: boolean;
    };
  };
  gmValueSync: {
    schema: 'scriptvault-gm-value-sync/v1';
    available: boolean;
    providerWritesEnabled: boolean;
    optInScripts: number;
    readyBundles: number;
    emptyBundles: number;
    scriptsWithWarnings: number;
    valueReadFailures: number;
    totalKeys: number;
    totalBytes: number;
    maxScriptBytes: number;
    maxKeys: number;
    maxKeyBytes: number;
    lastResult: null | {
      schema: 'scriptvault-gm-value-sync-result/v1';
      timestamp: number | null;
      ok: boolean;
      skipped: boolean;
      hasError: boolean;
      applied: number;
      preserved: number;
      conflictBlocked: number;
      skippedUnavailable: number;
      failures: number;
      writeFailureRetryReady: number;
      retryAgeMinutes: number | null;
      retryAgeBucket: 'none' | 'fresh' | 'recent' | 'stale' | 'old' | 'unknown';
    };
    retryResolution: null | {
      schema: 'scriptvault-gm-value-sync-retry-resolution/v1';
      timestamp: number;
      applied: number;
      priorRetryReadyEntries: number;
      priorRetryReadyWrites: number;
      latestRetryTimestamp: number | null;
      resolutionAgeMinutes: number | null;
      resolutionAgeBucket: 'fresh' | 'recent' | 'stale' | 'old' | 'unknown';
      privacy: {
        includesValues: boolean;
        includesValueKeys: boolean;
        includesScriptIds: boolean;
        includesScriptNames: boolean;
        includesUrls: boolean;
        includesFileHandles: boolean;
        includesLocalPaths: boolean;
      };
    };
    retryResolutionHistory: {
      schema: 'scriptvault-gm-value-sync-retry-resolution-history/v1';
      limit: number;
      retentionDays: number;
      entries: number;
      totalApplied: number;
      totalPriorRetryReadyEntries: number;
      totalPriorRetryReadyWrites: number;
      staleEntriesPruned: number;
      latestTimestamp: number | null;
      oldestTimestamp: number | null;
      privacy: {
        includesValues: boolean;
        includesValueKeys: boolean;
        includesScriptIds: boolean;
        includesScriptNames: boolean;
        includesUrls: boolean;
        includesFileHandles: boolean;
        includesLocalPaths: boolean;
      };
    };
    retryHistory: {
      schema: 'scriptvault-gm-value-sync-retry-history/v1';
      limit: number;
      retentionDays: number;
      entries: number;
      retryReadyEntries: number;
      failedNoRetryEntries: number;
      staleEntriesPruned: number;
      totalWriteFailureRetryReady: number;
      latestTimestamp: number | null;
      oldestTimestamp: number | null;
      privacy: {
        includesValues: boolean;
        includesValueKeys: boolean;
        includesScriptIds: boolean;
        includesScriptNames: boolean;
        includesUrls: boolean;
        includesFileHandles: boolean;
        includesLocalPaths: boolean;
      };
    };
    warningCounts: Record<string, number>;
    privacy: {
      includesValues: boolean;
      includesValueKeys: boolean;
      includesScriptIds: boolean;
      includesScriptNames: boolean;
      includesUrls: boolean;
      includesFileHandles: boolean;
      includesLocalPaths: boolean;
    };
  };
  localWorkspace: {
    available: boolean;
    totalBindings: number;
    boundScripts: number;
    permissionStates: Record<'granted' | 'prompt' | 'denied' | 'unknown', number>;
    refreshStatuses: Record<string, number>;
    errorStates: Record<string, number>;
    refreshedBindings: number;
    neverRefreshed: number;
    staleRefreshes: number;
    staleRefreshThresholdDays: number;
    mostRecentRefreshAgeDays: number | null;
    oldestRefreshAgeDays: number | null;
  };
  updates: {
    pendingUpdates: number;
    safePendingUpdates: number;
    reviewPendingUpdates: number;
    recentUpdates: number;
    pendingCap: number;
  };
  callbacks: {
    notificationCallbacks: { size: number; cap: number; percentOfCap: number; level: LocalHealthLevel };
    openTabTrackers: { size: number; cap: number; percentOfCap: number; level: LocalHealthLevel };
    audioWatchedTabs: { size: number; level: LocalHealthLevel };
  };
  warnings: Array<{ id: string; level: LocalHealthLevel; message: string }>;
}

interface BackgroundRunnerDryRunResponse {
  scriptId: string;
  status:
    | 'not-background'
    | 'script-disabled'
    | 'gate-disabled'
    | 'unsupported-grants'
    | 'missing-trigger'
    | 'ready'
    | 'wrapper-unsupported';
  reason: string;
  executionEnabled: false;
  plan: {
    status: Exclude<BackgroundRunnerDryRunResponse['status'], 'wrapper-unsupported'>;
    reason: string;
    enabled: boolean;
    triggers: string[];
    unsupportedGrants: string[];
    budget: {
      timeoutMs: number;
      maxConcurrentPerScript: number;
      maxQueuedRunsPerScript: number;
    };
  };
  wrapper: {
    supported: boolean;
    reason: string;
  };
  payload: {
    wouldBuild: boolean;
    includesCode: false;
    source: 'scriptvault-background-runner';
  };
}

// ─── Per-Script Settings ─────────────────────────────────────────────

interface GetScriptSettings {
  action: 'getScriptSettings';
  scriptId: string;
}

interface SetScriptSettings {
  action: 'setScriptSettings';
  scriptId: string;
  settings: Record<string, unknown>;
}

interface ResetScriptSettings {
  action: 'resetScriptSettings';
  scriptId: string;
}

// ─── Updates ─────────────────────────────────────────────────────────

interface CheckUpdates {
  action: 'checkUpdates';
  scriptId?: string;
}

interface ForceUpdate {
  action: 'forceUpdate';
  scriptId: string;
}

interface ApplyUpdate {
  action: 'applyUpdate';
  scriptId: string;
  code: string;
  sourceUrl?: string;
}

interface QueueUpdates {
  action: 'queueUpdates';
  scriptId?: string;
  updates?: Array<{ id: string; name?: string; currentVersion?: string; newVersion?: string; code: string; sourceUrl?: string }>;
  source?: string;
}

interface GetPendingUpdates {
  action: 'getPendingUpdates';
}

interface ClearPendingUpdates {
  action: 'clearPendingUpdates';
  scriptId?: string;
}

interface GetRecentUpdates {
  action: 'getRecentUpdates';
}

interface ClearRecentUpdates {
  action: 'clearRecentUpdates';
}

interface ApplyPendingUpdate {
  action: 'applyPendingUpdate';
  scriptId: string;
  force?: boolean;
}

interface ApplySafePendingUpdates {
  action: 'applySafePendingUpdates';
  scriptIds?: string[];
}

interface GetSubscriptions {
  action: 'getSubscriptions';
}

interface AddSubscription {
  action: 'addSubscription';
  url: string;
  name?: string;
}

interface RefreshSubscription {
  action: 'refreshSubscription';
  subscriptionId?: string;
  id?: string;
  url?: string;
}

interface RefreshSubscriptions {
  action: 'refreshSubscriptions';
}

interface RemoveSubscription {
  action: 'removeSubscription';
  subscriptionId?: string;
  id?: string;
  url?: string;
}

interface GetVersionHistory {
  action: 'getVersionHistory';
  scriptId: string;
}
interface VersionHistoryResponse {
  history: VersionHistoryEntry[];
}

interface RollbackScript {
  action: 'rollbackScript';
  scriptId: string;
  index?: number;
}

// ─── Cloud Sync ──────────────────────────────────────────────────────

interface SyncNow {
  action: 'sync' | 'syncNow';
}

interface TestSync {
  action: 'testSync';
}

interface ConnectSyncProvider {
  action: 'connectSyncProvider';
  provider: string;
}

interface DisconnectSyncProvider {
  action: 'disconnectSyncProvider';
  provider: string;
}

interface GetSyncProviderStatus {
  action: 'getSyncProviderStatus';
  provider: string;
}

interface SyncProviderHealth {
  action: 'syncProviderHealth';
  provider?: string;
}

interface SyncDryRunPreview {
  action: 'syncDryRunPreview';
  provider?: string;
}

interface GetLastSyncResult {
  action: 'getLastSyncResult';
}

interface RevokeSyncProvider {
  action: 'revokeSyncProvider';
  provider: string;
}

interface CloudExport {
  action: 'cloudExport';
  provider: string;
  includeSettings?: boolean;
  includeStorage?: boolean;
  includeSettingsCredentials?: boolean;
}

interface CloudImport {
  action: 'cloudImport';
  provider: string;
  importSettings?: boolean;
  importStorage?: boolean;
  importSettingsCredentials?: boolean;
}

interface CloudStatus {
  action: 'cloudStatus';
  provider: string;
}

// ─── Easy Cloud ──────────────────────────────────────────────────────

interface EasyCloudConnect {
  action: 'easyCloudConnect';
}

interface EasyCloudDisconnect {
  action: 'easyCloudDisconnect';
}

interface EasyCloudSync {
  action: 'easyCloudSync';
}

interface EasyCloudStatus {
  action: 'easyCloudStatus';
}

// ─── Import / Export ─────────────────────────────────────────────────

interface ExportAll {
  action: 'exportAll';
  options?: {
    includeSettings?: boolean;
    includeStorage?: boolean;
    includeSettingsCredentials?: boolean;
  };
}

interface ImportAll {
  action: 'importAll';
  data: unknown;
  options?: Record<string, unknown>;
}

interface ImportBackup {
  action: 'importTampermonkeyBackup' | 'importViolentmonkeyBackup' | 'importGreasemonkeyBackup';
  text: string;
  overwrite?: boolean;
}
interface ImportBackupResponse {
  imported: number;
  skipped: number;
  errors: unknown[];
}

interface ExportZip {
  action: 'exportZip';
}

interface ImportFromZip {
  action: 'importFromZip';
  zipData: unknown;
  options?: Record<string, unknown>;
}

interface VerifyRequireProvenancePreview {
  action: 'verifyRequireProvenancePreview';
  code?: string;
  meta?: Record<string, unknown>;
  resources?: unknown[];
  requires?: unknown[];
}

interface InstallFromUrl {
  action: 'installFromUrl';
  url: string;
}

interface InstallFromCode {
  action: 'installFromCode';
  code: string;
  sourceUrl?: string;
  operation?: string;
}

// ─── Storage Quota ───────────────────────────────────────────────────

interface GetStorageUsage {
  action: 'getStorageUsage';
}
interface StorageUsageResponse {
  bytesUsed: number;
  quota: number;
  percentage: number;
  level: string;
}

interface GetStorageBreakdown {
  action: 'getStorageBreakdown';
}

interface CleanupStorage {
  action: 'cleanupStorage';
  options?: Record<string, unknown>;
}

// ─── Backup Scheduler ────────────────────────────────────────────────

interface CreateBackup {
  action: 'createBackup';
  reason?: string;
}

interface GetBackups {
  action: 'getBackups';
}

interface RestoreBackup {
  action: 'restoreBackup';
  backupId: string;
  options?: Record<string, unknown>;
}

interface VerifyBackup {
  action: 'verifyBackup';
  backupId: string;
}

interface GetRestoreReceipts {
  action: 'getRestoreReceipts';
}

interface GetRestoreReceipt {
  action: 'getRestoreReceipt';
  receiptId: string;
}

interface RollbackRestore {
  action: 'rollbackRestore';
  receiptId: string;
  options?: Record<string, unknown>;
}

interface ClearRestoreReceipts {
  action: 'clearRestoreReceipts';
}

interface DeleteBackup {
  action: 'deleteBackup';
  backupId: string;
}

interface ImportBackupArchive {
  action: 'importBackup';
  zipData: unknown;
}

interface ExportBackup {
  action: 'exportBackup';
  backupId: string;
}

interface InspectBackup {
  action: 'inspectBackup';
  backupId: string;
}

interface GetBackupSettings {
  action: 'getBackupSettings';
}

interface SetBackupSettings {
  action: 'setBackupSettings';
  settings: Record<string, unknown>;
}

// ─── Profiles ────────────────────────────────────────────────────────

interface GetProfiles {
  action: 'getProfiles';
}

interface SwitchProfile {
  action: 'switchProfile';
  profileId: string;
}

interface SaveProfile {
  action: 'saveProfile';
  profile: Record<string, unknown>;
}

interface DeleteProfile {
  action: 'deleteProfile';
  profileId: string;
}

// ─── Collections ─────────────────────────────────────────────────────

interface GetCollections {
  action: 'getCollections';
}

interface SaveCollection {
  action: 'saveCollection';
  collection: Record<string, unknown>;
}

interface DeleteCollection {
  action: 'deleteCollection';
  collectionId: string;
}

// ─── Folders ─────────────────────────────────────────────────────────

interface GetFolders {
  action: 'getFolders';
}

interface CreateFolder {
  action: 'createFolder';
  name: string;
  color?: string;
}

interface UpdateFolder {
  action: 'updateFolder';
  id: string;
  updates: Record<string, unknown>;
}

interface DeleteFolder {
  action: 'deleteFolder';
  id: string;
}

interface AddScriptToFolder {
  action: 'addScriptToFolder';
  folderId: string;
  scriptId: string;
}

interface RemoveScriptFromFolder {
  action: 'removeScriptFromFolder';
  folderId: string;
  scriptId: string;
}

interface MoveScriptToFolder {
  action: 'moveScriptToFolder';
  scriptId: string;
  fromFolderId: string;
  toFolderId: string;
}

// ─── GM API Handlers ─────────────────────────────────────────────────

interface GMXmlhttpRequest {
  action: 'GM_xmlhttpRequest';
  scriptId: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  responseType?: string;
  timeout?: number;
  anonymous?: boolean;
  partitionKey?: chrome.cookies.CookiePartitionKey;
  cookiePartition?: chrome.cookies.CookiePartitionKey;
  cookieStoreId?: string;
  cookieStore?: string;
}

interface GMXmlhttpRequestAbort {
  action: 'GM_xmlhttpRequest_abort';
  requestId: string;
}

interface GMXmlhttpRequestResult {
  action: 'GM_xmlhttpRequest_result';
  scriptId: string;
  requestId: string;
}

interface GMWebSocket {
  action: 'GM_webSocket';
  scriptId: string;
  url: string;
  protocols?: string | string[];
  binaryType?: 'arraybuffer' | 'blob';
}

interface GMWebSocketSend {
  action: 'GM_webSocket_send';
  scriptId: string;
  requestId: string;
  payload?: unknown;
}

interface GMWebSocketClose {
  action: 'GM_webSocket_close';
  scriptId: string;
  requestId: string;
  code?: number;
  reason?: string;
}

interface GMWebSocketTakeEvent {
  action: 'GM_webSocket_takeEvent';
  scriptId: string;
  requestId: string;
  eventId: string;
}

interface GMDownload {
  action: 'GM_download';
  url: string;
  name: string;
  saveAs?: boolean;
  conflictAction?: string;
  timeout?: number;
  headers?: Record<string, string>;
  anonymous?: boolean;
  noCache?: boolean;
  nocache?: boolean;
  redirect?: string;
  partitionKey?: chrome.cookies.CookiePartitionKey;
  cookiePartition?: chrome.cookies.CookiePartitionKey;
  cookieStoreId?: string;
  cookieStore?: string;
  sourceName?: string;
  hasCallbacks?: boolean;
  scriptId?: string;
}

interface GMNotification {
  action: 'GM_notification';
  title?: string;
  text?: string;
  image?: string;
  silent?: boolean;
  tag?: string;
  timeout?: number;
  hasOnclick?: boolean;
  hasOndone?: boolean;
  scriptId?: string;
}

interface GMUpdateNotification {
  action: 'GM_updateNotification';
  id: string;
  title?: string;
  text?: string;
  progress?: number;
}

interface GMCloseNotification {
  action: 'GM_closeNotification';
  id: string;
}

interface GMOpenInTab {
  action: 'GM_openInTab';
  url: string;
  active?: boolean;
  background?: boolean;
  insert?: boolean;
  setParent?: boolean;
  trackClose?: boolean;
  scriptId?: string;
}

interface GMRegisterMenuCommand {
  action: 'registerMenuCommand' | 'GM_registerMenuCommand';
  scriptId: string;
  commandId: string;
  caption: string;
  accessKey?: string;
  autoClose?: boolean;
  title?: string;
}

interface GMUnregisterMenuCommand {
  action: 'unregisterMenuCommand' | 'GM_unregisterMenuCommand';
  scriptId: string;
  commandId: string;
}

interface GetMenuCommands {
  action: 'getMenuCommands';
}

interface ExecuteMenuCommand {
  action: 'executeMenuCommand';
  scriptId: string;
  commandId: string;
}

// ─── Resources ───────────────────────────────────────────────────────

interface FetchResource {
  action: 'fetchResource';
  url: string;
}

interface GMGetResourceText {
  action: 'GM_getResourceText';
  scriptId: string;
  name: string;
}

interface GMGetResourceURL {
  action: 'GM_getResourceURL';
  scriptId: string;
  name: string;
}

interface GMLoadScript {
  action: 'GM_loadScript';
  scriptId: string;
  url: string;
  timeout?: number;
}

// ─── Stats ───────────────────────────────────────────────────────────

interface GetScriptStatsMsg {
  action: 'getScriptStats';
  scriptId?: string;
}

interface ResetScriptStats {
  action: 'resetScriptStats';
  scriptId: string;
}

interface ReportExecTime {
  action: 'reportExecTime';
  scriptId: string;
  time: number;
  url?: string;
}

interface ReportExecError {
  action: 'reportExecError';
  scriptId: string;
  error: string;
}

// ─── Network Log ─────────────────────────────────────────────────────

interface GetNetworkLog {
  action: 'getNetworkLog';
  scriptId?: string;
  method?: string;
  status?: number;
}

interface GetNetworkLogStats {
  action: 'getNetworkLogStats';
}

interface ClearNetworkLog {
  action: 'clearNetworkLog';
  scriptId?: string;
}

interface NetlogRecord {
  action: 'netlog_record';
  method?: string;
  url: string;
  status?: number;
  statusText?: string;
  duration?: number;
  responseSize?: number;
  responseHeaders?: Record<string, string>;
  scriptId?: string;
  scriptName?: string;
  error?: string;
  type?: string;
}

// ─── Script Analysis ─────────────────────────────────────────────────

interface AnalyzeScript {
  action: 'analyzeScript';
  code: string;
}

// ─── Signing ─────────────────────────────────────────────────────────

interface SigningGetPublicKey {
  action: 'signing_getPublicKey';
}

interface SigningSign {
  action: 'signing_sign';
  code: string;
}

interface SigningVerify {
  action: 'signing_verify' | 'signing_verifyRaw';
  code: string;
  signatureInfo?: Record<string, unknown>;
}

interface SigningTrustKey {
  action: 'signing_trustKey';
  publicKey: JsonWebKey;
  name?: string;
}

interface SigningUntrustKey {
  action: 'signing_untrustKey';
  publicKey: JsonWebKey;
}

interface SigningGetTrustedKeys {
  action: 'signing_getTrustedKeys';
}

interface SigningGenerateNewKeypair {
  action: 'signing_generateNewKeypair';
}

// ─── Public API Controls ─────────────────────────────────────────────

interface PublicApiGetTrustedOrigins {
  action: 'publicApi_getTrustedOrigins';
}

interface PublicApiSetTrustedOrigins {
  action: 'publicApi_setTrustedOrigins';
  origins: string[];
}

interface PublicApiGetTrustedExtensionIds {
  action: 'publicApi_getTrustedExtensionIds';
}

interface PublicApiSetTrustedExtensionIds {
  action: 'publicApi_setTrustedExtensionIds';
  extensionIds: string[];
}

interface PublicApiGetPermissions {
  action: 'publicApi_getPermissions';
}

interface PublicApiGetAuditLog {
  action: 'publicApi_getAuditLog';
  limit?: number;
}

interface PublicApiClearAuditLog {
  action: 'publicApi_clearAuditLog';
}

// ─── Workspaces ──────────────────────────────────────────────────────

interface GetWorkspaces {
  action: 'getWorkspaces';
}

interface CreateWorkspace {
  action: 'createWorkspace';
  name: string;
}

interface SaveWorkspace {
  action: 'saveWorkspace';
  id: string;
}

interface ActivateWorkspace {
  action: 'activateWorkspace';
  id: string;
}

interface UpdateWorkspace {
  action: 'updateWorkspace';
  id: string;
  updates: Record<string, unknown>;
}

interface DeleteWorkspace {
  action: 'deleteWorkspace';
  id: string;
}

// ─── NPM Resolution ─────────────────────────────────────────────────

interface NpmResolve {
  action: 'npmResolve';
  spec: string;
}

interface NpmResolveAll {
  action: 'npmResolveAll';
  requires: string[];
}

// ─── Error Log ───────────────────────────────────────────────────────

interface LogError {
  action: 'logError';
  entry?: Record<string, unknown>;
}

interface GetErrorLog {
  action: 'getErrorLog';
  filters?: Record<string, unknown>;
}

interface GetErrorLogGrouped {
  action: 'getErrorLogGrouped';
}

interface ExportErrorLog {
  action: 'exportErrorLog';
  format?: 'json' | 'csv' | 'text';
}

interface ClearErrorLog {
  action: 'clearErrorLog';
}

// ─── Notifications System ────────────────────────────────────────────

interface GetNotificationPrefs {
  action: 'getNotificationPrefs';
}

interface SetNotificationPrefs {
  action: 'setNotificationPrefs';
  prefs: Record<string, unknown>;
}

interface GenerateDigest {
  action: 'generateDigest';
}

// ─── Script Console ──────────────────────────────────────────────────

interface ScriptConsoleCapture {
  action: 'scriptConsoleCapture';
  scriptId: string;
  entries: Array<{ level: string; args: unknown[]; timestamp: number }>;
}

interface GetScriptConsole {
  action: 'getScriptConsole';
  scriptId: string;
}

interface ClearScriptConsole {
  action: 'clearScriptConsole';
  scriptId: string;
}

// ─── Live Reload ─────────────────────────────────────────────────────

interface SetLiveReload {
  action: 'setLiveReload';
  scriptId: string;
  enabled: boolean;
}

interface GetLiveReloadScripts {
  action: 'getLiveReloadScripts';
}

// ─── CSP Reports ─────────────────────────────────────────────────────

interface ReportCSPFailure {
  action: 'reportCSPFailure';
  url: string;
  scriptId: string;
  directive: string;
}

interface GetCSPReports {
  action: 'getCSPReports';
}

// ─── Gist Integration ────────────────────────────────────────────────

interface GetGistSettings {
  action: 'getGistSettings';
}

interface SaveGistSettings {
  action: 'saveGistSettings';
  settings: Record<string, unknown>;
}

// ─── Cookies ─────────────────────────────────────────────────────────

interface GMCookieList {
  action: 'GM_cookie_list';
  url?: string;
  domain?: string;
  name?: string;
  path?: string;
  partitionKey?: chrome.cookies.CookiePartitionKey;
}

interface GMCookieSet {
  action: 'GM_cookie_set';
  url: string;
  name: string;
  value?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  sameSite?: string;
  partitionKey?: chrome.cookies.CookiePartitionKey;
}

interface GMCookieDelete {
  action: 'GM_cookie_delete';
  url: string;
  name: string;
  partitionKey?: chrome.cookies.CookiePartitionKey;
}

// ─── Web Request ─────────────────────────────────────────────────────

interface GMWebRequest {
  action: 'GM_webRequest';
  rules: unknown[];
  scriptId?: string;
}

// ─── Audio ───────────────────────────────────────────────────────────

interface GMAudioSetMute {
  action: 'GM_audio_setMute';
  mute: boolean | { mute: boolean };
}

interface GMAudioGetState {
  action: 'GM_audio_getState';
}

interface GMAudioWatchState {
  action: 'GM_audio_watchState';
}

interface GMAudioUnwatchState {
  action: 'GM_audio_unwatchState';
}

// ─── Tabs ────────────────────────────────────────────────────────────

interface GetScriptsForUrl {
  action: 'getScriptsForUrl';
  url: string;
}

interface UpdateBadgeForTab {
  action: 'updateBadgeForTab';
  tabId: number;
  url: string;
}

interface GMFocusTab {
  action: 'GM_focusTab';
}

interface GMCloseTab {
  action: 'GM_closeTab';
  tabId: number;
}

// ─── Extension Info ──────────────────────────────────────────────────

interface GetExtensionInfo {
  action: 'getExtensionInfo';
}

interface RepairRuntimeState {
  action: 'repairRuntimeState';
}

interface PrefetchResources {
  action: 'prefetchResources';
  resources: string[];
}

interface Restart {
  action: 'restart';
}

// ─── Script Value Editor ─────────────────────────────────────────────

interface GetAllScriptsValues {
  action: 'getAllScriptsValues';
}

interface SetScriptValue {
  action: 'setScriptValue';
  scriptId: string;
  key: string;
  value: unknown;
}

interface DeleteScriptValue {
  action: 'deleteScriptValue';
  scriptId: string;
  key: string;
}

interface ClearScriptStorageMsg {
  action: 'clearScriptStorage';
  scriptId: string;
}

interface RenameScriptValue {
  action: 'renameScriptValue';
  scriptId: string;
  oldKey: string;
  newKey: string;
}

// ═════════════════════════════════════════════════════════════════════
// Union type: every valid message to the background service worker
// ═════════════════════════════════════════════════════════════════════

export type BackgroundMessage =
  // Script management
  | GetScripts | GetScript | SaveScript | CreateScript | DeleteScript
  | ToggleScript | RunScriptNow | DuplicateScript | UserStylePreviewDraft | UserStyleClearPreview | SearchScripts | ReorderScripts
  | ImportScript | GetHostPermissionStatus | QueueHostAccessRequest | OpenDashboard | FactoryReset
  // Trash
  | GetTrash | RestoreFromTrash | EmptyTrash | RescheduleScript | PermanentlyDelete
  // Script values
  | GMGetValue | GMSetValue | GMDeleteValue | GMListValues
  | GMGetValues | GMSetValues | GMDeleteValues
  | GetScriptStorage | SetScriptStorage | GetStorageSize
  // Tab storage
  | GMGetTab | GMSaveTab | GMGetTabs
  // Settings
  | GetSettings | GetSetting | SetSettings | ResetSettings | GetExtensionStatus | GetLocalHealthReport | PrepareBackgroundRunnerDryRun
  // Per-script settings
  | GetScriptSettings | SetScriptSettings | ResetScriptSettings
  // Updates
  | CheckUpdates | ForceUpdate | ApplyUpdate | QueueUpdates | GetPendingUpdates
  | ClearPendingUpdates | GetRecentUpdates | ClearRecentUpdates | ApplyPendingUpdate | ApplySafePendingUpdates
  | GetSubscriptions | AddSubscription | RefreshSubscription | RefreshSubscriptions | RemoveSubscription
  | GetVersionHistory | RollbackScript
  // Cloud sync
  | SyncNow | TestSync | ConnectSyncProvider | DisconnectSyncProvider
  | GetSyncProviderStatus | SyncProviderHealth | SyncDryRunPreview | GetLastSyncResult | RevokeSyncProvider
  | CloudExport | CloudImport | CloudStatus
  // Easy Cloud
  | EasyCloudConnect | EasyCloudDisconnect | EasyCloudSync | EasyCloudStatus
  // Import/export
  | ExportAll | ImportAll | ImportBackup | ExportZip | ImportFromZip | InstallFromUrl | InstallFromCode
  | VerifyRequireProvenancePreview
  // Storage quota
  | GetStorageUsage | GetStorageBreakdown | CleanupStorage
  // Backup
  | CreateBackup | GetBackups | RestoreBackup | DeleteBackup
  | VerifyBackup | GetRestoreReceipts | GetRestoreReceipt | RollbackRestore | ClearRestoreReceipts
  | ImportBackupArchive | ExportBackup | InspectBackup | GetBackupSettings | SetBackupSettings
  // Profiles
  | GetProfiles | SwitchProfile | SaveProfile | DeleteProfile
  // Collections
  | GetCollections | SaveCollection | DeleteCollection
  // Folders
  | GetFolders | CreateFolder | UpdateFolder | DeleteFolder
  | AddScriptToFolder | RemoveScriptFromFolder | MoveScriptToFolder
  // GM APIs
  | GMXmlhttpRequest | GMXmlhttpRequestAbort | GMXmlhttpRequestResult | GMDownload
  | GMWebSocket | GMWebSocketSend | GMWebSocketClose | GMWebSocketTakeEvent
  | GMNotification | GMUpdateNotification | GMCloseNotification | GMOpenInTab
  | GMRegisterMenuCommand | GMUnregisterMenuCommand
  | GetMenuCommands | ExecuteMenuCommand
  // Resources
  | FetchResource | GMGetResourceText | GMGetResourceURL | GMLoadScript
  // Stats
  | GetScriptStatsMsg | ResetScriptStats | ReportExecTime | ReportExecError
  // Network log
  | GetNetworkLog | GetNetworkLogStats | ClearNetworkLog | NetlogRecord
  // Analysis
  | AnalyzeScript
  // Signing
  | SigningGetPublicKey | SigningSign | SigningVerify
  | SigningTrustKey | SigningUntrustKey | SigningGetTrustedKeys | SigningGenerateNewKeypair
  // Public API controls
  | PublicApiGetTrustedOrigins | PublicApiSetTrustedOrigins
  | PublicApiGetTrustedExtensionIds | PublicApiSetTrustedExtensionIds
  | PublicApiGetPermissions | PublicApiGetAuditLog | PublicApiClearAuditLog
  // Workspaces
  | GetWorkspaces | CreateWorkspace | SaveWorkspace
  | ActivateWorkspace | UpdateWorkspace | DeleteWorkspace
  // NPM
  | NpmResolve | NpmResolveAll
  // Error log
  | LogError | GetErrorLog | GetErrorLogGrouped | ExportErrorLog | ClearErrorLog
  // Notifications
  | GetNotificationPrefs | SetNotificationPrefs | GenerateDigest
  // Console
  | ScriptConsoleCapture | GetScriptConsole | ClearScriptConsole
  // Live reload
  | SetLiveReload | GetLiveReloadScripts
  // CSP
  | ReportCSPFailure | GetCSPReports
  // Gist
  | GetGistSettings | SaveGistSettings
  // Cookies
  | GMCookieList | GMCookieSet | GMCookieDelete
  // Web request
  | GMWebRequest
  // Audio
  | GMAudioSetMute | GMAudioGetState | GMAudioWatchState | GMAudioUnwatchState
  // Tabs
  | GetScriptsForUrl | DiagnoseScripts | UpdateBadgeForTab | GMFocusTab | GMCloseTab
  // Extension info
  | GetExtensionInfo | RepairRuntimeState | PrefetchResources | Restart
  // Script value editor
  | GetAllScriptsValues | SetScriptValue | DeleteScriptValue
  | ClearScriptStorageMsg | RenameScriptValue;

// ═════════════════════════════════════════════════════════════════════
// Response type mapping (compile-time message → response lookup)
// ═════════════════════════════════════════════════════════════════════

/** Standard success response */
interface SuccessResponse {
  success: true;
}

/** Standard error response */
interface ErrorResponse {
  error: string;
}

/**
 * Generic "background-handler returned {success: true, ...payload} OR {error}".
 * The vast majority of write-side handlers conform to this shape; the payload
 * differs per action so consumers narrow on the discriminant `success` /
 * `error` before reading domain fields.
 */
type SuccessOrError<T = Record<string, unknown>> =
  | ({ success: true } & T)
  | ErrorResponse;

interface RecentUpdateResponseItem {
  id: string;
  name: string;
  previousVersion: string;
  newVersion: string;
  dependencyChanges?: ScriptTrustReceipt['dependencyChanges'];
  permissionChanges?: ScriptTrustReceipt['permissionChanges'];
  appliedAt: number;
}

/**
 * Phase 40.13 — Maps message types to their response types.
 *
 * Categories:
 *   1. Domain-typed handlers (Script CRUD, settings, trash) keep their existing
 *      explicit response interfaces.
 *   2. GM_* APIs that proxy a userscript call are uniformly typed via
 *      `SuccessOrError` because the bridge returns `{success, ...payload}` or
 *      an error string — the consumer is the wrapper, not arbitrary callsites.
 *   3. Folder / Workspace / Sync write actions follow the same SuccessOrError
 *      pattern.
 *   4. Read-side telemetry handlers (getRecentUpdates, getErrorLog, etc.)
 *      return arrays directly (no wrapper object).
 *
 * Any action not in this map falls back to `unknown` via `ResponseFor<T>`.
 * `unknown` is intentional: TypeScript will refuse to let callers read fields
 * without narrowing, which is the correct behavior for an untyped surface.
 */
export interface ResponseMap {
  // ── Script CRUD ─────────────────────────────────────────────────────
  getScripts: GetScriptsResponse;
  getScript: Script | null;
  saveScript: SaveScriptResponse | ErrorResponse;
  createScript: SaveScriptResponse | ErrorResponse;
  deleteScript: SuccessResponse | ErrorResponse;
  toggleScript: SuccessResponse;
  runScriptNow: SuccessOrError<{ mode: 'userScripts.execute' | 'scripting.executeScript' }>;
  userStylePreviewDraft: UserStylePreviewResponse | ErrorResponse;
  userStyleClearPreview: UserStyleClearPreviewResponse;
  duplicateScript: { success: true; script: Script } | ErrorResponse;
  searchScripts: { scripts: Script[] };
  reorderScripts: SuccessResponse;
  importScript: SuccessOrError<{ script?: Script }>;
  getHostPermissionStatus: unknown;
  queueHostAccessRequest: SuccessOrError<{ requestId?: string; tabId?: number; url?: string }>;
  bulkDeleteScripts: SuccessOrError<{ deleted: number }>;
  bulkToggleScripts: SuccessOrError<{ toggled: number }>;
  bulkExportScripts: SuccessOrError<{ data: string }>;
  forceUpdate: SuccessOrError<{ updated: boolean }>;
  checkUpdates: SuccessOrError<{ updates: { id: string; name: string; newVersion: string }[] }>;
  applyUpdate: SuccessOrError<{ script?: Script }>;
  queueUpdates: SuccessOrError<{ queued: number; pendingUpdates: unknown[]; safeCount: number; reviewCount: number }>;
  getPendingUpdates: unknown[];
  clearPendingUpdates: SuccessOrError<{ cleared?: number | 'all'; pendingUpdates?: unknown[] }>;
  applyPendingUpdate: SuccessOrError<{ script?: Script }>;
  applySafePendingUpdates: SuccessOrError<{ applied: number; skipped: number; failed: number; pendingUpdates: unknown[] }>;
  getSubscriptions: SuccessOrError<{ subscriptions: unknown[] }>;
  addSubscription: SuccessOrError<{ subscription?: unknown; queued?: number; skipped?: number; errors?: string[]; pendingUpdates?: unknown[] }>;
  refreshSubscription: SuccessOrError<{ subscription?: unknown; queued?: number; skipped?: number; errors?: string[]; pendingUpdates?: unknown[] }>;
  refreshSubscriptions: SuccessOrError<{ subscriptions?: unknown[]; queued?: number; skipped?: number; errors?: string[]; pendingUpdates?: unknown[] }>;
  removeSubscription: SuccessOrError<{ removed?: boolean; subscriptions?: unknown[] }>;
  getRecentUpdates: RecentUpdateResponseItem[];
  clearRecentUpdates: SuccessResponse;

  // ── Trash ──────────────────────────────────────────────────────────
  getTrash: GetTrashResponse;
  restoreFromTrash: SuccessResponse | ErrorResponse;
  emptyTrash: SuccessResponse;
  rescheduleScript: SuccessResponse | ErrorResponse;
  permanentlyDelete: SuccessResponse;

  // ── Settings ───────────────────────────────────────────────────────
  getSettings: GetSettingsResponse;
  getSetting: unknown;
  setSettings: unknown;
  setScriptSettings: SuccessOrError;
  resetScriptSettings: SuccessOrError;
  resetSettings: unknown;
  getExtensionStatus: ExtensionStatusResponse;
  getLocalHealthReport: LocalHealthReportResponse;
  prepareBackgroundRunnerDryRun: BackgroundRunnerDryRunResponse | ErrorResponse;
  repairRuntimeState: SuccessOrError<ExtensionStatusResponse>;

  // ── Version history ────────────────────────────────────────────────
  getVersionHistory: VersionHistoryResponse;
  rollbackScript: { success: true; script: Script } | ErrorResponse;

  // ── Install flow ───────────────────────────────────────────────────
  installFromUrl: { success: true } | ErrorResponse;
  installFromCode: { success: true } | ErrorResponse;
  verifyRequireProvenancePreview: unknown;

  // ── Storage / quota ────────────────────────────────────────────────
  getStorageUsage: StorageUsageResponse;
  getScriptStorage: unknown;
  setScriptStorage: SuccessOrError;
  clearScriptStorage: SuccessOrError;
  cleanupStorage: SuccessOrError<{ removed: number }>;

  // ── Import (vendor backups) ───────────────────────────────────────
  importTampermonkeyBackup: ImportBackupResponse;
  importViolentmonkeyBackup: ImportBackupResponse;
  importGreasemonkeyBackup: ImportBackupResponse;
  importFromZip: SuccessOrError<{ imported: number; skipped: number; errors: string[] }>;
  importBackup: SuccessOrError;
  exportBackup: SuccessOrError<{ data?: string; blob?: unknown; filename?: string }>;
  inspectBackup: SuccessOrError;
  exportAllScripts: SuccessOrError<{ data: string }>;
  exportStatsCSV: SuccessOrError<{ data: string }>;

  // ── Folders ────────────────────────────────────────────────────────
  createFolder: SuccessOrError<{ folder: { id: string; name: string } }>;
  deleteFolder: SuccessOrError;
  renameFolder: SuccessOrError;
  moveScriptToFolder: SuccessResponse;
  addScriptToFolder: SuccessOrError;
  removeScriptFromFolder: SuccessOrError;
  getFolders: { folders: { id: string; name: string; color?: string; scriptIds: string[] }[] };

  // ── Workspaces ─────────────────────────────────────────────────────
  getWorkspaces: { active: string | null; list: { id: string; name: string }[] };
  createWorkspace: SuccessOrError<{ workspace: { id: string; name: string } }>;
  activateWorkspace: SuccessOrError<{ name: string }>;
  saveWorkspace: SuccessOrError<{ workspace: { id: string; name: string } }>;
  deleteWorkspace: SuccessOrError;
  renameWorkspace: SuccessOrError;

  // ── Cloud sync ─────────────────────────────────────────────────────
  cloudExport: SuccessOrError;
  cloudImport: SuccessOrError;
  cloudStatus: SuccessOrError<{ connected: boolean; provider?: string; lastSync?: number }>;
  getLastSyncResult: unknown;
  syncProviderHealth: SuccessOrError<{
    provider: string;
    providerLabel: string;
    connected: boolean;
    status: string;
    error?: string | null;
    user?: { email?: string; name?: string } | null;
    lastSync?: number | null;
    canRevoke: boolean;
    canManualSync: boolean;
    canDryRun: boolean;
    storageDisclosure?: unknown;
  }>;
  syncDryRunPreview: SuccessOrError<{
    dryRun: boolean;
    noWrites: boolean;
    provider?: string | null;
    providerLabel?: string | null;
    lastSync?: number | null;
    remoteFound?: boolean;
    summary?: Record<string, unknown>;
    conflicts?: unknown[];
    valueBundleConflicts?: {
      reason: 'local-values-present' | 'local-bundle-unavailable';
      localKeyCount: number | null;
      remoteKeyCount: number;
      localBytes: number | null;
      remoteBytes: number;
      overlappingKeyCount: number | null;
      localOnlyKeyCount: number | null;
      remoteOnlyKeyCount: number | null;
      localLastValueUpdatedAt: number | null;
      remoteLastValueUpdatedAt: number | null;
      lastWriteHint:
        | 'local-newer'
        | 'remote-newer'
        | 'same'
        | 'local-timestamp-only'
        | 'remote-timestamp-only'
        | 'unknown';
      overlappingRemoteNewerKeyCount: number | null;
      overlappingLocalNewerKeyCount: number | null;
      overlappingSameTimestampKeyCount: number | null;
      overlappingRemoteTimestampOnlyKeyCount: number | null;
      overlappingLocalTimestampOnlyKeyCount: number | null;
      overlappingUnknownTimestampKeyCount: number | null;
      candidateMergePlan:
        | 'timestamp-guided'
        | 'remote-preferred'
        | 'local-preferred'
        | 'manual-review'
        | 'unavailable';
      candidateRemoteKeyCount: number | null;
      candidateLocalKeyCount: number | null;
      candidateSameTimestampKeyCount: number | null;
      candidateManualKeyCount: number | null;
      candidateOneSidedTimestampKeyCount: number | null;
      candidateResultKeyCount: number | null;
      candidateAutoSelectedKeyCount: number | null;
      candidateReviewKeyCount: number | null;
      candidateMergeGate: 'ready' | 'manual-review' | 'unavailable';
      candidateMergeBlockReason:
        | 'none'
        | 'local-bundle-unavailable'
        | 'same-timestamp'
        | 'unknown-timestamp'
        | 'one-sided-timestamp'
        | 'no-candidate-keys';
      candidateMergeSimulation: 'ready-preview-only' | 'manual-review' | 'unavailable';
    }[];
  }>;
  revokeSyncProvider: SuccessOrError;
  syncNow: SuccessOrError<{
    valueBundleSync?: {
      applied: number;
      preserved: number;
      conflictBlocked: number;
      skippedNonEmpty: number;
      skippedUserModified: number;
      skippedUnavailable: number;
      failures: number;
      preservedRemoteNewer: number;
      preservedLocalNewer: number;
      preservedSameTimestamp: number;
      preservedRemoteTimestampOnly: number;
      preservedLocalTimestampOnly: number;
      preservedTimestampUnknown: number;
      preservedCandidateMergeReady: number;
      preservedCandidateMergeManualReview: number;
      preservedCandidateMergeUnavailable: number;
      preservedCandidateResultKeyTotal: number;
      preservedCandidateAutoSelectedKeyTotal: number;
      preservedCandidateReviewKeyTotal: number;
      preservedCandidateAcceptedResultKeyTotal: number;
      preservedCandidateBlockedSameTimestamp: number;
      preservedCandidateBlockedUnknownTimestamp: number;
      preservedCandidateBlockedOneSidedTimestamp: number;
      preservedCandidateBlockedUnavailable: number;
      preservedCandidateBlockedNoCandidateKeys: number;
    };
  }> | { skipped: true };
  connectGoogleDrive: SuccessOrError<{ user?: { email?: string; name?: string } }>;
  disconnectGoogleDrive: SuccessResponse;
  connectDropbox: SuccessOrError<{ user?: { email?: string; name?: string } }>;
  disconnectDropbox: SuccessResponse;
  connectOnedrive: SuccessOrError<{ user?: { email?: string; name?: string } }>;
  disconnectOnedrive: SuccessResponse;
  testSyncProvider: SuccessOrError;

  // ── Backups (scheduler) ────────────────────────────────────────────
  createBackup: SuccessOrError<{ backupId: string }>;
  listBackups: { backups: { id: string; timestamp: number; scriptCount: number; size: number }[] };
  restoreBackup: SuccessOrError<{ restored: number }>;
  verifyBackup: SuccessOrError;
  getRestoreReceipts: { receipts: unknown[] };
  getRestoreReceipt: { receipt: unknown | null };
  rollbackRestore: SuccessOrError;
  clearRestoreReceipts: SuccessOrError;
  deleteBackup: SuccessOrError;

  // ── Logging / observability ────────────────────────────────────────
  getErrorLog: { entries: { scriptId: string; scriptName: string; error: string; url?: string; timestamp: number }[] };
  clearErrorLog: SuccessResponse;
  getNetworkLog: { entries: unknown[] };
  clearNetworkLog: SuccessResponse;
  getScriptStats: unknown;
  resetScriptStats: SuccessResponse;
  getScriptConsole: { entries: unknown[] };
  clearScriptConsole: SuccessResponse;

  // ── Static analysis / signing ─────────────────────────────────────
  analyzeScript: { totalRisk: number; riskLevel: string; findings: unknown[]; categories: Record<string, unknown[]>; summary: string };
  signScript: SuccessOrError<{ signature: string; publicKey: string; algorithm: string; timestamp: number }>;
  verifyScript: { valid: boolean; trusted?: boolean; trustedName?: string | null; reason?: string };
  trustSigningKey: SuccessOrError;
  untrustSigningKey: SuccessResponse;
  getTrustedSigningKeys: Record<string, { name: string; addedAt: number }>;

  // ── Resources / npm ────────────────────────────────────────────────
  fetchResource: SuccessOrError<{ data: string; mimeType?: string }>;
  resolveNpmPackage: SuccessOrError<{ url: string; version: string; integrity?: string }>;

  // ── Public API control surface (external messaging) ───────────────
  apiPing: { ok: true; version: string };
  apiGetPermissions: { permissions: string[] };
  apiSetWebhook: SuccessOrError;
  apiTrustOrigin: SuccessOrError;
  publicApi_getTrustedOrigins: { origins: string[] };
  publicApi_setTrustedOrigins: SuccessOrError<{ origins?: string[] }>;
  publicApi_getTrustedExtensionIds: { extensionIds: string[] };
  publicApi_setTrustedExtensionIds: SuccessOrError<{ extensionIds?: string[] }>;
  publicApi_getPermissions: { permissions: unknown };
  publicApi_getAuditLog: { entries: unknown[] };
  publicApi_clearAuditLog: SuccessOrError;

  // ── DevTools / debugger ────────────────────────────────────────────
  attachDebugger: SuccessOrError;
  detachDebugger: SuccessResponse;
  getDebuggerEntries: { entries: unknown[] };

  // ── Misc utility ───────────────────────────────────────────────────
  factoryReset: SuccessOrError;
  openDashboard: SuccessResponse;
  reloadAllTabs: SuccessResponse;
  ping: { pong: true };

  // ── GM_* APIs (proxied from USER_SCRIPT world via the wrapper) ────
  GM_setValue: SuccessOrError;
  GM_getValue: { value: unknown };
  GM_deleteValue: SuccessOrError;
  GM_setValues: SuccessOrError;
  GM_getValues: { values: Record<string, unknown> };
  GM_deleteValues: SuccessOrError;
  GM_listValues: { keys: string[] };
  GM_xmlhttpRequest: SuccessOrError<{ requestId: string }>;
  GM_xmlhttpRequest_abort: SuccessResponse;
  GM_xmlhttpRequest_result: { done: boolean; type?: string; response?: Record<string, unknown>; error?: string };
  GM_webSocket: SuccessOrError<{ requestId: string }>;
  GM_webSocket_send: SuccessOrError;
  GM_webSocket_close: SuccessResponse;
  GM_webSocket_takeEvent: SuccessOrError<{ event: Record<string, unknown> }>;
  GM_cookie_list: SuccessOrError<{ cookies: chrome.cookies.Cookie[] }>;
  GM_cookie_set: SuccessOrError<{ cookie?: chrome.cookies.Cookie }>;
  GM_cookie_delete: SuccessOrError;
  GM_download: SuccessOrError<{ downloadId: number }>;
  GM_notification: SuccessOrError<{ id: string }>;
  GM_updateNotification: SuccessOrError;
  GM_closeNotification: SuccessResponse;
  GM_openInTab: SuccessOrError<{ tabId: number }>;
  GM_closeTab: SuccessResponse;
  GM_focusTab: SuccessResponse;
  GM_getTab: SuccessOrError<{ data: unknown }>;
  GM_saveTab: SuccessOrError;
  GM_getTabs: SuccessOrError<{ tabs: Record<string, unknown> }>;
  GM_registerMenuCommand: SuccessOrError<{ commandId: string }>;
  GM_unregisterMenuCommand: SuccessResponse;
  GM_getResourceURL: string | null;
  GM_getResourceText: string | null;
  GM_loadScript: SuccessOrError;
  GM_webRequest: SuccessOrError<{ ruleIds: number[] }>;
  GM_audio_setMute: SuccessResponse;
  GM_audio_getState: { muted: boolean; audible: boolean };
  GM_audio_watchState: SuccessResponse;
  GM_audio_unwatchState: SuccessResponse;

  // â”€â”€ Phase 40.13 coverage backfill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  connectSyncProvider: SuccessOrError<{ provider?: string; user?: unknown }>;
  deleteCollection: SuccessOrError;
  deleteProfile: SuccessOrError;
  deleteScriptValue: SuccessOrError;
  disconnectSyncProvider: SuccessOrError;
  easyCloudConnect: SuccessOrError<{ code?: string; expiresAt?: number }>;
  easyCloudDisconnect: SuccessOrError;
  easyCloudStatus: SuccessOrError<{ connected: boolean; lastSync?: number }>;
  easyCloudSync: SuccessOrError;
  executeMenuCommand: SuccessOrError;
  exportAll: SuccessOrError<{ data?: string; blob?: unknown; filename?: string }>;
  exportErrorLog: SuccessOrError<{ data?: string; filename?: string }>;
  exportZip: SuccessOrError<{ data?: string; blob?: unknown; filename?: string }>;
  generateDigest: SuccessOrError;
  getAllScriptsValues: unknown;
  getBackups: { backups: { id: string; timestamp: number; scriptCount?: number; size?: number }[] };
  getBackupSettings: unknown;
  getCollections: { collections: unknown[] };
  getCSPReports: { reports: unknown[] };
  getErrorLogGrouped: unknown;
  getExtensionInfo: { id: string; version: string; name?: string };
  getGistSettings: unknown;
  getLiveReloadScripts: { scripts: unknown[] };
  getMenuCommands: { commands: unknown[] };
  getNetworkLogStats: unknown;
  getNotificationPrefs: unknown;
  getProfiles: { profiles: unknown[] };
  getScriptSettings: unknown;
  getScriptValues: unknown;
  getScriptsForUrl: { scripts: Script[] };
  diagnoseScripts: {
    url: string;
    userScriptsAvailable: boolean;
    globallyEnabled: boolean;
    urlBlocked: boolean;
    scripts: Array<{
      id: string;
      name: string;
      status: string;
      reason: string;
      matches: boolean;
      enabled: boolean;
      registered: boolean;
    }>;
  };
  getStorageBreakdown: unknown;
  getStorageSize: unknown;
  getSyncProviderStatus: SuccessOrError<{ connected: boolean; provider?: string; lastSync?: number; user?: unknown }>;
  importAll: SuccessOrError<{ imported?: number; skipped?: number; errors?: string[] }>;
  logError: SuccessOrError;
  netlog_record: SuccessOrError;
  npmResolve: SuccessOrError<{ url: string; version?: string; integrity?: string }>;
  npmResolveAll: SuccessOrError<{ results: unknown[] }>;
  prefetchResources: SuccessOrError;
  registerMenuCommand: SuccessOrError<{ commandId: string }>;
  renameScriptValue: SuccessOrError;
  reportCSPFailure: SuccessOrError;
  reportExecError: SuccessOrError;
  reportExecTime: SuccessOrError;
  restart: SuccessOrError;
  saveCollection: SuccessOrError;
  saveGistSettings: SuccessOrError;
  saveProfile: SuccessOrError;
  scriptConsoleCapture: SuccessOrError;
  setBackupSettings: SuccessOrError;
  setLiveReload: SuccessOrError;
  setNotificationPrefs: SuccessOrError;
  setScriptValue: SuccessOrError;
  signing_generateNewKeypair: SuccessOrError<{ publicKey: string }>;
  signing_getPublicKey: { publicKey: string } | ErrorResponse;
  signing_getTrustedKeys: Record<string, { name: string; addedAt: number }>;
  signing_sign: SuccessOrError<{ code?: string; signature?: string; publicKey?: string }>;
  signing_trustKey: SuccessOrError;
  signing_untrustKey: SuccessResponse;
  signing_verify: { valid: boolean; trusted?: boolean; trustedName?: string | null; reason?: string };
  signing_verifyRaw: { valid: boolean; trusted?: boolean; trustedName?: string | null; reason?: string };
  switchProfile: SuccessOrError;
  sync: SuccessOrError<{ valueBundleSync?: Record<string, number> }> | { skipped: true };
  testSync: SuccessOrError;
  unregisterMenuCommand: SuccessResponse;
  updateBadgeForTab: SuccessOrError;
  updateFolder: SuccessOrError;
  updateWorkspace: SuccessOrError<{ workspace?: { id: string; name: string } }>;
}

/**
 * Get the response type for a message.
 * Falls back to `unknown` for unmapped action types.
 */
export type ResponseFor<T extends BackgroundMessage> =
  T['action'] extends keyof ResponseMap
    ? ResponseMap[T['action']]
    : unknown;
