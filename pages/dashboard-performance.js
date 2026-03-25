// ScriptVault — Performance Dashboard Module
// Provides script impact scoring, page-load delta visualization, historical trend
// sparklines, summary cards, auto-disable recommendations, and storage quota display.

const PerformanceDashboard = (() => {

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const HISTORY_KEY = 'perfHistory';
  const MAX_HISTORY_DAYS = 30;
  const SPARKLINE_W = 120;
  const SPARKLINE_H = 32;

  // Impact-score weights (must sum to 1)
  const W_AVG_TIME   = 0.35;
  const W_RUNS       = 0.15;
  const W_ERROR_RATE = 0.30;
  const W_NET_REQS   = 0.20;

  // Thresholds for auto-disable recommendations
  const THRESH_AVG_TIME_MS = 500;
  const THRESH_ERROR_RATE  = 0.10;
  const THRESH_STALE_DAYS  = 30;

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _scripts   = [];
  let _netStats  = null;
  let _history   = [];
  let _refreshTimer = null;

  /* ------------------------------------------------------------------ */
  /*  CSS (inline, uses existing dashboard CSS vars)                      */
  /* ------------------------------------------------------------------ */

  const STYLES = `
    .perf-dash { font-family: inherit; color: var(--text-primary); padding: 16px; }

    /* Summary cards row */
    .perf-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .perf-card {
      background: var(--bg-row); border: 1px solid var(--border-color); border-radius: 8px;
      padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;
    }
    .perf-card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
    .perf-card-value { font-size: 22px; font-weight: 600; color: var(--text-primary); }
    .perf-card-value.good  { color: var(--accent-green); }
    .perf-card-value.warn  { color: var(--accent-yellow); }
    .perf-card-value.bad   { color: var(--accent-red); }
    .perf-card-sub { font-size: 11px; color: var(--text-secondary); }

    /* Section headers */
    .perf-section { margin-bottom: 24px; }
    .perf-section-title {
      font-size: 14px; font-weight: 600; color: var(--accent-green);
      border-bottom: 1px solid var(--border-color); padding-bottom: 6px; margin-bottom: 12px;
    }

    /* Impact scores table */
    .perf-table { width: 100%; border-collapse: collapse; }
    .perf-table th {
      text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--text-muted); padding: 6px 10px; border-bottom: 1px solid var(--border-color);
    }
    .perf-table td {
      padding: 8px 10px; border-bottom: 1px solid var(--border-color); font-size: 13px;
      color: var(--text-secondary); vertical-align: middle;
    }
    .perf-table tr:hover td { background: var(--bg-row-hover); }

    .perf-score-badge {
      display: inline-block; min-width: 36px; text-align: center; padding: 2px 8px;
      border-radius: 10px; font-weight: 600; font-size: 12px;
    }
    .perf-score-badge.good  { background: rgba(74,222,128,.15); color: var(--accent-green); }
    .perf-score-badge.warn  { background: rgba(251,191,36,.15); color: var(--accent-yellow); }
    .perf-score-badge.bad   { background: rgba(248,113,113,.15); color: var(--accent-red); }

    /* Bar chart */
    .perf-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .perf-bar-label { width: 160px; font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .perf-bar-track { flex: 1; height: 16px; background: var(--bg-input); border-radius: 4px; overflow: hidden; }
    .perf-bar-fill { height: 100%; border-radius: 4px; transition: width .3s ease; }
    .perf-bar-value { width: 60px; font-size: 11px; color: var(--text-muted); text-align: right; }

    /* Sparkline */
    .perf-sparkline-cell { display: flex; align-items: center; }
    .perf-sparkline-cell canvas { image-rendering: pixelated; }

    /* Recommendations */
    .perf-rec {
      display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      background: var(--bg-row); border: 1px solid var(--border-color); border-radius: 6px;
      margin-bottom: 8px;
    }
    .perf-rec-icon { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }
    .perf-rec-text { flex: 1; font-size: 13px; color: var(--text-secondary); }
    .perf-rec-text strong { color: var(--text-primary); }
    .perf-rec-reason { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .perf-rec-btn {
      padding: 4px 12px; font-size: 12px; border: 1px solid var(--accent-red);
      background: transparent; color: var(--accent-red); border-radius: 4px; cursor: pointer;
      transition: background .15s, color .15s;
    }
    .perf-rec-btn:hover { background: var(--accent-red); color: #fff; }

    /* Storage quota bar */
    .perf-quota-bar { height: 20px; background: var(--bg-input); border-radius: 6px; overflow: hidden; position: relative; margin-top: 6px; }
    .perf-quota-fill { height: 100%; border-radius: 6px; transition: width .4s ease; }
    .perf-quota-label {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; color: var(--text-primary);
    }

    /* Empty state */
    .perf-empty { color: var(--text-muted); font-size: 13px; padding: 12px 0; }
  `;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function fmt(n, decimals = 1) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toFixed(decimals);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function scoreBadgeClass(score) {
    if (score <= 30) return 'good';
    if (score <= 60) return 'warn';
    return 'bad';
  }

  function barColor(pct) {
    if (pct < 0.33) return 'var(--accent-green)';
    if (pct < 0.66) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  /* ------------------------------------------------------------------ */
  /*  Data fetching                                                      */
  /* ------------------------------------------------------------------ */

  async function fetchScripts() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getScripts' });
      return Array.isArray(res) ? res : (res?.scripts || []);
    } catch { return []; }
  }

  async function fetchNetStats() {
    try {
      return await chrome.runtime.sendMessage({ action: 'getNetworkLogStats' });
    } catch { return { totalRequests: 0, totalErrors: 0, totalBytes: 0, byScript: {}, byDomain: {} }; }
  }

  async function fetchHistory() {
    try {
      const data = await chrome.storage.local.get(HISTORY_KEY);
      return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    } catch { return []; }
  }

  async function fetchStorageUsage() {
    return new Promise(resolve => {
      try {
        chrome.storage.local.getBytesInUse(null, bytes => {
          resolve({ used: bytes || 0, quota: chrome.storage.local.QUOTA_BYTES || 10485760 });
        });
      } catch { resolve({ used: 0, quota: 10485760 }); }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Impact score calculation                                           */
  /* ------------------------------------------------------------------ */

  function getImpactScores(scripts, netStatsByScript = {}) {
    if (!scripts.length) return [];

    // Determine max values across all scripts for normalization
    let maxAvg = 0, maxRuns = 0, maxErrRate = 0, maxNet = 0;
    const raw = scripts.map(s => {
      const stats = s.stats || { runs: 0, avgTime: 0, errors: 0 };
      const runs = stats.runs || 0;
      const avgTime = stats.avgTime || 0;
      const errRate = runs > 0 ? (stats.errors || 0) / runs : 0;
      const netReqs = (netStatsByScript[s.id] && netStatsByScript[s.id].count) || 0;

      maxAvg     = Math.max(maxAvg, avgTime);
      maxRuns    = Math.max(maxRuns, runs);
      maxErrRate = Math.max(maxErrRate, errRate);
      maxNet     = Math.max(maxNet, netReqs);

      return { script: s, avgTime, runs, errRate, netReqs };
    });

    return raw.map(r => {
      // Normalize each dimension to 0-1 (0 = best, 1 = worst)
      const nAvg  = maxAvg     > 0 ? r.avgTime  / maxAvg     : 0;
      const nRuns = maxRuns    > 0 ? r.runs      / maxRuns    : 0;
      const nErr  = maxErrRate > 0 ? r.errRate   / maxErrRate : 0;
      const nNet  = maxNet     > 0 ? r.netReqs   / maxNet     : 0;

      // Weighted combination scaled to 0-100
      const score = Math.round(clamp(
        (nAvg * W_AVG_TIME + nRuns * W_RUNS + nErr * W_ERROR_RATE + nNet * W_NET_REQS) * 100,
        0, 100
      ));

      return {
        scriptId:   r.script.id,
        scriptName: r.script.name || r.script.id,
        enabled:    r.script.enabled !== false,
        avgTime:    r.avgTime,
        runs:       r.runs,
        errRate:    r.errRate,
        netReqs:    r.netReqs,
        score,
        lastRun:    (r.script.stats && r.script.stats.lastRun) || 0
      };
    }).sort((a, b) => b.score - a.score);
  }

  /* ------------------------------------------------------------------ */
  /*  History snapshot                                                    */
  /* ------------------------------------------------------------------ */

  async function recordSnapshot() {
    const scripts  = await fetchScripts();
    const netStats = await fetchNetStats();
    const history  = await fetchHistory();
    const key      = todayKey();

    // Build today's snapshot
    const snapshot = {
      date: key,
      timestamp: Date.now(),
      scripts: {}
    };

    for (const s of scripts) {
      const stats = s.stats || {};
      const net   = (netStats.byScript && netStats.byScript[s.id]) || {};
      snapshot.scripts[s.id] = {
        name:    s.name || s.id,
        avgTime: stats.avgTime || 0,
        runs:    stats.runs || 0,
        errors:  stats.errors || 0,
        netReqs: net.count || 0
      };
    }

    // Replace today's entry if it exists, otherwise append
    const idx = history.findIndex(h => h.date === key);
    if (idx >= 0) {
      history[idx] = snapshot;
    } else {
      history.push(snapshot);
    }

    // Prune to last MAX_HISTORY_DAYS
    const pruned = history
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_HISTORY_DAYS);

    await chrome.storage.local.set({ [HISTORY_KEY]: pruned });
    _history = pruned;
    return pruned;
  }

  /* ------------------------------------------------------------------ */
  /*  Sparkline canvas rendering                                         */
  /* ------------------------------------------------------------------ */

  function drawSparkline(canvas, values, color = 'var(--accent-blue)') {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (!values.length) return;

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const step = values.length > 1 ? w / (values.length - 1) : 0;

    // Resolve CSS variable to actual color
    const resolvedColor = getComputedStyle(canvas.parentElement || document.documentElement)
      .getPropertyValue(color.replace(/var\((--[^)]+)\)/, '$1')).trim() || color;

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, resolvedColor + '40');
    grad.addColorStop(1, resolvedColor + '05');

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < values.length; i++) {
      const x = step * i;
      const y = h - ((values[i] - min) / range) * (h - 4) - 2;
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = step * i;
      const y = h - ((values[i] - min) / range) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = resolvedColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // End dot
    if (values.length > 0) {
      const lastX = step * (values.length - 1);
      const lastY = h - ((values[values.length - 1] - min) / range) * (h - 4) - 2;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = resolvedColor;
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Recommendations                                                    */
  /* ------------------------------------------------------------------ */

  function getRecommendations(scores) {
    const recs = [];
    const now = Date.now();

    for (const s of scores) {
      if (!s.enabled) continue;

      const reasons = [];
      if (s.avgTime > THRESH_AVG_TIME_MS) {
        reasons.push(`Average execution time is ${fmt(s.avgTime, 0)}ms (threshold: ${THRESH_AVG_TIME_MS}ms)`);
      }
      if (s.errRate > THRESH_ERROR_RATE) {
        reasons.push(`Error rate is ${fmt(s.errRate * 100, 1)}% (threshold: ${(THRESH_ERROR_RATE * 100).toFixed(0)}%)`);
      }
      if (s.lastRun > 0 && (now - s.lastRun) > THRESH_STALE_DAYS * 86400000) {
        const days = Math.floor((now - s.lastRun) / 86400000);
        reasons.push(`Last matched ${days} days ago (stale threshold: ${THRESH_STALE_DAYS} days)`);
      } else if (s.lastRun === 0 && s.runs === 0) {
        reasons.push('Never executed — may be stale');
      }

      if (reasons.length > 0) {
        recs.push({ scriptId: s.scriptId, scriptName: s.scriptName, reasons });
      }
    }

    return recs;
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  function render() {
    if (!_container) return;

    const scores   = getImpactScores(_scripts, _netStats?.byScript || {});
    const recs     = getRecommendations(scores);
    const active   = _scripts.filter(s => s.enabled !== false);
    const totalAvg = scores.reduce((sum, s) => sum + (s.enabled ? s.avgTime : 0), 0);
    const slowest  = scores.find(s => s.enabled) || null;
    const mostErr  = [...scores].filter(s => s.enabled).sort((a, b) => b.errRate - a.errRate)[0] || null;
    const netTotal = _netStats?.totalRequests || 0;

    let html = '';

    // ----- Summary Cards -----
    html += '<div class="perf-cards">';
    html += `<div class="perf-card">
      <span class="perf-card-label">Active Scripts</span>
      <span class="perf-card-value">${active.length}</span>
      <span class="perf-card-sub">${_scripts.length} total installed</span>
    </div>`;

    const overheadClass = totalAvg < 200 ? 'good' : totalAvg < 800 ? 'warn' : 'bad';
    html += `<div class="perf-card">
      <span class="perf-card-label">Page Overhead (est.)</span>
      <span class="perf-card-value ${overheadClass}">${fmt(totalAvg, 0)}ms</span>
      <span class="perf-card-sub">Sum of active avg times</span>
    </div>`;

    html += `<div class="perf-card">
      <span class="perf-card-label">Slowest Script</span>
      <span class="perf-card-value ${slowest && slowest.avgTime > 200 ? 'bad' : ''}">${slowest ? fmt(slowest.avgTime, 0) + 'ms' : '—'}</span>
      <span class="perf-card-sub">${slowest ? esc(slowest.scriptName) : 'N/A'}</span>
    </div>`;

    html += `<div class="perf-card">
      <span class="perf-card-label">Most Error-Prone</span>
      <span class="perf-card-value ${mostErr && mostErr.errRate > 0.05 ? 'bad' : ''}">${mostErr && mostErr.errRate > 0 ? fmt(mostErr.errRate * 100, 1) + '%' : '0%'}</span>
      <span class="perf-card-sub">${mostErr && mostErr.errRate > 0 ? esc(mostErr.scriptName) : 'All clean'}</span>
    </div>`;

    html += `<div class="perf-card">
      <span class="perf-card-label">Network Requests</span>
      <span class="perf-card-value">${netTotal}</span>
      <span class="perf-card-sub">${_netStats?.totalErrors || 0} failed</span>
    </div>`;
    html += '</div>';

    // ----- Impact Scores Table -----
    html += '<div class="perf-section">';
    html += '<div class="perf-section-title">Script Impact Scores</div>';
    if (scores.length === 0) {
      html += '<div class="perf-empty">No scripts installed.</div>';
    } else {
      html += `<table class="perf-table">
        <thead><tr>
          <th>Script</th><th>Score</th><th>Avg Time</th><th>Runs</th><th>Err %</th><th>Net Reqs</th><th>Trend</th>
        </tr></thead><tbody>`;
      for (const s of scores) {
        const cls = scoreBadgeClass(s.score);
        html += `<tr data-script-id="${esc(s.scriptId)}">
          <td>${esc(s.scriptName)}${s.enabled ? '' : ' <span style="color:var(--text-muted)">(disabled)</span>'}</td>
          <td><span class="perf-score-badge ${cls}">${s.score}</span></td>
          <td>${fmt(s.avgTime, 1)}ms</td>
          <td>${s.runs}</td>
          <td>${fmt(s.errRate * 100, 1)}%</td>
          <td>${s.netReqs}</td>
          <td class="perf-sparkline-cell"><canvas width="${SPARKLINE_W}" height="${SPARKLINE_H}" data-script-id="${esc(s.scriptId)}"></canvas></td>
        </tr>`;
      }
      html += '</tbody></table>';
    }
    html += '</div>';

    // ----- Page Load Delta Bar Chart -----
    html += '<div class="perf-section">';
    html += '<div class="perf-section-title">Page Load Delta</div>';
    const activeScores = scores.filter(s => s.enabled && s.avgTime > 0);
    if (activeScores.length === 0) {
      html += '<div class="perf-empty">No execution data available.</div>';
    } else {
      const maxTime = Math.max(...activeScores.map(s => s.avgTime), 1);
      for (const s of activeScores) {
        const pct = s.avgTime / maxTime;
        html += `<div class="perf-bar-row">
          <div class="perf-bar-label" title="${esc(s.scriptName)}">${esc(s.scriptName)}</div>
          <div class="perf-bar-track"><div class="perf-bar-fill" style="width:${(pct * 100).toFixed(1)}%;background:${barColor(pct)}"></div></div>
          <div class="perf-bar-value">${fmt(s.avgTime, 1)}ms</div>
        </div>`;
      }
    }
    html += '</div>';

    // ----- Auto-Disable Recommendations -----
    html += '<div class="perf-section">';
    html += '<div class="perf-section-title">Recommendations</div>';
    if (recs.length === 0) {
      html += '<div class="perf-empty">All scripts are performing within acceptable thresholds.</div>';
    } else {
      for (const r of recs) {
        html += `<div class="perf-rec">
          <div class="perf-rec-icon" style="color:var(--accent-yellow)">&#9888;</div>
          <div class="perf-rec-text">
            <strong>${esc(r.scriptName)}</strong>
            <div class="perf-rec-reason">${r.reasons.map(esc).join(' &bull; ')}</div>
          </div>
          <button class="perf-rec-btn" data-disable-script="${esc(r.scriptId)}" title="Disable this script">Disable</button>
        </div>`;
      }
    }
    html += '</div>';

    // ----- Storage Quota -----
    html += '<div class="perf-section">';
    html += '<div class="perf-section-title">Storage Usage</div>';
    html += '<div id="perf-quota-container"><div class="perf-empty">Loading...</div></div>';
    html += '</div>';

    _container.innerHTML = html;

    // Post-render: sparklines, quota, event listeners
    renderSparklines();
    renderQuota();
    bindEvents();
  }

  function renderSparklines() {
    if (!_container || !_history.length) return;

    const canvases = _container.querySelectorAll('canvas[data-script-id]');
    for (const canvas of canvases) {
      const sid = canvas.getAttribute('data-script-id');
      const values = _history.map(h => (h.scripts && h.scripts[sid]) ? h.scripts[sid].avgTime : 0);
      // Only draw if there is at least one non-zero value
      if (values.some(v => v > 0)) {
        drawSparkline(canvas, values, 'var(--accent-blue)');
      }
    }
  }

  async function renderQuota() {
    const el = _container?.querySelector('#perf-quota-container');
    if (!el) return;

    const usage = await fetchStorageUsage();
    const pct   = usage.quota > 0 ? (usage.used / usage.quota) : 0;
    const color = pct < 0.5 ? 'var(--accent-green)' : pct < 0.8 ? 'var(--accent-yellow)' : 'var(--accent-red)';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px">
        <span>${formatBytes(usage.used)} used</span>
        <span>${formatBytes(usage.quota)} quota</span>
      </div>
      <div class="perf-quota-bar">
        <div class="perf-quota-fill" style="width:${(pct * 100).toFixed(1)}%;background:${color}"></div>
        <div class="perf-quota-label">${(pct * 100).toFixed(1)}%</div>
      </div>`;
  }

  function bindEvents() {
    if (!_container) return;

    _container.querySelectorAll('[data-disable-script]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const scriptId = e.currentTarget.getAttribute('data-disable-script');
        try {
          await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId, enabled: false });
          btn.textContent = 'Disabled';
          btn.disabled = true;
          btn.style.opacity = '0.5';
          // Refresh data after a brief pause to let background update
          setTimeout(() => api.refresh(), 300);
        } catch (err) {
          btn.textContent = 'Error';
          console.error('[PerfDash] Failed to disable script:', err);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Style injection                                                    */
  /* ------------------------------------------------------------------ */

  let _styleEl = null;

  function injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
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
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {
    /**
     * Initialize the performance dashboard inside the given container element.
     * Fetches all data and renders the panel. Starts auto-refresh every 60s.
     */
    async init(containerEl) {
      if (!containerEl) throw new Error('[PerfDash] Container element required');
      _container = containerEl;
      injectStyles();

      _container.innerHTML = '<div class="perf-dash"><div class="perf-empty">Loading performance data...</div></div>';

      await api.refresh();

      // Auto-refresh every 60 seconds
      _refreshTimer = setInterval(() => api.refresh(), 60000);
    },

    /**
     * Re-fetch all data and re-render the dashboard.
     */
    async refresh() {
      try {
        const [scripts, netStats, history] = await Promise.all([
          fetchScripts(),
          fetchNetStats(),
          fetchHistory()
        ]);
        _scripts  = scripts;
        _netStats = netStats;
        _history  = history;
      } catch (err) {
        console.error('[PerfDash] Data fetch failed:', err);
      }

      if (_container) {
        _container.innerHTML = '<div class="perf-dash"></div>';
        const inner = _container.querySelector('.perf-dash');
        _container = inner || _container;
        render();
        // Restore outer container reference
        _container = _container.parentElement?.classList.contains('perf-dash')
          ? _container
          : _container;
      }
    },

    /**
     * Calculate impact scores for an array of scripts.
     * Useful for external callers that supply their own script list.
     * @param {Array} scripts - Array of script objects with .stats property
     * @returns {Array} Sorted array of score objects
     */
    getImpactScores(scripts) {
      const byScript = _netStats?.byScript || {};
      return getImpactScores(scripts, byScript);
    },

    /**
     * Record a daily performance snapshot to chrome.storage.local.
     * Should be called once per day (e.g., from background alarm).
     * @returns {Array} Updated history array
     */
    async recordSnapshot() {
      return recordSnapshot();
    },

    /**
     * Tear down the dashboard: stop timers, remove styles, clear container.
     */
    destroy() {
      if (_refreshTimer) {
        clearInterval(_refreshTimer);
        _refreshTimer = null;
      }
      removeStyles();
      if (_container) {
        _container.innerHTML = '';
        _container = null;
      }
      _scripts  = [];
      _netStats = null;
      _history  = [];
    }
  };

  return api;
})();
