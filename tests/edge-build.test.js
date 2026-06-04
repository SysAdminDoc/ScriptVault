// Edge add-on builder smoke tests. Runs the real script with --no-zip so
// the test stays fast and doesn't depend on tar.exe / zip being on PATH.
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SCRIPT = resolve(process.cwd(), 'scripts/build-edge.mjs');
const BUILD_DIR = resolve(process.cwd(), 'build-edge');
const ARTIFACT_DIR = resolve(process.cwd(), 'edge-artifacts');

describe('scripts/build-edge.mjs', () => {
  afterAll(() => {
    try { rmSync(BUILD_DIR, { recursive: true, force: true }); } catch (_) {}
    try { rmSync(ARTIFACT_DIR, { recursive: true, force: true }); } catch (_) {}
  });

  it('stages a complete Edge build directory with declared files present', () => {
    execFileSync('node', [SCRIPT, '--no-zip'], { encoding: 'utf8', stdio: 'pipe' });
    expect(existsSync(join(BUILD_DIR, 'manifest.json'))).toBe(true);
    expect(existsSync(join(BUILD_DIR, 'background.js'))).toBe(true);
    expect(existsSync(join(BUILD_DIR, 'pages/dashboard.html'))).toBe(true);
    expect(existsSync(join(BUILD_DIR, '_locales/en/messages.json'))).toBe(true);
    expect(existsSync(join(BUILD_DIR, 'images/icon128.png'))).toBe(true);
  });

  it('strips update_url (when present) from the Edge manifest', () => {
    const manifest = JSON.parse(readFileSync(join(BUILD_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.update_url).toBeUndefined();
  });

  it('keeps Chrome MV3 manifest fields Edge actually wants', () => {
    const manifest = JSON.parse(readFileSync(join(BUILD_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background?.service_worker).toBe('background.js');
    expect(manifest.background?.type).toBe('module');
    expect(Array.isArray(manifest.permissions)).toBe(true);
  });

  it('writes a build summary JSON next to the artifact', () => {
    const reportPath = join(ARTIFACT_DIR, 'edge-build-3.11.0.json');
    expect(existsSync(reportPath)).toBe(true);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.schemaVersion).toBe(2);
    expect(report.version).toBe('3.11.0');
    expect(report.buildDir).toBe('build-edge');
    expect(report.missingFiles).toEqual([]);
    expect(report.edgeReadiness.updateUrlRemoved).toBe(true);
    expect(report.edgeReadiness.packageAutomation).toContain('npm run build:edge:check');
    expect(report.edgeReadiness.initialPublication).toContain('Manual Partner Center upload');
    expect(report.edgeReadiness.updateAutomation).toContain('REST update automation is deferred');
    expect(report.reviewDeclarations.remoteCode).toBe('docs/cws-remote-code-compliance.md');
    expect(report.transformsApplied.removeKeys).toContain('update_url');
  });

  it('exits 0 on --check when nothing is missing', () => {
    let code = 0;
    try {
      execFileSync('node', [SCRIPT, '--no-zip', '--check'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      code = err.status || 1;
    }
    expect(code).toBe(0);
  });
});
