// ============================================================================
// Storage Module — strict TypeScript migration
// ============================================================================

import type { Script, Settings } from '../types/index';
import { generateId } from '../shared/utils';
import settingsDefaultsData from '../config/settings-defaults.json';

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
}

// Declare the global _notifCallbacks on the service-worker scope
declare const self: typeof globalThis & {
  _notifCallbacks?: Map<string, NotifCallbackInfo>;
};

// ============================================================================
// Settings Manager
// ============================================================================

function cloneDefaultSettings(): Settings {
  if (typeof structuredClone === 'function') {
    return structuredClone(settingsDefaultsData) as Settings;
  }
  return JSON.parse(JSON.stringify(settingsDefaultsData)) as Settings;
}

export const SettingsManager = {
  defaults: cloneDefaultSettings(),

  cache: null as Settings | null,

  async init(): Promise<void> {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('settings');
    this.cache = { ...cloneDefaultSettings(), ...(data['settings'] as Partial<Settings> | undefined) };
    console.log('[ScriptVault] Settings loaded');
  },

  async get<K extends keyof Settings>(key?: K): Promise<K extends undefined ? Settings : Settings[K & keyof Settings]> {
    await this.init();
    const c = this.cache!;
    if (key) {
      return c[key] as any;
    }
    return { ...c } as any;
  },

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

export const ScriptStorage = {
  cache: null as Record<string, Script> | null,

  async init(): Promise<void> {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('userscripts');
    this.cache = (data['userscripts'] as Record<string, Script> | undefined) || {};
    console.log('[ScriptVault] Loaded', Object.keys(this.cache).length, 'scripts');
  },

  async save(): Promise<void> {
    await chrome.storage.local.set({ userscripts: this.cache });
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
    this.cache![id] = script;
    try {
      await this.save();
    } catch (e) {
      // Rollback cache on persist failure (e.g., quota exceeded)
      if (prev !== undefined) this.cache![id] = prev;
      else delete this.cache![id];
      throw e; // Re-throw so callers know the save failed
    }
    return script;
  },

  async delete(id: string): Promise<void> {
    await this.init();
    const prev = this.cache![id];
    delete this.cache![id];
    try {
      // Also delete associated values
      await ScriptValues.deleteAll(id);
      await this.save();
    } catch (e) {
      // Rollback cache on failure
      if (prev !== undefined) this.cache![id] = prev;
      throw e;
    }
  },

  async clear(): Promise<void> {
    this.cache = {};
    await this.save();
  },

  async search(query: string): Promise<Script[]> {
    await this.init();
    const q = query.toLowerCase();
    return Object.values(this.cache!).filter(
      (s) =>
        s.meta.name.toLowerCase().includes(q) ||
        s.meta.description?.toLowerCase().includes(q) ||
        s.meta.author?.toLowerCase().includes(q),
    );
  },

  async getByNamespace(namespace: string): Promise<Script[]> {
    await this.init();
    return Object.values(this.cache!).filter((s) => s.meta.namespace === namespace);
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await this.init();
    orderedIds.forEach((id, index) => {
      const script = this.cache![id];
      if (script) {
        script.position = index;
      }
    });
    await this.save();
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
        name: original.meta.name + ' (Copy)',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.cache![newId] = newScript;
    await this.save();
    return newScript;
  },
};

// ============================================================================
// Script Values Storage (GM_getValue/setValue)
// ============================================================================

export const ScriptValues = {
  cache: {} as Record<string, Record<string, unknown>>,
  listeners: new Map<string, ValueChangeListener>(),
  pendingNotifications: new Map<string, PendingNotification>(), // Debounce notifications only (not saves!)

  async init(scriptId: string): Promise<void> {
    if (this.cache[scriptId]) return;
    const storageKey = `values_${scriptId}`;
    const data = await chrome.storage.local.get(storageKey);
    this.cache[scriptId] = (data[storageKey] as Record<string, unknown> | undefined) || {};
  },

  async get(scriptId: string, key: string, defaultValue: unknown): Promise<unknown> {
    await this.init(scriptId);
    const value = this.cache[scriptId]![key];
    return value !== undefined ? value : defaultValue;
  },

  // FIXED: Save immediately to prevent data loss on service worker termination
  // MV3 service workers can be killed at any time — setTimeout-based debouncing is unsafe
  async set(scriptId: string, key: string, value: unknown): Promise<unknown> {
    await this.init(scriptId);
    const oldValue = this.cache[scriptId]![key];

    // Update cache immediately
    this.cache[scriptId]![key] = value;

    // Save IMMEDIATELY — don't debounce persistence in MV3!
    // Service workers can be terminated at any time, losing unsaved data
    await chrome.storage.local.set({
      [`values_${scriptId}`]: this.cache[scriptId],
    });

    // Debounce notifications only (these are less critical)
    this.scheduleNotification(scriptId, key, oldValue, value);

    return value;
  },

  // Debounced notifications — batches rapid changes (notification loss is acceptable)
  scheduleNotification(scriptId: string, key: string, oldValue: unknown, newValue: unknown): void {
    const notifKey = `${scriptId}_${key}`;
    const existing = this.pendingNotifications.get(notifKey);
    if (existing) {
      clearTimeout(existing.timeout);
      // Keep original oldValue for batched notification
      oldValue = existing.oldValue;
    }

    const timeout = setTimeout(() => {
      this.pendingNotifications.delete(notifKey);
      this.notifyChange(scriptId, key, oldValue, newValue, false);
    }, 100);

    this.pendingNotifications.set(notifKey, { timeout, oldValue });
  },

  async delete(scriptId: string, key: string): Promise<void> {
    await this.init(scriptId);
    const oldValue = this.cache[scriptId]![key];
    delete this.cache[scriptId]![key];
    // Save immediately
    await chrome.storage.local.set({
      [`values_${scriptId}`]: this.cache[scriptId],
    });
    this.scheduleNotification(scriptId, key, oldValue, undefined);
  },

  async list(scriptId: string): Promise<string[]> {
    await this.init(scriptId);
    return Object.keys(this.cache[scriptId]!);
  },

  async getAll(scriptId: string): Promise<Record<string, unknown>> {
    await this.init(scriptId);
    return { ...this.cache[scriptId]! };
  },

  async setAll(scriptId: string, values: Record<string, unknown>): Promise<void> {
    await this.init(scriptId);
    for (const [key, value] of Object.entries(values)) {
      const oldValue = this.cache[scriptId]![key];
      this.cache[scriptId]![key] = value;
      this.scheduleNotification(scriptId, key, oldValue, value);
    }
    // Save immediately
    await chrome.storage.local.set({
      [`values_${scriptId}`]: this.cache[scriptId],
    });
  },

  async deleteAll(scriptId: string): Promise<void> {
    delete this.cache[scriptId];
    await chrome.storage.local.remove(`values_${scriptId}`);
  },

  // Delete multiple specific keys at once
  async deleteMultiple(scriptId: string, keys: string[]): Promise<void> {
    await this.init(scriptId);
    for (const key of keys) {
      const oldValue = this.cache[scriptId]![key];
      delete this.cache[scriptId]![key];
      this.scheduleNotification(scriptId, key, oldValue, undefined);
    }
    // Save immediately
    await chrome.storage.local.set({
      [`values_${scriptId}`]: this.cache[scriptId],
    });
  },

  async getStorageSize(scriptId: string): Promise<number> {
    await this.init(scriptId);
    return JSON.stringify(this.cache[scriptId] || {}).length;
  },

  addListener(scriptId: string, listenerId: string, callback: ValueChangeListener['callback']): string {
    const key = `${scriptId}_${listenerId}`;
    this.listeners.set(key, { scriptId, callback });
    return key;
  },

  removeListener(key: string): void {
    this.listeners.delete(key);
  },

  notifyChange(scriptId: string, key: string, oldValue: unknown, newValue: unknown, remote: boolean): void {
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
        const msg = {
          action: 'valueChanged',
          data: { scriptId, key, oldValue, newValue, remote: true },
        };
        for (const tab of tabs) {
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
    const data = await chrome.storage.local.get('scriptFolders');
    this.cache = (data['scriptFolders'] as Folder[] | undefined) || [];
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
    await this.save();
    return folder;
  },

  async update(id: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    await this.init();
    const folder = this.cache!.find((f) => f.id === id);
    if (folder) {
      Object.assign(folder, updates);
      await this.save();
    }
    return folder;
  },

  async delete(id: string): Promise<void> {
    await this.init();
    this.cache = this.cache!.filter((f) => f.id !== id);
    await this.save();
  },

  async addScript(folderId: string, scriptId: string): Promise<void> {
    await this.init();
    const folder = this.cache!.find((f) => f.id === folderId);
    if (folder && !folder.scriptIds.includes(scriptId)) {
      folder.scriptIds.push(scriptId);
      await this.save();
    }
  },

  async removeScript(folderId: string, scriptId: string): Promise<void> {
    await this.init();
    const folder = this.cache!.find((f) => f.id === folderId);
    if (folder) {
      folder.scriptIds = folder.scriptIds.filter((sid) => sid !== scriptId);
      await this.save();
    }
  },

  async moveScript(scriptId: string, fromFolderId: string, toFolderId: string): Promise<void> {
    await this.init();
    if (fromFolderId) {
      const from = this.cache!.find((f) => f.id === fromFolderId);
      if (from) from.scriptIds = from.scriptIds.filter((sid) => sid !== scriptId);
    }
    if (toFolderId) {
      const to = this.cache!.find((f) => f.id === toFolderId);
      if (to && !to.scriptIds.includes(scriptId)) to.scriptIds.push(scriptId);
    }
    await this.save();
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
