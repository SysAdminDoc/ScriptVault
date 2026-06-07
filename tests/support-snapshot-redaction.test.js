import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const dashboardJs = readFileSync(resolve(repoRoot, 'pages/dashboard.js'), 'utf8');
const dashboardHtml = readFileSync(resolve(repoRoot, 'pages/dashboard.html'), 'utf8');
const dashboardCss = readFileSync(resolve(repoRoot, 'pages/dashboard.css'), 'utf8');

/**
 * Support snapshot redaction preview contract.
 *
 * The previous exportSupportSnapshot dumped script names, URLs, error log,
 * recent network log, and denied hosts to a JSON file with no opt-out. The
 * redaction preview gates each sensitive category behind a checkbox that
 * defaults to OFF; safe categories default to ON; runtime + counts are
 * always included. The exported bundle now records which categories were
 * included so a reviewer can see what was redacted.
 *
 * These tests pin the schema, the modal flow, and the per-category
 * conditional fetch wiring at the source level. A full DOM-driven flow
 * would need the entire dashboard bootstrap, which is too heavyweight for
 * a unit test; the regression catches the most common reversion (someone
 * dropping a `enabledCategories.has(...)` guard).
 */

describe('SNAPSHOT_CATEGORIES inventory', () => {
  it('lists every category mentioned by the prior plan as sensitive', () => {
    // The categories the prior plan flagged as sensitive: scripts, error log,
    // network log, denied hosts, public API audit, public API permissions,
    // activity log. Pin each by id so a future refactor that renames an id
    // surfaces in CI.
    const required = ['scriptInventory', 'activityLog', 'errorLog', 'networkLog', 'deniedHosts', 'publicApiAudit', 'publicApiPermissions'];
    for (const id of required) {
      const pattern = new RegExp(`id:\\s*'${id}'[\\s\\S]{0,500}sensitive:\\s*true`);
      expect(dashboardJs).toMatch(pattern);
    }
  });

  it('marks runtime + counts as always-on', () => {
    expect(dashboardJs).toMatch(/id:\s*'runtime'[\s\S]{0,300}alwaysOn:\s*true/);
    expect(dashboardJs).toMatch(/id:\s*'counts'[\s\S]{0,300}alwaysOn:\s*true/);
  });

  it('marks backupInventory + syncSummary + recoverySchedule + trustedSigningKeys as default-on but optional', () => {
    for (const id of ['backupInventory', 'syncSummary', 'recoverySchedule', 'trustedSigningKeys']) {
      const block = dashboardJs.match(new RegExp(`id:\\s*'${id}'[\\s\\S]{0,500}\\}`));
      expect(block).toBeTruthy();
      expect(block[0]).toMatch(/default:\s*true/);
      expect(block[0]).not.toMatch(/alwaysOn:\s*true/);
    }
  });
});

describe('exportSupportSnapshot modal flow', () => {
  it('opens a modal instead of downloading immediately', () => {
    // The new flow calls showModal('Export support snapshot', ...) — pin
    // that title so a future refactor that bypasses the modal is caught.
    expect(dashboardJs).toMatch(/showModal\('Export support snapshot'/);
    expect(dashboardJs).toMatch(/data-snapshot-category/);
  });

  it('the modal has a primary "Export selected" button', () => {
    expect(dashboardJs).toMatch(/label:\s*'Export selected'/);
  });

  it('always-on categories are forced into the enabled set before download', () => {
    // Even if the markup loses the `disabled` attribute, the JS must add
    // runtime + counts back into the checked set before calling
    // buildAndDownloadSupportSnapshot.
    expect(dashboardJs).toMatch(/for \(const c of SNAPSHOT_CATEGORIES\) \{[\s\S]{0,150}if \(c\.alwaysOn\) checked\.add\(c\.id\);/);
  });

  it('builder skips fetches for opted-out categories', () => {
    // Network log fetches are gated on enabledCategories.has('networkLog');
    // similarly for errorLog, trustedSigningKeys, publicApi, backups.
    expect(dashboardJs).toMatch(/enabledCategories\.has\('errorLog'\)\s*\?\s*chrome\.runtime\.sendMessage\(\{ action: 'getErrorLog' \}\)/);
    expect(dashboardJs).toMatch(/enabledCategories\.has\('networkLog'\)\s*\?\s*chrome\.runtime\.sendMessage\(\{ action: 'getNetworkLog' \}\)/);
    expect(dashboardJs).toMatch(/enabledCategories\.has\('trustedSigningKeys'\)\s*\?\s*chrome\.runtime\.sendMessage\(\{ action: 'signing_getTrustedKeys' \}\)/);
    expect(dashboardJs).toMatch(/enabledCategories\.has\('backupInventory'\)\s*\?\s*chrome\.runtime\.sendMessage\(\{ action: 'getBackups' \}\)/);
  });

  it('snapshot schema records includedCategories + excludedCategories', () => {
    expect(dashboardJs).toMatch(/redactionProfile:\s*\{/);
    expect(dashboardJs).toMatch(/includedCategories:\s*SNAPSHOT_CATEGORIES/);
    expect(dashboardJs).toMatch(/excludedCategories:\s*SNAPSHOT_CATEGORIES/);
    expect(dashboardJs).toMatch(/schema:\s*'scriptvault-support-snapshot\/v2'/);
  });

  it('script inventory only attached when scriptInventory is enabled', () => {
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('scriptInventory'\)\) \{[\s\S]{0,400}snapshot\.scripts/);
  });

  it('background runner dry runs are gated by scriptInventory and omit wrapper code', () => {
    expect(dashboardJs).toContain('async function collectBackgroundRunnerDryRuns()');
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('scriptInventory'\)\) \{[\s\S]{0,1100}snapshot\.backgroundRunnerDryRuns = await collectBackgroundRunnerDryRuns\(\);/);
    expect(dashboardJs).toContain("action: 'prepareBackgroundRunnerDryRun'");
    expect(dashboardJs).toContain('includesCode: false');
    expect(dashboardJs).not.toMatch(/backgroundRunnerDryRuns[\s\S]{0,900}\bcode\b/);
  });

  it('local workspace health is stripped unless script inventory is enabled', () => {
    expect(dashboardJs).toContain('function sanitizeLocalHealthForSupportSnapshot(report, options = {})');
    expect(dashboardJs).toContain('delete sanitized.localWorkspace');
    expect(dashboardJs).toMatch(/includeLocalWorkspace:\s*enabledCategories\.has\('scriptInventory'\)/);
    expect(dashboardJs).toContain('includesFileHandles: false');
    expect(dashboardJs).toContain('includesLocalPaths: false');
  });

  it('GM value sync health is allowlisted before support snapshot export', () => {
    const block = dashboardJs.match(/function sanitizeGmValueSyncForSupportSnapshot\(gmValueSync\) \{[\s\S]*?function sanitizeLocalHealthForSupportSnapshot/);
    const lastResultBlock = dashboardJs.match(/function sanitizeGmValueSyncLastResultForSupportSnapshot\(lastResult\) \{[\s\S]*?function sanitizeGmValueSyncForSupportSnapshot/);
    expect(block).toBeTruthy();
    expect(lastResultBlock).toBeTruthy();
    expect(dashboardJs).toContain('function sanitizeGmValueSyncLastResultForSupportSnapshot(lastResult)');
    expect(dashboardJs).toContain('function sanitizeGmValueSyncWarningCountsForSupportSnapshot(warningCounts)');
    expect(dashboardJs).toContain('function sanitizeGmValueSyncRetryResolutionForSupportSnapshot(retryResolution)');
    expect(dashboardJs).toContain('function sanitizeGmValueSyncRetryHistoryForSupportSnapshot(retryHistory)');
    expect(dashboardJs).toContain('const allowedWarningIds = new Set([');
    expect(dashboardJs).toContain('if (!Number.isFinite(count)) return 0;');
    expect(dashboardJs).toContain('sanitizeGmValueSyncForSupportSnapshot(report.gmValueSync)');
    expect(block[0]).toContain("schema: 'scriptvault-gm-value-sync/v1'");
    expect(lastResultBlock[0]).toContain("schema: 'scriptvault-gm-value-sync-result/v1'");
    expect(lastResultBlock[0]).toContain('const writeFailureRetryReady = Math.min(');
    expect(lastResultBlock[0]).toContain('retryAgeMinutes');
    expect(lastResultBlock[0]).toContain('retryAgeBucket');
    expect(lastResultBlock[0]).toContain("retryAgeBucket: writeFailureRetryReady > 0");
    expect(dashboardJs).toContain('function sanitizeGmValueRetryAgeBucketForSupportSnapshot(value)');
    expect(block[0]).not.toContain('...gmValueSync');
    expect(lastResultBlock[0]).not.toContain('...lastResult');
    expect(`${block[0]}\n${lastResultBlock[0]}`).not.toMatch(/scriptId|scriptName|valueKeyName|providerAccount|credential|rawKeyMetadata|error:/);
  });

  it('GM value sync retry resolution is summarized before support snapshot export', () => {
    const resolutionBlock = dashboardJs.match(/function sanitizeGmValueSyncRetryResolutionForSupportSnapshot\(retryResolution\) \{[\s\S]*?function sanitizeGmValueSyncRetryHistoryForSupportSnapshot/);
    expect(resolutionBlock).toBeTruthy();
    expect(resolutionBlock[0]).toContain("schema: 'scriptvault-gm-value-sync-retry-resolution/v1'");
    expect(resolutionBlock[0]).toContain('priorRetryReadyEntries');
    expect(resolutionBlock[0]).toContain('priorRetryReadyWrites');
    expect(resolutionBlock[0]).toContain('latestRetryTimestamp');
    expect(resolutionBlock[0]).toContain('resolutionAgeBucket');
    expect(resolutionBlock[0]).not.toMatch(/scriptId|scriptName|valueKeyName|providerAccount|credential|rawKeyMetadata|error:/);
  });

  it('GM value sync retry history is summarized before support snapshot export', () => {
    const historyBlock = dashboardJs.match(/function sanitizeGmValueSyncRetryHistoryForSupportSnapshot\(retryHistory\) \{[\s\S]*?function sanitizeGmValueSyncLastResultForSupportSnapshot/);
    expect(historyBlock).toBeTruthy();
    expect(historyBlock[0]).toContain("schema: 'scriptvault-gm-value-sync-retry-history/v1'");
    expect(historyBlock[0]).toContain('retentionDays');
    expect(historyBlock[0]).toContain('staleEntriesPruned');
    expect(historyBlock[0]).toContain('totalWriteFailureRetryReady');
    expect(historyBlock[0]).toContain('latestTimestamp');
    expect(historyBlock[0]).toContain('oldestTimestamp');
    expect(historyBlock[0]).not.toMatch(/scriptId|scriptName|valueKeyName|providerAccount|credential|rawKeyMetadata|error:/);
  });

  it('support summary surfaces only aggregate GM value sync retry health', () => {
    const summaryBlock = dashboardJs.match(/function formatSupportSnapshotGmValueSummary\(localHealthReport\) \{[\s\S]*?function updateSupportSnapshotSummary/);
    expect(summaryBlock).toBeTruthy();
    expect(dashboardJs).toContain('localHealthReport: null');
    expect(dashboardJs).toContain('loadLocalHealthReport()');
    expect(dashboardJs).toContain("chrome.runtime.sendMessage({ action: 'getLocalHealthReport' })");
    expect(dashboardJs).toContain('formatSupportSnapshotGmValueSummary(state.trustCenter.localHealthReport)');
    expect(dashboardJs).toMatch(/state\.trustCenter\.localHealthReport\s*=\s*localHealthReport\?\.schema === 'scriptvault-local-health\/v1'/);
    expect(summaryBlock[0]).toContain('writeFailureRetryReady');
    expect(summaryBlock[0]).toContain('retry-ready preserved write');
    expect(summaryBlock[0]).toContain('formatGmValueRetryAgeBucket');
    expect(summaryBlock[0]).toContain('retryResolution');
    expect(summaryBlock[0]).toContain('retry resolution');
    expect(summaryBlock[0]).toContain('retryHistory');
    expect(summaryBlock[0]).toContain('staleEntriesPruned');
    expect(summaryBlock[0]).toContain('warningCounts');
    expect(summaryBlock[0]).not.toMatch(/scriptId|scriptName|valueKeyName|providerAccount|credential|rawKeyMetadata|error:/);
  });

  it('managed policy health stays aggregate when always included', () => {
    expect(dashboardJs).toMatch(/localHealth:\s*sanitizeLocalHealthForSupportSnapshot\(localHealthReport/);
    expect(dashboardJs).not.toMatch(/managedPolicy[\s\S]{0,500}managedOriginKey/);
    expect(dashboardJs).not.toMatch(/managedPolicy[\s\S]{0,500}managedScripts/);
  });

  it('script inventory omits local workspace handles and absolute paths', () => {
    const block = dashboardJs.match(/snapshot\.scripts = state\.scripts\.map\(script => \{[\s\S]*?\n\s*\}\);/);
    expect(block).toBeTruthy();
    expect(block[0]).not.toMatch(/localWorkspace|localFile|absolutePath|FileSystemFileHandle|\bhandle\b/);
  });

  it('diagnostics block conditionally attaches activity/error/network', () => {
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('activityLog'\)\) diagnosticsBlock\.activityLog/);
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('errorLog'\)\) \{[\s\S]{0,150}diagnosticsBlock\.errorLog/);
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('networkLog'\)\) \{[\s\S]{0,200}diagnosticsBlock\.recentNetworkLog/);
  });

  it('trust block conditionally attaches deniedHosts + publicApi sub-fields', () => {
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('deniedHosts'\)\) \{[\s\S]{0,150}trustBlock\.deniedHosts/);
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('publicApiAudit'\)\) \{[\s\S]{0,150}trustBlock\.publicApiAudit/);
    expect(dashboardJs).toMatch(/if \(enabledCategories\.has\('publicApiPermissions'\)\) \{[\s\S]{0,200}trustBlock\.publicApiOrigins/);
  });
});

describe('support snapshot copy and styling', () => {
  it('HTML support section describes opt-in redaction', () => {
    expect(dashboardHtml).toMatch(/Sensitive categories[^.]*default to OFF/i);
    expect(dashboardHtml).toMatch(/Export Snapshot/);
  });

  it('CSS ships the snapshot-redaction modal styles', () => {
    expect(dashboardCss).toMatch(/\.snapshot-redaction\s*\{/);
    expect(dashboardCss).toMatch(/\.snapshot-category-sensitive\s*\{/);
    expect(dashboardCss).toMatch(/\.snapshot-category-flag-sensitive\s*\{/);
  });
});
