// ScriptVault v2.0.0 — Lazy Module Loader
// Defers loading of non-critical dashboard modules until their tab/panel is activated.
// This reduces initial page load from 38 scripts to ~10, improving Time-to-Interactive.

const LazyLoader = (() => {
  'use strict';

  const _loaded = new Set();
  const _loading = new Map(); // script src → Promise

  // Modules that should load IMMEDIATELY (critical path)
  // Everything else is deferred until the user navigates to the relevant tab
  const EAGER_MODULES = new Set([
    'dashboard.js',
    'monaco-adapter.js',
    'dashboard-a11y.js',       // Accessibility must be immediate
    'dashboard-keyboard.js',   // Keyboard nav must be immediate
    'dashboard-firefox-compat.js', // Polyfills must be immediate
    'dashboard-i18n-v2.js',    // Translations must be immediate
  ]);

  // Map: tab name → modules to load when that tab is activated
  const TAB_MODULES = {
    store: ['dashboard-store.js', 'dashboard-openuserjs.js'],
    performance: ['dashboard-performance.js'],
    analytics: ['dashboard-analytics.js', 'dashboard-heatmap.js'],
    ai: ['dashboard-ai.js'],
    scripts: ['dashboard-cardview.js', 'dashboard-linter.js', 'dashboard-recommendations.js'],
    settings: ['dashboard-theme-editor.js'],
    utilities: ['dashboard-collections.js', 'dashboard-standalone.js', 'dashboard-depgraph.js'],
    help: [],
    trash: [],
  };

  // Modules loaded on first editor open
  const EDITOR_MODULES = [
    'dashboard-pattern-builder.js',
    'dashboard-debugger.js',
    'dashboard-diff.js',
    'dashboard-snippets.js',
  ];

  // Modules loaded on demand (user action triggers)
  const ON_DEMAND_MODULES = {
    onboarding: 'dashboard-onboarding.js',
    whatsnew: 'dashboard-whatsnew.js',
    sharing: 'dashboard-sharing.js',
    gist: 'dashboard-gist.js',
    templates: 'dashboard-templates.js',
    profiles: 'dashboard-profiles.js',
    scheduler: 'dashboard-scheduler.js',
    chains: 'dashboard-chains.js',
    gamification: 'dashboard-gamification.js',
    csp: 'dashboard-csp.js',
    devtools: 'devtools-panel-v2.js',
  };

  /**
   * Load a script by filename (relative to pages/).
   * Returns a Promise that resolves when the script is loaded and executed.
   */
  function loadScript(src) {
    if (_loaded.has(src)) return Promise.resolve();
    if (_loading.has(src)) return _loading.get(src);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        _loaded.add(src);
        _loading.delete(src);
        resolve();
      };
      script.onerror = () => {
        _loading.delete(src);
        console.warn(`[LazyLoader] Failed to load: ${src}`);
        resolve(); // Don't reject — module is optional
      };
      document.body.appendChild(script);
    });

    _loading.set(src, promise);
    return promise;
  }

  /**
   * Load multiple scripts in parallel.
   */
  function loadScripts(srcs) {
    return Promise.all(srcs.map(s => loadScript(s)));
  }

  /**
   * Load modules for a specific tab.
   */
  async function loadForTab(tabName) {
    const modules = TAB_MODULES[tabName];
    if (!modules || modules.length === 0) return;
    await loadScripts(modules);
  }

  /**
   * Load editor-related modules.
   */
  async function loadForEditor() {
    await loadScripts(EDITOR_MODULES);
  }

  /**
   * Load a specific on-demand module by key.
   */
  async function loadOnDemand(key) {
    const src = ON_DEMAND_MODULES[key];
    if (!src) return;
    await loadScript(src);
  }

  /**
   * Check if a module is loaded.
   */
  function isLoaded(src) {
    return _loaded.has(src);
  }

  /**
   * Convert dashboard.html to use lazy loading.
   * Call this to transform existing <script> tags:
   * - Eager scripts keep their tags
   * - Deferred scripts get data-lazy attribute and are removed from sync loading
   *
   * NOTE: This function is for documentation — the actual HTML should be manually
   * updated to only include eager scripts, with lazy scripts loaded via this module.
   */
  function getEagerScripts() {
    return [...EAGER_MODULES];
  }

  function getDeferredScripts() {
    const all = new Set();
    Object.values(TAB_MODULES).flat().forEach(s => all.add(s));
    EDITOR_MODULES.forEach(s => all.add(s));
    Object.values(ON_DEMAND_MODULES).forEach(s => all.add(s));
    return [...all];
  }

  /**
   * Mark already-loaded scripts (called on init to register scripts
   * that were loaded via <script> tags in the HTML).
   */
  function markLoaded(srcs) {
    srcs.forEach(s => _loaded.add(s));
  }

  return {
    loadScript,
    loadScripts,
    loadForTab,
    loadForEditor,
    loadOnDemand,
    isLoaded,
    getEagerScripts,
    getDeferredScripts,
    markLoaded,
    EAGER_MODULES,
    TAB_MODULES,
    EDITOR_MODULES,
    ON_DEMAND_MODULES,
  };
})();
