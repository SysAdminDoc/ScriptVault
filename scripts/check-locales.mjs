#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { generateLocales } from './generate-locales.mjs';
import { generateTsRuntimeModules } from './generate-ts-runtime-modules.mjs';

const args = new Set(process.argv.slice(2));
const wantCheck = args.has('--check') || args.has('--strict');
const wantJson = args.has('--json');
const root = process.cwd();

async function readLocaleSources() {
  const sourceRoot = join(root, 'src/locales');
  const files = (await readdir(sourceRoot)).filter(file => file.endsWith('.json')).sort();
  const sources = {};
  for (const file of files) {
    const code = file.slice(0, -'.json'.length);
    sources[code] = JSON.parse(await readFile(join(sourceRoot, file), 'utf8'));
  }
  return sources;
}

async function readManifestLocales() {
  const localeRoot = join(root, '_locales');
  const entries = (await readdir(localeRoot)).sort();
  const catalogs = {};
  for (const code of entries) {
    const path = join(localeRoot, code);
    if (!(await stat(path)).isDirectory()) continue;
    catalogs[code] = JSON.parse(await readFile(join(path, 'messages.json'), 'utf8'));
  }
  return catalogs;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function setDifference(left, right) {
  return [...left].filter(value => !right.has(value));
}

const report = {
  sources: {},
  coverage: [],
  drifts: [],
  warnings: [],
};

let localeSources = {};
let manifestLocales = {};
try {
  localeSources = await readLocaleSources();
} catch (error) {
  report.drifts.push({
    kind: 'locale-source-error',
    error: error instanceof Error ? error.message : String(error),
  });
}
try {
  manifestLocales = await readManifestLocales();
} catch (error) {
  report.drifts.push({
    kind: 'manifest-locale-error',
    error: error instanceof Error ? error.message : String(error),
  });
}

const sourceCodes = Object.keys(localeSources).sort();
const manifestCodes = Object.keys(manifestLocales).sort();
report.sources.localeSources = sourceCodes;
report.sources.localesDir = manifestCodes;
// Kept for report consumers that previously tracked the inline dictionaries.
// Runtime locales now come directly from the typed generated source catalog.
report.sources.runtimeI18n = sourceCodes;
report.sources.generatedRuntime = 'src/generated/locale-catalogs.ts';

const sourceSet = new Set(sourceCodes);
const manifestSet = new Set(manifestCodes);
for (const code of setDifference(sourceSet, manifestSet)) {
  report.drifts.push({ kind: 'cross-source-locale-mismatch', locale: code, missingFrom: ['_locales'] });
}
for (const code of setDifference(manifestSet, sourceSet)) {
  report.drifts.push({ kind: 'cross-source-locale-mismatch', locale: code, missingFrom: ['src/locales'] });
}

for (const code of sourceCodes) {
  if (manifestLocales[code] && !sameJson(localeSources[code].manifest, manifestLocales[code])) {
    report.drifts.push({ kind: 'manifest-generated-drift', locale: code });
  }
}

try {
  await generateLocales({ rootDir: root, check: true });
} catch (error) {
  report.drifts.push({
    kind: 'generated-artifact-drift',
    error: error instanceof Error ? error.message : String(error),
  });
}

try {
  const runtimeResults = await generateTsRuntimeModules({ rootDir: root, check: true, modules: ['i18n'] });
  if (runtimeResults.some(result => result.changed)) {
    report.drifts.push({ kind: 'runtime-generated-drift', file: 'modules/i18n.js' });
  }
} catch (error) {
  report.drifts.push({
    kind: 'runtime-generated-drift',
    file: 'modules/i18n.js',
    error: error instanceof Error ? error.message : String(error),
  });
}

const english = localeSources.en;
if (!english) {
  report.drifts.push({ kind: 'locale-source-error', locale: 'en', error: 'src/locales/en.json is required' });
} else {
  const total = Object.keys(english.runtime).length;
  for (const code of sourceCodes) {
    const source = localeSources[code];
    const translated = code === 'en' ? total : Object.keys(source.runtime || {}).length;
    const baseline = source.runtimeCoverageBaseline;
    const status = source.translationStatus;
    const coverage = {
      locale: code,
      status,
      direction: source.direction,
      translated,
      total,
      baseline,
      percent: Number(((translated / total) * 100).toFixed(1)),
    };
    report.coverage.push(coverage);
    if (!Number.isInteger(baseline) || translated < baseline) {
      report.drifts.push({ kind: 'runtime-coverage-regression', locale: code, translated, baseline });
    }
    if (code !== 'en' && status !== 'partial' && translated < total) {
      report.drifts.push({ kind: 'runtime-status-mismatch', locale: code, status, translated, total });
    }
    if (status === 'partial') {
      report.warnings.push({ kind: 'runtime-partial', ...coverage });
    }
  }
}

if (wantJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('ScriptVault — locale coverage report');
  console.log(`  sources         ${sourceCodes.join(', ') || '(unavailable)'}`);
  console.log(`  generated MV3   ${manifestCodes.join(', ') || '(unavailable)'}`);
  console.log(`  generated typed ${report.sources.generatedRuntime}`);
  console.log('');
  if (report.drifts.length) {
    console.log(`  ${report.drifts.length} drift entr${report.drifts.length === 1 ? 'y' : 'ies'}:`);
    for (const drift of report.drifts) {
      console.log(`    [${drift.kind}] ${drift.locale ? `${drift.locale}: ` : ''}${drift.error || JSON.stringify(drift)}`);
    }
  } else {
    console.log('  Generated catalogs are current and no coverage regressed.');
  }
  console.log('');
  console.log('  Runtime coverage:');
  for (const coverage of report.coverage) {
    const label = coverage.status === 'partial' ? 'partial' : 'complete';
    console.log(`    ${coverage.locale.padEnd(3)} ${String(coverage.translated).padStart(4)}/${coverage.total} ` +
      `(${String(coverage.percent).padStart(4)}%) ${label}; baseline ${coverage.baseline}`);
  }
}

if (wantCheck && report.drifts.length) {
  if (!wantJson) console.error(`\n[check-locales] ${report.drifts.length} locale drift entr${report.drifts.length === 1 ? 'y' : 'ies'} — failing build.`);
  process.exitCode = 1;
}
