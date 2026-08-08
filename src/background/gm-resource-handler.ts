import type { BackgroundMessage } from '../types/messages';

const HTTP_GM_LOAD_SCRIPT_SRI_ERROR = 'GM_loadScript over http requires a verifiable #sha256= integrity fragment';

function parseScriptIntegrity(url: string): { fetchUrl: string; sriHash: string | null } {
  const hashIdx = url.indexOf('#');
  if (hashIdx <= 0) return { fetchUrl: url, sriHash: null };
  const fragment = url.slice(hashIdx + 1);
  return /^(sha256|sha384|sha512)[-=]/i.test(fragment)
    ? { fetchUrl: url.slice(0, hashIdx), sriHash: fragment }
    : { fetchUrl: url, sriHash: null };
}

function hasVerifiableScriptIntegrity(hash: string | null): boolean {
  return /^(sha256|sha384|sha512)[-=]/i.test(hash || '');
}

function normalizeIntegrityBase64(value: string): string {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const remainder = normalized.length % 4;
  if (remainder === 2) normalized += '==';
  else if (remainder === 3) normalized += '=';
  return normalized;
}

async function verifyScriptIntegrity(code: string, hash: string): Promise<boolean> {
  const match = hash.match(/^(sha256|sha384|sha512)[-=](.+)$/i);
  if (!match?.[1] || !match[2]) return false;
  const algorithm = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }[match[1].toLowerCase() as 'sha256' | 'sha384' | 'sha512'];
  try {
    const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(code));
    const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return normalizeIntegrityBase64(actual) === normalizeIntegrityBase64(match[2]);
  } catch {
    return false;
  }
}

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

        const { fetchUrl, sriHash } = parseScriptIntegrity(data.url);
        let isPlainHttp = false;
        try {
          isPlainHttp = new URL(fetchUrl).protocol === 'http:';
        } catch {
          return { error: 'GM_loadScript URL rejected: invalid URL' };
        }
        if (isPlainHttp && !hasVerifiableScriptIntegrity(sriHash)) {
          return { error: HTTP_GM_LOAD_SCRIPT_SRI_ERROR };
        }

        const policy = evaluateConnectPolicy(script, fetchUrl);
        if (!policy.allowed) return { error: policy.error };

        const preCheck = InternalHostGuard.classifyFetchUrl(fetchUrl, ['http:', 'https:']);
        if (!preCheck.ok) {
          return { error: 'GM_loadScript URL rejected: ' + preCheck.message };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), data.timeout || 30000);
        let code;
        try {
          const response = await fetch(fetchUrl, { signal: controller.signal });
          if (!response.ok) return { error: `HTTP ${response.status}` };
          const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
          if (!postCheck.ok) {
            return { error: 'GM_loadScript URL redirected to ' + postCheck.message };
          }
          // fetch() follows redirects, so @connect must hold for where the
          // chain actually ended — otherwise an allowed host can bounce the
          // request to an arbitrary one whose body is then executed.
          if (response.url && response.url !== fetchUrl) {
            let crossOrigin = true;
            try {
              crossOrigin = new URL(response.url).origin !== new URL(fetchUrl).origin;
            } catch { crossOrigin = true; }
            if (crossOrigin) {
              const redirectPolicy = evaluateConnectPolicy(script, response.url);
              if (!redirectPolicy.allowed) {
                return { error: redirectPolicy.error || 'GM_loadScript redirect blocked by @connect' };
              }
            }
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
        if (sriHash && !(await verifyScriptIntegrity(code, sriHash))) {
          return { error: 'GM_loadScript integrity hash mismatch' };
        }
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
