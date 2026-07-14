// ============================================================================
// Generated from src/modules/sync-providers.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const CloudSyncProviders = (() => {
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

  // src/modules/sync-providers.ts
  var sync_providers_exports = {};
  __export(sync_providers_exports, {
    CloudSyncProviders: () => CloudSyncProviders,
    SyncCredentialStore: () => SyncCredentialStore
  });
  module.exports = __toCommonJS(sync_providers_exports);

  // src/background/internal-host-guard.ts
  function isInternalIPv4(ip) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 240) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (typeof rawHost !== "string" || !rawHost) return true;
    let h = rawHost.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    if (h === "localhost" || h === "localhost.localdomain" || h === "ip6-localhost" || h === "ip6-loopback" || h.endsWith(".localhost")) {
      return true;
    }
    if (h.includes(":")) {
      if (h === "::1" || h === "::" || h === "::0" || h === "0:0:0:0:0:0:0:0" || h === "0:0:0:0:0:0:0:1") return true;
      if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
      if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
      const v4MappedDotted = h.match(/^::ffff:([0-9.]+)$/);
      if (v4MappedDotted) return isInternalIPv4(v4MappedDotted[1]);
      const v4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (v4MappedHex) {
        const hi = parseInt(v4MappedHex[1], 16);
        const lo = parseInt(v4MappedHex[2], 16);
        const dotted = [hi >> 8 & 255, hi & 255, lo >> 8 & 255, lo & 255].join(".");
        return isInternalIPv4(dotted);
      }
      return false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      return isInternalIPv4(h);
    }
    return false;
  }
  function classifyFetchUrl(url, allowedSchemes = ["https:"]) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "malformed-url", url: null, message: "malformed URL" };
    }
    if (!allowedSchemes.includes(parsed.protocol)) {
      return {
        ok: false,
        reason: "unsupported-scheme",
        url: parsed,
        message: `unsupported scheme ${parsed.protocol}`
      };
    }
    const host = parsed.hostname || "";
    if (!host) {
      return { ok: false, reason: "empty-hostname", url: parsed, message: "empty hostname" };
    }
    if (isInternalHost(host)) {
      let reason = "internal-host";
      if (host === "localhost" || host.endsWith(".localdomain") || host === "ip6-localhost" || host === "ip6-loopback" || host.endsWith(".localhost")) {
        reason = "localhost-alias";
      } else if (host.includes(":")) {
        reason = "ipv6-internal";
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        reason = "ipv4-internal";
      }
      return { ok: false, reason, url: parsed, message: `internal host (${reason})` };
    }
    return { ok: true, reason: null, url: parsed, message: "" };
  }
  function classifyResponseUrl(response, allowedSchemes = ["https:"]) {
    const finalUrl = typeof response?.url === "string" ? response.url : "";
    if (!finalUrl) {
      return { ok: true, reason: null, url: null, message: "" };
    }
    return classifyFetchUrl(finalUrl, allowedSchemes);
  }

  // src/modules/sync-providers.ts
  async function getRawSettings() {
    return SettingsManager.get();
  }
  async function getSettings() {
    return SyncCredentialStore.resolveSettings(await getRawSettings());
  }
  var SYNC_SESSION_CREDENTIALS_KEY = "sv_sync_session_credentials";
  var LOCAL_FOLDER_SYNC_BINDING_ID = "sync_local_folder";
  var LOCAL_FOLDER_SYNC_FILE_NAME = "scriptvault-backup.json";
  var SYNC_CREDENTIAL_DEFAULTS = {
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    googleDriveToken: "",
    googleDriveRefreshToken: "",
    googleClientId: "",
    googleDriveConnected: false,
    googleDriveUser: null,
    dropboxToken: "",
    dropboxRefreshToken: "",
    dropboxClientId: "",
    dropboxUser: null,
    onedriveToken: "",
    onedriveRefreshToken: "",
    onedriveClientId: "",
    onedriveConnected: false,
    onedriveUser: null,
    s3Endpoint: "",
    s3Region: "",
    s3Bucket: "",
    s3AccessKeyId: "",
    s3SecretKey: "",
    s3ObjectKey: "",
    syncEncryptionPassphrase: ""
  };
  var SYNC_CREDENTIAL_KEYS = Object.keys(SYNC_CREDENTIAL_DEFAULTS);
  var _sessionCredentialMemoryFallback = {};
  function hasStorageSession() {
    return typeof chrome !== "undefined" && typeof chrome.storage?.session?.get === "function" && typeof chrome.storage.session.set === "function" && typeof chrome.storage.session.remove === "function";
  }
  function cloneSyncCredentialValue(value) {
    if (!value || typeof value !== "object") return value;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return Array.isArray(value) ? [...value] : { ...value };
    }
  }
  function pickSyncCredentialPatch(update) {
    const patch = {};
    for (const key of SYNC_CREDENTIAL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(update, key)) {
        patch[key] = cloneSyncCredentialValue(update[key]);
      }
    }
    return patch;
  }
  function hasAnySyncCredentialPatchValue(patch) {
    return Object.keys(patch).length > 0;
  }
  async function readSessionCredentials() {
    if (!hasStorageSession()) return { ..._sessionCredentialMemoryFallback };
    try {
      const data = await chrome.storage.session.get(SYNC_SESSION_CREDENTIALS_KEY);
      const value = data?.[SYNC_SESSION_CREDENTIALS_KEY];
      return value && typeof value === "object" ? { ...value } : {};
    } catch (_) {
      return { ..._sessionCredentialMemoryFallback };
    }
  }
  async function writeSessionCredentials(patch) {
    if (!hasAnySyncCredentialPatchValue(patch)) return;
    const current = await readSessionCredentials();
    const next = { ...current, ...patch };
    Object.assign(_sessionCredentialMemoryFallback, next);
    if (!hasStorageSession()) return;
    try {
      await chrome.storage.session.set({ [SYNC_SESSION_CREDENTIALS_KEY]: next });
    } catch (_) {
    }
  }
  async function clearSessionCredentials() {
    for (const key of Object.keys(_sessionCredentialMemoryFallback)) {
      delete _sessionCredentialMemoryFallback[key];
    }
    if (!hasStorageSession()) return;
    try {
      await chrome.storage.session.remove(SYNC_SESSION_CREDENTIALS_KEY);
    } catch (_) {
    }
  }
  function buildPersistentCredentialScrub() {
    const scrub = {};
    for (const key of SYNC_CREDENTIAL_KEYS) {
      scrub[key] = cloneSyncCredentialValue(SYNC_CREDENTIAL_DEFAULTS[key]);
    }
    return scrub;
  }
  var SyncCredentialStore = {
    sessionKey: SYNC_SESSION_CREDENTIALS_KEY,
    credentialKeys: SYNC_CREDENTIAL_KEYS,
    storageKind() {
      return hasStorageSession() ? "chrome.storage.session" : "memory-session";
    },
    async resolveSettings(settings) {
      if (settings.syncCredentialsSessionOnly !== true) return settings;
      const sessionCredentials = await readSessionCredentials();
      return {
        ...settings,
        ...sessionCredentials
      };
    },
    async persistSettingsUpdate(update, baseSettings) {
      const rawBase = baseSettings ?? await getRawSettings();
      const updateRecord = update;
      if (update.syncCredentialsSessionOnly === false) {
        const sessionCredentials = await readSessionCredentials();
        await clearSessionCredentials();
        return SettingsManager.set({
          ...sessionCredentials,
          ...update
        });
      }
      const sessionOnly = update.syncCredentialsSessionOnly === true || rawBase.syncCredentialsSessionOnly === true;
      if (!sessionOnly) {
        return SettingsManager.set(update);
      }
      const sessionPatch = pickSyncCredentialPatch(update);
      const persistentUpdate = { ...update };
      for (const key of SYNC_CREDENTIAL_KEYS) {
        if (Object.prototype.hasOwnProperty.call(updateRecord, key)) {
          persistentUpdate[key] = cloneSyncCredentialValue(SYNC_CREDENTIAL_DEFAULTS[key]);
        }
      }
      if (update.syncCredentialsSessionOnly === true) {
        Object.assign(persistentUpdate, buildPersistentCredentialScrub());
        const rawBaseRecord = rawBase;
        for (const key of SYNC_CREDENTIAL_KEYS) {
          if (!Object.prototype.hasOwnProperty.call(sessionPatch, key) && hasStoredSyncValue(rawBaseRecord[key])) {
            sessionPatch[key] = cloneSyncCredentialValue(rawBaseRecord[key]);
          }
        }
      }
      await writeSessionCredentials(sessionPatch);
      const persistent = await SettingsManager.set(persistentUpdate);
      return this.resolveSettings(persistent);
    },
    async clearSessionCredentials() {
      await clearSessionCredentials();
    }
  };
  function getRequiredWebDavBaseUrl(settings) {
    const baseUrl = settings.webdavUrl?.trim();
    if (!baseUrl) throw new Error("WebDAV URL is required");
    return baseUrl.replace(/\/$/, "");
  }
  function allowsInternalSyncEndpoints(settings) {
    return settings.allowInternalSyncEndpoints === true;
  }
  function resolveRemoteObjectName(objectName, defaultName) {
    const override = objectName;
    if (typeof override === "string" && override.trim()) {
      const cleaned = override.trim().replace(/[^A-Za-z0-9._-]+/g, "").replace(/^\.+/, "");
      if (cleaned) return cleaned;
    }
    return defaultName.replace(/^\/+/, "");
  }
  function syncEndpointMessage(prefix, result) {
    return `${prefix}: ${result.message || "rejected URL"}`;
  }
  function assertSyncEndpointAllowed(url, options) {
    if (options.allowInternalEndpoint === true) return;
    const preCheck = classifyFetchUrl(url, ["http:", "https:"]);
    if (!preCheck.ok) {
      throw new Error(syncEndpointMessage(`${options.label} URL rejected`, preCheck));
    }
  }
  function assertSyncResponseAllowed(response, options) {
    if (options.allowInternalEndpoint === true) return;
    const postCheck = classifyResponseUrl(response, ["http:", "https:"]);
    if (!postCheck.ok) {
      throw new Error(syncEndpointMessage(`${options.label} redirected to internal host`, postCheck));
    }
  }
  function getWebDavAuthHeader(settings) {
    const credentials = `${settings.webdavUsername}:${settings.webdavPassword}`;
    const bytes = new TextEncoder().encode(credentials);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return `Basic ${btoa(binary)}`;
  }
  function generateOAuthState() {
    return Array.from(
      crypto.getRandomValues(new Uint8Array(16)),
      (b) => b.toString(16).padStart(2, "0")
    ).join("");
  }
  function hasStoredSyncValue(value) {
    if (typeof value === "string") return value.trim().length > 0;
    return value != null && value !== false;
  }
  function syncStorageDisclosure(settings, config) {
    const settingsRecord = settings ?? {};
    const sessionOnly = settings?.syncCredentialsSessionOnly === true;
    const fields = config.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type ?? "metadata",
      present: hasStoredSyncValue(settingsRecord[field.key])
    }));
    const storage = sessionOnly ? SyncCredentialStore.storageKind() : "chrome.storage.local";
    const sessionFallback = sessionOnly && storage === "memory-session";
    return {
      storage,
      credentialStorageMode: sessionOnly ? "session" : "local",
      sessionFallback,
      reconnectRequired: sessionOnly,
      protection: sessionOnly ? sessionFallback ? "Current-runtime memory fallback; credentials are not written to persistent settings and must be re-entered after reload or browser restart." : "Session-scoped extension storage; credentials are cleared by browser restart and are not written to persistent settings." : "Extension-scoped browser storage; ScriptVault does not add a second encryption layer.",
      fields,
      hasStoredSecrets: fields.some((field) => field.present && field.type !== "metadata"),
      revokeAction: config.revokeAction,
      notes: sessionOnly ? `${config.notes ?? ""} Browser restart requires reconnecting or re-entering credentials.`.trim() : config.notes ?? ""
    };
  }
  function isExpectedMissingLocalFolderFileError(error) {
    const value = error;
    const name = String(value?.name || "").toLowerCase();
    const message = String(value?.message || "").toLowerCase();
    return name.includes("notfound") || name.includes("not_found") || message.includes("not found") || message.includes("no such file");
  }
  async function queryLocalFolderPermission(handle, mode) {
    if (typeof handle.queryPermission !== "function") return "unknown";
    try {
      const result = await handle.queryPermission({ mode });
      return result === "granted" || result === "prompt" || result === "denied" ? result : "unknown";
    } catch (_) {
      return "unknown";
    }
  }
  async function requestLocalFolderPermission(handle, mode) {
    if (typeof handle.requestPermission !== "function") {
      return queryLocalFolderPermission(handle, mode);
    }
    try {
      const result = await handle.requestPermission({ mode });
      return result === "granted" || result === "prompt" || result === "denied" ? result : "unknown";
    } catch (_) {
      return "unknown";
    }
  }
  function assertLocalWorkspaceBindingsAvailable() {
    if (typeof LocalWorkspaceBindings === "undefined" || typeof LocalWorkspaceBindings.getHandle !== "function") {
      throw new Error("Local folder sync is not available in this build");
    }
  }
  async function getLocalFolderSyncHandle(options = {}) {
    assertLocalWorkspaceBindingsAvailable();
    const mode = options.mode ?? "read";
    const handle = await LocalWorkspaceBindings.getHandle(LOCAL_FOLDER_SYNC_BINDING_ID);
    if (!handle) {
      throw new Error("Choose a local sync folder before syncing");
    }
    if (handle.kind && handle.kind !== "directory") {
      throw new Error("Stored local sync handle is not a directory");
    }
    if (typeof handle.getFileHandle !== "function") {
      throw new Error("Stored local sync folder handle is unavailable");
    }
    let permission = await queryLocalFolderPermission(handle, mode);
    if (permission !== "granted" && options.requestPermission) {
      permission = await requestLocalFolderPermission(handle, mode);
    }
    if (permission === "denied") {
      throw new Error("Local sync folder permission was denied");
    }
    if (permission !== "granted" && options.requestPermission) {
      throw new Error("Local sync folder permission was not granted");
    }
    return handle;
  }
  async function readLocalFolderSyncFile(handle, fileName) {
    try {
      const fileHandle = await handle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      if (isExpectedMissingLocalFolderFileError(error)) return null;
      throw error;
    }
  }
  async function writeLocalFolderSyncFile(handle, fileName, text) {
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(text);
    } finally {
      await writable.close();
    }
  }
  async function _oauthFetchWithTimeout(url, init, providerLabel, timeoutMs = 15e3) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    const { signal: _ignoredSignal, ...fetchInit } = init;
    const abortFromExternal = () => {
      try {
        controller.abort(externalSignal?.reason);
      } catch (_) {
        controller.abort();
      }
    };
    if (externalSignal?.aborted) abortFromExternal();
    else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...fetchInit, signal: controller.signal });
    } catch (e) {
      const name = e && typeof e === "object" && "name" in e ? String(e.name) : "";
      const message = e instanceof Error ? e.message : String(e);
      if (name === "AbortError" || /aborted|timed?\s*out/i.test(message)) {
        console.warn(`[CloudSync] ${providerLabel} token refresh timed out after ${timeoutMs}ms`);
        return null;
      }
      console.warn(`[CloudSync] ${providerLabel} token refresh network error:`, message);
      return null;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  }
  async function fetchWithTimeout(url, options = {}, timeoutMs = 3e4, guardOptions = { label: "Cloud sync endpoint" }) {
    assertSyncEndpointAllowed(url, guardOptions);
    const controller = new AbortController();
    const externalSignal = options.signal;
    const { signal: _ignoredSignal, ...fetchOptions } = options;
    const abortFromExternal = () => {
      try {
        controller.abort(externalSignal?.reason);
      } catch (_) {
        controller.abort();
      }
    };
    if (externalSignal?.aborted) abortFromExternal();
    else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      assertSyncResponseAllowed(response, guardOptions);
      return response;
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  }
  var SYNC_PAYLOAD_MAX_BYTES = 64 * 1024 * 1024;
  var SYNC_METADATA_MAX_BYTES = 4 * 1024 * 1024;
  var SYNC_ERROR_MAX_BYTES = 256 * 1024;
  async function readSyncTextBounded(response, maxBytes, label) {
    const declared = Number.parseInt(response.headers?.get?.("content-length") || "0", 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
    }
    if (!response.body?.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) {
        throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
      }
      return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let bytesRead = 0;
    try {
      for (; ; ) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        bytesRead += value.byteLength;
        if (bytesRead > maxBytes) {
          try {
            await reader.cancel();
          } catch {
          }
          throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
      chunks.push(decoder.decode());
      return chunks.join("");
    } finally {
      try {
        reader.releaseLock();
      } catch {
      }
    }
  }
  async function readSyncJsonBounded(response, maxBytes, label) {
    if (!response.body?.getReader && typeof response.json === "function") {
      return response.json();
    }
    const text = await readSyncTextBounded(response, maxBytes, label);
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label} returned invalid JSON`);
    }
  }
  var localfolder = {
    name: "Local Folder",
    icon: "Folder",
    requiresOAuth: false,
    fileName: LOCAL_FOLDER_SYNC_FILE_NAME,
    supportsManualSync: true,
    supportsDryRun: true,
    getStorageDisclosure() {
      return {
        storage: "chrome.storage.local",
        credentialStorageMode: "local",
        sessionFallback: false,
        reconnectRequired: false,
        protection: "A browser File System Access directory handle is stored in extension IndexedDB; sync data stays in the folder you choose.",
        fields: [
          {
            key: LOCAL_FOLDER_SYNC_BINDING_ID,
            label: "Selected local sync folder handle",
            type: "metadata",
            present: true
          }
        ],
        hasStoredSecrets: false,
        revokeAction: "Forget the local sync folder handle stored in extension IndexedDB.",
        notes: `Reads and writes ${LOCAL_FOLDER_SYNC_FILE_NAME} in the selected folder.`
      };
    },
    async upload(data, _settings, opts = {}) {
      const handle = await getLocalFolderSyncHandle({
        requestPermission: true,
        mode: "readwrite"
      });
      const fileName = resolveRemoteObjectName(opts.objectName, this.fileName);
      await writeLocalFolderSyncFile(handle, fileName, JSON.stringify(data, null, 2));
      return { success: true, timestamp: Date.now() };
    },
    async download(_settings, opts = {}) {
      const handle = await getLocalFolderSyncHandle({ mode: "read" });
      const fileName = resolveRemoteObjectName(opts.objectName, this.fileName);
      const text = await readLocalFolderSyncFile(handle, fileName);
      if (text == null || !text.trim()) return null;
      return JSON.parse(text);
    },
    async test() {
      try {
        const handle = await getLocalFolderSyncHandle({ mode: "read" });
        const permission = await queryLocalFolderPermission(handle, "readwrite");
        if (permission === "denied") {
          return { success: false, error: "Local sync folder permission was denied" };
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    async getStatus() {
      try {
        assertLocalWorkspaceBindingsAvailable();
        const binding = await LocalWorkspaceBindings.get(LOCAL_FOLDER_SYNC_BINDING_ID);
        if (!binding) {
          return {
            connected: false,
            status: "not_configured",
            error: "Choose a local sync folder before syncing"
          };
        }
        const handle = await LocalWorkspaceBindings.getHandle(LOCAL_FOLDER_SYNC_BINDING_ID);
        if (!handle) {
          return {
            connected: false,
            status: "handle_missing",
            error: "Local sync folder handle is unavailable"
          };
        }
        const permission = await queryLocalFolderPermission(handle, "readwrite");
        return {
          connected: permission === "granted",
          status: permission === "granted" ? "ok" : permission,
          error: permission === "denied" ? "Local sync folder permission was denied" : null,
          user: { email: "", name: binding.displayName || handle.name || "Local sync folder" }
        };
      } catch (e) {
        return {
          connected: false,
          status: "error",
          error: e instanceof Error ? e.message : String(e)
        };
      }
    },
    async disconnect() {
      assertLocalWorkspaceBindingsAvailable();
      await LocalWorkspaceBindings.delete(LOCAL_FOLDER_SYNC_BINDING_ID);
      return { success: true };
    }
  };
  var webdav = {
    name: "WebDAV",
    icon: "\u2601\uFE0F",
    requiresAuth: true,
    supportsManualSync: true,
    supportsDryRun: true,
    _lastSyncEtag: void 0,
    _lastSyncEtagKey: "",
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "webdavUrl", label: "WebDAV endpoint URL", type: "metadata" },
          { key: "webdavUsername", label: "WebDAV username", type: "credential" },
          { key: "webdavPassword", label: "WebDAV password", type: "credential" }
        ],
        revokeAction: "Clear the saved WebDAV endpoint, username, and password from local extension storage.",
        notes: "WebDAV Basic credentials are sent only to the configured server during sync."
      });
    },
    async upload(data, settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const objectName = resolveRemoteObjectName(opts.objectName, "scriptvault-backup.json");
      const url = `${getRequiredWebDavBaseUrl(effectiveSettings)}/${objectName}`;
      const auth = getWebDavAuthHeader(effectiveSettings);
      const guardOptions = {
        label: "WebDAV sync endpoint",
        allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings)
      };
      const headers = {
        "Authorization": auth,
        "Content-Type": "application/json"
      };
      const lastEtag = this._lastSyncEtagKey === objectName ? this._lastSyncEtag : void 0;
      if (typeof lastEtag === "string") headers["If-Match"] = lastEtag;
      else if (lastEtag === null) headers["If-None-Match"] = "*";
      const response = await fetchWithTimeout(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
        signal: opts.signal
      }, 6e4, guardOptions);
      if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
      this._lastSyncEtag = response.headers?.get("ETag") || this._lastSyncEtag;
      this._lastSyncEtagKey = objectName;
      return { success: true, timestamp: Date.now() };
    },
    async download(settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const objectName = resolveRemoteObjectName(opts.objectName, "scriptvault-backup.json");
      const url = `${getRequiredWebDavBaseUrl(effectiveSettings)}/${objectName}`;
      const auth = getWebDavAuthHeader(effectiveSettings);
      const guardOptions = {
        label: "WebDAV sync endpoint",
        allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings)
      };
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: { "Authorization": auth },
        signal: opts.signal
      }, 6e4, guardOptions);
      if (response.status === 404) {
        this._lastSyncEtag = null;
        this._lastSyncEtagKey = objectName;
        return null;
      }
      if (!response.ok) throw new Error(`WebDAV download failed: HTTP ${response.status}`);
      this._lastSyncEtag = response.headers?.get("ETag") || void 0;
      this._lastSyncEtagKey = objectName;
      return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, "WebDAV sync payload");
    },
    async test(settings) {
      try {
        const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
        const url = getRequiredWebDavBaseUrl(effectiveSettings);
        const auth = getWebDavAuthHeader(effectiveSettings);
        const guardOptions = {
          label: "WebDAV sync endpoint",
          allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings)
        };
        const response = await fetchWithTimeout(url, {
          method: "PROPFIND",
          headers: { "Authorization": auth, "Depth": "0" }
        }, 15e3, guardOptions);
        return { success: response.ok || response.status === 207 };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      if (!effectiveSettings.webdavUrl) {
        return {
          connected: false,
          status: "missing_config",
          error: "WebDAV URL is not configured"
        };
      }
      const result = await this.test(effectiveSettings);
      let endpointHost = "";
      try {
        endpointHost = new URL(effectiveSettings.webdavUrl).host;
      } catch {
      }
      return {
        connected: result.success === true,
        status: result.success === true ? "ok" : "error",
        error: result.error ?? null,
        user: {
          email: "",
          name: effectiveSettings.webdavUsername || endpointHost || "WebDAV"
        },
        endpointHost
      };
    },
    async disconnect() {
      await SyncCredentialStore.clearSessionCredentials();
      await SettingsManager.set({
        webdavUrl: "",
        webdavUsername: "",
        webdavPassword: ""
      });
      return { success: true };
    }
  };
  var googledrive = {
    name: "Google Drive",
    icon: "\u{1F4C1}",
    requiresOAuth: true,
    fileName: "scriptvault-backup.json",
    supportsManualSync: true,
    supportsDryRun: true,
    // Google OAuth client ID (public, installed-app type)
    // Users can override via settings.googleClientId
    clientId: "287129963438-mcc1mod1m5jm8vjr3icb7ensdtcfq44l.apps.googleusercontent.com",
    _lastSyncEtag: void 0,
    _lastSyncEtagKey: "",
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "googleDriveToken", label: "Google Drive access token", type: "token" },
          { key: "googleDriveRefreshToken", label: "Google Drive refresh token", type: "token" },
          { key: "googleClientId", label: "Optional Google OAuth client ID override", type: "metadata" },
          { key: "googleDriveUser", label: "Connected Google account label", type: "metadata" }
        ],
        revokeAction: "Ask Google to revoke the current access token when available, then clear Google tokens and account metadata.",
        notes: "Tokens are scoped to Drive file access and Google profile/email lookup for the configured backup file."
      });
    },
    async getToken() {
      const settings = await getSettings();
      return settings.googleDriveToken || null;
    },
    async refreshToken(settings, opts = {}) {
      const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
      const refreshTok = currentSettings.googleDriveRefreshToken;
      if (!refreshTok) return null;
      const clientId = currentSettings.googleClientId || this.clientId;
      const resp = await _oauthFetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: opts.signal,
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: refreshTok
        })
      }, "Google");
      if (!resp) return null;
      if (!resp.ok) {
        console.warn("[CloudSync] Google token refresh failed:", resp.status);
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
        await SyncCredentialStore.persistSettingsUpdate({
          googleDriveToken: data.access_token,
          googleDriveConnected: true
        }, currentSettings);
        if (data.refresh_token) {
          await SyncCredentialStore.persistSettingsUpdate({ googleDriveRefreshToken: data.refresh_token }, currentSettings);
        }
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings, opts = {}) {
      const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
      let token = currentSettings.googleDriveToken || null;
      if (!token) {
        return await this.refreshToken(currentSettings, opts);
      }
      try {
        const test = await _oauthFetchWithTimeout("https://www.googleapis.com/drive/v3/about?fields=user", {
          headers: { "Authorization": `Bearer ${token}` },
          signal: opts.signal
        }, "Google Drive", 1e4);
        if (!test) return token;
        if (test.ok) return token;
        if (test.status === 401 || test.status === 403) {
          return await this.refreshToken(currentSettings, opts);
        }
        return token;
      } catch (_e) {
        return token;
      }
    },
    async connect() {
      try {
        const settings = await getSettings();
        const clientId = settings.googleClientId || this.clientId;
        const redirectUri = chrome.identity.getRedirectURL();
        const scopes = [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile"
        ].join(" ");
        const codeVerifier = Array.from(
          crypto.getRandomValues(new Uint8Array(32)),
          (b) => b.toString(16).padStart(2, "0")
        ).join("");
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const state = generateOAuthState();
        const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: scopes,
          access_type: "offline",
          prompt: "consent",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state
        }).toString();
        const responseUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        });
        if (!responseUrl) throw new Error("No response from auth flow");
        const url = new URL(responseUrl);
        const returnedState = url.searchParams.get("state");
        if (returnedState !== state) {
          throw new Error("OAuth state mismatch - possible CSRF attack");
        }
        const code = url.searchParams.get("code");
        if (!code) throw new Error("No authorization code received");
        const tokenResp = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri
          })
        }, 15e3);
        if (!tokenResp.ok) {
          const err = await tokenResp.text();
          throw new Error("Token exchange failed: " + err);
        }
        const tokens = await tokenResp.json();
        const userResp = await fetchWithTimeout("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { "Authorization": `Bearer ${tokens.access_token}` }
        }, 1e4);
        const user = userResp.ok ? await userResp.json() : {};
        await SyncCredentialStore.persistSettingsUpdate({
          googleDriveToken: tokens.access_token,
          googleDriveRefreshToken: tokens.refresh_token || settings.googleDriveRefreshToken || "",
          googleDriveConnected: true,
          googleDriveUser: { email: user.email ?? "", name: user.name ?? "" }
        }, settings);
        return {
          success: true,
          user: { email: user.email ?? "", name: user.name ?? "", picture: user.picture }
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async disconnect() {
      try {
        const token = await this.getToken();
        if (token) {
          fetchWithTimeout(`https://accounts.google.com/o/oauth2/revoke`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `token=${encodeURIComponent(token)}`
          }, 1e4).catch(() => {
          });
        }
        await SyncCredentialStore.clearSessionCredentials();
        await SettingsManager.set({
          googleDriveToken: "",
          googleDriveRefreshToken: "",
          googleDriveConnected: false,
          googleDriveUser: null
        });
      } catch (e) {
        console.warn("[CloudSync] Google disconnect error:", e);
      }
      return { success: true };
    },
    async findFile(token, objectName, opts = {}) {
      const safeName = (objectName || this.fileName).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const query = encodeURIComponent(`name='${safeName}' and trashed=false`);
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
        { headers: { "Authorization": `Bearer ${token}` }, signal: opts.signal },
        15e3
      );
      if (!response.ok) throw new Error(`Failed to search files: ${response.status}`);
      const data = await readSyncJsonBounded(
        response,
        SYNC_METADATA_MAX_BYTES,
        "Google Drive file list"
      );
      return data.files?.[0] ?? null;
    },
    async upload(data, settings, opts = {}) {
      const token = await this.getValidToken(settings, opts);
      if (!token) throw new Error("Not authenticated with Google Drive");
      const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
      const existingFile = await this.findFile(token, objectName, opts);
      const metadata = {
        name: objectName,
        mimeType: "application/json"
      };
      const boundary = "-------ScriptVault" + crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
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
      const safeFileId = existingFile ? String(existingFile.id).replace(/[^a-zA-Z0-9_-]/g, "") : "";
      const url = existingFile ? `https://www.googleapis.com/upload/drive/v3/files/${safeFileId}?uploadType=multipart` : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      };
      const lastEtag = this._lastSyncEtagKey === objectName ? this._lastSyncEtag : void 0;
      if (existingFile && typeof lastEtag === "string") headers["If-Match"] = lastEtag;
      const response = await fetchWithTimeout(url, {
        method: existingFile ? "PATCH" : "POST",
        headers,
        body,
        signal: opts.signal
      }, 6e4);
      if (!response.ok) {
        const error = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, "Google Drive upload error");
        throw new Error(`Upload failed: ${error}`);
      }
      this._lastSyncEtag = response.headers?.get("ETag") || this._lastSyncEtag;
      this._lastSyncEtagKey = objectName;
      return { success: true, timestamp: Date.now() };
    },
    async download(settings, opts = {}) {
      const token = await this.getValidToken(settings, opts);
      if (!token) throw new Error("Not authenticated with Google Drive");
      const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
      const file = await this.findFile(token, objectName, opts);
      if (!file) {
        this._lastSyncEtag = null;
        this._lastSyncEtagKey = objectName;
        return null;
      }
      const safeFileId = String(file.id).replace(/[^a-zA-Z0-9_-]/g, "");
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${safeFileId}?alt=media`,
        { headers: { "Authorization": `Bearer ${token}` }, signal: opts.signal },
        6e4
      );
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      this._lastSyncEtag = response.headers?.get("ETag") || void 0;
      this._lastSyncEtagKey = objectName;
      return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, "Google Drive sync payload");
    },
    async test(settings) {
      try {
        const token = await this.getValidToken(settings);
        if (!token) return { success: false, error: "Not authenticated" };
        const response = await fetchWithTimeout(
          "https://www.googleapis.com/drive/v3/about?fields=user",
          { headers: { "Authorization": `Bearer ${token}` } },
          15e3
        );
        return { success: response.ok };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      try {
        const s = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
        if (!s.googleDriveToken && !s.googleDriveRefreshToken) {
          return { connected: false };
        }
        const token = await this.getValidToken(s);
        if (!token) return { connected: false };
        const response = await fetchWithTimeout(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { "Authorization": `Bearer ${token}` } },
          1e4
        );
        if (!response.ok) return { connected: false };
        const user = await readSyncJsonBounded(
          response,
          SYNC_METADATA_MAX_BYTES,
          "Google Drive user response"
        );
        return { connected: true, user: { email: user.email ?? "", name: user.name ?? "" } };
      } catch (_e) {
        return { connected: false };
      }
    }
  };
  var dropbox = {
    name: "Dropbox",
    icon: "\u{1F4E6}",
    requiresOAuth: true,
    fileName: "/scriptvault-backup.json",
    supportsManualSync: true,
    supportsDryRun: true,
    _lastSyncRev: void 0,
    _lastSyncRevPath: "",
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "dropboxToken", label: "Dropbox access token", type: "token" },
          { key: "dropboxRefreshToken", label: "Dropbox refresh token", type: "token" },
          { key: "dropboxClientId", label: "Dropbox app key", type: "metadata" },
          { key: "dropboxUser", label: "Connected Dropbox account label", type: "metadata" }
        ],
        revokeAction: "Call Dropbox token revoke when an access token exists, then clear Dropbox tokens and account metadata.",
        notes: "Tokens are scoped by the Dropbox app key the user configured for ScriptVault backups."
      });
    },
    async connect(settings) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      if (!effectiveSettings.dropboxClientId) {
        throw new Error(
          "Dropbox App Key is required. Create one at https://www.dropbox.com/developers/apps"
        );
      }
      const clientId = effectiveSettings.dropboxClientId;
      const redirectUri = chrome.identity.getRedirectURL("dropbox");
      const codeVerifier = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, "0")
      ).join("");
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const state = Array.from(
        crypto.getRandomValues(new Uint8Array(16)),
        (b) => b.toString(16).padStart(2, "0")
      ).join("");
      const authUrl = "https://www.dropbox.com/oauth2/authorize?" + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        token_access_type: "offline",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state
      }).toString();
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      if (!responseUrl) throw new Error("No response from auth flow");
      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get("state");
      if (returnedState !== state) {
        throw new Error("OAuth state mismatch - possible CSRF attack");
      }
      const code = url.searchParams.get("code");
      if (!code) throw new Error("No authorization code received");
      const tokenResp = await fetchWithTimeout("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri
        })
      }, 15e3);
      if (!tokenResp.ok) {
        const err = await tokenResp.text();
        throw new Error("Token exchange failed: " + err);
      }
      const tokens = await tokenResp.json();
      return {
        success: true,
        token: tokens.access_token,
        refreshToken: tokens.refresh_token || ""
      };
    },
    async refreshToken(settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const refreshTok = effectiveSettings.dropboxRefreshToken;
      const clientId = effectiveSettings.dropboxClientId;
      if (!refreshTok || !clientId) return null;
      const resp = await _oauthFetchWithTimeout("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: opts.signal,
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: refreshTok
        })
      }, "Dropbox");
      if (!resp) return null;
      if (!resp.ok) {
        console.warn("[CloudSync] Dropbox token refresh failed:", resp.status);
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
        await SyncCredentialStore.persistSettingsUpdate({ dropboxToken: data.access_token }, effectiveSettings);
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      if (effectiveSettings.dropboxToken) {
        try {
          const test = await _oauthFetchWithTimeout(
            "https://api.dropboxapi.com/2/users/get_current_account",
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${effectiveSettings.dropboxToken}` },
              signal: opts.signal
            },
            "Dropbox",
            1e4
          );
          if (!test) return effectiveSettings.dropboxToken;
          if (test.ok) return effectiveSettings.dropboxToken;
          if (test.status !== 401 && test.status !== 403) return effectiveSettings.dropboxToken;
        } catch (_e) {
          return effectiveSettings.dropboxToken;
        }
      }
      return await this.refreshToken(effectiveSettings, opts);
    },
    async disconnect(settings) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      if (effectiveSettings.dropboxToken) {
        try {
          await fetchWithTimeout("https://api.dropboxapi.com/2/auth/token/revoke", {
            method: "POST",
            headers: { "Authorization": `Bearer ${effectiveSettings.dropboxToken}` }
          }, 1e4);
        } catch (e) {
          console.warn("[CloudSync] Dropbox revoke error:", e);
        }
      }
      await SyncCredentialStore.clearSessionCredentials();
      await SettingsManager.set({
        dropboxToken: "",
        dropboxRefreshToken: "",
        dropboxUser: null
      });
      return { success: true };
    },
    async upload(data, settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const token = await this.getValidToken(effectiveSettings, opts);
      if (!token) throw new Error("Not authenticated with Dropbox");
      const body = JSON.stringify(data);
      if (body.length > 150 * 1024 * 1024) throw new Error("Sync data exceeds Dropbox 150 MB upload limit");
      const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
      const dropboxPath = "/" + objectName;
      const lastRev = this._lastSyncRevPath === dropboxPath ? this._lastSyncRev : void 0;
      const mode = typeof lastRev === "string" ? { ".tag": "update", update: lastRev } : lastRev === null ? "add" : "overwrite";
      const response = await fetchWithTimeout("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({
            path: dropboxPath,
            mode,
            autorename: false,
            mute: true
          }),
          "Content-Type": "application/octet-stream"
        },
        body,
        signal: opts.signal
      }, 6e4);
      if (response.status === 401) throw new Error("Dropbox token expired. Please reconnect.");
      if (!response.ok) {
        const error = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, "Dropbox upload error");
        throw new Error(`Upload failed: ${error}`);
      }
      const metadata = await response.clone().json().catch(() => null);
      if (metadata?.rev) this._lastSyncRev = metadata.rev;
      this._lastSyncRevPath = dropboxPath;
      return { success: true, timestamp: Date.now() };
    },
    async download(settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const token = await this.getValidToken(effectiveSettings, opts);
      if (!token) throw new Error("Not authenticated with Dropbox");
      const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
      const dropboxPath = "/" + objectName;
      const response = await fetchWithTimeout("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath })
        },
        signal: opts.signal
      }, 6e4);
      if (response.status === 409) {
        this._lastSyncRev = null;
        this._lastSyncRevPath = dropboxPath;
        return null;
      }
      if (response.status === 401) throw new Error("Dropbox token expired. Please reconnect.");
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const apiResult = response.headers.get("Dropbox-API-Result");
      if (apiResult) {
        try {
          const metadata = JSON.parse(apiResult);
          this._lastSyncRev = metadata.rev || void 0;
          this._lastSyncRevPath = dropboxPath;
        } catch (_) {
          this._lastSyncRev = void 0;
          this._lastSyncRevPath = "";
        }
      } else {
        this._lastSyncRev = void 0;
        this._lastSyncRevPath = "";
      }
      return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, "Dropbox sync payload");
    },
    async test(settings) {
      try {
        const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
        const token = await this.getValidToken(effectiveSettings);
        if (!token) return { success: false, error: "Not authenticated" };
        const response = await fetchWithTimeout(
          "https://api.dropboxapi.com/2/users/get_current_account",
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          },
          15e3
        );
        if (response.status === 401) return { success: false, error: "Token expired" };
        return { success: response.ok };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      const s = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
      if (!s.dropboxToken && !s.dropboxRefreshToken) return { connected: false };
      try {
        const token = await this.getValidToken(s);
        if (!token) return { connected: false };
        const response = await fetchWithTimeout(
          "https://api.dropboxapi.com/2/users/get_current_account",
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          },
          15e3
        );
        if (!response.ok) return { connected: false };
        const user = await readSyncJsonBounded(
          response,
          SYNC_METADATA_MAX_BYTES,
          "Dropbox account response"
        );
        return {
          connected: true,
          user: {
            email: user.email ?? "",
            name: user.name?.display_name || user.display_name || ""
          }
        };
      } catch (_e) {
        return { connected: false };
      }
    }
  };
  var onedrive = {
    name: "OneDrive",
    icon: "\u{1F4C1}",
    requiresOAuth: true,
    fileName: "scriptvault-backup.json",
    supportsManualSync: true,
    supportsDryRun: true,
    _lastSyncEtag: void 0,
    _lastSyncEtagKey: "",
    // Microsoft OAuth - users must provide their own client ID from Azure AD
    // Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "onedriveToken", label: "OneDrive access token", type: "token" },
          { key: "onedriveRefreshToken", label: "OneDrive refresh token", type: "token" },
          { key: "onedriveClientId", label: "OneDrive app client ID", type: "metadata" },
          { key: "onedriveUser", label: "Connected Microsoft account label", type: "metadata" }
        ],
        revokeAction: "Clear OneDrive tokens and account metadata from local extension storage.",
        notes: "Microsoft Graph tokens use app-folder file access and profile lookup scopes."
      });
    },
    async connect(settings) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const clientId = effectiveSettings.onedriveClientId;
      if (!clientId) {
        throw new Error(
          "OneDrive Client ID required. Create one at https://portal.azure.com \u2192 App registrations"
        );
      }
      const redirectUri = chrome.identity.getRedirectURL("onedrive");
      const scopes = "Files.ReadWrite.AppFolder User.Read offline_access";
      const codeVerifier = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, "0")
      ).join("");
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const state = generateOAuthState();
      const authUrl = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?" + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state
      }).toString();
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      if (!responseUrl) throw new Error("No response from auth flow");
      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get("state");
      if (returnedState !== state) {
        throw new Error("OAuth state mismatch - possible CSRF attack");
      }
      const code = url.searchParams.get("code");
      if (!code) throw new Error("No authorization code received");
      const tokenResp = await fetchWithTimeout(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            scope: scopes
          })
        },
        15e3
      );
      if (!tokenResp.ok) throw new Error("Token exchange failed: " + await tokenResp.text());
      const tokens = await tokenResp.json();
      const userResp = await fetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
        headers: { "Authorization": `Bearer ${tokens.access_token}` }
      }, 1e4);
      const user = userResp.ok ? await userResp.json() : {};
      await SyncCredentialStore.persistSettingsUpdate({
        onedriveToken: tokens.access_token,
        onedriveRefreshToken: tokens.refresh_token || "",
        onedriveConnected: true,
        onedriveUser: {
          email: user.mail || user.userPrincipalName || "",
          name: user.displayName || ""
        }
      }, effectiveSettings);
      return {
        success: true,
        user: {
          email: user.mail || user.userPrincipalName || "",
          name: user.displayName || ""
        }
      };
    },
    async refreshToken(settings, opts = {}) {
      const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
      const refreshTok = currentSettings.onedriveRefreshToken;
      const clientId = currentSettings.onedriveClientId;
      if (!refreshTok || !clientId) return null;
      const resp = await _oauthFetchWithTimeout(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: opts.signal,
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: refreshTok,
            scope: "Files.ReadWrite.AppFolder User.Read offline_access"
          })
        },
        "OneDrive",
        15e3
      );
      if (!resp) return null;
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.access_token) {
        await SyncCredentialStore.persistSettingsUpdate({
          onedriveToken: data.access_token,
          onedriveRefreshToken: data.refresh_token || refreshTok,
          onedriveConnected: true
        }, currentSettings);
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings, opts = {}) {
      const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
      const token = currentSettings.onedriveToken;
      if (!token) {
        return await this.refreshToken(currentSettings, opts);
      }
      try {
        const test = await _oauthFetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` },
          signal: opts.signal
        }, "OneDrive", 1e4);
        if (!test) return token;
        if (test.ok) return token;
        if (test.status === 401 || test.status === 403) {
          return await this.refreshToken(currentSettings, opts);
        }
        return token;
      } catch (_e) {
        return token;
      }
    },
    async disconnect() {
      await SyncCredentialStore.clearSessionCredentials();
      await SettingsManager.set({
        onedriveToken: "",
        onedriveRefreshToken: "",
        onedriveConnected: false,
        onedriveUser: null
      });
      return { success: true };
    },
    async upload(data, settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
      const token = await this.getValidToken(effectiveSettings, opts);
      if (!token) throw new Error("Not authenticated with OneDrive");
      if (!data || typeof data !== "object") throw new Error("Invalid backup data");
      const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const lastEtag = this._lastSyncEtagKey === objectName ? this._lastSyncEtag : void 0;
      if (typeof lastEtag === "string") headers["If-Match"] = lastEtag;
      else if (lastEtag === null) headers["If-None-Match"] = "*";
      const response = await fetchWithTimeout(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${objectName}:/content`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
          signal: opts.signal
        },
        6e4
      );
      if (!response.ok) {
        throw new Error("Upload failed: " + await readSyncTextBounded(
          response,
          SYNC_ERROR_MAX_BYTES,
          "OneDrive upload error"
        ));
      }
      this._lastSyncEtag = response.headers.get("ETag") || response.headers.get("eTag") || this._lastSyncEtag;
      this._lastSyncEtagKey = objectName;
      return { success: true, timestamp: Date.now() };
    },
    async download(settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
      const token = await this.getValidToken(effectiveSettings, opts);
      if (!token) throw new Error("Not authenticated with OneDrive");
      const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
      const response = await fetchWithTimeout(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${objectName}:/content`,
        { headers: { "Authorization": `Bearer ${token}` }, signal: opts.signal },
        6e4
      );
      if (response.status === 404) {
        this._lastSyncEtag = null;
        this._lastSyncEtagKey = objectName;
        return null;
      }
      if (!response.ok) throw new Error("Download failed: " + response.status);
      this._lastSyncEtag = response.headers.get("ETag") || response.headers.get("eTag") || void 0;
      this._lastSyncEtagKey = objectName;
      return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, "OneDrive sync payload");
    },
    async test(settings) {
      try {
        const effectiveSettings = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
        const token = await this.getValidToken(effectiveSettings);
        if (!token) return { success: false, error: "Not authenticated" };
        const response = await fetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        }, 15e3);
        return { success: response.ok };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      try {
        const s = await SyncCredentialStore.resolveSettings(settings ?? await getRawSettings());
        if (!s.onedriveToken && !s.onedriveRefreshToken) return { connected: false };
        const token = await this.getValidToken(s);
        if (!token) return { connected: false };
        const response = await fetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        }, 15e3);
        if (!response.ok) return { connected: false };
        const user = await readSyncJsonBounded(
          response,
          SYNC_METADATA_MAX_BYTES,
          "OneDrive user response"
        );
        return {
          connected: true,
          user: {
            email: user.mail || user.userPrincipalName || "",
            name: user.displayName || ""
          }
        };
      } catch (_e) {
        return { connected: false };
      }
    }
  };
  var s3 = {
    name: "S3-compatible",
    icon: "\u{1FAA3}",
    requiresAuth: true,
    supportsManualSync: true,
    supportsDryRun: true,
    _lastSyncEtag: void 0,
    _lastSyncEtagKey: "",
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "s3Endpoint", label: "S3 endpoint URL", type: "metadata" },
          { key: "s3Region", label: "S3 region", type: "metadata" },
          { key: "s3Bucket", label: "S3 bucket name", type: "metadata" },
          { key: "s3AccessKeyId", label: "S3 access key ID", type: "credential" },
          { key: "s3SecretKey", label: "S3 secret access key", type: "credential" },
          { key: "s3ObjectKey", label: "Optional object key override", type: "metadata" }
        ],
        revokeAction: "Clear the saved S3 endpoint, region, bucket, access key, and secret from local extension storage.",
        notes: "Credentials are HMAC-SHA256 signed per AWS SigV4 and sent only to the configured endpoint during sync. No third party sees the secret."
      });
    },
    validate(settings = {}) {
      const errors = [];
      const endpoint = (settings.s3Endpoint || "").trim();
      if (!endpoint) {
        errors.push({ field: "s3Endpoint", error: "Endpoint URL is required." });
      } else {
        try {
          const url = new URL(endpoint);
          if (url.protocol !== "https:" && url.protocol !== "http:") {
            errors.push({ field: "s3Endpoint", error: "Endpoint must be http(s)://." });
          }
          if (url.pathname && url.pathname !== "/" && url.pathname !== "") {
            errors.push({
              field: "s3Endpoint",
              error: "Endpoint URL must not include a path; bucket goes in its own field."
            });
          }
        } catch (_) {
          errors.push({ field: "s3Endpoint", error: "Endpoint URL is malformed." });
        }
      }
      const region = (settings.s3Region || "").trim();
      if (!region) errors.push({ field: "s3Region", error: 'Region is required (use "auto" for Cloudflare R2).' });
      const bucket = (settings.s3Bucket || "").trim();
      if (!bucket) errors.push({ field: "s3Bucket", error: "Bucket name is required." });
      else if (!/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/i.test(bucket)) {
        errors.push({
          field: "s3Bucket",
          error: "Bucket name must be 3-63 chars, alphanumeric/dash/dot only."
        });
      }
      if (!settings.s3AccessKeyId) errors.push({ field: "s3AccessKeyId", error: "Access key ID is required." });
      if (!settings.s3SecretKey) errors.push({ field: "s3SecretKey", error: "Secret access key is required." });
      return { valid: errors.length === 0, errors };
    },
    _buildObjectUrl(settings, objectKey) {
      const endpoint = new URL(settings.s3Endpoint);
      const isAws = /(^|\.)amazonaws\.com$/i.test(endpoint.hostname);
      const usePathStyle = settings.s3PathStyle === true || settings.s3PathStyle === void 0 && !isAws;
      const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
      if (usePathStyle) {
        return `${endpoint.origin}/${encodeURIComponent(settings.s3Bucket)}/${encodedKey}`;
      }
      const host = `${settings.s3Bucket}.${endpoint.hostname}`;
      const port = endpoint.port ? `:${endpoint.port}` : "";
      return `${endpoint.protocol}//${host}${port}/${encodedKey}`;
    },
    _objectKey(settings, objectName) {
      if (typeof objectName === "string" && objectName.trim()) {
        return resolveRemoteObjectName(objectName, "scriptvault-cloud-backup.json");
      }
      return (settings.s3ObjectKey || "scriptvault-backup.json").replace(/^\/+/, "");
    },
    async _signRequest({
      method,
      url,
      region,
      accessKeyId,
      secretKey,
      body,
      contentType,
      extraHeaders
    }) {
      const parsedUrl = new URL(url);
      const now = /* @__PURE__ */ new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dateStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
      const amzDate = `${dateStamp}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
      const service = "s3";
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const bodyBytes = body == null ? new Uint8Array(0) : typeof body === "string" ? new TextEncoder().encode(body) : body;
      const payloadHash = await this._sha256Hex(bodyBytes);
      const headers = {
        host: parsedUrl.host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate
      };
      if (contentType) headers["content-type"] = contentType;
      for (const [key, value] of Object.entries(extraHeaders || {})) {
        headers[key.toLowerCase()] = value;
      }
      const sortedHeaderNames = Object.keys(headers).sort();
      const canonicalHeaders = sortedHeaderNames.map((key) => `${key}:${headers[key]}
  `).join("");
      const signedHeaders = sortedHeaderNames.join(";");
      const canonicalQuery = this._canonicalQuery(parsedUrl);
      const canonicalRequest = [
        method,
        parsedUrl.pathname || "/",
        canonicalQuery,
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join("\n");
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        await this._sha256Hex(canonicalRequest)
      ].join("\n");
      const kDate = await this._hmac(new TextEncoder().encode("AWS4" + secretKey), dateStamp);
      const kRegion = await this._hmac(kDate, region);
      const kService = await this._hmac(kRegion, service);
      const kSigning = await this._hmac(kService, "aws4_request");
      const signature = this._toHex(await this._hmac(kSigning, stringToSign));
      return {
        headers: {
          ...Object.fromEntries(
            sortedHeaderNames.filter((key) => key !== "host").map((key) => [key, headers[key]])
          ),
          Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
        }
      };
    },
    _canonicalQuery(url) {
      const parsedUrl = typeof url === "string" ? new URL(url) : url;
      const encode = (value) => encodeURIComponent(value).replace(
        /[!'()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      );
      return Array.from(parsedUrl.searchParams.entries(), ([key, value]) => [encode(key), encode(value)]).sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("&");
    },
    async _sha256Hex(input) {
      const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
      const buffer = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ));
      return this._toHex(new Uint8Array(buffer));
    },
    async _hmac(keyBytes, message) {
      const key = await crypto.subtle.importKey(
        "raw",
        keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength
        ),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
      return new Uint8Array(signature);
    },
    _toHex(bytes) {
      let value = "";
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i] ?? 0;
        const hex = byte.toString(16);
        value += hex.length === 1 ? "0" + hex : hex;
      }
      return value;
    },
    async upload(data, settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const check = this.validate(effectiveSettings);
      if (!check.valid) {
        throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(" ")}`);
      }
      const objectKey = this._objectKey(effectiveSettings, opts.objectName);
      const url = this._buildObjectUrl(effectiveSettings, objectKey);
      const guardOptions = {
        label: "S3 sync endpoint",
        allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings)
      };
      assertSyncEndpointAllowed(url, guardOptions);
      const body = JSON.stringify(data);
      const conditionalHeaders = {};
      const lastEtag = this._lastSyncEtagKey === objectKey ? this._lastSyncEtag : void 0;
      if (typeof lastEtag === "string") conditionalHeaders["if-match"] = lastEtag;
      else if (lastEtag === null) conditionalHeaders["if-none-match"] = "*";
      const signed = await this._signRequest({
        method: "PUT",
        url,
        region: effectiveSettings.s3Region,
        accessKeyId: effectiveSettings.s3AccessKeyId,
        secretKey: effectiveSettings.s3SecretKey,
        body,
        contentType: "application/json",
        extraHeaders: conditionalHeaders
      });
      const response = await fetchWithTimeout(url, {
        method: "PUT",
        headers: signed.headers,
        body,
        signal: opts.signal
      }, 3e4, guardOptions);
      if (!response.ok) {
        const text = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, "S3 upload error").catch(() => "");
        throw new Error(`S3 upload failed: HTTP ${response.status}${text ? ` - ${text.slice(0, 200)}` : ""}`);
      }
      this._lastSyncEtag = response.headers?.get("ETag") || this._lastSyncEtag;
      this._lastSyncEtagKey = objectKey;
      return { success: true, timestamp: Date.now() };
    },
    async download(settings, opts = {}) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const check = this.validate(effectiveSettings);
      if (!check.valid) {
        throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(" ")}`);
      }
      const objectKey = this._objectKey(effectiveSettings, opts.objectName);
      const url = this._buildObjectUrl(effectiveSettings, objectKey);
      const guardOptions = {
        label: "S3 sync endpoint",
        allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings)
      };
      assertSyncEndpointAllowed(url, guardOptions);
      const signed = await this._signRequest({
        method: "GET",
        url,
        region: effectiveSettings.s3Region,
        accessKeyId: effectiveSettings.s3AccessKeyId,
        secretKey: effectiveSettings.s3SecretKey
      });
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: signed.headers,
        signal: opts.signal
      }, 3e4, guardOptions);
      if (response.status === 404) {
        this._lastSyncEtag = null;
        this._lastSyncEtagKey = objectKey;
        return null;
      }
      if (!response.ok) {
        const text = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, "S3 download error").catch(() => "");
        throw new Error(`S3 download failed: HTTP ${response.status}${text ? ` - ${text.slice(0, 200)}` : ""}`);
      }
      this._lastSyncEtag = response.headers?.get("ETag") || void 0;
      this._lastSyncEtagKey = objectKey;
      return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, "S3 sync payload");
    },
    async test(settings) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const check = this.validate(effectiveSettings);
      if (!check.valid) {
        return { success: false, error: check.errors.map((e) => e.error).join(" ") };
      }
      try {
        const url = this._buildObjectUrl(effectiveSettings, this._objectKey(effectiveSettings));
        const guardOptions = {
          label: "S3 sync endpoint",
          allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings)
        };
        assertSyncEndpointAllowed(url, guardOptions);
        const signed = await this._signRequest({
          method: "HEAD",
          url,
          region: effectiveSettings.s3Region,
          accessKeyId: effectiveSettings.s3AccessKeyId,
          secretKey: effectiveSettings.s3SecretKey
        });
        const response = await fetchWithTimeout(
          url,
          { method: "HEAD", headers: signed.headers },
          15e3,
          guardOptions
        );
        if (response.ok || response.status === 404) return { success: true };
        return { success: false, error: `HTTP ${response.status}` };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    async getStatus(settings) {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const check = this.validate(effectiveSettings);
      if (!check.valid) {
        return {
          connected: false,
          status: "missing_config",
          error: check.errors.map((e) => e.error).join(" ")
        };
      }
      let endpointHost = "";
      try {
        endpointHost = new URL(effectiveSettings.s3Endpoint).host;
      } catch {
      }
      const result = await this.test(effectiveSettings);
      return {
        connected: result.success === true,
        status: result.success === true ? "ok" : "error",
        error: result.error ?? null,
        user: { email: "", name: `${effectiveSettings.s3Bucket}@${endpointHost}` },
        endpointHost
      };
    },
    async disconnect() {
      await SyncCredentialStore.clearSessionCredentials();
      await SettingsManager.set({
        s3Endpoint: "",
        s3Region: "",
        s3Bucket: "",
        s3AccessKeyId: "",
        s3SecretKey: "",
        s3ObjectKey: ""
      });
      return { success: true };
    }
  };
  var CloudSyncProviders = {
    webdav,
    localfolder,
    localFolder: localfolder,
    local: localfolder,
    googledrive,
    google: googledrive,
    dropbox,
    onedrive,
    s3
  };
  Object.defineProperty(CloudSyncProviders, "_credentialStore", {
    value: SyncCredentialStore,
    enumerable: false,
    configurable: false
  });
  return module.exports.default || module.exports.CloudSyncProviders || module.exports;
})();

if (typeof self !== 'undefined') {
  self.CloudSyncProviders = CloudSyncProviders;
}
