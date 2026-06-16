import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sidepanelJs = readFileSync(resolve(process.cwd(), 'pages/sidepanel.js'), 'utf8');
const sidepanelHtml = readFileSync(resolve(process.cwd(), 'pages/sidepanel.html'), 'utf8');

describe('side panel RTL layout detection (Chrome 140+)', () => {
  it('feature-detects chrome.sidePanel.getLayout before calling', () => {
    expect(sidepanelJs).toContain("typeof chrome.sidePanel?.getLayout !== 'function'");
  });

  it('stores panel position in data-panel-position attribute', () => {
    expect(sidepanelJs).toContain('dataset.panelPosition');
    expect(sidepanelJs).toContain("layout.position");
  });

  it('catches errors when sidePanel.getLayout is unavailable', () => {
    const fnStart = sidepanelJs.indexOf('async function applySidePanelLayout');
    const fnEnd = sidepanelJs.indexOf('\n  }', fnStart + 10) + 4;
    const fnBody = sidepanelJs.slice(fnStart, fnEnd);
    expect(fnBody).toContain('catch');
  });

  it('CSS rules respond to panel position with RTL dir', () => {
    expect(sidepanelHtml).toContain('data-panel-position="left"');
    expect(sidepanelHtml).toContain('[dir="rtl"]');
  });

  it('calls applySidePanelLayout during init', () => {
    const initStart = sidepanelJs.indexOf('async function init()');
    const initEnd = sidepanelJs.indexOf('\n  }', initStart + 10) + 4;
    const initBody = sidepanelJs.slice(initStart, initEnd);
    expect(initBody).toContain('applySidePanelLayout()');
  });
});
