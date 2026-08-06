import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  UNTAGGED_LEGACY,
  parseChangelogVersions,
  findUntaggedReleases,
} from '../scripts/check-release-tags.mjs';

const ROOT = process.cwd();
const changelog = readFileSync(resolve(ROOT, 'CHANGELOG.md'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

describe('release tag drift gate', () => {
  it('parses every changelog version heading, with or without the v prefix', () => {
    const versions = parseChangelogVersions([
      '# Changelog',
      '## [Unreleased]',
      '## [v3.24.0] — Execution hardening (2026-08-06)',
      '## [3.23.1]',
      '## [v3.23.0]',
      '## [v3.23.0]', // duplicate heading must not double-count
    ].join('\n'));
    expect(versions).toEqual(['3.24.0', '3.23.1', '3.23.0']);
  });

  // The regression this gate exists for: v3.23.0, v3.23.1 and v3.24.0 were all
  // changelogged and merged while the newest tag stayed at v3.22.0. Every gate
  // was green because check-release-artifacts.mjs only inspects the current
  // manifest version and downgrades its missing tag to a warning.
  it('fails a changelogged version that was superseded before it was ever tagged', () => {
    const { failures } = findUntaggedReleases({
      changelogVersions: ['3.24.0', '3.23.1', '3.23.0', '3.22.0'],
      tags: ['v3.22.0'],
      currentVersion: '3.24.0',
      legacy: new Map(),
    });
    expect(failures).toHaveLength(2);
    expect(failures.join('\n')).toContain('v3.23.1 does not exist');
    expect(failures.join('\n')).toContain('v3.23.0 does not exist');
  });

  it('allows exactly one untagged version — the one in flight in manifest.json', () => {
    const { failures, notes } = findUntaggedReleases({
      changelogVersions: ['3.25.0', '3.24.0'],
      tags: ['v3.24.0'],
      currentVersion: '3.25.0',
      legacy: new Map(),
    });
    expect(failures).toEqual([]);
    expect(notes.join('\n')).toContain('3.25.0 is the version in flight');
  });

  it('accepts a recorded legacy gap but still names it', () => {
    const { failures, notes } = findUntaggedReleases({
      changelogVersions: ['3.20.0'],
      tags: [],
      currentVersion: '3.24.0',
      legacy: new Map([['3.20.0', 'recorded reason']]),
    });
    expect(failures).toEqual([]);
    expect(notes[0]).toContain('recorded reason');
  });

  it('every legacy entry carries a reason, so the list cannot become a dumping ground', () => {
    for (const [version, reason] of UNTAGGED_LEGACY) {
      expect(version, 'legacy key must be a bare version').toMatch(/^\d+\.\d+\.\d+$/);
      expect(String(reason).trim().length, `${version} needs a reason`).toBeGreaterThan(0);
    }
  });

  it('the shipped changelog and tag set pass the gate', async () => {
    const { execFileSync } = await import('node:child_process');
    const tags = execFileSync('git', ['tag', '--list'], { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const { failures } = findUntaggedReleases({
      changelogVersions: parseChangelogVersions(changelog),
      tags,
      currentVersion: manifest.version,
    });
    expect(failures).toEqual([]);
  });

  it('runs as part of npm run check, not only at release time', () => {
    expect(packageJson.scripts.check).toContain('release:tags:check');
    expect(packageJson.scripts['release:tags:check']).toBe('node scripts/check-release-tags.mjs');
  });
});
