import type {
  Script,
  ScriptMeta,
  ScriptTrustReceipt,
  ScriptTrustReceiptDependency,
  ScriptTrustReceiptDependencyChange,
  ScriptTrustReceiptPermissionChangeSet,
} from '../types/script';

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

async function snapshotDependency(
  url: string,
  fetchDependencyBody?: (url: string) => Promise<string | null | undefined>,
  known?: ScriptTrustReceiptDependency,
): Promise<ScriptTrustReceiptDependency> {
  if (known?.sha256) return known;
  if (!fetchDependencyBody) return known || { url };

  try {
    const body = await fetchDependencyBody(url);
    if (typeof body !== 'string') return { url, error: 'Dependency body unavailable' };
    return {
      url,
      sha256: await sha256Hex(body),
      bytes: new TextEncoder().encode(body).length,
    };
  } catch (error) {
    return { url, error: errorMessage(error) };
  }
}

async function snapshotDependencies(
  urls: string[],
  fetchDependencyBody: ((url: string) => Promise<string | null | undefined>) | undefined,
  known: Map<string, ScriptTrustReceiptDependency>,
): Promise<ScriptTrustReceiptDependency[]> {
  const snapshots: ScriptTrustReceiptDependency[] = [];
  for (const url of urls) {
    snapshots.push(await snapshotDependency(url, fetchDependencyBody, known.get(url)));
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

export async function createScriptTrustReceipt(options: {
  operation: ScriptTrustReceipt['operation'];
  code: string;
  meta: ScriptMeta;
  sourceUrl?: string;
  previousScript?: Script | null;
  rollbackIndex?: number;
  fetchDependencyBody?: (url: string) => Promise<string | null | undefined>;
}): Promise<ScriptTrustReceipt> {
  const { operation, code, meta, previousScript = null } = options;
  const sourceUrl = options.sourceUrl || meta.source || meta.downloadURL || meta.updateURL || '';
  const previousCode = previousScript?.code || '';
  const createdAt = Date.now();
  const requires = asArray(meta.require);
  const previousRequires = asArray(previousScript?.meta?.require);
  const knownDependencySnapshots = getKnownDependencySnapshots(previousScript);
  const previousRequireSnapshots = await snapshotDependencies(
    previousRequires,
    options.fetchDependencyBody,
    knownDependencySnapshots,
  );
  const requireSnapshots = await snapshotDependencies(requires, options.fetchDependencyBody, new Map());
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
