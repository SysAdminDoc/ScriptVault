/**
 * Import/Export — export and import scripts as JSON or ZIP archives.
 *
 * Extracted from background.core.js (lines 505-805) — logic is kept identical.
 */

import type { Script, ScriptMeta } from '../types/script';
import type { Settings } from '../types/settings';
import { ScriptStorage, ScriptValues, SettingsManager } from '../modules/storage';
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
declare function registerAllScripts(): Promise<void>;
declare function generateId(): string;
declare function updateBadge(): Promise<void>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportOptions {
  overwrite?: boolean;
  importSettings?: boolean;
  importSettingsCredentials?: boolean;
}

interface ImportResults {
  imported: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
  settingsImported?: boolean;
  settingsCredentialsImported?: boolean;
  skippedSettingsCredentialKeys?: string[];
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
  } else {
    zipBytes = input;
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

const SETTINGS_CREDENTIAL_KEYS: Array<keyof Settings> = [
  'webdavUsername',
  'webdavPassword',
  'googleDriveToken',
  'googleDriveRefreshToken',
  'dropboxToken',
  'dropboxRefreshToken',
  'onedriveToken',
  'onedriveRefreshToken',
  's3AccessKeyId',
  's3SecretKey'
];

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
} {
  const allowCredentials = options.allowCredentials === true;
  const sanitized = cloneSettingsForTransfer(settings);
  const skippedSettingsCredentialKeys: string[] = [];
  if (!allowCredentials) {
    for (const key of SETTINGS_CREDENTIAL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
        delete sanitized[key];
        skippedSettingsCredentialKeys.push(key);
      }
    }
  }
  return {
    settings: sanitized,
    settingsCredentialsImported: allowCredentials,
    skippedSettingsCredentialKeys,
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

export async function importScripts(
  data: ImportData,
  options: ImportOptions = {},
): Promise<ImportResults | { error: string }> {
  const { overwrite = false } = options;
  const results: ImportResults = {
    imported: 0,
    skipped: 0,
    errors: [],
    settingsImported: false,
    settingsCredentialsImported: false,
    skippedSettingsCredentialKeys: [],
  };

  if (!data.scripts || !Array.isArray(data.scripts)) {
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

      await ScriptStorage.set(scriptId, {
        id: scriptId,
        code: script.code,
        meta: parsed.meta,
        enabled: script.enabled !== false,
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
  const results: ImportResults = { imported: 0, skipped: 0, errors: [] };

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

        // Parse options file if exists
        if (optionsFileData) {
          try {
            const optionsData = parseArchiveJson<{
              scriptId?: string;
              createdAt?: number;
              updatedAt?: number;
              position?: number;
              settings?: { enabled?: boolean };
              scriptVault?: {
                createdAt?: number;
                updatedAt?: number;
                position?: number;
              };
            }>(unzipped, `${baseName}.options.json`, ARCHIVE_MAX_OPTIONS_BYTES);
            enabled = optionsData.settings?.enabled !== false;
            preferredScriptId = isSafeImportedScriptId(optionsData.scriptId) ? optionsData.scriptId : '';
            importedCreatedAt = finiteBackupNumber(optionsData.scriptVault?.createdAt ?? optionsData.createdAt);
            importedUpdatedAt = finiteBackupNumber(optionsData.scriptVault?.updatedAt ?? optionsData.updatedAt);
            importedPosition = finiteBackupNumber(optionsData.scriptVault?.position ?? optionsData.position);
          } catch (e: unknown) {
            console.warn('Failed to parse options file:', e);
          }
        }

        // Parse storage file if exists
        if (storageFileData) {
          try {
            const storageData = parseArchiveJson<{
              data?: Record<string, unknown>;
            }>(unzipped, `${baseName}.storage.json`, ARCHIVE_MAX_JSON_ENTRY_BYTES);
            storedValues = storageData.data || storageData as unknown as Record<string, unknown> || {};
          } catch (e: unknown) {
            console.warn('Failed to parse storage file:', e);
          }
        }

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
        const script: Script = {
          id: scriptId,
          code: code,
          meta: parsedMeta,
          enabled: enabled,
          position: existing?.position ?? (importedPosition ?? _importPosition++),
          createdAt: finiteBackupNumber(existing?.createdAt) ?? importedCreatedAt ?? now,
          updatedAt: importedUpdatedAt ?? now
        };

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
          await ScriptStorage.set(scriptId, {
            id: scriptId,
            code: code,
            meta: parsed.meta,
            enabled: true,
            position: _importPosition++,
            createdAt: Date.now(),
            updatedAt: Date.now()
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
