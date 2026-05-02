// ScriptVault - Workspaces
// Named sets of enabled/disabled script states for quick context switching

import type { Script } from '../types/script';
import { generateId } from '../shared/utils';
import { ScriptStorage } from '../modules/storage';
import { registerAllScripts } from '../background/registration';
import { updateBadge } from '../background/badge';

interface Workspace {
  id: string;
  name: string;
  snapshot: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}

interface WorkspacesData {
  active: string | null;
  list: Workspace[];
}

interface WorkspaceUpdates {
  name?: string;
}

export const WorkspaceManager = {
  _cache: null as WorkspacesData | null,

  async _init(): Promise<void> {
    if (this._cache !== null) return;
    const data = await chrome.storage.local.get('workspaces');
    this._cache = (data['workspaces'] as WorkspacesData | undefined) || { active: null, list: [] };
  },

  async _save(): Promise<void> {
    await chrome.storage.local.set({ workspaces: this._cache });
  },

  async getAll(): Promise<{ active: string | null; list: Workspace[] }> {
    await this._init();
    return { active: this._cache!.active, list: this._cache!.list };
  },

  async create(name: string): Promise<Workspace> {
    await this._init();
    // Snapshot current enabled states
    const scripts: Script[] = await ScriptStorage.getAll();
    const snapshot: Record<string, boolean> = {};
    for (const s of scripts) {
      snapshot[s.id] = s.enabled !== false;
    }
    const workspace: Workspace = {
      id: generateId(),
      name,
      snapshot,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this._cache!.list.push(workspace);
    try {
      await this._save();
    } catch (e) {
      this._cache!.list = this._cache!.list.filter(w => w.id !== workspace.id);
      throw e;
    }
    return workspace;
  },

  async update(id: string, updates: WorkspaceUpdates): Promise<Workspace | null> {
    await this._init();
    const ws: Workspace | undefined = this._cache!.list.find(w => w.id === id);
    if (!ws) return null;
    const prev = { name: ws.name, updatedAt: ws.updatedAt };
    if (updates.name !== undefined) ws.name = updates.name;
    ws.updatedAt = Date.now();
    try {
      await this._save();
    } catch (e) {
      ws.name = prev.name;
      ws.updatedAt = prev.updatedAt;
      throw e;
    }
    return ws;
  },

  async save(id: string): Promise<Workspace | null> {
    // Save current state into existing workspace
    await this._init();
    const ws: Workspace | undefined = this._cache!.list.find(w => w.id === id);
    if (!ws) return null;
    const scripts: Script[] = await ScriptStorage.getAll();
    const prev = { snapshot: { ...ws.snapshot }, updatedAt: ws.updatedAt };
    ws.snapshot = {};
    for (const s of scripts) {
      ws.snapshot[s.id] = s.enabled !== false;
    }
    ws.updatedAt = Date.now();
    try {
      await this._save();
    } catch (e) {
      ws.snapshot = prev.snapshot;
      ws.updatedAt = prev.updatedAt;
      throw e;
    }
    return ws;
  },

  async activate(id: string): Promise<{ error: string } | { success: true; name: string }> {
    await this._init();
    const ws: Workspace | undefined = this._cache!.list.find(w => w.id === id);
    if (!ws) return { error: 'Workspace not found' };

    // Apply snapshot — use ScriptStorage.set() per changed script for rollback safety
    const scripts: Script[] = await ScriptStorage.getAll();
    const now: number = Date.now();
    for (const s of scripts) {
      const shouldBeEnabled: boolean | undefined = ws.snapshot[s.id];
      if (shouldBeEnabled !== undefined && (s.enabled !== false) !== shouldBeEnabled) {
        await ScriptStorage.set(s.id, { ...s, enabled: shouldBeEnabled, updatedAt: now });
      }
    }

    const previousActive = this._cache!.active;
    this._cache!.active = id;
    try {
      await this._save();
    } catch (e) {
      this._cache!.active = previousActive;
      throw e;
    }

    // Re-register all scripts
    await registerAllScripts();
    await updateBadge();

    return { success: true, name: ws.name };
  },

  async delete(id: string): Promise<Workspace | null> {
    await this._init();
    const index = this._cache!.list.findIndex(w => w.id === id);
    if (index === -1) return null;
    const removed = this._cache!.list[index] as Workspace;
    this._cache!.list.splice(index, 1);
    const previousActive = this._cache!.active;
    if (this._cache!.active === id) this._cache!.active = null;
    try {
      await this._save();
    } catch (e) {
      this._cache!.list.splice(index, 0, removed);
      this._cache!.active = previousActive;
      throw e;
    }
    return removed;
  }
};
