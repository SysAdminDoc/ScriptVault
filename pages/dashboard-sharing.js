/**
 * ScriptVault Script Sharing Module
 * Share scripts via QR codes, data URLs, file exports, and batch operations.
 * Includes a self-contained QR code encoder (no external dependencies).
 */
const ScriptSharing = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        styleEl: null,
        modalEl: null,
        getScript: null,       // fn(id) => script
        getAllScripts: null,    // fn() => scripts[]
        onInstallScript: null,  // fn(code) => void
        updateScript: null      // fn(id, changes) => void
    };

    // =========================================
    // CSS
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'script-sharing-styles';
        style.textContent = `
.ss-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: ss-fadein 0.15s ease;
}
@keyframes ss-fadein {
    from { opacity: 0; }
    to { opacity: 1; }
}
.ss-modal {
    background: var(--bg-header, #252525);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
    border-radius: 10px;
    width: 520px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: ss-slidein 0.2s ease;
}
@keyframes ss-slidein {
    from { transform: translateY(16px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
.ss-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-color, #404040);
}
.ss-modal-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
}
.ss-modal-close {
    background: none;
    border: none;
    color: var(--text-secondary, #a0a0a0);
    font-size: 20px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
}
.ss-modal-close:hover {
    color: var(--text-primary, #e0e0e0);
    background: var(--bg-row-hover, #333);
}
.ss-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
}
.ss-modal-body::-webkit-scrollbar {
    width: 6px;
}
.ss-modal-body::-webkit-scrollbar-thumb {
    background: var(--border-color, #404040);
    border-radius: 3px;
}
.ss-script-info {
    margin-bottom: 16px;
    padding: 10px 14px;
    background: var(--bg-row, #2a2a2a);
    border-radius: 6px;
    border: 1px solid var(--border-color, #404040);
}
.ss-script-info .ss-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary, #e0e0e0);
}
.ss-script-info .ss-version {
    color: var(--text-secondary, #a0a0a0);
    font-size: 12px;
    margin-left: 6px;
}
.ss-script-info .ss-desc {
    color: var(--text-muted, #707070);
    font-size: 12px;
    margin-top: 4px;
}
.ss-qr-section {
    text-align: center;
    margin-bottom: 16px;
}
.ss-qr-section canvas {
    border: 4px solid #fff;
    border-radius: 4px;
    margin: 8px auto;
    display: block;
}
.ss-qr-note {
    font-size: 11px;
    color: var(--text-muted, #707070);
    margin-top: 6px;
}
.ss-share-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.ss-share-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-row, #2a2a2a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
    font-family: inherit;
    width: 100%;
}
.ss-share-btn:hover {
    background: var(--bg-row-hover, #333);
}
.ss-share-btn .ss-icon {
    font-size: 16px;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
}
.ss-share-btn .ss-label {
    flex: 1;
}
.ss-share-btn .ss-sublabel {
    font-size: 11px;
    color: var(--text-muted, #707070);
}
.ss-input-group {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
}
.ss-input-group input {
    flex: 1;
    background: var(--bg-input, #333);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
    border-radius: 4px;
    padding: 8px 10px;
    font-size: 12px;
    font-family: 'Consolas', monospace;
}
.ss-input-group button {
    background: var(--accent-green-dark, #22c55e);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
}
.ss-input-group button:hover {
    background: var(--accent-green, #4ade80);
}
.ss-section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #707070);
    margin: 16px 0 8px;
}
.ss-import-area {
    width: 100%;
    min-height: 80px;
    background: var(--bg-input, #333);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    padding: 10px;
    font-size: 12px;
    font-family: 'Consolas', monospace;
    resize: vertical;
}
.ss-preview-box {
    background: var(--bg-row, #2a2a2a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    padding: 12px;
    margin-top: 10px;
}
.ss-preview-box .ss-name {
    font-weight: 600;
    font-size: 14px;
}
.ss-preview-box .ss-meta {
    color: var(--text-secondary, #a0a0a0);
    font-size: 12px;
    margin-top: 4px;
}
.ss-preview-box .ss-code-preview {
    margin-top: 8px;
    font-family: 'Consolas', monospace;
    font-size: 11px;
    color: var(--text-muted, #707070);
    max-height: 100px;
    overflow: hidden;
    white-space: pre-wrap;
}
.ss-install-btn {
    display: block;
    width: 100%;
    margin-top: 10px;
    padding: 10px;
    background: var(--accent-green-dark, #22c55e);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}
.ss-install-btn:hover {
    background: var(--accent-green, #4ade80);
}
.ss-tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border-color, #404040);
    margin-bottom: 12px;
}
.ss-tab {
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #a0a0a0);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    font-family: inherit;
}
.ss-tab:hover {
    color: var(--text-primary, #e0e0e0);
}
.ss-tab.ss-active {
    color: var(--accent-green, #4ade80);
    border-bottom-color: var(--accent-green, #4ade80);
}
.ss-tab-panel {
    display: none;
}
.ss-tab-panel.ss-visible {
    display: block;
}
.ss-batch-list {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
    max-height: 200px;
    overflow-y: auto;
}
.ss-batch-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--bg-row, #2a2a2a);
    font-size: 12px;
}
.ss-batch-list li label {
    flex: 1;
    cursor: pointer;
}
.ss-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent-green-dark, #22c55e);
    color: #fff;
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    z-index: 10001;
    pointer-events: none;
    animation: ss-toastin 0.2s ease, ss-toastout 0.3s ease 1.5s forwards;
}
@keyframes ss-toastin {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes ss-toastout {
    from { opacity: 1; }
    to { opacity: 0; }
}
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // QR Code Encoder (self-contained)
    // =========================================
    // Minimal QR Code generator supporting alphanumeric & byte modes.
    // Implements Version 1-10 with error correction level L.

    const QR = (() => {
        // GF(256) arithmetic for Reed-Solomon
        const EXP = new Uint8Array(256);
        const LOG = new Uint8Array(256);
        let x = 1;
        for (let i = 0; i < 255; i++) {
            EXP[i] = x;
            LOG[x] = i;
            x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
        }
        EXP[255] = EXP[0];

        function gfMul(a, b) {
            if (a === 0 || b === 0) return 0;
            return EXP[(LOG[a] + LOG[b]) % 255];
        }

        function rsEncode(data, ecLen) {
            // Generator polynomial
            const gen = new Uint8Array(ecLen + 1);
            gen[0] = 1;
            for (let i = 0; i < ecLen; i++) {
                for (let j = ecLen; j >= 1; j--) {
                    gen[j] = gen[j] ^ gfMul(gen[j - 1], EXP[i]);
                }
            }
            const result = new Uint8Array(ecLen);
            for (let i = 0; i < data.length; i++) {
                const coef = data[i] ^ result[0];
                result.copyWithin(0, 1);
                result[ecLen - 1] = 0;
                for (let j = 0; j < ecLen; j++) {
                    result[j] ^= gfMul(gen[j + 1], coef);
                }
            }
            return result;
        }

        // Version info tables (L error correction)
        // [totalCodewords, ecCodewordsPerBlock, numBlocks, dataCodewords]
        const VERSION_TABLE = [
            null, // 0 placeholder
            [26, 7, 1, 19],    // V1
            [44, 10, 1, 34],   // V2
            [70, 15, 1, 55],   // V3
            [100, 20, 1, 80],  // V4
            [134, 26, 1, 108], // V5
            [172, 18, 2, 68],  // V6
            [196, 20, 2, 78],  // V7
            [242, 24, 2, 97],  // V8
            [292, 30, 2, 116], // V9
            [346, 18, 2, 68],  // V10 - 2 blocks of 68 + 2 blocks of 69
        ];

        // Data capacity (byte mode, L correction) per version
        const BYTE_CAPACITY = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];

        function selectVersion(dataLen) {
            for (let v = 1; v <= 10; v++) {
                if (dataLen <= BYTE_CAPACITY[v]) return v;
            }
            return -1; // Too large
        }

        function getSize(version) {
            return 17 + version * 4;
        }

        function encode(text) {
            const data = typeof text === 'string' ? new TextEncoder().encode(text) : text;
            const version = selectVersion(data.length);
            if (version < 0) return null; // Too large for QR

            const info = VERSION_TABLE[version];
            const totalData = info[3];
            const ecPerBlock = info[1];
            const numBlocks = info[2];
            const size = getSize(version);

            // Build data stream: mode indicator (0100=byte) + char count + data + terminator + padding
            const bitStream = [];

            function pushBits(val, len) {
                for (let i = len - 1; i >= 0; i--) {
                    bitStream.push((val >> i) & 1);
                }
            }

            // Mode: byte (0100)
            pushBits(0b0100, 4);

            // Character count
            const ccLen = version <= 9 ? 8 : 16;
            pushBits(data.length, ccLen);

            // Data
            for (const byte of data) {
                pushBits(byte, 8);
            }

            // Terminator (up to 4 zero bits)
            const totalDataBits = totalData * 8;
            const termLen = Math.min(4, totalDataBits - bitStream.length);
            pushBits(0, termLen);

            // Pad to byte boundary
            while (bitStream.length % 8 !== 0) bitStream.push(0);

            // Pad to fill data capacity
            const padBytes = [0xEC, 0x11];
            let padIdx = 0;
            while (bitStream.length < totalDataBits) {
                pushBits(padBytes[padIdx % 2], 8);
                padIdx++;
            }

            // Convert bit stream to bytes
            const dataBytes = new Uint8Array(totalData);
            for (let i = 0; i < totalData; i++) {
                let byte = 0;
                for (let b = 0; b < 8; b++) {
                    byte = (byte << 1) | (bitStream[i * 8 + b] || 0);
                }
                dataBytes[i] = byte;
            }

            // Split into blocks and compute EC
            const blockSize = Math.floor(totalData / numBlocks);
            const blocks = [];
            const ecBlocks = [];
            let offset = 0;

            const remainder = totalData % numBlocks;
            for (let b = 0; b < numBlocks; b++) {
                // First (numBlocks - remainder) blocks get blockSize bytes, rest get blockSize + 1
                const bLen = b < (numBlocks - remainder) ? blockSize : blockSize + 1;
                const blockData = dataBytes.slice(offset, offset + bLen);
                offset += bLen;
                blocks.push(blockData);
                ecBlocks.push(rsEncode(blockData, ecPerBlock));
            }

            // Interleave data blocks
            const interleaved = [];
            const maxBlockLen = Math.max(...blocks.map(b => b.length));
            for (let i = 0; i < maxBlockLen; i++) {
                for (const block of blocks) {
                    if (i < block.length) interleaved.push(block[i]);
                }
            }
            for (let i = 0; i < ecPerBlock; i++) {
                for (const ec of ecBlocks) {
                    if (i < ec.length) interleaved.push(ec[i]);
                }
            }

            // Place modules on grid
            const grid = Array.from({ length: size }, () => new Uint8Array(size)); // 0=white, 1=black
            const reserved = Array.from({ length: size }, () => new Uint8Array(size)); // 1=reserved

            // Finder patterns
            function placeFinderPattern(cx, cy) {
                for (let r = -3; r <= 3; r++) {
                    for (let c = -3; c <= 3; c++) {
                        const x = cx + c;
                        const y = cy + r;
                        if (x < 0 || x >= size || y < 0 || y >= size) continue;
                        const onBorder = Math.abs(r) === 3 || Math.abs(c) === 3;
                        const onCenter = r === 0 && c === 0;
                        const onInner = Math.abs(r) <= 1 && Math.abs(c) <= 1;
                        grid[y][x] = (onBorder || onCenter || onInner) ? 1 : 0;
                        reserved[y][x] = 1;
                    }
                }
            }
            placeFinderPattern(3, 3);
            placeFinderPattern(size - 4, 3);
            placeFinderPattern(3, size - 4);

            // Separators
            for (let i = 0; i < 8; i++) {
                // Top-left
                if (i < size) { reserved[7][i] = 1; reserved[i][7] = 1; grid[7][i] = 0; grid[i][7] = 0; }
                // Top-right
                if (size - 8 + i < size) { reserved[7][size - 8 + i] = 1; grid[7][size - 8 + i] = 0; }
                if (i < size) { reserved[i][size - 8] = 1; grid[i][size - 8] = 0; }
                // Bottom-left
                if (size - 8 + i < size) { reserved[size - 8 + i][7] = 1; grid[size - 8 + i][7] = 0; }
                if (i < size) { reserved[size - 8][i] = 1; grid[size - 8][i] = 0; }
            }

            // Timing patterns
            for (let i = 8; i < size - 8; i++) {
                grid[6][i] = (i + 1) % 2;
                reserved[6][i] = 1;
                grid[i][6] = (i + 1) % 2;
                reserved[i][6] = 1;
            }

            // Dark module
            grid[size - 8][8] = 1;
            reserved[size - 8][8] = 1;

            // Reserve format info areas
            for (let i = 0; i < 15; i++) {
                // Around top-left finder
                if (i < 6) { reserved[8][i] = 1; }
                else if (i === 6) { reserved[8][7] = 1; }
                else if (i === 7) { reserved[8][8] = 1; }
                else if (i === 8) { reserved[7][8] = 1; }
                else { reserved[14 - i][8] = 1; }

                // Along bottom-left and top-right
                if (i < 8) { reserved[size - 1 - i][8] = 1; }
                else { reserved[8][size - 15 + i] = 1; }
            }

            // Alignment pattern for versions >= 2
            if (version >= 2) {
                const alignPos = getAlignmentPositions(version);
                for (const ay of alignPos) {
                    for (const ax of alignPos) {
                        // Skip if overlapping finder patterns
                        if (reserved[ay]?.[ax] && (
                            (ay <= 8 && ax <= 8) ||
                            (ay <= 8 && ax >= size - 8) ||
                            (ay >= size - 8 && ax <= 8)
                        )) continue;
                        placeAlignmentPattern(grid, reserved, ax, ay, size);
                    }
                }
            }

            // Track function pattern modules for masking
            const isFunction = Array.from({ length: size }, () => new Uint8Array(size));
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    isFunction[r][c] = reserved[r][c];
                }
            }

            // Place data bits
            let bitIdx = 0;
            const totalBits = interleaved.length * 8;
            // Traverse right-to-left in 2-column strips, bottom-to-top then top-to-bottom
            let upward = true;
            for (let right = size - 1; right >= 1; right -= 2) {
                if (right === 6) right = 5; // Skip timing column
                for (let row = 0; row < size; row++) {
                    const r = upward ? (size - 1 - row) : row;
                    for (let dx = 0; dx <= 1; dx++) {
                        const c = right - dx;
                        if (c < 0 || c >= size) continue;
                        if (reserved[r][c]) continue;
                        if (bitIdx < totalBits) {
                            const byteIdx = Math.floor(bitIdx / 8);
                            const bitPos = 7 - (bitIdx % 8);
                            grid[r][c] = (interleaved[byteIdx] >> bitPos) & 1;
                        }
                        reserved[r][c] = 1;
                        bitIdx++;
                    }
                }
                upward = !upward;
            }

            // Apply mask (pattern 0: (row + col) % 2 === 0) only to data modules
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (!isFunction[r][c]) {
                        if ((r + c) % 2 === 0) {
                            grid[r][c] ^= 1;
                        }
                    }
                }
            }

            // Format info (mask 0, EC level L)
            // Pre-computed format string for L, mask 0: 111011111000100
            const formatBits = 0b111011111000100;
            placeFormatInfo(grid, size, formatBits);

            return { grid, size, version };
        }

        function getAlignmentPositions(version) {
            if (version === 1) return [];
            const positions = [6];
            const last = 4 * version + 10;
            if (version >= 7) {
                const step = Math.ceil((last - 6) / (Math.floor(version / 7) + 1));
                for (let p = last; p > 6; p -= step) {
                    positions.splice(1, 0, p);
                }
            } else {
                positions.push(last);
            }
            return positions;
        }

        function placeAlignmentPattern(grid, reserved, cx, cy, size) {
            for (let r = -2; r <= 2; r++) {
                for (let c = -2; c <= 2; c++) {
                    const x = cx + c;
                    const y = cy + r;
                    if (x < 0 || x >= size || y < 0 || y >= size) continue;
                    const onBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
                    const onCenter = r === 0 && c === 0;
                    grid[y][x] = (onBorder || onCenter) ? 1 : 0;
                    reserved[y][x] = 1;
                }
            }
        }

        // isDataModule removed — masking now uses isFunction array for accurate exclusion

        function placeFormatInfo(grid, size, bits) {
            // Around top-left
            for (let i = 0; i < 15; i++) {
                const bit = (bits >> (14 - i)) & 1;
                if (i < 6) grid[8][i] = bit;
                else if (i === 6) grid[8][7] = bit;
                else if (i === 7) grid[8][8] = bit;
                else if (i === 8) grid[7][8] = bit;
                else grid[14 - i][8] = bit;
            }
            // Along edges
            for (let i = 0; i < 15; i++) {
                const bit = (bits >> (14 - i)) & 1;
                if (i < 8) grid[size - 1 - i][8] = bit;
                else grid[8][size - 15 + i] = bit;
            }
        }

        // Render to canvas
        function renderToCanvas(canvas, qrData, pixelSize = 4) {
            if (!qrData) return;
            const { grid, size: qrSize } = qrData;
            const quiet = 4; // Quiet zone
            const totalSize = (qrSize + quiet * 2) * pixelSize;
            canvas.width = totalSize;
            canvas.height = totalSize;
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, totalSize, totalSize);

            // Modules
            ctx.fillStyle = '#000000';
            for (let r = 0; r < qrSize; r++) {
                for (let c = 0; c < qrSize; c++) {
                    if (grid[r][c]) {
                        ctx.fillRect(
                            (c + quiet) * pixelSize,
                            (r + quiet) * pixelSize,
                            pixelSize,
                            pixelSize
                        );
                    }
                }
            }
        }

        return { encode, renderToCanvas };
    })();

    // =========================================
    // Metadata Parsing
    // =========================================
    function parseMetadata(code) {
        const meta = { name: 'Untitled', version: '', author: '', description: '', downloadURL: '' };
        if (!code) return meta;
        let inBlock = false;
        for (const line of code.split('\n')) {
            const trimmed = line.trim();
            if (trimmed === '// ==UserScript==') { inBlock = true; continue; }
            if (trimmed === '// ==/UserScript==') break;
            if (!inBlock) continue;
            const m = trimmed.match(/^\/\/\s+@(\S+)\s+(.*)/);
            if (!m) continue;
            const [, key, val] = m;
            if (key === 'name') meta.name = val.trim();
            else if (key === 'version') meta.version = val.trim();
            else if (key === 'author') meta.author = val.trim();
            else if (key === 'description') meta.description = val.trim();
            else if (key === 'downloadURL') meta.downloadURL = val.trim();
        }
        return meta;
    }

    function isValidUserscript(code) {
        return typeof code === 'string' &&
            code.includes('// ==UserScript==') &&
            code.includes('// ==/UserScript==');
    }

    // =========================================
    // Encoding / Decoding
    // =========================================
    function encodeScriptToDataUrl(code) {
        const base64 = btoa(unescape(encodeURIComponent(code)));
        return `data:application/x-userscript;base64,${base64}`;
    }

    function decodeDataUrl(dataUrl) {
        try {
            const match = dataUrl.match(/^data:[^;]*;base64,(.+)$/);
            if (!match) return null;
            return decodeURIComponent(escape(atob(match[1])));
        } catch {
            return null;
        }
    }

    // =========================================
    // Share Statistics
    // =========================================
    function incrementShareCount(scriptId) {
        if (!_state.getScript || !_state.updateScript) return;
        const script = _state.getScript(scriptId);
        if (!script) return;
        const settings = script.settings || {};
        settings.shareCount = (settings.shareCount || 0) + 1;
        _state.updateScript(scriptId, { settings });
    }

    // =========================================
    // Toast Notification
    // =========================================
    function toast(message) {
        const el = document.createElement('div');
        el.className = 'ss-toast';
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }

    // =========================================
    // Copy to Clipboard
    // =========================================
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            toast('Copied to clipboard');
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            toast('Copied to clipboard');
        }
    }

    // =========================================
    // File Download
    // =========================================
    function downloadFile(filename, content, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // =========================================
    // ZIP Generation (minimal, no library)
    // =========================================
    function createZip(files) {
        // Minimal ZIP file with stored (uncompressed) entries
        const enc = new TextEncoder();
        const parts = [];
        const centralDir = [];
        let offset = 0;

        for (const { name, content } of files) {
            const nameBytes = enc.encode(name);
            const dataBytes = enc.encode(content);
            const crc = crc32(dataBytes);

            // Local file header
            const localHeader = new ArrayBuffer(30 + nameBytes.length);
            const lv = new DataView(localHeader);
            lv.setUint32(0, 0x04034b50, true);  // Signature
            lv.setUint16(4, 20, true);            // Version needed
            lv.setUint16(6, 0, true);             // Flags
            lv.setUint16(8, 0, true);             // Compression: stored
            lv.setUint16(10, 0, true);            // Mod time
            lv.setUint16(12, 0, true);            // Mod date
            lv.setUint32(14, crc, true);          // CRC-32
            lv.setUint32(18, dataBytes.length, true); // Compressed size
            lv.setUint32(22, dataBytes.length, true); // Uncompressed size
            lv.setUint16(26, nameBytes.length, true); // Filename length
            lv.setUint16(28, 0, true);             // Extra field length
            new Uint8Array(localHeader).set(nameBytes, 30);

            parts.push(new Uint8Array(localHeader));
            parts.push(dataBytes);

            // Central directory entry
            const cdEntry = new ArrayBuffer(46 + nameBytes.length);
            const cv = new DataView(cdEntry);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0, true);
            cv.setUint16(10, 0, true);
            cv.setUint16(12, 0, true);
            cv.setUint16(14, 0, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, dataBytes.length, true);
            cv.setUint32(24, dataBytes.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);
            cv.setUint16(32, 0, true);
            cv.setUint16(34, 0, true);
            cv.setUint16(36, 0, true);
            cv.setUint32(38, 32, true); // External attrs
            cv.setUint32(42, offset, true); // Local header offset
            new Uint8Array(cdEntry).set(nameBytes, 46);
            centralDir.push(new Uint8Array(cdEntry));

            offset += localHeader.byteLength + dataBytes.length;
        }

        const cdOffset = offset;
        let cdSize = 0;
        for (const cd of centralDir) {
            parts.push(cd);
            cdSize += cd.length;
        }

        // End of central directory
        const eocd = new ArrayBuffer(22);
        const ev = new DataView(eocd);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, cdSize, true);
        ev.setUint32(16, cdOffset, true);
        ev.setUint16(20, 0, true);
        parts.push(new Uint8Array(eocd));

        return new Blob(parts, { type: 'application/zip' });
    }

    function crc32(data) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
            }
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // =========================================
    // Share Modal
    // =========================================
    function showShareModal(scriptId) {
        if (!_state.getScript) return;
        const script = _state.getScript(scriptId);
        if (!script) return;

        const meta = parseMetadata(script.code);
        const code = script.code || '';
        const isSmall = new Blob([code]).size < 2048;
        const dataUrl = encodeScriptToDataUrl(code);
        const qrText = isSmall ? dataUrl : (meta.downloadURL || `https://greasyfork.org/scripts?q=${encodeURIComponent(meta.name)}`);

        closeModal();

        const overlay = document.createElement('div');
        overlay.className = 'ss-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'ss-modal';

        // QR data
        const qrData = QR.encode(qrText);

        modal.innerHTML = `
            <div class="ss-modal-header">
                <h3>Share Script</h3>
                <button class="ss-modal-close" data-action="close" type="button" aria-label="Close share dialog">\u2715</button>
            </div>
            <div class="ss-modal-body">
                <div class="ss-script-info">
                    <span class="ss-name">${escapeHtml(meta.name)}</span>
                    ${meta.version ? `<span class="ss-version">v${escapeHtml(meta.version)}</span>` : ''}
                    ${meta.description ? `<div class="ss-desc">${escapeHtml(meta.description)}</div>` : ''}
                </div>

                <div class="ss-tab-bar" role="tablist" aria-label="Share options">
                    <button class="ss-tab ss-active" data-tab="qr" type="button" role="tab" aria-selected="true">QR Code</button>
                    <button class="ss-tab" data-tab="links" type="button" role="tab" aria-selected="false">Share Links</button>
                    <button class="ss-tab" data-tab="import" type="button" role="tab" aria-selected="false">Import</button>
                </div>

                <div class="ss-tab-panel ss-visible" data-panel="qr" role="tabpanel">
                    <div class="ss-qr-section">
                        <canvas id="ss-qr-canvas"></canvas>
                        <div class="ss-qr-note">${isSmall ? 'Full script encoded in QR code' : 'Links to download URL / Greasy Fork search'}</div>
                        ${!qrData ? '<div class="ss-qr-note" style="color:var(--accent-yellow)">Script too large for QR encoding</div>' : ''}
                    </div>
                    <div class="ss-section-title">Data URL</div>
                    <div class="ss-input-group">
                        <input type="text" value="${escapeAttr(dataUrl)}" readonly id="ss-data-url-input" />
                        <button data-action="copy-dataurl" type="button">Copy</button>
                    </div>
                </div>

                <div class="ss-tab-panel" data-panel="links" role="tabpanel" hidden>
                    <div class="ss-share-actions">
                        ${meta.downloadURL ? `
                        <button class="ss-share-btn" data-action="copy-install-url" type="button">
                            <span class="ss-icon">\uD83D\uDD17</span>
                            <span class="ss-label">Copy Install URL<br><span class="ss-sublabel">${escapeHtml(truncate(meta.downloadURL, 50))}</span></span>
                        </button>` : ''}
                        <button class="ss-share-btn" data-action="copy-link" type="button">
                            <span class="ss-icon">\uD83D\uDCCB</span>
                            <span class="ss-label">Copy as Data URL<br><span class="ss-sublabel">Self-contained encoded link</span></span>
                        </button>
                        <button class="ss-share-btn" data-action="share-email" type="button">
                            <span class="ss-icon">\u2709</span>
                            <span class="ss-label">Share via Email<br><span class="ss-sublabel">Opens email client with script details</span></span>
                        </button>
                        <button class="ss-share-btn" data-action="export-file" type="button">
                            <span class="ss-icon">\uD83D\uDCE5</span>
                            <span class="ss-label">Export as .user.js<br><span class="ss-sublabel">Download script file</span></span>
                        </button>
                    </div>
                </div>

                <div class="ss-tab-panel" data-panel="import" role="tabpanel" hidden>
                    <div class="ss-section-title">Paste Data URL to Import</div>
                    <textarea class="ss-import-area" id="ss-import-input" placeholder="Paste a data:application/x-userscript;base64,… URL here"></textarea>
                    <button class="ss-install-btn" data-action="import-decode" type="button" style="margin-top:8px;">Decode &amp; Preview</button>
                    <div id="ss-import-preview"></div>
                </div>
            </div>
        `;

        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Share Script');

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        _state.modalEl = overlay;

        // Render QR code
        const qrCanvas = modal.querySelector('#ss-qr-canvas');
        if (qrCanvas && qrData) {
            QR.renderToCanvas(qrCanvas, qrData, 4);
        }

        // Event delegation
        overlay.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            const action = target?.dataset.action;

            if (e.target === overlay || action === 'close') {
                closeModal();
                return;
            }

            // Tab switching
            const tab = e.target.closest('.ss-tab');
            if (tab) {
                const tabName = tab.dataset.tab;
                modal.querySelectorAll('.ss-tab').forEach(t => {
                    const isActive = t === tab;
                    t.classList.toggle('ss-active', isActive);
                    t.setAttribute('aria-selected', String(isActive));
                });
                modal.querySelectorAll('.ss-tab-panel').forEach(p => {
                    const isActive = p.dataset.panel === tabName;
                    p.classList.toggle('ss-visible', isActive);
                    p.hidden = !isActive;
                });
                return;
            }

            if (!action) return;

            switch (action) {
                case 'copy-dataurl':
                    copyToClipboard(dataUrl);
                    incrementShareCount(scriptId);
                    break;
                case 'copy-install-url':
                    copyToClipboard(meta.downloadURL);
                    incrementShareCount(scriptId);
                    break;
                case 'copy-link':
                    copyToClipboard(dataUrl);
                    incrementShareCount(scriptId);
                    break;
                case 'share-email': {
                    const subject = encodeURIComponent(`Userscript: ${meta.name}`);
                    const body = encodeURIComponent(`Check out this userscript: ${meta.name}${meta.version ? ` v${meta.version}` : ''}\n\n${meta.description ? meta.description + '\n\n' : ''}${meta.downloadURL || dataUrl}`);
                    window.open(`mailto:?subject=${subject}&body=${body}`);
                    incrementShareCount(scriptId);
                    break;
                }
                case 'export-file': {
                    const safeName = meta.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'script';
                    downloadFile(`${safeName}.user.js`, code, 'application/javascript');
                    incrementShareCount(scriptId);
                    break;
                }
                case 'import-decode': {
                    const input = modal.querySelector('#ss-import-input');
                    const preview = modal.querySelector('#ss-import-preview');
                    const decoded = decodeScript(input.value.trim());
                    if (decoded) {
                        const importMeta = parseMetadata(decoded);
                        const previewCode = decoded.split('\n').slice(0, 8).join('\n');
                        preview.innerHTML = `
                            <div class="ss-preview-box">
                                <div class="ss-name">${escapeHtml(importMeta.name)}</div>
                                <div class="ss-meta">${importMeta.version ? `v${escapeHtml(importMeta.version)}` : ''} ${importMeta.author ? `by ${escapeHtml(importMeta.author)}` : ''}</div>
                                <div class="ss-code-preview">${escapeHtml(previewCode)}</div>
                            </div>
                            <button class="ss-install-btn" data-action="install-decoded" type="button">Install Script</button>
                        `;
                        preview._decodedCode = decoded;
                    } else {
                        preview.innerHTML = `<div style="color:var(--accent-red);margin-top:8px;">Invalid data URL or not a valid userscript.</div>`;
                    }
                    break;
                }
                case 'install-decoded': {
                    const preview = modal.querySelector('#ss-import-preview');
                    if (preview._decodedCode && typeof _state.onInstallScript === 'function') {
                        _state.onInstallScript(preview._decodedCode);
                        toast('Script installed');
                        closeModal();
                    }
                    break;
                }
            }
        });
    }

    function closeModal() {
        if (_state.modalEl) {
            _state.modalEl.remove();
            _state.modalEl = null;
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function truncate(str, max) {
        return str && str.length > max ? str.slice(0, max - 1) + '\u2026' : (str || '');
    }

    // =========================================
    // Batch Export
    // =========================================
    function batchExport(scriptIds) {
        if (!_state.getScript || !scriptIds || scriptIds.length === 0) return;

        const files = [];
        for (const id of scriptIds) {
            const script = _state.getScript(id);
            if (!script || !script.code) continue;
            const meta = parseMetadata(script.code);
            const safeName = (meta.name || 'script').replace(/[^a-zA-Z0-9_-]/g, '_');
            files.push({
                name: `${safeName}.user.js`,
                content: script.code
            });
        }

        if (files.length === 0) return;

        if (files.length === 1) {
            downloadFile(files[0].name, files[0].content, 'application/javascript');
            return;
        }

        const zipBlob = createZip(files);
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scriptvault-export-${files.length}-scripts.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        // Increment share counts
        for (const id of scriptIds) {
            incrementShareCount(id);
        }

        toast(`Exported ${files.length} scripts`);
    }

    // =========================================
    // Public: Generate QR
    // =========================================
    function generateQR(text, size = 200) {
        const qrData = QR.encode(text);
        if (!qrData) return null;
        const canvas = document.createElement('canvas');
        const pixelSize = Math.max(2, Math.floor(size / (qrData.size + 8)));
        QR.renderToCanvas(canvas, qrData, pixelSize);
        return canvas;
    }

    // =========================================
    // Public: Encode / Decode
    // =========================================
    function encodeScript(scriptId) {
        if (!_state.getScript) return null;
        const script = _state.getScript(scriptId);
        if (!script || !script.code) return null;
        return encodeScriptToDataUrl(script.code);
    }

    function decodeScript(dataUrl) {
        if (!dataUrl) return null;
        const decoded = decodeDataUrl(dataUrl);
        if (!decoded) return null;
        if (!isValidUserscript(decoded)) return null;
        return decoded;
    }

    // =========================================
    // Init / Destroy
    // =========================================
    function init(options = {}) {
        injectStyles();
        _state.getScript = options.getScript || null;
        _state.getAllScripts = options.getAllScripts || null;
        _state.onInstallScript = options.onInstallScript || null;
        _state.updateScript = options.updateScript || null;
    }

    function destroy() {
        closeModal();
        if (_state.styleEl) {
            _state.styleEl.remove();
            _state.styleEl = null;
        }
        _state.getScript = null;
        _state.getAllScripts = null;
        _state.onInstallScript = null;
        _state.updateScript = null;
    }

    return {
        init,
        showShareModal,
        generateQR,
        encodeScript,
        decodeScript,
        batchExport,
        destroy
    };
})();
