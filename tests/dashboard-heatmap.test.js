import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const heatmapCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-heatmap.js'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

function loadHeatmap() {
  const body = `${heatmapCode}\nreturn ActivityHeatmap;`;
  try {
    const vm = require('node:vm');
    return vm.compileFunction(body, [], { filename: resolve(process.cwd(), 'pages/dashboard-heatmap.js') })();
  } catch {
    return new Function(body)();
  }
}

function stubCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    scale: vi.fn(),
    set fillStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {},
  });
}

describe('dashboard heatmap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    globalThis.__resetStorageMock?.();
    stubCanvas();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('counts error-only days as active using the same total as cell coloring', () => {
    const ActivityHeatmap = loadHeatmap();
    ActivityHeatmap._recordActivity(ActivityHeatmap.ACTIVITY_TYPES.ERROR, 'script-a', new Date(), {
      scriptName: 'Alpha Script',
    });

    const stats = ActivityHeatmap.getStats();
    expect(stats.activeDays).toBe(1);
    expect(stats.currentStreak).toBe(1);
    expect(stats.totalErrors).toBe(1);
    expect(stats.mostActiveCount).toBe(1);
  });

  it('uses script names in the filter and reuses one tooltip across init calls', async () => {
    const ActivityHeatmap = loadHeatmap();
    const today = new Date();
    const key = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    await chrome.storage.local.set({
      sv_activity_log: {
        [key]: {
          executions: 1,
          edits: 0,
          installs: 0,
          errors: 0,
          scripts: ['script-a'],
          scriptNames: { 'script-a': 'Alpha Script' },
        },
      },
    });

    const firstHost = document.createElement('div');
    document.body.appendChild(firstHost);
    await ActivityHeatmap.init(firstHost);
    expect(firstHost.querySelector('.sv-heatmap-select option[value="script-a"]')?.textContent)
      .toBe('Alpha Script (script-a)');
    expect(document.querySelectorAll('.sv-heatmap-tooltip')).toHaveLength(1);

    const secondHost = document.createElement('div');
    document.body.appendChild(secondHost);
    await ActivityHeatmap.init(secondHost);
    expect(document.querySelectorAll('.sv-heatmap-tooltip')).toHaveLength(1);

    ActivityHeatmap.destroy();
  });

  it('passes scriptName into heatmap telemetry records', () => {
    expect(dashboardJs).toContain('ActivityHeatmap._recordActivity(heatmapType, event.scriptId || null, new Date(event.timestamp), { scriptName: event.scriptName })');
  });

  it('sizes the canvas to the real column count so the newest days never clip', () => {
    // Sunday-alignment can push the 52-week window to 53 partial columns; the
    // canvas width and month-label loop must use that count, not a fixed WEEKS,
    // or the most recent 1-6 days render off the right edge.
    expect(heatmapCode).toContain('Math.ceil(dates.length / DAYS_PER_WEEK)');
    expect(heatmapCode).toContain('numCols * (CELL_SIZE + CELL_GAP)');
    expect(heatmapCode).toContain('for (let wi = 0; wi < numCols; wi++)');
    expect(heatmapCode).not.toContain('LABEL_WIDTH + WEEKS * (CELL_SIZE + CELL_GAP)');
  });
});
