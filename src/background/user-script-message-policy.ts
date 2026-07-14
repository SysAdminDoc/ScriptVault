// ============================================================================
// User-script message policy
// ============================================================================

export const USER_SCRIPT_ALLOWED_EXTRAS = Object.freeze([
  'chainDomEvent',
  'getChainDomEventTriggers',
  'netlog_record',
  'recordBridgeTelemetry',
  'reportDocumentReady',
  'reportExecError',
  'reportExecTime',
] as const);

const USER_SCRIPT_ALLOWED_EXTRA_SET = new Set<string>(USER_SCRIPT_ALLOWED_EXTRAS);
const USER_SCRIPT_AUTHENTICATED_EXTRA_SET = new Set<string>([
  'netlog_record',
  'reportExecError',
  'reportExecTime',
]);

interface RuntimeMessageSender {
  id?: string;
  url?: string;
  tab?: unknown;
  userScriptId?: string;
}

interface UserScriptRuntimeMessage {
  action?: unknown;
  data?: {
    scriptAuthToken?: unknown;
    scriptId?: unknown;
  };
  scriptAuthToken?: unknown;
  scriptId?: unknown;
}

const SCRIPT_AUTH_SECRET_KEY = '_scriptMessageAuthSecretV1';
const SCRIPT_AUTH_REGISTRATION_KEY = '_scriptMessageAuthRegistrationVersion';
const SCRIPT_AUTH_REGISTRATION_VERSION = 2;
let scriptAuthSecretPromise: Promise<string> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function getScriptAuthSecret(): Promise<string> {
  if (!scriptAuthSecretPromise) {
    scriptAuthSecretPromise = (async () => {
      const stored = await chrome.storage.local.get(SCRIPT_AUTH_SECRET_KEY);
      const existing = stored?.[SCRIPT_AUTH_SECRET_KEY];
      if (typeof existing === 'string' && /^[a-f0-9]{64}$/u.test(existing)) return existing;

      const secretBytes = new Uint8Array(32);
      globalThis.crypto.getRandomValues(secretBytes);
      const secret = bytesToHex(secretBytes);
      await chrome.storage.local.set({ [SCRIPT_AUTH_SECRET_KEY]: secret });
      return secret;
    })().catch(error => {
      scriptAuthSecretPromise = null;
      throw error;
    });
  }
  return await scriptAuthSecretPromise;
}

export async function getScriptAuthToken(scriptId: string): Promise<string> {
  if (typeof scriptId !== 'string' || !scriptId) {
    throw new Error('A script id is required for authenticated GM messaging');
  }
  const secret = await getScriptAuthSecret();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    hexToBytes(secret).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(scriptId),
  );
  return bytesToHex(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function authenticateUserScriptSender(
  message: UserScriptRuntimeMessage,
  sender: RuntimeMessageSender,
): Promise<RuntimeMessageSender> {
  if (sender?.userScriptId) return sender;
  const action = message?.action;
  const requiresAuthentication = typeof action === 'string'
    && (action.startsWith('GM_') || action.startsWith('GM.') || USER_SCRIPT_AUTHENTICATED_EXTRA_SET.has(action));
  if (!requiresAuthentication) {
    return sender;
  }

  const data = message?.data && typeof message.data === 'object' ? message.data : message;
  const scriptId = typeof data.scriptId === 'string' ? data.scriptId : '';
  const suppliedToken = typeof data.scriptAuthToken === 'string' ? data.scriptAuthToken : '';
  if (!scriptId || !suppliedToken) {
    throw new Error('GM request could not be authenticated for this script');
  }
  const expectedToken = await getScriptAuthToken(scriptId);
  if (!constantTimeEqual(suppliedToken, expectedToken)) {
    throw new Error('GM request could not be authenticated for this script');
  }
  return { ...sender, userScriptId: scriptId };
}

export async function isScriptAuthRegistrationCurrent(): Promise<boolean> {
  const stored = await chrome.storage.local.get(SCRIPT_AUTH_REGISTRATION_KEY);
  return stored?.[SCRIPT_AUTH_REGISTRATION_KEY] === SCRIPT_AUTH_REGISTRATION_VERSION;
}

export async function markScriptAuthRegistrationCurrent(): Promise<void> {
  await chrome.storage.local.set({
    [SCRIPT_AUTH_REGISTRATION_KEY]: SCRIPT_AUTH_REGISTRATION_VERSION,
  });
}

export function isUserScriptAllowedAction(action: unknown): boolean {
  if (typeof action !== 'string') return false;
  if (action.startsWith('GM_') || action.startsWith('GM.')) return true;
  return USER_SCRIPT_ALLOWED_EXTRA_SET.has(action);
}

export function isExtensionSurfaceSender(
  sender: RuntimeMessageSender | null | undefined,
  extensionId: string | null | undefined,
): boolean {
  if (!sender || !extensionId) return false;

  const ownExtensionPrefix = `chrome-extension://${extensionId}/`;
  const url = typeof sender.url === 'string' ? sender.url : '';
  const ownChromeExtensionPage = sender.id === extensionId && url.startsWith(ownExtensionPrefix);
  const ownFirefoxExtensionPage = sender.id === extensionId && url.startsWith('moz-extension://');
  if (ownChromeExtensionPage || ownFirefoxExtensionPage) return true;

  // Service-worker self-messages have no sender.tab/url; only this extension's
  // own code can originate them.
  if (sender.id === extensionId && !sender.tab && !url) return true;

  return false;
}

export const UserScriptMessagePolicy = Object.freeze({
  USER_SCRIPT_ALLOWED_EXTRAS,
  authenticateUserScriptSender,
  getScriptAuthToken,
  isExtensionSurfaceSender,
  isScriptAuthRegistrationCurrent,
  isUserScriptAllowedAction,
  markScriptAuthRegistrationCurrent,
});

export default UserScriptMessagePolicy;
