import { webcrypto } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SyncCrypto } from '../src/modules/sync-crypto.ts';

const fastEncryptedSettings = {
  syncEncryptionEnabled: true,
  syncEncryptionPassphrase: 'correct horse battery staple',
  syncEncryptionKdfIterations: 2,
};

const originalCrypto = globalThis.crypto;

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
});

afterAll(() => {
  Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
});

describe('sync crypto helper', () => {
  it('round-trips a v1 sync envelope through PBKDF2 and AES-256-GCM', async () => {
    const envelope = {
      version: 1,
      timestamp: 123,
      scripts: [
        {
          id: 'script_secret',
          code: 'const apiKey = "secret-api-key";',
          enabled: true,
          position: 0,
          settings: {},
          updatedAt: 123,
        },
      ],
      tombstones: { script_deleted: 456 },
    };

    const encrypted = await SyncCrypto.prepareSyncEnvelopeForUpload(envelope, fastEncryptedSettings);
    expect(encrypted).toEqual(
      expect.objectContaining({
        version: 2,
        encrypted: true,
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA-256',
      }),
    );
    expect(JSON.stringify(encrypted)).not.toContain('secret-api-key');

    await expect(SyncCrypto.decryptSyncEnvelope(encrypted, fastEncryptedSettings)).resolves.toEqual(envelope);
  });

  it('rejects an encrypted envelope with the wrong passphrase', async () => {
    const encrypted = await SyncCrypto.prepareSyncEnvelopeForUpload(
      {
        version: 1,
        timestamp: 1,
        scripts: [],
        tombstones: {},
      },
      fastEncryptedSettings,
    );

    await expect(
      SyncCrypto.decryptSyncEnvelope(encrypted, {
        ...fastEncryptedSettings,
        syncEncryptionPassphrase: 'wrong passphrase',
      }),
    ).rejects.toThrow('Unable to decrypt sync data');
  });

  it('keeps plaintext v1 envelopes readable when encryption is enabled for the next upload', async () => {
    const plaintext = {
      version: 1,
      timestamp: 10,
      scripts: [],
      tombstones: {},
    };

    await expect(SyncCrypto.decryptSyncEnvelope(plaintext, fastEncryptedSettings)).resolves.toEqual(plaintext);

    const uploaded = await SyncCrypto.prepareSyncEnvelopeForUpload(plaintext, fastEncryptedSettings);
    expect(uploaded).toEqual(expect.objectContaining({ version: 2, encrypted: true }));
  });

  it('leaves upload envelopes as plaintext when sync encryption is disabled', async () => {
    const plaintext = {
      version: 1,
      timestamp: 10,
      scripts: [],
      tombstones: {},
    };

    await expect(
      SyncCrypto.prepareSyncEnvelopeForUpload(plaintext, {
        syncEncryptionEnabled: false,
        syncEncryptionPassphrase: '',
      }),
    ).resolves.toEqual(plaintext);
  });
});
