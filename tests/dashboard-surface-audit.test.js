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

    const titleLink = container.querySelector('.ss-card-name a');
    const pageLink = container.querySelector('.ss-card-actions a.ss-btn');
    const previewButton = container.querySelector('[data-action="preview"]');
    const preview = container.querySelector('.ss-card-preview');
    expect(titleLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(pageLink?.tagName).toBe('A');
    expect(pageLink?.getAttribute('target')).toBe('_blank');
    expect(pageLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(preview?.getAttribute('role')).toBe('region');
    expect(preview?.getAttribute('tabindex')).toBe('-1');
    expect(preview?.hasAttribute('hidden')).toBe(true);
    expect(previewButton?.getAttribute('aria-expanded')).toBe('false');

    previewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(preview?.classList.contains('open')).toBe(true);
    expect(preview?.hasAttribute('hidden')).toBe(false);
    expect(preview?.textContent).toContain('Failed to load script code.');
    expect(previewButton?.textContent).toBe('Hide Preview');
    expect(previewButton?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.ss-status-text')?.textContent).toBe('Preview failed.');
    expect(container.querySelector('.ss-results')?.getAttribute('aria-busy')).toBe('false');

    previewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(preview?.classList.contains('open')).toBe(false);
    expect(preview?.hasAttribute('hidden')).toBe(true);
    expect(previewButton?.textContent).toBe('Preview Code');
    expect(previewButton?.getAttribute('aria-expanded')).toBe('false');

    ScriptStore.destroy();
  });

  it('store preview closes with Escape and restores focus to the trigger', async () => {
    const ScriptStore = createScriptStore();
    const container = document.createElement('div');
    document.body.appendChild(container);

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 4,
          name: 'Delta Script',
          users: [{ name: 'Dana' }],
          description: 'Keyboard preview',
          version: '1.0.0',
          total_installs: 120,
          daily_installs: 5,
          code_updated_at: '2026-04-02T12:00:00Z',
          code_url: 'https://example.com/delta.user.js',
          url: 'https://greasyfork.org/en/scripts/4-delta-script',
        }],
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '// ==UserScript==',
      });

    ScriptStore.init(container, {
      getInstalledScripts: async () => [],
    });
    await flushPromises();

    const previewButton = container.querySelector('[data-action="preview"]');
    const preview = container.querySelector('.ss-card-preview');

    previewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(preview?.classList.contains('open')).toBe(true);
    expect(document.activeElement).toBe(preview);

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();

    expect(preview?.classList.contains('open')).toBe(false);
    expect(previewButton?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(previewButton);

    ScriptStore.destroy();
  });

  it('store keeps one source active and disables actions when install URLs are missing', async () => {
    const ScriptStore = createScriptStore();
    const container = document.createElement('div');
    document.body.appendChild(container);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: 2,
        name: 'Beta Script',
        users: [{ name: 'Bea' }],
        description: 'No direct code URL',
        version: '2.0.0',
        total_installs: 42,
        daily_installs: 0,
        code_updated_at: '2026-03-31T12:00:00Z',
        url: 'https://greasyfork.org/en/scripts/2-beta-script',
      }],
    });

    ScriptStore.init(container, {
      getInstalledScripts: async () => [],
    });
    await flushPromises();

    const installButton = container.querySelector('[data-action="install"]');
    const previewButton = container.querySelector('[data-action="preview"]');
    const pageLink = container.querySelector('.ss-card-actions a.ss-btn');
    const sourceChips = Array.from(container.querySelectorAll('.ss-source-chip[data-source]'));

    expect(installButton?.disabled).toBe(true);
    expect(previewButton?.disabled).toBe(true);
    expect(pageLink?.tagName).toBe('A');

    sourceChips[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sourceChips[0]?.getAttribute('aria-pressed')).toBe('false');

    sourceChips[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sourceChips[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.ss-status-text')?.textContent).toBe('At least one source must stay active.');
    expect(container.querySelector('.ss-status-hint')?.textContent).toContain('Enable another source');

    ScriptStore.destroy();
  });

  it('store keeps install actions consistent after a successful install', async () => {
    const ScriptStore = createScriptStore();
    const container = document.createElement('div');
    document.body.appendChild(container);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: 3,
        name: 'Gamma Script',
        users: [{ name: 'Gia' }],
        description: 'Install me',
        version: '1.2.3',
        total_installs: 90,
        daily_installs: 3,
        code_updated_at: '2026-04-01T12:00:00Z',
        code_url: 'https://example.com/gamma.user.js',
        url: 'https://greasyfork.org/en/scripts/3-gamma-script',
      }],
    });

    chrome.runtime.sendMessage = vi.fn((message) => {
      if (message.action === 'installFromUrl') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({});
    });

    ScriptStore.init(container, {
      getInstalledScripts: async () => [],
    });
    await flushPromises();

    const installButton = container.querySelector('[data-action="install"]');
    installButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(installButton?.textContent).toBe('Reinstall');
    expect(installButton?.disabled).toBe(false);
    expect(installButton?.getAttribute('aria-busy')).toBeNull();
    expect(container.querySelector('.ss-card')?.classList.contains('installed')).toBe(true);
    expect(container.querySelector('.ss-installed-badge')?.textContent).toBe('Installed');

    ScriptStore.destroy();
  });

  it('store keeps keyboard focus on pagination controls after results rerender', async () => {
    const ScriptStore = createScriptStore();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const pageOne = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      name: `Page One ${index + 1}`,
      users: [{ name: 'Nia' }],
      description: 'First page result',
      version: '1.0.0',
      total_installs: 100 - index,
      daily_installs: 5,
      code_updated_at: '2026-04-01T12:00:00Z',
      code_url: `https://example.com/one-${index + 1}.user.js`,
      url: `https://greasyfork.org/en/scripts/${index + 1}-page-one`,
    }));
    const pageTwo = Array.from({ length: 10 }, (_, index) => ({
      id: index + 11,
      name: `Page Two ${index + 1}`,
      users: [{ name: 'Nia' }],
      description: 'Second page result',
      version: '1.0.0',
      total_installs: 90 - index,
      daily_installs: 4,
      code_updated_at: '2026-04-02T12:00:00Z',
      code_url: `https://example.com/two-${index + 1}.user.js`,
      url: `https://greasyfork.org/en/scripts/${index + 11}-page-two`,
    }));

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => pageOne })
      .mockResolvedValueOnce({ ok: true, json: async () => pageTwo });

    ScriptStore.init(container, {
      getInstalledScripts: async () => [],
    });
    await flushPromises();

    const nextButton = Array.from(container.querySelectorAll('.ss-pagination .ss-search-control'))
      .find((button) => button.textContent?.trim() === 'Next');
    expect(nextButton).toBeTruthy();

    nextButton?.focus();
    nextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    const activePaginationButton = document.activeElement;
    expect(activePaginationButton?.textContent?.trim()).toBe('Next');
    expect(activePaginationButton?.closest('.ss-pagination')).not.toBeNull();

    ScriptStore.destroy();
  });

  it('store falls back to the search input when a results rerender becomes empty', async () => {
    const ScriptStore = createScriptStore();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const pageOne = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      name: `Page One ${index + 1}`,
      users: [{ name: 'Nia' }],
      description: 'First page result',
      version: '1.0.0',
      total_installs: 100 - index,
      daily_installs: 5,
      code_updated_at: '2026-04-01T12:00:00Z',
      code_url: `https://example.com/one-${index + 1}.user.js`,
      url: `https://greasyfork.org/en/scripts/${index + 1}-page-one`,
    }));

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => pageOne })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    ScriptStore.init(container, {
      getInstalledScripts: async () => [],
    });
    await flushPromises();

    const nextButton = Array.from(container.querySelectorAll('.ss-pagination .ss-search-control'))
      .find((button) => button.textContent?.trim() === 'Next');
    const searchInput = container.querySelector('.ss-search-input');

    expect(nextButton).toBeTruthy();
    expect(searchInput).toBeTruthy();

    nextButton?.focus();
    nextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(document.activeElement).toBe(searchInput);
    expect(container.querySelector('.ss-empty')?.textContent).toContain('No scripts matched');

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
