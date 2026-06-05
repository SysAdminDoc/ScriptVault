import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = readFileSync(resolve(process.cwd(), '.github/dependabot.yml'), 'utf8');

function ecosystemBlock(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = config.match(new RegExp(`- package-ecosystem: "${escaped}"[\\s\\S]*?(?=\\n  - package-ecosystem:|\\n*$)`));
  if (!match) {
    throw new Error(`Missing Dependabot ecosystem block: ${name}`);
  }
  return match[0];
}

describe('Dependabot configuration', () => {
  it('enables version 2 updates for npm and GitHub Actions', () => {
    expect(config).toMatch(/^version: 2$/m);
    expect(ecosystemBlock('npm')).toContain('directory: "/"');
    expect(ecosystemBlock('github-actions')).toContain('directory: "/"');
  });

  it('schedules weekly npm and GitHub Actions checks with bounded PR volume', () => {
    for (const block of [ecosystemBlock('npm'), ecosystemBlock('github-actions')]) {
      expect(block).toContain('interval: "weekly"');
      expect(block).toMatch(/open-pull-requests-limit: [1-9]/);
      expect(block).toContain('timezone: "America/New_York"');
    }
  });

  it('groups low-risk npm dev tooling updates while leaving majors individual', () => {
    const npm = ecosystemBlock('npm');

    expect(npm).toContain('test-tooling:');
    expect(npm).toContain('browser-test-tooling:');
    expect(npm).toContain('extension-release-tooling:');
    expect(npm).toContain('build-tooling:');
    expect(npm).toContain('editor-runtime:');
    expect(npm).toContain('dependency-type: "development"');
    expect(npm).toContain('update-types:');
    expect(npm).toContain('- "minor"');
    expect(npm).toContain('- "patch"');
    expect(npm).not.toContain('- "major"');
  });

  it('groups GitHub Actions minor and patch updates for pinned action maintenance', () => {
    const actions = ecosystemBlock('github-actions');

    expect(actions).toContain('github-actions-minor-patch:');
    expect(actions).toContain('- "*"');
    expect(actions).toContain('- "minor"');
    expect(actions).toContain('- "patch"');
    expect(actions).not.toContain('- "major"');
  });
});
