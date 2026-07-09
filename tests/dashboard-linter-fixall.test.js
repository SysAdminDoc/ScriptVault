import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardLinter = readFileSync(resolve(process.cwd(), 'pages/dashboard-linter.js'), 'utf8');

function createLinter() {
  const body = `${dashboardLinter}\nreturn AdvancedLinter;`;
  try {
    const vm = require('node:vm');
    const fn = vm.compileFunction(body, [], { filename: resolve(process.cwd(), 'pages/dashboard-linter.js') });
    return fn();
  } catch {
    return new Function(body)();
  }
}

function scriptWithMetadata(metadataLines, bodyLines = ["'use strict';", 'console.info("ready");']) {
  return [
    '// ==UserScript==',
    '// @name        Linter Test',
    ...metadataLines,
    '// ==/UserScript==',
    ...bodyLines,
  ].join('\n');
}

describe('AdvancedLinter fix-all and preview hunks', () => {
  it('continues applying fixes past five passes until no fixable issues remain', () => {
    const linter = createLinter();
    const duplicateMatches = Array.from({ length: 8 }, () => '// @match       https://example.com/*');
    const code = scriptWithMetadata([
      '// @match       https://example.com/*',
      ...duplicateMatches,
      '// @namespace   legacy',
      '// @installURL  https://example.com/install.user.js',
      '// @contributionURL https://example.com/donate',
    ]);

    expect(linter.lint(code).filter(issue => issue.fixable).length).toBeGreaterThan(5);
    const fixed = linter.autoFixAll(code);
    const remainingFixable = linter.lint(fixed).filter(issue => issue.fixable);

    expect(remainingFixable).toEqual([]);
    expect((fixed.match(/@match/g) || [])).toHaveLength(1);
    expect(fixed).toContain('@version');
    expect(fixed).toContain('@description');
    expect(fixed).toContain('@author');
    expect(fixed).not.toContain('@namespace');
    expect(fixed).not.toContain('@installURL');
    expect(fixed).not.toContain('@contributionURL');
  });

  it('renders long unchanged regions as collapsed gap separators in fix previews', () => {
    const linter = createLinter();
    const container = document.createElement('div');
    document.body.replaceChildren(container);
    const bodyLines = [
      "'use strict';",
      ...Array.from({ length: 20 }, (_, index) => `const value${index} = ${index};`),
    ];
    const code = scriptWithMetadata([
      '// @version     1.0.0',
      '// @description Ready',
      '// @author      Tester',
      '// @match       https://example.com/*',
      '// @namespace   legacy',
    ], bodyLines);

    linter.init(container);
    linter.lintAndRender(code);
    container.querySelector('.sv-lint-btn-fixall').click();

    const gap = document.querySelector('.sv-lint-diff-gap');
    expect(gap).toBeTruthy();
    expect(gap.textContent).toMatch(/unchanged lines/);
    expect(document.querySelectorAll('.sv-lint-diff-line-ctx').length).toBeLessThan(bodyLines.length);

    linter.destroy();
  });
});
