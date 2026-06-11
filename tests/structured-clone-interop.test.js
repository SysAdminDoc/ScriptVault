import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const chromeManifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const publicApiSource = readFileSync(resolve(root, 'src/modules/public-api.ts'), 'utf8');

describe('structured-clone messaging interop gate', () => {
  it('keeps JSON messaging while the external extension Public API is enabled', () => {
    expect(publicApiSource).toContain('chrome.runtime.onMessageExternal.addListener(onExternalMessage)');
    expect(chromeManifest).not.toHaveProperty('message_serialization');
  });
});
