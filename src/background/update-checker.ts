// ============================================================================
// Update System — strict TypeScript migration from background.core.js
// ============================================================================

import type { Script, ScriptMeta } from '../types/script';
import type { Settings } from '../types/settings';

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

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface UpdateInfo {
  id: string;
  name: string;
  currentVersion: string;
  newVersion: string;
  code: string;
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

// ---------------------------------------------------------------------------
// UpdateSystem
// ---------------------------------------------------------------------------

export const UpdateSystem = {
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

      try {
        const updateUrl: string = script.meta.updateURL || script.meta.downloadURL;
        const headers: Record<string, string> = {};

        // Conditional request using stored etag/last-modified
        if (script._httpEtag) headers['If-None-Match'] = script._httpEtag;
        if (script._httpLastModified) headers['If-Modified-Since'] = script._httpLastModified;

        const response: Response = await fetch(updateUrl, { headers });

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

        const newCode: string = await response.text();
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
    return 0;
  },

  /**
   * Apply a fetched update to a script, storing a rollback snapshot.
   */
  async applyUpdate(scriptId: string, newCode: string): Promise<ApplyUpdateResult> {
    const script: Script | null = await ScriptStorage.get(scriptId);
    if (!script) return { error: 'Script not found' };
    // Don't auto-update scripts the user has locally edited
    if (script.settings?.userModified) return { skipped: true, reason: 'user-modified' };

    const parsed = parseUserscript(newCode);
    if (parsed.error !== undefined || !parsed.meta) return { error: parsed.error ?? 'Parse failed' };

    const parsedMeta: ScriptMeta = parsed.meta;

    // Store previous version for rollback (keep last 3)
    if (!script.versionHistory) script.versionHistory = [];
    script.versionHistory.push({
      version: script.meta.version,
      code: script.code,
      updatedAt: script.updatedAt || Date.now(),
    });
    // Trim to last 5 versions
    if (script.versionHistory.length > 5) {
      script.versionHistory = script.versionHistory.slice(-5);
    }

    script.code = newCode;
    script.meta = parsedMeta;
    script.updatedAt = Date.now();

    // Re-register FIRST so we can verify the new code works before persisting
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
  },

  /**
   * Run a full auto-update cycle: check all scripts and apply any available updates.
   */
  async autoUpdate(): Promise<void> {
    const settings: Settings = await SettingsManager.get();
    if (!settings.autoUpdate) return;

    const updates: UpdateInfo[] = await this.checkForUpdates();
    // Apply all pending updates in parallel — each applyUpdate is independent
    const results: PromiseSettledResult<ApplyUpdateResult>[] = await Promise.allSettled(
      updates.map((update: UpdateInfo) => this.applyUpdate(update.id, update.code)),
    );
    const failed: PromiseRejectedResult[] = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failed.length > 0) {
      console.error(
        '[ScriptVault] Auto-update failures:',
        failed.map((r: PromiseRejectedResult) => (r.reason as Error)?.message || r.reason),
      );
    }

    await SettingsManager.set('lastUpdateCheck', Date.now());
  },
};
