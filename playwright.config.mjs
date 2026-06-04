import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [['list']] : [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
