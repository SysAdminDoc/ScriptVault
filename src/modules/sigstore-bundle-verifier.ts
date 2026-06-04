import { parseSigstoreBundle, type ParsedSigstoreBundle } from './sigstore-bundle-parser';

type VerificationStatus = 'verified' | 'failed' | 'unsupported';
type ProvenanceVerification = 'signature-verified' | 'signature-failed' | 'root-verification-failed' | 'unsupported-bundle';
type RootVerificationStatus = 'not-checked' | 'verified' | 'failed';

export interface SigstoreSignatureVerificationResult {
  success: boolean;
  status: VerificationStatus;
  verification: ProvenanceVerification;
  error?: string;
  certificateIdentity?: string;
  certificateIssuer?: string;
  digestVerified: boolean;
  signatureVerified: boolean;
  rootVerified: RootVerificationStatus;
  certificateNotBefore?: string;
  certificateNotAfter?: string;
}

export interface SigstoreSignatureVerificationOptions {
  bundle: string | Record<string, unknown> | ParsedSigstoreBundle;
  artifact: string | ArrayBuffer | Uint8Array;
  expectedIdentity?: string;
  trustedRootCertificates?: string[];
  verificationTime?: number | Date;
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

interface EcPublicKey {
  curve: EcCurve;
  point: EcPoint;
}

interface EcCurve {
  name: 'P-256' | 'P-384';
  p: bigint;
  n: bigint;
  a: bigint;
  gx: bigint;
  gy: bigint;
  size: number;
}

interface EcdsaSignature {
  r: bigint;
  s: bigint;
}

interface ParsedCertificate {
  rawBytes: Uint8Array;
  tbsBytes: Uint8Array;
  signatureAlgorithmOid: string;
  signature: Uint8Array;
  issuerDer: Uint8Array;
  subjectDer: Uint8Array;
  notBefore: number;
  notAfter: number;
  publicKey: EcPublicKey;
  identity: CertificateIdentity;
}

const FULCIO_V1_ROOT_CERT_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIB9zCCAXygAwIBAgIUALZNAPFdxHPwjeDloDwyYChAO/4wCgYIKoZIzj0EAwMw',
  'KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y',
  'MTEwMDcxMzU2NTlaFw0zMTEwMDUxMzU2NThaMCoxFTATBgNVBAoTDHNpZ3N0b3Jl',
  'LmRldjERMA8GA1UEAxMIc2lnc3RvcmUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAT7',
  'XeFT4rb3PQGwS4IajtLk3/OlnpgangaBclYpsYBr5i+4ynB07ceb3LP0OIOZdxex',
  'X69c5iVuyJRQ+Hz05yi+UF3uBWAlHpiS5sh0+H2GHE7SXrk1EC5m1Tr19L9gg92j',
  'YzBhMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRY',
  'wB5fkUWlZql6zJChkyLQKsXF+jAfBgNVHSMEGDAWgBRYwB5fkUWlZql6zJChkyLQ',
  'KsXF+jAKBggqhkjOPQQDAwNpADBmAjEAj1nHeXZp+13NWBNa+EDsDP8G1WWg1tCM',
  'WP/WHPqpaVo0jhsweNFZgSs0eE7wYI4qAjEA2WB9ot98sIkoF3vZYdd3/VtWB5b9',
  'TNMea7Ix/stJ5TfcLLeABLE4BNJOsQ4vnBHJ',
  '-----END CERTIFICATE-----',
].join('\n');

const FULCIO_ISSUER_OIDS = new Set([
  '1.3.6.1.4.1.57264.1.1',
  '1.3.6.1.4.1.57264.1.8',
]);

const CURVE_P256: EcCurve = {
  name: 'P-256',
  p: BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
  n: BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
  a: BigInt('0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc'),
  gx: BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
  gy: BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
  size: 32,
};

const CURVE_P384: EcCurve = {
  name: 'P-384',
  p: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff'),
  n: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973'),
  a: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffc'),
  gx: BigInt('0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b985f741e082542a385502f25dbf55296c3a545e3872760ab7'),
  gy: BigInt('0x3617de4a96262f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f'),
  size: 48,
};

const EC_CURVES_BY_OID: Record<string, EcCurve> = {
  '1.2.840.10045.3.1.7': CURVE_P256,
  '1.3.132.0.34': CURVE_P384,
};

const ECDSA_SIGNATURE_HASH_BY_OID: Record<string, string> = {
  '1.2.840.10045.4.3.2': 'SHA-256',
  '1.2.840.10045.4.3.3': 'SHA-384',
  '1.2.840.10045.4.3.4': 'SHA-512',
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

function pointDouble(point: EcPoint, curve: EcCurve): EcPoint | null {
  if (point.y === 0n) return null;
  const slope = mod((3n * point.x * point.x + curve.a) * modInverse(2n * point.y, curve.p), curve.p);
  const x = mod(slope * slope - 2n * point.x, curve.p);
  const y = mod(slope * (point.x - x) - point.y, curve.p);
  return { x, y };
}

function pointAdd(left: EcPoint | null, right: EcPoint | null, curve: EcCurve): EcPoint | null {
  if (!left) return right;
  if (!right) return left;
  if (left.x === right.x) {
    if (mod(left.y + right.y, curve.p) === 0n) return null;
    return pointDouble(left, curve);
  }
  const slope = mod((right.y - left.y) * modInverse(right.x - left.x, curve.p), curve.p);
  const x = mod(slope * slope - left.x - right.x, curve.p);
  const y = mod(slope * (left.x - x) - left.y, curve.p);
  return { x, y };
}

function pointMultiply(point: EcPoint, scalar: bigint, curve: EcCurve): EcPoint | null {
  let addend: EcPoint | null = point;
  let result: EcPoint | null = null;
  let k = scalar;
  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend, curve);
    addend = addend ? pointDouble(addend, curve) : null;
    k >>= 1n;
  }
  return result;
}

function digestToScalar(digest: Uint8Array, curve: EcCurve): bigint {
  const excessBits = BigInt(Math.max(0, (digest.byteLength - curve.size) * 8));
  const value = toBigInt(digest);
  return excessBits > 0n ? value >> excessBits : value;
}

function verifyEcDigest(publicKey: EcPublicKey, digest: Uint8Array, signature: EcdsaSignature): boolean {
  const curve = publicKey.curve;
  const { r, s } = signature;
  if (r <= 0n || r >= curve.n || s <= 0n || s >= curve.n) return false;
  const e = digestToScalar(digest, curve);
  const w = modInverse(s, curve.n);
  const u1 = mod(e * w, curve.n);
  const u2 = mod(r * w, curve.n);
  const point = pointAdd(
    pointMultiply({ x: curve.gx, y: curve.gy }, u1, curve),
    pointMultiply(publicKey.point, u2, curve),
    curve,
  );
  return !!point && mod(point.x, curve.n) === r;
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
  if (bytes.length === 64 || bytes.length === 96) {
    const size = bytes.length / 2;
    return { r: toBigInt(bytes.slice(0, size)), s: toBigInt(bytes.slice(size)) };
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

function parseSpkiPublicKey(spkiBytes: Uint8Array): EcPublicKey {
  const sequence = readDerNode(spkiBytes, 0);
  if (sequence.tag !== 0x30 || sequence.end !== spkiBytes.length) throw new Error('SPKI must be a DER sequence');
  const children = readDerChildren(spkiBytes, sequence);
  const algorithm = children[0];
  const bitString = children[1];
  if (!algorithm || algorithm.tag !== 0x30) throw new Error('SPKI is missing algorithm identifier');
  if (!bitString || bitString.tag !== 0x03) throw new Error('SPKI is missing public key bit string');
  const algorithmParts = readDerChildren(spkiBytes, algorithm);
  const curveOidNode = algorithmParts[1];
  if (!curveOidNode || curveOidNode.tag !== 0x06) throw new Error('SPKI is missing EC named curve');
  const curve = EC_CURVES_BY_OID[decodeOid(derValue(spkiBytes, curveOidNode))];
  if (!curve) throw new Error('SPKI uses an unsupported EC curve');
  const value = derValue(spkiBytes, bitString);
  if (value[0] !== 0) throw new Error('SPKI public key has unsupported unused bits');
  const point = value.slice(1);
  const expectedLength = 1 + (curve.size * 2);
  if (point.length !== expectedLength || point[0] !== 0x04) {
    throw new Error(`SPKI public key must be uncompressed ${curve.name}`);
  }
  return {
    curve,
    point: {
      x: toBigInt(point.slice(1, 1 + curve.size)),
      y: toBigInt(point.slice(1 + curve.size, expectedLength)),
    },
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

function bitStringValue(bytes: Uint8Array, node: DerNode): Uint8Array {
  const value = derValue(bytes, node);
  if (value[0] !== 0) throw new Error('Unsupported non-zero unused bits in BIT STRING');
  return value.slice(1);
}

function parseSignatureAlgorithmOid(bytes: Uint8Array, node: DerNode): string {
  if (node.tag !== 0x30) throw new Error('Signature algorithm must be a sequence');
  const parts = readDerChildren(bytes, node);
  const oidNode = parts[0];
  if (!oidNode || oidNode.tag !== 0x06) throw new Error('Signature algorithm missing OID');
  return decodeOid(derValue(bytes, oidNode));
}

function parseAsn1Time(bytes: Uint8Array, node: DerNode): number {
  const text = decodeDerText(derValue(bytes, node));
  if (node.tag === 0x17) {
    const match = text.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) throw new Error(`Invalid UTCTime value: ${text}`);
    const year = Number(match[1]);
    return Date.UTC(
      year >= 50 ? 1900 + year : 2000 + year,
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    );
  }
  if (node.tag === 0x18) {
    const match = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) throw new Error(`Invalid GeneralizedTime value: ${text}`);
    return Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    );
  }
  throw new Error('Certificate validity time must be UTCTime or GeneralizedTime');
}

function parseCertificate(certBytes: Uint8Array): ParsedCertificate {
  const certificate = readDerNode(certBytes, 0);
  if (certificate.tag !== 0x30 || certificate.end !== certBytes.length) throw new Error('Certificate must be a DER sequence');
  const certParts = readDerChildren(certBytes, certificate);
  const tbsCertificate = certParts[0];
  const signatureAlgorithm = certParts[1];
  const signatureValue = certParts[2];
  if (!tbsCertificate || tbsCertificate.tag !== 0x30 || !signatureAlgorithm || !signatureValue || signatureValue.tag !== 0x03) {
    throw new Error('Certificate is missing required signed fields');
  }

  const children = readDerChildren(certBytes, tbsCertificate);
  let index = children[0]?.tag === 0xa0 ? 1 : 0;
  index += 2;
  const issuer = children[index++];
  const validity = children[index++];
  const subject = children[index++];
  const spki = children[index++];
  if (!issuer || !validity || !subject || !spki) throw new Error('Certificate missing issuer, validity, subject, or SPKI');
  const validityParts = readDerChildren(certBytes, validity);
  const notBefore = validityParts[0];
  const notAfter = validityParts[1];
  if (!notBefore || !notAfter) throw new Error('Certificate validity is incomplete');

  return {
    rawBytes: certBytes,
    tbsBytes: derFull(certBytes, tbsCertificate),
    signatureAlgorithmOid: parseSignatureAlgorithmOid(certBytes, signatureAlgorithm),
    signature: bitStringValue(certBytes, signatureValue),
    issuerDer: derFull(certBytes, issuer),
    subjectDer: derFull(certBytes, subject),
    notBefore: parseAsn1Time(certBytes, notBefore),
    notAfter: parseAsn1Time(certBytes, notAfter),
    publicKey: parseSpkiPublicKey(derFull(certBytes, spki)),
    identity: extractCertificateIdentity(certBytes),
  };
}

function pemToDer(pem: string): Uint8Array {
  return base64ToBytes(pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ''));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let i = 0; i < left.byteLength; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function assertCertificateTime(cert: ParsedCertificate, time: number, label: string): void {
  if (time < cert.notBefore || time > cert.notAfter) {
    throw new Error(`${label} certificate is not valid at verification time`);
  }
}

async function verifyCertificateSignature(child: ParsedCertificate, issuer: ParsedCertificate): Promise<boolean> {
  if (!bytesEqual(child.issuerDer, issuer.subjectDer)) return false;
  const hashAlgorithm = ECDSA_SIGNATURE_HASH_BY_OID[child.signatureAlgorithmOid];
  if (!hashAlgorithm) throw new Error(`Unsupported certificate signature algorithm: ${child.signatureAlgorithmOid}`);
  const digest = new Uint8Array(await crypto.subtle.digest(hashAlgorithm, bytesToArrayBuffer(child.tbsBytes)));
  return verifyEcDigest(issuer.publicKey, digest, parseEcdsaSignature(child.signature));
}

async function validateCertificateChain(
  bundle: ParsedSigstoreBundle,
  trustedRootCertificates: string[],
  verificationTime: number,
): Promise<{ leaf: ParsedCertificate; rootVerified: RootVerificationStatus }> {
  const chainBytes = bundle.verificationMaterial.certificateChainRawBytes.length > 0
    ? bundle.verificationMaterial.certificateChainRawBytes
    : [bundle.verificationMaterial.certificateRawBytes].filter(Boolean);
  if (chainBytes.length === 0) throw new Error('Sigstore bundle does not include certificate material');

  const certs = chainBytes.map((value) => parseCertificate(base64ToBytes(value)));
  const roots = trustedRootCertificates.map((value) => parseCertificate(pemToDer(value)));
  if (roots.length === 0) throw new Error('No trusted Fulcio root certificates are configured');

  certs.forEach((cert, index) => assertCertificateTime(cert, verificationTime, index === 0 ? 'Leaf' : 'Intermediate'));
  roots.forEach((root) => assertCertificateTime(root, verificationTime, 'Trusted root'));

  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!await verifyCertificateSignature(certs[i]!, certs[i + 1]!)) {
      throw new Error('Certificate chain signature verification failed');
    }
  }

  const last = certs[certs.length - 1]!;
  for (const root of roots) {
    if (bytesEqual(last.rawBytes, root.rawBytes)) {
      return { leaf: certs[0]!, rootVerified: 'verified' };
    }
    if (await verifyCertificateSignature(last, root)) {
      return { leaf: certs[0]!, rootVerified: 'verified' };
    }
  }

  throw new Error('Certificate chain does not terminate at a trusted Fulcio root');
}

function verificationTimeMs(value: number | Date | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return Date.now();
}

function isoTime(value: number): string {
  return new Date(value).toISOString();
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

    const verificationTime = verificationTimeMs(options.verificationTime);
    const trustedRootCertificates = options.trustedRootCertificates || [FULCIO_V1_ROOT_CERT_PEM];
    let chain;
    try {
      chain = await validateCertificateChain(bundle, trustedRootCertificates, verificationTime);
    } catch (error) {
      return failure(error instanceof Error ? error.message : String(error), 'root-verification-failed', {
        digestVerified,
        rootVerified: 'failed',
      });
    }

    const certificateIdentity = chain.leaf.identity;
    const signature = parseEcdsaSignature(base64ToBytes(bundle.messageSignature.signature));
    const signatureVerified = verifyEcDigest(chain.leaf.publicKey, digest, signature);
    if (!signatureVerified) {
      return failure('Sigstore signature does not verify against artifact digest', 'signature-failed', {
        certificateIdentity: certificateIdentity.subjects[0] || '',
        certificateIssuer: certificateIdentity.issuer,
        certificateNotBefore: isoTime(chain.leaf.notBefore),
        certificateNotAfter: isoTime(chain.leaf.notAfter),
        digestVerified,
        rootVerified: chain.rootVerified,
      });
    }

    const expected = parseIdentityDeclaration(options.expectedIdentity || '');
    if (expected.subject && !certificateIdentity.subjects.includes(expected.subject)) {
      return failure('Sigstore certificate identity does not match @require-identity subject', 'signature-failed', {
        certificateIdentity: certificateIdentity.subjects[0] || '',
        certificateIssuer: certificateIdentity.issuer,
        certificateNotBefore: isoTime(chain.leaf.notBefore),
        certificateNotAfter: isoTime(chain.leaf.notAfter),
        digestVerified,
        signatureVerified: true,
        rootVerified: chain.rootVerified,
      });
    }
    if (expected.issuer && certificateIdentity.issuer !== expected.issuer) {
      return failure('Sigstore certificate issuer does not match @require-identity issuer', 'signature-failed', {
        certificateIdentity: certificateIdentity.subjects[0] || '',
        certificateIssuer: certificateIdentity.issuer,
        certificateNotBefore: isoTime(chain.leaf.notBefore),
        certificateNotAfter: isoTime(chain.leaf.notAfter),
        digestVerified,
        signatureVerified: true,
        rootVerified: chain.rootVerified,
      });
    }

    return {
      success: true,
      status: 'verified',
      verification: 'signature-verified',
      certificateIdentity: certificateIdentity.subjects[0] || '',
      certificateIssuer: certificateIdentity.issuer,
      certificateNotBefore: isoTime(chain.leaf.notBefore),
      certificateNotAfter: isoTime(chain.leaf.notAfter),
      digestVerified,
      signatureVerified: true,
      rootVerified: chain.rootVerified,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}

export const SigstoreBundleVerifier = {
  verifyMessageSignature: verifySigstoreMessageSignature,
};

export default SigstoreBundleVerifier;
