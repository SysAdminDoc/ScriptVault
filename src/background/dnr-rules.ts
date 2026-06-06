/**
 * DNR (declarativeNetRequest) rule management for GM_webRequest.
 *
 * Translates GM_webRequest / @webRequest selectors and actions into Chrome
 * declarativeNetRequest dynamic rules.
 */

import type { Script } from '../types/script';
import type { Settings } from '../types/settings';
import { debugLog, ScriptStorage } from '../modules/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** URL filter entry used inside a selector's `url` array form. */
interface UrlFilterEntry {
  include?: string;
  exclude?: string;
}

/** Chrome DNR HeaderInfo condition used by response-header matching. */
interface HeaderConditionEntry {
  header?: string;
  values?: string[];
  excludedValues?: string[];
}

/** GM_webRequest rule selector. */
interface WebRequestSelector {
  url?: string | UrlFilterEntry[];
  include?: string | string[];
  exclude?: string | string[];
  tab?: number | number[];
  type?: chrome.declarativeNetRequest.ResourceType | chrome.declarativeNetRequest.ResourceType[];
  responseHeaders?: HeaderConditionEntry[];
  excludedResponseHeaders?: HeaderConditionEntry[];
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
  selector?: string | WebRequestSelector;
  action?: 'cancel' | 'block' | WebRequestAction;
}

export interface ApplyWebRequestRulesOptions {
  script?: Script;
  settings?: Partial<Settings> & { allowHighPrivilegeScriptApis?: boolean; modifyCSP?: 'auto' | 'yes' | 'no' };
}

export interface ApplyWebRequestRulesResult {
  success: boolean;
  count: number;
  error?: string;
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

function normalizeHost(value: unknown): string {
  if (typeof value !== 'string') return '';
  let pattern = value.trim().toLowerCase();
  if (!pattern) return '';
  if (pattern === '*' || pattern === '<all_urls>' || pattern === 'self') return pattern;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pattern)) {
      pattern = new URL(pattern.replace(/\*/g, 'x')).hostname.toLowerCase();
    }
  } catch {
    // Fall through to best-effort host extraction below.
  }
  pattern = (((pattern.replace(/^\/\//, '').split('/')[0] ?? '').split('?')[0] ?? '').split('#')[0] ?? '');
  if (pattern.startsWith('*.')) pattern = pattern.slice(2);
  if (pattern.startsWith('x.')) pattern = pattern.slice(2);
  if (pattern.startsWith('.')) pattern = pattern.slice(1);
  if (pattern.startsWith('[') && pattern.includes(']')) {
    pattern = pattern.slice(1, pattern.indexOf(']'));
  } else {
    pattern = pattern.split(':')[0] ?? '';
  }
  return pattern;
}

function hostMatches(hostname: string, pattern: string): boolean {
  const host = normalizeHost(hostname);
  const target = normalizeHost(pattern);
  if (!host || !target) return false;
  return host === target || host.endsWith(`.${target}`);
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [String(value)];
}

function extractScopeHost(pattern: unknown): string {
  if (typeof pattern !== 'string') return '';
  const raw = pattern.trim();
  if (!raw) return '';
  if (raw === '*' || raw === '<all_urls>') return '*';
  const match = raw.match(/^(?:\*|https?|file|ftp):\/\/([^/]+)/i);
  if (!match) return '';
  if (!match[1] || match[1] === '*') return '*';
  return normalizeHost(match[1]);
}

function scriptHostScopeInfo(script?: Script): { universal: boolean; hosts: string[] } {
  const meta = script?.meta;
  const settings = script?.settings || {};
  const patterns: string[] = [];
  if (settings.useOriginalMatches !== false) patterns.push(...asStringArray(meta?.match));
  if (Array.isArray(settings.userMatches)) patterns.push(...settings.userMatches.map(String));
  if (settings.useOriginalIncludes !== false) patterns.push(...asStringArray(meta?.include));
  if (Array.isArray(settings.userIncludes)) patterns.push(...settings.userIncludes.map(String));

  const hosts = new Set<string>();
  let universal = false;
  for (const pattern of patterns) {
    const host = extractScopeHost(pattern);
    if (host === '*') universal = true;
    else if (host) hosts.add(host);
  }
  return { universal, hosts: [...hosts] };
}

function dnrUrlFiltersForRule(rule: WebRequestRule): string[] {
  const selector = rule.selector;
  if (typeof selector === 'string') return [selector].filter(Boolean);
  const filters: string[] = [];
  const push = (value: unknown): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') filters.push(entry);
        else if (entry && typeof entry === 'object' && 'include' in entry) {
          filters.push(String((entry as UrlFilterEntry).include || ''));
        }
      }
    } else if (typeof value === 'string') {
      filters.push(value);
    }
  };
  push(selector?.url);
  push(selector?.include);
  return filters.map((filter) => filter.trim()).filter(Boolean);
}

function extractDnrFilterHost(filter: unknown): string {
  if (typeof filter !== 'string') return '';
  const raw = filter.trim();
  if (!raw) return '';
  if (raw === '*' || raw === '<all_urls>') return '*';
  if (raw.startsWith('||')) {
    const host = raw.slice(2).split(/[\/^*?#]/)[0];
    return host ? normalizeHost(host) : '';
  }
  const host = extractScopeHost(raw);
  if (host) return host;
  if (/^[a-z0-9.-]+(?::\d+)?$/i.test(raw)) return normalizeHost(raw);
  return '';
}

function excludedRequestDomainsForRule(rule: WebRequestRule): string[] {
  const selector = rule.selector;
  if (!selector || typeof selector === 'string') return [];
  const values: string[] = [];
  const push = (value: unknown): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') values.push(entry);
        else if (entry && typeof entry === 'object' && 'exclude' in entry) {
          values.push(String((entry as UrlFilterEntry).exclude || ''));
        }
      }
    } else if (typeof value === 'string') {
      values.push(value);
    }
  };
  push(selector.exclude);
  if (Array.isArray(selector.url)) {
    for (const entry of selector.url) {
      if (entry.exclude) values.push(entry.exclude);
    }
  }
  return values.map(extractDnrFilterHost).filter((host) => host && host !== '*');
}

function normalizeHeaderConditions(value: unknown): chrome.declarativeNetRequest.HeaderInfo[] {
  if (!Array.isArray(value)) return [];
  const conditions: chrome.declarativeNetRequest.HeaderInfo[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const header = String((entry as HeaderConditionEntry).header || '').trim();
    if (!header) continue;
    const condition: chrome.declarativeNetRequest.HeaderInfo = { header };
    if (Array.isArray((entry as HeaderConditionEntry).values)) {
      condition.values = (entry as HeaderConditionEntry).values!.map(String).filter(Boolean);
    }
    if (Array.isArray((entry as HeaderConditionEntry).excludedValues)) {
      condition.excludedValues = (entry as HeaderConditionEntry).excludedValues!.map(String).filter(Boolean);
    }
    conditions.push(condition);
  }
  return conditions;
}

function isCspHeaderName(name: string): boolean {
  return [
    'content-security-policy',
    'content-security-policy-report-only',
    'x-content-security-policy',
    'x-webkit-csp',
  ].includes(String(name || '').trim().toLowerCase());
}

function ruleMutatesCspHeaders(rule: WebRequestRule): boolean {
  const action = typeof rule.action === 'object' ? rule.action : null;
  const headers = action?.setResponseHeaders;
  if (!headers || typeof headers !== 'object') return false;
  return Object.keys(headers).some(isCspHeaderName);
}

function isHighPrivilegeOverride(settings?: ApplyWebRequestRulesOptions['settings']): boolean {
  return settings?.allowHighPrivilegeScriptApis === true;
}

function isCspMutationAllowed(settings?: ApplyWebRequestRulesOptions['settings']): boolean {
  return settings?.modifyCSP === 'yes' || isHighPrivilegeOverride(settings);
}

function dnrHostAllowedByScript(script: Script, host: string): boolean {
  const scope = scriptHostScopeInfo(script);
  if (scope.universal) return true;
  if (scope.hosts.some((scopeHost) => hostMatches(host, scopeHost))) return true;
  const connectList = Array.isArray(script.meta?.connect) ? script.meta.connect : [];
  return connectList.some((pattern) => {
    if (String(pattern).trim() === '*') return true;
    const normalized = normalizeHost(pattern);
    if (normalized === 'self') return scope.hosts.some((scopeHost) => hostMatches(host, scopeHost));
    return hostMatches(host, normalized);
  });
}

function validateWebRequestRulesForScript(
  script: Script,
  rules: WebRequestRule[],
  settings?: ApplyWebRequestRulesOptions['settings'],
): { allowed: boolean; initiatorDomains: string[]; error?: string } {
  const scope = scriptHostScopeInfo(script);
  const highPrivilege = isHighPrivilegeOverride(settings);
  const initiatorDomains = scope.universal || highPrivilege ? [] : scope.hosts;
  if (!scope.universal && !highPrivilege && initiatorDomains.length === 0) {
    return { allowed: false, initiatorDomains: [], error: 'GM_webRequest requires concrete script host scope' };
  }

  for (const rule of rules) {
    if (ruleMutatesCspHeaders(rule) && !isCspMutationAllowed(settings)) {
      return { allowed: false, initiatorDomains, error: 'GM_webRequest CSP header changes require Modify CSP = yes' };
    }
    const filters = dnrUrlFiltersForRule(rule);
    if (filters.length === 0) {
      return { allowed: false, initiatorDomains, error: 'GM_webRequest rule requires a concrete target host' };
    }
    for (const filter of filters) {
      const host = extractDnrFilterHost(filter);
      if (!host) return { allowed: false, initiatorDomains, error: 'GM_webRequest rule requires a concrete target host' };
      if (host === '*' && !highPrivilege) {
        return { allowed: false, initiatorDomains, error: 'GM_webRequest wildcard target host requires high-privilege override' };
      }
      if (host !== '*' && !highPrivilege && !dnrHostAllowedByScript(script, host)) {
        return { allowed: false, initiatorDomains, error: `GM_webRequest target ${host} blocked by script host scope` };
      }
    }
  }

  return { allowed: true, initiatorDomains };
}

/**
 * Translate a GM_webRequest rule selector/action into a
 * `chrome.declarativeNetRequest.Rule`, or `null` if the action is unsupported.
 */
export function _translateWebRequestRule(
  rule: WebRequestRule,
  ruleId: number,
  options: { initiatorDomains?: string[] } = {},
): chrome.declarativeNetRequest.Rule | null {
  const condition: chrome.declarativeNetRequest.RuleCondition = {};
  let action: chrome.declarativeNetRequest.RuleAction;

  // -- Selector -> condition ------------------------------------------------

  const sel = rule.selector ?? {};

  if (typeof sel === 'string') {
    condition.urlFilter = sel;
  } else if (sel.url !== undefined) {
    const urlFilter = sel.url;
    if (Array.isArray(urlFilter)) {
      // Multiple URL patterns: pick first include (DNR only supports one urlFilter per rule)
      const incl = urlFilter.find((u): u is UrlFilterEntry & { include: string } => u.include !== undefined);
      if (incl) {
        condition.urlFilter = incl.include;
      }
      const excl = urlFilter.find((u): u is UrlFilterEntry & { exclude: string } => u.exclude !== undefined);
      if (excl) {
        condition.excludedRequestDomains = [extractDnrFilterHost(excl.exclude)].filter(Boolean);
      }
    } else {
      condition.urlFilter = urlFilter;
    }
  } else if (sel.include !== undefined) {
    const includes = Array.isArray(sel.include) ? sel.include : [sel.include];
    const incl = includes.find(Boolean);
    if (incl) condition.urlFilter = incl;
  }

  const excludedRequestDomains = excludedRequestDomainsForRule(rule);
  if (excludedRequestDomains.length > 0) {
    condition.excludedRequestDomains = excludedRequestDomains;
  }

  if (typeof sel !== 'string' && sel.tab !== undefined) {
    condition.tabIds = Array.isArray(sel.tab) ? sel.tab : [sel.tab];
  }

  if (typeof sel !== 'string' && sel.type !== undefined) {
    condition.resourceTypes = Array.isArray(sel.type) ? sel.type : [sel.type];
  }

  if (typeof sel !== 'string') {
    const responseHeaders = normalizeHeaderConditions(sel.responseHeaders);
    if (responseHeaders.length > 0) condition.responseHeaders = responseHeaders;
    const excludedResponseHeaders = normalizeHeaderConditions(sel.excludedResponseHeaders);
    if (excludedResponseHeaders.length > 0) condition.excludedResponseHeaders = excludedResponseHeaders;
  }

  if (Array.isArray(options.initiatorDomains) && options.initiatorDomains.length > 0) {
    condition.initiatorDomains = options.initiatorDomains;
  }

  // -- Action ---------------------------------------------------------------

  const act = rule.action ?? {};

  if (act === 'cancel' || act === 'block' || act.cancel) {
    action = { type: 'block' };
  } else if (typeof act === 'object' && act.redirect !== undefined) {
    const redirect: chrome.declarativeNetRequest.Redirect =
      typeof act.redirect === 'string'
        ? { url: act.redirect }
        : { url: act.redirect.url ?? act.redirect.regexSubstitution ?? '' };
    action = { type: 'redirect', redirect };
  } else if (typeof act === 'object' && act.setRequestHeaders) {
    action = {
      type: 'modifyHeaders',
      requestHeaders: Object.entries(act.setRequestHeaders).map(
        ([name, value]): chrome.declarativeNetRequest.ModifyHeaderInfo =>
          value === null
            ? { header: name, operation: 'remove' as const }
            : { header: name, operation: 'set' as const, value },
      ),
    };
  } else if (typeof act === 'object' && act.setResponseHeaders) {
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
export async function applyWebRequestRules(
  scriptId: string,
  rules: WebRequestRule[],
  options: ApplyWebRequestRulesOptions = {},
): Promise<ApplyWebRequestRulesResult> {
  if (!chrome.declarativeNetRequest || !Array.isArray(rules) || rules.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    if (!options.script) {
      return { success: false, count: 0, error: 'Script context not found' };
    }
    const policy = validateWebRequestRulesForScript(options.script, rules, options.settings);
    if (!policy.allowed) {
      return { success: false, count: 0, error: policy.error };
    }

    await hydrateWebRequestRuleMap();
    // Remove any existing rules for this script first
    await removeWebRequestRules(scriptId);

    const dnrRules: chrome.declarativeNetRequest.Rule[] = [];
    const ruleIds: number[] = [];

    rules.forEach((rule, idx) => {
      const ruleId = _makeRuleId(scriptId, idx);
      const dnr = _translateWebRequestRule(rule, ruleId, { initiatorDomains: policy.initiatorDomains });
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
        return { success: false, count: 0, error: 'DNR rule limit would be exceeded' };
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
        return { success: false, count: 0, error: 'DNR rule ownership could not be persisted' };
      }
      debugLog(`[GM_webRequest] Applied ${dnrRules.length} rules for script ${scriptId}`);
    }
    return { success: true, count: dnrRules.length };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[ScriptVault] GM_webRequest rule apply failed:', message);
    return { success: false, count: 0, error: message };
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
