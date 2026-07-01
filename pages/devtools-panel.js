// ScriptVault DevTools Panel v2.0.0
// Network inspection, execution profiling, and console capture

(function () {
  'use strict';

  const _svPolicy = (typeof window.trustedTypes !== 'undefined' && window.trustedTypes.createPolicy)
      ? window.trustedTypes.createPolicy('sv-devtools', { createHTML: s => s })
      : null;
  function htmlToFragment(html, contextEl) {
      // Anchor the parse range in the target element so context-sensitive tags
      // (<td>/<tr> table cells especially) parse correctly instead of being
      // dropped in document context (regression fixed 2026-07-01).
      const range = document.createRange();
      if (contextEl) range.selectNodeContents(contextEl);
      return range.createContextualFragment(String(html ?? ''));
  }
  function safeSetHtml(el, html) {
      el.replaceChildren(htmlToFragment(_svPolicy ? _svPolicy.createHTML(html) : html, el));
  }

  function getDevtoolsI18n() {
    try {
      return typeof I18n !== 'undefined' ? I18n : null;
    } catch (_) {
      return null;
    }
  }

  function tDevtools(key, fallback = key, placeholders = {}) {
    const i18n = getDevtoolsI18n();
    return i18n?.getMessage ? i18n.getMessage(key, placeholders) : fallback;
  }

  function requestLabel(count) {
    return tDevtools(count === 1 ? 'requestSingular' : 'requestPlural', count === 1 ? 'request' : 'requests');
  }

  function scriptLabel(count) {
    return tDevtools(count === 1 ? 'scriptSingular' : 'scriptPlural', count === 1 ? 'script' : 'scripts');
  }

  function profileLabel(count) {
    return tDevtools(count === 1 ? 'scriptProfileSingular' : 'scriptProfilePlural', count === 1 ? 'script profile' : 'script profiles');
  }

  function applyDevtoolsI18n() {
    const i18n = getDevtoolsI18n();
    if (!i18n?.applyToDOM) return;
    i18n.init?.('auto');
    i18n.applyToDOM(document);
  }

  const $ = id => {
    const el = document.getElementById(id);
    if (!el) {
      const stub = document.createElement('div');
      stub.dataset._dtStub = id;
      return stub;
    }
    return el;
  };
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });

  let netLog = [];
  let scripts = [];
  let filterText = '';
  let selectedRow = null;
  let focusedRow = null;
  let refreshTimer = null;
  let activeTab = 'network';
  let isRefreshing = false;

  function setActiveTab(nextTab) {
    activeTab = nextTab;
    const panels = { network: $('panelNetwork'), execution: $('panelExecution'), console: $('panelConsole') };
    document.querySelectorAll('.tab-btn').forEach((button) => {
      const isActive = button.dataset.tab === nextTab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    Object.entries(panels).forEach(([name, panel]) => {
      const isActive = name === nextTab;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
    if (nextTab !== 'network') closeDetail();
    $('btnExportHAR').style.display = nextTab === 'network' ? '' : 'none';
    updateToolbarContext();
    if (nextTab === 'network') renderNetwork();
    if (nextTab === 'execution') renderExecution();
    if (nextTab === 'console') renderConsoleState();
  }

  function setToolbarStatus(message, tone = '') {
    const status = $('toolbarStatus');
    status.textContent = message;
    if (tone) {
      status.dataset.tone = tone;
    } else {
      delete status.dataset.tone;
    }
  }

  function setRefreshBusy(isBusy, { quiet = false } = {}) {
    const refreshButton = $('btnRefresh');
    document.body.toggleAttribute('data-refreshing', isBusy);
    $('devtoolsStatus').setAttribute('aria-busy', String(isBusy));
    $('netTableWrap').setAttribute('aria-busy', String(isBusy));
    $('execTableWrap').setAttribute('aria-busy', String(isBusy));
    $('panelExecution').setAttribute('aria-busy', String(isBusy));
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.disabled = isBusy;
      if (isBusy) {
        refreshButton.dataset.originalLabel = refreshButton.dataset.originalLabel || refreshButton.textContent || tDevtools('devtoolsRefresh', 'Refresh');
        refreshButton.setAttribute('aria-busy', 'true');
        if (!quiet) refreshButton.textContent = tDevtools('devtoolsRefreshing', 'Refreshing...');
      } else {
        refreshButton.removeAttribute('aria-busy');
        refreshButton.textContent = refreshButton.dataset.originalLabel || tDevtools('devtoolsRefresh', 'Refresh');
        delete refreshButton.dataset.originalLabel;
      }
    }
  }

  function clearFilter({ focus = false } = {}) {
    const filterInput = $('filterInput');
    filterInput.value = '';
    filterText = '';
    if (activeTab === 'network') renderNetwork();
    if (activeTab === 'execution') renderExecution();
    if (focus) {
      filterInput.focus();
      filterInput.select?.();
    }
  }

  function getNetworkRows() {
    return Array.from(document.querySelectorAll('#netTableBody tr[data-id]'));
  }

  function renderDetailContent(entry) {
    const detailUrl = entry.url || '';
    $('netDetailTitle').textContent = (entry.method || 'GET') + ' '
      + (detailUrl.length > 40 ? detailUrl.slice(0, 40) + '…' : detailUrl);

    let html = '';
    html += section(tDevtools('devtoolsGeneralSection', 'General'), [
      [tDevtools('devtoolsUrlField', 'URL'), escapeHtml(entry.url || '')],
      [tDevtools('devtoolsMethodField', 'Method'), escapeHtml(entry.method || 'GET')],
      [tDevtools('devtoolsStatusField', 'Status'), entry.status ? `${Number(entry.status) || 0} ${escapeHtml(entry.statusText || '')}` : tDevtools('error', 'Error')],
      [tDevtools('devtoolsDurationField', 'Duration'), formatDuration(entry.duration)],
      [tDevtools('devtoolsSizeField', 'Size'), formatBytes(entry.responseSize)],
      [tDevtools('devtoolsScriptField', 'Script'), escapeHtml(entry.scriptName || '')],
      [tDevtools('devtoolsTimeField', 'Time'), timeFormatter.format(new Date(entry.timestamp))]
    ]);

    if (entry.requestHeaders) {
      html += section(tDevtools('devtoolsRequestHeadersSection', 'Request Headers'), Object.entries(entry.requestHeaders).map(([k, v]) => [escapeHtml(k), escapeHtml(String(v))]));
    }
    if (entry.responseHeaders) {
      html += section(tDevtools('devtoolsResponseHeadersSection', 'Response Headers'), Object.entries(entry.responseHeaders).map(([k, v]) => [escapeHtml(k), escapeHtml(String(v))]));
    }
    if (entry.error) {
      html += `<div class="net-detail-section"><div class="net-detail-section-title">${escapeHtml(tDevtools('devtoolsErrorSection', 'Error'))}</div><div style="color:var(--danger)">${escapeHtml(entry.error)}</div></div>`;
    }
    if (entry.responsePreview) {
      html += `<div class="net-detail-section"><div class="net-detail-section-title">${escapeHtml(tDevtools('devtoolsResponsePreviewSection', 'Response Preview'))}</div><pre class="net-body-pre">${escapeHtml(String(entry.responsePreview).slice(0, 2000))}</pre></div>`;
    }

    safeSetHtml($('netDetailBody'), html);
  }

  function syncNetworkRowState() {
    const rows = getNetworkRows();
    if (!rows.length) return;
    const activeRowId = String(focusedRow ?? selectedRow ?? rows[0].dataset.id);
    rows.forEach((row) => {
      const isFocused = row.dataset.id === activeRowId;
      const isSelected = row.dataset.id === String(selectedRow);
      row.tabIndex = isFocused ? 0 : -1;
      row.classList.toggle('selected', isSelected);
      row.setAttribute('aria-selected', String(isSelected));
    });
  }

  function focusNetworkRow(target) {
    const rows = getNetworkRows();
    if (!rows.length) return;
    const nextRow = typeof target === 'number'
      ? rows[Math.max(0, Math.min(rows.length - 1, target))]
      : target;
    if (!nextRow) return;
    focusedRow = nextRow.dataset.id;
    syncNetworkRowState();
    nextRow.focus();
    nextRow.scrollIntoView({ block: 'nearest' });
  }

  function moveNetworkRowFocus(currentRow, delta) {
    const rows = getNetworkRows();
    if (!rows.length) return;
    const currentIndex = rows.indexOf(currentRow);
    if (currentIndex === -1) return;
    focusNetworkRow(currentIndex + delta);
  }

  function closeDetail({ restoreFocus = false } = {}) {
    const detail = $('netDetail');
    detail.classList.remove('open');
    detail.hidden = true;
    detail.setAttribute('aria-hidden', 'true');
    selectedRow = null;
    syncNetworkRowState();
    if (restoreFocus) {
      const activeRow = getNetworkRows().find((row) => row.dataset.id === String(focusedRow));
      activeRow?.focus();
    }
  }

  function updateToolbarContext() {
    const filterInput = $('filterInput');
    const clearButton = $('btnClear');
    if (activeTab === 'network') {
      filterInput.disabled = false;
      filterInput.placeholder = tDevtools('devtoolsFilterRequestsPlaceholder', 'Filter requests, URLs, or scripts…');
      filterInput.setAttribute('aria-label', tDevtools('devtoolsFilterNetworkRequests', 'Filter network requests'));
      clearButton.hidden = false;
      clearButton.textContent = tDevtools('clearAction', 'Clear');
      clearButton.setAttribute('aria-label', tDevtools('devtoolsClearRecordedNetworkRequests', 'Clear recorded network requests'));
      clearButton.disabled = netLog.length === 0;
      return;
    }
    if (activeTab === 'execution') {
      filterInput.disabled = false;
      filterInput.placeholder = tDevtools('devtoolsFilterExecutionPlaceholder', 'Filter scripts in execution stats…');
      filterInput.setAttribute('aria-label', tDevtools('devtoolsFilterExecutionAria', 'Filter execution statistics'));
      clearButton.hidden = false;
      clearButton.textContent = tDevtools('resetView', 'Reset View');
      clearButton.setAttribute('aria-label', tDevtools('devtoolsResetExecutionFilter', 'Reset execution filter'));
      clearButton.disabled = !filterText;
      return;
    }
    filterInput.disabled = true;
    filterInput.placeholder = tDevtools('devtoolsConsoleSearchUnavailable', 'Console search is unavailable in this panel');
    filterInput.setAttribute('aria-label', tDevtools('devtoolsConsoleSearchUnavailable', 'Console search unavailable'));
    clearButton.hidden = true;
    setToolbarStatus(tDevtools('devtoolsConsoleCaptureUnavailable', 'Console capture isn’t available here yet. Use Network or Execution for current insight.'));
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  async function applyTheme() {
    // The panel HTML hardcodes data-theme="dark"; without this the panel
    // stayed dark for light/catppuccin/oled users (and its per-theme CSS
    // overrides were dead). Mirror the popup/install/sidepanel theme logic.
    try {
      const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
      const themeSettings = settings?.settings || settings || {};
      const layoutPref = themeSettings.layout || 'dark';
      const resolve = () => layoutPref === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : layoutPref;
      document.documentElement.setAttribute('data-theme', resolve());
      if (layoutPref === 'auto') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          document.documentElement.setAttribute('data-theme', resolve());
        });
      }
    } catch (_e) { /* keep the default dark theme on failure */ }
  }

  async function init() {
    await applyTheme();
    applyDevtoolsI18n();
    setupTabs();
    setupToolbar();
    await refreshAll();
    startAutoRefresh();
  }

  async function refreshAll(options = {}) {
    if (isRefreshing) return;
    isRefreshing = true;
    const quiet = options.quiet === true;
    setRefreshBusy(true, { quiet });
    try {
      const [logResult, scriptsResult] = await Promise.allSettled([
        chrome.runtime.sendMessage({ action: 'getNetworkLog', limit: 200 }),
        chrome.runtime.sendMessage({ action: 'getScripts' })
      ]);
      const failures = [];
      if (logResult.status === 'fulfilled') netLog = logResult.value || [];
      else failures.push(tDevtools('devtoolsNetworkLogLabel', 'network log'));
      if (scriptsResult.status === 'fulfilled') {
        const val = scriptsResult.value;
        scripts = val?.scripts || Object.values(val || {});
      } else {
        failures.push(tDevtools('devtoolsScriptStatsLabel', 'script stats'));
      }
      renderNetwork();
      renderExecution();
      if (activeTab === 'console') renderConsoleState();
      if (failures.length) {
        setToolbarStatus(tDevtools('devtoolsCouldNotRefresh', 'Could not refresh {failures}. Showing the last available data.', { failures: failures.join(' and ') }), 'error');
      } else if (!quiet) {
        setToolbarStatus(tDevtools('devtoolsDiagnosticsRefreshed', 'Diagnostics refreshed.'), 'success');
      }
    } catch (e) {
      console.error('[DT] refresh error:', e);
      setToolbarStatus(tDevtools('devtoolsDiagnosticsRefreshFailed', 'Diagnostics refresh failed. Showing the last available data.'), 'error');
    } finally {
      isRefreshing = false;
      setRefreshBusy(false, { quiet });
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshAll({ quiet: true }), 3000);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoRefresh();
    } else {
      refreshAll({ quiet: true });
      startAutoRefresh();
    }
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    tabs.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        setActiveTab(btn.dataset.tab);
      });
      btn.addEventListener('keydown', (event) => {
        const firstIndex = 0;
        const lastIndex = tabs.length - 1;
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? firstIndex : index + 1;
        else if (event.key === 'ArrowLeft') nextIndex = index === firstIndex ? lastIndex : index - 1;
        else if (event.key === 'Home') nextIndex = firstIndex;
        else if (event.key === 'End') nextIndex = lastIndex;
        else return;
        event.preventDefault();
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
      });
    });
    setActiveTab('network');
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────
  function setupToolbar() {
    $('btnRefresh').addEventListener('click', () => refreshAll());
    $('btnClear').addEventListener('click', async () => {
      if (activeTab === 'network') {
        await chrome.runtime.sendMessage({ action: 'clearNetworkLog' });
        netLog = [];
        selectedRow = null;
        focusedRow = null;
        renderNetwork();
        return;
      }
      if (activeTab === 'execution') {
        clearFilter({ focus: true });
      }
    });
    $('btnExportHAR').addEventListener('click', exportHAR);
    $('btnExportTrace').addEventListener('click', exportTrace);
    $('btnCloseDetail').addEventListener('click', () => closeDetail({ restoreFocus: true }));
    $('btnConsoleToNetwork').addEventListener('click', () => setActiveTab('network'));
    $('btnConsoleToExecution').addEventListener('click', () => setActiveTab('execution'));
    $('filterInput').addEventListener('input', e => {
      filterText = e.target.value.toLowerCase();
      if (activeTab === 'network') renderNetwork();
      if (activeTab === 'execution') renderExecution();
    });
    $('filterInput').addEventListener('search', () => {
      filterText = $('filterInput').value.toLowerCase();
      if (activeTab === 'network') renderNetwork();
      if (activeTab === 'execution') renderExecution();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && $('netDetail').classList.contains('open')) {
        closeDetail({ restoreFocus: true });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && activeTab !== 'console') {
        event.preventDefault();
        $('filterInput').focus();
        $('filterInput').select?.();
        return;
      }
      if (event.key === 'Escape' && document.activeElement === $('filterInput') && $('filterInput').value) {
        event.preventDefault();
        clearFilter({ focus: true });
      }
    });
  }

  // ── Network rendering ─────────────────────────────────────────────────────
  function renderNetwork() {
    const activeElement = document.activeElement;
    const restoreTableFocus = Boolean(activeElement?.closest?.('#netTableBody'));
    const activeInDetail = Boolean(activeElement?.closest?.('#netDetail'));
    const previousFocusedId = restoreTableFocus
      ? String(activeElement.closest('tr[data-id]')?.dataset.id || focusedRow || selectedRow || '')
      : '';
    const filtered = netLog.filter(e => {
      if (!filterText) return true;
      return (e.url || '').toLowerCase().includes(filterText) ||
             (e.scriptName || '').toLowerCase().includes(filterText) ||
             (e.method || '').toLowerCase().includes(filterText);
    });

    // Stats
    const errors = filtered.filter(e => e.error || (e.status && e.status >= 400)).length;
    const bytes = filtered.reduce((s, e) => s + (e.responseSize || 0), 0);
    $('netTotal').textContent = filtered.length;
    $('netErrors').textContent = errors;
    $('netBytes').textContent = formatBytes(bytes);
    if (activeTab === 'network') {
      setToolbarStatus(
        filtered.length
          ? tDevtools('devtoolsNetworkSummary', '{requests} visible • {errors} • {bytes} transferred', {
              requests: `${filtered.length} ${requestLabel(filtered.length)}`,
              errors: `${errors} ${tDevtools(errors === 1 ? 'errorSingular' : 'errorPlural', errors === 1 ? 'error' : 'errors')}`,
              bytes: formatBytes(bytes)
            })
          : (filterText
              ? tDevtools('devtoolsNoRequestsMatch', 'No requests match “{query}”', { query: filterText })
              : tDevtools('devtoolsNoNetworkRequestsYet', 'No network requests yet. Open a page that runs userscripts to capture activity.'))
      );
      $('btnClear').disabled = netLog.length === 0;
    }

    // Table
    const tbody = $('netTableBody');
    tbody.replaceChildren();
    if (!filtered.length) {
      closeDetail();
      if (activeInDetail) {
        $('filterInput').focus({ preventScroll: true });
      }
      const tr = document.createElement('tr');
      const title = filterText ? tDevtools('devtoolsNoRequestsMatchTitle', 'No requests match this filter') : tDevtools('devtoolsNoNetworkRequestsTitle', 'No network requests yet');
      const detail = filterText
        ? tDevtools('devtoolsNoRequestsMatchDetail', 'No requests match "{query}". Clear the filter or try a script, host, or method name.', { query: filterText })
        : tDevtools('devtoolsNoNetworkRequestsDetail', 'Open a page that runs userscripts to capture activity.');
      safeSetHtml(tr, `<td colspan="6" class="table-empty-cell">${tableEmptyMarkup(title, detail, 'NET')}</td>`);
      tbody.appendChild(tr);
      return;
    }
    if (!filtered.some((entry) => String(entry.id) === String(focusedRow))) {
      focusedRow = filtered[0]?.id ?? null;
    }
    for (const entry of filtered) {
      const tr = document.createElement('tr');
      tr.dataset.id = entry.id;
      tr.tabIndex = -1;
      tr.setAttribute('aria-selected', String(selectedRow === entry.id));
      tr.setAttribute('aria-label', `${(entry.method || 'GET').toUpperCase()} ${entry.url || ''}`);

      const rawMethod = (entry.method || 'GET').toUpperCase();
      // Constrain method to a safe token — HTTP methods are [A-Z]+, but
      // netlog records whatever the userscript passed. Unescaped content
      // lands inside both a class attribute and text, so enforce the
      // alphanumeric subset and escape the visible copy for display.
      const methodClass = /^[A-Z0-9_-]{1,16}$/.test(rawMethod) ? rawMethod : 'OTHER';
      const method = escapeHtml(rawMethod);
      const statusCode = entry.status || 0;
      const duration = entry.duration;
      let hostname = '';
      try { hostname = new URL(entry.url).hostname; } catch {}

      safeSetHtml(tr, `
        <td><span class="method-badge method-${methodClass}">${method}</span></td>
        <td title="${escapeHtml(entry.url || '')}">${escapeHtml(hostname + (entry.url || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 60))}</td>
        <td class="${statusClass(statusCode)}">${statusCode || '—'}</td>
        <td class="${durationClass(duration)}">${formatDuration(duration)}</td>
        <td>${formatBytes(entry.responseSize)}</td>
        <td title="${escapeHtml(entry.scriptName || '')}">${escapeHtml((entry.scriptName || '').slice(0, 20))}</td>
      `);

      tr.addEventListener('focus', () => {
        focusedRow = entry.id;
        syncNetworkRowState();
      });
      tr.addEventListener('click', () => {
        focusedRow = entry.id;
        showDetail(entry, tr);
      });
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showDetail(entry, tr, { moveFocus: true });
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveNetworkRowFocus(tr, 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveNetworkRowFocus(tr, -1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          focusNetworkRow(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          focusNetworkRow(getNetworkRows().length - 1);
        }
      });
      tbody.appendChild(tr);
    }
    syncNetworkRowState();
    const selectedEntry = filtered.find((entry) => String(entry.id) === String(selectedRow));
    if (selectedEntry && $('netDetail').classList.contains('open')) {
      renderDetailContent(selectedEntry);
    } else if (activeInDetail && !selectedEntry) {
      closeDetail();
      $('filterInput').focus({ preventScroll: true });
    }
    if (restoreTableFocus) {
      const rowToFocus = getNetworkRows().find((row) => row.dataset.id === previousFocusedId) || getNetworkRows()[0];
      rowToFocus?.focus({ preventScroll: true });
    }
  }

  function showDetail(entry, tr, { moveFocus = false } = {}) {
    selectedRow = entry.id;
    focusedRow = entry.id;
    syncNetworkRowState();

    const detail = $('netDetail');
    detail.classList.add('open');
    detail.hidden = false;
    detail.setAttribute('aria-hidden', 'false');
    renderDetailContent(entry);
    if (moveFocus) {
      $('btnCloseDetail').focus({ preventScroll: true });
    }
  }

  function section(title, rows) {
    // Defense in depth: escape title here even though all current call sites
    // pass hard-coded string literals. A future contributor adding e.g.
    // `section(entry.scriptName, ...)` would silently introduce XSS without
    // this guard. Row keys/values are still passed pre-escaped by callers
    // (intentional — values are escaped at construction time so the
    // escapeHtml(String(v)) call there can also coerce non-string values).
    const rowsHtml = rows.map(([k, v]) => `
      <div class="net-detail-row">
        <span class="net-detail-key">${k}:</span>
        <span class="net-detail-val">${v}</span>
      </div>`).join('');
    return `<div class="net-detail-section"><div class="net-detail-section-title">${escapeHtml(String(title))}</div>${rowsHtml}</div>`;
  }

  // ── Execution rendering ───────────────────────────────────────────────────
  function renderExecution() {
    const tbody = $('execTableBody');
    tbody.replaceChildren();

    const executionScripts = scripts.filter(s => s.stats && (s.stats.runs > 0));
    const withStats = executionScripts.filter((script) => {
      if (!filterText) return true;
      return (script.meta?.name || script.id || '').toLowerCase().includes(filterText);
    });
    withStats.sort((a, b) => (b.stats.totalTime || 0) - (a.stats.totalTime || 0));
    const maxTotal = withStats.reduce((m, s) => Math.max(m, s.stats.totalTime || 0), 1);
    if (activeTab === 'execution') {
      setToolbarStatus(
        withStats.length
          ? tDevtools('devtoolsExecutionSummary', 'Showing {count} {scripts} with execution data', {
              count: String(withStats.length),
              scripts: scriptLabel(withStats.length)
            })
          : (filterText && executionScripts.length
              ? tDevtools('devtoolsNoScriptsMatch', 'No scripts match “{query}”', { query: filterText })
              : tDevtools('devtoolsNoExecutionDataYet', 'No execution data yet. Scripts will appear here after they run.'))
      );
      $('btnClear').disabled = !filterText;
    }

    if (!withStats.length) {
      const tr = document.createElement('tr');
      const title = filterText && executionScripts.length ? tDevtools('devtoolsNoScriptsMatchTitle', 'No scripts match this filter') : tDevtools('devtoolsNoExecutionDataTitle', 'No execution data yet');
      const detail = filterText && executionScripts.length
        ? tDevtools('devtoolsNoScriptsMatchExecutionDetail', 'No scripts match "{query}". Reset the filter to return to execution stats.', { query: filterText })
        : tDevtools('devtoolsNoExecutionDataDetail', 'Scripts will appear here after they run.');
      safeSetHtml(tr, `<td colspan="6" class="table-empty-cell">${tableEmptyMarkup(title, detail, 'RUN')}</td>`);
      tbody.appendChild(tr);
      return;
    }

    for (const script of withStats) {
      const st = script.stats;
      const avg = st.avgTime != null ? st.avgTime : (st.totalTime / st.runs);
      const barPct = Math.round((st.totalTime / maxTotal) * 100);
      const barClass = avg < 50 ? 'fast' : avg < 200 ? 'med' : 'slow';
      const tr = document.createElement('tr');
      safeSetHtml(tr, `
        <td title="${escapeHtml(script.meta?.name || script.id)}">${escapeHtml((script.meta?.name || script.id).slice(0, 30))}</td>
        <td>${st.runs || 0}</td>
        <td class="${durationClass(avg)}">${formatDuration(avg)}</td>
        <td>${formatDuration(st.totalTime)}</td>
        <td class="${st.errors > 0 ? 'status-err' : ''}">${st.errors || 0}</td>
        <td>
          <div class="exec-bar-wrap"><div class="exec-bar ${barClass}" style="width:${barPct}%"></div></div>
        </td>
      `);
      tbody.appendChild(tr);
    }
  }

  function renderConsoleState() {
    setToolbarStatus(tDevtools('devtoolsConsoleCaptureUnavailable', 'Console capture isn’t available here yet. Use Network or Execution for current insight.'));
  }

  function tableEmptyMarkup(title, detail, mark = 'SV') {
    return `
      <div class="table-empty-state">
        <span class="table-empty-mark" aria-hidden="true">${escapeHtml(mark)}</span>
        <strong class="table-empty-title">${escapeHtml(title)}</strong>
        <span class="table-empty-detail">${escapeHtml(detail)}</span>
      </div>
    `;
  }

  // ── HAR Export ────────────────────────────────────────────────────────────
  function exportHAR() {
    if (!netLog.length) {
      setToolbarStatus(tDevtools('devtoolsNoNetworkExport', 'No network requests to export yet.'), 'error');
      return;
    }
    const entries = netLog.map(e => ({
      startedDateTime: new Date(e.timestamp).toISOString(),
      time: e.duration || 0,
      request: {
        method: e.method || 'GET',
        url: e.url || '',
        httpVersion: 'HTTP/1.1',
        headers: Object.entries(e.requestHeaders || {}).map(([n, v]) => ({ name: n, value: String(v) })),
        queryString: [],
        cookies: [],
        headersSize: -1,
        bodySize: -1
      },
      response: {
        status: e.status || 0,
        statusText: e.statusText || '',
        httpVersion: 'HTTP/1.1',
        headers: Object.entries(e.responseHeaders || {}).map(([n, v]) => ({ name: n, value: String(v) })),
        cookies: [],
        content: { size: e.responseSize || 0, mimeType: (e.responseHeaders || {})['content-type'] || 'text/plain' },
        redirectURL: '',
        headersSize: -1,
        bodySize: e.responseSize || -1
      },
      cache: {},
      timings: { send: 0, wait: e.duration || 0, receive: 0 },
      comment: e.scriptName || ''
    }));

    const har = { log: { version: '1.2', creator: { name: 'ScriptVault', version: chrome.runtime.getManifest().version }, entries } };
    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scriptvault-network.har';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToolbarStatus(tDevtools('devtoolsExportedHar', 'Exported {count} {requests} as HAR.', {
      count: String(entries.length),
      requests: requestLabel(entries.length)
    }), 'success');
  }

  // ── Trace Export ─────────────────────────────────────────────────────────
  function exportTrace() {
    const version = chrome.runtime?.getManifest?.()?.version || 'unknown';
    const executionEntries = scripts.filter(s => s.stats && s.stats.runs > 0);
    if (!netLog.length && !executionEntries.length) {
      setToolbarStatus(tDevtools('devtoolsNoTraceExport', 'No network or execution data to export yet.'), 'error');
      return;
    }
    const trace = {
      version: '1.0',
      generator: { name: 'ScriptVault', version },
      exportedAt: new Date().toISOString(),
      network: netLog.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        method: e.method || 'GET',
        url: e.url || '',
        status: e.status || 0,
        duration: e.duration || 0,
        responseSize: e.responseSize || 0,
        scriptName: e.scriptName || '',
        type: e.type || 'xmlhttpRequest',
        error: e.error || null,
      })),
      execution: executionEntries.map(s => ({
        scriptId: s.id,
        scriptName: s.meta?.name || s.id,
        runs: s.stats.runs || 0,
        avgTime: s.stats.avgTime != null ? s.stats.avgTime : (s.stats.totalTime / s.stats.runs),
        totalTime: s.stats.totalTime || 0,
        errors: s.stats.errors || 0,
      })),
      summary: {
        totalRequests: netLog.length,
        totalErrors: netLog.filter(e => e.error || (e.status && e.status >= 400)).length,
        totalBytes: netLog.reduce((s, e) => s + (e.responseSize || 0), 0),
        scriptsWithStats: executionEntries.length,
      },
    };
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scriptvault-trace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToolbarStatus(
      tDevtools('devtoolsExportedTrace', 'Exported trace with {requests} {requestLabel} and {profiles} {profileLabel}.', {
        requests: String(netLog.length),
        requestLabel: requestLabel(netLog.length),
        profiles: String(executionEntries.length),
        profileLabel: profileLabel(executionEntries.length)
      }),
      'success'
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function statusClass(code) {
    if (!code) return 'status-err';
    if (code < 300) return 'status-ok';
    if (code < 400) return 'status-redir';
    return 'status-err';
  }

  function durationClass(ms) {
    if (ms == null) return '';
    if (ms < 100) return 'time-fast';
    if (ms < 1000) return 'time-med';
    return 'time-slow';
  }

  function formatDuration(ms) {
    if (ms == null) return '—';
    if (ms < 1000) return ms.toFixed(0) + 'ms';
    return (ms / 1000).toFixed(2) + 's';
  }

  function formatBytes(n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  init();
})();
