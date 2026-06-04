import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TS_RUNTIME_MODULES,
  buildTsRuntimeModuleText,
  generateTsRuntimeModules,
} from '../scripts/generate-ts-runtime-modules.mjs';

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
          'classifyInstallSource',
          'formatBytes',
        ]),
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
        id: 'public-api',
        source: 'src/modules/public-api.ts',
        output: 'modules/public-api.js',
        exportName: 'PublicAPI',
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
          'ScriptValues',
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
    expect(text).toContain('const setScriptChangeListener = StorageModule.setScriptChangeListener;');
    expect(text).not.toContain('const debugLog = StorageModule.debugLog;');
  });

  it('generates multi-global runtime artifacts for shared utilities', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'shared-utils');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/shared/utils.ts');
    expect(text).toContain('const SharedUtils = (() => {');
    expect(text).toContain('const escapeHtml = SharedUtils.escapeHtml;');
    expect(text).toContain('const classifyInstallSource = SharedUtils.classifyInstallSource;');
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
