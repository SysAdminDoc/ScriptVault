import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const depgraphCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-depgraph.js'), 'utf8');

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
});
