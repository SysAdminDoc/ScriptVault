// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["pages", "src", "modules"];
const SOURCE_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".ts", ".tsx"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "lib" || entry.name === "node_modules") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    const dot = entry.name.lastIndexOf(".");
    const ext = dot >= 0 ? entry.name.slice(dot) : "";
    if (SOURCE_EXTENSIONS.has(ext)) files.push(fullPath);
  }
  return files;
}

function sourceFiles() {
  return SOURCE_DIRS.flatMap((dir) => walk(resolve(ROOT, dir)))
    .sort((a, b) => a.localeCompare(b));
}

function collectMatches(regex) {
  const failures = [];
  for (const file of sourceFiles()) {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (regex.test(line)) failures.push(`${rel}:${index + 1}: ${line.trim()}`);
      regex.lastIndex = 0;
    });
  }
  return failures;
}

describe("relative font-size units", () => {
  test("source-owned shipped CSS does not use px font sizes", () => {
    const failures = [
      ...collectMatches(/\bfont-size\s*:\s*[^;\n}]*\b\d+(?:\.\d+)?px\b/i),
      ...collectMatches(/(^|[^-\w])font\s*:\s*[^;\n}]*\b\d+(?:\.\d+)?px\b/i),
      ...collectMatches(/--base-font\s*:\s*\d+(?:\.\d+)?px\b/i),
    ];

    expect(failures).toEqual([]);
  });

  test("responsive media-query width breakpoints use rem units", () => {
    expect(collectMatches(/@media[^{]*\(\s*(?:min|max)-width\s*:\s*\d+(?:\.\d+)?px\b/i)).toEqual([]);
  });

  test("dashboard UI zoom is applied at the root font-size", () => {
    const html = readFileSync(resolve(ROOT, "pages/dashboard.html"), "utf8");
    const dashboard = readFileSync(resolve(ROOT, "pages/dashboard.js"), "utf8");

    expect(html).toContain("--base-font: 100%;");
    expect(html).toContain("font-size: var(--base-font);");
    expect(html).toContain('[data-ui-scale="0.85"] { --ui-scale: 0.85; --base-font: 85%; }');
    expect(html).toContain('[data-ui-scale="1.5"]  { --ui-scale: 1.5;   --base-font: 150%; }');
    expect(html).toContain("font-size: 0.8125rem;");
    expect(dashboard).not.toContain("root.style.fontSize");
  });
});
