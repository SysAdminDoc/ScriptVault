/**
 * ScriptVault Background Service Worker — Entry Point
 *
 * This module wires together all background sub-modules and registers
 * Chrome event listeners. It is the single entry point for the service worker.
 *
 * NOTE: This is the TypeScript source. The production build still uses
 * build-background.sh / esbuild to concatenate the original JS modules.
 * This file exists to:
 *   1. Document the module dependency graph
 *   2. Provide a future entry point when the build switches to TS bundling
 *   3. Enable type-checking across module boundaries
 */

// ── Re-export sub-modules for type-checking ──────────────────────────

export { parseUserscript } from './parser';
export type { ParseResult, ParseSuccess, ParseError } from './parser';

export {
  doesScriptMatchUrl,
  matchPattern,
  matchIncludePattern,
  isValidMatchPattern,
  isRegexPattern,
  parseRegexPattern,
  extractMatchPatternsFromRegex,
  convertIncludeToMatch,
  isUrlBlockedByGlobalSettings,
} from './url-matcher';

export { UpdateSystem } from './update-checker';

export {
  assertExternalFetchUrl,
  classifyFetchUrl,
  classifyResponseUrl,
  isInternalHost,
} from './internal-host-guard';
export type { InternalHostCheckResult, InternalHostReason } from './internal-host-guard';
export {
  BACKGROUND_MESSAGE_ACTIONS,
  MessageRouter,
  getBackgroundActionOrigin,
  isKnownBackgroundAction,
  resolveBackgroundAction,
  createBackgroundActionRegistry,
} from './message-router';
export type {
  BackgroundAction,
  BackgroundActionOrigin,
  BackgroundActionResolution,
  KnownBackgroundActionResolution,
  UnknownBackgroundActionResolution,
  BackgroundActionContext,
  BackgroundActionDispatchResult,
  BackgroundActionHandler,
  BackgroundActionHandlers,
  BackgroundMessageFor,
} from './message-router';
export {
  IMPORT_BACKGROUND_ACTIONS,
  ImportActionHandler,
  createImportActionHandlers,
} from './import-action-handler';
export type {
  ImportActionDependencies,
  ImportBackgroundAction,
  VendorBackupType,
} from './import-action-handler';
export {
  EXECUTION_TELEMETRY_ACTIONS,
  TelemetryActionHandler,
  createTelemetryActionHandlers,
} from './telemetry-action-handler';
export type {
  ExecutionTelemetryBackgroundAction,
  TelemetryActionDependencies,
} from './telemetry-action-handler';
export {
  UPDATE_BACKGROUND_ACTIONS,
  UpdateActionHandler,
  createUpdateActionHandlers,
} from './update-action-handler';
export type {
  UpdateActionDependencies,
  UpdateBackgroundAction,
} from './update-action-handler';
export {
  SYNC_BACKGROUND_ACTIONS,
  SyncActionHandler,
  createSyncActionHandlers,
} from './sync-action-handler';
export type {
  CloudExportOptions,
  CloudImportOptions,
  SyncActionDependencies,
  SyncBackgroundAction,
} from './sync-action-handler';
export {
  BACKUP_BACKGROUND_ACTIONS,
  BackupActionHandler,
  createBackupActionHandlers,
} from './backup-action-handler';
export type {
  BackupActionDependencies,
  BackupBackgroundAction,
} from './backup-action-handler';
export {
  ORGANIZATION_BACKGROUND_ACTIONS,
  OrganizationActionHandler,
  createOrganizationActionHandlers,
} from './organization-action-handler';
export type {
  OrganizationActionDependencies,
  OrganizationBackgroundAction,
} from './organization-action-handler';
export {
  SETTINGS_BACKGROUND_ACTIONS,
  SettingsActionHandler,
  createSettingsActionHandlers,
} from './settings-action-handler';
export type {
  SettingsActionDependencies,
  SettingsBackgroundAction,
} from './settings-action-handler';
export {
  GM_AUDIO_ACTIONS,
  GMAudioHandler,
  handleGMAudioMessage,
  isGMAudioAction,
} from './gm-audio-handler';
export type { GMAudioAction } from './gm-audio-handler';
export {
  GM_MENU_ACTIONS,
  GMMenuHandler,
  handleGMMenuMessage,
  isGMMenuAction,
} from './gm-menu-handler';
export type { GMMenuAction } from './gm-menu-handler';
export {
  GM_TABS_ACTIONS,
  GMTabsHandler,
  handleGMTabsMessage,
  isGMTabsAction,
} from './gm-tabs-handler';
export type { GMTabsAction } from './gm-tabs-handler';
export {
  GM_VALUES_ACTIONS,
  GMValuesHandler,
  handleGMValuesMessage,
  isGMValuesAction,
} from './gm-values-handler';
export type { GMValuesAction } from './gm-values-handler';
export {
  GM_NOTIFICATION_ACTIONS,
  GMNotificationHandler,
  handleGMNotificationMessage,
  isGMNotificationAction,
} from './gm-notification-handler';
export type { GMNotificationAction } from './gm-notification-handler';
export {
  GM_RESOURCE_ACTIONS,
  GMResourceHandler,
  handleGMResourceMessage,
  isGMResourceAction,
} from './gm-resource-handler';
export type { GMResourceAction } from './gm-resource-handler';
export {
  GM_WEBREQUEST_ACTIONS,
  GMWebRequestHandler,
  handleGMWebRequestMessage,
  isGMWebRequestAction,
} from './gm-webrequest-handler';
export type { GMWebRequestAction } from './gm-webrequest-handler';
export {
  GM_COOKIE_ACTIONS,
  GMCookieHandler,
  handleGMCookieMessage,
  isGMCookieAction,
} from './gm-cookie-handler';
export type { GMCookieAction } from './gm-cookie-handler';
export {
  GM_NETWORK_ACTIONS,
  GMNetworkHandler,
  handleGMNetworkMessage,
  isGMNetworkAction,
} from './gm-network-handler';
export type { GMNetworkAction } from './gm-network-handler';
export { createScriptTrustReceipt, sha256Hex } from './trust-receipt';

export { CloudSync } from './cloud-sync';
export {
  GM_VALUE_SYNC_MAX_KEY_BYTES,
  GM_VALUE_SYNC_MAX_KEYS,
  GM_VALUE_SYNC_MAX_SCRIPT_BYTES,
  GM_VALUE_SYNC_SCHEMA,
  buildGmValueSyncBundle,
  shouldSyncScriptValues,
} from './gm-value-sync';
export type { GmValueSyncBuildResult, GmValueSyncBundle } from './gm-value-sync';

export {
  exportAllScripts,
  importScripts,
  exportToZip,
  importFromZip,
} from './import-export';

export { registerAllScripts, registerScript, unregisterScript } from './registration';

export {
  requireCache,
  LIBRARY_FALLBACKS,
  getFallbackUrls,
  isUnfetchableUrl,
  verifySRI,
  fetchRequireScript,
  fetchProvenanceBundle,
  fetchWithRetry,
} from './resource-loader';

export {
  applyWebRequestRules,
  removeWebRequestRules,
  reconcileWebRequestRuleMap,
} from './dnr-rules';

export { buildWrappedScript } from './wrapper-builder';
export type { RequireScript } from './wrapper-builder';

export {
  BACKGROUND_RUNNER_ALLOWED_GRANTS,
  BACKGROUND_RUNNER_BUDGET_LIMITS,
  DEFAULT_BACKGROUND_RUNNER_BUDGET,
  getBackgroundRunnerTriggers,
  getUnsupportedBackgroundGrants,
  normalizeBackgroundGrant,
  normalizeBackgroundRunnerBudget,
  planBackgroundScript,
} from './background-runner';
export type {
  BackgroundRunnerBudget,
  BackgroundRunnerStatus,
  BackgroundRunnerTrigger,
  BackgroundScriptCandidate,
  BackgroundScriptPlan,
} from './background-runner';
export { buildBackgroundWrappedScript } from './background-wrapper';
export type { BackgroundWrapperOptions } from './background-wrapper';
export { prepareBackgroundRunnerPayload } from './background-runner-bridge';
export type {
  BackgroundRunnerBridgeOptions,
  BackgroundRunnerBridgeResult,
  BackgroundRunnerBridgeStatus,
  BackgroundRunnerPayload,
} from './background-runner-bridge';

export { updateBadge, updateBadgeForTab } from './badge';

export { autoReloadMatchingTabs } from './tab-reload';

export {
  setupContextMenus,
  registerOnInstalledListener,
  registerContextMenuClickListener,
  registerKeyboardShortcutListener,
} from './context-menu';

export {
  installFromUrl,
  installFromCode,
  fetchScriptPreview,
  probeInstallDependency,
  scriptSourceByteLength,
  registerWebNavigationListener,
} from './install-handler';
