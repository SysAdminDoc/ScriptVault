// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  BOOT_MESSAGE_BASKET,
  BOOT_THRESHOLDS,
  evaluateBootChecks,
  summarizeBootSamples,
} from '../scripts/smoke-service-worker-boot.mjs';

describe('service-worker cold-start gate', () => {
  it('summarizes p50/p95/p99 and preserves per-message baskets', () => {
    const summary = summarizeBootSamples([
      { message: 'getExtensionStatus', durationMs: 30 },
      { message: 'getExtensionStatus', durationMs: 10 },
      { message: 'getScripts', durationMs: 20 },
      { message: 'getSettings', durationMs: 40, error: 'timeout' },
    ]);

    expect(summary).toMatchObject({
      samples: 4,
      errors: 1,
      minMs: 10,
      p50Ms: 30,
      p99Ms: 40,
      maxMs: 40,
    });
    expect(summary.byMessage.getExtensionStatus).toMatchObject({ samples: 2, p50Ms: 30, p99Ms: 30 });
    expect(summary.byMessage.getScripts).toMatchObject({ samples: 1, p50Ms: 20 });
    expect(summary.byMessage.getSettings).toMatchObject({ samples: 1, errors: 1, p99Ms: 40 });
  });

  it('fails checks only when p99 or response errors exceed the documented budget', () => {
    const scenarios = [
      { name: 'fresh-profile', summary: { p99Ms: BOOT_THRESHOLDS.freshProfileP99Ms, errors: 0 } },
      { name: 'seeded-1k', summary: { p99Ms: BOOT_THRESHOLDS.seeded1kP99Ms + 1, errors: 0 } },
    ];
    const checks = evaluateBootChecks(scenarios);
    expect(checks.find(check => check.label === 'fresh-profile p99')).toMatchObject({ pass: true });
    expect(checks.find(check => check.label === 'seeded-1k p99')).toMatchObject({ pass: false });
    expect(checks).toHaveLength(4);
  });

  it('keeps a three-message basket so cold-start coverage includes status, library, and settings', () => {
    expect(BOOT_MESSAGE_BASKET.map(entry => entry.name)).toEqual([
      'getExtensionStatus',
      'getScripts',
      'getSettings',
    ]);
  });
});
