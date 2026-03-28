/**
 * ScriptVault Script Store / Discovery Module
 * Self-contained panel for browsing, searching, and installing userscripts
 * from Greasy Fork. Integrates with the dashboard via exported API.
 */
const ScriptStore = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        container: null,
        styleEl: null,
        page: 1,
        query: '',
        category: null,
        sortMode: null,        // null | 'total_installs' | 'daily_installs'
        siteHostname: null,
        loading: false,
        installedNames: new Set(),
        getInstalledScripts: null, // fn supplied by caller
        onInstalled: null,         // callback after successful install
    };

    const CATEGORIES = {
        productivity: { label: 'Productivity', query: 'productivity' },
        entertainment: { label: 'Entertainment', query: 'entertainment' },
        privacy: { label: 'Privacy', query: 'privacy' },
        social: { label: 'Social', query: 'social media' },
        utilities: { label: 'Utilities', query: 'utility' },
    };

    // =========================================
    // CSS (injected once on init)
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'script-store-styles';
        style.textContent = `
/* Script Store Panel */
.ss-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-body);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
}

/* Header bar */
.ss-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--bg-section-header);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}
.ss-header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-right: auto;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Search bar */
.ss-search-bar {
    display: flex;
    gap: 8px;
    padding: 10px 16px;
    background: var(--bg-content);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}
.ss-search-input {
    flex: 1;
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
}
.ss-search-input:focus {
    border-color: var(--accent-primary);
}
.ss-search-input::placeholder {
    color: var(--text-muted);
}

/* Buttons */
.ss-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    background: var(--bg-button);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
}
.ss-btn:hover {
    background: var(--bg-button-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.ss-btn:active {
    transform: translateY(0);
    box-shadow: none;
}
.ss-btn.primary {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: var(--text-on-accent, #fff);
}
.ss-btn.primary:hover {
    filter: brightness(1.1);
    box-shadow: 0 2px 12px rgba(34,197,94,0.3);
}
.ss-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}
.ss-btn.small {
    font-size: 10px;
    padding: 3px 8px;
}

/* Category / navigation bar */
.ss-nav {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    background: var(--bg-content);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
}
.ss-nav-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-right: 4px;
}
.ss-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    background: var(--bg-button);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ss-chip:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
}
.ss-chip.active {
    background: var(--accent-primary);
    color: var(--text-on-accent, #fff);
    border-color: var(--accent-primary);
}
.ss-nav-sep {
    width: 1px;
    height: 18px;
    background: var(--border-color);
    margin: 0 4px;
}

/* Results area */
.ss-results {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
}
.ss-results::-webkit-scrollbar { width: 6px; }
.ss-results::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
}
.ss-results::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
}

/* Status messages */
.ss-empty, .ss-error {
    text-align: center;
    color: var(--text-muted);
    padding: 40px 20px;
    font-size: 13px;
}
.ss-error { color: var(--accent-error); }

.ss-loading {
    text-align: center;
    color: var(--text-secondary);
    padding: 40px 20px;
    font-size: 13px;
}
.ss-loading::after {
    content: '';
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: ss-spin 0.6s linear infinite;
    margin-left: 8px;
    vertical-align: middle;
}
@keyframes ss-spin { to { transform: rotate(360deg); } }

/* Result count */
.ss-result-count {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    padding: 4px 0 8px;
}

/* Script card */
.ss-card {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-content);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 6px;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.ss-card:hover {
    border-color: rgba(34,197,94,0.3);
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
}
.ss-card.installed {
    border-left: 3px solid var(--accent-primary);
}
.ss-card-info {
    min-width: 0;
}
.ss-card-name {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}
.ss-card-name a {
    color: var(--accent-secondary);
    text-decoration: none;
}
.ss-card-name a:hover { text-decoration: underline; }
.ss-card-version {
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-button);
    padding: 1px 5px;
    border-radius: 4px;
}
.ss-installed-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-primary);
    background: rgba(34,197,94,0.12);
    padding: 1px 6px;
    border-radius: 4px;
    vertical-align: middle;
}
.ss-card-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ss-card-meta {
    display: flex;
    gap: 12px;
    font-size: 10px;
    color: var(--text-muted);
    flex-wrap: wrap;
}
.ss-card-meta span {
    display: flex;
    align-items: center;
    gap: 3px;
}
.ss-card-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
}

/* Code preview */
.ss-card-preview {
    display: none;
    grid-column: 1 / -1;
    max-height: 300px;
    overflow: auto;
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin-top: 8px;
    padding: 8px 12px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.4;
    white-space: pre;
    color: var(--text-secondary);
}
.ss-card-preview.open { display: block; }

/* Pagination */
.ss-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
}
.ss-pagination-info {
    font-size: 11px;
    color: var(--text-muted);
}

/* Source badges on cards */
.ss-source-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
    vertical-align: middle;
    margin-left: 4px;
}
.ss-source-bar {
    display: flex;
    gap: 12px;
    padding: 6px 16px;
    font-size: 11px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-section-header);
    flex-wrap: wrap;
    align-items: center;
}
.ss-source-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.ss-source-chip:not(.active) {
    opacity: 0.4;
    text-decoration: line-through;
}

/* Footer status bar */
.ss-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 16px;
    background: var(--bg-section-header);
    border-top: 1px solid var(--border-color);
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
}
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // Utilities
    // =========================================
    function escapeHtml(str) {
        const el = document.createElement('span');
        el.textContent = str || '';
        return el.innerHTML;
    }

    function formatNumber(n) {
        if (n == null) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const diffMs = now - d;
            const diffDays = Math.floor(diffMs / 86400000);
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 30) return diffDays + 'd ago';
            if (diffDays < 365) return Math.floor(diffDays / 30) + 'mo ago';
            return Math.floor(diffDays / 365) + 'y ago';
        } catch {
            return '--';
        }
    }

    // =========================================
    // Installed scripts tracking
    // =========================================
    async function refreshInstalledNames() {
        if (typeof _state.getInstalledScripts === 'function') {
            const scripts = await _state.getInstalledScripts();
            _state.installedNames = new Set(
                scripts.map(s => (s.metadata?.name || s.name || '').toLowerCase())
            );
        }
    }

    function isInstalled(name) {
        return _state.installedNames.has((name || '').toLowerCase());
    }

    // =========================================
    // Multi-Source API
    // =========================================

    // Source definitions — each has a fetch function that returns normalized results
    const SOURCES = {
        greasyfork: {
            label: 'Greasy Fork',
            color: '#670000',
            async fetch({ query, page, sort, site }) {
                let url;
                if (site) {
                    url = `https://api.greasyfork.org/en/scripts/by-site/${encodeURIComponent(site)}.json?page=${page || 1}`;
                } else {
                    url = `https://api.greasyfork.org/en/scripts.json?page=${page || 1}`;
                    if (query) url += `&q=${encodeURIComponent(query)}`;
                    if (sort) url += `&sort=${encodeURIComponent(sort)}`;
                }
                const resp = await fetch(url);
                if (!resp.ok) return [];
                const data = await resp.json();
                return data.map(s => ({
                    source: 'greasyfork',
                    id: 'gf_' + s.id,
                    name: s.name || 'Unnamed',
                    author: s.users?.[0]?.name || 'Unknown',
                    description: s.description || '',
                    version: s.version || '',
                    totalInstalls: s.total_installs || 0,
                    dailyInstalls: s.daily_installs || 0,
                    rating: s.fan_score ? parseFloat(s.fan_score).toFixed(0) + '%' : '--',
                    updatedAt: s.code_updated_at,
                    codeUrl: s.code_url || '',
                    pageUrl: s.url || '',
                }));
            }
        },
        openuserjs: {
            label: 'OpenUserJS',
            color: '#2c3e50',
            async fetch({ query, page }) {
                if (!query) return [];
                try {
                    // OpenUserJS has a limited API — search by script name
                    const resp = await fetch(`https://openuserjs.org/api/script/search?q=${encodeURIComponent(query)}&p=${page || 1}&limit=15`, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!resp.ok) return [];
                    const data = await resp.json();
                    const scripts = Array.isArray(data) ? data : (data.scripts || data.data || []);
                    return scripts.map(s => ({
                        source: 'openuserjs',
                        id: 'oujs_' + (s._id || s.name),
                        name: s.name || 'Unnamed',
                        author: s.author || s._authorId || 'Unknown',
                        description: s.description || s.about || '',
                        version: s.version || '',
                        totalInstalls: s.installs || 0,
                        dailyInstalls: 0,
                        rating: s.rating ? String(Math.round(s.rating)) + '%' : '--',
                        updatedAt: s.updated || s.updatedAt,
                        codeUrl: s.installURL || `https://openuserjs.org/install/${encodeURIComponent(s.author || '')}/${encodeURIComponent(s.name || '')}.user.js`,
                        pageUrl: s.url || `https://openuserjs.org/scripts/${encodeURIComponent(s.author || '')}/${encodeURIComponent(s.name || '')}`,
                    }));
                } catch (e) {
                    console.warn('[ScriptStore] OpenUserJS fetch failed:', e.message);
                    return [];
                }
            }
        },
        github: {
            label: 'GitHub',
            color: '#24292e',
            async fetch({ query, page }) {
                if (!query) return [];
                try {
                    // Search GitHub for .user.js files
                    const resp = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}+extension:user.js+in:file&per_page=10&page=${page || 1}`, {
                        headers: { 'Accept': 'application/vnd.github.v3+json' }
                    });
                    if (!resp.ok) return [];
                    const data = await resp.json();
                    return (data.items || []).map(item => {
                        const repo = item.repository;
                        return {
                            source: 'github',
                            id: 'gh_' + item.sha,
                            name: item.name.replace('.user.js', ''),
                            author: repo?.owner?.login || 'Unknown',
                            description: repo?.description || '',
                            version: '',
                            totalInstalls: repo?.stargazers_count || 0,
                            dailyInstalls: 0,
                            rating: repo?.stargazers_count ? repo.stargazers_count + ' stars' : '--',
                            updatedAt: repo?.updated_at,
                            codeUrl: item.html_url?.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') || '',
                            pageUrl: item.html_url || '',
                        };
                    });
                } catch (e) {
                    console.warn('[ScriptStore] GitHub search failed:', e.message);
                    return [];
                }
            }
        }
    };

    // Active sources (GitHub disabled by default — requires auth token for Code Search API)
    let _activeSources = new Set(['greasyfork', 'openuserjs']);

    /**
     * Unified search across all active sources.
     * Fetches from all sources in parallel, deduplicates by name, and merges.
     */
    async function fetchAllSources(params = {}) {
        const sourceKeys = [..._activeSources];
        const promises = sourceKeys.map(key => {
            const src = SOURCES[key];
            if (!src) return Promise.resolve([]);
            return src.fetch(params).catch(() => []);
        });

        const results = await Promise.allSettled(promises);
        let allScripts = [];
        const sourceStats = {};

        results.forEach((result, i) => {
            const key = sourceKeys[i];
            const scripts = result.status === 'fulfilled' ? result.value : [];
            sourceStats[key] = scripts.length;
            allScripts.push(...scripts);
        });

        // Deduplicate by name (case-insensitive) — prefer the one with more installs
        const seen = new Map();
        for (const s of allScripts) {
            const key = s.name.toLowerCase();
            if (!seen.has(key) || (seen.get(key).totalInstalls < s.totalInstalls)) {
                seen.set(key, s);
            }
        }
        const deduped = [...seen.values()];

        // Sort by total installs descending (most popular first)
        deduped.sort((a, b) => b.totalInstalls - a.totalInstalls);

        return { scripts: deduped, sourceStats };
    }

    // Keep backward-compatible single-source fetch for site-specific search
    async function fetchGreasyFork(params = {}) {
        return SOURCES.greasyfork.fetch(params);
    }

    // =========================================
    // Rendering
    // =========================================
    function getResultsEl() {
        return _state.container?.querySelector('.ss-results');
    }

    function showLoading(message = 'Searching') {
        const el = getResultsEl();
        if (el) el.innerHTML = `<div class="ss-loading">${escapeHtml(message)}</div>`;
    }

    function showEmpty(message = 'No scripts found') {
        const el = getResultsEl();
        if (el) el.innerHTML = `<div class="ss-empty">${escapeHtml(message)}</div>`;
    }

    function showError(message) {
        const el = getResultsEl();
        if (el) el.innerHTML = `<div class="ss-error">${escapeHtml(message)}</div>`;
    }

    function updateFooter(text) {
        const footer = _state.container?.querySelector('.ss-footer-text');
        if (footer) footer.textContent = text;
    }

    function renderCards(scripts, page, contextLabel, sourceStats) {
        const el = getResultsEl();
        if (!el) return;

        if (!scripts || scripts.length === 0) {
            showEmpty('No scripts found. Try a different search.');
            return;
        }

        let html = '';

        // Source stats bar (shows how many results came from each source)
        if (sourceStats) {
            const statsHtml = Object.entries(sourceStats)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => {
                    const src = SOURCES[key];
                    return `<span class="ss-source-stat" style="border-left:3px solid ${src?.color || '#666'};padding-left:6px">${src?.label || key}: ${count}</span>`;
                }).join('');
            if (statsHtml) {
                html += `<div class="ss-source-bar">${statsHtml}<span class="ss-source-stat" style="font-weight:600">${scripts.length} total (deduplicated)</span></div>`;
            }
        }

        if (contextLabel) {
            html += `<div class="ss-result-count">${contextLabel} - Page ${page}</div>`;
        } else {
            html += `<div class="ss-result-count">Page ${page} - ${scripts.length} results</div>`;
        }

        scripts.forEach(s => {
            // Unified format — works with both old GF format and new normalized format
            const name = s.name || 'Unnamed';
            const author = s.author || s.users?.[0]?.name || 'Unknown';
            const desc = s.description || 'No description';
            const version = s.version || '';
            const totalInstalls = s.totalInstalls ?? s.total_installs ?? 0;
            const dailyInstalls = s.dailyInstalls ?? s.daily_installs ?? 0;
            const rating = s.rating || (s.fan_score ? parseFloat(s.fan_score).toFixed(0) + '%' : '--');
            const updated = formatDate(s.updatedAt || s.code_updated_at);
            const installed = isInstalled(name);
            const codeUrl = s.codeUrl || s.code_url || '';
            const pageUrl = s.pageUrl || s.url || '';
            const source = s.source || 'greasyfork';
            const srcDef = SOURCES[source];
            const sourceBadge = srcDef ? `<span class="ss-source-badge" style="background:${srcDef.color};color:#fff">${srcDef.label}</span>` : '';

            html += `
<div class="ss-card${installed ? ' installed' : ''}" data-script-name="${escapeHtml(name)}">
    <div class="ss-card-info">
        <div class="ss-card-name">
            <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>
            ${version ? `<span class="ss-card-version">v${escapeHtml(version)}</span>` : ''}
            ${sourceBadge}
            ${installed ? '<span class="ss-installed-badge">Installed</span>' : ''}
        </div>
        <div class="ss-card-desc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</div>
        <div class="ss-card-meta">
            <span title="Author">${escapeHtml(author)}</span>
            <span title="Total installs">${formatNumber(totalInstalls)} installs</span>
            ${dailyInstalls > 0 ? `<span title="Daily installs">${formatNumber(dailyInstalls)}/day</span>` : ''}
            <span title="Rating">${rating}</span>
            <span title="Last updated">${updated}</span>
        </div>
    </div>
    <div class="ss-card-actions">
        <button class="ss-btn primary small" data-action="install" data-url="${escapeHtml(codeUrl)}">${installed ? 'Reinstall' : 'Install'}</button>
        <button class="ss-btn small" data-action="preview" data-url="${escapeHtml(codeUrl)}">Preview</button>
        <button class="ss-btn small" data-action="view" data-url="${escapeHtml(pageUrl)}">View</button>
    </div>
    <div class="ss-card-preview"></div>
</div>`;
        });

        // Pagination
        html += '<div class="ss-pagination">';
        if (page > 1) {
            html += `<button class="ss-btn small" data-action="page" data-page="${page - 1}">Previous</button>`;
        }
        html += `<span class="ss-pagination-info">Page ${page}</span>`;
        // Show "Next" only when we got a full page of results (at least 10 from any source)
        if (scripts.length >= 10) {
            html += `<button class="ss-btn small" data-action="page" data-page="${page + 1}">Next</button>`;
        }
        html += '</div>';

        el.innerHTML = html;
        bindCardActions(el);
        updateFooter(`${scripts.length} scripts loaded`);
    }

    // =========================================
    // Card action handlers
    // =========================================
    function bindCardActions(container) {
        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const url = btn.dataset.url;

            switch (action) {
                case 'install':
                    await handleInstall(btn, url);
                    break;
                case 'preview':
                    await handlePreview(btn, url);
                    break;
                case 'view':
                    if (url) chrome.tabs.create({ url });
                    break;
                case 'page':
                    await navigatePage(parseInt(btn.dataset.page, 10));
                    break;
            }
        });
    }

    async function handleInstall(btn, url) {
        if (!url) return;
        const originalText = btn.textContent;
        btn.textContent = 'Installing...';
        btn.disabled = true;

        try {
            const res = await chrome.runtime.sendMessage({ action: 'installFromUrl', url });
            if (res?.success) {
                btn.textContent = 'Installed';
                btn.classList.remove('primary');
                // Update installed set
                await refreshInstalledNames();
                // Mark the card
                const card = btn.closest('.ss-card');
                if (card) {
                    card.classList.add('installed');
                    const nameEl = card.querySelector('.ss-card-name');
                    if (nameEl && !nameEl.querySelector('.ss-installed-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'ss-installed-badge';
                        badge.textContent = 'Installed';
                        nameEl.appendChild(badge);
                    }
                }
                if (typeof _state.onInstalled === 'function') _state.onInstalled();
            } else {
                btn.textContent = 'Failed';
                setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
            }
        } catch (e) {
            btn.textContent = 'Error';
            setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
        }
    }

    async function handlePreview(btn, url) {
        if (!url) return;
        const card = btn.closest('.ss-card');
        const preview = card?.querySelector('.ss-card-preview');
        if (!preview) return;

        if (preview.classList.contains('open')) {
            preview.classList.remove('open');
            btn.textContent = 'Preview';
            return;
        }

        btn.textContent = 'Loading...';
        btn.disabled = true;
        try {
            const resp = await fetch(url);
            const code = await resp.text();
            preview.textContent = code;
            preview.classList.add('open');
            btn.textContent = 'Hide';
        } catch {
            preview.textContent = 'Failed to load script code.';
            preview.classList.add('open');
            btn.textContent = 'Preview';
        }
        btn.disabled = false;
    }

    // =========================================
    // Navigation / loading
    // =========================================
    async function navigatePage(page) {
        if (_state.loading) return;
        _state.page = page;
        await executeSearch();
    }

    async function executeSearch() {
        if (_state.loading) return;
        _state.loading = true;
        showLoading('Searching across ' + _activeSources.size + ' sources...');

        try {
            await refreshInstalledNames();

            let scripts;
            let contextLabel = null;
            let sourceStats = null;

            if (_state.siteHostname) {
                // Site-specific uses Greasy Fork only (it has the by-site API)
                scripts = await fetchGreasyFork({ site: _state.siteHostname, page: _state.page });
                contextLabel = `Scripts for ${_state.siteHostname}`;
            } else if (_state.sortMode && !_state.query && !_state.category) {
                // Popular/Trending uses Greasy Fork only
                scripts = await fetchGreasyFork({ sort: _state.sortMode, page: _state.page });
                const sortLabel = _state.sortMode === 'daily_installs' ? 'Trending' : 'Popular';
                contextLabel = sortLabel + ' scripts';
            } else {
                // Keyword/category search — use ALL sources
                const query = _state.query || (_state.category ? CATEGORIES[_state.category]?.query : '');
                if (!query) {
                    showEmpty('Enter a search term or select a category to browse scripts.');
                    _state.loading = false;
                    return;
                }
                const result = await fetchAllSources({
                    query,
                    page: _state.page,
                    sort: _state.sortMode || undefined,
                });
                scripts = result.scripts;
                sourceStats = result.sourceStats;
                if (_state.category) {
                    contextLabel = CATEGORIES[_state.category]?.label;
                }
            }

            renderCards(scripts, _state.page, contextLabel, sourceStats);
        } catch (e) {
            showError('Search failed: ' + e.message);
        } finally {
            _state.loading = false;
        }
    }

    function resetState() {
        _state.page = 1;
        _state.query = '';
        _state.category = null;
        _state.sortMode = null;
        _state.siteHostname = null;
    }

    function updateActiveChips() {
        const nav = _state.container?.querySelector('.ss-nav');
        if (!nav) return;
        nav.querySelectorAll('.ss-chip').forEach(chip => {
            const cat = chip.dataset.category;
            const sort = chip.dataset.sort;
            const isSite = chip.dataset.site;

            let active = false;
            if (cat) active = _state.category === cat && !_state.sortMode && !_state.siteHostname;
            if (sort) active = _state.sortMode === sort && !_state.category && !_state.siteHostname;
            if (isSite) active = !!_state.siteHostname;

            chip.classList.toggle('active', active);
        });
    }

    // =========================================
    // Build DOM
    // =========================================
    function buildPanel(container) {
        container.innerHTML = `
<div class="ss-panel">
    <div class="ss-header">
        <div class="ss-header-title">Script Store</div>
    </div>
    <div class="ss-search-bar">
        <input type="text" class="ss-search-input" placeholder="Search scripts by name, keyword, or domain (e.g. youtube.com)..." />
        <button class="ss-btn primary" data-action="search">Search</button>
    </div>
    <div class="ss-nav">
        <span class="ss-nav-label">Browse:</span>
        ${Object.entries(CATEGORIES).map(([key, val]) =>
            `<span class="ss-chip" data-category="${key}">${val.label}</span>`
        ).join('')}
        <span class="ss-nav-sep"></span>
        <span class="ss-chip" data-sort="total_installs">Popular</span>
        <span class="ss-chip" data-sort="daily_installs">Trending</span>
        <span class="ss-nav-sep"></span>
        <span class="ss-nav-label">Sources:</span>
        ${Object.entries(SOURCES).map(([key, src]) =>
            `<span class="ss-chip active ss-source-chip" data-source="${key}" style="border-left:3px solid ${src.color}">${src.label}</span>`
        ).join('')}
    </div>
    <div class="ss-results">
        <div class="ss-empty">Search for userscripts or browse categories above to discover scripts.</div>
    </div>
    <div class="ss-footer">
        <span class="ss-footer-text">Ready</span>
        <span>Greasy Fork &bull; OpenUserJS</span>
    </div>
</div>`;
    }

    function bindPanelEvents() {
        const container = _state.container;
        if (!container) return;

        // Search
        const searchInput = container.querySelector('.ss-search-input');
        const searchBtn = container.querySelector('[data-action="search"]');

        searchBtn?.addEventListener('click', () => {
            const q = searchInput?.value?.trim();
            if (!q) return;
            resetState();
            _state.query = q;
            // Detect domain-like queries
            if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(q)) {
                _state.siteHostname = q;
                _state.query = '';
            }
            updateActiveChips();
            executeSearch();
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                searchBtn?.click();
            }
        });

        // Category chips
        container.querySelectorAll('.ss-chip[data-category]').forEach(chip => {
            chip.addEventListener('click', () => {
                resetState();
                _state.category = chip.dataset.category;
                updateActiveChips();
                executeSearch();
            });
        });

        // Sort chips (Popular, Trending)
        container.querySelectorAll('.ss-chip[data-sort]').forEach(chip => {
            chip.addEventListener('click', () => {
                resetState();
                _state.sortMode = chip.dataset.sort;
                updateActiveChips();
                executeSearch();
            });
        });

        // Source toggle chips
        container.querySelectorAll('.ss-source-chip[data-source]').forEach(chip => {
            chip.addEventListener('click', () => {
                const src = chip.dataset.source;
                if (_activeSources.has(src)) {
                    // Don't allow disabling all sources
                    if (_activeSources.size <= 1) return;
                    _activeSources.delete(src);
                    chip.classList.remove('active');
                } else {
                    _activeSources.add(src);
                    chip.classList.add('active');
                }
            });
        });
    }

    // =========================================
    // Public API
    // =========================================
    return {
        /**
         * Initialize the script store panel.
         * @param {HTMLElement} containerEl - DOM element to render into
         * @param {Object} options
         * @param {Function} options.getInstalledScripts - async fn returning array of installed scripts
         * @param {Function} [options.onInstalled] - callback after a script is installed
         */
        init(containerEl, options = {}) {
            if (!containerEl) throw new Error('ScriptStore.init: container element required');

            _state.container = containerEl;
            _state.getInstalledScripts = options.getInstalledScripts || (async () => {
                try {
                    const res = await chrome.runtime.sendMessage({ action: 'getScripts' });
                    return res?.scripts || [];
                } catch { return []; }
            });
            _state.onInstalled = options.onInstalled || null;

            injectStyles();
            buildPanel(containerEl);
            bindPanelEvents();

            // Pre-populate installed names
            refreshInstalledNames();
        },

        /**
         * Search for scripts by keyword.
         * @param {string} query
         */
        async search(query) {
            if (!query) return;
            resetState();
            _state.query = query;
            const input = _state.container?.querySelector('.ss-search-input');
            if (input) input.value = query;
            updateActiveChips();
            await executeSearch();
        },

        /**
         * Browse a category.
         * @param {string} category - one of: productivity, entertainment, privacy, social, utilities
         */
        async browse(category) {
            if (!CATEGORIES[category]) return;
            resetState();
            _state.category = category;
            const input = _state.container?.querySelector('.ss-search-input');
            if (input) input.value = '';
            updateActiveChips();
            await executeSearch();
        },

        /**
         * Search for scripts targeting a specific site.
         * @param {string} hostname - e.g. "youtube.com"
         */
        async searchForSite(hostname) {
            if (!hostname) return;
            resetState();
            _state.siteHostname = hostname;
            const input = _state.container?.querySelector('.ss-search-input');
            if (input) input.value = hostname;
            updateActiveChips();
            await executeSearch();
        },

        /**
         * Clean up and remove the store panel.
         */
        destroy() {
            if (_state.container) _state.container.innerHTML = '';
            if (_state.styleEl) {
                _state.styleEl.remove();
                _state.styleEl = null;
            }
            _state.container = null;
            _state.getInstalledScripts = null;
            _state.onInstalled = null;
            _state.installedNames.clear();
            resetState();
        }
    };
})();
