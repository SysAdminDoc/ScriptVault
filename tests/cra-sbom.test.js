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

  it('requires the shipped Monaco, sanitizer, parser, and archive components for release SBOMs', () => {
    const fixture = validFixture();
    fixture.pkg.devDependencies.acorn = '8.17.0';
    fixture.lock.packages['node_modules/acorn'].version = '8.17.0';
    fixture.sbom.dependencies[0].dependsOn = ['pkg:npm/acorn@8.17.0'];
    fixture.sbom.dependencies = fixture.sbom.dependencies.filter((entry) => entry.ref !== 'pkg:npm/acorn@1.0.0');
    fixture.sbom.components = fixture.sbom.components.filter((component) => component.name !== 'acorn');
    for (const [name, version, license] of [
      ['monaco-editor', '0.56.0', 'MIT'],
      ['dompurify', '3.4.13', 'MPL-2.0 OR Apache-2.0'],
      ['acorn', '8.17.0', 'MIT'],
      ['fflate', '0.8.3', 'MIT'],
      ['codemirror', '5.65.15', 'MIT'],
    ]) {
      const ref = `pkg:npm/${name}@${version}`;
      fixture.sbom.components.push({
        'bom-ref': ref,
        type: 'library',
        name,
        version,
        purl: ref,
        licenses: [{ expression: license }],
        properties: [{ name: 'scriptvault:shipped', value: 'true' }],
      });
    }

    expect(validateCraSbom(fixture.sbom, fixture.pkg, fixture.lock, { requireShippedComponents: true })).toMatchObject({ ok: true });

    fixture.sbom.components = fixture.sbom.components.filter((component) => component.name !== 'dompurify');
    const report = validateCraSbom(fixture.sbom, fixture.pkg, fixture.lock, { requireShippedComponents: true });
    expect(report.failures).toContain('Shipped third-party component pkg:npm/dompurify@3.4.13 is missing from SBOM components');
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
    for (const needle of [
      "name: 'monaco-editor'",
      "name: 'dompurify'",
      "name: 'acorn'",
      "name: 'fflate'",
      'scriptvault:packaged-sha256',
    ]) expect(releaseTrust).toContain(needle);
    expect(releaseTrust).toContain("npm audit signatures --min-release-age=0");
    expect(releaseTrust).toContain('dependencies,');

    const runbook = read('docs/release-runbook.md');
    expect(runbook).toContain('npm run release:trust');
    expect(runbook).toContain('npm run release:trust:cra');
  });
});
