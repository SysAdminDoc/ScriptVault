// ============================================================================
// Generated from src/bg/signing.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptSigning = (() => {
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

  // src/bg/signing.ts
  var signing_exports = {};
  __export(signing_exports, {
    ScriptSigning: () => ScriptSigning
  });
  module.exports = __toCommonJS(signing_exports);
  var ScriptSigning = {
    // ── Key management ───────────────────────────────────────────────────────
    async getOrCreateKeypair() {
      const stored = await chrome.storage.local.get("signingKeypair");
      if (stored["signingKeypair"]) {
        return stored["signingKeypair"];
      }
      return this.generateAndStoreKeypair();
    },
    async generateAndStoreKeypair() {
      const keypair = await crypto.subtle.generateKey(
        { name: "Ed25519" },
        true,
        // extractable
        ["sign", "verify"]
      );
      const publicKeyJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);
      const privateKeyJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);
      const stored = { publicKeyJwk, privateKeyJwk };
      await chrome.storage.local.set({ signingKeypair: stored });
      return stored;
    },
    async getPublicKeyJwk() {
      const kp = await this.getOrCreateKeypair();
      return kp.publicKeyJwk;
    },
    // ── Signing ──────────────────────────────────────────────────────────────
    async signScript(code) {
      const kp = await this.getOrCreateKeypair();
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        kp.privateKeyJwk,
        { name: "Ed25519" },
        false,
        ["sign"]
      );
      const encoder = new TextEncoder();
      const signatureBuffer = await crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        encoder.encode(code)
      );
      const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const publicKeyB64 = kp.publicKeyJwk.x;
      return {
        signature: signatureB64,
        publicKey: publicKeyB64,
        algorithm: "Ed25519",
        timestamp: Date.now()
      };
    },
    // ── Verification ──────────────────────────────────────────────────────────
    async verifyScript(code, signatureInfo) {
      if (!signatureInfo?.signature || !signatureInfo?.publicKey) {
        return { valid: false, reason: "Missing signature or public key" };
      }
      try {
        const publicKeyJwk = {
          kty: "OKP",
          crv: "Ed25519",
          x: signatureInfo.publicKey,
          key_ops: ["verify"]
        };
        const publicKey = await crypto.subtle.importKey(
          "jwk",
          publicKeyJwk,
          { name: "Ed25519" },
          false,
          ["verify"]
        );
        const encoder = new TextEncoder();
        const sigB64 = signatureInfo.signature.replace(/-/g, "+").replace(/_/g, "/");
        const sigBytes = new Uint8Array(Array.from(atob(sigB64), (c) => c.charCodeAt(0)));
        const valid = await crypto.subtle.verify(
          { name: "Ed25519" },
          publicKey,
          sigBytes,
          encoder.encode(code)
        );
        if (!valid) return { valid: false, reason: "Signature verification failed" };
        const settings = await SettingsManager.get();
        const trustedKeys = settings.trustedSigningKeys ?? {};
        const trusted = Object.hasOwn(trustedKeys, signatureInfo.publicKey) ? trustedKeys[signatureInfo.publicKey] : null;
        return {
          valid: true,
          trusted: !!trusted,
          trustedName: trusted?.name ?? null,
          publicKey: signatureInfo.publicKey,
          timestamp: signatureInfo.timestamp
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { valid: false, reason: "Verification error: " + message };
      }
    },
    // ── Trust management ──────────────────────────────────────────────────────
    async trustKey(publicKey, name) {
      if (["__proto__", "constructor", "prototype"].includes(publicKey)) {
        return { error: "Invalid key" };
      }
      const settings = await SettingsManager.get();
      const trustedKeys = settings.trustedSigningKeys ?? {};
      trustedKeys[publicKey] = { name: name || publicKey.slice(0, 12) + "\u2026", addedAt: Date.now() };
      await SettingsManager.set({ trustedSigningKeys: trustedKeys });
      return { success: true };
    },
    async untrustKey(publicKey) {
      const settings = await SettingsManager.get();
      const trustedKeys = settings.trustedSigningKeys ?? {};
      delete trustedKeys[publicKey];
      await SettingsManager.set({ trustedSigningKeys: trustedKeys });
      return { success: true };
    },
    async getTrustedKeys() {
      const settings = await SettingsManager.get();
      return settings.trustedSigningKeys ?? {};
    },
    // ── Metadata embed helpers ────────────────────────────────────────────────
    // Signs a script and embeds the signature in the userscript metadata header.
    // Format: @signature <base64signature>|<base64pubkey>|<timestamp>
    async signAndEmbedInCode(code) {
      const stripped = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, "");
      const sig = await this.signScript(stripped);
      const sigLine = `// @signature ${sig.signature}|${sig.publicKey}|${sig.timestamp}`;
      if (stripped.includes("==/UserScript==")) {
        return stripped.replace(/(\/\/\s*==\/UserScript==)/, sigLine + "\n$1");
      }
      return sigLine + "\n" + stripped;
    },
    extractSignatureFromCode(code) {
      const match = code.match(/\/\/\s*@signature\s+([^\r\n]+)/);
      if (!match) return null;
      const matchedGroup = match[1];
      if (!matchedGroup) return null;
      const parts = matchedGroup.trim().split("|");
      const sig = parts[0];
      const pub = parts[1];
      if (!sig || !pub) return null;
      const tsStr = parts[2];
      return {
        signature: sig,
        publicKey: pub,
        timestamp: tsStr ? parseInt(tsStr, 10) : null
      };
    },
    async verifyCodeSignature(code) {
      const sigInfo = this.extractSignatureFromCode(code);
      if (!sigInfo) return { valid: false, reason: "No signature found in script" };
      const strippedCode = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, "");
      return this.verifyScript(strippedCode, sigInfo);
    }
  };
  return module.exports.default || module.exports.ScriptSigning || module.exports;
})();
