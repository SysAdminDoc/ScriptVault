// ============================================================================
// Generated from src/bg/analyzer.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptAnalyzer = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/bg/analyzer.ts
  var analyzer_exports = {};
  __export(analyzer_exports, {
    ScriptAnalyzer: () => ScriptAnalyzer
  });
  module.exports = __toCommonJS(analyzer_exports);
  function debugLogSafe(...args) {
    const maybeDebugLog = globalThis.debugLog;
    if (typeof maybeDebugLog === "function") {
      maybeDebugLog(...args);
    }
  }
  async function analyzeAsync(code) {
    const offscreenSupported = _supportsOffscreen();
    try {
      const result = await sendOffscreenMessage({ type: "offscreen_analyze", code });
      if (result && !result.parseError) return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe("[Analyzer] Offscreen analysis failed:", message);
    }
    if (!offscreenSupported) {
      try {
        const result = await analyzeInline(code);
        if (result && !result.parseError) return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        debugLogSafe("[Analyzer] Inline AST failed, using regex fallback:", message);
      }
    }
    return analyze(code);
  }
  function getOffscreenApi() {
    const maybeChrome = chrome;
    const offscreen = maybeChrome?.offscreen;
    if (!offscreen || typeof offscreen.hasDocument !== "function" || typeof offscreen.createDocument !== "function") {
      return null;
    }
    return offscreen;
  }
  function _supportsOffscreen() {
    return getOffscreenApi() !== null;
  }
  async function _ensureOffscreen() {
    const offscreen = getOffscreenApi();
    if (!offscreen) return false;
    if (!ScriptAnalyzer._offscreenPromise) {
      ScriptAnalyzer._offscreenPromise = (async () => {
        const existing = await offscreen.hasDocument().catch(() => false);
        if (!existing) {
          await offscreen.createDocument({
            url: chrome.runtime.getURL("offscreen.html"),
            reasons: ["DOM_SCRAPING"],
            justification: "AST-based script analysis with Acorn parser"
          });
        }
        return true;
      })().catch((e) => {
        ScriptAnalyzer._offscreenPromise = null;
        throw e;
      });
    }
    return ScriptAnalyzer._offscreenPromise;
  }
  async function sendOffscreenMessage(message) {
    if (!await _ensureOffscreen()) return void 0;
    return chrome.runtime.sendMessage(message);
  }
  function getGlobalValue(name) {
    const value = globalThis[name];
    return value ? value : null;
  }
  function getNativeImportScripts() {
    const loader = globalThis.importScripts;
    if (typeof loader !== "function") return null;
    const source = Function.prototype.toString.call(loader);
    if (!source.includes("[native code]")) return null;
    return loader;
  }
  async function loadRuntimeScript(path) {
    const url = chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path;
    const workerLoader = getNativeImportScripts();
    if (workerLoader) {
      workerLoader(url);
      return;
    }
    const doc = globalThis.document;
    if (!doc?.createElement) {
      throw new Error(`No runtime script loader available for ${path}`);
    }
    const parent = doc.head || doc.documentElement;
    if (!parent?.appendChild) {
      throw new Error(`No document root available to load ${path}`);
    }
    await new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      const timer = globalThis.setTimeout(() => {
        script.remove();
        reject(new Error(`Timed out loading ${path}`));
      }, 5e3);
      script.src = url;
      script.async = false;
      script.onload = () => {
        globalThis.clearTimeout(timer);
        script.remove();
        resolve();
      };
      script.onerror = () => {
        globalThis.clearTimeout(timer);
        script.remove();
        reject(new Error(`Failed to load ${path}`));
      };
      parent.appendChild(script);
    });
  }
  async function ensureInlineLibrary(path, globalName) {
    if (getGlobalValue(globalName)) return;
    const key = `${globalName}:${path}`;
    if (!ScriptAnalyzer._inlineLibraryPromises[key]) {
      ScriptAnalyzer._inlineLibraryPromises[key] = loadRuntimeScript(path).then(() => {
        if (!getGlobalValue(globalName)) {
          throw new Error(`${globalName} did not initialize from ${path}`);
        }
      }).catch((e) => {
        ScriptAnalyzer._inlineLibraryPromises[key] = void 0;
        throw e;
      });
    }
    return ScriptAnalyzer._inlineLibraryPromises[key];
  }
  async function ensureInlineAcorn() {
    await ensureInlineLibrary("lib/acorn.min.js", "acorn");
  }
  async function ensureInlineDiff() {
    await ensureInlineLibrary("lib/diff.min.js", "Diff");
  }
  function getAcorn() {
    const parser = getGlobalValue("acorn");
    if (!parser || typeof parser.parse !== "function") {
      throw new Error("Acorn parser is not available");
    }
    return parser;
  }
  function getDiff() {
    const diff = getGlobalValue("Diff");
    if (!diff || typeof diff.structuredPatch !== "function" || typeof diff.applyPatch !== "function") {
      throw new Error("Diff library is not available");
    }
    return diff;
  }
  async function analyzeInline(code) {
    await ensureInlineAcorn();
    return handleInlineAnalyze(code);
  }
  async function analyzeESMImports(code) {
    const offscreenSupported = _supportsOffscreen();
    try {
      const offscreenResult = await sendOffscreenMessage({ type: "offscreen_esm_imports", code });
      if (offscreenResult) return offscreenResult;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe("[Analyzer] Offscreen ESM parse failed:", message);
    }
    if (offscreenSupported) {
      return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: "ESM parse error: offscreen parser unavailable" };
    }
    try {
      await ensureInlineAcorn();
      return parseESMImportsInline(code);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: "ESM parse error: " + message };
    }
  }
  async function mergeText(base, local, remote) {
    const offscreenSupported = _supportsOffscreen();
    try {
      const offscreenResult = await sendOffscreenMessage({
        type: "offscreen_merge",
        base,
        local,
        remote
      });
      if (offscreenResult) return offscreenResult;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe("[Analyzer] Offscreen merge failed:", message);
    }
    if (offscreenSupported) {
      return { merged: resolveWithMarkers(local, remote), conflicts: true, error: "offscreen merge unavailable" };
    }
    try {
      await ensureInlineDiff();
      return mergeTextInline(base, local, remote);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { merged: resolveWithMarkers(local, remote), conflicts: true, error: message };
    }
  }
  var patterns = [
    { id: "eval", regex: /\beval\s*\(/g, label: "eval() call", risk: 30, category: "execution", desc: "Dynamic code execution can run arbitrary code" },
    { id: "function-ctor", regex: /\bnew\s+Function\s*\(/g, label: "new Function()", risk: 30, category: "execution", desc: "Creates functions from strings, equivalent to eval" },
    { id: "settimeout-str", regex: /setTimeout\s*\(\s*['\"`]/g, label: "setTimeout with string", risk: 20, category: "execution", desc: "String argument to setTimeout acts like eval" },
    { id: "setinterval-str", regex: /setInterval\s*\(\s*['\"`]/g, label: "setInterval with string", risk: 20, category: "execution", desc: "String argument to setInterval acts like eval" },
    { id: "document-write", regex: /document\.write\s*\(/g, label: "document.write()", risk: 10, category: "execution", desc: "Can overwrite entire page content" },
    { id: "innerhtml-assign", regex: /\.innerHTML\s*=/g, label: "innerHTML assignment", risk: 5, category: "execution", desc: "Can inject HTML including scripts (XSS risk)" },
    { id: "cookie-access", regex: /document\.cookie/g, label: "Cookie access", risk: 25, category: "data", desc: "Can read or modify browser cookies" },
    { id: "localstorage", regex: /localStorage\.(get|set|remove)Item/g, label: "localStorage access", risk: 10, category: "data", desc: "Reads or writes persistent page data" },
    { id: "sessionstorage", regex: /sessionStorage\.(get|set|remove)Item/g, label: "sessionStorage access", risk: 5, category: "data", desc: "Reads or writes session data" },
    { id: "indexeddb", regex: /indexedDB\.open/g, label: "IndexedDB access", risk: 10, category: "data", desc: "Opens browser database" },
    { id: "fetch-call", regex: /\bfetch\s*\(/g, label: "fetch() call", risk: 10, category: "network", desc: "Makes network requests (same-origin)" },
    { id: "xhr-open", regex: /XMLHttpRequest|\.open\s*\(\s*['""](?:GET|POST|PUT|DELETE)/gi, label: "XMLHttpRequest", risk: 10, category: "network", desc: "Makes network requests" },
    { id: "websocket", regex: /new\s+WebSocket\s*\(/g, label: "WebSocket", risk: 20, category: "network", desc: "Opens persistent connection to a server" },
    { id: "beacon", regex: /navigator\.sendBeacon/g, label: "sendBeacon()", risk: 15, category: "network", desc: "Sends data to a server, often used for tracking" },
    { id: "canvas-fp", regex: /\.toDataURL\s*\(|\.getImageData\s*\(/g, label: "Canvas fingerprinting", risk: 20, category: "fingerprint", desc: "Can generate unique device fingerprint via canvas" },
    { id: "webgl-fp", regex: /getExtension\s*\(\s*['""]WEBGL/g, label: "WebGL fingerprinting", risk: 20, category: "fingerprint", desc: "Can identify GPU for device fingerprinting" },
    { id: "audio-fp", regex: /AudioContext|OfflineAudioContext/g, label: "Audio fingerprinting", risk: 15, category: "fingerprint", desc: "Can generate audio-based device fingerprint" },
    { id: "navigator-props", regex: /navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g, label: "Navigator property access", risk: 5, category: "fingerprint", desc: "Reads browser/device information" },
    { id: "atob-long", regex: /atob\s*\(\s*['""][A-Za-z0-9+/=]{100,}['"]\s*\)/g, label: "Large base64 decode", risk: 25, category: "obfuscation", desc: "Decodes large embedded base64 data (possible obfuscation)" },
    { id: "hex-escape", regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g, label: "Hex escape sequences", risk: 20, category: "obfuscation", desc: "Long hex-encoded strings suggest obfuscated code" },
    { id: "char-fromcode", regex: /String\.fromCharCode\s*\([^)]{20,}\)/g, label: "String.fromCharCode chain", risk: 15, category: "obfuscation", desc: "Building strings from char codes (obfuscation technique)" },
    { id: "wasm-mining", regex: /WebAssembly\.(instantiate|compile|Module)/g, label: "WebAssembly usage", risk: 15, category: "mining", desc: "WebAssembly can be used for crypto mining" },
    { id: "worker-creation", regex: /new\s+Worker\s*\(/g, label: "Web Worker creation", risk: 10, category: "mining", desc: "Workers can run background computations" },
    { id: "form-submit", regex: /\.submit\s*\(\s*\)/g, label: "Form auto-submit", risk: 15, category: "hijack", desc: "Automatically submits forms" },
    { id: "window-open", regex: /window\.open\s*\(/g, label: "window.open()", risk: 5, category: "hijack", desc: "Opens new windows/popups" },
    { id: "location-assign", regex: /(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g, label: "Page redirect", risk: 10, category: "hijack", desc: "Redirects the page to another URL" },
    { id: "event-prevent", regex: /addEventListener\s*\(\s*['""](?:beforeunload|unload)['"]/g, label: "Unload handler", risk: 10, category: "hijack", desc: "Prevents or intercepts page navigation" },
    { id: "proto-pollution", regex: /__proto__|Object\.setPrototypeOf\s*\(|prototype\[/g, label: "Prototype manipulation", risk: 25, category: "hijack", desc: "Modifying object prototypes can corrupt global state and affect other scripts" },
    { id: "document-domain", regex: /document\.domain\s*=/g, label: "document.domain assignment", risk: 20, category: "hijack", desc: "Changing document.domain relaxes same-origin restrictions" },
    { id: "postmessage-noorigin", regex: /postMessage\s*\([^,)]+,\s*['"]\*['"]/g, label: "postMessage with wildcard origin", risk: 15, category: "hijack", desc: "Sending postMessage to any origin (* target) can leak data to malicious frames" },
    { id: "defineProperty-global", regex: /Object\.defineProperty\s*\(\s*(?:window|globalThis|self|unsafeWindow)\s*,/g, label: "Global property definition", risk: 10, category: "hijack", desc: "Defining properties on the global object can interfere with page code" },
    { id: "mutation-events", regex: /addEventListener\s*\(\s*['"](?:DOMNodeInserted|DOMNodeRemoved|DOMSubtreeModified|DOMAttrModified|DOMCharacterDataModified|DOMNodeInsertedIntoDocument|DOMNodeRemovedFromDocument)['"]/g, label: "Deprecated Mutation Events", risk: 5, category: "deprecated", desc: "Legacy Mutation Events are removed in Chrome and Firefox 140+. Use MutationObserver instead." }
  ];
  var AST_RISK_PATTERNS = [
    {
      id: "eval",
      label: "eval() call",
      risk: 30,
      category: "execution",
      desc: "Dynamic code execution can run arbitrary code",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "eval")
    },
    {
      id: "function-ctor",
      label: "new Function()",
      risk: 30,
      category: "execution",
      desc: "Creates functions from strings, equivalent to eval",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "Function")
    },
    {
      id: "indirect-eval",
      label: "Indirect eval ((0, eval))",
      risk: 30,
      category: "execution",
      desc: "Indirect eval runs in global scope, bypassing local closures (obfuscation pattern)",
      match: (node) => {
        if (node?.type !== "CallExpression") return false;
        const callee = node.callee;
        if (callee?.type !== "SequenceExpression") return false;
        const exprs = callee.expressions;
        if (!Array.isArray(exprs) || exprs.length === 0) return false;
        return isIdent(exprs[exprs.length - 1], "eval");
      }
    },
    {
      id: "dynamic-property-call",
      label: "Dynamic-property global call",
      risk: 25,
      category: "obfuscation",
      desc: "Calls a globally-scoped function via computed property access (eval obfuscation)",
      match: (node) => {
        if (node?.type !== "CallExpression") return false;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.computed !== true) return false;
        if (callee.property?.type === "Literal" && typeof callee.property.value === "string") return false;
        return isIdent(callee.object, "window") || isIdent(callee.object, "globalThis") || isIdent(callee.object, "self") || isIdent(callee.object, "unsafeWindow");
      }
    },
    {
      id: "function-ctor-apply",
      label: "Function constructor via .apply/.call/.bind",
      risk: 25,
      category: "execution",
      desc: "Calling Function() via .apply/.call/.bind is equivalent to new Function()",
      match: (node) => {
        if (node?.type !== "CallExpression") return false;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression") return false;
        const methodName = callee.property?.name;
        if (methodName !== "apply" && methodName !== "call" && methodName !== "bind") return false;
        if (isIdent(callee.object, "Function")) return true;
        if (callee.object?.type === "MemberExpression") {
          if (isMember(callee.object, "Function", "prototype")) return true;
          if (callee.object?.property?.name === "constructor" && callee.object?.object?.type === "MemberExpression" && isMember(callee.object.object, "Function", "prototype")) return true;
        }
        return false;
      }
    },
    {
      id: "settimeout-str",
      label: "setTimeout with string",
      risk: 20,
      category: "execution",
      desc: "String argument to setTimeout acts like eval",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "setTimeout") && node.arguments?.[0]?.type === "Literal" && typeof node.arguments[0].value === "string"
    },
    {
      id: "setinterval-str",
      label: "setInterval with string",
      risk: 20,
      category: "execution",
      desc: "String argument to setInterval acts like eval",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "setInterval") && node.arguments?.[0]?.type === "Literal" && typeof node.arguments[0].value === "string"
    },
    {
      id: "document-write",
      label: "document.write()",
      risk: 10,
      category: "execution",
      desc: "Can overwrite entire page content",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "document", "write")
    },
    {
      id: "innerhtml-assign",
      label: "innerHTML assignment",
      risk: 5,
      category: "execution",
      desc: "Can inject HTML including scripts (XSS risk)",
      match: (node) => (node.type === "AssignmentExpression" || node.type === "AssignmentPattern") && node.left?.property?.name === "innerHTML"
    },
    {
      id: "cookie-access",
      label: "Cookie access",
      risk: 25,
      category: "data",
      desc: "Can read or modify browser cookies",
      match: (node) => node.type === "MemberExpression" && isMember(node, "document", "cookie")
    },
    {
      id: "localstorage",
      label: "localStorage access",
      risk: 10,
      category: "data",
      desc: "Reads or writes persistent page data",
      match: (node) => node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "localStorage") && ["getItem", "setItem", "removeItem"].includes(node.callee?.property?.name)
    },
    {
      id: "sessionstorage",
      label: "sessionStorage access",
      risk: 5,
      category: "data",
      desc: "Reads or writes session data",
      match: (node) => node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "sessionStorage") && ["getItem", "setItem", "removeItem"].includes(node.callee?.property?.name)
    },
    {
      id: "indexeddb",
      label: "IndexedDB access",
      risk: 10,
      category: "data",
      desc: "Opens browser database",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "indexedDB", "open")
    },
    {
      id: "fetch-call",
      label: "fetch() call",
      risk: 10,
      category: "network",
      desc: "Makes network requests (same-origin)",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "fetch")
    },
    {
      id: "xhr-open",
      label: "XMLHttpRequest",
      risk: 10,
      category: "network",
      desc: "Makes network requests via XHR",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "XMLHttpRequest") || node.type === "CallExpression" && node.callee?.property?.name === "open" && node.arguments?.[0]?.type === "Literal" && /^(GET|POST|PUT|DELETE|PATCH|HEAD)$/i.test(String(node.arguments[0].value))
    },
    {
      id: "websocket",
      label: "WebSocket",
      risk: 20,
      category: "network",
      desc: "Opens persistent connection to a server",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "WebSocket")
    },
    {
      id: "beacon",
      label: "sendBeacon()",
      risk: 15,
      category: "network",
      desc: "Sends data to a server, often used for tracking",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "navigator", "sendBeacon")
    },
    {
      id: "canvas-fp",
      label: "Canvas fingerprinting",
      risk: 20,
      category: "fingerprint",
      desc: "Can generate unique device fingerprint via canvas",
      match: (node) => node.type === "CallExpression" && ["toDataURL", "getImageData"].includes(node.callee?.property?.name)
    },
    {
      id: "webgl-fp",
      label: "WebGL fingerprinting",
      risk: 20,
      category: "fingerprint",
      desc: "Can identify GPU for device fingerprinting",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "getExtension" && node.arguments?.[0]?.type === "Literal" && String(node.arguments[0].value).startsWith("WEBGL")
    },
    {
      id: "audio-fp",
      label: "Audio fingerprinting",
      risk: 15,
      category: "fingerprint",
      desc: "Can generate audio-based device fingerprint",
      match: (node) => node.type === "NewExpression" && ["AudioContext", "OfflineAudioContext"].includes(node.callee?.name)
    },
    {
      id: "navigator-props",
      label: "Navigator property access",
      risk: 5,
      category: "fingerprint",
      desc: "Reads browser/device information",
      match: (node) => node.type === "MemberExpression" && isIdent(node.object, "navigator") && ["platform", "userAgent", "language", "hardwareConcurrency", "deviceMemory", "plugins"].includes(node.property?.name)
    },
    {
      id: "atob-long",
      label: "Large base64 decode",
      risk: 25,
      category: "obfuscation",
      desc: "Decodes large embedded base64 data (possible obfuscation)",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "atob") && node.arguments?.[0]?.type === "Literal" && typeof node.arguments[0].value === "string" && node.arguments[0].value.length >= 100
    },
    {
      id: "char-fromcode",
      label: "String.fromCharCode chain",
      risk: 15,
      category: "obfuscation",
      desc: "Building strings from char codes (obfuscation technique)",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "String", "fromCharCode") && node.arguments.length > 5
    },
    {
      id: "wasm-module",
      label: "WebAssembly usage",
      risk: 15,
      category: "mining",
      desc: "WebAssembly can be used for crypto mining",
      match: (node) => node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "WebAssembly") && ["instantiate", "compile", "Module"].includes(node.callee?.property?.name)
    },
    {
      id: "worker-creation",
      label: "Web Worker creation",
      risk: 10,
      category: "mining",
      desc: "Workers can run background computations",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "Worker")
    },
    {
      id: "form-submit",
      label: "Form auto-submit",
      risk: 15,
      category: "hijack",
      desc: "Automatically submits forms",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "submit" && node.arguments.length === 0
    },
    {
      id: "window-open",
      label: "window.open()",
      risk: 5,
      category: "hijack",
      desc: "Opens new windows/popups",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "window", "open")
    },
    {
      id: "location-assign",
      label: "Page redirect",
      risk: 10,
      category: "hijack",
      desc: "Redirects the page to another URL",
      match: (node) => node.type === "AssignmentExpression" && (isMember(node.left, "location", "href") || isIdent(node.left, "location")) || node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "location") && ["assign", "replace"].includes(node.callee?.property?.name)
    },
    {
      id: "event-prevent",
      label: "Unload handler",
      risk: 10,
      category: "hijack",
      desc: "Prevents or intercepts page navigation",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "addEventListener" && node.arguments?.[0]?.type === "Literal" && ["beforeunload", "unload"].includes(node.arguments[0].value)
    },
    {
      id: "proto-pollution",
      label: "Prototype manipulation",
      risk: 25,
      category: "hijack",
      desc: "Modifying object prototypes can corrupt global state",
      match: (node) => node.type === "MemberExpression" && node.property?.name === "__proto__" || node.type === "CallExpression" && isMember(node.callee, "Object", "setPrototypeOf") || node.type === "MemberExpression" && node.property?.name === "prototype" && node._parent?.type === "MemberExpression"
    },
    {
      id: "document-domain",
      label: "document.domain assignment",
      risk: 20,
      category: "hijack",
      desc: "Changing document.domain relaxes same-origin restrictions",
      match: (node) => node.type === "AssignmentExpression" && isMember(node.left, "document", "domain")
    },
    {
      id: "postmessage-wildcard",
      label: "postMessage with wildcard origin",
      risk: 15,
      category: "hijack",
      desc: "Sending postMessage to any origin (*) can leak data to malicious frames",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "postMessage" && node.arguments?.[1]?.type === "Literal" && node.arguments[1].value === "*"
    },
    {
      id: "defineProperty-global",
      label: "Global property definition",
      risk: 10,
      category: "hijack",
      desc: "Defining properties on the global object can interfere with page code",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "Object", "defineProperty") && node.arguments?.[0]?.type === "Identifier" && ["window", "globalThis", "self", "unsafeWindow"].includes(node.arguments[0].name)
    }
  ];
  function isIdent(node, name) {
    return node?.type === "Identifier" && node.name === name;
  }
  function isMember(node, obj, prop) {
    return node?.type === "MemberExpression" && isIdent(node.object, obj) && node.property?.name === prop;
  }
  function handleInlineAnalyze(code) {
    try {
      if (code && code.length > 2e6) {
        return {
          totalRisk: 0,
          riskLevel: "unknown",
          findings: [],
          categories: {},
          summary: "Script too large for AST analysis",
          astAnalyzed: false,
          skipped: true
        };
      }
      return analyzeAST(code);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        totalRisk: 0,
        riskLevel: "unknown",
        findings: [],
        categories: {},
        summary: "Parse error: " + message,
        astAnalyzed: false,
        parseError: true
      };
    }
  }
  function analyzeAST(code) {
    const parser = getAcorn();
    const hasUseStrict = /^(['"])use strict\1/m.test(code);
    let ast;
    try {
      ast = parser.parse(code, { ecmaVersion: 2022, sourceType: "script", allowHashBang: true, locations: true, ...hasUseStrict ? { strict: true } : {} });
    } catch {
      ast = parser.parse(code, { ecmaVersion: 2022, sourceType: "module", allowHashBang: true, locations: true });
    }
    const hits = /* @__PURE__ */ new Map();
    const hitNodes = /* @__PURE__ */ new Map();
    walkAST(ast, (node) => {
      for (const pattern of AST_RISK_PATTERNS) {
        try {
          if (pattern.match(node)) {
            hits.set(pattern.id, (hits.get(pattern.id) || 0) + 1);
            if (!hitNodes.has(pattern.id) && node.loc) {
              hitNodes.set(pattern.id, { line: node.loc.start.line, col: node.loc.start.column });
            }
          }
        } catch {
        }
      }
    });
    const entropyResult = checkHighEntropyStrings(ast);
    const findings = [];
    let totalRisk = 0;
    for (const pattern of AST_RISK_PATTERNS) {
      const count = hits.get(pattern.id) || 0;
      if (count > 0) {
        const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
        totalRisk += adjustedRisk;
        findings.push({
          id: pattern.id,
          label: pattern.label,
          category: pattern.category,
          desc: pattern.desc,
          risk: pattern.risk,
          count,
          adjustedRisk,
          location: hitNodes.get(pattern.id) || null
        });
      }
    }
    if (entropyResult) {
      totalRisk += entropyResult.adjustedRisk;
      findings.push(entropyResult);
    }
    const strippedForScam = code.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, "");
    const scam = detectScamSignals(strippedForScam);
    for (const f of scam.findings) findings.push(f);
    totalRisk += scam.risk;
    const riskLevel = totalRisk >= 80 ? "high" : totalRisk >= 40 ? "medium" : totalRisk >= 15 ? "low" : "minimal";
    const categories = {};
    for (const f of findings) {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(f);
    }
    return {
      totalRisk: Math.min(totalRisk, 100),
      riskLevel,
      findings,
      categories,
      summary: generateSummary(riskLevel, findings),
      astAnalyzed: true
    };
  }
  function parseESMImportsInline(code) {
    const parser = getAcorn();
    try {
      const ast = parser.parse(code, { ecmaVersion: 2022, sourceType: "module", allowHashBang: true, locations: true });
      const imports = [];
      const exports = [];
      const dynamicImports = [];
      const unsupportedExports = [];
      walkAST(ast, (node) => {
        if (node.type === "ImportDeclaration") {
          imports.push({
            start: node.start,
            end: node.end,
            source: node.source?.value || "",
            specifiers: (node.specifiers || []).map((spec) => {
              if (spec.type === "ImportDefaultSpecifier") {
                return { kind: "default", local: spec.local.name };
              }
              if (spec.type === "ImportNamespaceSpecifier") {
                return { kind: "namespace", local: spec.local.name };
              }
              return {
                kind: "named",
                imported: spec.imported?.name || spec.imported?.value,
                local: spec.local.name
              };
            })
          });
        } else if (node.type === "ImportExpression" || node.type === "CallExpression" && node.callee?.type === "Import") {
          dynamicImports.push({
            line: node.loc?.start?.line || null,
            column: node.loc?.start?.column || null
          });
        } else if (node.type === "ExportDefaultDeclaration") {
          const declaration = node.declaration;
          exports.push({
            kind: "default",
            start: node.start,
            end: node.end,
            declarationStart: declaration.start,
            declarationEnd: declaration.end,
            localName: declaration.id?.name || null
          });
        } else if (node.type === "ExportNamedDeclaration") {
          if (node.source) {
            unsupportedExports.push({ type: "re-export" });
          } else if (node.declaration) {
            exports.push({
              kind: "named-declaration",
              start: node.start,
              end: node.end,
              declarationStart: node.declaration.start,
              declarationEnd: node.declaration.end,
              names: declaredExportNames(node.declaration)
            });
          } else {
            exports.push({
              kind: "named-specifiers",
              start: node.start,
              end: node.end,
              declarationStart: node.start,
              declarationEnd: node.end,
              specifiers: (node.specifiers || []).map((spec) => ({
                local: spec.local?.name || spec.local?.value,
                exported: spec.exported?.name || spec.exported?.value
              }))
            });
          }
        } else if (node.type === "ExportAllDeclaration") {
          unsupportedExports.push({ type: "export-all" });
        }
      });
      return { imports, exports, dynamicImports, unsupportedExports };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: "ESM parse error: " + message };
    }
  }
  function declaredExportNames(declaration) {
    if (!declaration) return [];
    if ((declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") && declaration.id?.name) {
      return [declaration.id.name];
    }
    if (declaration.type === "VariableDeclaration") {
      const names = [];
      for (const decl of declaration.declarations || []) {
        collectPatternNames(decl.id, names);
      }
      return names;
    }
    return [];
  }
  function collectPatternNames(pattern, names) {
    if (!pattern) return;
    if (pattern.type === "Identifier") {
      names.push(pattern.name);
    } else if (pattern.type === "ObjectPattern") {
      for (const prop of pattern.properties || []) {
        collectPatternNames(prop.value || prop.argument, names);
      }
    } else if (pattern.type === "ArrayPattern") {
      for (const item of pattern.elements || []) {
        collectPatternNames(item, names);
      }
    } else if (pattern.type === "AssignmentPattern") {
      collectPatternNames(pattern.left, names);
    } else if (pattern.type === "RestElement") {
      collectPatternNames(pattern.argument, names);
    }
  }
  function walkAST(node, visitor, parent = null) {
    if (!node || typeof node !== "object") return;
    if (node.type) {
      node._parent = parent;
      visitor(node);
      delete node._parent;
    }
    for (const key of Object.keys(node)) {
      if (key === "_parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof c === "object" && c.type) walkAST(c, visitor, node);
        }
      } else if (child && typeof child === "object" && child.type) {
        walkAST(child, visitor, node);
      }
    }
  }
  function checkHighEntropyStrings(ast) {
    const longStrings = [];
    walkAST(ast, (node) => {
      if (node.type === "Literal" && typeof node.value === "string" && node.value.length >= 80) {
        longStrings.push(node.value);
      }
    });
    if (!longStrings.length) return null;
    let maxEntropy = 0;
    let maxStr = longStrings[0];
    for (const s of longStrings) {
      const entropy = calculateEntropy(s);
      if (entropy > maxEntropy) {
        maxEntropy = entropy;
        maxStr = s;
      }
    }
    const threshold = maxStr.length >= 200 ? 4.5 : 5.2;
    if (maxEntropy <= threshold) return null;
    return {
      id: "high-entropy",
      label: "High-entropy string detected",
      category: "obfuscation",
      desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${maxEntropy.toFixed(1)})`,
      risk: 20,
      count: longStrings.length,
      adjustedRisk: 20
    };
  }
  function mergeTextInline(base, local, remote) {
    if (base == null || local == null || remote == null) return { error: "Missing merge inputs" };
    if (local === remote) return { merged: local, conflicts: false };
    if (local === base) return { merged: remote, conflicts: false };
    if (remote === base) return { merged: local, conflicts: false };
    try {
      const diff = getDiff();
      const patch = diff.structuredPatch("script", "script", base, remote, "", "", { context: 3 });
      if (!Array.isArray(patch.hunks) || patch.hunks.length === 0) {
        return { merged: local, conflicts: false };
      }
      const mergedText = diff.applyPatch(local, patch);
      if (mergedText === false) {
        return { merged: resolveWithMarkers(local, remote), conflicts: true };
      }
      return { merged: mergedText, conflicts: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { merged: resolveWithMarkers(local, remote), conflicts: true, error: message };
    }
  }
  function resolveWithMarkers(local, remote) {
    return [
      "<<<<<<< LOCAL (your device)",
      local,
      "=======",
      remote,
      ">>>>>>> REMOTE (cloud)"
    ].join("\n");
  }
  var SCAM_WALLET_SECRET = /\b(seed[\s_-]?phrase|mnemonic|recovery[\s_-]?phrase|secretRecoveryPhrase)\b/i;
  var SCAM_PRIVATE_KEY = /\b(private[\s_-]?key|privateKey|priv[\s_-]?key)\b/i;
  var SCAM_WALLET_CONTEXT = /(\bwallet\b|\bwindow\.ethereum\b|\bethereum\b|\bweb3\b|\bmetamask\b|\bwalletconnect\b|\bsolana\b|\bphantom\b|\bkeplr\b|\bcoinbase\b|0x[a-fA-F0-9]{40})/i;
  var SCAM_WEBCRYPTO_CONTEXT = /\b(crypto\.subtle|SubtleCrypto|CryptoKey|generateKey|importKey|exportKey|deriveKey|deriveBits|subtle\.sign)\b/;
  var SCAM_DRAINER_KEYWORDS = /\b(drainer|drainWallet|sweepWallet|transferAll|approveMax|setApprovalForAll)\b/i;
  var SCAM_WALLET_TX = /\b(eth_sendTransaction|wallet_sendTransaction|personal_sign|eth_sign|signTransaction|sendRawTransaction)\b/;
  var SCAM_EXFIL = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|GM_xmlhttpRequest|GM\.xmlHttpRequest)\b/;
  function detectScamSignals(strippedCode) {
    const findings = [];
    let risk = 0;
    const walletSecret = SCAM_WALLET_SECRET.test(strippedCode);
    const privateKeyRef = SCAM_PRIVATE_KEY.test(strippedCode);
    const walletContext = SCAM_WALLET_CONTEXT.test(strippedCode);
    const webCrypto = SCAM_WEBCRYPTO_CONTEXT.test(strippedCode);
    const seedHarvest = walletSecret || privateKeyRef && !webCrypto;
    const strongWalletSecret = walletSecret || privateKeyRef && walletContext && !webCrypto;
    const drainer = SCAM_DRAINER_KEYWORDS.test(strippedCode);
    const walletTx = SCAM_WALLET_TX.test(strippedCode);
    const exfil = SCAM_EXFIL.test(strippedCode);
    if (seedHarvest) {
      findings.push({ id: "wallet-seed-access", label: "Wallet seed / private key access", category: "scam", desc: "References a wallet seed/recovery phrase or private key \u2014 the hallmark of a wallet-drainer script.", risk: 35, count: 1, adjustedRisk: 35 });
      risk += 35;
    }
    if (drainer) {
      findings.push({ id: "wallet-drainer-keywords", label: "Wallet-drainer keywords", category: "scam", desc: "Contains keywords associated with wallet-drainer scripts (e.g. setApprovalForAll, sweepWallet, transferAll).", risk: 40, count: 1, adjustedRisk: 40 });
      risk += 40;
    }
    if (walletTx) {
      findings.push({ id: "wallet-transaction", label: "Wallet transaction / signature request", category: "scam", desc: "Initiates a wallet transaction or signature (eth_sendTransaction / personal_sign). Legitimate for dApps, but review the destination.", risk: 25, count: 1, adjustedRisk: 25 });
      risk += 25;
    }
    if ((strongWalletSecret || drainer) && exfil) {
      findings.push({ id: "credential-exfil", label: "Possible credential/wallet exfiltration", category: "scam", desc: "This script references wallet secrets or drainer operations AND performs an off-page network send \u2014 a possible credential/wallet exfiltration. Review the network destinations before installing.", risk: 60, count: 1, adjustedRisk: 60 });
      risk += 60;
    }
    return { findings, risk };
  }
  function analyze(code) {
    const findings = [];
    let totalRisk = 0;
    const strippedCode = code.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const matches = strippedCode.match(pattern.regex);
      if (matches && matches.length > 0) {
        const count = matches.length;
        const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
        totalRisk += adjustedRisk;
        findings.push({ id: pattern.id, label: pattern.label, category: pattern.category, desc: pattern.desc, risk: pattern.risk, count, adjustedRisk });
      }
    }
    const longStrings = strippedCode.match(/['"][^'"]{80,}['"]/g);
    if (longStrings && longStrings.length > 0) {
      let maxEntropy = 0;
      let maxStr = longStrings[0];
      for (const s of longStrings) {
        const entropy = calculateEntropy(s);
        if (entropy > maxEntropy) {
          maxEntropy = entropy;
          maxStr = s;
        }
      }
      const threshold = maxStr.length >= 200 ? 4.5 : 5.2;
      if (maxEntropy > threshold) {
        findings.push({ id: "high-entropy", label: "High-entropy string detected", category: "obfuscation", desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${maxEntropy.toFixed(1)})`, risk: 20, count: longStrings.length, adjustedRisk: 20 });
        totalRisk += 20;
      }
    }
    const scam = detectScamSignals(strippedCode);
    for (const f of scam.findings) findings.push(f);
    totalRisk += scam.risk;
    const riskLevel = totalRisk >= 80 ? "high" : totalRisk >= 40 ? "medium" : totalRisk >= 15 ? "low" : "minimal";
    const categories = {};
    for (const f of findings) {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(f);
    }
    return { totalRisk: Math.min(totalRisk, 100), riskLevel, findings, categories, summary: generateSummary(riskLevel, findings), astAnalyzed: false };
  }
  function calculateEntropy(str) {
    const freq = {};
    for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
  function generateSummary(riskLevel, findings) {
    if (!findings.length) return "No suspicious patterns detected.";
    const cats = [...new Set(findings.map((f) => f.category))];
    const catLabels = { execution: "dynamic code execution", data: "data access", network: "network activity", fingerprint: "device fingerprinting", obfuscation: "code obfuscation", mining: "potential mining", hijack: "page manipulation", deprecated: "deprecated API usage" };
    return `Found ${findings.length} pattern(s) involving ${cats.map((c) => catLabels[c] ?? c).join(", ")}.`;
  }
  var ScriptAnalyzer = {
    analyzeAsync,
    analyzeESMImports,
    mergeText,
    _ensureOffscreen,
    _supportsOffscreen,
    _offscreenPromise: null,
    _inlineLibraryPromises: {},
    patterns,
    analyze,
    calculateEntropy,
    generateSummary
  };
  return module.exports.default || module.exports.ScriptAnalyzer || module.exports;
})();
