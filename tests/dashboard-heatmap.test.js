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
    expect(dashboardJs).toMatch(/ActivityHeatmap\._recordActivity\(\s*heatmapType,\s*event\.scriptId \|\| null,\s*new Date\(event\.timestamp\),\s*\{ scriptName: event\.scriptName \}\s*\)/);
  });

  it('keeps valid days when storage contains malformed records', async () => {
    const ActivityHeatmap = loadHeatmap();
    const today = new Date();
    const key = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    await chrome.storage.local.set({
      sv_activity_log: {
        [key]: {
          executions: '2',
          edits: -4,
          installs: 1000000,
          errors: null,
          scripts: ['script-b', 'script-a'],
          scriptNames: { 'script-a': 'Alpha' },
        },
        brokenNull: null,
        brokenPrimitive: 'not-a-day',
        brokenScripts: { executions: 3, scripts: 'not-an-array' },
        '2020-01-01': { executions: 9, scripts: [] },
      },
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    await ActivityHeatmap.init(host);

    const normalized = ActivityHeatmap._getDataSnapshot();
    expect(normalized[key].executions).toBe(2);
    expect(normalized[key].edits).toBe(0);
    expect(normalized[key].installs).toBe(100000);
    expect(normalized[key].scripts).toEqual(['script-a', 'script-b']);
    expect(normalized.brokenNull).toBeUndefined();
    expect(normalized.brokenPrimitive).toBeUndefined();
    expect(normalized['2020-01-01']).toBeUndefined();

    const stored = (await chrome.storage.local.get('sv_activity_log')).sv_activity_log;
    expect(stored[key]).toEqual(normalized[key]);
    expect((await chrome.storage.local.get('sv_activity_log_diagnostic')).sv_activity_log_diagnostic.malformedRecords).toBeGreaterThan(0);
  });

  it('bounds retention, script names, and serialized storage size', async () => {
    const ActivityHeatmap = loadHeatmap();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const history = {};
    for (let offset = 0; offset < 450; offset += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - offset);
      const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      const scripts = Array.from({ length: 260 }, (_, index) => `script-${index}`);
      history[key] = {
        executions: 3,
        scripts,
        scriptNames: Object.fromEntries(scripts.map(scriptId => [scriptId, 'N'.repeat(220)])),
      };
    }
    await chrome.storage.local.set({ sv_activity_log: history });

    const host = document.createElement('div');
    document.body.appendChild(host);
    await ActivityHeatmap.init(host);

    const normalized = ActivityHeatmap._getDataSnapshot();
    const limits = ActivityHeatmap.STORAGE_LIMITS;
    expect(Object.keys(normalized).length).toBeLessThanOrEqual(limits.RETENTION_DAYS);
    expect(normalized[Object.keys(normalized).sort().at(-1)]).toBeDefined();
    expect(Object.values(normalized).every(day => day.scripts.length <= limits.MAX_SCRIPTS_PER_DAY)).toBe(true);
    expect(JSON.stringify(normalized).length).toBeLessThan(limits.MAX_STORAGE_BYTES);
    expect(Object.values(normalized).every(day => Object.values(day.scriptNames).every(name => name.length <= 160))).toBe(true);
  });

  it('serializes delayed writes and keeps in-memory activity after a rejected write', async () => {
    const ActivityHeatmap = loadHeatmap();
    const host = document.createElement('div');
    document.body.appendChild(host);
    await ActivityHeatmap.init(host);
    const originalSet = chrome.storage.local.set;
    const deferred = [];
    chrome.storage.local.set = vi.fn(items => new Promise((resolve, reject) => {
      deferred.push({
        items,
        complete: async () => { await originalSet(items); resolve(); },
        reject,
      });
    }));

    const first = ActivityHeatmap._recordActivity(ActivityHeatmap.ACTIVITY_TYPES.EDIT, 'script-a', new Date());
    await vi.waitFor(() => expect(deferred).toHaveLength(1));
    const second = ActivityHeatmap._recordActivity(ActivityHeatmap.ACTIVITY_TYPES.EDIT, 'script-b', new Date());
    expect(deferred).toHaveLength(1);
    await deferred[0].complete();
    await vi.waitFor(() => expect(deferred).toHaveLength(2));
    await deferred[1].complete();
    await Promise.all([first, second]);
    const dayKey = Object.keys(ActivityHeatmap._getDataSnapshot())[0];
    const persistedDay = (await chrome.storage.local.get('sv_activity_log')).sv_activity_log[dayKey];
    expect(persistedDay.edits).toBe(2);
    expect(persistedDay.scripts).toEqual(['script-a', 'script-b']);

    chrome.storage.local.set = vi.fn().mockRejectedValueOnce(new Error('QUOTA'));
    await ActivityHeatmap._recordActivity(ActivityHeatmap.ACTIVITY_TYPES.ERROR, 'script-c', new Date());
    expect(ActivityHeatmap._getStorageState().error).toBeInstanceOf(Error);
    expect(host.querySelector('.sv-heatmap-storage-status')?.hidden).toBe(false);
    expect(host.querySelector('.sv-heatmap-storage-retry')?.textContent).toBe('Retry');
    chrome.storage.local.set = originalSet;
    await ActivityHeatmap._recordActivity(ActivityHeatmap.ACTIVITY_TYPES.ERROR, 'script-d', new Date());
    expect(ActivityHeatmap._getStorageState().error).toBeNull();
    expect(host.querySelector('.sv-heatmap-storage-status')?.hidden).toBe(true);
    expect(ActivityHeatmap._getDataSnapshot()[dayKey].errors).toBe(2);
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
