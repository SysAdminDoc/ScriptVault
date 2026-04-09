// ScriptVault — Card View Module
// Provides an alternative card-based grid layout for the script list,
// with responsive columns, site favicons, status indicators, and animated
// toggle between table and card views. Persists preference in settings.

const CardView = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_viewMode';
  const DESCRIPTION_MAX = 120;
  const TRANSITION_MS = 300;

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _cardGrid = null;
  let _styleEl = null;
  let _viewMode = 'table'; // 'table' | 'card'
  let _scripts = [];
  let _options = {};
  let _toggleBtn = null;
  let _ownsToggleBtn = false;
  let _toggleClickHandler = null;
  let _activeMenuId = null;
  let _tableContainer = null;

  function escapeSelectorValue(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(String(value));
    }
    return String(value).replace(/"/g, '\\"');
  }

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
/* Card View Grid */
.cv-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 14px;
  padding: 14px;
  opacity: 1;
  transition: opacity ${TRANSITION_MS}ms ease;
}
.cv-grid.cv-hidden { display: none; }
.cv-grid.cv-fade-out { opacity: 0; }

[data-density="compact"] .cv-grid {
  gap: 12px;
  padding: 12px;
}

[data-density="spacious"] .cv-grid {
  gap: 16px;
  padding: 16px;
}

@media (min-width: 560px)  { .cv-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 900px)  { .cv-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1280px) { .cv-grid { grid-template-columns: repeat(4, 1fr); } }

/* Card */
.cv-card {
  position: relative;
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    var(--bg-row);
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 22px;
  padding: 16px;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 176px;
  overflow: hidden;
  content-visibility: auto;
  contain-intrinsic-size: 224px;
  contain: layout style paint;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
}

[data-density="compact"] .cv-card {
  border-radius: 20px;
  padding: 14px;
  gap: 9px;
  min-height: 164px;
  contain-intrinsic-size: 208px;
}

[data-density="spacious"] .cv-card {
  border-radius: 24px;
  padding: 18px;
  gap: 12px;
  min-height: 188px;
  contain-intrinsic-size: 240px;
}
.cv-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: linear-gradient(90deg, rgba(96, 165, 250, 0), rgba(125, 211, 252, 0.65), rgba(96, 165, 250, 0));
  pointer-events: none;
}
.cv-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 42%, transparent 62%, rgba(255,255,255,0.03));
  pointer-events: none;
}
.cv-card:hover,
.cv-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 24px 42px rgba(0,0,0,.24);
  border-color: rgba(96, 165, 250, 0.32);
}
.cv-grid[data-list-size="large"] .cv-card,
.cv-grid[data-list-size="huge"] .cv-card {
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}
.cv-grid[data-list-size="huge"] .cv-card:hover {
  transform: none;
}

/* Status borders */
.cv-card.cv-enabled  {
  border-left: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.14), 0 18px 40px rgba(0,0,0,0.18);
}
.cv-card.cv-disabled {
  border-left: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  opacity: 0.78;
}
.cv-card.cv-selected {
  border-color: rgba(74, 222, 128, 0.34);
  box-shadow:
    inset 0 0 0 1px rgba(74, 222, 128, 0.18),
    0 24px 42px rgba(0, 0, 0, 0.22);
}
.cv-card.cv-selected::before {
  background: linear-gradient(90deg, rgba(74, 222, 128, 0), rgba(74, 222, 128, 0.72), rgba(96, 165, 250, 0.4));
}

/* Status dots */
.cv-status-dots {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 5px;
  align-items: center;
  z-index: 1;
}
.cv-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.18);
}
.cv-dot-error  { background: var(--accent-red); }
.cv-dot-stale  { background: var(--accent-yellow); }
.cv-dot-budget { background: var(--accent-orange); }

/* Header row: icon + name */
.cv-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.cv-open-surface {
  appearance: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 0 36px 0 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.cv-open-surface:focus-visible {
  outline: none;
}
.cv-name-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.cv-open-surface:hover .cv-name,
.cv-open-surface:focus-visible .cv-name {
  color: var(--accent-blue);
  text-decoration: underline;
  text-decoration-color: rgba(96, 165, 250, 0.38);
  text-underline-offset: 3px;
}

/* Favicon / letter avatar */
.cv-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
  object-fit: contain;
  box-shadow: 0 12px 18px rgba(0,0,0,0.18);
}
.cv-icon-letter {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  box-shadow: 0 12px 18px rgba(0,0,0,0.18);
}

.cv-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.cv-domain {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: fit-content;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(90, 140, 255, 0.12);
  border: 1px solid rgba(90, 140, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}

.cv-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.cv-state-pill,
.cv-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.cv-state-pill.enabled {
  background: rgba(74, 222, 128, 0.15);
  color: var(--accent-green);
}

.cv-state-pill.paused {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.cv-state-pill.error {
  background: rgba(248, 113, 113, 0.14);
  color: var(--accent-red);
}

.cv-badges {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  min-width: 0;
}

.cv-badge.remote {
  background: rgba(96, 165, 250, 0.12);
  color: #bfdbfe;
}

.cv-badge.local {
  background: rgba(148, 163, 184, 0.12);
  color: #cbd5e1;
}

.cv-badge.warning {
  background: rgba(251, 191, 36, 0.15);
  color: var(--accent-yellow);
}

.cv-badge.alert {
  background: rgba(248, 113, 113, 0.14);
  color: var(--accent-red);
}

.cv-badge.tag {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
}

/* Meta row */
.cv-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 10px;
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  position: relative;
  z-index: 1;
}
.cv-meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
}
.cv-meta-label { color: var(--text-muted); }
.cv-meta-button {
  appearance: none;
  background: rgba(90, 140, 255, 0.08);
  border: 1px solid rgba(90, 140, 255, 0.15);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  border-radius: 999px;
  padding: 4px 8px;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.cv-meta-button:hover,
.cv-meta-button:focus-visible {
  color: var(--text-primary);
  border-color: rgba(90, 140, 255, 0.45);
  background: rgba(90, 140, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 18px rgba(59,130,246,0.14);
}
.cv-meta-button:focus-visible {
  outline: 2px solid rgba(90, 140, 255, 0.35);
  outline-offset: 2px;
}

/* Description */
.cv-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  position: relative;
  z-index: 1;
}

.cv-summary {
  min-width: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

/* Performance badge */
.cv-perf {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.cv-perf.fast   { background: rgba(74,222,128,.15); color: var(--accent-green); }
.cv-perf.medium { background: rgba(251,191,36,.15); color: var(--accent-yellow); }
.cv-perf.slow   { background: rgba(248,113,113,.15); color: var(--accent-red); }

/* Footer: toggle + menu */
.cv-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(127, 127, 127, 0.14);
  position: relative;
  z-index: 1;
}
.cv-footer-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cv-select-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(127,127,127,0.14);
  background: rgba(255,255,255,0.05);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.cv-select-btn:hover,
.cv-select-btn:focus-visible {
  color: var(--text-primary);
  border-color: rgba(96, 165, 250, 0.34);
  background: rgba(96, 165, 250, 0.1);
  transform: translateY(-1px);
}
.cv-select-btn:focus-visible {
  outline: 2px solid rgba(96, 165, 250, 0.34);
  outline-offset: 2px;
}
.cv-select-btn[aria-pressed="true"] {
  color: var(--accent-green);
  border-color: rgba(74, 222, 128, 0.28);
  background: rgba(74, 222, 128, 0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 18px rgba(34, 197, 94, 0.12);
}
.cv-select-btn[aria-pressed="true"]:hover,
.cv-select-btn[aria-pressed="true"]:focus-visible {
  border-color: rgba(74, 222, 128, 0.42);
  background: rgba(74, 222, 128, 0.16);
}

@media (prefers-reduced-motion: reduce) {
  .cv-grid,
  .cv-card,
  .cv-meta-button,
  .cv-view-toggle,
  .cv-select-btn {
    transition: none;
  }
  .cv-card:hover {
    transform: none;
  }
  .cv-select-btn:hover,
  .cv-select-btn:focus-visible {
    transform: none;
  }
}

/* Toggle switch (reuses dashboard toggle) */
.cv-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
}
.cv-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.cv-toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--toggle-off);
  border-radius: 20px;
  transition: background 200ms;
}
.cv-toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 200ms;
}
.cv-toggle input:checked + .cv-toggle-slider { background: var(--toggle-on); }
.cv-toggle input:checked + .cv-toggle-slider::before { transform: translateX(16px); }

/* Three-dot menu */
.cv-menu-btn {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(127,127,127,0.14);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 5px 7px;
  border-radius: 10px;
  font-size: 16px;
  line-height: 1;
  letter-spacing: 2px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.cv-menu-btn:hover {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
    var(--bg-row-hover);
  color: var(--text-primary);
  border-color: rgba(96,165,250,0.24);
}
.cv-menu-btn:focus-visible,
.cv-menu-item:focus-visible,
.cv-open-surface:focus-visible,
.cv-toggle:focus-within {
  outline: 2px solid rgba(96, 165, 250, 0.35);
  outline-offset: 2px;
}

.cv-menu {
  position: absolute;
  right: 14px;
  bottom: 46px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
    var(--bg-header);
  border: 1px solid var(--panel-border-strong, rgba(148,163,184,0.28));
  border-radius: 14px;
  padding: 5px;
  min-width: 160px;
  z-index: 1000;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 24px 40px rgba(0,0,0,.28);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}
.cv-menu.cv-hidden { display: none; }
.cv-menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.cv-menu-item:hover { background: rgba(255,255,255,0.06); }
.cv-menu-item.danger { color: var(--accent-red); }

.cv-empty {
  display: grid;
  place-items: center;
  min-height: 210px;
  padding: 32px 24px;
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 22px;
  background:
    radial-gradient(circle at top, rgba(90, 140, 255, 0.16), transparent 58%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
  text-align: center;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), var(--panel-shadow, 0 18px 40px rgba(0,0,0,0.18));
}
.cv-empty h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--text-primary);
}
.cv-empty p {
  margin: 0;
  max-width: 440px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

/* View toggle button */
.cv-view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
    var(--bg-input);
  border: 1px solid var(--panel-border-soft, rgba(148, 163, 184, 0.16));
  border-radius: 14px;
  padding: 7px 10px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: color 150ms, border-color 150ms, background 150ms, box-shadow 150ms;
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 14px 24px rgba(0,0,0,0.14);
}
.cv-view-toggle:hover {
  color: var(--text-primary);
  border-color: rgba(96,165,250,0.28);
  box-shadow: var(--panel-sheen, inset 0 1px 0 rgba(255,255,255,0.08)), 0 18px 30px rgba(0,0,0,0.2);
}
.cv-view-toggle svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
}

/* Table fade for transition */
.cv-table-fade-out {
  opacity: 0 !important;
  transition: opacity ${TRANSITION_MS}ms ease !important;
}

@media (max-width: 768px) {
  .cv-grid {
    gap: 12px;
    padding: 12px;
  }

  .cv-card {
    border-radius: 20px;
    padding: 14px;
  }
}
`;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function nameToColor(name) {
    const hue = hashStr(name || 'Script') % 360;
    return `hsl(${hue}, 55%, 45%)`;
  }

  function truncate(str, max) {
    if (!str || str.length <= max) return str || '';
    return str.slice(0, max).trimEnd() + '\u2026';
  }

  function extractFirstDomain(matches) {
    if (!matches || !matches.length) return null;
    for (const m of matches) {
      try {
        const cleaned = m.replace(/^\*:\/\//, 'https://').replace(/\/\*$/, '/');
        const url = new URL(cleaned);
        if (url.hostname && url.hostname !== '*') {
          return url.hostname.replace(/^\*\./, '');
        }
      } catch { /* skip */ }
    }
    return null;
  }

  function formatRelativeTime(ts) {
    if (!ts) return '-';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  function getMetadata(script) {
    return script?.metadata || script?.meta || {};
  }

  function classifySourceLabel(url) {
    if (!url) return '';
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host.includes('greasyfork.org') || host.includes('sleazyfork.org')) return 'Greasy Fork';
      if (host.includes('openuserjs.org')) return 'OpenUserJS';
      if (host.includes('github.com') || host.includes('githubusercontent.com')) return 'GitHub';
      return host;
    } catch {
      return '';
    }
  }

  function describeCardProvenance(script) {
    const metadata = getMetadata(script);
    const sourceUrl = metadata.homepage || metadata.homepageURL || metadata.downloadURL || metadata.updateURL || '';
    const sourceLabel = classifySourceLabel(sourceUrl);
    if (sourceLabel) {
      return { label: sourceLabel, tone: 'remote', detail: sourceUrl };
    }
    return { label: 'Local', tone: 'local', detail: 'Created locally in ScriptVault' };
  }

  function buildCardBadges(script, { hasErrors = false, isStale = false, overBudget = false } = {}) {
    const metadata = getMetadata(script);
    const badges = [];
    const provenance = describeCardProvenance(script);
    const isNew = Boolean(script.installedAt && (Date.now() - script.installedAt < 86400000));

    badges.push(`<span class="cv-badge ${provenance.tone}" title="${escapeHtml(provenance.detail || provenance.label)}">${escapeHtml(provenance.label)}</span>`);
    if (script.settings?.pinned) {
      badges.push('<span class="cv-badge tag" title="Pinned to the top of the scripts list">Pinned</span>');
    }
    if (isNew) {
      badges.push('<span class="cv-badge tag" title="Installed within the last day">New</span>');
    }
    if (script.settings?.userModified) {
      badges.push('<span class="cv-badge warning" title="Local edits are present for this script">Local edits</span>');
    }
    if (script.settings?.mergeConflict) {
      badges.push('<span class="cv-badge alert" title="Cloud merge conflict detected. Review the script before saving again.">Conflict</span>');
    }
    if (isStale) {
      badges.push('<span class="cv-badge warning" title="This remote script has not been refreshed in over 180 days">Stale</span>');
    }
    if (overBudget) {
      badges.push('<span class="cv-badge warning" title="Average runtime exceeds the current performance budget">Slow</span>');
    }
    if (hasErrors) {
      badges.push(`<span class="cv-badge alert" title="${escapeHtml(String(script.stats?.errors || 0))} execution error(s) recorded">Errors</span>`);
    }

    const tags = metadata.tag || metadata.tags || [];
    tags.slice(0, 2).forEach((tag) => {
      badges.push(`<span class="cv-badge tag" title="Tag: ${escapeHtml(String(tag))}">#${escapeHtml(String(tag))}</span>`);
    });

    return badges.join('');
  }

  function getCardListSize(count) {
    if (count <= 0) return 'empty';
    if (count >= 80) return 'huge';
    if (count >= 36) return 'large';
    if (count >= 12) return 'medium';
    return 'small';
  }

  function buildEmptyState() {
    const empty = document.createElement('div');
    const hasScripts = typeof _options.hasScripts === 'function' ? _options.hasScripts() : _scripts.length > 0;
    empty.className = 'cv-empty';
    empty.innerHTML = hasScripts
      ? '<div><h3>Nothing matches this view</h3><p>Adjust the current search or filter to bring scripts back into focus.</p></div>'
      : '<div><h3>No scripts yet</h3><p>Create or import a script to start building out the vault.</p></div>';
    return empty;
  }

  /* ------------------------------------------------------------------ */
  /*  Style injection                                                    */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'sv-cardview-styles';
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
  /*  Persistence                                                        */
  /* ------------------------------------------------------------------ */

  function loadViewMode() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'table' || stored === 'card') return stored;
    } catch { /* ignore */ }
    return 'table';
  }

  function saveViewMode(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  }

  function createCardIconHtml(name, iconUrl) {
    const initial = escapeHtml(name.charAt(0).toUpperCase());
    const background = nameToColor(name);
    if (iconUrl) {
      return `<img class="cv-icon" src="${escapeHtml(iconUrl)}" alt="" width="38" height="38" loading="lazy" decoding="async" data-favicon-fallback="true">
        <span class="cv-icon-letter" hidden style="background:${background}">${initial}</span>`;
    }
    return `<span class="cv-icon-letter" style="background:${background}">${initial}</span>`;
  }

  function revealCardIconFallback(iconEl) {
    if (!(iconEl instanceof HTMLImageElement)) return;
    iconEl.hidden = true;
    const fallback = iconEl.nextElementSibling;
    if (fallback instanceof HTMLElement) {
      fallback.hidden = false;
    }
  }

  function invokeCardAction(callback, ...args) {
    if (typeof callback !== 'function') return;
    try {
      const result = callback(...args);
      if (result && typeof result.catch === 'function') {
        result.catch(error => console.error('[CardView] Action failed:', error));
      }
    } catch (error) {
      console.error('[CardView] Action failed:', error);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Card rendering                                                     */
  /* ------------------------------------------------------------------ */

  function buildCard(script) {
    const card = document.createElement('article');
    const cardTitleId = `cv-title-${script.id}`;
    const cardSummaryId = `cv-summary-${script.id}`;
    const cardMenuId = `cv-menu-${script.id}`;
    const selected = Boolean(_options.isSelected?.(script.id));
    card.className = `cv-card ${script.enabled !== false ? 'cv-enabled' : 'cv-disabled'}${selected ? ' cv-selected' : ''}`;
    card.dataset.scriptId = script.id;
    card.dataset.selected = String(selected);
    card.setAttribute('aria-labelledby', cardTitleId);

    const metadata = getMetadata(script);
    const name = metadata.name || 'Unnamed Script';
    const version = metadata.version || '1.0';
    const author = metadata.author || '';
    const desc = metadata.description || '';
    const enabled = script.enabled !== false;
    const matches = [...(metadata.match || []), ...(metadata.include || [])];
    const domain = extractFirstDomain(matches);
    const iconUrl = metadata.icon || metadata.iconURL;
    const stats = script.stats;
    const hasErrors = stats?.errors > 0;
    const daysSinceUpdate = script.updatedAt ? Math.floor((Date.now() - script.updatedAt) / 86400000) : 0;
    const isStale = daysSinceUpdate > 180 && (metadata.updateURL || metadata.downloadURL);
    const perfBudget = script.settings?.perfBudget || 200;
    const overBudget = stats?.avgTime > perfBudget && stats?.runs > 2;
    const stateTone = hasErrors ? 'error' : enabled ? 'enabled' : 'paused';
    const stateLabel = hasErrors ? 'Errors' : enabled ? 'Enabled' : 'Paused';
    const stateTitle = hasErrors
      ? `${escapeHtml(String(stats?.errors || 0))} execution error(s) recorded`
      : enabled
        ? 'Enabled and ready to run on matching sites'
        : 'Disabled until you turn it back on';
    const badgeHtml = buildCardBadges(script, { hasErrors, isStale, overBudget });
    const summaryParts = [
      author ? `By ${author}` : '',
      `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`,
      stats?.runs > 0 ? `${stats.runs} ${stats.runs === 1 ? 'run' : 'runs'}` : 'No recent runs',
      script.updatedAt ? `Updated ${formatRelativeTime(script.updatedAt)}` : ''
    ].filter(Boolean);
    const summaryText = summaryParts.join(' • ');

    // Status dots
    const dots = [];
    if (hasErrors)   dots.push('<span class="cv-dot cv-dot-error" title="Has errors"></span>');
    if (isStale)     dots.push('<span class="cv-dot cv-dot-stale" title="Stale script"></span>');
    if (overBudget)  dots.push('<span class="cv-dot cv-dot-budget" title="Over perf budget"></span>');

    const iconHtml = createCardIconHtml(name, iconUrl);
    const scriptIdAttr = escapeHtml(String(script.id));

    // Perf badge
    let perfHtml = '';
    if (stats && stats.runs > 0 && stats.avgTime != null) {
      const cls = stats.avgTime < 50 ? 'fast' : stats.avgTime < 200 ? 'medium' : 'slow';
      const label = stats.avgTime < 50 ? 'Fast' : stats.avgTime < 200 ? 'OK' : 'Slow';
      perfHtml = `<span class="cv-perf ${cls}" title="${stats.avgTime}ms avg">${label}</span>`;
    }

    card.innerHTML = `
      <div class="cv-status-dots">${dots.join('')}</div>
      <button type="button" class="cv-open-surface" data-open-id="${scriptIdAttr}" aria-label="Open ${escapeHtml(name)} in the editor" aria-describedby="${cardSummaryId}">
        <div class="cv-header">
          ${iconHtml}
          <div class="cv-name-stack">
            <span class="cv-name" id="${cardTitleId}" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            ${domain ? `<span class="cv-domain" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>` : ''}
          </div>
        </div>
        <div class="cv-status-row">
          <span class="cv-state-pill ${stateTone}" title="${stateTitle}">${stateLabel}</span>
          ${badgeHtml ? `<div class="cv-badges">${badgeHtml}</div>` : ''}
        </div>
        ${desc ? `<div class="cv-desc" title="${escapeHtml(desc)}">${escapeHtml(truncate(desc, DESCRIPTION_MAX))}</div>` : ''}
        <div class="cv-summary" id="${cardSummaryId}" title="${escapeHtml(summaryText)}">${escapeHtml(summaryText)}</div>
      </button>
      <div class="cv-meta">
        <span class="cv-meta-item"><span class="cv-meta-label">v</span>${escapeHtml(version)}</span>
        <button type="button" class="cv-meta-button" data-update-id="${scriptIdAttr}" aria-label="Check for updates for ${escapeHtml(name)}. Last updated ${escapeHtml(formatRelativeTime(script.updatedAt))}" title="Check for updates. Last updated ${escapeHtml(formatRelativeTime(script.updatedAt))}">${formatRelativeTime(script.updatedAt)}</button>
        ${perfHtml}
      </div>
      <div class="cv-footer">
        <div class="cv-footer-main">
          <button type="button" class="cv-select-btn" data-select-id="${scriptIdAttr}" aria-pressed="${selected ? 'true' : 'false'}" aria-label="${selected ? 'Unselect' : 'Select'} ${escapeHtml(name)}">${selected ? 'Selected' : 'Select'}</button>
          <label class="cv-toggle" title="${enabled ? 'Enabled' : 'Disabled'}">
            <input type="checkbox" ${enabled ? 'checked' : ''} data-toggle-id="${scriptIdAttr}" aria-label="${enabled ? 'Disable' : 'Enable'} ${escapeHtml(name)}">
            <span class="cv-toggle-slider"></span>
          </label>
        </div>
        <button type="button" class="cv-menu-btn" data-menu-id="${scriptIdAttr}" title="Actions" aria-label="Script actions for ${escapeHtml(name)}" aria-haspopup="menu" aria-controls="${cardMenuId}" aria-expanded="false">\u22EF</button>
        <div class="cv-menu cv-hidden" id="${cardMenuId}" data-menu-for="${scriptIdAttr}" role="menu" aria-label="Actions for ${escapeHtml(name)}">
          <button type="button" class="cv-menu-item" data-action="edit" data-id="${scriptIdAttr}">Edit</button>
          <button type="button" class="cv-menu-item" data-action="toggle" data-id="${scriptIdAttr}">${enabled ? 'Disable' : 'Enable'}</button>
          <button type="button" class="cv-menu-item" data-action="update" data-id="${scriptIdAttr}">Check for Updates</button>
          <button type="button" class="cv-menu-item" data-action="export" data-id="${scriptIdAttr}">Export</button>
          <button type="button" class="cv-menu-item danger" data-action="delete" data-id="${scriptIdAttr}">Delete</button>
        </div>
      </div>
    `;

    const icon = card.querySelector('.cv-icon[data-favicon-fallback="true"]');
    icon?.addEventListener('error', () => revealCardIconFallback(icon));

    // -- Event listeners --

    const selectorId = escapeSelectorValue(script.id);

    const openBtn = card.querySelector(`[data-open-id="${selectorId}"]`);
    openBtn?.addEventListener('click', () => {
      invokeCardAction(_options.onEdit, script.id);
    });

    const updateBtn = card.querySelector(`[data-update-id="${selectorId}"]`);
    updateBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      invokeCardAction(_options.onUpdate, script.id, { triggerEl: updateBtn });
    });

    const selectBtn = card.querySelector(`[data-select-id="${selectorId}"]`);
    selectBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      invokeCardAction(_options.onSelect, script.id, !selected, { triggerEl: selectBtn });
    });

    // Toggle switch
    const toggle = card.querySelector(`[data-toggle-id="${selectorId}"]`);
    toggle?.addEventListener('change', (e) => {
      e.stopPropagation();
      invokeCardAction(_options.onToggle, script.id, e.target.checked, { control: toggle });
    });
    toggle?.addEventListener('click', (e) => e.stopPropagation());

    // Three-dot menu
    const menuBtn = card.querySelector(`[data-menu-id="${selectorId}"]`);
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCardMenu(script.id);
    });
    const menu = card.querySelector(`[data-menu-for="${selectorId}"]`);
    menu?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAllMenus();
        menuBtn?.focus();
      }
    });

    // Menu actions
    card.querySelectorAll('.cv-menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        switch (action) {
          case 'edit':   invokeCardAction(_options.onEdit, id); break;
          case 'toggle': invokeCardAction(_options.onToggle, id, !enabled, { control: btn }); break;
          case 'update': invokeCardAction(_options.onUpdate, id, { triggerEl: btn }); break;
          case 'export': invokeCardAction(_options.onExport, id, { triggerEl: btn }); break;
          case 'delete': invokeCardAction(_options.onDelete, id, { triggerEl: btn }); break;
        }
      });
    });

    return card;
  }

  /* ------------------------------------------------------------------ */
  /*  Menu management                                                    */
  /* ------------------------------------------------------------------ */

  function toggleCardMenu(id) {
    const wasOpen = _activeMenuId === id;
    closeAllMenus();
    if (wasOpen) return;
    const selectorId = escapeSelectorValue(id);
    const menu = _cardGrid?.querySelector(`[data-menu-for="${selectorId}"]`);
    const menuBtn = _cardGrid?.querySelector(`[data-menu-id="${selectorId}"]`);
    if (menu) {
      menu.classList.remove('cv-hidden');
      _activeMenuId = id;
      menuBtn?.setAttribute('aria-expanded', 'true');
      menu.querySelector('.cv-menu-item')?.focus();
    }
  }

  function closeAllMenus() {
    _activeMenuId = null;
    _cardGrid?.querySelectorAll('.cv-menu').forEach(m => m.classList.add('cv-hidden'));
    _cardGrid?.querySelectorAll('.cv-menu-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  }

  function syncSelectionState() {
    _cardGrid?.querySelectorAll('.cv-card[data-script-id]').forEach(card => {
      const id = card.dataset.scriptId;
      const selected = Boolean(_options.isSelected?.(id));
      card.classList.toggle('cv-selected', selected);
      card.dataset.selected = String(selected);

      const selectBtn = card.querySelector(`[data-select-id="${escapeSelectorValue(id)}"]`);
      if (selectBtn) {
        selectBtn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        selectBtn.setAttribute('aria-label', `${selected ? 'Unselect' : 'Select'} ${selectBtn.closest('.cv-card')?.querySelector('.cv-name')?.textContent?.trim() || 'script'}`);
        selectBtn.textContent = selected ? 'Selected' : 'Select';
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  View toggle button                                                 */
  /* ------------------------------------------------------------------ */

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'cv-view-toggle';
    updateToggleIcon(btn);
    return btn;
  }

  function getToggleSvg(mode) {
    if (mode === 'table') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
  }

  function updateToggleIcon(btn) {
    if (!btn) return;
    const nextMode = _viewMode === 'table' ? 'card' : 'table';
    const compact = btn.id === 'btnViewToggle' || btn.classList.contains('compact');
    const label = nextMode === 'card' ? 'Switch to card view' : 'Switch to table view';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', _viewMode === 'card' ? 'true' : 'false');
    btn.innerHTML = compact ? getToggleSvg(nextMode) : `${getToggleSvg(nextMode)} ${nextMode === 'card' ? 'Cards' : 'Table'}`;
  }

  /* ------------------------------------------------------------------ */
  /*  View switching                                                     */
  /* ------------------------------------------------------------------ */

  function syncLayout() {
    const showCards = _viewMode === 'card';
    if (_tableContainer) {
      _tableContainer.style.display = showCards ? 'none' : '';
    }
    if (_container) {
      _container.style.display = showCards ? '' : 'none';
    }
    if (_cardGrid) {
      _cardGrid.classList.toggle('cv-hidden', !showCards);
      _cardGrid.classList.remove('cv-fade-out');
    }
    updateToggleIcon(_toggleBtn);
  }

  function applyViewMode(mode, animate = true) {
    _viewMode = mode;
    saveViewMode(mode);
    if (_cardGrid && animate && mode === 'card') {
      _cardGrid.classList.add('cv-fade-out');
      syncLayout();
      requestAnimationFrame(() => _cardGrid?.classList.remove('cv-fade-out'));
      return;
    }
    syncLayout();
  }

  /* ------------------------------------------------------------------ */
  /*  Global click handler (close menus on outside click)                */
  /* ------------------------------------------------------------------ */

  function onDocumentClick(e) {
    if (_activeMenuId && !e.target.closest('.cv-menu-btn') && !e.target.closest('.cv-menu')) {
      closeAllMenus();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {

    /**
     * Initialize the card view module.
     * @param {HTMLElement} containerEl - The parent element containing the script table.
     * @param {Object} options
     * @param {Function} options.onEdit     - Called with scriptId when edit requested.
     * @param {Function} options.onToggle   - Called with (scriptId, enabled).
     * @param {Function} options.onUpdate   - Called with scriptId.
     * @param {Function} options.onExport   - Called with scriptId.
     * @param {Function} options.onDelete   - Called with scriptId.
     * @param {Function} options.onSelect   - Called with (scriptId, selected).
     * @param {Function} options.isSelected - Returns true when a script is selected.
     * @param {HTMLElement} [options.tableContainer] - The table wrapper to hide in card mode.
     * @param {HTMLElement} [options.toggleButton] - Existing toggle button to bind.
     * @param {HTMLElement} [options.toggleTarget] - Element to append the view toggle button into.
     */
    init(containerEl, options = {}) {
      if (!containerEl) return;
      _container = containerEl;
      _options = options;
      _tableContainer = options.tableContainer || null;

      injectStyles();

      // Load persisted view mode
      _viewMode = loadViewMode();

      // Create card grid container
      _cardGrid = document.createElement('div');
      _cardGrid.className = 'cv-grid cv-hidden';
      _cardGrid.setAttribute('role', 'list');
      _cardGrid.setAttribute('aria-label', 'Script cards');
      _container.appendChild(_cardGrid);

      _toggleBtn = options.toggleButton || null;
      _ownsToggleBtn = !_toggleBtn;
      if (!_toggleBtn) {
        _toggleBtn = createToggleButton();
      }
      updateToggleIcon(_toggleBtn);
      _toggleClickHandler = () => {
        api.setViewMode(_viewMode === 'table' ? 'card' : 'table');
      };
      _toggleBtn.addEventListener('click', _toggleClickHandler);
      if (_ownsToggleBtn && options.toggleTarget) {
        options.toggleTarget.appendChild(_toggleBtn);
      }

      // Listen for outside clicks to close menus
      document.addEventListener('click', onDocumentClick);
      syncLayout();
    },

    /**
     * Render or re-render script cards from the provided list.
     * @param {Array} scripts - Array of script objects.
     */
    render(scripts) {
      _scripts = scripts || [];
      if (!_cardGrid) return;

      _cardGrid.innerHTML = '';
      _cardGrid.dataset.listSize = getCardListSize(_scripts.length);
      closeAllMenus();

      if (_scripts.length === 0) {
        _cardGrid.appendChild(buildEmptyState());
      } else {
        const fragment = document.createDocumentFragment();
        for (const script of _scripts) {
          const card = buildCard(script);
          card.setAttribute('role', 'listitem');
          fragment.appendChild(card);
        }
        _cardGrid.appendChild(fragment);
      }

      syncSelectionState();
      syncLayout();
    },

    /**
     * Switch between table and card view.
     * @param {'table'|'card'} mode
     */
    setViewMode(mode) {
      if (mode !== 'table' && mode !== 'card') return;
      if (mode === _viewMode) return;
      applyViewMode(mode, true);
    },

    /**
     * Get the current view mode.
     * @returns {'table'|'card'}
     */
    getViewMode() {
      return _viewMode;
    },

    syncSelection() {
      syncSelectionState();
    },

    /**
     * Clean up: remove styles, grid, listeners.
     */
    destroy() {
      document.removeEventListener('click', onDocumentClick);
      removeStyles();
      if (_toggleBtn && _toggleClickHandler) {
        _toggleBtn.removeEventListener('click', _toggleClickHandler);
      }
      if (_cardGrid) {
        _cardGrid.remove();
        _cardGrid = null;
      }
      if (_toggleBtn && _ownsToggleBtn) {
        _toggleBtn.remove();
      }
      _toggleBtn = null;
      _toggleClickHandler = null;
      _ownsToggleBtn = false;
      _container = null;
      _tableContainer = null;
      _scripts = [];
      _options = {};
      _activeMenuId = null;
      _viewMode = 'table';
    }
  };

  return api;
})();
