# Security Policy

ScriptVault is a local-first, zero-telemetry userscript manager. We take the
security of the extension, its build pipeline, and its users seriously.

## Supported Versions

Security fixes are shipped on the latest released minor version. Users should
always run the newest version published to the Chrome Web Store / AMO or built
from the tagged release.

| Version | Supported |
| ------- | --------- |
| 3.20.x  | Yes       |
| < 3.20  | No — upgrade to the latest release |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through either channel:

1. **GitHub private vulnerability reporting (preferred)** — use the
   **Report a vulnerability** button under the repository's **Security** tab
   (`Security` → `Advisories` → `Report a vulnerability`). This opens a private
   advisory visible only to the maintainer.
2. **Email** — `matt_parker@outlook.com` with the subject line
   `ScriptVault security`.

Please include:

- The affected version and platform (Chrome/Firefox + browser version).
- A description of the vulnerability and its impact.
- Reproduction steps or a proof-of-concept where possible.
- Any suggested remediation.

## Disclosure Window

- **Acknowledgement:** within 7 days of receipt.
- **Assessment and triage:** within 14 days.
- **Coordinated disclosure:** a fix is targeted within 90 days of a confirmed
  report. We will coordinate a disclosure date with the reporter and credit
  reporters who wish to be named.

## Scope

In scope: the extension code (`background.js`, `src/**`, `pages/**`,
`content.js`, `offscreen.js`), the GM API wrapper, the cloud-sync and signing
subsystems, and the release/build tooling under `scripts/**`.

Out of scope: vulnerabilities in third-party userscripts a user chooses to
install (ScriptVault provides static analysis, signing, and import quarantine to
help users assess these, but cannot vouch for arbitrary user-authored code), and
issues that require a already-compromised local machine or browser profile.

## Our Commitments

- Zero telemetry: the extension never phones home; no analytics or tracking.
- Minimal permissions: we do not expand the manifest permission surface beyond
  what is required for the disclosed single purpose.
- Reproducible, unsigned-but-verifiable releases: checksums, source ZIP, SBOM,
  and provenance are generated at release time (`npm run release:trust`).
