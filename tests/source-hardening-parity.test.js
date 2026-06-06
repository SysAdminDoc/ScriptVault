import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchTextBounded } from '../src/background/fetch-bounded.ts';

function source(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function bodyFromChunks(chunks) {
  let index = 0;
  return {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[index++] };
        },
        async cancel() {},
        releaseLock() {},
      };
    },
  };
}

function responseFromText(text, { declaredLength, stream = true } = {}) {
  const headers = new Map();
  if (declaredLength !== undefined) headers.set('content-length', String(declaredLength));
  const bytes = new TextEncoder().encode(text);
  return {
    headers: { get: (key) => headers.get(key.toLowerCase()) ?? null },
    body: stream ? bodyFromChunks([bytes]) : null,
    async text() {
      return text;
    },
  };
}

describe('source hardening parity guards', () => {
  it('keeps TypeScript remote script fetch paths on the bounded reader', async () => {
    const guardedFiles = [
      'src/background/install-handler.ts',
      'src/background/update-checker.ts',
      'src/background/resource-loader.ts',
      'src/background/context-menu.ts',
    ];

    for (const file of guardedFiles) {
      const text = source(file);
      expect(text, `${file} imports bounded reader`).toContain("import { fetchTextBounded } from './fetch-bounded';");
      expect(text, `${file} must not buffer remote responses directly`).not.toMatch(/await\s+response\.text\(\)/);
    }

    const small = await fetchTextBounded(responseFromText('ok'), 10, 'Script');
    expect(small).toBe('ok');
    await expect(fetchTextBounded(responseFromText('x'.repeat(20), { declaredLength: 5 }), 10, 'Script'))
      .rejects.toThrow(/Script too large/);
    await expect(fetchTextBounded(responseFromText('é', { stream: false }), 1, 'Script'))
      .rejects.toThrow(/Script too large/);
  });

  it('keeps empty grants and grant none locked down in the TypeScript wrapper mirror', () => {
    const wrapper = source('src/background/wrapper-builder.ts');
    expect(wrapper).toContain("const grants: string[] = meta.grant.length > 0 ? meta.grant : ['none'];");
    expect(wrapper).toContain('if (hasNone || grants.length === 0) return false;');
  });

  it('keeps Gist token writes on promise-based storage with rejection propagation', () => {
    const gist = source('pages/dashboard-gist.js');
    expect(gist).toContain('await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: token });');
    expect(gist).toContain("console.error('[gist] saveToken failed:', e);");
    expect(gist).toContain('throw e;');
    expect(gist).toContain("chrome.storage.local.set({ [STORAGE_KEY_AUTOSYNC]: val }).catch((e) => {");
    expect(gist).not.toMatch(/new Promise\s*\(\s*resolve\s*=>\s*\{[\s\S]*chrome\.storage\.local\.(set|remove)/);
  });

  it('keeps GM_xmlhttpRequest behind the internal-host preflight and redirect guard', () => {
    const core = source('src/background/core.ts');
    expect(core).toContain("const xhrPreCheck = InternalHostGuard.classifyFetchUrl(data.url, ['http:', 'https:']);");
    expect(core).toContain("GM_xmlhttpRequest URL rejected");
    expect(core).toContain("const xhrPostCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);");
    expect(core).toContain("GM_xmlhttpRequest redirected to internal host");
  });

  it('keeps privileged GM network, cookie, and DNR APIs behind script host-scope policy', () => {
    const core = source('src/background/core.ts');
    const dnr = source('src/background/dnr-rules.ts');
    const wrapper = source('src/background/wrapper-builder.ts');

    expect(core).toContain('function isScriptHostScopeAllowed(script, requestUrl)');
    expect(core).toContain('Connection to ${hostname} blocked by script host scope');
    expect(core).toContain("GM_download URL rejected");
    expect(core).toContain('evaluateScriptHostScopePolicy(cookieScript, data.url,');
    expect(core).toContain('_validateWebRequestRulesForScript(script, rules, settings)');
    expect(core).toContain('GM_webRequest CSP header changes require Modify CSP = yes');
    expect(core).toContain('dnr.condition.responseHeaders = responseHeaders;');
    expect(core).toContain('dnr.condition.excludedResponseHeaders = excludedResponseHeaders;');
    expect(dnr).toContain('function validateWebRequestRulesForScript(');
    expect(dnr).toContain('condition.initiatorDomains = options.initiatorDomains;');
    expect(dnr).toContain('condition.responseHeaders = responseHeaders;');
    expect(dnr).toContain('condition.excludedResponseHeaders = excludedResponseHeaders;');
    expect(wrapper).toContain("sendToBackground('GM_cookie_list', { ...(details || {}), scriptId })");
    expect(wrapper).toContain("sendToBackground('GM_webRequest', { scriptId, rules: ruleArray })");
  });

  it('keeps sync provider endpoints behind the internal-host preflight and redirect guard', () => {
    const providers = source('src/modules/sync-providers.ts');
    expect(providers).toContain("import {\n  classifyFetchUrl,\n  classifyResponseUrl,");
    expect(providers).toContain("const preCheck = classifyFetchUrl(url, ['http:', 'https:']);");
    expect(providers).toContain('WebDAV sync endpoint');
    expect(providers).toContain('S3 sync endpoint');
    expect(providers).toContain('allowInternalSyncEndpoints');
    expect(providers).toContain('assertSyncResponseAllowed(response, guardOptions);');
  });

  it('keeps PublicAPI trusted-origin and install URL checks on the canonical internal-host guard', () => {
    const publicApi = source('src/modules/public-api.ts');
    expect(publicApi).toContain("import { isInternalHost } from '../background/internal-host-guard';");
    expect(publicApi).not.toContain('function isInternalIPv4(');
    expect(publicApi).not.toContain('function isInternalHost(');
    expect(publicApi).toContain('if (!parsed.hostname || isInternalHost(parsed.hostname))');
    expect(publicApi).toContain('if (isInternalHost(parsedUrl.hostname))');
  });

  it('keeps portable settings exports from carrying sync credentials by default', () => {
    const core = source('src/background/core.ts');
    const importExport = source('src/background/import-export.ts');
    const backupScheduler = source('src/modules/backup-scheduler.ts');
    const dashboard = source('pages/dashboard.js');

    for (const text of [core, importExport, backupScheduler]) {
      expect(text).toContain('webdavPassword');
      expect(text).toContain('googleDriveToken');
      expect(text).toContain('dropboxToken');
      expect(text).toContain('onedriveToken');
      expect(text).toContain('syncEncryptionPassphrase');
      expect(text).toContain('s3AccessKeyId');
      expect(text).toContain('s3SecretKey');
      expect(text).toContain('settingsCredentialsIncluded');
      expect(text).toContain('redactedSettingsCredentialKeys');
    }
    expect(core).toContain('prepareSettingsForPortableImport');
    expect(importExport).toContain('prepareSettingsForPortableImport');
    expect(core).toContain('applyImportedScriptTrust');
    expect(importExport).toContain('applyImportedScriptTrust');
    expect(backupScheduler).toContain('trustImportedScripts');
    expect(backupScheduler).toContain('global-settings.metadata.json');
    expect(backupScheduler).toContain('_prepareSettingsForRestore');
    expect(dashboard).toContain('restoreSettingsCredentials');
    expect(dashboard).toContain('trustBackupScripts');
    expect(dashboard).toContain('Import review');
    expect(dashboard).toContain('includeSettingsCredentials: transfer.includeSettingsCredentials');
    expect(dashboard).toContain('importSettingsCredentials: transfer.includeSettingsCredentials');
  });

  it('keeps JSON and backup ZIP intake behind bounded archive guards', () => {
    const core = source('src/background/core.ts');
    const importExport = source('src/background/import-export.ts');
    const backupScheduler = source('src/modules/backup-scheduler.ts');

    for (const text of [core, importExport, backupScheduler]) {
      expect(text).toContain('ARCHIVE_MAX_COMPRESSED_BYTES');
      expect(text).toContain('ARCHIVE_MAX_ENTRIES');
      expect(text).toContain('ARCHIVE_MAX_TOTAL_UNCOMPRESSED_BYTES');
      expect(text).toContain('ARCHIVE_MAX_COMPRESSION_RATIO');
      expect(text).toContain('function unzipArchiveBounded');
      expect(text).toContain('validateArchiveEntryMeta(file, state)');
      expect(text).toContain('parseArchiveJson');
      expect(text).toContain('archiveEntryText');
    }

    for (const text of [core, importExport]) {
      expect(text).toContain('function validateJsonImportBudget');
      expect(text).toContain('const budgetError = validateJsonImportBudget(data);');
      expect(text).toContain('const unzipped');
      expect(text).toContain('= unzipArchiveBounded(zipData);');
    }

    expect(backupScheduler).toContain('= unzipArchiveBounded(backup.data);');
    expect(backupScheduler).toContain('= unzipArchiveBounded(data);');
  });

  it('keeps cloud sync per-script settings partitioned from local-only state', () => {
    const core = source('src/background/core.ts');
    const cloudSync = source('src/background/cloud-sync.ts');
    const easyCloud = source('src/modules/sync-easycloud.ts');
    const scriptTypes = source('src/types/script.ts');

    for (const text of [core, cloudSync, easyCloud]) {
      expect(text).toContain('SYNC_SAFE_SCRIPT_SETTING_KEYS');
      expect(text).toContain('LOCAL_ONLY_SCRIPT_SETTING_KEYS');
      expect(text).toContain('cloneSyncSafeScriptSettings');
      expect(text).toContain('mergeSyncedScriptSettings');
      expect(text).toContain('sanitizeSyncEnvelopeForUpload');
      expect(text).toContain('_registrationError');
      expect(text).toContain('_failedRequires');
      expect(text).toContain('userModified');
      expect(text).toContain('mergeConflict');
      expect(text).toContain('runAt');
      expect(text).toContain('syncValues');
      expect(text).toContain('userMatches');
    }
    expect(scriptTypes).toContain('Cloud sync helpers must not upload these.');
    expect(scriptTypes).toContain('syncValues?: boolean;');
    expect(core).toContain('prepareSyncEnvelopeForRemoteUpload');
    expect(cloudSync).toContain('prepareSyncEnvelopeForRemoteUpload');
    expect(easyCloud).toContain('prepareSyncEnvelopeForRemoteUpload');
    expect(core).toContain('SyncCrypto.prepareSyncEnvelopeForUpload');
    expect(cloudSync).toContain('SyncCrypto.prepareSyncEnvelopeForUpload');
    expect(easyCloud).toContain('SyncCrypto.prepareSyncEnvelopeForUpload');
  });

  it('keeps downloaded GM value bundles behind the non-writing opt-in apply gate', () => {
    const core = source('src/background/core.ts');
    const cloudSync = source('src/background/cloud-sync.ts');

    for (const text of [core, cloudSync]) {
      expect(text).toContain('selectApplicableRemoteValueBundles');
      expect(text).toContain('applyRemoteValueBundlesWhenLocalEmpty');
      expect(text).toContain('summarizeRemoteValueBundleApplyResult');
      expect(text).toContain('buildValueBundleConflictPreview');
      expect(text).toContain('compareValueBundleLastWrite');
      expect(text).toContain('preserveRemoteValueBundle');
      expect(text).toContain('countValueBundleKeyOverlap');
      expect(text).toContain('getSyncEnvelopeValueBundles');
      expect(text).toContain('valueBundleSync');
      expect(text).toContain('valueBundleConflicts');
      expect(text).toContain('lastWriteHint');
      expect(text).toContain('preservedRemoteNewer');
      expect(text).toContain('valueBundleApplyEnabled');
      expect(text).toContain('valueBundleApplyMode');
      expect(text).toContain('wouldApplyValues');
      expect(text).toContain("applyMode: 'empty-local-only'");
      const gateStart = text.indexOf('function selectApplicableRemoteValueBundles');
      const gateEnd = text.indexOf('async function', gateStart);
      expect(gateStart).toBeGreaterThanOrEqual(0);
      expect(gateEnd).toBeGreaterThan(gateStart);
      expect(text.slice(gateStart, gateEnd)).not.toContain('ScriptValues.setAll');
    }
  });

  it('keeps @require fetches on extension host-permission fetch semantics', () => {
    const loader = source('src/background/resource-loader.ts');
    const core = source('src/background/core.ts');
    expect(loader).toContain("Do not force mode:'cors'");
    expect(core).toContain("Do not force mode:'cors'");
    expect(loader).not.toContain("mode: 'cors'");
    expect(core).not.toContain("mode: 'cors'");
  });
});
