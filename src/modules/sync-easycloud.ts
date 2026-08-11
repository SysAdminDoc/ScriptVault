// ============================================================================
// MIGRATED: sync-easycloud.ts - Zero-Config Google Cloud Sync (EasyCloud)
// Uses chrome.identity.getAuthToken for one-click Google Drive sync
// ============================================================================

import type { Script, ScriptMeta, ScriptSettings } from '../types/index';
import { SyncCrypto, type RemoteSyncEnvelope } from './sync-crypto';
import { normalizeLocalLibrarySnapshots } from '../background/local-libraries';
import {
  buildGmValueSyncBundle,
  mergeGmValueSyncValues,
  normalizeGmValueSyncPolicy,
  shouldSyncScriptValues,
  type GmValueKeyMetadata,
  type GmValueSyncBundle,
} from '../background/gm-value-sync';

// ============================================================================
// External globals (not yet migrated to TS modules)
// ============================================================================

declare function parseUserscript(code: string): { meta: ScriptMeta; error: string | null };

declare const ScriptStorage: {
  getAll(): Promise<Script[]>;
  get(id: string): Promise<Script | null>;
  set(id: string, script: Script): Promise<unknown>;
  delete(id: string): Promise<unknown>;
};

declare const ScriptValues: {
  getAll(scriptId: string): Promise<Record<string, unknown>>;
  getAllMetadata?(scriptId: string): Promise<{ valueCount: number; lastUpdatedAt: number | null }>;
  getAllKeyMetadata?(scriptId: string): Promise<Record<string, GmValueKeyMetadata>>;
  getSyncDeviceId?(): Promise<string | null>;
  getSyncConflicts?(scriptId: string): Promise<Record<string, unknown>>;
  setAll?(scriptId: string, values: Record<string, unknown>): Promise<void>;
  setAllWithClocks?(scriptId: string, values: Record<string, unknown>, keyMetadata: Record<string, GmValueKeyMetadata>): Promise<void>;
  setSyncConflicts?(scriptId: string, conflicts: Record<string, unknown>): Promise<void>;
};

declare const SettingsManager: {
  get?(): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): Promise<unknown>;
  set(settings: Record<string, unknown>): Promise<unknown>;
};

declare const ScriptAnalyzer: {
  _ensureOffscreen?(): Promise<boolean>;
  mergeText?(base: string, local: string, remote: string): Promise<MergeResult>;
};

// ============================================================================
// Cloud Sync Provider interface
// ============================================================================

export interface CloudSyncProvider {
  name: string;
  icon: string;
  requiresAuth: boolean;
  requiresOAuth: boolean;
  isZeroConfig: boolean;
  supportsManualSync?: boolean;
  supportsDryRun?: boolean;
  getStorageDisclosure?(settings: unknown): {
    storage: string;
    protection: string;
    fields: Array<{ key: string; label: string; type: string; present: boolean }>;
    hasStoredSecrets: boolean;
    revokeAction: string;
    notes: string;
  };
  connect(): Promise<ConnectResult>;
  disconnect(): Promise<DisconnectResult>;
  sync?(settings?: unknown, options?: { signal?: AbortSignal }): Promise<SyncResult>;
  upload(data: unknown, settings: unknown): Promise<{ success: boolean; timestamp: number }>;
  download(settings: unknown): Promise<SyncEnvelope | null>;
  test(): Promise<{ success: boolean }>;
  getStatus(): Promise<ProviderStatus>;
}

declare const CloudSyncProviders: Record<string, CloudSyncProvider> | undefined;

// ============================================================================
// Local types for sync data
// ============================================================================

interface SyncScript {
  id: string;
  code: string;
  enabled: boolean;
  position: number;
  settings: ScriptSettings;
  updatedAt: number;
  syncBaseCode: string | null;
  lastSyncDevice?: string;
}

interface SyncEnvelope {
  version: number;
  timestamp: number;
  deviceId: string;
  scripts: SyncScript[];
  tombstones: Record<string, unknown>;
  valueBundles?: Record<string, GmValueSyncBundle>;
}

const SYNC_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function pruneSyncTombstones(tombstones: Record<string, unknown>, now = Date.now()): Record<string, unknown> {
  const cutoff = now - SYNC_TOMBSTONE_RETENTION_MS;
  return Object.fromEntries(Object.entries(tombstones).filter(([, timestamp]) =>
    typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp > cutoff,
  ));
}

function tombstoneMapsDiffer(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  return leftIds.length !== rightIds.length ||
    leftIds.some((id) => !(id in right)) ||
    rightIds.some((id) => !(id in left));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getValueBundles(envelope: SyncEnvelope | null | undefined): Record<string, GmValueSyncBundle> {
  return isRecord(envelope?.valueBundles) ? envelope.valueBundles as Record<string, GmValueSyncBundle> : {};
}

async function _buildValueBundles(scripts: SyncScript[]): Promise<Record<string, GmValueSyncBundle>> {
  if (typeof ScriptValues === 'undefined' || typeof ScriptValues?.getAll !== 'function') return {};
  const result: Record<string, GmValueSyncBundle> = {};
  for (const script of scripts) {
    if (!shouldSyncScriptValues(script)) continue;
    const values = await ScriptValues.getAll(script.id);
    const aggregateMetadata = typeof ScriptValues.getAllMetadata === 'function'
      ? await ScriptValues.getAllMetadata(script.id)
      : null;
    const keyMetadata = typeof ScriptValues.getAllKeyMetadata === 'function'
      ? await ScriptValues.getAllKeyMetadata(script.id)
      : null;
    const deviceId = typeof ScriptValues.getSyncDeviceId === 'function'
      ? await ScriptValues.getSyncDeviceId()
      : null;
    const conflicts = typeof ScriptValues.getSyncConflicts === 'function'
      ? await ScriptValues.getSyncConflicts(script.id)
      : null;
    const built = buildGmValueSyncBundle(script, values, {
      lastValueUpdatedAt: aggregateMetadata?.lastUpdatedAt ?? null,
      keyMetadata,
      deviceId,
      conflicts,
    });
    if (built.bundle) result[script.id] = built.bundle;
  }
  return result;
}

async function _persistValueConflictCount(scriptId: string, count: number): Promise<void> {
  try {
    const script = await ScriptStorage.get(scriptId);
    if (!script) return;
    const current = Math.max(0, Math.floor(Number(script.settings?._gmValueSyncConflictCount) || 0));
    const next = Math.max(0, Math.floor(Number(count) || 0));
    if (current === next) return;
    const settings = { ...(script.settings || {}) } as ScriptSettings;
    if (next > 0) settings._gmValueSyncConflictCount = next;
    else delete settings._gmValueSyncConflictCount;
    await ScriptStorage.set(scriptId, { ...script, settings });
  } catch (error) {
    warn('[EasyCloud] Failed to persist GM value conflict count:', scriptId, error);
  }
}

async function _applyValueBundles(
  bundles: Record<string, GmValueSyncBundle>,
  policy: unknown,
): Promise<{ applied: number; conflicts: number; losersRetained: number }> {
  const result = { applied: 0, conflicts: 0, losersRetained: 0 };
  if (typeof ScriptValues === 'undefined' || typeof ScriptValues?.getAll !== 'function') return result;
  for (const [scriptId, bundle] of Object.entries(bundles)) {
    if (!bundle || !isRecord(bundle.values)) continue;
    const localValues = await ScriptValues.getAll(scriptId);
    const localMetadata = typeof ScriptValues.getAllKeyMetadata === 'function'
      ? await ScriptValues.getAllKeyMetadata(scriptId)
      : {};
    const localConflicts = typeof ScriptValues.getSyncConflicts === 'function'
      ? await ScriptValues.getSyncConflicts(scriptId)
      : null;
    const merged = mergeGmValueSyncValues(
      localValues,
      localMetadata,
      bundle.values,
      bundle.keyMetadata,
      {
        policy,
        localConflicts,
        remoteConflicts: bundle.conflicts,
      },
    );
    result.conflicts += merged.conflictCount;
    result.losersRetained += merged.losersRetained;
    if (merged.changedKeys.length > 0 || merged.metadataChangedKeys.length > 0) {
      if (typeof ScriptValues.setAllWithClocks === 'function') {
        await ScriptValues.setAllWithClocks(scriptId, merged.values, merged.keyMetadata);
      } else if (typeof ScriptValues.setAll === 'function') {
        await ScriptValues.setAll(scriptId, merged.values);
      }
      result.applied += 1;
    }
    if (typeof ScriptValues.setSyncConflicts === 'function') {
      await ScriptValues.setSyncConflicts(scriptId, merged.conflicts);
    }
    await _persistValueConflictCount(scriptId, merged.losersRetained);
  }
  return result;
}

interface SyncResult {
  success?: boolean;
  skipped?: boolean;
  offline?: boolean;
  error?: string;
  rateLimited?: boolean;
  retryAfterMs?: number;
  timestamp?: number;
}

interface EasyCloudRateLimitError extends Error {
  rateLimited: true;
  retryAfterMs: number;
  status: number;
}

interface MergeResult {
  merged?: string;
  conflicts?: boolean;
  error?: string;
}

interface ConnectResult {
  success: boolean;
  error?: string;
  user?: { email: string; name: string; picture?: string };
}

interface DisconnectResult {
  success: boolean;
  error?: string;
}

interface EasyCloudStatus {
  connected: boolean;
  status: string;
  lastSync: number | null;
  user: { email: string; name: string } | null;
  deviceId: string | null;
  online: boolean;
}

interface ProviderStatus {
  connected: boolean;
  user: { email: string; name: string } | null;
  status: string;
  lastSync: number | null;
}

interface OfflineChange {
  type: string;
  scriptId: string;
  timestamp: number;
  queuedAt?: number;
}

type StatusCallback = (status: string) => void;

interface DriveFileSearchResult {
  files?: Array<{ id: string; modifiedTime?: string }>;
}

interface DriveUploadResult {
  id?: string;
}

interface UserInfoResult {
  email?: string;
  name?: string;
  picture?: string;
}

type RuntimeHooks = typeof globalThis & {
  registerScript?: (script: Script) => Promise<void>;
  unregisterScript?: (scriptId: string) => Promise<void>;
  updateBadge?: (tabId?: number | null) => Promise<void>;
};

// ============================================================================
// Declare service-worker global for online/offline events
// ============================================================================

declare const self: typeof globalThis & {
  addEventListener(type: string, listener: () => void): void;
};

// ============================================================================
// Constants
// ============================================================================

const TAG = '[EasyCloud]';
const ALARM_NAME = 'easycloud-periodic-sync';
const DEBOUNCE_ALARM_NAME = 'easycloud-debounce-sync';
const ALARM_PERIOD_MINUTES = 15;
const DEBOUNCE_MS = 5000;
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_FILE_NAME = 'scriptvault-sync.json';
const STORAGE_KEY_PREFIX = 'easycloud_';
const EASYCLOUD_RATE_LIMIT_DEFAULT_RETRY_MS = 60_000;
const EASYCLOUD_RATE_LIMIT_MAX_RETRY_MS = 6 * 60 * 60 * 1000;

// Storage keys
const KEYS = {
  CONNECTED:     STORAGE_KEY_PREFIX + 'connected',
  DEVICE_ID:     STORAGE_KEY_PREFIX + 'deviceId',
  LAST_SYNC:     STORAGE_KEY_PREFIX + 'lastSync',
  STATUS:        STORAGE_KEY_PREFIX + 'status',
  OFFLINE_QUEUE: STORAGE_KEY_PREFIX + 'offlineQueue',
  USER_EMAIL:    STORAGE_KEY_PREFIX + 'userEmail',
  USER_NAME:     STORAGE_KEY_PREFIX + 'userName',
  FILE_ID:       STORAGE_KEY_PREFIX + 'fileId',
} as const;

// Sync statuses
const STATUS = {
  IDLE:    'synced',
  SYNCING: 'syncing',
  ERROR:   'error',
  OFFLINE: 'offline',
} as const;

// ============================================================================
// Internal state
// ============================================================================

let _status: string = STATUS.IDLE;
let _syncInProgress = false;
let _statusListeners: StatusCallback[] = [];
let _cachedToken: string | null = null;
let _cachedFileId: string | null = null;
let _deviceId: string | null = null;
let _initialized = false;

type SyncEngineLock = { owner: string; token: symbol; startedAt: number };
type SyncEngineLockHost = typeof globalThis & {
  __scriptVaultSyncEngineLock?: SyncEngineLock;
};

function acquireSyncEngineLock(owner: string): (() => void) | null {
  const host = globalThis as SyncEngineLockHost;
  if (host.__scriptVaultSyncEngineLock) return null;
  const token = Symbol(owner);
  host.__scriptVaultSyncEngineLock = { owner, token, startedAt: Date.now() };
  return () => {
    if (host.__scriptVaultSyncEngineLock?.token === token) {
      delete host.__scriptVaultSyncEngineLock;
    }
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wraps `fetch` with an AbortController timeout to prevent service worker hangs.
 * @param url - Request URL
 * @param options - Standard RequestInit (do not include a signal — one is added here)
 * @param timeoutMs - Abort after this many milliseconds (default: 30 000)
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const externalSignal = options.signal;
  const { signal: _ignoredSignal, ...fetchOptions } = options;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
  const response = await fetch(url, { ...fetchOptions, signal });
  await throwIfEasyCloudRateLimited(response, url);
  return response;
}

function isEasyCloudRateLimitError(error: unknown): error is EasyCloudRateLimitError {
  return Boolean(error && typeof error === 'object' &&
    (error as Partial<EasyCloudRateLimitError>).rateLimited === true &&
    Number.isFinite((error as Partial<EasyCloudRateLimitError>).retryAfterMs));
}

function parseEasyCloudRetryAfterMs(response: Response): number {
  const raw = response.headers?.get?.('Retry-After')?.trim() || '';
  let requestedMs = EASYCLOUD_RATE_LIMIT_DEFAULT_RETRY_MS;
  const seconds = Number(raw);
  if (raw && Number.isFinite(seconds) && seconds >= 0) {
    requestedMs = seconds * 1000;
  } else if (raw) {
    const retryAt = Date.parse(raw);
    if (Number.isFinite(retryAt)) requestedMs = retryAt - Date.now();
  }
  return Math.min(EASYCLOUD_RATE_LIMIT_MAX_RETRY_MS, Math.max(1000, Math.round(requestedMs)));
}

async function isEasyCloudQuotaResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  try {
    const body = await response.clone().json() as unknown;
    const text = JSON.stringify(body).toLowerCase();
    return text.includes('userratelimitexceeded') ||
      text.includes('ratelimitexceeded') ||
      text.includes('quotaexceeded') ||
      text.includes('rate limit exceeded');
  } catch (_) {
    return false;
  }
}

async function throwIfEasyCloudRateLimited(response: Response, url: string): Promise<void> {
  const quota = response.status === 403 && /googleapis\.com/i.test(url) &&
    await isEasyCloudQuotaResponse(response);
  if (response.status !== 429 && !quota) return;
  const retryAfterMs = parseEasyCloudRetryAfterMs(response);
  const error = new Error(
    `Google Drive rate limited (${response.status}); retry after ${Math.ceil(retryAfterMs / 1000)}s`,
  ) as EasyCloudRateLimitError;
  error.rateLimited = true;
  error.retryAfterMs = retryAfterMs;
  error.status = response.status;
  throw error;
}

const EASYCLOUD_SYNC_PAYLOAD_MAX_BYTES = 64 * 1024 * 1024;
const EASYCLOUD_METADATA_MAX_BYTES = 4 * 1024 * 1024;
const EASYCLOUD_ERROR_MAX_BYTES = 256 * 1024;

async function readEasyCloudTextBounded(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<string> {
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
  let total = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    try { reader.releaseLock(); } catch (_) { /* already released */ }
  }
}

async function readEasyCloudJsonBounded<T>(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<T> {
  const text = await readEasyCloudTextBounded(response, maxBytes, label);
  try {
    return JSON.parse(text) as T;
  } catch (_) {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function discardEasyCloudResponse(response: Response): Promise<void> {
  try { await response.body?.cancel(); } catch (_) { /* response already closed */ }
}

function log(...args: unknown[]): void {
  console.log(TAG, ...args);
}

function warn(...args: unknown[]): void {
  console.warn(TAG, ...args);
}

function _getRuntimeHooks(): RuntimeHooks {
  return globalThis as RuntimeHooks;
}

async function _refreshScriptRuntime(script: Script): Promise<void> {
  const hooks = _getRuntimeHooks();
  if (typeof hooks.unregisterScript === 'function') {
    try {
      await hooks.unregisterScript(script.id);
    } catch (e: unknown) {
      warn(`Failed to unregister synced script ${script.id}:`, e);
    }
  }
  if (script.enabled !== false && typeof hooks.registerScript === 'function') {
    try {
      await hooks.registerScript(script);
    } catch (e: unknown) {
      warn(`Failed to register synced script ${script.id}:`, e);
    }
  }
}

async function _deleteSyncedScript(scriptId: string): Promise<void> {
  const hooks = _getRuntimeHooks();
  if (typeof hooks.unregisterScript === 'function') {
    try {
      await hooks.unregisterScript(scriptId);
    } catch (e: unknown) {
      warn(`Failed to unregister deleted synced script ${scriptId}:`, e);
    }
  }
  await ScriptStorage.delete(scriptId);
}

async function _updateBadgeIfAvailable(): Promise<void> {
  const hooks = _getRuntimeHooks();
  if (typeof hooks.updateBadge === 'function') {
    try {
      await hooks.updateBadge();
    } catch (e: unknown) {
      warn('Failed to refresh badge after sync:', e);
    }
  }
}

async function _mergeScriptText(base: string, local: string, remote: string): Promise<MergeResult> {
  if (typeof ScriptAnalyzer !== 'undefined' && typeof ScriptAnalyzer.mergeText === 'function') {
    return ScriptAnalyzer.mergeText(base, local, remote);
  }
  if (typeof ScriptAnalyzer !== 'undefined' && typeof ScriptAnalyzer._ensureOffscreen === 'function') {
    const ready = await ScriptAnalyzer._ensureOffscreen();
    if (!ready) throw new Error('No script merge engine available');
    return chrome.runtime.sendMessage({
      type: 'offscreen_merge',
      base,
      local,
      remote,
    }) as Promise<MergeResult>;
  }
  throw new Error('No script merge engine available');
}

const SYNC_SAFE_SCRIPT_SETTING_KEYS = new Set<string>([
  'autoUpdate',
  'notifyUpdates',
  'runAt',
  'injectInto',
  'frameMode',
  'notifyErrors',
  'notes',
  'useOriginalIncludes',
  'useOriginalMatches',
  'useOriginalExcludes',
  'userIncludes',
  'userMatches',
  'userExcludes',
  'pinned',
  'perfBudget',
  'syncValues',
  'tags',
  'localLibraries',
]);

const LOCAL_ONLY_SCRIPT_SETTING_KEYS = new Set<string>([
  'userModified',
  'mergeConflict',
  'syncLock',
  'sourceIdentityChanged',
  '_failedRequires',
  '_failedRequireErrors',
  '_registrationError',
]);

function cloneScriptSettingValue(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (_) {
      // Fall through to JSON clone.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch (_) {
    return undefined;
  }
}

function cloneSyncSafeScriptSettings(settings: unknown): ScriptSettings {
  if (!settings || typeof settings !== 'object') return {};
  const result: ScriptSettings = {};
  for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
    if (!SYNC_SAFE_SCRIPT_SETTING_KEYS.has(key) || LOCAL_ONLY_SCRIPT_SETTING_KEYS.has(key)) {
      continue;
    }
    result[key] = key === 'localLibraries'
      ? normalizeLocalLibrarySnapshots(value)
      : cloneScriptSettingValue(value);
  }
  return result;
}

function mergeSyncedScriptSettings(
  localSettings: unknown,
  remoteSettings: unknown,
  options: { mergeConflict?: boolean } = {},
): ScriptSettings {
  return {
    ...((localSettings && typeof localSettings === 'object')
      ? localSettings as ScriptSettings
      : {}),
    ...cloneSyncSafeScriptSettings(remoteSettings),
    ...(options.mergeConflict ? { mergeConflict: true } : {}),
  };
}

function sanitizeSyncScriptForEnvelope(script: SyncScript): SyncScript {
  return {
    ...script,
    settings: cloneSyncSafeScriptSettings(script.settings),
  };
}

function sanitizeSyncEnvelopeForUpload(envelope: SyncEnvelope): SyncEnvelope {
  return {
    ...envelope,
    scripts: (envelope.scripts || []).map((script) => sanitizeSyncScriptForEnvelope(script)),
  };
}

async function getSyncCryptoSettings(): Promise<Record<string, unknown>> {
  // Do NOT swallow read failures to `{}`: an empty settings object reports
  // encryption disabled, which would silently upload plaintext scripts/values
  // under an E2EE expectation and disable the plaintext-rejection guard on
  // download. Fail the sync instead.
  if (typeof SettingsManager.get !== 'function') {
    throw new Error('Settings unavailable for sync encryption');
  }
  return await SettingsManager.get();
}

async function markSyncEncryptionEstablished(settings: Record<string, unknown>): Promise<void> {
  if (settings.syncEncryptionEnabled === true && settings.syncEncryptionEstablished !== true) {
    try { await SettingsManager.set('syncEncryptionEstablished', true); } catch (_) { /* best effort */ }
  }
}

async function readSyncEnvelopeFromRemote(remoteEnvelope: RemoteSyncEnvelope | null): Promise<SyncEnvelope | null> {
  const settings = await getSyncCryptoSettings();
  const decrypted = await SyncCrypto.decryptSyncEnvelope(
    remoteEnvelope,
    settings,
  ) as SyncEnvelope | null;
  if (remoteEnvelope && SyncCrypto.isEncryptedSyncEnvelope(remoteEnvelope)) {
    await markSyncEncryptionEstablished(settings);
  }
  return decrypted;
}

async function prepareSyncEnvelopeForRemoteUpload(envelope: SyncEnvelope): Promise<{
  envelope: RemoteSyncEnvelope;
  settings: Record<string, unknown>;
}> {
  const settings = await getSyncCryptoSettings();
  return {
    envelope: await SyncCrypto.prepareSyncEnvelopeForUpload(
      sanitizeSyncEnvelopeForUpload(envelope),
      settings,
    ),
    settings,
  };
}

async function uploadSyncEnvelopeToDrive(token: string, envelope: SyncEnvelope): Promise<void> {
  const prepared = await prepareSyncEnvelopeForRemoteUpload(envelope);
  await _uploadToDrive(token, prepared.envelope);
  await markSyncEncryptionEstablished(prepared.settings);
}

type ScriptOperationLockHost = typeof globalThis & {
  _toggleLocks?: Map<string, Promise<unknown>>;
};

function getScriptOperationLocks(): Map<string, Promise<unknown>> {
  const host = globalThis as ScriptOperationLockHost;
  if (!host._toggleLocks) host._toggleLocks = new Map();
  return host._toggleLocks;
}

async function runExclusiveScriptOperation<T>(scriptId: string, operation: () => Promise<T>): Promise<T> {
  if (!scriptId) return await operation();
  const locks = getScriptOperationLocks();
  const previous = locks.get(scriptId) || Promise.resolve();
  let operationPromise: Promise<T>;
  operationPromise = previous
    .catch(() => {})
    .then(operation)
    .finally(() => {
      if (locks.get(scriptId) === operationPromise) {
        locks.delete(scriptId);
      }
    });
  locks.set(scriptId, operationPromise);
  return await operationPromise;
}

/**
 * Record the code we just uploaded as this device's new 3-way-merge base.
 *
 * Mirrors advanceSyncBaseAfterUpload in cloud-sync.ts. syncBaseCode was only
 * written when the apply loop actually saved a remote change, so a device that
 * merely uploaded its own edits kept merging against a stale (or null)
 * ancestor and eventually produced conflict markers in a script that was only
 * ever edited on one machine.
 */
async function _advanceSyncBaseAfterUpload(uploaded: SyncScript[] | undefined): Promise<void> {
  for (const uploadedScript of uploaded || []) {
    if (!uploadedScript?.id || typeof uploadedScript.code !== 'string') continue;
    try {
      await runExclusiveScriptOperation(uploadedScript.id, async () => {
        const current = await ScriptStorage.get(uploadedScript.id);
        if (!current) return;
        // Edited while the upload was in flight — leave the base alone.
        if (current.code !== uploadedScript.code) return;
        if (current.syncBaseCode === uploadedScript.code) return;
        await ScriptStorage.set(uploadedScript.id, {
          ...current,
          syncBaseCode: uploadedScript.code,
        } as Script);
      });
    } catch (e) {
      warn('Failed to advance sync base for', uploadedScript.id, e);
    }
  }
}

function setStatus(newStatus: string): void {
  if (_status === newStatus) return;
  _status = newStatus;
  _persistStatus(newStatus);
  for (const cb of _statusListeners) {
    try { cb(newStatus); } catch (e) { warn('Status listener error:', e); }
  }
}

async function _persistStatus(status: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEYS.STATUS]: status });
  } catch (_) { /* best effort */ }
}

async function _getStorageValues(keys: string[]): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(keys);
}

async function _setStorageValues(obj: Record<string, unknown>): Promise<void> {
  return chrome.storage.local.set(obj);
}

/**
 * Generate or retrieve a stable device ID for conflict resolution.
 */
async function _ensureDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  const data = await _getStorageValues([KEYS.DEVICE_ID]);
  const storedId = data[KEYS.DEVICE_ID];
  if (typeof storedId === 'string' && storedId) {
    _deviceId = storedId;
    return _deviceId;
  }
  // Generate a new device ID
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  _deviceId = Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
  await _setStorageValues({ [KEYS.DEVICE_ID]: _deviceId });
  return _deviceId;
}

function _isOnline(): boolean {
  // In service worker context, navigator.onLine is available
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// ============================================================================
// Token management via chrome.identity
// ============================================================================

/**
 * Get a valid OAuth token using Chrome's built-in identity API.
 */
async function _getAuthToken(interactive = false): Promise<string> {
  if (!chrome.identity || !chrome.identity.getAuthToken) {
    throw new Error('chrome.identity API not available. Grant the "identity" permission.');
  }

  try {
    // chrome.identity.getAuthToken returns { token } in MV3
    const result = await chrome.identity.getAuthToken({
      interactive,
      scopes: [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    });

    const token: unknown = (result as { token?: string })?.token || result;
    if (!token || typeof token !== 'string') {
      throw new Error('No token returned from chrome.identity');
    }

    _cachedToken = token;
    return token;
  } catch (e) {
    _cachedToken = null;
    throw e;
  }
}

/**
 * Remove cached token and force a fresh one.
 */
async function _refreshToken(): Promise<string> {
  if (_cachedToken) {
    try {
      await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
    } catch (_) { /* ignore */ }
    _cachedToken = null;
  }
  return _getAuthToken(false);
}

/**
 * Get a valid token, refreshing if needed.
 */
async function _getValidToken(): Promise<string | null> {
  // Try cached first
  if (_cachedToken) {
    const ok = await _testToken(_cachedToken);
    if (ok) return _cachedToken;
    // Invalidate and retry
    try {
      await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
    } catch (_) { /* ignore */ }
    _cachedToken = null;
  }

  // Try non-interactive (uses cached Chrome session)
  try {
    return await _getAuthToken(false);
  } catch (_) {
    return null;
  }
}

async function _testToken(token: string): Promise<boolean> {
  try {
    const resp = await fetchWithTimeout(`${DRIVE_API}/about?fields=user`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }, 10_000);
    const ok = resp.ok;
    await discardEasyCloudResponse(resp);
    return ok;
  } catch (e: unknown) {
    if (isEasyCloudRateLimitError(e)) throw e;
    return false;
  }
}

// ============================================================================
// Google Drive operations (appDataFolder)
// ============================================================================

/**
 * Find the sync file in appDataFolder.
 */
async function _findSyncFile(token: string): Promise<string | null> {
  // Check cached file ID first
  if (_cachedFileId) {
    // Verify it still exists
    try {
      const resp = await fetchWithTimeout(
        `${DRIVE_API}/files/${_cachedFileId}?fields=id,modifiedTime`,
        { headers: { 'Authorization': `Bearer ${token}` } },
        10_000,
      );
      const exists = resp.ok;
      await discardEasyCloudResponse(resp);
      if (exists) return _cachedFileId;
    } catch (e: unknown) {
      if (isEasyCloudRateLimitError(e)) throw e;
      /* fall through to search */
    }
    _cachedFileId = null;
  }

  // Search for the file
  const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
  const resp = await fetchWithTimeout(
    `${DRIVE_API}/files?q=${query}&spaces=appDataFolder&fields=files(id,modifiedTime)`,
    { headers: { 'Authorization': `Bearer ${token}` } },
    15_000,
  );

  if (!resp.ok) {
    await discardEasyCloudResponse(resp);
    throw new Error(`Drive file search failed: ${resp.status}`);
  }

  const data = await readEasyCloudJsonBounded<DriveFileSearchResult>(
    resp,
    EASYCLOUD_METADATA_MAX_BYTES,
    'Drive file search response',
  );
  const file = data.files?.[0];
  if (file) {
    _cachedFileId = file.id;
    await _setStorageValues({ [KEYS.FILE_ID]: file.id });
  }
  return file?.id ?? null;
}

/**
 * Download sync data from Drive appDataFolder.
 */
async function _downloadFromDrive(token: string): Promise<RemoteSyncEnvelope | null> {
  const fileId = await _findSyncFile(token);
  if (!fileId) return null;

  const resp = await fetchWithTimeout(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { 'Authorization': `Bearer ${token}` } },
    60_000,
  );

  if (resp.status === 404) {
    _cachedFileId = null;
    await discardEasyCloudResponse(resp);
    return null;
  }
  if (!resp.ok) {
    await discardEasyCloudResponse(resp);
    throw new Error(`Drive download failed: ${resp.status}`);
  }

  return await readEasyCloudJsonBounded<RemoteSyncEnvelope>(
    resp,
    EASYCLOUD_SYNC_PAYLOAD_MAX_BYTES,
    'EasyCloud backup',
  );
}

/**
 * Upload sync data to Drive appDataFolder.
 */
async function _uploadToDrive(token: string, data: RemoteSyncEnvelope): Promise<void> {
  const fileId = await _findSyncFile(token);

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: SYNC_FILE_NAME,
    mimeType: 'application/json',
  };
  if (!fileId) {
    metadata.parents = ['appDataFolder'];
  }

  const boundary = '---EasyCloud' + crypto.getRandomValues(new Uint8Array(8))
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

  const url = fileId
    ? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart`;

  const resp = await fetchWithTimeout(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  }, 60_000);

  if (!resp.ok) {
    const errText = await readEasyCloudTextBounded(
      resp,
      EASYCLOUD_ERROR_MAX_BYTES,
      'Drive upload error',
    ).catch(() => '');
    throw new Error(`Drive upload failed (${resp.status}): ${errText}`);
  }

  const result = await readEasyCloudJsonBounded<DriveUploadResult>(
    resp,
    EASYCLOUD_METADATA_MAX_BYTES,
    'Drive upload response',
  );
  if (result.id && !_cachedFileId) {
    _cachedFileId = result.id;
    await _setStorageValues({ [KEYS.FILE_ID]: result.id });
  }
}

// ============================================================================
// Offline queue
// ============================================================================

async function _enqueueOfflineChange(change: Omit<OfflineChange, 'queuedAt'>): Promise<void> {
  const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
  const raw = data[KEYS.OFFLINE_QUEUE];
  const queue: OfflineChange[] = Array.isArray(raw) ? (raw as OfflineChange[]) : [];
  queue.push({ ...change, queuedAt: Date.now() });
  // Cap queue to 500 entries to avoid storage bloat
  if (queue.length > 500) queue.splice(0, queue.length - 500);
  await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: queue });
}

async function _drainOfflineQueue(): Promise<void> {
  const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
  const raw = data[KEYS.OFFLINE_QUEUE];
  const queue: OfflineChange[] = Array.isArray(raw) ? (raw as OfflineChange[]) : [];
  if (queue.length === 0) return;

  log(`Draining offline queue (${queue.length} entries)`);
  // Clear queue first (sync will pick up current state)
  await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: [] });
  // Trigger a full sync — the current local state already includes queued changes
  await _performSync();
}

// ============================================================================
// Merge logic
// ============================================================================

/**
 * Merge local and remote sync data with multi-device conflict resolution.
 */
async function _mergeData(
  localData: SyncEnvelope,
  remoteData: SyncEnvelope,
  deviceId: string,
  policy: unknown = 'hlc',
): Promise<SyncEnvelope> {
  const localScripts = new Map<string, SyncScript>(
    (localData.scripts || []).map((s: SyncScript) => [s.id, s])
  );
  const remoteScripts = new Map<string, SyncScript>(
    (remoteData.scripts || []).map((s: SyncScript) => [s.id, s])
  );

  // Merge tombstones — union of all known deletions
  const localTombstones: Record<string, unknown> = localData.tombstones || {};
  const remoteTombstones: Record<string, unknown> = remoteData.tombstones || {};
  const mergedTombstones = pruneSyncTombstones({ ...localTombstones, ...remoteTombstones });

  // Collect all script IDs
  const allIds = new Set<string>([...localScripts.keys(), ...remoteScripts.keys()]);
  const mergedScripts: SyncScript[] = [];

  for (const id of allIds) {
    const local = localScripts.get(id);
    const remote = remoteScripts.get(id);

    // Resurrection: a script saved AFTER its tombstone was written (restore-
    // from-trash, ID-preserving import) wins over the tombstone. Without this,
    // the tombstone re-deletes the restored script on the next sync. Check the
    // unfiltered local/remote candidate before skipping tombstoned ids.
    const tombstoneTs = mergedTombstones[id];
    if (typeof tombstoneTs === 'number') {
      const candidateTs = Math.max(local?.updatedAt || 0, remote?.updatedAt || 0);
      if (candidateTs > tombstoneTs) {
        delete mergedTombstones[id];
      } else {
        continue; // genuine deletion — deletion wins
      }
    } else if (mergedTombstones[id]) {
      continue; // legacy non-timestamp tombstone — deletion wins
    }

    if (!remote) {
      // Only local — keep it
      if (local) mergedScripts.push(sanitizeSyncScriptForEnvelope(local));
      continue;
    }

    if (!local) {
      // Only remote — import it
      mergedScripts.push(sanitizeSyncScriptForEnvelope(remote));
      continue;
    }

    // Both exist — merge
    const merged: SyncScript = sanitizeSyncScriptForEnvelope(local);
    const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);

    // Enable/disable: newest wins
    if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
      merged.enabled = remote.enabled;
      merged.position = remote.position;
      merged.settings = mergeSyncedScriptSettings(local.settings, remote.settings);
    }

    // Code merge
    if (local.code !== remote.code) {
      // Use the LOCAL device's recorded sync base as the 3-way ancestor. Empty
      // string is a valid base (only null/undefined means "no base recorded");
      // do NOT fall back to the remote device's base, which is a different
      // ancestor and produces a wrong merge.
      const base: string | null = local.syncBaseCode ?? null;

      const localChangedFromBase = base != null && local.code !== base;
      const remoteChangedFromBase = base != null && remote.code !== base;

      if (base != null && localChangedFromBase !== remoteChangedFromBase) {
        // Exactly one side changed code; that code wins regardless of the
        // other side's newer metadata timestamp.
        merged.code = localChangedFromBase ? local.code : remote.code;
      } else if (base != null && localChangedFromBase && remoteChangedFromBase) {
        // Both sides changed since base — attempt 3-way merge. Chrome routes
        // through the offscreen document; Firefox runs Diff inline.
        try {
          const mergeResult = await _mergeScriptText(base, local.code, remote.code);
          if (mergeResult && !mergeResult.error) {
            merged.code = mergeResult.merged ?? merged.code;
            if (mergeResult.conflicts) {
              merged.settings = mergeSyncedScriptSettings(merged.settings, {}, {
                mergeConflict: true,
              });
            }
            log(`3-way merge for ${id}: conflicts=${String(mergeResult.conflicts || false)}`);
          } else {
            // Merge failed — newest wins
            merged.code = localNewer ? local.code : remote.code;
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          warn(`3-way merge failed for ${id}:`, msg);
          merged.code = localNewer ? local.code : remote.code;
        }
      } else {
        // Only one side changed, or no base — newest wins
        merged.code = localNewer ? local.code : remote.code;
      }
    }

    merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
    merged.syncBaseCode = merged.code;
    merged.lastSyncDevice = deviceId;
    mergedScripts.push(merged);
  }

  const mergedScriptById = new Map(mergedScripts.map((script) => [script.id, script]));
  const localValueBundles = getValueBundles(localData);
  const remoteValueBundles = getValueBundles(remoteData);
  const mergedValueBundles: Record<string, GmValueSyncBundle> = {};
  const valueBundleIds = new Set([...Object.keys(localValueBundles), ...Object.keys(remoteValueBundles)]);
  for (const scriptId of valueBundleIds) {
    const script = mergedScriptById.get(scriptId);
    if (!script || !shouldSyncScriptValues(script)) continue;
    const localBundle = localValueBundles[scriptId];
    const remoteBundle = remoteValueBundles[scriptId];
    if (!localBundle && !remoteBundle) continue;
    let bundle: GmValueSyncBundle | null = null;
    if (localBundle && remoteBundle) {
      const mergedValues = mergeGmValueSyncValues(
        localBundle.values,
        localBundle.keyMetadata,
        remoteBundle.values,
        remoteBundle.keyMetadata,
        {
          policy,
          localConflicts: localBundle.conflicts,
          remoteConflicts: remoteBundle.conflicts,
        },
      );
      bundle = buildGmValueSyncBundle(script, mergedValues.values, {
        keyMetadata: mergedValues.keyMetadata,
        conflicts: mergedValues.conflicts,
      }).bundle;
    } else {
      const source = localBundle || remoteBundle;
      bundle = source
        ? buildGmValueSyncBundle(script, source.values, {
            lastValueUpdatedAt: source.lastValueUpdatedAt,
            keyMetadata: source.keyMetadata,
            conflicts: source.conflicts,
          }).bundle
        : null;
    }
    if (bundle) mergedValueBundles[scriptId] = bundle;
  }

  return {
    version: 1,
    timestamp: Date.now(),
    deviceId,
    scripts: mergedScripts,
    tombstones: mergedTombstones,
    ...(Object.keys(mergedValueBundles).length > 0 ? { valueBundles: mergedValueBundles } : {}),
  };
}

// ============================================================================
// Core sync
// ============================================================================

async function _performSync(): Promise<SyncResult> {
  if (_syncInProgress) {
    log('Sync already in progress, skipping');
    return { skipped: true };
  }

  // Debounced and periodic alarms can outlive a disconnect. Read the durable
  // connected flag before acquiring a token so a stale alarm cannot resurrect
  // uploads after the user has disconnected.
  const connectedData = await _getStorageValues([KEYS.CONNECTED]);
  if (!connectedData[KEYS.CONNECTED]) {
    log('Sync skipped: EasyCloud is disconnected');
    return { skipped: true };
  }

  if (!_isOnline()) {
    setStatus(STATUS.OFFLINE);
    return { offline: true };
  }

  const releaseSyncEngineLock = acquireSyncEngineLock('easycloud');
  if (!releaseSyncEngineLock) {
    log('Another sync engine is already in progress, skipping');
    return { skipped: true };
  }

  _syncInProgress = true;
  setStatus(STATUS.SYNCING);

  try {
    const token = await _getValidToken();
    if (!token) {
      setStatus(STATUS.ERROR);
      return { error: 'Not authenticated' };
    }

    const deviceId = await _ensureDeviceId();
    const syncSettings = typeof SettingsManager.get === 'function'
      ? await SettingsManager.get()
      : {};
    const gmValueSyncPolicy = normalizeGmValueSyncPolicy(syncSettings?.gmValueSyncConflictPolicy);

    // Load tombstones
    const tombstoneData = await _getStorageValues(['syncTombstones']);
    const storedTombstones =
      (tombstoneData['syncTombstones'] as Record<string, unknown> | undefined) || {};
    const tombstones = pruneSyncTombstones(storedTombstones);
    if (tombstoneMapsDiffer(storedTombstones, tombstones)) {
      await _setStorageValues({ syncTombstones: tombstones });
    }

    // Build local data snapshot
    const scripts: Script[] = await ScriptStorage.getAll();
    const localSyncScripts: SyncScript[] = scripts.map((s: Script) => ({
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      settings: cloneSyncSafeScriptSettings(s.settings),
      updatedAt: s.updatedAt || 0,
      syncBaseCode: s.syncBaseCode || null,
    }));
    const localValueBundles = await _buildValueBundles(localSyncScripts);
    const localData: SyncEnvelope = {
      version: 1,
      timestamp: Date.now(),
      deviceId,
      scripts: localSyncScripts,
      tombstones,
      ...(Object.keys(localValueBundles).length > 0 ? { valueBundles: localValueBundles } : {}),
    };

    // Download remote
    const remoteEnvelope = await _downloadFromDrive(token);
    const remoteData = await readSyncEnvelopeFromRemote(remoteEnvelope);

    if (remoteData) {
      // Merge
      const merged = await _mergeData(localData, remoteData, deviceId, gmValueSyncPolicy);
      const mergedTombstones = pruneSyncTombstones(merged.tombstones || {});
      let localMutated = false;

      for (const localScript of scripts) {
        if (!mergedTombstones[localScript.id]) continue;
        const deleted = await runExclusiveScriptOperation(localScript.id, async () => {
          await _deleteSyncedScript(localScript.id);
          return true;
        });
        if (deleted) localMutated = true;
      }

      // Apply merged scripts locally
      for (const script of merged.scripts) {
        if (mergedTombstones[script.id]) continue;

        const applied = await runExclusiveScriptOperation(script.id, async () => {
        const existing: Script | null = await ScriptStorage.get(script.id);

        // Skip user-modified scripts
        if (existing?.settings?.userModified) return false;

        // Save when the merged script is new, the remote side is newer, OR a
        // clean 3-way merge produced text that differs from the local copy — a
        // clean merge must not be discarded just because the local timestamp
        // wins (merged.updatedAt = max(local, remote) equals local's own).
        // The code-differs clause is gated on the merge's timestamp not being
        // OLDER than the current local copy: a save the user made DURING the
        // sync bumps `existing.updatedAt` above the merge inputs, and must not
        // be overwritten by the stale merged text (mirrors the main cloud-sync
        // apply guard).
        const existingUpdatedAt = existing?.updatedAt || 0;
        const mergeChangedCode = !!existing && script.code !== existing.code && script.updatedAt >= existingUpdatedAt;
        if (!existing || script.updatedAt > existingUpdatedAt || mergeChangedCode) {
          const parsed = typeof parseUserscript === 'function'
            ? parseUserscript(script.code)
            : { meta: {} as ScriptMeta, error: null };

          if (!parsed.error) {
            // Spread `existing` first so local-only fields (versionHistory,
            // trustReceipt, stats, HTTP cache validators) survive the apply.
            const nextScript = {
              ...(existing || {}),
              id: script.id,
              code: script.code,
              meta: parsed.meta,
              enabled: script.enabled,
              position: script.position,
              settings: mergeSyncedScriptSettings(existing?.settings, script.settings),
              updatedAt: script.updatedAt,
              createdAt: existing?.createdAt || script.updatedAt,
              syncBaseCode: script.code,
            } as Script;
            await ScriptStorage.set(script.id, nextScript);
            await _refreshScriptRuntime(nextScript);
            return true;
          }
        }
        return false;
        });
        if (applied) localMutated = true;
      }

      // Persist merged tombstones whenever the set CHANGED (added OR removed) —
      // a resurrection removes a tombstone without growing the count, and that
      // removal must stick locally so it does not re-resurrect-and-redelete.
      const tombstonesChanged = tombstoneMapsDiffer(tombstones, mergedTombstones);
      if (tombstonesChanged) {
        await chrome.storage.local.set({ syncTombstones: mergedTombstones });
      }

      if (localMutated) {
        await _updateBadgeIfAvailable();
      }

      await _applyValueBundles(merged.valueBundles || {}, gmValueSyncPolicy);

      // Upload merged data
      merged.timestamp = Date.now();
      await uploadSyncEnvelopeToDrive(token, merged);
      await _advanceSyncBaseAfterUpload(merged.scripts);
    } else {
      // First sync — upload local data
      await uploadSyncEnvelopeToDrive(token, localData);
      await _advanceSyncBaseAfterUpload(localData.scripts);
    }

    const now = Date.now();
    await _setStorageValues({ [KEYS.LAST_SYNC]: now });

    // Also update the global lastSync for compatibility with existing CloudSync
    try {
      await SettingsManager.set('lastSync', now);
    } catch (_) { /* best effort */ }

    setStatus(STATUS.IDLE);
    log('Sync completed successfully');
    return { success: true, timestamp: now };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warn('Sync failed:', e);
    setStatus(STATUS.ERROR);
    if (isEasyCloudRateLimitError(e)) {
      return { error: msg, rateLimited: true, retryAfterMs: e.retryAfterMs };
    }
    return { error: msg };
  } finally {
    _syncInProgress = false;
    releaseSyncEngineLock();
  }
}

// ============================================================================
// Debounced sync trigger
// ============================================================================

function _debouncedSync(): void {
  // Use alarms so the debounce survives MV3 service-worker suspension.
  chrome.alarms.create(DEBOUNCE_ALARM_NAME, {
    delayInMinutes: DEBOUNCE_MS / 60000,
  });
}

// ============================================================================
// Alarm-based periodic sync
// ============================================================================

async function _setupPeriodicSync(): Promise<void> {
  try {
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: ALARM_PERIOD_MINUTES,
      periodInMinutes: ALARM_PERIOD_MINUTES,
    });
  } catch (e) {
    warn('Failed to create periodic sync alarm:', e);
  }
}

async function _clearPeriodicSync(): Promise<void> {
  try {
    await chrome.alarms.clear(ALARM_NAME);
  } catch (_) { /* ignore */ }
}

async function _clearDebounceSync(): Promise<void> {
  try {
    await chrome.alarms.clear(DEBOUNCE_ALARM_NAME);
  } catch (_) { /* ignore */ }
}

function _handleAlarm(alarm: chrome.alarms.Alarm): void {
  if (alarm.name === DEBOUNCE_ALARM_NAME) {
    _performSync().catch((e: unknown) => warn('Debounced sync error:', e));
    return;
  }
  if (alarm.name !== ALARM_NAME) return;
  _performSync().catch((e: unknown) => warn('Periodic sync error:', e));
}

// ============================================================================
// Online/offline handling
// ============================================================================

function _handleOnline(): void {
  log('Back online, draining queue and syncing');
  _drainOfflineQueue().catch((e: unknown) => warn('Queue drain error:', e));
}

function _handleOffline(): void {
  log('Went offline');
  setStatus(STATUS.OFFLINE);
}

// ============================================================================
// Event listeners for auto-sync on script changes
// ============================================================================

function _setupStorageListener(): void {
  // Listen for script storage changes to trigger auto-sync
  chrome.storage.onChanged.addListener(
    (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return;

      // Check if userscripts data changed (ScriptStorage uses 'userscripts' key)
      if (changes['userscripts']) {
        _getStorageValues([KEYS.CONNECTED]).then((d: Record<string, unknown>) => {
          if (d[KEYS.CONNECTED]) {
            _debouncedSync();
          }
        }).catch(() => {});
      }
    }
  );
}

// ============================================================================
// Public API
// ============================================================================

export interface EasyCloudSyncAPI {
  init(): Promise<void>;
  connect(): Promise<ConnectResult>;
  disconnect(): Promise<DisconnectResult>;
  sync(): Promise<SyncResult>;
  getStatus(): Promise<EasyCloudStatus>;
  isConnected(): boolean;
  onStatusChange(callback: StatusCallback): () => void;
  notifyScriptSaved(scriptId: string): void;
  notifyScriptDeleted(scriptId: string): void;
}

export const EasyCloudSync: EasyCloudSyncAPI = {
  /**
   * Initialize EasyCloud sync. Call once on extension startup.
   */
  async init(): Promise<void> {
    if (_initialized) return;
    _initialized = true;

    // Restore cached state
    const data = await _getStorageValues([
      KEYS.CONNECTED,
      KEYS.DEVICE_ID,
      KEYS.STATUS,
      KEYS.FILE_ID,
    ]);

    const storedDeviceId = data[KEYS.DEVICE_ID];
    _deviceId = typeof storedDeviceId === 'string' ? storedDeviceId : null;

    const storedFileId = data[KEYS.FILE_ID];
    _cachedFileId = typeof storedFileId === 'string' ? storedFileId : null;

    const storedStatus = data[KEYS.STATUS];
    if (typeof storedStatus === 'string' && storedStatus) {
      _status = storedStatus;
    }

    // Set up storage change listener for auto-sync
    _setupStorageListener();

    // Set up alarm listener
    chrome.alarms.onAlarm.addListener(_handleAlarm);

    // Online/offline events (available in service workers)
    if (typeof self !== 'undefined') {
      self.addEventListener('online', _handleOnline);
      self.addEventListener('offline', _handleOffline);
    }

    // If already connected, start periodic sync and do initial sync
    if (data[KEYS.CONNECTED]) {
      if (!_isOnline()) {
        setStatus(STATUS.OFFLINE);
      } else {
        await _setupPeriodicSync();
        // Fire initial sync without blocking init
        _performSync().catch((e: unknown) => warn('Init sync error:', e));
      }
    }

    log('Initialized');
  },

  /**
   * Connect to Google Drive via chrome.identity (interactive sign-in).
   */
  async connect(): Promise<ConnectResult> {
    try {
      // Request identity permission if not already granted
      if (chrome.permissions && chrome.permissions.request) {
        const granted = await chrome.permissions.request({
          permissions: ['identity'],
        });
        if (!granted) {
          return { success: false, error: 'Identity permission denied' };
        }
      }

      // Interactive auth
      const token = await _getAuthToken(true);
      if (!token) {
        return { success: false, error: 'Authentication failed' };
      }

      // Fetch user info
      let user: UserInfoResult = {};
      try {
        const resp = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${token}` },
        }, 10_000);
        if (resp.ok) {
          user = await readEasyCloudJsonBounded<UserInfoResult>(
            resp,
            EASYCLOUD_METADATA_MAX_BYTES,
            'Google user response',
          );
        } else {
          await discardEasyCloudResponse(resp);
        }
      } catch (_) { /* non-fatal */ }

      await _ensureDeviceId();

      // Persist connected state
      await _setStorageValues({
        [KEYS.CONNECTED]: true,
        [KEYS.USER_EMAIL]: user.email || '',
        [KEYS.USER_NAME]: user.name || '',
      });

      // Start periodic sync
      await _setupPeriodicSync();

      // Trigger immediate sync
      _performSync().catch((e: unknown) => warn('Post-connect sync error:', e));

      setStatus(STATUS.IDLE);
      log('Connected as', user.email || '(unknown)');

      return {
        success: true,
        user: { email: user.email || '', name: user.name || '', picture: user.picture },
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warn('Connect failed:', e);
      return { success: false, error: msg };
    }
  },

  /**
   * Disconnect from Google Drive. Revokes token and clears state.
   */
  async disconnect(): Promise<DisconnectResult> {
    try {
      // Revoke token
      if (_cachedToken) {
        try {
          await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
          // Revoke via POST body (not URL query) so the token does not leak into
          // request lines, proxy logs, or history. Mirrors the regular Google
          // Drive provider's revoke path (sync-providers.ts).
          fetchWithTimeout(`https://accounts.google.com/o/oauth2/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `token=${encodeURIComponent(_cachedToken)}`,
          }, 10_000).then(discardEasyCloudResponse).catch(() => {});
        } catch (_) { /* best effort */ }
        _cachedToken = null;
      }

      // Clear periodic sync
      await _clearPeriodicSync();
      await _clearDebounceSync();

      // Clear stored state
      await _setStorageValues({
        [KEYS.CONNECTED]: false,
        [KEYS.USER_EMAIL]: '',
        [KEYS.USER_NAME]: '',
        [KEYS.FILE_ID]: '',
        [KEYS.OFFLINE_QUEUE]: [],
        [KEYS.STATUS]: STATUS.IDLE,
      });

      _cachedFileId = null;
      _status = STATUS.IDLE;

      // Notify listeners
      for (const cb of _statusListeners) {
        try { cb(STATUS.IDLE); } catch (_) { /* ignore */ }
      }

      log('Disconnected');
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warn('Disconnect error:', e);
      return { success: false, error: msg };
    }
  },

  /**
   * Trigger an immediate sync. Returns sync result.
   */
  async sync(): Promise<SyncResult> {
    if (!_isOnline()) {
      setStatus(STATUS.OFFLINE);
      return { offline: true };
    }

    const data = await _getStorageValues([KEYS.CONNECTED]);
    if (!data[KEYS.CONNECTED]) {
      return { error: 'Not connected. Call connect() first.' };
    }

    return _performSync();
  },

  /**
   * Get current sync status and metadata.
   */
  async getStatus(): Promise<EasyCloudStatus> {
    const data = await _getStorageValues([
      KEYS.CONNECTED,
      KEYS.LAST_SYNC,
      KEYS.STATUS,
      KEYS.USER_EMAIL,
      KEYS.USER_NAME,
      KEYS.DEVICE_ID,
    ]);

    const storedStatus = data[KEYS.STATUS];
    const lastSync = data[KEYS.LAST_SYNC];
    const userEmail = data[KEYS.USER_EMAIL];
    const userName = data[KEYS.USER_NAME];
    const storedDeviceId = data[KEYS.DEVICE_ID];

    return {
      connected: !!data[KEYS.CONNECTED],
      status: (typeof storedStatus === 'string' ? storedStatus : '') || _status,
      lastSync: typeof lastSync === 'number' ? lastSync : null,
      user: data[KEYS.CONNECTED]
        ? {
            email: typeof userEmail === 'string' ? userEmail : '',
            name: typeof userName === 'string' ? userName : '',
          }
        : null,
      deviceId: typeof storedDeviceId === 'string' ? storedDeviceId : null,
      online: _isOnline(),
    };
  },

  /**
   * Check if currently connected (synchronous, uses cached state).
   */
  isConnected(): boolean {
    return _status !== STATUS.ERROR && _cachedToken !== null;
  },

  /**
   * Register a status change callback. Returns an unsubscribe function.
   */
  onStatusChange(callback: StatusCallback): () => void {
    if (typeof callback !== 'function') {
      throw new TypeError('onStatusChange requires a function callback');
    }
    _statusListeners.push(callback);
    return () => {
      _statusListeners = _statusListeners.filter((cb: StatusCallback) => cb !== callback);
    };
  },

  /**
   * Notify EasyCloud that a script was saved (triggers debounced sync).
   */
  notifyScriptSaved(scriptId: string): void {
    if (!_isOnline()) {
      _enqueueOfflineChange({ type: 'save', scriptId, timestamp: Date.now() });
      return;
    }
    _debouncedSync();
  },

  /**
   * Notify EasyCloud that a script was deleted (triggers debounced sync).
   */
  notifyScriptDeleted(scriptId: string): void {
    if (!_isOnline()) {
      _enqueueOfflineChange({ type: 'delete', scriptId, timestamp: Date.now() });
      return;
    }
    _debouncedSync();
  },
};

// ============================================================================
// Register as a CloudSyncProvider for integration with existing sync UI
// ============================================================================

if (typeof CloudSyncProviders !== 'undefined') {
  CloudSyncProviders['easycloud'] = {
    name: 'EasyCloud (Google)',
    icon: '\u26A1',
    requiresAuth: false,
    requiresOAuth: false,
    isZeroConfig: true,
    supportsManualSync: true,
    supportsDryRun: false,

    getStorageDisclosure(_settings: unknown): {
      storage: string;
      protection: string;
      fields: Array<{ key: string; label: string; type: string; present: boolean }>;
      hasStoredSecrets: boolean;
      revokeAction: string;
      notes: string;
    } {
      return {
        storage: 'chrome.storage.local + chrome.identity',
        protection: 'Extension-scoped browser storage plus Chrome identity token cache; ScriptVault does not persist EasyCloud OAuth tokens directly.',
        fields: [
          { key: 'easycloud_connected', label: 'EasyCloud connected flag', type: 'metadata', present: false },
          { key: 'easycloud_deviceId', label: 'EasyCloud device ID', type: 'metadata', present: false },
          { key: 'easycloud_userEmail', label: 'Connected Google account email', type: 'metadata', present: false },
          { key: 'easycloud_userName', label: 'Connected Google account name', type: 'metadata', present: false },
          { key: 'chrome.identity token cache', label: 'Google OAuth token cache managed by Chrome', type: 'token', present: false },
        ],
        hasStoredSecrets: false,
        revokeAction: 'Remove the Chrome identity cached token and clear EasyCloud local metadata.',
        notes: 'EasyCloud uses chrome.identity for zero-config Google Drive app-data sync.',
      };
    },

    async connect(): Promise<ConnectResult> {
      return EasyCloudSync.connect();
    },

    async disconnect(): Promise<DisconnectResult> {
      return EasyCloudSync.disconnect();
    },

    async sync(_settings?: unknown, _options?: { signal?: AbortSignal }): Promise<SyncResult> {
      return EasyCloudSync.sync();
    },

    async upload(_data: unknown, _settings: unknown): Promise<{ success: boolean; timestamp: number }> {
      // EasyCloud manages its own upload via sync(); this remains for direct
      // provider API compatibility outside CloudSync's provider-owned path.
      const result = await EasyCloudSync.sync();
      if (result.error) throw new Error(result.error);
      return { success: true, timestamp: Date.now() };
    },

    async download(_settings: unknown): Promise<SyncEnvelope | null> {
      // Provider-owned sync is delegated through sync(); download must stay
      // side-effect-free so CloudSync does not drive EasyCloud twice.
      return null;
    },

    async test(): Promise<{ success: boolean }> {
      const status = await EasyCloudSync.getStatus();
      return { success: status.connected && status.online };
    },

    async getStatus(): Promise<ProviderStatus> {
      const status = await EasyCloudSync.getStatus();
      return {
        connected: status.connected,
        user: status.user,
        status: status.status,
        lastSync: status.lastSync,
      };
    },
  };
}

// Suppress unused function warning — _refreshToken is part of the token management API
void _refreshToken;
