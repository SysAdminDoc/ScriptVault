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

  it('summarizes storage, scripts, managed policy, queues, callbacks, and warnings without external beacons', () => {
    const block = backgroundCoreTs.match(/async function buildLocalHealthReport\(\) \{[\s\S]*?\n\}/);
    expect(block).toBeTruthy();
    expect(backgroundCoreTs).toContain('navigator.storage.estimate');
    expect(backgroundCoreTs).toContain('ScriptStorage.getAll()');
    expect(backgroundCoreTs).toContain('SettingsManager.get()');
    expect(backgroundCoreTs).toContain('buildManagedPolicyHealthSummary(scriptList)');
    expect(backgroundCoreTs).toContain('UpdateSystem.getPendingUpdates()');
    expect(backgroundCoreTs).toContain('UpdateSystem.getRecentUpdates()');
    expect(backgroundCoreTs).toContain('self._notifCallbacks?.size');
    expect(backgroundCoreTs).toContain('self._openTabTrackers?.size');
    expect(backgroundCoreTs).toContain('self._audioWatchedTabs?.size');
    expect(backgroundCoreTs).toContain('buildLocalHealthWarningList');
    expect(block[0]).not.toMatch(/\bfetch\s*\(/);
  });

  it('summarizes managed policy without policy values, URLs, code, script names, or script ids', () => {
    const block = backgroundCoreTs.match(/async function buildManagedPolicyHealthSummary\(scripts = \[\]\) \{[\s\S]*?\n\}/);
    expect(block).toBeTruthy();
    expect(backgroundCoreTs).toContain('managed.get(MANAGED_SCRIPT_POLICY_KEYS)');
    expect(backgroundCoreTs).toContain('readManagedPolicyRunSummary()');
    expect(backgroundCoreTs).toContain('accessLevelControlAvailable');
    expect(backgroundCoreTs).toContain('configuredUrlEntries');
    expect(backgroundCoreTs).toContain('configuredInlineEntries');
    expect(backgroundCoreTs).toContain('configuredInvalidEntries');
    expect(backgroundCoreTs).toContain('installedManagedScripts: scripts.filter');
    expect(backgroundCoreTs).toContain('lastRun: await readManagedPolicyRunSummary()');
    expect(backgroundCoreTs).toContain('managedPolicy,');
    expect(backgroundCoreTs).toContain("push('managedPolicyInvalidEntries', 'warning'");
    expect(backgroundCoreTs).toContain("push('managedPolicyNotApplied', 'warning'");
    expect(backgroundCoreTs).toContain("push('managedPolicyRunFailures', 'warning'");
    expect(backgroundCoreTs).toContain("push('managedPolicyRunSkippedEntries', 'warning'");
    expect(block[0]).not.toMatch(/originKey|managedOriginKey|scriptId|scriptName|name:|return\s+policy|entries:\s*items/i);
  });

  it('summarizes GM value sync readiness without values, value keys, script names, or script ids', () => {
    const block = backgroundCoreTs.match(/async function buildGmValueSyncHealthSummary\(scripts = \[\]\) \{[\s\S]*?\n\}/);
    expect(block).toBeTruthy();
    expect(backgroundCoreTs).toContain("const GM_VALUE_SYNC_SCHEMA = 'scriptvault-gm-value-sync/v1';");
    expect(backgroundCoreTs).toContain('GM_VALUE_SYNC_MAX_SCRIPT_BYTES = 64 * 1024');
    expect(backgroundCoreTs).toContain('GM_VALUE_SYNC_MAX_KEYS = 128');
    expect(backgroundCoreTs).toContain('GM_VALUE_SYNC_MAX_KEY_BYTES = 256');
    expect(backgroundCoreTs).toContain('buildGmValueSyncHealthSummary(scriptList)');
    expect(backgroundCoreTs).toContain('providerWritesEnabled: false');
    expect(backgroundCoreTs).toContain('sanitizeValueBundleSyncForLastResult');
    expect(backgroundCoreTs).toContain('readGmValueSyncLastResultForHealth');
    expect(backgroundCoreTs).toContain('lastResult: null');
    expect(backgroundCoreTs).toContain('writeFailureRetryReady');
    expect(backgroundCoreTs).toContain('_gmValueSyncRetryAgeBucket');
    expect(backgroundCoreTs).toContain('retryAgeMinutes');
    expect(backgroundCoreTs).toContain('retryAgeBucket');
    expect(backgroundCoreTs).toContain("GM_VALUE_SYNC_RETRY_HISTORY_SCHEMA = 'scriptvault-gm-value-sync-retry-history/v1'");
    expect(backgroundCoreTs).toContain("GM_VALUE_SYNC_RETRY_RESOLUTION_SCHEMA = 'scriptvault-gm-value-sync-retry-resolution/v1'");
    expect(backgroundCoreTs).toContain('GM_VALUE_SYNC_RETRY_HISTORY_LIMIT = 5');
    expect(backgroundCoreTs).toContain('GM_VALUE_SYNC_RETRY_HISTORY_RETENTION_DAYS = 7');
    expect(backgroundCoreTs).toContain('_isGmValueSyncRetryHistoryEntryStale');
    expect(backgroundCoreTs).toContain('buildGmValueSyncRetryResolutionRecord');
    expect(backgroundCoreTs).toContain('readGmValueSyncRetryResolutionForHealth');
    expect(backgroundCoreTs).toContain('updateGmValueSyncRetryHistory');
    expect(backgroundCoreTs).toContain('readGmValueSyncRetryHistoryForHealth');
    expect(backgroundCoreTs).toContain('gmValueSyncRetryResolution');
    expect(backgroundCoreTs).toContain('gmValueSyncRetryHistory');
    expect(backgroundCoreTs).toContain('ScriptValues.getAll(script.id)');
    expect(backgroundCoreTs).toContain('gmValueSync,');
    expect(backgroundCoreTs).toContain("push('gmValueSyncProviderWritesPending', 'info'");
    expect(backgroundCoreTs).toContain("push('gmValueSyncBundleWarnings', 'warning'");
    expect(backgroundCoreTs).toContain("push('gmValueSyncValueReadFailures', 'warning'");
    expect(backgroundCoreTs).toContain("push('gmValueSyncWriteRetryReady', 'warning'");
    expect(backgroundCoreTs).toContain('includesValues: false');
    expect(backgroundCoreTs).toContain('includesValueKeys: false');
    expect(backgroundCoreTs).toContain('includesScriptIds: false');
    expect(block[0]).not.toMatch(/return\s+\{[\s\S]{0,400}(values|key|scriptId|name|url):/i);
  });

  it('summarizes local workspace bindings without file handles, paths, or script identifiers', () => {
    const block = backgroundCoreTs.match(/function buildLocalWorkspaceHealthSummary\(bindings = \[\]\) \{[\s\S]*?\n\}/);
    expect(block).toBeTruthy();
    expect(backgroundCoreTs).toContain('LocalWorkspaceBindings.list()');
    expect(backgroundCoreTs).toContain('localWorkspace,');
    expect(backgroundCoreTs).toContain('permissionStates');
    expect(backgroundCoreTs).toContain('refreshStatuses');
    expect(backgroundCoreTs).toContain('errorStates');
    expect(backgroundCoreTs).toContain("case 'too-large':");
    expect(backgroundCoreTs).toContain("case 'parse-failed':");
    expect(backgroundCoreTs).toContain('staleRefreshThresholdDays');
    expect(backgroundCoreTs).toContain("push('localWorkspacePermissionDenied', 'warning'");
    expect(backgroundCoreTs).toContain("push('localWorkspaceRefreshErrors', 'warning'");
    expect(backgroundCoreTs).toContain('includesFileHandles: false');
    expect(backgroundCoreTs).toContain('includesLocalPaths: false');
    expect(block[0]).not.toMatch(/displayName|bindingId|handle|absolutePath|lastKnownSha256/);
  });

  it('summarizes dormant background-script planner state without script identifiers', () => {
    expect(backgroundCoreTs).toContain('function planBackgroundScript(script, settings = {})');
    expect(backgroundCoreTs).toContain('backgroundScripts: {');
    expect(backgroundCoreTs).toContain('unsupportedGrantNames');
    expect(backgroundCoreTs).toContain("push('backgroundScriptsDormant', 'info'");
    expect(backgroundCoreTs).toContain('experimentalBackgroundScripts is disabled.');
    expect(backgroundCoreTs).not.toMatch(/backgroundScripts:[\s\S]{0,600}name/);
    expect(backgroundCoreTs).not.toMatch(/backgroundScripts:[\s\S]{0,600}url/i);
  });

  it('records the last registration sweep as aggregate setup evidence', () => {
    expect(backgroundCoreTs).toContain("const REGISTRATION_SWEEP_SCHEMA = 'scriptvault-registration-sweep/v1';");
    expect(backgroundCoreTs).toContain('let _lastRegistrationSweep = {');
    expect(backgroundCoreTs).toContain('function recordRegistrationSweep(summary = {})');
    expect(backgroundCoreTs).toContain("status: 'already-current'");
    expect(backgroundCoreTs).toContain("? 'partial' : 'diff-registered'");
    expect(backgroundCoreTs).toContain("status: failures.length > 0 ? 'partial' : 'registered'");
    expect(backgroundCoreTs).toContain('registration: _lastRegistrationSweep');
    expect(backgroundCoreTs).toContain("push('registrationSweepFailures', 'warning'");
    expect(backgroundCoreTs).toContain("push('registrationSweepUnavailable', 'warning'");

    const registrationBlock = backgroundCoreTs.match(/let _lastRegistrationSweep = \{[\s\S]*?\n\};/);
    expect(registrationBlock?.[0]).not.toMatch(/scriptId|name|url/i);
  });

  it('promoted runtime preserves the aggregate registration sweep contract', () => {
    expect(backgroundCoreJs).toContain('scriptvault-registration-sweep/v1');
    expect(backgroundCoreJs).toContain('function recordRegistrationSweep(summary = {})');
    expect(backgroundCoreJs).toContain('registration: _lastRegistrationSweep');
  });

  it('declares an explicit privacy envelope for support-safe diagnostics', () => {
    expect(backgroundCoreTs).toMatch(/privacy:\s*\{[\s\S]{0,250}localOnly:\s*true/);
    expect(backgroundCoreTs).toMatch(/includesScriptSource:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesScriptNames:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesUrls:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesFileHandles:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesLocalPaths:\s*false/);
    expect(backgroundCoreTs).toMatch(/includesExternalBeacons:\s*false/);
  });
});

describe('local health report support snapshot wiring', () => {
  it('adds the aggregate health report to the always-on support snapshot runtime payload', () => {
    expect(dashboardJs).toContain("chrome.runtime.sendMessage({ action: 'getLocalHealthReport' })");
    expect(dashboardJs).toMatch(/localHealth:\s*sanitizeLocalHealthForSupportSnapshot\(localHealthReport/);
  });

  it('types the action and response map for background callers', () => {
    expect(messagesTs).toMatch(/interface GetLocalHealthReport \{[\s\S]{0,80}action: 'getLocalHealthReport';/);
    expect(messagesTs).toMatch(/interface LocalHealthReportResponse \{[\s\S]{0,80}schema: 'scriptvault-local-health\/v1';/);
    expect(messagesTs).toMatch(/registration:\s*\{[\s\S]{0,500}schema: 'scriptvault-registration-sweep\/v1';/);
    expect(messagesTs).toMatch(/registration:\s*\{[\s\S]{0,700}failedScripts: number;/);
    expect(messagesTs).toMatch(/backgroundScripts:\s*\{[\s\S]{0,300}unsupportedGrantNames: string\[\];/);
    expect(messagesTs).toMatch(/managedScripts: number;/);
    expect(messagesTs).toMatch(/managedPolicy:\s*\{[\s\S]{0,400}configuredInlineEntries: number;/);
    expect(messagesTs).toMatch(/lastRun: null \| \{[\s\S]{0,700}schema: 'scriptvault-managed-policy-run\/v1';/);
    expect(messagesTs).toMatch(/lastRun: null \| \{[\s\S]{0,900}skippedInvalidEntries: number;/);
    expect(messagesTs).toMatch(/gmValueSync:\s*\{[\s\S]{0,250}schema: 'scriptvault-gm-value-sync\/v1';/);
    expect(messagesTs).toMatch(/gmValueSync:\s*\{[\s\S]{0,500}providerWritesEnabled: boolean;/);
    expect(messagesTs).toMatch(/gmValueSync:\s*\{[\s\S]{0,900}lastResult: null \| \{/);
    expect(messagesTs).toMatch(/lastResult: null \| \{[\s\S]{0,500}writeFailureRetryReady: number;/);
    expect(messagesTs).toMatch(/lastResult: null \| \{[\s\S]{0,700}retryAgeMinutes: number \| null;/);
    expect(messagesTs).toMatch(/retryAgeBucket: 'none' \| 'fresh' \| 'recent' \| 'stale' \| 'old' \| 'unknown';/);
    expect(messagesTs).toMatch(/retryResolution: null \| \{[\s\S]{0,250}schema: 'scriptvault-gm-value-sync-retry-resolution\/v1';/);
    expect(messagesTs).toMatch(/retryResolution: null \| \{[\s\S]{0,500}priorRetryReadyWrites: number;/);
    expect(messagesTs).toMatch(/retryResolution: null \| \{[\s\S]{0,700}resolutionAgeBucket: 'fresh' \| 'recent' \| 'stale' \| 'old' \| 'unknown';/);
    expect(messagesTs).toMatch(/retryHistory:\s*\{[\s\S]{0,250}schema: 'scriptvault-gm-value-sync-retry-history\/v1';/);
    expect(messagesTs).toMatch(/retryHistory:\s*\{[\s\S]{0,500}retentionDays: number;/);
    expect(messagesTs).toMatch(/retryHistory:\s*\{[\s\S]{0,700}staleEntriesPruned: number;/);
    expect(messagesTs).toMatch(/retryHistory:\s*\{[\s\S]{0,800}totalWriteFailureRetryReady: number;/);
    expect(messagesTs).toMatch(/gmValueSync:\s*\{[\s\S]{0,3200}warningCounts: Record<string, number>;/);
    expect(messagesTs).toMatch(/privacy:\s*\{[\s\S]{0,300}includesValueKeys: boolean;/);
    expect(messagesTs).toMatch(/localWorkspace:\s*\{[\s\S]{0,300}totalBindings: number;/);
    expect(messagesTs).toMatch(/localWorkspace:\s*\{[\s\S]{0,700}refreshStatuses: Record<string, number>;/);
    expect(messagesTs).toMatch(/GetExtensionStatus \| GetLocalHealthReport/);
    expect(messagesTs).toMatch(/getLocalHealthReport: LocalHealthReportResponse;/);
  });
});
