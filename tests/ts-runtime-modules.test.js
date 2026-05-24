import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TS_RUNTIME_MODULES,
  buildTsRuntimeModuleText,
  generateTsRuntimeModules,
} from '../scripts/generate-ts-runtime-modules.mjs';

const ROOT = process.cwd();

describe('TS runtime module generator', () => {
  it('declares the promoted error-log module', () => {
    expect(TS_RUNTIME_MODULES).toEqual([
      expect.objectContaining({
        id: 'error-log',
        source: 'src/modules/error-log.ts',
        output: 'modules/error-log.js',
        exportName: 'ErrorLog',
      }),
    ]);
  });

  it('generates a runtime-compatible ErrorLog artifact from TypeScript', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'error-log');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/modules/error-log.ts');
    expect(text).toContain('const ErrorLog = (() => {');
    expect(text).toContain('return module.exports.default || module.exports.ErrorLog || module.exports;');
    expect(text).not.toContain('export default');
  });

  it('keeps the committed error-log artifact in sync', async () => {
    const results = await generateTsRuntimeModules({ rootDir: ROOT, check: true, modules: ['error-log'] });
    const current = readFileSync(resolve(ROOT, 'modules/error-log.js'), 'utf8').replace(/\r\n/g, '\n');
    const expected = await buildTsRuntimeModuleText(TS_RUNTIME_MODULES[0], { rootDir: ROOT });

    expect(results).toEqual([
      expect.objectContaining({ id: 'error-log', changed: false }),
    ]);
    expect(current).toBe(expected);
  });
});
