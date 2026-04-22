// ============================================================================
// INLINED: sync-easycloud.js - Zero-Config Google Cloud Sync (EasyCloud)
// Uses chrome.identity.getAuthToken for one-click Google Drive sync
// (inlined to bypass Chrome service worker importScripts caching)
// ============================================================================

var EasyCloudSync = (() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

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
    CONNECTED:    STORAGE_KEY_PREFIX + 'connected',
    DEVICE_ID:    STORAGE_KEY_PREFIX + 'deviceId',
    LAST_SYNC:    STORAGE_KEY_PREFIX + 'lastSync',
    STATUS:       STORAGE_KEY_PREFIX + 'status',
    OFFLINE_QUEUE: STORAGE_KEY_PREFIX + 'offlineQueue',
    USER_EMAIL:   STORAGE_KEY_PREFIX + 'userEmail',
    USER_NAME:    STORAGE_KEY_PREFIX + 'userName',
    FILE_ID:      STORAGE_KEY_PREFIX + 'fileId',
  };

  // Sync statuses
  const STATUS = {
    IDLE:    'synced',
    SYNCING: 'syncing',
    ERROR:   'error',
    OFFLINE: 'offline',
  };

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------

  let _status = STATUS.IDLE;
  let _syncInProgress = false;
  let _debounceTimer = null;
  let _statusListeners = [];
  let _cachedToken = null;
  let _cachedFileId = null;
  let _deviceId = null;
  let _initialized = false;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function log(...args) {
    console.log(TAG, ...args);
  }

  function warn(...args) {
    console.warn(TAG, ...args);
  }

  function setStatus(newStatus) {
    if (_status === newStatus) return;
    _status = newStatus;
    _persistStatus(newStatus);
    for (const cb of _statusListeners) {
      try { cb(newStatus); } catch (e) { warn('Status listener error:', e); }
    }
  }

  async function _persistStatus(status) {
    try {
      await chrome.storage.local.set({ [KEYS.STATUS]: status });
    } catch (_) { /* best effort */ }
  }

  async function _getStorageValues(keys) {
    return chrome.storage.local.get(keys);
  }

  async function _setStorageValues(obj) {
    return chrome.storage.local.set(obj);
  }

  /**
   * Generate or retrieve a stable device ID for conflict resolution.
   */
  async function _ensureDeviceId() {
    if (_deviceId) return _deviceId;
    const data = await _getStorageValues([KEYS.DEVICE_ID]);
    if (data[KEYS.DEVICE_ID]) {
      _deviceId = data[KEYS.DEVICE_ID];
      return _deviceId;
    }
    // Generate a new device ID
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    _deviceId = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    await _setStorageValues({ [KEYS.DEVICE_ID]: _deviceId });
    return _deviceId;
  }

  function _isOnline() {
    // In service worker context, navigator.onLine is available
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // ---------------------------------------------------------------------------
  // Token management via chrome.identity
  // ---------------------------------------------------------------------------

  /**
   * Get a valid OAuth token using Chrome's built-in identity API.
   * This is the zero-config path: no client ID, no manual OAuth.
   */
  async function _getAuthToken(interactive = false) {
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

      const token = result?.token || result;
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
  async function _refreshToken() {
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
  async function _getValidToken() {
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

  async function _testToken(token) {
    try {
      const resp = await fetch(`${DRIVE_API}/about?fields=user`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return resp.ok;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Google Drive operations (appDataFolder)
  // ---------------------------------------------------------------------------

  /**
   * Find the sync file in appDataFolder.
   */
  async function _findSyncFile(token) {
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

    const data = await resp.json();
    const file = data.files?.[0];
    if (file) {
      _cachedFileId = file.id;
      await _setStorageValues({ [KEYS.FILE_ID]: file.id });
    }
    return file?.id || null;
  }

  /**
   * Download sync data from Drive appDataFolder.
   */
  async function _downloadFromDrive(token) {
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

    return resp.json();
  }

  /**
   * Upload sync data to Drive appDataFolder.
   */
  async function _uploadToDrive(token, data) {
    const fileId = await _findSyncFile(token);

    const metadata = {
      name: SYNC_FILE_NAME,
      mimeType: 'application/json',
    };
    if (!fileId) {
      metadata.parents = ['appDataFolder'];
    }

    const boundary = '---EasyCloud' + crypto.getRandomValues(new Uint8Array(8))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
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

    const result = await resp.json();
    if (result.id && !_cachedFileId) {
      _cachedFileId = result.id;
      await _setStorageValues({ [KEYS.FILE_ID]: result.id });
    }
  }

  // ---------------------------------------------------------------------------
  // Offline queue
  // ---------------------------------------------------------------------------

  async function _enqueueOfflineChange(change) {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const queue = data[KEYS.OFFLINE_QUEUE] || [];
    queue.push({ ...change, queuedAt: Date.now() });
    // Cap queue to 500 entries to avoid storage bloat
    if (queue.length > 500) queue.splice(0, queue.length - 500);
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: queue });
  }

  async function _drainOfflineQueue() {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const queue = data[KEYS.OFFLINE_QUEUE] || [];
    if (queue.length === 0) return;

    log(`Draining offline queue (${queue.length} entries)`);
    // Clear queue first (sync will pick up current state)
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: [] });
    // Trigger a full sync — the current local state already includes queued changes
    await _performSync();
  }

  // ---------------------------------------------------------------------------
  // Merge logic
  // ---------------------------------------------------------------------------

  /**
   * Merge local and remote sync data with multi-device conflict resolution.
   * - Newest wins for enable/disable and metadata
   * - 3-way merge for code changes (delegated to offscreen document)
   * - Tombstone propagation for deletes
   */
  async function _mergeData(localData, remoteData, deviceId) {
    const localScripts = new Map((localData.scripts || []).map(s => [s.id, s]));
    const remoteScripts = new Map((remoteData.scripts || []).map(s => [s.id, s]));

    // Merge tombstones — union of all known deletions
    const localTombstones = localData.tombstones || {};
    const remoteTombstones = remoteData.tombstones || {};
    const mergedTombstones = { ...localTombstones, ...remoteTombstones };

    // Collect all script IDs
    const allIds = new Set([...localScripts.keys(), ...remoteScripts.keys()]);
    const mergedScripts = [];

    for (const id of allIds) {
      // Skip tombstoned scripts
      if (mergedTombstones[id]) continue;

      const local = localScripts.get(id);
      const remote = remoteScripts.get(id);

      if (!remote) {
        // Only local — keep it
        mergedScripts.push(local);
        continue;
      }

      if (!local) {
        // Only remote — import it
        mergedScripts.push(remote);
        continue;
      }

      // Both exist — merge
      const merged = { ...local };
      const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);

      // Enable/disable: newest wins
      if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
        merged.enabled = remote.enabled;
        merged.position = remote.position;
        merged.settings = { ...local.settings, ...remote.settings };
      }

      // Code merge
      if (local.code !== remote.code) {
        const base = local.syncBaseCode || remote.syncBaseCode || null;

        if (base != null && base !== local.code && base !== remote.code) {
          // Both sides changed since base — attempt 3-way merge
          try {
            if (typeof ScriptAnalyzer !== 'undefined' && ScriptAnalyzer._ensureOffscreen) {
              await ScriptAnalyzer._ensureOffscreen();
              const mergeResult = await chrome.runtime.sendMessage({
                type: 'offscreen_merge',
                base,
                local: local.code,
                remote: remote.code,
              });
              if (mergeResult && !mergeResult.error) {
                merged.code = mergeResult.merged;
                if (mergeResult.conflicts) {
                  merged.settings = { ...(merged.settings || {}), mergeConflict: true };
                }
                log(`3-way merge for ${id}: conflicts=${mergeResult.conflicts || false}`);
              } else {
                // Merge failed — newest wins, flag conflict so user knows
                merged.code = localNewer ? local.code : remote.code;
                merged.settings = { ...(merged.settings || {}), mergeConflict: true };
              }
            } else {
              // No offscreen available — newest wins
              merged.code = localNewer ? local.code : remote.code;
            }
          } catch (e) {
            warn(`3-way merge failed for ${id}:`, e.message);
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

  // ---------------------------------------------------------------------------
  // Core sync
  // ---------------------------------------------------------------------------

  async function _performSync() {
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
      const tombstones = tombstoneData.syncTombstones || {};

      // Build local data snapshot
      const scripts = await ScriptStorage.getAll();
      const localData = {
        version: 1,
        timestamp: Date.now(),
        deviceId,
        scripts: scripts.map(s => ({
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

          const existing = await ScriptStorage.get(script.id);

          // Skip user-modified scripts
          if (existing?.settings?.userModified) continue;

          if (!existing || script.updatedAt > (existing.updatedAt || 0)) {
            const parsed = typeof parseUserscript === 'function'
              ? parseUserscript(script.code)
              : { meta: {}, error: null };

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
                lastSyncDevice: deviceId,
              });
            }
          }
        }

        // Re-register scripts that were updated by sync so new code takes effect immediately
        try {
          if (typeof registerAllScripts === 'function') {
            await registerAllScripts(true);
            if (typeof updateBadge === 'function') await updateBadge();
          }
        } catch (e) {
          warn('Post-sync re-registration failed:', e.message);
        }

        // Persist merged tombstones
        const mergedTombstones = merged.tombstones || {};
        if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
          await chrome.storage.local.set({ syncTombstones: mergedTombstones });
        }

        // Apply remote tombstone deletions locally (propagate remote deletes)
        for (const tombstonedId of Object.keys(mergedTombstones)) {
          if (tombstones[tombstonedId]) continue; // Already deleted locally — skip
          const existing = await ScriptStorage.get(tombstonedId);
          if (existing && !existing.settings?.userModified) {
            // Delete locally: unregister first, then remove from storage
            try {
              if (typeof unregisterScript === 'function') await unregisterScript(tombstonedId);
            } catch (_) { /* best effort */ }
            await ScriptStorage.delete(tombstonedId);
            log(`Applied remote deletion for script ${tombstonedId}`);
          }
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
    } catch (e) {
      warn('Sync failed:', e);
      setStatus(STATUS.ERROR);
      return { error: e.message };
    } finally {
      _syncInProgress = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Debounced sync trigger
  // ---------------------------------------------------------------------------

  function _debouncedSync() {
    // Use chrome.alarms for debounce to survive SW shutdown (DEBOUNCE_MS = 5s)
    // chrome.alarms minimum is 1 minute for periodInMinutes, but delayInMinutes accepts fractional
    const DEBOUNCE_ALARM = 'easycloud-debounce-sync';
    chrome.alarms.create(DEBOUNCE_ALARM, { delayInMinutes: DEBOUNCE_MS / 60000 });
    // The alarm handler in handleAlarm() will call _performSync()
  }

  // ---------------------------------------------------------------------------
  // Alarm-based periodic sync
  // ---------------------------------------------------------------------------

  async function _setupPeriodicSync() {
    try {
      await chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: ALARM_PERIOD_MINUTES,
        periodInMinutes: ALARM_PERIOD_MINUTES,
      });
    } catch (e) {
      warn('Failed to create periodic sync alarm:', e);
    }
  }

  async function _clearPeriodicSync() {
    try {
      await chrome.alarms.clear(ALARM_NAME);
    } catch (_) { /* ignore */ }
  }

  function _handleAlarm(alarm) {
    if (alarm.name === 'easycloud-debounce-sync') {
      _performSync().catch(e => warn('Debounced sync error:', e));
      return;
    }
    if (alarm.name !== ALARM_NAME) return;
    _performSync().catch(e => warn('Periodic sync error:', e));
  }

  // ---------------------------------------------------------------------------
  // Online/offline handling
  // ---------------------------------------------------------------------------

  function _handleOnline() {
    log('Back online, draining queue and syncing');
    _drainOfflineQueue().catch(e => warn('Queue drain error:', e));
  }

  function _handleOffline() {
    log('Went offline');
    setStatus(STATUS.OFFLINE);
  }

  // ---------------------------------------------------------------------------
  // Event listeners for auto-sync on script changes
  // ---------------------------------------------------------------------------

  function _setupStorageListener() {
    // Listen for script storage changes to trigger auto-sync
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      // Check if userscripts data changed (ScriptStorage uses 'userscripts' key)
      if (changes.userscripts) {
        _getStorageValues([KEYS.CONNECTED]).then(d => {
          if (d[KEYS.CONNECTED]) {
            _debouncedSync();
          }
        }).catch(() => {});
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const api = {
    /**
     * Initialize EasyCloud sync. Call once on extension startup.
     * Sets up alarms, listeners, and triggers initial sync if connected.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;

      // Restore cached state
      const data = await _getStorageValues([
        KEYS.CONNECTED,
        KEYS.DEVICE_ID,
        KEYS.STATUS,
        KEYS.FILE_ID,
      ]);

      _deviceId = data[KEYS.DEVICE_ID] || null;
      _cachedFileId = data[KEYS.FILE_ID] || null;

      if (data[KEYS.STATUS]) {
        _status = data[KEYS.STATUS];
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
          _performSync().catch(e => warn('Init sync error:', e));
        }
      }

      log('Initialized');
    },

    /**
     * Connect to Google Drive via chrome.identity (interactive sign-in).
     * Returns { success, user } or { success: false, error }.
     */
    async connect() {
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
        let user = {};
        try {
          const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (resp.ok) {
            user = await resp.json();
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
        _performSync().catch(e => warn('Post-connect sync error:', e));

        setStatus(STATUS.IDLE);
        log('Connected as', user.email || '(unknown)');

        return {
          success: true,
          user: { email: user.email, name: user.name, picture: user.picture },
        };
      } catch (e) {
        warn('Connect failed:', e);
        return { success: false, error: e.message };
      }
    },

    /**
     * Disconnect from Google Drive. Revokes token and clears state.
     */
    async disconnect() {
      try {
        // Revoke token
        if (_cachedToken) {
          try {
            await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
            // Use POST with body — never put tokens in URL query strings
            await fetch('https://oauth2.googleapis.com/revoke', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ token: _cachedToken })
            }).catch(() => {});
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
      } catch (e) {
        warn('Disconnect error:', e);
        return { success: false, error: e.message };
      }
    },

    /**
     * Trigger an immediate sync. Returns sync result.
     */
    async sync() {
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
    async getStatus() {
      const data = await _getStorageValues([
        KEYS.CONNECTED,
        KEYS.LAST_SYNC,
        KEYS.STATUS,
        KEYS.USER_EMAIL,
        KEYS.USER_NAME,
        KEYS.DEVICE_ID,
      ]);

      return {
        connected: !!data[KEYS.CONNECTED],
        status: data[KEYS.STATUS] || _status,
        lastSync: data[KEYS.LAST_SYNC] || null,
        user: data[KEYS.CONNECTED]
          ? { email: data[KEYS.USER_EMAIL], name: data[KEYS.USER_NAME] }
          : null,
        deviceId: data[KEYS.DEVICE_ID] || null,
        online: _isOnline(),
      };
    },

    /**
     * Check if currently connected (synchronous, uses cached state).
     */
    isConnected() {
      // This is a fast synchronous check based on in-memory state.
      // For authoritative state, use getStatus().
      return _status !== STATUS.ERROR && _cachedToken !== null;
    },

    /**
     * Register a status change callback. Returns an unsubscribe function.
     */
    onStatusChange(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('onStatusChange requires a function callback');
      }
      _statusListeners.push(callback);
      return () => {
        _statusListeners = _statusListeners.filter(cb => cb !== callback);
      };
    },

    /**
     * Notify EasyCloud that a script was saved (triggers debounced sync).
     */
    notifyScriptSaved(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: 'save', scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    },

    /**
     * Notify EasyCloud that a script was deleted (triggers debounced sync).
     */
    notifyScriptDeleted(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: 'delete', scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    },
  };

  return api;
})();

// ---------------------------------------------------------------------------
// Register as a CloudSyncProvider for integration with existing sync UI
// ---------------------------------------------------------------------------

if (typeof CloudSyncProviders !== 'undefined') {
  CloudSyncProviders.easycloud = {
    name: 'EasyCloud (Google)',
    icon: '⚡',
    requiresAuth: false,
    requiresOAuth: false,
    isZeroConfig: true,

    async connect() {
      return EasyCloudSync.connect();
    },

    async disconnect() {
      return EasyCloudSync.disconnect();
    },

    async upload(data, settings) {
      // EasyCloud manages its own upload via sync(); this is for compatibility
      const result = await EasyCloudSync.sync();
      if (result.error) throw new Error(result.error);
      return { success: true, timestamp: Date.now() };
    },

    async download(settings) {
      // For compatibility: trigger sync and return null (data is applied locally by sync)
      await EasyCloudSync.sync();
      return null;
    },

    async test() {
      const status = await EasyCloudSync.getStatus();
      return { success: status.connected && status.online };
    },

    async getStatus() {
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

// Export for service worker global scope
if (typeof self !== 'undefined') {
  self.EasyCloudSync = EasyCloudSync;
}
