import type { Script } from '../types/script';

export const GM_VALUE_SYNC_SCHEMA = 'scriptvault-gm-value-sync/v1';
export const GM_VALUE_SYNC_MAX_SCRIPT_BYTES = 64 * 1024;
export const GM_VALUE_SYNC_MAX_KEYS = 128;
export const GM_VALUE_SYNC_MAX_KEY_BYTES = 256;

export interface GmValueSyncBundle {
  schema: typeof GM_VALUE_SYNC_SCHEMA;
  scriptId: string;
  keyCount: number;
  bytes: number;
  values: Record<string, unknown>;
  lastValueUpdatedAt?: number;
  keyMetadata?: Record<string, { updatedAt: number }>;
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

function normalizeTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return Math.floor(timestamp);
}

function setMetadataKey(record: Record<string, { updatedAt: number }>, key: string, value: { updatedAt: number }): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function normalizeKeyMetadataEntry(value: unknown): { updatedAt: number } | undefined {
  const timestamp = value && typeof value === 'object'
    ? normalizeTimestamp((value as { updatedAt?: unknown }).updatedAt)
    : normalizeTimestamp(value);
  return timestamp ? { updatedAt: timestamp } : undefined;
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

    const nextValues = { ...bundle.values, [key]: cloned };
    const nextKeyMetadata: Record<string, { updatedAt: number }> = { ...(bundle.keyMetadata ?? {}) };
    const keyMetadataEntry = normalizeKeyMetadataEntry(sourceKeyMetadata[key]);
    if (keyMetadataEntry) setMetadataKey(nextKeyMetadata, key, keyMetadataEntry);
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

  if (bundle.keyCount === 0) {
    return { included: true, reason: 'empty', bundle, warnings };
  }
  return { included: true, reason: 'included', bundle, warnings };
}
