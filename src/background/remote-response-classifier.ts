// Classify why a remote fetch did not yield a userscript.
//
// Every failure used to collapse into `parsed.error ?? 'Parse failed'`. When
// Greasy Fork — the dominant update and discovery host — sits behind a Cloudflare
// challenge (its own issue #1553) or serves an expired-certificate error (#1561),
// the challenge HTML reaches `parseUserscript` and the user is told their SCRIPT
// is broken rather than that the HOST is. Worse, the exponential-backoff ring
// treats a host outage exactly like a corrupt body, so repeated challenges drive
// the script's update checks toward silence.
//
// The distinction that matters operationally: a host-level failure says nothing
// about the script, so it must not advance that script's failure ring or mark it
// as having a pending update. A genuinely bad body does.
//
// Runs in the MV3 service worker after being generated to
// modules/remote-response-classifier.js.

export type RemoteFailureKind =
  /** An interstitial or bot-check page instead of the resource. */
  | 'host-challenge'
  /** TLS, DNS, connection or timeout — the request never completed. */
  | 'transport'
  /** The host answered with a non-2xx status. */
  | 'http-status'
  /** A 2xx body that is not a userscript (HTML error page, truncated, junk). */
  | 'not-a-userscript'
  /** A 2xx userscript whose metadata block would not parse. */
  | 'parse-error';

export interface RemoteFailure {
  kind: RemoteFailureKind;
  /** Actionable, host-naming message for the UI. */
  message: string;
  /**
   * True when the failure is about the host rather than the script.
   *
   * Callers use this to leave the script's failure ring and pending-update state
   * alone: a host being down is not evidence the script is broken, and letting it
   * accumulate backoff is how a transient outage turns into permanent silence.
   */
  hostLevel: boolean;
  /** Host the failure is attributed to, when it could be derived. */
  host: string;
  /** Raw detail for logs; never the primary user-facing text. */
  detail: string;
}

/** Markers of an interstitial served in place of the requested resource. */
const CHALLENGE_MARKERS: readonly RegExp[] = [
  /just a moment/i,
  /cf[-_]?chl[-_]?(?:opt|jschl|tk)/i,
  /cf-browser-verification/i,
  /challenge-platform/i,
  /_cf_chl_/i,
  /attention required!/i,
  /checking your browser before accessing/i,
  /enable javascript and cookies to continue/i,
  /ddos[- ]protection by/i,
  /<title>\s*access denied/i,
];

/** Transport-layer error text, as surfaced by fetch/undici/Gecko. */
const TRANSPORT_MARKERS: readonly RegExp[] = [
  /failed to fetch/i,
  /networkerror/i,
  /err_(?:connection|name_not_resolved|internet_disconnected|timed_out|cert|ssl)/i,
  /certificate/i,
  /\bcert_/i,
  /ssl|tls/i,
  /getaddrinfo|enotfound|econnrefused|econnreset|etimedout|eai_again/i,
  /dns/i,
  /timed out/i,
  /aborted/i,
];

function hostOf(url: unknown): string {
  try {
    return new URL(String(url || '')).host || '';
  } catch {
    return '';
  }
}

function firstBytes(body: unknown, limit = 4096): string {
  return typeof body === 'string' ? body.slice(0, limit) : '';
}

/** True when a body looks like HTML rather than a script. */
export function looksLikeHtml(body: unknown): boolean {
  const head = firstBytes(body).trimStart();
  if (!head) return false;
  return /^<(?:!doctype\s+html|html|head|body|meta|script[\s>]|title[\s>])/i.test(head)
    || /<html[\s>]/i.test(head);
}

/** True when a body is one of the known bot-check interstitials. */
export function looksLikeHostChallenge(body: unknown, status?: unknown): boolean {
  const head = firstBytes(body);
  if (!head) return false;
  if (CHALLENGE_MARKERS.some((marker) => marker.test(head))) return true;
  // 403/429/503 carrying HTML is the shape of a challenge or rate-limit page,
  // whereas the same status with a JSON or text body is an ordinary refusal.
  const code = Number(status);
  return (code === 403 || code === 429 || code === 503) && looksLikeHtml(head);
}

/** True when a thrown fetch error is a transport failure rather than a refusal. */
export function isTransportError(error: unknown): boolean {
  const text = error instanceof Error
    ? `${error.name || ''} ${error.message || ''}`
    : String(error || '');
  if (!text.trim()) return false;
  return TRANSPORT_MARKERS.some((marker) => marker.test(text));
}

/** Classify a fetch that threw before any response arrived. */
export function classifyFetchError(url: unknown, error: unknown, label = 'Update'): RemoteFailure {
  const host = hostOf(url);
  const detail = error instanceof Error ? (error.message || String(error)) : String(error || '');
  const where = host ? ` from ${host}` : '';
  if (isTransportError(error)) {
    return {
      kind: 'transport',
      hostLevel: true,
      host,
      detail,
      message: `${label} could not reach${where ? where.replace(' from', '') : ' the update host'}: ${detail || 'the connection failed'}. This is a problem with the host or the network, not with the script.`,
    };
  }
  return {
    kind: 'transport',
    hostLevel: true,
    host,
    detail,
    message: `${label} request${where} failed: ${detail || 'unknown error'}. This is a problem with the host, not with the script.`,
  };
}

/**
 * Classify a completed response that did not yield an installable userscript.
 *
 * `parseError` is the message `parseUserscript` produced, when it ran at all.
 */
export function classifyRemoteResponse(options: {
  url?: unknown;
  status?: unknown;
  contentType?: unknown;
  body?: unknown;
  parseError?: unknown;
  label?: string;
}): RemoteFailure | null {
  const label = options.label || 'Update';
  const host = hostOf(options.url);
  const where = host ? ` from ${host}` : '';
  const body = options.body;
  const status = Number(options.status);

  if (looksLikeHostChallenge(body, options.status)) {
    return {
      kind: 'host-challenge',
      hostLevel: true,
      host,
      detail: firstBytes(body, 200),
      message: `${host || 'The update host'} returned a browser-check page instead of the script. Open ${host || 'the host'} in a tab once to clear the challenge, then check again. The script itself is unchanged.`,
    };
  }

  if (Number.isFinite(status) && status >= 400) {
    return {
      kind: 'http-status',
      hostLevel: true,
      host,
      detail: `HTTP ${status}`,
      message: `${label} host${where} answered HTTP ${status}. Nothing is wrong with the installed script.`,
    };
  }

  const declaredHtml = /text\/html/i.test(String(options.contentType || ''));
  if (declaredHtml || looksLikeHtml(body)) {
    return {
      kind: 'not-a-userscript',
      hostLevel: true,
      host,
      detail: firstBytes(body, 200),
      message: `${host || 'The update host'} served a web page instead of a userscript. The update URL may have moved or now needs a login. The installed script is untouched.`,
    };
  }

  if (typeof body === 'string' && !body.includes('==UserScript==')) {
    return {
      kind: 'not-a-userscript',
      hostLevel: true,
      host,
      detail: firstBytes(body, 200),
      message: `The response${where} is not a userscript (no metadata block). The update URL may be wrong or the download was truncated.`,
    };
  }

  if (options.parseError) {
    // The body IS a userscript and its metadata is bad — this one is about the
    // script, so it should count against it.
    return {
      kind: 'parse-error',
      hostLevel: false,
      host,
      detail: String(options.parseError),
      message: `The updated script${where} could not be parsed: ${String(options.parseError)}`,
    };
  }

  return null;
}

export const RemoteResponseClassifier = {
  looksLikeHtml,
  looksLikeHostChallenge,
  isTransportError,
  classifyFetchError,
  classifyRemoteResponse,
};

export default RemoteResponseClassifier;
