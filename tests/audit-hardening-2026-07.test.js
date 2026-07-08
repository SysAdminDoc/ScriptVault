import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('safeSetHtml fragment context (2026-07 regression)', () => {
  // A bare document.createRange().createContextualFragment() parses in
  // document context and silently drops <td>/<tr>/<option> cells. Every
  // safeSetHtml/htmlToFragment helper must anchor the range in the target
  // element via selectNodeContents so table markup survives.
  const pages = [
    'pages/dashboard.js',
    'pages/popup.js',
    'pages/install.js',
    'pages/devtools-panel.js',
    'pages/dashboard-cardview.js',
    'pages/dashboard-chains.js',
    'pages/dashboard-collections.js',
    'pages/dashboard-snippets.js',
    'pages/dashboard-heatmap.js',
    'pages/dashboard-scheduler.js',
    'pages/dashboard-theme-editor.js',
  ];

  for (const page of pages) {
    it(`${page} anchors the fragment parse range`, () => {
      const src = read(page);
      expect(src).toContain('selectNodeContents');
      // No un-anchored one-liner should remain.
      expect(src).not.toContain(
        "el.replaceChildren(document.createRange().createContextualFragment(String(html ?? '')));",
      );
    });
  }
});

describe('Chain editor only offers supported triggers (2026-07 regression)', () => {
  const src = read('pages/dashboard-chains.js');
  it('marks manual as the only supported trigger and filters the editor select', () => {
    expect(src).toContain('supported: true');
    expect(src).toContain('.filter(([, v]) => v.supported)');
    // url/schedule/event/afterScript remain in the map (for legacy badges) but
    // are not marked supported.
    expect(src).not.toMatch(/url:\s*\{[^}]*supported/);
  });
});

describe('Vim key-mapping setting is wired (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');
  it('applies keyMapping to KeyboardNav on load and on change', () => {
    expect(src).toContain('function applyKeyMapping');
    expect(src).toContain("KeyboardNav.setVimMode(value === 'vim')");
    expect(src).toContain("if (key === 'keyMapping') applyKeyMapping(value)");
    expect(src).toContain('applyKeyMapping(state.settings.keyMapping');
  });
});

describe('Dashboard inline colors use defined theme tokens (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');
  it('does not reference undefined accent/danger aliases', () => {
    expect(src).not.toContain('var(--accent)');
    expect(src).not.toContain('var(--danger)');
    expect(src).toContain('var(--accent-primary)');
    expect(src).toContain('var(--accent-error)');
  });
});

describe('Dashboard light-theme status contrast (2026-07 regression)', () => {
  const html = read('pages/dashboard.html');
  const lightSelectors = [
    'html[data-theme="light"] .trash-eyebrow',
    'html[data-theme="light"] .editor-save-state[data-state="dirty"]',
    'html[data-theme="light"] .editor-save-state[data-state="error"]',
    'html[data-theme="light"] .info-tag',
    'html[data-theme="light"] .info-tag.grant',
    'html[data-theme="light"] .info-tag.success',
    'html[data-theme="light"] .info-tag.error',
    'html[data-theme="light"] .info-tag.warning',
    'html[data-theme="light"] .script-health-badge.warning',
    'html[data-theme="light"] .script-health-badge.antifeature',
    'html[data-theme="light"] .script-health-badge.alert',
    'html[data-theme="light"] .script-health-badge.good',
    'html[data-theme="light"] .script-health-badge.neutral',
    'html[data-theme="light"] .script-health-badge.esm',
    'html[data-theme="light"] .script-tag',
  ];

  it('overrides dark-background status tones in light mode', () => {
    for (const selector of lightSelectors) {
      expect(html).toContain(selector);
    }
    expect(html).toContain('color: #92400e;');
    expect(html).toContain('color: #991b1b;');
    expect(html).toContain('color: #166534;');
    expect(html).toContain('color: #334155;');
  });
});

describe('Install page startup and error resilience (2026-07 regression)', () => {
  const src = read('pages/install.js');

  it('loads theme settings through a fail-soft helper inside init error handling', () => {
    expect(src).toContain('async function applySavedTheme()');
    expect(src).toContain("console.warn('Theme settings unavailable; defaulting install page to dark theme.'");
    expect(src).toMatch(/try \{\s*await applySavedTheme\(\);\s*\/\/ Get pending install data/s);
    expect(src).toContain('init().catch((e) => {');
    expect(src).toContain("showError('Error loading script', e?.message");
  });

  it('inserts install errors even when the normal action row is missing', () => {
    const fn = src.slice(src.indexOf('function showInstallError'), src.indexOf('function clearInstallError'));
    expect(fn).toContain("errorEl.id = 'installError'");
    expect(fn).toContain("(document.getElementById('content') || document.body).append(errorEl);");
  });

  it('coerces version inputs before checking pre-release markers', () => {
    const fn = src.slice(src.indexOf('function compareVersions'), src.indexOf('async function runSignatureVerification'));
    expect(fn).toContain("const version1 = typeof v1 === 'string' ? v1 : String(v1 ?? '');");
    expect(fn).toContain("const version2 = typeof v2 === 'string' ? v2 : String(v2 ?? '');");
    expect(fn.indexOf('const version1')).toBeLessThan(fn.indexOf('version1.includes'));
    expect(fn).not.toContain('v1.includes');
    expect(fn).not.toContain('v2.includes');
  });
});

describe('Update confirmation diff modal sequencing (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('waits for the diff modal to close before reopening update confirmation', () => {
    const diffStart = src.indexOf('function showDiffView');
    const diffEnd = src.indexOf('// Precomputed conflict cache', diffStart);
    const diffSource = src.slice(diffStart, diffEnd);
    expect(diffSource).toContain('return new Promise(resolve => {');
    expect(diffSource).toContain('modalDismissHandler = null;');
    expect(diffSource).toContain('closeModalShell();');
    expect(diffSource).toContain('], { onDismiss: () => finish() });');

    const confirmStart = src.indexOf('const askConfirmation = () => new Promise');
    const confirmEnd = src.indexOf("if (choice !== 'install') return false;", confirmStart);
    const confirmSource = src.slice(confirmStart, confirmEnd);
    expect(confirmSource).toContain('await showDiffView(');
    expect(confirmSource).not.toMatch(/\n\s+showDiffView\(/);
  });
});

describe('Dashboard telemetry/event bus wiring (2026-07 P1 regression)', () => {
  const dashboard = read('pages/dashboard.js');
  const debuggerSrc = read('pages/dashboard-debugger.js');
  const gist = read('pages/dashboard-gist.js');

  it('fans dashboard/background activity into the five previously-dead surfaces', () => {
    expect(dashboard).toContain('function publishDashboardTelemetry');
    expect(dashboard).toContain('scriptvault:dashboard-telemetry');
    expect(dashboard).toContain("document.addEventListener('securitypolicyviolation'");
    expect(dashboard).toContain("chrome.runtime.sendMessage({ action: 'getScriptStats' })");
    expect(dashboard).toContain("action: 'getScriptConsole'");
    expect(dashboard).toContain("action: 'getErrorLog'");
    expect(dashboard).toContain('ActivityHeatmap._recordActivity');
    expect(dashboard).toContain('Gamification.recordActivity');
    expect(dashboard).toContain('CSPReporter.recordFailure');
    expect(dashboard).toContain('GistIntegration.onScriptSaved');
  });

  it('publishes real producer events from script workflows', () => {
    for (const eventName of [
      'scriptEdited',
      'scriptCreated',
      'scriptInstalled',
      'scriptUpdated',
      'updatesChecked',
      'scriptShared',
      'backupCreated',
    ]) {
      expect(dashboard).toContain(`publishDashboardTelemetry('${eventName}'`);
    }
  });

  it('connects debugger console and GM value panels to background data', () => {
    expect(debuggerSrc).toContain('ingestConsoleEntries(scriptId, entries = [])');
    expect(debuggerSrc).toContain('async function getVariableStore(scriptId)');
    expect(debuggerSrc).toContain("action: 'getScriptValues'");
    expect(debuggerSrc).toContain("action: 'GM_setValue'");
    expect(debuggerSrc).toContain("action: 'deleteScriptValue'");
    expect(debuggerSrc.indexOf("action: 'getScriptValues'")).toBeLessThan(debuggerSrc.indexOf('localStorage.length'));
  });

  it('makes saved Gist autosync actionable on script save', () => {
    expect(gist).toContain('async function syncLinkedScriptOnSave');
    expect(gist).toContain('if (!_state.autoSync || !scriptId || !isConfigured())');
    expect(gist).toContain('return await syncToGist(scriptId);');
    expect(gist).toContain('async onScriptSaved(scriptId)');
    expect(gist).toContain('isAutoSyncEnabled()');
  });
});

describe('Easy Cloud reacts to real script mutations (2026-07 P2 regression)', () => {
  const core = read('src/background/core.ts');

  function expectNotifyAfter(block, write, notify) {
    expect(block).toContain(write);
    expect(block).toContain(notify);
    expect(block.indexOf(write)).toBeLessThan(block.indexOf(notify));
  }

  it('keeps Easy Cloud notifications best-effort', () => {
    expect(core).toContain('function notifyEasyCloudScriptSaved');
    expect(core).toContain('function notifyEasyCloudScriptDeleted');
    expect(core).toContain('EasyCloudSync.notifyScriptSaved(scriptId)');
    expect(core).toContain('EasyCloudSync.notifyScriptDeleted(scriptId)');
    expect(core).toContain('EasyCloud save notification failed');
    expect(core).toContain('EasyCloud delete notification failed');
  });

  it('notifies Easy Cloud after central save/create/delete paths persist', () => {
    const saveBlock = core.slice(core.indexOf("case 'saveScript'"), core.indexOf("case 'createScript'"));
    expectNotifyAfter(saveBlock, 'await ScriptStorage.set(id, script);', 'notifyEasyCloudScriptSaved(id);');

    const createBlock = core.slice(core.indexOf("case 'createScript'"), core.indexOf("case 'deleteScript'"));
    expectNotifyAfter(createBlock, 'await ScriptStorage.set(id, script);', 'notifyEasyCloudScriptSaved(id);');

    const deleteBlock = core.slice(core.indexOf("case 'deleteScript'"), core.indexOf("case 'getTrash'"));
    expectNotifyAfter(deleteBlock, 'await ScriptStorage.delete(scriptId);', 'notifyEasyCloudScriptDeleted(scriptId);');
  });

  it('notifies Easy Cloud after adjacent script-state mutation paths persist', () => {
    const restoreBlock = core.slice(core.indexOf("case 'restoreFromTrash'"), core.indexOf("case 'emptyTrash'"));
    expectNotifyAfter(restoreBlock, 'await ScriptStorage.set(script.id, script);', 'notifyEasyCloudScriptSaved(script.id);');

    const toggleBlock = core.slice(core.indexOf("case 'toggleScript'"), core.indexOf("case 'importScript'"));
    expectNotifyAfter(toggleBlock, 'await ScriptStorage.set(scriptId, script);', 'notifyEasyCloudScriptSaved(scriptId);');

    const importBlock = core.slice(core.indexOf("case 'importScript'"), core.indexOf("case 'duplicateScript'"));
    expectNotifyAfter(importBlock, 'await ScriptStorage.set(id, script);', 'notifyEasyCloudScriptSaved(id);');

    const duplicateBlock = core.slice(core.indexOf("case 'duplicateScript'"), core.indexOf("case 'searchScripts'"));
    expect(duplicateBlock).toContain('notifyEasyCloudScriptSaved(newScript.id);');

    const rollbackBlock = core.slice(core.indexOf("case 'rollbackScript'"), core.indexOf('// Sync'));
    expectNotifyAfter(rollbackBlock, 'await ScriptStorage.set(data.scriptId, script);', 'notifyEasyCloudScriptSaved(data.scriptId);');

    const settingsStart = core.indexOf("case 'setScriptSettings'");
    const settingsBlock = core.slice(settingsStart, core.indexOf('// Import/Export', settingsStart));
    expectNotifyAfter(settingsBlock, 'await ScriptStorage.set(data.scriptId, script);', 'notifyEasyCloudScriptSaved(data.scriptId);');
  });

  it('notifies Easy Cloud after update application persists new script code', () => {
    const updateBlock = core.slice(core.indexOf('async applyUpdate'), core.indexOf('// Phase 12.10', core.indexOf('async applyUpdate')));
    expectNotifyAfter(updateBlock, 'await ScriptStorage.set(scriptId, script);', 'notifyEasyCloudScriptSaved(scriptId);');
  });
});

describe('Sync apply loops share the per-script operation lock (2026-07 P2 regression)', () => {
  const cloudSync = read('src/background/cloud-sync.ts');
  const easyCloud = read('src/modules/sync-easycloud.ts');

  function expectSyncApplyLocking(src, label) {
    expect(src, label).toContain('_toggleLocks');
    expect(src, label).toContain('function getScriptOperationLocks');
    expect(src, label).toContain('async function runExclusiveScriptOperation');

    const deleteLoop = src.slice(src.indexOf('for (const localScript of scripts)'), src.indexOf('// Apply', src.indexOf('for (const localScript of scripts)')));
    expect(deleteLoop, label).toContain('runExclusiveScriptOperation(localScript.id');
    expect(deleteLoop, label).toContain('deleteSyncedScript(localScript.id)');

    const applyLoop = src.slice(src.indexOf('for (const script of merged.scripts)'), src.indexOf('// Persist merged tombstones', src.indexOf('for (const script of merged.scripts)')));
    expect(applyLoop, label).toContain('runExclusiveScriptOperation(script.id');
    expect(applyLoop, label).toContain('const existing');
    expect(applyLoop, label).toContain('ScriptStorage.get(script.id)');
    expect(applyLoop, label).toContain('ScriptStorage.set(script.id, nextScript)');
  }

  it('wraps CloudSync per-script apply and delete work', () => {
    expectSyncApplyLocking(cloudSync, 'cloud-sync');
  });

  it('wraps Easy Cloud per-script apply and delete work', () => {
    expectSyncApplyLocking(easyCloud, 'sync-easycloud');
  });
});

describe('Cloud provider fetches honor sync abort signals (2026-07 P3 regression)', () => {
  const providers = read('src/modules/sync-providers.ts');

  it('composes caller abort signals with provider fetch timeouts', () => {
    expect(providers).toContain('interface SyncRequestOptions');
    expect(providers).toContain('externalSignal?.addEventListener');
    expect(providers).toContain('externalSignal?.removeEventListener');
    expect(providers).toContain('controller.abort(externalSignal?.reason)');
  });

  it('threads opts.signal through non-S3 provider upload/download paths', () => {
    for (const signature of [
      'async upload(data: unknown, settings: Settings, opts: SyncRequestOptions = {})',
      'async download(settings: Settings, opts: SyncRequestOptions = {})',
      'async findFile(token: string, objectName?: string, opts: SyncRequestOptions = {})',
      'async upload(data: unknown, settings?: Settings, opts: SyncRequestOptions = {})',
      'async download(settings?: Settings, opts: SyncRequestOptions = {})',
    ]) {
      expect(providers).toContain(signature);
    }
    expect((providers.match(/signal: opts\.signal/g) || []).length).toBeGreaterThanOrEqual(10);
  });
});

describe('Cloud provider uploads use conditional remote validators (2026-07 P3 regression)', () => {
  const providers = read('src/modules/sync-providers.ts');

  it('captures download validators and keys them by remote object', () => {
    expect(providers).toContain('_lastSyncEtagKey');
    expect(providers).toContain('_lastSyncRevPath');
    expect(providers).toContain("response.headers.get('ETag')");
    expect(providers).toContain("response.headers.get('Dropbox-API-Result')");
  });

  it('sends provider-specific write preconditions on upload', () => {
    expect(providers).toContain("headers['If-Match']");
    expect(providers).toContain("headers['If-None-Match']");
    expect(providers).toContain("{ '.tag': 'update', update: lastRev }");
    expect(providers).toContain("conditionalHeaders['if-match']");
    expect(providers).toContain("conditionalHeaders['if-none-match']");
    expect(providers).toContain('extraHeaders: conditionalHeaders');
  });
});

describe('KeyboardNav does not hijack focused row controls (2026-07 regression)', () => {
  const src = read('pages/dashboard-keyboard.js');
  it('adds an interactive-control focus guard', () => {
    expect(src).toContain('isInteractiveControlFocused');
    expect(src).toContain('const controlFocused = isInteractiveControlFocused()');
  });
  it('guards Enter/Space/Delete and vim action keys with the control check', () => {
    expect(src).toContain("e.key === 'Enter' && _focusedIndex >= 0 && !controlFocused");
    expect(src).toContain("e.key === ' ' && _focusedIndex >= 0 && !controlFocused");
    expect(src).toContain("e.key === 'Delete' && _focusedIndex >= 0 && !controlFocused");
    expect(src).toContain("key === 'e' && _focusedIndex >= 0 && !controlFocused");
  });
  it('gates list navigation while a modal is open', () => {
    expect(src).toContain('if (isModalOpen()) return;');
  });
});

describe('Per-tab run diagnostics (2026-07 feature)', () => {
  it('background exposes a diagnoseScripts handler covering the key run blockers', () => {
    const core = read('background.core.js');
    expect(core).toContain("case 'diagnoseScripts'");
    expect(core).toContain('userScriptsAvailable');
    for (const status of ['disabled', 'no-match', 'not-registered', 'running', 'on-demand', 'scheduled']) {
      expect(core).toContain(`'${status}'`);
    }
  });
  it('diagnoseScripts is registered in the router action table', () => {
    const router = read('src/background/message-router.ts');
    expect(router).toContain("'diagnoseScripts'");
  });
  it('popup wires the diagnostics panel and escapes rendered fields', () => {
    const src = read('pages/popup.js');
    expect(src).toContain('toggleDiagnostics');
    expect(src).toContain("action: 'diagnoseScripts'");
    expect(src).toContain('renderDiagnostics');
    // Names/reasons from the background are escaped before innerHTML.
    expect(src).toContain('escapeHtml(s.name');
    expect(src).toContain('escapeHtml(s.reason');
  });
});

describe('Theme editor persistence + valid layouts (2026-07 regression)', () => {
  it('dashboard clamps layout to real CSS themes and validates the setting', () => {
    const src = read('pages/dashboard.js');
    expect(src).toContain('VALID_LAYOUTS');
    expect(src).toContain('VALID_LAYOUTS.has(layout) ? layout');
    // validateSettingsValue rejects non-layout preset keys.
    expect(src).toContain("case 'layout':");
  });
  it('dashboard re-applies the persisted custom theme variables on load', () => {
    const src = read('pages/dashboard.js');
    expect(src).toContain('applyActiveCustomThemeVars');
    expect(src).toContain("chrome.storage.local.get('sv_active_custom_theme')");
  });
  it('theme editor only writes settings.layout for real layout presets', () => {
    const src = read('pages/dashboard-theme-editor.js');
    expect(src).toContain('LAYOUT_PRESETS');
    expect(src).toContain('LAYOUT_PRESETS.has(_activePreset)');
    expect(src).toContain('resolveActiveThemeVars');
    // The old bug wrote any PRESETS[key] to layout.
    expect(src).not.toContain("!_activePreset.startsWith('custom:') && PRESETS[_activePreset]");
  });
});

describe('Monaco editor Ctrl+S / Escape wiring (2026-07 regression)', () => {
  it('adapter routes save/close through the exposed UI bridge with real-button fallbacks', () => {
    const src = read('pages/monaco-adapter.js');
    expect(src).toContain('window.ScriptVaultDashboardUI?.saveEditor');
    expect(src).toContain('window.ScriptVaultDashboardUI?.closeEditor');
    expect(src).toContain("getElementById('btnEditorSave')");
    expect(src).toContain("getElementById('btnEditorClose')");
    // The dead selector that matched no element must be gone.
    expect(src).not.toContain("querySelector('[data-action=\"save\"]')");
  });
  it('dashboard exposes saveEditor/closeEditor on the UI bridge', () => {
    const src = read('pages/dashboard.js');
    expect(src).toContain('saveEditor:');
    expect(src).toContain('closeEditor:');
  });
});

describe('Editor tab reconciliation (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('prunes open editor tabs after script reloads and warns on stale activation', () => {
    expect(src).toContain('function reconcileOpenEditorTabs()');
    expect(src).toContain('reconcileOpenEditorTabs();');
    expect(src).toContain('removedScriptIds.forEach(removeOpenScriptTab);');
    expect(src).toContain("showToast('That script is no longer available. Editor tab closed.', 'warning')");
  });
});

describe('Editor autosave setting refresh (2026-07 regression)', () => {
  it('reads the current autosave setting inside the persistent change handler', () => {
    const src = read('pages/dashboard.js');
    expect(src).toContain('if (state.settings.autoSave) {');
    expect(src).not.toContain('if (s.autoSave) {');
  });
});

describe('Userscript file import errors (2026-07 regression)', () => {
  it('surfaces background createScript errors for plain .user.js imports', () => {
    const src = read('pages/dashboard.js');
    const importBlock = src.slice(
      src.indexOf('async function importScript()'),
      src.indexOf('async function exportAllScripts()')
    );
    expect(importBlock).toContain("const res = await chrome.runtime.sendMessage({ action: 'createScript', code });");
    expect(importBlock).toContain("importResults.push({ file: file.name, success: false, message: res?.error || 'Import failed' });");
  });
});

describe('Script list load failures (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('renders a retryable unavailable state instead of the empty vault prompt', () => {
    expect(src).toContain("scriptLoadError: ''");
    expect(src).toContain("state.scriptLoadError = getErrorMessage(e, 'Failed to load scripts');");
    expect(src).toContain("tDashboard('scriptsUnavailableTitle', 'Scripts unavailable')");
    expect(src).toContain("elements.emptyStatePrimaryAction.onclick = () => loadScripts();");
    expect(src).toContain("showToast(`Scripts unavailable: ${state.scriptLoadError}`, 'error');");
  });
});

describe('Dropped ZIP import confirmation and undo (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('uses the archive import confirmation and receipt-backed Undo for dropped zips', () => {
    const dropBlock = src.slice(
      src.indexOf('// Drag-and-drop file installation'),
      src.indexOf('function applyColumnVisibility()')
    );
    expect(src).toContain('function buildStructuredImportConfirmationMessage');
    expect(src).toContain('function getImportUndoToastOptions');
    expect(dropBlock).toContain('buildStructuredImportConfirmationMessage(files, transfer)');
    expect(dropBlock).toContain('const receiptIds = [];');
    expect(dropBlock).toContain('sourceLabel: `Dropped ZIP: ${file.name}`');
    expect(dropBlock).toContain("const undoOptions = getImportUndoToastOptions(receiptIds, 'import');");
    expect(dropBlock).toContain("showToast(`Installed ${installed} script${installed > 1 ? 's' : ''}${errors > 0 ? ` (${errors} failed)` : ''}`, 'success', undoOptions);");
  });
});

describe('Trash-aware single script delete copy (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('does not claim Trash-enabled deletes are irreversible', () => {
    expect(src).toContain('function isTrashDisabled()');
    expect(src).toContain('function getSingleDeleteDialogCopy(name)');
    expect(src).toContain('Permanently delete this script? Trash is disabled, so this cannot be undone.');
    expect(src).toContain('Move "${name}" to Trash?');
    expect(src).toContain("movedToTrash ? 'Moved to Trash' : 'Deleted'");
    expect(src).not.toContain("retentionLabel === 'Disabled'");
    expect(src).not.toContain("showConfirmModal(`Delete \"${name}\"?`, 'This action cannot be undone.')");
  });
});

describe('Update check error handling (2026-07 regression)', () => {
  it('does not treat error objects as an up-to-date result', () => {
    const src = read('pages/dashboard.js');
    const fn = src.slice(
      src.indexOf('async function checkScriptForUpdates'),
      src.indexOf('function isBroadMatch')
    );
    expect(fn).toContain('if (updates?.error) {');
    expect(fn).toContain("showToast(updates.error || 'Update check failed', 'error');");
    expect(fn).toContain('if (!Array.isArray(updates)) {');
    expect(fn).toContain("showToast('Update check failed', 'error');");
    expect(fn).not.toContain('if (updates && updates.length > 0)');
  });
});

describe('Optimistic dashboard actions (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('reverts pin state when setScriptSettings fails', () => {
    const pinBlock = src.slice(
      src.indexOf("tr.querySelector('[data-action=\"pin\"]')"),
      src.indexOf("tr.querySelector('[data-action=\"updateScript\"]')")
    );
    expect(pinBlock).toContain('const previousSettings = { ...(s.settings || {}) };');
    expect(pinBlock).toContain('if (response?.error) throw new Error(response.error);');
    expect(pinBlock).toContain('s.settings = previousSettings;');
    expect(pinBlock).toContain("showToast(error?.message || 'Failed to update pin', 'error');");
  });

  it('saves dirty editor content before duplicating the current script', () => {
    const duplicateBlock = src.slice(
      src.indexOf('async function duplicateCurrentScript()'),
      src.indexOf('async function deleteScript')
    );
    expect(duplicateBlock).toContain('const sourceScriptId = state.currentScriptId;');
    expect(duplicateBlock).toContain('state.unsavedChanges || state.openTabs[sourceScriptId]?.unsaved');
    expect(duplicateBlock).toContain('const saved = await saveCurrentScript({ silentSuccess: true });');
    expect(duplicateBlock).toContain("await Promise.resolve(closeScriptTab(sourceScriptId));");
    expect(duplicateBlock).toContain("showToast(e?.message || 'Failed to duplicate script', 'error');");
  });
});

describe('Editor panel failure and autosave flushes (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('clears stale storage values with an inline error state', () => {
    const storageBlock = src.slice(
      src.indexOf('async function loadScriptStorage(script)'),
      src.indexOf('function createStorageItem')
    );
    expect(storageBlock).toContain("const message = getErrorMessage(e, 'Failed to load stored values');");
    expect(storageBlock).toContain('Storage unavailable');
    expect(storageBlock).toContain('safeSetHtml(elements.storageList');
    expect(storageBlock).toContain("showToast(message, 'error');");
  });

  it('flushes dirty autosave buffers before switching away from an editor tab', () => {
    expect(src).toContain('function flushPendingEditorAutosave(scriptId)');
    expect(src).toContain('void saveCurrentScript({ autosave: true, silentSuccess: true });');
    expect(src).toContain('flushPendingEditorAutosave(previousScriptId);');
    expect(src).toContain('flushPendingEditorAutosave(state.currentScriptId);');
  });
});

describe('Import and toast microcopy polish (2026-07 regression)', () => {
  const src = read('pages/dashboard.js');

  it('aggregates multi-file import feedback into one toast with shared Undo', () => {
    const importBlock = src.slice(
      src.indexOf('async function importScript()'),
      src.indexOf('async function exportAllScripts()')
    );
    expect(src).toContain('function buildImportFilesToast(results = [])');
    expect(importBlock).toContain('const importResults = [];');
    expect(importBlock).toContain('const receiptIds = [];');
    expect(importBlock).toContain('const feedback = buildImportFilesToast(importResults);');
    expect(importBlock).toContain("showToast(feedback.message, feedback.tone, getImportUndoToastOptions(receiptIds, 'import'));");
    expect(importBlock).not.toContain('showToast(`Imported: ${file.name}`');
    expect(importBlock).not.toContain('showToast(`Failed: ${file.name}`');
  });

  it('does not use bare Failed, Deleted, or Empty toast copy', () => {
    expect(src).not.toContain("showToast('Failed'");
    expect(src).not.toContain("showToast('Deleted'");
    expect(src).not.toContain("showToast('Empty'");
    expect(src).not.toContain("res?.error || 'Failed'");
    expect(src).toContain("showToast(getErrorMessage(e, 'Failed to create folder'), 'error');");
    expect(src).toContain('Deleted storage value');
    expect(src).toContain('Paste JSON to restore before importing');
  });
});

describe('Script chains use the real background API (2026-07 regression)', () => {
  const src = read('pages/dashboard-chains.js');
  it('runs steps via runScriptNow, not the non-existent executeScript action', () => {
    expect(src).toContain("action: 'runScriptNow'");
    expect(src).not.toContain("action: 'executeScript'");
  });
  it('loads the script list from the getScripts message, not legacy storage', () => {
    expect(src).toContain("action: 'getScripts'");
    expect(src).not.toContain("chrome.storage.local.get('userscripts')");
  });
  it('rejects failed steps so the retry loop can engage', () => {
    expect(src).toContain('reject(new Error');
  });
  it('uses the chain-link glyph, not a baseball', () => {
    expect(src).not.toContain('&#9918;');
    expect(src).toContain('&#9939;');
  });
});

describe('Context-menu script execution isolation (2026-07 regression)', () => {
  it('runs context-menu scripts through the shared USER_SCRIPT-world helper', () => {
    const src = read('background.core.js');
    const start = src.indexOf("info.menuItemId.startsWith('scriptvault-ctx-')");
    const end = src.indexOf('// Feedback notification', start);
    const block = src.slice(start, end);
    expect(block).toContain('executeWrappedScriptInTab');
    expect(block).not.toContain('chrome.scripting.executeScript');
  });
});

describe('Sync crypto KDF iteration cap (2026-07 regression)', () => {
  it('rejects out-of-range declared iteration counts on decrypt', () => {
    const src = read('modules/sync-crypto.js');
    expect(src).toContain('MAX_KDF_ITERATIONS');
    expect(src).toContain('declaredIterations > MAX_KDF_ITERATIONS');
  });
});

describe('Theme editor section headers (2026-07 regression)', () => {
  it('uses the innerHTML key (el() routes any other key to setAttribute)', () => {
    const src = read('pages/dashboard-theme-editor.js');
    expect(src).toContain("innerHTML: `<h4>${title}</h4>");
  });
});

describe('Local-date keys for heatmap and gamification (2026-07 regression)', () => {
  it('heatmap _dateKey builds the key from local date components', () => {
    const src = read('pages/dashboard-heatmap.js');
    const fn = src.slice(src.indexOf('function _dateKey'), src.indexOf('function _dateKey') + 500);
    expect(fn).toContain('getFullYear');
    expect(fn).toContain("padStart(2, '0')");
    expect(fn).not.toContain('d.toISOString()');
  });
  it('gamification todayKey builds the key from local date components', () => {
    const src = read('pages/dashboard-gamification.js');
    const fn = src.slice(src.indexOf('function localDateKey'), src.indexOf('function localDateKey') + 500);
    expect(fn).toContain('getFullYear');
    expect(fn).toContain("padStart(2, '0')");
    expect(src).toContain('function yesterdayKey');
    expect(src).toContain('d.setDate(d.getDate() - 1)');
    expect(src).toContain('const yesterday = yesterdayKey();');
    expect(src).not.toContain('Date.now() - DAY_MS');
    expect(src).not.toContain('.toISOString().slice(0, 10)');
  });
});

describe('Package includes page-loaded modules (2026-07 regression)', () => {
  const pageModules = ['modules/i18n.js', 'modules/script-config.js', 'modules/user-scripts-setup.js'];
  it('build.sh ships the page-loaded modules', () => {
    const src = read('build.sh');
    for (const m of pageModules) expect(src).toContain(m);
  });
  it('build-firefox.sh ships the page-loaded modules', () => {
    const src = read('build-firefox.sh');
    for (const m of pageModules) expect(src).toContain(m);
  });
  it('build-edge.mjs ships the page-loaded modules and the managed schema', () => {
    const src = read('scripts/build-edge.mjs');
    for (const m of pageModules) expect(src).toContain(m);
    expect(src).toContain('managed-storage-schema.json');
  });
});

describe('Dashboard quota bar uses real quota (2026-07 regression)', () => {
  // The manifest declares unlimitedStorage, so the 10MB chrome.storage.local
  // cap does not apply. updateStats() previously hardcoded 10MB and toasted
  // "Storage at 100% capacity" with only two scripts installed. It must ask
  // the background QuotaManager (navigator.storage.estimate) for the quota,
  // keeping 10MB only as the messaging fallback.
  const src = read('pages/dashboard.js');
  it('queries getStorageUsage for the quota instead of a hardcoded cap', () => {
    expect(src).toContain("sendMessage({ action: 'getStorageUsage' })");
    expect(src).toContain('Number.isFinite(usage.quota) && usage.quota > 0');
    expect(src).not.toContain('const QUOTA_BYTES = 10 * 1024 * 1024');
  });
  it('manifest still declares unlimitedStorage', () => {
    const manifest = JSON.parse(read('manifest.json'));
    expect(manifest.permissions).toContain('unlimitedStorage');
  });
});

describe('Dashboard UX pass (2026-07-02 regression)', () => {
  const dashJs = read('pages/dashboard.js');
  const dashHtml = read('pages/dashboard.html');

  it('setLabelPreservingDecor skips elements whose label lives in a [data-i18n] on self or child', () => {
    // Tab buttons hold their label in a data-i18n span; appending a second
    // text node rendered "Installed UserscriptsInstalled Userscripts". The guard
    // also skips elements that carry data-i18n on themselves (e.g. btnBulkApply),
    // which would otherwise get a stray leading space.
    expect(dashJs).toContain("if (el.matches('[data-i18n]') || el.querySelector('[data-i18n]')) return;");
    expect(dashJs).not.toMatch(/DASHBOARD_I18N_TEXT_TARGETS = Object\.freeze\(\{[^}]*dashboardTab/s);
    // The self-data-i18n toolbar buttons must not be in the map.
    expect(dashJs).not.toMatch(/DASHBOARD_I18N_TEXT_TARGETS = Object\.freeze\(\{[^}]*btnBulkApply/s);
  });

  it('theme switches show no success toast', () => {
    expect(read('pages/dashboard-theme-editor.js')).not.toContain("toast('Theme applied')");
    expect(dashJs).toContain("key === 'layout' || key === 'editorTheme'");
  });

  it('empty open-editors tab group is hidden instead of rendering a stray pill', () => {
    expect(dashHtml).toContain('.tm-tabs-scripts:empty');
  });

  it('editor overlay takes the full viewport and drops hero chrome', () => {
    expect(dashHtml).toMatch(/\.editor-overlay \{[^}]*top: 0; left: 0; right: 0; bottom: 0;/s);
    expect(dashHtml).toMatch(/\.editor-eyebrow \{\s*display: none;/);
    expect(dashHtml).toMatch(/\.editor-subtitle \{\s*display: none;/);
  });

  it('New Script skips the template picker and opens the editor directly', () => {
    const fn = dashJs.match(/async function createNewScript\(\) \{[\s\S]*?\n    \}/);
    expect(fn).toBeTruthy();
    expect(fn[0]).not.toContain('showModal');
    expect(fn[0]).toContain('SCRIPT_TEMPLATES.blank.code');
    expect(fn[0]).toContain('openEditorForScript(response.scriptId)');
  });
});

describe('Extension pages have no CSP-blocked inline scripts (2026-07 regression)', () => {
  // MV3 script-src 'self' blocks inline scripts; the dir bootstrap must load
  // from pages/page-dir.js or it silently never runs.
  const pages = ['dashboard', 'devtools-panel', 'install', 'popup', 'sidepanel'];
  for (const page of pages) {
    it(`pages/${page}.html uses the external dir bootstrap`, () => {
      const src = read(`pages/${page}.html`);
      expect(src).toContain('<script src="page-dir.js"></script>');
      expect(src).not.toMatch(/<script>[^<]*documentElement\.dir/);
    });
  }
  it('page-dir.js exists and sets the direction', () => {
    expect(read('pages/page-dir.js')).toContain("chrome.i18n?.getMessage?.('@@bidi_dir')");
  });
});

describe('Editor adapter/sandbox correctness (2026-07-02 audit)', () => {
  it('setValue does not arm the change latch on a no-op (would swallow next keystroke)', () => {
    const src = read('pages/editor-sandbox.html');
    // Guard must precede arming the latch.
    expect(src).toMatch(/if \(editor\.getValue\(\) === value\) \{\s*editor\.focus\(\);\s*return;\s*\}\s*ignoreNextChange = true;/);
  });
  it('monaco adapter caches the real cursor position instead of a frozen stub', () => {
    const src = read('pages/monaco-adapter.js');
    expect(src).toContain('_lastCursor = { line: msg.line - 1, ch: msg.col - 1 }');
    expect(src).toContain('return { line: _lastCursor.line, ch: _lastCursor.ch }');
    expect(src).not.toContain('return { line: 0, ch: 0 }; // Monaco sends cursor events');
  });
  it('monaco adapter exposes getHistory/setHistory stubs so tab-switch calls do not throw', () => {
    const src = read('pages/monaco-adapter.js');
    expect(src).toContain('getHistory() { return null; }');
    expect(src).toContain('setHistory() {}');
  });
});

describe('Editor overlay layering + nav band (2026-07-02 regression)', () => {
  const dashHtml = read('pages/dashboard.html');
  it('editor overlay stacks above sticky page chrome and below modals', () => {
    // .tm-header is sticky z-index:100 and stays rendered under the overlay;
    // anything <= 100 leaves the editor Save/Close row painted over and
    // unclickable. Modals sit at 300 and must stay on top.
    const overlay = dashHtml.match(/\.editor-overlay \{[\s\S]*?\}/)[0];
    expect(overlay).toContain('z-index: 200;');
  });
  it('hidden editor buttons actually hide despite display rules', () => {
    expect(dashHtml).toContain('.editor-actions .btn[hidden]');
    expect(dashHtml).toContain('.editor-toolbar .toolbar-btn[hidden]');
  });
  it('tabs and toolbar share one editor-nav band, tools icon-only', () => {
    expect(dashHtml).toContain('<div class="editor-nav">');
    expect(dashHtml).toContain('.editor-toolbar .toolbar-btn span');
    // The legacy dashboard.css rule that right-shoved the tabs is gone.
    expect(read('pages/dashboard.css')).not.toMatch(/\.editor-tabs \{[^}]*margin-left: auto/);
  });
});
