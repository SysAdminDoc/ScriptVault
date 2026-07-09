import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { latestFirefoxPackage } from '../scripts/smoke-firefox-sideload.mjs';

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'scriptvault-firefox-smoke-'));
  mkdirSync(join(root, 'firefox-artifacts'), { recursive: true });
  return root;
}

describe('Firefox sideload smoke package resolver', () => {
  it('uses the exact package version when --skip-package reuses artifacts', async () => {
    const root = await makeFixture();
    try {
      writeFileSync(join(root, 'firefox-artifacts', 'scriptvault-firefox-v3.17.0.zip'), '');

      await expect(latestFirefoxPackage('3.17.0', { root })).resolves.toBe(
        join(root, 'firefox-artifacts', 'scriptvault-firefox-v3.17.0.zip'),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects stale Firefox packages instead of falling back to newest artifact', async () => {
    const root = await makeFixture();
    try {
      writeFileSync(join(root, 'firefox-artifacts', 'scriptvault-firefox-v3.16.0.zip'), '');

      await expect(latestFirefoxPackage('3.17.0', { root })).rejects.toThrow(
        /Firefox package for 3\.17\.0 missing/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the resolved package basename versioned for smoke output', async () => {
    const root = await makeFixture();
    try {
      writeFileSync(join(root, 'firefox-artifacts', 'scriptvault-firefox-v3.17.0.zip'), '');

      const packagePath = await latestFirefoxPackage('3.17.0', { root });

      expect(basename(packagePath)).toBe('scriptvault-firefox-v3.17.0.zip');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
