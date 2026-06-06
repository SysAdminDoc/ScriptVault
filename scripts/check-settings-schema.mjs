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
const ALLOWED_METADATA_TYPES = new Set(['boolean', 'string', 'number', 'array', 'object']);
const ALLOWED_METADATA_CONTROLS = new Set([
  'checkbox',
  'number',
  'password',
  'readonly',
  'select',
  'text',
  'textarea',
  'url',
]);
const REQUIRED_VALIDATION_KEYS = new Map([
  ['badgeColor', 'hex-color'],
  ['checkInterval', 'select-option'],
  ['editorFontSize', 'select-option'],
  ['externalsInterval', 'select-option'],
  ['indentWidth', 'select-option'],
  ['notifyHideAfter', 'select-option'],
  ['tabSize', 'select-option'],
  ['lintMaxSize', 'integer-range'],
  ['webdavUrl', 'http-url'],
  ['webdavUsername', 'credential-text'],
  ['webdavPassword', 'credential-secret'],
  ['s3Endpoint', 'http-url'],
  ['s3Region', 's3-region'],
  ['s3Bucket', 's3-bucket'],
  ['s3AccessKeyId', 's3-access-key-id'],
  ['s3SecretKey', 'credential-secret'],
  ['s3ObjectKey', 's3-object-key'],
  ['syncEncryptionPassphrase', 'credential-secret'],
  ['deniedHosts', 'host-list'],
  ['linterConfig', 'json-object'],
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

function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';
  return typeof value;
}

function validateMetadata(schema, classified, defaultKeys, defaults, dashboardSaveKeys) {
  const errors = [];
  const metadata = schema?.metadata || {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      metadata: {},
      errors: ['Settings schema metadata must be an object keyed by setting name'],
    };
  }

  const required = new Set([
    ...[...classified.entries()]
      .filter(([, classification]) => classification === 'visible')
      .map(([key]) => key),
    ...dashboardSaveKeys.filter((key) => classified.get(key) === 'credential'),
  ]);

  for (const key of [...required].sort()) {
    const entry = metadata[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`Setting "${key}" is missing schema metadata`);
      continue;
    }
    if (!ALLOWED_METADATA_TYPES.has(entry.type)) {
      errors.push(`Setting "${key}" metadata has invalid type "${entry.type}"`);
    }
    if (!ALLOWED_METADATA_CONTROLS.has(entry.control)) {
      errors.push(`Setting "${key}" metadata has invalid control "${entry.control}"`);
    }
    if (typeof entry.label !== 'string' || !entry.label.trim()) {
      errors.push(`Setting "${key}" metadata must include a non-empty label`);
    }
    if (typeof entry.help !== 'string' || !entry.help.trim()) {
      errors.push(`Setting "${key}" metadata must include non-empty help text`);
    }
    if (defaultKeys.includes(key)) {
      if (!Object.prototype.hasOwnProperty.call(entry, 'default')) {
        errors.push(`Setting "${key}" metadata must include its default value`);
      } else if (JSON.stringify(entry.default) !== JSON.stringify(defaults[key])) {
        errors.push(`Setting "${key}" metadata default does not match src/config/settings-defaults.json`);
      }
      const actualType = valueType(defaults[key]);
      if (entry.type !== actualType) {
        errors.push(`Setting "${key}" metadata type "${entry.type}" does not match default type "${actualType}"`);
      }
    } else if (typeof entry.defaultSource !== 'string' || !entry.defaultSource.trim()) {
      errors.push(`Setting "${key}" metadata must include defaultSource when no default exists`);
    }
    if (entry.control === 'select' && (!Array.isArray(entry.options) || entry.options.length === 0)) {
      errors.push(`Setting "${key}" metadata select control must include options`);
    }
    const requiredValidation = REQUIRED_VALIDATION_KEYS.get(key);
    if (requiredValidation && entry.validation?.kind !== requiredValidation) {
      errors.push(`Setting "${key}" metadata must declare ${requiredValidation} validation`);
    }
  }

  for (const key of Object.keys(metadata).sort()) {
    if (!classified.has(key)) {
      errors.push(`Metadata setting "${key}" is not classified`);
    }
  }

  return { metadata, errors };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAttribute(markup, name) {
  const match = markup.match(new RegExp(`\\s${escapeRegex(name)}=(["'])(.*?)\\1`, 'i'));
  return match?.[2] || '';
}

function findDashboardElement(html, id) {
  const idPattern = escapeRegex(id);
  const paired = html.match(new RegExp(`<([a-zA-Z][\\w:-]*)\\b([^>]*\\sid=(["'])${idPattern}\\3[^>]*)>([\\s\\S]*?)<\\/\\1>`, 'i'));
  if (paired) {
    return {
      tagName: paired[1].toLowerCase(),
      attrs: paired[2],
      innerHtml: paired[4],
      markup: paired[0],
    };
  }
  const single = html.match(new RegExp(`<([a-zA-Z][\\w:-]*)\\b([^>]*\\sid=(["'])${idPattern}\\3[^>]*)>`, 'i'));
  if (single) {
    return {
      tagName: single[1].toLowerCase(),
      attrs: single[2],
      innerHtml: '',
      markup: single[0],
    };
  }
  return null;
}

function dashboardControlFor(element) {
  const tag = element.tagName;
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textarea';
  if (tag !== 'input') return tag;
  const type = getAttribute(element.attrs, 'type') || 'text';
  if (type === 'checkbox') return 'checkbox';
  if (type === 'number') return 'number';
  if (type === 'password') return 'password';
  if (type === 'url') return 'url';
  return 'text';
}

function validateDashboardMetadata(metadata, dashboardHtml) {
  const errors = [];

  for (const [key, entry] of Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b))) {
    if (!entry.elementId) continue;
    const element = findDashboardElement(dashboardHtml, entry.elementId);
    if (!element) {
      errors.push(`Setting "${key}" metadata elementId "${entry.elementId}" was not found in pages/dashboard.html`);
      continue;
    }
    const actualControl = dashboardControlFor(element);
    if (entry.control !== actualControl) {
      errors.push(`Setting "${key}" metadata control "${entry.control}" does not match dashboard control "${actualControl}"`);
    }
    if (entry.control === 'select') {
      const dashboardValues = [...element.innerHtml.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)]
        .map((option) => getAttribute(option[1], 'value') || option[2].replace(/<[^>]+>/g, '').trim());
      const metadataValues = (entry.options || []).map((option) => option.value);
      if (JSON.stringify(metadataValues) !== JSON.stringify(dashboardValues)) {
        errors.push(`Setting "${key}" metadata select options do not match pages/dashboard.html`);
      }
    }
    if (entry.validation) {
      const describedBy = getAttribute(element.attrs, 'aria-describedby').split(/\s+/).filter(Boolean);
      const errorId = describedBy.find((id) => id.endsWith('Error'));
      const errorElement = errorId ? findDashboardElement(dashboardHtml, errorId) : null;
      const errorClasses = errorElement ? getAttribute(errorElement.attrs, 'class').split(/\s+/) : [];
      if (!errorElement || !errorClasses.includes('setting-error')) {
        errors.push(`Setting "${key}" validation metadata requires a dashboard setting-error element`);
      }
    }
  }

  return errors;
}

export function analyzeSettingsSchema({ rootDir = process.cwd() } = {}) {
  const paths = {
    defaults: resolve(rootDir, 'src/config/settings-defaults.json'),
    schema: resolve(rootDir, 'src/config/settings-schema.json'),
    types: resolve(rootDir, 'src/types/settings.ts'),
    dashboard: resolve(rootDir, 'pages/dashboard.js'),
    dashboardHtml: resolve(rootDir, 'pages/dashboard.html'),
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
      counts: { defaults: 0, typeKeys: 0, dashboardSaveKeys: 0, classified: 0, metadata: 0 },
    };
  }

  const defaults = readJson(paths.defaults);
  const schema = readJson(paths.schema);
  const typeKeys = extractSettingsTypeKeys(readFileSync(paths.types, 'utf8'));
  const dashboardSaveKeys = extractDashboardSaveKeys(readFileSync(paths.dashboard, 'utf8'));
  const dashboardHtml = readFileSync(paths.dashboardHtml, 'utf8');
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
  const { metadata, errors: metadataErrors } = validateMetadata(schema, classified, defaultKeys, defaults, dashboardSaveKeys);
  errors.push(...metadataErrors);
  errors.push(...validateDashboardMetadata(metadata, dashboardHtml));

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      defaults: defaultKeys.length,
      typeKeys: typeKeys.length,
      dashboardSaveKeys: dashboardSaveKeys.length,
      classified: classified.size,
      metadata: Object.keys(metadata).length,
    },
    defaultKeys,
    typeKeys,
    dashboardSaveKeys,
  };
}

export function formatSettingsSchemaReport(report) {
  const summary = `${report.counts.defaults} defaults, ${report.counts.typeKeys} typed keys, ${report.counts.dashboardSaveKeys} dashboard-save keys, ${report.counts.classified} classified keys, ${report.counts.metadata} metadata entries`;
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
