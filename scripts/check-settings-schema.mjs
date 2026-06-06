#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_CLASSIFICATIONS = new Set([
  'visible',
  'credential',
  'timestamp',
  'internal',
  'derived',
  'deprecated',
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function extractSettingsTypeKeys(source) {
  const body = source.match(/export interface Settings \{([\s\S]*?)\n\}/)?.[1] || '';
  return [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)(?:\?)?:/gm)]
    .map((match) => match[1])
    .sort();
}

function extractDashboardSaveKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(/settings[A-Za-z0-9_]+\s*:\s*\[\s*['"]([^'"]+)/g)) {
    keys.add(match[1]);
  }
  for (const match of source.matchAll(/saveSetting(?:OrThrow)?\(\s*['"]([^'"]+)/g)) {
    keys.add(match[1]);
  }
  return [...keys].sort();
}

function buildClassificationMap(schema) {
  const errors = [];
  const classified = new Map();
  const classifications = schema?.classifications || {};

  for (const [classification, keys] of Object.entries(classifications)) {
    if (!ALLOWED_CLASSIFICATIONS.has(classification)) {
      errors.push(`Unknown settings classification "${classification}"`);
      continue;
    }
    if (!Array.isArray(keys)) {
      errors.push(`Classification "${classification}" must be an array`);
      continue;
    }
    for (const key of keys) {
      if (typeof key !== 'string' || !key) {
        errors.push(`Classification "${classification}" contains a non-string key`);
        continue;
      }
      if (classified.has(key)) {
        errors.push(`Setting "${key}" is classified as both "${classified.get(key)}" and "${classification}"`);
        continue;
      }
      classified.set(key, classification);
    }
  }

  for (const classification of ALLOWED_CLASSIFICATIONS) {
    if (!Object.prototype.hasOwnProperty.call(classifications, classification)) {
      errors.push(`Missing settings classification bucket "${classification}"`);
    }
  }

  return { classified, errors };
}

export function analyzeSettingsSchema({ rootDir = process.cwd() } = {}) {
  const paths = {
    defaults: resolve(rootDir, 'src/config/settings-defaults.json'),
    schema: resolve(rootDir, 'src/config/settings-schema.json'),
    types: resolve(rootDir, 'src/types/settings.ts'),
    dashboard: resolve(rootDir, 'pages/dashboard.js'),
  };
  const errors = [];

  for (const [label, path] of Object.entries(paths)) {
    if (!existsSync(path)) {
      errors.push(`${label} file not found: ${path}`);
    }
  }
  if (errors.length) {
    return {
      ok: false,
      errors,
      counts: { defaults: 0, typeKeys: 0, dashboardSaveKeys: 0, classified: 0 },
    };
  }

  const defaults = readJson(paths.defaults);
  const schema = readJson(paths.schema);
  const typeKeys = extractSettingsTypeKeys(readFileSync(paths.types, 'utf8'));
  const dashboardSaveKeys = extractDashboardSaveKeys(readFileSync(paths.dashboard, 'utf8'));
  const defaultKeys = Object.keys(defaults).sort();
  const { classified, errors: classificationErrors } = buildClassificationMap(schema);
  errors.push(...classificationErrors);

  const required = new Set([...defaultKeys, ...typeKeys, ...dashboardSaveKeys]);
  for (const key of [...required].sort()) {
    if (!classified.has(key)) {
      errors.push(`Setting "${key}" is used by defaults/types/dashboard saves but is not classified in src/config/settings-schema.json`);
    }
  }

  for (const key of [...classified.keys()].sort()) {
    if (!required.has(key)) {
      errors.push(`Classified setting "${key}" is not present in defaults, Settings type, or dashboard save handlers`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      defaults: defaultKeys.length,
      typeKeys: typeKeys.length,
      dashboardSaveKeys: dashboardSaveKeys.length,
      classified: classified.size,
    },
    defaultKeys,
    typeKeys,
    dashboardSaveKeys,
  };
}

export function formatSettingsSchemaReport(report) {
  const summary = `${report.counts.defaults} defaults, ${report.counts.typeKeys} typed keys, ${report.counts.dashboardSaveKeys} dashboard-save keys, ${report.counts.classified} classified keys`;
  if (report.ok) {
    return `[settings-schema] OK: ${summary}.`;
  }
  return [
    `[settings-schema] Settings schema check failed: ${summary}.`,
    ...report.errors.map((error) => `- ${error}`),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = analyzeSettingsSchema();
  console.log(formatSettingsSchemaReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
