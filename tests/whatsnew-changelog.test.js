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
});
