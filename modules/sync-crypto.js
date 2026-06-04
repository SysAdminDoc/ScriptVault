// ============================================================================
// Generated from src/modules/sync-crypto.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SyncCrypto = (() => {
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

  // src/modules/sync-crypto.ts
  var sync_crypto_exports = {};
  __export(sync_crypto_exports, {
    SyncCrypto: () => SyncCrypto,
    default: () => sync_crypto_default
  });
  module.exports = __toCommonJS(sync_crypto_exports);
  var DEFAULT_KDF_ITERATIONS = 21e4;
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
    const key = await deriveAesGcmKey(
      getPassphrase(settings),
      salt,
      envelope.iterations || DEFAULT_KDF_ITERATIONS,
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
  var sync_crypto_default = SyncCrypto;
  return module.exports.default || module.exports.SyncCrypto || module.exports;
})();

if (typeof self !== 'undefined') {
  self.SyncCrypto = SyncCrypto;
}
