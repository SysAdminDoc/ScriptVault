import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/event-log.js'), 'utf8');
const tsSource = readFileSync(resolve(__dirname, '../src/modules/event-log.ts'), 'utf8');

function createEventLog() {
  const fn = new Function('chrome', 'console', 'setTimeout', 'clearTimeout',
    code + '\nreturn { EventLog };'
  );
  return fn(globalThis.chrome, console, globalThis.setTimeout, globalThis.clearTimeout).EventLog;
}

let EventLog;

beforeEach(() => {
  globalThis.__resetStorageMock();
  EventLog = createEventLog();
  vi.clearAllMocks();
});

describe('Structured Event Logging', () => {
  it('logs an event with correct structure', async () => {
    const record = await EventLog.log({
      category: 'install',
      action: 'script_installed',
      detail: 'Test script installed',
      scriptId: 'test-id',
      scriptName: 'Test Script',
      url: 'https://example.com/test.user.js',
    });

    expect(record).toMatchObject({
      category: 'install',
      severity: 'info',
      action: 'script_installed',
      detail: 'Test script installed',
      scriptId: 'test-id',
      scriptName: 'Test Script',
      hostname: 'example.com',
    });
    expect(record.id).toBeTruthy();
    expect(record.timestamp).toBeGreaterThan(0);
  });

  it('strips URL to hostname for privacy', async () => {
    const record = await EventLog.log({
      category: 'install',
      action: 'script_installed',
      url: 'https://greasyfork.org/en/scripts/12345-my-script',
    });
    expect(record.hostname).toBe('greasyfork.org');
  });

  it('handles null/missing URL', async () => {
    const record = await EventLog.log({
      category: 'toggle',
      action: 'script_toggled',
    });
    expect(record.hostname).toBeNull();
  });

  it('defaults severity to info', async () => {
    const record = await EventLog.log({
      category: 'sync',
      action: 'sync_started',
    });
    expect(record.severity).toBe('info');
  });

  it('accepts error severity', async () => {
    const record = await EventLog.log({
      category: 'error',
      severity: 'error',
      action: 'script_error',
      detail: 'Unexpected error in handler',
    });
    expect(record.severity).toBe('error');
  });

  it('enforces ring buffer max entries', async () => {
    EventLog.setMaxEntries(3);
    await EventLog.log({ category: 'install', action: 'a' });
    await EventLog.log({ category: 'install', action: 'b' });
    await EventLog.log({ category: 'install', action: 'c' });
    await EventLog.log({ category: 'install', action: 'd' });

    const all = await EventLog.getAll();
    expect(all.length).toBe(3);
    expect(all[0].action).toBe('d');
    expect(all[2].action).toBe('b');
  });

  it('filters by category', async () => {
    await EventLog.log({ category: 'install', action: 'install_1' });
    await EventLog.log({ category: 'update', action: 'update_1' });
    await EventLog.log({ category: 'install', action: 'install_2' });

    const installs = await EventLog.getAll({ category: 'install' });
    expect(installs.length).toBe(2);
    expect(installs.every(e => e.category === 'install')).toBe(true);
  });

  it('filters by severity', async () => {
    await EventLog.log({ category: 'error', severity: 'error', action: 'err' });
    await EventLog.log({ category: 'sync', action: 'sync_ok' });

    const errors = await EventLog.getAll({ severity: 'error' });
    expect(errors.length).toBe(1);
    expect(errors[0].action).toBe('err');
  });

  it('filters by search term', async () => {
    await EventLog.log({ category: 'install', action: 'installed', scriptName: 'Dark Theme' });
    await EventLog.log({ category: 'install', action: 'installed', scriptName: 'Auto Login' });

    const results = await EventLog.getAll({ search: 'dark' });
    expect(results.length).toBe(1);
    expect(results[0].scriptName).toBe('Dark Theme');
  });

  it('clears all events', async () => {
    await EventLog.log({ category: 'install', action: 'a' });
    await EventLog.log({ category: 'update', action: 'b' });
    await EventLog.clear();

    const all = await EventLog.getAll();
    expect(all.length).toBe(0);
  });

  it('produces a valid summary', async () => {
    await EventLog.log({ category: 'install', action: 'a' });
    await EventLog.log({ category: 'install', action: 'b' });
    await EventLog.log({ category: 'error', severity: 'error', action: 'c' });
    await EventLog.log({ category: 'sync', action: 'd' });

    const summary = await EventLog.getSummary();
    expect(summary.total).toBe(4);
    expect(summary.byCategory.install).toBe(2);
    expect(summary.byCategory.error).toBe(1);
    expect(summary.byCategory.sync).toBe(1);
    expect(summary.bySeverity.info).toBe(3);
    expect(summary.bySeverity.error).toBe(1);
    expect(summary.oldestTimestamp).toBeGreaterThan(0);
    expect(summary.newestTimestamp).toBeGreaterThanOrEqual(summary.oldestTimestamp);
  });

  it('exports to JSON with schema header', async () => {
    await EventLog.log({ category: 'install', action: 'test' });
    const entries = await EventLog.getAll();
    const json = EventLog.exportJSON(entries);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe('scriptvault-event-log/v1');
    expect(parsed.count).toBe(1);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.exportedAt).toBeTruthy();
  });

  it('exports to CSV with header row', async () => {
    await EventLog.log({ category: 'install', action: 'test', scriptName: 'My Script' });
    const entries = await EventLog.getAll();
    const csv = EventLog.exportCSV(entries);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('timestamp,category,severity,action,detail,scriptId,scriptName,hostname');
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('install');
    expect(lines[1]).toContain('"My Script"');
  });
});

describe('EventLog source contract', () => {
  it('defines typed event categories', () => {
    expect(tsSource).toContain("| 'install'");
    expect(tsSource).toContain("| 'update'");
    expect(tsSource).toContain("| 'sync'");
    expect(tsSource).toContain("| 'toggle'");
    expect(tsSource).toContain("| 'registration'");
    expect(tsSource).toContain("| 'error'");
    expect(tsSource).toContain("| 'security'");
  });

  it('enforces privacy by extracting hostname only', () => {
    expect(tsSource).toContain('_extractHostname');
    expect(tsSource).toContain('new URL(url).hostname');
  });

  it('has a 1000-entry default ring size', () => {
    expect(tsSource).toContain('MAX_ENTRIES = 1000');
  });
});
