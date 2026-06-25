import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'bg/esm-bundler.js'), 'utf8');

function createBundler(fetchRequireScript = async () => null, analyzer = { _ensureOffscreen: async () => undefined }) {
  const self = {};
  const _body = `${code}\nreturn { bundler: ESMUserscriptBundler, selfExport: self.ESMUserscriptBundler };`;
  let fn;
  try { const vm = require('node:vm'); fn = vm.compileFunction(_body, ['chrome', 'ScriptAnalyzer', 'fetchRequireScript', 'self'], { filename: resolve(process.cwd(), 'bg/esm-bundler.js') }); } catch { fn = new Function('chrome', 'ScriptAnalyzer', 'fetchRequireScript', 'self', _body); }
  return fn(
    { runtime: { sendMessage: async () => ({ imports: [], exports: [], dynamicImports: [], unsupportedExports: [] }) } },
    analyzer,
    fetchRequireScript,
    self,
  );
}

function blankSyntax() {
  return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [] };
}

describe('generated ESM userscript bundler runtime', () => {
  it('keeps the service-worker global alias', () => {
    const { bundler, selfExport } = createBundler();

    expect(selfExport).toBe(bundler);
    expect(bundler.isESMMetadata({ module: '1' })).toBe(true);
  });

  it('uses the runtime fetchRequireScript dependency by default', async () => {
    const source = "import value from 'https://cdn.example.com/value.js';\nconsole.log(value);";
    const dependency = 'export default 7;';
    const fetchRequireScript = vi.fn(async () => dependency);
    const { bundler } = createBundler(fetchRequireScript);
    const collectSyntax = async (codeText) => {
      if (codeText === source) {
        return {
          imports: [{
            start: 0,
            end: source.indexOf('\n'),
            source: 'https://cdn.example.com/value.js',
            specifiers: [{ kind: 'default', local: 'value' }],
          }],
          exports: [],
          dynamicImports: [],
          unsupportedExports: [],
        };
      }
      if (codeText === dependency) {
        return {
          imports: [],
          exports: [{
            kind: 'default',
            start: 0,
            end: dependency.length,
            declarationStart: 'export default '.length,
            declarationEnd: dependency.length - 1,
            localName: null,
          }],
          dynamicImports: [],
          unsupportedExports: [],
        };
      }
      return blankSyntax();
    };

    const result = await bundler.bundle(source, {
      sourceUrl: 'https://cdn.example.com/main.user.js',
      collectSyntax,
    });

    expect(fetchRequireScript).toHaveBeenCalledWith('https://cdn.example.com/value.js');
    expect(result.code).toContain('const value = __require("https://cdn.example.com/value.js").default;');
    expect(result.code).toContain('__exports.default = 7;');
  });

  it('uses ScriptAnalyzer inline ESM parsing when available', async () => {
    const source = "import { answer } from 'https://cdn.example.com/value.js';\nconsole.log(answer);";
    const dependency = 'export const answer = 42;';
    const fetchRequireScript = vi.fn(async () => dependency);
    const analyzeESMImports = vi.fn(async (codeText) => {
      if (codeText === source) {
        return {
          imports: [{
            start: 0,
            end: source.indexOf('\n'),
            source: 'https://cdn.example.com/value.js',
            specifiers: [{ kind: 'named', imported: 'answer', local: 'answer' }],
          }],
          exports: [],
          dynamicImports: [],
          unsupportedExports: [],
        };
      }
      if (codeText === dependency) {
        return {
          imports: [],
          exports: [{
            kind: 'named-declaration',
            start: 0,
            end: dependency.length,
            declarationStart: 'export '.length,
            declarationEnd: dependency.length,
            names: ['answer'],
          }],
          dynamicImports: [],
          unsupportedExports: [],
        };
      }
      return blankSyntax();
    });
    const { bundler } = createBundler(fetchRequireScript, { analyzeESMImports });

    const result = await bundler.bundle(source, {
      sourceUrl: 'https://cdn.example.com/main.user.js',
    });

    expect(analyzeESMImports).toHaveBeenCalledWith(source);
    expect(fetchRequireScript).toHaveBeenCalledWith('https://cdn.example.com/value.js');
    expect(result.code).toContain('const { answer } = __require("https://cdn.example.com/value.js");');
    expect(result.code).toContain('__exports.answer = answer;');
  });
});
