import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
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
