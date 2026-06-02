#!/usr/bin/env node
/**
 * check-readme-claims.mjs
 *
 * CI gate that fails when README.md mentions a feature or module that does
 * not exist in the codebase. Pairs with docs/readme-feature-claim-checklist.md:
 * the checklist is the human-curated map, this script is the automated guard
 * against regressions.
 *
 * Checks performed:
 *
 *  1. **Deleted-module mentions** — fails if README marketing copy resurrects
 *     names of modules removed in v2.0.0 (per the project working notes "Deleted Modules"
 *     section). Catches the recurring README/code drift class.
 *
 *  2. **Cloud sync provider parity** — every provider name claimed in the
 *     README sync table or comparison table must be backed by a row in
 *     `modules/sync-providers.js` `CloudSyncProviders` OR a documented
 *     separate-module exception (Easy Cloud, GitHub Gist).
 *
 *  3. **Dashboard module file existence** — every `dashboard-*.js` filename
 *     mentioned in README.md must exist on disk under `pages/`.
 *
 * Exit codes:
 *   0 — every claim verified
 *   1 — at least one claim failed
 *
 * Flags:
 *   --json    machine-readable output
 *   --quiet   only print on failure
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const wantJson = args.has('--json');
const quiet = args.has('--quiet');

const README_PATH = join(repoRoot, 'README.md');
const SYNC_PROVIDERS_PATH = join(repoRoot, 'modules', 'sync-providers.js');
const PAGES_DIR = join(repoRoot, 'pages');

// Modules deleted in v2.0.0 per the project working notes. Catching their names in README
// marketing copy prevents the regression PASS2 NF-3 caught (README marketed
// AI Assistant / Performance Dashboard / Script Analytics / Onboarding Wizard
// long after the code was deleted).
const DELETED_MODULE_MARKETING = [
  // Each entry: { needle, why }. The needle is matched case-insensitively as
  // a substring; pick distinctive phrases so historical changelog mentions in
  // CHANGELOG.md or ROADMAP.md don't accidentally trip the gate.
  { needle: 'ai assistant', why: 'dashboard-ai.js was removed in v2.0.0 per the project working notes' },
  { needle: 'performance dashboard', why: 'dashboard-performance.js was removed in v2.0.0 per the project working notes' },
  { needle: 'script analytics', why: 'dashboard-analytics.js was removed in v2.0.0 per the project working notes' },
  { needle: 'onboarding wizard', why: 'dashboard-onboarding.js was removed in v2.0.0 per the project working notes' },
  { needle: 'ai-powered', why: 'no AI/LLM code currently ships in any dashboard module' },
];

// Sync providers documented as separate modules (not in CloudSyncProviders
// runtime registry, but real). Keep this allowlist in sync with the actual
// non-CloudSyncProviders sync surface.
const NON_REGISTRY_SYNC_PROVIDERS = new Set([
  'easy cloud',     // modules/sync-easycloud.js
  'github gist',    // pages/dashboard-gist.js
]);

// Provider names that should be considered marketing claims in README. The
// matcher will compare each against the runtime registry + the allowlist
// above. Add new entries here as the README evolves; the regex on the README
// also catches them via the provider-table parser below.
const KNOWN_PROVIDER_NAMES = [
  'webdav',
  'google drive',
  'dropbox',
  'onedrive',
  's3-compatible',
  's3',
  'easy cloud',
  'github gist',
];

/** Tokens that the README uses to introduce a provider table. */
const PROVIDER_TABLE_MARKER = /\|\s*Provider\s*\|\s*Method\s*\|/i;

function readReadme() {
  return readFileSync(README_PATH, 'utf8');
}

function extractRegistryProviders() {
  const src = readFileSync(SYNC_PROVIDERS_PATH, 'utf8');
  // Match `name: 'WebDAV'`, `name: 'Google Drive'`, etc. inside a property
  // block. The provider implementation file uses single-quoted name fields
  // exclusively.
  const matches = [...src.matchAll(/\bname:\s*'([^']+)'/g)];
  const names = new Set();
  for (const m of matches) {
    names.add(m[1].toLowerCase());
  }
  return names;
}

function findDashboardFileReferences(readme) {
  // Capture `dashboard-foo.js` filename mentions (with or without surrounding
  // backticks) so the gate can confirm the file still exists. Strip the path
  // qualifier — the README sometimes wraps the name in `pages/`.
  const matches = [...readme.matchAll(/(?:pages\/)?dashboard-[a-z0-9-]+\.js/g)];
  return Array.from(new Set(matches.map((m) => m[0].replace(/^pages\//, ''))));
}

function findClaimedProviders(readme) {
  // Look at every line inside or immediately after a provider-table marker,
  // plus the README comparison table cell that names every provider. We only
  // flag provider names from KNOWN_PROVIDER_NAMES to avoid false positives on
  // unrelated mentions like "OneDrive sync token".
  const lines = readme.split(/\r?\n/);
  const claimed = new Set();
  let inProviderTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (PROVIDER_TABLE_MARKER.test(line)) {
      inProviderTable = true;
      continue;
    }
    if (inProviderTable) {
      if (!line.startsWith('|')) {
        inProviderTable = false;
        continue;
      }
      // Split table row; first cell is the provider name. Skip the separator
      // row (`|---|---|`).
      const parts = line.split('|').map((s) => s.trim());
      if (parts.length >= 2 && parts[1] && !/^-+$/.test(parts[1])) {
        claimed.add(parts[1].toLowerCase());
      }
    }
  }
  // Also pick up any KNOWN_PROVIDER_NAMES mentioned in the comparison table
  // line `Cloud Sync (...)` which lists providers in parentheses.
  const compareLine = readme.match(/Cloud Sync \(([^)]+)\)/);
  if (compareLine) {
    for (const name of compareLine[1].split(',').map((s) => s.trim().toLowerCase())) {
      claimed.add(name);
    }
  }
  return claimed;
}

function check() {
  const readme = readReadme();
  const failures = [];

  // 1) Deleted-module marketing.
  for (const entry of DELETED_MODULE_MARKETING) {
    const idx = readme.toLowerCase().indexOf(entry.needle);
    if (idx === -1) continue;
    // Provide a short surrounding snippet so the reviewer can locate the
    // offending line without re-grepping the file by hand.
    const before = readme.slice(Math.max(0, idx - 40), idx);
    const after = readme.slice(idx, Math.min(readme.length, idx + 80));
    failures.push({
      check: 'deleted-module-marketing',
      needle: entry.needle,
      why: entry.why,
      snippet: (before + after).replace(/\s+/g, ' ').trim(),
    });
  }

  // 2) Cloud sync provider parity.
  // Match either an exact registry hit OR a substring overlap so the short
  // form "s3" in the comparison table matches the long form "s3-compatible"
  // in CloudSyncProviders without forcing a strict 1:1 string identity.
  const registry = extractRegistryProviders();
  const claimed = findClaimedProviders(readme);
  const providerMatches = (name) => {
    if (registry.has(name) || NON_REGISTRY_SYNC_PROVIDERS.has(name)) return true;
    for (const r of registry) {
      if (r === name) return true;
      if (r.startsWith(name + '-') || name.startsWith(r + '-')) return true;
    }
    return false;
  };
  for (const name of claimed) {
    if (!KNOWN_PROVIDER_NAMES.includes(name)) {
      // Probably a provider-table cell that isn't a provider name (e.g. the
      // header row leaks through if README structure changes). Skip rather
      // than fail to keep the gate focused on the regressions it catches.
      continue;
    }
    if (providerMatches(name)) continue;
    failures.push({
      check: 'sync-provider-claim',
      name,
      why: 'README claims a sync provider that is not in CloudSyncProviders or the documented non-registry list',
    });
  }

  // 3) Dashboard module file existence.
  for (const filename of findDashboardFileReferences(readme)) {
    const candidate = join(PAGES_DIR, filename);
    if (!existsSync(candidate)) {
      failures.push({
        check: 'missing-dashboard-module',
        filename,
        why: `README references ${filename} but pages/${filename} does not exist`,
      });
    }
  }

  return { failures, registryProviders: [...registry], claimedProviders: [...claimed] };
}

const { failures, registryProviders, claimedProviders } = check();

if (wantJson) {
  process.stdout.write(JSON.stringify({ failures, registryProviders, claimedProviders }, null, 2) + '\n');
} else if (failures.length === 0) {
  if (!quiet) {
    process.stdout.write(`README claim check: OK (${claimedProviders.length} provider claims, ${registryProviders.length} registry entries).\n`);
  }
} else {
  process.stdout.write(`README claim check failed with ${failures.length} issue(s):\n`);
  for (const f of failures) {
    process.stdout.write(`  - [${f.check}] ${f.why}\n`);
    if (f.needle) process.stdout.write(`    needle: ${f.needle}\n`);
    if (f.name) process.stdout.write(`    name: ${f.name}\n`);
    if (f.filename) process.stdout.write(`    file: ${f.filename}\n`);
    if (f.snippet) process.stdout.write(`    near: ...${f.snippet}...\n`);
  }
}

process.exit(failures.length === 0 ? 0 : 1);
