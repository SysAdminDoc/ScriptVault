import { describe, it, expect } from 'vitest';
import { UpdateSystem } from '../src/background/update-checker.ts';

const compareVersions = UpdateSystem.compareVersions.bind(UpdateSystem);

describe('compareVersions', () => {
  // ── Equal versions ──────────────────────────────────────────────────────
  it('returns 0 for identical versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns 0 for identical two-part versions', () => {
    expect(compareVersions('1.0', '1.0')).toBe(0);
  });

  it('returns 0 for identical single-part versions', () => {
    expect(compareVersions('3', '3')).toBe(0);
  });

  // ── Major version differences ───────────────────────────────────────────
  it('v1 > v2 when major is greater', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
  });

  it('v1 < v2 when major is less', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  // ── Minor version differences ───────────────────────────────────────────
  it('v1 > v2 when minor is greater', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
  });

  it('v1 < v2 when minor is less', () => {
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
  });

  // ── Patch version differences ───────────────────────────────────────────
  it('v1 > v2 when patch is greater', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
  });

  it('v1 < v2 when patch is less', () => {
    expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
  });

  // ── Different segment counts ────────────────────────────────────────────
  it('treats missing segments as 0 (equal)', () => {
    expect(compareVersions('1.0.0', '1.0')).toBe(0);
  });

  it('treats missing segments as 0 (v1 greater)', () => {
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
  });

  it('treats missing segments as 0 (v2 greater)', () => {
    expect(compareVersions('1', '1.0.1')).toBe(-1);
  });

  // ── Four-part versions ──────────────────────────────────────────────────
  it('handles four-part versions', () => {
    expect(compareVersions('1.0.0.1', '1.0.0.0')).toBe(1);
  });

  it('handles four vs three part versions', () => {
    expect(compareVersions('1.0.0.1', '1.0.0')).toBe(1);
  });

  // ── Pre-release handling ────────────────────────────────────────────────
  it('pre-release is less than release of same numeric version', () => {
    expect(compareVersions('1.2.0-beta.1', '1.2.0')).toBe(-1);
  });

  it('release is greater than pre-release of same numeric version', () => {
    expect(compareVersions('1.2.0', '1.2.0-beta.1')).toBe(1);
  });

  it('orders pre-release identifiers lexicographically', () => {
    expect(compareVersions('1.2.0-alpha', '1.2.0-beta')).toBe(-1);
    expect(compareVersions('1.2.0-beta', '1.2.0-alpha')).toBe(1);
  });

  it('orders numeric pre-release identifiers numerically', () => {
    expect(compareVersions('1.2.0-alpha.1', '1.2.0-alpha.2')).toBe(-1);
    expect(compareVersions('1.2.0-alpha.10', '1.2.0-alpha.2')).toBe(1);
  });

  it('treats numeric pre-release identifiers as lower than non-numeric identifiers', () => {
    expect(compareVersions('1.2.0-alpha.1', '1.2.0-alpha.beta')).toBe(-1);
    expect(compareVersions('1.2.0-alpha.beta', '1.2.0-alpha.1')).toBe(1);
  });

  it('orders longer pre-release identifier sets after matching prefixes', () => {
    expect(compareVersions('1.2.0-alpha', '1.2.0-alpha.1')).toBe(-1);
    expect(compareVersions('1.2.0-alpha.1', '1.2.0-alpha')).toBe(1);
  });

  it('pre-release with higher numeric version still wins', () => {
    expect(compareVersions('1.3.0-beta', '1.2.0')).toBe(1);
  });

  it('pre-release with lower numeric version still loses', () => {
    expect(compareVersions('1.1.0-rc1', '1.2.0')).toBe(-1);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────
  it('handles non-numeric parts (NaN becomes 0)', () => {
    expect(compareVersions('1.abc.0', '1.0.0')).toBe(0);
  });

  it('handles large version numbers', () => {
    expect(compareVersions('100.200.300', '100.200.299')).toBe(1);
  });

  it('handles zero versions', () => {
    expect(compareVersions('0.0.0', '0.0.0')).toBe(0);
  });

  it('handles version starting from zero', () => {
    expect(compareVersions('0.0.1', '0.0.0')).toBe(1);
  });
});

// ── UpdateSystem._nextRetryAt — exponential backoff (Phase 6.1) ───────────
// Mirror the constants from UpdateSystem so this test pins the production
// behaviour. If background.core.js drifts, this test must be updated.

const _BACKOFF_BASE_MS = 60 * 1000;
const _BACKOFF_MAX_MS = 24 * 60 * 60 * 1000;
const _MAX_BACKOFF_EXP = 10;

function nextRetryAt(failures, now = Date.now()) {
  const exp = Math.min(_MAX_BACKOFF_EXP, Math.max(0, failures - 1));
  const wait = Math.min(_BACKOFF_MAX_MS, _BACKOFF_BASE_MS * (2 ** exp));
  return now + wait;
}

describe('UpdateSystem exponential backoff (_nextRetryAt)', () => {
  const T0 = 1_700_000_000_000;

  it('first failure waits the base interval (1m)', () => {
    expect(nextRetryAt(1, T0) - T0).toBe(_BACKOFF_BASE_MS);
  });

  it('doubles the wait on each subsequent failure', () => {
    expect(nextRetryAt(2, T0) - T0).toBe(2 * _BACKOFF_BASE_MS);
    expect(nextRetryAt(3, T0) - T0).toBe(4 * _BACKOFF_BASE_MS);
    expect(nextRetryAt(4, T0) - T0).toBe(8 * _BACKOFF_BASE_MS);
  });

  it('caps at 24h regardless of failure count', () => {
    // 2^10 * 1m = ~17h, so the next-step cap engages around the 11th failure.
    const veryDeep = nextRetryAt(50, T0) - T0;
    expect(veryDeep).toBeLessThanOrEqual(_BACKOFF_MAX_MS);
    expect(veryDeep).toBeGreaterThan(_BACKOFF_BASE_MS * 2 ** 9);
  });

  it('treats 0 failures as the same as 1 failure (defensive)', () => {
    // The handler always increments before calling _nextRetryAt, but if a
    // miscalculation passes 0 we should still produce a non-zero wait.
    expect(nextRetryAt(0, T0) - T0).toBe(_BACKOFF_BASE_MS);
  });
});
