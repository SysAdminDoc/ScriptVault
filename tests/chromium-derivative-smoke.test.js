import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const runner = readFileSync(resolve(ROOT, 'scripts/smoke-chromium-derivatives.mjs'), 'utf8');
const browserSmoke = readFileSync(resolve(ROOT, 'scripts/smoke-edge-sideload.mjs'), 'utf8');
const matrixGenerator = resolve(ROOT, 'scripts/generate-browser-support-matrix.mjs');

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function matrixFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'scriptvault-derivative-matrix-'));
  mkdirSync(resolve(dir, 'docs'), { recursive: true });
  mkdirSync(resolve(dir, 'edge-artifacts'), { recursive: true });
  mkdirSync(resolve(dir, 'chromium-derivative-artifacts'), { recursive: true });
  writeFileSync(resolve(dir, 'README.md'), '# Fixture\n\n---\n\n## Permission and Privacy Review\n', 'utf8');
  writeFileSync(resolve(dir, 'docs/cross-browser-pipeline.md'), 'Smoke-test each on every release tag.\n', 'utf8');
  writeJson(resolve(dir, 'manifest.json'), { version: '3.20.0', minimum_chrome_version: '130' });
  writeJson(resolve(dir, 'manifest-firefox.json'), {
    version: '3.20.0',
    browser_specific_settings: { gecko: { strict_min_version: '140.0' } },
  });
  writeFileSync(resolve(dir, 'edge-artifacts/scriptvault-edge-v3.20.0.zip'), 'fixture', 'utf8');
  writeJson(resolve(dir, 'edge-artifacts/edge-build-3.20.0.json'), {
    version: '3.20.0',
    artifact: 'edge-artifacts/scriptvault-edge-v3.20.0.zip',
    generatedAt: '2026-07-14T10:00:00.000Z',
    missingFiles: [],
    packageCommand: 'npm run build:edge:check',
    edgeReadiness: {
      updateUrlRemoved: true,
      browserSmokeCommand: 'npm run smoke:edge',
      browserSmokeEvidence: 'edge-artifacts/edge-smoke-3.20.0.json',
    },
  });
  writeJson(resolve(dir, 'chromium-derivative-artifacts/summary-3.20.0.json'), {
    schemaVersion: 1,
    version: '3.20.0',
    generatedAt: '2026-07-14T11:00:00.000Z',
    status: 'passed',
    browsers: [
      {
        id: 'brave',
        name: 'Brave',
        status: 'passed',
        evidence: 'chromium-derivative-artifacts/brave-3.20.0.json',
        browserVersion: 'Chrome/146.0.0.0',
      },
      { id: 'vivaldi', name: 'Vivaldi', status: 'not-installed' },
      { id: 'opera', name: 'Opera', status: 'not-installed' },
      { id: 'arc', name: 'Arc', status: 'not-installed' },
    ],
  });
  return dir;
}

describe('Chromium derivative smoke evidence', () => {
  it('discovers supported derivative executables and reuses the live runtime smoke contract', () => {
    expect(packageJson.scripts['smoke:derivatives']).toBe('node scripts/smoke-chromium-derivatives.mjs');
    for (const id of ['BRAVE', 'VIVALDI', 'OPERA', 'ARC']) {
      expect(runner).toContain(`SCRIPT_VAULT_${id}_PATH`);
    }
    expect(runner).toContain('scripts/smoke-edge-sideload.mjs');
    expect(runner).toContain('chromium-derivative-artifacts');
    expect(browserSmoke).toContain('SCRIPT_VAULT_SMOKE_BROWSER_ID');
    expect(browserSmoke).toContain('SCRIPT_VAULT_SMOKE_EVIDENCE_PATH');
    expect(browserSmoke).toContain('#allow-user-scripts');
    expect(browserSmoke).toContain("action: 'saveScript'");
    expect(browserSmoke).toContain('pages/install.html');
    expect(browserSmoke).toContain('scriptvaultBrowserSmoke');
  });

  it('feeds passed and unavailable derivative evidence into the generated support matrix', () => {
    const dir = matrixFixture();
    try {
      execFileSync(process.execPath, [matrixGenerator, '--date=2026-07-14'], {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const readme = readFileSync(resolve(dir, 'README.md'), 'utf8');
      expect(readme).toContain('2026-07-14 local smoke passed: Brave');
      expect(readme).toContain('`npm run smoke:derivatives`');
      expect(readme).toContain('`chromium-derivative-artifacts/brave-3.20.0.json`');
      expect(readme).toContain('Vivaldi, Opera, Arc were not installed for the latest local run');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
