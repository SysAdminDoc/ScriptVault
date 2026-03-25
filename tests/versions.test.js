import { describe, it, expect } from 'vitest';

// Re-implement compareVersions for testing (extracted from background.core.js UpdateSystem)

function compareVersions(v1, v2) {
  const preRelease1 = v1.includes('-');
  const preRelease2 = v2.includes('-');
  const clean1 = (typeof v1 === 'string' ? v1 : String(v1)).replace(/-.*$/, '');
  const clean2 = (typeof v2 === 'string' ? v2 : String(v2)).replace(/-.*$/, '');
  const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  if (preRelease1 && !preRelease2) return -1;
  if (!preRelease1 && preRelease2) return 1;
  return 0;
}

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

  it('both pre-release with same numeric are equal', () => {
    expect(compareVersions('1.2.0-alpha', '1.2.0-beta')).toBe(0);
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
