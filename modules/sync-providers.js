// ============================================================================
// INLINED: cloud-sync.js - Cloud Sync Providers
// (inlined to bypass Chrome service worker importScripts caching)
// ============================================================================
var CloudSyncProviders = {
  // ============================================================================
  // WebDAV Provider
  // ============================================================================
  webdav: {
    name: 'WebDAV',
    icon: '☁️',
    requiresAuth: true,
    
    async upload(data, settings) {
      if (!settings.webdavUrl) throw new Error('WebDAV URL is required');
      const url = `${settings.webdavUrl.replace(/\/$/, '')}/scriptvault-backup.json`;
      const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
      return { success: true, timestamp: Date.now() };
    },
    
    async download(settings) {
      if (!settings.webdavUrl) throw new Error('WebDAV URL is required');
      const url = `${settings.webdavUrl.replace(/\/$/, '')}/scriptvault-backup.json`;
      const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
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
    // Google OAuth client ID (public, installed-app type)
    // Users can override via settings.googleClientId
    clientId: '287129963438-mcc1mod1m5jm8vjr3icb7ensdtcfq44l.apps.googleusercontent.com',

    async getToken() {
      const settings = await SettingsManager.get();
      return settings.googleDriveToken || null;
    },

    async refreshToken() {
      const settings = await SettingsManager.get();
      const refreshToken = settings.googleDriveRefreshToken;
      if (!refreshToken) return null;

      const clientId = settings.googleClientId || this.clientId;
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!resp.ok) {
        console.warn('[CloudSync] Google token refresh failed:', resp.status);
        if (resp.status === 400 || resp.status === 401) {
          await SettingsManager.set({ googleDriveToken: '', googleDriveRefreshToken: '' });
        }
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
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

    async upload(data, settings) {
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
        body
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      return { success: true, timestamp: Date.now() };
    },

    async download(settings) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with Google Drive');

      const file = await this.findFile(token);
      if (!file) return null;

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { 'Authorization': `Bearer ${token}` } }
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

      const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshTok
        })
      });

      if (!resp.ok) {
        console.warn('[CloudSync] Dropbox token refresh failed:', resp.status);
        // Clear stale token to prevent infinite retry loops
        if (resp.status === 400 || resp.status === 401) {
          await SettingsManager.set({ dropboxToken: '', dropboxRefreshToken: '' });
        }
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
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
      return { success: true };
    },

    async upload(data, settings) {
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
        body: JSON.stringify(data)
      });
      
      if (response.status === 401) throw new Error('Dropbox token expired. Please reconnect.');
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }
      
      return { success: true, timestamp: Date.now() };
    },
    
    async download(settings) {
      if (!settings.dropboxToken) throw new Error('Not authenticated with Dropbox');

      // Ensure token is fresh before download (mirrors upload() refresh logic)
      const token = await this.getValidToken(settings);
      if (!token) throw new Error('Dropbox token expired. Please reconnect.');

      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path: this.fileName })
        }
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
    // Microsoft OAuth - users must provide their own client ID from Azure AD
    // Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps

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

      const resp = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshTok,
          scope: 'Files.ReadWrite.AppFolder User.Read offline_access'
        })
      });

      if (!resp.ok) {
        console.warn('[CloudSync] OneDrive token refresh failed:', resp.status);
        if (resp.status === 400 || resp.status === 401) {
          await SettingsManager.set({ onedriveToken: '', onedriveRefreshToken: '' });
        }
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
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

    async upload(data) {
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
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) throw new Error('Upload failed: ' + await response.text());
      return { success: true, timestamp: Date.now() };
    },

    async download() {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with OneDrive');

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        { headers: { 'Authorization': `Bearer ${token}` } }
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

