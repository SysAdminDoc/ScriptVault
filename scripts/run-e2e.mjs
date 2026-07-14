import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [mode = 'capability', ...playwrightArgs] = process.argv.slice(2);
if (!['capability', 'release'].includes(mode)) {
  console.error(`Usage: node scripts/run-e2e.mjs <capability|release> [playwright arguments]\nReceived: ${mode}`);
  process.exit(2);
}

const env = {
  ...process.env,
  SCRIPT_VAULT_E2E_MODE: mode,
};
const skipPolicy = mode === 'release' ? 'fail-closed' : 'capability-skips-allowed';
console.log(`[ScriptVault E2E] mode=${mode} channel=${env.SCRIPT_VAULT_PLAYWRIGHT_CHANNEL || 'chromium'} skipPolicy=${skipPolicy}`);

const cli = resolve('node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [cli, 'test', ...playwrightArgs], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[ScriptVault E2E] unable to start Playwright: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
