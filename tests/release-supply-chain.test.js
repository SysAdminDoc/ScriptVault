import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';
import {
  checkPublicGitHubRelease,
  verifyReleaseTag,
} from '../scripts/check-release-artifacts.mjs';

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const packageLock = JSON.parse(readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8'));
const cwsCheck = readFileSync(resolve(process.cwd(), 'scripts/check-cws-publish-tooling.mjs'), 'utf8');
const releaseCheck = readFileSync(resolve(process.cwd(), 'scripts/check-release-artifacts.mjs'), 'utf8');
const reproducibleBuildCheck = readFileSync(resolve(process.cwd(), 'scripts/check-reproducible-build.mjs'), 'utf8');
const releaseRunbook = readFileSync(resolve(process.cwd(), 'docs/release-runbook.md'), 'utf8');

function makeTagVerifierFailure(stderr) {
  const error = new Error('git tag verification failed');
  error.stderr = stderr;
  return error;
}

function createGitExecForTagVerification(stderr) {
  return vi.fn((_command, args) => {
    if (args[0] === 'rev-parse') return '';
    if (args[0] === 'tag' && args[1] === '--verify') throw makeTagVerifierFailure(stderr);
    throw new Error(`unexpected git call: ${args.join(' ')}`);
  });
}

function response({ status = 200, statusText = 'OK', url = '', body = '' } = {}) {
  return {
    status,
    statusText,
    url,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe('release supply-chain gates', () => {
  it('pins the CWS publish CLI to an exact reviewed tarball', () => {
    const lockRoot = packageLock.packages[''].devDependencies['chrome-webstore-upload-cli'];
    const lockPackage = packageLock.packages['node_modules/chrome-webstore-upload-cli'];

    expect(packageJson.devDependencies['chrome-webstore-upload-cli']).toBe('4.0.1');
    expect(lockRoot).toBe('4.0.1');
    expect(lockPackage.version).toBe('4.0.1');
    expect(lockPackage.integrity).toBe('sha512-UGmvbEGTqNCD+W9HDEoYnZwrbp++v5WcIyVVZWxK7AxFMfxtZF/yiNtxWCcAetNg4z0m/CNhf+Qt3b0aitDEWw==');
  });

  it('keeps CWS tooling checks tied to the exact version and lock integrity', () => {
    expect(cwsCheck).toContain("const REQUIRED_CWS_CLI_VERSION = '4.0.1'");
    expect(cwsCheck).toContain('const REQUIRED_CWS_CLI_INTEGRITY =');
    expect(cwsCheck).toContain('expected exact ${REQUIRED_CWS_CLI_VERSION}');
    expect(cwsCheck).toContain('package-lock.json integrity for ${CWS_CLI_PACKAGE_NAME} changed');
  });

  it('verifies release tags through git tag --verify', () => {
    expect(releaseCheck).toContain("['tag', '--verify', tag]");
    expect(releaseCheck).toContain("LEGACY_UNSIGNED_RELEASE_TAGS = new Set(['v3.11.0', 'v3.21.0', 'v3.22.0'])");
  });

  it('checks public GitHub releases without the GitHub CLI', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const href = String(url);
      expect(href).not.toContain('api.github.com');
      if (href.endsWith('/releases/tag/v3.11.0')) {
        return response({
          status: 200,
          url: href,
          body: '<a href="/SysAdminDoc/ScriptVault/releases/download/v3.11.0/ScriptVault-v3.11.0.zip">ScriptVault-v3.11.0.zip</a>',
        });
      }
      if (href.endsWith('/releases/latest')) {
        return response({
          status: 200,
          url: 'https://github.com/SysAdminDoc/ScriptVault/releases/tag/v3.11.0',
          body: '',
        });
      }
      throw new Error(`unexpected fetch ${init?.method || 'GET'} ${href}`);
    });

    const result = await checkPublicGitHubRelease({
      owner: 'SysAdminDoc',
      repo: 'ScriptVault',
      tag: 'v3.11.0',
      version: '3.11.0',
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: true, failures: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('falls back to the release download URL when the page omits asset text', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const href = String(url);
      if (href.endsWith('/releases/tag/v3.11.0')) {
        return response({ status: 200, url: href, body: '<html>No asset listing in this fixture.</html>' });
      }
      if (href.includes('/releases/download/v3.11.0/ScriptVault-v3.11.0.zip')) {
        expect(init?.method).toBe('HEAD');
        return response({ status: 200, url: href });
      }
      if (href.endsWith('/releases/latest')) {
        return response({ status: 200, url: 'https://github.com/SysAdminDoc/ScriptVault/releases/tag/v3.11.0' });
      }
      throw new Error(`unexpected fetch ${init?.method || 'GET'} ${href}`);
    });

    const result = await checkPublicGitHubRelease({
      owner: 'SysAdminDoc',
      repo: 'ScriptVault',
      tag: 'v3.11.0',
      version: '3.11.0',
      fetchImpl,
    });

    expect(result.failures).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reports missing assets separately from latest-release drift', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const href = String(url);
      if (href.endsWith('/releases/tag/v3.11.0')) {
        return response({ status: 200, url: href, body: '<html>No assets here.</html>' });
      }
      if (href.includes('/releases/download/v3.11.0/ScriptVault-v3.11.0.zip')) {
        return response({ status: 404, statusText: 'Not Found', url: href });
      }
      if (href.endsWith('/releases/latest')) {
        return response({ status: 200, url: 'https://github.com/SysAdminDoc/ScriptVault/releases/tag/v3.10.0' });
      }
      throw new Error(`unexpected fetch ${href}`);
    });

    const result = await checkPublicGitHubRelease({
      owner: 'SysAdminDoc',
      repo: 'ScriptVault',
      tag: 'v3.11.0',
      version: '3.11.0',
      fetchImpl,
    });

    expect(result.failures).toContain('GitHub release v3.11.0 is missing ScriptVault-v3.11.0.zip');
    expect(result.failures).toContain('GitHub latest release is v3.10.0, expected v3.11.0');
  });

  it('reports public network failures without hiding tag-signature failures', async () => {
    const result = await checkPublicGitHubRelease({
      owner: 'SysAdminDoc',
      repo: 'ScriptVault',
      tag: 'v3.11.0',
      version: '3.11.0',
      fetchImpl: vi.fn(async () => {
        throw new Error('offline fixture');
      }),
    });

    expect(result.failures.join('\n')).toContain('public page check failed: offline fixture');
    expect(result.failures.join('\n')).toContain('latest release public check failed: offline fixture');
  });

  it('wires an independently runnable reproducible Chrome ZIP check', () => {
    expect(packageJson.scripts['release:reproducible-build:check']).toBe('node scripts/check-reproducible-build.mjs');
    expect(releaseRunbook).toContain('npm run release:reproducible-build:check');
    expect(reproducibleBuildCheck).toContain("comparison: 'normalized-zip-entry-sha256'");
    expect(reproducibleBuildCheck).toContain("['scripts/run-bash.mjs', 'build.sh']");
    expect(reproducibleBuildCheck).toContain('zipContentDigest(backupPath)');
    expect(reproducibleBuildCheck).toContain('zipContentDigest(artifactPath)');
  });

  it('allows the existing legacy unsigned tag only outside the public release gate', () => {
    const legacy = verifyReleaseTag({
      tag: 'v3.11.0',
      checkPublic: false,
      execFileSyncImpl: createGitExecForTagVerification('error: no signature found'),
    });
    expect(legacy.failures).toEqual([]);
    expect(legacy.warnings.join('\n')).toContain('legacy pre-RD-13 tag');

    const publicLegacy = verifyReleaseTag({
      tag: 'v3.11.0',
      checkPublic: true,
      execFileSyncImpl: createGitExecForTagVerification('error: no signature found'),
    });
    expect(publicLegacy.failures.join('\n')).toContain('git tag v3.11.0 is unsigned');
  });

  it('fails future unsigned release tags', () => {
    const result = verifyReleaseTag({
      tag: 'v3.12.0',
      checkPublic: false,
      execFileSyncImpl: createGitExecForTagVerification('error: no signature found'),
    });
    expect(result.failures.join('\n')).toContain('git tag v3.12.0 is unsigned');
  });

  it('warns on missing verifier keys before public release and fails in public mode', () => {
    const missingKey = "gpg: Signature made Thu Jun 11 12:00:00 2026 EDT\ngpg: Can't check signature: No public key";
    const local = verifyReleaseTag({
      tag: 'v3.12.0',
      checkPublic: false,
      execFileSyncImpl: createGitExecForTagVerification(missingKey),
    });
    expect(local.failures).toEqual([]);
    expect(local.warnings.join('\n')).toContain('import the release signing public key before public release');

    const publicResult = verifyReleaseTag({
      tag: 'v3.12.0',
      checkPublic: true,
      execFileSyncImpl: createGitExecForTagVerification(missingKey),
    });
    expect(publicResult.failures.join('\n')).toContain('cannot be cryptographically verified');
  });
});
