#!/usr/bin/env node
/**
 * check-asset-integrity.mjs
 *
 * Scans packaged image/media/SVG assets for steganography indicators:
 * - PNG files with data appended after the IEND chunk
 * - SVG files with <script>, event handlers, or external references
 * - Any asset with ZIP/JS/HTML magic bytes appended
 * - ICO files with suspicious trailing data
 *
 * Exit codes:
 *   0 — all assets clean
 *   1 — at least one asset flagged
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

const ASSET_DIRS = ['images'];
const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp']);

const PNG_IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZIP_MAGIC_LOCAL = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_MAGIC_EMPTY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

const SVG_DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /\bon\w+\s*=/i,
  /javascript:/i,
  /data:\s*text\/html/i,
  /xlink:href\s*=\s*["'](?!#)/i,
];

const SCRIPT_SIGNATURES = [
  { label: 'HTML doctype', pattern: /<!DOCTYPE\s+html/i },
  { label: 'HTML tag', pattern: /<html[\s>]/i },
  { label: 'script tag', pattern: /<script[\s>]/i },
  { label: 'JS strict', pattern: /['"]use strict['"]/  },
  { label: 'JS function', pattern: /\bfunction\s*\(/ },
  { label: 'JS arrow', pattern: /=>\s*\{/ },
];

const findings = [];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function scanPng(filePath, data) {
  if (data.length < 8 || !data.subarray(0, 8).equals(PNG_MAGIC)) return;
  const iendPos = data.indexOf(PNG_IEND);
  if (iendPos < 0) {
    findings.push({ file: filePath, issue: 'PNG missing IEND chunk' });
    return;
  }
  const expectedEnd = iendPos + PNG_IEND.length;
  if (data.length > expectedEnd) {
    const trailing = data.length - expectedEnd;
    const trailSample = data.subarray(expectedEnd, Math.min(expectedEnd + 64, data.length));
    const issues = [`PNG has ${trailing} bytes after IEND`];
    if (trailSample.indexOf(ZIP_MAGIC_LOCAL) >= 0 || trailSample.indexOf(ZIP_MAGIC_EMPTY) >= 0) {
      issues.push('trailing data contains ZIP signature');
    }
    for (const sig of SCRIPT_SIGNATURES) {
      if (sig.pattern.test(trailSample.toString('utf8', 0, Math.min(trailSample.length, 512)))) {
        issues.push(`trailing data matches ${sig.label}`);
      }
    }
    findings.push({ file: filePath, issue: issues.join('; ') });
  }
}

function scanSvg(filePath, data) {
  const text = data.toString('utf8');
  for (const pattern of SVG_DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      findings.push({ file: filePath, issue: `SVG contains dangerous pattern: ${pattern}` });
    }
  }
}

function scanIco(filePath, data) {
  if (data.length < 6) return;
  const reserved = data.readUInt16LE(0);
  const type = data.readUInt16LE(2);
  const count = data.readUInt16LE(4);
  if (reserved !== 0 || (type !== 1 && type !== 2)) return;
  if (count === 0 || count > 256) {
    findings.push({ file: filePath, issue: `ICO invalid entry count: ${count}` });
    return;
  }
  let maxEnd = 6 + count * 16;
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    if (offset + 16 > data.length) break;
    const size = data.readUInt32LE(offset + 8);
    const dataOffset = data.readUInt32LE(offset + 12);
    const entryEnd = dataOffset + size;
    if (entryEnd > maxEnd) maxEnd = entryEnd;
  }
  if (data.length > maxEnd + 16) {
    findings.push({ file: filePath, issue: `ICO has ${data.length - maxEnd} unexpected trailing bytes` });
  }
}

function scanGenericTrailing(filePath, data) {
  const tail = data.subarray(Math.max(0, data.length - 256));
  const tailStr = tail.toString('utf8', 0, Math.min(tail.length, 256));
  for (const sig of SCRIPT_SIGNATURES) {
    if (sig.pattern.test(tailStr)) {
      findings.push({ file: filePath, issue: `trailing bytes match ${sig.label}` });
      return;
    }
  }
  if (tail.indexOf(ZIP_MAGIC_LOCAL) >= 0 || tail.indexOf(ZIP_MAGIC_EMPTY) >= 0) {
    findings.push({ file: filePath, issue: 'trailing bytes contain ZIP signature' });
  }
}

function scanFile(filePath) {
  const data = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  if (ext === '.png') scanPng(filePath, data);
  else if (ext === '.svg') scanSvg(filePath, data);
  else if (ext === '.ico') scanIco(filePath, data);
  if (ext !== '.svg') scanGenericTrailing(filePath, data);
}

let scannedCount = 0;
for (const dir of ASSET_DIRS) {
  const absDir = join(projectRoot, dir);
  if (!existsSync(absDir)) continue;
  for (const file of readdirSync(absDir)) {
    const ext = extname(file).toLowerCase();
    if (!ASSET_EXTENSIONS.has(ext)) continue;
    const filePath = join(absDir, file);
    if (!statSync(filePath).isFile()) continue;
    scanFile(filePath);
    scannedCount++;
  }
}

if (findings.length > 0) {
  console.error(`Asset integrity scan FAILED — ${findings.length} issue(s) in ${scannedCount} assets:`);
  for (const f of findings) {
    console.error(`  - ${f.file}: ${f.issue}`);
  }
  process.exit(1);
} else {
  console.log(`Asset integrity scan passed: ${scannedCount} assets clean.`);
}
