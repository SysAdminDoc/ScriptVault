import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const storeCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-store.js'), 'utf8');
const profilesCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-profiles.js'), 'utf8');
const chainsCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-chains.js'), 'utf8');
const standaloneCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-standalone.js'), 'utf8');

function createScriptStore() {
  return new Function(storeCode + '\nreturn ScriptStore;')();
}

function createProfileManager() {
  return new Function(profilesCode + '\nreturn ProfileManager;')();
}

function createScriptChains() {
  return new Function(chainsCode + '\nreturn ScriptChains;')();
}

function createStandaloneExport() {
  return new Function(standaloneCode + '\nreturn StandaloneExport;')();
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

describe('dashboard audit surfaces', () => {
  let originalFetch;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    globalThis.__resetStorageMock?.();
    vi.restoreAllMocks();
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    globalThis.__resetStorageMock?.();
    if (originalFetch === undefined) {
      Reflect.deleteProperty(globalThis, 'fetch');
    } else {
      globalThis.fetch = originalFetch;
    }
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('store disables search controls while loading and reports preview failures inline', async () => {
    const ScriptStore = createScriptStore();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const initialSearch = createDeferred();
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => initialSearch.promise)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue(''),
      });

    ScriptStore.init(container, {
      getInstalledScripts: async () => [],
    });

    await Promise.resolve();

    const searchInput = container.querySelector('.ss-search-input');
    const status = container.querySelector('.ss-status');
    const controls = Array.from(container.querySelectorAll('.ss-search-control'));

    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(searchInput?.disabled).toBe(true);
    expect(controls.every((control) => control.disabled)).toBe(true);

    initialSearch.resolve({
      ok: true,
      json: async () => [{
        id: 1,
        name: 'Alpha Script',
        users: [{ name: 'Alice' }],
        description: 'Preview me',
        version: '1.0.0',
        total_installs: 1200,
        daily_installs: 15,
        code_updated_at: '2026-03-30T12:00:00Z',
        code_url: 'https://example.com/alpha.user.js',
        url: 'https://greasyfork.org/en/scripts/1-alpha-script',
      }],
    });
    await flushPromises();

    expect(searchInput?.disabled).toBe(false);
    expect(controls.every((control) => !control.disabled)).toBe(true);

    const previewButton = container.querySelector('[data-action="preview"]');
    previewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const preview = container.querySelector('.ss-card-preview');
    expect(preview?.classList.contains('open')).toBe(true);
    expect(preview?.textContent).toContain('Failed to load script code.');
    expect(previewButton?.textContent).toBe('Preview Code');
    expect(container.querySelector('.ss-status-text')?.textContent).toBe('Preview failed.');
    expect(container.querySelector('.ss-results')?.getAttribute('aria-busy')).toBe('false');

    ScriptStore.destroy();
  });

  it('profiles switch scripts with scriptId and expose semantic controls', async () => {
    const ProfileManager = createProfileManager();
    const container = document.createElement('div');
    const headerAnchor = document.createElement('div');
    headerAnchor.className = 'sv-profile-header-anchor';
    container.appendChild(headerAnchor);
    document.body.appendChild(container);

    chrome.runtime.sendMessage = vi.fn((message) => {
      if (message.action === 'getScripts') {
        return Promise.resolve({
          scripts: [{ id: 'alpha', enabled: true, meta: { name: 'Alpha Script' } }],
        });
      }
      return Promise.resolve({});
    });

    ProfileManager.init(container);
    await flushPromises();

    const profile = await ProfileManager.createProfile('Work', {
      emoji: '🧪',
      color: '#60a5fa',
      scriptStates: { alpha: false },
    });
    await flushPromises();

    const chip = container.querySelector(`.sv-profile-chip[data-profile-id="${profile.id}"]`);
    const addButton = container.querySelector('.sv-profile-add-btn');

    expect(chip?.tagName).toBe('BUTTON');
    expect(chip?.getAttribute('type')).toBe('button');
    expect(addButton?.getAttribute('type')).toBe('button');

    await ProfileManager.switchProfile(profile.id);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      action: 'toggleScript',
      scriptId: 'alpha',
      enabled: false,
    }));

    const indicator = container.querySelector('.sv-profile-indicator');
    expect(indicator?.tagName).toBe('BUTTON');
    expect(indicator?.getAttribute('aria-haspopup')).toBe('menu');

    indicator?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const dropdownItem = container.querySelector('.sv-profile-dropdown-item');
    expect(dropdownItem?.tagName).toBe('BUTTON');
    expect(dropdownItem?.getAttribute('role')).toBe('menuitemradio');
    expect(container.querySelectorAll('.sv-profile-indicator-wrapper')).toHaveLength(1);

    ProfileManager.destroy();
  });

  it('chains prevent duplicate runs and expose guarded editor controls', async () => {
    const ScriptChains = createScriptChains();
    const container = document.createElement('div');
    document.body.appendChild(container);

    await chrome.storage.local.set({
      scripts: {
        alpha: { meta: { name: 'Alpha Script' } },
      },
    });

    const executeDeferred = createDeferred();
    chrome.runtime.sendMessage = vi.fn((message, callback) => {
      if (typeof callback === 'function' && message.action === 'executeScript') {
        executeDeferred.promise.then((response) => callback(response));
        return undefined;
      }
      return Promise.resolve({});
    });

    await ScriptChains.init(container);
    const chainId = await ScriptChains.createChain('Deploy', [{ scriptId: 'alpha' }]);

    const runButton = container.querySelector(`[data-chain-id="${chainId}"] .sv-chains-btn`);
    expect(runButton?.getAttribute('type')).toBe('button');

    runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(runButton?.disabled).toBe(true);
    expect(runButton?.textContent).toBe('Running…');

    const duplicateRun = await ScriptChains.executeChain(chainId);
    expect(duplicateRun).toEqual(expect.objectContaining({
      alreadyRunning: true,
      error: 'Chain already running',
    }));

    executeDeferred.resolve({ success: true });
    await flushPromises();

    expect(runButton?.disabled).toBe(false);
    expect(runButton?.textContent).toBe('Run');

    const editButton = Array.from(container.querySelectorAll(`[data-chain-id="${chainId}"] .sv-chains-btn`))
      .find((button) => button.textContent === 'Edit');
    editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const closeButton = document.querySelector('.sv-chain-editor-close');
    const addStepButton = document.querySelector('#sv-chain-add-step');
    const cancelButton = document.querySelector('#sv-chain-cancel');
    const saveButton = document.querySelector('#sv-chain-save');

    expect(closeButton?.getAttribute('type')).toBe('button');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close chain editor');
    expect(addStepButton?.getAttribute('type')).toBe('button');
    expect(cancelButton?.getAttribute('type')).toBe('button');
    expect(saveButton?.getAttribute('type')).toBe('button');

    ScriptChains.destroy();
  });

  it('chains guard repeated saves so the editor cannot create duplicates', async () => {
    const ScriptChains = createScriptChains();
    const container = document.createElement('div');
    document.body.appendChild(container);

    await ScriptChains.init(container);

    const newChainButton = container.querySelector('.sv-chains-header .sv-chains-btn.primary');
    newChainButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const nameInput = document.querySelector('#sv-chain-name');
    if (!(nameInput instanceof HTMLInputElement)) {
      throw new Error('Expected chain name input');
    }
    nameInput.value = 'Saved Once';

    const saveButton = document.querySelector('#sv-chain-save');
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const customChains = Object.values(ScriptChains.getChains())
      .filter((chain) => !chain.builtin && chain.name === 'Saved Once');
    expect(customChains).toHaveLength(1);

    ScriptChains.destroy();
  });

  it('standalone exports remove inline handlers and keep safe generated defaults', () => {
    const StandaloneExport = createStandaloneExport();
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    const script = {
      name: '***',
      description: 'Demo export',
      version: '1.0.0',
      author: 'QA',
      code: `// ==UserScript==
// @name Demo Export
// @match https://example.com/*
// ==/UserScript==
console.log('demo');
`,
    };

    StandaloneExport.init({
      getScript: () => script,
      getAllScripts: () => [script],
    });

    const singleHtml = StandaloneExport.exportAsHTML(script);
    const portfolioHtml = StandaloneExport.exportPortfolio([script]);
    const installHtml = StandaloneExport.generateInstallPage(script);

    expect(singleHtml).not.toContain('onclick=');
    expect(portfolioHtml).not.toContain('onclick=');
    expect(portfolioHtml).not.toContain('oninput=');
    expect(installHtml).not.toContain('onclick=');
    expect(singleHtml).toContain('type="button" class="btn btn-green" data-action="copy-code"');
    expect(singleHtml).toContain('rel="noopener noreferrer"');
    expect(singleHtml).toContain('role="status" aria-live="polite"');
    expect(portfolioHtml).toContain('type="search" class="search-box"');
    expect(portfolioHtml).toContain('data-action="toggle-code"');
    expect(installHtml).toContain('var _scriptName = "script"');
    expect(installHtml).toContain('data-action="toggle-source"');

    StandaloneExport.destroy();
  });
});
