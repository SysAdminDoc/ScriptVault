// ============================================================================
// Cloud Sync — bidirectional sync with 3-way merge support
// Strict TypeScript migration from background.core.js (lines 330-503)
// ============================================================================

import type { Script, ScriptMeta, ScriptSettings } from '../types/index';
import type { Settings, SyncProvider } from '../types/settings';

// ---------------------------------------------------------------------------
// External dependencies (not yet migrated to TS modules)
// ---------------------------------------------------------------------------

declare function debugLog(...args: unknown[]): void;

declare function parseUserscript(code: string): {
  meta: ScriptMeta;
  code: string;
  metaBlock: string;
  error?: undefined;
} | {
  error: string;
  meta?: undefined;
  code?: undefined;
  metaBlock?: undefined;
};

declare const ScriptStorage: {
  get(id: string): Promise<Script | null>;
  getAll(): Promise<Script[]>;
  set(id: string, script: Script): Promise<void>;
};

declare const SettingsManager: {
  get(): Promise<Settings>;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
};

declare const ScriptAnalyzer: {
  _ensureOffscreen(): Promise<void>;
};

// ---------------------------------------------------------------------------
// Cloud sync provider interface
// ---------------------------------------------------------------------------

interface CloudSyncProvider {
  download(settings: Settings): Promise<SyncEnvelope | null>;
  upload(data: SyncEnvelope, settings: Settings): Promise<void>;
}

// ---------------------------------------------------------------------------
// CloudSyncProviders — external global registry of sync providers
// ---------------------------------------------------------------------------

declare const CloudSyncProviders: Record<string, CloudSyncProvider>;

// ---------------------------------------------------------------------------
// Local types for sync data
// ---------------------------------------------------------------------------

interface SyncScript {
  id: string;
  code: string;
  enabled: boolean;
  position: number;
  settings: ScriptSettings;
  updatedAt: number;
}

interface SyncEnvelope {
  version: number;
  timestamp: number;
  scripts: SyncScript[];
  tombstones: Record<string, unknown>;
}

interface SyncResult {
  success?: boolean;
  skipped?: boolean;
  error?: string;
}

interface MergeResult {
  merged?: string;
  error?: string;
  conflicts?: boolean;
}

// ---------------------------------------------------------------------------
// CloudSync object
// ---------------------------------------------------------------------------

export const CloudSync = {
  // Use providers from imported CloudSyncProviders module
  get providers(): Record<string, CloudSyncProvider> {
    return CloudSyncProviders;
  },

  _syncInProgress: false,

  async sync(): Promise<SyncResult> {
    // Prevent concurrent syncs — second call defers until first completes
    if (this._syncInProgress) {
      debugLog('[CloudSync] Sync already in progress, skipping');
      return { skipped: true };
    }
    this._syncInProgress = true;

    let _timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        _timeoutId = setTimeout(() => reject(new Error('Sync timed out after 90s')), 90000);
      });
      return await Promise.race([this._performSync(), timeoutPromise]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ScriptVault] Sync failed:', e);
      return { error: msg };
    } finally {
      clearTimeout(_timeoutId);
      this._syncInProgress = false;
    }
  },

  async _performSync(): Promise<SyncResult> {
    const settings = await SettingsManager.get();
    if (!settings.syncEnabled || settings.syncProvider === 'none') return {};

    const provider: CloudSyncProvider | undefined = this.providers[settings.syncProvider];
    if (!provider) return {};

    // Load tombstones (IDs of locally-deleted scripts, to prevent sync re-importing them)
    const tombstoneData = await chrome.storage.local.get('syncTombstones');
    const tombstones: Record<string, unknown> = (tombstoneData['syncTombstones'] as Record<string, unknown> | undefined) ?? {};

    // Get local data
    const scripts = await ScriptStorage.getAll();
    const localData: SyncEnvelope = {
      version: 1,
      timestamp: Date.now(),
      scripts: scripts.map((s): SyncScript => ({
        id: s.id,
        code: s.code,
        enabled: s.enabled,
        position: s.position,
        settings: s.settings ?? {},
        updatedAt: s.updatedAt
      })),
      tombstones
    };

    // Get remote data
    const remoteData = await provider.download(settings);

    if (remoteData) {
      // Merge tombstones from remote so deletions propagate across devices
      const mergedTombstones: Record<string, unknown> = { ...tombstones, ...(remoteData.tombstones ?? {}) };

      // Merge: prefer newer versions
      const merged = this.mergeData(localData, remoteData);

      // Apply merged data locally, skipping tombstoned (deleted) scripts
      // Uses 3-way text merge (via offscreen doc) when both sides have changed since sync base
      for (const script of merged.scripts) {
        if (mergedTombstones[script.id]) continue; // deleted on some device, don't re-import
        const existing = await ScriptStorage.get(script.id);
        // Skip scripts marked as locally modified — user edits take precedence over remote
        if (existing?.settings?.userModified) continue;

        const remoteScript = remoteData.scripts?.find((s: SyncScript) => s.id === script.id);
        const localScript = localData.scripts?.find((s: SyncScript) => s.id === script.id);

        let codeToSave: string = script.code;
        let mergeConflict = false;

        // 3-way merge: both sides changed since last known base
        if (existing && remoteScript && localScript &&
            existing.code !== remoteScript.code &&
            existing.code !== localScript.code) {
          const base: string = existing.syncBaseCode ?? existing.code;
          if (base && base !== localScript.code && base !== remoteScript.code) {
            try {
              await ScriptAnalyzer._ensureOffscreen();
              const mergeResult: MergeResult = await chrome.runtime.sendMessage({
                type: 'offscreen_merge',
                base,
                local: localScript.code,
                remote: remoteScript.code
              });
              if (mergeResult && !mergeResult.error) {
                codeToSave = mergeResult.merged ?? script.code;
                mergeConflict = mergeResult.conflicts ?? false;
                debugLog(`[CloudSync] 3-way merge for ${script.id}: conflicts=${String(mergeConflict)}`);
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              debugLog('[CloudSync] 3-way merge failed, using timestamp winner:', msg);
              // Fall back to last-write-wins (already set via merged.scripts)
            }
          }
        }

        if (!existing || script.updatedAt > existing.updatedAt || mergeConflict) {
          const parsed = parseUserscript(codeToSave);
          if (!parsed.error && parsed.meta) {
            await ScriptStorage.set(script.id, {
              id: script.id,
              code: codeToSave,
              meta: parsed.meta,
              enabled: script.enabled,
              position: script.position,
              settings: {
                ...(existing?.settings ?? {}),
                ...(mergeConflict ? { mergeConflict: true } : {})
              },
              updatedAt: Math.max(script.updatedAt, existing?.updatedAt ?? 0),
              createdAt: existing?.createdAt ?? script.updatedAt,
              syncBaseCode: codeToSave // record merged result as new base for future syncs
            });
          }
        }
      }

      // Persist merged tombstones locally
      if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
        await chrome.storage.local.set({ syncTombstones: mergedTombstones });
      }

      // Upload merged data (includes tombstones)
      merged.timestamp = Date.now();
      merged.tombstones = mergedTombstones;
      await provider.upload(merged, settings);
    } else {
      // First sync, just upload (include tombstones so remote gets deletion info)
      await provider.upload(localData, settings);
    }

    await SettingsManager.set('lastSync', Date.now());
    return { success: true };
  },

  mergeData(local: SyncEnvelope, remote: SyncEnvelope): SyncEnvelope {
    const scriptsMap = new Map<string, SyncScript>();

    // Add all local scripts
    for (const script of local.scripts) {
      scriptsMap.set(script.id, script);
    }

    // Merge remote scripts (prefer newer)
    for (const script of remote.scripts) {
      const existing = scriptsMap.get(script.id);
      if (!existing || script.updatedAt > existing.updatedAt) {
        scriptsMap.set(script.id, script);
      }
    }

    return {
      version: 1,
      timestamp: Date.now(),
      scripts: Array.from(scriptsMap.values()),
      tombstones: {}
    };
  }
};
