// ScriptVault — Script Collections/Bundles Module
// Group scripts into installable bundles with import/export, sharing,
// and built-in curated collections.

const CollectionManager = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_collections';
  const STYLE_ID = 'sv-collections-styles';

  const BUILT_IN_COLLECTIONS = [
    {
      id: '__builtin_privacy',
      name: 'Privacy Pack',
      icon: '\u{1F6E1}',
      description: 'Block trackers, manage cookies, and enhance privacy across the web.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'Google Analytics Blocker', greasyForkId: 480483, note: 'Blocks GA tracking scripts' },
        { name: 'Cookie AutoDelete Helper', greasyForkId: 446372, note: 'Auto-dismiss cookie banners' },
        { name: 'Fingerprint Defender', greasyForkId: 471230, note: 'Randomises canvas/WebGL fingerprints' },
        { name: 'Referrer Cleaner', greasyForkId: 438910, note: 'Strips referrer headers on navigation' }
      ]
    },
    {
      id: '__builtin_youtube',
      name: 'YouTube Enhancer',
      icon: '\u{1F3AC}',
      description: 'Bring back dislikes, skip sponsors, and improve the YouTube experience.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'Return YouTube Dislike', greasyForkId: 436115, note: 'Restores dislike counts' },
        { name: 'SponsorBlock', greasyForkId: 467733, note: 'Auto-skip sponsored segments' },
        { name: 'YouTube Age Bypass', greasyForkId: 423851, note: 'Bypass age-restricted videos' },
        { name: 'YouTube Thumbnail Rating Bar', greasyForkId: 411880, note: 'Adds like/dislike bar to thumbnails' }
      ]
    },
    {
      id: '__builtin_devtools',
      name: 'Developer Tools',
      icon: '\u{1F6E0}',
      description: 'JSON formatting, CSS inspection, and developer productivity utilities.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'JSON Formatter', greasyForkId: 440321, note: 'Pretty-prints JSON responses in browser' },
        { name: 'CSS Inspector Helper', greasyForkId: 451087, note: 'Highlights elements with computed styles' },
        { name: 'Console Error Overlay', greasyForkId: 462900, note: 'Shows console errors as page overlay' },
        { name: 'XHR Logger', greasyForkId: 437654, note: 'Logs all XHR/fetch requests in-page' }
      ]
    },
    {
      id: '__builtin_social',
      name: 'Social Media',
      icon: '\u{1F310}',
      description: 'UI tweaks and enhancements for Twitter, Reddit, and other social platforms.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'Old Reddit Redirect', greasyForkId: 441122, note: 'Redirects to old.reddit.com' },
        { name: 'Twitter/X UI Cleaner', greasyForkId: 455678, note: 'Removes promoted tweets and clutter' },
        { name: 'Reddit Enhancement Lite', greasyForkId: 448900, note: 'Keyboard nav and inline image expand' },
        { name: 'Instagram Download Button', greasyForkId: 460345, note: 'Adds download button to posts' }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _collections = [];    // user-created collections
  let _scripts = [];        // reference to installed scripts
  let _getScripts = null;   // callback to fetch current scripts
  let _onInstall = null;    // callback to install a script
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Collections Grid */
.sv-coll-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px 0;
}

/* Collection Card */
.sv-coll-card {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  position: relative;
}
.sv-coll-card:hover {
  border-color: var(--accent-green, #4ade80);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.sv-coll-card.expanded {
  border-color: var(--accent-green-dark, #22c55e);
}
.sv-coll-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.sv-coll-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}
.sv-coll-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sv-coll-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.sv-coll-desc {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  line-height: 1.4;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sv-coll-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted, #707070);
}
.sv-coll-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Expanded Script List */
.sv-coll-scripts {
  margin-top: 12px;
  border-top: 1px solid var(--border-color, #404040);
  padding-top: 12px;
  display: none;
}
.sv-coll-card.expanded .sv-coll-scripts {
  display: block;
}
.sv-coll-script-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 12px;
}
.sv-coll-script-row:last-child {
  border-bottom: none;
}
.sv-coll-script-name {
  flex: 1;
  color: var(--text-primary, #e0e0e0);
}
.sv-coll-script-note {
  font-size: 11px;
  color: var(--text-muted, #707070);
  font-style: italic;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sv-coll-script-toggle {
  position: relative;
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: var(--toggle-off, #555);
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.sv-coll-script-toggle.on {
  background: var(--toggle-on, #22c55e);
}
.sv-coll-script-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.sv-coll-script-toggle.on::after {
  transform: translateX(14px);
}

/* Action Buttons */
.sv-coll-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.sv-coll-btn {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: background 0.15s, border-color 0.15s;
}
.sv-coll-btn:hover {
  background: var(--bg-row-hover, #333);
  border-color: var(--accent-green, #4ade80);
}
.sv-coll-btn.primary {
  background: var(--accent-green-dark, #22c55e);
  border-color: var(--accent-green-dark, #22c55e);
  color: #fff;
}
.sv-coll-btn.primary:hover {
  background: var(--accent-green, #4ade80);
}
.sv-coll-btn.danger {
  border-color: var(--accent-red, #f87171);
  color: var(--accent-red, #f87171);
}
.sv-coll-btn.danger:hover {
  background: rgba(248, 113, 113, 0.15);
}

/* Toolbar */
.sv-coll-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.sv-coll-toolbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-right: auto;
}
.sv-coll-search {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  width: 200px;
  outline: none;
  transition: border-color 0.15s;
}
.sv-coll-search:focus {
  border-color: var(--accent-green, #4ade80);
}

/* Create/Import Modal */
.sv-coll-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: sv-coll-fade 0.15s ease;
}
@keyframes sv-coll-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.sv-coll-modal {
  background: var(--bg-header, #252525);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--border-color, #404040);
  border-radius: 10px;
  width: 540px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: sv-coll-slide 0.2s ease;
}
@keyframes sv-coll-slide {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.sv-coll-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color, #404040);
}
.sv-coll-modal-header h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.sv-coll-modal-close {
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0a0);
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.sv-coll-modal-close:hover {
  color: var(--text-primary, #e0e0e0);
}
.sv-coll-modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
}
.sv-coll-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color, #404040);
}
.sv-coll-field {
  margin-bottom: 12px;
}
.sv-coll-field label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.sv-coll-field input,
.sv-coll-field textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
}
.sv-coll-field input:focus,
.sv-coll-field textarea:focus {
  border-color: var(--accent-green, #4ade80);
}
.sv-coll-field textarea {
  resize: vertical;
  min-height: 60px;
}
.sv-coll-script-picker {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-row, #2a2a2a);
}
.sv-coll-script-pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 12px;
}
.sv-coll-script-pick-row:hover {
  background: var(--bg-row-hover, #333);
}
.sv-coll-script-pick-row input[type="checkbox"] {
  accent-color: var(--accent-green-dark, #22c55e);
}
.sv-coll-script-pick-note {
  margin-left: auto;
  width: 120px;
  padding: 3px 6px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 4px;
  background: var(--bg-input, #333);
  color: var(--text-secondary, #a0a0a0);
  font-size: 11px;
  outline: none;
}
.sv-coll-script-pick-note:focus {
  border-color: var(--accent-green, #4ade80);
}

/* Empty state */
.sv-coll-empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted, #707070);
}
.sv-coll-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.sv-coll-empty-text {
  font-size: 14px;
  margin-bottom: 16px;
}

/* Toast */
.sv-coll-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--bg-header, #252525);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--accent-green-dark, #22c55e);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  z-index: 10001;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  animation: sv-coll-fade 0.2s ease;
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function generateId() {
    return 'coll_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function showToast(msg, duration = 2500) {
    const existing = document.querySelector('.sv-coll-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'sv-coll-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, duration);
  }

  /* ------------------------------------------------------------------ */
  /*  Storage                                                            */
  /* ------------------------------------------------------------------ */

  async function loadCollections() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      _collections = data[STORAGE_KEY] || [];
    } catch {
      _collections = [];
    }
  }

  async function saveCollections() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _collections });
    } catch (e) {
      console.error('[CollectionManager] save error:', e);
    }
  }

  function getInstalledScripts() {
    if (typeof _getScripts === 'function') return _getScripts();
    return _scripts;
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  function render(filter = '') {
    if (!_container) return;

    const allCollections = [...BUILT_IN_COLLECTIONS, ..._collections];
    const filtered = filter
      ? allCollections.filter(c =>
          c.name.toLowerCase().includes(filter) ||
          c.description.toLowerCase().includes(filter))
      : allCollections;

    const installed = getInstalledScripts();

    _container.innerHTML = '';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'sv-coll-toolbar';
    toolbar.innerHTML = `
      <span class="sv-coll-toolbar-title">Collections</span>
      <input type="text" class="sv-coll-search" placeholder="Search collections\u2026"
             value="${escapeHtml(filter)}">
      <button class="sv-coll-btn" data-action="import">Import</button>
      <button class="sv-coll-btn primary" data-action="create">+ New</button>
    `;
    _container.appendChild(toolbar);

    const searchInput = toolbar.querySelector('.sv-coll-search');
    searchInput.addEventListener('input', () => {
      render(searchInput.value.trim().toLowerCase());
    });

    toolbar.querySelector('[data-action="create"]').addEventListener('click', () => openCreateModal());
    toolbar.querySelector('[data-action="import"]').addEventListener('click', () => openImportModal());

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sv-coll-empty';
      empty.innerHTML = `
        <div class="sv-coll-empty-icon">\u{1F4E6}</div>
        <div class="sv-coll-empty-text">No collections${filter ? ' match your search' : ' yet'}.</div>
        <button class="sv-coll-btn primary" data-action="create">Create Collection</button>
      `;
      empty.querySelector('[data-action="create"]').addEventListener('click', () => openCreateModal());
      _container.appendChild(empty);
      return;
    }

    // Grid
    const grid = document.createElement('div');
    grid.className = 'sv-coll-grid';

    for (const coll of filtered) {
      grid.appendChild(buildCard(coll, installed));
    }

    _container.appendChild(grid);
  }

  function buildCard(coll, installed) {
    const card = document.createElement('div');
    card.className = 'sv-coll-card';
    card.dataset.id = coll.id;

    const scriptCount = coll.scripts ? coll.scripts.length : 0;
    const totalSize = (coll.scripts || []).reduce((sum, s) => {
      if (s.scriptId) {
        const inst = (installed || []).find(i => i.id === s.scriptId);
        return sum + (inst && inst.code ? inst.code.length : 0);
      }
      return sum;
    }, 0);

    card.innerHTML = `
      <div class="sv-coll-card-header">
        <span class="sv-coll-icon">${coll.icon || '\u{1F4E6}'}</span>
        <span class="sv-coll-title">${escapeHtml(coll.name)}</span>
        ${coll.builtIn ? '<span class="sv-coll-badge">Built-in</span>' : ''}
      </div>
      <div class="sv-coll-desc">${escapeHtml(coll.description || '')}</div>
      <div class="sv-coll-meta">
        <span>\u{1F4DC} ${scriptCount} script${scriptCount !== 1 ? 's' : ''}</span>
        ${totalSize > 0 ? `<span>\u{1F4BE} ${formatBytes(totalSize)}</span>` : ''}
        ${coll.author ? `<span>\u{1F464} ${escapeHtml(coll.author)}</span>` : ''}
      </div>
      <div class="sv-coll-scripts"></div>
    `;

    // Click to toggle expand
    card.querySelector('.sv-coll-card-header').addEventListener('click', () => {
      const wasExpanded = card.classList.contains('expanded');
      // Collapse all
      _container.querySelectorAll('.sv-coll-card.expanded').forEach(c => {
        c.classList.remove('expanded');
        c.querySelector('.sv-coll-scripts').innerHTML = '';
      });
      if (!wasExpanded) {
        card.classList.add('expanded');
        renderExpandedScripts(card, coll, installed);
      }
    });

    return card;
  }

  function renderExpandedScripts(card, coll, installed) {
    const container = card.querySelector('.sv-coll-scripts');
    const scripts = coll.scripts || [];

    let html = '';
    for (const s of scripts) {
      const inst = s.scriptId ? (installed || []).find(i => i.id === s.scriptId) : null;
      const isInstalled = !!inst;
      const isEnabled = inst ? inst.enabled !== false : false;

      html += `
        <div class="sv-coll-script-row" data-script-id="${s.scriptId || ''}" data-gf-id="${s.greasyForkId || ''}">
          <span class="sv-coll-script-name">${escapeHtml(s.name || s.scriptId || 'Unknown')}</span>
          ${s.note ? `<span class="sv-coll-script-note" title="${escapeHtml(s.note)}">${escapeHtml(s.note)}</span>` : ''}
          ${isInstalled
            ? `<div class="sv-coll-script-toggle ${isEnabled ? 'on' : ''}" data-toggle-id="${s.scriptId}"></div>`
            : `<button class="sv-coll-btn" style="flex:0;padding:3px 8px;font-size:10px" data-install-gf="${s.greasyForkId || ''}" data-install-name="${escapeHtml(s.name || '')}">Install</button>`}
        </div>
      `;
    }

    // Action buttons
    html += `
      <div class="sv-coll-actions">
        <button class="sv-coll-btn primary" data-action="install-all">Install All</button>
        <button class="sv-coll-btn" data-action="enable-all">Enable All</button>
        <button class="sv-coll-btn" data-action="disable-all">Disable All</button>
        <button class="sv-coll-btn" data-action="export" title="Export collection">Export</button>
        <button class="sv-coll-btn" data-action="share" title="Shareable link">Share</button>
        ${!coll.builtIn ? '<button class="sv-coll-btn danger" data-action="delete">Delete</button>' : ''}
      </div>
    `;

    container.innerHTML = html;

    // Toggle listeners
    container.querySelectorAll('.sv-coll-script-toggle').forEach(tog => {
      tog.addEventListener('click', (e) => {
        e.stopPropagation();
        const scriptId = tog.dataset.toggleId;
        const isOn = tog.classList.contains('on');
        tog.classList.toggle('on', !isOn);
        chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId, settings: { enabled: !isOn } }, () => {
          renderExpandedScripts(card, coll, installed);
        });
      });
    });

    // Install individual
    container.querySelectorAll('[data-install-gf]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gfId = btn.dataset.installGf;
        if (gfId) {
          window.open(`https://greasyfork.org/scripts/${gfId}`, '_blank');
          showToast(`Opening Greasy Fork page for "${btn.dataset.installName}"...`);
        }
      });
    });

    // Bulk actions
    container.querySelector('[data-action="install-all"]').addEventListener('click', (e) => {
      e.stopPropagation();
      handleInstallAll(coll);
    });

    container.querySelector('[data-action="enable-all"]').addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggleAll(coll, true);
    });

    container.querySelector('[data-action="disable-all"]').addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggleAll(coll, false);
    });

    container.querySelector('[data-action="export"]').addEventListener('click', (e) => {
      e.stopPropagation();
      exportCollection(coll.id);
    });

    container.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      shareCollection(coll.id);
    });

    const delBtn = container.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCollection(coll.id);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Bulk actions                                                       */
  /* ------------------------------------------------------------------ */

  function handleInstallAll(coll) {
    const scripts = coll.scripts || [];
    const gfScripts = scripts.filter(s => s.greasyForkId);
    if (gfScripts.length > 0) {
      for (const s of gfScripts) {
        window.open(`https://greasyfork.org/scripts/${s.greasyForkId}`, '_blank');
      }
      showToast(`Opened ${gfScripts.length} Greasy Fork page(s)`);
    } else if (typeof _onInstall === 'function') {
      scripts.forEach(s => {
        if (s.scriptId) _onInstall(s.scriptId);
      });
      showToast('Installed collection scripts');
    }
  }

  let _onToggle = null;

  function handleToggleAll(coll, enable) {
    const installed = getInstalledScripts();
    const scripts = coll.scripts || [];
    let toggled = 0;
    for (const s of scripts) {
      if (s.scriptId) {
        const inst = (installed || []).find(i => i.id === s.scriptId);
        if (inst) {
          if (typeof _onToggle === 'function') _onToggle(s.scriptId, enable);
          toggled++;
        }
      }
    }
    showToast(`${enable ? 'Enabled' : 'Disabled'} ${toggled} script(s)`);
    render();
  }

  /* ------------------------------------------------------------------ */
  /*  Create Modal                                                       */
  /* ------------------------------------------------------------------ */

  function openCreateModal(editing = null) {
    const installed = getInstalledScripts();

    const overlay = document.createElement('div');
    overlay.className = 'sv-coll-overlay';

    const isEdit = !!editing;
    const selectedIds = isEdit ? (editing.scripts || []).map(s => s.scriptId).filter(Boolean) : [];
    const notes = {};
    if (isEdit) {
      (editing.scripts || []).forEach(s => {
        if (s.scriptId && s.note) notes[s.scriptId] = s.note;
      });
    }

    overlay.innerHTML = `
      <div class="sv-coll-modal">
        <div class="sv-coll-modal-header">
          <h3>${isEdit ? 'Edit' : 'Create'} Collection</h3>
          <button class="sv-coll-modal-close">&times;</button>
        </div>
        <div class="sv-coll-modal-body">
          <div class="sv-coll-field">
            <label>Name</label>
            <input type="text" id="sv-coll-name" placeholder="My Collection"
                   value="${isEdit ? escapeHtml(editing.name) : ''}">
          </div>
          <div class="sv-coll-field">
            <label>Description</label>
            <textarea id="sv-coll-desc" placeholder="What this collection does\u2026">${isEdit ? escapeHtml(editing.description || '') : ''}</textarea>
          </div>
          <div class="sv-coll-field" style="display:flex;gap:12px">
            <div style="flex:1">
              <label>Icon / Emoji</label>
              <input type="text" id="sv-coll-icon" placeholder="\u{1F4E6}" maxlength="4"
                     value="${isEdit ? (editing.icon || '') : ''}" style="width:60px">
            </div>
            <div style="flex:2">
              <label>Author</label>
              <input type="text" id="sv-coll-author" placeholder="Your name"
                     value="${isEdit ? escapeHtml(editing.author || '') : ''}">
            </div>
          </div>
          <div class="sv-coll-field">
            <label>Scripts</label>
            <div class="sv-coll-script-picker" id="sv-coll-picker">
              ${(installed || []).map(s => `
                <div class="sv-coll-script-pick-row">
                  <input type="checkbox" value="${s.id}" ${selectedIds.includes(s.id) ? 'checked' : ''}>
                  <span style="flex:1;color:var(--text-primary)">${escapeHtml(s.name || s.id)}</span>
                  <input type="text" class="sv-coll-script-pick-note" data-sid="${s.id}"
                         placeholder="Note\u2026" value="${escapeHtml(notes[s.id] || '')}">
                </div>
              `).join('')}
              ${(!installed || installed.length === 0) ? '<div style="padding:12px;color:var(--text-muted);text-align:center">No scripts installed</div>' : ''}
            </div>
          </div>
        </div>
        <div class="sv-coll-modal-footer">
          <button class="sv-coll-btn" data-action="cancel">Cancel</button>
          <button class="sv-coll-btn primary" data-action="save">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Events
    overlay.querySelector('.sv-coll-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
      const name = overlay.querySelector('#sv-coll-name').value.trim();
      if (!name) {
        overlay.querySelector('#sv-coll-name').style.borderColor = 'var(--accent-red)';
        return;
      }

      const description = overlay.querySelector('#sv-coll-desc').value.trim();
      const icon = overlay.querySelector('#sv-coll-icon').value.trim() || '\u{1F4E6}';
      const author = overlay.querySelector('#sv-coll-author').value.trim();

      const checked = overlay.querySelectorAll('#sv-coll-picker input[type="checkbox"]:checked');
      const scripts = [];
      checked.forEach(cb => {
        const noteInput = overlay.querySelector(`.sv-coll-script-pick-note[data-sid="${cb.value}"]`);
        const inst = (installed || []).find(i => i.id === cb.value);
        scripts.push({
          scriptId: cb.value,
          name: inst ? (inst.name || cb.value) : cb.value,
          note: noteInput ? noteInput.value.trim() : ''
        });
      });

      if (isEdit) {
        const idx = _collections.findIndex(c => c.id === editing.id);
        if (idx >= 0) {
          _collections[idx] = { ..._collections[idx], name, description, icon, author, scripts };
        }
      } else {
        _collections.push({
          id: generateId(),
          name,
          description,
          icon,
          author,
          builtIn: false,
          scripts,
          createdAt: Date.now()
        });
      }

      saveCollections();
      overlay.remove();
      render();
      showToast(isEdit ? 'Collection updated' : 'Collection created');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Import Modal                                                       */
  /* ------------------------------------------------------------------ */

  function openImportModal() {
    const overlay = document.createElement('div');
    overlay.className = 'sv-coll-overlay';
    overlay.innerHTML = `
      <div class="sv-coll-modal">
        <div class="sv-coll-modal-header">
          <h3>Import Collection</h3>
          <button class="sv-coll-modal-close">&times;</button>
        </div>
        <div class="sv-coll-modal-body">
          <div class="sv-coll-field">
            <label>Paste JSON Manifest</label>
            <textarea id="sv-coll-import-json" rows="10"
                      placeholder='{"name":"My Collection","scripts":[...]}'
                      style="font-family:monospace;font-size:12px"></textarea>
          </div>
          <div class="sv-coll-field">
            <label>Or load from file</label>
            <input type="file" id="sv-coll-import-file" accept=".json"
                   style="font-size:12px;color:var(--text-secondary)">
          </div>
        </div>
        <div class="sv-coll-modal-footer">
          <button class="sv-coll-btn" data-action="cancel">Cancel</button>
          <button class="sv-coll-btn primary" data-action="import">Import</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.sv-coll-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const fileInput = overlay.querySelector('#sv-coll-import-file');
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        overlay.querySelector('#sv-coll-import-json').value = reader.result;
      };
      reader.readAsText(file);
    });

    overlay.querySelector('[data-action="import"]').addEventListener('click', () => {
      const raw = overlay.querySelector('#sv-coll-import-json').value.trim();
      if (!raw) return;
      try {
        const result = importCollection(raw);
        overlay.remove();
        if (result.success) {
          showToast(`Imported "${result.name}"`);
          render();
        }
      } catch (e) {
        showToast('Invalid JSON: ' + e.message);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Import / Export / Share                                             */
  /* ------------------------------------------------------------------ */

  function importCollection(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    if (!data.name || !Array.isArray(data.scripts)) {
      throw new Error('Invalid collection manifest: requires "name" and "scripts" array');
    }

    const coll = {
      id: generateId(),
      name: data.name,
      description: data.description || '',
      icon: data.icon || '\u{1F4E6}',
      author: data.author || '',
      builtIn: false,
      scripts: data.scripts.map(s => ({
        scriptId: s.scriptId || '',
        name: s.name || s.scriptId || 'Unknown',
        note: s.note || '',
        greasyForkId: s.greasyForkId || null,
        url: s.url || ''
      })),
      createdAt: Date.now(),
      importedAt: Date.now()
    };

    _collections.push(coll);
    saveCollections();
    return { success: true, name: coll.name, id: coll.id };
  }

  function exportCollection(collectionId) {
    const all = [...BUILT_IN_COLLECTIONS, ..._collections];
    const coll = all.find(c => c.id === collectionId);
    if (!coll) return null;

    const manifest = {
      name: coll.name,
      description: coll.description || '',
      icon: coll.icon || '',
      author: coll.author || '',
      scripts: (coll.scripts || []).map(s => ({
        name: s.name,
        scriptId: s.scriptId || undefined,
        greasyForkId: s.greasyForkId || undefined,
        url: s.url || undefined,
        note: s.note || undefined
      })),
      exportedAt: new Date().toISOString(),
      source: 'ScriptVault'
    };

    const json = JSON.stringify(manifest, null, 2);

    // Trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-${coll.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('Collection exported');
    return json;
  }

  function shareCollection(collectionId) {
    const all = [...BUILT_IN_COLLECTIONS, ..._collections];
    const coll = all.find(c => c.id === collectionId);
    if (!coll) return null;

    const manifest = {
      name: coll.name,
      description: coll.description || '',
      icon: coll.icon || '',
      author: coll.author || '',
      scripts: (coll.scripts || []).map(s => ({
        name: s.name,
        greasyForkId: s.greasyForkId || undefined,
        note: s.note || undefined
      }))
    };

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(manifest))));
    const dataUrl = `data:application/json;base64,${encoded}`;

    // Copy to clipboard
    navigator.clipboard.writeText(dataUrl).then(() => {
      showToast('Shareable link copied to clipboard');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = dataUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Shareable link copied to clipboard');
    });

    return dataUrl;
  }

  /* ------------------------------------------------------------------ */
  /*  Delete                                                             */
  /* ------------------------------------------------------------------ */

  function deleteCollection(collectionId) {
    const idx = _collections.findIndex(c => c.id === collectionId);
    if (idx < 0) return false;
    const name = _collections[idx].name;
    _collections.splice(idx, 1);
    saveCollections();
    render();
    showToast(`Deleted "${name}"`);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialise the Collections UI.
     * @param {HTMLElement} containerEl - element to render into
     * @param {Object} [opts]
     * @param {Function} [opts.getScripts] - () => script[]
     * @param {Function} [opts.onInstall]  - (scriptId) => void
     * @param {Function} [opts.onToggle]   - (scriptId, enable) => void
     */
    async init(containerEl, opts = {}) {
      _container = containerEl;
      _getScripts = opts.getScripts || null;
      _onInstall = opts.onInstall || null;
      _onToggle = opts.onToggle || null;
      _scripts = opts.scripts || [];

      // Inject CSS
      if (!document.getElementById(STYLE_ID)) {
        _styleEl = document.createElement('style');
        _styleEl.id = STYLE_ID;
        _styleEl.textContent = STYLES;
        document.head.appendChild(_styleEl);
      }

      await loadCollections();
      _initialized = true;
      render();
    },

    /**
     * Create a new collection.
     */
    createCollection(name, scriptIds, options = {}) {
      const installed = getInstalledScripts();
      const scripts = (scriptIds || []).map(id => {
        const inst = (installed || []).find(i => i.id === id);
        return {
          scriptId: id,
          name: inst ? (inst.name || id) : id,
          note: (options.notes && options.notes[id]) || ''
        };
      });

      const coll = {
        id: generateId(),
        name,
        description: options.description || '',
        icon: options.icon || '\u{1F4E6}',
        author: options.author || '',
        builtIn: false,
        scripts,
        createdAt: Date.now()
      };

      _collections.push(coll);
      saveCollections();
      if (_initialized) render();
      return coll;
    },

    /**
     * Get all collections (built-in + user).
     */
    getCollections() {
      return [...BUILT_IN_COLLECTIONS, ..._collections];
    },

    /**
     * Install all scripts in a collection.
     */
    installCollection(collectionId) {
      const all = [...BUILT_IN_COLLECTIONS, ..._collections];
      const coll = all.find(c => c.id === collectionId);
      if (!coll) return { success: false, error: 'Collection not found' };
      handleInstallAll(coll);
      return { success: true, name: coll.name, scriptCount: (coll.scripts || []).length };
    },

    /**
     * Export collection as JSON (also triggers download).
     */
    exportCollection(collectionId) {
      return exportCollection(collectionId);
    },

    /**
     * Import a collection from JSON string or object.
     */
    importCollection(json) {
      const result = importCollection(json);
      if (_initialized) render();
      return result;
    },

    /**
     * Delete a user collection.
     */
    deleteCollection(collectionId) {
      return deleteCollection(collectionId);
    },

    /**
     * Clean up resources.
     */
    destroy() {
      _container = null;
      _initialized = false;
      if (_styleEl) {
        _styleEl.remove();
        _styleEl = null;
      }
    }
  };
})();

// Make available for ES module or script tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CollectionManager };
}
