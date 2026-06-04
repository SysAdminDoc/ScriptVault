import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, createSign, generateKeyPairSync, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifySigstoreMessageSignature } from '../src/modules/sigstore-bundle-verifier.ts';

const SUBJECT = 'https://github.com/example/scriptvault/.github/workflows/release.yml@refs/heads/main';
const ISSUER = 'https://token.actions.githubusercontent.com';
let savedDigest;

beforeAll(() => {
  savedDigest = globalThis.crypto.subtle.digest;
  globalThis.crypto.subtle.digest = webcrypto.subtle.digest.bind(webcrypto.subtle);
});

afterAll(() => {
  globalThis.crypto.subtle.digest = savedDigest;
});

function derLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag, content) {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function sequence(parts) {
  return der(0x30, Buffer.concat(parts));
}

function explicit(index, content) {
  return der(0xa0 + index, content);
}

function contextPrimitive(index, content) {
  return der(0x80 + index, content);
}

function integer(value) {
  let bytes = [];
  let current = value;
  do {
    bytes.unshift(current & 0xff);
    current >>= 8;
  } while (current > 0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return der(0x02, Buffer.from(bytes));
}

function oidPart(value) {
  const bytes = [value & 0x7f];
  let current = value >> 7;
  while (current > 0) {
    bytes.unshift(0x80 | (current & 0x7f));
    current >>= 7;
  }
  return bytes;
}

function oid(value) {
  const parts = value.split('.').map((part) => Number(part));
  return der(0x06, Buffer.from([parts[0] * 40 + parts[1], ...parts.slice(2).flatMap(oidPart)]));
}

function utf8(value) {
  return der(0x0c, Buffer.from(value, 'utf8'));
}

function utcTime(value) {
  return der(0x17, Buffer.from(value, 'ascii'));
}

function octetString(value) {
  return der(0x04, value);
}

function bitString(value) {
  return der(0x03, Buffer.concat([Buffer.from([0]), value]));
}

function extension(extensionOid, value) {
  return sequence([oid(extensionOid), octetString(value)]);
}

function buildCertificate(spki, subject = SUBJECT, issuer = ISSUER) {
  const ecdsaWithSha256 = sequence([oid('1.2.840.10045.4.3.2')]);
  const emptyName = sequence([]);
  const validity = sequence([utcTime('250101000000Z'), utcTime('300101000000Z')]);
  const extensions = explicit(3, sequence([
    extension('2.5.29.17', sequence([contextPrimitive(6, Buffer.from(subject, 'ascii'))])),
    extension('1.3.6.1.4.1.57264.1.8', utf8(issuer)),
  ]));
  const tbs = sequence([
    explicit(0, integer(2)),
    integer(1),
    ecdsaWithSha256,
    emptyName,
    validity,
    emptyName,
    spki,
    extensions,
  ]);
  return sequence([tbs, ecdsaWithSha256, bitString(Buffer.from([0]))]);
}

function makeSignedBundle(artifact = 'console.log("signed");', options = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const certificate = buildCertificate(spki, options.subject || SUBJECT, options.issuer || ISSUER);
  const signer = createSign('sha256');
  signer.update(artifact);
  signer.end();
  return {
    artifact,
    bundle: {
      mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
      verificationMaterial: {
        certificate: { rawBytes: certificate.toString('base64') },
      },
      messageSignature: {
        messageDigest: {
          algorithm: 'SHA2_256',
          digest: createHash('sha256').update(artifact).digest('base64'),
        },
        signature: signer.sign(privateKey).toString('base64'),
      },
    },
  };
}

describe('Sigstore bundle verifier', () => {
  it('verifies a message signature against the leaf certificate public key and identity', async () => {
    const fixture = makeSignedBundle();
    const result = await verifySigstoreMessageSignature({
      bundle: fixture.bundle,
      artifact: fixture.artifact,
      expectedIdentity: `${SUBJECT} (issuer: ${ISSUER})`,
    });

    expect(result).toMatchObject({
      success: true,
      status: 'verified',
      verification: 'signature-verified',
      certificateIdentity: SUBJECT,
      certificateIssuer: ISSUER,
      digestVerified: true,
      signatureVerified: true,
      rootVerified: 'not-checked',
    });
  });

  it('rejects a tampered artifact before signature verification', async () => {
    const fixture = makeSignedBundle();
    const result = await verifySigstoreMessageSignature({
      bundle: fixture.bundle,
      artifact: `${fixture.artifact}\nalert("tampered");`,
      expectedIdentity: `${SUBJECT} (issuer: ${ISSUER})`,
    });

    expect(result).toMatchObject({
      success: false,
      verification: 'signature-failed',
      error: 'Sigstore message digest does not match artifact bytes',
      digestVerified: false,
      signatureVerified: false,
    });
  });

  it('rejects mismatched certificate identity and issuer declarations', async () => {
    const fixture = makeSignedBundle();
    const wrongSubject = await verifySigstoreMessageSignature({
      bundle: fixture.bundle,
      artifact: fixture.artifact,
      expectedIdentity: `https://github.com/attacker/repo/.github/workflows/release.yml@refs/heads/main (issuer: ${ISSUER})`,
    });
    const wrongIssuer = await verifySigstoreMessageSignature({
      bundle: fixture.bundle,
      artifact: fixture.artifact,
      expectedIdentity: `${SUBJECT} (issuer: https://issuer.example.invalid)`,
    });

    expect(wrongSubject).toMatchObject({
      success: false,
      signatureVerified: true,
      error: 'Sigstore certificate identity does not match @require-identity subject',
    });
    expect(wrongIssuer).toMatchObject({
      success: false,
      signatureVerified: true,
      error: 'Sigstore certificate issuer does not match @require-identity issuer',
    });
  });

  it('uses the first certificate in an X.509 chain as the leaf certificate', async () => {
    const fixture = makeSignedBundle();
    const certificate = fixture.bundle.verificationMaterial.certificate.rawBytes;
    fixture.bundle.verificationMaterial = {
      x509CertificateChain: {
        certificates: [{ rawBytes: certificate }],
      },
    };

    await expect(verifySigstoreMessageSignature({
      bundle: fixture.bundle,
      artifact: fixture.artifact,
      expectedIdentity: `${SUBJECT} (issuer: ${ISSUER})`,
    })).resolves.toMatchObject({ success: true, signatureVerified: true });
  });

  it('reports DSSE bundles as unsupported for the message-signature verifier phase', async () => {
    const fixture = makeSignedBundle();
    const certificate = fixture.bundle.verificationMaterial.certificate.rawBytes;
    const result = await verifySigstoreMessageSignature({
      bundle: {
        mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
        verificationMaterial: {
          certificate: { rawBytes: certificate },
        },
        dsseEnvelope: {
          payload: Buffer.from('{}').toString('base64'),
          payloadType: 'application/vnd.in-toto+json',
          signatures: [{ keyid: 'test', sig: Buffer.from('sig').toString('base64') }],
        },
      },
      artifact: fixture.artifact,
    });

    expect(result).toMatchObject({
      success: false,
      status: 'unsupported',
      verification: 'unsupported-bundle',
    });
  });

  it('exposes the verifier from the generated runtime module', async () => {
    const runtime = readFileSync(resolve(process.cwd(), 'modules/sigstore-bundle-verifier.js'), 'utf8');
    const SigstoreBundleVerifier = new Function(`${runtime}\nreturn SigstoreBundleVerifier;`)();
    const fixture = makeSignedBundle();

    await expect(SigstoreBundleVerifier.verifyMessageSignature({
      bundle: fixture.bundle,
      artifact: fixture.artifact,
      expectedIdentity: `${SUBJECT} (issuer: ${ISSUER})`,
    })).resolves.toMatchObject({ success: true, verification: 'signature-verified' });
  });
});
