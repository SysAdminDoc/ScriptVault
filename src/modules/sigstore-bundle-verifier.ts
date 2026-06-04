import { parseSigstoreBundle, type ParsedSigstoreBundle } from './sigstore-bundle-parser';

type VerificationStatus = 'verified' | 'failed' | 'unsupported';
type ProvenanceVerification = 'signature-verified' | 'signature-failed' | 'unsupported-bundle';

export interface SigstoreSignatureVerificationResult {
  success: boolean;
  status: VerificationStatus;
  verification: ProvenanceVerification;
  error?: string;
  certificateIdentity?: string;
  certificateIssuer?: string;
  digestVerified: boolean;
  signatureVerified: boolean;
  rootVerified: 'not-checked';
}

export interface SigstoreSignatureVerificationOptions {
  bundle: string | Record<string, unknown> | ParsedSigstoreBundle;
  artifact: string | ArrayBuffer | Uint8Array;
  expectedIdentity?: string;
}

interface DerNode {
  tag: number;
  start: number;
  valueStart: number;
  valueEnd: number;
  end: number;
}

interface CertificateIdentity {
  subjects: string[];
  issuer: string;
}

interface EcPoint {
  x: bigint;
  y: bigint;
}

interface EcdsaSignature {
  r: bigint;
  s: bigint;
}

const FULCIO_ISSUER_OIDS = new Set([
  '1.3.6.1.4.1.57264.1.1',
  '1.3.6.1.4.1.57264.1.8',
]);

const P256 = {
  p: BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
  n: BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
  a: BigInt('0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc'),
  gx: BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
  gy: BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
};

function isParsedBundle(value: SigstoreSignatureVerificationOptions['bundle']): value is ParsedSigstoreBundle {
  return !!value
    && typeof value === 'object'
    && 'contentType' in value
    && 'verificationMaterial' in value;
}

function normalizeBase64(value: string): string {
  let normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const remainder = normalized.length % 4;
  if (remainder === 2) normalized += '==';
  else if (remainder === 3) normalized += '=';
  else if (remainder === 1) throw new Error('Invalid base64 length');
  return normalized;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(normalizeBase64(value));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function artifactToBytes(value: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  return value;
}

function mod(value: bigint, modulus: bigint): bigint {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function modInverse(value: bigint, modulus: bigint): bigint {
  let oldR = mod(value, modulus);
  let r = modulus;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  if (oldR !== 1n) throw new Error('Value has no modular inverse');
  return mod(oldS, modulus);
}

function pointDouble(point: EcPoint): EcPoint | null {
  if (point.y === 0n) return null;
  const slope = mod((3n * point.x * point.x + P256.a) * modInverse(2n * point.y, P256.p), P256.p);
  const x = mod(slope * slope - 2n * point.x, P256.p);
  const y = mod(slope * (point.x - x) - point.y, P256.p);
  return { x, y };
}

function pointAdd(left: EcPoint | null, right: EcPoint | null): EcPoint | null {
  if (!left) return right;
  if (!right) return left;
  if (left.x === right.x) {
    if (mod(left.y + right.y, P256.p) === 0n) return null;
    return pointDouble(left);
  }
  const slope = mod((right.y - left.y) * modInverse(right.x - left.x, P256.p), P256.p);
  const x = mod(slope * slope - left.x - right.x, P256.p);
  const y = mod(slope * (left.x - x) - left.y, P256.p);
  return { x, y };
}

function pointMultiply(point: EcPoint, scalar: bigint): EcPoint | null {
  let addend: EcPoint | null = point;
  let result: EcPoint | null = null;
  let k = scalar;
  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend);
    addend = addend ? pointDouble(addend) : null;
    k >>= 1n;
  }
  return result;
}

function verifyP256Digest(publicKey: EcPoint, digest: Uint8Array, signature: EcdsaSignature): boolean {
  const { r, s } = signature;
  if (r <= 0n || r >= P256.n || s <= 0n || s >= P256.n) return false;
  const e = toBigInt(digest);
  const w = modInverse(s, P256.n);
  const u1 = mod(e * w, P256.n);
  const u2 = mod(r * w, P256.n);
  const point = pointAdd(
    pointMultiply({ x: P256.gx, y: P256.gy }, u1),
    pointMultiply(publicKey, u2),
  );
  return !!point && mod(point.x, P256.n) === r;
}

function readDerNode(bytes: Uint8Array, offset = 0): DerNode {
  if (offset >= bytes.length) throw new Error('Unexpected end of DER data');
  const start = offset;
  const tag = bytes[offset++];
  if (tag == null) throw new Error('Missing DER tag');
  const firstLength = bytes[offset++];
  if (firstLength == null) throw new Error('Missing DER length');
  let length = firstLength;
  if (firstLength & 0x80) {
    const lengthBytes = firstLength & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4) throw new Error('Unsupported DER length');
    length = 0;
    for (let i = 0; i < lengthBytes; i += 1) {
      const byte = bytes[offset++];
      if (byte == null) throw new Error('Truncated DER length');
      length = (length << 8) | byte;
    }
  }
  const valueStart = offset;
  const valueEnd = valueStart + length;
  if (valueEnd > bytes.length) throw new Error('DER value exceeds input length');
  return { tag, start, valueStart, valueEnd, end: valueEnd };
}

function derValue(bytes: Uint8Array, node: DerNode): Uint8Array {
  return bytes.slice(node.valueStart, node.valueEnd);
}

function derFull(bytes: Uint8Array, node: DerNode): Uint8Array {
  return bytes.slice(node.start, node.end);
}

function readDerChildren(bytes: Uint8Array, node: DerNode): DerNode[] {
  const children: DerNode[] = [];
  let offset = node.valueStart;
  while (offset < node.valueEnd) {
    const child = readDerNode(bytes, offset);
    children.push(child);
    offset = child.end;
  }
  if (offset !== node.valueEnd) throw new Error('Invalid DER child boundary');
  return children;
}

function parseDerInteger(bytes: Uint8Array): bigint {
  let value = bytes;
  while (value.length > 1 && value[0] === 0) value = value.slice(1);
  return toBigInt(value);
}

function parseEcdsaSignature(bytes: Uint8Array): EcdsaSignature {
  if (bytes.length === 64) {
    return { r: toBigInt(bytes.slice(0, 32)), s: toBigInt(bytes.slice(32)) };
  }
  const sequence = readDerNode(bytes, 0);
  if (sequence.tag !== 0x30 || sequence.end !== bytes.length) throw new Error('ECDSA signature must be DER sequence or raw P-256 signature');
  const parts = readDerChildren(bytes, sequence);
  if (parts.length !== 2 || parts[0]?.tag !== 0x02 || parts[1]?.tag !== 0x02) {
    throw new Error('ECDSA DER signature must contain r and s integers');
  }
  return {
    r: parseDerInteger(derValue(bytes, parts[0])),
    s: parseDerInteger(derValue(bytes, parts[1])),
  };
}

function decodeOid(value: Uint8Array): string {
  if (value.length === 0) throw new Error('OID is empty');
  const first = value[0]!;
  const parts = [Math.floor(first / 40), first % 40];
  let current = 0;
  for (let i = 1; i < value.length; i += 1) {
    current = (current << 7) | (value[i]! & 0x7f);
    if ((value[i]! & 0x80) === 0) {
      parts.push(current);
      current = 0;
    }
  }
  return parts.join('.');
}

function decodeDerText(value: Uint8Array): string {
  return new TextDecoder('utf-8').decode(value).trim();
}

function parseSpkiPublicKey(spkiBytes: Uint8Array): EcPoint {
  const sequence = readDerNode(spkiBytes, 0);
  if (sequence.tag !== 0x30 || sequence.end !== spkiBytes.length) throw new Error('SPKI must be a DER sequence');
  const children = readDerChildren(spkiBytes, sequence);
  const bitString = children[1];
  if (!bitString || bitString.tag !== 0x03) throw new Error('SPKI is missing public key bit string');
  const value = derValue(spkiBytes, bitString);
  if (value[0] !== 0) throw new Error('SPKI public key has unsupported unused bits');
  const point = value.slice(1);
  if (point.length !== 65 || point[0] !== 0x04) throw new Error('SPKI public key must be uncompressed P-256');
  return {
    x: toBigInt(point.slice(1, 33)),
    y: toBigInt(point.slice(33, 65)),
  };
}

function getTbsCertificateChildren(certBytes: Uint8Array): DerNode[] {
  const certificate = readDerNode(certBytes, 0);
  if (certificate.tag !== 0x30 || certificate.end !== certBytes.length) throw new Error('Certificate must be a DER sequence');
  const certParts = readDerChildren(certBytes, certificate);
  const tbsCertificate = certParts[0];
  if (!tbsCertificate || tbsCertificate.tag !== 0x30) throw new Error('Certificate missing TBSCertificate');
  return readDerChildren(certBytes, tbsCertificate);
}

function extractSubjectPublicKeyInfo(certBytes: Uint8Array): Uint8Array {
  const children = getTbsCertificateChildren(certBytes);
  let index = children[0]?.tag === 0xa0 ? 1 : 0;
  index += 5;
  const spki = children[index];
  if (!spki || spki.tag !== 0x30) throw new Error('Certificate missing SubjectPublicKeyInfo');
  return derFull(certBytes, spki);
}

function parseSubjectAltName(value: Uint8Array): string[] {
  const sequence = readDerNode(value, 0);
  if (sequence.tag !== 0x30) return [];
  return readDerChildren(value, sequence)
    .filter((name) => name.tag === 0x86 || name.tag === 0x81)
    .map((name) => decodeDerText(derValue(value, name)))
    .filter(Boolean);
}

function parseExtensionText(value: Uint8Array): string {
  try {
    const inner = readDerNode(value, 0);
    if ([0x0c, 0x16, 0x13].includes(inner.tag)) return decodeDerText(derValue(value, inner));
  } catch {
    // Some fixtures encode the extension value directly in the OCTET STRING.
  }
  return decodeDerText(value);
}

function extractCertificateIdentity(certBytes: Uint8Array): CertificateIdentity {
  const subjects: string[] = [];
  let issuer = '';
  const children = getTbsCertificateChildren(certBytes);
  for (const extensionWrapper of children.filter((child) => child.tag === 0xa3)) {
    const wrapperChildren = readDerChildren(certBytes, extensionWrapper);
    const extensions = wrapperChildren[0];
    if (!extensions || extensions.tag !== 0x30) continue;
    for (const extension of readDerChildren(certBytes, extensions)) {
      if (extension.tag !== 0x30) continue;
      const parts = readDerChildren(certBytes, extension);
      const oidNode = parts[0];
      if (!oidNode || oidNode.tag !== 0x06) continue;
      const oid = decodeOid(derValue(certBytes, oidNode));
      const octetNode = parts.find((part) => part.tag === 0x04);
      if (!octetNode) continue;
      const octets = derValue(certBytes, octetNode);
      if (oid === '2.5.29.17') {
        subjects.push(...parseSubjectAltName(octets));
      } else if (FULCIO_ISSUER_OIDS.has(oid)) {
        issuer = parseExtensionText(octets);
      }
    }
  }
  return { subjects: [...new Set(subjects)], issuer };
}

function parseIdentityDeclaration(value = ''): { subject: string; issuer: string } {
  const match = value.match(/^\s*(.*?)\s*(?:\(\s*issuer:\s*([^)]+?)\s*\))?\s*$/i);
  return {
    subject: (match?.[1] || value).trim(),
    issuer: (match?.[2] || '').trim(),
  };
}

function selectLeafCertificate(bundle: ParsedSigstoreBundle): string {
  if (bundle.verificationMaterial.certificateRawBytes) return bundle.verificationMaterial.certificateRawBytes;
  return bundle.verificationMaterial.certificateChainRawBytes[0] || '';
}

function digestAlgorithmName(algorithm: string): string {
  const normalized = algorithm.toUpperCase().replace(/[-_]/g, '');
  if (normalized === 'SHA2256' || normalized === 'SHA256') return 'SHA-256';
  throw new Error(`Unsupported message digest algorithm: ${algorithm}`);
}

function failure(error: string, verification: ProvenanceVerification = 'signature-failed', extra: Partial<SigstoreSignatureVerificationResult> = {}): SigstoreSignatureVerificationResult {
  return {
    success: false,
    status: verification === 'unsupported-bundle' ? 'unsupported' : 'failed',
    verification,
    error,
    digestVerified: false,
    signatureVerified: false,
    rootVerified: 'not-checked',
    ...extra,
  };
}

export async function verifySigstoreMessageSignature(
  options: SigstoreSignatureVerificationOptions,
): Promise<SigstoreSignatureVerificationResult> {
  try {
    const bundle = isParsedBundle(options.bundle) ? options.bundle : parseSigstoreBundle(options.bundle);
    if (bundle.contentType !== 'messageSignature' || !bundle.messageSignature) {
      return failure('Only Sigstore messageSignature bundles are supported by this verifier phase', 'unsupported-bundle');
    }

    const certificate = selectLeafCertificate(bundle);
    if (!certificate) {
      return failure('Sigstore bundle does not include certificate material');
    }

    const artifactBytes = artifactToBytes(options.artifact);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytesToArrayBuffer(artifactBytes)));
    let digestVerified = false;
    const messageDigest = bundle.messageSignature.messageDigest;
    if (messageDigest) {
      digestAlgorithmName(messageDigest.algorithm);
      const expectedDigest = normalizeBase64(messageDigest.digest);
      const actualDigest = normalizeBase64(bytesToBase64(digest));
      if (expectedDigest !== actualDigest) {
        return failure('Sigstore message digest does not match artifact bytes', 'signature-failed', { digestVerified: false });
      }
      digestVerified = true;
    }

    const certBytes = base64ToBytes(certificate);
    const certificateIdentity = extractCertificateIdentity(certBytes);
    const publicKey = parseSpkiPublicKey(extractSubjectPublicKeyInfo(certBytes));
    const signature = parseEcdsaSignature(base64ToBytes(bundle.messageSignature.signature));
    const signatureVerified = verifyP256Digest(publicKey, digest, signature);
    if (!signatureVerified) {
      return failure('Sigstore signature does not verify against artifact digest', 'signature-failed', {
        certificateIdentity: certificateIdentity.subjects[0] || '',
        certificateIssuer: certificateIdentity.issuer,
        digestVerified,
      });
    }

    const expected = parseIdentityDeclaration(options.expectedIdentity || '');
    if (expected.subject && !certificateIdentity.subjects.includes(expected.subject)) {
      return failure('Sigstore certificate identity does not match @require-identity subject', 'signature-failed', {
        certificateIdentity: certificateIdentity.subjects[0] || '',
        certificateIssuer: certificateIdentity.issuer,
        digestVerified,
        signatureVerified: true,
      });
    }
    if (expected.issuer && certificateIdentity.issuer !== expected.issuer) {
      return failure('Sigstore certificate issuer does not match @require-identity issuer', 'signature-failed', {
        certificateIdentity: certificateIdentity.subjects[0] || '',
        certificateIssuer: certificateIdentity.issuer,
        digestVerified,
        signatureVerified: true,
      });
    }

    return {
      success: true,
      status: 'verified',
      verification: 'signature-verified',
      certificateIdentity: certificateIdentity.subjects[0] || '',
      certificateIssuer: certificateIdentity.issuer,
      digestVerified,
      signatureVerified: true,
      rootVerified: 'not-checked',
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}

export const SigstoreBundleVerifier = {
  verifyMessageSignature: verifySigstoreMessageSignature,
};

export default SigstoreBundleVerifier;
