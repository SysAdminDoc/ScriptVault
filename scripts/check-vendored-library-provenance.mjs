#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const DOC_PATH = 'docs/amo-vendored-libraries.md';

const VENDORED_LIBRARIES = [
  {
    label: 'Acorn',
    packageName: 'acorn',
    expectedVersion: '8.17.0',
    expectedLicense: 'MIT',
    packagedPath: 'lib/acorn.min.js',
    sourcePath: 'node_modules/acorn/dist/acorn.js',
    generation: 'esbuild-minify',
    sourceMap: 'not shipped; reviewer rebuild uses npm source plus esbuild',
    runtimeUse: 'background parser fallback for Firefox MV3 analysis and ESM import parsing',
  },
  {
    label: 'jsdiff',
    packageName: 'diff',
    expectedVersion: '9.0.0',
    expectedLicense: 'BSD-3-Clause',
    packagedPath: 'lib/diff.min.js',
    sourcePath: 'node_modules/diff/dist/diff.js',
    minifiedSourcePath: 'node_modules/diff/dist/diff.min.js',
    generation: 'official-npm-minified-file',
    sourceMap: 'not shipped by npm package',
    runtimeUse: 'background diff fallback for Firefox sync merge and review flows',
  },
];

// Chromium and Edge ship the local Monaco ESM build even though Firefox stays
// textarea-first. These rows are intentionally byte-level: generated files are
// ignored by git, so the expected hash records exactly what the package builder
// must put in the store artifact. A missing optional artifact is allowed during
// the AMO source-review build, which never stages Monaco, but a present artifact
// must match its recorded hash.
const CHROMIUM_SHIPPED_LIBRARIES = [
  {
    label: 'fflate',
    packageName: 'fflate',
    expectedVersion: '0.8.3',
    expectedLicense: 'MIT',
    packagedPath: 'lib/fflate.js',
    expectedPackagedSha256: 'ab0660cca03d6b2fc93385d1af4a988fde49031d1169bbeafc4c792a81fe81a3',
    sourceSha256: 'b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1',
    sourceArchivePath: 'esm/browser.js',
    sourceArchiveSha256: '38c2cd824402407b43153c782274aec2ea83ea688e4aa0b743c5f2c305857d92',
    sourceUrl: 'https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz',
    sourceIntegrity: 'sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==',
    generation: 'inlined-browser-wrapper',
    sourceMap: 'not shipped; ScriptVault wrapper around the official browser build',
    runtimeUse: 'background ZIP import/export and backup archives',
    channels: ['chrome', 'edge', 'firefox'],
    optionalArtifact: false,
  },
  ...[
    ['codemirror.min.css', '11077112ab6955d29fe41085c62365c7d4a2f00a570c7475e2aec2a8cbc85fc4'],
    ['codemirror.min.js', 'd41cf25deaac9f7f08c08d5a8f88fcc9107e304fd3ef44a7cc6d5d22dddf3b44'],
    ['addon/lint/lint.css', '364a469092409a837e9383e7bd2b4a771e11267dbe2c5a51c1caf17f53cb91fe'],
    ['addon/lint/lint.min.js', 'c15b85f7246b7a0d07b597ea1893fde1e48b7f3985d4943130f2eeabf9d51a72'],
    ['mode/javascript/javascript.min.js', '99b46f351b4b1ce8a14cdf04fe4235ecb429b5b7b986867034a7dc195a710a58'],
    ['theme/ayu-dark.min.css', 'd85e6404225e6e5098660072181e2d94400de46bf351593aab9d77c2a14f537e'],
    ['theme/dracula.min.css', 'ba8d009adc9d54938ea88252c099a2b773ed3a4f5515ae9c2f937a8a4cb399df'],
    ['theme/material-darker.min.css', '36f7867d65852095da9627424ca794ab24b58187ccbdfdf637fda7b57ab417f8'],
    ['theme/monokai.min.css', '8e384a464c2adf6e08c4bd37a561f632d018dec2691d35e9179e5a16b27c6d30'],
    ['theme/nord.min.css', '5f16126f7822fbd3776ce2895c0dcbedd02e75f155b8d6bc8fbf53b710925c7f'],
  ].map(([relativePath, expectedPackagedSha256]) => ({
    label: `CodeMirror ${relativePath}`,
    packageName: 'codemirror',
    expectedVersion: '5.65.15',
    expectedLicense: 'MIT',
    packagedPath: `lib/codemirror/${relativePath}`,
    expectedPackagedSha256,
    sourceSha256: 'e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a',
    sourceArchivePath: 'codemirror-5.65.15.tgz',
    sourceArchiveSha256: 'e45937ac5dc64b64df239f0f7ed6119def02ba792e390605fca9318a6167992a',
    sourceUrl: 'https://registry.npmjs.org/codemirror/-/codemirror-5.65.15.tgz',
    sourceIntegrity: 'sha512-YC4EHbbwQeubZzxLl5G4nlbLc1T21QTrKGaOal/Pkm9dVDMZXMH7+ieSPEOZCtO9I68i8/oteJKOxzHC2zR+0g==',
    generation: 'minified-vendored-file',
    sourceMap: 'not shipped; source package archive is disclosed',
    runtimeUse: 'CodeMirror compatibility editor, lint surface, and themes',
    channels: ['chrome', 'edge'],
    optionalArtifact: false,
  })),
  {
    label: 'Monaco editor bundle',
    packageName: 'monaco-editor',
    expectedVersion: '0.56.0',
    expectedLicense: 'MIT',
    packagedPath: 'lib/monaco-esm/editor.js',
    expectedPackagedSha256: '6b6b200508a6024dc16a54770bd4050934342a38b435ec98855eb6ec362e5200',
    sourceSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceArchivePath: 'monaco-editor-0.56.0.tgz',
    sourceArchiveSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceUrl: 'https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz',
    generation: 'esbuild-bundle',
    sourceMap: 'not shipped; generated ESM bundle',
    runtimeUse: 'Chromium/Edge dashboard editor and workers',
    channels: ['chrome', 'edge'],
    optionalArtifact: true,
  },
  {
    label: 'Monaco editor stylesheet',
    packageName: 'monaco-editor',
    expectedVersion: '0.56.0',
    expectedLicense: 'MIT',
    packagedPath: 'lib/monaco-esm/editor.css',
    expectedPackagedSha256: '8932e8a97aaa06c789cbdc38b9eb03ada1851e2f38ddde0e4ff33410ccc02e1a',
    sourceSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceArchivePath: 'monaco-editor-0.56.0.tgz',
    sourceArchiveSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceUrl: 'https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz',
    generation: 'copied-from-bundle-build',
    sourceMap: 'not shipped; generated ESM bundle',
    runtimeUse: 'Monaco editor theme and token styles',
    channels: ['chrome', 'edge'],
    optionalArtifact: true,
  },
  {
    label: 'Monaco codicon font',
    packageName: 'monaco-editor',
    expectedVersion: '0.56.0',
    expectedLicense: 'MIT',
    packagedPath: 'lib/monaco-esm/assets/codicon-KP4OV2OO.ttf',
    expectedPackagedSha256: 'cc2472e239e17062e7760af87f8f5997720cc0d94aa014a615c418baaf6333a8',
    sourceSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceArchivePath: 'monaco-editor-0.56.0.tgz',
    sourceArchiveSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceUrl: 'https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz',
    generation: 'copied-from-bundle-build',
    sourceMap: 'not shipped; generated ESM bundle asset',
    runtimeUse: 'Monaco editor icon font',
    channels: ['chrome', 'edge'],
    optionalArtifact: true,
  },
  ...[
    ['editor.worker.js', '23863d6635f4500b47ff6d8918d98c72da79711f2e851784621be27712bed499'],
    ['css.worker.js', '5fe6377b26fe29e45c44c34e29ffc2bd10ea385a0ec5c3b06a8862fe6fa1d775'],
    ['ts.worker.js', '83e90c8aeb63b5de7e892426b32983e280540739cf8ade8bd88a865702ec7f61'],
    ['userscript-lsp.worker.js', '942a5d3e666a6b239d4f4a1f190d12b2005d7e193601e8929bdab54b601777a7'],
  ].map(([worker, expectedPackagedSha256]) => ({
    label: `Monaco ${worker}`,
    packageName: 'monaco-editor',
    expectedVersion: '0.56.0',
    expectedLicense: 'MIT',
    packagedPath: `lib/monaco-esm/workers/${worker}`,
    expectedPackagedSha256,
    sourceSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceArchivePath: 'monaco-editor-0.56.0.tgz',
    sourceArchiveSha256: 'b74bc4437205c194b779b0f21e5e7fcd3b4e9acbf3f7c8732a545d2059fb7412',
    sourceUrl: 'https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.56.0.tgz',
    generation: 'esbuild-worker-bundle',
    sourceMap: 'not shipped; generated ESM worker bundle',
    runtimeUse: 'Monaco editor worker runtime',
    channels: ['chrome', 'edge'],
    optionalArtifact: true,
  })),
  {
    label: 'DOMPurify inlined into Monaco',
    packageName: 'dompurify',
    expectedVersion: '3.4.13',
    expectedLicense: 'MPL-2.0 OR Apache-2.0',
    packagedPath: 'lib/monaco-esm/editor.js (inlined dependency)',
    packagedFilePath: 'lib/monaco-esm/editor.js',
    expectedPackagedSha256: '6b6b200508a6024dc16a54770bd4050934342a38b435ec98855eb6ec362e5200',
    sourceSha256: '2a0647141c748404c9958cf12079c3fdb79cf9a7faaa87c8fac034a3b1275ab2',
    sourceArchivePath: 'dompurify-3.4.13.tgz',
    sourceArchiveSha256: '2a0647141c748404c9958cf12079c3fdb79cf9a7faaa87c8fac034a3b1275ab2',
    sourceUrl: 'https://registry.npmjs.org/dompurify/-/dompurify-3.4.13.tgz',
    generation: 'monaco-esm-resolve-override',
    sourceMap: 'inlined in editor.js; no standalone file shipped',
    runtimeUse: 'Monaco HTML sanitization boundary',
    channels: ['chrome', 'edge'],
    optionalArtifact: true,
  },
];

function abs(relativePath) {
  return resolve(ROOT_DIR, relativePath);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(abs(relativePath), 'utf8'));
}

function sha256(bufferOrText) {
  return createHash('sha256').update(bufferOrText).digest('hex');
}

function cleanRepositoryUrl(repository) {
  const raw = typeof repository === 'string' ? repository : repository?.url || '';
  return raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
}

function sourceArchivePath(library) {
  if (library.sourceArchivePath) return library.sourceArchivePath;
  return library.sourcePath.replace(`node_modules/${library.packageName}/`, '');
}

function minifiedArchivePath(library) {
  if (!library.minifiedSourcePath) return '';
  return library.minifiedSourcePath.replace(`node_modules/${library.packageName}/`, '');
}

function libraryLockEntry(library, packageLock) {
  return packageLock.packages?.[`node_modules/${library.packageName}`] || {
    version: library.expectedVersion,
    resolved: library.sourceUrl,
    integrity: library.sourceIntegrity || '',
  };
}

function staticLibraryContext(library, packageLock) {
  return {
    installedPackage: { version: library.expectedVersion, license: library.expectedLicense },
    lockEntry: libraryLockEntry(library, packageLock),
    directRange: null,
  };
}

async function packageContext(library, packageLock, packageJson) {
  const installedPackage = await readJson(`node_modules/${library.packageName}/package.json`);
  const lockEntry = packageLock.packages?.[`node_modules/${library.packageName}`];
  const directRange = packageJson.devDependencies?.[library.packageName];
  if (!lockEntry) {
    throw new Error(`${library.packageName} is missing from package-lock.json`);
  }
  return { installedPackage, lockEntry, directRange };
}

async function generatePackagedText(library, context, esbuildVersion) {
  if (library.generation === 'official-npm-minified-file') {
    return readFile(abs(library.minifiedSourcePath), 'utf8');
  }

  if (library.generation === 'esbuild-minify') {
    const source = await readFile(abs(library.sourcePath), 'utf8');
    const result = await transform(source, {
      charset: 'utf8',
      legalComments: 'none',
      minify: true,
      sourcemap: false,
    });
    const banner = [
      '/*!',
      ` * ${library.label} v${context.installedPackage.version}`,
      ` * Source: ${sourceArchivePath(library)} from ${context.lockEntry.resolved}`,
      ` * License: ${context.installedPackage.license}`,
      ` * Generated by ScriptVault with esbuild ${esbuildVersion}.`,
      ' */',
      '',
    ].join('\n');
    return `${banner}${result.code.trimEnd()}\n`;
  }

  throw new Error(`Unknown generation mode for ${library.packageName}: ${library.generation}`);
}

async function buildInventory() {
  const packageJson = await readJson('package.json');
  const packageLock = await readJson('package-lock.json');
  const esbuildPackage = await readJson('node_modules/esbuild/package.json');

  const rows = [];
  for (const library of VENDORED_LIBRARIES) {
    const context = await packageContext(library, packageLock, packageJson);
    const sourceBytes = await readFile(abs(library.sourcePath));
    const generatedText = await generatePackagedText(library, context, esbuildPackage.version);
    const generatedBytes = Buffer.from(generatedText, 'utf8');
    const packagedBytes = existsSync(abs(library.packagedPath))
      ? await readFile(abs(library.packagedPath))
      : Buffer.alloc(0);
    const minifiedSourceBytes = library.minifiedSourcePath
      ? await readFile(abs(library.minifiedSourcePath))
      : null;

    rows.push({
      ...library,
      installedPackage: context.installedPackage,
      lockEntry: context.lockEntry,
      directRange: context.directRange,
      generatedText,
      generatedBytes,
      packagedBytes,
      sourceSha256: sha256(sourceBytes),
      packagedSha256: sha256(generatedBytes),
      currentPackagedSha256: sha256(packagedBytes),
      minifiedSourceSha256: minifiedSourceBytes ? sha256(minifiedSourceBytes) : '',
      officialPackageUrl: `https://www.npmjs.com/package/${library.packageName}/v/${context.installedPackage.version}`,
      repositoryUrl: cleanRepositoryUrl(context.installedPackage.repository),
      esbuildVersion: esbuildPackage.version,
    });
  }
  for (const library of CHROMIUM_SHIPPED_LIBRARIES) {
    const packagedPath = library.packagedFilePath || library.packagedPath;
    const packagedBytes = existsSync(abs(packagedPath)) ? await readFile(abs(packagedPath)) : null;
    const context = staticLibraryContext(library, packageLock);
    rows.push({
      ...library,
      installedPackage: context.installedPackage,
      lockEntry: context.lockEntry,
      directRange: context.directRange,
      generatedText: null,
      generatedBytes: null,
      packagedBytes,
      packagedSha256: library.expectedPackagedSha256,
      currentPackagedSha256: packagedBytes ? sha256(packagedBytes) : '',
      minifiedSourceSha256: '',
      officialPackageUrl: `https://www.npmjs.com/package/${library.packageName}/v/${library.expectedVersion}`,
      repositoryUrl: library.packageName === 'fflate'
        ? 'https://github.com/101arrowz/fflate'
        : library.packageName === 'dompurify'
          ? 'https://github.com/cure53/DOMPurify'
          : 'https://github.com/microsoft/monaco-editor',
      esbuildVersion: esbuildPackage.version,
      staticArtifact: true,
    });
  }
  return rows;
}

function generateMarkdown(rows) {
  const tableRows = rows.map((row) => `| ${[
    `\`${row.packagedPath}\``,
    row.packageName,
    row.installedPackage.version,
    row.installedPackage.license,
    `\`${row.packagedSha256}\``,
    `\`${row.sourceSha256}\``,
    row.minifiedSourceSha256 ? `\`${row.minifiedSourceSha256}\`` : 'generated locally',
    `[npm](${row.officialPackageUrl}) / [tarball](${row.lockEntry.resolved})`,
    row.sourceMap,
  ].join(' | ')} |`);

  const detailSections = rows.map((row) => {
    const generation = row.staticArtifact
      ? row.generation === 'inlined-browser-wrapper'
        ? 'inlined from the official browser build with the ScriptVault runtime wrapper'
        : `${row.generation} from the pinned npm package archive`
      : row.generation === 'official-npm-minified-file'
        ? `copied byte-for-byte from \`${row.minifiedSourcePath}\` after \`npm ci\``
        : `generated from \`${row.sourcePath}\` with esbuild ${row.esbuildVersion}`;
    const readableSource = row.staticArtifact
      ? `Official source archive: \`${row.sourceArchivePath}\` (SHA-256 \`${row.sourceArchiveSha256}\`).`
      : row.minifiedSourcePath
        ? `Readable source: \`${row.sourcePath}\`; official minified package file: \`${row.minifiedSourcePath}\`.`
        : `Readable source: \`${row.sourcePath}\`.`;
    const channelText = row.channels?.length ? `\n- Shipped channels: ${row.channels.join(', ')}` : '';
    return `### ${row.label} (${row.packageName}@${row.installedPackage.version})

- Packaged file: \`${row.packagedPath}\`
- Runtime use: ${row.runtimeUse}
- License: ${row.installedPackage.license}
- Official package page: ${row.officialPackageUrl}
- Official npm tarball: ${row.lockEntry.resolved}
- npm integrity: \`${row.lockEntry.integrity}\`
- Repository: ${row.repositoryUrl || 'not declared in package metadata'}
- Source archive path after \`npm ci\`: \`${sourceArchivePath(row)}\`
- Generation: ${generation}
- ${readableSource}
- Packaged SHA-256: \`${row.packagedSha256}\`
- Source SHA-256: \`${row.sourceSha256}\`${channelText}`;
  }).join('\n\n');

  return `# AMO Vendored Library Provenance

This inventory covers every third-party byte shipped by the Chrome and Edge
packages, plus the minified libraries copied into the Firefox AMO package by
\`build-firefox.sh\`. The source-review ZIP does not vendor \`node_modules\`;
reviewers recreate the official package-manager sources with \`npm ci\`, then
run \`npm run vendored:provenance:check\` or \`npm run firefox:package\`.

| Packaged file | Package | Version | License | Packaged SHA-256 | Readable source SHA-256 | Official minified source SHA-256 | Official package source | Source map status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows.join('\n')}

${detailSections}

## Gate

- \`npm run vendored:provenance\` regenerates the packaged files and this
  inventory from official npm package sources.
- \`npm run vendored:provenance:check\` fails if a packaged file, source hash,
  package version, license, lockfile integrity, direct dependency pin, generated
  Monaco hash, or \`build-firefox.sh\` minified-library include disagrees with
  this inventory. Chrome-only Monaco rows remain documented during the AMO
  source build but are checked whenever the generated files are present.
- \`npm run firefox:package\` runs the provenance check before staging the
  Firefox build directory.
`;
}

function expectedMinifiedPaths() {
  return new Set(VENDORED_LIBRARIES.map((library) => library.packagedPath));
}

export function validateInventoryDocument(expectedDoc, currentDoc) {
  return expectedDoc === currentDoc
    ? []
    : [`${DOC_PATH} is not current; run npm run vendored:provenance`];
}

async function checkFirefoxIncludes(errors) {
  const buildFirefox = await readFile(abs('build-firefox.sh'), 'utf8');
  const includeBlock = /\bINCLUDE=\((?<body>[\s\S]*?)\)/m.exec(buildFirefox)?.groups?.body || '';
  const includedMinified = new Set(
    [...includeBlock.matchAll(/^\s+([^\s#]+\.min\.js)\s*$/gm)].map((match) => match[1]),
  );
  const expected = expectedMinifiedPaths();

  for (const path of includedMinified) {
    if (!expected.has(path)) {
      errors.push(`${path} is copied by build-firefox.sh but missing from vendored provenance inventory`);
    }
  }
  for (const path of expected) {
    if (!includedMinified.has(path)) {
      errors.push(`${path} is inventoried but not copied by build-firefox.sh`);
    }
  }
}

async function checkChromiumIncludes(errors) {
  const buildFiles = ['build.sh', 'publish.sh', 'scripts/build-edge.mjs'];
  const required = ['lib/codemirror', 'lib/fflate.js', 'lib/monaco-esm'];
  for (const relativePath of buildFiles) {
    const text = await readFile(abs(relativePath), 'utf8');
    for (const path of required) {
      if (!text.includes(path)) {
        errors.push(`${relativePath} does not package shipped third-party path ${path}`);
      }
    }
  }
}

async function check({ write = false } = {}) {
  const rows = await buildInventory();
  const expectedDoc = generateMarkdown(rows);
  const errors = [];

  for (const row of rows) {
    if (row.staticArtifact) {
      if (!row.optionalArtifact && !row.packagedBytes) {
        errors.push(`${row.packagedPath} is missing from the shipped package source tree`);
      }
      if (row.packagedBytes && row.currentPackagedSha256 !== row.packagedSha256) {
        errors.push(`${row.packagedPath} does not match recorded ${row.packageName}@${row.expectedVersion} bytes`);
      }
      continue;
    }
    if (row.installedPackage.version !== row.expectedVersion) {
      errors.push(`${row.packageName} package version ${row.installedPackage.version} does not match expected ${row.expectedVersion}`);
    }
    if (row.installedPackage.license !== row.expectedLicense) {
      errors.push(`${row.packageName} license ${row.installedPackage.license} does not match expected ${row.expectedLicense}`);
    }
    if (row.lockEntry.version !== row.expectedVersion) {
      errors.push(`${row.packageName} lockfile version ${row.lockEntry.version} does not match expected ${row.expectedVersion}`);
    }
    if (row.directRange !== row.expectedVersion) {
      errors.push(`${row.packageName} must be an exact devDependency pin (${row.expectedVersion}), found ${row.directRange || 'missing'}`);
    }
    if (!row.lockEntry.resolved || !row.lockEntry.integrity) {
      errors.push(`${row.packageName} lockfile entry must include resolved tarball and integrity`);
    }

    if (write) {
      await writeFile(abs(row.packagedPath), row.generatedText);
    } else if (row.currentPackagedSha256 !== row.packagedSha256) {
      errors.push(`${row.packagedPath} does not match generated ${row.packageName}@${row.expectedVersion} bytes`);
    }
  }

  if (write) {
    await writeFile(abs(DOC_PATH), expectedDoc);
  } else {
    const currentDoc = existsSync(abs(DOC_PATH)) ? await readFile(abs(DOC_PATH), 'utf8') : '';
    errors.push(...validateInventoryDocument(expectedDoc, currentDoc));
  }

  await checkFirefoxIncludes(errors);
  await checkChromiumIncludes(errors);

  if (errors.length) {
    throw new Error(errors.map((error) => `- ${error}`).join('\n'));
  }

  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const unknown = args.filter((arg) => arg !== '--write' && arg !== '--check');
  if (unknown.length) {
    throw new Error(`Unknown option(s): ${unknown.join(', ')}`);
  }
  const rows = await check({ write });
  const mode = write ? 'updated' : 'verified';
  process.stdout.write(`Vendored library provenance ${mode} for ${rows.length} shipped provenance entries.\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`[vendored-provenance] Failed:\n${error?.message || error}`);
    process.exit(1);
  });
}
