// ScriptVault v2.0.0 — Storage Quota Manager
// Monitors chrome.storage.local usage and provides cleanup utilities.
// Runs in service worker (no DOM).

const QuotaManager = (() => {
  'use strict';

  const QUOTA_FALLBACK = 10 * 1024 * 1024; // 10MB without unlimitedStorage
  const QUOTA_UNLIMITED = 500 * 1024 * 1024; // 500MB with unlimitedStorage
  const WARNING_THRESHOLD = 0.85; // Warn at 85%
  const CRITICAL_THRESHOLD = 0.95; // Critical at 95%

  /** Resolve the effective quota once and cache it. */
  let _resolvedQuota = null;
  async function _getQuotaLimit() {
    if (_resolvedQuota !== null) return _resolvedQuota;
    // Prefer navigator.storage.estimate() for the real quota
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota) {
          _resolvedQuota = est.quota;
          return _resolvedQuota;
        }
      } catch (_) { /* fall through */ }
    }
    // Check if unlimitedStorage permission is granted
    try {
      const perms = await chrome.permissions.getAll();
      if (perms.permissions?.includes('unlimitedStorage')) {
        _resolvedQuota = QUOTA_UNLIMITED;
        return _resolvedQuota;
      }
    } catch (_) { /* fall through */ }
    _resolvedQuota = QUOTA_FALLBACK;
    return _resolvedQuota;
  }

  /**
   * Get current storage usage.
   * @returns {{ bytesUsed: number, quota: number, percentage: number, level: string }}
   */
  async function getUsage() {
    const quotaLimit = await _getQuotaLimit();
    const bytesUsed = await chrome.storage.local.getBytesInUse(null);
    const percentage = quotaLimit > 0 ? bytesUsed / quotaLimit : 0;
    const level = percentage >= CRITICAL_THRESHOLD ? 'critical'
      : percentage >= WARNING_THRESHOLD ? 'warning'
      : 'ok';
    return { bytesUsed, quota: quotaLimit, percentage, level };
  }

  /**
   * Get storage breakdown by category.
   */
  async function getBreakdown() {
    const all = await chrome.storage.local.get(null);
    const categories = {
      scripts: { count: 0, bytes: 0 },
      scriptValues: { count: 0, bytes: 0 },
      requireCache: { count: 0, bytes: 0 },
      resourceCache: { count: 0, bytes: 0 },
      backups: { count: 0, bytes: 0 },
      analytics: { count: 0, bytes: 0 },
      settings: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 }
    };

    for (const [key, value] of Object.entries(all)) {
      const size = JSON.stringify(value).length;
      if (key === 'userscripts' || key.startsWith('script_')) { categories.scripts.count++; categories.scripts.bytes += size; }
      else if (key.startsWith('values_') || key.startsWith('SV_GM_')) { categories.scriptValues.count++; categories.scriptValues.bytes += size; }
      else if (key.startsWith('require_cache_')) { categories.requireCache.count++; categories.requireCache.bytes += size; }
      else if (key.startsWith('res_cache_')) { categories.resourceCache.count++; categories.resourceCache.bytes += size; }
      else if (key.startsWith('autoBackup') || key === 'autoBackups') { categories.backups.count++; categories.backups.bytes += size; }
      else if (key.startsWith('sv_analytics') || key === 'analytics' || key === 'perfHistory') { categories.analytics.count++; categories.analytics.bytes += size; }
      else if (key === 'settings' || key.startsWith('sv_') || key.startsWith('notification') || key.startsWith('gamification')) { categories.settings.count++; categories.settings.bytes += size; }
      else { categories.other.count++; categories.other.bytes += size; }
    }

    return categories;
  }

  /**
   * Clean up storage to free space.
   * @param {object} options - What to clean
   * @returns {{ freedBytes: number, actions: string[] }}
   */
  async function cleanup(options = {}) {
    const actions = [];
    let freedBytes = 0;

    // 1. Clear expired require cache (>7 days)
    if (options.requireCache !== false) {
      const all = await chrome.storage.local.get(null);
      const expiredKeys = [];
      const now = Date.now();
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith('require_cache_') && value.timestamp) {
          if (now - value.timestamp > 7 * 24 * 60 * 60 * 1000) {
            expiredKeys.push(key);
            freedBytes += JSON.stringify(value).length;
          }
        }
        if (key.startsWith('res_cache_') && value.timestamp) {
          if (now - value.timestamp > 7 * 24 * 60 * 60 * 1000) {
            expiredKeys.push(key);
            freedBytes += JSON.stringify(value).length;
          }
        }
      }
      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys);
        actions.push(`Removed ${expiredKeys.length} expired cache entries`);
      }
    }

    // 2. Trim error log to 200 entries
    if (options.errorLog !== false) {
      const errData = await chrome.storage.local.get('errorLog');
      if (errData.errorLog && errData.errorLog.length > 200) {
        const trimmed = errData.errorLog.slice(-200);
        const removed = errData.errorLog.length - trimmed.length;
        await chrome.storage.local.set({ errorLog: trimmed });
        actions.push(`Pruned ${removed} error log entries`);
        freedBytes += removed * 300;
      }
    }

    // 5. Trim CSP reports to 100
    if (options.cspReports !== false) {
      const cspData = await chrome.storage.local.get('sv_csp_reports');
      if (cspData.sv_csp_reports && cspData.sv_csp_reports.length > 100) {
        const trimmed = cspData.sv_csp_reports.slice(-100);
        await chrome.storage.local.set({ sv_csp_reports: trimmed });
        actions.push('Pruned old CSP reports');
      }
    }

    // 6. Clear old sync tombstones (>30 days)
    if (options.tombstones !== false) {
      const tombData = await chrome.storage.local.get('syncTombstones');
      if (tombData.syncTombstones) {
        const now = Date.now();
        const cutoff = 30 * 24 * 60 * 60 * 1000;
        let pruned = 0;
        for (const [id, ts] of Object.entries(tombData.syncTombstones)) {
          if (now - ts > cutoff) { delete tombData.syncTombstones[id]; pruned++; }
        }
        if (pruned > 0) {
          await chrome.storage.local.set({ syncTombstones: tombData.syncTombstones });
          actions.push(`Pruned ${pruned} sync tombstones`);
        }
      }
    }

    // 7. Remove npm cache if critical
    if (options.npmCache) {
      await chrome.storage.local.remove('npmCache');
      actions.push('Cleared npm package cache');
      freedBytes += 5000;
    }

    return { freedBytes, actions };
  }

  /**
   * Auto-cleanup if storage is above warning threshold.
   */
  async function autoCleanup() {
    const usage = await getUsage();
    if (usage.level === 'ok') return null;

    console.log(`[QuotaManager] Storage at ${(usage.percentage * 100).toFixed(1)}% — running cleanup`);
    const result = await cleanup({
      npmCache: usage.level === 'critical'
    });

    if (usage.level === 'critical' && result.freedBytes < 500000) {
      // Still critical — try more aggressive cleanup
      await cleanup({ analytics: true, perfHistory: true, errorLog: true, cspReports: true });
    }

    return result;
  }

  return { getUsage, getBreakdown, cleanup, autoCleanup };
})();
