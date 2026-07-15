// Deterministic userscript source identity and line mapping.

export interface SourceMapSource {
  url: string;
  content: string | null;
}

export interface EmbeddedSourceSegment extends SourceMapSource {
  sources?: SourceMapSource[];
  lineMap?: Array<[sourceIndex: number, originalLine: number]>;
}

export interface FinalizeWrappedSourceOptions {
  scriptId: string;
  scriptName?: string;
  segments: EmbeddedSourceSegment[];
}

export interface ResolvedGeneratedLocation {
  source: string;
  line: number;
  column: number;
  generatedLine: number;
  generatedColumn: number;
}

const SOURCE_BEGIN = /^\s*\/\*__SV_SOURCE_BEGIN_(\d+)__\*\/\s*$/u;
const SOURCE_END = /^\s*\/\*__SV_SOURCE_END__\*\/\s*$/u;
const SOURCE_DIRECTIVE = /^\s*(?:\/\/[#@]\s*source(?:Mapping)?URL\s*=.*|\/\*[#@]\s*source(?:Mapping)?URL\s*=.*\*\/)\s*$/iu;
const RUNTIME_SEGMENTS_PLACEHOLDER = '__SV_RUNTIME_LOCATION_SEGMENTS__';
const GENERATED_URL_PLACEHOLDER = '__SV_GENERATED_SOURCE_URL__';
const BASE64_VLQ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_BUNDLED_SOURCES = 256;
const MAX_BUNDLED_LINES = 200_000;
const MAX_SOURCE_CONTENT_BYTES = 5_000_000;

function safePathSegment(value: unknown, fallback: string): string {
  const normalized = String(value || fallback).replace(/[\u0000-\u001f\u007f]/gu, '').trim() || fallback;
  return encodeURIComponent(normalized).slice(0, 240);
}

export function deterministicScriptSourceUrl(scriptId: string, scriptName?: string): string {
  return `scriptvault://userscript/${safePathSegment(scriptId, 'script')}/${safePathSegment(scriptName, 'userscript')}.user.js`;
}

export function deterministicGeneratedSourceUrl(scriptId: string): string {
  return `scriptvault://generated/${safePathSegment(scriptId, 'script')}/wrapper.js`;
}

export function deterministicRequireSourceUrl(scriptId: string, index: number, url: unknown): string {
  const normalized = typeof url === 'string'
    ? url.replace(/[\u0000-\u001f\u007f]/gu, '').trim()
    : '';
  return normalized || `scriptvault://require/${safePathSegment(scriptId, 'script')}/${index + 1}.js`;
}

export function neutralizeSourceDirectives(code: unknown): string {
  return String(code ?? '')
    .split(/\r?\n/u)
    .map((line) => {
      if (SOURCE_DIRECTIVE.test(line)) return '// [ScriptVault neutralized source directive]';
      if (SOURCE_BEGIN.test(line) || SOURCE_END.test(line)) return '// [ScriptVault neutralized source marker]';
      return line;
    })
    .join('\n');
}

function neutralizeGeneratedDirectives(code: string): string {
  return code
    .split(/\r?\n/u)
    .map((line) => SOURCE_DIRECTIVE.test(line) ? '// [ScriptVault neutralized source directive]' : line)
    .join('\n');
}

export function markSourceSegment(index: number, code: string): string {
  if (!Number.isInteger(index) || index < 0) throw new Error('Invalid wrapped source segment index');
  return `/*__SV_SOURCE_BEGIN_${index}__*/\n${neutralizeSourceDirectives(code)}\n/*__SV_SOURCE_END__*/`;
}

export function createBundledSourceSegment(
  scriptId: string,
  scriptName: string | undefined,
  bundledCode: string,
  input: unknown,
): EmbeddedSourceSegment | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as {
    sources?: unknown;
    lineMap?: unknown;
    entrySourceIndex?: unknown;
  };
  if (!Array.isArray(value.sources) || value.sources.length === 0 || value.sources.length > MAX_BUNDLED_SOURCES) {
    return null;
  }
  const generatedLines = bundledCode.split(/\r?\n/u).length;
  if (
    !Array.isArray(value.lineMap) ||
    value.lineMap.length !== generatedLines ||
    value.lineMap.length > MAX_BUNDLED_LINES
  ) {
    return null;
  }
  const entrySourceIndex = Number(value.entrySourceIndex);
  if (!Number.isInteger(entrySourceIndex) || entrySourceIndex < 0 || entrySourceIndex >= value.sources.length) {
    return null;
  }

  const sources: SourceMapSource[] = [];
  for (const [index, rawSource] of value.sources.entries()) {
    if (!rawSource || typeof rawSource !== 'object') return null;
    const candidate = rawSource as { url?: unknown; content?: unknown };
    const rawUrl = typeof candidate.url === 'string'
      ? candidate.url.replace(/[\u0000-\u001f\u007f]/gu, '').trim().slice(0, 4096)
      : '';
    const url = index === entrySourceIndex
      ? deterministicScriptSourceUrl(scriptId, scriptName)
      : (/^(?:https?:\/\/|scriptvault:)/iu.test(rawUrl)
          ? rawUrl
          : `scriptvault://generated/${safePathSegment(scriptId, 'script')}/esm-source-${index + 1}.js`);
    if (
      candidate.content !== null &&
      candidate.content !== undefined &&
      (typeof candidate.content !== 'string' || candidate.content.length > MAX_SOURCE_CONTENT_BYTES)
    ) {
      return null;
    }
    sources.push({ url, content: typeof candidate.content === 'string' ? candidate.content : null });
  }

  const lineMap: Array<[number, number]> = [];
  for (const rawLine of value.lineMap) {
    if (!Array.isArray(rawLine) || rawLine.length < 2) return null;
    const sourceIndex = Number(rawLine[0]);
    const originalLine = Number(rawLine[1]);
    if (
      !Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= sources.length ||
      !Number.isInteger(originalLine) || originalLine < 1 || originalLine > 10_000_000
    ) {
      return null;
    }
    lineMap.push([sourceIndex, originalLine]);
  }

  return {
    url: `${deterministicGeneratedSourceUrl(scriptId)}?source=esm-bundle`,
    content: neutralizeSourceDirectives(bundledCode),
    sources,
    lineMap,
  };
}

function encodeVlq(value: number): string {
  let encoded = '';
  let vlq = value < 0 ? ((-value) << 1) | 1 : value << 1;
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) digit |= 32;
    encoded += BASE64_VLQ[digit];
  } while (vlq > 0);
  return encoded;
}

function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function sourceMapMappings(lines: Array<{ source: number; originalLine: number }>): string {
  let previousSource = 0;
  let previousOriginalLine = 0;
  let previousOriginalColumn = 0;
  return lines.map((line) => {
    const mapping = [
      encodeVlq(0),
      encodeVlq(line.source - previousSource),
      encodeVlq(line.originalLine - previousOriginalLine),
      encodeVlq(-previousOriginalColumn),
    ].join('');
    previousSource = line.source;
    previousOriginalLine = line.originalLine;
    previousOriginalColumn = 0;
    return mapping;
  }).join(';');
}

function addRuntimeRange(
  ranges: Array<[number, number, string, number]>,
  generatedLine: number,
  source: string,
  originalLine: number,
): void {
  const previous = ranges.at(-1);
  if (
    previous &&
    previous[2] === source &&
    previous[1] + 1 === generatedLine &&
    previous[3] + (previous[1] - previous[0]) + 1 === originalLine
  ) {
    previous[1] = generatedLine;
    return;
  }
  ranges.push([generatedLine, generatedLine, source, originalLine]);
}

export function finalizeWrappedSource(
  generatedCode: string,
  options: FinalizeWrappedSourceOptions,
): string {
  const generatedUrl = deterministicGeneratedSourceUrl(options.scriptId);
  const wrapperUrl = `${generatedUrl}?source=wrapper`;
  const sources: SourceMapSource[] = [{ url: wrapperUrl, content: null }];
  const sourceIndexes = new Map<string, number>([[wrapperUrl, 0]]);
  const mappings: Array<{ source: number; originalLine: number }> = [];
  const runtimeRanges: Array<[number, number, string, number]> = [];
  const outputLines: string[] = [];
  let activeSegment: EmbeddedSourceSegment | null = null;
  let segmentLine = 0;

  const registerSource = (source: SourceMapSource): number => {
    const existing = sourceIndexes.get(source.url);
    if (existing !== undefined) return existing;
    const index = sources.length;
    sourceIndexes.set(source.url, index);
    sources.push(source);
    return index;
  };

  for (const rawLine of neutralizeGeneratedDirectives(generatedCode).split('\n')) {
    const begin = rawLine.match(SOURCE_BEGIN);
    if (begin) {
      const index = Number.parseInt(begin[1]!, 10);
      activeSegment = options.segments[index] || null;
      segmentLine = 0;
      continue;
    }
    if (SOURCE_END.test(rawLine)) {
      activeSegment = null;
      segmentLine = 0;
      continue;
    }

    const generatedLine = outputLines.length + 1;
    outputLines.push(rawLine);
    if (!activeSegment) {
      mappings.push({ source: 0, originalLine: generatedLine - 1 });
      continue;
    }

    const nested = activeSegment.lineMap?.[segmentLine];
    const nestedSource = nested ? activeSegment.sources?.[nested[0]] : undefined;
    const originalSource: SourceMapSource = nestedSource || activeSegment;
    const originalLine = nested ? nested[1] : segmentLine + 1;
    const source = registerSource(originalSource);
    mappings.push({ source, originalLine: Math.max(0, originalLine - 1) });
    addRuntimeRange(runtimeRanges, generatedLine, originalSource.url, Math.max(1, originalLine));
    segmentLine++;
  }

  const sourceMap = {
    version: 3,
    file: generatedUrl,
    sources: sources.map((source) => source.url),
    sourcesContent: sources.map((source) => source.content),
    names: [],
    mappings: sourceMapMappings(mappings),
  };
  const runtimeSegments = JSON.stringify(runtimeRanges).replace(/</gu, '\\u003c');
  const finalized = outputLines.join('\n')
    .replaceAll(RUNTIME_SEGMENTS_PLACEHOLDER, runtimeSegments)
    .replaceAll(GENERATED_URL_PLACEHOLDER, JSON.stringify(generatedUrl));
  return [
    finalized,
    `//# sourceURL=${generatedUrl}`,
    `//# sourceMappingURL=data:application/json;base64,${utf8Base64(JSON.stringify(sourceMap))}`,
  ].join('\n');
}

function parseLocationForUrl(stack: string, url: string): { line: number; column: number } | null {
  if (!stack || !url) return null;
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = stack.match(new RegExp(`${escaped}:(\\d+):(\\d+)`, 'u'));
  if (!match) return null;
  return { line: Number.parseInt(match[1]!, 10), column: Number.parseInt(match[2]!, 10) };
}

export function resolveGeneratedLocation(
  ranges: Array<[number, number, string, number]>,
  generatedUrl: string,
  input: { line?: number; column?: number; filename?: string; stack?: string } = {},
): ResolvedGeneratedLocation | null {
  const stack = String(input.stack || '');
  for (const range of ranges) {
    const original = parseLocationForUrl(stack, range[2]);
    if (original) {
      return {
        source: range[2],
        line: original.line,
        column: original.column,
        generatedLine: Number(input.line || 0),
        generatedColumn: Number(input.column || 0),
      };
    }
  }
  const generatedStackLocation = parseLocationForUrl(stack, generatedUrl);
  const generatedLine = generatedStackLocation?.line || Number(input.line || 0);
  const generatedColumn = generatedStackLocation?.column || Number(input.column || 0);
  const range = ranges.find((item) => generatedLine >= item[0] && generatedLine <= item[1]);
  if (!range) return null;
  return {
    source: range[2],
    line: range[3] + generatedLine - range[0],
    column: Math.max(1, generatedColumn || 1),
    generatedLine,
    generatedColumn: Math.max(1, generatedColumn || 1),
  };
}

export const ScriptSourceMaps = Object.freeze({
  deterministicScriptSourceUrl,
  deterministicGeneratedSourceUrl,
  deterministicRequireSourceUrl,
  neutralizeSourceDirectives,
  markSourceSegment,
  createBundledSourceSegment,
  finalizeWrappedSource,
  resolveGeneratedLocation,
});

export default ScriptSourceMaps;
