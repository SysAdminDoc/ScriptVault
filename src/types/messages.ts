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

import type { Script, ScriptStats, VersionHistoryEntry } from './script';
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
interface ExtensionStatusResponse {
  userScriptsAvailable: boolean;
  setupRequired: boolean;
  setupMessage: string;
  chromeVersion: number;
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

interface CloudExport {
  action: 'cloudExport';
  provider: string;
}

interface CloudImport {
  action: 'cloudImport';
  provider: string;
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

interface InstallFromUrl {
  action: 'installFromUrl';
  url: string;
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

interface DeleteBackup {
  action: 'deleteBackup';
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
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  responseType?: string;
  timeout?: number;
  anonymous?: boolean;
  scriptId?: string;
}

interface GMXmlhttpRequestAbort {
  action: 'GM_xmlhttpRequest_abort';
  requestId: string;
}

interface GMDownload {
  action: 'GM_download';
  url: string;
  name: string;
  saveAs?: boolean;
  conflictAction?: string;
  timeout?: number;
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
}

interface GMCookieDelete {
  action: 'GM_cookie_delete';
  url: string;
  name: string;
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
  | ToggleScript | DuplicateScript | SearchScripts | ReorderScripts
  // Trash
  | GetTrash | RestoreFromTrash | EmptyTrash | PermanentlyDelete
  // Script values
  | GMGetValue | GMSetValue | GMDeleteValue | GMListValues
  | GMGetValues | GMSetValues | GMDeleteValues
  | GetScriptStorage | SetScriptStorage | GetStorageSize
  // Tab storage
  | GMGetTab | GMSaveTab | GMGetTabs
  // Settings
  | GetSettings | GetSetting | SetSettings | ResetSettings | GetExtensionStatus
  // Per-script settings
  | GetScriptSettings | SetScriptSettings
  // Updates
  | CheckUpdates | ForceUpdate | ApplyUpdate | GetVersionHistory | RollbackScript
  // Cloud sync
  | SyncNow | TestSync | ConnectSyncProvider | DisconnectSyncProvider
  | GetSyncProviderStatus | CloudExport | CloudImport | CloudStatus
  // Easy Cloud
  | EasyCloudConnect | EasyCloudDisconnect | EasyCloudSync | EasyCloudStatus
  // Import/export
  | ExportAll | ImportAll | ImportBackup | ExportZip | ImportFromZip | InstallFromUrl
  // Storage quota
  | GetStorageUsage | GetStorageBreakdown | CleanupStorage
  // Backup
  | CreateBackup | GetBackups | RestoreBackup | DeleteBackup
  | GetBackupSettings | SetBackupSettings
  // Profiles
  | GetProfiles | SwitchProfile | SaveProfile | DeleteProfile
  // Collections
  | GetCollections | SaveCollection | DeleteCollection
  // Folders
  | GetFolders | CreateFolder | UpdateFolder | DeleteFolder
  | AddScriptToFolder | RemoveScriptFromFolder | MoveScriptToFolder
  // GM APIs
  | GMXmlhttpRequest | GMXmlhttpRequestAbort | GMDownload
  | GMNotification | GMOpenInTab
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
  | GetScriptsForUrl | UpdateBadgeForTab | GMFocusTab | GMCloseTab
  // Extension info
  | GetExtensionInfo | PrefetchResources | Restart
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

/** Maps message types to their response types */
export interface ResponseMap {
  getScripts: GetScriptsResponse;
  getScript: Script | null;
  saveScript: SaveScriptResponse | ErrorResponse;
  createScript: SaveScriptResponse | ErrorResponse;
  deleteScript: SuccessResponse | ErrorResponse;
  toggleScript: SuccessResponse;
  duplicateScript: { success: true; script: Script } | ErrorResponse;
  searchScripts: { scripts: Script[] };
  reorderScripts: SuccessResponse;

  getTrash: GetTrashResponse;
  restoreFromTrash: SuccessResponse | ErrorResponse;
  emptyTrash: SuccessResponse;
  permanentlyDelete: SuccessResponse;

  getSettings: GetSettingsResponse;
  getSetting: unknown;
  setSettings: unknown;
  resetSettings: unknown;
  getExtensionStatus: ExtensionStatusResponse;

  getVersionHistory: VersionHistoryResponse;
  rollbackScript: { success: true; script: Script } | ErrorResponse;

  installFromUrl: { success: true } | ErrorResponse;

  getStorageUsage: StorageUsageResponse;

  importTampermonkeyBackup: ImportBackupResponse;
  importViolentmonkeyBackup: ImportBackupResponse;
  importGreasemonkeyBackup: ImportBackupResponse;
}

/**
 * Get the response type for a message.
 * Falls back to `unknown` for unmapped action types.
 */
export type ResponseFor<T extends BackgroundMessage> =
  T['action'] extends keyof ResponseMap
    ? ResponseMap[T['action']]
    : unknown;
