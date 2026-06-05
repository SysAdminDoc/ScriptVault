# Contributing

ScriptVault is a local-first browser extension. Keep changes reviewable,
reproducible, and easy to package for Chrome Web Store and AMO review.

## Development setup

1. Install the Node.js version in `.node-version` (currently 24.16.0) with
   npm 11.13.0 or newer.
2. Run `npm ci`.
3. Run `npm run check` before sending changes.

Use `npm run build` for local extension builds, `node scripts/run-bash.mjs
build.sh` for the Chrome Web Store ZIP, and `npm run firefox:package` for the
Firefox package/source-review ZIP.

## Local-only files

Do not commit or ship local working state, credentials, generated browser
packages, coverage, Playwright output, release artifacts, or editor metadata.
These files are ignored by `.gitignore` and excluded from source archives when
they are not release inputs.

If a new local state directory or generated artifact is added to a workflow,
update both `.gitignore` and `.gitattributes` in the same change.

## Release evidence

Before release or store upload, keep the evidence gates green:

```bash
npm run check
npm run cws:check
npm run cws:remote-code:check
npm run store-copy:check
npm run release:check
```

After the Chrome ZIP is built, also scan the exact artifact:

```bash
npm run cws:remote-code:check -- --target ScriptVault-vX.Y.Z.zip
```
