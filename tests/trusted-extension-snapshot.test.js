import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardSource = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

describe('trusted-extension support snapshot evidence', () => {
  it('includes trustedExtensionCount in the trust block without raw IDs', () => {
    const snapshotStart = dashboardSource.indexOf("const trustBlock = {}");
    const snapshotEnd = dashboardSource.indexOf("if (Object.keys(trustBlock).length > 0)", snapshotStart);
    const trustSection = dashboardSource.slice(snapshotStart, snapshotEnd);

    expect(trustSection).toContain('trustedExtensionCount');
    expect(trustSection).toContain('extIds.length');
    expect(trustSection).not.toMatch(/trustBlock\.\s*publicApiExtensionIds/);
  });

  it('includes aggregate untrusted_extension denial count and last timestamp', () => {
    const snapshotStart = dashboardSource.indexOf("const trustBlock = {}");
    const snapshotEnd = dashboardSource.indexOf("if (Object.keys(trustBlock).length > 0)", snapshotStart);
    const trustSection = dashboardSource.slice(snapshotStart, snapshotEnd);

    expect(trustSection).toContain('untrustedExtensionDenials');
    expect(trustSection).toContain("'untrusted_extension'");
    expect(trustSection).toContain('lastDeniedAt');
    expect(trustSection).toContain('count');
  });

  it('does not export raw extension IDs in the trust block by default', () => {
    const snapshotStart = dashboardSource.indexOf("const trustBlock = {}");
    const snapshotEnd = dashboardSource.indexOf("if (Object.keys(trustBlock).length > 0)", snapshotStart);
    const trustSection = dashboardSource.slice(snapshotStart, snapshotEnd);

    expect(trustSection).not.toMatch(/trustBlock\.\s*publicApiExtensionIds/);
    expect(trustSection).not.toMatch(/trustBlock\.\s*extensionIds/);
  });
});
