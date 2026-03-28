// ============================================================================
// Notification & Alert System
// ============================================================================

import type { Script } from '../types/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Notification preferences stored in chrome.storage. */
export interface NotificationPrefs {
  updates: boolean;
  errors: boolean;
  digest: boolean;
  security: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
}

/** A script update descriptor passed to notifyUpdate(). */
export interface ScriptUpdateInfo {
  id: string;
  name: string;
  version: string;
  oldVersion?: string | null;
}

/** Digest entry for a script update. */
interface DigestUpdateEntry {
  id: string;
  name: string;
  version: string;
  oldVersion: string | null;
  timestamp: number;
}

/** Digest entry for an error. */
interface DigestErrorEntry {
  scriptId: string;
  message: string;
  timestamp: number;
}

/** Digest entry for a security alert. */
interface DigestSecurityEntry {
  scriptId: string;
  scriptName: string;
  reason: string;
  timestamp: number;
}

/** Weekly digest data stored in chrome.storage. */
interface DigestData {
  periodStart: number;
  updatedScripts: DigestUpdateEntry[];
  errors: DigestErrorEntry[];
  securityAlerts: DigestSecurityEntry[];
  lastSummary: DigestSummary | null;
  [field: string]: unknown;
}

/** Compiled weekly digest summary. */
export interface DigestSummary {
  period: { start: number; end: number };
  updatedScripts: DigestUpdateEntry[];
  totalErrors: number;
  uniqueErrorScripts: number;
  securityAlerts: DigestSecurityEntry[];
  storageUsage: { used: number; quota: number } | null;
  staleScripts: { id: string; name: string; lastUpdated: number }[];
  generatedAt: number;
  message?: string;
}

/** Click context stored per notification. */
interface ClickContext {
  action: 'openScript' | 'openDashboard';
  scriptId?: string | null;
}

/** External ScriptStorage shape (referenced dynamically). */
declare const ScriptStorage:
  | {
      get(id: string): Promise<Script | undefined>;
      getAll(): Promise<Script[]>;
    }
  | undefined;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const NotificationSystem = {
  ALARM_WEEKLY_DIGEST: 'scriptvault-weekly-digest' as const,
  STORAGE_KEY_PREFS: 'notificationPrefs' as const,
  STORAGE_KEY_DIGEST: 'weeklyDigest' as const,
  STORAGE_KEY_ERROR_COUNTS: 'notifErrorCounts' as const,
  STORAGE_KEY_RATE_LIMITS: 'notifRateLimits' as const,

  // Default notification preferences
  defaultPrefs: {
    updates: true,
    errors: true,
    digest: false,
    security: true,
    quietHoursEnabled: false,
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 7     // 7 AM
  } satisfies NotificationPrefs,

  // In-memory caches (rebuilt from storage on service worker wake)
  _prefsCache: null as NotificationPrefs | null,
  _errorCounts: null as Record<string, number> | null,
  _rateLimits: null as Record<string, number> | null,

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  async getPreferences(): Promise<NotificationPrefs> {
    if (this._prefsCache) return { ...this._prefsCache };
    const data = await chrome.storage.local.get(this.STORAGE_KEY_PREFS);
    const stored = data[this.STORAGE_KEY_PREFS] as Partial<NotificationPrefs> | undefined;
    this._prefsCache = { ...this.defaultPrefs, ...stored };
    return { ...this._prefsCache };
  },

  async setPreferences(prefs: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const current = await this.getPreferences();
    this._prefsCache = { ...current, ...prefs };
    await chrome.storage.local.set({ [this.STORAGE_KEY_PREFS]: this._prefsCache });

    // If digest was toggled, manage the alarm
    if ('digest' in prefs) {
      if (prefs.digest) {
        await this.scheduleDigest();
      } else {
        await chrome.alarms.clear(this.ALARM_WEEKLY_DIGEST);
      }
    }
    return { ...this._prefsCache };
  },

  // ---------------------------------------------------------------------------
  // Quiet Hours
  // ---------------------------------------------------------------------------

  async _isQuietHours(): Promise<boolean> {
    const prefs = await this.getPreferences();
    if (!prefs.quietHoursEnabled) return false;

    const now = new Date();
    const hour = now.getHours();
    const { quietHoursStart, quietHoursEnd } = prefs;

    // Handle overnight ranges (e.g., 22 to 7)
    if (quietHoursStart > quietHoursEnd) {
      return hour >= quietHoursStart || hour < quietHoursEnd;
    }
    // Same-day range (e.g., 1 to 6)
    return hour >= quietHoursStart && hour < quietHoursEnd;
  },

  // ---------------------------------------------------------------------------
  // Script Update Notifications
  // ---------------------------------------------------------------------------

  /**
   * Notify about script updates. Accepts a single script or an array.
   * Each item: { id, name, version, oldVersion? }
   */
  async notifyUpdate(scripts: ScriptUpdateInfo | ScriptUpdateInfo[]): Promise<void> {
    const prefs = await this.getPreferences();
    if (!prefs.updates) return;
    if (await this._isQuietHours()) return;

    const list = Array.isArray(scripts) ? scripts : [scripts];
    if (list.length === 0) return;

    // Track for weekly digest
    await this._addDigestData('updatedScripts', list.map(s => ({
      id: s.id,
      name: s.name,
      version: s.version,
      oldVersion: s.oldVersion ?? null,
      timestamp: Date.now()
    })));

    let title: string;
    let message: string;
    let notifId: string;

    if (list.length === 1) {
      const s = list[0];
      if (!s) return;
      title = 'Script Updated';
      message = `${s.name} updated to v${s.version}`;
      notifId = `update-${s.id}-${Date.now()}`;
    } else {
      title = `${list.length} Scripts Updated`;
      message = list.map(s => s.name).join(', ');
      notifId = `update-batch-${Date.now()}`;
    }

    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title,
        message,
        priority: 0
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create update notification:', e);
    }

    // Store click context so we can open the dashboard to the right script
    await this._setClickContext(notifId, {
      action: 'openScript',
      scriptId: list.length === 1 ? list[0]?.id ?? null : null
    });
  },

  // ---------------------------------------------------------------------------
  // Error Alerts
  // ---------------------------------------------------------------------------

  /**
   * Track and notify on script errors.
   * Notifies after 3 consecutive errors, rate-limited to 1/hour per script.
   */
  async notifyError(scriptId: string, error: string | { message?: string } | unknown): Promise<void> {
    const prefs = await this.getPreferences();
    if (!prefs.errors) return;

    // Load/init error count tracker
    if (!this._errorCounts) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
      this._errorCounts = (data[this.STORAGE_KEY_ERROR_COUNTS] as Record<string, number> | undefined) ?? {};
    }
    if (!this._rateLimits) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_RATE_LIMITS);
      this._rateLimits = (data[this.STORAGE_KEY_RATE_LIMITS] as Record<string, number> | undefined) ?? {};
    }

    // Increment consecutive error count
    this._errorCounts[scriptId] = (this._errorCounts[scriptId] ?? 0) + 1;
    await chrome.storage.local.set({ [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts });

    // Track for digest
    const errorObj = error as { message?: string } | null | undefined;
    await this._addDigestData('errors', [{
      scriptId,
      message: typeof error === 'string' ? error : (errorObj?.message ?? 'Unknown error'),
      timestamp: Date.now()
    }]);

    // Only notify after 3 consecutive errors
    const currentCount = this._errorCounts[scriptId] ?? 0;
    if (currentCount < 3) return;

    // Rate limit: max 1 notification per script per hour
    const lastNotif = this._rateLimits[scriptId] ?? 0;
    const ONE_HOUR = 3600000;
    if (Date.now() - lastNotif < ONE_HOUR) return;

    // Check quiet hours
    if (await this._isQuietHours()) return;

    // Build notification
    const errorMsg = typeof error === 'string' ? error : (errorObj?.message ?? 'Unknown error');
    const snippet = errorMsg.length > 120 ? errorMsg.substring(0, 117) + '...' : errorMsg;

    // Try to resolve script name
    let scriptName: string = scriptId;
    try {
      if (typeof ScriptStorage !== 'undefined') {
        const script = await ScriptStorage.get(scriptId);
        if (script?.meta?.name) scriptName = script.meta.name;
      }
    } catch (_) { /* ignore */ }

    const notifId = `error-${scriptId}-${Date.now()}`;
    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: `Script Error: ${scriptName}`,
        message: `${currentCount} consecutive errors\n${snippet}`,
        priority: 1
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create error notification:', e);
    }

    // Update rate limit
    this._rateLimits[scriptId] = Date.now();
    await chrome.storage.local.set({ [this.STORAGE_KEY_RATE_LIMITS]: this._rateLimits });

    await this._setClickContext(notifId, {
      action: 'openScript',
      scriptId
    });
  },

  /**
   * Reset the consecutive error count for a script (call on successful execution).
   */
  async resetErrorCount(scriptId: string): Promise<void> {
    if (!this._errorCounts) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
      this._errorCounts = (data[this.STORAGE_KEY_ERROR_COUNTS] as Record<string, number> | undefined) ?? {};
    }
    if (this._errorCounts[scriptId]) {
      delete this._errorCounts[scriptId];
      await chrome.storage.local.set({ [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts });
    }
  },

  // ---------------------------------------------------------------------------
  // Blacklist Alerts
  // ---------------------------------------------------------------------------

  /**
   * Warn when a script matches the blacklist or introduces new risk patterns.
   * reason: string describing the match
   */
  async notifyBlacklist(scriptId: string, reason: string): Promise<void> {
    const prefs = await this.getPreferences();
    if (!prefs.security) return;
    // Security alerts ignore quiet hours — they are urgent

    let scriptName: string = scriptId;
    try {
      if (typeof ScriptStorage !== 'undefined') {
        const script = await ScriptStorage.get(scriptId);
        if (script?.meta?.name) scriptName = script.meta.name;
      }
    } catch (_) { /* ignore */ }

    const notifId = `blacklist-${scriptId}-${Date.now()}`;
    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'Security Warning',
        message: `${scriptName}: ${reason}`,
        priority: 2,
        requireInteraction: true
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create blacklist notification:', e);
    }

    // Track for digest
    await this._addDigestData('securityAlerts', [{
      scriptId,
      scriptName,
      reason,
      timestamp: Date.now()
    }]);

    await this._setClickContext(notifId, {
      action: 'openScript',
      scriptId
    });
  },

  // ---------------------------------------------------------------------------
  // Weekly Digest
  // ---------------------------------------------------------------------------

  /**
   * Schedule the weekly digest alarm. Fires every 7 days.
   */
  async scheduleDigest(): Promise<void> {
    const prefs = await this.getPreferences();
    if (!prefs.digest) return;

    // Check if alarm already exists
    const existing = await chrome.alarms.get(this.ALARM_WEEKLY_DIGEST);
    if (existing) return;

    // Schedule to fire in 7 days, repeating weekly
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    await chrome.alarms.create(this.ALARM_WEEKLY_DIGEST, {
      delayInMinutes: WEEK_MS / 60000,
      periodInMinutes: WEEK_MS / 60000
    });
    console.log('[ScriptVault] Weekly digest alarm scheduled');
  },

  /**
   * Generate and display the weekly digest.
   * Compiles: scripts updated, errors encountered, storage usage, stale scripts.
   */
  async generateDigest(): Promise<DigestSummary> {
    const data = await chrome.storage.local.get(this.STORAGE_KEY_DIGEST);
    const digest = (data[this.STORAGE_KEY_DIGEST] as DigestData | undefined) ?? this._emptyDigest();

    // Calculate storage usage
    let storageUsage: { used: number; quota: number } | null = null;
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate) {
        storageUsage = {
          used: estimate.usage ?? 0,
          quota: estimate.quota ?? 0
        };
      }
    } catch (_) { /* storage estimate not available in all contexts */ }

    // Find stale scripts (not updated in 90+ days)
    let staleScripts: { id: string; name: string; lastUpdated: number }[] = [];
    try {
      if (typeof ScriptStorage !== 'undefined') {
        const all = await ScriptStorage.getAll();
        const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        staleScripts = all
          .filter(s => s.updatedAt && (now - s.updatedAt) > NINETY_DAYS)
          .map(s => ({ id: s.id, name: s.meta?.name ?? 'Unknown', lastUpdated: s.updatedAt }));
      }
    } catch (_) { /* ignore */ }

    const errors = digest.errors ?? [];
    const summary: DigestSummary = {
      period: {
        start: digest.periodStart ?? Date.now() - (7 * 24 * 60 * 60 * 1000),
        end: Date.now()
      },
      updatedScripts: digest.updatedScripts ?? [],
      totalErrors: errors.length,
      uniqueErrorScripts: [...new Set(errors.map(e => e.scriptId))].length,
      securityAlerts: digest.securityAlerts ?? [],
      storageUsage,
      staleScripts,
      generatedAt: Date.now()
    };

    // Build notification message
    const lines: string[] = [];
    if (summary.updatedScripts.length > 0) {
      lines.push(`${summary.updatedScripts.length} script(s) updated`);
    }
    if (summary.totalErrors > 0) {
      lines.push(`${summary.totalErrors} error(s) from ${summary.uniqueErrorScripts} script(s)`);
    }
    if (summary.securityAlerts.length > 0) {
      lines.push(`${summary.securityAlerts.length} security alert(s)`);
    }
    if (summary.staleScripts.length > 0) {
      lines.push(`${summary.staleScripts.length} stale script(s) (90+ days)`);
    }
    if (storageUsage) {
      const pct = ((storageUsage.used / storageUsage.quota) * 100).toFixed(1);
      lines.push(`Storage: ${pct}% used`);
    }

    if (lines.length === 0) {
      lines.push('No activity this week');
    }

    // Show notification (skip quiet hours check for digest — it fires at its scheduled time)
    const notifId = `digest-${Date.now()}`;
    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'ScriptVault Weekly Digest',
        message: lines.join('\n'),
        priority: 0
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create digest notification:', e);
    }

    // Store the compiled digest for dashboard access
    summary.message = lines.join('\n');
    await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: {
      ...this._emptyDigest(),
      lastSummary: summary
    }});

    await this._setClickContext(notifId, { action: 'openDashboard' });

    return summary;
  },

  // ---------------------------------------------------------------------------
  // Notification Click Handler
  // ---------------------------------------------------------------------------

  /**
   * Handle notification clicks. Call this from the background
   * chrome.notifications.onClicked listener.
   */
  async handleClick(notifId: string): Promise<void> {
    const ctxKey = `notifCtx_${notifId}`;
    const data = await chrome.storage.local.get(ctxKey);
    const ctx = data[ctxKey] as ClickContext | undefined;
    await chrome.storage.local.remove(ctxKey);
    chrome.notifications.clear(notifId);

    if (!ctx) return;

    const dashboardUrl = chrome.runtime.getURL('pages/dashboard.html');

    if (ctx.action === 'openScript' && ctx.scriptId) {
      try {
        await chrome.tabs.create({ url: `${dashboardUrl}#script=${ctx.scriptId}` });
      } catch (_) {
        await chrome.tabs.create({ url: dashboardUrl });
      }
    } else if (ctx.action === 'openDashboard') {
      await chrome.tabs.create({ url: dashboardUrl });
    }
  },

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  _emptyDigest(): DigestData {
    return {
      periodStart: Date.now(),
      updatedScripts: [],
      errors: [],
      securityAlerts: [],
      lastSummary: null
    };
  },

  async _addDigestData(field: string, items: unknown[]): Promise<void> {
    const data = await chrome.storage.local.get(this.STORAGE_KEY_DIGEST);
    const digest = (data[this.STORAGE_KEY_DIGEST] as DigestData | undefined) ?? this._emptyDigest();

    let arr = digest[field];
    if (!Array.isArray(arr)) {
      arr = [];
      digest[field] = arr;
    }
    (arr as unknown[]).push(...items);

    // Cap stored digest entries to prevent unbounded growth
    const MAX_DIGEST_ENTRIES = 200;
    if ((arr as unknown[]).length > MAX_DIGEST_ENTRIES) {
      digest[field] = (arr as unknown[]).slice(-MAX_DIGEST_ENTRIES);
    }

    await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: digest });
  },

  async _setClickContext(notifId: string, context: ClickContext): Promise<void> {
    const ctxKey = `notifCtx_${notifId}`;
    await chrome.storage.local.set({ [ctxKey]: context });

    // Auto-clean after 5 minutes to avoid storage cruft
    setTimeout(async () => {
      try {
        await chrome.storage.local.remove(ctxKey);
      } catch (_) { /* ignore */ }
    }, 5 * 60 * 1000);
  },

  // ---------------------------------------------------------------------------
  // Alarm Handler
  // ---------------------------------------------------------------------------

  /**
   * Handle alarms. Call this from the background chrome.alarms.onAlarm listener.
   * Returns true if the alarm was handled by this module.
   */
  async handleAlarm(alarm: chrome.alarms.Alarm): Promise<boolean> {
    if (alarm.name === this.ALARM_WEEKLY_DIGEST) {
      await this.generateDigest();
      return true;
    }
    return false;
  },

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  /**
   * Initialize the notification system. Call once on service worker startup.
   * Re-registers the digest alarm if the preference is enabled.
   */
  async init(): Promise<void> {
    const prefs = await this.getPreferences();
    if (prefs.digest) {
      await this.scheduleDigest();
    }
    console.log('[ScriptVault] Notification system initialized');
  }
};

export default NotificationSystem;
export { NotificationSystem };
