// ============================================================================
// ScriptVault — Automated Backup Scheduler
// Runs in the service worker (no DOM). Provides scheduled and on-change
// backups using chrome.alarms, with configurable retention and recovery.
// ============================================================================

import type { Script } from '../types/index';
import { ScriptStorage, ScriptValues, SettingsManager } from './storage';

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

interface BackupEntry {
  id: string;
  timestamp: number;
  version: string;
  reason: BackupReason;
  scriptCount: number;
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
  id?: string | null;
  name: string;
  hasStorage: boolean;
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
  const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  const stored = data[STORAGE_KEY_SETTINGS] as
    | Partial<BackupSchedulerSettings>
    | undefined;
  _settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  return _settings;
}

async function _saveSettings(
  settings: BackupSchedulerSettings,
): Promise<void> {
  _settings = { ...DEFAULT_SETTINGS, ...settings };
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
}> {
  // Scripts — code + metadata + settings
  const scripts: Script[] = await ScriptStorage.getAll();
  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();

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
      }
    } catch (_) {
      /* ScriptValues may not be available */
    }
  }

  // Global settings
  try {
    const globalSettings = await SettingsManager.get();
    files['global-settings.json'] = fflate.strToU8(
      JSON.stringify(globalSettings, null, 2),
    );
  } catch (_) {
    /* empty */
  }

  // Folder structure (if any)
  try {
    const folderData = await chrome.storage.local.get('scriptFolders');
    if (folderData['scriptFolders']) {
      files['folders.json'] = fflate.strToU8(
        JSON.stringify(folderData['scriptFolders'], null, 2),
      );
    }
  } catch (_) {
    /* empty */
  }

  // Workspace snapshots
  try {
    const wsData = await chrome.storage.local.get('workspaces');
    if (wsData['workspaces']) {
      files['workspaces.json'] = fflate.strToU8(
        JSON.stringify(wsData['workspaces'], null, 2),
      );
    }
  } catch (_) {
    /* empty */
  }

  // Compress
  const zipData: Uint8Array = fflate.zipSync(files, { level: 6 });
  return { base64: _zipBytesToBase64(zipData), scriptCount: scripts.length };
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
  // Clear existing backup alarms
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(DEBOUNCE_ALARM);

  const settings: BackupSchedulerSettings = await _loadSettings();
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
      const { base64, scriptCount } = await _collectBackupData();
      const sizeBytes: number = Math.round(base64.length * 0.75); // approximate binary size
      const settings: BackupSchedulerSettings = await _loadSettings();

      const backup: BackupEntry = {
        id: _generateId(),
        timestamp: Date.now(),
        version: chrome.runtime.getManifest?.()?.version ?? '1.0',
        reason,
        scriptCount,
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
          let optionsMeta: {
            scriptId?: string;
            meta?: { name?: string };
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
            } catch (_) {
              /* empty */
            }
          }

          const matchesSelection =
            selectedRefs.has(scriptName) ||
            selectedRefs.has(displayName) ||
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
          return { success: true, restoredScripts: 0 };
        }

        const selectiveZip = fflate.zipSync(selectedFiles, { level: 6 });
        const importResult = await importFromZip(
          _zipBytesToBase64(selectiveZip),
          { overwrite: true },
        );
        if (importResult.error) {
          return { success: false, error: importResult.error };
        }
        restoredScripts = importResult.imported;
      } else {
        // Full restore: use importFromZip for all scripts at once
        try {
          await importFromZip(backup.data, { overwrite: true });
          restoredScripts = userScripts.length;
        } catch (importErr: unknown) {
          console.warn('[BackupScheduler] Full import error:', importErr);
        }
      }

      // --- Restore global settings (full restore only) ---
      if (!options.selective) {
        const globalSettingsFile: Uint8Array | undefined =
          unzipped['global-settings.json'];
        if (globalSettingsFile) {
          try {
            const restoredSettings = JSON.parse(
              fflate.strFromU8(globalSettingsFile),
            ) as Record<string, unknown>;
            await SettingsManager.set(restoredSettings as never);
          } catch (_) {
            /* empty */
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
          } catch (_) {
            /* empty */
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
          } catch (_) {
            /* empty */
          }
        }
      }

      return { success: true, restoredScripts };
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
      const scriptFiles: string[] = Object.keys(unzipped).filter(
        (n: string) => n.endsWith('.user.js'),
      );

      const sizeBytes: number = Math.round(data.length * 0.75);
      const backup: BackupEntry = {
        id: _generateId(),
        timestamp: Date.now(),
        version: 'imported',
        reason: 'imported',
        scriptCount: scriptFiles.length,
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
  ): Promise<BackupSchedulerSettings> {
    const merged: BackupSchedulerSettings = {
      ...(await _loadSettings()),
      ...settings,
    };
    await _saveSettings(merged);
    await _registerAlarms();
    return { ..._settings! };
  },

  /**
   * Remove old backups exceeding the retention limit.
   */
  async pruneOldBackups(): Promise<void> {
    const settings: BackupSchedulerSettings = await _loadSettings();
    const backups: BackupEntry[] = await _getBackupList();
    if (backups.length <= settings.maxBackups) return;

    // Keep the newest N
    const pruned: BackupEntry[] = backups.slice(0, settings.maxBackups);
    await _saveBackupList(pruned);
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
  ): Promise<InspectedScript[] | null> {
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
              ) as { scriptId?: string; meta?: { name?: string } };
              scriptId =
                typeof optionsData.scriptId === 'string'
                  ? optionsData.scriptId
                  : null;
              if (optionsData.meta?.name) {
                return {
                  id: scriptId,
                  name: optionsData.meta.name,
                  hasStorage: !!unzipped[`${baseName}.storage.json`],
                };
              }
            } catch (_) {
              /* empty */
            }
          }
          return {
            id: scriptId,
            name: displayName,
            hasStorage: !!unzipped[`${baseName}.storage.json`],
          };
        });

      return scripts;
    } catch (err: unknown) {
      console.error('[BackupScheduler] inspectBackup error:', err);
      return null;
    }
  },
};

export default BackupScheduler;
