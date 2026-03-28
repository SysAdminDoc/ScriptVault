/**
 * ScriptVault — Visual URL Pattern Builder
 * Constructs @match patterns visually from URL components.
 */

const PatternBuilder = (() => {

  /* ── State ─────────────────────────────────────────────────────────── */
  let _container = null;
  let _state = {
    protocol: 'https',
    host: '',
    hostWildcard: false,
    pathSegments: [],
    query: '',
    queryMode: 'exact',
  };
  let _testUrls = [];
  let _onInsert = null;   // callback set externally

  const PRESETS = [
    { label: 'All sites',           patterns: ['*://*/*'] },
    { label: 'All Google sites',    patterns: ['*://*.google.com/*'] },
    { label: 'All YouTube pages',   patterns: ['*://*.youtube.com/*'] },
    { label: 'All social media',    patterns: [
        '*://*.facebook.com/*',
        '*://*.twitter.com/*',
        '*://*.x.com/*',
        '*://*.reddit.com/*',
        '*://*.instagram.com/*',
        '*://*.linkedin.com/*',
        '*://*.tiktok.com/*',
      ]},
    { label: 'Specific page only',  patterns: [] },   // filled from current URL
    { label: 'All HTTP pages',      patterns: ['http://*/*'] },
    { label: 'All HTTPS pages',     patterns: ['https://*/*'] },
  ];

  /* ── CSS (injected inline, uses dashboard.css vars) ────────────── */
  const CSS = `
    .pb-root{font-family:system-ui,-apple-system,sans-serif;color:var(--text-primary,#e0e0e0);display:flex;flex-direction:column;gap:12px}
    .pb-section{background:var(--bg-row,#2a2a2a);border:1px solid var(--border-color,#404040);border-radius:8px;padding:14px}
    .pb-section-title{font-size:13px;font-weight:600;color:var(--accent-green,#4ade80);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
    .pb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
    .pb-label{font-size:12px;color:var(--text-secondary,#a0a0a0);min-width:70px}
    .pb-input{background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;color:var(--text-primary,#e0e0e0);padding:6px 10px;font-size:13px;flex:1;min-width:120px;outline:none;transition:border-color .2s}
    .pb-input:focus{border-color:var(--accent-green,#4ade80)}
    .pb-select{background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;color:var(--text-primary,#e0e0e0);padding:6px 8px;font-size:13px;outline:none;cursor:pointer}
    .pb-select:focus{border-color:var(--accent-green,#4ade80)}
    .pb-btn{background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;color:var(--text-primary,#e0e0e0);padding:6px 14px;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap}
    .pb-btn:hover{background:var(--bg-row-hover,#333);border-color:var(--accent-green,#4ade80)}
    .pb-btn-primary{background:var(--accent-green-dark,#22c55e);border-color:var(--accent-green-dark,#22c55e);color:#fff;font-weight:600}
    .pb-btn-primary:hover{background:var(--accent-green,#4ade80)}
    .pb-toggle{position:relative;width:36px;height:20px;border-radius:10px;background:var(--toggle-off,#555);cursor:pointer;transition:background .2s;flex-shrink:0}
    .pb-toggle.active{background:var(--toggle-on,#22c55e)}
    .pb-toggle::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}
    .pb-toggle.active::after{transform:translateX(16px)}
    .pb-preview{background:var(--bg-body,#1a1a1a);border:1px solid var(--border-color,#404040);border-radius:6px;padding:12px 14px;font-family:'Cascadia Code','Fira Code',monospace;font-size:13px;word-break:break-all;color:var(--accent-blue,#60a5fa);line-height:1.6;min-height:36px;user-select:all}
    .pb-segment{display:inline-flex;align-items:center;background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;padding:4px 8px;font-size:12px;gap:6px;cursor:default}
    .pb-segment .seg-sep{color:var(--text-muted,#707070);font-weight:700}
    .pb-segment select,.pb-segment input{background:transparent;border:none;color:var(--text-primary,#e0e0e0);font-size:12px;outline:none;padding:0;min-width:40px;font-family:inherit}
    .pb-test-row{display:flex;align-items:center;gap:8px;margin-top:4px}
    .pb-test-badge{width:14px;height:14px;border-radius:50%;flex-shrink:0}
    .pb-test-badge.match{background:var(--accent-green,#4ade80)}
    .pb-test-badge.no-match{background:var(--accent-red,#f87171)}
    .pb-test-url{font-size:12px;color:var(--text-secondary,#a0a0a0);word-break:break-all}
    .pb-presets{display:flex;flex-wrap:wrap;gap:6px}
    .pb-preset-chip{background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:14px;padding:4px 12px;font-size:11px;color:var(--text-secondary,#a0a0a0);cursor:pointer;transition:all .15s}
    .pb-preset-chip:hover{border-color:var(--accent-green,#4ade80);color:var(--text-primary,#e0e0e0)}
    .pb-actions{display:flex;gap:8px;justify-content:flex-end}
    .pb-path-segments{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
    .pb-path-seg{display:inline-flex;align-items:center;gap:4px;background:var(--bg-input,#333);border:1px solid var(--border-color,#404040);border-radius:4px;padding:3px 6px;font-size:12px}
    .pb-path-seg input{background:transparent;border:none;color:var(--text-primary);font-size:12px;outline:none;width:80px;font-family:inherit}
    .pb-path-seg select{background:transparent;border:none;color:var(--text-primary);font-size:12px;outline:none;cursor:pointer;font-family:inherit}
    .pb-path-seg .remove-seg{color:var(--accent-red,#f87171);cursor:pointer;font-size:14px;line-height:1}
    .pb-slash{color:var(--text-muted,#707070);font-weight:700;font-size:14px}
  `;

  /* ── Helpers ────────────────────────────────────────────────────── */

  function injectCSS() {
    if (_container.querySelector('#pb-style')) return;
    const style = document.createElement('style');
    style.id = 'pb-style';
    style.textContent = CSS;
    _container.appendChild(style);
  }

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
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

  function select(options, selected, onChange) {
    const s = el('select', { class: 'pb-select' });
    options.forEach(o => {
      const opt = el('option', { value: typeof o === 'string' ? o : o.value, text: typeof o === 'string' ? o : o.label });
      if ((typeof o === 'string' ? o : o.value) === selected) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  function parseUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      return {
        protocol: u.protocol.replace(':', ''),
        host: u.hostname,
        pathSegments: u.pathname.split('/').filter(Boolean).map(s => ({ value: s, mode: 'exact' })),
        query: u.search,
      };
    } catch {
      return null;
    }
  }

  /** Convert current _state to @match pattern string */
  function buildPattern() {
    const proto = _state.protocol === '*' ? '*' : _state.protocol;
    let host = _state.host || '*';
    if (_state.hostWildcard && host !== '*') {
      host = host.replace(/^\*\./, '');   // clean existing prefix
      host = '*.' + host;
    }
    let path = '/';
    if (_state.pathSegments.length === 0) {
      path = '/*';
    } else {
      path += _state.pathSegments.map(s => s.mode === 'wildcard' ? '*' : s.value).join('/');
    }
    return `${proto}://${host}${path}`;
  }

  /** Test a URL against a @match-style pattern (simplified) */
  function matchUrl(url, pattern) {
    try {
      if (pattern.length > 500) return false; // ReDoS guard
      // Convert @match pattern to a regex
      let re = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')   // escape regex chars EXCEPT *
        .replace(/\\\*/g, '[^]*?');                 // non-greedy bounded wildcard
      re = '^' + re.replace(/\[\^]\*\?:\/\//, '(https?|\\*?):\\/\\/') + '$';
      // Fix the protocol wildcard we just clobbered
      if (pattern.startsWith('*://')) {
        re = '^(https?|\\*):\\/\\/' + re.slice('^(https?|\\*?):\\/\\/'.length);
      }
      return new RegExp(re).test(url);
    } catch {
      // Fallback: simple string comparison
      return url === pattern;
    }
  }

  /* ── Rendering ──────────────────────────────────────────────────── */

  function render() {
    const root = _container.querySelector('.pb-root');
    if (!root) return;
    root.innerHTML = '';

    // 1) URL Input
    root.appendChild(renderUrlInput());
    // 2) Visual Builder
    root.appendChild(renderVisualBuilder());
    // 3) Pattern Preview
    root.appendChild(renderPreview());
    // 4) Test URLs
    root.appendChild(renderTestUrls());
    // 5) Pattern Library
    root.appendChild(renderPresets());
    // 6) Actions
    root.appendChild(renderActions());
  }

  function renderUrlInput() {
    const sec = el('div', { class: 'pb-section' });
    sec.appendChild(el('div', { class: 'pb-section-title', text: 'Paste URL to Decompose' }));
    const row = el('div', { class: 'pb-row' });
    const input = el('input', {
      class: 'pb-input',
      type: 'text',
      placeholder: 'https://www.example.com/path/page?q=1',
    });
    const btn = el('button', { class: 'pb-btn pb-btn-primary', text: 'Parse' });
    btn.addEventListener('click', () => {
      const parsed = parseUrl(input.value.trim());
      if (parsed) {
        _state.protocol = parsed.protocol;
        _state.host = parsed.host;
        _state.hostWildcard = false;
        _state.pathSegments = parsed.pathSegments;
        _state.query = parsed.query;
        render();
      }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
    row.appendChild(input);
    row.appendChild(btn);
    sec.appendChild(row);
    return sec;
  }

  function renderVisualBuilder() {
    const sec = el('div', { class: 'pb-section' });
    sec.appendChild(el('div', { class: 'pb-section-title', text: 'Pattern Builder' }));

    // Protocol
    const protoRow = el('div', { class: 'pb-row' });
    protoRow.appendChild(el('span', { class: 'pb-label', text: 'Protocol' }));
    protoRow.appendChild(select(
      [{ value: 'https', label: 'https' }, { value: 'http', label: 'http' }, { value: '*', label: '* (any)' }],
      _state.protocol,
      v => { _state.protocol = v; render(); }
    ));
    protoRow.appendChild(el('span', { class: 'seg-sep', text: '://', style: 'color:var(--text-muted);font-weight:700;font-size:14px' }));
    sec.appendChild(protoRow);

    // Host
    const hostRow = el('div', { class: 'pb-row' });
    hostRow.appendChild(el('span', { class: 'pb-label', text: 'Host' }));

    const wildcardToggle = el('div', {
      class: 'pb-toggle' + (_state.hostWildcard ? ' active' : ''),
      title: 'Subdomain wildcard (*. prefix)',
    });
    wildcardToggle.addEventListener('click', () => {
      _state.hostWildcard = !_state.hostWildcard;
      render();
    });
    hostRow.appendChild(wildcardToggle);
    hostRow.appendChild(el('span', { style: 'font-size:11px;color:var(--text-secondary)', text: '*. prefix' }));

    const hostInput = el('input', {
      class: 'pb-input',
      type: 'text',
      placeholder: 'example.com',
      value: _state.host,
    });
    hostInput.addEventListener('input', () => { _state.host = hostInput.value; renderPreviewOnly(); });
    hostInput.addEventListener('change', () => { _state.host = hostInput.value; render(); });
    hostRow.appendChild(hostInput);
    sec.appendChild(hostRow);

    // Path segments
    const pathRow = el('div', { class: 'pb-row', style: 'align-items:flex-start' });
    pathRow.appendChild(el('span', { class: 'pb-label', text: 'Path' }));

    const pathContainer = el('div', { class: 'pb-path-segments' });
    pathContainer.appendChild(el('span', { class: 'pb-slash', text: '/' }));

    _state.pathSegments.forEach((seg, i) => {
      const segEl = el('div', { class: 'pb-path-seg' });

      const modeSelect = select(
        [{ value: 'exact', label: 'exact' }, { value: 'wildcard', label: '*' }],
        seg.mode,
        v => { _state.pathSegments[i].mode = v; render(); }
      );
      segEl.appendChild(modeSelect);

      if (seg.mode === 'exact') {
        const segInput = el('input', { type: 'text', value: seg.value, placeholder: 'segment' });
        segInput.addEventListener('input', () => { _state.pathSegments[i].value = segInput.value; renderPreviewOnly(); });
        segInput.addEventListener('change', () => render());
        segEl.appendChild(segInput);
      } else {
        segEl.appendChild(el('span', { text: '*', style: 'color:var(--accent-yellow)' }));
      }

      const removeBtn = el('span', { class: 'remove-seg', text: '\u00d7', title: 'Remove segment' });
      removeBtn.addEventListener('click', () => { _state.pathSegments.splice(i, 1); render(); });
      segEl.appendChild(removeBtn);

      pathContainer.appendChild(segEl);

      if (i < _state.pathSegments.length - 1) {
        pathContainer.appendChild(el('span', { class: 'pb-slash', text: '/' }));
      }
    });

    const addSegBtn = el('button', { class: 'pb-btn', text: '+ Segment', style: 'font-size:11px;padding:3px 8px' });
    addSegBtn.addEventListener('click', () => {
      _state.pathSegments.push({ value: '*', mode: 'wildcard' });
      render();
    });
    pathContainer.appendChild(addSegBtn);

    pathRow.appendChild(pathContainer);
    sec.appendChild(pathRow);

    return sec;
  }

  function renderPreview() {
    const sec = el('div', { class: 'pb-section' });
    sec.appendChild(el('div', { class: 'pb-section-title', text: 'Pattern Preview' }));
    const preview = el('div', { class: 'pb-preview', id: 'pb-preview-text', text: buildPattern() });
    sec.appendChild(preview);
    return sec;
  }

  /** Lightweight update — preview text only, no full re-render */
  function renderPreviewOnly() {
    const previewEl = _container.querySelector('#pb-preview-text');
    if (previewEl) previewEl.textContent = buildPattern();
    // Also refresh test results
    const badges = _container.querySelectorAll('[data-test-index]');
    const pattern = buildPattern();
    badges.forEach(badge => {
      const idx = parseInt(badge.dataset.testIndex, 10);
      const url = _testUrls[idx];
      if (url) {
        const matches = matchUrl(url, pattern);
        badge.className = 'pb-test-badge ' + (matches ? 'match' : 'no-match');
      }
    });
  }

  function renderTestUrls() {
    const sec = el('div', { class: 'pb-section' });
    sec.appendChild(el('div', { class: 'pb-section-title', text: 'Test URLs' }));

    const row = el('div', { class: 'pb-row' });
    const input = el('input', {
      class: 'pb-input',
      type: 'text',
      placeholder: 'Paste a URL and press Enter to test',
    });
    const addBtn = el('button', { class: 'pb-btn', text: 'Add' });
    const addTestUrl = () => {
      const v = input.value.trim();
      if (v && !_testUrls.includes(v)) {
        _testUrls.push(v);
        input.value = '';
        render();
      }
    };
    addBtn.addEventListener('click', addTestUrl);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') addTestUrl(); });
    row.appendChild(input);
    row.appendChild(addBtn);
    sec.appendChild(row);

    const pattern = buildPattern();
    _testUrls.forEach((url, i) => {
      const matches = matchUrl(url, pattern);
      const testRow = el('div', { class: 'pb-test-row' });
      const badge = el('div', { class: 'pb-test-badge ' + (matches ? 'match' : 'no-match') });
      badge.dataset.testIndex = i;
      testRow.appendChild(badge);
      testRow.appendChild(el('span', { class: 'pb-test-url', text: url }));
      const removeBtn = el('span', {
        text: '\u00d7',
        style: 'color:var(--accent-red);cursor:pointer;font-size:14px;margin-left:4px',
        title: 'Remove',
      });
      removeBtn.addEventListener('click', () => { _testUrls.splice(i, 1); render(); });
      testRow.appendChild(removeBtn);
      sec.appendChild(testRow);
    });

    return sec;
  }

  function renderPresets() {
    const sec = el('div', { class: 'pb-section' });
    sec.appendChild(el('div', { class: 'pb-section-title', text: 'Pattern Library' }));
    const container = el('div', { class: 'pb-presets' });

    PRESETS.forEach(preset => {
      const chip = el('div', { class: 'pb-preset-chip', text: preset.label });
      chip.addEventListener('click', () => {
        if (preset.patterns.length === 0) return;         // "specific page" — noop if no URL
        const first = preset.patterns[0];
        const parsed = parsePresetPattern(first);
        if (parsed) {
          _state.protocol = parsed.protocol;
          _state.host = parsed.host;
          _state.hostWildcard = parsed.hostWildcard;
          _state.pathSegments = parsed.pathSegments;
          render();
        }
      });
      chip.title = preset.patterns.join('\n') || 'Build from current URL';
      container.appendChild(chip);
    });

    sec.appendChild(container);
    return sec;
  }

  function parsePresetPattern(pat) {
    const m = pat.match(/^(\*|https?):\/\/([^/]+)(\/.*)?$/);
    if (!m) return null;
    const protocol = m[1];
    let host = m[2];
    let hostWildcard = false;
    if (host.startsWith('*.')) {
      hostWildcard = true;
      host = host.slice(2);
    }
    const pathStr = m[3] || '/*';
    const segments = pathStr.split('/').filter(Boolean).map(s => ({
      value: s,
      mode: s === '*' ? 'wildcard' : 'exact',
    }));
    return { protocol, host, hostWildcard, pathSegments: segments };
  }

  function renderActions() {
    const sec = el('div', { class: 'pb-actions' });

    const copyBtn = el('button', { class: 'pb-btn', text: 'Copy @match line' });
    copyBtn.addEventListener('click', () => {
      const line = `// @match        ${buildPattern()}`;
      navigator.clipboard.writeText(line).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy @match line'; }, 1500);
      }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = line;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy @match line'; }, 1500);
      });
    });

    const insertBtn = el('button', { class: 'pb-btn pb-btn-primary', text: 'Insert into Script' });
    insertBtn.addEventListener('click', () => {
      if (typeof _onInsert === 'function') {
        _onInsert(buildPattern());
      }
    });

    sec.appendChild(copyBtn);
    sec.appendChild(insertBtn);
    return sec;
  }

  /* ── Public API ─────────────────────────────────────────────────── */

  return {
    /**
     * Initialize the pattern builder inside a container element.
     * @param {HTMLElement} containerEl
     * @param {Object} [options]
     * @param {Function} [options.onInsert] — called with pattern string when "Insert" is clicked
     */
    init(containerEl, options = {}) {
      _container = containerEl;
      _onInsert = options.onInsert || null;
      _testUrls = [];
      _state = {
        protocol: '*',
        host: '',
        hostWildcard: false,
        pathSegments: [{ value: '*', mode: 'wildcard' }],
        query: '',
        queryMode: 'exact',
      };

      injectCSS();
      const root = el('div', { class: 'pb-root' });
      _container.appendChild(root);
      render();
    },

    /**
     * Parse a URL and populate the builder from it.
     * @param {string} url
     */
    fromUrl(url) {
      const parsed = parseUrl(url);
      if (!parsed) return;
      _state.protocol = parsed.protocol;
      _state.host = parsed.host;
      _state.hostWildcard = false;
      _state.pathSegments = parsed.pathSegments;
      _state.query = parsed.query;
      render();
    },

    /**
     * Get the current @match pattern string.
     * @returns {string}
     */
    getPattern() {
      return buildPattern();
    },

    /**
     * Test a URL against a @match-style pattern.
     * @param {string} url
     * @param {string} [pattern] — defaults to the current builder pattern
     * @returns {boolean}
     */
    testUrl(url, pattern) {
      return matchUrl(url, pattern || buildPattern());
    },

    /**
     * Register the insert callback (for injecting into editor metadata).
     * @param {Function} fn — receives the pattern string
     */
    onInsert(fn) {
      _onInsert = fn;
    },

    /**
     * Tear down the builder and remove DOM.
     */
    destroy() {
      if (_container) {
        const root = _container.querySelector('.pb-root');
        if (root) root.remove();
        const style = _container.querySelector('#pb-style');
        if (style) style.remove();
      }
      _container = null;
      _testUrls = [];
      _onInsert = null;
    },
  };
})();

/* Export for module environments; noop in plain browser context */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PatternBuilder;
}
