// ScriptVault Side Panel v2.0.0
// Persistent companion panel — always visible alongside the active page

(function () {
  'use strict';

  const numberFormatter = new Intl.NumberFormat();

  let currentTab = null;
  let allScripts = [];
  let pageScripts = [];
  let settings = {};
  let allCollapsed = false;
  let refreshTimer = null;
  let searchQuery = '';
  let sortMode = 'default'; // default, alpha, perf, errors
  let noticeTimer = null;
  let searchRenderTimer = null;
  let currentPageCanRunScripts = false;
  const SEARCH_RENDER_DEBOUNCE_MS = 90;
  const MATCHABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'ftp:']);

  const $ = id => document.getElementById(id) || document.createElement('div'); // null-safe

  function showPanelNotice(message, type = 'success') {
    const notice = document.getElementById('statusMessage');
    if (!notice) return;
    notice.textContent = message;
    notice.hidden = false;
    notice.classList.remove('error');
    if (type === 'error') notice.classList.add('error');
    notice.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.classList.remove('show', 'error');
      notice.hidden = true;
    }, 3600);
  }

  function getRuntimeError(result, fallback = 'Action failed') {
    if (!result) return fallback;
    if (result.error) return result.error;
    if (result.success === false) return fallback;
    return '';
  }

  function updateLocalScriptState(scriptId, enabled) {
    const script = allScripts.find(s => s.id === scriptId);
    if (script) script.enabled = enabled;
    const pageScript = pageScripts.find(s => s.id === scriptId);
    if (pageScript) pageScript.enabled = enabled;
  }

  function queueAllScriptsRender(immediate = false) {
    clearTimeout(searchRenderTimer);
    if (immediate) {
      renderAllScripts();
      return;
    }
    searchRenderTimer = setTimeout(() => {
      searchRenderTimer = null;
      renderAllScripts();
    }, SEARCH_RENDER_DEBOUNCE_MS);
  }

  function hashMarkerSeed(seed) {
    let hash = 0;
    const input = String(seed || 'scriptvault');
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
  }

  function getDomainRoot(domain) {
    const parts = String(domain || '')
      .replace(/^www\./, '')
      .split('.')
      .filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || '');
  }

  function getBadgeLabel(domain, name) {
    const root = getDomainRoot(domain).replace(/[^a-z0-9]/gi, '');
    if (root) return root.slice(0, 2).toUpperCase();
    const words = String(name || 'Script').trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    return words[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'SV';
  }

  function getPrimaryDomain(meta) {
    const patterns = [...(meta.match || []), ...(meta.include || [])];
    for (const pattern of patterns) {
      const match = pattern.match(/^(?:\*|https?|file):\/\/(?:\*\.)?([^\/\*]+)/);
      if (match) {
        const domain = match[1].replace(/^\*\./, '').replace(/^www\./, '').toLowerCase();
        if (domain && domain !== '*' && !domain.includes('*')) return domain;
      }
    }
    return '';
  }

  function canMatchScriptsForUrl(url) {
    if (!url) return false;
    try {
      return MATCHABLE_PROTOCOLS.has(new URL(url).protocol);
    } catch {
      return false;
    }
  }

  function createScriptBadge(domain, name) {
    const badge = document.createElement('span');
    badge.className = 'sp-item-icon-badge';
    badge.style.setProperty('--sp-icon-hue', String(hashMarkerSeed(domain || name)));
    badge.textContent = getBadgeLabel(domain, name);
    return badge;
  }

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
      const currentUrl = currentTab?.url || '';
      currentPageCanRunScripts = canMatchScriptsForUrl(currentUrl);
      const [allRes, matchedRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getScripts' }),
        currentPageCanRunScripts
          ? chrome.runtime.sendMessage({ action: 'getScriptsForUrl', url: currentUrl })
          : Promise.resolve([])
      ]);
      allScripts = allRes?.scripts || Object.values(allRes || {});
      pageScripts = Array.isArray(matchedRes) ? matchedRes : [];
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
    let path = '';
    try {
      const parsedUrl = new URL(url);
      hostname = parsedUrl.hostname;
      path = (parsedUrl.pathname || '/') + (parsedUrl.search || '');
    } catch {}
    $('urlHostname').textContent = hostname || '(no page)';
    $('urlPath').textContent = hostname ? path : '';
    $('urlBar').title = url;
  }

  // ── Render page scripts ──────────────────────────────────────────────────
  function renderPageScripts() {
    const list = $('pageScriptList');
    $('pageScriptCount').textContent = numberFormatter.format(pageScripts.length);

    if (!currentPageCanRunScripts) {
      list.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'sp-empty';
      const icon = document.createElement('div');
      icon.className = 'sp-empty-icon';
      icon.textContent = '🛡️';
      const msg = document.createElement('div');
      msg.textContent = 'Scripts don’t run on this page.';
      const detail = document.createElement('div');
      detail.style.marginTop = '4px';
      detail.textContent = 'Open a regular website or local file to see matching userscripts.';
      empty.append(icon, msg, detail);
      list.replaceChildren(empty);
      return;
    }

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
        const a = document.createElement('button');
        a.className = 'sp-empty-link';
        a.type = 'button';
        a.textContent = 'Find scripts for ' + hostname;
        a.addEventListener('click', () => {
          chrome.tabs.create({ url: 'https://greasyfork.org/en/scripts/by-site/' + encodeURIComponent(hostname) + '?filter_locale=0' });
        });
        link.appendChild(a);
      }
      empty.appendChild(icon);
      empty.appendChild(msg);
      empty.appendChild(link);
      list.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const script of pageScripts) {
      fragment.appendChild(buildScriptItem(script, true));
    }
    list.replaceChildren(fragment);
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

    $('allScriptCount').textContent = numberFormatter.format(filtered.length) + (filtered.length !== allScripts.length ? '/' + numberFormatter.format(allScripts.length) : '');

    // Sort based on current mode
    const sorted = filtered.sort((a, b) => {
      // Always enabled first
      if ((a.enabled !== false) !== (b.enabled !== false)) return (b.enabled !== false) - (a.enabled !== false);
      switch (sortMode) {
        case 'alpha':
          return (a.meta?.name || '').localeCompare(b.meta?.name || '');
        case 'perf':
          return (b.stats?.avgTime || 0) - (a.stats?.avgTime || 0) || (a.meta?.name || '').localeCompare(b.meta?.name || '');
        case 'errors':
          return (b.stats?.errors || 0) - (a.stats?.errors || 0) || (a.meta?.name || '').localeCompare(b.meta?.name || '');
        case 'recent':
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        default: // install order (position)
          return (a.position || 0) - (b.position || 0);
      }
    });

    const fragment = document.createDocumentFragment();
    for (const script of sorted) {
      fragment.appendChild(buildScriptItem(script, false));
    }
    list.replaceChildren(fragment);
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
    const iconWrap = document.createElement('span');
    iconWrap.className = 'sp-item-icon';
    const primaryDomain = getPrimaryDomain(meta);
    if (safeIcon) {
      const img = document.createElement('img');
      img.src = safeIcon;
      img.alt = '';
      img.width = 18;
      img.height = 18;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        iconWrap.replaceChildren(createScriptBadge(primaryDomain, meta.name || script.id));
      });
      iconWrap.appendChild(img);
    } else {
      iconWrap.appendChild(createScriptBadge(primaryDomain, meta.name || script.id));
    }
    item.appendChild(iconWrap);

    // Name + desc column
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;min-width:0;';
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'sp-item-name-btn';
    name.textContent = meta.name || script.id;
    name.title = meta.description || '';
    name.setAttribute('aria-label', `Open ${meta.name || script.id} in editor`);
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
    try {
      const result = await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: id, enabled });
      const error = getRuntimeError(result, 'Failed to update script');
      if (error) throw new Error(error);
      updateLocalScriptState(id, enabled);
      renderPageScripts();
      renderAllScripts();
    } catch (error) {
      showPanelNotice(error.message || 'Failed to update script', 'error');
      await refresh();
    }
  }

  async function toggleAll() {
    const toggleButton = document.getElementById('btnToggleAll');
    if (toggleButton) toggleButton.disabled = true;
    const anyEnabled = pageScripts.some(s => s.enabled !== false);
    const newState = !anyEnabled;
    try {
      const outcomes = await Promise.allSettled(pageScripts.map(async s => ({
        id: s.id,
        result: await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: s.id, enabled: newState })
      })));

      let updated = 0;
      let failed = 0;
      let needsRefresh = false;

      for (const outcome of outcomes) {
        if (outcome.status === 'fulfilled') {
          const error = getRuntimeError(outcome.value.result, 'Failed to update script');
          if (!error) {
            updated++;
            updateLocalScriptState(outcome.value.id, newState);
          } else {
            failed++;
            if (/not found/i.test(error)) needsRefresh = true;
          }
        } else {
          failed++;
          needsRefresh = true;
        }
      }

      if (updated > 0) {
        renderPageScripts();
        renderAllScripts();
      }

      if (failed > 0) {
        showPanelNotice(
          updated > 0
            ? `Updated ${numberFormatter.format(updated)} script${updated === 1 ? '' : 's'}, but ${numberFormatter.format(failed)} failed.`
            : 'Failed to update scripts on this page.',
          'error'
        );
        if (needsRefresh || updated === 0) {
          await refresh();
        }
        return;
      }

      showPanelNotice(
        `${newState ? 'Enabled' : 'Disabled'} ${numberFormatter.format(updated)} script${updated === 1 ? '' : 's'} on this page.`
      );
    } finally {
      if (toggleButton) toggleButton.disabled = false;
    }
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
      if (canMatchScriptsForUrl(currentTab?.url || '')) {
        try { hostname = new URL(currentTab?.url || '').hostname.replace(/^www\./, ''); } catch {}
      }
      const url = hostname
        ? `https://greasyfork.org/en/scripts/by-site/${encodeURIComponent(hostname)}?filter_locale=0`
        : 'https://greasyfork.org/en/scripts';
      chrome.tabs.create({ url });
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
        queueAllScriptsRender();
      });
      searchEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          queueAllScriptsRender(true);
          return;
        }
        if (e.key === 'Escape' && searchEl.value) {
          e.preventDefault();
          searchEl.value = '';
          searchQuery = '';
          queueAllScriptsRender(true);
          searchEl.blur();
        }
      });
      // Ctrl+F focuses search
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          searchEl.focus();
          searchEl.select?.();
        }
        if (e.key === 'Escape' && document.activeElement === searchEl) {
          searchEl.value = '';
          searchQuery = '';
          searchEl.blur();
          queueAllScriptsRender(true);
        }
      });
    }

    // v2.0: Sort controls
    const sortEl = $('spSort');
    if (sortEl) {
      sortEl.addEventListener('change', (e) => {
        sortMode = e.target.value;
        queueAllScriptsRender(true);
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
