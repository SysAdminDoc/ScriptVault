// ============================================================================
// Generated from src/background/script-source-maps.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptSourceMaps = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/background/script-source-maps.ts
  var script_source_maps_exports = {};
  __export(script_source_maps_exports, {
    ScriptSourceMaps: () => ScriptSourceMaps,
    createBundledSourceSegment: () => createBundledSourceSegment,
    default: () => script_source_maps_default,
    deterministicGeneratedSourceUrl: () => deterministicGeneratedSourceUrl,
    deterministicRequireSourceUrl: () => deterministicRequireSourceUrl,
    deterministicScriptSourceUrl: () => deterministicScriptSourceUrl,
    finalizeWrappedSource: () => finalizeWrappedSource,
    markSourceSegment: () => markSourceSegment,
    neutralizeSourceDirectives: () => neutralizeSourceDirectives,
    resolveGeneratedLocation: () => resolveGeneratedLocation
  });
  module.exports = __toCommonJS(script_source_maps_exports);
  var SOURCE_BEGIN = /^\s*\/\*__SV_SOURCE_BEGIN_(\d+)__\*\/\s*$/u;
  var SOURCE_END = /^\s*\/\*__SV_SOURCE_END__\*\/\s*$/u;
  var SOURCE_DIRECTIVE = /^\s*(?:\/\/[#@]\s*source(?:Mapping)?URL\s*=.*|\/\*[#@]\s*source(?:Mapping)?URL\s*=.*\*\/)\s*$/iu;
  var RUNTIME_SEGMENTS_PLACEHOLDER = "__SV_RUNTIME_LOCATION_SEGMENTS__";
  var GENERATED_URL_PLACEHOLDER = "__SV_GENERATED_SOURCE_URL__";
  var BASE64_VLQ = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var MAX_BUNDLED_SOURCES = 256;
  var MAX_BUNDLED_LINES = 2e5;
  var MAX_SOURCE_CONTENT_BYTES = 5e6;
  function safePathSegment(value, fallback) {
    const normalized = String(value || fallback).replace(/[\u0000-\u001f\u007f]/gu, "").trim() || fallback;
    return encodeURIComponent(normalized).slice(0, 240);
  }
  function deterministicScriptSourceUrl(scriptId, scriptName) {
    return `scriptvault://userscript/${safePathSegment(scriptId, "script")}/${safePathSegment(scriptName, "userscript")}.user.js`;
  }
  function deterministicGeneratedSourceUrl(scriptId) {
    return `scriptvault://generated/${safePathSegment(scriptId, "script")}/wrapper.js`;
  }
  function deterministicRequireSourceUrl(scriptId, index, url) {
    const normalized = typeof url === "string" ? url.replace(/[\u0000-\u001f\u007f]/gu, "").trim() : "";
    return normalized || `scriptvault://require/${safePathSegment(scriptId, "script")}/${index + 1}.js`;
  }
  function neutralizeSourceDirectives(code) {
    return String(code ?? "").split(/\r?\n/u).map((line) => {
      if (SOURCE_DIRECTIVE.test(line)) return "// [ScriptVault neutralized source directive]";
      if (SOURCE_BEGIN.test(line) || SOURCE_END.test(line)) return "// [ScriptVault neutralized source marker]";
      return line;
    }).join("\n");
  }
  function neutralizeGeneratedDirectives(code) {
    return code.split(/\r?\n/u).map((line) => SOURCE_DIRECTIVE.test(line) ? "// [ScriptVault neutralized source directive]" : line).join("\n");
  }
  function markSourceSegment(index, code) {
    if (!Number.isInteger(index) || index < 0) throw new Error("Invalid wrapped source segment index");
    return `/*__SV_SOURCE_BEGIN_${index}__*/
  ${neutralizeSourceDirectives(code)}
  /*__SV_SOURCE_END__*/`;
  }
  function createBundledSourceSegment(scriptId, scriptName, bundledCode, input) {
    if (!input || typeof input !== "object") return null;
    const value = input;
    if (!Array.isArray(value.sources) || value.sources.length === 0 || value.sources.length > MAX_BUNDLED_SOURCES) {
      return null;
    }
    const generatedLines = bundledCode.split(/\r?\n/u).length;
    if (!Array.isArray(value.lineMap) || value.lineMap.length !== generatedLines || value.lineMap.length > MAX_BUNDLED_LINES) {
      return null;
    }
    const entrySourceIndex = Number(value.entrySourceIndex);
    if (!Number.isInteger(entrySourceIndex) || entrySourceIndex < 0 || entrySourceIndex >= value.sources.length) {
      return null;
    }
    const sources = [];
    for (const [index, rawSource] of value.sources.entries()) {
      if (!rawSource || typeof rawSource !== "object") return null;
      const candidate = rawSource;
      const rawUrl = typeof candidate.url === "string" ? candidate.url.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, 4096) : "";
      const url = index === entrySourceIndex ? deterministicScriptSourceUrl(scriptId, scriptName) : /^(?:https?:\/\/|scriptvault:)/iu.test(rawUrl) ? rawUrl : `scriptvault://generated/${safePathSegment(scriptId, "script")}/esm-source-${index + 1}.js`;
      if (candidate.content !== null && candidate.content !== void 0 && (typeof candidate.content !== "string" || candidate.content.length > MAX_SOURCE_CONTENT_BYTES)) {
        return null;
      }
      sources.push({ url, content: typeof candidate.content === "string" ? candidate.content : null });
    }
    const lineMap = [];
    for (const rawLine of value.lineMap) {
      if (!Array.isArray(rawLine) || rawLine.length < 2) return null;
      const sourceIndex = Number(rawLine[0]);
      const originalLine = Number(rawLine[1]);
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= sources.length || !Number.isInteger(originalLine) || originalLine < 1 || originalLine > 1e7) {
        return null;
      }
      lineMap.push([sourceIndex, originalLine]);
    }
    return {
      url: `${deterministicGeneratedSourceUrl(scriptId)}?source=esm-bundle`,
      content: neutralizeSourceDirectives(bundledCode),
      sources,
      lineMap
    };
  }
  function encodeVlq(value) {
    let encoded = "";
    let vlq = value < 0 ? -value << 1 | 1 : value << 1;
    do {
      let digit = vlq & 31;
      vlq >>>= 5;
      if (vlq > 0) digit |= 32;
      encoded += BASE64_VLQ[digit];
    } while (vlq > 0);
    return encoded;
  }
  function utf8Base64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }
    return btoa(binary);
  }
  function sourceMapMappings(lines) {
    let previousSource = 0;
    let previousOriginalLine = 0;
    let previousOriginalColumn = 0;
    return lines.map((line) => {
      const mapping = [
        encodeVlq(0),
        encodeVlq(line.source - previousSource),
        encodeVlq(line.originalLine - previousOriginalLine),
        encodeVlq(-previousOriginalColumn)
      ].join("");
      previousSource = line.source;
      previousOriginalLine = line.originalLine;
      previousOriginalColumn = 0;
      return mapping;
    }).join(";");
  }
  function addRuntimeRange(ranges, generatedLine, source, originalLine) {
    const previous = ranges.at(-1);
    if (previous && previous[2] === source && previous[1] + 1 === generatedLine && previous[3] + (previous[1] - previous[0]) + 1 === originalLine) {
      previous[1] = generatedLine;
      return;
    }
    ranges.push([generatedLine, generatedLine, source, originalLine]);
  }
  function finalizeWrappedSource(generatedCode, options) {
    const generatedUrl = deterministicGeneratedSourceUrl(options.scriptId);
    const wrapperUrl = `${generatedUrl}?source=wrapper`;
    const sources = [{ url: wrapperUrl, content: null }];
    const sourceIndexes = /* @__PURE__ */ new Map([[wrapperUrl, 0]]);
    const mappings = [];
    const runtimeRanges = [];
    const outputLines = [];
    let activeSegment = null;
    let segmentLine = 0;
    const registerSource = (source) => {
      const existing = sourceIndexes.get(source.url);
      if (existing !== void 0) return existing;
      const index = sources.length;
      sourceIndexes.set(source.url, index);
      sources.push(source);
      return index;
    };
    for (const rawLine of neutralizeGeneratedDirectives(generatedCode).split("\n")) {
      const begin = rawLine.match(SOURCE_BEGIN);
      if (begin) {
        const index = Number.parseInt(begin[1], 10);
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
      const nestedSource = nested ? activeSegment.sources?.[nested[0]] : void 0;
      const originalSource = nestedSource || activeSegment;
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
      mappings: sourceMapMappings(mappings)
    };
    const runtimeSegments = JSON.stringify(runtimeRanges).replace(/</gu, "\\u003c");
    const generatedUrlLiteral = JSON.stringify(generatedUrl);
    const finalized = outputLines.join("\n").replaceAll(RUNTIME_SEGMENTS_PLACEHOLDER, () => runtimeSegments).replaceAll(GENERATED_URL_PLACEHOLDER, () => generatedUrlLiteral);
    return [
      finalized,
      `//# sourceURL=${generatedUrl}`,
      `//# sourceMappingURL=data:application/json;base64,${utf8Base64(JSON.stringify(sourceMap))}`
    ].join("\n");
  }
  function parseLocationForUrl(stack, url) {
    if (!stack || !url) return null;
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const match = stack.match(new RegExp(`${escaped}:(\\d+):(\\d+)`, "u"));
    if (!match) return null;
    return {
      line: Number.parseInt(match[1], 10),
      column: Number.parseInt(match[2], 10),
      offset: match.index ?? 0
    };
  }
  function resolveGeneratedLocation(ranges, generatedUrl, input = {}) {
    const stack = String(input.stack || "");
    const generatedStackLocation = parseLocationForUrl(stack, generatedUrl);
    let best = null;
    for (const range2 of ranges) {
      const original = parseLocationForUrl(stack, range2[2]);
      if (original && (!best || original.offset < best.offset)) {
        best = { range: range2, line: original.line, column: original.column, offset: original.offset };
      }
    }
    if (best && (!generatedStackLocation || best.offset < generatedStackLocation.offset)) {
      return {
        source: best.range[2],
        line: best.line,
        column: best.column,
        generatedLine: Number(input.line || 0),
        generatedColumn: Number(input.column || 0)
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
      generatedColumn: Math.max(1, generatedColumn || 1)
    };
  }
  var ScriptSourceMaps = Object.freeze({
    deterministicScriptSourceUrl,
    deterministicGeneratedSourceUrl,
    deterministicRequireSourceUrl,
    neutralizeSourceDirectives,
    markSourceSegment,
    createBundledSourceSegment,
    finalizeWrappedSource,
    resolveGeneratedLocation
  });
  var script_source_maps_default = ScriptSourceMaps;
  return module.exports.default || module.exports.ScriptSourceMaps || module.exports;
})();

if (typeof self !== 'undefined') {
  self.ScriptSourceMaps = ScriptSourceMaps;
}
