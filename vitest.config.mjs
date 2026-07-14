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
    exclude: ["tests/e2e/**", "tests/visual/**", "node_modules/**", "dist/**", "build/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      include: [
        "src/background/**/*.ts",
        "src/bg/**/*.ts",
        "src/modules/**/*.ts",
        "src/shared/**/*.ts",
        "src/storage/**/*.ts",
      ],
      exclude: ["src/config/**", "src/types/**", "lib/**", "node_modules/**"],
      thresholds: {
        // Generated runtime modules are behavior-tested but no longer counted a
        // second time beside their authoritative TypeScript sources. These
        // aggregate floors are the rebased source-only baseline.
        lines: 43,
        functions: 47,
        branches: 32,
        statements: 41,
        "src/background/cloud-sync.ts": { branches: 77 },
        "src/background/update-checker.ts": { branches: 63 },
        "src/background/user-script-message-policy.ts": { branches: 88 },
        "src/background/wrapper-builder.ts": { branches: 57 },
        "src/modules/migration.ts": { branches: 80 },
      },
    },
    // Mock chrome.* APIs that aren't available in jsdom
    setupFiles: ["tests/setup.js"],
    browser: {
      enabled: false,
      api: { host: "127.0.0.1" },
    },
  },
  server: {
    host: "127.0.0.1",
    strictPort: true,
  },
});
