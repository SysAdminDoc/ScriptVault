import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  analyzeToolchainContract,
  formatToolchainReport,
} from '../scripts/check-toolchain-contract.mjs';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts/check-toolchain-contract.mjs');

function makeFixture({ nodeVersion = '24.16.0', ciNodeVersionFile = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'scriptvault-toolchain-'));
  mkdirSync(resolve(root, '.github/workflows'), { recursive: true });
  mkdirSync(resolve(root, 'docs'), { recursive: true });

  writeFileSync(resolve(root, '.node-version'), `${nodeVersion}\n`);
  writeFileSync(resolve(root, '.nvmrc'), `${nodeVersion}\n`);
  writeFileSync(resolve(root, '.npmrc'), 'engine-strict=true\n');
  writeFileSync(resolve(root, '.github/workflows/ci.yml'), ciNodeVersionFile
    ? 'with:\n  node-version-file: .node-version\n'
    : 'with:\n  node-version: 20\n');
  writeFileSync(resolve(root, 'CONTRIBUTING.md'), 'Install the Node.js version in `.node-version` (currently 24.16.0) with npm 11.13.0 or newer.\n');
  writeFileSync(resolve(root, 'docs/release-runbook.md'), 'ScriptVault itself requires Node 24.16.0+ / npm 11.13.0+.\n');
  writeFileSync(resolve(root, 'package.json'), JSON.stringify({
    packageManager: 'npm@11.13.0',
    engines: {
      node: '>=24.16.0',
      npm: '>=11.13.0',
    },
  }, null, 2));
  writeFileSync(resolve(root, 'package-lock.json'), JSON.stringify({
    packages: {
      '': {
        engines: {
          node: '>=24.16.0',
          npm: '>=11.13.0',
        },
      },
    },
  }, null, 2));

  return root;
}

describe('toolchain contract gate', () => {
  it('passes for the repository contract', () => {
    const report = analyzeToolchainContract({ rootDir: ROOT });

    expect(report.ok).toBe(true);
    expect(formatToolchainReport(report)).toContain('Node 24.16.0+');
  });

  it('detects version drift across local version files', () => {
    const report = analyzeToolchainContract({ rootDir: makeFixture({ nodeVersion: '22.0.0' }) });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('.node-version: expected 24.16.0, got 22.0.0');
    expect(report.errors).toContain('.nvmrc: expected 24.16.0, got 22.0.0');
  });

  it('detects CI falling back to a literal setup-node version', () => {
    const report = analyzeToolchainContract({ rootDir: makeFixture({ ciNodeVersionFile: false }) });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('.github/workflows/ci.yml: missing node-version-file: .node-version');
  });

  it('returns a non-zero CLI exit code when the repository contract drifts', () => {
    const rootDir = makeFixture({ nodeVersion: '22.0.0' });
    const result = spawnSync('node', [SCRIPT], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[toolchain] Contract check failed.');
  });
});

describe('Vitest dev-server exposure guard', () => {
  it('vitest config binds server and browser API to loopback only', async () => {
    const { readFileSync } = await import('node:fs');
    const configSource = readFileSync(resolve(ROOT, 'vitest.config.mjs'), 'utf8');

    expect(configSource).toContain('"127.0.0.1"');
    expect(configSource).not.toMatch(/host\s*:\s*["']0\.0\.0\.0["']/);
    expect(configSource).not.toMatch(/host\s*:\s*["']::["']/);
    expect(configSource).toContain('strictPort: true');
  });
});
