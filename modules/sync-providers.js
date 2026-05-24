// ============================================================================
// INLINED: cloud-sync.js - Cloud Sync Providers
// (inlined to bypass Chrome service worker importScripts caching)
// ============================================================================

// LR-001 — OAuth refresh hardening. Wrap a fetch in an AbortController with
// a wall-clock timeout so a slow/dead network can't hang getValidToken()
// callers indefinitely (pre-fix, the fetch hung until the OS gave up,
// minutes later, often after the SW had died and re-spawned).
//
// 15-second budget matches the existing pattern in modules/resources.js
// fetchTimeoutMs. Callers expect the same null-on-failure contract; any
// AbortError surfaces as a clean null with a warning log, not an
// unhandled rejection.
async function _oauthFetchWithTimeout(url, init, providerLabel, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e && (e.name === 'AbortError' || /aborted|timed?\s*out/i.test(e.message || ''))) {
      console.warn(`[CloudSync] ${providerLabel} token refresh timed out after ${timeoutMs}ms`);
      return null;
    }
    // Network-level errors (DNS, connection refused, etc.) — also surface
    // as null so getValidToken can fall back to "user must re-auth" UX.
    console.warn(`[CloudSync] ${providerLabel} token refresh network error:`, e?.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function _hasStoredSyncValue(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null && value !== false;
}

function _syncStorageDisclosure(settings, config) {
  const fields = config.fields.map(field => ({
    key: field.key,
    label: field.label,
    type: field.type || 'metadata',
    present: _hasStoredSyncValue(settings?.[field.key])
  }));
  return {
    storage: 'chrome.storage.local',
    protection: 'Extension-scoped browser storage; ScriptVault does not add a second encryption layer.',
    fields,
    hasStoredSecrets: fields.some(field => field.present && field.type !== 'metadata'),
    revokeAction: config.revokeAction,
    notes: config.notes || ''
  };
}

var CloudSyncProviders = {
  // ============================================================================
  // WebDAV Provider
  // ============================================================================
  webdav: {
    name: 'WebDAV',
    icon: '☁️',
    requiresAuth: true,
    supportsManualSync: true,
    supportsDryRun: true,

    getStorageDisclosure(settings = {}) {
      return _syncStorageDisclosure(settings, {
        fields: [
          { key: 'webdavUrl', label: 'WebDAV endpoint URL', type: 'metadata' },
          { key: 'webdavUsername', label: 'WebDAV username', type: 'credential' },
          { key: 'webdavPassword', label: 'WebDAV password', type: 'credential' }
        ],
        revokeAction: 'Clear the saved WebDAV endpoint, username, and password from local extension storage.',
        notes: 'WebDAV Basic credentials are sent only to the configured server during sync.'
      });
    },
    
    // Phase 40.12 — `opts.signal` carries the CloudSync 90s timeout's
    // AbortSignal. When the orchestrator gives up, the provider's fetch is
    // cancelled instead of running to completion and racing the next sync.
    async upload(data, settings, opts = {}) {
      if (!settings.webdavUrl) throw new Error('WebDAV URL is required');
      const url = `${settings.webdavUrl.replace(/\/$/, '')}/scriptvault-backup.json`;
      const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        signal: opts.signal
      });

      if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
      return { success: true, timestamp: Date.now() };
    },

    async download(settings, opts = {}) {
      if (!settings.webdavUrl) throw new Error('WebDAV URL is required');
      const url = `${settings.webdavUrl.replace(/\/$/, '')}/scriptvault-backup.json`;
      const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` },
        signal: opts.signal
      });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`WebDAV download failed: HTTP ${response.status}`);

      return await response.json();
    },
    
    async test(settings) {
      try {
        const url = settings.webdavUrl.replace(/\/$/, '');
        const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);
        
        const response = await fetch(url, {
          method: 'PROPFIND',
          headers: { 'Authorization': `Basic ${auth}`, 'Depth': '0' }
        });
        
        return { success: response.ok || response.status === 207 };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async getStatus(settings = {}) {
      if (!settings.webdavUrl) {
        return { connected: false, status: 'missing_config', error: 'WebDAV URL is not configured' };
      }
      const result = await this.test(settings);
      let endpointHost = '';
      try { endpointHost = new URL(settings.webdavUrl).host; } catch {}
      return {
        connected: result.success === true,
        status: result.success === true ? 'ok' : 'error',
        error: result.error || null,
        user: {
          email: '',
          name: settings.webdavUsername || endpointHost || 'WebDAV'
        },
        endpointHost
      };
    },

    async disconnect() {
      await SettingsManager.set({
        webdavUrl: '',
        webdavUsername: '',
        webdavPassword: ''
      });
      return { success: true };
    }
  },

  // ============================================================================
  // Google Drive Provider
  // ============================================================================
  googledrive: {
    name: 'Google Drive',
    icon: '📁',
    requiresOAuth: true,
    fileName: 'scriptvault-backup.json',
    supportsManualSync: true,
    supportsDryRun: true,
    // Google OAuth client ID (public, installed-app type)
    // Users can override via settings.googleClientId
    clientId: '287129963438-mcc1mod1m5jm8vjr3icb7ensdtcfq44l.apps.googleusercontent.com',

    getStorageDisclosure(settings = {}) {
      return _syncStorageDisclosure(settings, {
        fields: [
          { key: 'googleDriveToken', label: 'Google Drive access token', type: 'token' },
          { key: 'googleDriveRefreshToken', label: 'Google Drive refresh token', type: 'token' },
          { key: 'googleClientId', label: 'Optional Google OAuth client ID override', type: 'metadata' },
          { key: 'googleDriveUser', label: 'Connected Google account label', type: 'metadata' }
        ],
        revokeAction: 'Ask Google to revoke the current access token when available, then clear Google tokens and account metadata.',
        notes: 'Tokens are scoped to Drive file access and Google profile/email lookup for the configured backup file.'
      });
    },

    async getToken() {
      const settings = await SettingsManager.get();
      return settings.googleDriveToken || null;
    },

    async refreshToken() {
      const settings = await SettingsManager.get();
      const refreshToken = settings.googleDriveRefreshToken;
      if (!refreshToken) return null;

      const clientId = settings.googleClientId || this.clientId;
      // LR-001 — abort after 15s so a hung fetch can't block callers
      // forever. Helper returns null on timeout / network error.
      const resp = await _oauthFetchWithTimeout(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
          })
        },
        'Google'
      );
      if (!resp) return null;

      if (!resp.ok) {
        console.warn('[CloudSync] Google token refresh failed:', resp.status);
        if (resp.status === 400 || resp.status === 401) {
          await SettingsManager.set({ googleDriveToken: '', googleDriveRefreshToken: '' });
        }
        return null;
      }
      // Malformed JSON from the OAuth endpoint should surface as a clean
      // null return, not an unhandled promise rejection in callers that
      // pattern `const token = await refreshToken(); if (!token) ...`.
      let data;
      try { data = await resp.json(); } catch (e) {
        console.warn('[CloudSync] Google token refresh JSON parse failed:', e?.message || e);
        return null;
      }
      if (data && data.access_token) {
        await SettingsManager.set({ googleDriveToken: data.access_token });
        if (data.refresh_token) {
          await SettingsManager.set({ googleDriveRefreshToken: data.refresh_token });
        }
        return data.access_token;
      }
      return null;
    },

    async getValidToken() {
      let token = await this.getToken();
      if (!token) return null;

      // Test if token is still valid
      const test = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (test.ok) return token;

      // Try refresh
      token = await this.refreshToken();
      return token;
    },

    async connect() {
      try {
        const settings = await SettingsManager.get();
        const clientId = settings.googleClientId || this.clientId;
        const redirectUri = chrome.identity.getRedirectURL();
        const scopes = [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ].join(' ');

        // PKCE code verifier + state for CSRF protection
        const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
          b => b.toString(16).padStart(2, '0')).join('');
        const state = crypto.randomUUID();
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scopes,
          access_type: 'offline',
          prompt: 'consent',
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256'
        }).toString();

        const responseUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        });

        const url = new URL(responseUrl);
        if (url.searchParams.get('state') !== state) {
          throw new Error('OAuth state mismatch — possible CSRF');
        }
        const code = url.searchParams.get('code');
        if (!code) throw new Error('No authorization code received');

        // Exchange code for tokens
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            code: code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
          })
        });

        if (!tokenResp.ok) {
          const err = await tokenResp.text();
          throw new Error('Token exchange failed: ' + err);
        }

        const tokens = await tokenResp.json();

        // Get user info
        const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const user = userResp.ok ? await userResp.json() : {};

        await SettingsManager.set({
          googleDriveToken: tokens.access_token,
          googleDriveRefreshToken: tokens.refresh_token || settings.googleDriveRefreshToken || '',
          googleDriveConnected: true,
          googleDriveUser: { email: user.email, name: user.name }
        });

        return {
          success: true,
          user: { email: user.email, name: user.name, picture: user.picture }
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async disconnect() {
      try {
        const token = await this.getToken();
        if (token) {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token })
          }).catch(() => {});
        }
        await SettingsManager.set({
          googleDriveToken: '',
          googleDriveRefreshToken: '',
          googleDriveConnected: false,
          googleDriveUser: null
        });
      } catch (e) {
        console.warn('[CloudSync] Google disconnect error:', e);
      }
      return { success: true };
    },

    async findFile(token) {
      // Search in root and appDataFolder
      const query = encodeURIComponent(`name='${this.fileName}' and trashed=false`);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error(`Failed to search files: ${response.status}`);
      const data = await response.json();
      return data.files?.[0] || null;
    },

    // Phase 40.12 — opts.signal threading. See WebDAV provider for rationale.
    async upload(data, settings, opts = {}) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with Google Drive');

      const existingFile = await this.findFile(token);
      const metadata = {
        name: this.fileName,
        mimeType: 'application/json'
      };

      const boundary = '-------ScriptVault' + crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        JSON.stringify(data),
        `--${boundary}--`
      ].join('\r\n');

      const url = existingFile
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const response = await fetch(url, {
        method: existingFile ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body,
        signal: opts.signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      return { success: true, timestamp: Date.now() };
    },

    async download(settings, opts = {}) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with Google Drive');

      const file = await this.findFile(token);
      if (!file) return null;

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { 'Authorization': `Bearer ${token}` }, signal: opts.signal }
      );

      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return await response.json();
    },

    async test(settings) {
      try {
        const token = await this.getValidToken();
        if (!token) return { success: false, error: 'Not authenticated' };

        const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        return { success: response.ok };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async getStatus(settings) {
      try {
        if (!settings) settings = await SettingsManager.get();
        if (!settings.googleDriveConnected || !settings.googleDriveToken) {
          return { connected: false };
        }

        const token = await this.getValidToken();
        if (!token) return { connected: false };

        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return { connected: false };

        const user = await response.json();
        return { connected: true, user: { email: user.email, name: user.name } };
      } catch (e) {
        return { connected: false };
      }
    }
  },

  // ============================================================================
  // Dropbox Provider
  // ============================================================================
  dropbox: {
    name: 'Dropbox',
    icon: '📦',
    requiresOAuth: true,
    fileName: '/scriptvault-backup.json',
    supportsManualSync: true,
    supportsDryRun: true,

    getStorageDisclosure(settings = {}) {
      return _syncStorageDisclosure(settings, {
        fields: [
          { key: 'dropboxToken', label: 'Dropbox access token', type: 'token' },
          { key: 'dropboxRefreshToken', label: 'Dropbox refresh token', type: 'token' },
          { key: 'dropboxClientId', label: 'Dropbox app key', type: 'metadata' },
          { key: 'dropboxUser', label: 'Connected Dropbox account label', type: 'metadata' }
        ],
        revokeAction: 'Call Dropbox token revoke when an access token exists, then clear Dropbox tokens and account metadata.',
        notes: 'Tokens are scoped by the Dropbox app key the user configured for ScriptVault backups.'
      });
    },
    
    async connect(settings) {
      if (!settings.dropboxClientId) {
        throw new Error('Dropbox App Key is required. Create one at https://www.dropbox.com/developers/apps');
      }

      const clientId = settings.dropboxClientId;
      const redirectUri = chrome.identity.getRedirectURL('dropbox');

      // PKCE code verifier + challenge
      const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
        b => b.toString(16).padStart(2, '0')).join('');
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // CSRF state parameter
      const state = Array.from(crypto.getRandomValues(new Uint8Array(16)),
        b => b.toString(16).padStart(2, '0')).join('');

      const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        token_access_type: 'offline',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state
      }).toString();

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });

      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) {
        throw new Error('OAuth state mismatch - possible CSRF attack');
      }
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorization code received');

      // Exchange code for tokens
      const tokenResp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      if (!tokenResp.ok) {
        const err = await tokenResp.text();
        throw new Error('Token exchange failed: ' + err);
      }

      const tokens = await tokenResp.json();
      return {
        success: true,
        token: tokens.access_token,
        refreshToken: tokens.refresh_token || ''
      };
    },
    
    async refreshToken(settings) {
      const refreshTok = settings.dropboxRefreshToken;
      const clientId = settings.dropboxClientId;
      if (!refreshTok || !clientId) return null;

      // LR-001 — 15s wall-clock abort to bound caller wait time.
      const resp = await _oauthFetchWithTimeout(
        'https://api.dropboxapi.com/oauth2/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshTok
          })
        },
        'Dropbox'
      );
      if (!resp) return null;

      if (!resp.ok) {
        console.warn('[CloudSync] Dropbox token refresh failed:', resp.status);
        // Clear stale token to prevent infinite retry loops
        if (resp.status === 400 || resp.status === 401) {
          await SettingsManager.set({ dropboxToken: '', dropboxRefreshToken: '' });
        }
        return null;
      }
      let data;
      try { data = await resp.json(); } catch (e) {
        console.warn('[CloudSync] Dropbox token refresh JSON parse failed:', e?.message || e);
        return null;
      }
      if (data && data.access_token) {
        await SettingsManager.set({ dropboxToken: data.access_token });
        return data.access_token;
      }
      return null;
    },

    async getValidToken(settings) {
      if (!settings.dropboxToken) return null;
      // Test current token
      const test = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
      });
      if (test.ok) return settings.dropboxToken;
      // Try refresh
      return await this.refreshToken(settings);
    },

    async disconnect(settings) {
      if (settings.dropboxToken) {
        try {
          await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
          });
        } catch (e) {
          console.warn('[CloudSync] Dropbox revoke error:', e);
        }
      }
      await SettingsManager.set({
        dropboxToken: '',
        dropboxRefreshToken: '',
        dropboxUser: null
      });
      return { success: true };
    },

    // Phase 40.12 — opts.signal threading. See WebDAV provider for rationale.
    async upload(data, settings, opts = {}) {
      if (!settings.dropboxToken) throw new Error('Not authenticated with Dropbox');

      // Ensure token is fresh before upload
      const token = await this.getValidToken(settings);
      if (!token) throw new Error('Dropbox token expired. Please reconnect.');

      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: this.fileName,
            mode: 'overwrite',
            autorename: false,
            mute: true
          }),
          'Content-Type': 'application/octet-stream'
        },
        body: JSON.stringify(data),
        signal: opts.signal
      });

      if (response.status === 401) throw new Error('Dropbox token expired. Please reconnect.');
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      return { success: true, timestamp: Date.now() };
    },

    async download(settings, opts = {}) {
      if (!settings.dropboxToken) throw new Error('Not authenticated with Dropbox');

      // Ensure token is fresh before download (mirrors upload() refresh logic)
      const token = await this.getValidToken(settings);
      if (!token) throw new Error('Dropbox token expired. Please reconnect.');

      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path: this.fileName })
        },
        signal: opts.signal
      });

      if (response.status === 409) return null; // File not found
      if (response.status === 401) throw new Error('Dropbox token expired. Please reconnect.');
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);

      return await response.json();
    },
    
    async test(settings) {
      if (!settings.dropboxToken) return { success: false, error: 'Not authenticated' };
      
      try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
        });
        
        if (response.status === 401) return { success: false, error: 'Token expired' };
        return { success: response.ok };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    
    async getStatus(settings) {
      if (!settings) settings = await SettingsManager.get();
      if (!settings.dropboxToken) return { connected: false };

      try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
        });

        if (!response.ok) return { connected: false };

        const user = await response.json();
        return {
          connected: true,
          user: { email: user.email, name: user.name?.display_name || user.display_name || '' }
        };
      } catch (e) {
        return { connected: false };
      }
    }
  },

  // ============================================================================
  // OneDrive Provider
  // ============================================================================
  onedrive: {
    name: 'OneDrive',
    icon: '📁',
    requiresOAuth: true,
    fileName: 'scriptvault-backup.json',
    supportsManualSync: true,
    supportsDryRun: true,
    // Microsoft OAuth - users must provide their own client ID from Azure AD
    // Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps

    getStorageDisclosure(settings = {}) {
      return _syncStorageDisclosure(settings, {
        fields: [
          { key: 'onedriveToken', label: 'OneDrive access token', type: 'token' },
          { key: 'onedriveRefreshToken', label: 'OneDrive refresh token', type: 'token' },
          { key: 'onedriveClientId', label: 'OneDrive app client ID', type: 'metadata' },
          { key: 'onedriveUser', label: 'Connected Microsoft account label', type: 'metadata' }
        ],
        revokeAction: 'Clear OneDrive tokens and account metadata from local extension storage.',
        notes: 'Microsoft Graph tokens use app-folder file access and profile lookup scopes.'
      });
    },

    async connect(settings) {
      const clientId = settings.onedriveClientId;
      if (!clientId) {
        throw new Error('OneDrive Client ID required. Create one at https://portal.azure.com → App registrations');
      }
      const redirectUri = chrome.identity.getRedirectURL('onedrive');
      const scopes = 'Files.ReadWrite.AppFolder User.Read offline_access';

      const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
        b => b.toString(16).padStart(2, '0')).join('');
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const state = crypto.randomUUID();
      const authUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state
      }).toString();

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl, interactive: true
      });

      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) throw new Error('CSRF state mismatch');
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorization code received');

      const tokenResp = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: scopes
        })
      });

      if (!tokenResp.ok) throw new Error('Token exchange failed: ' + await tokenResp.text());
      const tokens = await tokenResp.json();

      const userResp = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      const user = userResp.ok ? await userResp.json() : {};

      await SettingsManager.set({
        onedriveToken: tokens.access_token,
        onedriveRefreshToken: tokens.refresh_token || '',
        onedriveConnected: true,
        onedriveUser: { email: user.mail || user.userPrincipalName || '', name: user.displayName || '' }
      });

      return { success: true, user: { email: user.mail || user.userPrincipalName, name: user.displayName } };
    },

    async refreshToken() {
      const settings = await SettingsManager.get();
      const refreshTok = settings.onedriveRefreshToken;
      const clientId = settings.onedriveClientId;
      if (!refreshTok || !clientId) return null;

      // LR-001 — 15s wall-clock abort to bound caller wait time.
      const resp = await _oauthFetchWithTimeout(
        'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshTok,
            scope: 'Files.ReadWrite.AppFolder User.Read offline_access'
          })
        },
        'OneDrive'
      );
      if (!resp) return null;

      if (!resp.ok) {
        console.warn('[CloudSync] OneDrive token refresh failed:', resp.status);
        if (resp.status === 400 || resp.status === 401) {
          await SettingsManager.set({ onedriveToken: '', onedriveRefreshToken: '' });
        }
        return null;
      }
      let data;
      try { data = await resp.json(); } catch (e) {
        console.warn('[CloudSync] OneDrive token refresh JSON parse failed:', e?.message || e);
        return null;
      }
      if (data && data.access_token) {
        await SettingsManager.set({
          onedriveToken: data.access_token,
          onedriveRefreshToken: data.refresh_token || refreshTok
        });
        return data.access_token;
      }
      return null;
    },

    async getValidToken() {
      const settings = await SettingsManager.get();
      let token = settings.onedriveToken;
      if (!token) return null;

      const test = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (test.ok) return token;

      return await this.refreshToken();
    },

    async disconnect() {
      await SettingsManager.set({
        onedriveToken: '', onedriveRefreshToken: '',
        onedriveConnected: false, onedriveUser: null
      });
      return { success: true };
    },

    // Phase 40.12 — opts.signal threading. See WebDAV provider for rationale.
    // The orchestrator passes (data, settings, opts); existing callers that
    // pass only `(data)` (e.g. ad-hoc unit tests) still work because
    // settings/opts default to undefined and the body never touches them.
    async upload(data, _settings, opts = {}) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with OneDrive');
      if (!data || typeof data !== 'object') throw new Error('Invalid backup data');

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data),
          signal: opts.signal
        }
      );

      if (!response.ok) throw new Error('Upload failed: ' + await response.text());
      return { success: true, timestamp: Date.now() };
    },

    async download(_settings, opts = {}) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with OneDrive');

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        { headers: { 'Authorization': `Bearer ${token}` }, signal: opts.signal }
      );

      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Download failed: ' + response.status);
      return await response.json();
    },

    async test() {
      try {
        const token = await this.getValidToken();
        if (!token) return { success: false, error: 'Not authenticated' };
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return { success: response.ok };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async getStatus(settings) {
      try {
        if (!settings) settings = await SettingsManager.get();
        if (!settings.onedriveConnected || !settings.onedriveToken) return { connected: false };
        const token = await this.getValidToken();
        if (!token) return { connected: false };
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return { connected: false };
        const user = await response.json();
        return { connected: true, user: { email: user.mail || user.userPrincipalName, name: user.displayName } };
      } catch (e) {
        return { connected: false };
      }
    }
  }
};

// Export for use in background.js
if (typeof self !== 'undefined') {
  self.CloudSyncProviders = CloudSyncProviders;
}
