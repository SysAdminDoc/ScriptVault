// ScriptVault — Script Analytics Module
// Per-script and global analytics with canvas-based charts,
// daily aggregates, and CSV/JSON export.

const ScriptAnalytics = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_analytics';
  const STYLE_ID = 'sv-analytics-styles';
  const RETENTION_DAYS = 90;
  const DAY_MS = 86400000;

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _data = {};           // { [scriptId]: { days: { [YYYY-MM-DD]: { executions, totalDuration, errors, urls: {}, gmApis: {}, networkReqs, networkBytes } } } }
  let _getScripts = null;
  let _selectedScript = null;
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Analytics Layout */
.sv-an-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.sv-an-toolbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-right: auto;
}
.sv-an-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  outline: none;
  min-width: 180px;
}
.sv-an-select:focus {
  border-color: var(--accent-green, #4ade80);
}
.sv-an-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.sv-an-btn:hover {
  border-color: var(--accent-green, #4ade80);
  background: var(--bg-row-hover, #333);
}
.sv-an-btn.primary {
  background: var(--accent-green-dark, #22c55e);
  border-color: var(--accent-green-dark, #22c55e);
  color: #fff;
}

/* Stats Summary Row */
.sv-an-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.sv-an-stat {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 14px;
  text-align: center;
}
.sv-an-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary, #e0e0e0);
}
.sv-an-stat-label {
  font-size: 10px;
  color: var(--text-muted, #707070);
  margin-top: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Chart Sections */
.sv-an-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.sv-an-chart-card {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 14px;
}
.sv-an-chart-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-bottom: 10px;
}
.sv-an-chart-canvas {
  width: 100%;
  height: 200px;
  display: block;
}

/* Top Lists */
.sv-an-top-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.sv-an-top-card {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 14px;
}
.sv-an-top-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-bottom: 10px;
}
.sv-an-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.sv-an-top-row:last-child { border-bottom: none; }
.sv-an-top-rank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-input, #333);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary, #a0a0a0);
  flex-shrink: 0;
}
.sv-an-top-name {
  flex: 1;
  color: var(--text-primary, #e0e0e0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sv-an-top-value {
  color: var(--accent-green, #4ade80);
  font-weight: 600;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
}

/* Per-Script Detail */
.sv-an-detail-section {
  margin-bottom: 16px;
}
.sv-an-url-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-row, #2a2a2a);
}
.sv-an-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 11px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--text-secondary, #a0a0a0);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.sv-an-url-row:last-child { border-bottom: none; }
.sv-an-url-count {
  color: var(--accent-blue, #60a5fa);
  font-weight: 600;
  flex-shrink: 0;
}

/* Tooltip */
.sv-an-tooltip {
  position: absolute;
  background: var(--bg-header, #252525);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  pointer-events: none;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  white-space: nowrap;
}

/* Empty state */
.sv-an-empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted, #707070);
}
.sv-an-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.sv-an-empty-text {
  font-size: 14px;
}

/* Toast */
.sv-an-toast {
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
  animation: sv-an-fadein 0.2s ease;
}
@keyframes sv-an-fadein {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateKey(d) {
    return d.toISOString().slice(0, 10);
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dateKey(d);
  }

  function last30Days() {
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(daysAgo(i));
    return days;
  }

  function last7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(daysAgo(i));
    return days;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function showToast(msg, duration = 2500) {
    const existing = document.querySelector('.sv-an-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'sv-an-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function getInstalledScripts() {
    if (typeof _getScripts === 'function') return _getScripts();
    return [];
  }

  function formatDuration(ms) {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return Math.round(ms) + 'ms';
    return (ms / 1000).toFixed(2) + 's';
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  /* ------------------------------------------------------------------ */
  /*  Storage                                                            */
  /* ------------------------------------------------------------------ */

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      _data = result[STORAGE_KEY] || {};
    } catch {
      _data = {};
    }
  }

  async function saveData() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _data });
    } catch (e) {
      console.error('[ScriptAnalytics] save error:', e);
    }
  }

  function ensureScript(scriptId) {
    if (!_data[scriptId]) _data[scriptId] = { days: {} };
    return _data[scriptId];
  }

  function ensureDay(scriptId, day) {
    const s = ensureScript(scriptId);
    if (!s.days[day]) {
      s.days[day] = {
        executions: 0,
        totalDuration: 0,
        errors: 0,
        urls: {},
        gmApis: {},
        networkReqs: 0,
        networkBytes: 0
      };
    }
    return s.days[day];
  }

  function pruneOldData() {
    const cutoff = daysAgo(RETENTION_DAYS);
    let pruned = false;
    for (const scriptId of Object.keys(_data)) {
      const days = _data[scriptId].days;
      for (const day of Object.keys(days)) {
        if (day < cutoff) {
          delete days[day];
          pruned = true;
        }
      }
      if (Object.keys(days).length === 0) {
        delete _data[scriptId];
        pruned = true;
      }
    }
    return pruned;
  }

  /* ------------------------------------------------------------------ */
  /*  Canvas Chart Engine                                                */
  /* ------------------------------------------------------------------ */

  const CHART_COLORS = [
    '#4ade80', // green
    '#60a5fa', // blue
    '#f87171', // red
    '#fbbf24', // yellow
    '#c084fc', // purple
    '#fb923c', // orange
  ];

  function getThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      bg:       cs.getPropertyValue('--bg-row').trim()       || '#2a2a2a',
      bgHeader: cs.getPropertyValue('--bg-header').trim()    || '#252525',
      border:   cs.getPropertyValue('--border-color').trim() || '#404040',
      text:     cs.getPropertyValue('--text-primary').trim()  || '#e0e0e0',
      muted:    cs.getPropertyValue('--text-muted').trim()    || '#707070',
      green:    cs.getPropertyValue('--accent-green').trim()  || '#4ade80',
      blue:     cs.getPropertyValue('--accent-blue').trim()   || '#60a5fa',
      red:      cs.getPropertyValue('--accent-red').trim()    || '#f87171',
      yellow:   cs.getPropertyValue('--accent-yellow').trim() || '#fbbf24',
      purple:   cs.getPropertyValue('--accent-purple').trim() || '#c084fc',
      orange:   cs.getPropertyValue('--accent-orange').trim() || '#fb923c'
    };
  }

  /**
   * Draw a line chart on a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts
   * @param {string[]} opts.labels - X-axis labels
   * @param {Array<{name:string, data:number[], color:string}>} opts.series
   * @param {string} [opts.yLabel]
   */
  function drawLineChart(canvas, opts) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const tc = getThemeColors();

    const pad = { top: 20, right: 16, bottom: 32, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, W, H);

    const { labels, series } = opts;
    if (!series || series.length === 0 || labels.length === 0) return;

    // Compute Y range
    let maxVal = 0;
    for (const s of series) {
      for (const v of s.data) if (v > maxVal) maxVal = v;
    }
    if (maxVal === 0) maxVal = 1;
    const niceMax = ceilNice(maxVal);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = tc.border;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = tc.muted;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + plotH - (plotH * i / gridLines);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      const val = (niceMax * i / gridLines);
      ctx.fillText(formatNumber(Math.round(val)), pad.left - 6, y + 3);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.fillStyle = tc.muted;
    const step = Math.max(1, Math.floor(labels.length / 8));
    for (let i = 0; i < labels.length; i += step) {
      const x = pad.left + (plotW * i / (labels.length - 1 || 1));
      const label = labels[i].slice(5); // MM-DD
      ctx.fillText(label, x, H - pad.bottom + 16);
    }

    // Draw series
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < s.data.length; i++) {
        const x = pad.left + (plotW * i / (labels.length - 1 || 1));
        const y = pad.top + plotH - (plotH * s.data[i] / niceMax);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Dots
      ctx.fillStyle = s.color;
      for (let i = 0; i < s.data.length; i++) {
        const x = pad.left + (plotW * i / (labels.length - 1 || 1));
        const y = pad.top + plotH - (plotH * s.data[i] / niceMax);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Legend
    if (series.length > 1) {
      ctx.font = '10px -apple-system, sans-serif';
      let lx = pad.left;
      for (const s of series) {
        ctx.fillStyle = s.color;
        ctx.fillRect(lx, 4, 10, 10);
        ctx.fillStyle = tc.text;
        ctx.textAlign = 'left';
        ctx.fillText(s.name, lx + 14, 13);
        lx += ctx.measureText(s.name).width + 28;
      }
    }

    // Hover tooltip
    setupTooltip(canvas, labels, series, pad, plotW, plotH, niceMax);
  }

  /**
   * Draw a bar chart on a canvas.
   */
  function drawBarChart(canvas, opts) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const tc = getThemeColors();

    const pad = { top: 16, right: 16, bottom: 36, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const { labels, values, colors } = opts;
    if (!values || values.length === 0) return;

    let maxVal = Math.max(...values, 1);
    const niceMax = ceilNice(maxVal);

    // Grid
    const gridLines = 5;
    ctx.strokeStyle = tc.border;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = tc.muted;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + plotH - (plotH * i / gridLines);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.fillText(formatNumber(Math.round(niceMax * i / gridLines)), pad.left - 6, y + 3);
    }

    // Bars
    const barW = Math.min(40, (plotW / values.length) * 0.6);
    const gap = (plotW - barW * values.length) / (values.length + 1);

    for (let i = 0; i < values.length; i++) {
      const x = pad.left + gap + i * (barW + gap);
      const barH = (values[i] / niceMax) * plotH;
      const y = pad.top + plotH - barH;

      ctx.fillStyle = colors ? colors[i % colors.length] : CHART_COLORS[i % CHART_COLORS.length];
      ctx.beginPath();
      roundRect(ctx, x, y, barW, barH, 3);
      ctx.fill();

      // Label
      ctx.fillStyle = tc.muted;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const label = (labels[i] || '').length > 10 ? labels[i].slice(0, 9) + '\u2026' : labels[i];
      ctx.fillText(label, x + barW / 2, H - pad.bottom + 14);
    }
  }

  /**
   * Draw a donut/pie chart on a canvas.
   */
  function drawDonutChart(canvas, opts) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const tc = getThemeColors();

    ctx.clearRect(0, 0, W, H);

    const { segments } = opts; // [{ label, value, color }]
    if (!segments || segments.length === 0) return;

    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return;

    const cx = W * 0.4;
    const cy = H / 2;
    const outerR = Math.min(cx - 10, cy - 10);
    const innerR = outerR * 0.55;

    let angle = -Math.PI / 2;
    for (const seg of segments) {
      const sliceAngle = (seg.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, angle, angle + sliceAngle);
      ctx.arc(cx, cy, innerR, angle + sliceAngle, angle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      angle += sliceAngle;
    }

    // Center text
    ctx.fillStyle = tc.text;
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatNumber(total), cx, cy - 6);
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = tc.muted;
    ctx.fillText('Total', cx, cy + 10);

    // Legend
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const legendX = W * 0.7;
    let legendY = 16;
    ctx.font = '11px -apple-system, sans-serif';
    for (const seg of segments) {
      ctx.fillStyle = seg.color;
      ctx.fillRect(legendX, legendY, 10, 10);
      ctx.fillStyle = tc.text;
      const label = seg.label.length > 16 ? seg.label.slice(0, 15) + '\u2026' : seg.label;
      ctx.fillText(`${label} (${formatNumber(seg.value)})`, legendX + 16, legendY);
      legendY += 18;
      if (legendY > H - 10) break;
    }
  }

  function ceilNice(val) {
    if (val <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(val)));
    const norm = val / mag;
    if (norm <= 1) return mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h < r * 2) r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
  }

  function setupTooltip(canvas, labels, series, pad, plotW, plotH, niceMax) {
    let tooltip = null;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Find closest point
      const xRatio = (mx - pad.left) / plotW;
      const idx = Math.round(xRatio * (labels.length - 1));
      if (idx < 0 || idx >= labels.length) {
        removeTooltip();
        return;
      }

      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'sv-an-tooltip';
        document.body.appendChild(tooltip);
      }

      let html = `<strong>${labels[idx]}</strong><br>`;
      for (const s of series) {
        html += `<span style="color:${s.color}">\u25CF</span> ${s.name}: ${formatNumber(s.data[idx] || 0)}<br>`;
      }
      tooltip.innerHTML = html;
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
    });

    canvas.addEventListener('mouseleave', removeTooltip);

    function removeTooltip() {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Stats Computation                                                  */
  /* ------------------------------------------------------------------ */

  function getGlobalStatsSync() {
    const scripts = getInstalledScripts();
    const today = todayKey();
    const weekDays = last7Days();
    const monthDays = last30Days();

    let totalScripts = scripts.length;
    let activeScripts = scripts.filter(s => s.enabled !== false).length;
    let disabledScripts = totalScripts - activeScripts;

    let execToday = 0, execWeek = 0, execMonth = 0;
    let errToday = 0, errWeek = 0, errMonth = 0;
    const scriptExecs = {};   // scriptId -> total
    const scriptDurations = {}; // scriptId -> { total, count }

    for (const [scriptId, sData] of Object.entries(_data)) {
      let totalExec = 0;
      let totalDur = 0;
      let durCount = 0;

      for (const [day, d] of Object.entries(sData.days)) {
        if (day === today) {
          execToday += d.executions;
          errToday += d.errors;
        }
        if (weekDays.includes(day)) {
          execWeek += d.executions;
          errWeek += d.errors;
        }
        if (monthDays.includes(day)) {
          execMonth += d.executions;
          errMonth += d.errors;
        }
        totalExec += d.executions;
        if (d.totalDuration > 0 && d.executions > 0) {
          totalDur += d.totalDuration;
          durCount += d.executions;
        }
      }

      scriptExecs[scriptId] = totalExec;
      scriptDurations[scriptId] = { total: totalDur, count: durCount };
    }

    // Top 5 most used
    const topUsed = Object.entries(scriptExecs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const s = scripts.find(sc => sc.id === id);
        return { id, name: s ? (s.name || id) : id, count };
      });

    // Top 5 slowest
    const topSlowest = Object.entries(scriptDurations)
      .filter(([, v]) => v.count > 0)
      .map(([id, v]) => ({ id, avg: v.total / v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map(item => {
        const s = scripts.find(sc => sc.id === item.id);
        return { id: item.id, name: s ? (s.name || item.id) : item.id, avgDuration: item.avg };
      });

    // Storage breakdown
    const storageBreakdown = [];
    for (const s of scripts) {
      const size = s.code ? s.code.length : 0;
      if (size > 0) {
        storageBreakdown.push({ label: s.name || s.id, value: size, color: CHART_COLORS[storageBreakdown.length % CHART_COLORS.length] });
      }
    }

    return {
      totalScripts, activeScripts, disabledScripts,
      execToday, execWeek, execMonth,
      errToday, errWeek, errMonth,
      topUsed, topSlowest, storageBreakdown
    };
  }

  function getScriptStatsSync(scriptId) {
    const sData = _data[scriptId];
    if (!sData) return null;

    const days30 = last30Days();
    const executions = [];
    const avgDurations = [];
    const errorRates = [];
    const urlMap = {};
    const gmApiMap = {};
    let totalNetReqs = 0;
    let totalNetBytes = 0;

    for (const day of days30) {
      const d = sData.days[day] || { executions: 0, totalDuration: 0, errors: 0, urls: {}, gmApis: {} };
      executions.push(d.executions);
      avgDurations.push(d.executions > 0 ? d.totalDuration / d.executions : 0);
      errorRates.push(d.executions > 0 ? (d.errors / d.executions * 100) : 0);

      if (d.urls) {
        for (const [url, count] of Object.entries(d.urls)) {
          urlMap[url] = (urlMap[url] || 0) + count;
        }
      }
      if (d.gmApis) {
        for (const [api, count] of Object.entries(d.gmApis)) {
          gmApiMap[api] = (gmApiMap[api] || 0) + count;
        }
      }
      totalNetReqs += d.networkReqs || 0;
      totalNetBytes += d.networkBytes || 0;
    }

    const urls = Object.entries(urlMap)
      .sort((a, b) => b[1] - a[1])
      .map(([url, count]) => ({ url, count }));

    const gmApis = Object.entries(gmApiMap)
      .sort((a, b) => b[1] - a[1])
      .map(([api, count]) => ({ api, count }));

    return {
      labels: days30,
      executions,
      avgDurations,
      errorRates,
      urls,
      gmApis,
      totalNetReqs,
      totalNetBytes
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  function renderDashboard() {
    if (!_container) return;
    _container.innerHTML = '';

    const scripts = getInstalledScripts();

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'sv-an-toolbar';
    toolbar.innerHTML = `
      <span class="sv-an-toolbar-title">Script Analytics</span>
      <select class="sv-an-select" id="sv-an-script-select">
        <option value="">Global Overview</option>
        ${scripts.map(s => `<option value="${s.id}" ${_selectedScript === s.id ? 'selected' : ''}>${escapeHtml(s.name || s.id)}</option>`).join('')}
      </select>
      <button class="sv-an-btn" data-action="export-csv">CSV</button>
      <button class="sv-an-btn" data-action="export-json">JSON</button>
      <button class="sv-an-btn" data-action="refresh">\u{21BB} Refresh</button>
    `;
    _container.appendChild(toolbar);

    toolbar.querySelector('#sv-an-script-select').addEventListener('change', (e) => {
      _selectedScript = e.target.value || null;
      renderDashboard();
    });
    toolbar.querySelector('[data-action="export-csv"]').addEventListener('click', () => downloadExport('csv'));
    toolbar.querySelector('[data-action="export-json"]').addEventListener('click', () => downloadExport('json'));
    toolbar.querySelector('[data-action="refresh"]').addEventListener('click', () => renderDashboard());

    if (_selectedScript) {
      renderScriptDetail(_selectedScript);
    } else {
      renderGlobalView();
    }
  }

  function renderGlobalView() {
    const stats = getGlobalStatsSync();

    // Stats summary
    const statsEl = document.createElement('div');
    statsEl.className = 'sv-an-stats';
    statsEl.innerHTML = `
      <div class="sv-an-stat">
        <div class="sv-an-stat-value">${stats.totalScripts}</div>
        <div class="sv-an-stat-label">Total Scripts</div>
      </div>
      <div class="sv-an-stat">
        <div class="sv-an-stat-value" style="color:var(--accent-green)">${stats.activeScripts}</div>
        <div class="sv-an-stat-label">Active</div>
      </div>
      <div class="sv-an-stat">
        <div class="sv-an-stat-value" style="color:var(--text-muted)">${stats.disabledScripts}</div>
        <div class="sv-an-stat-label">Disabled</div>
      </div>
      <div class="sv-an-stat">
        <div class="sv-an-stat-value">${formatNumber(stats.execToday)}</div>
        <div class="sv-an-stat-label">Executions Today</div>
      </div>
      <div class="sv-an-stat">
        <div class="sv-an-stat-value">${formatNumber(stats.execWeek)}</div>
        <div class="sv-an-stat-label">Execs This Week</div>
      </div>
      <div class="sv-an-stat">
        <div class="sv-an-stat-value">${formatNumber(stats.execMonth)}</div>
        <div class="sv-an-stat-label">Execs This Month</div>
      </div>
      <div class="sv-an-stat">
        <div class="sv-an-stat-value" style="color:var(--accent-red)">${formatNumber(stats.errToday)}</div>
        <div class="sv-an-stat-label">Errors Today</div>
      </div>
      <div class="sv-an-stat">
        <div class="sv-an-stat-value" style="color:var(--accent-red)">${formatNumber(stats.errMonth)}</div>
        <div class="sv-an-stat-label">Errors This Month</div>
      </div>
    `;
    _container.appendChild(statsEl);

    // Charts: Executions over time + Storage breakdown
    const charts = document.createElement('div');
    charts.className = 'sv-an-charts';

    // Executions line chart
    const execCard = document.createElement('div');
    execCard.className = 'sv-an-chart-card';
    execCard.innerHTML = '<div class="sv-an-chart-title">Executions (Last 30 Days)</div>';
    const execCanvas = document.createElement('canvas');
    execCanvas.className = 'sv-an-chart-canvas';
    execCard.appendChild(execCanvas);
    charts.appendChild(execCard);

    // Storage donut
    const storageCard = document.createElement('div');
    storageCard.className = 'sv-an-chart-card';
    storageCard.innerHTML = '<div class="sv-an-chart-title">Storage Usage</div>';
    const storageCanvas = document.createElement('canvas');
    storageCanvas.className = 'sv-an-chart-canvas';
    storageCard.appendChild(storageCanvas);
    charts.appendChild(storageCard);

    _container.appendChild(charts);

    // Top lists
    const topSection = document.createElement('div');
    topSection.className = 'sv-an-top-section';

    // Most used
    const mostUsed = document.createElement('div');
    mostUsed.className = 'sv-an-top-card';
    mostUsed.innerHTML = `
      <div class="sv-an-top-title">Top 5 Most Used</div>
      ${stats.topUsed.length === 0 ? '<div style="color:var(--text-muted);font-size:12px">No execution data yet.</div>' : ''}
      ${stats.topUsed.map((s, i) => `
        <div class="sv-an-top-row">
          <div class="sv-an-top-rank">${i + 1}</div>
          <div class="sv-an-top-name">${escapeHtml(s.name)}</div>
          <div class="sv-an-top-value">${formatNumber(s.count)} runs</div>
        </div>
      `).join('')}
    `;
    topSection.appendChild(mostUsed);

    // Slowest
    const slowest = document.createElement('div');
    slowest.className = 'sv-an-top-card';
    slowest.innerHTML = `
      <div class="sv-an-top-title">Top 5 Slowest</div>
      ${stats.topSlowest.length === 0 ? '<div style="color:var(--text-muted);font-size:12px">No duration data yet.</div>' : ''}
      ${stats.topSlowest.map((s, i) => `
        <div class="sv-an-top-row">
          <div class="sv-an-top-rank">${i + 1}</div>
          <div class="sv-an-top-name">${escapeHtml(s.name)}</div>
          <div class="sv-an-top-value">${formatDuration(s.avgDuration)}</div>
        </div>
      `).join('')}
    `;
    topSection.appendChild(slowest);

    _container.appendChild(topSection);

    // Draw charts after DOM insertion
    requestAnimationFrame(() => {
      // Executions line chart: aggregate all scripts per day
      const days = last30Days();
      const execData = days.map(day => {
        let total = 0;
        for (const sData of Object.values(_data)) {
          if (sData.days[day]) total += sData.days[day].executions;
        }
        return total;
      });
      const errData = days.map(day => {
        let total = 0;
        for (const sData of Object.values(_data)) {
          if (sData.days[day]) total += sData.days[day].errors;
        }
        return total;
      });

      drawLineChart(execCanvas, {
        labels: days,
        series: [
          { name: 'Executions', data: execData, color: CHART_COLORS[0] },
          { name: 'Errors', data: errData, color: CHART_COLORS[2] }
        ]
      });

      drawDonutChart(storageCanvas, {
        segments: stats.storageBreakdown.slice(0, 8)
      });
    });
  }

  function renderScriptDetail(scriptId) {
    const stats = getScriptStatsSync(scriptId);
    const scripts = getInstalledScripts();
    const script = scripts.find(s => s.id === scriptId);
    const name = script ? (script.name || scriptId) : scriptId;

    if (!stats) {
      _container.insertAdjacentHTML('beforeend', `
        <div class="sv-an-empty">
          <div class="sv-an-empty-icon">\u{1F4CA}</div>
          <div class="sv-an-empty-text">No analytics data for "${escapeHtml(name)}" yet.</div>
        </div>
      `);
      return;
    }

    // Charts
    const charts = document.createElement('div');
    charts.className = 'sv-an-charts';

    // Execution count line
    const execCard = createChartCard('Executions (30 Days)');
    charts.appendChild(execCard.card);

    // Avg duration line
    const durCard = createChartCard('Avg Duration (30 Days)');
    charts.appendChild(durCard.card);

    // Error rate line
    const errCard = createChartCard('Error Rate % (30 Days)');
    charts.appendChild(errCard.card);

    // Network bar chart
    const netCard = createChartCard('Network Activity');
    charts.appendChild(netCard.card);

    _container.appendChild(charts);

    // URL list
    if (stats.urls.length > 0) {
      const section = document.createElement('div');
      section.className = 'sv-an-detail-section';
      section.innerHTML = `<div class="sv-an-chart-title" style="margin-bottom:8px">Pages Matched (${stats.urls.length} URLs)</div>`;
      const urlList = document.createElement('div');
      urlList.className = 'sv-an-url-list';
      for (const u of stats.urls.slice(0, 50)) {
        urlList.innerHTML += `
          <div class="sv-an-url-row">
            <span class="sv-an-url-count">${u.count}x</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(u.url)}</span>
          </div>
        `;
      }
      section.appendChild(urlList);
      _container.appendChild(section);
    }

    // GM API usage
    if (stats.gmApis.length > 0) {
      const section = document.createElement('div');
      section.className = 'sv-an-detail-section';
      section.innerHTML = `<div class="sv-an-chart-title" style="margin-bottom:8px">GM API Usage</div>`;
      const apiList = document.createElement('div');
      apiList.className = 'sv-an-url-list';
      for (const a of stats.gmApis) {
        apiList.innerHTML += `
          <div class="sv-an-url-row">
            <span class="sv-an-url-count">${a.count}x</span>
            <span style="flex:1;font-family:'SFMono-Regular',Consolas,monospace">${escapeHtml(a.api)}</span>
          </div>
        `;
      }
      section.appendChild(apiList);
      _container.appendChild(section);
    }

    // Draw charts
    requestAnimationFrame(() => {
      drawLineChart(execCard.canvas, {
        labels: stats.labels,
        series: [{ name: 'Executions', data: stats.executions, color: CHART_COLORS[0] }]
      });

      drawLineChart(durCard.canvas, {
        labels: stats.labels,
        series: [{ name: 'Avg ms', data: stats.avgDurations.map(d => Math.round(d * 100) / 100), color: CHART_COLORS[1] }]
      });

      drawLineChart(errCard.canvas, {
        labels: stats.labels,
        series: [{ name: 'Error %', data: stats.errorRates.map(r => Math.round(r * 10) / 10), color: CHART_COLORS[2] }]
      });

      drawBarChart(netCard.canvas, {
        labels: ['Requests', 'KB Transferred'],
        values: [stats.totalNetReqs, Math.round(stats.totalNetBytes / 1024)],
        colors: [CHART_COLORS[1], CHART_COLORS[4]]
      });
    });
  }

  function createChartCard(title) {
    const card = document.createElement('div');
    card.className = 'sv-an-chart-card';
    card.innerHTML = `<div class="sv-an-chart-title">${escapeHtml(title)}</div>`;
    const canvas = document.createElement('canvas');
    canvas.className = 'sv-an-chart-canvas';
    card.appendChild(canvas);
    return { card, canvas };
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                              */
  /* ------------------------------------------------------------------ */

  function buildCSV() {
    const rows = ['Script ID,Date,Executions,Avg Duration (ms),Errors,Network Requests,Network Bytes'];
    for (const [scriptId, sData] of Object.entries(_data)) {
      for (const [day, d] of Object.entries(sData.days)) {
        const avgDur = d.executions > 0 ? Math.round(d.totalDuration / d.executions) : 0;
        rows.push([
          `"${scriptId}"`,
          day,
          d.executions,
          avgDur,
          d.errors,
          d.networkReqs || 0,
          d.networkBytes || 0
        ].join(','));
      }
    }
    return rows.join('\n');
  }

  function buildJSON() {
    return JSON.stringify({
      analytics: _data,
      exportedAt: new Date().toISOString(),
      source: 'ScriptVault'
    }, null, 2);
  }

  function downloadExport(format) {
    const content = format === 'csv' ? buildCSV() : buildJSON();
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-analytics-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported as ${format.toUpperCase()}`);
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialise the analytics dashboard.
     * @param {HTMLElement} containerEl
     * @param {Object} [opts]
     * @param {Function} [opts.getScripts] - () => script[]
     */
    async init(containerEl, opts = {}) {
      _container = containerEl;
      _getScripts = opts.getScripts || null;

      if (!document.getElementById(STYLE_ID)) {
        _styleEl = document.createElement('style');
        _styleEl.id = STYLE_ID;
        _styleEl.textContent = STYLES;
        document.head.appendChild(_styleEl);
      }

      await loadData();
      pruneOldData();
      await saveData();
      _initialized = true;
      renderDashboard();
    },

    /**
     * Record a script execution.
     * @param {string} scriptId
     * @param {number} duration - execution time in ms
     * @param {string} url - page URL
     * @param {Object} [opts]
     * @param {string[]} [opts.gmApis] - GM APIs used
     * @param {number} [opts.networkReqs] - number of network requests
     * @param {number} [opts.networkBytes] - bytes transferred
     */
    async recordExecution(scriptId, duration, url, opts = {}) {
      const day = todayKey();
      const d = ensureDay(scriptId, day);
      d.executions++;
      d.totalDuration += duration || 0;

      if (url) {
        const short = url.length > 120 ? url.slice(0, 120) : url;
        d.urls[short] = (d.urls[short] || 0) + 1;
      }

      if (opts.gmApis && Array.isArray(opts.gmApis)) {
        for (const api of opts.gmApis) {
          d.gmApis[api] = (d.gmApis[api] || 0) + 1;
        }
      }

      d.networkReqs += opts.networkReqs || 0;
      d.networkBytes += opts.networkBytes || 0;

      await saveData();
    },

    /**
     * Record a script error.
     * @param {string} scriptId
     * @param {Error|string} error
     */
    async recordError(scriptId, error) {
      const day = todayKey();
      const d = ensureDay(scriptId, day);
      d.errors++;
      await saveData();
    },

    /**
     * Get global analytics stats.
     */
    async getGlobalStats() {
      await loadData();
      return getGlobalStatsSync();
    },

    /**
     * Get per-script analytics.
     * @param {string} scriptId
     */
    async getScriptStats(scriptId) {
      await loadData();
      return getScriptStatsSync(scriptId);
    },

    /**
     * Export analytics as CSV.
     */
    async exportCSV() {
      await loadData();
      return buildCSV();
    },

    /**
     * Export analytics as JSON.
     */
    async exportJSON() {
      await loadData();
      return buildJSON();
    },

    /**
     * Re-render the dashboard.
     */
    refresh() {
      if (_initialized) {
        loadData().then(() => renderDashboard());
      }
    },

    /**
     * Clean up resources.
     */
    destroy() {
      _container = null;
      _initialized = false;
      _selectedScript = null;
      if (_styleEl) {
        _styleEl.remove();
        _styleEl = null;
      }
      // Remove any lingering tooltips
      document.querySelectorAll('.sv-an-tooltip').forEach(t => t.remove());
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScriptAnalytics };
}
