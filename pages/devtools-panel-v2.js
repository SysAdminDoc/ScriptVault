// ScriptVault DevTools Panel v2 — Supplemental Module
// Network waterfall, full console, request body inspector, performance hints

const DevToolsV2 = (() => {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let _logLimit = 500;
  let _waterfallState = null;
  let _consoleState = null;
  let _bodyInspectorState = null;
  let _destroyed = false;

  // ── Shared Utilities ─────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatBytes(n) {
    if (!n || n <= 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function formatDuration(ms) {
    if (ms == null) return '\u2014';
    if (ms < 1000) return ms.toFixed(0) + 'ms';
    return (ms / 1000).toFixed(2) + 's';
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function injectStyles(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
  }

  function showToast(container, message) {
    const toast = document.createElement('div');
    toast.className = 'dtv2-toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 200);
    }, 1500);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. NETWORK WATERFALL TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════

  const WATERFALL_CSS = `
    .dtv2-waterfall { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg, #1e1e1e); overflow: hidden; }
    .dtv2-wf-controls { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--bg-raised, #252525); border-bottom: 1px solid var(--border, #3a3a3a); flex-shrink: 0; }
    .dtv2-wf-controls button { background: none; border: 1px solid var(--border, #3a3a3a); color: var(--text-muted, #888); cursor: pointer; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
    .dtv2-wf-controls button:hover { color: var(--text, #d4d4d4); border-color: var(--text-muted, #888); }
    .dtv2-wf-controls .dtv2-wf-label { font-size: 10px; color: var(--text-muted, #888); }
    .dtv2-wf-legend { display: flex; gap: 10px; margin-left: auto; font-size: 10px; }
    .dtv2-wf-legend-item { display: flex; align-items: center; gap: 3px; color: var(--text-muted, #888); }
    .dtv2-wf-legend-swatch { width: 10px; height: 6px; border-radius: 1px; }
    .dtv2-wf-canvas-wrap { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; position: relative; }
    .dtv2-wf-canvas { display: block; width: 100%; }
    .dtv2-wf-tooltip { position: fixed; background: var(--bg-raised, #252525); border: 1px solid var(--border, #3a3a3a); border-radius: 4px; padding: 8px 10px; font-size: 11px; color: var(--text, #d4d4d4); pointer-events: none; z-index: 9999; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); white-space: nowrap; }
    .dtv2-wf-tooltip-url { font-weight: 600; margin-bottom: 4px; word-break: break-all; white-space: normal; max-width: 380px; }
    .dtv2-wf-tooltip-row { display: flex; gap: 8px; color: var(--text-muted, #888); }
    .dtv2-wf-tooltip-row span:first-child { min-width: 50px; }
    .dtv2-wf-tooltip-row .val { color: var(--text, #d4d4d4); font-weight: 500; }
    .dtv2-wf-detail { background: var(--bg-raised, #252525); border-top: 1px solid var(--border, #3a3a3a); padding: 8px 10px; flex-shrink: 0; max-height: 200px; overflow-y: auto; font-size: 11px; display: none; }
    .dtv2-wf-detail.open { display: block; }
    .dtv2-wf-detail-title { font-weight: 600; margin-bottom: 6px; }
    .dtv2-wf-detail-row { display: flex; gap: 6px; margin-bottom: 2px; }
    .dtv2-wf-detail-key { color: var(--text-muted, #888); min-width: 80px; flex-shrink: 0; }
    .dtv2-wf-detail-val { word-break: break-all; }
  `;

  const TYPE_COLORS = {
    xhr: '#60a5fa',
    xmlhttprequest: '#60a5fa',
    fetch: '#4ade80',
    websocket: '#a78bfa',
    beacon: '#fb923c',
    other: '#888888'
  };

  function getRequestType(entry) {
    const t = (entry.type || entry.initiatorType || '').toLowerCase();
    if (t === 'xmlhttprequest' || t === 'xhr') return 'xhr';
    if (t === 'fetch') return 'fetch';
    if (t === 'websocket' || t === 'ws') return 'websocket';
    if (t === 'beacon') return 'beacon';
    // Heuristic fallback
    if (entry.url) {
      const url = entry.url.toLowerCase();
      if (url.startsWith('ws://') || url.startsWith('wss://')) return 'websocket';
    }
    return t || 'other';
  }

  function getBarColor(entry) {
    const type = getRequestType(entry);
    return TYPE_COLORS[type] || TYPE_COLORS.other;
  }

  function initWaterfall(containerEl) {
    if (_destroyed) return;
    injectStyles('dtv2-waterfall-css', WATERFALL_CSS);

    const state = {
      container: containerEl,
      entries: [],
      zoom: 1,
      autoScroll: true,
      hoveredIndex: -1,
      selectedIndex: -1,
      rowHeight: 22,
      labelWidth: 160,
      dpr: window.devicePixelRatio || 1,
      tooltip: null,
      canvas: null,
      ctx: null,
      wrapEl: null,
      detailEl: null,
      animFrame: null
    };

    containerEl.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'dtv2-waterfall';

    // Controls bar
    const controls = document.createElement('div');
    controls.className = 'dtv2-wf-controls';
    controls.innerHTML = `
      <button class="dtv2-wf-zin" title="Zoom in">+</button>
      <button class="dtv2-wf-zout" title="Zoom out">\u2013</button>
      <button class="dtv2-wf-zreset" title="Reset zoom">1:1</button>
      <span class="dtv2-wf-label">Zoom: <span class="dtv2-wf-zlabel">1.0x</span></span>
      <label style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--text-muted,#888);cursor:pointer">
        <input type="checkbox" class="dtv2-wf-autoscroll" checked style="margin:0"> Auto-scroll
      </label>
      <div class="dtv2-wf-legend">
        <span class="dtv2-wf-legend-item"><span class="dtv2-wf-legend-swatch" style="background:${TYPE_COLORS.xhr}"></span>XHR</span>
        <span class="dtv2-wf-legend-item"><span class="dtv2-wf-legend-swatch" style="background:${TYPE_COLORS.fetch}"></span>Fetch</span>
        <span class="dtv2-wf-legend-item"><span class="dtv2-wf-legend-swatch" style="background:${TYPE_COLORS.websocket}"></span>WS</span>
        <span class="dtv2-wf-legend-item"><span class="dtv2-wf-legend-swatch" style="background:${TYPE_COLORS.beacon}"></span>Beacon</span>
      </div>
    `;
    root.appendChild(controls);

    // Canvas wrapper
    const wrapEl = document.createElement('div');
    wrapEl.className = 'dtv2-wf-canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'dtv2-wf-canvas';
    wrapEl.appendChild(canvas);
    root.appendChild(wrapEl);

    // Detail pane
    const detailEl = document.createElement('div');
    detailEl.className = 'dtv2-wf-detail';
    root.appendChild(detailEl);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'dtv2-wf-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    containerEl.appendChild(root);

    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');
    state.wrapEl = wrapEl;
    state.detailEl = detailEl;
    state.tooltip = tooltip;

    // Zoom controls
    controls.querySelector('.dtv2-wf-zin').addEventListener('click', () => {
      state.zoom = clamp(state.zoom * 1.5, 0.25, 20);
      controls.querySelector('.dtv2-wf-zlabel').textContent = state.zoom.toFixed(1) + 'x';
      drawWaterfall(state);
    });
    controls.querySelector('.dtv2-wf-zout').addEventListener('click', () => {
      state.zoom = clamp(state.zoom / 1.5, 0.25, 20);
      controls.querySelector('.dtv2-wf-zlabel').textContent = state.zoom.toFixed(1) + 'x';
      drawWaterfall(state);
    });
    controls.querySelector('.dtv2-wf-zreset').addEventListener('click', () => {
      state.zoom = 1;
      controls.querySelector('.dtv2-wf-zlabel').textContent = '1.0x';
      drawWaterfall(state);
    });
    controls.querySelector('.dtv2-wf-autoscroll').addEventListener('change', (e) => {
      state.autoScroll = e.target.checked;
    });

    // Mouse interactions on canvas
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top + wrapEl.scrollTop;
      const idx = Math.floor(y / state.rowHeight);

      if (idx >= 0 && idx < state.entries.length) {
        if (state.hoveredIndex !== idx) {
          state.hoveredIndex = idx;
          drawWaterfall(state);
        }
        const entry = state.entries[idx];
        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <div class="dtv2-wf-tooltip-url">${escapeHtml(entry.url || '')}</div>
          <div class="dtv2-wf-tooltip-row"><span>Status:</span> <span class="val">${entry.status || '\u2014'}</span></div>
          <div class="dtv2-wf-tooltip-row"><span>Duration:</span> <span class="val">${formatDuration(entry.duration)}</span></div>
          <div class="dtv2-wf-tooltip-row"><span>Size:</span> <span class="val">${formatBytes(entry.responseSize)}</span></div>
          <div class="dtv2-wf-tooltip-row"><span>Type:</span> <span class="val">${getRequestType(entry)}</span></div>
          <div class="dtv2-wf-tooltip-row"><span>Script:</span> <span class="val">${escapeHtml(entry.scriptName || '\u2014')}</span></div>
        `;
        // Position tooltip near cursor
        let tx = e.clientX + 12;
        let ty = e.clientY + 12;
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        if (tx + tw > window.innerWidth - 8) tx = e.clientX - tw - 8;
        if (ty + th > window.innerHeight - 8) ty = e.clientY - th - 8;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      } else {
        state.hoveredIndex = -1;
        tooltip.style.display = 'none';
        drawWaterfall(state);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      state.hoveredIndex = -1;
      tooltip.style.display = 'none';
      drawWaterfall(state);
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top + wrapEl.scrollTop;
      const idx = Math.floor(y / state.rowHeight);
      if (idx >= 0 && idx < state.entries.length) {
        state.selectedIndex = (state.selectedIndex === idx) ? -1 : idx;
        if (state.selectedIndex >= 0) {
          showWaterfallDetail(state, state.entries[state.selectedIndex]);
        } else {
          detailEl.classList.remove('open');
        }
        drawWaterfall(state);
      }
    });

    _waterfallState = state;
    return {
      update(entries) {
        state.entries = entries.slice(-_logLimit);
        drawWaterfall(state);
        if (state.autoScroll) {
          requestAnimationFrame(() => {
            wrapEl.scrollTop = wrapEl.scrollHeight;
          });
        }
      },
      destroy() {
        tooltip.remove();
        containerEl.innerHTML = '';
      }
    };
  }

  function drawWaterfall(state) {
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
    state.animFrame = requestAnimationFrame(() => _drawWaterfallImmediate(state));
  }

  function _drawWaterfallImmediate(state) {
    const { canvas, ctx, entries, rowHeight, labelWidth, zoom, dpr, wrapEl, hoveredIndex, selectedIndex } = state;
    const wrapWidth = wrapEl.clientWidth;
    const totalHeight = entries.length * rowHeight;

    canvas.style.width = wrapWidth + 'px';
    canvas.style.height = totalHeight + 'px';
    canvas.width = wrapWidth * dpr;
    canvas.height = totalHeight * dpr;
    ctx.scale(dpr, dpr);

    // Compute time range
    let minTime = Infinity, maxTime = -Infinity;
    for (const e of entries) {
      const ts = e.timestamp || 0;
      const end = ts + (e.duration || 0);
      if (ts < minTime) minTime = ts;
      if (end > maxTime) maxTime = end;
    }
    if (!isFinite(minTime)) { minTime = 0; maxTime = 1; }
    const timeSpan = Math.max(maxTime - minTime, 1);
    const timelineWidth = (wrapWidth - labelWidth - 16) * zoom;

    // Background
    const computedBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1e1e1e';
    const computedBgHover = getComputedStyle(document.documentElement).getPropertyValue('--bg-hover').trim() || '#2e2e2e';
    const computedBorder = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#3a3a3a';
    const computedText = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#d4d4d4';
    const computedMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
    const computedAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4CAF50';

    ctx.fillStyle = computedBg;
    ctx.fillRect(0, 0, wrapWidth, totalHeight);

    // Visible row range (cull for performance)
    const scrollTop = wrapEl.scrollTop;
    const visibleTop = scrollTop - rowHeight;
    const visibleBottom = scrollTop + wrapEl.clientHeight + rowHeight;
    const startIdx = Math.max(0, Math.floor(visibleTop / rowHeight));
    const endIdx = Math.min(entries.length, Math.ceil(visibleBottom / rowHeight));

    // Time axis gridlines
    ctx.strokeStyle = computedBorder;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = computedMuted;
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'center';
    const gridCount = Math.min(Math.max(Math.floor(timelineWidth / 80), 2), 20);
    for (let i = 0; i <= gridCount; i++) {
      const x = labelWidth + (timelineWidth * i / gridCount);
      if (x > wrapWidth) break;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();
      const ms = (timeSpan * i / gridCount);
      const label = ms < 1000 ? ms.toFixed(0) + 'ms' : (ms / 1000).toFixed(1) + 's';
      ctx.fillText(label, x, 10);
    }

    // Draw rows
    for (let i = startIdx; i < endIdx; i++) {
      const entry = entries[i];
      const y = i * rowHeight;

      // Row background
      if (i === selectedIndex) {
        ctx.fillStyle = computedBgHover;
        ctx.fillRect(0, y, wrapWidth, rowHeight);
        ctx.strokeStyle = computedAccent;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, y + 0.5, wrapWidth - 1, rowHeight - 1);
      } else if (i === hoveredIndex) {
        ctx.fillStyle = computedBgHover;
        ctx.fillRect(0, y, wrapWidth, rowHeight);
      }

      // Row separator
      ctx.strokeStyle = computedBorder;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(wrapWidth, y + rowHeight);
      ctx.stroke();

      // Label: method + truncated URL
      const method = (entry.method || 'GET').toUpperCase();
      let urlLabel = '';
      try {
        const u = new URL(entry.url);
        urlLabel = u.pathname.slice(0, 30) + (u.pathname.length > 30 ? '\u2026' : '');
      } catch {
        urlLabel = (entry.url || '').slice(0, 30);
      }

      ctx.textAlign = 'left';
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.fillStyle = computedMuted;
      ctx.fillText(method, 4, y + rowHeight / 2 + 3);
      ctx.font = '10px Consolas, monospace';
      ctx.fillStyle = computedText;
      ctx.fillText(urlLabel, 38, y + rowHeight / 2 + 3);

      // Bar
      const ts = entry.timestamp || minTime;
      const dur = entry.duration || 0;
      const barStart = labelWidth + ((ts - minTime) / timeSpan) * timelineWidth;
      const barWidth = Math.max((dur / timeSpan) * timelineWidth, 3);
      const barY = y + 5;
      const barH = rowHeight - 10;
      const color = getBarColor(entry);

      ctx.fillStyle = color;
      ctx.beginPath();
      const r = 2;
      const bw = Math.min(barWidth, wrapWidth - barStart);
      if (bw > 2 * r) {
        ctx.moveTo(barStart + r, barY);
        ctx.lineTo(barStart + bw - r, barY);
        ctx.arcTo(barStart + bw, barY, barStart + bw, barY + r, r);
        ctx.lineTo(barStart + bw, barY + barH - r);
        ctx.arcTo(barStart + bw, barY + barH, barStart + bw - r, barY + barH, r);
        ctx.lineTo(barStart + r, barY + barH);
        ctx.arcTo(barStart, barY + barH, barStart, barY + barH - r, r);
        ctx.lineTo(barStart, barY + r);
        ctx.arcTo(barStart, barY, barStart + r, barY, r);
      } else {
        ctx.rect(barStart, barY, Math.max(bw, 2), barH);
      }
      ctx.fill();

      // Status indicator on bar if error
      if (entry.status && entry.status >= 400) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(String(entry.status), barStart + bw + 4, y + rowHeight / 2 + 3);
      }
    }
  }

  function showWaterfallDetail(state, entry) {
    const d = state.detailEl;
    d.classList.add('open');
    const type = getRequestType(entry);
    d.innerHTML = `
      <div class="dtv2-wf-detail-title">${escapeHtml((entry.method || 'GET') + ' ' + (entry.url || ''))}</div>
      <div class="dtv2-wf-detail-row"><span class="dtv2-wf-detail-key">Status:</span><span class="dtv2-wf-detail-val">${entry.status || '\u2014'} ${escapeHtml(entry.statusText || '')}</span></div>
      <div class="dtv2-wf-detail-row"><span class="dtv2-wf-detail-key">Type:</span><span class="dtv2-wf-detail-val">${type}</span></div>
      <div class="dtv2-wf-detail-row"><span class="dtv2-wf-detail-key">Duration:</span><span class="dtv2-wf-detail-val">${formatDuration(entry.duration)}</span></div>
      <div class="dtv2-wf-detail-row"><span class="dtv2-wf-detail-key">Size:</span><span class="dtv2-wf-detail-val">${formatBytes(entry.responseSize)}</span></div>
      <div class="dtv2-wf-detail-row"><span class="dtv2-wf-detail-key">Script:</span><span class="dtv2-wf-detail-val">${escapeHtml(entry.scriptName || '\u2014')}</span></div>
      <div class="dtv2-wf-detail-row"><span class="dtv2-wf-detail-key">Time:</span><span class="dtv2-wf-detail-val">${entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '\u2014'}</span></div>
      ${entry.error ? `<div class="dtv2-wf-detail-row"><span class="dtv2-wf-detail-key" style="color:var(--danger)">Error:</span><span class="dtv2-wf-detail-val" style="color:var(--danger)">${escapeHtml(entry.error)}</span></div>` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. FULL CONSOLE TAB
  // ═══════════════════════════════════════════════════════════════════════════

  const CONSOLE_CSS = `
    .dtv2-console { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg, #1e1e1e); overflow: hidden; }
    .dtv2-con-toolbar { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--bg-raised, #252525); border-bottom: 1px solid var(--border, #3a3a3a); flex-shrink: 0; flex-wrap: wrap; }
    .dtv2-con-toolbar select { background: var(--bg-row, #282828); border: 1px solid var(--border, #3a3a3a); color: var(--text, #d4d4d4); padding: 2px 4px; border-radius: 3px; font-size: 11px; max-width: 160px; }
    .dtv2-con-toolbar select:focus,
    .dtv2-con-toolbar select:focus-visible { outline: none; border-color: var(--accent, #4CAF50); box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.18); }
    .dtv2-con-toggle { display: inline-flex; align-items: center; gap: 2px; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; cursor: pointer; border: 1px solid var(--border, #3a3a3a); background: transparent; transition: opacity 0.15s; }
    .dtv2-con-toggle.off { opacity: 0.35; }
    .dtv2-con-toggle.log { color: var(--text-muted, #888); }
    .dtv2-con-toggle.warn { color: var(--warning, #f59e0b); }
    .dtv2-con-toggle.error { color: var(--danger, #ef4444); }
    .dtv2-con-toggle.info { color: var(--info, #60a5fa); }
    .dtv2-con-search { background: var(--bg-row, #282828); border: 1px solid var(--border, #3a3a3a); color: var(--text, #d4d4d4); padding: 2px 6px; border-radius: 3px; font-size: 11px; width: 140px; }
    .dtv2-con-search:focus,
    .dtv2-con-search:focus-visible { outline: none; border-color: var(--accent, #4CAF50); box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.18); }
    .dtv2-con-btn { background: none; border: 1px solid var(--border, #3a3a3a); color: var(--text-muted, #888); cursor: pointer; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
    .dtv2-con-btn:hover { color: var(--text, #d4d4d4); border-color: var(--text-muted, #888); }
    .dtv2-con-entries { flex: 1; overflow-y: auto; min-height: 0; font-family: Consolas, monospace; font-size: 11px; }
    .dtv2-con-entry { display: flex; gap: 6px; padding: 3px 8px; border-bottom: 1px solid var(--border, #3a3a3a); align-items: flex-start; position: relative; }
    .dtv2-con-entry:hover { background: var(--bg-hover, #2e2e2e); }
    .dtv2-con-entry.level-warn { background: rgba(245,158,11,0.04); }
    .dtv2-con-entry.level-error { background: rgba(239,68,68,0.06); }
    .dtv2-con-ts { color: var(--text-dim, #555); flex-shrink: 0; font-size: 10px; min-width: 65px; padding-top: 1px; }
    .dtv2-con-script { color: var(--accent, #4CAF50); flex-shrink: 0; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; padding-top: 1px; }
    .dtv2-con-level { flex-shrink: 0; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 2px; text-transform: uppercase; min-width: 32px; text-align: center; }
    .dtv2-con-level.log { color: var(--text-muted, #888); }
    .dtv2-con-level.warn { color: var(--warning, #f59e0b); background: rgba(245,158,11,0.1); }
    .dtv2-con-level.error { color: var(--danger, #ef4444); background: rgba(239,68,68,0.1); }
    .dtv2-con-level.info { color: var(--info, #60a5fa); background: rgba(96,165,250,0.1); }
    .dtv2-con-msg { flex: 1; word-break: break-all; white-space: pre-wrap; line-height: 1.4; }
    .dtv2-con-copy { position: absolute; right: 4px; top: 2px; background: var(--bg-raised, #252525); border: 1px solid var(--border, #3a3a3a); color: var(--text-muted, #888); cursor: pointer; padding: 1px 5px; border-radius: 2px; font-size: 9px; opacity: 0; transition: opacity 0.15s; }
    .dtv2-con-entry:hover .dtv2-con-copy { opacity: 1; }
    .dtv2-con-copy:hover { color: var(--text, #d4d4d4); }
    .dtv2-con-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted, #888); font-size: 12px; }

    /* JSON Tree Viewer */
    .dtv2-json-tree { margin: 2px 0; }
    .dtv2-json-toggle { cursor: pointer; user-select: none; color: var(--text-muted, #888); margin-right: 2px; display: inline-block; width: 10px; font-size: 9px; }
    .dtv2-json-key { color: #9cdcfe; }
    .dtv2-json-str { color: #ce9178; }
    .dtv2-json-num { color: #b5cea8; }
    .dtv2-json-bool { color: #569cd6; }
    .dtv2-json-null { color: #569cd6; font-style: italic; }
    .dtv2-json-bracket { color: var(--text-muted, #888); }
    .dtv2-json-children { padding-left: 16px; display: none; }
    .dtv2-json-children.open { display: block; }

    .dtv2-toast { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%) translateY(8px); background: var(--bg-raised, #252525); border: 1px solid var(--accent, #4CAF50); color: var(--accent, #4CAF50); padding: 4px 14px; border-radius: 4px; font-size: 11px; opacity: 0; transition: opacity 0.2s, transform 0.2s; z-index: 999; pointer-events: none; }
    .dtv2-toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;

  function buildJsonTree(data, depth) {
    depth = depth || 0;
    const maxDepth = 8;
    if (depth > maxDepth) return document.createTextNode('\u2026');

    if (data === null) {
      const s = document.createElement('span');
      s.className = 'dtv2-json-null';
      s.textContent = 'null';
      return s;
    }
    if (data === undefined) {
      const s = document.createElement('span');
      s.className = 'dtv2-json-null';
      s.textContent = 'undefined';
      return s;
    }
    if (typeof data === 'string') {
      const s = document.createElement('span');
      s.className = 'dtv2-json-str';
      s.textContent = '"' + (data.length > 500 ? data.slice(0, 500) + '\u2026' : data) + '"';
      return s;
    }
    if (typeof data === 'number') {
      const s = document.createElement('span');
      s.className = 'dtv2-json-num';
      s.textContent = String(data);
      return s;
    }
    if (typeof data === 'boolean') {
      const s = document.createElement('span');
      s.className = 'dtv2-json-bool';
      s.textContent = String(data);
      return s;
    }

    const isArray = Array.isArray(data);
    const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
    const container = document.createElement('span');
    container.className = 'dtv2-json-tree';

    const toggle = document.createElement('span');
    toggle.className = 'dtv2-json-toggle';
    toggle.textContent = '\u25b6';

    const preview = document.createElement('span');
    preview.className = 'dtv2-json-bracket';
    preview.textContent = isArray
      ? `Array(${entries.length})`
      : `Object {${entries.slice(0, 3).map(([k]) => k).join(', ')}${entries.length > 3 ? ', \u2026' : ''}}`;

    const openBracket = document.createElement('span');
    openBracket.className = 'dtv2-json-bracket';
    openBracket.textContent = isArray ? ' [' : ' {';
    openBracket.style.display = 'none';

    const children = document.createElement('div');
    children.className = 'dtv2-json-children';

    const closeBracket = document.createElement('span');
    closeBracket.className = 'dtv2-json-bracket';
    closeBracket.textContent = isArray ? ']' : '}';
    closeBracket.style.display = 'none';

    let childrenBuilt = false;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = children.classList.contains('open');
      if (!isOpen && !childrenBuilt) {
        for (const [key, val] of entries) {
          const row = document.createElement('div');
          const keySpan = document.createElement('span');
          keySpan.className = 'dtv2-json-key';
          keySpan.textContent = isArray ? '' : key + ': ';
          row.appendChild(keySpan);
          row.appendChild(buildJsonTree(val, depth + 1));
          children.appendChild(row);
        }
        childrenBuilt = true;
      }
      children.classList.toggle('open');
      toggle.textContent = children.classList.contains('open') ? '\u25bc' : '\u25b6';
      preview.style.display = children.classList.contains('open') ? 'none' : '';
      openBracket.style.display = children.classList.contains('open') ? '' : 'none';
      closeBracket.style.display = children.classList.contains('open') ? '' : 'none';
    });

    container.appendChild(toggle);
    container.appendChild(preview);
    container.appendChild(openBracket);
    container.appendChild(children);
    container.appendChild(closeBracket);
    return container;
  }

  function formatConsoleArg(arg) {
    if (arg === null || arg === undefined || typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      return buildJsonTree(arg, 0);
    }
    if (typeof arg === 'object') {
      return buildJsonTree(arg, 0);
    }
    const s = document.createElement('span');
    s.textContent = String(arg);
    return s;
  }

  function initConsole(containerEl) {
    if (_destroyed) return;
    injectStyles('dtv2-console-css', CONSOLE_CSS);

    const state = {
      container: containerEl,
      entries: [],
      scripts: [],
      filterScript: '',
      filterText: '',
      levels: { log: true, warn: true, error: true, info: true },
      refreshTimer: null,
      entriesEl: null,
      scriptSelect: null
    };

    containerEl.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'dtv2-console';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'dtv2-con-toolbar';

    const scriptSelect = document.createElement('select');
    scriptSelect.innerHTML = '<option value="">All scripts</option>';
    toolbar.appendChild(scriptSelect);

    const levels = ['log', 'warn', 'error', 'info'];
    const toggleBtns = {};
    for (const level of levels) {
      const btn = document.createElement('button');
      btn.className = `dtv2-con-toggle ${level}`;
      btn.textContent = level;
      btn.addEventListener('click', () => {
        state.levels[level] = !state.levels[level];
        btn.classList.toggle('off', !state.levels[level]);
        renderConsoleEntries(state);
      });
      toggleBtns[level] = btn;
      toolbar.appendChild(btn);
    }

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dtv2-con-search';
    searchInput.placeholder = 'Search\u2026';
    searchInput.addEventListener('input', (e) => {
      state.filterText = e.target.value.toLowerCase();
      renderConsoleEntries(state);
    });
    toolbar.appendChild(searchInput);

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    toolbar.appendChild(spacer);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'dtv2-con-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', async () => {
      const scriptId = state.filterScript || undefined;
      try {
        await chrome.runtime.sendMessage({
          action: 'clearScriptConsole',
          scriptId
        });
      } catch { /* ignore */ }
      if (scriptId) {
        state.entries = state.entries.filter(e => e.scriptId !== scriptId);
      } else {
        state.entries = [];
      }
      renderConsoleEntries(state);
    });
    toolbar.appendChild(clearBtn);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'dtv2-con-btn';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', () => fetchConsoleEntries(state));
    toolbar.appendChild(refreshBtn);

    root.appendChild(toolbar);

    scriptSelect.addEventListener('change', (e) => {
      state.filterScript = e.target.value;
      renderConsoleEntries(state);
    });

    // Entries container
    const entriesEl = document.createElement('div');
    entriesEl.className = 'dtv2-con-entries';
    root.appendChild(entriesEl);

    containerEl.appendChild(root);
    state.entriesEl = entriesEl;
    state.scriptSelect = scriptSelect;

    // Clean up previous console state if re-initializing
    if (_consoleState?.refreshTimer) clearInterval(_consoleState.refreshTimer);

    // Auto-refresh
    fetchConsoleEntries(state);
    state.refreshTimer = setInterval(() => fetchConsoleEntries(state), 3000);

    _consoleState = state;
    return {
      refresh() { fetchConsoleEntries(state); },
      destroy() {
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        containerEl.innerHTML = '';
      }
    };
  }

  async function fetchConsoleEntries(state) {
    if (_destroyed) return;
    try {
      // Fetch scripts list for the dropdown
      const scriptsResult = await chrome.runtime.sendMessage({ action: 'getScripts' });
      const scripts = scriptsResult?.scripts || Object.values(scriptsResult || {});
      state.scripts = scripts;

      // Update dropdown
      const currentVal = state.scriptSelect.value;
      const options = ['<option value="">All scripts</option>'];
      for (const s of scripts) {
        const name = s.meta?.name || s.id || 'Unknown';
        const id = s.id || '';
        options.push(`<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`);
      }
      state.scriptSelect.innerHTML = options.join('');
      state.scriptSelect.value = currentVal;

      // Fetch console entries for each script (or all)
      const allEntries = [];
      const scriptIds = scripts.map(s => s.id).filter(Boolean);
      const fetches = scriptIds.map(id =>
        chrome.runtime.sendMessage({ action: 'getScriptConsole', scriptId: id })
          .then(result => {
            const entries = Array.isArray(result) ? result : (result?.entries || []);
            for (const e of entries) {
              e.scriptId = e.scriptId || id;
              const script = scripts.find(s => s.id === id);
              e.scriptName = e.scriptName || script?.meta?.name || id;
            }
            return entries;
          })
          .catch(() => [])
      );

      const results = await Promise.all(fetches);
      for (const r of results) allEntries.push(...r);

      // Sort by timestamp
      allEntries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      state.entries = allEntries;
      renderConsoleEntries(state);
    } catch (e) {
      console.error('[DTV2] console fetch error:', e);
    }
  }

  function renderConsoleEntries(state) {
    const { entriesEl, entries, levels, filterScript, filterText } = state;

    const filtered = entries.filter(e => {
      const level = (e.level || 'log').toLowerCase();
      if (!levels[level]) return false;
      if (filterScript && e.scriptId !== filterScript) return false;
      if (filterText) {
        const msgText = typeof e.message === 'string' ? e.message : JSON.stringify(e.message);
        if (!(msgText || '').toLowerCase().includes(filterText) &&
            !(e.scriptName || '').toLowerCase().includes(filterText)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      entriesEl.innerHTML = '<div class="dtv2-con-empty">No console entries match the current filters</div>';
      return;
    }

    // Virtualize only if very large
    const fragment = document.createDocumentFragment();
    const limit = Math.min(filtered.length, 2000);
    const startIdx = Math.max(0, filtered.length - limit);

    for (let i = startIdx; i < filtered.length; i++) {
      const e = filtered[i];
      const level = (e.level || 'log').toLowerCase();
      const row = document.createElement('div');
      row.className = `dtv2-con-entry level-${level}`;

      // Timestamp
      const ts = document.createElement('span');
      ts.className = 'dtv2-con-ts';
      ts.textContent = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '\u2014';
      row.appendChild(ts);

      // Script name
      const sn = document.createElement('span');
      sn.className = 'dtv2-con-script';
      sn.textContent = e.scriptName || '\u2014';
      sn.title = e.scriptName || '';
      row.appendChild(sn);

      // Level badge
      const lv = document.createElement('span');
      lv.className = `dtv2-con-level ${level}`;
      lv.textContent = level;
      row.appendChild(lv);

      // Message
      const msg = document.createElement('span');
      msg.className = 'dtv2-con-msg';
      const args = e.args || [e.message];
      for (const arg of args) {
        if (typeof arg === 'object' && arg !== null) {
          msg.appendChild(formatConsoleArg(arg));
        } else {
          const textSpan = document.createElement('span');
          textSpan.textContent = String(arg ?? '');
          msg.appendChild(textSpan);
        }
        msg.appendChild(document.createTextNode(' '));
      }
      row.appendChild(msg);

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'dtv2-con-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const text = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a ?? '')).join(' ');
        copyToClipboard(text);
        showToast(state.container.querySelector('.dtv2-console'), 'Copied');
      });
      row.appendChild(copyBtn);

      fragment.appendChild(row);
    }

    entriesEl.innerHTML = '';
    entriesEl.appendChild(fragment);

    // Auto-scroll to bottom
    requestAnimationFrame(() => {
      entriesEl.scrollTop = entriesEl.scrollHeight;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. REQUEST BODY INSPECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  const BODY_INSPECTOR_CSS = `
    .dtv2-body-inspector { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg, #1e1e1e); overflow: hidden; font-size: 12px; }
    .dtv2-bi-toolbar { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--bg-raised, #252525); border-bottom: 1px solid var(--border, #3a3a3a); flex-shrink: 0; }
    .dtv2-bi-toolbar .dtv2-bi-title { font-weight: 600; color: var(--text, #d4d4d4); font-size: 11px; }
    .dtv2-bi-toolbar .dtv2-bi-type { font-size: 10px; color: var(--text-muted, #888); padding: 1px 6px; background: var(--bg-row, #282828); border-radius: 3px; }
    .dtv2-bi-content { flex: 1; overflow: auto; min-height: 0; padding: 8px; }
    .dtv2-bi-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted, #888); }
    .dtv2-bi-copy { background: none; border: 1px solid var(--border, #3a3a3a); color: var(--text-muted, #888); cursor: pointer; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: auto; }
    .dtv2-bi-copy:hover { color: var(--text, #d4d4d4); border-color: var(--text-muted, #888); }

    /* JSON syntax highlighting */
    .dtv2-bi-json { font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; line-height: 1.5; }
    .dtv2-bi-json .json-key { color: #9cdcfe; }
    .dtv2-bi-json .json-str { color: #ce9178; }
    .dtv2-bi-json .json-num { color: #b5cea8; }
    .dtv2-bi-json .json-bool { color: #569cd6; }
    .dtv2-bi-json .json-null { color: #569cd6; font-style: italic; }
    .dtv2-bi-json .json-bracket { color: var(--text-muted, #888); }
    .dtv2-bi-json .json-comma { color: var(--text-muted, #888); }

    /* Form data display */
    .dtv2-bi-form-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .dtv2-bi-form-table th { text-align: left; padding: 4px 8px; background: var(--bg-raised, #252525); color: var(--text-muted, #888); font-weight: 500; border-bottom: 1px solid var(--border, #3a3a3a); }
    .dtv2-bi-form-table td { padding: 4px 8px; border-bottom: 1px solid var(--border, #3a3a3a); font-family: Consolas, monospace; word-break: break-all; }
    .dtv2-bi-form-table tr:hover td { background: var(--bg-hover, #2e2e2e); }
    .dtv2-bi-form-key { color: #9cdcfe; }
    .dtv2-bi-form-val { color: #ce9178; }

    .dtv2-bi-binary { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted, #888); padding: 30px; }
    .dtv2-bi-binary-icon { font-size: 28px; }
  `;

  function syntaxHighlightJson(json) {
    return json.replace(
      /("(?:\\.|[^"\\])*")\s*:/g,
      '<span class="json-key">$1</span>:'
    ).replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ': <span class="json-str">$1</span>'
    ).replace(
      /:\s*(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      ': <span class="json-num">$1</span>'
    ).replace(
      /:\s*(true|false)/g,
      ': <span class="json-bool">$1</span>'
    ).replace(
      /:\s*(null)/g,
      ': <span class="json-null">$1</span>'
    ).replace(
      /([[\]{}])/g,
      '<span class="json-bracket">$1</span>'
    ).replace(
      // Standalone strings in arrays
      /(?<=\[|,)\s*("(?:\\.|[^"\\])*")(?=\s*[,\]])/g,
      ' <span class="json-str">$1</span>'
    ).replace(
      // Standalone numbers in arrays
      /(?<=\[|,)\s*(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s*[,\]])/g,
      ' <span class="json-num">$1</span>'
    ).replace(
      // Standalone booleans in arrays
      /(?<=\[|,)\s*(true|false)(?=\s*[,\]])/g,
      ' <span class="json-bool">$1</span>'
    ).replace(
      // Standalone nulls in arrays
      /(?<=\[|,)\s*(null)(?=\s*[,\]])/g,
      ' <span class="json-null">$1</span>'
    );
  }

  function detectBodyType(body, contentType) {
    contentType = (contentType || '').toLowerCase();
    if (contentType.includes('application/json') || contentType.includes('+json')) return 'json';
    if (contentType.includes('application/x-www-form-urlencoded')) return 'form';
    if (contentType.includes('multipart/form-data')) return 'multipart';
    if (contentType.includes('text/') || contentType.includes('xml') || contentType.includes('html')) return 'text';
    if (contentType.includes('application/octet-stream') || contentType.includes('image/') || contentType.includes('audio/') || contentType.includes('video/')) return 'binary';

    // Heuristic: try JSON parse
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { JSON.parse(trimmed); return 'json'; } catch { /* fall through */ }
      }
      if (trimmed.includes('=') && !trimmed.includes('\n')) return 'form';
    }

    if (typeof body === 'object' && body !== null) return 'json';
    if (typeof body === 'string') return 'text';
    return 'binary';
  }

  function initBodyInspector(containerEl) {
    if (_destroyed) return;
    injectStyles('dtv2-body-inspector-css', BODY_INSPECTOR_CSS);

    const state = {
      container: containerEl,
      currentEntry: null,
      contentEl: null,
      titleEl: null,
      typeEl: null,
      copyBtn: null
    };

    containerEl.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'dtv2-body-inspector';

    const toolbar = document.createElement('div');
    toolbar.className = 'dtv2-bi-toolbar';
    const title = document.createElement('span');
    title.className = 'dtv2-bi-title';
    title.textContent = 'Request Body';
    toolbar.appendChild(title);

    const typeLabel = document.createElement('span');
    typeLabel.className = 'dtv2-bi-type';
    typeLabel.style.display = 'none';
    toolbar.appendChild(typeLabel);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'dtv2-bi-copy';
    copyBtn.textContent = 'Copy Body';
    copyBtn.style.display = 'none';
    copyBtn.addEventListener('click', () => {
      if (!state.currentEntry) return;
      const body = state.currentEntry.requestBody;
      const text = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body || '');
      copyToClipboard(text);
      showToast(root, 'Copied');
    });
    toolbar.appendChild(copyBtn);

    root.appendChild(toolbar);

    const content = document.createElement('div');
    content.className = 'dtv2-bi-content';
    content.innerHTML = '<div class="dtv2-bi-empty">Select a POST/PUT request to inspect its body</div>';
    root.appendChild(content);

    containerEl.appendChild(root);

    state.contentEl = content;
    state.titleEl = title;
    state.typeEl = typeLabel;
    state.copyBtn = copyBtn;

    _bodyInspectorState = state;

    return {
      inspect(entry) {
        state.currentEntry = entry;
        renderBody(state, entry);
      },
      clear() {
        state.currentEntry = null;
        state.contentEl.innerHTML = '<div class="dtv2-bi-empty">Select a POST/PUT request to inspect its body</div>';
        state.typeEl.style.display = 'none';
        state.copyBtn.style.display = 'none';
        state.titleEl.textContent = 'Request Body';
      },
      destroy() {
        containerEl.innerHTML = '';
      }
    };
  }

  function renderBody(state, entry) {
    const { contentEl, titleEl, typeEl, copyBtn } = state;

    if (!entry || !entry.requestBody) {
      contentEl.innerHTML = '<div class="dtv2-bi-empty">No request body available</div>';
      typeEl.style.display = 'none';
      copyBtn.style.display = 'none';
      titleEl.textContent = 'Request Body';
      return;
    }

    const method = (entry.method || 'GET').toUpperCase();
    titleEl.textContent = `${method} Request Body`;

    const contentType = (entry.requestHeaders && (entry.requestHeaders['content-type'] || entry.requestHeaders['Content-Type'])) || '';
    const body = entry.requestBody;
    const bodyType = detectBodyType(body, contentType);

    typeEl.textContent = bodyType.toUpperCase();
    typeEl.style.display = '';
    copyBtn.style.display = '';

    contentEl.innerHTML = '';

    switch (bodyType) {
      case 'json':
        renderJsonBody(contentEl, body);
        break;
      case 'form':
        renderFormBody(contentEl, body);
        break;
      case 'multipart':
        renderFormBody(contentEl, body);
        break;
      case 'text':
        renderTextBody(contentEl, body);
        break;
      case 'binary':
        renderBinaryBody(contentEl, body, contentType);
        break;
      default:
        renderTextBody(contentEl, body);
    }
  }

  function renderJsonBody(el, body) {
    let obj = body;
    if (typeof body === 'string') {
      try { obj = JSON.parse(body); } catch {
        renderTextBody(el, body);
        return;
      }
    }
    const pre = document.createElement('pre');
    pre.className = 'dtv2-bi-json';
    const formatted = JSON.stringify(obj, null, 2);
    pre.innerHTML = syntaxHighlightJson(escapeHtml(formatted));
    // Re-apply highlighting on escaped HTML
    // Actually, we need to highlight before escaping keys/values but after escaping the structure
    // Simpler approach: build the highlighted version directly
    pre.innerHTML = '';
    pre.textContent = ''; // Clear
    const highlighted = syntaxHighlightJsonDirect(obj);
    pre.innerHTML = highlighted;
    el.appendChild(pre);
  }

  function syntaxHighlightJsonDirect(obj, indent) {
    indent = indent || 0;
    const pad = '  '.repeat(indent);
    const pad1 = '  '.repeat(indent + 1);

    if (obj === null) return '<span class="json-null">null</span>';
    if (obj === undefined) return '<span class="json-null">undefined</span>';
    if (typeof obj === 'string') return '<span class="json-str">"' + escapeHtml(obj) + '"</span>';
    if (typeof obj === 'number') return '<span class="json-num">' + obj + '</span>';
    if (typeof obj === 'boolean') return '<span class="json-bool">' + obj + '</span>';

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '<span class="json-bracket">[]</span>';
      let out = '<span class="json-bracket">[</span>\n';
      for (let i = 0; i < obj.length; i++) {
        out += pad1 + syntaxHighlightJsonDirect(obj[i], indent + 1);
        if (i < obj.length - 1) out += '<span class="json-comma">,</span>';
        out += '\n';
      }
      out += pad + '<span class="json-bracket">]</span>';
      return out;
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '<span class="json-bracket">{}</span>';
      let out = '<span class="json-bracket">{</span>\n';
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        out += pad1 + '<span class="json-key">"' + escapeHtml(k) + '"</span>: ' + syntaxHighlightJsonDirect(obj[k], indent + 1);
        if (i < keys.length - 1) out += '<span class="json-comma">,</span>';
        out += '\n';
      }
      out += pad + '<span class="json-bracket">}</span>';
      return out;
    }

    return escapeHtml(String(obj));
  }

  function renderFormBody(el, body) {
    let pairs = [];
    if (typeof body === 'string') {
      // Parse URL-encoded or key=value pairs
      const parts = body.split('&');
      for (const part of parts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx >= 0) {
          pairs.push([
            decodeURIComponent(part.slice(0, eqIdx).replace(/\+/g, ' ')),
            decodeURIComponent(part.slice(eqIdx + 1).replace(/\+/g, ' '))
          ]);
        } else {
          pairs.push([decodeURIComponent(part.replace(/\+/g, ' ')), '']);
        }
      }
    } else if (typeof body === 'object' && body !== null) {
      // formData object from Chrome: { key: [values] }
      if (body.formData) {
        for (const [k, v] of Object.entries(body.formData)) {
          const vals = Array.isArray(v) ? v : [v];
          for (const val of vals) {
            pairs.push([k, String(val)]);
          }
        }
      } else {
        pairs = Object.entries(body).map(([k, v]) => [k, String(v)]);
      }
    }

    if (pairs.length === 0) {
      el.innerHTML = '<div class="dtv2-bi-empty">No form data parsed</div>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'dtv2-bi-form-table';
    table.innerHTML = `<thead><tr><th style="width:40%">Key</th><th>Value</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    for (const [k, v] of pairs) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="dtv2-bi-form-key">${escapeHtml(k)}</td><td class="dtv2-bi-form-val">${escapeHtml(v)}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    el.appendChild(table);
  }

  function renderTextBody(el, body) {
    const pre = document.createElement('pre');
    pre.className = 'dtv2-bi-json';
    pre.style.color = 'var(--text, #d4d4d4)';
    pre.textContent = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body || '');
    el.appendChild(pre);
  }

  function renderBinaryBody(el, body, contentType) {
    el.innerHTML = `
      <div class="dtv2-bi-binary">
        <div class="dtv2-bi-binary-icon">&#x1F4E6;</div>
        <div>Binary content</div>
        <div style="font-size:10px;color:var(--text-dim,#555)">${escapeHtml(contentType || 'application/octet-stream')}</div>
        ${typeof body === 'string' ? `<div style="font-size:10px;color:var(--text-dim,#555)">${formatBytes(body.length)} (encoded)</div>` : ''}
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PERFORMANCE HINTS
  // ═══════════════════════════════════════════════════════════════════════════

  const HINT_SEVERITY = { info: 0, warning: 1, error: 2 };

  function getHints(networkLog) {
    if (!networkLog || !networkLog.length) return [];
    const hints = [];

    // Group requests by script
    const byScript = {};
    for (const entry of networkLog) {
      const name = entry.scriptName || 'Unknown';
      if (!byScript[name]) byScript[name] = [];
      byScript[name].push(entry);
    }

    for (const [scriptName, entries] of Object.entries(byScript)) {
      // 1. Batching opportunities: multiple requests to same domain
      const domainCounts = {};
      for (const e of entries) {
        try {
          const host = new URL(e.url).hostname;
          domainCounts[host] = (domainCounts[host] || 0) + 1;
        } catch { /* ignore */ }
      }
      for (const [domain, count] of Object.entries(domainCounts)) {
        if (count >= 5) {
          hints.push({
            severity: 'info',
            script: scriptName,
            message: `Script "${scriptName}" makes ${count} requests to ${domain}`,
            detail: 'Consider batching these requests to reduce overhead.',
            category: 'batching'
          });
        }
      }

      // 2. Large responses (>1MB)
      for (const e of entries) {
        if (e.responseSize && e.responseSize > 1048576) {
          hints.push({
            severity: 'warning',
            script: scriptName,
            message: `Large response (${formatBytes(e.responseSize)}) from ${truncateUrl(e.url)}`,
            detail: `Full URL: ${e.url}`,
            category: 'size'
          });
        }
      }

      // 3. Slow requests (>3s)
      for (const e of entries) {
        if (e.duration && e.duration > 3000) {
          hints.push({
            severity: 'warning',
            script: scriptName,
            message: `Slow request (${formatDuration(e.duration)}) to ${truncateUrl(e.url)}`,
            detail: `Full URL: ${e.url}`,
            category: 'slow'
          });
        }
      }

      // 4. Failed requests (error rate)
      const failed = entries.filter(e => e.error || (e.status && e.status >= 400));
      if (failed.length > 0) {
        const severity = failed.length >= 5 ? 'error' : 'warning';
        hints.push({
          severity,
          script: scriptName,
          message: `Script "${scriptName}" has ${failed.length} failed request${failed.length > 1 ? 's' : ''}`,
          detail: `Error rate: ${((failed.length / entries.length) * 100).toFixed(1)}% (${failed.length}/${entries.length})`,
          category: 'errors'
        });
      }
    }

    // Sort by severity (error first)
    hints.sort((a, b) => HINT_SEVERITY[b.severity] - HINT_SEVERITY[a.severity]);
    return hints;
  }

  function truncateUrl(url) {
    if (!url) return '\u2014';
    try {
      const u = new URL(url);
      const path = u.pathname.length > 40 ? u.pathname.slice(0, 40) + '\u2026' : u.pathname;
      return u.hostname + path;
    } catch {
      return url.slice(0, 60);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CONFIGURABLE LOG LIMIT
  // ═══════════════════════════════════════════════════════════════════════════

  function setLogLimit(limit) {
    if (typeof limit !== 'number' || limit < 1) {
      console.warn('[DTV2] setLogLimit: limit must be a positive number, got', limit);
      return;
    }
    _logLimit = Math.floor(limit);
  }

  function getLogLimit() {
    return _logLimit;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════════════════════════════════════

  function destroy() {
    _destroyed = true;
    if (_consoleState && _consoleState.refreshTimer) {
      clearInterval(_consoleState.refreshTimer);
    }
    if (_waterfallState && _waterfallState.tooltip) {
      _waterfallState.tooltip.remove();
    }
    _waterfallState = null;
    _consoleState = null;
    _bodyInspectorState = null;

    // Remove injected styles
    for (const id of ['dtv2-waterfall-css', 'dtv2-console-css', 'dtv2-body-inspector-css']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    initWaterfall,
    initConsole,
    initBodyInspector,
    getHints,
    setLogLimit,
    getLogLimit,
    destroy
  };
})();

// Support both module and script usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DevToolsV2;
}
