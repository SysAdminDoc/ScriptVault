type SigstoreContentType = 'messageSignature' | 'dsseEnvelope';
type SigstoreKeyMaterialType = 'certificate' | 'x509CertificateChain' | 'publicKeyIdentifier';

export interface ParsedSigstoreBundle {
  mediaType: string;
  contentType: SigstoreContentType;
  keyMaterialType: SigstoreKeyMaterialType;
  verificationMaterial: {
    certificateRawBytes: string;
    certificateChainRawBytes: string[];
    publicKeyHint: string;
    tlogEntries: ParsedTransparencyLogEntry[];
    rfc3161Timestamps: string[];
  };
  messageSignature?: {
    signature: string;
    messageDigest?: {
      algorithm: string;
      digest: string;
    };
  };
  dsseEnvelope?: {
    payload: string;
    payloadType: string;
    signatures: Array<{ keyid: string; sig: string }>;
  };
}

export interface ParsedTransparencyLogEntry {
  logIndex: string;
  logIdKeyId: string;
  kind: string;
  version: string;
  integratedTime: string;
  signedEntryTimestamp: string;
  canonicalizedBody: string;
  inclusionProof?: {
    logIndex: string;
    rootHash: string;
    treeSize: string;
    hashes: string[];
    checkpointEnvelope: string;
  };
}

export interface SigstoreBundleParseResult {
  success: boolean;
  bundle?: ParsedSigstoreBundle;
  error?: string;
}

export class SigstoreBundleParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SigstoreBundleParseError';
  }
}

const SUPPORTED_MEDIA_TYPES = new Set([
  'application/vnd.dev.sigstore.bundle.v0.3+json',
  'application/vnd.dev.sigstore.bundle+json;version=0.3',
  'application/vnd.dev.sigstore.bundle+json;version=0.3.2',
]);

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new SigstoreBundleParseError(`${path} must be an object`);
  return value;
}

function asString(value: unknown, path: string, { base64 = false, optional = false } = {}): string {
  if (value == null && optional) return '';
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SigstoreBundleParseError(`${path} must be a non-empty string`);
  }
  const text = value.trim();
  if (base64 && !BASE64_RE.test(text)) {
    throw new SigstoreBundleParseError(`${path} must be base64 encoded`);
  }
  return text;
}

function asArray(value: unknown, path: string): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new SigstoreBundleParseError(`${path} must be an array`);
  return value;
}

function parseJson(input: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof input === 'string') {
    try {
      return asRecord(JSON.parse(input), 'bundle');
    } catch (error) {
      if (error instanceof SigstoreBundleParseError) throw error;
      throw new SigstoreBundleParseError('bundle must be valid JSON');
    }
  }
  return asRecord(input, 'bundle');
}

function parseTlogEntry(value: unknown, index: number): ParsedTransparencyLogEntry {
  const path = `verificationMaterial.tlogEntries[${index}]`;
  const entry = asRecord(value, path);
  const logId = asRecord(entry.logId, `${path}.logId`);
  const kindVersion = asRecord(entry.kindVersion, `${path}.kindVersion`);
  const inclusionPromise = asRecord(entry.inclusionPromise, `${path}.inclusionPromise`);
  const inclusionProofValue = entry.inclusionProof == null ? null : asRecord(entry.inclusionProof, `${path}.inclusionProof`);
  const checkpoint = inclusionProofValue?.checkpoint == null
    ? null
    : asRecord(inclusionProofValue.checkpoint, `${path}.inclusionProof.checkpoint`);

  const parsed: ParsedTransparencyLogEntry = {
    logIndex: asString(entry.logIndex, `${path}.logIndex`),
    logIdKeyId: asString(logId.keyId, `${path}.logId.keyId`, { base64: true }),
    kind: asString(kindVersion.kind, `${path}.kindVersion.kind`),
    version: asString(kindVersion.version, `${path}.kindVersion.version`),
    integratedTime: asString(entry.integratedTime, `${path}.integratedTime`),
    signedEntryTimestamp: asString(inclusionPromise.signedEntryTimestamp, `${path}.inclusionPromise.signedEntryTimestamp`, { base64: true }),
    canonicalizedBody: asString(entry.canonicalizedBody, `${path}.canonicalizedBody`, { base64: true }),
  };

  if (inclusionProofValue) {
    parsed.inclusionProof = {
      logIndex: asString(inclusionProofValue.logIndex, `${path}.inclusionProof.logIndex`),
      rootHash: asString(inclusionProofValue.rootHash, `${path}.inclusionProof.rootHash`, { base64: true }),
      treeSize: asString(inclusionProofValue.treeSize, `${path}.inclusionProof.treeSize`),
      hashes: asArray(inclusionProofValue.hashes, `${path}.inclusionProof.hashes`)
        .map((hash, hashIndex) => asString(hash, `${path}.inclusionProof.hashes[${hashIndex}]`, { base64: true })),
      checkpointEnvelope: checkpoint
        ? asString(checkpoint.envelope, `${path}.inclusionProof.checkpoint.envelope`)
        : '',
    };
  }

  return parsed;
}

function parseVerificationMaterial(value: unknown): ParsedSigstoreBundle['verificationMaterial'] & { keyMaterialType: SigstoreKeyMaterialType } {
  const material = asRecord(value, 'verificationMaterial');
  const certificate = material.certificate == null ? null : asRecord(material.certificate, 'verificationMaterial.certificate');
  const chain = material.x509CertificateChain == null
    ? null
    : asRecord(material.x509CertificateChain, 'verificationMaterial.x509CertificateChain');
  const publicKey = material.publicKeyIdentifier == null
    ? null
    : asRecord(material.publicKeyIdentifier, 'verificationMaterial.publicKeyIdentifier');
  const keyMaterialCount = [certificate, chain, publicKey].filter(Boolean).length;
  if (keyMaterialCount !== 1) {
    throw new SigstoreBundleParseError('verificationMaterial must contain exactly one key material source');
  }

  const timestampData = material.timestampVerificationData == null
    ? null
    : asRecord(material.timestampVerificationData, 'verificationMaterial.timestampVerificationData');
  const rfc3161Timestamps = timestampData
    ? asArray(timestampData.rfc3161Timestamps, 'verificationMaterial.timestampVerificationData.rfc3161Timestamps')
        .map((timestamp, index) => {
          const timestampRecord = asRecord(timestamp, `verificationMaterial.timestampVerificationData.rfc3161Timestamps[${index}]`);
          return asString(timestampRecord.signedTimestamp, `verificationMaterial.timestampVerificationData.rfc3161Timestamps[${index}].signedTimestamp`, { base64: true });
        })
    : [];

  if (certificate) {
    return {
      keyMaterialType: 'certificate',
      certificateRawBytes: asString(certificate.rawBytes, 'verificationMaterial.certificate.rawBytes', { base64: true }),
      certificateChainRawBytes: [],
      publicKeyHint: '',
      tlogEntries: asArray(material.tlogEntries, 'verificationMaterial.tlogEntries').map(parseTlogEntry),
      rfc3161Timestamps,
    };
  }

  if (chain) {
    const certificateChainRawBytes = asArray(chain.certificates, 'verificationMaterial.x509CertificateChain.certificates')
      .map((cert, index) => {
        const certRecord = asRecord(cert, `verificationMaterial.x509CertificateChain.certificates[${index}]`);
        return asString(certRecord.rawBytes, `verificationMaterial.x509CertificateChain.certificates[${index}].rawBytes`, { base64: true });
      });
    if (certificateChainRawBytes.length === 0) {
      throw new SigstoreBundleParseError('verificationMaterial.x509CertificateChain.certificates must not be empty');
    }
    return {
      keyMaterialType: 'x509CertificateChain',
      certificateRawBytes: '',
      certificateChainRawBytes,
      publicKeyHint: '',
      tlogEntries: asArray(material.tlogEntries, 'verificationMaterial.tlogEntries').map(parseTlogEntry),
      rfc3161Timestamps,
    };
  }

  return {
    keyMaterialType: 'publicKeyIdentifier',
    certificateRawBytes: '',
    certificateChainRawBytes: [],
    publicKeyHint: asString(publicKey?.hint, 'verificationMaterial.publicKeyIdentifier.hint'),
    tlogEntries: asArray(material.tlogEntries, 'verificationMaterial.tlogEntries').map(parseTlogEntry),
    rfc3161Timestamps,
  };
}

function readOneofContent(bundle: Record<string, unknown>): { contentType: SigstoreContentType; content: Record<string, unknown> } {
  if (bundle.messageSignature && bundle.dsseEnvelope) {
    throw new SigstoreBundleParseError('bundle must contain only one content type');
  }
  if (bundle.messageSignature) {
    return { contentType: 'messageSignature', content: asRecord(bundle.messageSignature, 'messageSignature') };
  }
  if (bundle.dsseEnvelope) {
    return { contentType: 'dsseEnvelope', content: asRecord(bundle.dsseEnvelope, 'dsseEnvelope') };
  }

  if (bundle.content == null) {
    throw new SigstoreBundleParseError('bundle must contain messageSignature or dsseEnvelope content');
  }

  const content = asRecord(bundle.content, 'content');
  const caseName = content.$case;
  if (caseName === 'messageSignature') {
    return { contentType: 'messageSignature', content: asRecord(content.messageSignature, 'content.messageSignature') };
  }
  if (caseName === 'dsseEnvelope') {
    return { contentType: 'dsseEnvelope', content: asRecord(content.dsseEnvelope, 'content.dsseEnvelope') };
  }
  throw new SigstoreBundleParseError('bundle must contain messageSignature or dsseEnvelope content');
}

function parseMessageSignature(content: Record<string, unknown>): ParsedSigstoreBundle['messageSignature'] {
  const messageDigest = content.messageDigest == null ? null : asRecord(content.messageDigest, 'messageSignature.messageDigest');
  return {
    signature: asString(content.signature, 'messageSignature.signature', { base64: true }),
    messageDigest: messageDigest
      ? {
          algorithm: asString(messageDigest.algorithm, 'messageSignature.messageDigest.algorithm'),
          digest: asString(messageDigest.digest, 'messageSignature.messageDigest.digest', { base64: true }),
        }
      : undefined,
  };
}

function parseDsseEnvelope(content: Record<string, unknown>): ParsedSigstoreBundle['dsseEnvelope'] {
  const signatures = asArray(content.signatures, 'dsseEnvelope.signatures').map((signature, index) => {
    const sigRecord = asRecord(signature, `dsseEnvelope.signatures[${index}]`);
    return {
      keyid: asString(sigRecord.keyid, `dsseEnvelope.signatures[${index}].keyid`),
      sig: asString(sigRecord.sig, `dsseEnvelope.signatures[${index}].sig`, { base64: true }),
    };
  });
  if (signatures.length !== 1) {
    throw new SigstoreBundleParseError('dsseEnvelope.signatures must contain exactly one signature');
  }
  return {
    payload: asString(content.payload, 'dsseEnvelope.payload', { base64: true }),
    payloadType: asString(content.payloadType, 'dsseEnvelope.payloadType'),
    signatures,
  };
}

export function parseSigstoreBundle(input: string | Record<string, unknown>): ParsedSigstoreBundle {
  const bundle = parseJson(input);
  const mediaType = asString(bundle.mediaType, 'mediaType');
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    throw new SigstoreBundleParseError(`unsupported Sigstore bundle mediaType: ${mediaType}`);
  }

  const { keyMaterialType, ...verificationMaterial } = parseVerificationMaterial(bundle.verificationMaterial);
  const { contentType, content } = readOneofContent(bundle);
  const parsed: ParsedSigstoreBundle = {
    mediaType,
    contentType,
    keyMaterialType,
    verificationMaterial,
  };

  if (contentType === 'messageSignature') {
    parsed.messageSignature = parseMessageSignature(content);
  } else {
    parsed.dsseEnvelope = parseDsseEnvelope(content);
  }

  return parsed;
}

export function safeParseSigstoreBundle(input: string | Record<string, unknown>): SigstoreBundleParseResult {
  try {
    return { success: true, bundle: parseSigstoreBundle(input) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const SigstoreBundleParser = {
  parse: parseSigstoreBundle,
  safeParse: safeParseSigstoreBundle,
};

export default SigstoreBundleParser;
