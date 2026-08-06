#!/usr/bin/env node
// Fail the build when a version that CHANGELOG.md describes as released has no
// matching git tag.
//
// Why this exists: `check-release-artifacts.mjs` only ever looks at the CURRENT
// manifest version, and downgrades a missing tag to a warning so that a release
// can be built and verified before it is tagged. That is the right behaviour for
// one version in flight — but it means a version can be changelogged, superseded
// by the next bump, and never tagged at all, with every gate still green. That
// is exactly what happened: v3.23.0, v3.23.1 and v3.24.0 were all changelogged
// and shipped to `main` while the newest tag stayed at v3.22.0, so four months of
// security fixes reached no user and nothing failed.
//
// The rule here is narrow: exactly ONE version may be untagged — the one named
// in manifest.json, which is the release currently being prepared. Every older
// changelogged version must carry a tag, or be named in UNTAGGED_LEGACY with a
// reason.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Versions changelogged before this gate existed that were never tagged. This
// list is closed: it records history, it is not a place to park new releases.
export const UNTAGGED_LEGACY = new Map([
  ['2.1.8', 'changelogged 2026-04 during the v2 line; never tagged'],
  ['2.1.9', 'changelogged 2026-04 during the v2 line; never tagged'],
  ['2.3.2', 'changelogged 2026-04 during the v2 line; never tagged'],
  ['2.3.3', 'changelogged 2026-04 during the v2 line; never tagged'],
  ['3.12.0', 'changelogged 2026-06 before the release-tag discipline existed'],
  ['3.13.0', 'changelogged 2026-06 before the release-tag discipline existed'],
  ['3.14.0', 'changelogged 2026-06 before the release-tag discipline existed'],
  ['3.18.0', 'changelogged 2026-07 before the release-tag discipline existed'],
  ['3.18.1', 'changelogged 2026-07 before the release-tag discipline existed'],
  ['3.18.2', 'changelogged 2026-07 before the release-tag discipline existed'],
  ['3.20.0', 'changelogged 2026-07 before the release-tag discipline existed'],
]);

const VERSION_HEADING = /^##\s+\[v?(\d+\.\d+\.\d+)\]/gm;

export function parseChangelogVersions(changelog) {
  const versions = [];
  for (const match of String(changelog).matchAll(VERSION_HEADING)) {
    if (!versions.includes(match[1])) versions.push(match[1]);
  }
  return versions;
}

export function findUntaggedReleases({
  changelogVersions,
  tags,
  currentVersion,
  legacy = UNTAGGED_LEGACY,
}) {
  const tagged = new Set(tags);
  const failures = [];
  const notes = [];

  for (const version of changelogVersions) {
    if (tagged.has(`v${version}`)) continue;
    if (version === currentVersion) {
      notes.push(`${version} is the version in flight (manifest.json); tag it as part of publishing`);
      continue;
    }
    if (legacy.has(version)) {
      notes.push(`${version} is a recorded legacy gap — ${legacy.get(version)}`);
      continue;
    }
    failures.push(
      `CHANGELOG.md documents ${version} as released but git tag v${version} does not exist — `
      + 'it was superseded before it was ever tagged, so nobody received it',
    );
  }

  return { failures, notes };
}

export function readTags(root = projectRoot, execFileSyncImpl = execFileSync) {
  const out = execFileSyncImpl('git', ['tag', '--list'], { cwd: root, encoding: 'utf8' });
  return out.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function main() {
  const changelog = readFileSync(join(projectRoot, 'CHANGELOG.md'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(projectRoot, 'manifest.json'), 'utf8'));
  const changelogVersions = parseChangelogVersions(changelog);

  if (changelogVersions.length === 0) {
    console.error('[release-tags] FAIL — CHANGELOG.md has no parseable version sections.');
    process.exit(1);
  }

  const { failures, notes } = findUntaggedReleases({
    changelogVersions,
    tags: readTags(),
    currentVersion: manifest.version,
  });

  if (failures.length > 0) {
    console.error('[release-tags] FAIL — a changelogged release was never tagged:');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('Create the tag at the commit that carried that manifest version, then push it.');
    process.exit(1);
  }

  for (const note of notes) console.log(`[release-tags] note — ${note}`);
  console.log(`[release-tags] ok — ${changelogVersions.length} changelogged version(s) checked against git tags.`);
}

if (process.argv[1]?.endsWith('check-release-tags.mjs')) {
  main();
}
