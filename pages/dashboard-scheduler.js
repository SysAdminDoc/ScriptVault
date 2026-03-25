// ScriptVault — Script Scheduling Module
// Provides per-script time/day/date scheduling with runtime guard injection,
// chrome.alarms integration for intervals, and a visual schedule configuration modal.

const ScriptScheduler = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_schedules';
  const ALARM_PREFIX = 'sv_sched_';
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const DEFAULT_SCHEDULE = {
    enabled: false,
    type: 'time',          // 'time' | 'day' | 'dateRange' | 'interval' | 'oneTime'
    timeStart: '09:00',
    timeEnd: '17:00',
    days: [1, 2, 3, 4, 5], // Mon-Fri by default
    dateStart: '',
    dateEnd: '',
    interval: 60,           // minutes
    intervalUnit: 'minutes', // 'minutes' | 'hours'
    oneTime: '',            // ISO datetime string
  };

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _schedules = {};    // { scriptId: schedule }
  let _modalEl = null;
  let _styleEl = null;
  let _activeScriptId = null;
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Schedule Modal Overlay */
.sv-sched-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.sv-sched-overlay.visible { opacity: 1; }

/* Modal */
.sv-sched-modal {
  background: var(--bg-content, #242424);
  border: 1px solid var(--border-color, #444);
  border-radius: 12px;
  width: 520px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  transform: translateY(12px);
  transition: transform 0.2s ease;
}
.sv-sched-overlay.visible .sv-sched-modal {
  transform: translateY(0);
}

/* Modal Header */
.sv-sched-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #444);
}
.sv-sched-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sv-sched-header h3 svg {
  width: 18px;
  height: 18px;
  stroke: var(--accent-primary, #22c55e);
}
.sv-sched-close {
  background: none;
  border: none;
  color: var(--text-muted, #666);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
.sv-sched-close:hover { color: var(--text-primary, #e0e0e0); background: var(--bg-button, #333); }

/* Modal Body */
.sv-sched-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Enable Toggle */
.sv-sched-enable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
}
.sv-sched-enable-row label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
}

/* Toggle switch */
.sv-sched-toggle {
  position: relative;
  width: 40px;
  height: 22px;
}
.sv-sched-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}
.sv-sched-toggle-track {
  position: absolute;
  inset: 0;
  background: var(--toggle-off, #555);
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.2s;
}
.sv-sched-toggle-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: var(--toggle-dot, #fff);
  border-radius: 50%;
  transition: transform 0.2s;
}
.sv-sched-toggle input:checked + .sv-sched-toggle-track {
  background: var(--toggle-on, #22c55e);
}
.sv-sched-toggle input:checked + .sv-sched-toggle-track::after {
  transform: translateX(18px);
}

/* Schedule Type Selector */
.sv-sched-type-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-input, #1a1a1a);
  border-radius: 8px;
  padding: 4px;
  border: 1px solid var(--border-color, #444);
}
.sv-sched-type-tab {
  flex: 1;
  padding: 7px 6px;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  color: var(--text-muted, #666);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.sv-sched-type-tab:hover { color: var(--text-secondary, #a0a0a0); }
.sv-sched-type-tab.active {
  background: var(--accent-primary, #22c55e);
  color: var(--text-on-accent, #fff);
}

/* Section panels */
.sv-sched-section {
  display: none;
  flex-direction: column;
  gap: 12px;
}
.sv-sched-section.active { display: flex; }

/* Form row */
.sv-sched-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sv-sched-row label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  min-width: 50px;
}
.sv-sched-row input[type="time"],
.sv-sched-row input[type="date"],
.sv-sched-row input[type="datetime-local"],
.sv-sched-row input[type="number"],
.sv-sched-row select {
  flex: 1;
  padding: 7px 10px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  font-family: inherit;
}
.sv-sched-row input:focus,
.sv-sched-row select:focus {
  outline: none;
  border-color: var(--accent-primary, #22c55e);
}

/* Time range slider */
.sv-sched-time-slider {
  position: relative;
  height: 40px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  overflow: hidden;
  user-select: none;
}
.sv-sched-time-slider-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--accent-primary, #22c55e);
  opacity: 0.2;
  transition: left 0.1s, width 0.1s;
}
.sv-sched-time-slider-labels {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
  pointer-events: none;
}
.sv-sched-time-slider-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  background: var(--accent-primary, #22c55e);
  cursor: ew-resize;
  transition: opacity 0.1s;
}
.sv-sched-time-slider-handle:hover { opacity: 0.8; }

/* Day toggles */
.sv-sched-days {
  display: flex;
  gap: 6px;
}
.sv-sched-day {
  width: 42px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color, #444);
  color: var(--text-muted, #666);
  background: var(--bg-input, #1a1a1a);
  transition: all 0.15s;
  user-select: none;
}
.sv-sched-day.active {
  background: var(--accent-primary, #22c55e);
  color: var(--text-on-accent, #fff);
  border-color: var(--accent-primary, #22c55e);
}
.sv-sched-day:hover:not(.active) {
  border-color: var(--text-muted, #666);
  color: var(--text-secondary, #a0a0a0);
}

/* Preview */
.sv-sched-preview {
  padding: 12px 14px;
  background: var(--bg-input, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-left: 3px solid var(--accent-primary, #22c55e);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  line-height: 1.5;
}
.sv-sched-preview strong {
  color: var(--text-primary, #e0e0e0);
}

/* Footer */
.sv-sched-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color, #444);
}
.sv-sched-btn {
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-button, #333);
  color: var(--text-primary, #e0e0e0);
  transition: all 0.15s;
}
.sv-sched-btn:hover { background: var(--bg-button-hover, #444); }
.sv-sched-btn-primary {
  background: var(--accent-primary, #22c55e);
  color: var(--text-on-accent, #fff);
  border-color: var(--accent-primary, #22c55e);
}
.sv-sched-btn-primary:hover { opacity: 0.9; }
.sv-sched-btn-danger {
  color: var(--accent-error, #ef4444);
  border-color: var(--accent-error, #ef4444);
}
.sv-sched-btn-danger:hover {
  background: var(--accent-error, #ef4444);
  color: #fff;
}

/* Schedule indicator in script rows */
.sv-sched-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted, #666);
  transition: all 0.15s;
}
.sv-sched-icon:hover { color: var(--text-secondary, #a0a0a0); background: var(--bg-button, #333); }
.sv-sched-icon.active { color: var(--accent-primary, #22c55e); }
.sv-sched-icon svg { width: 16px; height: 16px; }
`;

  /* ------------------------------------------------------------------ */
  /*  SVG Icons                                                          */
  /* ------------------------------------------------------------------ */

  const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'innerHTML') e.innerHTML = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }

  function formatTime12(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function timeToMinutes(time24) {
    if (!time24) return 0;
    const [h, m] = time24.split(':').map(Number);
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function cloneSchedule(sched) {
    return JSON.parse(JSON.stringify(sched));
  }

  /* ------------------------------------------------------------------ */
  /*  Storage                                                            */
  /* ------------------------------------------------------------------ */

  async function loadSchedules() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      _schedules = data[STORAGE_KEY] || {};
    } catch {
      _schedules = {};
    }
  }

  async function persistSchedules() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _schedules });
    } catch (e) {
      console.error('[ScriptScheduler] Failed to persist schedules:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Chrome Alarms                                                      */
  /* ------------------------------------------------------------------ */

  async function syncAlarms() {
    // Clear old ScriptVault schedule alarms
    try {
      const alarms = await chrome.alarms.getAll();
      for (const alarm of alarms) {
        if (alarm.name.startsWith(ALARM_PREFIX)) {
          await chrome.alarms.clear(alarm.name);
        }
      }
    } catch { /* alarms API may not be available in all contexts */ }

    // Create alarms for interval and one-time schedules
    for (const [scriptId, sched] of Object.entries(_schedules)) {
      if (!sched.enabled) continue;

      if (sched.type === 'interval') {
        const periodMinutes = sched.intervalUnit === 'hours'
          ? (sched.interval || 1) * 60
          : (sched.interval || 1);
        try {
          await chrome.alarms.create(`${ALARM_PREFIX}${scriptId}`, {
            delayInMinutes: periodMinutes,
            periodInMinutes: periodMinutes,
          });
        } catch { /* ignore */ }
      }

      if (sched.type === 'oneTime' && sched.oneTime) {
        const when = new Date(sched.oneTime).getTime();
        if (when > Date.now()) {
          try {
            await chrome.alarms.create(`${ALARM_PREFIX}${scriptId}`, { when });
          } catch { /* ignore */ }
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Preview Text                                                       */
  /* ------------------------------------------------------------------ */

  function buildPreviewText(sched) {
    if (!sched.enabled) return 'Schedule is <strong>disabled</strong>.';

    switch (sched.type) {
      case 'time': {
        const dayStr = sched.days?.length === 7
          ? 'every day'
          : sched.days?.length === 0
            ? 'no days selected'
            : sched.days.map(d => DAY_NAMES[d]).join(', ');
        return `This script will run <strong>${dayStr}</strong>, <strong>${formatTime12(sched.timeStart)}</strong> &ndash; <strong>${formatTime12(sched.timeEnd)}</strong>.`;
      }
      case 'day': {
        const dayStr = sched.days?.length === 0
          ? 'no days selected'
          : sched.days.map(d => DAY_FULL[d]).join(', ');
        return `This script will run on <strong>${dayStr}</strong> (all day).`;
      }
      case 'dateRange': {
        const start = sched.dateStart ? formatDate(sched.dateStart) : '(no start date)';
        const end = sched.dateEnd ? formatDate(sched.dateEnd) : '(no end date)';
        return `This script will run from <strong>${start}</strong> to <strong>${end}</strong>.`;
      }
      case 'interval': {
        const unit = sched.intervalUnit === 'hours' ? 'hour' : 'minute';
        const n = sched.interval || 1;
        return `This script will run every <strong>${n} ${unit}${n !== 1 ? 's' : ''}</strong> via chrome.alarms.`;
      }
      case 'oneTime': {
        if (!sched.oneTime) return 'No date/time selected for one-time run.';
        const d = new Date(sched.oneTime);
        return `This script will run once at <strong>${d.toLocaleString()}</strong>, then disable.`;
      }
      default:
        return 'Unknown schedule type.';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Guard Code Generation                                              */
  /* ------------------------------------------------------------------ */

  function generateGuardCode(schedule) {
    if (!schedule || !schedule.enabled) return '';

    const s = JSON.stringify(schedule);

    return `// ScriptVault Schedule Guard — auto-injected
(function() {
  const __svSched = ${s};
  function __svScheduleCheck() {
    const now = new Date();
    const day = now.getDay();
    const h = now.getHours();
    const m = now.getMinutes();
    const nowMins = h * 60 + m;

    if (!__svSched.enabled) return true;

    switch (__svSched.type) {
      case 'time': {
        if (__svSched.days && __svSched.days.length > 0 && !__svSched.days.includes(day)) return false;
        const start = _parseTime(__svSched.timeStart);
        const end = _parseTime(__svSched.timeEnd);
        if (start <= end) { if (nowMins < start || nowMins > end) return false; }
        else { if (nowMins < start && nowMins > end) return false; }
        return true;
      }
      case 'day':
        return __svSched.days && __svSched.days.includes(day);
      case 'dateRange': {
        const today = now.toISOString().slice(0, 10);
        if (__svSched.dateStart && today < __svSched.dateStart) return false;
        if (__svSched.dateEnd && today > __svSched.dateEnd) return false;
        return true;
      }
      case 'interval':
        return true; // Interval is handled by chrome.alarms, always allow manual runs
      case 'oneTime': {
        if (!__svSched.oneTime) return false;
        const target = new Date(__svSched.oneTime);
        const diffMs = Math.abs(now - target);
        return diffMs < 60000; // Within 1 minute of target
      }
      default:
        return true;
    }

    function _parseTime(t) {
      if (!t) return 0;
      const p = t.split(':').map(Number);
      return p[0] * 60 + (p[1] || 0);
    }
  }
  if (!__svScheduleCheck()) return;
})();
`;
  }

  /* ------------------------------------------------------------------ */
  /*  Modal UI                                                           */
  /* ------------------------------------------------------------------ */

  function buildModal() {
    if (_modalEl) _modalEl.remove();

    const overlay = el('div', { className: 'sv-sched-overlay' });
    const modal = el('div', { className: 'sv-sched-modal' });

    // Header
    const header = el('div', { className: 'sv-sched-header' }, [
      el('h3', { innerHTML: `${ICON_CLOCK} Script Schedule` }),
      el('button', { className: 'sv-sched-close', innerHTML: ICON_CLOSE, onClick: () => closeModal() }),
    ]);

    // Body
    const body = el('div', { className: 'sv-sched-body' });

    // Enable toggle
    const enableRow = el('div', { className: 'sv-sched-enable-row' });
    enableRow.innerHTML = `
      <label>Enable schedule</label>
      <label class="sv-sched-toggle">
        <input type="checkbox" id="sv-sched-enabled">
        <span class="sv-sched-toggle-track"></span>
      </label>
    `;
    body.appendChild(enableRow);

    // Type tabs
    const typeTabs = el('div', { className: 'sv-sched-type-tabs' });
    const types = [
      { id: 'time', label: 'Time Range' },
      { id: 'day', label: 'Days' },
      { id: 'dateRange', label: 'Date Range' },
      { id: 'interval', label: 'Interval' },
      { id: 'oneTime', label: 'One-Time' },
    ];
    for (const t of types) {
      const tab = el('button', { className: 'sv-sched-type-tab', 'data-type': t.id, textContent: t.label });
      tab.addEventListener('click', () => selectType(t.id));
      typeTabs.appendChild(tab);
    }
    body.appendChild(typeTabs);

    // --- Time Range section ---
    const timeSection = el('div', { className: 'sv-sched-section', 'data-section': 'time' });

    // Visual time slider
    const slider = el('div', { className: 'sv-sched-time-slider', id: 'sv-sched-slider' });
    slider.innerHTML = `
      <div class="sv-sched-time-slider-fill" id="sv-sched-slider-fill"></div>
      <div class="sv-sched-time-slider-handle" id="sv-sched-slider-start" style="left:37.5%"></div>
      <div class="sv-sched-time-slider-handle" id="sv-sched-slider-end" style="left:70.8%"></div>
      <div class="sv-sched-time-slider-labels">
        <span id="sv-sched-slider-label-start">9:00 AM</span>
        <span id="sv-sched-slider-label-end">5:00 PM</span>
      </div>
    `;
    timeSection.appendChild(slider);

    // Time inputs (fallback)
    const timeRow = el('div', { className: 'sv-sched-row' });
    timeRow.innerHTML = `
      <label>From</label>
      <input type="time" id="sv-sched-time-start" value="09:00">
      <label style="min-width:auto">to</label>
      <input type="time" id="sv-sched-time-end" value="17:00">
    `;
    timeSection.appendChild(timeRow);

    // Day selection within time section
    const timeDays = buildDayToggles('sv-sched-time-days');
    timeSection.appendChild(timeDays);

    body.appendChild(timeSection);

    // --- Day section ---
    const daySection = el('div', { className: 'sv-sched-section', 'data-section': 'day' });
    const dayToggles = buildDayToggles('sv-sched-day-days');
    daySection.appendChild(dayToggles);
    body.appendChild(daySection);

    // --- Date Range section ---
    const dateSection = el('div', { className: 'sv-sched-section', 'data-section': 'dateRange' });
    dateSection.innerHTML = `
      <div class="sv-sched-row">
        <label>Start</label>
        <input type="date" id="sv-sched-date-start">
      </div>
      <div class="sv-sched-row">
        <label>End</label>
        <input type="date" id="sv-sched-date-end">
      </div>
    `;
    body.appendChild(dateSection);

    // --- Interval section ---
    const intervalSection = el('div', { className: 'sv-sched-section', 'data-section': 'interval' });
    intervalSection.innerHTML = `
      <div class="sv-sched-row">
        <label>Every</label>
        <input type="number" id="sv-sched-interval" min="1" max="1440" value="60" style="max-width:100px">
        <select id="sv-sched-interval-unit">
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
        </select>
      </div>
    `;
    body.appendChild(intervalSection);

    // --- One-Time section ---
    const oneTimeSection = el('div', { className: 'sv-sched-section', 'data-section': 'oneTime' });
    oneTimeSection.innerHTML = `
      <div class="sv-sched-row">
        <label>Run at</label>
        <input type="datetime-local" id="sv-sched-onetime">
      </div>
    `;
    body.appendChild(oneTimeSection);

    // Preview
    const preview = el('div', { className: 'sv-sched-preview', id: 'sv-sched-preview' });
    body.appendChild(preview);

    // Footer
    const footer = el('div', { className: 'sv-sched-footer' });
    footer.innerHTML = `
      <button class="sv-sched-btn sv-sched-btn-danger" id="sv-sched-clear">Clear</button>
      <button class="sv-sched-btn" id="sv-sched-cancel">Cancel</button>
      <button class="sv-sched-btn sv-sched-btn-primary" id="sv-sched-save">Save Schedule</button>
    `;

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    _modalEl = overlay;
    document.body.appendChild(_modalEl);

    // Bind events
    bindModalEvents();

    return overlay;
  }

  function buildDayToggles(id) {
    const container = el('div', { className: 'sv-sched-days', id });
    for (let i = 0; i < 7; i++) {
      const day = el('div', {
        className: 'sv-sched-day',
        'data-day': String(i),
        textContent: DAY_NAMES[i],
      });
      day.addEventListener('click', () => {
        day.classList.toggle('active');
        updatePreview();
      });
      container.appendChild(day);
    }
    return container;
  }

  function bindModalEvents() {
    // Enable toggle
    const enabledCb = _modalEl.querySelector('#sv-sched-enabled');
    enabledCb?.addEventListener('change', updatePreview);

    // Time inputs
    const timeStart = _modalEl.querySelector('#sv-sched-time-start');
    const timeEnd = _modalEl.querySelector('#sv-sched-time-end');
    timeStart?.addEventListener('input', () => { updateSliderFromInputs(); updatePreview(); });
    timeEnd?.addEventListener('input', () => { updateSliderFromInputs(); updatePreview(); });

    // Date inputs
    _modalEl.querySelector('#sv-sched-date-start')?.addEventListener('input', updatePreview);
    _modalEl.querySelector('#sv-sched-date-end')?.addEventListener('input', updatePreview);

    // Interval
    _modalEl.querySelector('#sv-sched-interval')?.addEventListener('input', updatePreview);
    _modalEl.querySelector('#sv-sched-interval-unit')?.addEventListener('change', updatePreview);

    // One-time
    _modalEl.querySelector('#sv-sched-onetime')?.addEventListener('input', updatePreview);

    // Slider drag
    bindSliderDrag();

    // Buttons
    _modalEl.querySelector('#sv-sched-save')?.addEventListener('click', saveAndClose);
    _modalEl.querySelector('#sv-sched-cancel')?.addEventListener('click', closeModal);
    _modalEl.querySelector('#sv-sched-clear')?.addEventListener('click', clearAndClose);

    // Click outside to close
    _modalEl.addEventListener('click', e => {
      if (e.target === _modalEl) closeModal();
    });

    // Escape key
    _modalEl._keyHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', _modalEl._keyHandler);
  }

  function bindSliderDrag() {
    const slider = _modalEl.querySelector('#sv-sched-slider');
    const startHandle = _modalEl.querySelector('#sv-sched-slider-start');
    const endHandle = _modalEl.querySelector('#sv-sched-slider-end');
    if (!slider || !startHandle || !endHandle) return;

    let dragging = null;

    function onPointerDown(e, which) {
      dragging = which;
      e.preventDefault();
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const rect = slider.getBoundingClientRect();
      let pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      let mins = Math.round(pct * 1440 / 15) * 15; // Snap to 15-min increments
      mins = Math.max(0, Math.min(1440, mins));

      const timeStr = minutesToTime(mins);
      if (dragging === 'start') {
        _modalEl.querySelector('#sv-sched-time-start').value = timeStr;
      } else {
        _modalEl.querySelector('#sv-sched-time-end').value = timeStr;
      }
      updateSliderFromInputs();
      updatePreview();
    }

    function onPointerUp() {
      dragging = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }

    startHandle.addEventListener('pointerdown', e => onPointerDown(e, 'start'));
    endHandle.addEventListener('pointerdown', e => onPointerDown(e, 'end'));
  }

  function updateSliderFromInputs() {
    const timeStart = _modalEl.querySelector('#sv-sched-time-start')?.value || '09:00';
    const timeEnd = _modalEl.querySelector('#sv-sched-time-end')?.value || '17:00';
    const startMins = timeToMinutes(timeStart);
    const endMins = timeToMinutes(timeEnd);
    const startPct = (startMins / 1440) * 100;
    const endPct = (endMins / 1440) * 100;

    const fill = _modalEl.querySelector('#sv-sched-slider-fill');
    const startHandle = _modalEl.querySelector('#sv-sched-slider-start');
    const endHandle = _modalEl.querySelector('#sv-sched-slider-end');
    const labelStart = _modalEl.querySelector('#sv-sched-slider-label-start');
    const labelEnd = _modalEl.querySelector('#sv-sched-slider-label-end');

    if (startMins <= endMins) {
      fill.style.left = startPct + '%';
      fill.style.width = (endPct - startPct) + '%';
    } else {
      // Wrapping range (e.g., 10pm - 6am)
      fill.style.left = '0%';
      fill.style.width = endPct + '%';
    }

    startHandle.style.left = `calc(${startPct}% - 4px)`;
    endHandle.style.left = `calc(${endPct}% - 4px)`;
    labelStart.textContent = formatTime12(timeStart);
    labelEnd.textContent = formatTime12(timeEnd);
  }

  function selectType(type) {
    // Update tabs
    _modalEl.querySelectorAll('.sv-sched-type-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.type === type);
    });
    // Show/hide sections
    _modalEl.querySelectorAll('.sv-sched-section').forEach(s => {
      s.classList.toggle('active', s.dataset.section === type);
    });
    updatePreview();
  }

  function getSelectedType() {
    const active = _modalEl.querySelector('.sv-sched-type-tab.active');
    return active?.dataset.type || 'time';
  }

  function getSelectedDays(containerId) {
    const container = _modalEl.querySelector(`#${containerId}`);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.sv-sched-day.active')).map(d => Number(d.dataset.day));
  }

  function setSelectedDays(containerId, days) {
    const container = _modalEl.querySelector(`#${containerId}`);
    if (!container) return;
    container.querySelectorAll('.sv-sched-day').forEach(d => {
      d.classList.toggle('active', days.includes(Number(d.dataset.day)));
    });
  }

  function collectScheduleFromModal() {
    const type = getSelectedType();
    return {
      enabled: _modalEl.querySelector('#sv-sched-enabled')?.checked || false,
      type,
      timeStart: _modalEl.querySelector('#sv-sched-time-start')?.value || '09:00',
      timeEnd: _modalEl.querySelector('#sv-sched-time-end')?.value || '17:00',
      days: type === 'time'
        ? getSelectedDays('sv-sched-time-days')
        : getSelectedDays('sv-sched-day-days'),
      dateStart: _modalEl.querySelector('#sv-sched-date-start')?.value || '',
      dateEnd: _modalEl.querySelector('#sv-sched-date-end')?.value || '',
      interval: parseInt(_modalEl.querySelector('#sv-sched-interval')?.value) || 60,
      intervalUnit: _modalEl.querySelector('#sv-sched-interval-unit')?.value || 'minutes',
      oneTime: _modalEl.querySelector('#sv-sched-onetime')?.value || '',
    };
  }

  function updatePreview() {
    const sched = collectScheduleFromModal();
    const previewEl = _modalEl.querySelector('#sv-sched-preview');
    if (previewEl) previewEl.innerHTML = buildPreviewText(sched);
  }

  function populateModal(schedule) {
    const sched = { ...DEFAULT_SCHEDULE, ...schedule };

    // Enable
    const enabledCb = _modalEl.querySelector('#sv-sched-enabled');
    if (enabledCb) enabledCb.checked = sched.enabled;

    // Type
    selectType(sched.type);

    // Time
    const timeStart = _modalEl.querySelector('#sv-sched-time-start');
    const timeEnd = _modalEl.querySelector('#sv-sched-time-end');
    if (timeStart) timeStart.value = sched.timeStart;
    if (timeEnd) timeEnd.value = sched.timeEnd;
    updateSliderFromInputs();

    // Days
    setSelectedDays('sv-sched-time-days', sched.days || []);
    setSelectedDays('sv-sched-day-days', sched.days || []);

    // Date range
    const dateStart = _modalEl.querySelector('#sv-sched-date-start');
    const dateEnd = _modalEl.querySelector('#sv-sched-date-end');
    if (dateStart) dateStart.value = sched.dateStart;
    if (dateEnd) dateEnd.value = sched.dateEnd;

    // Interval
    const interval = _modalEl.querySelector('#sv-sched-interval');
    const intervalUnit = _modalEl.querySelector('#sv-sched-interval-unit');
    if (interval) interval.value = sched.interval;
    if (intervalUnit) intervalUnit.value = sched.intervalUnit;

    // One-time
    const onetime = _modalEl.querySelector('#sv-sched-onetime');
    if (onetime) onetime.value = sched.oneTime;

    updatePreview();
  }

  /* ------------------------------------------------------------------ */
  /*  Modal Lifecycle                                                    */
  /* ------------------------------------------------------------------ */

  function showScheduleModal(scriptId) {
    _activeScriptId = scriptId;
    buildModal();

    const existing = _schedules[scriptId] || cloneSchedule(DEFAULT_SCHEDULE);
    populateModal(existing);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        _modalEl.classList.add('visible');
      });
    });
  }

  function closeModal() {
    if (!_modalEl) return;
    if (_modalEl._keyHandler) {
      document.removeEventListener('keydown', _modalEl._keyHandler);
    }
    _modalEl.classList.remove('visible');
    setTimeout(() => {
      _modalEl?.remove();
      _modalEl = null;
      _activeScriptId = null;
    }, 200);
  }

  async function saveAndClose() {
    if (!_activeScriptId) return;
    const sched = collectScheduleFromModal();
    _schedules[_activeScriptId] = sched;
    await persistSchedules();
    await syncAlarms();
    updateScriptRowIndicators();
    closeModal();

    // Notify via toast if available
    if (typeof showToast === 'function') {
      showToast('Schedule saved', 'success');
    }
  }

  async function clearAndClose() {
    if (!_activeScriptId) return;
    delete _schedules[_activeScriptId];
    await persistSchedules();
    await syncAlarms();
    updateScriptRowIndicators();
    closeModal();

    if (typeof showToast === 'function') {
      showToast('Schedule cleared', 'success');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Dashboard Integration                                              */
  /* ------------------------------------------------------------------ */

  function injectScheduleIcons() {
    const rows = document.querySelectorAll('.action-icons');
    for (const row of rows) {
      // Skip if already injected
      if (row.querySelector('.sv-sched-icon')) continue;

      // Find script ID from a sibling action button
      const actionBtn = row.querySelector('[data-id]');
      if (!actionBtn) continue;
      const scriptId = actionBtn.dataset.id;

      const hasSchedule = _schedules[scriptId]?.enabled;
      const icon = el('button', {
        className: `sv-sched-icon action-icon${hasSchedule ? ' active' : ''}`,
        title: hasSchedule ? 'Edit schedule (active)' : 'Set schedule',
        'data-action': 'schedule',
        'data-id': scriptId,
        innerHTML: ICON_CLOCK,
      });
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        showScheduleModal(scriptId);
      });

      // Insert before the delete button
      const deleteBtn = row.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        row.insertBefore(icon, deleteBtn);
      } else {
        row.appendChild(icon);
      }
    }
  }

  function updateScriptRowIndicators() {
    document.querySelectorAll('.sv-sched-icon').forEach(icon => {
      const scriptId = icon.dataset.id;
      const active = _schedules[scriptId]?.enabled;
      icon.classList.toggle('active', !!active);
      icon.title = active ? 'Edit schedule (active)' : 'Set schedule';
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Filter Integration                                                 */
  /* ------------------------------------------------------------------ */

  function addScheduleFilter() {
    const filterSelect = document.getElementById('filterSelect');
    if (!filterSelect) return;

    // Check if already added
    if (filterSelect.querySelector('option[value="scheduled"]')) return;

    const opt = el('option', { value: 'scheduled', textContent: 'Scheduled scripts' });
    filterSelect.appendChild(opt);
  }

  /** Check if a script passes the schedule filter. */
  function matchesScheduleFilter(scriptId) {
    return !!_schedules[scriptId]?.enabled;
  }

  /* ------------------------------------------------------------------ */
  /*  MutationObserver for dynamic rows                                  */
  /* ------------------------------------------------------------------ */

  let _observer = null;

  function startObserver() {
    const tableBody = document.getElementById('scriptTableBody');
    if (!tableBody || _observer) return;

    _observer = new MutationObserver(() => {
      injectScheduleIcons();
    });
    _observer.observe(tableBody, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Inject CSS                                                         */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-scheduler-styles';
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

  return {
    /**
     * Initialize the scheduler module. Call once when the dashboard loads.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;

      injectStyles();
      await loadSchedules();
      await syncAlarms();
      injectScheduleIcons();
      addScheduleFilter();
      startObserver();
    },

    /**
     * Open the schedule configuration modal for a script.
     * @param {string} scriptId
     */
    showScheduleModal(scriptId) {
      showScheduleModal(scriptId);
    },

    /**
     * Get the schedule for a script.
     * @param {string} scriptId
     * @returns {object|null}
     */
    getSchedule(scriptId) {
      return _schedules[scriptId] ? cloneSchedule(_schedules[scriptId]) : null;
    },

    /**
     * Set the schedule for a script programmatically.
     * @param {string} scriptId
     * @param {object} schedule
     */
    async setSchedule(scriptId, schedule) {
      _schedules[scriptId] = { ...DEFAULT_SCHEDULE, ...schedule };
      await persistSchedules();
      await syncAlarms();
      updateScriptRowIndicators();
    },

    /**
     * Generate the runtime guard code for a given schedule.
     * Inject this at the top of a script to enforce the schedule client-side.
     * @param {object} schedule
     * @returns {string}
     */
    generateGuardCode(schedule) {
      return generateGuardCode(schedule);
    },

    /**
     * Check if a script should run right now based on its schedule.
     * @param {string} scriptId
     * @returns {boolean}
     */
    shouldRunNow(scriptId) {
      const sched = _schedules[scriptId];
      if (!sched || !sched.enabled) return true; // No schedule = always run

      const now = new Date();
      const day = now.getDay();
      const nowMins = now.getHours() * 60 + now.getMinutes();

      switch (sched.type) {
        case 'time': {
          if (sched.days?.length > 0 && !sched.days.includes(day)) return false;
          const start = timeToMinutes(sched.timeStart);
          const end = timeToMinutes(sched.timeEnd);
          if (start <= end) return nowMins >= start && nowMins <= end;
          return nowMins >= start || nowMins <= end;
        }
        case 'day':
          return sched.days?.includes(day) ?? true;
        case 'dateRange': {
          const today = now.toISOString().slice(0, 10);
          if (sched.dateStart && today < sched.dateStart) return false;
          if (sched.dateEnd && today > sched.dateEnd) return false;
          return true;
        }
        case 'interval':
          return true;
        case 'oneTime': {
          if (!sched.oneTime) return false;
          return Math.abs(now - new Date(sched.oneTime)) < 60000;
        }
        default:
          return true;
      }
    },

    /**
     * Whether a script has an active schedule (for filter integration).
     * @param {string} scriptId
     * @returns {boolean}
     */
    matchesScheduleFilter(scriptId) {
      return matchesScheduleFilter(scriptId);
    },

    /**
     * Tear down the module: remove UI, styles, observer.
     */
    destroy() {
      stopObserver();
      closeModal();
      removeStyles();

      // Remove injected schedule icons
      document.querySelectorAll('.sv-sched-icon').forEach(el => el.remove());

      // Remove filter option
      document.querySelector('#filterSelect option[value="scheduled"]')?.remove();

      _schedules = {};
      _initialized = false;
    },
  };
})();
