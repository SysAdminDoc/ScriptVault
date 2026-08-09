# AMO Vendored Library Provenance

This inventory covers every third-party byte shipped by the Chrome and Edge
packages, plus the minified libraries copied into the Firefox AMO package by
`build-firefox.sh`. The source-review ZIP does not vendor `node_modules`;
reviewers recreate the official package-manager sources with `npm ci`, then
run `npm run vendored:provenance:check` or `npm run firefox:package`.

| Packaged file | Package | Version | License | Packaged SHA-256 | Readable source SHA-256 | Official minified source SHA-256 | Official package source | Source map status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lib/acorn.min.js` | acorn | 8.17.0 | MIT | `6d9f53615b3aec94a9608ee4fb170a157ef76c3d40c0eaeb422c98ad290ae94c` | `b373ccd10e9deb63654289f73216eeefcaf0405d9ee24289aabf596b91b4c318` | generated locally | [npm](https://www.npmjs.com/package/acorn/v/8.17.0) / [tarball](https://registry.npmjs.org/acorn/-/acorn-8.17.0.tgz) | not shipped; reviewer rebuild uses npm source plus esbuild |
| `lib/diff.min.js` | diff | 9.0.0 | BSD-3-Clause | `b51a9d2885f2c090dc97b981027395f7e7e6558a46c75ae3747db267913a89ab` | `5773c7efb34715bb9a9b6a9ebf5b0ff00f85f9efa6d9fd69fc65e181364f7b2e` | `b51a9d2885f2c090dc97b981027395f7e7e6558a46c75ae3747db267913a89ab` | [npm](https://www.npmjs.com/package/diff/v/9.0.0) / [tarball](https://registry.npmjs.org/diff/-/diff-9.0.0.tgz) | not shipped by npm package |
| `lib/fflate.js` | fflate | 0.8.3 | MIT | `ab0660cca03d6b2fc93385d1af4a988fde49031d1169bbeafc4c792a81fe81a3` | `b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1` | generated locally | [npm](https://www.npmjs.com/package/fflate/v/0.8.3) / [tarball](https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz) | not shipped; ScriptVault wrapper around the official browser build |
| `lib/codemirror/codemirror.min.css` | codemirror | 5.65.15 | MIT | `11077112ab6955d29fe41085c62365c7d4a2f00a570c7475e2aec2a8cbc85fc4` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/codemirror.min.js` | codemirror | 5.65.15 | MIT | `d41cf25deaac9f7f08c08d5a8f88fcc9107e304fd3ef44a7cc6d5d22dddf3b44` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/addon/lint/lint.css` | codemirror | 5.65.15 | MIT | `364a469092409a837e9383e7bd2b4a771e11267dbe2c5a51c1caf17f53cb91fe` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/addon/lint/lint.min.js` | codemirror | 5.65.15 | MIT | `c15b85f7246b7a0d07b597ea1893fde1e48b7f3985d4943130f2eeabf9d51a72` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/mode/javascript/javascript.min.js` | codemirror | 5.65.15 | MIT | `99b46f351b4b1ce8a14cdf04fe4235ecb429b5b7b986867034a7dc195a710a58` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/theme/ayu-dark.min.css` | codemirror | 5.65.15 | MIT | `d85e6404225e6e5098660072181e2d94400de46bf351593aab9d77c2a14f537e` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/theme/dracula.min.css` | codemirror | 5.65.15 | MIT | `ba8d009adc9d54938ea88252c099a2b773ed3a4f5515ae9c2f937a8a4cb399df` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/theme/material-darker.min.css` | codemirror | 5.65.15 | MIT | `36f7867d65852095da9627424ca794ab24b58187ccbdfdf637fda7b57ab417f8` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/theme/monokai.min.css` | codemirror | 5.65.15 | MIT | `8e384a464c2adf6e08c4bd37a561f632d018dec2691d35e9179e5a16b27c6d30` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/codemirror/theme/nord.min.css` | codemirror | 5.65.15 | MIT | `5f16126f7822fbd3776ce2895c0dcbedd02e75f155b8d6bc8fbf53b710925c7f` | `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a` | generated locally | [npm](https://www.npmjs.com/package/codemirror/v/5.65.15) / [tarball](https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz) | not shipped; source package archive is disclosed |
| `lib/monaco-esm/editor.js` | monaco-editor | 0.56.0 | MIT | `6b6b200508a6024dc16a54770bd4050934342a38b435ec98855eb6ec362e5200` | `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412` | generated locally | [npm](https://www.npmjs.com/package/monaco-editor/v/0.56.0) / [tarball](https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz) | not shipped; generated ESM bundle |
| `lib/monaco-esm/editor.css` | monaco-editor | 0.56.0 | MIT | `8932e8a97aaa06c789cbdc38b9eb03ada1851e2f38ddde0e4ff33410ccc02e1a` | `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412` | generated locally | [npm](https://www.npmjs.com/package/monaco-editor/v/0.56.0) / [tarball](https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz) | not shipped; generated ESM bundle |
| `lib/monaco-esm/assets/codicon-KP4OV2OO.ttf` | monaco-editor | 0.56.0 | MIT | `cc2472e239e17062e7760af87f8f5997720cc0d94aa014a615c418baaf6333a8` | `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412` | generated locally | [npm](https://www.npmjs.com/package/monaco-editor/v/0.56.0) / [tarball](https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz) | not shipped; generated ESM bundle asset |
| `lib/monaco-esm/workers/editor.worker.js` | monaco-editor | 0.56.0 | MIT | `23863d6635f4500b47ff6d8918d98c72da79711f2e851784621be27712bed499` | `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412` | generated locally | [npm](https://www.npmjs.com/package/monaco-editor/v/0.56.0) / [tarball](https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz) | not shipped; generated ESM worker bundle |
| `lib/monaco-esm/workers/css.worker.js` | monaco-editor | 0.56.0 | MIT | `5fe6377b26fe29e45c44c34e29ffc2bd10ea385a0ec5c3b06a8862fe6fa1d775` | `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412` | generated locally | [npm](https://www.npmjs.com/package/monaco-editor/v/0.56.0) / [tarball](https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz) | not shipped; generated ESM worker bundle |
| `lib/monaco-esm/workers/ts.worker.js` | monaco-editor | 0.56.0 | MIT | `83e90c8aeb63b5de7e892426b32983e280540739cf8ade8bd88a865702ec7f61` | `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412` | generated locally | [npm](https://www.npmjs.com/package/monaco-editor/v/0.56.0) / [tarball](https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz) | not shipped; generated ESM worker bundle |
| `lib/monaco-esm/workers/userscript-lsp.worker.js` | monaco-editor | 0.56.0 | MIT | `942a5d3e666a6b239d4f4a1f190d12b2005d7e193601e8929bdab54b601777a7` | `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412` | generated locally | [npm](https://www.npmjs.com/package/monaco-editor/v/0.56.0) / [tarball](https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz) | not shipped; generated ESM worker bundle |
| `lib/monaco-esm/editor.js (inlined dependency)` | dompurify | 3.4.13 | MPL-2.0 OR Apache-2.0 | `6b6b200508a6024dc16a54770bd4050934342a38b435ec98855eb6ec362e5200` | `2a0647141c748404c9958cf12079c3fdb79cf9a7faaa87c8fac034a3b1275ab2` | generated locally | [npm](https://www.npmjs.com/package/dompurify/v/3.4.13) / [tarball](https://registry.npmjs.org/dompurify/-/dompurify-3.4.13.tgz) | inlined in editor.js; no standalone file shipped |

### Acorn (acorn@8.17.0)

- Packaged file: `lib/acorn.min.js`
- Runtime use: background parser fallback for Firefox MV3 analysis and ESM import parsing
- License: MIT
- Official package page: https://www.npmjs.com/package/acorn/v/8.17.0
- Official npm tarball: https://registry.npmjs.org/acorn/-/acorn-8.17.0.tgz
- npm integrity: `sha512-xRQbDb9BnwDafYNn6Vwl839DYVjqXYb1XVGtWAZ1kcDc6iwAL4hg3B1dZlRiuENFeO2H53gFG3in621AdERVAg==`
- Repository: https://github.com/acornjs/acorn
- Source archive path after `npm ci`: `dist/acorn.js`
- Generation: generated from `node_modules/acorn/dist/acorn.js` with esbuild 0.28.1
- Readable source: `node_modules/acorn/dist/acorn.js`.
- Packaged SHA-256: `6d9f53615b3aec94a9608ee4fb170a157ef76c3d40c0eaeb422c98ad290ae94c`
- Source SHA-256: `b373ccd10e9deb63654289f73216eeefcaf0405d9ee24289aabf596b91b4c318`

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

### fflate (fflate@0.8.3)

- Packaged file: `lib/fflate.js`
- Runtime use: background ZIP import/export and backup archives
- License: MIT
- Official package page: https://www.npmjs.com/package/fflate/v/0.8.3
- Official npm tarball: https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz
- npm integrity: `sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==`
- Repository: https://github.com/101arrowz/fflate
- Source archive path after `npm ci`: `esm/browser.js`
- Generation: inlined from the official browser build with the ScriptVault runtime wrapper
- Official source archive: `esm/browser.js` (SHA-256 `38c2cd824402407b43153c782274aec2ea83ea688e4aa0b743c5f2c305857d92`).
- Packaged SHA-256: `ab0660cca03d6b2fc93385d1af4a988fde49031d1169bbeafc4c792a81fe81a3`
- Source SHA-256: `b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1`
- Shipped channels: chrome, edge, firefox

### CodeMirror codemirror.min.css (codemirror@5.65.15)

- Packaged file: `lib/codemirror/codemirror.min.css`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `11077112ab6955d29fe41085c62365c7d4a2f00a570c7475e2aec2a8cbc85fc4`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror codemirror.min.js (codemirror@5.65.15)

- Packaged file: `lib/codemirror/codemirror.min.js`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `d41cf25deaac9f7f08c08d5a8f88fcc9107e304fd3ef44a7cc6d5d22dddf3b44`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror addon/lint/lint.css (codemirror@5.65.15)

- Packaged file: `lib/codemirror/addon/lint/lint.css`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `364a469092409a837e9383e7bd2b4a771e11267dbe2c5a51c1caf17f53cb91fe`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror addon/lint/lint.min.js (codemirror@5.65.15)

- Packaged file: `lib/codemirror/addon/lint/lint.min.js`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `c15b85f7246b7a0d07b597ea1893fde1e48b7f3985d4943130f2eeabf9d51a72`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror mode/javascript/javascript.min.js (codemirror@5.65.15)

- Packaged file: `lib/codemirror/mode/javascript/javascript.min.js`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `99b46f351b4b1ce8a14cdf04fe4235ecb429b5b7b986867034a7dc195a710a58`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror theme/ayu-dark.min.css (codemirror@5.65.15)

- Packaged file: `lib/codemirror/theme/ayu-dark.min.css`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `d85e6404225e6e5098660072181e2d94400de46bf351593aab9d77c2a14f537e`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror theme/dracula.min.css (codemirror@5.65.15)

- Packaged file: `lib/codemirror/theme/dracula.min.css`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `ba8d009adc9d54938ea88252c099a2b773ed3a4f5515ae9c2f937a8a4cb399df`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror theme/material-darker.min.css (codemirror@5.65.15)

- Packaged file: `lib/codemirror/theme/material-darker.min.css`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `36f7867d65852095da9627424ca794ab24b58187ccbdfdf637fda7b57ab417f8`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror theme/monokai.min.css (codemirror@5.65.15)

- Packaged file: `lib/codemirror/theme/monokai.min.css`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `8e384a464c2adf6e08c4bd37a561f632d018dec2691d35e9179e5a16b27c6d30`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### CodeMirror theme/nord.min.css (codemirror@5.65.15)

- Packaged file: `lib/codemirror/theme/nord.min.css`
- Runtime use: CodeMirror compatibility editor, lint surface, and themes
- License: MIT
- Official package page: https://www.npmjs.com/package/codemirror/v/5.65.15
- Official npm tarball: https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz
- npm integrity: `sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `codemirror-5.65.15.tgz`
- Generation: minified-vendored-file from the pinned npm package archive
- Official source archive: `codemirror-5.65.15.tgz` (SHA-256 `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`).
- Packaged SHA-256: `5f16126f7822fbd3776ce2895c0dcbedd02e75f155b8d6bc8fbf53b710925c7f`
- Source SHA-256: `e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a`
- Shipped channels: chrome, edge

### Monaco editor bundle (monaco-editor@0.56.0)

- Packaged file: `lib/monaco-esm/editor.js`
- Runtime use: Chromium/Edge dashboard editor and workers
- License: MIT
- Official package page: https://www.npmjs.com/package/monaco-editor/v/0.56.0
- Official npm tarball: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz
- npm integrity: `sha512-sXboRm3BeBeLm938eaiyLMe0OxzfXIlZvbv4ir/jVgQy1zDhWjgmny0WoN45fuDKhCCQsYMbBJrv/A6jd8aCUg==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `monaco-editor-0.56.0.tgz`
- Generation: esbuild-bundle from the pinned npm package archive
- Official source archive: `monaco-editor-0.56.0.tgz` (SHA-256 `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`).
- Packaged SHA-256: `6b6b200508a6024dc16a54770bd4050934342a38b435ec98855eb6ec362e5200`
- Source SHA-256: `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`
- Shipped channels: chrome, edge

### Monaco editor stylesheet (monaco-editor@0.56.0)

- Packaged file: `lib/monaco-esm/editor.css`
- Runtime use: Monaco editor theme and token styles
- License: MIT
- Official package page: https://www.npmjs.com/package/monaco-editor/v/0.56.0
- Official npm tarball: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz
- npm integrity: `sha512-sXboRm3BeBeLm938eaiyLMe0OxzfXIlZvbv4ir/jVgQy1zDhWjgmny0WoN45fuDKhCCQsYMbBJrv/A6jd8aCUg==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `monaco-editor-0.56.0.tgz`
- Generation: copied-from-bundle-build from the pinned npm package archive
- Official source archive: `monaco-editor-0.56.0.tgz` (SHA-256 `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`).
- Packaged SHA-256: `8932e8a97aaa06c789cbdc38b9eb03ada1851e2f38ddde0e4ff33410ccc02e1a`
- Source SHA-256: `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`
- Shipped channels: chrome, edge

### Monaco codicon font (monaco-editor@0.56.0)

- Packaged file: `lib/monaco-esm/assets/codicon-KP4OV2OO.ttf`
- Runtime use: Monaco editor icon font
- License: MIT
- Official package page: https://www.npmjs.com/package/monaco-editor/v/0.56.0
- Official npm tarball: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz
- npm integrity: `sha512-sXboRm3BeBeLm938eaiyLMe0OxzfXIlZvbv4ir/jVgQy1zDhWjgmny0WoN45fuDKhCCQsYMbBJrv/A6jd8aCUg==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `monaco-editor-0.56.0.tgz`
- Generation: copied-from-bundle-build from the pinned npm package archive
- Official source archive: `monaco-editor-0.56.0.tgz` (SHA-256 `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`).
- Packaged SHA-256: `cc2472e239e17062e7760af87f8f5997720cc0d94aa014a615c418baaf6333a8`
- Source SHA-256: `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`
- Shipped channels: chrome, edge

### Monaco editor.worker.js (monaco-editor@0.56.0)

- Packaged file: `lib/monaco-esm/workers/editor.worker.js`
- Runtime use: Monaco editor worker runtime
- License: MIT
- Official package page: https://www.npmjs.com/package/monaco-editor/v/0.56.0
- Official npm tarball: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz
- npm integrity: `sha512-sXboRm3BeBeLm938eaiyLMe0OxzfXIlZvbv4ir/jVgQy1zDhWjgmny0WoN45fuDKhCCQsYMbBJrv/A6jd8aCUg==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `monaco-editor-0.56.0.tgz`
- Generation: esbuild-worker-bundle from the pinned npm package archive
- Official source archive: `monaco-editor-0.56.0.tgz` (SHA-256 `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`).
- Packaged SHA-256: `23863d6635f4500b47ff6d8918d98c72da79711f2e851784621be27712bed499`
- Source SHA-256: `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`
- Shipped channels: chrome, edge

### Monaco css.worker.js (monaco-editor@0.56.0)

- Packaged file: `lib/monaco-esm/workers/css.worker.js`
- Runtime use: Monaco editor worker runtime
- License: MIT
- Official package page: https://www.npmjs.com/package/monaco-editor/v/0.56.0
- Official npm tarball: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz
- npm integrity: `sha512-sXboRm3BeBeLm938eaiyLMe0OxzfXIlZvbv4ir/jVgQy1zDhWjgmny0WoN45fuDKhCCQsYMbBJrv/A6jd8aCUg==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `monaco-editor-0.56.0.tgz`
- Generation: esbuild-worker-bundle from the pinned npm package archive
- Official source archive: `monaco-editor-0.56.0.tgz` (SHA-256 `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`).
- Packaged SHA-256: `5fe6377b26fe29e45c44c34e29ffc2bd10ea385a0ec5c3b06a8862fe6fa1d775`
- Source SHA-256: `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`
- Shipped channels: chrome, edge

### Monaco ts.worker.js (monaco-editor@0.56.0)

- Packaged file: `lib/monaco-esm/workers/ts.worker.js`
- Runtime use: Monaco editor worker runtime
- License: MIT
- Official package page: https://www.npmjs.com/package/monaco-editor/v/0.56.0
- Official npm tarball: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz
- npm integrity: `sha512-sXboRm3BeBeLm938eaiyLMe0OxzfXIlZvbv4ir/jVgQy1zDhWjgmny0WoN45fuDKhCCQsYMbBJrv/A6jd8aCUg==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `monaco-editor-0.56.0.tgz`
- Generation: esbuild-worker-bundle from the pinned npm package archive
- Official source archive: `monaco-editor-0.56.0.tgz` (SHA-256 `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`).
- Packaged SHA-256: `83e90c8aeb63b5de7e892426b32983e280540739cf8ade8bd88a865702ec7f61`
- Source SHA-256: `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`
- Shipped channels: chrome, edge

### Monaco userscript-lsp.worker.js (monaco-editor@0.56.0)

- Packaged file: `lib/monaco-esm/workers/userscript-lsp.worker.js`
- Runtime use: Monaco editor worker runtime
- License: MIT
- Official package page: https://www.npmjs.com/package/monaco-editor/v/0.56.0
- Official npm tarball: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz
- npm integrity: `sha512-sXboRm3BeBeLm938eaiyLMe0OxzfXIlZvbv4ir/jVgQy1zDhWjgmny0WoN45fuDKhCCQsYMbBJrv/A6jd8aCUg==`
- Repository: https://github.com/microsoft/monaco-editor
- Source archive path after `npm ci`: `monaco-editor-0.56.0.tgz`
- Generation: esbuild-worker-bundle from the pinned npm package archive
- Official source archive: `monaco-editor-0.56.0.tgz` (SHA-256 `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`).
- Packaged SHA-256: `942a5d3e666a6b239d4f4a1f190d12b2005d7e193601e8929bdab54b601777a7`
- Source SHA-256: `b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412`
- Shipped channels: chrome, edge

### DOMPurify inlined into Monaco (dompurify@3.4.13)

- Packaged file: `lib/monaco-esm/editor.js (inlined dependency)`
- Runtime use: Monaco HTML sanitization boundary
- License: MPL-2.0 OR Apache-2.0
- Official package page: https://www.npmjs.com/package/dompurify/v/3.4.13
- Official npm tarball: https://registry.npmjs.org/dompurify/-/dompurify-3.4.13.tgz
- npm integrity: `sha512-2vmYIoqjze2d+kakP8S/nS5shfsl587kzwEjcGlTdiksUVgFHnFCsLYDVj/JNqJVOQZGSYBTmuycv0PodwmnMQ==`
- Repository: https://github.com/cure53/DOMPurify
- Source archive path after `npm ci`: `dompurify-3.4.13.tgz`
- Generation: monaco-esm-resolve-override from the pinned npm package archive
- Official source archive: `dompurify-3.4.13.tgz` (SHA-256 `2a0647141c748404c9958cf12079c3fdb79cf9a7faaa87c8fac034a3b1275ab2`).
- Packaged SHA-256: `6b6b200508a6024dc16a54770bd4050934342a38b435ec98855eb6ec362e5200`
- Source SHA-256: `2a0647141c748404c9958cf12079c3fdb79cf9a7faaa87c8fac034a3b1275ab2`
- Shipped channels: chrome, edge

## Gate

- `npm run vendored:provenance` regenerates the packaged files and this
  inventory from official npm package sources.
- `npm run vendored:provenance:check` fails if a packaged file, source hash,
  package version, license, lockfile integrity, direct dependency pin, generated
  Monaco hash, or `build-firefox.sh` minified-library include disagrees with
  this inventory. Chrome-only Monaco rows remain documented during the AMO
  source build but are checked whenever the generated files are present.
- `npm run firefox:package` runs the provenance check before staging the
  Firefox build directory.
