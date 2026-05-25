import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

/**
 * Install-time optional-permission gating.
 *
 * manifest.json declares `cookies`, `clipboardWrite`, `clipboardRead`, and
 * `identity` as optional permissions. Until this batch, the install page
 * never called `chrome.permissions.request()` for grants that need a
 * Chrome optional permission, so a script with `@grant GM_cookie` would
 * install fine then silently fail every cookie call afterwards. The new
 * helpers in `pages/install.js` map grants → permission tokens and
 * request the prompt inside the install button's user-gesture window.
 *
 * pages/install.js runs as a top-level module-less script and assumes a
 * full DOM; we exercise the pure helpers by extracting them from source
 * via a Function constructor so the test stays isolated from the rest of
 * the install-page bootstrapping.
 */

const installSource = readFileSync(resolve(repoRoot, 'pages/install.js'), 'utf8');

function extractHelpers() {
  // Compile a tiny harness that exposes just the two pure helpers we test.
  // They have no DOM dependencies and only touch chrome.permissions.
  const harness = `
    ${extractBlock('OPTIONAL_GRANT_PERMISSION_MAP', installSource)}
    ${extractBlock('function getRequiredOptionalPermissions', installSource)}
    ${extractBlock('async function ensureOptionalPermissions', installSource)}
    return { getRequiredOptionalPermissions, ensureOptionalPermissions };
  `;
  const fn = new Function('chrome', harness);
  return fn;
}

function extractBlock(needle, src) {
  // Find the named declaration and consume balanced braces up to the matching
  // closing brace. Keeps the test self-contained without importing the whole
  // install page DOM bootstrap.
  const start = src.indexOf(needle);
  if (start === -1) throw new Error(`extractBlock: ${needle} not found`);
  const headEnd = src.indexOf('{', start);
  if (headEnd === -1) {
    // Const map assignment with no braces — fall back to up-to-semicolon.
    const semi = src.indexOf(';', start);
    return src.slice(start - 6, semi + 1); // include leading `const ` (6 chars)
  }
  let depth = 1;
  for (let i = headEnd + 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        // Return the declaration prefixed with whatever keyword was already
        // captured by the needle (function / async function / const).
        return src.slice(start, i + 1);
      }
    }
  }
  throw new Error(`extractBlock: unbalanced braces for ${needle}`);
}

describe('install-page optional permission helpers', () => {
  let factory;
  beforeEach(() => {
    factory = extractHelpers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    chrome.permissions.contains.mockReset();
    chrome.permissions.request.mockReset();
  });

  it('maps GM_cookie to the cookies permission', () => {
    const { getRequiredOptionalPermissions } = factory(globalThis.chrome);
    expect(getRequiredOptionalPermissions({ grant: ['GM_cookie'] })).toEqual(['cookies']);
  });

  it('maps GM.cookie (promise variant) to cookies as well', () => {
    const { getRequiredOptionalPermissions } = factory(globalThis.chrome);
    expect(getRequiredOptionalPermissions({ grant: ['GM.cookie'] })).toEqual(['cookies']);
  });

  it('deduplicates when both GM_cookie and GM.cookie are declared', () => {
    const { getRequiredOptionalPermissions } = factory(globalThis.chrome);
    expect(getRequiredOptionalPermissions({ grant: ['GM_cookie', 'GM.cookie'] })).toEqual(['cookies']);
  });

  it('maps GM_setClipboard to clipboardWrite', () => {
    const { getRequiredOptionalPermissions } = factory(globalThis.chrome);
    expect(getRequiredOptionalPermissions({ grant: ['GM_setClipboard'] })).toEqual(['clipboardWrite']);
  });

  it('returns an empty array when no grants need optional permissions', () => {
    const { getRequiredOptionalPermissions } = factory(globalThis.chrome);
    expect(getRequiredOptionalPermissions({ grant: ['GM_xmlhttpRequest', 'GM_setValue', 'none'] })).toEqual([]);
  });

  it('returns an empty array for null / missing grant fields', () => {
    const { getRequiredOptionalPermissions } = factory(globalThis.chrome);
    expect(getRequiredOptionalPermissions({})).toEqual([]);
    expect(getRequiredOptionalPermissions(null)).toEqual([]);
  });

  it('skips chrome.permissions.request for tokens the user already granted', async () => {
    chrome.permissions.contains.mockImplementation(({ permissions }) => Promise.resolve(permissions[0] === 'cookies'));
    chrome.permissions.request.mockResolvedValue(true);
    const { ensureOptionalPermissions } = factory(globalThis.chrome);
    const result = await ensureOptionalPermissions(['cookies', 'clipboardWrite']);
    expect(result.granted).toEqual(['cookies', 'clipboardWrite']);
    expect(result.denied).toEqual([]);
    // cookies was already granted, so .request only fires once for clipboardWrite.
    expect(chrome.permissions.request).toHaveBeenCalledTimes(1);
    expect(chrome.permissions.request).toHaveBeenCalledWith({ permissions: ['clipboardWrite'] });
  });

  it('records denied tokens when the user dismisses the prompt', async () => {
    chrome.permissions.contains.mockResolvedValue(false);
    chrome.permissions.request.mockResolvedValue(false);
    const { ensureOptionalPermissions } = factory(globalThis.chrome);
    const result = await ensureOptionalPermissions(['cookies']);
    expect(result.granted).toEqual([]);
    expect(result.denied).toEqual(['cookies']);
  });

  it('returns an empty result for an empty token list and never touches chrome.permissions', async () => {
    const { ensureOptionalPermissions } = factory(globalThis.chrome);
    const result = await ensureOptionalPermissions([]);
    expect(result).toEqual({ requested: [], granted: [], denied: [], unavailable: [] });
    expect(chrome.permissions.contains).not.toHaveBeenCalled();
    expect(chrome.permissions.request).not.toHaveBeenCalled();
  });

  it('treats contains() failures as not-granted and still attempts the prompt', async () => {
    chrome.permissions.contains.mockRejectedValue(new Error('lookup failed'));
    chrome.permissions.request.mockResolvedValue(true);
    const { ensureOptionalPermissions } = factory(globalThis.chrome);
    const result = await ensureOptionalPermissions(['cookies']);
    expect(result.granted).toEqual(['cookies']);
    expect(chrome.permissions.request).toHaveBeenCalledOnce();
  });
});

describe('handleInstall threads optionalPermissions through saveScript', () => {
  it('install.js call to saveScript includes the optionalPermissions result in data.trust', () => {
    // Source-level pin so a future refactor that drops the field from the
    // saveScript message round-trips a CI failure instead of a silent regression.
    expect(installSource).toMatch(/optionalPermissions:\s*optionalPermissionsResult/);
    expect(installSource).toMatch(/await ensureOptionalPermissions\(optionalPermissionTokens\)/);
    expect(installSource).toMatch(/getRequiredOptionalPermissions\(scriptMeta\)/);
  });
});
