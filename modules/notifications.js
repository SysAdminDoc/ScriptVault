// ============================================================================
// Generated from src/modules/notifications.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const NotificationSystem = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/modules/notifications.ts
  var notifications_exports = {};
  __export(notifications_exports, {
    NotificationSystem: () => NotificationSystem,
    default: () => notifications_default
  });
  module.exports = __toCommonJS(notifications_exports);
  var NotificationSystem = {
    ALARM_WEEKLY_DIGEST: "scriptvault-weekly-digest",
    STORAGE_KEY_PREFS: "notificationPrefs",
    STORAGE_KEY_DIGEST: "weeklyDigest",
    STORAGE_KEY_ERROR_COUNTS: "notifErrorCounts",
    STORAGE_KEY_RATE_LIMITS: "notifRateLimits",
    // Default notification preferences
    defaultPrefs: {
      updates: true,
      errors: true,
      digest: false,
      security: true,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      // 10 PM
      quietHoursEnd: 7
      // 7 AM
    },
    // In-memory caches (rebuilt from storage on service worker wake)
    _prefsCache: null,
    _errorCounts: null,
    _rateLimits: null,
    // ---------------------------------------------------------------------------
    // Preferences
    // ---------------------------------------------------------------------------
    async getPreferences() {
      if (this._prefsCache) return { ...this._prefsCache };
      const data = await chrome.storage.local.get(this.STORAGE_KEY_PREFS);
      const stored = data[this.STORAGE_KEY_PREFS];
      this._prefsCache = { ...this.defaultPrefs, ...stored };
      return { ...this._prefsCache };
    },
    async setPreferences(prefs) {
      const current = await this.getPreferences();
      this._prefsCache = { ...current, ...prefs };
      await chrome.storage.local.set({ [this.STORAGE_KEY_PREFS]: this._prefsCache });
      if ("digest" in prefs) {
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
    async _isQuietHours() {
      const prefs = await this.getPreferences();
      if (!prefs.quietHoursEnabled) return false;
      const now = /* @__PURE__ */ new Date();
      const hour = now.getHours();
      const { quietHoursStart, quietHoursEnd } = prefs;
      if (quietHoursStart > quietHoursEnd) {
        return hour >= quietHoursStart || hour < quietHoursEnd;
      }
      return hour >= quietHoursStart && hour < quietHoursEnd;
    },
    // ---------------------------------------------------------------------------
    // Script Update Notifications
    // ---------------------------------------------------------------------------
    /**
     * Notify about script updates. Accepts a single script or an array.
     * Each item: { id, name, version, oldVersion? }
     */
    async notifyUpdate(scripts) {
      const prefs = await this.getPreferences();
      if (!prefs.updates) return;
      const list = Array.isArray(scripts) ? scripts : [scripts];
      if (list.length === 0) return;
      await this._addDigestData("updatedScripts", list.map((s) => ({
        id: s.id,
        name: s.name,
        version: s.version,
        oldVersion: s.oldVersion ?? null,
        timestamp: Date.now()
      })));
      if (await this._isQuietHours()) return;
      let title;
      let message;
      let notifId;
      if (list.length === 1) {
        const s = list[0];
        if (!s) return;
        title = "Script Updated";
        message = `${s.name} updated to v${s.version}`;
        notifId = `update-${s.id}-${Date.now()}`;
      } else {
        title = `${list.length} Scripts Updated`;
        message = list.map((s) => s.name).join(", ");
        notifId = `update-batch-${Date.now()}`;
      }
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title,
          message,
          priority: 0
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create update notification:", e);
      }
      await this._setClickContext(
        notifId,
        list.length === 1 ? {
          action: "openScript",
          scriptId: list[0]?.id ?? null
        } : {
          action: "openDashboard"
        }
      );
    },
    // ---------------------------------------------------------------------------
    // Error Alerts
    // ---------------------------------------------------------------------------
    /**
     * Track and notify on script errors.
     * Notifies after 3 consecutive errors, rate-limited to 1/hour per script.
     */
    async notifyError(scriptId, error) {
      const prefs = await this.getPreferences();
      if (!prefs.errors) return;
      if (!this._errorCounts) {
        const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
        this._errorCounts = data[this.STORAGE_KEY_ERROR_COUNTS] ?? {};
      }
      if (!this._rateLimits) {
        const data = await chrome.storage.local.get(this.STORAGE_KEY_RATE_LIMITS);
        this._rateLimits = data[this.STORAGE_KEY_RATE_LIMITS] ?? {};
      }
      this._errorCounts[scriptId] = (this._errorCounts[scriptId] ?? 0) + 1;
      await chrome.storage.local.set({ [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts });
      const errorObj = error;
      await this._addDigestData("errors", [{
        scriptId,
        message: typeof error === "string" ? error : errorObj?.message ?? "Unknown error",
        timestamp: Date.now()
      }]);
      const currentCount = this._errorCounts[scriptId] ?? 0;
      if (currentCount < 3) return;
      const lastNotif = this._rateLimits[scriptId] ?? 0;
      const ONE_HOUR = 36e5;
      if (Date.now() - lastNotif < ONE_HOUR) return;
      if (await this._isQuietHours()) return;
      const errorMsg = typeof error === "string" ? error : errorObj?.message ?? "Unknown error";
      const snippet = errorMsg.length > 120 ? errorMsg.substring(0, 117) + "..." : errorMsg;
      let scriptName = scriptId;
      try {
        if (typeof ScriptStorage !== "undefined") {
          const script = await ScriptStorage.get(scriptId);
          if (script?.meta?.name) scriptName = script.meta.name;
        }
      } catch (_) {
      }
      const notifId = `error-${scriptId}-${Date.now()}`;
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: `Script Error: ${scriptName}`,
          message: `${currentCount} consecutive errors
  ${snippet}`,
          priority: 1
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create error notification:", e);
      }
      this._errorCounts[scriptId] = 0;
      this._rateLimits[scriptId] = Date.now();
      await chrome.storage.local.set({
        [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts,
        [this.STORAGE_KEY_RATE_LIMITS]: this._rateLimits
      });
      await this._setClickContext(notifId, {
        action: "openScript",
        scriptId
      });
    },
    /**
     * Reset the consecutive error count for a script (call on successful execution).
     */
    async resetErrorCount(scriptId) {
      if (!this._errorCounts) {
        const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
        this._errorCounts = data[this.STORAGE_KEY_ERROR_COUNTS] ?? {};
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
    async notifyBlacklist(scriptId, reason) {
      const prefs = await this.getPreferences();
      if (!prefs.security) return;
      let scriptName = scriptId;
      try {
        if (typeof ScriptStorage !== "undefined") {
          const script = await ScriptStorage.get(scriptId);
          if (script?.meta?.name) scriptName = script.meta.name;
        }
      } catch (_) {
      }
      const notifId = `blacklist-${scriptId}-${Date.now()}`;
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: "Security Warning",
          message: `${scriptName}: ${reason}`,
          priority: 2,
          requireInteraction: true
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create blacklist notification:", e);
      }
      await this._addDigestData("securityAlerts", [{
        scriptId,
        scriptName,
        reason,
        timestamp: Date.now()
      }]);
      await this._setClickContext(notifId, {
        action: "openScript",
        scriptId
      });
    },
    // ---------------------------------------------------------------------------
    // Weekly Digest
    // ---------------------------------------------------------------------------
    /**
     * Schedule the weekly digest alarm. Fires every 7 days.
     */
    async scheduleDigest() {
      const prefs = await this.getPreferences();
      if (!prefs.digest) return;
      const existing = await chrome.alarms.get(this.ALARM_WEEKLY_DIGEST);
      if (existing) return;
      const WEEK_MS = 7 * 24 * 60 * 60 * 1e3;
      await chrome.alarms.create(this.ALARM_WEEKLY_DIGEST, {
        delayInMinutes: WEEK_MS / 6e4,
        periodInMinutes: WEEK_MS / 6e4
      });
      console.log("[ScriptVault] Weekly digest alarm scheduled");
    },
    /**
     * Generate and display the weekly digest.
     * Compiles: scripts updated, errors encountered, storage usage, stale scripts.
     */
    async generateDigest() {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_DIGEST);
      const digest = data[this.STORAGE_KEY_DIGEST] ?? this._emptyDigest();
      let storageUsage = null;
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate) {
          storageUsage = {
            used: estimate.usage ?? 0,
            quota: estimate.quota ?? 0
          };
        }
      } catch (_) {
      }
      let staleScripts = [];
      try {
        if (typeof ScriptStorage !== "undefined") {
          const all = await ScriptStorage.getAll();
          const NINETY_DAYS = 90 * 24 * 60 * 60 * 1e3;
          const now = Date.now();
          staleScripts = all.filter((s) => s.updatedAt && now - s.updatedAt > NINETY_DAYS).map((s) => ({ id: s.id, name: s.meta?.name ?? "Unknown", lastUpdated: s.updatedAt }));
        }
      } catch (_) {
      }
      const errors = digest.errors ?? [];
      const summary = {
        period: {
          start: digest.periodStart ?? Date.now() - 7 * 24 * 60 * 60 * 1e3,
          end: Date.now()
        },
        updatedScripts: digest.updatedScripts ?? [],
        totalErrors: errors.length,
        uniqueErrorScripts: [...new Set(errors.map((e) => e.scriptId))].length,
        securityAlerts: digest.securityAlerts ?? [],
        storageUsage,
        staleScripts,
        generatedAt: Date.now()
      };
      const lines = [];
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
      if (storageUsage && storageUsage.quota > 0) {
        const pct = (storageUsage.used / storageUsage.quota * 100).toFixed(1);
        lines.push(`Storage: ${pct}% used`);
      }
      if (lines.length === 0) {
        lines.push("No activity this week");
      }
      const notifId = `digest-${Date.now()}`;
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: "ScriptVault Weekly Digest",
          message: lines.join("\n"),
          priority: 0
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create digest notification:", e);
      }
      summary.message = lines.join("\n");
      await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: {
        ...this._emptyDigest(),
        lastSummary: summary
      } });
      await this._setClickContext(notifId, { action: "openDashboard" });
      return summary;
    },
    // ---------------------------------------------------------------------------
    // Notification Click Handler
    // ---------------------------------------------------------------------------
    /**
     * Handle notification clicks. Call this from the background
     * chrome.notifications.onClicked listener.
     */
    async handleClick(notifId) {
      const ctxKey = `notifCtx_${notifId}`;
      const sessionStorage = chrome.storage.session;
      const sessionData = sessionStorage?.get ? await sessionStorage.get(ctxKey) : {};
      const localData = sessionData[ctxKey] ? {} : await chrome.storage.local.get(ctxKey);
      const ctx = sessionData[ctxKey] ?? localData[ctxKey];
      const cleanup = [chrome.storage.local.remove(ctxKey)];
      if (sessionStorage?.remove) {
        cleanup.unshift(sessionStorage.remove(ctxKey));
      }
      await Promise.allSettled(cleanup);
      await chrome.notifications.clear(notifId);
      if (!ctx) return;
      const dashboardUrl = chrome.runtime.getURL("pages/dashboard.html");
      if (ctx.action === "openScript" && ctx.scriptId) {
        try {
          await chrome.tabs.create({ url: `${dashboardUrl}#script_${encodeURIComponent(ctx.scriptId)}` });
        } catch (_) {
          await chrome.tabs.create({ url: dashboardUrl });
        }
      } else if (ctx.action === "openDashboard") {
        await chrome.tabs.create({ url: dashboardUrl });
      }
    },
    // ---------------------------------------------------------------------------
    // Internal Helpers
    // ---------------------------------------------------------------------------
    _emptyDigest() {
      return {
        periodStart: Date.now(),
        updatedScripts: [],
        errors: [],
        securityAlerts: [],
        lastSummary: null
      };
    },
    async _addDigestData(field, items) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_DIGEST);
      const digest = data[this.STORAGE_KEY_DIGEST] ?? this._emptyDigest();
      let arr = digest[field];
      if (!Array.isArray(arr)) {
        arr = [];
        digest[field] = arr;
      }
      arr.push(...items);
      const MAX_DIGEST_ENTRIES = 200;
      if (arr.length > MAX_DIGEST_ENTRIES) {
        digest[field] = arr.slice(-MAX_DIGEST_ENTRIES);
      }
      await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: digest });
    },
    async _setClickContext(notifId, context) {
      const ctxKey = `notifCtx_${notifId}`;
      if (chrome.storage.session?.set) {
        await chrome.storage.session.set({ [ctxKey]: context });
        return;
      }
      await chrome.storage.local.set({ [ctxKey]: context });
      try {
        await chrome.alarms.create(`notifCtx_clean_${notifId}`, { delayInMinutes: 5 });
      } catch (_) {
      }
    },
    // ---------------------------------------------------------------------------
    // Alarm Handler
    // ---------------------------------------------------------------------------
    /**
     * Handle alarms. Call this from the background chrome.alarms.onAlarm listener.
     * Returns true if the alarm was handled by this module.
     */
    async handleAlarm(alarm) {
      if (alarm.name === this.ALARM_WEEKLY_DIGEST) {
        await this.generateDigest();
        return true;
      }
      if (alarm.name.startsWith("notifCtx_clean_")) {
        const notifId = alarm.name.replace("notifCtx_clean_", "");
        const ctxKey = `notifCtx_${notifId}`;
        await chrome.storage.local.remove(ctxKey).catch(() => {
        });
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
    async init() {
      const prefs = await this.getPreferences();
      if (prefs.digest) {
        await this.scheduleDigest();
      }
      console.log("[ScriptVault] Notification system initialized");
    }
  };
  var notifications_default = NotificationSystem;
  return module.exports.default || module.exports.NotificationSystem || module.exports;
})();
