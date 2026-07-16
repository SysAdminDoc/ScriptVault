import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const privacy = read('PRIVACY.md');

// Regression guard for the data-flow disclosures required by CWS Limited Use /
// Disclosure (enforced 2026-08-01) and AMO. These were corrected in the v3.20.0
// disclosure pass; this test keeps them from silently drifting back.
describe('privacy disclosure completeness', () => {
  it('discloses every local storage surface, including Storage Buckets', () => {
    expect(privacy).toMatch(/Storage Bucket/i);
    expect(privacy).toMatch(/IndexedDB/);
    // The canonical IndexedDB stores must be enumerated.
    for (const store of ['scripts', 'values', 'stats', 'backups', 'localWorkspaceBindings']) {
      expect(privacy).toContain(store);
    }
    expect(privacy).toMatch(/chrome\.storage\.local/);
  });

  it('discloses every opt-in sync/backup egress destination', () => {
    for (const dest of ['WebDAV', 'Google Drive', 'Dropbox', 'OneDrive', 'S3']) {
      expect(privacy).toContain(dest);
    }
  });

  it('discloses discovery/publishing and installed-script egress paths', () => {
    expect(privacy).toMatch(/Greasy Fork/i);
    expect(privacy).toMatch(/Gist/i);
    expect(privacy).toMatch(/Installed-Script Network Egress/i);
    expect(privacy).toMatch(/GM_xmlhttpRequest/);
  });

  it('states the zero-telemetry position unambiguously', () => {
    expect(privacy).toMatch(/no developer-operated analytics or telemetry/i);
  });

  it('discloses the execution-URL retention control and its irreversibility', () => {
    expect(privacy).toMatch(/execution URL retention/i);
    expect(privacy).toMatch(/not recoverable/i);
  });
});
