#!/usr/bin/env node
// Permission-drift gate.
//
// Pins the exact permission / optional-permission / host-permission surface of
// every shipped manifest. The build FAILS if a manifest declares anything
// outside the pinned allowlist. This defends against the 2026 CWS ownership-
// transfer / permission-creep attack class (QuickLens, ShotBird), where a new
// owner silently widens `permissions` / `host_permissions` in an update.
//
// Growth requires a deliberate edit to the PINNED sets below (and review),
// which is exactly the friction we want. `store-copy:check` separately verifies
// each pinned permission is DISCLOSED; this gate verifies none are ADDED.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

// The pinned, reviewed permission surface. Adding a permission/host here is a
// conscious, reviewable act — never let a manifest grow past this without it.
export const PINNED = {
  'manifest.json': {
    permissions: [
      'storage', 'tabs', 'notifications', 'contextMenus', 'scripting',
      'userScripts', 'webNavigation', 'unlimitedStorage', 'alarms',
      'declarativeNetRequest', 'declarativeNetRequestWithHostAccess',
      'sidePanel', 'offscreen',
    ],
    optional_permissions: ['clipboardWrite', 'clipboardRead', 'identity', 'cookies', 'downloads'],
    host_permissions: ['<all_urls>'],
    optional_host_permissions: [],
  },
  'manifest-firefox.json': {
    permissions: [
      'storage', 'tabs', 'notifications', 'menus', 'scripting',
      'webNavigation', 'unlimitedStorage', 'alarms',
      'declarativeNetRequest', 'declarativeNetRequestWithHostAccess',
    ],
    optional_permissions: ['userScripts', 'clipboardWrite', 'clipboardRead', 'cookies', 'downloads'],
    host_permissions: ['<all_urls>'],
    optional_host_permissions: [],
  },
};

const FIELDS = ['permissions', 'optional_permissions', 'host_permissions', 'optional_host_permissions'];

// Returns an array of violation strings for a single manifest object.
export function findDrift(manifestName, manifestObj) {
  const pinned = PINNED[manifestName];
  const violations = [];
  if (!pinned) {
    violations.push(`${manifestName}: no pinned permission allowlist defined`);
    return violations;
  }
  for (const field of FIELDS) {
    const declared = Array.isArray(manifestObj?.[field]) ? manifestObj[field] : [];
    const allowed = new Set(pinned[field] || []);
    for (const entry of declared) {
      if (!allowed.has(entry)) {
        violations.push(`${manifestName}: ${field} declares unpinned entry "${entry}" — add it to PINNED (with review) or remove it`);
      }
    }
  }
  return violations;
}

export function checkAllManifests(readJson = (name) => JSON.parse(readFileSync(join(projectRoot, name), 'utf8'))) {
  const violations = [];
  for (const manifestName of Object.keys(PINNED)) {
    violations.push(...findDrift(manifestName, readJson(manifestName)));
  }
  return { ok: violations.length === 0, violations };
}

// Run as a CLI (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok, violations } = checkAllManifests();
  if (!ok) {
    console.error('[permission-drift] FAILED — manifest permission surface grew beyond the pinned allowlist:');
    for (const v of violations) console.error('  - ' + v);
    console.error('\nIf this growth is intentional, add the entry to PINNED in scripts/check-permission-drift.mjs');
    console.error('and to the disclosure copy checked by `npm run store-copy:check`.');
    process.exit(1);
  }
  console.log('[permission-drift] ok: all manifest permissions are within the pinned allowlist');
}
