#!/usr/bin/env node
// Discover and smoke-test installed Chromium derivatives with the same
// extension/runtime contract used by the dedicated Edge sideload gate.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const MANIFEST = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8'));
const VERSION = MANIFEST.version;
const ARTIFACT_DIR = resolve(ROOT, 'chromium-derivative-artifacts');
const SUMMARY_PATH = resolve(ARTIFACT_DIR, `summary-${VERSION}.json`);
const cliArgs = new Set(process.argv.slice(2));

function compact(values) {
  return [...new Set(values.filter(Boolean))];
}

function windowsCandidates(...parts) {
  return compact(parts.map(([root, ...segments]) => join(process.env[root] || '', ...segments)));
}

const browsers = [
  {
    id: 'brave',
    name: 'Brave',
    env: 'SCRIPT_VAULT_BRAVE_PATH',
    scheme: 'brave',
    win: windowsCandidates(
      ['PROGRAMFILES', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
      ['PROGRAMFILES(X86)', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
      ['LOCALAPPDATA', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
    ),
    mac: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    linux: ['/usr/bin/brave-browser', '/usr/bin/brave-browser-stable', '/opt/brave.com/brave/brave-browser'],
  },
  {
    id: 'vivaldi',
    name: 'Vivaldi',
    env: 'SCRIPT_VAULT_VIVALDI_PATH',
    scheme: 'vivaldi',
    win: windowsCandidates(
      ['LOCALAPPDATA', 'Vivaldi', 'Application', 'vivaldi.exe'],
      ['PROGRAMFILES', 'Vivaldi', 'Application', 'vivaldi.exe'],
      ['PROGRAMFILES(X86)', 'Vivaldi', 'Application', 'vivaldi.exe'],
    ),
    mac: ['/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'],
    linux: ['/usr/bin/vivaldi', '/usr/bin/vivaldi-stable', '/opt/vivaldi/vivaldi'],
  },
  {
    id: 'opera',
    name: 'Opera',
    env: 'SCRIPT_VAULT_OPERA_PATH',
    scheme: 'opera',
    win: windowsCandidates(
      ['LOCALAPPDATA', 'Programs', 'Opera', 'opera.exe'],
      ['LOCALAPPDATA', 'Programs', 'Opera GX', 'opera.exe'],
      ['PROGRAMFILES', 'Opera', 'opera.exe'],
    ),
    mac: ['/Applications/Opera.app/Contents/MacOS/Opera', '/Applications/Opera GX.app/Contents/MacOS/Opera'],
    linux: ['/usr/bin/opera', '/usr/bin/opera-stable'],
  },
  {
    id: 'arc',
    name: 'Arc',
    env: 'SCRIPT_VAULT_ARC_PATH',
    scheme: 'arc',
    win: windowsCandidates(
      ['LOCALAPPDATA', 'Programs', 'Arc', 'Arc.exe'],
      ['LOCALAPPDATA', 'Microsoft', 'WindowsApps', 'Arc.exe'],
    ),
    mac: ['/Applications/Arc.app/Contents/MacOS/Arc'],
    linux: [],
  },
];

function platformCandidates(browser) {
  const platformPaths = process.platform === 'win32'
    ? browser.win
    : process.platform === 'darwin'
      ? browser.mac
      : browser.linux;
  return compact([process.env[browser.env], ...platformPaths]);
}

function relativeEvidencePath(browserId) {
  return `chromium-derivative-artifacts/${browserId}-${VERSION}.json`;
}

async function writeSummary(summary) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}

function runBrowserSmoke(browser, executablePath) {
  const evidencePath = resolve(ROOT, relativeEvidencePath(browser.id));
  const passthroughArgs = ['--skip-build'];
  if (cliArgs.has('--headed')) passthroughArgs.push('--headed');
  if (cliArgs.has('--strict-console')) passthroughArgs.push('--strict-console');

  const result = spawnSync(process.execPath, ['scripts/smoke-edge-sideload.mjs', ...passthroughArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      SCRIPT_VAULT_EDGE_PATH: executablePath,
      SCRIPT_VAULT_SMOKE_BROWSER_ID: browser.id,
      SCRIPT_VAULT_SMOKE_BROWSER_NAME: browser.name,
      SCRIPT_VAULT_SMOKE_INTERNAL_SCHEME: browser.scheme,
      SCRIPT_VAULT_SMOKE_EVIDENCE_PATH: evidencePath,
      SCRIPT_VAULT_EDGE_SMOKE_TIMEOUT_MS: process.env.SCRIPT_VAULT_DERIVATIVE_SMOKE_TIMEOUT_MS
        || process.env.SCRIPT_VAULT_EDGE_SMOKE_TIMEOUT_MS
        || '',
    },
  });

  let evidence = null;
  if (existsSync(evidencePath)) {
    try {
      evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    } catch {
      evidence = null;
    }
  }
  return {
    id: browser.id,
    name: browser.name,
    status: result.status === 0 && evidence?.status === 'passed' ? 'passed' : 'failed',
    executablePath,
    evidence: relativeEvidencePath(browser.id),
    browserVersion: evidence?.browserVersion || evidence?.edgeVersion || null,
    failure: evidence?.failure || result.error?.message || (result.status === 0 ? null : `smoke process exited ${result.status}`),
  };
}

async function main() {
  execFileSync(process.execPath, ['scripts/build-edge.mjs', '--check'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  const results = [];
  for (const browser of browsers) {
    const candidates = platformCandidates(browser);
    const executablePath = candidates.find(candidate => existsSync(candidate));
    const configuredPath = process.env[browser.env] || '';
    if (!executablePath) {
      results.push({
        id: browser.id,
        name: browser.name,
        status: configuredPath ? 'failed' : 'not-installed',
        executablePath: configuredPath || null,
        evidence: null,
        browserVersion: null,
        failure: configuredPath ? `${browser.env} does not point to an existing executable` : null,
      });
      continue;
    }
    results.push(runBrowserSmoke(browser, executablePath));
  }

  const attempted = results.filter(result => result.status !== 'not-installed');
  const failed = results.filter(result => result.status === 'failed');
  const passed = results.filter(result => result.status === 'passed');
  const status = failed.length > 0 ? 'failed' : passed.length > 0 ? 'passed' : 'not-run';
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    version: VERSION,
    status,
    attempted: attempted.length,
    passed: passed.length,
    browsers: results,
  };
  await writeSummary(summary);

  if (status === 'failed') {
    throw new Error(`Chromium derivative smoke failed for ${failed.map(result => result.name).join(', ')}`);
  }
  if (status === 'not-run') {
    console.log('No supported Chromium derivative executable was discovered.');
  } else {
    console.log(`Chromium derivative smoke passed for ${passed.map(result => result.name).join(', ')}.`);
  }
  console.log(`Evidence: ${SUMMARY_PATH}`);
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
