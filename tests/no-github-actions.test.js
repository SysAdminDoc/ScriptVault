import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  analyzeNoGitHubActions,
  formatNoGitHubActionsReport,
} from '../scripts/check-no-github-actions.mjs';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts/check-no-github-actions.mjs');

function makeFixture(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'scriptvault-no-actions-'));
  for (const [path, contents] of Object.entries(files)) {
    const fullPath = resolve(root, path);
    mkdirSync(resolve(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, contents);
  }
  return root;
}

describe('local build policy gate', () => {
  it('passes for the repository policy', () => {
    const report = analyzeNoGitHubActions({ rootDir: ROOT });

    expect(report.ok).toBe(true);
    expect(report.files).toEqual([]);
    expect(formatNoGitHubActionsReport(report)).toContain('[local-build-policy] OK');
  });

  it('fails when a workflow file exists', () => {
    const root = makeFixture({
      '.github/workflows/ci.yml': 'name: CI\n',
    });
    const report = analyzeNoGitHubActions({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.files).toEqual(['.github/workflows/ci.yml']);
    expect(report.errors[0]).toContain('ScriptVault releases are built and verified locally');
  });

  it('fails nested workflow files too', () => {
    const root = makeFixture({
      '.github/workflows/release/nightly.yaml': 'name: Release\n',
    });
    const report = analyzeNoGitHubActions({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.files).toEqual(['.github/workflows/release/nightly.yaml']);
  });

  it('allows non-workflow GitHub metadata', () => {
    const root = makeFixture({
      '.github/ISSUE_TEMPLATE/bug.yml': 'name: Bug\n',
    });
    const report = analyzeNoGitHubActions({ rootDir: root });

    expect(report.ok).toBe(true);
  });

  it('returns a non-zero CLI exit code when a workflow exists', () => {
    const root = makeFixture({
      '.github/workflows/ci.yml': 'name: CI\n',
    });
    const result = spawnSync('node', [SCRIPT], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[local-build-policy] GitHub Actions workflows are not allowed.');
  });
});
