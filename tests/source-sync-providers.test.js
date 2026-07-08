import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.__resetStorageMock();
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, 'SettingsManager');
  Reflect.deleteProperty(globalThis, 'LocalWorkspaceBindings');
});

function createNotFoundError() {
  const error = new Error('File not found');
  error.name = 'NotFoundError';
  return error;
}

class FakeLocalFolderFileHandle {
  constructor(directory, name) {
    this.directory = directory;
    this.name = name;
  }

  async getFile() {
    if (!this.directory.files.has(this.name)) throw createNotFoundError();
    const text = this.directory.files.get(this.name);
    return {
      size: text.length,
      lastModified: 123456,
      text: async () => text,
    };
  }

  async createWritable() {
    let nextText = '';
    return {
      write: async (data) => {
        nextText = String(data);
      },
      close: async () => {
        this.directory.files.set(this.name, nextText);
      },
    };
  }
}

class FakeLocalFolderDirectoryHandle {
  constructor({ name = 'Vault Sync', permission = 'granted' } = {}) {
    this.kind = 'directory';
    this.name = name;
    this.permission = permission;
    this.files = new Map();
  }

  async queryPermission() {
    return this.permission;
  }

  async requestPermission() {
    return this.permission;
  }

  async getFileHandle(name, options = {}) {
    if (!options.create && !this.files.has(name)) throw createNotFoundError();
    return new FakeLocalFolderFileHandle(this, name);
  }
}

function installLocalFolderBinding(directory = new FakeLocalFolderDirectoryHandle()) {
  let record = {
    bindingId: 'sync_local_folder',
    scriptId: '__scriptvault_sync__',
    displayName: directory.name,
    handle: directory,
  };
  const LocalWorkspaceBindings = {
    get: vi.fn(async (bindingId) => (bindingId === 'sync_local_folder' && record
      ? { bindingId: record.bindingId, scriptId: record.scriptId, displayName: record.displayName }
      : null)),
    getHandle: vi.fn(async (bindingId) => (bindingId === 'sync_local_folder' && record ? record.handle : null)),
    delete: vi.fn(async (bindingId) => {
      if (bindingId === 'sync_local_folder') record = null;
    }),
  };
  globalThis.LocalWorkspaceBindings = LocalWorkspaceBindings;
  return { directory, LocalWorkspaceBindings };
}

async function loadFreshSyncProviders() {
  vi.resetModules();

  const settingsState = {
    dropboxToken: 'dropbox-token',
    dropboxRefreshToken: 'dropbox-refresh',
    dropboxUser: { email: 'user@example.com', name: 'Dropbox User' },
    googleDriveToken: '',
    googleDriveRefreshToken: '',
    googleDriveConnected: false,
    googleDriveUser: null,
    onedriveToken: '',
    onedriveRefreshToken: '',
    onedriveConnected: false,
    onedriveUser: null,
    syncCredentialsSessionOnly: false,
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    googleClientId: '',
    dropboxClientId: '',
    onedriveClientId: '',
  };

  const SettingsManager = {
    get: vi.fn(async () => structuredClone(settingsState)),
    set: vi.fn(async (key, value) => {
      if (typeof key === 'object') {
        Object.assign(settingsState, key);
      } else {
        settingsState[key] = value;
      }
      return structuredClone(settingsState);
    }),
  };

  globalThis.SettingsManager = SettingsManager;

  vi.doMock('../src/modules/storage.ts', () => ({ SettingsManager }));

  const mod = await import('../src/modules/sync-providers.ts');
  return {
    CloudSyncProviders: mod.CloudSyncProviders,
    SyncCredentialStore: mod.SyncCredentialStore,
    settingsState,
    SettingsManager,
  };
}

describe('source sync providers module', () => {
  it('returns a clear validation error when WebDAV testing is attempted without a URL', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.webdav.test({
      webdavUrl: '   ',
      webdavUsername: 'alice',
      webdavPassword: 'secret',
    });

    expect(result).toEqual({
      success: false,
      error: 'WebDAV URL is required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from WebDAV URLs before upload', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.webdav.upload(
      { scripts: [] },
      {
        webdavUrl: '  https://dav.example.com/backups/  ',
        webdavUsername: 'alice',
        webdavPassword: 'secret',
      },
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dav.example.com/backups/scriptvault-backup.json',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('aborts WebDAV upload fetches when the sync signal aborts', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const controller = new AbortController();
    const fetchMock = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));
    globalThis.fetch = fetchMock;

    const upload = CloudSyncProviders.webdav.upload(
      { scripts: [] },
      {
        webdavUrl: 'https://dav.example.com/backups',
        webdavUsername: 'alice',
        webdavPassword: 'secret',
      },
      { signal: controller.signal },
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    controller.abort();

    await expect(upload).rejects.toThrow(/aborted/i);
  });

  it('uses WebDAV ETags as same-object upload preconditions', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ scripts: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: '"webdav-v1"' },
      }))
      .mockResolvedValueOnce(new Response('', { status: 201, headers: { ETag: '"webdav-v2"' } }))
      .mockResolvedValueOnce(new Response('', { status: 201, headers: { ETag: '"cloud-v1"' } }));
    globalThis.fetch = fetchMock;

    await expect(CloudSyncProviders.webdav.download({
      webdavUrl: 'https://dav.example.com/backups',
      webdavUsername: 'alice',
      webdavPassword: 'secret',
    })).resolves.toEqual({ scripts: [] });

    await expect(CloudSyncProviders.webdav.upload(
      { scripts: [] },
      {
        webdavUrl: 'https://dav.example.com/backups',
        webdavUsername: 'alice',
        webdavPassword: 'secret',
      },
    )).resolves.toEqual(expect.objectContaining({ success: true }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://dav.example.com/backups/scriptvault-backup.json',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'If-Match': '"webdav-v1"' }),
      }),
    );

    await expect(CloudSyncProviders.webdav.upload(
      { schema: 'scriptvault-cloud-backup/v1' },
      {
        webdavUrl: 'https://dav.example.com/backups',
        webdavUsername: 'alice',
        webdavPassword: 'secret',
      },
      { objectName: 'scriptvault-cloud-backup.json' },
    )).resolves.toEqual(expect.objectContaining({ success: true }));

    const overrideHeaders = fetchMock.mock.calls[2][1].headers;
    expect(overrideHeaders).not.toHaveProperty('If-Match');
    expect(overrideHeaders).not.toHaveProperty('If-None-Match');
  });

  it('uses explicit object names for cloud backup upload/download without clobbering sync', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock;

    // Sync (no objectName option) writes the default object.
    await CloudSyncProviders.webdav.upload(
      { scripts: [] },
      { webdavUrl: 'https://dav.example.com/', webdavUsername: 'a', webdavPassword: 'b' },
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://dav.example.com/scriptvault-backup.json',
      expect.objectContaining({ method: 'PUT' }),
    );

    // Cloud backup writes a DISTINCT object through a per-call option.
    await CloudSyncProviders.webdav.upload(
      { schema: 'scriptvault-cloud-backup/v1' },
      {
        webdavUrl: 'https://dav.example.com/',
        webdavUsername: 'a',
        webdavPassword: 'b',
      },
      { objectName: 'scriptvault-cloud-backup.json' },
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://dav.example.com/scriptvault-cloud-backup.json',
      expect.objectContaining({ method: 'PUT' }),
    );

    // A traversal-laden override is sanitized to a bare filename.
    await CloudSyncProviders.webdav.upload(
      { schema: 'x' },
      {
        webdavUrl: 'https://dav.example.com/',
        webdavUsername: 'a',
        webdavPassword: 'b',
      },
      { objectName: '../../etc/passwd' },
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://dav.example.com/etcpasswd',
      expect.objectContaining({ method: 'PUT' }),
    );

    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ schema: 'scriptvault-cloud-backup/v1' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    await expect(CloudSyncProviders.webdav.download(
      { webdavUrl: 'https://dav.example.com/', webdavUsername: 'a', webdavPassword: 'b' },
      { objectName: 'scriptvault-cloud-backup.json' },
    )).resolves.toEqual({ schema: 'scriptvault-cloud-backup/v1' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://dav.example.com/scriptvault-cloud-backup.json',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects internal-host WebDAV endpoints before network I/O by default', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock;

    const internalEndpoints = [
      'http://127.0.0.1:8080/backups',
      'http://169.254.169.254/latest',
      'http://192.168.1.20/dav',
      'http://[fd12:3456:789a::1]/dav',
    ];

    for (const webdavUrl of internalEndpoints) {
      await expect(CloudSyncProviders.webdav.upload(
        { scripts: [] },
        {
          webdavUrl,
          webdavUsername: 'alice',
          webdavPassword: 'secret',
        },
      )).rejects.toThrow(/WebDAV sync endpoint URL rejected: internal host/);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows internal-host WebDAV endpoints only with explicit sync endpoint opt-in', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.webdav.upload(
      { scripts: [] },
      {
        webdavUrl: 'http://127.0.0.1:8080/backups',
        webdavUsername: 'alice',
        webdavPassword: 'secret',
        allowInternalSyncEndpoints: true,
      },
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/backups/scriptvault-backup.json',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('rejects WebDAV redirects into internal hosts before reading the response', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const redirected = new Response('{}', { status: 200 });
    Object.defineProperty(redirected, 'url', {
      value: 'http://169.254.169.254/latest/meta-data/',
      configurable: true,
    });
    const fetchMock = vi.fn().mockResolvedValue(redirected);
    globalThis.fetch = fetchMock;

    await expect(CloudSyncProviders.webdav.download({
      webdavUrl: 'https://dav.example.com/backups',
      webdavUsername: 'alice',
      webdavPassword: 'secret',
    })).rejects.toThrow(/WebDAV sync endpoint redirected to internal host: internal host/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('encodes Unicode WebDAV credentials without crashing Basic Auth generation', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock;

    const expectedAuth = `Basic ${btoa(
      String.fromCharCode(...new TextEncoder().encode('alíce:sëcret')),
    )}`;

    const result = await CloudSyncProviders.webdav.upload(
      { scripts: [] },
      {
        webdavUrl: 'https://dav.example.com/backups',
        webdavUsername: 'alíce',
        webdavPassword: 'sëcret',
      },
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dav.example.com/backups/scriptvault-backup.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expectedAuth,
        }),
      }),
    );
  });

  it('exposes WebDAV health, storage disclosure, and local credential clearing', async () => {
    const { CloudSyncProviders, settingsState, SettingsManager } = await loadFreshSyncProviders();
    Object.assign(settingsState, {
      webdavUrl: 'https://dav.example.com/backups',
      webdavUsername: 'alice',
      webdavPassword: 'secret',
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 207 }));
    globalThis.fetch = fetchMock;

    const status = await CloudSyncProviders.webdav.getStatus(settingsState);
    const disclosure = CloudSyncProviders.webdav.getStorageDisclosure(settingsState);
    const result = await CloudSyncProviders.webdav.disconnect();

    expect(status).toEqual({
      connected: true,
      status: 'ok',
      error: null,
      user: { email: '', name: 'alice' },
      endpointHost: 'dav.example.com',
    });
    expect(disclosure.storage).toBe('chrome.storage.local');
    expect(disclosure.hasStoredSecrets).toBe(true);
    expect(disclosure.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'webdavPassword', present: true, type: 'credential' }),
      ]),
    );
    expect(result).toEqual({ success: true });
    expect(SettingsManager.set).toHaveBeenCalledWith({
      webdavUrl: '',
      webdavUsername: '',
      webdavPassword: '',
    });
  });

  it('stores WebDAV credentials in chrome.storage.session when session-only mode is enabled', async () => {
    const { CloudSyncProviders, SyncCredentialStore, settingsState } = await loadFreshSyncProviders();

    await SyncCredentialStore.persistSettingsUpdate({
      syncCredentialsSessionOnly: true,
      webdavUrl: 'https://dav.example.com/backups',
      webdavUsername: 'alice',
      webdavPassword: 'secret',
      syncEncryptionPassphrase: 'vault passphrase',
    });

    expect(settingsState.syncCredentialsSessionOnly).toBe(true);
    expect(settingsState.webdavUrl).toBe('');
    expect(settingsState.webdavUsername).toBe('');
    expect(settingsState.webdavPassword).toBe('');
    expect(settingsState.syncEncryptionPassphrase).toBe('');

    const session = await chrome.storage.session.get(SyncCredentialStore.sessionKey);
    expect(session[SyncCredentialStore.sessionKey]).toMatchObject({
      webdavUrl: 'https://dav.example.com/backups',
      webdavUsername: 'alice',
      webdavPassword: 'secret',
      syncEncryptionPassphrase: 'vault passphrase',
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock;
    await CloudSyncProviders.webdav.upload({ scripts: [] }, settingsState);

    const expectedAuth = `Basic ${btoa('alice:secret')}`;
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dav.example.com/backups/scriptvault-backup.json',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expectedAuth }),
      }),
    );

    const effective = await SyncCredentialStore.resolveSettings(settingsState);
    const disclosure = CloudSyncProviders.webdav.getStorageDisclosure(effective);
    expect(disclosure.storage).toBe('chrome.storage.session');
    expect(disclosure.credentialStorageMode).toBe('session');
    expect(disclosure.reconnectRequired).toBe(true);
    expect(JSON.stringify(settingsState)).not.toContain('secret');
  });

  it('exports Google Drive under both legacy and current provider keys', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();

    expect(CloudSyncProviders.google).toBe(CloudSyncProviders.googledrive);
    expect(CloudSyncProviders.google.name).toBe('Google Drive');
  });

  it('round-trips sync envelopes through the local folder provider', async () => {
    const { directory, LocalWorkspaceBindings } = installLocalFolderBinding();
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const envelope = {
      version: 1,
      timestamp: 42,
      scripts: [
        {
          id: 'script_alpha',
          code: '// ==UserScript==\n// @name Alpha\n// ==/UserScript==\nconsole.log("alpha");',
          enabled: true,
          position: 0,
          settings: { syncValues: true },
          updatedAt: 42,
          syncBaseCode: '// base',
        },
      ],
      tombstones: {},
      valueBundles: {
        script_alpha: {
          values: { key: 'value' },
          keyMetadata: {
            key: { updatedAt: 42, updatedBy: 'script' },
          },
        },
      },
    };

    const upload = await CloudSyncProviders.localfolder.upload(envelope, {});
    const storedText = directory.files.get('scriptvault-backup.json');
    const download = await CloudSyncProviders.localfolder.download({});
    const status = await CloudSyncProviders.localfolder.getStatus();
    const disconnect = await CloudSyncProviders.localfolder.disconnect();

    expect(upload).toEqual({ success: true, timestamp: expect.any(Number) });
    expect(JSON.parse(storedText)).toEqual(envelope);
    expect(download).toEqual(envelope);
    expect(status).toEqual({
      connected: true,
      status: 'ok',
      error: null,
      user: { email: '', name: 'Vault Sync' },
    });
    expect(disconnect).toEqual({ success: true });
    expect(LocalWorkspaceBindings.delete).toHaveBeenCalledWith('sync_local_folder');
  });

  it('returns null for an empty local sync folder and reports missing bindings clearly', async () => {
    installLocalFolderBinding();
    const { CloudSyncProviders } = await loadFreshSyncProviders();

    await expect(CloudSyncProviders.localfolder.download({})).resolves.toBeNull();

    await CloudSyncProviders.localfolder.disconnect();
    await expect(CloudSyncProviders.localfolder.download({})).rejects.toThrow(
      'Choose a local sync folder before syncing',
    );
    await expect(CloudSyncProviders.localfolder.getStatus()).resolves.toMatchObject({
      connected: false,
      status: 'not_configured',
    });
  });

  it('discloses OAuth token storage fields without exposing token values', async () => {
    const { CloudSyncProviders, settingsState } = await loadFreshSyncProviders();
    Object.assign(settingsState, {
      googleDriveToken: 'super-secret-google-token',
      googleDriveRefreshToken: 'super-secret-google-refresh',
      dropboxToken: 'super-secret-dropbox-token',
      onedriveRefreshToken: 'super-secret-onedrive-refresh',
    });

    const google = CloudSyncProviders.googledrive.getStorageDisclosure(settingsState);
    const dropbox = CloudSyncProviders.dropbox.getStorageDisclosure(settingsState);
    const onedrive = CloudSyncProviders.onedrive.getStorageDisclosure(settingsState);
    const serialized = JSON.stringify({ google, dropbox, onedrive });

    expect(google.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'googleDriveToken', type: 'token', present: true }),
        expect.objectContaining({ key: 'googleDriveRefreshToken', type: 'token', present: true }),
      ]),
    );
    expect(dropbox.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'dropboxToken', type: 'token', present: true }),
      ]),
    );
    expect(onedrive.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'onedriveRefreshToken', type: 'token', present: true }),
      ]),
    );
    expect(serialized).not.toContain('super-secret-google-token');
    expect(serialized).not.toContain('super-secret-dropbox-token');
    expect(serialized).not.toContain('super-secret-onedrive-refresh');
  });

  it('keeps refreshed OAuth tokens out of persistent settings in session-only mode', async () => {
    const { CloudSyncProviders, SyncCredentialStore, settingsState } = await loadFreshSyncProviders();
    await SyncCredentialStore.persistSettingsUpdate({
      syncCredentialsSessionOnly: true,
      googleDriveRefreshToken: 'google-refresh-token',
      googleClientId: 'google-client-id',
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'fresh-google-token',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    globalThis.fetch = fetchMock;

    const token = await CloudSyncProviders.googledrive.refreshToken(settingsState);

    expect(token).toBe('fresh-google-token');
    expect(settingsState.googleDriveToken).toBe('');
    expect(settingsState.googleDriveRefreshToken).toBe('');
    expect(JSON.stringify(settingsState)).not.toContain('fresh-google-token');

    const session = await chrome.storage.session.get(SyncCredentialStore.sessionKey);
    expect(session[SyncCredentialStore.sessionKey]).toMatchObject({
      googleDriveToken: 'fresh-google-token',
      googleDriveRefreshToken: 'google-refresh-token',
      googleClientId: 'google-client-id',
    });
  });

  it('clears session and persistent OAuth credentials on disconnect', async () => {
    const { CloudSyncProviders, SyncCredentialStore, settingsState } = await loadFreshSyncProviders();
    await SyncCredentialStore.persistSettingsUpdate({
      syncCredentialsSessionOnly: true,
      dropboxToken: 'dropbox-session-token',
      dropboxRefreshToken: 'dropbox-refresh-token',
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.dropbox.disconnect(settingsState);
    const session = await chrome.storage.session.get(SyncCredentialStore.sessionKey);

    expect(result).toEqual({ success: true });
    expect(session[SyncCredentialStore.sessionKey]).toBeUndefined();
    expect(settingsState.dropboxToken).toBe('');
    expect(settingsState.dropboxRefreshToken).toBe('');
    expect(JSON.stringify(settingsState)).not.toContain('dropbox-session-token');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/2/auth/token/revoke',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer dropbox-session-token' }),
      }),
    );
  });

  it('uses a memory session fallback when chrome.storage.session is unavailable', async () => {
    const originalSession = chrome.storage.session;
    chrome.storage.session = undefined;
    try {
      const { CloudSyncProviders, SyncCredentialStore, settingsState } = await loadFreshSyncProviders();
      await SyncCredentialStore.persistSettingsUpdate({
        syncCredentialsSessionOnly: true,
        webdavUrl: 'https://dav.example.com/backups',
        webdavUsername: 'fallback-user',
        webdavPassword: 'fallback-secret',
      });

      expect(settingsState.webdavPassword).toBe('');
      const effective = await SyncCredentialStore.resolveSettings(settingsState);
      expect(effective.webdavPassword).toBe('fallback-secret');
      const disclosure = CloudSyncProviders.webdav.getStorageDisclosure(effective);
      expect(disclosure.storage).toBe('memory-session');
      expect(disclosure.sessionFallback).toBe(true);
    } finally {
      chrome.storage.session = originalSession;
    }
  });

  it('rejects Google Drive OAuth callbacks with a mismatched state parameter', async () => {
    const { CloudSyncProviders, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    chrome.identity.launchWebAuthFlow.mockImplementationOnce(async ({ url }) => {
      const authUrl = new URL(url);
      expect(authUrl.searchParams.get('state')).toBeTruthy();
      return `https://test-extension.chromiumapp.org/?code=google-auth-code&state=wrong-state`;
    });

    const result = await CloudSyncProviders.googledrive.connect();

    expect(result).toEqual({
      success: false,
      error: 'OAuth state mismatch - possible CSRF attack',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(SettingsManager.set).not.toHaveBeenCalled();
  });

  it('clears stored Dropbox credentials on disconnect even if token revocation fails', async () => {
    const { CloudSyncProviders, settingsState, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.dropbox.disconnect({
      dropboxToken: settingsState.dropboxToken,
      dropboxRefreshToken: settingsState.dropboxRefreshToken,
      dropboxUser: settingsState.dropboxUser,
    });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/2/auth/token/revoke',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer dropbox-token' },
      }),
    );
    expect(SettingsManager.set).toHaveBeenCalledWith({
      dropboxToken: '',
      dropboxRefreshToken: '',
      dropboxUser: null,
    });
    expect(settingsState.dropboxToken).toBe('');
    expect(settingsState.dropboxRefreshToken).toBe('');
    expect(settingsState.dropboxUser).toBeNull();
  });

  it('refreshes an expired Dropbox token before upload', async () => {
    const { CloudSyncProviders, settingsState, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'fresh-dropbox-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.dropbox.upload(
      { scripts: [] },
      {
        dropboxToken: settingsState.dropboxToken,
        dropboxRefreshToken: settingsState.dropboxRefreshToken,
        dropboxClientId: 'dropbox-client-id',
      },
    );

    expect(result.success).toBe(true);
    expect(SettingsManager.set).toHaveBeenCalledWith({ dropboxToken: 'fresh-dropbox-token' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://content.dropboxapi.com/2/files/upload',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-dropbox-token',
        }),
      }),
    );
  });

  it('reuses an existing Dropbox access token when the validation probe has a transient server failure', async () => {
    const { CloudSyncProviders, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.dropbox.upload(
      { scripts: [] },
      {
        dropboxToken: 'existing-dropbox-token',
        dropboxRefreshToken: '',
        dropboxClientId: 'dropbox-client-id',
      },
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://content.dropboxapi.com/2/files/upload',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer existing-dropbox-token',
        }),
      }),
    );
    expect(SettingsManager.set).not.toHaveBeenCalledWith({ dropboxToken: expect.any(String) });
  });

  it('treats Dropbox as connected when only a refresh token remains and refresh succeeds', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'status-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            email: 'user@example.com',
            name: { display_name: 'Dropbox User' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    globalThis.fetch = fetchMock;

    const status = await CloudSyncProviders.dropbox.getStatus({
      dropboxToken: '',
      dropboxRefreshToken: 'refresh-only-token',
      dropboxClientId: 'dropbox-client-id',
    });

    expect(status).toEqual({
      connected: true,
      user: {
        email: 'user@example.com',
        name: 'Dropbox User',
      },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.dropboxapi.com/2/users/get_current_account',
      expect.objectContaining({
        headers: { Authorization: 'Bearer status-token' },
      }),
    );
  });

  it('refreshes Google Drive from a refresh-token-only state before upload', async () => {
    const { CloudSyncProviders, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'fresh-google-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.googledrive.upload(
      { scripts: [] },
      {
        googleDriveToken: '',
        googleDriveRefreshToken: 'google-refresh-token',
        googleDriveConnected: true,
        googleClientId: 'google-client-id',
      },
    );

    expect(result.success).toBe(true);
    expect(SettingsManager.set).toHaveBeenCalledWith({
      googleDriveToken: 'fresh-google-token',
      googleDriveConnected: true,
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-google-token',
        }),
      }),
    );
  });

  it('reuses an existing Google Drive access token when the validation probe has a transient server failure', async () => {
    const { CloudSyncProviders, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.googledrive.upload(
      { scripts: [] },
      {
        googleDriveToken: 'existing-google-token',
        googleDriveRefreshToken: '',
        googleDriveConnected: true,
        googleClientId: 'google-client-id',
      },
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer existing-google-token',
        }),
      }),
    );
    expect(SettingsManager.set).not.toHaveBeenCalledWith({
      googleDriveToken: expect.any(String),
      googleDriveConnected: true,
    });
  });

  it('treats Google Drive as connected when only a refresh token remains and refresh succeeds', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'google-status-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            email: 'user@example.com',
            name: 'Google User',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    globalThis.fetch = fetchMock;

    const status = await CloudSyncProviders.googledrive.getStatus({
      googleDriveToken: '',
      googleDriveRefreshToken: 'google-refresh-token',
      googleDriveConnected: true,
      googleClientId: 'google-client-id',
    });

    expect(status).toEqual({
      connected: true,
      user: {
        email: 'user@example.com',
        name: 'Google User',
      },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      expect.objectContaining({
        headers: { Authorization: 'Bearer google-status-token' },
      }),
    );
  });

  it('refreshes OneDrive from a refresh-token-only state before upload', async () => {
    const { CloudSyncProviders, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'fresh-onedrive-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.onedrive.upload(
      { scripts: [] },
      {
        onedriveToken: '',
        onedriveRefreshToken: 'onedrive-refresh-token',
        onedriveConnected: true,
        onedriveClientId: 'onedrive-client-id',
      },
    );

    expect(result.success).toBe(true);
    expect(SettingsManager.set).toHaveBeenCalledWith({
      onedriveToken: 'fresh-onedrive-token',
      onedriveRefreshToken: 'onedrive-refresh-token',
      onedriveConnected: true,
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/scriptvault-backup.json:/content',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-onedrive-token',
        }),
      }),
    );
  });

  it('rejects OneDrive OAuth callbacks with a mismatched state parameter', async () => {
    const { CloudSyncProviders, settingsState, SettingsManager } = await loadFreshSyncProviders();
    settingsState.onedriveClientId = 'onedrive-client-id';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    chrome.identity.launchWebAuthFlow.mockImplementationOnce(async ({ url }) => {
      const authUrl = new URL(url);
      expect(authUrl.searchParams.get('state')).toBeTruthy();
      return 'https://test-extension.chromiumapp.org/onedrive?code=onedrive-auth-code&state=wrong-state';
    });

    await expect(CloudSyncProviders.onedrive.connect({
      onedriveClientId: settingsState.onedriveClientId,
    })).rejects.toThrow('OAuth state mismatch - possible CSRF attack');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(SettingsManager.set).not.toHaveBeenCalled();
  });

  it('reuses an existing OneDrive access token when the validation probe has a transient server failure', async () => {
    const { CloudSyncProviders, SettingsManager } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await CloudSyncProviders.onedrive.upload(
      { scripts: [] },
      {
        onedriveToken: 'existing-onedrive-token',
        onedriveRefreshToken: '',
        onedriveConnected: true,
        onedriveClientId: 'onedrive-client-id',
      },
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/scriptvault-backup.json:/content',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer existing-onedrive-token',
        }),
      }),
    );
    expect(SettingsManager.set).not.toHaveBeenCalledWith({
      onedriveToken: expect.any(String),
      onedriveRefreshToken: expect.any(String),
      onedriveConnected: true,
    });
  });

  it('treats OneDrive as connected when only a refresh token remains and refresh succeeds', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'onedrive-status-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userPrincipalName: 'user@example.com',
            displayName: 'OneDrive User',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    globalThis.fetch = fetchMock;

    const status = await CloudSyncProviders.onedrive.getStatus({
      onedriveToken: '',
      onedriveRefreshToken: 'onedrive-refresh-token',
      onedriveConnected: true,
      onedriveClientId: 'onedrive-client-id',
    });

    expect(status).toEqual({
      connected: true,
      user: {
        email: 'user@example.com',
        name: 'OneDrive User',
      },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://graph.microsoft.com/v1.0/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer onedrive-status-token' },
      }),
    );
  });
});
