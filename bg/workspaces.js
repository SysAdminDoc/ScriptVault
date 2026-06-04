// ============================================================================
// Generated from src/bg/workspaces.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const WorkspaceManager = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/bg/workspaces.ts
  var workspaces_exports = {};
  __export(workspaces_exports, {
    WorkspaceManager: () => WorkspaceManager
  });
  module.exports = __toCommonJS(workspaces_exports);
  var WorkspaceManager = {
    _cache: null,
    _initPromise: null,
    async _init() {
      if (this._cache !== null) return;
      if (!this._initPromise) {
        this._initPromise = (async () => {
          const data = await chrome.storage.local.get("workspaces");
          if (this._cache === null) {
            this._cache = data["workspaces"] || { active: null, list: [] };
          }
        })();
      }
      try {
        return await this._initPromise;
      } finally {
        this._initPromise = null;
      }
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
        this._cache.list = this._cache.list.filter((w) => w.id !== workspace.id);
        throw e;
      }
      return workspace;
    },
    async update(id, updates) {
      await this._init();
      const ws = this._cache.list.find((w) => w.id === id);
      if (!ws) return null;
      const prev = { name: ws.name, updatedAt: ws.updatedAt };
      if (updates.name !== void 0) ws.name = updates.name;
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
      await this._init();
      const ws = this._cache.list.find((w) => w.id === id);
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
      const ws = this._cache.list.find((w) => w.id === id);
      if (!ws) return { error: "Workspace not found" };
      const scripts = await ScriptStorage.getAll();
      const now = Date.now();
      const previousActive = this._cache.active;
      const changedScripts = [];
      try {
        for (const s of scripts) {
          const shouldBeEnabled = ws.snapshot[s.id];
          if (shouldBeEnabled !== void 0 && s.enabled !== false !== shouldBeEnabled) {
            changedScripts.push({ ...s });
            await ScriptStorage.set(s.id, { ...s, enabled: shouldBeEnabled, updatedAt: now });
          }
        }
        this._cache.active = id;
        await this._save();
      } catch (e) {
        this._cache.active = previousActive;
        for (const script of changedScripts.reverse()) {
          try {
            await ScriptStorage.set(script.id, script);
          } catch (rollbackError) {
            console.warn("[ScriptVault] Failed to roll back workspace activation for script:", script.id, rollbackError);
          }
        }
        throw e;
      }
      await registerAllScripts();
      await updateBadge();
      return { success: true, name: ws.name };
    },
    async delete(id) {
      await this._init();
      const index = this._cache.list.findIndex((w) => w.id === id);
      if (index === -1) return null;
      const removed = this._cache.list[index];
      this._cache.list.splice(index, 1);
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
  return module.exports.default || module.exports.WorkspaceManager || module.exports;
})();
