import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  analyzeGitHubActionPins,
  formatGitHubActionPinReport,
} from '../scripts/check-github-actions-pins.mjs';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts/check-github-actions-pins.mjs');
const CHECKOUT_SHA = '34e114876b0b11c390a56381ad16ebd13914f8d5';

function makeWorkflow(contents) {
  const root = mkdtempSync(join(tmpdir(), 'scriptvault-actions-pins-'));
  const workflows = resolve(root, '.github/workflows');
  mkdirSync(workflows, { recursive: true });
  writeFileSync(resolve(workflows, 'ci.yml'), contents);
  return root;
}

describe('GitHub Actions pin gate', () => {
  it('passes for the repository workflow', () => {
    const report = analyzeGitHubActionPins({ rootDir: ROOT });

    expect(report.ok).toBe(true);
    expect(report.refs.length).toBeGreaterThan(0);
    expect(formatGitHubActionPinReport(report)).toContain('[actions-pins] OK');
  });

  it('fails mutable tag references', () => {
    const root = makeWorkflow('steps:\n  - uses: actions/checkout@v4 # v4\n');
    const report = analyzeGitHubActionPins({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors[0]).toContain('not pinned to a full 40-character SHA');
  });

  it('fails missing same-line version comments', () => {
    const root = makeWorkflow(`steps:\n  - uses: actions/checkout@${CHECKOUT_SHA}\n`);
    const report = analyzeGitHubActionPins({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors[0]).toContain('missing a same-line version comment');
  });

  it('allows local and docker action references without SHA checks', () => {
    const root = makeWorkflow('steps:\n  - uses: ./local-action\n  - uses: docker://alpine:3\n');
    const report = analyzeGitHubActionPins({ rootDir: root });

    expect(report.ok).toBe(true);
    expect(report.refs).toEqual([]);
  });

  it('returns a non-zero CLI exit code when a workflow uses a mutable tag', () => {
    const root = makeWorkflow('steps:\n  - uses: actions/setup-node@v4 # v4\n');
    const result = spawnSync('node', [SCRIPT], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[actions-pins] GitHub Actions pin check failed.');
  });
});
