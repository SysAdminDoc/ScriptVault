/**
 * Import/Export — export and import scripts as JSON or ZIP archives.
 *
 * Extracted from background.core.js (lines 505-805) — logic is kept identical.
 */

import type { Script, ScriptMeta } from '../types/script';
import type { Settings } from '../types/settings';
import { ScriptStorage, ScriptValues, SettingsManager } from '../modules/storage';
import { ScriptConfig } from '../modules/script-config';
import { parseUserscript } from './parser';

// ---------------------------------------------------------------------------
// External globals available in the service-worker context
// ---------------------------------------------------------------------------

declare const fflate: {
  strToU8(str: string): Uint8Array;
  strFromU8(data: Uint8Array): string;
  zipSync(
    data: Record<string, Uint8Array>,
    opts?: { level?: number },
  ): Uint8Array;
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
  unzipSync(
    data: Uint8Array,
    opts?: { filter?: (file: { name: string; size: number; originalSize: number; compression: number }) => boolean },
  ): Record<string, Uint8Array>;
};

// Functions defined in background.core.js but not yet migrated
declare function registerAllScripts(force?: boolean): Promise<void>;
declare function generateId(): string;
declare function updateBadge(): Promise<void>;
declare function ensurePersistentStorageForScriptWrite(reason: string, code?: string): Promise<void>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportOptions {
  overwrite?: boolean;
  importSettings?: boolean;
  importStorage?: boolean;
  importSettingsCredentials?: boolean;
  trustImportedScripts?: boolean;
  sourceLabel?: string;
}

interface ImportResults {
  imported: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
  warnings?: Array<{ name: string; warning: string }>;
  unmappedSettings?: Array<{ name: string; keys: string[] }>;
  storageImported?: number;
  settingsImported?: boolean;
  settingsCredentialsImported?: boolean;
  skippedSettingsCredentialKeys?: string[];
  skippedSettingsSecurityKeys?: string[];
  skippedSettingsUnknownKeys?: string[];
  skippedSettingsTypeKeys?: string[];
  quarantinedScripts?: number;
  preservedDisabledScripts?: number;
  trustedEnabledScripts?: number;
  error?: string;
}

interface ExportedScript {
  id: string;
  code: string;
  enabled: boolean;
  position: number;
  createdAt: number;
  updatedAt: number;
}

interface ExportData {
  version: number;
  exportedAt: string;
  settings?: Partial<Settings>;
  settingsCredentialsIncluded?: boolean;
  redactedSettingsCredentialKeys?: string[];
  scripts: ExportedScript[];
}

interface ImportScriptEntry {
  id: string;
  code: string;
  enabled?: boolean;
  position?: number;
  createdAt?: number;
  updatedAt?: number;
}

interface ImportData {
  scripts?: ImportScriptEntry[];
  settings?: Partial<Settings>;
  settingsCredentialsIncluded?: boolean;
}

interface ExportAllOptions {
  includeSettings?: boolean;
  includeSettingsCredentials?: boolean;
}

interface ZipExportResult {
  zipData: string;
  filename: string;
}

interface TampermonkeyOptions {
  scriptId?: string;
  settings?: {
    enabled?: boolean;
    'run-at'?: string;
    override?: {
      use_includes: string[];
      use_matches: string[];
      use_excludes: string[];
      use_connects: string[];
      merge_includes: boolean;
      merge_matches: boolean;
      merge_excludes: boolean;
      merge_connects: boolean;
    };
  };
  meta?: {
    name: string;
    namespace: string;
    version: string;
    description: string;
    author: string;
    match: string[];
    include: string[];
    exclude: string[];
    grant: string[];
    require: string[];
    resource: Record<string, string>;
  };
  scriptVault?: {
    schemaVersion: number;
    createdAt: number | null;
    updatedAt: number | null;
    position: number | null;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const ARCHIVE_MAX_SCRIPT_BYTES = 5 * 1024 * 1024;
const ARCHIVE_MAX_COMPRESSED_BYTES = 20 * 1024 * 1024;
const ARCHIVE_MAX_ENTRIES = 300;
const ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;
const ARCHIVE_MAX_ENTRY_BYTES = 10 * 1024 * 1024;
const ARCHIVE_MAX_JSON_ENTRY_BYTES = 5 * 1024 * 1024;
const ARCHIVE_MAX_OPTIONS_BYTES = 512 * 1024;
const ARCHIVE_MAX_COMPRESSION_RATIO = 100;

interface ArchiveEntryMeta {
  name: string;
  size?: number;
  originalSize?: number;
  compression?: number;
}

interface ArchiveValidationState {
  entries: number;
  totalUncompressedBytes: number;
}

function archiveIntakeError(message: string): Error {
  return new Error(`Backup archive rejected: ${message}`);
}

function formatArchiveBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function normalizeArchiveEntryName(name: unknown): string {
  return typeof name === 'string' ? name.replace(/\\/g, '/').trim() : '';
}

function archiveEntryLimit(name: string): number {
  if (name.endsWith('.user.js') || (!name.includes('/') && name.endsWith('.js'))) {
    return ARCHIVE_MAX_SCRIPT_BYTES;
  }
  if (name.endsWith('.options.json') || name === 'global-settings.metadata.json') {
    return ARCHIVE_MAX_OPTIONS_BYTES;
  }
  if (
    name.endsWith('.storage.json') ||
    name === 'global-settings.json' ||
    name === 'folders.json' ||
    name === 'workspaces.json'
  ) {
    return ARCHIVE_MAX_JSON_ENTRY_BYTES;
  }
  return ARCHIVE_MAX_ENTRY_BYTES;
}

function validateArchiveEntryMeta(
  rawEntry: ArchiveEntryMeta,
  state: ArchiveValidationState,
): boolean {
  const name = normalizeArchiveEntryName(rawEntry.name);
  if (!name) throw archiveIntakeError('entry name is missing.');
  if (name.startsWith('/') || name.includes('../') || name.includes('/..')) {
    throw archiveIntakeError(`entry ${name} uses an unsafe path.`);
  }
  if (/\.(zip|xpi|crx)$/i.test(name)) {
    throw archiveIntakeError(`nested archive entry ${name} is not allowed.`);
  }

  state.entries++;
  if (state.entries > ARCHIVE_MAX_ENTRIES) {
    throw archiveIntakeError(`too many files (${state.entries}). Maximum is ${ARCHIVE_MAX_ENTRIES}.`);
  }

  const compressedBytes = Number(rawEntry.size ?? 0);
  const uncompressedBytes = Number(rawEntry.originalSize ?? compressedBytes);
  if (!Number.isFinite(uncompressedBytes) || uncompressedBytes < 0) {
    throw archiveIntakeError(`entry ${name} has an invalid uncompressed size.`);
  }
  const entryLimit = archiveEntryLimit(name);
  if (uncompressedBytes > entryLimit) {
    throw archiveIntakeError(`${name} is too large (${formatArchiveBytes(uncompressedBytes)}). Maximum is ${formatArchiveBytes(entryLimit)}.`);
  }
  state.totalUncompressedBytes += uncompressedBytes;
  if (state.totalUncompressedBytes > ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES) {
    throw archiveIntakeError(`expanded data exceeds ${formatArchiveBytes(ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES)}.`);
  }
  if (
    Number.isFinite(compressedBytes) &&
    compressedBytes > 0 &&
    uncompressedBytes / compressedBytes > ARCHIVE_MAX_COMPRESSION_RATIO
  ) {
    throw archiveIntakeError(`${name} compression ratio is too high.`);
  }
  return true;
}

function archiveInputToBytes(input: string | ArrayBuffer | Uint8Array): Uint8Array {
  let zipBytes: Uint8Array;
  if (typeof input === 'string') {
    const maxBase64Length = Math.ceil((ARCHIVE_MAX_COMPRESSED_BYTES * 4) / 3) + 8;
    if (input.length > maxBase64Length) {
      throw archiveIntakeError(`compressed payload exceeds ${formatArchiveBytes(ARCHIVE_MAX_COMPRESSED_BYTES)}.`);
    }
    const binaryString = atob(input);
    zipBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      zipBytes[i] = binaryString.charCodeAt(i);
    }
  } else if (input instanceof ArrayBuffer) {
    zipBytes = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    zipBytes = input;
  } else {
    throw archiveIntakeError('compressed payload must be base64 or bytes.');
  }
  if (zipBytes.byteLength > ARCHIVE_MAX_COMPRESSED_BYTES) {
    throw archiveIntakeError(`compressed payload exceeds ${formatArchiveBytes(ARCHIVE_MAX_COMPRESSED_BYTES)}.`);
  }
  return zipBytes;
}

function validateUnzippedArchive(files: Record<string, Uint8Array>): void {
  const state: ArchiveValidationState = { entries: 0, totalUncompressedBytes: 0 };
  for (const [name, data] of Object.entries(files)) {
    validateArchiveEntryMeta(
      {
        name,
        size: data.byteLength,
        originalSize: data.byteLength,
        compression: 0,
      },
      state,
    );
  }
}

function unzipArchiveBounded(input: string | ArrayBuffer | Uint8Array): Record<string, Uint8Array> {
  const zipBytes = archiveInputToBytes(input);
  const state: ArchiveValidationState = { entries: 0, totalUncompressedBytes: 0 };
  const files = fflate.unzipSync(zipBytes, {
    filter(file) {
      return validateArchiveEntryMeta(file, state);
    },
  });
  validateUnzippedArchive(files);
  return files;
}

function archiveEntryBytes(
  files: Record<string, Uint8Array>,
  name: string,
  maxBytes = archiveEntryLimit(name),
): Uint8Array | undefined {
  const data = files[name];
  if (!data) return undefined;
  if (data.byteLength > maxBytes) {
    throw archiveIntakeError(`${name} is too large (${formatArchiveBytes(data.byteLength)}). Maximum is ${formatArchiveBytes(maxBytes)}.`);
  }
  return data;
}

function archiveEntryText(
  files: Record<string, Uint8Array>,
  name: string,
  maxBytes = archiveEntryLimit(name),
): string {
  const data = archiveEntryBytes(files, name, maxBytes);
  if (!data) throw archiveIntakeError(`${name} is missing.`);
  return fflate.strFromU8(data);
}

function parseArchiveJson<T>(
  files: Record<string, Uint8Array>,
  name: string,
  maxBytes = archiveEntryLimit(name),
): T {
  return JSON.parse(archiveEntryText(files, name, maxBytes)) as T;
}

const RESERVED_IMPORT_VALUE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isImportValueMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeImportedValueMap(value: unknown): Record<string, unknown> {
  if (!isImportValueMap(value)) return {};
  const hasDataEnvelope = Object.prototype.hasOwnProperty.call(value, 'data');
  const candidate = hasDataEnvelope ? value.data : value;
  if (!isImportValueMap(candidate)) return {};

  const sanitized: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(candidate)) {
    if (RESERVED_IMPORT_VALUE_KEYS.has(key)) continue;
    sanitized[key] = entryValue;
  }
  return sanitized;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validateJsonImportBudget(data: ImportData): { error: string } | null {
  const scripts = Array.isArray(data.scripts) ? data.scripts : [];
  if (scripts.length > ARCHIVE_MAX_ENTRIES) {
    return {
      error: `JSON import has too many scripts (${scripts.length}). Maximum is ${ARCHIVE_MAX_ENTRIES}.`,
    };
  }
  let totalBytes = 0;
  for (const script of scripts) {
    const code = typeof script?.code === 'string' ? script.code : '';
    const bytes = utf8ByteLength(code);
    if (bytes > ARCHIVE_MAX_SCRIPT_BYTES) {
      return {
        error: `Script ${script?.id || '<unknown>'} is too large (${formatArchiveBytes(bytes)}). Maximum is ${formatArchiveBytes(ARCHIVE_MAX_SCRIPT_BYTES)}.`,
      };
    }
    totalBytes += bytes;
    if (totalBytes > ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES) {
      return {
        error: `JSON import exceeds ${formatArchiveBytes(ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES)}.`,
      };
    }
  }
  return null;
}

// Portable settings are an untrusted input boundary. Keep this policy aligned
// with src/config/settings-schema.json: only visible settings and explicitly
// opted-in credential fields may cross the boundary. Runtime/internal state is
// intentionally absent, so a backup cannot seed stale caches or trust stores.
const SETTINGS_IMPORT_TYPE_KEYS = {
  string: new Set([
    'allowCommunication', 'allowCookies', 'allowHttpHeaders', 'allowLocalFiles',
    'autoUpdateMode', 'badgeColor', 'badgeInfo', 'blacklistSource',
    'blacklistedPages', 'checkConnect', 'configMode', 'contentScriptAPI',
    'customCss', 'defaultTabTypes', 'downloadMode', 'downloadWhitelist',
    'dropboxClientId', 'dropboxRefreshToken', 'dropboxToken', 'editorKeyMap',
    'editorTheme', 'googleClientId', 'googleDriveRefreshToken', 'googleDriveToken',
    'highlightMatches', 'includeMode', 'incognitoStorage', 'indentWith',
    'keyMapping', 'language', 'layout', 'lintMaxSize', 'linterConfig',
    'loggingLevel', 'manualBlacklist', 'modifyCSP', 'onedriveClientId',
    'onedriveRefreshToken', 'onedriveToken', 'pageFilterMode', 's3AccessKeyId',
    's3Bucket', 's3Endpoint', 's3ObjectKey', 's3Region', 's3SecretKey',
    'sandboxMode', 'scriptOrder', 'searchIntegration', 'sri', 'statsUrlRetention',
    'strictMode', 'syncEncryptionPassphrase', 'syncProvider', 'tabMode', 'theme',
    'topLevelAwait', 'trashMode', 'webdavPassword', 'webdavUrl', 'webdavUsername',
    'whitelistedPages',
  ]),
  number: new Set([
    'blockSeverity', 'checkInterval', 'dashboardVirtualizationThreshold',
    'editorFontSize', 'editorTabSize', 'externalsInterval', 'indentWidth',
    'notifyHideAfter', 'popupColumns', 'subscriptionRefreshInterval',
    'syncEncryptionKdfIterations', 'syncInterval', 'tabSize', 'updateInterval',
    'xhrTimeout',
  ]),
  boolean: new Set([
    'allowHighPrivilegeScriptApis', 'allowInternalSyncEndpoints', 'allowInternalXhr',
    'autoReload', 'autoSave', 'autoUpdate', 'badgeErrorStates', 'contextMenuCommands',
    'contextMenuRunAt', 'debugMode', 'editorAutoCloseBrackets', 'editorAutoComplete',
    'editorHighlightActiveLine', 'editorLineWrapping', 'editorMatchBrackets',
    'editorShowInvisibles', 'enableContextMenu', 'enableEditor', 'enableTags',
    'enabled', 'experimentalESMUserscripts', 'hideDisabledPopup',
    'highlightTrailingWhitespace', 'injectIntoFrames', 'lintOnType', 'noSaveConfirm',
    'notifyOnError', 'notifyOnInstall', 'notifyOnUpdate', 'onDeviceAiEnabled',
    'reindent', 's3PathStyle', 'scopedHostPermissions', 'showBadge', 'showFixedSource',
    'subscriptionAutoRefresh', 'syncCredentialsSessionOnly', 'syncEnabled',
    'syncEncryptionEnabled', 'syncHoldExecutionUntilFirstSync', 'trimWhitespace',
    'updateDisabled', 'wordWrap',
  ]),
  array: new Set(['blacklist', 'deniedHosts']),
  object: new Set(['findScriptsSources', 'trustedSigningKeys']),
};

const SETTINGS_IMPORT_SECURITY_KEYS = new Set([
  'allowInternalXhr',
  'allowInternalSyncEndpoints',
  'allowHighPrivilegeScriptApis',
  'trustedSigningKeys',
  'deniedHosts',
  'blacklist',
  'scopedHostPermissions',
]);

const SETTINGS_CREDENTIAL_KEYS: Array<keyof Settings> = [
  'googleClientId',
  'webdavUsername',
  'webdavPassword',
  'googleDriveToken',
  'googleDriveRefreshToken',
  'dropboxClientId',
  'dropboxToken',
  'dropboxRefreshToken',
  'onedriveClientId',
  'onedriveToken',
  'onedriveRefreshToken',
  'syncEncryptionPassphrase',
  's3AccessKeyId',
  's3SecretKey',
  'trustedSigningKeys',
];

function getSettingsImportType(key: string): string | null {
  for (const [type, keys] of Object.entries(SETTINGS_IMPORT_TYPE_KEYS)) {
    if (keys.has(key)) return type;
  }
  return null;
}

function isSettingsImportValue(value: unknown, type: string): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function cloneSettingsForTransfer(value: unknown): Partial<Settings> {
  if (!value || typeof value !== 'object') return {};
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value) as Partial<Settings>;
    } catch (_) {
      // Fall through.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as Partial<Settings>;
  } catch (_) {
    return { ...(value as Partial<Settings>) };
  }
}

function redactSettingsCredentials(
  settings: unknown,
  options: { includeCredentials?: boolean } = {},
): {
  settings: Partial<Settings>;
  settingsCredentialsIncluded: boolean;
  redactedSettingsCredentialKeys: string[];
} {
  const includeCredentials = options.includeCredentials === true;
  const sanitized = cloneSettingsForTransfer(settings);
  const redactedSettingsCredentialKeys: string[] = [];
  if (!includeCredentials) {
    for (const key of SETTINGS_CREDENTIAL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
        delete sanitized[key];
        redactedSettingsCredentialKeys.push(key);
      }
    }
  }
  return {
    settings: sanitized,
    settingsCredentialsIncluded: includeCredentials,
    redactedSettingsCredentialKeys,
  };
}

function prepareSettingsForPortableImport(
  settings: unknown,
  options: { allowCredentials?: boolean } = {},
): {
  settings: Partial<Settings>;
  settingsCredentialsImported: boolean;
  skippedSettingsCredentialKeys: string[];
  skippedSettingsSecurityKeys: string[];
  skippedSettingsUnknownKeys: string[];
  skippedSettingsTypeKeys: string[];
} {
  const allowCredentials = options.allowCredentials === true;
  const candidate = cloneSettingsForTransfer(settings) as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const skippedSettingsCredentialKeys: string[] = [];
  const skippedSettingsSecurityKeys: string[] = [];
  const skippedSettingsUnknownKeys: string[] = [];
  const skippedSettingsTypeKeys: string[] = [];
  for (const [key, value] of Object.entries(candidate)) {
    const expectedType = getSettingsImportType(key);
    if (!expectedType) {
      skippedSettingsUnknownKeys.push(key);
      continue;
    }
    if (SETTINGS_IMPORT_SECURITY_KEYS.has(key)) {
      skippedSettingsSecurityKeys.push(key);
      continue;
    }
    if (SETTINGS_CREDENTIAL_KEYS.includes(key as keyof Settings) && !allowCredentials) {
      skippedSettingsCredentialKeys.push(key);
      continue;
    }
    if (!isSettingsImportValue(value, expectedType)) {
      skippedSettingsTypeKeys.push(key);
      continue;
    }
    sanitized[key] = value;
  }
  return {
    settings: sanitized as Partial<Settings>,
    settingsCredentialsImported: allowCredentials,
    skippedSettingsCredentialKeys,
    skippedSettingsSecurityKeys,
    skippedSettingsUnknownKeys,
    skippedSettingsTypeKeys,
  };
}

export async function exportAllScripts(
  options: ExportAllOptions = {},
): Promise<ExportData> {
  const {
    includeSettings = true,
    includeSettingsCredentials = false,
  } = options;
  const scripts: Script[] = await ScriptStorage.getAll();
  const settingsExport = includeSettings
    ? redactSettingsCredentials(await SettingsManager.get(), {
        includeCredentials: includeSettingsCredentials,
      })
    : null;

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    ...(includeSettings && settingsExport
      ? {
          settings: settingsExport.settings,
          settingsCredentialsIncluded: settingsExport.settingsCredentialsIncluded,
          redactedSettingsCredentialKeys: settingsExport.redactedSettingsCredentialKeys,
        }
      : {}),
    scripts: scripts.map((s: Script) => ({
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  };
}

const RESERVED_IMPORT_SCRIPT_IDS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeImportedScriptId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    /^script_[A-Za-z0-9._:-]{1,160}$/.test(id) &&
    !RESERVED_IMPORT_SCRIPT_IDS.has(id)
  );
}

function allocateImportedScriptId(preferredId: unknown, usedScriptIds: Set<string>): string {
  if (isSafeImportedScriptId(preferredId) && !usedScriptIds.has(preferredId)) {
    return preferredId;
  }
  let nextId: string;
  do {
    nextId = generateId();
  } while (usedScriptIds.has(nextId));
  return nextId;
}

function finiteBackupNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function applyImportedScriptTrust(
  settings: Record<string, unknown> | undefined,
  archiveEnabled: boolean,
  options: { trustImportedScripts?: boolean; source?: string; sourceLabel?: string } = {},
): { enabled: boolean; settings: Record<string, unknown>; disposition: string } {
  const nextSettings = settings && typeof settings === 'object' ? { ...settings } : {};
  delete nextSettings._importQuarantine;
  delete nextSettings._importTrust;
  if (archiveEnabled === false) {
    return { enabled: false, settings: nextSettings, disposition: 'preserved-disabled' };
  }
  if (options.trustImportedScripts === true) {
    nextSettings._importTrust = {
      source: options.source || 'import',
      sourceLabel: options.sourceLabel || '',
      reviewedAt: Date.now(),
      archiveEnabled: true,
    };
    return { enabled: true, settings: nextSettings, disposition: 'trusted-enabled' };
  }
  nextSettings._importQuarantine = {
    source: options.source || 'import',
    sourceLabel: options.sourceLabel || '',
    importedAt: Date.now(),
    archiveEnabled: true,
  };
  return { enabled: false, settings: nextSettings, disposition: 'quarantined' };
}

function countImportTrustDisposition(results: ImportResults, disposition: string): void {
  if (disposition === 'quarantined') {
    results.quarantinedScripts = (results.quarantinedScripts || 0) + 1;
  } else if (disposition === 'preserved-disabled') {
    results.preservedDisabledScripts = (results.preservedDisabledScripts || 0) + 1;
  } else if (disposition === 'trusted-enabled') {
    results.trustedEnabledScripts = (results.trustedEnabledScripts || 0) + 1;
  }
}

const IMPORT_RUN_AT_VALUES = new Set([
  'default', 'document-start', 'document-body', 'document-end', 'document-idle', 'context-menu',
]);
const IMPORT_INJECT_INTO_VALUES = new Set(['auto', 'page', 'content']);
const IMPORT_SETTING_ALIASES: Record<string, string[]> = {
  runAt: ['runAt', 'run-at', 'run_at'],
  injectInto: ['injectInto', 'inject-into', 'inject_into'],
  frameMode: ['frameMode', 'frame-mode', 'frame_mode'],
  autoUpdate: ['autoUpdate', 'shouldUpdate', 'should-update'],
  notifyUpdates: ['notifyUpdates', 'notify-updates'],
  notifyErrors: ['notifyErrors', 'notify-errors'],
  useOriginalMatches: ['useOriginalMatches', 'use-original-matches', 'merge_matches', 'mergeMatches'],
  useOriginalIncludes: ['useOriginalIncludes', 'use-original-includes', 'merge_includes', 'mergeIncludes'],
  useOriginalExcludes: ['useOriginalExcludes', 'use-original-excludes', 'merge_excludes', 'mergeExcludes'],
  userMatches: ['userMatches', 'user_matches', 'customMatches', 'use_matches'],
  userIncludes: ['userIncludes', 'user_includes', 'customIncludes', 'use_includes'],
  userExcludes: ['userExcludes', 'user_excludes', 'customExcludes', 'use_excludes'],
};
const IMPORT_RECOGNIZED_SETTING_KEYS = new Set([
  'enabled', 'position', 'id', 'scriptId', 'createdAt', 'updatedAt', 'schemaVersion',
  ...Object.values(IMPORT_SETTING_ALIASES).flat(), 'noframes',
  'config', 'custom', 'options', 'settings', 'storage', 'userConfig', 'values', 'vars',
  'override', 'overrides', 'scriptVault', 'meta', 'props', 'code', 'source', 'content',
]);

function isImportRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function collectImportSettingRecords(sources: unknown[]): Array<{ value: Record<string, unknown>; label: string }> {
  const records: Array<{ value: Record<string, unknown>; label: string }> = [];
  const visited = new Set<object>();
  let visitedObjects = 0;
  const visit = (value: unknown, label: string, depth: number): void => {
    if (!isImportRecord(value) || depth > 3 || visitedObjects >= 64 || visited.has(value)) return;
    visited.add(value);
    visitedObjects++;
    records.push({ value, label });
    for (const key of ['config', 'settings', 'options', 'custom', 'override', 'overrides']) {
      if (isImportRecord(value[key])) visit(value[key], key, depth + 1);
    }
  };
  for (const source of sources) {
    if (isImportRecord(source) && 'value' in source && 'label' in source) {
      visit(source.value, String(source.label || 'source'), 0);
    } else {
      visit(source, 'source', 0);
    }
  }
  return records;
}

function findImportSetting(
  records: Array<{ value: Record<string, unknown>; label: string }>,
  aliases: string[],
): { found: boolean; key: string; value: unknown } {
  for (const record of records) {
    for (const key of aliases) {
      if (Object.prototype.hasOwnProperty.call(record.value, key)) {
        return { found: true, key, value: record.value[key] };
      }
    }
  }
  return { found: false, key: '', value: undefined };
}

function importPatternList(value: unknown, key: string, warnings: string[]): string[] | null {
  if (typeof value === 'boolean' && /^use_/.test(key)) return null;
  const entries = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(entries)) {
    warnings.push(`${key} must be an array or string`);
    return null;
  }
  const patterns: string[] = [];
  for (const entry of entries.slice(0, 200)) {
    if (typeof entry !== 'string' || !entry.trim() || entry.length > 2048) {
      warnings.push(`${key} contains an invalid pattern`);
      continue;
    }
    patterns.push(entry.trim());
  }
  if (entries.length > 200) warnings.push(`${key} contains more than 200 patterns; extras were ignored`);
  return patterns;
}

function mapImportedScriptSettings(
  meta: ScriptMeta,
  sources: unknown[],
): { settings: Record<string, unknown>; warnings: string[]; unmappedKeys: string[] } {
  const records = collectImportSettingRecords(sources);
  const settings: Record<string, unknown> = {};
  const warnings: string[] = [];
  const unmappedKeys = new Set<string>();
  const variableNames = new Set((meta.config || []).map(variable => variable.name));

  const mapBoolean = (settingKey: string, aliases: string[]): void => {
    const field = findImportSetting(records, aliases);
    if (!field.found) return;
    if (typeof field.value !== 'boolean') {
      warnings.push(`${field.key} must be a boolean`);
      unmappedKeys.add(field.key);
      return;
    }
    settings[settingKey] = field.value;
  };
  const mapString = (settingKey: string, aliases: string[], allowed: Set<string>): void => {
    const field = findImportSetting(records, aliases);
    if (!field.found) return;
    if (typeof field.value !== 'string' || !allowed.has(field.value)) {
      warnings.push(`${field.key} has an unsupported value`);
      unmappedKeys.add(field.key);
      return;
    }
    settings[settingKey] = field.value;
  };
  const mapPatterns = (settingKey: string, aliases: string[]): void => {
    const field = findImportSetting(records, aliases);
    if (!field.found || (typeof field.value === 'boolean' && /^use_/.test(field.key))) return;
    const patterns = importPatternList(field.value, field.key, warnings);
    if (patterns) settings[settingKey] = patterns;
    else unmappedKeys.add(field.key);
  };

  mapString('runAt', IMPORT_SETTING_ALIASES.runAt || [], IMPORT_RUN_AT_VALUES);
  mapString('injectInto', IMPORT_SETTING_ALIASES.injectInto || [], IMPORT_INJECT_INTO_VALUES);
  mapString('frameMode', IMPORT_SETTING_ALIASES.frameMode || [], new Set(['default', 'top', 'all']));
  mapBoolean('autoUpdate', IMPORT_SETTING_ALIASES.autoUpdate || []);
  mapBoolean('notifyUpdates', IMPORT_SETTING_ALIASES.notifyUpdates || []);
  mapBoolean('notifyErrors', IMPORT_SETTING_ALIASES.notifyErrors || []);
  mapBoolean('useOriginalMatches', IMPORT_SETTING_ALIASES.useOriginalMatches || []);
  mapBoolean('useOriginalIncludes', IMPORT_SETTING_ALIASES.useOriginalIncludes || []);
  mapBoolean('useOriginalExcludes', IMPORT_SETTING_ALIASES.useOriginalExcludes || []);
  mapPatterns('userMatches', IMPORT_SETTING_ALIASES.userMatches || []);
  mapPatterns('userIncludes', IMPORT_SETTING_ALIASES.userIncludes || []);
  mapPatterns('userExcludes', IMPORT_SETTING_ALIASES.userExcludes || []);

  const noframes = findImportSetting(records, ['noframes']);
  if (noframes.found) {
    if (typeof noframes.value === 'boolean') {
      if (noframes.value && !Object.prototype.hasOwnProperty.call(settings, 'frameMode')) settings.frameMode = 'top';
    } else {
      warnings.push('noframes must be a boolean');
      unmappedKeys.add(noframes.key);
    }
  }

  const configSources = sources.map(source => (
    isImportRecord(source) && 'value' in source && 'label' in source
      ? source.value
      : source
  ));
  const configResult = ScriptConfig.importValues(meta.config || [], configSources);
  if (configResult.matchedKeys.length > 0) settings.userConfig = configResult.values;
  for (const key of configResult.invalidKeys) {
    warnings.push(`${key} has an invalid @var value`);
    unmappedKeys.add(key);
  }
  if (configResult.rejectedKeys.length > 0) {
    warnings.push(`prototype-polluting config keys rejected: ${configResult.rejectedKeys.join(', ')}`);
  }

  for (const record of records) {
    if (!['config', 'settings', 'custom', 'options', 'override', 'overrides'].includes(record.label)) continue;
    for (const key of Object.keys(record.value)) {
      if (IMPORT_RECOGNIZED_SETTING_KEYS.has(key) || variableNames.has(key)) continue;
      unmappedKeys.add(key);
    }
  }

  return { settings, warnings, unmappedKeys: [...unmappedKeys].sort() };
}

function addImportDiagnostics(results: ImportResults, name: string, mapped: { warnings?: string[]; unmappedKeys?: string[] }): void {
  if (!Array.isArray(results.warnings)) results.warnings = [];
  if (!Array.isArray(results.unmappedSettings)) results.unmappedSettings = [];
  for (const warning of mapped.warnings || []) {
    if (results.warnings.length < 200) results.warnings.push({ name, warning });
  }
  if (mapped.unmappedKeys?.length && results.unmappedSettings.length < 200) {
    results.unmappedSettings.push({ name, keys: mapped.unmappedKeys.slice(0, 100) });
  }
}

function addImportStorageDiagnostics(results: ImportResults, name: string, values: unknown, sourcePresent: boolean): void {
  if (!sourcePresent) return;
  if (!isImportRecord(values)) {
    addImportDiagnostics(results, name, {
      warnings: ['stored values were present but were not an object and were ignored'],
      unmappedKeys: ['storage'],
    });
    return;
  }
  if (Object.keys(values).length > 0) results.storageImported = (results.storageImported || 0) + 1;
}

export async function importScripts(
  data: ImportData,
  options: ImportOptions = {},
): Promise<ImportResults | { error: string }> {
  const { overwrite = false, trustImportedScripts = false, sourceLabel = '' } = options;
  const results: ImportResults = {
    imported: 0,
    skipped: 0,
    errors: [],
    settingsImported: false,
    settingsCredentialsImported: false,
    skippedSettingsCredentialKeys: [],
    skippedSettingsSecurityKeys: [],
    skippedSettingsUnknownKeys: [],
    skippedSettingsTypeKeys: [],
    quarantinedScripts: 0,
    preservedDisabledScripts: 0,
    trustedEnabledScripts: 0,
  };

  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.scripts)) {
    return { error: 'Invalid import format' };
  }
  const budgetError = validateJsonImportBudget(data);
  if (budgetError) return budgetError;

  // Cache existing count once to avoid O(n²) getAll() inside the loop
  const allExistingScripts: Script[] = await ScriptStorage.getAll();
  const usedScriptIds = new Set(allExistingScripts.map((script) => script.id));
  let _importPosition: number = allExistingScripts.length;

  for (const script of data.scripts) {
    const rawScriptId: unknown = script && typeof script === 'object' ? script.id : undefined;
    const requestedScriptId: string = isSafeImportedScriptId(rawScriptId) ? rawScriptId : '';
    const errorName: string = requestedScriptId || (typeof rawScriptId === 'string' ? rawScriptId : '<unknown>');
    try {
      if (!script || typeof script.code !== 'string') {
        results.errors.push({ name: errorName, error: 'Invalid script entry' });
        continue;
      }

      const parsed = parseUserscript(script.code);
      if (parsed.error) {
        results.errors.push({ name: errorName, error: parsed.error });
        continue;
      }

      const existing: Script | null = requestedScriptId ? await ScriptStorage.get(requestedScriptId) : null;
      if (existing && !overwrite) {
        results.skipped++;
        continue;
      }

      const scriptId: string = existing?.id && isSafeImportedScriptId(existing.id)
        ? existing.id
        : allocateImportedScriptId(requestedScriptId, usedScriptIds);
      usedScriptIds.add(scriptId);
      const trustState = applyImportedScriptTrust({}, script.enabled !== false, {
        trustImportedScripts,
        source: 'import-json',
        sourceLabel: sourceLabel || 'JSON import',
      });
      countImportTrustDisposition(results, trustState.disposition);

      await ScriptStorage.set(scriptId, {
        id: scriptId,
        code: script.code,
        meta: parsed.meta,
        enabled: trustState.enabled,
        ...(Object.keys(trustState.settings).length > 0 ? { settings: trustState.settings } : {}),
        position: Number.isFinite(script.position) ? script.position : _importPosition++,
        createdAt: Number.isFinite(script.createdAt) ? script.createdAt : Date.now(),
        updatedAt: Number.isFinite(script.updatedAt) ? script.updatedAt : Date.now()
      } as Script);
      results.imported++;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      results.errors.push({ name: errorName, error: message });
    }
  }

  // Import settings if present
  if (data.settings && options.importSettings) {
    const settingsImport = prepareSettingsForPortableImport(data.settings, {
      allowCredentials:
        options.importSettingsCredentials === true &&
        data.settingsCredentialsIncluded === true,
    });
    await SettingsManager.set(settingsImport.settings);
    results.settingsImported = true;
    results.settingsCredentialsImported = settingsImport.settingsCredentialsImported;
    results.skippedSettingsCredentialKeys = settingsImport.skippedSettingsCredentialKeys;
    results.skippedSettingsSecurityKeys = settingsImport.skippedSettingsSecurityKeys;
    results.skippedSettingsUnknownKeys = settingsImport.skippedSettingsUnknownKeys;
    results.skippedSettingsTypeKeys = settingsImport.skippedSettingsTypeKeys;
  }

  // Re-register all scripts after import
  await registerAllScripts();
  await updateBadge();

  return results;
}

// Export to ZIP (Tampermonkey-compatible format)
export async function exportToZip(): Promise<ZipExportResult> {
  const scripts: Script[] = await ScriptStorage.getAll();
  const files: Record<string, Uint8Array> = {}; // fflate uses { filename: Uint8Array } format
  const usedNames = new Set<string>();

  for (const script of scripts) {
    // Create safe filename, deduplicating collisions
    let safeName: string = (script.meta.name || 'unnamed')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    if (usedNames.has(safeName)) {
      let counter = 2;
      while (usedNames.has(`${safeName}_${counter}`)) counter++;
      safeName = `${safeName}_${counter}`;
    }
    usedNames.add(safeName);

    // Add the userscript file
    files[`${safeName}.user.js`] = fflate.strToU8(script.code);

    // Add options.json (Tampermonkey format)
    const tmOptions: TampermonkeyOptions = {
      scriptId: script.id,
      settings: {
        enabled: script.enabled,
        'run-at': script.meta['run-at'] || 'document-idle',
        override: {
          use_includes: [],
          use_matches: [],
          use_excludes: [],
          use_connects: [],
          merge_includes: true,
          merge_matches: true,
          merge_excludes: true,
          merge_connects: true
        }
      },
      meta: {
        name: script.meta.name,
        namespace: script.meta.namespace || '',
        version: script.meta.version || '1.0',
        description: script.meta.description || '',
        author: script.meta.author || '',
        match: script.meta.match || [],
        include: script.meta.include || [],
        exclude: script.meta.exclude || [],
        grant: script.meta.grant || [],
        require: script.meta.require || [],
        resource: script.meta.resource || {}
      },
      scriptVault: {
        schemaVersion: 1,
        createdAt: finiteBackupNumber(script.createdAt),
        updatedAt: finiteBackupNumber(script.updatedAt),
        position: finiteBackupNumber(script.position)
      }
    };
    files[`${safeName}.options.json`] = fflate.strToU8(JSON.stringify(tmOptions, null, 2));

    // Add storage.json if script has stored values
    const values: Record<string, unknown> | null = await ScriptValues.getAll(script.id);
    if (values && Object.keys(values).length > 0) {
      const storage = { data: values };
      files[`${safeName}.storage.json`] = fflate.strToU8(JSON.stringify(storage, null, 2));
    }
  }

  // Generate zip as Uint8Array then convert to base64 in chunks (avoid stack overflow)
  const zipData: Uint8Array = fflate.zipSync(files, { level: 6 });
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < zipData.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(zipData.subarray(i, i + chunkSize)));
  }
  const base64: string = btoa(binary);
  return { zipData: base64, filename: `scriptvault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip` };
}

// Import from ZIP (supports Tampermonkey and other formats)
export async function importFromZip(
  zipData: string | ArrayBuffer | Uint8Array,
  options: ImportOptions = {},
): Promise<ImportResults> {
  const results: ImportResults = {
    imported: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    unmappedSettings: [],
    storageImported: 0,
    quarantinedScripts: 0,
    preservedDisabledScripts: 0,
    trustedEnabledScripts: 0,
  };
  const trustImportedScripts = options.trustImportedScripts === true;
  const sourceLabel = typeof options.sourceLabel === 'string' && options.sourceLabel.trim()
    ? options.sourceLabel.trim().slice(0, 512)
    : 'ZIP import';

  try {
    const unzipped: Record<string, Uint8Array> = unzipArchiveBounded(zipData);
    const fileNames: string[] = Object.keys(unzipped);

    // Find all .user.js files
    const userScripts: string[] = fileNames.filter(name => name.endsWith('.user.js'));
    const allExistingScripts: Script[] = await ScriptStorage.getAll();
    const usedScriptIds = new Set(allExistingScripts.map((script) => script.id));
    // Starting position for newly-imported scripts (avoids O(n²) getAll() per script)
    let _importPosition: number = allExistingScripts.length;

    for (const filename of userScripts) {
      try {
        const code: string = archiveEntryText(unzipped, filename, ARCHIVE_MAX_SCRIPT_BYTES);

        // Validate it's a userscript
        if (!code.includes('==UserScript==')) {
          results.errors.push({ name: filename, error: 'Not a valid userscript' });
          continue;
        }

        const parsed = parseUserscript(code);
        if (!parsed.meta) {
          results.errors.push({ name: filename, error: parsed.error ?? 'Parse failed' });
          continue;
        }

        const parsedMeta: ScriptMeta = parsed.meta;

        // Look for associated options and storage files
        const baseName: string = filename.replace('.user.js', '');
        const optionsFileData: Uint8Array | undefined = unzipped[`${baseName}.options.json`];
        const storageFileData: Uint8Array | undefined = unzipped[`${baseName}.storage.json`];

        let enabled = true;
        let storedValues: Record<string, unknown> = {};
        let preferredScriptId = '';
        let importedCreatedAt: number | null = null;
        let importedUpdatedAt: number | null = null;
        let importedPosition: number | null = null;
        let optionsData: Record<string, any> | null = null;
        let importedSettings: Record<string, unknown> = {};

        // Parse options file if exists
        if (optionsFileData) {
          try {
            optionsData = parseArchiveJson<{
              scriptId?: string;
              createdAt?: number;
              updatedAt?: number;
              position?: number;
              settings?: { enabled?: boolean };
              scriptVault?: {
                createdAt?: number;
                updatedAt?: number;
                position?: number;
                schemaVersion?: number;
                settings?: Record<string, unknown>;
              };
            }>(unzipped, `${baseName}.options.json`, ARCHIVE_MAX_OPTIONS_BYTES);
            enabled = optionsData.settings?.enabled !== false;
            preferredScriptId = isSafeImportedScriptId(optionsData.scriptId) ? optionsData.scriptId : '';
            importedCreatedAt = finiteBackupNumber(optionsData.scriptVault?.createdAt ?? optionsData.createdAt);
            importedUpdatedAt = finiteBackupNumber(optionsData.scriptVault?.updatedAt ?? optionsData.updatedAt);
            importedPosition = finiteBackupNumber(optionsData.scriptVault?.position ?? optionsData.position);
          } catch (e: unknown) {
            console.warn('Failed to parse options file:', e);
            addImportDiagnostics(results, filename, {
              warnings: ['options metadata could not be parsed and was ignored'],
              unmappedKeys: ['options'],
            });
          }
        }

        // Parse storage file if exists
        if (storageFileData) {
          try {
            storedValues = sanitizeImportedValueMap(parseArchiveJson<unknown>(
              unzipped,
              `${baseName}.storage.json`,
              ARCHIVE_MAX_JSON_ENTRY_BYTES,
            ));
            addImportStorageDiagnostics(results, filename, storedValues, true);
          } catch (e: unknown) {
            console.warn('Failed to parse storage file:', e);
            addImportDiagnostics(results, filename, {
              warnings: ['stored values could not be parsed and were ignored'],
              unmappedKeys: ['storage'],
            });
          }
        }

        const isScriptVaultArchive = optionsData?.scriptVault?.schemaVersion === 1;
        const settingSources = optionsData
          ? (isScriptVaultArchive
            ? [{ value: optionsData.scriptVault?.settings || {}, label: 'scriptVault' }]
            : [{ value: optionsData, label: 'options' }])
          : [];
        const mapped = mapImportedScriptSettings(parsedMeta, [
          ...settingSources,
          { value: storedValues, label: 'storage' },
        ]);
        importedSettings = mapped.settings;
        addImportDiagnostics(results, filename, mapped);

        // Prefer ScriptVault's stable scriptId metadata when present. Name or
        // namespace can change over time, but backup restore should still
        // update the same script record.
        const existingById: Script | undefined = preferredScriptId
          ? allExistingScripts.find(s => s.id === preferredScriptId)
          : undefined;
        const existing: Script | undefined = existingById ?? allExistingScripts.find(s =>
          s.meta.name === parsedMeta.name &&
          (s.meta.namespace === parsedMeta.namespace || (!s.meta.namespace && !parsedMeta.namespace))
        );

        if (existing && !options.overwrite) {
          results.skipped++;
          continue;
        }

        // Create or update script
        let scriptId: string;
        if (existing?.id && isSafeImportedScriptId(existing.id)) {
          scriptId = existing.id;
        } else {
          scriptId = allocateImportedScriptId(preferredScriptId, usedScriptIds);
        }
        usedScriptIds.add(scriptId);
        const now = Date.now();
        const nextImportedSettings: Record<string, unknown> = {
          ...(existing?.settings || {}),
          ...importedSettings,
        };
        if (existing?.settings?.userConfig && importedSettings.userConfig) {
          nextImportedSettings.userConfig = {
            ...existing.settings.userConfig,
            ...(importedSettings.userConfig as Record<string, unknown>),
          };
        }
        const trustState = applyImportedScriptTrust(nextImportedSettings, enabled, {
          trustImportedScripts,
          source: 'import-zip',
          sourceLabel,
        });
        countImportTrustDisposition(results, trustState.disposition);
        const script: Script = {
          id: scriptId,
          code: code,
          meta: parsedMeta,
          enabled: trustState.enabled,
          position: existing?.position ?? (importedPosition ?? _importPosition++),
          createdAt: finiteBackupNumber(existing?.createdAt) ?? importedCreatedAt ?? now,
          updatedAt: importedUpdatedAt ?? now
        };
        if (Object.keys(trustState.settings).length > 0) {
          script.settings = trustState.settings;
        }

        await ScriptStorage.set(scriptId, script);

        // Import stored values
        if (Object.keys(storedValues).length > 0) {
          await ScriptValues.setAll(scriptId, storedValues);
        }

        results.imported++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        results.errors.push({ name: filename, error: message });
      }
    }

    // If no .user.js files found, try importing raw JS files
    if (userScripts.length === 0) {
      const jsFiles: string[] = fileNames.filter(name =>
        name.endsWith('.js') && !name.includes('/')
      );

      for (const filename of jsFiles) {
        try {
          const code: string = archiveEntryText(unzipped, filename, ARCHIVE_MAX_SCRIPT_BYTES);
          if (!code.includes('==UserScript==')) continue;

          const parsed = parseUserscript(code);
          if (parsed.error) continue;

          const scriptId: string = generateId();
          const trustState = applyImportedScriptTrust({}, true, {
            trustImportedScripts,
            source: 'import-zip-raw',
            sourceLabel,
          });
          countImportTrustDisposition(results, trustState.disposition);
          const script: Script = {
            id: scriptId,
            code: code,
            meta: parsed.meta,
            enabled: trustState.enabled,
            position: _importPosition++,
            createdAt: Date.now(),
            updatedAt: Date.now()
          } as Script;
          if (Object.keys(trustState.settings).length > 0) {
            script.settings = trustState.settings;
          }
          await ScriptStorage.set(scriptId, {
            ...script,
          } as Script);
          results.imported++;
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          results.errors.push({ name: filename, error: message });
        }
      }
    }

    await updateBadge();

    // Re-register all scripts after import
    await registerAllScripts();

    return results;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[ScriptVault] importFromZip error:', e);
    return { ...results, error: message };
  }
}

type VendorBackupType = 'tampermonkey' | 'violentmonkey' | 'greasemonkey';

interface VendorBackupCandidate {
  code: string;
  archiveEnabled: boolean;
  sourceName: string;
  settings?: Record<string, unknown>;
  custom?: Record<string, unknown>;
  values?: unknown;
  raw?: Record<string, unknown>;
}

function splitVendorUserscriptText(text: string): VendorBackupCandidate[] {
  return String(text || '')
    .split(/\n\s*\n(?=\/\/\s*==UserScript==)/)
    .map(part => part.trim())
    .filter(part => part.includes('==UserScript==') && part.includes('==/UserScript=='))
    .map(code => ({ code, archiveEnabled: true, sourceName: '' }));
}

function parseVendorBackupCandidates(vendor: VendorBackupType, text: string): VendorBackupCandidate[] {
  if (vendor === 'tampermonkey') return splitVendorUserscriptText(text);
  if (vendor === 'violentmonkey') {
    try {
      const parsed = JSON.parse(text) as { scripts?: Array<Record<string, any>> };
      if (Array.isArray(parsed?.scripts)) {
        return parsed.scripts.map(script => ({
          code: script?.code || script?.custom?.code || '',
          archiveEnabled: script?.config?.enabled !== false,
          sourceName: script?.props?.name || '',
          settings: script?.config || {},
          custom: script?.custom || {},
          values: script?.values || script?.storage || script?.config?.values || {},
          raw: script,
        }));
      }
    } catch { /* Text exports use the shared userscript-block parser. */ }
    return splitVendorUserscriptText(text);
  }
  const parsed = JSON.parse(text) as Array<Record<string, any>> | { scripts?: Array<Record<string, any>> };
  const scripts = Array.isArray(parsed) ? parsed : parsed?.scripts;
  if (!Array.isArray(scripts)) throw new Error('Backup does not contain a scripts array');
  return scripts.map(script => ({
    code: script?.source || script?.code || script?.content || '',
    archiveEnabled: script?.enabled !== false,
    sourceName: script?.name || '',
    settings: script?.settings || script?.config || {},
    custom: script?.custom || {},
    values: script?.values || script?.storage || {},
    raw: script,
  }));
}

export async function importVendorBackup(
  vendor: VendorBackupType,
  text: string,
  options: ImportOptions = {},
): Promise<ImportResults> {
  const labels: Record<VendorBackupType, string> = {
    tampermonkey: 'Tampermonkey backup',
    violentmonkey: 'Violentmonkey backup',
    greasemonkey: 'Greasemonkey backup',
  };
  const results: ImportResults = {
    imported: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    unmappedSettings: [],
    storageImported: 0,
    quarantinedScripts: 0,
    preservedDisabledScripts: 0,
    trustedEnabledScripts: 0,
  };
  const sourceLabel = typeof options.sourceLabel === 'string' && options.sourceLabel.trim()
    ? options.sourceLabel.trim()
    : labels[vendor];
  if (typeof text !== 'string' || !text.trim()) return { ...results, error: 'Backup file is empty' };
  const totalBytes = utf8ByteLength(text);
  if (totalBytes > ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES) {
    return { ...results, error: `Backup exceeds ${formatArchiveBytes(ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES)}.` };
  }

  let candidates: VendorBackupCandidate[];
  try {
    candidates = parseVendorBackupCandidates(vendor, text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...results, error: `Invalid ${sourceLabel} format: ${message}` };
  }
  if (candidates.length > ARCHIVE_MAX_ENTRIES) {
    return { ...results, error: `Backup has too many scripts (${candidates.length}). Maximum is ${ARCHIVE_MAX_ENTRIES}.` };
  }
  if (candidates.length === 0) return { ...results, error: 'No valid userscripts found in backup file' };

  const existingScripts = await ScriptStorage.getAll();
  const byIdentity = new Map(existingScripts.map(script => [
    `${script.meta?.name || ''}\u0000${script.meta?.namespace || ''}`,
    script,
  ]));
  let nextPosition = existingScripts.length;

  for (const candidate of candidates) {
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    const sourceName = candidate.sourceName || '<unknown>';
    if (!code) {
      results.skipped++;
      continue;
    }
    const codeBytes = utf8ByteLength(code);
    if (codeBytes > ARCHIVE_MAX_SCRIPT_BYTES) {
      results.errors.push({
        name: sourceName,
        error: `Script is too large (${formatArchiveBytes(codeBytes)}). Maximum is ${formatArchiveBytes(ARCHIVE_MAX_SCRIPT_BYTES)}.`,
      });
      continue;
    }
    try {
      const parsed = parseUserscript(code);
      if (parsed.error || !parsed.meta) {
        results.errors.push({ name: sourceName, error: parsed.error || 'Parse failed' });
        continue;
      }
      const identity = `${parsed.meta.name || ''}\u0000${parsed.meta.namespace || ''}`;
      const existing = byIdentity.get(identity);
      if (existing && !options.overwrite) {
        results.skipped++;
        continue;
      }
      const id = existing?.id || generateId();
      const mapped = mapImportedScriptSettings(parsed.meta, [
        { value: candidate.settings, label: 'settings' },
        { value: candidate.custom, label: 'custom' },
        { value: candidate.raw, label: 'candidate' },
        { value: candidate.values, label: 'storage' },
      ]);
      addImportDiagnostics(results, sourceName, mapped);
      const importedValues = sanitizeImportedValueMap(candidate.values);
      addImportStorageDiagnostics(results, sourceName, importedValues, candidate.values !== undefined);
      const nextImportedSettings: Record<string, unknown> = {
        ...(existing?.settings || {}),
        ...mapped.settings,
      };
      if (existing?.settings?.userConfig && mapped.settings.userConfig) {
        nextImportedSettings.userConfig = {
          ...existing.settings.userConfig,
          ...(mapped.settings.userConfig as Record<string, unknown>),
        };
      }
      const trustState = applyImportedScriptTrust(nextImportedSettings, candidate.archiveEnabled, {
        trustImportedScripts: options.trustImportedScripts === true,
        source: `import-${vendor}`,
        sourceLabel,
      });
      countImportTrustDisposition(results, trustState.disposition);
      const now = Date.now();
      const importedScript: Script = {
        id,
        code,
        meta: parsed.meta,
        enabled: trustState.enabled,
        settings: trustState.settings,
        position: existing?.position ?? nextPosition++,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      await ensurePersistentStorageForScriptWrite(existing ? `${vendor}-import-update` : `${vendor}-import`, code);
      await ScriptStorage.set(id, importedScript);
      if (Object.keys(importedValues).length > 0) await ScriptValues.setAll(id, importedValues);
      byIdentity.set(identity, importedScript);
      results.imported++;
    } catch (error: unknown) {
      results.errors.push({
        name: sourceName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await registerAllScripts(true);
  await updateBadge();
  return results;
}
