import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  analyzeCoverageSources,
  formatCoverageSourceReport,
} from '../scripts/check-coverage-sources.mjs';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts/check-coverage-sources.mjs');

function makeFixture({ omitCoverage = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scriptvault-coverage-gate-'));
  const files = [
    'src/background/core.ts',
    'src/background/wrapper-builder.ts',
    'src/bg/analyzer.ts',
    'src/modules/storage.ts',
    'src/shared/utils.ts',
    'src/storage/indexeddb.ts',
    'src/types/messages.ts',
  ];

  for (const file of files) {
    mkdirSync(resolve(dir, file, '..'), { recursive: true });
    writeFileSync(resolve(dir, file), 'export const covered = true;\n');
  }

  writeFileSync(resolve(dir, 'ts-source-promotion.json'), JSON.stringify({
    schemaVersion: 1,
    entries: [
      {
        runtime: 'background.core.js',
        sources: ['src/background/core.ts'],
        status: 'promoted',
      },
      {
        runtime: 'modules/storage.js',
        sources: ['src/modules/storage.ts'],
        status: 'promoted',
      },
      {
        runtime: 'modules/legacy.js',
        sources: ['src/modules/legacy.ts'],
        status: 'candidate',
      },
    ],
  }, null, 2));

  mkdirSync(resolve(dir, 'coverage'), { recursive: true });
  const coveredFiles = files
    .filter((file) => !file.startsWith('src/types/'))
    .filter((file) => !omitCoverage.includes(file));
  const summary = Object.fromEntries(coveredFiles.map((file) => [
    file,
    {
      lines: { total: 1, covered: 1, skipped: 0, pct: 100 },
      statements: { total: 1, covered: 1, skipped: 0, pct: 100 },
      functions: { total: 1, covered: 1, skipped: 0, pct: 100 },
      branches: { total: 1, covered: 1, skipped: 0, pct: 100 },
    },
  ]));
  summary.total = {
    lines: { total: coveredFiles.length, covered: coveredFiles.length, skipped: 0, pct: 100 },
    statements: { total: coveredFiles.length, covered: coveredFiles.length, skipped: 0, pct: 100 },
    functions: { total: coveredFiles.length, covered: coveredFiles.length, skipped: 0, pct: 100 },
    branches: { total: coveredFiles.length, covered: coveredFiles.length, skipped: 0, pct: 100 },
  };
  writeFileSync(resolve(dir, 'coverage/coverage-summary.json'), JSON.stringify(summary, null, 2));

  return dir;
}

describe('coverage source gate', () => {
  it('passes when every authoritative source root and promoted source appears in the summary', () => {
    const rootDir = makeFixture();
    const report = analyzeCoverageSources({ rootDir });

    expect(report.ok).toBe(true);
    expect(report.authoritativeSourceCount).toBe(6);
    expect(report.promotedSourceCount).toBe(2);
    expect(formatCoverageSourceReport(report)).toContain('[coverage-sources] OK');
  });

  it('fails when a background source is omitted from coverage-summary.json', () => {
    const rootDir = makeFixture({ omitCoverage: ['src/background/wrapper-builder.ts'] });
    const report = analyzeCoverageSources({ rootDir });

    expect(report.ok).toBe(false);
    expect(report.missingAuthoritativeSources).toContain('src/background/wrapper-builder.ts');
    expect(report.missingPromotedSources).not.toContain('src/background/wrapper-builder.ts');
  });

  it('fails separately for promoted source omissions', () => {
    const rootDir = makeFixture({ omitCoverage: ['src/background/core.ts'] });
    const report = analyzeCoverageSources({ rootDir });

    expect(report.ok).toBe(false);
    expect(report.missingAuthoritativeSources).toContain('src/background/core.ts');
    expect(report.missingPromotedSources).toContain('src/background/core.ts');
  });

  it('returns a non-zero CLI exit code when coverage has not been generated', () => {
    const rootDir = makeFixture();
    const result = spawnSync('node', [
      SCRIPT,
      '--root',
      rootDir,
      '--summary',
      resolve(rootDir, 'coverage/missing-summary.json'),
      '--json',
    ], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.errors[0]).toContain('Missing coverage summary');
  });
});
