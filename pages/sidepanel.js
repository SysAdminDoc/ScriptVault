// ScriptVault Side Panel v2.0.0
// Persistent companion panel — always visible alongside the active page

(function () {
  'use strict';

  let currentTab = null;
  let allScripts = [];
  let pageScripts = [];
  let settings = {};
  let allCollapsed = false;
  let refreshTimer = null;
  let searchQuery = '';
  let sortMode = 'default'; // default, alpha, perf, errors

  const $ = id => document.getElementById(id) || document.createElement('div'); // null-safe

  // ── Init ────────────────────────────────────────────────────────────────
  async function init() {
    await loadSettings();
    applyTheme();
    await refresh();
    setupEventListeners();
    setupTabListeners();
  }

  async function loadSettings() {
    const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
    settings = res?.settings || res || {};
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme || settings.layout || 'dark');
  }

  async function refresh() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tab;
      updateUrlBar();
      const res = await chrome.runtime.sendMessage({ action: 'getScripts' });
      allScripts = res?.scripts || Object.values(res || {});
      computePageScripts();
      renderPageScripts();
      renderAllScripts();
    } catch (e) {
      console.error('[SP] refresh error:', e);
      // Show error state instead of blank panel
      const list = $('pageScriptList');
      if (list) {
        list.innerHTML = '';
        const err = document.createElement('div');
        err.className = 'sp-empty';
        err.textContent = 'Connection lost. Click refresh.';
        list.appendChild(err);
      }
    }
  }

  // ── URL bar ─────────────────────────────────────────────────────────────
  function updateUrlBar() {
    const url = currentTab?.url || '';
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch {}
    $('urlHostname').textContent = hostname || '(no page)';
    $('urlBar').title = url;
  }

  // ── Script matching ──────────────────────────────────────────────────────
  function computePageScripts() {
    const url = currentTab?.url || '';
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      pageScripts = [];
      return;
    }
    pageScripts = allScripts.filter(s => scriptMatchesUrl(s, url));
  }

  function scriptMatchesUrl(script, url) {
    const meta = script.meta || {};
    const patterns = [...(meta.match || []), ...(meta.include || [])];
    if (!patterns.length) return false;
    if (!patterns.some(p => matchPattern(p, url))) return false;
    const excludes = [...(meta.exclude || []), ...(meta['exclude-match'] || [])];
    if (excludes.length && excludes.some(p => matchPattern(p, url))) return false;
    return true;
  }

  function matchPattern(pattern, url) {
    if (pattern === '<all_urls>') return true;
    // Guard against ReDoS: reject extremely long URLs entirely
    if (url.length > 2048) return false;
    try {
      let regex;
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        regex = new RegExp(pattern.slice(1, -1));
      } else {
        const re = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
        regex = new RegExp('^' + re + '$');
      }
      return regex.test(url);
    } catch { return false; }
  }

  // ── Render page scripts ──────────────────────────────────────────────────
  function renderPageScripts() {
    const list = $('pageScriptList');
    $('pageScriptCount').textContent = pageScripts.length;

    if (!pageScripts.length) {
      const url = currentTab?.url || '';
      let hostname = '';
      try { hostname = new URL(url).hostname; } catch {}
      list.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'sp-empty';
      const icon = document.createElement('div');
      icon.className = 'sp-empty-icon';
      icon.textContent = '📄';
      const msg = document.createElement('div');
      msg.textContent = 'No scripts for this page.';
      const link = document.createElement('div');
      link.style.marginTop = '4px';
      if (hostname) {
        const a = document.createElement('span');
        a.className = 'sp-empty-link';
        a.textContent = 'Find scripts for ' + hostname;
        a.addEventListener('click', () => {
          chrome.tabs.create({ url: 'https://greasyfork.org/en/scripts/by-site/' + encodeURIComponent(hostname) + '?filter_locale=0' });
        });
        link.appendChild(a);
      }
      empty.appendChild(icon);
      empty.appendChild(msg);
      empty.appendChild(link);
      list.appendChild(empty);
      return;
    }

    list.innerHTML = '';
    for (const script of pageScripts) {
      list.appendChild(buildScriptItem(script, true));
    }
  }

  // ── Render all scripts ────────────────────────────────────────────────────
  function renderAllScripts() {
    const list = $('allScriptList');
    let filtered = [...allScripts];

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const meta = s.meta || {};
        return (meta.name || '').toLowerCase().includes(q) ||
               (meta.description || '').toLowerCase().includes(q) ||
               (meta.author || '').toLowerCase().includes(q);
      });
    }

    $('allScriptCount').textContent = filtered.length + (filtered.length !== allScripts.length ? '/' + allScripts.length : '');

    list.innerHTML = '';

    // Sort based on current mode
    const sorted = filtered.sort((a, b) => {
      // Always enabled first
      if ((a.enabled !== false) !== (b.enabled !== false)) return (b.enabled !== false) - (a.enabled !== false);
      switch (sortMode) {
        case 'alpha':
          return (a.meta?.name || '').localeCompare(b.meta?.name || '');
        case 'perf':
          return (b.stats?.avgTime || 0) - (a.stats?.avgTime || 0);
        case 'errors':
          return (b.stats?.errors || 0) - (a.stats?.errors || 0);
        case 'recent':
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        default:
          return (a.meta?.name || '').localeCompare(b.meta?.name || '');
      }
    });

    for (const script of sorted) {
      list.appendChild(buildScriptItem(script, false));
    }
    if (allCollapsed) list.classList.add('collapsed');
  }

  function buildScriptItem(script, isPageScript) {
    const enabled = script.enabled !== false;
    const meta = script.meta || {};
    const stats = script.stats || {};
    const hasError = stats.errors > 0;
    const avgMs = stats.avgTime;

    const item = document.createElement('div');
    item.className = 'sp-item' +
      (hasError ? ' has-error' : '') +
      (!enabled ? ' not-running' : '');
    item.dataset.scriptId = script.id;

    // Icon (validate URL to prevent XSS via javascript: URIs)
    const safeIcon = meta.icon && typeof sanitizeUrl === 'function' ? sanitizeUrl(meta.icon) : meta.icon;
    if (safeIcon) {
      const img = document.createElement('img');
      img.className = 'sp-item-icon';
      img.src = safeIcon;
      img.alt = '';
      img.addEventListener('error', () => { img.style.display = 'none'; });
      item.appendChild(img);
    }

    // Name + desc column
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;min-width:0;';
    const name = document.createElement('div');
    name.className = 'sp-item-name';
    name.textContent = meta.name || script.id;
    name.title = meta.description || '';
    name.addEventListener('click', () => openInEditor(script.id));
    col.appendChild(name);
    if (meta.description && !isPageScript) {
      const desc = document.createElement('div');
      desc.className = 'sp-item-desc';
      desc.textContent = meta.description;
      col.appendChild(desc);
    }
    item.appendChild(col);

    // Meta (timing badge + error dot)
    const meta2 = document.createElement('div');
    meta2.className = 'sp-item-meta';
    if (hasError) {
      const dot = document.createElement('div');
      dot.className = 'sp-error-dot';
      dot.title = stats.errors + ' error(s)';
      meta2.appendChild(dot);
    }
    if (avgMs != null && enabled) {
      const badge = document.createElement('span');
      badge.className = 'sp-timing ' + (avgMs < 50 ? 'fast' : avgMs < 200 ? 'medium' : 'slow');
      badge.textContent = avgMs < 1000 ? avgMs.toFixed(0) + 'ms' : (avgMs / 1000).toFixed(1) + 's';
      badge.title = 'Avg execution time';
      meta2.appendChild(badge);
    }
    item.appendChild(meta2);

    // Toggle
    const label = document.createElement('label');
    label.className = 'sp-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = enabled;
    input.addEventListener('change', () => toggleScript(script.id, input.checked));
    const slider = document.createElement('span');
    slider.className = 'sp-toggle-slider';
    label.appendChild(input);
    label.appendChild(slider);
    item.appendChild(label);

    return item;
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async function toggleScript(id, enabled) {
    await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId: id, settings: { enabled } });
    // Optimistic update
    const script = allScripts.find(s => s.id === id);
    if (script) script.enabled = enabled;
    computePageScripts();
    renderPageScripts();
    renderAllScripts();
  }

  async function toggleAll() {
    const anyEnabled = pageScripts.some(s => s.enabled !== false);
    const newState = !anyEnabled;
    await Promise.allSettled(pageScripts.map(s =>
      chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId: s.id, settings: { enabled: newState } })
    ));
    for (const s of pageScripts) s.enabled = newState;
    computePageScripts();
    renderPageScripts();
    renderAllScripts();
  }

  function openInEditor(id) {
    chrome.runtime.sendMessage({ action: 'openDashboard', scriptId: id });
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  function setupEventListeners() {
    $('btnRefresh').addEventListener('click', refresh);
    $('btnDashboard').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openDashboard' }));
    $('btnNewScript').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openDashboard', data: { newScript: true } }));
    $('btnFindScripts').addEventListener('click', () => {
      let hostname = '';
      try { hostname = new URL(currentTab?.url || '').hostname; } catch {}
      chrome.tabs.create({ url: 'https://greasyfork.org/en/scripts/by-site/' + encodeURIComponent(hostname) });
    });
    $('btnOpenDash').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openDashboard' }));
    $('btnToggleAll').addEventListener('click', toggleAll);
    $('allSectionHeader').addEventListener('click', () => {
      allCollapsed = !allCollapsed;
      $('allScriptList').classList.toggle('collapsed', allCollapsed);
      $('collapseIcon').textContent = allCollapsed ? '▶' : '▼';
    });

    // v2.0: Search filter
    const searchEl = $('spSearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderAllScripts();
      });
      // Ctrl+F focuses search
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          searchEl.focus();
        }
        if (e.key === 'Escape' && document.activeElement === searchEl) {
          searchEl.value = '';
          searchQuery = '';
          searchEl.blur();
          renderAllScripts();
        }
      });
    }

    // v2.0: Sort controls
    const sortEl = $('spSort');
    if (sortEl) {
      sortEl.addEventListener('change', (e) => {
        sortMode = e.target.value;
        renderAllScripts();
      });
    }
  }

  function setupTabListeners() {
    // Refresh when active tab changes or navigates
    chrome.tabs.onActivated.addListener(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 150);
    });
    chrome.tabs.onUpdated.addListener((tabId, info) => {
      if (info.status === 'complete' && currentTab && tabId === currentTab.id) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 200);
      }
    });
  }

  init();
})();
