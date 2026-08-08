// Applying a profile toggles script enabled-states through the background. Two
// things used to go wrong: the Scripts table was never reloaded, so its row
// toggles kept showing the pre-switch state, and every failure was swallowed —
// a switch against an unreachable background still marked the profile active.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const profilesCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-profiles.js'), 'utf8');

function createProfileManager() {
  // new Function, not vm.compileFunction: the module reads jsdom's `window` at
  // load time and a fresh vm context has none.
  return new Function(`${profilesCode}\nreturn ProfileManager;`)();
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
}

function makeContainer() {
  const container = document.createElement('div');
  const anchor = document.createElement('div');
  anchor.className = 'sv-profile-header-anchor';
  container.appendChild(anchor);
  document.body.appendChild(container);
  return container;
}

let refreshCalls;
let toasts;

beforeEach(() => {
  globalThis.__resetStorageMock?.();
  document.body.innerHTML = '';
  refreshCalls = 0;
  toasts = [];
  window.ScriptVaultDashboardUI = {
    refreshScripts: vi.fn(async () => { refreshCalls += 1; }),
    toast: vi.fn((message, tone) => toasts.push({ message, tone })),
    safeSetHtml: (el, html) => { el.innerHTML = html; },
  };
});

afterEach(() => {
  delete window.ScriptVaultDashboardUI;
  vi.restoreAllMocks();
});

function stubBackground({ toggleResponse = () => ({}), scripts } = {}) {
  const calls = [];
  chrome.runtime.sendMessage = vi.fn(async (message) => {
    calls.push(message);
    if (message.action === 'getScripts') {
      if (scripts === null) throw new Error('background unreachable');
      return { scripts: scripts ?? [{ id: 'alpha', enabled: true, meta: { name: 'Alpha Script' } }] };
    }
    if (message.action === 'toggleScript') return toggleResponse(message);
    return {};
  });
  return calls;
}

describe('profile apply refreshes the Scripts table', () => {
  it('reloads the table after toggling scripts', async () => {
    stubBackground();
    const ProfileManager = createProfileManager();
    const container = makeContainer();
    ProfileManager.init(container);
    await flushPromises();

    const profile = await ProfileManager.createProfile('Work', { scriptStates: { alpha: false } });
    await flushPromises();

    const result = await ProfileManager.switchProfile(profile.id);
    expect(result).toMatchObject({ success: true });
    expect(refreshCalls).toBe(1);
    ProfileManager.destroy();
  });

  it('does not reload when no toggle was needed', async () => {
    stubBackground();
    const ProfileManager = createProfileManager();
    const container = makeContainer();
    ProfileManager.init(container);
    await flushPromises();

    // alpha is already enabled and the profile wants it enabled.
    const profile = await ProfileManager.createProfile('Same', { scriptStates: { alpha: true } });
    await flushPromises();

    await ProfileManager.switchProfile(profile.id);
    expect(refreshCalls).toBe(0);
    ProfileManager.destroy();
  });

  it('survives a dashboard with no refresh hook', async () => {
    stubBackground();
    delete window.ScriptVaultDashboardUI.refreshScripts;
    const ProfileManager = createProfileManager();
    const container = makeContainer();
    ProfileManager.init(container);
    await flushPromises();
    const profile = await ProfileManager.createProfile('Work', { scriptStates: { alpha: false } });
    await flushPromises();
    await expect(ProfileManager.switchProfile(profile.id)).resolves.toMatchObject({ success: true });
    ProfileManager.destroy();
  });
});

describe('profile apply reports failures instead of claiming success', () => {
  it('fails the switch when a toggle rejects, and does not mark the profile active', async () => {
    stubBackground({ toggleResponse: () => { throw new Error('service worker asleep'); } });
    const ProfileManager = createProfileManager();
    const container = makeContainer();
    ProfileManager.init(container);
    await flushPromises();

    const before = await ProfileManager.getActiveProfile();
    const profile = await ProfileManager.createProfile('Work', { scriptStates: { alpha: false } });
    await flushPromises();

    const result = await ProfileManager.switchProfile(profile.id);
    expect(result.error).toBeTruthy();
    expect(result.success).toBeUndefined();
    expect(toasts.some((t) => t.tone === 'error')).toBe(true);
    expect(toasts.map((t) => t.message).join(' ')).toContain('service worker asleep');

    const after = await ProfileManager.getActiveProfile();
    expect(after?.id).toBe(before?.id);
    expect(after?.id).not.toBe(profile.id);
    ProfileManager.destroy();
  });

  it('fails the switch when a toggle returns an {error} response', async () => {
    stubBackground({ toggleResponse: () => ({ error: 'Script not found' }) });
    const ProfileManager = createProfileManager();
    const container = makeContainer();
    ProfileManager.init(container);
    await flushPromises();

    const profile = await ProfileManager.createProfile('Work', { scriptStates: { alpha: false } });
    await flushPromises();

    const result = await ProfileManager.switchProfile(profile.id);
    expect(result.error).toBeTruthy();
    expect(toasts.map((t) => t.message).join(' ')).toContain('Script not found');
    ProfileManager.destroy();
  });

  it('fails the switch when the script list itself cannot be read', async () => {
    stubBackground({ scripts: null });
    const ProfileManager = createProfileManager();
    const container = makeContainer();
    ProfileManager.init(container);
    await flushPromises();

    // createProfile snapshots states; force a state that would need a toggle.
    const profile = await ProfileManager.createProfile('Work', { scriptStates: { alpha: false } });
    await flushPromises();

    const result = await ProfileManager.switchProfile(profile.id);
    expect(result.error).toBeTruthy();
    // An unreadable list is not "no scripts to toggle" — it must be reported.
    expect(toasts.some((t) => t.tone === 'error')).toBe(true);
    ProfileManager.destroy();
  });

  it('reports a count rather than a name when several scripts fail', async () => {
    stubBackground({
      toggleResponse: () => ({ error: 'nope' }),
      scripts: [
        { id: 'alpha', enabled: true, meta: { name: 'Alpha' } },
        { id: 'beta', enabled: true, meta: { name: 'Beta' } },
      ],
    });
    const ProfileManager = createProfileManager();
    const container = makeContainer();
    ProfileManager.init(container);
    await flushPromises();

    const profile = await ProfileManager.createProfile('Work', { scriptStates: { alpha: false, beta: false } });
    await flushPromises();

    await ProfileManager.switchProfile(profile.id);
    expect(toasts.map((t) => t.message).join(' ')).toContain('2 scripts failed');
    ProfileManager.destroy();
  });
});
