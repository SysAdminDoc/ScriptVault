// ScriptVault — Public Extension API
// Allows other extensions and web pages to interact with ScriptVault.
// Designed for service worker (no DOM dependencies).

import { isInternalHost } from '../background/internal-host-guard';

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
  settings?: Record<string, unknown>;
  lastModified?: number;
  runAt?: string;
  installedAt?: number;
  installedBy?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

declare const ScriptStorage: {
  get(id: string): Promise<(FlatScript & Record<string, unknown>) | null>;
  getAll(): Promise<Array<FlatScript & { meta?: Record<string, unknown>; settings?: Record<string, unknown> }>>;
  set(id: string, script: Record<string, unknown>): Promise<unknown>;
};

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

interface LocalMcpBridgeConfig {
  enabled: boolean;
  origins: string[];
  tokenHash: string;
  tokenHint: string;
}

interface LocalMcpBridgePublicConfig {
  enabled: boolean;
  origins: string[];
  hasToken: boolean;
  tokenHint: string;
  capabilities: string[];
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

interface ParsedAntifeature {
  type: string;
  description: string;
  locale: string;
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
  token?: string;
  requestId?: string;
  scriptId?: string;
  code?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

type HandlerFn = (msg: ExternalMessage, sender: SenderLike) => Promise<Record<string, unknown>>;
type WebHandlerFn = (data: WebPageMessage, origin: string) => Promise<Record<string, unknown>>;
type LocalMcpHandlerFn = (data: WebPageMessage, origin: string) => Promise<Record<string, unknown>>;

/* ------------------------------------------------------------------ */
/*  Parsed userscript metadata (minimal)                               */
/* ------------------------------------------------------------------ */

interface ParsedMeta {
  name?: string;
  namespace?: string;
  version?: string;
  description?: string;
  author?: string;
  match?: string[];
  include?: string[];
  exclude?: string[];
  excludeMatch?: string[];
  grant?: string[];
  require?: string[];
  requireProvenance?: string[];
  requireIdentity?: string[];
  connect?: string[];
  tag?: string[];
  compatible?: string[];
  incompatible?: string[];
  antifeature?: ParsedAntifeature[];
  resource?: Record<string, string>;
  runAt?: string;
  noframes?: boolean;
  unwrap?: boolean;
  'top-level-await'?: boolean;
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
const STORAGE_KEY_TRUSTED_EXTENSIONS = 'publicapi_trusted_extension_ids';
const STORAGE_KEY_LOCAL_MCP = 'publicapi_local_mcp_bridge';
const MAX_AUDIT_ENTRIES = 500;
const RATE_LIMIT_WINDOW = 1000; // ms
const RATE_LIMIT_MAX = 10;      // requests per window
const RATE_LIMIT_SENDER_CAP = 200;
const MAX_TRUSTED_ORIGINS = 128;
const MAX_TRUSTED_ORIGIN_LENGTH = 256;
const MAX_TRUSTED_EXTENSION_IDS = 64;
const MAX_EXTENSION_ID_LENGTH = 128;
const MAX_LOCAL_MCP_ORIGINS = 16;
const MAX_LOCAL_MCP_ORIGIN_LENGTH = 128;
const MIN_LOCAL_MCP_TOKEN_LENGTH = 16;
const HANDSHAKE_ACTIONS = new Set(['ping', 'getVersion', 'getAPISchema']);
const LOCAL_MCP_CAPABILITIES = Object.freeze([
  'hello',
  'listScripts',
  'readScript',
  'writeScript',
]);
const DEFAULT_LOCAL_MCP_BRIDGE: LocalMcpBridgeConfig = Object.freeze({
  enabled: false,
  origins: [],
  tokenHash: '',
  tokenHint: '',
});

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let _permissions: Record<string, PermissionLevel> | null = null;
let _auditLog: AuditEntry[] = [];
let _webhooks: Record<string, WebhookConfig> = {};
let _trustedOrigins: string[] = [];
let _trustedExtensionIds: string[] = [];
let _localMcpBridge: LocalMcpBridgeConfig = { ...DEFAULT_LOCAL_MCP_BRIDGE };
let _initialized = false;
let _initPromise: Promise<void> | null = null;
const _rateLimitMap = new Map<string, number[]>();

// Max size for externally-supplied script code (5 MB)
const MAX_CODE_SIZE = 5 * 1024 * 1024;
// Max size for scripts fetched via web install (5 MB)
const MAX_FETCH_SIZE = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const WEBHOOK_TIMEOUT_MS = 10_000;
const SCRIPT_SIZE_ERROR = 'Script file exceeds maximum allowed size (5 MB)';

function getRuntimeHooks(): RuntimeHooks {
  return globalThis as RuntimeHooks;
}

function normalizeTrustedOrigin(origin: unknown): string {
  if (typeof origin !== 'string') throw new Error('Trusted origin must be a string');
  const trimmed = origin.trim();
  if (!trimmed) throw new Error('Trusted origin cannot be empty');
  if (trimmed === '*') throw new Error('Wildcard trusted origins are not allowed');
  if (trimmed.length > MAX_TRUSTED_ORIGIN_LENGTH) throw new Error('Trusted origin is too long');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Trusted origin is malformed');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Trusted origin must use https://');
  }
  if (!parsed.hostname || isInternalHost(parsed.hostname)) {
    throw new Error('Trusted origin points at an internal/loopback host');
  }
  return parsed.origin;
}

function normalizeTrustedOrigins(origins: unknown): string[] {
  if (!Array.isArray(origins)) return [];
  if (origins.length > MAX_TRUSTED_ORIGINS) {
    throw new Error(`Too many trusted origins; maximum is ${MAX_TRUSTED_ORIGINS}`);
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const origin of origins) {
    const value = normalizeTrustedOrigin(origin);
    if (!seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  }
  return normalized;
}

function normalizeStoredTrustedOrigins(origins: unknown): string[] {
  if (!Array.isArray(origins)) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const origin of origins.slice(0, MAX_TRUSTED_ORIGINS)) {
    try {
      const value = normalizeTrustedOrigin(origin);
      if (!seen.has(value)) {
        seen.add(value);
        normalized.push(value);
      }
    } catch {
      // Ignore legacy or corrupted origins on load; setTrustedOrigins surfaces
      // validation errors for new writes.
    }
  }
  return normalized;
}

function normalizeIncomingOrigin(origin: unknown): string | null {
  try {
    return normalizeTrustedOrigin(origin);
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  const ipv4 = host.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (!ipv4) return false;
  const parts = host.split('.').map(part => Number.parseInt(part, 10));
  return parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) && parts[0] === 127;
}

function normalizeLocalMcpOrigin(origin: unknown): string {
  if (typeof origin !== 'string') throw new Error('Local MCP origin must be a string');
  const trimmed = origin.trim();
  if (!trimmed) throw new Error('Local MCP origin cannot be empty');
  if (trimmed.length > MAX_LOCAL_MCP_ORIGIN_LENGTH) throw new Error('Local MCP origin is too long');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Local MCP origin is malformed');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Local MCP origin must use http:// or https://');
  }
  if (!isLoopbackHostname(parsed.hostname)) {
    throw new Error('Local MCP origin must be loopback-only');
  }
  return parsed.origin;
}

function normalizeLocalMcpOrigins(origins: unknown): string[] {
  if (!Array.isArray(origins)) return [];
  if (origins.length > MAX_LOCAL_MCP_ORIGINS) {
    throw new Error(`Too many Local MCP origins; maximum is ${MAX_LOCAL_MCP_ORIGINS}`);
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const origin of origins) {
    const value = normalizeLocalMcpOrigin(origin);
    if (!seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  }
  return normalized;
}

function normalizeStoredLocalMcpConfig(value: unknown): LocalMcpBridgeConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_LOCAL_MCP_BRIDGE };
  const raw = value as Record<string, unknown>;
  let origins: string[] = [];
  try {
    origins = normalizeLocalMcpOrigins(raw.origins);
  } catch {
    origins = [];
  }
  return {
    enabled: raw.enabled === true,
    origins,
    tokenHash: typeof raw.tokenHash === 'string' ? raw.tokenHash : '',
    tokenHint: typeof raw.tokenHint === 'string' ? raw.tokenHint.slice(0, 24) : '',
  };
}

function localMcpTokenHint(token: string): string {
  return token.length <= 8 ? 'configured' : `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hashLocalMcpToken(token: string): Promise<string> {
  if (typeof token !== 'string' || token.length < MIN_LOCAL_MCP_TOKEN_LENGTH) {
    throw new Error(`Local MCP token must be at least ${MIN_LOCAL_MCP_TOKEN_LENGTH} characters`);
  }
  if (!crypto?.subtle?.digest) throw new Error('Token hashing unavailable');
  const encoded = new TextEncoder().encode(`ScriptVault Local MCP\0${token}`);
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoded));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function publicLocalMcpConfig(): LocalMcpBridgePublicConfig {
  return {
    enabled: _localMcpBridge.enabled,
    origins: _localMcpBridge.origins.slice(),
    hasToken: !!_localMcpBridge.tokenHash,
    tokenHint: _localMcpBridge.tokenHint,
    capabilities: LOCAL_MCP_CAPABILITIES.slice(),
  };
}

/* ------------------------------------------------------------------ */
/*  Trusted Extension ID Helpers                                       */
/* ------------------------------------------------------------------ */

function normalizeExtensionId(id: unknown): string {
  if (typeof id !== 'string') throw new Error('Extension ID must be a string');
  const trimmed = id.trim().toLowerCase();
  if (!trimmed) throw new Error('Extension ID cannot be empty');
  if (trimmed.length > MAX_EXTENSION_ID_LENGTH) throw new Error('Extension ID is too long');
  if (!/^[a-z]{32}$/.test(trimmed)) {
    throw new Error('Extension ID must be a 32-character lowercase letter string');
  }
  return trimmed;
}

function normalizeTrustedExtensionIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  if (ids.length > MAX_TRUSTED_EXTENSION_IDS) {
    throw new Error(`Too many trusted extension IDs; maximum is ${MAX_TRUSTED_EXTENSION_IDS}`);
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const value = normalizeExtensionId(id);
    if (!seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  }
  return normalized;
}

function normalizeStoredTrustedExtensionIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const id of ids.slice(0, MAX_TRUSTED_EXTENSION_IDS)) {
    try {
      const value = normalizeExtensionId(id);
      if (!seen.has(value)) {
        seen.add(value);
        normalized.push(value);
      }
    } catch {
      // Ignore malformed IDs on load
    }
  }
  return normalized;
}

function isExtensionSenderTrusted(sender: SenderLike | null | undefined): boolean {
  if (!sender?.id) return false;
  if (_trustedExtensionIds.length === 0) return false;
  return _trustedExtensionIds.includes(sender.id.toLowerCase());
}

function validateWebInstallUrl(url: string): string | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return 'Invalid URL';
  }
  if (parsedUrl.protocol !== 'https:') {
    return 'Only https:// URLs are allowed for script installation';
  }
  if (isInternalHost(parsedUrl.hostname)) {
    return 'Internal URLs are not allowed';
  }
  return null;
}

function isInternalWebhookUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'malformed URL';
  }
  const host = parsed.hostname || '';
  if (!host) return 'empty hostname';
  if (!isInternalHost(host)) return null;
  if (
    host === 'localhost' ||
    host.endsWith('.localdomain') ||
    host === 'ip6-localhost' ||
    host === 'ip6-loopback' ||
    host.endsWith('.localhost')
  ) {
    return 'localhost alias';
  }
  if (host.includes(':')) return 'IPv6 loopback/internal';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'IPv4 private/loopback/CGNAT';
  return 'internal host';
}

function generateExternalScriptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function measuredUtf8Length(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

async function readResponseTextBounded(resp: Response, maxBytes: number): Promise<string> {
  const contentLength = resp.headers?.get?.('content-length');
  if (contentLength) {
    const declaredBytes = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new Error(SCRIPT_SIZE_ERROR);
    }
  }

  const body = resp.body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
          try { await reader.cancel(); } catch { /* ignore cancel errors */ }
          throw new Error(SCRIPT_SIZE_ERROR);
        }
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore release errors */ }
    }

    const decoder = new TextDecoder();
    let text = '';
    for (let i = 0; i < chunks.length; i++) {
      text += decoder.decode(chunks[i], { stream: i < chunks.length - 1 });
    }
    text += decoder.decode();
    return text;
  }

  const text = await resp.text();
  if (measuredUtf8Length(text) > maxBytes) {
    throw new Error(SCRIPT_SIZE_ERROR);
  }
  return text;
}

const ARRAY_META_KEYS: Record<string, keyof ParsedMeta> = {
  match: 'match',
  include: 'include',
  exclude: 'exclude',
  'exclude-match': 'excludeMatch',
  grant: 'grant',
  require: 'require',
  'require-provenance': 'requireProvenance',
  requireProvenance: 'requireProvenance',
  'require-identity': 'requireIdentity',
  requireIdentity: 'requireIdentity',
  connect: 'connect',
  tag: 'tag',
  compatible: 'compatible',
  incompatible: 'incompatible',
};
const BOOLEAN_META_KEYS = new Set(['noframes', 'unwrap', 'top-level-await']);

function parseAntifeatureDirective(value: string, locale = ''): ParsedAntifeature | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match?.[1]) return null;

  return {
    type: match[1].toLowerCase(),
    description: (match[2] ?? '').trim(),
    locale,
  };
}

function appendMetaValue(meta: ParsedMeta, key: keyof ParsedMeta, value: string): void {
  const values = (key === 'requireProvenance' || key === 'requireIdentity') && value.includes(',')
    ? value.split(',').map(part => part.trim()).filter(Boolean)
    : [value];
  const current = meta[key];
  if (Array.isArray(current)) {
    current.push(...values);
  } else {
    (meta as Record<string, unknown>)[key] = values;
  }
}

function normalizeAntifeatureEntry(entry: unknown): ParsedAntifeature | null {
  if (typeof entry === 'string') return parseAntifeatureDirective(entry);
  if (!entry || typeof entry !== 'object') return null;

  const obj = entry as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type.trim().toLowerCase() : '';
  if (!type) return null;

  return {
    type,
    description: typeof obj.description === 'string' ? obj.description.trim() : '',
    locale: typeof obj.locale === 'string' ? obj.locale.trim() : '',
  };
}

function asAntifeatureArray(value: unknown): ParsedAntifeature[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeAntifeatureEntry)
    .filter((entry): entry is ParsedAntifeature => entry !== null);
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
      description: 'Install a new userscript disabled for review. Requires user approval.',
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
      description: 'Fetch a userscript URL and install it disabled for review.',
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
      STORAGE_KEY_ORIGINS,
      STORAGE_KEY_TRUSTED_EXTENSIONS,
      STORAGE_KEY_LOCAL_MCP
    ]);
    _permissions = {
      ...DEFAULT_PERMISSIONS,
      ...((result[STORAGE_KEY_PERMS] as Record<string, PermissionLevel> | undefined) ?? {})
    };
    _auditLog = (result[STORAGE_KEY_AUDIT] as AuditEntry[] | undefined) ?? [];
    _webhooks = (result[STORAGE_KEY_WEBHOOKS] as Record<string, WebhookConfig> | undefined) ?? {};
    _trustedOrigins = normalizeStoredTrustedOrigins(result[STORAGE_KEY_ORIGINS]);
    _trustedExtensionIds = normalizeStoredTrustedExtensionIds(result[STORAGE_KEY_TRUSTED_EXTENSIONS]);
    _localMcpBridge = normalizeStoredLocalMcpConfig(result[STORAGE_KEY_LOCAL_MCP]);
  } catch {
    _permissions = { ...DEFAULT_PERMISSIONS };
    _auditLog = [];
    _webhooks = {};
    _trustedOrigins = [];
    _trustedExtensionIds = [];
    _localMcpBridge = { ...DEFAULT_LOCAL_MCP_BRIDGE };
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

async function saveTrustedExtensionIds(): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_TRUSTED_EXTENSIONS]: _trustedExtensionIds });
  } catch (e: unknown) {
    console.warn('[PublicAPI] save trusted extension IDs failed:', e);
  }
}

async function saveLocalMcpBridgeConfig(): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_LOCAL_MCP]: _localMcpBridge });
  } catch (e: unknown) {
    console.warn('[PublicAPI] save Local MCP bridge config failed:', e);
  }
}

async function configureLocalMcpBridge(config: {
  enabled?: boolean;
  origins?: string[];
  token?: string;
  clearToken?: boolean;
}): Promise<LocalMcpBridgePublicConfig> {
  if (!_permissions) await loadState();
  const next: LocalMcpBridgeConfig = {
    enabled: _localMcpBridge.enabled,
    origins: _localMcpBridge.origins.slice(),
    tokenHash: _localMcpBridge.tokenHash,
    tokenHint: _localMcpBridge.tokenHint,
  };

  if (typeof config.enabled === 'boolean') next.enabled = config.enabled;
  if (Object.prototype.hasOwnProperty.call(config, 'origins')) {
    next.origins = normalizeLocalMcpOrigins(config.origins);
  }
  if (config.clearToken) {
    next.tokenHash = '';
    next.tokenHint = '';
  }
  if (typeof config.token === 'string' && config.token.trim()) {
    const token = config.token.trim();
    next.tokenHash = await hashLocalMcpToken(token);
    next.tokenHint = localMcpTokenHint(token);
  }
  if (next.enabled && next.origins.length === 0) {
    throw new Error('Local MCP bridge requires at least one loopback origin');
  }
  if (next.enabled && !next.tokenHash) {
    throw new Error('Local MCP bridge requires a bearer token');
  }

  _localMcpBridge = next;
  await saveLocalMcpBridgeConfig();
  return publicLocalMcpConfig();
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

  if (_rateLimitMap.size > RATE_LIMIT_SENDER_CAP) {
    for (const [key, values] of _rateLimitMap) {
      if (values.length === 0 || (values[values.length - 1] ?? 0) < cutoff) {
        _rateLimitMap.delete(key);
      }
    }
  }

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

function getMetaString(
  meta: ParsedMeta,
  existingMeta: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const value = meta[key] ?? existingMeta[key];
  return typeof value === 'string' ? value : fallback;
}

function getMetaArray(
  meta: ParsedMeta,
  existingMeta: Record<string, unknown>,
  key: string,
): string[] {
  if (key === 'tag') {
    // Phase 36.4 — preserve user-assigned tags across re-install/update.
    // Source-declared `// @tag` directives union with any tags previously
    // set by the user (UI or earlier source). Deduplicate while preserving
    // first-seen order so the new source's order leads.
    const fromSource: string[] = asStringArray(meta[key]);
    const fromExisting: string[] = asStringArray(existingMeta[key]);
    if (fromSource.length === 0) return fromExisting;
    const seen: Set<string> = new Set<string>();
    const merged: string[] = [];
    for (const t of fromSource) {
      if (!seen.has(t)) {
        seen.add(t);
        merged.push(t);
      }
    }
    for (const t of fromExisting) {
      if (!seen.has(t)) {
        seen.add(t);
        merged.push(t);
      }
    }
    return merged;
  }
  return asStringArray(meta[key] ?? existingMeta[key]);
}

function getMetaAntifeatureArray(meta: ParsedMeta, existingMeta: Record<string, unknown>): ParsedAntifeature[] {
  const fromSource = asAntifeatureArray(meta.antifeature);
  if (fromSource.length > 0) return fromSource;
  return asAntifeatureArray(existingMeta.antifeature);
}

function getMetaBoolean(
  meta: ParsedMeta,
  existingMeta: Record<string, unknown>,
  key: string,
): boolean {
  const value = meta[key] ?? existingMeta[key];
  return value === true;
}

function createExternalInstallReviewSettings(source: string, sourceLabel: string): Record<string, unknown> {
  return {
    _importQuarantine: {
      source,
      sourceLabel,
      importedAt: Date.now(),
      archiveEnabled: true,
    },
  };
}

function matchPatternFromHttpOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname || isInternalHost(parsed.hostname)) return null;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

function externalFallbackMatches(sender: SenderLike | null | undefined): string[] {
  const originPattern = matchPatternFromHttpOrigin(sender?.origin);
  if (originPattern) return [originPattern];
  const urlPattern = matchPatternFromHttpOrigin(sender?.url);
  return urlPattern ? [urlPattern] : [];
}

function webFallbackMatches(origin: string): string[] {
  const pattern = matchPatternFromHttpOrigin(origin);
  return pattern ? [pattern] : [];
}

function selectInstallMatches(meta: ParsedMeta, fallbackMatches: string[]): string[] {
  const declared = asStringArray(meta.match);
  return declared.length > 0 ? declared : fallbackMatches;
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
  const matches = asStringArray(newScript.matches ?? newScript.match ?? meta.match);
  const resources = meta.resource && typeof meta.resource === 'object'
    ? meta.resource
    : existingMeta.resource && typeof existingMeta.resource === 'object'
      ? existingMeta.resource as Record<string, unknown>
      : {};
  const existingSettings = existingRecord.settings && typeof existingRecord.settings === 'object'
    ? existingRecord.settings as Record<string, unknown>
    : {};
  const incomingSettings = newScript.settings && typeof newScript.settings === 'object'
    ? newScript.settings
    : {};

  return {
    ...existingRecord,
    id: newScript.id,
    code: newScript.code ?? (typeof existingRecord.code === 'string' ? existingRecord.code : ''),
    enabled: newScript.enabled !== false,
    position: asNumber(existingRecord.position) ?? position,
    meta: {
      ...existingMeta,
      name: newScript.name ?? newScript.id,
      namespace: getMetaString(meta, existingMeta, 'namespace'),
      version: newScript.version ?? '1.0',
      description: newScript.description ?? '',
      author: getMetaString(meta, existingMeta, 'author'),
      icon: getMetaString(meta, existingMeta, 'icon'),
      icon64: getMetaString(meta, existingMeta, 'icon64'),
      homepage: getMetaString(meta, existingMeta, 'homepage'),
      homepageURL: getMetaString(meta, existingMeta, 'homepageURL'),
      website: getMetaString(meta, existingMeta, 'website'),
      source: getMetaString(meta, existingMeta, 'source'),
      updateURL: getMetaString(meta, existingMeta, 'updateURL'),
      downloadURL: getMetaString(meta, existingMeta, 'downloadURL'),
      supportURL: getMetaString(meta, existingMeta, 'supportURL'),
      license: getMetaString(meta, existingMeta, 'license'),
      copyright: getMetaString(meta, existingMeta, 'copyright'),
      contributionURL: getMetaString(meta, existingMeta, 'contributionURL'),
      match: matches,
      include: getMetaArray(meta, existingMeta, 'include'),
      exclude: getMetaArray(meta, existingMeta, 'exclude'),
      excludeMatch: getMetaArray(meta, existingMeta, 'excludeMatch'),
      'run-at': (newScript.runAt ?? meta.runAt ?? 'document_idle').replace(/_/g, '-'),
      'inject-into': getMetaString(meta, existingMeta, 'inject-into', 'auto') || 'auto',
      noframes: getMetaBoolean(meta, existingMeta, 'noframes'),
      unwrap: getMetaBoolean(meta, existingMeta, 'unwrap'),
      sandbox: getMetaString(meta, existingMeta, 'sandbox'),
      'run-in': getMetaString(meta, existingMeta, 'run-in'),
      grant: (() => {
        const grants = getMetaArray(meta, existingMeta, 'grant');
        return grants.length > 0 ? grants : ['none'];
      })(),
      require: getMetaArray(meta, existingMeta, 'require'),
      requireProvenance: getMetaArray(meta, existingMeta, 'requireProvenance'),
      requireIdentity: getMetaArray(meta, existingMeta, 'requireIdentity'),
      resource: resources,
      connect: getMetaArray(meta, existingMeta, 'connect'),
      'top-level-await': getMetaBoolean(meta, existingMeta, 'top-level-await'),
      webRequest: existingMeta.webRequest ?? null,
      priority: asNumber(existingMeta.priority) ?? 0,
      antifeature: getMetaAntifeatureArray(meta, existingMeta),
      tag: getMetaArray(meta, existingMeta, 'tag'),
      compatible: getMetaArray(meta, existingMeta, 'compatible'),
      incompatible: getMetaArray(meta, existingMeta, 'incompatible')
    },
    settings: { ...existingSettings, ...incomingSettings },
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
      match: Array.isArray(meta.match) ? [...meta.match] : [],
      include: Array.isArray(meta.include) ? [...meta.include] : [],
      exclude: Array.isArray(meta.exclude) ? [...meta.exclude] : [],
      excludeMatch: Array.isArray(meta.excludeMatch) ? [...meta.excludeMatch] : [],
      grant: Array.isArray(meta.grant) && meta.grant.length > 0 ? [...meta.grant] : ['none'],
      require: Array.isArray(meta.require) ? [...meta.require] : [],
      requireProvenance: Array.isArray(meta.requireProvenance) ? [...meta.requireProvenance] : [],
      requireIdentity: Array.isArray(meta.requireIdentity) ? [...meta.requireIdentity] : [],
      resource: meta.resource ?? {},
      connect: Array.isArray(meta.connect) ? [...meta.connect] : [],
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

  if (script && script.enabled !== false && typeof hooks.autoReloadMatchingTabs === 'function') {
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
        // v3.0: ScriptStorage.init() runs the v2→v3 migration, so anything
        // that ever existed is now in IDB. A null result means the script
        // was never installed.
        return { error: 'Script not found', scriptId };
      }
      await ScriptStorage.set(scriptId, { ...script, enabled, updatedAt: Date.now() });

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
      const installedBy = describeSender(sender);
      const matches = selectInstallMatches(meta, externalFallbackMatches(sender));

      const scriptId = generateExternalScriptId();

      const newScript: FlatScript = {
        id: scriptId,
        name: meta.name ?? scriptId,
        version: meta.version ?? '1.0',
        description: meta.description ?? '',
        matches,
        code,
        enabled: false,
        installedAt: Date.now(),
        installedBy,
        runAt: meta.runAt ?? 'document_idle',
        settings: createExternalInstallReviewSettings('public-api-external', installedBy),
      };

      const store = await getScriptStore();
      const updatedStore = upsertScriptStore(store, newScript, meta, installedBy);

      // v3.0: persist through ScriptStorage so the IDB-backed store stays
      // authoritative. The legacy `userscripts` blob is migrated on first
      // init() and then ignored — direct chrome.storage writes would be
      // invisible to the dashboard.
      if (Array.isArray(updatedStore)) {
        // Array-mode legacy path — convert to nested record on the way in.
        await ScriptStorage.set(newScript.id, createNestedStoredScript(
          newScript, meta, installedBy, store.scripts.length, null
        ) as unknown as Parameters<typeof ScriptStorage.set>[1]);
      } else {
        const entry = updatedStore[newScript.id] ?? Object.values(updatedStore).find((v) => {
          const n = normalizeStoredScript(v);
          return n?.id === newScript.id;
        });
        if (entry) {
          await ScriptStorage.set(newScript.id, entry as unknown as Parameters<typeof ScriptStorage.set>[1]);
        }
      }
      await refreshRuntimeAfterMutation(newScript, meta);

      void fireWebhook('script.installed', { scriptId, name: newScript.name, version: newScript.version });
      return { ok: true, scriptId, name: newScript.name, enabled: false, reviewRequired: true };
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
    const m = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
    if (!m?.[1]) continue;
    const key = m[1].trim();
    const val = (m[2] || '').trim();

    if (key === 'antifeature' || key.startsWith('antifeature:')) {
      const locale = key.startsWith('antifeature:') ? key.slice('antifeature:'.length) : '';
      const parsedAntifeature = parseAntifeatureDirective(val, locale);
      if (parsedAntifeature) {
        meta.antifeature = meta.antifeature ?? [];
        meta.antifeature.push(parsedAntifeature);
      }
    } else if (BOOLEAN_META_KEYS.has(key)) {
      (meta as Record<string, unknown>)[key] = true;
    } else if (ARRAY_META_KEYS[key]) {
      if (val) appendMetaValue(meta, ARRAY_META_KEYS[key], val);
    } else if (key === 'resource') {
      const resourceMatch = val.match(/^(\S+)\s+(.+)$/);
      if (resourceMatch?.[1] && resourceMatch[2]) {
        meta.resource = meta.resource ?? {};
        meta.resource[resourceMatch[1]] = resourceMatch[2];
      }
    } else if (key === 'run-at') {
      if (val) meta.runAt = val.replace(/-/g, '_');
    } else {
      if (val) meta[key] = val;
    }
  }
  return meta;
}

/* ------------------------------------------------------------------ */
/*  Local MCP Bridge Prototype                                         */
/* ------------------------------------------------------------------ */

function mcpResponseType(type: string): string {
  return `${type}:response`;
}

function mcpEnvelope(msg: WebPageMessage, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    type: mcpResponseType(msg.type),
    requestId: typeof msg.requestId === 'string' ? msg.requestId : null,
    ...payload,
  };
}

function summarizeMcpScript(script: Record<string, unknown>): Record<string, unknown> {
  const meta = script.meta && typeof script.meta === 'object'
    ? script.meta as Record<string, unknown>
    : {};
  const id = typeof script.id === 'string' ? script.id : '';
  return {
    id,
    name: typeof meta.name === 'string' ? meta.name : (typeof script.name === 'string' ? script.name : id),
    version: typeof meta.version === 'string' ? meta.version : (typeof script.version === 'string' ? script.version : '1.0'),
    enabled: script.enabled !== false,
    matches: asStringArray(meta.match ?? script.matches ?? script.match),
    updatedAt: asNumber(script.updatedAt) ?? null,
  };
}

async function authorizeLocalMcpMessage(msg: WebPageMessage, origin: string): Promise<{ ok: true; origin: string } | { ok: false; error: string; result: string }> {
  let normalizedOrigin: string;
  try {
    normalizedOrigin = normalizeLocalMcpOrigin(origin);
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message || 'Local MCP origin must be loopback-only', result: 'mcp_non_loopback' };
  }
  if (!_localMcpBridge.enabled) {
    return { ok: false, error: 'Local MCP bridge is disabled', result: 'mcp_disabled' };
  }
  if (!_localMcpBridge.origins.includes(normalizedOrigin)) {
    return { ok: false, error: 'Local MCP origin is not allowed', result: 'mcp_origin_denied' };
  }
  if (!_localMcpBridge.tokenHash) {
    return { ok: false, error: 'Local MCP bridge token is not configured', result: 'mcp_token_missing' };
  }
  if (typeof msg.token !== 'string') {
    return { ok: false, error: 'Local MCP bearer token is required', result: 'mcp_token_denied' };
  }
  try {
    const tokenHash = await hashLocalMcpToken(msg.token);
    if (!constantTimeEqual(tokenHash, _localMcpBridge.tokenHash)) {
      return { ok: false, error: 'Local MCP bearer token rejected', result: 'mcp_token_denied' };
    }
  } catch {
    return { ok: false, error: 'Local MCP bearer token rejected', result: 'mcp_token_denied' };
  }
  return { ok: true, origin: normalizedOrigin };
}

const LOCAL_MCP_HANDLERS: Record<string, LocalMcpHandlerFn> = {
  'scriptvault:mcp:hello': async (_data: WebPageMessage, origin: string): Promise<Record<string, unknown>> => ({
    ok: true,
    name: 'ScriptVault Local MCP bridge',
    version: await getExtensionVersion(),
    origin,
    capabilities: LOCAL_MCP_CAPABILITIES.slice(),
  }),

  'scriptvault:mcp:listScripts': async (_data: WebPageMessage, _origin: string): Promise<Record<string, unknown>> => {
    const scripts = await ScriptStorage.getAll();
    return {
      ok: true,
      scripts: scripts.map(script => summarizeMcpScript(script as unknown as Record<string, unknown>)),
    };
  },

  'scriptvault:mcp:readScript': async (data: WebPageMessage, _origin: string): Promise<Record<string, unknown>> => {
    const scriptId = typeof data.scriptId === 'string' ? data.scriptId : '';
    if (!scriptId) return { error: 'Missing scriptId parameter' };
    const script = await ScriptStorage.get(scriptId);
    if (!script) return { error: 'Script not found', scriptId };
    return {
      ok: true,
      script: {
        ...summarizeMcpScript(script as unknown as Record<string, unknown>),
        code: typeof script.code === 'string' ? script.code : '',
        meta: script.meta && typeof script.meta === 'object' ? script.meta : {},
      },
    };
  },

  'scriptvault:mcp:writeScript': async (data: WebPageMessage, origin: string): Promise<Record<string, unknown>> => {
    const code = data.code;
    if (!code || typeof code !== 'string') return { error: 'Missing or invalid code parameter' };
    if (code.length > MAX_CODE_SIZE) return { error: 'Script code exceeds maximum allowed size (5 MB)' };
    if (!code.includes('==UserScript==')) return { error: 'Not a valid userscript (missing ==UserScript== header)' };

    const requestedId = typeof data.scriptId === 'string' && data.scriptId.trim() ? data.scriptId.trim() : '';
    const existing = requestedId ? await ScriptStorage.get(requestedId) : null;
    if (requestedId && !existing) return { error: 'Script not found', scriptId: requestedId };

    const allScripts = await ScriptStorage.getAll();
    const scriptId = requestedId || generateExternalScriptId();
    const meta = parseUserscriptMeta(code);
    const existingMeta = existing?.meta && typeof existing.meta === 'object'
      ? existing.meta as Record<string, unknown>
      : {};
    const matches = selectInstallMatches(meta, asStringArray(existingMeta.match));
    const installedBy = `local-mcp:${origin}`;
    const position = requestedId
      ? Math.max(0, allScripts.findIndex(script => script.id === scriptId))
      : allScripts.length;
    const enabled = existing
      ? (typeof data.enabled === 'boolean' ? data.enabled : existing.enabled !== false)
      : false;
    const now = Date.now();
    const newScript: FlatScript = {
      id: scriptId,
      name: meta.name ?? (typeof existingMeta.name === 'string' ? existingMeta.name : scriptId),
      version: meta.version ?? (typeof existingMeta.version === 'string' ? existingMeta.version : '1.0'),
      description: meta.description ?? (typeof existingMeta.description === 'string' ? existingMeta.description : ''),
      matches,
      code,
      enabled,
      installedAt: asNumber(existing?.createdAt) ?? now,
      installedBy,
      runAt: meta.runAt ?? (typeof existingMeta['run-at'] === 'string' ? String(existingMeta['run-at']).replace(/-/g, '_') : 'document_idle'),
      settings: existing
        ? (existing.settings && typeof existing.settings === 'object' ? existing.settings as Record<string, unknown> : {})
        : createExternalInstallReviewSettings('public-api-local-mcp', installedBy),
      updatedAt: now,
    };

    await ScriptStorage.set(scriptId, createNestedStoredScript(
      newScript,
      meta,
      installedBy,
      position,
      existing ? existing as unknown as Record<string, unknown> : null,
    ) as unknown as Parameters<typeof ScriptStorage.set>[1]);
    await refreshRuntimeAfterMutation(newScript, meta);

    void fireWebhook(existing ? 'script.updated' : 'script.installed', {
      scriptId,
      name: newScript.name,
      version: newScript.version,
      source: 'public-api-local-mcp',
    });
    return {
      ok: true,
      scriptId,
      name: newScript.name,
      enabled,
      created: !existing,
      reviewRequired: !existing,
    };
  },
};

async function dispatchLocalMcpMessage(msg: WebPageMessage, rawOrigin: string): Promise<Record<string, unknown>> {
  const handler = LOCAL_MCP_HANDLERS[msg.type];
  if (!handler) return mcpEnvelope(msg, { error: `Unknown Local MCP action: ${msg.type}` });

  const auth = await authorizeLocalMcpMessage(msg, rawOrigin);
  const sender = { origin: rawOrigin };
  if (!auth.ok) {
    audit(msg.type, sender, null, auth.result);
    return mcpEnvelope(msg, { error: auth.error });
  }

  const senderId = `mcp:${auth.origin}`;
  if (!checkRateLimit(senderId)) {
    audit(msg.type, { origin: auth.origin }, null, 'rate_limited');
    return mcpEnvelope(msg, { error: 'Rate limited. Max 10 requests per second.' });
  }

  try {
    const result = await handler(msg, auth.origin);
    audit(msg.type, { origin: auth.origin }, { requestId: msg.requestId ?? null }, result?.error ? 'error' : 'ok');
    return mcpEnvelope(msg, result);
  } catch (e: unknown) {
    audit(msg.type, { origin: auth.origin }, { requestId: msg.requestId ?? null }, 'exception');
    console.warn('[PublicAPI] Local MCP handler exception:', msg.type, e);
    return mcpEnvelope(msg, { error: 'Internal error' });
  }
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
    const urlError = validateWebInstallUrl(url);
    if (urlError) {
      return { type: 'scriptvault:install:response', error: urlError };
    }

    // Authorize before fetching to prevent SSRF
    const allowed = await authorize('installScript', { origin });
    if (!allowed) {
      return { type: 'scriptvault:install:response', error: 'Permission denied', action: 'installScript' };
    }

    // Fetch the script only after authorization
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let code = '';
      try {
        const resp: Response = await fetch(url, { signal: controller.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        if (resp.url) {
          const finalUrlError = validateWebInstallUrl(resp.url);
          if (finalUrlError) throw new Error(finalUrlError);
        }
        code = await readResponseTextBounded(resp, MAX_FETCH_SIZE);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!code.includes('==UserScript==')) {
        throw new Error('Not a valid userscript (missing ==UserScript== header)');
      }

      // Parse and install directly (authorization already checked above)
      const meta = parseUserscriptMeta(code);
      const installedBy = `origin:${origin}`;
      const matches = selectInstallMatches(meta, webFallbackMatches(origin));

      const scriptId = generateExternalScriptId();

      const newScript: FlatScript = {
        id: scriptId,
        name: meta.name ?? scriptId,
        version: meta.version ?? '1.0',
        description: meta.description ?? '',
        matches,
        code,
        enabled: false,
        installedAt: Date.now(),
        installedBy,
        runAt: meta.runAt ?? 'document_idle',
        settings: createExternalInstallReviewSettings('public-api-web', installedBy),
      };

      const store = await getScriptStore();
      const updatedStore = upsertScriptStore(store, newScript, meta, installedBy);

      // v3.0: route through ScriptStorage (IDB-backed) instead of writing the
      // legacy `userscripts` blob directly.
      if (Array.isArray(updatedStore)) {
        await ScriptStorage.set(newScript.id, createNestedStoredScript(
          newScript, meta, installedBy, store.scripts.length, null
        ) as unknown as Parameters<typeof ScriptStorage.set>[1]);
      } else {
        const entry = updatedStore[newScript.id] ?? Object.values(updatedStore).find((v) => {
          const n = normalizeStoredScript(v);
          return n?.id === newScript.id;
        });
        if (entry) {
          await ScriptStorage.set(newScript.id, entry as unknown as Parameters<typeof ScriptStorage.set>[1]);
        }
      }
      await refreshRuntimeAfterMutation(newScript, meta);

      void fireWebhook('script.installed', { scriptId, name: newScript.name, version: newScript.version });
      return { type: 'scriptvault:install:response', ok: true, scriptId, name: newScript.name, enabled: false, reviewRequired: true };
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

  const guardReason = isInternalWebhookUrl(hook.url);
  if (guardReason) {
    console.warn(`[PublicAPI] webhook ${eventType} blocked at fire time: ${guardReason}`);
    return;
  }

  let body: string;
  try {
    body = JSON.stringify({
      event: eventType,
      timestamp: Date.now(),
      version: API_VERSION,
      data: payload
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[PublicAPI] webhook ${eventType} payload serialization failed:`, message);
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
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

  // Extension sender trust gate: non-handshake actions require a trusted
  // extension ID when the sender is an extension (sender.id is set).
  // This prevents unknown extensions from reading script inventory.
  if (sender?.id && !HANDSHAKE_ACTIONS.has(action) && !isExtensionSenderTrusted(sender)) {
    audit(action, sender, null, 'untrusted_extension');
    return { error: 'Extension not trusted. Add this extension ID to trusted extensions in ScriptVault settings.', extensionId: sender.id };
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
    audit(action, sender, message, result?.['error'] ? 'error' : 'ok');
    return result;
  } catch (e: unknown) {
    audit(action, sender, message, 'exception');
    // Don't leak internal error details to external callers — log locally
    // for the operator and return a generic message so an external page
    // can't probe for stack frames / file paths / token hints via error text.
    console.warn('[PublicAPI] external handler exception:', action, e);
    return { error: 'Internal error' };
  }
}

async function dispatchWebMessagePayload(data: unknown, rawOrigin: string): Promise<Record<string, unknown> | null> {
  // Validate origin — deny-by-default when no trusted origins are configured
  const origin = normalizeIncomingOrigin(rawOrigin);
  let localMcpOrigin: string | null = null;
  try {
    localMcpOrigin = normalizeLocalMcpOrigin(rawOrigin);
  } catch {
    localMcpOrigin = null;
  }
  if (_trustedOrigins.length === 0 || !origin || !_trustedOrigins.includes(origin)) {
    if (!localMcpOrigin) return null; // ignore untrusted origins
  }

  if (!data || typeof data !== 'object' || !('type' in data)) return null;
  const msg = data as WebPageMessage;
  // Type guard: postMessage payloads can carry arbitrary structured-clone
  // data. We must require `data.type` to be a string before calling
  // `.startsWith`, otherwise a sender that passes `data.type = {}` triggers
  // a TypeError surfaced as an unhandled error on chrome://extensions.
  if (typeof msg.type !== 'string') return null;
  if (!msg.type.startsWith('scriptvault:')) return null;

  if (msg.type.startsWith('scriptvault:mcp:')) {
    try {
      return await dispatchLocalMcpMessage(msg, rawOrigin);
    } catch (e: unknown) {
      console.warn('[PublicAPI] Local MCP web handler error:', e);
      return null;
    }
  }

  if (!origin || _trustedOrigins.length === 0 || !_trustedOrigins.includes(origin)) {
    return null;
  }

  const senderId = `web:${origin}`;
  if (!checkRateLimit(senderId)) {
    // Silently drop rate-limited web messages
    return null;
  }

  const handler = WEB_HANDLERS[msg.type];
  if (!handler) return null;

  audit(msg.type, { origin }, msg, 'processing');

  try {
    return await handler(msg, origin);
  } catch (e: unknown) {
    console.warn('[PublicAPI] web handler error:', e);
    return null;
  }
}

function dispatchWebMessage(event: MessageEvent): void {
  void dispatchWebMessagePayload(event.data as unknown, event.origin).then(response => {
    if (response && event.source) {
      try {
        (event.source as WindowProxy).postMessage(
          response,
          event.origin
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
          try {
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
          } catch (err) {
            _initPromise = null;
            throw err;
          }
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
   * Handle a web page message payload relayed by a content script.
   */
  async handleWebMessagePayload(message: unknown, origin: string): Promise<Record<string, unknown> | null> {
    if (!_initialized) await this.init();
    return dispatchWebMessagePayload(message, origin);
  },

  /**
   * Handle a Local MCP bridge message manually (tests/local helper adapters).
   */
  async handleLocalMcpMessage(message: WebPageMessage, origin: string): Promise<Record<string, unknown>> {
    if (!_initialized) await this.init();
    return dispatchLocalMcpMessage(message, origin);
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

  getPermissions(): Record<string, PermissionLevel> {
    return { ...(_permissions || DEFAULT_PERMISSIONS) };
  },

  /**
   * Set trusted web page origins.
   */
  async setTrustedOrigins(origins: string[]): Promise<void> {
    _trustedOrigins = normalizeTrustedOrigins(origins);
    await saveTrustedOrigins();
  },

  /**
   * Get trusted web page origins.
   */
  getTrustedOrigins(): string[] {
    return _trustedOrigins.slice();
  },

  /**
   * Set trusted extension IDs for external message API access.
   */
  async setTrustedExtensionIds(ids: string[]): Promise<void> {
    _trustedExtensionIds = normalizeTrustedExtensionIds(ids);
    await saveTrustedExtensionIds();
  },

  /**
   * Get trusted extension IDs.
   */
  getTrustedExtensionIds(): string[] {
    return _trustedExtensionIds.slice();
  },

  /**
   * Configure the off-by-default Local MCP bridge prototype.
   */
  async setLocalMcpBridgeConfig(config: {
    enabled?: boolean;
    origins?: string[];
    token?: string;
    clearToken?: boolean;
  }): Promise<LocalMcpBridgePublicConfig> {
    return configureLocalMcpBridge(config);
  },

  /**
   * Return Local MCP bridge status without exposing token material.
   */
  getLocalMcpBridgeConfig(): LocalMcpBridgePublicConfig {
    return publicLocalMcpConfig();
  },

  /**
   * Configure a webhook for an event type.
   */
  async setWebhook(eventType: string, config: { url?: string; enabled?: boolean }): Promise<void> {
    if (!API_SCHEMA.webhookEvents.includes(eventType)) {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    const url = config.url ?? '';
    if (url) {
      if (!url.startsWith('https://')) {
        throw new Error('Webhook URL must use https://');
      }
      // Phase 5.5 — Reject RFC 1918 / loopback / link-local / IPv6 internal
      // hosts. Webhooks fire from the extension's network context, so a URL
      // pointing at the user's LAN is an SSRF vector for any web origin
      // that obtains capability-token access via PublicAPI.
      const reason = isInternalWebhookUrl(url);
      if (reason) {
        throw new Error('Webhook URL points at internal/loopback host: ' + reason);
      }
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
export type { AuditEntry, WebhookConfig, PermissionLevel, APISchemaType, FlatScript, LocalMcpBridgePublicConfig };
