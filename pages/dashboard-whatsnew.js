// ScriptVault v2.0.0 — What's New Changelog Modal
// Shows once per version on first dashboard visit after update

const WhatsNew = (() => {
  'use strict';

  function escapeHtml(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  const CURRENT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
    ? chrome.runtime.getManifest().version
    : '2.0.0';

  const CHANGELOG = {
    '3.19.2': {
      title: 'ScriptVault 3.19.2 — Scripts Run On Install Again',
      date: '2026-07-13',
      highlights: [
        { icon: 'FLOW', title: 'Broad Host Access Restored', desc: 'On Chromium builds ScriptVault once again requests full site access at install, so your userscripts run everywhere immediately instead of stalling on a "Site Access Needed" prompt.' },
        { icon: 'SAFE', title: 'Scoped Host Permissions Now Opt-In', desc: 'The per-site scoped host permission model is still available, but it is turned off by default. Enable "Use scoped host permissions" in Settings if you prefer granting access one origin at a time.' },
      ],
      improvements: [
        'Fixes broad all-site scripts that were being unregistered until manually approved per script.',
        'Firefox behavior is unchanged — it always shipped with broad host access.',
      ],
    },
    '3.19.1': {
      title: 'ScriptVault 3.19.1 — Premium Workbench Parity',
      date: '2026-07-09',
      highlights: [
        { icon: 'FLOW', title: 'A Real Workbench Navigation Model', desc: 'The visible navigation rail is now the keyboard-accessible dashboard tablist, compact layouts keep the main workflow close, and workspace health reports the local and sync state honestly.' },
        { icon: 'STATE', title: 'Polished States on Every Surface', desc: 'Updates, Settings, Utilities, Trash, Help, popup, side panel, install review, DevTools, and the editor now share deliberate loading, empty, selected, disabled, saved, and recovery states.' },
        { icon: 'SAFE', title: 'Reliable Settings and Editor Recovery', desc: 'Same-setting autosaves are serialized and roll back cleanly on failure, while a visible basic editor preserves editing and saving when the full Monaco surface cannot load.' },
      ],
      improvements: [
        'Theme bootstrap is cached before paint so compact surfaces no longer flash or capture a mixed palette.',
        'Popup global controls announce whether they enable or disable scripts, and the side panel removes duplicate empty library chrome.',
        'DevTools wraps its command surface on narrow panes and keeps request detail usable as an overlay.',
        'Rendered screenshot coverage now spans every dashboard destination and all four supported themes.',
      ],
    },
    '3.19.0': {
      title: 'ScriptVault 3.19.0 â€” Professional Workbench',
      date: '2026-07-09',
      highlights: [
        { icon: 'WORK', title: 'Focused Script Workspace', desc: 'Scripts now open into a clear page header, primary action group, live vault metrics, dense filter controls, and a contextual trust/access inspector that stays useful without competing with the table.' },
        { icon: 'SURF', title: 'One Interface Across Every Surface', desc: 'The dashboard, popup, side panel, install review, DevTools diagnostics, and editor chrome now share the same graphite-and-emerald surface hierarchy, controls, focus treatment, and state language.' },
        { icon: 'VIEW', title: 'Four Themes, Visually Gated', desc: 'Dark, light, Catppuccin, and OLED dashboard layouts each have a browser-rendered regression baseline so theme-specific contrast and layout drift fail locally before release.' },
      ],
      improvements: [
        'Setup guidance is calmer and more compact without hiding the main workspace.',
        'Empty, loading, warning, selected, disabled, and diagnostics states use consistent hierarchy and recovery copy.',
        'Screenshot capture now covers dashboard, popup, side panel, install review, and DevTools without the release modal obscuring the product.',
        'Dashboard and editor smoke tests wait for the final workbench stylesheet and verify the redesigned controls are hit-testable.',
      ],
    },
    '3.18.2': {
      title: 'ScriptVault 3.18.2 — Deep Audit Hardening 2',
      date: '2026-07-09',
      highlights: [
        { icon: 'LOCK', title: 'Tighter Credential and Request Boundaries', desc: 'EasyCloud now revokes OAuth tokens via POST body instead of the URL, and GM_xmlhttpRequest_abort is bound to the owning script so one script cannot cancel another\'s network requests.' },
        { icon: 'ERASE', title: 'Factory Reset Truly Erases Data', desc: 'Factory reset now clears backup blobs and publication receipts from IndexedDB, so full restorable script code and GM values no longer survive a wipe.' },
        { icon: 'CHART', title: 'Accurate Storage and Activity Views', desc: 'Storage usage is measured origin-wide so automatic cleanup can fire, and the activity heatmap no longer clips the most recent days off the grid.' },
      ],
      improvements: [
        'Gist import shows a clear "No .user.js files found" message on malformed Gist payloads instead of a raw error.',
        'Collection reinstall explains when a local-only entry has no source URL rather than showing a cryptic Greasy Fork ID error.',
        'Dependency provenance now reports an explicit "verification unavailable" review state instead of a placeholder.',
      ],
    },
    '3.18.1': {
      title: 'ScriptVault 3.18.1 — Deep Audit Hardening',
      date: '2026-07-09',
      highlights: [
        { icon: 'LOCK', title: 'Sender-Bound Execution Reports', desc: 'reportExecTime and reportExecError now validate sender.userScriptId so scripts cannot spoof execution stats or trigger chains for other scripts.' },
        { icon: 'PAINT', title: 'Theme-Aware Workbench Shell', desc: 'All 20+ hardcoded accent tints in the workbench now use color-mix() with theme tokens. Catppuccin and OLED overrides are added so every surface renders with the correct palette.' },
        { icon: 'FIX', title: 'Edge Case Reliability', desc: 'Trust receipt provenance, install keydown listeners, popup URL copy, settings save error handling, What\'s New HTML escaping, and scheduler slider bounds are all fixed.' },
      ],
      improvements: [
        'Sidepanel timing badges and toggle controls now respect all four themes instead of dark-only fallbacks.',
        'Dashboard toggle dot uses the theme token instead of hardcoded white.',
        'Light-theme popup confirming state uses a legible dark red instead of pale pink.',
        'Dashboard row separators use var(--sv-overlay-faint) for correct visibility in all themes.',
      ],
    },
    '3.18.0': {
      title: 'ScriptVault 3.18.0 — Release Hardening Audit',
      date: '2026-07-09',
      highlights: [
        { icon: 'LOCK', title: 'Safer Sync and Public API Boundaries', desc: 'Manual cloud imports and exports now use the same encrypted sync envelopes as scheduled sync, and trusted page / Local MCP messages reach the Public API through a content-script relay with background authorization.' },
        { icon: 'NET', title: 'Bounded Network Runtime', desc: 'GM_xmlhttpRequest and @require caches now have explicit limits so runaway scripts cannot grow request tables or dependency cache memory without bound.' },
        { icon: 'SHIP', title: 'Hardened Release Packaging', desc: 'Chrome Web Store publish packaging now uses the same explicit artifact list as local builds, and Firefox smoke tests reject stale package ZIPs instead of silently installing an older build.' },
      ],
      improvements: [
        'Collection deletes now use the dashboard modal confirmation flow',
        'Command palette, sidepanel launch, DevTools clear, and large diff edge cases were tightened',
        'Browser smoke cleanup handles crashes and interrupted launches more reliably',
      ],
    },
    '3.17.0': {
      title: 'ScriptVault 3.17.0 — Trust Enforcement & Sync Safety',
      date: '2026-07-02',
      highlights: [
        { icon: 'LOCK', title: 'Enforce Verified Dependencies', desc: 'Set Security → Subresource Integrity to "Require" to refuse any @require that loads unverified remote code. Un-pinned dependencies are now flagged at install as "unverified remote code".' },
        { icon: 'SCAN', title: 'Scam / Wallet-Drainer Detection', desc: 'The analyzer flags scripts that harvest wallet seed phrases or private keys and send data off-page — a high-severity "possible credential/wallet exfiltration" warning at install.' },
        { icon: 'SITE', title: 'Only on This Site', desc: 'One click in the popup menu restricts a script to the current site. The dashboard match editor now validates @match patterns.' },
        { icon: 'SYNC', title: 'Safer Sync & Backups', desc: 'Easy Cloud got the sync merge fixes (restored scripts survive), cloud backups no longer collide with the sync file (and encrypt under E2EE), and backup blobs are gzip-compressed.' },
      ],
      improvements: [
        'Fixed a SettingsManager write race that could drop a refreshed OAuth token',
        'Cloud backup uploads to a distinct object and encrypts when sync E2EE is on',
        'Backup blobs are gzip-compressed in IndexedDB (transparent, backward-compatible)',
      ],
    },
    '3.16.0': {
      title: 'ScriptVault 3.16.0 — Deep Audit: Security & Data Safety',
      date: '2026-07-02',
      highlights: [
        { icon: 'LOCK', title: 'Hardened GM Networking', desc: 'GM_xmlhttpRequest, GM_download, @resource and menu APIs now bind to the authenticated script, so one script can no longer borrow another’s @connect allowlist.' },
        { icon: 'SYNC', title: 'Restore-from-Trash Survives Sync', desc: 'A script you restored from trash is no longer silently re-deleted on the next cloud sync — the resurrection guard actually works now.' },
        { icon: 'SAFE', title: 'Backups Keep Your Settings', desc: 'Restoring a backup no longer wipes per-script settings (match rules, notes, tags, pin) of installed scripts.' },
        { icon: 'FIX', title: 'Chrome Detected Correctly', desc: 'ScriptVault no longer mistakes Chrome for Firefox — restoring proper per-script world isolation on Chrome 133+ and the right setup instructions.' }
      ],
      improvements: [
        'Editor no longer swallows the first keystroke after switching tabs',
        'Editor cursor position (Ln/Col) now updates instead of showing Ln 1, Col 1',
        'Storage meter measures real usage; Find Scripts pagination works again',
        'New Script / Duplicate / New Folder now report failures instead of doing nothing',
        'Fixed an attribute-injection XSS in the dependency graph and other panels'
      ]
    },
    '3.15.1': {
      title: 'ScriptVault 3.15.1 — Editor Screen Repair & Redesign',
      date: '2026-07-02',
      highlights: [
        { icon: 'FIX', title: 'Editor Controls Restored', desc: 'v3.15.0 left the sticky dashboard header painted over the editor’s Save/Close row. The editor now stacks above all page chrome — every control is clickable again.' },
        { icon: 'NAV', title: 'One-Row Editor Nav', desc: 'Panel tabs sit on the left and icon-only tools (with tooltips) on the right of a single slim band — even more room for your code.' }
      ],
      improvements: [
        'Preview CSS and file-binding buttons now hide correctly when not applicable',
        'Editor panel tabs are left-aligned instead of floating at the right edge',
        'Save button is accented, and filled while there are unsaved changes'
      ]
    },
    '3.15.0': {
      title: 'ScriptVault 3.15.0 — Leaner Dashboard & Full-Screen Editor',
      date: '2026-07-02',
      highlights: [
        { icon: 'TRIM', title: 'Script Store Removed', desc: 'The Script Store tab is gone — a lighter dashboard that loads less on every open. Use Find Scripts in the toolbar (or popup/side panel) to search GreasyFork and OpenUserJS.' },
        { icon: 'EDIT', title: 'Full-Screen Editor', desc: 'The script editor now uses the entire viewport: dashboard chrome is covered, the hero header is a slim single row, and the code pane gets every saved pixel.' },
        { icon: 'FAST', title: 'Instant New Script', desc: 'New Script jumps straight into a blank editor — no template picker roadblock. Starters still live in the editor template manager.' },
        { icon: 'METER', title: 'Accurate Storage Meter', desc: 'The storage bar now measures against your real disk-based quota instead of a fictional 10 MB cap, so the false "Storage at 100% capacity" warning is gone.' }
      ],
      improvements: [
        'Fixed doubled navigation labels (e.g. "SettingsSettings") from a duplicate i18n pass',
        'Theme switches no longer fire a success toast — the theme change is the feedback',
        'The empty open-editors tab group no longer renders as a stray pill in the header',
        'Dashboard startup no longer eagerly loads the ~2,100-line store module'
      ]
    },
    '3.14.0': {
      title: 'ScriptVault 3.14.0 — Sync Merge Restored & Deep Audit',
      date: '2026-07-02',
      highlights: [
        { icon: 'SYNC', title: 'Real 3-Way Merge', desc: 'Concurrent edits on two devices now merge again — the merge engine relied on an API removed from the diff library, so it had silently fallen back to last-write-wins.' },
        { icon: 'GRAPH', title: 'Calmer Dependency Graph', desc: 'The graph no longer repaints 60 times a second while idle, saving CPU and battery.' },
        { icon: 'SAFE', title: 'Backup Warning Works', desc: 'The "storage almost full" backup warning can fire again (it measured the wrong field after v3.12).' },
        { icon: 'EXPORT', title: 'Better Standalone Export', desc: 'Exported install pages get a working "Copy Link" share instead of a non-scannable placeholder QR, and the bookmarklet minifier no longer risks corrupting exported code.' }
      ],
      improvements: [
        'Large-file diffs and merges no longer render as all-delete garbage',
        'Event-log CSV export is hardened against spreadsheet formula injection',
        'Removed a dead debugger live-reload message path',
        'Bounded the notification error-count store'
      ]
    },
    '3.13.0': {
      title: 'ScriptVault 3.13.0 — Scheduler, Diagnostics & Hardening',
      date: '2026-07-02',
      highlights: [
        { icon: 'RUN', title: 'Schedules Actually Run', desc: 'Interval, one-time, time-of-day, and date-range script schedules now fire and gate execution — before, they were saved but never enforced.' },
        { icon: 'WHY', title: 'Run Diagnostics', desc: 'A new popup panel explains, per script, why it is or isn’t running on the current page.' },
        { icon: 'KEY', title: 'Working Editor Keys', desc: 'Ctrl+S saves and Escape closes the Monaco editor; the Vim key-mapping setting now takes effect.' },
        { icon: 'THEME', title: 'Themes That Stick', desc: 'Applied custom themes and presets persist across reloads instead of reverting.' },
        { icon: 'SEC', title: 'Sync Downgrade Guard', desc: 'Once sync encryption is established, tampered plaintext remotes are refused.' },
        { icon: 'QR', title: 'Scannable Share Codes', desc: 'QR codes for larger scripts (107–271 bytes) are no longer corrupt.' }
      ],
      improvements: [
        'Keyboard navigation no longer hijacks focused row buttons (WCAG 2.1.1)',
        'Install page verifies declared @require-provenance / @require-identity',
        'Chain editor only offers the working Manual trigger',
        'Install page theme is driven by the shared theme-tokens.css',
        'Removed dead Ctrl+Tab and toolbar-cycling shortcuts'
      ]
    },
    '3.12.0': {
      title: 'ScriptVault 3.12.0 — Deep Audit Hardening',
      date: '2026-07-01',
      highlights: [
        { icon: 'FIX', title: 'Tables Render Again', desc: 'A fragment-parsing regression that dropped every table cell in the DevTools network/execution views and the dashboard script table is fixed.' },
        { icon: 'SEC', title: 'Isolated GM Values', desc: 'A script can no longer read or overwrite another script’s stored GM values — value operations are now bound to the authenticated calling script.' },
        { icon: 'RUN', title: 'Script Chains Work', desc: 'Chains now run steps through the real execution path and load your installed scripts, so chains you build actually execute.' },
        { icon: 'SYNC', title: 'Reliable Sync Merges', desc: 'Concurrent edits on two devices now 3-way merge instead of silently overwriting, and a restored script is no longer re-deleted by an old sync tombstone.' },
        { icon: 'CM', title: 'Context-Menu Isolation', desc: '@run-at context-menu scripts now run in the USER_SCRIPT world like every other injection, closing an isolation gap.' },
        { icon: 'A11Y', title: 'Readable High Contrast', desc: 'High-contrast mode on the light theme no longer renders light text on light backgrounds.' }
      ],
      improvements: [
        'Fixed empty Theme Editor section headers',
        'Collections search keeps focus while typing; per-row install targets the right script',
        'Card view select button toggles correctly on repeat clicks',
        'Activity heatmap and achievement streaks use local dates so streaks count correctly',
        'DevTools panel follows your chosen theme; long URLs only get an ellipsis when truncated',
        '"Don’t show again" on this dialog now persists',
        'Packaged builds ship the page i18n and script-config modules that were missing',
        'Capped sync KDF iterations to prevent a crafted envelope from stalling sync'
      ]
    },
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
        { const _r = document.createRange(); _r.selectNodeContents(el); el.replaceChildren(_r.createContextualFragment(String(html ?? ''))); }
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
        const data = await chrome.storage.local.get(['lastSeenVersion', 'whatsNewDisabled']);
        // Persistent opt-out set by the "Don't show again" button.
        if (data.whatsNewDisabled === true) return false;
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
          <div class="sv-wn-card-icon">${escapeHtml(h.icon)}</div>
          <div>
            <div class="sv-wn-card-title">${escapeHtml(h.title)}</div>
            <div class="sv-wn-card-desc">${escapeHtml(h.desc)}</div>
          </div>
        </div>
      `).join('');

      const improvementsHtml = entry.improvements.map(i => `<li>${escapeHtml(i)}</li>`).join('');

      _safeSetHtml(overlay, `
        <div class="sv-wn-modal" role="dialog" aria-modal="true" aria-labelledby="svWnTitle" aria-describedby="svWnSummary" tabindex="-1">
          <div class="sv-wn-header">
            <h2 id="svWnTitle">${escapeHtml(entry.title)}</h2>
            <div class="sv-wn-meta">
              <span class="sv-wn-version">v${escapeHtml(CURRENT_VERSION)}</span>
              <span class="sv-wn-date">${escapeHtml(entry.date)}</span>
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

      const dismiss = (disablePermanently) => {
        const patch = { lastSeenVersion: CURRENT_VERSION };
        // "Don't show again" persists an opt-out so the modal never reappears
        // on future version bumps; "Continue" only marks this version seen.
        if (disablePermanently === true) patch.whatsNewDisabled = true;
        chrome.storage.local.set(patch);
        document.removeEventListener('keydown', escHandler);
        overlay.remove();
      };

      overlay.querySelector('#svWnDismiss').addEventListener('click', () => dismiss(false));
      overlay.querySelector('#svWnSkip').addEventListener('click', () => dismiss(true));
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
