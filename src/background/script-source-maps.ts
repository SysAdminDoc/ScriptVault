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

type JavaScriptLexicalMode = 'code' | 'single-quote' | 'double-quote' | 'template' | 'block-comment';

interface JavaScriptLexicalState {
  mode: JavaScriptLexicalMode;
  escaped: boolean;
  templateExpressionDepths: number[];
  canStartRegex: boolean;
}

interface JavaScriptSourceLine {
  text: string;
  eol: string;
  isCodeStart: boolean;
}

const REGEX_PREFIX_KEYWORDS = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of',
  'return', 'throw', 'typeof', 'void', 'yield',
]);

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

function scanJavaScriptLine(line: string, state: JavaScriptLexicalState): void {
  for (let index = 0; index < line.length; index++) {
    const char = line[index]!;
    const next = line[index + 1] || '';

    if (state.mode === 'block-comment') {
      if (char === '*' && next === '/') {
        state.mode = 'code';
        index++;
      }
      continue;
    }

    if (state.mode === 'single-quote' || state.mode === 'double-quote') {
      if (state.escaped) {
        state.escaped = false;
      } else if (char === '\\') {
        state.escaped = true;
      } else if (
        (state.mode === 'single-quote' && char === "'") ||
        (state.mode === 'double-quote' && char === '"')
      ) {
        state.mode = 'code';
        state.canStartRegex = false;
      }
      continue;
    }

    if (state.mode === 'template') {
      if (state.escaped) {
        state.escaped = false;
      } else if (char === '\\') {
        state.escaped = true;
      } else if (char === '`') {
        state.mode = 'code';
        state.canStartRegex = false;
      } else if (char === '$' && next === '{') {
        state.templateExpressionDepths.push(0);
        state.mode = 'code';
        index++;
      }
      continue;
    }

    if (char === '/' && next === '/') break;
    if (char === '/' && next === '*') {
      state.mode = 'block-comment';
      index++;
    } else if (char === "'") {
      state.mode = 'single-quote';
      state.escaped = false;
      state.canStartRegex = false;
    } else if (char === '"') {
      state.mode = 'double-quote';
      state.escaped = false;
      state.canStartRegex = false;
    } else if (char === '`') {
      state.mode = 'template';
      state.escaped = false;
      state.canStartRegex = false;
    } else if (/\s/u.test(char)) {
      continue;
    } else if (/[$_A-Za-z]/u.test(char)) {
      let end = index + 1;
      while (end < line.length && /[$\w]/u.test(line[end]!)) end++;
      state.canStartRegex = REGEX_PREFIX_KEYWORDS.has(line.slice(index, end));
      index = end - 1;
    } else if (/\d/u.test(char)) {
      let end = index + 1;
      while (end < line.length && /[\w.]/u.test(line[end]!)) end++;
      state.canStartRegex = false;
      index = end - 1;
    } else if (char === '/' && state.canStartRegex) {
      let end = index + 1;
      let escaped = false;
      let inClass = false;
      for (; end < line.length; end++) {
        const regexChar = line[end]!;
        if (escaped) {
          escaped = false;
        } else if (regexChar === '\\') {
          escaped = true;
        } else if (regexChar === '[') {
          inClass = true;
        } else if (regexChar === ']' && inClass) {
          inClass = false;
        } else if (regexChar === '/' && !inClass) {
          while (/[A-Za-z]/u.test(line[end + 1] || '')) end++;
          index = end;
          state.canStartRegex = false;
          break;
        }
      }
      if (end >= line.length) state.canStartRegex = true;
    } else if (state.templateExpressionDepths.length > 0 && char === '{') {
      const top = state.templateExpressionDepths.length - 1;
      state.templateExpressionDepths[top] = state.templateExpressionDepths[top]! + 1;
      state.canStartRegex = true;
    } else if (state.templateExpressionDepths.length > 0 && char === '}') {
      const top = state.templateExpressionDepths.length - 1;
      if (state.templateExpressionDepths[top] === 0) {
        state.templateExpressionDepths.pop();
        state.mode = 'template';
      } else {
        state.templateExpressionDepths[top] = state.templateExpressionDepths[top]! - 1;
        state.canStartRegex = false;
      }
    } else {
      state.canStartRegex = !/[)\]}]/u.test(char);
    }
  }

  // A trailing backslash escapes the physical newline in a quoted string.
  // The escape itself is consumed before scanning the next line.
  if (
    (state.mode === 'single-quote' || state.mode === 'double-quote' || state.mode === 'template') &&
    state.escaped
  ) {
    state.escaped = false;
  }
}

function scanJavaScriptSourceLines(code: string): JavaScriptSourceLine[] {
  const pieces = code.split(/(\r\n|\r|\n)/u);
  const state: JavaScriptLexicalState = {
    mode: 'code',
    escaped: false,
    templateExpressionDepths: [],
    canStartRegex: true,
  };
  const lines: JavaScriptSourceLine[] = [];
  for (let index = 0; index < pieces.length; index += 2) {
    const text = pieces[index] || '';
    const eol = pieces[index + 1] || '';
    lines.push({ text, eol, isCodeStart: state.mode === 'code' });
    scanJavaScriptLine(text, state);
  }
  return lines;
}

function neutralizedLine(line: string, marker: boolean): string {
  const indentation = line.match(/^\s*/u)?.[0] || '';
  return `${indentation}// [ScriptVault neutralized source ${marker ? 'marker' : 'directive'}]`;
}

export function neutralizeSourceDirectives(code: unknown): string {
  return scanJavaScriptSourceLines(String(code ?? ''))
    .map((line) => {
      if (!line.isCodeStart) return line.text + line.eol;
      if (SOURCE_DIRECTIVE.test(line.text)) return neutralizedLine(line.text, false) + line.eol;
      if (SOURCE_BEGIN.test(line.text) || SOURCE_END.test(line.text)) {
        return neutralizedLine(line.text, true) + line.eol;
      }
      return line.text + line.eol;
    })
    .join('');
}

function neutralizeGeneratedDirectives(code: string): string {
  return scanJavaScriptSourceLines(code)
    .map((line) => line.isCodeStart && SOURCE_DIRECTIVE.test(line.text)
      ? neutralizedLine(line.text, false) + line.eol
      : line.text + line.eol)
    .join('');
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
  const outputEndings: string[] = [];
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

  for (const sourceLine of scanJavaScriptSourceLines(neutralizeGeneratedDirectives(generatedCode))) {
    const rawLine = sourceLine.text;
    const begin = sourceLine.isCodeStart ? rawLine.match(SOURCE_BEGIN) : null;
    if (begin) {
      const index = Number.parseInt(begin[1]!, 10);
      activeSegment = options.segments[index] || null;
      segmentLine = 0;
      continue;
    }
    if (sourceLine.isCodeStart && SOURCE_END.test(rawLine)) {
      activeSegment = null;
      segmentLine = 0;
      continue;
    }

    const generatedLine = outputLines.length + 1;
    outputLines.push(rawLine);
    outputEndings.push(sourceLine.eol);
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
  const generatedUrlLiteral = JSON.stringify(generatedUrl);
  // Function replacements: a string replacement would expand $-patterns
  // ($', $&, $$) occurring in @require URLs embedded in the segment JSON,
  // silently corrupting the wrapped script into a SyntaxError.
  const finalized = outputLines.map((line, index) => line + outputEndings[index]).join('')
    .replaceAll(RUNTIME_SEGMENTS_PLACEHOLDER, () => runtimeSegments)
    .replaceAll(GENERATED_URL_PLACEHOLDER, () => generatedUrlLiteral);
  return [
    finalized,
    `//# sourceURL=${generatedUrl}`,
    `//# sourceMappingURL=data:application/json;base64,${utf8Base64(JSON.stringify(sourceMap))}`,
  ].join('\n');
}

function parseLocationForUrl(
  stack: string,
  url: string,
): { line: number; column: number; offset: number } | null {
  if (!stack || !url) return null;
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = stack.match(new RegExp(`${escaped}:(\\d+):(\\d+)`, 'u'));
  if (!match) return null;
  return {
    line: Number.parseInt(match[1]!, 10),
    column: Number.parseInt(match[2]!, 10),
    offset: match.index ?? 0,
  };
}

export function resolveGeneratedLocation(
  ranges: Array<[number, number, string, number]>,
  generatedUrl: string,
  input: { line?: number; column?: number; filename?: string; stack?: string } = {},
): ResolvedGeneratedLocation | null {
  const stack = String(input.stack || '');
  const generatedStackLocation = parseLocationForUrl(stack, generatedUrl);
  // The topmost stack frame wins: pick the segment whose URL appears
  // earliest in the stack, and only when it precedes the generated URL's
  // own frame — declaration order would attribute errors to a lower
  // library frame instead of the faulting frame.
  let best: { range: [number, number, string, number]; line: number; column: number; offset: number } | null = null;
  for (const range of ranges) {
    const original = parseLocationForUrl(stack, range[2]);
    if (original && (!best || original.offset < best.offset)) {
      best = { range, line: original.line, column: original.column, offset: original.offset };
    }
  }
  if (best && (!generatedStackLocation || best.offset < generatedStackLocation.offset)) {
    return {
      source: best.range[2],
      line: best.line,
      column: best.column,
      generatedLine: Number(input.line || 0),
      generatedColumn: Number(input.column || 0),
    };
  }
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
