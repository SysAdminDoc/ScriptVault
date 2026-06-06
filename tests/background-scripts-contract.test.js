import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseUserscript } from '../src/background/parser.ts';

function backgroundUserscript(extraMeta = '') {
  return [
    '// ==UserScript==',
    '// @name Background Contract',
    '// @namespace scriptvault.test',
    '// @version 1.0.0',
    '// @match https://example.com/*',
    '// @background',
    extraMeta,
    '// ==/UserScript==',
    'console.log("background");',
  ].filter(Boolean).join('\n');
}

describe('DOM-less @background contract', () => {
  it('parses @background as an explicit dormant metadata marker', () => {
    const parsed = parseUserscript(backgroundUserscript());

    expect(parsed.error).toBeUndefined();
    expect(parsed.meta.background).toBe(true);
    expect(parsed.meta.match).toEqual(['https://example.com/*']);
  });

  it('keeps the experimental background runner gate default-off and internal', () => {
    const defaults = JSON.parse(readFileSync('src/config/settings-defaults.json', 'utf8'));
    const schema = JSON.parse(readFileSync('src/config/settings-schema.json', 'utf8'));

    expect(defaults.experimentalBackgroundScripts).toBe(false);
    expect(schema.classifications.internal).toContain('experimentalBackgroundScripts');
    expect(schema.metadata.experimentalBackgroundScripts).toBeUndefined();
  });

  it('keeps @background scripts out of page-load registration until the runner ships', () => {
    const core = readFileSync('src/background/core.ts', 'utf8');
    const registration = readFileSync('src/background/registration.ts', 'utf8');

    for (const source of [core, registration]) {
      expect(source).toContain('if (meta.background)');
      expect(source).toContain('Skipped @background script until experimentalBackgroundScripts runner ships');
      expect(source).toContain('chrome.userScripts.unregister({ ids: [script.id] })');
    }
  });

  it('documents the required future runner and safety gates', () => {
    const doc = readFileSync('docs/background-scripts-design.md', 'utf8');

    for (const heading of [
      '## Contract',
      '## Runner Shape',
      '## API Surface',
      '## Scheduling',
      '## Review And Safety',
      '## Verification',
    ]) {
      expect(doc).toContain(heading);
    }
    expect(doc).toContain('experimentalBackgroundScripts');
    expect(doc).toContain('GM_xmlhttpRequest');
    expect(doc).toContain('no matching tab open');
  });
});
