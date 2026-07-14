// ScriptVault — CSP Compatibility Reporter Module
// Tracks Content Security Policy failures, reports affected sites/scripts,
// suggests workarounds, and provides per-site CSP bypass toggles.

const CSPReporter = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_csp_reports';
  const BYPASS_KEY = 'sv_csp_bypass';
  const STYLE_ID = 'sv-csp-styles';
  const MAX_ENTRIES = 500;

  const SEVERITY = {
    'script-src':  { level: 3, label: 'High',   color: 'var(--accent-red, #f87171)' },
    'connect-src': { level: 2, label: 'Medium', color: 'var(--accent-orange, #fb923c)' },
    'style-src':   { level: 1, label: 'Low',    color: 'var(--accent-yellow, #fbbf24)' },
    'default-src': { level: 3, label: 'High',   color: 'var(--accent-red, #f87171)' },
    'img-src':     { level: 1, label: 'Low',    color: 'var(--accent-yellow, #fbbf24)' },
    'font-src':    { level: 1, label: 'Low',    color: 'var(--accent-yellow, #fbbf24)' },
    'worker-src':  { level: 2, label: 'Medium', color: 'var(--accent-orange, #fb923c)' },
    'frame-src':   { level: 2, label: 'Medium', color: 'var(--accent-orange, #fb923c)' }
  };

  const SUGGESTIONS = {
    'script-src': [
      {
        title: 'Use chrome.scripting API',
        description: 'Instead of injecting <script> tags, use chrome.scripting.executeScript() from the extension background to bypass script-src restrictions.',
        code: `chrome.scripting.executeScript({\n  target: { tabId },\n  func: myFunction,\n  world: 'MAIN'\n});`
      },
      {
        title: 'Use Function() constructor via extension context',
        description: 'Execute code from the isolated content script world where CSP does not apply to extension-injected scripts.',
        code: `// In content script (isolated world)\nconst result = new Function('return ' + expression)();`
      }
    ],
    'connect-src': [
      {
        title: 'Use GM_xmlhttpRequest',
        description: 'Tampermonkey/ScriptVault GM_xmlhttpRequest bypasses CSP connect-src by routing requests through the extension background.',
        code: `GM_xmlhttpRequest({\n  method: 'GET',\n  url: 'https://api.example.com/data',\n  onload: (resp) => console.log(resp.responseText)\n});`
      },
      {
        title: 'Use chrome.runtime.sendMessage relay',
        description: 'Route fetch requests through the background service worker which is not subject to page CSP.',
        code: `// Content script\nchrome.runtime.sendMessage(\n  { action: 'fetch', url: 'https://...' },\n  (response) => { /* handle */ }\n);`
      }
    ],
    'style-src': [
      {
        title: 'Use GM_addStyle with nonce injection',
        description: 'GM_addStyle injects styles via the extension context. If a nonce is available on the page, it can be attached to the style element.',
        code: `// Auto-detect nonce from existing styles\nconst nonce = document.querySelector('style[nonce]')?.nonce;\nconst style = GM_addStyle(css);\nif (nonce) style.nonce = nonce;`
      },
      {
        title: 'Use CSSStyleSheet.insertRule()',
        description: 'Programmatically add rules to an existing stylesheet instead of creating new style elements.',
        code: `const sheet = document.styleSheets[0];\nsheet.insertRule('.my-class { color: red; }', sheet.cssRules.length);`
      }
    ],
    'default-src': [
      {
        title: 'Use extension-context injection',
        description: 'When default-src is restrictive, all resource types are affected. Use the extension isolated world for script execution and chrome.runtime messaging for network requests.',
        code: `// Execute in isolated world (bypasses page CSP)\nchrome.scripting.executeScript({\n  target: { tabId },\n  files: ['my-script.js'],\n  world: 'ISOLATED'\n});`
      }
    ]
  };

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _reports = [];        // { id, url, hostname, scriptId, scriptName, directive, detail, timestamp }
  let _bypassSettings = {}; // { hostname: { enabled, directives[], ruleId } }
  let _sortBy = 'timestamp';
  let _sortAsc = false;
  let _filter = '';
  let _initialized = false;

  const _safeSetHtml = (typeof window.ScriptVaultDashboardUI?.safeSetHtml === 'function')
      ? window.ScriptVaultDashboardUI.safeSetHtml
      : (el, html) => {
        { const _r = document.createRange(); _r.selectNodeContents(el); el.replaceChildren(_r.createContextualFragment(String(html ?? ''))); }
      };

  // CSP-RULEID — sequential DNR ruleId allocator (replaces the legacy
  // hashCode-based allocation which suffered birthday-paradox collisions
  // at ~20 bypass hostnames within a 100K-ID pool). _ruleIdCounter is
  // derived on load from the max existing ruleId so a fresh install
  // starts at RULE_ID_BASE and an upgraded install picks up where it
  // left off without colliding with any previously-allocated rule.
  const RULE_ID_BASE = 900000;
  const RULE_ID_MAX = 999999999;  // bounded so dynamic-rule space stays comfortably clear of other DNR users
  let _ruleIdCounter = RULE_ID_BASE;
  let _legacyReconciled = false;  // one-shot per-page-load cleanup of pre-fix hash-allocated rules

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* CSP Reporter Container */
.sv-csp-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.sv-csp-toolbar-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-inline-end: auto;
}
.sv-csp-search {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #404040);
  border-radius: var(--sv-radius-control);
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 0.75rem;
  width: 200px;
  outline: none;
  transition: border-color 0.15s;
}
.sv-csp-search:focus {
  border-color: var(--accent-green, #4ade80);
}
.sv-csp-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.sv-csp-btn:hover {
  background: var(--bg-row-hover, #333);
  border-color: var(--accent-green, #4ade80);
}
.sv-csp-btn.primary {
  background: var(--accent-green-dark, #22c55e);
  border-color: var(--accent-green-dark, #22c55e);
  color: var(--sv-text-on-accent);
}
.sv-csp-btn.primary:hover {
  background: var(--accent-green, #4ade80);
}
.sv-csp-btn.danger {
  border-color: var(--accent-red, #f87171);
  color: var(--accent-red, #f87171);
}
.sv-csp-btn.danger:hover {
  background: rgba(248, 113, 113, 0.15);
}

/* Summary Cards */
.sv-csp-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.sv-csp-stat {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.sv-csp-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #e0e0e0);
}
.sv-csp-stat-label {
  font-size: 0.6875rem;
  color: var(--text-muted, #707070);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Table */
.sv-csp-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
}
.sv-csp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}
.sv-csp-table th {
  background: var(--bg-header, #252525);
  color: var(--text-secondary, #a0a0a0);
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 12px;
  text-align: start;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  border-bottom: 1px solid var(--border-color, #404040);
  transition: color 0.15s;
}
.sv-csp-table th:hover {
  color: var(--text-primary, #e0e0e0);
}
.sv-csp-table th.sorted {
  color: var(--accent-green, #4ade80);
}
.sv-csp-table th .sort-arrow {
  margin-inline-start: 4px;
  font-size: 0.625rem;
}
.sv-csp-table td {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: var(--text-primary, #e0e0e0);
  vertical-align: middle;
}
.sv-csp-table tr:hover td {
  background: var(--bg-row-hover, #333);
}
.sv-csp-table tr:last-child td {
  border-bottom: none;
}

/* Severity badge */
.sv-csp-severity {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Directive pill */
.sv-csp-directive {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.6875rem;
  background: rgba(255,255,255,0.06);
  padding: 2px 6px;
  border-radius: var(--sv-radius-sm);
}

/* Expandable suggestion row */
.sv-csp-suggestion-row {
  display: none;
}
.sv-csp-suggestion-row.visible {
  display: table-row;
}
.sv-csp-suggestion-row td {
  background: var(--bg-header, #252525);
  padding: 12px 16px;
}
.sv-csp-suggestion-card {
  background: var(--bg-row, #2a2a2a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}
.sv-csp-suggestion-card:last-child {
  margin-bottom: 0;
}
.sv-csp-suggestion-title {
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--accent-blue, #60a5fa);
  margin-bottom: 4px;
}
.sv-csp-suggestion-desc {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 8px;
  line-height: 1.4;
}
.sv-csp-suggestion-code {
  background: var(--bg-body, #1a1a1a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 4px;
  padding: 8px 10px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.6875rem;
  color: var(--accent-green, #4ade80);
  white-space: pre-wrap;
  overflow-x: auto;
  line-height: 1.5;
}

/* Bypass settings panel */
.sv-csp-bypass-panel {
  margin-top: 16px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 8px;
  overflow: hidden;
}
.sv-csp-bypass-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border: 0;
  background: var(--bg-header, #252525);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  user-select: none;
}
.sv-csp-bypass-header h4 {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin: 0;
}
.sv-csp-bypass-body {
  padding: 12px 14px;
  display: none;
}
.sv-csp-bypass-body.visible {
  display: block;
}
.sv-csp-bypass-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid var(--accent-yellow, #fbbf24);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 0.75rem;
  color: var(--accent-yellow, #fbbf24);
  line-height: 1.4;
}
.sv-csp-warning-mark {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(251, 191, 36, 0.48);
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 800;
  line-height: 1;
}
.sv-csp-bypass-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 0.75rem;
}
.sv-csp-bypass-row:last-child {
  border-bottom: none;
}
.sv-csp-bypass-host {
  flex: 1;
  color: var(--text-primary, #e0e0e0);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.6875rem;
}
.sv-csp-bypass-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border: 0;
  border-radius: 10px;
  background: var(--toggle-off, #555);
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;
}
.sv-csp-bypass-toggle:focus-visible {
  outline: 2px solid var(--accent-green, #4ade80);
  outline-offset: 2px;
}
.sv-csp-bypass-toggle.on {
  background: var(--toggle-on, #22c55e);
}
.sv-csp-bypass-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 6px;
  background: var(--sv-control-thumb);
  transition: transform 0.2s;
}
.sv-csp-bypass-toggle.on::after {
  transform: translateX(16px);
}
.sv-csp-bypass-toggle:disabled {
  cursor: wait;
  opacity: 0.65;
}
.sv-csp-empty-inline {
  color: var(--text-muted, #707070);
  font-size: 0.75rem;
  text-align: center;
  padding: 16px;
}

/* Empty state */
.sv-csp-empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted, #707070);
}
.sv-csp-empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}
.sv-csp-empty-text {
  font-size: 0.875rem;
}

/* Toast */
.sv-csp-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--bg-header, #252525);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--accent-green-dark, #22c55e);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.8125rem;
  z-index: 10001;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  animation: sv-csp-fadein 0.2s ease;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(420px, calc(100vw - 48px));
}
.sv-csp-toast-action {
  border: 1px solid var(--accent-green-dark, #22c55e);
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent-green, #22c55e) 16%, transparent);
  color: var(--accent-green, #22c55e);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 4px 8px;
}
.sv-csp-toast-action:focus-visible {
  outline: 2px solid var(--accent-green, #22c55e);
  outline-offset: 2px;
}
@keyframes sv-csp-fadein {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function generateId() {
    return 'csp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    // Escapes quotes too so values interpolated into attributes can't break out.
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeSelectorValue(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(String(value));
    }
    return String(value).replace(/"/g, '\\"');
  }

  function extractHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url || 'unknown';
    }
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return d.toLocaleDateString();
  }

  function showToast(msg, options = 2500) {
    const config = typeof options === 'number' ? { duration: options } : options;
    const duration = config.duration ?? 2500;
    const existing = document.querySelector('.sv-csp-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'sv-csp-toast';
    const text = document.createElement('span');
    text.textContent = msg;
    el.appendChild(text);
    if (config.actionLabel && typeof config.onAction === 'function') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sv-csp-toast-action';
      button.textContent = config.actionLabel;
      button.addEventListener('click', () => {
        clearTimeout(timer);
        el.remove();
        config.onAction();
      });
      el.appendChild(button);
    }
    document.body.appendChild(el);
    const timer = setTimeout(() => el.remove(), duration);
  }

  function getSeverity(directive) {
    return SEVERITY[directive] || { level: 1, label: 'Low', color: 'var(--text-muted, #707070)' };
  }

  /* ------------------------------------------------------------------ */
  /*  Storage                                                            */
  /* ------------------------------------------------------------------ */

  async function loadReports() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, BYPASS_KEY]);
      _reports = data[STORAGE_KEY] || [];
      _bypassSettings = data[BYPASS_KEY] || {};
    } catch {
      _reports = [];
      _bypassSettings = {};
    }
    // CSP-RULEID — derive the next counter value from the max stored
    // ruleId so subsequent allocations never collide with any rule we
    // already installed (across page reloads or SW wakes). Entries
    // without a ruleId are legacy — they'll get one assigned on first
    // apply, and the legacy hash-allocated DNR rule will be swept on the
    // next reconcile pass below.
    let maxId = RULE_ID_BASE;
    for (const entry of Object.values(_bypassSettings)) {
      if (entry && Number.isFinite(entry.ruleId)) {
        maxId = Math.max(maxId, entry.ruleId);
      }
    }
    _ruleIdCounter = maxId;
  }

  // CSP-RULEID — allocate the next sequential DNR rule ID. Bounded so the
  // pool stays comfortably clear of other DNR-using extensions / app
  // logic. If we ever reach RULE_ID_MAX (unlikely — would require ~100M
  // bypass rules) we throw rather than wrap; wrapping would collide with
  // the lowest-allocated rules.
  function _allocRuleId() {
    _ruleIdCounter += 1;
    if (_ruleIdCounter > RULE_ID_MAX) {
      throw new Error('[CSPReporter] DNR rule ID pool exhausted');
    }
    return _ruleIdCounter;
  }

  // CSP-RULEID — one-shot pass that removes any DNR dynamic rule in our
  // legacy hash-allocated range (900000..999999) that doesn't correspond
  // to a known entry's stored ruleId. Cleans up orphans left by the
  // pre-fix hashCode() allocation so the live DNR state matches storage.
  async function _reconcileLegacyRules() {
    if (_legacyReconciled) return;
    _legacyReconciled = true;
    try {
      const live = await chrome.declarativeNetRequest.getDynamicRules();
      const knownIds = new Set();
      for (const entry of Object.values(_bypassSettings)) {
        if (entry && Number.isFinite(entry.ruleId)) knownIds.add(entry.ruleId);
      }
      const stale = live
        .filter(r => r && Number.isFinite(r.id) && r.id >= 900000 && r.id <= 999999)
        .filter(r => !knownIds.has(r.id))
        .map(r => r.id);
      if (stale.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: stale });
      }
    } catch (e) {
      // Reconcile is best-effort — never block the apply/remove flow on it.
      console.warn('[CSPReporter] legacy-rule reconcile failed:', e?.message || e);
    }
  }

  async function saveReports() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _reports.slice(-MAX_ENTRIES) });
    } catch (e) {
      console.error('[CSPReporter] save reports error:', e);
    }
  }

  async function restoreClearedReports(clearedReports) {
    const existingIds = new Set(_reports.map(r => r.id));
    const restored = clearedReports.filter(r => !existingIds.has(r.id));
    _reports = [...restored, ..._reports].slice(-MAX_ENTRIES);
    await saveReports();
    render();
    showToast(`${restored.length} CSP report${restored.length === 1 ? '' : 's'} restored`);
  }

  async function clearAllReports() {
    const clearedReports = _reports.slice();
    if (clearedReports.length === 0) {
      showToast('No CSP reports to clear');
      return;
    }
    _reports = [];
    await saveReports();
    render();
    showToast(`${clearedReports.length} CSP report${clearedReports.length === 1 ? '' : 's'} cleared`, {
      duration: 8000,
      actionLabel: 'Undo',
      onAction: () => restoreClearedReports(clearedReports),
    });
  }

  async function saveBypass() {
    try {
      await chrome.storage.local.set({ [BYPASS_KEY]: _bypassSettings });
    } catch (e) {
      console.error('[CSPReporter] save bypass error:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  function render() {
    if (!_container) return;
    _container.replaceChildren();

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'sv-csp-toolbar';
    _safeSetHtml(toolbar, `
      <span class="sv-csp-toolbar-title">CSP Compatibility Report</span>
      <input type="text" class="sv-csp-search" placeholder="Filter by site or script\u2026" value="${escapeHtml(_filter)}">
      <button class="sv-csp-btn" data-action="export-csv">CSV</button>
      <button class="sv-csp-btn" data-action="export-json">JSON</button>
      <button class="sv-csp-btn danger" data-action="clear">Clear All</button>
    `);
    _container.appendChild(toolbar);

    const searchInput = toolbar.querySelector('.sv-csp-search');
    searchInput.addEventListener('input', () => {
      _filter = searchInput.value.trim().toLowerCase();
      renderTable();
    });
    toolbar.querySelector('[data-action="export-csv"]').addEventListener('click', () => downloadExport('csv'));
    toolbar.querySelector('[data-action="export-json"]').addEventListener('click', () => downloadExport('json'));
    toolbar.querySelector('[data-action="clear"]').addEventListener('click', () => clearAllReports());

    // Summary
    renderSummary();

    // Table container
    const tableWrap = document.createElement('div');
    tableWrap.id = 'sv-csp-table-container';
    _container.appendChild(tableWrap);
    renderTable();

    // Bypass panel
    renderBypassPanel();
  }

  function renderSummary() {
    const sites = new Set(_reports.map(r => r.hostname));
    const scripts = new Set(_reports.map(r => r.scriptId).filter(Boolean));
    const high = _reports.filter(r => getSeverity(r.directive).level === 3).length;
    const medium = _reports.filter(r => getSeverity(r.directive).level === 2).length;

    const summary = document.createElement('div');
    summary.className = 'sv-csp-summary';
    _safeSetHtml(summary, `
      <div class="sv-csp-stat">
        <div class="sv-csp-stat-value">${_reports.length}</div>
        <div class="sv-csp-stat-label">Total Issues</div>
      </div>
      <div class="sv-csp-stat">
        <div class="sv-csp-stat-value">${sites.size}</div>
        <div class="sv-csp-stat-label">Sites Affected</div>
      </div>
      <div class="sv-csp-stat">
        <div class="sv-csp-stat-value">${scripts.size}</div>
        <div class="sv-csp-stat-label">Scripts Affected</div>
      </div>
      <div class="sv-csp-stat">
        <div class="sv-csp-stat-value" style="color:var(--accent-red)">${high}</div>
        <div class="sv-csp-stat-label">High Severity</div>
      </div>
      <div class="sv-csp-stat">
        <div class="sv-csp-stat-value" style="color:var(--accent-orange)">${medium}</div>
        <div class="sv-csp-stat-label">Medium Severity</div>
      </div>
    `);
    _container.appendChild(summary);
  }

  function renderTable() {
    const wrap = document.getElementById('sv-csp-table-container') || _container;

    // Aggregate reports by hostname + directive
    const aggregated = aggregateReports();

    let filtered = aggregated;
    if (_filter) {
      filtered = aggregated.filter(r =>
        r.hostname.includes(_filter) ||
        r.directive.includes(_filter) ||
        r.scriptNames.toLowerCase().includes(_filter)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (_sortBy) {
        case 'site':      cmp = a.hostname.localeCompare(b.hostname); break;
        case 'directive': cmp = a.directive.localeCompare(b.directive); break;
        case 'severity':  cmp = getSeverity(b.directive).level - getSeverity(a.directive).level; break;
        case 'count':     cmp = b.count - a.count; break;
        case 'timestamp': cmp = b.lastSeen - a.lastSeen; break;
        default:          cmp = b.lastSeen - a.lastSeen;
      }
      return _sortAsc ? -cmp : cmp;
    });

    if (filtered.length === 0) {
      _safeSetHtml(wrap, `
        <div class="sv-csp-empty">
          <div class="sv-csp-empty-icon" aria-hidden="true">CSP</div>
          <div class="sv-csp-empty-text">${_filter ? 'No issues match your filter.' : 'No CSP issues recorded yet.'}</div>
        </div>
      `);
      return;
    }

    const columns = [
      { key: 'site',      label: 'Site' },
      { key: 'directive', label: 'CSP Issue' },
      { key: 'severity',  label: 'Severity' },
      { key: 'scripts',   label: 'Affected Scripts' },
      { key: 'count',     label: 'Count' },
      { key: 'timestamp', label: 'Last Seen' }
    ];

    let html = '<div class="sv-csp-table-wrap"><table class="sv-csp-table"><thead><tr>';
    for (const col of columns) {
      const sorted = _sortBy === col.key;
      const arrow = sorted ? (_sortAsc ? '\u25B2' : '\u25BC') : '';
      html += `<th class="${sorted ? 'sorted' : ''}" data-sort="${col.key}">${col.label}<span class="sort-arrow">${arrow}</span></th>`;
    }
    html += '<th style="width:60px">Fix</th></tr></thead><tbody>';

    for (const row of filtered) {
      const sev = getSeverity(row.directive);
      html += `
        <tr data-row-id="${escapeHtml(row.key)}">
          <td><span class="sv-csp-directive">${escapeHtml(row.hostname)}</span></td>
          <td><span class="sv-csp-directive">${escapeHtml(row.directive)}</span></td>
          <td><span class="sv-csp-severity" style="background:${sev.color};color:#000">${sev.label}</span></td>
          <td>${escapeHtml(row.scriptNames)}</td>
          <td>${row.count}</td>
          <td>${formatDate(row.lastSeen)}</td>
          <td><button class="sv-csp-btn" data-show-fix="${escapeHtml(row.directive)}" data-row="${escapeHtml(row.key)}" style="padding:3px 8px;font-size:0.625rem">View Fix</button></td>
        </tr>
        <tr class="sv-csp-suggestion-row" data-suggestion-for="${escapeHtml(row.key)}">
          <td colspan="7">${renderSuggestions(row.directive)}</td>
        </tr>
      `;
    }

    html += '</tbody></table></div>';
    _safeSetHtml(wrap, html);

    // Sort handlers
    wrap.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (_sortBy === key) {
          _sortAsc = !_sortAsc;
        } else {
          _sortBy = key;
          _sortAsc = false;
        }
        renderTable();
      });
    });

    // Fix button handlers
    wrap.querySelectorAll('[data-show-fix]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowKey = btn.dataset.row;
        const suggRow = wrap.querySelector(`[data-suggestion-for="${escapeSelectorValue(rowKey)}"]`);
        if (suggRow) suggRow.classList.toggle('visible');
      });
    });
  }

  function aggregateReports() {
    const map = {};
    for (const r of _reports) {
      const key = `${r.hostname}||${r.directive}`;
      if (!map[key]) {
        map[key] = {
          key,
          hostname: r.hostname,
          directive: r.directive,
          scriptIds: new Set(),
          scriptNamesList: [],
          count: 0,
          lastSeen: r.timestamp
        };
      }
      map[key].count++;
      if (r.scriptId && !map[key].scriptIds.has(r.scriptId)) {
        map[key].scriptIds.add(r.scriptId);
        map[key].scriptNamesList.push(r.scriptName || r.scriptId);
      }
      if (r.timestamp > map[key].lastSeen) {
        map[key].lastSeen = r.timestamp;
      }
    }

    return Object.values(map).map(v => ({
      ...v,
      scriptNames: v.scriptNamesList.join(', ')
    }));
  }

  function renderSuggestions(directive) {
    const suggestions = getSuggestions(directive);
    if (suggestions.length === 0) {
      return '<div style="color:var(--text-muted);font-size:0.75rem">No specific workarounds available for this directive.</div>';
    }
    return suggestions.map(s => `
      <div class="sv-csp-suggestion-card">
        <div class="sv-csp-suggestion-title">${escapeHtml(s.title)}</div>
        <div class="sv-csp-suggestion-desc">${escapeHtml(s.description)}</div>
        <div class="sv-csp-suggestion-code">${escapeHtml(s.code)}</div>
      </div>
    `).join('');
  }

  /* ------------------------------------------------------------------ */
  /*  Bypass Panel                                                       */
  /* ------------------------------------------------------------------ */

  function setBypassRowState(row, host, enabled) {
    const tog = row.querySelector('.sv-csp-bypass-toggle');
    const state = row.querySelector('.sv-csp-bypass-state');
    if (tog) {
      tog.classList.toggle('on', enabled);
      tog.setAttribute('aria-checked', String(enabled));
      tog.setAttribute('aria-label', `${enabled ? 'Disable' : 'Enable'} CSP bypass for ${host}`);
    }
    if (state) state.textContent = enabled ? 'Bypass ON' : 'Bypass OFF';
  }

  function renderBypassPanel() {
    const hostnames = [...new Set(_reports.map(r => r.hostname))].sort();

    const panel = document.createElement('div');
    panel.className = 'sv-csp-bypass-panel';

    const headerEl = document.createElement('button');
    headerEl.className = 'sv-csp-bypass-header';
    headerEl.type = 'button';
    headerEl.setAttribute('aria-expanded', 'false');
    headerEl.setAttribute('aria-controls', 'svCspBypassBody');
    _safeSetHtml(headerEl, `
      <h4>CSP Bypass Settings</h4>
      <span class="sv-csp-bypass-caret" style="color:var(--text-muted);font-size:0.6875rem" aria-hidden="true">\u25BC</span>
    `);
    panel.appendChild(headerEl);

    const body = document.createElement('div');
    body.id = 'svCspBypassBody';
    body.className = 'sv-csp-bypass-body';

    _safeSetHtml(body, `
      <div class="sv-csp-bypass-warning" role="alert">
        <span class="sv-csp-warning-mark" aria-hidden="true">!</span>
        <span><strong>Security warning.</strong> Stripping CSP headers removes important browser protections. Only enable bypass for sites where you trust the scripts you are running. ScriptVault uses declarativeNetRequest to remove Content-Security-Policy headers for the selected host.</span>
      </div>
    `);

    if (hostnames.length === 0) {
      const _emptyDiv = document.createElement('div');
      _emptyDiv.className = 'sv-csp-empty-inline';
      _emptyDiv.textContent = 'No sites with CSP issues recorded.';
      body.appendChild(_emptyDiv);
    } else {
      for (const host of hostnames) {
        const isEnabled = _bypassSettings[host] && _bypassSettings[host].enabled;
        const row = document.createElement('div');
        row.className = 'sv-csp-bypass-row';
        _safeSetHtml(row, `
          <span class="sv-csp-bypass-host">${escapeHtml(host)}</span>
          <span class="sv-csp-bypass-state" style="font-size:0.6875rem;color:var(--text-muted)">${isEnabled ? 'Bypass ON' : 'Bypass OFF'}</span>
          <button type="button" class="sv-csp-bypass-toggle ${isEnabled ? 'on' : ''}" data-bypass-host="${escapeHtml(host)}" role="switch" aria-checked="${isEnabled ? 'true' : 'false'}" aria-label="${isEnabled ? 'Disable' : 'Enable'} CSP bypass for ${escapeHtml(host)}"></button>
        `);
        body.appendChild(row);

        row.querySelector('.sv-csp-bypass-toggle').addEventListener('click', async () => {
          const tog = row.querySelector('.sv-csp-bypass-toggle');
          const nowOn = !tog.classList.contains('on');
          tog.disabled = true;

          if (!_bypassSettings[host]) _bypassSettings[host] = { enabled: false, directives: [] };
          try {
            if (nowOn) {
              await applyBypassRule(host);
            } else {
              await removeBypassRule(host);
            }
            _bypassSettings[host].enabled = nowOn;
            await saveBypass();
            setBypassRowState(row, host, nowOn);
            showToast(`CSP bypass ${nowOn ? 'enabled' : 'disabled'} for ${host}`);
          } catch {
            setBypassRowState(row, host, _bypassSettings[host].enabled === true);
            showToast(`Could not ${nowOn ? 'enable' : 'disable'} CSP bypass for ${host}`);
          } finally {
            tog.disabled = false;
          }
        });
      }
    }

    panel.appendChild(body);
    _container.appendChild(panel);

    headerEl.addEventListener('click', () => {
      body.classList.toggle('visible');
      const isVisible = body.classList.contains('visible');
      headerEl.setAttribute('aria-expanded', String(isVisible));
      const caret = headerEl.querySelector('.sv-csp-bypass-caret');
      if (caret) caret.textContent = isVisible ? '\u25B2' : '\u25BC';
    });
  }

  /* ------------------------------------------------------------------ */
  /*  CSP Bypass via declarativeNetRequest                               */
  /* ------------------------------------------------------------------ */

  async function applyBypassRule(hostname) {
    try {
      // CSP-RULEID — ensure a sequential ruleId is allocated for this
      // host BEFORE issuing the DNR update, and persist immediately so a
      // crash mid-flow doesn't leak a DNR rule with no stored mapping.
      // Sweep any legacy hash-allocated rules first (one-shot).
      await _reconcileLegacyRules();
      if (!_bypassSettings[hostname]) {
        _bypassSettings[hostname] = { enabled: false, directives: [] };
      }
      if (!Number.isFinite(_bypassSettings[hostname].ruleId)) {
        _bypassSettings[hostname].ruleId = _allocRuleId();
        await saveBypass();
      }
      const ruleId = _bypassSettings[hostname].ruleId;
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: ruleId,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [
              { header: 'content-security-policy', operation: 'remove' },
              { header: 'content-security-policy-report-only', operation: 'remove' }
            ]
          },
          condition: {
            urlFilter: `||${hostname}`,
            resourceTypes: ['main_frame', 'sub_frame']
          }
        }],
        removeRuleIds: [ruleId]
      });
    } catch (e) {
      console.warn('[CSPReporter] Could not apply bypass rule:', e);
      throw e;
    }
  }

  async function removeBypassRule(hostname) {
    try {
      // CSP-RULEID — use the entry's stored ruleId so removals always
      // target the rule we actually installed. Migration grace: an entry
      // that predates the fix and has no stored ruleId falls back to the
      // legacy hashCode allocation so the user's existing rule can still
      // be torn down. The reconcile pass on the next applyBypassRule
      // call will sweep any genuinely-orphan rules afterwards.
      const stored = _bypassSettings[hostname]?.ruleId;
      const ruleId = Number.isFinite(stored) ? stored : _legacyHashRuleId(hostname);
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ruleId]
      });
    } catch (e) {
      console.warn('[CSPReporter] Could not remove bypass rule:', e);
      throw e;
    }
  }

  // CSP-RULEID — legacy hash allocator. Retained ONLY for migration
  // grace: pre-fix entries that have no stored ruleId need a way to
  // identify their existing DNR rule for removal. New rules never go
  // through this path.
  function _legacyHashRuleId(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return 900000 + (Math.abs(hash) % 100000);
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                              */
  /* ------------------------------------------------------------------ */

  function getReport() {
    return {
      reports: _reports,
      aggregated: aggregateReports(),
      bypassSettings: _bypassSettings,
      generatedAt: new Date().toISOString()
    };
  }

  function exportReport(format = 'json') {
    if (format === 'csv') {
      return exportCSV();
    }
    return exportJSON();
  }

  function exportCSV() {
    const aggregated = aggregateReports();
    const header = 'Site,CSP Directive,Severity,Affected Scripts,Issue Count,Last Seen';
    // CSV formula-injection mitigation: `scriptNames` is composed from
    // user-controlled `script.meta.name` fields. A malicious script author
    // could name their script `=HYPERLINK("http://evil")` and target anyone
    // who exports the CSP report to CSV. Prefix any field that starts with
    // a formula-trigger char with a literal apostrophe per OWASP/CWE-1236.
    // Defensively apply to all user-controlled fields (hostname rarely
    // matters in practice but cheap to guard).
    const csvCell = (raw) => {
      let s = String(raw == null ? '' : raw);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = aggregated.map(r => {
      const sev = getSeverity(r.directive);
      return [
        csvCell(r.hostname),
        csvCell(r.directive),
        csvCell(sev.label),
        csvCell(r.scriptNames),
        r.count,
        csvCell(new Date(r.lastSeen).toISOString())
      ].join(',');
    });
    return header + '\n' + rows.join('\n');
  }

  function exportJSON() {
    return JSON.stringify(getReport(), null, 2);
  }

  function downloadExport(format) {
    const content = exportReport(format);
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    const ext = format === 'csv' ? 'csv' : 'json';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csp-report-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported as ${ext.toUpperCase()}`);
  }

  function getSuggestions(directive) {
    return SUGGESTIONS[directive] || SUGGESTIONS['default-src'] || [];
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialise the CSP Reporter UI.
     * @param {HTMLElement} containerEl
     */
    async init(containerEl) {
      _container = containerEl;

      if (!document.getElementById(STYLE_ID)) {
        _styleEl = document.createElement('style');
        _styleEl.id = STYLE_ID;
        _styleEl.textContent = STYLES;
        document.head.appendChild(_styleEl);
      }

      await loadReports();
      _initialized = true;
      render();
    },

    /**
     * Record a CSP failure.
     * @param {string} url        - page URL where failure occurred
     * @param {string} scriptId   - ID of the script that failed
     * @param {string} cspDirective - e.g. 'script-src', 'connect-src', 'style-src'
     * @param {Object} [opts]
     * @param {string} [opts.scriptName] - human-readable script name
     * @param {string} [opts.detail]     - additional error detail
     */
    async recordFailure(url, scriptId, cspDirective, opts = {}) {
      const entry = {
        id: generateId(),
        url,
        hostname: extractHostname(url),
        scriptId,
        scriptName: opts.scriptName || scriptId,
        directive: cspDirective,
        detail: opts.detail || '',
        timestamp: Date.now()
      };
      _reports.push(entry);

      // Trim to max
      if (_reports.length > MAX_ENTRIES) {
        _reports = _reports.slice(-MAX_ENTRIES);
      }

      await saveReports();

      if (_initialized && _container) {
        render();
      }

      return entry;
    },

    /**
     * Get the full report object.
     */
    getReport() {
      return getReport();
    },

    /**
     * Get fix suggestions for a CSP directive.
     * @param {string} cspDirective
     */
    getSuggestions(cspDirective) {
      return getSuggestions(cspDirective);
    },

    /**
     * Export the report in the given format.
     * @param {'csv'|'json'} format
     * @returns {string}
     */
    exportReport(format = 'json') {
      return exportReport(format);
    },

    /**
     * Clean up resources.
     */
    destroy() {
      _container = null;
      _initialized = false;
      if (_styleEl) {
        _styleEl.remove();
        _styleEl = null;
      }
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CSPReporter };
}
