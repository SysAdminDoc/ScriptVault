import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'bg/analyzer.js'), 'utf8');

function defaultChrome() {
  return {
    runtime: {
      getURL: (path) => `chrome-extension://id/${path}`,
      sendMessage: async () => ({ parseError: true }),
    },
    offscreen: {
      hasDocument: async () => true,
      createDocument: async () => undefined,
    },
  };
}

function createAnalyzer(chromeApi = defaultChrome()) {
  const fn = new Function('chrome', 'debugLog', `${code}\nreturn ScriptAnalyzer;`);
  return fn(chromeApi, () => undefined);
}

describe('generated ScriptAnalyzer runtime', () => {
  it('keeps URL schemes intact while stripping line comments', () => {
    const analyzer = createAnalyzer();

    const result = analyzer.analyze('const beacon = "https://tracker.example/collect"; fetch(beacon); // comment');

    expect(result.findings.some((finding) => finding.id === 'fetch-call')).toBe(true);
  });

  it('checks every long string for high entropy', () => {
    const analyzer = createAnalyzer();
    const benign = 'a'.repeat(100);
    const highEntropy = 'Aa1+/Z9qW8eR7tY6uI5oP4sD3fG2hJ1kL0mN9bV8cX7zQ6wE5rT4yU3iO2pA1sD0fG9hJ8kL7zX6cV5bN4mQ3wE2rT1yU0iO9p';

    const result = analyzer.analyze(`const a = "${benign}"; const b = "${highEntropy}";`);

    expect(result.findings.some((finding) => finding.id === 'high-entropy')).toBe(true);
  });

  it('feature-detects missing chrome.offscreen without throwing', async () => {
    const analyzer = createAnalyzer({
      runtime: {
        getURL: (path) => `chrome-extension://id/${path}`,
        sendMessage: async () => {
          throw new Error('should not send');
        },
      },
    });

    await expect(analyzer._ensureOffscreen()).resolves.toBe(false);
    expect(analyzer._supportsOffscreen()).toBe(false);
  });

  it('uses inline Acorn analysis in the generated runtime when offscreen is absent', async () => {
    const originalAcorn = globalThis.acorn;
    globalThis.acorn = {
      parse: () => ({
        type: 'Program',
        body: [{
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'eval' },
            arguments: [],
            loc: { start: { line: 1, column: 0 } },
          },
        }],
      }),
    };
    const analyzer = createAnalyzer({
      runtime: {
        getURL: (path) => `chrome-extension://id/${path}`,
        sendMessage: async () => {
          throw new Error('should not send');
        },
      },
    });

    try {
      const result = await analyzer.analyzeAsync('eval("x");');

      expect(result.astAnalyzed).toBe(true);
      expect(result.findings.some((finding) => finding.id === 'eval')).toBe(true);
    } finally {
      globalThis.acorn = originalAcorn;
    }
  });
});
