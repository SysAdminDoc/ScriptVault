// ScriptVault - Script Signing (Ed25519 via Web Crypto API)
// Provides cryptographic signing and verification for user scripts.
//
// Architecture:
//   - The extension generates an Ed25519 keypair per-user, stored in chrome.storage.local
//   - Script authors can sign their scripts with their private key
//   - Installing users verify the signature against the author's published public key
//   - Trust anchors: user explicitly trusts specific public keys (stored in settings)
//
// Web Crypto Ed25519 support: Chrome 113+

import type { Settings } from '../types/settings';
import { SettingsManager } from '../modules/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoredKeypair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

interface SignResult {
  signature: string;
  publicKey: string;
  algorithm: 'Ed25519';
  timestamp: number;
}

interface SignatureInfo {
  signature: string;
  publicKey: string;
  timestamp?: number | null;
}

interface VerifyResultInvalid {
  valid: false;
  reason: string;
}

interface VerifyResultValid {
  valid: true;
  trusted: boolean;
  trustedName: string | null;
  publicKey: string;
  timestamp?: number | null;
}

type VerifyResult = VerifyResultInvalid | VerifyResultValid;

interface TrustResult {
  success?: true;
  error?: string;
}

type TrustedKeysMap = Record<string, { name: string; addedAt: number }>;

// ---------------------------------------------------------------------------
// ScriptSigning
// ---------------------------------------------------------------------------

export const ScriptSigning = {
  // ── Key management ───────────────────────────────────────────────────────

  async getOrCreateKeypair(): Promise<StoredKeypair> {
    const stored = await chrome.storage.local.get('signingKeypair');
    if (stored['signingKeypair']) {
      return stored['signingKeypair'] as StoredKeypair;
    }
    return this.generateAndStoreKeypair();
  },

  async generateAndStoreKeypair(): Promise<StoredKeypair> {
    const keypair = await crypto.subtle.generateKey(
      { name: 'Ed25519' } as Algorithm,
      true, // extractable
      ['sign', 'verify']
    ) as CryptoKeyPair;
    const publicKeyJwk: JsonWebKey = await crypto.subtle.exportKey('jwk', keypair.publicKey);
    const privateKeyJwk: JsonWebKey = await crypto.subtle.exportKey('jwk', keypair.privateKey);
    const stored: StoredKeypair = { publicKeyJwk, privateKeyJwk };
    await chrome.storage.local.set({ signingKeypair: stored });
    return stored;
  },

  async getPublicKeyJwk(): Promise<JsonWebKey> {
    const kp: StoredKeypair = await this.getOrCreateKeypair();
    return kp.publicKeyJwk;
  },

  // ── Signing ──────────────────────────────────────────────────────────────

  async signScript(code: string): Promise<SignResult> {
    const kp: StoredKeypair = await this.getOrCreateKeypair();
    const privateKey: CryptoKey = await crypto.subtle.importKey(
      'jwk', kp.privateKeyJwk,
      { name: 'Ed25519' } as Algorithm,
      false, ['sign']
    );
    const encoder = new TextEncoder();
    const signatureBuffer: ArrayBuffer = await crypto.subtle.sign(
      { name: 'Ed25519' } as Algorithm,
      privateKey,
      encoder.encode(code)
    );
    // Convert to base64url to match JWK's x field encoding
    const signatureB64: string = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const publicKeyB64: string = kp.publicKeyJwk.x ?? ''; // JWK x field is base64url-encoded
    return {
      signature: signatureB64,
      publicKey: publicKeyB64,
      algorithm: 'Ed25519',
      timestamp: Date.now()
    };
  },

  // ── Verification ──────────────────────────────────────────────────────────

  async verifyScript(code: string, signatureInfo: SignatureInfo): Promise<VerifyResult> {
    if (!signatureInfo.signature || !signatureInfo.publicKey) {
      return { valid: false, reason: 'Missing signature or public key' };
    }

    try {
      // Reconstruct the public key JWK from the x coordinate
      const publicKeyJwk: JsonWebKey = {
        kty: 'OKP',
        crv: 'Ed25519',
        x: signatureInfo.publicKey,
        key_ops: ['verify']
      };

      const publicKey: CryptoKey = await crypto.subtle.importKey(
        'jwk', publicKeyJwk,
        { name: 'Ed25519' } as Algorithm,
        false, ['verify']
      );

      const encoder = new TextEncoder();
      // Convert base64url back to standard base64 for atob()
      const sigB64: string = signatureInfo.signature.replace(/-/g, '+').replace(/_/g, '/');
      const sigBytes = new Uint8Array(Array.from(atob(sigB64), (c: string) => c.charCodeAt(0)));

      const valid: boolean = await crypto.subtle.verify(
        { name: 'Ed25519' } as Algorithm,
        publicKey,
        sigBytes,
        encoder.encode(code)
      );

      if (!valid) return { valid: false, reason: 'Signature verification failed' };

      // Check if this public key is in the trust store. Use Object.hasOwn so a
      // malicious signature whose publicKey field collides with an inherited
      // Object.prototype method (toString, hasOwnProperty, etc.) can't resolve
      // passively and be reported as `trusted: true`.
      const settings: Settings = await SettingsManager.get();
      const trustedKeys: TrustedKeysMap = settings.trustedSigningKeys ?? {};
      const trusted = Object.hasOwn(trustedKeys, signatureInfo.publicKey)
        ? trustedKeys[signatureInfo.publicKey]
        : undefined;

      return {
        valid: true,
        trusted: !!trusted,
        trustedName: trusted?.name ?? null,
        publicKey: signatureInfo.publicKey,
        timestamp: signatureInfo.timestamp
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { valid: false, reason: 'Verification error: ' + message };
    }
  },

  // ── Trust management ──────────────────────────────────────────────────────

  async trustKey(publicKey: string, name: string): Promise<TrustResult> {
    if (['__proto__', 'constructor', 'prototype'].includes(publicKey)) {
      return { error: 'Invalid key' };
    }
    const settings: Settings = await SettingsManager.get();
    const trustedKeys: TrustedKeysMap = settings.trustedSigningKeys ?? {};
    trustedKeys[publicKey] = { name: name || publicKey.slice(0, 12) + '\u2026', addedAt: Date.now() };
    await SettingsManager.set({ trustedSigningKeys: trustedKeys });
    return { success: true };
  },

  async untrustKey(publicKey: string): Promise<TrustResult> {
    const settings: Settings = await SettingsManager.get();
    const trustedKeys: TrustedKeysMap = settings.trustedSigningKeys ?? {};
    delete trustedKeys[publicKey];
    await SettingsManager.set({ trustedSigningKeys: trustedKeys });
    return { success: true };
  },

  async getTrustedKeys(): Promise<TrustedKeysMap> {
    const settings: Settings = await SettingsManager.get();
    return settings.trustedSigningKeys ?? {};
  },

  // ── Metadata embed helpers ────────────────────────────────────────────────
  // Signs a script and embeds the signature in the userscript metadata header.
  // Format: @signature <base64signature>|<base64pubkey>|<timestamp>

  async signAndEmbedInCode(code: string): Promise<string> {
    // Strip any existing signature tag (CRLF-safe, optional trailing newline)
    const stripped: string = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, '');
    const sig: SignResult = await this.signScript(stripped);
    const sigLine = `// @signature ${sig.signature}|${sig.publicKey}|${sig.timestamp}`;

    // Insert just before ==/UserScript== (tolerate whitespace variants)
    if (stripped.includes('==/UserScript==')) {
      return stripped.replace(/(\/\/\s*==\/UserScript==)/, sigLine + '\n$1');
    }
    return sigLine + '\n' + stripped;
  },

  extractSignatureFromCode(code: string): SignatureInfo | null {
    const match: RegExpMatchArray | null = code.match(/\/\/\s*@signature\s+([^\r\n]+)/);
    if (!match) return null;
    const matchedGroup: string | undefined = match[1];
    if (!matchedGroup) return null;
    const parts: string[] = matchedGroup.trim().split('|');
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

  async verifyCodeSignature(code: string): Promise<VerifyResult> {
    const sigInfo: SignatureInfo | null = this.extractSignatureFromCode(code);
    if (!sigInfo) return { valid: false, reason: 'No signature found in script' };
    // Strip the signature line before verifying (we signed the code without it) — CRLF-safe
    const strippedCode: string = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, '');
    return this.verifyScript(strippedCode, sigInfo);
  }
};
