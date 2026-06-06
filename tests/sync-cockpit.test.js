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
    ${extractFunction(dashboardJs, 'sanitizeSyncPreviewSummary')}
    ${extractFunction(dashboardJs, 'sanitizeValueBundleConflictPreview')}
    ${extractFunction(dashboardJs, 'buildSyncPreviewExport')}
    return { buildSyncPreviewExport };
  `)();
}

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
    expect(dashboardJs).toContain('formatValueBundleConflictReason');
    expect(dashboardJs).toContain('GM value blocked merge preview');
    expect(dashboardJs).toContain('buildSyncPreviewExport');
    expect(dashboardJs).toContain('scriptvault-sync-preview/v1');
    expect(dashboardJs).toContain('valueBundleSync');
    expect(dashboardJs).toContain('valueBundleConflicts');
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
        wouldUpload: true,
        leakedName: 'Secret Script',
      },
      conflicts: [{ id: 'script_secret', name: 'Secret Script' }],
      valueBundleConflicts: [{
        reason: 'local-values-present',
        localKeyCount: 1,
        remoteKeyCount: 1,
        localBytes: 111,
        remoteBytes: 222,
        overlappingKeyCount: 1,
        localOnlyKeyCount: 0,
        remoteOnlyKeyCount: 0,
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
        }],
      }),
    );
    expect(exported.summary).toEqual(expect.objectContaining({
      conflicts: 1,
      remoteValueBundlesConflictBlocked: 1,
      valueBundleApplyEnabled: true,
      valueBundleApplyMode: 'empty-local-only',
      wouldUpload: true,
    }));
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain('script_secret');
    expect(serialized).not.toContain('Secret Script');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('remote-secret');
  });

  it('keeps Gist token storage disclosure honest', () => {
    expect(gistJs).toContain('Uses a GitHub Personal Access Token stored in chrome.storage.local.');
    expect(gistJs).toContain('Token storage: gist_pat in chrome.storage.local.');
    expect(gistJs).toContain('revoke the token itself in GitHub settings');
    expect(gistJs).not.toContain('stored encrypted in chrome.storage.local');
  });
});
