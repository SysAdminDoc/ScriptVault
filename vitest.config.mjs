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
      include: ["shared/**", "modules/**", "bg/**"],
      exclude: ["lib/**", "node_modules/**"],
    },
    // Mock chrome.* APIs that aren't available in jsdom
    setupFiles: ["tests/setup.js"],
  },
});
