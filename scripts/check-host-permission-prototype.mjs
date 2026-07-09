#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const check = args.includes('--check');
const write = args.includes('--write') || !check;
const OUTPUT = 'docs/host-permission-prototype.md';
const OPTIONAL_HOST_PATTERNS = ['http://*/*', 'https://*/*'];

function readText(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildOptionalHostPrototype(manifest) {
  const prototype = structuredClone(manifest);
  const requiredHosts = Array.isArray(prototype.host_permissions) ? prototype.host_permissions : [];
  prototype.host_permissions = requiredHosts.filter(pattern => pattern !== '<all_urls>');
  if (prototype.host_permissions.length === 0) delete prototype.host_permissions;
  prototype.optional_host_permissions = unique([
    ...(Array.isArray(prototype.optional_host_permissions) ? prototype.optional_host_permissions : []),
    ...OPTIONAL_HOST_PATTERNS,
  ]);
  prototype.__scriptvault_prototype = {
    notShipping: true,
    movedFromRequiredHostPermissions: ['<all_urls>'],
    purpose: 'Validate optional HTTP(S) host grants before changing the default store manifest.',
  };
  return prototype;
}

function hasContentScriptAllUrls(manifest) {
  return (manifest.content_scripts || []).some(script => (script.matches || []).includes('<all_urls>'));
}

function hasWebAccessibleAllUrls(manifest) {
  return (manifest.web_accessible_resources || []).some(block => (block.matches || []).includes('<all_urls>'));
}

function analyzeTarget(name, manifest) {
  const prototype = buildOptionalHostPrototype(manifest);
  const permissions = new Set(manifest.permissions || []);
  const optionalPermissions = new Set(manifest.optional_permissions || []);
  const shippingHostPermissions = new Set(manifest.host_permissions || []);
  const shippingOptionalHosts = new Set(manifest.optional_host_permissions || []);
  const prototypeOptionalHosts = new Set(prototype.optional_host_permissions || []);
  const failures = [];

  if (name === 'Firefox') {
    if (!shippingHostPermissions.has('<all_urls>')) {
      failures.push(`${name} shipping manifest no longer declares required <all_urls>; update Firefox reviewer copy together.`);
    }
  } else {
    if (shippingHostPermissions.has('<all_urls>')) {
      failures.push(`${name} shipping manifest still declares required <all_urls>.`);
    }
    for (const pattern of OPTIONAL_HOST_PATTERNS) {
      if (!shippingOptionalHosts.has(pattern)) {
        failures.push(`${name} shipping manifest is missing optional_host_permissions ${pattern}.`);
      }
    }
  }
  for (const pattern of OPTIONAL_HOST_PATTERNS) {
    if (!prototypeOptionalHosts.has(pattern)) {
      failures.push(`${name} prototype is missing optional_host_permissions ${pattern}.`);
    }
  }
  if ((prototype.host_permissions || []).includes('<all_urls>')) {
    failures.push(`${name} prototype still has required <all_urls>.`);
  }
  if (!hasContentScriptAllUrls(manifest) || !hasContentScriptAllUrls(prototype)) {
    failures.push(`${name} content-script <all_urls> match drifted; .user.js install and bridge coverage need a separate prototype.`);
  }
  if (hasWebAccessibleAllUrls(manifest) || hasWebAccessibleAllUrls(prototype)) {
    failures.push(`${name} should not expose install.html as a web-accessible <all_urls> resource.`);
  }

  const userScriptsReady = permissions.has('userScripts') || optionalPermissions.has('userScripts');
  const dnrReady = permissions.has('declarativeNetRequest') && permissions.has('declarativeNetRequestWithHostAccess');
  const downloadReady = permissions.has('downloads') || optionalPermissions.has('downloads');
  const cookiesReady = permissions.has('cookies') || optionalPermissions.has('cookies');
  if (!userScriptsReady) failures.push(`${name} prototype cannot register userscripts without userScripts permission coverage.`);
  if (!dnrReady) failures.push(`${name} prototype lacks DNR permissions needed for GM_webRequest rules.`);
  if (!downloadReady) failures.push(`${name} prototype lacks downloads permission needed for GM_download.`);
  if (!cookiesReady) failures.push(`${name} prototype lacks cookie permission coverage.`);

  return {
    name,
    prototype,
    checks: {
      shippingRequiredAllUrls: (manifest.host_permissions || []).includes('<all_urls>'),
      optionalHttpHosts: OPTIONAL_HOST_PATTERNS.every(pattern => prototypeOptionalHosts.has(pattern)),
      contentScriptBridge: hasContentScriptAllUrls(prototype),
      installPagePrivate: !hasWebAccessibleAllUrls(prototype),
      userScriptsReady,
      dnrReady,
      downloadReady,
      cookiesReady,
    },
    failures,
  };
}

function passLabel(value) {
  return value ? 'pass' : 'fail';
}

export function renderReport({ chromeManifest, firefoxManifest, privacy, storeCopy }) {
  const analyses = [
    analyzeTarget('Chrome', chromeManifest),
    analyzeTarget('Firefox', firefoxManifest),
  ];
  const reviewerCopyReady = privacy.includes('host_permission | `<all_urls>`')
    && storeCopy.includes('host_permission | `<all_urls>`');
  const failures = analyses.flatMap(result => result.failures);
  if (!reviewerCopyReady) {
    failures.push('Reviewer copy no longer covers the shipping <all_urls> host permission.');
  }

  const rows = analyses.map(result => {
    const c = result.checks;
    return `| ${result.name} | ${passLabel(result.name === 'Firefox' ? c.shippingRequiredAllUrls : !c.shippingRequiredAllUrls)} | ${passLabel(c.optionalHttpHosts)} | ${passLabel(c.contentScriptBridge && c.installPagePrivate)} | ${passLabel(c.userScriptsReady)} | ${passLabel(c.dnrReady && c.downloadReady && c.cookiesReady)} |`;
  }).join('\n');

  const examples = analyses.map(result => {
    const prototype = result.prototype;
    return [
      `### ${result.name} Prototype Shape`,
      '',
      '```json',
      JSON.stringify({
        host_permissions: prototype.host_permissions || [],
        optional_host_permissions: prototype.optional_host_permissions || [],
        content_scripts: (prototype.content_scripts || []).map(script => ({ matches: script.matches || [] })),
        web_accessible_resources: (prototype.web_accessible_resources || []).map(block => ({ matches: block.matches || [] })),
      }, null, 2),
      '```',
    ].join('\n');
  }).join('\n\n');

  return {
    failures,
    text: `# Host Permission Recovery Prototype

This report is generated by \`npm run host-permissions:prototype\`. Chrome ships optional HTTP(S) host permissions; Firefox keeps required \`<all_urls>\` until browser smoke evidence supports the same default-manifest change there.

## Prototype Gate

| Target | Shipping host model current | Optional HTTP(S) hosts staged | Bridge retained / install page private | userScripts covered | GM DNR/download/cookie coverage |
|---|---|---|---|---|---|
${rows}

Reviewer copy status: ${reviewerCopyReady ? 'pass' : 'fail'}.

## Validation Scope

- Detect withheld current-site access before presenting script rows as runnable.
- Provide a Chrome host-access-request recovery path when available and a standard \`permissions.request({ origins })\` fallback.
- Keep Firefox grant/revoke behavior observable through permissions events.
- Keep Firefox changes out of release manifests until sideload smoke passes for userScripts registration, \`@require\` fetches, DNR rules, cookie access, and downloads under optional HTTP(S) host grants.

${examples}
`,
  };
}

function main() {
  const chromeManifest = readJson('manifest.json');
  const firefoxManifest = readJson('manifest-firefox.json');
  const report = renderReport({
    chromeManifest,
    firefoxManifest,
    privacy: readText('PRIVACY.md'),
    storeCopy: readText('docs/store-listing-copy.md'),
  });

  if (report.failures.length > 0) {
    console.error('Host permission prototype check failed:');
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  const outPath = resolve(ROOT, OUTPUT);
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  if (check) {
    if (current !== report.text) {
      console.error(`${OUTPUT} is stale. Run npm run host-permissions:prototype.`);
      process.exit(1);
    }
    console.log('Host permission prototype report is current.');
    return;
  }

  if (write) {
    writeFileSync(outPath, report.text, 'utf8');
    console.log(`Updated ${OUTPUT}.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
