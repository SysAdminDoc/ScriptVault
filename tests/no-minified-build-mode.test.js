import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const esbuildConfig = read('esbuild.config.mjs');
const buildSh = read('build.sh');
const publishSh = read('publish.sh');
const buildFirefoxSh = read('build-firefox.sh');
const buildEdge = read('scripts/build-edge.mjs');
const readme = read('README.md');

// ScriptVault deliberately ships a readable bundle.
//
// `build:prod` existed and was reachable from no packaging, release, or test
// path, while the generated README support matrix claimed the Chrome package
// was built with it. It could not have been used safely: it wrote the MINIFIED
// bundle over the repo-root background.js, which is tracked, is what
// chrome://extensions loads as the unpacked extension, and is what a large part
// of the suite greps by symbol name. Running it would have corrupted all three.
//
// Removing it is the fix; these tests stop it coming back by accident.
describe('no minified build mode', () => {
  it('exposes no production build script', () => {
    expect(packageJson.scripts['build:prod']).toBeUndefined();
    const scriptBodies = Object.values(packageJson.scripts).join('\n');
    expect(scriptBodies).not.toContain('--prod');
  });

  it('accepts no --prod flag and never minifies the background bundle', () => {
    expect(esbuildConfig).not.toContain('--prod');
    expect(esbuildConfig).not.toContain('minify: true');
  });

  it('records why, so the next reader does not re-add it as an optimisation', () => {
    expect(esbuildConfig).toContain('no minified build mode');
    expect(esbuildConfig).toContain('background.js is tracked');
  });

  it('has no packaging path that asks for a production build', () => {
    for (const [name, source] of Object.entries({
      'build.sh': buildSh,
      'publish.sh': publishSh,
      'build-firefox.sh': buildFirefoxSh,
      'scripts/build-edge.mjs': buildEdge,
    })) {
      expect(source, `${name} must not request a minified build`).not.toContain('--prod');
      expect(source, `${name} must not request a minified build`).not.toContain('build:prod');
    }
  });

  it('documents the packaging command it actually runs', () => {
    // The generated support matrix used to claim `npm run build:prod` then
    // `bash build.sh`, which was doubly wrong: the script did not run, and
    // build.sh re-runs the plain esbuild pipeline over anything it produced.
    expect(readme).not.toContain('build:prod');
    expect(readme).toContain('bash build.sh');
  });
});
