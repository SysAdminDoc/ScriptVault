import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';

import { parseUserscript } from '../src/background/parser.ts';
import { ScriptConfig as SourceScriptConfig } from '../src/modules/script-config.ts';

function loadRuntimeScriptConfig() {
  const modulePath = resolve(__dirname, '../modules/script-config.js');
  const code = readFileSync(modulePath, 'utf8');
  return compileFunction(`${code}\nreturn ScriptConfig;`, ['document', 'HTMLInputElement'], { filename: modulePath })(
    globalThis.document,
    globalThis.HTMLInputElement,
  );
}

const implementations = [
  { label: 'source', api: SourceScriptConfig },
  { label: 'runtime', api: loadRuntimeScriptConfig() },
];

describe('ScriptConfig userscript @var helpers', () => {
  it('parses userscript @var metadata into config variables', () => {
    const code = [
      '// ==UserScript==',
      '// @name Configured',
      '// @var text theme "Theme" "dark"',
      '// @var checkbox enabled "Enabled" 1',
      '// @var range size "Size" [0, 10, 1, 4]',
      '// @var select mode "Mode" {auto:auto|manual:manual}',
      '// ==/UserScript==',
      'console.log("ok");',
    ].join('\n');

    const { meta } = parseUserscript(code);

    expect(meta.config).toEqual([
      { type: 'text', name: 'theme', label: 'Theme', default: 'dark', options: null },
      { type: 'checkbox', name: 'enabled', label: 'Enabled', default: true, options: null },
      { type: 'range', name: 'size', label: 'Size', default: 4, options: { min: 0, max: 10, step: 1 } },
      { type: 'select', name: 'mode', label: 'Mode', default: 'auto', options: { auto: 'auto', manual: 'manual' } },
    ]);
  });
});

describe.each(implementations)('ScriptConfig userscript @var helpers ($label)', ({ api: ScriptConfig }) => {
  it('coerces saved values and fills defaults for missing variables', () => {
    const variables = [
      ScriptConfig.parseDirective('number retries "Retries" 2'),
      ScriptConfig.parseDirective('checkbox enabled "Enabled" 1'),
      ScriptConfig.parseDirective('range opacity "Opacity" [0, 100, 5, 50]'),
      ScriptConfig.parseDirective('select mode "Mode" {auto:auto|manual:manual}'),
    ].filter(Boolean);

    const values = ScriptConfig.normalizeValues(variables, {
      retries: '7',
      enabled: 'false',
      opacity: 120,
      mode: 'manual',
      ignored: 'drop',
    });

    expect({ ...values }).toEqual({
      retries: 7,
      enabled: false,
      opacity: 100,
      mode: 'manual',
    });
  });

  it('rejects prototype-polluting variable names', () => {
    expect(ScriptConfig.parseDirective('text __proto__ "Unsafe" "x"')).toBeNull();
    expect(ScriptConfig.parseDirective('text constructor "Unsafe" "x"')).toBeNull();
    expect({}.unsafe).toBeUndefined();
  });

  it('renders and reads dashboard fields with the same coercion rules', () => {
    const variables = [
      ScriptConfig.parseDirective('text label "Label" "hello"'),
      ScriptConfig.parseDirective('checkbox enabled "Enabled" 0'),
      ScriptConfig.parseDirective('range size "Size" [1, 5, 1, 3]'),
    ].filter(Boolean);
    const container = document.createElement('div');

    ScriptConfig.renderFields(container, variables, { label: 'saved', enabled: true, size: 10 });

    expect(container.querySelectorAll('[data-script-config-name]')).toHaveLength(3);
    expect(container.querySelector('[data-script-config-name="label"]').value).toBe('saved');
    expect(container.querySelector('[data-script-config-name="enabled"]').checked).toBe(true);
    expect(container.querySelector('[data-script-config-name="size"]').value).toBe('5');

    container.querySelector('[data-script-config-name="label"]').value = 'changed';
    container.querySelector('[data-script-config-name="enabled"]').checked = false;

    expect({ ...ScriptConfig.readFields(container, variables) }).toEqual({
      label: 'changed',
      enabled: false,
      size: 5,
    });
  });
});
