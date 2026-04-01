import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(__dirname, '../bg/workspaces.js'), 'utf8');

let WorkspaceManager;
const preamble = `
  function generateId() { return 'ws_' + Math.random().toString(36).slice(2, 10); }
  const ScriptStorage = {
    cache: {},
    async getAll() { return Object.values(this.cache); },
    async set(id, data) { this.cache[id] = data; },
    async save() {}
  };
  async function registerAllScripts() {}
  async function updateBadge() {}
`;

function createFresh() {
  const fn = new Function('chrome', 'console',
    preamble + code + '\nreturn { WorkspaceManager, ScriptStorage };'
  );
  return fn(globalThis.chrome, console);
}

let mods;

beforeEach(() => {
  globalThis.__resetStorageMock();
  mods = createFresh();
  WorkspaceManager = mods.WorkspaceManager;
  vi.clearAllMocks();
});

describe('WorkspaceManager', () => {
  it('getAll returns empty list initially', async () => {
    const result = await WorkspaceManager.getAll();
    expect(result.active).toBeNull();
    expect(result.list).toEqual([]);
  });

  it('create() snapshots script states', async () => {
    mods.ScriptStorage.cache = {
      s1: { id: 's1', enabled: true },
      s2: { id: 's2', enabled: false },
    };
    const ws = await WorkspaceManager.create('Dev Mode');
    expect(ws.name).toBe('Dev Mode');
    expect(ws.id).toBeTruthy();
    expect(ws.snapshot.s1).toBe(true);
    expect(ws.snapshot.s2).toBe(false);
  });

  it('getAll returns created workspaces', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    await WorkspaceManager.create('WS1');
    await WorkspaceManager.create('WS2');
    const { list } = await WorkspaceManager.getAll();
    expect(list).toHaveLength(2);
  });

  it('delete removes workspace', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('ToDelete');
    const deleted = await WorkspaceManager.delete(ws.id);
    expect(deleted.name).toBe('ToDelete');
    const { list } = await WorkspaceManager.getAll();
    expect(list).toHaveLength(0);
  });

  it('delete returns null for missing workspace', async () => {
    const result = await WorkspaceManager.delete('nonexistent');
    expect(result).toBeNull();
  });

  it('update renames workspace', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('OldName');
    const updated = await WorkspaceManager.update(ws.id, { name: 'NewName' });
    expect(updated.name).toBe('NewName');
  });

  it('update returns null for missing workspace', async () => {
    const result = await WorkspaceManager.update('nonexistent', { name: 'X' });
    expect(result).toBeNull();
  });

  it('activate applies snapshot to scripts', async () => {
    mods.ScriptStorage.cache = {
      s1: { id: 's1', enabled: true },
      s2: { id: 's2', enabled: true },
    };
    const ws = await WorkspaceManager.create('Minimal');
    // Manually modify snapshot to disable s2
    ws.snapshot.s2 = false;
    await WorkspaceManager.activate(ws.id);
    expect(mods.ScriptStorage.cache.s2.enabled).toBe(false);
  });

  it('activate sets active workspace id', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('Active');
    await WorkspaceManager.activate(ws.id);
    const { active } = await WorkspaceManager.getAll();
    expect(active).toBe(ws.id);
  });

  it('activate returns error for missing workspace', async () => {
    const result = await WorkspaceManager.activate('nonexistent');
    expect(result.error).toContain('not found');
  });

  it('delete clears active if deleted', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('WS');
    await WorkspaceManager.activate(ws.id);
    await WorkspaceManager.delete(ws.id);
    const { active } = await WorkspaceManager.getAll();
    expect(active).toBeNull();
  });

  it('save updates existing workspace snapshot', async () => {
    mods.ScriptStorage.cache = { s1: { id: 's1', enabled: true } };
    const ws = await WorkspaceManager.create('WS');
    // Change script state
    mods.ScriptStorage.cache.s1.enabled = false;
    const saved = await WorkspaceManager.save(ws.id);
    expect(saved.snapshot.s1).toBe(false);
  });
});
