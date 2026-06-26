import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const lazyLoader = readFileSync(resolve(process.cwd(), 'pages/dashboard-lazy-loader.js'), 'utf8');
const localeDocs = readFileSync(resolve(process.cwd(), 'docs/locale-coverage.md'), 'utf8');
const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

describe('dashboard i18n-v2 removal', () => {
  it('does not ship or eager-load the dead dashboard dictionary', () => {
    expect(existsSync(resolve(process.cwd(), 'pages/dashboard-i18n-v2.js'))).toBe(false);
    expect(dashboardHtml).not.toContain('dashboard-i18n-v2.js');
    expect(lazyLoader).not.toContain('dashboard-i18n-v2.js');
    expect(dashboardJs).not.toContain('I18nV2');
    expect(dashboardJs).not.toContain('syncDashboardModuleLanguage');
  });

  it('removes the dashboard language selector that had no translation target', () => {
    expect(dashboardHtml).not.toContain('id="settingsLanguage"');
    expect(dashboardJs).not.toContain('settingsLanguage');
  });

  it('keeps locale claims scoped to active runtime surfaces', () => {
    expect(readme).toContain('Manifest, browser-facing extension messages, and core dashboard shell controls');
    expect(readme).toContain('Deep dashboard content is still being migrated to DOM translation coverage');
    expect(localeDocs).not.toContain('dashboard-i18n-v2.js');
    expect(dashboardHtml).toContain('<script src="../modules/i18n.js"></script>');
    expect(dashboardJs).toContain('function applyDashboardI18n()');
    expect(dashboardJs).toContain('i18n.applyToDOM(document)');
  });

  it('translates the scripts table, empty state, and update queue through the active runtime dictionary', () => {
    expect(dashboardHtml).toContain('data-sort-i18n="scriptOrder"');
    expect(dashboardHtml).toContain('data-sort-i18n="scriptPerformance"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="selectAllShownScriptsTable"');
    expect(dashboardHtml).toContain('data-i18n="emptyVaultTitle"');
    expect(dashboardHtml).toContain('data-i18n="updatesQueue"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="updateQueueActions"');
    expect(dashboardJs).toContain("tDashboard('emptyVaultTitle'");
    expect(dashboardJs).toContain("'queuedUpdatesSummary'");
    expect(dashboardJs).toContain("button.dataset.sortLabel = label");
  });

  it('translates the settings hero, filters, and dynamic summary copy through the runtime dictionary', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsPreferences"');
    expect(dashboardHtml).toContain('data-i18n-placeholder="settingsSearchPlaceholder"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="settingsCategoryFilters"');
    expect(dashboardHtml).toContain('data-i18n="settingsFilterSecurity"');
    expect(dashboardJs).toContain("'settingsSectionsCount'");
    expect(dashboardJs).toContain("'settingsAdvancedShownCount'");
    expect(dashboardJs).toContain("'settingsShowingFilterMode'");
    expect(dashboardJs).toContain('function getSettingsFilterLabel(filter)');
  });

  it('translates first-run setup guidance through the runtime dictionary', () => {
    expect(dashboardHtml).toContain('data-i18n="skipToMainContent"');
    expect(dashboardHtml).toContain('data-i18n="setupRequiredLabel"');
    expect(dashboardHtml).toContain('data-i18n="setupWarningIntro"');
    expect(dashboardHtml).toContain('data-i18n="setupAllowUserScriptsToggle"');
    expect(dashboardHtml).toContain('data-i18n="setupWarningMiddle"');
    expect(dashboardHtml).toContain('data-i18n="setupDeveloperMode"');
    expect(dashboardHtml).toContain('data-i18n="setupWarningEnd"');
    expect(dashboardHtml).toContain('data-i18n="setupOpenExtensionDetails"');
    expect(dashboardHtml).toContain('data-i18n="setupHowToEnable"');
    expect(dashboardHtml).toContain('data-i18n-title="setupDismissWarning"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="setupDismissWarning"');
  });

  it('translates the Settings General controls and helper titles through the runtime dictionary', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsConfigModeLabel"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsConfigModeHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsAutoReloadPages"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsAutoReloadHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsDebugScripts"');
    expect(dashboardHtml).toContain('data-i18n="settingsShowFixedSource"');
    expect(dashboardHtml).toContain('data-i18n="settingsLoggingLevelLabel"');
    expect(dashboardHtml).toContain('data-i18n="loggingWarning"');
    expect(dashboardHtml).toContain('data-i18n="settingsTrashModeLabel"');
    expect(dashboardHtml).toContain('data-i18n="trashModeThirtyDays"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsTrashModeHelp"');
  });

  it('translates appearance, menu, search, update, and externals settings controls', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsLayoutLabel"');
    expect(dashboardHtml).toContain('data-i18n="layoutAutoSystem"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsCustomCssHelp"');
    expect(dashboardHtml).toContain('data-i18n-placeholder="settingsCustomCssPlaceholder"');
    expect(dashboardHtml).toContain('data-i18n="settingsUpdateNotificationLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsSiteMarkerRichBadge"');
    expect(dashboardHtml).toContain('data-i18n="settingsThemeEditor"');
    expect(dashboardHtml).toContain('data-i18n="settingsEnableTags"');
    expect(dashboardHtml).toContain('data-i18n="settingsActionMenu"');
    expect(dashboardHtml).toContain('data-i18n="settingsUserscriptOrderLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsBadgeInfoRunning"');
    expect(dashboardHtml).toContain('data-i18n="settingsContextMenu"');
    expect(dashboardHtml).toContain('data-i18n="settingsUserscriptSearch"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsSearchIntegrationHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsUpdateDisabledScripts"');
    expect(dashboardHtml).toContain('data-i18n="intervalEvery12Hours"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsExternalsHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsUpdateIntervalLabel"');
  });

  it('translates userscript sync settings, credential fields, and action controls', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsUserscriptSync"');
    expect(dashboardHtml).toContain('data-i18n="settingsEnableUserscriptSync"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsSyncAcrossDevicesHelp"');
    expect(dashboardHtml).toContain('data-i18n="syncProviderS3Compatible"');
    expect(dashboardHtml).toContain('data-i18n="settingsFirefoxSyncWebdavOnly"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsAllowInternalSyncEndpointsHelp"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsSyncCredentialsSessionOnlyHelp"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="settingsSyncEncryptionPassphraseAria"');
    expect(dashboardHtml).toContain('data-i18n-placeholder="settingsS3EndpointPlaceholder"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="settingsS3SecretKeyAria"');
    expect(dashboardHtml).toContain('data-i18n="settingsS3CredentialNote"');
    expect(dashboardHtml).toContain('data-i18n-placeholder="settingsWebdavUrlPlaceholder"');
    expect(dashboardHtml).toContain('data-i18n="settingsSyncTokenStorageDisclosure"');
    expect(dashboardHtml).toContain('data-i18n="syncDownloadPreview"');
    expect(dashboardHtml).toContain('data-i18n="syncSaveProviderSettings"');
  });

  it('translates editor preference controls and helper text', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsEnableEnhancedEditor"');
    expect(dashboardHtml).toContain('data-i18n="settingsEditorThemeLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsEditorFontSizeLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsKeyMappingLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsIndentationWidthLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsIndentWithLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsTabModeLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsHighlightMatchesLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsAutosaveOnBlur"');
    expect(dashboardHtml).toContain('data-i18n="settingsNoSaveConfirm"');
    expect(dashboardHtml).toContain('data-i18n="settingsTrimTrailingWhitespaceModifiedLines"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsLintOnTypeHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsLintMaxSizeLabel"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsCustomLinterConfigHelp"');
  });

  it('translates security and runtime host permission settings controls', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsContentScriptApiLabel"');
    expect(dashboardHtml).toContain('data-i18n="contentScriptApiUserScripts"');
    expect(dashboardHtml).toContain('data-i18n="settingsSandboxModeLabel"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsSandboxModeHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsModifyCspLabel"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsModifyCspHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsStatsUrlRetentionLabel"');
    expect(dashboardHtml).toContain('data-i18n-title="settingsStatsUrlRetentionHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsAllowHighPrivilegeApis"');
    expect(dashboardHtml).toContain('data-i18n="settingsAllowCommunicationLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsSriLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsCheckConnectLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsWhitelistedPagesLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsRuntimeHostPermissions"');
    expect(dashboardHtml).toContain('data-i18n-placeholder="settingsDeniedHostsPlaceholder"');
    expect(dashboardHtml).toContain('data-i18n="grantAll"');
    expect(dashboardHtml).toContain('data-i18n="resetList"');
  });

  it('translates BlackCheck, downloads, experimental, reset, and settings empty state controls', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsBlackCheck"');
    expect(dashboardHtml).toContain('data-i18n="blacklistSourceRemoteManual"');
    expect(dashboardHtml).toContain('data-i18n="manualBlacklistLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsDownloadsBeta"');
    expect(dashboardHtml).toContain('data-i18n="downloadsPermissionChecking"');
    expect(dashboardHtml).toContain('data-i18n-title="downloadsPermissionHelp"');
    expect(dashboardHtml).toContain('data-i18n="downloadModeLabel"');
    expect(dashboardHtml).toContain('data-i18n-title="downloadWhitelistHelp"');
    expect(dashboardHtml).toContain('data-i18n="settingsStrictModeLabel"');
    expect(dashboardHtml).toContain('data-i18n="settingsTopLevelAwaitLabel"');
    expect(dashboardHtml).toContain('data-i18n="restartScriptVault"');
    expect(dashboardHtml).toContain('data-i18n="factoryReset"');
    expect(dashboardHtml).toContain('data-i18n="settingsNoMatchesTitle"');
    expect(dashboardHtml).toContain('data-i18n="settingsNoMatchesDescription"');
  });

  it('translates utilities export, cloud, and backup schedule controls', () => {
    expect(dashboardHtml).toContain('data-i18n="utilitiesOperations"');
    expect(dashboardHtml).toContain('data-i18n-placeholder="utilitiesSearchPlaceholder"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="utilitiesCategoryFilters"');
    expect(dashboardHtml).toContain('data-i18n="exportIncludeStorageLabel"');
    expect(dashboardHtml).toContain('data-i18n="exportCredentialsRisk"');
    expect(dashboardHtml).toContain('data-i18n="settingsSyncProviderLabel"');
    expect(dashboardHtml).toContain('data-i18n="cloudBackupToCloud"');
    expect(dashboardHtml).toContain('data-i18n="restoreFromFile"');
    expect(dashboardHtml).toContain('data-i18n="downloadZip"');
    expect(dashboardHtml).toContain('data-i18n="vaultJsonDescription"');
    expect(dashboardHtml).toContain('data-i18n="backupScheduleTitle"');
    expect(dashboardHtml).toContain('data-i18n="backupEnableAutomatic"');
    expect(dashboardHtml).toContain('data-i18n="weekdayWednesday"');
    expect(dashboardHtml).toContain('data-i18n="backupIncludeCredentialsHelp"');
    expect(dashboardHtml).toContain('data-i18n="saveBackupSchedule"');
  });
});
