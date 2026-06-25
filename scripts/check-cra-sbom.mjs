#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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

function expectedDirectDependencyRefs(pkg, lock) {
  return directDependencyNames(pkg)
    .map((name) => {
      const meta = lock.packages?.[`node_modules/${name}`];
      return meta?.version ? packagePurl(name, meta.version) : null;
    })
    .filter(Boolean)
    .sort();
}

function licenseExpression(entry) {
  const licenses = Array.isArray(entry?.licenses) ? entry.licenses : [];
  return licenses.find((license) => typeof license?.expression === 'string' && license.expression.trim())?.expression || '';
}

function push(failures, condition, message) {
  if (!condition) failures.push(message);
}

export function validateCraSbom(sbom, pkg, lock) {
  const failures = [];
  const rootRef = packagePurl(pkg.name, pkg.version);
  const components = Array.isArray(sbom?.components) ? sbom.components : [];
  const dependencies = Array.isArray(sbom?.dependencies) ? sbom.dependencies : [];
  const componentRefs = new Set(components.map((component) => component?.['bom-ref']).filter(Boolean));
  const allRefs = new Set([rootRef, ...componentRefs]);

  push(failures, sbom?.bomFormat === 'CycloneDX', 'SBOM bomFormat must be CycloneDX');
  push(failures, sbom?.specVersion === '1.7', 'SBOM specVersion must be CycloneDX 1.7');
  push(failures, /^urn:uuid:[0-9a-f-]{36}$/i.test(String(sbom?.serialNumber || '')), 'SBOM serialNumber must be a UUID URN');
  push(failures, Number.isInteger(sbom?.version) && sbom.version > 0, 'SBOM version must be a positive integer');
  push(failures, typeof sbom?.metadata?.timestamp === 'string' && !Number.isNaN(Date.parse(sbom.metadata.timestamp)), 'SBOM metadata.timestamp must be an ISO timestamp');
  push(failures, typeof sbom?.metadata?.supplier?.name === 'string' && sbom.metadata.supplier.name.trim().length > 0, 'SBOM metadata.supplier.name is required');

  const product = sbom?.metadata?.component || {};
  push(failures, product.type === 'application', 'SBOM metadata.component.type must be application');
  push(failures, product.name === pkg.name, 'SBOM metadata.component.name must match package.json');
  push(failures, product.version === pkg.version, 'SBOM metadata.component.version must match package.json');
  push(failures, product['bom-ref'] === rootRef, 'SBOM metadata.component bom-ref must be the package purl');
  push(failures, product.purl === rootRef, 'SBOM metadata.component purl must be present');
  push(failures, licenseExpression(product) === (pkg.license || 'MIT'), 'SBOM metadata.component license must match package.json');

  push(failures, components.length > 0, 'SBOM must include dependency components');
  const seenRefs = new Set();
  for (const component of components) {
    const label = component?.name || '<unknown>';
    const ref = component?.['bom-ref'];
    push(failures, component?.type === 'library', `Component ${label} must be type library`);
    push(failures, typeof component?.version === 'string' && component.version.length > 0, `Component ${label} must include version`);
    push(failures, typeof component?.purl === 'string' && component.purl === ref, `Component ${label} must use purl as bom-ref`);
    push(failures, licenseExpression(component).length > 0, `Component ${label} must include a license expression`);
    push(failures, !seenRefs.has(ref), `Duplicate component bom-ref ${ref || '<missing>'}`);
    seenRefs.add(ref);
  }

  const byName = new Map(components.map((component) => [component.name, component]));
  for (const name of directDependencyNames(pkg)) {
    const component = byName.get(name);
    const lockMeta = lock.packages?.[`node_modules/${name}`];
    push(failures, Boolean(component), `Direct dependency ${name} is missing from SBOM components`);
    push(failures, component?.version === lockMeta?.version, `Direct dependency ${name} version must match package-lock.json`);
    push(failures, licenseExpression(component).length > 0, `Direct dependency ${name} must include license`);
  }

  const rootDependency = dependencies.find((entry) => entry?.ref === rootRef);
  const expectedDirectRefs = expectedDirectDependencyRefs(pkg, lock);
  const actualDirectRefs = [...(rootDependency?.dependsOn || [])].sort();
  push(failures, Boolean(rootDependency), 'SBOM dependency graph must include the product root');
  push(
    failures,
    JSON.stringify(actualDirectRefs) === JSON.stringify(expectedDirectRefs),
    'SBOM root dependency graph must list direct package.json dependencies',
  );

  for (const entry of dependencies) {
    push(failures, allRefs.has(entry?.ref), `Dependency graph ref ${entry?.ref || '<missing>'} has no matching component`);
    const dependsOn = Array.isArray(entry?.dependsOn) ? entry.dependsOn : [];
    for (const ref of dependsOn) {
      push(failures, allRefs.has(ref), `Dependency graph dependsOn ref ${ref} has no matching component`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    counts: {
      components: components.length,
      dependencies: dependencies.length,
      directDependencies: expectedDirectRefs.length,
    },
  };
}

function defaultSbomPath(root = projectRoot) {
  const pkg = readJson(join(root, 'package.json'));
  return join(root, 'release-artifacts', `ScriptVault-v${pkg.version}.sbom.cyclonedx.json`);
}

function main() {
  const sbomPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : defaultSbomPath();
  if (!existsSync(sbomPath)) {
    console.error(`CRA SBOM check failed: ${sbomPath} is missing; run npm run release:trust first`);
    process.exit(1);
  }

  const pkg = readJson(join(projectRoot, 'package.json'));
  const lock = readJson(join(projectRoot, 'package-lock.json'));
  const report = validateCraSbom(readJson(sbomPath), pkg, lock);
  if (!report.ok) {
    console.error('CRA SBOM check failed:');
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`CRA SBOM check passed (${report.counts.components} components, ${report.counts.directDependencies} direct dependencies).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
