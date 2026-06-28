#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

export function workflowFiles(rootDir = process.cwd()) {
  const workflowDir = resolve(rootDir, '.github/workflows');
  if (!existsSync(workflowDir)) return [];
  if (!statSync(workflowDir).isDirectory()) return [workflowDir];
  return collectFiles(workflowDir).map((path) => normalizePath(relative(rootDir, path)));
}

export function analyzeNoGitHubActions({ rootDir = process.cwd() } = {}) {
  const files = workflowFiles(rootDir);
  return {
    ok: files.length === 0,
    files,
    errors: files.map((file) => `${file} is forbidden; ScriptVault releases are built and verified locally`),
  };
}

export function formatNoGitHubActionsReport(report) {
  if (report.ok) {
    return '[local-build-policy] OK: no GitHub Actions workflow files are present.';
  }

  return [
    '[local-build-policy] GitHub Actions workflows are not allowed.',
    ...report.errors.map((error) => `- ${error}`),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = analyzeNoGitHubActions();
  console.log(formatNoGitHubActionsReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
