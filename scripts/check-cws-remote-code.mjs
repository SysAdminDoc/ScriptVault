#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(scriptDir, '..');

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.ts',
  '.txt',
]);

const DEFAULT_SOURCE_PATHS = [
  'manifest.json',
  'background.js',
  'content.js',
  'offscreen.html',
  'offscreen.js',
  'bg',
  'modules',
  'pages',
  'shared',
  '_locales',
  'src',
];

const SCAN_RULES = [
  {
    id: 'remote-script-tag',
    message: 'remote <script src> tag',
    pattern: /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//gi,
  },
  {
    id: 'remote-worker',
    message: 'remote Worker or SharedWorker script',
    pattern: /\bnew\s+(?:Shared)?Worker\s*\(\s*["'`]https?:\/\//gi,
  },
  {
    id: 'remote-importscripts',
    message: 'remote importScripts() call',
    pattern: /\bimportScripts\s*\(\s*["'`]https?:\/\//gi,
  },
  {
    id: 'remote-dynamic-import',
    message: 'dynamic import() from a remote URL',
    pattern: /\bimport\s*\(\s*["'`]https?:\/\//gi,
  },
  {
    id: 'dom-remote-script-src',
    message: 'DOM-created script element with a remote src',
    pattern: /\bcreateElement\s*\(\s*["'`]script["'`]\s*\)[\s\S]{0,500}\.(?:src|setAttribute\s*\(\s*["'`]src["'`]\s*,)\s*=?\s*["'`]https?:\/\/[^"'`]+\.js\b/gi,
  },
  {
    id: 'fetched-eval',
    message: 'eval/new Function fed by a remote fetch() response',
    pattern: /\b(?:eval|Function|new\s+Function)\s*\([\s\S]{0,320}?\bfetch\s*\(\s*["'`]https?:\/\//gi,
  },
  {
    id: 'fetched-eval-variable',
    message: 'remote fetch() response later evaluated as code',
    pattern: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s*(?:\(\s*await\s*)?fetch\s*\(\s*["'`]https?:\/\/[\s\S]{0,500}?\b(?:eval|Function|new\s+Function)\s*\(\s*\1\s*\)/gi,
  },
];

const DOC_REQUIREMENTS = [
  {
    path: 'docs/cws-remote-code-compliance.md',
    needles: [
      'chrome.userScripts',
      'sandboxed editor page',
      'Remote data, configuration, and resources',
      'User-configured sync',
      'Extension service worker and extension pages do not execute remote logic directly',
      'npm run cws:remote-code:check',
    ],
  },
  {
    path: 'docs/store-listing-copy.md',
    needles: [
      'Remote-hosted code reviewer note',
      'docs/cws-remote-code-compliance.md',
      'npm run cws:remote-code:check',
    ],
  },
  {
    path: 'docs/release-runbook.md',
    needles: [
      'docs/cws-remote-code-compliance.md',
      'npm run cws:remote-code:check',
    ],
  },
];

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeZipName(name) {
  return normalizePath(name);
}

function isTextPath(path) {
  const ext = extname(path).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function excerptForIndex(text, index) {
  return text
    .slice(index, Math.min(text.length, index + 160))
    .replace(/\s+/g, ' ')
    .trim();
}

function isAllowedFinding(entry, ruleId) {
  const path = normalizePath(entry.path);
  if (ruleId === 'remote-script-tag' && path === 'pages/editor-sandbox.html') {
    return true;
  }
  return false;
}

function scanEntry(entry) {
  const failures = [];
  const text = entry.text || '';
  for (const rule of SCAN_RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const index = match.index || 0;
      if (isAllowedFinding(entry, rule.id, match)) continue;
      failures.push({
        ruleId: rule.id,
        message: rule.message,
        path: normalizePath(entry.path),
        line: lineNumberForIndex(text, index),
        excerpt: excerptForIndex(text, index),
      });
    }
  }
  return failures;
}

export function scanRemoteCodeEntries(entries) {
  const normalized = entries
    .filter((entry) => entry && typeof entry.path === 'string' && typeof entry.text === 'string')
    .map((entry) => ({ path: normalizePath(entry.path), text: entry.text }));
  const failures = normalized.flatMap(scanEntry);
  return {
    scannedCount: normalized.length,
    failures,
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

export function loadEntriesFromDirectory(targetDir) {
  return readDirectoryEntries(resolve(targetDir));
}

export function loadDefaultSourceEntries(projectRoot = defaultProjectRoot) {
  const entries = [];
  for (const sourcePath of DEFAULT_SOURCE_PATHS) {
    const absolute = join(projectRoot, sourcePath);
    if (!existsSync(absolute)) continue;
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      entries.push(...readDirectoryEntries(absolute, projectRoot));
    } else if (stat.isFile() && isTextPath(sourcePath)) {
      entries.push({ path: normalizePath(sourcePath), text: readFileSync(absolute, 'utf8') });
    }
  }
  return entries;
}

export function loadEntriesFromZip(zipPath) {
  const zip = readZipEntries(resolve(zipPath));
  const entries = [];
  for (const entry of zip.entries) {
    if (!isTextPath(entry.name)) continue;
    const bytes = zip.readEntry(entry.name);
    if (!bytes) continue;
    entries.push({ path: entry.name, text: bytes.toString('utf8') });
  }
  return entries;
}

function readZipEntries(zipPath) {
  const buffer = readFileSync(zipPath);
  const minEocd = 22;
  const maxComment = 0xffff;
  let eocdOffset = -1;
  for (let i = buffer.length - minEocd; i >= Math.max(0, buffer.length - minEocd - maxComment); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error(`Could not find ZIP central directory in ${zipPath}`);

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory entry ${i} in ${zipPath}`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = normalizeZipName(buffer.slice(offset + 46, offset + 46 + nameLength).toString('utf8'));
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  function readEntry(name) {
    const entry = entries.find((item) => item.name === normalizeZipName(name));
    if (!entry) return null;
    const local = entry.localHeaderOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP header for ${name}`);
    }
    const nameLength = buffer.readUInt16LE(local + 26);
    const extraLength = buffer.readUInt16LE(local + 28);
    const dataOffset = local + 30 + nameLength + extraLength;
    const compressed = buffer.slice(dataOffset, dataOffset + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return inflateRawSync(compressed);
    throw new Error(`Unsupported ZIP compression method ${entry.method} for ${name}`);
  }

  return { entries, readEntry };
}

function loadEntriesForTarget(projectRoot, target) {
  if (!target) {
    return { label: 'default source/package inputs', entries: loadDefaultSourceEntries(projectRoot) };
  }
  const absolute = resolve(projectRoot, target);
  if (!existsSync(absolute)) throw new Error(`Target does not exist: ${target}`);
  const stat = statSync(absolute);
  if (stat.isDirectory()) {
    return { label: normalizePath(relative(projectRoot, absolute)) || absolute, entries: loadEntriesFromDirectory(absolute) };
  }
  if (/\.zip$/i.test(absolute)) {
    return { label: normalizePath(relative(projectRoot, absolute)) || absolute, entries: loadEntriesFromZip(absolute) };
  }
  if (stat.isFile() && isTextPath(absolute)) {
    return {
      label: normalizePath(relative(projectRoot, absolute)) || absolute,
      entries: [{ path: normalizePath(relative(projectRoot, absolute)), text: readFileSync(absolute, 'utf8') }],
    };
  }
  throw new Error(`Unsupported scan target: ${target}`);
}

function checkDocumentation(projectRoot) {
  const failures = [];
  for (const requirement of DOC_REQUIREMENTS) {
    const absolute = join(projectRoot, requirement.path);
    if (!existsSync(absolute)) {
      failures.push({ ruleId: 'missing-documentation', path: requirement.path, line: 1, message: 'required CWS documentation file is missing', excerpt: requirement.path });
      continue;
    }
    const text = readFileSync(absolute, 'utf8');
    for (const needle of requirement.needles) {
      if (text.includes(needle)) continue;
      failures.push({
        ruleId: 'missing-documentation-needle',
        path: requirement.path,
        line: 1,
        message: `required CWS documentation text is missing: ${needle}`,
        excerpt: needle,
      });
    }
  }

  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  if (packageJson.scripts?.['cws:remote-code:check'] !== 'node scripts/check-cws-remote-code.mjs') {
    failures.push({
      ruleId: 'package-script-missing',
      path: 'package.json',
      line: 1,
      message: 'package.json is missing cws:remote-code:check',
      excerpt: '"cws:remote-code:check": "node scripts/check-cws-remote-code.mjs"',
    });
  }

  const ci = readFileSync(join(projectRoot, '.github/workflows/ci.yml'), 'utf8');
  if (!ci.includes('npm run cws:remote-code:check')) {
    failures.push({
      ruleId: 'ci-step-missing',
      path: '.github/workflows/ci.yml',
      line: 1,
      message: 'CI does not run npm run cws:remote-code:check',
      excerpt: 'npm run cws:remote-code:check',
    });
  }
  return failures;
}

export function runCwsRemoteCodeCheck(options = {}) {
  const projectRoot = resolve(options.projectRoot || defaultProjectRoot);
  const target = options.target || null;
  const { label, entries } = loadEntriesForTarget(projectRoot, target);
  const scanResult = scanRemoteCodeEntries(entries);
  const documentationFailures = checkDocumentation(projectRoot);
  return {
    target: label,
    scannedCount: scanResult.scannedCount,
    failures: [...scanResult.failures, ...documentationFailures],
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
  const wantJson = args.includes('--json');
  const quiet = args.includes('--quiet');
  const target = argValue(args, '--target') || null;
  const result = runCwsRemoteCodeCheck({ target });

  if (wantJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.failures.length === 0) {
    if (!quiet) {
      process.stdout.write(`CWS remote-code check passed for ${result.scannedCount} file(s) from ${result.target}.\n`);
    }
  } else {
    process.stderr.write(`CWS remote-code check failed with ${result.failures.length} issue(s):\n`);
    for (const failure of result.failures) {
      process.stderr.write(`- [${failure.ruleId}] ${failure.path}:${failure.line} ${failure.message}\n`);
      if (failure.excerpt) process.stderr.write(`  ${failure.excerpt}\n`);
    }
  }

  process.exit(result.failures.length === 0 ? 0 : 1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`CWS remote-code check failed: ${error?.stack || error?.message || String(error)}\n`);
    process.exit(1);
  }
}
