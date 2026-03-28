/**
 * Badge management — updates the extension toolbar badge per-tab.
 */

import type { Script } from '../types/script';
import type { Settings } from '../types/settings';
import { SettingsManager, ScriptStorage } from '../modules/storage';

// External dependencies not yet migrated to TypeScript
declare function doesScriptMatchUrl(script: Script, url: string): boolean;
declare function matchIncludePattern(pattern: string, url: string, urlObj: URL): boolean;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function updateBadge(tabId: number | null = null): Promise<void> {
  const settings = await SettingsManager.get() as unknown as Settings;

  if (!settings.showBadge || settings.enabled === false) {
    chrome.action.setBadgeText({ text: '', tabId: tabId ?? undefined });
    return;
  }

  // If no specific tab, update all tabs in parallel — fetch settings+scripts once and share
  if (!tabId) {
    try {
      const [tabs, scripts] = await Promise.all([
        chrome.tabs.query({}),
        ScriptStorage.getAll(),
      ]);
      await Promise.allSettled(
        tabs
          .filter((t): t is chrome.tabs.Tab & { id: number; url: string } => t.id !== undefined && !!t.url)
          .map(t => updateBadgeForTab(t.id, t.url, settings, scripts)),
      );
    } catch (_e) {
      chrome.action.setBadgeText({ text: '' });
    }
    return;
  }
}

/**
 * Update badge for a specific tab based on its URL.
 * Accepts optional pre-fetched settings/scripts to avoid redundant cache reads
 * when called from updateBadge() in a loop over many tabs.
 */
export async function updateBadgeForTab(
  tabId: number,
  url: string | undefined,
  prefetchedSettings?: Settings | null,
  prefetchedScripts?: Script[] | null,
): Promise<void> {
  const settings: Settings = prefetchedSettings ?? (await SettingsManager.get() as unknown as Settings);

  if (!settings.showBadge || settings.enabled === false) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  if (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:')
  ) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  try {
    // Check global page filter
    if (isUrlBlockedByGlobalSettings(url, settings)) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const scripts: Script[] = prefetchedScripts ?? await ScriptStorage.getAll();
    const matchingScripts = scripts.filter(
      script => script.enabled && doesScriptMatchUrl(script, url),
    );

    const badgeInfo = settings.badgeInfo || 'running';
    let badgeText = '';
    if (badgeInfo === 'running') {
      badgeText = matchingScripts.length > 0 ? String(matchingScripts.length) : '';
    } else if (badgeInfo === 'total') {
      const allEnabled = scripts.filter(s => s.enabled).length;
      badgeText = allEnabled > 0 ? String(allEnabled) : '';
    }
    // badgeInfo === 'none' leaves badgeText empty
    chrome.action.setBadgeText({ text: badgeText, tabId });
    chrome.action.setBadgeBackgroundColor({ color: settings.badgeColor || '#22c55e', tabId });
  } catch (e) {
    console.error('[ScriptVault] Failed to update badge:', e);
  }
}

/**
 * Check if URL is blocked by global page filter or denied hosts.
 */
export function isUrlBlockedByGlobalSettings(url: string, globalSettings: Settings): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // Denied hosts
    const denied = globalSettings.deniedHosts;
    if (denied && Array.isArray(denied)) {
      for (const host of denied) {
        if (host && (urlObj.hostname === host || urlObj.hostname.endsWith('.' + host))) {
          return true;
        }
      }
    }
    // Page filter mode
    const mode = globalSettings.pageFilterMode || 'blacklist';
    if (mode === 'whitelist') {
      const whitelist = (globalSettings.whitelistedPages || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      if (whitelist.length > 0) {
        const matched = whitelist.some(p => matchIncludePattern(p, url, urlObj));
        if (!matched) return true;
      }
    } else if (mode === 'blacklist') {
      const blacklist = (globalSettings.blacklistedPages || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      if (blacklist.length > 0) {
        const matched = blacklist.some(p => matchIncludePattern(p, url, urlObj));
        if (matched) return true;
      }
    }
  } catch (_e) {
    // invalid URL — not blocked
  }
  return false;
}
