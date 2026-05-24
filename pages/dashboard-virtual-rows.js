// ScriptVault dashboard table virtualization.
// Keeps large flat script lists responsive by rendering the visible window
// plus spacer rows that preserve scroll height.
(function(global) {
    'use strict';

    const DEFAULTS = {
        rowHeight: 72,
        overscan: 12,
        maxRows: 60,
        columnCount: 13
    };

    function clampNumber(value, fallback, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.max(min, Math.min(max, num));
    }

    function computeWindow({ total, rowHeight = DEFAULTS.rowHeight, viewportHeight = 720, scrollTop = 0, overscan = DEFAULTS.overscan, maxRows = DEFAULTS.maxRows } = {}) {
        const safeTotal = Math.max(0, Number(total) || 0);
        const safeRowHeight = clampNumber(rowHeight, DEFAULTS.rowHeight, 24, 240);
        const safeViewport = clampNumber(viewportHeight, 720, safeRowHeight, 4000);
        const safeScrollTop = Math.max(0, Number(scrollTop) || 0);
        const safeOverscan = clampNumber(overscan, DEFAULTS.overscan, 0, 100);
        const safeMaxRows = clampNumber(maxRows, DEFAULTS.maxRows, 10, 200);
        const firstVisible = Math.floor(safeScrollTop / safeRowHeight);
        const visibleRows = Math.ceil(safeViewport / safeRowHeight);
        const start = Math.max(0, firstVisible - safeOverscan);
        const count = Math.min(safeTotal - start, Math.max(0, Math.min(safeMaxRows, visibleRows + safeOverscan * 2)));
        const end = Math.min(safeTotal, start + count);
        return {
            start,
            end,
            count: Math.max(0, end - start),
            beforeHeight: start * safeRowHeight,
            afterHeight: Math.max(0, safeTotal - end) * safeRowHeight,
            rowHeight: safeRowHeight
        };
    }

    function createSpacer(height, columnCount, label) {
        const tr = document.createElement('tr');
        tr.className = `virtual-row-spacer ${label}`;
        tr.setAttribute('aria-hidden', 'true');
        const td = document.createElement('td');
        td.colSpan = columnCount;
        td.style.height = `${Math.max(0, Math.round(height))}px`;
        td.style.padding = '0';
        td.style.border = '0';
        td.style.lineHeight = '0';
        tr.appendChild(td);
        return tr;
    }

    function renderWindow({ tbody, scripts, createRow, windowState, columnCount = DEFAULTS.columnCount }) {
        if (!tbody) return null;
        const fragment = document.createDocumentFragment();
        if (windowState.beforeHeight > 0) {
            fragment.appendChild(createSpacer(windowState.beforeHeight, columnCount, 'before'));
        }
        for (let index = windowState.start; index < windowState.end; index += 1) {
            const row = createRow(scripts[index], index);
            if (row) fragment.appendChild(row);
        }
        if (windowState.afterHeight > 0) {
            fragment.appendChild(createSpacer(windowState.afterHeight, columnCount, 'after'));
        }
        tbody.replaceChildren(fragment);
        tbody.dataset.virtualized = 'true';
        tbody.dataset.virtualStart = String(windowState.start);
        tbody.dataset.virtualEnd = String(windowState.end);
        return windowState;
    }

    function measureDocumentWindow(tbody, rowHeight) {
        const rect = tbody.getBoundingClientRect();
        const pageY = global.scrollY || global.pageYOffset || 0;
        const bodyTop = rect.top + pageY;
        const stickyAllowance = 120;
        return {
            scrollTop: Math.max(0, pageY - bodyTop + stickyAllowance),
            viewportHeight: global.innerHeight || Math.max(rowHeight * 12, 720)
        };
    }

    function mount(options) {
        const tbody = options?.tbody;
        if (!tbody) return null;
        destroy(tbody);

        const scripts = Array.isArray(options.scripts) ? options.scripts : [];
        const rowHeight = clampNumber(options.rowHeight, DEFAULTS.rowHeight, 24, 240);
        const overscan = clampNumber(options.overscan, DEFAULTS.overscan, 0, 100);
        const maxRows = clampNumber(options.maxRows, DEFAULTS.maxRows, 10, 200);
        const columnCount = clampNumber(options.columnCount, DEFAULTS.columnCount, 1, 64);
        const createRow = options.createRow;
        if (typeof createRow !== 'function') return null;

        let rafId = 0;
        let lastStart = -1;
        let lastEnd = -1;

        const instance = {
            render(force = false) {
                const measured = measureDocumentWindow(tbody, rowHeight);
                const windowState = computeWindow({
                    total: scripts.length,
                    rowHeight,
                    viewportHeight: measured.viewportHeight,
                    scrollTop: measured.scrollTop,
                    overscan,
                    maxRows
                });
                if (!force && windowState.start === lastStart && windowState.end === lastEnd) return windowState;
                lastStart = windowState.start;
                lastEnd = windowState.end;
                renderWindow({ tbody, scripts, createRow, windowState, columnCount });
                if (typeof options.onAfterRender === 'function') options.onAfterRender(windowState);
                return windowState;
            },
            schedule() {
                if (rafId) return;
                rafId = global.requestAnimationFrame(() => {
                    rafId = 0;
                    instance.render();
                });
            },
            destroy() {
                if (rafId) {
                    global.cancelAnimationFrame(rafId);
                    rafId = 0;
                }
                global.removeEventListener('scroll', instance.schedule, { passive: true });
                global.removeEventListener('resize', instance.schedule);
                delete tbody._scriptVaultVirtualRows;
            }
        };

        global.addEventListener('scroll', instance.schedule, { passive: true });
        global.addEventListener('resize', instance.schedule);
        tbody._scriptVaultVirtualRows = instance;
        instance.render(true);
        return instance;
    }

    function destroy(tbody) {
        const instance = tbody?._scriptVaultVirtualRows;
        if (instance && typeof instance.destroy === 'function') instance.destroy();
        if (tbody) {
            delete tbody.dataset.virtualized;
            delete tbody.dataset.virtualStart;
            delete tbody.dataset.virtualEnd;
        }
    }

    const api = { DEFAULTS, computeWindow, renderWindow, mount, destroy };
    global.DashboardVirtualRows = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
