import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    include: ["tests/**/*.test.{js,mjs}", "tests/**/*.spec.{js,mjs}"],
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/shared/**/*.ts", "src/modules/**/*.ts", "src/bg/**/*.ts"],
      exclude: ["src/config/**", "src/types/**", "lib/**", "node_modules/**"],
    },
    // Mock chrome.* APIs that aren't available in jsdom
    setupFiles: ["tests/setup.js"],
  },
});
