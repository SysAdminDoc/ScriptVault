import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.__resetStorageMock();
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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

  vi.doMock('../src/modules/storage.ts', () => ({ SettingsManager }));

  const mod = await import('../src/modules/sync-providers.ts');
  return {
    CloudSyncProviders: mod.CloudSyncProviders,
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

  it('exports Google Drive under both legacy and current provider keys', async () => {
    const { CloudSyncProviders } = await loadFreshSyncProviders();

    expect(CloudSyncProviders.google).toBe(CloudSyncProviders.googledrive);
    expect(CloudSyncProviders.google.name).toBe('Google Drive');
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
