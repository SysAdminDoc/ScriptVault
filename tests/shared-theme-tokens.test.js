import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

describe('shared theme token system', () => {
  const themeTokensPath = resolve(ROOT, 'pages', 'theme-tokens.css');

  it('theme-tokens.css exists', () => {
    expect(existsSync(themeTokensPath)).toBe(true);
  });

  it('defines all four theme variants', () => {
    const css = read('pages/theme-tokens.css');
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-theme="catppuccin"]');
    expect(css).toContain('[data-theme="oled"]');
  });

  it('defines canonical token names', () => {
    const css = read('pages/theme-tokens.css');
    const required = [
      '--sv-bg:', '--sv-bg-raised:', '--sv-bg-hover:',
      '--sv-border:', '--sv-text:', '--sv-text-muted:',
      '--sv-accent:', '--sv-danger:', '--sv-warning:', '--sv-info:',
      '--sv-focus-ring:', '--sv-radius-panel:', '--sv-radius-control:',
    ];
    for (const token of required) {
      expect(css).toContain(token);
    }
  });

  const pages = [
    'pages/dashboard.html',
    'pages/popup.html',
    'pages/sidepanel.html',
    'pages/install.html',
    'pages/devtools-panel.html',
  ];

  for (const page of pages) {
    it(`${page} links theme-tokens.css`, () => {
      const html = read(page);
      expect(html).toContain('theme-tokens.css');
    });
  }

  it('popup aliases shared tokens to local names', () => {
    const html = read('pages/popup.html');
    expect(html).toContain('var(--sv-bg)');
    expect(html).toContain('var(--sv-text)');
    expect(html).toContain('var(--sv-accent)');
  });

  it('sidepanel aliases shared tokens to local names', () => {
    const html = read('pages/sidepanel.html');
    expect(html).toContain('var(--sv-bg)');
    expect(html).toContain('var(--sv-text)');
    expect(html).toContain('var(--sv-accent)');
  });

  it('devtools panel aliases shared tokens to local names', () => {
    const html = read('pages/devtools-panel.html');
    expect(html).toContain('--bg: var(--sv-bg)');
    expect(html).toContain('--text: var(--sv-text)');
    expect(html).toContain('--accent: var(--sv-accent)');
    expect(html).toContain('--method-get: var(--sv-accent)');
    expect(html).toContain('--focus-ring: var(--sv-focus-ring)');
  });

  it('popup and sidepanel use consistent theme setting key', () => {
    const popupJs = read('pages/popup.js');
    const sidepanelJs = read('pages/sidepanel.js');
    expect(popupJs).toContain("settings.layout || 'dark'");
    expect(sidepanelJs).toContain("settings.layout || 'dark'");
    expect(sidepanelJs).not.toContain('settings.theme ||');
  });
});
