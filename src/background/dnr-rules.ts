/**
 * DNR (declarativeNetRequest) rule management for GM_webRequest.
 *
 * Translates GM_webRequest / @webRequest selectors and actions into Chrome
 * declarativeNetRequest dynamic rules.
 */

import { debugLog, ScriptStorage } from '../modules/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** URL filter entry used inside a selector's `url` array form. */
interface UrlFilterEntry {
  include?: string;
  exclude?: string;
}

/** GM_webRequest rule selector. */
interface WebRequestSelector {
  url?: string | UrlFilterEntry[];
  tab?: number | number[];
  type?: chrome.declarativeNetRequest.ResourceType | chrome.declarativeNetRequest.ResourceType[];
}

/** Redirect target — either a plain URL string or an object. */
interface RedirectTarget {
  url?: string;
  regexSubstitution?: string;
}

/** GM_webRequest rule action. */
interface WebRequestAction {
  cancel?: boolean;
  redirect?: string | RedirectTarget;
  setRequestHeaders?: Record<string, string | null>;
  setResponseHeaders?: Record<string, string | null>;
}

/** A single GM_webRequest rule as provided by userscript metadata / API. */
export interface WebRequestRule {
  priority?: number;
  selector?: WebRequestSelector;
  action?: WebRequestAction;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Maps scriptId -> array of DNR rule IDs applied via @webRequest / GM_webRequest */
const _webRequestRuleMap = new Map<string, number[]>();
const WEB_REQUEST_RULE_MAP_STORAGE_KEY = '_webRequestRuleMap';
let _webRequestRuleMapHydrated = false;
let _webRequestRuleMapHydratingPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stable numeric rule ID derived from a scriptId string and a rule index.
 * 21-bit hash (0..2097151) shifted by 10 bits plus a 10-bit index yields ids
 * up to ~2.1B, within Chrome's safe integer DNR rule id range. Adds 1 so that
 * a zero-hash never collapses to rule id 0.
 */
export function _makeRuleId(scriptId: string, index: number): number {
  let h = 0;
  for (let i = 0; i < scriptId.length; i++) {
    h = (h * 31 + scriptId.charCodeAt(i)) & 0x7fffffff;
  }
  return (((h & 0x1fffff) << 10) | (index & 0x3ff)) + 1;
}

function normalizeRuleIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];
}

async function hydrateWebRequestRuleMap(): Promise<void> {
  if (_webRequestRuleMapHydrated) return;
  if (_webRequestRuleMapHydratingPromise) return _webRequestRuleMapHydratingPromise;

  _webRequestRuleMapHydratingPromise = (async () => {
    try {
      const result = await chrome.storage.local.get(WEB_REQUEST_RULE_MAP_STORAGE_KEY);
      const stored = result?.[WEB_REQUEST_RULE_MAP_STORAGE_KEY];
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        for (const [scriptId, ruleIds] of Object.entries(stored)) {
          const normalized = normalizeRuleIds(ruleIds);
          if (normalized.length > 0) {
            _webRequestRuleMap.set(scriptId, normalized);
          }
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[ScriptVault] Failed to hydrate _webRequestRuleMap:', message);
    } finally {
      _webRequestRuleMapHydrated = true;
      _webRequestRuleMapHydratingPromise = null;
    }
  })();

  return _webRequestRuleMapHydratingPromise;
}

async function persistWebRequestRuleMap(): Promise<boolean> {
  try {
    const stored: Record<string, number[]> = {};
    for (const [scriptId, ruleIds] of _webRequestRuleMap.entries()) {
      stored[scriptId] = ruleIds;
    }
    await chrome.storage.local.set({ [WEB_REQUEST_RULE_MAP_STORAGE_KEY]: stored });
    return true;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[ScriptVault] Failed to persist _webRequestRuleMap:', message);
    return false;
  }
}

/**
 * Translate a GM_webRequest rule selector/action into a
 * `chrome.declarativeNetRequest.Rule`, or `null` if the action is unsupported.
 */
export function _translateWebRequestRule(
  rule: WebRequestRule,
  ruleId: number,
): chrome.declarativeNetRequest.Rule | null {
  const condition: chrome.declarativeNetRequest.RuleCondition = {};
  let action: chrome.declarativeNetRequest.RuleAction;

  // -- Selector -> condition ------------------------------------------------

  const sel: WebRequestSelector = rule.selector ?? {};

  if (sel.url !== undefined) {
    const urlFilter = sel.url;
    if (Array.isArray(urlFilter)) {
      // Multiple URL patterns: pick first include (DNR only supports one urlFilter per rule)
      const incl = urlFilter.find((u): u is UrlFilterEntry & { include: string } => u.include !== undefined);
      if (incl) {
        condition.urlFilter = incl.include;
      }
      const excl = urlFilter.find((u): u is UrlFilterEntry & { exclude: string } => u.exclude !== undefined);
      if (excl) {
        condition.excludedInitiatorDomains = [excl.exclude.replace(/\*/g, '')].filter(Boolean);
      }
    } else {
      condition.urlFilter = urlFilter;
    }
  }

  if (sel.tab !== undefined) {
    condition.tabIds = Array.isArray(sel.tab) ? sel.tab : [sel.tab];
  }

  if (sel.type !== undefined) {
    condition.resourceTypes = Array.isArray(sel.type) ? sel.type : [sel.type];
  }

  // -- Action ---------------------------------------------------------------

  const act: WebRequestAction = rule.action ?? {};

  if (act.cancel) {
    action = { type: 'block' };
  } else if (act.redirect !== undefined) {
    const redirect: chrome.declarativeNetRequest.Redirect =
      typeof act.redirect === 'string'
        ? { url: act.redirect }
        : { url: act.redirect.url ?? act.redirect.regexSubstitution ?? '' };
    action = { type: 'redirect', redirect };
  } else if (act.setRequestHeaders) {
    action = {
      type: 'modifyHeaders',
      requestHeaders: Object.entries(act.setRequestHeaders).map(
        ([name, value]): chrome.declarativeNetRequest.ModifyHeaderInfo =>
          value === null
            ? { header: name, operation: 'remove' as const }
            : { header: name, operation: 'set' as const, value },
      ),
    };
  } else if (act.setResponseHeaders) {
    action = {
      type: 'modifyHeaders',
      responseHeaders: Object.entries(act.setResponseHeaders).map(
        ([name, value]): chrome.declarativeNetRequest.ModifyHeaderInfo =>
          value === null
            ? { header: name, operation: 'remove' as const }
            : { header: name, operation: 'set' as const, value },
      ),
    };
  } else {
    return null; // unsupported action
  }

  return {
    id: ruleId,
    priority: rule.priority ?? 1,
    condition,
    action,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply an array of GM_webRequest rules for a given script, translating them
 * into Chrome declarativeNetRequest dynamic rules.
 */
export async function applyWebRequestRules(scriptId: string, rules: WebRequestRule[]): Promise<void> {
  if (!chrome.declarativeNetRequest || !Array.isArray(rules) || rules.length === 0) return;

  try {
    await hydrateWebRequestRuleMap();
    // Remove any existing rules for this script first
    await removeWebRequestRules(scriptId);

    const dnrRules: chrome.declarativeNetRequest.Rule[] = [];
    const ruleIds: number[] = [];

    rules.forEach((rule, idx) => {
      const ruleId = _makeRuleId(scriptId, idx);
      const dnr = _translateWebRequestRule(rule, ruleId);
      if (dnr) {
        dnrRules.push(dnr);
        ruleIds.push(ruleId);
      }
    });

    if (dnrRules.length > 0) {
      // Check dynamic rule quota (Chrome limit: 30,000)
      const existing = await chrome.declarativeNetRequest.getDynamicRules();
      if (existing.length + dnrRules.length > 30000) {
        console.warn(
          `[ScriptVault] DNR rule limit would be exceeded: ${existing.length} + ${dnrRules.length} > 30000`,
        );
        return;
      }
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: dnrRules });
      _webRequestRuleMap.set(scriptId, ruleIds);
      const persisted = await persistWebRequestRuleMap();
      if (!persisted) {
        _webRequestRuleMap.delete(scriptId);
        try {
          await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
        } catch (cleanupErr: unknown) {
          const cleanupMessage = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
          console.warn('[ScriptVault] GM_webRequest rule rollback failed after map persist failure:', cleanupMessage);
        }
        return;
      }
      debugLog(`[GM_webRequest] Applied ${dnrRules.length} rules for script ${scriptId}`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[ScriptVault] GM_webRequest rule apply failed:', message);
  }
}

/**
 * Remove all declarativeNetRequest dynamic rules previously applied for a
 * given script.
 */
export async function removeWebRequestRules(scriptId: string): Promise<void> {
  if (!chrome.declarativeNetRequest) return;

  await hydrateWebRequestRuleMap();
  const existing = _webRequestRuleMap.get(scriptId);
  if (existing && existing.length > 0) {
    let removed = false;
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing });
      removed = true;
    } catch (_e: unknown) {
      try {
        const liveRules = await chrome.declarativeNetRequest.getDynamicRules();
        const liveRuleIds = new Set(liveRules.map((rule) => rule.id));
        removed = !existing.some((id) => liveRuleIds.has(id));
      } catch (probeErr: unknown) {
        const message = probeErr instanceof Error ? probeErr.message : String(probeErr);
        console.warn('[ScriptVault] GM_webRequest rule removal failed and live-state probe failed:', message);
      }
    }

    if (!removed) {
      console.warn(`[ScriptVault] GM_webRequest kept rule map for ${scriptId}; DNR removal did not complete.`);
      return;
    }

    _webRequestRuleMap.delete(scriptId);
    await persistWebRequestRuleMap();
  }
}

/**
 * Reconcile the persisted DNR owner map against the current script store and
 * Chrome's live dynamic rules. This runs on service-worker wake in the runtime
 * JS and exists here to keep the TypeScript mirror ready for promotion.
 */
export async function reconcileWebRequestRuleMap(): Promise<void> {
  if (!chrome.declarativeNetRequest) return;

  await hydrateWebRequestRuleMap();

  let scripts: Array<{ id?: string }> = [];
  try {
    scripts = await ScriptStorage.getAll();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[ScriptVault] DNR reconcile: ScriptStorage.getAll failed:', message);
    return;
  }

  let mutated = false;
  const scriptIds = new Set(scripts.map((script) => script.id).filter((id): id is string => typeof id === 'string'));
  const orphanScriptIds: string[] = [];
  const toRemoveRuleIds: number[] = [];

  for (const [scriptId, ruleIds] of _webRequestRuleMap.entries()) {
    if (!scriptIds.has(scriptId)) {
      orphanScriptIds.push(scriptId);
      toRemoveRuleIds.push(...ruleIds);
    }
  }

  let liveRuleIds: Set<number> | null = null;
  try {
    const liveRules = await chrome.declarativeNetRequest.getDynamicRules();
    liveRuleIds = new Set(liveRules.map((rule) => rule.id));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[ScriptVault] DNR reconcile: getDynamicRules failed:', message);
  }

  if (liveRuleIds) {
    for (const [scriptId, ruleIds] of _webRequestRuleMap.entries()) {
      if (orphanScriptIds.includes(scriptId)) continue;
      const filtered = ruleIds.filter((id) => liveRuleIds.has(id));
      if (filtered.length !== ruleIds.length) {
        if (filtered.length === 0) _webRequestRuleMap.delete(scriptId);
        else _webRequestRuleMap.set(scriptId, filtered);
        mutated = true;
      }
    }
  }

  if (toRemoveRuleIds.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemoveRuleIds });
      for (const scriptId of orphanScriptIds) {
        _webRequestRuleMap.delete(scriptId);
      }
      mutated = true;
      debugLog(`[GM_webRequest] Reconcile removed ${toRemoveRuleIds.length} orphan DNR rule(s)`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[ScriptVault] DNR reconcile: updateDynamicRules removal failed:', message);
    }
  } else if (orphanScriptIds.length > 0) {
    for (const scriptId of orphanScriptIds) {
      _webRequestRuleMap.delete(scriptId);
    }
    mutated = true;
  }

  if (mutated) {
    await persistWebRequestRuleMap();
  }
}
