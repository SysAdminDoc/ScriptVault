// ============================================================================
// Generated from src/modules/sigstore-bundle-verifier.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SigstoreBundleVerifier = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

  // src/modules/sigstore-bundle-verifier.ts
  var sigstore_bundle_verifier_exports = {};
  __export(sigstore_bundle_verifier_exports, {
    SigstoreBundleVerifier: () => SigstoreBundleVerifier,
    default: () => sigstore_bundle_verifier_default,
    verifySigstoreMessageSignature: () => verifySigstoreMessageSignature
  });
  module.exports = __toCommonJS(sigstore_bundle_verifier_exports);

  // src/modules/sigstore-bundle-parser.ts
  var SigstoreBundleParseError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "SigstoreBundleParseError";
    }
  };
  var SUPPORTED_MEDIA_TYPES = /* @__PURE__ */ new Set([
    "application/vnd.dev.sigstore.bundle.v0.3+json",
    "application/vnd.dev.sigstore.bundle+json;version=0.3",
    "application/vnd.dev.sigstore.bundle+json;version=0.3.2"
  ]);
  var BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function asRecord(value, path) {
    if (!isRecord(value)) throw new SigstoreBundleParseError(`${path} must be an object`);
    return value;
  }
  function asString(value, path, { base64 = false, optional = false } = {}) {
    if (value == null && optional) return "";
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new SigstoreBundleParseError(`${path} must be a non-empty string`);
    }
    const text = value.trim();
    if (base64 && !BASE64_RE.test(text)) {
      throw new SigstoreBundleParseError(`${path} must be base64 encoded`);
    }
    return text;
  }
  function asArray(value, path) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new SigstoreBundleParseError(`${path} must be an array`);
    return value;
  }
  function parseJson(input) {
    if (typeof input === "string") {
      try {
        return asRecord(JSON.parse(input), "bundle");
      } catch (error) {
        if (error instanceof SigstoreBundleParseError) throw error;
        throw new SigstoreBundleParseError("bundle must be valid JSON");
      }
    }
    return asRecord(input, "bundle");
  }
  function parseTlogEntry(value, index) {
    const path = `verificationMaterial.tlogEntries[${index}]`;
    const entry = asRecord(value, path);
    const logId = asRecord(entry.logId, `${path}.logId`);
    const kindVersion = asRecord(entry.kindVersion, `${path}.kindVersion`);
    const inclusionPromise = asRecord(entry.inclusionPromise, `${path}.inclusionPromise`);
    const inclusionProofValue = entry.inclusionProof == null ? null : asRecord(entry.inclusionProof, `${path}.inclusionProof`);
    const checkpoint = inclusionProofValue?.checkpoint == null ? null : asRecord(inclusionProofValue.checkpoint, `${path}.inclusionProof.checkpoint`);
    const parsed = {
      logIndex: asString(entry.logIndex, `${path}.logIndex`),
      logIdKeyId: asString(logId.keyId, `${path}.logId.keyId`, { base64: true }),
      kind: asString(kindVersion.kind, `${path}.kindVersion.kind`),
      version: asString(kindVersion.version, `${path}.kindVersion.version`),
      integratedTime: asString(entry.integratedTime, `${path}.integratedTime`),
      signedEntryTimestamp: asString(inclusionPromise.signedEntryTimestamp, `${path}.inclusionPromise.signedEntryTimestamp`, { base64: true }),
      canonicalizedBody: asString(entry.canonicalizedBody, `${path}.canonicalizedBody`, { base64: true })
    };
    if (inclusionProofValue) {
      parsed.inclusionProof = {
        logIndex: asString(inclusionProofValue.logIndex, `${path}.inclusionProof.logIndex`),
        rootHash: asString(inclusionProofValue.rootHash, `${path}.inclusionProof.rootHash`, { base64: true }),
        treeSize: asString(inclusionProofValue.treeSize, `${path}.inclusionProof.treeSize`),
        hashes: asArray(inclusionProofValue.hashes, `${path}.inclusionProof.hashes`).map((hash, hashIndex) => asString(hash, `${path}.inclusionProof.hashes[${hashIndex}]`, { base64: true })),
        checkpointEnvelope: checkpoint ? asString(checkpoint.envelope, `${path}.inclusionProof.checkpoint.envelope`) : ""
      };
    }
    return parsed;
  }
  function parseVerificationMaterial(value) {
    const material = asRecord(value, "verificationMaterial");
    const certificate = material.certificate == null ? null : asRecord(material.certificate, "verificationMaterial.certificate");
    const chain = material.x509CertificateChain == null ? null : asRecord(material.x509CertificateChain, "verificationMaterial.x509CertificateChain");
    const publicKey = material.publicKeyIdentifier == null ? null : asRecord(material.publicKeyIdentifier, "verificationMaterial.publicKeyIdentifier");
    const keyMaterialCount = [certificate, chain, publicKey].filter(Boolean).length;
    if (keyMaterialCount !== 1) {
      throw new SigstoreBundleParseError("verificationMaterial must contain exactly one key material source");
    }
    const timestampData = material.timestampVerificationData == null ? null : asRecord(material.timestampVerificationData, "verificationMaterial.timestampVerificationData");
    const rfc3161Timestamps = timestampData ? asArray(timestampData.rfc3161Timestamps, "verificationMaterial.timestampVerificationData.rfc3161Timestamps").map((timestamp, index) => {
      const timestampRecord = asRecord(timestamp, `verificationMaterial.timestampVerificationData.rfc3161Timestamps[${index}]`);
      return asString(timestampRecord.signedTimestamp, `verificationMaterial.timestampVerificationData.rfc3161Timestamps[${index}].signedTimestamp`, { base64: true });
    }) : [];
    if (certificate) {
      return {
        keyMaterialType: "certificate",
        certificateRawBytes: asString(certificate.rawBytes, "verificationMaterial.certificate.rawBytes", { base64: true }),
        certificateChainRawBytes: [],
        publicKeyHint: "",
        tlogEntries: asArray(material.tlogEntries, "verificationMaterial.tlogEntries").map(parseTlogEntry),
        rfc3161Timestamps
      };
    }
    if (chain) {
      const certificateChainRawBytes = asArray(chain.certificates, "verificationMaterial.x509CertificateChain.certificates").map((cert, index) => {
        const certRecord = asRecord(cert, `verificationMaterial.x509CertificateChain.certificates[${index}]`);
        return asString(certRecord.rawBytes, `verificationMaterial.x509CertificateChain.certificates[${index}].rawBytes`, { base64: true });
      });
      if (certificateChainRawBytes.length === 0) {
        throw new SigstoreBundleParseError("verificationMaterial.x509CertificateChain.certificates must not be empty");
      }
      return {
        keyMaterialType: "x509CertificateChain",
        certificateRawBytes: "",
        certificateChainRawBytes,
        publicKeyHint: "",
        tlogEntries: asArray(material.tlogEntries, "verificationMaterial.tlogEntries").map(parseTlogEntry),
        rfc3161Timestamps
      };
    }
    return {
      keyMaterialType: "publicKeyIdentifier",
      certificateRawBytes: "",
      certificateChainRawBytes: [],
      publicKeyHint: asString(publicKey?.hint, "verificationMaterial.publicKeyIdentifier.hint"),
      tlogEntries: asArray(material.tlogEntries, "verificationMaterial.tlogEntries").map(parseTlogEntry),
      rfc3161Timestamps
    };
  }
  function readOneofContent(bundle) {
    if (bundle.messageSignature && bundle.dsseEnvelope) {
      throw new SigstoreBundleParseError("bundle must contain only one content type");
    }
    if (bundle.messageSignature) {
      return { contentType: "messageSignature", content: asRecord(bundle.messageSignature, "messageSignature") };
    }
    if (bundle.dsseEnvelope) {
      return { contentType: "dsseEnvelope", content: asRecord(bundle.dsseEnvelope, "dsseEnvelope") };
    }
    if (bundle.content == null) {
      throw new SigstoreBundleParseError("bundle must contain messageSignature or dsseEnvelope content");
    }
    const content = asRecord(bundle.content, "content");
    const caseName = content.$case;
    if (caseName === "messageSignature") {
      return { contentType: "messageSignature", content: asRecord(content.messageSignature, "content.messageSignature") };
    }
    if (caseName === "dsseEnvelope") {
      return { contentType: "dsseEnvelope", content: asRecord(content.dsseEnvelope, "content.dsseEnvelope") };
    }
    throw new SigstoreBundleParseError("bundle must contain messageSignature or dsseEnvelope content");
  }
  function parseMessageSignature(content) {
    const messageDigest = content.messageDigest == null ? null : asRecord(content.messageDigest, "messageSignature.messageDigest");
    return {
      signature: asString(content.signature, "messageSignature.signature", { base64: true }),
      messageDigest: messageDigest ? {
        algorithm: asString(messageDigest.algorithm, "messageSignature.messageDigest.algorithm"),
        digest: asString(messageDigest.digest, "messageSignature.messageDigest.digest", { base64: true })
      } : void 0
    };
  }
  function parseDsseEnvelope(content) {
    const signatures = asArray(content.signatures, "dsseEnvelope.signatures").map((signature, index) => {
      const sigRecord = asRecord(signature, `dsseEnvelope.signatures[${index}]`);
      return {
        keyid: asString(sigRecord.keyid, `dsseEnvelope.signatures[${index}].keyid`),
        sig: asString(sigRecord.sig, `dsseEnvelope.signatures[${index}].sig`, { base64: true })
      };
    });
    if (signatures.length !== 1) {
      throw new SigstoreBundleParseError("dsseEnvelope.signatures must contain exactly one signature");
    }
    return {
      payload: asString(content.payload, "dsseEnvelope.payload", { base64: true }),
      payloadType: asString(content.payloadType, "dsseEnvelope.payloadType"),
      signatures
    };
  }
  function parseSigstoreBundle(input) {
    const bundle = parseJson(input);
    const mediaType = asString(bundle.mediaType, "mediaType");
    if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
      throw new SigstoreBundleParseError(`unsupported Sigstore bundle mediaType: ${mediaType}`);
    }
    const { keyMaterialType, ...verificationMaterial } = parseVerificationMaterial(bundle.verificationMaterial);
    const { contentType, content } = readOneofContent(bundle);
    const parsed = {
      mediaType,
      contentType,
      keyMaterialType,
      verificationMaterial
    };
    if (contentType === "messageSignature") {
      parsed.messageSignature = parseMessageSignature(content);
    } else {
      parsed.dsseEnvelope = parseDsseEnvelope(content);
    }
    return parsed;
  }

  // src/modules/sigstore-bundle-verifier.ts
  var FULCIO_ISSUER_OIDS = /* @__PURE__ */ new Set([
    "1.3.6.1.4.1.57264.1.1",
    "1.3.6.1.4.1.57264.1.8"
  ]);
  var P256 = {
    p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
    n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
    a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
    gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
    gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
  };
  function isParsedBundle(value) {
    return !!value && typeof value === "object" && "contentType" in value && "verificationMaterial" in value;
  }
  function normalizeBase64(value) {
    let normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
    const remainder = normalized.length % 4;
    if (remainder === 2) normalized += "==";
    else if (remainder === 3) normalized += "=";
    else if (remainder === 1) throw new Error("Invalid base64 length");
    return normalized;
  }
  function base64ToBytes(value) {
    const binary = atob(normalizeBase64(value));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function artifactToBytes(value) {
    if (typeof value === "string") return new TextEncoder().encode(value);
    if (value instanceof Uint8Array) return value;
    return new Uint8Array(value);
  }
  function bytesToArrayBuffer(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  }
  function toBigInt(bytes) {
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) + BigInt(byte);
    return value;
  }
  function mod(value, modulus) {
    const result = value % modulus;
    return result >= 0n ? result : result + modulus;
  }
  function modInverse(value, modulus) {
    let oldR = mod(value, modulus);
    let r = modulus;
    let oldS = 1n;
    let s = 0n;
    while (r !== 0n) {
      const quotient = oldR / r;
      [oldR, r] = [r, oldR - quotient * r];
      [oldS, s] = [s, oldS - quotient * s];
    }
    if (oldR !== 1n) throw new Error("Value has no modular inverse");
    return mod(oldS, modulus);
  }
  function pointDouble(point) {
    if (point.y === 0n) return null;
    const slope = mod((3n * point.x * point.x + P256.a) * modInverse(2n * point.y, P256.p), P256.p);
    const x = mod(slope * slope - 2n * point.x, P256.p);
    const y = mod(slope * (point.x - x) - point.y, P256.p);
    return { x, y };
  }
  function pointAdd(left, right) {
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
  function pointMultiply(point, scalar) {
    let addend = point;
    let result = null;
    let k = scalar;
    while (k > 0n) {
      if (k & 1n) result = pointAdd(result, addend);
      addend = addend ? pointDouble(addend) : null;
      k >>= 1n;
    }
    return result;
  }
  function verifyP256Digest(publicKey, digest, signature) {
    const { r, s } = signature;
    if (r <= 0n || r >= P256.n || s <= 0n || s >= P256.n) return false;
    const e = toBigInt(digest);
    const w = modInverse(s, P256.n);
    const u1 = mod(e * w, P256.n);
    const u2 = mod(r * w, P256.n);
    const point = pointAdd(
      pointMultiply({ x: P256.gx, y: P256.gy }, u1),
      pointMultiply(publicKey, u2)
    );
    return !!point && mod(point.x, P256.n) === r;
  }
  function readDerNode(bytes, offset = 0) {
    if (offset >= bytes.length) throw new Error("Unexpected end of DER data");
    const start = offset;
    const tag = bytes[offset++];
    if (tag == null) throw new Error("Missing DER tag");
    const firstLength = bytes[offset++];
    if (firstLength == null) throw new Error("Missing DER length");
    let length = firstLength;
    if (firstLength & 128) {
      const lengthBytes = firstLength & 127;
      if (lengthBytes === 0 || lengthBytes > 4) throw new Error("Unsupported DER length");
      length = 0;
      for (let i = 0; i < lengthBytes; i += 1) {
        const byte = bytes[offset++];
        if (byte == null) throw new Error("Truncated DER length");
        length = length << 8 | byte;
      }
    }
    const valueStart = offset;
    const valueEnd = valueStart + length;
    if (valueEnd > bytes.length) throw new Error("DER value exceeds input length");
    return { tag, start, valueStart, valueEnd, end: valueEnd };
  }
  function derValue(bytes, node) {
    return bytes.slice(node.valueStart, node.valueEnd);
  }
  function derFull(bytes, node) {
    return bytes.slice(node.start, node.end);
  }
  function readDerChildren(bytes, node) {
    const children = [];
    let offset = node.valueStart;
    while (offset < node.valueEnd) {
      const child = readDerNode(bytes, offset);
      children.push(child);
      offset = child.end;
    }
    if (offset !== node.valueEnd) throw new Error("Invalid DER child boundary");
    return children;
  }
  function parseDerInteger(bytes) {
    let value = bytes;
    while (value.length > 1 && value[0] === 0) value = value.slice(1);
    return toBigInt(value);
  }
  function parseEcdsaSignature(bytes) {
    if (bytes.length === 64) {
      return { r: toBigInt(bytes.slice(0, 32)), s: toBigInt(bytes.slice(32)) };
    }
    const sequence = readDerNode(bytes, 0);
    if (sequence.tag !== 48 || sequence.end !== bytes.length) throw new Error("ECDSA signature must be DER sequence or raw P-256 signature");
    const parts = readDerChildren(bytes, sequence);
    if (parts.length !== 2 || parts[0]?.tag !== 2 || parts[1]?.tag !== 2) {
      throw new Error("ECDSA DER signature must contain r and s integers");
    }
    return {
      r: parseDerInteger(derValue(bytes, parts[0])),
      s: parseDerInteger(derValue(bytes, parts[1]))
    };
  }
  function decodeOid(value) {
    if (value.length === 0) throw new Error("OID is empty");
    const first = value[0];
    const parts = [Math.floor(first / 40), first % 40];
    let current = 0;
    for (let i = 1; i < value.length; i += 1) {
      current = current << 7 | value[i] & 127;
      if ((value[i] & 128) === 0) {
        parts.push(current);
        current = 0;
      }
    }
    return parts.join(".");
  }
  function decodeDerText(value) {
    return new TextDecoder("utf-8").decode(value).trim();
  }
  function parseSpkiPublicKey(spkiBytes) {
    const sequence = readDerNode(spkiBytes, 0);
    if (sequence.tag !== 48 || sequence.end !== spkiBytes.length) throw new Error("SPKI must be a DER sequence");
    const children = readDerChildren(spkiBytes, sequence);
    const bitString = children[1];
    if (!bitString || bitString.tag !== 3) throw new Error("SPKI is missing public key bit string");
    const value = derValue(spkiBytes, bitString);
    if (value[0] !== 0) throw new Error("SPKI public key has unsupported unused bits");
    const point = value.slice(1);
    if (point.length !== 65 || point[0] !== 4) throw new Error("SPKI public key must be uncompressed P-256");
    return {
      x: toBigInt(point.slice(1, 33)),
      y: toBigInt(point.slice(33, 65))
    };
  }
  function getTbsCertificateChildren(certBytes) {
    const certificate = readDerNode(certBytes, 0);
    if (certificate.tag !== 48 || certificate.end !== certBytes.length) throw new Error("Certificate must be a DER sequence");
    const certParts = readDerChildren(certBytes, certificate);
    const tbsCertificate = certParts[0];
    if (!tbsCertificate || tbsCertificate.tag !== 48) throw new Error("Certificate missing TBSCertificate");
    return readDerChildren(certBytes, tbsCertificate);
  }
  function extractSubjectPublicKeyInfo(certBytes) {
    const children = getTbsCertificateChildren(certBytes);
    let index = children[0]?.tag === 160 ? 1 : 0;
    index += 5;
    const spki = children[index];
    if (!spki || spki.tag !== 48) throw new Error("Certificate missing SubjectPublicKeyInfo");
    return derFull(certBytes, spki);
  }
  function parseSubjectAltName(value) {
    const sequence = readDerNode(value, 0);
    if (sequence.tag !== 48) return [];
    return readDerChildren(value, sequence).filter((name) => name.tag === 134 || name.tag === 129).map((name) => decodeDerText(derValue(value, name))).filter(Boolean);
  }
  function parseExtensionText(value) {
    try {
      const inner = readDerNode(value, 0);
      if ([12, 22, 19].includes(inner.tag)) return decodeDerText(derValue(value, inner));
    } catch {
    }
    return decodeDerText(value);
  }
  function extractCertificateIdentity(certBytes) {
    const subjects = [];
    let issuer = "";
    const children = getTbsCertificateChildren(certBytes);
    for (const extensionWrapper of children.filter((child) => child.tag === 163)) {
      const wrapperChildren = readDerChildren(certBytes, extensionWrapper);
      const extensions = wrapperChildren[0];
      if (!extensions || extensions.tag !== 48) continue;
      for (const extension of readDerChildren(certBytes, extensions)) {
        if (extension.tag !== 48) continue;
        const parts = readDerChildren(certBytes, extension);
        const oidNode = parts[0];
        if (!oidNode || oidNode.tag !== 6) continue;
        const oid = decodeOid(derValue(certBytes, oidNode));
        const octetNode = parts.find((part) => part.tag === 4);
        if (!octetNode) continue;
        const octets = derValue(certBytes, octetNode);
        if (oid === "2.5.29.17") {
          subjects.push(...parseSubjectAltName(octets));
        } else if (FULCIO_ISSUER_OIDS.has(oid)) {
          issuer = parseExtensionText(octets);
        }
      }
    }
    return { subjects: [...new Set(subjects)], issuer };
  }
  function parseIdentityDeclaration(value = "") {
    const match = value.match(/^\s*(.*?)\s*(?:\(\s*issuer:\s*([^)]+?)\s*\))?\s*$/i);
    return {
      subject: (match?.[1] || value).trim(),
      issuer: (match?.[2] || "").trim()
    };
  }
  function selectLeafCertificate(bundle) {
    if (bundle.verificationMaterial.certificateRawBytes) return bundle.verificationMaterial.certificateRawBytes;
    return bundle.verificationMaterial.certificateChainRawBytes[0] || "";
  }
  function digestAlgorithmName(algorithm) {
    const normalized = algorithm.toUpperCase().replace(/[-_]/g, "");
    if (normalized === "SHA2256" || normalized === "SHA256") return "SHA-256";
    throw new Error(`Unsupported message digest algorithm: ${algorithm}`);
  }
  function failure(error, verification = "signature-failed", extra = {}) {
    return {
      success: false,
      status: verification === "unsupported-bundle" ? "unsupported" : "failed",
      verification,
      error,
      digestVerified: false,
      signatureVerified: false,
      rootVerified: "not-checked",
      ...extra
    };
  }
  async function verifySigstoreMessageSignature(options) {
    try {
      const bundle = isParsedBundle(options.bundle) ? options.bundle : parseSigstoreBundle(options.bundle);
      if (bundle.contentType !== "messageSignature" || !bundle.messageSignature) {
        return failure("Only Sigstore messageSignature bundles are supported by this verifier phase", "unsupported-bundle");
      }
      const certificate = selectLeafCertificate(bundle);
      if (!certificate) {
        return failure("Sigstore bundle does not include certificate material");
      }
      const artifactBytes = artifactToBytes(options.artifact);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytesToArrayBuffer(artifactBytes)));
      let digestVerified = false;
      const messageDigest = bundle.messageSignature.messageDigest;
      if (messageDigest) {
        digestAlgorithmName(messageDigest.algorithm);
        const expectedDigest = normalizeBase64(messageDigest.digest);
        const actualDigest = normalizeBase64(bytesToBase64(digest));
        if (expectedDigest !== actualDigest) {
          return failure("Sigstore message digest does not match artifact bytes", "signature-failed", { digestVerified: false });
        }
        digestVerified = true;
      }
      const certBytes = base64ToBytes(certificate);
      const certificateIdentity = extractCertificateIdentity(certBytes);
      const publicKey = parseSpkiPublicKey(extractSubjectPublicKeyInfo(certBytes));
      const signature = parseEcdsaSignature(base64ToBytes(bundle.messageSignature.signature));
      const signatureVerified = verifyP256Digest(publicKey, digest, signature);
      if (!signatureVerified) {
        return failure("Sigstore signature does not verify against artifact digest", "signature-failed", {
          certificateIdentity: certificateIdentity.subjects[0] || "",
          certificateIssuer: certificateIdentity.issuer,
          digestVerified
        });
      }
      const expected = parseIdentityDeclaration(options.expectedIdentity || "");
      if (expected.subject && !certificateIdentity.subjects.includes(expected.subject)) {
        return failure("Sigstore certificate identity does not match @require-identity subject", "signature-failed", {
          certificateIdentity: certificateIdentity.subjects[0] || "",
          certificateIssuer: certificateIdentity.issuer,
          digestVerified,
          signatureVerified: true
        });
      }
      if (expected.issuer && certificateIdentity.issuer !== expected.issuer) {
        return failure("Sigstore certificate issuer does not match @require-identity issuer", "signature-failed", {
          certificateIdentity: certificateIdentity.subjects[0] || "",
          certificateIssuer: certificateIdentity.issuer,
          digestVerified,
          signatureVerified: true
        });
      }
      return {
        success: true,
        status: "verified",
        verification: "signature-verified",
        certificateIdentity: certificateIdentity.subjects[0] || "",
        certificateIssuer: certificateIdentity.issuer,
        digestVerified,
        signatureVerified: true,
        rootVerified: "not-checked"
      };
    } catch (error) {
      return failure(error instanceof Error ? error.message : String(error));
    }
  }
  var SigstoreBundleVerifier = {
    verifyMessageSignature: verifySigstoreMessageSignature
  };
  var sigstore_bundle_verifier_default = SigstoreBundleVerifier;
  return module.exports.default || module.exports.SigstoreBundleVerifier || module.exports;
})();
