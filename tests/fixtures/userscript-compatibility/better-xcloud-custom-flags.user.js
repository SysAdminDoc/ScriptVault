// ==UserScript==
// @name         Better xCloud - Custom flags (ScriptVault compatibility fixture)
// @namespace    https://github.com/redphx
// @version      1.0.0
// @description  Customize Better xCloud script
// @author       redphx
// @license      MIT
// @match        http://127.0.0.1/compat/better-xcloud-custom-flags/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
'use strict';

/*
 * This is the small, real-world Better xCloud custom-flags companion script.
 * The target match is local-only so this fixture never contacts Xbox or a
 * third-party service. The flags shape and document-start execution remain
 * unchanged from the pinned upstream source.
 */
const enabled = true;

enabled && (window.BX_FLAGS = {
  EnableWebGPURenderer: false,
  ForceNativeMkbTitles: [],
});

const markReady = () => {
  if (!document.documentElement) return false;
  document.documentElement.setAttribute('data-sv-better-xcloud-fixture', 'ready');
  return true;
};

if (!markReady()) {
  const observer = new MutationObserver(() => {
    if (markReady()) observer.disconnect();
  });
  observer.observe(document, { childList: true });
}
