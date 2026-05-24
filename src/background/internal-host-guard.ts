/**
 * Internal-host guard for SW remote fetches.
 *
 * Shared classifier used by the install handler, @require/@resource loader,
 * update checker, and webhook gate. Rejects URLs whose hostname is a
 * loopback / private / link-local / CGNAT / unspecified / broadcast / ULA
 * address (IPv4 + IPv6, including ::ffff: v4-mapped form and `localhost`
 * aliases). Re-checked after each fetch via the response's final URL so a
 * redirect or DNS rebind cannot smuggle an internal target past a pre-flight
 * pass.
 *
 * The runtime JS mirror `modules/internal-host-guard.js` must stay in lock
 * step with this classifier; the parity contract is enforced by
 * `tests/internal-host-guard.test.js`.
 */

function isInternalIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
  const [a, b, c, d] = parts as [number, number, number, number];
  // 0.0.0.0/8 unspecified
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local (incl. 169.254.169.254 AWS/GCP metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 255.255.255.255 broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  return false;
}

/**
 * Returns true when `rawHost` is a host we refuse to fetch from the SW.
 * Bare DNS names (no IP literal, no alias) return false — the SW cannot
 * pre-resolve them. Post-fetch the caller must re-check `response.url` so a
 * DNS rebind that returns a private IP after the first hop is still caught
 * by the URL classifier (when the host became an IP literal in the final URL).
 */
export function isInternalHost(rawHost: unknown): boolean {
  if (typeof rawHost !== 'string' || !rawHost) return true;
  let h = rawHost.toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);

  if (h === 'localhost' || h === 'localhost.localdomain' || h === 'ip6-localhost' || h === 'ip6-loopback') {
    return true;
  }

  // IPv6 literal (contains a colon)
  if (h.includes(':')) {
    if (h === '::1' || h === '::' || h === '::0' || h === '0:0:0:0:0:0:0:0' || h === '0:0:0:0:0:0:0:1') return true;
    // fe80::/10 link-local
    if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
    // fc00::/7 ULA
    if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
    // IPv4-mapped IPv6 in textual dotted-quad form (::ffff:10.0.0.1)
    const v4MappedDotted = h.match(/^::ffff:([0-9.]+)$/);
    if (v4MappedDotted) return isInternalIPv4(v4MappedDotted[1]!);
    // IPv4-mapped IPv6 normalized by WHATWG URL parser (::ffff:a00:1 form).
    // The two trailing hextets encode the 4 octets of the v4 address.
    const v4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (v4MappedHex) {
      const hi = parseInt(v4MappedHex[1]!, 16);
      const lo = parseInt(v4MappedHex[2]!, 16);
      const dotted = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
      return isInternalIPv4(dotted);
    }
    return false;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return isInternalIPv4(h);
  }

  // Bare DNS name — undecidable without resolution; treat as safe. The
  // post-fetch URL check is the second line of defense.
  return false;
}

export type InternalHostReason =
  | 'malformed-url'
  | 'unsupported-scheme'
  | 'empty-hostname'
  | 'localhost-alias'
  | 'ipv6-internal'
  | 'ipv4-internal'
  | 'internal-host';

export interface InternalHostCheckResult {
  ok: boolean;
  reason: InternalHostReason | null;
  url: URL | null;
  message: string;
}

/**
 * Classify a URL string. `allowedSchemes` defaults to https-only because
 * SW-side remote fetches should opt into any broader scheme set explicitly.
 * Pass `['http:', 'https:']` for legacy userscript install/resource/update
 * paths that intentionally still accept plain HTTP.
 */
export function classifyFetchUrl(
  url: string,
  allowedSchemes: readonly string[] = ['https:'],
): InternalHostCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'malformed-url', url: null, message: 'malformed URL' };
  }
  if (!allowedSchemes.includes(parsed.protocol)) {
    return {
      ok: false,
      reason: 'unsupported-scheme',
      url: parsed,
      message: `unsupported scheme ${parsed.protocol}`,
    };
  }
  const host = parsed.hostname || '';
  if (!host) {
    return { ok: false, reason: 'empty-hostname', url: parsed, message: 'empty hostname' };
  }
  if (isInternalHost(host)) {
    let reason: InternalHostReason = 'internal-host';
    if (host === 'localhost' || host.endsWith('.localdomain') || host === 'ip6-localhost' || host === 'ip6-loopback') {
      reason = 'localhost-alias';
    } else if (host.includes(':')) {
      reason = 'ipv6-internal';
    } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      reason = 'ipv4-internal';
    }
    return { ok: false, reason, url: parsed, message: `internal host (${reason})` };
  }
  return { ok: true, reason: null, url: parsed, message: '' };
}

/**
 * Convenience predicate used by `installFromUrl`, `fetchRequireScript`,
 * `fetchWithRetry`, and `ResourceCache.fetchResource`. Throws an Error with a
 * stable, user-facing message when the URL is rejected so the existing
 * error-handling paths surface the reason.
 */
export function assertExternalFetchUrl(
  url: string,
  label: string,
  allowedSchemes: readonly string[] = ['https:'],
): URL {
  const result = classifyFetchUrl(url, allowedSchemes);
  if (!result.ok || !result.url) {
    throw new Error(`${label}: ${result.message || 'rejected URL'}`);
  }
  return result.url;
}

/**
 * Validate the *final* URL of a fetch response — guards against opaque
 * redirects from a public host into a private/loopback host after the
 * pre-flight pass. Returns the reason on rejection, null when safe.
 *
 * Pre-flight (`assertExternalFetchUrl`) and post-flight (this helper) MUST
 * both be called; pre-flight alone misses redirects, post-flight alone wastes
 * the round trip and may leak side effects (cache, set-cookie).
 */
export function classifyResponseUrl(
  response: { url?: string } | null | undefined,
  allowedSchemes: readonly string[] = ['https:'],
): InternalHostCheckResult {
  const finalUrl = typeof response?.url === 'string' ? response.url : '';
  if (!finalUrl) {
    // Response without a URL (mocked/fake) — treat as safe; the pre-flight
    // assertion already validated the requested URL.
    return { ok: true, reason: null, url: null, message: '' };
  }
  return classifyFetchUrl(finalUrl, allowedSchemes);
}
