import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Dashboard ESM script badge wiring', () => {
  const dashboard = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
  const html = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');

  it('renders an ESM badge from parser metadata or stored bundle details', () => {
    expect(dashboard).toContain('data-esm-badge="true"');
    expect(dashboard).toContain('metadata.esm === true');
    expect(dashboard).toContain("metadata.module === '1'");
    expect(dashboard).toContain("metadata['inject-into'] === 'module'");
    expect(dashboard).toContain('const esmBundle = metadata.esmBundle || script.esmBundle;');
    expect(dashboard).toContain('${esmBadgeHtml}');
  });

  it('defines a non-pill ESM badge tone for dark and light themes', () => {
    expect(html).toMatch(/\.script-health-badge\.esm\s*\{/);
    expect(html).toMatch(/html\[data-theme="light"\] \.script-health-badge\.esm\s*\{/);
    expect(html).toMatch(/\.script-tag,\s*\n\s*\.script-health-badge\s*\{[\s\S]*?border-radius:\s*8px/);
  });
});
