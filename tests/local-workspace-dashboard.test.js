import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const storageIdbTs = readFileSync(resolve(process.cwd(), 'src/storage/idb.ts'), 'utf8');

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
    const refreshButton = doc.getElementById('tbtnRefreshLocalFile');
    const unbindButton = doc.getElementById('tbtnUnbindLocalFile');
    const status = doc.getElementById('editorLocalWorkspaceStatus');

    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('title')).toMatch(/Bind local file/);
    expect(button?.getAttribute('aria-describedby')).toBe('editorLocalWorkspaceStatus');
    expect(button?.textContent.replace(/\s+/g, ' ').trim()).toContain('Bind File');
    expect(button?.hasAttribute('hidden')).toBe(true);

    expect(refreshButton).not.toBeNull();
    expect(refreshButton?.getAttribute('type')).toBe('button');
    expect(refreshButton?.getAttribute('aria-describedby')).toBe('editorLocalWorkspaceStatus');
    expect(refreshButton?.hasAttribute('disabled')).toBe(true);
    expect(refreshButton?.hasAttribute('hidden')).toBe(true);

    expect(unbindButton).not.toBeNull();
    expect(unbindButton?.getAttribute('type')).toBe('button');
    expect(unbindButton?.getAttribute('aria-describedby')).toBe('editorLocalWorkspaceStatus');
    expect(unbindButton?.hasAttribute('disabled')).toBe(true);
    expect(unbindButton?.hasAttribute('hidden')).toBe(true);

    expect(status).not.toBeNull();
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.hasAttribute('hidden')).toBe(true);

    expect(dashboardJs).toContain('elements.tbtnBindLocalFile = document.getElementById');
    expect(dashboardJs).toContain('elements.tbtnRefreshLocalFile = document.getElementById');
    expect(dashboardJs).toContain('elements.tbtnUnbindLocalFile = document.getElementById');
    expect(dashboardJs).toContain("elements.tbtnBindLocalFile?.addEventListener('click', bindCurrentScriptToLocalFile)");
    expect(dashboardJs).toContain("runButtonTask(event.currentTarget, refreshCurrentScriptFromLocalFile");
    expect(dashboardJs).toContain("runButtonTask(event.currentTarget, unbindCurrentScriptLocalFile");
    expect(dashboardJs).toContain('void refreshLocalWorkspaceBindingForScript(scriptId)');
  });

  it('keeps unsupported File System Access controls hidden while manual import stays available', () => {
    const doc = parseDashboard();
    const controlsFn = extractFunction(dashboardJs, 'refreshLocalWorkspaceControls');

    expect(controlsFn).toContain('elements.tbtnBindLocalFile.hidden = !supported');
    expect(controlsFn).toContain('elements.tbtnRefreshLocalFile.hidden = !supported');
    expect(controlsFn).toContain('elements.tbtnUnbindLocalFile.hidden = !supported');
    expect(doc.getElementById('btnInstallFromFile')).not.toBeNull();
    expect(doc.getElementById('installFileInput')?.getAttribute('accept')).toContain('.user.js');
    expect(doc.getElementById('btnChooseFile')).not.toBeNull();
    expect(doc.getElementById('importFileInput')?.getAttribute('accept')).toContain('.user.js');
  });

  it('feature-detects File System Access and stores bindings in the local IDB store', () => {
    expect(dashboardJs).toContain("typeof window.showOpenFilePicker === 'function'");
    expect(dashboardJs).toContain("typeof indexedDB !== 'undefined'");
    expect(dashboardJs).toContain("const LOCAL_WORKSPACE_DB_NAME = 'scriptvault'");
    expect(dashboardJs).toContain('const LOCAL_WORKSPACE_DB_VERSION = 3');
    expect(dashboardJs).toContain("const LOCAL_WORKSPACE_STORE = 'localWorkspaceBindings'");
    expect(storageIdbTs).toContain('export const DB_VERSION = 3');
    expect(storageIdbTs).toContain("localWorkspaceBindings: 'localWorkspaceBindings'");
    expect(storageIdbTs).toContain("publicationReceipts: 'publicationReceipts'");
    expect(dashboardJs).toContain('const LOCAL_WORKSPACE_MAX_SCRIPT_BYTES = 5 * 1024 * 1024');
    expect(dashboardJs).toContain("db.createObjectStore(LOCAL_WORKSPACE_STORE, { keyPath: 'bindingId' })");
    expect(dashboardJs).toContain("bindings.createIndex('by-script', 'scriptId', { unique: false })");

    const summarize = extractFunction(dashboardJs, 'summarizeDashboardLocalWorkspaceBinding');
    expect(summarize).not.toMatch(/\bhandle\b/);
    expect(summarize).not.toMatch(/absolutePath|localFilePath/);
    expect(summarize).toContain('lastStatusKind');
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
    expect(bindFn).toContain("lastStatusKind: 'bound'");
  });

  it('requests permission only from refresh and reviews changed files before saveScript', () => {
    const refreshFn = extractFunction(dashboardJs, 'refreshCurrentScriptFromLocalFile');
    const saveFn = extractFunction(dashboardJs, 'saveLocalWorkspaceRefresh');

    expect(refreshFn).not.toContain('showOpenFilePicker');
    expect(refreshFn).toContain("requestLocalWorkspacePermission(bindingRecord.handle, 'read')");
    expect(refreshFn).toContain('confirmLocalWorkspaceRefreshApply');
    expect(refreshFn).toContain('if (currentCode === fileRead.text)');
    expect(refreshFn.indexOf('if (currentCode === fileRead.text)')).toBeLessThan(refreshFn.indexOf('saveLocalWorkspaceRefresh'));

    expect(saveFn).toContain("action: 'saveScript'");
    expect(saveFn).toContain("operation: 'local-save'");
    expect(saveFn).toContain("sourceKind: 'local-file'");
    expect(saveFn).toContain('suppressMetadataSourceFallback: true');
    expect(saveFn).not.toContain("action: 'registerAllScripts'");
    expect(saveFn).not.toContain("action: 'registerScript'");
    expect(saveFn).toContain("lastStatusKind: 'applied'");
    expect(refreshFn).toContain("lastStatusKind: 'unchanged'");
    expect(refreshFn).toContain("lastStatusKind: 'review-cancelled'");
    expect(refreshFn).toContain("lastErrorKind: 'permission-denied'");
    expect(refreshFn).toContain('classifyLocalWorkspaceApplyError(error)');
    expect(refreshFn).toContain('formatLocalWorkspaceErrorToast(errorKind');
  });

  it('guards local refresh against oversized files and parse failures', () => {
    const readFn = extractFunction(dashboardJs, 'readLocalWorkspaceFileText');
    const readErrorFn = extractFunction(dashboardJs, 'classifyLocalWorkspaceError');
    const applyErrorFn = extractFunction(dashboardJs, 'classifyLocalWorkspaceApplyError');
    const toastFn = extractFunction(dashboardJs, 'formatLocalWorkspaceErrorToast');
    const statusFn = extractFunction(dashboardJs, 'formatLocalWorkspaceRefreshStatus');

    expect(readFn).toContain('file.size > LOCAL_WORKSPACE_MAX_SCRIPT_BYTES');
    expect(readFn).toContain("error.localWorkspaceErrorKind = 'too-large'");
    expect(readFn.indexOf('file.size > LOCAL_WORKSPACE_MAX_SCRIPT_BYTES')).toBeLessThan(readFn.indexOf('await file.text()'));
    expect(readErrorFn).toContain("error?.localWorkspaceErrorKind === 'too-large'");
    expect(applyErrorFn).toContain("return 'parse-failed'");
    expect(applyErrorFn).toContain("return 'too-large'");
    expect(toastFn).toContain("case 'parse-failed': return 'Local file is not a valid userscript'");
    expect(statusFn).toContain("case 'too-large': return 'too large'");
    expect(statusFn).toContain("case 'parse-failed': return 'parse failed'");
  });

  it('summarizes local workspace refresh status in the editor chip', () => {
    const statusFn = extractFunction(dashboardJs, 'formatLocalWorkspaceRefreshStatus');
    const controlsFn = extractFunction(dashboardJs, 'refreshLocalWorkspaceControls');

    expect(statusFn).toContain("case 'applied': return 'applied'");
    expect(statusFn).toContain("case 'unchanged': return 'unchanged'");
    expect(statusFn).toContain("case 'review-cancelled': return 'review cancelled'");
    expect(statusFn).toContain("case 'file-missing': return 'file missing'");
    expect(statusFn).toContain("case 'handle-missing': return 'rebind needed'");
    expect(statusFn).toContain("case 'load-failed': return 'status unavailable'");
    expect(controlsFn).toContain('formatLocalWorkspaceRefreshStatus(binding)');
    expect(controlsFn).toContain('Local: ${binding.displayName} (${permission}; ${refreshStatus}');
  });

  it('unbind removes only the local binding record', () => {
    const unbindFn = extractFunction(dashboardJs, 'unbindCurrentScriptLocalFile');
    expect(unbindFn).toContain('deleteDashboardLocalWorkspaceBinding(binding.bindingId)');
    expect(unbindFn).toContain('localWorkspaceBinding: null');
    expect(unbindFn).not.toContain("action: 'deleteScript'");
    expect(unbindFn).not.toContain("action: 'saveScript'");
  });
});
