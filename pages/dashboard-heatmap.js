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
  // Keep the 52 displayed weeks plus one alignment/migration week.
  const RETENTION_DAYS = WEEKS * DAYS_PER_WEEK + DAYS_PER_WEEK;
  const MAX_SCRIPTS_PER_DAY = 200;
  const MAX_SCRIPT_ID_LENGTH = 200;
  const MAX_SCRIPT_NAME_LENGTH = 160;
  const MAX_DAILY_COUNT = 100000;
  const MAX_STORAGE_BYTES = 96000;
  const DIAGNOSTIC_STORAGE_KEY = 'sv_activity_log_diagnostic';
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

  const _safeSetHtml = (typeof window.ScriptVaultDashboardUI?.safeSetHtml === 'function')
      ? window.ScriptVaultDashboardUI.safeSetHtml
      : (el, html) => {
        { const _r = document.createRange(); _r.selectNodeContents(el); el.replaceChildren(_r.createContextualFragment(window.ScriptVaultTrustedTypes?.toTrustedHTML?.('sv-dashboard', html) ?? String(html ?? ''))); }
      };

  let _container = null;
  let _styleEl = null;
  let _canvas = null;
  let _ctx = null;
  let _tooltip = null;
  let _data = {};           // { 'YYYY-MM-DD': { executions, edits, installs, errors, scripts: Set } }
  let _filteredScript = null;
  let _dayMap = new Map();  // Maps canvas pixel regions to date keys
  let _initialized = false;
  let _saveQueue = Promise.resolve();
  let _savePending = false;
  let _storageError = null;
  let _storageDiagnostic = null;
  let _storageStatusEl = null;

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
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-inline-end: auto;
}
.sv-heatmap-select {
  padding: 5px 10px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 0.75rem;
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
  font-size: 0.75rem;
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
  font-size: 0.6875rem;
  color: var(--text-secondary, #a0a0a0);
}
.sv-heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 0.6875rem;
  color: var(--text-muted, #707070);
}
.sv-heatmap-legend-cell {
  width: 12px;
  height: 12px;
  border-radius: var(--sv-radius-sm);
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
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--accent-green, #4ade80);
}
.sv-heatmap-stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
  margin-top: 2px;
}
.sv-heatmap-stat-trend {
  font-size: 0.6875rem;
  margin-top: 4px;
}
.sv-heatmap-stat-trend-up { color: var(--accent-green, #4ade80); }
.sv-heatmap-stat-trend-down { color: var(--accent-red, #f87171); }
.sv-heatmap-stat-trend-stable { color: var(--text-muted, #707070); }
.sv-heatmap-storage-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--accent-red, #f87171) 50%, transparent);
  border-radius: 6px;
  color: var(--accent-red, #f87171);
  font-size: 0.75rem;
}
.sv-heatmap-storage-status[hidden] { display: none; }
.sv-heatmap-storage-retry {
  margin-inline-start: auto;
  padding: 4px 10px;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
`;

  /* ------------------------------------------------------------------ */
  /*  Data Layer                                                         */
  /* ------------------------------------------------------------------ */

  function _dateKey(date) {
    // Use LOCAL date components, not toISOString() (UTC). The heatmap grid is
    // built from local midnights, so a UTC key shifted "today" to the wrong
    // cell in non-UTC timezones — activity landed on an adjacent day and the
    // current-streak check (last grid cell vs. today) never matched, pinning
    // the streak at 0.
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function _dateFromKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const date = new Date(`${key}T00:00:00`);
    return Number.isNaN(date.getTime()) || _dateKey(date) !== key ? null : date;
  }

  function _retentionCutoffKey() {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (RETENTION_DAYS - 1));
    return _dateKey(cutoff);
  }

  function _clampCount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.min(MAX_DAILY_COUNT, Math.floor(numeric));
  }

  function _normalizeScripts(value) {
    const malformed = !(Array.isArray(value) || value instanceof Set);
    const values = Array.isArray(value) ? value : value instanceof Set ? [...value] : [];
    const scripts = [...new Set(values
      .filter(scriptId => typeof scriptId === 'string' && scriptId.length > 0)
      .map(scriptId => scriptId.slice(0, MAX_SCRIPT_ID_LENGTH)))]
      .sort()
      .slice(0, MAX_SCRIPTS_PER_DAY);
    return { scripts, malformed };
  }

  function _normalizeScriptNames(value, scripts) {
    const malformed = !value || typeof value !== 'object' || Array.isArray(value);
    const names = {};
    if (!malformed) {
      for (const scriptId of scripts) {
        const name = value[scriptId];
        if (typeof name === 'string' && name.length > 0) {
          names[scriptId] = name.slice(0, MAX_SCRIPT_NAME_LENGTH);
        }
      }
    }
    return { names, malformed };
  }

  function _normalizeDay(key, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const scriptsResult = _normalizeScripts(value.scripts);
    const namesResult = _normalizeScriptNames(value.scriptNames, scriptsResult.scripts);
    return {
      day: {
        executions: _clampCount(value.executions),
        edits: _clampCount(value.edits),
        installs: _clampCount(value.installs),
        errors: _clampCount(value.errors),
        scripts: new Set(scriptsResult.scripts),
        scriptNames: namesResult.names,
      },
      changed: scriptsResult.malformed || namesResult.malformed
        || value.executions !== _clampCount(value.executions)
        || value.edits !== _clampCount(value.edits)
        || value.installs !== _clampCount(value.installs)
        || value.errors !== _clampCount(value.errors),
    };
  }

  function _toSerializable(data) {
    const serializable = {};
    for (const key of Object.keys(data).sort()) {
      const val = data[key];
      const scripts = [...(val.scripts instanceof Set ? val.scripts : [])].sort();
      const scriptNames = {};
      for (const scriptId of scripts) {
        if (val.scriptNames?.[scriptId]) scriptNames[scriptId] = val.scriptNames[scriptId];
      }
      serializable[key] = {
        executions: _clampCount(val.executions),
        edits: _clampCount(val.edits),
        installs: _clampCount(val.installs),
        errors: _clampCount(val.errors),
        scripts,
        scriptNames,
      };
    }
    return serializable;
  }

  function _utf8ByteLength(value) {
    try {
      return new TextEncoder().encode(value).length;
    } catch {
      return String(value).length;
    }
  }

  function _normalizeData(raw) {
    let parsed = raw;
    let changed = false;
    let malformedRecords = 0;
    let droppedDays = 0;
    if (raw == null) parsed = {};
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { parsed = {}; changed = true; malformedRecords++; }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      parsed = {};
      changed = true;
      malformedRecords++;
    }

    const todayKey = _dateKey(new Date());
    const cutoffKey = _retentionCutoffKey();
    const data = {};
    for (const [key, value] of Object.entries(parsed)) {
      const date = _dateFromKey(key);
      if (!date || key < cutoffKey || key > todayKey) {
        changed = true;
        droppedDays++;
        continue;
      }
      const normalized = _normalizeDay(key, value);
      if (!normalized) {
        changed = true;
        malformedRecords++;
        continue;
      }
      data[key] = normalized.day;
      if (normalized.changed) {
        changed = true;
        malformedRecords++;
      }
    }

    const retained = {};
    for (const key of Object.keys(data).sort().reverse()) {
      retained[key] = data[key];
      if (_utf8ByteLength(JSON.stringify(_toSerializable(retained))) > MAX_STORAGE_BYTES) {
        delete retained[key];
        changed = true;
        droppedDays++;
        break;
      }
    }
    return { data: retained, changed, malformedRecords, droppedDays };
  }

  function _updateStorageStatus() {
    if (!_storageStatusEl) return;
    _storageStatusEl.hidden = !_storageError;
    _storageStatusEl.replaceChildren();
    if (!_storageError) return;
    const message = document.createElement('span');
    message.textContent = 'Activity history could not be saved.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'sv-heatmap-storage-retry';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      retry.disabled = true;
      _saveData().finally(() => {
        retry.disabled = false;
        _updateStorageStatus();
      });
    });
    _storageStatusEl.append(message, retry);
  }

  async function _loadData() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const normalized = _normalizeData(result[STORAGE_KEY]);
      _data = normalized.data;
      if (normalized.malformedRecords || normalized.droppedDays) {
        _storageDiagnostic = {
          malformedRecords: Math.min(1000, normalized.malformedRecords),
          droppedDays: Math.min(1000, normalized.droppedDays),
          normalizedAt: Date.now(),
        };
        await _saveData();
      }
      _storageError = null;
      _updateStorageStatus();
    } catch (e) {
      console.warn('[ActivityHeatmap] Failed to load data:', e);
      _storageError = e;
      _data = {};
      _updateStorageStatus();
    }
  }

  function _saveData() {
    _savePending = true;
    _saveQueue = _saveQueue.catch(() => undefined).then(async () => {
      if (!_savePending) return;
      _savePending = false;
      const normalized = _normalizeData(_data);
      _data = normalized.data;
      const payload = { [STORAGE_KEY]: _toSerializable(_data) };
      if (_storageDiagnostic) payload[DIAGNOSTIC_STORAGE_KEY] = _storageDiagnostic;
      try {
        await chrome.storage.local.set(payload);
        _storageError = null;
        _updateStorageStatus();
      } catch (e) {
        _storageError = e;
        _savePending = true;
        console.warn('[ActivityHeatmap] Failed to save data:', e);
        _updateStorageStatus();
      }
    });
    return _saveQueue;
  }

  function _ensureDay(dateKey) {
    if (!_data[dateKey]) {
      _data[dateKey] = { executions: 0, edits: 0, installs: 0, errors: 0, scripts: new Set(), scriptNames: {} };
    }
    if (!_data[dateKey].scriptNames) _data[dateKey].scriptNames = {};
    return _data[dateKey];
  }

  function _recordActivity(type, scriptId, date, details = {}) {
    const key = _dateKey(date || new Date());
    const day = _ensureDay(key);
    switch (type) {
      case ACTIVITY_TYPES.EXECUTION: day.executions = Math.min(MAX_DAILY_COUNT, day.executions + 1); break;
      case ACTIVITY_TYPES.EDIT: day.edits = Math.min(MAX_DAILY_COUNT, day.edits + 1); break;
      case ACTIVITY_TYPES.INSTALL: day.installs = Math.min(MAX_DAILY_COUNT, day.installs + 1); break;
      case ACTIVITY_TYPES.ERROR: day.errors = Math.min(MAX_DAILY_COUNT, day.errors + 1); break;
    }
    if (scriptId) {
      const normalizedScriptId = String(scriptId).slice(0, MAX_SCRIPT_ID_LENGTH);
      day.scripts.add(normalizedScriptId);
      if (details.scriptName) day.scriptNames[normalizedScriptId] = String(details.scriptName).slice(0, MAX_SCRIPT_NAME_LENGTH);
      if (day.scripts.size > MAX_SCRIPTS_PER_DAY) {
        day.scripts = new Set([...day.scripts].sort().slice(0, MAX_SCRIPTS_PER_DAY));
        day.scriptNames = Object.fromEntries(
          Object.entries(day.scriptNames).filter(([id]) => day.scripts.has(id))
        );
      }
    }
    const savePromise = _saveData();
    if (_initialized && _canvas && _ctx) {
      savePromise.then(() => {
        _drawHeatmap();
        const statsEl = _container?.querySelector('.sv-heatmap-stats');
        if (statsEl) _renderStats(statsEl);
      }).catch(() => {});
    }
    return savePromise;
  }

  function _activityTotal(dayData) {
    if (!dayData) return 0;
    return dayData.executions + dayData.edits * 3 + dayData.installs * 2 + dayData.errors;
  }

  function _getActivityLevel(dayData) {
    if (!dayData) return 0;
    const total = _activityTotal(dayData);
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
    // Sunday-alignment can push the window to 53 partial columns, so size the
    // canvas to the real column count — otherwise the newest 1-6 days render
    // past the right edge and their hover regions fall outside the canvas.
    const numCols = Math.max(WEEKS, Math.ceil(dates.length / DAYS_PER_WEEK));
    const canvasWidth = LABEL_WIDTH + numCols * (CELL_SIZE + CELL_GAP) + CELL_GAP + 20;
    const canvasHeight = HEADER_HEIGHT + DAYS_PER_WEEK * (CELL_SIZE + CELL_GAP) + CELL_GAP;
    const dpr = window.devicePixelRatio || 1;

    _canvas.width = canvasWidth * dpr;
    _canvas.height = canvasHeight * dpr;
    _canvas.style.width = canvasWidth + 'px';
    _canvas.style.height = canvasHeight + 'px';
    _ctx.scale(dpr, dpr);

    _ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    _dayMap.clear();

    // Resolve theme-aware colors once per draw. The canvas can't read CSS
    // tokens, so pull them from the computed style. The empty-cell tint
    // (rgba white 0.04) was invisible on the light theme's white background —
    // fall back to the border token, which reads on every theme.
    const rootStyle = getComputedStyle(document.documentElement);
    const labelColor = rootStyle.getPropertyValue('--text-muted').trim() || '#707070';
    const emptyCellColor = rootStyle.getPropertyValue('--border-color').trim() || COLOR_LEVELS[0];
    const cellColors = [emptyCellColor, ...COLOR_LEVELS.slice(1)];

    // Day labels
    _ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'middle';
    const labelDays = [1, 3, 5]; // Mon, Wed, Fri
    for (const di of labelDays) {
      const y = HEADER_HEIGHT + di * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
      _ctx.fillStyle = labelColor;
      _ctx.fillText(DAY_LABELS[di], LABEL_WIDTH - 4, y);
    }

    // Month labels
    _ctx.textAlign = 'left';
    let lastMonth = -1;
    for (let wi = 0; wi < numCols; wi++) {
      const idx = wi * DAYS_PER_WEEK;
      if (idx < dates.length) {
        const month = dates[idx].getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          const x = LABEL_WIDTH + wi * (CELL_SIZE + CELL_GAP);
          _ctx.fillStyle = labelColor;
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

      _ctx.fillStyle = cellColors[level] || COLOR_LEVELS[level];
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

    _safeSetHtml(_tooltip, html);
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

  function _getScriptLabel(scriptId) {
    for (const day of Object.values(_data)) {
      const name = day.scriptNames?.[scriptId];
      if (name) return name === scriptId ? scriptId : `${name} (${scriptId})`;
    }
    return scriptId;
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
      const total = _activityTotal(d);
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
    _container.replaceChildren();
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
      opt.textContent = _getScriptLabel(sid);
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

    _storageStatusEl = document.createElement('div');
    _storageStatusEl.className = 'sv-heatmap-storage-status';
    _storageStatusEl.setAttribute('role', 'status');
    _storageStatusEl.hidden = true;
    root.appendChild(_storageStatusEl);
    _updateStorageStatus();

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
    _safeSetHtml(legend, '<span>Less</span>');
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
    if (!_tooltip || !_tooltip.isConnected) {
      _tooltip = document.createElement('div');
      _tooltip.className = 'sv-heatmap-tooltip';
      document.body.appendChild(_tooltip);
    } else {
      _hideTooltip();
    }

    _container.appendChild(root);
    _drawHeatmap();
  }

  function _renderStats(container) {
    const stats = getStats();
    container.replaceChildren();

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
    if (_container) _container.replaceChildren();
    if (_styleEl) { _styleEl.remove(); _styleEl = null; }
    // Drop the global hook so a post-destroy caller can't re-persist stale,
    // now-cleared activity data through the dangling closure.
    if (typeof window !== 'undefined' && window.__svRecordActivity === _recordActivity) {
      delete window.__svRecordActivity;
    }
    _container = null;
    _canvas = null;
    _ctx = null;
    _storageStatusEl = null;
    _dayMap.clear();
    _initialized = false;
  }

  return {
    init,
    refresh,
    setScript,
    getStats,
    destroy,
    ACTIVITY_TYPES,
    STORAGE_LIMITS: Object.freeze({ RETENTION_DAYS, MAX_SCRIPTS_PER_DAY, MAX_STORAGE_BYTES }),
    _recordActivity,
    _getDataSnapshot: () => _toSerializable(_data),
    _getStorageState: () => ({ error: _storageError, diagnostic: _storageDiagnostic }),
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ActivityHeatmap;
