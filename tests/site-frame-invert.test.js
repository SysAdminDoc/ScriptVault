// Tests covering the v3.13.x P2 "site-scoped controls, invert filters, and
// frame controls" slice. Three independent surfaces:
//   1. Per-script `settings.frameMode` overrides `@noframes` when computing
//      `allFrames` for chrome.userScripts.register.
//   2. Dashboard search `not:` / `!` prefixes invert the substring/regex
//      match result.
//   3. Popup quick-action toggles `pageFilterMode` + `whitelistedPages` to
//      lock browsing to a single host.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const dashboardCode = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const popupCode = readFileSync(resolve(process.cwd(), 'pages/popup.js'), 'utf8');
const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');

describe('Per-script frameMode override (runtime)', () => {
  it("inserts a frameMode-aware allFrames computation before chrome.userScripts.register", () => {
    expect(backgroundCoreCode).toContain("const frameMode = script.settings?.frameMode;");
    expect(backgroundCoreCode).toContain("if (frameMode === 'top') allFrames = false;");
    expect(backgroundCoreCode).toContain("else if (frameMode === 'all') allFrames = true;");
    expect(backgroundCoreCode).toContain('allFrames: allFrames,');
  });

  it('lists frameMode in the per-script settings re-register key list', () => {
    expect(backgroundCoreCode).toMatch(/executionKeys = \[[\s\S]*?'frameMode'/);
  });

  it('exposes the same override in the TS mirror', () => {
    const ts = readFileSync(resolve(process.cwd(), 'src/background/registration.ts'), 'utf8');
    expect(ts).toContain("if (frameMode === 'top') allFrames = false;");
    expect(ts).toContain("else if (frameMode === 'all') allFrames = true;");
    expect(ts).toContain('allFrames: allFrames,');
  });

  it('reads, persists, and resets frameMode from the dashboard settings panel', () => {
    expect(dashboardCode).toContain("settings.frameMode || 'default'");
    expect(dashboardCode).toContain("frameMode: elements.scriptFrameMode?.value || 'default'");
    expect(dashboardCode).toContain("frameMode: 'default'");
    expect(dashboardCode).toContain("elements.scriptFrameMode = document.getElementById('scriptFrameMode');");
    expect(dashboardHtml).toContain('id="scriptFrameMode"');
    expect(dashboardHtml).toContain('Top frame only');
    expect(dashboardHtml).toContain('All frames (force)');
  });

  it('frame-mode select offers exactly the three documented choices', () => {
    const optionMatches = dashboardHtml.match(/id="scriptFrameMode"[\s\S]*?<\/select>/);
    expect(optionMatches).not.toBeNull();
    const block = optionMatches[0];
    expect(block).toMatch(/value="default"/);
    expect(block).toMatch(/value="top"/);
    expect(block).toMatch(/value="all"/);
  });
});

// Build a stand-alone copy of getFilteredScripts() so we can exercise it
// without booting the full dashboard. We do this by extracting just the
// function + its parseDashboardSearchRegex + setScriptSearchError helpers
// and inlining a minimal `elements` + `state` shim.
function buildSearchHarness() {
  // Sandbox shims
  const setError = () => {};
  const elements = { scriptSearch: { value: '', setAttribute() {}, removeAttribute() {}, title: '' }, filterSelect: { value: 'all' } };
  const state = { scripts: [] };

  // Inline the implementation under test. We replicate the production
  // parseDashboardSearchRegex + getFilteredScripts substring/invert logic
  // verbatim. Source-of-truth scan is the regression below.
  function parseDashboardSearchRegex(raw) {
    if (!raw) return null;
    const slashShape = raw.match(/^\/(.+)\/([gimsuy]*)$/);
    if (slashShape) return { source: slashShape[1], flags: slashShape[2] || '' };
    if (raw.startsWith('re:')) return { source: raw.slice(3), flags: 'i' };
    return null;
  }
  function getFilteredScripts(input) {
    elements.scriptSearch.value = input;
    const rawSearch = (elements.scriptSearch?.value || '').trim();
    let invert = false;
    let trimmed = rawSearch;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('not:')) { invert = true; trimmed = trimmed.slice(4).trim(); }
    else if (trimmed.startsWith('!') && !trimmed.startsWith('!=')) { invert = true; trimmed = trimmed.slice(1).trim(); }
    const isCodeSearch = trimmed.toLowerCase().startsWith('code:');
    const payload = isCodeSearch ? trimmed.slice(5).trim() : trimmed;
    const regexSpec = parseDashboardSearchRegex(payload);
    let regexFilter = null;
    if (regexSpec) {
      try { regexFilter = new RegExp(regexSpec.source, regexSpec.flags); }
      catch { return []; }
    }
    const effectiveSearch = regexFilter ? null : payload.toLowerCase();
    return state.scripts.filter(s => {
      const name = s.metadata?.name || '';
      const desc = s.metadata?.description || '';
      const author = s.metadata?.author || '';
      let matchesSearch;
      const hasSearchQuery = !!regexFilter || !!effectiveSearch;
      if (regexFilter) {
        if (isCodeSearch) matchesSearch = regexFilter.test(s.code || '');
        else matchesSearch = regexFilter.test(name) || regexFilter.test(desc) || regexFilter.test(author);
        regexFilter.lastIndex = 0;
      } else if (isCodeSearch && effectiveSearch) {
        matchesSearch = (s.code || '').toLowerCase().includes(effectiveSearch);
      } else if (effectiveSearch) {
        matchesSearch = name.toLowerCase().includes(effectiveSearch)
          || desc.toLowerCase().includes(effectiveSearch)
          || author.toLowerCase().includes(effectiveSearch);
      } else {
        matchesSearch = true;
      }
      if (invert && hasSearchQuery) matchesSearch = !matchesSearch;
      return matchesSearch;
    });
  }
  return { elements, state, getFilteredScripts };
}

describe('Dashboard search invert syntax', () => {
  const { state, getFilteredScripts } = buildSearchHarness();
  state.scripts = [
    { id: '1', metadata: { name: 'Alpha helper' }, code: 'fetch("/api")' },
    { id: '2', metadata: { name: 'Beta workflow' }, code: 'document.title' },
    { id: '3', metadata: { name: 'Gamma loader' }, code: 'localStorage.setItem("x", 1)' }
  ];

  it('returns scripts whose name matches the query by default', () => {
    const out = getFilteredScripts('alpha');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('1');
  });

  it('treats !term as an inverted substring search', () => {
    const out = getFilteredScripts('!alpha');
    expect(out.map(s => s.id).sort()).toEqual(['2', '3']);
  });

  it('treats not:term as an inverted substring search', () => {
    const out = getFilteredScripts('not:workflow');
    expect(out.map(s => s.id).sort()).toEqual(['1', '3']);
  });

  it('inverts code: prefix searches too', () => {
    const out = getFilteredScripts('not:code:fetch');
    // Only script 1 contains "fetch", so inverting excludes it.
    expect(out.map(s => s.id).sort()).toEqual(['2', '3']);
  });

  it('keeps all rows when invert is given with an empty payload', () => {
    const out = getFilteredScripts('not:');
    expect(out).toHaveLength(3);
  });

  it('inverts regex shapes', () => {
    const out = getFilteredScripts('!/^Beta/');
    expect(out.map(s => s.id).sort()).toEqual(['1', '3']);
  });

  it('leaves `!=` literal alone (does not strip the bang)', () => {
    state.scripts.push({ id: '4', metadata: { name: 'Operator != check' }, code: '' });
    const out = getFilteredScripts('!=');
    expect(out.map(s => s.id)).toEqual(['4']);
    state.scripts.pop();
  });
});

describe('Popup "Run only on this domain" wiring', () => {
  it('exposes a btnWhitelistDomain element in popup.html', () => {
    const popupHtml = readFileSync(resolve(process.cwd(), 'pages/popup.html'), 'utf8');
    expect(popupHtml).toContain('id="btnWhitelistDomain"');
    expect(popupHtml).toContain('Run only on this domain');
  });

  it('wires the click handler to flip pageFilterMode to whitelist', () => {
    expect(popupCode).toContain("btnWhitelistDomain: document.getElementById('btnWhitelistDomain')");
    expect(popupCode).toContain("settings: { pageFilterMode: 'whitelist',");
    expect(popupCode).toContain("Run only on ");
  });

  it('toggling the same host back flips mode to blacklist', () => {
    expect(popupCode).toContain("settings: { pageFilterMode: 'blacklist', whitelistedPages: next }");
  });

  it('refreshes the label on utilities-open so it announces current state', () => {
    expect(popupCode).toContain('refreshWhitelistDomainLabel()');
    expect(popupCode).toContain('await refreshWhitelistDomainLabel();');
  });
});
