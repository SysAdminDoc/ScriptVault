// ============================================================================
// Generated from src/background/cloud-sync.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const CloudSync = (() => {
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

  // src/background/cloud-sync.ts
  var cloud_sync_exports = {};
  __export(cloud_sync_exports, {
    CloudSync: () => CloudSync
  });
  module.exports = __toCommonJS(cloud_sync_exports);

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

  // src/background/gm-value-sync.ts
  var GM_VALUE_SYNC_SCHEMA = "scriptvault-gm-value-sync/v1";
  var GM_VALUE_SYNC_MAX_SCRIPT_BYTES = 64 * 1024;
  var GM_VALUE_SYNC_MAX_KEYS = 128;
  var GM_VALUE_SYNC_MAX_KEY_BYTES = 256;
  function byteLength(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  }
  function cloneJsonValue(value) {
    const json = JSON.stringify(value);
    if (json === void 0) return void 0;
    return JSON.parse(json);
  }
  function normalizeTimestamp(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return void 0;
    return Math.floor(timestamp);
  }
  function setMetadataKey(record, key, value) {
    Object.defineProperty(record, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function normalizeKeyMetadataEntry(value) {
    const timestamp = value && typeof value === "object" ? normalizeTimestamp(value.updatedAt) : normalizeTimestamp(value);
    return timestamp ? { updatedAt: timestamp } : void 0;
  }
  function shouldSyncScriptValues(script) {
    return script?.settings?.syncValues === true;
  }
  function buildGmValueSyncBundle(script, values, options = {}) {
    const warnings = [];
    if (!script?.id) {
      return { included: false, reason: "missing-script", bundle: null, warnings };
    }
    if (!shouldSyncScriptValues(script)) {
      return { included: false, reason: "not-opted-in", bundle: null, warnings };
    }
    const maxScriptBytes = options.maxScriptBytes ?? GM_VALUE_SYNC_MAX_SCRIPT_BYTES;
    const maxKeys = options.maxKeys ?? GM_VALUE_SYNC_MAX_KEYS;
    const maxKeyBytes = options.maxKeyBytes ?? GM_VALUE_SYNC_MAX_KEY_BYTES;
    const lastValueUpdatedAt = normalizeTimestamp(options.lastValueUpdatedAt);
    const sourceKeyMetadata = options.keyMetadata && typeof options.keyMetadata === "object" && !Array.isArray(options.keyMetadata) ? options.keyMetadata : {};
    const sourceValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};
    const bundle = {
      schema: GM_VALUE_SYNC_SCHEMA,
      scriptId: script.id,
      keyCount: 0,
      bytes: 0,
      values: {},
      ...lastValueUpdatedAt ? { lastValueUpdatedAt } : {}
    };
    for (const [rawKey, rawValue] of Object.entries(sourceValues).sort(([a], [b]) => a.localeCompare(b))) {
      const key = String(rawKey);
      if (bundle.keyCount >= maxKeys) {
        warnings.push({ id: "maxKeysExceeded", message: `Only the first ${maxKeys} stored value keys can sync` });
        break;
      }
      if (byteLength(key) > maxKeyBytes) {
        warnings.push({ id: "keyTooLarge", message: "Stored value key exceeds the sync key size cap" });
        continue;
      }
      let cloned;
      try {
        cloned = cloneJsonValue(rawValue);
      } catch (_) {
        warnings.push({ id: "valueNotJsonSerializable", message: "Stored value is not JSON-serializable" });
        continue;
      }
      if (cloned === void 0) {
        warnings.push({ id: "valueNotJsonSerializable", message: "Stored value is not JSON-serializable" });
        continue;
      }
      const nextValues = { ...bundle.values, [key]: cloned };
      const nextKeyMetadata = { ...bundle.keyMetadata ?? {} };
      const keyMetadataEntry = normalizeKeyMetadataEntry(sourceKeyMetadata[key]);
      if (keyMetadataEntry) setMetadataKey(nextKeyMetadata, key, keyMetadataEntry);
      const nextBundle = {
        ...bundle,
        values: nextValues,
        keyCount: Object.keys(nextValues).length,
        ...Object.keys(nextKeyMetadata).length > 0 ? { keyMetadata: nextKeyMetadata } : {}
      };
      const nextBytes = byteLength(nextBundle);
      if (nextBytes > maxScriptBytes) {
        warnings.push({ id: "scriptValueCapExceeded", message: "Stored values exceed the per-script sync size cap" });
        continue;
      }
      bundle.values = nextValues;
      bundle.keyCount = nextBundle.keyCount;
      if (nextBundle.keyMetadata) bundle.keyMetadata = nextBundle.keyMetadata;
      bundle.bytes = nextBytes;
    }
    if (bundle.keyCount === 0) {
      return { included: true, reason: "empty", bundle, warnings };
    }
    return { included: true, reason: "included", bundle, warnings };
  }

  // src/background/cloud-sync.ts
  async function resolveSyncCredentialSettings(settings) {
    if (typeof CloudSyncProviders?._credentialStore?.resolveSettings === "function") {
      return CloudSyncProviders._credentialStore.resolveSettings(settings);
    }
    return settings;
  }
  function getRuntimeHooks() {
    return globalThis;
  }
  async function refreshSyncedScriptRuntime(script) {
    const hooks = getRuntimeHooks();
    if (typeof hooks.unregisterScript === "function") {
      try {
        await hooks.unregisterScript(script.id);
      } catch (e) {
        debugLog("[CloudSync] Failed to unregister synced script:", script.id, e);
      }
    }
    if (script.enabled !== false && typeof hooks.registerScript === "function") {
      try {
        await hooks.registerScript(script);
      } catch (e) {
        debugLog("[CloudSync] Failed to register synced script:", script.id, e);
      }
    }
  }
  async function deleteSyncedScript(scriptId) {
    const hooks = getRuntimeHooks();
    if (typeof hooks.unregisterScript === "function") {
      try {
        await hooks.unregisterScript(scriptId);
      } catch (e) {
        debugLog("[CloudSync] Failed to unregister deleted synced script:", scriptId, e);
      }
    }
    await ScriptStorage.delete(scriptId);
  }
  async function updateBadgeIfAvailable() {
    const hooks = getRuntimeHooks();
    if (typeof hooks.updateBadge === "function") {
      try {
        await hooks.updateBadge();
      } catch (e) {
        debugLog("[CloudSync] Failed to refresh badge after sync:", e);
      }
    }
  }
  async function mergeScriptText(base, local, remote) {
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
    const scripts = (envelope.scripts || []).map((script) => sanitizeSyncScriptForEnvelope(script));
    const valueBundles = sanitizeValueBundlesForUpload({
      ...envelope,
      scripts
    });
    const sanitized = {
      ...envelope,
      scripts
    };
    delete sanitized.valueBundles;
    if (Object.keys(valueBundles).length > 0) sanitized.valueBundles = valueBundles;
    return sanitized;
  }
  async function readSyncEnvelopeFromRemote(remoteEnvelope, settings) {
    return SyncCrypto.decryptSyncEnvelope(remoteEnvelope, settings);
  }
  async function prepareSyncEnvelopeForRemoteUpload(envelope, settings) {
    return SyncCrypto.prepareSyncEnvelopeForUpload(
      sanitizeSyncEnvelopeForUpload(envelope),
      settings
    );
  }
  function sanitizeValueBundlesForUpload(envelope) {
    const result = {};
    const scriptsById = new Map(
      (envelope.scripts || []).map((script) => [script.id, script])
    );
    const sourceBundles = getSyncEnvelopeValueBundles(envelope);
    for (const [scriptId, bundle] of Object.entries(sourceBundles)) {
      const script = scriptsById.get(scriptId);
      if (!script || !shouldSyncScriptValues(script)) continue;
      if (!isPlainRecord(bundle) || bundle.schema !== GM_VALUE_SYNC_SCHEMA || bundle.scriptId !== scriptId) continue;
      if (!isPlainRecord(bundle.values)) continue;
      const rebuilt = buildGmValueSyncBundle(script, bundle.values, {
        lastValueUpdatedAt: getValueBundleLastUpdatedAt(bundle),
        keyMetadata: getValueBundleKeyMetadata(bundle)
      });
      if (rebuilt.bundle) result[scriptId] = rebuilt.bundle;
    }
    return result;
  }
  function isPlainRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function getSyncEnvelopeValueBundles(envelope) {
    return isPlainRecord(envelope?.valueBundles) ? envelope.valueBundles : {};
  }
  function getValueBundleLastUpdatedAt(bundle) {
    if (!isPlainRecord(bundle)) return void 0;
    const timestamp = Number(bundle.lastValueUpdatedAt);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return void 0;
    return Math.floor(timestamp);
  }
  function summarizeValueBundleTimestampFreshness(bundles, lastSync) {
    const summary = {
      withTimestamps: 0,
      missingTimestamps: 0,
      olderThanLastSync: 0,
      newerThanLastSync: 0
    };
    const lastSyncTimestamp = Number(lastSync);
    const hasLastSync = Number.isFinite(lastSyncTimestamp) && lastSyncTimestamp > 0;
    for (const bundle of Object.values(bundles)) {
      const updatedAt = getValueBundleLastUpdatedAt(bundle);
      if (!updatedAt) {
        summary.missingTimestamps += 1;
        continue;
      }
      summary.withTimestamps += 1;
      if (hasLastSync && updatedAt < lastSyncTimestamp) summary.olderThanLastSync += 1;
      if (hasLastSync && updatedAt > lastSyncTimestamp) summary.newerThanLastSync += 1;
    }
    return summary;
  }
  function setValueBundleMetadataKey(record, key, value) {
    Object.defineProperty(record, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function getValueBundleKeyMetadata(bundle) {
    if (!isPlainRecord(bundle) || !isPlainRecord(bundle.keyMetadata)) return void 0;
    const metadata = {};
    for (const [key, entry] of Object.entries(bundle.keyMetadata)) {
      const timestamp = isPlainRecord(entry) ? Number(entry.updatedAt) : Number(entry);
      if (Number.isFinite(timestamp) && timestamp > 0) {
        setValueBundleMetadataKey(metadata, key, { updatedAt: Math.floor(timestamp) });
      }
    }
    return Object.keys(metadata).length > 0 ? metadata : void 0;
  }
  function getValueBundleKeyUpdatedAt(metadata, key) {
    if (!metadata) return null;
    const timestamp = Number(metadata[key]?.updatedAt);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
    return Math.floor(timestamp);
  }
  function createEmptyRemoteValueBundleSelection() {
    return { valueBundles: {}, ignored: 0, warnings: 0 };
  }
  function createEmptyRemoteValueBundleApplyResult() {
    return {
      applied: 0,
      skippedNonEmpty: 0,
      skippedUserModified: 0,
      skippedUnavailable: 0,
      failures: 0,
      writeFailureRetryReady: 0,
      preservedValueBundles: {},
      preservedRemoteNewer: 0,
      preservedLocalNewer: 0,
      preservedSameTimestamp: 0,
      preservedRemoteTimestampOnly: 0,
      preservedLocalTimestampOnly: 0,
      preservedTimestampUnknown: 0,
      preservedCandidateMergeReady: 0,
      preservedCandidateMergeManualReview: 0,
      preservedCandidateMergeUnavailable: 0,
      preservedCandidateResultKeyTotal: 0,
      preservedCandidateAutoSelectedKeyTotal: 0,
      preservedCandidateReviewKeyTotal: 0,
      preservedCandidateAcceptedResultKeyTotal: 0,
      preservedCandidateBlockedSameTimestamp: 0,
      preservedCandidateBlockedUnknownTimestamp: 0,
      preservedCandidateBlockedOneSidedTimestamp: 0,
      preservedCandidateBlockedUnavailable: 0,
      preservedCandidateBlockedNoCandidateKeys: 0
    };
  }
  function summarizeRemoteValueBundleApplyResult(result) {
    const summary = {
      applied: result.applied,
      preserved: Object.keys(result.preservedValueBundles).length,
      conflictBlocked: result.skippedNonEmpty + result.skippedUserModified,
      skippedNonEmpty: result.skippedNonEmpty,
      skippedUserModified: result.skippedUserModified,
      skippedUnavailable: result.skippedUnavailable,
      failures: result.failures,
      ...result.writeFailureRetryReady > 0 ? { writeFailureRetryReady: result.writeFailureRetryReady } : {},
      preservedRemoteNewer: result.preservedRemoteNewer,
      preservedLocalNewer: result.preservedLocalNewer,
      preservedSameTimestamp: result.preservedSameTimestamp,
      preservedRemoteTimestampOnly: result.preservedRemoteTimestampOnly,
      preservedLocalTimestampOnly: result.preservedLocalTimestampOnly,
      preservedTimestampUnknown: result.preservedTimestampUnknown,
      preservedCandidateMergeReady: result.preservedCandidateMergeReady,
      preservedCandidateMergeManualReview: result.preservedCandidateMergeManualReview,
      preservedCandidateMergeUnavailable: result.preservedCandidateMergeUnavailable,
      preservedCandidateResultKeyTotal: result.preservedCandidateResultKeyTotal,
      preservedCandidateAutoSelectedKeyTotal: result.preservedCandidateAutoSelectedKeyTotal,
      preservedCandidateReviewKeyTotal: result.preservedCandidateReviewKeyTotal,
      preservedCandidateAcceptedResultKeyTotal: result.preservedCandidateAcceptedResultKeyTotal,
      preservedCandidateBlockedSameTimestamp: result.preservedCandidateBlockedSameTimestamp,
      preservedCandidateBlockedUnknownTimestamp: result.preservedCandidateBlockedUnknownTimestamp,
      preservedCandidateBlockedOneSidedTimestamp: result.preservedCandidateBlockedOneSidedTimestamp,
      preservedCandidateBlockedUnavailable: result.preservedCandidateBlockedUnavailable,
      preservedCandidateBlockedNoCandidateKeys: result.preservedCandidateBlockedNoCandidateKeys
    };
    return Object.values(summary).some((value) => value > 0) ? summary : null;
  }
  function selectApplicableRemoteValueBundles(remote, targetScripts = []) {
    const sourceBundles = getSyncEnvelopeValueBundles(remote);
    if (Object.keys(sourceBundles).length === 0) return createEmptyRemoteValueBundleSelection();
    const result = createEmptyRemoteValueBundleSelection();
    const scriptsById = new Map(
      targetScripts.map((script) => [script.id, script])
    );
    for (const [scriptId, bundle] of Object.entries(sourceBundles)) {
      const script = scriptsById.get(scriptId);
      if (!script || !shouldSyncScriptValues(script)) {
        result.ignored += 1;
        continue;
      }
      if (!isPlainRecord(bundle) || bundle.schema !== GM_VALUE_SYNC_SCHEMA || bundle.scriptId !== scriptId) {
        result.ignored += 1;
        continue;
      }
      if (!isPlainRecord(bundle.values)) {
        result.ignored += 1;
        continue;
      }
      const rebuilt = buildGmValueSyncBundle(script, bundle.values, {
        lastValueUpdatedAt: getValueBundleLastUpdatedAt(bundle),
        keyMetadata: getValueBundleKeyMetadata(bundle)
      });
      result.warnings += rebuilt.warnings.length;
      if (rebuilt.bundle) {
        result.valueBundles[scriptId] = rebuilt.bundle;
      } else {
        result.ignored += 1;
      }
    }
    return result;
  }
  function countRemoteValueBundlesApplyReady(selection, local) {
    let ready = 0;
    let conflictBlocked = 0;
    let candidateMergeReady = 0;
    let candidateMergeManualReview = 0;
    let candidateMergeUnavailable = 0;
    let mergeSimulationReadyPreviewOnlyResultKeyTotal = 0;
    let mergeSimulationManualReviewResultKeyTotal = 0;
    let mergeSimulationUnavailableResultKeyTotal = 0;
    let candidateMergeBlockedSameTimestamp = 0;
    let candidateMergeBlockedUnknownTimestamp = 0;
    let candidateMergeBlockedOneSidedTimestamp = 0;
    let candidateMergeBlockedUnavailable = 0;
    let candidateMergeBlockedNoCandidateKeys = 0;
    let candidateResultKeyTotal = 0;
    let candidateAutoSelectedKeyTotal = 0;
    let candidateReviewKeyTotal = 0;
    let candidateAcceptedResultKeyTotal = 0;
    const conflicts = [];
    const localBundles = getSyncEnvelopeValueBundles(local);
    const localScriptIds = new Set(
      Array.isArray(local?.scripts) ? local.scripts.map((script) => script.id) : []
    );
    const addConflict = (reason, remoteBundle, localBundle) => {
      conflictBlocked += 1;
      const preview = buildValueBundleConflictPreview(reason, remoteBundle, localBundle);
      const candidateResultKeyCount = preview.candidateResultKeyCount ?? 0;
      if (preview.candidateMergeSimulation === "ready-preview-only") {
        candidateMergeReady += 1;
        candidateAcceptedResultKeyTotal += candidateResultKeyCount;
        mergeSimulationReadyPreviewOnlyResultKeyTotal += candidateResultKeyCount;
      } else if (preview.candidateMergeSimulation === "unavailable") {
        candidateMergeUnavailable += 1;
        mergeSimulationUnavailableResultKeyTotal += candidateResultKeyCount;
      } else {
        candidateMergeManualReview += 1;
        mergeSimulationManualReviewResultKeyTotal += candidateResultKeyCount;
      }
      if (preview.candidateMergeBlockReason === "same-timestamp") candidateMergeBlockedSameTimestamp += 1;
      else if (preview.candidateMergeBlockReason === "unknown-timestamp") candidateMergeBlockedUnknownTimestamp += 1;
      else if (preview.candidateMergeBlockReason === "one-sided-timestamp") candidateMergeBlockedOneSidedTimestamp += 1;
      else if (preview.candidateMergeBlockReason === "local-bundle-unavailable") candidateMergeBlockedUnavailable += 1;
      else if (preview.candidateMergeBlockReason === "no-candidate-keys") candidateMergeBlockedNoCandidateKeys += 1;
      candidateResultKeyTotal += candidateResultKeyCount;
      candidateAutoSelectedKeyTotal += preview.candidateAutoSelectedKeyCount ?? 0;
      candidateReviewKeyTotal += preview.candidateReviewKeyCount ?? 0;
      if (conflicts.length < 20) {
        conflicts.push(preview);
      }
    };
    for (const [scriptId, remoteBundle] of Object.entries(selection.valueBundles)) {
      const localBundle = localBundles[scriptId];
      if (!isPlainRecord(localBundle) && localScriptIds.has(scriptId)) {
        addConflict("local-bundle-unavailable", remoteBundle, localBundle);
      } else if (!isPlainRecord(localBundle) || Number(localBundle.keyCount) === 0) {
        ready += 1;
      } else {
        addConflict("local-values-present", remoteBundle, localBundle);
      }
    }
    return {
      ready,
      conflictBlocked,
      conflicts,
      candidateMergeReady,
      candidateMergeManualReview,
      candidateMergeUnavailable,
      mergeSimulationReadyPreviewOnlyResultKeyTotal,
      mergeSimulationManualReviewResultKeyTotal,
      mergeSimulationUnavailableResultKeyTotal,
      candidateMergeBlockedSameTimestamp,
      candidateMergeBlockedUnknownTimestamp,
      candidateMergeBlockedOneSidedTimestamp,
      candidateMergeBlockedUnavailable,
      candidateMergeBlockedNoCandidateKeys,
      candidateResultKeyTotal,
      candidateAutoSelectedKeyTotal,
      candidateReviewKeyTotal,
      candidateAcceptedResultKeyTotal
    };
  }
  function safeBundleMetric(value) {
    return Math.max(0, Number(value) || 0);
  }
  function compareValueBundleLastWrite(localTimestamp, remoteTimestamp) {
    if (localTimestamp && remoteTimestamp) {
      if (localTimestamp > remoteTimestamp) return "local-newer";
      if (remoteTimestamp > localTimestamp) return "remote-newer";
      return "same";
    }
    if (localTimestamp) return "local-timestamp-only";
    if (remoteTimestamp) return "remote-timestamp-only";
    return "unknown";
  }
  function countPreservedValueBundleTimestampHint(result, localBundle, remoteBundle) {
    const localLastValueUpdatedAt = getValueBundleLastUpdatedAt(localBundle) ?? null;
    const remoteLastValueUpdatedAt = getValueBundleLastUpdatedAt(remoteBundle) ?? null;
    const hint = compareValueBundleLastWrite(localLastValueUpdatedAt, remoteLastValueUpdatedAt);
    if (hint === "remote-newer") result.preservedRemoteNewer += 1;
    else if (hint === "local-newer") result.preservedLocalNewer += 1;
    else if (hint === "same") result.preservedSameTimestamp += 1;
    else if (hint === "remote-timestamp-only") result.preservedRemoteTimestampOnly += 1;
    else if (hint === "local-timestamp-only") result.preservedLocalTimestampOnly += 1;
    else result.preservedTimestampUnknown += 1;
  }
  function countPreservedValueBundleCandidateMerge(result, localBundle, remoteBundle) {
    const hasLocalBundle = isPlainRecord(localBundle);
    const keyCounts = hasLocalBundle ? countValueBundleKeyOverlap(
      localBundle.values,
      remoteBundle.values,
      getValueBundleKeyMetadata(localBundle),
      getValueBundleKeyMetadata(remoteBundle)
    ) : null;
    const candidateMerge = buildValueBundleCandidateMergePlan(keyCounts);
    const candidateGate = buildValueBundleCandidateMergeGate(keyCounts, candidateMerge);
    const candidateResult = buildValueBundleCandidateMergeResult(keyCounts, candidateMerge, candidateGate);
    if (candidateGate.gate === "ready") result.preservedCandidateMergeReady += 1;
    else if (candidateGate.gate === "unavailable") result.preservedCandidateMergeUnavailable += 1;
    else result.preservedCandidateMergeManualReview += 1;
    if (candidateGate.blockReason === "same-timestamp") result.preservedCandidateBlockedSameTimestamp += 1;
    else if (candidateGate.blockReason === "unknown-timestamp") result.preservedCandidateBlockedUnknownTimestamp += 1;
    else if (candidateGate.blockReason === "one-sided-timestamp") result.preservedCandidateBlockedOneSidedTimestamp += 1;
    else if (candidateGate.blockReason === "local-bundle-unavailable") result.preservedCandidateBlockedUnavailable += 1;
    else if (candidateGate.blockReason === "no-candidate-keys") result.preservedCandidateBlockedNoCandidateKeys += 1;
    result.preservedCandidateResultKeyTotal += candidateResult.resultKeyCount ?? 0;
    result.preservedCandidateAutoSelectedKeyTotal += candidateResult.autoSelectedKeyCount ?? 0;
    result.preservedCandidateReviewKeyTotal += candidateResult.reviewKeyCount ?? 0;
    if (candidateGate.gate === "ready") {
      result.preservedCandidateAcceptedResultKeyTotal += candidateResult.resultKeyCount ?? 0;
    }
  }
  function preserveRemoteValueBundle(result, scriptId, remoteBundle, localBundle) {
    result.preservedValueBundles[scriptId] = remoteBundle;
    countPreservedValueBundleTimestampHint(result, localBundle, remoteBundle);
    countPreservedValueBundleCandidateMerge(result, localBundle, remoteBundle);
  }
  function buildValueBundleConflictPreview(reason, remoteBundle, localBundle) {
    const hasLocalBundle = isPlainRecord(localBundle);
    const localKeyMetadata = hasLocalBundle ? getValueBundleKeyMetadata(localBundle) : void 0;
    const remoteKeyMetadata = getValueBundleKeyMetadata(remoteBundle);
    const keyCounts = hasLocalBundle ? countValueBundleKeyOverlap(localBundle.values, remoteBundle.values, localKeyMetadata, remoteKeyMetadata) : null;
    const localLastValueUpdatedAt = hasLocalBundle ? getValueBundleLastUpdatedAt(localBundle) ?? null : null;
    const remoteLastValueUpdatedAt = getValueBundleLastUpdatedAt(remoteBundle) ?? null;
    const candidateMerge = buildValueBundleCandidateMergePlan(keyCounts);
    const candidateGate = buildValueBundleCandidateMergeGate(keyCounts, candidateMerge);
    const candidateResult = buildValueBundleCandidateMergeResult(keyCounts, candidateMerge, candidateGate);
    return {
      reason,
      localKeyCount: hasLocalBundle ? safeBundleMetric(localBundle.keyCount) : null,
      remoteKeyCount: safeBundleMetric(remoteBundle.keyCount),
      localBytes: hasLocalBundle ? safeBundleMetric(localBundle.bytes) : null,
      remoteBytes: safeBundleMetric(remoteBundle.bytes),
      overlappingKeyCount: keyCounts?.overlapping ?? null,
      localOnlyKeyCount: keyCounts?.localOnly ?? null,
      remoteOnlyKeyCount: keyCounts?.remoteOnly ?? null,
      localLastValueUpdatedAt,
      remoteLastValueUpdatedAt,
      lastWriteHint: compareValueBundleLastWrite(localLastValueUpdatedAt, remoteLastValueUpdatedAt),
      overlappingRemoteNewerKeyCount: keyCounts?.overlappingRemoteNewer ?? null,
      overlappingLocalNewerKeyCount: keyCounts?.overlappingLocalNewer ?? null,
      overlappingSameTimestampKeyCount: keyCounts?.overlappingSameTimestamp ?? null,
      overlappingRemoteTimestampOnlyKeyCount: keyCounts?.overlappingRemoteTimestampOnly ?? null,
      overlappingLocalTimestampOnlyKeyCount: keyCounts?.overlappingLocalTimestampOnly ?? null,
      overlappingUnknownTimestampKeyCount: keyCounts?.overlappingUnknownTimestamp ?? null,
      candidateMergePlan: candidateMerge.plan,
      candidateRemoteKeyCount: candidateMerge.remoteKeyCount,
      candidateLocalKeyCount: candidateMerge.localKeyCount,
      candidateSameTimestampKeyCount: candidateMerge.sameTimestampKeyCount,
      candidateManualKeyCount: candidateMerge.manualKeyCount,
      candidateOneSidedTimestampKeyCount: candidateGate.oneSidedTimestampKeyCount,
      candidateResultKeyCount: candidateResult.resultKeyCount,
      candidateAutoSelectedKeyCount: candidateResult.autoSelectedKeyCount,
      candidateReviewKeyCount: candidateResult.reviewKeyCount,
      candidateMergeGate: candidateGate.gate,
      candidateMergeBlockReason: candidateGate.blockReason,
      candidateMergeSimulation: getValueBundleCandidateMergeSimulation(candidateGate.gate)
    };
  }
  function buildValueBundleCandidateMergePlan(keyCounts) {
    if (!keyCounts) {
      return {
        plan: "unavailable",
        remoteKeyCount: null,
        localKeyCount: null,
        sameTimestampKeyCount: null,
        manualKeyCount: null
      };
    }
    const remoteKeyCount = keyCounts.remoteOnly + keyCounts.overlappingRemoteNewer + keyCounts.overlappingRemoteTimestampOnly;
    const localKeyCount = keyCounts.localOnly + keyCounts.overlappingLocalNewer + keyCounts.overlappingLocalTimestampOnly;
    const sameTimestampKeyCount = keyCounts.overlappingSameTimestamp;
    const manualKeyCount = keyCounts.overlappingUnknownTimestamp;
    let plan = "manual-review";
    if (manualKeyCount > 0 || sameTimestampKeyCount > 0) plan = "manual-review";
    else if (remoteKeyCount > 0 && localKeyCount > 0) plan = "timestamp-guided";
    else if (remoteKeyCount > 0) plan = "remote-preferred";
    else if (localKeyCount > 0) plan = "local-preferred";
    return { plan, remoteKeyCount, localKeyCount, sameTimestampKeyCount, manualKeyCount };
  }
  function isValueBundleCandidateMergeAcceptanceReady(keyCounts, candidateMerge, oneSidedTimestampKeyCount) {
    const candidateKeyCount = (candidateMerge.remoteKeyCount ?? 0) + (candidateMerge.localKeyCount ?? 0);
    const resultKeyCount = keyCounts.localOnly + keyCounts.remoteOnly + keyCounts.overlapping;
    const reviewKeyCount = (candidateMerge.sameTimestampKeyCount ?? 0) + (candidateMerge.manualKeyCount ?? 0) + oneSidedTimestampKeyCount;
    return candidateKeyCount > 0 && candidateKeyCount === resultKeyCount && reviewKeyCount === 0;
  }
  function buildValueBundleCandidateMergeGate(keyCounts, candidateMerge) {
    if (!keyCounts) {
      return {
        gate: "unavailable",
        blockReason: "local-bundle-unavailable",
        oneSidedTimestampKeyCount: null
      };
    }
    const oneSidedTimestampKeyCount = keyCounts.overlappingRemoteTimestampOnly + keyCounts.overlappingLocalTimestampOnly;
    if (candidateMerge.manualKeyCount && candidateMerge.manualKeyCount > 0) {
      return { gate: "manual-review", blockReason: "unknown-timestamp", oneSidedTimestampKeyCount };
    }
    if (candidateMerge.sameTimestampKeyCount && candidateMerge.sameTimestampKeyCount > 0) {
      return { gate: "manual-review", blockReason: "same-timestamp", oneSidedTimestampKeyCount };
    }
    if (oneSidedTimestampKeyCount > 0) {
      return { gate: "manual-review", blockReason: "one-sided-timestamp", oneSidedTimestampKeyCount };
    }
    const candidateKeyCount = (candidateMerge.remoteKeyCount ?? 0) + (candidateMerge.localKeyCount ?? 0);
    if (candidateKeyCount <= 0) {
      return { gate: "manual-review", blockReason: "no-candidate-keys", oneSidedTimestampKeyCount };
    }
    if (!isValueBundleCandidateMergeAcceptanceReady(keyCounts, candidateMerge, oneSidedTimestampKeyCount)) {
      return { gate: "manual-review", blockReason: "unknown-timestamp", oneSidedTimestampKeyCount };
    }
    return { gate: "ready", blockReason: "none", oneSidedTimestampKeyCount };
  }
  function getValueBundleCandidateMergeSimulation(gate) {
    if (gate === "ready") return "ready-preview-only";
    if (gate === "unavailable") return "unavailable";
    return "manual-review";
  }
  function buildValueBundleCandidateMergeResult(keyCounts, candidateMerge, candidateGate) {
    if (!keyCounts) {
      return { resultKeyCount: null, autoSelectedKeyCount: null, reviewKeyCount: null };
    }
    const resultKeyCount = keyCounts.localOnly + keyCounts.remoteOnly + keyCounts.overlapping;
    const autoSelectedKeyCount = (candidateMerge.remoteKeyCount ?? 0) + (candidateMerge.localKeyCount ?? 0);
    const reviewKeyCount = (candidateMerge.sameTimestampKeyCount ?? 0) + (candidateMerge.manualKeyCount ?? 0) + (candidateGate.oneSidedTimestampKeyCount ?? 0);
    return { resultKeyCount, autoSelectedKeyCount, reviewKeyCount };
  }
  function countValueBundleKeyOverlap(localValues, remoteValues, localKeyMetadata, remoteKeyMetadata) {
    const localKeys = new Set(isPlainRecord(localValues) ? Object.keys(localValues) : []);
    const remoteKeys = new Set(isPlainRecord(remoteValues) ? Object.keys(remoteValues) : []);
    let overlapping = 0;
    let localOnly = 0;
    let remoteOnly = 0;
    let overlappingRemoteNewer = 0;
    let overlappingLocalNewer = 0;
    let overlappingSameTimestamp = 0;
    let overlappingRemoteTimestampOnly = 0;
    let overlappingLocalTimestampOnly = 0;
    let overlappingUnknownTimestamp = 0;
    for (const key of localKeys) {
      if (remoteKeys.has(key)) {
        overlapping += 1;
        const hint = compareValueBundleLastWrite(
          getValueBundleKeyUpdatedAt(localKeyMetadata, key),
          getValueBundleKeyUpdatedAt(remoteKeyMetadata, key)
        );
        if (hint === "remote-newer") overlappingRemoteNewer += 1;
        else if (hint === "local-newer") overlappingLocalNewer += 1;
        else if (hint === "same") overlappingSameTimestamp += 1;
        else if (hint === "remote-timestamp-only") overlappingRemoteTimestampOnly += 1;
        else if (hint === "local-timestamp-only") overlappingLocalTimestampOnly += 1;
        else overlappingUnknownTimestamp += 1;
      } else {
        localOnly += 1;
      }
    }
    for (const key of remoteKeys) {
      if (!localKeys.has(key)) remoteOnly += 1;
    }
    return {
      overlapping,
      localOnly,
      remoteOnly,
      overlappingRemoteNewer,
      overlappingLocalNewer,
      overlappingSameTimestamp,
      overlappingRemoteTimestampOnly,
      overlappingLocalTimestampOnly,
      overlappingUnknownTimestamp
    };
  }
  async function applyRemoteValueBundlesWhenLocalEmpty(selection, currentScripts = [], localValueBundles = {}) {
    const result = createEmptyRemoteValueBundleApplyResult();
    const bundles = Object.entries(selection.valueBundles);
    if (bundles.length === 0) return result;
    if (typeof ScriptValues === "undefined" || typeof ScriptValues?.getAll !== "function" || typeof ScriptValues?.setAll !== "function") {
      result.skippedUnavailable = bundles.length;
      for (const [scriptId, bundle] of bundles) {
        preserveRemoteValueBundle(result, scriptId, bundle, localValueBundles[scriptId]);
      }
      return result;
    }
    const scriptsById = new Map(
      currentScripts.map((script) => [script.id, script])
    );
    for (const [scriptId, bundle] of bundles) {
      const currentScript = scriptsById.get(scriptId);
      const localBundle = localValueBundles[scriptId];
      if (currentScript?.settings?.userModified) {
        result.skippedUserModified += 1;
        preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
        continue;
      }
      let localValues = null;
      try {
        localValues = await ScriptValues.getAll(scriptId);
      } catch (_) {
        result.failures += 1;
        preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
        continue;
      }
      if (Object.keys(localValues || {}).length > 0) {
        result.skippedNonEmpty += 1;
        preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
        continue;
      }
      try {
        await ScriptValues.setAll(scriptId, bundle.values);
        result.applied += 1;
      } catch (_) {
        result.failures += 1;
        result.writeFailureRetryReady += 1;
        preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
      }
    }
    return result;
  }
  async function buildValueBundlesForScripts(scripts) {
    const valueBundles = {};
    let optIns = 0;
    let warnings = 0;
    if (typeof ScriptValues === "undefined" || typeof ScriptValues?.getAll !== "function") {
      const hasOptIns = scripts.some((script) => shouldSyncScriptValues(script));
      if (hasOptIns) throw new Error("GM value storage is unavailable for opted-in value sync");
      return { valueBundles, optIns, warnings };
    }
    for (const script of scripts) {
      if (!shouldSyncScriptValues(script)) continue;
      optIns++;
      const values = await ScriptValues.getAll(script.id);
      const metadata = typeof ScriptValues.getAllMetadata === "function" ? await ScriptValues.getAllMetadata(script.id) : null;
      const keyMetadata = typeof ScriptValues.getAllKeyMetadata === "function" ? await ScriptValues.getAllKeyMetadata(script.id) : null;
      const result = buildGmValueSyncBundle(script, values, {
        lastValueUpdatedAt: metadata?.lastUpdatedAt ?? null,
        keyMetadata
      });
      warnings += result.warnings.length;
      if (result.bundle) valueBundles[script.id] = result.bundle;
    }
    return { valueBundles, optIns, warnings };
  }
  var CloudSync = {
    // Use providers from imported CloudSyncProviders module
    get providers() {
      return CloudSyncProviders;
    },
    _syncInProgress: false,
    _abortController: null,
    async sync() {
      if (this._syncInProgress) {
        debugLog("[CloudSync] Sync already in progress, skipping");
        return { skipped: true };
      }
      this._syncInProgress = true;
      this._abortController = new AbortController();
      const syncTimeoutAlarm = "sv_sync_timeout_" + Date.now();
      let onTimeoutAlarm = null;
      const removeTimeoutAlarmListener = () => {
        if (!onTimeoutAlarm) return;
        try {
          chrome.alarms.onAlarm.removeListener?.(onTimeoutAlarm);
        } catch (_) {
        }
        onTimeoutAlarm = null;
      };
      try {
        const timeoutPromise = new Promise((_, reject) => {
          chrome.alarms.create(syncTimeoutAlarm, { delayInMinutes: 1.5 });
          onTimeoutAlarm = (alarm) => {
            if (alarm.name !== syncTimeoutAlarm) return;
            removeTimeoutAlarmListener();
            try {
              this._abortController?.abort(new Error("Sync timed out after 90s"));
            } catch (_2) {
            }
            reject(new Error("Sync timed out after 90s"));
          };
          chrome.alarms.onAlarm.addListener(onTimeoutAlarm);
        });
        return await Promise.race([
          this._performSync({ signal: this._abortController.signal }),
          timeoutPromise
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[ScriptVault] Sync failed:", e);
        return { error: msg };
      } finally {
        removeTimeoutAlarmListener();
        try {
          await Promise.resolve(chrome.alarms.clear(syncTimeoutAlarm));
        } catch (_) {
        }
        this._syncInProgress = false;
        this._abortController = null;
      }
    },
    async _buildLocalData(tombstones = {}) {
      const scripts = await ScriptStorage.getAll();
      const syncScripts = scripts.map((s) => ({
        id: s.id,
        code: s.code,
        enabled: s.enabled,
        position: s.position,
        settings: cloneSyncSafeScriptSettings(s.settings),
        updatedAt: s.updatedAt,
        syncBaseCode: s.syncBaseCode ?? null,
        name: s.meta?.name || s.id
      }));
      const { valueBundles, warnings } = await buildValueBundlesForScripts(syncScripts);
      return {
        scripts,
        valueBundleWarnings: warnings,
        localData: {
          version: 1,
          timestamp: Date.now(),
          scripts: syncScripts,
          tombstones,
          ...Object.keys(valueBundles).length > 0 ? { valueBundles } : {}
        }
      };
    },
    async preview(providerName) {
      const settings = await resolveSyncCredentialSettings(await SettingsManager.get());
      const selectedProvider = providerName || settings.syncProvider;
      if (!selectedProvider || selectedProvider === "none") {
        return { success: false, error: "Choose a sync provider first" };
      }
      const provider = this.providers[selectedProvider];
      if (!provider) return { success: false, error: `Unknown provider: ${selectedProvider}` };
      if (provider.supportsDryRun === false || typeof provider.download !== "function") {
        return {
          success: false,
          error: `Dry-run preview is not available for ${provider.name || selectedProvider}`
        };
      }
      const tombstoneData = await chrome.storage.local.get("syncTombstones");
      const tombstones = tombstoneData["syncTombstones"] ?? {};
      const { localData, valueBundleWarnings } = await this._buildLocalData(tombstones);
      let remoteData = null;
      try {
        const remoteEnvelope = await provider.download(settings);
        remoteData = await readSyncEnvelopeFromRemote(remoteEnvelope, settings);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          provider: selectedProvider,
          providerLabel: provider.name || selectedProvider,
          error: msg
        };
      }
      return {
        success: true,
        ...this.previewData(localData, remoteData, {
          provider: selectedProvider,
          providerLabel: provider.name || selectedProvider,
          lastSync: settings.lastSync || null,
          valueBundleWarnings
        })
      };
    },
    previewData(local, remote, options = {}) {
      const localScripts = Array.isArray(local?.scripts) ? local.scripts : [];
      const remoteScripts = Array.isArray(remote?.scripts) ? remote.scripts : [];
      const tombstones = {
        ...local?.tombstones ?? {},
        ...remote?.tombstones ?? {}
      };
      const localById = new Map(localScripts.map((script) => [script.id, script]));
      const remoteById = new Map(remoteScripts.map((script) => [script.id, script]));
      const remoteValueBundleSelection = remote ? selectApplicableRemoteValueBundles(remote, this.mergeData(local, remote).scripts) : createEmptyRemoteValueBundleSelection();
      const remoteValueBundleApplyReadiness = countRemoteValueBundlesApplyReady(
        remoteValueBundleSelection,
        local
      );
      const localValueBundleFreshness = summarizeValueBundleTimestampFreshness(
        getSyncEnvelopeValueBundles(local),
        options.lastSync
      );
      const remoteValueBundleFreshness = summarizeValueBundleTimestampFreshness(
        getSyncEnvelopeValueBundles(remote),
        options.lastSync
      );
      const ids = /* @__PURE__ */ new Set([...localById.keys(), ...remoteById.keys()]);
      const summary = {
        localScripts: localScripts.length,
        remoteScripts: remoteScripts.length,
        localOnly: 0,
        remoteOnly: 0,
        localNewer: 0,
        remoteNewer: 0,
        unchanged: 0,
        tombstoned: 0,
        conflicts: 0,
        localValueOptIns: localScripts.filter((script) => shouldSyncScriptValues(script)).length,
        localValueBundles: Object.keys(local?.valueBundles ?? {}).length,
        remoteValueBundles: Object.keys(remote?.valueBundles ?? {}).length,
        valueBundleWarnings: Math.max(0, Number(options.valueBundleWarnings) || 0),
        remoteValueBundlesApplicable: Object.keys(remoteValueBundleSelection.valueBundles).length,
        remoteValueBundlesApplyReady: remoteValueBundleApplyReadiness.ready,
        remoteValueBundlesConflictBlocked: remoteValueBundleApplyReadiness.conflictBlocked,
        remoteValueBundlesIgnored: remoteValueBundleSelection.ignored,
        remoteValueBundleWarnings: remoteValueBundleSelection.warnings,
        localValueBundlesWithTimestamps: localValueBundleFreshness.withTimestamps,
        localValueBundlesMissingTimestamps: localValueBundleFreshness.missingTimestamps,
        localValueBundlesOlderThanLastSync: localValueBundleFreshness.olderThanLastSync,
        localValueBundlesNewerThanLastSync: localValueBundleFreshness.newerThanLastSync,
        remoteValueBundlesWithTimestamps: remoteValueBundleFreshness.withTimestamps,
        remoteValueBundlesMissingTimestamps: remoteValueBundleFreshness.missingTimestamps,
        remoteValueBundlesOlderThanLastSync: remoteValueBundleFreshness.olderThanLastSync,
        remoteValueBundlesNewerThanLastSync: remoteValueBundleFreshness.newerThanLastSync,
        remoteValueBundleCandidateMergesReady: remoteValueBundleApplyReadiness.candidateMergeReady,
        remoteValueBundleCandidateMergesManualReview: remoteValueBundleApplyReadiness.candidateMergeManualReview,
        remoteValueBundleCandidateMergesUnavailable: remoteValueBundleApplyReadiness.candidateMergeUnavailable,
        remoteValueBundleMergeSimulationReadyPreviewOnly: remoteValueBundleApplyReadiness.candidateMergeReady,
        remoteValueBundleMergeSimulationManualReview: remoteValueBundleApplyReadiness.candidateMergeManualReview,
        remoteValueBundleMergeSimulationUnavailable: remoteValueBundleApplyReadiness.candidateMergeUnavailable,
        remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal: remoteValueBundleApplyReadiness.mergeSimulationReadyPreviewOnlyResultKeyTotal,
        remoteValueBundleMergeSimulationManualReviewResultKeyTotal: remoteValueBundleApplyReadiness.mergeSimulationManualReviewResultKeyTotal,
        remoteValueBundleMergeSimulationUnavailableResultKeyTotal: remoteValueBundleApplyReadiness.mergeSimulationUnavailableResultKeyTotal,
        remoteValueBundleCandidateMergesBlockedSameTimestamp: remoteValueBundleApplyReadiness.candidateMergeBlockedSameTimestamp,
        remoteValueBundleCandidateMergesBlockedUnknownTimestamp: remoteValueBundleApplyReadiness.candidateMergeBlockedUnknownTimestamp,
        remoteValueBundleCandidateMergesBlockedOneSidedTimestamp: remoteValueBundleApplyReadiness.candidateMergeBlockedOneSidedTimestamp,
        remoteValueBundleCandidateMergesBlockedUnavailable: remoteValueBundleApplyReadiness.candidateMergeBlockedUnavailable,
        remoteValueBundleCandidateMergesBlockedNoCandidateKeys: remoteValueBundleApplyReadiness.candidateMergeBlockedNoCandidateKeys,
        remoteValueBundleCandidateResultKeyTotal: remoteValueBundleApplyReadiness.candidateResultKeyTotal,
        remoteValueBundleCandidateAutoSelectedKeyTotal: remoteValueBundleApplyReadiness.candidateAutoSelectedKeyTotal,
        remoteValueBundleCandidateReviewKeyTotal: remoteValueBundleApplyReadiness.candidateReviewKeyTotal,
        remoteValueBundleCandidateAcceptedResultKeyTotal: remoteValueBundleApplyReadiness.candidateAcceptedResultKeyTotal,
        valueBundleApplyEnabled: true,
        valueBundleApplyMode: "empty-local-only",
        wouldUpload: false,
        wouldDownload: false,
        wouldUploadValues: false,
        wouldApplyValues: false
      };
      const conflicts = [];
      for (const id of ids) {
        if (tombstones[id]) {
          summary.tombstoned += 1;
          continue;
        }
        const localScript = localById.get(id);
        const remoteScript = remoteById.get(id);
        if (!localScript && remoteScript) {
          summary.remoteOnly += 1;
          continue;
        }
        if (localScript && !remoteScript) {
          summary.localOnly += 1;
          continue;
        }
        if (!localScript || !remoteScript) continue;
        const base = localScript.syncBaseCode;
        const localChanged = base != null && localScript.code !== base;
        const remoteChanged = base != null && remoteScript.code !== base;
        if (base != null && localChanged && remoteChanged && localScript.code !== remoteScript.code) {
          summary.conflicts += 1;
          if (conflicts.length < 20) {
            conflicts.push({
              id,
              name: localScript.name || remoteScript.name || id,
              localUpdatedAt: localScript.updatedAt || null,
              remoteUpdatedAt: remoteScript.updatedAt || null,
              reason: "Both local and remote changed since the last sync base"
            });
          }
          continue;
        }
        if ((localScript.updatedAt || 0) > (remoteScript.updatedAt || 0)) {
          summary.localNewer += 1;
        } else if ((remoteScript.updatedAt || 0) > (localScript.updatedAt || 0)) {
          summary.remoteNewer += 1;
        } else {
          summary.unchanged += 1;
        }
      }
      summary.wouldUpload = summary.localOnly > 0 || summary.localNewer > 0 || summary.conflicts > 0 || !remote;
      summary.wouldDownload = summary.remoteOnly > 0 || summary.remoteNewer > 0 || summary.conflicts > 0;
      summary.wouldUploadValues = summary.localValueBundles > 0;
      summary.wouldApplyValues = summary.valueBundleApplyEnabled && summary.remoteValueBundlesApplyReady > 0;
      return {
        dryRun: true,
        noWrites: true,
        provider: options.provider ?? null,
        providerLabel: options.providerLabel ?? options.provider ?? null,
        lastSync: options.lastSync ?? null,
        remoteFound: !!remote,
        summary,
        conflicts,
        valueBundleConflicts: remoteValueBundleApplyReadiness.conflicts
      };
    },
    async _performSync(opts = {}) {
      const { signal } = opts;
      const settings = await resolveSyncCredentialSettings(await SettingsManager.get());
      if (!settings.syncEnabled || settings.syncProvider === "none") return {};
      if (signal?.aborted) throw new Error("Sync aborted");
      const provider = this.providers[settings.syncProvider];
      if (!provider) return {};
      let valueBundleSync = null;
      const tombstoneData = await chrome.storage.local.get("syncTombstones");
      const tombstones = tombstoneData["syncTombstones"] ?? {};
      const scripts = await ScriptStorage.getAll();
      const localSyncScripts = scripts.map((s) => ({
        id: s.id,
        code: s.code,
        enabled: s.enabled,
        position: s.position,
        settings: cloneSyncSafeScriptSettings(s.settings),
        updatedAt: s.updatedAt,
        syncBaseCode: s.syncBaseCode ?? null
      }));
      const localValueBundleData = await buildValueBundlesForScripts(localSyncScripts);
      const localData = {
        version: 1,
        timestamp: Date.now(),
        scripts: localSyncScripts,
        tombstones,
        ...Object.keys(localValueBundleData.valueBundles).length > 0 ? { valueBundles: localValueBundleData.valueBundles } : {}
      };
      const remoteEnvelope = await provider.download(settings, { signal });
      const remoteData = await readSyncEnvelopeFromRemote(remoteEnvelope, settings);
      if (signal?.aborted) throw new Error("Sync aborted");
      if (remoteData) {
        const mergedTombstones = { ...tombstones, ...remoteData.tombstones ?? {} };
        const merged = this.mergeData(localData, remoteData);
        for (const tombstoneId of Object.keys(mergedTombstones)) {
          const tombstoneTs = mergedTombstones[tombstoneId];
          if (typeof tombstoneTs !== "number") continue;
          const candidate = merged.scripts.find((s) => s.id === tombstoneId);
          if (candidate && candidate.updatedAt > tombstoneTs) {
            delete mergedTombstones[tombstoneId];
          }
        }
        merged.scripts = merged.scripts.filter((script) => !mergedTombstones[script.id]);
        const remoteValueBundleSelection = selectApplicableRemoteValueBundles(remoteData, merged.scripts);
        if (Object.keys(remoteValueBundleSelection.valueBundles).length > 0 || remoteValueBundleSelection.ignored > 0 || remoteValueBundleSelection.warnings > 0) {
          debugLog("[CloudSync] Remote GM value bundles checked:", {
            applicable: Object.keys(remoteValueBundleSelection.valueBundles).length,
            ignored: remoteValueBundleSelection.ignored,
            warnings: remoteValueBundleSelection.warnings,
            applyEnabled: true,
            applyMode: "empty-local-only"
          });
        }
        let localMutated = false;
        for (const localScript of scripts) {
          if (!mergedTombstones[localScript.id]) continue;
          await deleteSyncedScript(localScript.id);
          localMutated = true;
        }
        for (const script of merged.scripts) {
          if (signal?.aborted) throw new Error("Sync aborted");
          if (mergedTombstones[script.id]) continue;
          const existing = await ScriptStorage.get(script.id);
          if (existing?.settings?.userModified) continue;
          const remoteScript = remoteData.scripts?.find((s) => s.id === script.id);
          let codeToSave = script.code;
          let mergeConflict = false;
          let didThreeWayMerge = false;
          if (existing && remoteScript && existing.code !== remoteScript.code) {
            const base = existing.syncBaseCode ?? null;
            if (base != null && base !== existing.code && base !== remoteScript.code) {
              try {
                const mergeResult = await mergeScriptText(base, existing.code, remoteScript.code);
                if (mergeResult && !mergeResult.error) {
                  codeToSave = mergeResult.merged ?? script.code;
                  mergeConflict = mergeResult.conflicts ?? false;
                  didThreeWayMerge = true;
                  debugLog(`[CloudSync] 3-way merge for ${script.id}: conflicts=${String(mergeConflict)}`);
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                debugLog("[CloudSync] 3-way merge failed, using timestamp winner:", msg);
              }
            }
          }
          const mergeChangedCode = didThreeWayMerge && existing != null && codeToSave !== existing.code;
          if (!existing || script.updatedAt > existing.updatedAt || mergeConflict || mergeChangedCode) {
            const parsed = parseUserscript(codeToSave);
            if (!parsed.error && parsed.meta) {
              const nextScript = {
                id: script.id,
                code: codeToSave,
                meta: parsed.meta,
                enabled: script.enabled,
                position: script.position,
                settings: mergeSyncedScriptSettings(existing?.settings, script.settings, {
                  mergeConflict
                }),
                updatedAt: Math.max(script.updatedAt, existing?.updatedAt ?? 0),
                createdAt: existing?.createdAt ?? script.updatedAt,
                syncBaseCode: codeToSave
                // record merged result as new base for future syncs
              };
              await ScriptStorage.set(script.id, nextScript);
              await refreshSyncedScriptRuntime(nextScript);
              localMutated = true;
            }
          }
        }
        if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
          await chrome.storage.local.set({ syncTombstones: mergedTombstones });
        }
        if (localMutated) {
          await updateBadgeIfAvailable();
        }
        const postMergeScripts = await ScriptStorage.getAll();
        const remoteValueApplyResult = await applyRemoteValueBundlesWhenLocalEmpty(
          remoteValueBundleSelection,
          postMergeScripts,
          localData.valueBundles ?? {}
        );
        valueBundleSync = summarizeRemoteValueBundleApplyResult(remoteValueApplyResult);
        if (remoteValueApplyResult.applied > 0 || remoteValueApplyResult.skippedNonEmpty > 0 || remoteValueApplyResult.skippedUserModified > 0 || remoteValueApplyResult.skippedUnavailable > 0 || remoteValueApplyResult.failures > 0) {
          debugLog("[CloudSync] Remote GM value bundles apply result:", {
            applied: remoteValueApplyResult.applied,
            skippedNonEmpty: remoteValueApplyResult.skippedNonEmpty,
            skippedUserModified: remoteValueApplyResult.skippedUserModified,
            skippedUnavailable: remoteValueApplyResult.skippedUnavailable,
            failures: remoteValueApplyResult.failures,
            preserved: Object.keys(remoteValueApplyResult.preservedValueBundles).length
          });
        }
        const uploadScripts = postMergeScripts.map((s) => ({
          id: s.id,
          code: s.code,
          enabled: s.enabled,
          position: s.position,
          settings: cloneSyncSafeScriptSettings(s.settings),
          updatedAt: s.updatedAt,
          syncBaseCode: s.syncBaseCode ?? null
        }));
        const postMergeValueBundleData = await buildValueBundlesForScripts(uploadScripts);
        const uploadValueBundles = {
          ...postMergeValueBundleData.valueBundles,
          ...remoteValueApplyResult.preservedValueBundles
        };
        const uploadData = {
          version: 1,
          timestamp: Date.now(),
          scripts: uploadScripts,
          tombstones: mergedTombstones,
          ...Object.keys(uploadValueBundles).length > 0 ? { valueBundles: uploadValueBundles } : {}
        };
        if (signal?.aborted) throw new Error("Sync aborted");
        await provider.upload(await prepareSyncEnvelopeForRemoteUpload(uploadData, settings), settings, { signal });
      } else {
        if (signal?.aborted) throw new Error("Sync aborted");
        localData.scripts = localData.scripts.map((s) => ({
          ...s,
          syncBaseCode: s.syncBaseCode ?? null
        }));
        await provider.upload(await prepareSyncEnvelopeForRemoteUpload(localData, settings), settings, { signal });
      }
      await SettingsManager.set("lastSync", Date.now());
      return {
        success: true,
        ...valueBundleSync ? { valueBundleSync } : {}
      };
    },
    mergeData(local, remote) {
      const scriptsMap = /* @__PURE__ */ new Map();
      for (const script of local.scripts || []) {
        scriptsMap.set(script.id, sanitizeSyncScriptForEnvelope(script));
      }
      for (const script of remote.scripts || []) {
        const existing = scriptsMap.get(script.id);
        if (!existing || script.updatedAt > existing.updatedAt) {
          scriptsMap.set(script.id, sanitizeSyncScriptForEnvelope(script));
        }
      }
      const mergedTombstones = {
        ...local.tombstones ?? {},
        ...remote.tombstones ?? {}
      };
      const merged = Array.from(scriptsMap.values()).filter(
        (s) => !mergedTombstones[s.id]
      );
      return {
        version: 1,
        timestamp: Date.now(),
        scripts: merged,
        tombstones: mergedTombstones
      };
    }
  };
  return module.exports.default || module.exports.CloudSync || module.exports;
})();

if (typeof self !== 'undefined') {
  self.CloudSync = CloudSync;
}
