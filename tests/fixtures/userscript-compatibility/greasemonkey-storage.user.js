'use strict';
// ==UserScript==
// @name        GM set/get/list/delete (ScriptVault compatibility fixture)
// @namespace   scriptvault-compatibility
// @version     1.0.0
// @match       http://127.0.0.1/compat/greasemonkey-storage/*
// @run-at      document-start
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM.listValues
// @grant       GM.deleteValue
// @license     GPL-3.0-only (upstream test fixture)
// ==/UserScript==

// This is the Greasemonkey storage conformance flow with only the match,
// namespace, and license metadata adapted for a deterministic local page.
// It intentionally keeps the Promise-based GM API calls and the two-step
// list/delete sequence that catches incomplete storage implementations.
try {
  GM.getValue('val', 0).then(val => {
    try {
      console.log('got value =', val);
      GM.setValue('val', val + 1);
    } catch (e) { console.error(e); }
  });
} catch (e) { console.error(e); }

try {
  GM.setValue('temp', 'temp').then(
    () => GM.listValues().then(values => {
      console.log('1 I see:', values);
      GM.deleteValue('temp').then(() => {
        GM.listValues().then(values => {
          console.log('2 I see:', values);
          document.documentElement.setAttribute('data-sv-gm-storage-fixture', 'ready');
        });
      });
    })
  );
} catch (e) { console.error(e); }
