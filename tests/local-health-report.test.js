import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const backgroundCoreTs = readFileSync(resolve(repoRoot, 'src/background/core.ts'), 'utf8');
const backgroundCoreJs = readFileSync(resolve(repoRoot, 'background.core.js'), 'utf8');
const dashboardJs = readFileSync(resolve(repoRoot, 'pages/dashboard.js'), 'utf8');
const messagesTs = readFileSync(resolve(repoRoot, 'src/types/messages.ts'), 'utf8');

describe('local health report background action', () => {
  it('exposes a local-only aggregate health report action from the promoted TS source', () => {
    expect(backgroundCoreTs).toContain("const LOCAL_HEALTH_SCHEMA = 'scriptvault-local-health/v1';");
    expect(backgroundCoreTs).toMatch(/case 'getLocalHealthReport':\s*return await buildLocalHealthReport\(\);/);
    expect(backgroundCoreJs).toContain("case 'getLocalHealthReport':");
    expect(backgroundCoreJs).toContain('scriptvault-local-health/v1');
  });

  it('summarizes storage, scripts, queues, callbacks, and warnings without external beacons', () => {
    const block = backgroundCoreTs.match(/async function buildLocalHealthReport\(\) \{[\s\S]*?\n\}/);
    expect(block).toBeTruthy();
    expect(backgroundCoreTs).toContain('navigator.storage.estimate');
    expect(backgroundCoreTs).toContain('ScriptStorage.getAll()');
    expect(backgroundCoreTs).toContain('UpdateSystem.getPendingUpdates()');
    expect(backgroundCoreTs).toContain('UpdateSystem.getRecentUpdates()');
    expect(backgroundCoreTs).toContain('self._notifCallbacks?.size');
    expect(backgroundCoreTs).toContain('self._openTabTrackers?.size');
    expect(backgroundCoreTs).toContain('self._audioWatchedTabs?.size');
    expect(backgroundCoreTs).toContain('buildLocalHealthWarningList');
    expect(block[0]).not.toMatch(/\bfetch\s*\(/);
  });

  it('declares an explicit privacy envelope for support-safe diagnostics', () => {
    expect(backgroundCoreTs).toMatch(/privacy:\s*\{[\s\S]{0,250}localOnly:\s*true/);
    expect(backgroundCoreTs).toMatch(/includesScriptSource:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesScriptNames:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesUrls:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesExternalBeacons:\s*false/);
  });
});

describe('local health report support snapshot wiring', () => {
  it('adds the aggregate health report to the always-on support snapshot runtime payload', () => {
    expect(dashboardJs).toContain("chrome.runtime.sendMessage({ action: 'getLocalHealthReport' })");
    expect(dashboardJs).toMatch(/localHealth:\s*localHealthReport\?\.schema === 'scriptvault-local-health\/v1' \? localHealthReport : undefined/);
  });

  it('types the action and response map for background callers', () => {
    expect(messagesTs).toMatch(/interface GetLocalHealthReport \{[\s\S]{0,80}action: 'getLocalHealthReport';/);
    expect(messagesTs).toMatch(/interface LocalHealthReportResponse \{[\s\S]{0,80}schema: 'scriptvault-local-health\/v1';/);
    expect(messagesTs).toMatch(/GetExtensionStatus \| GetLocalHealthReport/);
    expect(messagesTs).toMatch(/getLocalHealthReport: LocalHealthReportResponse;/);
  });
});
