# Release Runbook

**Audience:** ScriptVault publishers and release engineers.
**Owners:** Phase 39.1 (custody), 39.2 (CWS API v2), 39.4 (locale audit), 39.49 (backlog buffer).
**Last reviewed:** 2026-05-24.

This runbook codifies the current ScriptVault release path: build and test locally/CI, publish GitHub artifacts, then use the Chrome Web Store API v2 tooling in `publish.sh` for Chrome submission. It also records the target security-custody model for replacing local long-lived OAuth credentials with short-lived GitHub Actions OIDC -> GCP credentials in a later hardening pass.

---

## 1. Pre-release gate

Before any release branch is created:

1. **Tests green:** `npm run check` passes on `main`. CI must be green for the last commit.
2. **Smoke test green:** `npm run smoke:dashboard` passes locally on Linux + Windows.
3. **Dependency audit green:** `npm audit --audit-level=high --omit=optional` exits 0. High and critical advisories are blocking unless the release notes document a temporary false-positive exception.
4. **CWS tooling green:** `npm run cws:check` confirms the installed `chrome-webstore-upload-cli` major, Node engine, removed flag usage, and credential names.
5. **Locale lint green:** `tests/manifest-locales.test.js` passes - no locale's `extName` exceeds 75 chars, no `extDescription` exceeds 132 chars, all locales share the `en` key set.
6. **Version sources synced:** `manifest.json`, `manifest-firefox.json`, `package.json`, and `package-lock.json` all point to the same target version.
7. **Rollback drill green:** `npm run release:rollback-drill` proves the previous public `chrome.storage.local` snapshot survives the current storage migration safety window.
8. **Firefox AMO gate green:** `npm run firefox:package` exits with `web-ext lint: 0 errors, 0 notices` and writes `firefox-artifacts/scriptvault-firefox-vX.Y.Z.zip`, `firefox-artifacts/scriptvault-firefox-source-vX.Y.Z.zip`, and `firefox-artifacts/web-ext-lint.json`.
9. **Release artifact parity green:** `npm run release:check` passes locally; after the tag and GitHub Release are created, `npm run release:check:public` must pass.
10. **CHANGELOG entry drafted:** one paragraph per shipped roadmap item, with `Phase X.Y` cross-references.

If any gate fails, stop. Do not patch the test to make it green.

## 2. Custody model (Phase 39.1)

**Threat reference:**
- [Shai-Hulud 2.0 (Microsoft Security Blog, Dec 9 2025)](https://www.microsoft.com/en-us/security/blog/2025/12/09/shai-hulud-2-0-guidance-for-detecting-investigating-and-defending-against-the-supply-chain-attack/) - npm worm pattern that drove Trust Wallet's ~$8.5M loss via stolen CWS API key.
- [Cyberhaven OAuth phishing (Sekoia, Dec 2024)](https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/) - 36 extensions / 2.6M users compromised.

**Current state:** `publish.sh` is a local/manual release step. It reads `.env` from the maintainer machine and uses `chrome-webstore-upload-cli@^4.0.0` against the Chrome Web Store API v2. No checked-in GitHub Actions workflow currently publishes to CWS.

**Target custody requirements:**

| Asset | Current storage | Target storage | Rotation cadence |
|---|---|---|---|
| CWS publisher Google account | Publisher account with MFA | Hardware-key MFA only (TitanKey / YubiKey 5C series) | n/a - second factor is hardware |
| CWS API client_id / client_secret | Local `.env` only; never committed | GCP Secret Manager, accessible only via OIDC from `SysAdminDoc/ScriptVault` `main` branch and release workflow | rotate every 90 days |
| CWS refresh token | Local `.env` only; never committed | Replace with short-lived service-account/OIDC publish flow where possible | every publish run once OIDC lands |
| GitHub Actions OIDC trust policy | Not implemented | Scoped to `repo:SysAdminDoc/ScriptVault`, `ref:refs/heads/main`, and the release workflow path | audit annually |
| CRX signing private key (`.pem`) | local dev machine + hardware-backed encrypted backup | same, until signed-artifact pipeline lands | rotate only on compromise |
| Codeberg mirror SSH deploy key | not provisioned | GitHub Secret, read+push to mirror only | rotate annually |

**Explicitly forbidden:**
- Committing `.env`, OAuth client secrets, refresh tokens, service-account keys, or CRX private keys.
- Adding long-lived CWS API keys to GitHub Actions secrets for an automated publisher.
- Using `--client-id`, `--client-secret`, or `--refresh-token` flags with `chrome-webstore-upload-cli` v4.
- Signing or publishing a release from any machine without disk encryption and OS firewall enabled.

## 3. CWS API v2 tooling (Phase 39.2)

**Hard deadline:** 2026-10-15. The Chrome Web Store v1 publishing API sunsets on that date.

Verified current implementation:

1. `package.json` pins `chrome-webstore-upload-cli@^4.0.0`; the installed package reports `engines.node >=20`.
2. `.github/workflows/ci.yml` runs Node 20, matching the CLI engine.
3. `publish.sh` loads `EXTENSION_ID`, `PUBLISHER_ID`, `CLIENT_ID`, `CLIENT_SECRET`, and `REFRESH_TOKEN` from `.env`.
4. `publish.sh --draft` builds and uploads the ZIP with `chrome-webstore-upload upload --source ...`, then keeps the ZIP on disk for reviewer/manual fallback.
5. `publish.sh` builds, uploads, and then runs `chrome-webstore-upload publish`.
6. Removed v3/v1-era flags are not allowed: `--client-id`, `--client-secret`, `--refresh-token`, and `--auto-publish`.

Credential-free validation:

```bash
npm run cws:check
```

Credentialed upload-only validation, for maintainers with `.env`:

```bash
bash publish.sh --draft
```

The CLI has no standalone status subcommand; for post-upload status checks use the CWS Developer Dashboard until a future direct API status probe is added. Chrome's API v2 supports `publishers/PUBLISHER_ID/items/EXTENSION_ID:fetchStatus`, pending a token-management wrapper.

References: [chrome-webstore-upload-cli v4.0.0 release](https://github.com/fregante/chrome-webstore-upload-cli/releases/tag/v4.0.0), [CWS API v2 announcement](https://developer.chrome.com/blog/cws-api-v2).

## 4. Release sequence

1. **Cut release branch** off `main`: `git checkout -b release/vX.Y.Z`.
2. **Bump versions** in `manifest.json`, `manifest-firefox.json`, `package.json`, `package-lock.json`. Use semver - patch for fixes, minor for additive features, major only for breaking changes.
3. **Finalize CHANGELOG.md** entry for vX.Y.Z. Match the prose style of recent entries.
4. **Validate:** `npm run check`, `npm run smoke:dashboard`, `npm audit --audit-level=high --omit=optional`, `npm run cws:check`, `npm run firefox:package`, `npm run release:rollback-drill`, and `npm run release:check`.
5. **Build:** `npm run build:prod` then `bash build.sh`. Verify the produced ZIP loads in a clean Chrome profile. For Firefox validation, inspect the Firefox package/source ZIP under `firefox-artifacts/`.
6. **Release trust gate:** `npm run release:trust`. For a public release with the maintainer signing key available, run `npm run release:trust:strict` with `RELEASE_SIGNING_PRIVATE_KEY_PATH` or `RELEASE_SIGNING_PRIVATE_KEY_PEM`.
7. **Tag:** `git tag -a vX.Y.Z -m "Release vX.Y.Z - <one-line summary>"`.
8. **Push commit and tag to GitHub.**
9. **Verify local artifact parity:** rerun `npm run release:check`; the missing-tag warning must be gone.
10. **Create or update GitHub Release:** attach `ScriptVault-vX.Y.Z.zip`, `firefox-artifacts/*`, `release-artifacts/*`, and the GitHub Actions attestation links; mark it as latest for normal production releases.
11. **Verify public artifact parity:** `npm run release:check:public`.
12. **CWS draft upload:** `bash publish.sh --draft`; review the draft in the CWS Developer Dashboard.
13. **CWS publish:** `bash publish.sh` when ready to submit/publish through CWS review.
14. **Verify CWS listing:** open the public listing after approval; confirm version, screenshots, and store description rendered.

## 5. CWS review backlog buffer (Phase 39.49)

Since April 2026, CWS review times have been running 7-14 days. Plan around it:

- **Routine releases:** assume 7-day median review. Mark target user-facing release date in the PR description, not the tag-push date.
- **CVE responses or security patches:** use the [CWS appeals/expedited-review flow](https://developer.chrome.com/blog/cws-new-appeals-process) - file an appeal with a brief security justification. Document the request in `docs/security-incident-log.md` (to be created on first use).
- **Feature freezes:** maintain a 14-day freeze between feature-freeze and target user-facing date to absorb worst-case review queues.

## 6. Post-release verification

Within 24 hours of CWS listing update:

1. Install the live extension on a clean profile from CWS and confirm:
   - Dashboard loads.
   - Existing scripts migrate cleanly from the previous version (if migration code was added in this release).
   - No console errors on service worker boot.
2. Check the `chrome.runtime.onInstalled` handler fires with `reason: 'update'` and `previousVersion` populated.
3. Run `npm run release:check:public` against the published tag.
4. Update [ROADMAP.md](../ROADMAP.md): mark shipped phase items with `Status: Shipped in vX.Y.Z`.
5. Close any GitHub issues that this release resolves; cross-link the tag.

## 7. Storage rollback drill

Run this before every release and after any storage or migration change:

```bash
npm run release:rollback-drill
```

The drill seeds the previous public baseline storage shape (`userscripts`, `values_*`, settings, and folders), upgrades through the current v3 migration path, verifies current IndexedDB reads, verifies a simulated rollback reader can still recover the legacy snapshot, and verifies the 30-day legacy-key wipe only runs after the safety window.

This command is credential-free and runs in CI. A failure means do not publish: a browser/platform rollback may leave users on an older extension version that cannot read their current data.

## 8. Release trust gate

Run this after `bash build.sh` creates `ScriptVault-vX.Y.Z.zip`:

```bash
npm run release:trust
```

The gate writes ignored files under `release-artifacts/`:

- `ScriptVault-vX.Y.Z.sha256` for the package, source ZIP, SBOM, provenance, and package-diff files.
- `ScriptVault-source-vX.Y.Z.zip` from `git archive HEAD`.
- `ScriptVault-vX.Y.Z.sbom.cyclonedx.json` generated from `package-lock.json`.
- `ScriptVault-vX.Y.Z.provenance.json` with SLSA-shaped local/CI build metadata.
- `ScriptVault-vX.Y.Z.package-diff.json` with packaged entries, manifest permissions, web-accessible resources, and forbidden-entry checks.
- `ScriptVault-vX.Y.Z.signing.json` plus `ScriptVault-vX.Y.Z.sha256.sig` when a release signing key is provided.

CI runs the non-strict gate for every build after packaging. On `main` pushes, `.github/workflows/ci.yml` also uses GitHub artifact attestations for the Chrome ZIP and the CycloneDX SBOM. For public releases, attach the `release-artifacts/*` files to GitHub Releases and use strict local signing when the maintainer key is available:

```bash
RELEASE_SIGNING_PRIVATE_KEY_PATH=scriptvault-release-ed25519.pem npm run release:trust:strict
```

References: [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [CycloneDX 1.6 JSON](https://cyclonedx.org/docs/1.6/json/), [SLSA provenance v1](https://slsa.dev/spec/v1.0/provenance).

## 9. Rollback procedure

If a critical regression surfaces post-release:

1. **Do not delete the CWS listing.** CWS retains version history; users can downgrade only by uninstalling + reinstalling the previous CRX.
2. **Publish a hotfix release** with a strictly higher version (e.g., 3.10.1 -> 3.10.2) that reverts the problematic change. Skip the normal review queue via the expedited-review appeals flow with cause = "regression".
3. **Communicate** via the Codeberg mirror's README (mirrors to GitHub) and any active community channels.
4. **Do not push a `-revert` tag.** Always roll forward.

## 10. Open items (post-runbook)

- [ ] GCP Secret Manager -> GitHub Actions OIDC bridge: implementation pending Phase 39.1. Current CWS publishing is local/manual.
- [ ] Direct CWS API v2 status probe: wrap `publishers/PUBLISHER_ID/items/EXTENSION_ID:fetchStatus` once token custody is settled.
- [ ] Codeberg mirror workflow: Phase 39.48; pending Codeberg account provision + deploy key.
- [ ] Hardware-key MFA migration: requires acquiring a second YubiKey for the publisher account.
- [ ] Durable public release signing key custody: `release:trust:strict` is wired, but the maintainer-owned Ed25519 key must remain outside the repo and be backed up separately.

---

**Source citations:** see ROADMAP.md Round 12/Round 13 source indexes for CWS API v2, CWS program policies, and `chrome-webstore-upload-cli` v4.
