/**
 * Globals provided by the generated service-worker concatenation order.
 *
 * These modules are emitted as classic scripts and loaded before
 * `background.core.js`; they are not ES imports at runtime. Keep this list as
 * the explicit unsafe boundary while the remaining core is extracted into
 * importable TypeScript modules.
 */
declare const BackupActionHandler: any;
declare const BackupScheduler: any;
declare const BackupsDAO: any;
declare const CloudSync: any;
declare const CloudSyncProviders: any;
declare const ConnectPolicy: any;
declare const DataActionHandler: any;
declare const DiagnosticsActionHandler: any;
declare const EasyCloudSync: any;
declare const ErrorLog: any;
declare const ESMUserscriptBundler: any;
declare const ExecutionDiagnostics: any;
declare const ExecutionTelemetry: any;
declare const fflate: any;
declare const FolderStorage: any;
declare const GMAudioHandler: any;
declare const GMCookieHandler: any;
declare const GMMenuHandler: any;
declare const GMNetworkHandler: any;
declare const GMNotificationHandler: any;
declare const GMResourceHandler: any;
declare const GMTabsHandler: any;
declare const GMValuesHandler: any;
declare const GMWebRequestHandler: any;
declare const HostPermissionPatterns: any;
declare const I18n: any;
declare const ImportActionHandler: any;
declare const InternalHostGuard: any;
declare const LocalLibraries: any;
declare const LocalWorkspaceBindings: any;
declare const MessageRouter: any;
declare const Migration: any;
declare const NetworkLog: any;
declare const NotificationSystem: any;
declare const NpmResolver: any;
declare const OnDeviceAI: any;
declare const OrganizationActionHandler: any;
declare const PublicAPI: any;
declare const QuotaManager: any;
declare const ResourceCache: any;
declare const RuntimeActionHandler: any;
declare const ScriptActionHandler: any;
declare const ScriptAnalyzer: any;
declare const ScriptConfig: any;
declare const ScriptSigning: any;
declare const ScriptStorage: any;
declare const ScriptSubscriptions: any;
declare const ScriptValues: any;
declare const SecurityActionHandler: any;
declare const SettingsActionHandler: any;
declare const SettingsManager: any;
declare const SigstoreBundleVerifier: any;
declare const SyncActionHandler: any;
declare const SyncCrypto: any;
declare const TelemetryActionHandler: any;
declare const UpdateActionHandler: any;
declare const UserScriptMessagePolicy: any;
declare const UserStylesEngine: any;
declare const WorkspaceManager: any;

declare function _extractHostScopeHost(pattern: string): string;
declare function classifyInstallSource(url: string): any;
declare function formatBytes(bytes: number): string;
declare function generateId(): string;
declare function isHighPrivilegeScriptApiOverride(value: unknown): boolean;
declare function setScriptChangeListener(listener: (...args: any[]) => void): void;

declare namespace chrome {
  const menus: typeof contextMenus;
}

interface Window {
  SessionState: any;
  _audioWatchedTabs: any;
  _initPromise: Promise<unknown> | null;
  _notifCallbacks: any;
  _openTabTrackers: any;
  _pendingDownloads: any;
  _pendingDownloadTimers: Map<number, ReturnType<typeof setTimeout>>;
  _toggleLocks: Map<string, Promise<unknown>>;
  _gmWebSockets: Map<string, any>;
  _lastRuntimeHostPermissionTarget: any;
  SigstoreBundleVerifier: any;
  ensureInitialized: () => Promise<unknown>;
}
