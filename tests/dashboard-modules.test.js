import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cardViewCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-cardview.js'), 'utf8');
const collectionCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-collections.js'), 'utf8');
const cspCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-csp.js'), 'utf8');
const dashboardA11yCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-a11y.js'), 'utf8');
const dashboardCss = readFileSync(resolve(process.cwd(), 'pages/dashboard.css'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const dashboardKeyboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard-keyboard.js'), 'utf8');
const profilesCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-profiles.js'), 'utf8');
const snippetsCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-snippets.js'), 'utf8');
const backgroundCoreJs = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const popupJs = readFileSync(resolve(process.cwd(), 'pages/popup.js'), 'utf8');
const installJs = readFileSync(resolve(process.cwd(), 'pages/install.js'), 'utf8');
const notificationsModuleJs = readFileSync(resolve(process.cwd(), 'modules/notifications.js'), 'utf8');

function createCardView() {
  const fn = new Function(cardViewCode + '\nreturn CardView;');
  return fn();
}

function createCollectionManager() {
  const fn = new Function(collectionCode + '\nreturn CollectionManager;');
  return fn();
}

function createCSPReporter() {
  const fn = new Function(cspCode + '\nreturn CSPReporter;');
  return fn();
}

function createProfileManager() {
  const fn = new Function(profilesCode + '\nreturn ProfileManager;');
  return fn();
}

function createSnippetLibrary() {
  const fn = new Function(snippetsCode + '\nreturn SnippetLibrary;');
  return fn();
}

function createDashboardRouteParser() {
  const match = dashboardJs.match(/function getDashboardRoute\(\) \{[\s\S]*?\n    \}/);
  if (!match) {
    throw new Error('Unable to locate getDashboardRoute in dashboard.js');
  }
  const fn = new Function('window', 'DASHBOARD_TABS', `${match[0]}; return getDashboardRoute;`);
  return fn(window, ['scripts', 'settings', 'utilities', 'trash', 'store']);
}

function createDeferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe('dashboard surface modules', () => {
  let originalClipboardDescriptor;
  let originalExecCommand;

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    globalThis.__resetStorageMock?.();
    vi.restoreAllMocks();
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    originalExecCommand = document.execCommand;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    if (originalExecCommand === undefined) {
      Reflect.deleteProperty(document, 'execCommand');
    } else {
      document.execCommand = originalExecCommand;
    }
  });

  it('card view uses a semantic open surface, richer badges, and forwards controller context', async () => {
    const CardView = createCardView();
    const host = document.createElement('div');
    const table = document.createElement('div');
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    document.body.append(host, table, toggleButton);

    const onEdit = vi.fn();
    const onToggle = vi.fn();
    const onUpdate = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const onSelect = vi.fn((scriptId, selected) => {
      if (selected) {
        selectedIds.add(scriptId);
      } else {
        selectedIds.delete(scriptId);
      }
    });
    const selectedIds = new Set(['script-1']);

    CardView.init(host, {
      tableContainer: table,
      toggleButton,
      isSelected: (scriptId) => selectedIds.has(scriptId),
      onSelect,
      onEdit,
      onToggle,
      onUpdate,
      onExport,
      onDelete,
    });

    CardView.render([{
      id: 'script-1',
      enabled: true,
      metadata: {
        name: 'Alpha Script',
        match: ['*://*.example.com/*'],
        icon: 'https://cdn.example.com/icon.png',
        updateURL: 'https://greasyfork.org/scripts/1-alpha/code/alpha.user.js',
        tag: ['ops'],
      },
      settings: { pinned: true, userModified: true },
      stats: { runs: 4, avgTime: 72, errors: 0 },
      updatedAt: Date.now() - 60_000,
    }]);

    const card = host.querySelector('.cv-card');
    const icon = card?.querySelector('.cv-icon');
    const fallback = card?.querySelector('.cv-icon-letter');
    const openSurface = card?.querySelector('.cv-open-surface');
    const menuButtons = Array.from(card?.querySelectorAll('.cv-menu-item') || []);
    const updateButton = card?.querySelector('.cv-meta-button');
    const toggle = card?.querySelector('input[data-toggle-id="script-1"]');
    const menuButton = card?.querySelector('.cv-menu-btn');
    const statePill = card?.querySelector('.cv-state-pill');
    const badges = Array.from(card?.querySelectorAll('.cv-badge') || []);
    const selectButton = card?.querySelector('.cv-select-btn');

    expect(menuButton?.getAttribute('type')).toBe('button');
    expect(menuButton?.getAttribute('aria-controls')).toBeTruthy();
    expect(menuButtons.every((button) => button.getAttribute('type') === 'button')).toBe(true);
    expect(menuButtons.map((button) => button.textContent?.trim())).toContain('Check for Updates');
    expect(openSurface?.tagName).toBe('BUTTON');
    expect(openSurface?.getAttribute('data-open-id')).toBe('script-1');
    expect(statePill?.textContent).toBe('Enabled');
    expect(badges.some((badge) => badge.textContent?.includes('Greasy Fork'))).toBe(true);
    expect(badges.some((badge) => badge.textContent?.includes('Pinned'))).toBe(true);
    expect(badges.some((badge) => badge.textContent?.includes('Local edits'))).toBe(true);
    expect(card?.classList.contains('cv-selected')).toBe(true);
    expect(selectButton?.getAttribute('aria-pressed')).toBe('true');
    expect(selectButton?.textContent).toBe('Selected');
    expect(icon?.getAttribute('data-favicon-fallback')).toBe('true');
    expect(icon?.getAttribute('width')).toBe('38');
    expect(icon?.getAttribute('height')).toBe('38');
    expect(icon?.getAttribute('onerror')).toBeNull();
    expect(fallback?.hasAttribute('hidden')).toBe(true);

    icon?.dispatchEvent(new Event('error'));
    expect(icon?.hidden).toBe(true);
    expect(fallback?.hasAttribute('hidden')).toBe(false);

    openSurface?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onEdit).toHaveBeenCalledWith('script-1');

    selectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('script-1', false, expect.objectContaining({ triggerEl: selectButton }));
    CardView.syncSelection();
    expect(card?.classList.contains('cv-selected')).toBe(false);
    expect(selectButton?.getAttribute('aria-pressed')).toBe('false');
    expect(selectButton?.textContent).toBe('Select');

    updateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onUpdate).toHaveBeenCalledWith('script-1', expect.objectContaining({ triggerEl: updateButton }));

    if (!(toggle instanceof HTMLInputElement)) {
      throw new Error('Expected card toggle input');
    }
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith('script-1', false, expect.objectContaining({ control: toggle }));

    menuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card?.querySelector('[data-action="export"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card?.querySelector('[data-action="delete"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onExport).toHaveBeenCalledWith('script-1', expect.objectContaining({
      triggerEl: expect.any(HTMLButtonElement),
    }));
    expect(onDelete).toHaveBeenCalledWith('script-1', expect.objectContaining({
      triggerEl: expect.any(HTMLButtonElement),
    }));

    CardView.destroy();
  });

  it('card view action lookups handle quoted script ids without breaking markup', async () => {
    const CardView = createCardView();
    const host = document.createElement('div');
    const table = document.createElement('div');
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    document.body.append(host, table, toggleButton);

    const onEdit = vi.fn();
    const onToggle = vi.fn();
    const onUpdate = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const onSelect = vi.fn();

    CardView.init(host, {
      tableContainer: table,
      toggleButton,
      isSelected: () => false,
      onSelect,
      onEdit,
      onToggle,
      onUpdate,
      onExport,
      onDelete,
    });

    CardView.render([{
      id: 'script "alpha"/beta',
      enabled: true,
      metadata: {
        name: 'Selector Script',
        match: ['*://*.example.com/*'],
      },
      settings: {},
      stats: { runs: 0, avgTime: 0, errors: 0 },
      updatedAt: Date.now(),
    }]);

    const card = host.querySelector('.cv-card');
    const openSurface = card?.querySelector('.cv-open-surface');
    const updateButton = card?.querySelector('.cv-meta-button');
    const selectButton = card?.querySelector('.cv-select-btn');
    const toggle = card?.querySelector('.cv-toggle input[type="checkbox"]');
    const menuButton = card?.querySelector('.cv-menu-btn');

    openSurface?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    updateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    selectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    if (toggle instanceof HTMLInputElement) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
    menuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card?.querySelector('[data-action="export"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card?.querySelector('[data-action="delete"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onEdit).toHaveBeenCalledWith('script "alpha"/beta');
    expect(onUpdate).toHaveBeenCalledWith('script "alpha"/beta', expect.any(Object));
    expect(onSelect).toHaveBeenCalledWith('script "alpha"/beta', true, expect.any(Object));
    expect(onToggle).toHaveBeenCalledWith('script "alpha"/beta', false, expect.any(Object));
    expect(onExport).toHaveBeenCalledWith('script "alpha"/beta', expect.any(Object));
    expect(onDelete).toHaveBeenCalledWith('script "alpha"/beta', expect.any(Object));

    CardView.destroy();
  });

  it('dashboard card view integration reuses guarded controller paths', () => {
    expect(dashboardJs).toMatch(/isSelected: id => state\.selectedScripts\.has\(id\)/);
    expect(dashboardJs).toMatch(/onSelect: \(id, selected\) => \{/);
    expect(dashboardJs).toMatch(/if \(selected\) state\.selectedScripts\.add\(id\);/);
    expect(dashboardJs).toMatch(/else state\.selectedScripts\.delete\(id\);/);
    expect(dashboardJs).toMatch(/onToggle: \(id, enabled, options = \{\}\) => toggleScriptEnabled\(id, enabled, options\)/);
    expect(dashboardJs).toMatch(/onUpdate: \(id, options = \{\}\) => checkScriptForUpdates\(id, \{ \.\.\.options \}\)/);
    expect(dashboardJs).toMatch(/await runButtonTask\(options\.triggerEl, exportTask, \{ busyLabel: 'Exporting…' \}\)/);
    expect(dashboardJs).toMatch(/await runButtonTask\(options\.triggerEl, deleteTask, \{ busyLabel: 'Deleting…' \}\)/);
    expect(dashboardJs).toMatch(/await deleteScript\(id\);/);
  });

  it('dashboard route parser accepts both current and legacy editor hashes', () => {
    const getDashboardRoute = createDashboardRouteParser();
    const originalHash = window.location.hash;

    window.location.hash = '#script_script_alpha';
    expect(getDashboardRoute()).toEqual({ type: 'script', scriptId: 'script_alpha' });

    window.location.hash = '#script=script_beta';
    expect(getDashboardRoute()).toEqual({ type: 'script', scriptId: 'script_beta' });

    window.location.hash = '#edit=script_gamma';
    expect(getDashboardRoute()).toEqual({ type: 'script', scriptId: 'script_gamma' });

    window.location.hash = '#new';
    expect(getDashboardRoute()).toEqual({ type: 'new' });

    window.location.hash = originalHash;
  });

  it('background dashboard launcher uses the current editor hash format', () => {
    expect(backgroundCoreJs).toContain('#script_${encodeURIComponent(data.scriptId)}');
    expect(backgroundCoreJs).toContain("#new_script");
    expect(backgroundCoreJs).not.toContain('#edit=${data.scriptId}');
    expect(backgroundCoreJs).not.toContain("#new'");
  });

  it('secondary dashboard launchers and notifications follow the canonical editor route contract', () => {
    expect(popupJs).toContain("action: 'openDashboard'");
    expect(popupJs).toContain('data: scriptId ? { scriptId } : {}');
    expect(popupJs).toContain('data: { newScript: true }');
    expect(popupJs).toContain('encodeURIComponent(scriptId)');
    expect(popupJs).not.toContain('pages/dashboard.html#script_${scriptId}');

    expect(installJs).toContain('encodeURIComponent(scriptId)');
    expect(installJs).not.toContain('pages/dashboard.html#script_${scriptId}');

    expect(notificationsModuleJs).toContain('const sessionStorage = chrome.storage.session;');
    expect(notificationsModuleJs).toContain('Promise.allSettled(cleanup)');
    expect(notificationsModuleJs).toContain('#script_${encodeURIComponent(ctx.scriptId)}');
    expect(notificationsModuleJs).not.toContain('#script=${ctx.scriptId}');
  });

  it('dashboard editor routes and selector lookups escape script ids consistently', () => {
    expect(dashboardJs).toContain('function escapeSelectorValue(value)');
    expect(dashboardJs).toContain('function getScriptTabElement(scriptId)');
    expect(dashboardJs).toContain('const scriptIdAttr = escapeHtml(String(script.id));');
    expect(dashboardJs).toContain('setDashboardHash(`script_${encodeURIComponent(scriptId)}`);');
    expect(dashboardJs).not.toContain('.tm-tab[data-script-id="${scriptId}"]');
    expect(dashboardJs).not.toContain('.tm-tab.script-tab[data-script-id="${scriptId}"]');

    expect(dashboardKeyboardJs).toContain('CSS.escape(String(scriptId))');
    expect(dashboardKeyboardJs).toContain('document.querySelector(`[data-script-id="${selectorId}"]`)');
    expect(dashboardKeyboardJs).not.toContain('document.querySelector(`[data-script-id="${scriptId}"]`)');
    expect(cardViewCode).toContain('const scriptIdAttr = escapeHtml(String(script.id));');
    expect(profilesCode).toContain('function _buildInputId(prefix, value, index)');
  });

  it('profile editor keeps checkbox labels working for quoted script ids', async () => {
    const ProfileManager = createProfileManager();
    const container = document.createElement('div');
    container.innerHTML = '<div class="sv-profile-header-anchor"></div>';
    document.body.appendChild(container);

    const sendMessageMock = vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(async (message) => {
      if (message?.action === 'getScripts') {
        return {
          scripts: [
            { id: 'script "alpha"/beta', meta: { name: 'Quoted Script' }, enabled: true },
          ],
        };
      }
      return {};
    });

    ProfileManager.init(container);
    await flushPromises();

    container.querySelector('.sv-profile-add-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const checkbox = document.querySelector('#svProfileScripts input[type="checkbox"]');
    const label = document.querySelector('#svProfileScripts label');

    if (!(checkbox instanceof HTMLInputElement) || !(label instanceof HTMLLabelElement)) {
      throw new Error('Expected profile script checkbox and label');
    }

    expect(checkbox.dataset.scriptId).toBe('script "alpha"/beta');
    expect(checkbox.id).not.toContain('"');
    expect(label.getAttribute('for')).toBe(checkbox.id);

    checkbox.checked = true;
    label.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(checkbox.checked).toBe(false);

    sendMessageMock.mockRestore();
    ProfileManager.destroy();
  });

  it('dashboard workspace and trash markup escape ids before writing data attributes', () => {
    expect(dashboardJs).toContain('const scriptIdAttr = escapeHtml(script.id);');
    expect(dashboardJs).toContain('data-trash-restore="${scriptIdAttr}"');
    expect(dashboardJs).toContain('data-trash-delete="${scriptIdAttr}"');
    expect(dashboardJs).toContain('const folderIdAttr = escapeHtml(folder.id);');
    expect(dashboardJs).toContain('data-folder-delete="${folderIdAttr}"');
    expect(dashboardJs).toContain('data-ws-id="${escapeHtml(ws.id)}"');
    expect(dashboardJs).toContain('data-ws-activate="${escapeHtml(ws.id)}"');
    expect(dashboardJs).toContain('data-ws-save="${escapeHtml(ws.id)}"');
    expect(dashboardJs).toContain('data-ws-delete="${escapeHtml(ws.id)}"');
  });

  it('dashboard accessibility helper escapes input ids before querying labels', () => {
    expect(dashboardA11yCode).toContain('function escapeSelectorValue(value)');
    expect(dashboardA11yCode).toContain('label[for="${escapeSelectorValue(id)}"]');
  });

  it('legacy dashboard stylesheet avoids transition-all on shared controls', () => {
    expect(dashboardCss).not.toMatch(/transition:\s*all/i);
    expect(dashboardCss).toContain('transition: background 0.15s, color 0.15s, border-color 0.15s;');
    expect(dashboardCss).toContain('transition: background 0.15s, color 0.15s, opacity 0.15s;');
    expect(dashboardCss).toContain('transition: transform 0.3s, opacity 0.3s;');
    expect(dashboardCss).toContain('transition: opacity 0.2s, visibility 0.2s;');
  });

  it('collections render accessible controls and await async per-script toggles', async () => {
    const CollectionManager = createCollectionManager();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const installed = [{ id: 'script-1', name: 'Alpha Script', enabled: true, code: '// test' }];
    const toggleDeferred = createDeferred();
    const onToggle = vi.fn((scriptId, enable) =>
      toggleDeferred.promise.then(() => {
        const script = installed.find((entry) => entry.id === scriptId);
        if (script) script.enabled = enable;
      })
    );

    await CollectionManager.init(host, { scripts: installed, onToggle });

    const search = host.querySelector('.sv-coll-search');
    const createButton = host.querySelector('[data-action="create"]');
    const importButton = host.querySelector('[data-action="import"]');

    expect(search?.getAttribute('type')).toBe('search');
    expect(search?.getAttribute('name')).toBe('collectionSearch');
    expect(search?.getAttribute('aria-label')).toBe('Search collections');
    expect(search?.getAttribute('autocomplete')).toBe('off');
    expect(search?.getAttribute('spellcheck')).toBe('false');
    expect(createButton?.getAttribute('type')).toBe('button');
    expect(importButton?.getAttribute('type')).toBe('button');

    createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const closeEditorButton = document.querySelector('.sv-coll-modal-close');
    expect(closeEditorButton?.getAttribute('type')).toBe('button');
    expect(closeEditorButton?.getAttribute('aria-label')).toBe('Close collection editor');
    closeEditorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const collection = CollectionManager.createCollection('QA Bundle', ['script-1']);
    const card = host.querySelector(`[data-id="${collection.id}"]`);
    card?.querySelector('.sv-coll-card-header')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const toggleButton = card?.querySelector('.sv-coll-script-toggle');
    expect(toggleButton?.tagName).toBe('BUTTON');
    expect(toggleButton?.getAttribute('type')).toBe('button');
    expect(toggleButton?.getAttribute('aria-pressed')).toBe('true');

    toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(onToggle).toHaveBeenCalledWith('script-1', false, expect.objectContaining({
      control: toggleButton,
    }));
    expect(toggleButton?.disabled).toBe(true);
    expect(toggleButton?.getAttribute('aria-busy')).toBe('true');

    toggleDeferred.resolve();
    await flushPromises();

    const refreshedToggle = host.querySelector(`[data-id="${collection.id}"] .sv-coll-script-toggle`);
    expect(refreshedToggle?.getAttribute('aria-pressed')).toBe('false');

    CollectionManager.destroy();
  });

  it('collections bulk actions stay guarded and share falls back without clipboard API', async () => {
    const CollectionManager = createCollectionManager();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const installed = [
      { id: 'script-1', name: 'Alpha Script', enabled: false, code: '// one' },
      { id: 'script-2', name: 'Beta Script', enabled: false, code: '// two' },
    ];
    const toggleDeferred = createDeferred();
    const onToggle = vi.fn((scriptId, enable) =>
      toggleDeferred.promise.then(() => {
        const script = installed.find((entry) => entry.id === scriptId);
        if (script) script.enabled = enable;
      })
    );

    await CollectionManager.init(host, { scripts: installed, onToggle });
    const collection = CollectionManager.createCollection('Ops Bundle', ['script-1', 'script-2']);
    const card = host.querySelector(`[data-id="${collection.id}"]`);
    card?.querySelector('.sv-coll-card-header')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const enableAllButton = card?.querySelector('[data-action="enable-all"]');
    enableAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(enableAllButton?.disabled).toBe(true);
    expect(enableAllButton?.textContent).toBe('Enabling…');
    expect(onToggle).toHaveBeenCalledTimes(2);

    toggleDeferred.resolve();
    await flushPromises();

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    document.execCommand = vi.fn().mockReturnValue(true);

    const shareButton = host.querySelector(`[data-id="${collection.id}"] [data-action="share"]`);
    shareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('.sv-coll-toast')?.textContent).toContain('Shareable link copied to clipboard');

    CollectionManager.destroy();
  });

  it('collections preserve notes for script ids with selector characters', async () => {
    const CollectionManager = createCollectionManager();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const installed = [{ id: 'script alpha/beta', name: 'Alpha Script', enabled: true, code: '// test' }];

    await CollectionManager.init(host, { scripts: installed, onToggle: vi.fn() });

    host.querySelector('[data-action="create"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const nameInput = document.getElementById('sv-coll-name');
    const checkbox = document.querySelector('#sv-coll-picker input[type="checkbox"]');
    const noteInput = document.querySelector('.sv-coll-script-pick-note');
    const saveButton = document.querySelector('.sv-coll-modal [data-action="save"]');

    if (!(nameInput instanceof HTMLInputElement) || !(checkbox instanceof HTMLInputElement) || !(noteInput instanceof HTMLInputElement)) {
      throw new Error('Expected collection editor fields');
    }

    nameInput.value = 'Selector Collection';
    checkbox.checked = true;
    noteInput.value = 'Keep this note';
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const created = CollectionManager.getCollections().find((entry) => entry.name === 'Selector Collection');
    expect(created?.scripts).toEqual([
      expect.objectContaining({
        scriptId: 'script alpha/beta',
        note: 'Keep this note',
      }),
    ]);

    CollectionManager.destroy();
  });

  it('snippet library escapes custom snippet ids in markup and feedback selectors', () => {
    expect(snippetsCode).toContain('function escapeSelectorValue(value)');
    expect(snippetsCode).toContain('const snippetIdAttr = escapeHTML(s.id);');
    expect(snippetsCode).toContain('data-id="${snippetIdAttr}"');
    expect(snippetsCode).toContain('const selectorId = escapeSelectorValue(snippetId);');
    expect(snippetsCode).toContain('data-id="${selectorId}"]`');
  });

  it('csp fix disclosure toggles for row keys with selector characters', async () => {
    const CSPReporter = createCSPReporter();
    const host = document.createElement('div');
    document.body.appendChild(host);

    await chrome.storage.local.set({ sv_csp_reports: [] });
    await CSPReporter.init(host);
    await CSPReporter.recordFailure('https://example.com', 'script-1', "script-src 'unsafe-inline'", {
      scriptName: 'Alpha Script',
    });

    const fixButton = host.querySelector('[data-show-fix]');
    const suggestionRow = host.querySelector('.sv-csp-suggestion-row');

    expect(suggestionRow?.classList.contains('visible')).toBe(false);

    fixButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(suggestionRow?.classList.contains('visible')).toBe(true);

    CSPReporter.destroy();
  });
});
