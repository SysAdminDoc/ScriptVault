// ============================================================================
// Generated from src/modules/backup-scheduler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const BackupScheduler = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/modules/backup-scheduler.ts
  var backup_scheduler_exports = {};
  __export(backup_scheduler_exports, {
    BackupScheduler: () => BackupScheduler,
    default: () => backup_scheduler_default
  });
  module.exports = __toCommonJS(backup_scheduler_exports);
  var STORAGE_KEY_BACKUPS = "autoBackups";
  var STORAGE_KEY_SETTINGS = "backupSchedulerSettings";
  var STORAGE_KEY_RECEIPTS = "restoreReceipts";
  var RECEIPT_RETENTION = 10;
  var RECEIPT_BYTE_BUDGET = 5 * 1024 * 1024;
  var ALARM_NAME = "sv_backup_scheduled";
  var DEBOUNCE_ALARM = "sv_backup_debounce";
  var DEBOUNCE_MINUTES = 5;
  var STORAGE_WARNING_BYTES = 8 * 1024 * 1024;
  var ARCHIVE_MAX_SCRIPT_BYTES = 5 * 1024 * 1024;
  var ARCHIVE_MAX_COMPRESSED_BYTES = 20 * 1024 * 1024;
  var ARCHIVE_MAX_ENTRIES = 300;
  var ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;
  var ARCHIVE_MAX_ENTRY_BYTES = 10 * 1024 * 1024;
  var ARCHIVE_MAX_JSON_ENTRY_BYTES = 5 * 1024 * 1024;
  var ARCHIVE_MAX_OPTIONS_BYTES = 512 * 1024;
  var ARCHIVE_MAX_COMPRESSION_RATIO = 100;
  var DEFAULT_SETTINGS = {
    enabled: false,
    scheduleType: "daily",
    hour: 3,
    dayOfWeek: 0,
    maxBackups: 5,
    includeSettingsCredentials: false,
    notifyOnSuccess: true,
    notifyOnFailure: true,
    warnOnStorageFull: true,
    cloudBackupEnabled: false
  };
  var GLOBAL_SETTINGS_METADATA_FILE = "global-settings.metadata.json";
  var SETTINGS_CREDENTIAL_KEYS = [
    "webdavUsername",
    "webdavPassword",
    "googleDriveToken",
    "googleDriveRefreshToken",
    "dropboxToken",
    "dropboxRefreshToken",
    "onedriveToken",
    "onedriveRefreshToken",
    "syncEncryptionPassphrase",
    "s3AccessKeyId",
    "s3SecretKey"
  ];
  var _settings = null;
  var _initialized = false;
  var _settingsLoadPromise = null;
  function _generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function _formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }
  function archiveIntakeError(message) {
    return new Error(`Backup archive rejected: ${message}`);
  }
  function normalizeArchiveEntryName(name) {
    return typeof name === "string" ? name.replace(/\\/g, "/").trim() : "";
  }
  function archiveEntryLimit(name) {
    if (name.endsWith(".user.js") || !name.includes("/") && name.endsWith(".js")) {
      return ARCHIVE_MAX_SCRIPT_BYTES;
    }
    if (name.endsWith(".options.json") || name === GLOBAL_SETTINGS_METADATA_FILE) {
      return ARCHIVE_MAX_OPTIONS_BYTES;
    }
    if (name.endsWith(".storage.json") || name === "global-settings.json" || name === "folders.json" || name === "workspaces.json") {
      return ARCHIVE_MAX_JSON_ENTRY_BYTES;
    }
    return ARCHIVE_MAX_ENTRY_BYTES;
  }
  function validateArchiveEntryMeta(rawEntry, state) {
    const name = normalizeArchiveEntryName(rawEntry.name);
    if (!name) throw archiveIntakeError("entry name is missing.");
    if (name.startsWith("/") || name.includes("../") || name.includes("/..")) {
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
    if (Number.isFinite(compressedBytes) && compressedBytes > 0 && uncompressedBytes / compressedBytes > ARCHIVE_MAX_COMPRESSION_RATIO) {
      throw archiveIntakeError(`${name} compression ratio is too high.`);
    }
    return true;
  }
  function archiveInputToBytes(input) {
    let zipBytes;
    if (typeof input === "string") {
      const maxBase64Length = Math.ceil(ARCHIVE_MAX_COMPRESSED_BYTES * 4 / 3) + 8;
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
  function validateUnzippedArchive(files) {
    const state = { entries: 0, totalUncompressedBytes: 0 };
    for (const [name, data] of Object.entries(files)) {
      validateArchiveEntryMeta(
        {
          name,
          size: data.byteLength,
          originalSize: data.byteLength,
          compression: 0
        },
        state
      );
    }
  }
  function unzipArchiveBounded(input) {
    const zipBytes = archiveInputToBytes(input);
    const state = { entries: 0, totalUncompressedBytes: 0 };
    const files = fflate.unzipSync(zipBytes, {
      filter(file) {
        return validateArchiveEntryMeta(file, state);
      }
    });
    validateUnzippedArchive(files);
    return files;
  }
  function archiveEntryBytes(files, name, maxBytes = archiveEntryLimit(name)) {
    const data = files[name];
    if (!data) return void 0;
    if (data.byteLength > maxBytes) {
      throw archiveIntakeError(`${name} is too large (${_formatBytes(data.byteLength)}). Maximum is ${_formatBytes(maxBytes)}.`);
    }
    return data;
  }
  function archiveEntryText(files, name, maxBytes = archiveEntryLimit(name)) {
    const data = archiveEntryBytes(files, name, maxBytes);
    if (!data) throw archiveIntakeError(`${name} is missing.`);
    return fflate.strFromU8(data);
  }
  function parseArchiveJson(files, name, maxBytes = archiveEntryLimit(name)) {
    return JSON.parse(archiveEntryText(files, name, maxBytes));
  }
  function _cloneSettingsForTransfer(value) {
    if (!value || typeof value !== "object") return {};
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return { ...value };
    }
  }
  function _redactSettingsCredentials(settings, options = {}) {
    const includeCredentials = options.includeCredentials === true;
    const sanitized = _cloneSettingsForTransfer(settings);
    const redactedSettingsCredentialKeys = [];
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
        redactedSettingsCredentialKeys
      }
    };
  }
  function _prepareSettingsForRestore(settings, options = {}) {
    const allowCredentials = options.allowCredentials === true;
    const sanitized = _cloneSettingsForTransfer(settings);
    const skippedSettingsCredentialKeys = [];
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
      skippedSettingsCredentialKeys
    };
  }
  function _readSettingsMetadata(unzipped, backup = {}) {
    const fallback = {
      schemaVersion: 1,
      settingsCredentialsIncluded: backup.settingsCredentialsIncluded === true,
      redactedSettingsCredentialKeys: Array.isArray(backup.redactedSettingsCredentialKeys) ? backup.redactedSettingsCredentialKeys.filter((key) => typeof key === "string") : []
    };
    const metadataFile = unzipped[GLOBAL_SETTINGS_METADATA_FILE];
    if (!metadataFile) return fallback;
    try {
      const parsed = parseArchiveJson(
        unzipped,
        GLOBAL_SETTINGS_METADATA_FILE,
        ARCHIVE_MAX_OPTIONS_BYTES
      );
      return {
        schemaVersion: Number(parsed.schemaVersion || 1),
        settingsCredentialsIncluded: parsed.settingsCredentialsIncluded === true,
        redactedSettingsCredentialKeys: Array.isArray(parsed.redactedSettingsCredentialKeys) ? parsed.redactedSettingsCredentialKeys.filter((key) => typeof key === "string") : []
      };
    } catch (_) {
      return fallback;
    }
  }
  function _zipBytesToBase64(zipData) {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < zipData.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(zipData.subarray(i, i + chunkSize))
      );
    }
    return btoa(binary);
  }
  function _nextScheduledTime(hour, dayOfWeek) {
    const now = /* @__PURE__ */ new Date();
    const target = new Date(now);
    target.setHours(hour, 0, 0, 0);
    if (dayOfWeek !== void 0 && dayOfWeek !== null) {
      const currentDay = now.getDay();
      let daysUntil = (dayOfWeek - currentDay + 7) % 7;
      if (daysUntil === 0 && now >= target) daysUntil = 7;
      target.setDate(target.getDate() + daysUntil);
    } else {
      if (now >= target) target.setDate(target.getDate() + 1);
    }
    return target;
  }
  function _notify(title, message, _isError = false) {
    try {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("images/icon128.png"),
        title: `ScriptVault \u2014 ${title}`,
        message
      });
    } catch (_) {
    }
  }
  async function _loadSettings() {
    if (_settings) return _settings;
    if (_settingsLoadPromise) return _settingsLoadPromise;
    _settingsLoadPromise = (async () => {
      const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
      const stored = data[STORAGE_KEY_SETTINGS];
      _settings = { ...DEFAULT_SETTINGS, ...stored ?? {} };
      return _settings;
    })();
    return _settingsLoadPromise;
  }
  async function _saveSettings(settings) {
    _settings = { ...DEFAULT_SETTINGS, ...settings };
    _settingsLoadPromise = null;
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: _settings });
  }
  async function _collectBackupData(options = {}) {
    const scripts = await ScriptStorage.getAll();
    const files = {};
    const usedNames = /* @__PURE__ */ new Set();
    let hasScriptStorage = false;
    for (const script of scripts) {
      let safeName = (script.meta?.name || "unnamed").replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim().substring(0, 100);
      if (usedNames.has(safeName)) {
        let counter = 2;
        while (usedNames.has(`${safeName}_${counter}`)) counter++;
        safeName = `${safeName}_${counter}`;
      }
      usedNames.add(safeName);
      files[`scripts/${safeName}.user.js`] = fflate.strToU8(script.code || "");
      const options2 = {
        scriptId: script.id,
        settings: {
          enabled: script.enabled,
          "run-at": script.meta?.["run-at"] || "document-idle"
        },
        meta: {
          name: script.meta?.name,
          namespace: script.meta?.namespace || "",
          version: script.meta?.version || "1.0",
          description: script.meta?.description || "",
          author: script.meta?.author || "",
          match: script.meta?.match || [],
          include: script.meta?.include || [],
          exclude: script.meta?.exclude || [],
          grant: script.meta?.grant || [],
          require: script.meta?.require || [],
          resource: script.meta?.resource || {}
        }
      };
      files[`scripts/${safeName}.options.json`] = fflate.strToU8(
        JSON.stringify(options2, null, 2)
      );
      try {
        const values = await ScriptValues.getAll(
          script.id
        );
        if (values && Object.keys(values).length > 0) {
          files[`scripts/${safeName}.storage.json`] = fflate.strToU8(
            JSON.stringify({ data: values }, null, 2)
          );
          hasScriptStorage = true;
        }
      } catch (_) {
      }
    }
    let hasGlobalSettings = false;
    let settingsMetadata = {
      schemaVersion: 1,
      settingsCredentialsIncluded: options.includeSettingsCredentials === true,
      redactedSettingsCredentialKeys: []
    };
    try {
      const globalSettings = await SettingsManager.get();
      const settingsExport = _redactSettingsCredentials(globalSettings, {
        includeCredentials: options.includeSettingsCredentials === true
      });
      settingsMetadata = settingsExport.metadata;
      files["global-settings.json"] = fflate.strToU8(
        JSON.stringify(settingsExport.settings, null, 2)
      );
      files[GLOBAL_SETTINGS_METADATA_FILE] = fflate.strToU8(
        JSON.stringify(settingsMetadata, null, 2)
      );
      hasGlobalSettings = true;
    } catch (_) {
    }
    let hasFolders = false;
    try {
      const folderData = await chrome.storage.local.get("scriptFolders");
      if (folderData["scriptFolders"]) {
        files["folders.json"] = fflate.strToU8(
          JSON.stringify(folderData["scriptFolders"], null, 2)
        );
        hasFolders = true;
      }
    } catch (_) {
    }
    let hasWorkspaces = false;
    try {
      const wsData = await chrome.storage.local.get("workspaces");
      if (wsData["workspaces"]) {
        files["workspaces.json"] = fflate.strToU8(
          JSON.stringify(wsData["workspaces"], null, 2)
        );
        hasWorkspaces = true;
      }
    } catch (_) {
    }
    const zipData = fflate.zipSync(files, { level: 6 });
    return {
      base64: _zipBytesToBase64(zipData),
      scriptCount: scripts.length,
      hasGlobalSettings,
      hasFolders,
      hasWorkspaces,
      hasScriptStorage,
      settingsCredentialsIncluded: settingsMetadata.settingsCredentialsIncluded,
      redactedSettingsCredentialKeys: settingsMetadata.redactedSettingsCredentialKeys
    };
  }
  async function _getBackupList() {
    const data = await chrome.storage.local.get(STORAGE_KEY_BACKUPS);
    return data[STORAGE_KEY_BACKUPS] ?? [];
  }
  async function _saveBackupList(list) {
    await chrome.storage.local.set({ [STORAGE_KEY_BACKUPS]: list });
  }
  async function _gzipBytes(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function _gunzipBytes(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function _storeBackupBlob(id, base64Data) {
    const dao = _tryGetBackupsDAO();
    if (!dao) return false;
    try {
      const raw = new Uint8Array(_base64ToArrayBuffer(base64Data));
      let data = raw.buffer;
      let compressed = false;
      if (typeof CompressionStream === "function") {
        try {
          const gz = await _gzipBytes(raw);
          data = gz.buffer;
          compressed = true;
        } catch {
          data = raw.buffer;
          compressed = false;
        }
      }
      await dao.put({
        id,
        name: id,
        createdAt: Date.now(),
        byteSize: raw.length,
        // uncompressed logical size
        compressed,
        data
      });
      return true;
    } catch {
      return false;
    }
  }
  async function _getBackupBlob(id) {
    const dao = _tryGetBackupsDAO();
    if (!dao) return null;
    try {
      const record = await dao.get(id);
      if (!record?.data) return null;
      let bytes = new Uint8Array(record.data);
      if (record.compressed) {
        try {
          bytes = await _gunzipBytes(bytes);
        } catch {
          return null;
        }
      }
      return _arrayBufferToBase64(bytes.buffer);
    } catch {
      return null;
    }
  }
  async function _deleteBackupBlob(id) {
    const dao = _tryGetBackupsDAO();
    if (!dao) return;
    try {
      await dao.delete(id);
    } catch {
    }
  }
  async function _sweepOrphanedBackupBlobs() {
    const dao = _tryGetBackupsDAO();
    if (!dao || typeof dao.list !== "function") return 0;
    try {
      const [records, backups] = await Promise.all([
        dao.list(),
        _getBackupList()
      ]);
      const referenced = new Set(backups.map((backup) => backup.id));
      const orphans = records.filter((record) => record?.id && !referenced.has(record.id));
      for (const orphan of orphans) {
        await dao.delete(orphan.id);
      }
      return orphans.length;
    } catch {
      return 0;
    }
  }
  function _tryGetBackupsDAO() {
    if (typeof indexedDB === "undefined") return null;
    const dao = globalThis.BackupsDAO;
    return dao ?? null;
  }
  function _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  function _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  async function _migrateBackupBlobsToIdb() {
    if (typeof indexedDB === "undefined") return;
    const list = await _getBackupList();
    const needsMigration = list.filter((e) => typeof e.data === "string" && e.data.length > 0);
    if (needsMigration.length === 0) return;
    for (const entry of needsMigration) {
      let stored = false;
      try {
        stored = await _storeBackupBlob(entry.id, entry.data);
      } catch {
        stored = false;
      }
      if (!stored) {
        continue;
      }
      delete entry.data;
    }
    await _saveBackupList(list);
  }
  async function _getReceipts() {
    const data = await chrome.storage.local.get(STORAGE_KEY_RECEIPTS);
    const receipts = data[STORAGE_KEY_RECEIPTS];
    return Array.isArray(receipts) ? receipts : [];
  }
  async function _saveReceipts(list) {
    await chrome.storage.local.set({ [STORAGE_KEY_RECEIPTS]: list });
  }
  function _approxJsonBytes(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }
  async function _pushReceipt(receipt) {
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
  async function _updateReceipt(receiptId, patch) {
    const receipts = await _getReceipts();
    const idx = receipts.findIndex((receipt) => receipt?.id === receiptId);
    if (idx === -1) return null;
    receipts[idx] = { ...receipts[idx], ...patch };
    await _saveReceipts(receipts);
    return receipts[idx] ?? null;
  }
  function _snapshotMeta(receipt) {
    if (!receipt) return null;
    const snapshot = receipt.snapshot ?? {
      scriptsBefore: [],
      valuesBefore: {},
      scriptIdsBefore: []
    };
    const scriptsBefore = Array.isArray(snapshot.scriptsBefore) ? snapshot.scriptsBefore : [];
    return {
      id: receipt.id,
      type: receipt.type,
      source: receipt.source,
      sourceLabel: receipt.sourceLabel || "",
      timestamp: receipt.timestamp,
      backupId: receipt.backupId || null,
      result: receipt.result || null,
      rolledBackAt: receipt.rolledBackAt || null,
      rollbackError: receipt.rollbackError || null,
      rollbackResult: receipt.rollbackResult || null,
      snapshotScriptCount: scriptsBefore.length,
      snapshotIdSetSize: Array.isArray(snapshot.scriptIdsBefore) ? snapshot.scriptIdsBefore.length : 0,
      hasGlobalSettings: snapshot.settings !== void 0,
      hasFolders: snapshot.folders !== void 0,
      hasWorkspaces: snapshot.workspaces !== void 0
    };
  }
  async function _captureSnapshot({
    includeGlobals = false
  } = {}) {
    const scriptsBefore = [];
    const valuesBefore = {};
    let scriptIdsBefore = [];
    try {
      const all = await ScriptStorage.getAll();
      scriptIdsBefore = all.map((script) => script.id).filter((id) => typeof id === "string");
      for (const script of all) {
        scriptsBefore.push(structuredClone(script));
        if (typeof ScriptValues !== "undefined" && ScriptValues && typeof ScriptValues.getAll === "function") {
          try {
            const values = await ScriptValues.getAll(script.id);
            if (values && Object.keys(values).length > 0) {
              valuesBefore[script.id] = structuredClone(values);
            }
          } catch (_) {
          }
        }
      }
    } catch (_) {
    }
    const snapshot = {
      scriptsBefore,
      valuesBefore,
      scriptIdsBefore
    };
    if (includeGlobals) {
      try {
        snapshot.settings = structuredClone(await SettingsManager.get());
      } catch (_) {
      }
      try {
        const folderData = await chrome.storage.local.get("scriptFolders");
        if (folderData && folderData["scriptFolders"] !== void 0) {
          snapshot.folders = structuredClone(folderData["scriptFolders"]);
        }
      } catch (_) {
      }
      try {
        const wsData = await chrome.storage.local.get("workspaces");
        if (wsData && wsData["workspaces"] !== void 0) {
          snapshot.workspaces = structuredClone(wsData["workspaces"]);
        }
      } catch (_) {
      }
    }
    return snapshot;
  }
  function _estimateBackupSize(backups) {
    let total = 0;
    for (const b of backups) {
      total += typeof b.size === "number" && b.size > 0 ? b.size : b.data?.length ?? 0;
    }
    return total;
  }
  async function _registerAlarms() {
    const settings = await _loadSettings();
    await chrome.alarms.clear(ALARM_NAME);
    if (!settings.enabled || settings.scheduleType !== "onChange") {
      await chrome.alarms.clear(DEBOUNCE_ALARM);
    }
    if (!settings.enabled) return;
    if (settings.scheduleType === "daily") {
      const nextRun = _nextScheduledTime(settings.hour);
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 24 * 60
        // repeat every 24 hours
      });
    } else if (settings.scheduleType === "weekly") {
      const nextRun = _nextScheduledTime(
        settings.hour,
        settings.dayOfWeek
      );
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 7 * 24 * 60
        // repeat every 7 days
      });
    }
  }
  async function _uploadBackupToCloud(backup) {
    if (typeof CloudSyncProviders === "undefined" || !CloudSyncProviders) return;
    const globalSettings = await SettingsManager.get();
    const providerName = String(globalSettings.syncProvider || "none");
    if (providerName === "none") return;
    const provider = CloudSyncProviders[providerName];
    if (!provider || typeof provider.upload !== "function") return;
    const blobData = backup.data ?? await _getBackupBlob(backup.id);
    if (!blobData) throw new Error("Backup data not found in IndexedDB");
    const envelope = {
      schema: "scriptvault-cloud-backup/v1",
      backupId: backup.id,
      timestamp: backup.timestamp,
      version: backup.version,
      scriptCount: backup.scriptCount,
      reason: backup.reason,
      size: backup.size,
      data: blobData
    };
    const uploadSettings = Object.assign({}, globalSettings);
    let payload = envelope;
    const wantsEncryption = uploadSettings.syncEncryptionEnabled === true;
    if (wantsEncryption && (typeof SyncCrypto === "undefined" || typeof SyncCrypto?.prepareSyncEnvelopeForUpload !== "function")) {
      throw new Error("Cloud backup encryption unavailable");
    }
    try {
      if (typeof SyncCrypto !== "undefined" && SyncCrypto?.isEncryptionEnabled?.(uploadSettings)) {
        payload = await SyncCrypto.prepareSyncEnvelopeForUpload(envelope, uploadSettings);
      }
    } catch (_e) {
      throw new Error("Cloud backup encryption failed");
    }
    const result = await provider.upload(payload, uploadSettings, {
      objectName: "scriptvault-cloud-backup.json"
    });
    if (!result?.success) {
      throw new Error(result?.error || "Cloud backup upload failed");
    }
  }
  var BackupScheduler = {
    /**
     * Initialize the backup scheduler. Call once on service worker start.
     * Re-registers alarms and attaches the alarm listener.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;
      await _loadSettings();
      await _registerAlarms();
      _migrateBackupBlobsToIdb().then(() => _sweepOrphanedBackupBlobs()).catch(() => {
      });
      chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === ALARM_NAME) {
          await BackupScheduler.createBackup("scheduled");
        } else if (alarm.name === DEBOUNCE_ALARM) {
          await BackupScheduler.createBackup("onChange");
        }
      });
    },
    /**
     * Trigger a backup.
     */
    async createBackup(reason = "manual") {
      try {
        const settings = await _loadSettings();
        const {
          base64,
          scriptCount,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage,
          settingsCredentialsIncluded,
          redactedSettingsCredentialKeys
        } = await _collectBackupData({
          includeSettingsCredentials: settings.includeSettingsCredentials === true
        });
        const sizeBytes = Math.round(base64.length * 0.75);
        const backupId = _generateId();
        const backup = {
          id: backupId,
          timestamp: Date.now(),
          version: chrome.runtime.getManifest?.()?.version ?? "1.0",
          reason,
          scriptCount,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage,
          settingsCredentialsIncluded,
          redactedSettingsCredentialKeys,
          size: sizeBytes,
          sizeFormatted: _formatBytes(sizeBytes)
        };
        await BackupScheduler.pruneOldBackups();
        const storedInIdb = await _storeBackupBlob(backupId, base64);
        if (!storedInIdb) {
          backup.data = base64;
        }
        const backups = await _getBackupList();
        backups.unshift(backup);
        try {
          await _saveBackupList(backups);
        } catch (err) {
          if (storedInIdb) await _deleteBackupBlob(backupId);
          throw err;
        }
        if (settings.warnOnStorageFull) {
          const allBackups = await _getBackupList();
          const totalSize = _estimateBackupSize(allBackups);
          if (totalSize > STORAGE_WARNING_BYTES) {
            _notify(
              "Storage Warning",
              `Backup storage is using ${_formatBytes(totalSize)}. Consider reducing the backup limit or deleting old backups.`,
              true
            );
          }
        }
        if (settings.notifyOnSuccess) {
          _notify(
            "Backup Complete",
            `${reason.charAt(0).toUpperCase() + reason.slice(1)} backup created with ${scriptCount} scripts (${_formatBytes(sizeBytes)}).`
          );
        }
        if (settings.cloudBackupEnabled) {
          _uploadBackupToCloud(backup).catch((cloudErr) => {
            console.error("[BackupScheduler] cloud backup upload failed:", cloudErr);
          });
        }
        return { success: true, backupId: backup.id };
      } catch (err) {
        const settings = await _loadSettings();
        const errMsg = err instanceof Error ? err.message : String(err);
        if (settings.notifyOnFailure) {
          _notify("Backup Failed", `Error: ${errMsg}`, true);
        }
        console.error("[BackupScheduler] createBackup error:", err);
        return { success: false, error: errMsg };
      }
    },
    /**
     * Get all stored backups (without full data blobs to save memory).
     */
    async getBackups() {
      const backups = await _getBackupList();
      return backups.map(
        (b) => ({
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
          redactedSettingsCredentialKeys: Array.isArray(b.redactedSettingsCredentialKeys) ? b.redactedSettingsCredentialKeys.slice() : [],
          size: b.size,
          sizeFormatted: b.sizeFormatted
        })
      );
    },
    /**
     * Restore from a backup.
     * If selective = true, only restore scripts whose original IDs are in scriptIds.
     * Older backups may fall back to matching by script name.
     * Otherwise full restore (scripts, settings, folders, workspaces).
     */
    async restoreBackup(backupId, options = {}) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return { success: false, error: "Backup not found" };
      const recordReceipt = options.recordReceipt !== false;
      const sourceLabel = typeof options.sourceLabel === "string" && options.sourceLabel.trim() ? options.sourceLabel.trim() : `Backup ${new Date(backup.timestamp).toISOString()}`;
      let snapshot = null;
      if (recordReceipt) {
        try {
          snapshot = await _captureSnapshot({ includeGlobals: !options.selective });
        } catch (_) {
        }
      }
      try {
        const backupData = backup.data ?? await _getBackupBlob(backup.id);
        if (!backupData) return { success: false, error: "Backup data not found" };
        const unzipped = unzipArchiveBounded(backupData);
        const fileNames = Object.keys(unzipped);
        let restoredScripts = 0;
        let skippedScripts = 0;
        let restoredSettings = false;
        let restoredFolders = false;
        let restoredWorkspaces = false;
        let settingsCredentialsRestored = false;
        let skippedSettingsCredentialKeys = [];
        let quarantinedScripts = 0;
        let preservedDisabledScripts = 0;
        let trustedEnabledScripts = 0;
        const errors = [];
        const settingsMetadata = _readSettingsMetadata(unzipped, backup);
        const trustImportedScripts = options.trustImportedScripts === true;
        const userScripts = fileNames.filter(
          (n) => n.endsWith(".user.js")
        );
        if (options.selective && Array.isArray(options.scriptIds)) {
          const selectedRefs = new Set(options.scriptIds);
          const selectedFiles = {};
          for (const filename of userScripts) {
            const baseName = filename.replace(/\.user\.js$/, "");
            const displayName = baseName.replace(/^scripts\//, "");
            let scriptId = "";
            let scriptName = displayName;
            let scriptNs = "";
            let optionsMeta = {};
            const optionsFile = `${baseName}.options.json`;
            const optionsFileData = unzipped[optionsFile];
            if (optionsFileData) {
              try {
                optionsMeta = parseArchiveJson(
                  unzipped,
                  optionsFile,
                  ARCHIVE_MAX_OPTIONS_BYTES
                );
                scriptId = typeof optionsMeta.scriptId === "string" ? optionsMeta.scriptId : "";
                scriptName = optionsMeta.meta?.name || displayName;
                scriptNs = optionsMeta.meta?.namespace || "";
              } catch (_) {
              }
            }
            const scriptKey = scriptNs ? `${scriptName}::${scriptNs}` : scriptName;
            const matchesSelection = selectedRefs.has(scriptName) || selectedRefs.has(displayName) || selectedRefs.has(scriptKey) || (scriptId ? selectedRefs.has(scriptId) : false);
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
              quarantinedScripts: 0,
              preservedDisabledScripts: 0,
              trustedEnabledScripts: 0,
              errors: []
            };
          }
          const selectiveZip = fflate.zipSync(selectedFiles, { level: 6 });
          const importResult = await importFromZip(
            _zipBytesToBase64(selectiveZip),
            {
              overwrite: true,
              recordReceipt: false,
              trustImportedScripts,
              sourceLabel
            }
          );
          if (importResult.error) {
            errors.push({ name: "archive", error: importResult.error });
          }
          restoredScripts = importResult.imported;
          skippedScripts = importResult.skipped;
          quarantinedScripts = Number(importResult.quarantinedScripts || 0);
          preservedDisabledScripts = Number(importResult.preservedDisabledScripts || 0);
          trustedEnabledScripts = Number(importResult.trustedEnabledScripts || 0);
          if (Array.isArray(importResult.errors)) {
            errors.push(...importResult.errors);
          }
        } else {
          try {
            const importResult = await importFromZip(backupData, {
              overwrite: true,
              recordReceipt: false,
              trustImportedScripts,
              sourceLabel
            });
            if (importResult.error) {
              errors.push({ name: "archive", error: importResult.error });
            }
            restoredScripts = importResult.imported;
            skippedScripts = importResult.skipped;
            quarantinedScripts = Number(importResult.quarantinedScripts || 0);
            preservedDisabledScripts = Number(importResult.preservedDisabledScripts || 0);
            trustedEnabledScripts = Number(importResult.trustedEnabledScripts || 0);
            if (Array.isArray(importResult.errors)) {
              errors.push(...importResult.errors);
            }
          } catch (importErr) {
            console.warn("[BackupScheduler] Full import error:", importErr);
            errors.push({
              name: "archive",
              error: importErr instanceof Error ? importErr.message : String(importErr)
            });
          }
        }
        if (!options.selective) {
          const globalSettingsFile = unzipped["global-settings.json"];
          if (globalSettingsFile) {
            try {
              const restoredSettingsData = parseArchiveJson(
                unzipped,
                "global-settings.json",
                ARCHIVE_MAX_JSON_ENTRY_BYTES
              );
              const settingsRestore = _prepareSettingsForRestore(restoredSettingsData, {
                allowCredentials: options.importSettingsCredentials === true && settingsMetadata.settingsCredentialsIncluded === true
              });
              await SettingsManager.set(settingsRestore.settings);
              restoredSettings = true;
              settingsCredentialsRestored = settingsRestore.settingsCredentialsRestored;
              skippedSettingsCredentialKeys = settingsRestore.skippedSettingsCredentialKeys;
            } catch (settingsErr) {
              errors.push({
                name: "global-settings.json",
                error: settingsErr instanceof Error ? settingsErr.message : String(settingsErr)
              });
            }
          }
          const foldersFile = unzipped["folders.json"];
          if (foldersFile) {
            try {
              const folders = parseArchiveJson(
                unzipped,
                "folders.json",
                ARCHIVE_MAX_JSON_ENTRY_BYTES
              );
              await chrome.storage.local.set({ scriptFolders: folders });
              FolderStorage.cache = null;
              restoredFolders = true;
            } catch (foldersErr) {
              errors.push({
                name: "folders.json",
                error: foldersErr instanceof Error ? foldersErr.message : String(foldersErr)
              });
            }
          }
          const workspacesFile = unzipped["workspaces.json"];
          if (workspacesFile) {
            try {
              const workspaces = parseArchiveJson(
                unzipped,
                "workspaces.json",
                ARCHIVE_MAX_JSON_ENTRY_BYTES
              );
              await chrome.storage.local.set({ workspaces });
              const workspaceManager = globalThis.WorkspaceManager;
              if (workspaceManager) {
                workspaceManager._cache = null;
                workspaceManager._initPromise = null;
              }
              restoredWorkspaces = true;
            } catch (workspacesErr) {
              errors.push({
                name: "workspaces.json",
                error: workspacesErr instanceof Error ? workspacesErr.message : String(workspacesErr)
              });
            }
          }
        }
        const success = errors.length === 0 || restoredScripts > 0 || restoredSettings || restoredFolders || restoredWorkspaces;
        const result = {
          success,
          restoredScripts,
          skippedScripts,
          restoredSettings,
          restoredFolders,
          restoredWorkspaces,
          settingsCredentialsRestored,
          skippedSettingsCredentialKeys,
          quarantinedScripts,
          preservedDisabledScripts,
          trustedEnabledScripts,
          errors
        };
        if (recordReceipt && snapshot && (restoredScripts > 0 || restoredSettings || restoredFolders || restoredWorkspaces)) {
          try {
            let scriptIdsAfter = [];
            try {
              const after = await ScriptStorage.getAll();
              scriptIdsAfter = after.map((script) => script.id).filter((id) => typeof id === "string");
            } catch (_) {
            }
            const beforeSet = new Set(snapshot.scriptIdsBefore || []);
            const addedScriptIds = scriptIdsAfter.filter((id) => !beforeSet.has(id));
            const receipt = {
              id: _generateId(),
              type: "restore",
              source: "backup-restore",
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
            console.warn(
              "[BackupScheduler] restoreBackup failed to persist receipt:",
              receiptErr
            );
          }
        }
        return result;
      } catch (err) {
        console.error("[BackupScheduler] restoreBackup error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errMsg };
      }
    },
    /**
     * Delete a specific backup.
     */
    async deleteBackup(backupId) {
      const backups = await _getBackupList();
      const filtered = backups.filter(
        (b) => b.id !== backupId
      );
      if (filtered.length === backups.length)
        return { success: false, error: "Backup not found" };
      await _saveBackupList(filtered);
      await _deleteBackupBlob(backupId);
      return { success: true };
    },
    /**
     * Export a backup as a downloadable object (base64 ZIP + suggested filename).
     */
    async exportBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return null;
      const backupData = backup.data ?? await _getBackupBlob(backup.id);
      if (!backupData) return null;
      const dateStr = new Date(backup.timestamp).toISOString().replace(/[:.]/g, "-");
      return {
        zipData: backupData,
        filename: `scriptvault-autobackup-${dateStr}.zip`
      };
    },
    /**
     * Import a backup from externally provided base64 ZIP data.
     */
    async importBackup(data) {
      try {
        const unzipped = unzipArchiveBounded(data);
        const fileNames = Object.keys(unzipped);
        const scriptFiles = Object.keys(unzipped).filter(
          (n) => n.endsWith(".user.js")
        );
        const hasGlobalSettings = fileNames.includes("global-settings.json");
        const hasFolders = fileNames.includes("folders.json");
        const hasWorkspaces = fileNames.includes("workspaces.json");
        const hasScriptStorage = fileNames.some((name) => name.endsWith(".storage.json"));
        const settingsMetadata = _readSettingsMetadata(unzipped);
        if (scriptFiles.length === 0 && !hasGlobalSettings && !hasFolders && !hasWorkspaces) {
          return {
            success: false,
            error: "This ZIP does not look like a ScriptVault backup archive."
          };
        }
        const sizeBytes = Math.round(data.length * 0.75);
        const backup = {
          id: _generateId(),
          timestamp: Date.now(),
          version: "imported",
          reason: "imported",
          scriptCount: scriptFiles.length,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage,
          settingsCredentialsIncluded: settingsMetadata.settingsCredentialsIncluded,
          redactedSettingsCredentialKeys: settingsMetadata.redactedSettingsCredentialKeys,
          size: sizeBytes,
          sizeFormatted: _formatBytes(sizeBytes),
          data
        };
        await BackupScheduler.pruneOldBackups();
        const backups = await _getBackupList();
        backups.unshift(backup);
        await _saveBackupList(backups);
        return { success: true, backupId: backup.id };
      } catch (err) {
        console.error("[BackupScheduler] importBackup error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errMsg };
      }
    },
    /**
     * Get current scheduler settings.
     */
    getSettings() {
      return { ...DEFAULT_SETTINGS, ..._settings ?? {} };
    },
    /**
     * Update scheduler settings and re-register alarms.
     */
    async setSettings(settings) {
      const merged = {
        ...await _loadSettings(),
        ...settings
      };
      await _saveSettings(merged);
      await _registerAlarms();
      const prunedCount = await BackupScheduler.pruneOldBackups();
      return { ..._settings, prunedCount };
    },
    /**
     * Remove old backups exceeding the retention limit.
     */
    async pruneOldBackups() {
      const settings = await _loadSettings();
      const backups = await _getBackupList();
      const rawMax = Number(settings.maxBackups);
      const maxBackups = Number.isFinite(rawMax) && rawMax >= 1 ? Math.floor(rawMax) : 5;
      if (backups.length <= maxBackups) return 0;
      const pruned = backups.slice(0, maxBackups);
      const removed = backups.slice(maxBackups);
      for (const entry of removed) {
        await _deleteBackupBlob(entry.id);
      }
      await _saveBackupList(pruned);
      return removed.length;
    },
    /**
     * Called externally when a script is installed, updated, or deleted.
     * If scheduleType is 'onChange', sets a debounce alarm.
     */
    async onScriptChanged() {
      const settings = await _loadSettings();
      if (!settings.enabled || settings.scheduleType !== "onChange") return;
      await chrome.alarms.clear(DEBOUNCE_ALARM);
      chrome.alarms.create(DEBOUNCE_ALARM, {
        delayInMinutes: DEBOUNCE_MINUTES
      });
    },
    /**
     * Get a detailed manifest of what's inside a specific backup
     * (script names and sizes) without decompressing the whole thing to memory.
     */
    async inspectBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return null;
      try {
        const backupData = backup.data ?? await _getBackupBlob(backup.id);
        if (!backupData) return null;
        const unzipped = unzipArchiveBounded(backupData);
        const fileNames = Object.keys(unzipped);
        const parseJsonFile = (fileName) => {
          const fileData = unzipped[fileName];
          if (!fileData) return null;
          try {
            return parseArchiveJson(unzipped, fileName);
          } catch {
            return null;
          }
        };
        const countEntries = (value) => {
          if (Array.isArray(value)) return value.length;
          if (value && typeof value === "object") return Object.keys(value).length;
          return 0;
        };
        const globalSettings = parseJsonFile("global-settings.json");
        const settingsMetadata = _readSettingsMetadata(unzipped, backup);
        const folderData = parseJsonFile("folders.json");
        const workspaceData = parseJsonFile("workspaces.json");
        const folderList = Array.isArray(folderData) ? folderData : [];
        const workspaceList = Array.isArray(workspaceData?.list) ? workspaceData.list : Array.isArray(workspaceData) ? workspaceData : [];
        const scripts = fileNames.filter((n) => n.endsWith(".user.js")).map((n) => {
          const baseName = n.replace(/\.user\.js$/, "");
          const displayName = baseName.replace(
            /^scripts\//,
            ""
          );
          let scriptId = null;
          const optionsFileData = unzipped[`${baseName}.options.json`];
          if (optionsFileData) {
            try {
              const optionsData = parseArchiveJson(unzipped, `${baseName}.options.json`, ARCHIVE_MAX_OPTIONS_BYTES);
              scriptId = typeof optionsData.scriptId === "string" ? optionsData.scriptId : null;
              const name = optionsData.meta?.name || displayName;
              const namespace = optionsData.meta?.namespace || "";
              const enabled = optionsData.settings?.enabled !== false;
              if (optionsData.meta?.name) {
                return {
                  id: scriptId || (namespace ? `${name}::${namespace}` : name),
                  name,
                  namespace,
                  hasStorage: !!unzipped[`${baseName}.storage.json`],
                  enabled
                };
              }
            } catch (_) {
            }
          }
          return {
            id: scriptId || displayName,
            name: displayName,
            hasStorage: !!unzipped[`${baseName}.storage.json`],
            enabled: true
          };
        });
        const scriptsWithStorageCount = scripts.filter((script) => script.hasStorage).length;
        return {
          scriptCount: scripts.length,
          scripts,
          scriptsWithStorageCount,
          hasGlobalSettings: !!unzipped["global-settings.json"],
          settingsKeyCount: countEntries(globalSettings),
          settingsCredentialsIncluded: settingsMetadata.settingsCredentialsIncluded,
          redactedSettingsCredentialKeys: settingsMetadata.redactedSettingsCredentialKeys,
          hasFolders: !!unzipped["folders.json"],
          folderCount: countEntries(folderData),
          folders: folderList.map((folder) => {
            const value = folder && typeof folder === "object" ? folder : {};
            return {
              id: typeof value.id === "string" ? value.id : "",
              name: typeof value.name === "string" ? value.name : "Unnamed folder",
              scriptCount: Array.isArray(value.scriptIds) ? value.scriptIds.length : 0
            };
          }),
          hasWorkspaces: !!unzipped["workspaces.json"],
          workspaceCount: workspaceList.length,
          workspaces: workspaceList.map((workspace) => {
            const value = workspace && typeof workspace === "object" ? workspace : {};
            return {
              id: typeof value.id === "string" ? value.id : "",
              name: typeof value.name === "string" ? value.name : "Unnamed workspace",
              scriptCount: value.snapshot && typeof value.snapshot === "object" ? Object.keys(value.snapshot).length : 0,
              active: !Array.isArray(workspaceData) && workspaceData?.active === value.id
            };
          }),
          activeWorkspaceId: !Array.isArray(workspaceData) && typeof workspaceData?.active === "string" ? workspaceData.active : null
        };
      } catch (err) {
        console.error("[BackupScheduler] inspectBackup error:", err);
        return null;
      }
    },
    /**
     * Verify a backup without mutating current scripts.
     */
    async verifyBackup(backupId, opts = {}) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return null;
      const parseUserscript = typeof opts.parseUserscript === "function" ? opts.parseUserscript : null;
      try {
        const backupData = backup.data ?? await _getBackupBlob(backup.id);
        if (!backupData) return null;
        const unzipped = unzipArchiveBounded(backupData);
        const fileNames = Object.keys(unzipped);
        const installedIdSet = /* @__PURE__ */ new Set();
        try {
          const existing = await ScriptStorage.getAll();
          for (const script of existing) {
            if (script && typeof script.id === "string") {
              installedIdSet.add(script.id);
            }
          }
        } catch (_) {
        }
        const issues = [];
        let parseErrorCount = 0;
        let optionsParseErrors = 0;
        let storageParseErrors = 0;
        let unreadableFileCount = 0;
        let missingOptionsCount = 0;
        const missingStorageCount = 0;
        const scriptEntries = fileNames.filter((n) => n.endsWith(".user.js")).map((filename) => {
          const baseName = filename.replace(/\.user\.js$/, "");
          const displayName = baseName.replace(/^scripts\//, "");
          const optionsKey = `${baseName}.options.json`;
          const storageKey = `${baseName}.storage.json`;
          const scriptData = unzipped[filename];
          const optionsDataBytes = unzipped[optionsKey];
          const storageDataBytes = unzipped[storageKey];
          const hasOptions = !!optionsDataBytes;
          const hasStorage = !!storageDataBytes;
          let code = "";
          try {
            if (!scriptData) throw new Error("Missing script data");
            code = archiveEntryText(unzipped, filename, ARCHIVE_MAX_SCRIPT_BYTES);
          } catch (readErr) {
            unreadableFileCount++;
            const error = readErr instanceof Error ? readErr.message : String(readErr);
            issues.push({ kind: "unreadable-script", file: filename, error });
            return {
              filename,
              name: displayName,
              namespace: "",
              hasOptions,
              hasStorage,
              parseError: error
            };
          }
          let optionsData = null;
          if (hasOptions && optionsDataBytes) {
            try {
              optionsData = parseArchiveJson(
                unzipped,
                optionsKey,
                ARCHIVE_MAX_OPTIONS_BYTES
              );
            } catch (optErr) {
              optionsParseErrors++;
              issues.push({
                kind: "options-parse",
                file: optionsKey,
                error: optErr instanceof Error ? optErr.message : String(optErr)
              });
            }
          } else {
            missingOptionsCount++;
          }
          if (hasStorage && storageDataBytes) {
            try {
              parseArchiveJson(
                unzipped,
                storageKey,
                ARCHIVE_MAX_JSON_ENTRY_BYTES
              );
            } catch (stErr) {
              storageParseErrors++;
              issues.push({
                kind: "storage-parse",
                file: storageKey,
                error: stErr instanceof Error ? stErr.message : String(stErr)
              });
            }
          }
          let parseError = "";
          const rawMeta = optionsData?.["meta"] && typeof optionsData["meta"] === "object" ? optionsData["meta"] : {};
          let parsedMeta = rawMeta;
          if (parseUserscript) {
            const parsed = parseUserscript(code);
            if (parsed?.error) {
              parseError = parsed.error;
              parseErrorCount++;
              issues.push({
                kind: "script-parse",
                file: filename,
                error: parsed.error
              });
            } else if (parsed?.meta) {
              parsedMeta = parsed.meta;
            }
          } else if (!/==UserScript==/.test(code)) {
            parseError = "Missing ==UserScript== header";
            parseErrorCount++;
            issues.push({ kind: "script-parse", file: filename, error: parseError });
          }
          const scriptId = typeof optionsData?.["scriptId"] === "string" ? optionsData["scriptId"] : "";
          const name = typeof parsedMeta["name"] === "string" ? parsedMeta["name"] : displayName;
          const namespace = typeof parsedMeta["namespace"] === "string" ? parsedMeta["namespace"] : "";
          return {
            filename,
            name,
            namespace,
            hasOptions,
            hasStorage,
            parseError: parseError || void 0,
            scriptId: scriptId || void 0,
            conflictsWithId: scriptId && installedIdSet.has(scriptId) ? scriptId : void 0
          };
        });
        let globalSettingsValid = true;
        let foldersValid = true;
        let workspacesValid = true;
        const settingsMetadata = _readSettingsMetadata(unzipped, backup);
        if (unzipped["global-settings.json"]) {
          try {
            parseArchiveJson(
              unzipped,
              "global-settings.json",
              ARCHIVE_MAX_JSON_ENTRY_BYTES
            );
          } catch (err) {
            globalSettingsValid = false;
            issues.push({
              kind: "global-settings-parse",
              file: "global-settings.json",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (unzipped["folders.json"]) {
          try {
            parseArchiveJson(
              unzipped,
              "folders.json",
              ARCHIVE_MAX_JSON_ENTRY_BYTES
            );
          } catch (err) {
            foldersValid = false;
            issues.push({
              kind: "folders-parse",
              file: "folders.json",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (unzipped["workspaces.json"]) {
          try {
            parseArchiveJson(
              unzipped,
              "workspaces.json",
              ARCHIVE_MAX_JSON_ENTRY_BYTES
            );
          } catch (err) {
            workspacesValid = false;
            issues.push({
              kind: "workspaces-parse",
              file: "workspaces.json",
              error: err instanceof Error ? err.message : String(err)
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
            workspacesValid
          },
          issues
        };
      } catch (err) {
        console.error("[BackupScheduler] verifyBackup error:", err);
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
            workspacesValid: false
          },
          issues: [{
            kind: "archive",
            file: backupId,
            error: err instanceof Error ? err.message : String(err)
          }]
        };
      }
    },
    /**
     * List persisted restore/import receipts (metadata only, no snapshot blob).
     */
    async listReceipts() {
      const receipts = await _getReceipts();
      return receipts.map(_snapshotMeta).filter((meta) => !!meta);
    },
    /**
     * Fetch a single receipt with its full snapshot blob.
     */
    async getReceipt(receiptId) {
      const receipts = await _getReceipts();
      return receipts.find((receipt) => receipt?.id === receiptId) ?? null;
    },
    /**
     * Record an import receipt in the same registry as restore receipts.
     */
    async recordReceipt(receipt) {
      if (!receipt || typeof receipt !== "object") return null;
      const snapshot = receipt.snapshot ?? {
        scriptsBefore: [],
        valuesBefore: {},
        scriptIdsBefore: []
      };
      const next = {
        id: receipt.id || _generateId(),
        timestamp: receipt.timestamp || Date.now(),
        type: receipt.type || "import",
        source: receipt.source || "import",
        sourceLabel: receipt.sourceLabel || "",
        backupId: receipt.backupId || null,
        result: receipt.result || null,
        snapshot
      };
      await _pushReceipt(next);
      return _snapshotMeta(next);
    },
    /**
     * Roll a restore or import receipt back.
     */
    async rollbackRestoreReceipt(receiptId, opts = {}) {
      const receipts = await _getReceipts();
      const receipt = receipts.find((r) => r?.id === receiptId);
      if (!receipt) return { success: false, error: "Receipt not found" };
      if (receipt.rolledBackAt) {
        return {
          success: false,
          error: "Receipt already rolled back",
          alreadyRolledBack: true,
          rolledBackAt: receipt.rolledBackAt
        };
      }
      const snapshot = receipt.snapshot ?? {
        scriptsBefore: [],
        valuesBefore: {},
        scriptIdsBefore: []
      };
      const scriptsBefore = Array.isArray(snapshot.scriptsBefore) ? snapshot.scriptsBefore : [];
      const valuesBefore = snapshot.valuesBefore && typeof snapshot.valuesBefore === "object" ? snapshot.valuesBefore : {};
      const restoreGlobals = opts.restoreGlobals !== false;
      const errors = [];
      let restoredScripts = 0;
      let removedScripts = 0;
      let restoredValues = 0;
      const restoredScriptIds = [];
      for (const script of scriptsBefore) {
        if (!script || typeof script.id !== "string") continue;
        try {
          await ScriptStorage.set(script.id, structuredClone(script));
          restoredScriptIds.push(script.id);
          restoredScripts++;
        } catch (err) {
          errors.push({
            kind: "script",
            name: script.meta?.name || script.id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      for (const [scriptId, values] of Object.entries(valuesBefore)) {
        if (typeof ScriptValues === "undefined" || !ScriptValues || typeof ScriptValues.setAll !== "function") {
          break;
        }
        try {
          if (typeof ScriptValues.deleteAll === "function") {
            await ScriptValues.deleteAll(scriptId);
          }
          await ScriptValues.setAll(scriptId, values);
          restoredValues++;
        } catch (err) {
          errors.push({
            kind: "values",
            name: scriptId,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      const beforeIdSet = new Set(
        Array.isArray(snapshot.scriptIdsBefore) ? snapshot.scriptIdsBefore : []
      );
      let scriptIdsAfter = [];
      try {
        const after = await ScriptStorage.getAll();
        scriptIdsAfter = after.map((script) => script.id).filter((id) => typeof id === "string");
      } catch (err) {
        errors.push({
          kind: "getAll",
          error: err instanceof Error ? err.message : String(err)
        });
      }
      const addedFromSnapshot = Array.isArray(snapshot.addedScriptIds) ? snapshot.addedScriptIds : null;
      const toDelete = addedFromSnapshot ? addedFromSnapshot.filter((id) => scriptIdsAfter.includes(id)) : scriptIdsAfter.filter((id) => !beforeIdSet.has(id));
      for (const id of toDelete) {
        try {
          if (typeof ScriptValues !== "undefined" && ScriptValues && typeof ScriptValues.deleteAll === "function") {
            try {
              await ScriptValues.deleteAll(id);
            } catch (_) {
            }
          }
          await ScriptStorage.delete(id);
          removedScripts++;
        } catch (err) {
          errors.push({
            kind: "script-delete",
            name: id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      let restoredSettings = false;
      let restoredFolders = false;
      let restoredWorkspaces = false;
      if (restoreGlobals) {
        if (snapshot.settings !== void 0) {
          try {
            await SettingsManager.set(structuredClone(snapshot.settings));
            restoredSettings = true;
          } catch (err) {
            errors.push({
              kind: "settings",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (snapshot.folders !== void 0) {
          try {
            await chrome.storage.local.set({
              scriptFolders: structuredClone(snapshot.folders)
            });
            if (typeof FolderStorage !== "undefined" && FolderStorage) {
              FolderStorage.cache = null;
            }
            restoredFolders = true;
          } catch (err) {
            errors.push({
              kind: "folders",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (snapshot.workspaces !== void 0) {
          try {
            await chrome.storage.local.set({
              workspaces: structuredClone(snapshot.workspaces)
            });
            if (typeof WorkspaceManager !== "undefined" && WorkspaceManager) {
              WorkspaceManager._cache = null;
              WorkspaceManager._initPromise = null;
            }
            restoredWorkspaces = true;
          } catch (err) {
            errors.push({
              kind: "workspaces",
              error: err instanceof Error ? err.message : String(err)
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
        removedScriptIds: toDelete
      };
      const success = errors.length === 0;
      await _updateReceipt(receiptId, {
        rolledBackAt: Date.now(),
        rollbackError: success ? null : errors.map((error) => `${error.kind}: ${error.error}`).join("; "),
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
  var backup_scheduler_default = BackupScheduler;
  return module.exports.default || module.exports.BackupScheduler || module.exports;
})();
