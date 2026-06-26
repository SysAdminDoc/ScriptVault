import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('Trusted Types author documentation', () => {
  it('documents USER_SCRIPT and MAIN-world Trusted Types behavior in README', () => {
    const readme = read('README.md');

    expect(readme).toContain('#### Trusted Types and MAIN-world DOM Writes');
    expect(readme).toContain('Most ScriptVault scripts run in the browser `USER_SCRIPT` world.');
    expect(readme).toContain('If a script intentionally switches to MAIN/page context or uses `unsafeWindow`');
    expect(readme).toContain('Prefer `textContent`,');
    expect(readme).toContain('`GM_addElement` with attributes');
    expect(readme).toContain('`TrustedHTML` object');
  });

  it('surfaces the same guidance in the dashboard Help tab', () => {
    const dashboard = read('pages/dashboard.html');

    expect(dashboard).toContain('Trusted Types And MAIN-World Scripts');
    expect(dashboard).toContain('data-i18n="helpTrustedTypesDefaultDescription">ScriptVault runs scripts in USER_SCRIPT world');
    expect(dashboard).toContain('data-i18n="helpTrustedTypesMainDescription">Scripts that use page context or unsafeWindow');
    expect(dashboard).toContain('data-i18n="helpTrustedTypesDomDescription">Prefer textContent, append, createElement, and GM_addElement with attributes.');
    expect(dashboard).toContain('data-i18n="helpTrustedTypesHtmlLabel">TrustedHTML:</strong>');
  });

  it('keeps the cycle documentation-only without adding a runtime policy shim', () => {
    const wrapper = read('src/background/wrapper-builder.ts');
    const core = read('src/background/core.ts');

    expect(wrapper).not.toMatch(/trustedTypes\s*\.\s*createPolicy/);
    expect(core).not.toMatch(/trustedTypes\s*\.\s*createPolicy/);
  });
});
