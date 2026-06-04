import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'bg/esm-bundler.js'), 'utf8');

function createBundler(fetchRequireScript = async () => null) {
  const self = {};
  const fn = new Function(
    'chrome',
    'ScriptAnalyzer',
    'fetchRequireScript',
    'self',
    `${code}\nreturn { bundler: ESMUserscriptBundler, selfExport: self.ESMUserscriptBundler };`,
  );
  return fn(
    { runtime: { sendMessage: async () => ({ imports: [], exports: [], dynamicImports: [], unsupportedExports: [] }) } },
    { _ensureOffscreen: async () => undefined },
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
});
