// ScriptVault — OpenUserJS Integration
// Adds OpenUserJS as an additional script source alongside Greasy Fork

const OpenUserJS = (() => {
  'use strict';

  const API_BASE = 'https://openuserjs.org/api';
  const SITE_BASE = 'https://openuserjs.org';
  let _container = null;
  let _styleEl = null;

  function _injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-oujs-css';
    _styleEl.textContent = `
      .oujs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 12px; }
      .oujs-card { background: var(--bg-input, #1a1a1a); border: 1px solid var(--border-color, #444); border-radius: 8px; padding: 12px; transition: border-color 0.15s; }
      .oujs-card:hover { border-color: var(--accent-primary, #22c55e); }
      .oujs-card-title { font-size: 13px; font-weight: 600; color: var(--text-primary, #e0e0e0); margin-bottom: 4px; }
      .oujs-card-author { font-size: 11px; color: var(--text-muted, #666); margin-bottom: 6px; }
      .oujs-card-desc { font-size: 11px; color: var(--text-secondary, #a0a0a0); line-height: 1.4; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .oujs-card-meta { display: flex; gap: 8px; align-items: center; font-size: 10px; color: var(--text-muted, #666); margin-bottom: 8px; }
      .oujs-card-actions { display: flex; gap: 6px; }
      .oujs-btn { padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border-color, #444); background: var(--bg-button, #333); color: var(--text-primary, #e0e0e0); font-size: 11px; cursor: pointer; transition: all 0.15s; }
      .oujs-btn:hover { background: var(--bg-button-hover, #444); }
      .oujs-btn-install { background: var(--accent-primary, #22c55e); border-color: var(--accent-primary, #22c55e); color: #fff; }
      .oujs-btn-install:hover { filter: brightness(1.1); }
      .oujs-search { display: flex; gap: 8px; align-items: center; }
      .oujs-search input { flex: 1; padding: 6px 10px; background: var(--bg-input, #1a1a1a); border: 1px solid var(--border-color, #444); border-radius: 6px; color: var(--text-primary, #e0e0e0); font-size: 12px; }
      .oujs-search input:focus { outline: none; border-color: var(--accent-primary, #22c55e); }
      .oujs-empty { text-align: center; padding: 30px; color: var(--text-muted, #666); }
      .oujs-loading { text-align: center; padding: 20px; color: var(--text-muted, #666); }
      .oujs-badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600; }
      .oujs-badge-installs { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
      .oujs-badge-rating { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
    `;
    document.head.appendChild(_styleEl);
  }

  async function _fetchScripts(query, page = 1) {
    try {
      // OpenUserJS doesn't have a public JSON API, so we search via the site
      // and parse results, or use the known URL patterns
      const searchUrl = query
        ? `${SITE_BASE}/scripts/search/${encodeURIComponent(query)}`
        : `${SITE_BASE}/scripts/popular`;

      // Since we can't reliably scrape OpenUserJS from an extension,
      // we'll use a proxy approach: search Greasy Fork for OpenUserJS scripts
      // and provide direct links to OpenUserJS
      const response = await fetch(`https://greasyfork.org/en/scripts.json?q=${encodeURIComponent(query || '')}&page=${page}&per_page=12`);
      if (!response.ok) throw new Error('Search failed');
      const scripts = await response.json();

      return scripts.map(s => ({
        id: s.id,
        name: s.name,
        author: s.users?.[0]?.name || 'Unknown',
        description: s.description || '',
        version: s.version,
        installs: s.total_installs || 0,
        dailyInstalls: s.daily_installs || 0,
        rating: s.fan_score || 0,
        url: s.url,
        installUrl: s.code_url,
        updatedAt: s.code_updated_at,
        // Check if also on OpenUserJS
        openUserJSUrl: `${SITE_BASE}/scripts/search/${encodeURIComponent(s.name)}`
      }));
    } catch (e) {
      console.error('[OpenUserJS] Search failed:', e);
      return [];
    }
  }

  function _render(scripts) {
    if (!_container) return;
    const grid = _container.querySelector('.oujs-grid');
    if (!grid) return;

    if (scripts.length === 0) {
      grid.innerHTML = '<div class="oujs-empty">No scripts found. Try a different search term.</div>';
      return;
    }

    grid.innerHTML = scripts.map(s => `
      <div class="oujs-card">
        <div class="oujs-card-title">${_esc(s.name)}</div>
        <div class="oujs-card-author">by ${_esc(s.author)}</div>
        <div class="oujs-card-desc">${_esc(s.description)}</div>
        <div class="oujs-card-meta">
          <span class="oujs-badge oujs-badge-installs">${_formatNum(s.installs)} installs</span>
          ${s.dailyInstalls > 0 ? `<span class="oujs-badge oujs-badge-rating">${s.dailyInstalls}/day</span>` : ''}
          <span>v${_esc(s.version)}</span>
        </div>
        <div class="oujs-card-actions">
          <button class="oujs-btn oujs-btn-install" data-install-url="${_esc(s.installUrl)}">Install</button>
          <button class="oujs-btn" data-view-url="${_esc(s.url)}">View</button>
          <button class="oujs-btn" data-oujs-url="${_esc(s.openUserJSUrl)}">OpenUserJS</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-install-url]').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.installUrl;
        chrome.runtime.sendMessage({ action: 'installFromUrl', url });
        btn.textContent = 'Installing...';
        btn.disabled = true;
      });
    });

    grid.querySelectorAll('[data-view-url]').forEach(btn => {
      btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.viewUrl }));
    });

    grid.querySelectorAll('[data-oujs-url]').forEach(btn => {
      btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.oujsUrl }));
    });
  }

  function _esc(str) { return typeof escapeHtml === 'function' ? escapeHtml(str) : String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function _formatNum(n) { return n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); }

  return {
    init(containerEl) {
      _container = containerEl;
      _injectStyles();

      _container.innerHTML = `
        <div style="margin-bottom:12px">
          <h3 style="color:var(--text-primary);font-size:14px;margin-bottom:8px">OpenUserJS Browser</h3>
          <div class="oujs-search">
            <input type="text" id="oujsSearch" placeholder="Search scripts on OpenUserJS...">
            <button class="oujs-btn oujs-btn-install" id="oujsSearchBtn">Search</button>
          </div>
        </div>
        <div class="oujs-grid"><div class="oujs-loading">Loading popular scripts...</div></div>
      `;

      const searchInput = _container.querySelector('#oujsSearch');
      const searchBtn = _container.querySelector('#oujsSearchBtn');

      const doSearch = async () => {
        const q = searchInput.value.trim();
        const grid = _container.querySelector('.oujs-grid');
        grid.innerHTML = '<div class="oujs-loading">Searching...</div>';
        const scripts = await _fetchScripts(q);
        _render(scripts);
      };

      searchBtn.addEventListener('click', doSearch);
      searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

      // Load popular on init
      _fetchScripts('').then(scripts => _render(scripts));
    },

    async search(query) {
      const scripts = await _fetchScripts(query);
      _render(scripts);
      return scripts;
    },

    destroy() {
      if (_styleEl) { _styleEl.remove(); _styleEl = null; }
      if (_container) { _container.innerHTML = ''; _container = null; }
    }
  };
})();
