import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const gistJs = readFileSync(resolve(process.cwd(), 'pages/dashboard-gist.js'), 'utf8');

describe('sync safety cockpit wiring', () => {
  it('exposes dashboard health, revoke, and dry-run preview controls', () => {
    expect(dashboardHtml).toContain('id="syncHealthStatus"');
    expect(dashboardHtml).toContain('id="syncStorageDisclosure"');
    expect(dashboardHtml).toContain('id="syncPreviewSummary"');
    expect(dashboardHtml).toContain('id="btnSyncCheckHealth"');
    expect(dashboardHtml).toContain('id="btnSyncPreview"');
    expect(dashboardHtml).toContain('id="btnSyncRevoke"');

    expect(dashboardJs).toContain("action: 'syncProviderHealth'");
    expect(dashboardJs).toContain("action: 'syncDryRunPreview'");
    expect(dashboardJs).toContain("action: 'revokeSyncProvider'");
    expect(dashboardJs).toContain('summarizeSyncDisclosure');
    expect(dashboardJs).toContain('renderSyncPreview');
  });

  it('routes provider health and dry-run actions through background without writes', () => {
    expect(backgroundCore).toContain('async function buildSyncProviderHealth');
    expect(backgroundCore).toContain("case 'syncProviderHealth'");
    expect(backgroundCore).toContain("case 'syncDryRunPreview'");
    expect(backgroundCore).toContain('previewData(local, remote, options = {})');
    expect(backgroundCore).toContain('dryRun: true');
    expect(backgroundCore).toContain('noWrites: true');
  });

  it('keeps Gist token storage disclosure honest', () => {
    expect(gistJs).toContain('Uses a GitHub Personal Access Token stored in chrome.storage.local.');
    expect(gistJs).toContain('Token storage: gist_pat in chrome.storage.local.');
    expect(gistJs).toContain('revoke the token itself in GitHub settings');
    expect(gistJs).not.toContain('stored encrypted in chrome.storage.local');
  });
});
