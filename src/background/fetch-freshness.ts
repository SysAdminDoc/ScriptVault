// Shared fetch-freshness policy.
//
// Every remote read of userscript-shaped content (scheduled update checks,
// manual/explicit refreshes, subscription feed and feed-script pulls, and the
// intercepted `.user.js` / `.user.css` install fetch) used to pick its own
// caching behaviour. Only the scheduled update path sent validators; everything
// else called bare `fetch(url)` and inherited the shared HTTP cache, so a
// freshly-published script could install from a stale cached body and a manual
// "check now" could be answered without ever reaching the server.
//
// This module is the single place that decides, per intent:
//   * whether the shared HTTP cache may answer the request at all,
//   * whether ScriptVault's own stored validators are sent, and
//   * which response headers are worth persisting for the next check.
//
// ScriptVault never delegates freshness to the shared HTTP cache: every intent
// sets `cache: 'no-store'` so the browser can neither answer from nor write to
// it. Freshness is decided by explicitly-stored validators instead, which is
// what makes correct `304` handling possible — a browser-generated conditional
// request would be collapsed back into a `200` before `fetch()` resolved,
// hiding the "not modified" signal the update checker depends on.
//
// Runs in the MV3 service worker after being generated to
// modules/fetch-freshness.js.

/** Every remote-content read ScriptVault performs belongs to one of these. */
export type FetchIntent =
  /** Periodic alarm-driven update check. Conditional; a 304 is a success. */
  | 'scheduled-update'
  /** User asked for this script's update state right now. Unconditional. */
  | 'manual-update'
  /** Alarm-driven subscription feed pull. Conditional when validators exist. */
  | 'scheduled-feed'
  /** User added or refreshed a subscription by hand. Unconditional. */
  | 'manual-feed'
  /** A script body pulled because a feed listed it. Unconditional. */
  | 'feed-script'
  /** Interception of a `.user.js` / `.user.css` navigation. Unconditional. */
  | 'install';

export interface StoredValidators {
  /** Value of the `ETag` response header stored by the previous read. */
  etag?: string | null;
  /** Value of the `Last-Modified` response header stored previously. */
  lastModified?: string | null;
}

export interface FreshnessInitOptions extends StoredValidators {
  /** Extra request headers to merge under the policy's own headers. */
  headers?: Record<string, string> | null;
  /** Additional `fetch` init fields (`signal`, `method`, …) to carry through. */
  init?: Record<string, unknown> | null;
}

export interface FreshnessInit {
  cache: RequestCache;
  headers: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Intents that may send `If-None-Match` / `If-Modified-Since` from stored
 * validators. Everything else is an explicit user action or a first read, where
 * a `304` would leave the caller with no body to act on.
 */
const CONDITIONAL_INTENTS: readonly FetchIntent[] = ['scheduled-update', 'scheduled-feed'];

/**
 * Intents whose response validators are worth persisting for the next check.
 * Explicit refreshes still record them: the value is used by the *next*
 * scheduled check, and refusing to store it would make every manual refresh
 * reset the conditional-request state.
 */
const VALIDATOR_STORING_INTENTS: readonly FetchIntent[] = [
  'scheduled-update',
  'manual-update',
  'scheduled-feed',
  'manual-feed',
];

const ALL_INTENTS: readonly FetchIntent[] = [
  'scheduled-update',
  'manual-update',
  'scheduled-feed',
  'manual-feed',
  'feed-script',
  'install',
];

/** True when `intent` is a known intent name. */
function isIntent(intent: unknown): intent is FetchIntent {
  return typeof intent === 'string' && (ALL_INTENTS as readonly string[]).includes(intent);
}

/**
 * True when this intent sends stored validators. An unknown intent is treated
 * as unconditional — the safe direction, since it costs bandwidth rather than
 * risking a `304` the caller cannot handle.
 */
export function isConditionalIntent(intent: unknown): boolean {
  return isIntent(intent) && (CONDITIONAL_INTENTS as readonly string[]).includes(intent);
}

/** True when a response's validators should be persisted for this intent. */
export function shouldStoreValidators(intent: unknown): boolean {
  return isIntent(intent) && (VALIDATOR_STORING_INTENTS as readonly string[]).includes(intent);
}

/** A header value is only usable if it is a non-empty, single-line string. */
function cleanValidator(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  // A validator with a control character would either be dropped by the fetch
  // header setter or, worse, split the request; refuse it here instead.
  if (!trimmed || /[\r\n\0]/.test(trimmed)) return '';
  return trimmed;
}

/**
 * Build the `fetch` init for a remote content read.
 *
 * Always `cache: 'no-store'`: the shared HTTP cache must never decide whether
 * ScriptVault sees a new script version. Conditional intents additionally send
 * the stored validators so an unchanged resource still costs only a `304`.
 */
export function buildFreshnessInit(intent: FetchIntent, options: FreshnessInitOptions = {}): FreshnessInit {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (isConditionalIntent(intent)) {
    const etag = cleanValidator(options.etag);
    const lastModified = cleanValidator(options.lastModified);
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;
  }
  return {
    ...(options.init || {}),
    // Set after the caller's init so an accidental `cache` there cannot
    // reintroduce shared-cache reads.
    cache: 'no-store',
    headers,
  };
}

/**
 * Read the validators worth storing off a response, normalized to the empty
 * string when absent so callers can persist them without `null` bookkeeping.
 * Returns `null` when this intent does not store validators, or when the
 * response carried none (so a server that stops sending them does not silently
 * clear a working pair).
 */
export function readResponseValidators(
  intent: FetchIntent,
  response: { headers?: { get(name: string): string | null } } | null | undefined,
): { etag: string; lastModified: string } | null {
  if (!shouldStoreValidators(intent)) return null;
  const get = response?.headers?.get;
  if (typeof get !== 'function') return null;
  const etag = cleanValidator(response!.headers!.get('etag'));
  const lastModified = cleanValidator(response!.headers!.get('last-modified'));
  if (!etag && !lastModified) return null;
  return { etag, lastModified };
}

/** How old the stored source is, in ms, or `null` when never read. */
export function sourceAgeMs(fetchedAt: unknown, now: number = Date.now()): number | null {
  const stamp = Number(fetchedAt);
  if (!Number.isFinite(stamp) || stamp <= 0) return null;
  return Math.max(0, now - stamp);
}

export const FetchFreshness = {
  INTENTS: ALL_INTENTS,
  CONDITIONAL_INTENTS,
  VALIDATOR_STORING_INTENTS,
  isConditionalIntent,
  shouldStoreValidators,
  buildFreshnessInit,
  readResponseValidators,
  sourceAgeMs,
};

export default FetchFreshness;
