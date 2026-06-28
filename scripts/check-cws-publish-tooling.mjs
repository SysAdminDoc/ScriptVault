#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const failures = [];
const warnings = [];
const CWS_CLI_PACKAGE_NAME = 'chrome-webstore-upload-cli';
const REQUIRED_CWS_CLI_VERSION = '4.0.0';
const REQUIRED_CWS_CLI_INTEGRITY = 'sha512-6MjMTLeGswORVNMS/Wa40s0HHWJdQG7MX1hVRzpg5RaqyjoFWp/tdqgHANTcwSPftT9HVOZOibKvd+k2XOvQCg==';

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
const packageLock = readJson('package-lock.json');
const cliRange = pkg.devDependencies?.[CWS_CLI_PACKAGE_NAME];
if (!cliRange) {
  fail(`package.json is missing devDependency ${CWS_CLI_PACKAGE_NAME}`);
} else if (cliRange !== REQUIRED_CWS_CLI_VERSION) {
  fail(`package.json pins ${CWS_CLI_PACKAGE_NAME} to ${cliRange}, expected exact ${REQUIRED_CWS_CLI_VERSION}`);
}

const lockRootRange = packageLock.packages?.['']?.devDependencies?.[CWS_CLI_PACKAGE_NAME];
if (lockRootRange !== REQUIRED_CWS_CLI_VERSION) {
  fail(`package-lock.json root pins ${CWS_CLI_PACKAGE_NAME} to ${lockRootRange || '<missing>'}, expected exact ${REQUIRED_CWS_CLI_VERSION}`);
}

const lockPackage = packageLock.packages?.[`node_modules/${CWS_CLI_PACKAGE_NAME}`];
if (!lockPackage) {
  fail(`package-lock.json is missing node_modules/${CWS_CLI_PACKAGE_NAME}`);
} else {
  if (lockPackage.version !== REQUIRED_CWS_CLI_VERSION) {
    fail(`package-lock.json resolves ${CWS_CLI_PACKAGE_NAME} ${lockPackage.version || '<missing>'}, expected ${REQUIRED_CWS_CLI_VERSION}`);
  }
  if (lockPackage.integrity !== REQUIRED_CWS_CLI_INTEGRITY) {
    fail(`package-lock.json integrity for ${CWS_CLI_PACKAGE_NAME} changed; review the package before updating REQUIRED_CWS_CLI_INTEGRITY`);
  }
}

const projectNodeFloor = minimumVersionFromRange(pkg.engines?.node);
const currentNodeVersion = parseSemver(process.versions.node);
if (!projectNodeFloor || !currentNodeVersion) {
  fail(`Unable to parse project Node engine (${pkg.engines?.node || '<missing>'}) or current Node ${process.versions.node}`);
} else if (compareSemver(currentNodeVersion, projectNodeFloor) < 0) {
  fail(`Node ${process.versions.node} is too old; ScriptVault requires ${pkg.engines.node}`);
}

const cliPackagePath = join(projectRoot, 'node_modules', CWS_CLI_PACKAGE_NAME, 'package.json');
let cliBinPath = '';
if (!existsSync(cliPackagePath)) {
  fail(`node_modules/${CWS_CLI_PACKAGE_NAME} is missing; run npm ci before npm run cws:check`);
} else {
  const cliPkg = JSON.parse(readFileSync(cliPackagePath, 'utf8'));
  const bin = typeof cliPkg.bin === 'string' ? cliPkg.bin : cliPkg.bin?.['chrome-webstore-upload'];
  if (bin) cliBinPath = join(projectRoot, 'node_modules', CWS_CLI_PACKAGE_NAME, bin);
  if (cliPkg.version !== REQUIRED_CWS_CLI_VERSION) {
    fail(`installed ${CWS_CLI_PACKAGE_NAME} is ${cliPkg.version || '<unknown>'}, expected ${REQUIRED_CWS_CLI_VERSION}`);
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
  requirePattern('chrome-webstore-upload help', help, /--deploy-percentage/);
  for (const removedFlag of ['--client-id', '--client-secret', '--refresh-token', '--auto-publish']) {
    if (help.includes(removedFlag)) fail(`CLI help still exposes removed v3 flag ${removedFlag}`);
  }
}

const publish = readText('publish.sh');
for (const removedFlag of ['--client-id', '--client-secret', '--refresh-token', '--auto-publish']) {
  if (publish.includes(removedFlag)) fail(`publish.sh still references removed CLI flag ${removedFlag}`);
}
requirePattern('publish.sh', publish, /CWS_DEPLOY_PERCENTAGE="\$\{CWS_DEPLOY_PERCENTAGE:-100\}"/);
requirePattern('publish.sh', publish, /chrome-webstore-upload upload[\s\S]*--source "\$ZIP_NAME"/);
requirePattern('publish.sh', publish, /chrome-webstore-upload upload[\s\S]*--publisher-id "\$PUBLISHER_ID"/);
requirePattern('publish.sh', publish, /chrome-webstore-upload publish[\s\S]*--publisher-id "\$PUBLISHER_ID"/);
requirePattern('publish.sh', publish, /chrome-webstore-upload publish[\s\S]*--deploy-percentage "\$CWS_DEPLOY_PERCENTAGE"/);

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

const cwsModule = existsSync(join(projectRoot, 'node_modules', 'chrome-webstore-upload', 'distribution', 'index.js'))
  ? readText('node_modules/chrome-webstore-upload/distribution/index.js')
  : '';
if (!cwsModule) {
  fail('node_modules/chrome-webstore-upload is missing; run npm ci before npm run cws:check');
} else {
  for (const needle of [
    'https://chromewebstore.googleapis.com',
    '/upload/v2/',
    '/v2/',
    ':upload',
    ':publish',
    ':fetchStatus',
    ':setPublishedDeployPercentage',
  ]) {
    if (!cwsModule.includes(needle)) fail(`installed chrome-webstore-upload module is missing CWS API v2 endpoint fragment ${needle}`);
  }
  for (const staleEndpoint of [
    'www.googleapis.com/upload/chromewebstore/v1.1',
    'www.googleapis.com/chromewebstore/v1.1',
  ]) {
    if (cwsModule.includes(staleEndpoint)) fail(`installed chrome-webstore-upload module still references stale endpoint ${staleEndpoint}`);
  }
}

const runbook = readText('docs/release-runbook.md');
for (const needle of [
  'POST https://chromewebstore.googleapis.com/upload/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:upload',
  'POST https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:publish',
  'POST https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:setPublishedDeployPercentage',
  'GET https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:fetchStatus',
  'CWS_DEPLOY_PERCENTAGE',
  'service account',
]) {
  if (!runbook.includes(needle)) fail(`docs/release-runbook.md is missing CWS API v2 contract text: ${needle}`);
}
for (const staleEndpoint of [
  'www.googleapis.com/upload/chromewebstore/v1.1',
  'www.googleapis.com/chromewebstore/v1.1',
]) {
  if (runbook.includes(staleEndpoint) || publish.includes(staleEndpoint) || setup.includes(staleEndpoint)) {
    fail(`active CWS release tooling still references stale endpoint ${staleEndpoint}`);
  }
}

const highAuditCommand = 'npm audit --audit-level=high --omit=optional';
if (!runbook.includes(highAuditCommand)) {
  fail(`docs/release-runbook.md is missing the high+ dependency audit gate: ${highAuditCommand}`);
}
if (!runbook.includes('npm run cws:check')) {
  fail('docs/release-runbook.md does not run npm run cws:check');
}
if (!runbook.includes('npm run release:check')) {
  fail('docs/release-runbook.md does not run npm run release:check');
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
