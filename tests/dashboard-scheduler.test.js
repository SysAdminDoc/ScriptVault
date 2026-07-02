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

  it('dateRange guard/shouldRunNow use local date components, not UTC toISOString', () => {
    // Both the runtime shouldRunNow and the emitted guard must key on local
    // Y-M-D so a <input type="date"> boundary matches the user's calendar day.
    expect(schedulerCode).not.toContain("now.toISOString().slice(0, 10)");
    const guard = ScriptScheduler.generateGuardCode({
      enabled: true, type: 'dateRange', dateStart: '2026-01-01', dateEnd: '2026-12-31',
    });
    expect(guard).toContain('getFullYear');
  });

  it('setSchedule notifies the background to apply the schedule', async () => {
    await ScriptScheduler.setSchedule('script-1', { enabled: true, type: 'interval', interval: 15 });
    expect(globalThis.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rescheduleScript', scriptId: 'script-1' }),
    );
  });
});

describe('background scheduler enforcement (background.core.js)', () => {
  const core = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

  it('routes sv_sched_ alarms to handleScheduleAlarm', () => {
    expect(core).toContain('SCHEDULE_ALARM_PREFIX');
    expect(core).toContain('handleScheduleAlarm(scriptId)');
  });

  it('skips page-load registration for interval/oneTime schedules', () => {
    expect(core).toContain('SCHEDULE_ALARM_TYPES.has(scriptSchedule.type)');
    expect(core).toContain('Skipped page-load registration for alarm-scheduled script');
  });

  it('injects a schedule guard for time/day/dateRange schedules', () => {
    expect(core).toContain('buildScheduleGuardFn');
    expect(core).toContain('SCHEDULE_GUARD_TYPES.has(scriptSchedule.type)');
    expect(core).toContain('__svScheduleOk');
  });

  it('disables one-time schedules after firing', () => {
    expect(core).toContain("sched.type === 'oneTime'");
    expect(core).toContain('enabled: false');
  });

  it('recreates schedule alarms on startup', () => {
    expect(core).toContain('setupScheduleAlarms');
  });
});
