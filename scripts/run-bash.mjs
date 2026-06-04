#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-bash.mjs <script> [...args]');
  process.exit(2);
}

const windowsBashCandidates = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
  'C:\\msys64\\usr\\bin\\bash.exe',
];

const posixBashCandidates = [
  'bash',
  '/usr/bin/bash',
  '/bin/bash',
];

const candidates = [
  process.env.BASH_PATH,
  process.env.SHELL && /bash(?:\.exe)?$/i.test(process.env.SHELL) ? process.env.SHELL : null,
  ...(process.platform === 'win32' ? windowsBashCandidates : posixBashCandidates),
  ...(process.platform === 'win32' ? posixBashCandidates : []),
].filter(Boolean);

function canUse(command) {
  if (/[/\\]/.test(command) && !existsSync(command)) return false;
  const probe = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

const bash = candidates.find(canUse);
if (!bash) {
  console.error('Unable to find bash. Install Git Bash or set BASH_PATH to a bash executable.');
  process.exit(127);
}

const result = spawnSync(bash, args, { stdio: 'inherit', env: process.env });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
