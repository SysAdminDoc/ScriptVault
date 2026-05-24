// ============================================================================
// Generated from src/background/internal-host-guard.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const InternalHostGuard = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/background/internal-host-guard.ts
  var internal_host_guard_exports = {};
  __export(internal_host_guard_exports, {
    assertExternalFetchUrl: () => assertExternalFetchUrl,
    classifyFetchUrl: () => classifyFetchUrl,
    classifyResponseUrl: () => classifyResponseUrl,
    isInternalHost: () => isInternalHost
  });
  module.exports = __toCommonJS(internal_host_guard_exports);
  function isInternalIPv4(ip) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (typeof rawHost !== "string" || !rawHost) return true;
    let h = rawHost.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    if (h === "localhost" || h === "localhost.localdomain" || h === "ip6-localhost" || h === "ip6-loopback") {
      return true;
    }
    if (h.includes(":")) {
      if (h === "::1" || h === "::" || h === "::0" || h === "0:0:0:0:0:0:0:0" || h === "0:0:0:0:0:0:0:1") return true;
      if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
      if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
      const v4MappedDotted = h.match(/^::ffff:([0-9.]+)$/);
      if (v4MappedDotted) return isInternalIPv4(v4MappedDotted[1]);
      const v4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (v4MappedHex) {
        const hi = parseInt(v4MappedHex[1], 16);
        const lo = parseInt(v4MappedHex[2], 16);
        const dotted = [hi >> 8 & 255, hi & 255, lo >> 8 & 255, lo & 255].join(".");
        return isInternalIPv4(dotted);
      }
      return false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      return isInternalIPv4(h);
    }
    return false;
  }
  function classifyFetchUrl(url, allowedSchemes = ["https:"]) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "malformed-url", url: null, message: "malformed URL" };
    }
    if (!allowedSchemes.includes(parsed.protocol)) {
      return {
        ok: false,
        reason: "unsupported-scheme",
        url: parsed,
        message: `unsupported scheme ${parsed.protocol}`
      };
    }
    const host = parsed.hostname || "";
    if (!host) {
      return { ok: false, reason: "empty-hostname", url: parsed, message: "empty hostname" };
    }
    if (isInternalHost(host)) {
      let reason = "internal-host";
      if (host === "localhost" || host.endsWith(".localdomain") || host === "ip6-localhost" || host === "ip6-loopback") {
        reason = "localhost-alias";
      } else if (host.includes(":")) {
        reason = "ipv6-internal";
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        reason = "ipv4-internal";
      }
      return { ok: false, reason, url: parsed, message: `internal host (${reason})` };
    }
    return { ok: true, reason: null, url: parsed, message: "" };
  }
  function assertExternalFetchUrl(url, label, allowedSchemes = ["https:"]) {
    const result = classifyFetchUrl(url, allowedSchemes);
    if (!result.ok || !result.url) {
      throw new Error(`${label}: ${result.message || "rejected URL"}`);
    }
    return result.url;
  }
  function classifyResponseUrl(response, allowedSchemes = ["https:"]) {
    const finalUrl = typeof response?.url === "string" ? response.url : "";
    if (!finalUrl) {
      return { ok: true, reason: null, url: null, message: "" };
    }
    return classifyFetchUrl(finalUrl, allowedSchemes);
  }
  return module.exports.default || module.exports.InternalHostGuard || module.exports;
})();
