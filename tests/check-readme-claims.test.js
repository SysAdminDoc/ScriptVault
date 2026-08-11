import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const script = join(repoRoot, 'scripts', 'check-readme-claims.mjs');

describe('check-readme-claims.mjs', () => {
  it('passes against the live README', () => {
    const result = spawnSync(process.execPath, [script, '--quiet'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('emits machine-readable JSON', () => {
    const result = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('failures');
    expect(Array.isArray(parsed.failures)).toBe(true);
    expect(Array.isArray(parsed.registryProviders)).toBe(true);
    expect(parsed.registryProviders).toContain('webdav');
    expect(parsed.registryProviders).toContain('google drive');
    expect(parsed.registryProviders).toContain('s3-compatible');
    expect(parsed.projectFacts.toolchain).toEqual({ node: '24.18.1', npm: '11.16.0' });
    expect(parsed.projectFacts.tools).toEqual({
      typescript: '7.0.2',
      monaco: '0.56.0',
      cwsCli: '4.0.1',
    });
    expect(parsed.projectFacts.runtime.promotedEntries).toBe(61);
    expect(parsed.projectFacts.storage.stores).toContain('publicationReceipts');
    expect(parsed.projectFacts.delivery).toEqual({ policy: 'local-only', workflowPaths: [] });
  });

  it('pins the shipped-feature checklist rows', () => {
    const checklist = readFileSync(join(repoRoot, 'docs', 'readme-feature-claim-checklist.md'), 'utf8');
    const requiredRows = [
      ['ESM userscript bundler', 'bg/esm-bundler.js', 'tests/esm-bundler.test.js'],
      ['Per-install/update trust receipts with diff', 'createScriptTrustReceipt', 'tests/trust-receipt-diff.test.js'],
      ['Install-source trust badges', 'classifyInstallSource', 'tests/install-source.test.js'],
      ['Internal-host fetch guard', 'modules/internal-host-guard.js', 'tests/internal-host-guard.test.js'],
      ['Sync cockpit', 'CloudSync.preview', 'tests/sync-cockpit.test.js'],
      ['Dashboard table virtualization', 'pages/dashboard-virtual-rows.js', 'tests/dashboard-virtual-rows.test.js'],
    ];
    for (const row of requiredRows) {
      for (const needle of row) {
        expect(checklist).toContain(needle);
      }
    }
  });

  it('flags a resurrected deleted-module mention', () => {
    // Run the script against a temporary README copy by overriding the README
    // path via a small wrapper that the script reads from. The current
    // implementation hardcodes README.md, so this test verifies the
    // hardcoded path's content stays clean by transiently mutating + restoring
    // the live README. The mutation window is bounded by a try/finally so a
    // crash here cannot leave the README in a bad state.
    const readmePath = join(repoRoot, 'README.md');
    const backup = readFileSync(readmePath, 'utf8');
    const sentinel = `<!-- TEST-SENTINEL ${randomUUID()} - AI Assistant feature -->\n`;
    try {
      writeFileSync(readmePath, sentinel + backup, 'utf8');
      const result = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.failures.length).toBeGreaterThan(0);
      const triggered = parsed.failures.find((f) => f.needle === 'ai assistant');
      expect(triggered).toBeTruthy();
    } finally {
      writeFileSync(readmePath, backup, 'utf8');
    }
  });

  it('flags a missing dashboard module reference', () => {
    const readmePath = join(repoRoot, 'README.md');
    const backup = readFileSync(readmePath, 'utf8');
    const fakeName = `dashboard-${randomUUID().slice(0, 8)}.js`;
    const sentinel = `<!-- TEST-SENTINEL ${fakeName} -->\n`;
    try {
      // Ensure the fake file does not exist (uuid prefix makes collision
      // essentially impossible, but guard explicitly).
      expect(existsSync(join(repoRoot, 'pages', fakeName))).toBe(false);
      writeFileSync(readmePath, sentinel + backup, 'utf8');
      const result = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      const parsed = JSON.parse(result.stdout);
      const triggered = parsed.failures.find((f) => f.filename === fakeName);
      expect(triggered).toBeTruthy();
      expect(triggered.check).toBe('missing-dashboard-module');
    } finally {
      writeFileSync(readmePath, backup, 'utf8');
    }
  });

  it('flags a stale canonical tool version in active documentation', () => {
    const readmePath = join(repoRoot, 'README.md');
    const backup = readFileSync(readmePath, 'utf8');
    expect(backup).toContain('TypeScript 7.0.2');
    try {
      writeFileSync(readmePath, backup.replace(
        'TypeScript 7.0.2',
        'TypeScript 7.0.1',
      ), 'utf8');
      const result = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.failures.some((failure) => failure.fact === 'TypeScript version')).toBe(true);
    } finally {
      writeFileSync(readmePath, backup, 'utf8');
    }
  });

  it('flags stale generated support-matrix version and verification date', () => {
    const readmePath = join(repoRoot, 'README.md');
    const backup = readFileSync(readmePath, 'utf8');
    const currentVersion = JSON.parse(readFileSync(join(repoRoot, 'manifest.json'), 'utf8')).version;
    const versionNeedle = `Version source: \`manifest.json\` / \`manifest-firefox.json\` ${currentVersion}._`;
    expect(backup).toContain(versionNeedle);
    try {
      const staleVersion = versionNeedle.replace(currentVersion, '0.0.0');
      writeFileSync(readmePath, backup.replace(versionNeedle, staleVersion), 'utf8');
      const versionResult = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
      expect(versionResult.status).toBe(1);
      const versionReport = JSON.parse(versionResult.stdout);
      expect(versionReport.failures.some((failure) => failure.check === 'stale-support-matrix-version')).toBe(true);
    } finally {
      writeFileSync(readmePath, backup, 'utf8');
    }

    const dateMatch = backup.match(/_Last generated:\s*(\d{4}-\d{2}-\d{2})/);
    expect(dateMatch).toBeTruthy();
    try {
      writeFileSync(readmePath, backup.replace(dateMatch[1], '2000-01-01'), 'utf8');
      const dateResult = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
      expect(dateResult.status).toBe(1);
      const dateReport = JSON.parse(dateResult.stdout);
      expect(dateReport.failures.some((failure) => failure.check === 'stale-support-matrix-date')).toBe(true);
    } finally {
      writeFileSync(readmePath, backup, 'utf8');
    }
  });
});
