import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(resolve(root, path), 'utf8');

describe('Trusted Types extension-page contract', () => {
  it('enforces the named policy set in Chrome and generated Firefox manifests', () => {
    const policyDirective = 'trusted-types sv-dashboard sv-popup sv-install sv-devtools sv-sidepanel';
    for (const path of ['manifest.json', 'manifest-firefox.json']) {
      const manifest = JSON.parse(read(path));
      const csp = manifest.content_security_policy?.extension_pages || '';
      expect(csp).toContain("require-trusted-types-for 'script'");
      expect(csp).toContain(policyDirective);
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'self'");
    }
  });

  it('keeps project-owned page sinks behind policy or DOM construction', () => {
    const pageFiles = readdirSync(resolve(root, 'pages'))
      .filter(file => /\.(?:html|js)$/.test(file));
    const rawHtmlAssignment = /(?<!\\)\.\s*(?:innerHTML|outerHTML)\s*(?:\+?=)(?!=)/;

    for (const file of pageFiles) {
      const source = read(`pages/${file}`);
      expect(source, `${file} has a raw HTML assignment`).not.toMatch(rawHtmlAssignment);
      expect(source, `${file} stringifies HTML before createContextualFragment`).not.toContain(
        'createContextualFragment(String(html ??',
      );
    }

    const pageDir = read('pages/page-dir.js');
    const lazyLoader = read('pages/dashboard-lazy-loader.js');
    expect(pageDir).toContain('createScriptURL');
    expect(lazyLoader).toContain('createScriptURL(src)');
  });

  it('routes Trusted Types violations into the dashboard activity and CSP reports', () => {
    const dashboard = read('pages/dashboard.js');
    expect(dashboard).toContain("document.addEventListener('securitypolicyviolation'");
    expect(dashboard).toContain("CSPReporter.recordFailure(");
    expect(dashboard).toContain('Trusted Types blocked an HTML update');
  });
});
