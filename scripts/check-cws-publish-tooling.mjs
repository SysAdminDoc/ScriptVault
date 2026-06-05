#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const failures = [];
const warnings = [];

function readText(path) {
  return readFileSync(join(projectRoot, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function requirePattern(label, value, pattern) {
  if (!pattern.test(value)) fail(`${label} did not match ${pattern}`);
}

function parseSemver(version) {
  const match = String(version || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: match[0],
  };
}

function compareSemver(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  return 0;
}

function minimumVersionFromRange(range) {
  const match = String(range || '').match(/>=\s*(\d+\.\d+\.\d+)/);
  return match ? parseSemver(match[1]) : null;
}

const pkg = readJson('package.json');
const cliRange = pkg.devDependencies?.['chrome-webstore-upload-cli'];
if (!cliRange) {
  fail('package.json is missing devDependency chrome-webstore-upload-cli');
} else if (!/(^|[^\d])4\./.test(cliRange)) {
  fail(`package.json pins chrome-webstore-upload-cli to ${cliRange}, expected v4.x for CWS API v2`);
}

const projectNodeFloor = minimumVersionFromRange(pkg.engines?.node);
const currentNodeVersion = parseSemver(process.versions.node);
if (!projectNodeFloor || !currentNodeVersion) {
  fail(`Unable to parse project Node engine (${pkg.engines?.node || '<missing>'}) or current Node ${process.versions.node}`);
} else if (compareSemver(currentNodeVersion, projectNodeFloor) < 0) {
  fail(`Node ${process.versions.node} is too old; ScriptVault requires ${pkg.engines.node}`);
}

const cliPackagePath = join(projectRoot, 'node_modules', 'chrome-webstore-upload-cli', 'package.json');
let cliBinPath = '';
if (!existsSync(cliPackagePath)) {
  fail('node_modules/chrome-webstore-upload-cli is missing; run npm ci before npm run cws:check');
} else {
  const cliPkg = JSON.parse(readFileSync(cliPackagePath, 'utf8'));
  const bin = typeof cliPkg.bin === 'string' ? cliPkg.bin : cliPkg.bin?.['chrome-webstore-upload'];
  if (bin) cliBinPath = join(projectRoot, 'node_modules', 'chrome-webstore-upload-cli', bin);
  const cliMajor = Number(String(cliPkg.version || '').split('.')[0]);
  if (cliMajor !== 4) {
    fail(`installed chrome-webstore-upload-cli is ${cliPkg.version || '<unknown>'}, expected v4.x`);
  }
  if (cliPkg.engines?.node && projectNodeFloor) {
    const cliNodeFloor = minimumVersionFromRange(cliPkg.engines.node);
    if (cliNodeFloor && compareSemver(projectNodeFloor, cliNodeFloor) < 0) {
      warn(`installed CLI engine is ${cliPkg.engines.node}; verify ScriptVault engine ${pkg.engines.node} still satisfies it`);
    }
  }
}

let help = '';
if (cliBinPath) {
  try {
    help = execFileSync(process.execPath, [cliBinPath, '--help'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    fail(`chrome-webstore-upload --help failed: ${e.stderr || e.message || e}`);
  }
}
if (help) {
  requirePattern('chrome-webstore-upload help', help, /upload,\s*publish/);
  requirePattern('chrome-webstore-upload help', help, /PUBLISHER_ID/);
  for (const removedFlag of ['--client-id', '--client-secret', '--refresh-token', '--auto-publish']) {
    if (help.includes(removedFlag)) fail(`CLI help still exposes removed v3 flag ${removedFlag}`);
  }
}

const publish = readText('publish.sh');
for (const removedFlag of ['--client-id', '--client-secret', '--refresh-token', '--auto-publish']) {
  if (publish.includes(removedFlag)) fail(`publish.sh still references removed CLI flag ${removedFlag}`);
}
requirePattern('publish.sh', publish, /chrome-webstore-upload upload[\s\S]*--source "\$ZIP_NAME"/);
requirePattern('publish.sh', publish, /chrome-webstore-upload upload[\s\S]*--publisher-id "\$PUBLISHER_ID"/);
requirePattern('publish.sh', publish, /chrome-webstore-upload publish[\s\S]*--publisher-id "\$PUBLISHER_ID"/);

const publishCommand = publish.match(/chrome-webstore-upload publish\s*\\([\s\S]*?)(?:\n\n|# |$)/);
if (publishCommand?.[1]?.includes('--source')) {
  fail('publish.sh passes --source to the publish command; CLI v4 only allows --source on upload');
}

const setup = readText('cws-setup.sh');
for (const name of ['EXTENSION_ID', 'PUBLISHER_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN']) {
  requirePattern('cws-setup.sh', setup, new RegExp(`^${name}=`, 'm'));
}
for (const staleName of ['CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN']) {
  if (setup.includes(staleName) || publish.includes(staleName)) {
    fail(`CWS tooling still references stale env name ${staleName}`);
  }
}

const ci = readText('.github/workflows/ci.yml');
const auditStep = ci.match(/- name: npm audit \(high\+ severity\)[\s\S]*?(?=\n      - name: |\n$)/);
if (!auditStep) {
  fail('.github/workflows/ci.yml is missing the high+ npm audit step');
} else if (/continue-on-error:\s*true/.test(auditStep[0])) {
  fail('.github/workflows/ci.yml marks the high+ npm audit step continue-on-error');
}
if (!ci.includes('npm run cws:check')) {
  fail('.github/workflows/ci.yml does not run npm run cws:check');
}
if (!ci.includes('npm run release:check')) {
  fail('.github/workflows/ci.yml does not run npm run release:check');
}

if (failures.length > 0) {
  console.error('CWS publish tooling check failed:');
  for (const item of failures) console.error(`- ${item}`);
  if (warnings.length > 0) {
    console.error('Warnings:');
    for (const item of warnings) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log('CWS publish tooling check passed.');
if (warnings.length > 0) {
  console.log('Warnings:');
  for (const item of warnings) console.log(`- ${item}`);
}
