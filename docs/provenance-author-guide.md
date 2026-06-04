# `@require-provenance` Author Guide

This guide is for userscript authors who publish reusable `@require`
libraries and want ScriptVault to verify those libraries before update review.

ScriptVault currently verifies Sigstore v0.3 `messageSignature` bundles for
`@require` dependencies. DSSE bundles, Rekor inclusion proof verification, and
RFC3161 timestamp validation are tracked as later defense-in-depth work.

## What to publish

Publish two files side by side:

- The JavaScript dependency, for example `mylib.user.js`.
- A Sigstore bundle for the exact bytes of that dependency, for example
  `mylib.user.js.bundle`.

The dependency URL and bundle URL must be stable HTTPS URLs. If the dependency
bytes change, create and publish a new bundle for those bytes.

## Sign a dependency

Install Cosign from Sigstore's official installation instructions, then sign
the dependency as a blob:

```bash
cosign sign-blob --bundle mylib.user.js.bundle mylib.user.js
```

For non-interactive CI jobs:

```bash
cosign sign-blob --yes --bundle dist/mylib.user.js.bundle dist/mylib.user.js
```

Cosign keyless signing binds the signature to an OIDC identity and writes the
signature, certificate, and transparency-log material into the bundle. Keep the
bundle with the exact dependency file it signed.

## Declare provenance in the userscript

Add one `@require-provenance` and one `@require-identity` for each protected
`@require`, in the same order as the `@require` lines.

```javascript
// ==UserScript==
// @name              Example Script
// @require           https://cdn.example.com/mylib.user.js
// @require-provenance https://cdn.example.com/mylib.user.js.bundle
// @require-identity  https://github.com/example/repo/.github/workflows/release.yml@refs/heads/main (issuer: https://token.actions.githubusercontent.com)
// ==/UserScript==
```

For GitHub Actions keyless signing, the identity is usually the workflow
identity shown in the Fulcio certificate, and the issuer is
`https://token.actions.githubusercontent.com`.

## How ScriptVault evaluates it

For each declared dependency, ScriptVault:

1. Fetches the `@require` body.
2. Fetches the Sigstore bundle.
3. Checks the bundle digest against the `@require` bytes.
4. Verifies the message signature against the leaf certificate key.
5. Matches the certificate identity and issuer to `@require-identity`.
6. Chains the certificate to the bundled Fulcio v1 root and checks the
   certificate validity window at verification time.

Successful receipts show `signature-verified` with `rootVerified: verified`.
Failed receipts are review-required and show the concrete status, such as
`signature-failed`, `root-verification-failed`, `bundle-unavailable`, or
`unsupported-bundle`.

## Common failure modes

- `bundle-unavailable`: the bundle URL did not fetch cleanly, redirected to a
  blocked host, was empty, or exceeded ScriptVault's bundle size limit.
- `signature-failed`: the bundle does not match the current dependency bytes,
  or the certificate identity/issuer does not match `@require-identity`.
- `root-verification-failed`: the certificate chain does not terminate at
  ScriptVault's bundled Fulcio v1 root, or the certificate is outside its
  validity window.
- `unsupported-bundle`: the bundle is valid Sigstore JSON but not a
  `messageSignature` bundle that this verification phase supports.

## Rotation checklist

- Publish the new dependency bytes.
- Sign the new dependency bytes and publish the new bundle.
- Keep the expected OIDC identity stable when possible.
- If your signing workflow path, branch, or OIDC issuer changes, update
  `@require-identity` in the consumer userscript.
- Do not reuse a bundle for different dependency bytes.

## References

- Sigstore signing blobs: https://docs.sigstore.dev/cosign/signing/signing_with_blobs/
- Sigstore bundle format: https://docs.sigstore.dev/about/bundle/
- Fulcio OIDC identities: https://docs.sigstore.dev/certificate_authority/oidc-in-fulcio/
- Fulcio trust root: https://github.com/sigstore/root-signing
