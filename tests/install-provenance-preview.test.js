import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('install @require provenance preview wiring', () => {
  const installPage = readFileSync(resolve(process.cwd(), 'pages/install.js'), 'utf8');
  const dashboardPage = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
  const receiptSource = readFileSync(resolve(process.cwd(), 'src/background/trust-receipt.ts'), 'utf8');
  const scriptTypes = readFileSync(resolve(process.cwd(), 'src/types/script.ts'), 'utf8');
  const backgroundCore = readFileSync(resolve(process.cwd(), 'src/background/core.ts'), 'utf8');

  it('renders an install-dialog provenance badge and per-require labels', () => {
    expect(installPage).toContain('decisionProvenanceState');
    expect(installPage).toContain('provenance-status');
    expect(installPage).toContain('Verified author');
    expect(installPage).toContain('checkRequireProvenance(scriptMeta)');
  });

  it('parses @require-provenance / @require-identity so the preview is not dead', () => {
    // The camelCase fields the provenance UI reads must be populated from the
    // hyphenated directives; a template that omits them left the review row
    // permanently "Not declared".
    expect(installPage).toContain('requireProvenance: [],');
    expect(installPage).toContain('requireIdentity: [],');
    expect(installPage).toContain('requireProvenanceByUrl: Object.create(null)');
    expect(installPage).toContain('requireIdentityByUrl: Object.create(null)');
    expect(installPage).toContain("key === 'require-provenance'");
    expect(installPage).toContain("key === 'require-identity'");
  });

  it('pairs declared provenance to explicit @require URLs before legacy index fallback', () => {
    expect(installPage).toContain("getRequireMetadataForUrl(scriptMeta, 'requireProvenance', url, index)");
    expect(installPage).toContain("getRequireMetadataForUrl(scriptMeta, 'requireIdentity', url, index)");
    expect(installPage).toContain('requireProvenanceByUrl: bundleByUrl');
    expect(installPage).toContain('requireIdentityByUrl: identityByUrl');
    expect(installPage).not.toContain('scriptMeta.requireProvenance?.[index]');
    expect(installPage).not.toContain('scriptMeta.requireIdentity?.[index]');
    expect(backgroundCore).toContain('_receiptMetadataValueForUrl(bundleByUrl, bundleUrls, url, index)');
    expect(backgroundCore).toContain('_receiptMetadataValueForUrl(identityByUrl, identities, url, index)');
  });

  it('requests provenance verification from the background, not the install page', () => {
    expect(installPage).toContain("action: 'verifyRequireProvenancePreview'");
    expect(backgroundCore).toContain("case 'verifyRequireProvenancePreview':");
    expect(backgroundCore).toContain('return await previewRequireProvenance(data);');
  });

  it('uses the hardened background dependency and bundle fetchers for preview and saved receipts', () => {
    // Provenance preview/receipt fetches pass allowUnpinned so SRI enforce mode
    // (sri === "require") does not block install-time inspection of a dependency.
    expect(backgroundCore).toContain('const body = await fetchRequireScript(url, { allowUnpinned: true });');
    expect(backgroundCore).toContain('async function fetchRequireScriptForTrustReceipt(url)');
    expect(backgroundCore).toContain("fetchRequireScript(url, { bypassCache: true, cacheResult: false, allowUnpinned: true })");
    expect(backgroundCore).toContain('await _receiptDependencyProvenance(bundleUrl, identity, body, fetchProvenanceBundle)');
    expect(backgroundCore).toMatch(/fetchDependencyBody:\s*fetchRequireScriptForTrustReceipt,\s*fetchProvenanceBundle/s);
  });

  it('rejects opted-in provenance failures before saving install or update state', () => {
    expect(backgroundCore).toContain('function _getRequireProvenanceFailure');
    expect(backgroundCore).toContain('@require provenance verification failed for');
    expect(backgroundCore).toMatch(/const provenanceFailure = _getRequireProvenanceFailure\(trustReceipt\);[\s\S]*return \{ error: provenanceFailure\.message \};/);
    expect(backgroundCore).toMatch(/throw new Error\(provenanceFailure\.message\);/);
  });

  it('surfaces unavailable provenance verification as an explicit review state', () => {
    expect(receiptSource).toContain("verification: 'verification-unavailable'");
    expect(receiptSource).toContain('Dependency body unavailable for provenance verification');
    expect(scriptTypes).toContain("'verification-unavailable'");
    expect(backgroundCore).toContain("'verification-unavailable'");
    expect(installPage).toContain('Verification unavailable');
    expect(dashboardPage).toContain('Verification unavailable');
    expect(backgroundCore).not.toContain('not-yet-implemented');
    expect(receiptSource).not.toContain('not-yet-implemented');
    expect(scriptTypes).not.toContain('not-yet-implemented');
  });
});
