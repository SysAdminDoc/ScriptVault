#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const LEGACY_UNSIGNED_RELEASE_TAGS = new Set(['v3.11.0']);
const PUBLIC_RELEASE_TIMEOUT_MS = 15000;

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

function normalizeRepoPath(packageJson) {
  const raw = String(packageJson.repository?.url || '');
  const match = raw.match(/github\.com[:/](?<owner>[^/\s]+)\/(?<repo>[^/\s.]+)(?:\.git)?/i);
  return {
    owner: match?.groups?.owner || 'SysAdminDoc',
    repo: match?.groups?.repo || 'ScriptVault',
  };
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

async function fetchPublic(url, { method = 'GET', fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('global fetch is unavailable; Node 20+ is required for public release checks');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_RELEASE_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: method === 'HEAD' ? '*/*' : 'text/html,application/xhtml+xml,application/octet-stream;q=0.9,*/*;q=0.8',
        'User-Agent': 'ScriptVault-release-check',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function publicHttpFailure(label, response) {
  const statusText = response.statusText ? ` ${response.statusText}` : '';
  return `${label} failed with HTTP ${response.status}${statusText}`;
}

function isHttpOk(response) {
  return response && response.status >= 200 && response.status < 300;
}

async function checkDownloadAsset({ owner, repo, tag, assetName, fetchImpl }) {
  const url = `https://github.com/${owner}/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`;
  let response = await fetchPublic(url, { method: 'HEAD', fetchImpl });
  if (response.status === 405) {
    response = await fetchPublic(url, { method: 'GET', fetchImpl });
  }
  if (isHttpOk(response)) return [];
  if (response.status === 404) {
    return [`GitHub release ${tag} is missing ${assetName}`];
  }
  return [publicHttpFailure(`GitHub release asset ${assetName}`, response)];
}

export async function checkPublicGitHubRelease({
  owner = 'SysAdminDoc',
  repo = 'ScriptVault',
  tag,
  version,
  fetchImpl = globalThis.fetch,
} = {}) {
  const failures = [];
  const warnings = [];
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/tag/${encodeURIComponent(tag)}`;
  const latestUrl = `https://github.com/${owner}/${repo}/releases/latest`;
  const assetName = `ScriptVault-v${version}.zip`;

  try {
    const releaseResponse = await fetchPublic(releaseUrl, { fetchImpl });
    if (releaseResponse.status === 404) {
      failures.push(`GitHub release ${tag} is missing`);
    } else if (!isHttpOk(releaseResponse)) {
      failures.push(publicHttpFailure(`GitHub release ${tag}`, releaseResponse));
    } else {
      const html = await releaseResponse.text();
      if (!html.includes(assetName)) {
        failures.push(...await checkDownloadAsset({ owner, repo, tag, assetName, fetchImpl }));
      }
    }
  } catch (e) {
    failures.push(`GitHub release ${tag} public page check failed: ${e.message || e}`);
  }

  try {
    const latestResponse = await fetchPublic(latestUrl, { fetchImpl });
    if (!isHttpOk(latestResponse)) {
      failures.push(publicHttpFailure('GitHub latest release check', latestResponse));
    } else {
      const finalUrl = String(latestResponse.url || '');
      const latestTag = decodeURIComponent(finalUrl.match(/\/releases\/tag\/([^/?#]+)/)?.[1] || '');
      if (latestTag !== tag) {
        failures.push(`GitHub latest release is ${latestTag || '<missing>'}, expected ${tag}`);
      }
    }
  } catch (e) {
    failures.push(`GitHub latest release public check failed: ${e.message || e}`);
  }

  return { ok: failures.length === 0, failures, warnings };
}

export async function runReleaseArtifactCheck(argv = process.argv, options = {}) {
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
    const repoPath = normalizeRepoPath(pkg);
    const publicStatus = await checkPublicGitHubRelease({
      ...repoPath,
      tag,
      version,
      fetchImpl: options.fetchImpl || globalThis.fetch,
    });
    failures.push(...publicStatus.failures);
    warnings.push(...publicStatus.warnings);
  } else if (hasTag) {
    warnings.push(`public GitHub release was not checked; rerun with --public before publishing ${tag}`);
  }

  if (!existsSync(join(projectRoot, 'build.sh'))) {
    fail(failures, 'build.sh is missing');
  }
  if (!existsSync(join(projectRoot, 'build-firefox.sh'))) {
    fail(failures, 'build-firefox.sh is missing');
  }

  return { ok: failures.length === 0, failures, warnings, tag };
}

export function printReleaseArtifactCheck(result) {
  if (!result.ok) {
    console.error('Release artifact check failed:');
    for (const item of result.failures) console.error(`- ${item}`);
    if (result.warnings.length > 0) {
      console.error('Warnings:');
      for (const item of result.warnings) console.error(`- ${item}`);
    }
    return;
  }

  console.log(`Release artifact check passed for ${result.tag}.`);
  if (result.warnings.length > 0) {
    console.log('Warnings:');
    for (const item of result.warnings) console.log(`- ${item}`);
  }
}

export async function main(argv = process.argv, options = {}) {
  const result = await runReleaseArtifactCheck(argv, options);
  printReleaseArtifactCheck(result);
  if (!result.ok) process.exitCode = 1;
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`Release artifact check failed: ${e.message || e}`);
    process.exitCode = 2;
  });
}
