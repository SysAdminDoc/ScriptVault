import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');

function extractFactoryResetCase(source) {
  const marker = "case 'factoryReset': {";
  const start = source.indexOf(marker);
  if (start === -1) throw new Error('factoryReset handler not found');

  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  throw new Error('factoryReset handler block did not close');
}

describe('background factory reset handler', () => {
  it('clears scripts through ScriptStorage instead of bypassing storage cleanup', () => {
    const handler = extractFactoryResetCase(backgroundCoreCode);

    expect(handler).toContain('await unregisterScript(s.id)');
    expect(handler).toContain('await ScriptStorage.clear()');
    expect(handler).not.toContain("chrome.storage.local.remove('userscripts')");
    expect(handler).not.toContain('ScriptStorage.cache = {}');
  });

  it('erases backup blobs and autoBackups metadata so a reset leaves no restorable data', () => {
    const handler = extractFactoryResetCase(backgroundCoreCode);

    // ScriptStorage.clear() only touches the scripts partition; backup blobs
    // (full script code + GM values) live in a separate store and must be wiped.
    expect(handler).toContain('BackupsDAO.clear()');
    expect(handler).toContain('autoBackups');
  });
});
