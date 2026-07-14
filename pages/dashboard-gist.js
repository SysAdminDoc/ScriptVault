/**
 * ScriptVault GitHub Gist Integration Module
 * Import/export userscripts to GitHub Gists, sync changes, and browse user Gists.
 * Uses a GitHub Personal Access Token stored in chrome.storage.local or chrome.storage.session.
 */
const GistIntegration = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        container: null,
        styleEl: null,
        modalEl: null,
        token: null,
        tokenVerified: false,
        tokenSessionOnly: false,
        autoSync: false,
        getScript: null,
        getAllScripts: null,
        onInstallScript: null,
        updateScript: null,
        gistCache: [],
        cacheTime: 0,
        syncIntervalId: null
    };

    const API_BASE = 'https://api.github.com/gists';
    // Phase 5.5 (v3.6.2) — Token now stored in plain text under `gist_pat`.
    // Previously this was AES-GCM encrypted with a hardcoded PBKDF2 key
    // derived from string literals embedded in the source — anyone with
    // the encrypted blob and access to this file could derive the same
    // key, which is security theater. chrome.storage.local is already
    // sandboxed by Chrome at the extension boundary; that is the actual
    // protection. We keep the legacy `gist_pat_encrypted` key around for
    // one read so existing installs migrate transparently.
    const STORAGE_KEY_TOKEN = 'gist_pat';
    const STORAGE_KEY_TOKEN_LEGACY = 'gist_pat_encrypted';
    const STORAGE_KEY_TOKEN_SESSION_ONLY = 'gist_pat_session_only';
    const STORAGE_KEY_TOKEN_SESSION = 'sv_gist_pat_session';
    const STORAGE_KEY_AUTOSYNC = 'gist_autosync';
    const CACHE_TTL = 5 * 60 * 1000; // 5 min
    const NETWORK_TIMEOUT_MS = 20 * 1000;
    const MAX_API_RESPONSE_BYTES = 10 * 1024 * 1024;
    const MAX_GIST_FILE_BYTES = 5 * 1024 * 1024;
    const GITHUB_API_HOSTS = new Set(['api.github.com']);
    const GITHUB_RAW_HOSTS = new Set(['gist.githubusercontent.com', 'raw.githubusercontent.com']);

    const _safeSetHtml = (typeof window.ScriptVaultDashboardUI?.safeSetHtml === 'function')
        ? window.ScriptVaultDashboardUI.safeSetHtml
        : (el, html) => {
          { const _r = document.createRange(); _r.selectNodeContents(el); el.replaceChildren(_r.createContextualFragment(String(html ?? ''))); }
        };

    // =========================================
    // HTML escaping helper
    // =========================================
    function escapeHtml(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

    // =========================================
    // One-shot legacy decryption (only used during migration)
    // =========================================
    // Mirrors the old encrypt() — same hardcoded inputs — so existing
    // installs can decrypt their stored token once and re-save it as
    // plaintext. Delete this block after a couple of releases when the
    // legacy key is unlikely to still be in any user's storage.
    async function _legacyDecryptToken(stored) {
        try {
            const raw = new TextEncoder().encode('ScriptVault-Gist-Key-v1');
            const keyMaterial = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
            const key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: new TextEncoder().encode('sv-gist-salt'), iterations: 100000, hash: 'SHA-256' },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );
            const data = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
            const iv = data.slice(0, 12);
            const ciphertext = data.slice(12);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            return new TextDecoder().decode(decrypted);
        } catch {
            return null;
        }
    }

    // =========================================
    // Token storage
    // =========================================
    const _sessionTokenMemoryFallback = { token: null };

    function hasSessionStorage() {
        return typeof chrome !== 'undefined' &&
            typeof chrome.storage?.session?.get === 'function' &&
            typeof chrome.storage.session.set === 'function' &&
            typeof chrome.storage.session.remove === 'function';
    }

    async function readSessionToken() {
        if (!hasSessionStorage()) return _sessionTokenMemoryFallback.token;
        try {
            const data = await chrome.storage.session.get(STORAGE_KEY_TOKEN_SESSION);
            return data?.[STORAGE_KEY_TOKEN_SESSION] || null;
        } catch (_e) {
            return _sessionTokenMemoryFallback.token;
        }
    }

    async function writeSessionToken(token) {
        _sessionTokenMemoryFallback.token = token || null;
        if (!hasSessionStorage()) return;
        await chrome.storage.session.set({ [STORAGE_KEY_TOKEN_SESSION]: token });
    }

    async function clearSessionToken() {
        _sessionTokenMemoryFallback.token = null;
        if (!hasSessionStorage()) return;
        await chrome.storage.session.remove(STORAGE_KEY_TOKEN_SESSION);
    }

    async function loadToken() {
        const data = await chrome.storage.local.get([
            STORAGE_KEY_TOKEN, STORAGE_KEY_TOKEN_LEGACY, STORAGE_KEY_TOKEN_SESSION_ONLY, STORAGE_KEY_AUTOSYNC
        ]);
        const hasStoredToken = Boolean(data[STORAGE_KEY_TOKEN] || data[STORAGE_KEY_TOKEN_LEGACY]);
        const hasStoragePreference = Object.prototype.hasOwnProperty.call(data, STORAGE_KEY_TOKEN_SESSION_ONLY);
        _state.tokenSessionOnly = hasStoragePreference
            ? data[STORAGE_KEY_TOKEN_SESSION_ONLY] === true
            : !hasStoredToken;
        if (_state.tokenSessionOnly) {
            const sessionToken = await readSessionToken();
            if (sessionToken) {
                _state.token = sessionToken;
                _state.tokenVerified = true;
            } else if (data[STORAGE_KEY_TOKEN]) {
                await writeSessionToken(data[STORAGE_KEY_TOKEN]);
                await chrome.storage.local.remove(STORAGE_KEY_TOKEN);
                _state.token = data[STORAGE_KEY_TOKEN];
                _state.tokenVerified = true;
            } else if (data[STORAGE_KEY_TOKEN_LEGACY]) {
                const legacy = await _legacyDecryptToken(data[STORAGE_KEY_TOKEN_LEGACY]);
                if (legacy) {
                    await writeSessionToken(legacy);
                    await chrome.storage.local.remove(STORAGE_KEY_TOKEN_LEGACY);
                    _state.token = legacy;
                    _state.tokenVerified = true;
                }
            }
        } else if (data[STORAGE_KEY_TOKEN]) {
            _state.token = data[STORAGE_KEY_TOKEN];
            _state.tokenVerified = !!_state.token;
        } else if (data[STORAGE_KEY_TOKEN_LEGACY]) {
            // Migrate: decrypt with the legacy hardcoded key once, then
            // re-save plaintext + drop the legacy entry.
            const legacy = await _legacyDecryptToken(data[STORAGE_KEY_TOKEN_LEGACY]);
            if (legacy) {
                _state.token = legacy;
                _state.tokenVerified = true;
                try {
                    await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: legacy });
                    await chrome.storage.local.remove(STORAGE_KEY_TOKEN_LEGACY);
                } catch (_e) { /* migration is best-effort; reload will retry */ }
            }
        }
        _state.autoSync = !!data[STORAGE_KEY_AUTOSYNC];
    }

    // chrome.storage.local.set / .remove use the Promise API in MV3; the
    // legacy callback signature is deprecated and — critically — when the
    // underlying write rejects (quota exhausted, disk full), the legacy
    // callback never fires. The previous `new Promise(resolve => set(..,
    // () => resolve()))` pattern would hang indefinitely on rejection,
    // freezing the caller. Use the modern Promise API and propagate
    // failures so the UI can surface them.
    async function saveToken(token, options = {}) {
        try {
            const sessionOnly = options.sessionOnly === true || _state.tokenSessionOnly === true;
            await chrome.storage.local.set({ [STORAGE_KEY_TOKEN_SESSION_ONLY]: sessionOnly });
            if (sessionOnly) {
                await writeSessionToken(token);
                await chrome.storage.local.remove([STORAGE_KEY_TOKEN, STORAGE_KEY_TOKEN_LEGACY]);
            } else {
                await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: token });
                await clearSessionToken();
                await chrome.storage.local.remove(STORAGE_KEY_TOKEN_LEGACY);
            }
            _state.token = token;
            _state.tokenVerified = true;
            _state.tokenSessionOnly = sessionOnly;
        } catch (e) {
            console.error('[gist] saveToken failed:', e);
            throw e;
        }
    }

    async function clearToken() {
        try {
            // Remove both the new and the (defensively, in case migration
            // didn't fire yet) legacy entry.
            await chrome.storage.local.remove([STORAGE_KEY_TOKEN, STORAGE_KEY_TOKEN_LEGACY]);
            await clearSessionToken();
        } catch (e) {
            console.warn('[gist] clearToken failed:', e);
            // Don't re-throw — caller treats clearToken as best-effort.
        }
        _state.token = null;
        _state.tokenVerified = false;
    }

    async function setTokenSessionOnly(sessionOnly) {
        const next = sessionOnly === true;
        const token = _state.token;
        _state.tokenSessionOnly = next;
        await chrome.storage.local.set({ [STORAGE_KEY_TOKEN_SESSION_ONLY]: next });
        if (token) {
            await saveToken(token, { sessionOnly: next });
        } else if (!next) {
            await clearSessionToken();
        }
    }

    function saveAutoSync(val) {
        _state.autoSync = val;
        chrome.storage.local.set({ [STORAGE_KEY_AUTOSYNC]: val }).catch((e) => {
            console.warn('[gist] saveAutoSync failed:', e);
        });
    }

    async function syncLinkedScriptOnSave(scriptId) {
        if (!_state.autoSync || !scriptId || !isConfigured()) return { skipped: true };
        const script = _state.getScript?.(scriptId);
        if (!script?.settings?.gistId) return { skipped: true };
        return await syncToGist(scriptId);
    }

    // =========================================
    // GitHub API helpers
    // =========================================
    function apiHeaders() {
        const h = {
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
        };
        if (_state.token) h['Authorization'] = `Bearer ${_state.token}`;
        return h;
    }

    function assertGitHubEndpoint(url, allowedHosts, label) {
        let parsed;
        try { parsed = new URL(url); } catch { throw new Error(`${label} URL is invalid`); }
        if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname.toLowerCase())) {
            throw new Error(`${label} must use an official GitHub HTTPS endpoint`);
        }
        return parsed;
    }

    async function fetchGitHub(url, options, allowedHosts, label) {
        assertGitHubEndpoint(url, allowedHosts, label);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            assertGitHubEndpoint(response.url || url, allowedHosts, `${label} redirect`);
            return response;
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error(`${label} timed out after ${NETWORK_TIMEOUT_MS / 1000} seconds`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function readTextBounded(response, maxBytes, label) {
        const declared = Number.parseInt(response.headers?.get?.('content-length') || '0', 10);
        if (Number.isFinite(declared) && declared > maxBytes) {
            throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
        }
        if (!response.body?.getReader) {
            const text = await response.text();
            if (new TextEncoder().encode(text).byteLength > maxBytes) {
                throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
            }
            return text;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const chunks = [];
        let bytesRead = 0;
        try {
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                if (!value) continue;
                bytesRead += value.byteLength;
                if (bytesRead > maxBytes) {
                    try { await reader.cancel(); } catch { /* stream already closed */ }
                    throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
                }
                chunks.push(decoder.decode(value, { stream: true }));
            }
            chunks.push(decoder.decode());
            return chunks.join('');
        } finally {
            try { reader.releaseLock(); } catch { /* stream already released */ }
        }
    }

    async function readJsonBounded(response, maxBytes, label) {
        // Test adapters and older extension mocks may expose json() without a
        // Response-compatible text() method. Real browser responses always use
        // the bounded text path below.
        if (typeof response?.text !== 'function' && typeof response?.json === 'function') {
            return response.json();
        }
        const text = await readTextBounded(response, maxBytes, label);
        if (!text.trim()) return {};
        try { return JSON.parse(text); } catch { throw new Error(`${label} returned invalid JSON`); }
    }

    async function apiRequest(url, options = {}) {
        const resp = await fetchGitHub(
            url,
            { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } },
            GITHUB_API_HOSTS,
            'GitHub API request'
        );
        if (!resp.ok) {
            const body = await readJsonBounded(resp, 256 * 1024, 'GitHub API error').catch(() => ({}));
            throw new Error(body.message || `GitHub API error ${resp.status}`);
        }
        return readJsonBounded(resp, MAX_API_RESPONSE_BYTES, 'GitHub API response');
    }

    function rawFileHeaders() {
        const h = { 'Accept': 'text/plain, application/octet-stream, */*' };
        if (_state.token) h['Authorization'] = `Bearer ${_state.token}`;
        return h;
    }

    async function resolveGistFileContent(file, filename) {
        if (!file || typeof file !== 'object') return '';
        if (file.truncated !== true) {
            const content = typeof file.content === 'string' ? file.content : '';
            if (new TextEncoder().encode(content).byteLength > MAX_GIST_FILE_BYTES) {
                throw new Error(`Gist file ${filename} exceeds the ${MAX_GIST_FILE_BYTES / 1024 / 1024} MB limit`);
            }
            return content;
        }
        if (!file.raw_url) throw new Error(`Gist file ${filename} is truncated and has no raw URL`);

        const resp = await fetchGitHub(
            file.raw_url,
            { headers: rawFileHeaders() },
            GITHUB_RAW_HOSTS,
            `Gist file ${filename}`
        );
        if (!resp.ok) throw new Error(`Failed to fetch full Gist file ${filename} (${resp.status})`);
        return await readTextBounded(resp, MAX_GIST_FILE_BYTES, `Gist file ${filename}`);
    }

    function extractGistId(input) {
        if (!input) return null;
        input = input.trim();
        // Direct ID (hex string)
        if (/^[a-f0-9]{20,}$/i.test(input)) return input;
        // gist.github.com/user/id or gist.github.com/id
        let m = input.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i);
        if (m) return m[1];
        // api.github.com/gists/id
        m = input.match(/api\.github\.com\/gists\/([a-f0-9]+)/i);
        if (m) return m[1];
        return null;
    }

    function parseUserscriptMeta(code) {
        const meta = {};
        const block = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
        if (!block) return meta;
        const lines = block[1].split('\n');
        for (const line of lines) {
            const m = line.match(/\/\/\s*@(\S+)\s+(.*)/);
            if (m) {
                const key = m[1].trim();
                const val = m[2].trim();
                if (meta[key]) {
                    if (!Array.isArray(meta[key])) meta[key] = [meta[key]];
                    meta[key].push(val);
                } else {
                    meta[key] = val;
                }
            }
        }
        return meta;
    }

    function makeFilename(name) {
        return (name || 'script').replace(/[^a-zA-Z0-9_-]/g, '_') + '.user.js';
    }

    function closeModal() {
        if (_state.modalEl) {
            _state.modalEl.remove();
            _state.modalEl = null;
        }
    }

    // =========================================
    // Token verification
    // =========================================
    async function verifyToken() {
        try {
            const resp = await fetchGitHub(
                'https://api.github.com/user',
                { headers: apiHeaders() },
                GITHUB_API_HOSTS,
                'GitHub token verification'
            );
            if (!resp.ok) return { valid: false, scopes: [] };
            const rawScopes = resp.headers.get('x-oauth-scopes');
            const hasScopeHeader = rawScopes != null && rawScopes !== '';
            const scopes = (rawScopes || '').split(',').map(s => s.trim()).filter(Boolean);
            const user = await readJsonBounded(resp, 512 * 1024, 'GitHub user response');
            return { valid: true, scopes, login: user.login, hasGistScope: !hasScopeHeader || scopes.includes('gist'), hasScopeHeader };
        } catch {
            return { valid: false, scopes: [] };
        }
    }

    function tokenScopeInfo(result) {
        if (!result.hasScopeHeader) return 'scope header unavailable; fine-grained token accepted';
        return result.hasGistScope ? 'gist scope present' : 'WARNING: gist scope missing';
    }

    function tokenScopeToastType(result) {
        return result.hasGistScope ? 'success' : 'error';
    }

    // =========================================
    // Core API functions
    // =========================================
    async function exportToGist(scriptId, isPublic = false) {
        if (!_state.token) throw new Error('GitHub token not configured');
        const script = _state.getScript?.(scriptId);
        if (!script) throw new Error('Script not found');

        const code = script.code || '';
        const meta = parseUserscriptMeta(code);
        const name = meta.name || script.name || 'Untitled';
        const filename = makeFilename(name);
        const description = [
            `${name}`,
            meta.version ? ` v${meta.version}` : '',
            meta.author ? ` by ${meta.author}` : '',
            ' — exported from ScriptVault'
        ].join('');

        // Check if already linked to a gist
        const existingGistId = script.settings?.gistId;
        if (existingGistId) {
            // Update existing gist
            const gist = await apiRequest(`${API_BASE}/${existingGistId}`, {
                method: 'PATCH',
                body: JSON.stringify({ description, files: { [filename]: { content: code } } })
            });
            return { url: gist.html_url, id: gist.id, updated: true };
        }

        const gist = await apiRequest(API_BASE, {
            method: 'POST',
            body: JSON.stringify({
                description,
                public: isPublic,
                files: { [filename]: { content: code } }
            })
        });

        // Link script to gist
        if (_state.updateScript) {
            _state.updateScript(scriptId, {
                settings: { ...(script.settings || {}), gistId: gist.id }
            });
        }

        return { url: gist.html_url, id: gist.id, updated: false };
    }

    async function importFromGist(gistUrl) {
        const gistId = extractGistId(gistUrl);
        if (!gistId) throw new Error('Invalid Gist URL or ID');

        const gist = await apiRequest(`${API_BASE}/${gistId}`, {
            headers: _state.token ? apiHeaders() : { 'Accept': 'application/vnd.github+json' }
        });

        if (!gist || !gist.files || typeof gist.files !== 'object') {
            throw new Error('No .user.js files found in this Gist');
        }

        const scripts = [];
        for (const [filename, file] of Object.entries(gist.files)) {
            if (filename.endsWith('.user.js')) {
                const code = await resolveGistFileContent(file, filename);
                const meta = parseUserscriptMeta(code);
                const allScripts = _state.getAllScripts?.() || [];
                const installed = allScripts.some(s => {
                    const sMeta = parseUserscriptMeta(s.code || '');
                    return sMeta.name && sMeta.name === meta.name;
                });
                scripts.push({
                    filename,
                    code,
                    meta,
                    installed,
                    gistId: gist.id,
                    gistUrl: gist.html_url,
                    owner: gist.owner?.login || 'anonymous'
                });
            }
        }

        if (scripts.length === 0) throw new Error('No .user.js files found in this Gist');
        return scripts;
    }

    async function syncToGist(scriptId) {
        if (!_state.token) throw new Error('GitHub token not configured');
        const script = _state.getScript?.(scriptId);
        if (!script) throw new Error('Script not found');
        const gistId = script.settings?.gistId;
        if (!gistId) throw new Error('Script is not linked to a Gist. Export first.');

        const code = script.code || '';
        const meta = parseUserscriptMeta(code);
        const name = meta.name || script.name || 'Untitled';
        const filename = makeFilename(name);
        const description = [
            name,
            meta.version ? ` v${meta.version}` : '',
            meta.author ? ` by ${meta.author}` : '',
            ' — exported from ScriptVault'
        ].join('');

        const gist = await apiRequest(`${API_BASE}/${gistId}`, {
            method: 'PATCH',
            body: JSON.stringify({ description, files: { [filename]: { content: code } } })
        });

        return { url: gist.html_url, updatedAt: gist.updated_at };
    }

    async function syncFromGist(scriptId) {
        if (!_state.token) throw new Error('GitHub token not configured');
        const script = _state.getScript?.(scriptId);
        if (!script) throw new Error('Script not found');
        const gistId = script.settings?.gistId;
        if (!gistId) throw new Error('Script is not linked to a Gist');

        const gist = await apiRequest(`${API_BASE}/${gistId}`);

        // Find the .user.js file
        if (!gist || !gist.files || typeof gist.files !== 'object') {
            throw new Error('No .user.js files in linked Gist');
        }
        const files = Object.entries(gist.files).filter(([f]) => f.endsWith('.user.js'));
        if (files.length === 0) throw new Error('No .user.js files in linked Gist');

        const [filename, file] = files[0];
        const code = await resolveGistFileContent(file, filename);
        return {
            code,
            filename,
            updatedAt: gist.updated_at,
            gistUrl: gist.html_url
        };
    }

    async function listUserGists() {
        if (!_state.token) throw new Error('GitHub token not configured');

        const now = Date.now();
        if (_state.gistCache.length > 0 && (now - _state.cacheTime) < CACHE_TTL) {
            return _state.gistCache;
        }

        const gists = [];
        let page = 1;
        const maxPages = 5;

        while (page <= maxPages) {
            const batch = await apiRequest(`${API_BASE}?per_page=100&page=${page}`);
            if (batch.length === 0) break;
            gists.push(...batch);
            if (batch.length < 100) break;
            page++;
        }

        // Filter and enrich with script metadata
        const scriptGists = [];
        for (const gist of gists) {
            const userJsFiles = Object.entries(gist.files).filter(([f]) => f.endsWith('.user.js'));
            if (userJsFiles.length === 0) continue;
            scriptGists.push({
                id: gist.id,
                url: gist.html_url,
                description: gist.description || '',
                isPublic: gist.public,
                createdAt: gist.created_at,
                updatedAt: gist.updated_at,
                files: userJsFiles.map(([name, f]) => ({ name, size: f.size, rawUrl: f.raw_url })),
                owner: gist.owner?.login || 'anonymous'
            });
        }

        _state.gistCache = scriptGists;
        _state.cacheTime = now;
        return scriptGists;
    }

    function isConfigured() {
        return _state.tokenVerified && !!_state.token;
    }

    // =========================================
    // CSS (injected once)
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'gist-integration-styles';
        style.textContent = `
/* Gist Integration Styles */
.gi-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-body, #1a1a1a);
    color: var(--text-primary, #e0e0e0);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.8125rem;
}
.gi-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-header, #252525);
    border-bottom: 1px solid var(--border-color, #404040);
}
.gi-header-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
    flex: 1;
}
.gi-header-title svg {
    width: 18px;
    height: 18px;
    vertical-align: middle;
    margin-inline-end: 6px;
}
.gi-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #404040);
    background: var(--bg-header, #252525);
}
.gi-tab {
    padding: 8px 16px;
    background: none;
    border: none;
    color: var(--text-secondary, #a0a0a0);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
}
.gi-tab:hover {
    color: var(--text-primary, #e0e0e0);
}
.gi-tab.active {
    color: var(--accent-green, #4ade80);
    border-bottom-color: var(--accent-green, #4ade80);
}
.gi-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.gi-section {
    margin-bottom: 20px;
}
.gi-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary, #a0a0a0);
    margin-bottom: 10px;
}
.gi-input-group {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}
.gi-input {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-input, #333333);
    border: 1px solid var(--border-color, #404040);
    border-radius: var(--sv-radius-control);
    color: var(--text-primary, #e0e0e0);
    font-size: 0.8125rem;
    outline: none;
    transition: border-color 0.15s;
}
.gi-input:focus {
    border-color: var(--accent-green, #4ade80);
}
.gi-input::placeholder {
    color: var(--text-muted, #707070);
}
.gi-btn {
    padding: 8px 16px;
    border: none;
    border-radius: var(--sv-radius-control);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
}
.gi-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.gi-btn-primary {
    background: var(--accent-green-dark, #22c55e);
    color: var(--sv-text-on-accent);
}
.gi-btn-primary:hover:not(:disabled) {
    background: var(--accent-green, #4ade80);
}
.gi-btn-secondary {
    background: var(--bg-input, #333333);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
}
.gi-btn-secondary:hover:not(:disabled) {
    background: var(--bg-row-hover, #333333);
    border-color: var(--text-secondary, #a0a0a0);
}
.gi-btn-danger {
    background: var(--accent-red, #f87171);
    color: var(--sv-text-on-danger);
}
.gi-btn-danger:hover:not(:disabled) {
    opacity: 0.85;
}
.gi-btn-sm {
    padding: 5px 10px;
    font-size: 0.6875rem;
}
.gi-gist-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.gi-gist-card {
    background: var(--bg-row, #2a2a2a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 8px;
    padding: 12px;
    transition: border-color 0.15s;
}
.gi-gist-card:hover {
    border-color: var(--accent-green, #4ade80);
}
.gi-gist-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}
.gi-gist-card-name {
    font-weight: 600;
    color: var(--accent-blue, #60a5fa);
    font-size: 0.8125rem;
}
.gi-gist-card-badge {
    font-size: 0.625rem;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
}
.gi-badge-public {
    background: rgba(74, 222, 128, 0.15);
    color: var(--accent-green, #4ade80);
}
.gi-badge-secret {
    background: rgba(251, 191, 36, 0.15);
    color: var(--accent-yellow, #fbbf24);
}
.gi-gist-card-desc {
    color: var(--text-secondary, #a0a0a0);
    font-size: 0.75rem;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.gi-gist-card-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.6875rem;
    color: var(--text-muted, #707070);
}
.gi-gist-card-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}
.gi-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6875rem;
    padding: 3px 8px;
    border-radius: 4px;
}
.gi-status-synced {
    background: rgba(74, 222, 128, 0.12);
    color: var(--accent-green, #4ade80);
}
.gi-status-unsynced {
    background: rgba(251, 191, 36, 0.12);
    color: var(--accent-yellow, #fbbf24);
}
.gi-status-error {
    background: rgba(248, 113, 113, 0.12);
    color: var(--accent-red, #f87171);
}
.gi-token-mask {
    font-family: monospace;
    letter-spacing: 1px;
}
.gi-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
}
.gi-toggle-label {
    color: var(--text-primary, #e0e0e0);
    font-size: 0.8125rem;
}
.gi-toggle-desc {
    color: var(--text-secondary, #a0a0a0);
    font-size: 0.6875rem;
    margin-top: 2px;
}
.gi-toggle {
    position: relative;
    width: 36px;
    height: 20px;
    background: var(--toggle-off, #555555);
    border-radius: 10px;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
    flex-shrink: 0;
}
.gi-toggle.on {
    background: var(--toggle-on, #22c55e);
}
.gi-toggle::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 6px;
    background: var(--sv-control-thumb);
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
}
.gi-toggle.on::after {
    transform: translateX(16px);
}
.gi-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 0.8125rem;
    z-index: 10001;
    animation: gi-toast-in 0.25s ease, gi-toast-out 0.25s ease 2.5s forwards;
    pointer-events: none;
}
.gi-toast-success { background: var(--accent-green-dark, #22c55e); color: var(--sv-text-on-accent); }
.gi-toast-error { background: var(--accent-red, #f87171); color: var(--sv-text-on-danger); }
.gi-toast-info { background: var(--accent-blue, #60a5fa); color: var(--sv-text-on-info); }
@keyframes gi-toast-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes gi-toast-out {
    from { opacity: 1; }
    to { opacity: 0; }
}
.gi-preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: gi-fadein 0.15s ease;
}
@keyframes gi-fadein {
    from { opacity: 0; }
    to { opacity: 1; }
}
.gi-preview-modal {
    background: var(--bg-header, #252525);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
    border-radius: 10px;
    width: 620px;
    max-width: 95vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.gi-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-color, #404040);
}
.gi-preview-header h3 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
}
.gi-preview-close {
    background: none;
    border: none;
    color: var(--text-secondary, #a0a0a0);
    cursor: pointer;
    font-size: 1.125rem;
    padding: 4px;
    line-height: 1;
}
.gi-preview-close:hover {
    color: var(--text-primary, #e0e0e0);
}
.gi-preview-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.gi-preview-code {
    background: var(--bg-body, #1a1a1a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    padding: 12px;
    font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 300px;
    overflow-y: auto;
    color: var(--text-primary, #e0e0e0);
}
.gi-preview-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    margin-bottom: 12px;
    font-size: 0.75rem;
}
.gi-preview-meta dt {
    color: var(--text-secondary, #a0a0a0);
    font-weight: 500;
}
.gi-preview-meta dd {
    color: var(--text-primary, #e0e0e0);
    margin: 0;
}
.gi-preview-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #404040);
}
.gi-empty {
    text-align: center;
    padding: 40px 16px;
    color: var(--text-muted, #707070);
}
.gi-empty svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.4;
}
.gi-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color, #404040);
    border-top-color: var(--accent-green, #4ade80);
    border-radius: 6px;
    animation: gi-spin 0.6s linear infinite;
    margin-inline-end: 6px;
    vertical-align: middle;
}
@keyframes gi-spin {
    to { transform: rotate(360deg); }
}
.gi-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--text-secondary, #a0a0a0);
    font-size: 0.8125rem;
}
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // UI helpers
    // =========================================
    const GITHUB_ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
    const SYNC_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8a6 6 0 0110.89-3.48M14 8a6 6 0 01-10.89 3.48"/><path d="M14 3v3h-3M2 13v-3h3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `gi-toast gi-toast-${type}`;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // =========================================
    // UI rendering
    // =========================================
    let activeTab = 'import';

    function render() {
        if (!_state.container) return;
        const c = _state.container;
        c.replaceChildren();

        // Header
        const header = document.createElement('div');
        header.className = 'gi-header';
        _safeSetHtml(header, `<div class="gi-header-title">${GITHUB_ICON} GitHub Gist Integration</div>`);
        if (!isConfigured()) {
            const cfgBtn = document.createElement('button');
            cfgBtn.className = 'gi-btn gi-btn-primary gi-btn-sm';
            cfgBtn.textContent = 'Configure Token';
            cfgBtn.onclick = () => { activeTab = 'settings'; render(); };
            header.appendChild(cfgBtn);
        }
        c.appendChild(header);

        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'gi-tabs';
        const tabDefs = [
            { id: 'import', label: 'Import' },
            { id: 'browse', label: 'My Gists' },
            { id: 'settings', label: 'Settings' }
        ];
        for (const t of tabDefs) {
            const btn = document.createElement('button');
            btn.className = `gi-tab${activeTab === t.id ? ' active' : ''}`;
            btn.textContent = t.label;
            btn.onclick = () => { activeTab = t.id; render(); };
            tabs.appendChild(btn);
        }
        c.appendChild(tabs);

        // Content
        const content = document.createElement('div');
        content.className = 'gi-content';
        c.appendChild(content);

        switch (activeTab) {
            case 'import': renderImportTab(content); break;
            case 'browse': renderBrowseTab(content); break;
            case 'settings': renderSettingsTab(content); break;
        }
    }

    function renderImportTab(container) {
        const section = document.createElement('div');
        section.className = 'gi-section';
        _safeSetHtml(section, `<div class="gi-section-title">Import from Gist URL</div>`);

        const row = document.createElement('div');
        row.className = 'gi-input-group';
        const input = document.createElement('input');
        input.className = 'gi-input';
        input.type = 'url';
        input.name = 'gistImportUrl';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = 'Paste Gist URL or ID (e.g. gist.github.com/user/abc123)…';
        row.appendChild(input);

        const btn = document.createElement('button');
        btn.className = 'gi-btn gi-btn-primary';
        btn.type = 'button';
        btn.textContent = 'Fetch';
        btn.addEventListener('click', async () => {
            const url = input.value.trim();
            if (!url) return;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            _safeSetHtml(btn, '<span class="gi-spinner"></span>Fetching…');
            try {
                const scripts = await importFromGist(url);
                showImportPreview(scripts);
            } catch (e) {
                toast(e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.textContent = 'Fetch';
            }
        });
        row.appendChild(btn);
        section.appendChild(row);

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:0.6875rem;color:var(--text-muted,#707070);margin-top:-4px;';
        hint.textContent = 'Supports gist.github.com URLs, API URLs, or raw Gist IDs';
        section.appendChild(hint);

        container.appendChild(section);
    }

    function showImportPreview(scripts) {
        closeModal();

        const overlay = document.createElement('div');
        overlay.className = 'gi-preview-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        const modal = document.createElement('div');
        modal.className = 'gi-preview-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', `Import Scripts (${scripts.length} found)`);

        // Header
        const header = document.createElement('div');
        header.className = 'gi-preview-header';
        _safeSetHtml(header, `<h3>Import Scripts (${scripts.length} found)</h3>`);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'gi-preview-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close import preview');
        _safeSetHtml(closeBtn, '&times;');
        closeBtn.addEventListener('click', closeModal);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'gi-preview-body';

        for (const script of scripts) {
            const card = document.createElement('div');
            card.style.cssText = 'margin-bottom:16px;';

            const meta = script.meta;
            const dl = document.createElement('dl');
            dl.className = 'gi-preview-meta';
            const fields = [
                ['Name', meta.name || script.filename],
                ['Version', meta.version || 'N/A'],
                ['Author', meta.author || 'Unknown'],
                ['Match', Array.isArray(meta.match) ? meta.match.join(', ') : (meta.match || 'N/A')],
                ['Status', script.installed ? 'Already installed' : 'Not installed']
            ];
            let _dlHtml = '';
            for (const [k, v] of fields) {
                _dlHtml += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`;
            }
            _safeSetHtml(dl, _dlHtml);
            card.appendChild(dl);

            const code = document.createElement('pre');
            code.className = 'gi-preview-code';
            code.textContent = script.code.substring(0, 2000) + (script.code.length > 2000 ? '\n...' : '');
            card.appendChild(code);

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:8px;margin-top:8px;';

            const installBtn = document.createElement('button');
            installBtn.className = `gi-btn ${script.installed ? 'gi-btn-secondary' : 'gi-btn-primary'} gi-btn-sm`;
            installBtn.type = 'button';
            installBtn.textContent = script.installed ? 'Reinstall' : 'Install';
            installBtn.addEventListener('click', async () => {
                if (!_state.onInstallScript) {
                    toast('Install integration is unavailable right now', 'error');
                    return;
                }

                const originalText = installBtn.textContent;
                installBtn.disabled = true;
                _safeSetHtml(installBtn, '<span class="gi-spinner"></span>Installing…');

                try {
                    const result = await Promise.resolve(_state.onInstallScript(script.code, {
                        meta: script.meta,
                        gistId: script.gistId,
                        gistUrl: script.gistUrl
                    }));
                    if (result?.success === false || result?.error) {
                        throw new Error(result.error || 'Install failed');
                    }

                    script.installed = true;
                    installBtn.textContent = 'Installed';
                    const statusField = dl.querySelector('dd:last-child');
                    if (statusField) statusField.textContent = 'Installed';
                    toast(`Installed: ${meta.name || script.filename}`, 'success');
                } catch (e) {
                    installBtn.disabled = false;
                    installBtn.textContent = originalText;
                    toast(e.message || 'Install failed', 'error');
                }
            });
            actions.appendChild(installBtn);
            card.appendChild(actions);
            body.appendChild(card);
        }

        modal.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'gi-preview-footer';
        const closeFooter = document.createElement('button');
        closeFooter.className = 'gi-btn gi-btn-secondary';
        closeFooter.type = 'button';
        closeFooter.textContent = 'Close';
        closeFooter.addEventListener('click', closeModal);
        footer.appendChild(closeFooter);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        _state.modalEl = overlay;
        closeBtn.focus({ preventScroll: true });
    }

    function renderBrowseTab(container) {
        if (!isConfigured()) {
            _safeSetHtml(container, `<div class="gi-empty"><p>Configure your GitHub token in Settings to browse your Gists.</p></div>`);
            return;
        }

        const loading = document.createElement('div');
        loading.className = 'gi-loading';
        _safeSetHtml(loading, '<span class="gi-spinner"></span> Loading your Gists…');
        container.appendChild(loading);

        listUserGists().then(gists => {
            container.replaceChildren();
            if (gists.length === 0) {
                _safeSetHtml(container, `<div class="gi-empty"><p>No .user.js Gists found in your account.</p></div>`);
                return;
            }

            // Search
            const searchRow = document.createElement('div');
            searchRow.className = 'gi-input-group';
            searchRow.style.marginBottom = '16px';
            const searchInput = document.createElement('input');
            searchInput.className = 'gi-input';
            searchInput.type = 'search';
            searchInput.name = 'gistSearch';
            searchInput.autocomplete = 'off';
            searchInput.spellcheck = false;
            searchInput.placeholder = 'Search Gists…';
            searchInput.addEventListener('input', () => {
                const q = searchInput.value.toLowerCase();
                const cards = listEl.querySelectorAll('.gi-gist-card');
                cards.forEach(c => {
                    c.style.display = c.dataset.search.includes(q) ? '' : 'none';
                });
            });
            searchRow.appendChild(searchInput);
            container.appendChild(searchRow);

            const listEl = document.createElement('div');
            listEl.className = 'gi-gist-list';

            for (const gist of gists) {
                const card = document.createElement('div');
                card.className = 'gi-gist-card';
                card.dataset.search = `${gist.description} ${gist.files.map(f => f.name).join(' ')}`.toLowerCase();

                const headerRow = document.createElement('div');
                headerRow.className = 'gi-gist-card-header';
                const name = document.createElement('span');
                name.className = 'gi-gist-card-name';
                name.textContent = gist.files.map(f => f.name).join(', ');
                headerRow.appendChild(name);

                const badge = document.createElement('span');
                badge.className = `gi-gist-card-badge ${gist.isPublic ? 'gi-badge-public' : 'gi-badge-secret'}`;
                badge.textContent = gist.isPublic ? 'Public' : 'Secret';
                headerRow.appendChild(badge);
                card.appendChild(headerRow);

                if (gist.description) {
                    const desc = document.createElement('div');
                    desc.className = 'gi-gist-card-desc';
                    desc.textContent = gist.description;
                    card.appendChild(desc);
                }

                const metaRow = document.createElement('div');
                metaRow.className = 'gi-gist-card-meta';
                _safeSetHtml(metaRow, `<span>Updated ${formatDate(gist.updatedAt)}</span><span>${gist.files.length} file(s)</span>`);
                card.appendChild(metaRow);

                const actions = document.createElement('div');
                actions.className = 'gi-gist-card-actions';

                const importBtn = document.createElement('button');
                importBtn.className = 'gi-btn gi-btn-primary gi-btn-sm';
                importBtn.textContent = 'Import';
                importBtn.onclick = async () => {
                    importBtn.disabled = true;
                    _safeSetHtml(importBtn, '<span class="gi-spinner"></span>');
                    try {
                        const scripts = await importFromGist(gist.id);
                        showImportPreview(scripts);
                    } catch (e) {
                        toast(e.message, 'error');
                    } finally {
                        importBtn.disabled = false;
                        importBtn.textContent = 'Import';
                    }
                };
                actions.appendChild(importBtn);

                const openBtn = document.createElement('button');
                openBtn.className = 'gi-btn gi-btn-secondary gi-btn-sm';
                openBtn.textContent = 'Open';
                openBtn.onclick = () => window.open(gist.url, '_blank');
                actions.appendChild(openBtn);

                card.appendChild(actions);
                listEl.appendChild(card);
            }

            container.appendChild(listEl);
        }).catch(e => {
            _safeSetHtml(container, `<div class="gi-empty"><p style="color:var(--accent-red)">${escapeHtml(e.message)}</p></div>`);
        });
    }

    function renderSettingsTab(container) {
        // Token section
        const tokenSection = document.createElement('div');
        tokenSection.className = 'gi-section';
        _safeSetHtml(tokenSection, `<div class="gi-section-title">GitHub Personal Access Token</div>`);

        if (isConfigured()) {
            const maskedRow = document.createElement('div');
            maskedRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
            const masked = document.createElement('span');
            masked.className = 'gi-token-mask';
            masked.textContent = _state.token ? `ghp_${'*'.repeat(20)}${_state.token.slice(-4)}` : '****';
            masked.style.color = 'var(--accent-green, #4ade80)';
            maskedRow.appendChild(masked);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'gi-btn gi-btn-danger gi-btn-sm';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = async () => {
                await clearToken();
                toast('Token removed', 'info');
                render();
            };
            maskedRow.appendChild(removeBtn);

            const verifyBtn = document.createElement('button');
            verifyBtn.className = 'gi-btn gi-btn-secondary gi-btn-sm';
            verifyBtn.textContent = 'Verify';
            verifyBtn.onclick = async () => {
                verifyBtn.disabled = true;
                _safeSetHtml(verifyBtn, '<span class="gi-spinner"></span>');
                const result = await verifyToken();
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify';
                if (result.valid) {
                    toast(`Token valid for @${result.login} (${tokenScopeInfo(result)})`, tokenScopeToastType(result));
                } else {
                    toast('Token is invalid or expired', 'error');
                }
            };
            maskedRow.appendChild(verifyBtn);
            tokenSection.appendChild(maskedRow);

            const disclosure = document.createElement('div');
            disclosure.style.cssText = 'font-size:0.6875rem;color:var(--text-muted,#707070);line-height:1.5;margin-bottom:12px;';
            disclosure.textContent = _state.tokenSessionOnly
                ? `Token storage: ${hasSessionStorage() ? 'chrome.storage.session' : 'memory-session fallback'}. Re-enter after browser restart; revoke the token itself in GitHub settings if it should stop working everywhere.`
                : 'Token storage: gist_pat in chrome.storage.local. ScriptVault can clear the local copy here; revoke the token itself in GitHub settings if it should stop working everywhere.';
            tokenSection.appendChild(disclosure);
        } else {
            const inputRow = document.createElement('div');
            inputRow.className = 'gi-input-group';
            const input = document.createElement('input');
            input.className = 'gi-input';
            input.type = 'password';
            input.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
            inputRow.appendChild(input);

            const saveBtn = document.createElement('button');
            saveBtn.className = 'gi-btn gi-btn-primary';
            saveBtn.textContent = 'Save Token';
            saveBtn.onclick = async () => {
                const token = input.value.trim();
                if (!token) return;
                saveBtn.disabled = true;
                _safeSetHtml(saveBtn, '<span class="gi-spinner"></span>');
                await saveToken(token);
                const result = await verifyToken();
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Token';
                if (result.valid) {
                    toast(`Token saved. Logged in as @${result.login} (${tokenScopeInfo(result)})`, tokenScopeToastType(result));
                } else {
                    toast('Token saved but could not verify. Check the token value.', 'error');
                }
                render();
            };
            inputRow.appendChild(saveBtn);
            tokenSection.appendChild(inputRow);

            const hint = document.createElement('div');
            hint.style.cssText = 'font-size:0.6875rem;color:var(--text-muted,#707070);';
            _safeSetHtml(hint, 'Generate a token at <a href="https://github.com/settings/tokens/new?scopes=gist&description=ScriptVault" target="_blank" style="color:var(--accent-blue,#60a5fa)">GitHub Settings</a> with the <strong>gist</strong> scope. Use session-only storage if the token should not be retained after browser restart.');
            tokenSection.appendChild(hint);
        }
        const storageRow = document.createElement('label');
        storageRow.className = 'gi-toggle-row';
        const storageCopy = document.createElement('div');
        _safeSetHtml(storageCopy, `<div class="gi-toggle-label">Session-only token storage</div><div class="gi-toggle-desc">Do not write the Gist PAT to persistent extension storage</div>`);
        storageRow.appendChild(storageCopy);
        const storageToggle = document.createElement('input');
        storageToggle.type = 'checkbox';
        storageToggle.checked = _state.tokenSessionOnly === true;
        storageToggle.onchange = async () => {
            storageToggle.disabled = true;
            try {
                await setTokenSessionOnly(storageToggle.checked);
                toast(storageToggle.checked ? 'Gist token will be kept for this browser session' : 'Gist token will be remembered on this device', 'info');
                render();
            } catch (e) {
                storageToggle.checked = _state.tokenSessionOnly === true;
                toast(e.message || 'Failed to update token storage mode', 'error');
            } finally {
                storageToggle.disabled = false;
            }
        };
        storageRow.appendChild(storageToggle);
        tokenSection.appendChild(storageRow);
        container.appendChild(tokenSection);

        // Auto-sync toggle
        const syncSection = document.createElement('div');
        syncSection.className = 'gi-section';
        _safeSetHtml(syncSection, `<div class="gi-section-title">Sync Settings</div>`);

        const toggleRow = document.createElement('div');
        toggleRow.className = 'gi-toggle-row';
        const labelDiv = document.createElement('div');
        _safeSetHtml(labelDiv, `<div class="gi-toggle-label">Auto-sync on save</div><div class="gi-toggle-desc">Automatically push changes to linked Gists when saving scripts</div>`);
        toggleRow.appendChild(labelDiv);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = `gi-toggle${_state.autoSync ? ' on' : ''}`;
        toggleBtn.onclick = () => {
            _state.autoSync = !_state.autoSync;
            saveAutoSync(_state.autoSync);
            toggleBtn.classList.toggle('on', _state.autoSync);
        };
        toggleRow.appendChild(toggleBtn);
        syncSection.appendChild(toggleRow);
        container.appendChild(syncSection);
    }

    // =========================================
    // Export UI helpers (for dashboard integration)
    // =========================================
    function showExportDialog(scriptId) {
        if (!isConfigured()) {
            toast('Configure GitHub token in Gist settings first', 'error');
            return;
        }

        const script = _state.getScript?.(scriptId);
        if (!script) return;
        const meta = parseUserscriptMeta(script.code || '');

        if (_state.modalEl) _state.modalEl.remove();
        const overlay = document.createElement('div');
        overlay.className = 'gi-preview-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'gi-preview-modal';
        modal.style.width = '420px';

        const header = document.createElement('div');
        header.className = 'gi-preview-header';
        _safeSetHtml(header, `<h3>Export to GitHub Gist</h3>`);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'gi-preview-close';
        _safeSetHtml(closeBtn, '&times;');
        closeBtn.onclick = () => overlay.remove();
        header.appendChild(closeBtn);
        modal.appendChild(header);

        const body = document.createElement('div');
        body.className = 'gi-preview-body';
        _safeSetHtml(body, `
            <dl class="gi-preview-meta">
                <dt>Script</dt><dd>${escapeHtml(meta.name || script.name || 'Untitled')}</dd>
                <dt>Version</dt><dd>${escapeHtml(meta.version || 'N/A')}</dd>
                <dt>Filename</dt><dd>${escapeHtml(makeFilename(meta.name || script.name))}</dd>
            </dl>
        `);

        const visibilityRow = document.createElement('div');
        visibilityRow.className = 'gi-toggle-row';
        visibilityRow.style.marginBottom = '12px';
        _safeSetHtml(visibilityRow, `<div class="gi-toggle-label">Public Gist</div>`);
        let isPublic = false;
        const visToggle = document.createElement('button');
        visToggle.className = 'gi-toggle';
        visToggle.onclick = () => { isPublic = !isPublic; visToggle.classList.toggle('on', isPublic); };
        visibilityRow.appendChild(visToggle);
        body.appendChild(visibilityRow);

        const linkedGistId = script.settings?.gistId;
        if (linkedGistId) {
            const note = document.createElement('div');
            note.style.cssText = 'font-size:0.6875rem;color:var(--accent-yellow,#fbbf24);margin-bottom:8px;';
            note.textContent = `This script is linked to Gist ${linkedGistId.slice(0, 8)}... and will be updated.`;
            body.appendChild(note);
        }

        modal.appendChild(body);

        const footer = document.createElement('div');
        footer.className = 'gi-preview-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gi-btn gi-btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => overlay.remove();
        footer.appendChild(cancelBtn);

        const exportBtn = document.createElement('button');
        exportBtn.className = 'gi-btn gi-btn-primary';
        exportBtn.textContent = linkedGistId ? 'Update Gist' : 'Create Gist';
        exportBtn.onclick = async () => {
            exportBtn.disabled = true;
            _safeSetHtml(exportBtn, '<span class="gi-spinner"></span>Exporting...');
            try {
                const result = await exportToGist(scriptId, isPublic);
                overlay.remove();
                toast(result.updated ? 'Gist updated!' : 'Gist created!', 'success');
                // Copy URL to clipboard
                try { await navigator.clipboard.writeText(result.url); toast('URL copied to clipboard', 'info'); } catch {}
            } catch (e) {
                toast(e.message, 'error');
                exportBtn.disabled = false;
                exportBtn.textContent = linkedGistId ? 'Update Gist' : 'Create Gist';
            }
        };
        footer.appendChild(exportBtn);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        _state.modalEl = overlay;
    }

    function getSyncStatus(scriptId) {
        const script = _state.getScript?.(scriptId);
        if (!script?.settings?.gistId) return null;
        return { gistId: script.settings.gistId, linked: true };
    }

    // =========================================
    // Public API
    // =========================================
    return {
        /**
         * Initialize the Gist integration module.
         * @param {HTMLElement} containerEl - Container element to render UI into
         * @param {Object} options - Configuration
         * @param {Function} options.getScript - fn(id) => script object
         * @param {Function} options.getAllScripts - fn() => scripts[]
         * @param {Function} options.onInstallScript - fn(code) => void
         * @param {Function} options.updateScript - fn(id, changes) => void
         */
        async init(containerEl, options = {}) {
            _state.container = containerEl;
            _state.getScript = options.getScript || null;
            _state.getAllScripts = options.getAllScripts || null;
            _state.onInstallScript = options.onInstallScript || null;
            _state.updateScript = options.updateScript || null;
            injectStyles();
            await loadToken();
            render();
        },

        async exportToGist(scriptId, isPublic) {
            return exportToGist(scriptId, isPublic);
        },

        async importFromGist(gistUrl) {
            return importFromGist(gistUrl);
        },

        async syncToGist(scriptId) {
            return syncToGist(scriptId);
        },

        async syncFromGist(scriptId) {
            return syncFromGist(scriptId);
        },

        async onScriptSaved(scriptId) {
            return syncLinkedScriptOnSave(scriptId);
        },

        isAutoSyncEnabled() {
            return _state.autoSync === true;
        },

        async listUserGists() {
            return listUserGists();
        },

        isConfigured() {
            return isConfigured();
        },

        /** Show export dialog for a given script */
        showExportDialog(scriptId) {
            showExportDialog(scriptId);
        },

        /** Get sync status for a script */
        getSyncStatus(scriptId) {
            return getSyncStatus(scriptId);
        },

        /** Force re-render the panel */
        refresh() {
            render();
        },

        destroy() {
            if (_state.styleEl) { _state.styleEl.remove(); _state.styleEl = null; }
            if (_state.modalEl) { _state.modalEl.remove(); _state.modalEl = null; }
            if (_state.container) { _state.container.replaceChildren(); _state.container = null; }
            if (_state.syncIntervalId) { clearInterval(_state.syncIntervalId); _state.syncIntervalId = null; }
            _state.token = null;
            _state.tokenVerified = false;
            _state.tokenSessionOnly = false;
            _state.gistCache = [];
            _state.cacheTime = 0;
        }
    };
})();
