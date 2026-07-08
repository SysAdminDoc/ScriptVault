import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const profilesCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-profiles.js'), 'utf8');
const chainsCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-chains.js'), 'utf8');
const standaloneCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-standalone.js'), 'utf8');
const gistCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-gist.js'), 'utf8');

function _invoke(body, params, args, filename) {
  try { const vm = require('node:vm'); return vm.compileFunction(body, params, { filename })(...args); } catch { return new Function(...params, body)(...args); }
}

function createProfileManager() {
  return _invoke(profilesCode + '\nreturn ProfileManager;', [], [], resolve(process.cwd(), 'pages/dashboard-profiles.js'));
}

function createScriptChains() {
  return _invoke(chainsCode + '\nreturn ScriptChains;', [], [], resolve(process.cwd(), 'pages/dashboard-chains.js'));
}

function createStandaloneExport() {
  return _invoke(standaloneCode + '\nreturn StandaloneExport;', [], [], resolve(process.cwd(), 'pages/dashboard-standalone.js'));
}

function createGistIntegration() {
  return _invoke(gistCode + '\nreturn GistIntegration;', [], [], resolve(process.cwd(), 'pages/dashboard-gist.js'));
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
      // Chain steps run via the real `runScriptNow` background action.
      if (typeof callback === 'function' && message.action === 'runScriptNow') {
        executeDeferred.promise.then((response) => callback(response));
        return undefined;
      }
      // Step dropdowns load the script list via the `getScripts` action.
      if (message.action === 'getScripts') {
        return Promise.resolve({ scripts: [{ id: 'alpha', meta: { name: 'Alpha Script' } }] });
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

  it('chains preserve unsaved step edits across pipeline rebuilds', async () => {
    const ScriptChains = createScriptChains();
    const container = document.createElement('div');
    document.body.appendChild(container);

    chrome.runtime.sendMessage = vi.fn((message) => {
      if (message.action === 'getScripts') {
        return Promise.resolve({
          scripts: [
            { id: 'alpha', meta: { name: 'Alpha Script' } },
            { id: 'beta', meta: { name: 'Beta Script' } },
          ],
        });
      }
      return Promise.resolve({});
    });

    await ScriptChains.init(container);
    const chainId = await ScriptChains.createChain('Editable', [
      { scriptId: 'alpha', delay: 10 },
      { scriptId: 'beta', delay: 20 },
    ]);

    const editButton = Array.from(container.querySelectorAll(`[data-chain-id="${chainId}"] .sv-chains-btn`))
      .find((button) => button.textContent === 'Edit');
    editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const controls = () => ({
      rows: Array.from(document.querySelectorAll('.sv-chain-step')),
      scripts: Array.from(document.querySelectorAll('.step-script-select')),
      delays: Array.from(document.querySelectorAll('.step-delay-input')),
      removes: Array.from(document.querySelectorAll('.step-remove')),
    });
    const setSelect = (select, value) => {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const setDelay = (input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    let view = controls();
    setSelect(view.scripts[0], 'beta');
    setDelay(view.delays[0], '777');

    document.querySelector('#sv-chain-add-step')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    view = controls();
    expect(view.scripts[0].value).toBe('beta');
    expect(view.delays[0].value).toBe('777');

    setSelect(view.scripts[2], 'alpha');
    setDelay(view.delays[2], '333');
    view.removes[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    view = controls();
    expect(view.scripts.map((select) => select.value)).toEqual(['beta', 'alpha']);
    expect(view.delays.map((input) => input.value)).toEqual(['777', '333']);

    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() };
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
    view.rows[0].dispatchEvent(dragStart);
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
    view.rows[1].dispatchEvent(drop);

    view = controls();
    expect(view.scripts.map((select) => select.value)).toEqual(['alpha', 'beta']);
    expect(view.delays.map((input) => input.value)).toEqual(['333', '777']);

    document.querySelector('#sv-chain-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(ScriptChains.getChains()[chainId].steps.map((step) => ({
      scriptId: step.scriptId,
      delay: step.delay,
    }))).toEqual([
      { scriptId: 'alpha', delay: 333 },
      { scriptId: 'beta', delay: 777 },
    ]);

    ScriptChains.destroy();
  });

  it('Gist imports fetch raw content when GitHub truncates a user script file', async () => {
    const GistIntegration = createGistIntegration();
    const gistId = '1234567890abcdef1234';
    const rawUrl = 'https://gist.githubusercontent.com/raw/full.user.js';
    const fullScript = [
      '// ==UserScript==',
      '// @name Full Gist Script',
      '// ==/UserScript==',
      'console.log("full");',
    ].join('\n');

    globalThis.fetch = vi.fn(async (url) => {
      if (url === `https://api.github.com/gists/${gistId}`) {
        return {
          ok: true,
          json: async () => ({
            id: gistId,
            html_url: `https://gist.github.com/user/${gistId}`,
            owner: { login: 'user' },
            files: {
              'full.user.js': {
                content: '// ==UserScript==\n// @name Truncated\n// ==/UserScript==\n',
                truncated: true,
                raw_url: rawUrl,
              },
            },
          }),
        };
      }
      if (url === rawUrl) {
        return { ok: true, text: async () => fullScript };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const scripts = await GistIntegration.importFromGist(gistId);

    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({
      filename: 'full.user.js',
      code: fullScript,
      meta: { name: 'Full Gist Script' },
      gistId,
      owner: 'user',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(rawUrl, expect.objectContaining({
      headers: expect.objectContaining({ Accept: expect.stringContaining('text/plain') }),
    }));
  });

  it('Gist sync-from fetches raw content for truncated linked files', async () => {
    const GistIntegration = createGistIntegration();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const gistId = 'abcdef1234567890abcd';
    const rawUrl = 'https://gist.githubusercontent.com/raw/synced.user.js';
    const fullScript = [
      '// ==UserScript==',
      '// @name Synced Full Script',
      '// ==/UserScript==',
      'console.log("synced");',
    ].join('\n');

    await chrome.storage.local.set({ gist_pat: 'test-token' });
    globalThis.fetch = vi.fn(async (url) => {
      if (url === `https://api.github.com/gists/${gistId}`) {
        return {
          ok: true,
          json: async () => ({
            id: gistId,
            html_url: `https://gist.github.com/user/${gistId}`,
            updated_at: '2026-07-08T00:00:00Z',
            files: {
              'synced.user.js': {
                content: '// ==UserScript==\n// @name Cut Off\n// ==/UserScript==\n',
                truncated: true,
                raw_url: rawUrl,
              },
            },
          }),
        };
      }
      if (url === rawUrl) {
        return { ok: true, text: async () => fullScript };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await GistIntegration.init(container, {
      getScript: (scriptId) => scriptId === 'script_synced'
        ? { id: scriptId, settings: { gistId } }
        : null,
    });

    const result = await GistIntegration.syncFromGist('script_synced');

    expect(result).toMatchObject({
      code: fullScript,
      filename: 'synced.user.js',
      updatedAt: '2026-07-08T00:00:00Z',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(rawUrl, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));

    GistIntegration.destroy();
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
    // The fake (non-scannable) QR was replaced with a real copy-link share.
    expect(installHtml).toContain('data-action="copy-link"');
    expect(installHtml).not.toContain('generateQR');
    expect(installHtml).not.toContain('qrCanvas');

    StandaloneExport.destroy();
  });
});
