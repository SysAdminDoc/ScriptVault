// ============================================================================
// ScriptVault — Automated Backup Scheduler
// Runs in the service worker (no DOM). Provides scheduled and on-change
// backups using chrome.alarms, with configurable retention and recovery.
// ============================================================================

import type { Script } from '../types/index';
import { ScriptStorage, ScriptValues, SettingsManager, FolderStorage } from './storage';

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
};

declare function importFromZip(
  zipData: string,
  options?: { overwrite?: boolean },
): Promise<{
  imported: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
  error?: string;
}>;

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
  errors?: Array<{ name: string; error: string }>;
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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_BACKUPS = 'autoBackups';
const STORAGE_KEY_SETTINGS = 'backupSchedulerSettings';
const ALARM_NAME = 'sv_backup_scheduled';
const DEBOUNCE_ALARM = 'sv_backup_debounce';
const DEBOUNCE_MINUTES = 5;
const STORAGE_WARNING_BYTES: number = 8 * 1024 * 1024; // 8 MB

const DEFAULT_SETTINGS: BackupSchedulerSettings = {
  enabled: false,
  scheduleType: 'daily',
  hour: 3,
  dayOfWeek: 0,
  maxBackups: 5,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  warnOnStorageFull: true,
};

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
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
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
async function _collectBackupData(): Promise<{
  base64: string;
  scriptCount: number;
  hasGlobalSettings: boolean;
  hasFolders: boolean;
  hasWorkspaces: boolean;
  hasScriptStorage: boolean;
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
  try {
    const globalSettings = await SettingsManager.get();
    files['global-settings.json'] = fflate.strToU8(
      JSON.stringify(globalSettings, null, 2),
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
      const {
        base64,
        scriptCount,
        hasGlobalSettings,
        hasFolders,
        hasWorkspaces,
        hasScriptStorage,
      } = await _collectBackupData();
      const sizeBytes: number = Math.round(base64.length * 0.75); // approximate binary size
      const settings: BackupSchedulerSettings = await _loadSettings();

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
        size: sizeBytes,
        sizeFormatted: _formatBytes(sizeBytes),
        data: base64,
      };

      const backups: BackupEntry[] = await _getBackupList();
      backups.unshift(backup); // newest first
      await _saveBackupList(backups);

      // Prune old backups
      await BackupScheduler.pruneOldBackups();

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

    try {
      const binaryString: string = atob(backup.data);
      const zipBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        zipBytes[i] = binaryString.charCodeAt(i);
      }
      const unzipped: Record<string, Uint8Array> =
        fflate.unzipSync(zipBytes);
      const fileNames: string[] = Object.keys(unzipped);
      let restoredScripts = 0;
      let skippedScripts = 0;
      let restoredSettings = false;
      let restoredFolders = false;
      let restoredWorkspaces = false;
      const errors: Array<{ name: string; error: string }> = [];

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
              optionsMeta = JSON.parse(
                fflate.strFromU8(optionsFileData),
              ) as typeof optionsMeta;
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
          { overwrite: true },
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
          const importResult = await importFromZip(backup.data, { overwrite: true });
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
            const restoredSettingsData = JSON.parse(
              fflate.strFromU8(globalSettingsFile),
            ) as Record<string, unknown>;
            await SettingsManager.set(restoredSettingsData as never);
            restoredSettings = true;
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
            const folders: unknown = JSON.parse(
              fflate.strFromU8(foldersFile),
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
            const workspaces: unknown = JSON.parse(
              fflate.strFromU8(workspacesFile),
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
      return {
        success,
        restoredScripts,
        skippedScripts,
        restoredSettings,
        restoredFolders,
        restoredWorkspaces,
        errors,
      };
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
      // Validate that the data is a valid ZIP
      const binaryString: string = atob(data);
      const zipBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        zipBytes[i] = binaryString.charCodeAt(i);
      }
      const unzipped: Record<string, Uint8Array> =
        fflate.unzipSync(zipBytes);
      const fileNames: string[] = Object.keys(unzipped);
      const scriptFiles: string[] = Object.keys(unzipped).filter(
        (n: string) => n.endsWith('.user.js'),
      );
      const hasGlobalSettings = fileNames.includes('global-settings.json');
      const hasFolders = fileNames.includes('folders.json');
      const hasWorkspaces = fileNames.includes('workspaces.json');
      const hasScriptStorage = fileNames.some((name) => name.endsWith('.storage.json'));
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
        size: sizeBytes,
        sizeFormatted: _formatBytes(sizeBytes),
        data,
      };

      const backups: BackupEntry[] = await _getBackupList();
      backups.unshift(backup);
      await _saveBackupList(backups);
      await BackupScheduler.pruneOldBackups();

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
      const binaryString: string = atob(backup.data);
      const zipBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        zipBytes[i] = binaryString.charCodeAt(i);
      }
      const unzipped: Record<string, Uint8Array> =
        fflate.unzipSync(zipBytes);
      const fileNames: string[] = Object.keys(unzipped);
      const parseJsonFile = (fileName: string): unknown => {
        const fileData = unzipped[fileName];
        if (!fileData) return null;
        try {
          return JSON.parse(fflate.strFromU8(fileData));
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
              const optionsData = JSON.parse(
                fflate.strFromU8(optionsFileData),
              ) as { scriptId?: string; meta?: { name?: string; namespace?: string } };
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
};

export default BackupScheduler;
