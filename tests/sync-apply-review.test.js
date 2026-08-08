// A remote sync envelope is unauthenticated JSON in the default (plaintext)
// mode, so whoever can write the user's own backend chooses what arrives here.
// These cover the two consequences that used to be unguarded: synced-in bodies
// executing with no analysis or review, and remote tombstones hard-deleting
// local scripts past trash.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = process.cwd();
const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const cloudSyncSource = readFileSync(resolve(ROOT, 'src/background/cloud-sync.ts'), 'utf8');

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`not found: ${signature}`);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced: ${signature}`);
}

describe('trashScriptForSync', () => {
  let storage;
  let trashScriptForSync;
  let warnings;

  function build(trashMode = '30') {
    storage = {};
    warnings = [];
    const chrome = {
      storage: {
        local: {
          get: async (key) => ({ [key]: storage[key] }),
          set: async (entries) => { Object.assign(storage, entries); },
        },
      },
    };
    const SettingsManager = { get: async () => ({ trashMode }) };
    const body = `${extractFunction(core, 'async function trashScriptForSync(')}
return trashScriptForSync;`;
    trashScriptForSync = compileFunction(body, ['chrome', 'SettingsManager', 'debugWarn'], {
      filename: resolve(ROOT, 'background.core.js'),
    })(chrome, SettingsManager, (...args) => warnings.push(args.join(' ')));
  }

  it('writes a recoverable trash record for a tombstone-driven delete', async () => {
    build('30');
    const script = { id: 's1', code: '// body', meta: { name: 'Doomed' } };
    await expect(trashScriptForSync(script, 'sync-tombstone')).resolves.toBe(true);
    expect(storage.trash).toHaveLength(1);
    expect(storage.trash[0]).toMatchObject({ id: 's1', trashedBy: 'sync-tombstone' });
    expect(typeof storage.trash[0].trashedAt).toBe('number');
    // The code must survive, or "restore" cannot restore anything.
    expect(storage.trash[0].code).toBe('// body');
  });

  it('does not stack duplicates when the same tombstone arrives twice', async () => {
    build('30');
    const script = { id: 's1', code: '// body', meta: { name: 'Doomed' } };
    await trashScriptForSync(script, 'sync-tombstone');
    await trashScriptForSync(script, 'sync-tombstone');
    expect(storage.trash).toHaveLength(1);
  });

  it('honours an explicit trashMode: disabled opt-out', async () => {
    build('disabled');
    await expect(trashScriptForSync({ id: 's1', code: '// b', meta: {} })).resolves.toBe(false);
    expect(storage.trash).toBeUndefined();
  });

  it('reports rather than swallows a trash write failure', async () => {
    build('30');
    const script = { id: 's1', code: '// body', meta: {} };
    // Re-bind with a failing storage to prove the catch path is observable.
    const body = `${extractFunction(core, 'async function trashScriptForSync(')}
return trashScriptForSync;`;
    const failing = compileFunction(body, ['chrome', 'SettingsManager', 'debugWarn'], {
      filename: resolve(ROOT, 'background.core.js'),
    })(
      { storage: { local: { get: async () => ({}), set: async () => { throw new Error('quota exceeded'); } } } },
      { get: async () => ({ trashMode: '30' }) },
      (...args) => warnings.push(args.join(' ')),
    );
    await expect(failing(script)).resolves.toBe(false);
    expect(warnings.join(' ')).toContain('quota exceeded');
  });
});

describe('assessSyncedScriptRisk', () => {
  const generated = readFileSync(resolve(ROOT, 'modules/cloud-sync.js'), 'utf8');

  function buildAssess({ analyze } = {}) {
    // Compile the contiguous generated region that holds the risk-level sets,
    // the metadata readers, and the decision itself, so the behaviour under test
    // is the shipped one and a newly added helper cannot be silently left out.
    const regionStart = generated.indexOf('var SYNC_REVIEW_RISK_LEVELS');
    if (regionStart === -1) throw new Error('SYNC_REVIEW_RISK_LEVELS not found in modules/cloud-sync.js');
    const assessSource = extractFunction(generated, 'async function assessSyncedScriptRisk(');
    const regionEnd = generated.indexOf(assessSource) + assessSource.length;
    const body = `${generated.slice(regionStart, regionEnd)}
return assessSyncedScriptRisk;`;
    const hooks = analyze ? { analyzeSyncedScriptCode: analyze } : {};
    return compileFunction(body, ['getRuntimeHooks', 'debugLog'], {
      filename: resolve(ROOT, 'modules/cloud-sync.js'),
    })(() => hooks, () => {});
  }

  const CLEAN_META = { grant: ['GM_getValue'], match: ['https://example.com/*'] };
  const EXISTING = { meta: { grant: ['GM_getValue'], match: ['https://example.com/*'] } };

  it('passes a clean, unchanged script straight through', async () => {
    const assess = buildAssess({ analyze: async () => ({ riskLevel: 'minimal', findings: [] }) });
    await expect(assess('s1', 'Clean', '// code', CLEAN_META, EXISTING, true)).resolves.toBeNull();
  });

  it('flags a high analyzer risk and names the findings', async () => {
    const assess = buildAssess({
      analyze: async () => ({
        riskLevel: 'high',
        findings: [{ label: 'Remote code execution' }, { label: 'Credential exfiltration' }],
      }),
    });
    const review = await assess('s1', 'Nasty', '// code', CLEAN_META, EXISTING, true);
    expect(review).not.toBeNull();
    expect(review.riskLevel).toBe('high');
    expect(review.reasons.join(' ')).toContain('Remote code execution');
    expect(review.plaintextRemote).toBe(true);
  });

  it('flags a medium analyzer risk too', async () => {
    const assess = buildAssess({ analyze: async () => ({ riskLevel: 'medium', findings: [] }) });
    await expect(assess('s1', 'Medium', '// c', CLEAN_META, EXISTING, false)).resolves.not.toBeNull();
  });

  it('flags a capability grant that arrived via sync', async () => {
    const assess = buildAssess({ analyze: async () => ({ riskLevel: 'minimal', findings: [] }) });
    const review = await assess(
      's1',
      'Widened',
      '// c',
      { grant: ['GM_getValue', 'GM_cookie'], match: ['https://example.com/*'] },
      EXISTING,
      true,
    );
    expect(review.reasons.join(' ')).toContain('new grant: GM_cookie');
  });

  it('ignores a grant the local copy already had', async () => {
    const assess = buildAssess({ analyze: async () => ({ riskLevel: 'minimal', findings: [] }) });
    const already = { meta: { grant: ['GM_cookie'], match: ['https://example.com/*'] } };
    await expect(assess('s1', 'Same', '// c', { grant: ['GM_cookie'], match: ['https://example.com/*'] }, already, true))
      .resolves.toBeNull();
  });

  it('flags a match pattern broadened to every site', async () => {
    const assess = buildAssess({ analyze: async () => ({ riskLevel: 'minimal', findings: [] }) });
    const review = await assess(
      's1',
      'Everywhere',
      '// c',
      { grant: ['GM_getValue'], match: ['*://*/*'] },
      EXISTING,
      true,
    );
    expect(review.reasons.join(' ')).toContain('broadened match');
  });

  it('treats an analyzer that throws as a reason to review, not as clean', async () => {
    const assess = buildAssess({ analyze: async () => { throw new Error('offscreen unavailable'); } });
    const review = await assess('s1', 'Unknown', '// c', CLEAN_META, EXISTING, true);
    expect(review).not.toBeNull();
    expect(review.reasons.join(' ')).toContain('analyzer unavailable');
  });

  // Setting up a new device is the normal case for a first arrival: every grant
  // reads as "new" there, so flagging on that would hold an entire library.
  it('does not flag a first arrival on capability alone', async () => {
    const assess = buildAssess({ analyze: async () => ({ riskLevel: 'minimal', findings: [] }) });
    await expect(assess('s1', 'New', '// c', { grant: ['GM_xmlhttpRequest'], match: ['*://*/*'] }, null, true))
      .resolves.toBeNull();
  });

  it('does not hold a merely medium-risk first arrival, but does hold a high-risk one', async () => {
    const medium = buildAssess({ analyze: async () => ({ riskLevel: 'medium', findings: [] }) });
    await expect(medium('s1', 'Medium First', '// c', { grant: [], match: [] }, null, true)).resolves.toBeNull();

    const high = buildAssess({ analyze: async () => ({ riskLevel: 'high', findings: [{ label: 'Exfiltration' }] }) });
    const review = await high('s1', 'High First', '// c', { grant: [], match: [] }, null, true);
    expect(review).not.toBeNull();
    expect(review.reasons.join(' ')).toContain('Exfiltration');
  });
});

describe('the apply path holds risky synced-in bodies for review', () => {
  it('runs the analyzer and compares capability before storing', () => {
    expect(cloudSyncSource).toContain('const review = await assessSyncedScriptRisk(');
    // The review decision must be made BEFORE the script is stored/registered.
    const assessAt = cloudSyncSource.indexOf('const review = await assessSyncedScriptRisk(');
    const storeAt = cloudSyncSource.indexOf('await ScriptStorage.set(script.id, nextScript);');
    const registerAt = cloudSyncSource.indexOf('await refreshSyncedScriptRuntime(nextScript);');
    expect(assessAt).toBeGreaterThan(-1);
    expect(storeAt).toBeGreaterThan(assessAt);
    expect(registerAt).toBeGreaterThan(assessAt);
  });

  it('stores a reviewed script disabled, with a quarantine marker', () => {
    expect(cloudSyncSource).toContain('nextScript.enabled = false;');
    expect(cloudSyncSource).toContain('_importQuarantine: {');
    expect(cloudSyncSource).toContain("source: 'cloud-sync',");
  });

  it('treats an analyzer that cannot run as a reason to review, not as clean', () => {
    expect(cloudSyncSource).toContain("reasons.push('analyzer unavailable — body not inspected');");
  });

  it('records whether the remote envelope was unauthenticated plaintext', () => {
    expect(cloudSyncSource).toContain('const plaintextRemote = !SyncCrypto.isEncryptedSyncEnvelope(remoteEnvelope);');
  });

  it('routes a tombstone delete through trash before deleting', () => {
    const deleteFn = extractFunction(cloudSyncSource, 'async function deleteSyncedScript(');
    const readAt = deleteFn.indexOf('await ScriptStorage.get(scriptId)');
    const trashAt = deleteFn.indexOf("hooks.trashScriptForSync(script, 'sync-tombstone')");
    const deleteAt = deleteFn.indexOf('await ScriptStorage.delete(scriptId)');
    expect(readAt).toBeGreaterThan(-1);
    expect(trashAt).toBeGreaterThan(readAt);
    expect(deleteAt).toBeGreaterThan(trashAt);
  });
});
