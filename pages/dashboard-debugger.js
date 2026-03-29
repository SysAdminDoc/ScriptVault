/**
 * ScriptVault — Script Debugging Tools
 * Console capture, live reload, variable inspector, and error timeline.
 */

const ScriptDebugger = (() => {

  /* ── Constants ──────────────────────────────────────────────────── */
  const MAX_CONSOLE_ENTRIES = 200;
  const MAX_ERRORS = 50;
  const VARIABLE_REFRESH_MS = 2000;

  /* ── State ─────────────────────────────────────────────────────── */
  let _container = null;
  let _activeTab = 'console';
  let _consoleLogs = {};       // scriptId -> [{level, args, time}]
  let _liveReload = {};        // scriptId -> boolean
  let _errorTimeline = {};     // scriptId -> [{message, stack, line, time}]
  let _variableRefreshTimer = null;
  let _consoleFilter = 'all';  // 'all' | 'log' | 'warn' | 'error'
  let _variableSearch = '';
  let _activeScriptId = null;
  let _editingVar = null;      // { key, scriptId } or null

  /* ── CSS ────────────────────────────────────────────────────────── */
  const CSS = `
    .dbg-root{font-family:system-ui,-apple-system,sans-serif;color:var(--text-primary,#e0e0e0);display:flex;flex-direction:column;height:100%}
    .dbg-tabs{display:flex;border-bottom:1px solid var(--border-color,#404040);gap:0;flex-shrink:0}
    .dbg-tab{padding:8px 16px;font-size:12px;font-weight:500;color:var(--text-secondary,#a0a0a0);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;user-select:none}
    .dbg-tab:hover{color:var(--text-primary,#e0e0e0)}
    .dbg-tab.active{color:var(--accent-green,#4ade80);border-bottom-color:var(--accent-green,#4ade80)}
    .dbg-tab .badge{display:inline-block;background:var(--accent-red,#f87171);color:#fff;font-size:10px;border-radius:8px;padding:1px 6px;margin-left:4px;vertical-align:middle}
    .dbg-panel{flex:1;overflow:auto;padding:10px}
    .dbg-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
    .dbg-btn{background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;color:var(--text-primary,#e0e0e0);padding:4px 12px;font-size:11px;cursor:pointer;transition:background .15s,border-color .15s}
    .dbg-btn:hover{border-color:var(--accent-green,#4ade80)}
    .dbg-btn.active{background:var(--accent-green-dark,#22c55e);border-color:var(--accent-green-dark,#22c55e);color:#fff}
    .dbg-btn-danger{color:var(--accent-red,#f87171)}
    .dbg-btn-danger:hover{border-color:var(--accent-red,#f87171)}
    .dbg-input{background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;color:var(--text-primary,#e0e0e0);padding:5px 10px;font-size:12px;outline:none;transition:border-color .2s}
    .dbg-input:focus{border-color:var(--accent-green,#4ade80)}
    .dbg-select{background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;color:var(--text-primary,#e0e0e0);padding:5px 8px;font-size:12px;outline:none;cursor:pointer}

    /* Console */
    .dbg-console{display:flex;flex-direction:column;gap:2px;font-family:'Cascadia Code','Fira Code',monospace;font-size:12px}
    .dbg-log-entry{display:flex;gap:8px;padding:4px 8px;border-radius:3px;align-items:flex-start;border-left:3px solid transparent}
    .dbg-log-entry.log{border-left-color:var(--text-muted,#707070);background:transparent}
    .dbg-log-entry.warn{border-left-color:var(--accent-yellow,#fbbf24);background:rgba(251,191,36,0.05)}
    .dbg-log-entry.error{border-left-color:var(--accent-red,#f87171);background:rgba(248,113,113,0.05)}
    .dbg-log-entry.info{border-left-color:var(--accent-blue,#60a5fa);background:transparent}
    .dbg-log-time{color:var(--text-muted,#707070);font-size:10px;min-width:70px;flex-shrink:0;padding-top:2px}
    .dbg-log-level{font-size:10px;text-transform:uppercase;min-width:40px;flex-shrink:0;font-weight:600;padding-top:2px}
    .dbg-log-level.log{color:var(--text-muted,#707070)}
    .dbg-log-level.warn{color:var(--accent-yellow,#fbbf24)}
    .dbg-log-level.error{color:var(--accent-red,#f87171)}
    .dbg-log-level.info{color:var(--accent-blue,#60a5fa)}
    .dbg-log-msg{flex:1;word-break:break-word;color:var(--text-primary,#e0e0e0);line-height:1.4}
    .dbg-log-obj{cursor:pointer;color:var(--accent-purple,#c084fc);text-decoration:underline dotted}
    .dbg-log-expanded{background:var(--bg-body,#1a1a1a);border:1px solid var(--border-color,#404040);border-radius:4px;padding:6px 8px;margin-top:4px;white-space:pre-wrap;font-size:11px;color:var(--text-secondary,#a0a0a0);max-height:200px;overflow:auto}
    .dbg-empty{color:var(--text-muted,#707070);font-size:12px;text-align:center;padding:24px}

    /* Live Reload */
    .dbg-live-badge{display:inline-flex;align-items:center;gap:4px;background:var(--accent-green-dark,#22c55e);color:#fff;font-size:10px;font-weight:600;border-radius:10px;padding:2px 10px;animation:dbg-pulse 2s infinite}
    @keyframes dbg-pulse{0%,100%{opacity:1}50%{opacity:.6}}
    .dbg-live-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color,#404040)}
    .dbg-live-name{flex:1;font-size:13px}
    .dbg-toggle{position:relative;width:36px;height:20px;border-radius:10px;background:var(--toggle-off,#555);cursor:pointer;transition:background .2s;flex-shrink:0}
    .dbg-toggle.active{background:var(--toggle-on,#22c55e)}
    .dbg-toggle::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}
    .dbg-toggle.active::after{transform:translateX(16px)}

    /* Variable Inspector */
    .dbg-var-table{width:100%;border-collapse:collapse;font-size:12px}
    .dbg-var-table th{text-align:left;color:var(--text-secondary,#a0a0a0);padding:6px 8px;border-bottom:1px solid var(--border-color,#404040);font-weight:600;font-size:11px;text-transform:uppercase}
    .dbg-var-table td{padding:6px 8px;border-bottom:1px solid var(--border-color,#404040);vertical-align:top}
    .dbg-var-key{color:var(--accent-blue,#60a5fa);font-family:'Cascadia Code','Fira Code',monospace}
    .dbg-var-val{color:var(--text-primary,#e0e0e0);font-family:'Cascadia Code','Fira Code',monospace;cursor:pointer;word-break:break-word}
    .dbg-var-val:hover{background:var(--bg-row-hover,#333);border-radius:3px}
    .dbg-var-actions{display:flex;gap:4px}
    .dbg-var-delete{color:var(--accent-red,#f87171);cursor:pointer;font-size:14px}
    .dbg-var-delete:hover{color:#ff4444}
    .dbg-var-edit-input{background:var(--bg-input,#333);border:1px solid var(--accent-green,#4ade80);border-radius:3px;color:var(--text-primary);padding:2px 6px;font-size:12px;font-family:'Cascadia Code','Fira Code',monospace;width:100%;outline:none}
    .dbg-json-tree{padding-left:16px}
    .dbg-json-key{color:var(--accent-blue,#60a5fa)}
    .dbg-json-string{color:var(--accent-green,#4ade80)}
    .dbg-json-number{color:var(--accent-yellow,#fbbf24)}
    .dbg-json-bool{color:var(--accent-orange,#fb923c)}
    .dbg-json-null{color:var(--text-muted,#707070)}
    .dbg-json-toggle{cursor:pointer;user-select:none;color:var(--text-secondary)}
    .dbg-json-toggle:hover{color:var(--text-primary)}

    /* Error Timeline */
    .dbg-error-entry{background:var(--bg-row,#2a2a2a);border:1px solid var(--border-color,#404040);border-left:3px solid var(--accent-red,#f87171);border-radius:4px;padding:10px 12px;margin-bottom:6px;cursor:pointer;transition:border-color .15s}
    .dbg-error-entry:hover{border-color:var(--accent-red,#f87171)}
    .dbg-error-time{font-size:10px;color:var(--text-muted,#707070)}
    .dbg-error-msg{font-size:13px;color:var(--accent-red,#f87171);margin:4px 0;font-weight:500}
    .dbg-error-script{font-size:11px;color:var(--accent-purple,#c084fc)}
    .dbg-error-stack{background:var(--bg-body,#1a1a1a);border:1px solid var(--border-color,#404040);border-radius:4px;padding:8px;margin-top:6px;font-family:'Cascadia Code','Fira Code',monospace;font-size:11px;color:var(--text-secondary,#a0a0a0);white-space:pre-wrap;max-height:150px;overflow:auto;display:none}
    .dbg-error-entry.expanded .dbg-error-stack{display:block}
    .dbg-error-line-link{color:var(--accent-blue,#60a5fa);cursor:pointer;text-decoration:underline;font-size:11px}
    .dbg-error-line-link:hover{color:var(--accent-green,#4ade80)}
    .dbg-error-group{margin-bottom:12px}
    .dbg-error-group-title{font-size:12px;font-weight:600;color:var(--accent-purple,#c084fc);padding:6px 0;border-bottom:1px solid var(--border-color,#404040);margin-bottom:6px}
  `;

  /* ── Helpers ────────────────────────────────────────────────────── */

  function injectCSS() {
    if (_container.querySelector('#dbg-style')) return;
    const style = document.createElement('style');
    style.id = 'dbg-style';
    style.textContent = CSS;
    _container.appendChild(style);
  }

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }

  function ensureScript(scriptId) {
    if (!_consoleLogs[scriptId]) _consoleLogs[scriptId] = [];
    if (!_errorTimeline[scriptId]) _errorTimeline[scriptId] = [];
    if (_liveReload[scriptId] === undefined) _liveReload[scriptId] = false;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function formatArgs(args) {
    return args.map(a => {
      if (a === null) return 'null';
      if (a === undefined) return 'undefined';
      if (typeof a === 'object') return JSON.stringify(a, null, 2);
      return String(a);
    }).join(' ');
  }

  function buildJsonTree(value, depth = 0) {
    if (depth > 6) return el('span', { class: 'dbg-json-null', text: '...' });

    if (value === null) return el('span', { class: 'dbg-json-null', text: 'null' });
    if (value === undefined) return el('span', { class: 'dbg-json-null', text: 'undefined' });

    const type = typeof value;

    if (type === 'string') return el('span', { class: 'dbg-json-string', text: `"${value}"` });
    if (type === 'number') return el('span', { class: 'dbg-json-number', text: String(value) });
    if (type === 'boolean') return el('span', { class: 'dbg-json-bool', text: String(value) });

    if (Array.isArray(value)) {
      const container = el('div');
      if (value.length === 0) {
        container.appendChild(el('span', { text: '[]' }));
        return container;
      }
      const toggle = el('span', { class: 'dbg-json-toggle', text: `Array(${value.length}) ` });
      const bracket = el('span', { text: '[\u2026]', style: 'color:var(--text-muted)' });
      const inner = el('div', { class: 'dbg-json-tree', style: 'display:none' });
      value.forEach((item, i) => {
        const row = el('div');
        row.appendChild(el('span', { class: 'dbg-json-key', text: `${i}: ` }));
        row.appendChild(buildJsonTree(item, depth + 1));
        inner.appendChild(row);
      });
      toggle.addEventListener('click', () => {
        const visible = inner.style.display !== 'none';
        inner.style.display = visible ? 'none' : 'block';
        bracket.textContent = visible ? '[\u2026]' : '';
      });
      container.appendChild(toggle);
      container.appendChild(bracket);
      container.appendChild(inner);
      return container;
    }

    if (type === 'object') {
      const container = el('div');
      const keys = Object.keys(value);
      if (keys.length === 0) {
        container.appendChild(el('span', { text: '{}' }));
        return container;
      }
      const toggle = el('span', { class: 'dbg-json-toggle', text: `Object(${keys.length}) ` });
      const bracket = el('span', { text: '{\u2026}', style: 'color:var(--text-muted)' });
      const inner = el('div', { class: 'dbg-json-tree', style: 'display:none' });
      keys.forEach(k => {
        const row = el('div');
        row.appendChild(el('span', { class: 'dbg-json-key', text: `${k}: ` }));
        row.appendChild(buildJsonTree(value[k], depth + 1));
        inner.appendChild(row);
      });
      toggle.addEventListener('click', () => {
        const visible = inner.style.display !== 'none';
        inner.style.display = visible ? 'none' : 'block';
        bracket.textContent = visible ? '{\u2026}' : '';
      });
      container.appendChild(toggle);
      container.appendChild(bracket);
      container.appendChild(inner);
      return container;
    }

    return el('span', { text: String(value) });
  }

  /* ── Rendering ──────────────────────────────────────────────────── */

  function render() {
    const root = _container.querySelector('.dbg-root');
    if (!root) return;
    root.innerHTML = '';

    root.appendChild(renderTabs());

    const panel = el('div', { class: 'dbg-panel' });
    switch (_activeTab) {
      case 'console':  panel.appendChild(renderConsolePanel()); break;
      case 'reload':   panel.appendChild(renderLiveReloadPanel()); break;
      case 'vars':     panel.appendChild(renderVariablePanel()); break;
      case 'errors':   panel.appendChild(renderErrorTimeline()); break;
    }
    root.appendChild(panel);
  }

  function renderTabs() {
    const bar = el('div', { class: 'dbg-tabs' });
    const tabs = [
      { id: 'console', label: 'Console', count: _activeScriptId ? (_consoleLogs[_activeScriptId] || []).filter(e => e.level === 'error').length : 0 },
      { id: 'reload',  label: 'Live Reload' },
      { id: 'vars',    label: 'Variables' },
      { id: 'errors',  label: 'Errors', count: Object.values(_errorTimeline).flat().length },
    ];
    tabs.forEach(t => {
      const tab = el('div', {
        class: 'dbg-tab' + (t.id === _activeTab ? ' active' : ''),
        text: t.label,
      });
      if (t.count) {
        tab.appendChild(el('span', { class: 'badge', text: String(t.count) }));
      }
      tab.addEventListener('click', () => { _activeTab = t.id; render(); });
      bar.appendChild(tab);
    });
    return bar;
  }

  /* ── Console Panel ──────────────────────────────────────────────── */

  function renderConsolePanel() {
    const frag = el('div');

    // Toolbar
    const toolbar = el('div', { class: 'dbg-toolbar' });

    // Script selector
    const scriptIds = Object.keys(_consoleLogs);
    if (scriptIds.length > 0) {
      const sel = el('select', { class: 'dbg-select' });
      sel.appendChild(el('option', { value: '', text: 'Select script...' }));
      scriptIds.forEach(id => {
        const opt = el('option', { value: id, text: id });
        if (id === _activeScriptId) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => { _activeScriptId = sel.value || null; render(); });
      toolbar.appendChild(sel);
    }

    // Level filter buttons
    ['all', 'log', 'warn', 'error'].forEach(level => {
      const btn = el('button', {
        class: 'dbg-btn' + (_consoleFilter === level ? ' active' : ''),
        text: level.charAt(0).toUpperCase() + level.slice(1),
      });
      btn.addEventListener('click', () => { _consoleFilter = level; render(); });
      toolbar.appendChild(btn);
    });

    // Clear button
    const clearBtn = el('button', { class: 'dbg-btn dbg-btn-danger', text: 'Clear' });
    clearBtn.addEventListener('click', () => {
      if (_activeScriptId && _consoleLogs[_activeScriptId]) {
        _consoleLogs[_activeScriptId] = [];
        render();
      }
    });
    toolbar.appendChild(clearBtn);

    frag.appendChild(toolbar);

    // Entries
    const consoleEl = el('div', { class: 'dbg-console' });

    if (!_activeScriptId || !_consoleLogs[_activeScriptId] || _consoleLogs[_activeScriptId].length === 0) {
      consoleEl.appendChild(el('div', { class: 'dbg-empty', text: _activeScriptId ? 'No console entries yet.' : 'Select a script to view its console output.' }));
    } else {
      const entries = _consoleLogs[_activeScriptId].filter(e => _consoleFilter === 'all' || e.level === _consoleFilter);
      entries.forEach(entry => {
        const row = el('div', { class: `dbg-log-entry ${entry.level}` });
        row.appendChild(el('span', { class: 'dbg-log-time', text: formatTime(entry.time) }));
        row.appendChild(el('span', { class: `dbg-log-level ${entry.level}`, text: entry.level }));

        const msgEl = el('div', { class: 'dbg-log-msg' });
        const formattedText = formatArgs(entry.args);

        // Check if any arg is an object for expandable view
        const hasObject = entry.args.some(a => a !== null && typeof a === 'object');
        if (hasObject) {
          const summary = el('span', { class: 'dbg-log-obj', text: formattedText.substring(0, 120) + (formattedText.length > 120 ? '...' : '') });
          const expanded = el('div', { class: 'dbg-log-expanded', style: 'display:none' });
          expanded.textContent = formattedText;
          summary.addEventListener('click', () => {
            expanded.style.display = expanded.style.display === 'none' ? 'block' : 'none';
          });
          msgEl.appendChild(summary);
          msgEl.appendChild(expanded);
        } else {
          msgEl.textContent = formattedText;
        }

        row.appendChild(msgEl);
        consoleEl.appendChild(row);
      });
    }

    frag.appendChild(consoleEl);
    return frag;
  }

  /* ── Live Reload Panel ──────────────────────────────────────────── */

  function renderLiveReloadPanel() {
    const frag = el('div');
    frag.appendChild(el('div', {
      style: 'font-size:12px;color:var(--text-secondary);margin-bottom:12px',
      text: 'When enabled, pages matching a script\'s @match patterns will automatically reload when the script is saved.',
    }));

    const scriptIds = Object.keys(_liveReload);
    if (scriptIds.length === 0) {
      frag.appendChild(el('div', { class: 'dbg-empty', text: 'No scripts registered. Call enableLiveReload(scriptId) to add one.' }));
      return frag;
    }

    scriptIds.forEach(id => {
      const row = el('div', { class: 'dbg-live-row' });
      const name = el('span', { class: 'dbg-live-name', text: id });
      row.appendChild(name);

      if (_liveReload[id]) {
        row.appendChild(el('span', { class: 'dbg-live-badge', text: 'LIVE RELOAD ON' }));
      }

      const toggle = el('div', { class: 'dbg-toggle' + (_liveReload[id] ? ' active' : '') });
      toggle.addEventListener('click', () => {
        _liveReload[id] = !_liveReload[id];
        if (_liveReload[id]) {
          chrome.runtime.sendMessage({ action: 'liveReloadEnabled', scriptId: id });
        } else {
          chrome.runtime.sendMessage({ action: 'liveReloadDisabled', scriptId: id });
        }
        render();
      });
      row.appendChild(toggle);
      frag.appendChild(row);
    });

    return frag;
  }

  /* ── Variable Inspector Panel ───────────────────────────────────── */

  function renderVariablePanel() {
    const frag = el('div');

    // Toolbar
    const toolbar = el('div', { class: 'dbg-toolbar' });

    // Script selector
    const scriptIds = Object.keys(_consoleLogs);
    if (scriptIds.length > 0) {
      const sel = el('select', { class: 'dbg-select' });
      sel.appendChild(el('option', { value: '', text: 'Select script...' }));
      scriptIds.forEach(id => {
        const opt = el('option', { value: id, text: id });
        if (id === _activeScriptId) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => { _activeScriptId = sel.value || null; render(); });
      toolbar.appendChild(sel);
    }

    // Search
    const searchInput = el('input', {
      class: 'dbg-input',
      type: 'text',
      placeholder: 'Search variables...',
      value: _variableSearch,
      style: 'flex:1;min-width:140px',
    });
    searchInput.addEventListener('input', () => { _variableSearch = searchInput.value; renderVariableTable(); });
    toolbar.appendChild(searchInput);

    // Refresh button
    const refreshBtn = el('button', { class: 'dbg-btn', text: 'Refresh' });
    refreshBtn.addEventListener('click', () => renderVariableTable());
    toolbar.appendChild(refreshBtn);

    frag.appendChild(toolbar);

    // Table container (will be populated by renderVariableTable)
    const tableContainer = el('div', { id: 'dbg-var-container' });
    frag.appendChild(tableContainer);

    // Trigger async load
    setTimeout(() => renderVariableTable(), 0);

    return frag;
  }

  function renderVariableTable() {
    const container = _container.querySelector('#dbg-var-container');
    if (!container) return;
    container.innerHTML = '';

    if (!_activeScriptId) {
      container.appendChild(el('div', { class: 'dbg-empty', text: 'Select a script to inspect its GM_getValue store.' }));
      return;
    }

    const vars = getVariableStore(_activeScriptId);
    if (!vars || Object.keys(vars).length === 0) {
      container.appendChild(el('div', { class: 'dbg-empty', text: 'No stored variables found for this script.' }));
      return;
    }

    const table = el('table', { class: 'dbg-var-table' });
    const thead = el('thead');
    const headRow = el('tr');
    headRow.appendChild(el('th', { text: 'Key' }));
    headRow.appendChild(el('th', { text: 'Value' }));
    headRow.appendChild(el('th', { text: '', style: 'width:50px' }));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    const filter = _variableSearch.toLowerCase();

    Object.entries(vars).forEach(([key, value]) => {
      if (filter && !key.toLowerCase().includes(filter)) return;

      const row = el('tr');

      // Key cell
      row.appendChild(el('td', { class: 'dbg-var-key', text: key }));

      // Value cell
      const valCell = el('td', { class: 'dbg-var-val' });
      const isEditing = _editingVar && _editingVar.key === key && _editingVar.scriptId === _activeScriptId;

      if (isEditing) {
        const editInput = el('input', {
          class: 'dbg-var-edit-input',
          type: 'text',
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        });
        editInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            let newVal = editInput.value;
            try { newVal = JSON.parse(newVal); } catch { /* keep as string */ }
            setVariable(_activeScriptId, key, newVal);
            _editingVar = null;
            renderVariableTable();
          } else if (e.key === 'Escape') {
            _editingVar = null;
            renderVariableTable();
          }
        });
        editInput.addEventListener('blur', () => {
          _editingVar = null;
          renderVariableTable();
        });
        valCell.appendChild(editInput);
        setTimeout(() => editInput.focus(), 0);
      } else if (typeof value === 'object' && value !== null) {
        valCell.appendChild(buildJsonTree(value));
      } else {
        valCell.textContent = value === null ? 'null' : value === undefined ? 'undefined' : String(value);
        valCell.addEventListener('click', () => {
          _editingVar = { key, scriptId: _activeScriptId };
          renderVariableTable();
        });
      }
      row.appendChild(valCell);

      // Actions cell
      const actionsCell = el('td', { class: 'dbg-var-actions' });
      if (!isEditing && (typeof value !== 'object' || value === null)) {
        const editBtn = el('span', {
          text: '\u270e',
          style: 'cursor:pointer;color:var(--accent-blue);font-size:14px',
          title: 'Edit value',
        });
        editBtn.addEventListener('click', e => {
          e.stopPropagation();
          _editingVar = { key, scriptId: _activeScriptId };
          renderVariableTable();
        });
        actionsCell.appendChild(editBtn);
      }
      const delBtn = el('span', {
        class: 'dbg-var-delete',
        text: '\u00d7',
        title: 'Delete variable',
      });
      delBtn.addEventListener('click', () => {
        deleteVariable(_activeScriptId, key);
        renderVariableTable();
      });
      actionsCell.appendChild(delBtn);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  /* ── Error Timeline Panel ───────────────────────────────────────── */

  function renderErrorTimeline() {
    const frag = el('div');

    const allErrors = [];
    Object.entries(_errorTimeline).forEach(([scriptId, errors]) => {
      errors.forEach(err => allErrors.push({ ...err, scriptId }));
    });
    allErrors.sort((a, b) => b.time - a.time);

    if (allErrors.length === 0) {
      frag.appendChild(el('div', { class: 'dbg-empty', text: 'No errors recorded. Errors will appear here as they occur.' }));
      return frag;
    }

    // Toolbar
    const toolbar = el('div', { class: 'dbg-toolbar' });
    const clearBtn = el('button', { class: 'dbg-btn dbg-btn-danger', text: 'Clear All' });
    clearBtn.addEventListener('click', () => {
      Object.keys(_errorTimeline).forEach(k => _errorTimeline[k] = []);
      render();
    });
    toolbar.appendChild(el('span', {
      style: 'font-size:12px;color:var(--text-secondary)',
      text: `${allErrors.length} error${allErrors.length !== 1 ? 's' : ''} recorded`,
    }));
    toolbar.appendChild(clearBtn);
    frag.appendChild(toolbar);

    // Group by script
    const grouped = {};
    allErrors.forEach(err => {
      if (!grouped[err.scriptId]) grouped[err.scriptId] = [];
      grouped[err.scriptId].push(err);
    });

    Object.entries(grouped).forEach(([scriptId, errors]) => {
      const group = el('div', { class: 'dbg-error-group' });
      group.appendChild(el('div', { class: 'dbg-error-group-title', text: `${scriptId} (${errors.length})` }));

      errors.forEach(err => {
        const entry = el('div', { class: 'dbg-error-entry' });

        const header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center' });
        header.appendChild(el('span', { class: 'dbg-error-time', text: formatTime(err.time) }));
        if (err.line) {
          const lineLink = el('span', {
            class: 'dbg-error-line-link',
            text: `Line ${err.line}`,
          });
          lineLink.addEventListener('click', e => {
            e.stopPropagation();
            if (typeof _onJumpToLine === 'function') {
              _onJumpToLine(err.scriptId, err.line);
            }
          });
          header.appendChild(lineLink);
        }
        entry.appendChild(header);
        entry.appendChild(el('div', { class: 'dbg-error-msg', text: err.message }));

        if (err.stack) {
          const stackEl = el('div', { class: 'dbg-error-stack', text: err.stack });
          entry.appendChild(stackEl);
        }

        entry.addEventListener('click', () => entry.classList.toggle('expanded'));
        group.appendChild(entry);
      });

      frag.appendChild(group);
    });

    return frag;
  }

  /* ── Storage abstraction (chrome.storage or localStorage fallback) */

  function getVariableStore(scriptId) {
    const prefix = `SV_GM_${scriptId}_`;
    const result = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const varName = key.slice(prefix.length);
          try {
            result[varName] = JSON.parse(localStorage.getItem(key));
          } catch {
            result[varName] = localStorage.getItem(key);
          }
        }
      }
    } catch {
      // In extension context, might use chrome.storage — handled by caller
    }
    return result;
  }

  function setVariable(scriptId, key, value) {
    if (!scriptId) return;
    const storeKey = `SV_GM_${scriptId}_${key}`;
    try {
      localStorage.setItem(storeKey, JSON.stringify(value));
    } catch { /* silent */ }
  }

  function deleteVariable(scriptId, key) {
    const storeKey = `SV_GM_${scriptId}_${key}`;
    try {
      localStorage.removeItem(storeKey);
    } catch { /* silent */ }
  }

  /* ── Background messaging ───────────────────────────────────────── */

  let _onJumpToLine = null;

  function notifyBackground(action, scriptId) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'ScriptDebugger', action, scriptId });
      }
    } catch { /* not in extension context */ }
  }

  /* ── Console interception wrapper ───────────────────────────────── */

  function createConsoleProxy(scriptId) {
    ensureScript(scriptId);
    const original = {};
    const levels = ['log', 'info', 'warn', 'error'];

    levels.forEach(level => {
      original[level] = console[level].bind(console);
    });

    const proxy = {};
    levels.forEach(level => {
      proxy[level] = (...args) => {
        // Store entry
        const entries = _consoleLogs[scriptId];
        entries.push({
          level,
          args: args.map(a => {
            try {
              if (typeof a === 'object' && a !== null) return JSON.parse(JSON.stringify(a));
              return a;
            } catch { return String(a); }
          }),
          time: Date.now(),
        });
        // Trim to max
        while (entries.length > MAX_CONSOLE_ENTRIES) entries.shift();
        // Pass through to real console
        original[level](...args);
        // Re-render if console tab is active
        if (_activeTab === 'console' && _activeScriptId === scriptId) {
          render();
        }
      };
    });

    return proxy;
  }

  /* ── Public API ─────────────────────────────────────────────────── */

  return {
    /**
     * Initialize the debugger inside a container element.
     * @param {HTMLElement} containerEl
     * @param {Object} [options]
     * @param {Function} [options.onJumpToLine] — callback(scriptId, lineNumber)
     */
    init(containerEl, options = {}) {
      _container = containerEl;
      _onJumpToLine = options.onJumpToLine || null;
      _activeTab = 'console';
      _consoleFilter = 'all';
      _variableSearch = '';
      _editingVar = null;

      injectCSS();
      const root = el('div', { class: 'dbg-root' });
      _container.appendChild(root);
      render();

      // Auto-refresh variable inspector
      _variableRefreshTimer = setInterval(() => {
        if (_activeTab === 'vars' && _activeScriptId) {
          renderVariableTable();
        }
      }, VARIABLE_REFRESH_MS);
    },

    /**
     * Begin capturing console output for a script.
     * Returns a console-like proxy object { log, info, warn, error }.
     * Wrap the target script's console calls with this proxy.
     * @param {string} scriptId
     * @returns {{ log: Function, info: Function, warn: Function, error: Function }}
     */
    captureConsole(scriptId) {
      ensureScript(scriptId);
      if (!_activeScriptId) _activeScriptId = scriptId;
      return createConsoleProxy(scriptId);
    },

    /**
     * Enable live reload for a script.
     * When enabled, saving the script will send a message to the background
     * to reload tabs matching the script's @match patterns.
     * @param {string} scriptId
     * @param {boolean} [enabled=true]
     */
    enableLiveReload(scriptId, enabled = true) {
      ensureScript(scriptId);
      _liveReload[scriptId] = enabled;
      if (enabled) notifyBackground('liveReloadEnabled', scriptId);
      if (_activeTab === 'reload') render();
    },

    /**
     * Get the GM_getValue variable store for a script.
     * @param {string} scriptId
     * @returns {Object} key-value map
     */
    getVariables(scriptId) {
      return getVariableStore(scriptId);
    },

    /**
     * Get the error timeline for a script (or all scripts if no id).
     * @param {string} [scriptId]
     * @returns {Array} errors sorted newest-first
     */
    getErrorTimeline(scriptId) {
      if (scriptId) return (_errorTimeline[scriptId] || []).slice().reverse();
      const all = [];
      Object.entries(_errorTimeline).forEach(([sid, errors]) => {
        errors.forEach(e => all.push({ ...e, scriptId: sid }));
      });
      return all.sort((a, b) => b.time - a.time);
    },

    /**
     * Record an error for a script. Used by the script execution wrapper.
     * @param {string} scriptId
     * @param {Object} error — { message, stack, line }
     */
    recordError(scriptId, error) {
      ensureScript(scriptId);
      const entries = _errorTimeline[scriptId];
      entries.push({
        message: error.message || String(error),
        stack: error.stack || '',
        line: error.line || null,
        time: Date.now(),
      });
      while (entries.length > MAX_ERRORS) entries.shift();
      if (_activeTab === 'errors') render();
    },

    /**
     * Notify the debugger that a script was saved (triggers live reload).
     * @param {string} scriptId
     */
    onScriptSaved(scriptId) {
      if (_liveReload[scriptId]) {
        notifyBackground('reloadTabs', scriptId);
      }
    },

    /**
     * Set the callback for "jump to line" in error timeline.
     * @param {Function} fn — receives (scriptId, lineNumber)
     */
    onJumpToLine(fn) {
      _onJumpToLine = fn;
    },

    setOnJumpToLine(fn) {
      _onJumpToLine = fn;
    },

    /**
     * Tear down the debugger and remove DOM.
     */
    destroy() {
      if (_variableRefreshTimer) {
        clearInterval(_variableRefreshTimer);
        _variableRefreshTimer = null;
      }
      if (_container) {
        const root = _container.querySelector('.dbg-root');
        if (root) root.remove();
        const style = _container.querySelector('#dbg-style');
        if (style) style.remove();
      }
      _container = null;
      _consoleLogs = {};
      _liveReload = {};
      _errorTimeline = {};
      _activeScriptId = null;
      _editingVar = null;
      _onJumpToLine = null;
    },
  };
})();

/* Export for module environments; noop in plain browser context */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScriptDebugger;
}
