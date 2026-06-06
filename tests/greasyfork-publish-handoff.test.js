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

function extractGreasyForkPreflightApi() {
  const constantsStart = dashboardJs.indexOf('const GREASY_FORK_PREFILL_BASE_URL');
  const functionsEnd = dashboardJs.indexOf('    // Generate site icons HTML', constantsStart);
  if (constantsStart < 0 || functionsEnd < 0) {
    throw new Error('Unable to locate Greasy Fork preflight helpers');
  }
  return new Function(`
    ${dashboardJs.slice(constantsStart, functionsEnd)}
    return {
      parseUserscriptMetadataForPublish,
      extractGreasyForkScriptIdFromUrl,
      buildGreasyForkPublishPreflight
    };
  `)();
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
    expect(dashboardJs).toContain("runButtonTask(event.currentTarget, openGreasyForkPublishHandoff");
    expect(dashboardJs).toContain("showModal('Greasy Fork publish handoff'");
    expect(dashboardJs).not.toContain("action: 'publishGreasyFork'");
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
    const openFn = extractFunction(dashboardJs, 'openGreasyForkPublishHandoff');
    const handoffSource = `${submitFn}\n${previewFn}\n${openFn}`;

    expect(submitFn).toContain("form.method = 'POST'");
    expect(submitFn).toContain('form.enctype = GREASY_FORK_PREFILL_FORM_ENCTYPE');
    expect(submitFn).toContain('input.name = GREASY_FORK_PREFILL_CODE_FIELD');
    expect(submitFn).toContain('form.submit()');
    expect(submitFn).toContain("form.setAttribute('rel', 'noopener noreferrer')");
    expect(previewFn).toContain('downloadGreasyForkPublishCode(preflight)');
    expect(previewFn).toContain('navigator.clipboard.writeText(preflight.code)');

    expect(handoffSource).not.toMatch(/\bfetch\s*\(/);
    expect(handoffSource).not.toMatch(/XMLHttpRequest|GM_xmlhttpRequest/);
    expect(handoffSource).not.toMatch(/chrome\.runtime\.sendMessage/);
    expect(handoffSource).not.toMatch(/api\.greasyfork\.org/);
    expect(handoffSource).not.toMatch(/document\.cookie|csrf|credentials\s*:/i);
  });
});
