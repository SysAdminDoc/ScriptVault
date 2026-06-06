import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  analyzeOptionalDependencyReach,
  collectOptionalDependencyNames,
  formatOptionalDependencyReachReport,
} from '../scripts/check-optional-dep-reach.mjs';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts/check-optional-dep-reach.mjs');

function makeFixture({ source = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'scriptvault-optional-deps-'));
  mkdirSync(resolve(root, 'src/background'), { recursive: true });
  writeFileSync(resolve(root, 'package-lock.json'), JSON.stringify({
    name: 'fixture',
    lockfileVersion: 3,
    packages: {
      '': {
        devDependencies: {
          fixture: '1.0.0',
        },
      },
      'node_modules/canvas': {
        version: '3.2.0',
        optional: true,
      },
      'node_modules/playwright': {
        version: '1.60.0',
        peerDependencies: {
          canvas: '^3.0.0',
        },
        peerDependenciesMeta: {
          canvas: {
            optional: true,
          },
        },
      },
      'node_modules/@esbuild/win32-x64': {
        version: '0.27.4',
        optional: true,
      },
    },
  }, null, 2));
  writeFileSync(resolve(root, 'src/background/example.js'), source);
  return root;
}

describe('optional dependency reach gate', () => {
  it('collects optional packages and peer-optional edges from package-lock', () => {
    const lockfile = JSON.parse(readFileSyncFromFixture(makeFixture()));
    const optional = collectOptionalDependencyNames(lockfile);

    expect(optional.optionalPackages).toContain('canvas');
    expect(optional.optionalPackages).toContain('@esbuild/win32-x64');
    expect(optional.peerOptionalEdges).toContain('canvas');
    expect(optional.names).toEqual(['@esbuild/win32-x64', 'canvas']);
  });

  it('passes for the repository shipped source inputs', () => {
    const report = analyzeOptionalDependencyReach({ rootDir: ROOT });

    expect(report.ok).toBe(true);
    expect(report.optional.names.length).toBeGreaterThan(0);
    expect(report.scannedCount).toBeGreaterThan(0);
    expect(formatOptionalDependencyReachReport(report)).toContain('[optional-deps] OK');
  });

  it('fails when shipped source imports an optional package', () => {
    const root = makeFixture({
      source: 'import { createCanvas } from "canvas";\nconst native = require("@esbuild/win32-x64");\n',
    });
    const report = analyzeOptionalDependencyReach({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      'src/background/example.js:1 imports optional dependency "canvas" via "canvas"',
      'src/background/example.js:2 imports optional dependency "@esbuild/win32-x64" via "@esbuild/win32-x64"',
    ]);
  });

  it('ignores DOM string references that are not import specifiers', () => {
    const root = makeFixture({
      source: 'const canvas = document.createElement("canvas");\nconst label = "canvas";\n',
    });
    const report = analyzeOptionalDependencyReach({ rootDir: root });

    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('returns a non-zero CLI exit code when an optional import is reachable', () => {
    const root = makeFixture({
      source: 'const canvas = await import("canvas");\n',
    });
    const result = spawnSync('node', [SCRIPT], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[optional-deps] Optional dependency reach check failed:');
    expect(result.stdout).toContain('src/background/example.js:1 imports optional dependency "canvas"');
  });
});

function readFileSyncFromFixture(root) {
  return readFileSync(resolve(root, 'package-lock.json'), 'utf8');
}
