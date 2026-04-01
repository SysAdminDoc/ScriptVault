// ============================================================================
// Settings Manager
// ============================================================================

function cloneDefaultSettings() {
  if (typeof structuredClone === 'function') {
    return structuredClone(SCRIPTVAULT_SETTINGS_DEFAULTS);
  }
  return JSON.parse(JSON.stringify(SCRIPTVAULT_SETTINGS_DEFAULTS));
}

const SettingsManager = {
  defaults: cloneDefaultSettings(),
  
  cache: null,
  
  async init() {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('settings');
    this.cache = { ...cloneDefaultSettings(), ...data.settings };
    console.log('[ScriptVault] Settings loaded');
  },
  
  async get(key) {
    await this.init();
    return key ? this.cache[key] : { ...this.cache };
  },
  
  async set(key, value) {
    await this.init();
    if (typeof key === 'object') {
      this.cache = { ...this.cache, ...key };
    } else {
      this.cache[key] = value;
    }
    await chrome.storage.local.set({ settings: this.cache });
    return this.cache;
  },
  
  async reset() {
    this.defaults = cloneDefaultSettings();
    this.cache = cloneDefaultSettings();
    await chrome.storage.local.set({ settings: this.cache });
    return this.cache;
  }
};

// Debug logging helper - only logs when debugMode is enabled
function debugLog(...args) {
  if (SettingsManager.cache?.debugMode) {
    console.log('[ScriptVault]', ...args);
  }
}

// ============================================================================
// Script Storage
// ============================================================================

const ScriptStorage = {
  cache: null,
  
  async init() {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('userscripts');
    this.cache = data.userscripts || {};
    console.log('[ScriptVault] Loaded', Object.keys(this.cache).length, 'scripts');
  },
  
  async save() {
    await chrome.storage.local.set({ userscripts: this.cache });
  },
  
  async getAll() {
    await this.init();
    return Object.values(this.cache);
  },
  
  async get(id) {
    await this.init();
    return this.cache[id] || null;
  },
  
  async set(id, script) {
    await this.init();
    const prev = this.cache[id];
    this.cache[id] = script;
    try {
      await this.save();
    } catch (e) {
      // Rollback cache on persist failure (e.g., quota exceeded)
      if (prev !== undefined) this.cache[id] = prev;
      else delete this.cache[id];
      throw e; // Re-throw so callers know the save failed
    }
    return script;
  },

  async delete(id) {
    await this.init();
    const prev = this.cache[id];
    delete this.cache[id];
    try {
      // Also delete associated values
      await ScriptValues.deleteAll(id);
      await this.save();
    } catch (e) {
      // Rollback cache on failure
      if (prev !== undefined) this.cache[id] = prev;
      throw e;
    }
  },
  
  async clear() {
    this.cache = {};
    await this.save();
  },
  
  async search(query) {
    await this.init();
    const q = query.toLowerCase();
    return Object.values(this.cache).filter(s =>
      (s.meta?.name || '').toLowerCase().includes(q) ||
      (s.meta?.description || '').toLowerCase().includes(q) ||
      (s.meta?.author || '').toLowerCase().includes(q)
    );
  },
  
  async getByNamespace(namespace) {
    await this.init();
    return Object.values(this.cache).filter(s => s.meta?.namespace === namespace);
  },
  
  async reorder(orderedIds) {
    await this.init();
    orderedIds.forEach((id, index) => {
      if (this.cache[id]) {
        this.cache[id].position = index;
      }
    });
    await this.save();
  },
  
  async duplicate(id) {
    await this.init();
    const original = this.cache[id];
    if (!original) return null;
    
    const newId = generateId();
    const newScript = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      meta: {
        ...original.meta,
        name: (original.meta?.name || 'Unnamed') + ' (Copy)'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.cache[newId] = newScript;
    await this.save();
    return newScript;
  }
};

// ============================================================================
// Script Values Storage (GM_getValue/setValue)
// ============================================================================

const ScriptValues = {
  cache: {},
  listeners: new Map(),
  pendingNotifications: new Map(), // Debounce notifications only (not saves!)
  
  async init(scriptId) {
    if (this.cache[scriptId]) return;
    const data = await chrome.storage.local.get(`values_${scriptId}`);
    this.cache[scriptId] = data[`values_${scriptId}`] || {};
  },
  
  async get(scriptId, key, defaultValue) {
    await this.init(scriptId);
    const value = this.cache[scriptId][key];
    return value !== undefined ? value : defaultValue;
  },
  
  // FIXED: Save immediately to prevent data loss on service worker termination
  // MV3 service workers can be killed at any time - setTimeout-based debouncing is unsafe
  async set(scriptId, key, value) {
    await this.init(scriptId);
    const oldValue = this.cache[scriptId][key];
    
    // Update cache immediately
    this.cache[scriptId][key] = value;
    
    // Save IMMEDIATELY - don't debounce persistence in MV3!
    // Service workers can be terminated at any time, losing unsaved data
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
    
    // Debounce notifications only (these are less critical)
    this.scheduleNotification(scriptId, key, oldValue, value);
    
    return value;
  },
  
  // Debounced notifications - batches rapid changes (notification loss is acceptable)
  scheduleNotification(scriptId, key, oldValue, newValue) {
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
  
  async delete(scriptId, key) {
    await this.init(scriptId);
    const oldValue = this.cache[scriptId][key];
    delete this.cache[scriptId][key];
    // Save immediately
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
    this.scheduleNotification(scriptId, key, oldValue, undefined);
  },
  
  async list(scriptId) {
    await this.init(scriptId);
    return Object.keys(this.cache[scriptId]);
  },
  
  async getAll(scriptId) {
    await this.init(scriptId);
    return { ...this.cache[scriptId] };
  },
  
  async setAll(scriptId, values) {
    await this.init(scriptId);
    for (const [key, value] of Object.entries(values)) {
      const oldValue = this.cache[scriptId][key];
      this.cache[scriptId][key] = value;
      this.scheduleNotification(scriptId, key, oldValue, value);
    }
    // Save immediately
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
  },
  
  async deleteAll(scriptId) {
    delete this.cache[scriptId];
    await chrome.storage.local.remove(`values_${scriptId}`);
  },
  
  // Delete multiple specific keys at once
  async deleteMultiple(scriptId, keys) {
    await this.init(scriptId);
    for (const key of keys) {
      const oldValue = this.cache[scriptId][key];
      delete this.cache[scriptId][key];
      this.scheduleNotification(scriptId, key, oldValue, undefined);
    }
    // Save immediately
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
  },
  
  async getStorageSize(scriptId) {
    await this.init(scriptId);
    return JSON.stringify(this.cache[scriptId] || {}).length;
  },
  
  addListener(scriptId, listenerId, callback) {
    const key = `${scriptId}_${listenerId}`;
    this.listeners.set(key, { scriptId, callback });
    return key;
  },
  
  removeListener(key) {
    this.listeners.delete(key);
  },
  
  notifyChange(scriptId, key, oldValue, newValue, remote) {
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
    chrome.tabs.query({ status: 'complete' }).then(tabs => {
      const msg = { action: 'valueChanged', data: { scriptId, key, oldValue, newValue, remote: true } };
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    }).catch(() => {});
  }
};

// ============================================================================
// Tab Storage (GM_getTab/saveTab)
// ============================================================================

const TabStorage = {
  data: new Map(),
  
  get(tabId) {
    return this.data.get(tabId) || {};
  },
  
  set(tabId, data) {
    this.data.set(tabId, data);
  },
  
  delete(tabId) {
    this.data.delete(tabId);
  },
  
  getAll() {
    const result = {};
    this.data.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
};

// Global notification callback tracker (initialized once, used by GM_notification handler)
if (!self._notifCallbacks) self._notifCallbacks = new Map();

// Clean up tab data when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  TabStorage.delete(tabId);
  // Also abort any pending XHR requests for this tab
  XhrManager.abortByTab(tabId);
  // Clean up notification callbacks for this tab
  for (const [notifId, info] of self._notifCallbacks) {
    if (info.tabId === tabId) self._notifCallbacks.delete(notifId);
  }
});

// Notification click/close listeners for GM_notification callbacks
chrome.notifications.onClicked.addListener((notifId) => {
  if (!self._notifCallbacks) return;
  const info = self._notifCallbacks.get(notifId);
  if (!info) return;
  if (info.hasOnclick) {
    chrome.tabs.sendMessage(info.tabId, {
      action: 'notificationEvent',
      data: { notifId, scriptId: info.scriptId, type: 'click' }
    }).catch(() => {});
  }
});

chrome.notifications.onClosed.addListener((notifId, byUser) => {
  if (!self._notifCallbacks) return;
  const info = self._notifCallbacks.get(notifId);
  if (!info) return;
  if (info.hasOndone) {
    chrome.tabs.sendMessage(info.tabId, {
      action: 'notificationEvent',
      data: { notifId, scriptId: info.scriptId, type: 'done' }
    }).catch(() => {});
  }
  self._notifCallbacks.delete(notifId);
});

// ============================================================================
// Folder Storage
// ============================================================================

const FolderStorage = {
  cache: null,

  async init() {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('scriptFolders');
    this.cache = data.scriptFolders || [];
  },

  async save() {
    await chrome.storage.local.set({ scriptFolders: this.cache });
  },

  async getAll() {
    await this.init();
    return this.cache;
  },

  async create(name, color = '#60a5fa') {
    await this.init();
    const folder = { id: generateId(), name, color, collapsed: false, scriptIds: [], createdAt: Date.now() };
    this.cache.push(folder);
    await this.save();
    return folder;
  },

  async update(id, updates) {
    await this.init();
    const folder = this.cache.find(f => f.id === id);
    if (folder) {
      Object.assign(folder, updates);
      await this.save();
    }
    return folder;
  },

  async delete(id) {
    await this.init();
    this.cache = this.cache.filter(f => f.id !== id);
    await this.save();
  },

  async addScript(folderId, scriptId) {
    await this.init();
    const folder = this.cache.find(f => f.id === folderId);
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

  async removeScript(folderId, scriptId) {
    await this.init();
    const folder = this.cache.find(f => f.id === folderId);
    if (folder) {
      const prev = folder.scriptIds;
      folder.scriptIds = prev.filter(id => id !== scriptId);
      try {
        await this.save();
      } catch (e) {
        folder.scriptIds = prev;
        throw e;
      }
    }
  },

  async moveScript(scriptId, fromFolderId, toFolderId) {
    await this.init();
    if (fromFolderId) {
      const from = this.cache.find(f => f.id === fromFolderId);
      if (from) from.scriptIds = from.scriptIds.filter(id => id !== scriptId);
    }
    if (toFolderId) {
      const to = this.cache.find(f => f.id === toFolderId);
      if (to && !to.scriptIds.includes(scriptId)) to.scriptIds.push(scriptId);
    }
    await this.save();
  },

  getFolderForScript(scriptId) {
    if (!this.cache) return null;
    return this.cache.find(f => f.scriptIds.includes(scriptId)) || null;
  }
};

// Shared tracker for GM_openInTab close notifications (avoids per-call listener leak)
const _openTabTrackers = new Map(); // openedTabId -> { callerTabId, scriptId }
chrome.tabs.onRemoved.addListener((closedTabId) => {
  const info = _openTabTrackers.get(closedTabId);
  if (info) {
    _openTabTrackers.delete(closedTabId);
    chrome.tabs.sendMessage(info.callerTabId, {
      action: 'openedTabClosed',
      data: { tabId: closedTabId, scriptId: info.scriptId }
    }).catch(() => {});
  }
});
