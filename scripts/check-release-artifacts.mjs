#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const checkPublic = process.argv.includes('--public');

function readJson(path) {
  return JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));
}

function fail(message) {
  failures.push(message);
}

const failures = [];
const warnings = [];

const pkg = readJson('package.json');
const manifest = readJson('manifest.json');
const firefoxManifest = readJson('manifest-firefox.json');
const version = pkg.version;
const tag = `v${version}`;

if (manifest.version !== version) {
  fail(`manifest.json version ${manifest.version} does not match package.json ${version}`);
}
if (firefoxManifest.version !== version) {
  fail(`manifest-firefox.json version ${firefoxManifest.version} does not match package.json ${version}`);
}

const readme = readFileSync(join(projectRoot, 'README.md'), 'utf8');
if (!readme.includes(`version-${version}-`) && !readme.includes(`ScriptVault v${version}`)) {
  fail(`README.md does not advertise ${version}`);
}

const changelog = readFileSync(join(projectRoot, 'CHANGELOG.md'), 'utf8');
if (!changelog.includes(`## [v${version}]`) && !changelog.includes(`## [${version}]`)) {
  fail(`CHANGELOG.md has no section for ${tag}`);
}

const rootArtifacts = readdirSync(projectRoot)
  .filter((name) => /\.(zip|crx|xpi)$/i.test(name))
  .filter((name) => !name.includes(`v${version}`));

for (const artifact of rootArtifacts) {
  fail(`stale root artifact ${artifact} is not labeled for ${tag}`);
}

let hasTag = false;
try {
  execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], {
    cwd: projectRoot,
    stdio: 'ignore',
  });
  hasTag = true;
} catch (_e) {
  const message = `git tag ${tag} is missing`;
  if (checkPublic) {
    fail(message);
  } else {
    warnings.push(`${message}; create it before running release:check:public`);
  }
}

if (checkPublic) {
  try {
    const releaseJson = execFileSync(
      'gh',
      ['release', 'view', tag, '--json', 'tagName,assets'],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    const release = JSON.parse(releaseJson);
    if (release.tagName !== tag) {
      fail(`GitHub release tag ${release.tagName || '<missing>'} does not match ${tag}`);
    }
    const assetNames = (release.assets || []).map((asset) => basename(asset.name || ''));
    if (!assetNames.includes(`ScriptVault-v${version}.zip`)) {
      fail(`GitHub release ${tag} is missing ScriptVault-v${version}.zip`);
    }
    const latestJson = execFileSync(
      'gh',
      ['release', 'list', '--limit', '1', '--json', 'tagName,isLatest'],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    const [latest] = JSON.parse(latestJson);
    if (latest?.tagName !== tag || latest?.isLatest !== true) {
      fail(`GitHub latest release is ${latest?.tagName || '<missing>'}, expected ${tag}`);
    }
  } catch (e) {
    fail(`GitHub release ${tag} is missing or unreadable: ${e.message || e}`);
  }
} else if (hasTag) {
  warnings.push(`public GitHub release was not checked; rerun with --public before publishing ${tag}`);
}

if (!existsSync(join(projectRoot, 'build.sh'))) {
  fail('build.sh is missing');
}
if (!existsSync(join(projectRoot, 'build-firefox.sh'))) {
  fail('build-firefox.sh is missing');
}

if (failures.length > 0) {
  console.error('Release artifact check failed:');
  for (const item of failures) console.error(`- ${item}`);
  if (warnings.length > 0) {
    console.error('Warnings:');
    for (const item of warnings) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`Release artifact check passed for ${tag}.`);
if (warnings.length > 0) {
  console.log('Warnings:');
  for (const item of warnings) console.log(`- ${item}`);
}
