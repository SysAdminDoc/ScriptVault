import { describe, expect, it } from 'vitest';

import {
  evaluateFirefoxLintWarnings,
  summarizeFirefoxLintReport,
} from '../scripts/check-firefox-lint-warnings.mjs';

const reviewedCodes = { REVIEWED: 'Reviewed in test.' };
const reviewedFiles = new Set(['background.js']);

function warning(overrides = {}) {
  return { code: 'REVIEWED', file: 'background.js', ...overrides };
}

describe('Firefox lint warning budget', () => {
  it('summarizes warning codes and files deterministically', () => {
    expect(summarizeFirefoxLintReport({ warnings: [warning(), warning()] })).toEqual({
      total: 2,
      byCode: { REVIEWED: 2 },
      byFile: { 'background.js': 2 },
    });
  });

  it('passes a reviewed report at the warning ceiling', () => {
    const result = evaluateFirefoxLintWarnings(
      { warnings: [warning(), warning()] },
      { budget: 2, reviewedCodes, reviewedFiles },
    );
    expect(result.failures).toEqual([]);
  });

  it('rejects warning growth, new codes, and new warning files', () => {
    const result = evaluateFirefoxLintWarnings({
      warnings: [
        warning(),
        warning({ code: 'NEW_CODE', file: 'pages/new-surface.js' }),
      ],
    }, { budget: 1, reviewedCodes, reviewedFiles });

    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('Unreviewed warning code: NEW_CODE'),
      expect.stringContaining('Unreviewed warning file: pages/new-surface.js'),
      expect.stringContaining('Warning count 2 exceeds budget of 1'),
    ]));
  });
});
