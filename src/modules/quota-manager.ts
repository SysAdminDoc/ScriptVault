// ScriptVault v2.0.0 — Storage Quota Manager
// Monitors chrome.storage.local usage and provides cleanup utilities.
// Runs in service worker (no DOM).

const QUOTA_FALLBACK: number = 10 * 1024 * 1024; // 10MB without unlimitedStorage
const QUOTA_UNLIMITED: number = 500 * 1024 * 1024; // 500MB with unlimitedStorage
const WARNING_THRESHOLD: number = 0.85; // Warn at 85%
const CRITICAL_THRESHOLD: number = 0.95; // Critical at 95%

type UsageLevel = 'ok' | 'warning' | 'critical';

interface UsageInfo {
  bytesUsed: number;
  quota: number;
  percentage: number;
  level: UsageLevel;
}

interface CategoryEntry {
  count: number;
  bytes: number;
}

interface StorageBreakdown {
  scripts: CategoryEntry;
  scriptValues: CategoryEntry;
  requireCache: CategoryEntry;
  resourceCache: CategoryEntry;
  backups: CategoryEntry;
  analytics: CategoryEntry;
  settings: CategoryEntry;
  other: CategoryEntry;
}

interface CleanupOptions {
  requireCache?: boolean;
  errorLog?: boolean;
  cspReports?: boolean;
  tombstones?: boolean;
  npmCache?: boolean;
  analytics?: boolean;
  perfHistory?: boolean;
}

interface CleanupResult {
  freedBytes: number;
  actions: string[];
}

/** Resolve the effective quota once and cache it. */
let _resolvedQuota: number | null = null;

function measureStoredBytes(value: unknown): number {
  const serialized = JSON.stringify(value);
  return typeof serialized === 'string' ? serialized.length : 0;
}

function countStoredScripts(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length;
  return 0;
}

async function _getQuotaLimit(): Promise<number> {
  if (_resolvedQuota !== null) return _resolvedQuota;
  // Prefer navigator.storage.estimate() for the real quota
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est: StorageEstimate = await navigator.storage.estimate();
      if (est.quota) {
        _resolvedQuota = est.quota;
        return _resolvedQuota;
      }
    } catch (_) { /* fall through */ }
  }
  // Check if unlimitedStorage permission is granted
  try {
    const perms: chrome.permissions.Permissions = await chrome.permissions.getAll();
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
 */
async function getUsage(): Promise<UsageInfo> {
  const quotaLimit: number = await _getQuotaLimit();
  const bytesUsed: number = await chrome.storage.local.getBytesInUse(undefined);
  const percentage: number = quotaLimit > 0 ? bytesUsed / quotaLimit : 0;
  const level: UsageLevel = percentage >= CRITICAL_THRESHOLD ? 'critical'
    : percentage >= WARNING_THRESHOLD ? 'warning'
    : 'ok';
  return { bytesUsed, quota: quotaLimit, percentage, level };
}

/**
 * Get storage breakdown by category.
 */
async function getBreakdown(): Promise<StorageBreakdown> {
  const all: Record<string, unknown> = await chrome.storage.local.get(undefined);
  const categories: StorageBreakdown = {
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
    const size: number = measureStoredBytes(value);
    if (key === 'userscripts') {
      categories.scripts.count += countStoredScripts(value);
      categories.scripts.bytes += size;
    }
    else if (key.startsWith('script_')) { categories.scripts.count++; categories.scripts.bytes += size; }
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
 */
async function cleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
  const actions: string[] = [];
  let freedBytes: number = 0;
  const all: Record<string, unknown> = await chrome.storage.local.get(undefined);
  const keysToRemove = new Set<string>();

  const scheduleRemoval = (key: string): boolean => {
    if (!(key in all) || keysToRemove.has(key)) return false;
    freedBytes += measureStoredBytes(all[key]);
    keysToRemove.add(key);
    return true;
  };

  // 1. Clear expired require cache (>7 days)
  if (options.requireCache !== false) {
    const expiredKeys: string[] = [];
    const now: number = Date.now();
    for (const [key, value] of Object.entries(all)) {
      const entry = value as Record<string, unknown> | undefined;
      if (key.startsWith('require_cache_') && entry && typeof entry === 'object' && 'timestamp' in entry) {
        const ts = entry.timestamp as number;
        if (now - ts > 7 * 24 * 60 * 60 * 1000) {
          expiredKeys.push(key);
          freedBytes += measureStoredBytes(value);
        }
      }
      if (key.startsWith('res_cache_') && entry && typeof entry === 'object' && 'timestamp' in entry) {
        const ts = entry.timestamp as number;
        if (now - ts > 7 * 24 * 60 * 60 * 1000) {
          expiredKeys.push(key);
          freedBytes += measureStoredBytes(value);
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
    const errorLog = all.errorLog as unknown[] | undefined;
    if (errorLog && errorLog.length > 200) {
      const trimmed: unknown[] = errorLog.slice(-200);
      const removed: number = errorLog.length - trimmed.length;
      await chrome.storage.local.set({ errorLog: trimmed });
      actions.push(`Pruned ${removed} error log entries`);
      freedBytes += Math.max(0, measureStoredBytes(errorLog) - measureStoredBytes(trimmed));
    }
  }

  // 5. Trim CSP reports to 100
  if (options.cspReports !== false) {
    const cspReports = all.sv_csp_reports as unknown[] | undefined;
    if (cspReports && cspReports.length > 100) {
      const trimmed: unknown[] = cspReports.slice(-100);
      await chrome.storage.local.set({ sv_csp_reports: trimmed });
      actions.push('Pruned old CSP reports');
      freedBytes += Math.max(0, measureStoredBytes(cspReports) - measureStoredBytes(trimmed));
    }
  }

  // 6. Clear old sync tombstones (>30 days)
  if (options.tombstones !== false) {
    const syncTombstones = all.syncTombstones as Record<string, number> | undefined;
    if (syncTombstones) {
      const now: number = Date.now();
      const cutoff: number = 30 * 24 * 60 * 60 * 1000;
      let pruned: number = 0;
      const nextTombstones = { ...syncTombstones };
      for (const [id, ts] of Object.entries(syncTombstones)) {
        if (ts !== undefined && now - ts > cutoff) { delete nextTombstones[id]; pruned++; }
      }
      if (pruned > 0) {
        if (Object.keys(nextTombstones).length === 0) {
          await chrome.storage.local.remove('syncTombstones');
        } else {
          await chrome.storage.local.set({ syncTombstones: nextTombstones });
        }
        actions.push(`Pruned ${pruned} sync tombstones`);
        freedBytes += Math.max(0, measureStoredBytes(syncTombstones) - (Object.keys(nextTombstones).length === 0 ? 0 : measureStoredBytes(nextTombstones)));
      }
    }
  }

  // 7. Remove npm cache if critical
  if (options.npmCache) {
    if (scheduleRemoval('npmCache')) {
      actions.push('Cleared npm package cache');
    }
  }

  // 8. Remove analytics data when asked
  if (options.analytics) {
    const analyticsKeys = Object.keys(all).filter((key) => key === 'analytics' || key.startsWith('sv_analytics'));
    const removedAnalytics = analyticsKeys.filter((key) => scheduleRemoval(key));
    if (removedAnalytics.length > 0) {
      actions.push(`Cleared ${removedAnalytics.length} analytics entr${removedAnalytics.length === 1 ? 'y' : 'ies'}`);
    }
  }

  // 9. Remove performance history when asked
  if (options.perfHistory) {
    if (scheduleRemoval('perfHistory')) {
      actions.push('Cleared performance history');
    }
  }

  if (keysToRemove.size > 0) {
    await chrome.storage.local.remove([...keysToRemove]);
  }

  return { freedBytes, actions };
}

/**
 * Auto-cleanup if storage is above warning threshold.
 */
async function autoCleanup(): Promise<CleanupResult | null> {
  const usage: UsageInfo = await getUsage();
  if (usage.level === 'ok') return null;

  console.log(`[QuotaManager] Storage at ${(usage.percentage * 100).toFixed(1)}% — running cleanup`);
  const result: CleanupResult = await cleanup({
    npmCache: usage.level === 'critical'
  });

  if (usage.level === 'critical' && result.freedBytes < 500000) {
    // Still critical — try more aggressive cleanup
    const aggressiveResult = await cleanup({ analytics: true, perfHistory: true, errorLog: true, cspReports: true });
    return {
      freedBytes: result.freedBytes + aggressiveResult.freedBytes,
      actions: [...result.actions, ...aggressiveResult.actions]
    };
  }

  return result;
}

export const QuotaManager = { getUsage, getBreakdown, cleanup, autoCleanup } as const;

export type { UsageInfo, UsageLevel, CategoryEntry, StorageBreakdown, CleanupOptions, CleanupResult };
