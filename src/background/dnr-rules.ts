/**
 * DNR (declarativeNetRequest) rule management for GM_webRequest.
 *
 * Translates GM_webRequest / @webRequest selectors and actions into Chrome
 * declarativeNetRequest dynamic rules.
 */

import { debugLog } from '@modules/storage';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stable numeric rule ID derived from a scriptId string and a rule index.
 * 21-bit hash (0..2097151) * 1024 + 10-bit index (0..1023) yields ids up to ~2.1B,
 * within Chrome's safe integer DNR rule id range. Adds (index + 1) so that a
 * zero-hash never collapses to 0 and to guarantee distinct ids for indices on
 * the same script.
 */
export function _makeRuleId(scriptId: string, index: number): number {
  let h = 0;
  for (let i = 0; i < scriptId.length; i++) {
    h = (h * 31 + scriptId.charCodeAt(i)) & 0x7fffffff;
  }
  return ((h & 0x1fffff) * 1024 + (index & 0x3ff)) + (index + 1);
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

  const existing = _webRequestRuleMap.get(scriptId);
  if (existing && existing.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing });
    } catch (_e: unknown) {
      // Silently ignore — rules may already have been removed
    }
    _webRequestRuleMap.delete(scriptId);
  }
}
