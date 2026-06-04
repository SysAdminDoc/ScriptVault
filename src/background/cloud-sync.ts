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
  delete(id: string): Promise<void>;
};

declare const SettingsManager: {
  get(): Promise<Settings>;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
};

declare const ScriptAnalyzer: {
  _ensureOffscreen?(): Promise<boolean>;
  mergeText?(base: string, local: string, remote: string): Promise<MergeResult>;
};

// ---------------------------------------------------------------------------
// Cloud sync provider interface
// ---------------------------------------------------------------------------

interface CloudSyncProvider {
  download(settings: Settings): Promise<SyncEnvelope | null>;
  upload(data: SyncEnvelope, settings: Settings): Promise<void>;
  name?: string;
  supportsDryRun?: boolean;
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
  syncBaseCode?: string | null;
  name?: string;
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

interface SyncPreviewSummary {
  localScripts: number;
  remoteScripts: number;
  localOnly: number;
  remoteOnly: number;
  localNewer: number;
  remoteNewer: number;
  unchanged: number;
  tombstoned: number;
  conflicts: number;
  wouldUpload: boolean;
  wouldDownload: boolean;
}

interface SyncPreviewConflict {
  id: string;
  name: string;
  localUpdatedAt: number | null;
  remoteUpdatedAt: number | null;
  reason: string;
}

interface SyncPreviewResult extends SyncResult {
  dryRun?: boolean;
  noWrites?: boolean;
  provider?: string | null;
  providerLabel?: string | null;
  lastSync?: number | null;
  remoteFound?: boolean;
  summary?: SyncPreviewSummary;
  conflicts?: SyncPreviewConflict[];
}

interface MergeResult {
  merged?: string;
  error?: string;
  conflicts?: boolean;
}

type RuntimeHooks = typeof globalThis & {
  registerScript?: (script: Script) => Promise<void>;
  unregisterScript?: (scriptId: string) => Promise<void>;
  updateBadge?: (tabId?: number | null) => Promise<void>;
};

function getRuntimeHooks(): RuntimeHooks {
  return globalThis as RuntimeHooks;
}

async function refreshSyncedScriptRuntime(script: Script): Promise<void> {
  const hooks = getRuntimeHooks();
  if (typeof hooks.unregisterScript === 'function') {
    try {
      await hooks.unregisterScript(script.id);
    } catch (e) {
      debugLog('[CloudSync] Failed to unregister synced script:', script.id, e);
    }
  }
  if (script.enabled !== false && typeof hooks.registerScript === 'function') {
    try {
      await hooks.registerScript(script);
    } catch (e) {
      debugLog('[CloudSync] Failed to register synced script:', script.id, e);
    }
  }
}

async function deleteSyncedScript(scriptId: string): Promise<void> {
  const hooks = getRuntimeHooks();
  if (typeof hooks.unregisterScript === 'function') {
    try {
      await hooks.unregisterScript(scriptId);
    } catch (e) {
      debugLog('[CloudSync] Failed to unregister deleted synced script:', scriptId, e);
    }
  }
  await ScriptStorage.delete(scriptId);
}

async function updateBadgeIfAvailable(): Promise<void> {
  const hooks = getRuntimeHooks();
  if (typeof hooks.updateBadge === 'function') {
    try {
      await hooks.updateBadge();
    } catch (e) {
      debugLog('[CloudSync] Failed to refresh badge after sync:', e);
    }
  }
}

async function mergeScriptText(base: string, local: string, remote: string): Promise<MergeResult> {
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
      remote
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
  'tags',
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
    result[key] = cloneScriptSettingValue(value);
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

  async _buildLocalData(tombstones: Record<string, unknown> = {}): Promise<{
    scripts: Script[];
    localData: SyncEnvelope;
  }> {
    const scripts = await ScriptStorage.getAll();
    return {
      scripts,
      localData: {
        version: 1,
        timestamp: Date.now(),
        scripts: scripts.map((s): SyncScript => ({
          id: s.id,
          code: s.code,
          enabled: s.enabled,
          position: s.position,
          settings: cloneSyncSafeScriptSettings(s.settings),
          updatedAt: s.updatedAt,
          syncBaseCode: s.syncBaseCode ?? null,
          name: s.meta?.name || s.id,
        })),
        tombstones,
      },
    };
  },

  async preview(providerName?: SyncProvider | string): Promise<SyncPreviewResult> {
    const settings = await SettingsManager.get();
    const selectedProvider = providerName || settings.syncProvider;
    if (!selectedProvider || selectedProvider === 'none') {
      return { success: false, error: 'Choose a sync provider first' };
    }

    const provider: CloudSyncProvider | undefined = this.providers[selectedProvider];
    if (!provider) return { success: false, error: `Unknown provider: ${selectedProvider}` };
    if (provider.supportsDryRun === false || typeof provider.download !== 'function') {
      return {
        success: false,
        error: `Dry-run preview is not available for ${provider.name || selectedProvider}`,
      };
    }

    const tombstoneData = await chrome.storage.local.get('syncTombstones');
    const tombstones: Record<string, unknown> =
      (tombstoneData['syncTombstones'] as Record<string, unknown> | undefined) ?? {};
    const { localData } = await this._buildLocalData(tombstones);

    let remoteData: SyncEnvelope | null = null;
    try {
      remoteData = await provider.download(settings);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        provider: selectedProvider,
        providerLabel: provider.name || selectedProvider,
        error: msg,
      };
    }

    return {
      success: true,
      ...this.previewData(localData, remoteData, {
        provider: selectedProvider,
        providerLabel: provider.name || selectedProvider,
        lastSync: settings.lastSync || null,
      }),
    };
  },

  previewData(
    local: SyncEnvelope,
    remote: SyncEnvelope | null,
    options: { provider?: string; providerLabel?: string; lastSync?: number | null } = {},
  ): SyncPreviewResult {
    const localScripts = Array.isArray(local?.scripts) ? local.scripts : [];
    const remoteScripts = Array.isArray(remote?.scripts) ? remote.scripts : [];
    const tombstones: Record<string, unknown> = {
      ...(local?.tombstones ?? {}),
      ...(remote?.tombstones ?? {}),
    };
    const localById = new Map<string, SyncScript>(localScripts.map((script) => [script.id, script]));
    const remoteById = new Map<string, SyncScript>(remoteScripts.map((script) => [script.id, script]));
    const ids = new Set<string>([...localById.keys(), ...remoteById.keys()]);
    const summary: SyncPreviewSummary = {
      localScripts: localScripts.length,
      remoteScripts: remoteScripts.length,
      localOnly: 0,
      remoteOnly: 0,
      localNewer: 0,
      remoteNewer: 0,
      unchanged: 0,
      tombstoned: 0,
      conflicts: 0,
      wouldUpload: false,
      wouldDownload: false,
    };
    const conflicts: SyncPreviewConflict[] = [];

    for (const id of ids) {
      if (tombstones[id]) {
        summary.tombstoned += 1;
        continue;
      }
      const localScript = localById.get(id);
      const remoteScript = remoteById.get(id);
      if (!localScript && remoteScript) {
        summary.remoteOnly += 1;
        continue;
      }
      if (localScript && !remoteScript) {
        summary.localOnly += 1;
        continue;
      }
      if (!localScript || !remoteScript) continue;

      const base = localScript.syncBaseCode;
      const localChanged = base != null && localScript.code !== base;
      const remoteChanged = base != null && remoteScript.code !== base;
      if (base != null && localChanged && remoteChanged && localScript.code !== remoteScript.code) {
        summary.conflicts += 1;
        if (conflicts.length < 20) {
          conflicts.push({
            id,
            name: localScript.name || remoteScript.name || id,
            localUpdatedAt: localScript.updatedAt || null,
            remoteUpdatedAt: remoteScript.updatedAt || null,
            reason: 'Both local and remote changed since the last sync base',
          });
        }
        continue;
      }

      if ((localScript.updatedAt || 0) > (remoteScript.updatedAt || 0)) {
        summary.localNewer += 1;
      } else if ((remoteScript.updatedAt || 0) > (localScript.updatedAt || 0)) {
        summary.remoteNewer += 1;
      } else {
        summary.unchanged += 1;
      }
    }

    summary.wouldUpload =
      summary.localOnly > 0 || summary.localNewer > 0 || summary.conflicts > 0 || !remote;
    summary.wouldDownload =
      summary.remoteOnly > 0 || summary.remoteNewer > 0 || summary.conflicts > 0;

    return {
      dryRun: true,
      noWrites: true,
      provider: options.provider ?? null,
      providerLabel: options.providerLabel ?? options.provider ?? null,
      lastSync: options.lastSync ?? null,
      remoteFound: !!remote,
      summary,
      conflicts,
    };
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
        settings: cloneSyncSafeScriptSettings(s.settings),
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
      merged.scripts = merged.scripts.filter((script: SyncScript) => !mergedTombstones[script.id]);
      let localMutated = false;

      for (const localScript of scripts) {
        if (!mergedTombstones[localScript.id]) continue;
        await deleteSyncedScript(localScript.id);
        localMutated = true;
      }

      // Apply merged data locally, skipping tombstoned (deleted) scripts
      // Uses 3-way text merge when both sides have changed since sync base.
      // Chrome routes through the offscreen document; Firefox runs Diff inline.
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
          // Allow empty-string base (valid code); only skip if truly missing
          if (base != null && base !== localScript.code && base !== remoteScript.code) {
            try {
              const mergeResult: MergeResult = await mergeScriptText(base, localScript.code, remoteScript.code);
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
            const nextScript = {
              id: script.id,
              code: codeToSave,
              meta: parsed.meta,
              enabled: script.enabled,
              position: script.position,
              settings: mergeSyncedScriptSettings(existing?.settings, script.settings, {
                mergeConflict,
              }),
              updatedAt: Math.max(script.updatedAt, existing?.updatedAt ?? 0),
              createdAt: existing?.createdAt ?? script.updatedAt,
              syncBaseCode: codeToSave // record merged result as new base for future syncs
            } as Script;
            await ScriptStorage.set(script.id, nextScript);
            await refreshSyncedScriptRuntime(nextScript);
            localMutated = true;
          }
        }
      }

      // Persist merged tombstones locally
      if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
        await chrome.storage.local.set({ syncTombstones: mergedTombstones });
      }

      if (localMutated) {
        await updateBadgeIfAvailable();
      }

      // Upload merged data (includes tombstones)
      merged.timestamp = Date.now();
      merged.tombstones = mergedTombstones;
      await provider.upload(sanitizeSyncEnvelopeForUpload(merged), settings);
    } else {
      // First sync, just upload (include tombstones so remote gets deletion info)
      await provider.upload(sanitizeSyncEnvelopeForUpload(localData), settings);
    }

    await SettingsManager.set('lastSync', Date.now());
    return { success: true };
  },

  mergeData(local: SyncEnvelope, remote: SyncEnvelope): SyncEnvelope {
    const scriptsMap = new Map<string, SyncScript>();

    // Add all local scripts (guard against malformed envelopes)
    for (const script of (local.scripts || [])) {
      scriptsMap.set(script.id, sanitizeSyncScriptForEnvelope(script));
    }

    // Merge remote scripts (prefer newer)
    for (const script of (remote.scripts || [])) {
      const existing = scriptsMap.get(script.id);
      if (!existing || script.updatedAt > existing.updatedAt) {
        scriptsMap.set(script.id, sanitizeSyncScriptForEnvelope(script));
      }
    }

    // Filter out tombstoned entries so deleted scripts don't resurrect
    const mergedTombstones: Record<string, unknown> = {
      ...(local.tombstones ?? {}),
      ...(remote.tombstones ?? {}),
    };
    const merged: SyncScript[] = Array.from(scriptsMap.values()).filter(
      (s) => !mergedTombstones[s.id],
    );

    return {
      version: 1,
      timestamp: Date.now(),
      scripts: merged,
      tombstones: mergedTombstones
    };
  }
};
