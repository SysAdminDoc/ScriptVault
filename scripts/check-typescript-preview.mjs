#!/usr/bin/env node

/**
 * TypeScript preview compatibility gate.
 *
 * Runs the TypeScript @next (preview) compiler against the project to detect
 * incompatibilities before they land in a stable release. Records known
 * diagnostics so the gate fails only on NEW unexpected issues.
 *
 * Run: node scripts/check-typescript-preview.mjs [--report]
 *   --report: print diagnostics without failing
 *   default: fail on unexpected new diagnostics beyond the known set
 *
 * This is non-release-blocking — it runs as a report/advisory step, not a gate
 * that blocks CI. Use it to get early signal on the next TypeScript release.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');

const KNOWN_DIAGNOSTICS = [
  // Add known TS preview issues here as strings like:
  // 'src/modules/foo.ts(42,5): error TS1234: Some known issue'
  // These are expected and won't cause the gate to fail.
];

function main() {
  const reportMode = process.argv.includes('--report');
  const currentVersion = getCurrentVersion();

  let previewVersion;
  try {
    previewVersion = getPreviewVersion();
  } catch (e) {
    if (reportMode) {
      console.log('TypeScript preview not installed. Run: npx -p typescript@next tsc --version');
      return;
    }
    console.log('TypeScript preview check skipped (typescript@next not available locally).');
    console.log(`Current TypeScript: ${currentVersion}`);
    return;
  }

  console.log(`Current TypeScript: ${currentVersion}`);
  console.log(`Preview TypeScript: ${previewVersion}`);
  console.log('');

  const diagnostics = runPreviewTypecheck();

  if (diagnostics.length === 0) {
    console.log('TypeScript preview: 0 diagnostics. Fully compatible.');
    return;
  }

  const known = new Set(KNOWN_DIAGNOSTICS);
  const unexpected = diagnostics.filter(d => !known.has(d));
  const recognized = diagnostics.filter(d => known.has(d));

  if (reportMode) {
    console.log(`TypeScript preview report: ${diagnostics.length} diagnostic(s)`);
    if (recognized.length) {
      console.log(`\nKnown (${recognized.length}):`);
      recognized.forEach(d => console.log(`  ${d}`));
    }
    if (unexpected.length) {
      console.log(`\nNew (${unexpected.length}):`);
      unexpected.forEach(d => console.log(`  ${d}`));
    }
    return;
  }

  if (unexpected.length > 0) {
    console.error(`TypeScript preview: ${unexpected.length} NEW diagnostic(s) (${recognized.length} known)\n`);
    unexpected.forEach(d => console.error(`  ${d}`));
    console.error('\nAdd expected diagnostics to KNOWN_DIAGNOSTICS in this script, or fix the source.');
    process.exit(1);
  }

  console.log(`TypeScript preview: ${recognized.length} known diagnostic(s), 0 new. OK.`);
}

function getCurrentVersion() {
  try {
    return execFileSync('node', ['-e', "console.log(require('typescript').version)"], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getPreviewVersion() {
  const result = execFileSync('npx', ['-p', 'typescript@next', 'tsc', '--version'], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  const match = result.match(/Version\s+([\d.]+[-\w.]*)/);
  return match ? match[1] : result;
}

function runPreviewTypecheck() {
  try {
    execFileSync('npx', ['-p', 'typescript@next', 'tsc', '--noEmit'], {
      cwd: ROOT, encoding: 'utf8', timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return [];
  } catch (e) {
    const output = (e.stdout || '') + '\n' + (e.stderr || '');
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes(': error TS') || line.includes(': warning TS'));
  }
}

main();
