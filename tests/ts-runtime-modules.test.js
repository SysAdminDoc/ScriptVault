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
    expect(TS_RUNTIME_MODULES).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'error-log',
        source: 'src/modules/error-log.ts',
        output: 'modules/error-log.js',
        exportName: 'ErrorLog',
      }),
      expect.objectContaining({
        id: 'notifications',
        source: 'src/modules/notifications.ts',
        output: 'modules/notifications.js',
        exportName: 'NotificationSystem',
      }),
    ]));
  });

  it('generates runtime-compatible artifacts from TypeScript', async () => {
    const definition = TS_RUNTIME_MODULES.find((entry) => entry.id === 'notifications');
    const text = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });

    expect(text).toContain('Generated from src/modules/notifications.ts');
    expect(text).toContain('const NotificationSystem = (() => {');
    expect(text).toContain('return module.exports.default || module.exports.NotificationSystem || module.exports;');
    expect(text).not.toContain('export default');
  });

  it('keeps committed runtime artifacts in sync', async () => {
    const results = await generateTsRuntimeModules({ rootDir: ROOT, check: true });

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'error-log', changed: false }),
      expect.objectContaining({ id: 'notifications', changed: false }),
    ]));
    for (const definition of TS_RUNTIME_MODULES) {
      const current = readFileSync(resolve(ROOT, definition.output), 'utf8').replace(/\r\n/g, '\n');
      const expected = await buildTsRuntimeModuleText(definition, { rootDir: ROOT });
      expect(current).toBe(expected);
    }
  });
});
