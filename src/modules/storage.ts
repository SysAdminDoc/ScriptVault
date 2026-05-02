// ============================================================================
// Storage Module — strict TypeScript migration
// ============================================================================

import type { Script, Settings } from '../types/index';
import { generateId } from '../shared/utils';
import settingsDefaultsData from '../config/settings-defaults.json';
import { ScriptsDAO, ValuesDAO } from '../storage/script-db';
import { ensureV3Migration } from '../storage/migration-v3';

// ============================================================================
// Folder type (local — no shared definition yet)
// ============================================================================

export interface Folder {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  scriptIds: string[];
  createdAt: number;
}

// ============================================================================
// Notification callback info tracked on the ServiceWorkerGlobalScope
// ============================================================================

interface NotifCallbackInfo {
  tabId: number;
  scriptId: string;
  hasOnclick: boolean;
  hasOndone: boolean;
}

interface OpenTabTrackerInfo {
  callerTabId: number;
  scriptId: string;
}

// Value-change listener entry
interface ValueChangeListener {
  scriptId: string;
  callback: (key: string, oldValue: unknown, newValue: unknown, remote: boolean) => void;
}

// Pending notification entry (debounce)
interface PendingNotification {
  timeout: ReturnType<typeof setTimeout>;
  oldValue: unknown;
  senderTabId?: number | null;
}

// Declare the global _notifCallbacks on the service-worker scope
declare const self: typeof globalThis & {
  _notifCallbacks?: Map<string, NotifCallbackInfo>;
};

// ============================================================================
// Script-change notifier (used by background.core.js to invalidate the
// MatchSet cache after writes). Pluggable so the storage module stays
// independent of the specific consumer.
// ============================================================================

let _scriptChangeListener: (() => void) | null = null;

export function setScriptChangeListener(fn: (() => void) | null): void {
  _scriptChangeListener = fn;
}

function notifyScriptChange(): void {
  try {
    _scriptChangeListener?.();
  } catch {
    // Swallow — listener errors must not break storage writes.
  }
}

// ============================================================================
// Settings Manager
// ============================================================================

// Pending init promise — ensures concurrent callers share one storage read
let _settingsInitPromise: Promise<void> | null = null;
// Pending init promise for ScriptStorage
let _scriptsInitPromise: Promise<void> | null = null;
// Pending init promise for FolderStorage
let _foldersInitPromise: Promise<void> | null = null;

function cloneDefaultSettings(): Settings {
  if (typeof structuredClone === 'function') {
    return structuredClone(settingsDefaultsData) as Settings;
  }
  return JSON.parse(JSON.stringify(settingsDefaultsData)) as Settings;
}

async function getSettingsValue<K extends keyof Settings>(key: K): Promise<Settings[K]>;
async function getSettingsValue(): Promise<Settings>;
async function getSettingsValue<K extends keyof Settings>(key?: K): Promise<Settings | Settings[K]> {
  await SettingsManager.init();
  const cachedSettings = SettingsManager.cache!;
  if (key !== undefined) {
    return cachedSettings[key];
  }
  return { ...cachedSettings };
}

export const SettingsManager = {
  defaults: cloneDefaultSettings(),

  cache: null as Settings | null,

  async init(): Promise<void> {
    if (this.cache !== null) return;
    if (!_settingsInitPromise) {
      _settingsInitPromise = (async () => {
        const data = await chrome.storage.local.get('settings');
        this.cache = { ...cloneDefaultSettings(), ...(data['settings'] as Partial<Settings> | undefined) };
        console.log('[ScriptVault] Settings loaded');
      })();
    }
    try {
      return await _settingsInitPromise;
    } finally {
      _settingsInitPromise = null;
    }
  },

  get: getSettingsValue,

  async set(key: keyof Settings | Partial<Settings>, value?: Settings[keyof Settings]): Promise<Settings> {
    await this.init();
    if (typeof key === 'object') {
      this.cache = { ...this.cache!, ...key };
    } else {
      (this.cache as any)![key] = value;
    }
    await chrome.storage.local.set({ settings: this.cache });
    return this.cache!;
  },

  async reset(): Promise<Settings> {
    this.defaults = cloneDefaultSettings();
    this.cache = cloneDefaultSettings();
    await chrome.storage.local.set({ settings: this.cache });
    return this.cache;
  },
};

// Debug logging helper — only logs when debugMode is enabled
export function debugLog(...args: unknown[]): void {
  if (SettingsManager.cache?.debugMode) {
    console.log('[ScriptVault]', ...args);
  }
}

// ============================================================================
// Script Storage
// ============================================================================

// ScriptStorage — IndexedDB-backed (v3.0). The in-memory `cache` is a mirror
// of the IDB `scripts` store, populated lazily on init and kept in sync on
// every write. Reads serve from cache for synchronous-ish semantics; writes
// commit to IDB first, then update cache. Persist failures roll back cache.
export const ScriptStorage = {
  cache: null as Record<string, Script> | null,

  async init(): Promise<void> {
    if (this.cache !== null) return;
    if (!_scriptsInitPromise) {
      _scriptsInitPromise = (async () => {
        // Run the v2→v3 migration the first time the SW touches storage.
        // Idempotent — cheap no-op once schema is at v3.
        try {
          await ensureV3Migration();
        } catch (e) {
          console.warn('[ScriptVault] v3 migration failed:', e);
        }
        const list = await ScriptsDAO.getAll();
        const next: Record<string, Script> = {};
        for (const s of list) next[s.id] = s;
        this.cache = next;
        console.log('[ScriptVault] Loaded', Object.keys(this.cache).length, 'scripts');
      })();
    }
    try {
      return await _scriptsInitPromise;
    } finally {
      _scriptsInitPromise = null;
    }
  },

  // Legacy hook retained as a no-op so callers that still invoke save()
  // don't error; persistence happens inline on every write.
  async save(): Promise<void> {
    /* no-op: IDB writes commit per-record in set()/delete()/clear()/reorder() */
  },

  async getAll(): Promise<Script[]> {
    await this.init();
    return Object.values(this.cache!);
  },

  async get(id: string): Promise<Script | null> {
    await this.init();
    return this.cache![id] ?? null;
  },

  async set(id: string, script: Script): Promise<Script> {
    await this.init();
    const prev = this.cache![id];
    try {
      await ScriptsDAO.put(script);
    } catch (e) {
      // Cache untouched on IDB failure — rethrow so callers know.
      throw e;
    }
    this.cache![id] = script;
    void prev; // explicit no-op to keep diff readable; cache now matches IDB
    notifyScriptChange();
    return script;
  },

  async delete(id: string): Promise<void> {
    await this.init();
    const prev = this.cache![id];
    if (prev === undefined) return;
    try {
      // ScriptsDAO.delete() runs script + values + stats removal in one IDB
      // transaction, so a SW kill mid-delete leaves no orphans.
      await ScriptsDAO.delete(id);
    } catch (e) {
      throw e;
    }
    delete this.cache![id];
    // Mirror the deletion into the in-memory ScriptValues cache too.
    delete ScriptValues.cache[id];
    notifyScriptChange();
  },

  async clear(): Promise<void> {
    await this.init();
    const prev = this.cache;
    try {
      await ScriptsDAO.clear();
    } catch (e) {
      throw e;
    }
    this.cache = {};
    ScriptValues.cache = {};
    void prev;
    notifyScriptChange();
  },

  /**
   * Drop the in-memory cache so the next read forces a fresh load from IDB.
   * Call this after any out-of-band IDB write (rare; mostly used by tests
   * and the import-export flow).
   */
  invalidateCache(): void {
    this.cache = null;
    _scriptsInitPromise = null;
  },

  async search(query: string): Promise<Script[]> {
    await this.init();
    const q = query.toLowerCase();
    return Object.values(this.cache!).filter(
      (s) =>
        (s.meta?.name || '').toLowerCase().includes(q) ||
        (s.meta?.description || '').toLowerCase().includes(q) ||
        (s.meta?.author || '').toLowerCase().includes(q),
    );
  },

  async getByNamespace(namespace: string): Promise<Script[]> {
    await this.init();
    return Object.values(this.cache!).filter((s) => s.meta?.namespace === namespace);
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await this.init();
    // Build the updated list, then write per-record (each in its own IDB txn).
    // We tolerate partial failure: any record that persists stays persisted,
    // and the cache reflects what actually shipped.
    const updates: Script[] = [];
    orderedIds.forEach((id, index) => {
      const script = this.cache![id];
      if (script) {
        script.position = index;
        updates.push(script);
      }
    });
    for (const s of updates) {
      await ScriptsDAO.put(s);
    }
  },

  async duplicate(id: string): Promise<Script | null> {
    await this.init();
    const original = this.cache![id];
    if (!original) return null;

    const newId = generateId();
    const newScript: Script = {
      ...(JSON.parse(JSON.stringify(original)) as Script),
      id: newId,
      meta: {
        ...original.meta,
        name: `${original.meta?.name || 'Unnamed'} (Copy)`,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.set(newId, newScript);
    return newScript;
  },
};

// ============================================================================
// Script Values Storage (GM_getValue/setValue)
// ============================================================================

// ScriptValues — IndexedDB-backed (v3.0). The per-script in-memory cache is a
// mirror of the IDB `values` store. Reads serve from cache after init; writes
// commit to IDB first, then update cache so a persist failure leaves no
// in-memory drift.
export const ScriptValues = {
  cache: {} as Record<string, Record<string, unknown>>,
  listeners: new Map<string, ValueChangeListener>(),
  pendingNotifications: new Map<string, PendingNotification>(), // Debounce notifications only (not saves!)
  _initPromises: new Map<string, Promise<void>>(),

  async init(scriptId: string): Promise<void> {
    if (this.cache[scriptId]) return;
    const existing = this._initPromises.get(scriptId);
    if (existing) return existing;
    const p = (async () => {
      // ScriptStorage.init() runs the v2→v3 migration. We chain it here so
      // pure-values-only call paths still trigger the migration on cold boot.
      await ScriptStorage.init();
      this.cache[scriptId] = await ValuesDAO.getAll(scriptId);
    })();
    this._initPromises.set(scriptId, p);
    try {
      await p;
    } finally {
      this._initPromises.delete(scriptId);
    }
  },

  async get(scriptId: string, key: string, defaultValue: unknown): Promise<unknown> {
    await this.init(scriptId);
    const value = this.cache[scriptId]![key];
    return value !== undefined ? value : defaultValue;
  },

  // FIXED: Save immediately to prevent data loss on service worker termination.
  // MV3 service workers can be killed at any time — setTimeout-based debouncing is unsafe.
  async set(scriptId: string, key: string, value: unknown, senderTabId: number | null = null): Promise<unknown> {
    await this.init(scriptId);
    const oldValue = this.cache[scriptId]![key];

    // Persist BEFORE mutating cache so a quota error leaves no drift.
    try {
      await ValuesDAO.set(scriptId, key, value);
    } catch (e) {
      throw e;
    }
    this.cache[scriptId]![key] = value;

    // Debounce notifications only (these are less critical)
    this.scheduleNotification(scriptId, key, oldValue, value, senderTabId);

    return value;
  },

  // Debounced notifications — batches rapid changes (notification loss is acceptable)
  scheduleNotification(
    scriptId: string,
    key: string,
    oldValue: unknown,
    newValue: unknown,
    senderTabId: number | null = null,
  ): void {
    const notifKey = `${scriptId}_${key}`;
    const existing = this.pendingNotifications.get(notifKey);
    if (existing) {
      clearTimeout(existing.timeout);
      // Keep original oldValue for batched notification
      oldValue = existing.oldValue;
    }

    const timeout = setTimeout(() => {
      this.pendingNotifications.delete(notifKey);
      this.notifyChange(scriptId, key, oldValue, newValue, false, senderTabId);
    }, 100);

    this.pendingNotifications.set(notifKey, { timeout, oldValue, senderTabId });
  },

  async delete(scriptId: string, key: string, senderTabId: number | null = null): Promise<void> {
    await this.init(scriptId);
    if (!Object.hasOwn(this.cache[scriptId]!, key)) return;
    const oldValue = this.cache[scriptId]![key];
    try {
      await ValuesDAO.delete(scriptId, key);
    } catch (e) {
      throw e;
    }
    delete this.cache[scriptId]![key];
    this.scheduleNotification(scriptId, key, oldValue, undefined, senderTabId);
  },

  async list(scriptId: string): Promise<string[]> {
    await this.init(scriptId);
    return Object.keys(this.cache[scriptId]!);
  },

  async getAll(scriptId: string): Promise<Record<string, unknown>> {
    await this.init(scriptId);
    return { ...this.cache[scriptId]! };
  },

  async setAll(scriptId: string, values: Record<string, unknown>, senderTabId: number | null = null): Promise<void> {
    await this.init(scriptId);
    const changes: Array<[string, unknown, unknown]> = [];
    for (const [key, value] of Object.entries(values)) {
      changes.push([key, this.cache[scriptId]![key], value]);
    }
    try {
      // setAll runs every put in a single IDB transaction — atomic on commit.
      await ValuesDAO.setAll(scriptId, values);
    } catch (e) {
      throw e;
    }
    for (const [key, _o, v] of changes) {
      this.cache[scriptId]![key] = v;
    }
    for (const [key, oldValue, value] of changes) {
      this.scheduleNotification(scriptId, key, oldValue, value, senderTabId);
    }
  },

  async deleteAll(scriptId: string): Promise<void> {
    delete this.cache[scriptId];
    await ValuesDAO.deleteAll(scriptId);
  },

  // Delete multiple specific keys at once
  async deleteMultiple(scriptId: string, keys: string[], senderTabId: number | null = null): Promise<void> {
    await this.init(scriptId);
    const changes: Array<[string, unknown]> = [];
    const present: string[] = [];
    for (const key of keys) {
      if (!Object.hasOwn(this.cache[scriptId]!, key)) continue;
      changes.push([key, this.cache[scriptId]![key]]);
      present.push(key);
    }
    if (present.length === 0) return;
    try {
      await ValuesDAO.deleteMultiple(scriptId, present);
    } catch (e) {
      throw e;
    }
    for (const key of present) delete this.cache[scriptId]![key];
    for (const [key, oldValue] of changes) {
      this.scheduleNotification(scriptId, key, oldValue, undefined, senderTabId);
    }
  },

  async getStorageSize(scriptId: string): Promise<number> {
    await this.init(scriptId);
    // TextEncoder produces accurate UTF-8 byte counts (vs JS string .length
    // which counts UTF-16 code units).
    return new TextEncoder().encode(JSON.stringify(this.cache[scriptId] || {})).length;
  },

  addListener(scriptId: string, listenerId: string, callback: ValueChangeListener['callback']): string {
    const key = `${scriptId}_${listenerId}`;
    this.listeners.set(key, { scriptId, callback });
    return key;
  },

  removeListener(key: string): void {
    this.listeners.delete(key);
  },

  notifyChange(
    scriptId: string,
    key: string,
    oldValue: unknown,
    newValue: unknown,
    remote: boolean,
    senderTabId: number | null = null,
  ): void {
    // Skip if value didn't actually change
    if (oldValue === newValue) return;

    // Notify local listeners
    this.listeners.forEach((listener) => {
      if (listener.scriptId === scriptId) {
        try {
          listener.callback(key, oldValue, newValue, remote);
        } catch (e) {
          console.error('[ScriptVault] Value change listener error:', e);
        }
      }
    });

    // Broadcast value change to all loaded tabs
    chrome.tabs
      .query({ status: 'complete' })
      .then((tabs) => {
        for (const tab of tabs) {
          const isOriginTab = senderTabId !== null && tab.id === senderTabId;
          const msg = {
            action: 'valueChanged',
            data: { scriptId, key, oldValue, newValue, remote: !isOriginTab },
          };
          chrome.tabs.sendMessage(tab.id!, msg).catch(() => {});
        }
      })
      .catch(() => {});
  },
};

// ============================================================================
// Tab Storage (GM_getTab/saveTab)
// ============================================================================

export const TabStorage = {
  data: new Map<number, Record<string, unknown>>(),

  get(tabId: number): Record<string, unknown> {
    return this.data.get(tabId) || {};
  },

  set(tabId: number, data: Record<string, unknown>): void {
    this.data.set(tabId, data);
  },

  delete(tabId: number): void {
    this.data.delete(tabId);
  },

  getAll(): Record<number, Record<string, unknown>> {
    const result: Record<number, Record<string, unknown>> = {};
    this.data.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  },
};

// Global notification callback tracker (initialized once, used by GM_notification handler)
if (!self._notifCallbacks) self._notifCallbacks = new Map<string, NotifCallbackInfo>();

// Clean up tab data when tab closes
chrome.tabs.onRemoved.addListener((tabId: number) => {
  TabStorage.delete(tabId);
  // Also abort any pending XHR requests for this tab
  // XhrManager is expected to be available at runtime in the background context
  (globalThis as any).XhrManager?.abortByTab?.(tabId);
  // Clean up notification callbacks for this tab
  for (const [notifId, info] of self._notifCallbacks!) {
    if (info.tabId === tabId) self._notifCallbacks!.delete(notifId);
  }
});

// Notification click/close listeners for GM_notification callbacks
chrome.notifications.onClicked.addListener((notifId: string) => {
  if (!self._notifCallbacks) return;
  const info = self._notifCallbacks.get(notifId);
  if (!info) return;
  if (info.hasOnclick) {
    chrome.tabs
      .sendMessage(info.tabId, {
        action: 'notificationEvent',
        data: { notifId, scriptId: info.scriptId, type: 'click' },
      })
      .catch(() => {});
  }
});

chrome.notifications.onClosed.addListener((notifId: string, _byUser: boolean) => {
  if (!self._notifCallbacks) return;
  const info = self._notifCallbacks.get(notifId);
  if (!info) return;
  if (info.hasOndone) {
    chrome.tabs
      .sendMessage(info.tabId, {
        action: 'notificationEvent',
        data: { notifId, scriptId: info.scriptId, type: 'done' },
      })
      .catch(() => {});
  }
  self._notifCallbacks.delete(notifId);
});

// ============================================================================
// Folder Storage
// ============================================================================

export const FolderStorage = {
  cache: null as Folder[] | null,

  async init(): Promise<void> {
    if (this.cache !== null) return;
    if (!_foldersInitPromise) {
      _foldersInitPromise = (async () => {
        const data = await chrome.storage.local.get('scriptFolders');
        this.cache = (data['scriptFolders'] as Folder[] | undefined) || [];
      })();
    }
    try {
      return await _foldersInitPromise;
    } finally {
      _foldersInitPromise = null;
    }
  },

  async save(): Promise<void> {
    await chrome.storage.local.set({ scriptFolders: this.cache });
  },

  async getAll(): Promise<Folder[]> {
    await this.init();
    return this.cache!;
  },

  async create(name: string, color: string = '#60a5fa'): Promise<Folder> {
    await this.init();
    const folder: Folder = {
      id: generateId(),
      name,
      color,
      collapsed: false,
      scriptIds: [],
      createdAt: Date.now(),
    };
    this.cache!.push(folder);
    try {
      await this.save();
    } catch (e) {
      this.cache = this.cache!.filter((f) => f.id !== folder.id);
      throw e;
    }
    return folder;
  },

  async update(id: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    await this.init();
    const folder = this.cache!.find((f) => f.id === id);
    if (folder) {
      const prev: Partial<Folder> = {};
      for (const key of Object.keys(updates) as Array<keyof Folder>) {
        prev[key] = folder[key] as never;
      }
      Object.assign(folder, updates);
      try {
        await this.save();
      } catch (e) {
        Object.assign(folder, prev);
        throw e;
      }
    }
    return folder;
  },

  async delete(id: string): Promise<void> {
    await this.init();
    const prev = this.cache;
    this.cache = this.cache!.filter((f) => f.id !== id);
    try {
      await this.save();
    } catch (e) {
      this.cache = prev;
      throw e;
    }
  },

  async addScript(folderId: string, scriptId: string): Promise<void> {
    await this.init();
    const folder = this.cache!.find((f) => f.id === folderId);
    if (folder && !folder.scriptIds.includes(scriptId)) {
      folder.scriptIds.push(scriptId);
      try {
        await this.save();
      } catch (e) {
        folder.scriptIds.pop();
        throw e;
      }
    }
  },

  async removeScript(folderId: string, scriptId: string): Promise<void> {
    await this.init();
    const folder = this.cache!.find((f) => f.id === folderId);
    if (folder) {
      const prev = folder.scriptIds;
      folder.scriptIds = folder.scriptIds.filter((sid) => sid !== scriptId);
      try {
        await this.save();
      } catch (e) {
        folder.scriptIds = prev;
        throw e;
      }
    }
  },

  async moveScript(scriptId: string, fromFolderId: string, toFolderId: string): Promise<void> {
    await this.init();
    const from = fromFolderId ? this.cache!.find((f) => f.id === fromFolderId) : undefined;
    const to = toFolderId ? this.cache!.find((f) => f.id === toFolderId) : undefined;
    const prevFrom = from ? [...from.scriptIds] : null;
    const prevTo = to ? [...to.scriptIds] : null;
    if (from) from.scriptIds = from.scriptIds.filter((sid) => sid !== scriptId);
    if (to && !to.scriptIds.includes(scriptId)) to.scriptIds.push(scriptId);
    try {
      await this.save();
    } catch (e) {
      if (from && prevFrom) from.scriptIds = prevFrom;
      if (to && prevTo) to.scriptIds = prevTo;
      throw e;
    }
  },

  getFolderForScript(scriptId: string): Folder | null {
    if (!this.cache) return null;
    return this.cache.find((f) => f.scriptIds.includes(scriptId)) || null;
  },
};

// Shared tracker for GM_openInTab close notifications (avoids per-call listener leak)
export const _openTabTrackers = new Map<number, OpenTabTrackerInfo>(); // openedTabId -> { callerTabId, scriptId }
chrome.tabs.onRemoved.addListener((closedTabId: number) => {
  const info = _openTabTrackers.get(closedTabId);
  if (info) {
    _openTabTrackers.delete(closedTabId);
    chrome.tabs
      .sendMessage(info.callerTabId, {
        action: 'openedTabClosed',
        data: { tabId: closedTabId, scriptId: info.scriptId },
      })
      .catch(() => {});
  }
});
