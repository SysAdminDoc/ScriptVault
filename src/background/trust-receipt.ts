import type {
  Script,
  ScriptMeta,
  ScriptTrustReceipt,
  ScriptTrustReceiptDependency,
  ScriptTrustReceiptDependencyChange,
  ScriptTrustReceiptPermissionChangeSet,
} from '../types/script';
import { verifySigstoreMessageSignature } from '../modules/sigstore-bundle-verifier';
import { hasVerifiableRequireIntegrity } from './resource-loader';

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function lineCount(code: string): number {
  if (!code) return 0;
  return code.split(/\r\n|\r|\n/).length;
}

function summarizeLineDiff(previousCode: string, nextCode: string) {
  const previousLines = previousCode ? previousCode.split(/\r\n|\r|\n/) : [];
  const nextLines = nextCode ? nextCode.split(/\r\n|\r|\n/) : [];
  const previousCounts = new Map<string, number>();
  for (const line of previousLines) {
    previousCounts.set(line, (previousCounts.get(line) || 0) + 1);
  }
  let unchangedLines = 0;
  for (const line of nextLines) {
    const count = previousCounts.get(line) || 0;
    if (count > 0) {
      unchangedLines += 1;
      if (count === 1) previousCounts.delete(line);
      else previousCounts.set(line, count - 1);
    }
  }
  return {
    previousLines: previousLines.length,
    nextLines: nextLines.length,
    addedLines: Math.max(0, nextLines.length - unchangedLines),
    removedLines: Math.max(0, previousLines.length - unchangedLines),
  };
}

function diffStringList(previous: string[], next: string[]): ScriptTrustReceiptPermissionChangeSet {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    added: next.filter((value) => !previousSet.has(value)),
    removed: previous.filter((value) => !nextSet.has(value)),
    unchanged: next.filter((value) => previousSet.has(value)),
  };
}

function getKnownDependencySnapshots(previousScript: Script | null): Map<string, ScriptTrustReceiptDependency> {
  const map = new Map<string, ScriptTrustReceiptDependency>();
  const deps = previousScript?.trustReceipt?.dependencies?.require ?? [];
  for (const dep of deps) {
    if (dep.url) map.set(dep.url, dep);
  }
  return map;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Dependency body unavailable';
}

async function buildDependencyProvenance(
  bundleUrl = '',
  identity = '',
  body = '',
  fetchProvenanceBundle?: (url: string) => Promise<string | null | undefined>,
): Promise<ScriptTrustReceiptDependency['provenance'] | undefined> {
  if (!bundleUrl && !identity) return undefined;
  const base: ScriptTrustReceiptDependency['provenance'] = {
    bundleUrl,
    identity,
    status: bundleUrl && identity
      ? 'declared'
      : bundleUrl
        ? 'missing-identity'
        : 'missing-bundle',
    verification: 'not-yet-implemented',
  };
  if (!bundleUrl || !identity || !body || !fetchProvenanceBundle) return base;

  try {
    const bundle = await fetchProvenanceBundle(bundleUrl);
    if (typeof bundle !== 'string' || bundle.length === 0) {
      return { ...base, verification: 'bundle-unavailable', error: 'Provenance bundle unavailable' };
    }
    const result = await verifySigstoreMessageSignature({ bundle, artifact: body, expectedIdentity: identity });
    return {
      ...base,
      verification: result.success
        ? 'signature-verified'
        : result.verification === 'unsupported-bundle'
          ? 'unsupported-bundle'
          : result.verification === 'root-verification-failed'
            ? 'root-verification-failed'
          : 'signature-failed',
      error: result.error,
      certificateIdentity: result.certificateIdentity,
      certificateIssuer: result.certificateIssuer,
      certificateNotBefore: result.certificateNotBefore,
      certificateNotAfter: result.certificateNotAfter,
      digestVerified: result.digestVerified,
      signatureVerified: result.signatureVerified,
      rootVerified: result.rootVerified,
    };
  } catch (error) {
    return { ...base, verification: 'signature-failed', error: errorMessage(error) };
  }
}

async function snapshotDependency(
  url: string,
  fetchDependencyBody?: (url: string) => Promise<string | null | undefined>,
  known?: ScriptTrustReceiptDependency,
  bundleUrl = '',
  identity = '',
  fetchProvenanceBundle?: (url: string) => Promise<string | null | undefined>,
): Promise<ScriptTrustReceiptDependency> {
  const withProvenance = async (dependency: ScriptTrustReceiptDependency, body = ''): Promise<ScriptTrustReceiptDependency> => {
    const provenance = await buildDependencyProvenance(bundleUrl, identity, body, fetchProvenanceBundle);
    return provenance ? { ...dependency, provenance } : dependency;
  };

  if (known?.sha256) return withProvenance(known);
  if (!fetchDependencyBody) return withProvenance(known || { url });

  try {
    const body = await fetchDependencyBody(url);
    if (typeof body !== 'string') return withProvenance({ url, error: 'Dependency body unavailable' });
    return withProvenance({
      url,
      sha256: await sha256Hex(body),
      bytes: new TextEncoder().encode(body).length,
    }, body);
  } catch (error) {
    return withProvenance({ url, error: errorMessage(error) });
  }
}

async function snapshotDependencies(
  urls: string[],
  fetchDependencyBody: ((url: string) => Promise<string | null | undefined>) | undefined,
  known: Map<string, ScriptTrustReceiptDependency>,
  bundleUrls: string[] = [],
  identities: string[] = [],
  fetchProvenanceBundle?: (url: string) => Promise<string | null | undefined>,
): Promise<ScriptTrustReceiptDependency[]> {
  const snapshots: ScriptTrustReceiptDependency[] = [];
  for (const [index, url] of urls.entries()) {
    snapshots.push(await snapshotDependency(
      url,
      fetchDependencyBody,
      known.get(url),
      bundleUrls[index] || '',
      identities[index] || '',
      fetchProvenanceBundle,
    ));
  }
  return snapshots;
}

function buildDependencyChanges(
  previous: ScriptTrustReceiptDependency[],
  next: ScriptTrustReceiptDependency[],
): ScriptTrustReceiptDependencyChange[] {
  const previousMap = new Map(previous.map((dep) => [dep.url, dep]));
  const nextMap = new Map(next.map((dep) => [dep.url, dep]));
  const urls = [...previous.map((dep) => dep.url), ...next.map((dep) => dep.url).filter((url) => !previousMap.has(url))];

  return urls.map((url) => {
    const before = previousMap.get(url);
    const after = nextMap.get(url);
    let change: ScriptTrustReceiptDependencyChange['change'] = 'unverified';
    if (!before && after) change = 'added';
    else if (before && !after) change = 'removed';
    else if (before?.sha256 && after?.sha256) change = before.sha256 === after.sha256 ? 'unchanged' : 'changed';

    return {
      url,
      change,
      previousSha256: before?.sha256,
      nextSha256: after?.sha256,
      previousBytes: before?.bytes,
      nextBytes: after?.bytes,
      previousError: before?.error,
      nextError: after?.error,
    };
  });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function shortHash(value?: string): string {
  return value ? `${value.slice(0, 12)}...` : 'unavailable';
}

export function getRequireTofuSriFailure(receipt?: Pick<ScriptTrustReceipt, 'dependencyChanges'> | null): {
  url: string;
  message: string;
  change: ScriptTrustReceiptDependencyChange;
} | null {
  const changes = receipt?.dependencyChanges?.require ?? [];
  for (const change of changes) {
    if (!change?.url || hasVerifiableRequireIntegrity(change.url)) continue;
    const hadTrustedHash = typeof change.previousSha256 === 'string' && change.previousSha256.length > 0;
    if (!hadTrustedHash) continue;

    const nextHash = typeof change.nextSha256 === 'string' && change.nextSha256.length > 0
      ? change.nextSha256
      : '';
    const changedHash = change.change === 'changed'
      && !!nextHash
      && nextHash !== change.previousSha256;
    const unverifiable = ['changed', 'unverified'].includes(change.change)
      && (!nextHash || !!change.nextError);
    if (!changedHash && !unverifiable) continue;

    const reason = changedHash
      ? `hash changed from ${shortHash(change.previousSha256)} to ${shortHash(nextHash)}`
      : `previously trusted hash ${shortHash(change.previousSha256)} could not be reverified`;
    return {
      url: change.url,
      change,
      message: `@require TOFU integrity blocked for ${change.url}: ${reason}. Pin the dependency with #sha256= or provide verified @require-provenance before updating.`,
    };
  }
  return null;
}

export async function createScriptTrustReceipt(options: {
  operation: ScriptTrustReceipt['operation'];
  code: string;
  meta: ScriptMeta;
  sourceUrl?: string;
  previousScript?: Script | null;
  rollbackIndex?: number;
  fetchDependencyBody?: (url: string) => Promise<string | null | undefined>;
  fetchProvenanceBundle?: (url: string) => Promise<string | null | undefined>;
  /**
   * Outcome of optional-permission prompts surfaced by the install page
   * (e.g. `chrome.permissions.request({permissions:['cookies']})` for a
   * script that requested `@grant GM_cookie`). When the install path did
   * not surface a prompt — internal saves, sync, legacy receipts — pass
   * `null` so the field round-trips as null instead of an empty record.
   */
  optionalPermissions?: {
    requested?: string[];
    granted?: string[];
    denied?: string[];
    unavailable?: string[];
  } | null;
}): Promise<ScriptTrustReceipt> {
  const { operation, code, meta, previousScript = null } = options;
  const sourceUrl = options.sourceUrl || meta.source || meta.downloadURL || meta.updateURL || '';
  const previousCode = previousScript?.code || '';
  const createdAt = Date.now();
  const requires = asArray(meta.require);
  const requireProvenance = asArray(meta.requireProvenance);
  const requireIdentity = asArray(meta.requireIdentity);
  const previousRequires = asArray(previousScript?.meta?.require);
  const previousRequireProvenance = asArray(previousScript?.meta?.requireProvenance);
  const previousRequireIdentity = asArray(previousScript?.meta?.requireIdentity);
  const knownDependencySnapshots = getKnownDependencySnapshots(previousScript);
  const previousRequireSnapshots = await snapshotDependencies(
    previousRequires,
    options.fetchDependencyBody,
    knownDependencySnapshots,
    previousRequireProvenance,
    previousRequireIdentity,
    options.fetchProvenanceBundle,
  );
  const requireSnapshots = await snapshotDependencies(
    requires,
    options.fetchDependencyBody,
    new Map(),
    requireProvenance,
    requireIdentity,
    options.fetchProvenanceBundle,
  );
  const resources = meta.resource && typeof meta.resource === 'object'
    ? Object.entries(meta.resource)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
        .map(([name, url]) => ({ name, url }))
    : [];

  return {
    schemaVersion: 1,
    operation,
    createdAt,
    source: {
      installUrl: sourceUrl,
      installHost: sourceUrl ? hostFromUrl(sourceUrl) : '',
      updateUrl: meta.updateURL || '',
      downloadUrl: meta.downloadURL || '',
      homepageUrl: meta.homepage || meta.homepageURL || meta.website || '',
    },
    hashes: {
      sha256: await sha256Hex(code),
      previousSha256: previousScript ? await sha256Hex(previousCode) : undefined,
    },
    grants: asArray(meta.grant),
    hostScope: {
      match: asArray(meta.match),
      include: asArray(meta.include),
      exclude: asArray(meta.exclude),
      excludeMatch: asArray(meta.excludeMatch),
      connect: asArray(meta.connect),
    },
    dependencies: {
      require: requireSnapshots,
      resource: resources,
      requireCount: requires.length,
      resourceCount: resources.length,
    },
    dependencyChanges: {
      require: buildDependencyChanges(previousRequireSnapshots, requireSnapshots),
    },
    permissionChanges: {
      grant: diffStringList(asArray(previousScript?.meta?.grant), asArray(meta.grant)),
      connect: diffStringList(asArray(previousScript?.meta?.connect), asArray(meta.connect)),
      match: diffStringList(asArray(previousScript?.meta?.match), asArray(meta.match)),
    },
    optionalPermissions: options.optionalPermissions && typeof options.optionalPermissions === 'object'
      ? {
          requested: Array.isArray(options.optionalPermissions.requested) ? options.optionalPermissions.requested.slice() : [],
          granted: Array.isArray(options.optionalPermissions.granted) ? options.optionalPermissions.granted.slice() : [],
          denied: Array.isArray(options.optionalPermissions.denied) ? options.optionalPermissions.denied.slice() : [],
          unavailable: Array.isArray(options.optionalPermissions.unavailable) ? options.optionalPermissions.unavailable.slice() : [],
        }
      : null,
    diff: {
      previousVersion: previousScript?.meta?.version || '',
      nextVersion: meta.version || '',
      previousHash: previousScript ? await sha256Hex(previousCode) : '',
      nextHash: await sha256Hex(code),
      ...summarizeLineDiff(previousCode, code),
    },
    rollback: previousScript
      ? {
          available: true,
          action: 'rollbackScript',
          scriptId: previousScript.id,
          version: previousScript.meta?.version || '',
          updatedAt: previousScript.updatedAt || createdAt,
          historyIndex: typeof options.rollbackIndex === 'number' && Number.isInteger(options.rollbackIndex)
            ? options.rollbackIndex
            : null,
        }
      : {
          available: false,
          action: 'rollbackScript',
          scriptId: '',
          version: '',
          updatedAt: null,
          historyIndex: null,
        },
    lineCount: lineCount(code),
  };
}
