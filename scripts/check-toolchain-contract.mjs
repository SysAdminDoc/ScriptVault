#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NODE_VERSION = '24.16.0';
const NPM_VERSION = '11.13.0';
const NODE_ENGINE = `>=${NODE_VERSION}`;
const NPM_ENGINE = `>=${NPM_VERSION}`;
const PACKAGE_MANAGER = `npm@${NPM_VERSION}`;

function readText(path) {
  return readFileSync(path, 'utf8').trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertEqual(errors, label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${expected}, got ${actual || '<missing>'}`);
  }
}

function assertContains(errors, label, haystack, needle) {
  if (!haystack.includes(needle)) {
    errors.push(`${label}: missing ${needle}`);
  }
}

export function analyzeToolchainContract({ rootDir = process.cwd() } = {}) {
  const errors = [];
  const packageJsonPath = resolve(rootDir, 'package.json');
  const packageLockPath = resolve(rootDir, 'package-lock.json');
  const nodeVersionPath = resolve(rootDir, '.node-version');
  const nvmrcPath = resolve(rootDir, '.nvmrc');
  const npmrcPath = resolve(rootDir, '.npmrc');
  const ciPath = resolve(rootDir, '.github/workflows/ci.yml');
  const contributingPath = resolve(rootDir, 'CONTRIBUTING.md');
  const runbookPath = resolve(rootDir, 'docs/release-runbook.md');

  for (const path of [packageJsonPath, packageLockPath, nodeVersionPath, nvmrcPath, npmrcPath, ciPath]) {
    if (!existsSync(path)) {
      errors.push(`Missing required toolchain file: ${path}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const packageJson = readJson(packageJsonPath);
  const packageLock = readJson(packageLockPath);
  const rootPackage = packageLock.packages?.[''] || {};
  const ci = readText(ciPath);
  const npmrc = readText(npmrcPath);
  const contributing = existsSync(contributingPath) ? readText(contributingPath) : '';
  const runbook = existsSync(runbookPath) ? readText(runbookPath) : '';

  assertEqual(errors, '.node-version', readText(nodeVersionPath), NODE_VERSION);
  assertEqual(errors, '.nvmrc', readText(nvmrcPath), NODE_VERSION);
  assertEqual(errors, 'package.json packageManager', packageJson.packageManager, PACKAGE_MANAGER);
  assertEqual(errors, 'package.json engines.node', packageJson.engines?.node, NODE_ENGINE);
  assertEqual(errors, 'package.json engines.npm', packageJson.engines?.npm, NPM_ENGINE);
  assertEqual(errors, 'package-lock engines.node', rootPackage.engines?.node, NODE_ENGINE);
  assertEqual(errors, 'package-lock engines.npm', rootPackage.engines?.npm, NPM_ENGINE);
  assertContains(errors, '.npmrc', npmrc, 'engine-strict=true');
  assertContains(errors, '.github/workflows/ci.yml', ci, 'node-version-file: .node-version');
  assertContains(errors, 'CONTRIBUTING.md', contributing, `Node.js version in \`.node-version\` (currently ${NODE_VERSION})`);
  assertContains(errors, 'docs/release-runbook.md', runbook, `Node ${NODE_VERSION}+ / npm ${NPM_VERSION}+`);

  return {
    ok: errors.length === 0,
    errors,
    nodeVersion: NODE_VERSION,
    npmVersion: NPM_VERSION,
  };
}

export function formatToolchainReport(report) {
  if (report.ok) {
    return `[toolchain] OK: Node ${report.nodeVersion}+ and npm ${report.npmVersion}+ contract is aligned.`;
  }

  return [
    '[toolchain] Contract check failed.',
    ...report.errors.map((error) => `- ${error}`),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = analyzeToolchainContract();
  console.log(formatToolchainReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
