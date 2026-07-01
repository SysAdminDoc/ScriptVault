// ============================================================================
// Sync Crypto - optional client-side encryption for cloud sync payloads
// ============================================================================

export interface PlainSyncEnvelope {
  version: number;
  timestamp: number;
  scripts: unknown[];
  tombstones: Record<string, unknown>;
}

export interface EncryptedSyncEnvelope {
  version: 2;
  encrypted: true;
  format: 'scriptvault-sync-e2ee';
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  timestamp: number;
}

export type RemoteSyncEnvelope = PlainSyncEnvelope | EncryptedSyncEnvelope;

export interface SyncCryptoSettings {
  syncEncryptionEnabled?: boolean;
  syncEncryptionPassphrase?: string;
  syncEncryptionKdfIterations?: number;
}

const DEFAULT_KDF_ITERATIONS = 210_000;
// Upper bound applied to a remote envelope's declared iteration count on
// decrypt. A forged envelope could otherwise set iterations to e.g. 1e9 and
// pin the service worker in PBKDF2 for minutes on every sync attempt (DoS).
// Legitimate envelopes are written with DEFAULT_KDF_ITERATIONS or the user's
// configured value; 10M leaves generous headroom above any real setting.
const MAX_KDF_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function getCryptoApi(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto is not available for sync encryption');
  }
  return cryptoApi;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === 'function') return btoa(binary);
  const bufferCtor = (globalThis as typeof globalThis & {
    Buffer?: { from(value: Uint8Array): { toString(encoding: string): string } };
  }).Buffer;
  if (bufferCtor) return bufferCtor.from(bytes).toString('base64');
  throw new Error('Base64 encoding is not available for sync encryption');
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const bufferCtor = (globalThis as typeof globalThis & {
    Buffer?: { from(value: string, encoding: string): Uint8Array };
  }).Buffer;
  if (bufferCtor) return new Uint8Array(bufferCtor.from(value, 'base64'));
  throw new Error('Base64 decoding is not available for sync encryption');
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCryptoApi().getRandomValues(bytes);
  return bytes;
}

function resolveIterations(settings: SyncCryptoSettings): number {
  const configured = settings.syncEncryptionKdfIterations;
  return Number.isFinite(configured) && configured && configured > 0
    ? Math.floor(configured)
    : DEFAULT_KDF_ITERATIONS;
}

function getPassphrase(settings: SyncCryptoSettings): string {
  const passphrase = settings.syncEncryptionPassphrase;
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('Sync encryption passphrase is required');
  }
  return passphrase;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePlainSyncEnvelope(envelope: PlainSyncEnvelope): PlainSyncEnvelope {
  return {
    ...envelope,
    version: typeof envelope.version === 'number' ? envelope.version : 1,
    timestamp: typeof envelope.timestamp === 'number' ? envelope.timestamp : Date.now(),
    scripts: Array.isArray(envelope.scripts) ? envelope.scripts : [],
    tombstones: isObject(envelope.tombstones) ? envelope.tombstones : {},
  };
}

function isEncryptedSyncEnvelope(value: unknown): value is EncryptedSyncEnvelope {
  return isObject(value)
    && (value.encrypted === true || value.version === 2)
    && typeof value.ciphertext === 'string'
    && typeof value.salt === 'string'
    && typeof value.iv === 'string';
}

function isEncryptionEnabled(settings: SyncCryptoSettings): boolean {
  return settings.syncEncryptionEnabled === true;
}

async function deriveAesGcmKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const cryptoApi = getCryptoApi();
  const passphraseBytes = TEXT_ENCODER.encode(passphrase);
  const material = await cryptoApi.subtle.importKey(
    'raw',
    bytesToArrayBuffer(passphraseBytes),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: bytesToArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

async function encryptSyncEnvelope(
  envelope: PlainSyncEnvelope,
  settings: SyncCryptoSettings,
): Promise<EncryptedSyncEnvelope> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const iterations = resolveIterations(settings);
  const key = await deriveAesGcmKey(getPassphrase(settings), salt, iterations, ['encrypt']);
  const plaintext = TEXT_ENCODER.encode(JSON.stringify(normalizePlainSyncEnvelope(envelope)));
  const ciphertext = new Uint8Array(await getCryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
    key,
    bytesToArrayBuffer(plaintext),
  ));

  return {
    version: 2,
    encrypted: true,
    format: 'scriptvault-sync-e2ee',
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    timestamp: Date.now(),
  };
}

async function decryptSyncEnvelope(
  envelope: RemoteSyncEnvelope | null | undefined,
  settings: SyncCryptoSettings,
): Promise<PlainSyncEnvelope | null> {
  if (!envelope) return null;
  if (!isEncryptedSyncEnvelope(envelope)) {
    return normalizePlainSyncEnvelope(envelope as PlainSyncEnvelope);
  }

  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const declaredIterations = envelope.iterations || DEFAULT_KDF_ITERATIONS;
  if (!Number.isFinite(declaredIterations) || declaredIterations <= 0
      || declaredIterations > MAX_KDF_ITERATIONS) {
    throw new Error('Sync envelope declares an out-of-range KDF iteration count.');
  }
  const key = await deriveAesGcmKey(
    getPassphrase(settings),
    salt,
    declaredIterations,
    ['decrypt'],
  );

  try {
    const plaintext = await getCryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
      key,
      bytesToArrayBuffer(base64ToBytes(envelope.ciphertext)),
    );
    const parsed = JSON.parse(TEXT_DECODER.decode(plaintext)) as PlainSyncEnvelope;
    if (!isObject(parsed)) {
      throw new Error('Decrypted sync payload is not an object');
    }
    return normalizePlainSyncEnvelope(parsed);
  } catch (_e) {
    throw new Error('Unable to decrypt sync data. Check the sync encryption passphrase.');
  }
}

async function prepareSyncEnvelopeForUpload(
  envelope: PlainSyncEnvelope,
  settings: SyncCryptoSettings,
): Promise<RemoteSyncEnvelope> {
  const normalized = normalizePlainSyncEnvelope(envelope);
  return isEncryptionEnabled(settings)
    ? encryptSyncEnvelope(normalized, settings)
    : normalized;
}

export const SyncCrypto = {
  DEFAULT_KDF_ITERATIONS,
  isEncryptedSyncEnvelope,
  isEncryptionEnabled,
  encryptSyncEnvelope,
  decryptSyncEnvelope,
  prepareSyncEnvelopeForUpload,
};

export default SyncCrypto;
