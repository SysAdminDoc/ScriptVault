import { describe, expect, it } from 'vitest';
import {
  TELEMETRY_PACKAGES,
  TELEMETRY_INVOCATION_PATTERNS,
  findTelemetryPackages,
  findInvocationHits,
} from '../scripts/check-no-telemetry.mjs';

describe('no-telemetry gate', () => {
  it('tracks a non-trivial set of known telemetry SDK packages', () => {
    expect(TELEMETRY_PACKAGES).toContain('@sentry/browser');
    expect(TELEMETRY_PACKAGES).toContain('posthog-js');
    expect(TELEMETRY_INVOCATION_PATTERNS.length).toBeGreaterThan(5);
  });

  it('detects a telemetry SDK anywhere in the resolved tree, including transitive', () => {
    const lock = {
      packages: {
        'node_modules/vitest': { version: '4.1.9' },
        'node_modules/some-dep/node_modules/@sentry/browser': { version: '8.0.0' },
      },
    };
    expect(findTelemetryPackages(lock)).toEqual(['@sentry/browser']);
  });

  it('returns no package hits for a clean tree', () => {
    const lock = { packages: { 'node_modules/vitest': { version: '4.1.9' }, 'node_modules/acorn': { version: '8.17.0' } } };
    expect(findTelemetryPackages(lock)).toEqual([]);
  });

  it('flags telemetry-SDK invocation syntax', () => {
    expect(findInvocationHits('gtag("event", "x");')).not.toHaveLength(0);
    expect(findInvocationHits('Sentry.init({ dsn: "..." });')).not.toHaveLength(0);
    expect(findInvocationHits('mixpanel.track("evt");')).not.toHaveLength(0);
    expect(findInvocationHits('dataLayer.push({ e: 1 });')).not.toHaveLength(0);
  });

  it('does NOT flag tracker-detection blocklists or observation APIs (zero false positives)', () => {
    // A tracker-blocking userscript template lists domains — not telemetry.
    expect(findInvocationHits("const blockedDomains = ['google-analytics.com', 'doubleclick.net'];")).toEqual([]);
    // The AST analyzer / netlog reference sendBeacon by API name to detect/observe it.
    expect(findInvocationHits('match: node => isMember(node.callee, "navigator", "sendBeacon")')).toEqual([]);
    expect(findInvocationHits('const _origBeacon = navigator.sendBeacon.bind(navigator);')).toEqual([]);
  });
});
