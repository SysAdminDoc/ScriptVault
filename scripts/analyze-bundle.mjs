/**
 * ScriptVault — Bundle size analysis
 *
 * Reports per-module line counts and byte sizes for background.js.
 * Run: npm run build:analyze
 */

import { readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname || ".");
const bgPath = join(ROOT, "..", "background.js");

if (!existsSync(bgPath)) {
  console.error("background.js not found. Run `npm run build` first.");
  process.exit(1);
}

const code = readFileSync(bgPath, "utf-8");
const lines = code.split("\n");
const bytes = statSync(bgPath).size;

const sectionPattern =
  /^\/\/ ={10,}\s*$|^\/\/ ScriptVault v|^\/\/ END INLINED|^const SCRIPTVAULT_SETTINGS_DEFAULTS/;
const modulePattern =
  /^\/\/ ={10,}\s*$|^\/\/ -{10,}\s*$|^(?:var |const |let |function |class )\w/;

const sections = [];
let currentLabel = "banner";
let currentStart = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (sectionPattern.test(line) && i > 0) {
    sections.push({ label: currentLabel, start: currentStart, end: i });
    const comment = line.replace(/^\/\/\s*=+\s*/, "").replace(/\s*=+\s*$/, "").trim();
    currentLabel = comment || `section-${sections.length + 1}`;
    currentStart = i;
  }
}
sections.push({ label: currentLabel, start: currentStart, end: lines.length });

const sourceModules = [
  "shared/utils.js",
  "lib/fflate.js",
  "modules/sync-providers.js",
  "modules/i18n.js",
  "modules/storage.js",
  "modules/xhr.js",
  "modules/internal-host-guard.js",
  "modules/user-script-message-policy.js",
  "modules/message-router.js",
  "modules/gm-audio-handler.js",
  "modules/gm-menu-handler.js",
  "modules/gm-tabs-handler.js",
  "modules/gm-values-handler.js",
  "modules/gm-notification-handler.js",
  "modules/gm-resource-handler.js",
  "modules/gm-webrequest-handler.js",
  "modules/gm-cookie-handler.js",
  "modules/gm-network-handler.js",
  "modules/connect-policy.js",
  "modules/resources.js",
  "modules/npm-resolve.js",
  "modules/host-permission-patterns.js",
  "modules/error-log.js",
  "modules/event-log.js",
  "modules/notifications.js",
  "modules/sync-crypto.js",
  "modules/sync-easycloud.js",
  "modules/script-config.js",
  "modules/backup-scheduler.js",
  "modules/userstyles.js",
  "modules/public-api.js",
  "modules/migration.js",
  "modules/quota-manager.js",
  "modules/subscriptions.js",
  "modules/sigstore-bundle-parser.js",
  "modules/sigstore-bundle-verifier.js",
  "bg/analyzer.js",
  "bg/netlog.js",
  "bg/signing.js",
  "bg/workspaces.js",
  "background.core.js",
];

const report = [];
let totalSourceLines = 0;

for (const mod of sourceModules) {
  const modPath = join(ROOT, "..", mod);
  if (!existsSync(modPath)) continue;
  const modCode = readFileSync(modPath, "utf-8");
  const modLines = modCode.split("\n").length;
  const modBytes = statSync(modPath).size;
  totalSourceLines += modLines;
  report.push({
    module: mod,
    lines: modLines,
    bytes: modBytes,
    pct: 0,
  });
}

for (const r of report) {
  r.pct = ((r.lines / totalSourceLines) * 100).toFixed(1);
}

report.sort((a, b) => b.lines - a.lines);

console.log("\nScriptVault Bundle Analysis");
console.log("=".repeat(70));
console.log(`background.js: ${lines.length.toLocaleString()} lines, ${(bytes / 1024).toFixed(0)} KB`);
console.log("");
console.log("Module".padEnd(42) + "Lines".padStart(8) + "KB".padStart(8) + "%".padStart(7));
console.log("-".repeat(65));

for (const r of report) {
  console.log(
    r.module.padEnd(42) +
      r.lines.toLocaleString().padStart(8) +
      (r.bytes / 1024).toFixed(1).padStart(8) +
      (r.pct + "%").padStart(7)
  );
}

console.log("-".repeat(65));
console.log(
  "Total source modules".padEnd(42) +
    totalSourceLines.toLocaleString().padStart(8) +
    "".padStart(8) +
    "100.0%".padStart(7)
);
console.log("");

if (process.argv.includes("--json")) {
  const json = {
    bundle: { file: "background.js", lines: lines.length, bytes },
    modules: report,
    totalSourceLines,
  };
  console.log(JSON.stringify(json, null, 2));
}
