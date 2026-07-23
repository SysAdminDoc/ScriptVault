#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(scriptDir, '..');

const REQUIRED_OUTPUTS = [
  'lib/monaco-esm/editor.js',
  'lib/monaco-esm/editor.css',
  'lib/monaco-esm/workers/editor.worker.js',
  'lib/monaco-esm/workers/json.worker.js',
  'lib/monaco-esm/workers/css.worker.js',
  'lib/monaco-esm/workers/html.worker.js',
  'lib/monaco-esm/workers/ts.worker.js',
  'lib/monaco-esm/workers/userscript-lsp.worker.js',
];

// Budgets raised for monaco-editor 0.56.0 (from 0.55.1). The 0.56 bundle brings
// DOMPurify 3.4.5 natively (closing CVE-2026-0540 without relying on the repo
// override) at a ~1.3% size cost: total 28.36 MB and editor.js 9.78 MB. Headroom
// added above the measured values; gzip (4.83 MB) and ts.worker (13.36 MB) stay
// under their prior budgets.
export const DEFAULT_SIZE_BUDGETS = Object.freeze({
  maxTotalBytes: 29_000_000,
  maxTotalGzipBytes: 5_000_000,
  maxFileBytes: Object.freeze({
    'lib/monaco-esm/editor.js': 10_000_000,
    'lib/monaco-esm/workers/ts.worker.js': 13_500_000,
  }),
});

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

function addFailure(failures, path, message) {
  failures.push({ path: normalizePath(path), message });
}

function outputInfo(projectRoot, path, failures) {
  const absolute = join(projectRoot, path);
  if (!existsSync(absolute)) {
    addFailure(failures, path, 'required Monaco ESM prototype output is missing');
    return { path: normalizePath(path), bytes: 0, gzipBytes: 0 };
  }
  const stat = statSync(absolute);
  if (!stat.isFile()) {
    addFailure(failures, path, 'required Monaco ESM prototype output is not a file');
    return { path: normalizePath(path), bytes: 0, gzipBytes: 0 };
  }
  if (stat.size <= 0) {
    addFailure(failures, path, 'required Monaco ESM prototype output is empty');
  }
  const bytes = readFileSync(absolute);
  return {
    path: normalizePath(path),
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length,
  };
}

function listAssets(projectRoot, failures) {
  const assetDir = join(projectRoot, 'lib/monaco-esm/assets');
  if (!existsSync(assetDir)) {
    addFailure(failures, 'lib/monaco-esm/assets', 'Monaco ESM prototype font asset directory is missing');
    return [];
  }
  const assets = readdirSync(assetDir)
    .filter((name) => name.endsWith('.ttf'))
    .map((name) => `lib/monaco-esm/assets/${name}`)
    .sort();
  if (assets.length === 0) {
    addFailure(failures, 'lib/monaco-esm/assets', 'Monaco ESM prototype did not emit a codicon font asset');
  }
  return assets;
}

function scanOutputText(projectRoot, path, failures) {
  const absolute = join(projectRoot, path);
  if (!existsSync(absolute)) return;
  const text = readFileSync(absolute, 'utf8');
  const remoteLoaderPatterns = [
    /\bimport\s*\(\s*["'`]https?:\/\//i,
    /\bimportScripts\s*\(\s*["'`]https?:\/\//i,
    /\bnew\s+(?:Shared)?Worker\s*\(\s*["'`]https?:\/\//i,
    /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i,
  ];
  if (remoteLoaderPatterns.some((pattern) => pattern.test(text))) {
    addFailure(failures, path, 'Monaco ESM prototype output references a remote executable asset');
  }
  if (/\bnew\s+(?:Shared)?Worker\s*\(\s*["'`](?:blob|data):/i.test(text) || /URL\.createObjectURL\s*\(\s*new\s+Blob/i.test(text)) {
    addFailure(failures, path, 'Monaco ESM prototype output must use file-backed workers');
  }
}

function checkSizeBudgets(outputs, budgets, failures) {
  const totalBytes = outputs.reduce((sum, output) => sum + output.bytes, 0);
  const totalGzipBytes = outputs.reduce((sum, output) => sum + output.gzipBytes, 0);

  if (totalBytes > budgets.maxTotalBytes) {
    addFailure(
      failures,
      'lib/monaco-esm',
      `Monaco ESM prototype exceeds total uncompressed budget (${totalBytes} > ${budgets.maxTotalBytes})`,
    );
  }
  if (totalGzipBytes > budgets.maxTotalGzipBytes) {
    addFailure(
      failures,
      'lib/monaco-esm',
      `Monaco ESM prototype exceeds total gzip budget (${totalGzipBytes} > ${budgets.maxTotalGzipBytes})`,
    );
  }

  for (const [path, maxBytes] of Object.entries(budgets.maxFileBytes || {})) {
    const output = outputs.find((item) => item.path === normalizePath(path));
    if (output && output.bytes > maxBytes) {
      addFailure(failures, path, `Monaco ESM output exceeds file budget (${output.bytes} > ${maxBytes})`);
    }
  }

  return { totalBytes, totalGzipBytes };
}

export function runMonacoEsmPrototypeCheck(options = {}) {
  const projectRoot = resolve(options.projectRoot || defaultProjectRoot);
  const sizeBudgets = options.sizeBudgets || DEFAULT_SIZE_BUDGETS;
  const failures = [];
  const outputs = [];

  for (const path of REQUIRED_OUTPUTS) {
    outputs.push(outputInfo(projectRoot, path, failures));
    scanOutputText(projectRoot, path, failures);
  }

  for (const path of listAssets(projectRoot, failures)) {
    outputs.push(outputInfo(projectRoot, path, failures));
  }

  const sortedOutputs = outputs.sort((a, b) => a.path.localeCompare(b.path));
  const totals = checkSizeBudgets(sortedOutputs, sizeBudgets, failures);

  return {
    generatedAt: new Date().toISOString(),
    root: normalizePath(relative(projectRoot, join(projectRoot, 'lib/monaco-esm')) || 'lib/monaco-esm'),
    sizeBudgets,
    totals,
    outputs: sortedOutputs,
    failures,
  };
}

function argValue(args, name) {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  if (index !== -1) return args[index + 1] || '';
  return '';
}

function main() {
  const args = process.argv.slice(2);
  const outPath = argValue(args, '--write') || '';
  const result = runMonacoEsmPrototypeCheck();

  if (outPath) {
    writeFileSync(resolve(defaultProjectRoot, outPath), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }

  if (result.failures.length === 0) {
    process.stdout.write(`Monaco ESM prototype check passed for ${result.outputs.length} output file(s).\n`);
    if (outPath) process.stdout.write(`Wrote ${normalizePath(outPath)}.\n`);
    process.exit(0);
  }

  process.stderr.write(`Monaco ESM prototype check failed with ${result.failures.length} issue(s):\n`);
  for (const failure of result.failures) {
    process.stderr.write(`- ${failure.path}: ${failure.message}\n`);
  }
  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Monaco ESM prototype check failed: ${error?.stack || error?.message || String(error)}\n`);
    process.exit(1);
  }
}
