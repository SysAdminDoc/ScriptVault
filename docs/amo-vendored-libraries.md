# AMO Vendored Library Provenance

This inventory covers minified third-party files copied into the Firefox AMO
package by `build-firefox.sh`. The source-review ZIP does not vendor
`node_modules`; reviewers recreate the official package-manager sources with
`npm ci`, then run `npm run vendored:provenance:check` or
`npm run firefox:package`.

| Packaged file | Package | Version | License | Packaged SHA-256 | Readable source SHA-256 | Official minified source SHA-256 | Official package source | Source map status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lib/acorn.min.js` | acorn | 8.16.0 | MIT | `491892374a4726de9a5ce810d3e17a9325255d62daa646b7eb46272048630d54` | `2261c5f0e4abe860e889dfc67081683a4ba4d27deb7f4cbc8ad06a1b7fdd510c` | generated locally | [npm](https://www.npmjs.com/package/acorn/v/8.16.0) / [tarball](https://registry.npmjs.org/acorn/-/acorn-8.16.0.tgz) | not shipped; reviewer rebuild uses npm source plus esbuild |
| `lib/diff.min.js` | diff | 9.0.0 | BSD-3-Clause | `b51a9d2885f2c090dc97b981027395f7e7e6558a46c75ae3747db267913a89ab` | `5773c7efb34715bb9a9b6a9ebf5b0ff00f85f9efa6d9fd69fc65e181364f7b2e` | `b51a9d2885f2c090dc97b981027395f7e7e6558a46c75ae3747db267913a89ab` | [npm](https://www.npmjs.com/package/diff/v/9.0.0) / [tarball](https://registry.npmjs.org/diff/-/diff-9.0.0.tgz) | not shipped by npm package |

### Acorn (acorn@8.16.0)

- Packaged file: `lib/acorn.min.js`
- Runtime use: background parser fallback for Firefox MV3 analysis and ESM import parsing
- License: MIT
- Official package page: https://www.npmjs.com/package/acorn/v/8.16.0
- Official npm tarball: https://registry.npmjs.org/acorn/-/acorn-8.16.0.tgz
- npm integrity: `sha512-UVJyE9MttOsBQIDKw1skb9nAwQuR5wuGD3+82K6JgJlm/Y+KI92oNsMNGZCYdDsVtRHSak0pcV5Dno5+4jh9sw==`
- Repository: https://github.com/acornjs/acorn
- Source archive path after `npm ci`: `dist/acorn.js`
- Generation: generated from `node_modules/acorn/dist/acorn.js` with esbuild 0.27.4
- Readable source: `node_modules/acorn/dist/acorn.js`.
- Packaged SHA-256: `491892374a4726de9a5ce810d3e17a9325255d62daa646b7eb46272048630d54`
- Source SHA-256: `2261c5f0e4abe860e889dfc67081683a4ba4d27deb7f4cbc8ad06a1b7fdd510c`

### jsdiff (diff@9.0.0)

- Packaged file: `lib/diff.min.js`
- Runtime use: background diff fallback for Firefox sync merge and review flows
- License: BSD-3-Clause
- Official package page: https://www.npmjs.com/package/diff/v/9.0.0
- Official npm tarball: https://registry.npmjs.org/diff/-/diff-9.0.0.tgz
- npm integrity: `sha512-svtcdpS8CgJyqAjEQIXdb3OjhFVVYjzGAPO8WGCmRbrml64SPw/jJD4GoE98aR7r25A0XcgrK3F02yw9R/vhQw==`
- Repository: https://github.com/kpdecker/jsdiff
- Source archive path after `npm ci`: `dist/diff.js`
- Generation: copied byte-for-byte from `node_modules/diff/dist/diff.min.js` after `npm ci`
- Readable source: `node_modules/diff/dist/diff.js`; official minified package file: `node_modules/diff/dist/diff.min.js`.
- Packaged SHA-256: `b51a9d2885f2c090dc97b981027395f7e7e6558a46c75ae3747db267913a89ab`
- Source SHA-256: `5773c7efb34715bb9a9b6a9ebf5b0ff00f85f9efa6d9fd69fc65e181364f7b2e`

## Gate

- `npm run vendored:provenance` regenerates the packaged files and this
  inventory from official npm package sources.
- `npm run vendored:provenance:check` fails if a packaged file, source hash,
  package version, license, lockfile integrity, direct dependency pin, or
  `build-firefox.sh` minified-library include disagrees with this inventory.
- `npm run firefox:package` runs the provenance check before staging the
  Firefox build directory.
