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
  getAllMetadata?(scriptId: string): Promise<{ valueCount: number; lastUpdatedAt: number | null }>;
  getAllKeyMetadata?(scriptId: string): Promise<Record<string, { updatedAt: number }>>;
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
  download(settings: Settings, options?: { signal?: AbortSignal }): Promise<RemoteSyncEnvelope | null>;
  upload(data: SyncEnvelope | RemoteSyncEnvelope, settings: Settings, options?: { signal?: AbortSignal }): Promise<void>;
  sync?(settings: Settings, options?: { signal?: AbortSignal }): Promise<SyncResult>;
  name?: string;
  supportsDryRun?: boolean;
}

// ---------------------------------------------------------------------------
// CloudSyncProviders — external global registry of sync providers
// ---------------------------------------------------------------------------

declare const CloudSyncProviders: Record<string, CloudSyncProvider> & {
  _credentialStore?: {
    resolveSettings(settings: Settings): Promise<Settings>;
  };
};

async function resolveSyncCredentialSettings(settings: Settings): Promise<Settings> {
  if (typeof CloudSyncProviders?._credentialStore?.resolveSettings === 'function') {
    return CloudSyncProviders._credentialStore.resolveSettings(settings);
  }
  return settings;
}

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
  writeFailureRetryReady?: number;
  preservedRemoteNewer: number;
  preservedLocalNewer: number;
  preservedSameTimestamp: number;
  preservedRemoteTimestampOnly: number;
  preservedLocalTimestampOnly: number;
  preservedTimestampUnknown: number;
  preservedCandidateMergeReady: number;
  preservedCandidateMergeManualReview: number;
  preservedCandidateMergeUnavailable: number;
  preservedCandidateResultKeyTotal: number;
  preservedCandidateAutoSelectedKeyTotal: number;
  preservedCandidateReviewKeyTotal: number;
  preservedCandidateAcceptedResultKeyTotal: number;
  preservedCandidateBlockedSameTimestamp: number;
  preservedCandidateBlockedUnknownTimestamp: number;
  preservedCandidateBlockedOneSidedTimestamp: number;
  preservedCandidateBlockedUnavailable: number;
  preservedCandidateBlockedNoCandidateKeys: number;
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
  localValueBundlesWithTimestamps: number;
  localValueBundlesMissingTimestamps: number;
  localValueBundlesOlderThanLastSync: number;
  localValueBundlesNewerThanLastSync: number;
  remoteValueBundlesWithTimestamps: number;
  remoteValueBundlesMissingTimestamps: number;
  remoteValueBundlesOlderThanLastSync: number;
  remoteValueBundlesNewerThanLastSync: number;
  remoteValueBundleCandidateMergesReady: number;
  remoteValueBundleCandidateMergesManualReview: number;
  remoteValueBundleCandidateMergesUnavailable: number;
  remoteValueBundleMergeSimulationReadyPreviewOnly: number;
  remoteValueBundleMergeSimulationManualReview: number;
  remoteValueBundleMergeSimulationUnavailable: number;
  remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal: number;
  remoteValueBundleMergeSimulationManualReviewResultKeyTotal: number;
  remoteValueBundleMergeSimulationUnavailableResultKeyTotal: number;
  remoteValueBundleCandidateMergesBlockedSameTimestamp: number;
  remoteValueBundleCandidateMergesBlockedUnknownTimestamp: number;
  remoteValueBundleCandidateMergesBlockedOneSidedTimestamp: number;
  remoteValueBundleCandidateMergesBlockedUnavailable: number;
  remoteValueBundleCandidateMergesBlockedNoCandidateKeys: number;
  remoteValueBundleCandidateResultKeyTotal: number;
  remoteValueBundleCandidateAutoSelectedKeyTotal: number;
  remoteValueBundleCandidateReviewKeyTotal: number;
  remoteValueBundleCandidateAcceptedResultKeyTotal: number;
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

type ValueBundleLastWriteHint =
  | 'local-newer'
  | 'remote-newer'
  | 'same'
  | 'local-timestamp-only'
  | 'remote-timestamp-only'
  | 'unknown';

type ValueBundleCandidateMergePlan =
  | 'timestamp-guided'
  | 'remote-preferred'
  | 'local-preferred'
  | 'manual-review'
  | 'unavailable';

type ValueBundleCandidateMergeGate =
  | 'ready'
  | 'manual-review'
  | 'unavailable';

type ValueBundleCandidateMergeBlockReason =
  | 'none'
  | 'local-bundle-unavailable'
  | 'same-timestamp'
  | 'unknown-timestamp'
  | 'one-sided-timestamp'
  | 'no-candidate-keys';

type ValueBundleCandidateMergeSimulation =
  | 'ready-preview-only'
  | 'manual-review'
  | 'unavailable';

interface SyncPreviewValueBundleConflict {
  reason: 'local-values-present' | 'local-bundle-unavailable';
  localKeyCount: number | null;
  remoteKeyCount: number;
  localBytes: number | null;
  remoteBytes: number;
  overlappingKeyCount: number | null;
  localOnlyKeyCount: number | null;
  remoteOnlyKeyCount: number | null;
  localLastValueUpdatedAt: number | null;
  remoteLastValueUpdatedAt: number | null;
  lastWriteHint: ValueBundleLastWriteHint;
  overlappingRemoteNewerKeyCount: number | null;
  overlappingLocalNewerKeyCount: number | null;
  overlappingSameTimestampKeyCount: number | null;
  overlappingRemoteTimestampOnlyKeyCount: number | null;
  overlappingLocalTimestampOnlyKeyCount: number | null;
  overlappingUnknownTimestampKeyCount: number | null;
  candidateMergePlan: ValueBundleCandidateMergePlan;
  candidateRemoteKeyCount: number | null;
  candidateLocalKeyCount: number | null;
  candidateSameTimestampKeyCount: number | null;
  candidateManualKeyCount: number | null;
  candidateOneSidedTimestampKeyCount: number | null;
  candidateResultKeyCount: number | null;
  candidateAutoSelectedKeyCount: number | null;
  candidateReviewKeyCount: number | null;
  candidateMergeGate: ValueBundleCandidateMergeGate;
  candidateMergeBlockReason: ValueBundleCandidateMergeBlockReason;
  candidateMergeSimulation: ValueBundleCandidateMergeSimulation;
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
  writeFailureRetryReady: number;
  preservedValueBundles: Record<string, GmValueSyncBundle>;
  preservedRemoteNewer: number;
  preservedLocalNewer: number;
  preservedSameTimestamp: number;
  preservedRemoteTimestampOnly: number;
  preservedLocalTimestampOnly: number;
  preservedTimestampUnknown: number;
  preservedCandidateMergeReady: number;
  preservedCandidateMergeManualReview: number;
  preservedCandidateMergeUnavailable: number;
  preservedCandidateResultKeyTotal: number;
  preservedCandidateAutoSelectedKeyTotal: number;
  preservedCandidateReviewKeyTotal: number;
  preservedCandidateAcceptedResultKeyTotal: number;
  preservedCandidateBlockedSameTimestamp: number;
  preservedCandidateBlockedUnknownTimestamp: number;
  preservedCandidateBlockedOneSidedTimestamp: number;
  preservedCandidateBlockedUnavailable: number;
  preservedCandidateBlockedNoCandidateKeys: number;
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

// Once this profile has processed an encrypted envelope end-to-end, mark
// encryption as established so a later plaintext remote is rejected as a
// downgrade attack.
async function markSyncEncryptionEstablished(settings: Settings): Promise<void> {
  if (settings.syncEncryptionEnabled && !settings.syncEncryptionEstablished) {
    try { await SettingsManager.set('syncEncryptionEstablished', true); } catch (_e) { /* best effort */ }
  }
}

async function readSyncEnvelopeFromRemote(
  remoteEnvelope: RemoteSyncEnvelope | null,
  settings: Settings,
): Promise<SyncEnvelope | null> {
  const decrypted = await SyncCrypto.decryptSyncEnvelope(remoteEnvelope, settings) as SyncEnvelope | null;
  // A successful decrypt of an encrypted remote establishes the encryption
  // latch even on a download-only device.
  if (remoteEnvelope && SyncCrypto.isEncryptedSyncEnvelope(remoteEnvelope)) {
    await markSyncEncryptionEstablished(settings);
  }
  return decrypted;
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
    const rebuilt = buildGmValueSyncBundle(script, bundle.values, {
      lastValueUpdatedAt: getValueBundleLastUpdatedAt(bundle),
      keyMetadata: getValueBundleKeyMetadata(bundle),
    });
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

function getValueBundleLastUpdatedAt(bundle: unknown): number | undefined {
  if (!isPlainRecord(bundle)) return undefined;
  const timestamp = Number(bundle.lastValueUpdatedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return Math.floor(timestamp);
}

function summarizeValueBundleTimestampFreshness(
  bundles: Record<string, unknown>,
  lastSync: number | null | undefined,
): {
  withTimestamps: number;
  missingTimestamps: number;
  olderThanLastSync: number;
  newerThanLastSync: number;
} {
  const summary = {
    withTimestamps: 0,
    missingTimestamps: 0,
    olderThanLastSync: 0,
    newerThanLastSync: 0,
  };
  const lastSyncTimestamp = Number(lastSync);
  const hasLastSync = Number.isFinite(lastSyncTimestamp) && lastSyncTimestamp > 0;
  for (const bundle of Object.values(bundles)) {
    const updatedAt = getValueBundleLastUpdatedAt(bundle);
    if (!updatedAt) {
      summary.missingTimestamps += 1;
      continue;
    }
    summary.withTimestamps += 1;
    if (hasLastSync && updatedAt < lastSyncTimestamp) summary.olderThanLastSync += 1;
    if (hasLastSync && updatedAt > lastSyncTimestamp) summary.newerThanLastSync += 1;
  }
  return summary;
}

function setValueBundleMetadataKey(
  record: Record<string, { updatedAt: number }>,
  key: string,
  value: { updatedAt: number },
): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function getValueBundleKeyMetadata(bundle: unknown): Record<string, { updatedAt: number }> | undefined {
  if (!isPlainRecord(bundle) || !isPlainRecord(bundle.keyMetadata)) return undefined;
  const metadata: Record<string, { updatedAt: number }> = {};
  for (const [key, entry] of Object.entries(bundle.keyMetadata)) {
    const timestamp = isPlainRecord(entry) ? Number(entry.updatedAt) : Number(entry);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      setValueBundleMetadataKey(metadata, key, { updatedAt: Math.floor(timestamp) });
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function getValueBundleKeyUpdatedAt(
  metadata: Record<string, { updatedAt: number }> | undefined,
  key: string,
): number | null {
  if (!metadata) return null;
  const timestamp = Number(metadata[key]?.updatedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return Math.floor(timestamp);
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
    writeFailureRetryReady: 0,
    preservedValueBundles: {},
    preservedRemoteNewer: 0,
    preservedLocalNewer: 0,
    preservedSameTimestamp: 0,
    preservedRemoteTimestampOnly: 0,
    preservedLocalTimestampOnly: 0,
    preservedTimestampUnknown: 0,
    preservedCandidateMergeReady: 0,
    preservedCandidateMergeManualReview: 0,
    preservedCandidateMergeUnavailable: 0,
    preservedCandidateResultKeyTotal: 0,
    preservedCandidateAutoSelectedKeyTotal: 0,
    preservedCandidateReviewKeyTotal: 0,
    preservedCandidateAcceptedResultKeyTotal: 0,
    preservedCandidateBlockedSameTimestamp: 0,
    preservedCandidateBlockedUnknownTimestamp: 0,
    preservedCandidateBlockedOneSidedTimestamp: 0,
    preservedCandidateBlockedUnavailable: 0,
    preservedCandidateBlockedNoCandidateKeys: 0,
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
    ...(result.writeFailureRetryReady > 0
      ? { writeFailureRetryReady: result.writeFailureRetryReady }
      : {}),
    preservedRemoteNewer: result.preservedRemoteNewer,
    preservedLocalNewer: result.preservedLocalNewer,
    preservedSameTimestamp: result.preservedSameTimestamp,
    preservedRemoteTimestampOnly: result.preservedRemoteTimestampOnly,
    preservedLocalTimestampOnly: result.preservedLocalTimestampOnly,
    preservedTimestampUnknown: result.preservedTimestampUnknown,
    preservedCandidateMergeReady: result.preservedCandidateMergeReady,
    preservedCandidateMergeManualReview: result.preservedCandidateMergeManualReview,
    preservedCandidateMergeUnavailable: result.preservedCandidateMergeUnavailable,
    preservedCandidateResultKeyTotal: result.preservedCandidateResultKeyTotal,
    preservedCandidateAutoSelectedKeyTotal: result.preservedCandidateAutoSelectedKeyTotal,
    preservedCandidateReviewKeyTotal: result.preservedCandidateReviewKeyTotal,
    preservedCandidateAcceptedResultKeyTotal: result.preservedCandidateAcceptedResultKeyTotal,
    preservedCandidateBlockedSameTimestamp: result.preservedCandidateBlockedSameTimestamp,
    preservedCandidateBlockedUnknownTimestamp: result.preservedCandidateBlockedUnknownTimestamp,
    preservedCandidateBlockedOneSidedTimestamp: result.preservedCandidateBlockedOneSidedTimestamp,
    preservedCandidateBlockedUnavailable: result.preservedCandidateBlockedUnavailable,
    preservedCandidateBlockedNoCandidateKeys: result.preservedCandidateBlockedNoCandidateKeys,
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

    const rebuilt = buildGmValueSyncBundle(script, bundle.values, {
      lastValueUpdatedAt: getValueBundleLastUpdatedAt(bundle),
      keyMetadata: getValueBundleKeyMetadata(bundle),
    });
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
): {
  ready: number;
  conflictBlocked: number;
  conflicts: SyncPreviewValueBundleConflict[];
  candidateMergeReady: number;
  candidateMergeManualReview: number;
  candidateMergeUnavailable: number;
  mergeSimulationReadyPreviewOnlyResultKeyTotal: number;
  mergeSimulationManualReviewResultKeyTotal: number;
  mergeSimulationUnavailableResultKeyTotal: number;
  candidateMergeBlockedSameTimestamp: number;
  candidateMergeBlockedUnknownTimestamp: number;
  candidateMergeBlockedOneSidedTimestamp: number;
  candidateMergeBlockedUnavailable: number;
  candidateMergeBlockedNoCandidateKeys: number;
  candidateResultKeyTotal: number;
  candidateAutoSelectedKeyTotal: number;
  candidateReviewKeyTotal: number;
  candidateAcceptedResultKeyTotal: number;
} {
  let ready = 0;
  let conflictBlocked = 0;
  let candidateMergeReady = 0;
  let candidateMergeManualReview = 0;
  let candidateMergeUnavailable = 0;
  let mergeSimulationReadyPreviewOnlyResultKeyTotal = 0;
  let mergeSimulationManualReviewResultKeyTotal = 0;
  let mergeSimulationUnavailableResultKeyTotal = 0;
  let candidateMergeBlockedSameTimestamp = 0;
  let candidateMergeBlockedUnknownTimestamp = 0;
  let candidateMergeBlockedOneSidedTimestamp = 0;
  let candidateMergeBlockedUnavailable = 0;
  let candidateMergeBlockedNoCandidateKeys = 0;
  let candidateResultKeyTotal = 0;
  let candidateAutoSelectedKeyTotal = 0;
  let candidateReviewKeyTotal = 0;
  let candidateAcceptedResultKeyTotal = 0;
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
    const preview = buildValueBundleConflictPreview(reason, remoteBundle, localBundle);
    const candidateResultKeyCount = preview.candidateResultKeyCount ?? 0;
    if (preview.candidateMergeSimulation === 'ready-preview-only') {
      candidateMergeReady += 1;
      candidateAcceptedResultKeyTotal += candidateResultKeyCount;
      mergeSimulationReadyPreviewOnlyResultKeyTotal += candidateResultKeyCount;
    } else if (preview.candidateMergeSimulation === 'unavailable') {
      candidateMergeUnavailable += 1;
      mergeSimulationUnavailableResultKeyTotal += candidateResultKeyCount;
    } else {
      candidateMergeManualReview += 1;
      mergeSimulationManualReviewResultKeyTotal += candidateResultKeyCount;
    }
    if (preview.candidateMergeBlockReason === 'same-timestamp') candidateMergeBlockedSameTimestamp += 1;
    else if (preview.candidateMergeBlockReason === 'unknown-timestamp') candidateMergeBlockedUnknownTimestamp += 1;
    else if (preview.candidateMergeBlockReason === 'one-sided-timestamp') candidateMergeBlockedOneSidedTimestamp += 1;
    else if (preview.candidateMergeBlockReason === 'local-bundle-unavailable') candidateMergeBlockedUnavailable += 1;
    else if (preview.candidateMergeBlockReason === 'no-candidate-keys') candidateMergeBlockedNoCandidateKeys += 1;
    candidateResultKeyTotal += candidateResultKeyCount;
    candidateAutoSelectedKeyTotal += preview.candidateAutoSelectedKeyCount ?? 0;
    candidateReviewKeyTotal += preview.candidateReviewKeyCount ?? 0;
    if (conflicts.length < 20) {
      conflicts.push(preview);
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

  return {
    ready,
    conflictBlocked,
    conflicts,
    candidateMergeReady,
    candidateMergeManualReview,
    candidateMergeUnavailable,
    mergeSimulationReadyPreviewOnlyResultKeyTotal,
    mergeSimulationManualReviewResultKeyTotal,
    mergeSimulationUnavailableResultKeyTotal,
    candidateMergeBlockedSameTimestamp,
    candidateMergeBlockedUnknownTimestamp,
    candidateMergeBlockedOneSidedTimestamp,
    candidateMergeBlockedUnavailable,
    candidateMergeBlockedNoCandidateKeys,
    candidateResultKeyTotal,
    candidateAutoSelectedKeyTotal,
    candidateReviewKeyTotal,
    candidateAcceptedResultKeyTotal,
  };
}

function safeBundleMetric(value: unknown): number {
  return Math.max(0, Number(value) || 0);
}

function compareValueBundleLastWrite(
  localTimestamp: number | null,
  remoteTimestamp: number | null,
): ValueBundleLastWriteHint {
  if (localTimestamp && remoteTimestamp) {
    if (localTimestamp > remoteTimestamp) return 'local-newer';
    if (remoteTimestamp > localTimestamp) return 'remote-newer';
    return 'same';
  }
  if (localTimestamp) return 'local-timestamp-only';
  if (remoteTimestamp) return 'remote-timestamp-only';
  return 'unknown';
}

function countPreservedValueBundleTimestampHint(
  result: RemoteValueBundleApplyResult,
  localBundle: unknown,
  remoteBundle: GmValueSyncBundle,
): void {
  const localLastValueUpdatedAt = getValueBundleLastUpdatedAt(localBundle) ?? null;
  const remoteLastValueUpdatedAt = getValueBundleLastUpdatedAt(remoteBundle) ?? null;
  const hint = compareValueBundleLastWrite(localLastValueUpdatedAt, remoteLastValueUpdatedAt);
  if (hint === 'remote-newer') result.preservedRemoteNewer += 1;
  else if (hint === 'local-newer') result.preservedLocalNewer += 1;
  else if (hint === 'same') result.preservedSameTimestamp += 1;
  else if (hint === 'remote-timestamp-only') result.preservedRemoteTimestampOnly += 1;
  else if (hint === 'local-timestamp-only') result.preservedLocalTimestampOnly += 1;
  else result.preservedTimestampUnknown += 1;
}

function countPreservedValueBundleCandidateMerge(
  result: RemoteValueBundleApplyResult,
  localBundle: unknown,
  remoteBundle: GmValueSyncBundle,
): void {
  const hasLocalBundle = isPlainRecord(localBundle);
  const keyCounts = hasLocalBundle
    ? countValueBundleKeyOverlap(
      localBundle.values,
      remoteBundle.values,
      getValueBundleKeyMetadata(localBundle),
      getValueBundleKeyMetadata(remoteBundle),
    )
    : null;
  const candidateMerge = buildValueBundleCandidateMergePlan(keyCounts);
  const candidateGate = buildValueBundleCandidateMergeGate(keyCounts, candidateMerge);
  const candidateResult = buildValueBundleCandidateMergeResult(keyCounts, candidateMerge, candidateGate);
  if (candidateGate.gate === 'ready') result.preservedCandidateMergeReady += 1;
  else if (candidateGate.gate === 'unavailable') result.preservedCandidateMergeUnavailable += 1;
  else result.preservedCandidateMergeManualReview += 1;
  if (candidateGate.blockReason === 'same-timestamp') result.preservedCandidateBlockedSameTimestamp += 1;
  else if (candidateGate.blockReason === 'unknown-timestamp') result.preservedCandidateBlockedUnknownTimestamp += 1;
  else if (candidateGate.blockReason === 'one-sided-timestamp') result.preservedCandidateBlockedOneSidedTimestamp += 1;
  else if (candidateGate.blockReason === 'local-bundle-unavailable') result.preservedCandidateBlockedUnavailable += 1;
  else if (candidateGate.blockReason === 'no-candidate-keys') result.preservedCandidateBlockedNoCandidateKeys += 1;
  result.preservedCandidateResultKeyTotal += candidateResult.resultKeyCount ?? 0;
  result.preservedCandidateAutoSelectedKeyTotal += candidateResult.autoSelectedKeyCount ?? 0;
  result.preservedCandidateReviewKeyTotal += candidateResult.reviewKeyCount ?? 0;
  if (candidateGate.gate === 'ready') {
    result.preservedCandidateAcceptedResultKeyTotal += candidateResult.resultKeyCount ?? 0;
  }
}

function preserveRemoteValueBundle(
  result: RemoteValueBundleApplyResult,
  scriptId: string,
  remoteBundle: GmValueSyncBundle,
  localBundle: unknown,
): void {
  result.preservedValueBundles[scriptId] = remoteBundle;
  countPreservedValueBundleTimestampHint(result, localBundle, remoteBundle);
  countPreservedValueBundleCandidateMerge(result, localBundle, remoteBundle);
}

function buildValueBundleConflictPreview(
  reason: SyncPreviewValueBundleConflict['reason'],
  remoteBundle: GmValueSyncBundle,
  localBundle: unknown,
): SyncPreviewValueBundleConflict {
  const hasLocalBundle = isPlainRecord(localBundle);
  const localKeyMetadata = hasLocalBundle ? getValueBundleKeyMetadata(localBundle) : undefined;
  const remoteKeyMetadata = getValueBundleKeyMetadata(remoteBundle);
  const keyCounts = hasLocalBundle
    ? countValueBundleKeyOverlap(localBundle.values, remoteBundle.values, localKeyMetadata, remoteKeyMetadata)
    : null;
  const localLastValueUpdatedAt = hasLocalBundle
    ? getValueBundleLastUpdatedAt(localBundle) ?? null
    : null;
  const remoteLastValueUpdatedAt = getValueBundleLastUpdatedAt(remoteBundle) ?? null;
  const candidateMerge = buildValueBundleCandidateMergePlan(keyCounts);
  const candidateGate = buildValueBundleCandidateMergeGate(keyCounts, candidateMerge);
  const candidateResult = buildValueBundleCandidateMergeResult(keyCounts, candidateMerge, candidateGate);
  return {
    reason,
    localKeyCount: hasLocalBundle ? safeBundleMetric(localBundle.keyCount) : null,
    remoteKeyCount: safeBundleMetric(remoteBundle.keyCount),
    localBytes: hasLocalBundle ? safeBundleMetric(localBundle.bytes) : null,
    remoteBytes: safeBundleMetric(remoteBundle.bytes),
    overlappingKeyCount: keyCounts?.overlapping ?? null,
    localOnlyKeyCount: keyCounts?.localOnly ?? null,
    remoteOnlyKeyCount: keyCounts?.remoteOnly ?? null,
    localLastValueUpdatedAt,
    remoteLastValueUpdatedAt,
    lastWriteHint: compareValueBundleLastWrite(localLastValueUpdatedAt, remoteLastValueUpdatedAt),
    overlappingRemoteNewerKeyCount: keyCounts?.overlappingRemoteNewer ?? null,
    overlappingLocalNewerKeyCount: keyCounts?.overlappingLocalNewer ?? null,
    overlappingSameTimestampKeyCount: keyCounts?.overlappingSameTimestamp ?? null,
    overlappingRemoteTimestampOnlyKeyCount: keyCounts?.overlappingRemoteTimestampOnly ?? null,
    overlappingLocalTimestampOnlyKeyCount: keyCounts?.overlappingLocalTimestampOnly ?? null,
    overlappingUnknownTimestampKeyCount: keyCounts?.overlappingUnknownTimestamp ?? null,
    candidateMergePlan: candidateMerge.plan,
    candidateRemoteKeyCount: candidateMerge.remoteKeyCount,
    candidateLocalKeyCount: candidateMerge.localKeyCount,
    candidateSameTimestampKeyCount: candidateMerge.sameTimestampKeyCount,
    candidateManualKeyCount: candidateMerge.manualKeyCount,
    candidateOneSidedTimestampKeyCount: candidateGate.oneSidedTimestampKeyCount,
    candidateResultKeyCount: candidateResult.resultKeyCount,
    candidateAutoSelectedKeyCount: candidateResult.autoSelectedKeyCount,
    candidateReviewKeyCount: candidateResult.reviewKeyCount,
    candidateMergeGate: candidateGate.gate,
    candidateMergeBlockReason: candidateGate.blockReason,
    candidateMergeSimulation: getValueBundleCandidateMergeSimulation(candidateGate.gate),
  };
}

function buildValueBundleCandidateMergePlan(
  keyCounts: ReturnType<typeof countValueBundleKeyOverlap> | null,
): {
  plan: ValueBundleCandidateMergePlan;
  remoteKeyCount: number | null;
  localKeyCount: number | null;
  sameTimestampKeyCount: number | null;
  manualKeyCount: number | null;
} {
  if (!keyCounts) {
    return {
      plan: 'unavailable',
      remoteKeyCount: null,
      localKeyCount: null,
      sameTimestampKeyCount: null,
      manualKeyCount: null,
    };
  }
  const remoteKeyCount = keyCounts.remoteOnly
    + keyCounts.overlappingRemoteNewer
    + keyCounts.overlappingRemoteTimestampOnly;
  const localKeyCount = keyCounts.localOnly
    + keyCounts.overlappingLocalNewer
    + keyCounts.overlappingLocalTimestampOnly;
  const sameTimestampKeyCount = keyCounts.overlappingSameTimestamp;
  const manualKeyCount = keyCounts.overlappingUnknownTimestamp;
  let plan: ValueBundleCandidateMergePlan = 'manual-review';
  if (manualKeyCount > 0 || sameTimestampKeyCount > 0) plan = 'manual-review';
  else if (remoteKeyCount > 0 && localKeyCount > 0) plan = 'timestamp-guided';
  else if (remoteKeyCount > 0) plan = 'remote-preferred';
  else if (localKeyCount > 0) plan = 'local-preferred';
  return { plan, remoteKeyCount, localKeyCount, sameTimestampKeyCount, manualKeyCount };
}

function isValueBundleCandidateMergeAcceptanceReady(
  keyCounts: ReturnType<typeof countValueBundleKeyOverlap>,
  candidateMerge: ReturnType<typeof buildValueBundleCandidateMergePlan>,
  oneSidedTimestampKeyCount: number,
): boolean {
  const candidateKeyCount = (candidateMerge.remoteKeyCount ?? 0) + (candidateMerge.localKeyCount ?? 0);
  const resultKeyCount = keyCounts.localOnly + keyCounts.remoteOnly + keyCounts.overlapping;
  const reviewKeyCount = (candidateMerge.sameTimestampKeyCount ?? 0)
    + (candidateMerge.manualKeyCount ?? 0)
    + oneSidedTimestampKeyCount;
  return candidateKeyCount > 0
    && candidateKeyCount === resultKeyCount
    && reviewKeyCount === 0;
}

function buildValueBundleCandidateMergeGate(
  keyCounts: ReturnType<typeof countValueBundleKeyOverlap> | null,
  candidateMerge: ReturnType<typeof buildValueBundleCandidateMergePlan>,
): {
  gate: ValueBundleCandidateMergeGate;
  blockReason: ValueBundleCandidateMergeBlockReason;
  oneSidedTimestampKeyCount: number | null;
} {
  if (!keyCounts) {
    return {
      gate: 'unavailable',
      blockReason: 'local-bundle-unavailable',
      oneSidedTimestampKeyCount: null,
    };
  }
  const oneSidedTimestampKeyCount = keyCounts.overlappingRemoteTimestampOnly
    + keyCounts.overlappingLocalTimestampOnly;
  if (candidateMerge.manualKeyCount && candidateMerge.manualKeyCount > 0) {
    return { gate: 'manual-review', blockReason: 'unknown-timestamp', oneSidedTimestampKeyCount };
  }
  if (candidateMerge.sameTimestampKeyCount && candidateMerge.sameTimestampKeyCount > 0) {
    return { gate: 'manual-review', blockReason: 'same-timestamp', oneSidedTimestampKeyCount };
  }
  if (oneSidedTimestampKeyCount > 0) {
    return { gate: 'manual-review', blockReason: 'one-sided-timestamp', oneSidedTimestampKeyCount };
  }
  const candidateKeyCount = (candidateMerge.remoteKeyCount ?? 0) + (candidateMerge.localKeyCount ?? 0);
  if (candidateKeyCount <= 0) {
    return { gate: 'manual-review', blockReason: 'no-candidate-keys', oneSidedTimestampKeyCount };
  }
  if (!isValueBundleCandidateMergeAcceptanceReady(keyCounts, candidateMerge, oneSidedTimestampKeyCount)) {
    return { gate: 'manual-review', blockReason: 'unknown-timestamp', oneSidedTimestampKeyCount };
  }
  return { gate: 'ready', blockReason: 'none', oneSidedTimestampKeyCount };
}

function getValueBundleCandidateMergeSimulation(
  gate: ValueBundleCandidateMergeGate,
): ValueBundleCandidateMergeSimulation {
  if (gate === 'ready') return 'ready-preview-only';
  if (gate === 'unavailable') return 'unavailable';
  return 'manual-review';
}

function buildValueBundleCandidateMergeResult(
  keyCounts: ReturnType<typeof countValueBundleKeyOverlap> | null,
  candidateMerge: ReturnType<typeof buildValueBundleCandidateMergePlan>,
  candidateGate: ReturnType<typeof buildValueBundleCandidateMergeGate>,
): {
  resultKeyCount: number | null;
  autoSelectedKeyCount: number | null;
  reviewKeyCount: number | null;
} {
  if (!keyCounts) {
    return { resultKeyCount: null, autoSelectedKeyCount: null, reviewKeyCount: null };
  }
  const resultKeyCount = keyCounts.localOnly + keyCounts.remoteOnly + keyCounts.overlapping;
  const autoSelectedKeyCount = (candidateMerge.remoteKeyCount ?? 0) + (candidateMerge.localKeyCount ?? 0);
  const reviewKeyCount = (candidateMerge.sameTimestampKeyCount ?? 0)
    + (candidateMerge.manualKeyCount ?? 0)
    + (candidateGate.oneSidedTimestampKeyCount ?? 0);
  return { resultKeyCount, autoSelectedKeyCount, reviewKeyCount };
}

function countValueBundleKeyOverlap(
  localValues: unknown,
  remoteValues: unknown,
  localKeyMetadata?: Record<string, { updatedAt: number }>,
  remoteKeyMetadata?: Record<string, { updatedAt: number }>,
): {
  overlapping: number;
  localOnly: number;
  remoteOnly: number;
  overlappingRemoteNewer: number;
  overlappingLocalNewer: number;
  overlappingSameTimestamp: number;
  overlappingRemoteTimestampOnly: number;
  overlappingLocalTimestampOnly: number;
  overlappingUnknownTimestamp: number;
} {
  const localKeys = new Set(isPlainRecord(localValues) ? Object.keys(localValues) : []);
  const remoteKeys = new Set(isPlainRecord(remoteValues) ? Object.keys(remoteValues) : []);
  let overlapping = 0;
  let localOnly = 0;
  let remoteOnly = 0;
  let overlappingRemoteNewer = 0;
  let overlappingLocalNewer = 0;
  let overlappingSameTimestamp = 0;
  let overlappingRemoteTimestampOnly = 0;
  let overlappingLocalTimestampOnly = 0;
  let overlappingUnknownTimestamp = 0;

  for (const key of localKeys) {
    if (remoteKeys.has(key)) {
      overlapping += 1;
      const hint = compareValueBundleLastWrite(
        getValueBundleKeyUpdatedAt(localKeyMetadata, key),
        getValueBundleKeyUpdatedAt(remoteKeyMetadata, key),
      );
      if (hint === 'remote-newer') overlappingRemoteNewer += 1;
      else if (hint === 'local-newer') overlappingLocalNewer += 1;
      else if (hint === 'same') overlappingSameTimestamp += 1;
      else if (hint === 'remote-timestamp-only') overlappingRemoteTimestampOnly += 1;
      else if (hint === 'local-timestamp-only') overlappingLocalTimestampOnly += 1;
      else overlappingUnknownTimestamp += 1;
    } else {
      localOnly += 1;
    }
  }
  for (const key of remoteKeys) {
    if (!localKeys.has(key)) remoteOnly += 1;
  }

  return {
    overlapping,
    localOnly,
    remoteOnly,
    overlappingRemoteNewer,
    overlappingLocalNewer,
    overlappingSameTimestamp,
    overlappingRemoteTimestampOnly,
    overlappingLocalTimestampOnly,
    overlappingUnknownTimestamp,
  };
}

async function applyRemoteValueBundlesWhenLocalEmpty(
  selection: RemoteValueBundleSelection,
  currentScripts: Script[] | SyncScript[] = [],
  localValueBundles: Record<string, unknown> = {},
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
    for (const [scriptId, bundle] of bundles) {
      preserveRemoteValueBundle(result, scriptId, bundle, localValueBundles[scriptId]);
    }
    return result;
  }

  const scriptsById = new Map<string, Script | SyncScript>(
    currentScripts.map((script) => [script.id, script]),
  );

  for (const [scriptId, bundle] of bundles) {
    const currentScript = scriptsById.get(scriptId);
    const localBundle = localValueBundles[scriptId];
    if (currentScript?.settings?.userModified) {
      result.skippedUserModified += 1;
      preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
      continue;
    }

    let localValues: Record<string, unknown> | null = null;
    try {
      localValues = await ScriptValues.getAll(scriptId);
    } catch (_) {
      result.failures += 1;
      preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
      continue;
    }

    if (Object.keys(localValues || {}).length > 0) {
      result.skippedNonEmpty += 1;
      preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
      continue;
    }

    try {
      await ScriptValues.setAll(scriptId, bundle.values);
      result.applied += 1;
    } catch (_) {
      result.failures += 1;
      result.writeFailureRetryReady += 1;
      preserveRemoteValueBundle(result, scriptId, bundle, localBundle);
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
    const metadata = typeof ScriptValues.getAllMetadata === 'function'
      ? await ScriptValues.getAllMetadata(script.id)
      : null;
    const keyMetadata = typeof ScriptValues.getAllKeyMetadata === 'function'
      ? await ScriptValues.getAllKeyMetadata(script.id)
      : null;
    const result = buildGmValueSyncBundle(script, values, {
      lastValueUpdatedAt: metadata?.lastUpdatedAt ?? null,
      keyMetadata,
    });
    warnings += result.warnings.length;
    if (result.bundle) valueBundles[script.id] = result.bundle;
  }

  return { valueBundles, optIns, warnings };
}

function mergeValueBundlesForUpload(
  localValueBundles: Record<string, GmValueSyncBundle>,
  preservedRemoteValueBundles: Record<string, GmValueSyncBundle>,
): Record<string, GmValueSyncBundle> {
  const uploadValueBundles: Record<string, GmValueSyncBundle> = { ...localValueBundles };
  for (const [scriptId, remoteBundle] of Object.entries(preservedRemoteValueBundles)) {
    const localBundle = localValueBundles[scriptId];
    const localHasValues = localBundle
      && safeBundleMetric(localBundle.keyCount) > 0
      && isPlainRecord(localBundle.values)
      && Object.keys(localBundle.values).length > 0;
    if (
      localHasValues &&
      compareValueBundleLastWrite(
        getValueBundleLastUpdatedAt(localBundle) ?? null,
        getValueBundleLastUpdatedAt(remoteBundle) ?? null,
      ) === 'local-newer'
    ) {
      continue;
    }
    uploadValueBundles[scriptId] = remoteBundle;
  }
  return uploadValueBundles;
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

// ---------------------------------------------------------------------------
// CloudSync object
// ---------------------------------------------------------------------------

export const CloudSync = {
  // Use providers from imported CloudSyncProviders module
  get providers(): Record<string, CloudSyncProvider> {
    return CloudSyncProviders;
  },

  _syncInProgress: false,
  _abortController: null as AbortController | null,

  async sync(): Promise<SyncResult> {
    // Prevent concurrent syncs — second call defers until first completes
    if (this._syncInProgress) {
      debugLog('[CloudSync] Sync already in progress, skipping');
      return { skipped: true };
    }
    this._syncInProgress = true;
    this._abortController = new AbortController();
    let releaseSyncEngineLock: (() => void) | null = null;

    const syncTimeoutAlarm = 'sv_sync_timeout_' + Date.now();
    let onTimeoutAlarm: ((alarm: chrome.alarms.Alarm) => void) | null = null;
    const removeTimeoutAlarmListener = () => {
      if (!onTimeoutAlarm) return;
      try {
        chrome.alarms.onAlarm.removeListener?.(onTimeoutAlarm);
      } catch (_) {}
      onTimeoutAlarm = null;
    };

    try {
      const settings = await resolveSyncCredentialSettings(await SettingsManager.get());
      const selectedProvider = settings.syncProvider;
      const provider: CloudSyncProvider | undefined =
        selectedProvider && selectedProvider !== 'none' ? this.providers[selectedProvider] : undefined;
      const providerOwnsSync = typeof provider?.sync === 'function';
      if (settings.syncEnabled && selectedProvider !== 'none' && !providerOwnsSync) {
        releaseSyncEngineLock = acquireSyncEngineLock('cloud-sync');
        if (!releaseSyncEngineLock) {
          debugLog('[CloudSync] Another sync engine is already in progress, skipping');
          return { skipped: true };
        }
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        chrome.alarms.create(syncTimeoutAlarm, { delayInMinutes: 1.5 });
        onTimeoutAlarm = (alarm: chrome.alarms.Alarm) => {
          if (alarm.name !== syncTimeoutAlarm) return;
          removeTimeoutAlarmListener();
          try {
            this._abortController?.abort(new Error('Sync timed out after 90s'));
          } catch (_) {}
          reject(new Error('Sync timed out after 90s'));
        };
        chrome.alarms.onAlarm.addListener(onTimeoutAlarm);
      });
      return await Promise.race([
        this._performSync({ signal: this._abortController.signal, settings }),
        timeoutPromise,
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ScriptVault] Sync failed:', e);
      return { error: msg };
    } finally {
      releaseSyncEngineLock?.();
      removeTimeoutAlarmListener();
      try {
        await Promise.resolve(chrome.alarms.clear(syncTimeoutAlarm));
      } catch (_) {}
      this._syncInProgress = false;
      this._abortController = null;
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
    const settings = await resolveSyncCredentialSettings(await SettingsManager.get());
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
    const localValueBundleFreshness = summarizeValueBundleTimestampFreshness(
      getSyncEnvelopeValueBundles(local),
      options.lastSync,
    );
    const remoteValueBundleFreshness = summarizeValueBundleTimestampFreshness(
      getSyncEnvelopeValueBundles(remote),
      options.lastSync,
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
      localValueBundlesWithTimestamps: localValueBundleFreshness.withTimestamps,
      localValueBundlesMissingTimestamps: localValueBundleFreshness.missingTimestamps,
      localValueBundlesOlderThanLastSync: localValueBundleFreshness.olderThanLastSync,
      localValueBundlesNewerThanLastSync: localValueBundleFreshness.newerThanLastSync,
      remoteValueBundlesWithTimestamps: remoteValueBundleFreshness.withTimestamps,
      remoteValueBundlesMissingTimestamps: remoteValueBundleFreshness.missingTimestamps,
      remoteValueBundlesOlderThanLastSync: remoteValueBundleFreshness.olderThanLastSync,
      remoteValueBundlesNewerThanLastSync: remoteValueBundleFreshness.newerThanLastSync,
      remoteValueBundleCandidateMergesReady: remoteValueBundleApplyReadiness.candidateMergeReady,
      remoteValueBundleCandidateMergesManualReview: remoteValueBundleApplyReadiness.candidateMergeManualReview,
      remoteValueBundleCandidateMergesUnavailable: remoteValueBundleApplyReadiness.candidateMergeUnavailable,
      remoteValueBundleMergeSimulationReadyPreviewOnly: remoteValueBundleApplyReadiness.candidateMergeReady,
      remoteValueBundleMergeSimulationManualReview: remoteValueBundleApplyReadiness.candidateMergeManualReview,
      remoteValueBundleMergeSimulationUnavailable: remoteValueBundleApplyReadiness.candidateMergeUnavailable,
      remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal: remoteValueBundleApplyReadiness.mergeSimulationReadyPreviewOnlyResultKeyTotal,
      remoteValueBundleMergeSimulationManualReviewResultKeyTotal: remoteValueBundleApplyReadiness.mergeSimulationManualReviewResultKeyTotal,
      remoteValueBundleMergeSimulationUnavailableResultKeyTotal: remoteValueBundleApplyReadiness.mergeSimulationUnavailableResultKeyTotal,
      remoteValueBundleCandidateMergesBlockedSameTimestamp: remoteValueBundleApplyReadiness.candidateMergeBlockedSameTimestamp,
      remoteValueBundleCandidateMergesBlockedUnknownTimestamp: remoteValueBundleApplyReadiness.candidateMergeBlockedUnknownTimestamp,
      remoteValueBundleCandidateMergesBlockedOneSidedTimestamp: remoteValueBundleApplyReadiness.candidateMergeBlockedOneSidedTimestamp,
      remoteValueBundleCandidateMergesBlockedUnavailable: remoteValueBundleApplyReadiness.candidateMergeBlockedUnavailable,
      remoteValueBundleCandidateMergesBlockedNoCandidateKeys: remoteValueBundleApplyReadiness.candidateMergeBlockedNoCandidateKeys,
      remoteValueBundleCandidateResultKeyTotal: remoteValueBundleApplyReadiness.candidateResultKeyTotal,
      remoteValueBundleCandidateAutoSelectedKeyTotal: remoteValueBundleApplyReadiness.candidateAutoSelectedKeyTotal,
      remoteValueBundleCandidateReviewKeyTotal: remoteValueBundleApplyReadiness.candidateReviewKeyTotal,
      remoteValueBundleCandidateAcceptedResultKeyTotal: remoteValueBundleApplyReadiness.candidateAcceptedResultKeyTotal,
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

  async _performSync(opts: { signal?: AbortSignal; settings?: Settings } = {}): Promise<SyncResult> {
    const { signal } = opts;
    const settings = opts.settings ?? await resolveSyncCredentialSettings(await SettingsManager.get());
    if (!settings.syncEnabled || settings.syncProvider === 'none') return {};
    if (signal?.aborted) throw new Error('Sync aborted');

    const provider: CloudSyncProvider | undefined = this.providers[settings.syncProvider];
    if (!provider) return {};
    if (typeof provider.sync === 'function') {
      return await provider.sync(settings, { signal });
    }
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
      updatedAt: s.updatedAt,
      syncBaseCode: s.syncBaseCode ?? null,
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
    const remoteEnvelope = await provider.download(settings, { signal });
    const remoteData = await readSyncEnvelopeFromRemote(remoteEnvelope, settings);
    if (signal?.aborted) throw new Error('Sync aborted');

    if (remoteData) {
      // Merge tombstones from remote so deletions propagate across devices
      const mergedTombstones: Record<string, unknown> = { ...tombstones, ...(remoteData.tombstones ?? {}) };

      // Merge: prefer newer versions
      const merged = this.mergeData(localData, remoteData);
      // Resurrection: a script saved AFTER its tombstone was written wins over
      // the tombstone (restore-from-trash, ID-preserving backup import).
      // Without this, the remote tombstone re-deletes the restored script on
      // the next sync — permanently, since deleteSyncedScript bypasses trash.
      //
      // mergeData() already drops tombstoned ids from merged.scripts, so the
      // resurrection candidate must be looked up in the UNFILTERED local/remote
      // union (newer wins) — checking merged.scripts here would never match and
      // left this guard dead. When a candidate wins, drop the tombstone AND
      // re-include the script that mergeData removed.
      const resurrectionUnion = new Map<string, SyncScript>();
      for (const s of (localData.scripts || [])) resurrectionUnion.set(s.id, s);
      for (const s of (remoteData.scripts || [])) {
        const existingUnion = resurrectionUnion.get(s.id);
        if (!existingUnion || s.updatedAt > existingUnion.updatedAt) resurrectionUnion.set(s.id, s);
      }
      for (const tombstoneId of Object.keys(mergedTombstones)) {
        const tombstoneTs = mergedTombstones[tombstoneId];
        if (typeof tombstoneTs !== 'number') continue; // legacy entry: deletion wins
        const candidate = resurrectionUnion.get(tombstoneId);
        if (candidate && candidate.updatedAt > tombstoneTs) {
          delete mergedTombstones[tombstoneId];
          if (!merged.scripts.some((s: SyncScript) => s.id === tombstoneId)) {
            merged.scripts.push(sanitizeSyncScriptForEnvelope(candidate));
          }
        }
      }
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
        const deleted = await runExclusiveScriptOperation(localScript.id, async () => {
          if (signal?.aborted) throw new Error('Sync aborted');
          await deleteSyncedScript(localScript.id);
          return true;
        });
        if (deleted) localMutated = true;
      }

      // Apply merged data locally, skipping tombstoned (deleted) scripts
      // Uses 3-way text merge when both sides have changed since sync base.
      // Chrome routes through the offscreen document; Firefox runs Diff inline.
      for (const script of merged.scripts) {
        if (signal?.aborted) throw new Error('Sync aborted');
        if (mergedTombstones[script.id]) continue; // deleted on some device, don't re-import
        const applied = await runExclusiveScriptOperation(script.id, async () => {
        if (signal?.aborted) throw new Error('Sync aborted');
        const existing = await ScriptStorage.get(script.id);
        // Skip scripts marked as locally modified — user edits take precedence over remote
        if (existing?.settings?.userModified) return false;

        const remoteScript = remoteData.scripts?.find((s: SyncScript) => s.id === script.id);

        let codeToSave: string = script.code;
        let mergeConflict = false;
        let didThreeWayMerge = false;
        let selectedOneSidedCodeChange = false;

        // 3-way merge: both sides changed since the last known sync base.
        // Compare against the base (NOT against the pre-sync snapshot — the
        // snapshot and `existing` read the same storage, so that comparison
        // is always false and used to dead-gate this branch into LWW).
        // `existing.code` is the freshest local text, so it is the merge's
        // local side.
        if (existing && remoteScript && existing.code !== remoteScript.code) {
          const base: string | null = existing.syncBaseCode ?? null;
          // Allow empty-string base (valid code); only skip if truly missing.
          // If exactly one side changed from the base, keep that side's code
          // even when the other side has a newer metadata timestamp.
          if (base != null) {
            const localChangedFromBase = existing.code !== base;
            const remoteChangedFromBase = remoteScript.code !== base;
            if (localChangedFromBase !== remoteChangedFromBase) {
              codeToSave = localChangedFromBase ? existing.code : remoteScript.code;
              selectedOneSidedCodeChange = true;
            } else if (localChangedFromBase && remoteChangedFromBase) {
              try {
                const mergeResult: MergeResult = await mergeScriptText(base, existing.code, remoteScript.code);
                if (mergeResult && !mergeResult.error) {
                  codeToSave = mergeResult.merged ?? script.code;
                  mergeConflict = mergeResult.conflicts ?? false;
                  didThreeWayMerge = true;
                  debugLog(`[CloudSync] 3-way merge for ${script.id}: conflicts=${String(mergeConflict)}`);
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                debugLog('[CloudSync] 3-way merge failed, using timestamp winner:', msg);
                // Fall back to last-write-wins (already set via merged.scripts)
              }
            }
          }
        }

        // Save when the remote side is newer, a merge produced new text (a
        // clean merge must not be discarded just because the local timestamp
        // wins), or a conflict needs surfacing.
        const mergeChangedCode = didThreeWayMerge && existing != null && codeToSave !== existing.code;
        const oneSidedChangedCode = selectedOneSidedCodeChange && existing != null && codeToSave !== existing.code;
        if (!existing || script.updatedAt > existing.updatedAt || mergeConflict || mergeChangedCode || oneSidedChangedCode) {
          if (signal?.aborted) throw new Error('Sync aborted');
          const parsed = parseUserscript(codeToSave);
          if (!parsed.error && parsed.meta) {
            // Spread `existing` first so local-only fields (versionHistory,
            // trustReceipt, stats, _httpEtag/_httpLastModified) survive a
            // remote-newer apply; the sync-managed fields below override them.
            const nextScript = {
              ...(existing || {}),
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
            return true;
          }
        }
        return false;
        });
        if (applied) localMutated = true;
      }

      // Persist merged tombstones locally whenever the set CHANGED (added or
      // removed), not only when it grew — a resurrection removes a tombstone
      // without growing the count, and that removal must stick locally.
      const mergedTombstoneIds = Object.keys(mergedTombstones);
      const localTombstoneIds = Object.keys(tombstones);
      const tombstonesChanged = mergedTombstoneIds.length !== localTombstoneIds.length ||
        mergedTombstoneIds.some((id) => !(id in tombstones)) ||
        localTombstoneIds.some((id) => !(id in mergedTombstones));
      if (tombstonesChanged) {
        await chrome.storage.local.set({ syncTombstones: mergedTombstones });
      }

      if (localMutated) {
        await updateBadgeIfAvailable();
      }

      // Rebuild the upload envelope from the current post-merge ScriptStorage
      // state so remote devices receive merged code and the new sync base.
      const postMergeScripts = await ScriptStorage.getAll();
      const remoteValueApplyResult = await applyRemoteValueBundlesWhenLocalEmpty(
        remoteValueBundleSelection,
        postMergeScripts,
        localData.valueBundles ?? {},
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
      const uploadValueBundles = mergeValueBundlesForUpload(
        postMergeValueBundleData.valueBundles,
        remoteValueApplyResult.preservedValueBundles,
      );
      const uploadData: SyncEnvelope = {
        version: 1,
        timestamp: Date.now(),
        scripts: uploadScripts,
        tombstones: mergedTombstones,
        ...(Object.keys(uploadValueBundles).length > 0
          ? { valueBundles: uploadValueBundles }
          : {}),
      };
      if (signal?.aborted) throw new Error('Sync aborted');
      await provider.upload(await prepareSyncEnvelopeForRemoteUpload(uploadData, settings), settings, { signal });
    } else {
      // First sync, just upload (include tombstones and syncBaseCode)
      if (signal?.aborted) throw new Error('Sync aborted');
      localData.scripts = localData.scripts.map((s): SyncScript => ({
        ...s,
        syncBaseCode: s.syncBaseCode ?? null,
      }));
      await provider.upload(await prepareSyncEnvelopeForRemoteUpload(localData, settings), settings, { signal });
    }

    // A successful upload with encryption on means the remote is now encrypted,
    // so establish the downgrade latch.
    await markSyncEncryptionEstablished(settings);

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
