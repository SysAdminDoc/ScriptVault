# `@require-provenance` Design — Sigstore-Style Verification for `@require`

**Phase:** 39.5 (extends Phase 11.8 SRI).
**Status:** Phase A parser + storage foundation, Phase B bundle parser, Phase C message-signature verifier, Phase D Fulcio root/validity checks, and dashboard/update review surfacing shipped 2026-06-04; install dialog verified-author badge and author guide remain open. RFC3161/Rekor timestamp proof remains Phase 2 defense-in-depth.
**Owner:** Phase 17 (Security Round 2) follow-up.
**Last reviewed:** 2026-05-17.

---

## Problem

Userscript `@require` directives fetch arbitrary remote code at install time. Today's mitigations:

- **SRI hash** (Phase 11.8) — `@require url#sha256=...` enforces a known-good byte hash. Solves "did the CDN serve the bytes I expect?" but requires the script author to inline the hash, and offers no rotation story (every bump requires re-publishing the script with a new hash).
- **Origin allowlist** — none today. Any HTTPS host can be a `@require` source.

What this design adds: a *publisher signature* over the `@require` artifact, verifiable against a known author key. The signature is fetched alongside the artifact and verified before injection. The threat it closes:

- Attacker compromises a CDN account (npm worm, Cyberhaven OAuth pattern). The CDN now serves attacker-modified bytes under the same URL.
- SRI alone catches this only if the `@require` URL was author-stamped with a hash. Most scripts don't.
- `@require-provenance` adds an author signature that is **independent of the URL or its hash**. The CDN can swap bytes; the signature won't verify against the publisher key, and ScriptVault rejects the load.

## Prior art

- [Sigstore](https://docs.sigstore.dev/) — keyless code signing using OIDC + Fulcio + Rekor (transparency log).
- [npm provenance GA (April 2025)](https://blog.sigstore.dev/npm-provenance-ga/) — npm packages now ship a `provenance` field linking the build to its source repo + CI workflow via a Sigstore bundle.
- [SLSA framework](https://slsa.dev/) — supply-chain integrity levels; npm provenance achieves SLSA build L3.
- [Cosign](https://docs.sigstore.dev/cosign/signing/overview/) — CLI for signing artifacts with detached bundles.

## Design

### Author workflow

The script author signs their `@require` artifact with Cosign:

```bash
# Author has their identity verified by an OIDC provider (GitHub/Google) — Cosign
# requests a short-lived signing certificate from Fulcio bound to that identity.
cosign sign-blob \
  --output-signature mylib.user.js.sig \
  --output-certificate mylib.user.js.crt \
  --bundle mylib.user.js.bundle \
  mylib.user.js
```

The author uploads `mylib.user.js` and `mylib.user.js.bundle` to their CDN side-by-side.

### Script-author declaration

The consumer script declares the dependency:

```javascript
// ==UserScript==
// @require           https://cdn.example.com/mylib.user.js
// @require-provenance https://cdn.example.com/mylib.user.js.bundle
// @require-identity  https://github.com/exampleuser (issuer: https://github.com/login/oauth)
// ==/UserScript==
```

- `@require-provenance <url>` — URL to a Sigstore bundle (`.bundle` is the canonical format; contains the artifact signature, the signing certificate, and a Rekor transparency-log inclusion proof).
- `@require-identity <subject> (issuer: <oidc-issuer>)` — the OIDC identity the script author expects to have signed the `@require`. Without this, an attacker could publish a valid Sigstore-signed bundle under a different identity and pass verification.

### Verification at install / update time

1. Fetch the `@require` body bytes as today.
2. Fetch the `@require-provenance` bundle from the declared URL.
3. Parse the bundle: extract the signing certificate, signature, and Rekor inclusion proof.
4. Verify the certificate chains to a trusted Fulcio root (bundled with ScriptVault — short-lived certs are tied to a small known root set).
5. Verify the signature over the `@require` body bytes.
6. Verify the certificate's `subject` and `issuer` match the `@require-identity` declaration.
7. Optionally (Phase 2): verify the Rekor inclusion proof against the public transparency log (requires online check; gracefully skip when offline if the cert hash is on the local Rekor cache).

If any step fails, refuse to install/update and surface a clear error:

```
Provenance mismatch: @require body does not match signed artifact.
Expected author: https://github.com/exampleuser
Got author:      https://github.com/attacker
```

### Caching

- Bundles are cached in IndexedDB alongside the `@require` body (Phase 18.2 OPFS-backed for large libraries).
- Cache key: `(require-url, bundle-url)`. Force-refresh of the script invalidates both entries (Phase 39.25 cache invalidation).
- The Fulcio root + Rekor public key are bundled with ScriptVault, not fetched dynamically (avoids a key-rotation attack).

### Failure modes & opt-out

- **No `@require-provenance` line:** verification is skipped entirely. Existing scripts continue to work. Provenance is opt-in.
- **Provenance bundle unreachable:** install fails with `Provenance bundle unreachable: <url>`. The user can dismiss the script. No fallback to "skip verification" — that defeats the purpose.
- **Bundle present but signature invalid:** install fails. No override. Author must fix the bundle.
- **Bundle present but Rekor inclusion proof fails:** install proceeds with a warning. Rekor's transparency layer is a defense-in-depth check; the primary signature is the gate.

## Implementation phases

### Phase A — Parser + storage (no verification yet) — shipped 2026-06-04

- Extend `parseUserscript` to collect `@require-provenance` and `@require-identity` arrays.
- Store alongside the existing `meta.require[]` array.
- No runtime behavior change; verification remains a no-op.
- **Tests:** 10 parser cases covering valid, malformed, missing identity, comma-separated lists.
- **Shipped:** The main parser, background-core bridge parser, and public API install parser persist ordered `requireProvenance[]` / `requireIdentity[]` metadata. Trust receipts record declaration-only dependency provenance blocks with `verification: not-yet-implemented`.

### Phase B — Bundle fetcher + parser — shipped 2026-06-04

- Add `src/modules/sigstore-bundle-parser.ts` and generated `modules/sigstore-bundle-parser.js` — strict parser for the `.bundle` JSON format (Sigstore Protobuf bundle profile, draft v0.3).
- No external deps; pure parser.
- **Tests:** parse synthetic v0.3 message-signature and DSSE bundles, reject unsupported media types, malformed base64 payloads, ambiguous key material, and multi-signature DSSE bundles, and load the generated runtime export.
- **Shipped:** Parser normalizes Sigstore v0.3 JSON bundles with certificate, x509 chain, or public-key-identifier verification material plus message-signature or DSSE content. It extracts transparency-log entries and RFC3161 timestamps; message-signature cryptographic verification lives in Phase C.

### Phase C — Signature verification — shipped 2026-06-04

- Add `src/modules/sigstore-bundle-verifier.ts` and generated `modules/sigstore-bundle-verifier.js`.
- Compute the SHA-256 digest of the `@require` body, validate the bundle `messageDigest`, extract the leaf certificate's P-256 `SubjectPublicKeyInfo`, and verify DER/raw ECDSA signatures against the artifact digest.
- Match the certificate URI/e-mail SAN and Fulcio OIDC issuer extension against the `@require-identity` declaration.
- Wire `fetchProvenanceBundle()` through update, pending-update, and subscription-install trust receipts. Receipts record `signature-verified`, `signature-failed`, `bundle-unavailable`, or `unsupported-bundle`; Phase D adds Fulcio root verification.
- **No new deps:** uses Web Crypto for SHA-256 and a local P-256 ECDSA verifier because Sigstore message signatures are over the artifact digest.
- **Tests:** golden-path verification, tampered body, mismatched identity, mismatched issuer, first-certificate chain handling, DSSE unsupported status, generated runtime export, and receipt bundle-unavailable wiring.

### Phase D — Fulcio root verification — shipped 2026-06-04

- Bundle the [Fulcio v1 root certificate](https://github.com/sigstore/root-signing) in `src/modules/sigstore-bundle-verifier.ts`, with injectable trusted roots for tests and future rotation.
- Verify leaf/intermediate certificate signatures up to the trusted root using local P-256/P-384 ECDSA and the certificate signature algorithm hash.
- Verify leaf, intermediate, and root `notBefore`/`notAfter` at verifier time.
- Receipts now carry `rootVerified: verified|failed` plus `root-verification-failed` when the chain or validity window is rejected.
- **Tests:** trusted-root success, untrusted-root failure, expired-leaf failure, and generated runtime coverage.
- **Deferred:** RFC3161 signed timestamp parsing/verification and Rekor inclusion proof remain Phase E defense-in-depth work.

### Phase E — Rekor inclusion proof (defense-in-depth, Phase 2)

- Verify the inclusion proof against the Rekor public key.
- Optional online check: if the device is online and the Rekor entry's `logIndex` is fresh, query Rekor for tamper-detection.
- Gracefully skip when offline.

### Phase F — UI surface

- Install dialog displays a verified-author badge for provenance-verified `@require` URLs. *(Open.)*
- Script details panel shows per-`@require` provenance status. *(Dashboard receipt view shipped 2026-06-04.)*
- Pending-update review marks provenance failures as review-required and the recent-update review modal shows per-`@require` provenance rows. *(Shipped 2026-06-04.)*
- Errors surface in the existing error log (Phase 20.4). *(Open.)*

## Open questions

1. **Identity binding for solo authors:** OIDC identities like `https://github.com/exampleuser` are stable. What about authors who later change usernames or want to retire a key? Cosign supports keyless signing; revocation is a Rekor-based "tombstone" entry. Not yet a stable Sigstore primitive; defer until Sigstore documents the rotation story.
2. **Caching the Fulcio root:** bundling locks the root version. Rotation is rare (Fulcio v1 has been stable since 2022) but a build-bump is required when it happens. Acceptable for now.
3. **Performance:** verification adds ~50-100ms to install per `@require`. For scripts with 5+ requires this is noticeable. Run verifications in parallel via `Promise.all`.
4. **Bundle size:** Sigstore bundle is typically ~3KB. Negligible for transfer; storage cost is bounded.

## Alternatives considered

- **Plain PGP signatures:** rejected — key management UX is brutal for casual script authors.
- **GitHub commit signatures:** only works if `@require` is hosted on GitHub raw URLs; doesn't cover CDN-hosted artifacts.
- **Per-extension TUF metadata:** overkill for the script-author distribution model.
- **TLS pinning to author domain:** doesn't survive author domain changes.
- **Rely on SRI only:** doesn't survive author legitimate version bumps without re-publishing every consumer script.

Sigstore wins on three axes: (1) keyless flow that authors won't ditch after one use, (2) Rekor transparency log makes silent compromise detectable, (3) tooling is mature and free.

## Acceptance criteria for shipping

- Parser handles `@require-provenance` + `@require-identity` with full test coverage.
- Bundle parser correctly extracts cert + signature + Rekor entry.
- Web Crypto verification succeeds against 5+ known-good test bundles (one per popular Sigstore-signed npm package, repurposed as fixtures).
- Tampered body fails verification.
- Identity mismatch fails verification.
- Install dialog shows the verified-author badge.
- Error path surfaces a clear, actionable message.
- Documentation page at `docs/provenance-author-guide.md` explains how authors sign their artifacts.

## Source citations

- [Sigstore docs](https://docs.sigstore.dev/)
- [npm provenance GA blog](https://blog.sigstore.dev/npm-provenance-ga/)
- [SLSA framework](https://slsa.dev/)
- [Cosign signing overview](https://docs.sigstore.dev/cosign/signing/overview/)
- [Fulcio root-signing repo](https://github.com/sigstore/root-signing)
- [Sigstore Protobuf bundle profile](https://github.com/sigstore/protobuf-specs)
- ROADMAP.md Phase 11.8 (existing SRI baseline)
- ROADMAP.md Phase 17.x (Security Round 2 context)
- ROADMAP.md Round 12 source 265 (Sigstore npm provenance GA)
