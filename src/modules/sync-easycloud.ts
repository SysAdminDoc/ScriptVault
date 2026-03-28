// ============================================================================
// MIGRATED: sync-easycloud.ts - Zero-Config Google Cloud Sync (EasyCloud)
// Uses chrome.identity.getAuthToken for one-click Google Drive sync
// ============================================================================

import type { Script, ScriptMeta, ScriptSettings } from '../types/index';
import { ScriptStorage, SettingsManager } from './storage';

// ============================================================================
// External globals (not yet migrated to TS modules)
// ============================================================================

declare function parseUserscript(code: string): { meta: ScriptMeta; error: string | null };

declare const ScriptAnalyzer: {
  _ensureOffscreen(): Promise<void>;
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
  connect(): Promise<ConnectResult>;
  disconnect(): Promise<DisconnectResult>;
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
}

interface SyncResult {
  success?: boolean;
  skipped?: boolean;
  offline?: boolean;
  error?: string;
  timestamp?: number;
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
const ALARM_PERIOD_MINUTES = 15;
const DEBOUNCE_MS = 5000;
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_FILE_NAME = 'scriptvault-sync.json';
const STORAGE_KEY_PREFIX = 'easycloud_';

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
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _statusListeners: StatusCallback[] = [];
let _cachedToken: string | null = null;
let _cachedFileId: string | null = null;
let _deviceId: string | null = null;
let _initialized = false;

// ============================================================================
// Helpers
// ============================================================================

function log(...args: unknown[]): void {
  console.log(TAG, ...args);
}

function warn(...args: unknown[]): void {
  console.warn(TAG, ...args);
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
    const resp = await fetch(`${DRIVE_API}/about?fields=user`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return resp.ok;
  } catch (_) {
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
      const resp = await fetch(
        `${DRIVE_API}/files/${_cachedFileId}?fields=id,modifiedTime`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (resp.ok) return _cachedFileId;
    } catch (_) { /* fall through to search */ }
    _cachedFileId = null;
  }

  // Search for the file
  const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
  const resp = await fetch(
    `${DRIVE_API}/files?q=${query}&spaces=appDataFolder&fields=files(id,modifiedTime)`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!resp.ok) {
    throw new Error(`Drive file search failed: ${resp.status}`);
  }

  const data: DriveFileSearchResult = await resp.json() as DriveFileSearchResult;
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
async function _downloadFromDrive(token: string): Promise<SyncEnvelope | null> {
  const fileId = await _findSyncFile(token);
  if (!fileId) return null;

  const resp = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (resp.status === 404) {
    _cachedFileId = null;
    return null;
  }
  if (!resp.ok) {
    throw new Error(`Drive download failed: ${resp.status}`);
  }

  return resp.json() as Promise<SyncEnvelope>;
}

/**
 * Upload sync data to Drive appDataFolder.
 */
async function _uploadToDrive(token: string, data: SyncEnvelope): Promise<void> {
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

  const resp = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Drive upload failed (${resp.status}): ${errText}`);
  }

  const result: DriveUploadResult = await resp.json() as DriveUploadResult;
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
  const mergedTombstones: Record<string, unknown> = { ...localTombstones, ...remoteTombstones };

  // Collect all script IDs
  const allIds = new Set<string>([...localScripts.keys(), ...remoteScripts.keys()]);
  const mergedScripts: SyncScript[] = [];

  for (const id of allIds) {
    // Skip tombstoned scripts
    if (mergedTombstones[id]) continue;

    const local = localScripts.get(id);
    const remote = remoteScripts.get(id);

    if (!remote) {
      // Only local — keep it
      if (local) mergedScripts.push(local);
      continue;
    }

    if (!local) {
      // Only remote — import it
      mergedScripts.push(remote);
      continue;
    }

    // Both exist — merge
    const merged: SyncScript = { ...local };
    const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);

    // Enable/disable: newest wins
    if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
      merged.enabled = remote.enabled;
      merged.position = remote.position;
      merged.settings = { ...local.settings, ...remote.settings };
    }

    // Code merge
    if (local.code !== remote.code) {
      const base: string | null = local.syncBaseCode || remote.syncBaseCode || null;

      if (base && base !== local.code && base !== remote.code) {
        // Both sides changed since base — attempt 3-way merge
        try {
          if (typeof ScriptAnalyzer !== 'undefined' && ScriptAnalyzer._ensureOffscreen) {
            await ScriptAnalyzer._ensureOffscreen();
            const mergeResult = await chrome.runtime.sendMessage({
              type: 'offscreen_merge',
              base,
              local: local.code,
              remote: remote.code,
            }) as { merged?: string; conflicts?: boolean; error?: string } | undefined;
            if (mergeResult && !mergeResult.error) {
              merged.code = mergeResult.merged ?? merged.code;
              if (mergeResult.conflicts) {
                merged.settings = { ...(merged.settings || {}), mergeConflict: true };
              }
              log(`3-way merge for ${id}: conflicts=${String(mergeResult.conflicts || false)}`);
            } else {
              // Merge failed — newest wins
              merged.code = localNewer ? local.code : remote.code;
            }
          } else {
            // No offscreen available — newest wins
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

  return {
    version: 1,
    timestamp: Date.now(),
    deviceId,
    scripts: mergedScripts,
    tombstones: mergedTombstones,
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

  if (!_isOnline()) {
    setStatus(STATUS.OFFLINE);
    return { offline: true };
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

    // Load tombstones
    const tombstoneData = await _getStorageValues(['syncTombstones']);
    const tombstones = (tombstoneData['syncTombstones'] as Record<string, unknown> | undefined) || {};

    // Build local data snapshot
    const scripts: Script[] = await ScriptStorage.getAll();
    const localData: SyncEnvelope = {
      version: 1,
      timestamp: Date.now(),
      deviceId,
      scripts: scripts.map((s: Script) => ({
        id: s.id,
        code: s.code,
        enabled: s.enabled,
        position: s.position,
        settings: s.settings || {},
        updatedAt: s.updatedAt || 0,
        syncBaseCode: s.syncBaseCode || null,
      })),
      tombstones,
    };

    // Download remote
    const remoteData = await _downloadFromDrive(token);

    if (remoteData) {
      // Merge
      const merged = await _mergeData(localData, remoteData, deviceId);

      // Apply merged scripts locally
      for (const script of merged.scripts) {
        if (merged.tombstones[script.id]) continue;

        const existing: Script | null = await ScriptStorage.get(script.id);

        // Skip user-modified scripts
        if (existing?.settings?.userModified) continue;

        if (!existing || script.updatedAt > (existing.updatedAt || 0)) {
          const parsed = typeof parseUserscript === 'function'
            ? parseUserscript(script.code)
            : { meta: {} as ScriptMeta, error: null };

          if (!parsed.error) {
            await ScriptStorage.set(script.id, {
              id: script.id,
              code: script.code,
              meta: parsed.meta,
              enabled: script.enabled,
              position: script.position,
              settings: {
                ...(existing?.settings || {}),
                ...(script.settings || {}),
                userModified: false,
              },
              updatedAt: script.updatedAt,
              createdAt: existing?.createdAt || script.updatedAt,
              syncBaseCode: script.code,
            } as Script);
          }
        }
      }

      // Persist merged tombstones
      const mergedTombstones: Record<string, unknown> = merged.tombstones || {};
      if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
        await chrome.storage.local.set({ syncTombstones: mergedTombstones });
      }

      // Upload merged data
      merged.timestamp = Date.now();
      await _uploadToDrive(token, merged);
    } else {
      // First sync — upload local data
      await _uploadToDrive(token, localData);
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
    return { error: msg };
  } finally {
    _syncInProgress = false;
  }
}

// ============================================================================
// Debounced sync trigger
// ============================================================================

function _debouncedSync(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    _performSync().catch((e: unknown) => warn('Debounced sync error:', e));
  }, DEBOUNCE_MS);
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

function _handleAlarm(alarm: chrome.alarms.Alarm): void {
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
        const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (resp.ok) {
          user = await resp.json() as UserInfoResult;
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
          await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${_cachedToken}`)
            .catch(() => {});
        } catch (_) { /* best effort */ }
        _cachedToken = null;
      }

      // Clear periodic sync
      await _clearPeriodicSync();

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

    async connect(): Promise<ConnectResult> {
      return EasyCloudSync.connect();
    },

    async disconnect(): Promise<DisconnectResult> {
      return EasyCloudSync.disconnect();
    },

    async upload(_data: unknown, _settings: unknown): Promise<{ success: boolean; timestamp: number }> {
      // EasyCloud manages its own upload via sync(); this is for compatibility
      const result = await EasyCloudSync.sync();
      if (result.error) throw new Error(result.error);
      return { success: true, timestamp: Date.now() };
    },

    async download(_settings: unknown): Promise<SyncEnvelope | null> {
      // For compatibility: trigger sync and return null (data is applied locally by sync)
      await EasyCloudSync.sync();
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
