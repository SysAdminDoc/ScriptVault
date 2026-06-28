import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

describe("visual regression gate contract", () => {
  it("exposes visual regression as an explicit browser-mode command", () => {
    const packageJson = JSON.parse(read("package.json"));
    const visualConfig = read("vitest.visual.config.mjs");
    const defaultConfig = read("vitest.config.mjs");

    expect(packageJson.scripts["test:visual"]).toBe("vitest run --config vitest.visual.config.mjs");
    expect(packageJson.devDependencies["@vitest/browser"]).toBeTruthy();
    expect(packageJson.devDependencies["@vitest/browser-playwright"]).toBeTruthy();
    expect(visualConfig).toContain("provider: playwright({");
    expect(visualConfig).toContain("enabled: true");
    expect(visualConfig).toContain('browser: "chromium"');
    expect(visualConfig).toContain('host: "127.0.0.1"');
    expect(visualConfig).toContain("screenshotFailures: true");
    expect(defaultConfig).toContain('"tests/visual/**"');
  });

  it("pins a dashboard screenshot assertion and a checked-in baseline image", () => {
    const visualTest = read("tests/visual/dashboard-shell.visual.test.js");
    const screenshotDir = resolve(ROOT, "tests/visual/__screenshots__");
    const baselines = existsSync(screenshotDir)
      ? readdirSync(screenshotDir, { recursive: true }).filter((entry) => String(entry).endsWith(".png"))
      : [];

    expect(visualTest).toContain('toMatchScreenshot("dashboard-list-shell")');
    expect(visualTest).toContain("../../pages/dashboard.css");
    expect(baselines.length).toBeGreaterThan(0);
  });
});
