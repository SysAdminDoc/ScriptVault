import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  GMGrantPolicy,
  grantDeniedError,
  grantsForAction,
  isActionGrantedByList,
  isActionGrantedForScript,
  isUnclassifiedGmAction,
} from '../src/background/gm-grant-policy.ts';
import { BACKGROUND_MESSAGE_ACTIONS } from '../src/background/message-router.ts';

// Derive the expected scope from the router rather than restating it: a gate
// whose scope is a hand-written list certifies whatever is not in the list.
const GM_ROUTED_ACTIONS = BACKGROUND_MESSAGE_ACTIONS.filter(
  (action) => action.startsWith('GM_') || action.startsWith('GM.'),
);

const ROOT = process.cwd();

describe('GM grant policy', () => {
  it('grants nothing to @grant none or an empty grant list', () => {
    for (const action of Object.keys(GMGrantPolicy.ACTION_GRANTS)) {
      expect(isActionGrantedByList(action, ['none'])).toBe(false);
      expect(isActionGrantedByList(action, [])).toBe(false);
      expect(isActionGrantedByList(action, undefined)).toBe(false);
      // Declaring an unrelated grant must not admit an unrelated action.
      expect(isActionGrantedByList(action, ['GM_info'])).toBe(false);
    }
  });

  it('grants everything to @grant *', () => {
    for (const action of Object.keys(GMGrantPolicy.ACTION_GRANTS)) {
      expect(isActionGrantedByList(action, ['*'])).toBe(true);
    }
  });

  it('admits an action when any of its authorizing grants is declared', () => {
    for (const [action, grants] of Object.entries(GMGrantPolicy.ACTION_GRANTS)) {
      for (const grant of grants) {
        expect(isActionGrantedByList(action, [grant])).toBe(true);
      }
    }
  });

  it('keeps the disclosed capability boundaries separate', () => {
    // A value-store grant must not buy network, cookies, downloads or tabs.
    expect(isActionGrantedByList('GM_xmlhttpRequest', ['GM_setValue'])).toBe(false);
    expect(isActionGrantedByList('GM_cookie_list', ['GM_setValue'])).toBe(false);
    expect(isActionGrantedByList('GM_download', ['GM_setValue'])).toBe(false);
    expect(isActionGrantedByList('GM_openInTab', ['GM_setValue'])).toBe(false);
    // Read does not imply write.
    expect(isActionGrantedByList('GM_setValue', ['GM_getValue'])).toBe(false);
    expect(isActionGrantedByList('GM_deleteValue', ['GM_getValue'])).toBe(false);
    // Listener callbacks include the new value. Its grant authorizes only the
    // internal read needed for that callback, never writes or deletes.
    expect(isActionGrantedByList('GM_getValue', ['GM_addValueChangeListener'])).toBe(true);
    expect(isActionGrantedByList('GM_setValue', ['GM_addValueChangeListener'])).toBe(false);
    // Cookie access is a single grant covering all three verbs, as the wrapper
    // gates them — but nothing else grants it.
    expect(isActionGrantedByList('GM_cookie_delete', ['GM_cookie'])).toBe(true);
    expect(isActionGrantedByList('GM_cookie_delete', ['GM_xmlhttpRequest'])).toBe(false);
  });

  // A gate whose scope is a hand-written list silently authorises whatever is
  // NOT in the list. Derive the expected set from the router instead.
  it('classifies every GM action the router accepts', () => {
    const unclassified = GM_ROUTED_ACTIONS.filter((action) => isUnclassifiedGmAction(action));
    expect(unclassified).toEqual([]);
  });

  it('has no stale entries for actions the router no longer accepts', () => {
    const routed = new Set(GM_ROUTED_ACTIONS);
    const stale = Object.keys(GMGrantPolicy.ACTION_GRANTS).filter((action) => !routed.has(action));
    expect(stale).toEqual([]);
  });

  it('fails closed on an unclassified GM action', () => {
    expect(isUnclassifiedGmAction('GM_somethingBrandNew')).toBe(true);
    expect(isActionGrantedByList('GM_somethingBrandNew', ['*'])).toBe(false);
    expect(isActionGrantedByList('GM_somethingBrandNew', ['GM_somethingBrandNew'])).toBe(false);
  });

  it('leaves non-GM actions alone', () => {
    expect(grantsForAction('getScripts')).toBeNull();
    expect(isUnclassifiedGmAction('getScripts')).toBe(false);
    expect(isActionGrantedByList('getScripts', [])).toBe(true);
  });

  it('reads grants off a stored script record', () => {
    expect(isActionGrantedForScript('GM_setValue', { meta: { grant: ['GM_setValue'] } })).toBe(true);
    expect(isActionGrantedForScript('GM_setValue', { meta: { grant: ['none'] } })).toBe(false);
    expect(isActionGrantedForScript('GM_setValue', { meta: {} })).toBe(false);
    expect(isActionGrantedForScript('GM_setValue', null)).toBe(false);
  });

  it('names the grant to add in the denial message', () => {
    expect(grantDeniedError('GM_setValue')).toContain('@grant GM_setValue');
    expect(grantDeniedError('GM_cookie_list')).toContain('@grant GM_cookie');
  });
});

describe('grant enforcement is wired at the privileged boundary', () => {
  const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
  const background = readFileSync(resolve(ROOT, 'background.js'), 'utf8');

  it('ships the policy module ahead of the core bridge', () => {
    const moduleAt = background.indexOf('const GMGrantPolicy = (() => {');
    const coreAt = background.indexOf('async function checkGmActionGrant(');
    expect(moduleAt).toBeGreaterThan(-1);
    expect(coreAt).toBeGreaterThan(moduleAt);
  });

  it('gates both user-script message listeners, not just one', () => {
    const gateCalls = core.match(/await checkGmActionGrant\(message\.action, verifiedSender\)/g) || [];
    // onMessage (Chrome <131 / Firefox fallback) and onUserScriptMessage.
    expect(gateCalls).toHaveLength(2);
    expect(core).toContain('if (denied) return denied;');
  });

  it('only gates senders that resolved to a script, and fails closed otherwise', () => {
    expect(core).toContain('const scriptId = sender?.userScriptId;');
    expect(core).toContain('if (!scriptId) return null;');
    // A storage failure or a vanished script denies rather than proceeding.
    expect(core).toContain('return { error: GMGrantPolicy.grantDeniedError(action) };');
  });
});
