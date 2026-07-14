const E2E_MODE = process.env.SCRIPT_VAULT_E2E_MODE || 'capability';

if (!['capability', 'release'].includes(E2E_MODE)) {
  throw new Error(`Unsupported SCRIPT_VAULT_E2E_MODE: ${E2E_MODE}`);
}

export function isReleaseE2EMode() {
  return E2E_MODE === 'release';
}

export function failReleaseIfUnsupported(supported, reason, evidence = {}) {
  if (supported || !isReleaseE2EMode()) return;
  throw new Error([
    '[ScriptVault release E2E] Required capability is unavailable; release proof failed closed.',
    `Reason: ${reason}`,
    `Evidence: ${JSON.stringify(evidence)}`,
    'Use `npm run test:e2e` for the explicitly skip-capable non-release report.',
  ].join('\n'));
}

export function e2eMode() {
  return E2E_MODE;
}
