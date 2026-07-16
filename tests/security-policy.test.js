import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('security policy', () => {
  it('ships a SECURITY.md with the required sections', () => {
    const policy = read('SECURITY.md');

    expect(policy).toContain('# Security Policy');
    expect(policy).toContain('## Supported Versions');
    expect(policy).toContain('## Reporting a Vulnerability');
    expect(policy).toContain('## Disclosure Window');
    expect(policy).toContain('GitHub private vulnerability reporting');
    // A concrete confidential contact must be present.
    expect(policy).toContain('matt_parker@outlook.com');
    // Do not overstate: no public-issue reporting for vulnerabilities.
    expect(policy).toContain('do not open a public issue');
  });

  it('links the security policy from the README', () => {
    const readme = read('README.md');
    expect(readme).toContain('[`SECURITY.md`](SECURITY.md)');
  });
});
