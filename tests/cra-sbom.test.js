import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validateCraSbom } from '../scripts/check-cra-sbom.mjs';

const ROOT = process.cwd();

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function validFixture() {
  const pkg = {
    name: 'scriptvault',
    version: '1.0.0',
    license: 'MIT',
    devDependencies: { acorn: '1.0.0' },
  };
  const lock = {
    packages: {
      '': { name: 'scriptvault', version: '1.0.0', license: 'MIT' },
      'node_modules/acorn': { version: '1.0.0', license: 'MIT' },
    },
  };
  const rootRef = 'pkg:npm/scriptvault@1.0.0';
  const depRef = 'pkg:npm/acorn@1.0.0';
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.7',
    serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
    version: 1,
    metadata: {
      timestamp: '2026-01-01T00:00:00.000Z',
      supplier: { name: 'SysAdminDoc' },
      component: {
        'bom-ref': rootRef,
        type: 'application',
        name: 'scriptvault',
        version: '1.0.0',
        purl: rootRef,
        licenses: [{ expression: 'MIT' }],
      },
    },
    components: [
      {
        'bom-ref': depRef,
        type: 'library',
        name: 'acorn',
        version: '1.0.0',
        purl: depRef,
        licenses: [{ expression: 'MIT' }],
      },
    ],
    dependencies: [
      { ref: rootRef, dependsOn: [depRef] },
      { ref: depRef, dependsOn: [] },
    ],
  };
  return { pkg, lock, sbom };
}

describe('CRA SBOM gate', () => {
  it('accepts CycloneDX 1.7 SBOMs with supplier, product, dependency, and license evidence', () => {
    const fixture = validFixture();
    expect(validateCraSbom(fixture.sbom, fixture.pkg, fixture.lock)).toMatchObject({
      ok: true,
      failures: [],
      counts: { components: 1, directDependencies: 1 },
    });
  });

  it('rejects SBOMs that omit direct dependency license evidence', () => {
    const fixture = validFixture();
    delete fixture.sbom.components[0].licenses;
    const report = validateCraSbom(fixture.sbom, fixture.pkg, fixture.lock);
    expect(report.ok).toBe(false);
    expect(report.failures).toContain('Component acorn must include a license expression');
    expect(report.failures).toContain('Direct dependency acorn must include license');
  });

  it('keeps the release trust generator and local release runbook wired to the CRA SBOM check', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.license).toBe('MIT');
    expect(pkg.repository?.url).toBe('https://github.com/SysAdminDoc/ScriptVault.git');
    expect(pkg.scripts['release:trust:cra']).toBe('node scripts/check-cra-sbom.mjs');

    const releaseTrust = read('scripts/release-trust-gate.mjs');
    expect(releaseTrust).toContain("specVersion: '1.7'");
    expect(releaseTrust).toContain('supplier: {');
    expect(releaseTrust).toContain("'bom-ref': purl");
    expect(releaseTrust).toContain('dependencies,');

    const runbook = read('docs/release-runbook.md');
    expect(runbook).toContain('npm run release:trust');
    expect(runbook).toContain('npm run release:trust:cra');
  });
});
