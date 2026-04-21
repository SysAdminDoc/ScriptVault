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
    await this._save();
    return workspace;
  },

  async update(id, updates) {
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
    if (!ws) return null;
    if (updates.name !== undefined) ws.name = updates.name;
    ws.updatedAt = Date.now();
    await this._save();
    return ws;
  },

  async save(id) {
    // Save current state into existing workspace
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
    if (!ws) return null;
    const scripts = await ScriptStorage.getAll();
    ws.snapshot = {};
    for (const s of scripts) {
      ws.snapshot[s.id] = s.enabled !== false;
    }
    ws.updatedAt = Date.now();
    await this._save();
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

    this._cache.active = id;
    await this._save();

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
    if (this._cache.active === id) this._cache.active = null;
    await this._save();
    return removed;
  }
};
