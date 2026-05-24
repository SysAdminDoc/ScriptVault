#!/usr/bin/env node
// Promotion-aware gate for the JS runtime -> TypeScript authoritative-source
// migration. It intentionally checks changed-path contracts first; semantic
// generated-artifact comparison lands with each promoted module.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_MAP = 'ts-source-promotion.json';
const VALID_STATUSES = new Set([
  'mirrored',
  'candidate',
  'promoted',
  'intentionally-divergent',
]);

function normalizeRepoPath(value, rootDir = DEFAULT_ROOT) {
  if (typeof value !== 'string' || value.trim() === '') return '';
  let path = value.trim();
  if (isAbsolute(path)) {
    path = relative(rootDir, path);
  }
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function arrayFrom(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [value];
  return [];
}

export function normalizePromotionMap(rawMap, options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const entries = Array.isArray(rawMap?.entries) ? rawMap.entries : [];
  const errors = [];
  const seenRuntimePaths = new Set();

  if (rawMap?.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.');
  }
  if (!Array.isArray(rawMap?.entries)) {
    errors.push('entries must be an array.');
  }

  const normalizedEntries = entries.map((entry, index) => {
    const runtime = normalizeRepoPath(entry?.runtime, rootDir);
    const sources = arrayFrom(entry?.sources ?? entry?.source).map((source) => normalizeRepoPath(source, rootDir));
    const generatedArtifacts = arrayFrom(entry?.generatedArtifacts).map((artifact) => normalizeRepoPath(artifact, rootDir));
    const status = entry?.status || '';

    if (!runtime) errors.push(`entries[${index}].runtime is required.`);
    if (runtime && seenRuntimePaths.has(runtime)) {
      errors.push(`Duplicate runtime mapping: ${runtime}.`);
    }
    seenRuntimePaths.add(runtime);

    if (!VALID_STATUSES.has(status)) {
      errors.push(`entries[${index}].status must be one of: ${[...VALID_STATUSES].join(', ')}.`);
    }
    if (sources.length === 0) {
      errors.push(`entries[${index}].sources must contain at least one TypeScript source path.`);
    }

    for (const path of [runtime, ...sources]) {
      if (!path) continue;
      const abs = join(rootDir, path);
      if (!existsSync(abs)) errors.push(`Mapped path does not exist: ${path}.`);
    }

    return {
      runtime,
      sources,
      generatedArtifacts,
      status,
      notes: entry?.notes || '',
    };
  });

  return {
    schemaVersion: rawMap?.schemaVersion,
    description: rawMap?.description || '',
    entries: normalizedEntries,
    errors,
  };
}

export async function loadPromotionMap(mapPath = join(DEFAULT_ROOT, DEFAULT_MAP), options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const text = await readFile(mapPath, 'utf8');
  const rawMap = JSON.parse(text);
  return normalizePromotionMap(rawMap, { rootDir });
}

function groupEntriesByStatus(entries) {
  const grouped = {};
  for (const status of VALID_STATUSES) grouped[status] = [];
  for (const entry of entries) {
    if (!grouped[entry.status]) grouped[entry.status] = [];
    grouped[entry.status].push(entry);
  }
  for (const status of Object.keys(grouped)) {
    grouped[status].sort((a, b) => a.runtime.localeCompare(b.runtime));
  }
  return grouped;
}

function getPreviousEntryByRuntime(previousMap) {
  const entries = previousMap?.entries || [];
  return new Map(entries.map((entry) => [entry.runtime, entry]));
}

export function analyzeSourceDrift(map, changedFiles = [], options = {}) {
  const changed = new Set(changedFiles.map((path) => normalizeRepoPath(path)).filter(Boolean));
  const groupedByStatus = groupEntriesByStatus(map.entries || []);
  const previousByRuntime = getPreviousEntryByRuntime(options.previousMap);
  const violations = [];
  const touched = [];

  for (const entry of map.entries || []) {
    const runtimeTouched = changed.has(entry.runtime);
    const sourceTouched = entry.sources.some((source) => changed.has(source));
    const generatedTouched = entry.generatedArtifacts.some((artifact) => changed.has(artifact));
    const previousEntry = previousByRuntime.get(entry.runtime);
    const newlyPromoted =
      entry.status === 'promoted' &&
      previousEntry &&
      previousEntry.status !== 'promoted' &&
      changed.has(DEFAULT_MAP);
    if (runtimeTouched || sourceTouched || generatedTouched) {
      touched.push({
        runtime: entry.runtime,
        status: entry.status,
        runtimeTouched,
        sourceTouched,
        generatedTouched,
        newlyPromoted,
      });
    }
    if (entry.status === 'promoted' && runtimeTouched && !sourceTouched && !generatedTouched && !newlyPromoted) {
      violations.push({
        runtime: entry.runtime,
        sources: entry.sources,
        generatedArtifacts: entry.generatedArtifacts,
        message: `${entry.runtime} is TS-promoted but changed without its TS source or generated artifact.`,
      });
    }
  }

  return {
    ok: violations.length === 0 && (map.errors || []).length === 0,
    changedFiles: [...changed].sort(),
    groupedByStatus,
    totals: Object.fromEntries(Object.entries(groupedByStatus).map(([status, entries]) => [status, entries.length])),
    touched,
    violations,
    mapErrors: map.errors || [],
  };
}

function runGit(args, rootDir) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function tryRunGit(args, rootDir) {
  try {
    return runGit(args, rootDir);
  } catch {
    return '';
  }
}

function inferGitBase(rootDir) {
  const explicitBase = process.env.TS_SOURCE_DRIFT_BASE;
  if (explicitBase) return explicitBase;

  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    const mergeBase = tryRunGit(['merge-base', 'HEAD', `origin/${baseRef}`], rootDir);
    if (mergeBase) return mergeBase;
  }

  const previousHead = process.env.GITHUB_EVENT_BEFORE;
  if (previousHead && !/^0+$/.test(previousHead)) {
    return previousHead;
  }

  const parent = tryRunGit(['rev-parse', '--verify', 'HEAD~1'], rootDir);
  if (parent) return parent;

  return 'HEAD';
}

export function getChangedFilesFromGit(options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const base = options.base || inferGitBase(rootDir);
  const head = options.head || 'HEAD';
  if (base === head) return [];
  const output = runGit(['diff', '--name-only', '--diff-filter=ACMRT', base, head], rootDir);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function loadPreviousPromotionMap(options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const base = options.base || inferGitBase(rootDir);
  const mapPath = options.mapPath || join(rootDir, DEFAULT_MAP);
  const repoMapPath = normalizeRepoPath(mapPath, rootDir);
  if (!base || base === 'HEAD') return null;

  try {
    const text = runGit(['show', `${base}:${repoMapPath}`], rootDir);
    return normalizePromotionMap(JSON.parse(text), { rootDir });
  } catch {
    return null;
  }
}

function formatEntryList(entries) {
  if (!entries.length) return 'none';
  return entries.map((entry) => `${entry.runtime} -> ${entry.sources.join(', ')}`).join('\n    ');
}

export function formatTextReport(report, options = {}) {
  const lines = [
    'ScriptVault TS source drift gate',
    `  changed files: ${report.changedFiles.length}`,
    `  promoted: ${report.totals.promoted || 0}`,
    `  candidate: ${report.totals.candidate || 0}`,
    `  mirrored: ${report.totals.mirrored || 0}`,
    `  intentionally-divergent: ${report.totals['intentionally-divergent'] || 0}`,
  ];

  if (options.reportMode) {
    lines.push('');
    for (const status of ['promoted', 'candidate', 'mirrored', 'intentionally-divergent']) {
      lines.push(`  ${status}:`);
      lines.push(`    ${formatEntryList(report.groupedByStatus[status] || [])}`);
    }
  }

  if (report.mapErrors.length) {
    lines.push('');
    lines.push(`  ${report.mapErrors.length} map error${report.mapErrors.length === 1 ? '' : 's'}:`);
    for (const error of report.mapErrors) lines.push(`    - ${error}`);
  }

  if (report.violations.length) {
    lines.push('');
    lines.push(`  ${report.violations.length} promoted JS-only drift violation${report.violations.length === 1 ? '' : 's'}:`);
    for (const violation of report.violations) {
      lines.push(`    - ${violation.runtime}`);
      lines.push(`      expected source: ${violation.sources.join(', ')}`);
      if (violation.generatedArtifacts.length) {
        lines.push(`      allowed generated artifacts: ${violation.generatedArtifacts.join(', ')}`);
      }
    }
  } else if (!report.mapErrors.length) {
    lines.push('');
    lines.push('  No promoted JS-only drift detected.');
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    rootDir: DEFAULT_ROOT,
    mapPath: null,
    base: null,
    head: 'HEAD',
    changedFiles: [],
    changedFileList: null,
    reportMode: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--root':
        options.rootDir = resolve(argv[++i]);
        break;
      case '--map':
        options.mapPath = resolve(argv[++i]);
        break;
      case '--base':
        options.base = argv[++i];
        break;
      case '--head':
        options.head = argv[++i];
        break;
      case '--changed':
        options.changedFiles.push(argv[++i]);
        break;
      case '--changed-file-list':
        options.changedFileList = resolve(argv[++i]);
        break;
      case '--report':
        options.reportMode = true;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.mapPath) options.mapPath = join(options.rootDir, DEFAULT_MAP);
  return options;
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const map = await loadPromotionMap(options.mapPath, { rootDir: options.rootDir });
  let changedFiles = options.changedFiles;

  if (options.changedFileList) {
    const listText = readFileSync(options.changedFileList, 'utf8');
    changedFiles = changedFiles.concat(listText.split(/\r?\n/).filter(Boolean));
  }
  if (changedFiles.length === 0) {
    changedFiles = getChangedFilesFromGit({
      rootDir: options.rootDir,
      base: options.base,
      head: options.head,
    });
  }

  const previousMap = loadPreviousPromotionMap({
    rootDir: options.rootDir,
    base: options.base,
    mapPath: options.mapPath,
  });
  const report = analyzeSourceDrift(map, changedFiles, { previousMap });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatTextReport(report, { reportMode: options.reportMode }));
  }

  if (report.mapErrors.length) return 2;
  if (!options.reportMode && report.violations.length) return 1;
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    console.error(`[check-ts-source-drift] ${err.message}`);
    process.exitCode = 2;
  });
}
