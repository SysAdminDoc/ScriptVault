import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));
const whatsNewSource = readFileSync(resolve(process.cwd(), 'pages/dashboard-whatsnew.js'), 'utf8');

function createWhatsNew({ version = manifest.version, lastSeenVersion = '0.0.0' } = {}) {
  const storageSet = vi.fn().mockResolvedValue();
  const chromeStub = {
    runtime: {
      getManifest: () => ({ version }),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ lastSeenVersion }),
        set: storageSet,
      },
    },
  };
  const _wnBody = `${whatsNewSource}\nreturn WhatsNew;`;
  let WhatsNew;
  try {
    const vm = require('node:vm');
    WhatsNew = vm.compileFunction(_wnBody, ['chrome', 'window', 'document'], { filename: resolve(process.cwd(), 'pages/dashboard-whatsnew.js') })(chromeStub, window, document);
  } catch {
    WhatsNew = new Function('chrome', 'window', 'document', _wnBody)(chromeStub, window, document);
  }
  return { WhatsNew, storageSet };
}

describe('dashboard WhatsNew changelog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('has an exact entry for the packaged manifest version', () => {
    const { WhatsNew } = createWhatsNew();
    const entry = WhatsNew.getEntry(manifest.version);

    expect(entry).toBeTruthy();
    expect(entry.title).toContain(manifest.version);
    expect(entry.highlights.length).toBeGreaterThan(0);
    expect(entry.improvements.length).toBeGreaterThan(0);
  });

  it('shows only when the exact packaged version has a changelog entry', async () => {
    await expect(createWhatsNew().WhatsNew.shouldShow()).resolves.toBe(true);
    await expect(createWhatsNew({ version: '3.11.1' }).WhatsNew.shouldShow()).resolves.toBe(false);
  });

  it('renders the current version entry and records dismissal', async () => {
    const { WhatsNew, storageSet } = createWhatsNew();

    WhatsNew.show();
    const modal = document.querySelector('.sv-wn-modal');
    const dismiss = document.querySelector('#svWnDismiss');

    expect(modal?.textContent).toContain(`ScriptVault ${manifest.version}`);
    // Assert the first highlight of the current entry rather than a fixed
    // string so the test survives version bumps.
    const currentEntry = WhatsNew.getEntry(manifest.version);
    expect(modal?.textContent).toContain(currentEntry.highlights[0].title);

    dismiss.click();
    expect(storageSet).toHaveBeenCalledWith({ lastSeenVersion: manifest.version });
    expect(document.querySelector('.sv-wn-overlay')).toBeNull();
  });

  // show() runs from an async storage read, so the modal can open after focus
  // has already moved into the page. Removing the overlay without handing focus
  // back drops document.activeElement to <body>, losing the keyboard position
  // the user (or a driving harness) had established.
  it('returns focus to whatever held it before the modal opened', () => {
    const anchor = document.createElement('button');
    anchor.id = 'preModalFocus';
    document.body.appendChild(anchor);
    anchor.focus();
    expect(document.activeElement).toBe(anchor);

    const { WhatsNew } = createWhatsNew();
    WhatsNew.show();
    expect(document.activeElement?.id).toBe('svWnDismiss');

    document.querySelector('#svWnDismiss').click();
    expect(document.querySelector('.sv-wn-overlay')).toBeNull();
    expect(document.activeElement).toBe(anchor);
  });

  it('falls back to the workbench rail when the pre-modal element is gone', () => {
    const doomed = document.createElement('button');
    document.body.appendChild(doomed);
    doomed.focus();

    const rail = document.createElement('div');
    rail.className = 'workbench-rail';
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'true');
    tab.id = 'railScripts';
    rail.appendChild(tab);
    document.body.appendChild(rail);

    const { WhatsNew } = createWhatsNew();
    WhatsNew.show();
    doomed.remove();

    document.querySelector('#svWnDismiss').click();
    expect(document.activeElement).toBe(tab);
  });
});
