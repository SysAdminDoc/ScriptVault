// Functional coverage for the privileged-side @grant gate: the real
// checkGmActionGrant extracted from the SHIPPED background.core.js bridge,
// driven the way a script bypassing the injected wrapper would drive it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

import { GMGrantPolicy } from '../src/background/gm-grant-policy.ts';

const ROOT = process.cwd();
const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');

/** Pull checkGmActionGrant out of the bridge by brace matching. */
function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`not found in background.core.js: ${signature}`);
  let depth = 0;
  let index = source.indexOf('{', start);
  const bodyStart = index;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces from ${bodyStart}`);
}

function createGate(scripts) {
  const warnings = [];
  const ScriptStorage = {
    async get(id) {
      const entry = scripts.get(id);
      if (entry instanceof Error) throw entry;
      return entry ?? null;
    },
  };
  const body = `${extractFunction(core, 'async function checkGmActionGrant(')}
return checkGmActionGrant;`;
  const fn = compileFunction(body, ['ScriptStorage', 'GMGrantPolicy', 'debugWarn'], {
    filename: resolve(ROOT, 'background.core.js'),
  })(ScriptStorage, GMGrantPolicy, (...args) => warnings.push(args.join(' ')));
  return { checkGmActionGrant: fn, warnings };
}

const scripts = new Map();
let gate;

beforeEach(() => {
  scripts.clear();
  gate = createGate(scripts);
});

function script(grants) {
  return { id: 'script_1', meta: { name: 'Bypasser', grant: grants } };
}

const SENDER = { userScriptId: 'script_1' };

describe('privileged @grant enforcement', () => {
  // The wrapper's hasGrant() runs in the same world as the untrusted body with
  // `chrome` unshadowed, so a script can skip it entirely. These are the actions
  // a `@grant none` script could previously drive from the background.
  it.each([
    'GM_setValue',
    'GM_getValue',
    'GM_deleteValue',
    'GM_listValues',
    'GM_cookie_list',
    'GM_cookie_set',
    'GM_cookie_delete',
    'GM_download',
    'GM_openInTab',
    'GM_closeTab',
    'GM_notification',
    'GM_registerMenuCommand',
    'GM_xmlhttpRequest',
    'GM_audio_setMute',
  ])('rejects %s from a @grant none script', async (action) => {
    scripts.set('script_1', script(['none']));
    const denied = await gate.checkGmActionGrant(action, SENDER);
    expect(denied?.error).toContain('is not granted');
  });

  it('allows the same actions once the matching grant is declared', async () => {
    const cases = [
      ['GM_setValue', 'GM_setValue'],
      ['GM_cookie_list', 'GM_cookie'],
      ['GM_download', 'GM_download'],
      ['GM_xmlhttpRequest', 'GM_xmlhttpRequest'],
      ['GM_registerMenuCommand', 'GM_registerMenuCommand'],
      ['GM_audio_setMute', 'GM_audio'],
    ];
    for (const [action, grant] of cases) {
      scripts.set('script_1', script([grant]));
      await expect(gate.checkGmActionGrant(action, SENDER)).resolves.toBeNull();
    }
  });

  it('does not let one grant buy an unrelated capability', async () => {
    scripts.set('script_1', script(['GM_setValue']));
    for (const action of ['GM_cookie_list', 'GM_download', 'GM_openInTab', 'GM_xmlhttpRequest']) {
      const denied = await gate.checkGmActionGrant(action, SENDER);
      expect(denied?.error).toContain('is not granted');
    }
  });

  it('leaves extension surfaces (no resolved script) ungated', async () => {
    await expect(gate.checkGmActionGrant('GM_setValue', {})).resolves.toBeNull();
    await expect(gate.checkGmActionGrant('GM_setValue', undefined)).resolves.toBeNull();
  });

  it('does not gate non-GM actions', async () => {
    scripts.set('script_1', script(['none']));
    await expect(gate.checkGmActionGrant('getScripts', SENDER)).resolves.toBeNull();
    await expect(gate.checkGmActionGrant('reportExecTime', SENDER)).resolves.toBeNull();
  });

  it('denies when the authenticated script no longer exists', async () => {
    const denied = await gate.checkGmActionGrant('GM_setValue', SENDER);
    expect(denied?.error).toContain('is not granted');
  });

  it('denies rather than proceeding when the grant lookup itself fails', async () => {
    scripts.set('script_1', new Error('IndexedDB unavailable'));
    const denied = await gate.checkGmActionGrant('GM_setValue', SENDER);
    expect(denied?.error).toContain('is not granted');
    expect(gate.warnings.join(' ')).toContain('IndexedDB unavailable');
  });

  it('honours @grant *', async () => {
    scripts.set('script_1', script(['*']));
    for (const action of ['GM_setValue', 'GM_cookie_delete', 'GM_download']) {
      await expect(gate.checkGmActionGrant(action, SENDER)).resolves.toBeNull();
    }
  });
});
