// ScriptVault DevTools Panel v1.7.6
// Network inspection, execution profiling, and console capture

(function () {
  'use strict';

  const $ = id => document.getElementById(id) || document.createElement('div'); // null-safe

  let netLog = [];
  let scripts = [];
  let filterText = '';
  let selectedRow = null;
  let refreshTimer = null;

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    setupTabs();
    setupToolbar();
    await refreshAll();
    startAutoRefresh();
  }

  async function refreshAll() {
    try {
      const [logResult, scriptsResult] = await Promise.allSettled([
        chrome.runtime.sendMessage({ action: 'getNetworkLog', limit: 200 }),
        chrome.runtime.sendMessage({ action: 'getScripts' })
      ]);
      if (logResult.status === 'fulfilled') netLog = logResult.value || [];
      if (scriptsResult.status === 'fulfilled') {
        const val = scriptsResult.value;
        scripts = val?.scripts || Object.values(val || {});
      }
      renderNetwork();
      renderExecution();
    } catch (e) {
      console.error('[DT] refresh error:', e);
    }
  }

  function startAutoRefresh() {
    setInterval(refreshAll, 3000);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function setupTabs() {
    const panels = { network: $('panelNetwork'), execution: $('panelExecution'), console: $('panelConsole') };
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        Object.values(panels).forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (panels[tab]) panels[tab].classList.add('active');
        $('btnExportHAR').style.display = tab === 'network' ? '' : 'none';
      });
    });
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────
  function setupToolbar() {
    $('btnRefresh').addEventListener('click', refreshAll);
    $('btnClear').addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'clearNetworkLog' });
      netLog = [];
      renderNetwork();
    });
    $('btnExportHAR').addEventListener('click', exportHAR);
    $('btnCloseDetail').addEventListener('click', () => {
      $('netDetail').classList.remove('open');
      selectedRow = null;
    });
    $('filterInput').addEventListener('input', e => {
      filterText = e.target.value.toLowerCase();
      renderNetwork();
    });
  }

  // ── Network rendering ─────────────────────────────────────────────────────
  function renderNetwork() {
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

    // Table
    const tbody = $('netTableBody');
    tbody.innerHTML = '';
    for (const entry of filtered) {
      const tr = document.createElement('tr');
      tr.dataset.id = entry.id;
      if (selectedRow === entry.id) tr.classList.add('selected');

      const method = (entry.method || 'GET').toUpperCase();
      const statusCode = entry.status || 0;
      const duration = entry.duration;
      let hostname = '';
      try { hostname = new URL(entry.url).hostname; } catch {}

      tr.innerHTML = `
        <td><span class="method-badge method-${method}">${method}</span></td>
        <td title="${escapeHtml(entry.url || '')}">${escapeHtml(hostname + (entry.url || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 60))}</td>
        <td class="${statusClass(statusCode)}">${statusCode || '—'}</td>
        <td class="${durationClass(duration)}">${formatDuration(duration)}</td>
        <td>${formatBytes(entry.responseSize)}</td>
        <td title="${escapeHtml(entry.scriptName || '')}">${escapeHtml((entry.scriptName || '').slice(0, 20))}</td>
      `;

      tr.addEventListener('click', () => showDetail(entry, tr));
      tbody.appendChild(tr);
    }
  }

  function showDetail(entry, tr) {
    selectedRow = entry.id;
    document.querySelectorAll('#netTableBody tr').forEach(r => r.classList.remove('selected'));
    tr.classList.add('selected');

    const detail = $('netDetail');
    detail.classList.add('open');
    $('netDetailTitle').textContent = (entry.method || 'GET') + ' ' + (entry.url || '').slice(0, 40) + '…';

    let html = '';
    html += section('General', [
      ['URL', escapeHtml(entry.url || '')],
      ['Method', entry.method || 'GET'],
      ['Status', entry.status ? `${entry.status} ${entry.statusText || ''}` : 'Error'],
      ['Duration', formatDuration(entry.duration)],
      ['Size', formatBytes(entry.responseSize)],
      ['Script', escapeHtml(entry.scriptName || '')],
      ['Time', new Date(entry.timestamp).toLocaleTimeString()]
    ]);

    if (entry.requestHeaders) {
      html += section('Request Headers', Object.entries(entry.requestHeaders).map(([k, v]) => [k, escapeHtml(String(v))]));
    }
    if (entry.responseHeaders) {
      html += section('Response Headers', Object.entries(entry.responseHeaders).map(([k, v]) => [k, escapeHtml(String(v))]));
    }
    if (entry.error) {
      html += `<div class="net-detail-section"><div class="net-detail-section-title">Error</div><div style="color:var(--danger)">${escapeHtml(entry.error)}</div></div>`;
    }
    if (entry.responsePreview) {
      html += `<div class="net-detail-section"><div class="net-detail-section-title">Response Preview</div><pre class="net-body-pre">${escapeHtml(String(entry.responsePreview).slice(0, 2000))}</pre></div>`;
    }

    $('netDetailBody').innerHTML = html;
  }

  function section(title, rows) {
    const rowsHtml = rows.map(([k, v]) => `
      <div class="net-detail-row">
        <span class="net-detail-key">${k}:</span>
        <span class="net-detail-val">${v}</span>
      </div>`).join('');
    return `<div class="net-detail-section"><div class="net-detail-section-title">${title}</div>${rowsHtml}</div>`;
  }

  // ── Execution rendering ───────────────────────────────────────────────────
  function renderExecution() {
    const tbody = $('execTableBody');
    tbody.innerHTML = '';

    const withStats = scripts.filter(s => s.stats && (s.stats.runs > 0));
    withStats.sort((a, b) => (b.stats.totalTime || 0) - (a.stats.totalTime || 0));
    const maxTotal = withStats.reduce((m, s) => Math.max(m, s.stats.totalTime || 0), 1);

    if (!withStats.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No execution data yet. Scripts will appear here after they run.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const script of withStats) {
      const st = script.stats;
      const avg = st.avgTime != null ? st.avgTime : (st.totalTime / st.runs);
      const barPct = Math.round((st.totalTime / maxTotal) * 100);
      const barClass = avg < 50 ? 'fast' : avg < 200 ? 'med' : 'slow';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td title="${escapeHtml(script.meta?.name || script.id)}">${escapeHtml((script.meta?.name || script.id).slice(0, 30))}</td>
        <td>${st.runs || 0}</td>
        <td class="${durationClass(avg)}">${formatDuration(avg)}</td>
        <td>${formatDuration(st.totalTime)}</td>
        <td class="${st.errors > 0 ? 'status-err' : ''}">${st.errors || 0}</td>
        <td>
          <div class="exec-bar-wrap"><div class="exec-bar ${barClass}" style="width:${barPct}%"></div></div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  // ── HAR Export ────────────────────────────────────────────────────────────
  function exportHAR() {
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

    const har = { log: { version: '1.2', creator: { name: 'ScriptVault', version: '1.7.6' }, entries } };
    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scriptvault-network.har';
    a.click();
    URL.revokeObjectURL(url);
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
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  init();
})();
