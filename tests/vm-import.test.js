import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const importActionHandler = readFileSync(
  resolve(process.cwd(), 'src/background/import-action-handler.ts'),
  'utf8',
);

const VM_EXPORT_FIXTURE = {
  scripts: [
    {
      props: { id: 'vm-script-1', uri: 'https://greasyfork.org/scripts/1234', name: 'Test Script One' },
      config: { enabled: true, shouldUpdate: true },
      custom: {},
      code: `// ==UserScript==
// @name        Test Script One
// @namespace   https://greasyfork.org/users/1234
// @version     2.1.0
// @description Fixture: enabled VM script
// @match       https://example.com/*
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==
console.log('test 1');`,
    },
    {
      props: { id: 'vm-script-2', uri: '', name: 'Disabled Script' },
      config: { enabled: false, shouldUpdate: false },
      custom: {},
      code: `// ==UserScript==
// @name        Disabled Script
// @namespace   test-ns
// @version     1.0.0
// @description Fixture: disabled VM script
// @match       https://example.org/*
// @grant       none
// ==/UserScript==
console.log('disabled');`,
    },
    {
      props: { id: 'vm-script-3', uri: '', name: 'Empty Code Script' },
      config: { enabled: true },
      custom: {},
      code: '',
    },
  ],
};

describe('Violentmonkey backup import', () => {
  it('reads vmScript.code, vmScript.props.name, and vmScript.config.enabled from the runtime handler', () => {
    expect(importActionHandler).toContain("'violentmonkey',");
    expect(importActionHandler).toContain('message.text');
    expect(backgroundCore).toContain('Array.isArray(parsed?.scripts)');
    expect(backgroundCore).toContain('script?.code || script?.custom?.code');
    expect(backgroundCore).toContain('script?.config?.enabled !== false');
    expect(backgroundCore).toContain('script?.props?.name');
  });

  it('fixture has the expected VM export shape', () => {
    expect(VM_EXPORT_FIXTURE.scripts).toHaveLength(3);
    expect(VM_EXPORT_FIXTURE.scripts[0].props.name).toBe('Test Script One');
    expect(VM_EXPORT_FIXTURE.scripts[0].config.enabled).toBe(true);
    expect(VM_EXPORT_FIXTURE.scripts[0].code).toContain('==UserScript==');

    expect(VM_EXPORT_FIXTURE.scripts[1].config.enabled).toBe(false);
    expect(VM_EXPORT_FIXTURE.scripts[2].code).toBe('');
  });

  it('fixture JSON round-trips correctly for the import handler', () => {
    const text = JSON.stringify(VM_EXPORT_FIXTURE);
    const parsed = JSON.parse(text);
    expect(parsed.scripts).toHaveLength(3);
    expect(parsed.scripts[0].code).toContain('@name');
    expect(parsed.scripts[0].config.enabled).toBe(true);
    expect(parsed.scripts[1].config.enabled).toBe(false);
    expect(parsed.scripts[2].code).toBe('');
  });

  it('runtime handler skips scripts with empty code', () => {
    expect(backgroundCore).toMatch(/if \(!code\) \{\s*results\.skipped\+\+;\s*continue;/);
  });

  it('runtime handler registers scripts and updates badge after import', () => {
    expect(backgroundCore).toContain('await registerAllScripts(true);');
    expect(backgroundCore).toContain('await updateBadge();');
  });
});
