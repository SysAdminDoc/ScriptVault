#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FULL_SHA = /^[a-f0-9]{40}$/;
const VERSION_COMMENT = /^v\d+(?:\.\d+){0,2}$/;

function workflowFiles(rootDir) {
  const workflowDir = resolve(rootDir, '.github/workflows');
  if (!existsSync(workflowDir)) return [];

  return readdirSync(workflowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => resolve(workflowDir, entry.name))
    .sort();
}

export function analyzeGitHubActionPins({ rootDir = process.cwd() } = {}) {
  const errors = [];
  const refs = [];

  for (const file of workflowFiles(rootDir)) {
    const relFile = file.replace(resolve(rootDir), '').replace(/^[/\\]/, '').replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);

    lines.forEach((line, index) => {
      const match = line.match(/^\s*(?:-\s*)?uses:\s*([^#\s]+)(?:\s*#\s*(\S+))?/);
      if (!match) return;

      const spec = match[1];
      const versionComment = match[2] || '';
      if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('docker://')) {
        return;
      }

      const atIndex = spec.lastIndexOf('@');
      if (atIndex === -1) {
        errors.push(`${relFile}:${index + 1} action reference is missing @ref: ${spec}`);
        return;
      }

      const action = spec.slice(0, atIndex);
      const ref = spec.slice(atIndex + 1);
      refs.push({ file: relFile, line: index + 1, action, ref, versionComment });

      if (!FULL_SHA.test(ref)) {
        errors.push(`${relFile}:${index + 1} ${action} is not pinned to a full 40-character SHA (${ref})`);
      }
      if (!VERSION_COMMENT.test(versionComment)) {
        errors.push(`${relFile}:${index + 1} ${action} is missing a same-line version comment like "# v4" for Dependabot/update review`);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    refs,
  };
}

export function formatGitHubActionPinReport(report) {
  if (report.ok) {
    return `[actions-pins] OK: ${report.refs.length} GitHub Action reference(s) pinned to full SHAs.`;
  }

  return [
    '[actions-pins] GitHub Actions pin check failed.',
    ...report.errors.map((error) => `- ${error}`),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = analyzeGitHubActionPins();
  console.log(formatGitHubActionPinReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
