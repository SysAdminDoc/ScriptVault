import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cardViewCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-cardview.js'), 'utf8');
const collectionCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-collections.js'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');

function createCardView() {
  const fn = new Function(cardViewCode + '\nreturn CardView;');
  return fn();
}

function createCollectionManager() {
  const fn = new Function(collectionCode + '\nreturn CollectionManager;');
  return fn();
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
});
