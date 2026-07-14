import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

const SCRIPTCAT_TM_FIXTURE = [
  '// ==UserScript==',
  '// @name        ScriptCat Export Test',
  '// @namespace   scriptcat.org',
  '// @version     1.0.0',
  '// @description Exported from ScriptCat in TM format',
  '// @match       https://example.com/*',
  '// @grant       GM_getValue',
  '// @grant       GM_setValue',
  '// ==/UserScript==',
  "console.log('scriptcat test');",
  '',
  '',
  '// ==UserScript==',
  '// @name        ScriptCat Background Script',
  '// @namespace   scriptcat.org',
  '// @version     2.0.0',
  '// @description ScriptCat @background script (exported as normal)',
  '// @crontab     */5 * * * *',
  '// @match       https://example.org/*',
  '// @grant       GM_notification',
  '// ==/UserScript==',
  "GM_notification({ text: 'cron' });",
].join('\n');

describe('ScriptCat TM-shaped backup import', () => {
  it('imports ScriptCat TM-format exports through the existing TM handler', () => {
    const handlerStart = backgroundCore.indexOf("case 'importTampermonkeyBackup':");
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerEnd = backgroundCore.indexOf("case '", handlerStart + 40);
    const handler = backgroundCore.slice(handlerStart, handlerEnd);

    expect(handler).toContain("importVendorBackup('tampermonkey', data.text, data)");
  });

  it('fixture has valid multi-script TM-shaped export structure', () => {
    const parts = SCRIPTCAT_TM_FIXTURE.split(/\n\s*\n(?=\/\/\s*==UserScript==)/);
    expect(parts.length).toBe(2);
    expect(parts[0]).toContain('@name        ScriptCat Export Test');
    expect(parts[1]).toContain('@name        ScriptCat Background Script');
    expect(parts[1]).toContain('@crontab');
  });

  it('ScriptCat @crontab metadata survives the parser', () => {
    const parts = SCRIPTCAT_TM_FIXTURE.split(/\n\s*\n(?=\/\/\s*==UserScript==)/);
    const cronScript = parts[1];
    expect(cronScript).toContain('@crontab');
    expect(cronScript).toContain('==UserScript==');
    expect(cronScript).toContain('==/UserScript==');
  });

  it('TM handler splits multi-script backups on double-newline boundaries', () => {
    expect(backgroundCore).toContain("split(/\\n\\s*\\n(?=\\/\\/\\s*==UserScript==)/)");
  });
});
