// ScriptVault CRX3 packer — pure Node, no external deps.
//
// Wraps an existing ZIP into a Chrome CRX3 package signed with an RSA
// private key. We sign with a self-distribution key (NOT the CWS key)
// so Chrome does not demand the publisher proof on dragdrop install.
//
// Usage:
//   node pack-crx.mjs <input.zip> <output.crx> <private-key.pem>

import { readFileSync, writeFileSync } from "node:fs";
import { createHash, createPrivateKey, createPublicKey, createSign } from "node:crypto";

const [, , zipPath, crxPath, pemPath] = process.argv;
if (!zipPath || !crxPath || !pemPath) {
  console.error("Usage: node pack-crx.mjs <input.zip> <output.crx> <private-key.pem>");
  process.exit(1);
}

// ── Protobuf wire helpers ───────────────────────────────────────────────────
function varint(n) {
  const out = [];
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n & 0x7f);
  return Buffer.from(out);
}

function tag(field, wireType) {
  return varint(field * 8 + wireType);
}

function bytesField(field, buf) {
  return Buffer.concat([tag(field, 2), varint(buf.length), buf]);
}

// ── Build CRX header ────────────────────────────────────────────────────────
const zip = readFileSync(zipPath);
const pem = readFileSync(pemPath, "utf8");
const privateKey = createPrivateKey(pem);
const publicKeyDer = createPublicKey(privateKey).export({ type: "spki", format: "der" });

// crx_id = first 16 bytes of SHA256(public_key_DER)
const crxId = createHash("sha256").update(publicKeyDer).digest().subarray(0, 16);

// SignedData { crx_id = bytes (field 1) }
const signedHeaderData = bytesField(1, crxId);

// Hash input: "CRX3 SignedData\0" || u32le(len(signedHeaderData)) || signedHeaderData || zip
const sigContext = Buffer.from("CRX3 SignedData\0", "utf8"); // exactly 16 bytes
const lenLE = Buffer.alloc(4);
lenLE.writeUInt32LE(signedHeaderData.length, 0);

const signer = createSign("RSA-SHA256");
signer.update(sigContext);
signer.update(lenLE);
signer.update(signedHeaderData);
signer.update(zip);
const signature = signer.sign(privateKey);

// AsymmetricKeyProof { public_key = field 1, signature = field 2 }
const proof = Buffer.concat([
  bytesField(1, publicKeyDer),
  bytesField(2, signature),
]);

// CrxFileHeader { sha256_with_rsa = field 2 (repeated), signed_header_data = field 10000 }
const header = Buffer.concat([
  bytesField(2, proof),
  bytesField(10000, signedHeaderData),
]);

// ── Assemble CRX file ───────────────────────────────────────────────────────
const magic = Buffer.from("Cr24", "ascii");
const version = Buffer.alloc(4);
version.writeUInt32LE(3, 0);
const headerSize = Buffer.alloc(4);
headerSize.writeUInt32LE(header.length, 0);

const crx = Buffer.concat([magic, version, headerSize, header, zip]);
writeFileSync(crxPath, crx);

const idStr = crxId
  .toString("hex")
  .split("")
  .map(c => String.fromCharCode(parseInt(c, 16) + "a".charCodeAt(0)))
  .join("");

console.log(`Wrote ${crxPath} (${crx.length} bytes)`);
console.log(`Extension ID: ${idStr}`);
