// ScriptVault — Script Collections/Bundles Module
// Group scripts into installable bundles with import/export, sharing,
// and built-in curated collections.

const CollectionManager = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_collections';
  const STYLE_ID = 'sv-collections-styles';

  const BUILT_IN_COLLECTIONS = [
    {
      id: '__builtin_privacy',
      name: 'Privacy Pack',
      icon: '\u{1F6E1}',
      description: 'Block trackers, manage cookies, and enhance privacy across the web.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'Google Analytics Blocker', greasyForkId: 480483, note: 'Blocks GA tracking scripts' },
        { name: 'Cookie AutoDelete Helper', greasyForkId: 446372, note: 'Auto-dismiss cookie banners' },
        { name: 'Fingerprint Defender', greasyForkId: 471230, note: 'Randomises canvas/WebGL fingerprints' },
        { name: 'Referrer Cleaner', greasyForkId: 438910, note: 'Strips referrer headers on navigation' }
      ]
    },
    {
      id: '__builtin_youtube',
      name: 'YouTube Enhancer',
      icon: '\u{1F3AC}',
      description: 'Bring back dislikes, skip sponsors, and improve the YouTube experience.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'Return YouTube Dislike', greasyForkId: 436115, note: 'Restores dislike counts' },
        { name: 'SponsorBlock', greasyForkId: 467733, note: 'Auto-skip sponsored segments' },
        { name: 'YouTube Age Bypass', greasyForkId: 423851, note: 'Bypass age-restricted videos' },
        { name: 'YouTube Thumbnail Rating Bar', greasyForkId: 411880, note: 'Adds like/dislike bar to thumbnails' }
      ]
    },
    {
      id: '__builtin_devtools',
      name: 'Developer Tools',
      icon: '\u{1F6E0}',
      description: 'JSON formatting, CSS inspection, and developer productivity utilities.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'JSON Formatter', greasyForkId: 440321, note: 'Pretty-prints JSON responses in browser' },
        { name: 'CSS Inspector Helper', greasyForkId: 451087, note: 'Highlights elements with computed styles' },
        { name: 'Console Error Overlay', greasyForkId: 462900, note: 'Shows console errors as page overlay' },
        { name: 'XHR Logger', greasyForkId: 437654, note: 'Logs all XHR/fetch requests in-page' }
      ]
    },
    {
      id: '__builtin_social',
      name: 'Social Media',
      icon: '\u{1F310}',
      description: 'UI tweaks and enhancements for Twitter, Reddit, and other social platforms.',
      author: 'ScriptVault',
      builtIn: true,
      scripts: [
        { name: 'Old Reddit Redirect', greasyForkId: 441122, note: 'Redirects to old.reddit.com' },
        { name: 'Twitter/X UI Cleaner', greasyForkId: 455678, note: 'Removes promoted tweets and clutter' },
        { name: 'Reddit Enhancement Lite', greasyForkId: 448900, note: 'Keyboard nav and inline image expand' },
        { name: 'Instagram Download Button', greasyForkId: 460345, note: 'Adds download button to posts' }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _collections = [];    // user-created collections
  let _scripts = [];        // reference to installed scripts
  let _getScripts = null;   // callback to fetch current scripts
  let _onInstall = null;    // callback to install a script
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Collections Grid */
.sv-coll-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
  padding: 18px 0;
}

/* Collection Card */
.sv-coll-card {
  background:
    radial-gradient(circle at top right, rgba(52, 211, 153, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
    var(--bg-row, #2a2a2a);
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 24px;
  padding: 18px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  position: relative;
  overflow: hidden;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
}
.sv-coll-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent 40%, transparent 62%, rgba(255,255,255,0.03));
  pointer-events: none;
}
.sv-coll-card:hover {
  border-color: rgba(52, 211, 153, 0.28);
  transform: translateY(-2px);
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 24px 42px rgba(0, 0, 0, 0.24);
}
.sv-coll-card.expanded {
  border-color: rgba(52, 211, 153, 0.3);
  box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.16), 0 24px 42px rgba(0, 0, 0, 0.22);
}
.sv-coll-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  position: relative;
  z-index: 1;
}
.sv-coll-icon {
  font-size: 30px;
  line-height: 1;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 18px rgba(0,0,0,0.18);
}
.sv-coll-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #e0e0e0);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sv-coll-badge {
  font-size: 10px;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(52, 211, 153, 0.16);
  border: 1px solid rgba(52, 211, 153, 0.2);
  color: #d1fae5;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  flex-shrink: 0;
}
.sv-coll-desc {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  line-height: 1.6;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  position: relative;
  z-index: 1;
}
.sv-coll-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-muted, #707070);
  position: relative;
  z-index: 1;
}
.sv-coll-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(127,127,127,0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}

/* Expanded Script List */
.sv-coll-scripts {
  margin-top: 16px;
  border-top: 1px solid rgba(127,127,127,0.14);
  padding-top: 14px;
  display: none;
  position: relative;
  z-index: 1;
}
.sv-coll-card.expanded .sv-coll-scripts {
  display: block;
}
.sv-coll-script-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 12px;
  border-radius: 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(127,127,127,0.1);
  margin-bottom: 8px;
}
.sv-coll-script-row:last-child {
  margin-bottom: 0;
}
.sv-coll-script-name {
  flex: 1;
  color: var(--text-primary, #e0e0e0);
  font-weight: 600;
}
.sv-coll-script-note {
  font-size: 11px;
  color: var(--text-muted, #707070);
  font-style: italic;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sv-coll-script-toggle {
  position: relative;
  width: 32px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: var(--toggle-off, #555);
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  appearance: none;
}
.sv-coll-script-toggle.on {
  background: var(--toggle-on, #22c55e);
}
.sv-coll-script-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.sv-coll-script-toggle.on::after {
  transform: translateX(14px);
}
.sv-coll-script-toggle:focus-visible,
.sv-coll-btn:focus-visible,
.sv-coll-modal-close:focus-visible {
  outline: 2px solid rgba(74, 222, 128, 0.45);
  outline-offset: 2px;
}
.sv-coll-script-toggle[disabled],
.sv-coll-btn[disabled] {
  cursor: progress;
  opacity: 0.7;
}

/* Action Buttons */
.sv-coll-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.sv-coll-btn {
  flex: 1;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)),
    var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 14px 24px rgba(0,0,0,0.14);
}
.sv-coll-btn:hover {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)),
    var(--bg-row-hover, #333);
  border-color: rgba(52, 211, 153, 0.24);
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 18px 30px rgba(0,0,0,0.2);
  transform: translateY(-1px);
}
.sv-coll-btn.primary {
  background: linear-gradient(135deg, #34d399, var(--accent-green-dark, #22c55e));
  border-color: rgba(52, 211, 153, 0.34);
  color: #04130a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 18px 32px rgba(34,197,94,0.2);
}
.sv-coll-btn.primary:hover {
  background: linear-gradient(135deg, #6ee7b7, var(--accent-green, #4ade80));
}
.sv-coll-btn.danger {
  border-color: var(--accent-red, #f87171);
  color: var(--accent-red, #f87171);
}
.sv-coll-btn.danger:hover {
  background: rgba(248, 113, 113, 0.12);
}
.sv-coll-btn.inline-install {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 10px;
}

/* Toolbar */
.sv-coll-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  padding: 14px 16px;
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
    var(--bg-section-header, #252525);
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
.sv-coll-toolbar-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #e0e0e0);
  margin-right: auto;
}
.sv-coll-search {
  padding: 10px 12px;
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
    var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  width: 240px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.sv-coll-search:focus {
  border-color: rgba(52, 211, 153, 0.32);
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.12), inset 0 1px 0 rgba(255,255,255,0.06);
}

/* Create/Import Modal */
.sv-coll-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.64);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: sv-coll-fade 0.15s ease;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
@keyframes sv-coll-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.sv-coll-modal {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
    var(--bg-header, #252525);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--panel-border-strong, rgba(148, 163, 184, 0.28));
  border-radius: 24px;
  width: 540px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow-xl, 0 40px 120px rgba(0,0,0,0.34));
  animation: sv-coll-slide 0.2s ease;
}
@keyframes sv-coll-slide {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.sv-coll-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(127,127,127,0.14);
  background: rgba(255,255,255,0.02);
}
.sv-coll-modal-header h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.sv-coll-modal-close {
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0a0);
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.sv-coll-modal-close:hover {
  color: var(--text-primary, #e0e0e0);
}
.sv-coll-modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
}
.sv-coll-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid rgba(127,127,127,0.14);
  background: rgba(255,255,255,0.02);
}
.sv-coll-field {
  margin-bottom: 12px;
}
.sv-coll-field label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.sv-coll-field input,
.sv-coll-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
    var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.sv-coll-field input:focus,
.sv-coll-field textarea:focus {
  border-color: rgba(52, 211, 153, 0.32);
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.12), inset 0 1px 0 rgba(255,255,255,0.06);
}
.sv-coll-field textarea {
  resize: vertical;
  min-height: 60px;
}
.sv-coll-code-input {
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 12px;
}
.sv-coll-script-picker {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
    var(--bg-row, #2a2a2a);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.sv-coll-script-pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 12px;
}
.sv-coll-script-pick-row:hover {
  background: rgba(255,255,255,0.04);
}
.sv-coll-script-pick-row input[type="checkbox"] {
  accent-color: var(--accent-green-dark, #22c55e);
}
.sv-coll-script-pick-note {
  margin-left: auto;
  width: 120px;
  padding: 6px 8px;
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
    var(--bg-input, #333);
  color: var(--text-secondary, #a0a0a0);
  font-size: 11px;
  outline: none;
}
.sv-coll-script-pick-note:focus {
  border-color: rgba(52, 211, 153, 0.32);
}

/* Empty state */
.sv-coll-empty {
  text-align: center;
  padding: 56px 28px;
  color: var(--text-muted, #707070);
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 24px;
  background:
    radial-gradient(circle at top center, rgba(52, 211, 153, 0.14), transparent 48%),
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
}
.sv-coll-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.sv-coll-empty-text {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 18px;
}

/* Toast */
.sv-coll-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
    var(--bg-header, #252525);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid rgba(52, 211, 153, 0.24);
  border-radius: 16px;
  padding: 12px 16px;
  font-size: 13px;
  z-index: 10001;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 24px 42px rgba(0,0,0,0.28);
  animation: sv-coll-fade 0.2s ease;
}

@media (max-width: 768px) {
  .sv-coll-grid {
    gap: 14px;
  }

  .sv-coll-card {
    border-radius: 20px;
    padding: 16px;
  }

  .sv-coll-toolbar {
    padding: 12px;
    border-radius: 18px;
  }

  .sv-coll-search {
    width: 100%;
  }

  .sv-coll-actions {
    flex-direction: column;
  }
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function generateId() {
    return 'coll_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeSelectorValue(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(String(value));
    }
    return String(value).replace(/"/g, '\\"');
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function showToast(msg, duration = 2500) {
    const existing = document.querySelector('.sv-coll-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'sv-coll-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, duration);
  }

  /* ------------------------------------------------------------------ */
  /*  Storage                                                            */
  /* ------------------------------------------------------------------ */

  async function loadCollections() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      _collections = data[STORAGE_KEY] || [];
    } catch {
      _collections = [];
    }
  }

  async function saveCollections() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _collections });
    } catch (e) {
      console.error('[CollectionManager] save error:', e);
    }
  }

  function getInstalledScripts() {
    if (typeof _getScripts === 'function') return _getScripts();
    return _scripts;
  }

  function getCurrentCollectionFilter() {
    return _container?.querySelector('.sv-coll-search')?.value.trim().toLowerCase() || '';
  }

  async function runCollectionButtonTask(button, task, options = {}) {
    const isButton = button instanceof HTMLButtonElement;
    if (isButton && button.disabled) return null;

    const busyLabel = options.busyLabel || '';
    const originalText = isButton ? button.textContent : '';
    const previousDisabled = isButton ? button.disabled : false;
    const previousBusy = button?.getAttribute?.('aria-busy') ?? null;

    try {
      if (isButton) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        if (busyLabel) button.textContent = busyLabel;
      }
      return await task();
    } finally {
      if (isButton && button.isConnected) {
        button.disabled = previousDisabled;
        if (busyLabel) button.textContent = originalText;
        if (previousBusy == null) {
          button.removeAttribute('aria-busy');
        } else {
          button.setAttribute('aria-busy', previousBusy);
        }
      }
    }
  }

  async function setInstalledScriptEnabled(scriptId, enable, options = {}) {
    if (!scriptId) return null;
    if (typeof _onToggle === 'function') {
      return await Promise.resolve(_onToggle(scriptId, enable, options));
    }
    return await chrome.runtime.sendMessage({
      action: 'setScriptSettings',
      scriptId,
      settings: { enabled: enable }
    });
  }

  function markLocalInstalled(script, scriptId, resultScript) {
    if (!scriptId) return;
    script.scriptId = scriptId;
    Object.defineProperty(script, '_localInstalled', {
      value: {
        id: scriptId,
        enabled: resultScript?.enabled !== false,
        code: resultScript?.code || ''
      },
      configurable: true,
      writable: true,
      enumerable: false
    });
  }

  async function fetchGreasyForkCodeUrl(greasyForkId) {
    if (!greasyForkId) throw new Error('Missing Greasy Fork ID');
    const resp = await fetch(`https://api.greasyfork.org/en/scripts/${encodeURIComponent(greasyForkId)}.json`);
    if (!resp.ok) throw new Error(`Greasy Fork lookup failed (${resp.status})`);
    const data = await resp.json();
    if (!data?.code_url) throw new Error('Install URL unavailable for this script');
    return data.code_url;
  }

  async function installCollectionScript(script, coll) {
    if (script.scriptId && typeof _onInstall === 'function') {
      const result = await Promise.resolve(_onInstall(script.scriptId, script));
      if (result?.success === false || result?.error) {
        throw new Error(result.error || 'Install failed');
      }
      const resolvedId = result?.scriptId || result?.script?.id || script.scriptId;
      if (resolvedId) markLocalInstalled(script, resolvedId, result?.script);
      return { scriptId: resolvedId, script: result?.script || null };
    }

    const installUrl = script.installUrl || await fetchGreasyForkCodeUrl(script.greasyForkId);
    const result = await chrome.runtime.sendMessage({ action: 'installFromUrl', url: installUrl });
    if (!result?.success) {
      throw new Error(result?.error || 'Install failed');
    }

    const resolvedId = result?.scriptId || result?.script?.id || null;
    if (resolvedId) {
      markLocalInstalled(script, resolvedId, result.script);
      if (!coll?.builtIn) {
        await saveCollections();
      }
    }

    return { scriptId: resolvedId, script: result?.script || null };
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  function render(filter = '', options = {}) {
    if (!_container) return;

    const allCollections = [...BUILT_IN_COLLECTIONS, ..._collections];
    const expandedCollectionId = options.expandedCollectionId || null;
    const filtered = filter
      ? allCollections.filter(c =>
          c.name.toLowerCase().includes(filter) ||
          c.description.toLowerCase().includes(filter))
      : allCollections;

    const installed = getInstalledScripts();

    _container.innerHTML = '';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'sv-coll-toolbar';
    toolbar.innerHTML = `
      <span class="sv-coll-toolbar-title">Collections</span>
      <input type="search" name="collectionSearch" class="sv-coll-search" aria-label="Search collections" autocomplete="off" spellcheck="false" placeholder="Search collections\u2026"
             value="${escapeHtml(filter)}">
      <button type="button" class="sv-coll-btn" data-action="import">Import</button>
      <button type="button" class="sv-coll-btn primary" data-action="create">+ New</button>
    `;
    _container.appendChild(toolbar);

    const searchInput = toolbar.querySelector('.sv-coll-search');
    searchInput.addEventListener('input', () => {
      render(searchInput.value.trim().toLowerCase());
    });

    toolbar.querySelector('[data-action="create"]').addEventListener('click', () => openCreateModal());
    toolbar.querySelector('[data-action="import"]').addEventListener('click', () => openImportModal());

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sv-coll-empty';
      empty.innerHTML = `
        <div class="sv-coll-empty-icon">\u{1F4E6}</div>
        <div class="sv-coll-empty-text">No collections${filter ? ' match your search' : ' yet'}.</div>
        <button type="button" class="sv-coll-btn primary" data-action="create">Create Collection</button>
      `;
      empty.querySelector('[data-action="create"]').addEventListener('click', () => openCreateModal());
      _container.appendChild(empty);
      return;
    }

    // Grid
    const grid = document.createElement('div');
    grid.className = 'sv-coll-grid';

    for (const coll of filtered) {
      const card = buildCard(coll, installed);
      if (expandedCollectionId === coll.id) {
        card.classList.add('expanded');
        renderExpandedScripts(card, coll, getInstalledScripts());
      }
      grid.appendChild(card);
    }

    _container.appendChild(grid);
  }

  function buildCard(coll, installed) {
    const card = document.createElement('div');
    card.className = 'sv-coll-card';
    card.dataset.id = coll.id;

    const scriptCount = coll.scripts ? coll.scripts.length : 0;
    const totalSize = (coll.scripts || []).reduce((sum, s) => {
      if (s.scriptId) {
        const inst = (installed || []).find(i => i.id === s.scriptId);
        return sum + (inst && inst.code ? inst.code.length : 0);
      }
      return sum;
    }, 0);

    card.innerHTML = `
      <div class="sv-coll-card-header">
        <span class="sv-coll-icon">${coll.icon || '\u{1F4E6}'}</span>
        <span class="sv-coll-title">${escapeHtml(coll.name)}</span>
        ${coll.builtIn ? '<span class="sv-coll-badge">Built-in</span>' : ''}
      </div>
      <div class="sv-coll-desc">${escapeHtml(coll.description || '')}</div>
      <div class="sv-coll-meta">
        <span>\u{1F4DC} ${scriptCount} script${scriptCount !== 1 ? 's' : ''}</span>
        ${totalSize > 0 ? `<span>\u{1F4BE} ${formatBytes(totalSize)}</span>` : ''}
        ${coll.author ? `<span>\u{1F464} ${escapeHtml(coll.author)}</span>` : ''}
      </div>
      <div class="sv-coll-scripts"></div>
    `;

    // Click to toggle expand
    card.querySelector('.sv-coll-card-header').addEventListener('click', () => {
      const wasExpanded = card.classList.contains('expanded');
      // Collapse all
      _container.querySelectorAll('.sv-coll-card.expanded').forEach(c => {
        c.classList.remove('expanded');
        c.querySelector('.sv-coll-scripts').innerHTML = '';
      });
      if (!wasExpanded) {
        card.classList.add('expanded');
        renderExpandedScripts(card, coll, getInstalledScripts());
      }
    });

    return card;
  }

  function renderExpandedScripts(card, coll, installed) {
    const container = card.querySelector('.sv-coll-scripts');
    const scripts = coll.scripts || [];
    const currentInstalled = Array.isArray(installed) ? installed : (getInstalledScripts() || []);

    let html = '';
    for (const s of scripts) {
      const inst = (s.scriptId ? currentInstalled.find(i => i.id === s.scriptId) : null) || s._localInstalled || null;
      const isInstalled = !!inst;
      const isEnabled = inst ? inst.enabled !== false : false;
      const scriptName = escapeHtml(s.name || s.scriptId || 'Unknown');

      html += `
        <div class="sv-coll-script-row" data-script-id="${escapeHtml(s.scriptId || '')}" data-gf-id="${escapeHtml(s.greasyForkId || '')}">
          <span class="sv-coll-script-name">${scriptName}</span>
          ${s.note ? `<span class="sv-coll-script-note" title="${escapeHtml(s.note)}">${escapeHtml(s.note)}</span>` : ''}
          ${isInstalled
            ? `<button type="button" class="sv-coll-script-toggle ${isEnabled ? 'on' : ''}" data-toggle-id="${escapeHtml(s.scriptId)}" aria-pressed="${String(isEnabled)}" aria-label="${isEnabled ? 'Disable' : 'Enable'} ${scriptName}" title="${isEnabled ? 'Disable' : 'Enable'} ${scriptName}"></button>`
            : `<button type="button" class="sv-coll-btn inline-install" data-install-gf="${escapeHtml(s.greasyForkId || '')}" data-install-name="${escapeHtml(s.name || '')}">Install</button>`}
        </div>
      `;
    }

    // Action buttons
    html += `
      <div class="sv-coll-actions">
        <button type="button" class="sv-coll-btn primary" data-action="install-all">Install All</button>
        <button type="button" class="sv-coll-btn" data-action="enable-all">Enable All</button>
        <button type="button" class="sv-coll-btn" data-action="disable-all">Disable All</button>
        <button type="button" class="sv-coll-btn" data-action="export" title="Export collection">Export</button>
        <button type="button" class="sv-coll-btn" data-action="share" title="Shareable link">Share</button>
        ${!coll.builtIn ? '<button type="button" class="sv-coll-btn danger" data-action="delete">Delete</button>' : ''}
      </div>
    `;

    container.innerHTML = html;

    // Toggle listeners
    container.querySelectorAll('.sv-coll-script-toggle').forEach(tog => {
      tog.addEventListener('click', async (e) => {
        e.stopPropagation();
        const scriptId = tog.dataset.toggleId;
        const isOn = tog.classList.contains('on');
        try {
          await runCollectionButtonTask(tog, async () => {
            await setInstalledScriptEnabled(scriptId, !isOn, { control: tog });
            renderExpandedScripts(card, coll, getInstalledScripts());
          });
        } catch (error) {
          showToast(`Toggle failed: ${error.message || 'Unknown error'}`);
        }
      });
    });

    // Install individual
    container.querySelectorAll('[data-install-gf]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const script = scripts.find(s => String(s.greasyForkId || '') === String(btn.dataset.installGf || ''));
        if (!script) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Installing…';

        try {
          const result = await installCollectionScript(script, coll);
          renderExpandedScripts(card, coll, getInstalledScripts());
          showToast(`Installed "${result?.script?.meta?.name || result?.script?.metadata?.name || btn.dataset.installName || script.name || 'script'}"`);
        } catch (error) {
          btn.disabled = false;
          btn.textContent = originalText;
          showToast(`Install failed: ${error.message}`);
        }
      });
    });

    // Bulk actions
    container.querySelector('[data-action="install-all"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await runCollectionButtonTask(e.currentTarget, () => handleInstallAll(coll, card), { busyLabel: 'Installing…' });
    });

    container.querySelector('[data-action="enable-all"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await runCollectionButtonTask(e.currentTarget, () => handleToggleAll(coll, true), { busyLabel: 'Enabling…' });
    });

    container.querySelector('[data-action="disable-all"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await runCollectionButtonTask(e.currentTarget, () => handleToggleAll(coll, false), { busyLabel: 'Disabling…' });
    });

    container.querySelector('[data-action="export"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await runCollectionButtonTask(e.currentTarget, () => Promise.resolve(exportCollection(coll.id)), { busyLabel: 'Exporting…' });
    });

    container.querySelector('[data-action="share"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await runCollectionButtonTask(e.currentTarget, () => shareCollection(coll.id), { busyLabel: 'Sharing…' });
    });

    const delBtn = container.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await runCollectionButtonTask(delBtn, () => {
          if (!window.confirm(`Delete "${coll.name}"?`)) return false;
          return Promise.resolve(deleteCollection(coll.id));
        }, { busyLabel: 'Deleting…' });
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Bulk actions                                                       */
  /* ------------------------------------------------------------------ */

  async function handleInstallAll(coll, card = null) {
    const scripts = coll.scripts || [];
    let installedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const script of scripts) {
      const installed = getInstalledScripts() || [];
      if (script.scriptId && installed.some(s => s.id === script.scriptId)) {
        skippedCount++;
        continue;
      }

      try {
        await installCollectionScript(script, coll);
        installedCount++;
      } catch (error) {
        failedCount++;
      }
    }

    if (card) {
      renderExpandedScripts(card, coll, getInstalledScripts());
    }

    if (installedCount === 0 && skippedCount === 0 && failedCount > 0) {
      showToast(`Install failed for ${failedCount} script${failedCount === 1 ? '' : 's'}`);
      return { success: false, installed: 0, skipped: 0, failed: failedCount };
    }

    const summary = [
      installedCount > 0 ? `${installedCount} installed` : '',
      skippedCount > 0 ? `${skippedCount} already installed` : '',
      failedCount > 0 ? `${failedCount} failed` : ''
    ].filter(Boolean).join(', ');

    showToast(summary || 'Nothing to install');
    return { success: failedCount === 0, installed: installedCount, skipped: skippedCount, failed: failedCount };
  }

  let _onToggle = null;

  async function handleToggleAll(coll, enable) {
    const installed = getInstalledScripts() || [];
    const scripts = coll.scripts || [];
    const toggleTasks = [];
    for (const s of scripts) {
      if (s.scriptId) {
        const inst = installed.find(i => i.id === s.scriptId);
        if (inst && inst.enabled !== enable) {
          toggleTasks.push(setInstalledScriptEnabled(s.scriptId, enable));
        }
      }
    }

    if (toggleTasks.length === 0) {
      showToast(`All installed scripts are already ${enable ? 'enabled' : 'disabled'}`);
      render(getCurrentCollectionFilter(), { expandedCollectionId: coll.id });
      return { toggled: 0, failed: 0 };
    }

    const results = await Promise.allSettled(toggleTasks);
    const failed = results.filter(result => result.status === 'rejected').length;
    const toggled = results.length - failed;

    showToast(failed > 0
      ? `${enable ? 'Enabled' : 'Disabled'} ${toggled} script(s), ${failed} failed`
      : `${enable ? 'Enabled' : 'Disabled'} ${toggled} script(s)`);
    render(getCurrentCollectionFilter(), { expandedCollectionId: coll.id });
    return { toggled, failed };
  }

  /* ------------------------------------------------------------------ */
  /*  Create Modal                                                       */
  /* ------------------------------------------------------------------ */

  function openCreateModal(editing = null) {
    const installed = getInstalledScripts();

    const overlay = document.createElement('div');
    overlay.className = 'sv-coll-overlay';

    const isEdit = !!editing;
    const selectedIds = isEdit ? (editing.scripts || []).map(s => s.scriptId).filter(Boolean) : [];
    const notes = {};
    if (isEdit) {
      (editing.scripts || []).forEach(s => {
        if (s.scriptId && s.note) notes[s.scriptId] = s.note;
      });
    }

    overlay.innerHTML = `
      <div class="sv-coll-modal">
        <div class="sv-coll-modal-header">
          <h3>${isEdit ? 'Edit' : 'Create'} Collection</h3>
          <button type="button" class="sv-coll-modal-close" aria-label="Close collection editor">&times;</button>
        </div>
        <div class="sv-coll-modal-body">
          <div class="sv-coll-field">
            <label>Name</label>
            <input type="text" id="sv-coll-name" placeholder="My Collection"
                   value="${isEdit ? escapeHtml(editing.name) : ''}">
          </div>
          <div class="sv-coll-field">
            <label>Description</label>
            <textarea id="sv-coll-desc" placeholder="What this collection does\u2026">${isEdit ? escapeHtml(editing.description || '') : ''}</textarea>
          </div>
          <div class="sv-coll-field" style="display:flex;gap:12px">
            <div style="flex:1">
              <label>Icon / Emoji</label>
              <input type="text" id="sv-coll-icon" placeholder="\u{1F4E6}" maxlength="4"
                     value="${isEdit ? (editing.icon || '') : ''}" style="width:60px">
            </div>
            <div style="flex:2">
              <label>Author</label>
              <input type="text" id="sv-coll-author" placeholder="Your name"
                     value="${isEdit ? escapeHtml(editing.author || '') : ''}">
            </div>
          </div>
          <div class="sv-coll-field">
            <label>Scripts</label>
            <div class="sv-coll-script-picker" id="sv-coll-picker">
              ${(installed || []).map(s => `
                <div class="sv-coll-script-pick-row">
                  <input type="checkbox" value="${escapeHtml(s.id)}" ${selectedIds.includes(s.id) ? 'checked' : ''}>
                  <span style="flex:1;color:var(--text-primary)">${escapeHtml(s.name || s.id)}</span>
                  <input type="text" class="sv-coll-script-pick-note" data-sid="${escapeHtml(s.id)}"
                         placeholder="Note\u2026" value="${escapeHtml(notes[s.id] || '')}">
                </div>
              `).join('')}
              ${(!installed || installed.length === 0) ? '<div style="padding:12px;color:var(--text-muted);text-align:center">No scripts installed</div>' : ''}
            </div>
          </div>
        </div>
        <div class="sv-coll-modal-footer">
          <button type="button" class="sv-coll-btn" data-action="cancel">Cancel</button>
          <button type="button" class="sv-coll-btn primary" data-action="save">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Events
    overlay.querySelector('.sv-coll-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
      const name = overlay.querySelector('#sv-coll-name').value.trim();
      if (!name) {
        overlay.querySelector('#sv-coll-name').style.borderColor = 'var(--accent-red)';
        return;
      }

      const description = overlay.querySelector('#sv-coll-desc').value.trim();
      const icon = overlay.querySelector('#sv-coll-icon').value.trim() || '\u{1F4E6}';
      const author = overlay.querySelector('#sv-coll-author').value.trim();

      const checked = overlay.querySelectorAll('#sv-coll-picker input[type="checkbox"]:checked');
      const scripts = [];
      checked.forEach(cb => {
        const noteInput = overlay.querySelector(`.sv-coll-script-pick-note[data-sid="${escapeSelectorValue(cb.value)}"]`);
        const inst = (installed || []).find(i => i.id === cb.value);
        scripts.push({
          scriptId: cb.value,
          name: inst ? (inst.name || cb.value) : cb.value,
          note: noteInput ? noteInput.value.trim() : ''
        });
      });

      if (isEdit) {
        const idx = _collections.findIndex(c => c.id === editing.id);
        if (idx >= 0) {
          _collections[idx] = { ..._collections[idx], name, description, icon, author, scripts };
        }
      } else {
        _collections.push({
          id: generateId(),
          name,
          description,
          icon,
          author,
          builtIn: false,
          scripts,
          createdAt: Date.now()
        });
      }

      saveCollections();
      overlay.remove();
      render();
      showToast(isEdit ? 'Collection updated' : 'Collection created');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Import Modal                                                       */
  /* ------------------------------------------------------------------ */

  function openImportModal() {
    const overlay = document.createElement('div');
    overlay.className = 'sv-coll-overlay';
    overlay.innerHTML = `
      <div class="sv-coll-modal">
        <div class="sv-coll-modal-header">
          <h3>Import Collection</h3>
          <button type="button" class="sv-coll-modal-close" aria-label="Close collection importer">&times;</button>
        </div>
        <div class="sv-coll-modal-body">
          <div class="sv-coll-field">
            <label>Paste JSON Manifest</label>
            <textarea id="sv-coll-import-json" class="sv-coll-code-input" rows="10"
                      placeholder='{"name":"My Collection","scripts":[...]}'
                      ></textarea>
          </div>
          <div class="sv-coll-field">
            <label>Or load from file</label>
            <input type="file" id="sv-coll-import-file" accept=".json"
                   style="font-size:12px;color:var(--text-secondary)">
          </div>
        </div>
        <div class="sv-coll-modal-footer">
          <button type="button" class="sv-coll-btn" data-action="cancel">Cancel</button>
          <button type="button" class="sv-coll-btn primary" data-action="import">Import</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.sv-coll-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const fileInput = overlay.querySelector('#sv-coll-import-file');
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        overlay.querySelector('#sv-coll-import-json').value = reader.result;
      };
      reader.readAsText(file);
    });

    overlay.querySelector('[data-action="import"]').addEventListener('click', () => {
      const raw = overlay.querySelector('#sv-coll-import-json').value.trim();
      if (!raw) return;
      try {
        const result = importCollection(raw);
        overlay.remove();
        if (result.success) {
          showToast(`Imported "${result.name}"`);
          render();
        }
      } catch (e) {
        showToast('Invalid JSON: ' + e.message);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Import / Export / Share                                             */
  /* ------------------------------------------------------------------ */

  function importCollection(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    if (!data.name || !Array.isArray(data.scripts)) {
      throw new Error('Invalid collection manifest: requires "name" and "scripts" array');
    }

    const coll = {
      id: generateId(),
      name: data.name,
      description: data.description || '',
      icon: data.icon || '\u{1F4E6}',
      author: data.author || '',
      builtIn: false,
      scripts: data.scripts.map(s => ({
        scriptId: s.scriptId || '',
        name: s.name || s.scriptId || 'Unknown',
        note: s.note || '',
        greasyForkId: s.greasyForkId || null,
        url: s.url || ''
      })),
      createdAt: Date.now(),
      importedAt: Date.now()
    };

    _collections.push(coll);
    saveCollections();
    return { success: true, name: coll.name, id: coll.id };
  }

  function exportCollection(collectionId) {
    const all = [...BUILT_IN_COLLECTIONS, ..._collections];
    const coll = all.find(c => c.id === collectionId);
    if (!coll) return null;

    const manifest = {
      name: coll.name,
      description: coll.description || '',
      icon: coll.icon || '',
      author: coll.author || '',
      scripts: (coll.scripts || []).map(s => ({
        name: s.name,
        scriptId: s.scriptId || undefined,
        greasyForkId: s.greasyForkId || undefined,
        url: s.url || undefined,
        note: s.note || undefined
      })),
      exportedAt: new Date().toISOString(),
      source: 'ScriptVault'
    };

    const json = JSON.stringify(manifest, null, 2);

    // Trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-${coll.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('Collection exported');
    return json;
  }

  async function shareCollection(collectionId) {
    const all = [...BUILT_IN_COLLECTIONS, ..._collections];
    const coll = all.find(c => c.id === collectionId);
    if (!coll) return null;

    const manifest = {
      name: coll.name,
      description: coll.description || '',
      icon: coll.icon || '',
      author: coll.author || '',
      scripts: (coll.scripts || []).map(s => ({
        name: s.name,
        greasyForkId: s.greasyForkId || undefined,
        note: s.note || undefined
      }))
    };

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(manifest))));
    const dataUrl = `data:application/json;base64,${encoded}`;

    const fallbackCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = dataUrl;
      document.body.appendChild(ta);
      ta.select();
      try {
        return typeof document.execCommand === 'function' && document.execCommand('copy') !== false;
      } finally {
        ta.remove();
      }
    };

    let copied = false;
    try {
      if (typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(dataUrl);
        copied = true;
      } else {
        copied = fallbackCopy();
      }
    } catch {
      copied = fallbackCopy();
    }

    showToast(copied ? 'Shareable link copied to clipboard' : 'Shareable link ready to copy');

    return dataUrl;
  }

  /* ------------------------------------------------------------------ */
  /*  Delete                                                             */
  /* ------------------------------------------------------------------ */

  function deleteCollection(collectionId) {
    const idx = _collections.findIndex(c => c.id === collectionId);
    if (idx < 0) return false;
    const name = _collections[idx].name;
    _collections.splice(idx, 1);
    saveCollections();
    render();
    showToast(`Deleted "${name}"`);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialise the Collections UI.
     * @param {HTMLElement} containerEl - element to render into
     * @param {Object} [opts]
     * @param {Function} [opts.getScripts] - () => script[]
     * @param {Function} [opts.onInstall]  - async (scriptId, script) => result
     * @param {Function} [opts.onToggle]   - (scriptId, enable) => void
     */
    async init(containerEl, opts = {}) {
      _container = containerEl;
      _getScripts = opts.getScripts || null;
      _onInstall = opts.onInstall || null;
      _onToggle = opts.onToggle || null;
      _scripts = opts.scripts || [];

      // Inject CSS
      if (!document.getElementById(STYLE_ID)) {
        _styleEl = document.createElement('style');
        _styleEl.id = STYLE_ID;
        _styleEl.textContent = STYLES;
        document.head.appendChild(_styleEl);
      }

      await loadCollections();
      _initialized = true;
      render();
    },

    /**
     * Create a new collection.
     */
    createCollection(name, scriptIds, options = {}) {
      const installed = getInstalledScripts();
      const scripts = (scriptIds || []).map(id => {
        const inst = (installed || []).find(i => i.id === id);
        return {
          scriptId: id,
          name: inst ? (inst.name || id) : id,
          note: (options.notes && options.notes[id]) || ''
        };
      });

      const coll = {
        id: generateId(),
        name,
        description: options.description || '',
        icon: options.icon || '\u{1F4E6}',
        author: options.author || '',
        builtIn: false,
        scripts,
        createdAt: Date.now()
      };

      _collections.push(coll);
      saveCollections();
      if (_initialized) render();
      return coll;
    },

    /**
     * Get all collections (built-in + user).
     */
    getCollections() {
      return [...BUILT_IN_COLLECTIONS, ..._collections];
    },

    /**
     * Install all scripts in a collection.
     */
    async installCollection(collectionId) {
      const all = [...BUILT_IN_COLLECTIONS, ..._collections];
      const coll = all.find(c => c.id === collectionId);
      if (!coll) return { success: false, error: 'Collection not found' };
      const result = await handleInstallAll(coll);
      return { ...result, name: coll.name, scriptCount: (coll.scripts || []).length };
    },

    /**
     * Export collection as JSON (also triggers download).
     */
    exportCollection(collectionId) {
      return exportCollection(collectionId);
    },

    /**
     * Import a collection from JSON string or object.
     */
    importCollection(json) {
      const result = importCollection(json);
      if (_initialized) render();
      return result;
    },

    /**
     * Delete a user collection.
     */
    deleteCollection(collectionId) {
      return deleteCollection(collectionId);
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

// Make available for ES module or script tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CollectionManager };
}
