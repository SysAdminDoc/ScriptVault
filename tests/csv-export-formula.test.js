import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const cspCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-csp.js'), 'utf8');

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) {
    throw new Error(`Unable to locate ${name}`);
  }
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unable to parse ${name}`);
}

function createStatsCSVHelpers() {
  const _body = `
    const state = { settings: { statsUrlRetention: 'full' } };
    ${extractFunctionSource(dashboardJs, 'retainStatsUrl')}
    ${extractFunctionSource(dashboardJs, 'formatStatsCSVCell')}
    ${extractFunctionSource(dashboardJs, 'buildStatsCSV')}
    return { formatStatsCSVCell, buildStatsCSV };
  `;
  let fn;
  try { const vm = require('node:vm'); fn = vm.compileFunction(_body, [], { filename: resolve(process.cwd(), 'pages/dashboard.js') }); } catch { fn = new Function(_body); }
  return fn();
}

function createCSPReporter() {
  const _body2 = cspCode + '\nreturn CSPReporter;';
  try { const vm = require('node:vm'); const fn = vm.compileFunction(_body2, [], { filename: resolve(process.cwd(), 'pages/dashboard-csp.js') }); return fn(); } catch { return new Function(_body2)(); }
}

describe('CSV export formula defanging', () => {
  beforeEach(() => {
    globalThis.__resetStorageMock?.();
    vi.restoreAllMocks();
  });

  it('dashboard stats CSV defangs formula-control characters in every cell', () => {
    const { formatStatsCSVCell } = createStatsCSVHelpers();
    const dangerousCells = [
      '=HYPERLINK("https://evil.example")',
      '+SUM(1,1)',
      '-10+20',
      '@cmd',
      '\tcmd',
      '\rformula',
    ];

    for (const cell of dangerousCells) {
      expect(formatStatsCSVCell(cell)).toBe(`"'${cell.replace(/"/g, '""')}"`);
    }

    expect(formatStatsCSVCell('plain text')).toBe('"plain text"');
  });

  it('dashboard stats CSV covers script metadata, runtime URL, tags, and matches', () => {
    const { buildStatsCSV } = createStatsCSVHelpers();
    const csv = buildStatsCSV([
      {
        enabled: true,
        code: 'console.log("ok");\n',
        metadata: {
          name: '=HYPERLINK("https://evil.example")',
          version: '+1',
          tag: ['-report', 'safe'],
          match: ['@match', 'https://example.com/*'],
          include: [],
        },
        stats: {
          runs: 7,
          avgTime: 1.5,
          totalTime: 12.2,
          errors: 0,
          lastRun: Date.UTC(2026, 0, 2, 3, 4, 5),
          lastUrl: '+https://evil.example/path',
        },
      },
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://evil.example"")"');
    expect(csv).toContain(`"'+1"`);
    expect(csv).toContain(`"'+https://evil.example/path"`);
    expect(csv).toContain('"\'-report; safe"');
    expect(csv).toContain('"\'@match; https://example.com/*"');
  });

  it('CSP report CSV defangs formula-control script names', async () => {
    const dangerousNames = [
      '=HYPERLINK("https://evil.example")',
      '+SUM(1,1)',
      '-10+20',
      '@cmd',
      '\tcmd',
      '\rformula',
    ];

    for (const scriptName of dangerousNames) {
      globalThis.__resetStorageMock?.();
      const CSPReporter = createCSPReporter();
      await CSPReporter.recordFailure('https://example.com/app', 'script-1', 'script-src', {
        scriptName,
      });

      const csv = CSPReporter.exportReport('csv');
      expect(csv).toContain(`"'${scriptName.replace(/"/g, '""')}"`);
    }
  });
});
