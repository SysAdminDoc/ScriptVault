import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as acorn from 'acorn';

const ROOT = process.cwd();
const offscreenJs = readFileSync(resolve(ROOT, 'offscreen.js'), 'utf8');
const diffJs = readFileSync(resolve(ROOT, 'lib/diff.min.js'), 'utf8');

function loadOffscreen() {
  const stripped = offscreenJs.replace(
    /^chrome\.runtime\.onMessage\.addListener[\s\S]*?\n\}\);/m,
    ''
  );
  const _body = `
    var Diff = (function() { var module = { exports: {} }; var exports = module.exports;
    ${diffJs}
    return module.exports;
    })();
    ${stripped}
    return { handleAnalyze, handleMerge, handleDiff, handleESMImports };
  `;
  let fn;
  try { const vm = require('node:vm'); fn = vm.compileFunction(_body, ['acorn'], { filename: resolve(ROOT, 'offscreen.js') }); } catch { fn = new Function('acorn', _body); }
  return fn(acorn);
}

const { handleAnalyze, handleMerge, handleDiff, handleESMImports } = loadOffscreen();

describe('offscreen AST analysis', () => {
  it('detects eval in valid JS', () => {
    const result = handleAnalyze('eval("alert(1)");');
    expect(result.astAnalyzed).toBe(true);
    expect(result.findings.some(f => f.id === 'eval')).toBe(true);
    expect(result.totalRisk).toBeGreaterThan(0);
  });

  it('returns parse error for invalid JS', () => {
    const result = handleAnalyze('function {{{');
    expect(result.parseError).toBe(true);
    expect(result.summary).toMatch(/Parse error/);
  });

  it('handles empty input', () => {
    const result = handleAnalyze('');
    expect(result.astAnalyzed).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.riskLevel).toBe('minimal');
  });

  it('skips analysis for oversized scripts', () => {
    const bigCode = 'var x = 1;\n'.repeat(250000);
    const result = handleAnalyze(bigCode);
    expect(result.skipped).toBe(true);
    expect(result.summary).toMatch(/too large/);
  });

  it('reports risk level thresholds', () => {
    const clean = handleAnalyze('console.log("safe");');
    expect(clean.riskLevel).toBe('minimal');

    const risky = handleAnalyze(`
      eval("x"); eval("y"); eval("z");
      document.cookie;
      new Function("return 1");
    `);
    expect(['medium', 'high']).toContain(risky.riskLevel);
  });
});

describe('offscreen 3-way merge', () => {
  it('actually merges non-overlapping edits (not a conflict-marker fallback)', () => {
    const base = 'aaa\nbbb\nccc\nddd\neee\nfff\nggg\nhhh\n';
    const local = 'aaa-local\nbbb\nccc\nddd\neee\nfff\nggg\nhhh\n';
    const remote = 'aaa\nbbb\nccc\nddd\neee\nfff\nggg\nhhh-remote\n';
    const result = handleMerge(base, local, remote);
    expect(result.conflicts).toBe(false);
    // Both sides' non-overlapping edits must survive the merge — this is the
    // regression guard for the jsdiff-v7 3-way merge (Diff.merge was removed).
    expect(result.merged).toContain('aaa-local');
    expect(result.merged).toContain('hhh-remote');
    expect(result.merged).not.toContain('<<<<<<<');
  });

  it('detects conflicts with markers', () => {
    const base = 'line1\nline2\nline3\n';
    const local = 'line1\nline2-LOCAL\nline3\n';
    const remote = 'line1\nline2-REMOTE\nline3\n';
    const result = handleMerge(base, local, remote);
    expect(result.conflicts).toBe(true);
    expect(result.merged).toContain('<<<<<<< LOCAL');
    expect(result.merged).toContain('>>>>>>> REMOTE');
  });

  it('returns local when remote matches base', () => {
    const base = 'original\n';
    const local = 'modified\n';
    const result = handleMerge(base, local, base);
    expect(result.merged).toBe(local);
    expect(result.conflicts).toBe(false);
  });

  it('returns remote when local matches base', () => {
    const base = 'original\n';
    const remote = 'modified\n';
    const result = handleMerge(base, base, remote);
    expect(result.merged).toBe(remote);
    expect(result.conflicts).toBe(false);
  });

  it('handles identical local and remote', () => {
    const result = handleMerge('base', 'same', 'same');
    expect(result.merged).toBe('same');
    expect(result.conflicts).toBe(false);
  });

  it('returns error for null inputs', () => {
    expect(handleMerge(null, 'a', 'b')).toHaveProperty('error');
    expect(handleMerge('a', null, 'b')).toHaveProperty('error');
    expect(handleMerge('a', 'b', null)).toHaveProperty('error');
  });

  it('handles empty base merge', () => {
    const result = handleMerge('', 'local content\n', 'remote content\n');
    expect(result).toHaveProperty('merged');
  });
});

describe('offscreen diff', () => {
  it('computes line diff stats', () => {
    const result = handleDiff('line1\nline2\n', 'line1\nline3\n');
    expect(result.stats).toBeDefined();
    expect(result.stats.added).toBeGreaterThan(0);
    expect(result.stats.removed).toBeGreaterThan(0);
  });

  it('handles identical inputs', () => {
    const result = handleDiff('same\n', 'same\n');
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
  });

  it('handles empty inputs', () => {
    const result = handleDiff('', '');
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
  });
});

describe('offscreen ESM imports', () => {
  it('extracts static imports', () => {
    const result = handleESMImports('import { foo } from "./bar.js";\nconsole.log(foo);');
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe('./bar.js');
  });

  it('detects dynamic imports', () => {
    const result = handleESMImports('const m = import("./lazy.js");');
    expect(result.dynamicImports).toHaveLength(1);
  });

  it('returns error for invalid module syntax', () => {
    const result = handleESMImports('function {{{');
    expect(result.error).toMatch(/ESM parse error/);
  });
});
