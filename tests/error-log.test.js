import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../modules/error-log.js'), 'utf8');

let ErrorLog;
const fn = new Function('chrome', 'console', 'crypto', 'ScriptStorage',
  code + '\nreturn { ErrorLog };'
);
const mods = fn(globalThis.chrome, console, globalThis.crypto, undefined);
ErrorLog = mods.ErrorLog;

beforeEach(() => {
  globalThis.__resetStorageMock();
  ErrorLog._cache = null;
  vi.clearAllMocks();
});

describe('ErrorLog', () => {
  it('log() creates an entry with required fields', async () => {
    const record = await ErrorLog.log({ scriptId: 's1', error: 'test error' });
    expect(record.id).toBeTruthy();
    expect(record.timestamp).toBeGreaterThan(0);
    expect(record.scriptId).toBe('s1');
    expect(record.error).toBe('test error');
  });

  it('log() handles Error objects', async () => {
    const err = new Error('boom');
    const record = await ErrorLog.log({ scriptId: 's1', error: err });
    expect(record.error).toBe('boom');
    expect(record.stack).toBeTruthy();
  });

  it('getAll() returns all entries', async () => {
    await ErrorLog.log({ scriptId: 's1', error: 'error 1' });
    await ErrorLog.log({ scriptId: 's2', error: 'error 2' });
    const all = await ErrorLog.getAll();
    expect(all).toHaveLength(2);
  });

  it('getAll() filters by scriptId', async () => {
    await ErrorLog.log({ scriptId: 's1', error: 'a' });
    await ErrorLog.log({ scriptId: 's2', error: 'b' });
    await ErrorLog.log({ scriptId: 's1', error: 'c' });
    const filtered = await ErrorLog.getAll({ scriptId: 's1' });
    expect(filtered).toHaveLength(2);
  });

  it('getAll() filters by search text', async () => {
    await ErrorLog.log({ scriptId: 's1', error: 'TypeError: undefined' });
    await ErrorLog.log({ scriptId: 's1', error: 'SyntaxError: bad token' });
    const results = await ErrorLog.getAll({ search: 'syntax' });
    expect(results).toHaveLength(1);
    expect(results[0].error).toContain('SyntaxError');
  });

  it('enforces MAX_ENTRIES limit (FIFO)', async () => {
    const origMax = ErrorLog.MAX_ENTRIES;
    ErrorLog.MAX_ENTRIES = 5;
    for (let i = 0; i < 8; i++) {
      await ErrorLog.log({ scriptId: 's1', error: `error ${i}` });
    }
    const all = await ErrorLog.getAll();
    expect(all).toHaveLength(5);
    // Oldest entries (0, 1, 2) should be trimmed
    expect(all[0].error).toBe('error 3');
    ErrorLog.MAX_ENTRIES = origMax;
  });

  it('clear() removes all entries', async () => {
    await ErrorLog.log({ scriptId: 's1', error: 'a' });
    await ErrorLog.clear();
    const all = await ErrorLog.getAll();
    expect(all).toHaveLength(0);
  });

  it('clear(scriptId) removes only that script', async () => {
    await ErrorLog.log({ scriptId: 's1', error: 'a' });
    await ErrorLog.log({ scriptId: 's2', error: 'b' });
    await ErrorLog.clear('s1');
    const all = await ErrorLog.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].scriptId).toBe('s2');
  });

  it('getGrouped() groups identical errors', async () => {
    await ErrorLog.log({ scriptId: 's1', error: 'TypeError' });
    await ErrorLog.log({ scriptId: 's1', error: 'TypeError' });
    await ErrorLog.log({ scriptId: 's1', error: 'RangeError' });
    const groups = await ErrorLog.getGrouped();
    expect(groups).toHaveLength(2);
    const typeGroup = groups.find(g => g.error === 'TypeError');
    expect(typeGroup.count).toBe(2);
  });

  it('exportJSON() returns valid JSON', async () => {
    await ErrorLog.log({ scriptId: 's1', error: 'test' });
    const json = await ErrorLog.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.count).toBe(1);
    expect(parsed.entries).toHaveLength(1);
  });

  it('exportText() returns formatted text', async () => {
    await ErrorLog.log({ scriptId: 's1', scriptName: 'TestScript', error: 'fail', url: 'https://example.com' });
    const text = await ErrorLog.exportText();
    expect(text).toContain('ScriptVault Error Log');
    expect(text).toContain('TestScript');
    expect(text).toContain('fail');
    expect(text).toContain('example.com');
  });
});
