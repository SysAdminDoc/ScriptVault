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

function edgeBuildSummary(version) {
  const reportPath = `edge-artifacts/edge-build-${version}.json`;
  const reportFullPath = resolve(root, reportPath);
  if (!existsSync(reportFullPath)) {
    throw new Error(`Edge build report is missing: ${reportPath}. Run \`npm run build:edge:check\` before \`npm run support:matrix${check ? ':check' : ''}\`.`);
  }

  let report;
  try {
    report = readJson(reportPath);
  } catch (err) {
    throw new Error(`Edge build report is unreadable: ${reportPath} (${err?.message || err})`);
  }

  const artifact = report.artifact || `edge-artifacts/scriptvault-edge-v${version}.zip`;
  const failures = [];
  if (report.version !== version) failures.push(`version ${report.version || '<missing>'} does not match manifest ${version}`);
  if (Array.isArray(report.missingFiles) && report.missingFiles.length > 0) {
    failures.push(`missing files: ${report.missingFiles.join(', ')}`);
  }
  if (!artifact || !existsSync(resolve(root, artifact))) failures.push(`missing Edge ZIP: ${artifact || '<missing>'}`);
  if (report.edgeReadiness?.updateUrlRemoved !== true) failures.push('Edge manifest update_url removal was not verified');
  if (failures.length > 0) {
    throw new Error(`Edge build report is not release-ready: ${failures.join('; ')}. Run \`npm run build:edge:check\`.`);
  }

  const smoke = edgeSmokeSummary(version);
  const smokePassed = smoke?.status === 'passed';

  return {
    reportPath,
    artifact,
    generatedAt: report.generatedAt || null,
    packageCommand: report.packageCommand || 'npm run build:edge:check',
    browserSmoke: edgeSmokeDescription(smoke, report, version),
    browserSmokeCommand: report.edgeReadiness?.browserSmokeCommand || null,
    browserSmokeEvidence: smoke?.path || report.edgeReadiness?.browserSmokeEvidence || null,
    browserSmokePassed: smokePassed,
    browserSmokeStatus: smoke?.status || 'missing',
    browserSmokeGeneratedAt: smoke?.generatedAt || null,
    initialPublication: report.edgeReadiness?.initialPublication || 'Manual Partner Center upload remains required.',
    updateAutomation: report.edgeReadiness?.updateAutomation || 'Edge Add-ons REST update automation is deferred.',
  };
}

function edgeSmokeSummary(version) {
  for (const path of [
    `docs/audit/edge-smoke-${version}.json`,
    `edge-artifacts/edge-smoke-${version}.json`,
  ]) {
    const fullPath = resolve(root, path);
    if (!existsSync(fullPath)) continue;
    try {
      const report = readJson(path);
      const reportVersion = report.version || null;
      const status = reportVersion && reportVersion !== version
        ? 'stale'
        : report.status || 'unknown';
      return {
        path,
        status,
        reportedStatus: report.status || 'unknown',
        version: reportVersion,
        generatedAt: report.generatedAt || null,
        edgeVersion: report.edgeVersion || null,
        failure: report.failure || report.error || report.message || null,
      };
    } catch {
      return {
        path,
        status: 'unreadable',
        reportedStatus: 'unreadable',
        version: null,
        generatedAt: null,
        edgeVersion: null,
        failure: null,
      };
    }
  }
  return null;
}

function derivativeSmokeSummary(version) {
  const path = `chromium-derivative-artifacts/summary-${version}.json`;
  const fullPath = resolve(root, path);
  if (!existsSync(fullPath)) {
    return { path, status: 'missing', generatedAt: null, browsers: [] };
  }
  try {
    const report = readJson(path);
    return {
      path,
      status: report.version === version ? (report.status || 'unknown') : 'stale',
      generatedAt: report.generatedAt || null,
      browsers: Array.isArray(report.browsers) ? report.browsers : [],
    };
  } catch {
    return { path, status: 'unreadable', generatedAt: null, browsers: [] };
  }
}

function derivativeLastVerification(evidence) {
  const date = evidence.generatedAt?.slice(0, 10) || 'Unknown date';
  const passed = evidence.browsers.filter(browser => browser?.status === 'passed');
  if (evidence.status === 'passed' && passed.length > 0) {
    return `${date} local smoke passed: ${passed.map(browser => browser.name || browser.id).join(', ')}`;
  }
  if (evidence.status === 'failed') {
    const failed = evidence.browsers.filter(browser => browser?.status === 'failed');
    return `${date} local smoke failed: ${failed.map(browser => browser.name || browser.id).join(', ') || 'unknown target'}`;
  }
  if (evidence.status === 'stale') return 'Local derivative evidence is stale';
  if (evidence.status === 'unreadable') return 'Local derivative evidence is unreadable';
  return 'Not release-verified';
}

function derivativeEvidenceText(evidence) {
  const files = evidence.browsers
    .filter(browser => browser?.evidence)
    .map(browser => `\`${browser.evidence}\``);
  return [`\`npm run smoke:derivatives\``, `\`${evidence.path}\``, ...files].join(', ');
}

function derivativeDeferredText(evidence) {
  const missing = evidence.browsers
    .filter(browser => browser?.status === 'not-installed')
    .map(browser => browser.name || browser.id);
  const unavailable = missing.length > 0 ? `${missing.join(', ')} were not installed for the latest local run; ` : '';
  return `${unavailable}store policy, shields/sidebar behavior, and extension UI chrome remain browser-specific`;
}

function trimSentence(value) {
  return String(value || '').replace(/[.。]+$/u, '');
}

function compactTableText(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function edgeSmokeAttemptDate(smoke, fallbackDate = 'unknown date') {
  return smoke?.generatedAt?.slice(0, 10) || fallbackDate;
}

function edgeSmokeDescription(smoke, report, version) {
  if (!smoke) {
    return report.edgeReadiness?.browserSmoke || 'No dedicated Edge browser smoke evidence is present.';
  }

  if (smoke.status === 'passed') {
    return `Dedicated local Edge sideload smoke passed on ${smoke.edgeVersion || 'Microsoft Edge'}; dashboard, popup, userScripts toggle, save/toggle, and local target execution were verified`;
  }

  if (smoke.status === 'stale') {
    return `Dedicated local Edge sideload smoke evidence is stale: artifact version ${smoke.version || '<missing>'} does not match manifest ${version}; rerun \`npm run smoke:edge\` before release`;
  }

  if (smoke.status === 'unreadable') {
    return `Dedicated local Edge sideload smoke evidence is unreadable at \`${smoke.path}\`; rerun \`npm run smoke:edge\` before release`;
  }

  const detail = compactTableText(smoke.failure);
  const status = compactTableText(smoke.status || 'unknown');
  return `Dedicated local Edge sideload smoke ${status} on ${edgeSmokeAttemptDate(smoke)}${detail ? `: ${detail}` : ''}; rerun \`npm run smoke:edge\` before release`;
}

function edgeLastVerificationSummary(edgeEvidence, date) {
  if (edgeEvidence.browserSmokeStatus === 'passed') {
    return `${edgeEvidence.browserSmokeGeneratedAt?.slice(0, 10) || date} Edge sideload smoke passed; package/report generated`;
  }

  if (edgeEvidence.browserSmokeStatus === 'missing') {
    return `${date} generated package/report; local Edge smoke command is available but has no current evidence`;
  }

  if (edgeEvidence.browserSmokeStatus === 'stale') {
    return `${date} generated package/report; Edge sideload smoke evidence is stale`;
  }

  if (edgeEvidence.browserSmokeStatus === 'unreadable') {
    return `${date} generated package/report; Edge sideload smoke evidence is unreadable`;
  }

  return `${edgeEvidence.browserSmokeGeneratedAt?.slice(0, 10) || date} Edge sideload smoke ${edgeEvidence.browserSmokeStatus}; package/report generated`;
}

function matrixMarkdown(date) {
  const chromeManifest = readJson('manifest.json');
  const firefoxManifest = readJson('manifest-firefox.json');
  const version = chromeManifest.version;
  const chromeMin = chromeManifest.minimum_chrome_version || 'unknown';
  const firefoxMin = firefoxManifest.browser_specific_settings?.gecko?.strict_min_version || 'unknown';
  const hasFirefoxAndroidTarget = !!firefoxManifest.browser_specific_settings?.gecko_android?.strict_min_version;
  const firefoxEvidence = firefoxLintSummary();
  const edgeEvidence = edgeBuildSummary(version);
  const derivativeEvidence = derivativeSmokeSummary(version);
  const firefoxAndroidRow = hasFirefoxAndroidTarget
    ? `| Firefox for Android | Manifest validation target | Firefox for Android ${firefoxManifest.browser_specific_settings.gecko_android.strict_min_version}+ | ${date} package/manifests; no Android device smoke yet | \`manifest-firefox.json\` \`gecko_android\` target plus Firefox source/package ZIP | Same Firefox API deferrals; no side panel; Android device smoke is not wired |`
    : `| Firefox for Android | Deferred; not an AMO compatibility target | No current \`gecko_android\` manifest target | ${date} | \`manifest-firefox.json\` intentionally omits \`gecko_android\` until an Android smoke gate exists | Android UI/runtime, extension-action overlay, host-permission, import/export, and WebDAV paths are unverified |`;

  const edgeLastVerification = edgeLastVerificationSummary(edgeEvidence, date);

  return `<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:START -->
_Last generated: ${date} with \`npm run support:matrix\`. Version source: \`manifest.json\` / \`manifest-firefox.json\` ${version}._

| Browser | Support level | Tested version / target | Last successful verification | Verification evidence | Unsupported or deferred APIs |
|---|---|---|---|---|---|
| Chrome / Chromium | Tier 1 published target | Chrome ${chromeMin}+ MV3 | ${date} | \`npm run smoke:dashboard\`, \`npm run cws:check\`, local Chrome ZIP packaging with \`npm run build:prod\` then \`bash build.sh\` | Chrome 138+ requires per-extension Allow User Scripts; current-site recovery uses Chrome 133+ \`permissions.addHostAccessRequest\` when available and falls back to \`permissions.request({ origins })\`; per-script \`worldId\` is Chrome 133+ and feature-gated |
| Microsoft Edge | Tier 1 compatible package; Partner Center publication manual | Edge ${chromeMin}+ Chromium MV3 package | ${edgeLastVerification} | \`${edgeEvidence.packageCommand}\`, \`${edgeEvidence.artifact}\`, \`${edgeEvidence.reportPath}\`${edgeEvidence.browserSmokeCommand ? `, \`${edgeEvidence.browserSmokeCommand}\`` : ''}${edgeEvidence.browserSmokeEvidence ? `, \`${edgeEvidence.browserSmokeEvidence}\`` : ''}; local release attaches \`edge-artifacts/*\` manually | ${trimSentence(edgeEvidence.initialPublication)}; ${trimSentence(edgeEvidence.updateAutomation)}; ${trimSentence(edgeEvidence.browserSmoke)} |
| Firefox Desktop | AMO validation target, not a published listing | Firefox ${firefoxMin}+ MV3 | ${date} | ${firefoxEvidence} | \`sidePanel\`, \`offscreen\`, \`identity\` OAuth, and some \`userScripts.execute\` flows are unsupported/deferred; host grant/revoke diagnostics listen to permissions events; Firefox package omits Monaco until the Firefox editor-loading pass |
${firefoxAndroidRow}
| Brave / Vivaldi / Opera / Arc | Chromium derivative local-smoke targets | Chrome ${chromeMin}+ compatible package | ${derivativeLastVerification(derivativeEvidence)} | ${derivativeEvidenceText(derivativeEvidence)} | ${derivativeDeferredText(derivativeEvidence)} |
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
