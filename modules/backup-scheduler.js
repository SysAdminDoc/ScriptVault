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
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
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
    const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
    _settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEY_SETTINGS] || {}) };
    return _settings;
  }

  async function _saveSettings(settings) {
    _settings = { ...DEFAULT_SETTINGS, ...settings };
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
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < zipData.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, zipData.subarray(i, i + chunkSize));
    }
    return {
      base64: btoa(binary),
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
    // Clear existing backup alarms
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(DEBOUNCE_ALARM);

    const settings = await _loadSettings();
    if (!settings.enabled) return;

    if (settings.scheduleType === 'daily') {
      const nextRun = _nextScheduledTime(settings.hour);
      const delayMs = nextRun.getTime() - Date.now();
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
          // Selective restore: import matching scripts individually
          for (const filename of userScripts) {
            const code = fflate.strFromU8(unzipped[filename]);
            const baseName = filename.replace(/\.user\.js$/, '');

            // Parse metadata to get script identity
            let optionsMeta = {};
            const optionsFile = `${baseName}.options.json`;
            if (unzipped[optionsFile]) {
              try { optionsMeta = JSON.parse(fflate.strFromU8(unzipped[optionsFile])); } catch (_) {}
            }

            const scriptId = optionsMeta.id || baseName.replace(/^scripts\//, '');
            const scriptName = optionsMeta.meta?.name || scriptId;
            const scriptNs = optionsMeta.meta?.namespace || '';
            const scriptKey = scriptNs ? `${scriptName}::${scriptNs}` : scriptName;
            if (!options.scriptIds.includes(scriptId) && !options.scriptIds.includes(scriptName) && !options.scriptIds.includes(scriptKey)) continue;

            try {
              const meta = optionsMeta.meta || {};
              const settings = optionsMeta.settings || {};

              // Find existing script or generate new ID
              const allScripts = await ScriptStorage.getAll();
              const existing = allScripts.find(s => s.meta?.name === meta.name && s.meta?.namespace === meta.namespace);
              const scriptId = existing ? existing.id : generateId();

              await ScriptStorage.set(scriptId, {
                id: scriptId,
                code,
                meta,
                enabled: settings.enabled !== false,
                settings: settings,
                position: existing ? existing.position : allScripts.length,
                createdAt: existing ? existing.createdAt : Date.now(),
                updatedAt: Date.now()
              });
              restoredScripts++;

              // Restore script values if present
              const storageFile = `${baseName}.storage.json`;
              if (unzipped[storageFile]) {
                try {
                  const storageData = JSON.parse(fflate.strFromU8(unzipped[storageFile]));
                  if (storageData.data) {
                    await ScriptValues.setAll(scriptId, storageData.data);
                  }
                } catch (storageErr) {
                  errors.push({ name: scriptName, error: storageErr.message || String(storageErr) });
                }
              }
            } catch (importErr) {
              console.warn('[BackupScheduler] Script import error:', filename, importErr);
              errors.push({ name: filename, error: importErr.message || String(importErr) });
            }
          }
        } else {
          // Full restore: use importFromZip for all scripts at once
          try {
            const importResult = await importFromZip(backup.data, { overwrite: true });
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
        return {
          success,
          restoredScripts,
          skippedScripts,
          restoredSettings,
          restoredFolders,
          restoredWorkspaces,
          errors
        };
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
            const optionsFile = `${baseName}.options.json`;
            if (unzipped[optionsFile]) {
              try {
                meta = JSON.parse(fflate.strFromU8(unzipped[optionsFile]))?.meta || {};
              } catch (_) {}
            }
            const name = meta.name || displayName;
            const namespace = meta.namespace || '';
            return {
              id: namespace ? `${name}::${namespace}` : name,
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
    }
  };

  return api;
})();
