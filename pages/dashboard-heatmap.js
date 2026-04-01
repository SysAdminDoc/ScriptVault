/**
 * ScriptVault Activity Heatmap
 * GitHub-style 365-day contribution heatmap rendered on canvas,
 * with per-script filtering, tooltips, streak stats, and trend analysis.
 */
const ActivityHeatmap = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STYLE_ID = 'sv-heatmap-styles';
  const STORAGE_KEY = 'sv_activity_log';
  const DAY_MS = 86400000;
  const WEEKS = 52;
  const DAYS_PER_WEEK = 7;
  const CELL_SIZE = 13;
  const CELL_GAP = 3;
  const LABEL_WIDTH = 30;
  const HEADER_HEIGHT = 20;
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const COLOR_LEVELS = [
    'rgba(255,255,255,0.04)',   // 0 activity
    'rgba(74,222,128,0.25)',    // level 1
    'rgba(74,222,128,0.45)',    // level 2
    'rgba(74,222,128,0.65)',    // level 3
    'rgba(74,222,128,0.85)',    // level 4
    'rgba(34,197,94,1.0)',      // level 5 (max)
  ];

  const ACTIVITY_TYPES = {
    EXECUTION: 'execution',
    EDIT: 'edit',
    INSTALL: 'install',
    ERROR: 'error',
  };

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _canvas = null;
  let _ctx = null;
  let _tooltip = null;
  let _data = {};           // { 'YYYY-MM-DD': { executions, edits, installs, errors, scripts: Set } }
  let _filteredScript = null;
  let _dayMap = new Map();  // Maps canvas pixel regions to date keys
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
.sv-heatmap-root {
  display: flex;
  flex-direction: column;
  background: var(--bg-body, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 16px;
}
.sv-heatmap-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.sv-heatmap-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-right: auto;
}
.sv-heatmap-select {
  padding: 5px 10px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  outline: none;
  min-width: 160px;
}
.sv-heatmap-select:focus {
  border-color: var(--accent-green, #4ade80);
}
.sv-heatmap-canvas-wrap {
  position: relative;
  overflow-x: auto;
  padding-bottom: 6px;
}
.sv-heatmap-canvas {
  display: block;
  cursor: crosshair;
}
.sv-heatmap-tooltip {
  position: fixed;
  padding: 8px 12px;
  background: var(--bg-header, #252525);
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary, #e0e0e0);
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  display: none;
}
.sv-heatmap-tooltip-date {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--accent-green, #4ade80);
}
.sv-heatmap-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 11px;
  color: var(--text-secondary, #a0a0a0);
}
.sv-heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-muted, #707070);
}
.sv-heatmap-legend-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}
.sv-heatmap-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.sv-heatmap-stat-card {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 12px 16px;
}
.sv-heatmap-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent-green, #4ade80);
}
.sv-heatmap-stat-label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  margin-top: 2px;
}
.sv-heatmap-stat-trend {
  font-size: 11px;
  margin-top: 4px;
}
.sv-heatmap-stat-trend-up { color: var(--accent-green, #4ade80); }
.sv-heatmap-stat-trend-down { color: var(--accent-red, #f87171); }
.sv-heatmap-stat-trend-stable { color: var(--text-muted, #707070); }
`;

  /* ------------------------------------------------------------------ */
  /*  Data Layer                                                         */
  /* ------------------------------------------------------------------ */

  function _dateKey(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  async function _loadData() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const raw = result[STORAGE_KEY];
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        // Convert scripts arrays back to Sets for internal use
        _data = {};
        for (const [key, val] of Object.entries(parsed)) {
          _data[key] = {
            executions: val.executions || 0,
            edits: val.edits || 0,
            installs: val.installs || 0,
            errors: val.errors || 0,
            scripts: new Set(val.scripts || []),
          };
        }
      }
    } catch (e) {
      console.warn('[ActivityHeatmap] Failed to load data:', e);
      _data = {};
    }
  }

  function _saveData() {
    try {
      const serializable = {};
      for (const [key, val] of Object.entries(_data)) {
        serializable[key] = {
          executions: val.executions,
          edits: val.edits,
          installs: val.installs,
          errors: val.errors,
          scripts: [...val.scripts],
        };
      }
      chrome.storage.local.set({ [STORAGE_KEY]: serializable });
    } catch (e) {
      console.warn('[ActivityHeatmap] Failed to save data:', e);
    }
  }

  function _ensureDay(dateKey) {
    if (!_data[dateKey]) {
      _data[dateKey] = { executions: 0, edits: 0, installs: 0, errors: 0, scripts: new Set() };
    }
    return _data[dateKey];
  }

  function _recordActivity(type, scriptId, date) {
    const key = _dateKey(date || new Date());
    const day = _ensureDay(key);
    switch (type) {
      case ACTIVITY_TYPES.EXECUTION: day.executions++; break;
      case ACTIVITY_TYPES.EDIT: day.edits++; break;
      case ACTIVITY_TYPES.INSTALL: day.installs++; break;
      case ACTIVITY_TYPES.ERROR: day.errors++; break;
    }
    if (scriptId) day.scripts.add(scriptId);
    _saveData();
  }

  function _getActivityLevel(dayData) {
    if (!dayData) return 0;
    const total = dayData.executions + dayData.edits * 3 + dayData.installs * 2 + dayData.errors;
    if (total === 0) return 0;
    if (total <= 2) return 1;
    if (total <= 5) return 2;
    if (total <= 10) return 3;
    if (total <= 25) return 4;
    return 5;
  }

  function _getFilteredDayData(dateKey) {
    const day = _data[dateKey];
    if (!day) return null;
    if (!_filteredScript) return day;
    if (!day.scripts.has(_filteredScript)) return null;
    return day;
  }

  /* ------------------------------------------------------------------ */
  /*  Canvas Rendering                                                   */
  /* ------------------------------------------------------------------ */

  function _getGridDates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [];
    const totalDays = WEEKS * DAYS_PER_WEEK;
    const startDate = new Date(today.getTime() - (totalDays - 1) * DAY_MS);
    // Adjust to start on Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    for (let i = 0; i < WEEKS * DAYS_PER_WEEK + dayOfWeek; i++) {
      const d = new Date(startDate.getTime() + i * DAY_MS);
      if (d <= today) {
        dates.push(d);
      }
    }
    return dates;
  }

  function _drawHeatmap() {
    if (!_canvas || !_ctx) return;
    const dates = _getGridDates();
    const canvasWidth = LABEL_WIDTH + WEEKS * (CELL_SIZE + CELL_GAP) + CELL_GAP + 20;
    const canvasHeight = HEADER_HEIGHT + DAYS_PER_WEEK * (CELL_SIZE + CELL_GAP) + CELL_GAP;
    const dpr = window.devicePixelRatio || 1;

    _canvas.width = canvasWidth * dpr;
    _canvas.height = canvasHeight * dpr;
    _canvas.style.width = canvasWidth + 'px';
    _canvas.style.height = canvasHeight + 'px';
    _ctx.scale(dpr, dpr);

    _ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    _dayMap.clear();

    // Day labels
    _ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    _ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#707070';
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'middle';
    const labelDays = [1, 3, 5]; // Mon, Wed, Fri
    for (const di of labelDays) {
      const y = HEADER_HEIGHT + di * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
      _ctx.fillStyle = '#707070';
      _ctx.fillText(DAY_LABELS[di], LABEL_WIDTH - 4, y);
    }

    // Month labels
    _ctx.textAlign = 'left';
    let lastMonth = -1;
    for (let wi = 0; wi < WEEKS; wi++) {
      const idx = wi * DAYS_PER_WEEK;
      if (idx < dates.length) {
        const month = dates[idx].getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          const x = LABEL_WIDTH + wi * (CELL_SIZE + CELL_GAP);
          _ctx.fillStyle = '#707070';
          _ctx.fillText(MONTH_LABELS[month], x, 12);
        }
      }
    }

    // Cells
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const key = _dateKey(date);
      const wi = Math.floor(i / DAYS_PER_WEEK);
      const di = i % DAYS_PER_WEEK;
      const x = LABEL_WIDTH + wi * (CELL_SIZE + CELL_GAP);
      const y = HEADER_HEIGHT + di * (CELL_SIZE + CELL_GAP);
      const dayData = _getFilteredDayData(key);
      const level = _getActivityLevel(dayData);

      _ctx.fillStyle = COLOR_LEVELS[level];
      _ctx.beginPath();
      _roundRect(_ctx, x, y, CELL_SIZE, CELL_SIZE, 2);
      _ctx.fill();

      _dayMap.set(`${Math.floor(x)},${Math.floor(y)}`, { key, date, data: dayData, x, y });
    }
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function _findCellAtPos(mx, my) {
    for (const [, cell] of _dayMap) {
      if (mx >= cell.x && mx < cell.x + CELL_SIZE && my >= cell.y && my < cell.y + CELL_SIZE) {
        return cell;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Tooltip                                                            */
  /* ------------------------------------------------------------------ */

  function _showTooltip(cell, clientX, clientY) {
    if (!_tooltip) return;
    const d = cell.data;
    const dateStr = cell.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    let html = `<div class="sv-heatmap-tooltip-date">${dateStr}</div>`;
    if (d) {
      html += `<div class="sv-heatmap-tooltip-row"><span>Executions</span><span>${d.executions}</span></div>`;
      html += `<div class="sv-heatmap-tooltip-row"><span>Edits</span><span>${d.edits}</span></div>`;
      html += `<div class="sv-heatmap-tooltip-row"><span>Installs</span><span>${d.installs}</span></div>`;
      html += `<div class="sv-heatmap-tooltip-row"><span>Errors</span><span>${d.errors}</span></div>`;
      html += `<div class="sv-heatmap-tooltip-row"><span>Scripts active</span><span>${d.scripts.size}</span></div>`;
    } else {
      html += `<div class="sv-heatmap-tooltip-row"><span>No activity</span></div>`;
    }

    _tooltip.innerHTML = html;
    _tooltip.style.display = 'block';
    // Clamp to viewport bounds
    let tx = clientX + 12;
    let ty = clientY - 10;
    const tw = _tooltip.offsetWidth || 180;
    const th = _tooltip.offsetHeight || 100;
    if (tx + tw > window.innerWidth) tx = clientX - tw - 8;
    if (ty + th > window.innerHeight) ty = window.innerHeight - th - 4;
    if (ty < 0) ty = 4;
    _tooltip.style.left = tx + 'px';
    _tooltip.style.top = ty + 'px';
  }

  function _hideTooltip() {
    if (_tooltip) _tooltip.style.display = 'none';
  }

  /* ------------------------------------------------------------------ */
  /*  Stats                                                              */
  /* ------------------------------------------------------------------ */

  function getStats() {
    const dates = _getGridDates();
    let activeDays = 0;
    let longestStreak = 0;
    let currentStreak = 0;
    let totalExecs = 0;
    let totalEdits = 0;
    let totalInstalls = 0;
    let totalErrors = 0;
    let mostActiveDay = null;
    let mostActiveCount = 0;

    // Recent vs older comparison for trend
    const midpoint = Math.floor(dates.length / 2);
    let recentActivity = 0;
    let olderActivity = 0;

    for (let i = 0; i < dates.length; i++) {
      const key = _dateKey(dates[i]);
      const d = _getFilteredDayData(key);
      const total = d ? (d.executions + d.edits + d.installs) : 0;
      if (total > 0) {
        activeDays++;
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
        totalExecs += d.executions;
        totalEdits += d.edits;
        totalInstalls += d.installs;
        totalErrors += d.errors;
        if (total > mostActiveCount) {
          mostActiveCount = total;
          mostActiveDay = dates[i];
        }
      } else {
        currentStreak = 0;
      }
      if (i >= midpoint) recentActivity += total;
      else olderActivity += total;
    }

    // If the last date in the grid is not today, the streak is broken
    if (dates.length > 0 && _dateKey(dates[dates.length - 1]) !== _dateKey(new Date())) {
      currentStreak = 0;
    }

    let trend = 'stable';
    if (recentActivity > olderActivity * 1.2) trend = 'up';
    else if (recentActivity < olderActivity * 0.8) trend = 'down';

    return {
      activeDays,
      longestStreak,
      currentStreak,
      mostActiveDay: mostActiveDay ? _dateKey(mostActiveDay) : null,
      mostActiveCount,
      totalExecs,
      totalEdits,
      totalInstalls,
      totalErrors,
      trend,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  UI Build                                                           */
  /* ------------------------------------------------------------------ */

  function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    _styleEl = document.createElement('style');
    _styleEl.id = STYLE_ID;
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function _buildUI() {
    _container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'sv-heatmap-root';

    // Header
    const header = document.createElement('div');
    header.className = 'sv-heatmap-header';
    const title = document.createElement('span');
    title.className = 'sv-heatmap-title';
    title.textContent = 'Activity Heatmap';
    header.appendChild(title);

    // Script filter select
    const select = document.createElement('select');
    select.className = 'sv-heatmap-select';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All Scripts';
    select.appendChild(allOpt);

    // Collect all script IDs from data
    const scriptIds = new Set();
    for (const day of Object.values(_data)) {
      if (day.scripts) {
        for (const sid of day.scripts) scriptIds.add(sid);
      }
    }
    for (const sid of [...scriptIds].sort()) {
      const opt = document.createElement('option');
      opt.value = sid;
      opt.textContent = sid;
      select.appendChild(opt);
    }
    select.value = _filteredScript || '';
    select.onchange = () => {
      _filteredScript = select.value || null;
      _drawHeatmap();
      _renderStats(statsContainer);
    };
    header.appendChild(select);
    root.appendChild(header);

    // Canvas
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'sv-heatmap-canvas-wrap';
    _canvas = document.createElement('canvas');
    _canvas.className = 'sv-heatmap-canvas';
    _ctx = _canvas.getContext('2d');

    _canvas.addEventListener('mousemove', (e) => {
      const rect = _canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cell = _findCellAtPos(mx, my);
      if (cell) {
        _showTooltip(cell, e.clientX, e.clientY);
      } else {
        _hideTooltip();
      }
    });
    _canvas.addEventListener('mouseleave', _hideTooltip);

    canvasWrap.appendChild(_canvas);
    root.appendChild(canvasWrap);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'sv-heatmap-legend';
    legend.innerHTML = '<span>Less</span>';
    for (const color of COLOR_LEVELS) {
      const cell = document.createElement('span');
      cell.className = 'sv-heatmap-legend-cell';
      cell.style.background = color;
      legend.appendChild(cell);
    }
    const moreSpan = document.createElement('span');
    moreSpan.textContent = 'More';
    legend.appendChild(moreSpan);
    root.appendChild(legend);

    // Stats
    const statsContainer = document.createElement('div');
    statsContainer.className = 'sv-heatmap-stats';
    root.appendChild(statsContainer);
    _renderStats(statsContainer);

    // Tooltip
    _tooltip = document.createElement('div');
    _tooltip.className = 'sv-heatmap-tooltip';
    document.body.appendChild(_tooltip);

    _container.appendChild(root);
    _drawHeatmap();
  }

  function _renderStats(container) {
    const stats = getStats();
    container.innerHTML = '';

    const cards = [
      { value: stats.activeDays, label: 'Active Days', trend: null },
      { value: stats.longestStreak, label: 'Longest Streak', trend: null },
      { value: stats.currentStreak, label: 'Current Streak', trend: null },
      { value: stats.mostActiveDay || '-', label: 'Most Active Day', trend: null },
      { value: stats.totalExecs, label: 'Total Executions', trend: stats.trend },
      { value: stats.totalErrors, label: 'Total Errors', trend: null },
    ];

    for (const c of cards) {
      const card = document.createElement('div');
      card.className = 'sv-heatmap-stat-card';
      const val = document.createElement('div');
      val.className = 'sv-heatmap-stat-value';
      val.textContent = c.value;
      const lbl = document.createElement('div');
      lbl.className = 'sv-heatmap-stat-label';
      lbl.textContent = c.label;
      card.append(val, lbl);
      if (c.trend) {
        const trendEl = document.createElement('div');
        trendEl.className = `sv-heatmap-stat-trend sv-heatmap-stat-trend-${c.trend}`;
        const arrows = { up: '\u2191 Trending up', down: '\u2193 Trending down', stable: '\u2194 Stable' };
        trendEl.textContent = arrows[c.trend];
        card.appendChild(trendEl);
      }
      container.appendChild(card);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  async function init(containerEl) {
    _container = containerEl;
    _injectStyles();
    await _loadData();
    _buildUI();
    _initialized = true;

    // Expose recording method globally for other modules
    if (typeof window !== 'undefined') {
      window.__svRecordActivity = _recordActivity;
    }
  }

  async function refresh() {
    await _loadData();
    if (_canvas && _ctx) {
      _drawHeatmap();
      const statsEl = _container?.querySelector('.sv-heatmap-stats');
      if (statsEl) _renderStats(statsEl);
    }
  }

  function setScript(scriptId) {
    _filteredScript = scriptId || null;
    const select = _container?.querySelector('.sv-heatmap-select');
    if (select) select.value = _filteredScript || '';
    if (_canvas && _ctx) {
      _drawHeatmap();
      const statsEl = _container?.querySelector('.sv-heatmap-stats');
      if (statsEl) _renderStats(statsEl);
    }
  }

  function destroy() {
    if (_tooltip) { _tooltip.remove(); _tooltip = null; }
    if (_container) _container.innerHTML = '';
    if (_styleEl) { _styleEl.remove(); _styleEl = null; }
    _container = null;
    _canvas = null;
    _ctx = null;
    _initialized = false;
  }

  return { init, refresh, setScript, getStats, destroy, ACTIVITY_TYPES, _recordActivity };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ActivityHeatmap;
