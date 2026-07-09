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
const templateCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-templates.js'), 'utf8');
const backgroundCoreJs = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const popupJs = readFileSync(resolve(process.cwd(), 'pages/popup.js'), 'utf8');
const installJs = readFileSync(resolve(process.cwd(), 'pages/install.js'), 'utf8');
const notificationsModuleJs = readFileSync(resolve(process.cwd(), 'modules/notifications.js'), 'utf8');

function _invoke(body, params, args, filename) {
  try { const vm = require('node:vm'); return vm.compileFunction(body, params, { filename })(...args); } catch { return new Function(...params, body)(...args); }
}

function createCardView() {
  return _invoke(cardViewCode + '\nreturn CardView;', [], [], resolve(process.cwd(), 'pages/dashboard-cardview.js'));
}

function createCollectionManager() {
  return _invoke(collectionCode + '\nreturn CollectionManager;', [], [], resolve(process.cwd(), 'pages/dashboard-collections.js'));
}

function createCSPReporter() {
  return _invoke(cspCode + '\nreturn CSPReporter;', [], [], resolve(process.cwd(), 'pages/dashboard-csp.js'));
}

function createProfileManager() {
  return _invoke(profilesCode + '\nreturn ProfileManager;', [], [], resolve(process.cwd(), 'pages/dashboard-profiles.js'));
}

function createSnippetLibrary() {
  return _invoke(snippetsCode + '\nreturn SnippetLibrary;', [], [], resolve(process.cwd(), 'pages/dashboard-snippets.js'));
}

function createTemplateManager() {
  return _invoke(templateCode + '\nreturn TemplateManager;', [], [], resolve(process.cwd(), 'pages/dashboard-templates.js'));
}

function createDashboardRouteParser() {
  const match = dashboardJs.match(/function getDashboardRoute\(\) \{[\s\S]*?\n    \}/);
  if (!match) {
    throw new Error('Unable to locate getDashboardRoute in dashboard.js');
  }
  const _body = `${match[0]}; return getDashboardRoute;`;
  return _invoke(_body, ['window', 'DASHBOARD_TABS'], [window, ['scripts', 'settings', 'utilities', 'trash']], resolve(process.cwd(), 'pages/dashboard.js'));
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
    const menu = card?.querySelector('.cv-menu');
    const statePill = card?.querySelector('.cv-state-pill');
    const badges = Array.from(card?.querySelectorAll('.cv-badge') || []);
    const selectButton = card?.querySelector('.cv-select-btn');

    expect(menuButton?.getAttribute('type')).toBe('button');
    expect(menuButton?.getAttribute('aria-controls')).toBeTruthy();
    expect(menu?.getAttribute('role')).toBe('menu');
    expect(menuButtons.every((button) => button.getAttribute('type') === 'button')).toBe(true);
    expect(menuButtons.every((button) => button.getAttribute('role') === 'menuitem')).toBe(true);
    expect(menuButtons.every((button) => button.getAttribute('aria-label')?.includes('Alpha Script'))).toBe(true);
    expect(menuButtons.map((button) => button.textContent?.trim())).toContain('Check for Updates');
    expect(openSurface?.tagName).toBe('BUTTON');
    expect(openSurface?.getAttribute('data-open-id')).toBe('script-1');
    expect(openSurface?.getAttribute('aria-label')).toBe('Open Alpha Script in the editor');
    expect(updateButton?.getAttribute('aria-label')).toContain('Check for updates for Alpha Script');
    expect(selectButton?.getAttribute('aria-label')).toBe('Unselect Alpha Script');
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

    icon?.dispatchEvent(new window.Event('error'));
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
    expect(document.activeElement).toBe(menuButtons[0]);
    menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(menuButtons[1]);
    menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(menuButtons[menuButtons.length - 1]);
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

  it('template icons decode legacy entity values while keeping rendered icons escaped', async () => {
    const TemplateManager = createTemplateManager();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const lockIcon = String.fromCodePoint(0x1F512);
    const pageIcon = String.fromCodePoint(0x1F4C4);
    const wrenchIcon = String.fromCodePoint(0x1F527);

    await chrome.storage.local.set({
      customTemplates: [
        {
          id: 'legacy-lock',
          name: 'Legacy Lock',
          description: 'Entity icon',
          category: 'privacy',
          icon: '&#128274;',
          code: '// ==UserScript==\n// @name {{SCRIPT_NAME}}\n// ==/UserScript==',
          builtIn: false,
        },
        {
          id: 'escaped-markup',
          name: 'Escaped Markup',
          description: 'Escaped icon markup',
          category: 'utility',
          icon: '&lt;img src=x onerror=alert(1)&gt;',
          code: '// ==UserScript==\n// @name {{SCRIPT_NAME}}\n// ==/UserScript==',
          builtIn: false,
        },
      ],
    });

    await TemplateManager.init(container, {});

    const iconFor = (name) => Array.from(container.querySelectorAll('.tm-card'))
      .find((card) => card.querySelector('.tm-card-name')?.textContent === name)
      ?.querySelector('.tm-card-icon');
    const escapedIcon = iconFor('Escaped Markup');

    expect(iconFor('Blank Script')?.textContent).toBe(pageIcon);
    expect(iconFor('Legacy Lock')?.textContent).toBe(lockIcon);
    expect(escapedIcon?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(escapedIcon?.querySelector('img')).toBeNull();
    expect(escapedIcon?.innerHTML).toContain('&lt;img');

    const stored = await chrome.storage.local.get('customTemplates');
    expect(stored.customTemplates[0].icon).toBe(lockIcon);
    expect(stored.customTemplates[1].icon).toBe('<img src=x onerror=alert(1)>');

    const exported = JSON.parse(TemplateManager.exportTemplate('legacy-lock'));
    expect(exported.icon).toBe(lockIcon);

    const imported = await TemplateManager.importTemplate(JSON.stringify({
      name: 'Imported Entity Icon',
      description: '',
      category: 'utility',
      icon: '&#128295;',
      code: '// ==UserScript==\n// @name {{SCRIPT_NAME}}\n// ==/UserScript==',
    }));
    expect(imported.icon).toBe(wrenchIcon);

    TemplateManager.destroy();
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

  it('dashboard accessibility focus layer does not double-paint script search', () => {
    expect(dashboardA11yCode).toContain('.a11y-active *:focus-visible:not(#scriptSearch)');
    expect(dashboardA11yCode).toContain('.a11y-active #scriptSearch:focus-visible');
    expect(dashboardA11yCode).toContain('box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14)');
    expect(dashboardA11yCode).toContain('.a11y-high-contrast #scriptSearch:focus-visible');
  });

  it('legacy dashboard stylesheet avoids transition-all on shared controls', () => {
    expect(dashboardCss).not.toMatch(/transition:\s*all/i);
    // v3.10 polish pass tokenised transitions onto --t-fast/--t-base/--t-slow
    // with named easings. Spot-check that scoped transitions (not blanket `all`)
    // are still in place on tabs, action-btn, toast, and modal-overlay.
    expect(dashboardCss).toMatch(/\.tab\s*\{[\s\S]*?transition:\s*background var\(--t-fast\)/);
    expect(dashboardCss).toMatch(/\.action-btn\s*\{[\s\S]*?transition:\s*background 0\.15s,\s*color 0\.15s,\s*opacity 0\.15s/);
    expect(dashboardCss).toMatch(/\.toast\s*\{[\s\S]*?transition:\s*transform var\(--t-slow\)/);
    expect(dashboardCss).toMatch(/\.modal-overlay\s*\{[\s\S]*?transition:\s*opacity var\(--t-base\)/);
  });

  it('dashboard view transitions are scoped and reduced-motion safe', () => {
    expect(dashboardJs).toContain('function runDashboardViewTransition(className, update)');
    expect(dashboardJs).toContain("document.startViewTransition");
    expect(dashboardJs).toContain("prefers-reduced-motion: reduce");
    expect(dashboardJs).toContain("runDashboardViewTransition('sv-vt-dashboard'");
    expect(dashboardJs).toContain("runDashboardViewTransition('sv-vt-editor'");
    expect(dashboardCss).toContain('html.sv-vt-dashboard #mainContent');
    expect(dashboardCss).toContain('view-transition-name: sv-dashboard-workbench');
    expect(dashboardCss).toContain('html.sv-vt-editor #editorOverlay.active .editor-main');
    expect(dashboardCss).toContain('view-transition-name: sv-editor-workspace');
    expect(dashboardCss).toContain('::view-transition-old(sv-dashboard-workbench)');
    expect(dashboardCss).toContain('::view-transition-new(sv-editor-workspace)');
    expect(dashboardCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dashboardCss).toContain('view-transition-name: none !important');
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

  it('collections import the data URL emitted by share', async () => {
    const CollectionManager = createCollectionManager();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const installed = [
      { id: 'script-1', name: 'Alpha Script', enabled: true, code: '// one' },
    ];
    let sharedUrl = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async (value) => { sharedUrl = value; }),
      },
    });

    await CollectionManager.init(host, { scripts: installed, onToggle: vi.fn() });
    const collection = CollectionManager.createCollection('Share Bundle', ['script-1'], {
      notes: { 'script-1': 'Install first' },
    });

    const card = host.querySelector(`[data-id="${collection.id}"]`);
    card?.querySelector('.sv-coll-card-header')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const shareButton = card?.querySelector('[data-action="share"]');
    shareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(sharedUrl).toMatch(/^data:application\/json;base64,/);
    const result = CollectionManager.importCollection(sharedUrl);
    const imported = CollectionManager.getCollections().find((entry) => entry.id === result.id);

    expect(result.success).toBe(true);
    expect(imported).toMatchObject({
      name: 'Share Bundle',
      builtIn: false,
      scripts: [
        expect.objectContaining({
          name: 'Alpha Script',
          note: 'Install first',
        }),
      ],
    });

    CollectionManager.destroy();
  });

  it('collections persist built-in install links across reloads', async () => {
    const CollectionManager = createCollectionManager();
    const host = document.createElement('div');
    document.body.appendChild(host);

    await chrome.storage.local.set({
      sv_collections: [],
      sv_builtin_collection_installs: {},
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code_url: 'https://greasyfork.org/scripts/480483/code.user.js' }),
    });
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      success: true,
      scriptId: 'installed-privacy-1',
      script: {
        id: 'installed-privacy-1',
        enabled: true,
        code: '// installed',
        meta: { name: 'Google Analytics Blocker' },
      },
    });

    await CollectionManager.init(host, { scripts: [], onToggle: vi.fn() });
    const builtInCard = host.querySelector('[data-id="__builtin_privacy"]');
    builtInCard?.querySelector('.sv-coll-card-header')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    builtInCard?.querySelector('[data-install-idx="0"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const stored = (await chrome.storage.local.get('sv_builtin_collection_installs')).sv_builtin_collection_installs;
    expect(stored.__builtin_privacy['gf:480483']).toEqual({
      id: 'installed-privacy-1',
      enabled: true,
    });

    CollectionManager.destroy();
    host.remove();

    const ReloadedCollectionManager = createCollectionManager();
    const reloadedHost = document.createElement('div');
    document.body.appendChild(reloadedHost);
    await ReloadedCollectionManager.init(reloadedHost, { scripts: [], onToggle: vi.fn() });
    const reloadedCard = reloadedHost.querySelector('[data-id="__builtin_privacy"]');
    reloadedCard?.querySelector('.sv-coll-card-header')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(reloadedCard?.querySelector('[data-install-idx="0"]')).toBeNull();
    expect(reloadedCard?.querySelector('.sv-coll-script-toggle')?.getAttribute('data-toggle-id')).toBe('installed-privacy-1');

    ReloadedCollectionManager.destroy();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      Reflect.deleteProperty(globalThis, 'fetch');
    }
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

  it('snippet library tabs through inserted placeholders', async () => {
    const SnippetLibrary = createSnippetLibrary();
    const originalGet = chrome.storage.local.get;
    const originalSet = chrome.storage.local.set;
    chrome.storage.local.get = vi.fn((keys, callback) => {
      const result = keys === 'customSnippets' ? { customSnippets: [] } : {};
      callback?.(result);
      return Promise.resolve(result);
    });
    chrome.storage.local.set = vi.fn((items, callback) => {
      callback?.();
      return Promise.resolve();
    });
    try {
      const host = document.createElement('div');
      document.body.appendChild(host);

      let value = '';
      let selection = { start: 0, end: 0 };
      const positionForOffset = (offset) => {
        const safeOffset = Math.max(0, Math.min(value.length, offset));
        const before = value.slice(0, safeOffset).split('\n');
        return { lineNumber: before.length, column: before[before.length - 1].length + 1 };
      };
      const offsetForPosition = (position) => {
        const lines = value.split('\n');
        let offset = 0;
        for (let i = 0; i < Math.max(0, (position?.lineNumber || 1) - 1); i += 1) {
          offset += (lines[i]?.length || 0) + 1;
        }
        return Math.min(value.length, offset + Math.max(0, (position?.column || 1) - 1));
      };
      const editor = {
        getSelection: () => ({ getStartPosition: () => positionForOffset(selection.start) }),
        getModel: () => ({
          getValueInRange: () => value.slice(selection.start, selection.end),
          getOffsetAt: offsetForPosition,
          getPositionAt: positionForOffset,
        }),
        executeEdits: vi.fn((_source, edits = []) => {
          const text = edits[0]?.text || '';
          value = value.slice(0, selection.start) + text + value.slice(selection.end);
          const nextOffset = selection.start + text.length;
          selection = { start: nextOffset, end: nextOffset };
        }),
        setSelectionRange: vi.fn((start, end = start) => {
          selection = { start, end };
        }),
        setPosition: vi.fn((position) => {
          const offset = offsetForPosition(position);
          selection = { start: offset, end: offset };
        }),
        focus: vi.fn(),
      };

      await SnippetLibrary.init(host, { editor });
      const snippet = await SnippetLibrary.saveCustomSnippet({
        title: 'Placeholders',
        description: '',
        category: 'custom',
        code: 'const ${1:name} = $2;\n$CURSOR$',
      });

      SnippetLibrary.insertSnippet(snippet.id);

      expect(value).toBe('const name = ;\n');
      expect(selection).toEqual({ start: 6, end: 10 });
      expect(editor.setSelectionRange).toHaveBeenLastCalledWith(6, 10);

      value = value.slice(0, selection.start) + 'displayName' + value.slice(selection.end);
      selection = { start: 17, end: 17 };

      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      expect(SnippetLibrary.handleEditorTab({ shiftKey: false, preventDefault, stopPropagation })).toBe(true);
      expect(selection).toEqual({ start: 20, end: 20 });
      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();

      expect(SnippetLibrary.handleEditorTab({ shiftKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })).toBe(true);
      expect(selection).toEqual({ start: 22, end: 22 });

      expect(SnippetLibrary.handleEditorTab({ shiftKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn() })).toBe(true);
      expect(selection).toEqual({ start: 20, end: 20 });

      expect(SnippetLibrary.handleEditorTab({ shiftKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn() })).toBe(true);
      expect(selection).toEqual({ start: 6, end: 17 });

      expect(SnippetLibrary.handleEditorTab({ shiftKey: true })).toBe(false);
    } finally {
      SnippetLibrary.destroy();
      chrome.storage.local.get = originalGet;
      chrome.storage.local.set = originalSet;
    }
  });

  it('dashboard editor keymap delegates Tab to active snippet placeholders before indentation', () => {
    expect(dashboardJs).toContain("SnippetLibrary.handleEditorTab?.({ shiftKey: false })");
    expect(dashboardJs).toContain("SnippetLibrary.handleEditorTab?.({ shiftKey: true })");
    expect(dashboardJs).toContain('setSelectionRange(startOffset = 0, endOffset = startOffset)');
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

  it('csp bypass controls expose disclosure and switch semantics', async () => {
    const CSPReporter = createCSPReporter();
    const host = document.createElement('div');
    document.body.appendChild(host);

    await chrome.storage.local.set({ sv_csp_reports: [] });
    await CSPReporter.init(host);
    await CSPReporter.recordFailure('https://example.com', 'script-1', "script-src 'unsafe-inline'", {
      scriptName: 'Alpha Script',
    });

    const disclosure = host.querySelector('.sv-csp-bypass-header');
    const warning = host.querySelector('.sv-csp-bypass-warning');
    const toggle = host.querySelector('.sv-csp-bypass-toggle');

    expect(disclosure?.tagName).toBe('BUTTON');
    expect(disclosure?.getAttribute('aria-expanded')).toBe('false');
    expect(disclosure?.getAttribute('aria-controls')).toBe('svCspBypassBody');
    expect(warning?.getAttribute('role')).toBe('alert');
    expect(toggle?.tagName).toBe('BUTTON');
    expect(toggle?.getAttribute('role')).toBe('switch');
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('Enable CSP bypass for example.com');
    expect(cspCode).not.toContain('\\u26A0\\uFE0F <strong>Security Warning:</strong>');
    expect(cspCode).toContain('View Fix');

    disclosure?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(disclosure?.getAttribute('aria-expanded')).toBe('true');

    toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(toggle?.getAttribute('aria-checked')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('Disable CSP bypass for example.com');
    expect(host.querySelector('.sv-csp-bypass-state')?.textContent).toBe('Bypass ON');

    CSPReporter.destroy();
  });

  it('csp clear all is reversible from the undo toast', async () => {
    const CSPReporter = createCSPReporter();
    const host = document.createElement('div');
    document.body.appendChild(host);

    await chrome.storage.local.set({ sv_csp_reports: [] });
    await CSPReporter.init(host);
    await CSPReporter.recordFailure('https://example.com', 'script-1', 'script-src', {
      scriptName: 'Alpha Script',
    });
    await CSPReporter.recordFailure('https://example.org', 'script-2', 'connect-src', {
      scriptName: 'Beta Script',
    });

    host.querySelector('[data-action="clear"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect((await chrome.storage.local.get('sv_csp_reports')).sv_csp_reports).toEqual([]);
    expect(document.querySelector('.sv-csp-toast')?.textContent).toContain('2 CSP reports cleared');

    document.querySelector('.sv-csp-toast-action')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const restored = (await chrome.storage.local.get('sv_csp_reports')).sv_csp_reports;
    expect(restored).toHaveLength(2);
    expect(restored.map(r => r.hostname)).toEqual(['example.com', 'example.org']);

    CSPReporter.destroy();
  });

  it('csp bypass apply failure keeps switch and stored state off', async () => {
    const CSPReporter = createCSPReporter();
    const host = document.createElement('div');
    document.body.appendChild(host);

    await chrome.storage.local.set({ sv_csp_reports: [] });
    chrome.declarativeNetRequest.updateDynamicRules.mockRejectedValueOnce(new Error('DNR unavailable'));
    await CSPReporter.init(host);
    await CSPReporter.recordFailure('https://example.com', 'script-1', "script-src 'unsafe-inline'", {
      scriptName: 'Alpha Script',
    });

    const disclosure = host.querySelector('.sv-csp-bypass-header');
    disclosure?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const toggle = host.querySelector('.sv-csp-bypass-toggle');
    toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('Enable CSP bypass for example.com');
    expect(host.querySelector('.sv-csp-bypass-state')?.textContent).toBe('Bypass OFF');
    expect(document.querySelector('.sv-csp-toast')?.textContent).toContain('Could not enable CSP bypass for example.com');
    expect((await chrome.storage.local.get('sv_csp_bypass')).sv_csp_bypass['example.com'].enabled).toBe(false);

    CSPReporter.destroy();
  });
});
