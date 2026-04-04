// ScriptVault v2.0.0 — Popup Execution Timeline
// Shows a mini timeline of script executions on the current page

const PopupTimeline = (() => {
  'use strict';

  let _container = null;
  let _visible = false;

  function _injectStyles() {
    if (document.getElementById('sv-ptl-css')) return;
    const style = document.createElement('style');
    style.id = 'sv-ptl-css';
    style.textContent = `
      .ptl-panel { display:none; border-top:1px solid var(--popup-border); max-height:200px; overflow-y:auto; overscroll-behavior:contain; }
      .ptl-panel.open { display:block; }
      .ptl-header { display:flex; align-items:center; justify-content:space-between; width:100%; padding:4px 12px; background:var(--popup-bg-raised); border:none; border-bottom:1px solid var(--popup-border-subtle); cursor:pointer; color:inherit; font:inherit; text-align:left; transition:background 0.18s ease; }
      .ptl-header:hover { background:var(--popup-bg-hover); }
      .ptl-header:focus-visible { outline:2px solid var(--popup-accent); outline-offset:-2px; }
      .ptl-title { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--popup-text-muted); }
      .ptl-toggle { font-size:10px; color:var(--popup-text-dim); }
      .ptl-list { padding:4px 0; }
      .ptl-item { display:flex; align-items:center; gap:6px; padding:3px 12px; font-size:11px; }
      .ptl-time { color:var(--popup-text-dim); font-size:10px; min-width:40px; font-variant-numeric:tabular-nums; }
      .ptl-bar-wrap { flex:1; height:6px; background:var(--popup-bg); border-radius:3px; overflow:hidden; min-width:40px; }
      .ptl-bar { height:100%; border-radius:3px; transition:width 0.3s ease; }
      .ptl-bar.fast { background:var(--popup-accent); }
      .ptl-bar.medium { background:#fbbf24; }
      .ptl-bar.slow { background:var(--popup-danger); }
      .ptl-name { color:var(--popup-text); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px; }
      .ptl-dur { color:var(--popup-text-muted); font-size:10px; min-width:35px; text-align:right; font-variant-numeric:tabular-nums; }
      .ptl-empty { padding:8px 12px; text-align:center; color:var(--popup-text-dim); font-size:11px; }
      .ptl-summary { display:flex; gap:8px; padding:4px 12px; font-size:10px; color:var(--popup-text-muted); border-top:1px solid var(--popup-border-subtle); }
      .ptl-stat { display:flex; align-items:center; gap:3px; }
      .ptl-dot { width:6px; height:6px; border-radius:50%; }
      @media (prefers-reduced-motion: reduce) {
        .ptl-bar { transition:none; }
      }
    `;
    document.head.appendChild(style);
  }

  function _render(scripts) {
    if (!_container) return;

    const withStats = scripts.filter(s => s.stats && s.stats.runs > 0 && s.enabled !== false);
    if (withStats.length === 0) {
      _container.querySelector('.ptl-list').innerHTML = '<div class="ptl-empty">No execution data for this page yet</div>';
      _container.querySelector('.ptl-summary').innerHTML = '';
      return;
    }

    // Sort by avg time descending (slowest first)
    withStats.sort((a, b) => (b.stats.avgTime || 0) - (a.stats.avgTime || 0));
    const maxTime = Math.max(...withStats.map(s => s.stats.avgTime || 0), 1);

    const list = _container.querySelector('.ptl-list');
    list.innerHTML = withStats.map(s => {
      const meta = s.metadata || s.meta || {};
      const avg = s.stats.avgTime || 0;
      const pct = Math.max(5, (avg / maxTime) * 100);
      const cls = avg < 50 ? 'fast' : avg < 200 ? 'medium' : 'slow';
      const dur = avg < 1000 ? avg.toFixed(0) + 'ms' : (avg / 1000).toFixed(1) + 's';
      const lastRun = s.stats.lastRun ? new Date(s.stats.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

      return `<div class="ptl-item">
        <span class="ptl-time">${lastRun}</span>
        <span class="ptl-name" title="${_esc(meta.name || '')}">${_esc(meta.name || 'Unknown')}</span>
        <div class="ptl-bar-wrap"><div class="ptl-bar ${cls}" style="width:${pct}%"></div></div>
        <span class="ptl-dur">${dur}</span>
      </div>`;
    }).join('');

    // Summary
    const totalTime = withStats.reduce((sum, s) => sum + (s.stats.avgTime || 0), 0);
    const totalErrors = withStats.reduce((sum, s) => sum + (s.stats.errors || 0), 0);
    const summary = _container.querySelector('.ptl-summary');
    summary.innerHTML = `
      <div class="ptl-stat"><span class="ptl-dot" style="background:var(--popup-accent)"></span> ${withStats.length} scripts</div>
      <div class="ptl-stat"><span class="ptl-dot" style="background:#fbbf24"></span> ${totalTime.toFixed(0)}ms total</div>
      ${totalErrors > 0 ? `<div class="ptl-stat"><span class="ptl-dot" style="background:var(--popup-danger)"></span> ${totalErrors} errors</div>` : ''}
    `;
  }

  function _esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  return {
    init(insertBeforeEl, scripts) {
      _injectStyles();

      _container = document.createElement('div');
      _container.innerHTML = `
        <button class="ptl-header" id="ptlToggle" type="button" aria-expanded="false" aria-controls="ptlPanel">
          <span class="ptl-title">Execution Timeline</span>
          <span class="ptl-toggle" id="ptlArrow">▶</span>
        </button>
        <div class="ptl-panel" id="ptlPanel" role="region" aria-label="Execution timeline" hidden>
          <div class="ptl-list"></div>
          <div class="ptl-summary"></div>
        </div>
      `;

      if (!insertBeforeEl?.parentNode) return;
      insertBeforeEl.parentNode.insertBefore(_container, insertBeforeEl);

      _container.querySelector('#ptlToggle').addEventListener('click', () => {
        _visible = !_visible;
        const toggle = _container.querySelector('#ptlToggle');
        const panel = _container.querySelector('#ptlPanel');
        panel.classList.toggle('open', _visible);
        panel.hidden = !_visible;
        toggle.setAttribute('aria-expanded', String(_visible));
        _container.querySelector('#ptlArrow').textContent = _visible ? '▼' : '▶';
      });

      if (scripts) _render(scripts);
    },

    update(scripts) {
      _render(scripts);
    },

    destroy() {
      if (_container) { _container.remove(); _container = null; }
    }
  };
})();
