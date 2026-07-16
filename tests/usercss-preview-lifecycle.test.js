import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboard = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

function sliceFrom(src, anchor, len = 1800) {
  const idx = src.indexOf(anchor);
  expect(idx).toBeGreaterThanOrEqual(0);
  return src.slice(idx, idx + len);
}

describe('UserCSS preview lifecycle (wired preview path)', () => {
  it('clears the previously previewed tab when the target tab changes', () => {
    const fn = sliceFrom(dashboard, 'async function applyUserCssPreview');
    // Capture the prior preview target and clear it before re-pointing.
    expect(fn).toContain('const previousTabId = state.userCssPreview.active ? state.userCssPreview.tabId : null;');
    expect(fn).toMatch(/previousTabId && previousTabId !== targetTab\.id/);
    expect(fn).toContain("action: 'userStyleClearPreview', tabId: previousTabId");
  });

  it('tears down an active preview when the dashboard page unloads via pagehide', () => {
    // pagehide (not visibilitychange) so switching to the target tab to view the
    // preview does not clear it; only actual dashboard teardown clears.
    const block = sliceFrom(dashboard, "window.addEventListener('pagehide'", 400);
    expect(block).toContain('state.userCssPreview?.active');
    expect(block).toContain("action: 'userStyleClearPreview'");
  });

  it('does not register a visibilitychange handler that clears the preview', () => {
    // Guard: a visibilitychange(hidden) teardown would clear the preview the
    // moment the user switches to the target tab, defeating the feature.
    expect(dashboard).not.toContain("addEventListener('visibilitychange'");
  });
});
