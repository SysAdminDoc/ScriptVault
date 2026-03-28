/**
 * ScriptVault Background Service Worker — Entry Point
 *
 * This module wires together all background sub-modules and registers
 * Chrome event listeners. It is the single entry point for the service worker.
 *
 * NOTE: This is the TypeScript source. The production build still uses
 * build-background.sh / esbuild to concatenate the original JS modules.
 * This file exists to:
 *   1. Document the module dependency graph
 *   2. Provide a future entry point when the build switches to TS bundling
 *   3. Enable type-checking across module boundaries
 */

// ── Re-export sub-modules for type-checking ──────────────────────────

export { parseUserscript } from './parser';
export type { ParseResult, ParseSuccess, ParseError } from './parser';

export {
  doesScriptMatchUrl,
  matchPattern,
  matchIncludePattern,
  isValidMatchPattern,
  isRegexPattern,
  parseRegexPattern,
  extractMatchPatternsFromRegex,
  convertIncludeToMatch,
  isUrlBlockedByGlobalSettings,
} from './url-matcher';

export { UpdateSystem } from './update-checker';

export { CloudSync } from './cloud-sync';

export {
  exportAllScripts,
  importScripts,
  exportToZip,
  importFromZip,
} from './import-export';

export { registerAllScripts, registerScript, unregisterScript } from './registration';

export {
  requireCache,
  LIBRARY_FALLBACKS,
  getFallbackUrls,
  isUnfetchableUrl,
  verifySRI,
  fetchRequireScript,
  fetchWithRetry,
} from './resource-loader';

export {
  applyWebRequestRules,
  removeWebRequestRules,
} from './dnr-rules';

export { buildWrappedScript } from './wrapper-builder';
export type { RequireScript } from './wrapper-builder';

export { updateBadge, updateBadgeForTab } from './badge';

export { autoReloadMatchingTabs } from './tab-reload';

export {
  setupContextMenus,
  registerOnInstalledListener,
  registerContextMenuClickListener,
  registerKeyboardShortcutListener,
} from './context-menu';

export {
  installFromUrl,
  registerWebNavigationListener,
} from './install-handler';
