import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  ESMUserscriptBundler,
  bundle,
  bundleIfNeeded,
  isESMMetadata,
  resolveImportSpecifier,
} from '../src/bg/esm-bundler.ts';
import { parseUserscript } from '../src/background/parser.ts';

const acornSandbox = {};
vm.runInNewContext(readFileSync('lib/acorn.min.js', 'utf8'), acornSandbox);
const { acorn } = acornSandbox;

function walkAST(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (node.type) {
    node._parent = parent;
    visitor(node);
    delete node._parent;
  }
  for (const key of Object.keys(node)) {
    if (key === '_parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item?.type) walkAST(item, visitor, node);
      }
    } else if (child?.type) {
      walkAST(child, visitor, node);
    }
  }
}

function declaredExportNames(declaration) {
  if (!declaration) return [];
  if ((declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') && declaration.id?.name) {
    return [declaration.id.name];
  }
  if (declaration.type === 'VariableDeclaration') {
    return declaration.declarations.map((decl) => decl.id?.name).filter(Boolean);
  }
  return [];
}

async function collectSyntax(code) {
  const ast = acorn.parse(code, {
    ecmaVersion: 2022,
    sourceType: 'module',
    allowHashBang: true,
    locations: true,
  });
  const imports = [];
  const exports = [];
  const dynamicImports = [];
  const unsupportedExports = [];

  walkAST(ast, (node) => {
    if (node.type === 'ImportDeclaration') {
      imports.push({
        start: node.start,
        end: node.end,
        source: node.source.value,
        specifiers: node.specifiers.map((spec) => {
          if (spec.type === 'ImportDefaultSpecifier') return { kind: 'default', local: spec.local.name };
          if (spec.type === 'ImportNamespaceSpecifier') return { kind: 'namespace', local: spec.local.name };
          return { kind: 'named', imported: spec.imported.name || spec.imported.value, local: spec.local.name };
        }),
      });
    } else if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee?.type === 'Import')) {
      dynamicImports.push({ line: node.loc?.start?.line || 0, column: node.loc?.start?.column || 0 });
    } else if (node.type === 'ExportDefaultDeclaration') {
      exports.push({
        kind: 'default',
        start: node.start,
        end: node.end,
        declarationStart: node.declaration.start,
        declarationEnd: node.declaration.end,
        localName: node.declaration.id?.name || null,
      });
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.source) {
        unsupportedExports.push({ type: 're-export' });
      } else if (node.declaration) {
        exports.push({
          kind: 'named-declaration',
          start: node.start,
          end: node.end,
          declarationStart: node.declaration.start,
          declarationEnd: node.declaration.end,
          names: declaredExportNames(node.declaration),
        });
      } else {
        exports.push({
          kind: 'named-specifiers',
          start: node.start,
          end: node.end,
          declarationStart: node.start,
          declarationEnd: node.end,
          specifiers: node.specifiers.map((spec) => ({
            local: spec.local.name || spec.local.value,
            exported: spec.exported.name || spec.exported.value,
          })),
        });
      }
    } else if (node.type === 'ExportAllDeclaration') {
      unsupportedExports.push({ type: 'export-all' });
    }
  });

  return { imports, exports, dynamicImports, unsupportedExports };
}

function userscript(body, meta = '// @module 1') {
  return [
    '// ==UserScript==',
    '// @name ESM Demo',
    '// @namespace test',
    '// @match https://example.com/*',
    meta,
    '// @grant none',
    '// ==/UserScript==',
    body,
  ].join('\n');
}

describe('ESM userscript bundler', () => {
  it('detects @module and Violentmonkey module metadata', () => {
    expect(isESMMetadata({ module: '1' })).toBe(true);
    expect(isESMMetadata({ 'inject-into': 'module' })).toBe(true);
    expect(isESMMetadata({ module: '', 'inject-into': 'auto' })).toBe(false);
    expect(ESMUserscriptBundler.isESMMetadata({ module: '1' })).toBe(true);
  });

  it('marks parser metadata as ESM for supported directives while the setting defaults off', () => {
    const moduleParsed = parseUserscript(userscript('console.log("module");'));
    const vmParsed = parseUserscript(userscript('console.log("vm");', '// @inject-into module'));
    const defaults = JSON.parse(readFileSync('src/config/settings-defaults.json', 'utf8'));

    expect(moduleParsed.meta.esm).toBe(true);
    expect(moduleParsed.meta.module).toBe('1');
    expect(vmParsed.meta.esm).toBe(true);
    expect(defaults.experimentalESMUserscripts).toBe(false);
  });

  it('rewrites static default imports into __require calls', async () => {
    const source = userscript([
      "import helper from 'https://cdn.example.com/helper.js';",
      'helper();',
    ].join('\n'));
    const fetchImport = vi.fn(async () => 'export default function helper() { return 1; }');

    const result = await bundle(source, {
      sourceUrl: 'https://cdn.example.com/main.user.js',
      collectSyntax,
      fetchImport,
    });

    expect(fetchImport).toHaveBeenCalledWith('https://cdn.example.com/helper.js');
    expect(result.imports).toEqual([{ url: 'https://cdn.example.com/helper.js', bytes: 46 }]);
    expect(result.code).toContain('const helper = __require("https://cdn.example.com/helper.js").default;');
    expect(result.code).toContain('__exports.default = helper;');
    expect(result.code).not.toContain("import helper from 'https://cdn.example.com/helper.js'");
  });

  it('expands transitive dependencies and resolves relative imports', async () => {
    const source = userscript("import helper from 'https://cdn.example.com/lib/helper.js';\nhelper();");
    const sources = new Map([
      ['https://cdn.example.com/lib/helper.js', "import { value } from './value.js';\nexport default function helper() { return value; }"],
      ['https://cdn.example.com/lib/value.js', 'export const value = 42;'],
    ]);

    const result = await bundle(source, {
      sourceUrl: 'https://cdn.example.com/main.user.js',
      collectSyntax,
      fetchImport: async (url) => sources.get(url) || null,
    });

    expect(result.imports.map((item) => item.url)).toEqual([
      'https://cdn.example.com/lib/helper.js',
      'https://cdn.example.com/lib/value.js',
    ]);
    expect(result.code).toContain('const { value } = __require("https://cdn.example.com/lib/value.js");');
    expect(result.code).toContain('__exports.value = value;');
  });

  it('rejects bare specifiers that cannot be resolved safely', async () => {
    expect(() => resolveImportSpecifier('lodash', 'https://cdn.example.com/main.user.js')).toThrow('Unsupported ESM import specifier');
  });

  it('keeps disabled-by-default bundling behind the settings flag', async () => {
    const source = userscript("import helper from 'https://cdn.example.com/helper.js';\nhelper();");

    await expect(bundleIfNeeded(source, { module: '1' }, { experimentalESMUserscripts: false }, {
      collectSyntax,
      fetchImport: async () => 'export default function helper() {}',
    })).rejects.toThrow('experimentalESMUserscripts');

    await expect(bundleIfNeeded(source, { module: '1' }, { experimentalESMUserscripts: true }, {
      sourceUrl: 'https://cdn.example.com/main.user.js',
      collectSyntax,
      fetchImport: async () => 'export default function helper() {}',
    })).resolves.toMatchObject({ bundled: true });
  });
});
