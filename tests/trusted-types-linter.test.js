import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardLinter = readFileSync(resolve(process.cwd(), 'pages/dashboard-linter.js'), 'utf8');

const RULE_ID = 'trusted-types-main-world';

const _linterBody = `${dashboardLinter}\nreturn AdvancedLinter;`;
let _linterCompiled;
try { const vm = require('node:vm'); _linterCompiled = vm.compileFunction(_linterBody, [], { filename: resolve(process.cwd(), 'pages/dashboard-linter.js') }); } catch { /* fall through */ }
function createLinter() {
  try { if (_linterCompiled) return _linterCompiled(); } catch { /* vm context lacks window */ }
  return new Function(_linterBody)();
}

function script({ injectInto, body }) {
  const lines = [
    '// ==UserScript==',
    '// @name        TT Test',
    '// @namespace   test',
    '// @version     1.0',
    '// @match        https://example.com/*',
  ];
  if (injectInto) lines.push(`// @inject-into ${injectInto}`);
  lines.push('// ==/UserScript==');
  lines.push(body);
  return lines.join('\n');
}

function ttIssues(linter, code) {
  return linter.lint(code).filter((issue) => issue.ruleId === RULE_ID);
}

describe('Trusted Types MAIN-world linter rule', () => {
  it('flags innerHTML assignment in @inject-into page scripts', () => {
    const linter = createLinter();
    const issues = ttIssues(linter, script({ injectInto: 'page', body: 'document.body.innerHTML = "<b>hi</b>";' }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning' });
    expect(issues[0].message).toMatch(/Trusted Types/);
  });

  it('flags outerHTML, document.write/writeln, and insertAdjacentHTML in MAIN world', () => {
    const linter = createLinter();
    const body = [
      'el.outerHTML = "<div></div>";',
      'document.write("<p>x</p>");',
      'document.writeln("<p>y</p>");',
      'node.insertAdjacentHTML("beforeend", "<span></span>");',
    ].join('\n');
    const issues = ttIssues(linter, script({ injectInto: 'page', body }));
    expect(issues).toHaveLength(4);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('does not fire for default USER_SCRIPT scripts (no false positives)', () => {
    const linter = createLinter();
    const body = 'document.body.innerHTML = "<b>hi</b>";\ndocument.write("x");';
    expect(ttIssues(linter, script({ body }))).toEqual([]);
    expect(ttIssues(linter, script({ injectInto: 'content', body }))).toEqual([]);
  });

  it('does not flag innerHTML reads or equality comparisons', () => {
    const linter = createLinter();
    const body = [
      'const html = document.body.innerHTML;',
      'if (el.innerHTML === "<b></b>") doThing();',
      'const same = a.outerHTML == b.outerHTML;',
    ].join('\n');
    expect(ttIssues(linter, script({ injectInto: 'page', body }))).toEqual([]);
  });

  it('is registered as an informational (warning, non-error) rule', () => {
    const linter = createLinter();
    const rule = linter.getRules().find((r) => r.id === RULE_ID);
    expect(rule).toBeTruthy();
    expect(rule.severity).toBe('warning');
    expect(rule.fixable).toBe(false);
  });
});
