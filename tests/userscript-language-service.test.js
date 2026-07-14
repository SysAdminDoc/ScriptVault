import { describe, expect, it } from 'vitest';
import {
  applyLspContentChanges,
  getGmSignatureHelp,
  getMetadataCompletions,
  getUserscriptDiagnostics,
} from '../src/editor/userscript-language-service.ts';

describe('userscript language service', () => {
  it('offers metadata directives only inside the userscript header', () => {
    const source = '// ==UserScript==\n// @na\n// ==/UserScript==\n';
    const completions = getMetadataCompletions(source, { line: 1, character: 6 });

    expect(completions.map(item => item.label)).toContain('@name');
    expect(completions.find(item => item.label === '@name')?.textEdit).toEqual({
      range: { start: { line: 1, character: 3 }, end: { line: 1, character: 6 } },
      newText: '@name ',
    });
    expect(getMetadataCompletions(`${source}\n// @na`, { line: 4, character: 6 })).toEqual([]);
  });

  it('returns signatures for classic and promise-based GM APIs', () => {
    expect(getGmSignatureHelp('GM_setValue("theme", ', { line: 0, character: 21 })).toMatchObject({
      activeParameter: 1,
      signatures: [{ label: expect.stringContaining('GM_setValue') }],
    });
    expect(getGmSignatureHelp('GM.xmlHttpRequest(', { line: 0, character: 18 })).toMatchObject({
      activeParameter: 0,
      signatures: [{ label: expect.stringContaining('GM.xmlHttpRequest') }],
    });
  });

  it('reports actionable userscript metadata warnings without flagging a valid header', () => {
    const risky = [
      '// ==UserScript==',
      '// @name Risky script',
      '// @name Duplicate name',
      '// @run-at whenever',
      '// @require http://example.com/helper.js',
      '// @connect *',
      '// ==/UserScript==',
    ].join('\n');
    expect(getUserscriptDiagnostics(risky).map(item => item.code)).toEqual([
      'missing-scope',
      'duplicate-metadata',
      'invalid-run-at',
      'insecure-require',
      'broad-connect',
    ]);

    const valid = [
      '// ==UserScript==',
      '// @name Focus helper',
      '// @match https://example.com/*',
      '// @run-at document-idle',
      '// ==/UserScript==',
    ].join('\n');
    expect(getUserscriptDiagnostics(valid)).toEqual([]);
  });

  it('applies full and incremental LSP document changes in order', () => {
    const replaced = applyLspContentChanges('old', [{ text: 'hello\nworld' }]);
    expect(applyLspContentChanges(replaced, [{
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
      text: 'ScriptVault',
    }])).toBe('hello\nScriptVault');
  });
});
