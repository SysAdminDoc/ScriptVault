import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const chainsCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-chains.js'), 'utf8');

describe('ScriptChains module', () => {
  let ScriptChains;

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
      runtime: {
        sendMessage: vi.fn((_message, callback) => {
          if (typeof callback === 'function') {
            queueMicrotask(() => callback({ success: true }));
            return undefined;
          }
          return Promise.resolve({ success: true });
        }),
      },
    };
    globalThis.ScriptVaultDashboardUI = { toast: vi.fn() };
    const _body = chainsCode + '\nreturn ScriptChains;';
    try { const vm = require('node:vm'); const _cf = vm.compileFunction(_body, [], { filename: resolve(__dirname, '../pages/dashboard-chains.js') }); ScriptChains = _cf(); } catch { ScriptChains = new Function(_body)(); }
  });

  it('createChain normalizes step delay to 0..10000', async () => {
    const id = await ScriptChains.createChain('Test', [
      { scriptId: 'a', delay: -100 },
      { scriptId: 'b', delay: 99999 },
      { scriptId: 'c', delay: 500 },
    ]);
    expect(id).toBeTruthy();
    const chains = ScriptChains.getChains();
    const chain = chains[id];
    expect(chain.steps[0].delay).toBe(0);
    expect(chain.steps[1].delay).toBe(10000);
    expect(chain.steps[2].delay).toBe(500);
  });

  it('createChain defaults step condition to always', async () => {
    const id = await ScriptChains.createChain('Default', [
      { scriptId: 'x' },
    ]);
    const chains = ScriptChains.getChains();
    expect(chains[id].steps[0].condition).toBe('always');
  });

  it('createChain uses fallback name when none provided', async () => {
    const id = await ScriptChains.createChain('', []);
    const chains = ScriptChains.getChains();
    expect(chains[id].name).toBe('New Chain');
  });

  it('deleteChain refuses to delete builtin chains', async () => {
    const id = await ScriptChains.createChain('Builtin Test', []);
    const chains = ScriptChains.getChains();
    chains[id].builtin = true;
    Object.assign(ScriptChains.getChains(), chains);

    await ScriptChains.deleteChain(id);
    expect(ScriptChains.getChains()[id]).toBeDefined();
  });

  it('deleteChain removes non-builtin chains', async () => {
    const id = await ScriptChains.createChain('Removable', []);
    expect(ScriptChains.getChains()[id]).toBeDefined();
    await ScriptChains.deleteChain(id);
    expect(ScriptChains.getChains()[id]).toBeUndefined();
  });

  it('executeChain returns error for missing chain', async () => {
    const result = await ScriptChains.executeChain('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('executeChain prevents concurrent runs of the same chain', async () => {
    const id = await ScriptChains.createChain('Concurrent', [
      { scriptId: 'slow', delay: 100 },
    ]);

    const first = ScriptChains.executeChain(id);
    const second = await ScriptChains.executeChain(id);
    expect(second.success).toBe(false);
    expect(second.alreadyRunning).toBe(true);
    await first;
  });

  it('getChains returns a shallow copy', async () => {
    await ScriptChains.createChain('Copy Test', []);
    const a = ScriptChains.getChains();
    const b = ScriptChains.getChains();
    expect(a).not.toBe(b);
  });

  it('notifies the background to refresh chain triggers when chains change', async () => {
    const id = await ScriptChains.createChain('Trigger Refresh', []);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'rescheduleChains' });

    await ScriptChains.deleteChain(id);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'rescheduleChains' });
  });

  it('does not append logs to a different open chain editor', async () => {
    const chainA = await ScriptChains.createChain('Chain A', []);
    const chainB = await ScriptChains.createChain('Chain B', []);
    const host = document.createElement('div');
    document.body.appendChild(host);
    await ScriptChains.init(host);

    const chainBCard = host.querySelector(`[data-chain-id="${chainB}"]`);
    const editButton = Array.from(chainBCard?.querySelectorAll('button') || [])
      .find(button => button.textContent === 'Edit');
    editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const chainBLog = document.querySelector(`[data-chain-log="true"][data-chain-id="${chainB}"]`);
    expect(chainBLog).toBeTruthy();

    const result = await ScriptChains.executeChain(chainA);
    expect(result.success).toBe(true);
    expect(chainBLog?.querySelectorAll('.sv-chain-log-entry')).toHaveLength(0);
  });
});
