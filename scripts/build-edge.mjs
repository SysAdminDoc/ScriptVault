#!/usr/bin/env node
// scripts/build-edge.mjs
//
// Microsoft Edge Add-ons package builder. Edge uses the same Chromium
// codebase as Chrome and accepts an unmodified Chrome MV3 manifest in the
// vast majority of cases, so this script:
//   1. Runs the standard esbuild pipeline (background.js + Monaco).
//   2. Stages the Chrome build into `build-edge/`.
//   3. Applies a small, declarative set of Edge-specific manifest
//      transformations (strip `minimum_chrome_version`, set an
//      `update_url` placeholder to none, etc.) — see EDGE_TRANSFORMS below.
//   4. Verifies every declared file is present.
//   5. Produces `edge-artifacts/scriptvault-edge-vX.Y.Z.zip` plus a parity
//      summary JSON.
//
// Edge submission checklist lives in docs/edge-submission.md. This script
// is the "build" half; the store-upload half stays manual until Microsoft
// Partner Center ships a stable CI API.
//
// Usage:
//   node scripts/build-edge.mjs             # full build + zip
//   node scripts/build-edge.mjs --no-zip    # stage only
//   node scripts/build-edge.mjs --check     # build, then assert parity report

import { execSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { existsSync, createWriteStream } from 'node:fs';

const ROOT = process.cwd();
const BUILD_DIR = join(ROOT, 'build-edge');
const ARTIFACT_DIR = join(ROOT, 'edge-artifacts');

const args = new Set(process.argv.slice(2));
const wantZip = !args.has('--no-zip');
const wantCheck = args.has('--check');

// Files + directories to package. Mirrors build.sh INCLUDE[] for Chrome.
const INCLUDE = [
  'background.js',
  'content.js',
  'offscreen.html',
  'offscreen.js',
  'shared',
  'pages',
  'images/icon16.png',
  'images/icon32.png',
  'images/icon48.png',
  'images/icon128.png',
  'lib',
  '_locales'
];

// Edge-specific manifest tweaks. Keep this list small and declarative; the
// goal is one place that documents what Edge wants different from Chrome.
//
// Empirically Edge accepts the Chrome MV3 manifest verbatim today. The
// transforms below are defense-in-depth for future divergences:
//   - update_url: Edge auto-injects its own update_url on publish, and a
//     stray Chrome Web Store update_url would otherwise leak.
//   - minimum_chrome_version: Edge maps this to its own minimum Chromium
//     channel; leaving it in is technically valid but the field is
//     Chrome-store flavored and submission reviewers sometimes flag it.
const EDGE_TRANSFORMS = {
  removeKeys: ['update_url'],
  // Permissions that Edge silently no-ops (kept here for the docs gate;
  // none today). Add a key here if Edge ever drops a permission Chrome ships.
  removePermissions: [],
  removeOptionalPermissions: []
};

function log(msg) {
  process.stdout.write(`[build-edge] ${msg}\n`);
}

async function copyRecursive(src, dest) {
  const info = await stat(src);
  if (info.isDirectory()) {
    await mkdir(dest, { recursive: true });
    for (const entry of await readdir(src)) {
      await copyRecursive(join(src, entry), join(dest, entry));
    }
  } else {
    await mkdir(dirname(dest), { recursive: true });
    const data = await readFile(src);
    await writeFile(dest, data);
  }
}

async function applyManifestTransforms() {
  const chromeManifestPath = join(ROOT, 'manifest.json');
  const manifest = JSON.parse(await readFile(chromeManifestPath, 'utf8'));
  const before = JSON.stringify(manifest, null, 2);

  for (const k of EDGE_TRANSFORMS.removeKeys) {
    if (k in manifest) delete manifest[k];
  }
  if (Array.isArray(manifest.permissions) && EDGE_TRANSFORMS.removePermissions.length) {
    manifest.permissions = manifest.permissions.filter(p => !EDGE_TRANSFORMS.removePermissions.includes(p));
  }
  if (Array.isArray(manifest.optional_permissions) && EDGE_TRANSFORMS.removeOptionalPermissions.length) {
    manifest.optional_permissions = manifest.optional_permissions
      .filter(p => !EDGE_TRANSFORMS.removeOptionalPermissions.includes(p));
  }
  const after = JSON.stringify(manifest, null, 2);
  const changed = before !== after;
  const outPath = join(BUILD_DIR, 'manifest.json');
  await writeFile(outPath, after + '\n');
  return { changed, manifest };
}

async function verifyTree(declaredFiles) {
  const missing = [];
  for (const item of declaredFiles) {
    const path = join(BUILD_DIR, item);
    if (!existsSync(path)) missing.push(item);
  }
  return missing;
}

async function zipDir(srcDir, outPath) {
  // Prefer Windows bsdtar (tar.exe) which produces POSIX-slash entries
  // Chrome/Edge accept. Falls back to `zip` on POSIX systems.
  await rm(outPath, { force: true });
  if (process.platform === 'win32') {
    const tar = 'C:/Windows/System32/tar.exe';
    if (existsSync(tar)) {
      execSync(`"${tar}" -a -c -f "${outPath}" *`, { cwd: srcDir, stdio: 'inherit' });
      return;
    }
  }
  try {
    execSync(`zip -r "${outPath}" . -x "*.DS_Store" "*Thumbs.db"`, { cwd: srcDir, stdio: 'inherit' });
  } catch (err) {
    throw new Error('No zip tool available (need tar.exe on Windows or zip on POSIX).');
  }
}

async function main() {
  log('Building background.js + Monaco via esbuild…');
  execSync('node esbuild.config.mjs', { cwd: ROOT, stdio: 'inherit' });

  log('Staging Edge build directory…');
  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(BUILD_DIR, { recursive: true });
  for (const item of INCLUDE) {
    const src = join(ROOT, item);
    if (!existsSync(src)) {
      log(`  ! missing source: ${item}`);
      continue;
    }
    await copyRecursive(src, join(BUILD_DIR, item));
  }

  const transformResult = await applyManifestTransforms();
  log(`Manifest staged (transformed: ${transformResult.changed}).`);

  const declaredFiles = ['manifest.json', ...INCLUDE];
  const missing = await verifyTree(declaredFiles);
  if (missing.length > 0) {
    log(`Edge build is missing ${missing.length} declared file(s): ${missing.join(', ')}`);
    if (wantCheck) process.exit(1);
  }

  const version = transformResult.manifest.version;
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const zipName = `scriptvault-edge-v${version}.zip`;
  const zipPath = join(ARTIFACT_DIR, zipName);

  if (wantZip) {
    log(`Packaging ${zipName}…`);
    await zipDir(BUILD_DIR, zipPath);
    const size = (await stat(zipPath)).size;
    log(`Wrote ${zipName} (${(size / 1024).toFixed(1)} KB)`);
  } else {
    log('Skipping ZIP step (--no-zip).');
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    version,
    buildDir: BUILD_DIR,
    artifact: wantZip ? zipPath : null,
    transformsApplied: EDGE_TRANSFORMS,
    manifestTransformed: transformResult.changed,
    missingFiles: missing
  };
  await writeFile(join(ARTIFACT_DIR, `edge-build-${version}.json`), JSON.stringify(summary, null, 2));
  log('Edge build summary:');
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

  if (wantCheck && missing.length > 0) process.exit(1);
}

main().catch(err => {
  console.error('[build-edge] Failed:', err?.stack || err?.message || err);
  process.exit(1);
});
