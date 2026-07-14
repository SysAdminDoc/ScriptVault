// ============================================================================
// Reviewed local library snapshots
// ============================================================================

export interface LocalLibrarySnapshot {
  id: string;
  name: string;
  code: string;
  sha256: string;
  bytes: number;
  reviewedAt: number;
}

export interface LocalLibraryCandidate {
  id?: unknown;
  name?: unknown;
  code?: unknown;
  reviewedAt?: unknown;
}

export type LocalLibraryCandidateResult =
  | { ok: true; snapshot: LocalLibrarySnapshot }
  | { ok: false; error: string };

export const MAX_LOCAL_LIBRARIES = 8;
export const MAX_LOCAL_LIBRARY_BYTES = 512 * 1024;

const SHA256_HEX = /^[a-f0-9]{64}$/;
const LOCAL_LIBRARY_ID = /^local-library-[a-z0-9_-]{8,96}$/;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function safeLibraryName(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const leaf = text.split(/[\\/]/).filter(Boolean).pop() || 'local-library.js';
  return leaf.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160) || 'local-library.js';
}

function safeLibraryId(value: unknown, fallbackSeed = ''): string {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (LOCAL_LIBRARY_ID.test(candidate)) return candidate;
  const seed = fallbackSeed.replace(/[^a-z0-9_-]/gi, '-').replace(/^-+|-+$/g, '').slice(0, 56) || 'snapshot';
  return `local-library-${seed}-${Date.now().toString(36)}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createLocalLibrarySnapshot(input: LocalLibraryCandidate): Promise<LocalLibraryCandidateResult> {
  const code = typeof input?.code === 'string' ? input.code : '';
  const name = safeLibraryName(input?.name);
  if (!code.trim()) return { ok: false, error: 'Choose a non-empty JavaScript library.' };
  if (code.includes('\u0000')) return { ok: false, error: 'Local libraries cannot contain NUL characters.' };
  const bytes = byteLength(code);
  if (bytes > MAX_LOCAL_LIBRARY_BYTES) {
    return { ok: false, error: `Local library is too large. Maximum is ${MAX_LOCAL_LIBRARY_BYTES / 1024} KB.` };
  }
  const sha256 = await sha256Hex(code);
  return {
    ok: true,
    snapshot: {
      id: safeLibraryId(input?.id, name.replace(/\.m?js$/i, '')),
      name,
      code,
      sha256,
      bytes,
      reviewedAt: Number.isFinite(Number(input?.reviewedAt)) && Number(input.reviewedAt) > 0
        ? Number(input.reviewedAt)
        : Date.now(),
    },
  };
}

export function normalizeLocalLibrarySnapshots(input: unknown): LocalLibrarySnapshot[] {
  const values = Array.isArray(input) ? input.slice(0, MAX_LOCAL_LIBRARIES) : [];
  const normalized: LocalLibrarySnapshot[] = [];
  const seenIds = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const candidate = value as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim().toLowerCase() : '';
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    const sha256 = typeof candidate.sha256 === 'string' ? candidate.sha256.trim().toLowerCase() : '';
    const bytes = byteLength(code);
    if (!LOCAL_LIBRARY_ID.test(id) || seenIds.has(id) || !code.trim() || code.includes('\u0000')) continue;
    if (!SHA256_HEX.test(sha256) || bytes > MAX_LOCAL_LIBRARY_BYTES) continue;
    seenIds.add(id);
    normalized.push({
      id,
      name: safeLibraryName(candidate.name),
      code,
      sha256,
      bytes,
      reviewedAt: Number.isFinite(Number(candidate.reviewedAt)) && Number(candidate.reviewedAt) > 0
        ? Number(candidate.reviewedAt)
        : 0,
    });
  }
  return normalized;
}

export function getLocalLibraryRequireScripts(settings: unknown): Array<{ url: string; code: string }> {
  const candidate = settings && typeof settings === 'object'
    ? (settings as Record<string, unknown>).localLibraries
    : undefined;
  return normalizeLocalLibrarySnapshots(candidate).map(snapshot => ({
    url: `local-library://${encodeURIComponent(snapshot.name)}#sha256=${snapshot.sha256}`,
    code: snapshot.code,
  }));
}

export function getLocalLibraryReviewSignals(codeInput: unknown): string[] {
  const code = typeof codeInput === 'string' ? codeInput : '';
  const signals: string[] = [];
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(code)) signals.push('dynamic code execution');
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|GM_xmlhttpRequest)\b/.test(code)) signals.push('network access');
  if (/\b(?:document\.cookie|localStorage|indexedDB)\b/.test(code)) signals.push('site or browser storage');
  if (/\.innerHTML\s*=|document\.write\s*\(/.test(code)) signals.push('HTML injection');
  return signals;
}

export const LocalLibraries = Object.freeze({
  MAX_LOCAL_LIBRARIES,
  MAX_LOCAL_LIBRARY_BYTES,
  createLocalLibrarySnapshot,
  getLocalLibraryRequireScripts,
  getLocalLibraryReviewSignals,
  normalizeLocalLibrarySnapshots,
});

export default LocalLibraries;
