# Release Runbook

**Audience:** ScriptVault publishers and release engineers.
**Owners:** Phase 39.1 (custody), 39.2 (CWS API v2), 39.4 (locale audit), 39.49 (backlog buffer).
**Last reviewed:** 2026-05-17.

This runbook codifies the steps for tagging, signing, and shipping a ScriptVault release to the Chrome Web Store. It also documents the security-custody model that replaces long-lived CWS API credentials with GitHub Actions OIDC federation.

---

## 1. Pre-release gate

Before any release branch is created:

1. **Tests green:** `npm test` and `npm run typecheck` pass on `main`. CI must be green for the last commit.
2. **Smoke test green:** `npm run smoke:dashboard` passes locally on Linux + Windows.
3. **Locale lint green:** `tests/manifest-locales.test.js` (Phase 39.4) passes — no locale's `extName` exceeds 75 chars, no `extDescription` exceeds 132 chars, all locales share the `en` key set.
4. **Version sources synced:** `manifest.json`, `manifest-firefox.json`, `package.json`, and `package-lock.json` all point to the same target version.
5. **CHANGELOG entry drafted:** one paragraph per shipped roadmap item, with `Phase X.Y` cross-references.

If any gate fails, stop. Do not patch the test to make it green.

## 2. Custody model (Phase 39.1)

**Threat reference:**
- [Shai-Hulud 2.0 (Microsoft Security Blog, Dec 9 2025)](https://www.microsoft.com/en-us/security/blog/2025/12/09/shai-hulud-2-0-guidance-for-detecting-investigating-and-defending-against-the-supply-chain-attack/) — npm worm pattern that drove Trust Wallet's ~$8.5M loss via stolen CWS API key.
- [Cyberhaven OAuth phishing (Sekoia, Dec 2024)](https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/) — 36 extensions / 2.6M users compromised.

**Custody requirements:**

| Asset | Storage | Lifetime | Rotation cadence |
|---|---|---|---|
| CWS publisher Google account | Hardware-key MFA only (TitanKey / YubiKey 5C series) | indefinite | n/a — second factor is hardware |
| CWS API client_id / client_secret | GCP Secret Manager, accessible only via OIDC from `SysAdminDoc/ScriptVault` `main` branch | rotate every 90 days | calendar reminder in maintainer's TOC |
| Per-release CWS access token | minted just-in-time by GitHub Actions OIDC → GCP → CWS; never persisted | ~1 hour | every publish run |
| GitHub Actions OIDC trust policy | `aud: sts.amazonaws.com` style scoped to `ref:refs/heads/main` + workflow path | indefinite | audit annually |
| CRX signing private key (`.pem`) | local dev machine + hardware-backed encrypted backup | indefinite | rotate only on compromise |
| Codeberg mirror SSH deploy key | GitHub Secret, read+push to mirror only | indefinite | rotate annually |

**Explicitly forbidden:**
- Long-lived CWS API keys stored in GitHub Actions secrets.
- Pushing the `.env` file (already gitignored; verify before each release).
- Using `--client-secret` flag on `chrome-webstore-upload-cli` (removed in 4.0 — see §3).
- Signing a release from any machine without disk encryption and OS firewall enabled.

## 3. CWS API v2 cutover (Phase 39.2)

**Hard deadline:** 2026-10-15. The Chrome Web Store v1 publishing API sunsets on that date.

Migration path:

1. Pin `chrome-webstore-upload-cli@^4` in `devDependencies` (current pin: 3.5.0).
2. Verify Node engines are 22+ — `chrome-webstore-upload-cli@4` requires it. Bump `package.json` engines field.
3. Migrate `publish.sh` to read all credentials from environment (`CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`), never flags.
4. Drop any `--auto-publish` flag invocations (removed in 4.0).
5. Run a dry-run against a draft listing on a staging extension item ID before flipping production.
6. After cutover, delete the v1 OAuth credentials from GCP Secret Manager.

Reference: [chrome-webstore-upload-cli releases](https://github.com/fregante/chrome-webstore-upload-cli/releases), [CWS API v2 announcement](https://developer.chrome.com/blog/cws-api-v2).

## 4. Release sequence

1. **Cut release branch** off `main`: `git checkout -b release/vX.Y.Z`.
2. **Bump versions** in `manifest.json`, `manifest-firefox.json`, `package.json`, `package-lock.json`. Use semver — patch for fixes, minor for additive features, major only for breaking changes.
3. **Finalize CHANGELOG.md** entry for vX.Y.Z. Match the prose style of recent entries (terse, one-sentence-per-change, "Added/Changed/Fixed" prefixes).
4. **Build:** `npm run build:prod` then `bash build.sh`. Verify the produced ZIP loads in a clean Chrome profile.
5. **Smoke:** `npm run smoke:dashboard` against the unpacked extension.
6. **Tag:** `git tag -a vX.Y.Z -m "Release vX.Y.Z — <one-line summary>"`.
7. **Push tag to GitHub:** triggers the release workflow.
8. **Push tag to Codeberg mirror** (Phase 39.48): a separate workflow handles this on tag push.
9. **CWS upload:** the release workflow uses OIDC-minted CWS token to call API v2 `uploads.update` then `items.publish`.
10. **Verify CWS listing:** open the public listing within 10 minutes; confirm version, screenshots, and store description rendered.

## 5. CWS review backlog buffer (Phase 39.49)

Since April 2026, CWS review times have been running 7–14 days. Plan around it:

- **Routine releases:** assume 7-day median review. Mark target user-facing release date in the PR description, not the tag-push date.
- **CVE responses or security patches:** use the [CWS appeals/expedited-review flow](https://developer.chrome.com/blog/cws-new-appeals-process) — file an appeal with a brief security justification. Document the request in `docs/security-incident-log.md` (to be created on first use).
- **Feature freezes:** maintain a 14-day freeze between feature-freeze and target user-facing date to absorb worst-case review queues.

## 6. Post-release verification

Within 24 hours of CWS listing update:

1. Install the live extension on a clean profile from CWS and confirm:
   - Dashboard loads.
   - Existing scripts migrate cleanly from the previous version (if migration code was added in this release).
   - No console errors on service worker boot.
2. Check the `chrome.runtime.onInstalled` handler fires with `reason: 'update'` and `previousVersion` populated.
3. Update [ROADMAP.md](../ROADMAP.md): mark shipped phase items with `✅ Shipped in vX.Y.Z`.
4. Tag the milestone table row in the Phase Summary section.
5. Close any GitHub issues that this release resolves; cross-link the tag.

## 7. Rollback procedure

If a critical regression surfaces post-release:

1. **Do not delete the CWS listing.** CWS retains version history; users can downgrade only by uninstalling + reinstalling the previous CRX.
2. **Publish a hotfix release** with a strictly higher version (e.g., 3.10.1 → 3.10.2) that reverts the problematic change. Skip the normal review queue via the expedited-review appeals flow with cause = "regression".
3. **Communicate** via the Codeberg mirror's README (mirrors to GitHub) and any active community channels.
4. **Do not push a `-revert` tag.** Always roll forward.

## 8. Open items (post-runbook)

- [ ] GCP Secret Manager → GitHub Actions OIDC bridge: implementation pending Phase 39.1 — currently still using long-lived secrets. Track as v3.12.0 hardening release.
- [ ] CWS API v2 `publish.sh` migration: Phase 39.2; deadline 2026-10-15.
- [ ] Codeberg mirror workflow: Phase 39.48; pending Codeberg account provision + deploy key.
- [ ] Hardware-key MFA migration: requires acquiring a second YubiKey for the publisher account.

---

**Source citations:** see ROADMAP.md Round 12 source index (entries 261–263 for supply-chain incidents, 255 for CWS API v2 deadline, 256 for CWS program policies including the 75-char name cap).
