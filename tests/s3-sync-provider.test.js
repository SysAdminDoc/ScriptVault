// S3-compatible sync provider tests. Exercises the runtime provider object
// from modules/sync-providers.js against a mock fetch that emulates an
// S3-compatible server (R2 / MinIO / AWS). Validates settings, URL
// construction (path-style + virtual-host), AWS SigV4 header shape, and
// the upload/download/test round-trip.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const code = readFileSync(resolve(process.cwd(), 'modules/sync-providers.js'), 'utf8');
// Node's `webcrypto` ships `subtle.importKey` + `subtle.sign` + `subtle.digest`.
// The shared tests/setup.js installs a minimal crypto stub that does not have
// `subtle`; route the provider through the real Web Crypto here so SigV4 is
// actually exercised.
const realCrypto = webcrypto;

function loadProviders({ fetchImpl, settingsManager } = {}) {
  const fakeFetch = vi.fn(fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })));
  const SettingsManager = settingsManager || {
    get: vi.fn(async () => ({})),
    set: vi.fn(async () => {}),
  };
  // Provide a chrome.identity stub for OAuth providers we don't exercise.
  const chrome = {
    identity: {
      launchWebAuthFlow: vi.fn(async () => ''),
      getRedirectURL: vi.fn(() => 'https://test.chromiumapp.org/'),
    },
    storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) } },
    runtime: { id: 'test', getManifest: () => ({ version: '0' }) },
  };
  const fn = new Function(
    'fetch',
    'SettingsManager',
    'chrome',
    'crypto',
    'btoa',
    'TextEncoder',
    'console',
    `${code}\nreturn CloudSyncProviders;`,
  );
  return {
    providers: fn(fakeFetch, SettingsManager, chrome, realCrypto, globalThis.btoa, globalThis.TextEncoder, console),
    fakeFetch,
    SettingsManager,
  };
}

function validSettings(overrides = {}) {
  return {
    s3Endpoint: 'https://s3.us-east-1.amazonaws.com',
    s3Region: 'us-east-1',
    s3Bucket: 'scriptvault-backups',
    s3AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    s3SecretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    s3ObjectKey: 'scriptvault-backup.json',
    ...overrides,
  };
}

describe('S3 provider — validation', () => {
  let providers;
  beforeEach(() => { ({ providers } = loadProviders()); });

  it('passes validation with a full settings object', () => {
    const result = providers.s3.validate(validSettings());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when endpoint missing', () => {
    const result = providers.s3.validate(validSettings({ s3Endpoint: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 's3Endpoint')).toBe(true);
  });

  it('rejects endpoint URLs with a path component', () => {
    const result = providers.s3.validate(validSettings({ s3Endpoint: 'https://s3.example.com/some/path' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /must not include a path/i.test(e.error))).toBe(true);
  });

  it('rejects bucket names that violate the basic naming rule', () => {
    const result = providers.s3.validate(validSettings({ s3Bucket: 'a' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 's3Bucket')).toBe(true);
  });

  it('requires both access key and secret', () => {
    const noKey = providers.s3.validate(validSettings({ s3AccessKeyId: '' }));
    const noSecret = providers.s3.validate(validSettings({ s3SecretKey: '' }));
    expect(noKey.valid).toBe(false);
    expect(noSecret.valid).toBe(false);
  });
});

describe('S3 provider — URL construction', () => {
  let providers;
  beforeEach(() => { ({ providers } = loadProviders()); });

  it('uses virtual-host style on amazonaws.com hosts', () => {
    const url = providers.s3._buildObjectUrl(validSettings(), 'scriptvault-backup.json');
    expect(url).toContain('//scriptvault-backups.s3.us-east-1.amazonaws.com/');
    expect(url).toMatch(/\/scriptvault-backup\.json$/);
  });

  it('uses path-style for non-AWS endpoints (Cloudflare R2, MinIO, B2)', () => {
    const url = providers.s3._buildObjectUrl(validSettings({
      s3Endpoint: 'https://account.r2.cloudflarestorage.com',
    }), 'scriptvault-backup.json');
    expect(url).toContain('//account.r2.cloudflarestorage.com/scriptvault-backups/');
    expect(url).toMatch(/\/scriptvault-backup\.json$/);
  });

  it('forces path-style when s3PathStyle:true is set explicitly', () => {
    const url = providers.s3._buildObjectUrl(validSettings({ s3PathStyle: true }), 'scriptvault-backup.json');
    expect(url).toContain('//s3.us-east-1.amazonaws.com/scriptvault-backups/');
  });
});

describe('S3 provider — SigV4 signing', () => {
  let providers;
  beforeEach(() => { ({ providers } = loadProviders()); });

  it('produces an Authorization header with the expected algorithm + credential scope shape', async () => {
    const signed = await providers.s3._signRequest({
      method: 'PUT',
      url: 'https://scriptvault-backups.s3.us-east-1.amazonaws.com/scriptvault-backup.json',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      body: '{"a":1}',
      contentType: 'application/json',
    });
    expect(signed.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(signed.headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/);
    expect(signed.headers['content-type']).toBe('application/json');
  });

  it('produces a deterministic SHA-256 hex of the payload (matches Web Crypto)', async () => {
    const hex = await providers.s3._sha256Hex('hello');
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(hex).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('S3 provider — upload/download round trip against a mock server', () => {
  it('rejects internal-host endpoints before signing or fetching by default', async () => {
    const fetchImpl = async () => {
      throw new Error('should not fetch');
    };
    const { providers, fakeFetch } = loadProviders({ fetchImpl });

    const internalEndpoints = [
      'http://127.0.0.1:9000',
      'http://169.254.169.254',
      'http://192.168.1.20:9000',
      'http://[fd12:3456:789a::1]:9000',
    ];

    for (const s3Endpoint of internalEndpoints) {
      await expect(providers.s3.upload({ data: 1 }, validSettings({
        s3Endpoint,
        s3PathStyle: true,
      }))).rejects.toThrow(/S3 sync endpoint URL rejected: internal host/);
    }

    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('allows internal-host endpoints only with explicit sync endpoint opt-in', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, url: '', json: async () => ({}), text: async () => '' };
    };
    const { providers, fakeFetch } = loadProviders({ fetchImpl });
    const result = await providers.s3.upload({ data: 1 }, validSettings({
      s3Endpoint: 'http://127.0.0.1:9000',
      s3PathStyle: true,
      allowInternalSyncEndpoints: true,
    }));

    expect(result.success).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe('http://127.0.0.1:9000/scriptvault-backups/scriptvault-backup.json');
  });

  it('rejects S3 redirects into internal hosts before reading the body', async () => {
    const jsonSpy = vi.fn(async () => ({ data: { scripts: [] } }));
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      url: 'http://169.254.169.254/latest/meta-data/',
      json: jsonSpy,
      text: async () => '',
    });
    const { providers } = loadProviders({ fetchImpl });

    await expect(providers.s3.download(validSettings()))
      .rejects.toThrow(/S3 sync endpoint redirected to internal host: internal host/);
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('uploads via PUT with the signed Authorization header', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    };
    const { providers, fakeFetch } = loadProviders({ fetchImpl });
    const result = await providers.s3.upload({ data: 1 }, validSettings());
    expect(result.success).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toContain('//scriptvault-backups.s3.us-east-1.amazonaws.com/scriptvault-backup.json');
    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].init.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/);
  });

  it('downloads via GET and returns parsed JSON', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { scripts: [], timestamp: 1 } }),
      text: async () => '',
    });
    const { providers } = loadProviders({ fetchImpl });
    const out = await providers.s3.download(validSettings());
    expect(out).toEqual({ data: { scripts: [], timestamp: 1 } });
  });

  it('returns null on 404 (no backup yet)', async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
    const { providers } = loadProviders({ fetchImpl });
    expect(await providers.s3.download(validSettings())).toBeNull();
  });

  it('raises a structured error on 403 forbidden', async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({}), text: async () => '<Error><Code>AccessDenied</Code></Error>' });
    const { providers } = loadProviders({ fetchImpl });
    await expect(providers.s3.download(validSettings())).rejects.toThrow(/HTTP 403/);
  });

  it('test() succeeds when HEAD returns 200', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
    const { providers } = loadProviders({ fetchImpl });
    expect(await providers.s3.test(validSettings())).toEqual({ success: true });
  });

  it('test() also succeeds on 404 (bucket reachable, no backup yet)', async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
    const { providers } = loadProviders({ fetchImpl });
    expect(await providers.s3.test(validSettings())).toEqual({ success: true });
  });

  it('test() fails on 401 with a structured error message', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => '' });
    const { providers } = loadProviders({ fetchImpl });
    const result = await providers.s3.test(validSettings());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/HTTP 401/);
  });
});

describe('S3 provider — disclosure + status', () => {
  it('reports stored secrets via getStorageDisclosure', () => {
    const { providers } = loadProviders();
    const disclosure = providers.s3.getStorageDisclosure(validSettings());
    expect(disclosure.hasStoredSecrets).toBe(true);
    const fields = Object.fromEntries(disclosure.fields.map(f => [f.key, f]));
    expect(fields.s3SecretKey.type).toBe('credential');
    expect(fields.s3SecretKey.present).toBe(true);
    expect(fields.s3Endpoint.type).toBe('metadata');
  });

  it('returns missing_config status when validation fails', async () => {
    const { providers } = loadProviders();
    const status = await providers.s3.getStatus(validSettings({ s3Bucket: '' }));
    expect(status.connected).toBe(false);
    expect(status.status).toBe('missing_config');
  });

  it('returns ok status when the bucket HEAD succeeds', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
    const { providers } = loadProviders({ fetchImpl });
    const status = await providers.s3.getStatus(validSettings());
    expect(status.connected).toBe(true);
    expect(status.status).toBe('ok');
    expect(status.user.name).toBe('scriptvault-backups@s3.us-east-1.amazonaws.com');
  });

  it('disconnect clears all stored credentials', async () => {
    const settingsSet = vi.fn(async () => {});
    const settingsManager = { get: vi.fn(async () => ({})), set: settingsSet };
    const { providers } = loadProviders({ settingsManager });
    await providers.s3.disconnect();
    expect(settingsSet).toHaveBeenCalledWith(expect.objectContaining({
      s3Endpoint: '',
      s3Region: '',
      s3Bucket: '',
      s3AccessKeyId: '',
      s3SecretKey: '',
      s3ObjectKey: '',
    }));
  });
});
