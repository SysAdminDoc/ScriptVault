import type { ScriptMeta } from '../types/script';
import type { Settings } from '../types/settings';

export type BackgroundRunnerStatus =
  | 'not-background'
  | 'script-disabled'
  | 'gate-disabled'
  | 'unsupported-grants'
  | 'missing-trigger'
  | 'ready';

export type BackgroundRunnerTrigger = 'crontab';

export interface BackgroundRunnerBudget {
  timeoutMs: number;
  maxConcurrentPerScript: number;
  maxQueuedRunsPerScript: number;
}

export interface BackgroundScriptPlan {
  status: BackgroundRunnerStatus;
  reason: string;
  enabled: boolean;
  triggers: BackgroundRunnerTrigger[];
  unsupportedGrants: string[];
  budget: BackgroundRunnerBudget;
}

export interface BackgroundScriptCandidate {
  enabled?: boolean;
  meta?: Partial<ScriptMeta> | null;
}

export const DEFAULT_BACKGROUND_RUNNER_BUDGET: BackgroundRunnerBudget = Object.freeze({
  timeoutMs: 30_000,
  maxConcurrentPerScript: 1,
  maxQueuedRunsPerScript: 3,
});

export const BACKGROUND_RUNNER_BUDGET_LIMITS: Record<keyof BackgroundRunnerBudget, { min: number; max: number }> = Object.freeze({
  timeoutMs: Object.freeze({ min: 1_000, max: 60_000 }),
  maxConcurrentPerScript: Object.freeze({ min: 1, max: 1 }),
  maxQueuedRunsPerScript: Object.freeze({ min: 0, max: 10 }),
});

const GRANT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'GM.getValue': 'GM_getValue',
  'GM.setValue': 'GM_setValue',
  'GM.deleteValue': 'GM_deleteValue',
  'GM.listValues': 'GM_listValues',
  'GM.addValueChangeListener': 'GM_addValueChangeListener',
  'GM.removeValueChangeListener': 'GM_removeValueChangeListener',
  'GM.xmlHttpRequest': 'GM_xmlhttpRequest',
  'GM.notification': 'GM_notification',
  'GM.info': 'GM_info',
  'GM.log': 'GM_log',
});

export const BACKGROUND_RUNNER_ALLOWED_GRANTS: ReadonlySet<string> = new Set([
  'none',
  'GM_getValue',
  'GM_setValue',
  'GM_deleteValue',
  'GM_listValues',
  'GM_addValueChangeListener',
  'GM_removeValueChangeListener',
  'GM_xmlhttpRequest',
  'GM_notification',
  'GM_info',
  'GM_log',
]);

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function normalizeBackgroundRunnerBudget(overrides: Partial<BackgroundRunnerBudget> = {}): BackgroundRunnerBudget {
  return {
    timeoutMs: clampInteger(
      overrides.timeoutMs,
      DEFAULT_BACKGROUND_RUNNER_BUDGET.timeoutMs,
      BACKGROUND_RUNNER_BUDGET_LIMITS.timeoutMs.min,
      BACKGROUND_RUNNER_BUDGET_LIMITS.timeoutMs.max,
    ),
    maxConcurrentPerScript: clampInteger(
      overrides.maxConcurrentPerScript,
      DEFAULT_BACKGROUND_RUNNER_BUDGET.maxConcurrentPerScript,
      BACKGROUND_RUNNER_BUDGET_LIMITS.maxConcurrentPerScript.min,
      BACKGROUND_RUNNER_BUDGET_LIMITS.maxConcurrentPerScript.max,
    ),
    maxQueuedRunsPerScript: clampInteger(
      overrides.maxQueuedRunsPerScript,
      DEFAULT_BACKGROUND_RUNNER_BUDGET.maxQueuedRunsPerScript,
      BACKGROUND_RUNNER_BUDGET_LIMITS.maxQueuedRunsPerScript.min,
      BACKGROUND_RUNNER_BUDGET_LIMITS.maxQueuedRunsPerScript.max,
    ),
  };
}

export function normalizeBackgroundGrant(grant: string): string {
  const trimmed = grant.trim();
  return GRANT_ALIASES[trimmed] ?? trimmed;
}

export function getUnsupportedBackgroundGrants(meta: Partial<ScriptMeta> | null | undefined): string[] {
  const grants = Array.isArray(meta?.grant) ? meta.grant : [];
  const unsupported = new Set<string>();
  for (const grant of grants) {
    const normalized = normalizeBackgroundGrant(String(grant));
    if (!normalized || BACKGROUND_RUNNER_ALLOWED_GRANTS.has(normalized)) continue;
    unsupported.add(normalized);
  }
  return [...unsupported].sort();
}

export function getBackgroundRunnerTriggers(meta: Partial<ScriptMeta> | null | undefined): BackgroundRunnerTrigger[] {
  return typeof meta?.crontab === 'string' && meta.crontab.trim() ? ['crontab'] : [];
}

export function planBackgroundScript(
  candidate: BackgroundScriptCandidate,
  settings: Pick<Settings, 'experimentalBackgroundScripts'>,
  budgetOverrides: Partial<BackgroundRunnerBudget> = {},
): BackgroundScriptPlan {
  const meta = candidate.meta ?? null;
  const budget = normalizeBackgroundRunnerBudget(budgetOverrides);
  const triggers = getBackgroundRunnerTriggers(meta);
  const unsupportedGrants = getUnsupportedBackgroundGrants(meta);

  if (!meta?.background) {
    return {
      status: 'not-background',
      reason: 'Script does not declare @background.',
      enabled: false,
      triggers,
      unsupportedGrants,
      budget,
    };
  }

  if (candidate.enabled === false) {
    return {
      status: 'script-disabled',
      reason: 'Script is disabled.',
      enabled: false,
      triggers,
      unsupportedGrants,
      budget,
    };
  }

  if (!settings.experimentalBackgroundScripts) {
    return {
      status: 'gate-disabled',
      reason: 'experimentalBackgroundScripts is disabled.',
      enabled: false,
      triggers,
      unsupportedGrants,
      budget,
    };
  }

  if (unsupportedGrants.length > 0) {
    return {
      status: 'unsupported-grants',
      reason: 'Script requests GM grants that are not available in DOM-less background context.',
      enabled: false,
      triggers,
      unsupportedGrants,
      budget,
    };
  }

  if (triggers.length === 0) {
    return {
      status: 'missing-trigger',
      reason: 'Background script has no supported automatic trigger.',
      enabled: false,
      triggers,
      unsupportedGrants,
      budget,
    };
  }

  return {
    status: 'ready',
    reason: 'Background script is eligible for the DOM-less runner.',
    enabled: true,
    triggers,
    unsupportedGrants,
    budget,
  };
}
