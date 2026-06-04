import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  analyzeSourceDrift,
  formatTextReport,
  loadPromotionMap,
  normalizePromotionMap,
} from '../scripts/check-ts-source-drift.mjs';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts/check-ts-source-drift.mjs');

function promotedFixture(extra = {}) {
  return normalizePromotionMap({
    schemaVersion: 1,
    entries: [
      {
        runtime: 'modules/error-log.js',
        sources: ['src/modules/error-log.ts'],
        generatedArtifacts: ['modules/error-log.generated.js'],
        status: 'promoted',
        ...extra,
      },
      {
        runtime: 'modules/sync-providers.js',
        sources: ['src/modules/sync-providers.ts'],
        status: 'intentionally-divergent',
      },
    ],
  }, { rootDir: ROOT });
}

describe('TS source drift gate', () => {
  it('loads the repository promotion map without schema or path errors', async () => {
    const map = await loadPromotionMap(resolve(ROOT, 'ts-source-promotion.json'), { rootDir: ROOT });

    expect(map.errors).toEqual([]);
    expect(map.entries.some((entry) => entry.runtime === 'shared/utils.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/error-log.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/notifications.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/npm-resolve.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/quota-manager.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/userstyles.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/i18n.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/xhr.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/internal-host-guard.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/resources.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/storage.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/migration.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/subscriptions.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/public-api.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'modules/backup-scheduler.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'bg/netlog.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'bg/analyzer.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'bg/esm-bundler.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'bg/signing.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'bg/workspaces.js' && entry.status === 'promoted')).toBe(true);
    expect(map.entries.some((entry) => entry.runtime === 'background.core.js' && entry.status === 'intentionally-divergent')).toBe(true);
  });

  it('reports the status inventory in report mode', async () => {
    const map = await loadPromotionMap(resolve(ROOT, 'ts-source-promotion.json'), { rootDir: ROOT });
    const report = analyzeSourceDrift(map, []);
    const text = formatTextReport(report, { reportMode: true });

    expect(report.totals.promoted).toBe(20);
    expect(report.totals.candidate).toBe(0);
    expect(report.totals['intentionally-divergent']).toBeGreaterThanOrEqual(2);
    expect(text).toContain('modules/error-log.js -> src/modules/error-log.ts');
    expect(text).toContain('background.core.js -> src/background/badge.ts');
  });

  it('fails when a promoted runtime JS file changes without its TS source', () => {
    const report = analyzeSourceDrift(promotedFixture(), ['modules/error-log.js']);

    expect(report.ok).toBe(false);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].runtime).toBe('modules/error-log.js');
  });

  it('allows promoted runtime JS changes when the source or generated artifact changes too', () => {
    const withSource = analyzeSourceDrift(promotedFixture(), [
      'modules/error-log.js',
      'src/modules/error-log.ts',
    ]);
    const withGenerated = analyzeSourceDrift(promotedFixture(), [
      'modules/error-log.js',
      'modules/error-log.generated.js',
    ]);

    expect(withSource.violations).toEqual([]);
    expect(withGenerated.violations).toEqual([]);
  });

  it('allows the first promotion commit when the map changes from mirrored to promoted', () => {
    const previousMap = normalizePromotionMap({
      schemaVersion: 1,
      entries: [
        {
          runtime: 'modules/userstyles.js',
          sources: ['src/modules/userstyles.ts'],
          status: 'mirrored',
        },
      ],
    }, { rootDir: ROOT });
    const currentMap = normalizePromotionMap({
      schemaVersion: 1,
      entries: [
        {
          runtime: 'modules/userstyles.js',
          sources: ['src/modules/userstyles.ts'],
          status: 'promoted',
        },
      ],
    }, { rootDir: ROOT });

    const report = analyzeSourceDrift(currentMap, [
      'modules/userstyles.js',
      'ts-source-promotion.json',
    ], { previousMap });

    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.touched[0]).toMatchObject({
      runtime: 'modules/userstyles.js',
      newlyPromoted: true,
    });
  });

  it('does not gate candidate or intentionally divergent runtime files yet', () => {
    const map = normalizePromotionMap({
      schemaVersion: 1,
      entries: [
        {
          runtime: 'modules/error-log.js',
          sources: ['src/modules/error-log.ts'],
          status: 'candidate',
        },
        {
          runtime: 'modules/sync-providers.js',
          sources: ['src/modules/sync-providers.ts'],
          status: 'intentionally-divergent',
        },
      ],
    }, { rootDir: ROOT });
    const report = analyzeSourceDrift(map, ['modules/error-log.js', 'modules/sync-providers.js']);

    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });

  it('returns a non-zero CLI exit code for promoted JS-only drift', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scriptvault-ts-drift-'));
    const mapPath = join(dir, 'promotion.json');
    writeFileSync(mapPath, JSON.stringify({
      schemaVersion: 1,
      entries: [
        {
          runtime: 'modules/error-log.js',
          sources: ['src/modules/error-log.ts'],
          status: 'promoted',
        },
      ],
    }));

    const result = spawnSync('node', [
      SCRIPT,
      '--map',
      mapPath,
      '--root',
      ROOT,
      '--changed',
      'modules/error-log.js',
      '--json',
    ], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.violations).toHaveLength(1);
    expect(report.mapErrors).toEqual([]);
  });
});
