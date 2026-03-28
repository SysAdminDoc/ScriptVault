/**
 * Userscript installation handler — intercepts .user.js navigation and
 * provides programmatic install-from-URL.
 * Strict TypeScript migration from background.core.js lines 3541-3697.
 */

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
};

declare function parseUserscript(code: string):
  | { meta: ScriptMeta; code: string; metaBlock: string; error?: undefined }
  | { error: string; meta?: undefined; code?: undefined; metaBlock?: undefined };

declare function registerAllScripts(): Promise<void>;
declare function updateBadge(tabId?: number | null): Promise<void>;
declare function autoReloadMatchingTabs(script: Script): Promise<void>;
declare function formatBytes(bytes: number): string;
declare function generateId(): string;
declare function debugLog(...args: unknown[]): void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** De-duplicate concurrent fetches for the same URL */
export const _pendingFetches: Set<string> = new Set();

/** Maximum allowed script size (5 MB) */
export const MAX_SCRIPT_SIZE: number = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// webNavigation listener — intercept .user.js navigation
// ---------------------------------------------------------------------------

export function registerWebNavigationListener(): void {
  chrome.webNavigation.onBeforeNavigate.addListener(
    async (details: { tabId: number; url: string; frameId: number }) => {
      // Only handle main frame navigation
      if (details.frameId !== 0) return;

      const url: string = details.url;

      // Check if this is a .user.js URL
      if (!url.match(/\.user\.js(\?.*)?$/i)) return;

      // Don't intercept extension pages
      if (url.startsWith('chrome-extension://')) return;

      // Dedup concurrent fetches for same URL
      if (_pendingFetches.has(url)) return;
      _pendingFetches.add(url);

      debugLog('Intercepting userscript URL:', url);

      try {
        // Fetch with timeout
        const controller = new AbortController();
        const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
          () => controller.abort(),
          30000,
        );
        const response: Response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check content length before reading body
        const contentLength: number = parseInt(
          response.headers.get('content-length') || '0',
          10,
        );
        if (contentLength > MAX_SCRIPT_SIZE) {
          throw new Error(
            `Script too large (${formatBytes(contentLength)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`,
          );
        }

        const code: string = await response.text();

        if (code.length > MAX_SCRIPT_SIZE) {
          throw new Error(
            `Script too large (${formatBytes(code.length)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`,
          );
        }

        // Verify it looks like a userscript
        if (!code.includes('==UserScript==')) {
          debugLog('Not a valid userscript, allowing normal navigation');
          _pendingFetches.delete(url);
          return;
        }

        // Store pending install data
        await chrome.storage.local.set({
          pendingInstall: {
            url: url,
            code: code,
            timestamp: Date.now(),
          },
        });

        // Redirect to install page
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL('pages/install.html'),
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[ScriptVault] Failed to fetch script:', error);
        // Store error for install page to display
        await chrome.storage.local.set({
          pendingInstall: {
            url: url,
            error: message,
            timestamp: Date.now(),
          },
        });

        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL('pages/install.html'),
        });
      } finally {
        _pendingFetches.delete(url);
      }
    },
    {
      url: [{ urlMatches: '.*\\.user\\.js(\\?.*)?$' }],
    },
  );
}

// ---------------------------------------------------------------------------
// Direct script installation from URL
// ---------------------------------------------------------------------------

export interface InstallResult {
  success: boolean;
  script?: Script;
  error?: string;
}

export async function installFromUrl(url: string): Promise<InstallResult> {
  try {
    // Timeout after 30 seconds
    const controller = new AbortController();
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
      () => controller.abort(),
      30000,
    );

    const response: Response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Size limit: 5MB (same as webNavigation handler)
    const contentLength: number = parseInt(
      response.headers.get('content-length') || '0',
      10,
    );
    if (contentLength > MAX_SCRIPT_SIZE) {
      throw new Error(
        `Script too large (${formatBytes(contentLength)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`,
      );
    }

    const code: string = await response.text();

    // Post-read size check (content-length may be missing)
    if (code.length > MAX_SCRIPT_SIZE) {
      throw new Error(
        `Script too large (${formatBytes(code.length)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`,
      );
    }

    if (!code.includes('==UserScript==')) {
      throw new Error('Not a valid userscript');
    }

    // Parse and save
    const parsed = parseUserscript(code);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    const meta: ScriptMeta = parsed.meta!;
    const allScripts: Script[] = await ScriptStorage.getAll();

    // Check for existing script with same name+namespace (update instead of duplicate)
    const existing: Script | undefined = allScripts.find(
      (s) => s.meta.name === meta.name && s.meta.namespace === meta.namespace,
    );
    const id: string = existing ? existing.id : generateId();

    const script: Script = {
      id,
      code,
      meta,
      enabled: existing ? existing.enabled : true,
      position: existing ? existing.position : allScripts.length,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    await ScriptStorage.set(id, script);
    await registerAllScripts();
    await updateBadge();
    await autoReloadMatchingTabs(script);

    return { success: true, script };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
