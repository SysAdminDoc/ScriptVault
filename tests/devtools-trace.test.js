import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const panelJs = readFileSync(resolve(process.cwd(), 'pages/devtools-panel.js'), 'utf8');
const panelHtml = readFileSync(resolve(process.cwd(), 'pages/devtools-panel.html'), 'utf8');

describe('DevTools trace export', () => {
  function exportPrivacyHelpers() {
    const start = panelJs.indexOf('  const EXPORT_REDACTED');
    const end = panelJs.indexOf('  function headerValue', start);
    if (start < 0 || end < 0) throw new Error('DevTools export privacy block not found');
    return new Function(`${panelJs.slice(start, end)}; return { sanitizeExportUrl, sanitizeExportText, sanitizeExportHeaders, sanitizeExecutionDocumentForExport, sanitizeExecutionJournalForExport };`)();
  }

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
    expect(panelJs).toContain('journal: journalEntries.map(sanitizeExecutionJournalForExport)');
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
    expect(panelJs).toContain("mimeType: sanitizeExportText(headerValue(e.responseHeaders, 'content-type') || 'text/plain', 256)");
    expect(panelJs).not.toContain("(e.responseHeaders || {})['content-type']");
  });

  it('redacts credentials and query strings while preserving useful URL context', () => {
    const { sanitizeExportUrl, sanitizeExportText } = exportPrivacyHelpers();
    expect(sanitizeExportUrl('https://user:password@example.test/path?token=secret#section')).toBe('https://example.test/path');
    expect(sanitizeExportUrl('https://user:password@example.test/account?token=secret', 'document')).toBe('https://example.test');
    expect(sanitizeExportText('request failed for https://example.test/path?api_key=secret Bearer abc123')).not.toContain('secret');
    expect(sanitizeExportText('request failed for https://example.test/path?api_key=secret Bearer abc123')).not.toContain('abc123');
  });

  it('redacts sensitive headers and rebuilds execution documents from an allowlist', () => {
    const { sanitizeExportHeaders, sanitizeExecutionDocumentForExport } = exportPrivacyHelpers();
    expect(sanitizeExportHeaders({
      Authorization: 'Bearer abc123',
      Cookie: 'session=secret',
      'X-Request-Id': 'safe-id',
      Referer: 'https://private.example/account?token=secret',
    })).toEqual([
      { name: 'Authorization', value: '[REDACTED]' },
      { name: 'Cookie', value: '[REDACTED]' },
      { name: 'X-Request-Id', value: 'safe-id' },
      { name: 'Referer', value: 'https://private.example/account' },
    ]);
    const safe = sanitizeExecutionDocumentForExport({
      url: 'https://private.example/account?token=secret',
      scriptIds: ['script-1'],
      events: [{ type: 'error', url: 'https://private.example/account?token=secret', error: 'Bearer abc123' }],
      unexpectedSource: 'userscript source should not be copied',
    });
    expect(safe.url).toBe('https://private.example');
    expect(safe.events[0]).toMatchObject({ url: 'https://private.example', error: 'Bearer [REDACTED]' });
    expect(JSON.stringify(safe)).not.toContain('secret');
    expect(JSON.stringify(safe)).not.toContain('unexpectedSource');
  });

  it('exports the persistent execution journal through an allowlist', () => {
    const { sanitizeExecutionJournalForExport } = exportPrivacyHelpers();
    const safe = sanitizeExecutionJournalForExport({
      timestamp: 123,
      tabId: 7,
      frameId: 0,
      outcome: 'failure',
      scriptId: 'script-1',
      origin: 'https://example.test/private?token=secret',
      urlHash: 'ABCDEF12',
      duration: 12,
      errorClass: 'TypeError: source should not be retained',
      source: 'userscript source should not be copied',
    });
    expect(safe).toMatchObject({
      outcome: 'failure',
      origin: 'https://example.test',
      urlHash: 'abcdef12',
      errorClass: null,
    });
    expect(JSON.stringify(safe)).not.toContain('secret');
    expect(JSON.stringify(safe)).not.toContain('userscript source');
    expect(JSON.stringify(safe)).not.toContain('source');
  });
});
