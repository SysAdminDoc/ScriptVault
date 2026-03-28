/**
 * Auto-reload matching tabs — debounced to prevent mass reloads on rapid saves.
 */

import type { Script } from '../types/script';
import type { Settings } from '../types/settings';
import { SettingsManager } from '../modules/storage';

// External dependency not yet migrated to TypeScript
declare function doesScriptMatchUrl(script: Script, url: string): boolean;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _autoReloadTimer: ReturnType<typeof setTimeout> | null = null;
let _autoReloadScripts: Script[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function autoReloadMatchingTabs(script: Script): Promise<void> {
  const settings = await SettingsManager.get() as unknown as Settings;
  if (!settings.autoReload) return;

  _autoReloadScripts.push(script);
  if (_autoReloadTimer) clearTimeout(_autoReloadTimer);

  _autoReloadTimer = setTimeout(async () => {
    const scripts = _autoReloadScripts;
    _autoReloadScripts = [];
    _autoReloadTimer = null;

    try {
      const tabs = await chrome.tabs.query({});
      const reloaded = new Set<number>();
      for (const tab of tabs) {
        if (tab.id === undefined || reloaded.has(tab.id)) continue;
        if (tab.url && scripts.some(s => doesScriptMatchUrl(s, tab.url!))) {
          chrome.tabs.reload(tab.id);
          reloaded.add(tab.id);
        }
      }
    } catch (e) {
      console.error('[ScriptVault] Auto-reload failed:', e);
    }
  }, 500);
}

export { _autoReloadTimer, _autoReloadScripts };
