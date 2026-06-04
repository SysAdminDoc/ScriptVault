import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('install @require provenance preview wiring', () => {
  const installPage = readFileSync(resolve(process.cwd(), 'pages/install.js'), 'utf8');
  const backgroundCore = readFileSync(resolve(process.cwd(), 'src/background/core.ts'), 'utf8');

  it('renders an install-dialog provenance badge and per-require labels', () => {
    expect(installPage).toContain('decisionProvenanceState');
    expect(installPage).toContain('provenance-status');
    expect(installPage).toContain('Verified author');
    expect(installPage).toContain('checkRequireProvenance(scriptMeta)');
  });

  it('requests provenance verification from the background, not the install page', () => {
    expect(installPage).toContain("action: 'verifyRequireProvenancePreview'");
    expect(backgroundCore).toContain("case 'verifyRequireProvenancePreview':");
    expect(backgroundCore).toContain('return await previewRequireProvenance(data);');
  });

  it('uses the hardened background dependency and bundle fetchers for preview and saved receipts', () => {
    expect(backgroundCore).toContain('const body = await fetchRequireScript(url);');
    expect(backgroundCore).toContain('async function fetchRequireScriptForTrustReceipt(url)');
    expect(backgroundCore).toContain("fetchRequireScript(url, { bypassCache: true, cacheResult: false })");
    expect(backgroundCore).toContain('await _receiptDependencyProvenance(bundleUrl, identity, body, fetchProvenanceBundle)');
    expect(backgroundCore).toMatch(/fetchDependencyBody:\s*fetchRequireScriptForTrustReceipt,\s*fetchProvenanceBundle/s);
  });

  it('rejects opted-in provenance failures before saving install or update state', () => {
    expect(backgroundCore).toContain('function _getRequireProvenanceFailure');
    expect(backgroundCore).toContain('@require provenance verification failed for');
    expect(backgroundCore).toMatch(/const provenanceFailure = _getRequireProvenanceFailure\(trustReceipt\);[\s\S]*return \{ error: provenanceFailure\.message \};/);
    expect(backgroundCore).toMatch(/throw new Error\(provenanceFailure\.message\);/);
  });
});
