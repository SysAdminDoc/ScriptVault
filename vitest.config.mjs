import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    fileParallelism: false,
    // The default Vitest worker_threads pool intermittently hits a
    // `@exodus/bytes` ESM-in-CJS load failure under jsdom and an
    // access-violation crash on the VMware shared drive. Every CLAUDE.md
    // verification block on this project runs `--pool=vmThreads
    // --maxWorkers=1` to dodge both failures. Default to the same shape so
    // CI and contributors don't have to remember the flags.
    pool: "vmThreads",
    // Vitest 4 moved per-pool config to top-level pool options.
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 60000,
    include: ["tests/**/*.test.{js,mjs}", "tests/**/*.spec.{js,mjs}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", "build/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/background/**/*.ts",
        "src/bg/**/*.ts",
        "src/modules/**/*.ts",
        "src/shared/**/*.ts",
        "src/storage/**/*.ts",
        "bg/*.js",
        "modules/*.js",
        "shared/*.js",
      ],
      exclude: ["src/config/**", "src/types/**", "lib/**", "node_modules/**"],
      thresholds: {
        lines: 10,
        functions: 10,
        branches: 5,
        statements: 10,
      },
    },
    // Mock chrome.* APIs that aren't available in jsdom
    setupFiles: ["tests/setup.js"],
  },
});
