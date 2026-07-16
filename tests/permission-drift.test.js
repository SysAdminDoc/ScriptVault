import { describe, it, expect } from 'vitest';
import { PINNED, findDrift, checkAllManifests } from '../scripts/check-permission-drift.mjs';

describe('manifest permission-drift gate', () => {
  it('passes for the current shipped manifests', () => {
    const { ok, violations } = checkAllManifests();
    expect(violations).toEqual([]);
    expect(ok).toBe(true);
  });

  it('flags a permission added beyond the pinned allowlist', () => {
    const manifest = {
      permissions: [...PINNED['manifest.json'].permissions, 'management'],
      optional_permissions: PINNED['manifest.json'].optional_permissions,
      host_permissions: PINNED['manifest.json'].host_permissions,
    };
    const violations = findDrift('manifest.json', manifest);
    expect(violations.some(v => v.includes('"management"'))).toBe(true);
  });

  it('flags a widened host permission', () => {
    const manifest = {
      permissions: PINNED['manifest.json'].permissions,
      host_permissions: ['<all_urls>', 'file:///*'],
    };
    const violations = findDrift('manifest.json', manifest);
    expect(violations.some(v => v.includes('file:///*'))).toBe(true);
  });

  it('pins <all_urls> as the only host permission (never widened beyond it)', () => {
    expect(PINNED['manifest.json'].host_permissions).toEqual(['<all_urls>']);
    expect(PINNED['manifest-firefox.json'].host_permissions).toEqual(['<all_urls>']);
  });
});
