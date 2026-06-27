import type { BackgroundMessage } from '../types/messages';

export type GMWebRequestAction = Extract<BackgroundMessage['action'], 'GM_webRequest'>;

export const GM_WEBREQUEST_ACTIONS = [
  'GM_webRequest',
] as const satisfies readonly GMWebRequestAction[];

type AssertNever<T extends never> = T;
type MissingGMWebRequestActions = Exclude<GMWebRequestAction, typeof GM_WEBREQUEST_ACTIONS[number]>;
type ExtraGMWebRequestActions = Exclude<typeof GM_WEBREQUEST_ACTIONS[number], GMWebRequestAction>;
type _MissingGMWebRequestActionCheck = AssertNever<MissingGMWebRequestActions>;
type _ExtraGMWebRequestActionCheck = AssertNever<ExtraGMWebRequestActions>;

interface RuntimeMessageSender {
  userScriptId?: string;
}

interface GMWebRequestPayload {
  rules?: unknown;
  scriptId?: string;
}

interface ScriptRecord {
  meta?: {
    grant?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ScriptStorageRuntime {
  get(scriptId: string): Promise<ScriptRecord | null | undefined>;
}

interface SettingsManagerRuntime {
  get(): Promise<unknown>;
}

interface WebRequestRuleApplyResult {
  count?: number;
  error?: string;
  success?: boolean;
}

declare const ScriptStorage: ScriptStorageRuntime;
declare const SettingsManager: SettingsManagerRuntime;
declare const applyWebRequestRules: (
  scriptId: string,
  rules: unknown[],
  options: { script: ScriptRecord; settings: unknown },
) => Promise<WebRequestRuleApplyResult>;

const GM_WEBREQUEST_ACTION_SET: ReadonlySet<string> = new Set(GM_WEBREQUEST_ACTIONS);

export function isGMWebRequestAction(action: unknown): action is GMWebRequestAction {
  return typeof action === 'string' && GM_WEBREQUEST_ACTION_SET.has(action);
}

export async function handleGMWebRequestMessage(
  action: GMWebRequestAction,
  data: GMWebRequestPayload = {},
  sender: RuntimeMessageSender = {},
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'GM_webRequest': {
      const scriptId = sender.userScriptId || data.scriptId;
      if (!scriptId) return { error: 'No script context' };
      const script = await ScriptStorage.get(scriptId);
      if (!script?.meta?.grant?.includes('GM_webRequest')) return { error: 'Not granted' };
      const rules = Array.isArray(data.rules) ? data.rules : (data.rules ? [data.rules] : []);
      const settings = await SettingsManager.get();
      const result = await applyWebRequestRules(scriptId, rules, { script, settings });
      if (!result?.success) return { error: result?.error || 'GM_webRequest rule rejected' };
      return { success: true, count: result.count ?? rules.length };
    }

    default:
      return { error: `Unsupported GM_webRequest action: ${action}` };
  }
}

export const GMWebRequestHandler = Object.freeze({
  GM_WEBREQUEST_ACTIONS,
  handleGMWebRequestMessage,
  isGMWebRequestAction,
});

export default GMWebRequestHandler;
