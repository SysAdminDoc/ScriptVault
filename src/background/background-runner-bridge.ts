import type { Script } from '../types/script';
import type { Settings } from '../types/settings';
import {
  planBackgroundScript,
  type BackgroundRunnerBudget,
  type BackgroundRunnerStatus,
  type BackgroundRunnerTrigger,
  type BackgroundScriptPlan,
} from './background-runner';
import { buildBackgroundWrappedScript, type BackgroundWrapperOptions } from './background-wrapper';

export type BackgroundRunnerBridgeStatus = BackgroundRunnerStatus | 'wrapper-unsupported';

export interface BackgroundRunnerPayload {
  source: 'scriptvault-background-runner';
  scriptId: string;
  code: string;
  triggers: BackgroundRunnerTrigger[];
  budget: BackgroundRunnerBudget;
  preparedAt: number;
}

export interface BackgroundRunnerBridgeResult {
  status: BackgroundRunnerBridgeStatus;
  reason: string;
  executionEnabled: false;
  plan: BackgroundScriptPlan;
  payload: BackgroundRunnerPayload | null;
}

export interface BackgroundRunnerBridgeOptions extends BackgroundWrapperOptions {
  budget?: Partial<BackgroundRunnerBudget>;
  now?: () => number;
}

function bridgeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Background runner payload preparation failed');
}

export function prepareBackgroundRunnerPayload(
  script: Script,
  settings: Pick<Settings, 'experimentalBackgroundScripts'>,
  options: BackgroundRunnerBridgeOptions = {},
): BackgroundRunnerBridgeResult {
  const plan = planBackgroundScript(script, settings, options.budget);
  if (!plan.enabled) {
    return {
      status: plan.status,
      reason: plan.reason,
      executionEnabled: false,
      plan,
      payload: null,
    };
  }

  try {
    const code = buildBackgroundWrappedScript(script, {
      preloadedStorage: options.preloadedStorage,
    });
    return {
      status: 'ready',
      reason: 'Background runner payload prepared; execution remains disabled until the runner is wired.',
      executionEnabled: false,
      plan,
      payload: {
        source: 'scriptvault-background-runner',
        scriptId: script.id,
        code,
        triggers: plan.triggers,
        budget: plan.budget,
        preparedAt: (options.now ?? Date.now)(),
      },
    };
  } catch (error) {
    return {
      status: 'wrapper-unsupported',
      reason: bridgeErrorMessage(error),
      executionEnabled: false,
      plan,
      payload: null,
    };
  }
}
