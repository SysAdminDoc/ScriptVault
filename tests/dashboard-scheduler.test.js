import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schedulerCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-scheduler.js'), 'utf8');

describe('ScriptScheduler module', () => {
  let ScriptScheduler;

  beforeEach(() => {
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn((keys, cb) => {
            if (cb) cb({});
            return Promise.resolve({});
          }),
          set: vi.fn((data, cb) => {
            if (cb) cb();
            return Promise.resolve();
          }),
        },
      },
      alarms: {
        create: vi.fn(),
        clear: vi.fn((name, cb) => { if (cb) cb(true); return Promise.resolve(true); }),
        getAll: vi.fn((cb) => { if (cb) cb([]); return Promise.resolve([]); }),
      },
      runtime: {
        sendMessage: vi.fn(() => Promise.resolve({})),
      },
    };
    globalThis.ScriptVaultDashboardUI = { toast: vi.fn() };
    const _body = schedulerCode + '\nreturn ScriptScheduler;';
    try { const vm = require('node:vm'); const _cf = vm.compileFunction(_body, [], { filename: resolve(__dirname, '../pages/dashboard-scheduler.js') }); ScriptScheduler = _cf(); } catch { ScriptScheduler = new Function(_body)(); }
  });

  it('generateGuardCode returns empty string for disabled schedule', () => {
    expect(ScriptScheduler.generateGuardCode(null)).toBe('');
    expect(ScriptScheduler.generateGuardCode({ enabled: false, type: 'time' })).toBe('');
  });

  it('generateGuardCode returns non-empty guard for enabled time schedule', () => {
    const guard = ScriptScheduler.generateGuardCode({
      enabled: true,
      type: 'time',
      timeStart: '09:00',
      timeEnd: '17:00',
      days: [1, 2, 3, 4, 5],
    });
    expect(guard).toContain('__svScheduleCheck');
    expect(guard).toContain('09:00');
    expect(guard).toContain('17:00');
  });

  it('generateGuardCode embeds schedule as JSON in guard code', () => {
    const schedule = {
      enabled: true,
      type: 'day',
      days: [0, 6],
    };
    const guard = ScriptScheduler.generateGuardCode(schedule);
    expect(guard).toContain('"type":"day"');
    expect(guard).toContain('"days":[0,6]');
  });

  it('generateGuardCode handles dateRange schedule type', () => {
    const guard = ScriptScheduler.generateGuardCode({
      enabled: true,
      type: 'dateRange',
      dateStart: '2026-01-01',
      dateEnd: '2026-12-31',
    });
    expect(guard).toContain('dateRange');
    expect(guard).toContain('2026-01-01');
  });

  it('generateGuardCode handles oneTime schedule type', () => {
    const guard = ScriptScheduler.generateGuardCode({
      enabled: true,
      type: 'oneTime',
      oneTime: '2026-06-20T12:00:00',
    });
    expect(guard).toContain('oneTime');
    expect(guard).toContain('60000');
  });

  it('generateGuardCode handles interval schedule type', () => {
    const guard = ScriptScheduler.generateGuardCode({
      enabled: true,
      type: 'interval',
      interval: 30,
      intervalUnit: 'minutes',
    });
    expect(guard).toContain('interval');
    expect(guard).toContain('return true');
  });
});
