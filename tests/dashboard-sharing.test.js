import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sharingCode = readFileSync(resolve(process.cwd(), 'pages/dashboard-sharing.js'), 'utf8');

function loadSharing() {
  const body = `${sharingCode}\nreturn ScriptSharing;`;
  try {
    const vm = require('node:vm');
    return vm.compileFunction(body, [], { filename: resolve(process.cwd(), 'pages/dashboard-sharing.js') })();
  } catch {
    return new Function(body)();
  }
}

function scriptCode(name, body = '') {
  return `// ==UserScript==
// @name ${name}
// @version 1.0.0
// @description Demo script
// @match *://example.com/*
// ==/UserScript==
${body}`;
}

async function zipEntryNames(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dec = new TextDecoder();
  const names = [];
  for (let i = 0; i < bytes.length - 46; i += 1) {
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b || bytes[i + 2] !== 0x01 || bytes[i + 3] !== 0x02) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset + i);
    const nameLen = view.getUint16(28, true);
    const extraLen = view.getUint16(30, true);
    const commentLen = view.getUint16(32, true);
    names.push(dec.decode(bytes.slice(i + 46, i + 46 + nameLen)));
    i += 45 + nameLen + extraLen + commentLen;
  }
  return names;
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe('dashboard sharing', () => {
  let originalCreateObjectUrl;
  let originalRevokeObjectUrl;
  let originalClipboardDescriptor;
  let originalWindowOpen;
  let originalCanvasGetContext;

  beforeEach(() => {
    document.body.innerHTML = '';
    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    originalWindowOpen = window.open;
    originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (originalCreateObjectUrl) {
      URL.createObjectURL = originalCreateObjectUrl;
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }
    if (originalRevokeObjectUrl) {
      URL.revokeObjectURL = originalRevokeObjectUrl;
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    window.open = originalWindowOpen;
    HTMLCanvasElement.prototype.getContext = originalCanvasGetContext;
    vi.restoreAllMocks();
  });

  it('deduplicates batch ZIP filenames after sanitizing script names', async () => {
    const ScriptSharing = loadSharing();
    const scripts = {
      a: { code: scriptCode('Same Name') },
      b: { code: scriptCode('Same?Name') },
    };
    let zipBlob = null;
    URL.createObjectURL = vi.fn(blob => {
      zipBlob = blob;
      return 'blob:scriptvault-zip';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    ScriptSharing.init({ getScript: id => scripts[id] });
    ScriptSharing.batchExport(['a', 'b']);

    expect(zipBlob).toBeInstanceOf(Blob);
    await expect(zipEntryNames(zipBlob)).resolves.toEqual([
      'Same_Name.user.js',
      'Same_Name-2.user.js',
    ]);

    ScriptSharing.destroy();
  });

  it('copies instructions instead of opening oversized mailto share links', async () => {
    const ScriptSharing = loadSharing();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    window.open = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
    }));

    const largeBody = `\nconsole.log('${'x'.repeat(2500)}');`;
    ScriptSharing.init({
      getScript: id => id === 'big'
        ? { code: scriptCode('Big Mailto Script', largeBody) }
        : null,
    });
    ScriptSharing.showShareModal('big');

    document.querySelector('[data-action="share-email"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(window.open).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('Big Mailto Script');
    expect(copied).toContain('too large for a mailto link');
    expect(copied).not.toContain('data:application/javascript');
    expect(document.querySelector('.ss-toast')?.textContent).toContain('Email body was too large');

    ScriptSharing.destroy();
  });
});
