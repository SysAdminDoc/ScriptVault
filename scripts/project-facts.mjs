import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { workflowFiles } from './check-no-github-actions.mjs';

function readText(rootDir, path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

function readJson(rootDir, path) {
  return JSON.parse(readText(rootDir, path));
}

function minimumVersion(range) {
  return String(range || '').match(/\d+(?:\.\d+){1,2}/)?.[0] || '';
}

function installedPackageVersion(lock, packageName) {
  return lock.packages?.[`node_modules/${packageName}`]?.version || '';
}

function constObjectValues(source, name) {
  const block = source.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\} as const;`))?.[1] || '';
  return [...block.matchAll(/^\s*[A-Za-z0-9_]+:\s*'([^']+)'/gm)].map((match) => match[1]);
}

function pushMismatch(errors, label, values) {
  const normalized = values.map((value) => String(value || ''));
  if (normalized.some((value) => !value) || new Set(normalized).size !== 1) {
    errors.push(`${label} disagree: ${normalized.join(', ')}`);
  }
}

export function collectProjectFacts(rootDir = process.cwd()) {
  const root = resolve(rootDir);
  const packageJson = readJson(root, 'package.json');
  const packageLock = readJson(root, 'package-lock.json');
  const chromeManifest = readJson(root, 'manifest.json');
  const firefoxManifest = readJson(root, 'manifest-firefox.json');
  const promotionMap = readJson(root, 'ts-source-promotion.json');
  const idbSource = readText(root, 'src/storage/idb.ts');
  const errors = [];

  const nodeVersion = minimumVersion(packageJson.engines?.node);
  const npmVersion = minimumVersion(packageJson.engines?.npm);
  const packageManagerVersion = minimumVersion(packageJson.packageManager);
  const nodeVersionFile = readText(root, '.node-version').trim();
  const nvmVersionFile = readText(root, '.nvmrc').trim().replace(/^v/, '');

  pushMismatch(errors, 'project versions', [
    packageJson.version,
    packageLock.version,
    packageLock.packages?.['']?.version,
    chromeManifest.version,
    firefoxManifest.version,
  ]);
  pushMismatch(errors, 'Node toolchain versions', [nodeVersion, nodeVersionFile, nvmVersionFile]);
  pushMismatch(errors, 'npm toolchain versions', [npmVersion, packageManagerVersion]);

  const tools = {
    typescript: installedPackageVersion(packageLock, 'typescript'),
    monaco: installedPackageVersion(packageLock, 'monaco-editor'),
    cwsCli: installedPackageVersion(packageLock, 'chrome-webstore-upload-cli'),
  };
  const toolPackages = {
    typescript: 'typescript',
    monaco: 'monaco-editor',
    cwsCli: 'chrome-webstore-upload-cli',
  };
  for (const [name, version] of Object.entries(tools)) {
    if (!version) errors.push(`package-lock.json has no installed ${name} version`);
    const packageName = toolPackages[name];
    pushMismatch(errors, `${packageName} dependency specifications`, [
      packageJson.devDependencies?.[packageName],
      packageLock.packages?.['']?.devDependencies?.[packageName],
    ]);
  }

  const promotedEntries = (promotionMap.entries || []).filter((entry) => entry.status === 'promoted');
  for (const entry of promotedEntries) {
    if (!existsSync(join(root, entry.runtime))) errors.push(`promotion runtime is missing: ${entry.runtime}`);
    for (const source of entry.sources || []) {
      if (!existsSync(join(root, source))) errors.push(`promotion source is missing: ${source}`);
    }
  }

  const workflowPaths = workflowFiles(root);
  if (workflowPaths.length > 0) {
    errors.push(`local-only workflow policy violated by: ${workflowPaths.join(', ')}`);
  }
  if (packageJson.scripts?.['local-build-policy:check'] !== 'node scripts/check-no-github-actions.mjs') {
    errors.push('package.json local-build-policy:check is missing or changed');
  }

  const dashboardModules = readdirSync(resolve(root, 'pages'))
    .filter((name) => /^dashboard-[a-z0-9-]+\.js$/.test(name))
    .sort();

  const stores = constObjectValues(idbSource, 'Stores');
  const buckets = constObjectValues(idbSource, 'StorageBucketNames');
  if (stores.length === 0) errors.push('src/storage/idb.ts does not expose any canonical object stores');
  if (buckets.length === 0) errors.push('src/storage/idb.ts does not expose any canonical storage buckets');

  return {
    project: {
      version: packageJson.version,
      license: packageJson.license,
    },
    toolchain: {
      node: nodeVersion,
      npm: npmVersion,
    },
    tools,
    browsers: {
      chrome: {
        manifestVersion: chromeManifest.manifest_version,
        minimumVersion: chromeManifest.minimum_chrome_version,
      },
      firefox: {
        manifestVersion: firefoxManifest.manifest_version,
        minimumVersion: firefoxManifest.browser_specific_settings?.gecko?.strict_min_version,
      },
    },
    runtime: {
      promotedEntries: promotedEntries.length,
      dashboardModules: dashboardModules.length,
    },
    storage: {
      databaseName: idbSource.match(/export const DB_NAME = '([^']+)'/)?.[1] || '',
      schemaVersion: Number(idbSource.match(/export const DB_VERSION = (\d+)/)?.[1] || 0),
      stores,
      buckets,
    },
    delivery: {
      policy: 'local-only',
      workflowPaths,
    },
    sourceErrors: errors,
  };
}
