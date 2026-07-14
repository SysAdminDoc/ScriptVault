import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = readFileSync(resolve(process.cwd(), 'vitest.visual.config.mjs'), 'utf8');
const visualTest = readFileSync(resolve(process.cwd(), 'tests/visual/dashboard-shell.visual.test.js'), 'utf8');

describe('visual failure trace configuration', () => {
  it('retains Playwright traces with screenshots and DOM snapshots on failure', () => {
    expect(config).toContain('mode: "retain-on-failure"');
    expect(config).toContain('tracesDir: "test-results/visual-traces"');
    expect(config).toContain('screenshots: true');
    expect(config).toContain('snapshots: true');
  });

  it('marks the visual workflow around load, theme, overlays, and assertions', () => {
    expect(visualTest).toContain('page.mark("dashboard load"');
    expect(visualTest).toContain('page.mark(`theme switch: ${theme}`');
    expect(visualTest).toContain('page.mark("modal open: script review"');
    expect(visualTest).toContain('page.mark("popover open: review help"');
    expect(visualTest).toContain('page.mark("assertion: overlays visible"');
    expect(visualTest).toContain('page.mark("assertion: dashboard screenshot"');
  });
});
