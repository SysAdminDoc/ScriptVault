#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const outDir = join(projectRoot, 'release-artifacts');

function readJson(path) {
  return JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
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

  function readEntry(entry) {
    const local = entry.localHeaderOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP header for ${entry.name}`);
    }
    const nameLength = buffer.readUInt16LE(local + 26);
    const extraLength = buffer.readUInt16LE(local + 28);
    const dataOffset = local + 30 + nameLength + extraLength;
    const compressed = buffer.slice(dataOffset, dataOffset + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return inflateRawSync(compressed);
    throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}`);
  }

  return { entries, readEntry };
}

function zipContentDigest(zipPath) {
  const zip = readZipEntries(zipPath);
  return zip.entries
    .filter((entry) => !entry.name.endsWith('/'))
    .map((entry) => {
      const bytes = zip.readEntry(entry);
      return {
        name: entry.name,
        bytes: bytes.length,
        sha256: sha256(bytes),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function compareDigests(expected, actual) {
  const failures = [];
  const expectedByName = new Map(expected.map((entry) => [entry.name, entry]));
  const actualByName = new Map(actual.map((entry) => [entry.name, entry]));

  for (const entry of expected) {
    const rebuilt = actualByName.get(entry.name);
    if (!rebuilt) {
      failures.push(`missing rebuilt entry ${entry.name}`);
    } else if (rebuilt.sha256 !== entry.sha256 || rebuilt.bytes !== entry.bytes) {
      failures.push(`changed rebuilt entry ${entry.name}`);
    }
  }
  for (const entry of actual) {
    if (!expectedByName.has(entry.name)) failures.push(`unexpected rebuilt entry ${entry.name}`);
  }
  return failures;
}

function main() {
  const pkg = readJson('package.json');
  const version = pkg.version;
  const artifactName = `ScriptVault-v${version}.zip`;
  const artifactPath = join(projectRoot, artifactName);
  const backupPath = join(outDir, `${artifactName}.reproducible-build-baseline.zip`);
  const reportPath = join(outDir, `ScriptVault-v${version}.reproducible-build.json`);

  if (!existsSync(artifactPath)) {
    throw new Error(`${artifactName} is missing; run bash build.sh before npm run release:reproducible-build:check`);
  }

  mkdirSync(outDir, { recursive: true });
  copyFileSync(artifactPath, backupPath);
  const expected = zipContentDigest(backupPath);

  try {
    execFileSync(process.execPath, ['scripts/run-bash.mjs', 'build.sh'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    const actual = zipContentDigest(artifactPath);
    const failures = compareDigests(expected, actual);
    const report = {
      version,
      artifact: artifactName,
      checkedAt: new Date().toISOString(),
      comparison: 'normalized-zip-entry-sha256',
      expectedEntryCount: expected.length,
      rebuiltEntryCount: actual.length,
      status: failures.length > 0 ? 'failed' : 'passed',
      failures,
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    if (failures.length > 0) {
      throw new Error(`reproducible build check failed:\n- ${failures.slice(0, 20).join('\n- ')}`);
    }

    console.log(`Reproducible build check passed for ${artifactName}.`);
    console.log(`Compared ${actual.length} normalized ZIP entries.`);
    console.log(`Report: ${relative(projectRoot, reportPath).replace(/\\/g, '/')}`);
  } finally {
    copyFileSync(backupPath, artifactPath);
    rmSync(backupPath, { force: true });
  }

  const firefoxArtifactName = `scriptvault-firefox-v${version}.zip`;
  const firefoxArtifactPath = join(projectRoot, 'firefox-artifacts', firefoxArtifactName);
  if (existsSync(firefoxArtifactPath)) {
    const firefoxBackupPath = join(outDir, `${firefoxArtifactName}.reproducible-build-baseline.zip`);
    const firefoxReportPath = join(outDir, `scriptvault-firefox-v${version}.reproducible-build.json`);
    copyFileSync(firefoxArtifactPath, firefoxBackupPath);
    const firefoxExpected = zipContentDigest(firefoxBackupPath);

    try {
      execFileSync(process.execPath, ['scripts/run-bash.mjs', 'build-firefox.sh', '--lint'], {
        cwd: projectRoot,
        stdio: 'inherit',
      });

      const firefoxActual = zipContentDigest(firefoxArtifactPath);
      const firefoxFailures = compareDigests(firefoxExpected, firefoxActual);
      const firefoxReport = {
        version,
        artifact: firefoxArtifactName,
        checkedAt: new Date().toISOString(),
        comparison: 'normalized-zip-entry-sha256',
        expectedEntryCount: firefoxExpected.length,
        rebuiltEntryCount: firefoxActual.length,
        status: firefoxFailures.length > 0 ? 'failed' : 'passed',
        failures: firefoxFailures,
      };
      writeFileSync(firefoxReportPath, `${JSON.stringify(firefoxReport, null, 2)}\n`);

      if (firefoxFailures.length > 0) {
        throw new Error(`Firefox reproducible build check failed:\n- ${firefoxFailures.slice(0, 20).join('\n- ')}`);
      }

      console.log(`Reproducible build check passed for ${firefoxArtifactName}.`);
      console.log(`Compared ${firefoxActual.length} normalized ZIP entries.`);
      console.log(`Report: ${relative(projectRoot, firefoxReportPath).replace(/\\/g, '/')}`);
    } finally {
      copyFileSync(firefoxBackupPath, firefoxArtifactPath);
      rmSync(firefoxBackupPath, { force: true });
    }
  } else {
    console.log(`Firefox artifact ${firefoxArtifactName} not found; skipping Firefox reproducible-build check.`);
  }
}

try {
  main();
} catch (e) {
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
}
