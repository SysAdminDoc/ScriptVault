// Tests for the install-source classification + trust badges slice.
// Three surfaces:
//   1. classifyInstallSource(url) returns stable shapes for known registries.
//   2. installFromCode persists script.installSource and flags
//      sourceIdentityChanged when an update routes through a different
//      registry.
//   3. Dashboard renders the trust badge + change banner; install.js
//      embeds a source-change banner in renderTrustCard.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Inline classifier — sourced from shared/utils.js without bringing in the
// rest of the IIFE. Mirror of the production helper; the source-of-truth
// scan below pins the contract.
const utilsSource = readFileSync(resolve(process.cwd(), 'shared/utils.js'), 'utf8');
const _body = `${utilsSource}\nreturn classifyInstallSource;`;
let fn;
try { const vm = require('node:vm'); fn = vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'shared/utils.js') }); } catch { fn = new Function(_body); }
const classifyInstallSource = fn();

describe('classifyInstallSource', () => {
  it('returns the local-import shape for empty input', () => {
    expect(classifyInstallSource('')).toMatchObject({ id: 'local', tone: 'neutral' });
    expect(classifyInstallSource(null)).toMatchObject({ id: 'local' });
    expect(classifyInstallSource(undefined)).toMatchObject({ id: 'local' });
  });

  it('classifies Greasy Fork (good)', () => {
    const r = classifyInstallSource('https://greasyfork.org/en/scripts/12345/Foo.user.js');
    expect(r.id).toBe('greasyfork');
    expect(r.tone).toBe('good');
    expect(r.hostname).toBe('greasyfork.org');
  });

  it('classifies Sleazy Fork as warn (adult-content sister site)', () => {
    const r = classifyInstallSource('https://sleazyfork.org/en/scripts/98765/Bar.user.js');
    expect(r.id).toBe('sleazyfork');
    expect(r.tone).toBe('warn');
  });

  it('classifies OpenUserJS (good)', () => {
    const r = classifyInstallSource('https://openuserjs.org/install/me/Foo.user.js');
    expect(r.id).toBe('openuserjs');
    expect(r.tone).toBe('good');
  });

  it('classifies GitHub raw and Gist', () => {
    expect(classifyInstallSource('https://raw.githubusercontent.com/me/repo/main/foo.user.js').id).toBe('github-raw');
    expect(classifyInstallSource('https://gist.githubusercontent.com/me/abc/raw/foo.user.js').id).toBe('github-gist');
  });

  it('detects GitHub releases as a stronger trust tier than raw repos', () => {
    const release = classifyInstallSource('https://github.com/me/repo/releases/download/v1.0/foo.user.js');
    expect(release.id).toBe('github-release');
    expect(release.tone).toBe('good');
    const repo = classifyInstallSource('https://github.com/me/repo/blob/main/foo.user.js');
    expect(repo.id).toBe('github');
    expect(repo.tone).toBe('neutral');
  });

  it('falls back to "other" with warn tone for unknown hosts', () => {
    const r = classifyInstallSource('https://random-pastebin.example/raw/abc.user.js');
    expect(r.id).toBe('other');
    expect(r.tone).toBe('warn');
    expect(r.hostname).toBe('random-pastebin.example');
  });

  it('returns "other" with warn tone for malformed URLs', () => {
    const r = classifyInstallSource('not-a-url');
    expect(r.id).toBe('other');
    expect(r.tone).toBe('warn');
  });
});

describe('background.core.js source-of-truth scan', () => {
  const bg = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

  it('classifies install source inside installFromCode and persists installSource on the script', () => {
    expect(bg).toContain('const installSource = classifyInstallSource(effectiveSourceUrl);');
    expect(bg).toMatch(/installSource:[^,]+installSource/);
  });

  it('flags sourceIdentityChanged when the registry id changes', () => {
    expect(bg).toContain('sourceIdentityChanged = true');
    expect(bg).toContain('previousInstallSource');
  });

  it('reclassifies on applyUpdate too', () => {
    expect(bg).toContain('const updatedSource = classifyInstallSource(updateSourceUrl);');
    expect(bg).toContain("script.installSource.id !== updatedSource.id");
  });
});

describe('Dashboard source badge wiring', () => {
  const dashboard = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

  it('renders an install-source badge when script.installSource is set', () => {
    expect(dashboard).toContain("data-source-badge=");
    expect(dashboard).toContain("script.installSource.id !== 'local'");
  });

  it('renders a "Source changed" warning badge when settings.sourceIdentityChanged is true', () => {
    expect(dashboard).toContain('script.settings?.sourceIdentityChanged');
    expect(dashboard).toContain('Source changed');
  });
});

describe('Install page banner wiring', () => {
  const installJs = readFileSync(resolve(process.cwd(), 'pages/install.js'), 'utf8');

  it('detects a source registry change when updating an existing script', () => {
    expect(installJs).toContain("typeof classifyInstallSource === 'function'");
    expect(installJs).toContain("newSource.id !== 'local'");
    expect(installJs).toContain('sourceChange');
  });

  it('renders the source-change banner inside renderTrustCard', () => {
    expect(installJs).toContain('Source registry changed');
    expect(installJs).toContain('Confirm you trust the new origin');
  });
});

describe('Health-badge CSS variants for new tones', () => {
  const html = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
  it('defines .script-health-badge.good and .neutral with non-pill radii', () => {
    expect(html).toMatch(/\.script-health-badge\.good\s*\{/);
    expect(html).toMatch(/\.script-health-badge\.neutral\s*\{/);
    // Reuse the existing 8px corner radius — never a pill backdrop.
    expect(html).toMatch(/border-radius:\s*8px/);
  });
});
