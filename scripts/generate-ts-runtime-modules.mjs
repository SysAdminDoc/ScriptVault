// Generates runtime-compatible JavaScript artifacts from promoted TypeScript
// modules while ScriptVault keeps its ordered single-file MV3 concatenation
// build.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');

export const TS_RUNTIME_MODULES = [
  {
    id: 'shared-utils',
    source: 'src/shared/utils.ts',
    output: 'shared/utils.js',
    moduleName: 'SharedUtils',
    globalExports: [
      'escapeHtml',
      'generateId',
      'sanitizeUrl',
      'installBrowserNamespaceAlias',
      'classifyInstallSource',
      'formatBytes',
    ],
    autoInstallBrowserAlias: true,
  },
  {
    id: 'sync-providers',
    source: 'src/modules/sync-providers.ts',
    output: 'modules/sync-providers.js',
    exportName: 'CloudSyncProviders',
    selfExportName: 'CloudSyncProviders',
  },
  {
    id: 'sync-crypto',
    source: 'src/modules/sync-crypto.ts',
    output: 'modules/sync-crypto.js',
    exportName: 'SyncCrypto',
    selfExportName: 'SyncCrypto',
  },
  {
    id: 'error-log',
    source: 'src/modules/error-log.ts',
    output: 'modules/error-log.js',
    exportName: 'ErrorLog',
  },
  {
    id: 'event-log',
    source: 'src/modules/event-log.ts',
    output: 'modules/event-log.js',
    exportName: 'EventLog',
  },
  {
    id: 'notifications',
    source: 'src/modules/notifications.ts',
    output: 'modules/notifications.js',
    exportName: 'NotificationSystem',
  },
  {
    id: 'npm-resolve',
    source: 'src/modules/npm-resolve.ts',
    output: 'modules/npm-resolve.js',
    exportName: 'NpmResolver',
  },
  {
    id: 'quota-manager',
    source: 'src/modules/quota-manager.ts',
    output: 'modules/quota-manager.js',
    exportName: 'QuotaManager',
  },
  {
    id: 'subscriptions',
    source: 'src/modules/subscriptions.ts',
    output: 'modules/subscriptions.js',
    exportName: 'ScriptSubscriptions',
  },
  {
    id: 'sigstore-bundle-parser',
    source: 'src/modules/sigstore-bundle-parser.ts',
    output: 'modules/sigstore-bundle-parser.js',
    exportName: 'SigstoreBundleParser',
  },
  {
    id: 'sigstore-bundle-verifier',
    source: 'src/modules/sigstore-bundle-verifier.ts',
    output: 'modules/sigstore-bundle-verifier.js',
    exportName: 'SigstoreBundleVerifier',
  },
  {
    id: 'public-api',
    source: 'src/modules/public-api.ts',
    output: 'modules/public-api.js',
    exportName: 'PublicAPI',
  },
  {
    id: 'backup-scheduler',
    source: 'src/modules/backup-scheduler.ts',
    output: 'modules/backup-scheduler.js',
    exportName: 'BackupScheduler',
  },
  {
    id: 'sync-easycloud',
    source: 'src/modules/sync-easycloud.ts',
    output: 'modules/sync-easycloud.js',
    exportName: 'EasyCloudSync',
  },
  {
    id: 'script-config',
    source: 'src/modules/script-config.ts',
    output: 'modules/script-config.js',
    exportName: 'ScriptConfig',
    selfExportName: 'ScriptConfig',
  },
  {
    id: 'user-scripts-setup',
    source: 'src/modules/user-scripts-setup.ts',
    output: 'modules/user-scripts-setup.js',
    exportName: 'UserScriptsSetupDoctor',
    selfExportName: 'UserScriptsSetupDoctor',
  },
  {
    id: 'userstyles',
    source: 'src/modules/userstyles.ts',
    output: 'modules/userstyles.js',
    exportName: 'UserStylesEngine',
  },
  {
    id: 'xhr',
    source: 'src/modules/xhr.ts',
    output: 'modules/xhr.js',
    exportName: 'XhrManager',
  },
  {
    id: 'internal-host-guard',
    source: 'src/background/internal-host-guard.ts',
    output: 'modules/internal-host-guard.js',
    exportName: 'InternalHostGuard',
  },
  {
    id: 'host-permission-patterns',
    source: 'src/background/host-permission-patterns.ts',
    output: 'modules/host-permission-patterns.js',
    exportName: 'HostPermissionPatterns',
  },
  {
    id: 'user-script-message-policy',
    source: 'src/background/user-script-message-policy.ts',
    output: 'modules/user-script-message-policy.js',
    exportName: 'UserScriptMessagePolicy',
  },
  {
    id: 'message-router',
    source: 'src/background/message-router.ts',
    output: 'modules/message-router.js',
    exportName: 'MessageRouter',
    selfExportName: 'MessageRouter',
  },
  {
    id: 'gm-audio-handler',
    source: 'src/background/gm-audio-handler.ts',
    output: 'modules/gm-audio-handler.js',
    exportName: 'GMAudioHandler',
    selfExportName: 'GMAudioHandler',
  },
  {
    id: 'gm-menu-handler',
    source: 'src/background/gm-menu-handler.ts',
    output: 'modules/gm-menu-handler.js',
    exportName: 'GMMenuHandler',
    selfExportName: 'GMMenuHandler',
  },
  {
    id: 'connect-policy',
    source: 'src/background/connect-policy.ts',
    output: 'modules/connect-policy.js',
    exportName: 'ConnectPolicy',
  },
  {
    id: 'resources',
    source: 'src/modules/resources.ts',
    output: 'modules/resources.js',
    exportName: 'ResourceCache',
  },
  {
    id: 'storage',
    source: 'src/modules/storage.ts',
    output: 'modules/storage.js',
    moduleName: 'StorageModule',
    globalExports: [
      'SettingsManager',
      'ScriptStorage',
      'LocalWorkspaceBindings',
      'ScriptValues',
      'TabStorage',
      'FolderStorage',
      '_openTabTrackers',
      'setScriptChangeListener',
    ],
  },
  {
    id: 'i18n',
    source: 'src/modules/i18n.ts',
    output: 'modules/i18n.js',
    exportName: 'I18n',
  },
  {
    id: 'migration',
    source: 'src/modules/migration.ts',
    output: 'modules/migration.js',
    exportName: 'Migration',
  },
  {
    id: 'netlog',
    source: 'src/bg/netlog.ts',
    output: 'bg/netlog.js',
    exportName: 'NetworkLog',
  },
  {
    id: 'analyzer',
    source: 'src/bg/analyzer.ts',
    output: 'bg/analyzer.js',
    exportName: 'ScriptAnalyzer',
  },
  {
    id: 'esm-bundler',
    source: 'src/bg/esm-bundler.ts',
    output: 'bg/esm-bundler.js',
    exportName: 'ESMUserscriptBundler',
    selfExportName: 'ESMUserscriptBundler',
  },
  {
    id: 'signing',
    source: 'src/bg/signing.ts',
    output: 'bg/signing.js',
    exportName: 'ScriptSigning',
  },
  {
    id: 'workspaces',
    source: 'src/bg/workspaces.ts',
    output: 'bg/workspaces.js',
    exportName: 'WorkspaceManager',
  },
  {
    id: 'background-core',
    source: 'src/background/core.ts',
    output: 'background.core.js',
    copySource: true,
  },
];

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

export async function buildTsRuntimeModuleText(definition, options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const sourcePath = join(rootDir, definition.source);

  if (definition.copySource) {
    const source = normalizeNewlines(await readFile(sourcePath, 'utf8')).trimEnd();
    return [
      '// ============================================================================',
      `// Generated from ${definition.source}; do not edit by hand.`,
      '// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.',
      '// ============================================================================',
      '',
      source,
      '',
    ].join('\n');
  }

  const result = await build({
    entryPoints: [sourcePath],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'chrome120',
    legalComments: 'none',
    logLevel: 'silent',
  });
  const compiled = normalizeNewlines(result.outputFiles[0].text).trimEnd();

  if (definition.globalExports?.length) {
    const moduleName = definition.moduleName || `${definition.exportName || definition.id.replace(/[^A-Za-z0-9_$]/g, '_')}Module`;
    return [
      '// ============================================================================',
      `// Generated from ${definition.source}; do not edit by hand.`,
      '// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.',
      '// ============================================================================',
      '',
      `const ${moduleName} = (() => {`,
      '  const module = { exports: {} };',
      '  const exports = module.exports;',
      compiled.split('\n').map((line) => line ? `  ${line}` : '').join('\n'),
      '  return module.exports.default || module.exports;',
      '})();',
      '',
      ...definition.globalExports.flatMap((name) => [
        `const ${name} = ${moduleName}.${name};`,
      ]),
      ...(definition.autoInstallBrowserAlias ? [
        '',
        'try {',
        '  installBrowserNamespaceAlias(globalThis);',
        '} catch (_) {}',
      ] : []),
      '',
    ].join('\n');
  }

  return [
    '// ============================================================================',
    `// Generated from ${definition.source}; do not edit by hand.`,
    '// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.',
    '// ============================================================================',
    '',
    `const ${definition.exportName} = (() => {`,
    '  const module = { exports: {} };',
    '  const exports = module.exports;',
    compiled.split('\n').map((line) => line ? `  ${line}` : '').join('\n'),
    `  return module.exports.default || module.exports.${definition.exportName} || module.exports;`,
    '})();',
    ...(definition.selfExportName ? [
      '',
      'if (typeof self !== \'undefined\') {',
      `  self.${definition.selfExportName} = ${definition.exportName};`,
      '}',
    ] : []),
    '',
  ].join('\n');
}

export async function generateTsRuntimeModules(options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const check = Boolean(options.check);
  const only = new Set(options.modules || []);
  const selected = only.size > 0
    ? TS_RUNTIME_MODULES.filter((definition) => only.has(definition.id))
    : TS_RUNTIME_MODULES;
  const results = [];

  for (const definition of selected) {
    const text = await buildTsRuntimeModuleText(definition, { rootDir });
    const outputPath = join(rootDir, definition.output);
    let changed = true;
    try {
      const current = normalizeNewlines(await readFile(outputPath, 'utf8'));
      changed = current !== text;
    } catch {
      changed = true;
    }

    if (!check && changed) {
      await writeFile(outputPath, text, 'utf8');
    }

    results.push({
      id: definition.id,
      source: definition.source,
      output: definition.output,
      changed,
    });
  }

  if (only.size > 0 && only.size !== selected.length) {
    const known = new Set(TS_RUNTIME_MODULES.map((definition) => definition.id));
    const unknown = [...only].filter((id) => !known.has(id));
    throw new Error(`Unknown TS runtime module id: ${unknown.join(', ')}`);
  }

  return results;
}

function parseArgs(argv) {
  const options = {
    rootDir: DEFAULT_ROOT,
    check: false,
    modules: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--root':
        options.rootDir = resolve(argv[++i]);
        break;
      case '--check':
        options.check = true;
        break;
      case '--module':
        options.modules.push(argv[++i]);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const results = await generateTsRuntimeModules(options);

  for (const result of results) {
    const verb = options.check ? (result.changed ? 'drift' : 'ok') : (result.changed ? 'wrote' : 'ok');
    console.log(`[ts-runtime] ${verb}: ${result.output} <- ${result.source}`);
  }

  if (options.check && results.some((result) => result.changed)) return 1;
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    console.error(`[generate-ts-runtime-modules] ${err.message}`);
    process.exitCode = 2;
  });
}
