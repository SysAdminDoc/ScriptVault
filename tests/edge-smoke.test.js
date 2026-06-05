import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const edgeSmoke = readFileSync(resolve(process.cwd(), 'scripts/smoke-edge-sideload.mjs'), 'utf8');
const edgeBuilder = readFileSync(resolve(process.cwd(), 'scripts/build-edge.mjs'), 'utf8');
const matrixGenerator = readFileSync(resolve(process.cwd(), 'scripts/generate-browser-support-matrix.mjs'), 'utf8');
const edgeSubmission = readFileSync(resolve(process.cwd(), 'docs/edge-submission.md'), 'utf8');

describe('Microsoft Edge sideload smoke wiring', () => {
  it('exposes a maintainer-runnable Edge smoke command', () => {
    expect(packageJson.scripts['smoke:edge']).toBe('node scripts/smoke-edge-sideload.mjs');
    expect(edgeSmoke).toContain('SCRIPT_VAULT_EDGE_PATH');
    expect(edgeSmoke).toContain('scripts/build-edge.mjs');
    expect(edgeSmoke).toContain('build-edge');
    expect(edgeSmoke).toContain('edge-smoke-${VERSION}.json');
  });

  it('loads the generated Edge package and exercises extension runtime paths', () => {
    expect(edgeSmoke).toContain('enableExtensions: [BUILD_DIR]');
    expect(edgeSmoke).toContain('#itemAllowUserScripts');
    expect(edgeSmoke).toContain('pages/dashboard.html');
    expect(edgeSmoke).toContain('pages/popup.html');
    expect(edgeSmoke).toContain("action: 'getExtensionStatus'");
    expect(edgeSmoke).toContain("action: 'saveScript'");
    expect(edgeSmoke).toContain("action: 'toggleScript'");
    expect(edgeSmoke).toContain('document.documentElement.dataset.scriptvaultEdgeSmoke');
    expect(edgeSmoke).toContain("args.has('--strict-console')");
    expect(edgeSmoke).toContain("error.type !== 'console.error'");
  });

  it('records Edge smoke evidence in the Edge readiness report and support matrix', () => {
    expect(edgeBuilder).toContain("browserSmokeCommand: 'npm run smoke:edge'");
    expect(edgeBuilder).toContain('browserSmokeEvidence: `edge-artifacts/edge-smoke-${version}.json`');
    expect(matrixGenerator).toContain('browserSmokeCommand');
    expect(matrixGenerator).toContain('browserSmokeEvidence');
  });

  it('documents the local smoke without overstating Edge publication state', () => {
    expect(edgeSubmission).toContain('npm run smoke:edge');
    expect(edgeSubmission).toContain('edge-artifacts/edge-smoke-<version>.json');
    expect(edgeSubmission).toContain('--strict-console');
    expect(edgeSubmission).toContain('labels this as manual until a live listing exists');
  });
});
