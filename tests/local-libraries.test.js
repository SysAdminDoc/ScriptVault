import { describe, expect, it } from 'vitest';
import {
  MAX_LOCAL_LIBRARIES,
  MAX_LOCAL_LIBRARY_BYTES,
  createLocalLibrarySnapshot,
  getLocalLibraryRequireScripts,
  getLocalLibraryReviewSignals,
  normalizeLocalLibrarySnapshots,
} from '../src/background/local-libraries.ts';

describe('reviewed local library snapshots', () => {
  it('creates a path-free portable snapshot with a content digest', async () => {
    const result = await createLocalLibrarySnapshot({
      name: 'C:\\private\\helpers\\format.js',
      code: 'window.formatValue = value => String(value);',
    });
    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        name: 'format.js',
        bytes: new TextEncoder().encode('window.formatValue = value => String(value);').length,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot).not.toHaveProperty('path');
    expect(result.snapshot).not.toHaveProperty('handle');
    expect(result.snapshot).not.toHaveProperty('bindingId');
  });

  it('normalizes only bounded reviewed fields and strips local-only metadata', async () => {
    const created = await createLocalLibrarySnapshot({ name: 'safe.js', code: 'window.safe = true;' });
    if (!created.ok) throw new Error(created.error);
    const normalized = normalizeLocalLibrarySnapshots([{
      ...created.snapshot,
      path: 'C:\\secret\\safe.js',
      handle: { name: 'safe.js' },
      bindingId: 'local-only',
    }]);
    expect(normalized).toEqual([created.snapshot]);
    expect(Object.keys(normalized[0])).toEqual(['id', 'name', 'code', 'sha256', 'bytes', 'reviewedAt']);
  });

  it('rejects empty and oversized libraries and caps the collection', async () => {
    await expect(createLocalLibrarySnapshot({ name: 'empty.js', code: '  ' })).resolves.toMatchObject({ ok: false });
    await expect(createLocalLibrarySnapshot({ name: 'huge.js', code: 'x'.repeat(MAX_LOCAL_LIBRARY_BYTES + 1) })).resolves.toMatchObject({ ok: false });
    const one = await createLocalLibrarySnapshot({ name: 'one.js', code: 'window.one = 1;' });
    if (!one.ok) throw new Error(one.error);
    const many = Array.from({ length: MAX_LOCAL_LIBRARIES + 3 }, (_, index) => ({
      ...one.snapshot,
      id: `local-library-example-${String(index).padStart(8, '0')}`,
    }));
    expect(normalizeLocalLibrarySnapshots(many)).toHaveLength(MAX_LOCAL_LIBRARIES);
  });

  it('converts snapshots into script-scoped require inputs after remote requires', async () => {
    const created = await createLocalLibrarySnapshot({ name: 'helpers.js', code: 'window.helpers = {};' });
    if (!created.ok) throw new Error(created.error);
    expect(getLocalLibraryRequireScripts({ localLibraries: [created.snapshot] })).toEqual([{
      url: `local-library://helpers.js#sha256=${created.snapshot.sha256}`,
      code: created.snapshot.code,
    }]);
  });

  it('surfaces high-signal review warnings without claiming a full security audit', () => {
    expect(getLocalLibraryReviewSignals('eval(code); fetch(url); document.cookie; node.innerHTML = html;')).toEqual([
      'dynamic code execution',
      'network access',
      'site or browser storage',
      'HTML injection',
    ]);
    expect(getLocalLibraryReviewSignals('const sum = (a, b) => a + b;')).toEqual([]);
  });
});
