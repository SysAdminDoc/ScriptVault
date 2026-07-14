/**
 * Userscript installation handler — intercepts .user.js navigation and
 * provides programmatic install-from-URL.
 * Strict TypeScript migration from background.core.js lines 3541-3697.
 */

import type { Script, ScriptMeta, VersionHistoryEntry } from '../types/script';
import type { Settings } from '../types/settings';
import { fetchTextBounded } from './fetch-bounded';
import { assertExternalFetchUrl, classifyResponseUrl } from './internal-host-guard';
import { createScriptTrustReceipt, getRequireTofuSriFailure } from './trust-receipt';
import { fetchRequireScript } from './resource-loader';
import { bundleIfNeeded } from '../bg/esm-bundler';

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

async function fetchRequireScriptForTrustReceipt(url: string): Promise<string | null> {
  return await fetchRequireScript(url, { bypassCache: true, cacheResult: false, allowUnpinned: true });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface PendingInstallData {
  url: string;
  code?: string;
  error?: string;
  timestamp: number;
}

interface PendingInstallFetchResult {
  action: 'install' | 'pass-through';
  pendingInstall?: PendingInstallData;
}

/** De-duplicate concurrent fetches for the same URL while preserving every requesting tab. */
export const _pendingFetches: Map<string, Promise<PendingInstallFetchResult>> = new Map();

export const PENDING_INSTALL_STORAGE_PREFIX = 'pendingInstall_';
const PENDING_INSTALL_LEGACY_KEY = 'pendingInstall';
const PENDING_INSTALL_TTL_MS = 5 * 60 * 1000;
const PENDING_INSTALL_MAX_ENTRIES = 32;

/** Maximum allowed script size (5 MB) */
export const MAX_SCRIPT_SIZE: number = 5 * 1024 * 1024;

export function scriptSourceByteLength(code: string): number {
  return new TextEncoder().encode(code).byteLength;
}

// ---------------------------------------------------------------------------
// webNavigation listener — intercept .user.js navigation
// ---------------------------------------------------------------------------

export function pendingInstallKeyForTab(tabId: number): string {
  return Number.isInteger(tabId) && tabId >= 0 ? `${PENDING_INSTALL_STORAGE_PREFIX}tab-${tabId}` : '';
}

export function pendingInstallPageUrl(storageKey: string): string {
  return `${chrome.runtime.getURL('pages/install.html')}#${encodeURIComponent(storageKey)}`;
}

export function createPendingInstallStorageKey(scope = 'request'): string {
  const nonce = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${PENDING_INSTALL_STORAGE_PREFIX}${scope}-${nonce}`;
}

export async function storePendingInstall(storageKey: string, payload: PendingInstallData): Promise<void> {
  if (!storageKey.startsWith(PENDING_INSTALL_STORAGE_PREFIX)) {
    throw new Error('Pending install storage key is invalid');
  }
  try {
    const stored = await chrome.storage.local.get();
    const candidates = Object.entries(stored || {})
      .filter(([key]) => key === PENDING_INSTALL_LEGACY_KEY || key.startsWith(PENDING_INSTALL_STORAGE_PREFIX))
      .filter(([key]) => key !== storageKey);
    const expiredKeys = candidates
      .filter(([, value]) => {
        const timestamp = Number((value as { timestamp?: unknown })?.timestamp);
        return !Number.isFinite(timestamp) || payload.timestamp - timestamp > PENDING_INSTALL_TTL_MS;
      })
      .map(([key]) => key);
    const expiredSet = new Set(expiredKeys);
    const overflowKeys = candidates
      .filter(([key]) => !expiredSet.has(key))
      .sort(([, left], [, right]) => (
        Number((right as { timestamp?: unknown })?.timestamp || 0)
        - Number((left as { timestamp?: unknown })?.timestamp || 0)
      ))
      .slice(PENDING_INSTALL_MAX_ENTRIES - 1)
      .map(([key]) => key);
    const removableKeys = [...new Set([...expiredKeys, ...overflowKeys])];
    if (removableKeys.length) await chrome.storage.local.remove(removableKeys);
  } catch (cleanupError) {
    debugLog('[ScriptVault] Pending install cleanup failed:', cleanupError);
  }
  await chrome.storage.local.set({ [storageKey]: payload });
}

async function fetchPendingUserscript(url: string): Promise<PendingInstallFetchResult> {
  const controller = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), 30000);
  try {
    assertExternalFetchUrl(url, 'Script source', ['http:', 'https:']);
    const response: Response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
    if (!postCheck.ok) throw new Error(`Script source redirected to ${postCheck.message}`);
    const code = await fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script');
    if (!code.includes('==UserScript==')) return { action: 'pass-through' };
    return { action: 'install', pendingInstall: { url, code, timestamp: Date.now() } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ScriptVault] Failed to fetch script:', error);
    return { action: 'install', pendingInstall: { url, error: message, timestamp: Date.now() } };
  } finally {
    clearTimeout(timeoutId);
  }
}

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

      debugLog('Intercepting userscript URL:', url);

      try {
        let pending = _pendingFetches.get(url);
        if (!pending) {
          pending = fetchPendingUserscript(url).finally(() => _pendingFetches.delete(url));
          _pendingFetches.set(url, pending);
        }
        const result = await pending;
        const storageKey = pendingInstallKeyForTab(details.tabId);
        if (result.action === 'pass-through') {
          if (storageKey) await chrome.storage.local.remove(storageKey).catch(() => undefined);
          return;
        }
        if (!result.pendingInstall) throw new Error('Pending install payload is missing');
        await storePendingInstall(storageKey, result.pendingInstall);
        await chrome.tabs.update(details.tabId, { url: pendingInstallPageUrl(storageKey) });
      } catch (error) {
        console.error('[ScriptVault] webNavigation install handoff failed:', error);
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

export interface ScriptPreviewResult {
  success: boolean;
  code?: string;
  finalUrl?: string;
  error?: string;
}

export interface DependencyProbeResult {
  success: boolean;
  ok?: boolean;
  status?: number;
  finalUrl?: string;
  error?: string;
}

interface InstallReceiptOptions {
  sourceUrl?: string;
  operation?: 'install' | 'update' | 'reinstall' | 'downgrade' | 'local-save';
}

/**
 * Install a userscript directly from raw source text — used by both
 * `installFromUrl` (after fetch) and `installFromCode` (file picker / drag-drop).
 */
export async function installFromCode(code: string, receiptOptions: InstallReceiptOptions = {}): Promise<InstallResult> {
  try {
    if (typeof code !== 'string' || !code) {
      throw new Error('No script content provided');
    }

    const codeBytes = scriptSourceByteLength(code);
    if (codeBytes > MAX_SCRIPT_SIZE) {
      throw new Error(
        `Script too large (${formatBytes(codeBytes)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`,
      );
    }

    if (!code.includes('==UserScript==')) {
      throw new Error('Not a valid userscript');
    }

    let parsed = parseUserscript(code);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    let meta: ScriptMeta = parsed.meta!;
    const installSettings = await SettingsManager.get();
    const bundleResult = await bundleIfNeeded(code, meta, installSettings, {
      sourceUrl: receiptOptions.sourceUrl || meta.downloadURL || meta.updateURL || '',
    });
    if (bundleResult.bundled) {
      code = bundleResult.code;
      parsed = parseUserscript(code);
      if (parsed.error) throw new Error(parsed.error);
      meta = parsed.meta!;
      meta.esmBundle = {
        entryUrl: bundleResult.entryUrl,
        imports: bundleResult.imports,
        bundledAt: Date.now(),
      };
    }
    const allScripts: Script[] = await ScriptStorage.getAll();

    const existing: Script | undefined = allScripts.find(
      (s) => s.meta.name === meta.name && s.meta.namespace === meta.namespace,
    );
    const id: string = existing ? existing.id : generateId();
    const previousScript: Script | null = existing && existing.code !== code
      ? { ...existing, meta: { ...existing.meta }, code: existing.code, updatedAt: existing.updatedAt || Date.now() }
      : null;
    const versionHistory: VersionHistoryEntry[] = Array.isArray(existing?.versionHistory)
      ? [...existing.versionHistory]
      : [];
    let historyEntry: VersionHistoryEntry | null = null;
    let rollbackIndex = -1;
    if (previousScript) {
      historyEntry = {
        version: existing!.meta.version,
        code: existing!.code,
        updatedAt: existing!.updatedAt || Date.now(),
      };
      versionHistory.push(historyEntry);
      if (versionHistory.length > 5) versionHistory.splice(0, versionHistory.length - 5);
      rollbackIndex = versionHistory.indexOf(historyEntry);
    }
    const operation = receiptOptions.operation || (existing ? 'update' : 'install');
    const trustReceipt = await createScriptTrustReceipt({
      operation,
      code,
      meta,
      sourceUrl: receiptOptions.sourceUrl,
      previousScript,
      rollbackIndex,
      fetchDependencyBody: fetchRequireScriptForTrustReceipt,
    });
    const tofuSriFailure = getRequireTofuSriFailure(trustReceipt);
    if (tofuSriFailure) {
      throw new Error(tofuSriFailure.message);
    }
    if (historyEntry && previousScript) {
      const previousReceipt = previousScript.trustReceipt;
      const previousSourceUrl = previousReceipt
        ? previousReceipt.source.installUrl
        : previousScript.meta.downloadURL || previousScript.meta.updateURL;
      historyEntry.trustReceipt = previousReceipt || await createScriptTrustReceipt({
        operation: 'rollback-point',
        code: previousScript.code,
        meta: previousScript.meta,
        sourceUrl: previousSourceUrl,
      });
    }

    const script: Script = {
      ...existing,
      id,
      code,
      meta,
      enabled: existing ? existing.enabled : true,
      position: existing ? existing.position : allScripts.length,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      trustReceipt,
    };
    if (versionHistory.length > 0) script.versionHistory = versionHistory;

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

export async function installFromUrl(url: string): Promise<InstallResult> {
  try {
    // Pre-flight: refuse internal/loopback/link-local hosts. installFromUrl
    // is called from extension surfaces and from the public-API path, so this
    // is the canonical SSRF gate for direct script installs.
    assertExternalFetchUrl(url, 'Script source', ['http:', 'https:']);

    // Timeout after 30 seconds
    const controller = new AbortController();
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
      () => controller.abort(),
      30000,
    );

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Post-flight: catch redirect targets that resolved to an internal host.
    const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
    if (!postCheck.ok) {
      throw new Error(`Script source redirected to ${postCheck.message}`);
    }

    const code: string = await fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script');

    return await installFromCode(code, { sourceUrl: url, operation: 'install' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Fetch source for the dashboard's inline preview without letting a catalog
 * URL turn the privileged extension page into an internal-network fetcher.
 */
export async function fetchScriptPreview(url: string): Promise<ScriptPreviewResult> {
  const controller = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), 20_000);
  try {
    assertExternalFetchUrl(url, 'Script preview', ['http:', 'https:']);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
    if (!postCheck.ok) throw new Error(`Script preview redirected to ${postCheck.message}`);
    const code = await fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script preview');
    return { success: true, code, finalUrl: response.url || url };
  } catch (error: unknown) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Script preview timed out after 20 seconds'
      : error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Probe an install dependency in the background so redirects and DNS-resolved
 * destinations are checked at the privileged network boundary. A small range
 * GET is used only when a server explicitly rejects HEAD.
 */
export async function probeInstallDependency(url: string): Promise<DependencyProbeResult> {
  const controller = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), 15_000);
  let response: Response | null = null;
  try {
    assertExternalFetchUrl(url, 'Dependency', ['http:', 'https:']);
    response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
      });
    }
    const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
    if (!postCheck.ok) throw new Error(`Dependency redirected to ${postCheck.message}`);
    return {
      success: true,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || url,
    };
  } catch (error: unknown) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Dependency check timed out after 15 seconds'
      : error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  } finally {
    clearTimeout(timeoutId);
    try { await response?.body?.cancel(); } catch { /* response already closed */ }
  }
}
