/**
 * Script registration — register/unregister userscripts with the
 * chrome.userScripts API.
 *
 * Extracted from background.core.js (lines 3844-4172, 4545-4560) —
 * logic is kept identical.
 */

import type { Script, ScriptMeta, ScriptSettings } from '../types/script';
import type { WebRequestRule } from './dnr-rules';
import type { Settings } from '../types/settings';
import { ScriptStorage, ScriptValues, SettingsManager, debugLog } from '../modules/storage';
import { ResourceCache } from '../modules/resources';
import {
  isValidMatchPattern,
  isRegexPattern,
  extractMatchPatternsFromRegex,
  convertIncludeToMatch,
} from './url-matcher';
import { applyWebRequestRules, removeWebRequestRules } from './dnr-rules';

// ---------------------------------------------------------------------------
// External functions defined in background.core.js but not yet migrated
// ---------------------------------------------------------------------------

declare function fetchRequireScript(url: string): Promise<string | null>;
declare function buildWrappedScript(
  script: Script,
  requireScripts: Array<{ url: string; code: string }>,
  preloadedStorage: Record<string, unknown>,
  regexIncludes: string[],
  regexExcludes: string[],
): string;

// debugWarn is not exported from storage.ts — declare it locally
declare function debugWarn(...args: unknown[]): void;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Maps userscript @run-at values to chrome.userScripts runAt values. */
type ChromeRunAt = 'document_start' | 'document_end' | 'document_idle';

interface UserScriptRegistration {
  id: string;
  matches: string[];
  excludeMatches?: string[];
  js: Array<{ code: string }>;
  runAt: ChromeRunAt;
  allFrames: boolean;
  world: 'USER_SCRIPT';
  worldId?: string;
  messaging?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function registerAllScripts(): Promise<void> {
  try {
    if (!chrome.userScripts) {
      console.warn('[ScriptVault] userScripts API not available');
      return;
    }

    // First, unregister all existing scripts
    await chrome.userScripts.unregister().catch(() => {});

    const scripts: Script[] = await ScriptStorage.getAll();
    const settings = await SettingsManager.get() as unknown as Settings;

    if (!settings.enabled) {
      debugLog('Scripts globally disabled');
      return;
    }

    const enabledScripts: Script[] = scripts.filter(s => s.enabled !== false);

    // Sort by @priority (higher = first), then position
    enabledScripts.sort((a: Script, b: Script) => {
      const pa: number = a.meta?.priority || 0;
      const pb: number = b.meta?.priority || 0;
      if (pb !== pa) return pb - pa;
      return (a.position || 0) - (b.position || 0);
    });

    debugLog(`Registering ${enabledScripts.length} scripts`);

    // v2.0: Preload all @require dependencies in parallel before registration
    // This prevents N sequential fetches during registration
    const allRequires = new Set<string>();
    for (const script of enabledScripts) {
      for (const req of (script.meta?.require || [])) {
        allRequires.add(req);
      }
    }
    if (allRequires.size > 0) {
      debugLog(`Preloading ${allRequires.size} @require dependencies`);
      const preloadStart: number = Date.now();
      await Promise.allSettled([...allRequires].map(url => fetchRequireScript(url)));
      debugLog(`Preloaded in ${Date.now() - preloadStart}ms`);
    }

    // Register all scripts in parallel — significantly faster on large script collections
    const results: PromiseSettledResult<void>[] = await Promise.allSettled(
      enabledScripts.map(script => registerScript(script)),
    );
    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failures.length > 0) {
      console.warn(
        `[ScriptVault] ${failures.length} script(s) failed to register:`,
        failures.map(r => (r.reason as Error)?.message || r.reason),
      );
    }
  } catch (e: unknown) {
    console.error('[ScriptVault] Failed to register scripts:', e);
  }
}

// Register a single script
export async function registerScript(script: Script): Promise<void> {
  try {
    if (!chrome.userScripts) return;

    const meta: ScriptMeta = script.meta;
    const settings: ScriptSettings = script.settings || {};

    // Build match patterns with URL override support
    const matches: string[] = [];
    const excludeMatches: string[] = [];

    // Process @match (if enabled in settings)
    if ((settings as Record<string, unknown>).useOriginalMatches !== false && meta.match && Array.isArray(meta.match)) {
      for (const m of meta.match) {
        if (isValidMatchPattern(m)) {
          matches.push(m);
        }
      }
    }

    // Process user @match patterns
    const userMatches = (settings as Record<string, unknown>).userMatches;
    if (userMatches && Array.isArray(userMatches)) {
      for (const m of userMatches as string[]) {
        if (isValidMatchPattern(m)) {
          matches.push(m);
        } else {
          // Try to convert glob-style to match pattern
          const converted: string | null = convertIncludeToMatch(m);
          if (converted && isValidMatchPattern(converted)) {
            matches.push(converted);
          }
        }
      }
    }

    // Collect regex @include/@exclude patterns for runtime filtering
    const regexIncludes: string[] = [];
    const regexExcludes: string[] = [];

    // Process @include (if enabled in settings)
    if ((settings as Record<string, unknown>).useOriginalIncludes !== false && meta.include && Array.isArray(meta.include)) {
      for (const inc of meta.include) {
        if (isRegexPattern(inc)) {
          // Regex pattern - extract broad match patterns for registration, filter at runtime
          regexIncludes.push(inc);
          const broad: string[] = extractMatchPatternsFromRegex(inc);
          if (broad.length > 0) {
            matches.push(...broad);
          }
        } else {
          const converted: string | null = convertIncludeToMatch(inc);
          if (converted && isValidMatchPattern(converted)) {
            matches.push(converted);
          } else if (inc === '*') {
            matches.push('<all_urls>');
          }
        }
      }
    }

    // Process user @include patterns
    const userIncludes = (settings as Record<string, unknown>).userIncludes;
    if (userIncludes && Array.isArray(userIncludes)) {
      for (const inc of userIncludes as string[]) {
        const converted: string | null = convertIncludeToMatch(inc);
        if (converted && isValidMatchPattern(converted)) {
          matches.push(converted);
        } else if (inc === '*') {
          matches.push('<all_urls>');
        }
      }
    }

    // Process @exclude-match (stored as excludeMatch by parser)
    if (meta.excludeMatch && Array.isArray(meta.excludeMatch)) {
      for (const m of meta.excludeMatch) {
        if (isValidMatchPattern(m)) {
          excludeMatches.push(m);
        }
      }
    }

    // Process @exclude (if enabled) - convert to exclude matches where possible
    if ((settings as Record<string, unknown>).useOriginalExcludes !== false && meta.exclude && Array.isArray(meta.exclude)) {
      for (const exc of meta.exclude) {
        if (isRegexPattern(exc)) {
          regexExcludes.push(exc);
          continue;
        }
        const converted: string | null = convertIncludeToMatch(exc);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }

    // Process user @exclude patterns
    const userExcludes = (settings as Record<string, unknown>).userExcludes;
    if (userExcludes && Array.isArray(userExcludes)) {
      for (const exc of userExcludes as string[]) {
        const converted: string | null = convertIncludeToMatch(exc);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }

    // Add denied hosts as exclude patterns
    const globalSettings = await SettingsManager.get() as unknown as Settings;
    const deniedHosts: string[] | undefined = globalSettings.deniedHosts;
    if (deniedHosts && Array.isArray(deniedHosts)) {
      for (const host of deniedHosts) {
        if (host) excludeMatches.push(`*://${host}/*`, `*://*.${host}/*`);
      }
    }
    // Add blacklisted pages as exclude patterns
    if (globalSettings.pageFilterMode === 'blacklist' && globalSettings.blacklistedPages) {
      const blacklist: string[] = globalSettings.blacklistedPages.split('\n').map(s => s.trim()).filter(Boolean);
      for (const p of blacklist) {
        const converted: string | null = convertIncludeToMatch(p);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }

    // If no matches, use <all_urls> (some scripts use @include *)
    if (matches.length === 0) {
      matches.push('<all_urls>');
    }

    // Map run-at values (with per-script setting override)
    const runAtMap: Record<string, ChromeRunAt> = {
      'document-start': 'document_start',
      'document-end': 'document_end',
      'document-idle': 'document_idle',
      'document-body': 'document_end',
      'context-menu': 'document_idle' // context-menu scripts register idle, triggered via context menu
    };

    // @run-in: filter by tab type (normal-tabs, incognito-tabs)
    const runIn: string = meta['run-in'] || '';
    if (runIn === 'incognito-tabs') {
      // Only run in incognito — skip registration for normal context
      // (chrome.userScripts doesn't support incognito filtering natively,
      // so we inject a runtime guard into the wrapper)
    } else if (runIn === 'normal-tabs') {
      // Only run in normal tabs — runtime guard injected
    }

    // Check for per-script runAt override
    let effectiveRunAt: string = meta['run-at'] || '';
    const settingsRunAt = (settings as Record<string, unknown>).runAt as string | undefined;
    if (settingsRunAt && settingsRunAt !== 'default') {
      effectiveRunAt = settingsRunAt;
    }
    const isContextMenu: boolean = effectiveRunAt === 'context-menu';
    if (isContextMenu) {
      // Context-menu scripts are not auto-registered; they run on-demand via context menu click
      debugLog(`Skipping auto-register for context-menu script: ${meta.name}`);
      return;
    }
    const runAt: ChromeRunAt = runAtMap[effectiveRunAt] || 'document_idle';

    // Determine execution world based on @inject-into and @sandbox
    // chrome.userScripts API only supports 'USER_SCRIPT' world, not 'MAIN'
    // For @inject-into page / @sandbox raw, we still register in USER_SCRIPT world
    // but pass a flag so the wrapper injects the user's code into the page context via <script>
    const world: 'USER_SCRIPT' = 'USER_SCRIPT';
    const injectInto: string = meta['inject-into'] || 'auto';
    const sandbox: string = meta.sandbox || '';
    const injectIntoPage: boolean = (injectInto === 'page' || sandbox === 'raw');

    // Fetch @require dependencies
    const requireScripts: Array<{ url: string; code: string }> = [];
    const requires: string[] = Array.isArray(meta.require) ? meta.require : (meta.require ? [meta.require] : []);

    const failedRequires: string[] = [];
    for (const url of requires) {
      try {
        const code: string | null = await fetchRequireScript(url);
        if (code) {
          requireScripts.push({ url, code });
        } else {
          failedRequires.push(url);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn(`[ScriptVault] Failed to fetch @require ${url}:`, message);
        failedRequires.push(url);
      }
    }

    // Track failed @require dependencies on the script for UI notification
    if (failedRequires.length > 0) {
      script.settings = script.settings || {};
      script.settings._failedRequires = failedRequires;
      await ScriptStorage.set(script.id, script);
      debugWarn(`${meta.name}: ${failedRequires.length} @require dependency(s) failed to load`);
    } else if (script.settings?._failedRequires) {
      // Clear previous failures
      delete script.settings._failedRequires;
      await ScriptStorage.set(script.id, script);
    }

    // Pre-fetch @resource dependencies
    await ResourceCache.prefetchResources(meta.resource);

    // Pre-fetch storage values for this script
    const storedValues: Record<string, unknown> = await ScriptValues.getAll(script.id) || {};

    // Build the script code with GM API wrapper, @require scripts, and pre-loaded storage
    if (injectIntoPage) {
      debugLog(`Note: @inject-into page / @sandbox raw not fully supported in MV3, running in USER_SCRIPT world: ${meta.name}`);
    }
    const wrappedCode: string = buildWrappedScript(script, requireScripts, storedValues, regexIncludes, regexExcludes);

    // Register the script
    const registration: UserScriptRegistration = {
      id: script.id,
      matches: matches,
      excludeMatches: excludeMatches.length > 0 ? excludeMatches : undefined,
      js: [{ code: wrappedCode }],
      runAt: runAt,
      allFrames: !meta.noframes,
      world: world
    };

    // Chrome 133+: configure and use a per-script worldId for isolation.
    // Each script gets its own USER_SCRIPT world so globals don't bleed across scripts.
    let worldConfigured = false;
    try {
      await chrome.userScripts.configureWorld({
        worldId: script.id,
        csp: "script-src 'self' 'unsafe-inline' 'unsafe-eval' *",
        messaging: true
      });
      worldConfigured = true;
    } catch (_e: unknown) {
      // Chrome <133 doesn't support worldId on configureWorld — fall through to default world
    }

    if (worldConfigured) {
      registration.worldId = script.id;
    }

    try {
      // Chrome 131+ supports messaging in USER_SCRIPT world
      // The `messaging` property is not in all chrome-types versions, so cast to any.
      await chrome.userScripts.register([
        { ...registration, messaging: world === 'USER_SCRIPT' } as chrome.userScripts.RegisteredUserScript,
      ]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg?.includes('messaging')) {
        // Fallback for older Chrome versions that don't support the messaging property
        await chrome.userScripts.register([registration as chrome.userScripts.RegisteredUserScript]);
      } else {
        throw e;
      }
    }

    debugLog(`Registered: ${meta.name} (${requires.length} @require, ${Object.keys(storedValues).length} stored values)`);

    // Apply @webRequest declarativeNetRequest rules if defined
    if (meta.webRequest) {
      // meta.webRequest uses the type from types/script.ts; applyWebRequestRules
      // expects the dnr-rules.ts shape. They originate from the same data so cast is safe.
      const rules: WebRequestRule[] = (
        Array.isArray(meta.webRequest) ? meta.webRequest : [meta.webRequest]
      ) as unknown as WebRequestRule[];
      await applyWebRequestRules(script.id, rules);
    }
  } catch (e: unknown) {
    console.error(`[ScriptVault] Failed to register ${script.meta?.name || script.id}:`, e);
    // Mark script with registration failure for UI display
    try {
      script.settings = script.settings || {};
      script.settings._registrationError = e instanceof Error ? e.message : 'Registration failed';
      await ScriptStorage.set(script.id, script);
    } catch {
      // ignore
    }
  }
}

export async function unregisterScript(scriptId: string): Promise<void> {
  // Remove any @webRequest declarativeNetRequest rules
  await removeWebRequestRules(scriptId);
  try {
    if (!chrome.userScripts) return;
    await chrome.userScripts.unregister({ ids: [scriptId] });
    // Chrome 133+: reset the per-script world configuration to free resources
    try {
      // Chrome 133+ API — shape may differ from chrome-types declarations
      await (chrome.userScripts.resetWorldConfiguration as (arg: unknown) => Promise<void>)({ worldId: scriptId });
    } catch (_e: unknown) {
      // Chrome <133 doesn't support resetWorldConfiguration — ignore
    }
  } catch (_e: unknown) {
    // Script might not be registered
  }
}
