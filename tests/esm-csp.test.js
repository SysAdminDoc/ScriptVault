import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { bundle } from '../src/bg/esm-bundler.ts';

const acornSandbox = {};
vm.runInNewContext(readFileSync('lib/acorn.min.js', 'utf8'), acornSandbox);
const { acorn } = acornSandbox;

async function collectSyntax(code) {
  const ast = acorn.parse(code, {
    ecmaVersion: 2022,
    sourceType: 'module',
    allowHashBang: true,
    locations: true,
  });
  const imports = [];
  const dynamicImports = [];
  const unsupportedExports = [];

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration') {
      imports.push({
        start: node.start,
        end: node.end,
        source: node.source.value,
        specifiers: node.specifiers.map((spec) => {
          if (spec.type === 'ImportDefaultSpecifier') return { kind: 'default', local: spec.local.name };
          return { kind: 'named', imported: spec.imported?.name || spec.imported?.value, local: spec.local.name };
        }),
      });
    } else if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee?.type === 'Import')) {
      dynamicImports.push({ line: node.loc?.start?.line || 0, column: node.loc?.start?.column || 0 });
    } else if (node.type === 'ExportAllDeclaration') {
      unsupportedExports.push({ type: 'export-all' });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value?.type) walk(value);
    }
  }
  walk(ast);
  return { imports, exports: [], dynamicImports, unsupportedExports };
}

function userscript(body) {
  return [
    '// ==UserScript==',
    '// @name ESM CSP Demo',
    '// @namespace test',
    '// @match https://example.com/*',
    '// @module 1',
    '// @grant none',
    '// ==/UserScript==',
    body,
  ].join('\n');
}

describe('ESM userscript CSP boundaries', () => {
  it('rejects dynamic import() with an author-visible parse error', async () => {
    await expect(bundle(userscript("const mod = await import('https://cdn.example.com/mod.js');"), {
      sourceUrl: 'https://cdn.example.com/main.user.js',
      collectSyntax,
      fetchImport: async () => 'export default {};',
    })).rejects.toThrow('Dynamic import() is not supported');
  });

  it('rejects imports that fail the existing require fetch/SRI path', async () => {
    await expect(bundle(userscript("import bad from 'https://cdn.example.com/bad.js#sha256-deadbeef';\nbad();"), {
      sourceUrl: 'https://cdn.example.com/main.user.js',
      collectSyntax,
      fetchImport: async () => null,
    })).rejects.toThrow('Failed to fetch ESM import: https://cdn.example.com/bad.js#sha256-deadbeef');
  });
});
