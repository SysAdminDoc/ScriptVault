#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const LEGACY_UNSIGNED_RELEASE_TAGS = new Set(['v3.11.0']);

function readJson(path) {
  return JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));
}

function commandErrorText(error) {
  return String(error?.stderr || error?.stdout || error?.message || error || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function appendDetail(message, detail) {
  return detail ? `${message}: ${detail}` : message;
}

function isUnsignedTagVerification(detail) {
  return /no signature found/i.test(detail)
    || /cannot verify a non-tag object/i.test(detail)
    || /not a tag object/i.test(detail);
}

function isVerifierKeyUnavailable(detail) {
  return /no public key/i.test(detail) || /can't check signature/i.test(detail) || /cannot run gpg/i.test(detail);
}

export function verifyReleaseTag({
  tag,
  checkPublic = false,
  root = projectRoot,
  execFileSyncImpl = execFileSync,
  legacyUnsignedTags = LEGACY_UNSIGNED_RELEASE_TAGS,
} = {}) {
  const failures = [];
  const warnings = [];
  let hasTag = false;

  try {
    execFileSyncImpl('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], {
      cwd: root,
      stdio: 'ignore',
    });
    hasTag = true;
  } catch (_e) {
    const message = `git tag ${tag} is missing`;
    if (checkPublic) {
      failures.push(message);
    } else {
      warnings.push(`${message}; create it before running release:check:public`);
    }
    return { hasTag, failures, warnings };
  }

  try {
    execFileSyncImpl('git', ['tag', '--verify', tag], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const detail = commandErrorText(e);
    const message = `git tag ${tag} is unsigned or cannot be cryptographically verified`;
    if (isUnsignedTagVerification(detail)) {
      if (!checkPublic && legacyUnsignedTags.has(tag)) {
        warnings.push(`${message}; ${tag} is a legacy pre-RD-13 tag`);
      } else {
        failures.push(appendDetail(`git tag ${tag} is unsigned`, detail));
      }
    } else if (!checkPublic && isVerifierKeyUnavailable(detail)) {
      warnings.push(appendDetail(`${message}; import the release signing public key before public release`, detail));
    } else {
      failures.push(appendDetail(message, detail));
    }
  }

  return { hasTag, failures, warnings };
}

function fail(failures, message) {
  failures.push(message);
}

export function main(argv = process.argv) {
  const checkPublic = argv.includes('--public');
  const failures = [];
  const warnings = [];

  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  const firefoxManifest = readJson('manifest-firefox.json');
  const version = pkg.version;
  const tag = `v${version}`;

  if (manifest.version !== version) {
    fail(failures, `manifest.json version ${manifest.version} does not match package.json ${version}`);
  }
  if (firefoxManifest.version !== version) {
    fail(failures, `manifest-firefox.json version ${firefoxManifest.version} does not match package.json ${version}`);
  }

  const readme = readFileSync(join(projectRoot, 'README.md'), 'utf8');
  if (!readme.includes(`version-${version}-`) && !readme.includes(`ScriptVault v${version}`)) {
    fail(failures, `README.md does not advertise ${version}`);
  }

  const changelog = readFileSync(join(projectRoot, 'CHANGELOG.md'), 'utf8');
  if (!changelog.includes(`## [v${version}]`) && !changelog.includes(`## [${version}]`)) {
    fail(failures, `CHANGELOG.md has no section for ${tag}`);
  }

  const rootArtifacts = readdirSync(projectRoot)
    .filter((name) => /\.(zip|crx|xpi)$/i.test(name))
    .filter((name) => !name.includes(`v${version}`));

  for (const artifact of rootArtifacts) {
    fail(failures, `stale root artifact ${artifact} is not labeled for ${tag}`);
  }

  const tagStatus = verifyReleaseTag({ tag, checkPublic });
  const hasTag = tagStatus.hasTag;
  failures.push(...tagStatus.failures);
  warnings.push(...tagStatus.warnings);

  if (checkPublic) {
    try {
      const releaseJson = execFileSync(
        'gh',
        ['release', 'view', tag, '--json', 'tagName,assets'],
        { cwd: projectRoot, encoding: 'utf8' },
      );
      const release = JSON.parse(releaseJson);
      if (release.tagName !== tag) {
        fail(failures, `GitHub release tag ${release.tagName || '<missing>'} does not match ${tag}`);
      }
      const assetNames = (release.assets || []).map((asset) => basename(asset.name || ''));
      if (!assetNames.includes(`ScriptVault-v${version}.zip`)) {
        fail(failures, `GitHub release ${tag} is missing ScriptVault-v${version}.zip`);
      }
      const latestJson = execFileSync(
        'gh',
        ['release', 'list', '--limit', '1', '--json', 'tagName,isLatest'],
        { cwd: projectRoot, encoding: 'utf8' },
      );
      const [latest] = JSON.parse(latestJson);
      if (latest?.tagName !== tag || latest?.isLatest !== true) {
        fail(failures, `GitHub latest release is ${latest?.tagName || '<missing>'}, expected ${tag}`);
      }
    } catch (e) {
      fail(failures, `GitHub release ${tag} is missing or unreadable: ${e.message || e}`);
    }
  } else if (hasTag) {
    warnings.push(`public GitHub release was not checked; rerun with --public before publishing ${tag}`);
  }

  if (!existsSync(join(projectRoot, 'build.sh'))) {
    fail(failures, 'build.sh is missing');
  }
  if (!existsSync(join(projectRoot, 'build-firefox.sh'))) {
    fail(failures, 'build-firefox.sh is missing');
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
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
