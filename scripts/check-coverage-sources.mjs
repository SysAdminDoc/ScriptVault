#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE_ROOTS = [
  'src/background',
  'src/bg',
  'src/modules',
  'src/shared',
  'src/storage',
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function toRelativePath(filePath, rootDir) {
  const normalized = normalizePath(filePath);
  const normalizedRoot = normalizePath(rootDir);

  if (normalized.startsWith(`${normalizedRoot}/`)) {
    return normalized.slice(normalizedRoot.length + 1);
  }

  return normalizePath(relative(rootDir, resolve(rootDir, filePath)));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function walkTypeScriptFiles(dir, rootDir, out = []) {
  if (!existsSync(dir)) {
    return out;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walkTypeScriptFiles(fullPath, rootDir, out);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(toRelativePath(fullPath, rootDir));
    }
  }

  return out;
}

function collectAuthoritativeSources(rootDir, sourceRoots = DEFAULT_SOURCE_ROOTS) {
  const files = new Set();

  for (const sourceRoot of sourceRoots) {
    const fullRoot = resolve(rootDir, sourceRoot);
    for (const file of walkTypeScriptFiles(fullRoot, rootDir)) {
      files.add(file);
    }
  }

  return [...files].sort();
}

function collectPromotedSources(promotionMapPath, rootDir) {
  const promotionMap = readJson(promotionMapPath);
  const files = new Set();

  for (const entry of promotionMap.entries || []) {
    if (entry.status !== 'promoted') {
      continue;
    }

    for (const source of entry.sources || []) {
      const relativeSource = toRelativePath(source, rootDir);
      if (
        DEFAULT_SOURCE_ROOTS.some((sourceRoot) => relativeSource.startsWith(`${sourceRoot}/`)) &&
        relativeSource.endsWith('.ts')
      ) {
        files.add(relativeSource);
      }
    }
  }

  return [...files].sort();
}

function collectCoverageFiles(summary, rootDir) {
  return new Set(Object.keys(summary)
    .filter((filePath) => filePath !== 'total')
    .map((filePath) => toRelativePath(filePath, rootDir)));
}

export function analyzeCoverageSources({
  rootDir = process.cwd(),
  coverageSummaryPath = resolve(rootDir, 'coverage/coverage-summary.json'),
  promotionMapPath = resolve(rootDir, 'ts-source-promotion.json'),
  sourceRoots = DEFAULT_SOURCE_ROOTS,
} = {}) {
  const errors = [];

  if (!existsSync(coverageSummaryPath) || !statSync(coverageSummaryPath).isFile()) {
    return {
      ok: false,
      errors: [`Missing coverage summary: ${toRelativePath(coverageSummaryPath, rootDir)}`],
      missingAuthoritativeSources: [],
      missingPromotedSources: [],
    };
  }

  const summary = readJson(coverageSummaryPath);
  const coveredFiles = collectCoverageFiles(summary, rootDir);
  const authoritativeSources = collectAuthoritativeSources(rootDir, sourceRoots);
  const promotedSources = collectPromotedSources(promotionMapPath, rootDir);

  const missingAuthoritativeSources = authoritativeSources
    .filter((source) => !coveredFiles.has(source));
  const missingPromotedSources = promotedSources
    .filter((source) => !coveredFiles.has(source));

  if (missingAuthoritativeSources.length > 0) {
    errors.push(`Coverage summary omits ${missingAuthoritativeSources.length} authoritative source file(s).`);
  }
  if (missingPromotedSources.length > 0) {
    errors.push(`Coverage summary omits ${missingPromotedSources.length} promoted source file(s).`);
  }

  return {
    ok: errors.length === 0,
    errors,
    sourceRoots,
    coveredFileCount: coveredFiles.size,
    authoritativeSourceCount: authoritativeSources.length,
    promotedSourceCount: promotedSources.length,
    missingAuthoritativeSources,
    missingPromotedSources,
  };
}

export function formatCoverageSourceReport(report) {
  const lines = [];

  if (report.ok) {
    lines.push(`[coverage-sources] OK: ${report.coveredFileCount} files in coverage summary; ${report.authoritativeSourceCount} authoritative source files and ${report.promotedSourceCount} promoted source files accounted for.`);
    return lines.join('\n');
  }

  lines.push('[coverage-sources] Coverage source gate failed.');
  for (const error of report.errors || []) {
    lines.push(`- ${error}`);
  }

  if (report.missingAuthoritativeSources?.length) {
    lines.push('\nMissing authoritative source files:');
    for (const source of report.missingAuthoritativeSources) {
      lines.push(`- ${source}`);
    }
  }

  if (report.missingPromotedSources?.length) {
    lines.push('\nMissing promoted source files:');
    for (const source of report.missingPromotedSources) {
      lines.push(`- ${source}`);
    }
  }

  return lines.join('\n');
}

function parseArgs(argv) {
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      options.rootDir = resolve(argv[++i]);
    } else if (arg === '--summary') {
      options.coverageSummaryPath = resolve(argv[++i]);
    } else if (arg === '--map') {
      options.promotionMapPath = resolve(argv[++i]);
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const report = analyzeCoverageSources(options);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatCoverageSourceReport(report));
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}
