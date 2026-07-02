// ============================================================================
// Generated from src/modules/sync-easycloud.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const EasyCloudSync = (() => {
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

  // src/modules/sync-easycloud.ts
  var sync_easycloud_exports = {};
  __export(sync_easycloud_exports, {
    EasyCloudSync: () => EasyCloudSync
  });
  module.exports = __toCommonJS(sync_easycloud_exports);

  // src/modules/sync-crypto.ts
  var DEFAULT_KDF_ITERATIONS = 21e4;
  var MAX_KDF_ITERATIONS = 1e7;
  var SALT_BYTES = 16;
  var IV_BYTES = 12;
  var TEXT_ENCODER = new TextEncoder();
  var TEXT_DECODER = new TextDecoder();
  function getCryptoApi() {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.subtle) {
      throw new Error("Web Crypto is not available for sync encryption");
    }
    return cryptoApi;
  }
  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 32768;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    if (typeof btoa === "function") return btoa(binary);
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor) return bufferCtor.from(bytes).toString("base64");
    throw new Error("Base64 encoding is not available for sync encryption");
  }
  function base64ToBytes(value) {
    if (typeof atob === "function") {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor) return new Uint8Array(bufferCtor.from(value, "base64"));
    throw new Error("Base64 decoding is not available for sync encryption");
  }
  function bytesToArrayBuffer(bytes) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    getCryptoApi().getRandomValues(bytes);
    return bytes;
  }
  function resolveIterations(settings) {
    const configured = settings.syncEncryptionKdfIterations;
    return Number.isFinite(configured) && configured && configured > 0 ? Math.floor(configured) : DEFAULT_KDF_ITERATIONS;
  }
  function getPassphrase(settings) {
    const passphrase = settings.syncEncryptionPassphrase;
    if (typeof passphrase !== "string" || passphrase.length === 0) {
      throw new Error("Sync encryption passphrase is required");
    }
    return passphrase;
  }
  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function normalizePlainSyncEnvelope(envelope) {
    return {
      ...envelope,
      version: typeof envelope.version === "number" ? envelope.version : 1,
      timestamp: typeof envelope.timestamp === "number" ? envelope.timestamp : Date.now(),
      scripts: Array.isArray(envelope.scripts) ? envelope.scripts : [],
      tombstones: isObject(envelope.tombstones) ? envelope.tombstones : {}
    };
  }
  function isEncryptedSyncEnvelope(value) {
    return isObject(value) && (value.encrypted === true || value.version === 2) && typeof value.ciphertext === "string" && typeof value.salt === "string" && typeof value.iv === "string";
  }
  function isEncryptionEnabled(settings) {
    return settings.syncEncryptionEnabled === true;
  }
  async function deriveAesGcmKey(passphrase, salt, iterations, usages) {
    const cryptoApi = getCryptoApi();
    const passphraseBytes = TEXT_ENCODER.encode(passphrase);
    const material = await cryptoApi.subtle.importKey(
      "raw",
      bytesToArrayBuffer(passphraseBytes),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return cryptoApi.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: bytesToArrayBuffer(salt),
        iterations,
        hash: "SHA-256"
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      usages
    );
  }
  async function encryptSyncEnvelope(envelope, settings) {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const iterations = resolveIterations(settings);
    const key = await deriveAesGcmKey(getPassphrase(settings), salt, iterations, ["encrypt"]);
    const plaintext = TEXT_ENCODER.encode(JSON.stringify(normalizePlainSyncEnvelope(envelope)));
    const ciphertext = new Uint8Array(await getCryptoApi().subtle.encrypt(
      { name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
      key,
      bytesToArrayBuffer(plaintext)
    ));
    return {
      version: 2,
      encrypted: true,
      format: "scriptvault-sync-e2ee",
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
      timestamp: Date.now()
    };
  }
  async function decryptSyncEnvelope(envelope, settings) {
    if (!envelope) return null;
    if (!isEncryptedSyncEnvelope(envelope)) {
      if (isEncryptionEnabled(settings) && settings.syncEncryptionEstablished === true) {
        throw new Error("Sync encryption is enabled but the remote data is not encrypted. Refusing to load possibly-tampered plaintext sync data.");
      }
      return normalizePlainSyncEnvelope(envelope);
    }
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const declaredIterations = envelope.iterations || DEFAULT_KDF_ITERATIONS;
    if (!Number.isFinite(declaredIterations) || declaredIterations <= 0 || declaredIterations > MAX_KDF_ITERATIONS) {
      throw new Error("Sync envelope declares an out-of-range KDF iteration count.");
    }
    const key = await deriveAesGcmKey(
      getPassphrase(settings),
      salt,
      declaredIterations,
      ["decrypt"]
    );
    try {
      const plaintext = await getCryptoApi().subtle.decrypt(
        { name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
        key,
        bytesToArrayBuffer(base64ToBytes(envelope.ciphertext))
      );
      const parsed = JSON.parse(TEXT_DECODER.decode(plaintext));
      if (!isObject(parsed)) {
        throw new Error("Decrypted sync payload is not an object");
      }
      return normalizePlainSyncEnvelope(parsed);
    } catch (_e) {
      throw new Error("Unable to decrypt sync data. Check the sync encryption passphrase.");
    }
  }
  async function prepareSyncEnvelopeForUpload(envelope, settings) {
    const normalized = normalizePlainSyncEnvelope(envelope);
    return isEncryptionEnabled(settings) ? encryptSyncEnvelope(normalized, settings) : normalized;
  }
  var SyncCrypto = {
    DEFAULT_KDF_ITERATIONS,
    isEncryptedSyncEnvelope,
    isEncryptionEnabled,
    encryptSyncEnvelope,
    decryptSyncEnvelope,
    prepareSyncEnvelopeForUpload
  };

  // src/modules/sync-easycloud.ts
  var TAG = "[EasyCloud]";
  var ALARM_NAME = "easycloud-periodic-sync";
  var DEBOUNCE_ALARM_NAME = "easycloud-debounce-sync";
  var ALARM_PERIOD_MINUTES = 15;
  var DEBOUNCE_MS = 5e3;
  var DRIVE_API = "https://www.googleapis.com/drive/v3";
  var DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
  var SYNC_FILE_NAME = "scriptvault-sync.json";
  var STORAGE_KEY_PREFIX = "easycloud_";
  var KEYS = {
    CONNECTED: STORAGE_KEY_PREFIX + "connected",
    DEVICE_ID: STORAGE_KEY_PREFIX + "deviceId",
    LAST_SYNC: STORAGE_KEY_PREFIX + "lastSync",
    STATUS: STORAGE_KEY_PREFIX + "status",
    OFFLINE_QUEUE: STORAGE_KEY_PREFIX + "offlineQueue",
    USER_EMAIL: STORAGE_KEY_PREFIX + "userEmail",
    USER_NAME: STORAGE_KEY_PREFIX + "userName",
    FILE_ID: STORAGE_KEY_PREFIX + "fileId"
  };
  var STATUS = {
    IDLE: "synced",
    SYNCING: "syncing",
    ERROR: "error",
    OFFLINE: "offline"
  };
  var _status = STATUS.IDLE;
  var _syncInProgress = false;
  var _statusListeners = [];
  var _cachedToken = null;
  var _cachedFileId = null;
  var _deviceId = null;
  var _initialized = false;
  async function fetchWithTimeout(url, options = {}, timeoutMs = 3e4) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }
  function log(...args) {
    console.log(TAG, ...args);
  }
  function warn(...args) {
    console.warn(TAG, ...args);
  }
  function _getRuntimeHooks() {
    return globalThis;
  }
  async function _refreshScriptRuntime(script) {
    const hooks = _getRuntimeHooks();
    if (typeof hooks.unregisterScript === "function") {
      try {
        await hooks.unregisterScript(script.id);
      } catch (e) {
        warn(`Failed to unregister synced script ${script.id}:`, e);
      }
    }
    if (script.enabled !== false && typeof hooks.registerScript === "function") {
      try {
        await hooks.registerScript(script);
      } catch (e) {
        warn(`Failed to register synced script ${script.id}:`, e);
      }
    }
  }
  async function _deleteSyncedScript(scriptId) {
    const hooks = _getRuntimeHooks();
    if (typeof hooks.unregisterScript === "function") {
      try {
        await hooks.unregisterScript(scriptId);
      } catch (e) {
        warn(`Failed to unregister deleted synced script ${scriptId}:`, e);
      }
    }
    await ScriptStorage.delete(scriptId);
  }
  async function _updateBadgeIfAvailable() {
    const hooks = _getRuntimeHooks();
    if (typeof hooks.updateBadge === "function") {
      try {
        await hooks.updateBadge();
      } catch (e) {
        warn("Failed to refresh badge after sync:", e);
      }
    }
  }
  async function _mergeScriptText(base, local, remote) {
    if (typeof ScriptAnalyzer !== "undefined" && typeof ScriptAnalyzer.mergeText === "function") {
      return ScriptAnalyzer.mergeText(base, local, remote);
    }
    if (typeof ScriptAnalyzer !== "undefined" && typeof ScriptAnalyzer._ensureOffscreen === "function") {
      const ready = await ScriptAnalyzer._ensureOffscreen();
      if (!ready) throw new Error("No script merge engine available");
      return chrome.runtime.sendMessage({
        type: "offscreen_merge",
        base,
        local,
        remote
      });
    }
    throw new Error("No script merge engine available");
  }
  var SYNC_SAFE_SCRIPT_SETTING_KEYS = /* @__PURE__ */ new Set([
    "autoUpdate",
    "notifyUpdates",
    "runAt",
    "injectInto",
    "frameMode",
    "notifyErrors",
    "notes",
    "useOriginalIncludes",
    "useOriginalMatches",
    "useOriginalExcludes",
    "userIncludes",
    "userMatches",
    "userExcludes",
    "pinned",
    "perfBudget",
    "syncValues",
    "tags"
  ]);
  var LOCAL_ONLY_SCRIPT_SETTING_KEYS = /* @__PURE__ */ new Set([
    "userModified",
    "mergeConflict",
    "syncLock",
    "sourceIdentityChanged",
    "_failedRequires",
    "_failedRequireErrors",
    "_registrationError"
  ]);
  function cloneScriptSettingValue(value) {
    if (value == null || typeof value !== "object") return value;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return void 0;
    }
  }
  function cloneSyncSafeScriptSettings(settings) {
    if (!settings || typeof settings !== "object") return {};
    const result = {};
    for (const [key, value] of Object.entries(settings)) {
      if (!SYNC_SAFE_SCRIPT_SETTING_KEYS.has(key) || LOCAL_ONLY_SCRIPT_SETTING_KEYS.has(key)) {
        continue;
      }
      result[key] = cloneScriptSettingValue(value);
    }
    return result;
  }
  function mergeSyncedScriptSettings(localSettings, remoteSettings, options = {}) {
    return {
      ...localSettings && typeof localSettings === "object" ? localSettings : {},
      ...cloneSyncSafeScriptSettings(remoteSettings),
      ...options.mergeConflict ? { mergeConflict: true } : {}
    };
  }
  function sanitizeSyncScriptForEnvelope(script) {
    return {
      ...script,
      settings: cloneSyncSafeScriptSettings(script.settings)
    };
  }
  function sanitizeSyncEnvelopeForUpload(envelope) {
    return {
      ...envelope,
      scripts: (envelope.scripts || []).map((script) => sanitizeSyncScriptForEnvelope(script))
    };
  }
  async function getSyncCryptoSettings() {
    try {
      return typeof SettingsManager.get === "function" ? await SettingsManager.get() : {};
    } catch (_) {
      return {};
    }
  }
  async function readSyncEnvelopeFromRemote(remoteEnvelope) {
    return SyncCrypto.decryptSyncEnvelope(
      remoteEnvelope,
      await getSyncCryptoSettings()
    );
  }
  async function prepareSyncEnvelopeForRemoteUpload(envelope) {
    return SyncCrypto.prepareSyncEnvelopeForUpload(
      sanitizeSyncEnvelopeForUpload(envelope),
      await getSyncCryptoSettings()
    );
  }
  function setStatus(newStatus) {
    if (_status === newStatus) return;
    _status = newStatus;
    _persistStatus(newStatus);
    for (const cb of _statusListeners) {
      try {
        cb(newStatus);
      } catch (e) {
        warn("Status listener error:", e);
      }
    }
  }
  async function _persistStatus(status) {
    try {
      await chrome.storage.local.set({ [KEYS.STATUS]: status });
    } catch (_) {
    }
  }
  async function _getStorageValues(keys) {
    return chrome.storage.local.get(keys);
  }
  async function _setStorageValues(obj) {
    return chrome.storage.local.set(obj);
  }
  async function _ensureDeviceId() {
    if (_deviceId) return _deviceId;
    const data = await _getStorageValues([KEYS.DEVICE_ID]);
    const storedId = data[KEYS.DEVICE_ID];
    if (typeof storedId === "string" && storedId) {
      _deviceId = storedId;
      return _deviceId;
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    _deviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await _setStorageValues({ [KEYS.DEVICE_ID]: _deviceId });
    return _deviceId;
  }
  function _isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }
  async function _getAuthToken(interactive = false) {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      throw new Error('chrome.identity API not available. Grant the "identity" permission.');
    }
    try {
      const result = await chrome.identity.getAuthToken({
        interactive,
        scopes: [
          "https://www.googleapis.com/auth/drive.appdata",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile"
        ]
      });
      const token = result?.token || result;
      if (!token || typeof token !== "string") {
        throw new Error("No token returned from chrome.identity");
      }
      _cachedToken = token;
      return token;
    } catch (e) {
      _cachedToken = null;
      throw e;
    }
  }
  async function _getValidToken() {
    if (_cachedToken) {
      const ok = await _testToken(_cachedToken);
      if (ok) return _cachedToken;
      try {
        await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
      } catch (_) {
      }
      _cachedToken = null;
    }
    try {
      return await _getAuthToken(false);
    } catch (_) {
      return null;
    }
  }
  async function _testToken(token) {
    try {
      const resp = await fetchWithTimeout(`${DRIVE_API}/about?fields=user`, {
        headers: { "Authorization": `Bearer ${token}` }
      }, 1e4);
      return resp.ok;
    } catch (_) {
      return false;
    }
  }
  async function _findSyncFile(token) {
    if (_cachedFileId) {
      try {
        const resp2 = await fetchWithTimeout(
          `${DRIVE_API}/files/${_cachedFileId}?fields=id,modifiedTime`,
          { headers: { "Authorization": `Bearer ${token}` } },
          1e4
        );
        if (resp2.ok) return _cachedFileId;
      } catch (_) {
      }
      _cachedFileId = null;
    }
    const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
    const resp = await fetchWithTimeout(
      `${DRIVE_API}/files?q=${query}&spaces=appDataFolder&fields=files(id,modifiedTime)`,
      { headers: { "Authorization": `Bearer ${token}` } },
      15e3
    );
    if (!resp.ok) {
      throw new Error(`Drive file search failed: ${resp.status}`);
    }
    const data = await resp.json();
    const file = data.files?.[0];
    if (file) {
      _cachedFileId = file.id;
      await _setStorageValues({ [KEYS.FILE_ID]: file.id });
    }
    return file?.id ?? null;
  }
  async function _downloadFromDrive(token) {
    const fileId = await _findSyncFile(token);
    if (!fileId) return null;
    const resp = await fetchWithTimeout(
      `${DRIVE_API}/files/${fileId}?alt=media`,
      { headers: { "Authorization": `Bearer ${token}` } },
      6e4
    );
    if (resp.status === 404) {
      _cachedFileId = null;
      return null;
    }
    if (!resp.ok) {
      throw new Error(`Drive download failed: ${resp.status}`);
    }
    return resp.json();
  }
  async function _uploadToDrive(token, data) {
    const fileId = await _findSyncFile(token);
    const metadata = {
      name: SYNC_FILE_NAME,
      mimeType: "application/json"
    };
    if (!fileId) {
      metadata.parents = ["appDataFolder"];
    }
    const boundary = "---EasyCloud" + crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      JSON.stringify(data),
      `--${boundary}--`
    ].join("\r\n");
    const url = fileId ? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart` : `${DRIVE_UPLOAD_API}/files?uploadType=multipart`;
    const resp = await fetchWithTimeout(url, {
      method: fileId ? "PATCH" : "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    }, 6e4);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Drive upload failed (${resp.status}): ${errText}`);
    }
    const result = await resp.json();
    if (result.id && !_cachedFileId) {
      _cachedFileId = result.id;
      await _setStorageValues({ [KEYS.FILE_ID]: result.id });
    }
  }
  async function _enqueueOfflineChange(change) {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const raw = data[KEYS.OFFLINE_QUEUE];
    const queue = Array.isArray(raw) ? raw : [];
    queue.push({ ...change, queuedAt: Date.now() });
    if (queue.length > 500) queue.splice(0, queue.length - 500);
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: queue });
  }
  async function _drainOfflineQueue() {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const raw = data[KEYS.OFFLINE_QUEUE];
    const queue = Array.isArray(raw) ? raw : [];
    if (queue.length === 0) return;
    log(`Draining offline queue (${queue.length} entries)`);
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: [] });
    await _performSync();
  }
  async function _mergeData(localData, remoteData, deviceId) {
    const localScripts = new Map(
      (localData.scripts || []).map((s) => [s.id, s])
    );
    const remoteScripts = new Map(
      (remoteData.scripts || []).map((s) => [s.id, s])
    );
    const localTombstones = localData.tombstones || {};
    const remoteTombstones = remoteData.tombstones || {};
    const mergedTombstones = { ...localTombstones, ...remoteTombstones };
    const allIds = /* @__PURE__ */ new Set([...localScripts.keys(), ...remoteScripts.keys()]);
    const mergedScripts = [];
    for (const id of allIds) {
      if (mergedTombstones[id]) continue;
      const local = localScripts.get(id);
      const remote = remoteScripts.get(id);
      if (!remote) {
        if (local) mergedScripts.push(sanitizeSyncScriptForEnvelope(local));
        continue;
      }
      if (!local) {
        mergedScripts.push(sanitizeSyncScriptForEnvelope(remote));
        continue;
      }
      const merged = sanitizeSyncScriptForEnvelope(local);
      const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);
      if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
        merged.enabled = remote.enabled;
        merged.position = remote.position;
        merged.settings = mergeSyncedScriptSettings(local.settings, remote.settings);
      }
      if (local.code !== remote.code) {
        const base = local.syncBaseCode || remote.syncBaseCode || null;
        if (base && base !== local.code && base !== remote.code) {
          try {
            const mergeResult = await _mergeScriptText(base, local.code, remote.code);
            if (mergeResult && !mergeResult.error) {
              merged.code = mergeResult.merged ?? merged.code;
              if (mergeResult.conflicts) {
                merged.settings = mergeSyncedScriptSettings(merged.settings, {}, {
                  mergeConflict: true
                });
              }
              log(`3-way merge for ${id}: conflicts=${String(mergeResult.conflicts || false)}`);
            } else {
              merged.code = localNewer ? local.code : remote.code;
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            warn(`3-way merge failed for ${id}:`, msg);
            merged.code = localNewer ? local.code : remote.code;
          }
        } else {
          merged.code = localNewer ? local.code : remote.code;
        }
      }
      merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
      merged.syncBaseCode = merged.code;
      merged.lastSyncDevice = deviceId;
      mergedScripts.push(merged);
    }
    return {
      version: 1,
      timestamp: Date.now(),
      deviceId,
      scripts: mergedScripts,
      tombstones: mergedTombstones
    };
  }
  async function _performSync() {
    if (_syncInProgress) {
      log("Sync already in progress, skipping");
      return { skipped: true };
    }
    if (!_isOnline()) {
      setStatus(STATUS.OFFLINE);
      return { offline: true };
    }
    _syncInProgress = true;
    setStatus(STATUS.SYNCING);
    try {
      const token = await _getValidToken();
      if (!token) {
        setStatus(STATUS.ERROR);
        return { error: "Not authenticated" };
      }
      const deviceId = await _ensureDeviceId();
      const tombstoneData = await _getStorageValues(["syncTombstones"]);
      const tombstones = tombstoneData["syncTombstones"] || {};
      const scripts = await ScriptStorage.getAll();
      const localData = {
        version: 1,
        timestamp: Date.now(),
        deviceId,
        scripts: scripts.map((s) => ({
          id: s.id,
          code: s.code,
          enabled: s.enabled,
          position: s.position,
          settings: cloneSyncSafeScriptSettings(s.settings),
          updatedAt: s.updatedAt || 0,
          syncBaseCode: s.syncBaseCode || null
        })),
        tombstones
      };
      const remoteEnvelope = await _downloadFromDrive(token);
      const remoteData = await readSyncEnvelopeFromRemote(remoteEnvelope);
      if (remoteData) {
        const merged = await _mergeData(localData, remoteData, deviceId);
        const mergedTombstones = merged.tombstones || {};
        let localMutated = false;
        for (const localScript of scripts) {
          if (!mergedTombstones[localScript.id]) continue;
          await _deleteSyncedScript(localScript.id);
          localMutated = true;
        }
        for (const script of merged.scripts) {
          if (mergedTombstones[script.id]) continue;
          const existing = await ScriptStorage.get(script.id);
          if (existing?.settings?.userModified) continue;
          if (!existing || script.updatedAt > (existing.updatedAt || 0)) {
            const parsed = typeof parseUserscript === "function" ? parseUserscript(script.code) : { meta: {}, error: null };
            if (!parsed.error) {
              const nextScript = {
                id: script.id,
                code: script.code,
                meta: parsed.meta,
                enabled: script.enabled,
                position: script.position,
                settings: mergeSyncedScriptSettings(existing?.settings, script.settings),
                updatedAt: script.updatedAt,
                createdAt: existing?.createdAt || script.updatedAt,
                syncBaseCode: script.code
              };
              await ScriptStorage.set(script.id, nextScript);
              await _refreshScriptRuntime(nextScript);
              localMutated = true;
            }
          }
        }
        if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
          await chrome.storage.local.set({ syncTombstones: mergedTombstones });
        }
        if (localMutated) {
          await _updateBadgeIfAvailable();
        }
        merged.timestamp = Date.now();
        await _uploadToDrive(token, await prepareSyncEnvelopeForRemoteUpload(merged));
      } else {
        await _uploadToDrive(token, await prepareSyncEnvelopeForRemoteUpload(localData));
      }
      const now = Date.now();
      await _setStorageValues({ [KEYS.LAST_SYNC]: now });
      try {
        await SettingsManager.set("lastSync", now);
      } catch (_) {
      }
      setStatus(STATUS.IDLE);
      log("Sync completed successfully");
      return { success: true, timestamp: now };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warn("Sync failed:", e);
      setStatus(STATUS.ERROR);
      return { error: msg };
    } finally {
      _syncInProgress = false;
    }
  }
  function _debouncedSync() {
    chrome.alarms.create(DEBOUNCE_ALARM_NAME, {
      delayInMinutes: DEBOUNCE_MS / 6e4
    });
  }
  async function _setupPeriodicSync() {
    try {
      await chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: ALARM_PERIOD_MINUTES,
        periodInMinutes: ALARM_PERIOD_MINUTES
      });
    } catch (e) {
      warn("Failed to create periodic sync alarm:", e);
    }
  }
  async function _clearPeriodicSync() {
    try {
      await chrome.alarms.clear(ALARM_NAME);
    } catch (_) {
    }
  }
  async function _clearDebounceSync() {
    try {
      await chrome.alarms.clear(DEBOUNCE_ALARM_NAME);
    } catch (_) {
    }
  }
  function _handleAlarm(alarm) {
    if (alarm.name === DEBOUNCE_ALARM_NAME) {
      _performSync().catch((e) => warn("Debounced sync error:", e));
      return;
    }
    if (alarm.name !== ALARM_NAME) return;
    _performSync().catch((e) => warn("Periodic sync error:", e));
  }
  function _handleOnline() {
    log("Back online, draining queue and syncing");
    _drainOfflineQueue().catch((e) => warn("Queue drain error:", e));
  }
  function _handleOffline() {
    log("Went offline");
    setStatus(STATUS.OFFLINE);
  }
  function _setupStorageListener() {
    chrome.storage.onChanged.addListener(
      (changes, areaName) => {
        if (areaName !== "local") return;
        if (changes["userscripts"]) {
          _getStorageValues([KEYS.CONNECTED]).then((d) => {
            if (d[KEYS.CONNECTED]) {
              _debouncedSync();
            }
          }).catch(() => {
          });
        }
      }
    );
  }
  var EasyCloudSync = {
    /**
     * Initialize EasyCloud sync. Call once on extension startup.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;
      const data = await _getStorageValues([
        KEYS.CONNECTED,
        KEYS.DEVICE_ID,
        KEYS.STATUS,
        KEYS.FILE_ID
      ]);
      const storedDeviceId = data[KEYS.DEVICE_ID];
      _deviceId = typeof storedDeviceId === "string" ? storedDeviceId : null;
      const storedFileId = data[KEYS.FILE_ID];
      _cachedFileId = typeof storedFileId === "string" ? storedFileId : null;
      const storedStatus = data[KEYS.STATUS];
      if (typeof storedStatus === "string" && storedStatus) {
        _status = storedStatus;
      }
      _setupStorageListener();
      chrome.alarms.onAlarm.addListener(_handleAlarm);
      if (typeof self !== "undefined") {
        self.addEventListener("online", _handleOnline);
        self.addEventListener("offline", _handleOffline);
      }
      if (data[KEYS.CONNECTED]) {
        if (!_isOnline()) {
          setStatus(STATUS.OFFLINE);
        } else {
          await _setupPeriodicSync();
          _performSync().catch((e) => warn("Init sync error:", e));
        }
      }
      log("Initialized");
    },
    /**
     * Connect to Google Drive via chrome.identity (interactive sign-in).
     */
    async connect() {
      try {
        if (chrome.permissions && chrome.permissions.request) {
          const granted = await chrome.permissions.request({
            permissions: ["identity"]
          });
          if (!granted) {
            return { success: false, error: "Identity permission denied" };
          }
        }
        const token = await _getAuthToken(true);
        if (!token) {
          return { success: false, error: "Authentication failed" };
        }
        let user = {};
        try {
          const resp = await fetchWithTimeout("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { "Authorization": `Bearer ${token}` }
          }, 1e4);
          if (resp.ok) {
            user = await resp.json();
          }
        } catch (_) {
        }
        await _ensureDeviceId();
        await _setStorageValues({
          [KEYS.CONNECTED]: true,
          [KEYS.USER_EMAIL]: user.email || "",
          [KEYS.USER_NAME]: user.name || ""
        });
        await _setupPeriodicSync();
        _performSync().catch((e) => warn("Post-connect sync error:", e));
        setStatus(STATUS.IDLE);
        log("Connected as", user.email || "(unknown)");
        return {
          success: true,
          user: { email: user.email || "", name: user.name || "", picture: user.picture }
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warn("Connect failed:", e);
        return { success: false, error: msg };
      }
    },
    /**
     * Disconnect from Google Drive. Revokes token and clears state.
     */
    async disconnect() {
      try {
        if (_cachedToken) {
          try {
            await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
            fetchWithTimeout(`https://accounts.google.com/o/oauth2/revoke?token=${_cachedToken}`, {}, 1e4).catch(() => {
            });
          } catch (_) {
          }
          _cachedToken = null;
        }
        await _clearPeriodicSync();
        await _clearDebounceSync();
        await _setStorageValues({
          [KEYS.CONNECTED]: false,
          [KEYS.USER_EMAIL]: "",
          [KEYS.USER_NAME]: "",
          [KEYS.FILE_ID]: "",
          [KEYS.OFFLINE_QUEUE]: [],
          [KEYS.STATUS]: STATUS.IDLE
        });
        _cachedFileId = null;
        _status = STATUS.IDLE;
        for (const cb of _statusListeners) {
          try {
            cb(STATUS.IDLE);
          } catch (_) {
          }
        }
        log("Disconnected");
        return { success: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warn("Disconnect error:", e);
        return { success: false, error: msg };
      }
    },
    /**
     * Trigger an immediate sync. Returns sync result.
     */
    async sync() {
      if (!_isOnline()) {
        setStatus(STATUS.OFFLINE);
        return { offline: true };
      }
      const data = await _getStorageValues([KEYS.CONNECTED]);
      if (!data[KEYS.CONNECTED]) {
        return { error: "Not connected. Call connect() first." };
      }
      return _performSync();
    },
    /**
     * Get current sync status and metadata.
     */
    async getStatus() {
      const data = await _getStorageValues([
        KEYS.CONNECTED,
        KEYS.LAST_SYNC,
        KEYS.STATUS,
        KEYS.USER_EMAIL,
        KEYS.USER_NAME,
        KEYS.DEVICE_ID
      ]);
      const storedStatus = data[KEYS.STATUS];
      const lastSync = data[KEYS.LAST_SYNC];
      const userEmail = data[KEYS.USER_EMAIL];
      const userName = data[KEYS.USER_NAME];
      const storedDeviceId = data[KEYS.DEVICE_ID];
      return {
        connected: !!data[KEYS.CONNECTED],
        status: (typeof storedStatus === "string" ? storedStatus : "") || _status,
        lastSync: typeof lastSync === "number" ? lastSync : null,
        user: data[KEYS.CONNECTED] ? {
          email: typeof userEmail === "string" ? userEmail : "",
          name: typeof userName === "string" ? userName : ""
        } : null,
        deviceId: typeof storedDeviceId === "string" ? storedDeviceId : null,
        online: _isOnline()
      };
    },
    /**
     * Check if currently connected (synchronous, uses cached state).
     */
    isConnected() {
      return _status !== STATUS.ERROR && _cachedToken !== null;
    },
    /**
     * Register a status change callback. Returns an unsubscribe function.
     */
    onStatusChange(callback) {
      if (typeof callback !== "function") {
        throw new TypeError("onStatusChange requires a function callback");
      }
      _statusListeners.push(callback);
      return () => {
        _statusListeners = _statusListeners.filter((cb) => cb !== callback);
      };
    },
    /**
     * Notify EasyCloud that a script was saved (triggers debounced sync).
     */
    notifyScriptSaved(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: "save", scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    },
    /**
     * Notify EasyCloud that a script was deleted (triggers debounced sync).
     */
    notifyScriptDeleted(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: "delete", scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    }
  };
  if (typeof CloudSyncProviders !== "undefined") {
    CloudSyncProviders["easycloud"] = {
      name: "EasyCloud (Google)",
      icon: "\u26A1",
      requiresAuth: false,
      requiresOAuth: false,
      isZeroConfig: true,
      supportsManualSync: true,
      supportsDryRun: false,
      getStorageDisclosure(_settings) {
        return {
          storage: "chrome.storage.local + chrome.identity",
          protection: "Extension-scoped browser storage plus Chrome identity token cache; ScriptVault does not persist EasyCloud OAuth tokens directly.",
          fields: [
            { key: "easycloud_connected", label: "EasyCloud connected flag", type: "metadata", present: false },
            { key: "easycloud_deviceId", label: "EasyCloud device ID", type: "metadata", present: false },
            { key: "easycloud_userEmail", label: "Connected Google account email", type: "metadata", present: false },
            { key: "easycloud_userName", label: "Connected Google account name", type: "metadata", present: false },
            { key: "chrome.identity token cache", label: "Google OAuth token cache managed by Chrome", type: "token", present: false }
          ],
          hasStoredSecrets: false,
          revokeAction: "Remove the Chrome identity cached token and clear EasyCloud local metadata.",
          notes: "EasyCloud uses chrome.identity for zero-config Google Drive app-data sync."
        };
      },
      async connect() {
        return EasyCloudSync.connect();
      },
      async disconnect() {
        return EasyCloudSync.disconnect();
      },
      async upload(_data, _settings) {
        const result = await EasyCloudSync.sync();
        if (result.error) throw new Error(result.error);
        return { success: true, timestamp: Date.now() };
      },
      async download(_settings) {
        await EasyCloudSync.sync();
        return null;
      },
      async test() {
        const status = await EasyCloudSync.getStatus();
        return { success: status.connected && status.online };
      },
      async getStatus() {
        const status = await EasyCloudSync.getStatus();
        return {
          connected: status.connected,
          user: status.user,
          status: status.status,
          lastSync: status.lastSync
        };
      }
    };
  }
  return module.exports.default || module.exports.EasyCloudSync || module.exports;
})();
