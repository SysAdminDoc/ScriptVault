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

function _invoke(body) {
  try { const vm = require('node:vm'); return vm.compileFunction(body, [], { filename: resolve(process.cwd(), 'pages/dashboard.js') })(); } catch { return new Function(body)(); }
}

function loadSyncPreviewExportApi() {
  return _invoke(`
    ${extractFunction(dashboardJs, 'sanitizePreviewCount')}
    ${extractFunction(dashboardJs, 'sanitizeSyncPreviewSummary')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleTimestamp')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleLastWriteHint')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleCandidateMergePlan')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleCandidateMergeGate')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleCandidateMergeBlockReason')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleCandidateMergeSimulation')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleConflictPreview')}
    ${extractFunction(dashboardJs, 'buildSyncPreviewExport')}
    return { buildSyncPreviewExport };
  `);
}

function loadValueBundleSyncLogApi() {
  return _invoke(`
    ${extractFunction(dashboardJs, 'formatValueBundleSyncLog')}
    return { formatValueBundleSyncLog };
  `);
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
  'remoteValueBundleMergeSimulationManualReview',
  'remoteValueBundleMergeSimulationManualReviewResultKeyTotal',
  'remoteValueBundleMergeSimulationReadyPreviewOnly',
  'remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal',
  'remoteValueBundleMergeSimulationUnavailable',
  'remoteValueBundleMergeSimulationUnavailableResultKeyTotal',
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
  'candidateMergeSimulation',
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
    expect(dashboardJs).toContain('candidateMergeSimulation');
    expect(dashboardJs).toContain('remote candidate keys');
    expect(dashboardJs).toContain('candidate merge gate');
    expect(dashboardJs).toContain('GM value merge simulation');
    expect(dashboardJs).toContain('GM value merge simulation result keys');
    expect(dashboardJs).toContain('manual review reasons');
    expect(dashboardJs).toContain('candidate result keys');
    expect(dashboardJs).toContain('accepted ready');
    expect(dashboardJs).toContain('preservedCandidateMergeReady');
    expect(dashboardJs).toContain('preservedCandidateBlockedUnknownTimestamp');
    expect(dashboardJs).toContain('clampSyncLogCount');
    expect(dashboardJs).toContain('sanitizePreviewCount');
    expect(dashboardJs).toContain('clampSummaryCount');
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
        remoteValueBundleMergeSimulationReadyPreviewOnly: 1,
        remoteValueBundleMergeSimulationManualReview: 0,
        remoteValueBundleMergeSimulationUnavailable: 0,
        remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal: 3.9,
        remoteValueBundleMergeSimulationManualReviewResultKeyTotal: -4,
        remoteValueBundleMergeSimulationUnavailableResultKeyTotal: 0,
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
        candidateMergeSimulation: 'ready-preview-only',
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
          candidateMergeSimulation: 'ready-preview-only',
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
      remoteValueBundleMergeSimulationReadyPreviewOnly: 1,
      remoteValueBundleMergeSimulationManualReview: 0,
      remoteValueBundleMergeSimulationUnavailable: 0,
      remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal: 3,
      remoteValueBundleMergeSimulationManualReviewResultKeyTotal: 0,
      remoteValueBundleMergeSimulationUnavailableResultKeyTotal: 0,
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

  it('clamps preserved candidate result totals in sync log output', () => {
    const { formatValueBundleSyncLog } = loadValueBundleSyncLogApi();

    const summary = formatValueBundleSyncLog({
      preserved: 1,
      preservedRemoteNewer: 1.9,
      preservedCandidateMergeReady: 1,
      preservedCandidateResultKeyTotal: 4,
      preservedCandidateAutoSelectedKeyTotal: 99,
      preservedCandidateReviewKeyTotal: 99,
      preservedCandidateAcceptedResultKeyTotal: 99,
      preservedCandidateBlockedUnknownTimestamp: -2,
    });

    expect(summary).toContain('candidate result keys: 4 total, 4 auto-selected, 0 review, 4 accepted ready');
    expect(summary).toContain('timestamp hints: 1 remote-newer');
    expect(summary).toContain('0 unknown timestamp');
    expect(summary).not.toContain('99');
    expect(summary).not.toContain('-2');
  });

  it('clamps preserved timestamp summaries to aggregate preserved totals in sync log output', () => {
    const { formatValueBundleSyncLog } = loadValueBundleSyncLogApi();

    const summary = formatValueBundleSyncLog({
      preserved: 3,
      preservedRemoteNewer: 1.9,
      preservedLocalNewer: 1,
      preservedSameTimestamp: 1,
      preservedRemoteTimestampOnly: 99,
      preservedLocalTimestampOnly: 99,
      preservedTimestampUnknown: 99,
      scriptId: 'script_secret',
      name: 'Secret Script',
      values: { token: 'remote-secret' },
      keyMetadata: { token: { updatedAt: 20 } },
    });

    expect(summary).toContain('GM values: 0 applied, 3 preserved, 0 blocked');
    expect(summary).toContain(
      'timestamp hints: 1 remote-newer, 1 local-newer, 1 same, 0 remote-only, 0 local-only, 0 unknown',
    );
    expect(summary).not.toContain('99');
    expect(summary).not.toContain('1.9');
    expect(summary).not.toContain('script_secret');
    expect(summary).not.toContain('Secret Script');
    expect(summary).not.toContain('token');
    expect(summary).not.toContain('remote-secret');
    expect(summary).not.toContain('keyMetadata');
  });

  it('renders unavailable preserved candidate sync logs as aggregate evidence', () => {
    const { formatValueBundleSyncLog } = loadValueBundleSyncLogApi();

    const summary = formatValueBundleSyncLog({
      applied: 0,
      preserved: 1,
      conflictBlocked: 0,
      skippedUnavailable: 0,
      failures: 1,
      preservedTimestampUnknown: 1,
      preservedCandidateMergeUnavailable: 1,
      preservedCandidateResultKeyTotal: 0,
      preservedCandidateAutoSelectedKeyTotal: 0,
      preservedCandidateReviewKeyTotal: 0,
      preservedCandidateAcceptedResultKeyTotal: 0,
      preservedCandidateBlockedUnavailable: 1,
      scriptId: 'script_secret',
      name: 'Secret Script',
      values: { token: 'remote-secret' },
      keyMetadata: { token: { updatedAt: 20 } },
    });

    expect(summary).toContain('GM values: 0 applied, 1 preserved, 0 blocked');
    expect(summary).toContain('0 unavailable, 1 failed');
    expect(summary).toContain(
      'timestamp hints: 0 remote-newer, 0 local-newer, 0 same, 0 remote-only, 0 local-only, 1 unknown',
    );
    expect(summary).toContain('candidate gates: 0 ready, 0 manual review, 1 unavailable');
    expect(summary).toContain(
      'candidate result keys: 0 total, 0 auto-selected, 0 review, 0 accepted ready',
    );
    expect(summary).toContain(
      'candidate review reasons: 0 same timestamp, 0 unknown timestamp, 0 one-sided timestamp, 1 unavailable local snapshot, 0 no candidate keys',
    );
    expect(summary).not.toContain('script_secret');
    expect(summary).not.toContain('Secret Script');
    expect(summary).not.toContain('token');
    expect(summary).not.toContain('remote-secret');
    expect(summary).not.toContain('keyMetadata');
  });

  it('sanitizes failure-only GM value sync log counts', () => {
    const { formatValueBundleSyncLog } = loadValueBundleSyncLogApi();

    const summary = formatValueBundleSyncLog({
      applied: -4,
      preserved: 0,
      conflictBlocked: -3,
      skippedNonEmpty: 99,
      skippedUserModified: 99,
      skippedUnavailable: 1.9,
      failures: 2.8,
      scriptId: 'script_secret',
      values: { token: 'remote-secret' },
    });

    expect(summary).toContain('GM values: 0 applied, 0 preserved, 0 blocked');
    expect(summary).toContain('1 unavailable, 2 failed');
    expect(summary).not.toContain('99');
    expect(summary).not.toContain('-4');
    expect(summary).not.toContain('2.8');
    expect(summary).not.toContain('script_secret');
    expect(summary).not.toContain('token');
    expect(summary).not.toContain('remote-secret');
    expect(formatValueBundleSyncLog({ failures: -1, skippedUnavailable: -1 })).toBe('');
  });

  it('renders write-failure preserved candidate sync logs as aggregate evidence', () => {
    const { formatValueBundleSyncLog } = loadValueBundleSyncLogApi();

    const summary = formatValueBundleSyncLog({
      applied: 0,
      preserved: 1,
      conflictBlocked: 0,
      skippedUnavailable: 0,
      failures: 1,
      writeFailureRetryReady: 1,
      preservedTimestampUnknown: 1,
      preservedCandidateMergeReady: 1,
      preservedCandidateResultKeyTotal: 1,
      preservedCandidateAutoSelectedKeyTotal: 1,
      preservedCandidateReviewKeyTotal: 0,
      preservedCandidateAcceptedResultKeyTotal: 1,
      scriptId: 'script_secret',
      name: 'Secret Script',
      values: { token: 'remote-secret' },
      keyMetadata: { token: { updatedAt: 20 } },
    });

    expect(summary).toContain('GM values: 0 applied, 1 preserved, 0 blocked');
    expect(summary).toContain('0 unavailable, 1 failed');
    expect(summary).toContain('timestamp hints: 0 remote-newer');
    expect(summary).toContain('1 unknown');
    expect(summary).toContain('candidate gates: 1 ready, 0 manual review, 0 unavailable');
    expect(summary).toContain(
      'candidate result keys: 1 total, 1 auto-selected, 0 review, 1 accepted ready',
    );
    expect(summary).toContain('retry diagnostics: 1 write retry-ready');
    expect(summary).not.toContain('script_secret');
    expect(summary).not.toContain('Secret Script');
    expect(summary).not.toContain('token');
    expect(summary).not.toContain('remote-secret');
    expect(summary).not.toContain('keyMetadata');
  });

  it('clamps write-failure retry diagnostics in sync log output', () => {
    const { formatValueBundleSyncLog } = loadValueBundleSyncLogApi();

    const summary = formatValueBundleSyncLog({
      preserved: 1,
      failures: 2,
      writeFailureRetryReady: 99,
      scriptId: 'script_secret',
      values: { token: 'remote-secret' },
    });

    expect(summary).toContain('0 unavailable, 2 failed');
    expect(summary).toContain('retry diagnostics: 1 write retry-ready');
    expect(summary).not.toContain('99');
    expect(summary).not.toContain('script_secret');
    expect(summary).not.toContain('token');
    expect(summary).not.toContain('remote-secret');
  });

  it('clamps candidate merge result summaries to aggregate result totals', () => {
    const { buildSyncPreviewExport } = loadSyncPreviewExportApi();

    const exported = buildSyncPreviewExport({
      provider: 'googledrive',
      providerLabel: 'Google Drive',
      dryRun: true,
      noWrites: true,
      summary: {
        remoteValueBundleCandidateResultKeyTotal: 4,
        remoteValueBundleCandidateAutoSelectedKeyTotal: 99,
        remoteValueBundleCandidateReviewKeyTotal: 99,
        remoteValueBundleCandidateAcceptedResultKeyTotal: 99,
        remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal: 99,
        remoteValueBundleMergeSimulationManualReviewResultKeyTotal: 99,
        remoteValueBundleMergeSimulationUnavailableResultKeyTotal: 99,
      },
      valueBundleConflicts: [],
    });

    expect(exported.summary).toEqual(expect.objectContaining({
      remoteValueBundleCandidateResultKeyTotal: 4,
      remoteValueBundleCandidateAutoSelectedKeyTotal: 4,
      remoteValueBundleCandidateReviewKeyTotal: 0,
      remoteValueBundleCandidateAcceptedResultKeyTotal: 4,
      remoteValueBundleMergeSimulationReadyPreviewOnlyResultKeyTotal: 4,
      remoteValueBundleMergeSimulationManualReviewResultKeyTotal: 0,
      remoteValueBundleMergeSimulationUnavailableResultKeyTotal: 0,
    }));
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
        candidateMergeSimulation: 'manual-review',
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
