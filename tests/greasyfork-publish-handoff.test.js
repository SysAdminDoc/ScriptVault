import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

function extractFunction(source, name) {
  const marker = source.indexOf(`function ${name}`);
  if (marker < 0) throw new Error(`Function ${name} not found`);
  const brace = source.indexOf('{', marker);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(marker, i + 1);
  }
  throw new Error(`Function ${name} did not close`);
}

function _invoke(body, params = [], args = []) {
  try { const vm = require('node:vm'); return vm.compileFunction(body, params, { filename: resolve(process.cwd(), 'pages/dashboard.js') })(...args); } catch { return new Function(...params, body)(...args); }
}

function extractGreasyForkPreflightApi() {
  const constantsStart = dashboardJs.indexOf('const GREASY_FORK_PREFILL_BASE_URL');
  const functionsEnd = dashboardJs.indexOf('    // Generate site icons HTML', constantsStart);
  if (constantsStart < 0 || functionsEnd < 0) {
    throw new Error('Unable to locate Greasy Fork preflight helpers');
  }
  return _invoke(`
    ${dashboardJs.slice(constantsStart, functionsEnd)}
    return {
      parseUserscriptMetadataForPublish,
      extractGreasyForkScriptIdFromUrl,
      buildGreasyForkPublishPreflight
    };
  `);
}

function parseDashboard() {
  return new DOMParser().parseFromString(dashboardHtml, 'text/html');
}

describe('Greasy Fork publish handoff preflight', () => {
  it('adds an editor handoff action without a background publish endpoint', () => {
    const doc = parseDashboard();
    const button = doc.getElementById('tbtnPublishGreasyFork');

    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('title')).toBe('Publish to Greasy Fork');
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.textContent.replace(/\s+/g, ' ').trim()).toContain('Publish');

    const defaultToolbarRule = dashboardHtml.match(/\.editor-toolbar\s*\{[\s\S]*?\}/)?.[0] || '';
    expect(defaultToolbarRule).toContain('flex-wrap: wrap');

    expect(dashboardJs).toContain("elements.tbtnPublishGreasyFork = document.getElementById('tbtnPublishGreasyFork')");
    expect(dashboardJs).toContain("elements.infoPublicationReceipt = document.getElementById('infoPublicationReceipt')");
    expect(dashboardJs).toContain("runButtonTask(event.currentTarget, openGreasyForkPublishHandoff");
    expect(dashboardJs).toContain("showModal('Greasy Fork publish handoff'");
    expect(dashboardJs).not.toContain("action: 'publishGreasyFork'");

    expect(dashboardHtml).toContain('id="infoPublicationReceipt"');
  });

  it('extracts existing Greasy Fork script IDs from script and update hosts', () => {
    const { extractGreasyForkScriptIdFromUrl } = extractGreasyForkPreflightApi();

    expect(extractGreasyForkScriptIdFromUrl('https://greasyfork.org/en/scripts/123-demo/code/demo.user.js')).toBe('123');
    expect(extractGreasyForkScriptIdFromUrl('https://greasyfork.org/scripts/124-demo')).toBe('124');
    expect(extractGreasyForkScriptIdFromUrl('https://update.greasyfork.org/scripts/456/demo.user.js')).toBe('456');
    expect(extractGreasyForkScriptIdFromUrl('https://sleazyfork.org/en/scripts/789-demo')).toBe('789');
    expect(extractGreasyForkScriptIdFromUrl('https://openuserjs.org/scripts/me/demo')).toBe('');
    expect(extractGreasyForkScriptIdFromUrl('not a url')).toBe('');
  });

  it('builds an update preflight from the current editor metadata', () => {
    const { buildGreasyForkPublishPreflight } = extractGreasyForkPreflightApi();
    const code = [
      '// ==UserScript==',
      '// @name        Old Publish Demo',
      '// @name        Publish Demo',
      '// @namespace   scriptvault/tests',
      '// @version     1.0.0',
      '// @version     2.0.0',
      '// @license     MIT',
      '// @updateURL   https://update.greasyfork.org/scripts/456/publish-demo.meta.js',
      '// @downloadURL https://update.greasyfork.org/scripts/456/publish-demo.user.js',
      '// ==/UserScript==',
      'console.log("publish");'
    ].join('\n');

    const preflight = buildGreasyForkPublishPreflight({ metadata: {} }, code);

    expect(preflight.ok).toBe(true);
    expect(preflight.mode).toBe('update');
    expect(preflight.scriptId).toBe('456');
    expect(preflight.targetUrl).toBe('https://greasyfork.org/en/scripts/456/versions/prefill');
    expect(preflight.form).toEqual({
      method: 'POST',
      enctype: 'multipart/form-data',
      codeField: 'script_version[code]'
    });
    expect(preflight.metadata).toMatchObject({
      name: 'Publish Demo',
      namespace: 'scriptvault/tests',
      version: '2.0.0',
      license: 'MIT'
    });
    expect(preflight.code).toBe(code);
    expect(preflight.codeLength).toBe(code.length);
    expect(preflight.missing).toEqual([]);
  });

  it('ignores prototype-sensitive metadata keys during preflight parsing', () => {
    const { parseUserscriptMetadataForPublish } = extractGreasyForkPreflightApi();
    const parsed = parseUserscriptMetadataForPublish([
      '// ==UserScript==',
      '// @name        Safe Name',
      '// @__proto__   unsafe',
      '// @constructor unsafe',
      '// @prototype   unsafe',
      '// ==/UserScript=='
    ].join('\n'));

    expect(parsed.hasMetadataBlock).toBe(true);
    expect(parsed.metadata.name).toBe('Safe Name');
    expect(Object.prototype.polluted).toBeUndefined();
    expect(parsed.metadata.__proto__).toBeUndefined();
    expect(parsed.metadata.constructor).toBeUndefined();
    expect(parsed.metadata.prototype).toBeUndefined();
  });

  it('falls back to the new-script prefill URL when no Greasy Fork ID is present', () => {
    const { buildGreasyForkPublishPreflight } = extractGreasyForkPreflightApi();
    const code = [
      '// ==UserScript==',
      '// @name        New Publish Demo',
      '// @namespace   scriptvault/tests',
      '// @version     1.0.0',
      '// @license     MIT',
      '// ==/UserScript==',
      'console.log("new");'
    ].join('\n');

    const preflight = buildGreasyForkPublishPreflight({ metadata: {} }, code);

    expect(preflight.ok).toBe(true);
    expect(preflight.mode).toBe('new');
    expect(preflight.scriptId).toBe('');
    expect(preflight.targetUrl).toBe('https://greasyfork.org/en/script_versions/prefill');
    expect(preflight.warnings).toContain('No Greasy Fork script ID found; this will open the new-script handoff.');
  });

  it('blocks handoff opening when required metadata is missing', () => {
    const { buildGreasyForkPublishPreflight } = extractGreasyForkPreflightApi();
    const preflight = buildGreasyForkPublishPreflight({ metadata: {} }, [
      '// ==UserScript==',
      '// @name        Missing Fields',
      '// ==/UserScript==',
      'console.log("missing");'
    ].join('\n'));

    expect(preflight.ok).toBe(false);
    expect(preflight.missing).toEqual(['@namespace', '@version']);
    expect(preflight.targetUrl).toBe('https://greasyfork.org/en/script_versions/prefill');
  });

  it('uses only a user-initiated form handoff for Greasy Fork publishing', () => {
    const submitFn = extractFunction(dashboardJs, 'submitGreasyForkPublishHandoff');
    const previewFn = extractFunction(dashboardJs, 'showGreasyForkPublishPreview');
    const confirmationFn = extractFunction(dashboardJs, 'showGreasyForkPublicationConfirmation');
    const openFn = extractFunction(dashboardJs, 'openGreasyForkPublishHandoff');
    const sessionCheckFn = extractFunction(dashboardJs, 'openGreasyForkSessionCheck');
    const handoffSource = `${submitFn}\n${previewFn}\n${confirmationFn}\n${openFn}\n${sessionCheckFn}`;

    expect(submitFn).toContain("form.method = 'POST'");
    expect(submitFn).toContain('form.enctype = GREASY_FORK_PREFILL_FORM_ENCTYPE');
    expect(submitFn).toContain('input.name = GREASY_FORK_PREFILL_CODE_FIELD');
    expect(submitFn).toContain('form.submit()');
    expect(submitFn).toContain("form.setAttribute('rel', 'noopener noreferrer')");
    expect(submitFn).toContain('try {');
    expect(submitFn).toContain("console.warn('[ScriptVault] Greasy Fork publish handoff failed:', error)");
    expect(submitFn).toMatch(/catch \(error\) \{\s*form\.remove\(\);\s*console\.warn/);
    expect(submitFn).toMatch(/catch \(error\) \{[\s\S]*return false;/);
    expect(previewFn).toContain('downloadGreasyForkPublishCode(preflight)');
    expect(previewFn).toContain('navigator.clipboard.writeText(preflight.code)');
    expect(previewFn).toContain('openGreasyForkSessionCheck()');
    expect(previewFn).toContain('showGreasyForkPublicationConfirmation(preflight)');
    expect(sessionCheckFn).toContain("window.open(GREASY_FORK_PREFILL_BASE_URL, '_blank', 'noopener,noreferrer')");
    expect(confirmationFn).toContain('recordGreasyForkSubmittedPublication(preflight)');

    expect(handoffSource).not.toMatch(/\bfetch\s*\(/);
    expect(handoffSource).not.toMatch(/XMLHttpRequest|GM_xmlhttpRequest/);
    expect(handoffSource).not.toMatch(/chrome\.runtime\.sendMessage/);
    expect(handoffSource).not.toMatch(/api\.greasyfork\.org/);
    expect(handoffSource).not.toMatch(/document\.cookie|csrf|credentials\s*:/i);
  });

  it('records local-only publication receipts without storing submitted code', () => {
    const constantsStart = dashboardJs.indexOf('const GREASY_FORK_PREFILL_BASE_URL');
    const functionsEnd = dashboardJs.indexOf('    function showGreasyForkPublishPreview', constantsStart);
    const api = _invoke(`
      ${dashboardJs.slice(constantsStart, functionsEnd)}
      return {
        buildGreasyForkPublicationReceiptRecord,
        summarizeGreasyForkPublicationReceipt
      };
    `);

    const preflight = {
      ok: true,
      scriptRecordId: 'script-1',
      mode: 'update',
      scriptId: '456',
      targetUrl: 'https://greasyfork.org/en/scripts/456/versions/prefill',
      code: 'console.log("do not persist");',
      codeLength: 30,
      metadata: {
        name: 'Receipt Demo',
        namespace: 'scriptvault/tests',
        version: '1.2.3',
        license: 'MIT',
        updateURL: 'https://update.greasyfork.org/scripts/456/demo.meta.js',
        downloadURL: 'https://update.greasyfork.org/scripts/456/demo.user.js'
      }
    };

    const row = api.buildGreasyForkPublicationReceiptRecord(preflight, {
      receiptId: 'receipt-1',
      codeSha256: 'a'.repeat(64),
      confirmedAt: 123,
      createdAt: 123
    });
    const summary = api.summarizeGreasyForkPublicationReceipt(row);
    const rebuilt = api.buildGreasyForkPublicationReceiptRecord(row, {
      receiptId: row.receiptId,
      scriptId: row.scriptId,
      codeSha256: row.codeSha256,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt
    });

    expect(row).toMatchObject({
      receiptId: 'receipt-1',
      scriptId: 'script-1',
      kind: 'greasy-fork-publication',
      status: 'submitted-confirmed',
      mode: 'update',
      greasyForkScriptId: '456',
      targetUrl: 'https://greasyfork.org/en/scripts/456/versions/prefill',
      codeLength: 30,
      codeSha256: 'a'.repeat(64)
    });
    expect(summary).toMatchObject({
      receiptId: 'receipt-1',
      scriptId: 'script-1',
      metadata: { name: 'Receipt Demo', version: '1.2.3' }
    });
    expect(rebuilt.greasyForkScriptId).toBe('456');

    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('do not persist');
    expect(serialized).not.toMatch(/FileSystemFileHandle|\bhandle\b|absolutePath|localFilePath|document\.cookie|csrf|credentials/i);

    expect(dashboardJs).toContain("const PUBLICATION_RECEIPTS_STORE = 'publicationReceipts'");
    expect(dashboardJs).toContain('const MAX_PUBLICATION_RECEIPTS_PER_SCRIPT = 10');
    expect(dashboardJs).toContain("db.createObjectStore(PUBLICATION_RECEIPTS_STORE, { keyPath: 'receiptId' })");
    expect(dashboardJs).toContain("receipts.createIndex('by-script', 'scriptId', { unique: false })");
    expect(dashboardJs).toContain('trimGreasyForkPublicationReceiptsForScript');
    expect(dashboardJs).toContain('void refreshGreasyForkPublicationReceiptForScript(scriptId)');
  });

  it('renders local publication receipt history without exposing source data', () => {
    const constantsStart = dashboardJs.indexOf('const GREASY_FORK_PREFILL_BASE_URL');
    const functionsEnd = dashboardJs.indexOf('    function showGreasyForkPublicationConfirmation', constantsStart);
    const api = _invoke(`
      const numberFormatter = new Intl.NumberFormat('en-US');
      const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]);
      const formatTime = value => 'time-' + value;
      const formatBytes = value => value + ' bytes';
      const renderInfoLink = value => 'link:' + escapeHtml(value);
      ${dashboardJs.slice(constantsStart, functionsEnd)}
      return {
        buildGreasyForkPublicationReceiptSummaryFilename,
        buildGreasyForkPublicationReceiptSummaryText,
        renderGreasyForkPublicationReceiptHtml,
        normalizeGreasyForkPublicationReceiptList
      };
    `);

    const receipts = [
      {
        receiptId: 'latest',
        scriptId: 'script-1',
        mode: 'update',
        greasyForkScriptId: '456',
        targetUrl: 'https://greasyfork.org/en/scripts/456/versions/prefill',
        codeLength: 30,
        codeSha256: 'b'.repeat(64),
        metadata: { name: 'Receipt Demo', version: '1.2.4' },
        confirmedAt: 200,
        createdAt: 200
      },
      {
        receiptId: 'previous',
        scriptId: 'script-1',
        mode: 'update',
        greasyForkScriptId: '456',
        targetUrl: 'https://greasyfork.org/en/scripts/456/versions/prefill',
        codeLength: 29,
        codeSha256: 'a'.repeat(64),
        metadata: { name: 'Receipt Demo', version: '1.2.3' },
        confirmedAt: 100,
        createdAt: 100
      }
    ];

    const html = api.renderGreasyForkPublicationReceiptHtml(receipts);
    const summary = api.buildGreasyForkPublicationReceiptSummaryText(receipts);
    const filename = api.buildGreasyForkPublicationReceiptSummaryFilename(receipts);
    expect(api.normalizeGreasyForkPublicationReceiptList(receipts[0])).toHaveLength(1);
    expect(html).toContain('Updated Greasy Fork script 456');
    expect(html).toContain('Previous receipts');
    expect(html).toContain('2 local receipts');
    expect(html).toContain('data-publication-receipts-copy="script-1"');
    expect(html).toContain('data-publication-receipts-download="script-1"');
    expect(html).toContain('data-publication-receipts-clear="script-1"');
    expect(html).toContain('Receipts are local audit markers only');
    expect(html).not.toMatch(/console\.log|script_version\[code\]|document\.cookie|csrf|credentials/i);
    expect(summary).toContain('Greasy Fork publication receipt summary');
    expect(summary).toContain('Local audit markers only');
    expect(summary).toContain('Latest: Update Greasy Fork script 456');
    expect(summary).toContain('Receipt Demo v1.2.4');
    expect(summary).toContain('SHA-256 ' + 'b'.repeat(64));
    expect(summary).toContain('Receipt 2: Update Greasy Fork script 456');
    expect(summary).not.toMatch(/console\.log|script_version\[code\]|document\.cookie|csrf|credentials/i);
    expect(filename).toBe('Receipt-Demo-1.2.4-greasyfork-receipts.txt');

    expect(dashboardJs).toContain('async function getGreasyForkPublicationReceiptsForScript');
    expect(dashboardJs).toContain('async function deleteGreasyForkPublicationReceiptsForScript');
    expect(dashboardJs).toContain('publicationReceipts: receipts');
    expect(dashboardJs).toContain('navigator.clipboard.writeText(buildGreasyForkPublicationReceiptSummaryText(receipts))');
    expect(dashboardJs).toContain('downloadGreasyForkPublicationReceiptSummary(receipts)');
  });
});
