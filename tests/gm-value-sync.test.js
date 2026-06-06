import { describe, expect, it } from 'vitest';
import {
  GM_VALUE_SYNC_MAX_KEYS,
  GM_VALUE_SYNC_SCHEMA,
  buildGmValueSyncBundle,
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
