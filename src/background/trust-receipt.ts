import type { Script, ScriptMeta, ScriptTrustReceipt } from '../types/script';

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
}): Promise<ScriptTrustReceipt> {
  const { operation, code, meta, previousScript = null } = options;
  const sourceUrl = options.sourceUrl || meta.source || meta.downloadURL || meta.updateURL || '';
  const previousCode = previousScript?.code || '';
  const createdAt = Date.now();
  const requires = asArray(meta.require);
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
      require: requires.map((url) => ({ url })),
      resource: resources,
      requireCount: requires.length,
      resourceCount: resources.length,
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
