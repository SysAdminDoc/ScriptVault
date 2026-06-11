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
const DASHBOARD_CONTROLS_REQUIRING_VALIDATION = new Set([
  'number',
  'password',
  'select',
  'text',
  'textarea',
  'url',
]);
const REQUIRED_VALIDATION_KEYS = new Map([
  ['badgeColor', 'hex-color'],
  ['allowCommunication', 'select-option'],
  ['allowCookies', 'select-option'],
  ['allowHttpHeaders', 'select-option'],
  ['allowLocalFiles', 'select-option'],
  ['badgeInfo', 'select-option'],
  ['blacklistSource', 'select-option'],
  ['blockSeverity', 'select-option'],
  ['checkInterval', 'select-option'],
  ['checkConnect', 'select-option'],
  ['configMode', 'select-option'],
  ['contentScriptAPI', 'select-option'],
  ['customCss', 'css-text'],
  ['defaultTabTypes', 'select-option'],
  ['downloadMode', 'select-option'],
  ['editorFontSize', 'select-option'],
  ['editorTheme', 'select-option'],
  ['externalsInterval', 'select-option'],
  ['highlightMatches', 'select-option'],
  ['includeMode', 'select-option'],
  ['incognitoStorage', 'select-option'],
  ['indentWith', 'select-option'],
  ['indentWidth', 'select-option'],
  ['keyMapping', 'select-option'],
  ['loggingLevel', 'select-option'],
  ['modifyCSP', 'select-option'],
  ['notifyHideAfter', 'select-option'],
  ['pageFilterMode', 'select-option'],
  ['popupColumns', 'select-option'],
  ['sandboxMode', 'select-option'],
  ['scriptOrder', 'select-option'],
  ['searchIntegration', 'select-option'],
  ['sri', 'select-option'],
  ['strictMode', 'select-option'],
  ['tabMode', 'select-option'],
  ['tabSize', 'select-option'],
  ['topLevelAwait', 'select-option'],
  ['trashMode', 'select-option'],
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
    if (entry.elementId && DASHBOARD_CONTROLS_REQUIRING_VALIDATION.has(entry.control) && !entry.validation) {
      errors.push(`Setting "${key}" dashboard ${entry.control} control requires validation metadata`);
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

function parseDashboardSettingFallback(raw) {
  const value = String(raw || '').trim();
  if (/^['"][\s\S]*['"]$/.test(value)) return value.slice(1, -1);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return { unsupportedLiteral: value };
}

function parseDashboardSchemaDrivenSections(source) {
  const sections = new Map();
  const errors = [];
  if (!source.includes('DASHBOARD_SCHEMA_DRIVEN_SETTING_SECTIONS')) {
    return { sections, errors };
  }

  const declaration = source.match(/const DASHBOARD_SCHEMA_DRIVEN_SETTING_SECTIONS = Object\.freeze\(\{([\s\S]*?)\n\s*\}\);/);
  if (!declaration) {
    return {
      sections,
      errors: ['Dashboard schema-driven setting sections could not be parsed'],
    };
  }

  for (const sectionMatch of declaration[1].matchAll(/([A-Za-z_$][\w$]*):\s*Object\.freeze\(\[([\s\S]*?)\]\)/g)) {
    const sectionName = sectionMatch[1];
    const entriesSource = sectionMatch[2];
    const entries = [];
    const entryPattern = /\{\s*key:\s*'([^']+)'\s*,\s*elementId:\s*'([^']+)'\s*,\s*property:\s*'([^']+)'\s*,\s*fallback:\s*([^,}]+)\s*,\s*event:\s*'([^']+)'(?:\s*,\s*previewElementId:\s*'([^']+)')?\s*\}/g;
    for (const entryMatch of entriesSource.matchAll(entryPattern)) {
      entries.push({
        key: entryMatch[1],
        elementId: entryMatch[2],
        property: entryMatch[3],
        fallback: parseDashboardSettingFallback(entryMatch[4]),
        event: entryMatch[5],
        previewElementId: entryMatch[6] || '',
      });
    }

    const unmatchedEntry = entriesSource.replace(entryPattern, '').includes('{');
    if (unmatchedEntry) {
      errors.push(`Dashboard schema-driven section "${sectionName}" contains an unparsable setting entry`);
    }
    if (entries.length === 0) {
      errors.push(`Dashboard schema-driven section "${sectionName}" does not declare any setting entries`);
    }
    sections.set(sectionName, entries);
  }

  if (sections.size === 0) {
    errors.push('Dashboard schema-driven setting sections declaration does not contain any sections');
  }

  return { sections, errors };
}

function expectedDashboardPropertyForControl(control) {
  return control === 'checkbox' ? 'checked' : 'value';
}

function validateDashboardSchemaDrivenSections(metadata, dashboardHtml, dashboardSource) {
  const errors = [];
  const { sections, errors: parseErrors } = parseDashboardSchemaDrivenSections(dashboardSource);
  errors.push(...parseErrors);

  for (const [sectionName, entries] of sections.entries()) {
    const seenKeys = new Set();
    for (const entry of entries) {
      if (seenKeys.has(entry.key)) {
        errors.push(`Dashboard schema-driven section "${sectionName}" duplicates setting "${entry.key}"`);
        continue;
      }
      seenKeys.add(entry.key);

      const schemaEntry = metadata[entry.key];
      if (!schemaEntry) {
        errors.push(`Dashboard schema-driven setting "${entry.key}" is missing settings-schema metadata`);
        continue;
      }
      if (schemaEntry.elementId !== entry.elementId) {
        errors.push(`Dashboard schema-driven setting "${entry.key}" elementId "${entry.elementId}" does not match settings-schema metadata`);
      }
      const expectedProperty = expectedDashboardPropertyForControl(schemaEntry.control);
      if (entry.property !== expectedProperty) {
        errors.push(`Dashboard schema-driven setting "${entry.key}" property "${entry.property}" should be "${expectedProperty}" for ${schemaEntry.control} controls`);
      }
      if (!['blur', 'change'].includes(entry.event)) {
        errors.push(`Dashboard schema-driven setting "${entry.key}" event "${entry.event}" is not supported`);
      }
      if (entry.fallback && typeof entry.fallback === 'object' && entry.fallback.unsupportedLiteral) {
        errors.push(`Dashboard schema-driven setting "${entry.key}" uses unsupported fallback literal "${entry.fallback.unsupportedLiteral}"`);
      }
      if (Object.prototype.hasOwnProperty.call(schemaEntry, 'default')) {
        const expectedFallback = schemaEntry.default;
        if (JSON.stringify(entry.fallback) !== JSON.stringify(expectedFallback)) {
          errors.push(`Dashboard schema-driven setting "${entry.key}" fallback does not match settings-schema default`);
        }
      }
      if (schemaEntry.control === 'select') {
        const values = new Set((schemaEntry.options || []).map(option => String(option.value)));
        if (!values.has(String(entry.fallback))) {
          errors.push(`Dashboard schema-driven setting "${entry.key}" fallback is not a listed schema option`);
        }
      }
      const element = findDashboardElement(dashboardHtml, entry.elementId);
      if (!element) {
        errors.push(`Dashboard schema-driven setting "${entry.key}" elementId "${entry.elementId}" was not found in pages/dashboard.html`);
      }
      if (entry.previewElementId && !findDashboardElement(dashboardHtml, entry.previewElementId)) {
        errors.push(`Dashboard schema-driven setting "${entry.key}" previewElementId "${entry.previewElementId}" was not found in pages/dashboard.html`);
      }
    }
  }

  return {
    errors,
    count: [...sections.values()].reduce((sum, entries) => sum + entries.length, 0),
  };
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
  const dashboardSource = readFileSync(paths.dashboard, 'utf8');
  const { sections: schemaDrivenDashboardSections } = parseDashboardSchemaDrivenSections(dashboardSource);
  const schemaDrivenDashboardKeys = [...schemaDrivenDashboardSections.values()]
    .flat()
    .map(entry => entry.key);
  const dashboardSaveKeys = [...new Set([
    ...extractDashboardSaveKeys(dashboardSource),
    ...schemaDrivenDashboardKeys,
  ])].sort();
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
  const schemaDrivenSections = validateDashboardSchemaDrivenSections(metadata, dashboardHtml, dashboardSource);
  errors.push(...schemaDrivenSections.errors);

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      defaults: defaultKeys.length,
      typeKeys: typeKeys.length,
      dashboardSaveKeys: dashboardSaveKeys.length,
      classified: classified.size,
      metadata: Object.keys(metadata).length,
      schemaDrivenSettings: schemaDrivenSections.count,
    },
    defaultKeys,
    typeKeys,
    dashboardSaveKeys,
  };
}

export function formatSettingsSchemaReport(report) {
  const summary = `${report.counts.defaults} defaults, ${report.counts.typeKeys} typed keys, ${report.counts.dashboardSaveKeys} dashboard-save keys, ${report.counts.classified} classified keys, ${report.counts.metadata} metadata entries, ${report.counts.schemaDrivenSettings || 0} schema-driven dashboard settings`;
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
