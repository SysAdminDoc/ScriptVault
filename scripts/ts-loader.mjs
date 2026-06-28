// scripts/ts-loader.mjs
// Minimal Node loader that transpiles `.ts` source on-the-fly using esbuild
// (already a dev dep). Used by smoke-large-library.mjs so it can import the
// authoritative MatchSet implementation from src/background/url-matcher.ts
// without a separate build step.
//
// Only handles bare .ts files. Does not strip types from `.d.ts` (handled by
// `resolve` returning `null`). Does not chase node_modules — only source
// files under the repo are transpiled.

import { access, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const TS_EXTENSIONS = /\.ts$/;
const TSX_EXTENSIONS = /\.tsx$/;

export async function resolve(specifier, context, nextResolve) {
  // Force .ts and .tsx to be treated as ESM source for Node.
  if (TS_EXTENSIONS.test(specifier) || TSX_EXTENSIONS.test(specifier)) {
    const base = context.parentURL ? new URL(specifier, context.parentURL) : new URL(specifier);
    return { url: base.href, shortCircuit: true, format: 'module' };
  }
  if (
    context.parentURL &&
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !/\.[cm]?[jt]sx?$/.test(specifier)
  ) {
    const tsCandidate = new URL(`${specifier}.ts`, context.parentURL);
    try {
      await access(fileURLToPath(tsCandidate));
      return { url: tsCandidate.href, shortCircuit: true, format: 'module' };
    } catch {
      // Fall through to Node's resolver.
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const path = fileURLToPath(url);
    const source = await readFile(path, 'utf8');
    const { code } = await transform(source, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'es2022',
      sourcemap: 'inline',
      sourcefile: path
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
