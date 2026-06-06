// ============================================================================
// Cloud Sync — bidirectional sync with 3-way merge support
// Strict TypeScript migration from background.core.js (lines 330-503)
// ============================================================================

import type { Script, ScriptMeta, ScriptSettings } from '../types/index';
import type { Settings, SyncProvider } from '../types/settings';
import { SyncCrypto, type RemoteSyncEnvelope } from '../modules/sync-crypto';
import {
  GM_VALUE_SYNC_SCHEMA,
  buildGmValueSyncBundle,
  shouldSyncScriptValues,
  type GmValueSyncBundle,
} from './gm-value-sync';

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

declare const ScriptValues: {
  getAll(scriptId: string): Promise<Record<string, unknown>>;
  setAll?(scriptId: string, values: Record<string, unknown>): Promise<void>;
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
  download(settings: Settings): Promise<RemoteSyncEnvelope | null>;
  upload(data: SyncEnvelope | RemoteSyncEnvelope, settings: Settings): Promise<void>;
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
  valueBundles?: Record<string, GmValueSyncBundle>;
}

interface SyncResult {
  success?: boolean;
  skipped?: boolean;
  error?: string;
  valueBundleSync?: ValueBundleSyncSummary;
}

interface ValueBundleSyncSummary {
  applied: number;
  preserved: number;
  conflictBlocked: number;
  skippedNonEmpty: number;
  skippedUserModified: number;
  skippedUnavailable: number;
  failures: number;
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
  localValueOptIns: number;
  localValueBundles: number;
  remoteValueBundles: number;
  valueBundleWarnings: number;
  remoteValueBundlesApplicable: number;
  remoteValueBundlesApplyReady: number;
  remoteValueBundlesConflictBlocked: number;
  remoteValueBundlesIgnored: number;
  remoteValueBundleWarnings: number;
  valueBundleApplyEnabled: boolean;
  valueBundleApplyMode: 'empty-local-only';
  wouldUpload: boolean;
  wouldDownload: boolean;
  wouldUploadValues: boolean;
  wouldApplyValues: boolean;
}

interface SyncPreviewConflict {
  id: string;
  name: string;
  localUpdatedAt: number | null;
  remoteUpdatedAt: number | null;
  reason: string;
}

interface SyncPreviewValueBundleConflict {
  reason: 'local-values-present' | 'local-bundle-unavailable';
  localKeyCount: number | null;
  remoteKeyCount: number;
  localBytes: number | null;
  remoteBytes: number;
  overlappingKeyCount: number | null;
  localOnlyKeyCount: number | null;
  remoteOnlyKeyCount: number | null;
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
  valueBundleConflicts?: SyncPreviewValueBundleConflict[];
}

interface MergeResult {
  merged?: string;
  error?: string;
  conflicts?: boolean;
}

interface RemoteValueBundleSelection {
  valueBundles: Record<string, GmValueSyncBundle>;
  ignored: number;
  warnings: number;
}

interface RemoteValueBundleApplyResult {
  applied: number;
  skippedNonEmpty: number;
  skippedUserModified: number;
  skippedUnavailable: number;
  failures: number;
  preservedValueBundles: Record<string, GmValueSyncBundle>;
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
  'syncValues',
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
  const scripts = (envelope.scripts || []).map((script) => sanitizeSyncScriptForEnvelope(script));
  const valueBundles = sanitizeValueBundlesForUpload({
    ...envelope,
    scripts,
  });
  const sanitized: SyncEnvelope = {
    ...envelope,
    scripts,
  };
  delete sanitized.valueBundles;
  if (Object.keys(valueBundles).length > 0) sanitized.valueBundles = valueBundles;
  return sanitized;
}

async function readSyncEnvelopeFromRemote(
  remoteEnvelope: RemoteSyncEnvelope | null,
  settings: Settings,
): Promise<SyncEnvelope | null> {
  return SyncCrypto.decryptSyncEnvelope(remoteEnvelope, settings) as Promise<SyncEnvelope | null>;
}

async function prepareSyncEnvelopeForRemoteUpload(
  envelope: SyncEnvelope,
  settings: Settings,
): Promise<SyncEnvelope | RemoteSyncEnvelope> {
  return SyncCrypto.prepareSyncEnvelopeForUpload(
    sanitizeSyncEnvelopeForUpload(envelope),
    settings,
  ) as Promise<SyncEnvelope | RemoteSyncEnvelope>;
}

function sanitizeValueBundlesForUpload(envelope: SyncEnvelope): Record<string, GmValueSyncBundle> {
  const result: Record<string, GmValueSyncBundle> = {};
  const scriptsById = new Map<string, SyncScript>(
    (envelope.scripts || []).map((script) => [script.id, script]),
  );
  const sourceBundles = getSyncEnvelopeValueBundles(envelope);

  for (const [scriptId, bundle] of Object.entries(sourceBundles)) {
    const script = scriptsById.get(scriptId);
    if (!script || !shouldSyncScriptValues(script)) continue;
    if (!isPlainRecord(bundle) || bundle.schema !== GM_VALUE_SYNC_SCHEMA || bundle.scriptId !== scriptId) continue;
    if (!isPlainRecord(bundle.values)) continue;
    const rebuilt = buildGmValueSyncBundle(script, bundle.values);
    if (rebuilt.bundle) result[scriptId] = rebuilt.bundle;
  }

  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getSyncEnvelopeValueBundles(
  envelope: Pick<SyncEnvelope, 'valueBundles'> | null | undefined,
): Record<string, unknown> {
  return isPlainRecord(envelope?.valueBundles) ? envelope.valueBundles : {};
}

function createEmptyRemoteValueBundleSelection(): RemoteValueBundleSelection {
  return { valueBundles: {}, ignored: 0, warnings: 0 };
}

function createEmptyRemoteValueBundleApplyResult(): RemoteValueBundleApplyResult {
  return {
    applied: 0,
    skippedNonEmpty: 0,
    skippedUserModified: 0,
    skippedUnavailable: 0,
    failures: 0,
    preservedValueBundles: {},
  };
}

function summarizeRemoteValueBundleApplyResult(
  result: RemoteValueBundleApplyResult,
): ValueBundleSyncSummary | null {
  const summary: ValueBundleSyncSummary = {
    applied: result.applied,
    preserved: Object.keys(result.preservedValueBundles).length,
    conflictBlocked: result.skippedNonEmpty + result.skippedUserModified,
    skippedNonEmpty: result.skippedNonEmpty,
    skippedUserModified: result.skippedUserModified,
    skippedUnavailable: result.skippedUnavailable,
    failures: result.failures,
  };
  return Object.values(summary).some((value) => value > 0) ? summary : null;
}

function selectApplicableRemoteValueBundles(
  remote: SyncEnvelope | null | undefined,
  targetScripts: Array<Pick<Script, 'id' | 'settings'> | SyncScript> = [],
): RemoteValueBundleSelection {
  const sourceBundles = getSyncEnvelopeValueBundles(remote);
  if (Object.keys(sourceBundles).length === 0) return createEmptyRemoteValueBundleSelection();

  const result: RemoteValueBundleSelection = createEmptyRemoteValueBundleSelection();
  const scriptsById = new Map<string, Pick<Script, 'id' | 'settings'> | SyncScript>(
    targetScripts.map((script) => [script.id, script]),
  );

  for (const [scriptId, bundle] of Object.entries(sourceBundles)) {
    const script = scriptsById.get(scriptId);
    if (!script || !shouldSyncScriptValues(script)) {
      result.ignored += 1;
      continue;
    }
    if (!isPlainRecord(bundle) || bundle.schema !== GM_VALUE_SYNC_SCHEMA || bundle.scriptId !== scriptId) {
      result.ignored += 1;
      continue;
    }
    if (!isPlainRecord(bundle.values)) {
      result.ignored += 1;
      continue;
    }

    const rebuilt = buildGmValueSyncBundle(script, bundle.values);
    result.warnings += rebuilt.warnings.length;
    if (rebuilt.bundle) {
      result.valueBundles[scriptId] = rebuilt.bundle;
    } else {
      result.ignored += 1;
    }
  }

  return result;
}

function countRemoteValueBundlesApplyReady(
  selection: RemoteValueBundleSelection,
  local: SyncEnvelope | null | undefined,
): { ready: number; conflictBlocked: number; conflicts: SyncPreviewValueBundleConflict[] } {
  let ready = 0;
  let conflictBlocked = 0;
  const conflicts: SyncPreviewValueBundleConflict[] = [];
  const localBundles = getSyncEnvelopeValueBundles(local);
  const localScriptIds = new Set(
    Array.isArray(local?.scripts) ? local.scripts.map((script) => script.id) : [],
  );

  const addConflict = (
    reason: SyncPreviewValueBundleConflict['reason'],
    remoteBundle: GmValueSyncBundle,
    localBundle: unknown,
  ) => {
    conflictBlocked += 1;
    if (conflicts.length < 20) {
      conflicts.push(buildValueBundleConflictPreview(reason, remoteBundle, localBundle));
    }
  };

  for (const [scriptId, remoteBundle] of Object.entries(selection.valueBundles)) {
    const localBundle = localBundles[scriptId];
    if (!isPlainRecord(localBundle) && localScriptIds.has(scriptId)) {
      addConflict('local-bundle-unavailable', remoteBundle, localBundle);
    } else if (!isPlainRecord(localBundle) || Number(localBundle.keyCount) === 0) {
      ready += 1;
    } else {
      addConflict('local-values-present', remoteBundle, localBundle);
    }
  }

  return { ready, conflictBlocked, conflicts };
}

function safeBundleMetric(value: unknown): number {
  return Math.max(0, Number(value) || 0);
}

function buildValueBundleConflictPreview(
  reason: SyncPreviewValueBundleConflict['reason'],
  remoteBundle: GmValueSyncBundle,
  localBundle: unknown,
): SyncPreviewValueBundleConflict {
  const hasLocalBundle = isPlainRecord(localBundle);
  const keyCounts = hasLocalBundle
    ? countValueBundleKeyOverlap(localBundle.values, remoteBundle.values)
    : null;
  return {
    reason,
    localKeyCount: hasLocalBundle ? safeBundleMetric(localBundle.keyCount) : null,
    remoteKeyCount: safeBundleMetric(remoteBundle.keyCount),
    localBytes: hasLocalBundle ? safeBundleMetric(localBundle.bytes) : null,
    remoteBytes: safeBundleMetric(remoteBundle.bytes),
    overlappingKeyCount: keyCounts?.overlapping ?? null,
    localOnlyKeyCount: keyCounts?.localOnly ?? null,
    remoteOnlyKeyCount: keyCounts?.remoteOnly ?? null,
  };
}

function countValueBundleKeyOverlap(
  localValues: unknown,
  remoteValues: unknown,
): { overlapping: number; localOnly: number; remoteOnly: number } {
  const localKeys = new Set(isPlainRecord(localValues) ? Object.keys(localValues) : []);
  const remoteKeys = new Set(isPlainRecord(remoteValues) ? Object.keys(remoteValues) : []);
  let overlapping = 0;
  let localOnly = 0;
  let remoteOnly = 0;

  for (const key of localKeys) {
    if (remoteKeys.has(key)) overlapping += 1;
    else localOnly += 1;
  }
  for (const key of remoteKeys) {
    if (!localKeys.has(key)) remoteOnly += 1;
  }

  return { overlapping, localOnly, remoteOnly };
}

async function applyRemoteValueBundlesWhenLocalEmpty(
  selection: RemoteValueBundleSelection,
  currentScripts: Script[] | SyncScript[] = [],
): Promise<RemoteValueBundleApplyResult> {
  const result = createEmptyRemoteValueBundleApplyResult();
  const bundles = Object.entries(selection.valueBundles);
  if (bundles.length === 0) return result;

  if (
    typeof ScriptValues === 'undefined' ||
    typeof ScriptValues?.getAll !== 'function' ||
    typeof ScriptValues?.setAll !== 'function'
  ) {
    result.skippedUnavailable = bundles.length;
    result.preservedValueBundles = Object.fromEntries(bundles);
    return result;
  }

  const scriptsById = new Map<string, Script | SyncScript>(
    currentScripts.map((script) => [script.id, script]),
  );

  for (const [scriptId, bundle] of bundles) {
    const currentScript = scriptsById.get(scriptId);
    if (currentScript?.settings?.userModified) {
      result.skippedUserModified += 1;
      result.preservedValueBundles[scriptId] = bundle;
      continue;
    }

    try {
      const localValues = await ScriptValues.getAll(scriptId);
      if (Object.keys(localValues || {}).length > 0) {
        result.skippedNonEmpty += 1;
        result.preservedValueBundles[scriptId] = bundle;
        continue;
      }
      await ScriptValues.setAll(scriptId, bundle.values);
      result.applied += 1;
    } catch (_) {
      result.failures += 1;
      result.preservedValueBundles[scriptId] = bundle;
    }
  }

  return result;
}

async function buildValueBundlesForScripts(scripts: Script[] | SyncScript[]): Promise<{
  valueBundles: Record<string, GmValueSyncBundle>;
  optIns: number;
  warnings: number;
}> {
  const valueBundles: Record<string, GmValueSyncBundle> = {};
  let optIns = 0;
  let warnings = 0;
  if (typeof ScriptValues === 'undefined' || typeof ScriptValues?.getAll !== 'function') {
    const hasOptIns = scripts.some((script) => shouldSyncScriptValues(script));
    if (hasOptIns) throw new Error('GM value storage is unavailable for opted-in value sync');
    return { valueBundles, optIns, warnings };
  }

  for (const script of scripts) {
    if (!shouldSyncScriptValues(script)) continue;
    optIns++;
    const values = await ScriptValues.getAll(script.id);
    const result = buildGmValueSyncBundle(script, values);
    warnings += result.warnings.length;
    if (result.bundle) valueBundles[script.id] = result.bundle;
  }

  return { valueBundles, optIns, warnings };
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
    valueBundleWarnings: number;
  }> {
    const scripts = await ScriptStorage.getAll();
    const syncScripts = scripts.map((s): SyncScript => ({
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      settings: cloneSyncSafeScriptSettings(s.settings),
      updatedAt: s.updatedAt,
      syncBaseCode: s.syncBaseCode ?? null,
      name: s.meta?.name || s.id,
    }));
    const { valueBundles, warnings } = await buildValueBundlesForScripts(syncScripts);
    return {
      scripts,
      valueBundleWarnings: warnings,
      localData: {
        version: 1,
        timestamp: Date.now(),
        scripts: syncScripts,
        tombstones,
        ...(Object.keys(valueBundles).length > 0 ? { valueBundles } : {}),
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
    const { localData, valueBundleWarnings } = await this._buildLocalData(tombstones);

    let remoteData: SyncEnvelope | null = null;
    try {
      const remoteEnvelope = await provider.download(settings);
      remoteData = await readSyncEnvelopeFromRemote(remoteEnvelope, settings);
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
        valueBundleWarnings,
      }),
    };
  },

  previewData(
    local: SyncEnvelope,
    remote: SyncEnvelope | null,
    options: { provider?: string; providerLabel?: string; lastSync?: number | null; valueBundleWarnings?: number } = {},
  ): SyncPreviewResult {
    const localScripts = Array.isArray(local?.scripts) ? local.scripts : [];
    const remoteScripts = Array.isArray(remote?.scripts) ? remote.scripts : [];
    const tombstones: Record<string, unknown> = {
      ...(local?.tombstones ?? {}),
      ...(remote?.tombstones ?? {}),
    };
    const localById = new Map<string, SyncScript>(localScripts.map((script) => [script.id, script]));
    const remoteById = new Map<string, SyncScript>(remoteScripts.map((script) => [script.id, script]));
    const remoteValueBundleSelection = remote
      ? selectApplicableRemoteValueBundles(remote, this.mergeData(local, remote).scripts)
      : createEmptyRemoteValueBundleSelection();
    const remoteValueBundleApplyReadiness = countRemoteValueBundlesApplyReady(
      remoteValueBundleSelection,
      local,
    );
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
      localValueOptIns: localScripts.filter((script) => shouldSyncScriptValues(script)).length,
      localValueBundles: Object.keys(local?.valueBundles ?? {}).length,
      remoteValueBundles: Object.keys(remote?.valueBundles ?? {}).length,
      valueBundleWarnings: Math.max(0, Number(options.valueBundleWarnings) || 0),
      remoteValueBundlesApplicable: Object.keys(remoteValueBundleSelection.valueBundles).length,
      remoteValueBundlesApplyReady: remoteValueBundleApplyReadiness.ready,
      remoteValueBundlesConflictBlocked: remoteValueBundleApplyReadiness.conflictBlocked,
      remoteValueBundlesIgnored: remoteValueBundleSelection.ignored,
      remoteValueBundleWarnings: remoteValueBundleSelection.warnings,
      valueBundleApplyEnabled: true,
      valueBundleApplyMode: 'empty-local-only',
      wouldUpload: false,
      wouldDownload: false,
      wouldUploadValues: false,
      wouldApplyValues: false,
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
    summary.wouldUploadValues = summary.localValueBundles > 0;
    summary.wouldApplyValues = summary.valueBundleApplyEnabled && summary.remoteValueBundlesApplyReady > 0;

    return {
      dryRun: true,
      noWrites: true,
      provider: options.provider ?? null,
      providerLabel: options.providerLabel ?? options.provider ?? null,
      lastSync: options.lastSync ?? null,
      remoteFound: !!remote,
      summary,
      conflicts,
      valueBundleConflicts: remoteValueBundleApplyReadiness.conflicts,
    };
  },

  async _performSync(): Promise<SyncResult> {
    const settings = await SettingsManager.get();
    if (!settings.syncEnabled || settings.syncProvider === 'none') return {};

    const provider: CloudSyncProvider | undefined = this.providers[settings.syncProvider];
    if (!provider) return {};
    let valueBundleSync: ValueBundleSyncSummary | null = null;

    // Load tombstones (IDs of locally-deleted scripts, to prevent sync re-importing them)
    const tombstoneData = await chrome.storage.local.get('syncTombstones');
    const tombstones: Record<string, unknown> = (tombstoneData['syncTombstones'] as Record<string, unknown> | undefined) ?? {};

    // Get local data
    const scripts = await ScriptStorage.getAll();
    const localSyncScripts = scripts.map((s): SyncScript => ({
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      settings: cloneSyncSafeScriptSettings(s.settings),
      updatedAt: s.updatedAt
    }));
    const localValueBundleData = await buildValueBundlesForScripts(localSyncScripts);
    const localData: SyncEnvelope = {
      version: 1,
      timestamp: Date.now(),
      scripts: localSyncScripts,
      tombstones,
      ...(Object.keys(localValueBundleData.valueBundles).length > 0
        ? { valueBundles: localValueBundleData.valueBundles }
        : {}),
    };

    // Get remote data
    const remoteEnvelope = await provider.download(settings);
    const remoteData = await readSyncEnvelopeFromRemote(remoteEnvelope, settings);

    if (remoteData) {
      // Merge tombstones from remote so deletions propagate across devices
      const mergedTombstones: Record<string, unknown> = { ...tombstones, ...(remoteData.tombstones ?? {}) };

      // Merge: prefer newer versions
      const merged = this.mergeData(localData, remoteData);
      merged.scripts = merged.scripts.filter((script: SyncScript) => !mergedTombstones[script.id]);
      const remoteValueBundleSelection = selectApplicableRemoteValueBundles(remoteData, merged.scripts);
      if (
        Object.keys(remoteValueBundleSelection.valueBundles).length > 0 ||
        remoteValueBundleSelection.ignored > 0 ||
        remoteValueBundleSelection.warnings > 0
      ) {
        debugLog('[CloudSync] Remote GM value bundles checked:', {
          applicable: Object.keys(remoteValueBundleSelection.valueBundles).length,
          ignored: remoteValueBundleSelection.ignored,
          warnings: remoteValueBundleSelection.warnings,
          applyEnabled: true,
          applyMode: 'empty-local-only',
        });
      }
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

      // Rebuild the upload envelope from current local state so value bundles
      // reflect post-merge opt-ins and current GM storage.
      const postMergeScripts = await ScriptStorage.getAll();
      const remoteValueApplyResult = await applyRemoteValueBundlesWhenLocalEmpty(
        remoteValueBundleSelection,
        postMergeScripts,
      );
      valueBundleSync = summarizeRemoteValueBundleApplyResult(remoteValueApplyResult);
      if (
        remoteValueApplyResult.applied > 0 ||
        remoteValueApplyResult.skippedNonEmpty > 0 ||
        remoteValueApplyResult.skippedUserModified > 0 ||
        remoteValueApplyResult.skippedUnavailable > 0 ||
        remoteValueApplyResult.failures > 0
      ) {
        debugLog('[CloudSync] Remote GM value bundles apply result:', {
          applied: remoteValueApplyResult.applied,
          skippedNonEmpty: remoteValueApplyResult.skippedNonEmpty,
          skippedUserModified: remoteValueApplyResult.skippedUserModified,
          skippedUnavailable: remoteValueApplyResult.skippedUnavailable,
          failures: remoteValueApplyResult.failures,
          preserved: Object.keys(remoteValueApplyResult.preservedValueBundles).length,
        });
      }
      const uploadScripts = postMergeScripts.map((s): SyncScript => ({
        id: s.id,
        code: s.code,
        enabled: s.enabled,
        position: s.position,
        settings: cloneSyncSafeScriptSettings(s.settings),
        updatedAt: s.updatedAt,
        syncBaseCode: s.syncBaseCode ?? null,
      }));
      const postMergeValueBundleData = await buildValueBundlesForScripts(uploadScripts);
      const uploadValueBundles = {
        ...postMergeValueBundleData.valueBundles,
        ...remoteValueApplyResult.preservedValueBundles,
      };
      const uploadData: SyncEnvelope = {
        version: 1,
        timestamp: Date.now(),
        scripts: uploadScripts,
        tombstones: mergedTombstones,
        ...(Object.keys(uploadValueBundles).length > 0
          ? { valueBundles: uploadValueBundles }
          : {}),
      };
      await provider.upload(await prepareSyncEnvelopeForRemoteUpload(uploadData, settings), settings);
    } else {
      // First sync, just upload (include tombstones so remote gets deletion info)
      await provider.upload(await prepareSyncEnvelopeForRemoteUpload(localData, settings), settings);
    }

    await SettingsManager.set('lastSync', Date.now());
    return {
      success: true,
      ...(valueBundleSync ? { valueBundleSync } : {}),
    };
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
