// ScriptVault - Experimental ESM userscript bundler (disabled by default).
// Static install-time rewrite only: imports are discovered by Acorn in the
// offscreen document, fetched through the existing @require path, and bundled
// into a classic script body for chrome.userScripts.register().

const ESMUserscriptBundler = (() => {
  function isESMMetadata(meta) {
    return !!meta && (meta.module === '1' || meta['inject-into'] === 'module' || meta.esm === true);
  }

  function resolveImportSpecifier(specifier, parentUrl) {
    if (/^https?:\/\//i.test(specifier)) return specifier;
    if (/^[./]/.test(specifier) && /^https?:\/\//i.test(parentUrl || '')) {
      return new URL(specifier, parentUrl).toString();
    }
    throw new Error(`Unsupported ESM import specifier: ${specifier}`);
  }

  async function collectSyntaxViaOffscreen(code) {
    if (typeof ScriptAnalyzer === 'undefined' || !ScriptAnalyzer?._ensureOffscreen) {
      throw new Error('ESM bundler requires the offscreen Acorn parser');
    }
    await ScriptAnalyzer._ensureOffscreen();
    const result = await chrome.runtime.sendMessage({ type: 'offscreen_esm_imports', code });
    if (!result || result.error) {
      throw new Error(result?.error || 'ESM parse failed');
    }
    if (Array.isArray(result.dynamicImports) && result.dynamicImports.length > 0) {
      const first = result.dynamicImports[0];
      const where = first?.line ? ` at line ${first.line}` : '';
      throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
    }
    if (Array.isArray(result.unsupportedExports) && result.unsupportedExports.length > 0) {
      throw new Error(`Unsupported ESM export syntax: ${result.unsupportedExports[0].type}`);
    }
    return result;
  }

  function assertSupportedSyntax(analysis) {
    if (Array.isArray(analysis.dynamicImports) && analysis.dynamicImports.length > 0) {
      const first = analysis.dynamicImports[0];
      const where = first?.line ? ` at line ${first.line}` : '';
      throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
    }
    if (Array.isArray(analysis.unsupportedExports) && analysis.unsupportedExports.length > 0) {
      throw new Error(`Unsupported ESM export syntax: ${analysis.unsupportedExports[0].type}`);
    }
  }

  function importReplacement(imp) {
    const id = JSON.stringify(imp.resolvedSource || imp.source);
    if (!imp.specifiers || imp.specifiers.length === 0) {
      return `__require(${id});`;
    }
    const lines = [];
    const named = [];
    for (const spec of imp.specifiers) {
      if (spec.kind === 'default') {
        lines.push(`const ${spec.local} = __require(${id}).default;`);
      } else if (spec.kind === 'namespace') {
        lines.push(`const ${spec.local} = __require(${id});`);
      } else if (spec.kind === 'named') {
        named.push(spec.imported === spec.local ? spec.imported : `${spec.imported}: ${spec.local}`);
      }
    }
    if (named.length) {
      lines.push(`const { ${named.join(', ')} } = __require(${id});`);
    }
    return lines.join('\n');
  }

  function exportReplacement(exp, code) {
    if (exp.kind === 'named-specifiers') {
      return (exp.specifiers || [])
        .map(spec => `__exports.${spec.exported} = ${spec.local};`)
        .join('\n');
    }

    const declaration = code.slice(exp.declarationStart, exp.declarationEnd);
    if (exp.kind === 'default') {
      if (exp.localName) {
        return `${declaration}\n__exports.default = ${exp.localName};`;
      }
      return `__exports.default = ${declaration};`;
    }

    const assignments = (exp.names || [])
      .map(name => `__exports.${name} = ${name};`)
      .join('\n');
    return `${declaration}\n${assignments}`;
  }

  function rewriteModuleSyntax(code, analysis) {
    const replacements = [];
    for (const imp of analysis.imports || []) {
      replacements.push({ start: imp.start, end: imp.end, text: importReplacement(imp) });
    }
    for (const exp of analysis.exports || []) {
      replacements.push({ start: exp.start, end: exp.end, text: exportReplacement(exp, code) });
    }
    replacements.sort((a, b) => b.start - a.start);
    let out = code;
    for (const item of replacements) {
      out = out.slice(0, item.start) + item.text + out.slice(item.end);
    }
    return out;
  }

  function buildBundle(entryCode, modules) {
    const moduleDefs = [...modules.values()]
      .map(mod => `__modules[${JSON.stringify(mod.url)}] = function(__module, __exports, __require) {\n${mod.code}\n};`)
      .join('\n');
    return [
      '(function () {',
      "'use strict';",
      'const __modules = Object.create(null);',
      'const __cache = Object.create(null);',
      moduleDefs,
      'function __require(id) {',
      '  if (__cache[id]) return __cache[id].exports;',
      '  const factory = __modules[id];',
      '  if (!factory) throw new Error("Missing ESM module: " + id);',
      '  const module = { exports: {} };',
      '  __cache[id] = module;',
      '  factory(module, module.exports, __require);',
      '  return module.exports;',
      '}',
      'const __exports = {};',
      entryCode,
      '})();'
    ].filter(Boolean).join('\n');
  }

  async function bundleModule(url, code, context) {
    if (context.modules.has(url)) return;
    context.modules.set(url, { url, code: '' });

    const analysis = await context.collectSyntax(code);
    assertSupportedSyntax(analysis);
    for (const imp of analysis.imports || []) {
      imp.resolvedSource = resolveImportSpecifier(imp.source, url);
      const depCode = await context.fetchImport(imp.resolvedSource);
      if (!depCode) {
        throw new Error(`Failed to fetch ESM import: ${imp.resolvedSource}`);
      }
      await bundleModule(imp.resolvedSource, depCode, context);
    }

    context.modules.set(url, {
      url,
      code: rewriteModuleSyntax(code, analysis),
      bytes: code.length
    });
  }

  async function bundle(code, options = {}) {
    const entryUrl = options.sourceUrl || 'scriptvault:entry';
    const context = {
      modules: new Map(),
      fetchImport: options.fetchImport || fetchRequireScript,
      collectSyntax: options.collectSyntax || collectSyntaxViaOffscreen
    };
    const entryAnalysis = await context.collectSyntax(code);
    assertSupportedSyntax(entryAnalysis);
    for (const imp of entryAnalysis.imports || []) {
      imp.resolvedSource = resolveImportSpecifier(imp.source, entryUrl);
      const depCode = await context.fetchImport(imp.resolvedSource);
      if (!depCode) {
        throw new Error(`Failed to fetch ESM import: ${imp.resolvedSource}`);
      }
      await bundleModule(imp.resolvedSource, depCode, context);
    }
    const rewrittenEntry = rewriteModuleSyntax(code, entryAnalysis);
    return {
      code: buildBundle(rewrittenEntry, context.modules),
      imports: [...context.modules.values()].map(mod => ({ url: mod.url, bytes: mod.bytes || 0 })),
      entryUrl
    };
  }

  async function bundleIfNeeded(code, meta, settings, options = {}) {
    if (!isESMMetadata(meta)) {
      return { bundled: false, code, imports: [], entryUrl: options.sourceUrl || '' };
    }
    if (!settings?.experimentalESMUserscripts) {
      throw new Error('ESM userscripts are experimental and require the experimentalESMUserscripts setting.');
    }
    const result = await bundle(code, options);
    return { bundled: true, ...result };
  }

  return {
    isESMMetadata,
    resolveImportSpecifier,
    rewriteModuleSyntax,
    bundle,
    bundleIfNeeded
  };
})();

self.ESMUserscriptBundler = ESMUserscriptBundler;
