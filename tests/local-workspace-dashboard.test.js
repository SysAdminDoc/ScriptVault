import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

function extractFunction(source, name) {
  const marker = source.indexOf(`function ${name}`);
  const asyncMarker = source.indexOf(`async function ${name}`);
  const start = asyncMarker >= 0 && (marker < 0 || asyncMarker < marker) ? asyncMarker : marker;
  if (start < 0) throw new Error(`Function ${name} not found`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} did not close`);
}

function parseDashboard() {
  return new DOMParser().parseFromString(dashboardHtml, 'text/html');
}

describe('dashboard local workspace binding', () => {
  it('adds an accessible editor control and status summary', () => {
    const doc = parseDashboard();
    const button = doc.getElementById('tbtnBindLocalFile');
    const status = doc.getElementById('editorLocalWorkspaceStatus');

    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('title')).toMatch(/Bind local file/);
    expect(button?.getAttribute('aria-describedby')).toBe('editorLocalWorkspaceStatus');
    expect(button?.textContent.replace(/\s+/g, ' ').trim()).toContain('Bind File');

    expect(status).not.toBeNull();
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.hasAttribute('hidden')).toBe(true);

    expect(dashboardJs).toContain('elements.tbtnBindLocalFile = document.getElementById');
    expect(dashboardJs).toContain("elements.tbtnBindLocalFile?.addEventListener('click', bindCurrentScriptToLocalFile)");
    expect(dashboardJs).toContain('void refreshLocalWorkspaceBindingForScript(scriptId)');
  });

  it('feature-detects File System Access and stores bindings in the local IDB store', () => {
    expect(dashboardJs).toContain("typeof window.showOpenFilePicker === 'function'");
    expect(dashboardJs).toContain("typeof indexedDB !== 'undefined'");
    expect(dashboardJs).toContain("const LOCAL_WORKSPACE_DB_NAME = 'scriptvault'");
    expect(dashboardJs).toContain('const LOCAL_WORKSPACE_DB_VERSION = 2');
    expect(dashboardJs).toContain("const LOCAL_WORKSPACE_STORE = 'localWorkspaceBindings'");
    expect(dashboardJs).toContain("db.createObjectStore(LOCAL_WORKSPACE_STORE, { keyPath: 'bindingId' })");
    expect(dashboardJs).toContain("bindings.createIndex('by-script', 'scriptId', { unique: false })");

    const summarize = extractFunction(dashboardJs, 'summarizeDashboardLocalWorkspaceBinding');
    expect(summarize).not.toMatch(/\bhandle\b/);
    expect(summarize).not.toMatch(/absolutePath|localFilePath/);
  });

  it('calls showOpenFilePicker directly from the click handler before later async work', () => {
    const bindFn = extractFunction(dashboardJs, 'bindCurrentScriptToLocalFile');
    const pickerIndex = bindFn.indexOf('await window.showOpenFilePicker');
    expect(pickerIndex).toBeGreaterThan(0);
    expect(bindFn.slice(0, pickerIndex)).not.toContain('await ');
    expect(bindFn).toContain('queryLocalWorkspacePermission(handle)');
    expect(bindFn).toContain('readLocalWorkspaceFileMetadata(handle)');
    expect(bindFn).not.toContain('requestPermission(');
  });

  it('does not apply code or write save history when binding a local file', () => {
    const bindFn = extractFunction(dashboardJs, 'bindCurrentScriptToLocalFile');
    expect(bindFn).not.toContain("action: 'saveScript'");
    expect(bindFn).not.toContain('chrome.runtime.sendMessage');
    expect(bindFn).not.toContain('.text()');
    expect(bindFn).not.toContain('state.editor.setValue');
    expect(bindFn).toContain('putDashboardLocalWorkspaceBinding');
    expect(bindFn).toContain('localWorkspaceBinding: summary');
  });
});
