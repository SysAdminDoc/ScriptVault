// ============================================================================
// Generated from src/modules/sigstore-bundle-parser.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SigstoreBundleParser = (() => {
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/modules/sigstore-bundle-parser.ts
  var sigstore_bundle_parser_exports = {};
  __export(sigstore_bundle_parser_exports, {
    SigstoreBundleParseError: () => SigstoreBundleParseError,
    SigstoreBundleParser: () => SigstoreBundleParser,
    default: () => sigstore_bundle_parser_default,
    parseSigstoreBundle: () => parseSigstoreBundle,
    safeParseSigstoreBundle: () => safeParseSigstoreBundle
  });
  module.exports = __toCommonJS(sigstore_bundle_parser_exports);
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
  function safeParseSigstoreBundle(input) {
    try {
      return { success: true, bundle: parseSigstoreBundle(input) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  var SigstoreBundleParser = {
    parse: parseSigstoreBundle,
    safeParse: safeParseSigstoreBundle
  };
  var sigstore_bundle_parser_default = SigstoreBundleParser;
  return module.exports.default || module.exports.SigstoreBundleParser || module.exports;
})();
