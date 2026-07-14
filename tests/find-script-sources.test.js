import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildCustomFindScriptSourceUrl,
  getEnabledFindScriptSources,
  normalizeFindScriptSourceSettings,
  resolveFindScriptSource,
  validateCustomFindScriptSource,
} from '../src/background/find-script-sources.ts';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

describe('Find Scripts source registry', () => {
  it('preserves all existing built-in sources by default', () => {
    expect(getEnabledFindScriptSources(undefined).map(source => source.id)).toEqual([
      'greasyfork',
      'openuserjs',
      'github',
    ]);
  });

  it('allows built-in sources to be independently disabled', () => {
    const sources = getEnabledFindScriptSources({
      builtin: { greasyfork: true, openuserjs: false, github: false },
    });
    expect(sources.map(source => source.id)).toEqual(['greasyfork']);
    expect(resolveFindScriptSource({ builtin: { greasyfork: false } }, 'greasyfork')).toBeNull();
  });

  it('validates and origin-pins HTTPS custom URL templates', () => {
    const validation = validateCustomFindScriptSource({
      label: 'Community Catalog',
      urlTemplate: 'https://catalog.example/search?q={query}&page={page}',
    });
    expect(validation).toMatchObject({
      ok: true,
      source: {
        label: 'Community Catalog',
        allowedOrigin: 'https://catalog.example',
        enabled: true,
      },
    });
    if (!validation.ok) throw new Error(validation.error);

    expect(buildCustomFindScriptSourceUrl(validation.source, 'dark mode & video', 3)).toEqual({
      ok: true,
      url: 'https://catalog.example/search?q=dark%20mode%20%26%20video&page=3',
    });
  });

  it.each([
    ['missing query token', 'https://catalog.example/search', 'must include {query}'],
    ['plain HTTP', 'http://catalog.example/search?q={query}', 'must use HTTPS'],
    ['credentials', 'https://user:secret@catalog.example/search?q={query}', 'cannot contain credentials'],
    ['local host', 'https://localhost/search?q={query}', 'public catalog hostname'],
    ['private IPv4', 'https://192.168.1.3/search?q={query}', 'public catalog hostname'],
    ['dynamic origin', 'https://{query}.catalog.example/search', 'cannot change the catalog origin'],
    ['unknown token', 'https://catalog.example/search?q={query}&sort={sort}', 'Unsupported template token'],
  ])('rejects %s templates', (_label, urlTemplate, message) => {
    expect(validateCustomFindScriptSource({ label: 'Catalog', urlTemplate })).toMatchObject({
      ok: false,
      error: expect.stringContaining(message),
    });
  });

  it('normalizes imported settings and never trusts a stored allowed origin', () => {
    const normalized = normalizeFindScriptSourceSettings({
      builtin: { greasyfork: false, openuserjs: true, github: true },
      custom: [{
        label: 'Safe Catalog',
        urlTemplate: 'https://safe.example/find/{query}',
        allowedOrigin: 'https://attacker.example',
        enabled: true,
      }],
    });
    expect(normalized.builtin.greasyfork).toBe(false);
    expect(normalized.custom[0].allowedOrigin).toBe('https://safe.example');
    expect(getEnabledFindScriptSources(normalized).map(source => source.id)).toContain(`custom:${normalized.custom[0].id}`);
  });

  it('ships accessible source management and actionable inline failure handling', () => {
    expect(dashboardHtml).toContain('id="btnManageFindScriptsSources"');
    expect(dashboardHtml).toContain('aria-controls="findScriptsSourcesPanel"');
    expect(dashboardHtml).toContain('id="findScriptsCustomError" role="alert"');
    expect(dashboardHtml).toContain('data-find-builtin-source="greasyfork"');
    expect(dashboardHtml).toContain('data-find-builtin-source="openuserjs"');
    expect(dashboardHtml).toContain('data-find-builtin-source="github"');
    expect(dashboardHtml).toContain('../modules/find-script-sources.js');
    expect(dashboardJs).toContain('FindScriptSources.validateCustomFindScriptSource');
    expect(dashboardJs).toContain('FindScriptSources.buildCustomFindScriptSourceUrl');
    expect(dashboardJs).toContain("'Search failed'");
    expect(dashboardJs).toContain("actionLabel: 'Try Again'");
    expect(dashboardJs).not.toContain('// Fallback to external');
  });
});
