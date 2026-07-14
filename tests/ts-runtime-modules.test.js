// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const {
  TS_RUNTIME_MODULES,
  buildTsRuntimeModuleText,
  generateTsRuntimeModules,
} = await import(/* @vite-ignore */ pathToFileURL(resolve(process.cwd(), 'scripts/generate-ts-runtime-modules.mjs')).href);

const ROOT = process.cwd();

describe('TS runtime module generator', () => {
  it('declares the promoted error-log module', () => {
    expect(TS_RUNTIME_MODULES).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'shared-utils',
        source: 'src/shared/utils.ts',
        output: 'shared/utils.js',
        moduleName: 'SharedUtils',
        globalExports: expect.arrayContaining([
          'escapeHtml',
          'generateId',
          'sanitizeUrl',
          'installBrowserNamespaceAlias',
          'classifyInstallSource',
          'formatBytes',
        ]),
      }),
      expect.objectContaining({
        id: 'sync-providers',
        source: 'src/modules/sync-providers.ts',
        output: 'modules/sync-providers.js',
        exportName: 'CloudSyncProviders',
        selfExportName: 'CloudSyncProviders',
      }),
      expect.objectContaining({
        id: 'sync-crypto',
        source: 'src/modules/sync-crypto.ts',
        output: 'modules/sync-crypto.js',
        exportName: 'SyncCrypto',
        selfExportName: 'SyncCrypto',
      }),
      expect.objectContaining({
        id: 'cloud-sync',
        source: 'src/background/cloud-sync.ts',
        output: 'modules/cloud-sync.js',
        exportName: 'CloudSync',
        selfExportName: 'CloudSync',
      }),
      expect.objectContaining({
        id: 'error-log',
        source: 'src/modules/error-log.ts',
        output: 'modules/error-log.js',
        exportName: 'ErrorLog',
      }),
      expect.objectContaining({
        id: 'notifications',
        source: 'src/modules/notifications.ts',
        output: 'modules/notifications.js',
        exportName: 'NotificationSystem',
      }),
      expect.objectContaining({
        id: 'npm-resolve',
        source: 'src/modules/npm-resolve.ts',
        output: 'modules/npm-resolve.js',
        exportName: 'NpmResolver',
      }),
      expect.objectContaining({
        id: 'quota-manager',
        source: 'src/modules/quota-manager.ts',
        output: 'modules/quota-manager.js',
        exportName: 'QuotaManager',
      }),
      expect.objectContaining({
        id: 'subscriptions',
        source: 'src/modules/subscriptions.ts',
        output: 'modules/subscriptions.js',
        exportName: 'ScriptSubscriptions',
      }),
      expect.objectContaining({
        id: 'sigstore-bundle-parser',
        source: 'src/modules/sigstore-bundle-parser.ts',
        output: 'modules/sigstore-bundle-parser.js',
        exportName: 'SigstoreBundleParser',
      }),
      expect.objectContaining({
        id: 'sigstore-bundle-verifier',
        source: 'src/modules/sigstore-bundle-verifier.ts',
        output: 'modules/sigstore-bundle-verifier.js',
        exportName: 'SigstoreBundleVerifier',
      }),
      expect.objectContaining({
        id: 'public-api',
        source: 'src/modules/public-api.ts',
        output: 'modules/public-api.js',
        exportName: 'PublicAPI',
      }),
      expect.objectContaining({
        id: 'backup-scheduler',
        source: 'src/modules/backup-scheduler.ts',
        output: 'modules/backup-scheduler.js',
        exportName: 'BackupScheduler',
      }),
      expect.objectContaining({
        id: 'sync-easycloud',
        source: 'src/modules/sync-easycloud.ts',
        output: 'modules/sync-easycloud.js',
        exportName: 'EasyCloudSync',
      }),
      expect.objectContaining({
        id: 'script-config',
        source: 'src/modules/script-config.ts',
        output: 'modules/script-config.js',
        exportName: 'ScriptConfig',
        selfExportName: 'ScriptConfig',
      }),
      expect.objectContaining({
        id: 'userstyles',
        source: 'src/modules/userstyles.ts',
        output: 'modules/userstyles.js',
        exportName: 'UserStylesEngine',
      }),
      expect.objectContaining({
        id: 'xhr',
        source: 'src/modules/xhr.ts',
        output: 'modules/xhr.js',
        exportName: 'XhrManager',
      }),
      expect.objectContaining({
        id: 'internal-host-guard',
        source: 'src/background/internal-host-guard.ts',
        output: 'modules/internal-host-guard.js',
        exportName: 'InternalHostGuard',
      }),
      expect.objectContaining({
        id: 'user-script-message-policy',
        source: 'src/background/user-script-message-policy.ts',
        output: 'modules/user-script-message-policy.js',
        exportName: 'UserScriptMessagePolicy',
      }),
      expect.objectContaining({
        id: 'execution-diagnostics',
        source: 'src/background/execution-diagnostics.ts',
        output: 'modules/execution-diagnostics.js',
        exportName: 'ExecutionDiagnostics',
        selfExportName: 'ExecutionDiagnostics',
      }),
      expect.objectContaining({
        id: 'find-script-sources',
        source: 'src/background/find-script-sources.ts',
        output: 'modules/find-script-sources.js',
        exportName: 'FindScriptSources',
        selfExportName: 'FindScriptSources',
      }),
      expect.objectContaining({
        id: 'local-libraries',
        source: 'src/background/local-libraries.ts',
        output: 'modules/local-libraries.js',
        exportName: 'LocalLibraries',
        selfExportName: 'LocalLibraries',
      }),
      expect.objectContaining({
        id: 'message-router',
        source: 'src/background/message-router.ts',
        output: 'modules/message-router.js',
        exportName: 'MessageRouter',
        selfExportName: 'MessageRouter',
      }),
      expect.objectContaining({
        id: 'gm-audio-handler',
        source: 'src/background/gm-audio-handler.ts',
        output: 'modules/gm-audio-handler.js',
        exportName: 'GMAudioHandler',
        selfExportName: 'GMAudioHandler',
      }),
      expect.objectContaining({
        id: 'gm-menu-handler',
        source: 'src/background/gm-menu-handler.ts',
        output: 'modules/gm-menu-handler.js',
        exportName: 'GMMenuHandler',
        selfExportName: 'GMMenuHandler',
      }),
      expect.objectContaining({
        id: 'gm-tabs-handler',
        source: 'src/background/gm-tabs-handler.ts',
        output: 'modules/gm-tabs-handler.js',
        exportName: 'GMTabsHandler',
        selfExportName: 'GMTabsHandler',
      }),
      expect.objectContaining({
        id: 'gm-values-handler',
        source: 'src/background/gm-values-handler.ts',
        output: 'modules/gm-values-handler.js',
        exportName: 'GMValuesHandler',
        selfExportName: 'GMValuesHandler',
      }),
      expect.objectContaining({
        id: 'gm-notification-handler',
        source: 'src/background/gm-notification-handler.ts',
        output: 'modules/gm-notification-handler.js',
        exportName: 'GMNotificationHandler',
        selfExportName: 'GMNotificationHandler',
      }),
      expect.objectContaining({
        id: 'gm-resource-handler',
        source: 'src/background/gm-resource-handler.ts',
        output: 'modules/gm-resource-handler.js',
        exportName: 'GMResourceHandler',
        selfExportName: 'GMResourceHandler',
      }),
      expect.objectContaining({
        id: 'gm-webrequest-handler',
        source: 'src/background/gm-webrequest-handler.ts',
        output: 'modules/gm-webrequest-handler.js',
        exportName: 'GMWebRequestHandler',
        selfExportName: 'GMWebRequestHandler',
      }),
      expect.objectContaining({
        id: 'gm-cookie-handler',
        source: 'src/background/gm-cookie-handler.ts',
        output: 'modules/gm-cookie-handler.js',
        exportName: 'GMCookieHandler',
        selfExportName: 'GMCookieHandler',
      }),
      expect.objectContaining({
        id: 'gm-network-handler',
        source: 'src/background/gm-network-handler.ts',
        output: 'modules/gm-network-handler.js',
        exportName: 'GMNetworkHandler',
        selfExportName: 'GMNetworkHandler',
      }),
      expect.objectContaining({
        id: 'resources',
        source: 'src/modules/resources.ts',
        output: 'modules/resources.js',
        exportName: 'ResourceCache',
      }),
      expect.objectContaining({
        id: 'storage',
        source: 'src/modules/storage.ts',
        output: 'modules/storage.js',
        moduleName: 'StorageModule',
        globalExports: expect.arrayContaining([
          'SettingsManager',
          'ScriptStorage',
          'LocalWorkspaceBindings',
          'ScriptValues',
          'BackupsDAO',
          'TabStorage',
          'FolderStorage',
          '_openTabTrackers',
          'setScriptChangeListener',
        ]),
      }),
      expect.objectContaining({
        id: 'i18n',
        source: 'src/modules/i18n.ts',
        output: 'modules/i18n.js',
        exportName: 'I18n',
      }),
      expect.objectContaining({
        id: 'migration',
        source: 'src/modules/migration.ts',
        output: 'modules/migration.js',
        exportName: 'Migration',
      }),
      expect.objectContaining({
        id: 'netlog',
        source: 'src/bg/netlog.ts',
        output: 'bg/netlog.js',
        exportName: 'NetworkLog',
      }),
      expect.objectContaining({
        id: 'analyzer',
        source: 'src/bg/analyzer.ts',
        output: 'bg/analyzer.js',
        exportName: 'ScriptAnalyzer',
      }),
      expect.objectContaining({
        id: 'esm-bundler',
        source: 'src/bg/esm-bundler.ts',
        output: 'bg/esm-bundler.js',
        exportName: 'ESMUserscriptBundler',
        selfExportName: 'ESMUserscriptBundler',
      }),
      expect.objectContaining({
        id: 'workspaces',
        source: 'src/bg/workspaces.ts',
        output: 'bg/workspaces.js',
        exportName: 'WorkspaceManager',
      }),
      expect.objectContaining({
        id: 'signing',
        source: 'src/bg/signing.ts',
        output: 'bg/signing.js',
        exportName: 'ScriptSigning',
      }),
      expect.objectContaining({
        id: 'background-core',
        source: 'src/background/core.ts',
        output: 'background.core.js',
        copySource: true,
      }),
    ]));
  });

  it('generates runtime-compatible artifacts from TypeScript', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'quota-manager');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/modules/quota-manager.ts');
    expect(text).toContain('const QuotaManager = (() => {');
    expect(text).toContain('return module.exports.default || module.exports.QuotaManager || module.exports;');
    expect(text).not.toContain('export default');
  });

  it('generates multi-global runtime artifacts for storage', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'storage');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/modules/storage.ts');
    expect(text).toContain('const StorageModule = (() => {');
    expect(text).toContain('const SettingsManager = StorageModule.SettingsManager;');
    expect(text).toContain('const ScriptStorage = StorageModule.ScriptStorage;');
    expect(text).toContain('const LocalWorkspaceBindings = StorageModule.LocalWorkspaceBindings;');
    expect(text).toContain('const BackupsDAO = StorageModule.BackupsDAO;');
    expect(text).toContain('const setScriptChangeListener = StorageModule.setScriptChangeListener;');
    expect(text).not.toContain('const debugLog = StorageModule.debugLog;');
  });

  it('generates multi-global runtime artifacts for shared utilities', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'shared-utils');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/shared/utils.ts');
    expect(text).toContain('const SharedUtils = (() => {');
    expect(text).toContain('const escapeHtml = SharedUtils.escapeHtml;');
    expect(text).toContain('const installBrowserNamespaceAlias = SharedUtils.installBrowserNamespaceAlias;');
    expect(text).toContain('installBrowserNamespaceAlias(globalThis);');
    expect(text).toContain('const classifyInstallSource = SharedUtils.classifyInstallSource;');
  });

  it('generates the extracted CloudSync orchestrator before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'cloud-sync');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/cloud-sync.ts');
    expect(text).toContain('const CloudSync = (() => {');
    expect(text).toContain('self.CloudSync = CloudSync;');
    expect(text).toContain('syncTimeoutAlarm');
  });

  it('generates the background message router before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'message-router');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/message-router.ts');
    expect(text).toContain('const MessageRouter = (() => {');
    expect(text).toContain('self.MessageRouter = MessageRouter;');
    expect(text).toContain('BACKGROUND_MESSAGE_ACTIONS');
  });

  it('generates the bounded execution diagnostics store before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'execution-diagnostics');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/execution-diagnostics.ts');
    expect(text).toContain('const ExecutionDiagnostics = (() => {');
    expect(text).toContain('self.ExecutionDiagnostics = ExecutionDiagnostics;');
    expect(text).toContain('createExecutionDiagnosticsStore');
  });

  it('generates the reviewed Find Scripts source registry', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'find-script-sources');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/find-script-sources.ts');
    expect(text).toContain('const FindScriptSources = (() => {');
    expect(text).toContain('self.FindScriptSources = FindScriptSources;');
    expect(text).toContain('buildCustomFindScriptSourceUrl');
  });

  it('generates the extracted GM audio handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-audio-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-audio-handler.ts');
    expect(text).toContain('const GMAudioHandler = (() => {');
    expect(text).toContain('self.GMAudioHandler = GMAudioHandler;');
    expect(text).toContain('GM_AUDIO_ACTIONS');
  });

  it('generates the extracted GM menu handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-menu-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-menu-handler.ts');
    expect(text).toContain('const GMMenuHandler = (() => {');
    expect(text).toContain('self.GMMenuHandler = GMMenuHandler;');
    expect(text).toContain('GM_MENU_ACTIONS');
  });

  it('generates the extracted GM tab handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-tabs-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-tabs-handler.ts');
    expect(text).toContain('const GMTabsHandler = (() => {');
    expect(text).toContain('self.GMTabsHandler = GMTabsHandler;');
    expect(text).toContain('GM_TABS_ACTIONS');
  });

  it('generates the extracted GM values handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-values-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-values-handler.ts');
    expect(text).toContain('const GMValuesHandler = (() => {');
    expect(text).toContain('self.GMValuesHandler = GMValuesHandler;');
    expect(text).toContain('GM_VALUES_ACTIONS');
  });

  it('generates the extracted GM notification handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-notification-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-notification-handler.ts');
    expect(text).toContain('const GMNotificationHandler = (() => {');
    expect(text).toContain('self.GMNotificationHandler = GMNotificationHandler;');
    expect(text).toContain('GM_NOTIFICATION_ACTIONS');
  });

  it('generates the extracted GM resource handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-resource-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-resource-handler.ts');
    expect(text).toContain('const GMResourceHandler = (() => {');
    expect(text).toContain('self.GMResourceHandler = GMResourceHandler;');
    expect(text).toContain('GM_RESOURCE_ACTIONS');
  });

  it('generates the extracted GM webRequest handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-webrequest-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-webrequest-handler.ts');
    expect(text).toContain('const GMWebRequestHandler = (() => {');
    expect(text).toContain('self.GMWebRequestHandler = GMWebRequestHandler;');
    expect(text).toContain('GM_WEBREQUEST_ACTIONS');
  });

  it('generates the extracted GM cookie handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-cookie-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-cookie-handler.ts');
    expect(text).toContain('const GMCookieHandler = (() => {');
    expect(text).toContain('self.GMCookieHandler = GMCookieHandler;');
    expect(text).toContain('GM_COOKIE_ACTIONS');
  });

  it('generates the extracted GM network handler before the raw core bridge', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'gm-network-handler');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/gm-network-handler.ts');
    expect(text).toContain('const GMNetworkHandler = (() => {');
    expect(text).toContain('self.GMNetworkHandler = GMNetworkHandler;');
    expect(text).toContain('GM_NETWORK_ACTIONS');
  });

  it('generates the raw background core bridge without hiding top-level functions', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'background-core');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/background/core.ts');
    expect(text).toContain('function parseUserscript(code)');
    expect(text).toContain('chrome.runtime.onMessage.addListener');
    expect(text).not.toContain('const BackgroundCore = (() => {');
  });

  it('keeps committed runtime artifacts in sync', async () => {
    const results = await generateTsRuntimeModules({ rootDir: ROOT, check: true });

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'error-log', changed: false }),
      expect.objectContaining({ id: 'notifications', changed: false }),
    ]));
    for (const definition of TS_RUNTIME_MODULES) {
      const current = readFileSync(resolve(ROOT, definition.output), 'utf8').replace(/\r\n/g, '\n');
      const expected = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });
      expect(current).toBe(expected);
    }
  });
});
