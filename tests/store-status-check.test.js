import { describe, expect, it, vi } from 'vitest';
import {
  buildCwsFetchStatusUrl,
  extractReadmeCwsItemId,
  runChecks,
  summarizeFirefoxLint,
} from '../scripts/check-store-status.mjs';

const ROOT = process.cwd();
const CWS_ID = 'jlhdbkeijcbgnonpfkfkkkhfmbeejkgh';

describe('release store status check', () => {
  it('builds the Chrome Web Store API v2 fetchStatus endpoint', () => {
    expect(buildCwsFetchStatusUrl('publisher-123', CWS_ID)).toBe(
      `https://chromewebstore.googleapis.com/v2/publishers/publisher-123/items/${CWS_ID}:fetchStatus`,
    );
  });

  it('extracts the public Chrome Web Store item id from README copy', () => {
    const readme = `Install from https://chromewebstore.google.com/detail/scriptvault/${CWS_ID}`;
    expect(extractReadmeCwsItemId(readme)).toBe(CWS_ID);
  });

  it('passes offline wiring checks without store credentials', async () => {
    const result = await runChecks({
      rootDir: ROOT,
      env: {},
      fetchImpl: vi.fn(),
      skipFirefoxArtifacts: true,
    });

    expect(result.failures).toEqual([]);
    expect(result.cws).toMatchObject({ status: 'skipped', itemId: CWS_ID });
    expect(result.warnings.join('\n')).toContain('CWS fetchStatus live check skipped');
  });

  it('queries and validates live CWS status when credentials are supplied', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({
        itemId: CWS_ID,
        publishedItemRevisionStatus: {
          distributionChannels: [{ crxVersion: '3.11.0', deployPercentage: 100 }],
        },
        takenDown: false,
        warned: false,
      }),
    }));

    const result = await runChecks({
      rootDir: ROOT,
      env: {
        EXTENSION_ID: CWS_ID,
        PUBLISHER_ID: 'publisher-123',
        CWS_ACCESS_TOKEN: 'token',
      },
      fetchImpl,
      skipFirefoxArtifacts: true,
    });

    expect(result.failures).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://chromewebstore.googleapis.com/v2/publishers/publisher-123/items/${CWS_ID}:fetchStatus`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
    expect(result.cws).toMatchObject({
      status: 'checked',
      itemId: CWS_ID,
      publishedVersion: '3.11.0',
      takenDown: false,
      warned: false,
    });
  });

  it('fails when CWS reports a taken-down item', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ itemId: CWS_ID, takenDown: true }),
    }));

    const result = await runChecks({
      rootDir: ROOT,
      env: {
        EXTENSION_ID: CWS_ID,
        PUBLISHER_ID: 'publisher-123',
        CWS_ACCESS_TOKEN: 'token',
      },
      fetchImpl,
      skipFirefoxArtifacts: true,
    });

    expect(result.failures).toContain('CWS item is marked takenDown');
  });

  it('summarizes Firefox web-ext lint reports', () => {
    expect(summarizeFirefoxLint({ summary: { errors: 0, notices: 1, warnings: 140 } })).toEqual({
      errors: 0,
      notices: 1,
      warnings: 140,
    });
  });
});
