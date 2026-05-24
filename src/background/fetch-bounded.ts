/**
 * Stream-bounded fetch response reader for background TypeScript modules.
 *
 * Mirrors the runtime `_fetchTextBounded` helper in `background.core.js`: do
 * not buffer a remote response before enforcing size limits. Content-Length is
 * only a pre-flight hint; unknown or dishonest lengths are capped while the
 * stream is being read.
 */

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function fetchTextBounded(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<string> {
  if (!response || typeof response.text !== 'function') {
    throw new Error(`${label}: invalid response`);
  }

  const declaredLen = parseInt(response.headers?.get?.('content-length') || '0', 10);
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    throw new Error(`${label} too large (${formatBytes(declaredLen)}). Maximum is ${formatBytes(maxBytes)}.`);
  }

  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    const text = await response.text();
    if (typeof text === 'string' && text.length > maxBytes) {
      throw new Error(`${label} too large (${formatBytes(text.length)}). Maximum is ${formatBytes(maxBytes)}.`);
    }
    return text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        try {
          await reader.cancel();
        } catch (_e) {
          // Ignore cancellation failures after the cap has already tripped.
        }
        throw new Error(`${label} too large (${formatBytes(bytesRead)}+). Maximum is ${formatBytes(maxBytes)}.`);
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (_e) {
      // Ignore double-release or detached-reader cases.
    }
  }

  const total = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(total);
}
