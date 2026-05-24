#!/usr/bin/env node
// Generate browser-specific manifests from the Chrome MV3 manifest source.
//
// The script name is kept Firefox-specific because it implements the
// manifest-generation follow-up that originally targeted Firefox parity.
// The transformation file also carries an Edge profile so all store targets
// share the same declarative manifest drift surface.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_CONFIG_PATH = resolve(ROOT_DIR, 'manifest-firefox.transformations.json');
const INDENT = '  ';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function splitPath(path) {
  return path ? path.split('.') : [];
}

function getAtPath(root, path) {
  let cursor = root;
  for (const segment of splitPath(path)) {
    if (cursor == null) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function setAtPath(root, path, value) {
  const segments = splitPath(path);
  let cursor = root;
  for (const segment of segments.slice(0, -1)) {
    if (!cursor[segment] || typeof cursor[segment] !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = cloneJson(value);
}

function deleteAtPath(root, path) {
  const segments = splitPath(path);
  let cursor = root;
  for (const segment of segments.slice(0, -1)) {
    if (!cursor || typeof cursor !== 'object') return;
    cursor = cursor[segment];
  }
  if (cursor && typeof cursor === 'object') {
    delete cursor[segments.at(-1)];
  }
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function applyArrayTransform(manifest, path, transform) {
  const original = getAtPath(manifest, path);
  if (!Array.isArray(original)) return;

  const rename = transform.rename || {};
  const remove = new Set(transform.remove || []);
  const prepend = transform.prepend || [];
  const append = transform.append || [];
  const renamed = original
    .map((value) => rename[value] || value)
    .filter((value) => !remove.has(value));

  setAtPath(manifest, path, unique([...prepend, ...renamed, ...append]));
}

function orderObject(value, orders, path = '') {
  if (Array.isArray(value)) {
    return value.map((item, index) => orderObject(item, orders, `${path}.${index}`));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const preferred = orders?.[path] || [];
  const keys = Object.keys(value);
  const orderedKeys = [
    ...preferred.filter((key) => Object.hasOwn(value, key)),
    ...keys.filter((key) => !preferred.includes(key)),
  ];

  const ordered = {};
  for (const key of orderedKeys) {
    const childPath = path ? `${path}.${key}` : key;
    ordered[key] = orderObject(value[key], orders, childPath);
  }
  return ordered;
}

function pathMatches(patterns, path) {
  return patterns.some((pattern) => {
    if (pattern === path) return true;
    const patternParts = pattern.split('.');
    const pathParts = path.split('.');
    if (patternParts.length !== pathParts.length) return false;
    return patternParts.every((part, index) => part === '*' || part === pathParts[index]);
  });
}

function indent(level) {
  return INDENT.repeat(level);
}

function stringifyPrimitiveArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function stringifyObject(value, path, level, format) {
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';

  const lines = entries.map(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    return `${indent(level + 1)}${JSON.stringify(key)}: ${stringifyValue(child, childPath, level + 1, format)}`;
  });
  return `{\n${lines.join(',\n')}\n${indent(level)}}`;
}

function stringifyCompactObjectArray(values, path, level, format) {
  if (values.length === 0) return '[]';

  const chunks = values.map((item, index) => {
    const itemPath = `${path}.${index}`;
    const entries = Object.entries(item);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, child]) => {
      const childPath = `${itemPath}.${key}`;
      return `${indent(level + 1)}${JSON.stringify(key)}: ${stringifyValue(child, childPath, level + 1, format)}`;
    });
    return `{\n${lines.join(',\n')}\n${indent(level)}}`;
  });

  if (chunks.length === 1) {
    return `[${chunks[0]}]`;
  }
  return `[\n${chunks.map((chunk) => `${indent(level + 1)}${chunk}`).join(',\n')}\n${indent(level)}]`;
}

function stringifyArray(values, path, level, format) {
  if (values.length === 0) return '[]';
  if (pathMatches(format.compactArrays, path)) {
    return stringifyPrimitiveArray(values);
  }
  if (pathMatches(format.compactObjectArrays, path) && values.every((value) => value && typeof value === 'object' && !Array.isArray(value))) {
    return stringifyCompactObjectArray(values, path, level, format);
  }

  const lines = values.map((item, index) => {
    const childPath = `${path}.${index}`;
    return `${indent(level + 1)}${stringifyValue(item, childPath, level + 1, format)}`;
  });
  return `[\n${lines.join(',\n')}\n${indent(level)}]`;
}

function stringifyValue(value, path, level, format) {
  if (Array.isArray(value)) {
    return stringifyArray(value, path, level, format);
  }
  if (value && typeof value === 'object') {
    return stringifyObject(value, path, level, format);
  }
  return JSON.stringify(value);
}

export async function loadTransformationConfig(configPath = DEFAULT_CONFIG_PATH) {
  const text = await readFile(configPath, 'utf8');
  return JSON.parse(text);
}

export function applyManifestTransform(sourceManifest, profileConfig) {
  const manifest = cloneJson(sourceManifest);

  for (const path of profileConfig.removeKeys || []) {
    deleteAtPath(manifest, path);
  }

  for (const item of profileConfig.set || []) {
    setAtPath(manifest, item.path, item.value);
  }

  for (const item of profileConfig.removeObjectKeys || []) {
    const target = getAtPath(manifest, item.path);
    if (!target || typeof target !== 'object' || Array.isArray(target)) continue;
    for (const key of item.keys || []) {
      delete target[key];
    }
  }

  for (const [path, transform] of Object.entries(profileConfig.arrayTransforms || {})) {
    applyArrayTransform(manifest, path, transform);
  }

  return orderObject(manifest, profileConfig.orders || {});
}

export function formatManifest(manifest, profileConfig = {}) {
  const format = {
    compactArrays: profileConfig.format?.compactArrays || [],
    compactObjectArrays: profileConfig.format?.compactObjectArrays || [],
  };
  const lineEnding = profileConfig.format?.lineEnding === 'crlf' ? '\r\n' : '\n';
  const text = `${stringifyValue(manifest, '', 0, format)}\n`;
  const lfLineNumbers = new Set(profileConfig.format?.lfLineNumbers || []);
  const lines = text.split('\n');
  return lines.map((line, index) => {
    if (index === lines.length - 1) return line;
    const lineNumber = index + 1;
    return line + (lfLineNumbers.has(lineNumber) ? '\n' : lineEnding);
  }).join('');
}

export async function generateManifestForProfile(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const configPath = options.configPath || DEFAULT_CONFIG_PATH;
  const profileName = options.profile || 'firefox';
  const config = await loadTransformationConfig(configPath);
  const profileConfig = config.profiles?.[profileName];
  if (!profileConfig) {
    throw new Error(`Unknown manifest profile: ${profileName}`);
  }

  const sourcePath = resolve(rootDir, options.sourcePath || config.source || 'manifest.json');
  const sourceManifest = JSON.parse(await readFile(sourcePath, 'utf8'));
  const manifest = applyManifestTransform(sourceManifest, profileConfig);
  const text = formatManifest(manifest, profileConfig);
  const outputPath = resolve(rootDir, options.outputPath || profileConfig.outputPath);
  return {
    manifest,
    text,
    outputPath,
    profileName,
    transformations: cloneJson(profileConfig),
  };
}

export async function writeGeneratedManifest(options = {}) {
  const result = await generateManifestForProfile(options);
  await mkdir(dirname(result.outputPath), { recursive: true });
  await writeFile(result.outputPath, result.text);
  return result;
}

async function runCli() {
  const args = process.argv.slice(2);
  let profile = 'firefox';
  let rootDir = process.cwd();
  let outputPath = null;
  let mode = 'write';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--check') {
      mode = 'check';
    } else if (arg === '--write') {
      mode = 'write';
    } else if (arg === '--stdout') {
      mode = 'stdout';
    } else if (arg === '--profile') {
      profile = args[++index];
    } else if (arg.startsWith('--profile=')) {
      profile = arg.slice('--profile='.length);
    } else if (arg === '--root') {
      rootDir = resolve(args[++index]);
    } else if (arg.startsWith('--root=')) {
      rootDir = resolve(arg.slice('--root='.length));
    } else if (arg === '--out') {
      outputPath = args[++index];
    } else if (arg.startsWith('--out=')) {
      outputPath = arg.slice('--out='.length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const result = await generateManifestForProfile({ profile, rootDir, outputPath });
  if (mode === 'stdout') {
    process.stdout.write(result.text);
    return;
  }

  if (mode === 'check') {
    const existing = await readFile(result.outputPath, 'utf8');
    if (existing !== result.text) {
      throw new Error(`${profile} manifest drift: ${result.outputPath} does not match generated output`);
    }
    process.stdout.write(`[manifest-generator] ${profile} manifest matches ${result.outputPath}\n`);
    return;
  }

  await mkdir(dirname(result.outputPath), { recursive: true });
  await writeFile(result.outputPath, result.text);
  process.stdout.write(`[manifest-generator] wrote ${result.outputPath}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runCli().catch((err) => {
    console.error(`[manifest-generator] Failed: ${err?.stack || err?.message || err}`);
    process.exit(1);
  });
}
