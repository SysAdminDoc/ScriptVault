import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const backgroundCore = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const backgroundJs = readFileSync(resolve(ROOT, 'background.js'), 'utf8');
const registrationTs = readFileSync(resolve(ROOT, 'src/background/registration.ts'), 'utf8');
const firefoxSmoke = readFileSync(resolve(ROOT, 'scripts/smoke-firefox-sideload.mjs'), 'utf8');

function extractFn(src, name) {
  const marker = `function ${name}(`;
  const at = src.indexOf(marker);
  if (at === -1) throw new Error(`${name} not found`);
  // Keep a preceding `async`: slicing from `function` would strip it, turning an
  // async helper into a sync one whose awaits are a syntax error (or, worse, one
  // that returns a raw value where the caller expects a promise).
  const start = src.slice(Math.max(0, at - 6), at) === 'async ' ? at - 6 : at;
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

/** Pull a single-line `const NAME = ...;` declaration out of a generated file. */
function extractDecl(src, name) {
  const marker = `const ${name} = `;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`${name} declaration not found`);
  const end = src.indexOf('\n', start);
  return src.slice(start, end === -1 ? undefined : end);
}

/**
 * Build the real async capability probe against a fake userScripts API.
 *
 * `honour` models what the engine does with the worldId property:
 *   'accept'  — configureWorld resolves and the world reads back (Firefox 153+)
 *   'ignore'  — configureWorld resolves but the world is NOT there (the case
 *               the old symbol check could not see)
 *   'reject'  — configureWorld throws on the unknown property (Firefox <153)
 */
function makeWorldIdProbe(userAgent, { honour = 'accept', getWorldConfigurations = true } = {}) {
  // The probe keeps its state and id in module-level consts, so pull those too:
  // extractFn only handles functions.
  const src = [
    extractDecl(backgroundCore, '_worldIdSupportProbe'),
    extractDecl(backgroundCore, '_WORLD_ID_PROBE_ID'),
    extractFn(backgroundCore, '_getChromeVersion'),
    extractFn(backgroundCore, '_isFirefoxRuntime'),
    extractFn(backgroundCore, '_supportsUserScriptsWorldId'),
    extractFn(backgroundCore, '_ensureUserScriptWorldIdSupport'),
    'return { probe: _ensureUserScriptWorldIdSupport, state: _worldIdSupportProbe, sync: _supportsUserScriptsWorldId };',
  ].join('\n');
  const calls = { configure: 0, read: 0, reset: 0 };
  const configured = [];
  const userScripts = {
    configureWorld: async (config) => {
      calls.configure += 1;
      if (honour === 'reject') throw new Error('Unexpected property worldId');
      if (honour === 'accept') configured.push(config);
    },
    resetWorldConfiguration: async (worldId) => {
      calls.reset += 1;
      const at = configured.findIndex((c) => c.worldId === worldId);
      if (at >= 0) configured.splice(at, 1);
    },
  };
  if (getWorldConfigurations) {
    userScripts.getWorldConfigurations = async () => {
      calls.read += 1;
      return configured.map((c) => ({ worldId: c.worldId }));
    };
  }
  const self = { navigator: { userAgent } };
  const chrome = { userScripts };
  const built = new Function(
    'self', 'chrome', 'debugLog', 'debugWarn',
    src,
  )(self, chrome, () => {}, () => {});
  return { ...built, calls, configured };
}

// Regression: Firefox was excluded from per-script worldId, so every script
// matching a page shared one sandbox and only the first one executed. Verified
// against Firefox 154.0b1 — scripts 2..n were silently dead.
describe('per-script world isolation on Firefox', () => {
  // The sync gate is now only the CHEAP check; a resolved capability probe wins.
  function makeSupportsWorldId(userAgent, { configureWorld = true, probe = null } = {}) {
    const src = [
      extractFn(backgroundCore, '_getChromeVersion'),
      extractFn(backgroundCore, '_isFirefoxRuntime'),
      extractFn(backgroundCore, '_supportsUserScriptsWorldId'),
      'return _supportsUserScriptsWorldId();',
    ].join('\n');
    const self = { navigator: { userAgent } };
    const chrome = { userScripts: configureWorld ? { configureWorld() {} } : {} };
    const probeState = probe || { resolved: false, supported: false, proven: false, promise: null };
    return new Function('self', 'chrome', '_worldIdSupportProbe', src)(self, chrome, probeState);
  }

  const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0';
  const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36';
  const OLD_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';

  it('is optimistic on Firefox with configureWorld present, before the probe runs', () => {
    // Optimistic on purpose: a false negative here would disable isolation that
    // may well work. The probe below is what settles it.
    expect(makeSupportsWorldId(FIREFOX_UA)).toBe(true);
  });

  it('defers to a resolved probe rather than the symbol', () => {
    // configureWorld exists, but the probe proved the engine ignores worldId.
    expect(makeSupportsWorldId(FIREFOX_UA, {
      probe: { resolved: true, supported: false, proven: true, promise: null },
    })).toBe(false);
    expect(makeSupportsWorldId(FIREFOX_UA, {
      probe: { resolved: true, supported: true, proven: true, promise: null },
    })).toBe(true);
  });

  it('falls back to the shared world on Firefox builds without configureWorld', () => {
    expect(makeSupportsWorldId(FIREFOX_UA, { configureWorld: false })).toBe(false);
  });

  it('keeps the Chrome 133+ floor unchanged', () => {
    expect(makeSupportsWorldId(CHROME_UA)).toBe(true);
    expect(makeSupportsWorldId(OLD_CHROME_UA)).toBe(false);
  });

  it('does not reintroduce the Firefox exclusion in runtime or extraction copies', () => {
    const runtimeFn = extractFn(backgroundCore, '_supportsUserScriptsWorldId');
    expect(runtimeFn).not.toMatch(/!\s*_isFirefoxRuntime\(\)\s*&&/);
    expect(backgroundJs).toContain('_supportsUserScriptsWorldId');
    expect(registrationTs).not.toMatch(/return\s+!isFirefoxRuntime\(\)\s*&&\s*getChromeMajorVersion\(\)\s*>=\s*133/);
  });

  it('drops worldId and retries rather than leaving a script unregistered', () => {
    expect(backgroundCore).toMatch(/registration\.worldId\s*&&\s*e\.message\?\.includes\('worldId'\)/);
    expect(registrationTs).toMatch(/registration\.worldId\s*&&\s*errMsg\?\.includes\('worldId'\)/);
  });
});

// The SPA scenario is the real-browser half of the Navigation API contract that
// tests/urlchange-wrapper.test.js can only cover at the jsdom level.
describe('Firefox SPA urlchange smoke contract', () => {
  it('drives routing from the page world so cross-world reach is what is proven', () => {
    expect(firefoxSmoke).toContain('spaUrlChangeSmoke');
    expect(firefoxSmoke).toContain('@grant window.onurlchange');
    expect(firefoxSmoke).toContain("history.pushState({}, '', '/spa-target/alpha')");
    expect(firefoxSmoke).toContain("window.navigation.navigate('/spa-target/beta')");
    expect(firefoxSmoke).toContain("location.hash = 'gamma'");
  });

  it('fails when the Navigation API is unreachable from the userscript world', () => {
    expect(firefoxSmoke).toContain('Navigation API is not reachable from the Firefox userscript world');
  });

  it('serves a router that intercepts so navigate() stays same-document', () => {
    expect(firefoxSmoke).toContain('spaPageServer');
    expect(firefoxSmoke).toContain('event.intercept(');
  });

  it('reports the SPA result in the smoke summary', () => {
    expect(firefoxSmoke).toMatch(/spaUrlChange:\s*spaResult/);
  });

  it('asserts two userscripts execute on the same page', () => {
    expect(firefoxSmoke).toContain('dataset.scriptvaultFirefoxSmoke === \'ok\'');
    expect(firefoxSmoke).toContain('per-script world isolation regressed');
  });
});

// Firefox 154 ships privacy.userContext.enabled defaulted ON, so the pref value
// alone is not evidence that the sideload forced containers on.
describe('Firefox container assertion', () => {
  it('only fails when the container pref carries a user-set value', () => {
    expect(firefoxSmoke).toContain('prefHasUserValue');
    expect(firefoxSmoke).toMatch(/value\?\.enabled\s*&&\s*value\?\.userSet/);
  });
});

describe('on-demand execution world isolation', () => {
  const core = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

  it('configures a per-script world for userScripts.execute paths', () => {
    // registerScript isolates each script by worldId, but runScriptNow, chains,
    // @crontab, and context-menu scripts called execute() with no worldId, so
    // they all shared the single default USER_SCRIPT world. Each wrapped body
    // embeds that script's scriptAuthToken and sends it via the global
    // chrome.runtime.sendMessage, so a script reaching that world first could
    // shadow sendMessage and harvest a co-resident script's identity.
    expect(core).toContain('function ensureExecutionWorldId(scriptId)');
    const helper = core.slice(
      core.indexOf('function ensureExecutionWorldId(scriptId)'),
      core.indexOf('async function executeWrappedScriptInTab'),
    );
    expect(helper).toContain('configureWorld');
    // The id is sanitized before use — Chrome reserves ids starting with `_`,
    // and imported-backup script ids come from the file.
    expect(helper).toContain('_userScriptWorldIdFor(scriptId)');
    expect(helper).toContain('worldId,');
  });

  it('threads the script id through every execute call site', () => {
    expect(core).toContain('await ensureExecutionWorldId(script?.id)');
    expect(core).toContain('const worldId = await ensureExecutionWorldId(scriptId)');
    // Both execute() calls spread the resolved world id.
    const executeCalls = core.split('chrome.userScripts.execute({').slice(1);
    expect(executeCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of executeCalls) {
      const body = call.slice(0, call.indexOf('})'));
      expect(body).toMatch(/worldId/);
    }
  });

  it('calls resetWorldConfiguration with a bare world id, not an options object', () => {
    // The API takes a string. Passing { worldId } threw, and the surrounding
    // catch — meant for engines without the API — swallowed it, so no
    // per-script world was ever released and each uninstall leaked one with a
    // permissive CSP for the life of the profile.
    expect(core).toContain('resetWorldConfiguration(scriptId)');
    expect(core).not.toContain('resetWorldConfiguration as (arg: unknown)');
    expect(core).not.toMatch(/resetWorldConfiguration\(\{\s*worldId/);
  });
});

// The probe replaces `typeof configureWorld === 'function'`. That symbol shipped
// in Firefox BEFORE per-world worldId did, so on 136-152 the old check was true
// and the code depended on the engine throwing. An engine that instead ignores
// the property would leave every script sharing one world — the original bug, on
// the Firefox range most users are on.
describe('the worldId capability probe proves support instead of assuming it', () => {
  const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0';
  const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36';

  it('reports support when the configured world reads back', async () => {
    const { probe, state, calls } = makeWorldIdProbe(FIREFOX_UA, { honour: 'accept' });
    await expect(probe()).resolves.toBe(true);
    expect(state.proven).toBe(true);
    expect(calls.configure).toBe(1);
    expect(calls.read).toBe(1);
  });

  it('reports NO support when the engine accepts worldId and silently drops it', async () => {
    const { probe, state } = makeWorldIdProbe(FIREFOX_UA, { honour: 'ignore' });
    await expect(probe()).resolves.toBe(false);
    // This is the case the symbol check could never detect.
    expect(state.proven).toBe(true);
  });

  it('reports NO support when the engine rejects the unknown property', async () => {
    const { probe, state, calls } = makeWorldIdProbe(FIREFOX_UA, { honour: 'reject' });
    await expect(probe()).resolves.toBe(false);
    expect(state.proven).toBe(true);
    // No point reading back a world that was never accepted.
    expect(calls.read).toBe(0);
  });

  it('stays optimistic but unproven when the engine cannot read worlds back', async () => {
    const { probe, state } = makeWorldIdProbe(FIREFOX_UA, {
      honour: 'accept',
      getWorldConfigurations: false,
    });
    await expect(probe()).resolves.toBe(true);
    expect(state.proven).toBe(false);
  });

  it('cleans up its throwaway probe world', async () => {
    const { probe, calls, configured } = makeWorldIdProbe(FIREFOX_UA, { honour: 'accept' });
    await probe();
    expect(calls.reset).toBe(1);
    expect(configured.map((c) => c.worldId)).not.toContain('sv-worldid-probe');
  });

  it('runs once and caches, even under concurrent callers', async () => {
    const { probe, calls } = makeWorldIdProbe(FIREFOX_UA, { honour: 'accept' });
    const [a, b, c] = await Promise.all([probe(), probe(), probe()]);
    expect([a, b, c]).toEqual([true, true, true]);
    await probe();
    expect(calls.configure).toBe(1);
  });

  it('does not probe on Chrome, where support is version-gated', async () => {
    const { probe, calls } = makeWorldIdProbe(CHROME_UA, { honour: 'accept' });
    await expect(probe()).resolves.toBe(true);
    expect(calls.configure).toBe(0);
  });
});

describe('world ids are sanitized so a reserved id cannot cost isolation', () => {
  function sanitizer(source) {
    const src = `${extractFn(source, '_userScriptWorldIdFor')}\nreturn _userScriptWorldIdFor;`;
    return new Function(src)();
  }

  it('prefixes an id Chrome would reject instead of dropping to the shared world', () => {
    const worldIdFor = sanitizer(backgroundCore);
    // Chrome reserves world ids beginning with `_`, and a restored backup's
    // script ids come straight from the archive.
    expect(worldIdFor('_imported_1')).toBe('sv_imported_1');
    expect(worldIdFor('_')).toBe('sv_');
  });

  it('leaves an ordinary id untouched so existing worlds are stable', () => {
    const worldIdFor = sanitizer(backgroundCore);
    expect(worldIdFor('script_abc')).toBe('script_abc');
    expect(worldIdFor('')).toBe('');
  });

  it('is mirrored in the extraction module', () => {
    expect(registrationTs).toContain('function userScriptWorldIdFor(');
    expect(registrationTs).toContain("id.startsWith('_') ? `sv${id}` : id");
  });
});

describe('losing per-script isolation is recorded, not swallowed', () => {
  it('records a warning when configureWorld refuses the world', () => {
    // The old code was a bare `catch {}`: the script registered into the shared
    // world with no warning, no _registrationError and no log entry.
    const block = backgroundCore.slice(
      backgroundCore.indexOf('let worldConfigured = false;'),
      backgroundCore.indexOf('if (worldConfigured) {'),
    );
    expect(block).toContain('_recordWorldIsolationLoss(script, e)');
    expect(block).not.toMatch(/catch \(e\) \{\s*\}/);
  });

  it('records it on the register() retry that drops worldId too', () => {
    const retry = backgroundCore.slice(
      backgroundCore.indexOf("e.message?.includes('worldId')"),
      backgroundCore.indexOf("e.message?.includes('worldId')") + 700,
    );
    expect(retry).toContain('_recordWorldIsolationLoss(script, e)');
  });

  it('names the consequence in words a user can act on', () => {
    expect(backgroundCore).toContain('shares the default sandbox with other scripts on the page');
  });

  it('writes both a script-visible warning and an error-log entry', () => {
    const fn = extractFn(backgroundCore, '_recordWorldIsolationLoss');
    expect(fn).toContain('_registrationWarning');
    expect(fn).toContain('ErrorLog.log');
    expect(fn).toContain("context: 'world-isolation'");
  });

  it('clears the warning once a world is established', () => {
    expect(backgroundCore).toContain('_clearWorldIsolationLoss(script)');
    const fn = extractFn(backgroundCore, '_clearWorldIsolationLoss');
    expect(fn).toContain('delete script.settings._registrationWarning');
  });

  it('mirrors the recorder in the extraction module', () => {
    expect(registrationTs).toContain('async function recordWorldIsolationLoss(');
    expect(registrationTs).toContain('recordWorldIsolationLoss(script, e)');
    expect(registrationTs).toContain('clearWorldIsolationLoss(script)');
  });
});
