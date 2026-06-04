#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, '..');
const CWS_ID_RE = /^[a-p]{32}$/;

function readText(rootDir, path) {
  return readFileSync(join(rootDir, path), 'utf8');
}

function readJson(rootDir, path) {
  return JSON.parse(readText(rootDir, path));
}

function isPlaceholder(value) {
  return !value || /^your[_-]/i.test(value) || /placeholder|example/i.test(value);
}

export function buildCwsFetchStatusUrl(publisherId, itemId) {
  const name = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}`;
  return `https://chromewebstore.googleapis.com/v2/${name}:fetchStatus`;
}

export function extractReadmeCwsItemId(readme) {
  const match = readme.match(/chromewebstore\.google\.com\/detail\/[^/\s)]+\/([a-p]{32})/i);
  return match?.[1] || null;
}

export function summarizeFirefoxLint(report) {
  const summary = report?.summary || {};
  return {
    errors: Number(summary.errors || 0),
    notices: Number(summary.notices || 0),
    warnings: Number(summary.warnings || 0),
  };
}

function pushFailure(result, message) {
  result.failures.push(message);
}

function pushWarning(result, message) {
  result.warnings.push(message);
}

function requireScript(result, pkg, name) {
  if (!pkg.scripts?.[name]) pushFailure(result, `package.json is missing script ${name}`);
}

function requireText(result, label, text, needle) {
  if (!text.includes(needle)) pushFailure(result, `${label} is missing ${needle}`);
}

function checkReleaseWiring(rootDir, result) {
  const pkg = readJson(rootDir, 'package.json');
  const ci = readText(rootDir, '.github/workflows/ci.yml');
  const runbook = readText(rootDir, 'docs/release-runbook.md');

  for (const script of [
    'release:rollback-drill',
    'release:trust',
    'release:trust:strict',
    'release:store-status',
    'firefox:package',
    'cws:check',
  ]) {
    requireScript(result, pkg, script);
  }

  for (const command of [
    'npm run release:rollback-drill',
    'npm run release:trust',
    'npm run release:store-status',
    'npm run firefox:package',
  ]) {
    requireText(result, '.github/workflows/ci.yml', ci, command);
    requireText(result, 'docs/release-runbook.md', runbook, command);
  }

  requireText(result, 'docs/release-runbook.md', runbook, ':fetchStatus');
  requireText(result, 'docs/release-runbook.md', runbook, 'CWS_ACCESS_TOKEN');
}

function checkFirefoxArtifacts(rootDir, result) {
  const pkg = readJson(rootDir, 'package.json');
  const version = pkg.version;
  const artifactDir = join(rootDir, 'firefox-artifacts');
  const lintPath = join(artifactDir, 'web-ext-lint.json');

  if (!existsSync(lintPath)) {
    pushWarning(result, 'Firefox AMO artifact status skipped; run npm run firefox:package before release:store-status for package evidence');
    result.firefox = { status: 'skipped', reason: 'missing firefox-artifacts/web-ext-lint.json' };
    return;
  }

  const report = JSON.parse(readFileSync(lintPath, 'utf8'));
  const summary = summarizeFirefoxLint(report);
  if (summary.errors > 0) pushFailure(result, `Firefox web-ext lint has ${summary.errors} error(s)`);
  if (summary.notices > 0) pushFailure(result, `Firefox web-ext lint has ${summary.notices} notice(s)`);

  const names = new Set(readdirSync(artifactDir));
  const lowerNames = new Set([...names].map((name) => name.toLowerCase()));
  for (const expected of [
    `scriptvault-firefox-v${version}.zip`,
    `scriptvault-firefox-source-v${version}.zip`,
  ]) {
    if (!names.has(expected) && !lowerNames.has(expected.toLowerCase())) {
      pushFailure(result, `Firefox artifact ${expected} is missing`);
    }
  }

  result.firefox = {
    status: 'checked',
    lint: summary,
    package: `scriptvault-firefox-v${version}.zip`,
    sourcePackage: `scriptvault-firefox-source-v${version}.zip`,
  };
}

async function fetchJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await response.text();
  let json = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch (_) {
    json = null;
  }
  return { ok: response.ok, status: response.status, statusText: response.statusText, json, body };
}

async function checkCwsStatus(rootDir, options, result) {
  const pkg = readJson(rootDir, 'package.json');
  const readme = readText(rootDir, 'README.md');
  const env = options.env || process.env;
  const itemId = !isPlaceholder(env.EXTENSION_ID) ? env.EXTENSION_ID : extractReadmeCwsItemId(readme);
  const publisherId = !isPlaceholder(env.PUBLISHER_ID) ? env.PUBLISHER_ID : '';
  const token = env.CWS_ACCESS_TOKEN || env.GOOGLE_OAUTH_ACCESS_TOKEN || '';
  const requireLive = Boolean(options.requireLive);

  if (!itemId || !CWS_ID_RE.test(itemId)) {
    pushFailure(result, 'Could not determine a 32-character Chrome Web Store item ID');
    result.cws = { status: 'failed' };
    return;
  }

  if (!publisherId || !token) {
    const reason = 'missing PUBLISHER_ID and/or CWS_ACCESS_TOKEN';
    if (requireLive) pushFailure(result, `CWS fetchStatus live check required but ${reason}`);
    else pushWarning(result, `CWS fetchStatus live check skipped; set PUBLISHER_ID and CWS_ACCESS_TOKEN to query the CWS API v2 status endpoint`);
    result.cws = { status: 'skipped', itemId, reason };
    return;
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    pushFailure(result, 'global fetch is unavailable; Node 20+ is required for CWS status checks');
    result.cws = { status: 'failed', itemId };
    return;
  }

  const url = buildCwsFetchStatusUrl(publisherId, itemId);
  const response = await fetchJson(url, token, fetchImpl);
  if (!response.ok) {
    pushFailure(result, `CWS fetchStatus failed: HTTP ${response.status} ${response.statusText || ''}`.trim());
    result.cws = { status: 'failed', itemId, endpoint: url };
    return;
  }

  const status = response.json || {};
  if (status.itemId && status.itemId !== itemId) {
    pushFailure(result, `CWS fetchStatus returned itemId ${status.itemId}, expected ${itemId}`);
  }
  if (status.takenDown === true) pushFailure(result, 'CWS item is marked takenDown');
  if (status.warned === true) pushWarning(result, 'CWS item is marked warned');

  const publishedVersion = status.publishedItemRevisionStatus?.distributionChannels?.[0]?.crxVersion || null;
  const submittedVersion = status.submittedItemRevisionStatus?.distributionChannels?.[0]?.crxVersion || null;
  if (publishedVersion && publishedVersion !== pkg.version) {
    pushWarning(result, `CWS published version is ${publishedVersion}; local package is ${pkg.version}`);
  }
  if (submittedVersion && submittedVersion !== pkg.version) {
    pushWarning(result, `CWS submitted version is ${submittedVersion}; local package is ${pkg.version}`);
  }

  result.cws = {
    status: 'checked',
    itemId,
    endpoint: url,
    publishedVersion,
    submittedVersion,
    lastAsyncUploadState: status.lastAsyncUploadState || null,
    takenDown: status.takenDown === true,
    warned: status.warned === true,
  };
}

export async function runChecks(options = {}) {
  const rootDir = options.rootDir || defaultRoot;
  const result = {
    ok: true,
    failures: [],
    warnings: [],
    cws: null,
    firefox: null,
  };

  checkReleaseWiring(rootDir, result);
  if (options.skipFirefoxArtifacts) {
    result.firefox = { status: 'skipped', reason: 'disabled by caller' };
  } else {
    checkFirefoxArtifacts(rootDir, result);
  }
  await checkCwsStatus(rootDir, options, result);
  result.ok = result.failures.length === 0;
  return result;
}

function parseArgs(argv) {
  const options = {
    rootDir: defaultRoot,
    requireLive: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') options.rootDir = resolve(argv[++i]);
    else if (arg === '--require-live') options.requireLive = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await runChecks(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log('Release store status check passed.');
    if (result.cws) console.log(`CWS status: ${result.cws.status}`);
    if (result.firefox) console.log(`Firefox status: ${result.firefox.status}`);
    if (result.warnings.length > 0) {
      console.log('Warnings:');
      for (const warning of result.warnings) console.log(`- ${warning}`);
    }
  } else {
    console.error('Release store status check failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    if (result.warnings.length > 0) {
      console.error('Warnings:');
      for (const warning of result.warnings) console.error(`- ${warning}`);
    }
  }

  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    console.error(`[check-store-status] ${err.message || err}`);
    process.exitCode = 2;
  });
}
