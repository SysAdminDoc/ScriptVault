import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/visual/**/*.test.{js,mjs}"],
    fileParallelism: false,
    testTimeout: 60000,
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          headless: true,
        },
      }),
      headless: true,
      viewport: {
        width: 1100,
        height: 720,
      },
      screenshotFailures: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
      api: {
        host: "127.0.0.1",
      },
      expect: {
        toMatchScreenshot: {
          comparatorName: "pixelmatch",
          comparatorOptions: {
            allowedMismatchedPixelRatio: 0.002,
            threshold: 0.1,
          },
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    strictPort: true,
  },
});
