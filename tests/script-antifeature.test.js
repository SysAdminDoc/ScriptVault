import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUserscript } from '../src/background/parser.ts';

const GREASY_FORK_ANTIFEATURE_TYPES = [
  'ads',
  'membership',
  'miner',
  'payment',
  'referral-link',
  'tracking',
];

function expectParsed(code) {
  const result = parseUserscript(code);
  if (result.error) throw new Error(result.error);
  return result.meta;
}

describe('userscript @antifeature metadata', () => {
  it('parses type and optional description into structured entries', () => {
    const meta = expectParsed([
      '// ==UserScript==',
      '// @name AntiFeature Demo',
      '// @antifeature ads Injects sponsor cards',
      '// @antifeature tracking',
      '// ==/UserScript==',
      '',
    ].join('\n'));

    expect(meta.antifeature).toEqual([
      { type: 'ads', description: 'Injects sponsor cards', locale: '' },
      { type: 'tracking', description: '', locale: '' },
    ]);
  });

  it('preserves locale on localized antifeature descriptions', () => {
    const meta = expectParsed([
      '// ==UserScript==',
      '// @name Localized AntiFeature Demo',
      '// @antifeature:fr payment Paiement requis',
      '// ==/UserScript==',
      '',
    ].join('\n'));

    expect(meta.antifeature).toEqual([
      { type: 'payment', description: 'Paiement requis', locale: 'fr' },
    ]);
    expect(meta.localized?.fr?.antifeature).toBeUndefined();
  });
});

describe('install and dashboard antifeature UI wiring', () => {
  const install = readFileSync(resolve(process.cwd(), 'pages/install.js'), 'utf8');
  const dashboard = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
  const html = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');

  it('labels every Greasy Fork antifeature type on install and dashboard surfaces', () => {
    for (const type of GREASY_FORK_ANTIFEATURE_TYPES) {
      const keyPattern = new RegExp(`['"]?${type.replace('-', '\\-')}['"]?\\s*:`);
      expect(install).toMatch(keyPattern);
      expect(dashboard).toMatch(keyPattern);
    }
  });

  it('renders a dashboard row chip and amber theme styles for declared antifeatures', () => {
    expect(dashboard).toContain('data-antifeature-badge="true"');
    expect(dashboard).toContain('${antifeatureBadgeHtml}');
    expect(dashboard).toContain('getDeclaredAntifeatures(metadata)');
    expect(html).toMatch(/\.script-health-badge\.antifeature\s*\{/);
    expect(html).toMatch(/html\[data-theme="light"\] \.script-health-badge\.antifeature\s*\{/);
  });

  it('normalizes legacy string entries before showing install warnings', () => {
    expect(install).toContain('normalizeAntifeatureEntry(entry)');
    expect(install).toContain('getDeclaredAntifeatures(scriptMeta)');
    expect(install).toContain('formatAntifeatureLabel(af)');
  });
});
