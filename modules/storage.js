// ============================================================================
// Generated from src/modules/storage.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const StorageModule = (() => {
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

  // src/modules/storage.ts
  var storage_exports = {};
  __export(storage_exports, {
    FolderStorage: () => FolderStorage,
    LocalWorkspaceBindings: () => LocalWorkspaceBindings,
    ScriptStorage: () => ScriptStorage,
    ScriptValues: () => ScriptValues,
    SettingsManager: () => SettingsManager,
    TabStorage: () => TabStorage,
    _openTabTrackers: () => _openTabTrackers,
    debugLog: () => debugLog,
    setScriptChangeListener: () => setScriptChangeListener
  });
  module.exports = __toCommonJS(storage_exports);

  // src/shared/utils.ts
  function generateId() {
    return "script_" + crypto.randomUUID();
  }

  // src/config/settings-defaults.json
  var settings_defaults_default = {
    enabled: true,
    showBadge: true,
    badgeColor: "#22c55e",
    theme: "dark",
    layout: "dark",
    notifyOnInstall: true,
    notifyOnUpdate: true,
    notifyOnError: false,
    editorTheme: "material-darker",
    editorFontSize: 13,
    editorTabSize: 2,
    editorLineWrapping: false,
    editorAutoComplete: true,
    editorMatchBrackets: true,
    editorAutoCloseBrackets: true,
    editorHighlightActiveLine: true,
    editorShowInvisibles: false,
    editorKeyMap: "default",
    autoUpdate: true,
    autoUpdateMode: "notify",
    updateInterval: 864e5,
    lastUpdateCheck: 0,
    subscriptionAutoRefresh: true,
    subscriptionRefreshInterval: 24,
    syncEnabled: false,
    syncProvider: "none",
    syncInterval: 36e5,
    lastSync: 0,
    syncEncryptionEnabled: false,
    syncEncryptionPassphrase: "",
    syncEncryptionKdfIterations: 21e4,
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    googleDriveConnected: false,
    googleDriveToken: "",
    googleDriveRefreshToken: "",
    googleClientId: "",
    googleDriveUser: null,
    dropboxToken: "",
    dropboxRefreshToken: "",
    dropboxUser: null,
    dropboxClientId: "",
    onedriveToken: "",
    onedriveRefreshToken: "",
    onedriveClientId: "",
    onedriveConnected: false,
    onedriveUser: null,
    s3Endpoint: "",
    s3Region: "",
    s3Bucket: "",
    s3AccessKeyId: "",
    s3SecretKey: "",
    s3ObjectKey: "",
    language: "auto",
    debugMode: false,
    experimentalESMUserscripts: false,
    experimentalBackgroundScripts: false,
    dashboardVirtualizationThreshold: 500,
    injectIntoFrames: true,
    xhrTimeout: 3e4,
    allowInternalXhr: false,
    allowInternalSyncEndpoints: false,
    allowHighPrivilegeScriptApis: false,
    modifyCSP: "auto",
    blacklist: [],
    badgeInfo: "running",
    autoReload: false,
    pageFilterMode: "blacklist",
    blacklistedPages: "",
    whitelistedPages: "",
    deniedHosts: [],
    trustedSigningKeys: {},
    trashMode: "30"
  };

  // src/storage/idb.ts
  var DB_NAME = "scriptvault";
  var DB_VERSION = 2;
  var Stores = {
    scripts: "scripts",
    values: "values",
    stats: "stats",
    backups: "backups",
    localWorkspaceBindings: "localWorkspaceBindings"
  };
  var _db = null;
  var _opening = null;
  var _dbFactory = null;
  async function openDB(options = {}) {
    if (_db && _dbFactory && typeof indexedDB !== "undefined" && _dbFactory !== indexedDB) {
      try {
        _db.close();
      } catch {
      }
      _db = null;
      _dbFactory = null;
    }
    if (_db) return _db;
    if (_opening) return _opening;
    const name = options.name ?? DB_NAME;
    const version = options.version ?? DB_VERSION;
    _opening = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this context"));
        return;
      }
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        const tx = req.transaction;
        if (!tx) return;
        try {
          options.upgrade?.(db, ev.oldVersion, ev.newVersion ?? version, tx);
        } catch (e) {
          try {
            tx.abort();
          } catch {
          }
          reject(e);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
          }
          if (_db === db) _db = null;
        };
        db.onclose = () => {
          if (_db === db) _db = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
      req.onblocked = () => reject(new Error("IndexedDB open blocked by another connection"));
    });
    try {
      _db = await _opening;
      _dbFactory = typeof indexedDB !== "undefined" ? indexedDB : null;
      return _db;
    } finally {
      _opening = null;
    }
  }
  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
    });
  }
  function txComplete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
    });
  }
  function forEachCursor(source, fn, range, direction) {
    return new Promise((resolve, reject) => {
      const req = source.openCursor(range, direction);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        try {
          const r = fn(cursor.value, cursor.key, cursor.primaryKey);
          if (r && typeof r.then === "function") {
            r.then(() => cursor.continue(), reject);
          } else {
            cursor.continue();
          }
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error ?? new Error("cursor failed"));
    });
  }

  // src/storage/transaction.ts
  async function withTransaction(stores, mode, fn) {
    const db = await openDB();
    const tx = db.transaction(stores, mode);
    let result;
    try {
      result = await fn(tx);
    } catch (e) {
      try {
        tx.abort();
      } catch {
      }
      throw e;
    }
    await txComplete(tx);
    return result;
  }

  // src/storage/script-db.ts
  function setRecordKey(record, key, value) {
    Object.defineProperty(record, String(key), {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function upgradeSchema(db, oldVersion, _newVersion, _tx) {
    if (oldVersion < 1) {
      const scripts = db.createObjectStore(Stores.scripts, { keyPath: "id" });
      scripts.createIndex("by-enabled", "enabled", { unique: false });
      scripts.createIndex("by-position", "position", { unique: false });
      scripts.createIndex("by-namespace", "meta.namespace", { unique: false });
      const values = db.createObjectStore(Stores.values, {
        keyPath: ["scriptId", "key"]
      });
      values.createIndex("by-script", "scriptId", { unique: false });
      db.createObjectStore(Stores.stats, { keyPath: "scriptId" });
      const backups = db.createObjectStore(Stores.backups, { keyPath: "id" });
      backups.createIndex("by-created", "createdAt", { unique: false });
    }
    if (oldVersion < 2 && !db.objectStoreNames.contains(Stores.localWorkspaceBindings)) {
      const bindings = db.createObjectStore(Stores.localWorkspaceBindings, { keyPath: "bindingId" });
      bindings.createIndex("by-script", "scriptId", { unique: false });
    }
  }
  async function openScriptDB() {
    return openDB({ name: DB_NAME, version: DB_VERSION, upgrade: upgradeSchema });
  }
  var ScriptsDAO = {
    async get(id) {
      await openScriptDB();
      return withTransaction(Stores.scripts, "readonly", async (tx) => {
        const row = await reqToPromise(tx.objectStore(Stores.scripts).get(id));
        return row ?? null;
      });
    },
    async getAll() {
      await openScriptDB();
      return withTransaction(Stores.scripts, "readonly", async (tx) => {
        const rows = await reqToPromise(tx.objectStore(Stores.scripts).getAll());
        return rows ?? [];
      });
    },
    async put(script) {
      await openScriptDB();
      await withTransaction(Stores.scripts, "readwrite", async (tx) => {
        await reqToPromise(tx.objectStore(Stores.scripts).put(script));
      });
    },
    async delete(id) {
      await openScriptDB();
      await withTransaction(
        [Stores.scripts, Stores.values, Stores.stats, Stores.localWorkspaceBindings],
        "readwrite",
        async (tx) => {
          await reqToPromise(tx.objectStore(Stores.scripts).delete(id));
          await reqToPromise(tx.objectStore(Stores.stats).delete(id));
          const valuesIdx = tx.objectStore(Stores.values).index("by-script");
          await forEachCursor(valuesIdx, (_v, _k, primaryKey) => {
            tx.objectStore(Stores.values).delete(primaryKey);
          }, IDBKeyRange.only(id));
          const bindingIdx = tx.objectStore(Stores.localWorkspaceBindings).index("by-script");
          await forEachCursor(bindingIdx, (_v, _k, primaryKey) => {
            tx.objectStore(Stores.localWorkspaceBindings).delete(primaryKey);
          }, IDBKeyRange.only(id));
        }
      );
    },
    async clear() {
      await openScriptDB();
      await withTransaction(
        [Stores.scripts, Stores.values, Stores.stats, Stores.localWorkspaceBindings],
        "readwrite",
        async (tx) => {
          await reqToPromise(tx.objectStore(Stores.scripts).clear());
          await reqToPromise(tx.objectStore(Stores.values).clear());
          await reqToPromise(tx.objectStore(Stores.stats).clear());
          await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).clear());
        }
      );
    },
    async count() {
      await openScriptDB();
      return withTransaction(Stores.scripts, "readonly", async (tx) => {
        return reqToPromise(tx.objectStore(Stores.scripts).count());
      });
    },
    // Bulk insert used by the v2→v3 migration. Single transaction so a partial
    // failure leaves the DB empty rather than half-imported.
    async bulkPut(scripts) {
      if (scripts.length === 0) return;
      await openScriptDB();
      await withTransaction(Stores.scripts, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.scripts);
        for (const s of scripts) {
          await reqToPromise(store.put(s));
        }
      });
    }
  };
  var ValuesDAO = {
    async get(scriptId, key) {
      await openScriptDB();
      return withTransaction(Stores.values, "readonly", async (tx) => {
        const row = await reqToPromise(
          tx.objectStore(Stores.values).get([scriptId, key])
        );
        return row ? row.value : void 0;
      });
    },
    async set(scriptId, key, value) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const row = { scriptId, key, value, updatedAt: Date.now() };
        await reqToPromise(tx.objectStore(Stores.values).put(row));
      });
    },
    async delete(scriptId, key) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        await reqToPromise(tx.objectStore(Stores.values).delete([scriptId, key]));
      });
    },
    async getAll(scriptId) {
      await openScriptDB();
      return withTransaction(Stores.values, "readonly", async (tx) => {
        const out = {};
        const idx = tx.objectStore(Stores.values).index("by-script");
        await forEachCursor(idx, (row) => {
          setRecordKey(out, row.key, row.value);
        }, IDBKeyRange.only(scriptId));
        return out;
      });
    },
    async getAllMetadata(scriptId) {
      await openScriptDB();
      return withTransaction(Stores.values, "readonly", async (tx) => {
        let valueCount = 0;
        let lastUpdatedAt = null;
        const idx = tx.objectStore(Stores.values).index("by-script");
        await forEachCursor(idx, (row) => {
          valueCount += 1;
          const updatedAt = Number(row.updatedAt);
          if (Number.isFinite(updatedAt) && updatedAt > 0) {
            lastUpdatedAt = Math.max(lastUpdatedAt ?? 0, updatedAt);
          }
        }, IDBKeyRange.only(scriptId));
        return { valueCount, lastUpdatedAt };
      });
    },
    async getAllKeyMetadata(scriptId) {
      await openScriptDB();
      return withTransaction(Stores.values, "readonly", async (tx) => {
        const out = {};
        const idx = tx.objectStore(Stores.values).index("by-script");
        await forEachCursor(idx, (row) => {
          const updatedAt = Number(row.updatedAt);
          if (Number.isFinite(updatedAt) && updatedAt > 0) {
            setRecordKey(out, row.key, { updatedAt: Math.floor(updatedAt) });
          }
        }, IDBKeyRange.only(scriptId));
        return out;
      });
    },
    async list(scriptId) {
      const all = await this.getAll(scriptId);
      return Object.keys(all);
    },
    async setAll(scriptId, values) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.values);
        const updatedAt = Date.now();
        for (const [key, value] of Object.entries(values)) {
          await reqToPromise(store.put({ scriptId, key, value, updatedAt }));
        }
      });
    },
    async deleteMultiple(scriptId, keys) {
      if (keys.length === 0) return;
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.values);
        for (const key of keys) {
          await reqToPromise(store.delete([scriptId, key]));
        }
      });
    },
    async deleteAll(scriptId) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.values);
        const idx = store.index("by-script");
        await forEachCursor(idx, (_row, _k, primaryKey) => {
          store.delete(primaryKey);
        }, IDBKeyRange.only(scriptId));
      });
    },
    async byteSize(scriptId) {
      const all = await this.getAll(scriptId);
      return new TextEncoder().encode(JSON.stringify(all)).length;
    }
  };
  function summarizeLocalWorkspaceBinding(row) {
    const {
      bindingId,
      scriptId,
      displayName,
      lastKnownSha256,
      lastKnownSize,
      lastKnownModified,
      permissionState,
      createdAt,
      updatedAt,
      lastRefreshAt,
      lastErrorKind,
      lastStatusKind
    } = row;
    return {
      bindingId,
      scriptId,
      displayName,
      lastKnownSha256,
      lastKnownSize,
      lastKnownModified,
      permissionState,
      createdAt,
      updatedAt,
      lastRefreshAt: lastRefreshAt ?? null,
      lastErrorKind,
      lastStatusKind
    };
  }
  var LocalWorkspaceBindingsDAO = {
    async put(record) {
      const now = Date.now();
      const row = {
        ...record,
        displayName: String(record.displayName || "").slice(0, 160),
        createdAt: record.createdAt || now,
        updatedAt: now,
        lastRefreshAt: record.lastRefreshAt ?? null
      };
      await openScriptDB();
      await withTransaction(Stores.localWorkspaceBindings, "readwrite", async (tx) => {
        await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).put(row));
      });
      return summarizeLocalWorkspaceBinding(row);
    },
    async get(bindingId) {
      await openScriptDB();
      return withTransaction(Stores.localWorkspaceBindings, "readonly", async (tx) => {
        const row = await reqToPromise(
          tx.objectStore(Stores.localWorkspaceBindings).get(bindingId)
        );
        return row ? summarizeLocalWorkspaceBinding(row) : null;
      });
    },
    async getHandle(bindingId) {
      await openScriptDB();
      return withTransaction(Stores.localWorkspaceBindings, "readonly", async (tx) => {
        const row = await reqToPromise(
          tx.objectStore(Stores.localWorkspaceBindings).get(bindingId)
        );
        return row?.handle ?? null;
      });
    },
    async getByScript(scriptId) {
      await openScriptDB();
      return withTransaction(Stores.localWorkspaceBindings, "readonly", async (tx) => {
        const out = [];
        const idx = tx.objectStore(Stores.localWorkspaceBindings).index("by-script");
        await forEachCursor(idx, (row) => {
          out.push(summarizeLocalWorkspaceBinding(row));
        }, IDBKeyRange.only(scriptId));
        return out;
      });
    },
    async list() {
      await openScriptDB();
      return withTransaction(Stores.localWorkspaceBindings, "readonly", async (tx) => {
        const rows = await reqToPromise(
          tx.objectStore(Stores.localWorkspaceBindings).getAll()
        );
        return (rows ?? []).map(summarizeLocalWorkspaceBinding);
      });
    },
    async delete(bindingId) {
      await openScriptDB();
      await withTransaction(Stores.localWorkspaceBindings, "readwrite", async (tx) => {
        await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).delete(bindingId));
      });
    },
    async deleteForScript(scriptId) {
      await openScriptDB();
      await withTransaction(Stores.localWorkspaceBindings, "readwrite", async (tx) => {
        const idx = tx.objectStore(Stores.localWorkspaceBindings).index("by-script");
        await forEachCursor(idx, (_row, _k, primaryKey) => {
          tx.objectStore(Stores.localWorkspaceBindings).delete(primaryKey);
        }, IDBKeyRange.only(scriptId));
      });
    },
    async clear() {
      await openScriptDB();
      await withTransaction(Stores.localWorkspaceBindings, "readwrite", async (tx) => {
        await reqToPromise(tx.objectStore(Stores.localWorkspaceBindings).clear());
      });
    }
  };

  // src/storage/migration-v3.ts
  var SCHEMA_KEY = "_storageSchema";
  var SCHEMA_TARGET = 3;
  var LEGACY_USERSCRIPTS_KEY = "userscripts";
  var LEGACY_VALUE_PREFIX = "values_";
  var LEGACY_TOMBSTONE_KEY = "_v2LegacyTombstone";
  var LEGACY_TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  async function getSchemaVersion() {
    const data = await chrome.storage.local.get(SCHEMA_KEY);
    const v = data[SCHEMA_KEY];
    return typeof v === "number" ? v : 0;
  }
  async function setSchemaVersion(version) {
    await chrome.storage.local.set({ [SCHEMA_KEY]: version });
  }
  async function ensureV3Migration() {
    const current = await getSchemaVersion();
    if (current >= SCHEMA_TARGET) {
      await openScriptDB();
      return {
        ranMigration: false,
        scriptsMigrated: 0,
        valuesMigrated: 0,
        schemaVersion: current
      };
    }
    await openScriptDB();
    const counts = await migrateLegacyToIDB();
    await chrome.storage.local.set({
      [LEGACY_TOMBSTONE_KEY]: {
        migratedAt: Date.now(),
        fromSchema: current,
        toSchema: SCHEMA_TARGET,
        scriptsMigrated: counts.scripts,
        valuesMigrated: counts.values
      }
    });
    await setSchemaVersion(SCHEMA_TARGET);
    return {
      ranMigration: true,
      scriptsMigrated: counts.scripts,
      valuesMigrated: counts.values,
      schemaVersion: SCHEMA_TARGET
    };
  }
  async function migrateLegacyToIDB() {
    let scripts = 0;
    let values = 0;
    const scriptsBlob = await chrome.storage.local.get(LEGACY_USERSCRIPTS_KEY);
    const blob = scriptsBlob[LEGACY_USERSCRIPTS_KEY];
    if (blob && typeof blob === "object") {
      const list = Object.values(blob).filter(
        (s) => !!(s && typeof s === "object" && s.id)
      );
      if (list.length > 0) {
        const existing = await ScriptsDAO.getAll();
        const existingIds = new Set(existing.map((s) => s.id));
        const fresh = list.filter((s) => !existingIds.has(s.id));
        if (fresh.length > 0) {
          await ScriptsDAO.bulkPut(fresh);
          scripts = fresh.length;
        }
      }
    }
    const all = await chrome.storage.local.get(void 0);
    const valueKeys = Object.keys(all).filter((k) => k.startsWith(LEGACY_VALUE_PREFIX));
    for (const storageKey of valueKeys) {
      const scriptId = storageKey.slice(LEGACY_VALUE_PREFIX.length);
      const bag = all[storageKey];
      if (!bag || typeof bag !== "object") continue;
      const entries = Object.entries(bag);
      if (entries.length === 0) continue;
      await ValuesDAO.setAll(scriptId, bag);
      values += entries.length;
    }
    return { scripts, values };
  }

  // src/modules/storage.ts
  function makeValueBag(values = {}) {
    const bag = /* @__PURE__ */ Object.create(null);
    for (const [key, value] of Object.entries(values || {})) {
      setValueBagKey(bag, key, value);
    }
    return bag;
  }
  function setValueBagKey(bag, key, value) {
    Object.defineProperty(bag, String(key), {
      value: cloneStoredValue(value),
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function setScriptValueBag(cache, scriptId, bag) {
    Object.defineProperty(cache, String(scriptId), {
      value: bag,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function exportValueBag(values = {}) {
    return Object.fromEntries(Object.entries(values || {}).map(([key, value]) => [key, cloneStoredValue(value)]));
  }
  var _scriptChangeListener = null;
  function setScriptChangeListener(fn) {
    _scriptChangeListener = fn;
  }
  function notifyScriptChange() {
    try {
      _scriptChangeListener?.();
    } catch {
    }
  }
  var _settingsInitPromise = null;
  var _scriptsInitPromise = null;
  var _foldersInitPromise = null;
  function cloneDefaultSettings() {
    if (typeof structuredClone === "function") {
      return structuredClone(settings_defaults_default);
    }
    return JSON.parse(JSON.stringify(settings_defaults_default));
  }
  function cloneSettingsState(settings) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(settings);
      } catch (_) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(settings));
    } catch (_) {
      return { ...settings };
    }
  }
  function cloneSettingsValue(value) {
    return value && typeof value === "object" ? cloneSettingsState(value) : value;
  }
  function cloneStoredValue(value) {
    if (!value || typeof value !== "object") return value;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return Array.isArray(value) ? [...value] : { ...value };
    }
  }
  async function getSettingsValue(key) {
    await SettingsManager.init();
    const cachedSettings = SettingsManager.cache;
    if (key !== void 0) {
      return cloneSettingsValue(cachedSettings[key]);
    }
    return cloneSettingsState(cachedSettings);
  }
  var SettingsManager = {
    defaults: cloneDefaultSettings(),
    cache: null,
    async init() {
      if (this.cache !== null) return;
      if (!_settingsInitPromise) {
        _settingsInitPromise = (async () => {
          const data = await chrome.storage.local.get("settings");
          this.cache = { ...cloneDefaultSettings(), ...data["settings"] };
          console.log("[ScriptVault] Settings loaded");
        })();
      }
      try {
        return await _settingsInitPromise;
      } finally {
        _settingsInitPromise = null;
      }
    },
    get: getSettingsValue,
    async set(key, value) {
      await this.init();
      const previous = cloneSettingsState(this.cache);
      let rawNext;
      if (typeof key === "object") {
        rawNext = { ...this.cache, ...key };
      } else {
        rawNext = { ...this.cache, [key]: value };
      }
      const next = cloneSettingsState(rawNext);
      try {
        await chrome.storage.local.set({ settings: cloneSettingsState(next) });
      } catch (e) {
        this.cache = previous;
        throw e;
      }
      this.cache = next;
      return cloneSettingsState(this.cache);
    },
    async reset() {
      await this.init();
      const previousDefaults = cloneSettingsState(this.defaults);
      const previousCache = cloneSettingsState(this.cache);
      const nextDefaults = cloneDefaultSettings();
      const nextCache = cloneDefaultSettings();
      try {
        await chrome.storage.local.set({ settings: nextCache });
      } catch (e) {
        this.defaults = previousDefaults;
        this.cache = previousCache;
        throw e;
      }
      this.defaults = nextDefaults;
      this.cache = nextCache;
      return cloneSettingsState(this.cache);
    }
  };
  function debugLog(...args) {
    if (SettingsManager.cache?.debugMode) {
      console.log("[ScriptVault]", ...args);
    }
  }
  var ScriptStorage = {
    cache: null,
    async init() {
      if (this.cache !== null) return;
      if (!_scriptsInitPromise) {
        _scriptsInitPromise = (async () => {
          try {
            await ensureV3Migration();
          } catch (e) {
            console.warn("[ScriptVault] v3 migration failed:", e);
          }
          const list = await ScriptsDAO.getAll();
          const next = {};
          for (const s of list) next[s.id] = s;
          this.cache = next;
          console.log("[ScriptVault] Loaded", Object.keys(this.cache).length, "scripts");
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
    async save() {
    },
    async getAll() {
      await this.init();
      return Object.values(this.cache);
    },
    async get(id) {
      await this.init();
      return this.cache[id] ?? null;
    },
    async set(id, script) {
      await this.init();
      const prev = this.cache[id];
      try {
        await ScriptsDAO.put(script);
      } catch (e) {
        throw e;
      }
      this.cache[id] = script;
      void prev;
      notifyScriptChange();
      return script;
    },
    async delete(id) {
      await this.init();
      const prev = this.cache[id];
      if (prev === void 0) return;
      try {
        await ScriptsDAO.delete(id);
      } catch (e) {
        throw e;
      }
      delete this.cache[id];
      delete ScriptValues.cache[id];
      notifyScriptChange();
    },
    async clear() {
      await this.init();
      const prev = this.cache;
      try {
        await ScriptsDAO.clear();
      } catch (e) {
        throw e;
      }
      this.cache = {};
      ScriptValues.cache = /* @__PURE__ */ Object.create(null);
      void prev;
      notifyScriptChange();
    },
    /**
     * Drop the in-memory cache so the next read forces a fresh load from IDB.
     * Call this after any out-of-band IDB write (rare; mostly used by tests
     * and the import-export flow).
     */
    invalidateCache() {
      this.cache = null;
      _scriptsInitPromise = null;
    },
    async search(query) {
      await this.init();
      const q = query.toLowerCase();
      return Object.values(this.cache).filter(
        (s) => (s.meta?.name || "").toLowerCase().includes(q) || (s.meta?.description || "").toLowerCase().includes(q) || (s.meta?.author || "").toLowerCase().includes(q)
      );
    },
    async getByNamespace(namespace) {
      await this.init();
      return Object.values(this.cache).filter((s) => s.meta?.namespace === namespace);
    },
    async reorder(orderedIds) {
      await this.init();
      const updates = [];
      orderedIds.forEach((id, index) => {
        const script = this.cache[id];
        if (script) {
          script.position = index;
          updates.push(script);
        }
      });
      for (const s of updates) {
        await ScriptsDAO.put(s);
      }
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
          name: `${original.meta?.name || "Unnamed"} (Copy)`
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.set(newId, newScript);
      return newScript;
    }
  };
  var LocalWorkspaceBindings = {
    put: LocalWorkspaceBindingsDAO.put.bind(LocalWorkspaceBindingsDAO),
    get: LocalWorkspaceBindingsDAO.get.bind(LocalWorkspaceBindingsDAO),
    getHandle: LocalWorkspaceBindingsDAO.getHandle.bind(LocalWorkspaceBindingsDAO),
    getByScript: LocalWorkspaceBindingsDAO.getByScript.bind(LocalWorkspaceBindingsDAO),
    list: LocalWorkspaceBindingsDAO.list.bind(LocalWorkspaceBindingsDAO),
    delete: LocalWorkspaceBindingsDAO.delete.bind(LocalWorkspaceBindingsDAO),
    deleteForScript: LocalWorkspaceBindingsDAO.deleteForScript.bind(LocalWorkspaceBindingsDAO),
    clear: LocalWorkspaceBindingsDAO.clear.bind(LocalWorkspaceBindingsDAO)
  };
  var ScriptValues = {
    cache: /* @__PURE__ */ Object.create(null),
    listeners: /* @__PURE__ */ new Map(),
    pendingNotifications: /* @__PURE__ */ new Map(),
    // Debounce notifications only (not saves!)
    _initPromises: /* @__PURE__ */ new Map(),
    async init(scriptId) {
      if (Object.hasOwn(this.cache, scriptId)) return;
      const existing = this._initPromises.get(scriptId);
      if (existing) return existing;
      const p = (async () => {
        await ScriptStorage.init();
        setScriptValueBag(this.cache, scriptId, makeValueBag(await ValuesDAO.getAll(scriptId)));
      })();
      this._initPromises.set(scriptId, p);
      try {
        await p;
      } finally {
        this._initPromises.delete(scriptId);
      }
    },
    async get(scriptId, key, defaultValue) {
      await this.init(scriptId);
      const value = this.cache[scriptId][key];
      return value !== void 0 ? cloneStoredValue(value) : defaultValue;
    },
    // FIXED: Save immediately to prevent data loss on service worker termination.
    // MV3 service workers can be killed at any time — setTimeout-based debouncing is unsafe.
    async set(scriptId, key, value, senderTabId = null) {
      await this.init(scriptId);
      const oldValue = this.cache[scriptId][key];
      const nextValue = cloneStoredValue(value);
      try {
        await ValuesDAO.set(scriptId, key, cloneStoredValue(nextValue));
      } catch (e) {
        throw e;
      }
      setValueBagKey(this.cache[scriptId], key, nextValue);
      this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), cloneStoredValue(nextValue), senderTabId);
      return cloneStoredValue(nextValue);
    },
    // Debounced notifications — batches rapid changes (notification loss is acceptable)
    scheduleNotification(scriptId, key, oldValue, newValue, senderTabId = null) {
      const notifKey = `${scriptId}_${key}`;
      const existing = this.pendingNotifications.get(notifKey);
      if (existing) {
        clearTimeout(existing.timeout);
        oldValue = existing.oldValue;
      }
      const timeout = setTimeout(() => {
        this.pendingNotifications.delete(notifKey);
        this.notifyChange(scriptId, key, oldValue, newValue, false, senderTabId);
      }, 100);
      this.pendingNotifications.set(notifKey, { timeout, oldValue, senderTabId });
    },
    async delete(scriptId, key, senderTabId = null) {
      await this.init(scriptId);
      if (!Object.hasOwn(this.cache[scriptId], key)) return;
      const oldValue = this.cache[scriptId][key];
      try {
        await ValuesDAO.delete(scriptId, key);
      } catch (e) {
        throw e;
      }
      delete this.cache[scriptId][key];
      this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), void 0, senderTabId);
    },
    async list(scriptId) {
      await this.init(scriptId);
      return Object.keys(this.cache[scriptId]);
    },
    async getAll(scriptId) {
      await this.init(scriptId);
      return exportValueBag(this.cache[scriptId]);
    },
    async getAllMetadata(scriptId) {
      await this.init(scriptId);
      return ValuesDAO.getAllMetadata(scriptId);
    },
    async getAllKeyMetadata(scriptId) {
      await this.init(scriptId);
      return ValuesDAO.getAllKeyMetadata(scriptId);
    },
    async setAll(scriptId, values, senderTabId = null) {
      await this.init(scriptId);
      const nextValues = exportValueBag(values);
      const changes = [];
      for (const [key, value] of Object.entries(nextValues)) {
        changes.push([key, cloneStoredValue(this.cache[scriptId][key]), cloneStoredValue(value)]);
      }
      try {
        await ValuesDAO.setAll(scriptId, cloneStoredValue(nextValues));
      } catch (e) {
        throw e;
      }
      for (const [key, _o, v] of changes) {
        setValueBagKey(this.cache[scriptId], key, v);
      }
      for (const [key, oldValue, value] of changes) {
        this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), cloneStoredValue(value), senderTabId);
      }
    },
    async deleteAll(scriptId) {
      await this.init(scriptId);
      const hadCache = Object.hasOwn(this.cache, scriptId);
      const prev = hadCache ? this.cache[scriptId] : void 0;
      try {
        await ValuesDAO.deleteAll(scriptId);
      } catch (e) {
        if (hadCache) {
          setScriptValueBag(this.cache, scriptId, prev);
        }
        throw e;
      }
      delete this.cache[scriptId];
    },
    // Delete multiple specific keys at once
    async deleteMultiple(scriptId, keys, senderTabId = null) {
      await this.init(scriptId);
      const changes = [];
      const present = [];
      for (const key of keys) {
        if (!Object.hasOwn(this.cache[scriptId], key)) continue;
        changes.push([key, this.cache[scriptId][key]]);
        present.push(key);
      }
      if (present.length === 0) return;
      try {
        await ValuesDAO.deleteMultiple(scriptId, present);
      } catch (e) {
        throw e;
      }
      for (const key of present) delete this.cache[scriptId][key];
      for (const [key, oldValue] of changes) {
        this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), void 0, senderTabId);
      }
    },
    async getStorageSize(scriptId) {
      await this.init(scriptId);
      return new TextEncoder().encode(JSON.stringify(this.cache[scriptId] || {})).length;
    },
    addListener(scriptId, listenerId, callback) {
      const key = `${scriptId}_${listenerId}`;
      this.listeners.set(key, { scriptId, callback });
      return key;
    },
    removeListener(key) {
      this.listeners.delete(key);
    },
    notifyChange(scriptId, key, oldValue, newValue, remote, senderTabId = null) {
      if (oldValue === newValue) return;
      this.listeners.forEach((listener) => {
        if (listener.scriptId === scriptId) {
          try {
            listener.callback(key, oldValue, newValue, remote);
          } catch (e) {
            console.error("[ScriptVault] Value change listener error:", e);
          }
        }
      });
      chrome.tabs.query({ status: "complete" }).then((tabs) => {
        for (const tab of tabs) {
          const isOriginTab = senderTabId !== null && tab.id === senderTabId;
          const msg = {
            action: "valueChanged",
            data: { scriptId, key, oldValue, newValue, remote: !isOriginTab }
          };
          chrome.tabs.sendMessage(tab.id, msg).catch(() => {
          });
        }
      }).catch(() => {
      });
    }
  };
  var TabStorage = {
    data: /* @__PURE__ */ new Map(),
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
  if (!self._notifCallbacks) self._notifCallbacks = /* @__PURE__ */ new Map();
  chrome.tabs.onRemoved.addListener((tabId) => {
    TabStorage.delete(tabId);
    globalThis.XhrManager?.abortByTab?.(tabId);
    for (const [notifId, info] of self._notifCallbacks) {
      if (info.tabId === tabId) self._notifCallbacks.delete(notifId);
    }
  });
  var FolderStorage = {
    cache: null,
    async init() {
      if (this.cache !== null) return;
      if (!_foldersInitPromise) {
        _foldersInitPromise = (async () => {
          const data = await chrome.storage.local.get("scriptFolders");
          this.cache = data["scriptFolders"] || [];
        })();
      }
      try {
        return await _foldersInitPromise;
      } finally {
        _foldersInitPromise = null;
      }
    },
    async save() {
      await chrome.storage.local.set({ scriptFolders: this.cache });
    },
    async getAll() {
      await this.init();
      return this.cache;
    },
    async create(name, color = "#60a5fa") {
      await this.init();
      const folder = {
        id: generateId(),
        name,
        color,
        collapsed: false,
        scriptIds: [],
        createdAt: Date.now()
      };
      this.cache.push(folder);
      try {
        await this.save();
      } catch (e) {
        this.cache = this.cache.filter((f) => f.id !== folder.id);
        throw e;
      }
      return folder;
    },
    async update(id, updates) {
      await this.init();
      const folder = this.cache.find((f) => f.id === id);
      if (folder) {
        const prev = {};
        for (const key of Object.keys(updates)) {
          prev[key] = folder[key];
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
    async delete(id) {
      await this.init();
      const prev = this.cache;
      this.cache = this.cache.filter((f) => f.id !== id);
      try {
        await this.save();
      } catch (e) {
        this.cache = prev;
        throw e;
      }
    },
    async addScript(folderId, scriptId) {
      await this.init();
      const folder = this.cache.find((f) => f.id === folderId);
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
      const folder = this.cache.find((f) => f.id === folderId);
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
    async moveScript(scriptId, fromFolderId, toFolderId) {
      await this.init();
      const from = fromFolderId ? this.cache.find((f) => f.id === fromFolderId) : void 0;
      const to = toFolderId ? this.cache.find((f) => f.id === toFolderId) : void 0;
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
    getFolderForScript(scriptId) {
      if (!this.cache) return null;
      return this.cache.find((f) => f.scriptIds.includes(scriptId)) || null;
    }
  };
  var _openTabTrackers = /* @__PURE__ */ new Map();
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    const info = _openTabTrackers.get(closedTabId);
    if (info) {
      _openTabTrackers.delete(closedTabId);
      chrome.tabs.sendMessage(info.callerTabId, {
        action: "openedTabClosed",
        data: { tabId: closedTabId, scriptId: info.scriptId }
      }).catch(() => {
      });
    }
  });
  return module.exports.default || module.exports;
})();

const SettingsManager = StorageModule.SettingsManager;
const ScriptStorage = StorageModule.ScriptStorage;
const LocalWorkspaceBindings = StorageModule.LocalWorkspaceBindings;
const ScriptValues = StorageModule.ScriptValues;
const TabStorage = StorageModule.TabStorage;
const FolderStorage = StorageModule.FolderStorage;
const _openTabTrackers = StorageModule._openTabTrackers;
const setScriptChangeListener = StorageModule.setScriptChangeListener;
