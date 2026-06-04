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
    CloudSyncProviders: () => CloudSyncProviders
  });
  module.exports = __toCommonJS(sync_providers_exports);
  async function getSettings() {
    return SettingsManager.get();
  }
  function getRequiredWebDavBaseUrl(settings) {
    const baseUrl = settings.webdavUrl?.trim();
    if (!baseUrl) throw new Error("WebDAV URL is required");
    return baseUrl.replace(/\/$/, "");
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
    const fields = config.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type ?? "metadata",
      present: hasStoredSyncValue(settingsRecord[field.key])
    }));
    return {
      storage: "chrome.storage.local",
      protection: "Extension-scoped browser storage; ScriptVault does not add a second encryption layer.",
      fields,
      hasStoredSecrets: fields.some((field) => field.present && field.type !== "metadata"),
      revokeAction: config.revokeAction,
      notes: config.notes ?? ""
    };
  }
  async function _oauthFetchWithTimeout(url, init, providerLabel, timeoutMs = 15e3) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
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
    }
  }
  async function fetchWithTimeout(url, options = {}, timeoutMs = 3e4) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
  var webdav = {
    name: "WebDAV",
    icon: "\u2601\uFE0F",
    requiresAuth: true,
    supportsManualSync: true,
    supportsDryRun: true,
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
    async upload(data, settings) {
      const url = `${getRequiredWebDavBaseUrl(settings)}/scriptvault-backup.json`;
      const auth = getWebDavAuthHeader(settings);
      const response = await fetchWithTimeout(url, {
        method: "PUT",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }, 6e4);
      if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const url = `${getRequiredWebDavBaseUrl(settings)}/scriptvault-backup.json`;
      const auth = getWebDavAuthHeader(settings);
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: { "Authorization": auth }
      }, 6e4);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`WebDAV download failed: HTTP ${response.status}`);
      return await response.json();
    },
    async test(settings) {
      try {
        const url = getRequiredWebDavBaseUrl(settings);
        const auth = getWebDavAuthHeader(settings);
        const response = await fetchWithTimeout(url, {
          method: "PROPFIND",
          headers: { "Authorization": auth, "Depth": "0" }
        }, 15e3);
        return { success: response.ok || response.status === 207 };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      if (!settings.webdavUrl) {
        return {
          connected: false,
          status: "missing_config",
          error: "WebDAV URL is not configured"
        };
      }
      const result = await this.test(settings);
      let endpointHost = "";
      try {
        endpointHost = new URL(settings.webdavUrl).host;
      } catch {
      }
      return {
        connected: result.success === true,
        status: result.success === true ? "ok" : "error",
        error: result.error ?? null,
        user: {
          email: "",
          name: settings.webdavUsername || endpointHost || "WebDAV"
        },
        endpointHost
      };
    },
    async disconnect() {
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
    async refreshToken(settings) {
      const currentSettings = settings ?? await getSettings();
      const refreshTok = currentSettings.googleDriveRefreshToken;
      if (!refreshTok) return null;
      const clientId = currentSettings.googleClientId || this.clientId;
      const resp = await _oauthFetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
        await SettingsManager.set({
          googleDriveToken: data.access_token,
          googleDriveConnected: true
        });
        if (data.refresh_token) {
          await SettingsManager.set({ googleDriveRefreshToken: data.refresh_token });
        }
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings) {
      const currentSettings = settings ?? await getSettings();
      let token = currentSettings.googleDriveToken || null;
      if (!token) {
        return await this.refreshToken(currentSettings);
      }
      try {
        const test = await _oauthFetchWithTimeout("https://www.googleapis.com/drive/v3/about?fields=user", {
          headers: { "Authorization": `Bearer ${token}` }
        }, "Google Drive", 1e4);
        if (!test) return token;
        if (test.ok) return token;
        if (test.status === 401 || test.status === 403) {
          return await this.refreshToken(currentSettings);
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
        await SettingsManager.set({
          googleDriveToken: tokens.access_token,
          googleDriveRefreshToken: tokens.refresh_token || settings.googleDriveRefreshToken || "",
          googleDriveConnected: true,
          googleDriveUser: { email: user.email ?? "", name: user.name ?? "" }
        });
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
          fetchWithTimeout(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {}, 1e4).catch(
            () => {
            }
          );
        }
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
    async findFile(token) {
      const query = encodeURIComponent(`name='${this.fileName}' and trashed=false`);
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
        { headers: { "Authorization": `Bearer ${token}` } },
        15e3
      );
      if (!response.ok) throw new Error(`Failed to search files: ${response.status}`);
      const data = await response.json();
      return data.files?.[0] ?? null;
    },
    async upload(data, settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Google Drive");
      const existingFile = await this.findFile(token);
      const metadata = {
        name: this.fileName,
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
      const url = existingFile ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart` : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
      const response = await fetchWithTimeout(url, {
        method: existingFile ? "PATCH" : "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body
      }, 6e4);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Google Drive");
      const file = await this.findFile(token);
      if (!file) return null;
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { "Authorization": `Bearer ${token}` } },
        6e4
      );
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return await response.json();
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
        const s = settings ?? await getSettings();
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
        const user = await response.json();
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
      if (!settings.dropboxClientId) {
        throw new Error(
          "Dropbox App Key is required. Create one at https://www.dropbox.com/developers/apps"
        );
      }
      const clientId = settings.dropboxClientId;
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
    async refreshToken(settings) {
      const refreshTok = settings.dropboxRefreshToken;
      const clientId = settings.dropboxClientId;
      if (!refreshTok || !clientId) return null;
      const resp = await _oauthFetchWithTimeout("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
        await SettingsManager.set({ dropboxToken: data.access_token });
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings) {
      if (settings.dropboxToken) {
        try {
          const test = await _oauthFetchWithTimeout(
            "https://api.dropboxapi.com/2/users/get_current_account",
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${settings.dropboxToken}` }
            },
            "Dropbox",
            1e4
          );
          if (!test) return settings.dropboxToken;
          if (test.ok) return settings.dropboxToken;
          if (test.status !== 401 && test.status !== 403) return settings.dropboxToken;
        } catch (_e) {
          return settings.dropboxToken;
        }
      }
      return await this.refreshToken(settings);
    },
    async disconnect(settings) {
      if (settings.dropboxToken) {
        try {
          await fetchWithTimeout("https://api.dropboxapi.com/2/auth/token/revoke", {
            method: "POST",
            headers: { "Authorization": `Bearer ${settings.dropboxToken}` }
          }, 1e4);
        } catch (e) {
          console.warn("[CloudSync] Dropbox revoke error:", e);
        }
      }
      await SettingsManager.set({
        dropboxToken: "",
        dropboxRefreshToken: "",
        dropboxUser: null
      });
      return { success: true };
    },
    async upload(data, settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Dropbox");
      const response = await fetchWithTimeout("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({
            path: this.fileName,
            mode: "overwrite",
            autorename: false,
            mute: true
          }),
          "Content-Type": "application/octet-stream"
        },
        body: JSON.stringify(data)
      }, 6e4);
      if (response.status === 401) throw new Error("Dropbox token expired. Please reconnect.");
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Dropbox");
      const response = await fetchWithTimeout("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: this.fileName })
        }
      }, 6e4);
      if (response.status === 409) return null;
      if (response.status === 401) throw new Error("Dropbox token expired. Please reconnect.");
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return await response.json();
    },
    async test(settings) {
      try {
        const token = await this.getValidToken(settings);
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
      const s = settings ?? await getSettings();
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
        const user = await response.json();
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
      const clientId = settings.onedriveClientId;
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
      await SettingsManager.set({
        onedriveToken: tokens.access_token,
        onedriveRefreshToken: tokens.refresh_token || "",
        onedriveConnected: true,
        onedriveUser: {
          email: user.mail || user.userPrincipalName || "",
          name: user.displayName || ""
        }
      });
      return {
        success: true,
        user: {
          email: user.mail || user.userPrincipalName || "",
          name: user.displayName || ""
        }
      };
    },
    async refreshToken(settings) {
      const currentSettings = settings ?? await getSettings();
      const refreshTok = currentSettings.onedriveRefreshToken;
      const clientId = currentSettings.onedriveClientId;
      if (!refreshTok || !clientId) return null;
      const resp = await _oauthFetchWithTimeout(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
        await SettingsManager.set({
          onedriveToken: data.access_token,
          onedriveRefreshToken: data.refresh_token || refreshTok,
          onedriveConnected: true
        });
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings) {
      const currentSettings = settings ?? await getSettings();
      const token = currentSettings.onedriveToken;
      if (!token) {
        return await this.refreshToken(currentSettings);
      }
      try {
        const test = await _oauthFetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        }, "OneDrive", 1e4);
        if (!test) return token;
        if (test.ok) return token;
        if (test.status === 401 || test.status === 403) {
          return await this.refreshToken(currentSettings);
        }
        return token;
      } catch (_e) {
        return token;
      }
    },
    async disconnect() {
      await SettingsManager.set({
        onedriveToken: "",
        onedriveRefreshToken: "",
        onedriveConnected: false,
        onedriveUser: null
      });
      return { success: true };
    },
    async upload(data, settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with OneDrive");
      if (!data || typeof data !== "object") throw new Error("Invalid backup data");
      const response = await fetchWithTimeout(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        },
        6e4
      );
      if (!response.ok) throw new Error("Upload failed: " + await response.text());
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with OneDrive");
      const response = await fetchWithTimeout(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        { headers: { "Authorization": `Bearer ${token}` } },
        6e4
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Download failed: " + response.status);
      return await response.json();
    },
    async test(settings) {
      try {
        const token = await this.getValidToken(settings);
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
        const s = settings ?? await getSettings();
        if (!s.onedriveToken && !s.onedriveRefreshToken) return { connected: false };
        const token = await this.getValidToken(s);
        if (!token) return { connected: false };
        const response = await fetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        }, 15e3);
        if (!response.ok) return { connected: false };
        const user = await response.json();
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
      const usePathStyle = settings.s3PathStyle === true || settings.s3PathStyle === void 0 && !isAws || settings.s3PathStyle === false && false;
      const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
      if (usePathStyle) {
        return `${endpoint.origin}/${encodeURIComponent(settings.s3Bucket)}/${encodedKey}`;
      }
      const host = `${settings.s3Bucket}.${endpoint.hostname}`;
      const port = endpoint.port ? `:${endpoint.port}` : "";
      return `${endpoint.protocol}//${host}${port}/${encodedKey}`;
    },
    _objectKey(settings) {
      return (settings.s3ObjectKey || "scriptvault-backup.json").replace(/^\/+/, "");
    },
    async _signRequest({
      method,
      url,
      region,
      accessKeyId,
      secretKey,
      body,
      contentType
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
      const sortedHeaderNames = Object.keys(headers).sort();
      const canonicalHeaders = sortedHeaderNames.map((key) => `${key}:${headers[key]}
  `).join("");
      const signedHeaders = sortedHeaderNames.join(";");
      const canonicalQuery = parsedUrl.searchParams.toString().split("&").filter(Boolean).sort().join("&");
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
      const check = this.validate(settings);
      if (!check.valid) {
        throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(" ")}`);
      }
      const url = this._buildObjectUrl(settings, this._objectKey(settings));
      const body = JSON.stringify(data);
      const signed = await this._signRequest({
        method: "PUT",
        url,
        region: settings.s3Region,
        accessKeyId: settings.s3AccessKeyId,
        secretKey: settings.s3SecretKey,
        body,
        contentType: "application/json"
      });
      const response = await fetch(url, {
        method: "PUT",
        headers: signed.headers,
        body,
        signal: opts.signal
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`S3 upload failed: HTTP ${response.status}${text ? ` \u2014 ${text.slice(0, 200)}` : ""}`);
      }
      return { success: true, timestamp: Date.now() };
    },
    async download(settings, opts = {}) {
      const check = this.validate(settings);
      if (!check.valid) {
        throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(" ")}`);
      }
      const url = this._buildObjectUrl(settings, this._objectKey(settings));
      const signed = await this._signRequest({
        method: "GET",
        url,
        region: settings.s3Region,
        accessKeyId: settings.s3AccessKeyId,
        secretKey: settings.s3SecretKey
      });
      const response = await fetch(url, {
        method: "GET",
        headers: signed.headers,
        signal: opts.signal
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`S3 download failed: HTTP ${response.status}${text ? ` \u2014 ${text.slice(0, 200)}` : ""}`);
      }
      return await response.json();
    },
    async test(settings) {
      const check = this.validate(settings);
      if (!check.valid) {
        return { success: false, error: check.errors.map((e) => e.error).join(" ") };
      }
      try {
        const url = this._buildObjectUrl(settings, this._objectKey(settings));
        const signed = await this._signRequest({
          method: "HEAD",
          url,
          region: settings.s3Region,
          accessKeyId: settings.s3AccessKeyId,
          secretKey: settings.s3SecretKey
        });
        const response = await fetch(url, { method: "HEAD", headers: signed.headers });
        if (response.ok || response.status === 404) return { success: true };
        return { success: false, error: `HTTP ${response.status}` };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    async getStatus(settings) {
      const check = this.validate(settings);
      if (!check.valid) {
        return {
          connected: false,
          status: "missing_config",
          error: check.errors.map((e) => e.error).join(" ")
        };
      }
      let endpointHost = "";
      try {
        endpointHost = new URL(settings.s3Endpoint).host;
      } catch {
      }
      const result = await this.test(settings);
      return {
        connected: result.success === true,
        status: result.success === true ? "ok" : "error",
        error: result.error ?? null,
        user: { email: "", name: `${settings.s3Bucket}@${endpointHost}` },
        endpointHost
      };
    },
    async disconnect() {
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
    googledrive,
    google: googledrive,
    dropbox,
    onedrive,
    s3
  };
  return module.exports.default || module.exports.CloudSyncProviders || module.exports;
})();

if (typeof self !== 'undefined') {
  self.CloudSyncProviders = CloudSyncProviders;
}
