// ScriptVault Monaco Adapter v2.0.0
// Provides a CodeMirror-compatible API surface that delegates to the Monaco
// sandboxed iframe. Dashboard.js calls state.editor.getValue/setValue/etc.,
// which this adapter intercepts and routes via postMessage.
//
// The adapter is synchronous where possible (using a cached value) and async
// where Monaco's response is required (e.g., getValue returns cached state).

(function () {
  'use strict';

  const frame = document.getElementById('monacoFrame');
  const fallbackTextarea = document.getElementById('editorTextarea');

  let _value = '';
  let _isReady = false;
  let _pendingReady = [];
  let _valueCallbacks = new Map(); // requestId → resolve
  let _changeListeners = [];
  let _cursorListeners = [];
  let _useFallback = false;
  let _reqId = 0;
  let _lastScriptId = null;

  // ── Message listener ────────────────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (frame && e.source !== frame.contentWindow) return;
    const msg = e.data;

    switch (msg.type) {
      case 'ready':
        _isReady = true;
        _pendingReady.forEach(fn => fn());
        _pendingReady = [];
        break;
      case 'change':
        _value = msg.value;
        _changeListeners.forEach(fn => { try { fn(_monacoEditor, { origin: 'input' }); } catch {} });
        break;
      case 'cursor':
        _cursorListeners.forEach(fn => { try { fn({ line: msg.line - 1, ch: msg.col - 1 }); } catch {} });
        break;
      case 'save':
        // Find the saveCurrentScript function in dashboard scope
        if (typeof saveCurrentScript === 'function') saveCurrentScript();
        else document.querySelector('[data-action="save"]')?.click();
        break;
      case 'close':
        if (typeof closeEditor === 'function') closeEditor();
        break;
      case 'value':
        const cb = _valueCallbacks.get(msg.requestId);
        if (cb) { _valueCallbacks.delete(msg.requestId); cb(msg.value); }
        break;
    }
  });

  // Fallback if Monaco iframe fails to load
  if (frame) {
    frame.addEventListener('error', () => { activateFallback(); });
    // If not ready within 15 seconds, activate fallback
    setTimeout(() => { if (!_isReady) activateFallback(); }, 15000);
  }

  function activateFallback() {
    if (_useFallback) return;
    _useFallback = true;
    if (frame) frame.style.display = 'none';
    if (fallbackTextarea) fallbackTextarea.style.display = '';
    console.warn('[ScriptVault] Monaco failed to load, using textarea fallback');
  }

  function sendToFrame(msg) {
    if (_useFallback || !frame?.contentWindow) return;
    try {
      const origin = new URL(frame.src, location.href).origin;
      frame.contentWindow.postMessage(msg, (origin && origin !== 'null') ? origin : '*');
    } catch {
      frame.contentWindow.postMessage(msg, '*');
    }
  }

  function whenReady(fn) {
    if (_isReady) fn();
    else _pendingReady.push(fn);
  }

  // ── Monaco Editor API (CodeMirror-compatible surface) ──────────────────────
  const _monacoEditor = {
    // getValue: returns cached value synchronously (Monaco sends updates on every change)
    getValue() {
      if (_useFallback) return fallbackTextarea?.value || '';
      return _value;
    },

    setValue(code) {
      _value = code || '';
      if (_useFallback) {
        if (fallbackTextarea) fallbackTextarea.value = _value;
        return;
      }
      whenReady(() => sendToFrame({ type: 'set-value', value: _value, scriptId: _lastScriptId }));
    },

    setScriptId(id) {
      _lastScriptId = id;
    },

    // on(): register event listeners (change, cursorActivity)
    on(event, fn) {
      if (event === 'change') _changeListeners.push(fn);
      else if (event === 'cursorActivity') _cursorListeners.push(fn);
      else if (event === 'focus' || event === 'blur') {} // no-op
    },

    off(event, fn) {
      if (event === 'change') _changeListeners = _changeListeners.filter(f => f !== fn);
      else if (event === 'cursorActivity') _cursorListeners = _cursorListeners.filter(f => f !== fn);
    },

    // getCursor: returns {line, ch} (0-based, like CodeMirror)
    getCursor() {
      return { line: 0, ch: 0 }; // Monaco sends cursor events, tracked by dashboard
    },

    lineCount() {
      return (_value.match(/\n/g) || []).length + 1;
    },

    somethingSelected() { return false; },
    indentSelection() {},

    replaceSelection(text) {
      if (_useFallback) {
        if (fallbackTextarea) {
          const start = fallbackTextarea.selectionStart;
          const end = fallbackTextarea.selectionEnd;
          const val = fallbackTextarea.value;
          fallbackTextarea.value = val.slice(0, start) + text + val.slice(end);
          fallbackTextarea.selectionStart = fallbackTextarea.selectionEnd = start + text.length;
          _value = fallbackTextarea.value;
        }
        return;
      }
      sendToFrame({ type: 'insert-text', text });
    },

    focus() {
      sendToFrame({ type: 'focus' });
    },

    refresh() {
      // Monaco handles layout automatically
    },

    // setOption: map CodeMirror options to Monaco equivalents
    setOption(key, value) {
      const opts = {};
      if (key === 'theme') opts.theme = value;
      else if (key === 'lineWrapping') opts.wordWrap = value;
      else if (key === 'tabSize') opts.tabSize = value;
      else if (key === 'indentUnit') opts.tabSize = value;
      else if (key === 'indentWithTabs') opts.insertSpaces = !value;
      else if (key === 'lineNumbers') opts.lineNumbers = value;
      else if (key === 'fontSize') opts.fontSize = value;
      if (Object.keys(opts).length) sendToFrame({ type: 'set-options', options: opts });
    },

    getOption(key) {
      if (key === 'theme') return 'monaco';
      if (key === 'lineWrapping') return false;
      if (key === 'indentWithTabs') return false;
      if (key === 'indentUnit') return 4;
      if (key === 'tabSize') return 4;
      return undefined;
    },

    // Toolbar button hooks
    toggleComment() { sendToFrame({ type: 'toggle-comment' }); },
    toggleWordWrap() { sendToFrame({ type: 'toggle-word-wrap' }); },
    format() { sendToFrame({ type: 'format' }); },

    // For font size setting
    setFontSize(pct) {
      const px = Math.round(13 * (pct / 100));
      sendToFrame({ type: 'set-font-size', size: Math.max(8, Math.min(px, 32)) });
    },

    // Expose for theme changes
    setTheme(theme) {
      sendToFrame({ type: 'set-theme', theme });
    },

    // applyEditorSettings: called from dashboard initEditor
    applySettings(s) {
      const opts = {
        tabSize: parseInt(s.tabSize || s.editorTabSize) || 4,
        insertSpaces: (s.indentWith || 'spaces') === 'spaces',
        wordWrap: s.wordWrap !== undefined ? s.wordWrap : (s.editorWordWrap !== false),
        fontSize: parseInt(s.editorFontSize) || 100,
        theme: s.editorTheme || 'dark',
        lineNumbers: true,
        minimap: s.editorMinimap !== false
      };
      whenReady(() => {
        sendToFrame({ type: 'set-options', options: opts });
        sendToFrame({ type: 'set-theme', theme: s.editorTheme || 'dark' });
      });
    },

    // Monaco equivalents for CodeMirror methods
    undo() { sendToFrame({ type: 'action', id: 'undo' }); },
    redo() { sendToFrame({ type: 'action', id: 'redo' }); },
    foldCode() { /* Monaco folding managed internally */ },
    foldAll() { sendToFrame({ type: 'action', id: 'editor.foldAll' }); },
    unfoldAll() { sendToFrame({ type: 'action', id: 'editor.unfoldAll' }); },
    performLint() { /* Monaco handles diagnostics internally */ },
    getLine(n) {
      const lines = _value.split('\n');
      return lines[n] || '';
    },
    replaceRange(text, from, to) {
      const lines = _value.split('\n');
      if (from && to) {
        if (from.line === to.line) {
          // Single-line replace: splice within the line
          const line = lines[from.line] || '';
          lines[from.line] = line.slice(0, from.ch) + text + line.slice(to.ch);
        } else {
          // Multi-line replace: stitch first line prefix + text + last line suffix
          const prefix = (lines[from.line] || '').slice(0, from.ch);
          const suffix = (lines[to.line] || '').slice(to.ch);
          const replacement = prefix + text + suffix;
          lines.splice(from.line, to.line - from.line + 1, replacement);
        }
        const newVal = lines.join('\n');
        _value = newVal;
        this.setValue(newVal);
      }
    },
    listSelections() {
      // Return a single zero-width selection at start
      return [{ anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } }];
    },
    operation(fn) { if (fn) fn(); },

    // No-op CodeMirror methods not applicable to Monaco
    clearHistory() {},
    setCursor(line = 0, ch = 0) {
      if (_useFallback && fallbackTextarea) {
        const lines = (fallbackTextarea.value || '').split('\n');
        const targetLine = Math.max(0, Math.min(line, lines.length - 1));
        const targetCh = Math.max(0, Math.min(ch, (lines[targetLine] || '').length));
        let offset = 0;
        for (let i = 0; i < targetLine; i++) offset += (lines[i]?.length || 0) + 1;
        const pos = offset + targetCh;
        fallbackTextarea.focus();
        fallbackTextarea.setSelectionRange(pos, pos);
        return;
      }
      sendToFrame({ type: 'set-position', line: line + 1, col: ch + 1 });
    },
    markText() { return { clear() {} }; },
    getSearchCursor() { return { findNext() { return false; }, from() {}, to() {} }; },
    showHint() { /* Monaco handles completions internally */ },
    execCommand(cmd) {
      if (cmd === 'findPersistent') sendToFrame({ type: 'action', id: 'actions.find' });
      else if (cmd === 'replace') sendToFrame({ type: 'action', id: 'editor.action.startFindReplaceAction' });
    },

    // isMonaco flag for feature detection in dashboard.js
    isMonaco: true
  };

  // ── Patch dashboard.js init ──────────────────────────────────────────────
  // Override CodeMirror.fromTextArea to return our adapter instead.
  // Dashboard.js calls: state.editor = CodeMirror.fromTextArea(elements.editorTextarea, opts)
  if (typeof CodeMirror !== 'undefined') {
    const _origFromTextArea = CodeMirror.fromTextArea;
    CodeMirror.fromTextArea = function (textarea, options) {
      if (textarea && textarea.id === 'editorTextarea') {
        // Apply initial options
        if (options) {
          const s = {};
          if (options.theme) s.editorTheme = options.theme;
          if (options.tabSize) s.tabSize = options.tabSize;
          if (options.indentUnit) s.tabSize = options.indentUnit;
          if (options.indentWithTabs != null) s.indentWith = options.indentWithTabs ? 'tabs' : 'spaces';
          if (options.lineWrapping != null) s.wordWrap = options.lineWrapping;
          _monacoEditor.applySettings(s);
        }
        return _monacoEditor;
      }
      return _origFromTextArea.apply(this, arguments);
    };
  }

  // ── Also patch querySelector('.CodeMirror') calls in dashboard.js ─────────
  // Dashboard does: const cmEl = document.querySelector('.CodeMirror'); cmEl.style.fontSize = ...
  // We provide a no-op element instead.
  const _noopEl = document.createElement('div');
  _noopEl.className = 'CodeMirror sv-monaco-noop';
  _noopEl.style.display = 'none';
  document.body.appendChild(_noopEl);

  // Expose adapter globally so dashboard.js can call monaco-specific APIs
  window._monacoEditorAdapter = _monacoEditor;
})();
