import { describe, expect, it } from 'vitest';
import {
  GM_VALUE_SYNC_CONFLICT_RETENTION_MS,
  GM_VALUE_SYNC_MAX_CONFLICTS_PER_KEY,
  GM_VALUE_SYNC_MAX_KEYS,
  GM_VALUE_SYNC_SCHEMA,
  buildGmValueSyncBundle,
  compareGmValueClocks,
  mergeGmValueSyncValues,
  normalizeGmValueSyncPolicy,
  shouldSyncScriptValues,
} from '../src/background/gm-value-sync.ts';

function script(settings = {}) {
  return {
    id: 'script-values',
    settings,
  };
}

describe('GM value sync data model', () => {
  it('requires an explicit per-script opt-in before values can be bundled', () => {
    expect(shouldSyncScriptValues(script())).toBe(false);
    expect(shouldSyncScriptValues(script({ syncValues: true }))).toBe(true);

    const result = buildGmValueSyncBundle(script(), { token: 'local-only' });
    expect(result).toEqual({
      included: false,
      reason: 'not-opted-in',
      bundle: null,
      warnings: [],
    });
  });

  it('builds deterministic JSON-only bundles without script source or metadata', () => {
    const result = buildGmValueSyncBundle(
      script({ syncValues: true }),
      {
        zeta: 3,
        alpha: { enabled: true },
      },
    );

    expect(result.included).toBe(true);
    expect(result.reason).toBe('included');
    expect(result.bundle).toEqual({
      schema: GM_VALUE_SYNC_SCHEMA,
      scriptId: 'script-values',
      keyCount: 2,
      bytes: expect.any(Number),
      values: {
        alpha: { enabled: true },
        zeta: 3,
      },
    });
    expect(JSON.stringify(result.bundle)).not.toContain('code');
    expect(JSON.stringify(result.bundle)).not.toContain('meta');
  });

  it('skips oversized keys and non-JSON values', () => {
    const circular = {};
    circular.self = circular;
    const result = buildGmValueSyncBundle(
      script({ syncValues: true }),
      {
        ['x'.repeat(300)]: 'too large',
        ok: 'kept',
        circular,
        missing: undefined,
      },
    );

    expect(result.bundle.values).toEqual({ ok: 'kept' });
    expect(result.warnings.map(warning => warning.id).sort()).toEqual([
      'keyTooLarge',
      'valueNotJsonSerializable',
      'valueNotJsonSerializable',
    ]);
  });

  it('carries optional aggregate value timestamps without requiring them', () => {
    const withTimestamp = buildGmValueSyncBundle(
      script({ syncValues: true }),
      { token: 'sync-token' },
      { lastValueUpdatedAt: 1234.8 },
    );
    const withoutTimestamp = buildGmValueSyncBundle(
      script({ syncValues: true }),
      { token: 'sync-token' },
    );

    expect(withTimestamp.bundle).toEqual(expect.objectContaining({
      lastValueUpdatedAt: 1234,
      keyCount: 1,
    }));
    expect(withTimestamp.bundle.bytes).toBeGreaterThan(withoutTimestamp.bundle.bytes);
    expect(withoutTimestamp.bundle).not.toHaveProperty('lastValueUpdatedAt');
  });

  it('carries optional per-key value timestamps for included keys only', () => {
    const withKeyMetadata = buildGmValueSyncBundle(
      script({ syncValues: true }),
      {
        alpha: { enabled: true },
        zeta: 3,
        missing: undefined,
      },
      {
        keyMetadata: {
          alpha: { updatedAt: 1000.8 },
          zeta: 2000.2,
          missing: { updatedAt: 3000 },
          ignored: { updatedAt: 4000 },
        },
      },
    );
    const withoutKeyMetadata = buildGmValueSyncBundle(
      script({ syncValues: true }),
      {
        alpha: { enabled: true },
        zeta: 3,
      },
    );

    expect(withKeyMetadata.bundle.keyMetadata).toEqual({
      alpha: { updatedAt: 1000 },
      zeta: { updatedAt: 2000 },
    });
    expect(withKeyMetadata.bundle).not.toHaveProperty('keyMetadata.missing');
    expect(withKeyMetadata.bundle.bytes).toBeGreaterThan(withoutKeyMetadata.bundle.bytes);
    expect(withoutKeyMetadata.bundle).not.toHaveProperty('keyMetadata');
  });

  it('carries per-key HLC metadata for values written by a device', () => {
    const result = buildGmValueSyncBundle(
      script({ syncValues: true }),
      { token: 'sync-token' },
      {
        deviceId: 'device-a',
        keyMetadata: {
          token: {
            updatedAt: 1000,
            clock: { ts: 1000, counter: 2, deviceId: 'device-a' },
          },
        },
      },
    );

    expect(result.bundle?.keyMetadata).toEqual({
      token: {
        updatedAt: 1000,
        clock: { ts: 1000, counter: 2, deviceId: 'device-a' },
      },
    });
  });

  it('uses the later logical write when physical clocks are skewed', () => {
    const remoteClock = { ts: 5000, counter: 0, deviceId: 'device-remote' };
    const localClock = { ts: 5000, counter: 1, deviceId: 'device-local' };

    expect(compareGmValueClocks(localClock, remoteClock)).toBeGreaterThan(0);
    const merged = mergeGmValueSyncValues(
      { token: 'local-write' },
      { token: { updatedAt: 1000, clock: localClock } },
      { token: 'remote-write' },
      { token: { updatedAt: 5000, clock: remoteClock } },
      { now: 6000 },
    );

    expect(merged.values).toEqual({ token: 'local-write' });
    expect(merged.keyMetadata.token.clock).toEqual(localClock);
    expect(merged.conflicts.token).toEqual([
      { value: 'remote-write', clock: remoteClock, retainedAt: 6000 },
    ]);
    expect(merged.conflictCount).toBe(1);
    expect(merged.losersRetained).toBe(1);
  });

  it('persists a newer remote clock even when the value is unchanged', () => {
    const merged = mergeGmValueSyncValues(
      { token: 'same' },
      { token: { clock: { ts: 10, counter: 1, deviceId: 'local' } } },
      { token: 'same' },
      { token: { clock: { ts: 11, counter: 0, deviceId: 'remote' } } },
      { now: 100 },
    );

    expect(merged.changedKeys).toEqual([]);
    expect(merged.metadataChangedKeys).toEqual(['token']);
    expect(merged.keyMetadata.token.clock).toEqual({ ts: 11, counter: 0, deviceId: 'remote' });
  });

  it('applies explicit local or remote policy without changing HLC metadata', () => {
    const localMetadata = { token: { clock: { ts: 1, counter: 1, deviceId: 'a' } } };
    const remoteMetadata = { token: { clock: { ts: 2, counter: 0, deviceId: 'b' } } };

    expect(normalizeGmValueSyncPolicy('prefer-local')).toBe('prefer-local');
    expect(mergeGmValueSyncValues(
      { token: 'local' }, localMetadata,
      { token: 'remote' }, remoteMetadata,
      { policy: 'prefer-local', now: 100 },
    ).values).toEqual({ token: 'local' });
    expect(mergeGmValueSyncValues(
      { token: 'local' }, localMetadata,
      { token: 'remote' }, remoteMetadata,
      { policy: 'prefer-remote', now: 100 },
    ).values).toEqual({ token: 'remote' });
  });

  it('bounds retained losers per key and drops expired entries', () => {
    const now = 100_000;
    const localClock = { ts: 20, counter: 5, deviceId: 'local' };
    const remoteClock = { ts: 20, counter: 4, deviceId: 'remote' };
    const retained = Array.from({ length: GM_VALUE_SYNC_MAX_CONFLICTS_PER_KEY + 2 }, (_, index) => ({
      value: `old-${index}`,
      clock: { ts: index + 1, counter: 0, deviceId: `old-${index}` },
      retainedAt: now,
    }));
    retained.push({
      value: 'expired',
      clock: { ts: 1, counter: 0, deviceId: 'expired' },
      retainedAt: now - GM_VALUE_SYNC_CONFLICT_RETENTION_MS - 1,
    });

    const merged = mergeGmValueSyncValues(
      { token: 'local' },
      { token: { clock: localClock } },
      { token: 'remote' },
      { token: { clock: remoteClock } },
      { localConflicts: { token: retained }, now },
    );

    expect(merged.conflicts.token.length).toBe(GM_VALUE_SYNC_MAX_CONFLICTS_PER_KEY);
    expect(merged.conflicts.token.some((entry) => entry.value === 'expired')).toBe(false);
    expect(merged.losersRetained).toBe(GM_VALUE_SYNC_MAX_CONFLICTS_PER_KEY);
  });

  it('enforces key-count and per-script byte caps', () => {
    const manyValues = Object.fromEntries(
      Array.from({ length: GM_VALUE_SYNC_MAX_KEYS + 5 }, (_, index) => [`k${index}`, index]),
    );
    const keyCap = buildGmValueSyncBundle(script({ syncValues: true }), manyValues);
    expect(keyCap.bundle.keyCount).toBe(GM_VALUE_SYNC_MAX_KEYS);
    expect(keyCap.warnings.some(warning => warning.id === 'maxKeysExceeded')).toBe(true);

    const byteCap = buildGmValueSyncBundle(
      script({ syncValues: true }),
      { small: 'ok', large: 'x'.repeat(1024) },
      { maxScriptBytes: 180 },
    );
    expect(byteCap.bundle.values).toEqual({ small: 'ok' });
    expect(byteCap.warnings.some(warning => warning.id === 'scriptValueCapExceeded')).toBe(true);
  });
});
