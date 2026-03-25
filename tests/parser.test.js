import { describe, it, expect } from 'vitest';

// Re-implement parseUserscript for testing (extracted from background.core.js)

function parseUserscript(code) {
  const metaBlockMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!metaBlockMatch) {
    return { error: 'No metadata block found. Scripts must include ==UserScript== header.' };
  }

  const meta = {
    name: 'Unnamed Script',
    namespace: 'scriptvault',
    version: '1.0.0',
    description: '',
    author: '',
    match: [],
    include: [],
    exclude: [],
    excludeMatch: [],
    grant: [],
    require: [],
    resource: {},
    'run-at': 'document-idle',
    noframes: false,
    icon: '',
    icon64: '',
    homepage: '',
    homepageURL: '',
    website: '',
    source: '',
    updateURL: '',
    downloadURL: '',
    supportURL: '',
    connect: [],
    antifeature: [],
    unwrap: false,
    'inject-into': 'auto',
    sandbox: '',
    tag: [],
    'run-in': '',
    'top-level-await': false,
    license: '',
    copyright: '',
    contributionURL: '',
    compatible: [],
    incompatible: [],
    webRequest: null,
    priority: 0
  };

  const metaBlock = metaBlockMatch[1];
  const lines = metaBlock.split('\n');

  for (const line of lines) {
    const match = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
    if (!match) continue;

    const key = match[1].trim();
    const value = (match[2] || '').trim();

    switch (key) {
      case 'name':
      case 'namespace':
      case 'version':
      case 'description':
      case 'author':
      case 'icon':
      case 'icon64':
      case 'homepage':
      case 'homepageURL':
      case 'website':
      case 'source':
      case 'updateURL':
      case 'downloadURL':
      case 'supportURL':
      case 'run-at':
      case 'inject-into':
      case 'sandbox':
      case 'run-in':
      case 'license':
      case 'copyright':
      case 'contributionURL':
        meta[key] = value;
        break;
      case 'match':
      case 'include':
      case 'exclude':
      case 'exclude-match':
      case 'excludeMatch':
      case 'grant':
      case 'require':
      case 'connect':
      case 'antifeature':
      case 'tag':
      case 'compatible':
      case 'incompatible': {
        const arrayKey = key === 'exclude-match' ? 'excludeMatch' : key;
        if (!meta[arrayKey]) meta[arrayKey] = [];
        if (value) meta[arrayKey].push(value);
        break;
      }
      case 'resource': {
        const resourceMatch = value.match(/^(\S+)\s+(.+)$/);
        if (resourceMatch) {
          meta.resource[resourceMatch[1]] = resourceMatch[2];
        }
        break;
      }
      case 'noframes':
        meta.noframes = true;
        break;
      case 'unwrap':
        meta.unwrap = true;
        break;
      case 'top-level-await':
        meta['top-level-await'] = true;
        break;
      case 'priority':
        meta.priority = parseInt(value, 10) || 0;
        break;
      case 'webRequest':
        try { meta.webRequest = JSON.parse(value); } catch (e) {}
        break;
      default:
        if (key.includes(':')) {
          const [baseKey, locale] = key.split(':');
          if (!meta.localized) meta.localized = {};
          if (!meta.localized[locale]) meta.localized[locale] = {};
          meta.localized[locale][baseKey] = value;
        }
    }
  }

  if (meta.grant.length === 0) {
    meta.grant = ['none'];
  }

  return { meta, code, metaBlock: metaBlockMatch[0] };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeScript(headers, body = '') {
  const lines = Object.entries(headers).flatMap(([k, v]) => {
    if (Array.isArray(v)) return v.map(val => `// @${k}  ${val}`);
    return [`// @${k}  ${v}`];
  });
  return `// ==UserScript==\n${lines.join('\n')}\n// ==/UserScript==\n${body}`;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('parseUserscript', () => {
  it('returns error when no metadata block is present', () => {
    const result = parseUserscript('console.log("hello");');
    expect(result.error).toBeDefined();
    expect(result.error).toContain('No metadata block');
  });

  it('parses a minimal script with defaults', () => {
    const code = '// ==UserScript==\n// @name Test\n// ==/UserScript==\nconsole.log(1);';
    const result = parseUserscript(code);
    expect(result.error).toBeUndefined();
    expect(result.meta.name).toBe('Test');
    expect(result.meta.version).toBe('1.0.0');
    expect(result.meta.namespace).toBe('scriptvault');
    expect(result.meta['run-at']).toBe('document-idle');
  });

  it('returns original code in the result', () => {
    const code = '// ==UserScript==\n// @name X\n// ==/UserScript==\nalert(1);';
    const result = parseUserscript(code);
    expect(result.code).toBe(code);
  });

  it('returns the raw metaBlock string', () => {
    const code = '// ==UserScript==\n// @name X\n// ==/UserScript==\n';
    const result = parseUserscript(code);
    expect(result.metaBlock).toContain('==UserScript==');
    expect(result.metaBlock).toContain('==/UserScript==');
  });

  it('parses scalar string fields', () => {
    const code = makeScript({
      name: 'My Script',
      namespace: 'https://example.com',
      version: '2.5.0',
      description: 'Does stuff',
      author: 'Alice',
      license: 'MIT',
    });
    const { meta } = parseUserscript(code);
    expect(meta.name).toBe('My Script');
    expect(meta.namespace).toBe('https://example.com');
    expect(meta.version).toBe('2.5.0');
    expect(meta.description).toBe('Does stuff');
    expect(meta.author).toBe('Alice');
    expect(meta.license).toBe('MIT');
  });

  it('parses multiple @match directives into an array', () => {
    const code = makeScript({
      name: 'Multi Match',
      match: ['https://example.com/*', 'https://test.com/*'],
    });
    const { meta } = parseUserscript(code);
    expect(meta.match).toEqual(['https://example.com/*', 'https://test.com/*']);
  });

  it('parses multiple @grant directives', () => {
    const code = makeScript({
      name: 'Grants',
      grant: ['GM_xmlhttpRequest', 'GM_setValue'],
    });
    const { meta } = parseUserscript(code);
    expect(meta.grant).toEqual(['GM_xmlhttpRequest', 'GM_setValue']);
  });

  it('defaults grant to ["none"] when no @grant is specified', () => {
    const code = makeScript({ name: 'No Grant' });
    const { meta } = parseUserscript(code);
    expect(meta.grant).toEqual(['none']);
  });

  it('parses @noframes as boolean true', () => {
    const code = '// ==UserScript==\n// @name NF\n// @noframes\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.noframes).toBe(true);
  });

  it('defaults noframes to false', () => {
    const code = makeScript({ name: 'Framed' });
    const { meta } = parseUserscript(code);
    expect(meta.noframes).toBe(false);
  });

  it('parses @unwrap as boolean true', () => {
    const code = '// ==UserScript==\n// @name UW\n// @unwrap\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.unwrap).toBe(true);
  });

  it('parses @top-level-await as boolean true', () => {
    const code = '// ==UserScript==\n// @name TLA\n// @top-level-await\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta['top-level-await']).toBe(true);
  });

  it('parses @priority as integer', () => {
    const code = makeScript({ name: 'Pri', priority: '5' });
    const { meta } = parseUserscript(code);
    expect(meta.priority).toBe(5);
  });

  it('defaults priority to 0 for non-numeric values', () => {
    const code = makeScript({ name: 'Pri', priority: 'abc' });
    const { meta } = parseUserscript(code);
    expect(meta.priority).toBe(0);
  });

  it('parses @resource with name and URL', () => {
    const code = makeScript({ name: 'Res', resource: 'css https://example.com/style.css' });
    const { meta } = parseUserscript(code);
    expect(meta.resource.css).toBe('https://example.com/style.css');
  });

  it('parses @exclude-match into excludeMatch array', () => {
    const code = '// ==UserScript==\n// @name EM\n// @exclude-match https://ads.example.com/*\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.excludeMatch).toEqual(['https://ads.example.com/*']);
  });

  it('parses @webRequest as JSON', () => {
    const code = makeScript({ name: 'WR', webRequest: '{"selector":"*://example.com/*"}' });
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toEqual({ selector: '*://example.com/*' });
  });

  it('ignores invalid @webRequest JSON gracefully', () => {
    const code = makeScript({ name: 'WR', webRequest: 'not-json' });
    const { meta } = parseUserscript(code);
    expect(meta.webRequest).toBeNull();
  });

  it('parses localized metadata (e.g. @name:ja)', () => {
    const code = '// ==UserScript==\n// @name Test\n// @name:ja テスト\n// @description:fr Description en français\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    expect(meta.localized.ja.name).toBe('テスト');
    expect(meta.localized.fr.description).toBe('Description en français');
  });

  it('parses @run-at', () => {
    const code = makeScript({ name: 'RA', 'run-at': 'document-start' });
    const { meta } = parseUserscript(code);
    expect(meta['run-at']).toBe('document-start');
  });

  it('parses @inject-into', () => {
    const code = makeScript({ name: 'II', 'inject-into': 'page' });
    const { meta } = parseUserscript(code);
    expect(meta['inject-into']).toBe('page');
  });

  it('handles script with extra whitespace in metadata lines', () => {
    const code = '// ==UserScript==\n//   @name   Spaced   Out  \n// ==/UserScript==\n';
    const result = parseUserscript(code);
    expect(result.meta.name).toBe('Spaced   Out');
  });

  it('handles empty @grant value (pushes nothing)', () => {
    const code = '// ==UserScript==\n// @name EG\n// @grant\n// ==/UserScript==\n';
    const { meta } = parseUserscript(code);
    // Empty grant value is not pushed, so falls to default ['none']
    expect(meta.grant).toEqual(['none']);
  });
});
