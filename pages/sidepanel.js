// ScriptVault Side Panel v2.0.0
// Persistent companion panel — always visible alongside the active page

(function () {
  'use strict';

  const numberFormatter = new Intl.NumberFormat();

  function getSidepanelI18n() {
    try {
      return typeof I18n !== 'undefined' ? I18n : null;
    } catch (_) {
      return null;
    }
  }

  function tSidepanel(key, fallback = key, placeholders = {}) {
    const i18n = getSidepanelI18n();
    return i18n?.getMessage ? i18n.getMessage(key, placeholders) : fallback;
  }

  function applySidepanelI18n() {
    const i18n = getSidepanelI18n();
    if (!i18n?.applyToDOM) return;
    i18n.init?.('auto');
    i18n.applyToDOM(document);
  }

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
  let hostPermissionStatus = null;
  let _refreshGeneration = 0;
  const pendingScriptActions = new Set();
  const SEARCH_RENDER_DEBOUNCE_MS = 90;
  const MATCHABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'ftp:']);

  const $ = id => document.getElementById(id); // returns null if not found

  function isContextInvalidated(error) {
    const msg = String(error?.message || error || '');
    return msg.includes('Extension context invalidated') || msg.includes('context invalidated');
  }

  function showContextInvalidatedBanner() {
    teardownTabListeners();
    const existing = document.getElementById('sp-context-banner');
    if (existing) return;
    const banner = document.createElement('button');
    banner.type = 'button';
    banner.id = 'sp-context-banner';
    banner.className = 'sp-context-banner';
    banner.setAttribute('aria-live', 'assertive');
    banner.setAttribute('aria-atomic', 'true');
    banner.textContent = tSidepanel('sideExtensionRestarted', 'Extension restarted. Reconnect side panel.');
    banner.addEventListener('click', () => location.reload());
    document.body.prepend(banner);
  }

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

  function getSidepanelFocusDescriptor(control = document.activeElement) {
    const row = control?.closest?.('[data-script-id]');
    if (!(row instanceof HTMLElement)) return null;
    const list = row.closest('#pageScriptList') ? 'page' : row.closest('#allScriptList') ? 'all' : '';
    if (!list) return null;
    const container = list === 'page' ? $('pageScriptList') : $('allScriptList');
    const rows = Array.from(container.querySelectorAll('[data-script-id]'));
    const rowIndex = rows.indexOf(row);
    let target = 'row';
    if (control.matches?.('.sp-toggle input')) {
      target = 'toggle';
    } else if (control.matches?.('.sp-item-name-btn')) {
      target = 'name';
    }
    return {
      list,
      scriptId: row.dataset.scriptId || '',
      rowIndex: rowIndex >= 0 ? rowIndex : 0,
      target
    };
  }

  function resolveSidepanelFocusTarget(descriptor) {
    if (!descriptor) return null;
    const container = descriptor.list === 'page' ? $('pageScriptList') : $('allScriptList');
    const rows = Array.from(container.querySelectorAll('[data-script-id]'));
    if (!rows.length) return null;
    const row = rows.find((item) => item.dataset.scriptId === descriptor.scriptId)
      || rows[Math.min(descriptor.rowIndex ?? 0, rows.length - 1)]
      || rows[0];
    if (!(row instanceof HTMLElement)) return null;
    if (descriptor.target === 'toggle') {
      return row.querySelector('.sp-toggle input') || row;
    }
    if (descriptor.target === 'name') {
      return row.querySelector('.sp-item-name-btn') || row;
    }
    return row;
  }

  function restoreSidepanelFocus(descriptor) {
    const target = resolveSidepanelFocusTarget(descriptor);
    if (!(target instanceof HTMLElement)) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  }

  function restoreSidepanelFallbackFocus(listName) {
    const searchInput = $('spSearch');
    if (listName === 'all') {
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus({ preventScroll: true });
        if (searchQuery) {
          searchInput.select?.();
        }
        return;
      }
      $('allSectionHeader')?.focus?.({ preventScroll: true });
      return;
    }

    const target = $('pageScriptList')?.querySelector('.sp-empty-link')
      || $('btnRefresh')
      || $('btnDashboard')
      || searchInput;
    if (!(target instanceof HTMLElement)) return;
    target.focus({ preventScroll: true });
  }

  function setListBusy(isBusy) {
    $('pageScriptList')?.setAttribute('aria-busy', String(isBusy));
    $('allScriptList')?.setAttribute('aria-busy', String(isBusy));
  }

  function setButtonLabel(button, label) {
    if (!button) return;
    const labelEl = button.querySelector('span');
    if (labelEl) {
      labelEl.textContent = label;
      return;
    }
    button.textContent = label;
  }

  function updateSearchSummary(filteredCount = allScripts.length) {
    const status = $('spSearchStatus');
    if (!status) return;
    const total = allScripts.length;
    const normalizedQuery = searchQuery.replace(/\s+/g, ' ').trim();
    if (!total) {
      status.textContent = tSidepanel('sideNoScriptsInstalled', 'No scripts installed yet.');
      return;
    }
    if (normalizedQuery) {
      status.textContent = tSidepanel('sideShowingFilteredScripts', 'Showing {shown} of {total} installed scripts for "{query}".', {
        shown: numberFormatter.format(filteredCount),
        total: numberFormatter.format(total),
        query: normalizedQuery
      });
      return;
    }
    status.textContent = tSidepanel('sideShowingAllInstalledScripts', 'Showing all installed scripts.');
  }

  function updatePageActions() {
    const toggleButton = $('btnToggleAll');
    if (toggleButton) {
      const pageCount = pageScripts.length;
      const anyEnabled = pageScripts.some((script) => script.enabled !== false);
      const canToggle = currentPageCanRunScripts && pageCount > 0;
      toggleButton.disabled = !canToggle;
      toggleButton.textContent = canToggle
        ? (anyEnabled ? tSidepanel('sideDisablePageScripts', 'Disable Page Scripts') : tSidepanel('sideEnablePageScripts', 'Enable Page Scripts'))
        : tSidepanel('sideToggleAll', 'Toggle All');
      toggleButton.setAttribute(
        'aria-label',
        canToggle
          ? `${toggleButton.textContent} (${numberFormatter.format(pageCount)})`
          : tSidepanel('sideNoPageScriptsToggle', 'No page scripts are available to toggle')
      );
    }

    const findButton = $('btnFindScripts');
    if (findButton) {
      let hostname = '';
      if (canMatchScriptsForUrl(currentTab?.url || '')) {
        try { hostname = new URL(currentTab?.url || '').hostname.replace(/^www\./, ''); } catch {}
      }
      setButtonLabel(findButton, hostname
        ? tSidepanel('sideFindForHost', 'Find for {hostname}', { hostname })
        : tSidepanel('sideFind', 'Find'));
      findButton.setAttribute('aria-label', hostname
        ? tSidepanel('sideFindUserscriptsForHost', 'Find userscripts for {hostname}', { hostname })
        : tSidepanel('sideFindUserscripts', 'Find userscripts'));
    }
  }

  function setAllScriptsCollapsed(collapsed) {
    allCollapsed = collapsed;
    const list = $('allScriptList');
    list?.classList.toggle('collapsed', collapsed);
    if (list) list.hidden = collapsed;
    $('allSectionHeader')?.setAttribute('aria-expanded', String(!collapsed));
    const collapseIcon = $('collapseIcon');
    if (collapseIcon) collapseIcon.textContent = collapsed ? '\u25B6' : '\u25BC';
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

  function summarizeHostAccessStatus(status) {
    const blocked = Array.isArray(status?.blockedScripts) ? status.blockedScripts : [];
    const names = blocked.slice(0, 2).map(script => script.name || script.id || 'script').join(', ');
    const remaining = status?.blockedCount > blocked.slice(0, 2).length
      ? tSidepanel('sideAdditionalScriptsNeedAccess', ' and {count} more', {
          count: numberFormatter.format(status.blockedCount - blocked.slice(0, 2).length)
        })
      : '';
    if (names) {
      return tSidepanel('sideScriptsNeedAccess', '{names}{remaining} need browser access for {host}.', {
        names,
        remaining,
        host: status.host || 'this site'
      });
    }
    return status?.message || tSidepanel('sideGrantAccessBeforeMatching', 'Grant browser access before matching scripts can run here.');
  }

  function renderHostAccessPanel(status = hostPermissionStatus) {
    const panel = $('hostAccessPanel');
    const message = $('hostAccessMessage');
    const button = $('btnGrantHostAccess');
    if (!panel || !message || !button) return;

    const show = !!status?.needsHostAccess;
    panel.hidden = !show;
    panel.classList.toggle('show', show);
    button.hidden = !show;
    if (!show) {
      message.textContent = '';
      return;
    }
    message.textContent = summarizeHostAccessStatus(status);
    button.textContent = status.requestMethod === 'addHostAccessRequest'
      ? tSidepanel('sideRequestSiteAccess', 'Request Site Access')
      : tSidepanel('sideGrantSiteAccess', 'Grant Site Access');
  }

  async function requestHostAccessFromPanel() {
    const status = hostPermissionStatus;
    if (!status?.supported || !status.pattern) {
      showPanelNotice(status?.message || tSidepanel('sideHostAccessUnavailable', 'Host access is not available for this page'), 'error');
      return;
    }

    const button = $('btnGrantHostAccess');
    if (button) button.disabled = true;
    try {
      if (status.requestMethod === 'addHostAccessRequest') {
        const response = await chrome.runtime.sendMessage({
          action: 'queueHostAccessRequest',
          url: currentTab?.url || '',
          tabId: currentTab?.id
        });
        if (response?.error || response?.success === false) {
          throw new Error(response?.error || 'Could not queue site access request');
        }
        showPanelNotice(response.message || tSidepanel('sideSiteAccessRequestAdded', 'Site access request added'));
      } else if (chrome.permissions?.request) {
        const granted = await chrome.permissions.request({ origins: [status.pattern] });
        showPanelNotice(granted ? tSidepanel('sideSiteAccessGranted', 'Site access granted') : tSidepanel('sideSiteAccessNotGranted', 'Site access was not granted'), granted ? 'success' : 'error');
      } else {
        await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
      }
      await refresh();
    } catch (error) {
      showPanelNotice(error?.message || tSidepanel('sideRequestSiteAccessFailed', 'Failed to request site access'), 'error');
    } finally {
      if (button) button.disabled = false;
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
    applySidepanelI18n();
    await loadSettings();
    applyTheme();
    applySidePanelLayout();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const layout = settings.layout || 'dark';
      if (layout === 'auto') applyTheme();
    });
    await refresh();
    setupEventListeners();
    setupTabListeners();
    setupLifecycleListeners();
  }

  async function applySidePanelLayout() {
    try {
      if (typeof chrome.sidePanel?.getLayout !== 'function') return;
      const layout = await chrome.sidePanel.getLayout();
      if (layout?.position === 'left' || layout?.position === 'right') {
        document.documentElement.dataset.panelPosition = layout.position;
      }
    } catch (_) { /* sidePanel.getLayout unavailable — Chrome <140 or Firefox */ }
  }

  async function loadSettings() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
      settings = res?.settings || res || {};
    } catch (error) {
      console.error('[SP] settings load error:', error);
      settings = {};
      if (isContextInvalidated(error)) {
        showContextInvalidatedBanner();
        return;
      }
      showPanelNotice(
        error?.message || tSidepanel('sideSettingsLoadFailed', 'Could not load side panel settings. Using defaults.'),
        'error',
      );
    }
  }

  function applyTheme() {
    const layout = settings.layout || 'dark';
    const resolved = layout === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : layout;
    document.documentElement.setAttribute('data-theme', resolved);
  }

  async function refresh() {
    if (searchRenderTimer) { clearTimeout(searchRenderTimer); searchRenderTimer = null; }
    const myGeneration = ++_refreshGeneration;
    setListBusy(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (myGeneration !== _refreshGeneration) return;
      currentTab = tab;
      updateUrlBar();
      const currentUrl = currentTab?.url || '';
      currentPageCanRunScripts = canMatchScriptsForUrl(currentUrl);
      const [allRes, matchedRes, hostStatus] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getScripts' }),
        currentPageCanRunScripts
          ? chrome.runtime.sendMessage({ action: 'getScriptsForUrl', url: currentUrl })
          : Promise.resolve([]),
        currentPageCanRunScripts
          ? chrome.runtime.sendMessage({ action: 'getHostPermissionStatus', url: currentUrl }).catch(() => null)
          : Promise.resolve(null)
      ]);
      // Phase 39.23 — VM #2516 cross-realm array guard. Coerce through
      // Array.from so an array-like response from a foreign realm doesn't
      // crash the subsequent for-of in renderPageScripts.
      if (myGeneration !== _refreshGeneration) return;
      const rawAll = allRes?.scripts ?? Object.values(allRes || {});
      allScripts = Array.isArray(rawAll) ? rawAll : Array.from(rawAll ?? []);
      pageScripts = Array.isArray(matchedRes) ? matchedRes : Array.from(matchedRes ?? []);
      hostPermissionStatus = hostStatus || null;
      renderPageScripts();
      renderAllScripts();
      renderHostAccessPanel();
      await refreshPendingUpdatesChip();
    } catch (e) {
      console.error('[SP] refresh error:', e);
      if (isContextInvalidated(e)) { showContextInvalidatedBanner(); return; }
      const list = $('pageScriptList');
      if (list) {
        list.replaceChildren();
        const err = document.createElement('div');
        err.className = 'sp-empty';
        err.textContent = tSidepanel('sideUnableToReachBackground', 'Unable to reach the background service. Refresh the panel to reconnect.');
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
    const urlHostname = $('urlHostname');
    const urlPath = $('urlPath');
    const urlBar = $('urlBar');
    if (urlHostname) urlHostname.textContent = hostname || '(no page)';
    if (urlPath) urlPath.textContent = hostname ? path : '';
    if (urlBar) urlBar.title = url;
  }

  // ── Render page scripts ──────────────────────────────────────────────────
  function renderPageScripts() {
    const list = $('pageScriptList');
    if (!list) return;
    const focusDescriptor = list.contains(document.activeElement) ? getSidepanelFocusDescriptor(document.activeElement) : null;
    const pageCountEl = $('pageScriptCount');
    if (pageCountEl) pageCountEl.textContent = numberFormatter.format(pageScripts.length);

    if (!currentPageCanRunScripts) {
      list.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'sp-empty';
      const icon = document.createElement('div');
      icon.className = 'sp-empty-icon';
      icon.textContent = '!';
      icon.setAttribute('aria-hidden', 'true');
      const msg = document.createElement('div');
      msg.className = 'sp-empty-title';
      msg.textContent = tSidepanel('sideNoRegularPageTitle', 'Scripts don’t run on this page.');
      const detail = document.createElement('div');
      detail.className = 'sp-empty-detail';
      detail.textContent = tSidepanel('sideNoRegularPageDetail', 'Open a regular website or local file to review matching userscripts.');
      empty.append(icon, msg, detail);
      list.replaceChildren(empty);
      updatePageActions();
      if (focusDescriptor) {
        requestAnimationFrame(() => restoreSidepanelFallbackFocus('page'));
      }
      return;
    }

    if (!pageScripts.length) {
      const url = currentTab?.url || '';
      let hostname = '';
      try { hostname = new URL(url).hostname; } catch {}
      list.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'sp-empty';
      const icon = document.createElement('div');
      icon.className = 'sp-empty-icon';
      icon.textContent = 'SV';
      icon.setAttribute('aria-hidden', 'true');
      const msg = document.createElement('div');
      msg.className = 'sp-empty-title';
      msg.textContent = tSidepanel('sideNoMatchingScriptsTitle', 'No matching scripts on this page.');
      const link = document.createElement('div');
      link.className = 'sp-empty-detail';
      if (hostname) {
        const a = document.createElement('button');
        a.className = 'sp-empty-link';
        a.type = 'button';
        a.textContent = tSidepanel('sideFindScriptsForHostText', 'Find scripts for {hostname}', { hostname });
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
      if (focusDescriptor) {
        requestAnimationFrame(() => restoreSidepanelFallbackFocus('page'));
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const script of pageScripts) {
      fragment.appendChild(buildScriptItem(script, true));
    }
    list.replaceChildren(fragment);
    updatePageActions();
    if (focusDescriptor) {
      requestAnimationFrame(() => restoreSidepanelFocus(focusDescriptor));
    }
  }

  // ── Render all scripts ────────────────────────────────────────────────────
  function renderAllScripts() {
    const list = $('allScriptList');
    if (!list) return; // mirror renderPageScripts — degrade instead of crashing if the element is missing
    const focusDescriptor = list.contains(document.activeElement) ? getSidepanelFocusDescriptor(document.activeElement) : null;
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

    const allScriptCountEl = $('allScriptCount');
    if (allScriptCountEl) allScriptCountEl.textContent = numberFormatter.format(filtered.length) + (filtered.length !== allScripts.length ? '/' + numberFormatter.format(allScripts.length) : '');

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
      icon.textContent = searchQuery ? '\u2315' : 'SV';
      icon.setAttribute('aria-hidden', 'true');
      const msg = document.createElement('div');
      msg.className = 'sp-empty-title';
      msg.textContent = searchQuery
        ? tSidepanel('sideNoMatchingScriptsForQuery', 'No scripts match "{query}".', { query: searchQuery })
        : tSidepanel('sideNoScriptsInVault', 'No scripts in your vault yet.');
      empty.append(icon, msg);
      if (!searchQuery) {
        const detail = document.createElement('div');
        detail.className = 'sp-empty-detail';
        detail.textContent = tSidepanel('sideOpenDashboardToCreate', 'Open Dashboard to create or import a userscript.');
        empty.appendChild(detail);
      }
      if (searchQuery) {
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'sp-empty-link';
        reset.textContent = tSidepanel('sideClearSearch', 'Clear search');
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
      if (focusDescriptor) {
        requestAnimationFrame(() => restoreSidepanelFallbackFocus('all'));
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const script of sorted) {
      fragment.appendChild(buildScriptItem(script, false));
    }
    list.replaceChildren(fragment);
    updateSearchSummary(sorted.length);
    setAllScriptsCollapsed(allCollapsed);
    if (focusDescriptor) {
      requestAnimationFrame(() => restoreSidepanelFocus(focusDescriptor));
    }
  }

  function buildScriptItem(script, isPageScript) {
    const enabled = script.enabled !== false;
    const meta = script.meta || {};
    const stats = script.stats || {};
    const hasError = stats.errors > 0;
    const avgMs = stats.avgTime;
    const errorLabel = tSidepanel(stats.errors === 1 ? 'errorSingular' : 'errorPlural', stats.errors === 1 ? 'error' : 'errors');
    const detailText = isPageScript
      ? (hasError
          ? tSidepanel('sideScriptErrorsRecorded', '{count} {errors} recorded', {
              count: numberFormatter.format(stats.errors),
              errors: errorLabel
            })
          : enabled
            ? tSidepanel('sideAvailableOnThisPage', 'Available on this page')
            : tSidepanel('sidePausedForThisPage', 'Paused for this page'))
      : (meta.description || '');
    const averageLabel = avgMs != null && enabled
      ? (avgMs < 1000
          ? tSidepanel('sideAverageExecutionMs', 'average {ms} milliseconds', { ms: avgMs.toFixed(0) })
          : tSidepanel('sideAverageExecutionSeconds', 'average {seconds} seconds', { seconds: (avgMs / 1000).toFixed(1) }))
      : '';

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
        tSidepanel(enabled ? 'enabled' : 'disabled', enabled ? 'enabled' : 'disabled'),
        hasError ? tSidepanel('sideErrorCountAria', '{count} {errors}', { count: numberFormatter.format(stats.errors), errors: errorLabel }) : '',
        averageLabel
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
    name.setAttribute('aria-label', tSidepanel('sideOpenScriptInEditor', 'Open {name} in editor', { name: meta.name || script.id }));
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
      dot.title = tSidepanel('sideErrorCountAria', '{count} {errors}', { count: numberFormatter.format(stats.errors), errors: errorLabel });
      meta2.appendChild(dot);
    }
    if (avgMs != null && enabled) {
      const badge = document.createElement('span');
      badge.className = 'sp-timing ' + (avgMs < 50 ? 'fast' : avgMs < 200 ? 'medium' : 'slow');
      badge.textContent = avgMs < 1000 ? avgMs.toFixed(0) + 'ms' : (avgMs / 1000).toFixed(1) + 's';
      badge.title = tSidepanel('sideAvgExecutionTime', 'Avg execution time');
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
      const error = getRuntimeError(result, tSidepanel('sideFailedUpdateScript', 'Failed to update script'));
      if (error) throw new Error(error);
      updateLocalScriptState(id, enabled);
      renderPageScripts();
      renderAllScripts();
    } catch (error) {
      if (isContextInvalidated(error)) { showContextInvalidatedBanner(); return; }
      showPanelNotice(error.message || tSidepanel('sideFailedUpdateScript', 'Failed to update script'), 'error');
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
          const error = getRuntimeError(outcome.value.result, tSidepanel('sideFailedUpdateScript', 'Failed to update script'));
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
        const updatedLabel = tSidepanel(updated === 1 ? 'scriptSingular' : 'scriptPlural', updated === 1 ? 'script' : 'scripts');
        showPanelNotice(
          updated > 0
            ? tSidepanel('sideBulkUpdatePartial', 'Updated {updated} {scripts}, but {failed} failed.', {
                updated: numberFormatter.format(updated),
                scripts: updatedLabel,
                failed: numberFormatter.format(failed)
              })
            : tSidepanel('sideBulkUpdateFailed', 'Failed to update scripts on this page.'),
          'error'
        );
        if (needsRefresh || updated === 0) {
          await refresh();
        }
        return;
      }

      const updatedLabel = tSidepanel(updated === 1 ? 'scriptSingular' : 'scriptPlural', updated === 1 ? 'script' : 'scripts');
      showPanelNotice(
        tSidepanel('sideBulkUpdateSuccess', '{state} {count} {scripts} on this page.', {
          state: newState ? tSidepanel('enabled', 'Enabled') : tSidepanel('disabled', 'Disabled'),
          count: numberFormatter.format(updated),
          scripts: updatedLabel
        })
      );
    } finally {
      setPageScriptRowsBusy(false);
      if (toggleButton) toggleButton.disabled = false;
    }
  }

  function openInEditor(id) {
    // Swallow rejection — the user will see the dashboard tab open (or not) and
    // nothing else depends on the response here.
    chrome.runtime.sendMessage({ action: 'openDashboard', scriptId: id }).catch(() => {});
  }

  async function refreshPendingUpdatesChip(existingUpdates = null) {
    const chip = $('btnPendingUpdates');
    if (!chip) return;
    try {
      const updates = Array.isArray(existingUpdates)
        ? existingUpdates
        : await chrome.runtime.sendMessage({ action: 'getPendingUpdates' });
      const count = Array.isArray(updates) ? updates.length : 0;
      chip.hidden = count === 0;
      chip.textContent = numberFormatter.format(count);
      chip.setAttribute('aria-label', tSidepanel('sideQueuedUpdates', '{count} queued {updates}', {
        count: numberFormatter.format(count),
        updates: tSidepanel(count === 1 ? 'updateSingular' : 'updatePlural', count === 1 ? 'update' : 'updates')
      }));
    } catch (_error) {
      chip.hidden = true;
    }
  }

  function openUpdatesDashboard() {
    chrome.runtime.sendMessage({ action: 'openDashboard', data: { tab: 'updates' } }).catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#tab=updates') });
    });
  }

  function openHelpDashboard() {
    chrome.runtime.sendMessage({ action: 'openDashboard', data: { tab: 'help' } }).catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#tab=help') });
    });
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  function setupEventListeners() {
    $('btnRefresh').addEventListener('click', refresh);
    $('btnPendingUpdates')?.addEventListener('click', openUpdatesDashboard);
    $('btnHelp')?.addEventListener('click', openHelpDashboard);
    $('btnDashboard').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openDashboard' }).catch(() => {}));
    $('btnNewScript').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openDashboard', data: { newScript: true } }).catch(() => {}));
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
    $('btnOpenDash').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openDashboard' }).catch(() => {}));
    $('btnToggleAll').addEventListener('click', toggleAll);
    $('btnGrantHostAccess')?.addEventListener('click', requestHostAccessFromPanel);
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
      document.addEventListener('keydown', (e) => {
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
    renderHostAccessPanel();
    setAllScriptsCollapsed(false);
  }

  let _tabListenersActive = false;
  let _onActivated = null;
  let _onUpdated = null;
  let _onRuntimeMessage = null;

  function setupTabListeners() {
    if (_tabListenersActive) return;
    _onActivated = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 150);
    };
    _onUpdated = (tabId, info) => {
      if (info.status === 'complete' && currentTab && tabId === currentTab.id) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 200);
      }
    };
    _onRuntimeMessage = (message) => {
      if (message?.action === 'runtimeHostPermissionsChanged') {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 150);
      }
    };
    chrome.tabs.onActivated.addListener(_onActivated);
    chrome.tabs.onUpdated.addListener(_onUpdated);
    chrome.runtime.onMessage?.addListener(_onRuntimeMessage);
    _tabListenersActive = true;
  }

  function teardownTabListeners() {
    if (!_tabListenersActive) return;
    if (_onActivated) chrome.tabs.onActivated.removeListener(_onActivated);
    if (_onUpdated) chrome.tabs.onUpdated.removeListener(_onUpdated);
    if (_onRuntimeMessage) chrome.runtime.onMessage?.removeListener(_onRuntimeMessage);
    clearTimeout(refreshTimer);
    refreshTimer = null;
    _tabListenersActive = false;
  }

  function setupLifecycleListeners() {
    if (typeof chrome.sidePanel?.onOpened?.addListener !== 'function') return;
    chrome.sidePanel.onOpened.addListener(() => {
      setupTabListeners();
      refresh();
    });
    if (typeof chrome.sidePanel?.onClosed?.addListener === 'function') {
      chrome.sidePanel.onClosed.addListener(() => {
        teardownTabListeners();
      });
    }
  }

  init().catch((error) => {
    console.error('[SP] init error:', error);
    if (isContextInvalidated(error)) {
      showContextInvalidatedBanner();
      return;
    }
    showPanelNotice(
      error?.message || tSidepanel('sidePanelStartupFailed', 'Side panel could not start. Refresh the panel to reconnect.'),
      'error',
    );
  });
})();
