import type { BackgroundMessage } from '../types/messages';

export type GMCookieAction = Extract<
  BackgroundMessage['action'],
  | 'GM_cookie_delete'
  | 'GM_cookie_list'
  | 'GM_cookie_set'
>;

export const GM_COOKIE_ACTIONS = [
  'GM_cookie_delete',
  'GM_cookie_list',
  'GM_cookie_set',
] as const satisfies readonly GMCookieAction[];

type AssertNever<T extends never> = T;
type MissingGMCookieActions = Exclude<GMCookieAction, typeof GM_COOKIE_ACTIONS[number]>;
type ExtraGMCookieActions = Exclude<typeof GM_COOKIE_ACTIONS[number], GMCookieAction>;
type _MissingGMCookieActionCheck = AssertNever<MissingGMCookieActions>;
type _ExtraGMCookieActionCheck = AssertNever<ExtraGMCookieActions>;

interface RuntimeMessageSender {
  tab?: {
    url?: string;
  };
  userScriptId?: string;
}

interface GMCookiePayload {
  domain?: string;
  expirationDate?: number;
  httpOnly?: boolean;
  name?: string;
  partitionKey?: unknown;
  path?: string;
  sameSite?: string;
  scriptId?: string;
  secure?: boolean;
  url?: string;
  value?: string;
}

interface ScriptRecord {
  [key: string]: unknown;
}

interface ScriptStorageRuntime {
  get(scriptId: string): Promise<ScriptRecord | null | undefined>;
}

interface SettingsManagerRuntime {
  get(): Promise<unknown>;
}

interface HostScopePolicyResult {
  allowed: boolean;
  error?: string;
}

interface CookiePartitionResult {
  error?: string;
  partitionKey?: unknown;
}

type CookieGetAll = (details: Record<string, unknown>) => Promise<unknown[]>;
type CookieSet = (details: Record<string, unknown>) => Promise<unknown>;
type CookieRemove = (details: Record<string, unknown>) => Promise<unknown>;

declare const ScriptStorage: ScriptStorageRuntime;
declare const SettingsManager: SettingsManagerRuntime;
declare const isHttpCookieUrl: (url: unknown) => boolean;
declare const normalizeCookiePartitionKey: (value: unknown) => CookiePartitionResult;
declare const resolveScriptCookieIsolationPartitionKey: (
  script: ScriptRecord,
  fallbackScriptId?: string,
) => CookiePartitionResult;
declare const resolveCookiePolicyTarget: (data: GMCookiePayload, sender: RuntimeMessageSender) => string;
declare const evaluateScriptHostScopePolicy: (
  script: ScriptRecord,
  url: string,
  label: string,
  settings: unknown,
) => HostScopePolicyResult;

const GM_COOKIE_ACTION_SET: ReadonlySet<string> = new Set(GM_COOKIE_ACTIONS);

function cookieGetAll(): CookieGetAll {
  return chrome.cookies.getAll as unknown as CookieGetAll;
}

function cookieSet(): CookieSet {
  return chrome.cookies.set as unknown as CookieSet;
}

function cookieRemove(): CookieRemove {
  return chrome.cookies.remove as unknown as CookieRemove;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

async function getCookieScript(data: GMCookiePayload, sender: RuntimeMessageSender): Promise<{ error?: string; script?: ScriptRecord; scriptId?: string }> {
  // Trust the browser-supplied user-script id over any caller-supplied one. When
  // the message genuinely originates from a registered userscript, `userScriptId`
  // is set by Chrome; a script must not be able to name a *different* script's id
  // to have that script's host-scope policy evaluated. A caller-supplied id is
  // only honored when there is no authenticated user-script context (e.g. an
  // extension page bridging the request).
  if (sender.userScriptId && data.scriptId && data.scriptId !== sender.userScriptId) {
    return { error: 'Script context mismatch' };
  }
  const scriptId = sender.userScriptId || data.scriptId;
  if (!scriptId) return { error: 'Missing script context' };
  const script = await ScriptStorage.get(scriptId);
  if (!script) return { error: 'Script context not found' };
  return { script, scriptId };
}

async function enforceCookiePolicy(script: ScriptRecord, url: string): Promise<string | null> {
  const settings = await SettingsManager.get();
  const policy = evaluateScriptHostScopePolicy(script, url, 'Cookie access', settings);
  return policy.allowed ? null : policy.error || 'Cookie access denied';
}

function resolveCookiePartition(data: GMCookiePayload, script: ScriptRecord, scriptId?: string): CookiePartitionResult {
  if (Object.prototype.hasOwnProperty.call(data, 'partitionKey')) {
    return normalizeCookiePartitionKey(data.partitionKey);
  }
  return resolveScriptCookieIsolationPartitionKey(script, scriptId);
}

export function isGMCookieAction(action: unknown): action is GMCookieAction {
  return typeof action === 'string' && GM_COOKIE_ACTION_SET.has(action);
}

export async function handleGMCookieMessage(
  action: GMCookieAction,
  data: GMCookiePayload = {},
  sender: RuntimeMessageSender = {},
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'GM_cookie_list': {
      try {
        const context = await getCookieScript(data, sender);
        if (context.error) return { error: context.error };
        const details: Record<string, unknown> = {};
        if (data.url) {
          if (!isHttpCookieUrl(data.url)) return { error: 'url must be http(s)://' };
          details.url = data.url;
        }
        if (data.domain) details.domain = data.domain;
        if (data.name) details.name = data.name;
        if (data.path) details.path = data.path;
        const partition = resolveCookiePartition(data, context.script as ScriptRecord, context.scriptId);
        if (partition.error) return { error: partition.error };
        if (partition.partitionKey) details.partitionKey = partition.partitionKey;
        const cookieTargetUrl = resolveCookiePolicyTarget(data, sender);
        if (!cookieTargetUrl) return { error: 'url or domain is required for cookie list' };
        if (!isHttpCookieUrl(cookieTargetUrl)) return { error: 'url must be http(s)://' };
        const policyError = await enforceCookiePolicy(context.script as ScriptRecord, cookieTargetUrl);
        if (policyError) return { error: policyError };
        if (!details.url && !details.domain) details.url = cookieTargetUrl;
        const cookies = await cookieGetAll()(details);
        return { success: true, cookies };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    }

    case 'GM_cookie_set': {
      try {
        if (!data.url) return { error: 'url is required for cookie set' };
        if (!data.name) return { error: 'name is required for cookie set' };
        if (!isHttpCookieUrl(data.url)) return { error: 'url must be http(s)://' };
        const context = await getCookieScript(data, sender);
        if (context.error) return { error: context.error };
        const policyError = await enforceCookiePolicy(context.script as ScriptRecord, data.url);
        if (policyError) return { error: policyError };
        const partition = resolveCookiePartition(data, context.script as ScriptRecord, context.scriptId);
        if (partition.error) return { error: partition.error };
        const cookie = await cookieSet()({
          url: data.url,
          name: data.name,
          value: data.value || '',
          domain: data.domain,
          path: data.path || '/',
          secure: data.secure || false,
          httpOnly: data.httpOnly || false,
          expirationDate: data.expirationDate,
          sameSite: data.sameSite || 'unspecified',
          ...(partition.partitionKey ? { partitionKey: partition.partitionKey } : {}),
        });
        return { success: true, cookie };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    }

    case 'GM_cookie_delete': {
      try {
        if (!data.url || !data.name) return { error: 'url and name are required for cookie delete' };
        if (!isHttpCookieUrl(data.url)) return { error: 'url must be http(s)://' };
        const context = await getCookieScript(data, sender);
        if (context.error) return { error: context.error };
        const policyError = await enforceCookiePolicy(context.script as ScriptRecord, data.url);
        if (policyError) return { error: policyError };
        const partition = resolveCookiePartition(data, context.script as ScriptRecord, context.scriptId);
        if (partition.error) return { error: partition.error };
        await cookieRemove()({
          url: data.url,
          name: data.name,
          ...(partition.partitionKey ? { partitionKey: partition.partitionKey } : {}),
        });
        return { success: true };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    }

    default:
      return { error: `Unsupported GM_cookie action: ${action}` };
  }
}

export const GMCookieHandler = Object.freeze({
  GM_COOKIE_ACTIONS,
  handleGMCookieMessage,
  isGMCookieAction,
});

export default GMCookieHandler;
