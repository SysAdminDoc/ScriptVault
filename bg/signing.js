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

const ScriptSigning = {
  // ── Key management ───────────────────────────────────────────────────────

  async getOrCreateKeypair() {
    const stored = await chrome.storage.local.get('signingKeypair');
    if (stored.signingKeypair) {
      return stored.signingKeypair; // { publicKeyJwk, privateKeyJwk }
    }
    return this.generateAndStoreKeypair();
  },

  async generateAndStoreKeypair() {
    const keypair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true, // extractable
      ['sign', 'verify']
    );
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
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
      'jwk', kp.privateKeyJwk,
      { name: 'Ed25519' },
      false, ['sign']
    );
    const encoder = new TextEncoder();
    const signatureBuffer = await crypto.subtle.sign(
      { name: 'Ed25519' },
      privateKey,
      encoder.encode(code)
    );
    // Convert to base64url to match JWK's x field encoding
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const publicKeyB64 = kp.publicKeyJwk.x; // JWK x field is base64url-encoded
    return {
      signature: signatureB64,
      publicKey: publicKeyB64,
      algorithm: 'Ed25519',
      timestamp: Date.now()
    };
  },

  // ── Verification ──────────────────────────────────────────────────────────

  async verifyScript(code, signatureInfo) {
    if (!signatureInfo?.signature || !signatureInfo?.publicKey) {
      return { valid: false, reason: 'Missing signature or public key' };
    }

    try {
      // Reconstruct the public key JWK from the x coordinate
      const publicKeyJwk = {
        kty: 'OKP',
        crv: 'Ed25519',
        x: signatureInfo.publicKey,
        key_ops: ['verify']
      };

      const publicKey = await crypto.subtle.importKey(
        'jwk', publicKeyJwk,
        { name: 'Ed25519' },
        false, ['verify']
      );

      const encoder = new TextEncoder();
      // Convert base64url back to standard base64 for atob()
      const sigB64 = signatureInfo.signature.replace(/-/g, '+').replace(/_/g, '/');
      const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));

      const valid = await crypto.subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        sigBytes,
        encoder.encode(code)
      );

      if (!valid) return { valid: false, reason: 'Signature verification failed' };

      // Check if this public key is in the trust store
      const settings = await SettingsManager.get();
      const trustedKeys = settings.trustedSigningKeys || {};
      const trusted = trustedKeys[signatureInfo.publicKey];

      return {
        valid: true,
        trusted: !!trusted,
        trustedName: trusted?.name || null,
        publicKey: signatureInfo.publicKey,
        timestamp: signatureInfo.timestamp
      };
    } catch (e) {
      return { valid: false, reason: 'Verification error: ' + e.message };
    }
  },

  // ── Trust management ──────────────────────────────────────────────────────

  async trustKey(publicKey, name) {
    if (['__proto__', 'constructor', 'prototype'].includes(publicKey)) {
      return { error: 'Invalid key' };
    }
    const settings = await SettingsManager.get();
    const trustedKeys = settings.trustedSigningKeys || {};
    trustedKeys[publicKey] = { name: name || publicKey.slice(0, 12) + '…', addedAt: Date.now() };
    await SettingsManager.set({ trustedSigningKeys: trustedKeys });
    return { success: true };
  },

  async untrustKey(publicKey) {
    const settings = await SettingsManager.get();
    const trustedKeys = settings.trustedSigningKeys || {};
    delete trustedKeys[publicKey];
    await SettingsManager.set({ trustedSigningKeys: trustedKeys });
    return { success: true };
  },

  async getTrustedKeys() {
    const settings = await SettingsManager.get();
    return settings.trustedSigningKeys || {};
  },

  // ── Metadata embed helpers ────────────────────────────────────────────────
  // Signs a script and embeds the signature in the userscript metadata header.
  // Format: @signature <base64signature>|<base64pubkey>|<timestamp>

  async signAndEmbedInCode(code) {
    // Strip any existing signature tag
    const stripped = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, '');
    const sig = await this.signScript(stripped);
    const sigLine = `// @signature ${sig.signature}|${sig.publicKey}|${sig.timestamp}`;

    // Insert just before ==/UserScript==
    if (stripped.includes('==/UserScript==')) {
      return stripped.replace(/(\/\/\s*==\/UserScript==)/, sigLine + '\n$1');
    }
    return sigLine + '\n' + stripped;
  },

  extractSignatureFromCode(code) {
    const match = code.match(/\/\/\s*@signature\s+([^\r\n]+)/);
    if (!match) return null;
    const parts = match[1].trim().split('|');
    if (parts.length < 2) return null;
    return {
      signature: parts[0],
      publicKey: parts[1],
      timestamp: parts[2] ? parseInt(parts[2], 10) : null
    };
  },

  async verifyCodeSignature(code) {
    const sigInfo = this.extractSignatureFromCode(code);
    if (!sigInfo) return { valid: false, reason: 'No signature found in script' };
    // Strip the signature line before verifying (we signed the code without it)
    const strippedCode = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, '');
    return this.verifyScript(strippedCode, sigInfo);
  }
};
