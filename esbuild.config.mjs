/**
 * ScriptVault — esbuild build configuration
 *
 * Replaces build-background.sh with a cross-platform Node.js build.
 * Concatenates background source modules in the correct dependency order
 * and optionally builds Monaco editor files for local bundling.
 *
 * Usage:
 *   node esbuild.config.mjs            # full build (background + Monaco ESM)
 *   node esbuild.config.mjs --bg-only  # background.js only
 *   node esbuild.config.mjs --monaco-esm-only  # build Monaco ESM only
 *   node esbuild.config.mjs --watch    # rebuild background.js on changes
 *   node esbuild.config.mjs --prod     # minified production build
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { generateGmTypes } from "./scripts/generate-gm-types.mjs";
import { generateTsRuntimeModules } from "./scripts/generate-ts-runtime-modules.mjs";

const ROOT = resolve(import.meta.dirname || ".");
const args = process.argv.slice(2);

const bgOnly = args.includes("--bg-only");
const monacoEsmOnly = args.includes("--monaco-esm-only") || args.includes("--monaco-only");
const watchMode = args.includes("--watch");
const production = args.includes("--prod");
const typeCheck = args.includes("--typecheck");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readVersion() {
  const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf-8"));
  return manifest.version;
}

function readFile(rel) {
  return readFileSync(join(ROOT, rel), "utf-8");
}

function readJson(rel) {
  return JSON.parse(readFile(rel));
}

/**
 * Return sorted .js filenames inside a directory (alphabetical, matching
 * the glob expansion order used by the original bash build).
 */
function jsFilesIn(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => `${dir}/${f}`);
}

// ---------------------------------------------------------------------------
// Build background.js — concatenation approach
// ---------------------------------------------------------------------------

async function buildBackground() {
  const version = readVersion();
  const settingsDefaults = readJson("src/config/settings-defaults.json");
  console.log(`Building background.js v${version}${production ? " (production)" : ""}...`);
  await generateTsRuntimeModules({ rootDir: ROOT });
  await generateGmTypes({ rootDir: ROOT });

  const separator = "\n";

  // Ordered list — matches build-background.sh exactly
  const parts = [
    // Banner
    [
      `// ScriptVault v${version} - Background Service Worker`,
      "// Comprehensive userscript manager with cloud sync and auto-updates",
      "// NOTE: This file is built from source modules. Edit the individual files in",
      "// shared/, modules/, and lib/, then run `npm run build` to regenerate.",
      "",
    ].join("\n"),

    readFile("shared/utils.js"),
    [
      "// ============================================================================",
      "// SHARED SETTINGS DEFAULTS",
      "// Generated from src/config/settings-defaults.json",
      "// ============================================================================",
      `const SCRIPTVAULT_SETTINGS_DEFAULTS = ${JSON.stringify(settingsDefaults, null, 2)};`,
      "",
    ].join("\n"),
    readFile("lib/fflate.js"),
    readFile("modules/sync-providers.js"),
    readFile("modules/i18n.js"),

    [
      "// ============================================================================",
      "// END INLINED MODULES",
      "// ============================================================================",
      "",
    ].join("\n"),

    readFile("modules/storage.js"),
    readFile("modules/xhr.js"),
    readFile("modules/internal-host-guard.js"),
    readFile("modules/user-script-message-policy.js"),
    readFile("modules/message-router.js"),
    readFile("modules/gm-audio-handler.js"),
    readFile("modules/gm-menu-handler.js"),
    readFile("modules/gm-tabs-handler.js"),
    readFile("modules/gm-values-handler.js"),
    readFile("modules/gm-notification-handler.js"),
    readFile("modules/gm-resource-handler.js"),
    readFile("modules/gm-webrequest-handler.js"),
    readFile("modules/gm-cookie-handler.js"),
    readFile("modules/gm-network-handler.js"),
    readFile("modules/connect-policy.js"),
    readFile("modules/resources.js"),

    // v2.0 modules (conditionally included if they exist)
    ...["npm-resolve", "host-permission-patterns", "error-log", "event-log", "notifications", "sync-crypto", "sync-easycloud",
        "script-config", "backup-scheduler", "userstyles", "public-api", "migration", "quota-manager",
        "subscriptions", "sigstore-bundle-parser", "sigstore-bundle-verifier"]
      .map(m => { try { return readFile(`modules/${m}.js`); } catch { return ""; } })
      .filter(Boolean),

    // bg/*.js — alphabetical order
    ...jsFilesIn("bg").map((f) => readFile(f)),

    readFile("background.core.js"),
  ];

  let code = parts.join(separator);

  const outPath = join(ROOT, "background.js");

  if (production) {
    const result = await build({
      stdin: { contents: code, loader: "ts", sourcefile: "background.js" },
      write: false,
      minify: true,
      sourcemap: true,
      target: "chrome120",
      format: "iife",
    });
    const paths = result.outputFiles.map((f) => f.path);
    const jsFile = result.outputFiles.find((f) => !f.path.endsWith(".map"));
    const mapFile = result.outputFiles.find((f) => f.path.endsWith(".map"));
    code = jsFile ? jsFile.text : result.outputFiles[0].text;
    if (mapFile) {
      writeFileSync(join(ROOT, "background.js.map"), mapFile.text, "utf-8");
      console.log("Source map: background.js.map");
    } else if (result.outputFiles.length === 1 && code.includes("//# sourceMappingURL=data:")) {
      const dataIdx = code.indexOf("//# sourceMappingURL=data:application/json;base64,");
      if (dataIdx !== -1) {
        const b64 = code.slice(dataIdx + "//# sourceMappingURL=data:application/json;base64,".length).trim();
        const mapJson = Buffer.from(b64, "base64").toString("utf-8");
        writeFileSync(join(ROOT, "background.js.map"), mapJson, "utf-8");
        code = code.slice(0, dataIdx) + `//# sourceMappingURL=background.js.map\n`;
        console.log("Source map: background.js.map (extracted from inline)");
      }
    }
  }

  writeFileSync(outPath, code, "utf-8");
  const lines = code.split("\n").length;
  console.log(`Done: background.js (${lines} lines)`);
}

// ---------------------------------------------------------------------------
// Build Monaco ESM assets
// ---------------------------------------------------------------------------

async function buildMonacoEsm() {
  const monacoEsmOutDir = join(ROOT, "lib", "monaco-esm");
  const workersDir = join(monacoEsmOutDir, "workers");
  const commonOptions = {
    bundle: true,
    target: "chrome120",
    define: { "process.env.NODE_ENV": production ? '"production"' : '"development"' },
    loader: { ".ttf": "file" },
    assetNames: "assets/[name]-[hash]",
    minify: production,
    logLevel: "silent",
  };

  console.log("Building Monaco ESM assets to lib/monaco-esm/...");
  rmSync(monacoEsmOutDir, { recursive: true, force: true });
  mkdirSync(workersDir, { recursive: true });

  await build({
    ...commonOptions,
    entryPoints: [join(ROOT, "src", "editor", "monaco-esm-entry.ts")],
    outfile: join(monacoEsmOutDir, "editor.js"),
    format: "esm",
  });

  await build({
    ...commonOptions,
    entryPoints: {
      "editor.worker": join(ROOT, "node_modules", "monaco-editor", "esm", "vs", "editor", "editor.worker.js"),
      "json.worker": join(ROOT, "node_modules", "monaco-editor", "esm", "vs", "language", "json", "json.worker.js"),
      "css.worker": join(ROOT, "node_modules", "monaco-editor", "esm", "vs", "language", "css", "css.worker.js"),
      "html.worker": join(ROOT, "node_modules", "monaco-editor", "esm", "vs", "language", "html", "html.worker.js"),
      "ts.worker": join(ROOT, "node_modules", "monaco-editor", "esm", "vs", "language", "typescript", "ts.worker.js"),
    },
    outdir: workersDir,
    format: "iife",
  });

  console.log("Done: lib/monaco-esm/editor.js and worker files updated.");
}

// ---------------------------------------------------------------------------
// Watch mode
// ---------------------------------------------------------------------------

async function startWatch() {
  const version = readVersion();
  const withTypeCheck = args.includes("--typecheck");
  console.log(`Watching for changes (v${version})${withTypeCheck ? " + tsc" : ""}...`);

  // Directories to watch for changes
  const watchDirs = ["shared", "modules", "lib", "bg", "src"];
  const watchFiles = ["background.core.js", "manifest.json"];

  // Manual FS watch approach since we are concatenating source files,
  // not bundling through esbuild. (A previous revision also spawned an
  // unused esbuild context here which leaked a child process.)
  const { watch: fsWatch } = await import("node:fs");
  const rebuild = debounce(() => {
    buildBackground().catch(console.error);
  }, 200);

  for (const dir of watchDirs) {
    const abs = join(ROOT, dir);
    if (existsSync(abs)) {
      fsWatch(abs, { recursive: true }, rebuild);
    }
  }
  for (const file of watchFiles) {
    const abs = join(ROOT, file);
    if (existsSync(abs)) {
      fsWatch(abs, rebuild);
    }
  }

  if (withTypeCheck) {
    const { spawn } = await import("node:child_process");
    const tsc = spawn("npx", ["tsc", "--watch", "--noEmit", "--preserveWatchOutput"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    process.on("exit", () => tsc.kill());
  }

  // Initial build
  await buildBackground();
  console.log("Watching for changes. Press Ctrl+C to stop.");
}

function debounce(fn, ms) {
  let timer;
  return (...a) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...a), ms);
  };
}

// ---------------------------------------------------------------------------
// TypeScript type-check (runs tsc --noEmit)
// ---------------------------------------------------------------------------

async function runTypeCheck() {
  const { execSync } = await import("node:child_process");
  console.log("Running TypeScript type-check...");
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "inherit" });
    console.log("Type-check passed.");
  } catch {
    console.error("Type-check failed.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (typeCheck) {
    await runTypeCheck();
  }

  if (monacoEsmOnly) {
    await buildMonacoEsm();
    return;
  }

  if (watchMode) {
    await startWatch();
    return;
  }

  await buildBackground();

  if (!bgOnly) {
    await buildMonacoEsm();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
