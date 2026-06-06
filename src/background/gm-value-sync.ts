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
    const nextBundle = { ...bundle, values: nextValues, keyCount: Object.keys(nextValues).length };
    const nextBytes = byteLength(nextBundle);
    if (nextBytes > maxScriptBytes) {
      warnings.push({ id: 'scriptValueCapExceeded', message: 'Stored values exceed the per-script sync size cap' });
      continue;
    }

    bundle.values = nextValues;
    bundle.keyCount = nextBundle.keyCount;
    bundle.bytes = nextBytes;
  }

  if (bundle.keyCount === 0) {
    return { included: true, reason: 'empty', bundle, warnings };
  }
  return { included: true, reason: 'included', bundle, warnings };
}
