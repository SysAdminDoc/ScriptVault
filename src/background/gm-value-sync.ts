import type { Script } from '../types/script';

export const GM_VALUE_SYNC_SCHEMA = 'scriptvault-gm-value-sync/v1';
export const GM_VALUE_SYNC_MAX_SCRIPT_BYTES = 64 * 1024;
export const GM_VALUE_SYNC_MAX_KEYS = 128;
export const GM_VALUE_SYNC_MAX_KEY_BYTES = 256;
export const GM_VALUE_SYNC_MAX_CONFLICTS_PER_KEY = 4;
export const GM_VALUE_SYNC_MAX_CONFLICT_KEYS = 128;
export const GM_VALUE_SYNC_CONFLICT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type GmValueSyncPolicy = 'hlc' | 'prefer-local' | 'prefer-remote';

export interface GmValueClock {
  ts: number;
  counter: number;
  deviceId: string;
}

export interface GmValueKeyMetadata {
  updatedAt?: number;
  clock?: GmValueClock;
}

export interface GmValueSyncConflict {
  value: unknown;
  clock: GmValueClock;
  retainedAt: number;
}

export interface GmValueSyncBundle {
  schema: typeof GM_VALUE_SYNC_SCHEMA;
  scriptId: string;
  keyCount: number;
  bytes: number;
  values: Record<string, unknown>;
  lastValueUpdatedAt?: number;
  keyMetadata?: Record<string, GmValueKeyMetadata>;
  conflicts?: Record<string, GmValueSyncConflict[]>;
}

export interface GmValueSyncBuildResult {
  included: boolean;
  reason: 'included' | 'not-opted-in' | 'missing-script' | 'empty';
  bundle: GmValueSyncBundle | null;
  warnings: Array<{ id: string; message: string }>;
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function cloneJsonValue(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (json === undefined) return undefined;
  return JSON.parse(json) as unknown;
}

function setRecordKey<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function normalizeTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return Math.floor(timestamp);
}

function normalizeDeviceId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const deviceId = value.trim();
  return deviceId && deviceId.length <= 128 ? deviceId : undefined;
}

export function normalizeGmValueClock(value: unknown): GmValueClock | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const ts = Number((value as { ts?: unknown }).ts);
  const counter = Number((value as { counter?: unknown }).counter);
  const deviceId = normalizeDeviceId((value as { deviceId?: unknown }).deviceId);
  if (!Number.isFinite(ts) || ts < 0 || !Number.isFinite(counter) || counter < 0 || !deviceId) {
    return undefined;
  }
  return { ts: Math.floor(ts), counter: Math.floor(counter), deviceId };
}

export function compareGmValueClocks(left: GmValueClock | undefined, right: GmValueClock | undefined): number {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left.ts !== right.ts) return left.ts > right.ts ? 1 : -1;
  if (left.counter !== right.counter) return left.counter > right.counter ? 1 : -1;
  return left.deviceId === right.deviceId ? 0 : left.deviceId > right.deviceId ? 1 : -1;
}

export function normalizeGmValueSyncPolicy(value: unknown): GmValueSyncPolicy {
  return value === 'prefer-local' || value === 'prefer-remote' ? value : 'hlc';
}

function normalizeKeyMetadataEntry(
  value: unknown,
  options: { deviceId?: string; fallbackTimestamp?: number } = {},
): GmValueKeyMetadata | undefined {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as { updatedAt?: unknown; clock?: unknown }
    : null;
  const timestamp = normalizeTimestamp(record?.updatedAt ?? value) ?? normalizeTimestamp(options.fallbackTimestamp);
  const clock = normalizeGmValueClock(record?.clock)
    || (timestamp && normalizeDeviceId(options.deviceId)
      ? { ts: timestamp, counter: 0, deviceId: normalizeDeviceId(options.deviceId)! }
      : undefined);
  if (!timestamp && !clock) return undefined;
  return {
    ...(timestamp ? { updatedAt: timestamp } : {}),
    ...(clock ? { clock } : {}),
  };
}

export function getGmValueClockFromMetadata(
  value: unknown,
  options: { deviceId?: string; fallbackTimestamp?: number } = {},
): GmValueClock | undefined {
  return normalizeKeyMetadataEntry(value, options)?.clock;
}

function cloneClock(clock: GmValueClock): GmValueClock {
  return { ts: clock.ts, counter: clock.counter, deviceId: clock.deviceId };
}

function valueEquals(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (_) {
    return false;
  }
}

function normalizeConflictEntry(value: unknown, now: number): GmValueSyncConflict | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const clock = normalizeGmValueClock((value as { clock?: unknown }).clock);
  const retainedAt = normalizeTimestamp((value as { retainedAt?: unknown }).retainedAt) ?? now;
  if (!clock) return undefined;
  let cloned: unknown;
  try {
    cloned = cloneJsonValue((value as { value?: unknown }).value);
  } catch (_) {
    return undefined;
  }
  if (cloned === undefined) return undefined;
  return { value: cloned, clock, retainedAt };
}

export function normalizeGmValueSyncConflicts(
  value: unknown,
  options: { now?: number; maxKeys?: number; maxPerKey?: number } = {},
): Record<string, GmValueSyncConflict[]> {
  const now = normalizeTimestamp(options.now) ?? Date.now();
  const maxKeys = Math.max(1, Math.floor(options.maxKeys ?? GM_VALUE_SYNC_MAX_CONFLICT_KEYS));
  const maxPerKey = Math.max(1, Math.floor(options.maxPerKey ?? GM_VALUE_SYNC_MAX_CONFLICTS_PER_KEY));
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, GmValueSyncConflict[]> = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    if (Object.keys(result).length >= maxKeys) break;
    const rawEntries = (value as Record<string, unknown>)[key];
    if (!Array.isArray(rawEntries)) continue;
    const entries: GmValueSyncConflict[] = [];
    for (const rawEntry of rawEntries) {
      const entry = normalizeConflictEntry(rawEntry, now);
      if (!entry || entry.retainedAt < now - GM_VALUE_SYNC_CONFLICT_RETENTION_MS) continue;
      const duplicate = entries.some((candidate) =>
        compareGmValueClocks(candidate.clock, entry.clock) === 0 && valueEquals(candidate.value, entry.value));
      if (duplicate) continue;
      entries.push(entry);
    }
    entries.sort((a, b) => {
      const clockOrder = compareGmValueClocks(b.clock, a.clock);
      return clockOrder || b.retainedAt - a.retainedAt;
    });
    if (entries.length > 0) setRecordKey(result, key, entries.slice(0, maxPerKey));
  }
  return result;
}

interface GmValueCandidate {
  value: unknown;
  metadata?: GmValueKeyMetadata;
  clock?: GmValueClock;
  source: 'local' | 'remote';
}

export interface GmValueSyncMergeResult {
  values: Record<string, unknown>;
  keyMetadata: Record<string, GmValueKeyMetadata>;
  conflicts: Record<string, GmValueSyncConflict[]>;
  changedKeys: string[];
  metadataChangedKeys: string[];
  conflictCount: number;
  losersRetained: number;
}

function candidateForKey(
  source: 'local' | 'remote',
  values: Record<string, unknown>,
  metadata: Record<string, unknown> | undefined,
  key: string,
): GmValueCandidate | undefined {
  if (!Object.prototype.hasOwnProperty.call(values, key)) return undefined;
  const rawMetadata = metadata && Object.prototype.hasOwnProperty.call(metadata, key) ? metadata[key] : undefined;
  const normalizedMetadata = normalizeKeyMetadataEntry(rawMetadata);
  const clock = normalizedMetadata?.clock
    || (normalizedMetadata?.updatedAt
      ? { ts: normalizedMetadata.updatedAt, counter: 0, deviceId: source }
      : undefined);
  const candidateMetadata = normalizedMetadata || clock
    ? {
        ...(normalizedMetadata || {}),
        ...(clock && !normalizedMetadata?.clock ? { clock } : {}),
      }
    : undefined;
  return {
    value: cloneJsonValue(values[key]),
    ...(candidateMetadata ? { metadata: candidateMetadata } : {}),
    ...(clock ? { clock } : {}),
    source,
  };
}

function chooseCandidate(
  local: GmValueCandidate,
  remote: GmValueCandidate,
  policy: GmValueSyncPolicy,
): GmValueCandidate {
  if (policy === 'prefer-local') return local;
  if (policy === 'prefer-remote') return remote;
  return compareGmValueClocks(local.clock, remote.clock) >= 0 ? local : remote;
}

function addConflictEntry(
  conflicts: Record<string, GmValueSyncConflict[]>,
  key: string,
  candidate: GmValueCandidate,
  now: number,
): void {
  if (!candidate.clock) return;
  const existing = conflicts[key] || [];
  const entry: GmValueSyncConflict = {
    value: cloneJsonValue(candidate.value),
    clock: cloneClock(candidate.clock),
    retainedAt: now,
  };
  if (!existing.some((item) => compareGmValueClocks(item.clock, entry.clock) === 0 && valueEquals(item.value, entry.value))) {
    setRecordKey(conflicts, key, [...existing, entry]);
  }
}

export function mergeGmValueSyncValues(
  localValues: Record<string, unknown> | null | undefined,
  localMetadata: Record<string, unknown> | null | undefined,
  remoteValues: Record<string, unknown> | null | undefined,
  remoteMetadata: Record<string, unknown> | null | undefined,
  options: {
    policy?: unknown;
    localConflicts?: unknown;
    remoteConflicts?: unknown;
    now?: number;
  } = {},
): GmValueSyncMergeResult {
  const local = localValues && typeof localValues === 'object' && !Array.isArray(localValues) ? localValues : {};
  const remote = remoteValues && typeof remoteValues === 'object' && !Array.isArray(remoteValues) ? remoteValues : {};
  const localMeta = localMetadata && typeof localMetadata === 'object' && !Array.isArray(localMetadata) ? localMetadata : {};
  const remoteMeta = remoteMetadata && typeof remoteMetadata === 'object' && !Array.isArray(remoteMetadata) ? remoteMetadata : {};
  const policy = normalizeGmValueSyncPolicy(options.policy);
  const now = normalizeTimestamp(options.now) ?? Date.now();
  const conflicts = normalizeGmValueSyncConflicts(options.localConflicts, { now });
  const remoteConflicts = normalizeGmValueSyncConflicts(options.remoteConflicts, { now });
  for (const [key, entries] of Object.entries(remoteConflicts)) {
    const current = conflicts[key] || [];
    setRecordKey(conflicts, key, [...current, ...entries]);
  }

  const values: Record<string, unknown> = {};
  const keyMetadata: Record<string, GmValueKeyMetadata> = {};
  const changedKeys: string[] = [];
  const metadataChangedKeys: string[] = [];
  let conflictCount = 0;
  const keys = [...new Set([...Object.keys(local), ...Object.keys(remote)])].sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const localCandidate = candidateForKey('local', local, localMeta, key);
    const remoteCandidate = candidateForKey('remote', remote, remoteMeta, key);
    const winner = !localCandidate
      ? remoteCandidate
      : !remoteCandidate
        ? localCandidate
        : chooseCandidate(localCandidate, remoteCandidate, policy);
    if (!winner) continue;
    setRecordKey(values, key, winner.value);
    if (winner.metadata) setRecordKey(keyMetadata, key, winner.metadata);
    if (localCandidate && remoteCandidate && !valueEquals(localCandidate.value, remoteCandidate.value)) {
      conflictCount += 1;
      const loser = winner.source === 'local' ? remoteCandidate : localCandidate;
      addConflictEntry(conflicts, key, loser, now);
      if (winner.source === 'remote') changedKeys.push(key);
    } else if (winner.source === 'remote' && (!localCandidate || !valueEquals(localCandidate.value, winner.value))) {
      changedKeys.push(key);
    }
    if (
      winner.source === 'remote'
      && compareGmValueClocks(winner.clock, localCandidate?.clock) > 0
      && !metadataChangedKeys.includes(key)
    ) {
      metadataChangedKeys.push(key);
    }
  }

  const normalizedConflicts = normalizeGmValueSyncConflicts(conflicts, { now });
  const losersRetained = Object.values(normalizedConflicts).reduce((sum, entries) => sum + entries.length, 0);
  return {
    values,
    keyMetadata,
    conflicts: normalizedConflicts,
    changedKeys,
    metadataChangedKeys,
    conflictCount,
    losersRetained,
  };
}

export function shouldSyncScriptValues(script: Pick<Script, 'id' | 'settings'> | null | undefined): boolean {
  return script?.settings?.syncValues === true;
}

export function buildGmValueSyncBundle(
  script: Pick<Script, 'id' | 'settings'> | null | undefined,
  values: Record<string, unknown> | null | undefined,
  options: {
    maxScriptBytes?: number;
    maxKeys?: number;
    maxKeyBytes?: number;
    lastValueUpdatedAt?: number | null;
    keyMetadata?: Record<string, unknown> | null;
    conflicts?: Record<string, unknown> | null;
    deviceId?: string | null;
  } = {},
): GmValueSyncBuildResult {
  const warnings: GmValueSyncBuildResult['warnings'] = [];
  if (!script?.id) {
    return { included: false, reason: 'missing-script', bundle: null, warnings };
  }
  if (!shouldSyncScriptValues(script)) {
    return { included: false, reason: 'not-opted-in', bundle: null, warnings };
  }

  const maxScriptBytes = options.maxScriptBytes ?? GM_VALUE_SYNC_MAX_SCRIPT_BYTES;
  const maxKeys = options.maxKeys ?? GM_VALUE_SYNC_MAX_KEYS;
  const maxKeyBytes = options.maxKeyBytes ?? GM_VALUE_SYNC_MAX_KEY_BYTES;
  const lastValueUpdatedAt = normalizeTimestamp(options.lastValueUpdatedAt);
  const sourceKeyMetadata = options.keyMetadata && typeof options.keyMetadata === 'object' && !Array.isArray(options.keyMetadata)
    ? options.keyMetadata
    : {};
  const sourceValues = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const bundle: GmValueSyncBundle = {
    schema: GM_VALUE_SYNC_SCHEMA,
    scriptId: script.id,
    keyCount: 0,
    bytes: 0,
    values: {},
    ...(lastValueUpdatedAt ? { lastValueUpdatedAt } : {}),
  };

  for (const [rawKey, rawValue] of Object.entries(sourceValues).sort(([a], [b]) => a.localeCompare(b))) {
    const key = String(rawKey);
    if (bundle.keyCount >= maxKeys) {
      warnings.push({ id: 'maxKeysExceeded', message: `Only the first ${maxKeys} stored value keys can sync` });
      break;
    }
    if (byteLength(key) > maxKeyBytes) {
      warnings.push({ id: 'keyTooLarge', message: 'Stored value key exceeds the sync key size cap' });
      continue;
    }

    let cloned: unknown;
    try {
      cloned = cloneJsonValue(rawValue);
    } catch (_) {
      warnings.push({ id: 'valueNotJsonSerializable', message: 'Stored value is not JSON-serializable' });
      continue;
    }
    if (cloned === undefined) {
      warnings.push({ id: 'valueNotJsonSerializable', message: 'Stored value is not JSON-serializable' });
      continue;
    }

    const nextValues: Record<string, unknown> = { ...bundle.values };
    setRecordKey(nextValues, key, cloned);
    const nextKeyMetadata: Record<string, GmValueKeyMetadata> = { ...(bundle.keyMetadata ?? {}) };
    const keyMetadataEntry = normalizeKeyMetadataEntry(sourceKeyMetadata[key], {
      deviceId: options.deviceId ?? undefined,
      fallbackTimestamp: lastValueUpdatedAt,
    });
    if (keyMetadataEntry) setRecordKey(nextKeyMetadata, key, keyMetadataEntry);
    const nextBundle: GmValueSyncBundle = {
      ...bundle,
      values: nextValues,
      keyCount: Object.keys(nextValues).length,
      ...(Object.keys(nextKeyMetadata).length > 0 ? { keyMetadata: nextKeyMetadata } : {}),
    };
    const nextBytes = byteLength(nextBundle);
    if (nextBytes > maxScriptBytes) {
      warnings.push({ id: 'scriptValueCapExceeded', message: 'Stored values exceed the per-script sync size cap' });
      continue;
    }

    bundle.values = nextValues;
    bundle.keyCount = nextBundle.keyCount;
    if (nextBundle.keyMetadata) bundle.keyMetadata = nextBundle.keyMetadata;
    bundle.bytes = nextBytes;
  }

  const normalizedConflicts = normalizeGmValueSyncConflicts(options.conflicts, { now: Date.now() });
  for (const [key, entries] of Object.entries(normalizedConflicts)) {
    if (!Object.prototype.hasOwnProperty.call(bundle.values, key)) continue;
    const nextConflicts = { ...(bundle.conflicts ?? {}) };
    setRecordKey(nextConflicts, key, entries);
    const nextBundle: GmValueSyncBundle = { ...bundle, conflicts: nextConflicts };
    const nextBytes = byteLength(nextBundle);
    if (nextBytes > maxScriptBytes) {
      warnings.push({ id: 'conflictCapExceeded', message: 'Retained GM value conflicts exceed the per-script sync size cap' });
      continue;
    }
    bundle.conflicts = nextConflicts;
    bundle.bytes = nextBytes;
  }

  if (bundle.keyCount === 0) {
    return { included: true, reason: 'empty', bundle, warnings };
  }
  return { included: true, reason: 'included', bundle, warnings };
}
