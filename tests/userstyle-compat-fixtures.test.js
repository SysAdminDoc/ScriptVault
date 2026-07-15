// Userstyle parser + variable-substitution regression fixtures.
// Establishes a compatibility baseline before any "advanced color variables"
// work (HSL/Hex/named-color picker upgrades) ships. Every fixture exercises
// the runtime parseUserCSS export from src/modules/userstyles.ts.
//
// Covers:
//   - All six @var types (color / text / number / select / checkbox / range)
//   - /*[[varName]]*/ placeholder substitution
//   - var(--varName) custom-property substitution
//   - @-moz-document blocks (Stylus convention)
//   - Multi-section UserCSS bodies
//   - Bilingual / unicode label strings
import { describe, it, expect } from 'vitest';
import { UserStylesEngine } from '../src/modules/userstyles.ts';

const { parseUserCSS } = UserStylesEngine;

function fixture(name) {
  return FIXTURES[name];
}

const FIXTURES = {
  basic: `/* ==UserStyle==
@name           Example Basic
@namespace      example.com
@version        1.0.0
@description    Minimal userstyle with no variables
@author         QA
==/UserStyle== */

body { background: #112233; color: #eeeeee; }
`,

  colorVar: `/* ==UserStyle==
@name           Color Variable Theme
@namespace      example.com
@version        1.0.0
@var color      accent  "Accent colour"  #ff5733
@var color      bg      "Background"     #1a1a1a
==/UserStyle== */

body { background: /*[[bg]]*/; color: /*[[accent]]*/; }
a { color: var(--accent); }
`,

  selectVar: `/* ==UserStyle==
@name           Picker Theme
@namespace      example.com
@version        1.0.0
@var select font "Font family" {sans:sans-serif|serif:Georgia|mono:monospace}
==/UserStyle== */

body { font-family: /*[[font]]*/; }
`,

  rangeNumberCheckboxText: `/* ==UserStyle==
@name           All Variable Types
@namespace      example.com
@version        1.0.0
@var range  spacing  "Spacing" [0, 32, 1, 8]
@var number radius   "Border radius"  4
@var checkbox bold   "Use bold"       1
@var text    quote   "Quote text"     "Hello"
==/UserStyle== */

body { padding: /*[[spacing]]*/px; border-radius: /*[[radius]]*/px; }
`,

  mozDocument: `/* ==UserStyle==
@name           Domain Locked
@namespace      example.com
@version        1.0.0
@var color      accent "Accent" #ff8800
==/UserStyle== */

@-moz-document domain("example.com") {
  body { color: /*[[accent]]*/; }
}
@-moz-document regexp("https?://(www\\.)?example\\.com/.*") {
  header { background: var(--accent); }
}
`,

  multiSection: `/* ==UserStyle==
@name           Multi Section
@namespace      example.com
@version        1.2.0
@var color      bg "Background" #222
==/UserStyle== */

section.hero { background: /*[[bg]]*/; }
section.footer { background: /*[[bg]]*/; opacity: 0.9; }
.cta { color: var(--bg); }
`,

  bilingualLabels: `/* ==UserStyle==
@name           日本語スタイル
@namespace      example.com
@version        1.0.0
@var color      accent "アクセント色" #ff0066
@var text       quote  "引用テキスト" "こんにちは"
==/UserStyle== */

body { color: /*[[accent]]*/; }
blockquote::before { content: /*[[quote]]*/; }
`,

  modernColors: `/* ==UserStyle==
@name           Modern Color Spaces
@namespace      example.com
@version        1.0.0
@var color      hslAccent "HSL accent" "hsl(260 75% 60%)"
@var color      oklchAccent "OKLCH accent" oklch(72% 0.18 255)
@var color      oklabAccent "OKLab accent" oklab(72% -0.03 -0.12)
==/UserStyle== */

body { color: /*[[hslAccent]]*/; background: var(--oklchAccent); border-color: <<oklabAccent>>; }
`,

  linkedPalette: `/* ==UserStyle==
@name           Linked Palette
@namespace      example.com
@version        1.0.0
@var color      accent "Accent" #336699 @group brand
@var color      accentAlias "Accent alias" #336699 @group brand
==/UserStyle== */

body { color: /*[[accent]]*/; border-color: var(--accentAlias); }
`,

  colorScheme: `/* ==UserStyle==
@name           Scheme Palette
@namespace      example.com
@version        1.0.0
@var color      surface "Surface" #ffffff @light hsl(0 0% 100%) @dark oklch(24% 0.02 255)
==/UserStyle== */

body { background: /*[[surface]]*/; }
`
};

describe('parseUserCSS — basic fixture', () => {
  it('produces a meta block with name/namespace/version/description/author', () => {
    const r = parseUserCSS(fixture('basic'));
    expect(r.error).toBeUndefined();
    expect(r.meta).toMatchObject({
      name: 'Example Basic',
      namespace: 'example.com',
      version: '1.0.0',
      description: 'Minimal userstyle with no variables',
      author: 'QA'
    });
    expect(r.variables).toEqual([]);
    expect(r.css).toContain('body { background: #112233');
  });

  it('returns a structured error when metadata block is missing', () => {
    const r = parseUserCSS('body { color: red; }');
    expect(r.error).toMatch(/UserStyle/);
  });
});

describe('parseUserCSS — color variables', () => {
  it('extracts every @var color directive with default + label', () => {
    const r = parseUserCSS(fixture('colorVar'));
    expect(r.variables.length).toBe(2);
    const accent = r.variables.find(v => v.name === 'accent');
    expect(accent).toMatchObject({ type: 'color', label: 'Accent colour', default: '#ff5733' });
    const bg = r.variables.find(v => v.name === 'bg');
    expect(bg).toMatchObject({ type: 'color', label: 'Background', default: '#1a1a1a' });
  });
});

describe('parseUserCSS — select / range / number / checkbox / text', () => {
  it('parses @var select options as {label:value|...}', () => {
    const r = parseUserCSS(fixture('selectVar'));
    expect(r.variables).toHaveLength(1);
    const v = r.variables[0];
    expect(v.type).toBe('select');
    expect(v.label).toBe('Font family');
    expect(v.options).toEqual({ sans: 'sans-serif', serif: 'Georgia', mono: 'monospace' });
  });

  it('parses @var range arrays as [min, max, step, default] (min/max/step stored under options)', () => {
    const r = parseUserCSS(fixture('rangeNumberCheckboxText'));
    const range = r.variables.find(v => v.name === 'spacing');
    expect(range).toMatchObject({ type: 'range', label: 'Spacing', default: 8 });
    expect(range.options).toMatchObject({ min: 0, max: 32, step: 1 });
  });

  it('parses @var number as a numeric default', () => {
    const r = parseUserCSS(fixture('rangeNumberCheckboxText'));
    const num = r.variables.find(v => v.name === 'radius');
    expect(num).toMatchObject({ type: 'number', label: 'Border radius' });
    expect(Number(num.default)).toBe(4);
  });

  it('parses @var checkbox as boolean-ish default', () => {
    const r = parseUserCSS(fixture('rangeNumberCheckboxText'));
    const chk = r.variables.find(v => v.name === 'bold');
    expect(chk).toMatchObject({ type: 'checkbox', label: 'Use bold' });
    // Default may be string '1' or number 1; either is acceptable as long as
    // the dashboard renderer treats it as truthy.
    expect(Boolean(Number(chk.default))).toBe(true);
  });

  it('parses @var text as a literal string default', () => {
    const r = parseUserCSS(fixture('rangeNumberCheckboxText'));
    const txt = r.variables.find(v => v.name === 'quote');
    expect(txt).toMatchObject({ type: 'text', label: 'Quote text', default: 'Hello' });
  });
});

describe('parseUserCSS — @-moz-document compatibility', () => {
  it('preserves @-moz-document blocks in the CSS body verbatim', () => {
    const r = parseUserCSS(fixture('mozDocument'));
    expect(r.error).toBeUndefined();
    expect(r.css).toContain('@-moz-document domain("example.com")');
    expect(r.css).toContain('@-moz-document regexp(');
  });
});

describe('parseUserCSS — multi-section bodies', () => {
  it('keeps every selector intact when the same variable appears multiple times', () => {
    const r = parseUserCSS(fixture('multiSection'));
    expect(r.css.match(/\[\[bg\]\]/g)?.length).toBe(2);
    expect(r.css).toContain('var(--bg)');
  });
});

describe('parseUserCSS — unicode labels', () => {
  it('does not corrupt non-ASCII variable labels', () => {
    const r = parseUserCSS(fixture('bilingualLabels'));
    expect(r.meta.name).toBe('日本語スタイル');
    const accent = r.variables.find(v => v.name === 'accent');
    expect(accent.label).toBe('アクセント色');
    const quote = r.variables.find(v => v.name === 'quote');
    expect(quote.label).toBe('引用テキスト');
    expect(quote.default).toBe('こんにちは');
  });
});

describe('parseUserCSS — advanced color configuration', () => {
  it('recognizes HSL, OKLCH, and OKLab color defaults', () => {
    const r = parseUserCSS(fixture('modernColors'));
    expect(r.error).toBeUndefined();
    expect(r.variables.map(variable => [variable.name, variable.colorSpace, variable.default])).toEqual([
      ['hslAccent', 'hsl', 'hsl(260 75% 60%)'],
      ['oklchAccent', 'oklch', 'oklch(72% 0.18 255)'],
      ['oklabAccent', 'oklab', 'oklab(72% -0.03 -0.12)'],
    ]);
  });

  it('links color aliases through explicit palette metadata', () => {
    const r = parseUserCSS(fixture('linkedPalette'));
    expect(r.error).toBeUndefined();
    expect(r.variables).toHaveLength(2);
    expect(r.variables.every(variable => variable.group === 'brand')).toBe(true);
  });

  it('parses light and dark conditional color defaults', () => {
    const r = parseUserCSS(fixture('colorScheme'));
    expect(r.error).toBeUndefined();
    expect(r.variables[0]).toMatchObject({
      name: 'surface',
      colorSchemes: {
        light: 'hsl(0 0% 100%)',
        dark: 'oklch(24% 0.02 255)',
      },
    });
  });

  it('rejects unsafe and malformed modern color values', () => {
    const unsafe = fixture('modernColors').replace('oklch(72% 0.18 255)', 'oklch(72% 0.18 255);body{}');
    const malformed = fixture('modernColors').replace('oklab(72% -0.03 -0.12)', 'oklab(72% -0.03)');
    const reservedName = fixture('modernColors').replace('hslAccent', '__proto__');
    expect(parseUserCSS(unsafe).error).toContain('unsafe CSS characters');
    expect(parseUserCSS(malformed).error).toContain('requires three components');
    expect(parseUserCSS(reservedName).error).toContain('CSS identifiers');
  });
});

describe('parseUserCSS — every fixture parses without an error', () => {
  it.each(Object.keys(FIXTURES))('fixture %s parses cleanly', (name) => {
    const r = parseUserCSS(FIXTURES[name]);
    expect(r.error, name).toBeUndefined();
    expect(r.meta?.name, name).toBeTruthy();
    expect(typeof r.css, name).toBe('string');
    expect(Array.isArray(r.variables), name).toBe(true);
  });
});
