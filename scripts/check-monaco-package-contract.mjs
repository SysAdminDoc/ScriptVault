#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(scriptDir, '..');

const REQUIRED_FILES = [
  'package.json',
  'esbuild.config.mjs',
  'build.sh',
  'build-firefox.sh',
  'pages/editor-sandbox.html',
  'docs/monaco-esm-migration-plan.md',
];

const REMOTE_MONACO_PATTERNS = [
  /\bhttps?:\/\/[^\s"'`<>]*monaco[^\s"'`<>]*/i,
  /\bhttps?:\/\/[^\s"'`<>]*(?:cdnjs|jsdelivr|unpkg|esm\.sh|skypack)[^\s"'`<>]*/i,
];

function normalizeLineEndings(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}

function hasNeedle(text, needle) {
  return normalizeLineEndings(text).includes(needle);
}

function addFailure(failures, path, message, excerpt = '') {
  failures.push({ path, message, excerpt });
}

function fileText(files, path, failures) {
  const text = files[path];
  if (typeof text === 'string') return text;
  addFailure(failures, path, 'required Monaco package contract input is missing');
  return '';
}

function checkPackageJson(files, failures) {
  const path = 'package.json';
  const text = fileText(files, path, failures);
  if (!text) return;

  let packageJson;
  try {
    packageJson = JSON.parse(text);
  } catch (error) {
    addFailure(failures, path, `package.json could not be parsed: ${error.message}`);
    return;
  }

  if (packageJson.scripts?.['monaco:package:check'] !== 'node scripts/check-monaco-package-contract.mjs') {
    addFailure(
      failures,
      path,
      'package.json must expose npm run monaco:package:check',
      '"monaco:package:check": "node scripts/check-monaco-package-contract.mjs"',
    );
  }

  if (!packageJson.scripts?.['build:monaco']?.includes('--monaco-esm-only')) {
    addFailure(
      failures,
      path,
      'package.json build:monaco must build the Monaco ESM bundle',
      '"build:monaco": "node esbuild.config.mjs --monaco-esm-only"',
    );
  }

  if (packageJson.scripts?.['monaco:esm:check'] !== 'node scripts/check-monaco-esm-prototype.mjs') {
    addFailure(
      failures,
      path,
      'package.json must expose npm run monaco:esm:check for post-build ESM evidence',
      '"monaco:esm:check": "node scripts/check-monaco-esm-prototype.mjs"',
    );
  }

  const checkScript = packageJson.scripts?.check || '';
  if (!checkScript.includes('npm run monaco:package:check')) {
    addFailure(failures, path, 'npm run check must include npm run monaco:package:check');
  }
}

function checkEsbuild(files, failures) {
  const path = 'esbuild.config.mjs';
  const text = fileText(files, path, failures);
  if (!text) return;

  for (const needle of [
    'async function buildMonacoEsm()',
    '"lib", "monaco-esm"',
    '"src", "editor", "monaco-esm-entry.ts"',
    'outfile: join(monacoEsmOutDir, "editor.js")',
    'await buildMonacoEsm();',
  ]) {
    if (!hasNeedle(text, needle)) {
      addFailure(failures, path, 'Chromium build must keep the local Monaco ESM bundle wiring', needle);
    }
  }

  for (const forbidden of [
    'function copyMonaco()',
    '"node_modules", "monaco-editor", "min"',
    'cpSync(src, dest, { recursive: true, force: true });',
  ]) {
    if (hasNeedle(text, forbidden)) {
      addFailure(failures, path, 'Chromium build must not copy the deprecated Monaco AMD bundle after the ESM switch', forbidden);
    }
  }
}

function checkSandbox(files, failures) {
  const path = 'pages/editor-sandbox.html';
  const text = fileText(files, path, failures);
  if (!text) return;

  for (const needle of [
    "const LOCAL_ESM_ENTRY = '../lib/monaco-esm/editor.js';",
    "const LOCAL_ESM_CSS = '../lib/monaco-esm/editor.css';",
    'await import(LOCAL_ESM_ENTRY)',
    'loadStylesheet(LOCAL_ESM_CSS)',
    "parent.postMessage({ type: 'monaco-load-error', reason: 'missing-bundle' }, '*')",
  ]) {
    if (!hasNeedle(text, needle)) {
      addFailure(failures, path, 'sandbox must load the packaged local Monaco ESM bundle', needle);
    }
  }

  for (const pattern of REMOTE_MONACO_PATTERNS) {
    if (pattern.test(text)) {
      addFailure(failures, path, 'sandbox must not reference remote Monaco/CDN editor assets', String(pattern));
    }
  }

  for (const forbidden of ['vs/loader.js', 'require.config', "require(['vs/editor/editor.main']", 'LOCAL_VS_PATH']) {
    if (hasNeedle(text, forbidden)) {
      addFailure(failures, path, 'sandbox must not reference the deprecated Monaco AMD loader after the ESM switch', forbidden);
    }
  }
}

function checkChromeBuild(files, failures) {
  const path = 'build.sh';
  const text = fileText(files, path, failures);
  if (!text) return;

  if (/^\s*lib\s*$/m.test(text)) {
    addFailure(failures, path, 'CWS build must not copy the entire lib/ directory (ships dead Monaco AMD bundle); list lib subdirectories explicitly');
  }
  if (hasNeedle(text, 'lib/monaco/') || hasNeedle(text, "lib/monaco\n")) {
    addFailure(failures, path, 'CWS build must not package the deprecated Monaco AMD bundle (lib/monaco/)');
  }
  if (!hasNeedle(text, 'lib/monaco-esm')) {
    addFailure(failures, path, 'CWS build must package lib/monaco-esm');
  }
}

function checkFirefoxBuild(files, failures) {
  const path = 'build-firefox.sh';
  const text = fileText(files, path, failures);
  if (!text) return;

  for (const needle of [
    'node "$SCRIPT_DIR/esbuild.config.mjs" --bg-only',
    'lib/acorn.min.js',
    'lib/diff.min.js',
    'pages',
  ]) {
    if (!hasNeedle(text, needle)) {
      addFailure(failures, path, 'Firefox build must keep the textarea-first packaging contract', needle);
    }
  }

  for (const forbidden of ['lib/monaco', 'lib/monaco-esm']) {
    if (hasNeedle(text, forbidden)) {
      addFailure(failures, path, 'Firefox build must not package Monaco until AMO lint proof exists', forbidden);
    }
  }
}

function checkPlan(files, failures) {
  const path = 'docs/monaco-esm-migration-plan.md';
  const text = fileText(files, path, failures);
  if (!text) return;

  for (const needle of [
    'ScriptVault now loads Monaco from the packaged ESM bundle',
    'Do not load Monaco from a CDN',
    'Firefox remains textarea-first',
    'npm run monaco:package:check',
    'npm run build:monaco',
    'npm run monaco:esm:check',
    'docs/audit/monaco-esm-prototype-2026-06-06.json',
    'maxTotalBytes: 28000000',
    'maxTotalGzipBytes: 5000000',
    'lib/monaco-esm/editor.js',
    'lib/monaco-esm/workers/ts.worker.js',
  ]) {
    if (!hasNeedle(text, needle)) {
      addFailure(failures, path, 'Monaco migration plan must document the current packaging guard and future ESM target', needle);
    }
  }
}

export function checkMonacoPackageContract(files) {
  const failures = [];
  checkPackageJson(files, failures);
  checkEsbuild(files, failures);
  checkSandbox(files, failures);
  checkChromeBuild(files, failures);
  checkFirefoxBuild(files, failures);
  checkPlan(files, failures);
  return { checkedFiles: REQUIRED_FILES.length, failures };
}

export function runMonacoPackageContractCheck(options = {}) {
  const projectRoot = resolve(options.projectRoot || defaultProjectRoot);
  const files = {};
  for (const path of REQUIRED_FILES) {
    const absolute = join(projectRoot, path);
    if (existsSync(absolute)) {
      files[path] = readFileSync(absolute, 'utf8');
    }
  }
  return checkMonacoPackageContract(files);
}

function main() {
  const result = runMonacoPackageContractCheck();
  if (result.failures.length === 0) {
    process.stdout.write(`Monaco package contract check passed for ${result.checkedFiles} file(s).\n`);
    process.exit(0);
  }

  process.stderr.write(`Monaco package contract check failed with ${result.failures.length} issue(s):\n`);
  for (const failure of result.failures) {
    process.stderr.write(`- ${failure.path}: ${failure.message}\n`);
    if (failure.excerpt) process.stderr.write(`  ${failure.excerpt}\n`);
  }
  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Monaco package contract check failed: ${error?.stack || error?.message || String(error)}\n`);
    process.exit(1);
  }
}
