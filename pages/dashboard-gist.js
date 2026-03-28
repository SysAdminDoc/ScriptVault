/**
 * ScriptVault GitHub Gist Integration Module
 * Import/export userscripts to GitHub Gists, sync changes, and browse user Gists.
 * Uses GitHub Personal Access Token stored encrypted in chrome.storage.local.
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
    const STORAGE_KEY_TOKEN = 'gist_pat_encrypted';
    const STORAGE_KEY_AUTOSYNC = 'gist_autosync';
    const CACHE_TTL = 5 * 60 * 1000; // 5 min

    // =========================================
    // HTML escaping helper
    // =========================================
    function escapeHtml(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

    // =========================================
    // Encryption helpers (AES-GCM via WebCrypto)
    // =========================================
    async function getDerivedKey() {
        const raw = new TextEncoder().encode('ScriptVault-Gist-Key-v1');
        const keyMaterial = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: new TextEncoder().encode('sv-gist-salt'), iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encryptToken(token) {
        const key = await getDerivedKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        return btoa(String.fromCharCode(...combined));
    }

    async function decryptToken(stored) {
        try {
            const key = await getDerivedKey();
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
    async function loadToken() {
        const data = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_AUTOSYNC]);
        if (data[STORAGE_KEY_TOKEN]) {
            _state.token = await decryptToken(data[STORAGE_KEY_TOKEN]);
            _state.tokenVerified = !!_state.token;
        }
        _state.autoSync = !!data[STORAGE_KEY_AUTOSYNC];
    }

    async function saveToken(token) {
        const encrypted = await encryptToken(token);
        return new Promise(resolve => {
            chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: encrypted }, () => {
                _state.token = token;
                _state.tokenVerified = true;
                resolve();
            });
        });
    }

    function clearToken() {
        return new Promise(resolve => {
            chrome.storage.local.remove(STORAGE_KEY_TOKEN, () => {
                _state.token = null;
                _state.tokenVerified = false;
                resolve();
            });
        });
    }

    function saveAutoSync(val) {
        _state.autoSync = val;
        chrome.storage.local.set({ [STORAGE_KEY_AUTOSYNC]: val });
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

    async function apiRequest(url, options = {}) {
        const resp = await fetch(url, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } });
        if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.message || `GitHub API error ${resp.status}`);
        }
        return resp.json();
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

    // =========================================
    // Token verification
    // =========================================
    async function verifyToken() {
        try {
            const resp = await fetch('https://api.github.com/user', { headers: apiHeaders() });
            if (!resp.ok) return { valid: false, scopes: [] };
            const scopes = (resp.headers.get('x-oauth-scopes') || '').split(',').map(s => s.trim()).filter(Boolean);
            const user = await resp.json();
            return { valid: true, scopes, login: user.login, hasGistScope: scopes.includes('gist') };
        } catch {
            return { valid: false, scopes: [] };
        }
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

        const headers = _state.token ? apiHeaders() : { 'Accept': 'application/vnd.github+json' };
        const resp = await fetch(`${API_BASE}/${gistId}`, { headers });
        if (!resp.ok) throw new Error(`Failed to fetch Gist (${resp.status})`);
        const gist = await resp.json();

        const scripts = [];
        for (const [filename, file] of Object.entries(gist.files)) {
            if (filename.endsWith('.user.js')) {
                const meta = parseUserscriptMeta(file.content);
                const allScripts = _state.getAllScripts?.() || [];
                const installed = allScripts.some(s => {
                    const sMeta = parseUserscriptMeta(s.code || '');
                    return sMeta.name && sMeta.name === meta.name;
                });
                scripts.push({
                    filename,
                    code: file.content,
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
        const files = Object.entries(gist.files).filter(([f]) => f.endsWith('.user.js'));
        if (files.length === 0) throw new Error('No .user.js files in linked Gist');

        const [filename, file] = files[0];
        return {
            code: file.content,
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
    font-size: 13px;
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
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
    flex: 1;
}
.gi-header-title svg {
    width: 18px;
    height: 18px;
    vertical-align: middle;
    margin-right: 6px;
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
    font-size: 12px;
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
    font-size: 12px;
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
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
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
    border-radius: 6px;
    font-size: 12px;
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
    color: #fff;
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
    color: #fff;
}
.gi-btn-danger:hover:not(:disabled) {
    opacity: 0.85;
}
.gi-btn-sm {
    padding: 5px 10px;
    font-size: 11px;
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
    font-size: 13px;
}
.gi-gist-card-badge {
    font-size: 10px;
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
    font-size: 12px;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.gi-gist-card-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
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
    font-size: 11px;
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
    font-size: 13px;
}
.gi-toggle-desc {
    color: var(--text-secondary, #a0a0a0);
    font-size: 11px;
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
    border-radius: 50%;
    background: #fff;
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
    font-size: 13px;
    color: #fff;
    z-index: 10001;
    animation: gi-toast-in 0.25s ease, gi-toast-out 0.25s ease 2.5s forwards;
    pointer-events: none;
}
.gi-toast-success { background: var(--accent-green-dark, #22c55e); }
.gi-toast-error { background: var(--accent-red, #f87171); }
.gi-toast-info { background: var(--accent-blue, #60a5fa); }
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
    font-size: 14px;
    font-weight: 600;
    margin: 0;
}
.gi-preview-close {
    background: none;
    border: none;
    color: var(--text-secondary, #a0a0a0);
    cursor: pointer;
    font-size: 18px;
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
    font-size: 12px;
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
    font-size: 12px;
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
    border-radius: 50%;
    animation: gi-spin 0.6s linear infinite;
    margin-right: 6px;
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
    font-size: 13px;
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
        c.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'gi-header';
        header.innerHTML = `<div class="gi-header-title">${GITHUB_ICON} GitHub Gist Integration</div>`;
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
        section.innerHTML = `<div class="gi-section-title">Import from Gist URL</div>`;

        const row = document.createElement('div');
        row.className = 'gi-input-group';
        const input = document.createElement('input');
        input.className = 'gi-input';
        input.type = 'text';
        input.placeholder = 'Paste Gist URL or ID (e.g. gist.github.com/user/abc123)';
        row.appendChild(input);

        const btn = document.createElement('button');
        btn.className = 'gi-btn gi-btn-primary';
        btn.textContent = 'Fetch';
        btn.onclick = async () => {
            const url = input.value.trim();
            if (!url) return;
            btn.disabled = true;
            btn.innerHTML = '<span class="gi-spinner"></span>Fetching...';
            try {
                const scripts = await importFromGist(url);
                showImportPreview(scripts);
            } catch (e) {
                toast(e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Fetch';
            }
        };
        row.appendChild(btn);
        section.appendChild(row);

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--text-muted,#707070);margin-top:-4px;';
        hint.textContent = 'Supports gist.github.com URLs, API URLs, or raw Gist IDs';
        section.appendChild(hint);

        container.appendChild(section);
    }

    function showImportPreview(scripts) {
        if (_state.modalEl) _state.modalEl.remove();

        const overlay = document.createElement('div');
        overlay.className = 'gi-preview-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'gi-preview-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'gi-preview-header';
        header.innerHTML = `<h3>Import Scripts (${scripts.length} found)</h3>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'gi-preview-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => overlay.remove();
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
            for (const [k, v] of fields) {
                dl.innerHTML += `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`;
            }
            card.appendChild(dl);

            const code = document.createElement('pre');
            code.className = 'gi-preview-code';
            code.textContent = script.code.substring(0, 2000) + (script.code.length > 2000 ? '\n...' : '');
            card.appendChild(code);

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:8px;margin-top:8px;';

            const installBtn = document.createElement('button');
            installBtn.className = `gi-btn ${script.installed ? 'gi-btn-secondary' : 'gi-btn-primary'} gi-btn-sm`;
            installBtn.textContent = script.installed ? 'Reinstall' : 'Install';
            installBtn.onclick = () => {
                if (_state.onInstallScript) {
                    _state.onInstallScript(script.code);
                    toast(`Installed: ${meta.name || script.filename}`, 'success');
                    installBtn.textContent = 'Installed';
                    installBtn.disabled = true;
                }
            };
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
        closeFooter.textContent = 'Close';
        closeFooter.onclick = () => overlay.remove();
        footer.appendChild(closeFooter);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        _state.modalEl = overlay;
    }

    function renderBrowseTab(container) {
        if (!isConfigured()) {
            container.innerHTML = `<div class="gi-empty"><p>Configure your GitHub token in Settings to browse your Gists.</p></div>`;
            return;
        }

        const loading = document.createElement('div');
        loading.className = 'gi-loading';
        loading.innerHTML = '<span class="gi-spinner"></span> Loading your Gists...';
        container.appendChild(loading);

        listUserGists().then(gists => {
            container.innerHTML = '';
            if (gists.length === 0) {
                container.innerHTML = `<div class="gi-empty"><p>No .user.js Gists found in your account.</p></div>`;
                return;
            }

            // Search
            const searchRow = document.createElement('div');
            searchRow.className = 'gi-input-group';
            searchRow.style.marginBottom = '16px';
            const searchInput = document.createElement('input');
            searchInput.className = 'gi-input';
            searchInput.placeholder = 'Search Gists...';
            searchInput.oninput = () => {
                const q = searchInput.value.toLowerCase();
                const cards = listEl.querySelectorAll('.gi-gist-card');
                cards.forEach(c => {
                    c.style.display = c.dataset.search.includes(q) ? '' : 'none';
                });
            };
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
                metaRow.innerHTML = `<span>Updated ${formatDate(gist.updatedAt)}</span><span>${gist.files.length} file(s)</span>`;
                card.appendChild(metaRow);

                const actions = document.createElement('div');
                actions.className = 'gi-gist-card-actions';

                const importBtn = document.createElement('button');
                importBtn.className = 'gi-btn gi-btn-primary gi-btn-sm';
                importBtn.textContent = 'Import';
                importBtn.onclick = async () => {
                    importBtn.disabled = true;
                    importBtn.innerHTML = '<span class="gi-spinner"></span>';
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
            container.innerHTML = `<div class="gi-empty"><p style="color:var(--accent-red)">${escapeHtml(e.message)}</p></div>`;
        });
    }

    function renderSettingsTab(container) {
        // Token section
        const tokenSection = document.createElement('div');
        tokenSection.className = 'gi-section';
        tokenSection.innerHTML = `<div class="gi-section-title">GitHub Personal Access Token</div>`;

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
                verifyBtn.innerHTML = '<span class="gi-spinner"></span>';
                const result = await verifyToken();
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify';
                if (result.valid) {
                    const scopeInfo = result.hasGistScope ? 'gist scope present' : 'WARNING: gist scope missing';
                    toast(`Token valid for @${result.login} (${scopeInfo})`, result.hasGistScope ? 'success' : 'error');
                } else {
                    toast('Token is invalid or expired', 'error');
                }
            };
            maskedRow.appendChild(verifyBtn);
            tokenSection.appendChild(maskedRow);
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
                saveBtn.innerHTML = '<span class="gi-spinner"></span>';
                await saveToken(token);
                const result = await verifyToken();
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Token';
                if (result.valid) {
                    const scopeInfo = result.hasGistScope ? 'gist scope present' : 'WARNING: gist scope missing';
                    toast(`Token saved. Logged in as @${result.login} (${scopeInfo})`, result.hasGistScope ? 'success' : 'error');
                } else {
                    toast('Token saved but could not verify. Check the token value.', 'error');
                }
                render();
            };
            inputRow.appendChild(saveBtn);
            tokenSection.appendChild(inputRow);

            const hint = document.createElement('div');
            hint.style.cssText = 'font-size:11px;color:var(--text-muted,#707070);';
            hint.innerHTML = 'Generate a token at <a href="https://github.com/settings/tokens/new?scopes=gist&description=ScriptVault" target="_blank" style="color:var(--accent-blue,#60a5fa)">GitHub Settings</a> with the <strong>gist</strong> scope. Token is stored encrypted locally.';
            tokenSection.appendChild(hint);
        }
        container.appendChild(tokenSection);

        // Auto-sync toggle
        const syncSection = document.createElement('div');
        syncSection.className = 'gi-section';
        syncSection.innerHTML = `<div class="gi-section-title">Sync Settings</div>`;

        const toggleRow = document.createElement('div');
        toggleRow.className = 'gi-toggle-row';
        const labelDiv = document.createElement('div');
        labelDiv.innerHTML = `<div class="gi-toggle-label">Auto-sync on save</div><div class="gi-toggle-desc">Automatically push changes to linked Gists when saving scripts</div>`;
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
        header.innerHTML = `<h3>Export to GitHub Gist</h3>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'gi-preview-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => overlay.remove();
        header.appendChild(closeBtn);
        modal.appendChild(header);

        const body = document.createElement('div');
        body.className = 'gi-preview-body';
        body.innerHTML = `
            <dl class="gi-preview-meta">
                <dt>Script</dt><dd>${escapeHtml(meta.name || script.name || 'Untitled')}</dd>
                <dt>Version</dt><dd>${escapeHtml(meta.version || 'N/A')}</dd>
                <dt>Filename</dt><dd>${escapeHtml(makeFilename(meta.name || script.name))}</dd>
            </dl>
        `;

        const visibilityRow = document.createElement('div');
        visibilityRow.className = 'gi-toggle-row';
        visibilityRow.style.marginBottom = '12px';
        visibilityRow.innerHTML = `<div class="gi-toggle-label">Public Gist</div>`;
        let isPublic = false;
        const visToggle = document.createElement('button');
        visToggle.className = 'gi-toggle';
        visToggle.onclick = () => { isPublic = !isPublic; visToggle.classList.toggle('on', isPublic); };
        visibilityRow.appendChild(visToggle);
        body.appendChild(visibilityRow);

        const linkedGistId = script.settings?.gistId;
        if (linkedGistId) {
            const note = document.createElement('div');
            note.style.cssText = 'font-size:11px;color:var(--accent-yellow,#fbbf24);margin-bottom:8px;';
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
            exportBtn.innerHTML = '<span class="gi-spinner"></span>Exporting...';
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
            if (_state.container) { _state.container.innerHTML = ''; _state.container = null; }
            if (_state.syncIntervalId) { clearInterval(_state.syncIntervalId); _state.syncIntervalId = null; }
            _state.token = null;
            _state.tokenVerified = false;
            _state.gistCache = [];
            _state.cacheTime = 0;
        }
    };
})();
