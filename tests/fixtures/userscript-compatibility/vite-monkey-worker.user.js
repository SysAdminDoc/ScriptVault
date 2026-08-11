// ==UserScript==
// @name         Vite Plugin Monkey Worker compatibility fixture
// @namespace    https://github.com/lisonge/vite-plugin-monkey
// @version      1.0.0
// @description  Localized Worker and GM API shape from vite-plugin-monkey v8
// @license      MIT
// @match        http://127.0.0.1/compat/vite-monkey-worker/*
// @run-at       document-start
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.addStyle
// @grant        GM.addElement
// ==/UserScript==

// This deliberately small fixture keeps the generated-user-script shape that
// vite-plugin-monkey v8 supports: a bundled async body, Promise GM methods,
// and a Worker created from a Blob URL. It has no @require, fetch, or target
// site dependency, so the browser gate remains deterministic and offline.
(async () => {
  const value = await GM.getValue('compatibility-worker-runs', 0);
  await GM.setValue('compatibility-worker-runs', value + 1);
  await GM.addStyle('[data-scriptvault-worker-fixture] { color: rgb(0, 128, 0); }');
  await GM.addElement('div', {
    'data-scriptvault-worker-fixture': 'present',
    textContent: 'worker fixture',
  });

  const workerUrl = URL.createObjectURL(new Blob([
    'self.postMessage({ ready: true, source: "vite-plugin-monkey-v8" });',
  ], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  worker.addEventListener('message', event => {
    if (event.data?.ready !== true) return;
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    document.documentElement.setAttribute('data-sv-vite-worker-fixture', 'ready');
  }, { once: true });
})();
