// ============================================================================
// ScriptVault — Automated Backup Scheduler
// Runs in the service worker (no DOM). Provides scheduled and on-change
// backups using chrome.alarms, with configurable retention and recovery.
// ============================================================================

const BackupScheduler = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY_BACKUPS = 'autoBackups';
  const STORAGE_KEY_SETTINGS = 'backupSchedulerSettings';
  const STORAGE_KEY_RECEIPTS = 'restoreReceipts';
  const RECEIPT_RETENTION = 10;
  const ALARM_NAME = 'sv_backup_scheduled';
  const DEBOUNCE_ALARM = 'sv_backup_debounce';
  const DEBOUNCE_MINUTES = 5;
  const STORAGE_WARNING_BYTES = 8 * 1024 * 1024; // 8 MB

  const DEFAULT_SETTINGS = {
    enabled: false,
    scheduleType: 'daily',    // 'daily' | 'weekly' | 'onChange' | 'manual'
    hour: 3,                  // 0-23, default 3:00 AM
    dayOfWeek: 0,             // 0=Sun .. 6=Sat (for weekly)
    maxBackups: 5,            // retention limit
    notifyOnSuccess: true,
    notifyOnFailure: true,
    warnOnStorageFull: true
  };

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _settings = null;
  let _initialized = false;
  let _settingsLoadPromise = null;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function _zipBytesToBase64(zipData) {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < zipData.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(zipData.subarray(i, i + chunkSize)));
    }
    return btoa(binary);
  }

  /** Compute the next Date for a given hour (and optional dayOfWeek). */
  function _nextScheduledTime(hour, dayOfWeek) {
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
  function _notify(title, message, isError = false) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: `ScriptVault — ${title}`,
        message
      });
    } catch (_) { /* notifications permission may not exist */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Settings                                                           */
  /* ------------------------------------------------------------------ */

  async function _loadSettings() {
    if (_settings) return _settings;
    if (_settingsLoadPromise) return _settingsLoadPromise;
    _settingsLoadPromise = (async () => {
      const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
      _settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEY_SETTINGS] || {}) };
      return _settings;
    })();
    return _settingsLoadPromise;
  }

  async function _saveSettings(settings) {
    _settings = { ...DEFAULT_SETTINGS, ...settings };
    _settingsLoadPromise = null;
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: _settings });
  }

  /* ------------------------------------------------------------------ */
  /*  Backup data collection                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Collect all data that should be in a backup and produce a base64 ZIP
   * by reusing the same fflate-based pattern as exportToZip.
   */
  async function _collectBackupData() {
    // Scripts — code + metadata + settings
    const scripts = await ScriptStorage.getAll();
    const files = {};
    const usedNames = new Set();
    let hasScriptStorage = false;

    for (const script of scripts) {
      let safeName = (script.meta?.name || 'unnamed')
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
          'run-at': script.meta?.['run-at'] || 'document-idle'
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
          resource: script.meta?.resource || {}
        }
      };
      files[`scripts/${safeName}.options.json`] = fflate.strToU8(JSON.stringify(options, null, 2));

      // Script values (GM_getValue data)
      try {
        const values = await ScriptValues.getAll(script.id);
        if (values && Object.keys(values).length > 0) {
          files[`scripts/${safeName}.storage.json`] = fflate.strToU8(JSON.stringify({ data: values }, null, 2));
          hasScriptStorage = true;
        }
      } catch (_) { /* ScriptValues may not be available */ }
    }

    // Global settings
    let hasGlobalSettings = false;
    try {
      const globalSettings = await SettingsManager.get();
      files['global-settings.json'] = fflate.strToU8(JSON.stringify(globalSettings, null, 2));
      hasGlobalSettings = true;
    } catch (_) {}

    // Folder structure (if any)
    let hasFolders = false;
    try {
      const folderData = await chrome.storage.local.get('scriptFolders');
      if (folderData.scriptFolders) {
        files['folders.json'] = fflate.strToU8(JSON.stringify(folderData.scriptFolders, null, 2));
        hasFolders = true;
      }
    } catch (_) {}

    // Workspace snapshots
    let hasWorkspaces = false;
    try {
      const wsData = await chrome.storage.local.get('workspaces');
      if (wsData.workspaces) {
        files['workspaces.json'] = fflate.strToU8(JSON.stringify(wsData.workspaces, null, 2));
        hasWorkspaces = true;
      }
    } catch (_) {}

    // Compress
    const zipData = fflate.zipSync(files, { level: 6 });
    return {
      base64: _zipBytesToBase64(zipData),
      scriptCount: scripts.length,
      hasGlobalSettings,
      hasFolders,
      hasWorkspaces,
      hasScriptStorage
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Storage helpers                                                    */
  /* ------------------------------------------------------------------ */

  async function _getBackupList() {
    const data = await chrome.storage.local.get(STORAGE_KEY_BACKUPS);
    return data[STORAGE_KEY_BACKUPS] || [];
  }

  async function _saveBackupList(list) {
    await chrome.storage.local.set({ [STORAGE_KEY_BACKUPS]: list });
  }

  /* ------------------------------------------------------------------ */
  /*  Restore receipts                                                   */
  /* ------------------------------------------------------------------ */

  // Receipts capture the pre-restore (or pre-import overwrite) script state
  // so the operation can be rolled back. Persisted in chrome.storage.local
  // under STORAGE_KEY_RECEIPTS as a FIFO list (newest first) capped at
  // RECEIPT_RETENTION entries.

  async function _getReceipts() {
    const data = await chrome.storage.local.get(STORAGE_KEY_RECEIPTS);
    return Array.isArray(data[STORAGE_KEY_RECEIPTS]) ? data[STORAGE_KEY_RECEIPTS] : [];
  }

  async function _saveReceipts(list) {
    await chrome.storage.local.set({ [STORAGE_KEY_RECEIPTS]: list });
  }

  async function _pushReceipt(receipt) {
    const receipts = await _getReceipts();
    receipts.unshift(receipt);
    if (receipts.length > RECEIPT_RETENTION) {
      receipts.length = RECEIPT_RETENTION;
    }
    await _saveReceipts(receipts);
    return receipt;
  }

  async function _updateReceipt(receiptId, patch) {
    const receipts = await _getReceipts();
    const idx = receipts.findIndex(r => r && r.id === receiptId);
    if (idx === -1) return null;
    receipts[idx] = { ...receipts[idx], ...patch };
    await _saveReceipts(receipts);
    return receipts[idx];
  }

  function _snapshotMeta(receipt) {
    if (!receipt) return null;
    const snapshot = receipt.snapshot || {};
    const scriptsBefore = Array.isArray(snapshot.scriptsBefore) ? snapshot.scriptsBefore : [];
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
      snapshotIdSetSize: Array.isArray(snapshot.scriptIdsBefore) ? snapshot.scriptIdsBefore.length : 0,
      hasGlobalSettings: !!snapshot.settings,
      hasFolders: !!snapshot.folders,
      hasWorkspaces: !!snapshot.workspaces
    };
  }

  /**
   * Build a pre-restore snapshot of the entire script + values state plus
   * (when full restore) global settings, folders, and workspaces. Records
   * the full id set so a rollback can identify scripts that were added by
   * the restore and need to be removed.
   */
  async function _captureSnapshot({ includeGlobals = false } = {}) {
    const scriptsBefore = [];
    const valuesBefore = {};
    let scriptIdsBefore = [];
    try {
      const all = await ScriptStorage.getAll();
      scriptIdsBefore = all.map(script => script.id).filter(id => typeof id === 'string');
      for (const script of all) {
        scriptsBefore.push(structuredClone(script));
        if (typeof ScriptValues !== 'undefined' && ScriptValues && typeof ScriptValues.getAll === 'function') {
          try {
            const values = await ScriptValues.getAll(script.id);
            if (values && Object.keys(values).length > 0) {
              valuesBefore[script.id] = structuredClone(values);
            }
          } catch (_) { /* ignore per-script value snapshot errors */ }
        }
      }
    } catch (_) { /* getAll may fail in degraded harnesses; receipt still useful */ }

    const snapshot = {
      scriptsBefore,
      valuesBefore,
      scriptIdsBefore
    };

    if (includeGlobals) {
      try {
        snapshot.settings = structuredClone(await SettingsManager.get());
      } catch (_) {}
      try {
        const folderData = await chrome.storage.local.get('scriptFolders');
        if (folderData && folderData.scriptFolders !== undefined) {
          snapshot.folders = structuredClone(folderData.scriptFolders);
        }
      } catch (_) {}
      try {
        const wsData = await chrome.storage.local.get('workspaces');
        if (wsData && wsData.workspaces !== undefined) {
          snapshot.workspaces = structuredClone(wsData.workspaces);
        }
      } catch (_) {}
    }

    return snapshot;
  }

  /** Estimate combined size of all stored backups (bytes). */
  function _estimateBackupSize(backups) {
    let total = 0;
    for (const b of backups) {
      // base64 string length is ~4/3 of binary; approximate storage cost
      total += (b.data?.length || 0);
    }
    return total;
  }

  /* ------------------------------------------------------------------ */
  /*  Alarm management                                                   */
  /* ------------------------------------------------------------------ */

  async function _registerAlarms() {
    const settings = await _loadSettings();

    // Always replace scheduled daily/weekly alarms because the cadence may have changed.
    await chrome.alarms.clear(ALARM_NAME);

    // Preserve a pending on-change debounce alarm across service-worker wakes.
    // Clearing it here can drop the only backup queued after recent script edits.
    if (!settings.enabled || settings.scheduleType !== 'onChange') {
      await chrome.alarms.clear(DEBOUNCE_ALARM);
    }

    if (!settings.enabled) return;

    if (settings.scheduleType === 'daily') {
      const nextRun = _nextScheduledTime(settings.hour);
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 24 * 60 // repeat every 24 hours
      });
    } else if (settings.scheduleType === 'weekly') {
      const nextRun = _nextScheduledTime(settings.hour, settings.dayOfWeek);
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 7 * 24 * 60 // repeat every 7 days
      });
    }
    // 'onChange' and 'manual' don't need periodic alarms
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {

    /**
     * Initialize the backup scheduler. Call once on service worker start.
     * Re-registers alarms and attaches the alarm listener.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;

      await _loadSettings();
      await _registerAlarms();

      // Listen for backup-related alarms
      chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === ALARM_NAME) {
          await api.createBackup('scheduled');
        } else if (alarm.name === DEBOUNCE_ALARM) {
          await api.createBackup('onChange');
        }
      });
    },

    /**
     * Trigger a backup.
     * @param {string} reason - 'scheduled' | 'onChange' | 'manual'
     * @returns {{ success: boolean, backupId?: string, error?: string }}
     */
    async createBackup(reason = 'manual') {
      try {
        const {
          base64,
          scriptCount,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage
        } = await _collectBackupData();
        const sizeBytes = Math.round(base64.length * 0.75); // approximate binary size
        const settings = await _loadSettings();

        const backup = {
          id: _generateId(),
          timestamp: Date.now(),
          version: chrome.runtime.getManifest?.()?.version || '1.0',
          reason,
          scriptCount,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage,
          size: sizeBytes,
          sizeFormatted: _formatBytes(sizeBytes),
          data: base64
        };

        const backups = await _getBackupList();
        backups.unshift(backup); // newest first
        await _saveBackupList(backups);

        // Prune old backups
        await api.pruneOldBackups();

        // Storage warning check
        if (settings.warnOnStorageFull) {
          const allBackups = await _getBackupList();
          const totalSize = _estimateBackupSize(allBackups);
          if (totalSize > STORAGE_WARNING_BYTES) {
            _notify('Storage Warning',
              `Backup storage is using ${_formatBytes(totalSize)}. Consider reducing the backup limit or deleting old backups.`,
              true);
          }
        }

        // Success notification
        if (settings.notifyOnSuccess) {
          _notify('Backup Complete',
            `${reason.charAt(0).toUpperCase() + reason.slice(1)} backup created with ${scriptCount} scripts (${_formatBytes(sizeBytes)}).`);
        }

        return { success: true, backupId: backup.id };
      } catch (err) {
        const settings = await _loadSettings();
        if (settings.notifyOnFailure) {
          _notify('Backup Failed', `Error: ${err.message || err}`, true);
        }
        console.error('[BackupScheduler] createBackup error:', err);
        return { success: false, error: err.message || String(err) };
      }
    },

    /**
     * Get all stored backups (without full data blobs to save memory).
     * @returns {Array<{ id, timestamp, version, reason, scriptCount, size, sizeFormatted }>}
     */
    async getBackups() {
      const backups = await _getBackupList();
      return backups.map(b => ({
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
        sizeFormatted: b.sizeFormatted
      }));
    },

    /**
     * Restore from a backup.
     * @param {string} backupId
     * @param {{ selective?: boolean, scriptIds?: string[] }} options
     *   If selective = true, only restore scripts whose original IDs are in scriptIds.
     *   Otherwise full restore (scripts, settings, folders, workspaces).
     */
    async restoreBackup(backupId, options = {}) {
      const backups = await _getBackupList();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return { success: false, error: 'Backup not found' };

      // Snapshot current state BEFORE we mutate anything. Used to produce a
      // receipt and to allow rolling the restore back later.
      const recordReceipt = options.recordReceipt !== false;
      const sourceLabel = typeof options.sourceLabel === 'string' && options.sourceLabel.trim()
        ? options.sourceLabel.trim()
        : `Backup ${new Date(backup.timestamp).toISOString()}`;
      let snapshot = null;
      let receipt = null;
      if (recordReceipt) {
        try {
          snapshot = await _captureSnapshot({ includeGlobals: !options.selective });
        } catch (_) { /* fall back to no-snapshot — restore still proceeds */ }
      }

      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        let restoredScripts = 0;
        let skippedScripts = 0;
        let restoredSettings = false;
        let restoredFolders = false;
        let restoredWorkspaces = false;
        const errors = [];

        // --- Restore scripts ---
        const userScripts = fileNames.filter(n => n.endsWith('.user.js'));

        if (options.selective && Array.isArray(options.scriptIds)) {
          const selectedRefs = new Set(options.scriptIds);
          const selectedFiles = {};

          for (const filename of userScripts) {
            const baseName = filename.replace(/\.user\.js$/, '');
            const displayName = baseName.replace(/^scripts\//, '');

            // Parse metadata to match IDs for new backups and names for legacy backups.
            let scriptId = '';
            let scriptName = displayName;
            let scriptNs = '';
            let optionsMeta = {};
            const optionsFile = `${baseName}.options.json`;
            const optionsFileData = unzipped[optionsFile];
            if (optionsFileData) {
              try {
                optionsMeta = JSON.parse(fflate.strFromU8(optionsFileData));
                scriptId = typeof optionsMeta.scriptId === 'string' ? optionsMeta.scriptId : '';
                scriptName = optionsMeta.meta?.name || displayName;
                scriptNs = optionsMeta.meta?.namespace || '';
              } catch (_) {}
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
            const storageFileData = unzipped[storageFile];
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
              errors: []
            };
          }

          const importResult = await importFromZip(
            _zipBytesToBase64(fflate.zipSync(selectedFiles, { level: 6 })),
            { overwrite: true, recordReceipt: false }
          );
          if (importResult?.error) {
            errors.push({ name: 'archive', error: importResult.error });
          }
          restoredScripts = importResult?.imported || 0;
          skippedScripts = importResult?.skipped || 0;
          if (Array.isArray(importResult?.errors)) {
            errors.push(...importResult.errors);
          }
        } else {
          // Full restore: use importFromZip for all scripts at once
          try {
            const importResult = await importFromZip(backup.data, { overwrite: true, recordReceipt: false });
            if (importResult?.error) {
              errors.push({ name: 'archive', error: importResult.error });
            }
            restoredScripts = importResult?.imported || 0;
            skippedScripts = importResult?.skipped || 0;
            if (Array.isArray(importResult?.errors)) {
              errors.push(...importResult.errors);
            }
          } catch (importErr) {
            console.warn('[BackupScheduler] Full import error:', importErr);
            errors.push({ name: 'archive', error: importErr.message || String(importErr) });
          }
        }

        // --- Restore global settings (full restore only) ---
        if (!options.selective) {
          if (unzipped['global-settings.json']) {
            try {
              const settings = JSON.parse(fflate.strFromU8(unzipped['global-settings.json']));
              await SettingsManager.set(settings);
              restoredSettings = true;
            } catch (settingsErr) {
              errors.push({ name: 'global-settings.json', error: settingsErr.message || String(settingsErr) });
            }
          }

          // Restore folders. We write via chrome.storage.local to preserve
          // the exact restored shape, then invalidate FolderStorage's in-memory
          // cache so the next FolderStorage.getAll() reloads from storage.
          // Without this, the cached (pre-restore) list is returned forever.
          if (unzipped['folders.json']) {
            try {
              const folders = JSON.parse(fflate.strFromU8(unzipped['folders.json']));
              await chrome.storage.local.set({ scriptFolders: folders });
              if (typeof FolderStorage !== 'undefined') {
                FolderStorage.cache = null;
              }
              restoredFolders = true;
            } catch (foldersErr) {
              errors.push({ name: 'folders.json', error: foldersErr.message || String(foldersErr) });
            }
          }

          // Restore workspaces — invalidate WorkspaceManager cache same as above.
          if (unzipped['workspaces.json']) {
            try {
              const workspaces = JSON.parse(fflate.strFromU8(unzipped['workspaces.json']));
              await chrome.storage.local.set({ workspaces });
              if (typeof WorkspaceManager !== 'undefined') {
                WorkspaceManager._cache = null;
                WorkspaceManager._initPromise = null;
              }
              restoredWorkspaces = true;
            } catch (workspacesErr) {
              errors.push({ name: 'workspaces.json', error: workspacesErr.message || String(workspacesErr) });
            }
          }
        }

        const success = errors.length === 0
          || restoredScripts > 0
          || restoredSettings
          || restoredFolders
          || restoredWorkspaces;
        const result = {
          success,
          restoredScripts,
          skippedScripts,
          restoredSettings,
          restoredFolders,
          restoredWorkspaces,
          errors
        };

        if (recordReceipt && snapshot && (restoredScripts > 0 || restoredSettings || restoredFolders || restoredWorkspaces)) {
          try {
            // Compute which scripts existed before AND after, vs which were
            // added by the restore. Used later by rollbackRestore.
            let scriptIdsAfter = [];
            try {
              const after = await ScriptStorage.getAll();
              scriptIdsAfter = after.map(script => script.id).filter(id => typeof id === 'string');
            } catch (_) {}
            const beforeSet = new Set(snapshot.scriptIdsBefore || []);
            const addedScriptIds = scriptIdsAfter.filter(id => !beforeSet.has(id));

            receipt = {
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
                addedScriptIds
              }
            };
            await _pushReceipt(receipt);
            result.receiptId = receipt.id;
          } catch (receiptErr) {
            console.warn('[BackupScheduler] restoreBackup failed to persist receipt:', receiptErr);
          }
        }

        return result;
      } catch (err) {
        console.error('[BackupScheduler] restoreBackup error:', err);
        return { success: false, error: err.message || String(err) };
      }
    },

    /**
     * Delete a specific backup.
     * @param {string} backupId
     */
    async deleteBackup(backupId) {
      const backups = await _getBackupList();
      const filtered = backups.filter(b => b.id !== backupId);
      if (filtered.length === backups.length) return { success: false, error: 'Backup not found' };
      await _saveBackupList(filtered);
      return { success: true };
    },

    /**
     * Export a backup as a downloadable object (base64 ZIP + suggested filename).
     * @param {string} backupId
     * @returns {{ zipData: string, filename: string } | null}
     */
    async exportBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return null;

      const dateStr = new Date(backup.timestamp).toISOString().replace(/[:.]/g, '-');
      return {
        zipData: backup.data,
        filename: `scriptvault-autobackup-${dateStr}.zip`
      };
    },

    /**
     * Import a backup from externally provided base64 ZIP data.
     * @param {string} data - base64-encoded ZIP
     * @returns {{ success: boolean, backupId?: string, error?: string }}
     */
    async importBackup(data) {
      try {
        // Validate that the data is a valid ZIP
        const binaryString = atob(data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        const scriptFiles = fileNames.filter(n => n.endsWith('.user.js'));
        const hasGlobalSettings = fileNames.includes('global-settings.json');
        const hasFolders = fileNames.includes('folders.json');
        const hasWorkspaces = fileNames.includes('workspaces.json');
        const hasScriptStorage = fileNames.some(name => name.endsWith('.storage.json'));
        if (scriptFiles.length === 0 && !hasGlobalSettings && !hasFolders && !hasWorkspaces) {
          return { success: false, error: 'This ZIP does not look like a ScriptVault backup archive.' };
        }

        const sizeBytes = Math.round(data.length * 0.75);
        const backup = {
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
          data
        };

        const backups = await _getBackupList();
        backups.unshift(backup);
        await _saveBackupList(backups);
        await api.pruneOldBackups();

        return { success: true, backupId: backup.id };
      } catch (err) {
        console.error('[BackupScheduler] importBackup error:', err);
        return { success: false, error: err.message || String(err) };
      }
    },

    /**
     * Get current scheduler settings.
     * @returns {object}
     */
    getSettings() {
      return { ...(DEFAULT_SETTINGS), ...(_settings || {}) };
    },

    /**
     * Update scheduler settings and re-register alarms.
     * @param {object} settings - partial settings to merge
     */
    async setSettings(settings) {
      const merged = { ...(await _loadSettings()), ...settings };
      await _saveSettings(merged);
      await _registerAlarms();
      const prunedCount = await api.pruneOldBackups();
      return { ..._settings, prunedCount };
    },

    /**
     * Remove old backups exceeding the retention limit.
     */
    async pruneOldBackups() {
      const settings = await _loadSettings();
      const backups = await _getBackupList();
      if (backups.length <= settings.maxBackups) return 0;

      // Keep the newest N
      const pruned = backups.slice(0, settings.maxBackups);
      await _saveBackupList(pruned);
      return Math.max(0, backups.length - pruned.length);
    },

    /**
     * Called externally when a script is installed, updated, or deleted.
     * If scheduleType is 'onChange', sets a debounce alarm.
     */
    async onScriptChanged() {
      const settings = await _loadSettings();
      if (!settings.enabled || settings.scheduleType !== 'onChange') return;

      // Debounce: clear any pending alarm and set a new one
      await chrome.alarms.clear(DEBOUNCE_ALARM);
      chrome.alarms.create(DEBOUNCE_ALARM, {
        delayInMinutes: DEBOUNCE_MINUTES
      });
    },

    /**
     * Get a detailed manifest of what's inside a specific backup
     * (script names and sizes) without decompressing the whole thing to memory.
     * @param {string} backupId
     * @returns {Array<{ name: string, hasStorage: boolean }>}
     */
    async inspectBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return null;

      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        const parseJsonFile = (fileName) => {
          if (!unzipped[fileName]) return null;
          try {
            return JSON.parse(fflate.strFromU8(unzipped[fileName]));
          } catch (_) {
            return null;
          }
        };
        const countEntries = (value) => {
          if (Array.isArray(value)) return value.length;
          if (value && typeof value === 'object') return Object.keys(value).length;
          return 0;
        };
        const globalSettings = parseJsonFile('global-settings.json');
        const folderData = parseJsonFile('folders.json');
        const workspaceData = parseJsonFile('workspaces.json');
        const folderList = Array.isArray(folderData) ? folderData : [];
        const workspaceList = Array.isArray(workspaceData?.list)
          ? workspaceData.list
          : (Array.isArray(workspaceData) ? workspaceData : []);

        const scripts = fileNames
          .filter(n => n.endsWith('.user.js'))
          .map(n => {
            const baseName = n.replace(/\.user\.js$/, '');
            const displayName = baseName.replace(/^scripts\//, '');
            let meta = {};
            let scriptId = '';
            const optionsFile = `${baseName}.options.json`;
            if (unzipped[optionsFile]) {
              try {
                const optionsData = JSON.parse(fflate.strFromU8(unzipped[optionsFile]));
                meta = optionsData?.meta || {};
                scriptId = typeof optionsData?.scriptId === 'string' ? optionsData.scriptId : '';
              } catch (_) {}
            }
            const name = meta.name || displayName;
            const namespace = meta.namespace || '';
            return {
              id: scriptId || (namespace ? `${name}::${namespace}` : name),
              name,
              namespace,
              hasStorage: !!unzipped[`${baseName}.storage.json`]
            };
          });
        const scriptsWithStorageCount = scripts.filter(script => script.hasStorage).length;

        return {
          scriptCount: scripts.length,
          scripts,
          scriptsWithStorageCount,
          hasGlobalSettings: !!unzipped['global-settings.json'],
          settingsKeyCount: countEntries(globalSettings),
          hasFolders: !!unzipped['folders.json'],
          folderCount: countEntries(folderData),
          folders: folderList.map(folder => ({
            id: folder?.id || '',
            name: folder?.name || 'Unnamed folder',
            scriptCount: Array.isArray(folder?.scriptIds) ? folder.scriptIds.length : 0
          })),
          hasWorkspaces: !!unzipped['workspaces.json'],
          workspaceCount: workspaceList.length,
          workspaces: workspaceList.map(workspace => ({
            id: workspace?.id || '',
            name: workspace?.name || 'Unnamed workspace',
            scriptCount: workspace?.snapshot && typeof workspace.snapshot === 'object'
              ? Object.keys(workspace.snapshot).length
              : 0,
            active: workspaceData?.active === workspace?.id
          })),
          activeWorkspaceId: workspaceData?.active || null
        };
      } catch (err) {
        console.error('[BackupScheduler] inspectBackup error:', err);
        return null;
      }
    },

    /**
     * Verify a backup is structurally valid before restoring. Parses every
     * userscript with the injected parser, validates auxiliary JSON files,
     * and reports per-script issues without mutating state.
     *
     * @param {string} backupId
     * @param {{ parseUserscript?: function }} [opts]
     *   parseUserscript: function(code) -> { meta, error } — when provided,
     *   each userscript is metadata-checked. Falls back to a header-presence
     *   check when no parser is available.
     * @returns {{
     *   valid: boolean,
     *   scripts: Array<{ filename, name, namespace, parseError?, hasOptions, hasStorage, conflictsWithId? }>,
     *   parseErrorCount: number,
     *   missingOptionsCount: number,
     *   missingStorageCount: number,
     *   unreadableFileCount: number,
     *   summary: { scriptCount, validScripts, parseErrors, optionsParseErrors, storageParseErrors, globalSettingsValid, foldersValid, workspacesValid },
     *   issues: Array<{ kind, file?, error }>
     * } | null}
     */
    async verifyBackup(backupId, opts = {}) {
      const backups = await _getBackupList();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return null;

      const parseUserscript = typeof opts.parseUserscript === 'function' ? opts.parseUserscript : null;

      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);

        const installedIdSet = new Set();
        try {
          const existing = await ScriptStorage.getAll();
          for (const script of existing) {
            if (script && typeof script.id === 'string') installedIdSet.add(script.id);
          }
        } catch (_) {}

        const issues = [];
        let parseErrorCount = 0;
        let optionsParseErrors = 0;
        let storageParseErrors = 0;
        let unreadableFileCount = 0;
        let missingOptionsCount = 0;
        let missingStorageCount = 0; // scripts whose stored values are *expected* but missing — not currently inferable

        const scriptEntries = fileNames
          .filter(n => n.endsWith('.user.js'))
          .map(filename => {
            const baseName = filename.replace(/\.user\.js$/, '');
            const displayName = baseName.replace(/^scripts\//, '');
            const optionsKey = `${baseName}.options.json`;
            const storageKey = `${baseName}.storage.json`;
            const hasOptions = !!unzipped[optionsKey];
            const hasStorage = !!unzipped[storageKey];

            let code;
            try {
              code = fflate.strFromU8(unzipped[filename]);
            } catch (readErr) {
              unreadableFileCount++;
              const error = readErr?.message || String(readErr);
              issues.push({ kind: 'unreadable-script', file: filename, error });
              return {
                filename,
                name: displayName,
                namespace: '',
                hasOptions,
                hasStorage,
                parseError: error
              };
            }

            let optionsData = null;
            if (hasOptions) {
              try {
                optionsData = JSON.parse(fflate.strFromU8(unzipped[optionsKey]));
              } catch (optErr) {
                optionsParseErrors++;
                issues.push({ kind: 'options-parse', file: optionsKey, error: optErr?.message || String(optErr) });
              }
            } else {
              missingOptionsCount++;
            }

            if (hasStorage) {
              try {
                JSON.parse(fflate.strFromU8(unzipped[storageKey]));
              } catch (stErr) {
                storageParseErrors++;
                issues.push({ kind: 'storage-parse', file: storageKey, error: stErr?.message || String(stErr) });
              }
            }

            let parseError = '';
            let parsedMeta = optionsData?.meta || {};
            if (parseUserscript) {
              const parsed = parseUserscript(code);
              if (parsed && parsed.error) {
                parseError = parsed.error;
                parseErrorCount++;
                issues.push({ kind: 'script-parse', file: filename, error: parsed.error });
              } else if (parsed && parsed.meta) {
                parsedMeta = parsed.meta;
              }
            } else if (!/==UserScript==/.test(code)) {
              parseError = 'Missing ==UserScript== header';
              parseErrorCount++;
              issues.push({ kind: 'script-parse', file: filename, error: parseError });
            }

            const scriptId = typeof optionsData?.scriptId === 'string' ? optionsData.scriptId : '';
            const name = parsedMeta?.name || displayName;
            const namespace = parsedMeta?.namespace || '';
            return {
              filename,
              name,
              namespace,
              hasOptions,
              hasStorage,
              parseError: parseError || undefined,
              scriptId: scriptId || undefined,
              conflictsWithId: scriptId && installedIdSet.has(scriptId) ? scriptId : undefined
            };
          });

        // Auxiliary JSON
        let globalSettingsValid = true;
        let foldersValid = true;
        let workspacesValid = true;
        if (unzipped['global-settings.json']) {
          try {
            JSON.parse(fflate.strFromU8(unzipped['global-settings.json']));
          } catch (err) {
            globalSettingsValid = false;
            issues.push({ kind: 'global-settings-parse', file: 'global-settings.json', error: err?.message || String(err) });
          }
        }
        if (unzipped['folders.json']) {
          try {
            JSON.parse(fflate.strFromU8(unzipped['folders.json']));
          } catch (err) {
            foldersValid = false;
            issues.push({ kind: 'folders-parse', file: 'folders.json', error: err?.message || String(err) });
          }
        }
        if (unzipped['workspaces.json']) {
          try {
            JSON.parse(fflate.strFromU8(unzipped['workspaces.json']));
          } catch (err) {
            workspacesValid = false;
            issues.push({ kind: 'workspaces-parse', file: 'workspaces.json', error: err?.message || String(err) });
          }
        }

        const validScripts = scriptEntries.filter(s => !s.parseError).length;
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
            foldersValid,
            workspacesValid
          },
          issues
        };
      } catch (err) {
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
            foldersValid: false,
            workspacesValid: false
          },
          issues: [{ kind: 'archive', file: backupId, error: err?.message || String(err) }]
        };
      }
    },

    /**
     * List persisted restore/import receipts (metadata only, no snapshot blob).
     */
    async listReceipts() {
      const receipts = await _getReceipts();
      return receipts.map(_snapshotMeta).filter(Boolean);
    },

    /**
     * Fetch a single receipt with its full snapshot blob.
     */
    async getReceipt(receiptId) {
      const receipts = await _getReceipts();
      return receipts.find(r => r && r.id === receiptId) || null;
    },

    /**
     * Record an arbitrary receipt (used by import/export paths to log
     * import overwrites in the same registry as backup restores).
     */
    async recordReceipt(receipt) {
      if (!receipt || typeof receipt !== 'object') return null;
      const next = {
        id: receipt.id || _generateId(),
        timestamp: receipt.timestamp || Date.now(),
        type: receipt.type || 'import',
        source: receipt.source || 'import',
        sourceLabel: receipt.sourceLabel || '',
        backupId: receipt.backupId || null,
        result: receipt.result || null,
        snapshot: receipt.snapshot || { scriptsBefore: [], valuesBefore: {}, scriptIdsBefore: [] }
      };
      await _pushReceipt(next);
      return _snapshotMeta(next);
    },

    /**
     * Roll a restore (or import) receipt back. Re-applies the snapshotted
     * script + values state and removes any scripts that were added by the
     * restored operation. Optionally re-applies snapshotted global settings,
     * folders, and workspaces.
     *
     * @returns {{ success, restoredScripts, removedScripts, restoredValues, errors, receiptId }}
     */
    async rollbackRestoreReceipt(receiptId, opts = {}) {
      const receipts = await _getReceipts();
      const receipt = receipts.find(r => r && r.id === receiptId);
      if (!receipt) return { success: false, error: 'Receipt not found' };
      if (receipt.rolledBackAt) {
        return { success: false, error: 'Receipt already rolled back', alreadyRolledBack: true, rolledBackAt: receipt.rolledBackAt };
      }
      const snapshot = receipt.snapshot || {};
      const scriptsBefore = Array.isArray(snapshot.scriptsBefore) ? snapshot.scriptsBefore : [];
      const valuesBefore = snapshot.valuesBefore && typeof snapshot.valuesBefore === 'object' ? snapshot.valuesBefore : {};
      const restoreGlobals = opts.restoreGlobals !== false;

      const errors = [];
      let restoredScripts = 0;
      let removedScripts = 0;
      let restoredValues = 0;
      const restoredScriptIds = [];

      // Step 1: re-apply snapshotted scripts.
      for (const script of scriptsBefore) {
        if (!script || typeof script.id !== 'string') continue;
        try {
          await ScriptStorage.set(script.id, structuredClone(script));
          restoredScriptIds.push(script.id);
          restoredScripts++;
        } catch (err) {
          errors.push({ kind: 'script', name: script.meta?.name || script.id, error: err?.message || String(err) });
        }
      }

      // Step 2: re-apply snapshotted per-script values.
      for (const [scriptId, values] of Object.entries(valuesBefore)) {
        if (typeof ScriptValues === 'undefined' || !ScriptValues || typeof ScriptValues.setAll !== 'function') break;
        try {
          if (typeof ScriptValues.deleteAll === 'function') {
            await ScriptValues.deleteAll(scriptId);
          }
          await ScriptValues.setAll(scriptId, values);
          restoredValues++;
        } catch (err) {
          errors.push({ kind: 'values', name: scriptId, error: err?.message || String(err) });
        }
      }

      // Step 3: drop scripts the restore added.
      const beforeIdSet = new Set(Array.isArray(snapshot.scriptIdsBefore) ? snapshot.scriptIdsBefore : []);
      let scriptIdsAfter = [];
      try {
        const after = await ScriptStorage.getAll();
        scriptIdsAfter = after.map(s => s.id).filter(id => typeof id === 'string');
      } catch (err) {
        errors.push({ kind: 'getAll', error: err?.message || String(err) });
      }
      const addedFromSnapshot = Array.isArray(snapshot.addedScriptIds) ? snapshot.addedScriptIds : null;
      const toDelete = addedFromSnapshot
        ? addedFromSnapshot.filter(id => scriptIdsAfter.includes(id))
        : scriptIdsAfter.filter(id => !beforeIdSet.has(id));
      for (const id of toDelete) {
        try {
          if (typeof ScriptValues !== 'undefined' && ScriptValues && typeof ScriptValues.deleteAll === 'function') {
            try { await ScriptValues.deleteAll(id); } catch (_) {}
          }
          await ScriptStorage.delete(id);
          removedScripts++;
        } catch (err) {
          errors.push({ kind: 'script-delete', name: id, error: err?.message || String(err) });
        }
      }

      // Step 4: re-apply globals (full restores only).
      let restoredSettings = false;
      let restoredFolders = false;
      let restoredWorkspaces = false;
      if (restoreGlobals) {
        if (snapshot.settings !== undefined) {
          try {
            await SettingsManager.set(structuredClone(snapshot.settings));
            restoredSettings = true;
          } catch (err) {
            errors.push({ kind: 'settings', error: err?.message || String(err) });
          }
        }
        if (snapshot.folders !== undefined) {
          try {
            await chrome.storage.local.set({ scriptFolders: structuredClone(snapshot.folders) });
            if (typeof FolderStorage !== 'undefined' && FolderStorage) {
              FolderStorage.cache = null;
            }
            restoredFolders = true;
          } catch (err) {
            errors.push({ kind: 'folders', error: err?.message || String(err) });
          }
        }
        if (snapshot.workspaces !== undefined) {
          try {
            await chrome.storage.local.set({ workspaces: structuredClone(snapshot.workspaces) });
            if (typeof WorkspaceManager !== 'undefined' && WorkspaceManager) {
              WorkspaceManager._cache = null;
              WorkspaceManager._initPromise = null;
            }
            restoredWorkspaces = true;
          } catch (err) {
            errors.push({ kind: 'workspaces', error: err?.message || String(err) });
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
        removedScriptIds: toDelete
      };

      const success = errors.length === 0;
      await _updateReceipt(receiptId, {
        rolledBackAt: Date.now(),
        rollbackError: success ? null : errors.map(e => `${e.kind}: ${e.error}`).join('; '),
        rollbackResult: { ...rollbackResult, success }
      });

      return { success, ...rollbackResult };
    },

    /** Clear all persisted receipts. */
    async clearReceipts() {
      await _saveReceipts([]);
      return { success: true };
    }
  };

  return api;
})();
