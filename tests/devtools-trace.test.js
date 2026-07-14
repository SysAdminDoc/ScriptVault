import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const panelJs = readFileSync(resolve(process.cwd(), 'pages/devtools-panel.js'), 'utf8');
const panelHtml = readFileSync(resolve(process.cwd(), 'pages/devtools-panel.html'), 'utf8');

describe('DevTools trace export', () => {
  it('defines an exportTrace function in devtools-panel.js', () => {
    expect(panelJs).toContain('function exportTrace()');
  });

  it('produces a trace with version, generator, network, execution, and summary fields', () => {
    expect(panelJs).toContain("version: '1.1'");
    expect(panelJs).toContain('generator:');
    expect(panelJs).toContain('network:');
    expect(panelJs).toContain('execution:');
    expect(panelJs).toContain('summary:');
    expect(panelJs).toContain('documents: documentEntries');
    expect(panelJs).toContain('lastDocumentId:');
  });

  it('exports trace as JSON download with date-stamped filename', () => {
    expect(panelJs).toContain('scriptvault-trace-');
    expect(panelJs).toContain('application/json');
    expect(panelJs).toContain('.download =');
    expect(panelJs).toContain('URL.createObjectURL');
    expect(panelJs).toContain('URL.revokeObjectURL');
  });

  it('has an Export Trace button in the HTML', () => {
    expect(panelHtml).toContain('id="btnExportTrace"');
    expect(panelHtml).toContain('Export Trace');
  });

  it('wires the btnExportTrace click handler', () => {
    expect(panelJs).toContain("$('btnExportTrace').addEventListener('click', exportTrace)");
  });

  it('does not include script source code in trace export', () => {
    const exportBlock = panelJs.slice(panelJs.indexOf('function exportTrace()'), panelJs.indexOf('// ── Helpers'));
    expect(exportBlock).not.toContain('.code');
    expect(exportBlock).not.toContain('sourceCode');
  });

  it('resolves HAR response content type case-insensitively', () => {
    expect(panelJs).toContain('function headerValue(headers, name)');
    expect(panelJs).toContain('String(headerName).toLowerCase() === wanted');
    expect(panelJs).toContain("mimeType: headerValue(e.responseHeaders, 'content-type') || 'text/plain'");
    expect(panelJs).not.toContain("(e.responseHeaders || {})['content-type']");
  });
});
