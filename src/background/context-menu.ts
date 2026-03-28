/**
 * Context menus, click handler, and keyboard shortcuts.
 * Strict TypeScript migration from background.core.js lines 3221-3422.
 */

import type { Script } from '../types/script';
import type { Settings } from '../types/settings';

// ---------------------------------------------------------------------------
// External dependencies (not yet migrated to TS modules)
// ---------------------------------------------------------------------------

declare const SettingsManager: {
  get(): Promise<Settings>;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
};

declare const ScriptStorage: {
  get(id: string): Promise<Script | null>;
  getAll(): Promise<Script[]>;
};

declare const ScriptValues: {
  getAll(scriptId: string): Promise<Record<string, unknown>>;
};

declare const BackupScheduler: {
  init(): Promise<void>;
} | undefined;

declare const NotificationSystem: {
  scheduleDigest(): Promise<void>;
} | undefined;

declare const PublicAPI: {
  init(): void;
} | undefined;

declare function registerAllScripts(): Promise<void>;
declare function updateBadge(tabId?: number | null): Promise<void>;
declare function fetchRequireScript(url: string): Promise<string | null>;
declare function buildWrappedScript(
  script: Script,
  requireScripts: Array<{ url: string; code: string }>,
  storedValues: Record<string, unknown>,
  regexIncludes: string[],
  regexExcludes: string[],
): string;
declare function debugLog(...args: unknown[]): void;

// ---------------------------------------------------------------------------
// Context Menu Setup
// ---------------------------------------------------------------------------

export async function setupContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();
  const settings = await SettingsManager.get() as Settings & { enableContextMenu?: boolean };
  if (settings.enableContextMenu === false) return;

  chrome.contextMenus.create({
    id: 'scriptvault-new',
    title: 'Create script for this site',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'scriptvault-dashboard',
    title: 'Open ScriptVault Dashboard',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'scriptvault-toggle',
    title: 'Toggle all scripts',
    contexts: ['page'],
  });

  // v2.0: Install from link — right-click a .user.js link to install
  chrome.contextMenus.create({
    id: 'scriptvault-install-link',
    title: 'Install userscript from link',
    contexts: ['link'],
    targetUrlPatterns: ['*://*/*.user.js', '*://*/*.user.js?*'],
  });

  // Add context menu entries for @run-at context-menu scripts
  const scripts: Script[] = await ScriptStorage.getAll();
  const contextScripts: Script[] = scripts.filter(
    (s) => s.enabled !== false && s.meta && s.meta['run-at'] === 'context-menu',
  );
  if (contextScripts.length > 0) {
    chrome.contextMenus.create({
      id: 'scriptvault-separator',
      type: 'separator',
      contexts: ['page', 'selection', 'link', 'image'],
    });
    for (const script of contextScripts) {
      chrome.contextMenus.create({
        id: `scriptvault-ctx-${script.id}`,
        title: script.meta.name || script.id,
        contexts: ['page', 'selection', 'link', 'image'],
      });
    }
  }
}

// ---------------------------------------------------------------------------
// onInstalled listener
// ---------------------------------------------------------------------------

export function registerOnInstalledListener(): void {
  chrome.runtime.onInstalled.addListener(async () => {
    setupContextMenus();

    // v2.0: Initialize backup scheduler (needs alarm registration on install)
    if (typeof BackupScheduler !== 'undefined') {
      try {
        await BackupScheduler.init();
      } catch (e) {
        console.error('[ScriptVault] BackupScheduler init error:', e);
      }
    }

    // v2.0: Schedule notification digest (needs alarm registration on install)
    if (typeof NotificationSystem !== 'undefined') {
      try {
        await NotificationSystem.scheduleDigest();
      } catch (e) {
        console.error('[ScriptVault] Digest schedule error:', e);
      }
    }

    // v2.0: Register public API listeners
    if (typeof PublicAPI !== 'undefined') {
      try {
        PublicAPI.init();
      } catch (e) {
        console.error('[ScriptVault] PublicAPI init error:', e);
      }
    }

    // Note: Migration.run() is called in the main init() function, not here,
    // to avoid running it twice on install (onInstalled + init both fire).
  });
}

// ---------------------------------------------------------------------------
// Context Menu Click Handler
// ---------------------------------------------------------------------------

export function registerContextMenuClickListener(): void {
  chrome.contextMenus.onClicked.addListener(
    async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
      switch (info.menuItemId) {
        case 'scriptvault-new': {
          const url = new URL(tab!.url!);
          chrome.tabs.create({
            url: `pages/dashboard.html?new=1&host=${encodeURIComponent(url.hostname)}`,
          });
          break;
        }
        case 'scriptvault-dashboard':
          chrome.tabs.create({ url: 'pages/dashboard.html' });
          break;
        case 'scriptvault-toggle': {
          const settings: Settings = await SettingsManager.get();
          await SettingsManager.set('enabled', !settings.enabled);
          await registerAllScripts();
          await updateBadge();
          break;
        }
        case 'scriptvault-install-link': {
          // v2.0: Install userscript from a right-clicked .user.js link
          const linkUrl: string | undefined = info.linkUrl;
          if (linkUrl) {
            try {
              const response: Response = await fetch(linkUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const code: string = await response.text();
              if (code.includes('==UserScript==')) {
                await chrome.storage.local.set({
                  pendingInstall: { code, url: linkUrl, timestamp: Date.now() },
                });
                chrome.tabs.create({ url: chrome.runtime.getURL('pages/install.html') });
              } else {
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'images/icon128.png',
                  title: 'Not a Userscript',
                  message: 'The linked file does not contain a valid ==UserScript== block.',
                });
              }
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon128.png',
                title: 'Install Failed',
                message: `Could not fetch script: ${message}`,
              });
            }
          }
          break;
        }
        default: {
          // Handle @run-at context-menu script execution
          if (
            info.menuItemId &&
            typeof info.menuItemId === 'string' &&
            info.menuItemId.startsWith('scriptvault-ctx-')
          ) {
            const scriptId: string = info.menuItemId.replace('scriptvault-ctx-', '');
            const script: Script | null = await ScriptStorage.get(scriptId);
            if (script && tab?.id) {
              try {
                // Build wrapped script with GM API support (same as auto-registered scripts)
                const meta = script.meta;
                const requires: string[] = Array.isArray(meta.require)
                  ? meta.require
                  : meta.require
                    ? [meta.require]
                    : [];
                const requireScripts: Array<{ url: string; code: string }> = [];
                for (const url of requires) {
                  try {
                    const code: string | null = await fetchRequireScript(url);
                    if (code) requireScripts.push({ url, code });
                  } catch (_e) {
                    // Ignored — require fetch failure is non-fatal
                  }
                }
                const storedValues: Record<string, unknown> =
                  (await ScriptValues.getAll(script.id)) || {};
                const wrappedCode: string = buildWrappedScript(
                  script,
                  requireScripts,
                  storedValues,
                  [],
                  [],
                );
                // Execute in ISOLATED world (content script context) which has chrome.runtime access
                // The wrapper's sendToBackground uses chrome.runtime.sendMessage directly
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: ((code: string) => {
                    (0, eval)(code);
                  }) as unknown as () => void,
                  args: [wrappedCode],
                });
                // Feedback notification
                const settings: Settings = await SettingsManager.get();
                if (settings.notifyOnError !== false) {
                  chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/icon128.png',
                    title: 'Script Executed',
                    message: `${script.meta.name} ran via context menu`,
                  });
                }
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : 'Unknown error';
                console.error(`[ScriptVault] Context-menu script execution failed:`, e);
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'images/icon128.png',
                  title: 'Script Failed',
                  message: `${script.meta.name}: ${message}`,
                });
              }
            }
          }
          break;
        }
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts
// ---------------------------------------------------------------------------

export function registerKeyboardShortcutListener(): void {
  chrome.commands.onCommand.addListener(async (command: string) => {
    switch (command) {
      case 'open_dashboard':
        chrome.tabs.create({ url: 'pages/dashboard.html' });
        break;
      case 'toggle_scripts': {
        const settings: Settings = await SettingsManager.get();
        await SettingsManager.set('enabled', !settings.enabled);
        await registerAllScripts();
        await updateBadge();

        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: 'ScriptVault',
          message: settings.enabled ? 'Scripts disabled' : 'Scripts enabled',
        });
        break;
      }
    }
  });
}
