// ============================================================================
// Generated from src/background/local-libraries.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const LocalLibraries = (() => {
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

  // src/background/local-libraries.ts
  var local_libraries_exports = {};
  __export(local_libraries_exports, {
    LocalLibraries: () => LocalLibraries,
    MAX_LOCAL_LIBRARIES: () => MAX_LOCAL_LIBRARIES,
    MAX_LOCAL_LIBRARY_BYTES: () => MAX_LOCAL_LIBRARY_BYTES,
    createLocalLibrarySnapshot: () => createLocalLibrarySnapshot,
    default: () => local_libraries_default,
    getLocalLibraryRequireScripts: () => getLocalLibraryRequireScripts,
    getLocalLibraryReviewSignals: () => getLocalLibraryReviewSignals,
    normalizeLocalLibrarySnapshots: () => normalizeLocalLibrarySnapshots
  });
  module.exports = __toCommonJS(local_libraries_exports);
  var MAX_LOCAL_LIBRARIES = 8;
  var MAX_LOCAL_LIBRARY_BYTES = 512 * 1024;
  var SHA256_HEX = /^[a-f0-9]{64}$/;
  var LOCAL_LIBRARY_ID = /^local-library-[a-z0-9_-]{8,96}$/;
  function byteLength(value) {
    return new TextEncoder().encode(value).length;
  }
  function safeLibraryName(value) {
    const text = typeof value === "string" ? value.trim() : "";
    const leaf = text.split(/[\\/]/).filter(Boolean).pop() || "local-library.js";
    return leaf.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160) || "local-library.js";
  }
  function safeLibraryId(value, fallbackSeed = "") {
    const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (LOCAL_LIBRARY_ID.test(candidate)) return candidate;
    const seed = fallbackSeed.replace(/[^a-z0-9_-]/gi, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "snapshot";
    return `local-library-${seed}-${Date.now().toString(36)}`;
  }
  async function sha256Hex(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function createLocalLibrarySnapshot(input) {
    const code = typeof input?.code === "string" ? input.code : "";
    const name = safeLibraryName(input?.name);
    if (!code.trim()) return { ok: false, error: "Choose a non-empty JavaScript library." };
    if (code.includes("\0")) return { ok: false, error: "Local libraries cannot contain NUL characters." };
    const bytes = byteLength(code);
    if (bytes > MAX_LOCAL_LIBRARY_BYTES) {
      return { ok: false, error: `Local library is too large. Maximum is ${MAX_LOCAL_LIBRARY_BYTES / 1024} KB.` };
    }
    const sha256 = await sha256Hex(code);
    return {
      ok: true,
      snapshot: {
        id: safeLibraryId(input?.id, name.replace(/\.m?js$/i, "")),
        name,
        code,
        sha256,
        bytes,
        reviewedAt: Number.isFinite(Number(input?.reviewedAt)) && Number(input.reviewedAt) > 0 ? Number(input.reviewedAt) : Date.now()
      }
    };
  }
  function normalizeLocalLibrarySnapshots(input) {
    const values = Array.isArray(input) ? input.slice(0, MAX_LOCAL_LIBRARIES) : [];
    const normalized = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const value of values) {
      if (!value || typeof value !== "object") continue;
      const candidate = value;
      const id = typeof candidate.id === "string" ? candidate.id.trim().toLowerCase() : "";
      const code = typeof candidate.code === "string" ? candidate.code : "";
      const sha256 = typeof candidate.sha256 === "string" ? candidate.sha256.trim().toLowerCase() : "";
      const bytes = byteLength(code);
      if (!LOCAL_LIBRARY_ID.test(id) || seenIds.has(id) || !code.trim() || code.includes("\0")) continue;
      if (!SHA256_HEX.test(sha256) || bytes > MAX_LOCAL_LIBRARY_BYTES) continue;
      seenIds.add(id);
      normalized.push({
        id,
        name: safeLibraryName(candidate.name),
        code,
        sha256,
        bytes,
        reviewedAt: Number.isFinite(Number(candidate.reviewedAt)) && Number(candidate.reviewedAt) > 0 ? Number(candidate.reviewedAt) : 0
      });
    }
    return normalized;
  }
  function getLocalLibraryRequireScripts(settings) {
    const candidate = settings && typeof settings === "object" ? settings.localLibraries : void 0;
    return normalizeLocalLibrarySnapshots(candidate).map((snapshot) => ({
      url: `local-library://${encodeURIComponent(snapshot.name)}#sha256=${snapshot.sha256}`,
      code: snapshot.code
    }));
  }
  function getLocalLibraryReviewSignals(codeInput) {
    const code = typeof codeInput === "string" ? codeInput : "";
    const signals = [];
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(code)) signals.push("dynamic code execution");
    if (/\b(?:fetch|XMLHttpRequest|WebSocket|GM_xmlhttpRequest)\b/.test(code)) signals.push("network access");
    if (/\b(?:document\.cookie|localStorage|indexedDB)\b/.test(code)) signals.push("site or browser storage");
    if (/\.innerHTML\s*=|document\.write\s*\(/.test(code)) signals.push("HTML injection");
    return signals;
  }
  var LocalLibraries = Object.freeze({
    MAX_LOCAL_LIBRARIES,
    MAX_LOCAL_LIBRARY_BYTES,
    createLocalLibrarySnapshot,
    getLocalLibraryRequireScripts,
    getLocalLibraryReviewSignals,
    normalizeLocalLibrarySnapshots
  });
  var local_libraries_default = LocalLibraries;
  return module.exports.default || module.exports.LocalLibraries || module.exports;
})();

if (typeof self !== 'undefined') {
  self.LocalLibraries = LocalLibraries;
}
