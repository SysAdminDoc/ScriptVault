#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_DIR = 'src/locales';
const GENERATED_RUNTIME = 'src/generated/locale-catalogs.ts';

function normalize(value) {
  return String(value).replace(/\r\n/g, '\n');
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function placeholders(message) {
  return [...String(message).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
    .map(match => match[1])
    .sort();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareKeys(reference, candidate, label) {
  const referenceKeys = Object.keys(reference).sort();
  const candidateKeys = Object.keys(candidate).sort();
  const missing = referenceKeys.filter(key => !candidateKeys.includes(key));
  const extra = candidateKeys.filter(key => !referenceKeys.includes(key));
  assert(!missing.length && !extra.length,
    `${label} key drift (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
}

async function loadSources(rootDir) {
  const sourceRoot = join(rootDir, SOURCE_DIR);
  const files = (await readdir(sourceRoot)).filter(file => file.endsWith('.json')).sort();
  assert(files.length > 0, `No locale sources found in ${SOURCE_DIR}`);

  const sources = [];
  for (const file of files) {
    const path = join(sourceRoot, file);
    const source = JSON.parse(await readFile(path, 'utf8'));
    const filenameCode = file.slice(0, -'.json'.length);
    assert(source.code === filenameCode, `${SOURCE_DIR}/${file}: code must match the filename`);
    assert(/^[a-z]{2,3}$/.test(source.code), `${SOURCE_DIR}/${file}: invalid locale code`);
    assert(typeof source.name === 'string' && source.name.trim(), `${SOURCE_DIR}/${file}: name is required`);
    assert(['ltr', 'rtl'].includes(source.direction), `${SOURCE_DIR}/${file}: direction must be ltr or rtl`);
    assert(['complete', 'partial'].includes(source.translationStatus),
      `${SOURCE_DIR}/${file}: translationStatus must be complete or partial`);
    assert(Number.isInteger(source.runtimeCoverageBaseline) && source.runtimeCoverageBaseline >= 0,
      `${SOURCE_DIR}/${file}: runtimeCoverageBaseline must be a non-negative integer`);
    assert(source.runtime && typeof source.runtime === 'object' && !Array.isArray(source.runtime),
      `${SOURCE_DIR}/${file}: runtime must be an object`);
    assert(source.manifest && typeof source.manifest === 'object' && !Array.isArray(source.manifest),
      `${SOURCE_DIR}/${file}: manifest must be an object`);
    sources.push(source);
  }

  const english = sources.find(source => source.code === 'en');
  assert(english, `${SOURCE_DIR}/en.json is required`);
  assert(english.translationStatus === 'complete', 'English must be labeled complete');
  assert(english.runtimeCoverageBaseline === Object.keys(english.runtime).length,
    'English runtimeCoverageBaseline must equal the canonical runtime key count');

  const runtimeKeys = new Set(Object.keys(english.runtime));
  for (const source of sources) {
    compareKeys(english.manifest, source.manifest, `${SOURCE_DIR}/${source.code}.json manifest`);
    for (const [key, value] of Object.entries(source.runtime)) {
      assert(runtimeKeys.has(key), `${SOURCE_DIR}/${source.code}.json: unknown runtime key ${key}`);
      assert(typeof value === 'string', `${SOURCE_DIR}/${source.code}.json: runtime.${key} must be a string`);
      if (source.code !== 'en') {
        assert(value !== english.runtime[key],
          `${SOURCE_DIR}/${source.code}.json: runtime.${key} duplicates English; remove the override`);
        assert(JSON.stringify(placeholders(value)) === JSON.stringify(placeholders(english.runtime[key])),
          `${SOURCE_DIR}/${source.code}.json: runtime.${key} must preserve English placeholders`);
      }
    }
    assert(Object.keys(source.runtime).length >= source.runtimeCoverageBaseline,
      `${SOURCE_DIR}/${source.code}.json: translated runtime coverage regressed below ` +
      `${source.runtimeCoverageBaseline}`);
    if (source.translationStatus === 'complete') {
      assert(source.code === 'en' || Object.keys(source.runtime).length === runtimeKeys.size,
        `${SOURCE_DIR}/${source.code}.json: complete locales must translate every runtime key`);
    }
    for (const [key, entry] of Object.entries(source.manifest)) {
      assert(entry && typeof entry.message === 'string' && entry.message.length > 0,
        `${SOURCE_DIR}/${source.code}.json: manifest.${key}.message is required`);
      if (entry.description !== undefined) {
        assert(typeof entry.description === 'string',
          `${SOURCE_DIR}/${source.code}.json: manifest.${key}.description must be a string`);
      }
    }
  }
  return { english, sources };
}

function buildTypedCatalog({ english, sources }) {
  const runtimeCatalogs = Object.fromEntries(sources.map(source => [source.code, source.runtime]));
  const manifestCatalogs = Object.fromEntries(sources.map(source => [source.code, source.manifest]));
  const total = Object.keys(english.runtime).length;
  const localeMetadata = Object.fromEntries(sources.map(source => [source.code, {
    name: source.name,
    direction: source.direction,
    translationStatus: source.translationStatus,
    runtimeCoverageBaseline: source.runtimeCoverageBaseline,
    translatedRuntimeMessages: source.code === 'en' ? total : Object.keys(source.runtime).length,
    totalRuntimeMessages: total,
  }]));

  return [
    '// ============================================================================',
    '// Generated from src/locales/*.json; do not edit by hand.',
    '// Run `npm run locale:generate` after editing a per-locale source catalog.',
    '// ============================================================================',
    '',
    `export const localeCatalogs = ${JSON.stringify(runtimeCatalogs, null, 2)} as const;`,
    '',
    `export const manifestCatalogs = ${JSON.stringify(manifestCatalogs, null, 2)} as const;`,
    '',
    `export const localeMetadata = ${JSON.stringify(localeMetadata, null, 2)} as const;`,
    '',
    'export type LocaleCode = keyof typeof localeCatalogs;',
    'export type TranslationKey = keyof typeof localeCatalogs.en;',
    'export type TranslationCatalog = Readonly<Partial<Record<TranslationKey, string>>>;',
    'export type ManifestMessageKey = keyof typeof manifestCatalogs.en;',
    'export type LocaleDirection = (typeof localeMetadata)[LocaleCode][\'direction\'];',
    '',
  ].join('\n');
}

async function expectedOutputs(rootDir) {
  const catalogs = await loadSources(rootDir);
  const outputs = new Map([[GENERATED_RUNTIME, buildTypedCatalog(catalogs)]]);
  for (const source of catalogs.sources) {
    outputs.set(`_locales/${source.code}/messages.json`, json(source.manifest));
  }
  return outputs;
}

export async function generateLocales(options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const check = Boolean(options.check);
  const outputs = await expectedOutputs(rootDir);
  const drift = [];

  for (const [relativePath, expected] of outputs) {
    const path = join(rootDir, relativePath);
    if (check) {
      let actual = '';
      try {
        actual = normalize(await readFile(path, 'utf8'));
      } catch {
        drift.push(`${relativePath} (missing)`);
        continue;
      }
      if (actual !== normalize(expected)) drift.push(relativePath);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, expected, 'utf8');
  }

  if (check && drift.length) {
    throw new Error(`Generated locale artifacts are stale:\n- ${drift.join('\n- ')}`);
  }
  return { files: [...outputs.keys()], drift };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  try {
    const result = await generateLocales({ check });
    console.log(`[locales] ${check ? 'verified' : 'generated'} ${result.files.length} artifact(s)`);
  } catch (error) {
    console.error(`[locales] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
