import { describe, expect, it, vi } from 'vitest';
import {
  buildCwsFetchStatusUrl,
  extractReadmeCwsItemId,
  runChecks,
  summarizeCwsRollbackReadiness,
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
    expect(result.cws.rollback).toMatchObject({ ready: null, status: 'live-status-required' });
    expect(result.firefox.rollback).toMatchObject({ ready: false, status: 'not-ready' });
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
      rollback: { ready: null, status: 'confirmation-required' },
    });
  });

  it('reports partial-rollout and pending-submission consequences for a confirmed safe package', () => {
    const rollback = summarizeCwsRollbackReadiness({
      publishedItemRevisionStatus: {
        distributionChannels: [{ crxVersion: '3.20.0', deployPercentage: 25 }],
      },
      submittedItemRevisionStatus: {
        state: 'PENDING_REVIEW',
        distributionChannels: [{ crxVersion: '3.20.1', deployPercentage: 100 }],
      },
      takenDown: false,
    }, {
      previousVersion: '3.19.1',
      storageCompatible: true,
    });

    expect(rollback).toMatchObject({
      ready: true,
      status: 'ready',
      publishedVersion: '3.20.0',
      previousVersion: '3.19.1',
      deployPercentage: 25,
      partialRollout: true,
      pendingSubmission: true,
      submittedVersion: '3.20.1',
      blockers: [],
    });
    expect(rollback.consequences.join('\n')).toContain('last version that reached 100%');
    expect(rollback.consequences.join('\n')).toContain('discards the submitted/staged revision');
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
    expect(result.cws.rollback).toMatchObject({ ready: false, status: 'not-ready' });
  });

  it('summarizes Firefox web-ext lint reports', () => {
    expect(summarizeFirefoxLint({ summary: { errors: 0, notices: 1, warnings: 140 } })).toEqual({
      errors: 0,
      notices: 1,
      warnings: 140,
    });
  });
});
