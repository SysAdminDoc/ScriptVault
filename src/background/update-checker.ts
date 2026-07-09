// ============================================================================
// Update System — strict TypeScript migration from background.core.js
// ============================================================================

import type { Script, ScriptMeta, ScriptTrustReceipt, VersionHistoryEntry } from '../types/script';
import type { Settings } from '../types/settings';
import { fetchTextBounded } from './fetch-bounded';
import { classifyFetchUrl, classifyResponseUrl } from './internal-host-guard';
import { createScriptTrustReceipt, getRequireTofuSriFailure } from './trust-receipt';
import { bundleIfNeeded } from '../bg/esm-bundler';
import { fetchProvenanceBundle, fetchRequireScript } from './resource-loader';

// ---------------------------------------------------------------------------
// External dependencies (not yet migrated to TS modules)
// ---------------------------------------------------------------------------

declare const ScriptStorage: {
  get(id: string): Promise<Script | null>;
  getAll(): Promise<Script[]>;
  set(id: string, script: Script): Promise<void>;
};

declare const SettingsManager: {
  get(): Promise<Settings>;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
};

declare function parseUserscript(code: string): {
  meta: ScriptMeta;
  code: string;
  metaBlock: string;
  error?: undefined;
} | {
  error: string;
  meta?: undefined;
  code?: undefined;
  metaBlock?: undefined;
};

declare function registerScript(script: Script): Promise<void>;
declare function unregisterScript(scriptId: string): Promise<void>;
declare function installFromCode(
  code: string,
  receiptOptions?: { sourceUrl?: string; operation?: ScriptTrustReceipt['operation'] },
): Promise<ApplyUpdateResult>;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface UpdateInfo {
  id: string;
  name: string;
  currentVersion: string;
  newVersion: string;
  code: string;
  sourceUrl?: string;
}

export interface SubscriptionInstallInfo {
  id: string;
  code: string;
  sourceUrl?: string;
  name?: string;
  newVersion?: string;
  subscriptionId?: string;
  subscriptionName?: string;
}

export interface PendingUpdateInfo extends UpdateInfo {
  kind?: 'update' | 'subscription-install';
  source: string;
  queuedAt: number;
  checkedAt: number;
  safeToApply: boolean;
  reviewReasons: string[];
  sourceIdentityChanged: boolean;
  subscriptionId?: string;
  subscriptionName?: string;
  trustReceipt?: unknown;
  dependencyChanges?: unknown;
  permissionChanges?: unknown;
  diff?: unknown;
  sourceInfo?: unknown;
  rollback?: unknown;
}

export interface RecentUpdateInfo {
  id: string;
  name: string;
  previousVersion: string;
  newVersion: string;
  dependencyChanges?: ScriptTrustReceipt['dependencyChanges'];
  permissionChanges?: ScriptTrustReceipt['permissionChanges'];
  appliedAt: number;
}

export interface ApplyUpdateSuccess {
  success: true;
  script: Script;
  error?: undefined;
  skipped?: undefined;
}

export interface ApplyUpdateError {
  error: string;
  success?: undefined;
  skipped?: undefined;
}

export interface ApplyUpdateSkipped {
  skipped: true;
  reason: string;
  success?: undefined;
  error?: undefined;
}

export type ApplyUpdateResult = ApplyUpdateSuccess | ApplyUpdateError | ApplyUpdateSkipped;

async function fetchRequireScriptForTrustReceipt(url: string): Promise<string | null> {
  return await fetchRequireScript(url, { bypassCache: true, cacheResult: false, allowUnpinned: true });
}

const updateApplyLocks: Map<string, Promise<unknown>> = new Map();

async function runExclusiveUpdateOperation<T>(scriptId: string, operation: () => Promise<T>): Promise<T> {
  if (!scriptId) return await operation();
  const previous = updateApplyLocks.get(scriptId) || Promise.resolve();
  const operationPromise = previous
    .catch(() => undefined)
    .then(operation)
    .finally(() => {
      if (updateApplyLocks.get(scriptId) === operationPromise) {
        updateApplyLocks.delete(scriptId);
      }
    });
  updateApplyLocks.set(scriptId, operationPromise);
  return await operationPromise;
}

// ---------------------------------------------------------------------------
// UpdateSystem
// ---------------------------------------------------------------------------

export const UpdateSystem = {
  _FETCH_TIMEOUT_MS: 15 * 1000,
  _MAX_UPDATE_BYTES: 5 * 1024 * 1024,
  _PENDING_UPDATES_KEY: 'pendingUpdates',
  _MAX_PENDING_UPDATES: 50,
  _pendingUpdates: null as PendingUpdateInfo[] | null,
  _recentUpdates: [] as RecentUpdateInfo[],

  async fetchUpdateCandidate(
    updateUrl: string,
    fetchOptions: RequestInit = {},
  ): Promise<{ response: Response; code: string }> {
    const preCheck = classifyFetchUrl(updateUrl, ['http:', 'https:']);
    if (!preCheck.ok) {
      throw new Error(`Update URL rejected: ${preCheck.message}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._FETCH_TIMEOUT_MS);

    try {
      const response: Response = await fetch(updateUrl, { ...fetchOptions, signal: controller.signal });

      const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
      if (!postCheck.ok) {
        throw new Error(`Update URL redirected to ${postCheck.message}`);
      }

      if (response.status === 304 || !response.ok) {
        return { response, code: '' };
      }

      const code: string = await fetchTextBounded(response, this._MAX_UPDATE_BYTES, 'Update');

      return { response, code };
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new Error(`Update fetch timed out after ${Math.round(this._FETCH_TIMEOUT_MS / 1000)} seconds`);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Check one or all scripts for available upstream updates.
   * Returns an array of updates that have a newer version than the installed one.
   */
  async checkForUpdates(scriptId: string | null = null): Promise<UpdateInfo[]> {
    const scripts: Script[] = scriptId
      ? ([await ScriptStorage.get(scriptId)].filter(Boolean) as Script[])
      : await ScriptStorage.getAll();

    const updates: UpdateInfo[] = [];

    for (const script of scripts) {
      if (!script.meta.updateURL && !script.meta.downloadURL) continue;
      // Skip scripts flagged @nodownload (auto-updates disabled)
      if ((script.meta as unknown as { nodownload?: boolean }).nodownload) continue;
      // Skip user-modified scripts so local edits aren't clobbered
      if (script.settings?.userModified) continue;

      try {
        const updateUrl: string = script.meta.updateURL || script.meta.downloadURL;
        const headers: Record<string, string> = {};

        // Conditional request using stored etag/last-modified
        if (script._httpEtag) headers['If-None-Match'] = script._httpEtag;
        if (script._httpLastModified) headers['If-Modified-Since'] = script._httpLastModified;

        const { response, code: newCode } = await this.fetchUpdateCandidate(updateUrl, { headers });

        // 304 Not Modified - no update needed
        if (response.status === 304) continue;
        if (!response.ok) continue;

        // Store HTTP cache headers for next check
        const etag: string | null = response.headers.get('etag');
        const lastModified: string | null = response.headers.get('last-modified');
        if (etag || lastModified) {
          script._httpEtag = etag || '';
          script._httpLastModified = lastModified || '';
          await ScriptStorage.set(script.id, script);
        }

        const parsed = parseUserscript(newCode);
        if (parsed.error !== undefined || !parsed.meta) continue;

        const parsedMeta: ScriptMeta = parsed.meta;
        if (this.compareVersions(parsedMeta.version, script.meta.version) > 0) {
          updates.push({
            id: script.id,
            name: script.meta.name,
            currentVersion: script.meta.version,
            newVersion: parsedMeta.version,
            code: newCode,
            sourceUrl: updateUrl,
          });
        }
      } catch (e: unknown) {
        console.error('[ScriptVault] Update check failed for:', script.meta.name, e);
      }
    }

    return updates;
  },

  /**
   * Semver-like comparison that handles pre-release suffixes.
   * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
   */
  compareVersions(v1: string, v2: string): number {
    // Strip pre-release suffix (e.g. "1.2.0-beta.1" -> "1.2.0") before numeric comparison.
    // A version with a pre-release suffix is treated as less than the same version without one.
    const preRelease1: boolean = v1.includes('-');
    const preRelease2: boolean = v2.includes('-');
    const clean1: string = (typeof v1 === 'string' ? v1 : String(v1)).replace(/-.*$/, '');
    const clean2: string = (typeof v2 === 'string' ? v2 : String(v2)).replace(/-.*$/, '');
    const parts1: number[] = clean1.split('.').map((n: string) => parseInt(n, 10) || 0);
    const parts2: number[] = clean2.split('.').map((n: string) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1: number = parts1[i] ?? 0;
      const p2: number = parts2[i] ?? 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    // Numeric parts are equal — a pre-release is less than a release of the same version
    if (preRelease1 && !preRelease2) return -1;
    if (!preRelease1 && preRelease2) return 1;
    // Both have pre-release suffixes: compare lexicographically by dot-separated identifiers
    if (preRelease1 && preRelease2) {
      const pre1 = v1.replace(/^[^-]*-/, '').split('.');
      const pre2 = v2.replace(/^[^-]*-/, '').split('.');
      for (let i = 0; i < Math.max(pre1.length, pre2.length); i++) {
        const hasA = i < pre1.length;
        const hasB = i < pre2.length;
        if (!hasA && hasB) return -1;
        if (hasA && !hasB) return 1;

        const a = pre1[i] ?? '';
        const b = pre2[i] ?? '';
        const aNum = /^\d+$/.test(a) ? parseInt(a, 10) : NaN;
        const bNum = /^\d+$/.test(b) ? parseInt(b, 10) : NaN;
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum > bNum) return 1;
          if (aNum < bNum) return -1;
        } else if (!isNaN(aNum)) {
          return -1;
        } else if (!isNaN(bNum)) {
          return 1;
        } else {
          if (a > b) return 1;
          if (a < b) return -1;
        }
      }
    }
    return 0;
  },

  /**
   * Apply a fetched update to a script, storing a rollback snapshot.
   */
  async applyUpdate(
    scriptId: string,
    newCode: string,
    options: {
      force?: boolean;
      sourceUrl?: string;
      fetchDependencyBody?: (url: string) => Promise<string | null | undefined>;
      fetchProvenanceBundle?: (url: string) => Promise<string | null | undefined>;
    } = {},
  ): Promise<ApplyUpdateResult> {
    return await runExclusiveUpdateOperation(scriptId, async () => {
    const script: Script | null = await ScriptStorage.get(scriptId);
    if (!script) return { error: 'Script not found' };
    // Don't auto-update scripts the user has locally edited
    if (!options.force && script.settings?.userModified) return { skipped: true, reason: 'user-modified' };

    let parsed = parseUserscript(newCode);
    if (parsed.error !== undefined || !parsed.meta) return { error: parsed.error ?? 'Parse failed' };
    const updateSettings = await SettingsManager.get();
    const bundleResult = await bundleIfNeeded(newCode, parsed.meta, updateSettings, {
      sourceUrl: options.sourceUrl || '',
    });
    if (bundleResult.bundled) {
      newCode = bundleResult.code;
      parsed = parseUserscript(newCode);
      if (parsed.error !== undefined || !parsed.meta) return { error: parsed.error ?? 'Parse failed' };
      parsed.meta.esmBundle = {
        entryUrl: bundleResult.entryUrl,
        imports: bundleResult.imports,
        bundledAt: Date.now(),
      };
    }

    const parsedMeta: ScriptMeta = parsed.meta;
    const previousScript: Script = {
      ...script,
      meta: { ...script.meta },
      code: script.code,
      updatedAt: script.updatedAt || Date.now(),
    };

    // Store previous version for rollback (keep last 3)
    const versionHistory: VersionHistoryEntry[] = Array.isArray(script.versionHistory)
      ? [...script.versionHistory]
      : [];
    const historyEntry: VersionHistoryEntry = {
      version: script.meta.version,
      code: script.code,
      updatedAt: script.updatedAt || Date.now(),
    };
    versionHistory.push(historyEntry);
    // Trim to last 5 versions
    if (versionHistory.length > 5) {
      versionHistory.splice(0, versionHistory.length - 5);
    }
    const rollbackIndex = versionHistory.indexOf(historyEntry);
    const trustReceipt = await createScriptTrustReceipt({
      operation: options.force ? 'manual-update' : 'auto-update',
      code: newCode,
      meta: parsedMeta,
      sourceUrl: options.sourceUrl || script.meta.downloadURL || script.meta.updateURL,
      previousScript,
      rollbackIndex,
      fetchDependencyBody: options.fetchDependencyBody || fetchRequireScriptForTrustReceipt,
      fetchProvenanceBundle: options.fetchProvenanceBundle || fetchProvenanceBundle,
    });
    const tofuSriFailure = getRequireTofuSriFailure(trustReceipt);
    if (tofuSriFailure) {
      return { error: tofuSriFailure.message };
    }
    const previousReceipt = previousScript.trustReceipt;
    const previousSourceUrl = previousReceipt
      ? previousReceipt.source.installUrl
      : previousScript.meta.downloadURL || previousScript.meta.updateURL;
    historyEntry.trustReceipt = previousReceipt || await createScriptTrustReceipt({
      operation: 'rollback-point',
      code: previousScript.code,
      meta: previousScript.meta,
      sourceUrl: previousSourceUrl,
    });

    script.code = newCode;
    script.meta = parsedMeta;
    script.updatedAt = Date.now();
    script.trustReceipt = trustReceipt;
    script.versionHistory = versionHistory;

    // Re-register the script after updating (persist happens below; registration errors
    // are recorded on the script so the UI can surface them, but don't block save)
    try {
      await unregisterScript(scriptId);
      if (script.enabled !== false) {
        await registerScript(script);
      }
    } catch (regError: unknown) {
      console.error(`[ScriptVault] Failed to re-register ${script.meta.name} after update:`, regError);
      // Registration failed — still save the updated code (user can manually fix)
      // but mark the failure so the UI can show it
      script.settings = script.settings || {};
      script.settings._registrationError =
        (regError instanceof Error ? regError.message : undefined) || 'Registration failed after update';
    }

    // Persist to storage after registration attempt
    await ScriptStorage.set(scriptId, script);

    const settings: Settings = await SettingsManager.get();
    if (settings.notifyOnUpdate) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Script Updated',
        message: `${script.meta.name} updated to v${script.meta.version}`,
      });
    }

    return { success: true, script };
    });
  },

  async _loadPendingUpdates(): Promise<PendingUpdateInfo[]> {
    if (Array.isArray(this._pendingUpdates)) return this._pendingUpdates;
    const data = await chrome.storage.local.get(this._PENDING_UPDATES_KEY);
    const raw = data[this._PENDING_UPDATES_KEY];
    this._pendingUpdates = Array.isArray(raw)
      ? raw.filter((item: Partial<PendingUpdateInfo>) => item?.id && typeof item.code === 'string') as PendingUpdateInfo[]
      : [];
    return this._pendingUpdates;
  },

  async _savePendingUpdates(list: PendingUpdateInfo[] | null = null): Promise<PendingUpdateInfo[]> {
    const sourceList = list || this._pendingUpdates;
    const normalized = (Array.isArray(sourceList) ? sourceList : [])
      .filter((item) => item?.id && typeof item.code === 'string')
      .slice(0, this._MAX_PENDING_UPDATES);
    this._pendingUpdates = normalized;
    await chrome.storage.local.set({ [this._PENDING_UPDATES_KEY]: normalized });
    return normalized.slice();
  },

  _hasAddedPermission(permissionChanges: Record<string, { added?: string[] }> = {}): boolean {
    const changes = permissionChanges || {};
    return ['grant', 'connect', 'match'].some((key) => {
      const group = changes[key] || {};
      return Array.isArray(group.added) && group.added.length > 0;
    });
  },

  _hasRiskyDependencyChange(dependencyChanges: { require?: Array<{ change?: string; nextError?: string }> } = {}): boolean {
    const requireChanges = dependencyChanges.require || [];
    return requireChanges.some((change) =>
      ['added', 'changed', 'unverified'].includes(change.change || '')
      || !!change.nextError
    );
  },

  _hasProvenanceReviewFlag(receipt: { dependencies?: { require?: Array<{ provenance?: { status?: string; verification?: string } }> } } = {}): boolean {
    const deps = receipt.dependencies?.require || [];
    return deps.some((dep) => {
      const provenance = dep.provenance;
      if (!provenance) return false;
      if (provenance.status && provenance.status !== 'declared') return true;
      return ['verification-unavailable', 'signature-failed', 'root-verification-failed', 'bundle-unavailable', 'unsupported-bundle']
        .includes(provenance.verification || '');
    });
  },

  _getUpdateReviewReasons(receipt: { permissionChanges?: Record<string, { added?: string[] }>; dependencyChanges?: ScriptTrustReceipt['dependencyChanges']; dependencies?: { require?: Array<{ provenance?: { status?: string; verification?: string } }> } }, sourceIdentityChanged: boolean): string[] {
    const reasons: string[] = [];
    if (this._hasAddedPermission(receipt.permissionChanges)) {
      reasons.push('Adds permissions or host scope');
    }
    if (getRequireTofuSriFailure(receipt)) {
      reasons.push('Changes previously trusted unpinned @require bytes');
    } else if (this._hasRiskyDependencyChange(receipt.dependencyChanges)) {
      reasons.push('Changes external dependencies');
    }
    if (this._hasProvenanceReviewFlag(receipt)) {
      reasons.push('Fails @require provenance verification');
    }
    if (sourceIdentityChanged) {
      reasons.push('Changes install source');
    }
    return reasons;
  },

  async _buildPendingUpdate(update: UpdateInfo, source = 'manual-check'): Promise<PendingUpdateInfo | null> {
    if (!update?.id || typeof update.code !== 'string') return null;
    const script: Script | null = await ScriptStorage.get(update.id);
    if (!script) return null;
    const parsed = parseUserscript(update.code);
    if (parsed.error !== undefined || !parsed.meta) return null;

    const sourceUrl = update.sourceUrl || parsed.meta.downloadURL || parsed.meta.updateURL || '';
    const previousSourceUrl = script.meta?.downloadURL || script.meta?.updateURL || '';
    const sourceIdentityChanged = !!sourceUrl
      && !!previousSourceUrl
      && hostFromComparableUrl(sourceUrl) !== hostFromComparableUrl(previousSourceUrl);
    const receipt = await createScriptTrustReceipt({
      operation: 'pending-update',
      code: update.code,
      meta: parsed.meta,
      sourceUrl,
      previousScript: script,
      fetchDependencyBody: fetchRequireScriptForTrustReceipt,
      fetchProvenanceBundle,
    });
    const reviewReasons = this._getUpdateReviewReasons(receipt, sourceIdentityChanged);
    const now = Date.now();

    return {
      kind: 'update',
      id: update.id,
      name: script.meta?.name || update.name || update.id,
      currentVersion: script.meta?.version || update.currentVersion || '',
      newVersion: parsed.meta.version || update.newVersion || '',
      code: update.code,
      sourceUrl,
      source,
      queuedAt: now,
      checkedAt: now,
      safeToApply: reviewReasons.length === 0,
      reviewReasons,
      sourceIdentityChanged,
      trustReceipt: receipt,
      dependencyChanges: receipt.dependencyChanges,
      permissionChanges: receipt.permissionChanges,
      diff: receipt.diff,
      sourceInfo: receipt.source,
      rollback: {
        ...receipt.rollback,
        available: Array.isArray(script.versionHistory) && script.versionHistory.length > 0,
        historyIndex: Array.isArray(script.versionHistory) && script.versionHistory.length > 0
          ? script.versionHistory.length - 1
          : null,
      },
    };
  },

  async _buildPendingSubscriptionInstall(update: SubscriptionInstallInfo, source = 'subscription'): Promise<PendingUpdateInfo | null> {
    if (!update?.id || typeof update.code !== 'string') return null;
    const parsed = parseUserscript(update.code);
    if (parsed.error !== undefined || !parsed.meta) return null;
    const sourceUrl = update.sourceUrl || parsed.meta.downloadURL || parsed.meta.updateURL || '';
    const receipt = await createScriptTrustReceipt({
      operation: 'subscription-install',
      code: update.code,
      meta: parsed.meta,
      sourceUrl,
      fetchDependencyBody: fetchRequireScriptForTrustReceipt,
      fetchProvenanceBundle,
    });
    const now = Date.now();
    return {
      kind: 'subscription-install',
      id: update.id,
      name: parsed.meta.name || update.name || update.id,
      currentVersion: 'new',
      newVersion: parsed.meta.version || update.newVersion || '',
      code: update.code,
      sourceUrl,
      source,
      queuedAt: now,
      checkedAt: now,
      safeToApply: false,
      reviewReasons: ['New script from subscription'],
      sourceIdentityChanged: false,
      subscriptionId: update.subscriptionId || '',
      subscriptionName: update.subscriptionName || '',
      trustReceipt: receipt,
      dependencyChanges: receipt.dependencyChanges,
      permissionChanges: receipt.permissionChanges,
      diff: receipt.diff,
      sourceInfo: receipt.source,
      rollback: {
        ...receipt.rollback,
        available: false,
        scriptId: '',
        version: '',
        updatedAt: null,
        historyIndex: null,
      },
    };
  },

  async queueUpdates(updates: UpdateInfo[] = [], { source = 'manual-check' } = {}): Promise<{ success: true; queued: number; pendingUpdates: PendingUpdateInfo[]; safeCount: number; reviewCount: number }> {
    const incoming = Array.isArray(updates) ? updates : [];
    const existing = await this._loadPendingUpdates();
    const incomingIds = new Set(incoming.map((update) => update?.id).filter(Boolean));
    const retained = existing.filter((item) => !incomingIds.has(item.id));
    const queued: PendingUpdateInfo[] = [];

    for (const update of incoming) {
      const pending = await this._buildPendingUpdate(update, source);
      if (pending) queued.push(pending);
    }

    const pendingUpdates = await this._savePendingUpdates([...queued, ...retained]);
    return {
      success: true,
      queued: queued.length,
      pendingUpdates,
      safeCount: pendingUpdates.filter((item) => item.safeToApply).length,
      reviewCount: pendingUpdates.filter((item) => !item.safeToApply).length,
    };
  },

  async queueSubscriptionInstalls(installs: SubscriptionInstallInfo[] = [], { source = 'subscription' } = {}): Promise<{ success: true; queued: number; pendingUpdates: PendingUpdateInfo[]; safeCount: number; reviewCount: number }> {
    const incoming = Array.isArray(installs) ? installs : [];
    const existing = await this._loadPendingUpdates();
    const incomingIds = new Set(incoming.map((update) => update?.id).filter(Boolean));
    const retained = existing.filter((item) => !incomingIds.has(item.id));
    const queued: PendingUpdateInfo[] = [];

    for (const install of incoming) {
      const pending = await this._buildPendingSubscriptionInstall(install, source);
      if (pending) queued.push(pending);
    }

    const pendingUpdates = await this._savePendingUpdates([...queued, ...retained]);
    return {
      success: true,
      queued: queued.length,
      pendingUpdates,
      safeCount: pendingUpdates.filter((item) => item.safeToApply).length,
      reviewCount: pendingUpdates.filter((item) => !item.safeToApply).length,
    };
  },

  async getPendingUpdates(): Promise<PendingUpdateInfo[]> {
    return (await this._loadPendingUpdates()).slice();
  },

  async clearPendingUpdates(scriptId: string | null = null): Promise<{ success: true; cleared: number | 'all'; pendingUpdates: PendingUpdateInfo[] }> {
    if (!scriptId) {
      await this._savePendingUpdates([]);
      return { success: true, cleared: 'all', pendingUpdates: [] };
    }
    const existing = await this._loadPendingUpdates();
    const next = existing.filter((item) => item.id !== scriptId);
    const pendingUpdates = await this._savePendingUpdates(next);
    return { success: true, cleared: existing.length - next.length, pendingUpdates };
  },

  _recordRecentUpdates(entries: RecentUpdateInfo[]): void {
    const successful = (Array.isArray(entries) ? entries : []).filter(Boolean);
    if (successful.length === 0) return;
    this._recentUpdates = [...successful, ...this._recentUpdates].slice(0, 20);
  },

  async applyPendingUpdate(scriptId: string, { force = false } = {}): Promise<ApplyUpdateResult> {
    const pendingUpdates = await this._loadPendingUpdates();
    const item = pendingUpdates.find((update) => update.id === scriptId);
    if (!item) return { error: 'Pending update not found' };
    if (item.kind === 'subscription-install') {
      const result = await installFromCode(item.code, {
        sourceUrl: item.sourceUrl || '',
        operation: 'subscription-install',
      });
      if (result.success) {
        await this.clearPendingUpdates(scriptId);
        this._recordRecentUpdates([{
          id: item.id,
          name: item.name,
          previousVersion: 'new',
          newVersion: item.newVersion,
          dependencyChanges: result.script.trustReceipt?.dependencyChanges || item.dependencyChanges as ScriptTrustReceipt['dependencyChanges'],
          permissionChanges: result.script.trustReceipt?.permissionChanges || item.permissionChanges as ScriptTrustReceipt['permissionChanges'],
          appliedAt: Date.now(),
        }]);
      }
      return result;
    }
    const result = await this.applyUpdate(scriptId, item.code, { force, sourceUrl: item.sourceUrl || '' });
    if (result.success) {
      await this.clearPendingUpdates(scriptId);
      this._recordRecentUpdates([{
        id: item.id,
        name: item.name,
        previousVersion: item.currentVersion,
        newVersion: item.newVersion,
        dependencyChanges: result.script.trustReceipt?.dependencyChanges || item.dependencyChanges as ScriptTrustReceipt['dependencyChanges'],
        permissionChanges: result.script.trustReceipt?.permissionChanges || item.permissionChanges as ScriptTrustReceipt['permissionChanges'],
        appliedAt: Date.now(),
      }]);
    }
    return result;
  },

  async applySafePendingUpdates(scriptIds: string[] | null = null): Promise<{ success: true; applied: number; skipped: number; failed: number; results: Array<{ id: string; result: ApplyUpdateResult }>; pendingUpdates: PendingUpdateInfo[] }> {
    const idSet = Array.isArray(scriptIds) && scriptIds.length > 0 ? new Set(scriptIds) : null;
    const pendingUpdates = await this._loadPendingUpdates();
    const candidates = pendingUpdates.filter((item) => item.safeToApply && (!idSet || idSet.has(item.id)));
    const results: Array<{ id: string; result: ApplyUpdateResult }> = [];
    for (const item of candidates) {
      results.push({ id: item.id, result: await this.applyPendingUpdate(item.id, { force: false }) });
    }
    return {
      success: true,
      applied: results.filter((entry) => entry.result.success).length,
      skipped: results.filter((entry) => entry.result.skipped).length,
      failed: results.filter((entry) => entry.result.error).length,
      results,
      pendingUpdates: await this.getPendingUpdates(),
    };
  },

  /**
   * Run a full auto-update cycle: check all scripts and apply any available updates.
   */
  async autoUpdate(): Promise<void> {
    const settings: Settings = await SettingsManager.get();
    if (!settings.autoUpdate) return;

    const updates: UpdateInfo[] = await this.checkForUpdates();
    const queueResult = await this.queueUpdates(updates, { source: 'auto-check' });
    if (settings.autoUpdateMode === 'apply-safe') {
      await this.applySafePendingUpdates(updates.map((update) => update.id));
    }
    if (queueResult.queued > 0 && settings.notifyOnUpdate) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: `${queueResult.queued} update${queueResult.queued === 1 ? '' : 's'} ready`,
        message: 'Open ScriptVault to review queued updates',
      });
    }

    await SettingsManager.set('lastUpdateCheck', Date.now());
  },

  getRecentUpdates(): RecentUpdateInfo[] {
    return this._recentUpdates.slice();
  },

  clearRecentUpdates(): void {
    this._recentUpdates = [];
  },
};

function hostFromComparableUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch (_) {
    return '';
  }
}
