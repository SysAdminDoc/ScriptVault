// @vitest-environment node
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const generator = readFileSync(resolve(root, 'scripts/generate-ts-runtime-modules.mjs'), 'utf8');

describe('TypeScript compiler contract', () => {
  it('pins TypeScript 7 as the project compiler', () => {
    expect(packageJson.devDependencies.typescript).toBe('7.0.2');
    expect(require('typescript').version).toBe('7.0.2');
  });

  it('isolates the AST transform on the pinned TypeScript 6 alias', () => {
    expect(packageJson.devDependencies['typescript-6']).toBe('npm:typescript@6.0.3');
    expect(require('typescript-6').version).toBe('6.0.3');
    expect(generator).toContain("import ts from 'typescript-6';");
    expect(generator).not.toContain("import ts from 'typescript';");
  });
});
