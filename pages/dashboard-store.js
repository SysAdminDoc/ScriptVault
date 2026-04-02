/**
 * ScriptVault Script Store / Discovery Module
 * Self-contained panel for browsing, searching, and installing userscripts
 * from Greasy Fork. Integrates with the dashboard via exported API.
 */
const ScriptStore = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        container: null,
        styleEl: null,
        page: 1,
        query: '',
        category: null,
        sortMode: null,        // null | 'total_installs' | 'daily_installs'
        siteHostname: null,
        loading: false,
        installedNames: new Set(),
        lastResultsCount: 0,
        lastContextLabel: 'Ready',
        lastSourceStats: null,
        requestToken: 0,
        getInstalledScripts: null, // fn supplied by caller
        onInstalled: null,         // callback after successful install
        searchUiBusy: false,
    };

    const CATEGORIES = {
        productivity: { label: 'Productivity', query: 'productivity' },
        entertainment: { label: 'Entertainment', query: 'entertainment' },
        privacy: { label: 'Privacy', query: 'privacy' },
        social: { label: 'Social', query: 'social media' },
        utilities: { label: 'Utilities', query: 'utility' },
    };

    // =========================================
    // CSS (injected once on init)
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'script-store-styles';
        style.textContent = `
/* Script Store Panel */
.ss-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-body);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
}

/* Header bar */
.ss-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--bg-section-header);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}
.ss-header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-right: auto;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Search bar */
.ss-search-bar {
    display: flex;
    gap: 8px;
    padding: 10px 16px;
    background: var(--bg-content);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}
.ss-search-input {
    flex: 1;
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
}
.ss-search-input:focus {
    border-color: var(--accent-primary);
}
.ss-search-input::placeholder {
    color: var(--text-muted);
}

/* Buttons */
.ss-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    background: var(--bg-button);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
}
.ss-btn:hover {
    background: var(--bg-button-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.ss-btn:active {
    transform: translateY(0);
    box-shadow: none;
}
.ss-btn.primary {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: var(--text-on-accent, #fff);
}
.ss-btn.primary:hover {
    filter: brightness(1.1);
    box-shadow: 0 2px 12px rgba(34,197,94,0.3);
}
.ss-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}
.ss-btn.small {
    font-size: 10px;
    padding: 3px 8px;
}

/* Category / navigation bar */
.ss-nav {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    background: var(--bg-content);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
}
.ss-nav-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-right: 4px;
}
.ss-chip {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    background: var(--bg-button);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ss-chip:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
}
.ss-chip.active {
    background: var(--accent-primary);
    color: var(--text-on-accent, #fff);
    border-color: var(--accent-primary);
}
.ss-chip:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
}
.ss-nav-sep {
    width: 1px;
    height: 18px;
    background: var(--border-color);
    margin: 0 4px;
}

/* Results area */
.ss-results {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
    overscroll-behavior: contain;
}
.ss-results::-webkit-scrollbar { width: 6px; }
.ss-results::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
}
.ss-results::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
}

/* Status messages */
.ss-empty, .ss-error {
    text-align: center;
    color: var(--text-muted);
    padding: 40px 20px;
    font-size: 13px;
}
.ss-error { color: var(--accent-error); }

.ss-loading {
    text-align: center;
    color: var(--text-secondary);
    padding: 40px 20px;
    font-size: 13px;
}
.ss-loading::after {
    content: '';
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: ss-spin 0.6s linear infinite;
    margin-left: 8px;
    vertical-align: middle;
}
@keyframes ss-spin { to { transform: rotate(360deg); } }

/* Result count */
.ss-result-count {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    padding: 4px 0 8px;
}

/* Script card */
.ss-card {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-content);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 6px;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.ss-card:hover {
    border-color: rgba(34,197,94,0.3);
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
}
.ss-card.installed {
    border-left: 3px solid var(--accent-primary);
}
.ss-card-info {
    min-width: 0;
}
.ss-card-name {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}
.ss-card-name a {
    color: var(--accent-secondary);
    text-decoration: none;
}
.ss-card-name a:hover { text-decoration: underline; }
.ss-card-version {
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-button);
    padding: 1px 5px;
    border-radius: 4px;
}
.ss-installed-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-primary);
    background: rgba(34,197,94,0.12);
    padding: 1px 6px;
    border-radius: 4px;
    vertical-align: middle;
}
.ss-card-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ss-card-meta {
    display: flex;
    gap: 12px;
    font-size: 10px;
    color: var(--text-muted);
    flex-wrap: wrap;
}
.ss-card-meta span {
    display: flex;
    align-items: center;
    gap: 3px;
}
.ss-card-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
}

/* Code preview */
.ss-card-preview {
    display: none;
    grid-column: 1 / -1;
    max-height: 300px;
    overflow: auto;
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin-top: 8px;
    padding: 8px 12px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.4;
    white-space: pre;
    color: var(--text-secondary);
}
.ss-card-preview.open { display: block; }

/* Pagination */
.ss-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
}
.ss-pagination-info {
    font-size: 11px;
    color: var(--text-muted);
}

/* Source badges on cards */
.ss-source-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
    vertical-align: middle;
    margin-left: 4px;
}
.ss-source-bar {
    display: flex;
    gap: 12px;
    padding: 6px 16px;
    font-size: 11px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-section-header);
    flex-wrap: wrap;
    align-items: center;
}
.ss-source-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.ss-source-chip:not(.active) {
    opacity: 0.4;
    text-decoration: line-through;
}

/* Footer status bar */
.ss-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 16px;
    background: var(--bg-section-header);
    border-top: 1px solid var(--border-color);
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
}

/* Premium overrides */
.ss-panel {
    display: block;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
}
.ss-shell {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 18px;
}
.ss-hero {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    padding: 26px 28px;
    border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    border-radius: 28px;
    background:
        radial-gradient(circle at top right, rgba(96, 165, 250, 0.2), transparent 16rem),
        linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.02) 58%, transparent),
        var(--bg-section-header);
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow-lg, 0 28px 70px rgba(0,0,0,0.26));
    overflow: hidden;
    isolation: isolate;
}
.ss-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 40%, transparent 62%, rgba(255, 255, 255, 0.03));
    pointer-events: none;
}
.ss-hero-copy,
.ss-overview {
    position: relative;
    z-index: 1;
}
.ss-hero-copy {
    max-width: 700px;
}
.ss-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-secondary);
}
.ss-hero-copy h2 {
    margin-top: 14px;
    font-size: clamp(28px, 3.2vw, 38px);
    font-weight: 760;
    letter-spacing: -0.05em;
    color: var(--text-primary);
    text-wrap: balance;
}
.ss-hero-copy p {
    margin-top: 8px;
    max-width: 700px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-secondary);
}
.ss-overview {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}
.ss-summary {
    min-width: 118px;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03)),
        rgba(255, 255, 255, 0.02);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 30px rgba(0, 0, 0, 0.16);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
}
.ss-summary-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
}
.ss-summary strong {
    display: block;
    margin-top: 8px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
}
.ss-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 14px 16px;
    border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    border-radius: 22px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        var(--bg-section-header);
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
}
.ss-search-bar {
    flex: 1 1 320px;
    min-width: 0;
    align-items: center;
    padding: 0 14px;
    gap: 10px;
    border: 1px solid rgba(127, 127, 127, 0.14);
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.ss-search-label {
    color: var(--text-muted);
    font-size: 13px;
    white-space: nowrap;
}
.ss-search-input {
    min-width: 0;
    border: none;
    background: transparent;
    padding: 12px 0;
    font-size: 13px;
}
.ss-toolbar-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}
.ss-btn {
    padding: 9px 14px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 600;
    gap: 6px;
    border-color: var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
        var(--bg-button);
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 14px 24px rgba(0, 0, 0, 0.14);
}
.ss-btn.small {
    font-size: 11px;
    padding: 6px 10px;
    border-radius: 10px;
}
.ss-btn:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03)),
        var(--bg-button-hover);
    border-color: var(--panel-border-strong, rgba(148, 163, 184, 0.28));
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 18px 30px rgba(0,0,0,0.2);
}
.ss-btn.primary {
    color: #04131a;
    border-color: rgba(125, 211, 252, 0.34);
    background: linear-gradient(135deg, #7dd3fc, var(--accent-secondary));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.26), 0 18px 32px rgba(96, 165, 250, 0.24);
}
.ss-btn.primary:hover {
    background: linear-gradient(135deg, #bae6fd, #60a5fa);
}
.ss-btn.ghost {
    background: rgba(255, 255, 255, 0.03);
}
.ss-btn.ghost.active {
    background: linear-gradient(135deg, rgba(125, 211, 252, 0.18), rgba(96, 165, 250, 0.16));
    border-color: rgba(96, 165, 250, 0.34);
    color: #dbeafe;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 24px rgba(96, 165, 250, 0.16);
}
.ss-nav {
    padding: 14px 16px;
    border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    border-radius: 22px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        var(--bg-content);
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
}
.ss-nav-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.ss-chip {
    padding: 8px 13px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-color: rgba(127, 127, 127, 0.14);
    background: rgba(255, 255, 255, 0.03);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.ss-chip.active {
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 14px 24px rgba(0,0,0,0.18);
}
.ss-nav-sep {
    height: 20px;
    background: rgba(127, 127, 127, 0.16);
}
.ss-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
}
.ss-status strong {
    color: var(--text-primary);
}
.ss-status-summary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(127, 127, 127, 0.14);
}
.ss-status-hint {
    color: var(--text-secondary);
}
.ss-results {
    padding: 8px 0 0;
    overflow: visible;
}
.ss-results-inner {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.ss-empty,
.ss-error,
.ss-loading {
    padding: 34px 24px;
    border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    border-radius: 24px;
    background:
        radial-gradient(circle at top center, rgba(96, 165, 250, 0.12), transparent 48%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        var(--bg-content);
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
}
.ss-empty strong,
.ss-error strong,
.ss-loading strong {
    display: block;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 6px;
}
.ss-empty span,
.ss-error span,
.ss-loading span {
    display: block;
}
.ss-result-count {
    padding: 0 2px;
    text-align: left;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
}
.ss-source-bar {
    gap: 8px;
    padding: 0;
    border: none;
    background: transparent;
}
.ss-source-stat {
    padding: 7px 11px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(127, 127, 127, 0.14);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    font-size: 11px;
}
.ss-card {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    padding: 16px;
    margin-bottom: 0;
    border-radius: 24px;
    border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    background:
        radial-gradient(circle at top right, rgba(96, 165, 250, 0.08), transparent 35%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        var(--bg-content);
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
    content-visibility: auto;
    contain-intrinsic-size: 188px;
    contain: layout style paint;
}
.ss-card:hover {
    transform: translateY(-1px);
    border-color: rgba(96, 165, 250, 0.3);
    box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 24px 40px rgba(0, 0, 0, 0.22);
}
.ss-results-inner {
    content-visibility: auto;
    contain-intrinsic-size: 960px;
}
.ss-results[data-list-size="large"] .ss-card,
.ss-results[data-list-size="huge"] .ss-card {
    transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}
.ss-results[data-list-size="huge"] .ss-card:hover {
    transform: none;
}
.ss-card.installed {
    border-left: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    background:
        radial-gradient(circle at top right, rgba(52, 211, 153, 0.1), transparent 36%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        var(--bg-content);
    box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.18), 0 18px 34px rgba(0, 0, 0, 0.16);
}
.ss-card-name {
    margin-bottom: 6px;
    gap: 8px;
}
.ss-card-name a {
    color: var(--text-primary);
    font-size: 15px;
}
.ss-card-version,
.ss-installed-badge,
.ss-source-badge {
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}
.ss-card-version {
    border: 1px solid rgba(127, 127, 127, 0.14);
    background: rgba(255, 255, 255, 0.04);
}
.ss-installed-badge {
    color: #d1fae5;
    border: 1px solid rgba(52, 211, 153, 0.18);
    background: rgba(52, 211, 153, 0.14);
}
.ss-card-desc {
    margin-bottom: 10px;
    font-size: 12px;
    line-height: 1.6;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}
.ss-card-meta {
    gap: 8px;
    font-size: 11px;
}
.ss-card-meta span {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(127, 127, 127, 0.12);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.ss-card-actions {
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    align-self: flex-start;
}
.ss-card-preview {
    max-height: 360px;
    margin-top: 14px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255,255,255,0.02)),
        rgba(0, 0, 0, 0.22);
    font-family: Consolas, 'Cascadia Code', monospace;
    font-size: 11px;
    line-height: 1.55;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.ss-pagination {
    padding: 4px 0 0;
}
.ss-pagination-info {
    font-size: 12px;
}
.ss-footer {
    padding: 4px 2px 0;
    border-top: none;
    background: transparent;
    font-size: 11px;
    color: var(--text-muted);
}
@media (max-width: 900px) {
    .ss-shell {
        padding: 16px;
    }
    .ss-hero {
        padding: 20px;
        border-radius: 24px;
    }
    .ss-toolbar,
    .ss-status {
        align-items: stretch;
    }
    .ss-search-bar {
        width: 100%;
    }
    .ss-card {
        grid-template-columns: 1fr;
    }
    .ss-card-actions {
        justify-content: flex-start;
    }
}
@media (prefers-reduced-motion: reduce) {
    .ss-btn,
    .ss-chip,
    .ss-card {
        transition: none;
    }
    .ss-card:hover,
    .ss-btn:hover {
        transform: none;
    }
    .ss-loading::after {
        animation: none;
        border-top-color: var(--text-muted);
    }
}
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // Utilities
    // =========================================
    function escapeHtml(str) {
        const el = document.createElement('span');
        el.textContent = str || '';
        return el.innerHTML;
    }

    function formatNumber(n) {
        if (n == null) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const diffMs = now - d;
            const diffDays = Math.floor(diffMs / 86400000);
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 30) return diffDays + 'd ago';
            if (diffDays < 365) return Math.floor(diffDays / 30) + 'mo ago';
            return Math.floor(diffDays / 365) + 'y ago';
        } catch {
            return '--';
        }
    }

    function getResultListSize(count) {
        if (count <= 0) return 'empty';
        if (count >= 80) return 'huge';
        if (count >= 36) return 'large';
        if (count >= 12) return 'medium';
        return 'small';
    }

    function setStatus(message, hint = '') {
        const status = _state.container?.querySelector('.ss-status-text');
        const helper = _state.container?.querySelector('.ss-status-hint');
        if (status) status.textContent = message;
        if (helper) helper.textContent = hint;
    }

    function getStoreSearchControls() {
        return Array.from(_state.container?.querySelectorAll('.ss-search-control') || []);
    }

    function setSearchUiBusy(isBusy) {
        _state.searchUiBusy = isBusy;

        const searchInput = _state.container?.querySelector('.ss-search-input');
        if (searchInput instanceof HTMLInputElement) {
            searchInput.disabled = isBusy;
            searchInput.setAttribute('aria-busy', String(isBusy));
        }

        getStoreSearchControls().forEach((control) => {
            if (!(control instanceof HTMLButtonElement)) return;
            if (isBusy) {
                control.dataset.prevDisabled = control.disabled ? 'true' : 'false';
                control.disabled = true;
                control.setAttribute('aria-busy', 'true');
            } else {
                control.disabled = control.dataset.prevDisabled === 'true';
                control.removeAttribute('data-prev-disabled');
                control.removeAttribute('aria-busy');
            }
        });

        const resultsEl = getResultsEl();
        if (resultsEl) {
            resultsEl.setAttribute('aria-busy', String(isBusy));
        }
    }

    function getViewLabel() {
        if (_state.siteHostname) return `Site: ${_state.siteHostname}`;
        if (_state.category) return CATEGORIES[_state.category]?.label || 'Category';
        if (_state.sortMode === 'daily_installs') return 'Trending';
        if (_state.sortMode === 'total_installs') return 'Popular';
        if (_state.query) return 'Search';
        return 'Ready';
    }

    function isGreasyForkOnlyMode() {
        return !!_state.siteHostname || (!!_state.sortMode && !_state.query && !_state.category);
    }

    function getActiveSourceSummary() {
        return isGreasyForkOnlyMode() ? 'Greasy Fork only' : `${_activeSources.size} active`;
    }

    function normalizeIdentityPart(value) {
        return (value || '').trim().toLowerCase();
    }

    function getInstallIdentity(scriptLike = {}) {
        const name = normalizeIdentityPart(scriptLike.name || scriptLike.metadata?.name);
        const author = normalizeIdentityPart(scriptLike.author || scriptLike.metadata?.author);
        return author ? `${name}::${author}` : name;
    }

    function updateOverview() {
        const resultsEl = _state.container?.querySelector('[data-summary="results"]');
        const sourcesEl = _state.container?.querySelector('[data-summary="sources"]');
        const viewEl = _state.container?.querySelector('[data-summary="view"]');
        const installedEl = _state.container?.querySelector('[data-summary="installed"]');

        if (resultsEl) {
            resultsEl.textContent = _state.lastResultsCount
                ? `${_state.lastResultsCount} loaded`
                : 'Ready';
        }
        if (sourcesEl) {
            sourcesEl.textContent = getActiveSourceSummary();
        }
        if (viewEl) {
            viewEl.textContent = getViewLabel();
        }
        if (installedEl) {
            installedEl.textContent = `${_state.installedNames.size} known`;
        }
    }

    // =========================================
    // Installed scripts tracking
    // =========================================
    async function refreshInstalledNames() {
        if (typeof _state.getInstalledScripts === 'function') {
            try {
                const scripts = await _state.getInstalledScripts();
                _state.installedNames = new Set(
                    scripts
                        .map(script => getInstallIdentity(script))
                        .filter(Boolean)
                );
            } catch {
                _state.installedNames = new Set();
            }
            updateOverview();
        }
    }

    function isInstalled(scriptLike) {
        const identity = getInstallIdentity(scriptLike);
        return identity ? _state.installedNames.has(identity) : false;
    }

    // =========================================
    // Multi-Source API
    // =========================================

    // Source definitions — each has a fetch function that returns normalized results
    const SOURCES = {
        greasyfork: {
            label: 'Greasy Fork',
            color: '#670000',
            async fetch({ query, page, sort, site }) {
                let url;
                if (site) {
                    url = `https://api.greasyfork.org/en/scripts/by-site/${encodeURIComponent(site)}.json?page=${page || 1}`;
                } else {
                    url = `https://api.greasyfork.org/en/scripts.json?page=${page || 1}`;
                    if (query) url += `&q=${encodeURIComponent(query)}`;
                    if (sort) url += `&sort=${encodeURIComponent(sort)}`;
                }
                const resp = await fetch(url);
                if (!resp.ok) return [];
                const data = await resp.json();
                return data.map(s => ({
                    source: 'greasyfork',
                    id: 'gf_' + s.id,
                    name: s.name || 'Unnamed',
                    author: s.users?.[0]?.name || 'Unknown',
                    description: s.description || '',
                    version: s.version || '',
                    totalInstalls: s.total_installs || 0,
                    dailyInstalls: s.daily_installs || 0,
                    rating: s.fan_score ? parseFloat(s.fan_score).toFixed(0) + '%' : '--',
                    updatedAt: s.code_updated_at,
                    codeUrl: s.code_url || '',
                    pageUrl: s.url || '',
                }));
            }
        },
        openuserjs: {
            label: 'OpenUserJS',
            color: '#2c3e50',
            async fetch({ query, page }) {
                if (!query) return [];
                try {
                    // OpenUserJS has a limited API — search by script name
                    const resp = await fetch(`https://openuserjs.org/api/script/search?q=${encodeURIComponent(query)}&p=${page || 1}&limit=15`, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!resp.ok) return [];
                    const data = await resp.json();
                    const scripts = Array.isArray(data) ? data : (data.scripts || data.data || []);
                    return scripts.map(s => ({
                        source: 'openuserjs',
                        id: 'oujs_' + (s._id || s.name),
                        name: s.name || 'Unnamed',
                        author: s.author || s._authorId || 'Unknown',
                        description: s.description || s.about || '',
                        version: s.version || '',
                        totalInstalls: s.installs || 0,
                        dailyInstalls: 0,
                        rating: s.rating ? String(Math.round(s.rating)) + '%' : '--',
                        updatedAt: s.updated || s.updatedAt,
                        codeUrl: s.installURL || `https://openuserjs.org/install/${encodeURIComponent(s.author || '')}/${encodeURIComponent(s.name || '')}.user.js`,
                        pageUrl: s.url || `https://openuserjs.org/scripts/${encodeURIComponent(s.author || '')}/${encodeURIComponent(s.name || '')}`,
                    }));
                } catch (e) {
                    console.warn('[ScriptStore] OpenUserJS fetch failed:', e.message);
                    return [];
                }
            }
        },
        github: {
            label: 'GitHub',
            color: '#24292e',
            async fetch({ query, page }) {
                if (!query) return [];
                try {
                    // Search GitHub for .user.js files
                    const resp = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}+extension:user.js+in:file&per_page=10&page=${page || 1}`, {
                        headers: { 'Accept': 'application/vnd.github.v3+json' }
                    });
                    if (!resp.ok) return [];
                    const data = await resp.json();
                    return (data.items || []).map(item => {
                        const repo = item.repository;
                        return {
                            source: 'github',
                            id: 'gh_' + item.sha,
                            name: item.name.replace('.user.js', ''),
                            author: repo?.owner?.login || 'Unknown',
                            description: repo?.description || '',
                            version: '',
                            totalInstalls: repo?.stargazers_count || 0,
                            dailyInstalls: 0,
                            rating: repo?.stargazers_count ? repo.stargazers_count + ' stars' : '--',
                            updatedAt: repo?.updated_at,
                            codeUrl: item.html_url?.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') || '',
                            pageUrl: item.html_url || '',
                        };
                    });
                } catch (e) {
                    console.warn('[ScriptStore] GitHub search failed:', e.message);
                    return [];
                }
            }
        }
    };

    // Active sources (GitHub disabled by default — requires auth token for Code Search API)
    let _activeSources = new Set(['greasyfork', 'openuserjs']);

    /**
     * Unified search across all active sources.
     * Fetches from all sources in parallel, deduplicates by name, and merges.
     */
    async function fetchAllSources(params = {}) {
        const sourceKeys = [..._activeSources];
        const promises = sourceKeys.map(key => {
            const src = SOURCES[key];
            if (!src) return Promise.resolve([]);
            return src.fetch(params).catch(() => []);
        });

        const results = await Promise.allSettled(promises);
        let allScripts = [];
        const sourceStats = {};
        let hasMore = false;

        results.forEach((result, i) => {
            const key = sourceKeys[i];
            const scripts = result.status === 'fulfilled' ? result.value : [];
            sourceStats[key] = scripts.length;
            if (scripts.length >= 10) hasMore = true;
            allScripts.push(...scripts);
        });

        // Deduplicate by name (case-insensitive) — prefer the one with more installs
        const seen = new Map();
        for (const s of allScripts) {
            const key = s.name.toLowerCase();
            if (!seen.has(key) || (seen.get(key).totalInstalls < s.totalInstalls)) {
                seen.set(key, s);
            }
        }
        const deduped = [...seen.values()];

        // Sort by total installs descending (most popular first)
        deduped.sort((a, b) => b.totalInstalls - a.totalInstalls);

        return { scripts: deduped, sourceStats, hasMore };
    }

    // Keep backward-compatible single-source fetch for site-specific search
    async function fetchGreasyFork(params = {}) {
        return SOURCES.greasyfork.fetch(params);
    }

    // =========================================
    // Rendering
    // =========================================
    function getResultsEl() {
        return _state.container?.querySelector('.ss-results');
    }

    function showLoading(message = 'Searching') {
        const el = getResultsEl();
        _state.lastResultsCount = 0;
        updateOverview();
        setStatus(message, 'Preview and install stay in the same view.');
        if (el) {
            el.setAttribute('aria-busy', 'true');
            el.dataset.listSize = 'empty';
            el.innerHTML = `<div class="ss-loading"><strong>${escapeHtml(message)}</strong><span>Fetching scripts from the active discovery sources.</span></div>`;
        }
    }

    function showEmpty(message = 'No scripts found') {
        const el = getResultsEl();
        _state.lastResultsCount = 0;
        updateOverview();
        setStatus('No scripts matched this view.', 'Try another query, category, or source mix.');
        if (el) {
            el.setAttribute('aria-busy', 'false');
            el.dataset.listSize = 'empty';
            el.innerHTML = `<div class="ss-empty"><strong>No scripts matched</strong><span>${escapeHtml(message)}</span></div>`;
        }
    }

    function showError(message) {
        const el = getResultsEl();
        _state.lastResultsCount = 0;
        updateOverview();
        setStatus('Store search failed.', 'Check the active sources or try again in a moment.');
        if (el) {
            el.setAttribute('aria-busy', 'false');
            el.dataset.listSize = 'empty';
            el.innerHTML = `<div class="ss-error"><strong>Search failed</strong><span>${escapeHtml(message)}</span></div>`;
        }
    }

    function updateFooter(text) {
        const footer = _state.container?.querySelector('.ss-footer-text');
        if (footer) footer.textContent = text;
    }

    function renderCards(scripts, page, contextLabel, sourceStats, hasMore = false) {
        const el = getResultsEl();
        if (!el) return;

        if (!scripts || scripts.length === 0) {
            showEmpty('No scripts found. Try a different search.');
            return;
        }

        _state.lastResultsCount = scripts.length;
        _state.lastContextLabel = contextLabel || getViewLabel();
        _state.lastSourceStats = sourceStats || null;
        el.setAttribute('aria-busy', 'false');
        el.dataset.listSize = getResultListSize(scripts.length);
        updateOverview();
        setStatus(_state.lastContextLabel, `${scripts.length} script${scripts.length === 1 ? '' : 's'} ready to preview or install.`);

        let html = '<div class="ss-results-inner">';

        // Source stats bar (shows how many results came from each source)
        if (sourceStats) {
            const statsHtml = Object.entries(sourceStats)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => {
                    const src = SOURCES[key];
                    return `<span class="ss-source-stat" style="border-left:3px solid ${src?.color || '#666'};padding-left:6px">${src?.label || key}: ${count}</span>`;
                }).join('');
            if (statsHtml) {
                html += `<div class="ss-source-bar">${statsHtml}<span class="ss-source-stat" style="font-weight:600">${scripts.length} total deduplicated</span></div>`;
            }
        }

        if (contextLabel) {
            html += `<div class="ss-result-count">${contextLabel} · Page ${page}</div>`;
        } else {
            html += `<div class="ss-result-count">Page ${page} · ${scripts.length} results</div>`;
        }

        scripts.forEach(s => {
            // Unified format — works with both old GF format and new normalized format
            const name = s.name || 'Unnamed';
            const author = s.author || s.users?.[0]?.name || 'Unknown';
            const desc = s.description || 'No description';
            const version = s.version || '';
            const totalInstalls = s.totalInstalls ?? s.total_installs ?? 0;
            const dailyInstalls = s.dailyInstalls ?? s.daily_installs ?? 0;
            const rating = s.rating || (s.fan_score ? parseFloat(s.fan_score).toFixed(0) + '%' : '--');
            const updated = formatDate(s.updatedAt || s.code_updated_at);
            const installed = isInstalled({ name, author });
            const codeUrl = s.codeUrl || s.code_url || '';
            const pageUrl = s.pageUrl || s.url || '';
            const source = s.source || 'greasyfork';
            const srcDef = SOURCES[source];
            const sourceBadge = srcDef ? `<span class="ss-source-badge" style="background:${srcDef.color};color:#fff">${srcDef.label}</span>` : '';

            html += `
<div class="ss-card${installed ? ' installed' : ''}" data-script-name="${escapeHtml(name)}">
    <div class="ss-card-info">
        <div class="ss-card-name">
            <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>
            ${version ? `<span class="ss-card-version">v${escapeHtml(version)}</span>` : ''}
            ${sourceBadge}
            ${installed ? '<span class="ss-installed-badge">Installed</span>' : ''}
        </div>
        <div class="ss-card-desc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</div>
        <div class="ss-card-meta">
            <span title="Author">${escapeHtml(author)}</span>
            <span title="Total installs">${formatNumber(totalInstalls)} installs</span>
            ${dailyInstalls > 0 ? `<span title="Daily installs">${formatNumber(dailyInstalls)}/day</span>` : ''}
            <span title="Rating">${rating}</span>
            <span title="Last updated">${updated}</span>
        </div>
    </div>
    <div class="ss-card-actions">
        <button type="button" class="ss-btn primary small" data-action="install" data-url="${escapeHtml(codeUrl)}">${installed ? 'Reinstall' : 'Install'}</button>
        <button type="button" class="ss-btn small" data-action="preview" data-url="${escapeHtml(codeUrl)}">Preview Code</button>
        <button type="button" class="ss-btn small" data-action="view" data-url="${escapeHtml(pageUrl)}">Open Page</button>
    </div>
    <div class="ss-card-preview"></div>
</div>`;
        });

        // Pagination
        html += '<div class="ss-pagination">';
        if (page > 1) {
            html += `<button type="button" class="ss-btn small ss-search-control" data-action="page" data-page="${page - 1}">Previous</button>`;
        }
        html += `<span class="ss-pagination-info">Page ${page}</span>`;
        // Show "Next" only when we got a full page of results (at least 10 from any source)
        if (hasMore) {
            html += `<button type="button" class="ss-btn small ss-search-control" data-action="page" data-page="${page + 1}">Next</button>`;
        }
        html += '</div>';
        html += '</div>';

        el.innerHTML = html;
        bindCardActions(el);
        updateFooter(`${scripts.length} scripts loaded · ${getActiveSourceSummary()}`);
    }

    // =========================================
    // Card action handlers
    // =========================================
    function bindCardActions(container) {
        if (container.dataset.boundCardActions === 'true') return;
        container.dataset.boundCardActions = 'true';
        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const url = btn.dataset.url;

            switch (action) {
                case 'install':
                    await handleInstall(btn, url);
                    break;
                case 'preview':
                    await handlePreview(btn, url);
                    break;
                case 'view':
                    if (url) chrome.tabs.create({ url });
                    break;
                case 'page':
                    await navigatePage(parseInt(btn.dataset.page, 10));
                    break;
            }
        });
    }

    async function handleInstall(btn, url) {
        if (!url) return;
        const originalText = btn.textContent;
        btn.textContent = 'Installing…';
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');

        try {
            const res = await chrome.runtime.sendMessage({ action: 'installFromUrl', url });
            if (res?.success) {
                btn.textContent = 'Installed';
                btn.classList.remove('primary');
                // Update installed set
                await refreshInstalledNames();
                updateOverview();
                setStatus('Script installed.', 'The dashboard list will refresh in place.');
                // Mark the card
                const card = btn.closest('.ss-card');
                if (card) {
                    card.classList.add('installed');
                    const nameEl = card.querySelector('.ss-card-name');
                    if (nameEl && !nameEl.querySelector('.ss-installed-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'ss-installed-badge';
                        badge.textContent = 'Installed';
                        nameEl.appendChild(badge);
                    }
                }
                if (typeof _state.onInstalled === 'function') {
                    await Promise.resolve(_state.onInstalled());
                }
            } else {
                btn.textContent = 'Failed';
                setStatus('Install failed.', 'The source may be unavailable or rejected the request.');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                }, 2000);
            }
        } catch (e) {
            btn.textContent = 'Error';
            setStatus('Install failed.', 'Check the source URL or try again in a moment.');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
            }, 2000);
        }

        if (btn.textContent === 'Installed') {
            btn.removeAttribute('aria-busy');
        }
    }

    async function handlePreview(btn, url) {
        if (!url) return;
        const card = btn.closest('.ss-card');
        const preview = card?.querySelector('.ss-card-preview');
        if (!preview) return;

        if (preview.classList.contains('open')) {
            preview.classList.remove('open');
            btn.textContent = 'Preview Code';
            setStatus(_state.lastContextLabel, `${_state.lastResultsCount} script${_state.lastResultsCount === 1 ? '' : 's'} ready to preview or install.`);
            return;
        }

        btn.textContent = 'Loading…';
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(`Source returned ${resp.status}`);
            }
            const code = await resp.text();
            preview.textContent = code;
            preview.classList.add('open');
            btn.textContent = 'Hide';
            setStatus('Inline code preview open.', 'You can inspect the source without leaving the store.');
        } catch {
            preview.textContent = 'Failed to load script code.';
            preview.classList.add('open');
            btn.textContent = 'Preview Code';
            setStatus('Preview failed.', 'The source script could not be fetched right now.');
        }
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
    }

    // =========================================
    // Navigation / loading
    // =========================================
    async function navigatePage(page) {
        _state.page = page;
        await executeSearch();
    }

    async function executeSearch() {
        const requestToken = ++_state.requestToken;
        _state.loading = true;
        setSearchUiBusy(true);
        const loadingLabel = _state.siteHostname
            ? `Finding scripts for ${_state.siteHostname}`
            : _state.sortMode === 'daily_installs'
                ? 'Loading trending scripts'
                : _state.sortMode === 'total_installs'
                    ? 'Loading popular scripts'
                    : _state.category
                        ? `Searching ${CATEGORIES[_state.category]?.label || 'category'}`
                        : _state.query
                            ? `Searching for "${_state.query}"`
                            : 'Loading store results';
        showLoading(loadingLabel);

        try {
            await refreshInstalledNames();
            if (requestToken !== _state.requestToken) return;

            let scripts;
            let contextLabel = null;
            let sourceStats = null;
            let hasMore = false;

            if (_state.siteHostname) {
                // Site-specific uses Greasy Fork only (it has the by-site API)
                scripts = await fetchGreasyFork({ site: _state.siteHostname, page: _state.page });
                contextLabel = `Scripts for ${_state.siteHostname}`;
                hasMore = scripts.length >= 10;
            } else if (_state.sortMode && !_state.query && !_state.category) {
                // Popular/Trending uses Greasy Fork only
                scripts = await fetchGreasyFork({ sort: _state.sortMode, page: _state.page });
                const sortLabel = _state.sortMode === 'daily_installs' ? 'Trending' : 'Popular';
                contextLabel = sortLabel + ' scripts';
                hasMore = scripts.length >= 10;
            } else {
                // Keyword/category search — use ALL sources
                const query = _state.query || (_state.category ? CATEGORIES[_state.category]?.query : '');
                if (!query) {
                    _state.sortMode = 'daily_installs';
                    const scripts = await fetchGreasyFork({ sort: _state.sortMode, page: 1 });
                    if (requestToken !== _state.requestToken) return;
                    renderCards(scripts, 1, 'Trending scripts', null, scripts.length >= 10);
                    return;
                }
                const result = await fetchAllSources({
                    query,
                    page: _state.page,
                    sort: _state.sortMode || undefined,
                });
                if (requestToken !== _state.requestToken) return;
                scripts = result.scripts;
                sourceStats = result.sourceStats;
                hasMore = result.hasMore;
                if (_state.category) {
                    contextLabel = CATEGORIES[_state.category]?.label;
                }
            }

            if (requestToken !== _state.requestToken) return;
            renderCards(scripts, _state.page, contextLabel, sourceStats, hasMore);
        } catch (e) {
            if (requestToken !== _state.requestToken) return;
            showError('Search failed: ' + e.message);
        } finally {
            if (requestToken === _state.requestToken) {
                _state.loading = false;
                setSearchUiBusy(false);
            }
        }
    }

    function resetState() {
        _state.page = 1;
        _state.query = '';
        _state.category = null;
        _state.sortMode = null;
        _state.siteHostname = null;
    }

    function updateActiveChips() {
        const nav = _state.container?.querySelector('.ss-nav');
        if (!nav) return;
        nav.querySelectorAll('.ss-chip').forEach(chip => {
            const cat = chip.dataset.category;
            const sort = chip.dataset.sort;
            const isSite = chip.dataset.site;
            const source = chip.dataset.source;

            let active = false;
            if (cat) active = _state.category === cat && !_state.sortMode && !_state.siteHostname;
            if (sort) active = _state.sortMode === sort && !_state.category && !_state.siteHostname;
            if (isSite) active = !!_state.siteHostname;
            if (source) active = _activeSources.has(source);

            chip.classList.toggle('active', active);
            chip.setAttribute('aria-pressed', String(active));
        });

        const trendingBtn = _state.container?.querySelector('[data-action="discover-trending"]');
        const popularBtn = _state.container?.querySelector('[data-action="discover-popular"]');
        trendingBtn?.classList.toggle('active', _state.sortMode === 'daily_installs' && !_state.category && !_state.siteHostname);
        popularBtn?.classList.toggle('active', _state.sortMode === 'total_installs' && !_state.category && !_state.siteHostname);
    }

    // =========================================
    // Build DOM
    // =========================================
    function buildPanel(container) {
        container.innerHTML = `
<div class="ss-panel">
    <div class="ss-shell">
    <div class="ss-hero">
        <div class="ss-hero-copy">
            <div class="ss-eyebrow">Discover</div>
            <h2>Install high-signal userscripts fast.</h2>
            <p>Browse trending and popular scripts, search by task or site, preview code inline, and install without losing your place in the dashboard.</p>
        </div>
        <div class="ss-overview" aria-label="Store overview">
            <div class="ss-summary">
                <span class="ss-summary-label">Results</span>
                <strong data-summary="results">Ready</strong>
            </div>
            <div class="ss-summary">
                <span class="ss-summary-label">Sources</span>
                <strong data-summary="sources">${_activeSources.size} active</strong>
            </div>
            <div class="ss-summary">
                <span class="ss-summary-label">View</span>
                <strong data-summary="view">Trending</strong>
            </div>
            <div class="ss-summary">
                <span class="ss-summary-label">Installed</span>
                <strong data-summary="installed">0 known</strong>
            </div>
        </div>
    </div>
    <div class="ss-toolbar">
    <div class="ss-search-bar">
        <span class="ss-search-label">Search</span>
        <input type="search" class="ss-search-input" name="store_search" autocomplete="off" spellcheck="false" aria-label="Search script store" placeholder="Search by name, task, or domain like youtube.com…" />
    </div>
    <div class="ss-toolbar-actions">
        <button type="button" class="ss-btn primary ss-search-control" data-action="search">Search</button>
        <button type="button" class="ss-btn ghost ss-search-control" data-action="discover-trending">Trending</button>
        <button type="button" class="ss-btn ghost ss-search-control" data-action="discover-popular">Popular</button>
    </div>
    </div>
    <div class="ss-status" role="status" aria-live="polite">
        <span class="ss-status-summary"><strong class="ss-status-text">Trending scripts ready.</strong></span>
        <span class="ss-status-hint">Search by keyword or domain, then preview or install inline.</span>
    </div>
    <div class="ss-nav">
        <span class="ss-nav-label">Browse:</span>
        ${Object.entries(CATEGORIES).map(([key, val]) =>
            `<button type="button" class="ss-chip ss-search-control" data-category="${key}" aria-pressed="false">${val.label}</button>`
        ).join('')}
        <span class="ss-nav-sep"></span>
        <span class="ss-nav-label">Sources:</span>
        ${Object.entries(SOURCES).map(([key, src]) =>
            `<button type="button" class="ss-chip ss-source-chip ss-search-control${_activeSources.has(key) ? ' active' : ''}" data-source="${key}" data-label="${src.label}" aria-pressed="${_activeSources.has(key) ? 'true' : 'false'}" style="border-left:3px solid ${src.color}">${src.label}</button>`
        ).join('')}
    </div>
    <div class="ss-results" aria-busy="true">
        <div class="ss-loading"><strong>Loading discovery feed</strong><span>Fetching trending scripts from the store sources.</span></div>
    </div>
    <div class="ss-footer">
        <span class="ss-footer-text">Loading trending scripts…</span>
        <span>Greasy Fork &bull; OpenUserJS</span>
    </div>
    </div>
</div>`;
    }

    function bindPanelEvents() {
        const container = _state.container;
        if (!container) return;

        // Search
        const searchInput = container.querySelector('.ss-search-input');
        const searchBtn = container.querySelector('[data-action="search"]');
        const trendingBtn = container.querySelector('[data-action="discover-trending"]');
        const popularBtn = container.querySelector('[data-action="discover-popular"]');

        searchBtn?.addEventListener('click', () => {
            if (_state.searchUiBusy) return;
            const q = searchInput?.value?.trim();
            resetState();
            if (!q) {
                _state.sortMode = 'daily_installs';
                updateActiveChips();
                executeSearch();
                return;
            }
            _state.query = q;
            let hostname = '';
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(q)) {
                try {
                    hostname = new URL(q).hostname;
                } catch {}
            } else if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(q)) {
                hostname = q;
            }
            if (hostname) {
                _state.siteHostname = hostname;
                _state.query = '';
                if (searchInput) searchInput.value = hostname;
            }
            updateActiveChips();
            executeSearch();
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                searchBtn?.click();
            }
        });

        trendingBtn?.addEventListener('click', () => {
            if (_state.searchUiBusy) return;
            resetState();
            _state.sortMode = 'daily_installs';
            if (searchInput) searchInput.value = '';
            updateActiveChips();
            executeSearch();
        });

        popularBtn?.addEventListener('click', () => {
            if (_state.searchUiBusy) return;
            resetState();
            _state.sortMode = 'total_installs';
            if (searchInput) searchInput.value = '';
            updateActiveChips();
            executeSearch();
        });

        // Category chips
        container.querySelectorAll('.ss-chip[data-category]').forEach(chip => {
            chip.addEventListener('click', () => {
                if (_state.searchUiBusy) return;
                resetState();
                _state.category = chip.dataset.category;
                updateActiveChips();
                executeSearch();
            });
        });

        // Sort chips (Popular, Trending)
        container.querySelectorAll('.ss-chip[data-sort]').forEach(chip => {
            chip.addEventListener('click', () => {
                if (_state.searchUiBusy) return;
                resetState();
                _state.sortMode = chip.dataset.sort;
                updateActiveChips();
                executeSearch();
            });
        });

        // Source toggle chips
        container.querySelectorAll('.ss-source-chip[data-source]').forEach(chip => {
            chip.addEventListener('click', () => {
                if (_state.searchUiBusy) return;
                const src = chip.dataset.source;
                if (_activeSources.has(src)) {
                    // Don't allow disabling all sources
                    if (_activeSources.size <= 1) return;
                    _activeSources.delete(src);
                    chip.classList.remove('active');
                    chip.setAttribute('aria-pressed', 'false');
                } else {
                    _activeSources.add(src);
                    chip.classList.add('active');
                    chip.setAttribute('aria-pressed', 'true');
                }
                updateOverview();
                if (_state.query || _state.category) {
                    executeSearch();
                } else {
                    setStatus(getViewLabel(), `${_activeSources.size} source${_activeSources.size === 1 ? '' : 's'} active for the next search.`);
                }
            });
        });
    }

    // =========================================
    // Public API
    // =========================================
    return {
        /**
         * Initialize the script store panel.
         * @param {HTMLElement} containerEl - DOM element to render into
         * @param {Object} options
         * @param {Function} options.getInstalledScripts - async fn returning array of installed scripts
         * @param {Function} [options.onInstalled] - callback after a script is installed
         */
        init(containerEl, options = {}) {
            if (!containerEl) throw new Error('ScriptStore.init: container element required');

            _state.container = containerEl;
            _state.getInstalledScripts = options.getInstalledScripts || (async () => {
                try {
                    const res = await chrome.runtime.sendMessage({ action: 'getScripts' });
                    return res?.scripts || [];
                } catch { return []; }
            });
            _state.onInstalled = options.onInstalled || null;

            injectStyles();
            buildPanel(containerEl);
            bindPanelEvents();
            updateOverview();

            // Pre-populate installed names
            refreshInstalledNames();
            resetState();
            _state.sortMode = 'daily_installs';
            updateActiveChips();
            executeSearch();
        },

        /**
         * Search for scripts by keyword.
         * @param {string} query
         */
        async search(query) {
            if (!query) return;
            resetState();
            _state.query = query;
            const input = _state.container?.querySelector('.ss-search-input');
            if (input) input.value = query;
            updateActiveChips();
            await executeSearch();
        },

        /**
         * Browse a category.
         * @param {string} category - one of: productivity, entertainment, privacy, social, utilities
         */
        async browse(category) {
            if (!CATEGORIES[category]) return;
            resetState();
            _state.category = category;
            const input = _state.container?.querySelector('.ss-search-input');
            if (input) input.value = '';
            updateActiveChips();
            await executeSearch();
        },

        /**
         * Search for scripts targeting a specific site.
         * @param {string} hostname - e.g. "youtube.com"
         */
        async searchForSite(hostname) {
            if (!hostname) return;
            resetState();
            _state.siteHostname = hostname;
            const input = _state.container?.querySelector('.ss-search-input');
            if (input) input.value = hostname;
            updateActiveChips();
            await executeSearch();
        },

        /**
         * Clean up and remove the store panel.
         */
        destroy() {
            if (_state.container) _state.container.innerHTML = '';
            if (_state.styleEl) {
                _state.styleEl.remove();
                _state.styleEl = null;
            }
            _state.container = null;
            _state.getInstalledScripts = null;
            _state.onInstalled = null;
            _state.installedNames.clear();
            resetState();
        }
    };
})();
