import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseSigstoreBundle, safeParseSigstoreBundle } from '../src/modules/sigstore-bundle-parser.ts';

const BASE_BUNDLE = {
  mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
  verificationMaterial: {
    certificate: { rawBytes: 'Q0VSVA==' },
    tlogEntries: [{
      logIndex: '123',
      logId: { keyId: 'S0VZ' },
      kindVersion: { kind: 'hashedrekord', version: '0.0.1' },
      integratedTime: '1724870676',
      inclusionPromise: { signedEntryTimestamp: 'U0VU' },
      inclusionProof: {
        logIndex: '7',
        rootHash: 'Uk9PVA==',
        treeSize: '8',
        hashes: ['SEFTSA=='],
        checkpoint: { envelope: 'rekor.example/checkpoint' },
      },
      canonicalizedBody: 'Qk9EWQ==',
    }],
    timestampVerificationData: {
      rfc3161Timestamps: [{ signedTimestamp: 'VElNRQ==' }],
    },
  },
  messageSignature: {
    messageDigest: { algorithm: 'SHA2_256', digest: 'RElHRVNU' },
    signature: 'U0lH',
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('Sigstore bundle parser', () => {
  it('normalizes v0.3 message signature bundles with certificate material', () => {
    const parsed = parseSigstoreBundle(JSON.stringify(BASE_BUNDLE));

    expect(parsed).toMatchObject({
      mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
      contentType: 'messageSignature',
      keyMaterialType: 'certificate',
      verificationMaterial: {
        certificateRawBytes: 'Q0VSVA==',
        publicKeyHint: '',
        rfc3161Timestamps: ['VElNRQ=='],
      },
      messageSignature: {
        signature: 'U0lH',
        messageDigest: { algorithm: 'SHA2_256', digest: 'RElHRVNU' },
      },
    });
    expect(parsed.verificationMaterial.tlogEntries[0]).toMatchObject({
      logIndex: '123',
      logIdKeyId: 'S0VZ',
      kind: 'hashedrekord',
      signedEntryTimestamp: 'U0VU',
      inclusionProof: {
        rootHash: 'Uk9PVA==',
        hashes: ['SEFTSA=='],
        checkpointEnvelope: 'rekor.example/checkpoint',
      },
    });
  });

  it('accepts protobuf oneof JSON shape for message signatures', () => {
    const bundle = clone(BASE_BUNDLE);
    bundle.content = { $case: 'messageSignature', messageSignature: bundle.messageSignature };
    delete bundle.messageSignature;

    const parsed = parseSigstoreBundle(bundle);

    expect(parsed.contentType).toBe('messageSignature');
    expect(parsed.messageSignature.signature).toBe('U0lH');
  });

  it('parses DSSE bundles with an X.509 certificate chain', () => {
    const bundle = clone(BASE_BUNDLE);
    bundle.verificationMaterial = {
      x509CertificateChain: {
        certificates: [{ rawBytes: 'Q0VSVDE=' }, { rawBytes: 'Q0VSVDI=' }],
      },
      tlogEntries: [],
    };
    delete bundle.messageSignature;
    bundle.dsseEnvelope = {
      payload: 'UEFZTE9BRA==',
      payloadType: 'application/vnd.in-toto+json',
      signatures: [{ keyid: 'leaf', sig: 'RFNTRVNJRw==' }],
    };

    const parsed = parseSigstoreBundle(bundle);

    expect(parsed.contentType).toBe('dsseEnvelope');
    expect(parsed.keyMaterialType).toBe('x509CertificateChain');
    expect(parsed.verificationMaterial.certificateChainRawBytes).toEqual(['Q0VSVDE=', 'Q0VSVDI=']);
    expect(parsed.dsseEnvelope.signatures).toEqual([{ keyid: 'leaf', sig: 'RFNTRVNJRw==' }]);
  });

  it('parses public key identifier bundles for non-public-instance signatures', () => {
    const bundle = clone(BASE_BUNDLE);
    bundle.verificationMaterial = {
      publicKeyIdentifier: { hint: 'maintainer-key-v1' },
      tlogEntries: [],
    };

    const parsed = parseSigstoreBundle(bundle);

    expect(parsed.keyMaterialType).toBe('publicKeyIdentifier');
    expect(parsed.verificationMaterial.publicKeyHint).toBe('maintainer-key-v1');
  });

  it('rejects unsupported media types and malformed base64 fields', () => {
    expect(safeParseSigstoreBundle({ ...BASE_BUNDLE, mediaType: 'application/json' })).toMatchObject({
      success: false,
      error: expect.stringContaining('unsupported Sigstore bundle mediaType'),
    });
    const malformed = clone(BASE_BUNDLE);
    malformed.messageSignature.signature = 'not base64!';
    expect(safeParseSigstoreBundle(malformed)).toMatchObject({
      success: false,
      error: expect.stringContaining('messageSignature.signature must be base64 encoded'),
    });
  });

  it('requires exactly one key material source and one DSSE signature', () => {
    const ambiguous = clone(BASE_BUNDLE);
    ambiguous.verificationMaterial.publicKeyIdentifier = { hint: 'also-present' };
    expect(safeParseSigstoreBundle(ambiguous)).toMatchObject({
      success: false,
      error: expect.stringContaining('exactly one key material source'),
    });

    const dsse = clone(BASE_BUNDLE);
    dsse.verificationMaterial = { publicKeyIdentifier: { hint: 'key' }, tlogEntries: [] };
    delete dsse.messageSignature;
    dsse.dsseEnvelope = {
      payload: 'UEFZTE9BRA==',
      payloadType: 'application/vnd.in-toto+json',
      signatures: [{ keyid: 'a', sig: 'QQ==' }, { keyid: 'b', sig: 'Qg==' }],
    };
    expect(safeParseSigstoreBundle(dsse)).toMatchObject({
      success: false,
      error: expect.stringContaining('exactly one signature'),
    });
  });

  it('generates a runtime parser artifact with the same public API', () => {
    const runtime = readFileSync(resolve(process.cwd(), 'modules/sigstore-bundle-parser.js'), 'utf8');
    const SigstoreBundleParser = new Function(`${runtime}\nreturn SigstoreBundleParser;`)();

    const parsed = SigstoreBundleParser.parse(BASE_BUNDLE);

    expect(parsed.messageSignature.signature).toBe('U0lH');
    expect(SigstoreBundleParser.safeParse({ mediaType: 'bad' }).success).toBe(false);
  });
});
