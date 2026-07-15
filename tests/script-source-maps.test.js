import { describe, expect, it } from 'vitest';
import {
  deterministicGeneratedSourceUrl,
  deterministicScriptSourceUrl,
  finalizeWrappedSource,
  markSourceSegment,
  neutralizeSourceDirectives,
  resolveGeneratedLocation,
} from '../src/background/script-source-maps.ts';
import { buildWrappedScript } from '../src/background/wrapper-builder.ts';
import { parseUserscript } from '../src/background/parser.ts';

function inlineMap(code) {
  const match = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,([^\n]+)/u);
  if (!match) throw new Error('Inline source map missing');
  return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
}

function mappedLocation(sourceMap, generatedLine) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let source = 0;
  let originalLine = 0;
  const decode = segment => {
    const values = [];
    let value = 0;
    let shift = 0;
    for (const character of segment) {
      const digit = alphabet.indexOf(character);
      value += (digit & 31) << shift;
      if (digit & 32) {
        shift += 5;
      } else {
        values.push((value & 1) ? -(value >> 1) : value >> 1);
        value = 0;
        shift = 0;
      }
    }
    return values;
  };
  const lines = sourceMap.mappings.split(';');
  for (let index = 0; index < generatedLine; index++) {
    const values = decode(lines[index] || '');
    if (values.length >= 4) {
      source += values[1];
      originalLine += values[2];
    }
  }
  return { source: sourceMap.sources[source], line: originalLine + 1 };
}

function makeScript(code, metaOverrides = {}) {
  const parsed = parseUserscript(code);
  if (parsed.error || !parsed.meta) throw new Error(parsed.error || 'Userscript metadata missing');
  return {
    id: 'source_map_wrapper',
    code,
    enabled: true,
    position: 0,
    settings: {},
    meta: { ...parsed.meta, ...metaOverrides },
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('userscript source maps', () => {
  it('emits deterministic source identities and maps wrapper, require, and user lines', () => {
    const scriptId = 'script/alpha';
    const scriptUrl = deterministicScriptSourceUrl(scriptId, 'Demo Δ');
    const requireUrl = 'https://cdn.example/library.js';
    const userCode = 'const ready = true;\nthrow new Error("user boom");';
    const requireCode = 'const dependency = "✓";\nthrow new Error("require boom");';
    const generated = [
      'const __svLocationSegments = __SV_RUNTIME_LOCATION_SEGMENTS__;',
      'const __svGeneratedSourceUrl = __SV_GENERATED_SOURCE_URL__;',
      '(function wrapper() {',
      markSourceSegment(1, requireCode),
      'setTimeout(() => {',
      markSourceSegment(0, userCode),
      '}, 25);',
      '})();',
    ].join('\n');
    const finalized = finalizeWrappedSource(generated, {
      scriptId,
      scriptName: 'Demo Δ',
      segments: [
        { url: scriptUrl, content: userCode },
        { url: requireUrl, content: requireCode },
      ],
    });
    const map = inlineMap(finalized);
    const executable = finalized.split('\n').slice(0, -2).join('\n');

    expect(finalized).toContain(`//# sourceURL=${deterministicGeneratedSourceUrl(scriptId)}`);
    expect(map.file).toBe(deterministicGeneratedSourceUrl(scriptId));
    expect(map.sources).toEqual(expect.arrayContaining([scriptUrl, requireUrl]));
    expect(map.sourcesContent[map.sources.indexOf(scriptUrl)]).toBe(userCode);
    expect(map.sourcesContent[map.sources.indexOf(requireUrl)]).toBe(requireCode);
    expect(map.mappings.split(';')).toHaveLength(executable.split('\n').length);

    const rangesMatch = executable.match(/const __svLocationSegments = (\[[^;]+\]);/u);
    const ranges = JSON.parse(rangesMatch[1]);
    const userThrowLine = executable.split('\n').findIndex(line => line.includes('user boom')) + 1;
    const requireThrowLine = executable.split('\n').findIndex(line => line.includes('require boom')) + 1;
    const generatedUrl = deterministicGeneratedSourceUrl(scriptId);

    expect(resolveGeneratedLocation(ranges, generatedUrl, {
      stack: `Error: boom\n    at run (${generatedUrl}:${userThrowLine}:7)`,
    })).toMatchObject({ source: scriptUrl, line: 2, column: 7, generatedLine: userThrowLine });
    expect(resolveGeneratedLocation(ranges, generatedUrl, {
      stack: `run@${generatedUrl}:${requireThrowLine}:3`,
    })).toMatchObject({ source: requireUrl, line: 2, column: 3, generatedLine: requireThrowLine });
    expect(mappedLocation(map, userThrowLine)).toEqual({ source: scriptUrl, line: 2 });
    expect(mappedLocation(map, requireThrowLine)).toEqual({ source: requireUrl, line: 2 });
  });

  it('keeps wrapper, top-level-await, delay, require, and unwrap offsets out of original lines', () => {
    const body = [
      '// ==UserScript==',
      '// @name Mapped wrapper',
      '// @match https://example.com/*',
      '// @grant none',
      '// ==/UserScript==',
      'await Promise.resolve();',
      'throw new Error("mapped user throw");',
      '//# sourceURL=https://attacker.example/forged.js',
    ].join('\n');
    const wrapped = buildWrappedScript(
      makeScript(body, { 'top-level-await': true, delay: 25 }),
      [{ url: 'https://cdn.example/required.js', code: 'const required = true;\nthrow new Error("mapped require throw");' }],
    );
    const map = inlineMap(wrapped);
    const executable = wrapped.split('\n').slice(0, -2).join('\n');
    const userLine = executable.split('\n').findIndex(line => line.includes('mapped user throw')) + 1;
    const requireLine = executable.split('\n').findIndex(line => line.includes('mapped require throw')) + 1;

    expect(mappedLocation(map, userLine)).toEqual({
      source: deterministicScriptSourceUrl('source_map_wrapper', 'Mapped wrapper'),
      line: 7,
    });
    expect(mappedLocation(map, requireLine)).toEqual({ source: 'https://cdn.example/required.js', line: 2 });
    expect(wrapped).not.toContain('attacker.example');
    expect(() => new Function(wrapped)).not.toThrow();

    const unwrapBody = body.replace('await Promise.resolve();', 'const ready = true;');
    const unwrapped = buildWrappedScript(makeScript(unwrapBody, { unwrap: true }));
    const unwrapMap = inlineMap(unwrapped);
    const unwrapExecutable = unwrapped.split('\n').slice(0, -2).join('\n');
    const unwrapThrowLine = unwrapExecutable.split('\n').findIndex(line => line.includes('mapped user throw')) + 1;
    expect(mappedLocation(unwrapMap, unwrapThrowLine)).toEqual({
      source: deterministicScriptSourceUrl('source_map_wrapper', 'Mapped wrapper'),
      line: 7,
    });
    expect(() => new Function(unwrapped)).not.toThrow();
  });

  it('neutralizes hostile trailing directives and generated marker lookalikes', () => {
    const hostile = [
      'throw new Error("boom");',
      '//# sourceURL=https://attacker.example/forged.js',
      '/*# sourceMappingURL=https://attacker.example/forged.map */',
      '/*__SV_SOURCE_END__*/',
    ].join('\n');
    const sanitized = neutralizeSourceDirectives(hostile);
    const finalized = finalizeWrappedSource(markSourceSegment(0, hostile), {
      scriptId: 'hostile',
      segments: [{ url: deterministicScriptSourceUrl('hostile', 'Hostile'), content: sanitized }],
    });

    expect(finalized).not.toContain('attacker.example');
    expect(finalized.match(/\/\/# sourceURL=/gu)).toHaveLength(1);
    expect(finalized.match(/\/\/# sourceMappingURL=/gu)).toHaveLength(1);
    expect(() => new Function(finalized)).not.toThrow();
  });

  it('does not expand $-replacement patterns from segment URLs into the wrapped source', () => {
    const scriptId = 'script/dollar';
    const hostileUrl = "https://cdn.example/lib$'.js";
    const userCode = 'const ok = true;';
    const generated = [
      'const __svLocationSegments = __SV_RUNTIME_LOCATION_SEGMENTS__;',
      'const __svGeneratedSourceUrl = __SV_GENERATED_SOURCE_URL__;',
      markSourceSegment(0, userCode),
    ].join('
');
    const finalized = finalizeWrappedSource(generated, {
      scriptId,
      scriptName: 'Dollar',
      segments: [{ url: hostileUrl, content: userCode }],
    });
    const segmentsLine = finalized.split('
')[0];
    expect(segmentsLine).toContain("lib$'.js");
    // A string replacement would have spliced the rest of the file here.
    expect(segmentsLine).not.toContain('__svGeneratedSourceUrl');
    // The executable portion must still be valid JavaScript.
    const executable = finalized.split('
').slice(0, -2).join('
');
    expect(() => new Function(executable.replace('__SV_GENERATED_SOURCE_URL__', '"x"'))).not.toThrow();
  });

  it('resolves error locations from the topmost stack frame, not segment declaration order', () => {
    const generatedUrl = deterministicGeneratedSourceUrl('script/order');
    const ranges = [
      [1, 5, 'https://cdn.example/first.js', 1],
      [6, 10, 'https://cdn.example/second.js', 1],
    ];
    const stack = [
      'Error: boom',
      '    at run (https://cdn.example/second.js:4:7)',
      '    at init (https://cdn.example/first.js:2:3)',
    ].join('
');
    const resolved = resolveGeneratedLocation(ranges, generatedUrl, { stack });
    expect(resolved?.source).toBe('https://cdn.example/second.js');
    expect(resolved?.line).toBe(4);
    expect(resolved?.column).toBe(7);
  });

  it('prefers the generated frame when it precedes any segment frame in the stack', () => {
    const generatedUrl = deterministicGeneratedSourceUrl('script/topmost');
    const ranges = [[3, 8, 'https://cdn.example/lib.js', 1]];
    const stack = [
      'Error: boom',
      `    at user (${generatedUrl}:5:2)`,
      '    at page (https://cdn.example/lib.js:9:1)',
    ].join('
');
    const resolved = resolveGeneratedLocation(ranges, generatedUrl, { stack });
    expect(resolved?.source).toBe('https://cdn.example/lib.js');
    expect(resolved?.line).toBe(3);
    expect(resolved?.generatedLine).toBe(5);
  });
});
