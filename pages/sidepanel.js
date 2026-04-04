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
  const pendingScriptActions = new Set();
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

  function escapeSelectorValue(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(String(value));
    }
    return String(value).replace(/"/g, '\\"');
  }

  function getScriptRows(scriptId) {
    if (!scriptId) return [];
    return Array.from(document.querySelectorAll(`[data-script-id="${escapeSelectorValue(scriptId)}"]`));
  }

  function setScriptRowsBusy(scriptId, isBusy) {
    getScriptRows(scriptId).forEach((row) => {
      row.classList.toggle('busy', isBusy);
      row.setAttribute('aria-busy', String(isBusy));
      row.querySelectorAll('input, button').forEach((control) => {
        control.disabled = isBusy;
        if (isBusy) {
          control.setAttribute('aria-disabled', 'true');
        } else {
          control.removeAttribute('aria-disabled');
        }
      });
    });
  }

  function setPageScriptRowsBusy(isBusy) {
    pageScripts.forEach((script) => setScriptRowsBusy(script.id, isBusy));
  }

  function getScriptToggleLabel(script, enabled = script.enabled !== false) {
    const meta = script.meta || {};
    const name = meta.name || script.id || 'script';
    return `${enabled ? 'Disable' : 'Enable'} ${name}`;
  }

  function focusWithinScriptList(control, selector, direction) {
    const container = control?.closest('.sp-list, .sp-all-list');
    if (!container) return;
    const controls = Array.from(container.querySelectorAll(selector));
    if (!controls.length) return;
    const currentIndex = controls.indexOf(control);
    if (currentIndex === -1) return;

    if (direction === 'start') {
      controls[0]?.focus();
      return;
    }
    if (direction === 'end') {
      controls[controls.length - 1]?.focus();
      return;
    }

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= controls.length) return;
    controls[nextIndex]?.focus();
  }

  function setListBusy(isBusy) {
    $('pageScriptList').setAttribute('aria-busy', String(isBusy));
    $('allScriptList').setAttribute('aria-busy', String(isBusy));
  }

  function updateSearchSummary(filteredCount = allScripts.length) {
    const status = $('spSearchStatus');
    if (!status) return;
    const total = allScripts.length;
    const normalizedQuery = searchQuery.replace(/\s+/g, ' ').trim();
    if (!total) {
      status.textContent = 'No installed scripts yet.';
      return;
    }
    if (normalizedQuery) {
      status.textContent = `Showing ${numberFormatter.format(filteredCount)} of ${numberFormatter.format(total)} installed scripts for "${normalizedQuery}".`;
      return;
    }
    status.textContent = `Showing all ${numberFormatter.format(total)} installed scripts.`;
  }

  function updatePageActions() {
    const toggleButton = $('btnToggleAll');
    if (toggleButton) {
      const pageCount = pageScripts.length;
      const anyEnabled = pageScripts.some((script) => script.enabled !== false);
      const canToggle = currentPageCanRunScripts && pageCount > 0;
      toggleButton.disabled = !canToggle;
      toggleButton.textContent = canToggle
        ? (anyEnabled ? 'Disable Page Scripts' : 'Enable Page Scripts')
        : 'Toggle All';
      toggleButton.setAttribute(
        'aria-label',
        canToggle
          ? `${toggleButton.textContent} (${numberFormatter.format(pageCount)})`
          : 'No page scripts are available to toggle'
      );
    }

    const findButton = $('btnFindScripts');
    if (findButton) {
      let hostname = '';
      if (canMatchScriptsForUrl(currentTab?.url || '')) {
        try { hostname = new URL(currentTab?.url || '').hostname.replace(/^www\./, ''); } catch {}
      }
      findButton.textContent = hostname ? `Find for ${hostname}` : 'Find Scripts';
      findButton.setAttribute('aria-label', hostname ? `Find userscripts for ${hostname}` : 'Find userscripts');
    }
  }

  function setAllScriptsCollapsed(collapsed) {
    allCollapsed = collapsed;
    const list = $('allScriptList');
    list.classList.toggle('collapsed', collapsed);
    list.hidden = collapsed;
    $('allSectionHeader').setAttribute('aria-expanded', String(!collapsed));
    $('collapseIcon').textContent = collapsed ? '\u25B6' : '\u25BC';
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
    setListBusy(true);
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
    } finally {
      setListBusy(false);
      updatePageActions();
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
      updatePageActions();
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
      updatePageActions();
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const script of pageScripts) {
      fragment.appendChild(buildScriptItem(script, true));
    }
    list.replaceChildren(fragment);
    updatePageActions();
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

    if (!sorted.length) {
      const empty = document.createElement('div');
      empty.className = 'sp-empty';
      const icon = document.createElement('div');
      icon.className = 'sp-empty-icon';
      icon.textContent = searchQuery ? '\u2315' : '\uD83D\uDCC2';
      const msg = document.createElement('div');
      msg.textContent = searchQuery ? `No scripts match "${searchQuery}".` : 'No installed scripts yet.';
      empty.append(icon, msg);
      if (searchQuery) {
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'sp-empty-link';
        reset.textContent = 'Clear search';
        reset.addEventListener('click', () => {
          $('spSearch').value = '';
          searchQuery = '';
          $('btnClearSearch').hidden = true;
          queueAllScriptsRender(true);
          $('spSearch').focus();
        });
        empty.appendChild(reset);
      }
      list.replaceChildren(empty);
      updateSearchSummary(0);
      setAllScriptsCollapsed(allCollapsed);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const script of sorted) {
      fragment.appendChild(buildScriptItem(script, false));
    }
    list.replaceChildren(fragment);
    updateSearchSummary(sorted.length);
    setAllScriptsCollapsed(allCollapsed);
  }

  function buildScriptItem(script, isPageScript) {
    const enabled = script.enabled !== false;
    const meta = script.meta || {};
    const stats = script.stats || {};
    const hasError = stats.errors > 0;
    const avgMs = stats.avgTime;
    const detailText = isPageScript
      ? (hasError
          ? `${numberFormatter.format(stats.errors)} error${stats.errors === 1 ? '' : 's'} recorded`
          : enabled
            ? 'Available on this page'
            : 'Paused for this page')
      : (meta.description || '');

    const item = document.createElement('div');
    item.className = 'sp-item' +
      (hasError ? ' has-error' : '') +
      (!enabled ? ' not-running' : '');
    item.dataset.scriptId = script.id;
    item.setAttribute('role', 'listitem');
    item.setAttribute(
      'aria-label',
      [
        meta.name || script.id,
        enabled ? 'enabled' : 'disabled',
        hasError ? `${stats.errors} errors` : '',
        avgMs != null && enabled ? `average ${avgMs < 1000 ? `${avgMs.toFixed(0)} milliseconds` : `${(avgMs / 1000).toFixed(1)} seconds`}` : ''
      ].filter(Boolean).join(', ')
    );
    if (pendingScriptActions.has(script.id)) {
      item.classList.add('busy');
      item.setAttribute('aria-busy', 'true');
    }

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
    col.className = 'sp-item-main';
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'sp-item-name-btn';
    name.textContent = meta.name || script.id;
    name.title = detailText || meta.description || '';
    name.setAttribute('aria-label', `Open ${meta.name || script.id} in editor`);
    name.addEventListener('click', () => openInEditor(script.id));
    name.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusWithinScriptList(name, '.sp-item-name-btn', 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusWithinScriptList(name, '.sp-item-name-btn', -1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusWithinScriptList(name, '.sp-item-name-btn', 'start');
      } else if (event.key === 'End') {
        event.preventDefault();
        focusWithinScriptList(name, '.sp-item-name-btn', 'end');
      }
    });
    col.appendChild(name);
    if (detailText) {
      const desc = document.createElement('div');
      desc.className = 'sp-item-desc';
      desc.textContent = detailText;
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
    input.setAttribute('aria-label', getScriptToggleLabel(script, enabled));
    input.disabled = pendingScriptActions.has(script.id);
    input.addEventListener('change', () => toggleScript(script.id, input.checked));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusWithinScriptList(input, '.sp-toggle input', 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusWithinScriptList(input, '.sp-toggle input', -1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusWithinScriptList(input, '.sp-toggle input', 'start');
      } else if (event.key === 'End') {
        event.preventDefault();
        focusWithinScriptList(input, '.sp-toggle input', 'end');
      }
    });
    const slider = document.createElement('span');
    slider.className = 'sp-toggle-slider';
    label.appendChild(input);
    label.appendChild(slider);
    item.appendChild(label);

    return item;
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async function toggleScript(id, enabled) {
    if (pendingScriptActions.has(id)) return;
    pendingScriptActions.add(id);
    setScriptRowsBusy(id, true);
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
    } finally {
      pendingScriptActions.delete(id);
      setScriptRowsBusy(id, false);
    }
  }

  async function toggleAll() {
    const toggleButton = document.getElementById('btnToggleAll');
    if (toggleButton) toggleButton.disabled = true;
    setPageScriptRowsBusy(true);
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
      setPageScriptRowsBusy(false);
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
      setAllScriptsCollapsed(!allCollapsed);
    });

    // v2.0: Search filter
    const searchEl = $('spSearch');
    const clearSearchButton = $('btnClearSearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        clearSearchButton.hidden = !searchQuery;
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
          clearSearchButton.hidden = true;
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
          clearSearchButton.hidden = true;
          searchEl.blur();
          queueAllScriptsRender(true);
        }
      });
    }
    clearSearchButton?.addEventListener('click', () => {
      searchEl.value = '';
      searchQuery = '';
      clearSearchButton.hidden = true;
      queueAllScriptsRender(true);
      searchEl.focus();
    });

    // v2.0: Sort controls
    const sortEl = $('spSort');
    if (sortEl) {
      sortEl.addEventListener('change', (e) => {
        sortMode = e.target.value;
        queueAllScriptsRender(true);
      });
    }

    updateSearchSummary(allScripts.length);
    updatePageActions();
    setAllScriptsCollapsed(false);
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
