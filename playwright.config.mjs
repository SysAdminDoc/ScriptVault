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
