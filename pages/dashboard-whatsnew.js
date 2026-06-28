// ScriptVault v2.0.0 — What's New Changelog Modal
// Shows once per version on first dashboard visit after update

const WhatsNew = (() => {
  'use strict';

  const CURRENT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
    ? chrome.runtime.getManifest().version
    : '2.0.0';

  const CHANGELOG = {
    '3.11.0': {
      title: 'ScriptVault 3.11.0 — Storage & Runtime Hardening',
      date: '2026-05-19',
      highlights: [
        { icon: 'DB', title: 'Rollback-Safe Storage', desc: 'Script, settings, folder, workspace, and GM-value writes now restore their prior state if persistence fails.' },
        { icon: 'RX', title: 'Regex Dashboard Search', desc: 'Search supports re: patterns and slash-delimited regex, with invalid patterns surfaced instead of throwing.' },
        { icon: 'CM', title: 'Context-Menu Scripts', desc: '@run-at context-menu scripts now appear as direct popup launchers when they match the active tab.' },
        { icon: 'URL', title: 'SPA URL Change Events', desc: 'window.onurlchange now follows navigation events for single-page apps, with history/hash fallbacks preserved.' },
        { icon: 'API', title: 'Safer GM_addElement', desc: 'GM_addElement now returns null on failure paths instead of throwing through script execution.' },
        { icon: '130', title: 'Chrome 130 Baseline', desc: 'The Chrome floor now aligns with storage.session support and the current extension security baseline.' }
      ],
      improvements: [
        'Added a GM_info.script.tag alias for older scripts that expect the singular form',
        'Changed per-script update controls to a clearer check-first confirmation flow',
        'Grouped storage-hardening fixes under the v3.11.0 release ledger',
        'Pinned rollback regressions for script, settings, folder, workspace, and value writes',
        'Kept Firefox runtime fallbacks for URL-change detection while preserving Chrome navigation events',
        'Synced the Firefox manifest to the v3.11.0 release version'
      ]
    },
    '2.0.2': {
      title: 'ScriptVault 2.0.2 — Bug Fixes & Quality',
      date: '2026-03-27',
      highlights: [
        { icon: '🔧', title: 'Editor History Fix', desc: 'Undo/redo history now properly saves and restores when switching tabs (was silently broken).' },
        { icon: '📱', title: 'Scannable QR Codes', desc: 'QR code generator fixed — alignment patterns no longer corrupted by masking. Codes now scan correctly.' },
        { icon: '💾', title: 'Download Reliability', desc: 'All file downloads (export, backup, HAR, CSV) now reliably complete before blob URLs are released.' },
        { icon: '⏰', title: 'Service Worker Safety', desc: 'Long notification timeouts use chrome.alarms to survive service worker shutdown.' }
      ],
      improvements: [
        'Time range scheduler shows both segments for wrapping ranges (10PM-6AM)',
        'Snippet search preserves cursor position when typing mid-string',
        'Standalone export syntax highlighting no longer double-wraps keywords in strings',
        'CDN library URLs validated against path traversal attacks',
        'Failed tab loads show error toast instead of blank panel',
        'Command palette has proper ARIA label for screen readers',
        'Storage viewer handles null values cleanly',
        'Removed broken ESLint npm script, synced all version strings'
      ]
    },
    '2.0.0': {
      title: 'ScriptVault 2.0 — The Complete Userscript Platform',
      date: '2026-03-24',
      highlights: [
        { icon: '🛍️', title: 'Built-in Script Store', desc: 'Search, browse, and install scripts from Greasy Fork — right from the dashboard.' },
        { icon: '🐛', title: 'Script Debugger', desc: 'Per-script console capture, live reload on save, variable inspector, and error timeline.' },
        { icon: '🗂️', title: 'Card View', desc: 'Toggle between table and visual card view with site favicons and status indicators.' },
        { icon: '⌨️', title: 'Keyboard Navigation & Vim Mode', desc: 'Full keyboard-first navigation with optional Vim keybindings. Press ? for help.' },
        { icon: '🔗', title: 'URL Pattern Builder', desc: 'Visually construct @match patterns by decomposing URLs into editable segments.' },
        { icon: '☁️', title: 'Zero-Config Cloud Sync', desc: 'One-click Google Drive sync via chrome.identity — no manual OAuth setup.' },
        { icon: '📦', title: 'npm Package Resolution', desc: 'Use @require npm:lodash to auto-resolve packages via CDN with SRI verification.' },
        { icon: '🔔', title: 'Smart Notifications', desc: 'Update alerts, error notifications after 3 consecutive failures, and optional weekly digest.' },
        { icon: '📋', title: 'Error Log & Export', desc: '500-entry structured error log with JSON/CSV/text export and error grouping.' },
        { icon: '♿', title: 'Accessibility (WCAG 2.1 AA)', desc: 'ARIA labels, focus trapping, screen reader announcements, high contrast, and reduced motion.' }
      ],
      improvements: [
        'esbuild-based build system with minification and source maps',
        'JSDoc type annotations on critical functions',
        'Removed 605KB of unused libraries (Yjs, CodeMirror addons)',
        'Console capture and error reporting injected into every userscript',
        'Live reload support — auto-refresh pages when scripts are saved',
        'CWS review prompt after 7 days of active use',
        'Sidepanel search, sorting, and script count enhancements',
        'Popup: running status pulse, quick-edit button, recently-installed highlight',
        '30+ new background message handlers for v2.0 modules',
        'Version bumped to 2.0.0 across all files'
      ]
    }
  };

  const _dashboardUi = (typeof window !== 'undefined') ? window.ScriptVaultDashboardUI : null;
  const _safeSetHtml = (typeof _dashboardUi?.safeSetHtml === 'function')
      ? _dashboardUi.safeSetHtml
      : (el, html) => {
        el.replaceChildren(document.createRange().createContextualFragment(String(html ?? '')));
      };

  function _hasChangelogEntry(version) {
    return Object.prototype.hasOwnProperty.call(CHANGELOG, version);
  }

  function _getChangelogEntry(version = CURRENT_VERSION) {
    return CHANGELOG[version] || null;
  }

  function _injectStyles() {
    if (document.getElementById('sv-whatsnew-css')) return;
    const style = document.createElement('style');
    style.id = 'sv-whatsnew-css';
    style.textContent = `
      .sv-wn-overlay { position:fixed; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0.74), rgba(0,0,0,0.66)); z-index:10000; display:flex; align-items:center; justify-content:center; padding:24px; animation:svWnFadeIn 0.16s ease; }
      @keyframes svWnFadeIn { from { opacity:0 } to { opacity:1 } }
      .sv-wn-modal { background:linear-gradient(180deg, rgba(255,255,255,0.035), transparent 38%), var(--bg-content,#242424); border:1px solid var(--border-color,#444); border-radius:8px; width:680px; max-width:min(92vw,680px); max-height:min(86vh,720px); overflow:hidden; display:flex; flex-direction:column; box-shadow:0 24px 70px rgba(0,0,0,0.54); animation:svWnSlideUp 0.22s ease; }
      @keyframes svWnSlideUp { from { transform:translateY(12px); opacity:0 } to { transform:translateY(0); opacity:1 } }
      .sv-wn-header { padding:22px 24px 17px; border-bottom:1px solid var(--border-color,#444); background:rgba(255,255,255,0.02); }
      .sv-wn-header h2 { font-size:1.0625rem; line-height:1.25; color:var(--text-primary,#e0e0e0); margin-bottom:8px; letter-spacing:0; }
      .sv-wn-header .sv-wn-meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .sv-wn-header .sv-wn-version { font-size:0.75rem; color:var(--accent-primary,#22c55e); font-weight:700; font-variant-numeric:tabular-nums; }
      .sv-wn-header .sv-wn-date { font-size:0.6875rem; color:var(--text-muted,#666); }
      .sv-wn-summary { margin-top:10px; max-width:54rem; color:var(--text-secondary,#a0a0a0); font-size:0.75rem; line-height:1.5; }
      .sv-wn-body { flex:1; overflow-y:auto; padding:17px 24px 20px; }
      .sv-wn-highlights { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:22px; }
      @media (max-width:31.25rem) { .sv-wn-highlights { grid-template-columns:1fr; } }
      .sv-wn-card { display:grid; grid-template-columns:auto minmax(0,1fr); gap:10px; padding:12px 13px; background:rgba(255,255,255,0.025); border:1px solid rgba(127,127,127,0.24); border-radius:8px; transition:border-color 0.15s ease, background 0.15s ease, transform 0.15s ease; }
      .sv-wn-card:hover { border-color:rgba(34,197,94,0.42); background:rgba(34,197,94,0.055); transform:translateY(-1px); }
      .sv-wn-card-icon { min-width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid rgba(34,197,94,0.26); border-radius:7px; background:rgba(34,197,94,0.08); color:var(--accent-primary,#22c55e); font-size:0.625rem; font-weight:800; line-height:1; letter-spacing:0.06em; font-variant-numeric:tabular-nums; }
      .sv-wn-card-title { font-size:0.75rem; font-weight:700; color:var(--text-primary,#e0e0e0); margin-bottom:3px; }
      .sv-wn-card-desc { font-size:0.6875rem; color:var(--text-secondary,#a0a0a0); line-height:1.45; }
      .sv-wn-section-title { font-size:0.75rem; font-weight:800; color:var(--text-primary,#e0e0e0); margin-bottom:9px; text-transform:uppercase; letter-spacing:0.06em; }
      .sv-wn-improvements { list-style:none; padding:0; display:grid; gap:5px; }
      .sv-wn-improvements li { display:grid; grid-template-columns:16px minmax(0,1fr); gap:7px; align-items:start; font-size:0.75rem; color:var(--text-secondary,#a0a0a0); line-height:1.45; }
      .sv-wn-improvements li::before { content:'OK'; color:var(--accent-primary,#22c55e); font-size:0.5625rem; font-weight:800; letter-spacing:0.04em; line-height:1.9; }
      .sv-wn-footer { padding:13px 24px; border-top:1px solid var(--border-color,#444); display:flex; justify-content:space-between; align-items:center; gap:12px; background:rgba(255,255,255,0.02); }
      .sv-wn-dismiss { min-height:32px; padding:7px 20px; background:var(--accent-primary,#22c55e); border:1px solid var(--accent-primary,#22c55e); border-radius:7px; color:#fff; font-weight:700; font-size:0.8125rem; cursor:pointer; transition:background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
      .sv-wn-dismiss:hover { filter:brightness(1.08); transform:translateY(-1px); box-shadow:0 10px 20px rgba(34,197,94,0.2); }
      .sv-wn-skip { min-height:32px; padding:7px 0; border:0; background:transparent; color:var(--text-muted,#666); font:inherit; font-size:0.75rem; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
      .sv-wn-skip:hover { color:var(--text-secondary,#a0a0a0); }
      .sv-wn-dismiss:focus-visible,
      .sv-wn-skip:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(34,197,94,0.2); }
      @media (prefers-reduced-motion: reduce) {
        .sv-wn-overlay,
        .sv-wn-modal,
        .sv-wn-card { animation:none; transition:none; }
      }
    `;
    document.head.appendChild(style);
  }

  return {
    async shouldShow() {
      try {
        const data = await chrome.storage.local.get('lastSeenVersion');
        const lastSeen = data.lastSeenVersion || '0.0.0';
        // Only show for major/minor version changes (not patch bumps)
        const lastMajorMinor = lastSeen.split('.').slice(0, 2).join('.');
        const currentMajorMinor = CURRENT_VERSION.split('.').slice(0, 2).join('.');
        // Also check if there's actually a changelog entry for the exact
        // packaged version. A major/minor match is not enough because show()
        // renders by exact CURRENT_VERSION.
        const hasEntry = _hasChangelogEntry(CURRENT_VERSION);
        return lastMajorMinor !== currentMajorMinor && hasEntry;
      } catch { return false; }
    },

    show() {
      const entry = _getChangelogEntry(CURRENT_VERSION);
      if (!entry) {
        // Mark as seen even without a matching entry to prevent infinite re-check
        chrome.storage.local.set({ lastSeenVersion: CURRENT_VERSION });
        return;
      }

      _injectStyles();

      const overlay = document.createElement('div');
      overlay.className = 'sv-wn-overlay';

      const highlightsHtml = entry.highlights.map(h => `
        <div class="sv-wn-card">
          <div class="sv-wn-card-icon">${h.icon}</div>
          <div>
            <div class="sv-wn-card-title">${h.title}</div>
            <div class="sv-wn-card-desc">${h.desc}</div>
          </div>
        </div>
      `).join('');

      const improvementsHtml = entry.improvements.map(i => `<li>${i}</li>`).join('');

      _safeSetHtml(overlay, `
        <div class="sv-wn-modal" role="dialog" aria-modal="true" aria-labelledby="svWnTitle" aria-describedby="svWnSummary" tabindex="-1">
          <div class="sv-wn-header">
            <h2 id="svWnTitle">${entry.title}</h2>
            <div class="sv-wn-meta">
              <span class="sv-wn-version">v${CURRENT_VERSION}</span>
              <span class="sv-wn-date">${entry.date}</span>
            </div>
            <p class="sv-wn-summary" id="svWnSummary">This release focuses on safer persistence, clearer script review, and runtime compatibility work that reduces surprise during everyday script management.</p>
          </div>
          <div class="sv-wn-body">
            <div class="sv-wn-highlights">${highlightsHtml}</div>
            <div class="sv-wn-section-title">Other Improvements</div>
            <ul class="sv-wn-improvements">${improvementsHtml}</ul>
          </div>
          <div class="sv-wn-footer">
            <button class="sv-wn-skip" id="svWnSkip" type="button">Don't show again</button>
            <button class="sv-wn-dismiss" id="svWnDismiss" type="button">Continue</button>
          </div>
        </div>
      `);

      document.body.appendChild(overlay);

      const escHandler = (e) => {
        if (e.key === 'Escape') dismiss();
      };

      const dismiss = () => {
        chrome.storage.local.set({ lastSeenVersion: CURRENT_VERSION });
        document.removeEventListener('keydown', escHandler);
        overlay.remove();
      };

      overlay.querySelector('#svWnDismiss').addEventListener('click', dismiss);
      overlay.querySelector('#svWnSkip').addEventListener('click', dismiss);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
      document.addEventListener('keydown', escHandler);
      overlay.querySelector('#svWnDismiss')?.focus({ preventScroll: true });
    },

    getEntry: _getChangelogEntry,
    getVersions() {
      return Object.keys(CHANGELOG);
    },
  };
})();
