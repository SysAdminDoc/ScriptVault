// ScriptVault - Workspaces
// Named sets of enabled/disabled script states for quick context switching

const WorkspaceManager = {
  _cache: null,
  _initPromise: null,

  async _init() {
    if (this._cache !== null) return;
    // Serialize concurrent cold-start callers so a late-resolving get()
    // can't clobber mutations already applied to _cache by an earlier caller.
    if (!this._initPromise) {
      this._initPromise = (async () => {
        const data = await chrome.storage.local.get('workspaces');
        if (this._cache === null) {
          this._cache = data.workspaces || { active: null, list: [] };
        }
      })().catch(e => {
        this._initPromise = null;
        throw e;
      });
    }
    return this._initPromise;
  },

  async _save() {
    await chrome.storage.local.set({ workspaces: this._cache });
  },

  async getAll() {
    await this._init();
    return { active: this._cache.active, list: this._cache.list };
  },

  async create(name) {
    await this._init();
    // Snapshot current enabled states
    const scripts = await ScriptStorage.getAll();
    const snapshot = {};
    for (const s of scripts) {
      snapshot[s.id] = s.enabled !== false;
    }
    const workspace = {
      id: generateId(),
      name,
      snapshot,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this._cache.list.push(workspace);
    try {
      await this._save();
    } catch (e) {
      this._cache.list = this._cache.list.filter(w => w.id !== workspace.id);
      throw e;
    }
    return workspace;
  },

  async update(id, updates) {
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
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

  async save(id) {
    // Save current state into existing workspace
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
    if (!ws) return null;
    const scripts = await ScriptStorage.getAll();
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

  async activate(id) {
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
    if (!ws) return { error: 'Workspace not found' };

    // Apply snapshot — use ScriptStorage.set() for each changed script for rollback safety
    const scripts = await ScriptStorage.getAll();
    const now = Date.now();
    for (const s of scripts) {
      const shouldBeEnabled = ws.snapshot[s.id];
      if (shouldBeEnabled !== undefined && (s.enabled !== false) !== shouldBeEnabled) {
        await ScriptStorage.set(s.id, { ...s, enabled: shouldBeEnabled, updatedAt: now });
      }
    }

    const previousActive = this._cache.active;
    this._cache.active = id;
    try {
      await this._save();
    } catch (e) {
      this._cache.active = previousActive;
      throw e;
    }

    // Re-register all scripts
    await registerAllScripts();
    await updateBadge();

    return { success: true, name: ws.name };
  },

  async delete(id) {
    await this._init();
    const index = this._cache.list.findIndex(w => w.id === id);
    if (index === -1) return null;
    const [removed] = this._cache.list.splice(index, 1);
    const previousActive = this._cache.active;
    if (this._cache.active === id) this._cache.active = null;
    try {
      await this._save();
    } catch (e) {
      this._cache.list.splice(index, 0, removed);
      this._cache.active = previousActive;
      throw e;
    }
    return removed;
  }
};
