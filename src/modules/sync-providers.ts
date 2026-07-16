// ============================================================================
// Cloud Sync Providers — strict TypeScript migration
// ============================================================================

import type { Settings } from '../types/index';
import {
  classifyFetchUrl,
  classifyResponseUrl,
  type InternalHostCheckResult,
} from '../background/internal-host-guard';

declare const SettingsManager: {
  get(): Promise<Settings>;
  set(key: keyof Settings | Partial<Settings>, value?: Settings[keyof Settings]): Promise<Settings>;
};

declare const LocalWorkspaceBindings: {
  get(bindingId: string): Promise<LocalFolderBindingSummary | null>;
  getHandle(bindingId: string): Promise<LocalFolderDirectoryHandle | null>;
  delete(bindingId: string): Promise<void>;
};

/** Helper to get full Settings object with correct type (works around conditional return). */
async function getRawSettings(): Promise<Settings> {
  return SettingsManager.get() as unknown as Promise<Settings>;
}

async function getSettings(): Promise<Settings> {
  return SyncCredentialStore.resolveSettings(await getRawSettings());
}

// ============================================================================
// Types
// ============================================================================

interface SyncUploadResult {
  success: boolean;
  timestamp: number;
}

interface SyncTestResult {
  success: boolean;
  error?: string;
}

interface SyncConnectResult {
  success: boolean;
  error?: string;
  user?: { email: string; name: string; picture?: string };
  token?: string;
  refreshToken?: string;
}

interface SyncDisconnectResult {
  success: boolean;
}

interface SyncStatusResult {
  connected: boolean;
  user?: { email: string; name: string };
  status?: string;
  error?: string | null;
  endpointHost?: string;
}

interface SyncRequestOptions {
  signal?: AbortSignal;
  objectName?: string;
}

interface SyncStorageDisclosureField {
  key: string;
  label: string;
  type: 'token' | 'credential' | 'metadata';
  present: boolean;
}

interface SyncStorageDisclosure {
  storage: 'chrome.storage.local' | 'chrome.storage.session' | 'memory-session';
  credentialStorageMode: 'local' | 'session';
  sessionFallback: boolean;
  reconnectRequired: boolean;
  protection: string;
  fields: SyncStorageDisclosureField[];
  hasStoredSecrets: boolean;
  revokeAction: string;
  notes: string;
}

interface SyncStorageDisclosureConfig {
  fields: Array<{
    key: string;
    label: string;
    type?: SyncStorageDisclosureField['type'];
  }>;
  revokeAction: string;
  notes?: string;
}

interface SyncEndpointGuardOptions {
  label: string;
  allowInternalEndpoint?: boolean;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface LocalFolderBindingSummary {
  bindingId: string;
  scriptId: string;
  displayName?: string;
  permissionState?: string;
  updatedAt?: number;
}

interface LocalFolderFile {
  text(): Promise<string>;
  size?: number;
  lastModified?: number;
}

interface LocalFolderFileWritable {
  write(data: string): Promise<void> | void;
  close(): Promise<void> | void;
}

interface LocalFolderFileHandle {
  name?: string;
  getFile(): Promise<LocalFolderFile>;
  createWritable(): Promise<LocalFolderFileWritable>;
}

interface LocalFolderDirectoryHandle {
  kind?: string;
  name?: string;
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<string>;
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<string>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFolderFileHandle>;
}

const SYNC_SESSION_CREDENTIALS_KEY = 'sv_sync_session_credentials';
const LOCAL_FOLDER_SYNC_BINDING_ID = 'sync_local_folder';
const LOCAL_FOLDER_SYNC_FILE_NAME = 'scriptvault-backup.json';

const SYNC_CREDENTIAL_DEFAULTS = {
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  googleDriveToken: '',
  googleDriveRefreshToken: '',
  googleClientId: '',
  googleDriveConnected: false,
  googleDriveUser: null,
  dropboxToken: '',
  dropboxRefreshToken: '',
  dropboxClientId: '',
  dropboxUser: null,
  onedriveToken: '',
  onedriveRefreshToken: '',
  onedriveClientId: '',
  onedriveConnected: false,
  onedriveUser: null,
  s3Endpoint: '',
  s3Region: '',
  s3Bucket: '',
  s3AccessKeyId: '',
  s3SecretKey: '',
  s3ObjectKey: '',
  syncEncryptionPassphrase: '',
} satisfies Partial<Record<keyof Settings, unknown>>;

type SyncCredentialKey = keyof typeof SYNC_CREDENTIAL_DEFAULTS;

const SYNC_CREDENTIAL_KEYS = Object.keys(SYNC_CREDENTIAL_DEFAULTS) as SyncCredentialKey[];
const _sessionCredentialMemoryFallback: Partial<Record<SyncCredentialKey, unknown>> = {};

function hasStorageSession(): boolean {
  return typeof chrome !== 'undefined' &&
    typeof chrome.storage?.session?.get === 'function' &&
    typeof chrome.storage.session.set === 'function' &&
    typeof chrome.storage.session.remove === 'function';
}

function cloneSyncCredentialValue<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value) as T;
    } catch (_) {
      // Fall through.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (_) {
    return (Array.isArray(value) ? [...value] : { ...(value as object) }) as T;
  }
}

function isSyncCredentialKey(key: string): key is SyncCredentialKey {
  return Object.prototype.hasOwnProperty.call(SYNC_CREDENTIAL_DEFAULTS, key);
}

function pickSyncCredentialPatch(update: Partial<Settings>): Partial<Record<SyncCredentialKey, unknown>> {
  const patch: Partial<Record<SyncCredentialKey, unknown>> = {};
  for (const key of SYNC_CREDENTIAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(update, key)) {
      patch[key] = cloneSyncCredentialValue((update as Record<string, unknown>)[key]);
    }
  }
  return patch;
}

function hasAnySyncCredentialPatchValue(patch: Partial<Record<SyncCredentialKey, unknown>>): boolean {
  return Object.keys(patch).length > 0;
}

async function readSessionCredentials(): Promise<Partial<Record<SyncCredentialKey, unknown>>> {
  if (!hasStorageSession()) return { ..._sessionCredentialMemoryFallback };
  try {
    const data = await chrome.storage.session.get(SYNC_SESSION_CREDENTIALS_KEY);
    const value = data?.[SYNC_SESSION_CREDENTIALS_KEY];
    return value && typeof value === 'object'
      ? { ...(value as Partial<Record<SyncCredentialKey, unknown>>) }
      : {};
  } catch (_) {
    return { ..._sessionCredentialMemoryFallback };
  }
}

async function writeSessionCredentials(patch: Partial<Record<SyncCredentialKey, unknown>>): Promise<void> {
  if (!hasAnySyncCredentialPatchValue(patch)) return;
  const current = await readSessionCredentials();
  const next = { ...current, ...patch };
  Object.assign(_sessionCredentialMemoryFallback, next);
  if (!hasStorageSession()) return;
  try {
    await chrome.storage.session.set({ [SYNC_SESSION_CREDENTIALS_KEY]: next });
  } catch (_) {
    // The memory fallback preserves behavior for the current extension runtime.
  }
}

async function clearSessionCredentials(): Promise<void> {
  for (const key of Object.keys(_sessionCredentialMemoryFallback)) {
    delete _sessionCredentialMemoryFallback[key as SyncCredentialKey];
  }
  if (!hasStorageSession()) return;
  try {
    await chrome.storage.session.remove(SYNC_SESSION_CREDENTIALS_KEY);
  } catch (_) {
    // Best effort. Persistent settings are still scrubbed by the caller.
  }
}

function buildPersistentCredentialScrub(): Partial<Settings> {
  const scrub: Partial<Settings> = {};
  for (const key of SYNC_CREDENTIAL_KEYS) {
    (scrub as Record<string, unknown>)[key] = cloneSyncCredentialValue(SYNC_CREDENTIAL_DEFAULTS[key]);
  }
  return scrub;
}

export const SyncCredentialStore = {
  sessionKey: SYNC_SESSION_CREDENTIALS_KEY,
  credentialKeys: SYNC_CREDENTIAL_KEYS,

  storageKind(): SyncStorageDisclosure['storage'] {
    return hasStorageSession() ? 'chrome.storage.session' : 'memory-session';
  },

  async resolveSettings(settings: Settings): Promise<Settings> {
    if (settings.syncCredentialsSessionOnly !== true) return settings;
    const sessionCredentials = await readSessionCredentials();
    return {
      ...settings,
      ...(sessionCredentials as Partial<Settings>),
    };
  },

  async persistSettingsUpdate(
    update: Partial<Settings>,
    baseSettings?: Settings,
  ): Promise<Settings> {
    const rawBase = baseSettings ?? (await getRawSettings());
    const updateRecord = update as Record<string, unknown>;

    if (update.syncCredentialsSessionOnly === false) {
      const sessionCredentials = await readSessionCredentials();
      await clearSessionCredentials();
      return SettingsManager.set({
        ...(sessionCredentials as Partial<Settings>),
        ...update,
      });
    }

    const sessionOnly = update.syncCredentialsSessionOnly === true ||
      rawBase.syncCredentialsSessionOnly === true;
    if (!sessionOnly) {
      return SettingsManager.set(update);
    }

    const sessionPatch = pickSyncCredentialPatch(update);
    const persistentUpdate: Partial<Settings> = { ...update };

    for (const key of SYNC_CREDENTIAL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(updateRecord, key)) {
        (persistentUpdate as Record<string, unknown>)[key] =
          cloneSyncCredentialValue(SYNC_CREDENTIAL_DEFAULTS[key]);
      }
    }

    if (update.syncCredentialsSessionOnly === true) {
      Object.assign(persistentUpdate, buildPersistentCredentialScrub());
      const rawBaseRecord = rawBase as unknown as Record<string, unknown>;
      for (const key of SYNC_CREDENTIAL_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(sessionPatch, key) &&
            hasStoredSyncValue(rawBaseRecord[key])) {
          sessionPatch[key] = cloneSyncCredentialValue(rawBaseRecord[key]);
        }
      }
    }

    await writeSessionCredentials(sessionPatch);
    const persistent = await SettingsManager.set(persistentUpdate);
    return this.resolveSettings(persistent);
  },

  async clearSessionCredentials(): Promise<void> {
    await clearSessionCredentials();
  },
};

function getRequiredWebDavBaseUrl(settings: Pick<Settings, 'webdavUrl'>): string {
  const baseUrl = settings.webdavUrl?.trim();
  if (!baseUrl) throw new Error('WebDAV URL is required');
  return baseUrl.replace(/\/$/, '');
}

function allowsInternalSyncEndpoints(settings: Partial<Settings>): boolean {
  return settings.allowInternalSyncEndpoints === true;
}

// Resolve an optional remote object name override. Cloud backup passes this as
// a provider call option so it can write a distinct object without pretending
// the filename is a persisted setting. The name is sanitized to a bare filename.
function resolveRemoteObjectName(objectName: string | undefined, defaultName: string): string {
  const override = objectName;
  if (typeof override === 'string' && override.trim()) {
    // Strip path separators and any leading dots so the override is always a
    // bare filename (no traversal, no hidden-file trickery).
    const cleaned = override.trim().replace(/[^A-Za-z0-9._-]+/g, '').replace(/^\.+/, '');
    if (cleaned) return cleaned;
  }
  return defaultName.replace(/^\/+/, '');
}

function syncEndpointMessage(prefix: string, result: InternalHostCheckResult): string {
  return `${prefix}: ${result.message || 'rejected URL'}`;
}

function assertSyncEndpointAllowed(
  url: string,
  options: SyncEndpointGuardOptions,
): void {
  if (options.allowInternalEndpoint === true) return;
  const preCheck = classifyFetchUrl(url, ['http:', 'https:']);
  if (!preCheck.ok) {
    throw new Error(syncEndpointMessage(`${options.label} URL rejected`, preCheck));
  }
}

function assertSyncResponseAllowed(
  response: Response,
  options: SyncEndpointGuardOptions,
): void {
  if (options.allowInternalEndpoint === true) return;
  const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
  if (!postCheck.ok) {
    throw new Error(syncEndpointMessage(`${options.label} redirected to internal host`, postCheck));
  }
}

function getWebDavAuthHeader(
  settings: Pick<Settings, 'webdavUsername' | 'webdavPassword'>,
): string {
  const credentials = `${settings.webdavUsername}:${settings.webdavPassword}`;
  const bytes = new TextEncoder().encode(credentials);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

function generateOAuthState(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (b: number) => b.toString(16).padStart(2, '0'),
  ).join('');
}

function hasStoredSyncValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null && value !== false;
}

function syncStorageDisclosure(
  settings: Partial<Settings> | undefined,
  config: SyncStorageDisclosureConfig,
): SyncStorageDisclosure {
  const settingsRecord = (settings ?? {}) as Record<string, unknown>;
  const sessionOnly = (settings as Partial<Settings> | undefined)?.syncCredentialsSessionOnly === true;
  const fields = config.fields.map((field): SyncStorageDisclosureField => ({
    key: field.key,
    label: field.label,
    type: field.type ?? 'metadata',
    present: hasStoredSyncValue(settingsRecord[field.key]),
  }));
  const storage = sessionOnly ? SyncCredentialStore.storageKind() : 'chrome.storage.local';
  const sessionFallback = sessionOnly && storage === 'memory-session';
  return {
    storage,
    credentialStorageMode: sessionOnly ? 'session' : 'local',
    sessionFallback,
    reconnectRequired: sessionOnly,
    protection: sessionOnly
      ? (sessionFallback
          ? 'Current-runtime memory fallback; credentials are not written to persistent settings and must be re-entered after reload or browser restart.'
          : 'Session-scoped extension storage; credentials are cleared by browser restart and are not written to persistent settings.')
      : 'Extension-scoped browser storage; ScriptVault does not add a second encryption layer.',
    fields,
    hasStoredSecrets: fields.some((field) => field.present && field.type !== 'metadata'),
    revokeAction: config.revokeAction,
    notes: sessionOnly
      ? `${config.notes ?? ''} Browser restart requires reconnecting or re-entering credentials.`.trim()
      : config.notes ?? '',
  };
}

function isExpectedMissingLocalFolderFileError(error: unknown): boolean {
  const value = error as { name?: string; message?: string };
  const name = String(value?.name || '').toLowerCase();
  const message = String(value?.message || '').toLowerCase();
  return name.includes('notfound') ||
    name.includes('not_found') ||
    message.includes('not found') ||
    message.includes('no such file');
}

async function queryLocalFolderPermission(
  handle: LocalFolderDirectoryHandle,
  mode: 'read' | 'readwrite',
): Promise<string> {
  if (typeof handle.queryPermission !== 'function') return 'unknown';
  try {
    const result = await handle.queryPermission({ mode });
    return result === 'granted' || result === 'prompt' || result === 'denied'
      ? result
      : 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

async function requestLocalFolderPermission(
  handle: LocalFolderDirectoryHandle,
  mode: 'read' | 'readwrite',
): Promise<string> {
  if (typeof handle.requestPermission !== 'function') {
    return queryLocalFolderPermission(handle, mode);
  }
  try {
    const result = await handle.requestPermission({ mode });
    return result === 'granted' || result === 'prompt' || result === 'denied'
      ? result
      : 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

function assertLocalWorkspaceBindingsAvailable(): void {
  if (
    typeof LocalWorkspaceBindings === 'undefined' ||
    typeof LocalWorkspaceBindings.getHandle !== 'function'
  ) {
    throw new Error('Local folder sync is not available in this build');
  }
}

async function getLocalFolderSyncHandle(options: {
  requestPermission?: boolean;
  mode?: 'read' | 'readwrite';
} = {}): Promise<LocalFolderDirectoryHandle> {
  assertLocalWorkspaceBindingsAvailable();
  const mode = options.mode ?? 'read';
  const handle = await LocalWorkspaceBindings.getHandle(LOCAL_FOLDER_SYNC_BINDING_ID);
  if (!handle) {
    throw new Error('Choose a local sync folder before syncing');
  }
  if (handle.kind && handle.kind !== 'directory') {
    throw new Error('Stored local sync handle is not a directory');
  }
  if (typeof handle.getFileHandle !== 'function') {
    throw new Error('Stored local sync folder handle is unavailable');
  }

  let permission = await queryLocalFolderPermission(handle, mode);
  if (permission !== 'granted' && options.requestPermission) {
    permission = await requestLocalFolderPermission(handle, mode);
  }
  if (permission === 'denied') {
    throw new Error('Local sync folder permission was denied');
  }
  if (permission !== 'granted' && options.requestPermission) {
    throw new Error('Local sync folder permission was not granted');
  }
  return handle;
}

async function readLocalFolderSyncFile(
  handle: LocalFolderDirectoryHandle,
  fileName: string,
): Promise<string | null> {
  try {
    const fileHandle = await handle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const fileSize = typeof file.size === 'number' ? file.size : 0;
    if (fileSize > SYNC_PAYLOAD_MAX_BYTES) {
      throw new Error(`Local sync backup exceeds the ${Math.round(SYNC_PAYLOAD_MAX_BYTES / 1024 / 1024)} MB limit`);
    }
    return await file.text();
  } catch (error) {
    if (isExpectedMissingLocalFolderFileError(error)) return null;
    throw error;
  }
}

async function writeLocalFolderSyncFile(
  handle: LocalFolderDirectoryHandle,
  fileName: string,
  text: string,
): Promise<void> {
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > SYNC_PAYLOAD_MAX_BYTES) {
    throw new Error(`Local sync backup exceeds the ${Math.round(SYNC_PAYLOAD_MAX_BYTES / 1024 / 1024)} MB limit`);
  }
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(text);
  } finally {
    await writable.close();
  }
}

async function _oauthFetchWithTimeout(
  url: string,
  init: RequestInit,
  providerLabel: string,
  timeoutMs = 15_000,
): Promise<Response | null> {
  const externalSignal = init.signal;
  const { signal: _ignoredSignal, ...fetchInit } = init;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
  try {
    return await fetch(url, { ...fetchInit, signal });
  } catch (e: unknown) {
    const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
    const message = e instanceof Error ? e.message : String(e);
    if (name === 'AbortError' || name === 'TimeoutError' || /aborted|timed?\s*out/i.test(message)) {
      console.warn(`[CloudSync] ${providerLabel} token refresh timed out after ${timeoutMs}ms`);
      return null;
    }
    console.warn(`[CloudSync] ${providerLabel} token refresh network error:`, message);
    return null;
  }
}

/**
 * Wraps `fetch` with an AbortController timeout.
 * Prevents service worker hangs caused by slow or unresponsive cloud API endpoints.
 * @param url - Request URL
 * @param options - Standard RequestInit options; a caller signal is composed with the timeout
 * @param timeoutMs - Abort after this many milliseconds (default: 30 000)
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
  guardOptions: SyncEndpointGuardOptions = { label: 'Cloud sync endpoint' },
): Promise<Response> {
  assertSyncEndpointAllowed(url, guardOptions);
  const externalSignal = options.signal;
  const { signal: _ignoredSignal, ...fetchOptions } = options;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
  const response = await fetch(url, { ...fetchOptions, signal });
  assertSyncResponseAllowed(response, guardOptions);
  return response;
}

const SYNC_PAYLOAD_MAX_BYTES = 64 * 1024 * 1024;
const SYNC_METADATA_MAX_BYTES = 4 * 1024 * 1024;
const SYNC_ERROR_MAX_BYTES = 256 * 1024;

async function readSyncTextBounded(response: Response, maxBytes: number, label: string): Promise<string> {
  const declared = Number.parseInt(response.headers?.get?.('content-length') || '0', 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
  }
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
    }
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        try { await reader.cancel(); } catch { /* stream already closed */ }
        throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    try { reader.releaseLock(); } catch { /* stream already released */ }
  }
}

async function readSyncJsonBounded(response: Response, maxBytes: number, label: string): Promise<unknown> {
  if (!response.body?.getReader) {
    throw new Error(`${label} cannot be read safely because the response body is not streamable`);
  }
  const text = await readSyncTextBounded(response, maxBytes, label);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

// ============================================================================
// Local Folder Provider
// ============================================================================

const localfolder = {
  name: 'Local Folder' as const,
  icon: 'Folder' as const,
  requiresOAuth: false as const,
  fileName: LOCAL_FOLDER_SYNC_FILE_NAME,
  supportsManualSync: true as const,
  supportsDryRun: true as const,

  getStorageDisclosure(): SyncStorageDisclosure {
    return {
      storage: 'chrome.storage.local',
      credentialStorageMode: 'local',
      sessionFallback: false,
      reconnectRequired: false,
      protection: 'A browser File System Access directory handle is stored in extension IndexedDB; sync data stays in the folder you choose.',
      fields: [
        {
          key: LOCAL_FOLDER_SYNC_BINDING_ID,
          label: 'Selected local sync folder handle',
          type: 'metadata',
          present: true,
        },
      ],
      hasStoredSecrets: false,
      revokeAction: 'Forget the local sync folder handle stored in extension IndexedDB.',
      notes: `Reads and writes ${LOCAL_FOLDER_SYNC_FILE_NAME} in the selected folder.`,
    };
  },

  async upload(
    data: unknown,
    _settings: Settings,
    opts: SyncRequestOptions = {},
  ): Promise<SyncUploadResult> {
    const handle = await getLocalFolderSyncHandle({
      requestPermission: true,
      mode: 'readwrite',
    });
    const fileName = resolveRemoteObjectName(opts.objectName, this.fileName);
    await writeLocalFolderSyncFile(handle, fileName, JSON.stringify(data, null, 2));
    return { success: true, timestamp: Date.now() };
  },

  async download(
    _settings: Settings,
    opts: SyncRequestOptions = {},
  ): Promise<unknown | null> {
    const handle = await getLocalFolderSyncHandle({ mode: 'read' });
    const fileName = resolveRemoteObjectName(opts.objectName, this.fileName);
    const text = await readLocalFolderSyncFile(handle, fileName);
    if (text == null || !text.trim()) return null;
    return JSON.parse(text) as unknown;
  },

  async test(): Promise<SyncTestResult> {
    try {
      const handle = await getLocalFolderSyncHandle({ mode: 'read' });
      const permission = await queryLocalFolderPermission(handle, 'readwrite');
      if (permission === 'denied') {
        return { success: false, error: 'Local sync folder permission was denied' };
      }
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async getStatus(): Promise<SyncStatusResult> {
    try {
      assertLocalWorkspaceBindingsAvailable();
      const binding = await LocalWorkspaceBindings.get(LOCAL_FOLDER_SYNC_BINDING_ID);
      if (!binding) {
        return {
          connected: false,
          status: 'not_configured',
          error: 'Choose a local sync folder before syncing',
        };
      }
      const handle = await LocalWorkspaceBindings.getHandle(LOCAL_FOLDER_SYNC_BINDING_ID);
      if (!handle) {
        return {
          connected: false,
          status: 'handle_missing',
          error: 'Local sync folder handle is unavailable',
        };
      }
      const permission = await queryLocalFolderPermission(handle, 'readwrite');
      return {
        connected: permission === 'granted',
        status: permission === 'granted' ? 'ok' : permission,
        error: permission === 'denied' ? 'Local sync folder permission was denied' : null,
        user: { email: '', name: binding.displayName || handle.name || 'Local sync folder' },
      };
    } catch (e: unknown) {
      return {
        connected: false,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },

  async disconnect(): Promise<SyncDisconnectResult> {
    assertLocalWorkspaceBindingsAvailable();
    await LocalWorkspaceBindings.delete(LOCAL_FOLDER_SYNC_BINDING_ID);
    return { success: true };
  },
};

// ============================================================================
// WebDAV Provider
// ============================================================================

const webdav = {
  name: 'WebDAV' as const,
  icon: '☁️' as const,
  requiresAuth: true as const,
  supportsManualSync: true as const,
  supportsDryRun: true as const,
  _lastSyncEtag: undefined as string | null | undefined,
  _lastSyncEtagKey: '' as string,

  getStorageDisclosure(settings: Partial<Settings> = {}): SyncStorageDisclosure {
    return syncStorageDisclosure(settings, {
      fields: [
        { key: 'webdavUrl', label: 'WebDAV endpoint URL', type: 'metadata' },
        { key: 'webdavUsername', label: 'WebDAV username', type: 'credential' },
        { key: 'webdavPassword', label: 'WebDAV password', type: 'credential' },
      ],
      revokeAction: 'Clear the saved WebDAV endpoint, username, and password from local extension storage.',
      notes: 'WebDAV Basic credentials are sent only to the configured server during sync.',
    });
  },

  async upload(data: unknown, settings: Settings, opts: SyncRequestOptions = {}): Promise<SyncUploadResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const objectName = resolveRemoteObjectName(opts.objectName, 'scriptvault-backup.json');
    const url = `${getRequiredWebDavBaseUrl(effectiveSettings)}/${objectName}`;
    const auth = getWebDavAuthHeader(effectiveSettings);
    const guardOptions = {
      label: 'WebDAV sync endpoint',
      allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings),
    };

    const headers: Record<string, string> = {
      'Authorization': auth,
      'Content-Type': 'application/json',
    };
    const lastEtag = this._lastSyncEtagKey === objectName ? this._lastSyncEtag : undefined;
    if (typeof lastEtag === 'string') headers['If-Match'] = lastEtag;
    else if (lastEtag === null) headers['If-None-Match'] = '*';

    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
      signal: opts.signal,
    }, 60_000, guardOptions);

    if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
    this._lastSyncEtag = response.headers?.get('ETag') || this._lastSyncEtag;
    this._lastSyncEtagKey = objectName;
    return { success: true, timestamp: Date.now() };
  },

  async download(settings: Settings, opts: SyncRequestOptions = {}): Promise<unknown | null> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const objectName = resolveRemoteObjectName(opts.objectName, 'scriptvault-backup.json');
    const url = `${getRequiredWebDavBaseUrl(effectiveSettings)}/${objectName}`;
    const auth = getWebDavAuthHeader(effectiveSettings);
    const guardOptions = {
      label: 'WebDAV sync endpoint',
      allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings),
    };

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Authorization': auth },
      signal: opts.signal,
    }, 60_000, guardOptions);

    if (response.status === 404) {
      this._lastSyncEtag = null;
      this._lastSyncEtagKey = objectName;
      return null;
    }
    if (!response.ok) throw new Error(`WebDAV download failed: HTTP ${response.status}`);

    this._lastSyncEtag = response.headers?.get('ETag') || undefined;
    this._lastSyncEtagKey = objectName;
    return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, 'WebDAV sync payload');
  },

  async test(settings: Settings): Promise<SyncTestResult> {
    try {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const url = getRequiredWebDavBaseUrl(effectiveSettings);
      const auth = getWebDavAuthHeader(effectiveSettings);
      const guardOptions = {
        label: 'WebDAV sync endpoint',
        allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings),
      };

      const response = await fetchWithTimeout(url, {
        method: 'PROPFIND',
        headers: { 'Authorization': auth, 'Depth': '0' },
      }, 15_000, guardOptions);

      return { success: response.ok || response.status === 207 };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  },

  async getStatus(settings: Settings): Promise<SyncStatusResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    if (!effectiveSettings.webdavUrl) {
      return {
        connected: false,
        status: 'missing_config',
        error: 'WebDAV URL is not configured',
      };
    }
    const result = await this.test(effectiveSettings);
    let endpointHost = '';
    try {
      endpointHost = new URL(effectiveSettings.webdavUrl).host;
    } catch {
      // Invalid URL details are surfaced through test().
    }
    return {
      connected: result.success === true,
      status: result.success === true ? 'ok' : 'error',
      error: result.error ?? null,
      user: {
        email: '',
        name: effectiveSettings.webdavUsername || endpointHost || 'WebDAV',
      },
      endpointHost,
    };
  },

  async disconnect(): Promise<SyncDisconnectResult> {
    await SyncCredentialStore.clearSessionCredentials();
    await SettingsManager.set({
      webdavUrl: '',
      webdavUsername: '',
      webdavPassword: '',
    });
    return { success: true };
  },
};

// ============================================================================
// Google Drive Provider
// ============================================================================

const googledrive = {
  name: 'Google Drive' as const,
  icon: '📁' as const,
  requiresOAuth: true as const,
  fileName: 'scriptvault-backup.json' as const,
  supportsManualSync: true as const,
  supportsDryRun: true as const,
  // Google OAuth client ID (public, installed-app type)
  // Users can override via settings.googleClientId
  clientId: '287129963438-mcc1mod1m5jm8vjr3icb7ensdtcfq44l.apps.googleusercontent.com' as const,
  _lastSyncEtag: undefined as string | null | undefined,
  _lastSyncEtagKey: '' as string,

  getStorageDisclosure(settings: Partial<Settings> = {}): SyncStorageDisclosure {
    return syncStorageDisclosure(settings, {
      fields: [
        { key: 'googleDriveToken', label: 'Google Drive access token', type: 'token' },
        { key: 'googleDriveRefreshToken', label: 'Google Drive refresh token', type: 'token' },
        { key: 'googleClientId', label: 'Optional Google OAuth client ID override', type: 'metadata' },
        { key: 'googleDriveUser', label: 'Connected Google account label', type: 'metadata' },
      ],
      revokeAction: 'Ask Google to revoke the current access token when available, then clear Google tokens and account metadata.',
      notes: 'Tokens are scoped to Drive file access and Google profile/email lookup for the configured backup file.',
    });
  },

  async getToken(): Promise<string | null> {
    const settings = await getSettings();
    return settings.googleDriveToken || null;
  },

  async refreshToken(settings?: Settings, opts: SyncRequestOptions = {}): Promise<string | null> {
    const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
    const refreshTok = currentSettings.googleDriveRefreshToken;
    if (!refreshTok) return null;

    const clientId = currentSettings.googleClientId || this.clientId;
    const resp = await _oauthFetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: opts.signal,
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshTok,
      }),
    }, 'Google');
    if (!resp) return null;

    if (!resp.ok) {
      console.warn('[CloudSync] Google token refresh failed:', resp.status);
      return null;
    }
    const data: { access_token?: string; refresh_token?: string } = await resp.json();
    if (data.access_token) {
      await SyncCredentialStore.persistSettingsUpdate({
        googleDriveToken: data.access_token,
        googleDriveConnected: true,
      }, currentSettings);
      if (data.refresh_token) {
        await SyncCredentialStore.persistSettingsUpdate({ googleDriveRefreshToken: data.refresh_token }, currentSettings);
      }
      return data.access_token;
    }
    return null;
  },

  async getValidToken(settings?: Settings, opts: SyncRequestOptions = {}): Promise<string | null> {
    const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
    let token = currentSettings.googleDriveToken || null;
    if (!token) {
      return await this.refreshToken(currentSettings, opts);
    }

    try {
      // Test if token is still valid
      const test = await _oauthFetchWithTimeout('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: opts.signal,
      }, 'Google Drive', 10_000);

      if (!test) return token;
      if (test.ok) return token;
      if (test.status === 401 || test.status === 403) {
        return await this.refreshToken(currentSettings, opts);
      }
      return token;
    } catch (_e: unknown) {
      return token;
    }
  },

  async connect(): Promise<SyncConnectResult> {
    try {
      const settings = await getSettings();
      const clientId = settings.googleClientId || this.clientId;
      const redirectUri = chrome.identity.getRedirectURL();
      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ].join(' ');

      // PKCE code verifier
      const codeVerifier = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b: number) => b.toString(16).padStart(2, '0'),
      ).join('');
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const state = generateOAuthState();

      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scopes,
          access_type: 'offline',
          prompt: 'consent',
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          state,
        }).toString();

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });
      if (!responseUrl) throw new Error('No response from auth flow');

      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) {
        throw new Error('OAuth state mismatch - possible CSRF attack');
      }
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorization code received');

      // Exchange code for tokens
      const tokenResp = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code: code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      }, 15_000);

      if (!tokenResp.ok) {
        const err = await tokenResp.text();
        throw new Error('Token exchange failed: ' + err);
      }

      const tokens: { access_token: string; refresh_token?: string } = await tokenResp.json();

      // Get user info
      const userResp = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      }, 10_000);
      const user: { email?: string; name?: string; picture?: string } = userResp.ok
        ? await userResp.json()
        : {};

      await SyncCredentialStore.persistSettingsUpdate({
        googleDriveToken: tokens.access_token,
        googleDriveRefreshToken:
          tokens.refresh_token || settings.googleDriveRefreshToken || '',
        googleDriveConnected: true,
        googleDriveUser: { email: user.email ?? '', name: user.name ?? '' },
      }, settings);

      return {
        success: true,
        user: { email: user.email ?? '', name: user.name ?? '', picture: user.picture },
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  },

  async disconnect(): Promise<SyncDisconnectResult> {
    try {
      const token = await this.getToken();
      if (token) {
        fetchWithTimeout(`https://accounts.google.com/o/oauth2/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `token=${encodeURIComponent(token)}`,
        }, 10_000).catch(() => {});
      }
      await SyncCredentialStore.clearSessionCredentials();
      await SettingsManager.set({
        googleDriveToken: '',
        googleDriveRefreshToken: '',
        googleDriveConnected: false,
        googleDriveUser: null,
      });
    } catch (e: unknown) {
      console.warn('[CloudSync] Google disconnect error:', e);
    }
    return { success: true };
  },

  async findFile(token: string, objectName?: string, opts: SyncRequestOptions = {}): Promise<GoogleDriveFile | null> {
    // Search in root and appDataFolder
    const safeName = (objectName || this.fileName).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const query = encodeURIComponent(`name='${safeName}' and trashed=false`);
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
      { headers: { 'Authorization': `Bearer ${token}` }, signal: opts.signal },
      15_000,
    );

    if (!response.ok) throw new Error(`Failed to search files: ${response.status}`);
    const data = await readSyncJsonBounded(
      response,
      SYNC_METADATA_MAX_BYTES,
      'Google Drive file list',
    ) as { files?: GoogleDriveFile[] };
    return data.files?.[0] ?? null;
  },

  async upload(data: unknown, settings: Settings, opts: SyncRequestOptions = {}): Promise<SyncUploadResult> {
    const token = await this.getValidToken(settings, opts);
    if (!token) throw new Error('Not authenticated with Google Drive');

    const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
    const existingFile = await this.findFile(token, objectName, opts);
    const metadata = {
      name: objectName,
      mimeType: 'application/json',
    };

    const boundary =
      '-------ScriptVault' +
      crypto
        .getRandomValues(new Uint8Array(8))
        .reduce((s: string, b: number) => s + b.toString(16).padStart(2, '0'), '');
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      JSON.stringify(data),
      `--${boundary}--`,
    ].join('\r\n');

    const safeFileId = existingFile ? String(existingFile.id).replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const url = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${safeFileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    };
    const lastEtag = this._lastSyncEtagKey === objectName ? this._lastSyncEtag : undefined;
    if (existingFile && typeof lastEtag === 'string') headers['If-Match'] = lastEtag;

    const response = await fetchWithTimeout(url, {
      method: existingFile ? 'PATCH' : 'POST',
      headers,
      body,
      signal: opts.signal,
    }, 60_000);

    if (!response.ok) {
      const error = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, 'Google Drive upload error');
      throw new Error(`Upload failed: ${error}`);
    }

    this._lastSyncEtag = response.headers?.get('ETag') || this._lastSyncEtag;
    this._lastSyncEtagKey = objectName;
    return { success: true, timestamp: Date.now() };
  },

  async download(settings: Settings, opts: SyncRequestOptions = {}): Promise<unknown | null> {
    const token = await this.getValidToken(settings, opts);
    if (!token) throw new Error('Not authenticated with Google Drive');

    const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
    const file = await this.findFile(token, objectName, opts);
    if (!file) {
      this._lastSyncEtag = null;
      this._lastSyncEtagKey = objectName;
      return null;
    }
    const safeFileId = String(file.id).replace(/[^a-zA-Z0-9_-]/g, '');

    const response = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${safeFileId}?alt=media`,
      { headers: { 'Authorization': `Bearer ${token}` }, signal: opts.signal },
      60_000,
    );

    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    this._lastSyncEtag = response.headers?.get('ETag') || undefined;
    this._lastSyncEtagKey = objectName;
    return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, 'Google Drive sync payload');
  },

  async test(settings: Settings): Promise<SyncTestResult> {
    try {
      const token = await this.getValidToken(settings);
      if (!token) return { success: false, error: 'Not authenticated' };

      const response = await fetchWithTimeout(
        'https://www.googleapis.com/drive/v3/about?fields=user',
        { headers: { 'Authorization': `Bearer ${token}` } },
        15_000,
      );

      return { success: response.ok };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  },

  async getStatus(settings?: Settings): Promise<SyncStatusResult> {
    try {
      const s = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
      if (!s.googleDriveToken && !s.googleDriveRefreshToken) {
        return { connected: false };
      }

      const token = await this.getValidToken(s);
      if (!token) return { connected: false };

      const response = await fetchWithTimeout(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { 'Authorization': `Bearer ${token}` } },
        10_000,
      );

      if (!response.ok) return { connected: false };

      const user = await readSyncJsonBounded(
        response,
        SYNC_METADATA_MAX_BYTES,
        'Google Drive user response',
      ) as { email?: string; name?: string };
      return { connected: true, user: { email: user.email ?? '', name: user.name ?? '' } };
    } catch (_e: unknown) {
      return { connected: false };
    }
  },
};

// ============================================================================
// Dropbox Provider
// ============================================================================

const dropbox = {
  name: 'Dropbox' as const,
  icon: '📦' as const,
  requiresOAuth: true as const,
  fileName: '/scriptvault-backup.json' as const,
  supportsManualSync: true as const,
  supportsDryRun: true as const,
  _lastSyncRev: undefined as string | null | undefined,
  _lastSyncRevPath: '' as string,

  getStorageDisclosure(settings: Partial<Settings> = {}): SyncStorageDisclosure {
    return syncStorageDisclosure(settings, {
      fields: [
        { key: 'dropboxToken', label: 'Dropbox access token', type: 'token' },
        { key: 'dropboxRefreshToken', label: 'Dropbox refresh token', type: 'token' },
        { key: 'dropboxClientId', label: 'Dropbox app key', type: 'metadata' },
        { key: 'dropboxUser', label: 'Connected Dropbox account label', type: 'metadata' },
      ],
      revokeAction: 'Call Dropbox token revoke when an access token exists, then clear Dropbox tokens and account metadata.',
      notes: 'Tokens are scoped by the Dropbox app key the user configured for ScriptVault backups.',
    });
  },

  async connect(settings: Settings): Promise<SyncConnectResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    if (!effectiveSettings.dropboxClientId) {
      throw new Error(
        'Dropbox App Key is required. Create one at https://www.dropbox.com/developers/apps',
      );
    }

    const clientId = effectiveSettings.dropboxClientId;
    const redirectUri = chrome.identity.getRedirectURL('dropbox');

    // PKCE code verifier + challenge
    const codeVerifier = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (b: number) => b.toString(16).padStart(2, '0'),
    ).join('');
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // CSRF state parameter
    const state = Array.from(
      crypto.getRandomValues(new Uint8Array(16)),
      (b: number) => b.toString(16).padStart(2, '0'),
    ).join('');

    const authUrl =
      'https://www.dropbox.com/oauth2/authorize?' +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        token_access_type: 'offline',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      }).toString();

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
    if (!responseUrl) throw new Error('No response from auth flow');

    const url = new URL(responseUrl);
    const returnedState = url.searchParams.get('state');
    if (returnedState !== state) {
      throw new Error('OAuth state mismatch - possible CSRF attack');
    }
    const code = url.searchParams.get('code');
    if (!code) throw new Error('No authorization code received');

    // Exchange code for tokens
    const tokenResp = await fetchWithTimeout('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    }, 15_000);

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      throw new Error('Token exchange failed: ' + err);
    }

    const tokens: { access_token: string; refresh_token?: string } = await tokenResp.json();
    return {
      success: true,
      token: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
    };
  },

  async refreshToken(settings: Settings, opts: SyncRequestOptions = {}): Promise<string | null> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const refreshTok = effectiveSettings.dropboxRefreshToken;
    const clientId = effectiveSettings.dropboxClientId;
    if (!refreshTok || !clientId) return null;

    const resp = await _oauthFetchWithTimeout('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: opts.signal,
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshTok,
      }),
    }, 'Dropbox');
    if (!resp) return null;

    if (!resp.ok) {
      console.warn('[CloudSync] Dropbox token refresh failed:', resp.status);
      return null;
    }
    const data: { access_token?: string } = await resp.json();
    if (data.access_token) {
      await SyncCredentialStore.persistSettingsUpdate({ dropboxToken: data.access_token }, effectiveSettings);
      return data.access_token;
    }
    return null;
  },

  async getValidToken(settings: Settings, opts: SyncRequestOptions = {}): Promise<string | null> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    if (effectiveSettings.dropboxToken) {
      try {
        const test = await _oauthFetchWithTimeout(
          'https://api.dropboxapi.com/2/users/get_current_account',
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${effectiveSettings.dropboxToken}` },
            signal: opts.signal,
          },
          'Dropbox',
          10_000,
        );
        if (!test) return effectiveSettings.dropboxToken;
        if (test.ok) return effectiveSettings.dropboxToken;
        if (test.status !== 401 && test.status !== 403) return effectiveSettings.dropboxToken;
      } catch (_e: unknown) {
        return effectiveSettings.dropboxToken;
      }
    }
    return await this.refreshToken(effectiveSettings, opts);
  },

  async disconnect(settings: Settings): Promise<SyncDisconnectResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    if (effectiveSettings.dropboxToken) {
      try {
        await fetchWithTimeout('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${effectiveSettings.dropboxToken}` },
        }, 10_000);
      } catch (e: unknown) {
        console.warn('[CloudSync] Dropbox revoke error:', e);
      }
    }
    await SyncCredentialStore.clearSessionCredentials();
    await SettingsManager.set({
      dropboxToken: '',
      dropboxRefreshToken: '',
      dropboxUser: null,
    });
    return { success: true };
  },

  async upload(data: unknown, settings: Settings, opts: SyncRequestOptions = {}): Promise<SyncUploadResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const token = await this.getValidToken(effectiveSettings, opts);
    if (!token) throw new Error('Not authenticated with Dropbox');

    const body = JSON.stringify(data);
    if (body.length > 150 * 1024 * 1024) throw new Error('Sync data exceeds Dropbox 150 MB upload limit');

    const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
    const dropboxPath = '/' + objectName;
    const lastRev = this._lastSyncRevPath === dropboxPath ? this._lastSyncRev : undefined;
    const mode = typeof lastRev === 'string'
      ? { '.tag': 'update', update: lastRev }
      : (lastRev === null ? 'add' : 'overwrite');
    const response = await fetchWithTimeout('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode,
          autorename: false,
          mute: true,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body,
      signal: opts.signal,
    }, 60_000);

    if (response.status === 401) throw new Error('Dropbox token expired. Please reconnect.');
    if (!response.ok) {
      const error = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, 'Dropbox upload error');
      throw new Error(`Upload failed: ${error}`);
    }

    const metadata = await response.clone().json().catch(() => null) as { rev?: string } | null;
    if (metadata?.rev) this._lastSyncRev = metadata.rev;
    this._lastSyncRevPath = dropboxPath;
    return { success: true, timestamp: Date.now() };
  },

  async download(settings: Settings, opts: SyncRequestOptions = {}): Promise<unknown | null> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const token = await this.getValidToken(effectiveSettings, opts);
    if (!token) throw new Error('Not authenticated with Dropbox');

    const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
    const dropboxPath = '/' + objectName;
    const response = await fetchWithTimeout('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath }),
      },
      signal: opts.signal,
    }, 60_000);

    if (response.status === 409) {
      this._lastSyncRev = null;
      this._lastSyncRevPath = dropboxPath;
      return null; // File not found
    }
    if (response.status === 401) throw new Error('Dropbox token expired. Please reconnect.');
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const apiResult = response.headers.get('Dropbox-API-Result');
    if (apiResult) {
      try {
        const metadata = JSON.parse(apiResult) as { rev?: string };
        this._lastSyncRev = metadata.rev || undefined;
        this._lastSyncRevPath = dropboxPath;
      } catch (_) {
        this._lastSyncRev = undefined;
        this._lastSyncRevPath = '';
      }
    } else {
      this._lastSyncRev = undefined;
      this._lastSyncRevPath = '';
    }
    return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, 'Dropbox sync payload');
  },

  async test(settings: Settings): Promise<SyncTestResult> {
    try {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
      const token = await this.getValidToken(effectiveSettings);
      if (!token) return { success: false, error: 'Not authenticated' };

      const response = await fetchWithTimeout(
        'https://api.dropboxapi.com/2/users/get_current_account',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        },
        15_000,
      );

      if (response.status === 401) return { success: false, error: 'Token expired' };
      return { success: response.ok };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  },

  async getStatus(settings?: Settings): Promise<SyncStatusResult> {
    const s = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
    if (!s.dropboxToken && !s.dropboxRefreshToken) return { connected: false };

    try {
      const token = await this.getValidToken(s);
      if (!token) return { connected: false };

      const response = await fetchWithTimeout(
        'https://api.dropboxapi.com/2/users/get_current_account',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        },
        15_000,
      );

      if (!response.ok) return { connected: false };

      const user: {
        email?: string;
        name?: { display_name?: string };
        display_name?: string;
      } = await readSyncJsonBounded(
        response,
        SYNC_METADATA_MAX_BYTES,
        'Dropbox account response',
      ) as { email?: string; name?: { display_name?: string } };
      return {
        connected: true,
        user: {
          email: user.email ?? '',
          name: user.name?.display_name || user.display_name || '',
        },
      };
    } catch (_e: unknown) {
      return { connected: false };
    }
  },
};

// ============================================================================
// OneDrive Provider
// ============================================================================

const onedrive = {
  name: 'OneDrive' as const,
  icon: '📁' as const,
  requiresOAuth: true as const,
  fileName: 'scriptvault-backup.json' as const,
  supportsManualSync: true as const,
  supportsDryRun: true as const,
  _lastSyncEtag: undefined as string | null | undefined,
  _lastSyncEtagKey: '' as string,
  // Microsoft OAuth - users must provide their own client ID from Azure AD
  // Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps

  getStorageDisclosure(settings: Partial<Settings> = {}): SyncStorageDisclosure {
    return syncStorageDisclosure(settings, {
      fields: [
        { key: 'onedriveToken', label: 'OneDrive access token', type: 'token' },
        { key: 'onedriveRefreshToken', label: 'OneDrive refresh token', type: 'token' },
        { key: 'onedriveClientId', label: 'OneDrive app client ID', type: 'metadata' },
        { key: 'onedriveUser', label: 'Connected Microsoft account label', type: 'metadata' },
      ],
      revokeAction: 'Clear OneDrive tokens and account metadata from local extension storage.',
      notes: 'Microsoft Graph tokens use app-folder file access and profile lookup scopes.',
    });
  },

  async connect(settings: Settings): Promise<SyncConnectResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const clientId = effectiveSettings.onedriveClientId;
    if (!clientId) {
      throw new Error(
        'OneDrive Client ID required. Create one at https://portal.azure.com → App registrations',
      );
    }
    const redirectUri = chrome.identity.getRedirectURL('onedrive');
    const scopes = 'Files.ReadWrite.AppFolder User.Read offline_access';

    const codeVerifier = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (b: number) => b.toString(16).padStart(2, '0'),
    ).join('');
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const state = generateOAuthState();

    const authUrl =
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      }).toString();

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
    if (!responseUrl) throw new Error('No response from auth flow');

    const url = new URL(responseUrl);
    const returnedState = url.searchParams.get('state');
    if (returnedState !== state) {
      throw new Error('OAuth state mismatch - possible CSRF attack');
    }
    const code = url.searchParams.get('code');
    if (!code) throw new Error('No authorization code received');

    const tokenResp = await fetchWithTimeout(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: scopes,
        }),
      },
      15_000,
    );

    if (!tokenResp.ok) throw new Error('Token exchange failed: ' + (await tokenResp.text()));
    const tokens: { access_token: string; refresh_token?: string } = await tokenResp.json();

    const userResp = await fetchWithTimeout('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    }, 10_000);
    const user: { mail?: string; userPrincipalName?: string; displayName?: string } =
      userResp.ok ? await userResp.json() : {};

    await SyncCredentialStore.persistSettingsUpdate({
      onedriveToken: tokens.access_token,
      onedriveRefreshToken: tokens.refresh_token || '',
      onedriveConnected: true,
      onedriveUser: {
        email: user.mail || user.userPrincipalName || '',
        name: user.displayName || '',
      },
    }, effectiveSettings);

    return {
      success: true,
      user: {
        email: user.mail || user.userPrincipalName || '',
        name: user.displayName || '',
      },
    };
  },

  async refreshToken(settings?: Settings, opts: SyncRequestOptions = {}): Promise<string | null> {
    const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
    const refreshTok = currentSettings.onedriveRefreshToken;
    const clientId = currentSettings.onedriveClientId;
    if (!refreshTok || !clientId) return null;

    const resp = await _oauthFetchWithTimeout(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: opts.signal,
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshTok,
          scope: 'Files.ReadWrite.AppFolder User.Read offline_access',
        }),
      },
      'OneDrive',
      15_000,
    );
    if (!resp) return null;

    if (!resp.ok) return null;
    const data: { access_token?: string; refresh_token?: string } = await resp.json();
    if (data.access_token) {
      await SyncCredentialStore.persistSettingsUpdate({
        onedriveToken: data.access_token,
        onedriveRefreshToken: data.refresh_token || refreshTok,
        onedriveConnected: true,
      }, currentSettings);
      return data.access_token;
    }
    return null;
  },

  async getValidToken(settings?: Settings, opts: SyncRequestOptions = {}): Promise<string | null> {
    const currentSettings = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
    const token = currentSettings.onedriveToken;
    if (!token) {
      return await this.refreshToken(currentSettings, opts);
    }

    try {
      const test = await _oauthFetchWithTimeout('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: opts.signal,
      }, 'OneDrive', 10_000);
      if (!test) return token;
      if (test.ok) return token;
      if (test.status === 401 || test.status === 403) {
        return await this.refreshToken(currentSettings, opts);
      }
      return token;
    } catch (_e: unknown) {
      return token;
    }
  },

  async disconnect(): Promise<SyncDisconnectResult> {
    await SyncCredentialStore.clearSessionCredentials();
    await SettingsManager.set({
      onedriveToken: '',
      onedriveRefreshToken: '',
      onedriveConnected: false,
      onedriveUser: null,
    });
    return { success: true };
  },

  async upload(data: unknown, settings?: Settings, opts: SyncRequestOptions = {}): Promise<SyncUploadResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
    const token = await this.getValidToken(effectiveSettings, opts);
    if (!token) throw new Error('Not authenticated with OneDrive');
    if (!data || typeof data !== 'object') throw new Error('Invalid backup data');

    const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const lastEtag = this._lastSyncEtagKey === objectName ? this._lastSyncEtag : undefined;
    if (typeof lastEtag === 'string') headers['If-Match'] = lastEtag;
    else if (lastEtag === null) headers['If-None-Match'] = '*';
    const response = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${objectName}:/content`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
        signal: opts.signal,
      },
      60_000,
    );

    if (!response.ok) {
      throw new Error('Upload failed: ' + (await readSyncTextBounded(
        response,
        SYNC_ERROR_MAX_BYTES,
        'OneDrive upload error',
      )));
    }
    this._lastSyncEtag = response.headers.get('ETag') || response.headers.get('eTag') || this._lastSyncEtag;
    this._lastSyncEtagKey = objectName;
    return { success: true, timestamp: Date.now() };
  },

  async download(settings?: Settings, opts: SyncRequestOptions = {}): Promise<unknown | null> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
    const token = await this.getValidToken(effectiveSettings, opts);
    if (!token) throw new Error('Not authenticated with OneDrive');

    const objectName = resolveRemoteObjectName(opts.objectName, this.fileName);
    const response = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${objectName}:/content`,
      { headers: { 'Authorization': `Bearer ${token}` }, signal: opts.signal },
      60_000,
    );

    if (response.status === 404) {
      this._lastSyncEtag = null;
      this._lastSyncEtagKey = objectName;
      return null;
    }
    if (!response.ok) throw new Error('Download failed: ' + response.status);
    this._lastSyncEtag = response.headers.get('ETag') || response.headers.get('eTag') || undefined;
    this._lastSyncEtagKey = objectName;
    return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, 'OneDrive sync payload');
  },

  async test(settings?: Settings): Promise<SyncTestResult> {
    try {
      const effectiveSettings = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
      const token = await this.getValidToken(effectiveSettings);
      if (!token) return { success: false, error: 'Not authenticated' };
      const response = await fetchWithTimeout('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      }, 15_000);
      return { success: response.ok };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  },

  async getStatus(settings?: Settings): Promise<SyncStatusResult> {
    try {
      const s = await SyncCredentialStore.resolveSettings(settings ?? (await getRawSettings()));
      if (!s.onedriveToken && !s.onedriveRefreshToken) return { connected: false };
      const token = await this.getValidToken(s);
      if (!token) return { connected: false };
      const response = await fetchWithTimeout('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      }, 15_000);
      if (!response.ok) return { connected: false };
      const user: { mail?: string; userPrincipalName?: string; displayName?: string } =
        await readSyncJsonBounded(
          response,
          SYNC_METADATA_MAX_BYTES,
          'OneDrive user response',
        ) as { mail?: string; userPrincipalName?: string; displayName?: string };
      return {
        connected: true,
        user: {
          email: user.mail || user.userPrincipalName || '',
          name: user.displayName || '',
        },
      };
    } catch (_e: unknown) {
      return { connected: false };
    }
  },
};

// ============================================================================
// Export
// ============================================================================

// ============================================================================
// S3-compatible Provider (AWS S3, Cloudflare R2, MinIO, Backblaze B2, …)
// ============================================================================
//
// TS mirror is intentionally a thin pass-through over the runtime JS impl in
// modules/sync-providers.js. The provider does its own settings validation
// and SigV4 signing via Web Crypto; the structural contract surfaced to
// CloudSync stays the same as every other provider here.

interface S3SettingsValidation {
  valid: boolean;
  errors: Array<{ field: string; error: string }>;
}

const s3 = {
  name: 'S3-compatible' as const,
  icon: '🪣' as const,
  requiresAuth: true as const,
  supportsManualSync: true as const,
  supportsDryRun: true as const,
  _lastSyncEtag: undefined as string | null | undefined,
  _lastSyncEtagKey: '' as string,

  getStorageDisclosure(settings: Partial<Settings> = {}): SyncStorageDisclosure {
    return syncStorageDisclosure(settings, {
      fields: [
        { key: 's3Endpoint', label: 'S3 endpoint URL', type: 'metadata' },
        { key: 's3Region', label: 'S3 region', type: 'metadata' },
        { key: 's3Bucket', label: 'S3 bucket name', type: 'metadata' },
        { key: 's3AccessKeyId', label: 'S3 access key ID', type: 'credential' },
        { key: 's3SecretKey', label: 'S3 secret access key', type: 'credential' },
        { key: 's3ObjectKey', label: 'Optional object key override', type: 'metadata' },
      ],
      revokeAction: 'Clear the saved S3 endpoint, region, bucket, access key, and secret from local extension storage.',
      notes: 'Credentials are HMAC-SHA256 signed per AWS SigV4 and sent only to the configured endpoint during sync. No third party sees the secret.',
    });
  },

  validate(settings: Partial<Settings> = {}): S3SettingsValidation {
    const errors: Array<{ field: string; error: string }> = [];
    const endpoint = (settings.s3Endpoint || '').trim();
    if (!endpoint) {
      errors.push({ field: 's3Endpoint', error: 'Endpoint URL is required.' });
    } else {
      try {
        const url = new URL(endpoint);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          errors.push({ field: 's3Endpoint', error: 'Endpoint must be http(s)://.' });
        }
        if (url.pathname && url.pathname !== '/' && url.pathname !== '') {
          errors.push({
            field: 's3Endpoint',
            error: 'Endpoint URL must not include a path; bucket goes in its own field.',
          });
        }
      } catch (_) {
        errors.push({ field: 's3Endpoint', error: 'Endpoint URL is malformed.' });
      }
    }
    const region = (settings.s3Region || '').trim();
    if (!region) errors.push({ field: 's3Region', error: 'Region is required (use "auto" for Cloudflare R2).' });
    const bucket = (settings.s3Bucket || '').trim();
    if (!bucket) errors.push({ field: 's3Bucket', error: 'Bucket name is required.' });
    else if (!/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/i.test(bucket)) {
      errors.push({
        field: 's3Bucket',
        error: 'Bucket name must be 3-63 chars, alphanumeric/dash/dot only.',
      });
    }
    if (!settings.s3AccessKeyId) errors.push({ field: 's3AccessKeyId', error: 'Access key ID is required.' });
    if (!settings.s3SecretKey) errors.push({ field: 's3SecretKey', error: 'Secret access key is required.' });
    return { valid: errors.length === 0, errors };
  },

  _buildObjectUrl(settings: Settings, objectKey: string): string {
    const endpoint = new URL(settings.s3Endpoint);
    const isAws = /(^|\.)amazonaws\.com$/i.test(endpoint.hostname);
    const usePathStyle = settings.s3PathStyle === true ||
      (settings.s3PathStyle === undefined && !isAws);
    const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
    if (usePathStyle) {
      return `${endpoint.origin}/${encodeURIComponent(settings.s3Bucket)}/${encodedKey}`;
    }
    const host = `${settings.s3Bucket}.${endpoint.hostname}`;
    const port = endpoint.port ? `:${endpoint.port}` : '';
    return `${endpoint.protocol}//${host}${port}/${encodedKey}`;
  },

  _objectKey(settings: Partial<Settings>, objectName?: string): string {
    // Cloud backup overrides the key with a distinct object so it does not
    // clobber the sync envelope; sync leaves objectName unset and uses the
    // user's configured s3ObjectKey (or the default).
    if (typeof objectName === 'string' && objectName.trim()) {
      return resolveRemoteObjectName(objectName, 'scriptvault-cloud-backup.json');
    }
    return (settings.s3ObjectKey || 'scriptvault-backup.json').replace(/^\/+/, '');
  },

  async _signRequest({
    method,
    url,
    region,
    accessKeyId,
    secretKey,
    body,
    contentType,
    extraHeaders,
  }: {
    method: string;
    url: string;
    region: string;
    accessKeyId: string;
    secretKey: string;
    body?: string | Uint8Array | null;
    contentType?: string;
    extraHeaders?: Record<string, string>;
  }): Promise<{ headers: Record<string, string> }> {
    const parsedUrl = new URL(url);
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const dateStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
    const amzDate = `${dateStamp}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const service = 's3';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const bodyBytes = body == null
      ? new Uint8Array(0)
      : (typeof body === 'string' ? new TextEncoder().encode(body) : body);
    const payloadHash = await this._sha256Hex(bodyBytes);
    const headers: Record<string, string> = {
      host: parsedUrl.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType) headers['content-type'] = contentType;
    for (const [key, value] of Object.entries(extraHeaders || {})) {
      headers[key.toLowerCase()] = value;
    }
    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames.map((key) => `${key}:${headers[key]}\n`).join('');
    const signedHeaders = sortedHeaderNames.join(';');
    const canonicalQuery = this._canonicalQuery(parsedUrl);
    const canonicalRequest = [
      method,
      parsedUrl.pathname || '/',
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await this._sha256Hex(canonicalRequest),
    ].join('\n');
    const kDate = await this._hmac(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
    const kRegion = await this._hmac(kDate, region);
    const kService = await this._hmac(kRegion, service);
    const kSigning = await this._hmac(kService, 'aws4_request');
    const signature = this._toHex(await this._hmac(kSigning, stringToSign));
    return {
      headers: {
        ...Object.fromEntries(
          sortedHeaderNames
            .filter((key) => key !== 'host')
            .map((key) => [key, headers[key] as string]),
        ),
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    };
  },

  _canonicalQuery(url: URL | string): string {
    const parsedUrl = typeof url === 'string' ? new URL(url) : url;
    const encode = (value: string): string => encodeURIComponent(value).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return Array.from(parsedUrl.searchParams.entries(), ([key, value]) => [encode(key), encode(value)] as const)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
        leftKey < rightKey ? -1
          : leftKey > rightKey ? 1
            : leftValue < rightValue ? -1
              : leftValue > rightValue ? 1 : 0
      ))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  },

  async _sha256Hex(input: string | Uint8Array): Promise<string> {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const buffer = await crypto.subtle.digest('SHA-256', bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer);
    return this._toHex(new Uint8Array(buffer));
  },

  async _hmac(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength,
      ) as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return new Uint8Array(signature);
  },

  _toHex(bytes: Uint8Array): string {
    let value = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i] ?? 0;
      const hex = byte.toString(16);
      value += hex.length === 1 ? '0' + hex : hex;
    }
    return value;
  },

  async upload(
    data: unknown,
    settings: Settings,
    opts: SyncRequestOptions = {},
  ): Promise<SyncUploadResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const check = this.validate(effectiveSettings);
    if (!check.valid) {
      throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(' ')}`);
    }
    const objectKey = this._objectKey(effectiveSettings, opts.objectName);
    const url = this._buildObjectUrl(effectiveSettings, objectKey);
    const guardOptions = {
      label: 'S3 sync endpoint',
      allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings),
    };
    assertSyncEndpointAllowed(url, guardOptions);
    const body = JSON.stringify(data);
    const conditionalHeaders: Record<string, string> = {};
    const lastEtag = this._lastSyncEtagKey === objectKey ? this._lastSyncEtag : undefined;
    if (typeof lastEtag === 'string') conditionalHeaders['if-match'] = lastEtag;
    else if (lastEtag === null) conditionalHeaders['if-none-match'] = '*';
    const signed = await this._signRequest({
      method: 'PUT',
      url,
      region: effectiveSettings.s3Region,
      accessKeyId: effectiveSettings.s3AccessKeyId,
      secretKey: effectiveSettings.s3SecretKey,
      body,
      contentType: 'application/json',
      extraHeaders: conditionalHeaders,
    });
    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: signed.headers,
      body,
      signal: opts.signal,
    }, 30_000, guardOptions);
    if (!response.ok) {
      const text = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, 'S3 upload error').catch(() => '');
      throw new Error(`S3 upload failed: HTTP ${response.status}${text ? ` - ${text.slice(0, 200)}` : ''}`);
    }
    this._lastSyncEtag = response.headers?.get('ETag') || this._lastSyncEtag;
    this._lastSyncEtagKey = objectKey;
    return { success: true, timestamp: Date.now() };
  },

  async download(
    settings: Settings,
    opts: SyncRequestOptions = {},
  ): Promise<unknown | null> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const check = this.validate(effectiveSettings);
    if (!check.valid) {
      throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(' ')}`);
    }
    const objectKey = this._objectKey(effectiveSettings, opts.objectName);
    const url = this._buildObjectUrl(effectiveSettings, objectKey);
    const guardOptions = {
      label: 'S3 sync endpoint',
      allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings),
    };
    assertSyncEndpointAllowed(url, guardOptions);
    const signed = await this._signRequest({
      method: 'GET',
      url,
      region: effectiveSettings.s3Region,
      accessKeyId: effectiveSettings.s3AccessKeyId,
      secretKey: effectiveSettings.s3SecretKey,
    });
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: signed.headers,
      signal: opts.signal,
    }, 30_000, guardOptions);
    if (response.status === 404) {
      this._lastSyncEtag = null;
      this._lastSyncEtagKey = objectKey;
      return null;
    }
    if (!response.ok) {
      const text = await readSyncTextBounded(response, SYNC_ERROR_MAX_BYTES, 'S3 download error').catch(() => '');
      throw new Error(`S3 download failed: HTTP ${response.status}${text ? ` - ${text.slice(0, 200)}` : ''}`);
    }
    this._lastSyncEtag = response.headers?.get('ETag') || undefined;
    this._lastSyncEtagKey = objectKey;
    return await readSyncJsonBounded(response, SYNC_PAYLOAD_MAX_BYTES, 'S3 sync payload');
  },

  async test(settings: Settings): Promise<SyncTestResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const check = this.validate(effectiveSettings);
    if (!check.valid) {
      return { success: false, error: check.errors.map((e) => e.error).join(' ') };
    }
    try {
      const url = this._buildObjectUrl(effectiveSettings, this._objectKey(effectiveSettings));
      const guardOptions = {
        label: 'S3 sync endpoint',
        allowInternalEndpoint: allowsInternalSyncEndpoints(effectiveSettings),
      };
      assertSyncEndpointAllowed(url, guardOptions);
      const signed = await this._signRequest({
        method: 'HEAD',
        url,
        region: effectiveSettings.s3Region,
        accessKeyId: effectiveSettings.s3AccessKeyId,
        secretKey: effectiveSettings.s3SecretKey,
      });
      const response = await fetchWithTimeout(
        url,
        { method: 'HEAD', headers: signed.headers },
        15_000,
        guardOptions,
      );
      if (response.ok || response.status === 404) return { success: true };
      return { success: false, error: `HTTP ${response.status}` };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async getStatus(settings: Settings): Promise<SyncStatusResult> {
    const effectiveSettings = await SyncCredentialStore.resolveSettings(settings);
    const check = this.validate(effectiveSettings);
    if (!check.valid) {
      return {
        connected: false,
        status: 'missing_config',
        error: check.errors.map(e => e.error).join(' '),
      };
    }
    let endpointHost = '';
    try { endpointHost = new URL(effectiveSettings.s3Endpoint).host; } catch {}
    const result = await this.test(effectiveSettings);
    return {
      connected: result.success === true,
      status: result.success === true ? 'ok' : 'error',
      error: result.error ?? null,
      user: { email: '', name: `${effectiveSettings.s3Bucket}@${endpointHost}` },
      endpointHost,
    };
  },

  async disconnect(): Promise<SyncDisconnectResult> {
    await SyncCredentialStore.clearSessionCredentials();
    await SettingsManager.set({
      s3Endpoint: '',
      s3Region: '',
      s3Bucket: '',
      s3AccessKeyId: '',
      s3SecretKey: '',
      s3ObjectKey: '',
    });
    return { success: true };
  },
};

export const CloudSyncProviders = {
  webdav,
  localfolder,
  localFolder: localfolder,
  local: localfolder,
  googledrive,
  google: googledrive,
  dropbox,
  onedrive,
  s3,
};

Object.defineProperty(CloudSyncProviders, '_credentialStore', {
  value: SyncCredentialStore,
  enumerable: false,
  configurable: false,
});
