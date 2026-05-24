#!/usr/bin/env node
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
    id: 'error-log',
    source: 'src/modules/error-log.ts',
    output: 'modules/error-log.js',
    exportName: 'ErrorLog',
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
];

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

export async function buildTsRuntimeModuleText(definition, options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const sourcePath = join(rootDir, definition.source);
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
