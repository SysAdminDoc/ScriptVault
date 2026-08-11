import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // Extension-load tests can leave a persistent context briefly settling after
  // a worker restart. Keep retries isolated so a failed context never shares
  // state with the retry or with the rest of the serial suite.
  retries: 1,
  retryStrategy: 'isolated',
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [['list']] : [['list']],
  metadata: {
    scriptVaultE2EMode: process.env.SCRIPT_VAULT_E2E_MODE || 'capability',
  },
  projects: [{
    name: `scriptvault-${process.env.SCRIPT_VAULT_E2E_MODE || 'capability'}`,
  }],
  use: {
    trace: 'retain-on-failure',
  },
});
