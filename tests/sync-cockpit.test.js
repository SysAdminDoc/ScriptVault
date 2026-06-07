import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const gistJs = readFileSync(resolve(process.cwd(), 'pages/dashboard-gist.js'), 'utf8');

function extractFunction(source, name) {
  const marker = source.indexOf(`function ${name}`);
  if (marker < 0) throw new Error(`Function ${name} not found`);
  const brace = source.indexOf('{', marker);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(marker, i + 1);
  }
  throw new Error(`Function ${name} did not close`);
}

function loadSyncPreviewExportApi() {
  return new Function(`
    ${extractFunction(dashboardJs, 'sanitizePreviewCount')}
    ${extractFunction(dashboardJs, 'sanitizeSyncPreviewSummary')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleTimestamp')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleLastWriteHint')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleCandidateMergePlan')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleCandidateMergeGate')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleCandidateMergeBlockReason')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleConflictPreview')}
    ${extractFunction(dashboardJs, 'buildSyncPreviewExport')}
    return { buildSyncPreviewExport };
  `)();
}

const SYNC_PREVIEW_EXPORT_TOP_LEVEL_KEYS = [
  'dryRun',
  'exportedAt',
  'noWrites',
  'provider',
  'providerLabel',
  'remoteFound',
  'schema',
  'summary',
  'valueBundleConflicts',
].sort();

const SYNC_PREVIEW_EXPORT_SUMMARY_KEYS = [
  'conflicts',
  'localNewer',
  'localOnly',
  'localScripts',
  'localValueBundles',
  'localValueBundlesMissingTimestamps',
  'localValueBundlesNewerThanLastSync',
  'localValueBundlesOlderThanLastSync',
  'localValueBundlesWithTimestamps',
  'localValueOptIns',
  'remoteNewer',
  'remoteOnly',
  'remoteScripts',
  'remoteValueBundleCandidateAcceptedResultKeyTotal',
  'remoteValueBundleCandidateAutoSelectedKeyTotal',
  'remoteValueBundleCandidateMergesBlockedNoCandidateKeys',
  'remoteValueBundleCandidateMergesBlockedOneSidedTimestamp',
  'remoteValueBundleCandidateMergesBlockedSameTimestamp',
  'remoteValueBundleCandidateMergesBlockedUnavailable',
  'remoteValueBundleCandidateMergesBlockedUnknownTimestamp',
  'remoteValueBundleCandidateMergesManualReview',
  'remoteValueBundleCandidateMergesReady',
  'remoteValueBundleCandidateMergesUnavailable',
  'remoteValueBundleCandidateResultKeyTotal',
  'remoteValueBundleCandidateReviewKeyTotal',
  'remoteValueBundleWarnings',
  'remoteValueBundles',
  'remoteValueBundlesApplicable',
  'remoteValueBundlesApplyReady',
  'remoteValueBundlesConflictBlocked',
  'remoteValueBundlesIgnored',
  'remoteValueBundlesMissingTimestamps',
  'remoteValueBundlesNewerThanLastSync',
  'remoteValueBundlesOlderThanLastSync',
  'remoteValueBundlesWithTimestamps',
  'tombstoned',
  'unchanged',
  'valueBundleApplyEnabled',
  'valueBundleApplyMode',
  'valueBundleWarnings',
  'wouldApplyValues',
  'wouldDownload',
  'wouldUpload',
  'wouldUploadValues',
].sort();

const SYNC_PREVIEW_EXPORT_VALUE_BUNDLE_CONFLICT_KEYS = [
  'candidateAutoSelectedKeyCount',
  'candidateLocalKeyCount',
  'candidateManualKeyCount',
  'candidateMergeBlockReason',
  'candidateMergeGate',
  'candidateMergePlan',
  'candidateOneSidedTimestampKeyCount',
  'candidateRemoteKeyCount',
  'candidateResultKeyCount',
  'candidateReviewKeyCount',
  'candidateSameTimestampKeyCount',
  'lastWriteHint',
  'localBytes',
  'localKeyCount',
  'localLastValueUpdatedAt',
  'localOnlyKeyCount',
  'overlappingKeyCount',
  'overlappingLocalNewerKeyCount',
  'overlappingLocalTimestampOnlyKeyCount',
  'overlappingRemoteNewerKeyCount',
  'overlappingRemoteTimestampOnlyKeyCount',
  'overlappingSameTimestampKeyCount',
  'overlappingUnknownTimestampKeyCount',
  'reason',
  'remoteBytes',
  'remoteKeyCount',
  'remoteLastValueUpdatedAt',
  'remoteOnlyKeyCount',
].sort();

describe('sync safety cockpit wiring', () => {
  it('exposes dashboard health, revoke, and dry-run preview controls', () => {
    expect(dashboardHtml).toContain('id="syncHealthStatus"');
    expect(dashboardHtml).toContain('id="syncStorageDisclosure"');
    expect(dashboardHtml).toContain('id="syncPreviewSummary"');
    expect(dashboardHtml).toContain('id="btnSyncCheckHealth"');
    expect(dashboardHtml).toContain('id="btnSyncPreview"');
    expect(dashboardHtml).toContain('id="btnSyncPreviewDownload"');
    expect(dashboardHtml).toContain('id="btnSyncRevoke"');

    expect(dashboardJs).toContain("action: 'syncProviderHealth'");
    expect(dashboardJs).toContain("action: 'syncDryRunPreview'");
    expect(dashboardJs).toContain("action: 'revokeSyncProvider'");
    expect(dashboardJs).toContain('summarizeSyncDisclosure');
    expect(dashboardJs).toContain('renderSyncPreview');
    expect(dashboardJs).toContain('formatValueBundleSyncLog');
    expect(dashboardJs).toContain('skippedNonEmpty');
    expect(dashboardJs).toContain('skippedUserModified');
    expect(dashboardJs).toContain('formatValueBundleConflictReason');
    expect(dashboardJs).toContain('formatValueBundleLastWriteHint');
    expect(dashboardJs).toContain('GM value blocked merge preview');
    expect(dashboardJs).toContain('buildSyncPreviewExport');
    expect(dashboardJs).toContain('scriptvault-sync-preview/v1');
    expect(dashboardJs).toContain('valueBundleSync');
    expect(dashboardJs).toContain('valueBundleConflicts');
    expect(dashboardJs).toContain('lastWriteHint');
    expect(dashboardJs).toContain('preservedRemoteNewer');
    expect(dashboardJs).toContain('timestamp hints');
    expect(dashboardJs).toContain('overlappingRemoteNewerKeyCount');
    expect(dashboardJs).toContain('overlap timestamps');
    expect(dashboardJs).toContain('localValueBundlesWithTimestamps');
    expect(dashboardJs).toContain('GM value timestamps');
    expect(dashboardJs).toContain('candidateMergePlan');
    expect(dashboardJs).toContain('candidateMergeGate');
    expect(dashboardJs).toContain('remote candidate keys');
    expect(dashboardJs).toContain('candidate merge gate');
    expect(dashboardJs).toContain('manual review reasons');
    expect(dashboardJs).toContain('candidate result keys');
    expect(dashboardJs).toContain('accepted ready');
    expect(dashboardJs).toContain('preservedCandidateMergeReady');
    expect(dashboardJs).toContain('preservedCandidateBlockedUnknownTimestamp');
    expect(dashboardJs).toContain('sanitizePreviewCount');
  });

  it('routes provider health and dry-run actions through background without writes', () => {
    expect(backgroundCore).toContain('async function buildSyncProviderHealth');
    expect(backgroundCore).toContain("case 'syncProviderHealth'");
    expect(backgroundCore).toContain("case 'syncDryRunPreview'");
    expect(backgroundCore).toContain('previewData(local, remote, options = {})');
    expect(backgroundCore).toContain('dryRun: true');
    expect(backgroundCore).toContain('noWrites: true');
  });

  it('exports sync previews without script identifiers, value keys, or values', () => {
    const { buildSyncPreviewExport } = loadSyncPreviewExportApi();

    const exported = buildSyncPreviewExport({
      success: true,
      dryRun: true,
      noWrites: true,
      provider: 'googledrive',
      providerLabel: 'Google Drive',
      remoteFound: true,
      summary: {
        localScripts: 1,
        remoteScripts: 1,
        conflicts: 1,
        remoteValueBundlesConflictBlocked: 1,
        valueBundleApplyEnabled: true,
        valueBundleApplyMode: 'empty-local-only',
        localValueBundlesWithTimestamps: 1,
        localValueBundlesMissingTimestamps: 0,
        remoteValueBundlesWithTimestamps: 1,
        remoteValueBundlesMissingTimestamps: 0,
        remoteValueBundleCandidateMergesReady: 1,
        remoteValueBundleCandidateMergesManualReview: 0,
        remoteValueBundleCandidateMergesUnavailable: 0,
        remoteValueBundleCandidateMergesBlockedSameTimestamp: 0,
        remoteValueBundleCandidateMergesBlockedUnknownTimestamp: 0,
        remoteValueBundleCandidateMergesBlockedOneSidedTimestamp: 0,
        remoteValueBundleCandidateMergesBlockedUnavailable: 0,
        remoteValueBundleCandidateMergesBlockedNoCandidateKeys: 0,
        remoteValueBundleCandidateResultKeyTotal: 3.9,
        remoteValueBundleCandidateAutoSelectedKeyTotal: 3.2,
        remoteValueBundleCandidateReviewKeyTotal: -8,
        remoteValueBundleCandidateAcceptedResultKeyTotal: 3.6,
        wouldUpload: true,
        leakedName: 'Secret Script',
      },
      conflicts: [{ id: 'script_secret', name: 'Secret Script' }],
      valueBundleConflicts: [{
        reason: 'local-values-present',
        localKeyCount: 1.9,
        remoteKeyCount: 1.2,
        localBytes: 111.9,
        remoteBytes: 222.4,
        overlappingKeyCount: 1,
        localOnlyKeyCount: 0,
        remoteOnlyKeyCount: 0,
        localLastValueUpdatedAt: 1000.9,
        remoteLastValueUpdatedAt: 2000.1,
        lastWriteHint: 'remote-newer',
        overlappingRemoteNewerKeyCount: 1,
        overlappingLocalNewerKeyCount: 0,
        overlappingSameTimestampKeyCount: 0,
        overlappingRemoteTimestampOnlyKeyCount: 0,
        overlappingLocalTimestampOnlyKeyCount: 0,
        overlappingUnknownTimestampKeyCount: 0,
        candidateMergePlan: 'timestamp-guided',
        candidateRemoteKeyCount: 2,
        candidateLocalKeyCount: 1,
        candidateSameTimestampKeyCount: 0,
        candidateManualKeyCount: 0,
        candidateOneSidedTimestampKeyCount: 0,
        candidateResultKeyCount: 3.9,
        candidateAutoSelectedKeyCount: 3.2,
        candidateReviewKeyCount: -8,
        candidateMergeGate: 'ready',
        candidateMergeBlockReason: 'none',
        keyMetadata: {
          token: { updatedAt: 2000 },
        },
        scriptId: 'script_secret',
        key: 'token',
        values: { token: 'remote-secret' },
      }],
    });

    expect(exported).toEqual(
      expect.objectContaining({
        schema: 'scriptvault-sync-preview/v1',
        provider: 'googledrive',
        providerLabel: 'Google Drive',
        dryRun: true,
        noWrites: true,
        remoteFound: true,
        valueBundleConflicts: [{
          reason: 'local-values-present',
          localKeyCount: 1,
          remoteKeyCount: 1,
          localBytes: 111,
          remoteBytes: 222,
          overlappingKeyCount: 1,
          localOnlyKeyCount: 0,
          remoteOnlyKeyCount: 0,
          localLastValueUpdatedAt: 1000,
          remoteLastValueUpdatedAt: 2000,
          lastWriteHint: 'remote-newer',
          overlappingRemoteNewerKeyCount: 1,
          overlappingLocalNewerKeyCount: 0,
          overlappingSameTimestampKeyCount: 0,
          overlappingRemoteTimestampOnlyKeyCount: 0,
          overlappingLocalTimestampOnlyKeyCount: 0,
          overlappingUnknownTimestampKeyCount: 0,
          candidateMergePlan: 'timestamp-guided',
          candidateRemoteKeyCount: 2,
          candidateLocalKeyCount: 1,
          candidateSameTimestampKeyCount: 0,
          candidateManualKeyCount: 0,
          candidateOneSidedTimestampKeyCount: 0,
          candidateResultKeyCount: 3,
          candidateAutoSelectedKeyCount: 3,
          candidateReviewKeyCount: 0,
          candidateMergeGate: 'ready',
          candidateMergeBlockReason: 'none',
        }],
      }),
    );
    expect(exported.summary).toEqual(expect.objectContaining({
      conflicts: 1,
      remoteValueBundlesConflictBlocked: 1,
      valueBundleApplyEnabled: true,
      valueBundleApplyMode: 'empty-local-only',
      localValueBundlesWithTimestamps: 1,
      remoteValueBundlesWithTimestamps: 1,
      remoteValueBundleCandidateMergesReady: 1,
      remoteValueBundleCandidateMergesManualReview: 0,
      remoteValueBundleCandidateMergesUnavailable: 0,
      remoteValueBundleCandidateMergesBlockedSameTimestamp: 0,
      remoteValueBundleCandidateMergesBlockedUnknownTimestamp: 0,
      remoteValueBundleCandidateMergesBlockedOneSidedTimestamp: 0,
      remoteValueBundleCandidateMergesBlockedUnavailable: 0,
      remoteValueBundleCandidateMergesBlockedNoCandidateKeys: 0,
      remoteValueBundleCandidateResultKeyTotal: 3,
      remoteValueBundleCandidateAutoSelectedKeyTotal: 3,
      remoteValueBundleCandidateReviewKeyTotal: 0,
      remoteValueBundleCandidateAcceptedResultKeyTotal: 3,
      wouldUpload: true,
    }));
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain('script_secret');
    expect(serialized).not.toContain('Secret Script');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('remote-secret');
    expect(serialized).not.toContain('keyMetadata');
  });

  it('pins sanitized sync preview export schema to aggregate-only fields', () => {
    const { buildSyncPreviewExport } = loadSyncPreviewExportApi();

    const exported = buildSyncPreviewExport({
      provider: 'webdav',
      providerLabel: 'WebDAV',
      dryRun: true,
      noWrites: true,
      remoteFound: true,
      leakedTopLevel: 'top-secret',
      summary: {
        localScripts: 1,
        conflicts: 1,
        valueBundleApplyEnabled: true,
        leakedSummary: 'script_secret',
      },
      valueBundleConflicts: [{
        reason: 'local-values-present',
        localKeyCount: 1,
        remoteKeyCount: 1,
        candidateMergeGate: 'manual-review',
        candidateMergeBlockReason: 'unknown-timestamp',
        scriptId: 'script_secret',
        key: 'token',
        values: { token: 'secret' },
      }],
    });

    expect(Object.keys(exported).sort()).toEqual(SYNC_PREVIEW_EXPORT_TOP_LEVEL_KEYS);
    expect(Object.keys(exported.summary).sort()).toEqual(SYNC_PREVIEW_EXPORT_SUMMARY_KEYS);
    expect(Object.keys(exported.valueBundleConflicts[0]).sort())
      .toEqual(SYNC_PREVIEW_EXPORT_VALUE_BUNDLE_CONFLICT_KEYS);
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain('top-secret');
    expect(serialized).not.toContain('script_secret');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
  });

  it('keeps Gist token storage disclosure honest', () => {
    expect(gistJs).toContain('Uses a GitHub Personal Access Token stored in chrome.storage.local.');
    expect(gistJs).toContain('Token storage: gist_pat in chrome.storage.local.');
    expect(gistJs).toContain('revoke the token itself in GitHub settings');
    expect(gistJs).not.toContain('stored encrypted in chrome.storage.local');
  });
});
