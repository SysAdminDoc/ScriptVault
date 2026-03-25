// ScriptVault — Keyboard Navigation Module
// Comprehensive keyboard navigation for the dashboard: script list navigation,
// vim-style keybindings, focus management, and a shortcut help overlay.

const KeyboardNav = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const VIM_STORAGE_KEY = 'sv_vimMode';
  const DEBOUNCE_GG_MS = 400;

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _active = false;
  let _vimMode = false;
  let _focusedIndex = -1;
  let _helpOverlay = null;
  let _styleEl = null;
  let _lastGTime = 0;    // for gg detection
  let _boundKeydown = null;
  let _boundFocusin = null;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Keyboard focus ring */
.kn-focused {
  outline: 2px solid var(--accent-blue) !important;
  outline-offset: 1px;
  position: relative;
  z-index: 2;
}
tr.kn-focused td {
  background: var(--bg-row-selected) !important;
}
.cv-card.kn-focused {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(96,165,250,.15);
}

/* Help overlay */
.kn-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  animation: kn-fade-in 200ms ease;
}
@keyframes kn-fade-in { from { opacity: 0; } to { opacity: 1; } }

.kn-overlay.kn-closing {
  animation: kn-fade-out 150ms ease forwards;
}
@keyframes kn-fade-out { from { opacity: 1; } to { opacity: 0; } }

.kn-help {
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px 28px;
  max-width: 640px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--text-primary);
  box-shadow: 0 12px 48px rgba(0,0,0,.5);
}
.kn-help h2 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.kn-help-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.kn-help-close:hover { color: var(--text-primary); background: var(--bg-row-hover); }

.kn-section {
  margin-bottom: 16px;
}
.kn-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent-green);
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}
.kn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}
.kn-key {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.kn-kbd {
  display: inline-block;
  padding: 2px 7px;
  font-size: 11px;
  font-family: 'SF Mono', 'Consolas', monospace;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  min-width: 22px;
  text-align: center;
}
.kn-desc { color: var(--text-secondary); }

.kn-vim-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(192,132,252,.15);
  color: var(--accent-purple);
  font-weight: 600;
  margin-left: 6px;
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function isEditorActive() {
    return !!document.getElementById('editorOverlay')?.classList.contains('active');
  }

  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    // CodeMirror / Monaco
    if (el.closest('.cm-editor, .monaco-editor, .CodeMirror')) return true;
    return false;
  }

  function isModalOpen() {
    // Any modal/overlay that's active
    const overlays = document.querySelectorAll(
      '.modal.active, .overlay.active, [role="dialog"]:not([aria-hidden="true"]), .kn-overlay'
    );
    return overlays.length > 0;
  }

  function getScriptRows() {
    // Card view items
    const cards = document.querySelectorAll('.cv-card:not(.cv-hidden)');
    if (cards.length > 0 && !cards[0].closest('.cv-hidden')) {
      return [...cards];
    }
    // Table rows
    const tbody = document.getElementById('scriptTableBody');
    if (!tbody) return [];
    return [...tbody.querySelectorAll('tr[data-script-id]')];
  }

  function setFocusedIndex(idx) {
    const rows = getScriptRows();
    // Remove old focus
    document.querySelectorAll('.kn-focused').forEach(el => el.classList.remove('kn-focused'));

    if (idx < 0) idx = 0;
    if (idx >= rows.length) idx = rows.length - 1;
    if (idx < 0) return;

    _focusedIndex = idx;
    const el = rows[idx];
    el.classList.add('kn-focused');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function getScriptIdAtIndex(idx) {
    const rows = getScriptRows();
    if (idx < 0 || idx >= rows.length) return null;
    return rows[idx]?.dataset?.scriptId || null;
  }

  function clearFocus() {
    _focusedIndex = -1;
    document.querySelectorAll('.kn-focused').forEach(el => el.classList.remove('kn-focused'));
  }

  /* ------------------------------------------------------------------ */
  /*  Action dispatchers                                                 */
  /* ------------------------------------------------------------------ */

  function dispatchAction(action, scriptId) {
    if (!scriptId) return;
    // Find and click the action button in the row/card
    const row = document.querySelector(`[data-script-id="${scriptId}"]`);
    if (!row) return;

    switch (action) {
      case 'edit': {
        const btn = row.querySelector('[data-action="edit"]');
        if (btn) btn.click();
        else row.querySelector('.script-name')?.click();
        break;
      }
      case 'toggle': {
        const toggle = row.querySelector('.script-toggle, [data-toggle-id]');
        if (toggle) {
          toggle.checked = !toggle.checked;
          toggle.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
      }
      case 'delete': {
        const btn = row.querySelector('[data-action="delete"]');
        if (btn) btn.click();
        break;
      }
      case 'export': {
        const btn = row.querySelector('[data-action="exportScript"], [data-action="export"]');
        if (btn) btn.click();
        break;
      }
      case 'update': {
        const btn = row.querySelector('[data-action="updateScript"], [data-action="update"]');
        if (btn) btn.click();
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Toolbar tab navigation                                             */
  /* ------------------------------------------------------------------ */

  function getToolbarButtons() {
    const toolbar = document.querySelector('.toolbar, .tm-toolbar, .bulk-actions');
    if (!toolbar) return [];
    return [...toolbar.querySelectorAll('button, select, input[type="text"], a')].filter(
      el => !el.disabled && el.offsetParent !== null
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Main keydown handler                                               */
  /* ------------------------------------------------------------------ */

  function handleKeydown(e) {
    try { _handleKeydownInner(e); } catch (err) { console.error('[KeyboardNav] keydown error:', err); }
  }

  function _handleKeydownInner(e) {
    // Always handle Escape to close overlays
    if (e.key === 'Escape') {
      if (_helpOverlay) {
        closeHelp();
        e.preventDefault();
        return;
      }
      // Close any open dropdown menus
      document.querySelectorAll('.cv-menu:not(.cv-hidden)').forEach(m => m.classList.add('cv-hidden'));
      return;
    }

    // ? key -> help overlay (when not typing)
    if (e.key === '?' && !isInputFocused() && !isEditorActive()) {
      e.preventDefault();
      api.showHelp();
      return;
    }

    // Don't intercept when editor active or input focused (except specific combos)
    if (isEditorActive()) return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Tab / Shift+Tab for toolbar focus cycling
    if (e.key === 'Tab' && !ctrl && !e.altKey && !isInputFocused()) {
      const btns = getToolbarButtons();
      if (btns.length > 0) {
        const curIdx = btns.indexOf(document.activeElement);
        if (curIdx !== -1 || document.activeElement?.closest('.toolbar, .tm-toolbar, .bulk-actions')) {
          e.preventDefault();
          const next = e.shiftKey
            ? (curIdx <= 0 ? btns.length - 1 : curIdx - 1)
            : (curIdx + 1) % btns.length;
          btns[next]?.focus();
          return;
        }
      }
    }

    // If focused in an input (search box etc.), only handle Escape (already done) and Enter
    if (isInputFocused()) return;

    const rows = getScriptRows();
    if (rows.length === 0 && !_vimMode) return;

    // ---- Standard navigation ----

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (rows.length === 0) return;

      const delta = e.key === 'ArrowDown' ? 1 : -1;

      if (e.shiftKey) {
        // Shift+Arrow: extend selection
        const newIdx = Math.max(0, Math.min(rows.length - 1, _focusedIndex + delta));
        const id = getScriptIdAtIndex(newIdx);
        if (id) {
          const checkbox = rows[newIdx]?.querySelector('.script-checkbox, input[type="checkbox"]');
          if (checkbox && !checkbox.dataset.toggleId) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          }
        }
        setFocusedIndex(newIdx);
      } else {
        if (_focusedIndex < 0) {
          setFocusedIndex(delta > 0 ? 0 : rows.length - 1);
        } else {
          setFocusedIndex(_focusedIndex + delta);
        }
      }
      return;
    }

    if (e.key === 'Enter' && _focusedIndex >= 0) {
      e.preventDefault();
      dispatchAction('edit', getScriptIdAtIndex(_focusedIndex));
      return;
    }

    if (e.key === ' ' && _focusedIndex >= 0) {
      e.preventDefault();
      dispatchAction('toggle', getScriptIdAtIndex(_focusedIndex));
      return;
    }

    if (e.key === 'Delete' && _focusedIndex >= 0) {
      e.preventDefault();
      dispatchAction('delete', getScriptIdAtIndex(_focusedIndex));
      return;
    }

    // Home / End
    if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(rows.length - 1);
      return;
    }

    // ---- Vim-mode keybindings ----

    if (_vimMode) {
      handleVimKey(e, rows);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Vim keybindings                                                    */
  /* ------------------------------------------------------------------ */

  function handleVimKey(e, rows) {
    if (isInputFocused() || isEditorActive()) return;

    const key = e.key;
    const now = Date.now();

    // j / k — navigate
    if (key === 'j') {
      e.preventDefault();
      if (_focusedIndex < 0) setFocusedIndex(0);
      else setFocusedIndex(_focusedIndex + 1);
      return;
    }
    if (key === 'k') {
      e.preventDefault();
      if (_focusedIndex < 0) setFocusedIndex(rows.length - 1);
      else setFocusedIndex(_focusedIndex - 1);
      return;
    }

    // gg — go to first
    if (key === 'g') {
      if (now - _lastGTime < DEBOUNCE_GG_MS) {
        e.preventDefault();
        setFocusedIndex(0);
        _lastGTime = 0;
      } else {
        _lastGTime = now;
      }
      return;
    }

    // G — go to last
    if (key === 'G') {
      e.preventDefault();
      setFocusedIndex(rows.length - 1);
      return;
    }

    // / — focus search
    if (key === '/') {
      e.preventDefault();
      const search = document.getElementById('scriptSearch');
      if (search) {
        search.focus();
        search.select();
      }
      return;
    }

    // e — edit
    if (key === 'e' && _focusedIndex >= 0) {
      e.preventDefault();
      dispatchAction('edit', getScriptIdAtIndex(_focusedIndex));
      return;
    }

    // o — new script
    if (key === 'o') {
      e.preventDefault();
      document.getElementById('btnNewScript')?.click();
      return;
    }

    // dd — delete (double d)
    // We use a simple approach: d sets a flag, second d executes
    if (key === 'd') {
      if (KeyboardNav._pendingD && now - KeyboardNav._pendingDTime < DEBOUNCE_GG_MS) {
        e.preventDefault();
        if (_focusedIndex >= 0) {
          dispatchAction('delete', getScriptIdAtIndex(_focusedIndex));
        }
        KeyboardNav._pendingD = false;
      } else {
        KeyboardNav._pendingD = true;
        KeyboardNav._pendingDTime = now;
      }
      return;
    } else {
      KeyboardNav._pendingD = false;
    }

    // x — export
    if (key === 'x' && _focusedIndex >= 0) {
      e.preventDefault();
      dispatchAction('export', getScriptIdAtIndex(_focusedIndex));
      return;
    }

    // u — check update
    if (key === 'u' && _focusedIndex >= 0) {
      e.preventDefault();
      dispatchAction('update', getScriptIdAtIndex(_focusedIndex));
      return;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Focus tracking                                                     */
  /* ------------------------------------------------------------------ */

  function handleFocusin(e) {
    // Track focus entering script rows/cards
    const row = e.target.closest?.('tr[data-script-id], .cv-card[data-script-id]');
    if (row) {
      const rows = getScriptRows();
      const idx = rows.indexOf(row);
      if (idx >= 0) {
        _focusedIndex = idx;
        document.querySelectorAll('.kn-focused').forEach(el => el.classList.remove('kn-focused'));
        row.classList.add('kn-focused');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Help overlay                                                       */
  /* ------------------------------------------------------------------ */

  function buildHelpContent() {
    const sections = [
      {
        title: 'Script List Navigation',
        shortcuts: [
          ['\u2191 / \u2193', 'Navigate between scripts'],
          ['Enter', 'Open selected script in editor'],
          ['Space', 'Toggle script enabled / disabled'],
          ['Delete', 'Delete selected script'],
          ['Shift + \u2191/\u2193', 'Extend selection'],
          ['Home / End', 'Jump to first / last script'],
        ]
      },
      {
        title: 'Tab Navigation',
        shortcuts: [
          ['Alt + 1\u20135', 'Switch dashboard tabs'],
          ['Ctrl + Tab', 'Cycle editor tabs'],
          ['Tab / Shift+Tab', 'Move focus between toolbar buttons'],
        ]
      },
      {
        title: 'Global Shortcuts',
        shortcuts: [
          ['Escape', 'Close any modal / overlay / dropdown'],
          ['Ctrl + K', 'Command palette'],
          ['Ctrl + N', 'New script'],
          ['Ctrl + I', 'Import script'],
          ['Ctrl + /', 'Focus search'],
          ['?', 'Show this help overlay'],
        ]
      },
    ];

    if (_vimMode) {
      sections.push({
        title: 'Vim-Style Keybindings',
        vim: true,
        shortcuts: [
          ['j / k', 'Navigate down / up'],
          ['/', 'Focus search box'],
          ['gg', 'Go to first script'],
          ['G', 'Go to last script'],
          ['e', 'Edit selected script'],
          ['o', 'Open new script'],
          ['dd', 'Delete selected script'],
          ['x', 'Export selected script'],
          ['u', 'Check for update'],
        ]
      });
    }

    let html = '';
    for (const section of sections) {
      html += `<div class="kn-section">`;
      html += `<div class="kn-section-title">${section.title}${section.vim ? '<span class="kn-vim-badge">VIM</span>' : ''}</div>`;
      for (const [keys, desc] of section.shortcuts) {
        const kbds = keys.split(' + ').map(k =>
          k.split(' / ').map(part => `<span class="kn-kbd">${part}</span>`).join(' / ')
        ).join(' <span style="color:var(--text-muted)">+</span> ');
        html += `<div class="kn-row"><span class="kn-key">${kbds}</span><span class="kn-desc">${desc}</span></div>`;
      }
      html += `</div>`;
    }

    return html;
  }

  function openHelp() {
    if (_helpOverlay) return;

    _helpOverlay = document.createElement('div');
    _helpOverlay.className = 'kn-overlay';
    _helpOverlay.setAttribute('role', 'dialog');
    _helpOverlay.setAttribute('aria-modal', 'true');
    _helpOverlay.setAttribute('aria-label', 'Keyboard shortcuts');

    _helpOverlay.innerHTML = `
      <div class="kn-help">
        <h2>
          Keyboard Shortcuts
          <button class="kn-help-close" aria-label="Close">&times;</button>
        </h2>
        ${buildHelpContent()}
        <div style="text-align:center;margin-top:12px;font-size:11px;color:var(--text-muted)">
          ${_vimMode ? 'Vim mode is ON' : 'Enable vim mode in settings for additional keybindings'}
        </div>
      </div>
    `;

    // Close on backdrop click
    _helpOverlay.addEventListener('click', (e) => {
      if (e.target === _helpOverlay) closeHelp();
    });

    // Close button
    _helpOverlay.querySelector('.kn-help-close')?.addEventListener('click', closeHelp);

    document.body.appendChild(_helpOverlay);

    // Focus trap: focus the close button
    _helpOverlay.querySelector('.kn-help-close')?.focus();
  }

  function closeHelp() {
    if (!_helpOverlay) return;
    _helpOverlay.classList.add('kn-closing');
    setTimeout(() => {
      _helpOverlay?.remove();
      _helpOverlay = null;
    }, 150);
  }

  /* ------------------------------------------------------------------ */
  /*  Style injection                                                    */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-keyboard-styles';
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
  /*  Vim mode persistence                                               */
  /* ------------------------------------------------------------------ */

  function loadVimMode() {
    try { return localStorage.getItem(VIM_STORAGE_KEY) === 'true'; } catch { return false; }
  }

  function saveVimMode(enabled) {
    try { localStorage.setItem(VIM_STORAGE_KEY, String(enabled)); } catch { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {

    // Internal state for vim dd detection
    _pendingD: false,
    _pendingDTime: 0,

    /**
     * Initialize keyboard navigation.
     */
    init() {
      if (_active) return;
      _active = true;

      injectStyles();
      _vimMode = loadVimMode();

      _boundKeydown = handleKeydown;
      _boundFocusin = handleFocusin;
      document.addEventListener('keydown', _boundKeydown, true);
      document.addEventListener('focusin', _boundFocusin);
    },

    /**
     * Enable or disable vim-style keybindings.
     * @param {boolean} enabled
     */
    setVimMode(enabled) {
      _vimMode = !!enabled;
      saveVimMode(_vimMode);
    },

    /**
     * Get current vim mode state.
     * @returns {boolean}
     */
    getVimMode() {
      return _vimMode;
    },

    /**
     * Show the keyboard shortcuts help overlay.
     */
    showHelp() {
      openHelp();
    },

    /**
     * Reset focused index (e.g., after scripts re-render).
     */
    resetFocus() {
      clearFocus();
    },

    /**
     * Get the currently focused script ID, if any.
     * @returns {string|null}
     */
    getFocusedScriptId() {
      return getScriptIdAtIndex(_focusedIndex);
    },

    /**
     * Tear down: remove listeners, styles, overlays.
     */
    destroy() {
      if (!_active) return;
      _active = false;

      if (_boundKeydown) {
        document.removeEventListener('keydown', _boundKeydown, true);
        _boundKeydown = null;
      }
      if (_boundFocusin) {
        document.removeEventListener('focusin', _boundFocusin);
        _boundFocusin = null;
      }

      closeHelp();
      clearFocus();
      removeStyles();
      _vimMode = false;
    }
  };

  return api;
})();
