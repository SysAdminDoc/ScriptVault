// ScriptVault — Card View Module
// Provides an alternative card-based grid layout for the script list,
// with responsive columns, site favicons, status indicators, and animated
// toggle between table and card views. Persists preference in settings.

const CardView = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_viewMode';
  const DESCRIPTION_MAX = 120;
  const TRANSITION_MS = 300;

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _cardGrid = null;
  let _styleEl = null;
  let _viewMode = 'table'; // 'table' | 'card'
  let _scripts = [];
  let _options = {};
  let _toggleBtn = null;
  let _activeMenuId = null;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Card View Grid */
.cv-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 12px;
  padding: 12px;
  opacity: 1;
  transition: opacity ${TRANSITION_MS}ms ease;
}
.cv-grid.cv-hidden { display: none; }
.cv-grid.cv-fade-out { opacity: 0; }

@media (min-width: 560px)  { .cv-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 900px)  { .cv-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1280px) { .cv-grid { grid-template-columns: repeat(4, 1fr); } }

/* Card */
.cv-card {
  position: relative;
  background: var(--bg-row);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 140px;
}
.cv-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
  border-color: var(--accent-blue);
}
.cv-card:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

/* Status borders */
.cv-card.cv-enabled  { border-left: 3px solid var(--accent-green); }
.cv-card.cv-disabled { border-left: 3px solid var(--toggle-off); opacity: 0.7; }

/* Status dots */
.cv-status-dots {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 5px;
  align-items: center;
}
.cv-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.cv-dot-error  { background: var(--accent-red); }
.cv-dot-stale  { background: var(--accent-yellow); }
.cv-dot-budget { background: var(--accent-orange); }

/* Header row: icon + name */
.cv-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* Favicon / letter avatar */
.cv-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: contain;
}
.cv-icon-letter {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.cv-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* Meta row */
.cv-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 11px;
  color: var(--text-secondary);
}
.cv-meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
}
.cv-meta-label { color: var(--text-muted); }

/* Description */
.cv-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Performance badge */
.cv-perf {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.cv-perf.fast   { background: rgba(74,222,128,.15); color: var(--accent-green); }
.cv-perf.medium { background: rgba(251,191,36,.15); color: var(--accent-yellow); }
.cv-perf.slow   { background: rgba(248,113,113,.15); color: var(--accent-red); }

/* Footer: toggle + menu */
.cv-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

/* Toggle switch (reuses dashboard toggle) */
.cv-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
}
.cv-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.cv-toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--toggle-off);
  border-radius: 20px;
  transition: background 200ms;
}
.cv-toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 200ms;
}
.cv-toggle input:checked + .cv-toggle-slider { background: var(--toggle-on); }
.cv-toggle input:checked + .cv-toggle-slider::before { transform: translateX(16px); }

/* Three-dot menu */
.cv-menu-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 18px;
  line-height: 1;
  letter-spacing: 2px;
}
.cv-menu-btn:hover { background: var(--bg-row-hover); color: var(--text-primary); }

.cv-menu {
  position: absolute;
  right: 12px;
  bottom: 42px;
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 140px;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
}
.cv-menu.cv-hidden { display: none; }
.cv-menu-item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.cv-menu-item:hover { background: var(--bg-row-hover); }
.cv-menu-item.danger { color: var(--accent-red); }

/* View toggle button */
.cv-view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 10px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: color 150ms, border-color 150ms;
}
.cv-view-toggle:hover {
  color: var(--text-primary);
  border-color: var(--accent-blue);
}
.cv-view-toggle svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
}

/* Table fade for transition */
.cv-table-fade-out {
  opacity: 0 !important;
  transition: opacity ${TRANSITION_MS}ms ease !important;
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function nameToColor(name) {
    const hue = hashStr(name || 'Script') % 360;
    return `hsl(${hue}, 55%, 45%)`;
  }

  function truncate(str, max) {
    if (!str || str.length <= max) return str || '';
    return str.slice(0, max).trimEnd() + '\u2026';
  }

  function extractFirstDomain(matches) {
    if (!matches || !matches.length) return null;
    for (const m of matches) {
      try {
        const cleaned = m.replace(/^\*:\/\//, 'https://').replace(/\/\*$/, '/');
        const url = new URL(cleaned);
        if (url.hostname && url.hostname !== '*') {
          return url.hostname.replace(/^\*\./, '');
        }
      } catch { /* skip */ }
    }
    return null;
  }

  function formatRelativeTime(ts) {
    if (!ts) return '-';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  /* ------------------------------------------------------------------ */
  /*  Style injection                                                    */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-cardview-styles';
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function removeStyles() {
    if (_styleEl) {
      _styleEl.remove();
      _styleEl = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Persistence                                                        */
  /* ------------------------------------------------------------------ */

  function loadViewMode() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'table' || stored === 'card') return stored;
    } catch { /* ignore */ }
    return 'table';
  }

  function saveViewMode(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Card rendering                                                     */
  /* ------------------------------------------------------------------ */

  function buildCard(script) {
    const card = document.createElement('div');
    card.className = `cv-card ${script.enabled !== false ? 'cv-enabled' : 'cv-disabled'}`;
    card.dataset.scriptId = script.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', script.metadata?.name || 'Unnamed Script');

    const name = script.metadata?.name || 'Unnamed Script';
    const version = script.metadata?.version || '1.0';
    const author = script.metadata?.author || '';
    const desc = script.metadata?.description || '';
    const enabled = script.enabled !== false;
    const matches = [...(script.metadata?.match || []), ...(script.metadata?.include || [])];
    const domain = extractFirstDomain(matches);
    const iconUrl = script.metadata?.icon || script.metadata?.iconURL;
    const stats = script.stats;
    const hasErrors = stats?.errors > 0;
    const daysSinceUpdate = script.updatedAt ? Math.floor((Date.now() - script.updatedAt) / 86400000) : 0;
    const isStale = daysSinceUpdate > 180 && (script.metadata?.updateURL || script.metadata?.downloadURL);
    const perfBudget = script.settings?.perfBudget || 200;
    const overBudget = stats?.avgTime > perfBudget && stats?.runs > 2;

    // Status dots
    const dots = [];
    if (hasErrors)   dots.push('<span class="cv-dot cv-dot-error" title="Has errors"></span>');
    if (isStale)     dots.push('<span class="cv-dot cv-dot-stale" title="Stale script"></span>');
    if (overBudget)  dots.push('<span class="cv-dot cv-dot-budget" title="Over perf budget"></span>');

    // Icon
    let iconHtml;
    if (iconUrl) {
      iconHtml = `<img class="cv-icon" src="${escapeHtml(iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="cv-icon-letter" style="display:none;background:${nameToColor(name)}">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    } else if (domain) {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
      iconHtml = `<img class="cv-icon" src="${escapeHtml(faviconUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="cv-icon-letter" style="display:none;background:${nameToColor(name)}">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    } else {
      iconHtml = `<span class="cv-icon-letter" style="background:${nameToColor(name)}">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    }

    // Perf badge
    let perfHtml = '';
    if (stats && stats.runs > 0 && stats.avgTime != null) {
      const cls = stats.avgTime < 50 ? 'fast' : stats.avgTime < 200 ? 'medium' : 'slow';
      const label = stats.avgTime < 50 ? 'Fast' : stats.avgTime < 200 ? 'OK' : 'Slow';
      perfHtml = `<span class="cv-perf ${cls}" title="${stats.avgTime}ms avg">${label}</span>`;
    }

    card.innerHTML = `
      <div class="cv-status-dots">${dots.join('')}</div>
      <div class="cv-header">
        ${iconHtml}
        <span class="cv-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      </div>
      ${desc ? `<div class="cv-desc" title="${escapeHtml(desc)}">${escapeHtml(truncate(desc, DESCRIPTION_MAX))}</div>` : ''}
      <div class="cv-meta">
        <span class="cv-meta-item"><span class="cv-meta-label">v</span>${escapeHtml(version)}</span>
        ${author ? `<span class="cv-meta-item"><span class="cv-meta-label">by</span>${escapeHtml(author)}</span>` : ''}
        <span class="cv-meta-item"><span class="cv-meta-label">matches</span>${matches.length}</span>
        <span class="cv-meta-item"><span class="cv-meta-label">updated</span>${formatRelativeTime(script.updatedAt)}</span>
        ${perfHtml}
      </div>
      <div class="cv-footer">
        <label class="cv-toggle" title="${enabled ? 'Enabled' : 'Disabled'}">
          <input type="checkbox" ${enabled ? 'checked' : ''} data-toggle-id="${script.id}">
          <span class="cv-toggle-slider"></span>
        </label>
        <button class="cv-menu-btn" data-menu-id="${script.id}" title="Actions" aria-label="Script actions">\u22EF</button>
        <div class="cv-menu cv-hidden" data-menu-for="${script.id}">
          <button class="cv-menu-item" data-action="edit" data-id="${script.id}">Edit</button>
          <button class="cv-menu-item" data-action="toggle" data-id="${script.id}">${enabled ? 'Disable' : 'Enable'}</button>
          <button class="cv-menu-item" data-action="update" data-id="${script.id}">Check Update</button>
          <button class="cv-menu-item" data-action="export" data-id="${script.id}">Export</button>
          <button class="cv-menu-item danger" data-action="delete" data-id="${script.id}">Delete</button>
        </div>
      </div>
    `;

    // -- Event listeners --

    // Click card body -> open editor
    card.addEventListener('click', (e) => {
      if (e.target.closest('.cv-toggle') || e.target.closest('.cv-menu-btn') || e.target.closest('.cv-menu')) return;
      _options.onEdit?.(script.id);
    });

    // Enter/Space on focused card
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        _options.onEdit?.(script.id);
      }
    });

    // Toggle switch
    const toggle = card.querySelector(`[data-toggle-id="${script.id}"]`);
    toggle?.addEventListener('change', (e) => {
      e.stopPropagation();
      _options.onToggle?.(script.id, e.target.checked);
    });
    toggle?.addEventListener('click', (e) => e.stopPropagation());

    // Three-dot menu
    const menuBtn = card.querySelector(`[data-menu-id="${script.id}"]`);
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCardMenu(script.id);
    });

    // Menu actions
    card.querySelectorAll('.cv-menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        switch (action) {
          case 'edit':   _options.onEdit?.(id); break;
          case 'toggle': _options.onToggle?.(id, !enabled); break;
          case 'update': _options.onUpdate?.(id); break;
          case 'export': _options.onExport?.(id); break;
          case 'delete': _options.onDelete?.(id); break;
        }
      });
    });

    return card;
  }

  /* ------------------------------------------------------------------ */
  /*  Menu management                                                    */
  /* ------------------------------------------------------------------ */

  function toggleCardMenu(id) {
    const wasOpen = _activeMenuId === id;
    closeAllMenus();
    if (wasOpen) return;
    const menu = _cardGrid?.querySelector(`[data-menu-for="${id}"]`);
    if (menu) {
      menu.classList.remove('cv-hidden');
      _activeMenuId = id;
    }
  }

  function closeAllMenus() {
    _activeMenuId = null;
    _cardGrid?.querySelectorAll('.cv-menu').forEach(m => m.classList.add('cv-hidden'));
  }

  /* ------------------------------------------------------------------ */
  /*  View toggle button                                                 */
  /* ------------------------------------------------------------------ */

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'cv-view-toggle';
    btn.title = 'Switch view';
    btn.setAttribute('aria-label', 'Toggle between table and card view');
    updateToggleIcon(btn);
    btn.addEventListener('click', () => {
      api.setViewMode(_viewMode === 'table' ? 'card' : 'table');
    });
    return btn;
  }

  function updateToggleIcon(btn) {
    if (!btn) return;
    if (_viewMode === 'table') {
      // Show grid icon (to switch to card)
      btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Cards`;
    } else {
      // Show list icon (to switch to table)
      btn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Table`;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  View switching                                                     */
  /* ------------------------------------------------------------------ */

  function applyViewMode(mode, animate = true) {
    _viewMode = mode;
    saveViewMode(mode);
    updateToggleIcon(_toggleBtn);

    // Find the table element in the container
    const table = _container?.querySelector('table, .script-table, #scriptTableBody')?.closest('table')
                || _container?.querySelector('table');
    const tableWrapper = table?.parentElement;

    if (mode === 'card') {
      // Hide table, show grid
      if (animate && tableWrapper) {
        tableWrapper.classList.add('cv-table-fade-out');
        setTimeout(() => {
          tableWrapper.style.display = 'none';
          tableWrapper.classList.remove('cv-table-fade-out');
          if (_cardGrid) {
            _cardGrid.classList.remove('cv-hidden');
            _cardGrid.classList.remove('cv-fade-out');
          }
        }, TRANSITION_MS);
      } else {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (_cardGrid) {
          _cardGrid.classList.remove('cv-hidden');
          _cardGrid.classList.remove('cv-fade-out');
        }
      }
    } else {
      // Show table, hide grid
      if (animate && _cardGrid) {
        _cardGrid.classList.add('cv-fade-out');
        setTimeout(() => {
          _cardGrid.classList.add('cv-hidden');
          _cardGrid.classList.remove('cv-fade-out');
          if (tableWrapper) tableWrapper.style.display = '';
        }, TRANSITION_MS);
      } else {
        if (_cardGrid) _cardGrid.classList.add('cv-hidden');
        if (tableWrapper) tableWrapper.style.display = '';
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Global click handler (close menus on outside click)                */
  /* ------------------------------------------------------------------ */

  function onDocumentClick(e) {
    if (_activeMenuId && !e.target.closest('.cv-menu-btn') && !e.target.closest('.cv-menu')) {
      closeAllMenus();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {

    /**
     * Initialize the card view module.
     * @param {HTMLElement} containerEl - The parent element containing the script table.
     * @param {Object} options
     * @param {Function} options.onEdit     - Called with scriptId when edit requested.
     * @param {Function} options.onToggle   - Called with (scriptId, enabled).
     * @param {Function} options.onUpdate   - Called with scriptId.
     * @param {Function} options.onExport   - Called with scriptId.
     * @param {Function} options.onDelete   - Called with scriptId.
     * @param {HTMLElement} [options.toggleTarget] - Element to append the view toggle button into.
     */
    init(containerEl, options = {}) {
      if (!containerEl) return;
      _container = containerEl;
      _options = options;

      injectStyles();

      // Load persisted view mode
      _viewMode = loadViewMode();

      // Create card grid container
      _cardGrid = document.createElement('div');
      _cardGrid.className = 'cv-grid cv-hidden';
      _cardGrid.setAttribute('role', 'list');
      _cardGrid.setAttribute('aria-label', 'Script cards');
      _container.appendChild(_cardGrid);

      // Create toggle button
      _toggleBtn = createToggleButton();
      if (options.toggleTarget) {
        options.toggleTarget.appendChild(_toggleBtn);
      }

      // Listen for outside clicks to close menus
      document.addEventListener('click', onDocumentClick);
    },

    /**
     * Render or re-render script cards from the provided list.
     * @param {Array} scripts - Array of script objects.
     */
    render(scripts) {
      _scripts = scripts || [];
      if (!_cardGrid) return;

      _cardGrid.innerHTML = '';
      closeAllMenus();

      for (const script of _scripts) {
        const card = buildCard(script);
        card.setAttribute('role', 'listitem');
        _cardGrid.appendChild(card);
      }

      // Apply current mode (no animation on re-render)
      if (_viewMode === 'card') {
        const table = _container?.querySelector('table');
        const tableWrapper = table?.parentElement;
        if (tableWrapper) tableWrapper.style.display = 'none';
        _cardGrid.classList.remove('cv-hidden');
      }
    },

    /**
     * Switch between table and card view.
     * @param {'table'|'card'} mode
     */
    setViewMode(mode) {
      if (mode !== 'table' && mode !== 'card') return;
      if (mode === _viewMode) return;
      applyViewMode(mode, true);
    },

    /**
     * Get the current view mode.
     * @returns {'table'|'card'}
     */
    getViewMode() {
      return _viewMode;
    },

    /**
     * Clean up: remove styles, grid, listeners.
     */
    destroy() {
      document.removeEventListener('click', onDocumentClick);
      removeStyles();
      if (_cardGrid) {
        _cardGrid.remove();
        _cardGrid = null;
      }
      if (_toggleBtn) {
        _toggleBtn.remove();
        _toggleBtn = null;
      }
      _container = null;
      _scripts = [];
      _options = {};
      _activeMenuId = null;
      _viewMode = 'table';
    }
  };

  return api;
})();
