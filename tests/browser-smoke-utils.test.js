import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeBrowserWithFallback, removeTempProfileDir } from '../scripts/browser-smoke-utils.mjs';

describe('browser smoke utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not kill the browser process after a clean close', async () => {
    const processHandle = { killed: false, kill: vi.fn() };
    const browser = {
      close: vi.fn(async () => {}),
      process: () => processHandle,
    };

    await closeBrowserWithFallback(browser, 'Clean smoke');

    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(processHandle.kill).not.toHaveBeenCalled();
  });

  it('kills the browser process when close rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const processHandle = { killed: false, kill: vi.fn() };
    const browser = {
      close: vi.fn(async () => { throw new Error('profile lock held'); }),
      process: () => processHandle,
    };

    await closeBrowserWithFallback(browser, 'Failing smoke');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failing smoke browser close fallback'));
    expect(processHandle.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('removes temporary profile directories', async () => {
    const profileDir = mkdtempSync(join(tmpdir(), 'scriptvault-smoke-utils-'));
    writeFileSync(join(profileDir, 'lock'), 'temporary');

    await removeTempProfileDir(profileDir, 'Cleanup smoke');

    expect(existsSync(profileDir)).toBe(false);
  });
});
