// Experimental ESM userscript bundler. Runtime behavior is disabled unless
// Settings.experimentalESMUserscripts is true.

import type { ScriptMeta } from '../types/script';
import type { Settings } from '../types/settings';

declare function fetchRequireScript(url: string): Promise<string | null>;

declare const ScriptAnalyzer: {
  _ensureOffscreen?(): Promise<boolean>;
  analyzeESMImports?(code: string): Promise<ESMSyntaxInfo & { error?: string }>;
};

interface ImportSpecifierInfo {
  kind: 'default' | 'namespace' | 'named';
  local: string;
  imported?: string;
}

export interface ESMImportInfo {
  start: number;
  end: number;
  source: string;
  resolvedSource?: string;
  specifiers: ImportSpecifierInfo[];
}

interface ExportSpecifierInfo {
  local: string;
  exported: string;
}

export interface ESMExportInfo {
  kind: 'default' | 'named-declaration' | 'named-specifiers';
  start: number;
  end: number;
  declarationStart: number;
  declarationEnd: number;
  localName?: string;
  names?: string[];
  specifiers?: ExportSpecifierInfo[];
}

export interface ESMSyntaxInfo {
  imports: ESMImportInfo[];
  exports: ESMExportInfo[];
  dynamicImports: Array<{ line?: number; column?: number }>;
  unsupportedExports?: Array<{ type: string }>;
}

export interface ESMBundleResult {
  code: string;
  imports: Array<{ url: string; bytes: number }>;
  entryUrl: string;
  sourceMap: ESMBundleSourceMap;
}

export interface ESMBundleSourceMap {
  sources: Array<{ url: string; content: string | null }>;
  lineMap: Array<[sourceIndex: number, originalLine: number]>;
  entrySourceIndex: number;
}

interface BundleOptions {
  sourceUrl?: string;
  fetchImport?: (url: string) => Promise<string | null>;
  collectSyntax?: (code: string) => Promise<ESMSyntaxInfo>;
}

interface BundleContext {
  modules: Map<string, {
    url: string;
    code: string;
    originalCode: string;
    lineMap: number[];
    bytes?: number;
  }>;
  fetchImport: (url: string) => Promise<string | null>;
  collectSyntax: (code: string) => Promise<ESMSyntaxInfo>;
}

export function isESMMetadata(meta: Partial<ScriptMeta> | null | undefined): boolean {
  return !!meta && (meta.module === '1' || meta['inject-into'] === 'module' || meta.esm === true);
}

export function resolveImportSpecifier(specifier: string, parentUrl?: string): string {
  if (/^https?:\/\//i.test(specifier)) return specifier;
  if (/^[./]/.test(specifier) && /^https?:\/\//i.test(parentUrl || '')) {
    return new URL(specifier, parentUrl).toString();
  }
  throw new Error(`Unsupported ESM import specifier: ${specifier}`);
}

async function collectSyntaxViaOffscreen(code: string): Promise<ESMSyntaxInfo> {
  if (typeof ScriptAnalyzer !== 'undefined' && typeof ScriptAnalyzer.analyzeESMImports === 'function') {
    const result = await ScriptAnalyzer.analyzeESMImports(code);
    if (!result || result.error) throw new Error(result?.error || 'ESM parse failed');
    if (Array.isArray(result.dynamicImports) && result.dynamicImports.length > 0) {
      const first = result.dynamicImports[0];
      const where = first?.line ? ` at line ${first.line}` : '';
      throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
    }
    if (Array.isArray(result.unsupportedExports) && result.unsupportedExports.length > 0) {
      throw new Error(`Unsupported ESM export syntax: ${result.unsupportedExports[0]?.type}`);
    }
    return result;
  }
  if (typeof ScriptAnalyzer === 'undefined' || !ScriptAnalyzer?._ensureOffscreen) {
    throw new Error('ESM bundler requires the offscreen Acorn parser');
  }
  const ready = await ScriptAnalyzer._ensureOffscreen();
  if (!ready) throw new Error('ESM bundler requires an Acorn parser');
  const result = await chrome.runtime.sendMessage({ type: 'offscreen_esm_imports', code }) as ESMSyntaxInfo & { error?: string };
  if (!result || result.error) throw new Error(result?.error || 'ESM parse failed');
  if (Array.isArray(result.dynamicImports) && result.dynamicImports.length > 0) {
    const first = result.dynamicImports[0];
    const where = first?.line ? ` at line ${first.line}` : '';
    throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
  }
  if (Array.isArray(result.unsupportedExports) && result.unsupportedExports.length > 0) {
    throw new Error(`Unsupported ESM export syntax: ${result.unsupportedExports[0]?.type}`);
  }
  return result;
}

function assertSupportedSyntax(analysis: ESMSyntaxInfo): void {
  if (Array.isArray(analysis.dynamicImports) && analysis.dynamicImports.length > 0) {
    const first = analysis.dynamicImports[0];
    const where = first?.line ? ` at line ${first.line}` : '';
    throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
  }
  if (Array.isArray(analysis.unsupportedExports) && analysis.unsupportedExports.length > 0) {
    throw new Error(`Unsupported ESM export syntax: ${analysis.unsupportedExports[0]?.type}`);
  }
}

function importReplacement(imp: ESMImportInfo): string {
  const id = JSON.stringify(imp.resolvedSource || imp.source);
  if (!imp.specifiers || imp.specifiers.length === 0) {
    return `__require(${id});`;
  }
  const lines: string[] = [];
  const named: string[] = [];
  for (const spec of imp.specifiers) {
    if (spec.kind === 'default') {
      lines.push(`const ${spec.local} = __require(${id}).default;`);
    } else if (spec.kind === 'namespace') {
      lines.push(`const ${spec.local} = __require(${id});`);
    } else if (spec.kind === 'named') {
      named.push(spec.imported === spec.local ? spec.imported! : `${spec.imported}: ${spec.local}`);
    }
  }
  if (named.length) lines.push(`const { ${named.join(', ')} } = __require(${id});`);
  return lines.join('\n');
}

function exportReplacement(exp: ESMExportInfo, code: string): string {
  if (exp.kind === 'named-specifiers') {
    return (exp.specifiers || []).map((spec) => `__exports.${spec.exported} = ${spec.local};`).join('\n');
  }
  const declaration = code.slice(exp.declarationStart, exp.declarationEnd);
  if (exp.kind === 'default') {
    if (exp.localName) return [declaration, `__exports.default = ${exp.localName};`].join('\n');
    return `__exports.default = ${declaration};`;
  }
  const assignments = (exp.names || []).map((name) => `__exports.${name} = ${name};`).join('\n');
  return [declaration, assignments].join('\n');
}

export function rewriteModuleSyntax(code: string, analysis: ESMSyntaxInfo): string {
  return rewriteModuleSyntaxWithLineMap(code, analysis).code;
}

export function rewriteModuleSyntaxWithLineMap(
  code: string,
  analysis: ESMSyntaxInfo,
): { code: string; lineMap: number[] } {
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  for (const imp of analysis.imports || []) {
    replacements.push({ start: imp.start, end: imp.end, text: importReplacement(imp) });
  }
  for (const exp of analysis.exports || []) {
    replacements.push({ start: exp.start, end: exp.end, text: exportReplacement(exp, code) });
  }
  replacements.sort((a, b) => a.start - b.start);

  const output: string[] = [];
  const lineMap: number[] = [];
  let outputLine = 0;
  let cursor = 0;
  let originalLine = 1;

  const appendMapped = (text: string, mappedLines: number[]): void => {
    if (!text) return;
    output.push(text);
    const partCount = text.split('\n').length;
    for (let index = 0; index < partCount; index++) {
      if (lineMap[outputLine] === undefined) {
        lineMap[outputLine] = mappedLines[Math.min(index, mappedLines.length - 1)] || originalLine;
      }
      if (index < partCount - 1) outputLine++;
    }
  };

  const countNewlines = (text: string): number => text.split('\n').length - 1;

  for (const item of replacements) {
    if (item.start < cursor) throw new Error('Overlapping ESM syntax ranges are not supported');
    const unchanged = code.slice(cursor, item.start);
    const unchangedLineCount = countNewlines(unchanged);
    appendMapped(
      unchanged,
      Array.from({ length: unchangedLineCount + 1 }, (_, index) => originalLine + index),
    );
    originalLine += unchangedLineCount;

    const replaced = code.slice(item.start, item.end);
    const replacementEndLine = originalLine + countNewlines(replaced);
    const replacementLineCount = countNewlines(item.text);
    appendMapped(
      item.text,
      Array.from(
        { length: replacementLineCount + 1 },
        (_, index) => Math.min(originalLine + index, replacementEndLine),
      ),
    );
    originalLine = replacementEndLine;
    cursor = item.end;
  }

  const tail = code.slice(cursor);
  const tailLineCount = countNewlines(tail);
  appendMapped(tail, Array.from({ length: tailLineCount + 1 }, (_, index) => originalLine + index));
  return { code: output.join(''), lineMap: lineMap.length > 0 ? lineMap : [1] };
}

function buildBundle(
  entryCode: string,
  entryOriginalCode: string,
  entryLineMap: number[],
  entryUrl: string,
  modules: BundleContext['modules'],
): { code: string; sourceMap: ESMBundleSourceMap } {
  const outputLines: string[] = [];
  const lineMap: ESMBundleSourceMap['lineMap'] = [];
  const sources: ESMBundleSourceMap['sources'] = [
    { url: 'scriptvault://generated/esm-bundle-wrapper.js', content: null },
  ];
  const appendLine = (line: string, sourceIndex = 0, originalLine = 1): void => {
    outputLines.push(line);
    lineMap.push([sourceIndex, Math.max(1, originalLine)]);
  };
  const appendSource = (code: string, sourceIndex: number, mappedLines: number[]): void => {
    code.split('\n').forEach((line, index) => {
      appendLine(line, sourceIndex, mappedLines[index] || mappedLines.at(-1) || index + 1);
    });
  };

  appendLine('(function () {');
  appendLine("'use strict';");
  appendLine('const __modules = Object.create(null);');
  appendLine('const __cache = Object.create(null);');
  for (const mod of modules.values()) {
    const sourceIndex = sources.push({ url: mod.url, content: mod.originalCode }) - 1;
    appendLine(`__modules[${JSON.stringify(mod.url)}] = function(__module, __exports, __require) {`);
    appendSource(mod.code, sourceIndex, mod.lineMap);
    appendLine('};');
  }
  appendLine('function __require(id) {');
  appendLine('  if (__cache[id]) return __cache[id].exports;');
  appendLine('  const factory = __modules[id];');
  appendLine('  if (!factory) throw new Error("Missing ESM module: " + id);');
  appendLine('  const module = { exports: {} };');
  appendLine('  __cache[id] = module;');
  appendLine('  factory(module, module.exports, __require);');
  appendLine('  return module.exports;');
  appendLine('}');
  appendLine('const __exports = {};');
  const entrySourceIndex = sources.push({ url: entryUrl, content: entryOriginalCode }) - 1;
  appendSource(entryCode, entrySourceIndex, entryLineMap);
  appendLine('})();');

  return {
    code: outputLines.join('\n'),
    sourceMap: { sources, lineMap, entrySourceIndex },
  };
}

async function bundleModule(url: string, code: string, context: BundleContext): Promise<void> {
  if (context.modules.has(url)) return;
  context.modules.set(url, { url, code: '', originalCode: code, lineMap: [1] });

  const analysis = await context.collectSyntax(code);
  assertSupportedSyntax(analysis);
  for (const imp of analysis.imports || []) {
    imp.resolvedSource = resolveImportSpecifier(imp.source, url);
    const depCode = await context.fetchImport(imp.resolvedSource);
    if (!depCode) throw new Error(`Failed to fetch ESM import: ${imp.resolvedSource}`);
    await bundleModule(imp.resolvedSource, depCode, context);
  }

  const rewritten = rewriteModuleSyntaxWithLineMap(code, analysis);
  context.modules.set(url, {
    url,
    code: rewritten.code,
    originalCode: code,
    lineMap: rewritten.lineMap,
    bytes: code.length,
  });
}

export async function bundle(code: string, options: BundleOptions = {}): Promise<ESMBundleResult> {
  const entryUrl = options.sourceUrl || 'scriptvault:entry';
  const context: BundleContext = {
    modules: new Map(),
    fetchImport: options.fetchImport || fetchRequireScript,
    collectSyntax: options.collectSyntax || collectSyntaxViaOffscreen,
  };
  const entryAnalysis = await context.collectSyntax(code);
  assertSupportedSyntax(entryAnalysis);
  for (const imp of entryAnalysis.imports || []) {
    imp.resolvedSource = resolveImportSpecifier(imp.source, entryUrl);
    const depCode = await context.fetchImport(imp.resolvedSource);
    if (!depCode) throw new Error(`Failed to fetch ESM import: ${imp.resolvedSource}`);
    await bundleModule(imp.resolvedSource, depCode, context);
  }
  const rewrittenEntry = rewriteModuleSyntaxWithLineMap(code, entryAnalysis);
  const built = buildBundle(
    rewrittenEntry.code,
    code,
    rewrittenEntry.lineMap,
    entryUrl,
    context.modules,
  );
  return {
    code: built.code,
    imports: [...context.modules.values()].map((mod) => ({ url: mod.url, bytes: mod.bytes || 0 })),
    entryUrl,
    sourceMap: built.sourceMap,
  };
}

export async function bundleIfNeeded(
  code: string,
  meta: Partial<ScriptMeta>,
  settings: Partial<Settings>,
  options: BundleOptions = {},
): Promise<ESMBundleResult & { bundled: boolean }> {
  if (!isESMMetadata(meta)) {
    return {
      bundled: false,
      code,
      imports: [],
      entryUrl: options.sourceUrl || '',
      sourceMap: { sources: [], lineMap: [], entrySourceIndex: 0 },
    };
  }
  if (!settings?.experimentalESMUserscripts) {
    throw new Error('ESM userscripts are experimental and require the experimentalESMUserscripts setting.');
  }
  const result = await bundle(code, options);
  return { bundled: true, ...result };
}

export const ESMUserscriptBundler = {
  isESMMetadata,
  resolveImportSpecifier,
  rewriteModuleSyntax,
  rewriteModuleSyntaxWithLineMap,
  bundle,
  bundleIfNeeded,
};
