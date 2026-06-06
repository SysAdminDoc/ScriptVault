#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs', '.ts']);

const DEFAULT_SOURCE_PATHS = [
  'manifest.json',
  'manifest-firefox.json',
  'background.js',
  'background.core.js',
  'content.js',
  'offscreen.html',
  'offscreen.js',
  'bg',
  'modules',
  'pages',
  'shared',
  'src',
  '_locales',
];

const STATIC_SPECIFIER_PATTERNS = [
  /\bimport\s+(?:[^"'()]+?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[^"'()]+?\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\.resolve\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isTextPath(path) {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

function packageNameFromNodeModulesPath(packagePath) {
  const normalized = normalizePath(packagePath);
  const marker = 'node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return null;

  const rest = normalized.slice(index + marker.length);
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0].startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0];
}

function packageNameFromSpecifier(specifier) {
  if (
    !specifier ||
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('node:') ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(specifier)
  ) {
    return null;
  }

  const parts = specifier.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0].startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0];
}

export function collectOptionalDependencyNames(lockfile) {
  const packages = lockfile?.packages || {};
  const optionalPackages = new Set();
  const peerOptionalEdges = new Set();
  const optionalDependencyEdges = new Set();

  for (const [packagePath, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== 'object') continue;

    const packageName = packageNameFromNodeModulesPath(packagePath);
    if (entry.optional === true && packageName) {
      optionalPackages.add(packageName);
    }

    for (const dependencyName of Object.keys(entry.optionalDependencies || {})) {
      optionalDependencyEdges.add(dependencyName);
    }

    for (const [peerName, peerMeta] of Object.entries(entry.peerDependenciesMeta || {})) {
      if (peerMeta?.optional === true) {
        peerOptionalEdges.add(peerName);
      }
    }
  }

  return {
    optionalPackages: [...optionalPackages].sort(),
    optionalDependencyEdges: [...optionalDependencyEdges].sort(),
    peerOptionalEdges: [...peerOptionalEdges].sort(),
    names: [...new Set([
      ...optionalPackages,
      ...optionalDependencyEdges,
      ...peerOptionalEdges,
    ])].sort(),
  };
}

function readDirectoryEntries(rootDir, baseDir = rootDir) {
  const entries = [];
  for (const item of readdirSync(rootDir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '.git') continue;
    const absolute = join(rootDir, item.name);
    if (item.isDirectory()) {
      entries.push(...readDirectoryEntries(absolute, baseDir));
      continue;
    }
    if (!item.isFile()) continue;
    const relativePath = normalizePath(relative(baseDir, absolute));
    if (!isTextPath(relativePath)) continue;
    entries.push({ path: relativePath, text: readFileSync(absolute, 'utf8') });
  }
  return entries;
}

export function loadDefaultSourceEntries(rootDir = process.cwd(), sourcePaths = DEFAULT_SOURCE_PATHS) {
  const entries = [];
  for (const sourcePath of sourcePaths) {
    const absolute = join(rootDir, sourcePath);
    if (!existsSync(absolute)) continue;
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      entries.push(...readDirectoryEntries(absolute, rootDir));
    } else if (stat.isFile() && isTextPath(sourcePath)) {
      entries.push({ path: normalizePath(sourcePath), text: readFileSync(absolute, 'utf8') });
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

export function scanEntriesForOptionalDependencyImports(entries, optionalNames) {
  const optionalSet = new Set(optionalNames);
  const findings = [];

  for (const entry of entries) {
    const text = entry.text || '';
    for (const pattern of STATIC_SPECIFIER_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const specifier = match[1];
        const packageName = packageNameFromSpecifier(specifier);
        if (!packageName || !optionalSet.has(packageName)) continue;
        findings.push({
          path: normalizePath(entry.path),
          line: lineNumberForIndex(text, match.index || 0),
          specifier,
          packageName,
        });
      }
    }
  }

  return findings.sort((a, b) => `${a.path}:${a.line}`.localeCompare(`${b.path}:${b.line}`));
}

export function analyzeOptionalDependencyReach({
  rootDir = process.cwd(),
  sourcePaths = DEFAULT_SOURCE_PATHS,
} = {}) {
  const lockfilePath = resolve(rootDir, 'package-lock.json');
  const errors = [];

  if (!existsSync(lockfilePath)) {
    return {
      ok: false,
      errors: [`package-lock.json not found at ${lockfilePath}`],
      optional: { optionalPackages: [], optionalDependencyEdges: [], peerOptionalEdges: [], names: [] },
      scannedCount: 0,
      findings: [],
    };
  }

  const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
  const optional = collectOptionalDependencyNames(lockfile);
  const entries = loadDefaultSourceEntries(rootDir, sourcePaths);
  const findings = scanEntriesForOptionalDependencyImports(entries, optional.names);

  for (const finding of findings) {
    errors.push(`${finding.path}:${finding.line} imports optional dependency "${finding.packageName}" via "${finding.specifier}"`);
  }

  return {
    ok: errors.length === 0,
    errors,
    optional,
    scannedCount: entries.length,
    findings,
  };
}

export function formatOptionalDependencyReachReport(report) {
  const summary = `${report.optional.names.length} optional/peer-optional package name(s), ${report.scannedCount} shipped source file(s) scanned`;
  if (report.ok) {
    return `[optional-deps] OK: ${summary}; no static import/require reachability found.`;
  }

  return [
    `[optional-deps] Optional dependency reach check failed: ${summary}.`,
    ...report.errors.map((error) => `- ${error}`),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = analyzeOptionalDependencyReach();
  console.log(formatOptionalDependencyReachReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
