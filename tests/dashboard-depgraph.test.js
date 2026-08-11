import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const depgraphCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-depgraph.js'), 'utf8');

function loadDependencyGraph() {
  const context = { window: {}, Math, Map, Set };
  vm.runInNewContext(`${depgraphCode}\nthis.__dependencyGraph = DependencyGraph;`, context);
  return context.__dependencyGraph;
}

function userscriptMetadata(lines) {
  return [
    '// ==UserScript==',
    ...lines.map(line => `// ${line}`),
    '// ==/UserScript==',
    'void 0;'
  ].join('\n');
}

describe('DependencyGraph module source contracts', () => {
  it('parseMetadata extracts all required metadata fields', () => {
    expect(depgraphCode).toContain("case 'name':");
    expect(depgraphCode).toContain("case 'version':");
    expect(depgraphCode).toContain("case 'require':");
    expect(depgraphCode).toContain("case 'match':");
    expect(depgraphCode).toContain("case 'include':");
    expect(depgraphCode).toContain("case 'resource':");
    expect(depgraphCode).toContain("case 'connect':");
    expect(depgraphCode).toContain("case 'grant':");
  });

  it('analyzeRelationships builds edges for shared requires', () => {
    expect(depgraphCode).toContain("type: 'require'");
  });

  it('analyzeRelationships builds edges for overlapping match patterns', () => {
    expect(depgraphCode).toContain("type: 'match'");
    expect(depgraphCode).toContain('findMatchOverlaps');
    expect(depgraphCode).toContain('patternsOverlap');
  });

  it('analyzeRelationships builds edges for shared resources', () => {
    expect(depgraphCode).toContain("type: 'resource'");
  });

  it('analyzeRelationships builds edges for shared connect domains', () => {
    expect(depgraphCode).toContain("type: 'connect'");
  });

  it('clampRadius bounds node size between 14 and 40', () => {
    expect(depgraphCode).toContain('const min = 14');
    expect(depgraphCode).toContain('const max = 40');
    expect(depgraphCode).toContain('Math.min(max, Math.max(min,');
  });

  it('patternsOverlap handles exact match and wildcard superset', () => {
    expect(depgraphCode).toContain('if (patA === patB) return true');
    expect(depgraphCode).toContain("normA === '*' || normB === '*'");
  });

  it('truncateLabel exists for long label handling', () => {
    expect(depgraphCode).toContain('function truncateLabel');
  });

  it('DPR-aware rendering uses devicePixelRatio', () => {
    expect(depgraphCode).toContain('devicePixelRatio');
  });

  it('force simulation uses velocity damping', () => {
    expect(depgraphCode).toContain('const damping');
    expect(depgraphCode).toContain('vx *= damping');
    expect(depgraphCode).toContain('vy *= damping');
  });

  it('indexes relationship candidates and defers very large force layouts', () => {
    expect(depgraphCode).toContain('function buildCandidatePairs');
    expect(depgraphCode).toContain('function addBucketCandidates');
    expect(depgraphCode).toContain('const MAX_FULL_LAYOUT_NODES = 1200');
    expect(depgraphCode).toContain('Full graph layout is deferred above');
  });

  it('exposes the canvas and every script through keyboard-accessible controls', () => {
    expect(depgraphCode).toContain("canvas.setAttribute('role', 'img')");
    expect(depgraphCode).toContain('canvas.tabIndex = 0');
    expect(depgraphCode).toContain("canvas.setAttribute('aria-label'");
    expect(depgraphCode).toContain('class="dg-node-list" role="list"');
    expect(depgraphCode).toContain("selectButton.setAttribute('aria-pressed'");
    expect(depgraphCode).toContain("openButton.setAttribute('aria-label', `Open ${node.label} in editor`)");
    expect(depgraphCode).toContain('function buildNodeRelationshipCounts');
    expect(depgraphCode).toContain('function formatNodeRelationshipSummary');
  });

  it('renders a clear empty state when there are no scripts to graph', () => {
    expect(depgraphCode).toContain('No scripts to graph yet — install a script to see its dependencies and match overlaps.');
    expect(depgraphCode).toContain('function updateLayoutSummary');
    expect(depgraphCode).toContain('_state.emptyState.hidden = false');
    expect(depgraphCode).toContain('.dg-canvas-empty[hidden]');
  });

  it('preserves relationship edges across indexed require, match, resource, and connect candidates', () => {
    const graph = loadDependencyGraph();
    const result = graph._analyzeRelationships([
      {
        id: 'alpha',
        enabled: true,
        code: userscriptMetadata([
          '@name Alpha',
          '@require https://cdn.example/shared.js',
          '@match https://example.com/*',
          '@resource icon https://cdn.example/icon.svg',
          '@connect api.example.com'
        ])
      },
      {
        id: 'beta',
        enabled: true,
        code: userscriptMetadata([
          '@name Beta',
          '@require https://cdn.example/shared.js',
          '@match https://example.com/users/*',
          '@resource icon https://cdn.example/icon.svg',
          '@connect api.example.com'
        ])
      },
      {
        id: 'gamma',
        enabled: true,
        code: userscriptMetadata(['@name Gamma', '@match *'])
      }
    ]);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(6);
    expect(result.edges.reduce((counts, edge) => {
      counts[edge.type] = (counts[edge.type] || 0) + 1;
      return counts;
    }, {})).toEqual({ require: 1, match: 3, resource: 1, connect: 1 });
    expect(result.edges.find(edge => edge.type === 'match').detail).toEqual([
      'https://example.com/* <-> https://example.com/users/*'
    ]);
  });

  it('analyzes a 3,000-script unrelated fixture without pairwise work', () => {
    const graph = loadDependencyGraph();
    const scripts = Array.from({ length: 3000 }, (_, index) => ({
      id: `script-${index}`,
      enabled: true,
      code: userscriptMetadata([`@name Script ${index}`])
    }));
    const started = performance.now();
    graph.refresh(scripts);
    const elapsed = performance.now() - started;
    const layoutState = graph._getLayoutState();

    expect(layoutState).toEqual({ deferred: true, nodeCount: 3000, edgeCount: 0 });
    expect(elapsed).toBeLessThan(1500);
  });
});
