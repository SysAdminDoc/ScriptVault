// ScriptVault v2.0.0 — What's New Changelog Modal
// Shows once per version on first dashboard visit after update

const WhatsNew = (() => {
  'use strict';

  const CURRENT_VERSION = '2.0.0';

  const CHANGELOG = {
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

  function _injectStyles() {
    if (document.getElementById('sv-whatsnew-css')) return;
    const style = document.createElement('style');
    style.id = 'sv-whatsnew-css';
    style.textContent = `
      .sv-wn-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:10000; display:flex; align-items:center; justify-content:center; animation:svWnFadeIn 0.2s ease; }
      @keyframes svWnFadeIn { from { opacity:0 } to { opacity:1 } }
      .sv-wn-modal { background:var(--bg-content,#242424); border:1px solid var(--border-color,#444); border-radius:12px; width:640px; max-width:90vw; max-height:85vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5); animation:svWnSlideUp 0.3s ease; }
      @keyframes svWnSlideUp { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }
      .sv-wn-header { padding:20px 24px 16px; border-bottom:1px solid var(--border-color,#444); }
      .sv-wn-header h2 { font-size:18px; color:var(--text-primary,#e0e0e0); margin-bottom:4px; }
      .sv-wn-header .sv-wn-version { font-size:12px; color:var(--accent-primary,#22c55e); font-weight:600; }
      .sv-wn-header .sv-wn-date { font-size:11px; color:var(--text-muted,#666); margin-left:8px; }
      .sv-wn-body { flex:1; overflow-y:auto; padding:16px 24px 20px; }
      .sv-wn-highlights { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; }
      @media (max-width:500px) { .sv-wn-highlights { grid-template-columns:1fr; } }
      .sv-wn-card { display:flex; gap:10px; padding:10px 12px; background:var(--bg-input,#1a1a1a); border:1px solid var(--border-color,#444); border-radius:8px; transition:border-color 0.15s; }
      .sv-wn-card:hover { border-color:var(--accent-primary,#22c55e); }
      .sv-wn-card-icon { font-size:20px; flex-shrink:0; line-height:1.2; }
      .sv-wn-card-title { font-size:12px; font-weight:600; color:var(--text-primary,#e0e0e0); margin-bottom:2px; }
      .sv-wn-card-desc { font-size:11px; color:var(--text-secondary,#a0a0a0); line-height:1.4; }
      .sv-wn-section-title { font-size:13px; font-weight:600; color:var(--text-primary,#e0e0e0); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em; }
      .sv-wn-improvements { list-style:none; padding:0; }
      .sv-wn-improvements li { font-size:12px; color:var(--text-secondary,#a0a0a0); padding:3px 0; padding-left:16px; position:relative; }
      .sv-wn-improvements li::before { content:'\\2713'; position:absolute; left:0; color:var(--accent-primary,#22c55e); font-weight:bold; }
      .sv-wn-footer { padding:12px 24px; border-top:1px solid var(--border-color,#444); display:flex; justify-content:space-between; align-items:center; }
      .sv-wn-dismiss { padding:8px 20px; background:var(--accent-primary,#22c55e); border:none; border-radius:6px; color:#fff; font-weight:600; font-size:13px; cursor:pointer; transition:background 0.15s; }
      .sv-wn-dismiss:hover { filter:brightness(1.1); }
      .sv-wn-skip { color:var(--text-muted,#666); font-size:12px; cursor:pointer; text-decoration:underline; }
      .sv-wn-skip:hover { color:var(--text-secondary,#a0a0a0); }
    `;
    document.head.appendChild(style);
  }

  return {
    async shouldShow() {
      try {
        const data = await chrome.storage.local.get('lastSeenVersion');
        return data.lastSeenVersion !== CURRENT_VERSION;
      } catch { return false; }
    },

    show() {
      const entry = CHANGELOG[CURRENT_VERSION];
      if (!entry) return;

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

      overlay.innerHTML = `
        <div class="sv-wn-modal">
          <div class="sv-wn-header">
            <h2>${entry.title}</h2>
            <span class="sv-wn-version">v${CURRENT_VERSION}</span>
            <span class="sv-wn-date">${entry.date}</span>
          </div>
          <div class="sv-wn-body">
            <div class="sv-wn-highlights">${highlightsHtml}</div>
            <div class="sv-wn-section-title">Other Improvements</div>
            <ul class="sv-wn-improvements">${improvementsHtml}</ul>
          </div>
          <div class="sv-wn-footer">
            <span class="sv-wn-skip" id="svWnSkip">Don't show again</span>
            <button class="sv-wn-dismiss" id="svWnDismiss">Got it!</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const dismiss = () => {
        chrome.storage.local.set({ lastSeenVersion: CURRENT_VERSION });
        overlay.remove();
      };

      overlay.querySelector('#svWnDismiss').addEventListener('click', dismiss);
      overlay.querySelector('#svWnSkip').addEventListener('click', dismiss);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
      document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', handler); }
      });
    }
  };
})();
