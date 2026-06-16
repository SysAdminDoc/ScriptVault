import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = process.cwd();
const scannerPath = resolve(root, 'scripts/check-asset-integrity.mjs');
const scannerSource = readFileSync(scannerPath, 'utf8');

describe('asset integrity scanner', () => {
  it('exists and is executable', () => {
    expect(existsSync(scannerPath)).toBe(true);
    expect(scannerSource).toContain('check-asset-integrity');
  });

  it('detects PNG IEND trailing data', () => {
    expect(scannerSource).toContain('PNG_IEND');
    expect(scannerSource).toContain('bytes after IEND');
  });

  it('detects SVG dangerous patterns', () => {
    expect(scannerSource).toContain('SVG_DANGEROUS_PATTERNS');
    expect(scannerSource).toContain('<script');
    expect(scannerSource).toContain('javascript:');
    expect(scannerSource).toContain('xlink:href');
  });

  it('detects ZIP signatures in trailing data', () => {
    expect(scannerSource).toContain('ZIP_MAGIC_LOCAL');
    expect(scannerSource).toContain('ZIP signature');
  });

  it('detects script signatures in trailing bytes', () => {
    expect(scannerSource).toContain('SCRIPT_SIGNATURES');
    expect(scannerSource).toContain('HTML doctype');
    expect(scannerSource).toContain('JS function');
  });

  it('scans ICO for unexpected trailing bytes', () => {
    expect(scannerSource).toContain('scanIco');
    expect(scannerSource).toContain('unexpected trailing bytes');
  });

  it('scans the images/ directory', () => {
    expect(scannerSource).toContain("'images'");
    expect(scannerSource).toContain("ASSET_EXTENSIONS");
  });

  it('has an npm script wired in package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['release:asset-integrity']).toBe('node scripts/check-asset-integrity.mjs');
  });

  it('current packaged assets pass the scan', async () => {
    const { execFileSync } = await import('node:child_process');
    const result = execFileSync('node', [scannerPath], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000
    });
    expect(result).toContain('assets clean');
  });
});
