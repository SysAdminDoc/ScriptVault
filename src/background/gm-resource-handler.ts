import type { BackgroundMessage } from '../types/messages';

export type GMResourceAction = Extract<
  BackgroundMessage['action'],
  | 'GM_getResourceText'
  | 'GM_getResourceURL'
  | 'GM_loadScript'
>;

export const GM_RESOURCE_ACTIONS = [
  'GM_getResourceText',
  'GM_getResourceURL',
  'GM_loadScript',
] as const satisfies readonly GMResourceAction[];

type AssertNever<T extends never> = T;
type MissingGMResourceActions = Exclude<GMResourceAction, typeof GM_RESOURCE_ACTIONS[number]>;
type ExtraGMResourceActions = Exclude<typeof GM_RESOURCE_ACTIONS[number], GMResourceAction>;
type _MissingGMResourceActionCheck = AssertNever<MissingGMResourceActions>;
type _ExtraGMResourceActionCheck = AssertNever<ExtraGMResourceActions>;

interface GMResourcePayload {
  name?: string;
  scriptId?: string;
  timeout?: number;
  url?: string;
}

interface RuntimeMessageSender {
  tab?: { id?: number; url?: string };
  userScriptId?: string;
}

interface ScriptRecord {
  meta?: {
    resource?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ScriptStorageRuntime {
  get(scriptId: string | undefined): Promise<ScriptRecord | null | undefined>;
}

interface ResourceCacheRuntime {
  fetchResource(url: string): Promise<string>;
  getDataUri(url: string): Promise<string>;
}

interface ConnectPolicyResult {
  allowed: boolean;
  error?: string;
}

interface InternalHostCheckResult {
  ok: boolean;
  message: string;
}

interface InternalHostGuardRuntime {
  classifyFetchUrl(url: string, allowedProtocols: string[]): InternalHostCheckResult;
  classifyResponseUrl(response: Response, allowedProtocols: string[]): InternalHostCheckResult;
}

declare const ScriptStorage: ScriptStorageRuntime;
declare const ResourceCache: ResourceCacheRuntime;
declare const evaluateConnectPolicy: (script: ScriptRecord, url: string) => ConnectPolicyResult;
declare const InternalHostGuard: InternalHostGuardRuntime;
declare const _fetchTextBounded: (response: Response, maxBytes: number, label: string) => Promise<string>;
declare const MAX_SCRIPT_SIZE: number;

const GM_RESOURCE_ACTION_SET: ReadonlySet<string> = new Set(GM_RESOURCE_ACTIONS);

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export function isGMResourceAction(action: unknown): action is GMResourceAction {
  return typeof action === 'string' && GM_RESOURCE_ACTION_SET.has(action);
}

export async function handleGMResourceMessage(
  action: GMResourceAction,
  data: GMResourcePayload = {},
  sender: RuntimeMessageSender = {},
): Promise<unknown> {
  // Bind to the authenticated caller so a script can't read another script's
  // @resource bodies or borrow its @connect scope via GM_loadScript by forging
  // data.scriptId. Mirrors the gm-values/network handlers.
  const ownedScriptId = sender.userScriptId || data.scriptId;
  switch (action) {
    case 'GM_getResourceText': {
      const script = await ScriptStorage.get(ownedScriptId);
      if (!script || !script.meta?.resource) return null;
      const url = data.name ? script.meta.resource[data.name] : undefined;
      if (!url) return null;
      try {
        return await ResourceCache.fetchResource(url);
      } catch (_) {
        return null;
      }
    }

    case 'GM_getResourceURL': {
      const script = await ScriptStorage.get(ownedScriptId);
      if (!script || !script.meta?.resource) return null;
      const url = data.name ? script.meta.resource[data.name] : undefined;
      if (!url) return null;
      try {
        return await ResourceCache.getDataUri(url);
      } catch (_) {
        return null;
      }
    }

    case 'GM_loadScript': {
      try {
        if (!data.url) return { error: 'No URL provided' };
        if (!ownedScriptId) return { error: 'Missing script context' };
        const script = await ScriptStorage.get(ownedScriptId);
        if (!script) return { error: 'Script context not found' };

        const policy = evaluateConnectPolicy(script, data.url);
        if (!policy.allowed) return { error: policy.error };

        const preCheck = InternalHostGuard.classifyFetchUrl(data.url, ['http:', 'https:']);
        if (!preCheck.ok) {
          return { error: 'GM_loadScript URL rejected: ' + preCheck.message };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), data.timeout || 30000);
        let code;
        try {
          const response = await fetch(data.url, { signal: controller.signal });
          if (!response.ok) return { error: `HTTP ${response.status}` };
          const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
          if (!postCheck.ok) {
            return { error: 'GM_loadScript URL redirected to ' + postCheck.message };
          }
          try {
            code = await _fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script');
          } catch (sizeError) {
            return { error: errorMessage(sizeError, String(sizeError)) };
          }
        } finally {
          clearTimeout(timeoutId);
        }
        if (!code || code.length === 0) return { error: 'Empty response' };
        return { code };
      } catch (error) {
        return { error: errorMessage(error, 'Fetch failed') };
      }
    }

    default:
      return { error: `Unsupported GM resource action: ${action}` };
  }
}

export const GMResourceHandler = Object.freeze({
  GM_RESOURCE_ACTIONS,
  handleGMResourceMessage,
  isGMResourceAction,
});

export default GMResourceHandler;
