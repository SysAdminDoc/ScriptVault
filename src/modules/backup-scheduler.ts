// ============================================================================
// ScriptVault — Automated Backup Scheduler
// Runs in the service worker (no DOM). Provides scheduled and on-change
// backups using chrome.alarms, with configurable retention and recovery.
// ============================================================================

import type { Script } from '../types/index';

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

declare function importFromZip(
  zipData: string,
  options?: { overwrite?: boolean; recordReceipt?: boolean },
): Promise<{
  imported: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
  error?: string;
}>;

declare const ScriptStorage: {
  getAll(): Promise<Script[]>;
  get(id: string): Promise<Script | null>;
  set(id: string, script: Script): Promise<unknown>;
  delete(id: string): Promise<unknown>;
};

declare const ScriptValues: {
  getAll(scriptId: string): Promise<Record<string, unknown>>;
  setAll(scriptId: string, values: Record<string, unknown>): Promise<unknown>;
  deleteAll?(scriptId: string): Promise<unknown>;
};

declare const SettingsManager: {
  get(): Promise<Record<string, unknown>>;
  set(settings: Record<string, unknown>): Promise<unknown>;
};

declare const FolderStorage: {
  cache: unknown;
};

declare const WorkspaceManager: {
  _cache?: unknown;
  _initPromise?: unknown;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScheduleType = 'daily' | 'weekly' | 'onChange' | 'manual';
type BackupReason = 'scheduled' | 'onChange' | 'manual' | 'imported';

interface BackupSchedulerSettings {
  enabled: boolean;
  scheduleType: ScheduleType;
  hour: number;
  dayOfWeek: number;
  maxBackups: number;
  includeSettingsCredentials: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  warnOnStorageFull: boolean;
}

interface BackupSchedulerSettingsResult extends BackupSchedulerSettings {
  prunedCount: number;
}

interface BackupEntry {
  id: string;
  timestamp: number;
  version: string;
  reason: BackupReason;
  scriptCount: number;
  hasGlobalSettings?: boolean;
  hasFolders?: boolean;
  hasWorkspaces?: boolean;
  hasScriptStorage?: boolean;
  settingsCredentialsIncluded?: boolean;
  redactedSettingsCredentialKeys?: string[];
  size: number;
  sizeFormatted: string;
  data: string;
}

type BackupSummary = Omit<BackupEntry, 'data'>;

interface BackupResult {
  success: boolean;
  backupId?: string;
  error?: string;
}

interface RestoreResult {
  success: boolean;
  restoredScripts?: number;
  skippedScripts?: number;
  restoredSettings?: boolean;
  restoredFolders?: boolean;
  restoredWorkspaces?: boolean;
  settingsCredentialsRestored?: boolean;
  skippedSettingsCredentialKeys?: string[];
  errors?: Array<{ name: string; error: string }>;
  receiptId?: string;
  error?: string;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

interface ExportedBackup {
  zipData: string;
  filename: string;
}

interface InspectedScript {
  id: string;
  name: string;
  namespace?: string;
  hasStorage: boolean;
}

interface InspectedFolder {
  id: string;
  name: string;
  scriptCount: number;
}

interface InspectedWorkspace {
  id: string;
  name: string;
  scriptCount: number;
  active: boolean;
}

interface InspectedBackupManifest {
  scriptCount: number;
  scripts: InspectedScript[];
  scriptsWithStorageCount: number;
  hasGlobalSettings: boolean;
  settingsKeyCount: number;
  settingsCredentialsIncluded: boolean;
  redactedSettingsCredentialKeys: string[];
  hasFolders: boolean;
  folderCount: number;
  folders: InspectedFolder[];
  hasWorkspaces: boolean;
  workspaceCount: number;
  workspaces: InspectedWorkspace[];
  activeWorkspaceId: string | null;
}

interface RestoreOptions {
  selective?: boolean;
  scriptIds?: string[];
  importSettingsCredentials?: boolean;
  recordReceipt?: boolean;
  sourceLabel?: string;
}

interface RestoreSnapshot {
  scriptsBefore: Script[];
  valuesBefore: Record<string, Record<string, unknown>>;
  scriptIdsBefore: string[];
  addedScriptIds?: string[];
  settings?: Record<string, unknown>;
  folders?: unknown;
  workspaces?: unknown;
}

interface RestoreReceipt {
  id: string;
  timestamp: number;
  type: string;
  source: string;
  sourceLabel?: string;
  backupId?: string | null;
  backupTimestamp?: number;
  selective?: boolean;
  result?: RestoreResult | Record<string, unknown> | null;
  snapshot: RestoreSnapshot;
  rolledBackAt?: number | null;
  rollbackError?: string | null;
  rollbackResult?: Record<string, unknown> | null;
}

interface RestoreReceiptMeta {
  id: string;
  type: string;
  source: string;
  sourceLabel: string;
  timestamp: number;
  backupId: string | null;
  result: RestoreResult | Record<string, unknown> | null;
  rolledBackAt: number | null;
  rollbackError: string | null;
  rollbackResult: Record<string, unknown> | null;
  snapshotScriptCount: number;
  snapshotIdSetSize: number;
  hasGlobalSettings: boolean;
  hasFolders: boolean;
  hasWorkspaces: boolean;
}

interface VerifyIssue {
  kind: string;
  file?: string;
  error: string;
}

interface VerifiedScript {
  filename: string;
  name: string;
  namespace: string;
  hasOptions: boolean;
  hasStorage: boolean;
  parseError?: string;
  scriptId?: string;
  conflictsWithId?: string;
}

interface VerifyBackupResult {
  valid: boolean;
  scripts: VerifiedScript[];
  parseErrorCount: number;
  missingOptionsCount: number;
  missingStorageCount: number;
  unreadableFileCount: number;
  summary: {
    scriptCount: number;
    validScripts: number;
    parseErrors: number;
    optionsParseErrors: number;
    storageParseErrors: number;
    globalSettingsValid: boolean;
    settingsCredentialsIncluded: boolean;
    redactedSettingsCredentialKeyCount: number;
    foldersValid: boolean;
    workspacesValid: boolean;
  };
  issues: VerifyIssue[];
}

interface RollbackRestoreOptions {
  restoreGlobals?: boolean;
}

interface RollbackRestoreError {
  kind: string;
  name?: string;
  error: string;
}

interface RollbackRestoreResult {
  success: boolean;
  error?: string;
  alreadyRolledBack?: boolean;
  rolledBackAt?: number | null;
  receiptId?: string;
  restoredScripts?: number;
  removedScripts?: number;
  restoredValues?: number;
  restoredSettings?: boolean;
  restoredFolders?: boolean;
  restoredWorkspaces?: boolean;
  errors?: RollbackRestoreError[];
  restoredScriptIds?: string[];
  removedScriptIds?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_BACKUPS = 'autoBackups';
const STORAGE_KEY_SETTINGS = 'backupSchedulerSettings';
const STORAGE_KEY_RECEIPTS = 'restoreReceipts';
const RECEIPT_RETENTION = 10;
const RECEIPT_BYTE_BUDGET: number = 5 * 1024 * 1024; // ~5 MB across retained receipts
const ALARM_NAME = 'sv_backup_scheduled';
const DEBOUNCE_ALARM = 'sv_backup_debounce';
const DEBOUNCE_MINUTES = 5;
const STORAGE_WARNING_BYTES: number = 8 * 1024 * 1024; // 8 MB
const ARCHIVE_MAX_SCRIPT_BYTES: number = 5 * 1024 * 1024;
const ARCHIVE_MAX_COMPRESSED_BYTES: number = 20 * 1024 * 1024;
const ARCHIVE_MAX_ENTRIES: number = 300;
const ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES: number = 60 * 1024 * 1024;
const ARCHIVE_MAX_ENTRY_BYTES: number = 10 * 1024 * 1024;
const ARCHIVE_MAX_JSON_ENTRY_BYTES: number = 5 * 1024 * 1024;
const ARCHIVE_MAX_OPTIONS_BYTES: number = 512 * 1024;
const ARCHIVE_MAX_COMPRESSION_RATIO: number = 100;

const DEFAULT_SETTINGS: BackupSchedulerSettings = {
  enabled: false,
  scheduleType: 'daily',
  hour: 3,
  dayOfWeek: 0,
  maxBackups: 5,
  includeSettingsCredentials: false,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  warnOnStorageFull: true,
};

const GLOBAL_SETTINGS_METADATA_FILE = 'global-settings.metadata.json';
const SETTINGS_CREDENTIAL_KEYS = [
  'webdavUsername',
  'webdavPassword',
  'googleDriveToken',
  'googleDriveRefreshToken',
  'dropboxToken',
  'dropboxRefreshToken',
  'onedriveToken',
  'onedriveRefreshToken',
  's3AccessKeyId',
  's3SecretKey',
] as const;

interface GlobalSettingsMetadata {
  schemaVersion: number;
  settingsCredentialsIncluded: boolean;
  redactedSettingsCredentialKeys: string[];
}

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

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _settings: BackupSchedulerSettings | null = null;
let _initialized = false;
let _settingsLoadPromise: Promise<BackupSchedulerSettings> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

function _formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function archiveIntakeError(message: string): Error {
  return new Error(`Backup archive rejected: ${message}`);
}

function normalizeArchiveEntryName(name: unknown): string {
  return typeof name === 'string' ? name.replace(/\\/g, '/').trim() : '';
}

function archiveEntryLimit(name: string): number {
  if (name.endsWith('.user.js') || (!name.includes('/') && name.endsWith('.js'))) {
    return ARCHIVE_MAX_SCRIPT_BYTES;
  }
  if (name.endsWith('.options.json') || name === GLOBAL_SETTINGS_METADATA_FILE) {
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
    throw archiveIntakeError(`${name} is too large (${_formatBytes(uncompressedBytes)}). Maximum is ${_formatBytes(entryLimit)}.`);
  }
  state.totalUncompressedBytes += uncompressedBytes;
  if (state.totalUncompressedBytes > ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES) {
    throw archiveIntakeError(`expanded data exceeds ${_formatBytes(ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES)}.`);
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
      throw archiveIntakeError(`compressed payload exceeds ${_formatBytes(ARCHIVE_MAX_COMPRESSED_BYTES)}.`);
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
    throw archiveIntakeError(`compressed payload exceeds ${_formatBytes(ARCHIVE_MAX_COMPRESSED_BYTES)}.`);
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
    throw archiveIntakeError(`${name} is too large (${_formatBytes(data.byteLength)}). Maximum is ${_formatBytes(maxBytes)}.`);
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

function _cloneSettingsForTransfer(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value) as Record<string, unknown>;
    } catch (_) {
      // Fall through.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch (_) {
    return { ...(value as Record<string, unknown>) };
  }
}

function _redactSettingsCredentials(
  settings: unknown,
  options: { includeCredentials?: boolean } = {},
): {
  settings: Record<string, unknown>;
  metadata: GlobalSettingsMetadata;
} {
  const includeCredentials = options.includeCredentials === true;
  const sanitized = _cloneSettingsForTransfer(settings);
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
    metadata: {
      schemaVersion: 1,
      settingsCredentialsIncluded: includeCredentials,
      redactedSettingsCredentialKeys,
    },
  };
}

function _prepareSettingsForRestore(
  settings: unknown,
  options: { allowCredentials?: boolean } = {},
): {
  settings: Record<string, unknown>;
  settingsCredentialsRestored: boolean;
  skippedSettingsCredentialKeys: string[];
} {
  const allowCredentials = options.allowCredentials === true;
  const sanitized = _cloneSettingsForTransfer(settings);
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
    settingsCredentialsRestored: allowCredentials,
    skippedSettingsCredentialKeys,
  };
}

function _readSettingsMetadata(
  unzipped: Record<string, Uint8Array>,
  backup: Partial<BackupEntry> = {},
): GlobalSettingsMetadata {
  const fallback: GlobalSettingsMetadata = {
    schemaVersion: 1,
    settingsCredentialsIncluded: backup.settingsCredentialsIncluded === true,
    redactedSettingsCredentialKeys: Array.isArray(backup.redactedSettingsCredentialKeys)
      ? backup.redactedSettingsCredentialKeys.filter((key): key is string => typeof key === 'string')
      : [],
  };
  const metadataFile = unzipped[GLOBAL_SETTINGS_METADATA_FILE];
  if (!metadataFile) return fallback;
  try {
    const parsed = parseArchiveJson<Partial<GlobalSettingsMetadata>>(
      unzipped,
      GLOBAL_SETTINGS_METADATA_FILE,
      ARCHIVE_MAX_OPTIONS_BYTES,
    );
    return {
      schemaVersion: Number(parsed.schemaVersion || 1),
      settingsCredentialsIncluded: parsed.settingsCredentialsIncluded === true,
      redactedSettingsCredentialKeys: Array.isArray(parsed.redactedSettingsCredentialKeys)
        ? parsed.redactedSettingsCredentialKeys.filter((key): key is string => typeof key === 'string')
        : [],
    };
  } catch (_) {
    return fallback;
  }
}

function _zipBytesToBase64(zipData: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < zipData.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(zipData.subarray(i, i + chunkSize)),
    );
  }
  return btoa(binary);
}

/** Compute the next Date for a given hour (and optional dayOfWeek). */
function _nextScheduledTime(
  hour: number,
  dayOfWeek?: number | null,
): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);

  if (dayOfWeek !== undefined && dayOfWeek !== null) {
    // Weekly — advance to the correct day
    const currentDay = now.getDay();
    let daysUntil = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0 && now >= target) daysUntil = 7;
    target.setDate(target.getDate() + daysUntil);
  } else {
    // Daily — if the hour already passed today, schedule for tomorrow
    if (now >= target) target.setDate(target.getDate() + 1);
  }
  return target;
}

/** Send a chrome notification (best-effort, no throw). */
function _notify(
  title: string,
  message: string,
  _isError = false,
): void {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: `ScriptVault — ${title}`,
      message,
    });
  } catch (_) {
    /* notifications permission may not exist */
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function _loadSettings(): Promise<BackupSchedulerSettings> {
  if (_settings) return _settings;
  if (_settingsLoadPromise) return _settingsLoadPromise;
  _settingsLoadPromise = (async () => {
    const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
    const stored = data[STORAGE_KEY_SETTINGS] as
      | Partial<BackupSchedulerSettings>
      | undefined;
    _settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    return _settings;
  })();
  return _settingsLoadPromise;
}

async function _saveSettings(
  settings: BackupSchedulerSettings,
): Promise<void> {
  _settings = { ...DEFAULT_SETTINGS, ...settings };
  _settingsLoadPromise = null; // allow next _loadSettings to re-read from storage
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: _settings });
}

// ---------------------------------------------------------------------------
// Backup data collection
// ---------------------------------------------------------------------------

/**
 * Collect all data that should be in a backup and produce a base64 ZIP
 * by reusing the same fflate-based pattern as exportToZip.
 */
async function _collectBackupData(
  options: { includeSettingsCredentials?: boolean } = {},
): Promise<{
  base64: string;
  scriptCount: number;
  hasGlobalSettings: boolean;
  hasFolders: boolean;
  hasWorkspaces: boolean;
  hasScriptStorage: boolean;
  settingsCredentialsIncluded: boolean;
  redactedSettingsCredentialKeys: string[];
}> {
  // Scripts — code + metadata + settings
  const scripts: Script[] = await ScriptStorage.getAll();
  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();
  let hasScriptStorage = false;

  for (const script of scripts) {
    let safeName: string = (script.meta?.name || 'unnamed')
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

    // Userscript code
    files[`scripts/${safeName}.user.js`] = fflate.strToU8(script.code || '');

    // Options / metadata
    const options = {
      scriptId: script.id,
      settings: {
        enabled: script.enabled,
        'run-at': script.meta?.['run-at'] || 'document-idle',
      },
      meta: {
        name: script.meta?.name,
        namespace: script.meta?.namespace || '',
        version: script.meta?.version || '1.0',
        description: script.meta?.description || '',
        author: script.meta?.author || '',
        match: script.meta?.match || [],
        include: script.meta?.include || [],
        exclude: script.meta?.exclude || [],
        grant: script.meta?.grant || [],
        require: script.meta?.require || [],
        resource: script.meta?.resource || {},
      },
    };
    files[`scripts/${safeName}.options.json`] = fflate.strToU8(
      JSON.stringify(options, null, 2),
    );

    // Script values (GM_getValue data)
    try {
      const values: Record<string, unknown> = await ScriptValues.getAll(
        script.id,
      );
      if (values && Object.keys(values).length > 0) {
        files[`scripts/${safeName}.storage.json`] = fflate.strToU8(
          JSON.stringify({ data: values }, null, 2),
        );
        hasScriptStorage = true;
      }
    } catch (_) {
      /* ScriptValues may not be available */
    }
  }

  // Global settings
  let hasGlobalSettings = false;
  let settingsMetadata: GlobalSettingsMetadata = {
    schemaVersion: 1,
    settingsCredentialsIncluded: options.includeSettingsCredentials === true,
    redactedSettingsCredentialKeys: [],
  };
  try {
    const globalSettings = await SettingsManager.get();
    const settingsExport = _redactSettingsCredentials(globalSettings, {
      includeCredentials: options.includeSettingsCredentials === true,
    });
    settingsMetadata = settingsExport.metadata;
    files['global-settings.json'] = fflate.strToU8(
      JSON.stringify(settingsExport.settings, null, 2),
    );
    files[GLOBAL_SETTINGS_METADATA_FILE] = fflate.strToU8(
      JSON.stringify(settingsMetadata, null, 2),
    );
    hasGlobalSettings = true;
  } catch (_) {
    /* empty */
  }

  // Folder structure (if any)
  let hasFolders = false;
  try {
    const folderData = await chrome.storage.local.get('scriptFolders');
    if (folderData['scriptFolders']) {
      files['folders.json'] = fflate.strToU8(
        JSON.stringify(folderData['scriptFolders'], null, 2),
      );
      hasFolders = true;
    }
  } catch (_) {
    /* empty */
  }

  // Workspace snapshots
  let hasWorkspaces = false;
  try {
    const wsData = await chrome.storage.local.get('workspaces');
    if (wsData['workspaces']) {
      files['workspaces.json'] = fflate.strToU8(
        JSON.stringify(wsData['workspaces'], null, 2),
      );
      hasWorkspaces = true;
    }
  } catch (_) {
    /* empty */
  }

  // Compress
  const zipData: Uint8Array = fflate.zipSync(files, { level: 6 });
  return {
    base64: _zipBytesToBase64(zipData),
    scriptCount: scripts.length,
    hasGlobalSettings,
    hasFolders,
    hasWorkspaces,
    hasScriptStorage,
    settingsCredentialsIncluded: settingsMetadata.settingsCredentialsIncluded,
    redactedSettingsCredentialKeys: settingsMetadata.redactedSettingsCredentialKeys,
  };
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function _getBackupList(): Promise<BackupEntry[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY_BACKUPS);
  return (data[STORAGE_KEY_BACKUPS] as BackupEntry[] | undefined) ?? [];
}

async function _saveBackupList(list: BackupEntry[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_BACKUPS]: list });
}

// ---------------------------------------------------------------------------
// Restore receipts
// ---------------------------------------------------------------------------

async function _getReceipts(): Promise<RestoreReceipt[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY_RECEIPTS);
  const receipts = data[STORAGE_KEY_RECEIPTS];
  return Array.isArray(receipts) ? (receipts as RestoreReceipt[]) : [];
}

async function _saveReceipts(list: RestoreReceipt[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_RECEIPTS]: list });
}

function _approxJsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

async function _pushReceipt(receipt: RestoreReceipt): Promise<RestoreReceipt> {
  const receipts = await _getReceipts();
  receipts.unshift(receipt);
  if (receipts.length > RECEIPT_RETENTION) {
    receipts.length = RECEIPT_RETENTION;
  }

  let total = 0;
  for (let i = 0; i < receipts.length; i++) {
    total += _approxJsonBytes(receipts[i]);
    if (i > 0 && total > RECEIPT_BYTE_BUDGET) {
      receipts.length = i;
      break;
    }
  }

  await _saveReceipts(receipts);
  return receipt;
}

async function _updateReceipt(
  receiptId: string,
  patch: Partial<RestoreReceipt>,
): Promise<RestoreReceipt | null> {
  const receipts = await _getReceipts();
  const idx = receipts.findIndex((receipt) => receipt?.id === receiptId);
  if (idx === -1) return null;
  receipts[idx] = { ...receipts[idx]!, ...patch };
  await _saveReceipts(receipts);
  return receipts[idx] ?? null;
}

function _snapshotMeta(receipt: RestoreReceipt | null): RestoreReceiptMeta | null {
  if (!receipt) return null;
  const snapshot = receipt.snapshot ?? {
    scriptsBefore: [],
    valuesBefore: {},
    scriptIdsBefore: [],
  };
  const scriptsBefore = Array.isArray(snapshot.scriptsBefore)
    ? snapshot.scriptsBefore
    : [];
  return {
    id: receipt.id,
    type: receipt.type,
    source: receipt.source,
    sourceLabel: receipt.sourceLabel || '',
    timestamp: receipt.timestamp,
    backupId: receipt.backupId || null,
    result: receipt.result || null,
    rolledBackAt: receipt.rolledBackAt || null,
    rollbackError: receipt.rollbackError || null,
    rollbackResult: receipt.rollbackResult || null,
    snapshotScriptCount: scriptsBefore.length,
    snapshotIdSetSize: Array.isArray(snapshot.scriptIdsBefore)
      ? snapshot.scriptIdsBefore.length
      : 0,
    hasGlobalSettings: snapshot.settings !== undefined,
    hasFolders: snapshot.folders !== undefined,
    hasWorkspaces: snapshot.workspaces !== undefined,
  };
}

async function _captureSnapshot({
  includeGlobals = false,
}: { includeGlobals?: boolean } = {}): Promise<RestoreSnapshot> {
  const scriptsBefore: Script[] = [];
  const valuesBefore: Record<string, Record<string, unknown>> = {};
  let scriptIdsBefore: string[] = [];

  try {
    const all = await ScriptStorage.getAll();
    scriptIdsBefore = all
      .map((script) => script.id)
      .filter((id): id is string => typeof id === 'string');
    for (const script of all) {
      scriptsBefore.push(structuredClone(script));
      if (
        typeof ScriptValues !== 'undefined' &&
        ScriptValues &&
        typeof ScriptValues.getAll === 'function'
      ) {
        try {
          const values = await ScriptValues.getAll(script.id);
          if (values && Object.keys(values).length > 0) {
            valuesBefore[script.id] = structuredClone(values);
          }
        } catch (_) {
          /* ignore per-script value snapshot errors */
        }
      }
    }
  } catch (_) {
    /* getAll may fail in degraded harnesses; receipt still useful */
  }

  const snapshot: RestoreSnapshot = {
    scriptsBefore,
    valuesBefore,
    scriptIdsBefore,
  };

  if (includeGlobals) {
    try {
      snapshot.settings = structuredClone(await SettingsManager.get());
    } catch (_) {
      /* empty */
    }
    try {
      const folderData = await chrome.storage.local.get('scriptFolders');
      if (folderData && folderData['scriptFolders'] !== undefined) {
        snapshot.folders = structuredClone(folderData['scriptFolders']);
      }
    } catch (_) {
      /* empty */
    }
    try {
      const wsData = await chrome.storage.local.get('workspaces');
      if (wsData && wsData['workspaces'] !== undefined) {
        snapshot.workspaces = structuredClone(wsData['workspaces']);
      }
    } catch (_) {
      /* empty */
    }
  }

  return snapshot;
}

/** Estimate combined size of all stored backups (bytes). */
function _estimateBackupSize(backups: BackupEntry[]): number {
  let total = 0;
  for (const b of backups) {
    // base64 string length is ~4/3 of binary; approximate storage cost
    total += b.data?.length ?? 0;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Alarm management
// ---------------------------------------------------------------------------

async function _registerAlarms(): Promise<void> {
  const settings: BackupSchedulerSettings = await _loadSettings();

  // Always replace scheduled daily/weekly alarms because the cadence may have changed.
  await chrome.alarms.clear(ALARM_NAME);

  // Preserve a pending on-change debounce alarm across service-worker wakes.
  // Clearing it here can drop the only backup queued after recent script edits.
  if (!settings.enabled || settings.scheduleType !== 'onChange') {
    await chrome.alarms.clear(DEBOUNCE_ALARM);
  }

  if (!settings.enabled) return;

  if (settings.scheduleType === 'daily') {
    const nextRun: Date = _nextScheduledTime(settings.hour);
    chrome.alarms.create(ALARM_NAME, {
      when: nextRun.getTime(),
      periodInMinutes: 24 * 60, // repeat every 24 hours
    });
  } else if (settings.scheduleType === 'weekly') {
    const nextRun: Date = _nextScheduledTime(
      settings.hour,
      settings.dayOfWeek,
    );
    chrome.alarms.create(ALARM_NAME, {
      when: nextRun.getTime(),
      periodInMinutes: 7 * 24 * 60, // repeat every 7 days
    });
  }
  // 'onChange' and 'manual' don't need periodic alarms
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const BackupScheduler = {
  /**
   * Initialize the backup scheduler. Call once on service worker start.
   * Re-registers alarms and attaches the alarm listener.
   */
  async init(): Promise<void> {
    if (_initialized) return;
    _initialized = true;

    await _loadSettings();
    await _registerAlarms();

    // Listen for backup-related alarms
    chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === ALARM_NAME) {
        await BackupScheduler.createBackup('scheduled');
      } else if (alarm.name === DEBOUNCE_ALARM) {
        await BackupScheduler.createBackup('onChange');
      }
    });
  },

  /**
   * Trigger a backup.
   */
  async createBackup(reason: BackupReason = 'manual'): Promise<BackupResult> {
    try {
      const settings: BackupSchedulerSettings = await _loadSettings();
      const {
        base64,
        scriptCount,
        hasGlobalSettings,
        hasFolders,
        hasWorkspaces,
        hasScriptStorage,
        settingsCredentialsIncluded,
        redactedSettingsCredentialKeys,
      } = await _collectBackupData({
        includeSettingsCredentials: settings.includeSettingsCredentials === true,
      });
      const sizeBytes: number = Math.round(base64.length * 0.75); // approximate binary size

      const backup: BackupEntry = {
        id: _generateId(),
        timestamp: Date.now(),
        version: chrome.runtime.getManifest?.()?.version ?? '1.0',
        reason,
        scriptCount,
        hasGlobalSettings,
        hasFolders,
        hasWorkspaces,
        hasScriptStorage,
        settingsCredentialsIncluded,
        redactedSettingsCredentialKeys,
        size: sizeBytes,
        sizeFormatted: _formatBytes(sizeBytes),
        data: base64,
      };

      // Prune old backups BEFORE writing to avoid quota exhaustion
      await BackupScheduler.pruneOldBackups();

      const backups: BackupEntry[] = await _getBackupList();
      backups.unshift(backup); // newest first
      await _saveBackupList(backups);

      // Storage warning check
      if (settings.warnOnStorageFull) {
        const allBackups: BackupEntry[] = await _getBackupList();
        const totalSize: number = _estimateBackupSize(allBackups);
        if (totalSize > STORAGE_WARNING_BYTES) {
          _notify(
            'Storage Warning',
            `Backup storage is using ${_formatBytes(totalSize)}. Consider reducing the backup limit or deleting old backups.`,
            true,
          );
        }
      }

      // Success notification
      if (settings.notifyOnSuccess) {
        _notify(
          'Backup Complete',
          `${reason.charAt(0).toUpperCase() + reason.slice(1)} backup created with ${scriptCount} scripts (${_formatBytes(sizeBytes)}).`,
        );
      }

      return { success: true, backupId: backup.id };
    } catch (err: unknown) {
      const settings: BackupSchedulerSettings = await _loadSettings();
      const errMsg: string =
        err instanceof Error ? err.message : String(err);
      if (settings.notifyOnFailure) {
        _notify('Backup Failed', `Error: ${errMsg}`, true);
      }
      console.error('[BackupScheduler] createBackup error:', err);
      return { success: false, error: errMsg };
    }
  },

  /**
   * Get all stored backups (without full data blobs to save memory).
   */
  async getBackups(): Promise<BackupSummary[]> {
    const backups: BackupEntry[] = await _getBackupList();
    return backups.map(
      (b: BackupEntry): BackupSummary => ({
        id: b.id,
        timestamp: b.timestamp,
        version: b.version,
        reason: b.reason,
        scriptCount: b.scriptCount,
        hasGlobalSettings: !!b.hasGlobalSettings,
        hasFolders: !!b.hasFolders,
        hasWorkspaces: !!b.hasWorkspaces,
        hasScriptStorage: !!b.hasScriptStorage,
        settingsCredentialsIncluded: b.settingsCredentialsIncluded === true,
        redactedSettingsCredentialKeys: Array.isArray(b.redactedSettingsCredentialKeys)
          ? b.redactedSettingsCredentialKeys.slice()
          : [],
        size: b.size,
        sizeFormatted: b.sizeFormatted,
      }),
    );
  },

  /**
   * Restore from a backup.
   * If selective = true, only restore scripts whose original IDs are in scriptIds.
   * Older backups may fall back to matching by script name.
   * Otherwise full restore (scripts, settings, folders, workspaces).
   */
  async restoreBackup(
    backupId: string,
    options: RestoreOptions = {},
  ): Promise<RestoreResult> {
    const backups: BackupEntry[] = await _getBackupList();
    const backup: BackupEntry | undefined = backups.find(
      (b: BackupEntry) => b.id === backupId,
    );
    if (!backup) return { success: false, error: 'Backup not found' };

    const recordReceipt = options.recordReceipt !== false;
    const sourceLabel =
      typeof options.sourceLabel === 'string' && options.sourceLabel.trim()
        ? options.sourceLabel.trim()
        : `Backup ${new Date(backup.timestamp).toISOString()}`;
    let snapshot: RestoreSnapshot | null = null;
    if (recordReceipt) {
      try {
        snapshot = await _captureSnapshot({ includeGlobals: !options.selective });
      } catch (_) {
        /* restore should still proceed if snapshot capture fails */
      }
    }

    try {
      const unzipped: Record<string, Uint8Array> = unzipArchiveBounded(backup.data);
      const fileNames: string[] = Object.keys(unzipped);
      let restoredScripts = 0;
      let skippedScripts = 0;
      let restoredSettings = false;
      let restoredFolders = false;
      let restoredWorkspaces = false;
      let settingsCredentialsRestored = false;
      let skippedSettingsCredentialKeys: string[] = [];
      const errors: Array<{ name: string; error: string }> = [];
      const settingsMetadata = _readSettingsMetadata(unzipped, backup);

      // --- Restore scripts ---
      const userScripts: string[] = fileNames.filter((n: string) =>
        n.endsWith('.user.js'),
      );

      if (options.selective && Array.isArray(options.scriptIds)) {
        const selectedRefs = new Set(options.scriptIds);
        const selectedFiles: Record<string, Uint8Array> = {};

        for (const filename of userScripts) {
          const baseName: string = filename.replace(/\.user\.js$/, '');
          const displayName: string = baseName.replace(/^scripts\//, '');

          // Parse metadata to match IDs for new backups and names for legacy backups.
          let scriptId = '';
          let scriptName = displayName;
          let scriptNs = '';
          let optionsMeta: {
            scriptId?: string;
            meta?: { name?: string; namespace?: string };
          } = {};
          const optionsFile = `${baseName}.options.json`;
          const optionsFileData: Uint8Array | undefined =
            unzipped[optionsFile];
          if (optionsFileData) {
            try {
              optionsMeta = parseArchiveJson<typeof optionsMeta>(
                unzipped,
                optionsFile,
                ARCHIVE_MAX_OPTIONS_BYTES,
              );
              scriptId =
                typeof optionsMeta.scriptId === 'string'
                  ? optionsMeta.scriptId
                  : '';
              scriptName =
                optionsMeta.meta?.name || displayName;
              scriptNs = optionsMeta.meta?.namespace || '';
            } catch (_) {
              /* empty */
            }
          }

          const scriptKey = scriptNs ? `${scriptName}::${scriptNs}` : scriptName;
          const matchesSelection =
            selectedRefs.has(scriptName) ||
            selectedRefs.has(displayName) ||
            selectedRefs.has(scriptKey) ||
            (scriptId ? selectedRefs.has(scriptId) : false);
          if (!matchesSelection) continue;

          const scriptFile = unzipped[filename];
          if (scriptFile) {
            selectedFiles[filename] = scriptFile;
          }
          if (optionsFileData) {
            selectedFiles[optionsFile] = optionsFileData;
          }
          const storageFile = `${baseName}.storage.json`;
          const storageFileData: Uint8Array | undefined = unzipped[storageFile];
          if (storageFileData) {
            selectedFiles[storageFile] = storageFileData;
          }
        }

        if (Object.keys(selectedFiles).length === 0) {
          return {
            success: true,
            restoredScripts: 0,
            skippedScripts: 0,
            restoredSettings: false,
            restoredFolders: false,
            restoredWorkspaces: false,
            errors: [],
          };
        }

        const selectiveZip = fflate.zipSync(selectedFiles, { level: 6 });
        const importResult = await importFromZip(
          _zipBytesToBase64(selectiveZip),
          { overwrite: true, recordReceipt: false },
        );
        if (importResult.error) {
          errors.push({ name: 'archive', error: importResult.error });
        }
        restoredScripts = importResult.imported;
        skippedScripts = importResult.skipped;
        if (Array.isArray(importResult.errors)) {
          errors.push(...importResult.errors);
        }
      } else {
        // Full restore: use importFromZip for all scripts at once
        try {
          const importResult = await importFromZip(backup.data, {
            overwrite: true,
            recordReceipt: false,
          });
          if (importResult.error) {
            errors.push({ name: 'archive', error: importResult.error });
          }
          restoredScripts = importResult.imported;
          skippedScripts = importResult.skipped;
          if (Array.isArray(importResult.errors)) {
            errors.push(...importResult.errors);
          }
        } catch (importErr: unknown) {
          console.warn('[BackupScheduler] Full import error:', importErr);
          errors.push({
            name: 'archive',
            error: importErr instanceof Error ? importErr.message : String(importErr),
          });
        }
      }

      // --- Restore global settings (full restore only) ---
      if (!options.selective) {
        const globalSettingsFile: Uint8Array | undefined =
          unzipped['global-settings.json'];
        if (globalSettingsFile) {
          try {
            const restoredSettingsData = parseArchiveJson<Record<string, unknown>>(
              unzipped,
              'global-settings.json',
              ARCHIVE_MAX_JSON_ENTRY_BYTES,
            );
            const settingsRestore = _prepareSettingsForRestore(restoredSettingsData, {
              allowCredentials:
                options.importSettingsCredentials === true &&
                settingsMetadata.settingsCredentialsIncluded === true,
            });
            await SettingsManager.set(settingsRestore.settings as never);
            restoredSettings = true;
            settingsCredentialsRestored = settingsRestore.settingsCredentialsRestored;
            skippedSettingsCredentialKeys = settingsRestore.skippedSettingsCredentialKeys;
          } catch (settingsErr: unknown) {
            errors.push({
              name: 'global-settings.json',
              error: settingsErr instanceof Error ? settingsErr.message : String(settingsErr),
            });
          }
        }

        // Restore folders
        const foldersFile: Uint8Array | undefined =
          unzipped['folders.json'];
        if (foldersFile) {
          try {
            const folders: unknown = parseArchiveJson<unknown>(
              unzipped,
              'folders.json',
              ARCHIVE_MAX_JSON_ENTRY_BYTES,
            );
            await chrome.storage.local.set({ scriptFolders: folders });
            FolderStorage.cache = null;
            restoredFolders = true;
          } catch (foldersErr: unknown) {
            errors.push({
              name: 'folders.json',
              error: foldersErr instanceof Error ? foldersErr.message : String(foldersErr),
            });
          }
        }

        // Restore workspaces
        const workspacesFile: Uint8Array | undefined =
          unzipped['workspaces.json'];
        if (workspacesFile) {
          try {
            const workspaces: unknown = parseArchiveJson<unknown>(
              unzipped,
              'workspaces.json',
              ARCHIVE_MAX_JSON_ENTRY_BYTES,
            );
            await chrome.storage.local.set({ workspaces });
            const workspaceManager = (globalThis as {
              WorkspaceManager?: { _cache?: unknown; _initPromise?: unknown };
            }).WorkspaceManager;
            if (workspaceManager) {
              workspaceManager._cache = null;
              workspaceManager._initPromise = null;
            }
            restoredWorkspaces = true;
          } catch (workspacesErr: unknown) {
            errors.push({
              name: 'workspaces.json',
              error: workspacesErr instanceof Error ? workspacesErr.message : String(workspacesErr),
            });
          }
        }
      }

      const success =
        errors.length === 0 ||
        restoredScripts > 0 ||
        restoredSettings ||
        restoredFolders ||
        restoredWorkspaces;
      const result: RestoreResult = {
        success,
        restoredScripts,
        skippedScripts,
        restoredSettings,
        restoredFolders,
        restoredWorkspaces,
        settingsCredentialsRestored,
        skippedSettingsCredentialKeys,
        errors,
      };

      if (
        recordReceipt &&
        snapshot &&
        (restoredScripts > 0 ||
          restoredSettings ||
          restoredFolders ||
          restoredWorkspaces)
      ) {
        try {
          let scriptIdsAfter: string[] = [];
          try {
            const after = await ScriptStorage.getAll();
            scriptIdsAfter = after
              .map((script) => script.id)
              .filter((id): id is string => typeof id === 'string');
          } catch (_) {
            /* empty */
          }
          const beforeSet = new Set(snapshot.scriptIdsBefore || []);
          const addedScriptIds = scriptIdsAfter.filter((id) => !beforeSet.has(id));
          const receipt: RestoreReceipt = {
            id: _generateId(),
            type: 'restore',
            source: 'backup-restore',
            sourceLabel,
            timestamp: Date.now(),
            backupId,
            backupTimestamp: backup.timestamp,
            selective: !!options.selective,
            result,
            snapshot: {
              ...snapshot,
              addedScriptIds,
            },
          };
          await _pushReceipt(receipt);
          result.receiptId = receipt.id;
        } catch (receiptErr: unknown) {
          console.warn(
            '[BackupScheduler] restoreBackup failed to persist receipt:',
            receiptErr,
          );
        }
      }

      return result;
    } catch (err: unknown) {
      console.error('[BackupScheduler] restoreBackup error:', err);
      const errMsg: string =
        err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  },

  /**
   * Delete a specific backup.
   */
  async deleteBackup(backupId: string): Promise<DeleteResult> {
    const backups: BackupEntry[] = await _getBackupList();
    const filtered: BackupEntry[] = backups.filter(
      (b: BackupEntry) => b.id !== backupId,
    );
    if (filtered.length === backups.length)
      return { success: false, error: 'Backup not found' };
    await _saveBackupList(filtered);
    return { success: true };
  },

  /**
   * Export a backup as a downloadable object (base64 ZIP + suggested filename).
   */
  async exportBackup(
    backupId: string,
  ): Promise<ExportedBackup | null> {
    const backups: BackupEntry[] = await _getBackupList();
    const backup: BackupEntry | undefined = backups.find(
      (b: BackupEntry) => b.id === backupId,
    );
    if (!backup) return null;

    const dateStr: string = new Date(backup.timestamp)
      .toISOString()
      .replace(/[:.]/g, '-');
    return {
      zipData: backup.data,
      filename: `scriptvault-autobackup-${dateStr}.zip`,
    };
  },

  /**
   * Import a backup from externally provided base64 ZIP data.
   */
  async importBackup(data: string): Promise<BackupResult> {
    try {
      const unzipped: Record<string, Uint8Array> = unzipArchiveBounded(data);
      const fileNames: string[] = Object.keys(unzipped);
      const scriptFiles: string[] = Object.keys(unzipped).filter(
        (n: string) => n.endsWith('.user.js'),
      );
      const hasGlobalSettings = fileNames.includes('global-settings.json');
      const hasFolders = fileNames.includes('folders.json');
      const hasWorkspaces = fileNames.includes('workspaces.json');
      const hasScriptStorage = fileNames.some((name) => name.endsWith('.storage.json'));
      const settingsMetadata = _readSettingsMetadata(unzipped);
      if (scriptFiles.length === 0 && !hasGlobalSettings && !hasFolders && !hasWorkspaces) {
        return {
          success: false,
          error: 'This ZIP does not look like a ScriptVault backup archive.',
        };
      }

      const sizeBytes: number = Math.round(data.length * 0.75);
      const backup: BackupEntry = {
        id: _generateId(),
        timestamp: Date.now(),
        version: 'imported',
        reason: 'imported',
        scriptCount: scriptFiles.length,
        hasGlobalSettings,
        hasFolders,
        hasWorkspaces,
        hasScriptStorage,
        settingsCredentialsIncluded: settingsMetadata.settingsCredentialsIncluded,
        redactedSettingsCredentialKeys: settingsMetadata.redactedSettingsCredentialKeys,
        size: sizeBytes,
        sizeFormatted: _formatBytes(sizeBytes),
        data,
      };

      await BackupScheduler.pruneOldBackups();
      const backups: BackupEntry[] = await _getBackupList();
      backups.unshift(backup);
      await _saveBackupList(backups);

      return { success: true, backupId: backup.id };
    } catch (err: unknown) {
      console.error('[BackupScheduler] importBackup error:', err);
      const errMsg: string =
        err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  },

  /**
   * Get current scheduler settings.
   */
  getSettings(): BackupSchedulerSettings {
    return { ...DEFAULT_SETTINGS, ...(_settings ?? {}) };
  },

  /**
   * Update scheduler settings and re-register alarms.
   */
  async setSettings(
    settings: Partial<BackupSchedulerSettings>,
  ): Promise<BackupSchedulerSettingsResult> {
    const merged: BackupSchedulerSettings = {
      ...(await _loadSettings()),
      ...settings,
    };
    await _saveSettings(merged);
    await _registerAlarms();
    const prunedCount = await BackupScheduler.pruneOldBackups();
    return { ..._settings!, prunedCount };
  },

  /**
   * Remove old backups exceeding the retention limit.
   */
  async pruneOldBackups(): Promise<number> {
    const settings: BackupSchedulerSettings = await _loadSettings();
    const backups: BackupEntry[] = await _getBackupList();
    // Defensively clamp maxBackups: a negative value would make slice() keep
    // the OLDEST backups, and NaN/non-numeric would slice to [] and wipe all.
    const rawMax = Number(settings.maxBackups);
    const maxBackups = Number.isFinite(rawMax) && rawMax >= 0 ? Math.floor(rawMax) : 5;
    if (backups.length <= maxBackups) return 0;

    // Keep the newest N
    const pruned: BackupEntry[] = backups.slice(0, maxBackups);
    await _saveBackupList(pruned);
    return Math.max(0, backups.length - pruned.length);
  },

  /**
   * Called externally when a script is installed, updated, or deleted.
   * If scheduleType is 'onChange', sets a debounce alarm.
   */
  async onScriptChanged(): Promise<void> {
    const settings: BackupSchedulerSettings = await _loadSettings();
    if (!settings.enabled || settings.scheduleType !== 'onChange') return;

    // Debounce: clear any pending alarm and set a new one
    await chrome.alarms.clear(DEBOUNCE_ALARM);
    chrome.alarms.create(DEBOUNCE_ALARM, {
      delayInMinutes: DEBOUNCE_MINUTES,
    });
  },

  /**
   * Get a detailed manifest of what's inside a specific backup
   * (script names and sizes) without decompressing the whole thing to memory.
   */
  async inspectBackup(
    backupId: string,
  ): Promise<InspectedBackupManifest | null> {
    const backups: BackupEntry[] = await _getBackupList();
    const backup: BackupEntry | undefined = backups.find(
      (b: BackupEntry) => b.id === backupId,
    );
    if (!backup) return null;

    try {
      const unzipped: Record<string, Uint8Array> = unzipArchiveBounded(backup.data);
      const fileNames: string[] = Object.keys(unzipped);
      const parseJsonFile = (fileName: string): unknown => {
        const fileData = unzipped[fileName];
        if (!fileData) return null;
        try {
          return parseArchiveJson<unknown>(unzipped, fileName);
        } catch {
          return null;
        }
      };
      const countEntries = (value: unknown): number => {
        if (Array.isArray(value)) return value.length;
        if (value && typeof value === 'object') return Object.keys(value).length;
        return 0;
      };
      const globalSettings = parseJsonFile('global-settings.json');
      const settingsMetadata = _readSettingsMetadata(unzipped, backup);
      const folderData = parseJsonFile('folders.json');
      const workspaceData = parseJsonFile('workspaces.json') as
        | { list?: unknown[]; active?: string }
        | unknown[]
        | null;
      const folderList = Array.isArray(folderData) ? folderData : [];
      const workspaceList = Array.isArray((workspaceData as { list?: unknown[] } | null)?.list)
        ? (workspaceData as { list: unknown[] }).list
        : Array.isArray(workspaceData)
          ? workspaceData
          : [];

      const scripts: InspectedScript[] = fileNames
        .filter((n: string) => n.endsWith('.user.js'))
        .map((n: string): InspectedScript => {
          const baseName: string = n.replace(/\.user\.js$/, '');
          const displayName: string = baseName.replace(
            /^scripts\//,
            '',
          );
          let scriptId: string | null = null;
          const optionsFileData = unzipped[`${baseName}.options.json`];
          if (optionsFileData) {
            try {
              const optionsData = parseArchiveJson<{
                scriptId?: string;
                meta?: { name?: string; namespace?: string };
              }>(unzipped, `${baseName}.options.json`, ARCHIVE_MAX_OPTIONS_BYTES);
              scriptId =
                typeof optionsData.scriptId === 'string'
                  ? optionsData.scriptId
                  : null;
              const name = optionsData.meta?.name || displayName;
              const namespace = optionsData.meta?.namespace || '';
              if (optionsData.meta?.name) {
                return {
                  id: scriptId || (namespace ? `${name}::${namespace}` : name),
                  name,
                  namespace,
                  hasStorage: !!unzipped[`${baseName}.storage.json`],
                };
              }
            } catch (_) {
              /* empty */
            }
          }
          return {
            id: scriptId || displayName,
            name: displayName,
            hasStorage: !!unzipped[`${baseName}.storage.json`],
          };
        });
      const scriptsWithStorageCount = scripts.filter((script) => script.hasStorage).length;

      return {
        scriptCount: scripts.length,
        scripts,
        scriptsWithStorageCount,
        hasGlobalSettings: !!unzipped['global-settings.json'],
        settingsKeyCount: countEntries(globalSettings),
        settingsCredentialsIncluded: settingsMetadata.settingsCredentialsIncluded,
        redactedSettingsCredentialKeys: settingsMetadata.redactedSettingsCredentialKeys,
        hasFolders: !!unzipped['folders.json'],
        folderCount: countEntries(folderData),
        folders: folderList.map((folder): InspectedFolder => {
          const value = folder && typeof folder === 'object' ? folder as Record<string, unknown> : {};
          return {
            id: typeof value.id === 'string' ? value.id : '',
            name: typeof value.name === 'string' ? value.name : 'Unnamed folder',
            scriptCount: Array.isArray(value.scriptIds) ? value.scriptIds.length : 0,
          };
        }),
        hasWorkspaces: !!unzipped['workspaces.json'],
        workspaceCount: workspaceList.length,
        workspaces: workspaceList.map((workspace): InspectedWorkspace => {
          const value = workspace && typeof workspace === 'object' ? workspace as Record<string, unknown> : {};
          return {
            id: typeof value.id === 'string' ? value.id : '',
            name: typeof value.name === 'string' ? value.name : 'Unnamed workspace',
            scriptCount: value.snapshot && typeof value.snapshot === 'object'
              ? Object.keys(value.snapshot).length
              : 0,
            active: !Array.isArray(workspaceData) && (workspaceData as { active?: string } | null)?.active === value.id,
          };
        }),
        activeWorkspaceId: !Array.isArray(workspaceData) && typeof (workspaceData as { active?: unknown } | null)?.active === 'string'
          ? (workspaceData as { active: string }).active
          : null,
      };
    } catch (err: unknown) {
      console.error('[BackupScheduler] inspectBackup error:', err);
      return null;
    }
  },

  /**
   * Verify a backup without mutating current scripts.
   */
  async verifyBackup(
    backupId: string,
    opts: {
      parseUserscript?: (code: string) => {
        error?: string;
        meta?: Record<string, unknown>;
      } | null;
    } = {},
  ): Promise<VerifyBackupResult | null> {
    const backups: BackupEntry[] = await _getBackupList();
    const backup: BackupEntry | undefined = backups.find(
      (b: BackupEntry) => b.id === backupId,
    );
    if (!backup) return null;

    const parseUserscript =
      typeof opts.parseUserscript === 'function' ? opts.parseUserscript : null;

    try {
      const unzipped: Record<string, Uint8Array> = unzipArchiveBounded(backup.data);
      const fileNames: string[] = Object.keys(unzipped);

      const installedIdSet = new Set<string>();
      try {
        const existing = await ScriptStorage.getAll();
        for (const script of existing) {
          if (script && typeof script.id === 'string') {
            installedIdSet.add(script.id);
          }
        }
      } catch (_) {
        /* empty */
      }

      const issues: VerifyIssue[] = [];
      let parseErrorCount = 0;
      let optionsParseErrors = 0;
      let storageParseErrors = 0;
      let unreadableFileCount = 0;
      let missingOptionsCount = 0;
      const missingStorageCount = 0;

      const scriptEntries: VerifiedScript[] = fileNames
        .filter((n: string) => n.endsWith('.user.js'))
        .map((filename: string): VerifiedScript => {
          const baseName: string = filename.replace(/\.user\.js$/, '');
          const displayName: string = baseName.replace(/^scripts\//, '');
          const optionsKey = `${baseName}.options.json`;
          const storageKey = `${baseName}.storage.json`;
          const scriptData = unzipped[filename];
          const optionsDataBytes = unzipped[optionsKey];
          const storageDataBytes = unzipped[storageKey];
          const hasOptions = !!optionsDataBytes;
          const hasStorage = !!storageDataBytes;

          let code = '';
          try {
            if (!scriptData) throw new Error('Missing script data');
            code = archiveEntryText(unzipped, filename, ARCHIVE_MAX_SCRIPT_BYTES);
          } catch (readErr: unknown) {
            unreadableFileCount++;
            const error = readErr instanceof Error ? readErr.message : String(readErr);
            issues.push({ kind: 'unreadable-script', file: filename, error });
            return {
              filename,
              name: displayName,
              namespace: '',
              hasOptions,
              hasStorage,
              parseError: error,
            };
          }

          let optionsData: Record<string, unknown> | null = null;
          if (hasOptions && optionsDataBytes) {
            try {
              optionsData = parseArchiveJson<Record<string, unknown>>(
                unzipped,
                optionsKey,
                ARCHIVE_MAX_OPTIONS_BYTES,
              );
            } catch (optErr: unknown) {
              optionsParseErrors++;
              issues.push({
                kind: 'options-parse',
                file: optionsKey,
                error: optErr instanceof Error ? optErr.message : String(optErr),
              });
            }
          } else {
            missingOptionsCount++;
          }

          if (hasStorage && storageDataBytes) {
            try {
              parseArchiveJson<unknown>(
                unzipped,
                storageKey,
                ARCHIVE_MAX_JSON_ENTRY_BYTES,
              );
            } catch (stErr: unknown) {
              storageParseErrors++;
              issues.push({
                kind: 'storage-parse',
                file: storageKey,
                error: stErr instanceof Error ? stErr.message : String(stErr),
              });
            }
          }

          let parseError = '';
          const rawMeta =
            optionsData?.['meta'] &&
            typeof optionsData['meta'] === 'object'
              ? (optionsData['meta'] as Record<string, unknown>)
              : {};
          let parsedMeta: Record<string, unknown> = rawMeta;
          if (parseUserscript) {
            const parsed = parseUserscript(code);
            if (parsed?.error) {
              parseError = parsed.error;
              parseErrorCount++;
              issues.push({
                kind: 'script-parse',
                file: filename,
                error: parsed.error,
              });
            } else if (parsed?.meta) {
              parsedMeta = parsed.meta;
            }
          } else if (!/==UserScript==/.test(code)) {
            parseError = 'Missing ==UserScript== header';
            parseErrorCount++;
            issues.push({ kind: 'script-parse', file: filename, error: parseError });
          }

          const scriptId =
            typeof optionsData?.['scriptId'] === 'string'
              ? optionsData['scriptId']
              : '';
          const name =
            typeof parsedMeta['name'] === 'string'
              ? parsedMeta['name']
              : displayName;
          const namespace =
            typeof parsedMeta['namespace'] === 'string'
              ? parsedMeta['namespace']
              : '';
          return {
            filename,
            name,
            namespace,
            hasOptions,
            hasStorage,
            parseError: parseError || undefined,
            scriptId: scriptId || undefined,
            conflictsWithId:
              scriptId && installedIdSet.has(scriptId) ? scriptId : undefined,
          };
        });

      let globalSettingsValid = true;
      let foldersValid = true;
      let workspacesValid = true;
      const settingsMetadata = _readSettingsMetadata(unzipped, backup);
      if (unzipped['global-settings.json']) {
        try {
          parseArchiveJson<unknown>(
            unzipped,
            'global-settings.json',
            ARCHIVE_MAX_JSON_ENTRY_BYTES,
          );
        } catch (err: unknown) {
          globalSettingsValid = false;
          issues.push({
            kind: 'global-settings-parse',
            file: 'global-settings.json',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (unzipped['folders.json']) {
        try {
          parseArchiveJson<unknown>(
            unzipped,
            'folders.json',
            ARCHIVE_MAX_JSON_ENTRY_BYTES,
          );
        } catch (err: unknown) {
          foldersValid = false;
          issues.push({
            kind: 'folders-parse',
            file: 'folders.json',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (unzipped['workspaces.json']) {
        try {
          parseArchiveJson<unknown>(
            unzipped,
            'workspaces.json',
            ARCHIVE_MAX_JSON_ENTRY_BYTES,
          );
        } catch (err: unknown) {
          workspacesValid = false;
          issues.push({
            kind: 'workspaces-parse',
            file: 'workspaces.json',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const validScripts = scriptEntries.filter((s) => !s.parseError).length;
      const valid = issues.length === 0;
      return {
        valid,
        scripts: scriptEntries,
        parseErrorCount,
        missingOptionsCount,
        missingStorageCount,
        unreadableFileCount,
        summary: {
          scriptCount: scriptEntries.length,
          validScripts,
          parseErrors: parseErrorCount,
          optionsParseErrors,
          storageParseErrors,
          globalSettingsValid,
          settingsCredentialsIncluded: settingsMetadata.settingsCredentialsIncluded,
          redactedSettingsCredentialKeyCount: settingsMetadata.redactedSettingsCredentialKeys.length,
          foldersValid,
          workspacesValid,
        },
        issues,
      };
    } catch (err: unknown) {
      console.error('[BackupScheduler] verifyBackup error:', err);
      return {
        valid: false,
        scripts: [],
        parseErrorCount: 0,
        missingOptionsCount: 0,
        missingStorageCount: 0,
        unreadableFileCount: 0,
        summary: {
          scriptCount: 0,
          validScripts: 0,
          parseErrors: 0,
          optionsParseErrors: 0,
          storageParseErrors: 0,
          globalSettingsValid: false,
          settingsCredentialsIncluded: false,
          redactedSettingsCredentialKeyCount: 0,
          foldersValid: false,
          workspacesValid: false,
        },
        issues: [{
          kind: 'archive',
          file: backupId,
          error: err instanceof Error ? err.message : String(err),
        }],
      };
    }
  },

  /**
   * List persisted restore/import receipts (metadata only, no snapshot blob).
   */
  async listReceipts(): Promise<RestoreReceiptMeta[]> {
    const receipts = await _getReceipts();
    return receipts.map(_snapshotMeta).filter((meta): meta is RestoreReceiptMeta => !!meta);
  },

  /**
   * Fetch a single receipt with its full snapshot blob.
   */
  async getReceipt(receiptId: string): Promise<RestoreReceipt | null> {
    const receipts = await _getReceipts();
    return receipts.find((receipt) => receipt?.id === receiptId) ?? null;
  },

  /**
   * Record an import receipt in the same registry as restore receipts.
   */
  async recordReceipt(
    receipt: Partial<RestoreReceipt> | null,
  ): Promise<RestoreReceiptMeta | null> {
    if (!receipt || typeof receipt !== 'object') return null;
    const snapshot = receipt.snapshot ?? {
      scriptsBefore: [],
      valuesBefore: {},
      scriptIdsBefore: [],
    };
    const next: RestoreReceipt = {
      id: receipt.id || _generateId(),
      timestamp: receipt.timestamp || Date.now(),
      type: receipt.type || 'import',
      source: receipt.source || 'import',
      sourceLabel: receipt.sourceLabel || '',
      backupId: receipt.backupId || null,
      result: receipt.result || null,
      snapshot,
    };
    await _pushReceipt(next);
    return _snapshotMeta(next);
  },

  /**
   * Roll a restore or import receipt back.
   */
  async rollbackRestoreReceipt(
    receiptId: string,
    opts: RollbackRestoreOptions = {},
  ): Promise<RollbackRestoreResult> {
    const receipts = await _getReceipts();
    const receipt = receipts.find((r) => r?.id === receiptId);
    if (!receipt) return { success: false, error: 'Receipt not found' };
    if (receipt.rolledBackAt) {
      return {
        success: false,
        error: 'Receipt already rolled back',
        alreadyRolledBack: true,
        rolledBackAt: receipt.rolledBackAt,
      };
    }

    const snapshot = receipt.snapshot ?? {
      scriptsBefore: [],
      valuesBefore: {},
      scriptIdsBefore: [],
    };
    const scriptsBefore = Array.isArray(snapshot.scriptsBefore)
      ? snapshot.scriptsBefore
      : [];
    const valuesBefore =
      snapshot.valuesBefore && typeof snapshot.valuesBefore === 'object'
        ? snapshot.valuesBefore
        : {};
    const restoreGlobals = opts.restoreGlobals !== false;

    const errors: RollbackRestoreError[] = [];
    let restoredScripts = 0;
    let removedScripts = 0;
    let restoredValues = 0;
    const restoredScriptIds: string[] = [];

    for (const script of scriptsBefore) {
      if (!script || typeof script.id !== 'string') continue;
      try {
        await ScriptStorage.set(script.id, structuredClone(script));
        restoredScriptIds.push(script.id);
        restoredScripts++;
      } catch (err: unknown) {
        errors.push({
          kind: 'script',
          name: script.meta?.name || script.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const [scriptId, values] of Object.entries(valuesBefore)) {
      if (
        typeof ScriptValues === 'undefined' ||
        !ScriptValues ||
        typeof ScriptValues.setAll !== 'function'
      ) {
        break;
      }
      try {
        if (typeof ScriptValues.deleteAll === 'function') {
          await ScriptValues.deleteAll(scriptId);
        }
        await ScriptValues.setAll(scriptId, values);
        restoredValues++;
      } catch (err: unknown) {
        errors.push({
          kind: 'values',
          name: scriptId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const beforeIdSet = new Set(
      Array.isArray(snapshot.scriptIdsBefore) ? snapshot.scriptIdsBefore : [],
    );
    let scriptIdsAfter: string[] = [];
    try {
      const after = await ScriptStorage.getAll();
      scriptIdsAfter = after
        .map((script) => script.id)
        .filter((id): id is string => typeof id === 'string');
    } catch (err: unknown) {
      errors.push({
        kind: 'getAll',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const addedFromSnapshot = Array.isArray(snapshot.addedScriptIds)
      ? snapshot.addedScriptIds
      : null;
    const toDelete = addedFromSnapshot
      ? addedFromSnapshot.filter((id) => scriptIdsAfter.includes(id))
      : scriptIdsAfter.filter((id) => !beforeIdSet.has(id));
    for (const id of toDelete) {
      try {
        if (
          typeof ScriptValues !== 'undefined' &&
          ScriptValues &&
          typeof ScriptValues.deleteAll === 'function'
        ) {
          try {
            await ScriptValues.deleteAll(id);
          } catch (_) {
            /* empty */
          }
        }
        await ScriptStorage.delete(id);
        removedScripts++;
      } catch (err: unknown) {
        errors.push({
          kind: 'script-delete',
          name: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let restoredSettings = false;
    let restoredFolders = false;
    let restoredWorkspaces = false;
    if (restoreGlobals) {
      if (snapshot.settings !== undefined) {
        try {
          await SettingsManager.set(structuredClone(snapshot.settings));
          restoredSettings = true;
        } catch (err: unknown) {
          errors.push({
            kind: 'settings',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (snapshot.folders !== undefined) {
        try {
          await chrome.storage.local.set({
            scriptFolders: structuredClone(snapshot.folders),
          });
          if (typeof FolderStorage !== 'undefined' && FolderStorage) {
            FolderStorage.cache = null;
          }
          restoredFolders = true;
        } catch (err: unknown) {
          errors.push({
            kind: 'folders',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (snapshot.workspaces !== undefined) {
        try {
          await chrome.storage.local.set({
            workspaces: structuredClone(snapshot.workspaces),
          });
          if (typeof WorkspaceManager !== 'undefined' && WorkspaceManager) {
            WorkspaceManager._cache = null;
            WorkspaceManager._initPromise = null;
          }
          restoredWorkspaces = true;
        } catch (err: unknown) {
          errors.push({
            kind: 'workspaces',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const rollbackResult = {
      receiptId,
      restoredScripts,
      removedScripts,
      restoredValues,
      restoredSettings,
      restoredFolders,
      restoredWorkspaces,
      errors,
      restoredScriptIds,
      removedScriptIds: toDelete,
    };
    const success = errors.length === 0;
    await _updateReceipt(receiptId, {
      rolledBackAt: Date.now(),
      rollbackError: success
        ? null
        : errors.map((error) => `${error.kind}: ${error.error}`).join('; '),
      rollbackResult: { ...rollbackResult, success },
    });

    return { success, ...rollbackResult };
  },

  /** Clear all persisted receipts. */
  async clearReceipts(): Promise<{ success: true }> {
    await _saveReceipts([]);
    return { success: true };
  },
};

export default BackupScheduler;
