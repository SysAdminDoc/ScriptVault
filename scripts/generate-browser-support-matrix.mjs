#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const check = args.includes('--check');

function argValue(name) {
  const prefix = `${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function readText(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function existingGeneratedDate() {
  for (const file of ['README.md', 'docs/cross-browser-pipeline.md']) {
    if (!existsSync(resolve(root, file))) continue;
    const match = readText(file).match(/Last generated:\s*(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return null;
}

function firefoxLintSummary() {
  const artifact = resolve(root, 'firefox-artifacts/web-ext-lint.json');
  if (!existsSync(artifact)) {
    return '`npm run firefox:package`, `npm run smoke:firefox` (no local `firefox-artifacts/web-ext-lint.json` present)';
  }
  try {
    const lint = JSON.parse(readFileSync(artifact, 'utf8'));
    const errors = lint.summary?.errors ?? lint.errors?.length ?? 0;
    const notices = lint.summary?.notices ?? lint.notices?.length ?? 0;
    const warnings = lint.summary?.warnings ?? lint.warnings?.length ?? lint.count ?? 0;
    return `\`npm run firefox:package\`, \`npm run smoke:firefox\`; web-ext lint ${errors} errors / ${notices} notices / ${warnings} warnings`;
  } catch {
    return '`npm run firefox:package`, `npm run smoke:firefox` (local lint artifact unreadable)';
  }
}

function matrixMarkdown(date) {
  const chromeManifest = readJson('manifest.json');
  const firefoxManifest = readJson('manifest-firefox.json');
  const version = chromeManifest.version;
  const chromeMin = chromeManifest.minimum_chrome_version || 'unknown';
  const firefoxMin = firefoxManifest.browser_specific_settings?.gecko?.strict_min_version || 'unknown';
  const firefoxAndroidMin = firefoxManifest.browser_specific_settings?.gecko_android?.strict_min_version || 'unknown';
  const firefoxEvidence = firefoxLintSummary();

  return `<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:START -->
_Last generated: ${date} with \`npm run support:matrix\`. Version source: \`manifest.json\` / \`manifest-firefox.json\` ${version}._

| Browser | Support level | Tested version / target | Last successful verification | Verification evidence | Unsupported or deferred APIs |
|---|---|---|---|---|---|
| Chrome / Chromium | Tier 1 published target | Chrome ${chromeMin}+ MV3 | ${date} | \`npm run smoke:dashboard\`, \`npm run cws:check\`, Chrome ZIP packaging in CI | Chrome 138+ requires per-extension Allow User Scripts; per-script \`worldId\` is Chrome 133+ and feature-gated |
| Microsoft Edge | Tier 1 compatible package; separate store automation pending | Edge ${chromeMin}+ Chromium MV3 package | ${date} package/manifests; no separate Edge CI smoke yet | Same ZIP as Chrome; smoke harness can run with Edge via \`SCRIPT_VAULT_CHROME_PATH\` | Edge Add-ons package/publish path is not automated yet |
| Firefox Desktop | AMO validation target, not a published listing | Firefox ${firefoxMin}+ MV3 | ${date} | ${firefoxEvidence} | \`sidePanel\`, \`offscreen\`, \`identity\` OAuth, and some \`userScripts.execute\` flows are unsupported/deferred; Firefox package omits Monaco until the Firefox editor-loading pass |
| Firefox for Android | Manifest validation target | Firefox for Android ${firefoxAndroidMin}+ | ${date} package/manifests; no Android device smoke yet | \`manifest-firefox.json\` \`gecko_android\` target plus Firefox source/package ZIP | Same Firefox API deferrals; no side panel; Android device smoke is not wired |
| Brave / Vivaldi / Opera / Arc | Chromium derivative watchlist | Chrome ${chromeMin}+ package may load | Not release-verified | No CI smoke or store package for these browsers | Store policy, shields/sidebar behavior, and extension UI chrome are unverified |
| Orion / Safari | Not supported | Not a current target | Not verified | No build, smoke, or package path | Requires separate WebKit/Orion validation and likely native Safari extension work |
<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:END -->`;
}

function replaceOrInsertReadme(source, block) {
  const start = '<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:START -->';
  const end = '<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:END -->';
  const existing = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (existing.test(source)) return source.replace(existing, block);

  const anchor = '\n---\n\n## Permission and Privacy Review';
  if (!source.includes(anchor)) {
    throw new Error('README.md anchor not found for support matrix insertion');
  }
  return source.replace(anchor, `\n---\n\n## Browser Support Matrix\n\n${block}\n${anchor}`);
}

function replaceOrInsertPipeline(source, block) {
  const start = '<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:START -->';
  const end = '<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:END -->';
  const existing = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (existing.test(source)) return source.replace(existing, block);

  const anchor = 'Smoke-test each on every release tag.';
  if (!source.includes(anchor)) {
    throw new Error('docs/cross-browser-pipeline.md anchor not found for support matrix insertion');
  }
  return source.replace(anchor, `${anchor}\n\n## Current Generated Support Matrix\n\n${block}`);
}

function writeIfChanged(path, next) {
  const full = resolve(root, path);
  const current = readFileSync(full, 'utf8');
  if (current === next) return false;
  if (check) return true;
  writeFileSync(full, next);
  return true;
}

const date = argValue('--date') || (check ? existingGeneratedDate() || today() : today());
const block = matrixMarkdown(date);

const readmeNext = replaceOrInsertReadme(readText('README.md'), block);
const pipelineNext = replaceOrInsertPipeline(readText('docs/cross-browser-pipeline.md'), block);

const changed = [
  writeIfChanged('README.md', readmeNext) && 'README.md',
  writeIfChanged('docs/cross-browser-pipeline.md', pipelineNext) && 'docs/cross-browser-pipeline.md',
].filter(Boolean);

if (check && changed.length > 0) {
  console.error(`Browser support matrix is stale: ${changed.join(', ')}`);
  console.error('Run `npm run support:matrix` and commit the generated docs.');
  process.exit(1);
}

if (changed.length > 0) {
  console.log(`Updated browser support matrix in ${changed.join(', ')}`);
} else {
  console.log('Browser support matrix is current.');
}
