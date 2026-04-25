// ScriptVault — Public Extension API
// Allows other extensions and web pages to interact with ScriptVault.
// Designed for service worker (no DOM dependencies).

import { ScriptStorage } from './storage';

/* ------------------------------------------------------------------ */
/*  Local Types                                                        */
/* ------------------------------------------------------------------ */

/** Permission level for an API action. */
type PermissionLevel = 'allow' | 'deny' | 'prompt';

/** A flat (legacy) script record as stored by the public API path. */
interface FlatScript {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  enabled?: boolean;
  matches?: string[];
  match?: string[];
  code?: string;
  lastModified?: number;
  runAt?: string;
  installedAt?: number;
  installedBy?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

interface AuditEntry {
  timestamp: number;
  action: string;
  sender: string;
  details: unknown;
  result: string;
}

interface WebhookConfig {
  url: string;
  enabled: boolean;
}

interface EndpointDef {
  description: string;
  params: Record<string, string> | null;
  auth: string;
  rateLimit: boolean;
}

interface WebPageEndpointDef {
  description: string;
  params: Record<string, string> | null;
}

interface APISchemaType {
  version: string;
  endpoints: Record<string, EndpointDef>;
  webPageEndpoints: Record<string, WebPageEndpointDef>;
  webhookEvents: string[];
}

/** Partial chrome MessageSender-like shape used by this module. */
interface SenderLike {
  id?: string;
  origin?: string;
  url?: string;
}

/** Shape of messages arriving from external extensions. */
interface ExternalMessage {
  action?: string;
  scriptId?: string;
  id?: string;
  enabled?: boolean;
  code?: string;
  [key: string]: unknown;
}

/** Shape of messages arriving from web pages. */
interface WebPageMessage {
  type: string;
  name?: string;
  url?: string;
  [key: string]: unknown;
}

type HandlerFn = (msg: ExternalMessage, sender: SenderLike) => Promise<Record<string, unknown>>;
type WebHandlerFn = (data: WebPageMessage, origin: string) => Promise<Record<string, unknown>>;

/* ------------------------------------------------------------------ */
/*  Parsed userscript metadata (minimal)                               */
/* ------------------------------------------------------------------ */

interface ParsedMeta {
  name?: string;
  version?: string;
  description?: string;
  match?: string[];
  runAt?: string;
  [key: string]: unknown;
}

type StoredUserscripts = FlatScript[] | Record<string, unknown>;

interface ScriptStoreSnapshot {
  mode: 'array' | 'record';
  raw: StoredUserscripts;
  scripts: FlatScript[];
}

interface RuntimeHooks {
  registerAllScripts?: () => Promise<void>;
  updateBadge?: (tabId?: number | null) => Promise<void>;
  autoReloadMatchingTabs?: (script: FlatScript & { meta?: ParsedMeta; settings?: Record<string, unknown> }) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_VERSION = '1.0.0';
const STORAGE_KEY_PERMS = 'publicapi_permissions';
const STORAGE_KEY_AUDIT = 'publicapi_audit';
const STORAGE_KEY_WEBHOOKS = 'publicapi_webhooks';
const STORAGE_KEY_ORIGINS = 'publicapi_trusted_origins';
const MAX_AUDIT_ENTRIES = 500;
const RATE_LIMIT_WINDOW = 1000; // ms
const RATE_LIMIT_MAX = 10;      // requests per window

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let _permissions: Record<string, PermissionLevel> | null = null;
let _auditLog: AuditEntry[] = [];
let _webhooks: Record<string, WebhookConfig> = {};
let _trustedOrigins: string[] = [];
let _initialized = false;
let _initPromise: Promise<void> | null = null;
const _rateLimitMap = new Map<string, number[]>();

// Max size for externally-supplied script code (5 MB)
const MAX_CODE_SIZE = 5 * 1024 * 1024;
// Max size for scripts fetched via web install (5 MB)
const MAX_FETCH_SIZE = 5 * 1024 * 1024;

function getRuntimeHooks(): RuntimeHooks {
  return globalThis as RuntimeHooks;
}

/* ------------------------------------------------------------------ */
/*  Default Permissions                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_PERMISSIONS: Record<string, PermissionLevel> = {
  ping:                'allow',
  getVersion:          'allow',
  getAPISchema:        'allow',
  getInstalledScripts: 'allow',
  getScriptStatus:     'allow',
  toggleScript:        'prompt',
  installScript:       'prompt'
};

/* ------------------------------------------------------------------ */
/*  API Schema (self-documenting)                                      */
/* ------------------------------------------------------------------ */

const API_SCHEMA: APISchemaType = {
  version: API_VERSION,
  endpoints: {
    ping: {
      description: 'Health check. Returns { ok: true, version }.',
      params: null,
      auth: 'none',
      rateLimit: true
    },
    getVersion: {
      description: 'Return the ScriptVault version string.',
      params: null,
      auth: 'none',
      rateLimit: true
    },
    getInstalledScripts: {
      description: 'List all installed scripts with name, version, and enabled status.',
      params: null,
      auth: 'basic',
      rateLimit: true
    },
    getScriptStatus: {
      description: 'Get detailed status for a single script.',
      params: { scriptId: 'string — the script ID' },
      auth: 'basic',
      rateLimit: true
    },
    toggleScript: {
      description: 'Enable or disable a script. Requires user approval.',
      params: { scriptId: 'string', enabled: 'boolean' },
      auth: 'prompt',
      rateLimit: true
    },
    installScript: {
      description: 'Install a new userscript. Requires user approval.',
      params: { code: 'string — full userscript source' },
      auth: 'prompt',
      rateLimit: true
    },
    getAPISchema: {
      description: 'Return the full API schema (this document).',
      params: null,
      auth: 'none',
      rateLimit: false
    }
  },
  webPageEndpoints: {
    'scriptvault:getScripts': {
      description: 'Returns list of scripts matching the current page.',
      params: null
    },
    'scriptvault:isInstalled': {
      description: 'Check if a script by name is installed.',
      params: { name: 'string' }
    },
    'scriptvault:install': {
      description: 'Trigger install flow for a script URL.',
      params: { url: 'string' }
    }
  },
  webhookEvents: ['script.installed', 'script.updated', 'script.error', 'script.toggled']
};

/* ------------------------------------------------------------------ */
/*  Storage Helpers                                                    */
/* ------------------------------------------------------------------ */

async function loadState(): Promise<void> {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEY_PERMS,
      STORAGE_KEY_AUDIT,
      STORAGE_KEY_WEBHOOKS,
      STORAGE_KEY_ORIGINS
    ]);
    _permissions = {
      ...DEFAULT_PERMISSIONS,
      ...((result[STORAGE_KEY_PERMS] as Record<string, PermissionLevel> | undefined) ?? {})
    };
    _auditLog = (result[STORAGE_KEY_AUDIT] as AuditEntry[] | undefined) ?? [];
    _webhooks = (result[STORAGE_KEY_WEBHOOKS] as Record<string, WebhookConfig> | undefined) ?? {};
    _trustedOrigins = (result[STORAGE_KEY_ORIGINS] as string[] | undefined) ?? [];
  } catch {
    _permissions = { ...DEFAULT_PERMISSIONS };
    _auditLog = [];
    _webhooks = {};
    _trustedOrigins = [];
  }
}

async function savePermissions(): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_PERMS]: _permissions });
  } catch (e: unknown) {
    console.warn('[PublicAPI] save permissions failed:', e);
  }
}

async function saveAuditLog(): Promise<void> {
  try {
    // Trim to max entries
    if (_auditLog.length > MAX_AUDIT_ENTRIES) {
      _auditLog = _auditLog.slice(-MAX_AUDIT_ENTRIES);
    }
    await chrome.storage.local.set({ [STORAGE_KEY_AUDIT]: _auditLog });
  } catch (e: unknown) {
    console.warn('[PublicAPI] save audit failed:', e);
  }
}

async function saveWebhooks(): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_WEBHOOKS]: _webhooks });
  } catch (e: unknown) {
    console.warn('[PublicAPI] save webhooks failed:', e);
  }
}

async function saveTrustedOrigins(): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_ORIGINS]: _trustedOrigins });
  } catch (e: unknown) {
    console.warn('[PublicAPI] save origins failed:', e);
  }
}

/* ------------------------------------------------------------------ */
/*  Audit Logging                                                      */
/* ------------------------------------------------------------------ */

function audit(action: string, sender: SenderLike | null, details: unknown, result: string): AuditEntry {
  const entry: AuditEntry = {
    timestamp: Date.now(),
    action,
    sender: describeSender(sender),
    details: details ?? null,
    result: result || 'ok'
  };
  _auditLog.push(entry);
  // Async save, don't await in hot path
  void saveAuditLog();
  return entry;
}

function describeSender(sender: SenderLike | null | undefined): string {
  if (!sender) return 'unknown';
  if (sender.id) return `extension:${sender.id}`;
  if (sender.origin) return `origin:${sender.origin}`;
  if (sender.url) return `url:${sender.url}`;
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Rate Limiting                                                      */
/* ------------------------------------------------------------------ */

function checkRateLimit(senderId: string): boolean {
  const now = Date.now();
  let timestamps = _rateLimitMap.get(senderId);

  if (!timestamps) {
    timestamps = [];
    _rateLimitMap.set(senderId, timestamps);
  }

  // Purge old timestamps outside the window
  const cutoff = now - RATE_LIMIT_WINDOW;
  while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false; // rate limited
  }

  timestamps.push(now);
  return true;
}

/* ------------------------------------------------------------------ */
/*  Permission Checking                                                */
/* ------------------------------------------------------------------ */

function getPermission(apiName: string): PermissionLevel {
  return (_permissions?.[apiName] as PermissionLevel | undefined) ?? 'deny';
}

async function requestUserApproval(apiName: string, sender: SenderLike | null, _details?: unknown): Promise<boolean> {
  // In a service worker we cannot show DOM prompts.
  // Use chrome.notifications for approval, but for safety we deny by default
  // and require pre-approval via setPermissions().
  // If running in a context with chrome.notifications, send one.
  try {
    if (chrome.notifications) {
      const notifId = `sv-api-approval-${Date.now()}`;
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'ScriptVault API Request',
        message: `External request: ${apiName} from ${describeSender(sender)}. Pre-approve via settings to allow.`,
        priority: 2
      });
    }
  } catch { /* notifications not available */ }

  // Default: deny unless explicitly allowed
  return false;
}

async function authorize(apiName: string, sender: SenderLike | null): Promise<boolean> {
  const perm = getPermission(apiName);
  if (perm === 'allow') return true;
  if (perm === 'deny') return false;
  if (perm === 'prompt') {
    return requestUserApproval(apiName, sender);
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Script Data Access                                                 */
/* ------------------------------------------------------------------ */

async function getScripts(): Promise<FlatScript[]> {
  try {
    const store = await getScriptStore();
    return store.scripts;
  } catch {
    return [];
  }
}

async function getScriptById(scriptId: string): Promise<FlatScript | null> {
  const scripts = await getScripts();
  return scripts.find(s => s.id === scriptId || s.name === scriptId) ?? null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeStoredScript(raw: unknown): FlatScript | null {
  if (!raw || typeof raw !== 'object') return null;

  const script = raw as Record<string, unknown>;
  const meta = script.meta && typeof script.meta === 'object'
    ? script.meta as Record<string, unknown>
    : null;

  const id = typeof script.id === 'string' ? script.id : '';
  if (!id) return null;

  const matches = asStringArray(script.matches ?? script.match ?? meta?.match ?? meta?.include);
  const runAt = typeof script.runAt === 'string'
    ? script.runAt
    : typeof meta?.['run-at'] === 'string'
      ? String(meta['run-at']).replace(/-/g, '_')
      : 'document_idle';

  return {
    id,
    name: typeof script.name === 'string'
      ? script.name
      : typeof meta?.name === 'string'
        ? String(meta.name)
        : id,
    version: typeof script.version === 'string'
      ? script.version
      : typeof meta?.version === 'string'
        ? String(meta.version)
        : '1.0',
    description: typeof script.description === 'string'
      ? script.description
      : typeof meta?.description === 'string'
        ? String(meta.description)
        : '',
    enabled: script.enabled !== false,
    matches,
    match: matches,
    code: typeof script.code === 'string' ? script.code : undefined,
    lastModified: asNumber(script.lastModified) ?? asNumber(script.updatedAt),
    runAt,
    installedAt: asNumber(script.installedAt) ?? asNumber(script.createdAt),
    installedBy: typeof script.installedBy === 'string' ? script.installedBy : undefined,
    updatedAt: asNumber(script.updatedAt)
  };
}

async function getScriptStore(): Promise<ScriptStoreSnapshot> {
  const result = await chrome.storage.local.get('userscripts');
  const raw = result['userscripts'];

  if (Array.isArray(raw)) {
    return {
      mode: 'array',
      raw,
      scripts: raw
        .map(normalizeStoredScript)
        .filter((script): script is FlatScript => script !== null)
    };
  }

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    return {
      mode: 'record',
      raw: record,
      scripts: Object.values(record)
        .map(normalizeStoredScript)
        .filter((script): script is FlatScript => script !== null)
    };
  }

  return {
    mode: 'record',
    raw: {},
    scripts: []
  };
}

function findArrayScriptIndex(scripts: FlatScript[], scriptId: string): number {
  return scripts.findIndex((script) => script.id === scriptId || script.name === scriptId);
}

function findRecordScriptEntry(
  record: Record<string, unknown>,
  scriptId: string
): { key: string; value: Record<string, unknown> } | null {
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeStoredScript(value);
    if (normalized && (normalized.id === scriptId || normalized.name === scriptId) && value && typeof value === 'object') {
      return { key, value: value as Record<string, unknown> };
    }
  }
  return null;
}

function createNestedStoredScript(
  newScript: FlatScript,
  meta: ParsedMeta,
  installedBy: string,
  position: number,
  existing: Record<string, unknown> | null = null
): Record<string, unknown> {
  const existingRecord = existing ?? {};
  const existingMeta = existingRecord.meta && typeof existingRecord.meta === 'object'
    ? existingRecord.meta as Record<string, unknown>
    : {};
  const matches = asStringArray(newScript.matches ?? newScript.match ?? meta.match ?? ['*://*/*']);

  return {
    ...existingRecord,
    id: newScript.id,
    code: newScript.code ?? (typeof existingRecord.code === 'string' ? existingRecord.code : ''),
    enabled: newScript.enabled !== false,
    position: asNumber(existingRecord.position) ?? position,
    meta: {
      ...existingMeta,
      name: newScript.name ?? newScript.id,
      namespace: typeof existingMeta.namespace === 'string' ? existingMeta.namespace : '',
      version: newScript.version ?? '1.0',
      description: newScript.description ?? '',
      author: typeof existingMeta.author === 'string' ? existingMeta.author : '',
      icon: typeof existingMeta.icon === 'string' ? existingMeta.icon : '',
      icon64: typeof existingMeta.icon64 === 'string' ? existingMeta.icon64 : '',
      homepage: typeof existingMeta.homepage === 'string' ? existingMeta.homepage : '',
      homepageURL: typeof existingMeta.homepageURL === 'string' ? existingMeta.homepageURL : '',
      website: typeof existingMeta.website === 'string' ? existingMeta.website : '',
      source: typeof existingMeta.source === 'string' ? existingMeta.source : '',
      updateURL: typeof existingMeta.updateURL === 'string' ? existingMeta.updateURL : '',
      downloadURL: typeof existingMeta.downloadURL === 'string' ? existingMeta.downloadURL : '',
      supportURL: typeof existingMeta.supportURL === 'string' ? existingMeta.supportURL : '',
      license: typeof existingMeta.license === 'string' ? existingMeta.license : '',
      copyright: typeof existingMeta.copyright === 'string' ? existingMeta.copyright : '',
      contributionURL: typeof existingMeta.contributionURL === 'string' ? existingMeta.contributionURL : '',
      match: matches.length > 0 ? matches : ['*://*/*'],
      include: asStringArray(existingMeta.include),
      exclude: asStringArray(existingMeta.exclude),
      excludeMatch: asStringArray(existingMeta.excludeMatch),
      'run-at': (newScript.runAt ?? meta.runAt ?? 'document_idle').replace(/_/g, '-'),
      'inject-into': typeof existingMeta['inject-into'] === 'string' ? existingMeta['inject-into'] : 'auto',
      noframes: Boolean(existingMeta.noframes),
      unwrap: Boolean(existingMeta.unwrap),
      sandbox: typeof existingMeta.sandbox === 'string' ? existingMeta.sandbox : '',
      'run-in': typeof existingMeta['run-in'] === 'string' ? existingMeta['run-in'] : '',
      grant: (() => {
        const grants = asStringArray(existingMeta.grant);
        return grants.length > 0 ? grants : ['none'];
      })(),
      require: asStringArray(existingMeta.require),
      resource: existingMeta.resource && typeof existingMeta.resource === 'object'
        ? existingMeta.resource as Record<string, unknown>
        : {},
      connect: asStringArray(existingMeta.connect),
      'top-level-await': Boolean(existingMeta['top-level-await']),
      webRequest: existingMeta.webRequest ?? null,
      priority: asNumber(existingMeta.priority) ?? 0,
      antifeature: asStringArray(existingMeta.antifeature),
      tag: asStringArray(existingMeta.tag),
      compatible: asStringArray(existingMeta.compatible),
      incompatible: asStringArray(existingMeta.incompatible)
    },
    settings: existingRecord.settings && typeof existingRecord.settings === 'object'
      ? existingRecord.settings
      : {},
    stats: existingRecord.stats && typeof existingRecord.stats === 'object'
      ? existingRecord.stats
      : { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
    versionHistory: Array.isArray(existingRecord.versionHistory) ? existingRecord.versionHistory : [],
    createdAt: asNumber(existingRecord.createdAt) ?? newScript.installedAt ?? Date.now(),
    updatedAt: newScript.updatedAt ?? Date.now(),
    installedBy
  };
}

function upsertScriptStore(
  store: ScriptStoreSnapshot,
  newScript: FlatScript,
  meta: ParsedMeta,
  installedBy: string
): StoredUserscripts {
  if (store.mode === 'array') {
    const scripts = Array.isArray(store.raw) ? [...store.raw] : [];
    const idx = findArrayScriptIndex(scripts, newScript.id);
    if (idx !== -1) {
      scripts[idx] = { ...scripts[idx], ...newScript, updatedAt: Date.now(), installedBy };
    } else {
      scripts.push({ ...newScript, installedBy });
    }
    return scripts;
  }

  const record = !Array.isArray(store.raw) ? { ...store.raw } : {};
  const existing = findRecordScriptEntry(record, newScript.id);
  const key = existing?.key ?? newScript.id;
  const position = existing
    ? asNumber(existing.value.position) ?? store.scripts.length
    : store.scripts.length;

  record[key] = createNestedStoredScript(newScript, meta, installedBy, position, existing?.value ?? null);
  return record;
}

function toRuntimeScriptShape(script: FlatScript, meta: ParsedMeta): FlatScript & { meta: ParsedMeta; settings: Record<string, unknown> } {
  return {
    ...script,
    meta: {
      ...meta,
      name: script.name ?? meta.name ?? script.id,
      version: script.version ?? meta.version ?? '1.0',
      description: script.description ?? meta.description ?? '',
      match: Array.isArray(meta.match) && meta.match.length > 0 ? [...meta.match] : ['*://*/*'],
      'run-at': script.runAt ?? meta.runAt ?? 'document_idle',
    },
    settings: {},
  };
}

async function refreshRuntimeAfterMutation(
  script?: FlatScript,
  meta: ParsedMeta = {},
): Promise<void> {
  const hooks = getRuntimeHooks();

  if (typeof hooks.registerAllScripts === 'function') {
    try {
      await hooks.registerAllScripts();
    } catch (e: unknown) {
      console.warn('[PublicAPI] Failed to refresh registered scripts:', e);
    }
  }

  if (typeof hooks.updateBadge === 'function') {
    try {
      await hooks.updateBadge();
    } catch (e: unknown) {
      console.warn('[PublicAPI] Failed to refresh badge state:', e);
    }
  }

  if (script && typeof hooks.autoReloadMatchingTabs === 'function') {
    try {
      await hooks.autoReloadMatchingTabs(toRuntimeScriptShape(script, meta));
    } catch (e: unknown) {
      console.warn('[PublicAPI] Failed to auto-reload matching tabs:', e);
    }
  }
}

async function getExtensionVersion(): Promise<string> {
  try {
    const manifest = chrome.runtime.getManifest();
    return manifest.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/* ------------------------------------------------------------------ */
/*  API Handlers (External Messages)                                   */
/* ------------------------------------------------------------------ */

const HANDLERS: Record<string, HandlerFn> = {
  async ping(_msg: ExternalMessage, _sender: SenderLike): Promise<Record<string, unknown>> {
    return { ok: true, version: await getExtensionVersion(), api: API_VERSION };
  },

  async getVersion(_msg: ExternalMessage, _sender: SenderLike): Promise<Record<string, unknown>> {
    return { version: await getExtensionVersion(), api: API_VERSION };
  },

  async getInstalledScripts(_msg: ExternalMessage, _sender: SenderLike): Promise<Record<string, unknown>> {
    const scripts = await getScripts();
    return {
      scripts: scripts.map(s => ({
        id: s.id,
        name: s.name ?? s.id,
        version: s.version ?? '1.0',
        enabled: s.enabled !== false,
        matchUrls: s.matches ?? s.match ?? []
      }))
    };
  },

  async getScriptStatus(msg: ExternalMessage, _sender: SenderLike): Promise<Record<string, unknown>> {
    const scriptId = msg.scriptId ?? msg.id;
    if (!scriptId) return { error: 'Missing scriptId parameter' };

    const script = await getScriptById(scriptId);
    if (!script) return { error: 'Script not found', scriptId };

    return {
      id: script.id,
      name: script.name ?? script.id,
      version: script.version ?? '1.0',
      enabled: script.enabled !== false,
      matches: script.matches ?? script.match ?? [],
      lastModified: script.lastModified ?? null,
      runAt: script.runAt ?? 'document_idle'
    };
  },

  async toggleScript(msg: ExternalMessage, sender: SenderLike): Promise<Record<string, unknown>> {
    const scriptId = msg.scriptId ?? msg.id;
    const enabled = !!msg.enabled;
    if (!scriptId) return { error: 'Missing scriptId parameter' };

    const allowed = await authorize('toggleScript', sender);
    if (!allowed) return { error: 'Permission denied', action: 'toggleScript' };

    try {
      // Use ScriptStorage to keep the in-memory cache coherent.
      // Direct chrome.storage.local writes would leave the cache stale, causing
      // registerAllScripts() to re-register scripts with the old enabled value.
      const script = await ScriptStorage.get(scriptId);
      if (!script) {
        // Fall back to legacy-format path for backwards compatibility
        const store = await getScriptStore();
        let updatedStore: StoredUserscripts | null = null;

        if (store.mode === 'array') {
          const scripts = Array.isArray(store.raw) ? [...store.raw] : [];
          const idx = findArrayScriptIndex(scripts, scriptId);
          if (idx === -1) return { error: 'Script not found', scriptId };
          const current = scripts[idx]!;
          scripts[idx] = { ...current, enabled, updatedAt: Date.now() };
          updatedStore = scripts;
        } else {
          const record = !Array.isArray(store.raw) ? { ...store.raw } : {};
          const entry = findRecordScriptEntry(record, scriptId);
          if (!entry) return { error: 'Script not found', scriptId };
          record[entry.key] = { ...entry.value, enabled, updatedAt: Date.now() };
          updatedStore = record;
        }

        await chrome.storage.local.set({ userscripts: updatedStore });
        // Invalidate the ScriptStorage cache since we wrote to storage directly
        ScriptStorage.invalidateCache();
      } else {
        await ScriptStorage.set(scriptId, { ...script, enabled, updatedAt: Date.now() });
      }

      await refreshRuntimeAfterMutation();

      void fireWebhook('script.toggled', { scriptId, enabled });
      return { ok: true, scriptId, enabled };
    } catch (e: unknown) {
      return { error: 'Failed to toggle script', detail: (e as Error).message };
    }
  },

  async installScript(msg: ExternalMessage, sender: SenderLike): Promise<Record<string, unknown>> {
    const code = msg.code;
    if (!code || typeof code !== 'string') return { error: 'Missing or invalid code parameter' };
    if (code.length > MAX_CODE_SIZE) return { error: 'Script code exceeds maximum allowed size (5 MB)' };
    if (!code.includes('==UserScript==')) return { error: 'Not a valid userscript (missing ==UserScript== header)' };

    const allowed = await authorize('installScript', sender);
    if (!allowed) return { error: 'Permission denied', action: 'installScript' };

    try {
      // Parse basic userscript metadata
      const meta = parseUserscriptMeta(code);

      // Derive a script ID that is unique among existing scripts
      const baseId: string = meta.name
        ? meta.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
        : `ext_${Date.now()}`;
      const existingScripts = await ScriptStorage.getAll();
      const usedIds = new Set(existingScripts.map(s => s.id));
      let scriptId = baseId;
      if (usedIds.has(scriptId)) {
        let counter = 2;
        while (usedIds.has(`${baseId}_${counter}`)) counter++;
        scriptId = `${baseId}_${counter}`;
      }

      const newScript: FlatScript = {
        id: scriptId,
        name: meta.name ?? scriptId,
        version: meta.version ?? '1.0',
        description: meta.description ?? '',
        matches: meta.match ?? ['*://*/*'],
        code,
        enabled: true,
        installedAt: Date.now(),
        installedBy: describeSender(sender),
        runAt: meta.runAt ?? 'document_idle'
      };

      const store = await getScriptStore();
      const updatedStore = upsertScriptStore(store, newScript, meta, describeSender(sender));

      await chrome.storage.local.set({ userscripts: updatedStore });
      // Invalidate ScriptStorage cache so registerAllScripts() picks up the new script
      ScriptStorage.invalidateCache();
      await refreshRuntimeAfterMutation(newScript, meta);

      void fireWebhook('script.installed', { scriptId, name: newScript.name, version: newScript.version });
      return { ok: true, scriptId, name: newScript.name };
    } catch (e: unknown) {
      return { error: 'Failed to install script', detail: (e as Error).message };
    }
  },

  async getAPISchema(_msg: ExternalMessage, _sender: SenderLike): Promise<Record<string, unknown>> {
    return { schema: API_SCHEMA };
  }
};

/* ------------------------------------------------------------------ */
/*  Userscript Metadata Parser (minimal)                               */
/* ------------------------------------------------------------------ */

function parseUserscriptMeta(code: string): ParsedMeta {
  const meta: ParsedMeta = {};
  const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!headerMatch?.[1]) return meta;

  const lines = headerMatch[1].split('\n');
  for (const line of lines) {
    const m = line.match(/\/\/\s*@(\S+)\s+(.*)/);
    if (!m?.[1] || !m[2]) continue;
    const key = m[1].trim();
    const val = m[2].trim();

    if (key === 'match' || key === 'include') {
      if (!meta.match) meta.match = [];
      meta.match.push(val);
    } else if (key === 'run-at') {
      meta.runAt = val.replace(/-/g, '_');
    } else {
      meta[key] = val;
    }
  }
  return meta;
}

/* ------------------------------------------------------------------ */
/*  Web Page Message Handlers                                          */
/* ------------------------------------------------------------------ */

const WEB_HANDLERS: Record<string, WebHandlerFn> = {
  'scriptvault:getScripts': async (_data: WebPageMessage, _origin: string): Promise<Record<string, unknown>> => {
    const scripts = await getScripts();
    return {
      type: 'scriptvault:getScripts:response',
      scripts: scripts.map(s => ({
        name: s.name ?? s.id,
        version: s.version ?? '1.0',
        enabled: s.enabled !== false
      }))
    };
  },

  'scriptvault:isInstalled': async (data: WebPageMessage, _origin: string): Promise<Record<string, unknown>> => {
    const name = data.name;
    if (!name) return { type: 'scriptvault:isInstalled:response', error: 'Missing name' };

    const scripts = await getScripts();
    const found = scripts.find(s =>
      (s.name ?? '').toLowerCase() === name.toLowerCase() ||
      (s.id ?? '').toLowerCase() === name.toLowerCase()
    );
    return {
      type: 'scriptvault:isInstalled:response',
      installed: !!found,
      name,
      version: found ? (found.version ?? '1.0') : null
    };
  },

  'scriptvault:install': async (data: WebPageMessage, origin: string): Promise<Record<string, unknown>> => {
    const url = data.url;
    if (!url || typeof url !== 'string') {
      return { type: 'scriptvault:install:response', error: 'Missing or invalid url' };
    }

    // Validate URL — only allow https: to prevent SSRF to local/internal resources
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { type: 'scriptvault:install:response', error: 'Invalid URL' };
    }
    if (parsedUrl.protocol !== 'https:') {
      return { type: 'scriptvault:install:response', error: 'Only https:// URLs are allowed for script installation' };
    }

    // Authorize before fetching to prevent SSRF
    const allowed = await authorize('installScript', { origin });
    if (!allowed) {
      return { type: 'scriptvault:install:response', error: 'Permission denied', action: 'installScript' };
    }

    // Fetch the script only after authorization
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);
      let resp: Response;
      try {
        resp = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      // Enforce size limit before reading the full body
      const contentLength = resp.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_FETCH_SIZE) {
        throw new Error('Script file exceeds maximum allowed size (5 MB)');
      }
      const code = await resp.text();
      if (code.length > MAX_FETCH_SIZE) {
        throw new Error('Script file exceeds maximum allowed size (5 MB)');
      }
      if (!code.includes('==UserScript==')) {
        throw new Error('Not a valid userscript (missing ==UserScript== header)');
      }

      // Parse and install directly (authorization already checked above)
      const meta = parseUserscriptMeta(code);

      // Derive a unique script ID
      const baseId: string = meta.name
        ? meta.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
        : `ext_${Date.now()}`;
      const existingScripts = await ScriptStorage.getAll();
      const usedIds = new Set(existingScripts.map(s => s.id));
      let scriptId = baseId;
      if (usedIds.has(scriptId)) {
        let counter = 2;
        while (usedIds.has(`${baseId}_${counter}`)) counter++;
        scriptId = `${baseId}_${counter}`;
      }

      const newScript: FlatScript = {
        id: scriptId,
        name: meta.name ?? scriptId,
        version: meta.version ?? '1.0',
        description: meta.description ?? '',
        matches: meta.match ?? ['*://*/*'],
        code,
        enabled: true,
        installedAt: Date.now(),
        installedBy: `origin:${origin}`,
        runAt: meta.runAt ?? 'document_idle'
      };

      const store = await getScriptStore();
      const updatedStore = upsertScriptStore(store, newScript, meta, `origin:${origin}`);

      await chrome.storage.local.set({ userscripts: updatedStore });
      // Invalidate ScriptStorage cache so registerAllScripts() picks up the new script
      ScriptStorage.invalidateCache();
      await refreshRuntimeAfterMutation(newScript, meta);

      void fireWebhook('script.installed', { scriptId, name: newScript.name, version: newScript.version });
      return { type: 'scriptvault:install:response', ok: true, scriptId, name: newScript.name };
    } catch (e: unknown) {
      return { type: 'scriptvault:install:response', error: 'Fetch failed', detail: (e as Error).message };
    }
  }
};

/* ------------------------------------------------------------------ */
/*  Webhook Support                                                    */
/* ------------------------------------------------------------------ */

async function fireWebhook(eventType: string, payload: Record<string, unknown>): Promise<void> {
  const hook = _webhooks[eventType];
  if (!hook?.enabled || !hook.url) return;

  const body = {
    event: eventType,
    timestamp: Date.now(),
    version: API_VERSION,
    data: payload
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e: unknown) {
    console.warn(`[PublicAPI] webhook ${eventType} failed:`, e);
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ------------------------------------------------------------------ */
/*  Message Dispatchers                                                */
/* ------------------------------------------------------------------ */

async function dispatchExternal(message: ExternalMessage, sender: SenderLike): Promise<Record<string, unknown>> {
  const action = message?.action;
  if (!action || typeof action !== 'string') {
    return { error: 'Missing action field' };
  }

  const handler = HANDLERS[action];
  if (!handler) {
    return { error: `Unknown action: ${action}`, availableActions: Object.keys(HANDLERS) };
  }

  // Rate limit
  const senderId = describeSender(sender);
  const endpoint = API_SCHEMA.endpoints[action];
  if (endpoint?.rateLimit !== false) {
    if (!checkRateLimit(senderId)) {
      audit(action, sender, null, 'rate_limited');
      return { error: 'Rate limited. Max 10 requests per second.' };
    }
  }

  // Permission check (ping, getVersion, getAPISchema are always allowed)
  const perm = getPermission(action);
  if (perm === 'deny') {
    audit(action, sender, null, 'denied');
    return { error: 'Permission denied', action };
  }

  // Execute
  try {
    const result = await handler(message, sender);
    audit(action, sender, message, result['error'] ? 'error' : 'ok');
    return result;
  } catch (e: unknown) {
    audit(action, sender, message, 'exception');
    return { error: 'Internal error', detail: (e as Error).message };
  }
}

function dispatchWebMessage(event: MessageEvent): void {
  // Validate origin — deny-by-default when no trusted origins are configured
  if (_trustedOrigins.length === 0 || (!_trustedOrigins.includes(event.origin) && !_trustedOrigins.includes('*'))) {
    return; // ignore untrusted origins
  }

  const data = event.data as unknown;
  if (!data || typeof data !== 'object' || !('type' in data)) return;
  const msg = data as WebPageMessage;
  if (!msg.type.startsWith('scriptvault:')) return;

  const senderId = `web:${event.origin}`;
  if (!checkRateLimit(senderId)) {
    // Silently drop rate-limited web messages
    return;
  }

  const handler = WEB_HANDLERS[msg.type];
  if (!handler) return;

  audit(msg.type, { origin: event.origin }, msg, 'processing');

  handler(msg, event.origin).then(response => {
    if (response && event.source) {
      try {
        (event.source as WindowProxy).postMessage(
          response,
          event.origin === 'null' ? '*' : event.origin
        );
      } catch { /* cross-origin post failed */ }
    }
  }).catch((e: unknown) => {
    console.warn('[PublicAPI] web handler error:', e);
  });
}

/* ------------------------------------------------------------------ */
/*  Listener Management                                                */
/* ------------------------------------------------------------------ */

function onExternalMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  // chrome.runtime.onMessageExternal is async-capable via sendResponse
  void dispatchExternal(message as ExternalMessage, sender as SenderLike).then(result => {
    try { sendResponse(result); } catch { /* port closed */ }
  });
  return true; // keep message channel open for async response
}

/* ------------------------------------------------------------------ */
/*  Public Interface                                                   */
/* ------------------------------------------------------------------ */

const PublicAPI = {
  /**
   * Initialize the Public API: load state, register listeners.
   * Safe for service workers (no DOM).
   * Concurrent callers share one init promise to prevent double-registration.
   */
  async init(): Promise<void> {
    if (_initialized) return;
    if (!_initPromise) {
      _initPromise = (async () => {
        await loadState();

        // Register external message listener
        if (chrome.runtime.onMessageExternal) {
          chrome.runtime.onMessageExternal.addListener(onExternalMessage);
        }

        // Register web page message listener (only in contexts that have window)
        if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
          self.addEventListener('message', dispatchWebMessage);
        }

        _initialized = true;
        console.log('[PublicAPI] initialized, version', API_VERSION);
      })();
    }
    return _initPromise;
  },

  /**
   * Handle an external message manually (if not using auto-listener).
   */
  async handleExternalMessage(message: ExternalMessage, sender: SenderLike): Promise<Record<string, unknown>> {
    if (!_initialized) await this.init();
    return dispatchExternal(message, sender);
  },

  /**
   * Handle a web page message event manually.
   */
  handleWebMessage(event: MessageEvent): void {
    dispatchWebMessage(event);
  },

  /**
   * Return the full API schema.
   */
  getAPISchema(): APISchemaType {
    return { ...API_SCHEMA };
  },

  /**
   * Return the audit log (most recent entries).
   */
  getAuditLog(limit = 50): AuditEntry[] {
    const start = Math.max(0, _auditLog.length - limit);
    return _auditLog.slice(start);
  },

  /**
   * Set permissions for API actions.
   */
  async setPermissions(perms: Record<string, string>): Promise<void> {
    if (!_permissions) await loadState();
    for (const [key, val] of Object.entries(perms)) {
      if (['allow', 'deny', 'prompt'].includes(val)) {
        _permissions![key] = val as PermissionLevel;
      }
    }
    await savePermissions();
  },

  /**
   * Set trusted web page origins.
   */
  async setTrustedOrigins(origins: string[]): Promise<void> {
    _trustedOrigins = Array.isArray(origins) ? origins.slice() : [];
    await saveTrustedOrigins();
  },

  /**
   * Get trusted web page origins.
   */
  getTrustedOrigins(): string[] {
    return _trustedOrigins.slice();
  },

  /**
   * Configure a webhook for an event type.
   */
  async setWebhook(eventType: string, config: { url?: string; enabled?: boolean }): Promise<void> {
    if (!API_SCHEMA.webhookEvents.includes(eventType)) {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    const url = config.url ?? '';
    if (url && !url.startsWith('https://')) {
      throw new Error('Webhook URL must use https://');
    }
    _webhooks[eventType] = {
      url,
      enabled: !!config.enabled
    };
    await saveWebhooks();
  },

  /**
   * Get all configured webhooks.
   */
  getWebhooks(): Record<string, WebhookConfig> {
    return { ..._webhooks };
  },

  /**
   * Fire a webhook event programmatically (used by other modules).
   */
  async fireEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    audit('fireEvent', { id: 'internal' }, { eventType, payload }, 'ok');
    await fireWebhook(eventType, payload);
  },

  /**
   * Clear the audit log.
   */
  async clearAuditLog(): Promise<void> {
    _auditLog = [];
    await saveAuditLog();
  }
};

export default PublicAPI;
export { PublicAPI };
export type { AuditEntry, WebhookConfig, PermissionLevel, APISchemaType, FlatScript };
