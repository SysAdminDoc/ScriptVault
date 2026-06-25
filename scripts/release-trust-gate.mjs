#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  createHash,
  createPrivateKey,
  randomUUID,
  sign as signBuffer,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const args = new Set(process.argv.slice(2));
const requireSignature = args.has('--require-signature');
const outDir = join(projectRoot, 'release-artifacts');
const projectSupplier = 'SysAdminDoc';
const projectRepositoryUrl = 'https://github.com/SysAdminDoc/ScriptVault';
const projectLicense = 'MIT';

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function run(command, args, opts = {}) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim();
}

function normalizeZipName(name) {
  return name.replace(/\\/g, '/').replace(/^\.\//, '');
}

function readZipEntries(zipPath) {
  const buffer = readFileSync(zipPath);
  const minEocd = 22;
  const maxComment = 0xffff;
  let eocdOffset = -1;
  for (let i = buffer.length - minEocd; i >= Math.max(0, buffer.length - minEocd - maxComment); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error(`Could not find ZIP central directory in ${zipPath}`);

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory entry ${i} in ${zipPath}`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = normalizeZipName(buffer.slice(offset + 46, offset + 46 + nameLength).toString('utf8'));
    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  function readEntry(name) {
    const entry = entries.find((item) => item.name === normalizeZipName(name));
    if (!entry) return null;
    const local = entry.localHeaderOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP header for ${name}`);
    }
    const nameLength = buffer.readUInt16LE(local + 26);
    const extraLength = buffer.readUInt16LE(local + 28);
    const dataOffset = local + 30 + nameLength + extraLength;
    const compressed = buffer.slice(dataOffset, dataOffset + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return inflateRawSync(compressed);
    throw new Error(`Unsupported ZIP compression method ${entry.method} for ${name}`);
  }

  return { entries, readEntry };
}

function packageNameFromLockPath(path) {
  const suffix = path.split('node_modules/').at(-1);
  const parts = suffix.split('/');
  if (parts[0]?.startsWith('@')) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

function packagePurl(name, version) {
  const encoded = name
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `pkg:npm/${encoded}@${encodeURIComponent(version)}`;
}

function directDependencyNames(pkg) {
  return Object.keys({
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
  }).sort();
}

function buildSbom(lock, pkg, version) {
  const componentByRef = new Map();
  for (const [path, meta] of Object.entries(lock.packages || {})) {
    if (!path.startsWith('node_modules/') || !meta?.version) continue;
    const name = packageNameFromLockPath(path);
    const purl = packagePurl(name, meta.version);
    if (componentByRef.has(purl)) continue;
    const component = {
      'bom-ref': purl,
      type: 'library',
      name,
      version: meta.version,
      scope: meta.dev ? 'optional' : 'required',
      purl,
    };
    if (meta.license) component.licenses = [{ expression: String(meta.license) }];
    if (meta.integrity) component.properties = [{ name: 'npm:integrity', value: meta.integrity }];
    if (meta.resolved) {
      component.externalReferences = [{ type: 'distribution', url: meta.resolved }];
    }
    componentByRef.set(purl, component);
  }
  const vendoredLibraries = [
    { name: 'acorn', version: '8.17.0', license: 'MIT', path: 'lib/acorn.min.js', description: 'Vendored JS parser for AST analysis' },
    { name: 'diff', version: '9.0.0', license: 'BSD-3-Clause', path: 'lib/diff.min.js', description: 'Vendored diff library for sync merge' },
    { name: 'fflate', version: '0.8.3', license: 'MIT', path: 'lib/fflate.js', description: 'Vendored ZIP compression library' },
  ];
  for (const lib of vendoredLibraries) {
    const ref = packagePurl(lib.name, lib.version);
    if (!componentByRef.has(ref)) {
      componentByRef.set(ref, {
        'bom-ref': ref,
        type: 'library',
        name: lib.name,
        version: lib.version,
        scope: 'required',
        purl: packagePurl(lib.name, lib.version),
        licenses: [{ expression: lib.license }],
        description: lib.description,
        properties: [
          { name: 'scriptvault:vendored', value: 'true' },
          { name: 'scriptvault:vendored-path', value: lib.path },
        ],
      });
    }
  }

  const components = [...componentByRef.values()]
    .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
  const componentRefsByName = new Map();
  for (const component of components) {
    if (!componentRefsByName.has(component.name)) componentRefsByName.set(component.name, component['bom-ref']);
  }
  const rootRef = packagePurl(pkg.name, version);
  const dependencyMap = new Map([
    [
      rootRef,
      new Set(directDependencyNames(pkg)
        .map((name) => componentRefsByName.get(name))
        .filter(Boolean)),
    ],
  ]);
  for (const [path, meta] of Object.entries(lock.packages || {})) {
    if (!path.startsWith('node_modules/') || !meta?.version) continue;
    const name = packageNameFromLockPath(path);
    const ref = packagePurl(name, meta.version);
    if (!dependencyMap.has(ref)) dependencyMap.set(ref, new Set());
    for (const depName of Object.keys({ ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) })) {
      const depRef = componentRefsByName.get(depName);
      if (depRef) dependencyMap.get(ref).add(depRef);
    }
  }
  const dependencies = [...dependencyMap.entries()]
    .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort() }))
    .sort((a, b) => a.ref.localeCompare(b.ref));

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.7',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      supplier: {
        name: projectSupplier,
      },
      tools: {
        components: [
          {
            type: 'application',
            name: 'ScriptVault release trust gate',
            version: '1',
          },
        ],
      },
      component: {
        'bom-ref': rootRef,
        type: 'application',
        name: pkg.name,
        version,
        supplier: {
          name: projectSupplier,
        },
        purl: rootRef,
        licenses: [{ expression: pkg.license || projectLicense }],
        externalReferences: [
          { type: 'website', url: projectRepositoryUrl },
          { type: 'vcs', url: `git+${projectRepositoryUrl}.git` },
        ],
        properties: [
          { name: 'scriptvault:product-id', value: 'github.com/SysAdminDoc/ScriptVault' },
        ],
      },
    },
    components,
    dependencies,
  };
}

function createSourceArchive(version) {
  const sourceZip = join(outDir, `ScriptVault-source-v${version}.zip`);
  run('git', ['archive', '--format=zip', '--output', sourceZip, 'HEAD']);
  return sourceZip;
}

function getGitInfo() {
  let commit = null;
  let tag = null;
  let dirty = true;
  let remote = null;
  try {
    commit = run('git', ['rev-parse', 'HEAD']);
    tag = run('git', ['describe', '--tags', '--exact-match', 'HEAD']);
  } catch (_) {
    // Exact tag is optional for unreleased CI builds.
  }
  try {
    dirty = run('git', ['status', '--porcelain']).length > 0;
  } catch (_) {
    dirty = true;
  }
  try {
    remote = run('git', ['remote', 'get-url', 'origin']);
  } catch (_) {
    remote = null;
  }
  return { commit, tag, dirty, remote };
}

function signChecksumManifest(checksumPath, version) {
  const keyPem = process.env.RELEASE_SIGNING_PRIVATE_KEY_PEM ||
    (process.env.RELEASE_SIGNING_PRIVATE_KEY_PATH
      ? readFileSync(resolve(projectRoot, process.env.RELEASE_SIGNING_PRIVATE_KEY_PATH), 'utf8')
      : '');

  const signingReport = {
    version,
    artifact: basename(checksumPath),
    status: 'unsigned',
    algorithm: null,
    signatureFile: null,
    publicKeyRequired: true,
    generatedAt: new Date().toISOString(),
  };

  if (!keyPem) {
    signingReport.reason = 'RELEASE_SIGNING_PRIVATE_KEY_PEM or RELEASE_SIGNING_PRIVATE_KEY_PATH was not provided';
    if (requireSignature) {
      fail('release signing key is required; set RELEASE_SIGNING_PRIVATE_KEY_PEM or RELEASE_SIGNING_PRIVATE_KEY_PATH');
    } else {
      warn('release checksum manifest is unsigned; run release:trust:strict with a signing key for public releases');
    }
    return signingReport;
  }

  const key = createPrivateKey(keyPem);
  const signatureAlgorithm = key.asymmetricKeyType === 'ed25519' ? null : 'sha256';
  const signature = signBuffer(signatureAlgorithm, readFileSync(checksumPath), key);
  const sigPath = `${checksumPath}.sig`;
  writeFileSync(sigPath, signature.toString('base64'));
  signingReport.status = 'signed';
  signingReport.algorithm = key.asymmetricKeyType === 'ed25519' ? 'Ed25519' : `${key.asymmetricKeyType}-sha256`;
  signingReport.signatureFile = basename(sigPath);
  delete signingReport.reason;
  return signingReport;
}

function main() {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  const firefoxManifest = readJson('manifest-firefox.json');
  const lock = readJson('package-lock.json');
  const version = pkg.version;
  const artifactName = `ScriptVault-v${version}.zip`;
  const artifactPath = join(projectRoot, artifactName);

  if (manifest.version !== version) fail(`manifest.json version ${manifest.version} does not match package.json ${version}`);
  if (firefoxManifest.version !== version) fail(`manifest-firefox.json version ${firefoxManifest.version} does not match package.json ${version}`);
  if (!existsSync(artifactPath)) fail(`${artifactName} is missing; run bash build.sh before npm run release:trust`);
  if (failures.length > 0) return finish();

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const zip = readZipEntries(artifactPath);
  const names = zip.entries.map((entry) => entry.name).sort();
  const nameSet = new Set(names);
  const manifestBytes = zip.readEntry('manifest.json');
  if (!manifestBytes) fail(`${artifactName} is missing manifest.json`);
  const packagedManifest = manifestBytes ? JSON.parse(manifestBytes.toString('utf8')) : null;
  if (packagedManifest?.version !== version) {
    fail(`packaged manifest version ${packagedManifest?.version || '<missing>'} does not match ${version}`);
  }

  const requiredFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'offscreen.html',
    'offscreen.js',
    'images/icon16.png',
    'images/icon32.png',
    'images/icon48.png',
    'images/icon128.png',
  ];
  const requiredPrefixes = ['shared/', 'pages/', 'lib/', '_locales/'];
  const missingRequired = [
    ...requiredFiles.filter((name) => !nameSet.has(name)),
    ...requiredPrefixes.filter((prefix) => !names.some((name) => name.startsWith(prefix))),
  ];
  for (const missing of missingRequired) fail(`${artifactName} is missing required package entry ${missing}`);

  const forbiddenPatterns = [
    /^\.env(?:\.|$)/,
    /^\.git\//,
    /^\.github\//,
    /^node_modules\//,
    /^src\//,
    /^tests\//,
    /^docs\//,
    /^release-artifacts\//,
    /^package(?:-lock)?\.json$/,
    /^scripts\//,
    /(?:^|\/)(?:scriptvault\.pem|.*\.(?:pem|key|p12|secret))$/i,
  ];
  const forbiddenEntries = names.filter((name) => forbiddenPatterns.some((pattern) => pattern.test(name)));
  for (const entry of forbiddenEntries) fail(`${artifactName} includes forbidden package entry ${entry}`);

  const artifactHash = sha256File(artifactPath);
  const sourceZip = createSourceArchive(version);
  const sourceHash = sha256File(sourceZip);

  const sbomPath = join(outDir, `ScriptVault-v${version}.sbom.cyclonedx.json`);
  writeJson(sbomPath, buildSbom(lock, pkg, version));

  const packageDiffPath = join(outDir, `ScriptVault-v${version}.package-diff.json`);
  const packageDiff = {
    version,
    artifact: artifactName,
    artifactSha256: artifactHash,
    generatedAt: new Date().toISOString(),
    entryCount: names.length,
    totalUncompressedBytes: zip.entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0),
    requiredFiles,
    requiredPrefixes,
    missingRequired,
    forbiddenEntries,
    manifest: {
      permissions: packagedManifest?.permissions || [],
      optionalPermissions: packagedManifest?.optional_permissions || [],
      hostPermissions: packagedManifest?.host_permissions || [],
      webAccessibleResources: packagedManifest?.web_accessible_resources || [],
      contentScripts: packagedManifest?.content_scripts?.map((script) => ({
        matches: script.matches,
        js: script.js,
        allFrames: script.all_frames,
        runAt: script.run_at,
      })) || [],
    },
    entries: names,
  };
  writeJson(packageDiffPath, packageDiff);

  const provenancePath = join(outDir, `ScriptVault-v${version}.provenance.json`);
  const git = getGitInfo();
  const provenance = {
    predicateType: 'https://slsa.dev/provenance/v1',
    subject: [
      { name: artifactName, digest: { sha256: artifactHash } },
      { name: basename(sourceZip), digest: { sha256: sourceHash } },
    ],
    buildType: 'https://github.com/SysAdminDoc/ScriptVault/release-trust-gate/v1',
    builder: {
      id: process.env.GITHUB_ACTIONS === 'true'
        ? `github-actions:${process.env.GITHUB_WORKFLOW || 'unknown'}`
        : `local:${process.platform}`,
    },
    invocation: {
      configSource: {
        uri: git.remote,
        digest: git.commit ? { sha1: git.commit } : undefined,
        entryPoint: 'scripts/release-trust-gate.mjs',
      },
      parameters: {
        version,
        node: process.version,
        npmUserAgent: process.env.npm_config_user_agent || null,
        dirty: git.dirty,
      },
      environment: {
        githubRunId: process.env.GITHUB_RUN_ID || null,
        githubRef: process.env.GITHUB_REF || null,
        githubSha: process.env.GITHUB_SHA || null,
      },
    },
    materials: [
      { uri: 'git+origin', digest: git.commit ? { sha1: git.commit } : undefined },
      { uri: 'package-lock.json', digest: { sha256: sha256File(join(projectRoot, 'package-lock.json')) } },
      { uri: 'manifest.json', digest: { sha256: sha256File(join(projectRoot, 'manifest.json')) } },
    ],
    metadata: {
      buildStartedOn: new Date().toISOString(),
      completeness: { parameters: true, environment: true, materials: true },
      reproducible: false,
    },
  };
  writeJson(provenancePath, provenance);

  const checksumPath = join(outDir, `ScriptVault-v${version}.sha256`);
  const checksumTargets = [
    artifactPath,
    sourceZip,
    sbomPath,
    packageDiffPath,
    provenancePath,
  ];
  const checksumText = checksumTargets
    .map((path) => `${sha256File(path)}  ${relative(projectRoot, path).replace(/\\/g, '/')}`)
    .join('\n');
  writeFileSync(checksumPath, `${checksumText}\n`);

  const signingReport = signChecksumManifest(checksumPath, version);
  const signingPath = join(outDir, `ScriptVault-v${version}.signing.json`);
  writeJson(signingPath, signingReport);

  const summary = {
    version,
    generatedAt: new Date().toISOString(),
    artifact: {
      path: artifactName,
      sha256: artifactHash,
      bytes: statSync(artifactPath).size,
    },
    sourceArchive: {
      path: relative(projectRoot, sourceZip).replace(/\\/g, '/'),
      sha256: sourceHash,
      bytes: statSync(sourceZip).size,
    },
    outputs: [
      checksumPath,
      sbomPath,
      packageDiffPath,
      provenancePath,
      signingPath,
    ].map((path) => relative(projectRoot, path).replace(/\\/g, '/')),
    signing: signingReport,
    git,
  };
  writeJson(join(outDir, `ScriptVault-v${version}.release-trust-summary.json`), summary);

  return finish(summary);
}

function finish(summary = null) {
  if (failures.length > 0) {
    console.error('Release trust gate failed:');
    for (const item of failures) console.error(`- ${item}`);
    if (warnings.length > 0) {
      console.error('Warnings:');
      for (const item of warnings) console.error(`- ${item}`);
    }
    process.exit(1);
  }
  console.log('Release trust gate passed.');
  if (summary) {
    console.log(`Artifact: ${summary.artifact.path}`);
    console.log(`SHA256: ${summary.artifact.sha256}`);
    console.log(`Outputs: ${summary.outputs.join(', ')}`);
  }
  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const item of warnings) console.log(`- ${item}`);
  }
}

try {
  main();
} catch (e) {
  fail(e?.stack || e?.message || String(e));
  finish();
}
