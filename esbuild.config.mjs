/**
 * ScriptVault — esbuild build configuration
 *
 * Replaces build-background.sh with a cross-platform Node.js build.
 * Concatenates background source modules in the correct dependency order
 * and optionally copies Monaco editor files for local bundling.
 *
 * Usage:
 *   node esbuild.config.mjs            # full build (background + monaco)
 *   node esbuild.config.mjs --bg-only  # background.js only
 *   node esbuild.config.mjs --monaco-only  # copy monaco only
 *   node esbuild.config.mjs --watch    # rebuild background.js on changes
 *   node esbuild.config.mjs --prod     # minified production build
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { context, build } from "esbuild";

const ROOT = resolve(import.meta.dirname || ".");
const args = process.argv.slice(2);

const bgOnly = args.includes("--bg-only");
const monacoOnly = args.includes("--monaco-only");
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
  console.log(`Building background.js v${version}${production ? " (production)" : ""}...`);

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
    readFile("modules/resources.js"),

    // v2.0 modules (conditionally included if they exist)
    ...["npm-resolve", "error-log", "notifications", "sync-easycloud",
        "backup-scheduler", "userstyles", "public-api", "migration", "quota-manager"]
      .map(m => { try { return readFile(`modules/${m}.js`); } catch { return ""; } })
      .filter(Boolean),

    // bg/*.js — alphabetical order
    ...jsFilesIn("bg").map((f) => readFile(f)),

    readFile("background.core.js"),
  ];

  let code = parts.join(separator);

  if (production) {
    // Use esbuild to minify the concatenated bundle
    const result = await build({
      stdin: { contents: code, loader: "js" },
      write: false,
      minify: true,
      target: "chrome120",
      format: "iife",
    });
    code = result.outputFiles[0].text;
  }

  const outPath = join(ROOT, "background.js");
  writeFileSync(outPath, code, "utf-8");
  const lines = code.split("\n").length;
  console.log(`Done: background.js (${lines} lines)`);
}

// ---------------------------------------------------------------------------
// Copy Monaco editor from node_modules to lib/monaco
// ---------------------------------------------------------------------------

function copyMonaco() {
  const src = join(ROOT, "node_modules", "monaco-editor", "min");
  const dest = join(ROOT, "lib", "monaco");

  if (!existsSync(src)) {
    console.warn("Warning: monaco-editor not found in node_modules. Run `npm install` first.");
    return;
  }

  console.log("Copying Monaco editor to lib/monaco/...");
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
  console.log("Done: lib/monaco/ updated.");
}

// ---------------------------------------------------------------------------
// Watch mode
// ---------------------------------------------------------------------------

async function startWatch() {
  const version = readVersion();
  console.log(`Watching for changes (v${version})...`);

  // Directories to watch for changes
  const watchDirs = ["shared", "modules", "lib", "bg"];
  const watchFiles = ["background.core.js", "manifest.json"];

  // Use esbuild's context for efficient rebuilds via a dummy entrypoint
  // that triggers our concat build
  const ctx = await context({
    entryPoints: [],
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "scriptvault-watch",
        setup(pluginBuild) {
          // Watch source files for changes
          pluginBuild.onStart(() => {
            buildBackground().catch(console.error);
          });
        },
      },
    ],
  });

  // We do a manual FS poll approach since we are concatenating, not bundling
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

  if (watchMode) {
    await startWatch();
    return;
  }

  if (!monacoOnly) {
    await buildBackground();
  }

  if (!bgOnly) {
    copyMonaco();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
