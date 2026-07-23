#!/usr/bin/env node
// CWS Limited-Use / zero-telemetry gate.
//
// ScriptVault's single purpose does not include data collection. Chrome Web
// Store Limited-Use + data-disclosure enforcement (2026-08-01) requires that no
// undisclosed collection is introduced. This gate fails the build if a
// third-party analytics/telemetry SDK enters the dependency tree or if
// telemetry-SDK invocation syntax appears in the extension's own runtime source.
//
// It deliberately does NOT flag references to tracker *domains* or the
// `sendBeacon`/`fetch` APIs: ScriptVault legitimately ships tracker-blocking
// userscript templates, an AST analyzer that *detects* tracking, and a netlog
// proxy that *observes* page network calls. The gate targets first-party
// phone-home vectors — an added SDK package, or SDK call syntax — which those
// legitimate features never contain.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Packages whose presence anywhere in the resolved tree means a telemetry SDK
// was pulled in.
export const TELEMETRY_PACKAGES = [
  '@sentry/browser', '@sentry/node', '@sentry/core', 'mixpanel', 'mixpanel-browser',
  'analytics-node', '@amplitude/analytics-browser', 'amplitude-js', 'posthog-js',
  'posthog-node', '@datadog/browser-rum', '@datadog/browser-logs', 'hotjar',
  'react-ga', 'react-ga4', 'segment-analytics', '@segment/analytics-next',
  'google-analytics', 'universal-analytics', '@vercel/analytics', 'logrocket',
  'fullstory', '@fullstory/browser', 'bugsnag-js', '@bugsnag/js',
];

// SDK invocation syntax that only appears when code actively sends telemetry.
// (Domain strings and bare API names are intentionally excluded — see header.)
export const TELEMETRY_INVOCATION_PATTERNS = [
  /\bgtag\s*\(/,
  /\bmixpanel\s*\.\s*(track|identify|init)\b/,
  /\bSentry\s*\.\s*(init|captureException|captureMessage)\b/,
  /\bamplitude\s*\.\s*(getInstance|track|logEvent)\b/,
  /\bposthog\s*\.\s*(init|capture)\b/,
  /\banalytics\s*\.\s*(track|page|identify)\s*\(/,
  /\bdataLayer\s*\.\s*push\s*\(/,
  /\bnew\s+Amplitude\b/,
  /\bLogRocket\s*\.\s*init\b/,
  /\bFS\s*\.\s*(identify|event)\s*\(/,
];

const SCAN_FILES = ['content.js', 'offscreen.js', 'background.js', 'background.core.js'];
const SCAN_DIRS = ['src', 'pages', 'modules', 'bg', 'shared'];
const SCAN_EXTS = new Set(['.js', '.ts', '.mjs']);

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (SCAN_EXTS.has(extname(name))) acc.push(full);
  }
}

export function findTelemetryPackages(lock) {
  const hits = new Set();
  const packages = lock.packages || {};
  for (const path of Object.keys(packages)) {
    const m = path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)$/);
    if (m && TELEMETRY_PACKAGES.includes(m[1])) hits.add(m[1]);
  }
  const walkDeps = (deps) => {
    for (const [name, meta] of Object.entries(deps || {})) {
      if (TELEMETRY_PACKAGES.includes(name)) hits.add(name);
      if (meta && meta.dependencies) walkDeps(meta.dependencies);
    }
  };
  walkDeps(lock.dependencies);
  return [...hits];
}

export function findInvocationHits(text) {
  return TELEMETRY_INVOCATION_PATTERNS.filter(re => re.test(text)).map(re => re.source);
}

function main() {
  const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
  const failures = [];

  // 1. No runtime dependencies at all (zero-runtime-dep posture).
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  const runtimeDeps = Object.keys(pkg.dependencies || {});
  if (runtimeDeps.length > 0) {
    failures.push(`package.json declares runtime dependencies (${runtimeDeps.join(', ')}); ScriptVault ships zero runtime deps.`);
  }

  // 2. No telemetry SDK anywhere in the resolved tree.
  const lockPath = resolve(ROOT, 'package-lock.json');
  if (existsSync(lockPath)) {
    const pkgs = findTelemetryPackages(JSON.parse(readFileSync(lockPath, 'utf8')));
    for (const name of pkgs) failures.push(`telemetry SDK "${name}" is present in the dependency tree.`);
  }

  // 3. No telemetry-SDK invocation syntax in first-party runtime source.
  const files = [];
  for (const f of SCAN_FILES) { const p = resolve(ROOT, f); if (existsSync(p)) files.push(p); }
  for (const d of SCAN_DIRS) { const p = resolve(ROOT, d); if (existsSync(p)) walk(p, files); }
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const src of findInvocationHits(text)) {
      failures.push(`telemetry invocation /${src}/ found in ${file.slice(ROOT.length + 1)}`);
    }
  }

  if (failures.length > 0) {
    console.error('[no-telemetry] FAIL — potential data-collection surface introduced:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`[no-telemetry] ok — zero runtime deps, no telemetry SDK, no telemetry invocations across ${files.length} runtime files.`);
}

if (process.argv[1]?.endsWith('check-no-telemetry.mjs')) main();
