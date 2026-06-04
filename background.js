// ScriptVault v3.11.0 - Background Service Worker
// Comprehensive userscript manager with cloud sync and auto-updates
// NOTE: This file is built from source modules. Edit the individual files in
// shared/, modules/, and lib/, then run `npm run build` to regenerate.

// ============================================================================
// Generated from src/shared/utils.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SharedUtils = (() => {
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

  // src/shared/utils.ts
  var utils_exports = {};
  __export(utils_exports, {
    classifyInstallSource: () => classifyInstallSource,
    escapeHtml: () => escapeHtml,
    formatBytes: () => formatBytes,
    generateId: () => generateId,
    sanitizeUrl: () => sanitizeUrl
  });
  module.exports = __toCommonJS(utils_exports);
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function generateId() {
    return "script_" + crypto.randomUUID();
  }
  function sanitizeUrl(url) {
    if (!url) return null;
    const trimmed = String(url).replace(/[\u0000-\u0020\u007f]+/g, "");
    if (!trimmed) return null;
    if (/^(javascript|data|vbscript|blob|file):/i.test(trimmed)) return null;
    if (/^(https?|ftp|mailto):/i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("#")) {
      return trimmed;
    }
    if (trimmed.startsWith("//")) return trimmed;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
    return trimmed;
  }
  function classifyInstallSource(url) {
    if (typeof url !== "string" || !url.trim()) {
      return { id: "local", name: "Local import", hostname: "", tone: "neutral", url: "" };
    }
    let host = "";
    let path = "";
    try {
      const u = new URL(url);
      host = (u.hostname || "").toLowerCase();
      path = u.pathname || "";
    } catch (_) {
      return { id: "other", name: "Unknown source", hostname: "", tone: "warn", url };
    }
    if (host === "greasyfork.org" || host === "www.greasyfork.org") {
      return { id: "greasyfork", name: "Greasy Fork", hostname: host, tone: "good", url };
    }
    if (host === "sleazyfork.org" || host === "www.sleazyfork.org") {
      return { id: "sleazyfork", name: "Sleazy Fork", hostname: host, tone: "warn", url };
    }
    if (host === "openuserjs.org" || host === "www.openuserjs.org") {
      return { id: "openuserjs", name: "OpenUserJS", hostname: host, tone: "good", url };
    }
    if (host === "gist.github.com" || host === "gist.githubusercontent.com") {
      return { id: "github-gist", name: "GitHub Gist", hostname: host, tone: "neutral", url };
    }
    if (host === "raw.githubusercontent.com") {
      return { id: "github-raw", name: "GitHub raw", hostname: host, tone: "neutral", url };
    }
    if (host === "github.com" || host === "www.github.com") {
      if (/\/releases\/(download|latest)/i.test(path)) {
        return { id: "github-release", name: "GitHub release", hostname: host, tone: "good", url };
      }
      return { id: "github", name: "GitHub", hostname: host, tone: "neutral", url };
    }
    if (host === "gitlab.com" || host === "www.gitlab.com") {
      return { id: "gitlab", name: "GitLab", hostname: host, tone: "neutral", url };
    }
    if (host === "codeberg.org") {
      return { id: "codeberg", name: "Codeberg", hostname: host, tone: "neutral", url };
    }
    if (host === "bitbucket.org") {
      return { id: "bitbucket", name: "Bitbucket", hostname: host, tone: "neutral", url };
    }
    if (host === "tampermonkey.net" || host === "www.tampermonkey.net") {
      return { id: "tampermonkey", name: "Tampermonkey site", hostname: host, tone: "neutral", url };
    }
    return { id: "other", name: host || "Unknown source", hostname: host, tone: "warn", url };
  }
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
  return module.exports.default || module.exports;
})();

const escapeHtml = SharedUtils.escapeHtml;
const generateId = SharedUtils.generateId;
const sanitizeUrl = SharedUtils.sanitizeUrl;
const classifyInstallSource = SharedUtils.classifyInstallSource;
const formatBytes = SharedUtils.formatBytes;

// ============================================================================
// SHARED SETTINGS DEFAULTS
// Generated from src/config/settings-defaults.json
// ============================================================================
const SCRIPTVAULT_SETTINGS_DEFAULTS = {
  "enabled": true,
  "showBadge": true,
  "badgeColor": "#22c55e",
  "theme": "dark",
  "layout": "dark",
  "notifyOnInstall": true,
  "notifyOnUpdate": true,
  "notifyOnError": false,
  "editorTheme": "material-darker",
  "editorFontSize": 13,
  "editorTabSize": 2,
  "editorLineWrapping": false,
  "editorAutoComplete": true,
  "editorMatchBrackets": true,
  "editorAutoCloseBrackets": true,
  "editorHighlightActiveLine": true,
  "editorShowInvisibles": false,
  "editorKeyMap": "default",
  "autoUpdate": true,
  "autoUpdateMode": "notify",
  "updateInterval": 86400000,
  "lastUpdateCheck": 0,
  "syncEnabled": false,
  "syncProvider": "none",
  "syncInterval": 3600000,
  "lastSync": 0,
  "webdavUrl": "",
  "webdavUsername": "",
  "webdavPassword": "",
  "googleDriveConnected": false,
  "googleDriveToken": "",
  "googleDriveRefreshToken": "",
  "googleClientId": "",
  "googleDriveUser": null,
  "dropboxToken": "",
  "dropboxRefreshToken": "",
  "dropboxUser": null,
  "dropboxClientId": "",
  "onedriveToken": "",
  "onedriveRefreshToken": "",
  "onedriveClientId": "",
  "onedriveConnected": false,
  "onedriveUser": null,
  "s3Endpoint": "",
  "s3Region": "",
  "s3Bucket": "",
  "s3AccessKeyId": "",
  "s3SecretKey": "",
  "s3ObjectKey": "",
  "language": "auto",
  "debugMode": false,
  "experimentalESMUserscripts": false,
  "dashboardVirtualizationThreshold": 500,
  "injectIntoFrames": true,
  "xhrTimeout": 30000,
  "blacklist": [],
  "badgeInfo": "running",
  "autoReload": false,
  "pageFilterMode": "blacklist",
  "blacklistedPages": "",
  "whitelistedPages": "",
  "deniedHosts": [],
  "trustedSigningKeys": {},
  "trashMode": "30"
};

// ============================================================================
// INLINED: fflate v0.8.3 - Browser-only ZIP library
// ============================================================================
(function() {
  'use strict';
  try {
// DEFLATE is a complex format; to read this code, you should probably check the RFC first:
// https://tools.ietf.org/html/rfc1951
// You may also wish to take a look at the guide I made about this program:
// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad
// Some of the following code is similar to that of UZIP.js:
// https://github.com/photopea/UZIP.js
// However, the vast majority of the codebase has diverged from UZIP.js to increase performance and reduce bundle size.
// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint
// is better for memory in most engines (I *think*).
var ch2 = {};
var wk = (function (c, id, msg, transfer, cb) {
    var w = new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([
        c + ';addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'
    ], { type: 'text/javascript' }))));
    w.onmessage = function (e) {
        var d = e.data, ed = d.$e$;
        if (ed) {
            var err = new Error(ed[0]);
            err['code'] = ed[1];
            err.stack = ed[2];
            cb(err, null);
        }
        else
            cb(null, d);
    };
    w.postMessage(msg, transfer);
    return w;
});

// aliases for shorter compressed code (most minifers don't do this)
var u8 = Uint8Array, u16 = Uint16Array, i32 = Int32Array;
// fixed length extra bits
var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);
// fixed distance extra bits
var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);
// code length index map
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
// get base, reverse index map from extra bits
var freb = function (eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
        b[i] = start += 1 << eb[i - 1];
    }
    // numbers here are at max 18 bits
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
        for (var j = b[i]; j < b[i + 1]; ++j) {
            r[j] = ((j - b[i]) << 5) | i;
        }
    }
    return { b: b, r: r };
};
var _a = freb(fleb, 2), fl = _a.b, revfl = _a.r;
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0), fd = _b.b, revfd = _b.r;
// map of value to reverse (assuming 16 bits)
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
    // reverse table algorithm from SO
    var x = ((i & 0xAAAA) >> 1) | ((i & 0x5555) << 1);
    x = ((x & 0xCCCC) >> 2) | ((x & 0x3333) << 2);
    x = ((x & 0xF0F0) >> 4) | ((x & 0x0F0F) << 4);
    rev[i] = (((x & 0xFF00) >> 8) | ((x & 0x00FF) << 8)) >> 1;
}
// create huffman tree from u8 "map": index -> code length for code index
// mb (max bits) must be at most 15
// TODO: optimize/split up?
var hMap = (function (cd, mb, r) {
    var s = cd.length;
    // index
    var i = 0;
    // u16 "map": index -> # of codes with bit length = index
    var l = new u16(mb);
    // length of cd must be 288 (total # of codes)
    for (; i < s; ++i) {
        if (cd[i])
            ++l[cd[i] - 1];
    }
    // u16 "map": index -> minimum code for bit length = index
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
        le[i] = (le[i - 1] + l[i - 1]) << 1;
    }
    var co;
    if (r) {
        // u16 "map": index -> number of actual bits, symbol for code
        co = new u16(1 << mb);
        // bits to remove for reverser
        var rvb = 15 - mb;
        for (i = 0; i < s; ++i) {
            // ignore 0 lengths
            if (cd[i]) {
                // num encoding both symbol and bits read
                var sv = (i << 4) | cd[i];
                // free bits
                var r_1 = mb - cd[i];
                // start value
                var v = le[cd[i] - 1]++ << r_1;
                // m is end value
                for (var m = v | ((1 << r_1) - 1); v <= m; ++v) {
                    // every 16 bit value starting with the code yields the same result
                    co[rev[v] >> rvb] = sv;
                }
            }
        }
    }
    else {
        co = new u16(s);
        for (i = 0; i < s; ++i) {
            if (cd[i]) {
                co[i] = rev[le[cd[i] - 1]++] >> (15 - cd[i]);
            }
        }
    }
    return co;
});
// fixed length tree
var flt = new u8(288);
for (var i = 0; i < 144; ++i)
    flt[i] = 8;
for (var i = 144; i < 256; ++i)
    flt[i] = 9;
for (var i = 256; i < 280; ++i)
    flt[i] = 7;
for (var i = 280; i < 288; ++i)
    flt[i] = 8;
// fixed distance tree
var fdt = new u8(32);
for (var i = 0; i < 32; ++i)
    fdt[i] = 5;
// fixed length map
var flm = /*#__PURE__*/ hMap(flt, 9, 0), flrm = /*#__PURE__*/ hMap(flt, 9, 1);
// fixed distance map
var fdm = /*#__PURE__*/ hMap(fdt, 5, 0), fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
// find max of array
var max = function (a) {
    var m = a[0];
    for (var i = 1; i < a.length; ++i) {
        if (a[i] > m)
            m = a[i];
    }
    return m;
};
// read d, starting at bit p and mask with m
var bits = function (d, p, m) {
    var o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
};
// read d, starting at bit p continuing for at least 16 bits
var bits16 = function (d, p) {
    var o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7));
};
// get end of byte
var shft = function (p) { return ((p + 7) / 8) | 0; };
// typed array slice - allows garbage collector to free original reference,
// while being more compatible than .slice
var slc = function (v, s, e) {
    if (s == null || s < 0)
        s = 0;
    if (e == null || e > v.length)
        e = v.length;
    // can't use .constructor in case user-supplied
    return new u8(v.subarray(s, e));
};
/**
 * Codes for errors generated within this library
 */
var FlateErrorCode = {
    UnexpectedEOF: 0,
    InvalidBlockType: 1,
    InvalidLengthLiteral: 2,
    InvalidDistance: 3,
    StreamFinished: 4,
    NoStreamHandler: 5,
    InvalidHeader: 6,
    NoCallback: 7,
    InvalidUTF8: 8,
    ExtraFieldTooLong: 9,
    InvalidDate: 10,
    FilenameTooLong: 11,
    StreamFinishing: 12,
    InvalidZipData: 13,
    UnknownCompressionMethod: 14
};
// error codes
var ec = [
    'unexpected EOF',
    'invalid block type',
    'invalid length/literal',
    'invalid distance',
    'stream finished',
    'no stream handler',
    , // determined by compression function
    'no callback',
    'invalid UTF-8 data',
    'extra field too long',
    'date not in range 1980-2099',
    'filename too long',
    'stream finishing',
    'invalid zip data'
    // determined by unknown compression method
];
;
var err = function (ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
    if (!nt)
        throw e;
    return e;
};
// expands raw DEFLATE data
var inflt = function (dat, st, buf, dict) {
    // source length       dict length
    var sl = dat.length, dl = dict ? dict.length : 0;
    if (!sl || st.f && !st.l)
        return buf || new u8(0);
    var noBuf = !buf;
    // have to estimate size
    var resize = noBuf || st.i != 2;
    // no state
    var noSt = st.i;
    // Assumes roughly 33% compression ratio average
    if (noBuf)
        buf = new u8(sl * 3);
    // ensure buffer can fit at least l elements
    var cbuf = function (l) {
        var bl = buf.length;
        // need to increase size to fit
        if (l > bl) {
            // Double or set to necessary, whichever is greater
            var nbuf = new u8(Math.max(bl * 2, l));
            nbuf.set(buf);
            buf = nbuf;
        }
    };
    //  last chunk         bitpos           bytes
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    // total bits
    var tbts = sl * 8;
    do {
        if (!lm) {
            // BFINAL - this is only 1 when last chunk is next
            final = bits(dat, pos, 1);
            // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
            var type = bits(dat, pos + 1, 3);
            pos += 3;
            if (!type) {
                // go to end of byte boundary
                var s = shft(pos) + 4, l = dat[s - 4] | (dat[s - 3] << 8), t = s + l;
                if (t > sl) {
                    if (noSt)
                        err(0);
                    break;
                }
                // ensure size
                if (resize)
                    cbuf(bt + l);
                // Copy over uncompressed data
                buf.set(dat.subarray(s, t), bt);
                // Get new bitpos, update byte count
                st.b = bt += l, st.p = pos = t * 8, st.f = final;
                continue;
            }
            else if (type == 1)
                lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
            else if (type == 2) {
                //  literal                            lengths
                var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
                var tl = hLit + bits(dat, pos + 5, 31) + 1;
                pos += 14;
                // length+distance tree
                var ldt = new u8(tl);
                // code length tree
                var clt = new u8(19);
                for (var i = 0; i < hcLen; ++i) {
                    // use index map to get real code
                    clt[clim[i]] = bits(dat, pos + i * 3, 7);
                }
                pos += hcLen * 3;
                // code lengths bits
                var clb = max(clt), clbmsk = (1 << clb) - 1;
                // code lengths map
                var clm = hMap(clt, clb, 1);
                for (var i = 0; i < tl;) {
                    var r = clm[bits(dat, pos, clbmsk)];
                    // bits read
                    pos += r & 15;
                    // symbol
                    var s = r >> 4;
                    // code length to copy
                    if (s < 16) {
                        ldt[i++] = s;
                    }
                    else {
                        //  copy   count
                        var c = 0, n = 0;
                        if (s == 16)
                            n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                        else if (s == 17)
                            n = 3 + bits(dat, pos, 7), pos += 3;
                        else if (s == 18)
                            n = 11 + bits(dat, pos, 127), pos += 7;
                        while (n--)
                            ldt[i++] = c;
                    }
                }
                //    length tree                 distance tree
                var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
                // max length bits
                lbt = max(lt);
                // max dist bits
                dbt = max(dt);
                lm = hMap(lt, lbt, 1);
                dm = hMap(dt, dbt, 1);
            }
            else
                err(1);
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
        }
        // Make sure the buffer can hold this + the largest possible addition
        // Maximum chunk size (practically, theoretically infinite) is 2^17
        if (resize)
            cbuf(bt + 131072);
        var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
        var lpos = pos;
        for (;; lpos = pos) {
            // bits read, code
            var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
            pos += c & 15;
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
            if (!c)
                err(2);
            if (sym < 256)
                buf[bt++] = sym;
            else if (sym == 256) {
                lpos = pos, lm = null;
                break;
            }
            else {
                var add = sym - 254;
                // no extra bits needed if less
                if (sym > 264) {
                    // index
                    var i = sym - 257, b = fleb[i];
                    add = bits(dat, pos, (1 << b) - 1) + fl[i];
                    pos += b;
                }
                // dist
                var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
                if (!d)
                    err(3);
                pos += d & 15;
                var dt = fd[dsym];
                if (dsym > 3) {
                    var b = fdeb[dsym];
                    dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
                }
                if (pos > tbts) {
                    if (noSt)
                        err(0);
                    break;
                }
                if (resize)
                    cbuf(bt + 131072);
                var end = bt + add;
                if (bt < dt) {
                    var shift = dl - dt, dend = Math.min(dt, end);
                    if (shift + bt < 0)
                        err(3);
                    for (; bt < dend; ++bt)
                        buf[bt] = dict[shift + bt];
                }
                for (; bt < end; ++bt)
                    buf[bt] = buf[bt - dt];
            }
        }
        st.l = lm, st.p = lpos, st.b = bt, st.f = final;
        if (lm)
            final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    // don't reallocate for streams or user buffers
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
// starting at p, write the minimum number of bits that can hold v to d
var wbits = function (d, p, v) {
    v <<= p & 7;
    var o = (p / 8) | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
};
// starting at p, write the minimum number of bits (>8) that can hold v to d
var wbits16 = function (d, p, v) {
    v <<= p & 7;
    var o = (p / 8) | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
};
// creates code lengths from a frequency table
var hTree = function (d, mb) {
    // Need extra info to make a tree
    var t = [];
    for (var i = 0; i < d.length; ++i) {
        if (d[i])
            t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
        return { t: et, l: 0 };
    if (s == 1) {
        var v = new u8(t[0].s + 1);
        v[t[0].s] = 1;
        return { t: v, l: 1 };
    }
    t.sort(function (a, b) { return a.f - b.f; });
    // after i2 reaches last ind, will be stopped
    // freq must be greater than largest possible number of symbols
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l: l, r: r };
    // efficient algorithm from UZIP.js
    // i0 is lookbehind, i2 is lookahead - after processing two low-freq
    // symbols that combined have high freq, will start processing i2 (high-freq,
    // non-composite) symbols instead
    // see https://reddit.com/r/photopea/comments/ikekht/uzipjs_questions/
    while (i1 != s - 1) {
        l = t[t[i0].f < t[i2].f ? i0++ : i2++];
        r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
        t[i1++] = { s: -1, f: l.f + r.f, l: l, r: r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
        if (t2[i].s > maxSym)
            maxSym = t2[i].s;
    }
    // code lengths
    var tr = new u16(maxSym + 1);
    // max bits in tree
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
        // more algorithms from UZIP.js
        // TODO: find out how this code works (debt)
        //  ind    debt
        var i = 0, dt = 0;
        //    left            cost
        var lft = mbt - mb, cst = 1 << lft;
        t2.sort(function (a, b) { return tr[b.s] - tr[a.s] || a.f - b.f; });
        for (; i < s; ++i) {
            var i2_1 = t2[i].s;
            if (tr[i2_1] > mb) {
                dt += cst - (1 << (mbt - tr[i2_1]));
                tr[i2_1] = mb;
            }
            else
                break;
        }
        dt >>= lft;
        while (dt > 0) {
            var i2_2 = t2[i].s;
            if (tr[i2_2] < mb)
                dt -= 1 << (mb - tr[i2_2]++ - 1);
            else
                ++i;
        }
        for (; i >= 0 && dt; --i) {
            var i2_3 = t2[i].s;
            if (tr[i2_3] == mb) {
                --tr[i2_3];
                ++dt;
            }
        }
        mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
};
// get the max length and assign length codes
var ln = function (n, l, d) {
    return n.s == -1
        ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1))
        : (l[n.s] = d);
};
// length codes generation
var lc = function (c) {
    var s = c.length;
    // Note that the semicolon was intentional
    while (s && !c[--s])
        ;
    var cl = new u16(++s);
    //  ind      num         streak
    var cli = 0, cln = c[0], cls = 1;
    var w = function (v) { cl[cli++] = v; };
    for (var i = 1; i <= s; ++i) {
        if (c[i] == cln && i != s)
            ++cls;
        else {
            if (!cln && cls > 2) {
                for (; cls > 138; cls -= 138)
                    w(32754);
                if (cls > 2) {
                    w(cls > 10 ? ((cls - 11) << 5) | 28690 : ((cls - 3) << 5) | 12305);
                    cls = 0;
                }
            }
            else if (cls > 3) {
                w(cln), --cls;
                for (; cls > 6; cls -= 6)
                    w(8304);
                if (cls > 2)
                    w(((cls - 3) << 5) | 8208), cls = 0;
            }
            while (cls--)
                w(cln);
            cls = 1;
            cln = c[i];
        }
    }
    return { c: cl.subarray(0, cli), n: s };
};
// calculate the length of output from tree, code lengths
var clen = function (cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
        l += cf[i] * cl[i];
    return l;
};
// writes a fixed block
// returns the new bit pos
var wfblk = function (out, pos, dat) {
    // no need to write 00 as type: TypedArray defaults to 0
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
        out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
};
// writes a block
var wblk = function (dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a = hTree(lf, 15), dlt = _a.t, mlb = _a.l;
    var _b = hTree(df, 15), ddt = _b.t, mdb = _b.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
        ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
        ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
        ;
    var flen = (bl + 5) << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
        return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
        lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
        var llm = hMap(lct, mlcb, 0);
        wbits(out, p, nlc - 257);
        wbits(out, p + 5, ndc - 1);
        wbits(out, p + 10, nlcc - 4);
        p += 14;
        for (var i = 0; i < nlcc; ++i)
            wbits(out, p + 3 * i, lct[clim[i]]);
        p += 3 * nlcc;
        var lcts = [lclt, lcdt];
        for (var it = 0; it < 2; ++it) {
            var clct = lcts[it];
            for (var i = 0; i < clct.length; ++i) {
                var len = clct[i] & 31;
                wbits(out, p, llm[len]), p += lct[len];
                if (len > 15)
                    wbits(out, p, (clct[i] >> 5) & 127), p += clct[i] >> 12;
            }
        }
    }
    else {
        lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
        var sym = syms[i];
        if (sym > 255) {
            var len = (sym >> 18) & 31;
            wbits16(out, p, lm[len + 257]), p += ll[len + 257];
            if (len > 7)
                wbits(out, p, (sym >> 23) & 31), p += fleb[len];
            var dst = sym & 31;
            wbits16(out, p, dm[dst]), p += dl[dst];
            if (dst > 3)
                wbits16(out, p, (sym >> 5) & 8191), p += fdeb[dst];
        }
        else {
            wbits16(out, p, lm[sym]), p += ll[sym];
        }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
};
// deflate options (nice << 13) | chain
var deo = /*#__PURE__*/ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
// empty
var et = /*#__PURE__*/ new u8(0);
// compresses data into a raw DEFLATE buffer
var dflt = function (dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7000)) + post);
    // writing to this writes to the output buffer
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
        if (pos)
            w[0] = st.r >> 3;
        var opt = deo[lvl - 1];
        var n = opt >> 13, c = opt & 8191;
        var msk_1 = (1 << plvl) - 1;
        //    prev 2-byte val map    curr 2-byte val map
        var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
        var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
        var hsh = function (i) { return (dat[i] ^ (dat[i + 1] << bs1_1) ^ (dat[i + 2] << bs2_1)) & msk_1; };
        // 24576 is an arbitrary number of maximum symbols per block
        // 424 buffer for last block
        var syms = new i32(25000);
        // length/literal freq   distance freq
        var lf = new u16(288), df = new u16(32);
        //  l/lcnt  exbits  index          l/lind  waitdx          blkpos
        var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
        for (; i + 2 < s; ++i) {
            // hash value
            var hv = hsh(i);
            // index mod 32768    previous index mod
            var imod = i & 32767, pimod = head[hv];
            prev[imod] = pimod;
            head[hv] = imod;
            // We always should modify head and prev, but only add symbols if
            // this data is not yet processed ("wait" for wait index)
            if (wi <= i) {
                // bytes remaining
                var rem = s - i;
                if ((lc_1 > 7000 || li > 24576) && (rem > 423 || !lst)) {
                    pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
                    li = lc_1 = eb = 0, bs = i;
                    for (var j = 0; j < 286; ++j)
                        lf[j] = 0;
                    for (var j = 0; j < 30; ++j)
                        df[j] = 0;
                }
                //  len    dist   chain
                var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
                if (rem > 2 && hv == hsh(i - dif)) {
                    var maxn = Math.min(n, rem) - 1;
                    var maxd = Math.min(32767, i);
                    // max possible length
                    // not capped at dif because decompressors implement "rolling" index population
                    var ml = Math.min(258, rem);
                    while (dif <= maxd && --ch_1 && imod != pimod) {
                        if (dat[i + l] == dat[i + l - dif]) {
                            var nl = 0;
                            for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                                ;
                            if (nl > l) {
                                l = nl, d = dif;
                                // break out early when we reach "nice" (we are satisfied enough)
                                if (nl > maxn)
                                    break;
                                // now, find the rarest 2-byte sequence within this
                                // length of literals and search for that instead.
                                // Much faster than just using the start
                                var mmd = Math.min(dif, nl - 2);
                                var md = 0;
                                for (var j = 0; j < mmd; ++j) {
                                    var ti = i - dif + j & 32767;
                                    var pti = prev[ti];
                                    var cd = ti - pti & 32767;
                                    if (cd > md)
                                        md = cd, pimod = ti;
                                }
                            }
                        }
                        // check the previous match
                        imod = pimod, pimod = prev[imod];
                        dif += imod - pimod & 32767;
                    }
                }
                // d will be nonzero only when a match was found
                if (d) {
                    // store both dist and len data in one int32
                    // Make sure this is recognized as a len/dist with 28th bit (2^28)
                    syms[li++] = 268435456 | (revfl[l] << 18) | revfd[d];
                    var lin = revfl[l] & 31, din = revfd[d] & 31;
                    eb += fleb[lin] + fdeb[din];
                    ++lf[257 + lin];
                    ++df[din];
                    wi = i + l;
                    ++lc_1;
                }
                else {
                    syms[li++] = dat[i];
                    ++lf[dat[i]];
                }
            }
        }
        for (i = Math.max(i, wi); i < s; ++i) {
            syms[li++] = dat[i];
            ++lf[dat[i]];
        }
        pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
        if (!lst) {
            st.r = (pos & 7) | w[(pos / 8) | 0] << 3;
            // shft(pos) now 1 less if pos & 7 != 0
            pos -= 7;
            st.h = head, st.p = prev, st.i = i, st.w = wi;
        }
    }
    else {
        for (var i = st.w || 0; i < s + lst; i += 65535) {
            // end
            var e = i + 65535;
            if (e >= s) {
                // write final block
                w[(pos / 8) | 0] = lst;
                e = s;
            }
            pos = wfblk(w, pos + 1, dat.subarray(i, e));
        }
        st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
};
// CRC32 table
var crct = /*#__PURE__*/ (function () {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
        var c = i, k = 9;
        while (--k)
            c = ((c & 1) && -306674912) ^ (c >>> 1);
        t[i] = c;
    }
    return t;
})();
// CRC32
var crc = function () {
    var c = -1;
    return {
        p: function (d) {
            // closures have awful performance
            var cr = c;
            for (var i = 0; i < d.length; ++i)
                cr = crct[(cr & 255) ^ d[i]] ^ (cr >>> 8);
            c = cr;
        },
        d: function () { return ~c; }
    };
};
// Adler32
var adler = function () {
    var a = 1, b = 0;
    return {
        p: function (d) {
            // closures have awful performance
            var n = a, m = b;
            var l = d.length | 0;
            for (var i = 0; i != l;) {
                var e = Math.min(i + 2655, l);
                for (; i < e; ++i)
                    m += n += d[i];
                n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
            }
            a = n, b = m;
        },
        d: function () {
            a %= 65521, b %= 65521;
            return (a & 255) << 24 | (a & 0xFF00) << 8 | (b & 255) << 8 | (b >> 8);
        }
    };
};
;
// deflate with opts
var dopt = function (dat, opt, pre, post, st) {
    if (!st) {
        st = { l: 1 };
        if (opt.dictionary) {
            var dict = opt.dictionary.subarray(-32768);
            var newDat = new u8(dict.length + dat.length);
            newDat.set(dict);
            newDat.set(dat, dict.length);
            dat = newDat;
            st.w = dict.length;
        }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? (st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20) : (12 + opt.mem), pre, post, st);
};
// Walmart object spread
var mrg = function (a, b) {
    var o = {};
    for (var k in a)
        o[k] = a[k];
    for (var k in b)
        o[k] = b[k];
    return o;
};
// worker clone
// This is possibly the craziest part of the entire codebase, despite how simple it may seem.
// The only parameter to this function is a closure that returns an array of variables outside of the function scope.
// We're going to try to figure out the variable names used in the closure as strings because that is crucial for workerization.
// We will return an object mapping of true variable name to value (basically, the current scope as a JS object).
// The reason we can't just use the original variable names is minifiers mangling the toplevel scope.
// This took me three weeks to figure out how to do.
var wcln = function (fn, fnStr, td) {
    var dt = fn();
    var st = fn.toString();
    var ks = st.slice(st.indexOf('[') + 1, st.lastIndexOf(']')).replace(/\s+/g, '').split(',');
    for (var i = 0; i < dt.length; ++i) {
        var v = dt[i], k = ks[i];
        if (typeof v == 'function') {
            fnStr += ';' + k + '=';
            var st_1 = v.toString();
            if (v.prototype) {
                // for global objects
                if (st_1.indexOf('[native code]') != -1) {
                    var spInd = st_1.indexOf(' ', 8) + 1;
                    fnStr += st_1.slice(spInd, st_1.indexOf('(', spInd));
                }
                else {
                    fnStr += st_1;
                    for (var t in v.prototype)
                        fnStr += ';' + k + '.prototype.' + t + '=' + v.prototype[t].toString();
                }
            }
            else
                fnStr += st_1;
        }
        else
            td[k] = v;
    }
    return fnStr;
};
var ch = [];
// clone bufs
var cbfs = function (v) {
    var tl = [];
    for (var k in v) {
        if (v[k].buffer) {
            tl.push((v[k] = new v[k].constructor(v[k])).buffer);
        }
    }
    return tl;
};
// use a worker to execute code
var wrkr = function (fns, init, id, cb) {
    if (!ch[id]) {
        var fnStr = '', td_1 = {}, m = fns.length - 1;
        for (var i = 0; i < m; ++i)
            fnStr = wcln(fns[i], fnStr, td_1);
        ch[id] = { c: wcln(fns[m], fnStr, td_1), e: td_1 };
    }
    var td = mrg({}, ch[id].e);
    return wk(ch[id].c + ';onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=' + init.toString() + '}', id, td, cbfs(td), cb);
};
// base async inflate fn
var bInflt = function () { return [u8, u16, i32, fleb, fdeb, clim, fl, fd, flrm, fdrm, rev, ec, hMap, max, bits, bits16, shft, slc, err, inflt, inflateSync, pbf, gopt]; };
var bDflt = function () { return [u8, u16, i32, fleb, fdeb, clim, revfl, revfd, flm, flt, fdm, fdt, rev, deo, et, hMap, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, shft, slc, dflt, dopt, deflateSync, pbf]; };
// gzip extra
var gze = function () { return [gzh, gzhl, wbytes, crc, crct]; };
// gunzip extra
var guze = function () { return [gzs, gzl]; };
// zlib extra
var zle = function () { return [zlh, wbytes, adler]; };
// unzlib extra
var zule = function () { return [zls]; };
// post buf
var pbf = function (msg) { return postMessage(msg, [msg.buffer]); };
// get opts
var gopt = function (o) { return o && {
    out: o.size && new u8(o.size),
    dictionary: o.dictionary
}; };
// async helper
var cbify = function (dat, opts, fns, init, id, cb) {
    var w = wrkr(fns, init, id, function (err, dat) {
        w.terminate();
        cb(err, dat);
    });
    w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);
    return function () { w.terminate(); };
};
// auto stream
var astrm = function (strm) {
    strm.ondata = function (dat, final) { return postMessage([dat, final], [dat.buffer]); };
    return function (ev) {
        if (ev.data[0]) {
            strm.push(ev.data[0], ev.data[1]);
            postMessage([ev.data[0].length]);
        }
        else
            strm.flush(ev.data[1]);
    };
};
// async stream attach
var astrmify = function (fns, strm, opts, init, id, flush, ext) {
    var t;
    var w = wrkr(fns, init, id, function (err, dat) {
        if (err)
            w.terminate(), strm.ondata.call(strm, err);
        else if (!Array.isArray(dat))
            ext(dat);
        else if (dat.length == 1) {
            strm.queuedSize -= dat[0];
            if (strm.ondrain)
                strm.ondrain(dat[0]);
        }
        else {
            if (dat[1])
                w.terminate();
            strm.ondata.call(strm, err, dat[0], dat[1]);
        }
    });
    w.postMessage(opts);
    strm.queuedSize = 0;
    strm.push = function (d, f) {
        if (!strm.ondata)
            err(5);
        if (t)
            strm.ondata(err(4, 0, 1), null, !!f);
        strm.queuedSize += d.length;
        // can fail for cross-realm Uint8Array, but ok - only a small performance penalty
        w.postMessage([d, t = f], d.buffer instanceof ArrayBuffer ? [d.buffer] : []);
    };
    strm.terminate = function () { w.terminate(); };
    if (flush) {
        strm.flush = function (sync) { w.postMessage([0, sync]); };
    }
};
// read 2 bytes
var b2 = function (d, b) { return d[b] | (d[b + 1] << 8); };
// read 4 bytes
var b4 = function (d, b) { return (d[b] | (d[b + 1] << 8) | (d[b + 2] << 16) | (d[b + 3] << 24)) >>> 0; };
// read 8 bytes
var b8 = function (d, b) { return b4(d, b) + (b4(d, b + 4) * 4294967296); };
// write bytes
var wbytes = function (d, b, v) {
    for (; v; ++b)
        d[b] = v, v >>>= 8;
};
// gzip header
var gzh = function (c, o) {
    var fn = o.filename;
    c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3; // assume Unix
    if (o.mtime != 0)
        wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1000));
    if (fn) {
        c[3] = 8;
        for (var i = 0; i <= fn.length; ++i)
            c[i + 10] = fn.charCodeAt(i);
    }
};
// gzip footer: -8 to -4 = CRC, -4 to -0 is length
// gzip start
var gzs = function (d) {
    if (d[0] != 31 || d[1] != 139 || d[2] != 8)
        err(6, 'invalid gzip data');
    var flg = d[3];
    var st = 10;
    if (flg & 4)
        st += (d[10] | d[11] << 8) + 2;
    for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
        ;
    return st + (flg & 2);
};
// gzip length
var gzl = function (d) {
    var l = d.length;
    return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
};
// gzip header length
var gzhl = function (o) { return 10 + (o.filename ? o.filename.length + 1 : 0); };
// zlib header
var zlh = function (c, o) {
    var lv = o.level, fl = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
    c[0] = 120, c[1] = (fl << 6) | (o.dictionary && 32);
    c[1] |= 31 - ((c[0] << 8) | c[1]) % 31;
    if (o.dictionary) {
        var h = adler();
        h.p(o.dictionary);
        wbytes(c, 2, h.d());
    }
};
// zlib start
var zls = function (d, dict) {
    if ((d[0] & 15) != 8 || (d[0] >> 4) > 7 || ((d[0] << 8 | d[1]) % 31))
        err(6, 'invalid zlib data');
    if ((d[1] >> 5 & 1) == +!dict)
        err(6, 'invalid zlib data: ' + (d[1] & 32 ? 'need' : 'unexpected') + ' dictionary');
    return (d[1] >> 3 & 4) + 2;
};
function StrmOpt(opts, cb) {
    if (typeof opts == 'function')
        cb = opts, opts = {};
    this.ondata = cb;
    return opts;
}
/**
 * Streaming DEFLATE compression
 */
var Deflate = /*#__PURE__*/ (function () {
    function Deflate(opts, cb) {
        if (typeof opts == 'function')
            cb = opts, opts = {};
        this.ondata = cb;
        this.o = opts || {};
        this.s = { l: 0, i: 32768, w: 32768, z: 32768 };
        // Buffer length must always be 0 mod 32768 for index calculations to be correct when modifying head and prev
        // 98304 = 32768 (lookback) + 65536 (common chunk size)
        this.b = new u8(98304);
        if (this.o.dictionary) {
            var dict = this.o.dictionary.subarray(-32768);
            this.b.set(dict, 32768 - dict.length);
            this.s.i = 32768 - dict.length;
        }
    }
    Deflate.prototype.p = function (c, f) {
        this.ondata(dopt(c, this.o, 0, 0, this.s), f);
    };
    /**
     * Pushes a chunk to be deflated
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Deflate.prototype.push = function (chunk, final) {
        if (!this.ondata)
            err(5);
        if (this.s.l)
            err(4);
        var endLen = chunk.length + this.s.z;
        if (endLen > this.b.length) {
            if (endLen > 2 * this.b.length - 32768) {
                var newBuf = new u8(endLen & -32768);
                newBuf.set(this.b.subarray(0, this.s.z));
                this.b = newBuf;
            }
            var split = this.b.length - this.s.z;
            this.b.set(chunk.subarray(0, split), this.s.z);
            this.s.z = this.b.length;
            this.p(this.b, false);
            this.b.set(this.b.subarray(-32768));
            this.b.set(chunk.subarray(split), 32768);
            this.s.z = chunk.length - split + 32768;
            this.s.i = 32766, this.s.w = 32768;
        }
        else {
            this.b.set(chunk, this.s.z);
            this.s.z += chunk.length;
        }
        this.s.l = final & 1;
        if (this.s.z > this.s.w + 8191 || final) {
            this.p(this.b, final || false);
            this.s.w = this.s.i, this.s.i -= 2;
        }
        if (final) {
            // cleanup unneeded buffers/state to reduce memory usage
            this.s = this.o = {};
            this.b = et;
        }
    };
    /**
     * Flushes buffered uncompressed data. Useful to immediately retrieve the
     * deflated output for small inputs.
     * @param sync Whether to flush to a byte boundary. A sync flush takes 4-5
     *             extra bytes, but guarantees all pushed data is immediately
     *             decompressible. A separate DEFLATE stream may be concatenated
     *             with the current output after a sync flush.
     */
    Deflate.prototype.flush = function (sync) {
        if (!this.ondata)
            err(5);
        if (this.s.l)
            err(4);
        this.p(this.b, false);
        this.s.w = this.s.i, this.s.i -= 2;
        // could technically skip writing the type-0 block for (this.s.r & 7) == 0,
        // but the deterministic trailer (00 00 FF FF) is useful in some situations
        if (sync) {
            var c = new u8(6);
            c[0] = this.s.r >> 3;
            // write empty, non-final type-0 block
            var ep = wfblk(c, this.s.r, et);
            this.s.r = 0;
            this.ondata(c.subarray(0, ep >> 3), false);
        }
    };
    return Deflate;
}());

/**
 * Asynchronous streaming DEFLATE compression
 */
var AsyncDeflate = /*#__PURE__*/ (function () {
    function AsyncDeflate(opts, cb) {
        astrmify([
            bDflt,
            function () { return [astrm, Deflate]; }
        ], this, StrmOpt.call(this, opts, cb), function (ev) {
            var strm = new Deflate(ev.data);
            onmessage = astrm(strm);
        }, 6, 1);
    }
    return AsyncDeflate;
}());

function deflate(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bDflt,
    ], function (ev) { return pbf(deflateSync(ev.data[0], ev.data[1])); }, 0, cb);
}
/**
 * Compresses data with DEFLATE without any wrapper
 * @param data The data to compress
 * @param opts The compression options
 * @returns The deflated version of the data
 */
function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
}
/**
 * Streaming DEFLATE decompression
 */
var Inflate = /*#__PURE__*/ (function () {
    function Inflate(opts, cb) {
        // no StrmOpt here to avoid adding to workerizer
        if (typeof opts == 'function')
            cb = opts, opts = {};
        this.ondata = cb;
        var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);
        this.s = { i: 0, b: dict ? dict.length : 0 };
        this.o = new u8(32768);
        this.p = new u8(0);
        if (dict)
            this.o.set(dict);
    }
    Inflate.prototype.e = function (c) {
        if (!this.ondata)
            err(5);
        if (this.d)
            err(4);
        if (!this.p.length)
            this.p = c;
        else if (c.length) {
            var n = new u8(this.p.length + c.length);
            n.set(this.p), n.set(c, this.p.length), this.p = n;
        }
    };
    Inflate.prototype.c = function (final) {
        this.s.i = +(this.d = final || false);
        var bts = this.s.b;
        var dt = inflt(this.p, this.s, this.o);
        this.ondata(slc(dt, bts, this.s.b), this.d);
        this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
        this.p = slc(this.p, (this.s.p / 8) | 0), this.s.p &= 7;
    };
    /**
     * Pushes a chunk to be inflated
     * @param chunk The chunk to push
     * @param final Whether this is the final chunk
     */
    Inflate.prototype.push = function (chunk, final) {
        this.e(chunk), this.c(final);
    };
    return Inflate;
}());

/**
 * Asynchronous streaming DEFLATE decompression
 */
var AsyncInflate = /*#__PURE__*/ (function () {
    function AsyncInflate(opts, cb) {
        astrmify([
            bInflt,
            function () { return [astrm, Inflate]; }
        ], this, StrmOpt.call(this, opts, cb), function (ev) {
            var strm = new Inflate(ev.data);
            onmessage = astrm(strm);
        }, 7, 0);
    }
    return AsyncInflate;
}());

function inflate(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bInflt
    ], function (ev) { return pbf(inflateSync(ev.data[0], gopt(ev.data[1]))); }, 1, cb);
}
function inflateSync(data, opts) {
    return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
// before you yell at me for not just using extends, my reason is that TS inheritance is hard to workerize.
/**
 * Streaming GZIP compression
 */
var Gzip = /*#__PURE__*/ (function () {
    function Gzip(opts, cb) {
        this.c = crc();
        this.l = 0;
        this.v = 1;
        Deflate.call(this, opts, cb);
    }
    /**
     * Pushes a chunk to be GZIPped
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Gzip.prototype.push = function (chunk, final) {
        this.c.p(chunk);
        this.l += chunk.length;
        Deflate.prototype.push.call(this, chunk, final);
    };
    Gzip.prototype.p = function (c, f) {
        var raw = dopt(c, this.o, this.v && gzhl(this.o), f && 8, this.s);
        if (this.v)
            gzh(raw, this.o), this.v = 0;
        if (f)
            wbytes(raw, raw.length - 8, this.c.d()), wbytes(raw, raw.length - 4, this.l);
        this.ondata(raw, f);
    };
    /**
     * Flushes buffered uncompressed data. Useful to immediately retrieve the
     * GZIPped output for small inputs.
     * @param sync Whether to flush to a byte boundary. A sync flush takes 4-5
     *             extra bytes, but guarantees all pushed data is immediately
     *             decompressible.
     */
    Gzip.prototype.flush = function (sync) {
        Deflate.prototype.flush.call(this, sync);
    };
    return Gzip;
}());

/**
 * Asynchronous streaming GZIP compression
 */
var AsyncGzip = /*#__PURE__*/ (function () {
    function AsyncGzip(opts, cb) {
        astrmify([
            bDflt,
            gze,
            function () { return [astrm, Deflate, Gzip]; }
        ], this, StrmOpt.call(this, opts, cb), function (ev) {
            var strm = new Gzip(ev.data);
            onmessage = astrm(strm);
        }, 8, 1);
    }
    return AsyncGzip;
}());

function gzip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bDflt,
        gze,
        function () { return [gzipSync]; }
    ], function (ev) { return pbf(gzipSync(ev.data[0], ev.data[1])); }, 2, cb);
}
/**
 * Compresses data with GZIP
 * @param data The data to compress
 * @param opts The compression options
 * @returns The gzipped version of the data
 */
function gzipSync(data, opts) {
    if (!opts)
        opts = {};
    var c = crc(), l = data.length;
    c.p(data);
    var d = dopt(data, opts, gzhl(opts), 8), s = d.length;
    return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
}
/**
 * Streaming single or multi-member GZIP decompression
 */
var Gunzip = /*#__PURE__*/ (function () {
    function Gunzip(opts, cb) {
        this.v = 1;
        this.r = 0;
        Inflate.call(this, opts, cb);
    }
    /**
     * Pushes a chunk to be GUNZIPped
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Gunzip.prototype.push = function (chunk, final) {
        Inflate.prototype.e.call(this, chunk);
        this.r += chunk.length;
        if (this.v) {
            var p = this.p.subarray(this.v - 1);
            var s = p.length > 3 ? gzs(p) : 4;
            if (s > p.length) {
                if (!final)
                    return;
            }
            else if (this.v > 1 && this.onmember) {
                this.onmember(this.r - p.length);
            }
            this.p = p.subarray(s), this.v = 0;
        }
        // necessary to prevent TS from using the closure value
        // This allows for workerization to function correctly
        Inflate.prototype.c.call(this, 0);
        // process concatenated GZIP
        if (this.s.f && !this.s.l) {
            this.v = shft(this.s.p) + 9;
            this.s = { i: 0 };
            this.o = new u8(0);
            this.push(new u8(0), final);
        }
        else if (final) {
            Inflate.prototype.c.call(this, final);
        }
    };
    return Gunzip;
}());

/**
 * Asynchronous streaming single or multi-member GZIP decompression
 */
var AsyncGunzip = /*#__PURE__*/ (function () {
    function AsyncGunzip(opts, cb) {
        var _this = this;
        astrmify([
            bInflt,
            guze,
            function () { return [astrm, Inflate, Gunzip]; }
        ], this, StrmOpt.call(this, opts, cb), function (ev) {
            var strm = new Gunzip(ev.data);
            strm.onmember = function (offset) { return postMessage(offset); };
            onmessage = astrm(strm);
        }, 9, 0, function (offset) { return _this.onmember && _this.onmember(offset); });
    }
    return AsyncGunzip;
}());

function gunzip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bInflt,
        guze,
        function () { return [gunzipSync]; }
    ], function (ev) { return pbf(gunzipSync(ev.data[0], ev.data[1])); }, 3, cb);
}
function gunzipSync(data, opts) {
    var st = gzs(data);
    if (st + 8 > data.length)
        err(6, 'invalid gzip data');
    return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
/**
 * Streaming Zlib compression
 */
var Zlib = /*#__PURE__*/ (function () {
    function Zlib(opts, cb) {
        this.c = adler();
        this.v = 1;
        Deflate.call(this, opts, cb);
    }
    /**
     * Pushes a chunk to be zlibbed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Zlib.prototype.push = function (chunk, final) {
        this.c.p(chunk);
        Deflate.prototype.push.call(this, chunk, final);
    };
    Zlib.prototype.p = function (c, f) {
        var raw = dopt(c, this.o, this.v && (this.o.dictionary ? 6 : 2), f && 4, this.s);
        if (this.v)
            zlh(raw, this.o), this.v = 0;
        if (f)
            wbytes(raw, raw.length - 4, this.c.d());
        this.ondata(raw, f);
    };
    /**
     * Flushes buffered uncompressed data. Useful to immediately retrieve the
     * zlibbed output for small inputs.
     * @param sync Whether to flush to a byte boundary. A sync flush takes 4-5
     *             extra bytes, but guarantees all pushed data is immediately
     *             decompressible.
     */
    Zlib.prototype.flush = function (sync) {
        Deflate.prototype.flush.call(this, sync);
    };
    return Zlib;
}());

/**
 * Asynchronous streaming Zlib compression
 */
var AsyncZlib = /*#__PURE__*/ (function () {
    function AsyncZlib(opts, cb) {
        astrmify([
            bDflt,
            zle,
            function () { return [astrm, Deflate, Zlib]; }
        ], this, StrmOpt.call(this, opts, cb), function (ev) {
            var strm = new Zlib(ev.data);
            onmessage = astrm(strm);
        }, 10, 1);
    }
    return AsyncZlib;
}());

function zlib(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bDflt,
        zle,
        function () { return [zlibSync]; }
    ], function (ev) { return pbf(zlibSync(ev.data[0], ev.data[1])); }, 4, cb);
}
/**
 * Compress data with Zlib
 * @param data The data to compress
 * @param opts The compression options
 * @returns The zlib-compressed version of the data
 */
function zlibSync(data, opts) {
    if (!opts)
        opts = {};
    var a = adler();
    a.p(data);
    var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
    return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
}
/**
 * Streaming Zlib decompression
 */
var Unzlib = /*#__PURE__*/ (function () {
    function Unzlib(opts, cb) {
        Inflate.call(this, opts, cb);
        this.v = opts && opts.dictionary ? 2 : 1;
    }
    /**
     * Pushes a chunk to be unzlibbed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Unzlib.prototype.push = function (chunk, final) {
        Inflate.prototype.e.call(this, chunk);
        if (this.v) {
            if (this.p.length < 6 && !final)
                return;
            this.p = this.p.subarray(zls(this.p, this.v - 1)), this.v = 0;
        }
        if (final) {
            if (this.p.length < 4)
                err(6, 'invalid zlib data');
            this.p = this.p.subarray(0, -4);
        }
        // necessary to prevent TS from using the closure value
        // This allows for workerization to function correctly
        Inflate.prototype.c.call(this, final);
    };
    return Unzlib;
}());

/**
 * Asynchronous streaming Zlib decompression
 */
var AsyncUnzlib = /*#__PURE__*/ (function () {
    function AsyncUnzlib(opts, cb) {
        astrmify([
            bInflt,
            zule,
            function () { return [astrm, Inflate, Unzlib]; }
        ], this, StrmOpt.call(this, opts, cb), function (ev) {
            var strm = new Unzlib(ev.data);
            onmessage = astrm(strm);
        }, 11, 0);
    }
    return AsyncUnzlib;
}());

function unzlib(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return cbify(data, opts, [
        bInflt,
        zule,
        function () { return [unzlibSync]; }
    ], function (ev) { return pbf(unzlibSync(ev.data[0], gopt(ev.data[1]))); }, 5, cb);
}
function unzlibSync(data, opts) {
    return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
// Default algorithm for compression (used because having a known output size allows faster decompression)


/**
 * Streaming GZIP, Zlib, or raw DEFLATE decompression
 */
var Decompress = /*#__PURE__*/ (function () {
    function Decompress(opts, cb) {
        this.o = StrmOpt.call(this, opts, cb) || {};
        this.G = Gunzip;
        this.I = Inflate;
        this.Z = Unzlib;
    }
    // init substream
    // overriden by AsyncDecompress
    Decompress.prototype.i = function () {
        var _this = this;
        this.s.ondata = function (dat, final) {
            _this.ondata(dat, final);
        };
    };
    /**
     * Pushes a chunk to be decompressed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Decompress.prototype.push = function (chunk, final) {
        if (!this.ondata)
            err(5);
        if (!this.s) {
            if (this.p && this.p.length) {
                var n = new u8(this.p.length + chunk.length);
                n.set(this.p), n.set(chunk, this.p.length);
            }
            else
                this.p = chunk;
            if (this.p.length > 2) {
                this.s = (this.p[0] == 31 && this.p[1] == 139 && this.p[2] == 8)
                    ? new this.G(this.o)
                    : ((this.p[0] & 15) != 8 || (this.p[0] >> 4) > 7 || ((this.p[0] << 8 | this.p[1]) % 31))
                        ? new this.I(this.o)
                        : new this.Z(this.o);
                this.i();
                this.s.push(this.p, final);
                this.p = null;
            }
        }
        else
            this.s.push(chunk, final);
    };
    return Decompress;
}());

/**
 * Asynchronous streaming GZIP, Zlib, or raw DEFLATE decompression
 */
var AsyncDecompress = /*#__PURE__*/ (function () {
    function AsyncDecompress(opts, cb) {
        Decompress.call(this, opts, cb);
        this.queuedSize = 0;
        this.G = AsyncGunzip;
        this.I = AsyncInflate;
        this.Z = AsyncUnzlib;
    }
    AsyncDecompress.prototype.i = function () {
        var _this = this;
        this.s.ondata = function (err, dat, final) {
            _this.ondata(err, dat, final);
        };
        this.s.ondrain = function (size) {
            _this.queuedSize -= size;
            if (_this.ondrain)
                _this.ondrain(size);
        };
    };
    /**
     * Pushes a chunk to be decompressed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    AsyncDecompress.prototype.push = function (chunk, final) {
        this.queuedSize += chunk.length;
        Decompress.prototype.push.call(this, chunk, final);
    };
    return AsyncDecompress;
}());

function decompress(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    return (data[0] == 31 && data[1] == 139 && data[2] == 8)
        ? gunzip(data, opts, cb)
        : ((data[0] & 15) != 8 || (data[0] >> 4) > 7 || ((data[0] << 8 | data[1]) % 31))
            ? inflate(data, opts, cb)
            : unzlib(data, opts, cb);
}
/**
 * Expands compressed GZIP, Zlib, or raw DEFLATE data, automatically detecting the format
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
function decompressSync(data, opts) {
    return (data[0] == 31 && data[1] == 139 && data[2] == 8)
        ? gunzipSync(data, opts)
        : ((data[0] & 15) != 8 || (data[0] >> 4) > 7 || ((data[0] << 8 | data[1]) % 31))
            ? inflateSync(data, opts)
            : unzlibSync(data, opts);
}
// flatten a directory structure
var fltn = function (d, p, t, o) {
    for (var k in d) {
        var val = d[k], n = p + k, op = o;
        if (Array.isArray(val))
            op = mrg(o, val[1]), val = val[0];
        if (ArrayBuffer.isView(val))
            t[n] = [val, op];
        else {
            t[n += '/'] = [new u8(0), op];
            fltn(val, n, t, o);
        }
    }
};
// text encoder
var te = typeof TextEncoder != 'undefined' && /*#__PURE__*/ new TextEncoder();
// text decoder
var td = typeof TextDecoder != 'undefined' && /*#__PURE__*/ new TextDecoder();
// text decoder stream
var tds = 0;
try {
    td.decode(et, { stream: true });
    tds = 1;
}
catch (e) { }
// decode UTF8
var dutf8 = function (d) {
    for (var r = '', i = 0;;) {
        var c = d[i++];
        var eb = (c > 127) + (c > 223) + (c > 239);
        if (i + eb > d.length)
            return { s: r, r: slc(d, i - 1) };
        if (!eb)
            r += String.fromCharCode(c);
        else if (eb == 3) {
            c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | (d[i++] & 63)) - 65536,
                r += String.fromCharCode(55296 | (c >> 10), 56320 | (c & 1023));
        }
        else if (eb & 1)
            r += String.fromCharCode((c & 31) << 6 | (d[i++] & 63));
        else
            r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | (d[i++] & 63));
    }
};
/**
 * Streaming UTF-8 decoding
 */
var DecodeUTF8 = /*#__PURE__*/ (function () {
    /**
     * Creates a UTF-8 decoding stream
     * @param cb The callback to call whenever data is decoded
     */
    function DecodeUTF8(cb) {
        this.ondata = cb;
        if (tds)
            this.t = new TextDecoder();
        else
            this.p = et;
    }
    /**
     * Pushes a chunk to be decoded from UTF-8 binary
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    DecodeUTF8.prototype.push = function (chunk, final) {
        if (!this.ondata)
            err(5);
        final = !!final;
        if (this.t) {
            this.ondata(this.t.decode(chunk, { stream: true }), final);
            if (final) {
                if (this.t.decode().length)
                    err(8);
                this.t = null;
            }
            return;
        }
        if (!this.p)
            err(4);
        var dat = new u8(this.p.length + chunk.length);
        dat.set(this.p);
        dat.set(chunk, this.p.length);
        var _a = dutf8(dat), s = _a.s, r = _a.r;
        if (final) {
            if (r.length)
                err(8);
            this.p = null;
        }
        else
            this.p = r;
        this.ondata(s, final);
    };
    return DecodeUTF8;
}());

/**
 * Streaming UTF-8 encoding
 */
var EncodeUTF8 = /*#__PURE__*/ (function () {
    /**
     * Creates a UTF-8 decoding stream
     * @param cb The callback to call whenever data is encoded
     */
    function EncodeUTF8(cb) {
        this.ondata = cb;
    }
    /**
     * Pushes a chunk to be encoded to UTF-8
     * @param chunk The string data to push
     * @param final Whether this is the last chunk
     */
    EncodeUTF8.prototype.push = function (chunk, final) {
        if (!this.ondata)
            err(5);
        if (this.d)
            err(4);
        this.ondata(strToU8(chunk), this.d = final || false);
    };
    return EncodeUTF8;
}());

/**
 * Converts a string into a Uint8Array for use with compression/decompression methods
 * @param str The string to encode
 * @param latin1 Whether or not to interpret the data as Latin-1. This should
 *               not need to be true unless decoding a binary string.
 * @returns The string encoded in UTF-8/Latin-1 binary
 */
function strToU8(str, latin1) {
    if (latin1) {
        var ar_1 = new u8(str.length);
        for (var i = 0; i < str.length; ++i)
            ar_1[i] = str.charCodeAt(i);
        return ar_1;
    }
    if (te)
        return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function (v) { ar[ai++] = v; };
    for (var i = 0; i < l; ++i) {
        if (ai + 5 > ar.length) {
            var n = new u8(ai + 8 + ((l - i) << 1));
            n.set(ar);
            ar = n;
        }
        var c = str.charCodeAt(i);
        if (c < 128 || latin1)
            w(c);
        else if (c < 2048)
            w(192 | (c >> 6)), w(128 | (c & 63));
        else if (c > 55295 && c < 57344)
            c = 65536 + (c & 1023 << 10) | (str.charCodeAt(++i) & 1023),
                w(240 | (c >> 18)), w(128 | ((c >> 12) & 63)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));
        else
            w(224 | (c >> 12)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));
    }
    return slc(ar, 0, ai);
}
/**
 * Converts a Uint8Array to a string
 * @param dat The data to decode to string
 * @param latin1 Whether or not to interpret the data as Latin-1. This should
 *               not need to be true unless encoding to binary string.
 * @returns The original UTF-8/Latin-1 string
 */
function strFromU8(dat, latin1) {
    if (latin1) {
        var r = '';
        for (var i = 0; i < dat.length; i += 16384)
            r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
        return r;
    }
    else if (td) {
        return td.decode(dat);
    }
    else {
        var _a = dutf8(dat), s = _a.s, r = _a.r;
        if (r.length)
            err(8);
        return s;
    }
}
;
// deflate bit flag
var dbf = function (l) { return l == 1 ? 3 : l < 6 ? 2 : l == 9 ? 1 : 0; };
// skip local zip header
var slzh = function (d, b) { return b + 30 + b2(d, b + 26) + b2(d, b + 28); };
// read zip header
var zh = function (d, b, z) {
    var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
    var _a = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a[0], su = _a[1], off = _a[2];
    return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
// read zip64 header sizes
var z64hs = function (d, b, l, z, sc, su, off) {
    var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
    var nf = nsc + nsu + noff;
    if (z && nf) {
        for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
            if (b2(d, b) == 1) {
                return [
                    nsc ? b8(d, b + 4 + 8 * nsu) : sc,
                    nsu ? b8(d, b + 4) : su,
                    noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
                    1
                ];
            }
        }
        // z == 2 for unknown whether or not zip64
        if (z < 2)
            err(13);
    }
    return [sc, su, off, 0];
};
// extra field length
var exfl = function (ex) {
    var le = 0;
    if (ex) {
        for (var k in ex) {
            var l = ex[k].length;
            if (l > 65535)
                err(9);
            le += l + 4;
        }
    }
    return le;
};
// write zip header
var wzh = function (d, b, f, fn, u, c, ce, co) {
    var fl = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 0x2014B50 : 0x4034B50), b += 4;
    if (ce != null)
        d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2; // spec compliance? what's that?
    d[b++] = (f.flag << 1) | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
        err(10);
    wbytes(d, b, (y << 25) | ((dt.getMonth() + 1) << 21) | (dt.getDate() << 16) | (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1)), b += 4;
    if (c != -1) {
        wbytes(d, b, f.crc);
        wbytes(d, b + 4, c < 0 ? -c - 2 : c);
        wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
        wbytes(d, b, col);
        wbytes(d, b + 6, f.attrs);
        wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl;
    if (exl) {
        for (var k in ex) {
            var exf = ex[k], l = exf.length;
            wbytes(d, b, +k);
            wbytes(d, b + 2, l);
            d.set(exf, b + 4), b += 4 + l;
        }
    }
    if (col)
        d.set(co, b), b += col;
    return b;
};
// write zip footer (end of central directory)
var wzf = function (o, b, c, d, e) {
    wbytes(o, b, 0x6054B50); // skip disk
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
};
/**
 * A pass-through stream to keep data uncompressed in a ZIP archive.
 */
var ZipPassThrough = /*#__PURE__*/ (function () {
    /**
     * Creates a pass-through stream that can be added to ZIP archives
     * @param filename The filename to associate with this data stream
     */
    function ZipPassThrough(filename) {
        this.filename = filename;
        this.c = crc();
        this.size = 0;
        this.compression = 0;
    }
    /**
     * Processes a chunk and pushes to the output stream. You can override this
     * method in a subclass for custom behavior, but by default this passes
     * the data through. You must call this.ondata(err, chunk, final) at some
     * point in this method.
     * @param chunk The chunk to process
     * @param final Whether this is the last chunk
     */
    ZipPassThrough.prototype.process = function (chunk, final) {
        this.ondata(null, chunk, final);
    };
    /**
     * Pushes a chunk to be added. If you are subclassing this with a custom
     * compression algorithm, note that you must push data from the source
     * file only, pre-compression.
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    ZipPassThrough.prototype.push = function (chunk, final) {
        if (!this.ondata)
            err(5);
        this.c.p(chunk);
        this.size += chunk.length;
        if (final)
            this.crc = this.c.d();
        // we shouldn't really do this cast, but properly handling ArrayBufferLike
        // makes the API unergonomic with Buffer
        this.process(chunk, final || false);
    };
    return ZipPassThrough;
}());

// I don't extend because TypeScript extension adds 1kB of runtime bloat
/**
 * Streaming DEFLATE compression for ZIP archives. Prefer using AsyncZipDeflate
 * for better performance
 */
var ZipDeflate = /*#__PURE__*/ (function () {
    /**
     * Creates a DEFLATE stream that can be added to ZIP archives
     * @param filename The filename to associate with this data stream
     * @param opts The compression options
     */
    function ZipDeflate(filename, opts) {
        var _this = this;
        if (!opts)
            opts = {};
        ZipPassThrough.call(this, filename);
        this.d = new Deflate(opts, function (dat, final) {
            _this.ondata(null, dat, final);
        });
        this.compression = 8;
        this.flag = dbf(opts.level);
    }
    ZipDeflate.prototype.process = function (chunk, final) {
        try {
            this.d.push(chunk, final);
        }
        catch (e) {
            this.ondata(e, null, final);
        }
    };
    /**
     * Pushes a chunk to be deflated
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    ZipDeflate.prototype.push = function (chunk, final) {
        ZipPassThrough.prototype.push.call(this, chunk, final);
    };
    return ZipDeflate;
}());

/**
 * Asynchronous streaming DEFLATE compression for ZIP archives
 */
var AsyncZipDeflate = /*#__PURE__*/ (function () {
    /**
     * Creates an asynchronous DEFLATE stream that can be added to ZIP archives
     * @param filename The filename to associate with this data stream
     * @param opts The compression options
     */
    function AsyncZipDeflate(filename, opts) {
        var _this = this;
        if (!opts)
            opts = {};
        ZipPassThrough.call(this, filename);
        this.d = new AsyncDeflate(opts, function (err, dat, final) {
            _this.ondata(err, dat, final);
        });
        this.compression = 8;
        this.flag = dbf(opts.level);
        this.terminate = this.d.terminate;
    }
    AsyncZipDeflate.prototype.process = function (chunk, final) {
        this.d.push(chunk, final);
    };
    /**
     * Pushes a chunk to be deflated
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    AsyncZipDeflate.prototype.push = function (chunk, final) {
        ZipPassThrough.prototype.push.call(this, chunk, final);
    };
    return AsyncZipDeflate;
}());

// TODO: Better tree shaking
/**
 * A zippable archive to which files can incrementally be added
 */
var Zip = /*#__PURE__*/ (function () {
    /**
     * Creates an empty ZIP archive to which files can be added
     * @param cb The callback to call whenever data for the generated ZIP archive
     *           is available
     */
    function Zip(cb) {
        this.ondata = cb;
        this.u = [];
        this.d = 1;
    }
    /**
     * Adds a file to the ZIP archive
     * @param file The file stream to add
     */
    Zip.prototype.add = function (file) {
        var _this = this;
        if (!this.ondata)
            err(5);
        // finishing or finished
        if (this.d & 2)
            this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);
        else {
            var f = strToU8(file.filename), fl_1 = f.length;
            var com = file.comment, o = com && strToU8(com);
            var u = fl_1 != file.filename.length || (o && (com.length != o.length));
            var hl_1 = fl_1 + exfl(file.extra) + 30;
            if (fl_1 > 65535)
                this.ondata(err(11, 0, 1), null, false);
            var header = new u8(hl_1);
            wzh(header, 0, file, f, u, -1);
            var chks_1 = [header];
            var pAll_1 = function () {
                for (var _i = 0, chks_2 = chks_1; _i < chks_2.length; _i++) {
                    var chk = chks_2[_i];
                    _this.ondata(null, chk, false);
                }
                chks_1 = [];
            };
            var tr_1 = this.d;
            this.d = 0;
            var ind_1 = this.u.length;
            var uf_1 = mrg(file, {
                f: f,
                u: u,
                o: o,
                t: function () {
                    if (file.terminate)
                        file.terminate();
                },
                r: function () {
                    pAll_1();
                    if (tr_1) {
                        var nxt = _this.u[ind_1 + 1];
                        if (nxt)
                            nxt.r();
                        else
                            _this.d = 1;
                    }
                    tr_1 = 1;
                }
            });
            var cl_1 = 0;
            file.ondata = function (err, dat, final) {
                if (err) {
                    _this.ondata(err, dat, final);
                    _this.terminate();
                }
                else {
                    cl_1 += dat.length;
                    chks_1.push(dat);
                    if (final) {
                        var dd = new u8(16);
                        wbytes(dd, 0, 0x8074B50);
                        wbytes(dd, 4, file.crc);
                        wbytes(dd, 8, cl_1);
                        wbytes(dd, 12, file.size);
                        chks_1.push(dd);
                        uf_1.c = cl_1, uf_1.b = hl_1 + cl_1 + 16, uf_1.crc = file.crc, uf_1.size = file.size;
                        if (tr_1)
                            uf_1.r();
                        tr_1 = 1;
                    }
                    else if (tr_1)
                        pAll_1();
                }
            };
            this.u.push(uf_1);
        }
    };
    /**
     * Ends the process of adding files and prepares to emit the final chunks.
     * This *must* be called after adding all desired files for the resulting
     * ZIP file to work properly.
     */
    Zip.prototype.end = function () {
        var _this = this;
        if (this.d & 2) {
            this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);
            return;
        }
        if (this.d)
            this.e();
        else
            this.u.push({
                r: function () {
                    if (!(_this.d & 1))
                        return;
                    _this.u.splice(-1, 1);
                    _this.e();
                },
                t: function () { }
            });
        this.d = 3;
    };
    Zip.prototype.e = function () {
        var bt = 0, l = 0, tl = 0;
        for (var _i = 0, _a = this.u; _i < _a.length; _i++) {
            var f = _a[_i];
            tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);
        }
        var out = new u8(tl + 22);
        for (var _b = 0, _c = this.u; _b < _c.length; _b++) {
            var f = _c[_b];
            wzh(out, bt, f, f.f, f.u, -f.c - 2, l, f.o);
            bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;
        }
        wzf(out, bt, this.u.length, tl, l);
        this.ondata(null, out, true);
        this.d = 2;
    };
    /**
     * A method to terminate any internal workers used by the stream. Subsequent
     * calls to add() will fail.
     */
    Zip.prototype.terminate = function () {
        for (var _i = 0, _a = this.u; _i < _a.length; _i++) {
            var f = _a[_i];
            f.t();
        }
        this.d = 2;
    };
    return Zip;
}());

function zip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    var r = {};
    fltn(data, '', r, opts);
    var k = Object.keys(r);
    var lft = k.length, o = 0, tot = 0;
    var slft = lft, files = new Array(lft);
    var term = [];
    var tAll = function () {
        for (var i = 0; i < term.length; ++i)
            term[i]();
    };
    var cbd = function (a, b) {
        mt(function () { cb(a, b); });
    };
    mt(function () { cbd = cb; });
    var cbf = function () {
        var out = new u8(tot + 22), oe = o, cdl = tot - o;
        tot = 0;
        for (var i = 0; i < slft; ++i) {
            var f = files[i];
            try {
                var l = f.c.length;
                wzh(out, tot, f, f.f, f.u, l);
                var badd = 30 + f.f.length + exfl(f.extra);
                var loc = tot + badd;
                out.set(f.c, loc);
                wzh(out, o, f, f.f, f.u, l, tot, f.m), o += 16 + badd + (f.m ? f.m.length : 0), tot = loc + l;
            }
            catch (e) {
                return cbd(e, null);
            }
        }
        wzf(out, o, files.length, cdl, oe);
        cbd(null, out);
    };
    if (!lft)
        cbf();
    var _loop_1 = function (i) {
        var fn = k[i];
        var _a = r[fn], file = _a[0], p = _a[1];
        var c = crc(), size = file.length;
        c.p(file);
        var f = strToU8(fn), s = f.length;
        var com = p.comment, m = com && strToU8(com), ms = m && m.length;
        var exl = exfl(p.extra);
        var compression = p.level == 0 ? 0 : 8;
        var cbl = function (e, d) {
            if (e) {
                tAll();
                cbd(e, null);
            }
            else {
                var l = d.length;
                files[i] = mrg(p, {
                    size: size,
                    crc: c.d(),
                    c: d,
                    f: f,
                    m: m,
                    u: s != fn.length || (m && (com.length != ms)),
                    compression: compression
                });
                o += 30 + s + exl + l;
                tot += 76 + 2 * (s + exl) + (ms || 0) + l;
                if (!--lft)
                    cbf();
            }
        };
        if (s > 65535)
            cbl(err(11, 0, 1), null);
        if (!compression)
            cbl(null, file);
        else if (size < 160000) {
            try {
                cbl(null, deflateSync(file, p));
            }
            catch (e) {
                cbl(e, null);
            }
        }
        else
            term.push(deflate(file, p, cbl));
    };
    // Cannot use lft because it can decrease
    for (var i = 0; i < slft; ++i) {
        _loop_1(i);
    }
    return tAll;
}
/**
 * Synchronously creates a ZIP file. Prefer using `zip` for better performance
 * with more than one file.
 * @param data The directory structure for the ZIP archive
 * @param opts The main options, merged with per-file options
 * @returns The generated ZIP archive
 */
function zipSync(data, opts) {
    if (!opts)
        opts = {};
    var r = {};
    var files = [];
    fltn(data, '', r, opts);
    var o = 0;
    var tot = 0;
    for (var fn in r) {
        var _a = r[fn], file = _a[0], p = _a[1];
        var compression = p.level == 0 ? 0 : 8;
        var f = strToU8(fn), s = f.length;
        var com = p.comment, m = com && strToU8(com), ms = m && m.length;
        var exl = exfl(p.extra);
        if (s > 65535)
            err(11);
        var d = compression ? deflateSync(file, p) : file, l = d.length;
        var c = crc();
        c.p(file);
        files.push(mrg(p, {
            size: file.length,
            crc: c.d(),
            c: d,
            f: f,
            m: m,
            u: s != fn.length || (m && (com.length != ms)),
            o: o,
            compression: compression
        }));
        o += 30 + s + exl + l;
        tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (var i = 0; i < files.length; ++i) {
        var f = files[i];
        wzh(out, f.o, f, f.f, f.u, f.c.length);
        var badd = 30 + f.f.length + exfl(f.extra);
        out.set(f.c, f.o + badd);
        wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
}
/**
 * Streaming pass-through decompression for ZIP archives
 */
var UnzipPassThrough = /*#__PURE__*/ (function () {
    function UnzipPassThrough() {
    }
    UnzipPassThrough.prototype.push = function (chunk, final) {
        // same as ZipPassThrough: cast to retain Buffer ergonomics
        this.ondata(null, chunk, final);
    };
    UnzipPassThrough.compression = 0;
    return UnzipPassThrough;
}());

/**
 * Streaming DEFLATE decompression for ZIP archives. Prefer AsyncZipInflate for
 * better performance.
 */
var UnzipInflate = /*#__PURE__*/ (function () {
    /**
     * Creates a DEFLATE decompression that can be used in ZIP archives
     */
    function UnzipInflate() {
        var _this = this;
        this.i = new Inflate(function (dat, final) {
            _this.ondata(null, dat, final);
        });
    }
    UnzipInflate.prototype.push = function (chunk, final) {
        try {
            this.i.push(chunk, final);
        }
        catch (e) {
            this.ondata(e, null, final);
        }
    };
    UnzipInflate.compression = 8;
    return UnzipInflate;
}());

/**
 * Asynchronous streaming DEFLATE decompression for ZIP archives
 */
var AsyncUnzipInflate = /*#__PURE__*/ (function () {
    /**
     * Creates a DEFLATE decompression that can be used in ZIP archives
     */
    function AsyncUnzipInflate(_, sz) {
        var _this = this;
        if (sz < 320000) {
            this.i = new Inflate(function (dat, final) {
                _this.ondata(null, dat, final);
            });
        }
        else {
            this.i = new AsyncInflate(function (err, dat, final) {
                _this.ondata(err, dat, final);
            });
            this.terminate = this.i.terminate;
        }
    }
    AsyncUnzipInflate.prototype.push = function (chunk, final) {
        if (this.i.terminate)
            chunk = slc(chunk, 0);
        this.i.push(chunk, final);
    };
    AsyncUnzipInflate.compression = 8;
    return AsyncUnzipInflate;
}());

/**
 * A ZIP archive decompression stream that emits files as they are discovered
 */
var Unzip = /*#__PURE__*/ (function () {
    /**
     * Creates a ZIP decompression stream
     * @param cb The callback to call whenever a file in the ZIP archive is found
     */
    function Unzip(cb) {
        this.onfile = cb;
        this.k = [];
        this.o = {
            0: UnzipPassThrough
        };
        this.p = et;
    }
    /**
     * Pushes a chunk to be unzipped
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Unzip.prototype.push = function (chunk, final) {
        var _this = this;
        if (!this.onfile)
            err(5);
        if (!this.p)
            err(4);
        if (this.c > 0) {
            var len = Math.min(this.c, chunk.length);
            var toAdd = chunk.subarray(0, len);
            this.c -= len;
            if (this.d)
                this.d.push(toAdd, !this.c);
            else
                this.k[0].push(toAdd);
            chunk = chunk.subarray(len);
            if (chunk.length)
                return this.push(chunk, final);
        }
        else {
            var f = 0, i = 0, is = void 0, buf = void 0;
            if (!this.p.length)
                buf = chunk;
            else if (!chunk.length)
                buf = this.p;
            else {
                buf = new u8(this.p.length + chunk.length);
                buf.set(this.p), buf.set(chunk, this.p.length);
            }
            var l = buf.length, oc = this.c, add = oc && this.d;
            var _loop_2 = function () {
                var sig = b4(buf, i);
                if (sig == 0x4034B50) {
                    f = 1, is = i;
                    this_1.d = null;
                    this_1.c = 0;
                    var bf = b2(buf, i + 6), cmp_1 = b2(buf, i + 8), u = bf & 2048, dd = bf & 8, fnl = b2(buf, i + 26), es = b2(buf, i + 28);
                    if (l > i + 30 + fnl + es) {
                        var chks_3 = [];
                        this_1.k.unshift(chks_3);
                        f = 2;
                        var lsc = b4(buf, i + 18), lsu = b4(buf, i + 22);
                        var fn_1 = strFromU8(buf.subarray(i + 30, i += 30 + fnl), !u);
                        var _a = z64hs(buf, i, es, 2, lsc, lsu, 0), sc_1 = _a[0], su_1 = _a[1], z64 = _a[3];
                        if (dd)
                            sc_1 = -1 - z64;
                        i += es;
                        this_1.c = sc_1;
                        var d_1;
                        var file_1 = {
                            name: fn_1,
                            compression: cmp_1,
                            start: function () {
                                if (!file_1.ondata)
                                    err(5);
                                if (!sc_1)
                                    file_1.ondata(null, et, true);
                                else {
                                    var ctr = _this.o[cmp_1];
                                    if (!ctr)
                                        file_1.ondata(err(14, 'unknown compression type ' + cmp_1, 1), null, false);
                                    d_1 = sc_1 < 0 ? new ctr(fn_1) : new ctr(fn_1, sc_1, su_1);
                                    d_1.ondata = function (err, dat, final) { file_1.ondata(err, dat, final); };
                                    for (var _i = 0, chks_4 = chks_3; _i < chks_4.length; _i++) {
                                        var dat = chks_4[_i];
                                        d_1.push(dat, false);
                                    }
                                    if (_this.k[0] == chks_3 && _this.c)
                                        _this.d = d_1;
                                    else
                                        d_1.push(et, true);
                                }
                            },
                            terminate: function () {
                                if (d_1 && d_1.terminate)
                                    d_1.terminate();
                            }
                        };
                        if (sc_1 >= 0)
                            file_1.size = sc_1, file_1.originalSize = su_1;
                        this_1.onfile(file_1);
                    }
                    return "break";
                }
                else if (oc) {
                    if (sig == 0x8074B50) {
                        is = i += 12 + (oc == -2 && 8), f = 3, this_1.c = 0;
                        return "break";
                    }
                    else if (sig == 0x2014B50) {
                        is = i -= 4, f = 3, this_1.c = 0;
                        return "break";
                    }
                }
            };
            var this_1 = this;
            for (; i < l - 4; ++i) {
                var state_1 = _loop_2();
                if (state_1 === "break")
                    break;
            }
            this.p = et;
            if (oc < 0) {
                var dat = f ? buf.subarray(0, is - 12 - (oc == -2 && 8) - (b4(buf, is - 16) == 0x8074B50 && 4)) : buf.subarray(0, i);
                if (add)
                    add.push(dat, !!f);
                else
                    this.k[+(f == 2)].push(dat);
            }
            if (f & 2)
                return this.push(buf.subarray(i), final);
            this.p = buf.subarray(i);
        }
        if (final) {
            if (this.c)
                err(13);
            this.p = null;
        }
    };
    /**
     * Registers a decoder with the stream, allowing for files compressed with
     * the compression type provided to be expanded correctly
     * @param decoder The decoder constructor
     */
    Unzip.prototype.register = function (decoder) {
        this.o[decoder.compression] = decoder;
    };
    return Unzip;
}());

var mt = typeof queueMicrotask == 'function' ? queueMicrotask : typeof setTimeout == 'function' ? setTimeout : function (fn) { fn(); };
function unzip(data, opts, cb) {
    if (!cb)
        cb = opts, opts = {};
    if (typeof cb != 'function')
        err(7);
    var term = [];
    var tAll = function () {
        for (var i = 0; i < term.length; ++i)
            term[i]();
    };
    var files = {};
    var cbd = function (a, b) {
        mt(function () { cb(a, b); });
    };
    mt(function () { cbd = cb; });
    var e = data.length - 22;
    for (; b4(data, e) != 0x6054B50; --e) {
        if (!e || data.length - e > 65558) {
            cbd(err(13, 0, 1), null);
            return tAll;
        }
    }
    ;
    var lft = b2(data, e + 8);
    if (lft) {
        var c = lft;
        var o = b4(data, e + 16);
        var z = b4(data, e - 20) == 0x7064B50;
        if (z) {
            var ze = b4(data, e - 12);
            z = b4(data, ze) == 0x6064B50;
            if (z) {
                c = lft = b4(data, ze + 32);
                o = b4(data, ze + 48);
            }
        }
        var fltr = opts && opts.filter;
        var _loop_3 = function (i) {
            var _a = zh(data, o, z), c_1 = _a[0], sc = _a[1], su = _a[2], fn = _a[3], no = _a[4], off = _a[5], b = slzh(data, off);
            o = no;
            var cbl = function (e, d) {
                if (e) {
                    tAll();
                    cbd(e, null);
                }
                else {
                    if (d)
                        files[fn] = d;
                    if (!--lft)
                        cbd(null, files);
                }
            };
            if (!fltr || fltr({
                name: fn,
                size: sc,
                originalSize: su,
                compression: c_1
            })) {
                if (!c_1)
                    cbl(null, slc(data, b, b + sc));
                else if (c_1 == 8) {
                    var infl = data.subarray(b, b + sc);
                    // Synchronously decompress under 512KB, or barely-compressed data
                    if (su < 524288 || sc > 0.8 * su) {
                        try {
                            cbl(null, inflateSync(infl, { out: new u8(su) }));
                        }
                        catch (e) {
                            cbl(e, null);
                        }
                    }
                    else
                        term.push(inflate(infl, { size: su }, cbl));
                }
                else
                    cbl(err(14, 'unknown compression type ' + c_1, 1), null);
            }
            else
                cbl(null, null);
        };
        for (var i = 0; i < c; ++i) {
            _loop_3(i);
        }
    }
    else
        cbd(null, {});
    return tAll;
}
/**
 * Synchronously decompresses a ZIP archive. Prefer using `unzip` for better
 * performance with more than one file.
 * @param data The raw compressed ZIP file
 * @param opts The ZIP extraction options
 * @returns The decompressed files
 */
function unzipSync(data, opts) {
    var files = {};
    var e = data.length - 22;
    for (; b4(data, e) != 0x6054B50; --e) {
        if (!e || data.length - e > 65558)
            err(13);
    }
    ;
    var c = b2(data, e + 8);
    if (!c)
        return {};
    var o = b4(data, e + 16);
    var z = b4(data, e - 20) == 0x7064B50;
    if (z) {
        var ze = b4(data, e - 12);
        z = b4(data, ze) == 0x6064B50;
        if (z) {
            c = b4(data, ze + 32);
            o = b4(data, ze + 48);
        }
    }
    var fltr = opts && opts.filter;
    for (var i = 0; i < c; ++i) {
        var _a = zh(data, o, z), c_2 = _a[0], sc = _a[1], su = _a[2], fn = _a[3], no = _a[4], off = _a[5], b = slzh(data, off);
        o = no;
        if (!fltr || fltr({
            name: fn,
            size: sc,
            originalSize: su,
            compression: c_2
        })) {
            if (!c_2)
                files[fn] = slc(data, b, b + sc);
            else if (c_2 == 8)
                files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
            else
                err(14, 'unknown compression type ' + c_2);
        }
    }
    return files;
}

    // Export needed functions to self.fflate
    self.fflate = {
      zipSync: zipSync,
      unzipSync: unzipSync,
      strToU8: strToU8,
      strFromU8: strFromU8,
      deflateSync: deflateSync,
      inflateSync: inflateSync
    };
    console.log('[ScriptVault] fflate inlined successfully, functions:', Object.keys(self.fflate).length);
  } catch (e) {
    console.error('[ScriptVault] fflate inline error:', e.message, e.stack);
  }
})();
// ============================================================================
// END INLINED fflate
// ============================================================================

// Make fflate available as a variable
var fflate = self.fflate;

// ============================================================================
// Generated from src/modules/sync-providers.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const CloudSyncProviders = (() => {
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

  // src/modules/sync-providers.ts
  var sync_providers_exports = {};
  __export(sync_providers_exports, {
    CloudSyncProviders: () => CloudSyncProviders
  });
  module.exports = __toCommonJS(sync_providers_exports);
  async function getSettings() {
    return SettingsManager.get();
  }
  function getRequiredWebDavBaseUrl(settings) {
    const baseUrl = settings.webdavUrl?.trim();
    if (!baseUrl) throw new Error("WebDAV URL is required");
    return baseUrl.replace(/\/$/, "");
  }
  function getWebDavAuthHeader(settings) {
    const credentials = `${settings.webdavUsername}:${settings.webdavPassword}`;
    const bytes = new TextEncoder().encode(credentials);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return `Basic ${btoa(binary)}`;
  }
  function generateOAuthState() {
    return Array.from(
      crypto.getRandomValues(new Uint8Array(16)),
      (b) => b.toString(16).padStart(2, "0")
    ).join("");
  }
  function hasStoredSyncValue(value) {
    if (typeof value === "string") return value.trim().length > 0;
    return value != null && value !== false;
  }
  function syncStorageDisclosure(settings, config) {
    const settingsRecord = settings ?? {};
    const fields = config.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type ?? "metadata",
      present: hasStoredSyncValue(settingsRecord[field.key])
    }));
    return {
      storage: "chrome.storage.local",
      protection: "Extension-scoped browser storage; ScriptVault does not add a second encryption layer.",
      fields,
      hasStoredSecrets: fields.some((field) => field.present && field.type !== "metadata"),
      revokeAction: config.revokeAction,
      notes: config.notes ?? ""
    };
  }
  async function _oauthFetchWithTimeout(url, init, providerLabel, timeoutMs = 15e3) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      const name = e && typeof e === "object" && "name" in e ? String(e.name) : "";
      const message = e instanceof Error ? e.message : String(e);
      if (name === "AbortError" || /aborted|timed?\s*out/i.test(message)) {
        console.warn(`[CloudSync] ${providerLabel} token refresh timed out after ${timeoutMs}ms`);
        return null;
      }
      console.warn(`[CloudSync] ${providerLabel} token refresh network error:`, message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  async function fetchWithTimeout(url, options = {}, timeoutMs = 3e4) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
  var webdav = {
    name: "WebDAV",
    icon: "\u2601\uFE0F",
    requiresAuth: true,
    supportsManualSync: true,
    supportsDryRun: true,
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "webdavUrl", label: "WebDAV endpoint URL", type: "metadata" },
          { key: "webdavUsername", label: "WebDAV username", type: "credential" },
          { key: "webdavPassword", label: "WebDAV password", type: "credential" }
        ],
        revokeAction: "Clear the saved WebDAV endpoint, username, and password from local extension storage.",
        notes: "WebDAV Basic credentials are sent only to the configured server during sync."
      });
    },
    async upload(data, settings) {
      const url = `${getRequiredWebDavBaseUrl(settings)}/scriptvault-backup.json`;
      const auth = getWebDavAuthHeader(settings);
      const response = await fetchWithTimeout(url, {
        method: "PUT",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }, 6e4);
      if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const url = `${getRequiredWebDavBaseUrl(settings)}/scriptvault-backup.json`;
      const auth = getWebDavAuthHeader(settings);
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: { "Authorization": auth }
      }, 6e4);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`WebDAV download failed: HTTP ${response.status}`);
      return await response.json();
    },
    async test(settings) {
      try {
        const url = getRequiredWebDavBaseUrl(settings);
        const auth = getWebDavAuthHeader(settings);
        const response = await fetchWithTimeout(url, {
          method: "PROPFIND",
          headers: { "Authorization": auth, "Depth": "0" }
        }, 15e3);
        return { success: response.ok || response.status === 207 };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      if (!settings.webdavUrl) {
        return {
          connected: false,
          status: "missing_config",
          error: "WebDAV URL is not configured"
        };
      }
      const result = await this.test(settings);
      let endpointHost = "";
      try {
        endpointHost = new URL(settings.webdavUrl).host;
      } catch {
      }
      return {
        connected: result.success === true,
        status: result.success === true ? "ok" : "error",
        error: result.error ?? null,
        user: {
          email: "",
          name: settings.webdavUsername || endpointHost || "WebDAV"
        },
        endpointHost
      };
    },
    async disconnect() {
      await SettingsManager.set({
        webdavUrl: "",
        webdavUsername: "",
        webdavPassword: ""
      });
      return { success: true };
    }
  };
  var googledrive = {
    name: "Google Drive",
    icon: "\u{1F4C1}",
    requiresOAuth: true,
    fileName: "scriptvault-backup.json",
    supportsManualSync: true,
    supportsDryRun: true,
    // Google OAuth client ID (public, installed-app type)
    // Users can override via settings.googleClientId
    clientId: "287129963438-mcc1mod1m5jm8vjr3icb7ensdtcfq44l.apps.googleusercontent.com",
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "googleDriveToken", label: "Google Drive access token", type: "token" },
          { key: "googleDriveRefreshToken", label: "Google Drive refresh token", type: "token" },
          { key: "googleClientId", label: "Optional Google OAuth client ID override", type: "metadata" },
          { key: "googleDriveUser", label: "Connected Google account label", type: "metadata" }
        ],
        revokeAction: "Ask Google to revoke the current access token when available, then clear Google tokens and account metadata.",
        notes: "Tokens are scoped to Drive file access and Google profile/email lookup for the configured backup file."
      });
    },
    async getToken() {
      const settings = await getSettings();
      return settings.googleDriveToken || null;
    },
    async refreshToken(settings) {
      const currentSettings = settings ?? await getSettings();
      const refreshTok = currentSettings.googleDriveRefreshToken;
      if (!refreshTok) return null;
      const clientId = currentSettings.googleClientId || this.clientId;
      const resp = await _oauthFetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: refreshTok
        })
      }, "Google");
      if (!resp) return null;
      if (!resp.ok) {
        console.warn("[CloudSync] Google token refresh failed:", resp.status);
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
        await SettingsManager.set({
          googleDriveToken: data.access_token,
          googleDriveConnected: true
        });
        if (data.refresh_token) {
          await SettingsManager.set({ googleDriveRefreshToken: data.refresh_token });
        }
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings) {
      const currentSettings = settings ?? await getSettings();
      let token = currentSettings.googleDriveToken || null;
      if (!token) {
        return await this.refreshToken(currentSettings);
      }
      try {
        const test = await _oauthFetchWithTimeout("https://www.googleapis.com/drive/v3/about?fields=user", {
          headers: { "Authorization": `Bearer ${token}` }
        }, "Google Drive", 1e4);
        if (!test) return token;
        if (test.ok) return token;
        if (test.status === 401 || test.status === 403) {
          return await this.refreshToken(currentSettings);
        }
        return token;
      } catch (_e) {
        return token;
      }
    },
    async connect() {
      try {
        const settings = await getSettings();
        const clientId = settings.googleClientId || this.clientId;
        const redirectUri = chrome.identity.getRedirectURL();
        const scopes = [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile"
        ].join(" ");
        const codeVerifier = Array.from(
          crypto.getRandomValues(new Uint8Array(32)),
          (b) => b.toString(16).padStart(2, "0")
        ).join("");
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const state = generateOAuthState();
        const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: scopes,
          access_type: "offline",
          prompt: "consent",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state
        }).toString();
        const responseUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        });
        if (!responseUrl) throw new Error("No response from auth flow");
        const url = new URL(responseUrl);
        const returnedState = url.searchParams.get("state");
        if (returnedState !== state) {
          throw new Error("OAuth state mismatch - possible CSRF attack");
        }
        const code = url.searchParams.get("code");
        if (!code) throw new Error("No authorization code received");
        const tokenResp = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri
          })
        }, 15e3);
        if (!tokenResp.ok) {
          const err = await tokenResp.text();
          throw new Error("Token exchange failed: " + err);
        }
        const tokens = await tokenResp.json();
        const userResp = await fetchWithTimeout("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { "Authorization": `Bearer ${tokens.access_token}` }
        }, 1e4);
        const user = userResp.ok ? await userResp.json() : {};
        await SettingsManager.set({
          googleDriveToken: tokens.access_token,
          googleDriveRefreshToken: tokens.refresh_token || settings.googleDriveRefreshToken || "",
          googleDriveConnected: true,
          googleDriveUser: { email: user.email ?? "", name: user.name ?? "" }
        });
        return {
          success: true,
          user: { email: user.email ?? "", name: user.name ?? "", picture: user.picture }
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async disconnect() {
      try {
        const token = await this.getToken();
        if (token) {
          fetchWithTimeout(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {}, 1e4).catch(
            () => {
            }
          );
        }
        await SettingsManager.set({
          googleDriveToken: "",
          googleDriveRefreshToken: "",
          googleDriveConnected: false,
          googleDriveUser: null
        });
      } catch (e) {
        console.warn("[CloudSync] Google disconnect error:", e);
      }
      return { success: true };
    },
    async findFile(token) {
      const query = encodeURIComponent(`name='${this.fileName}' and trashed=false`);
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
        { headers: { "Authorization": `Bearer ${token}` } },
        15e3
      );
      if (!response.ok) throw new Error(`Failed to search files: ${response.status}`);
      const data = await response.json();
      return data.files?.[0] ?? null;
    },
    async upload(data, settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Google Drive");
      const existingFile = await this.findFile(token);
      const metadata = {
        name: this.fileName,
        mimeType: "application/json"
      };
      const boundary = "-------ScriptVault" + crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
      const body = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: application/json",
        "",
        JSON.stringify(data),
        `--${boundary}--`
      ].join("\r\n");
      const url = existingFile ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart` : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
      const response = await fetchWithTimeout(url, {
        method: existingFile ? "PATCH" : "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body
      }, 6e4);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Google Drive");
      const file = await this.findFile(token);
      if (!file) return null;
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { "Authorization": `Bearer ${token}` } },
        6e4
      );
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return await response.json();
    },
    async test(settings) {
      try {
        const token = await this.getValidToken(settings);
        if (!token) return { success: false, error: "Not authenticated" };
        const response = await fetchWithTimeout(
          "https://www.googleapis.com/drive/v3/about?fields=user",
          { headers: { "Authorization": `Bearer ${token}` } },
          15e3
        );
        return { success: response.ok };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      try {
        const s = settings ?? await getSettings();
        if (!s.googleDriveToken && !s.googleDriveRefreshToken) {
          return { connected: false };
        }
        const token = await this.getValidToken(s);
        if (!token) return { connected: false };
        const response = await fetchWithTimeout(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { "Authorization": `Bearer ${token}` } },
          1e4
        );
        if (!response.ok) return { connected: false };
        const user = await response.json();
        return { connected: true, user: { email: user.email ?? "", name: user.name ?? "" } };
      } catch (_e) {
        return { connected: false };
      }
    }
  };
  var dropbox = {
    name: "Dropbox",
    icon: "\u{1F4E6}",
    requiresOAuth: true,
    fileName: "/scriptvault-backup.json",
    supportsManualSync: true,
    supportsDryRun: true,
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "dropboxToken", label: "Dropbox access token", type: "token" },
          { key: "dropboxRefreshToken", label: "Dropbox refresh token", type: "token" },
          { key: "dropboxClientId", label: "Dropbox app key", type: "metadata" },
          { key: "dropboxUser", label: "Connected Dropbox account label", type: "metadata" }
        ],
        revokeAction: "Call Dropbox token revoke when an access token exists, then clear Dropbox tokens and account metadata.",
        notes: "Tokens are scoped by the Dropbox app key the user configured for ScriptVault backups."
      });
    },
    async connect(settings) {
      if (!settings.dropboxClientId) {
        throw new Error(
          "Dropbox App Key is required. Create one at https://www.dropbox.com/developers/apps"
        );
      }
      const clientId = settings.dropboxClientId;
      const redirectUri = chrome.identity.getRedirectURL("dropbox");
      const codeVerifier = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, "0")
      ).join("");
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const state = Array.from(
        crypto.getRandomValues(new Uint8Array(16)),
        (b) => b.toString(16).padStart(2, "0")
      ).join("");
      const authUrl = "https://www.dropbox.com/oauth2/authorize?" + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        token_access_type: "offline",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state
      }).toString();
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      if (!responseUrl) throw new Error("No response from auth flow");
      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get("state");
      if (returnedState !== state) {
        throw new Error("OAuth state mismatch - possible CSRF attack");
      }
      const code = url.searchParams.get("code");
      if (!code) throw new Error("No authorization code received");
      const tokenResp = await fetchWithTimeout("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri
        })
      }, 15e3);
      if (!tokenResp.ok) {
        const err = await tokenResp.text();
        throw new Error("Token exchange failed: " + err);
      }
      const tokens = await tokenResp.json();
      return {
        success: true,
        token: tokens.access_token,
        refreshToken: tokens.refresh_token || ""
      };
    },
    async refreshToken(settings) {
      const refreshTok = settings.dropboxRefreshToken;
      const clientId = settings.dropboxClientId;
      if (!refreshTok || !clientId) return null;
      const resp = await _oauthFetchWithTimeout("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: refreshTok
        })
      }, "Dropbox");
      if (!resp) return null;
      if (!resp.ok) {
        console.warn("[CloudSync] Dropbox token refresh failed:", resp.status);
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
        await SettingsManager.set({ dropboxToken: data.access_token });
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings) {
      if (settings.dropboxToken) {
        try {
          const test = await _oauthFetchWithTimeout(
            "https://api.dropboxapi.com/2/users/get_current_account",
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${settings.dropboxToken}` }
            },
            "Dropbox",
            1e4
          );
          if (!test) return settings.dropboxToken;
          if (test.ok) return settings.dropboxToken;
          if (test.status !== 401 && test.status !== 403) return settings.dropboxToken;
        } catch (_e) {
          return settings.dropboxToken;
        }
      }
      return await this.refreshToken(settings);
    },
    async disconnect(settings) {
      if (settings.dropboxToken) {
        try {
          await fetchWithTimeout("https://api.dropboxapi.com/2/auth/token/revoke", {
            method: "POST",
            headers: { "Authorization": `Bearer ${settings.dropboxToken}` }
          }, 1e4);
        } catch (e) {
          console.warn("[CloudSync] Dropbox revoke error:", e);
        }
      }
      await SettingsManager.set({
        dropboxToken: "",
        dropboxRefreshToken: "",
        dropboxUser: null
      });
      return { success: true };
    },
    async upload(data, settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Dropbox");
      const response = await fetchWithTimeout("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({
            path: this.fileName,
            mode: "overwrite",
            autorename: false,
            mute: true
          }),
          "Content-Type": "application/octet-stream"
        },
        body: JSON.stringify(data)
      }, 6e4);
      if (response.status === 401) throw new Error("Dropbox token expired. Please reconnect.");
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with Dropbox");
      const response = await fetchWithTimeout("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: this.fileName })
        }
      }, 6e4);
      if (response.status === 409) return null;
      if (response.status === 401) throw new Error("Dropbox token expired. Please reconnect.");
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return await response.json();
    },
    async test(settings) {
      try {
        const token = await this.getValidToken(settings);
        if (!token) return { success: false, error: "Not authenticated" };
        const response = await fetchWithTimeout(
          "https://api.dropboxapi.com/2/users/get_current_account",
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          },
          15e3
        );
        if (response.status === 401) return { success: false, error: "Token expired" };
        return { success: response.ok };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      const s = settings ?? await getSettings();
      if (!s.dropboxToken && !s.dropboxRefreshToken) return { connected: false };
      try {
        const token = await this.getValidToken(s);
        if (!token) return { connected: false };
        const response = await fetchWithTimeout(
          "https://api.dropboxapi.com/2/users/get_current_account",
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          },
          15e3
        );
        if (!response.ok) return { connected: false };
        const user = await response.json();
        return {
          connected: true,
          user: {
            email: user.email ?? "",
            name: user.name?.display_name || user.display_name || ""
          }
        };
      } catch (_e) {
        return { connected: false };
      }
    }
  };
  var onedrive = {
    name: "OneDrive",
    icon: "\u{1F4C1}",
    requiresOAuth: true,
    fileName: "scriptvault-backup.json",
    supportsManualSync: true,
    supportsDryRun: true,
    // Microsoft OAuth - users must provide their own client ID from Azure AD
    // Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "onedriveToken", label: "OneDrive access token", type: "token" },
          { key: "onedriveRefreshToken", label: "OneDrive refresh token", type: "token" },
          { key: "onedriveClientId", label: "OneDrive app client ID", type: "metadata" },
          { key: "onedriveUser", label: "Connected Microsoft account label", type: "metadata" }
        ],
        revokeAction: "Clear OneDrive tokens and account metadata from local extension storage.",
        notes: "Microsoft Graph tokens use app-folder file access and profile lookup scopes."
      });
    },
    async connect(settings) {
      const clientId = settings.onedriveClientId;
      if (!clientId) {
        throw new Error(
          "OneDrive Client ID required. Create one at https://portal.azure.com \u2192 App registrations"
        );
      }
      const redirectUri = chrome.identity.getRedirectURL("onedrive");
      const scopes = "Files.ReadWrite.AppFolder User.Read offline_access";
      const codeVerifier = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, "0")
      ).join("");
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const state = generateOAuthState();
      const authUrl = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?" + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state
      }).toString();
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      if (!responseUrl) throw new Error("No response from auth flow");
      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get("state");
      if (returnedState !== state) {
        throw new Error("OAuth state mismatch - possible CSRF attack");
      }
      const code = url.searchParams.get("code");
      if (!code) throw new Error("No authorization code received");
      const tokenResp = await fetchWithTimeout(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            scope: scopes
          })
        },
        15e3
      );
      if (!tokenResp.ok) throw new Error("Token exchange failed: " + await tokenResp.text());
      const tokens = await tokenResp.json();
      const userResp = await fetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
        headers: { "Authorization": `Bearer ${tokens.access_token}` }
      }, 1e4);
      const user = userResp.ok ? await userResp.json() : {};
      await SettingsManager.set({
        onedriveToken: tokens.access_token,
        onedriveRefreshToken: tokens.refresh_token || "",
        onedriveConnected: true,
        onedriveUser: {
          email: user.mail || user.userPrincipalName || "",
          name: user.displayName || ""
        }
      });
      return {
        success: true,
        user: {
          email: user.mail || user.userPrincipalName || "",
          name: user.displayName || ""
        }
      };
    },
    async refreshToken(settings) {
      const currentSettings = settings ?? await getSettings();
      const refreshTok = currentSettings.onedriveRefreshToken;
      const clientId = currentSettings.onedriveClientId;
      if (!refreshTok || !clientId) return null;
      const resp = await _oauthFetchWithTimeout(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: refreshTok,
            scope: "Files.ReadWrite.AppFolder User.Read offline_access"
          })
        },
        "OneDrive",
        15e3
      );
      if (!resp) return null;
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.access_token) {
        await SettingsManager.set({
          onedriveToken: data.access_token,
          onedriveRefreshToken: data.refresh_token || refreshTok,
          onedriveConnected: true
        });
        return data.access_token;
      }
      return null;
    },
    async getValidToken(settings) {
      const currentSettings = settings ?? await getSettings();
      const token = currentSettings.onedriveToken;
      if (!token) {
        return await this.refreshToken(currentSettings);
      }
      try {
        const test = await _oauthFetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        }, "OneDrive", 1e4);
        if (!test) return token;
        if (test.ok) return token;
        if (test.status === 401 || test.status === 403) {
          return await this.refreshToken(currentSettings);
        }
        return token;
      } catch (_e) {
        return token;
      }
    },
    async disconnect() {
      await SettingsManager.set({
        onedriveToken: "",
        onedriveRefreshToken: "",
        onedriveConnected: false,
        onedriveUser: null
      });
      return { success: true };
    },
    async upload(data, settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with OneDrive");
      if (!data || typeof data !== "object") throw new Error("Invalid backup data");
      const response = await fetchWithTimeout(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        },
        6e4
      );
      if (!response.ok) throw new Error("Upload failed: " + await response.text());
      return { success: true, timestamp: Date.now() };
    },
    async download(settings) {
      const token = await this.getValidToken(settings);
      if (!token) throw new Error("Not authenticated with OneDrive");
      const response = await fetchWithTimeout(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        { headers: { "Authorization": `Bearer ${token}` } },
        6e4
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Download failed: " + response.status);
      return await response.json();
    },
    async test(settings) {
      try {
        const token = await this.getValidToken(settings);
        if (!token) return { success: false, error: "Not authenticated" };
        const response = await fetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        }, 15e3);
        return { success: response.ok };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
      }
    },
    async getStatus(settings) {
      try {
        const s = settings ?? await getSettings();
        if (!s.onedriveToken && !s.onedriveRefreshToken) return { connected: false };
        const token = await this.getValidToken(s);
        if (!token) return { connected: false };
        const response = await fetchWithTimeout("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        }, 15e3);
        if (!response.ok) return { connected: false };
        const user = await response.json();
        return {
          connected: true,
          user: {
            email: user.mail || user.userPrincipalName || "",
            name: user.displayName || ""
          }
        };
      } catch (_e) {
        return { connected: false };
      }
    }
  };
  var s3 = {
    name: "S3-compatible",
    icon: "\u{1FAA3}",
    requiresAuth: true,
    supportsManualSync: true,
    supportsDryRun: true,
    getStorageDisclosure(settings = {}) {
      return syncStorageDisclosure(settings, {
        fields: [
          { key: "s3Endpoint", label: "S3 endpoint URL", type: "metadata" },
          { key: "s3Region", label: "S3 region", type: "metadata" },
          { key: "s3Bucket", label: "S3 bucket name", type: "metadata" },
          { key: "s3AccessKeyId", label: "S3 access key ID", type: "credential" },
          { key: "s3SecretKey", label: "S3 secret access key", type: "credential" },
          { key: "s3ObjectKey", label: "Optional object key override", type: "metadata" }
        ],
        revokeAction: "Clear the saved S3 endpoint, region, bucket, access key, and secret from local extension storage.",
        notes: "Credentials are HMAC-SHA256 signed per AWS SigV4 and sent only to the configured endpoint during sync. No third party sees the secret."
      });
    },
    validate(settings = {}) {
      const errors = [];
      const endpoint = (settings.s3Endpoint || "").trim();
      if (!endpoint) {
        errors.push({ field: "s3Endpoint", error: "Endpoint URL is required." });
      } else {
        try {
          const url = new URL(endpoint);
          if (url.protocol !== "https:" && url.protocol !== "http:") {
            errors.push({ field: "s3Endpoint", error: "Endpoint must be http(s)://." });
          }
          if (url.pathname && url.pathname !== "/" && url.pathname !== "") {
            errors.push({
              field: "s3Endpoint",
              error: "Endpoint URL must not include a path; bucket goes in its own field."
            });
          }
        } catch (_) {
          errors.push({ field: "s3Endpoint", error: "Endpoint URL is malformed." });
        }
      }
      const region = (settings.s3Region || "").trim();
      if (!region) errors.push({ field: "s3Region", error: 'Region is required (use "auto" for Cloudflare R2).' });
      const bucket = (settings.s3Bucket || "").trim();
      if (!bucket) errors.push({ field: "s3Bucket", error: "Bucket name is required." });
      else if (!/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/i.test(bucket)) {
        errors.push({
          field: "s3Bucket",
          error: "Bucket name must be 3-63 chars, alphanumeric/dash/dot only."
        });
      }
      if (!settings.s3AccessKeyId) errors.push({ field: "s3AccessKeyId", error: "Access key ID is required." });
      if (!settings.s3SecretKey) errors.push({ field: "s3SecretKey", error: "Secret access key is required." });
      return { valid: errors.length === 0, errors };
    },
    _buildObjectUrl(settings, objectKey) {
      const endpoint = new URL(settings.s3Endpoint);
      const isAws = /(^|\.)amazonaws\.com$/i.test(endpoint.hostname);
      const usePathStyle = settings.s3PathStyle === true || settings.s3PathStyle === void 0 && !isAws || settings.s3PathStyle === false && false;
      const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
      if (usePathStyle) {
        return `${endpoint.origin}/${encodeURIComponent(settings.s3Bucket)}/${encodedKey}`;
      }
      const host = `${settings.s3Bucket}.${endpoint.hostname}`;
      const port = endpoint.port ? `:${endpoint.port}` : "";
      return `${endpoint.protocol}//${host}${port}/${encodedKey}`;
    },
    _objectKey(settings) {
      return (settings.s3ObjectKey || "scriptvault-backup.json").replace(/^\/+/, "");
    },
    async _signRequest({
      method,
      url,
      region,
      accessKeyId,
      secretKey,
      body,
      contentType
    }) {
      const parsedUrl = new URL(url);
      const now = /* @__PURE__ */ new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dateStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
      const amzDate = `${dateStamp}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
      const service = "s3";
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const bodyBytes = body == null ? new Uint8Array(0) : typeof body === "string" ? new TextEncoder().encode(body) : body;
      const payloadHash = await this._sha256Hex(bodyBytes);
      const headers = {
        host: parsedUrl.host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate
      };
      if (contentType) headers["content-type"] = contentType;
      const sortedHeaderNames = Object.keys(headers).sort();
      const canonicalHeaders = sortedHeaderNames.map((key) => `${key}:${headers[key]}
  `).join("");
      const signedHeaders = sortedHeaderNames.join(";");
      const canonicalQuery = parsedUrl.searchParams.toString().split("&").filter(Boolean).sort().join("&");
      const canonicalRequest = [
        method,
        parsedUrl.pathname || "/",
        canonicalQuery,
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join("\n");
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        await this._sha256Hex(canonicalRequest)
      ].join("\n");
      const kDate = await this._hmac(new TextEncoder().encode("AWS4" + secretKey), dateStamp);
      const kRegion = await this._hmac(kDate, region);
      const kService = await this._hmac(kRegion, service);
      const kSigning = await this._hmac(kService, "aws4_request");
      const signature = this._toHex(await this._hmac(kSigning, stringToSign));
      return {
        headers: {
          ...Object.fromEntries(
            sortedHeaderNames.filter((key) => key !== "host").map((key) => [key, headers[key]])
          ),
          Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
        }
      };
    },
    async _sha256Hex(input) {
      const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
      const buffer = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ));
      return this._toHex(new Uint8Array(buffer));
    },
    async _hmac(keyBytes, message) {
      const key = await crypto.subtle.importKey(
        "raw",
        keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength
        ),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
      return new Uint8Array(signature);
    },
    _toHex(bytes) {
      let value = "";
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i] ?? 0;
        const hex = byte.toString(16);
        value += hex.length === 1 ? "0" + hex : hex;
      }
      return value;
    },
    async upload(data, settings, opts = {}) {
      const check = this.validate(settings);
      if (!check.valid) {
        throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(" ")}`);
      }
      const url = this._buildObjectUrl(settings, this._objectKey(settings));
      const body = JSON.stringify(data);
      const signed = await this._signRequest({
        method: "PUT",
        url,
        region: settings.s3Region,
        accessKeyId: settings.s3AccessKeyId,
        secretKey: settings.s3SecretKey,
        body,
        contentType: "application/json"
      });
      const response = await fetch(url, {
        method: "PUT",
        headers: signed.headers,
        body,
        signal: opts.signal
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`S3 upload failed: HTTP ${response.status}${text ? ` \u2014 ${text.slice(0, 200)}` : ""}`);
      }
      return { success: true, timestamp: Date.now() };
    },
    async download(settings, opts = {}) {
      const check = this.validate(settings);
      if (!check.valid) {
        throw new Error(`S3 settings invalid: ${check.errors.map((e) => e.error).join(" ")}`);
      }
      const url = this._buildObjectUrl(settings, this._objectKey(settings));
      const signed = await this._signRequest({
        method: "GET",
        url,
        region: settings.s3Region,
        accessKeyId: settings.s3AccessKeyId,
        secretKey: settings.s3SecretKey
      });
      const response = await fetch(url, {
        method: "GET",
        headers: signed.headers,
        signal: opts.signal
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`S3 download failed: HTTP ${response.status}${text ? ` \u2014 ${text.slice(0, 200)}` : ""}`);
      }
      return await response.json();
    },
    async test(settings) {
      const check = this.validate(settings);
      if (!check.valid) {
        return { success: false, error: check.errors.map((e) => e.error).join(" ") };
      }
      try {
        const url = this._buildObjectUrl(settings, this._objectKey(settings));
        const signed = await this._signRequest({
          method: "HEAD",
          url,
          region: settings.s3Region,
          accessKeyId: settings.s3AccessKeyId,
          secretKey: settings.s3SecretKey
        });
        const response = await fetch(url, { method: "HEAD", headers: signed.headers });
        if (response.ok || response.status === 404) return { success: true };
        return { success: false, error: `HTTP ${response.status}` };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    async getStatus(settings) {
      const check = this.validate(settings);
      if (!check.valid) {
        return {
          connected: false,
          status: "missing_config",
          error: check.errors.map((e) => e.error).join(" ")
        };
      }
      let endpointHost = "";
      try {
        endpointHost = new URL(settings.s3Endpoint).host;
      } catch {
      }
      const result = await this.test(settings);
      return {
        connected: result.success === true,
        status: result.success === true ? "ok" : "error",
        error: result.error ?? null,
        user: { email: "", name: `${settings.s3Bucket}@${endpointHost}` },
        endpointHost
      };
    },
    async disconnect() {
      await SettingsManager.set({
        s3Endpoint: "",
        s3Region: "",
        s3Bucket: "",
        s3AccessKeyId: "",
        s3SecretKey: "",
        s3ObjectKey: ""
      });
      return { success: true };
    }
  };
  var CloudSyncProviders = {
    webdav,
    googledrive,
    google: googledrive,
    dropbox,
    onedrive,
    s3
  };
  return module.exports.default || module.exports.CloudSyncProviders || module.exports;
})();

if (typeof self !== 'undefined') {
  self.CloudSyncProviders = CloudSyncProviders;
}

// ============================================================================
// Generated from src/modules/i18n.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const I18n = (() => {
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

  // src/modules/i18n.ts
  var i18n_exports = {};
  __export(i18n_exports, {
    I18n: () => I18n,
    default: () => i18n_default
  });
  module.exports = __toCommonJS(i18n_exports);
  var currentLocale = "en";
  var translations = {
    en: {
      // General
      appName: "ScriptVault",
      enabled: "Enabled",
      disabled: "Disabled",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      confirm: "Confirm",
      yes: "Yes",
      no: "No",
      ok: "OK",
      error: "Error",
      success: "Success",
      warning: "Warning",
      loading: "Loading...",
      search: "Search",
      refresh: "Refresh",
      // Navigation
      tabScripts: "Installed Userscripts",
      tabSettings: "Settings",
      tabUtilities: "Utilities",
      tabHelp: "Help",
      tabValues: "Values Editor",
      // Scripts
      newScript: "New Script",
      importScript: "Import",
      checkUpdates: "Check Updates",
      searchScripts: "Search scripts...",
      noScripts: "No userscripts installed",
      noScriptsDesc: "Create a new script or import one to get started.",
      scriptName: "Name",
      scriptVersion: "Version",
      scriptAuthor: "Author",
      scriptDescription: "Description",
      scriptSize: "Size",
      scriptEnabled: "Script Enabled",
      scriptDisabled: "Script Disabled",
      // Editor
      editorCode: "Code",
      editorInfo: "Info",
      editorStorage: "Storage",
      editorSettings: "Settings",
      editorSave: "Save",
      editorClose: "Close",
      editorToggle: "Toggle",
      editorDuplicate: "Duplicate",
      editorDelete: "Delete",
      // Settings sections
      settingsGeneral: "General",
      settingsNotifications: "Notifications",
      settingsEditor: "Editor",
      settingsUpdates: "Updates",
      settingsSync: "Cloud Sync",
      settingsAdvanced: "Advanced",
      // Sync
      syncProvider: "Sync Provider",
      syncProviderNone: "Disabled",
      syncProviderWebdav: "WebDAV",
      syncProviderGoogleDrive: "Google Drive",
      syncProviderDropbox: "Dropbox",
      syncConnected: "Connected",
      syncDisconnected: "Not connected",
      syncConnect: "Connect",
      syncDisconnect: "Disconnect",
      syncNow: "Sync Now",
      syncTest: "Test",
      lastSync: "Last sync",
      syncSuccess: "Sync completed successfully",
      syncError: "Sync failed",
      // Values Editor
      valuesTitle: "Script Values Editor",
      valuesDesc: "View and edit GM_getValue/GM_setValue storage",
      valuesAllScripts: "All Scripts",
      valuesNoData: "No stored values found",
      valuesKey: "Key",
      valuesValue: "Value",
      valuesType: "Type",
      valuesScript: "Script",
      valuesAdd: "Add Value",
      valuesEdit: "Edit Value",
      valuesDelete: "Delete",
      valuesDeleteSelected: "Delete Selected",
      valuesSaved: "Value saved",
      valuesDeleted: "Value deleted",
      // Per-script settings
      scriptSettingsTitle: "Per-Script Settings",
      scriptAutoUpdate: "Auto-update this script",
      scriptNotifyUpdates: "Notify on updates",
      scriptNotifyErrors: "Notify on errors",
      scriptRunAt: "Run at",
      scriptInjectInto: "Inject into",
      scriptExcludes: "Additional excludes",
      runAtDefault: "Default (from metadata)",
      runAtDocumentStart: "Document Start",
      runAtDocumentEnd: "Document End",
      runAtDocumentIdle: "Document Idle",
      injectAuto: "Auto",
      injectPage: "Page Context",
      injectContent: "Content Script",
      // Utilities
      exportAll: "Export All",
      exportZip: "Export as ZIP",
      importFile: "Import from File",
      importUrl: "Import from URL",
      importText: "Import from Text",
      chooseFile: "Choose File",
      noFileSelected: "No file selected",
      // Messages
      scriptInstalled: "Script installed",
      scriptUpdated: "Script updated",
      scriptDeleted: "Script deleted",
      settingsSaved: "Settings saved",
      confirmDelete: "Are you sure you want to delete this script?",
      confirmDeleteMultiple: "Delete {count} selected scripts?",
      updateAvailable: "Update available",
      noUpdates: "All scripts are up to date"
    },
    es: {
      appName: "ScriptVault",
      enabled: "Activado",
      disabled: "Desactivado",
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      close: "Cerrar",
      confirm: "Confirmar",
      yes: "S\xED",
      no: "No",
      ok: "OK",
      error: "Error",
      success: "\xC9xito",
      warning: "Advertencia",
      loading: "Cargando...",
      search: "Buscar",
      refresh: "Actualizar",
      tabScripts: "Scripts Instalados",
      tabSettings: "Configuraci\xF3n",
      tabUtilities: "Utilidades",
      tabHelp: "Ayuda",
      tabValues: "Editor de Valores",
      newScript: "Nuevo Script",
      importScript: "Importar",
      checkUpdates: "Buscar Actualizaciones",
      searchScripts: "Buscar scripts...",
      noScripts: "No hay scripts instalados",
      noScriptsDesc: "Crea un nuevo script o importa uno para comenzar.",
      syncProvider: "Proveedor de Sincronizaci\xF3n",
      syncProviderNone: "Desactivado",
      syncConnect: "Conectar",
      syncDisconnect: "Desconectar",
      syncNow: "Sincronizar Ahora",
      lastSync: "\xDAltima sincronizaci\xF3n",
      valuesTitle: "Editor de Valores",
      valuesAllScripts: "Todos los Scripts",
      valuesNoData: "No se encontraron valores almacenados"
    },
    fr: {
      appName: "ScriptVault",
      enabled: "Activ\xE9",
      disabled: "D\xE9sactiv\xE9",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      close: "Fermer",
      confirm: "Confirmer",
      yes: "Oui",
      no: "Non",
      ok: "OK",
      error: "Erreur",
      success: "Succ\xE8s",
      warning: "Avertissement",
      loading: "Chargement...",
      search: "Rechercher",
      refresh: "Actualiser",
      tabScripts: "Scripts Install\xE9s",
      tabSettings: "Param\xE8tres",
      tabUtilities: "Utilitaires",
      tabHelp: "Aide",
      tabValues: "\xC9diteur de Valeurs",
      newScript: "Nouveau Script",
      importScript: "Importer",
      checkUpdates: "V\xE9rifier les Mises \xE0 Jour",
      searchScripts: "Rechercher des scripts...",
      noScripts: "Aucun script install\xE9",
      syncProvider: "Fournisseur de Synchronisation",
      syncProviderNone: "D\xE9sactiv\xE9",
      syncConnect: "Connecter",
      syncDisconnect: "D\xE9connecter",
      syncNow: "Synchroniser",
      lastSync: "Derni\xE8re synchronisation"
    },
    de: {
      appName: "ScriptVault",
      enabled: "Aktiviert",
      disabled: "Deaktiviert",
      save: "Speichern",
      cancel: "Abbrechen",
      delete: "L\xF6schen",
      edit: "Bearbeiten",
      close: "Schlie\xDFen",
      confirm: "Best\xE4tigen",
      yes: "Ja",
      no: "Nein",
      ok: "OK",
      error: "Fehler",
      success: "Erfolg",
      warning: "Warnung",
      loading: "Laden...",
      search: "Suchen",
      refresh: "Aktualisieren",
      tabScripts: "Installierte Scripts",
      tabSettings: "Einstellungen",
      tabUtilities: "Werkzeuge",
      tabHelp: "Hilfe",
      tabValues: "Werte-Editor",
      newScript: "Neues Script",
      importScript: "Importieren",
      checkUpdates: "Updates pr\xFCfen",
      searchScripts: "Scripts suchen...",
      noScripts: "Keine Scripts installiert",
      syncProvider: "Sync-Anbieter",
      syncProviderNone: "Deaktiviert",
      syncConnect: "Verbinden",
      syncDisconnect: "Trennen",
      syncNow: "Jetzt synchronisieren",
      lastSync: "Letzte Synchronisation"
    },
    zh: {
      appName: "ScriptVault",
      enabled: "\u5DF2\u542F\u7528",
      disabled: "\u5DF2\u7981\u7528",
      save: "\u4FDD\u5B58",
      cancel: "\u53D6\u6D88",
      delete: "\u5220\u9664",
      edit: "\u7F16\u8F91",
      close: "\u5173\u95ED",
      confirm: "\u786E\u8BA4",
      yes: "\u662F",
      no: "\u5426",
      ok: "\u786E\u5B9A",
      error: "\u9519\u8BEF",
      success: "\u6210\u529F",
      warning: "\u8B66\u544A",
      loading: "\u52A0\u8F7D\u4E2D...",
      search: "\u641C\u7D22",
      refresh: "\u5237\u65B0",
      tabScripts: "\u5DF2\u5B89\u88C5\u811A\u672C",
      tabSettings: "\u8BBE\u7F6E",
      tabUtilities: "\u5DE5\u5177",
      tabHelp: "\u5E2E\u52A9",
      tabValues: "\u503C\u7F16\u8F91\u5668",
      newScript: "\u65B0\u5EFA\u811A\u672C",
      importScript: "\u5BFC\u5165",
      checkUpdates: "\u68C0\u67E5\u66F4\u65B0",
      searchScripts: "\u641C\u7D22\u811A\u672C...",
      noScripts: "\u6CA1\u6709\u5B89\u88C5\u811A\u672C",
      syncProvider: "\u540C\u6B65\u670D\u52A1",
      syncProviderNone: "\u7981\u7528",
      syncConnect: "\u8FDE\u63A5",
      syncDisconnect: "\u65AD\u5F00",
      syncNow: "\u7ACB\u5373\u540C\u6B65",
      lastSync: "\u4E0A\u6B21\u540C\u6B65"
    },
    ja: {
      appName: "ScriptVault",
      enabled: "\u6709\u52B9",
      disabled: "\u7121\u52B9",
      save: "\u4FDD\u5B58",
      cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB",
      delete: "\u524A\u9664",
      edit: "\u7DE8\u96C6",
      close: "\u9589\u3058\u308B",
      confirm: "\u78BA\u8A8D",
      yes: "\u306F\u3044",
      no: "\u3044\u3044\u3048",
      ok: "OK",
      error: "\u30A8\u30E9\u30FC",
      success: "\u6210\u529F",
      warning: "\u8B66\u544A",
      loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D...",
      search: "\u691C\u7D22",
      refresh: "\u66F4\u65B0",
      tabScripts: "\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u6E08\u307F\u30B9\u30AF\u30EA\u30D7\u30C8",
      tabSettings: "\u8A2D\u5B9A",
      tabUtilities: "\u30E6\u30FC\u30C6\u30A3\u30EA\u30C6\u30A3",
      tabHelp: "\u30D8\u30EB\u30D7",
      tabValues: "\u5024\u30A8\u30C7\u30A3\u30BF",
      newScript: "\u65B0\u898F\u30B9\u30AF\u30EA\u30D7\u30C8",
      importScript: "\u30A4\u30F3\u30DD\u30FC\u30C8",
      checkUpdates: "\u66F4\u65B0\u3092\u78BA\u8A8D",
      searchScripts: "\u30B9\u30AF\u30EA\u30D7\u30C8\u3092\u691C\u7D22...",
      noScripts: "\u30B9\u30AF\u30EA\u30D7\u30C8\u304C\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
      syncProvider: "\u540C\u671F\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC",
      syncProviderNone: "\u7121\u52B9",
      syncConnect: "\u63A5\u7D9A",
      syncDisconnect: "\u5207\u65AD",
      syncNow: "\u4ECA\u3059\u3050\u540C\u671F",
      lastSync: "\u6700\u7D42\u540C\u671F"
    },
    pt: {
      appName: "ScriptVault",
      enabled: "Ativado",
      disabled: "Desativado",
      save: "Salvar",
      cancel: "Cancelar",
      delete: "Excluir",
      edit: "Editar",
      close: "Fechar",
      confirm: "Confirmar",
      yes: "Sim",
      no: "N\xE3o",
      ok: "OK",
      error: "Erro",
      success: "Sucesso",
      warning: "Aviso",
      loading: "Carregando...",
      search: "Pesquisar",
      refresh: "Atualizar",
      tabScripts: "Scripts Instalados",
      tabSettings: "Configura\xE7\xF5es",
      tabUtilities: "Utilit\xE1rios",
      tabHelp: "Ajuda",
      tabValues: "Editor de Valores",
      newScript: "Novo Script",
      importScript: "Importar",
      checkUpdates: "Verificar Atualiza\xE7\xF5es",
      searchScripts: "Pesquisar scripts...",
      noScripts: "Nenhum script instalado",
      syncProvider: "Provedor de Sincroniza\xE7\xE3o",
      syncProviderNone: "Desativado",
      syncConnect: "Conectar",
      syncDisconnect: "Desconectar",
      syncNow: "Sincronizar Agora",
      lastSync: "\xDAltima sincroniza\xE7\xE3o"
    },
    ru: {
      appName: "ScriptVault",
      enabled: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
      disabled: "\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
      save: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
      cancel: "\u041E\u0442\u043C\u0435\u043D\u0430",
      delete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
      edit: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
      close: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
      confirm: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C",
      yes: "\u0414\u0430",
      no: "\u041D\u0435\u0442",
      ok: "OK",
      error: "\u041E\u0448\u0438\u0431\u043A\u0430",
      success: "\u0423\u0441\u043F\u0435\u0448\u043D\u043E",
      warning: "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435",
      loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...",
      search: "\u041F\u043E\u0438\u0441\u043A",
      refresh: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C",
      tabScripts: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u0441\u043A\u0440\u0438\u043F\u0442\u044B",
      tabSettings: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
      tabUtilities: "\u0423\u0442\u0438\u043B\u0438\u0442\u044B",
      tabHelp: "\u041F\u043E\u043C\u043E\u0449\u044C",
      tabValues: "\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439",
      newScript: "\u041D\u043E\u0432\u044B\u0439 \u0441\u043A\u0440\u0438\u043F\u0442",
      importScript: "\u0418\u043C\u043F\u043E\u0440\u0442",
      checkUpdates: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F",
      searchScripts: "\u041F\u043E\u0438\u0441\u043A \u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432...",
      noScripts: "\u041D\u0435\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432",
      syncProvider: "\u041F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438",
      syncProviderNone: "\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
      syncConnect: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C",
      syncDisconnect: "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C",
      syncNow: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
      lastSync: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F"
    }
  };
  var localeNames = {
    en: "English",
    es: "Espa\xF1ol",
    fr: "Fran\xE7ais",
    de: "Deutsch",
    zh: "\u4E2D\u6587",
    ja: "\u65E5\u672C\u8A9E",
    pt: "Portugu\xEAs",
    ru: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439"
  };
  function resolveLocale(locale) {
    const normalized = (locale ?? "").trim().split(/[-_]/)[0]?.toLowerCase();
    return normalized && translations[normalized] ? normalized : null;
  }
  function normalizeLocale(locale) {
    return resolveLocale(locale) ?? "en";
  }
  function detectLocale() {
    const browserLang = navigator.language || navigator.userLanguage || "en";
    return normalizeLocale(browserLang);
  }
  function getMessage(key, placeholders = {}) {
    const locale = translations[currentLocale] ?? translations.en;
    let message = locale[key] ?? translations.en[key] ?? key;
    Object.keys(placeholders).forEach((placeholder) => {
      message = message.replace(
        new RegExp(`\\{${placeholder}\\}`, "g"),
        placeholders[placeholder]
      );
    });
    return message;
  }
  var I18n = {
    init(locale) {
      currentLocale = locale === "auto" ? detectLocale() : normalizeLocale(locale);
      console.log("[I18n] Initialized with locale:", currentLocale);
      return currentLocale;
    },
    setLocale(locale) {
      const normalized = resolveLocale(locale);
      if (!normalized) return false;
      currentLocale = normalized;
      return true;
    },
    getLocale() {
      return currentLocale;
    },
    getMessage,
    t: getMessage,
    // Shorthand alias
    getAvailableLocales() {
      return Object.keys(translations).map(
        (code) => ({
          code,
          name: localeNames[code] ?? code
        })
      );
    },
    // Apply translations to DOM elements with data-i18n attribute
    applyToDOM(container = document) {
      container.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key) {
          el.textContent = getMessage(key);
        }
      });
      container.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key) {
          el.placeholder = getMessage(key);
        }
      });
      container.querySelectorAll("[data-i18n-title]").forEach((el) => {
        const key = el.getAttribute("data-i18n-title");
        if (key) {
          el.title = getMessage(key);
        }
      });
    }
  };
  var i18n_default = I18n;
  return module.exports.default || module.exports.I18n || module.exports;
})();

// ============================================================================
// END INLINED MODULES
// ============================================================================

// ============================================================================
// Generated from src/modules/storage.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const StorageModule = (() => {
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

  // src/modules/storage.ts
  var storage_exports = {};
  __export(storage_exports, {
    FolderStorage: () => FolderStorage,
    ScriptStorage: () => ScriptStorage,
    ScriptValues: () => ScriptValues,
    SettingsManager: () => SettingsManager,
    TabStorage: () => TabStorage,
    _openTabTrackers: () => _openTabTrackers,
    debugLog: () => debugLog,
    setScriptChangeListener: () => setScriptChangeListener
  });
  module.exports = __toCommonJS(storage_exports);

  // src/shared/utils.ts
  function generateId() {
    return "script_" + crypto.randomUUID();
  }

  // src/config/settings-defaults.json
  var settings_defaults_default = {
    enabled: true,
    showBadge: true,
    badgeColor: "#22c55e",
    theme: "dark",
    layout: "dark",
    notifyOnInstall: true,
    notifyOnUpdate: true,
    notifyOnError: false,
    editorTheme: "material-darker",
    editorFontSize: 13,
    editorTabSize: 2,
    editorLineWrapping: false,
    editorAutoComplete: true,
    editorMatchBrackets: true,
    editorAutoCloseBrackets: true,
    editorHighlightActiveLine: true,
    editorShowInvisibles: false,
    editorKeyMap: "default",
    autoUpdate: true,
    autoUpdateMode: "notify",
    updateInterval: 864e5,
    lastUpdateCheck: 0,
    syncEnabled: false,
    syncProvider: "none",
    syncInterval: 36e5,
    lastSync: 0,
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    googleDriveConnected: false,
    googleDriveToken: "",
    googleDriveRefreshToken: "",
    googleClientId: "",
    googleDriveUser: null,
    dropboxToken: "",
    dropboxRefreshToken: "",
    dropboxUser: null,
    dropboxClientId: "",
    onedriveToken: "",
    onedriveRefreshToken: "",
    onedriveClientId: "",
    onedriveConnected: false,
    onedriveUser: null,
    s3Endpoint: "",
    s3Region: "",
    s3Bucket: "",
    s3AccessKeyId: "",
    s3SecretKey: "",
    s3ObjectKey: "",
    language: "auto",
    debugMode: false,
    experimentalESMUserscripts: false,
    dashboardVirtualizationThreshold: 500,
    injectIntoFrames: true,
    xhrTimeout: 3e4,
    blacklist: [],
    badgeInfo: "running",
    autoReload: false,
    pageFilterMode: "blacklist",
    blacklistedPages: "",
    whitelistedPages: "",
    deniedHosts: [],
    trustedSigningKeys: {},
    trashMode: "30"
  };

  // src/storage/idb.ts
  var DB_NAME = "scriptvault";
  var DB_VERSION = 1;
  var Stores = {
    scripts: "scripts",
    values: "values",
    stats: "stats",
    backups: "backups"
  };
  var _db = null;
  var _opening = null;
  var _dbFactory = null;
  async function openDB(options = {}) {
    if (_db && _dbFactory && typeof indexedDB !== "undefined" && _dbFactory !== indexedDB) {
      try {
        _db.close();
      } catch {
      }
      _db = null;
      _dbFactory = null;
    }
    if (_db) return _db;
    if (_opening) return _opening;
    const name = options.name ?? DB_NAME;
    const version = options.version ?? DB_VERSION;
    _opening = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this context"));
        return;
      }
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        const tx = req.transaction;
        if (!tx) return;
        try {
          options.upgrade?.(db, ev.oldVersion, ev.newVersion ?? version, tx);
        } catch (e) {
          try {
            tx.abort();
          } catch {
          }
          reject(e);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
          }
          if (_db === db) _db = null;
        };
        db.onclose = () => {
          if (_db === db) _db = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
      req.onblocked = () => reject(new Error("IndexedDB open blocked by another connection"));
    });
    try {
      _db = await _opening;
      _dbFactory = typeof indexedDB !== "undefined" ? indexedDB : null;
      return _db;
    } finally {
      _opening = null;
    }
  }
  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
    });
  }
  function txComplete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
    });
  }
  function forEachCursor(source, fn, range, direction) {
    return new Promise((resolve, reject) => {
      const req = source.openCursor(range, direction);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        try {
          const r = fn(cursor.value, cursor.key, cursor.primaryKey);
          if (r && typeof r.then === "function") {
            r.then(() => cursor.continue(), reject);
          } else {
            cursor.continue();
          }
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error ?? new Error("cursor failed"));
    });
  }

  // src/storage/transaction.ts
  async function withTransaction(stores, mode, fn) {
    const db = await openDB();
    const tx = db.transaction(stores, mode);
    let result;
    try {
      result = await fn(tx);
    } catch (e) {
      try {
        tx.abort();
      } catch {
      }
      throw e;
    }
    await txComplete(tx);
    return result;
  }

  // src/storage/script-db.ts
  function setRecordKey(record, key, value) {
    Object.defineProperty(record, String(key), {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function upgradeSchema(db, oldVersion, _newVersion, _tx) {
    if (oldVersion < 1) {
      const scripts = db.createObjectStore(Stores.scripts, { keyPath: "id" });
      scripts.createIndex("by-enabled", "enabled", { unique: false });
      scripts.createIndex("by-position", "position", { unique: false });
      scripts.createIndex("by-namespace", "meta.namespace", { unique: false });
      const values = db.createObjectStore(Stores.values, {
        keyPath: ["scriptId", "key"]
      });
      values.createIndex("by-script", "scriptId", { unique: false });
      db.createObjectStore(Stores.stats, { keyPath: "scriptId" });
      const backups = db.createObjectStore(Stores.backups, { keyPath: "id" });
      backups.createIndex("by-created", "createdAt", { unique: false });
    }
  }
  async function openScriptDB() {
    return openDB({ name: DB_NAME, version: DB_VERSION, upgrade: upgradeSchema });
  }
  var ScriptsDAO = {
    async get(id) {
      await openScriptDB();
      return withTransaction(Stores.scripts, "readonly", async (tx) => {
        const row = await reqToPromise(tx.objectStore(Stores.scripts).get(id));
        return row ?? null;
      });
    },
    async getAll() {
      await openScriptDB();
      return withTransaction(Stores.scripts, "readonly", async (tx) => {
        const rows = await reqToPromise(tx.objectStore(Stores.scripts).getAll());
        return rows ?? [];
      });
    },
    async put(script) {
      await openScriptDB();
      await withTransaction(Stores.scripts, "readwrite", async (tx) => {
        await reqToPromise(tx.objectStore(Stores.scripts).put(script));
      });
    },
    async delete(id) {
      await openScriptDB();
      await withTransaction(
        [Stores.scripts, Stores.values, Stores.stats],
        "readwrite",
        async (tx) => {
          await reqToPromise(tx.objectStore(Stores.scripts).delete(id));
          await reqToPromise(tx.objectStore(Stores.stats).delete(id));
          const valuesIdx = tx.objectStore(Stores.values).index("by-script");
          await forEachCursor(valuesIdx, (_v, _k, primaryKey) => {
            tx.objectStore(Stores.values).delete(primaryKey);
          }, IDBKeyRange.only(id));
        }
      );
    },
    async clear() {
      await openScriptDB();
      await withTransaction(
        [Stores.scripts, Stores.values, Stores.stats],
        "readwrite",
        async (tx) => {
          await reqToPromise(tx.objectStore(Stores.scripts).clear());
          await reqToPromise(tx.objectStore(Stores.values).clear());
          await reqToPromise(tx.objectStore(Stores.stats).clear());
        }
      );
    },
    async count() {
      await openScriptDB();
      return withTransaction(Stores.scripts, "readonly", async (tx) => {
        return reqToPromise(tx.objectStore(Stores.scripts).count());
      });
    },
    // Bulk insert used by the v2→v3 migration. Single transaction so a partial
    // failure leaves the DB empty rather than half-imported.
    async bulkPut(scripts) {
      if (scripts.length === 0) return;
      await openScriptDB();
      await withTransaction(Stores.scripts, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.scripts);
        for (const s of scripts) {
          await reqToPromise(store.put(s));
        }
      });
    }
  };
  var ValuesDAO = {
    async get(scriptId, key) {
      await openScriptDB();
      return withTransaction(Stores.values, "readonly", async (tx) => {
        const row = await reqToPromise(
          tx.objectStore(Stores.values).get([scriptId, key])
        );
        return row ? row.value : void 0;
      });
    },
    async set(scriptId, key, value) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const row = { scriptId, key, value };
        await reqToPromise(tx.objectStore(Stores.values).put(row));
      });
    },
    async delete(scriptId, key) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        await reqToPromise(tx.objectStore(Stores.values).delete([scriptId, key]));
      });
    },
    async getAll(scriptId) {
      await openScriptDB();
      return withTransaction(Stores.values, "readonly", async (tx) => {
        const out = {};
        const idx = tx.objectStore(Stores.values).index("by-script");
        await forEachCursor(idx, (row) => {
          setRecordKey(out, row.key, row.value);
        }, IDBKeyRange.only(scriptId));
        return out;
      });
    },
    async list(scriptId) {
      const all = await this.getAll(scriptId);
      return Object.keys(all);
    },
    async setAll(scriptId, values) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.values);
        for (const [key, value] of Object.entries(values)) {
          await reqToPromise(store.put({ scriptId, key, value }));
        }
      });
    },
    async deleteMultiple(scriptId, keys) {
      if (keys.length === 0) return;
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.values);
        for (const key of keys) {
          await reqToPromise(store.delete([scriptId, key]));
        }
      });
    },
    async deleteAll(scriptId) {
      await openScriptDB();
      await withTransaction(Stores.values, "readwrite", async (tx) => {
        const store = tx.objectStore(Stores.values);
        const idx = store.index("by-script");
        await forEachCursor(idx, (_row, _k, primaryKey) => {
          store.delete(primaryKey);
        }, IDBKeyRange.only(scriptId));
      });
    },
    async byteSize(scriptId) {
      const all = await this.getAll(scriptId);
      return new TextEncoder().encode(JSON.stringify(all)).length;
    }
  };

  // src/storage/migration-v3.ts
  var SCHEMA_KEY = "_storageSchema";
  var SCHEMA_TARGET = 3;
  var LEGACY_USERSCRIPTS_KEY = "userscripts";
  var LEGACY_VALUE_PREFIX = "values_";
  var LEGACY_TOMBSTONE_KEY = "_v2LegacyTombstone";
  var LEGACY_TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  async function getSchemaVersion() {
    const data = await chrome.storage.local.get(SCHEMA_KEY);
    const v = data[SCHEMA_KEY];
    return typeof v === "number" ? v : 0;
  }
  async function setSchemaVersion(version) {
    await chrome.storage.local.set({ [SCHEMA_KEY]: version });
  }
  async function ensureV3Migration() {
    const current = await getSchemaVersion();
    if (current >= SCHEMA_TARGET) {
      await openScriptDB();
      return {
        ranMigration: false,
        scriptsMigrated: 0,
        valuesMigrated: 0,
        schemaVersion: current
      };
    }
    await openScriptDB();
    const counts = await migrateLegacyToIDB();
    await chrome.storage.local.set({
      [LEGACY_TOMBSTONE_KEY]: {
        migratedAt: Date.now(),
        fromSchema: current,
        toSchema: SCHEMA_TARGET,
        scriptsMigrated: counts.scripts,
        valuesMigrated: counts.values
      }
    });
    await setSchemaVersion(SCHEMA_TARGET);
    return {
      ranMigration: true,
      scriptsMigrated: counts.scripts,
      valuesMigrated: counts.values,
      schemaVersion: SCHEMA_TARGET
    };
  }
  async function migrateLegacyToIDB() {
    let scripts = 0;
    let values = 0;
    const scriptsBlob = await chrome.storage.local.get(LEGACY_USERSCRIPTS_KEY);
    const blob = scriptsBlob[LEGACY_USERSCRIPTS_KEY];
    if (blob && typeof blob === "object") {
      const list = Object.values(blob).filter(
        (s) => !!(s && typeof s === "object" && s.id)
      );
      if (list.length > 0) {
        const existing = await ScriptsDAO.getAll();
        const existingIds = new Set(existing.map((s) => s.id));
        const fresh = list.filter((s) => !existingIds.has(s.id));
        if (fresh.length > 0) {
          await ScriptsDAO.bulkPut(fresh);
          scripts = fresh.length;
        }
      }
    }
    const all = await chrome.storage.local.get(void 0);
    const valueKeys = Object.keys(all).filter((k) => k.startsWith(LEGACY_VALUE_PREFIX));
    for (const storageKey of valueKeys) {
      const scriptId = storageKey.slice(LEGACY_VALUE_PREFIX.length);
      const bag = all[storageKey];
      if (!bag || typeof bag !== "object") continue;
      const entries = Object.entries(bag);
      if (entries.length === 0) continue;
      await ValuesDAO.setAll(scriptId, bag);
      values += entries.length;
    }
    return { scripts, values };
  }

  // src/modules/storage.ts
  function makeValueBag(values = {}) {
    const bag = /* @__PURE__ */ Object.create(null);
    for (const [key, value] of Object.entries(values || {})) {
      setValueBagKey(bag, key, value);
    }
    return bag;
  }
  function setValueBagKey(bag, key, value) {
    Object.defineProperty(bag, String(key), {
      value: cloneStoredValue(value),
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function setScriptValueBag(cache, scriptId, bag) {
    Object.defineProperty(cache, String(scriptId), {
      value: bag,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  function exportValueBag(values = {}) {
    return Object.fromEntries(Object.entries(values || {}).map(([key, value]) => [key, cloneStoredValue(value)]));
  }
  var _scriptChangeListener = null;
  function setScriptChangeListener(fn) {
    _scriptChangeListener = fn;
  }
  function notifyScriptChange() {
    try {
      _scriptChangeListener?.();
    } catch {
    }
  }
  var _settingsInitPromise = null;
  var _scriptsInitPromise = null;
  var _foldersInitPromise = null;
  function cloneDefaultSettings() {
    if (typeof structuredClone === "function") {
      return structuredClone(settings_defaults_default);
    }
    return JSON.parse(JSON.stringify(settings_defaults_default));
  }
  function cloneSettingsState(settings) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(settings);
      } catch (_) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(settings));
    } catch (_) {
      return { ...settings };
    }
  }
  function cloneSettingsValue(value) {
    return value && typeof value === "object" ? cloneSettingsState(value) : value;
  }
  function cloneStoredValue(value) {
    if (!value || typeof value !== "object") return value;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_) {
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return Array.isArray(value) ? [...value] : { ...value };
    }
  }
  async function getSettingsValue(key) {
    await SettingsManager.init();
    const cachedSettings = SettingsManager.cache;
    if (key !== void 0) {
      return cloneSettingsValue(cachedSettings[key]);
    }
    return cloneSettingsState(cachedSettings);
  }
  var SettingsManager = {
    defaults: cloneDefaultSettings(),
    cache: null,
    async init() {
      if (this.cache !== null) return;
      if (!_settingsInitPromise) {
        _settingsInitPromise = (async () => {
          const data = await chrome.storage.local.get("settings");
          this.cache = { ...cloneDefaultSettings(), ...data["settings"] };
          console.log("[ScriptVault] Settings loaded");
        })();
      }
      try {
        return await _settingsInitPromise;
      } finally {
        _settingsInitPromise = null;
      }
    },
    get: getSettingsValue,
    async set(key, value) {
      await this.init();
      const previous = cloneSettingsState(this.cache);
      let rawNext;
      if (typeof key === "object") {
        rawNext = { ...this.cache, ...key };
      } else {
        rawNext = { ...this.cache, [key]: value };
      }
      const next = cloneSettingsState(rawNext);
      try {
        await chrome.storage.local.set({ settings: cloneSettingsState(next) });
      } catch (e) {
        this.cache = previous;
        throw e;
      }
      this.cache = next;
      return cloneSettingsState(this.cache);
    },
    async reset() {
      await this.init();
      const previousDefaults = cloneSettingsState(this.defaults);
      const previousCache = cloneSettingsState(this.cache);
      const nextDefaults = cloneDefaultSettings();
      const nextCache = cloneDefaultSettings();
      try {
        await chrome.storage.local.set({ settings: nextCache });
      } catch (e) {
        this.defaults = previousDefaults;
        this.cache = previousCache;
        throw e;
      }
      this.defaults = nextDefaults;
      this.cache = nextCache;
      return cloneSettingsState(this.cache);
    }
  };
  function debugLog(...args) {
    if (SettingsManager.cache?.debugMode) {
      console.log("[ScriptVault]", ...args);
    }
  }
  var ScriptStorage = {
    cache: null,
    async init() {
      if (this.cache !== null) return;
      if (!_scriptsInitPromise) {
        _scriptsInitPromise = (async () => {
          try {
            await ensureV3Migration();
          } catch (e) {
            console.warn("[ScriptVault] v3 migration failed:", e);
          }
          const list = await ScriptsDAO.getAll();
          const next = {};
          for (const s of list) next[s.id] = s;
          this.cache = next;
          console.log("[ScriptVault] Loaded", Object.keys(this.cache).length, "scripts");
        })();
      }
      try {
        return await _scriptsInitPromise;
      } finally {
        _scriptsInitPromise = null;
      }
    },
    // Legacy hook retained as a no-op so callers that still invoke save()
    // don't error; persistence happens inline on every write.
    async save() {
    },
    async getAll() {
      await this.init();
      return Object.values(this.cache);
    },
    async get(id) {
      await this.init();
      return this.cache[id] ?? null;
    },
    async set(id, script) {
      await this.init();
      const prev = this.cache[id];
      try {
        await ScriptsDAO.put(script);
      } catch (e) {
        throw e;
      }
      this.cache[id] = script;
      void prev;
      notifyScriptChange();
      return script;
    },
    async delete(id) {
      await this.init();
      const prev = this.cache[id];
      if (prev === void 0) return;
      try {
        await ScriptsDAO.delete(id);
      } catch (e) {
        throw e;
      }
      delete this.cache[id];
      delete ScriptValues.cache[id];
      notifyScriptChange();
    },
    async clear() {
      await this.init();
      const prev = this.cache;
      try {
        await ScriptsDAO.clear();
      } catch (e) {
        throw e;
      }
      this.cache = {};
      ScriptValues.cache = /* @__PURE__ */ Object.create(null);
      void prev;
      notifyScriptChange();
    },
    /**
     * Drop the in-memory cache so the next read forces a fresh load from IDB.
     * Call this after any out-of-band IDB write (rare; mostly used by tests
     * and the import-export flow).
     */
    invalidateCache() {
      this.cache = null;
      _scriptsInitPromise = null;
    },
    async search(query) {
      await this.init();
      const q = query.toLowerCase();
      return Object.values(this.cache).filter(
        (s) => (s.meta?.name || "").toLowerCase().includes(q) || (s.meta?.description || "").toLowerCase().includes(q) || (s.meta?.author || "").toLowerCase().includes(q)
      );
    },
    async getByNamespace(namespace) {
      await this.init();
      return Object.values(this.cache).filter((s) => s.meta?.namespace === namespace);
    },
    async reorder(orderedIds) {
      await this.init();
      const updates = [];
      orderedIds.forEach((id, index) => {
        const script = this.cache[id];
        if (script) {
          script.position = index;
          updates.push(script);
        }
      });
      for (const s of updates) {
        await ScriptsDAO.put(s);
      }
    },
    async duplicate(id) {
      await this.init();
      const original = this.cache[id];
      if (!original) return null;
      const newId = generateId();
      const newScript = {
        ...JSON.parse(JSON.stringify(original)),
        id: newId,
        meta: {
          ...original.meta,
          name: `${original.meta?.name || "Unnamed"} (Copy)`
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.set(newId, newScript);
      return newScript;
    }
  };
  var ScriptValues = {
    cache: /* @__PURE__ */ Object.create(null),
    listeners: /* @__PURE__ */ new Map(),
    pendingNotifications: /* @__PURE__ */ new Map(),
    // Debounce notifications only (not saves!)
    _initPromises: /* @__PURE__ */ new Map(),
    async init(scriptId) {
      if (Object.hasOwn(this.cache, scriptId)) return;
      const existing = this._initPromises.get(scriptId);
      if (existing) return existing;
      const p = (async () => {
        await ScriptStorage.init();
        setScriptValueBag(this.cache, scriptId, makeValueBag(await ValuesDAO.getAll(scriptId)));
      })();
      this._initPromises.set(scriptId, p);
      try {
        await p;
      } finally {
        this._initPromises.delete(scriptId);
      }
    },
    async get(scriptId, key, defaultValue) {
      await this.init(scriptId);
      const value = this.cache[scriptId][key];
      return value !== void 0 ? cloneStoredValue(value) : defaultValue;
    },
    // FIXED: Save immediately to prevent data loss on service worker termination.
    // MV3 service workers can be killed at any time — setTimeout-based debouncing is unsafe.
    async set(scriptId, key, value, senderTabId = null) {
      await this.init(scriptId);
      const oldValue = this.cache[scriptId][key];
      const nextValue = cloneStoredValue(value);
      try {
        await ValuesDAO.set(scriptId, key, cloneStoredValue(nextValue));
      } catch (e) {
        throw e;
      }
      setValueBagKey(this.cache[scriptId], key, nextValue);
      this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), cloneStoredValue(nextValue), senderTabId);
      return cloneStoredValue(nextValue);
    },
    // Debounced notifications — batches rapid changes (notification loss is acceptable)
    scheduleNotification(scriptId, key, oldValue, newValue, senderTabId = null) {
      const notifKey = `${scriptId}_${key}`;
      const existing = this.pendingNotifications.get(notifKey);
      if (existing) {
        clearTimeout(existing.timeout);
        oldValue = existing.oldValue;
      }
      const timeout = setTimeout(() => {
        this.pendingNotifications.delete(notifKey);
        this.notifyChange(scriptId, key, oldValue, newValue, false, senderTabId);
      }, 100);
      this.pendingNotifications.set(notifKey, { timeout, oldValue, senderTabId });
    },
    async delete(scriptId, key, senderTabId = null) {
      await this.init(scriptId);
      if (!Object.hasOwn(this.cache[scriptId], key)) return;
      const oldValue = this.cache[scriptId][key];
      try {
        await ValuesDAO.delete(scriptId, key);
      } catch (e) {
        throw e;
      }
      delete this.cache[scriptId][key];
      this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), void 0, senderTabId);
    },
    async list(scriptId) {
      await this.init(scriptId);
      return Object.keys(this.cache[scriptId]);
    },
    async getAll(scriptId) {
      await this.init(scriptId);
      return exportValueBag(this.cache[scriptId]);
    },
    async setAll(scriptId, values, senderTabId = null) {
      await this.init(scriptId);
      const nextValues = exportValueBag(values);
      const changes = [];
      for (const [key, value] of Object.entries(nextValues)) {
        changes.push([key, cloneStoredValue(this.cache[scriptId][key]), cloneStoredValue(value)]);
      }
      try {
        await ValuesDAO.setAll(scriptId, cloneStoredValue(nextValues));
      } catch (e) {
        throw e;
      }
      for (const [key, _o, v] of changes) {
        setValueBagKey(this.cache[scriptId], key, v);
      }
      for (const [key, oldValue, value] of changes) {
        this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), cloneStoredValue(value), senderTabId);
      }
    },
    async deleteAll(scriptId) {
      await this.init(scriptId);
      const hadCache = Object.hasOwn(this.cache, scriptId);
      const prev = hadCache ? this.cache[scriptId] : void 0;
      try {
        await ValuesDAO.deleteAll(scriptId);
      } catch (e) {
        if (hadCache) {
          setScriptValueBag(this.cache, scriptId, prev);
        }
        throw e;
      }
      delete this.cache[scriptId];
    },
    // Delete multiple specific keys at once
    async deleteMultiple(scriptId, keys, senderTabId = null) {
      await this.init(scriptId);
      const changes = [];
      const present = [];
      for (const key of keys) {
        if (!Object.hasOwn(this.cache[scriptId], key)) continue;
        changes.push([key, this.cache[scriptId][key]]);
        present.push(key);
      }
      if (present.length === 0) return;
      try {
        await ValuesDAO.deleteMultiple(scriptId, present);
      } catch (e) {
        throw e;
      }
      for (const key of present) delete this.cache[scriptId][key];
      for (const [key, oldValue] of changes) {
        this.scheduleNotification(scriptId, key, cloneStoredValue(oldValue), void 0, senderTabId);
      }
    },
    async getStorageSize(scriptId) {
      await this.init(scriptId);
      return new TextEncoder().encode(JSON.stringify(this.cache[scriptId] || {})).length;
    },
    addListener(scriptId, listenerId, callback) {
      const key = `${scriptId}_${listenerId}`;
      this.listeners.set(key, { scriptId, callback });
      return key;
    },
    removeListener(key) {
      this.listeners.delete(key);
    },
    notifyChange(scriptId, key, oldValue, newValue, remote, senderTabId = null) {
      if (oldValue === newValue) return;
      this.listeners.forEach((listener) => {
        if (listener.scriptId === scriptId) {
          try {
            listener.callback(key, oldValue, newValue, remote);
          } catch (e) {
            console.error("[ScriptVault] Value change listener error:", e);
          }
        }
      });
      chrome.tabs.query({ status: "complete" }).then((tabs) => {
        for (const tab of tabs) {
          const isOriginTab = senderTabId !== null && tab.id === senderTabId;
          const msg = {
            action: "valueChanged",
            data: { scriptId, key, oldValue, newValue, remote: !isOriginTab }
          };
          chrome.tabs.sendMessage(tab.id, msg).catch(() => {
          });
        }
      }).catch(() => {
      });
    }
  };
  var TabStorage = {
    data: /* @__PURE__ */ new Map(),
    get(tabId) {
      return this.data.get(tabId) || {};
    },
    set(tabId, data) {
      this.data.set(tabId, data);
    },
    delete(tabId) {
      this.data.delete(tabId);
    },
    getAll() {
      const result = {};
      this.data.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
  };
  if (!self._notifCallbacks) self._notifCallbacks = /* @__PURE__ */ new Map();
  chrome.tabs.onRemoved.addListener((tabId) => {
    TabStorage.delete(tabId);
    globalThis.XhrManager?.abortByTab?.(tabId);
    for (const [notifId, info] of self._notifCallbacks) {
      if (info.tabId === tabId) self._notifCallbacks.delete(notifId);
    }
  });
  var FolderStorage = {
    cache: null,
    async init() {
      if (this.cache !== null) return;
      if (!_foldersInitPromise) {
        _foldersInitPromise = (async () => {
          const data = await chrome.storage.local.get("scriptFolders");
          this.cache = data["scriptFolders"] || [];
        })();
      }
      try {
        return await _foldersInitPromise;
      } finally {
        _foldersInitPromise = null;
      }
    },
    async save() {
      await chrome.storage.local.set({ scriptFolders: this.cache });
    },
    async getAll() {
      await this.init();
      return this.cache;
    },
    async create(name, color = "#60a5fa") {
      await this.init();
      const folder = {
        id: generateId(),
        name,
        color,
        collapsed: false,
        scriptIds: [],
        createdAt: Date.now()
      };
      this.cache.push(folder);
      try {
        await this.save();
      } catch (e) {
        this.cache = this.cache.filter((f) => f.id !== folder.id);
        throw e;
      }
      return folder;
    },
    async update(id, updates) {
      await this.init();
      const folder = this.cache.find((f) => f.id === id);
      if (folder) {
        const prev = {};
        for (const key of Object.keys(updates)) {
          prev[key] = folder[key];
        }
        Object.assign(folder, updates);
        try {
          await this.save();
        } catch (e) {
          Object.assign(folder, prev);
          throw e;
        }
      }
      return folder;
    },
    async delete(id) {
      await this.init();
      const prev = this.cache;
      this.cache = this.cache.filter((f) => f.id !== id);
      try {
        await this.save();
      } catch (e) {
        this.cache = prev;
        throw e;
      }
    },
    async addScript(folderId, scriptId) {
      await this.init();
      const folder = this.cache.find((f) => f.id === folderId);
      if (folder && !folder.scriptIds.includes(scriptId)) {
        folder.scriptIds.push(scriptId);
        try {
          await this.save();
        } catch (e) {
          folder.scriptIds.pop();
          throw e;
        }
      }
    },
    async removeScript(folderId, scriptId) {
      await this.init();
      const folder = this.cache.find((f) => f.id === folderId);
      if (folder) {
        const prev = folder.scriptIds;
        folder.scriptIds = folder.scriptIds.filter((sid) => sid !== scriptId);
        try {
          await this.save();
        } catch (e) {
          folder.scriptIds = prev;
          throw e;
        }
      }
    },
    async moveScript(scriptId, fromFolderId, toFolderId) {
      await this.init();
      const from = fromFolderId ? this.cache.find((f) => f.id === fromFolderId) : void 0;
      const to = toFolderId ? this.cache.find((f) => f.id === toFolderId) : void 0;
      const prevFrom = from ? [...from.scriptIds] : null;
      const prevTo = to ? [...to.scriptIds] : null;
      if (from) from.scriptIds = from.scriptIds.filter((sid) => sid !== scriptId);
      if (to && !to.scriptIds.includes(scriptId)) to.scriptIds.push(scriptId);
      try {
        await this.save();
      } catch (e) {
        if (from && prevFrom) from.scriptIds = prevFrom;
        if (to && prevTo) to.scriptIds = prevTo;
        throw e;
      }
    },
    getFolderForScript(scriptId) {
      if (!this.cache) return null;
      return this.cache.find((f) => f.scriptIds.includes(scriptId)) || null;
    }
  };
  var _openTabTrackers = /* @__PURE__ */ new Map();
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    const info = _openTabTrackers.get(closedTabId);
    if (info) {
      _openTabTrackers.delete(closedTabId);
      chrome.tabs.sendMessage(info.callerTabId, {
        action: "openedTabClosed",
        data: { tabId: closedTabId, scriptId: info.scriptId }
      }).catch(() => {
      });
    }
  });
  return module.exports.default || module.exports;
})();

const SettingsManager = StorageModule.SettingsManager;
const ScriptStorage = StorageModule.ScriptStorage;
const ScriptValues = StorageModule.ScriptValues;
const TabStorage = StorageModule.TabStorage;
const FolderStorage = StorageModule.FolderStorage;
const _openTabTrackers = StorageModule._openTabTrackers;
const setScriptChangeListener = StorageModule.setScriptChangeListener;

// ============================================================================
// Generated from src/modules/xhr.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const XhrManager = (() => {
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

  // src/modules/xhr.ts
  var xhr_exports = {};
  __export(xhr_exports, {
    XhrManager: () => XhrManager
  });
  module.exports = __toCommonJS(xhr_exports);
  var XhrManager = {
    requests: /* @__PURE__ */ new Map(),
    // requestId -> { controller, tabId, scriptId, etc }
    nextId: 1,
    cleanupDelayMs: 3e5,
    // Create a new tracked request (controller added later by caller)
    create(tabId, scriptId, details) {
      const requestId = `xhr_${this.nextId++}_${Date.now()}`;
      const request = {
        id: requestId,
        controller: null,
        // AbortController added by caller
        tabId,
        scriptId,
        details,
        aborted: false,
        startTime: Date.now()
      };
      this.requests.set(requestId, request);
      request._cleanupTimer = setTimeout(() => this.remove(requestId), this.cleanupDelayMs);
      return request;
    },
    // Get a request by ID
    get(requestId) {
      return this.requests.get(requestId);
    },
    // Abort a specific request
    abort(requestId) {
      const request = this.requests.get(requestId);
      if (request && !request.aborted) {
        request.aborted = true;
        if (request.controller) {
          try {
            request.controller.abort();
          } catch (_e) {
          }
        }
        return true;
      }
      return false;
    },
    // Remove a completed/aborted request
    remove(requestId) {
      const request = this.requests.get(requestId);
      if (request?._cleanupTimer) clearTimeout(request._cleanupTimer);
      this.requests.delete(requestId);
    },
    // Abort all requests for a tab
    abortByTab(tabId) {
      for (const [requestId, request] of this.requests) {
        if (request.tabId === tabId) {
          this.abort(requestId);
          this.remove(requestId);
        }
      }
    },
    // Abort all requests for a script
    abortByScript(scriptId) {
      for (const [requestId, request] of this.requests) {
        if (request.scriptId === scriptId) {
          this.abort(requestId);
          this.remove(requestId);
        }
      }
    },
    // Get count of active requests
    getActiveCount() {
      return this.requests.size;
    },
    /**
     * Build the `fetch()` init options for a GM_xmlhttpRequest payload.
     *
     * Encapsulates the per-option translation rules so they're unit-testable:
     *   - `data.noCache === true` adds Cache-Control + Pragma: no-cache
     *     (only if the caller hasn't already set them — case-insensitive).
     *   - `data.redirect` is forwarded only when it's a valid RequestInit value
     *     ('follow' | 'error' | 'manual'); typos are silently dropped.
     *   - `data.anonymous === true` switches credentials to 'omit'.
     *
     * Body and signal are wired by the caller because they involve
     * AbortController + body serialization that lives outside this helper.
     */
    buildFetchOptions(data) {
      const method = String(data.method || "GET").toUpperCase();
      const reqHeaders = { ...data.headers || {} };
      if (data.noCache === true) {
        const lcKeys = Object.keys(reqHeaders).map((k) => k.toLowerCase());
        if (!lcKeys.includes("cache-control")) reqHeaders["Cache-Control"] = "no-cache";
        if (!lcKeys.includes("pragma")) reqHeaders["Pragma"] = "no-cache";
      }
      const opts = {
        method,
        headers: reqHeaders,
        credentials: data.anonymous === true ? "omit" : "include"
      };
      if (data.redirect === "follow" || data.redirect === "error" || data.redirect === "manual") {
        opts.redirect = data.redirect;
      }
      return opts;
    }
  };
  return module.exports.default || module.exports.XhrManager || module.exports;
})();

// ============================================================================
// Generated from src/background/internal-host-guard.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const InternalHostGuard = (() => {
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

  // src/background/internal-host-guard.ts
  var internal_host_guard_exports = {};
  __export(internal_host_guard_exports, {
    assertExternalFetchUrl: () => assertExternalFetchUrl,
    classifyFetchUrl: () => classifyFetchUrl,
    classifyResponseUrl: () => classifyResponseUrl,
    isInternalHost: () => isInternalHost
  });
  module.exports = __toCommonJS(internal_host_guard_exports);
  function isInternalIPv4(ip) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (typeof rawHost !== "string" || !rawHost) return true;
    let h = rawHost.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    if (h === "localhost" || h === "localhost.localdomain" || h === "ip6-localhost" || h === "ip6-loopback") {
      return true;
    }
    if (h.includes(":")) {
      if (h === "::1" || h === "::" || h === "::0" || h === "0:0:0:0:0:0:0:0" || h === "0:0:0:0:0:0:0:1") return true;
      if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
      if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
      const v4MappedDotted = h.match(/^::ffff:([0-9.]+)$/);
      if (v4MappedDotted) return isInternalIPv4(v4MappedDotted[1]);
      const v4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (v4MappedHex) {
        const hi = parseInt(v4MappedHex[1], 16);
        const lo = parseInt(v4MappedHex[2], 16);
        const dotted = [hi >> 8 & 255, hi & 255, lo >> 8 & 255, lo & 255].join(".");
        return isInternalIPv4(dotted);
      }
      return false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      return isInternalIPv4(h);
    }
    return false;
  }
  function classifyFetchUrl(url, allowedSchemes = ["https:"]) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "malformed-url", url: null, message: "malformed URL" };
    }
    if (!allowedSchemes.includes(parsed.protocol)) {
      return {
        ok: false,
        reason: "unsupported-scheme",
        url: parsed,
        message: `unsupported scheme ${parsed.protocol}`
      };
    }
    const host = parsed.hostname || "";
    if (!host) {
      return { ok: false, reason: "empty-hostname", url: parsed, message: "empty hostname" };
    }
    if (isInternalHost(host)) {
      let reason = "internal-host";
      if (host === "localhost" || host.endsWith(".localdomain") || host === "ip6-localhost" || host === "ip6-loopback") {
        reason = "localhost-alias";
      } else if (host.includes(":")) {
        reason = "ipv6-internal";
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        reason = "ipv4-internal";
      }
      return { ok: false, reason, url: parsed, message: `internal host (${reason})` };
    }
    return { ok: true, reason: null, url: parsed, message: "" };
  }
  function assertExternalFetchUrl(url, label, allowedSchemes = ["https:"]) {
    const result = classifyFetchUrl(url, allowedSchemes);
    if (!result.ok || !result.url) {
      throw new Error(`${label}: ${result.message || "rejected URL"}`);
    }
    return result.url;
  }
  function classifyResponseUrl(response, allowedSchemes = ["https:"]) {
    const finalUrl = typeof response?.url === "string" ? response.url : "";
    if (!finalUrl) {
      return { ok: true, reason: null, url: null, message: "" };
    }
    return classifyFetchUrl(finalUrl, allowedSchemes);
  }
  return module.exports.default || module.exports.InternalHostGuard || module.exports;
})();

// ============================================================================
// Generated from src/modules/resources.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ResourceCache = (() => {
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

  // src/modules/resources.ts
  var resources_exports = {};
  __export(resources_exports, {
    ResourceCache: () => ResourceCache
  });
  module.exports = __toCommonJS(resources_exports);

  // src/background/internal-host-guard.ts
  function isInternalIPv4(ip) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (typeof rawHost !== "string" || !rawHost) return true;
    let h = rawHost.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    if (h === "localhost" || h === "localhost.localdomain" || h === "ip6-localhost" || h === "ip6-loopback") {
      return true;
    }
    if (h.includes(":")) {
      if (h === "::1" || h === "::" || h === "::0" || h === "0:0:0:0:0:0:0:0" || h === "0:0:0:0:0:0:0:1") return true;
      if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
      if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
      const v4MappedDotted = h.match(/^::ffff:([0-9.]+)$/);
      if (v4MappedDotted) return isInternalIPv4(v4MappedDotted[1]);
      const v4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (v4MappedHex) {
        const hi = parseInt(v4MappedHex[1], 16);
        const lo = parseInt(v4MappedHex[2], 16);
        const dotted = [hi >> 8 & 255, hi & 255, lo >> 8 & 255, lo & 255].join(".");
        return isInternalIPv4(dotted);
      }
      return false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      return isInternalIPv4(h);
    }
    return false;
  }
  function classifyFetchUrl(url, allowedSchemes = ["https:"]) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "malformed-url", url: null, message: "malformed URL" };
    }
    if (!allowedSchemes.includes(parsed.protocol)) {
      return {
        ok: false,
        reason: "unsupported-scheme",
        url: parsed,
        message: `unsupported scheme ${parsed.protocol}`
      };
    }
    const host = parsed.hostname || "";
    if (!host) {
      return { ok: false, reason: "empty-hostname", url: parsed, message: "empty hostname" };
    }
    if (isInternalHost(host)) {
      let reason = "internal-host";
      if (host === "localhost" || host.endsWith(".localdomain") || host === "ip6-localhost" || host === "ip6-loopback") {
        reason = "localhost-alias";
      } else if (host.includes(":")) {
        reason = "ipv6-internal";
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        reason = "ipv4-internal";
      }
      return { ok: false, reason, url: parsed, message: `internal host (${reason})` };
    }
    return { ok: true, reason: null, url: parsed, message: "" };
  }
  function classifyResponseUrl(response, allowedSchemes = ["https:"]) {
    const finalUrl = typeof response?.url === "string" ? response.url : "";
    if (!finalUrl) {
      return { ok: true, reason: null, url: null, message: "" };
    }
    return classifyFetchUrl(finalUrl, allowedSchemes);
  }

  // src/modules/resources.ts
  var RESOURCE_SIZE_ERROR = "Resource exceeds maximum allowed size (5 MB)";
  async function readResponseBytesBounded(response, maxBytes) {
    const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(RESOURCE_SIZE_ERROR);
    }
    const body = response.body;
    if (body && typeof body.getReader === "function") {
      const reader = body.getReader();
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            try {
              await reader.cancel();
            } catch {
            }
            throw new Error(RESOURCE_SIZE_ERROR);
          }
          chunks.push(value);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
        }
      }
      const bytes2 = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes2.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes2;
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length > maxBytes) {
      throw new Error(RESOURCE_SIZE_ERROR);
    }
    return bytes;
  }
  var ResourceCache = {
    cache: {},
    _pendingFetches: /* @__PURE__ */ new Map(),
    maxAge: 864e5,
    // 24 hours
    maxEntries: 200,
    maxResourceBytes: 5 * 1024 * 1024,
    fetchTimeoutMs: 3e4,
    STORAGE_PREFIX: "res_cache_",
    async get(url) {
      const cached = this.cache[url];
      if (cached && Date.now() - cached.timestamp < this.maxAge) {
        return cached;
      }
      if (cached) delete this.cache[url];
      try {
        const key = this.STORAGE_PREFIX + url;
        const stored = await chrome.storage.local.get(key);
        const entry = stored[key];
        if (entry && Date.now() - entry.timestamp < this.maxAge) {
          this.cache[url] = entry;
          return entry;
        }
        if (entry) chrome.storage.local.remove(key).catch(() => {
        });
      } catch (_e) {
      }
      return null;
    },
    async set(url, text, dataUri) {
      const entry = { text, dataUri, timestamp: Date.now() };
      const keys = Object.keys(this.cache);
      if (keys.length >= this.maxEntries) {
        let oldestKey = keys[0];
        let oldestTs = Infinity;
        for (const key of keys) {
          if (this.cache[key].timestamp < oldestTs) {
            oldestKey = key;
            oldestTs = this.cache[key].timestamp;
          }
        }
        delete this.cache[oldestKey];
      }
      this.cache[url] = entry;
      try {
        const key = this.STORAGE_PREFIX + url;
        await chrome.storage.local.set({ [key]: entry });
      } catch (_e) {
      }
    },
    async fetchResource(url) {
      const cached = await this.get(url);
      if (cached) return cached.text;
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        throw new Error("Only HTTP(S) URLs allowed for @resource/@require");
      }
      const preCheck = classifyFetchUrl(url, ["http:", "https:"]);
      if (!preCheck.ok) {
        throw new Error(`@resource URL rejected: ${preCheck.message}`);
      }
      const pending = this._pendingFetches.get(url);
      if (pending) return await pending;
      const fetchPromise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const postCheck = classifyResponseUrl(response, ["http:", "https:"]);
          if (!postCheck.ok) {
            throw new Error(`@resource URL redirected to ${postCheck.message}`);
          }
          const contentType = response.headers.get("content-type") || "text/plain";
          const bytes = await readResponseBytesBounded(response, this.maxResourceBytes);
          let text;
          if (contentType.includes("text") || contentType.includes("json") || contentType.includes("xml") || contentType.includes("css") || contentType.includes("javascript")) {
            text = new TextDecoder().decode(bytes);
          } else {
            text = "";
          }
          const chunks = [];
          for (let i = 0; i < bytes.length; i += 8192) {
            chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192))));
          }
          const base64 = btoa(chunks.join(""));
          const dataUri = `data:${contentType};base64,${base64}`;
          await this.set(url, text, dataUri);
          return text;
        } finally {
          clearTimeout(timeoutId);
        }
      })().catch((e) => {
        console.error("[ScriptVault] Failed to fetch resource:", url, e);
        throw e;
      });
      this._pendingFetches.set(url, fetchPromise);
      try {
        return await fetchPromise;
      } finally {
        this._pendingFetches.delete(url);
      }
    },
    async getDataUri(url) {
      const cached = await this.get(url);
      if (cached && cached.dataUri) return cached.dataUri;
      await this.fetchResource(url);
      const entry = await this.get(url);
      return entry ? entry.dataUri : null;
    },
    async prefetchResources(resources) {
      if (!resources || typeof resources !== "object") return;
      const promises = Object.values(resources).filter((url) => typeof url === "string" && url.length > 0).map(
        (url) => this.fetchResource(url).catch((e) => console.warn("[ScriptVault] Resource prefetch failed:", url, e.message))
      );
      await Promise.allSettled(promises);
    },
    async clear() {
      this.cache = {};
      try {
        const all = await chrome.storage.local.get(null);
        const keys = Object.keys(all).filter((k) => k.startsWith(this.STORAGE_PREFIX));
        if (keys.length > 0) await chrome.storage.local.remove(keys);
      } catch (_e) {
      }
    }
  };
  return module.exports.default || module.exports.ResourceCache || module.exports;
})();

// ============================================================================
// Generated from src/modules/npm-resolve.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const NpmResolver = (() => {
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

  // src/modules/npm-resolve.ts
  var npm_resolve_exports = {};
  __export(npm_resolve_exports, {
    NpmResolver: () => NpmResolver,
    default: () => npm_resolve_default
  });
  module.exports = __toCommonJS(npm_resolve_exports);
  var MAX_NPM_FETCH_BYTES = 5 * 1024 * 1024;
  var NPM_FETCH_SIZE_ERROR = "NPM response exceeds maximum allowed size (5 MB)";
  function utf8Length(text) {
    return new TextEncoder().encode(text).byteLength;
  }
  async function readTextBounded(response, maxBytes) {
    const contentLength = Number.parseInt(response.headers?.get?.("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(NPM_FETCH_SIZE_ERROR);
    }
    const body = response.body;
    if (body && typeof body.getReader === "function") {
      const reader = body.getReader();
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            try {
              await reader.cancel();
            } catch {
            }
            throw new Error(NPM_FETCH_SIZE_ERROR);
          }
          chunks.push(value);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
        }
      }
      const decoder = new TextDecoder();
      let text2 = "";
      for (let i = 0; i < chunks.length; i++) {
        text2 += decoder.decode(chunks[i], { stream: i < chunks.length - 1 });
      }
      text2 += decoder.decode();
      return text2;
    }
    const text = await response.text();
    if (utf8Length(text) > maxBytes) {
      throw new Error(NPM_FETCH_SIZE_ERROR);
    }
    return text;
  }
  var NpmResolver = {
    CACHE_KEY: "npmCache",
    CACHE_TTL: 864e5,
    // 24 hours
    REGISTRY_URL: "https://registry.npmjs.org",
    REQUEST_TIMEOUT: 1e4,
    // 10 seconds
    // Pre-mapped shortcuts for popular packages (name -> CDN path overrides)
    POPULAR_PACKAGES: {
      "lodash": { cdn: "lodash", file: "lodash.min.js" },
      "jquery": { cdn: "jquery", file: "jquery.min.js" },
      "axios": { cdn: "axios", file: "axios.min.js" },
      "moment": { cdn: "moment", file: "moment.min.js" },
      "dayjs": { cdn: "dayjs", file: "dayjs.min.js" },
      "rxjs": { cdn: "rxjs", file: "rxjs.umd.min.js" },
      "underscore": { cdn: "underscore", file: "underscore-min.js" },
      "ramda": { cdn: "ramda", file: "ramda.min.js" },
      "dompurify": { cdn: "dompurify", file: "purify.min.js" },
      "marked": { cdn: "marked", file: "marked.min.js" },
      "highlight.js": { cdn: "highlight.js", file: "highlight.min.js" },
      "chart.js": { cdn: "Chart.js", file: "chart.umd.js" },
      "three": { cdn: "three", file: "three.min.js" },
      "d3": { cdn: "d3", file: "d3.min.js" },
      "gsap": { cdn: "gsap", file: "gsap.min.js" },
      "animejs": { cdn: "animejs", file: "anime.min.js" },
      "anime.js": { cdn: "animejs", file: "anime.min.js" },
      "sweetalert2": { cdn: "sweetalert2", file: "sweetalert2.all.min.js" },
      "tippy.js": { cdn: "tippy.js", file: "tippy-bundle.umd.min.js" },
      "sortablejs": { cdn: "Sortable", file: "Sortable.min.js" },
      "luxon": { cdn: "luxon", file: "luxon.min.js" }
    },
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    /**
     * Check if a require URL uses the npm: prefix.
     */
    isNpmRequire(url) {
      return typeof url === "string" && url.startsWith("npm:");
    },
    /**
     * Resolve a single npm require spec to a CDN URL.
     */
    async resolve(requireSpec) {
      if (!this.isNpmRequire(requireSpec)) {
        throw new Error(`Not an npm require: ${requireSpec}`);
      }
      const { name, version: requestedVersion } = this._parseSpec(requireSpec);
      const cacheKey = `${name}@${requestedVersion || "latest"}`;
      const cached = await this._getCache(cacheKey);
      if (cached) return cached;
      const version = requestedVersion && requestedVersion !== "latest" ? requestedVersion : await this._resolveLatestVersion(name);
      if (!version) {
        throw new Error(`Failed to resolve version for package: ${name}`);
      }
      const urls = this._buildCdnUrls(name, version);
      let lastError = null;
      for (const url of urls) {
        try {
          const content = await this._fetchWithTimeout(url);
          const integrity = await this._computeSriHash(content);
          const result = { url, integrity, version };
          await this._setCache(cacheKey, result);
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
      throw new Error(
        `Failed to resolve npm:${name}@${version} from all CDNs: ${lastError?.message || "unknown error"}`
      );
    },
    /**
     * Batch-resolve multiple npm require specs.
     */
    async resolveAll(requires) {
      const results = /* @__PURE__ */ new Map();
      const promises = requires.map(async (spec) => {
        try {
          const result = await this.resolve(spec);
          results.set(spec, result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.set(spec, { error: message });
        }
      });
      await Promise.allSettled(promises);
      return results;
    },
    /**
     * Fetch metadata for a package from the npm registry.
     */
    async getPackageInfo(packageName) {
      const sanitized = this._sanitizePackageName(packageName);
      const url = `${this.REGISTRY_URL}/${encodeURIComponent(sanitized).replace("%40", "@")}/latest`;
      const response = await this._fetchWithTimeout(url, { isJson: true });
      const data = JSON.parse(response);
      return {
        name: data.name,
        version: data.version,
        description: data.description || "",
        homepage: data.homepage || "",
        main: data.main || "index.js"
      };
    },
    /**
     * Clear all cached npm resolution data.
     */
    async clearCache() {
      try {
        await chrome.storage.local.remove(this.CACHE_KEY);
      } catch (_e) {
      }
    },
    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------
    /**
     * Parse an npm require spec into name and optional version.
     * Handles scoped packages (e.g. npm:@scope/name@version).
     */
    _parseSpec(spec) {
      const raw = spec.slice(4);
      if (!raw) throw new Error("Empty npm package spec");
      let name;
      let version = null;
      if (raw.startsWith("@")) {
        const slashIdx = raw.indexOf("/");
        if (slashIdx === -1) throw new Error(`Invalid scoped package: ${raw}`);
        const afterScope = raw.indexOf("@", slashIdx);
        if (afterScope > slashIdx) {
          name = raw.slice(0, afterScope);
          version = raw.slice(afterScope + 1);
        } else {
          name = raw;
        }
      } else {
        const atIdx = raw.indexOf("@");
        if (atIdx > 0) {
          name = raw.slice(0, atIdx);
          version = raw.slice(atIdx + 1);
        } else {
          name = raw;
        }
      }
      name = this._sanitizePackageName(name);
      if (version) version = this._sanitizeVersion(version);
      return { name, version };
    },
    /**
     * Validate and sanitize a package name.
     */
    _sanitizePackageName(name) {
      const trimmed = name.trim();
      if (!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(trimmed)) {
        throw new Error(`Invalid package name: ${trimmed}`);
      }
      return trimmed;
    },
    /**
     * Validate and sanitize a version string.
     */
    _sanitizeVersion(version) {
      const trimmed = version.trim();
      if (!/^[a-z0-9\-._^~>=<| *]+$/i.test(trimmed)) {
        throw new Error(`Invalid version: ${trimmed}`);
      }
      return trimmed;
    },
    /**
     * Resolve the latest version of a package from the npm registry.
     */
    async _resolveLatestVersion(name) {
      try {
        const info = await this.getPackageInfo(name);
        return info.version;
      } catch (_e) {
        return null;
      }
    },
    /**
     * Build the ordered CDN URL list for a package.
     * Prefers UMD/IIFE bundles for userscript compatibility.
     */
    _buildCdnUrls(name, version) {
      const popular = this.POPULAR_PACKAGES[name];
      const urls = [];
      if (popular) {
        urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/dist/${popular.file}`);
        urls.push(`https://unpkg.com/${name}@${version}/dist/${popular.file}`);
        urls.push(
          `https://cdnjs.cloudflare.com/ajax/libs/${popular.cdn}/${version}/${popular.file}`
        );
      }
      urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/+esm`);
      urls.push(`https://unpkg.com/${name}@${version}`);
      urls.push(
        `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${name}.min.js`
      );
      return [...new Set(urls)];
    },
    /**
     * Fetch a URL with a timeout. Returns the response body as text.
     */
    async _fetchWithTimeout(url, options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: options.isJson ? { "Accept": "application/json" } : {}
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        return await readTextBounded(response, MAX_NPM_FETCH_BYTES);
      } finally {
        clearTimeout(timer);
      }
    },
    /**
     * Compute SHA-256 SRI hash from content string.
     * Uses the Web Crypto API (available in service workers).
     */
    async _computeSriHash(content) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer);
      const hashArray = new Uint8Array(hashBuffer);
      let binary = "";
      for (let i = 0; i < hashArray.length; i++) {
        binary += String.fromCharCode(hashArray[i]);
      }
      return `sha256-${btoa(binary)}`;
    },
    /**
     * Read a single entry from the npm cache.
     */
    async _getCache(key) {
      try {
        const stored = await chrome.storage.local.get(this.CACHE_KEY);
        const cache = stored[this.CACHE_KEY];
        if (!cache || typeof cache !== "object") return null;
        const cacheObj = cache;
        const entry = cacheObj[key];
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.CACHE_TTL) {
          delete cacheObj[key];
          chrome.storage.local.set({ [this.CACHE_KEY]: cacheObj }).catch(() => {
          });
          return null;
        }
        return { url: entry.url, integrity: entry.integrity, version: entry.version };
      } catch (_e) {
        return null;
      }
    },
    /**
     * Write a single entry to the npm cache.
     */
    async _setCache(key, result) {
      try {
        const stored = await chrome.storage.local.get(this.CACHE_KEY);
        const rawCache = stored[this.CACHE_KEY];
        const cache = rawCache && typeof rawCache === "object" ? rawCache : {};
        cache[key] = {
          url: result.url,
          integrity: result.integrity,
          version: result.version,
          timestamp: Date.now()
        };
        await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
      } catch (_e) {
      }
    }
  };
  var npm_resolve_default = NpmResolver;
  return module.exports.default || module.exports.NpmResolver || module.exports;
})();

// ============================================================================
// Generated from src/modules/error-log.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ErrorLog = (() => {
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

  // src/modules/error-log.ts
  var error_log_exports = {};
  __export(error_log_exports, {
    _save: () => _save,
    clear: () => clear,
    default: () => error_log_default,
    exportCSV: () => exportCSV,
    exportJSON: () => exportJSON,
    exportText: () => exportText,
    flush: () => flush,
    getAll: () => getAll,
    getGrouped: () => getGrouped,
    getStats: () => getStats,
    log: () => log,
    logGMError: () => logGMError,
    logScriptError: () => logScriptError,
    registerGlobalHandlers: () => registerGlobalHandlers
  });
  module.exports = __toCommonJS(error_log_exports);
  var STORAGE_KEY = "errorLog";
  var MAX_ENTRIES = 500;
  var SAVE_DEBOUNCE_MS = 200;
  var _cache = null;
  var _loadPromise = null;
  var _pendingSaveTimer = null;
  async function _load() {
    if (_cache !== null) return _cache;
    if (!_loadPromise) {
      _loadPromise = (async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        _cache = data[STORAGE_KEY] || [];
        return _cache;
      })();
    }
    return _loadPromise;
  }
  async function _writeCacheToStorage() {
    if (_cache === null) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: _cache });
  }
  function _scheduleSave() {
    if (_pendingSaveTimer) return;
    _pendingSaveTimer = setTimeout(() => {
      _pendingSaveTimer = null;
      _writeCacheToStorage().catch((e) => {
        console.warn("[ErrorLog] debounced save failed:", e?.message || e);
      });
    }, SAVE_DEBOUNCE_MS);
  }
  async function flush() {
    if (_pendingSaveTimer) {
      clearTimeout(_pendingSaveTimer);
      _pendingSaveTimer = null;
    }
    await _writeCacheToStorage();
  }
  async function _save() {
    await flush();
  }
  async function log(entry) {
    let entries = await _load();
    const errorValue = entry.error;
    const errorObj = errorValue;
    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      scriptId: entry.scriptId || null,
      scriptName: entry.scriptName || null,
      error: typeof errorValue === "string" ? errorValue : errorObj?.message || String(errorValue),
      stack: entry.stack || errorObj?.stack || null,
      url: entry.url || null,
      line: entry.line ?? null,
      col: entry.col ?? null,
      context: entry.context || null
    };
    if (!record.scriptName && record.scriptId) {
      try {
        if (typeof ScriptStorage !== "undefined" && ScriptStorage) {
          const script = await ScriptStorage.get(record.scriptId);
          if (script?.meta?.name) record.scriptName = script.meta.name;
        }
      } catch (_) {
      }
    }
    entries.push(record);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES);
    }
    _cache = entries;
    _scheduleSave();
    return record;
  }
  async function getAll(filters) {
    let entries = await _load();
    if (!filters) return [...entries];
    if (filters.scriptId) {
      entries = entries.filter((e) => e.scriptId === filters.scriptId);
    }
    if (filters.startDate) {
      const start = typeof filters.startDate === "number" ? filters.startDate : new Date(filters.startDate).getTime();
      entries = entries.filter((e) => e.timestamp >= start);
    }
    if (filters.endDate) {
      const end = typeof filters.endDate === "number" ? filters.endDate : new Date(filters.endDate).getTime();
      entries = entries.filter((e) => e.timestamp <= end);
    }
    if (filters.errorType) {
      const type = filters.errorType.toLowerCase();
      entries = entries.filter((e) => {
        const msg = (e.error || "").toLowerCase();
        return msg.includes(type);
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      entries = entries.filter(
        (e) => (e.error || "").toLowerCase().includes(q) || (e.scriptName || "").toLowerCase().includes(q) || (e.stack || "").toLowerCase().includes(q) || (e.url || "").toLowerCase().includes(q) || (e.context || "").toLowerCase().includes(q)
      );
    }
    return entries;
  }
  async function getGrouped(filters) {
    const entries = await getAll(filters);
    const groups = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const key = `${entry.scriptId || ""}::${entry.error || ""}`;
      if (groups.has(key)) {
        const group = groups.get(key);
        group.count++;
        if (entry.timestamp < group.firstSeen) group.firstSeen = entry.timestamp;
        if (entry.timestamp > group.lastSeen) group.lastSeen = entry.timestamp;
        if (entry.stack && entry.timestamp >= group.lastSeen) {
          group.sampleStack = entry.stack;
        }
      } else {
        groups.set(key, {
          key,
          error: entry.error,
          scriptId: entry.scriptId,
          scriptName: entry.scriptName,
          count: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          sampleStack: entry.stack || null
        });
      }
    }
    return [...groups.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }
  async function exportJSON(filters) {
    const entries = await getAll(filters);
    return JSON.stringify({
      exported: (/* @__PURE__ */ new Date()).toISOString(),
      count: entries.length,
      entries
    }, null, 2);
  }
  async function exportText(filters) {
    const entries = await getAll(filters);
    const lines = [
      `ScriptVault Error Log - Exported ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `Total entries: ${entries.length}`,
      "=".repeat(80),
      ""
    ];
    for (const e of entries) {
      const time = new Date(e.timestamp).toISOString();
      lines.push(`[${time}] ${e.scriptName || e.scriptId || "Unknown"}`);
      lines.push(`  Error: ${e.error}`);
      if (e.url) lines.push(`  URL: ${e.url}${e.line != null ? `:${e.line}` : ""}${e.col != null ? `:${e.col}` : ""}`);
      if (e.context) lines.push(`  Context: ${e.context}`);
      if (e.stack) {
        lines.push("  Stack:");
        for (const sLine of e.stack.split("\n").slice(0, 5)) {
          lines.push(`    ${sLine.trim()}`);
        }
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  async function exportCSV(filters) {
    const entries = await getAll(filters);
    const headers = ["timestamp", "datetime", "scriptId", "scriptName", "error", "url", "line", "col", "context"];
    const escapeCSV = (val) => {
      if (val == null) return "";
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const rows = [headers.join(",")];
    for (const e of entries) {
      rows.push([
        e.timestamp,
        new Date(e.timestamp).toISOString(),
        escapeCSV(e.scriptId),
        escapeCSV(e.scriptName),
        escapeCSV(e.error),
        escapeCSV(e.url),
        e.line ?? "",
        e.col ?? "",
        escapeCSV(e.context)
      ].join(","));
    }
    return rows.join("\n");
  }
  async function clear(scriptId) {
    if (scriptId) {
      const entries = await _load();
      _cache = entries.filter((e) => e.scriptId !== scriptId);
    } else {
      _cache = [];
    }
    await flush();
  }
  async function getStats() {
    const entries = await _load();
    const byScript = {};
    for (const e of entries) {
      const key = e.scriptId || "unknown";
      if (!byScript[key]) {
        byScript[key] = { scriptId: e.scriptId, scriptName: e.scriptName, count: 0 };
      }
      byScript[key].count++;
    }
    const storageBytes = JSON.stringify(entries).length;
    return {
      total: entries.length,
      maxEntries: MAX_ENTRIES,
      byScript: Object.values(byScript).sort((a, b) => b.count - a.count),
      oldest: entries.length > 0 ? entries[0].timestamp : null,
      newest: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
      storageBytes
    };
  }
  function registerGlobalHandlers() {
    self.addEventListener("error", (event) => {
      log({
        scriptId: null,
        scriptName: "ServiceWorker",
        error: event.message || "Unknown error",
        stack: event.error?.stack || null,
        url: event.filename || null,
        line: event.lineno ?? null,
        col: event.colno ?? null,
        context: "global-error-handler"
      }).catch(() => {
      });
    });
    self.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      log({
        scriptId: null,
        scriptName: "ServiceWorker",
        error: reason?.message || String(reason),
        stack: reason?.stack || null,
        context: "unhandled-rejection"
      }).catch(() => {
      });
    });
    console.log("[ScriptVault] Error log global handlers registered");
  }
  async function logScriptError(scriptId, scriptName, errorData) {
    return log({
      scriptId,
      scriptName,
      error: errorData.message || errorData.error || "Script execution error",
      stack: errorData.stack || null,
      url: errorData.url || null,
      line: errorData.line ?? errorData.lineno ?? null,
      col: errorData.col ?? errorData.colno ?? null,
      context: "script-execution"
    });
  }
  async function logGMError(scriptId, scriptName, apiName, error) {
    const errorObj = error;
    return log({
      scriptId,
      scriptName,
      error: `GM API ${apiName}: ${typeof error === "string" ? error : errorObj?.message || String(error)}`,
      stack: errorObj?.stack || null,
      context: `gm-api-${apiName}`
    });
  }
  var ErrorLog = {
    get STORAGE_KEY() {
      return STORAGE_KEY;
    },
    get MAX_ENTRIES() {
      return MAX_ENTRIES;
    },
    set MAX_ENTRIES(value) {
      MAX_ENTRIES = Number.isFinite(value) && value > 0 ? Math.floor(value) : 500;
    },
    get SAVE_DEBOUNCE_MS() {
      return SAVE_DEBOUNCE_MS;
    },
    get _cache() {
      return _cache;
    },
    set _cache(value) {
      _cache = value;
      if (value === null) _loadPromise = null;
    },
    get _pendingSaveTimer() {
      return _pendingSaveTimer;
    },
    set _pendingSaveTimer(value) {
      _pendingSaveTimer = value;
    },
    log,
    getAll,
    getGrouped,
    exportJSON,
    exportText,
    exportCSV,
    clear,
    getStats,
    registerGlobalHandlers,
    logScriptError,
    logGMError,
    flush,
    _save
  };
  var error_log_default = ErrorLog;
  return module.exports.default || module.exports.ErrorLog || module.exports;
})();

// ============================================================================
// Generated from src/modules/notifications.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const NotificationSystem = (() => {
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

  // src/modules/notifications.ts
  var notifications_exports = {};
  __export(notifications_exports, {
    NotificationSystem: () => NotificationSystem,
    default: () => notifications_default
  });
  module.exports = __toCommonJS(notifications_exports);
  var NotificationSystem = {
    ALARM_WEEKLY_DIGEST: "scriptvault-weekly-digest",
    STORAGE_KEY_PREFS: "notificationPrefs",
    STORAGE_KEY_DIGEST: "weeklyDigest",
    STORAGE_KEY_ERROR_COUNTS: "notifErrorCounts",
    STORAGE_KEY_RATE_LIMITS: "notifRateLimits",
    // Default notification preferences
    defaultPrefs: {
      updates: true,
      errors: true,
      digest: false,
      security: true,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      // 10 PM
      quietHoursEnd: 7
      // 7 AM
    },
    // In-memory caches (rebuilt from storage on service worker wake)
    _prefsCache: null,
    _errorCounts: null,
    _rateLimits: null,
    // ---------------------------------------------------------------------------
    // Preferences
    // ---------------------------------------------------------------------------
    async getPreferences() {
      if (this._prefsCache) return { ...this._prefsCache };
      const data = await chrome.storage.local.get(this.STORAGE_KEY_PREFS);
      const stored = data[this.STORAGE_KEY_PREFS];
      this._prefsCache = { ...this.defaultPrefs, ...stored };
      return { ...this._prefsCache };
    },
    async setPreferences(prefs) {
      const current = await this.getPreferences();
      this._prefsCache = { ...current, ...prefs };
      await chrome.storage.local.set({ [this.STORAGE_KEY_PREFS]: this._prefsCache });
      if ("digest" in prefs) {
        if (prefs.digest) {
          await this.scheduleDigest();
        } else {
          await chrome.alarms.clear(this.ALARM_WEEKLY_DIGEST);
        }
      }
      return { ...this._prefsCache };
    },
    // ---------------------------------------------------------------------------
    // Quiet Hours
    // ---------------------------------------------------------------------------
    async _isQuietHours() {
      const prefs = await this.getPreferences();
      if (!prefs.quietHoursEnabled) return false;
      const now = /* @__PURE__ */ new Date();
      const hour = now.getHours();
      const { quietHoursStart, quietHoursEnd } = prefs;
      if (quietHoursStart > quietHoursEnd) {
        return hour >= quietHoursStart || hour < quietHoursEnd;
      }
      return hour >= quietHoursStart && hour < quietHoursEnd;
    },
    // ---------------------------------------------------------------------------
    // Script Update Notifications
    // ---------------------------------------------------------------------------
    /**
     * Notify about script updates. Accepts a single script or an array.
     * Each item: { id, name, version, oldVersion? }
     */
    async notifyUpdate(scripts) {
      const prefs = await this.getPreferences();
      if (!prefs.updates) return;
      const list = Array.isArray(scripts) ? scripts : [scripts];
      if (list.length === 0) return;
      await this._addDigestData("updatedScripts", list.map((s) => ({
        id: s.id,
        name: s.name,
        version: s.version,
        oldVersion: s.oldVersion ?? null,
        timestamp: Date.now()
      })));
      if (await this._isQuietHours()) return;
      let title;
      let message;
      let notifId;
      if (list.length === 1) {
        const s = list[0];
        if (!s) return;
        title = "Script Updated";
        message = `${s.name} updated to v${s.version}`;
        notifId = `update-${s.id}-${Date.now()}`;
      } else {
        title = `${list.length} Scripts Updated`;
        message = list.map((s) => s.name).join(", ");
        notifId = `update-batch-${Date.now()}`;
      }
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title,
          message,
          priority: 0
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create update notification:", e);
      }
      await this._setClickContext(
        notifId,
        list.length === 1 ? {
          action: "openScript",
          scriptId: list[0]?.id ?? null
        } : {
          action: "openDashboard"
        }
      );
    },
    // ---------------------------------------------------------------------------
    // Error Alerts
    // ---------------------------------------------------------------------------
    /**
     * Track and notify on script errors.
     * Notifies after 3 consecutive errors, rate-limited to 1/hour per script.
     */
    async notifyError(scriptId, error) {
      const prefs = await this.getPreferences();
      if (!prefs.errors) return;
      if (!this._errorCounts) {
        const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
        this._errorCounts = data[this.STORAGE_KEY_ERROR_COUNTS] ?? {};
      }
      if (!this._rateLimits) {
        const data = await chrome.storage.local.get(this.STORAGE_KEY_RATE_LIMITS);
        this._rateLimits = data[this.STORAGE_KEY_RATE_LIMITS] ?? {};
      }
      this._errorCounts[scriptId] = (this._errorCounts[scriptId] ?? 0) + 1;
      await chrome.storage.local.set({ [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts });
      const errorObj = error;
      await this._addDigestData("errors", [{
        scriptId,
        message: typeof error === "string" ? error : errorObj?.message ?? "Unknown error",
        timestamp: Date.now()
      }]);
      const currentCount = this._errorCounts[scriptId] ?? 0;
      if (currentCount < 3) return;
      const lastNotif = this._rateLimits[scriptId] ?? 0;
      const ONE_HOUR = 36e5;
      if (Date.now() - lastNotif < ONE_HOUR) return;
      if (await this._isQuietHours()) return;
      const errorMsg = typeof error === "string" ? error : errorObj?.message ?? "Unknown error";
      const snippet = errorMsg.length > 120 ? errorMsg.substring(0, 117) + "..." : errorMsg;
      let scriptName = scriptId;
      try {
        if (typeof ScriptStorage !== "undefined") {
          const script = await ScriptStorage.get(scriptId);
          if (script?.meta?.name) scriptName = script.meta.name;
        }
      } catch (_) {
      }
      const notifId = `error-${scriptId}-${Date.now()}`;
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: `Script Error: ${scriptName}`,
          message: `${currentCount} consecutive errors
  ${snippet}`,
          priority: 1
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create error notification:", e);
      }
      this._errorCounts[scriptId] = 0;
      this._rateLimits[scriptId] = Date.now();
      await chrome.storage.local.set({
        [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts,
        [this.STORAGE_KEY_RATE_LIMITS]: this._rateLimits
      });
      await this._setClickContext(notifId, {
        action: "openScript",
        scriptId
      });
    },
    /**
     * Reset the consecutive error count for a script (call on successful execution).
     */
    async resetErrorCount(scriptId) {
      if (!this._errorCounts) {
        const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
        this._errorCounts = data[this.STORAGE_KEY_ERROR_COUNTS] ?? {};
      }
      if (this._errorCounts[scriptId]) {
        delete this._errorCounts[scriptId];
        await chrome.storage.local.set({ [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts });
      }
    },
    // ---------------------------------------------------------------------------
    // Blacklist Alerts
    // ---------------------------------------------------------------------------
    /**
     * Warn when a script matches the blacklist or introduces new risk patterns.
     * reason: string describing the match
     */
    async notifyBlacklist(scriptId, reason) {
      const prefs = await this.getPreferences();
      if (!prefs.security) return;
      let scriptName = scriptId;
      try {
        if (typeof ScriptStorage !== "undefined") {
          const script = await ScriptStorage.get(scriptId);
          if (script?.meta?.name) scriptName = script.meta.name;
        }
      } catch (_) {
      }
      const notifId = `blacklist-${scriptId}-${Date.now()}`;
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: "Security Warning",
          message: `${scriptName}: ${reason}`,
          priority: 2,
          requireInteraction: true
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create blacklist notification:", e);
      }
      await this._addDigestData("securityAlerts", [{
        scriptId,
        scriptName,
        reason,
        timestamp: Date.now()
      }]);
      await this._setClickContext(notifId, {
        action: "openScript",
        scriptId
      });
    },
    // ---------------------------------------------------------------------------
    // Weekly Digest
    // ---------------------------------------------------------------------------
    /**
     * Schedule the weekly digest alarm. Fires every 7 days.
     */
    async scheduleDigest() {
      const prefs = await this.getPreferences();
      if (!prefs.digest) return;
      const existing = await chrome.alarms.get(this.ALARM_WEEKLY_DIGEST);
      if (existing) return;
      const WEEK_MS = 7 * 24 * 60 * 60 * 1e3;
      await chrome.alarms.create(this.ALARM_WEEKLY_DIGEST, {
        delayInMinutes: WEEK_MS / 6e4,
        periodInMinutes: WEEK_MS / 6e4
      });
      console.log("[ScriptVault] Weekly digest alarm scheduled");
    },
    /**
     * Generate and display the weekly digest.
     * Compiles: scripts updated, errors encountered, storage usage, stale scripts.
     */
    async generateDigest() {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_DIGEST);
      const digest = data[this.STORAGE_KEY_DIGEST] ?? this._emptyDigest();
      let storageUsage = null;
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate) {
          storageUsage = {
            used: estimate.usage ?? 0,
            quota: estimate.quota ?? 0
          };
        }
      } catch (_) {
      }
      let staleScripts = [];
      try {
        if (typeof ScriptStorage !== "undefined") {
          const all = await ScriptStorage.getAll();
          const NINETY_DAYS = 90 * 24 * 60 * 60 * 1e3;
          const now = Date.now();
          staleScripts = all.filter((s) => s.updatedAt && now - s.updatedAt > NINETY_DAYS).map((s) => ({ id: s.id, name: s.meta?.name ?? "Unknown", lastUpdated: s.updatedAt }));
        }
      } catch (_) {
      }
      const errors = digest.errors ?? [];
      const summary = {
        period: {
          start: digest.periodStart ?? Date.now() - 7 * 24 * 60 * 60 * 1e3,
          end: Date.now()
        },
        updatedScripts: digest.updatedScripts ?? [],
        totalErrors: errors.length,
        uniqueErrorScripts: [...new Set(errors.map((e) => e.scriptId))].length,
        securityAlerts: digest.securityAlerts ?? [],
        storageUsage,
        staleScripts,
        generatedAt: Date.now()
      };
      const lines = [];
      if (summary.updatedScripts.length > 0) {
        lines.push(`${summary.updatedScripts.length} script(s) updated`);
      }
      if (summary.totalErrors > 0) {
        lines.push(`${summary.totalErrors} error(s) from ${summary.uniqueErrorScripts} script(s)`);
      }
      if (summary.securityAlerts.length > 0) {
        lines.push(`${summary.securityAlerts.length} security alert(s)`);
      }
      if (summary.staleScripts.length > 0) {
        lines.push(`${summary.staleScripts.length} stale script(s) (90+ days)`);
      }
      if (storageUsage && storageUsage.quota > 0) {
        const pct = (storageUsage.used / storageUsage.quota * 100).toFixed(1);
        lines.push(`Storage: ${pct}% used`);
      }
      if (lines.length === 0) {
        lines.push("No activity this week");
      }
      const notifId = `digest-${Date.now()}`;
      try {
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: "ScriptVault Weekly Digest",
          message: lines.join("\n"),
          priority: 0
        });
      } catch (e) {
        console.error("[ScriptVault] Failed to create digest notification:", e);
      }
      summary.message = lines.join("\n");
      await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: {
        ...this._emptyDigest(),
        lastSummary: summary
      } });
      await this._setClickContext(notifId, { action: "openDashboard" });
      return summary;
    },
    // ---------------------------------------------------------------------------
    // Notification Click Handler
    // ---------------------------------------------------------------------------
    /**
     * Handle notification clicks. Call this from the background
     * chrome.notifications.onClicked listener.
     */
    async handleClick(notifId) {
      const ctxKey = `notifCtx_${notifId}`;
      const sessionStorage = chrome.storage.session;
      const sessionData = sessionStorage?.get ? await sessionStorage.get(ctxKey) : {};
      const localData = sessionData[ctxKey] ? {} : await chrome.storage.local.get(ctxKey);
      const ctx = sessionData[ctxKey] ?? localData[ctxKey];
      const cleanup = [chrome.storage.local.remove(ctxKey)];
      if (sessionStorage?.remove) {
        cleanup.unshift(sessionStorage.remove(ctxKey));
      }
      await Promise.allSettled(cleanup);
      await chrome.notifications.clear(notifId);
      if (!ctx) return;
      const dashboardUrl = chrome.runtime.getURL("pages/dashboard.html");
      if (ctx.action === "openScript" && ctx.scriptId) {
        try {
          await chrome.tabs.create({ url: `${dashboardUrl}#script_${encodeURIComponent(ctx.scriptId)}` });
        } catch (_) {
          await chrome.tabs.create({ url: dashboardUrl });
        }
      } else if (ctx.action === "openDashboard") {
        await chrome.tabs.create({ url: dashboardUrl });
      }
    },
    // ---------------------------------------------------------------------------
    // Internal Helpers
    // ---------------------------------------------------------------------------
    _emptyDigest() {
      return {
        periodStart: Date.now(),
        updatedScripts: [],
        errors: [],
        securityAlerts: [],
        lastSummary: null
      };
    },
    async _addDigestData(field, items) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_DIGEST);
      const digest = data[this.STORAGE_KEY_DIGEST] ?? this._emptyDigest();
      let arr = digest[field];
      if (!Array.isArray(arr)) {
        arr = [];
        digest[field] = arr;
      }
      arr.push(...items);
      const MAX_DIGEST_ENTRIES = 200;
      if (arr.length > MAX_DIGEST_ENTRIES) {
        digest[field] = arr.slice(-MAX_DIGEST_ENTRIES);
      }
      await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: digest });
    },
    async _setClickContext(notifId, context) {
      const ctxKey = `notifCtx_${notifId}`;
      if (chrome.storage.session?.set) {
        await chrome.storage.session.set({ [ctxKey]: context });
        return;
      }
      await chrome.storage.local.set({ [ctxKey]: context });
      try {
        await chrome.alarms.create(`notifCtx_clean_${notifId}`, { delayInMinutes: 5 });
      } catch (_) {
      }
    },
    // ---------------------------------------------------------------------------
    // Alarm Handler
    // ---------------------------------------------------------------------------
    /**
     * Handle alarms. Call this from the background chrome.alarms.onAlarm listener.
     * Returns true if the alarm was handled by this module.
     */
    async handleAlarm(alarm) {
      if (alarm.name === this.ALARM_WEEKLY_DIGEST) {
        await this.generateDigest();
        return true;
      }
      if (alarm.name.startsWith("notifCtx_clean_")) {
        const notifId = alarm.name.replace("notifCtx_clean_", "");
        const ctxKey = `notifCtx_${notifId}`;
        await chrome.storage.local.remove(ctxKey).catch(() => {
        });
        return true;
      }
      return false;
    },
    // ---------------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------------
    /**
     * Initialize the notification system. Call once on service worker startup.
     * Re-registers the digest alarm if the preference is enabled.
     */
    async init() {
      const prefs = await this.getPreferences();
      if (prefs.digest) {
        await this.scheduleDigest();
      }
      console.log("[ScriptVault] Notification system initialized");
    }
  };
  var notifications_default = NotificationSystem;
  return module.exports.default || module.exports.NotificationSystem || module.exports;
})();

// ============================================================================
// Generated from src/modules/sync-easycloud.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const EasyCloudSync = (() => {
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

  // src/modules/sync-easycloud.ts
  var sync_easycloud_exports = {};
  __export(sync_easycloud_exports, {
    EasyCloudSync: () => EasyCloudSync
  });
  module.exports = __toCommonJS(sync_easycloud_exports);
  var TAG = "[EasyCloud]";
  var ALARM_NAME = "easycloud-periodic-sync";
  var DEBOUNCE_ALARM_NAME = "easycloud-debounce-sync";
  var ALARM_PERIOD_MINUTES = 15;
  var DEBOUNCE_MS = 5e3;
  var DRIVE_API = "https://www.googleapis.com/drive/v3";
  var DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
  var SYNC_FILE_NAME = "scriptvault-sync.json";
  var STORAGE_KEY_PREFIX = "easycloud_";
  var KEYS = {
    CONNECTED: STORAGE_KEY_PREFIX + "connected",
    DEVICE_ID: STORAGE_KEY_PREFIX + "deviceId",
    LAST_SYNC: STORAGE_KEY_PREFIX + "lastSync",
    STATUS: STORAGE_KEY_PREFIX + "status",
    OFFLINE_QUEUE: STORAGE_KEY_PREFIX + "offlineQueue",
    USER_EMAIL: STORAGE_KEY_PREFIX + "userEmail",
    USER_NAME: STORAGE_KEY_PREFIX + "userName",
    FILE_ID: STORAGE_KEY_PREFIX + "fileId"
  };
  var STATUS = {
    IDLE: "synced",
    SYNCING: "syncing",
    ERROR: "error",
    OFFLINE: "offline"
  };
  var _status = STATUS.IDLE;
  var _syncInProgress = false;
  var _statusListeners = [];
  var _cachedToken = null;
  var _cachedFileId = null;
  var _deviceId = null;
  var _initialized = false;
  async function fetchWithTimeout(url, options = {}, timeoutMs = 3e4) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }
  function log(...args) {
    console.log(TAG, ...args);
  }
  function warn(...args) {
    console.warn(TAG, ...args);
  }
  function _getRuntimeHooks() {
    return globalThis;
  }
  async function _refreshScriptRuntime(script) {
    const hooks = _getRuntimeHooks();
    if (typeof hooks.unregisterScript === "function") {
      try {
        await hooks.unregisterScript(script.id);
      } catch (e) {
        warn(`Failed to unregister synced script ${script.id}:`, e);
      }
    }
    if (script.enabled !== false && typeof hooks.registerScript === "function") {
      try {
        await hooks.registerScript(script);
      } catch (e) {
        warn(`Failed to register synced script ${script.id}:`, e);
      }
    }
  }
  async function _deleteSyncedScript(scriptId) {
    const hooks = _getRuntimeHooks();
    if (typeof hooks.unregisterScript === "function") {
      try {
        await hooks.unregisterScript(scriptId);
      } catch (e) {
        warn(`Failed to unregister deleted synced script ${scriptId}:`, e);
      }
    }
    await ScriptStorage.delete(scriptId);
  }
  async function _updateBadgeIfAvailable() {
    const hooks = _getRuntimeHooks();
    if (typeof hooks.updateBadge === "function") {
      try {
        await hooks.updateBadge();
      } catch (e) {
        warn("Failed to refresh badge after sync:", e);
      }
    }
  }
  async function _mergeScriptText(base, local, remote) {
    if (typeof ScriptAnalyzer !== "undefined" && typeof ScriptAnalyzer.mergeText === "function") {
      return ScriptAnalyzer.mergeText(base, local, remote);
    }
    if (typeof ScriptAnalyzer !== "undefined" && typeof ScriptAnalyzer._ensureOffscreen === "function") {
      const ready = await ScriptAnalyzer._ensureOffscreen();
      if (!ready) throw new Error("No script merge engine available");
      return chrome.runtime.sendMessage({
        type: "offscreen_merge",
        base,
        local,
        remote
      });
    }
    throw new Error("No script merge engine available");
  }
  function setStatus(newStatus) {
    if (_status === newStatus) return;
    _status = newStatus;
    _persistStatus(newStatus);
    for (const cb of _statusListeners) {
      try {
        cb(newStatus);
      } catch (e) {
        warn("Status listener error:", e);
      }
    }
  }
  async function _persistStatus(status) {
    try {
      await chrome.storage.local.set({ [KEYS.STATUS]: status });
    } catch (_) {
    }
  }
  async function _getStorageValues(keys) {
    return chrome.storage.local.get(keys);
  }
  async function _setStorageValues(obj) {
    return chrome.storage.local.set(obj);
  }
  async function _ensureDeviceId() {
    if (_deviceId) return _deviceId;
    const data = await _getStorageValues([KEYS.DEVICE_ID]);
    const storedId = data[KEYS.DEVICE_ID];
    if (typeof storedId === "string" && storedId) {
      _deviceId = storedId;
      return _deviceId;
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    _deviceId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await _setStorageValues({ [KEYS.DEVICE_ID]: _deviceId });
    return _deviceId;
  }
  function _isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }
  async function _getAuthToken(interactive = false) {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      throw new Error('chrome.identity API not available. Grant the "identity" permission.');
    }
    try {
      const result = await chrome.identity.getAuthToken({
        interactive,
        scopes: [
          "https://www.googleapis.com/auth/drive.appdata",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile"
        ]
      });
      const token = result?.token || result;
      if (!token || typeof token !== "string") {
        throw new Error("No token returned from chrome.identity");
      }
      _cachedToken = token;
      return token;
    } catch (e) {
      _cachedToken = null;
      throw e;
    }
  }
  async function _getValidToken() {
    if (_cachedToken) {
      const ok = await _testToken(_cachedToken);
      if (ok) return _cachedToken;
      try {
        await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
      } catch (_) {
      }
      _cachedToken = null;
    }
    try {
      return await _getAuthToken(false);
    } catch (_) {
      return null;
    }
  }
  async function _testToken(token) {
    try {
      const resp = await fetchWithTimeout(`${DRIVE_API}/about?fields=user`, {
        headers: { "Authorization": `Bearer ${token}` }
      }, 1e4);
      return resp.ok;
    } catch (_) {
      return false;
    }
  }
  async function _findSyncFile(token) {
    if (_cachedFileId) {
      try {
        const resp2 = await fetchWithTimeout(
          `${DRIVE_API}/files/${_cachedFileId}?fields=id,modifiedTime`,
          { headers: { "Authorization": `Bearer ${token}` } },
          1e4
        );
        if (resp2.ok) return _cachedFileId;
      } catch (_) {
      }
      _cachedFileId = null;
    }
    const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
    const resp = await fetchWithTimeout(
      `${DRIVE_API}/files?q=${query}&spaces=appDataFolder&fields=files(id,modifiedTime)`,
      { headers: { "Authorization": `Bearer ${token}` } },
      15e3
    );
    if (!resp.ok) {
      throw new Error(`Drive file search failed: ${resp.status}`);
    }
    const data = await resp.json();
    const file = data.files?.[0];
    if (file) {
      _cachedFileId = file.id;
      await _setStorageValues({ [KEYS.FILE_ID]: file.id });
    }
    return file?.id ?? null;
  }
  async function _downloadFromDrive(token) {
    const fileId = await _findSyncFile(token);
    if (!fileId) return null;
    const resp = await fetchWithTimeout(
      `${DRIVE_API}/files/${fileId}?alt=media`,
      { headers: { "Authorization": `Bearer ${token}` } },
      6e4
    );
    if (resp.status === 404) {
      _cachedFileId = null;
      return null;
    }
    if (!resp.ok) {
      throw new Error(`Drive download failed: ${resp.status}`);
    }
    return resp.json();
  }
  async function _uploadToDrive(token, data) {
    const fileId = await _findSyncFile(token);
    const metadata = {
      name: SYNC_FILE_NAME,
      mimeType: "application/json"
    };
    if (!fileId) {
      metadata.parents = ["appDataFolder"];
    }
    const boundary = "---EasyCloud" + crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      JSON.stringify(data),
      `--${boundary}--`
    ].join("\r\n");
    const url = fileId ? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart` : `${DRIVE_UPLOAD_API}/files?uploadType=multipart`;
    const resp = await fetchWithTimeout(url, {
      method: fileId ? "PATCH" : "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    }, 6e4);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Drive upload failed (${resp.status}): ${errText}`);
    }
    const result = await resp.json();
    if (result.id && !_cachedFileId) {
      _cachedFileId = result.id;
      await _setStorageValues({ [KEYS.FILE_ID]: result.id });
    }
  }
  async function _enqueueOfflineChange(change) {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const raw = data[KEYS.OFFLINE_QUEUE];
    const queue = Array.isArray(raw) ? raw : [];
    queue.push({ ...change, queuedAt: Date.now() });
    if (queue.length > 500) queue.splice(0, queue.length - 500);
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: queue });
  }
  async function _drainOfflineQueue() {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const raw = data[KEYS.OFFLINE_QUEUE];
    const queue = Array.isArray(raw) ? raw : [];
    if (queue.length === 0) return;
    log(`Draining offline queue (${queue.length} entries)`);
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: [] });
    await _performSync();
  }
  async function _mergeData(localData, remoteData, deviceId) {
    const localScripts = new Map(
      (localData.scripts || []).map((s) => [s.id, s])
    );
    const remoteScripts = new Map(
      (remoteData.scripts || []).map((s) => [s.id, s])
    );
    const localTombstones = localData.tombstones || {};
    const remoteTombstones = remoteData.tombstones || {};
    const mergedTombstones = { ...localTombstones, ...remoteTombstones };
    const allIds = /* @__PURE__ */ new Set([...localScripts.keys(), ...remoteScripts.keys()]);
    const mergedScripts = [];
    for (const id of allIds) {
      if (mergedTombstones[id]) continue;
      const local = localScripts.get(id);
      const remote = remoteScripts.get(id);
      if (!remote) {
        if (local) mergedScripts.push(local);
        continue;
      }
      if (!local) {
        mergedScripts.push(remote);
        continue;
      }
      const merged = { ...local };
      const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);
      if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
        merged.enabled = remote.enabled;
        merged.position = remote.position;
        merged.settings = { ...local.settings, ...remote.settings };
      }
      if (local.code !== remote.code) {
        const base = local.syncBaseCode || remote.syncBaseCode || null;
        if (base && base !== local.code && base !== remote.code) {
          try {
            const mergeResult = await _mergeScriptText(base, local.code, remote.code);
            if (mergeResult && !mergeResult.error) {
              merged.code = mergeResult.merged ?? merged.code;
              if (mergeResult.conflicts) {
                merged.settings = { ...merged.settings || {}, mergeConflict: true };
              }
              log(`3-way merge for ${id}: conflicts=${String(mergeResult.conflicts || false)}`);
            } else {
              merged.code = localNewer ? local.code : remote.code;
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            warn(`3-way merge failed for ${id}:`, msg);
            merged.code = localNewer ? local.code : remote.code;
          }
        } else {
          merged.code = localNewer ? local.code : remote.code;
        }
      }
      merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
      merged.syncBaseCode = merged.code;
      merged.lastSyncDevice = deviceId;
      mergedScripts.push(merged);
    }
    return {
      version: 1,
      timestamp: Date.now(),
      deviceId,
      scripts: mergedScripts,
      tombstones: mergedTombstones
    };
  }
  async function _performSync() {
    if (_syncInProgress) {
      log("Sync already in progress, skipping");
      return { skipped: true };
    }
    if (!_isOnline()) {
      setStatus(STATUS.OFFLINE);
      return { offline: true };
    }
    _syncInProgress = true;
    setStatus(STATUS.SYNCING);
    try {
      const token = await _getValidToken();
      if (!token) {
        setStatus(STATUS.ERROR);
        return { error: "Not authenticated" };
      }
      const deviceId = await _ensureDeviceId();
      const tombstoneData = await _getStorageValues(["syncTombstones"]);
      const tombstones = tombstoneData["syncTombstones"] || {};
      const scripts = await ScriptStorage.getAll();
      const localData = {
        version: 1,
        timestamp: Date.now(),
        deviceId,
        scripts: scripts.map((s) => ({
          id: s.id,
          code: s.code,
          enabled: s.enabled,
          position: s.position,
          settings: s.settings || {},
          updatedAt: s.updatedAt || 0,
          syncBaseCode: s.syncBaseCode || null
        })),
        tombstones
      };
      const remoteData = await _downloadFromDrive(token);
      if (remoteData) {
        const merged = await _mergeData(localData, remoteData, deviceId);
        const mergedTombstones = merged.tombstones || {};
        let localMutated = false;
        for (const localScript of scripts) {
          if (!mergedTombstones[localScript.id]) continue;
          await _deleteSyncedScript(localScript.id);
          localMutated = true;
        }
        for (const script of merged.scripts) {
          if (mergedTombstones[script.id]) continue;
          const existing = await ScriptStorage.get(script.id);
          if (existing?.settings?.userModified) continue;
          if (!existing || script.updatedAt > (existing.updatedAt || 0)) {
            const parsed = typeof parseUserscript === "function" ? parseUserscript(script.code) : { meta: {}, error: null };
            if (!parsed.error) {
              const nextScript = {
                id: script.id,
                code: script.code,
                meta: parsed.meta,
                enabled: script.enabled,
                position: script.position,
                settings: {
                  ...existing?.settings || {},
                  ...script.settings || {},
                  userModified: false
                },
                updatedAt: script.updatedAt,
                createdAt: existing?.createdAt || script.updatedAt,
                syncBaseCode: script.code
              };
              await ScriptStorage.set(script.id, nextScript);
              await _refreshScriptRuntime(nextScript);
              localMutated = true;
            }
          }
        }
        if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
          await chrome.storage.local.set({ syncTombstones: mergedTombstones });
        }
        if (localMutated) {
          await _updateBadgeIfAvailable();
        }
        merged.timestamp = Date.now();
        await _uploadToDrive(token, merged);
      } else {
        await _uploadToDrive(token, localData);
      }
      const now = Date.now();
      await _setStorageValues({ [KEYS.LAST_SYNC]: now });
      try {
        await SettingsManager.set("lastSync", now);
      } catch (_) {
      }
      setStatus(STATUS.IDLE);
      log("Sync completed successfully");
      return { success: true, timestamp: now };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warn("Sync failed:", e);
      setStatus(STATUS.ERROR);
      return { error: msg };
    } finally {
      _syncInProgress = false;
    }
  }
  function _debouncedSync() {
    chrome.alarms.create(DEBOUNCE_ALARM_NAME, {
      delayInMinutes: DEBOUNCE_MS / 6e4
    });
  }
  async function _setupPeriodicSync() {
    try {
      await chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: ALARM_PERIOD_MINUTES,
        periodInMinutes: ALARM_PERIOD_MINUTES
      });
    } catch (e) {
      warn("Failed to create periodic sync alarm:", e);
    }
  }
  async function _clearPeriodicSync() {
    try {
      await chrome.alarms.clear(ALARM_NAME);
    } catch (_) {
    }
  }
  async function _clearDebounceSync() {
    try {
      await chrome.alarms.clear(DEBOUNCE_ALARM_NAME);
    } catch (_) {
    }
  }
  function _handleAlarm(alarm) {
    if (alarm.name === DEBOUNCE_ALARM_NAME) {
      _performSync().catch((e) => warn("Debounced sync error:", e));
      return;
    }
    if (alarm.name !== ALARM_NAME) return;
    _performSync().catch((e) => warn("Periodic sync error:", e));
  }
  function _handleOnline() {
    log("Back online, draining queue and syncing");
    _drainOfflineQueue().catch((e) => warn("Queue drain error:", e));
  }
  function _handleOffline() {
    log("Went offline");
    setStatus(STATUS.OFFLINE);
  }
  function _setupStorageListener() {
    chrome.storage.onChanged.addListener(
      (changes, areaName) => {
        if (areaName !== "local") return;
        if (changes["userscripts"]) {
          _getStorageValues([KEYS.CONNECTED]).then((d) => {
            if (d[KEYS.CONNECTED]) {
              _debouncedSync();
            }
          }).catch(() => {
          });
        }
      }
    );
  }
  var EasyCloudSync = {
    /**
     * Initialize EasyCloud sync. Call once on extension startup.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;
      const data = await _getStorageValues([
        KEYS.CONNECTED,
        KEYS.DEVICE_ID,
        KEYS.STATUS,
        KEYS.FILE_ID
      ]);
      const storedDeviceId = data[KEYS.DEVICE_ID];
      _deviceId = typeof storedDeviceId === "string" ? storedDeviceId : null;
      const storedFileId = data[KEYS.FILE_ID];
      _cachedFileId = typeof storedFileId === "string" ? storedFileId : null;
      const storedStatus = data[KEYS.STATUS];
      if (typeof storedStatus === "string" && storedStatus) {
        _status = storedStatus;
      }
      _setupStorageListener();
      chrome.alarms.onAlarm.addListener(_handleAlarm);
      if (typeof self !== "undefined") {
        self.addEventListener("online", _handleOnline);
        self.addEventListener("offline", _handleOffline);
      }
      if (data[KEYS.CONNECTED]) {
        if (!_isOnline()) {
          setStatus(STATUS.OFFLINE);
        } else {
          await _setupPeriodicSync();
          _performSync().catch((e) => warn("Init sync error:", e));
        }
      }
      log("Initialized");
    },
    /**
     * Connect to Google Drive via chrome.identity (interactive sign-in).
     */
    async connect() {
      try {
        if (chrome.permissions && chrome.permissions.request) {
          const granted = await chrome.permissions.request({
            permissions: ["identity"]
          });
          if (!granted) {
            return { success: false, error: "Identity permission denied" };
          }
        }
        const token = await _getAuthToken(true);
        if (!token) {
          return { success: false, error: "Authentication failed" };
        }
        let user = {};
        try {
          const resp = await fetchWithTimeout("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { "Authorization": `Bearer ${token}` }
          }, 1e4);
          if (resp.ok) {
            user = await resp.json();
          }
        } catch (_) {
        }
        await _ensureDeviceId();
        await _setStorageValues({
          [KEYS.CONNECTED]: true,
          [KEYS.USER_EMAIL]: user.email || "",
          [KEYS.USER_NAME]: user.name || ""
        });
        await _setupPeriodicSync();
        _performSync().catch((e) => warn("Post-connect sync error:", e));
        setStatus(STATUS.IDLE);
        log("Connected as", user.email || "(unknown)");
        return {
          success: true,
          user: { email: user.email || "", name: user.name || "", picture: user.picture }
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warn("Connect failed:", e);
        return { success: false, error: msg };
      }
    },
    /**
     * Disconnect from Google Drive. Revokes token and clears state.
     */
    async disconnect() {
      try {
        if (_cachedToken) {
          try {
            await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
            fetchWithTimeout(`https://accounts.google.com/o/oauth2/revoke?token=${_cachedToken}`, {}, 1e4).catch(() => {
            });
          } catch (_) {
          }
          _cachedToken = null;
        }
        await _clearPeriodicSync();
        await _clearDebounceSync();
        await _setStorageValues({
          [KEYS.CONNECTED]: false,
          [KEYS.USER_EMAIL]: "",
          [KEYS.USER_NAME]: "",
          [KEYS.FILE_ID]: "",
          [KEYS.OFFLINE_QUEUE]: [],
          [KEYS.STATUS]: STATUS.IDLE
        });
        _cachedFileId = null;
        _status = STATUS.IDLE;
        for (const cb of _statusListeners) {
          try {
            cb(STATUS.IDLE);
          } catch (_) {
          }
        }
        log("Disconnected");
        return { success: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warn("Disconnect error:", e);
        return { success: false, error: msg };
      }
    },
    /**
     * Trigger an immediate sync. Returns sync result.
     */
    async sync() {
      if (!_isOnline()) {
        setStatus(STATUS.OFFLINE);
        return { offline: true };
      }
      const data = await _getStorageValues([KEYS.CONNECTED]);
      if (!data[KEYS.CONNECTED]) {
        return { error: "Not connected. Call connect() first." };
      }
      return _performSync();
    },
    /**
     * Get current sync status and metadata.
     */
    async getStatus() {
      const data = await _getStorageValues([
        KEYS.CONNECTED,
        KEYS.LAST_SYNC,
        KEYS.STATUS,
        KEYS.USER_EMAIL,
        KEYS.USER_NAME,
        KEYS.DEVICE_ID
      ]);
      const storedStatus = data[KEYS.STATUS];
      const lastSync = data[KEYS.LAST_SYNC];
      const userEmail = data[KEYS.USER_EMAIL];
      const userName = data[KEYS.USER_NAME];
      const storedDeviceId = data[KEYS.DEVICE_ID];
      return {
        connected: !!data[KEYS.CONNECTED],
        status: (typeof storedStatus === "string" ? storedStatus : "") || _status,
        lastSync: typeof lastSync === "number" ? lastSync : null,
        user: data[KEYS.CONNECTED] ? {
          email: typeof userEmail === "string" ? userEmail : "",
          name: typeof userName === "string" ? userName : ""
        } : null,
        deviceId: typeof storedDeviceId === "string" ? storedDeviceId : null,
        online: _isOnline()
      };
    },
    /**
     * Check if currently connected (synchronous, uses cached state).
     */
    isConnected() {
      return _status !== STATUS.ERROR && _cachedToken !== null;
    },
    /**
     * Register a status change callback. Returns an unsubscribe function.
     */
    onStatusChange(callback) {
      if (typeof callback !== "function") {
        throw new TypeError("onStatusChange requires a function callback");
      }
      _statusListeners.push(callback);
      return () => {
        _statusListeners = _statusListeners.filter((cb) => cb !== callback);
      };
    },
    /**
     * Notify EasyCloud that a script was saved (triggers debounced sync).
     */
    notifyScriptSaved(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: "save", scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    },
    /**
     * Notify EasyCloud that a script was deleted (triggers debounced sync).
     */
    notifyScriptDeleted(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: "delete", scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    }
  };
  if (typeof CloudSyncProviders !== "undefined") {
    CloudSyncProviders["easycloud"] = {
      name: "EasyCloud (Google)",
      icon: "\u26A1",
      requiresAuth: false,
      requiresOAuth: false,
      isZeroConfig: true,
      supportsManualSync: true,
      supportsDryRun: false,
      getStorageDisclosure(_settings) {
        return {
          storage: "chrome.storage.local + chrome.identity",
          protection: "Extension-scoped browser storage plus Chrome identity token cache; ScriptVault does not persist EasyCloud OAuth tokens directly.",
          fields: [
            { key: "easycloud_connected", label: "EasyCloud connected flag", type: "metadata", present: false },
            { key: "easycloud_deviceId", label: "EasyCloud device ID", type: "metadata", present: false },
            { key: "easycloud_userEmail", label: "Connected Google account email", type: "metadata", present: false },
            { key: "easycloud_userName", label: "Connected Google account name", type: "metadata", present: false },
            { key: "chrome.identity token cache", label: "Google OAuth token cache managed by Chrome", type: "token", present: false }
          ],
          hasStoredSecrets: false,
          revokeAction: "Remove the Chrome identity cached token and clear EasyCloud local metadata.",
          notes: "EasyCloud uses chrome.identity for zero-config Google Drive app-data sync."
        };
      },
      async connect() {
        return EasyCloudSync.connect();
      },
      async disconnect() {
        return EasyCloudSync.disconnect();
      },
      async upload(_data, _settings) {
        const result = await EasyCloudSync.sync();
        if (result.error) throw new Error(result.error);
        return { success: true, timestamp: Date.now() };
      },
      async download(_settings) {
        await EasyCloudSync.sync();
        return null;
      },
      async test() {
        const status = await EasyCloudSync.getStatus();
        return { success: status.connected && status.online };
      },
      async getStatus() {
        const status = await EasyCloudSync.getStatus();
        return {
          connected: status.connected,
          user: status.user,
          status: status.status,
          lastSync: status.lastSync
        };
      }
    };
  }
  return module.exports.default || module.exports.EasyCloudSync || module.exports;
})();

// ============================================================================
// Generated from src/modules/backup-scheduler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const BackupScheduler = (() => {
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

  // src/modules/backup-scheduler.ts
  var backup_scheduler_exports = {};
  __export(backup_scheduler_exports, {
    BackupScheduler: () => BackupScheduler,
    default: () => backup_scheduler_default
  });
  module.exports = __toCommonJS(backup_scheduler_exports);
  var STORAGE_KEY_BACKUPS = "autoBackups";
  var STORAGE_KEY_SETTINGS = "backupSchedulerSettings";
  var STORAGE_KEY_RECEIPTS = "restoreReceipts";
  var RECEIPT_RETENTION = 10;
  var RECEIPT_BYTE_BUDGET = 5 * 1024 * 1024;
  var ALARM_NAME = "sv_backup_scheduled";
  var DEBOUNCE_ALARM = "sv_backup_debounce";
  var DEBOUNCE_MINUTES = 5;
  var STORAGE_WARNING_BYTES = 8 * 1024 * 1024;
  var DEFAULT_SETTINGS = {
    enabled: false,
    scheduleType: "daily",
    hour: 3,
    dayOfWeek: 0,
    maxBackups: 5,
    notifyOnSuccess: true,
    notifyOnFailure: true,
    warnOnStorageFull: true
  };
  var _settings = null;
  var _initialized = false;
  var _settingsLoadPromise = null;
  function _generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function _formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }
  function _zipBytesToBase64(zipData) {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < zipData.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(zipData.subarray(i, i + chunkSize))
      );
    }
    return btoa(binary);
  }
  function _nextScheduledTime(hour, dayOfWeek) {
    const now = /* @__PURE__ */ new Date();
    const target = new Date(now);
    target.setHours(hour, 0, 0, 0);
    if (dayOfWeek !== void 0 && dayOfWeek !== null) {
      const currentDay = now.getDay();
      let daysUntil = (dayOfWeek - currentDay + 7) % 7;
      if (daysUntil === 0 && now >= target) daysUntil = 7;
      target.setDate(target.getDate() + daysUntil);
    } else {
      if (now >= target) target.setDate(target.getDate() + 1);
    }
    return target;
  }
  function _notify(title, message, _isError = false) {
    try {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("images/icon128.png"),
        title: `ScriptVault \u2014 ${title}`,
        message
      });
    } catch (_) {
    }
  }
  async function _loadSettings() {
    if (_settings) return _settings;
    if (_settingsLoadPromise) return _settingsLoadPromise;
    _settingsLoadPromise = (async () => {
      const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
      const stored = data[STORAGE_KEY_SETTINGS];
      _settings = { ...DEFAULT_SETTINGS, ...stored ?? {} };
      return _settings;
    })();
    return _settingsLoadPromise;
  }
  async function _saveSettings(settings) {
    _settings = { ...DEFAULT_SETTINGS, ...settings };
    _settingsLoadPromise = null;
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: _settings });
  }
  async function _collectBackupData() {
    const scripts = await ScriptStorage.getAll();
    const files = {};
    const usedNames = /* @__PURE__ */ new Set();
    let hasScriptStorage = false;
    for (const script of scripts) {
      let safeName = (script.meta?.name || "unnamed").replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim().substring(0, 100);
      if (usedNames.has(safeName)) {
        let counter = 2;
        while (usedNames.has(`${safeName}_${counter}`)) counter++;
        safeName = `${safeName}_${counter}`;
      }
      usedNames.add(safeName);
      files[`scripts/${safeName}.user.js`] = fflate.strToU8(script.code || "");
      const options = {
        scriptId: script.id,
        settings: {
          enabled: script.enabled,
          "run-at": script.meta?.["run-at"] || "document-idle"
        },
        meta: {
          name: script.meta?.name,
          namespace: script.meta?.namespace || "",
          version: script.meta?.version || "1.0",
          description: script.meta?.description || "",
          author: script.meta?.author || "",
          match: script.meta?.match || [],
          include: script.meta?.include || [],
          exclude: script.meta?.exclude || [],
          grant: script.meta?.grant || [],
          require: script.meta?.require || [],
          resource: script.meta?.resource || {}
        }
      };
      files[`scripts/${safeName}.options.json`] = fflate.strToU8(
        JSON.stringify(options, null, 2)
      );
      try {
        const values = await ScriptValues.getAll(
          script.id
        );
        if (values && Object.keys(values).length > 0) {
          files[`scripts/${safeName}.storage.json`] = fflate.strToU8(
            JSON.stringify({ data: values }, null, 2)
          );
          hasScriptStorage = true;
        }
      } catch (_) {
      }
    }
    let hasGlobalSettings = false;
    try {
      const globalSettings = await SettingsManager.get();
      files["global-settings.json"] = fflate.strToU8(
        JSON.stringify(globalSettings, null, 2)
      );
      hasGlobalSettings = true;
    } catch (_) {
    }
    let hasFolders = false;
    try {
      const folderData = await chrome.storage.local.get("scriptFolders");
      if (folderData["scriptFolders"]) {
        files["folders.json"] = fflate.strToU8(
          JSON.stringify(folderData["scriptFolders"], null, 2)
        );
        hasFolders = true;
      }
    } catch (_) {
    }
    let hasWorkspaces = false;
    try {
      const wsData = await chrome.storage.local.get("workspaces");
      if (wsData["workspaces"]) {
        files["workspaces.json"] = fflate.strToU8(
          JSON.stringify(wsData["workspaces"], null, 2)
        );
        hasWorkspaces = true;
      }
    } catch (_) {
    }
    const zipData = fflate.zipSync(files, { level: 6 });
    return {
      base64: _zipBytesToBase64(zipData),
      scriptCount: scripts.length,
      hasGlobalSettings,
      hasFolders,
      hasWorkspaces,
      hasScriptStorage
    };
  }
  async function _getBackupList() {
    const data = await chrome.storage.local.get(STORAGE_KEY_BACKUPS);
    return data[STORAGE_KEY_BACKUPS] ?? [];
  }
  async function _saveBackupList(list) {
    await chrome.storage.local.set({ [STORAGE_KEY_BACKUPS]: list });
  }
  async function _getReceipts() {
    const data = await chrome.storage.local.get(STORAGE_KEY_RECEIPTS);
    const receipts = data[STORAGE_KEY_RECEIPTS];
    return Array.isArray(receipts) ? receipts : [];
  }
  async function _saveReceipts(list) {
    await chrome.storage.local.set({ [STORAGE_KEY_RECEIPTS]: list });
  }
  function _approxJsonBytes(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }
  async function _pushReceipt(receipt) {
    const receipts = await _getReceipts();
    receipts.unshift(receipt);
    if (receipts.length > RECEIPT_RETENTION) {
      receipts.length = RECEIPT_RETENTION;
    }
    let total = 0;
    for (let i = 0; i < receipts.length; i++) {
      total += _approxJsonBytes(receipts[i]);
      if (i > 0 && total > RECEIPT_BYTE_BUDGET) {
        receipts.length = i;
        break;
      }
    }
    await _saveReceipts(receipts);
    return receipt;
  }
  async function _updateReceipt(receiptId, patch) {
    const receipts = await _getReceipts();
    const idx = receipts.findIndex((receipt) => receipt?.id === receiptId);
    if (idx === -1) return null;
    receipts[idx] = { ...receipts[idx], ...patch };
    await _saveReceipts(receipts);
    return receipts[idx] ?? null;
  }
  function _snapshotMeta(receipt) {
    if (!receipt) return null;
    const snapshot = receipt.snapshot ?? {
      scriptsBefore: [],
      valuesBefore: {},
      scriptIdsBefore: []
    };
    const scriptsBefore = Array.isArray(snapshot.scriptsBefore) ? snapshot.scriptsBefore : [];
    return {
      id: receipt.id,
      type: receipt.type,
      source: receipt.source,
      sourceLabel: receipt.sourceLabel || "",
      timestamp: receipt.timestamp,
      backupId: receipt.backupId || null,
      result: receipt.result || null,
      rolledBackAt: receipt.rolledBackAt || null,
      rollbackError: receipt.rollbackError || null,
      rollbackResult: receipt.rollbackResult || null,
      snapshotScriptCount: scriptsBefore.length,
      snapshotIdSetSize: Array.isArray(snapshot.scriptIdsBefore) ? snapshot.scriptIdsBefore.length : 0,
      hasGlobalSettings: snapshot.settings !== void 0,
      hasFolders: snapshot.folders !== void 0,
      hasWorkspaces: snapshot.workspaces !== void 0
    };
  }
  async function _captureSnapshot({
    includeGlobals = false
  } = {}) {
    const scriptsBefore = [];
    const valuesBefore = {};
    let scriptIdsBefore = [];
    try {
      const all = await ScriptStorage.getAll();
      scriptIdsBefore = all.map((script) => script.id).filter((id) => typeof id === "string");
      for (const script of all) {
        scriptsBefore.push(structuredClone(script));
        if (typeof ScriptValues !== "undefined" && ScriptValues && typeof ScriptValues.getAll === "function") {
          try {
            const values = await ScriptValues.getAll(script.id);
            if (values && Object.keys(values).length > 0) {
              valuesBefore[script.id] = structuredClone(values);
            }
          } catch (_) {
          }
        }
      }
    } catch (_) {
    }
    const snapshot = {
      scriptsBefore,
      valuesBefore,
      scriptIdsBefore
    };
    if (includeGlobals) {
      try {
        snapshot.settings = structuredClone(await SettingsManager.get());
      } catch (_) {
      }
      try {
        const folderData = await chrome.storage.local.get("scriptFolders");
        if (folderData && folderData["scriptFolders"] !== void 0) {
          snapshot.folders = structuredClone(folderData["scriptFolders"]);
        }
      } catch (_) {
      }
      try {
        const wsData = await chrome.storage.local.get("workspaces");
        if (wsData && wsData["workspaces"] !== void 0) {
          snapshot.workspaces = structuredClone(wsData["workspaces"]);
        }
      } catch (_) {
      }
    }
    return snapshot;
  }
  function _estimateBackupSize(backups) {
    let total = 0;
    for (const b of backups) {
      total += b.data?.length ?? 0;
    }
    return total;
  }
  async function _registerAlarms() {
    const settings = await _loadSettings();
    await chrome.alarms.clear(ALARM_NAME);
    if (!settings.enabled || settings.scheduleType !== "onChange") {
      await chrome.alarms.clear(DEBOUNCE_ALARM);
    }
    if (!settings.enabled) return;
    if (settings.scheduleType === "daily") {
      const nextRun = _nextScheduledTime(settings.hour);
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 24 * 60
        // repeat every 24 hours
      });
    } else if (settings.scheduleType === "weekly") {
      const nextRun = _nextScheduledTime(
        settings.hour,
        settings.dayOfWeek
      );
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 7 * 24 * 60
        // repeat every 7 days
      });
    }
  }
  var BackupScheduler = {
    /**
     * Initialize the backup scheduler. Call once on service worker start.
     * Re-registers alarms and attaches the alarm listener.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;
      await _loadSettings();
      await _registerAlarms();
      chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === ALARM_NAME) {
          await BackupScheduler.createBackup("scheduled");
        } else if (alarm.name === DEBOUNCE_ALARM) {
          await BackupScheduler.createBackup("onChange");
        }
      });
    },
    /**
     * Trigger a backup.
     */
    async createBackup(reason = "manual") {
      try {
        const {
          base64,
          scriptCount,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage
        } = await _collectBackupData();
        const sizeBytes = Math.round(base64.length * 0.75);
        const settings = await _loadSettings();
        const backup = {
          id: _generateId(),
          timestamp: Date.now(),
          version: chrome.runtime.getManifest?.()?.version ?? "1.0",
          reason,
          scriptCount,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage,
          size: sizeBytes,
          sizeFormatted: _formatBytes(sizeBytes),
          data: base64
        };
        const backups = await _getBackupList();
        backups.unshift(backup);
        await _saveBackupList(backups);
        await BackupScheduler.pruneOldBackups();
        if (settings.warnOnStorageFull) {
          const allBackups = await _getBackupList();
          const totalSize = _estimateBackupSize(allBackups);
          if (totalSize > STORAGE_WARNING_BYTES) {
            _notify(
              "Storage Warning",
              `Backup storage is using ${_formatBytes(totalSize)}. Consider reducing the backup limit or deleting old backups.`,
              true
            );
          }
        }
        if (settings.notifyOnSuccess) {
          _notify(
            "Backup Complete",
            `${reason.charAt(0).toUpperCase() + reason.slice(1)} backup created with ${scriptCount} scripts (${_formatBytes(sizeBytes)}).`
          );
        }
        return { success: true, backupId: backup.id };
      } catch (err) {
        const settings = await _loadSettings();
        const errMsg = err instanceof Error ? err.message : String(err);
        if (settings.notifyOnFailure) {
          _notify("Backup Failed", `Error: ${errMsg}`, true);
        }
        console.error("[BackupScheduler] createBackup error:", err);
        return { success: false, error: errMsg };
      }
    },
    /**
     * Get all stored backups (without full data blobs to save memory).
     */
    async getBackups() {
      const backups = await _getBackupList();
      return backups.map(
        (b) => ({
          id: b.id,
          timestamp: b.timestamp,
          version: b.version,
          reason: b.reason,
          scriptCount: b.scriptCount,
          hasGlobalSettings: !!b.hasGlobalSettings,
          hasFolders: !!b.hasFolders,
          hasWorkspaces: !!b.hasWorkspaces,
          hasScriptStorage: !!b.hasScriptStorage,
          size: b.size,
          sizeFormatted: b.sizeFormatted
        })
      );
    },
    /**
     * Restore from a backup.
     * If selective = true, only restore scripts whose original IDs are in scriptIds.
     * Older backups may fall back to matching by script name.
     * Otherwise full restore (scripts, settings, folders, workspaces).
     */
    async restoreBackup(backupId, options = {}) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return { success: false, error: "Backup not found" };
      const recordReceipt = options.recordReceipt !== false;
      const sourceLabel = typeof options.sourceLabel === "string" && options.sourceLabel.trim() ? options.sourceLabel.trim() : `Backup ${new Date(backup.timestamp).toISOString()}`;
      let snapshot = null;
      if (recordReceipt) {
        try {
          snapshot = await _captureSnapshot({ includeGlobals: !options.selective });
        } catch (_) {
        }
      }
      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        let restoredScripts = 0;
        let skippedScripts = 0;
        let restoredSettings = false;
        let restoredFolders = false;
        let restoredWorkspaces = false;
        const errors = [];
        const userScripts = fileNames.filter(
          (n) => n.endsWith(".user.js")
        );
        if (options.selective && Array.isArray(options.scriptIds)) {
          const selectedRefs = new Set(options.scriptIds);
          const selectedFiles = {};
          for (const filename of userScripts) {
            const baseName = filename.replace(/\.user\.js$/, "");
            const displayName = baseName.replace(/^scripts\//, "");
            let scriptId = "";
            let scriptName = displayName;
            let scriptNs = "";
            let optionsMeta = {};
            const optionsFile = `${baseName}.options.json`;
            const optionsFileData = unzipped[optionsFile];
            if (optionsFileData) {
              try {
                optionsMeta = JSON.parse(
                  fflate.strFromU8(optionsFileData)
                );
                scriptId = typeof optionsMeta.scriptId === "string" ? optionsMeta.scriptId : "";
                scriptName = optionsMeta.meta?.name || displayName;
                scriptNs = optionsMeta.meta?.namespace || "";
              } catch (_) {
              }
            }
            const scriptKey = scriptNs ? `${scriptName}::${scriptNs}` : scriptName;
            const matchesSelection = selectedRefs.has(scriptName) || selectedRefs.has(displayName) || selectedRefs.has(scriptKey) || (scriptId ? selectedRefs.has(scriptId) : false);
            if (!matchesSelection) continue;
            const scriptFile = unzipped[filename];
            if (scriptFile) {
              selectedFiles[filename] = scriptFile;
            }
            if (optionsFileData) {
              selectedFiles[optionsFile] = optionsFileData;
            }
            const storageFile = `${baseName}.storage.json`;
            const storageFileData = unzipped[storageFile];
            if (storageFileData) {
              selectedFiles[storageFile] = storageFileData;
            }
          }
          if (Object.keys(selectedFiles).length === 0) {
            return {
              success: true,
              restoredScripts: 0,
              skippedScripts: 0,
              restoredSettings: false,
              restoredFolders: false,
              restoredWorkspaces: false,
              errors: []
            };
          }
          const selectiveZip = fflate.zipSync(selectedFiles, { level: 6 });
          const importResult = await importFromZip(
            _zipBytesToBase64(selectiveZip),
            { overwrite: true, recordReceipt: false }
          );
          if (importResult.error) {
            errors.push({ name: "archive", error: importResult.error });
          }
          restoredScripts = importResult.imported;
          skippedScripts = importResult.skipped;
          if (Array.isArray(importResult.errors)) {
            errors.push(...importResult.errors);
          }
        } else {
          try {
            const importResult = await importFromZip(backup.data, {
              overwrite: true,
              recordReceipt: false
            });
            if (importResult.error) {
              errors.push({ name: "archive", error: importResult.error });
            }
            restoredScripts = importResult.imported;
            skippedScripts = importResult.skipped;
            if (Array.isArray(importResult.errors)) {
              errors.push(...importResult.errors);
            }
          } catch (importErr) {
            console.warn("[BackupScheduler] Full import error:", importErr);
            errors.push({
              name: "archive",
              error: importErr instanceof Error ? importErr.message : String(importErr)
            });
          }
        }
        if (!options.selective) {
          const globalSettingsFile = unzipped["global-settings.json"];
          if (globalSettingsFile) {
            try {
              const restoredSettingsData = JSON.parse(
                fflate.strFromU8(globalSettingsFile)
              );
              await SettingsManager.set(restoredSettingsData);
              restoredSettings = true;
            } catch (settingsErr) {
              errors.push({
                name: "global-settings.json",
                error: settingsErr instanceof Error ? settingsErr.message : String(settingsErr)
              });
            }
          }
          const foldersFile = unzipped["folders.json"];
          if (foldersFile) {
            try {
              const folders = JSON.parse(
                fflate.strFromU8(foldersFile)
              );
              await chrome.storage.local.set({ scriptFolders: folders });
              FolderStorage.cache = null;
              restoredFolders = true;
            } catch (foldersErr) {
              errors.push({
                name: "folders.json",
                error: foldersErr instanceof Error ? foldersErr.message : String(foldersErr)
              });
            }
          }
          const workspacesFile = unzipped["workspaces.json"];
          if (workspacesFile) {
            try {
              const workspaces = JSON.parse(
                fflate.strFromU8(workspacesFile)
              );
              await chrome.storage.local.set({ workspaces });
              const workspaceManager = globalThis.WorkspaceManager;
              if (workspaceManager) {
                workspaceManager._cache = null;
                workspaceManager._initPromise = null;
              }
              restoredWorkspaces = true;
            } catch (workspacesErr) {
              errors.push({
                name: "workspaces.json",
                error: workspacesErr instanceof Error ? workspacesErr.message : String(workspacesErr)
              });
            }
          }
        }
        const success = errors.length === 0 || restoredScripts > 0 || restoredSettings || restoredFolders || restoredWorkspaces;
        const result = {
          success,
          restoredScripts,
          skippedScripts,
          restoredSettings,
          restoredFolders,
          restoredWorkspaces,
          errors
        };
        if (recordReceipt && snapshot && (restoredScripts > 0 || restoredSettings || restoredFolders || restoredWorkspaces)) {
          try {
            let scriptIdsAfter = [];
            try {
              const after = await ScriptStorage.getAll();
              scriptIdsAfter = after.map((script) => script.id).filter((id) => typeof id === "string");
            } catch (_) {
            }
            const beforeSet = new Set(snapshot.scriptIdsBefore || []);
            const addedScriptIds = scriptIdsAfter.filter((id) => !beforeSet.has(id));
            const receipt = {
              id: _generateId(),
              type: "restore",
              source: "backup-restore",
              sourceLabel,
              timestamp: Date.now(),
              backupId,
              backupTimestamp: backup.timestamp,
              selective: !!options.selective,
              result,
              snapshot: {
                ...snapshot,
                addedScriptIds
              }
            };
            await _pushReceipt(receipt);
            result.receiptId = receipt.id;
          } catch (receiptErr) {
            console.warn(
              "[BackupScheduler] restoreBackup failed to persist receipt:",
              receiptErr
            );
          }
        }
        return result;
      } catch (err) {
        console.error("[BackupScheduler] restoreBackup error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errMsg };
      }
    },
    /**
     * Delete a specific backup.
     */
    async deleteBackup(backupId) {
      const backups = await _getBackupList();
      const filtered = backups.filter(
        (b) => b.id !== backupId
      );
      if (filtered.length === backups.length)
        return { success: false, error: "Backup not found" };
      await _saveBackupList(filtered);
      return { success: true };
    },
    /**
     * Export a backup as a downloadable object (base64 ZIP + suggested filename).
     */
    async exportBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return null;
      const dateStr = new Date(backup.timestamp).toISOString().replace(/[:.]/g, "-");
      return {
        zipData: backup.data,
        filename: `scriptvault-autobackup-${dateStr}.zip`
      };
    },
    /**
     * Import a backup from externally provided base64 ZIP data.
     */
    async importBackup(data) {
      try {
        const binaryString = atob(data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        const scriptFiles = Object.keys(unzipped).filter(
          (n) => n.endsWith(".user.js")
        );
        const hasGlobalSettings = fileNames.includes("global-settings.json");
        const hasFolders = fileNames.includes("folders.json");
        const hasWorkspaces = fileNames.includes("workspaces.json");
        const hasScriptStorage = fileNames.some((name) => name.endsWith(".storage.json"));
        if (scriptFiles.length === 0 && !hasGlobalSettings && !hasFolders && !hasWorkspaces) {
          return {
            success: false,
            error: "This ZIP does not look like a ScriptVault backup archive."
          };
        }
        const sizeBytes = Math.round(data.length * 0.75);
        const backup = {
          id: _generateId(),
          timestamp: Date.now(),
          version: "imported",
          reason: "imported",
          scriptCount: scriptFiles.length,
          hasGlobalSettings,
          hasFolders,
          hasWorkspaces,
          hasScriptStorage,
          size: sizeBytes,
          sizeFormatted: _formatBytes(sizeBytes),
          data
        };
        const backups = await _getBackupList();
        backups.unshift(backup);
        await _saveBackupList(backups);
        await BackupScheduler.pruneOldBackups();
        return { success: true, backupId: backup.id };
      } catch (err) {
        console.error("[BackupScheduler] importBackup error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errMsg };
      }
    },
    /**
     * Get current scheduler settings.
     */
    getSettings() {
      return { ...DEFAULT_SETTINGS, ..._settings ?? {} };
    },
    /**
     * Update scheduler settings and re-register alarms.
     */
    async setSettings(settings) {
      const merged = {
        ...await _loadSettings(),
        ...settings
      };
      await _saveSettings(merged);
      await _registerAlarms();
      const prunedCount = await BackupScheduler.pruneOldBackups();
      return { ..._settings, prunedCount };
    },
    /**
     * Remove old backups exceeding the retention limit.
     */
    async pruneOldBackups() {
      const settings = await _loadSettings();
      const backups = await _getBackupList();
      const rawMax = Number(settings.maxBackups);
      const maxBackups = Number.isFinite(rawMax) && rawMax >= 0 ? Math.floor(rawMax) : 5;
      if (backups.length <= maxBackups) return 0;
      const pruned = backups.slice(0, maxBackups);
      await _saveBackupList(pruned);
      return Math.max(0, backups.length - pruned.length);
    },
    /**
     * Called externally when a script is installed, updated, or deleted.
     * If scheduleType is 'onChange', sets a debounce alarm.
     */
    async onScriptChanged() {
      const settings = await _loadSettings();
      if (!settings.enabled || settings.scheduleType !== "onChange") return;
      await chrome.alarms.clear(DEBOUNCE_ALARM);
      chrome.alarms.create(DEBOUNCE_ALARM, {
        delayInMinutes: DEBOUNCE_MINUTES
      });
    },
    /**
     * Get a detailed manifest of what's inside a specific backup
     * (script names and sizes) without decompressing the whole thing to memory.
     */
    async inspectBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return null;
      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        const parseJsonFile = (fileName) => {
          const fileData = unzipped[fileName];
          if (!fileData) return null;
          try {
            return JSON.parse(fflate.strFromU8(fileData));
          } catch {
            return null;
          }
        };
        const countEntries = (value) => {
          if (Array.isArray(value)) return value.length;
          if (value && typeof value === "object") return Object.keys(value).length;
          return 0;
        };
        const globalSettings = parseJsonFile("global-settings.json");
        const folderData = parseJsonFile("folders.json");
        const workspaceData = parseJsonFile("workspaces.json");
        const folderList = Array.isArray(folderData) ? folderData : [];
        const workspaceList = Array.isArray(workspaceData?.list) ? workspaceData.list : Array.isArray(workspaceData) ? workspaceData : [];
        const scripts = fileNames.filter((n) => n.endsWith(".user.js")).map((n) => {
          const baseName = n.replace(/\.user\.js$/, "");
          const displayName = baseName.replace(
            /^scripts\//,
            ""
          );
          let scriptId = null;
          const optionsFileData = unzipped[`${baseName}.options.json`];
          if (optionsFileData) {
            try {
              const optionsData = JSON.parse(
                fflate.strFromU8(optionsFileData)
              );
              scriptId = typeof optionsData.scriptId === "string" ? optionsData.scriptId : null;
              const name = optionsData.meta?.name || displayName;
              const namespace = optionsData.meta?.namespace || "";
              if (optionsData.meta?.name) {
                return {
                  id: scriptId || (namespace ? `${name}::${namespace}` : name),
                  name,
                  namespace,
                  hasStorage: !!unzipped[`${baseName}.storage.json`]
                };
              }
            } catch (_) {
            }
          }
          return {
            id: scriptId || displayName,
            name: displayName,
            hasStorage: !!unzipped[`${baseName}.storage.json`]
          };
        });
        const scriptsWithStorageCount = scripts.filter((script) => script.hasStorage).length;
        return {
          scriptCount: scripts.length,
          scripts,
          scriptsWithStorageCount,
          hasGlobalSettings: !!unzipped["global-settings.json"],
          settingsKeyCount: countEntries(globalSettings),
          hasFolders: !!unzipped["folders.json"],
          folderCount: countEntries(folderData),
          folders: folderList.map((folder) => {
            const value = folder && typeof folder === "object" ? folder : {};
            return {
              id: typeof value.id === "string" ? value.id : "",
              name: typeof value.name === "string" ? value.name : "Unnamed folder",
              scriptCount: Array.isArray(value.scriptIds) ? value.scriptIds.length : 0
            };
          }),
          hasWorkspaces: !!unzipped["workspaces.json"],
          workspaceCount: workspaceList.length,
          workspaces: workspaceList.map((workspace) => {
            const value = workspace && typeof workspace === "object" ? workspace : {};
            return {
              id: typeof value.id === "string" ? value.id : "",
              name: typeof value.name === "string" ? value.name : "Unnamed workspace",
              scriptCount: value.snapshot && typeof value.snapshot === "object" ? Object.keys(value.snapshot).length : 0,
              active: !Array.isArray(workspaceData) && workspaceData?.active === value.id
            };
          }),
          activeWorkspaceId: !Array.isArray(workspaceData) && typeof workspaceData?.active === "string" ? workspaceData.active : null
        };
      } catch (err) {
        console.error("[BackupScheduler] inspectBackup error:", err);
        return null;
      }
    },
    /**
     * Verify a backup without mutating current scripts.
     */
    async verifyBackup(backupId, opts = {}) {
      const backups = await _getBackupList();
      const backup = backups.find(
        (b) => b.id === backupId
      );
      if (!backup) return null;
      const parseUserscript = typeof opts.parseUserscript === "function" ? opts.parseUserscript : null;
      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        const installedIdSet = /* @__PURE__ */ new Set();
        try {
          const existing = await ScriptStorage.getAll();
          for (const script of existing) {
            if (script && typeof script.id === "string") {
              installedIdSet.add(script.id);
            }
          }
        } catch (_) {
        }
        const issues = [];
        let parseErrorCount = 0;
        let optionsParseErrors = 0;
        let storageParseErrors = 0;
        let unreadableFileCount = 0;
        let missingOptionsCount = 0;
        const missingStorageCount = 0;
        const scriptEntries = fileNames.filter((n) => n.endsWith(".user.js")).map((filename) => {
          const baseName = filename.replace(/\.user\.js$/, "");
          const displayName = baseName.replace(/^scripts\//, "");
          const optionsKey = `${baseName}.options.json`;
          const storageKey = `${baseName}.storage.json`;
          const scriptData = unzipped[filename];
          const optionsDataBytes = unzipped[optionsKey];
          const storageDataBytes = unzipped[storageKey];
          const hasOptions = !!optionsDataBytes;
          const hasStorage = !!storageDataBytes;
          let code = "";
          try {
            if (!scriptData) throw new Error("Missing script data");
            code = fflate.strFromU8(scriptData);
          } catch (readErr) {
            unreadableFileCount++;
            const error = readErr instanceof Error ? readErr.message : String(readErr);
            issues.push({ kind: "unreadable-script", file: filename, error });
            return {
              filename,
              name: displayName,
              namespace: "",
              hasOptions,
              hasStorage,
              parseError: error
            };
          }
          let optionsData = null;
          if (hasOptions && optionsDataBytes) {
            try {
              optionsData = JSON.parse(
                fflate.strFromU8(optionsDataBytes)
              );
            } catch (optErr) {
              optionsParseErrors++;
              issues.push({
                kind: "options-parse",
                file: optionsKey,
                error: optErr instanceof Error ? optErr.message : String(optErr)
              });
            }
          } else {
            missingOptionsCount++;
          }
          if (hasStorage && storageDataBytes) {
            try {
              JSON.parse(fflate.strFromU8(storageDataBytes));
            } catch (stErr) {
              storageParseErrors++;
              issues.push({
                kind: "storage-parse",
                file: storageKey,
                error: stErr instanceof Error ? stErr.message : String(stErr)
              });
            }
          }
          let parseError = "";
          const rawMeta = optionsData?.["meta"] && typeof optionsData["meta"] === "object" ? optionsData["meta"] : {};
          let parsedMeta = rawMeta;
          if (parseUserscript) {
            const parsed = parseUserscript(code);
            if (parsed?.error) {
              parseError = parsed.error;
              parseErrorCount++;
              issues.push({
                kind: "script-parse",
                file: filename,
                error: parsed.error
              });
            } else if (parsed?.meta) {
              parsedMeta = parsed.meta;
            }
          } else if (!/==UserScript==/.test(code)) {
            parseError = "Missing ==UserScript== header";
            parseErrorCount++;
            issues.push({ kind: "script-parse", file: filename, error: parseError });
          }
          const scriptId = typeof optionsData?.["scriptId"] === "string" ? optionsData["scriptId"] : "";
          const name = typeof parsedMeta["name"] === "string" ? parsedMeta["name"] : displayName;
          const namespace = typeof parsedMeta["namespace"] === "string" ? parsedMeta["namespace"] : "";
          return {
            filename,
            name,
            namespace,
            hasOptions,
            hasStorage,
            parseError: parseError || void 0,
            scriptId: scriptId || void 0,
            conflictsWithId: scriptId && installedIdSet.has(scriptId) ? scriptId : void 0
          };
        });
        let globalSettingsValid = true;
        let foldersValid = true;
        let workspacesValid = true;
        if (unzipped["global-settings.json"]) {
          try {
            JSON.parse(fflate.strFromU8(unzipped["global-settings.json"]));
          } catch (err) {
            globalSettingsValid = false;
            issues.push({
              kind: "global-settings-parse",
              file: "global-settings.json",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (unzipped["folders.json"]) {
          try {
            JSON.parse(fflate.strFromU8(unzipped["folders.json"]));
          } catch (err) {
            foldersValid = false;
            issues.push({
              kind: "folders-parse",
              file: "folders.json",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (unzipped["workspaces.json"]) {
          try {
            JSON.parse(fflate.strFromU8(unzipped["workspaces.json"]));
          } catch (err) {
            workspacesValid = false;
            issues.push({
              kind: "workspaces-parse",
              file: "workspaces.json",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        const validScripts = scriptEntries.filter((s) => !s.parseError).length;
        const valid = issues.length === 0;
        return {
          valid,
          scripts: scriptEntries,
          parseErrorCount,
          missingOptionsCount,
          missingStorageCount,
          unreadableFileCount,
          summary: {
            scriptCount: scriptEntries.length,
            validScripts,
            parseErrors: parseErrorCount,
            optionsParseErrors,
            storageParseErrors,
            globalSettingsValid,
            foldersValid,
            workspacesValid
          },
          issues
        };
      } catch (err) {
        console.error("[BackupScheduler] verifyBackup error:", err);
        return {
          valid: false,
          scripts: [],
          parseErrorCount: 0,
          missingOptionsCount: 0,
          missingStorageCount: 0,
          unreadableFileCount: 0,
          summary: {
            scriptCount: 0,
            validScripts: 0,
            parseErrors: 0,
            optionsParseErrors: 0,
            storageParseErrors: 0,
            globalSettingsValid: false,
            foldersValid: false,
            workspacesValid: false
          },
          issues: [{
            kind: "archive",
            file: backupId,
            error: err instanceof Error ? err.message : String(err)
          }]
        };
      }
    },
    /**
     * List persisted restore/import receipts (metadata only, no snapshot blob).
     */
    async listReceipts() {
      const receipts = await _getReceipts();
      return receipts.map(_snapshotMeta).filter((meta) => !!meta);
    },
    /**
     * Fetch a single receipt with its full snapshot blob.
     */
    async getReceipt(receiptId) {
      const receipts = await _getReceipts();
      return receipts.find((receipt) => receipt?.id === receiptId) ?? null;
    },
    /**
     * Record an import receipt in the same registry as restore receipts.
     */
    async recordReceipt(receipt) {
      if (!receipt || typeof receipt !== "object") return null;
      const snapshot = receipt.snapshot ?? {
        scriptsBefore: [],
        valuesBefore: {},
        scriptIdsBefore: []
      };
      const next = {
        id: receipt.id || _generateId(),
        timestamp: receipt.timestamp || Date.now(),
        type: receipt.type || "import",
        source: receipt.source || "import",
        sourceLabel: receipt.sourceLabel || "",
        backupId: receipt.backupId || null,
        result: receipt.result || null,
        snapshot
      };
      await _pushReceipt(next);
      return _snapshotMeta(next);
    },
    /**
     * Roll a restore or import receipt back.
     */
    async rollbackRestoreReceipt(receiptId, opts = {}) {
      const receipts = await _getReceipts();
      const receipt = receipts.find((r) => r?.id === receiptId);
      if (!receipt) return { success: false, error: "Receipt not found" };
      if (receipt.rolledBackAt) {
        return {
          success: false,
          error: "Receipt already rolled back",
          alreadyRolledBack: true,
          rolledBackAt: receipt.rolledBackAt
        };
      }
      const snapshot = receipt.snapshot ?? {
        scriptsBefore: [],
        valuesBefore: {},
        scriptIdsBefore: []
      };
      const scriptsBefore = Array.isArray(snapshot.scriptsBefore) ? snapshot.scriptsBefore : [];
      const valuesBefore = snapshot.valuesBefore && typeof snapshot.valuesBefore === "object" ? snapshot.valuesBefore : {};
      const restoreGlobals = opts.restoreGlobals !== false;
      const errors = [];
      let restoredScripts = 0;
      let removedScripts = 0;
      let restoredValues = 0;
      const restoredScriptIds = [];
      for (const script of scriptsBefore) {
        if (!script || typeof script.id !== "string") continue;
        try {
          await ScriptStorage.set(script.id, structuredClone(script));
          restoredScriptIds.push(script.id);
          restoredScripts++;
        } catch (err) {
          errors.push({
            kind: "script",
            name: script.meta?.name || script.id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      for (const [scriptId, values] of Object.entries(valuesBefore)) {
        if (typeof ScriptValues === "undefined" || !ScriptValues || typeof ScriptValues.setAll !== "function") {
          break;
        }
        try {
          if (typeof ScriptValues.deleteAll === "function") {
            await ScriptValues.deleteAll(scriptId);
          }
          await ScriptValues.setAll(scriptId, values);
          restoredValues++;
        } catch (err) {
          errors.push({
            kind: "values",
            name: scriptId,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      const beforeIdSet = new Set(
        Array.isArray(snapshot.scriptIdsBefore) ? snapshot.scriptIdsBefore : []
      );
      let scriptIdsAfter = [];
      try {
        const after = await ScriptStorage.getAll();
        scriptIdsAfter = after.map((script) => script.id).filter((id) => typeof id === "string");
      } catch (err) {
        errors.push({
          kind: "getAll",
          error: err instanceof Error ? err.message : String(err)
        });
      }
      const addedFromSnapshot = Array.isArray(snapshot.addedScriptIds) ? snapshot.addedScriptIds : null;
      const toDelete = addedFromSnapshot ? addedFromSnapshot.filter((id) => scriptIdsAfter.includes(id)) : scriptIdsAfter.filter((id) => !beforeIdSet.has(id));
      for (const id of toDelete) {
        try {
          if (typeof ScriptValues !== "undefined" && ScriptValues && typeof ScriptValues.deleteAll === "function") {
            try {
              await ScriptValues.deleteAll(id);
            } catch (_) {
            }
          }
          await ScriptStorage.delete(id);
          removedScripts++;
        } catch (err) {
          errors.push({
            kind: "script-delete",
            name: id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      let restoredSettings = false;
      let restoredFolders = false;
      let restoredWorkspaces = false;
      if (restoreGlobals) {
        if (snapshot.settings !== void 0) {
          try {
            await SettingsManager.set(structuredClone(snapshot.settings));
            restoredSettings = true;
          } catch (err) {
            errors.push({
              kind: "settings",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (snapshot.folders !== void 0) {
          try {
            await chrome.storage.local.set({
              scriptFolders: structuredClone(snapshot.folders)
            });
            if (typeof FolderStorage !== "undefined" && FolderStorage) {
              FolderStorage.cache = null;
            }
            restoredFolders = true;
          } catch (err) {
            errors.push({
              kind: "folders",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        if (snapshot.workspaces !== void 0) {
          try {
            await chrome.storage.local.set({
              workspaces: structuredClone(snapshot.workspaces)
            });
            if (typeof WorkspaceManager !== "undefined" && WorkspaceManager) {
              WorkspaceManager._cache = null;
              WorkspaceManager._initPromise = null;
            }
            restoredWorkspaces = true;
          } catch (err) {
            errors.push({
              kind: "workspaces",
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }
      const rollbackResult = {
        receiptId,
        restoredScripts,
        removedScripts,
        restoredValues,
        restoredSettings,
        restoredFolders,
        restoredWorkspaces,
        errors,
        restoredScriptIds,
        removedScriptIds: toDelete
      };
      const success = errors.length === 0;
      await _updateReceipt(receiptId, {
        rolledBackAt: Date.now(),
        rollbackError: success ? null : errors.map((error) => `${error.kind}: ${error.error}`).join("; "),
        rollbackResult: { ...rollbackResult, success }
      });
      return { success, ...rollbackResult };
    },
    /** Clear all persisted receipts. */
    async clearReceipts() {
      await _saveReceipts([]);
      return { success: true };
    }
  };
  var backup_scheduler_default = BackupScheduler;
  return module.exports.default || module.exports.BackupScheduler || module.exports;
})();

// ============================================================================
// Generated from src/modules/userstyles.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const UserStylesEngine = (() => {
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

  // src/modules/userstyles.ts
  var userstyles_exports = {};
  __export(userstyles_exports, {
    UserStylesEngine: () => UserStylesEngine
  });
  module.exports = __toCommonJS(userstyles_exports);
  var STORAGE_KEY = "sv_userstyles";
  var VARS_STORAGE_KEY = "sv_userstyle_vars";
  var META_REGEX = /\/\*\s*==UserStyle==\s*([\s\S]*?)==\/UserStyle==\s*\*\//;
  var VAR_TYPES = ["color", "text", "number", "select", "checkbox", "range"];
  var DIRECTIVE_REGEX = /^@(\S+)\s+(.*?)\s*$/;
  var _styles = {};
  var _customVars = {};
  var _initialized = false;
  var _registeredTabs = /* @__PURE__ */ new Map();
  var _injectingTabs = /* @__PURE__ */ new Set();
  async function _loadState() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, VARS_STORAGE_KEY]);
      _styles = data[STORAGE_KEY] ?? {};
      _customVars = data[VARS_STORAGE_KEY] ?? {};
    } catch (e) {
      console.error("[UserStylesEngine] Failed to load state:", e);
      _styles = {};
      _customVars = {};
    }
  }
  async function _saveStyles() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _styles });
    } catch (e) {
      console.error("[UserStylesEngine] Failed to save styles:", e);
    }
  }
  async function _saveVars() {
    try {
      await chrome.storage.local.set({ [VARS_STORAGE_KEY]: _customVars });
    } catch (e) {
      console.error("[UserStylesEngine] Failed to save variables:", e);
    }
  }
  function _parseVarDirective(type, rest) {
    const nameMatch = rest.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);
    if (!nameMatch) {
      const simpleMatch = rest.match(/^(\S+)\s+(.*)$/);
      if (!simpleMatch) return null;
      return {
        type,
        name: simpleMatch[1] ?? "",
        label: simpleMatch[1] ?? "",
        default: (simpleMatch[2] ?? "").trim(),
        options: null
      };
    }
    const varName = nameMatch[1] ?? "";
    const label = nameMatch[2] ?? "";
    let defaultVal = (nameMatch[3] ?? "").trim();
    let options = null;
    switch (type) {
      case "color":
        break;
      case "text":
        if (/^".*"$/.test(defaultVal)) {
          defaultVal = defaultVal.slice(1, -1);
        }
        break;
      case "number":
        defaultVal = parseFloat(defaultVal) || 0;
        break;
      case "checkbox":
        defaultVal = defaultVal === "1" || defaultVal === "true";
        break;
      case "select": {
        const braceMatch = defaultVal.match(/^\{([\s\S]*)\}$/);
        if (braceMatch) {
          const inner = braceMatch[1] ?? "";
          try {
            const parsed = JSON.parse(`{${inner}}`);
            options = parsed;
            defaultVal = Object.keys(parsed)[0] ?? "";
          } catch {
            const pairs = inner.split("|");
            let firstKey = null;
            const selectOptions = {};
            for (const pair of pairs) {
              const kv = pair.match(/^"?([^":]+)"?\s*:\s*"?([^"|]*)"?\s*$/);
              if (kv) {
                const key = (kv[1] ?? "").trim();
                const val = (kv[2] ?? "").trim();
                selectOptions[key] = val;
                if (!firstKey) firstKey = key;
              }
            }
            options = selectOptions;
            defaultVal = firstKey ?? "";
          }
        }
        break;
      }
      case "range": {
        const arrMatch = defaultVal.match(/^\[([\s\S]*)\]$/);
        if (arrMatch) {
          const parts = (arrMatch[1] ?? "").split(",").map((s) => parseFloat(s.trim()));
          options = {
            min: parts[0] ?? 0,
            max: parts[1] ?? 100,
            step: parts[2] ?? 1
          };
          defaultVal = parts[3] ?? parts[0] ?? 0;
        } else {
          defaultVal = parseFloat(defaultVal) || 0;
          options = { min: 0, max: 100, step: 1 };
        }
        break;
      }
    }
    return { type, name: varName, label, default: defaultVal, options };
  }
  function parseUserCSS(code) {
    const metaMatch = code.match(META_REGEX);
    if (!metaMatch) {
      return { error: "No ==UserStyle== metadata block found." };
    }
    const meta = {
      name: "Unnamed Style",
      namespace: "scriptvault",
      version: "1.0.0",
      description: "",
      author: "",
      license: "",
      preprocessor: "default",
      homepageURL: "",
      supportURL: "",
      updateURL: ""
    };
    const variables = [];
    const matchPatterns = [];
    const metaBlock = metaMatch[1] ?? "";
    const lines = metaBlock.split("\n");
    for (const line of lines) {
      const trimmed = line.replace(/^\s*\*?\s*/, "").trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      const match = trimmed.match(DIRECTIVE_REGEX);
      if (!match) continue;
      const key = match[1] ?? "";
      const value = match[2] ?? "";
      if (key === "var") {
        const varTypeMatch = value.match(/^(\S+)\s+([\s\S]+)$/);
        if (varTypeMatch && VAR_TYPES.includes(varTypeMatch[1])) {
          const parsed = _parseVarDirective(varTypeMatch[1], varTypeMatch[2] ?? "");
          if (parsed) variables.push(parsed);
        }
      } else if (key === "match" && value) {
        matchPatterns.push(value);
      } else if (key in meta) {
        meta[key] = value;
      }
    }
    const metaEnd = code.indexOf("==/UserStyle==");
    const afterMeta = code.indexOf("*/", metaEnd);
    let css = "";
    if (afterMeta !== -1) {
      css = code.substring(afterMeta + 2).trim();
    }
    return {
      meta,
      variables,
      match: matchPatterns.length ? matchPatterns : ["*://*/*"],
      css
    };
  }
  function _substituteVariables(css, variables, customValues) {
    let result = css;
    for (const v of variables) {
      const val = customValues && customValues[v.name] !== void 0 ? customValues[v.name] : v.default;
      const placeholder = new RegExp(
        "/\\*\\[\\[" + _escapeRegex(v.name) + "\\]\\]\\*/",
        "g"
      );
      result = result.replace(placeholder, String(val));
      const anglePlaceholder = new RegExp(
        "<<" + _escapeRegex(v.name) + ">>",
        "g"
      );
      result = result.replace(anglePlaceholder, String(val));
    }
    return result;
  }
  function _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function _buildCSS(styleId) {
    const style = _styles[styleId];
    if (!style) return "";
    const vars = style.variables ?? [];
    const custom = _customVars[styleId] ?? {};
    return _substituteVariables(style.css, vars, custom);
  }
  async function registerStyle(style) {
    if (!_initialized) await _loadState();
    const id = style.id ?? `usercss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      type: "usercss",
      meta: style.meta ?? {},
      variables: style.variables ?? [],
      css: style.css ?? "",
      rawCode: style.rawCode ?? "",
      enabled: style.enabled !== false,
      match: style.match ?? ["*://*/*"],
      installDate: style.installDate ?? Date.now(),
      updateDate: Date.now()
    };
    _styles[id] = entry;
    await _saveStyles();
    if (entry.enabled) {
      await _injectStyleToMatchingTabs(id);
    }
    return id;
  }
  async function unregisterStyle(styleId) {
    if (!_initialized) await _loadState();
    await _removeStyleFromAllTabs(styleId);
    delete _styles[styleId];
    delete _customVars[styleId];
    await Promise.all([_saveStyles(), _saveVars()]);
  }
  async function toggleStyle(styleId, enabled) {
    if (!_initialized) await _loadState();
    const style = _styles[styleId];
    if (!style) return;
    style.enabled = enabled;
    await _saveStyles();
    if (enabled) {
      await _injectStyleToMatchingTabs(styleId);
    } else {
      await _removeStyleFromAllTabs(styleId);
    }
  }
  async function _injectStyleToMatchingTabs(styleId) {
    const style = _styles[styleId];
    if (!style?.enabled) return;
    const css = _buildCSS(styleId);
    if (!css) return;
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id == null) continue;
        if (_urlMatchesPatterns(tab.url, style.match)) {
          const tabStyles = _registeredTabs.get(tab.id) ?? /* @__PURE__ */ new Map();
          const previousCss = tabStyles.get(styleId);
          try {
            if (previousCss && previousCss !== css) {
              try {
                await chrome.scripting.removeCSS({
                  target: { tabId: tab.id },
                  css: previousCss
                });
              } catch {
              }
            }
            await chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              css
            });
            tabStyles.set(styleId, css);
            _registeredTabs.set(tab.id, tabStyles);
          } catch {
          }
        }
      }
    } catch (e) {
      console.error("[UserStylesEngine] Inject failed:", e);
    }
  }
  async function _removeStyleFromAllTabs(styleId) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id == null) continue;
        const tabStyles = _registeredTabs.get(tab.id);
        if (!tabStyles) continue;
        const registeredCss = tabStyles.get(styleId);
        if (registeredCss) {
          try {
            await chrome.scripting.removeCSS({
              target: { tabId: tab.id },
              css: registeredCss
            });
            tabStyles.delete(styleId);
            if (tabStyles.size === 0) {
              _registeredTabs.delete(tab.id);
            }
          } catch {
          }
        }
      }
    } catch (e) {
      console.error("[UserStylesEngine] Remove failed:", e);
    }
  }
  function _urlMatchesPatterns(url, patterns) {
    if (!url || !patterns || patterns.length === 0) return false;
    for (const pattern of patterns) {
      if (pattern === "*://*/*" || pattern === "<all_urls>") return true;
      try {
        const regex = _matchPatternToRegex(pattern);
        if (regex.test(url)) return true;
      } catch {
        if (_globMatch(url, pattern)) return true;
      }
    }
    return false;
  }
  function _matchPatternToRegex(pattern) {
    const match = pattern.match(/^(\*|http|https|file|ftp):\/\/([^/]*)(\/.*)$/);
    if (!match) {
      throw new Error(`Invalid match pattern: ${pattern}`);
    }
    const scheme = match[1] ?? "";
    const host = match[2] ?? "";
    const path = match[3] ?? "";
    const schemeRegex = scheme === "*" ? "https?" : _escapeRegex(scheme);
    let hostRegex = "";
    if (scheme !== "file") {
      if (host === "*") {
        hostRegex = "[^/]+";
      } else if (host.startsWith("*.")) {
        hostRegex = `(?:[^/]+\\.)*${_escapeRegex(host.slice(2))}`;
      } else {
        hostRegex = _escapeRegex(host);
      }
    }
    const pathRegex = path.split("*").map((segment) => _escapeRegex(segment)).join(".*");
    return new RegExp(`^${schemeRegex}:\\/\\/${hostRegex}${pathRegex}$`);
  }
  function _globMatch(url, glob) {
    const regex = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp("^" + regex + "$").test(url);
  }
  function getVariables(styleId) {
    const style = _styles[styleId];
    if (!style) return null;
    const custom = _customVars[styleId] ?? {};
    return (style.variables ?? []).map((v) => ({
      ...v,
      current: custom[v.name] !== void 0 ? custom[v.name] : v.default
    }));
  }
  async function setVariables(styleId, values) {
    if (!_initialized) await _loadState();
    const style = _styles[styleId];
    if (!style) return;
    if (!_customVars[styleId]) _customVars[styleId] = {};
    for (const [key, val] of Object.entries(values)) {
      _customVars[styleId][key] = val;
    }
    await _saveVars();
    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }
  function convertToUserscript(usercssCode) {
    const parsed = parseUserCSS(usercssCode);
    if (parsed.error) return { error: parsed.error };
    const meta = parsed.meta;
    const variables = parsed.variables;
    const matchPatterns = parsed.match ?? ["*://*/*"];
    const css = parsed.css;
    const defaults = {};
    for (const v of variables) {
      defaults[v.name] = v.default;
    }
    const finalCSS = _substituteVariables(css, variables, defaults);
    const escapedCSS = finalCSS.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
    const matchDirectives = matchPatterns.map((pattern) => `// @match        ${pattern}`);
    const grantDirective = "// @grant        GM_addStyle";
    const script = [
      "// ==UserScript==",
      `// @name         ${meta.name}`,
      `// @namespace    ${meta.namespace}`,
      `// @version      ${meta.version}`,
      `// @description  ${meta.description}`,
      `// @author       ${meta.author}`,
      ...matchDirectives,
      grantDirective,
      "// @run-at       document-start",
      "// ==/UserScript==",
      "",
      "(function () {",
      "  'use strict';",
      "",
      "  const css = `",
      escapedCSS,
      "  `;",
      "",
      "  if (typeof GM_addStyle === 'function') {",
      "    GM_addStyle(css);",
      "  } else {",
      "    const style = document.createElement('style');",
      "    style.textContent = css;",
      "    (document.head || document.documentElement).appendChild(style);",
      "  }",
      "})();"
    ].join("\n");
    return { script, meta };
  }
  async function importStylusBackup(json) {
    if (!_initialized) await _loadState();
    let stylusStyles;
    try {
      const parsed = typeof json === "string" ? JSON.parse(json) : json;
      stylusStyles = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { imported: 0, errors: ["Invalid JSON: " + message] };
    }
    let imported = 0;
    const errors = [];
    for (const sStyle of stylusStyles) {
      try {
        const style = _convertStylusStyle(sStyle);
        if (style) {
          await registerStyle(style);
          imported++;
        } else {
          errors.push(`Skipped style: ${sStyle.name ?? "unknown"} (no usable sections)`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`Failed to import "${sStyle.name ?? "unknown"}": ${message}`);
      }
    }
    return { imported, errors };
  }
  function _convertStylusStyle(sStyle) {
    if (!sStyle.sections || sStyle.sections.length === 0) return null;
    const cssParts = [];
    const matchPatterns = /* @__PURE__ */ new Set();
    for (const section of sStyle.sections) {
      const sectionCSS = section.code ?? "";
      if (section.urls && section.urls.length) {
        for (const url of section.urls) {
          matchPatterns.add(_urlToMatchPattern(url));
        }
      }
      if (section.urlPrefixes && section.urlPrefixes.length) {
        for (const prefix of section.urlPrefixes) {
          matchPatterns.add(_urlPrefixToMatchPattern(prefix));
        }
      }
      if (section.domains && section.domains.length) {
        for (const domain of section.domains) {
          matchPatterns.add(`*://${domain}/*`);
          matchPatterns.add(`*://*.${domain}/*`);
        }
      }
      if (section.regexps && section.regexps.length) {
        matchPatterns.add("*://*/*");
      }
      if (!section.urls?.length && !section.urlPrefixes?.length && !section.domains?.length && !section.regexps?.length) {
        matchPatterns.add("*://*/*");
      }
      cssParts.push(sectionCSS);
    }
    const match = [...matchPatterns];
    if (match.length === 0) match.push("*://*/*");
    return {
      meta: {
        name: sStyle.name ?? "Imported Style",
        namespace: "stylus-import",
        version: "1.0.0",
        description: `Imported from Stylus on ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`,
        author: sStyle.author ?? "",
        license: "",
        preprocessor: "default",
        homepageURL: "",
        supportURL: "",
        updateURL: ""
      },
      variables: [],
      css: cssParts.join("\n\n"),
      rawCode: "",
      match,
      enabled: sStyle.enabled !== false,
      installDate: sStyle.installDate ?? Date.now()
    };
  }
  function _urlToMatchPattern(url) {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch {
      return "*://*/*";
    }
  }
  function _urlPrefixToMatchPattern(prefix) {
    try {
      const u = new URL(prefix);
      return `${u.protocol}//${u.hostname}${u.pathname}*`;
    } catch {
      return "*://*/*";
    }
  }
  function isUserCSSUrl(url) {
    if (!url) return false;
    try {
      const pathname = new URL(url).pathname;
      return pathname.endsWith(".user.css");
    } catch {
      return false;
    }
  }
  async function onTabUpdated(tabId, url) {
    if (!url) return;
    if (_injectingTabs.has(tabId)) return;
    _injectingTabs.add(tabId);
    try {
      if (!_initialized) await _loadState();
      for (const [styleId, style] of Object.entries(_styles)) {
        if (!style.enabled) continue;
        if (!_urlMatchesPatterns(url, style.match)) continue;
        const css = _buildCSS(styleId);
        if (!css) continue;
        try {
          const tabStyles = _registeredTabs.get(tabId) ?? /* @__PURE__ */ new Map();
          const previousCss = tabStyles.get(styleId);
          if (previousCss && previousCss !== css) {
            try {
              await chrome.scripting.removeCSS({
                target: { tabId },
                css: previousCss
              });
            } catch {
            }
          }
          await chrome.scripting.insertCSS({
            target: { tabId },
            css
          });
          tabStyles.set(styleId, css);
          _registeredTabs.set(tabId, tabStyles);
        } catch {
        }
      }
    } finally {
      _injectingTabs.delete(tabId);
    }
  }
  function onTabRemoved(tabId) {
    _registeredTabs.delete(tabId);
  }
  async function init() {
    if (_initialized) return;
    await _loadState();
    _initialized = true;
  }
  function getStyles() {
    return { ..._styles };
  }
  function getStyle(styleId) {
    return _styles[styleId] ?? null;
  }
  async function updateCSS(styleId, newCSS) {
    if (!_initialized) await _loadState();
    const style = _styles[styleId];
    if (!style) return;
    if (META_REGEX.test(newCSS)) {
      const parsed = parseUserCSS(newCSS);
      if (!parsed.error) {
        style.meta = parsed.meta;
        style.variables = parsed.variables;
        style.match = parsed.match;
        style.css = parsed.css;
        style.rawCode = newCSS;
      }
    } else {
      style.css = newCSS;
    }
    style.updateDate = Date.now();
    await _saveStyles();
    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }
  var UserStylesEngine = {
    init,
    parseUserCSS,
    registerStyle,
    unregisterStyle,
    toggleStyle,
    getVariables,
    setVariables,
    getStyles,
    getStyle,
    updateCSS,
    convertToUserscript,
    importStylusBackup,
    isUserCSSUrl,
    onTabUpdated,
    onTabRemoved
  };
  return module.exports.default || module.exports.UserStylesEngine || module.exports;
})();

// ============================================================================
// Generated from src/modules/public-api.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const PublicAPI = (() => {
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

  // src/modules/public-api.ts
  var public_api_exports = {};
  __export(public_api_exports, {
    PublicAPI: () => PublicAPI,
    default: () => public_api_default
  });
  module.exports = __toCommonJS(public_api_exports);
  var API_VERSION = "1.0.0";
  var STORAGE_KEY_PERMS = "publicapi_permissions";
  var STORAGE_KEY_AUDIT = "publicapi_audit";
  var STORAGE_KEY_WEBHOOKS = "publicapi_webhooks";
  var STORAGE_KEY_ORIGINS = "publicapi_trusted_origins";
  var MAX_AUDIT_ENTRIES = 500;
  var RATE_LIMIT_WINDOW = 1e3;
  var RATE_LIMIT_MAX = 10;
  var RATE_LIMIT_SENDER_CAP = 200;
  var MAX_TRUSTED_ORIGINS = 128;
  var MAX_TRUSTED_ORIGIN_LENGTH = 256;
  var _permissions = null;
  var _auditLog = [];
  var _webhooks = {};
  var _trustedOrigins = [];
  var _initialized = false;
  var _initPromise = null;
  var _rateLimitMap = /* @__PURE__ */ new Map();
  var MAX_CODE_SIZE = 5 * 1024 * 1024;
  var MAX_FETCH_SIZE = 5 * 1024 * 1024;
  var FETCH_TIMEOUT_MS = 15e3;
  var WEBHOOK_TIMEOUT_MS = 1e4;
  var SCRIPT_SIZE_ERROR = "Script file exceeds maximum allowed size (5 MB)";
  function getRuntimeHooks() {
    return globalThis;
  }
  function isInternalIPv4(ip) {
    const parts = ip.split(".").map((part) => parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
      return true;
    }
    const [a, b, c, d] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (!rawHost || typeof rawHost !== "string") return true;
    let host = rawHost.toLowerCase();
    if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
    if (host === "localhost" || host === "localhost.localdomain" || host === "ip6-localhost" || host === "ip6-loopback") {
      return true;
    }
    if (host.includes(":")) {
      if (host === "::1" || host === "::" || host === "::0" || host === "0:0:0:0:0:0:0:0" || host === "0:0:0:0:0:0:0:1") {
        return true;
      }
      if (/^fe[89ab][0-9a-f]?:/.test(host)) return true;
      if (/^f[cd][0-9a-f]{0,2}:/.test(host)) return true;
      const v4Mapped = host.match(/^::ffff:([0-9.]+)$/);
      return v4Mapped ? isInternalIPv4(v4Mapped[1]) : false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return isInternalIPv4(host);
    }
    return false;
  }
  function normalizeTrustedOrigin(origin) {
    if (typeof origin !== "string") throw new Error("Trusted origin must be a string");
    const trimmed = origin.trim();
    if (!trimmed) throw new Error("Trusted origin cannot be empty");
    if (trimmed === "*") throw new Error("Wildcard trusted origins are not allowed");
    if (trimmed.length > MAX_TRUSTED_ORIGIN_LENGTH) throw new Error("Trusted origin is too long");
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error("Trusted origin is malformed");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Trusted origin must use https://");
    }
    if (!parsed.hostname || isInternalHost(parsed.hostname)) {
      throw new Error("Trusted origin points at an internal/loopback host");
    }
    return parsed.origin;
  }
  function normalizeTrustedOrigins(origins) {
    if (!Array.isArray(origins)) return [];
    if (origins.length > MAX_TRUSTED_ORIGINS) {
      throw new Error(`Too many trusted origins; maximum is ${MAX_TRUSTED_ORIGINS}`);
    }
    const normalized = [];
    const seen = /* @__PURE__ */ new Set();
    for (const origin of origins) {
      const value = normalizeTrustedOrigin(origin);
      if (!seen.has(value)) {
        seen.add(value);
        normalized.push(value);
      }
    }
    return normalized;
  }
  function normalizeStoredTrustedOrigins(origins) {
    if (!Array.isArray(origins)) return [];
    const normalized = [];
    const seen = /* @__PURE__ */ new Set();
    for (const origin of origins.slice(0, MAX_TRUSTED_ORIGINS)) {
      try {
        const value = normalizeTrustedOrigin(origin);
        if (!seen.has(value)) {
          seen.add(value);
          normalized.push(value);
        }
      } catch {
      }
    }
    return normalized;
  }
  function normalizeIncomingOrigin(origin) {
    try {
      return normalizeTrustedOrigin(origin);
    } catch {
      return null;
    }
  }
  function validateWebInstallUrl(url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return "Invalid URL";
    }
    if (parsedUrl.protocol !== "https:") {
      return "Only https:// URLs are allowed for script installation";
    }
    if (isInternalHost(parsedUrl.hostname)) {
      return "Internal URLs are not allowed";
    }
    return null;
  }
  function isInternalWebhookUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return "malformed URL";
    }
    const host = parsed.hostname || "";
    if (!host) return "empty hostname";
    if (!isInternalHost(host)) return null;
    if (host === "localhost" || host.endsWith(".localdomain")) return "localhost alias";
    if (host.includes(":")) return "IPv6 loopback/internal";
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "IPv4 private/loopback/CGNAT";
    return "internal host";
  }
  function generateExternalScriptId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  function measuredUtf8Length(text) {
    return new TextEncoder().encode(text).byteLength;
  }
  async function readResponseTextBounded(resp, maxBytes) {
    const contentLength = resp.headers?.get?.("content-length");
    if (contentLength) {
      const declaredBytes = Number.parseInt(contentLength, 10);
      if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
        throw new Error(SCRIPT_SIZE_ERROR);
      }
    }
    const body = resp.body;
    if (body && typeof body.getReader === "function") {
      const reader = body.getReader();
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
          totalBytes += chunk.byteLength;
          if (totalBytes > maxBytes) {
            try {
              await reader.cancel();
            } catch {
            }
            throw new Error(SCRIPT_SIZE_ERROR);
          }
          chunks.push(chunk);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
        }
      }
      const decoder = new TextDecoder();
      let text2 = "";
      for (let i = 0; i < chunks.length; i++) {
        text2 += decoder.decode(chunks[i], { stream: i < chunks.length - 1 });
      }
      text2 += decoder.decode();
      return text2;
    }
    const text = await resp.text();
    if (measuredUtf8Length(text) > maxBytes) {
      throw new Error(SCRIPT_SIZE_ERROR);
    }
    return text;
  }
  var ARRAY_META_KEYS = {
    match: "match",
    include: "include",
    exclude: "exclude",
    "exclude-match": "excludeMatch",
    grant: "grant",
    require: "require",
    "require-provenance": "requireProvenance",
    requireProvenance: "requireProvenance",
    "require-identity": "requireIdentity",
    requireIdentity: "requireIdentity",
    connect: "connect",
    tag: "tag",
    compatible: "compatible",
    incompatible: "incompatible",
    antifeature: "antifeature"
  };
  var BOOLEAN_META_KEYS = /* @__PURE__ */ new Set(["noframes", "unwrap", "top-level-await"]);
  function appendMetaValue(meta, key, value) {
    const values = (key === "requireProvenance" || key === "requireIdentity") && value.includes(",") ? value.split(",").map((part) => part.trim()).filter(Boolean) : [value];
    const current = meta[key];
    if (Array.isArray(current)) {
      current.push(...values);
    } else {
      meta[key] = values;
    }
  }
  var DEFAULT_PERMISSIONS = {
    ping: "allow",
    getVersion: "allow",
    getAPISchema: "allow",
    getInstalledScripts: "allow",
    getScriptStatus: "allow",
    toggleScript: "prompt",
    installScript: "prompt"
  };
  var API_SCHEMA = {
    version: API_VERSION,
    endpoints: {
      ping: {
        description: "Health check. Returns { ok: true, version }.",
        params: null,
        auth: "none",
        rateLimit: true
      },
      getVersion: {
        description: "Return the ScriptVault version string.",
        params: null,
        auth: "none",
        rateLimit: true
      },
      getInstalledScripts: {
        description: "List all installed scripts with name, version, and enabled status.",
        params: null,
        auth: "basic",
        rateLimit: true
      },
      getScriptStatus: {
        description: "Get detailed status for a single script.",
        params: { scriptId: "string \u2014 the script ID" },
        auth: "basic",
        rateLimit: true
      },
      toggleScript: {
        description: "Enable or disable a script. Requires user approval.",
        params: { scriptId: "string", enabled: "boolean" },
        auth: "prompt",
        rateLimit: true
      },
      installScript: {
        description: "Install a new userscript. Requires user approval.",
        params: { code: "string \u2014 full userscript source" },
        auth: "prompt",
        rateLimit: true
      },
      getAPISchema: {
        description: "Return the full API schema (this document).",
        params: null,
        auth: "none",
        rateLimit: false
      }
    },
    webPageEndpoints: {
      "scriptvault:getScripts": {
        description: "Returns list of scripts matching the current page.",
        params: null
      },
      "scriptvault:isInstalled": {
        description: "Check if a script by name is installed.",
        params: { name: "string" }
      },
      "scriptvault:install": {
        description: "Trigger install flow for a script URL.",
        params: { url: "string" }
      }
    },
    webhookEvents: ["script.installed", "script.updated", "script.error", "script.toggled"]
  };
  async function loadState() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEY_PERMS,
        STORAGE_KEY_AUDIT,
        STORAGE_KEY_WEBHOOKS,
        STORAGE_KEY_ORIGINS
      ]);
      _permissions = {
        ...DEFAULT_PERMISSIONS,
        ...result[STORAGE_KEY_PERMS] ?? {}
      };
      _auditLog = result[STORAGE_KEY_AUDIT] ?? [];
      _webhooks = result[STORAGE_KEY_WEBHOOKS] ?? {};
      _trustedOrigins = normalizeStoredTrustedOrigins(result[STORAGE_KEY_ORIGINS]);
    } catch {
      _permissions = { ...DEFAULT_PERMISSIONS };
      _auditLog = [];
      _webhooks = {};
      _trustedOrigins = [];
    }
  }
  async function savePermissions() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_PERMS]: _permissions });
    } catch (e) {
      console.warn("[PublicAPI] save permissions failed:", e);
    }
  }
  async function saveAuditLog() {
    try {
      if (_auditLog.length > MAX_AUDIT_ENTRIES) {
        _auditLog = _auditLog.slice(-MAX_AUDIT_ENTRIES);
      }
      await chrome.storage.local.set({ [STORAGE_KEY_AUDIT]: _auditLog });
    } catch (e) {
      console.warn("[PublicAPI] save audit failed:", e);
    }
  }
  async function saveWebhooks() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_WEBHOOKS]: _webhooks });
    } catch (e) {
      console.warn("[PublicAPI] save webhooks failed:", e);
    }
  }
  async function saveTrustedOrigins() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_ORIGINS]: _trustedOrigins });
    } catch (e) {
      console.warn("[PublicAPI] save origins failed:", e);
    }
  }
  function audit(action, sender, details, result) {
    const entry = {
      timestamp: Date.now(),
      action,
      sender: describeSender(sender),
      details: details ?? null,
      result: result || "ok"
    };
    _auditLog.push(entry);
    void saveAuditLog();
    return entry;
  }
  function describeSender(sender) {
    if (!sender) return "unknown";
    if (sender.id) return `extension:${sender.id}`;
    if (sender.origin) return `origin:${sender.origin}`;
    if (sender.url) return `url:${sender.url}`;
    return "unknown";
  }
  function checkRateLimit(senderId) {
    const now = Date.now();
    let timestamps = _rateLimitMap.get(senderId);
    if (!timestamps) {
      timestamps = [];
      _rateLimitMap.set(senderId, timestamps);
    }
    const cutoff = now - RATE_LIMIT_WINDOW;
    while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return false;
    }
    timestamps.push(now);
    if (_rateLimitMap.size > RATE_LIMIT_SENDER_CAP) {
      for (const [key, values] of _rateLimitMap) {
        if (values.length === 0 || (values[values.length - 1] ?? 0) < cutoff) {
          _rateLimitMap.delete(key);
        }
      }
    }
    return true;
  }
  function getPermission(apiName) {
    return _permissions?.[apiName] ?? "deny";
  }
  async function requestUserApproval(apiName, sender, _details) {
    try {
      if (chrome.notifications) {
        const notifId = `sv-api-approval-${Date.now()}`;
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: "ScriptVault API Request",
          message: `External request: ${apiName} from ${describeSender(sender)}. Pre-approve via settings to allow.`,
          priority: 2
        });
      }
    } catch {
    }
    return false;
  }
  async function authorize(apiName, sender) {
    const perm = getPermission(apiName);
    if (perm === "allow") return true;
    if (perm === "deny") return false;
    if (perm === "prompt") {
      return requestUserApproval(apiName, sender);
    }
    return false;
  }
  async function getScripts() {
    try {
      const store = await getScriptStore();
      return store.scripts;
    } catch {
      return [];
    }
  }
  async function getScriptById(scriptId) {
    const scripts = await getScripts();
    return scripts.find((s) => s.id === scriptId || s.name === scriptId) ?? null;
  }
  function asStringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  }
  function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : void 0;
  }
  function getMetaString(meta, existingMeta, key, fallback = "") {
    const value = meta[key] ?? existingMeta[key];
    return typeof value === "string" ? value : fallback;
  }
  function getMetaArray(meta, existingMeta, key) {
    if (key === "tag") {
      const fromSource = asStringArray(meta[key]);
      const fromExisting = asStringArray(existingMeta[key]);
      if (fromSource.length === 0) return fromExisting;
      const seen = /* @__PURE__ */ new Set();
      const merged = [];
      for (const t of fromSource) {
        if (!seen.has(t)) {
          seen.add(t);
          merged.push(t);
        }
      }
      for (const t of fromExisting) {
        if (!seen.has(t)) {
          seen.add(t);
          merged.push(t);
        }
      }
      return merged;
    }
    return asStringArray(meta[key] ?? existingMeta[key]);
  }
  function getMetaBoolean(meta, existingMeta, key) {
    const value = meta[key] ?? existingMeta[key];
    return value === true;
  }
  function normalizeStoredScript(raw) {
    if (!raw || typeof raw !== "object") return null;
    const script = raw;
    const meta = script.meta && typeof script.meta === "object" ? script.meta : null;
    const id = typeof script.id === "string" ? script.id : "";
    if (!id) return null;
    const matches = asStringArray(script.matches ?? script.match ?? meta?.match ?? meta?.include);
    const runAt = typeof script.runAt === "string" ? script.runAt : typeof meta?.["run-at"] === "string" ? String(meta["run-at"]).replace(/-/g, "_") : "document_idle";
    return {
      id,
      name: typeof script.name === "string" ? script.name : typeof meta?.name === "string" ? String(meta.name) : id,
      version: typeof script.version === "string" ? script.version : typeof meta?.version === "string" ? String(meta.version) : "1.0",
      description: typeof script.description === "string" ? script.description : typeof meta?.description === "string" ? String(meta.description) : "",
      enabled: script.enabled !== false,
      matches,
      match: matches,
      code: typeof script.code === "string" ? script.code : void 0,
      lastModified: asNumber(script.lastModified) ?? asNumber(script.updatedAt),
      runAt,
      installedAt: asNumber(script.installedAt) ?? asNumber(script.createdAt),
      installedBy: typeof script.installedBy === "string" ? script.installedBy : void 0,
      updatedAt: asNumber(script.updatedAt)
    };
  }
  async function getScriptStore() {
    const result = await chrome.storage.local.get("userscripts");
    const raw = result["userscripts"];
    if (Array.isArray(raw)) {
      return {
        mode: "array",
        raw,
        scripts: raw.map(normalizeStoredScript).filter((script) => script !== null)
      };
    }
    if (raw && typeof raw === "object") {
      const record = raw;
      return {
        mode: "record",
        raw: record,
        scripts: Object.values(record).map(normalizeStoredScript).filter((script) => script !== null)
      };
    }
    return {
      mode: "record",
      raw: {},
      scripts: []
    };
  }
  function findArrayScriptIndex(scripts, scriptId) {
    return scripts.findIndex((script) => script.id === scriptId || script.name === scriptId);
  }
  function findRecordScriptEntry(record, scriptId) {
    for (const [key, value] of Object.entries(record)) {
      const normalized = normalizeStoredScript(value);
      if (normalized && (normalized.id === scriptId || normalized.name === scriptId) && value && typeof value === "object") {
        return { key, value };
      }
    }
    return null;
  }
  function createNestedStoredScript(newScript, meta, installedBy, position, existing = null) {
    const existingRecord = existing ?? {};
    const existingMeta = existingRecord.meta && typeof existingRecord.meta === "object" ? existingRecord.meta : {};
    const matches = asStringArray(newScript.matches ?? newScript.match ?? meta.match ?? ["*://*/*"]);
    const resources = meta.resource && typeof meta.resource === "object" ? meta.resource : existingMeta.resource && typeof existingMeta.resource === "object" ? existingMeta.resource : {};
    return {
      ...existingRecord,
      id: newScript.id,
      code: newScript.code ?? (typeof existingRecord.code === "string" ? existingRecord.code : ""),
      enabled: newScript.enabled !== false,
      position: asNumber(existingRecord.position) ?? position,
      meta: {
        ...existingMeta,
        name: newScript.name ?? newScript.id,
        namespace: getMetaString(meta, existingMeta, "namespace"),
        version: newScript.version ?? "1.0",
        description: newScript.description ?? "",
        author: getMetaString(meta, existingMeta, "author"),
        icon: getMetaString(meta, existingMeta, "icon"),
        icon64: getMetaString(meta, existingMeta, "icon64"),
        homepage: getMetaString(meta, existingMeta, "homepage"),
        homepageURL: getMetaString(meta, existingMeta, "homepageURL"),
        website: getMetaString(meta, existingMeta, "website"),
        source: getMetaString(meta, existingMeta, "source"),
        updateURL: getMetaString(meta, existingMeta, "updateURL"),
        downloadURL: getMetaString(meta, existingMeta, "downloadURL"),
        supportURL: getMetaString(meta, existingMeta, "supportURL"),
        license: getMetaString(meta, existingMeta, "license"),
        copyright: getMetaString(meta, existingMeta, "copyright"),
        contributionURL: getMetaString(meta, existingMeta, "contributionURL"),
        match: matches.length > 0 ? matches : ["*://*/*"],
        include: getMetaArray(meta, existingMeta, "include"),
        exclude: getMetaArray(meta, existingMeta, "exclude"),
        excludeMatch: getMetaArray(meta, existingMeta, "excludeMatch"),
        "run-at": (newScript.runAt ?? meta.runAt ?? "document_idle").replace(/_/g, "-"),
        "inject-into": getMetaString(meta, existingMeta, "inject-into", "auto") || "auto",
        noframes: getMetaBoolean(meta, existingMeta, "noframes"),
        unwrap: getMetaBoolean(meta, existingMeta, "unwrap"),
        sandbox: getMetaString(meta, existingMeta, "sandbox"),
        "run-in": getMetaString(meta, existingMeta, "run-in"),
        grant: (() => {
          const grants = getMetaArray(meta, existingMeta, "grant");
          return grants.length > 0 ? grants : ["none"];
        })(),
        require: getMetaArray(meta, existingMeta, "require"),
        requireProvenance: getMetaArray(meta, existingMeta, "requireProvenance"),
        requireIdentity: getMetaArray(meta, existingMeta, "requireIdentity"),
        resource: resources,
        connect: getMetaArray(meta, existingMeta, "connect"),
        "top-level-await": getMetaBoolean(meta, existingMeta, "top-level-await"),
        webRequest: existingMeta.webRequest ?? null,
        priority: asNumber(existingMeta.priority) ?? 0,
        antifeature: getMetaArray(meta, existingMeta, "antifeature"),
        tag: getMetaArray(meta, existingMeta, "tag"),
        compatible: getMetaArray(meta, existingMeta, "compatible"),
        incompatible: getMetaArray(meta, existingMeta, "incompatible")
      },
      settings: existingRecord.settings && typeof existingRecord.settings === "object" ? existingRecord.settings : {},
      stats: existingRecord.stats && typeof existingRecord.stats === "object" ? existingRecord.stats : { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
      versionHistory: Array.isArray(existingRecord.versionHistory) ? existingRecord.versionHistory : [],
      createdAt: asNumber(existingRecord.createdAt) ?? newScript.installedAt ?? Date.now(),
      updatedAt: newScript.updatedAt ?? Date.now(),
      installedBy
    };
  }
  function upsertScriptStore(store, newScript, meta, installedBy) {
    if (store.mode === "array") {
      const scripts = Array.isArray(store.raw) ? [...store.raw] : [];
      const idx = findArrayScriptIndex(scripts, newScript.id);
      if (idx !== -1) {
        scripts[idx] = { ...scripts[idx], ...newScript, updatedAt: Date.now(), installedBy };
      } else {
        scripts.push({ ...newScript, installedBy });
      }
      return scripts;
    }
    const record = !Array.isArray(store.raw) ? { ...store.raw } : {};
    const existing = findRecordScriptEntry(record, newScript.id);
    const key = existing?.key ?? newScript.id;
    const position = existing ? asNumber(existing.value.position) ?? store.scripts.length : store.scripts.length;
    record[key] = createNestedStoredScript(newScript, meta, installedBy, position, existing?.value ?? null);
    return record;
  }
  function toRuntimeScriptShape(script, meta) {
    return {
      ...script,
      meta: {
        ...meta,
        name: script.name ?? meta.name ?? script.id,
        version: script.version ?? meta.version ?? "1.0",
        description: script.description ?? meta.description ?? "",
        match: Array.isArray(meta.match) && meta.match.length > 0 ? [...meta.match] : ["*://*/*"],
        include: Array.isArray(meta.include) ? [...meta.include] : [],
        exclude: Array.isArray(meta.exclude) ? [...meta.exclude] : [],
        excludeMatch: Array.isArray(meta.excludeMatch) ? [...meta.excludeMatch] : [],
        grant: Array.isArray(meta.grant) && meta.grant.length > 0 ? [...meta.grant] : ["none"],
        require: Array.isArray(meta.require) ? [...meta.require] : [],
        requireProvenance: Array.isArray(meta.requireProvenance) ? [...meta.requireProvenance] : [],
        requireIdentity: Array.isArray(meta.requireIdentity) ? [...meta.requireIdentity] : [],
        resource: meta.resource ?? {},
        connect: Array.isArray(meta.connect) ? [...meta.connect] : [],
        "run-at": script.runAt ?? meta.runAt ?? "document_idle"
      },
      settings: {}
    };
  }
  async function refreshRuntimeAfterMutation(script, meta = {}) {
    const hooks = getRuntimeHooks();
    if (typeof hooks.registerAllScripts === "function") {
      try {
        await hooks.registerAllScripts();
      } catch (e) {
        console.warn("[PublicAPI] Failed to refresh registered scripts:", e);
      }
    }
    if (typeof hooks.updateBadge === "function") {
      try {
        await hooks.updateBadge();
      } catch (e) {
        console.warn("[PublicAPI] Failed to refresh badge state:", e);
      }
    }
    if (script && typeof hooks.autoReloadMatchingTabs === "function") {
      try {
        await hooks.autoReloadMatchingTabs(toRuntimeScriptShape(script, meta));
      } catch (e) {
        console.warn("[PublicAPI] Failed to auto-reload matching tabs:", e);
      }
    }
  }
  async function getExtensionVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      return manifest.version || "0.0.0";
    } catch {
      return "0.0.0";
    }
  }
  var HANDLERS = {
    async ping(_msg, _sender) {
      return { ok: true, version: await getExtensionVersion(), api: API_VERSION };
    },
    async getVersion(_msg, _sender) {
      return { version: await getExtensionVersion(), api: API_VERSION };
    },
    async getInstalledScripts(_msg, _sender) {
      const scripts = await getScripts();
      return {
        scripts: scripts.map((s) => ({
          id: s.id,
          name: s.name ?? s.id,
          version: s.version ?? "1.0",
          enabled: s.enabled !== false,
          matchUrls: s.matches ?? s.match ?? []
        }))
      };
    },
    async getScriptStatus(msg, _sender) {
      const scriptId = msg.scriptId ?? msg.id;
      if (!scriptId) return { error: "Missing scriptId parameter" };
      const script = await getScriptById(scriptId);
      if (!script) return { error: "Script not found", scriptId };
      return {
        id: script.id,
        name: script.name ?? script.id,
        version: script.version ?? "1.0",
        enabled: script.enabled !== false,
        matches: script.matches ?? script.match ?? [],
        lastModified: script.lastModified ?? null,
        runAt: script.runAt ?? "document_idle"
      };
    },
    async toggleScript(msg, sender) {
      const scriptId = msg.scriptId ?? msg.id;
      const enabled = !!msg.enabled;
      if (!scriptId) return { error: "Missing scriptId parameter" };
      const allowed = await authorize("toggleScript", sender);
      if (!allowed) return { error: "Permission denied", action: "toggleScript" };
      try {
        const script = await ScriptStorage.get(scriptId);
        if (!script) {
          return { error: "Script not found", scriptId };
        }
        await ScriptStorage.set(scriptId, { ...script, enabled, updatedAt: Date.now() });
        await refreshRuntimeAfterMutation();
        void fireWebhook("script.toggled", { scriptId, enabled });
        return { ok: true, scriptId, enabled };
      } catch (e) {
        return { error: "Failed to toggle script", detail: e.message };
      }
    },
    async installScript(msg, sender) {
      const code = msg.code;
      if (!code || typeof code !== "string") return { error: "Missing or invalid code parameter" };
      if (code.length > MAX_CODE_SIZE) return { error: "Script code exceeds maximum allowed size (5 MB)" };
      if (!code.includes("==UserScript==")) return { error: "Not a valid userscript (missing ==UserScript== header)" };
      const allowed = await authorize("installScript", sender);
      if (!allowed) return { error: "Permission denied", action: "installScript" };
      try {
        const meta = parseUserscriptMeta(code);
        const scriptId = generateExternalScriptId();
        const newScript = {
          id: scriptId,
          name: meta.name ?? scriptId,
          version: meta.version ?? "1.0",
          description: meta.description ?? "",
          matches: meta.match ?? ["*://*/*"],
          code,
          enabled: true,
          installedAt: Date.now(),
          installedBy: describeSender(sender),
          runAt: meta.runAt ?? "document_idle"
        };
        const store = await getScriptStore();
        const updatedStore = upsertScriptStore(store, newScript, meta, describeSender(sender));
        if (Array.isArray(updatedStore)) {
          await ScriptStorage.set(newScript.id, createNestedStoredScript(
            newScript,
            meta,
            describeSender(sender),
            store.scripts.length,
            null
          ));
        } else {
          const entry = updatedStore[newScript.id] ?? Object.values(updatedStore).find((v) => {
            const n = normalizeStoredScript(v);
            return n?.id === newScript.id;
          });
          if (entry) {
            await ScriptStorage.set(newScript.id, entry);
          }
        }
        await refreshRuntimeAfterMutation(newScript, meta);
        void fireWebhook("script.installed", { scriptId, name: newScript.name, version: newScript.version });
        return { ok: true, scriptId, name: newScript.name };
      } catch (e) {
        return { error: "Failed to install script", detail: e.message };
      }
    },
    async getAPISchema(_msg, _sender) {
      return { schema: API_SCHEMA };
    }
  };
  function parseUserscriptMeta(code) {
    const meta = {};
    const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!headerMatch?.[1]) return meta;
    const lines = headerMatch[1].split("\n");
    for (const line of lines) {
      const m = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
      if (!m?.[1]) continue;
      const key = m[1].trim();
      const val = (m[2] || "").trim();
      if (BOOLEAN_META_KEYS.has(key)) {
        meta[key] = true;
      } else if (ARRAY_META_KEYS[key]) {
        if (val) appendMetaValue(meta, ARRAY_META_KEYS[key], val);
      } else if (key === "resource") {
        const resourceMatch = val.match(/^(\S+)\s+(.+)$/);
        if (resourceMatch?.[1] && resourceMatch[2]) {
          meta.resource = meta.resource ?? {};
          meta.resource[resourceMatch[1]] = resourceMatch[2];
        }
      } else if (key === "run-at") {
        if (val) meta.runAt = val.replace(/-/g, "_");
      } else {
        if (val) meta[key] = val;
      }
    }
    return meta;
  }
  var WEB_HANDLERS = {
    "scriptvault:getScripts": async (_data, _origin) => {
      const scripts = await getScripts();
      return {
        type: "scriptvault:getScripts:response",
        scripts: scripts.map((s) => ({
          name: s.name ?? s.id,
          version: s.version ?? "1.0",
          enabled: s.enabled !== false
        }))
      };
    },
    "scriptvault:isInstalled": async (data, _origin) => {
      const name = data.name;
      if (!name) return { type: "scriptvault:isInstalled:response", error: "Missing name" };
      const scripts = await getScripts();
      const found = scripts.find(
        (s) => (s.name ?? "").toLowerCase() === name.toLowerCase() || (s.id ?? "").toLowerCase() === name.toLowerCase()
      );
      return {
        type: "scriptvault:isInstalled:response",
        installed: !!found,
        name,
        version: found ? found.version ?? "1.0" : null
      };
    },
    "scriptvault:install": async (data, origin) => {
      const url = data.url;
      if (!url || typeof url !== "string") {
        return { type: "scriptvault:install:response", error: "Missing or invalid url" };
      }
      const urlError = validateWebInstallUrl(url);
      if (urlError) {
        return { type: "scriptvault:install:response", error: urlError };
      }
      const allowed = await authorize("installScript", { origin });
      if (!allowed) {
        return { type: "scriptvault:install:response", error: "Permission denied", action: "installScript" };
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let code = "";
        try {
          const resp = await fetch(url, { signal: controller.signal });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          if (resp.url) {
            const finalUrlError = validateWebInstallUrl(resp.url);
            if (finalUrlError) throw new Error(finalUrlError);
          }
          code = await readResponseTextBounded(resp, MAX_FETCH_SIZE);
        } finally {
          clearTimeout(timeoutId);
        }
        if (!code.includes("==UserScript==")) {
          throw new Error("Not a valid userscript (missing ==UserScript== header)");
        }
        const meta = parseUserscriptMeta(code);
        const scriptId = generateExternalScriptId();
        const newScript = {
          id: scriptId,
          name: meta.name ?? scriptId,
          version: meta.version ?? "1.0",
          description: meta.description ?? "",
          matches: meta.match ?? ["*://*/*"],
          code,
          enabled: true,
          installedAt: Date.now(),
          installedBy: `origin:${origin}`,
          runAt: meta.runAt ?? "document_idle"
        };
        const store = await getScriptStore();
        const updatedStore = upsertScriptStore(store, newScript, meta, `origin:${origin}`);
        if (Array.isArray(updatedStore)) {
          await ScriptStorage.set(newScript.id, createNestedStoredScript(
            newScript,
            meta,
            `origin:${origin}`,
            store.scripts.length,
            null
          ));
        } else {
          const entry = updatedStore[newScript.id] ?? Object.values(updatedStore).find((v) => {
            const n = normalizeStoredScript(v);
            return n?.id === newScript.id;
          });
          if (entry) {
            await ScriptStorage.set(newScript.id, entry);
          }
        }
        await refreshRuntimeAfterMutation(newScript, meta);
        void fireWebhook("script.installed", { scriptId, name: newScript.name, version: newScript.version });
        return { type: "scriptvault:install:response", ok: true, scriptId, name: newScript.name };
      } catch (e) {
        return { type: "scriptvault:install:response", error: "Fetch failed", detail: e.message };
      }
    }
  };
  async function fireWebhook(eventType, payload) {
    const hook = _webhooks[eventType];
    if (!hook?.enabled || !hook.url) return;
    const guardReason = isInternalWebhookUrl(hook.url);
    if (guardReason) {
      console.warn(`[PublicAPI] webhook ${eventType} blocked at fire time: ${guardReason}`);
      return;
    }
    let body;
    try {
      body = JSON.stringify({
        event: eventType,
        timestamp: Date.now(),
        version: API_VERSION,
        data: payload
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[PublicAPI] webhook ${eventType} payload serialization failed:`, message);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      await fetch(hook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal
      });
    } catch (e) {
      console.warn(`[PublicAPI] webhook ${eventType} failed:`, e);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  async function dispatchExternal(message, sender) {
    const action = message?.action;
    if (!action || typeof action !== "string") {
      return { error: "Missing action field" };
    }
    const handler = HANDLERS[action];
    if (!handler) {
      return { error: `Unknown action: ${action}`, availableActions: Object.keys(HANDLERS) };
    }
    const senderId = describeSender(sender);
    const endpoint = API_SCHEMA.endpoints[action];
    if (endpoint?.rateLimit !== false) {
      if (!checkRateLimit(senderId)) {
        audit(action, sender, null, "rate_limited");
        return { error: "Rate limited. Max 10 requests per second." };
      }
    }
    const perm = getPermission(action);
    if (perm === "deny") {
      audit(action, sender, null, "denied");
      return { error: "Permission denied", action };
    }
    try {
      const result = await handler(message, sender);
      audit(action, sender, message, result?.["error"] ? "error" : "ok");
      return result;
    } catch (e) {
      audit(action, sender, message, "exception");
      console.warn("[PublicAPI] external handler exception:", action, e);
      return { error: "Internal error" };
    }
  }
  function dispatchWebMessage(event) {
    const origin = normalizeIncomingOrigin(event.origin);
    if (_trustedOrigins.length === 0 || !origin || !_trustedOrigins.includes(origin)) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object" || !("type" in data)) return;
    const msg = data;
    if (typeof msg.type !== "string") return;
    if (!msg.type.startsWith("scriptvault:")) return;
    const senderId = `web:${origin}`;
    if (!checkRateLimit(senderId)) {
      return;
    }
    const handler = WEB_HANDLERS[msg.type];
    if (!handler) return;
    audit(msg.type, { origin }, msg, "processing");
    handler(msg, origin).then((response) => {
      if (response && event.source) {
        try {
          event.source.postMessage(
            response,
            origin
          );
        } catch {
        }
      }
    }).catch((e) => {
      console.warn("[PublicAPI] web handler error:", e);
    });
  }
  function onExternalMessage(message, sender, sendResponse) {
    void dispatchExternal(message, sender).then((result) => {
      try {
        sendResponse(result);
      } catch {
      }
    });
    return true;
  }
  var PublicAPI = {
    /**
     * Initialize the Public API: load state, register listeners.
     * Safe for service workers (no DOM).
     * Concurrent callers share one init promise to prevent double-registration.
     */
    async init() {
      if (_initialized) return;
      if (!_initPromise) {
        _initPromise = (async () => {
          try {
            await loadState();
            if (chrome.runtime.onMessageExternal) {
              chrome.runtime.onMessageExternal.addListener(onExternalMessage);
            }
            if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
              self.addEventListener("message", dispatchWebMessage);
            }
            _initialized = true;
            console.log("[PublicAPI] initialized, version", API_VERSION);
          } catch (err) {
            _initPromise = null;
            throw err;
          }
        })();
      }
      return _initPromise;
    },
    /**
     * Handle an external message manually (if not using auto-listener).
     */
    async handleExternalMessage(message, sender) {
      if (!_initialized) await this.init();
      return dispatchExternal(message, sender);
    },
    /**
     * Handle a web page message event manually.
     */
    handleWebMessage(event) {
      dispatchWebMessage(event);
    },
    /**
     * Return the full API schema.
     */
    getAPISchema() {
      return { ...API_SCHEMA };
    },
    /**
     * Return the audit log (most recent entries).
     */
    getAuditLog(limit = 50) {
      const start = Math.max(0, _auditLog.length - limit);
      return _auditLog.slice(start);
    },
    /**
     * Set permissions for API actions.
     */
    async setPermissions(perms) {
      if (!_permissions) await loadState();
      for (const [key, val] of Object.entries(perms)) {
        if (["allow", "deny", "prompt"].includes(val)) {
          _permissions[key] = val;
        }
      }
      await savePermissions();
    },
    getPermissions() {
      return { ..._permissions || DEFAULT_PERMISSIONS };
    },
    /**
     * Set trusted web page origins.
     */
    async setTrustedOrigins(origins) {
      _trustedOrigins = normalizeTrustedOrigins(origins);
      await saveTrustedOrigins();
    },
    /**
     * Get trusted web page origins.
     */
    getTrustedOrigins() {
      return _trustedOrigins.slice();
    },
    /**
     * Configure a webhook for an event type.
     */
    async setWebhook(eventType, config) {
      if (!API_SCHEMA.webhookEvents.includes(eventType)) {
        throw new Error(`Unknown event type: ${eventType}`);
      }
      const url = config.url ?? "";
      if (url) {
        if (!url.startsWith("https://")) {
          throw new Error("Webhook URL must use https://");
        }
        const reason = isInternalWebhookUrl(url);
        if (reason) {
          throw new Error("Webhook URL points at internal/loopback host: " + reason);
        }
      }
      _webhooks[eventType] = {
        url,
        enabled: !!config.enabled
      };
      await saveWebhooks();
    },
    /**
     * Get all configured webhooks.
     */
    getWebhooks() {
      return { ..._webhooks };
    },
    /**
     * Fire a webhook event programmatically (used by other modules).
     */
    async fireEvent(eventType, payload) {
      audit("fireEvent", { id: "internal" }, { eventType, payload }, "ok");
      await fireWebhook(eventType, payload);
    },
    /**
     * Clear the audit log.
     */
    async clearAuditLog() {
      _auditLog = [];
      await saveAuditLog();
    }
  };
  var public_api_default = PublicAPI;
  return module.exports.default || module.exports.PublicAPI || module.exports;
})();

// ============================================================================
// Generated from src/modules/migration.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const Migration = (() => {
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

  // src/modules/migration.ts
  var migration_exports = {};
  __export(migration_exports, {
    Migration: () => Migration,
    default: () => migration_default
  });
  module.exports = __toCommonJS(migration_exports);
  var CURRENT_VERSION = "2.3.0";
  var MIGRATION_KEY = "sv_lastMigratedVersion";
  function compareVersions(v1, v2) {
    const p1 = v1.split(".").map(Number);
    const p2 = v2.split(".").map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] ?? 0;
      const b = p2[i] ?? 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }
  async function getAllScripts() {
    const data = await chrome.storage.local.get("userscripts");
    return data.userscripts && typeof data.userscripts === "object" ? data.userscripts : {};
  }
  async function migrateToV2() {
    console.log("[Migration] Running v1.x \u2192 v2.0 migration...");
    const installData = await chrome.storage.local.get("installDate");
    if (!installData.installDate) {
      await chrome.storage.local.set({ installDate: Date.now() });
    }
    const notifData = await chrome.storage.local.get("notificationPrefs");
    if (!notifData.notificationPrefs) {
      const prefs = {
        updates: true,
        errors: true,
        digest: false,
        security: true,
        quietHoursEnabled: false,
        quietHoursStart: 22,
        quietHoursEnd: 7
      };
      await chrome.storage.local.set({ notificationPrefs: prefs });
    }
    const backupData = await chrome.storage.local.get("backupSchedulerSettings");
    if (!backupData.backupSchedulerSettings) {
      const settings = {
        enabled: true,
        type: "weekly",
        hour: 3,
        day: 0,
        // Sunday
        maxBackups: 5,
        onChange: true
      };
      await chrome.storage.local.set({ backupSchedulerSettings: settings });
    }
    const scripts = await getAllScripts();
    let migrated = 0;
    for (const [id, script] of Object.entries(scripts)) {
      let changed = false;
      if (!script.settings) {
        script.settings = {};
        changed = true;
      }
      if (!script.stats) {
        script.stats = { runs: 0, totalTime: 0, avgTime: 0, errors: 0 };
        changed = true;
      }
      if (script.metadata && !script.meta) {
        script.meta = script.metadata;
        delete script.metadata;
        changed = true;
      }
      if (!script.installedAt && script.createdAt) {
        script.installedAt = script.createdAt;
        changed = true;
      }
      if (changed) {
        scripts[id] = script;
        migrated++;
      }
    }
    if (migrated > 0) {
      await chrome.storage.local.set({ userscripts: scripts });
      console.log(`[Migration] Migrated ${migrated} script(s)`);
    }
    const deprecatedKeys = [
      "tm_settings",
      // Old Tampermonkey-named settings
      "lastChecked"
      // Replaced by lastUpdateCheck
    ];
    await chrome.storage.local.remove(deprecatedKeys).catch(() => {
    });
    const gamData = await chrome.storage.local.get("gamification");
    if (!gamData.gamification) {
      const gamification = {
        achievements: {},
        streaks: {
          daily: { current: 0, longest: 0, lastDate: null },
          creation: { current: 0, longest: 0, lastDate: null }
        },
        points: 0,
        level: 1,
        firstSeen: Date.now()
      };
      await chrome.storage.local.set({ gamification });
    }
    console.log("[Migration] v2.0 migration complete");
  }
  async function run() {
    try {
      const data = await chrome.storage.local.get(MIGRATION_KEY);
      const lastVersion = data[MIGRATION_KEY] ?? "0.0.0";
      if (lastVersion === CURRENT_VERSION) return;
      console.log(`[Migration] Migrating from ${lastVersion} to ${CURRENT_VERSION}`);
      if (compareVersions(lastVersion, "2.0.0") < 0) {
        await migrateToV2();
      }
      await chrome.storage.local.set({ [MIGRATION_KEY]: CURRENT_VERSION });
      console.log("[Migration] Complete");
    } catch (e) {
      console.error("[Migration] Error:", e);
    }
  }
  var Migration = { run };
  var migration_default = Migration;
  return module.exports.default || module.exports.Migration || module.exports;
})();

// ============================================================================
// Generated from src/modules/quota-manager.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const QuotaManager = (() => {
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

  // src/modules/quota-manager.ts
  var quota_manager_exports = {};
  __export(quota_manager_exports, {
    QuotaManager: () => QuotaManager
  });
  module.exports = __toCommonJS(quota_manager_exports);
  var QUOTA_FALLBACK = 10 * 1024 * 1024;
  var QUOTA_UNLIMITED = 500 * 1024 * 1024;
  var WARNING_THRESHOLD = 0.85;
  var CRITICAL_THRESHOLD = 0.95;
  var PERSISTENCE_STATUS_KEY = "sv_storage_persistence";
  var _resolvedQuota = null;
  function measureStoredBytes(value) {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized.length : 0;
  }
  function countStoredScripts(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return 0;
  }
  async function _getQuotaLimit() {
    if (_resolvedQuota !== null) return _resolvedQuota;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota) {
          _resolvedQuota = est.quota;
          return _resolvedQuota;
        }
      } catch (_) {
      }
    }
    try {
      const perms = await chrome.permissions.getAll();
      if (perms.permissions?.includes("unlimitedStorage")) {
        _resolvedQuota = QUOTA_UNLIMITED;
        return _resolvedQuota;
      }
    } catch (_) {
    }
    _resolvedQuota = QUOTA_FALLBACK;
    return _resolvedQuota;
  }
  async function getUsage() {
    const quotaLimit = await _getQuotaLimit();
    const bytesUsed = await chrome.storage.local.getBytesInUse(void 0);
    const percentage = quotaLimit > 0 ? bytesUsed / quotaLimit : 0;
    const level = percentage >= CRITICAL_THRESHOLD ? "critical" : percentage >= WARNING_THRESHOLD ? "warning" : "ok";
    return { bytesUsed, quota: quotaLimit, percentage, level };
  }
  function normalizePersistenceStatus(value) {
    if (!value || typeof value !== "object") return null;
    const record = value;
    return {
      supported: record.supported === true,
      requested: record.requested === true,
      persisted: record.persisted === true,
      granted: record.granted === true,
      checkedAt: typeof record.checkedAt === "number" ? record.checkedAt : 0,
      reason: typeof record.reason === "string" ? record.reason : "",
      bytes: typeof record.bytes === "number" ? record.bytes : 0,
      error: typeof record.error === "string" ? record.error : ""
    };
  }
  async function getPersistenceStatus() {
    const data = await chrome.storage.local.get(PERSISTENCE_STATUS_KEY);
    return normalizePersistenceStatus(data[PERSISTENCE_STATUS_KEY]);
  }
  async function savePersistenceStatus(status) {
    await chrome.storage.local.set({ [PERSISTENCE_STATUS_KEY]: status });
    return status;
  }
  async function ensurePersistentStorageForWrite(options = {}) {
    const existing = await getPersistenceStatus();
    if (existing?.requested && !options.force) return existing;
    const reason = typeof options.reason === "string" && options.reason.trim() ? options.reason.trim() : "script-write";
    const bytes = Math.max(0, Number(options.bytes || 0) || 0);
    const now = Date.now();
    const storageApi = typeof navigator !== "undefined" ? navigator.storage : void 0;
    if (!storageApi?.persist) {
      return await savePersistenceStatus({
        supported: false,
        requested: true,
        persisted: false,
        granted: false,
        checkedAt: now,
        reason,
        bytes,
        error: "navigator.storage.persist is unavailable"
      });
    }
    try {
      const alreadyPersisted = typeof storageApi.persisted === "function" ? await storageApi.persisted() : false;
      const granted = alreadyPersisted ? true : await storageApi.persist();
      return await savePersistenceStatus({
        supported: true,
        requested: true,
        persisted: granted === true,
        granted: granted === true,
        checkedAt: Date.now(),
        reason,
        bytes,
        error: ""
      });
    } catch (error) {
      return await savePersistenceStatus({
        supported: true,
        requested: true,
        persisted: false,
        granted: false,
        checkedAt: Date.now(),
        reason,
        bytes,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  async function getBreakdown() {
    const all = await chrome.storage.local.get(void 0);
    const categories = {
      scripts: { count: 0, bytes: 0 },
      scriptValues: { count: 0, bytes: 0 },
      requireCache: { count: 0, bytes: 0 },
      resourceCache: { count: 0, bytes: 0 },
      backups: { count: 0, bytes: 0 },
      analytics: { count: 0, bytes: 0 },
      settings: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 }
    };
    for (const [key, value] of Object.entries(all)) {
      const size = measureStoredBytes(value);
      if (key === "userscripts") {
        categories.scripts.count += countStoredScripts(value);
        categories.scripts.bytes += size;
      } else if (key.startsWith("script_")) {
        categories.scripts.count++;
        categories.scripts.bytes += size;
      } else if (key.startsWith("values_") || key.startsWith("SV_GM_")) {
        categories.scriptValues.count++;
        categories.scriptValues.bytes += size;
      } else if (key.startsWith("require_cache_")) {
        categories.requireCache.count++;
        categories.requireCache.bytes += size;
      } else if (key.startsWith("res_cache_")) {
        categories.resourceCache.count++;
        categories.resourceCache.bytes += size;
      } else if (key.startsWith("autoBackup") || key === "autoBackups") {
        categories.backups.count++;
        categories.backups.bytes += size;
      } else if (key.startsWith("sv_analytics") || key === "analytics" || key === "perfHistory") {
        categories.analytics.count++;
        categories.analytics.bytes += size;
      } else if (key === "settings" || key.startsWith("sv_") || key.startsWith("notification") || key.startsWith("gamification")) {
        categories.settings.count++;
        categories.settings.bytes += size;
      } else {
        categories.other.count++;
        categories.other.bytes += size;
      }
    }
    return categories;
  }
  async function cleanup(options = {}) {
    const actions = [];
    let freedBytes = 0;
    const all = await chrome.storage.local.get(void 0);
    const keysToRemove = /* @__PURE__ */ new Set();
    const scheduleRemoval = (key) => {
      if (!(key in all) || keysToRemove.has(key)) return false;
      freedBytes += measureStoredBytes(all[key]);
      keysToRemove.add(key);
      return true;
    };
    if (options.requireCache !== false) {
      const expiredKeys = [];
      const now = Date.now();
      for (const [key, value] of Object.entries(all)) {
        const entry = value;
        if (key.startsWith("require_cache_") && entry && typeof entry === "object" && "timestamp" in entry) {
          const ts = entry.timestamp;
          if (now - ts > 7 * 24 * 60 * 60 * 1e3) {
            expiredKeys.push(key);
            freedBytes += measureStoredBytes(value);
          }
        }
        if (key.startsWith("res_cache_") && entry && typeof entry === "object" && "timestamp" in entry) {
          const ts = entry.timestamp;
          if (now - ts > 7 * 24 * 60 * 60 * 1e3) {
            expiredKeys.push(key);
            freedBytes += measureStoredBytes(value);
          }
        }
      }
      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys);
        actions.push(`Removed ${expiredKeys.length} expired cache entries`);
      }
    }
    if (options.errorLog !== false) {
      const errorLog = all.errorLog;
      if (errorLog && errorLog.length > 200) {
        const trimmed = errorLog.slice(-200);
        const removed = errorLog.length - trimmed.length;
        await chrome.storage.local.set({ errorLog: trimmed });
        actions.push(`Pruned ${removed} error log entries`);
        freedBytes += Math.max(0, measureStoredBytes(errorLog) - measureStoredBytes(trimmed));
      }
    }
    if (options.cspReports !== false) {
      const cspReports = all.sv_csp_reports;
      if (cspReports && cspReports.length > 100) {
        const trimmed = cspReports.slice(-100);
        await chrome.storage.local.set({ sv_csp_reports: trimmed });
        actions.push("Pruned old CSP reports");
        freedBytes += Math.max(0, measureStoredBytes(cspReports) - measureStoredBytes(trimmed));
      }
    }
    if (options.tombstones !== false) {
      const syncTombstones = all.syncTombstones;
      if (syncTombstones) {
        const now = Date.now();
        const cutoff = 30 * 24 * 60 * 60 * 1e3;
        let pruned = 0;
        const nextTombstones = { ...syncTombstones };
        for (const [id, ts] of Object.entries(syncTombstones)) {
          if (ts !== void 0 && now - ts > cutoff) {
            delete nextTombstones[id];
            pruned++;
          }
        }
        if (pruned > 0) {
          if (Object.keys(nextTombstones).length === 0) {
            await chrome.storage.local.remove("syncTombstones");
          } else {
            await chrome.storage.local.set({ syncTombstones: nextTombstones });
          }
          actions.push(`Pruned ${pruned} sync tombstones`);
          freedBytes += Math.max(0, measureStoredBytes(syncTombstones) - (Object.keys(nextTombstones).length === 0 ? 0 : measureStoredBytes(nextTombstones)));
        }
      }
    }
    if (options.npmCache) {
      if (scheduleRemoval("npmCache")) {
        actions.push("Cleared npm package cache");
      }
    }
    if (options.analytics) {
      const analyticsKeys = Object.keys(all).filter((key) => key === "analytics" || key.startsWith("sv_analytics"));
      const removedAnalytics = analyticsKeys.filter((key) => scheduleRemoval(key));
      if (removedAnalytics.length > 0) {
        actions.push(`Cleared ${removedAnalytics.length} analytics entr${removedAnalytics.length === 1 ? "y" : "ies"}`);
      }
    }
    if (options.perfHistory) {
      if (scheduleRemoval("perfHistory")) {
        actions.push("Cleared performance history");
      }
    }
    if (keysToRemove.size > 0) {
      await chrome.storage.local.remove([...keysToRemove]);
    }
    return { freedBytes, actions };
  }
  async function autoCleanup() {
    const usage = await getUsage();
    if (usage.level === "ok") return null;
    console.log(`[QuotaManager] Storage at ${(usage.percentage * 100).toFixed(1)}% \u2014 running cleanup`);
    const result = await cleanup({
      npmCache: usage.level === "critical"
    });
    if (usage.level === "critical" && result.freedBytes < 5e5) {
      const aggressiveResult = await cleanup({ analytics: true, perfHistory: true, errorLog: true, cspReports: true });
      return {
        freedBytes: result.freedBytes + aggressiveResult.freedBytes,
        actions: [...result.actions, ...aggressiveResult.actions]
      };
    }
    return result;
  }
  var QuotaManager = { getUsage, getBreakdown, getPersistenceStatus, ensurePersistentStorageForWrite, cleanup, autoCleanup };
  return module.exports.default || module.exports.QuotaManager || module.exports;
})();

// ============================================================================
// Generated from src/modules/subscriptions.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptSubscriptions = (() => {
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

  // src/modules/subscriptions.ts
  var subscriptions_exports = {};
  __export(subscriptions_exports, {
    ScriptSubscriptions: () => ScriptSubscriptions,
    default: () => subscriptions_default
  });
  module.exports = __toCommonJS(subscriptions_exports);

  // src/shared/utils.ts
  function generateId() {
    return "script_" + crypto.randomUUID();
  }

  // src/modules/subscriptions.ts
  var STORAGE_KEY = "scriptSubscriptions";
  var MAX_SUBSCRIPTIONS = 50;
  var MAX_FEED_ITEMS = 200;
  var MAX_ERRORS = 10;
  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }
  function asCleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function normalizeHttpUrl(value, baseUrl) {
    const raw = asCleanString(value);
    if (!raw) throw new Error("Subscription URL is required");
    let resolved;
    try {
      resolved = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
    } catch (_) {
      throw new Error(`Invalid subscription URL: ${raw}`);
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      throw new Error("Subscription URLs must use http or https");
    }
    resolved.hash = "";
    return resolved.href;
  }
  function getFeedItemUrl(item) {
    return asCleanString(item.url) || asCleanString(item.downloadURL) || asCleanString(item.downloadUrl) || asCleanString(item.codeURL) || asCleanString(item.codeUrl) || asCleanString(item.sourceURL) || asCleanString(item.sourceUrl) || asCleanString(item.href);
  }
  function normalizeFeedItem(item, feedUrl) {
    if (typeof item === "string") {
      return { url: normalizeHttpUrl(item, feedUrl) };
    }
    const record = asRecord(item);
    if (!record) return null;
    const rawUrl = getFeedItemUrl(record);
    if (!rawUrl) return null;
    const normalized = {
      url: normalizeHttpUrl(rawUrl, feedUrl)
    };
    const name = asCleanString(record.name);
    const namespace = asCleanString(record.namespace);
    const version = asCleanString(record.version);
    if (name) normalized.name = name;
    if (namespace) normalized.namespace = namespace;
    if (version) normalized.version = version;
    return normalized;
  }
  function getFeedItems(root) {
    if (Array.isArray(root)) return root;
    const record = asRecord(root);
    if (!record) throw new Error("Subscription feed must be a JSON array or object");
    for (const key of ["scripts", "items", "subscriptions"]) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
    throw new Error("Subscription feed must include a scripts, items, or subscriptions array");
  }
  function fallbackNameFromUrl(url) {
    try {
      return new URL(url).hostname || "Script subscription";
    } catch (_) {
      return "Script subscription";
    }
  }
  function normalizeSubscription(value) {
    const record = asRecord(value);
    if (!record) return null;
    try {
      const url = normalizeHttpUrl(record.url);
      const now = Date.now();
      return {
        id: asCleanString(record.id) || generateId(),
        url,
        name: asCleanString(record.name) || fallbackNameFromUrl(url),
        enabled: record.enabled !== false,
        scripts: Array.isArray(record.scripts) ? record.scripts.map((item) => normalizeFeedItem(item, url)).filter((item) => !!item).slice(0, MAX_FEED_ITEMS) : [],
        createdAt: typeof record.createdAt === "number" ? record.createdAt : now,
        updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : now,
        lastCheckedAt: typeof record.lastCheckedAt === "number" ? record.lastCheckedAt : null,
        lastQueued: typeof record.lastQueued === "number" ? record.lastQueued : 0,
        lastSkipped: typeof record.lastSkipped === "number" ? record.lastSkipped : 0,
        lastErrors: Array.isArray(record.lastErrors) ? record.lastErrors.filter((item) => typeof item === "string").slice(0, MAX_ERRORS) : []
      };
    } catch (_) {
      return null;
    }
  }
  async function readAll() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const raw = data[STORAGE_KEY];
    return Array.isArray(raw) ? raw.map(normalizeSubscription).filter((item) => !!item).slice(0, MAX_SUBSCRIPTIONS) : [];
  }
  async function writeAll(subscriptions) {
    const normalized = subscriptions.map(normalizeSubscription).filter((item) => !!item).slice(0, MAX_SUBSCRIPTIONS);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized.map((item) => ({ ...item, scripts: item.scripts.map((script) => ({ ...script })) }));
  }
  function cloneSubscription(subscription) {
    return {
      ...subscription,
      scripts: subscription.scripts.map((script) => ({ ...script })),
      lastErrors: [...subscription.lastErrors]
    };
  }
  function parseFeed(text, feedUrl) {
    const sourceUrl = normalizeHttpUrl(feedUrl);
    let root;
    try {
      root = JSON.parse(text);
    } catch (_) {
      throw new Error("Subscription feed is not valid JSON");
    }
    const record = asRecord(root);
    const name = asCleanString(record?.name) || asCleanString(record?.title) || fallbackNameFromUrl(sourceUrl);
    const seen = /* @__PURE__ */ new Set();
    const scripts = [];
    for (const rawItem of getFeedItems(root)) {
      if (scripts.length >= MAX_FEED_ITEMS) break;
      const item = normalizeFeedItem(rawItem, sourceUrl);
      if (!item || seen.has(item.url)) continue;
      seen.add(item.url);
      scripts.push(item);
    }
    if (scripts.length === 0) {
      throw new Error("Subscription feed did not contain any script URLs");
    }
    return {
      name,
      sourceUrl,
      scripts,
      parsedAt: Date.now()
    };
  }
  async function list() {
    return (await readAll()).sort((a, b) => a.createdAt - b.createdAt).map(cloneSubscription);
  }
  async function get(id) {
    const subscriptions = await readAll();
    const subscription = subscriptions.find((item) => item.id === id || item.url === id);
    return subscription ? cloneSubscription(subscription) : null;
  }
  async function upsertFromFeed(url, feed, options = {}) {
    const normalizedUrl = normalizeHttpUrl(url);
    const subscriptions = await readAll();
    const existingIndex = subscriptions.findIndex((item) => item.url === normalizedUrl);
    const existing = existingIndex >= 0 ? subscriptions[existingIndex] : null;
    const now = Date.now();
    const subscription = {
      id: existing?.id || generateId(),
      url: normalizedUrl,
      name: asCleanString(options.name) || feed.name || existing?.name || fallbackNameFromUrl(normalizedUrl),
      enabled: typeof options.enabled === "boolean" ? options.enabled : existing?.enabled !== false,
      scripts: feed.scripts.map((script) => ({ ...script })),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastCheckedAt: now,
      lastQueued: existing?.lastQueued || 0,
      lastSkipped: existing?.lastSkipped || 0,
      lastErrors: existing?.lastErrors ? [...existing.lastErrors] : []
    };
    const next = existingIndex >= 0 ? subscriptions.map((item, index) => index === existingIndex ? subscription : item) : [subscription, ...subscriptions];
    await writeAll(next);
    return cloneSubscription(subscription);
  }
  async function remove(id) {
    const subscriptions = await readAll();
    const next = subscriptions.filter((item) => item.id !== id && item.url !== id);
    if (next.length === subscriptions.length) return false;
    await writeAll(next);
    return true;
  }
  async function markRefreshResult(id, result = {}) {
    const subscriptions = await readAll();
    const index = subscriptions.findIndex((item) => item.id === id || item.url === id);
    if (index < 0) return null;
    const now = Date.now();
    const current = subscriptions[index];
    if (!current) return null;
    const updated = {
      ...current,
      updatedAt: now,
      lastCheckedAt: now,
      lastQueued: Math.max(0, result.queued || 0),
      lastSkipped: Math.max(0, result.skipped || 0),
      lastErrors: Array.isArray(result.errors) ? result.errors.slice(0, MAX_ERRORS) : []
    };
    subscriptions[index] = updated;
    await writeAll(subscriptions);
    return cloneSubscription(updated);
  }
  var ScriptSubscriptions = {
    STORAGE_KEY,
    MAX_SUBSCRIPTIONS,
    MAX_FEED_ITEMS,
    normalizeFeedUrl: normalizeHttpUrl,
    parseFeed,
    list,
    get,
    upsertFromFeed,
    remove,
    markRefreshResult
  };
  var subscriptions_default = ScriptSubscriptions;
  return module.exports.default || module.exports.ScriptSubscriptions || module.exports;
})();

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
  var FULCIO_V1_ROOT_CERT_PEM = [
    "-----BEGIN CERTIFICATE-----",
    "MIIB9zCCAXygAwIBAgIUALZNAPFdxHPwjeDloDwyYChAO/4wCgYIKoZIzj0EAwMw",
    "KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y",
    "MTEwMDcxMzU2NTlaFw0zMTEwMDUxMzU2NThaMCoxFTATBgNVBAoTDHNpZ3N0b3Jl",
    "LmRldjERMA8GA1UEAxMIc2lnc3RvcmUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAT7",
    "XeFT4rb3PQGwS4IajtLk3/OlnpgangaBclYpsYBr5i+4ynB07ceb3LP0OIOZdxex",
    "X69c5iVuyJRQ+Hz05yi+UF3uBWAlHpiS5sh0+H2GHE7SXrk1EC5m1Tr19L9gg92j",
    "YzBhMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRY",
    "wB5fkUWlZql6zJChkyLQKsXF+jAfBgNVHSMEGDAWgBRYwB5fkUWlZql6zJChkyLQ",
    "KsXF+jAKBggqhkjOPQQDAwNpADBmAjEAj1nHeXZp+13NWBNa+EDsDP8G1WWg1tCM",
    "WP/WHPqpaVo0jhsweNFZgSs0eE7wYI4qAjEA2WB9ot98sIkoF3vZYdd3/VtWB5b9",
    "TNMea7Ix/stJ5TfcLLeABLE4BNJOsQ4vnBHJ",
    "-----END CERTIFICATE-----"
  ].join("\n");
  var FULCIO_ISSUER_OIDS = /* @__PURE__ */ new Set([
    "1.3.6.1.4.1.57264.1.1",
    "1.3.6.1.4.1.57264.1.8"
  ]);
  var CURVE_P256 = {
    name: "P-256",
    p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
    n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
    a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
    gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
    gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),
    size: 32
  };
  var CURVE_P384 = {
    name: "P-384",
    p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff"),
    n: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973"),
    a: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffc"),
    gx: BigInt("0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b985f741e082542a385502f25dbf55296c3a545e3872760ab7"),
    gy: BigInt("0x3617de4a96262f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f"),
    size: 48
  };
  var EC_CURVES_BY_OID = {
    "1.2.840.10045.3.1.7": CURVE_P256,
    "1.3.132.0.34": CURVE_P384
  };
  var ECDSA_SIGNATURE_HASH_BY_OID = {
    "1.2.840.10045.4.3.2": "SHA-256",
    "1.2.840.10045.4.3.3": "SHA-384",
    "1.2.840.10045.4.3.4": "SHA-512"
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
  function pointDouble(point, curve) {
    if (point.y === 0n) return null;
    const slope = mod((3n * point.x * point.x + curve.a) * modInverse(2n * point.y, curve.p), curve.p);
    const x = mod(slope * slope - 2n * point.x, curve.p);
    const y = mod(slope * (point.x - x) - point.y, curve.p);
    return { x, y };
  }
  function pointAdd(left, right, curve) {
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
  function pointMultiply(point, scalar, curve) {
    let addend = point;
    let result = null;
    let k = scalar;
    while (k > 0n) {
      if (k & 1n) result = pointAdd(result, addend, curve);
      addend = addend ? pointDouble(addend, curve) : null;
      k >>= 1n;
    }
    return result;
  }
  function digestToScalar(digest, curve) {
    const excessBits = BigInt(Math.max(0, (digest.byteLength - curve.size) * 8));
    const value = toBigInt(digest);
    return excessBits > 0n ? value >> excessBits : value;
  }
  function verifyEcDigest(publicKey, digest, signature) {
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
      curve
    );
    return !!point && mod(point.x, curve.n) === r;
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
    if (bytes.length === 64 || bytes.length === 96) {
      const size = bytes.length / 2;
      return { r: toBigInt(bytes.slice(0, size)), s: toBigInt(bytes.slice(size)) };
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
    const algorithm = children[0];
    const bitString = children[1];
    if (!algorithm || algorithm.tag !== 48) throw new Error("SPKI is missing algorithm identifier");
    if (!bitString || bitString.tag !== 3) throw new Error("SPKI is missing public key bit string");
    const algorithmParts = readDerChildren(spkiBytes, algorithm);
    const curveOidNode = algorithmParts[1];
    if (!curveOidNode || curveOidNode.tag !== 6) throw new Error("SPKI is missing EC named curve");
    const curve = EC_CURVES_BY_OID[decodeOid(derValue(spkiBytes, curveOidNode))];
    if (!curve) throw new Error("SPKI uses an unsupported EC curve");
    const value = derValue(spkiBytes, bitString);
    if (value[0] !== 0) throw new Error("SPKI public key has unsupported unused bits");
    const point = value.slice(1);
    const expectedLength = 1 + curve.size * 2;
    if (point.length !== expectedLength || point[0] !== 4) {
      throw new Error(`SPKI public key must be uncompressed ${curve.name}`);
    }
    return {
      curve,
      point: {
        x: toBigInt(point.slice(1, 1 + curve.size)),
        y: toBigInt(point.slice(1 + curve.size, expectedLength))
      }
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
  function bitStringValue(bytes, node) {
    const value = derValue(bytes, node);
    if (value[0] !== 0) throw new Error("Unsupported non-zero unused bits in BIT STRING");
    return value.slice(1);
  }
  function parseSignatureAlgorithmOid(bytes, node) {
    if (node.tag !== 48) throw new Error("Signature algorithm must be a sequence");
    const parts = readDerChildren(bytes, node);
    const oidNode = parts[0];
    if (!oidNode || oidNode.tag !== 6) throw new Error("Signature algorithm missing OID");
    return decodeOid(derValue(bytes, oidNode));
  }
  function parseAsn1Time(bytes, node) {
    const text = decodeDerText(derValue(bytes, node));
    if (node.tag === 23) {
      const match = text.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
      if (!match) throw new Error(`Invalid UTCTime value: ${text}`);
      const year = Number(match[1]);
      return Date.UTC(
        year >= 50 ? 1900 + year : 2e3 + year,
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6])
      );
    }
    if (node.tag === 24) {
      const match = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
      if (!match) throw new Error(`Invalid GeneralizedTime value: ${text}`);
      return Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6])
      );
    }
    throw new Error("Certificate validity time must be UTCTime or GeneralizedTime");
  }
  function parseCertificate(certBytes) {
    const certificate = readDerNode(certBytes, 0);
    if (certificate.tag !== 48 || certificate.end !== certBytes.length) throw new Error("Certificate must be a DER sequence");
    const certParts = readDerChildren(certBytes, certificate);
    const tbsCertificate = certParts[0];
    const signatureAlgorithm = certParts[1];
    const signatureValue = certParts[2];
    if (!tbsCertificate || tbsCertificate.tag !== 48 || !signatureAlgorithm || !signatureValue || signatureValue.tag !== 3) {
      throw new Error("Certificate is missing required signed fields");
    }
    const children = readDerChildren(certBytes, tbsCertificate);
    let index = children[0]?.tag === 160 ? 1 : 0;
    index += 2;
    const issuer = children[index++];
    const validity = children[index++];
    const subject = children[index++];
    const spki = children[index++];
    if (!issuer || !validity || !subject || !spki) throw new Error("Certificate missing issuer, validity, subject, or SPKI");
    const validityParts = readDerChildren(certBytes, validity);
    const notBefore = validityParts[0];
    const notAfter = validityParts[1];
    if (!notBefore || !notAfter) throw new Error("Certificate validity is incomplete");
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
      identity: extractCertificateIdentity(certBytes)
    };
  }
  function pemToDer(pem) {
    return base64ToBytes(pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ""));
  }
  function bytesEqual(left, right) {
    if (left.byteLength !== right.byteLength) return false;
    for (let i = 0; i < left.byteLength; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }
  function assertCertificateTime(cert, time, label) {
    if (time < cert.notBefore || time > cert.notAfter) {
      throw new Error(`${label} certificate is not valid at verification time`);
    }
  }
  async function verifyCertificateSignature(child, issuer) {
    if (!bytesEqual(child.issuerDer, issuer.subjectDer)) return false;
    const hashAlgorithm = ECDSA_SIGNATURE_HASH_BY_OID[child.signatureAlgorithmOid];
    if (!hashAlgorithm) throw new Error(`Unsupported certificate signature algorithm: ${child.signatureAlgorithmOid}`);
    const digest = new Uint8Array(await crypto.subtle.digest(hashAlgorithm, bytesToArrayBuffer(child.tbsBytes)));
    return verifyEcDigest(issuer.publicKey, digest, parseEcdsaSignature(child.signature));
  }
  async function validateCertificateChain(bundle, trustedRootCertificates, verificationTime) {
    const chainBytes = bundle.verificationMaterial.certificateChainRawBytes.length > 0 ? bundle.verificationMaterial.certificateChainRawBytes : [bundle.verificationMaterial.certificateRawBytes].filter(Boolean);
    if (chainBytes.length === 0) throw new Error("Sigstore bundle does not include certificate material");
    const certs = chainBytes.map((value) => parseCertificate(base64ToBytes(value)));
    const roots = trustedRootCertificates.map((value) => parseCertificate(pemToDer(value)));
    if (roots.length === 0) throw new Error("No trusted Fulcio root certificates are configured");
    certs.forEach((cert, index) => assertCertificateTime(cert, verificationTime, index === 0 ? "Leaf" : "Intermediate"));
    roots.forEach((root) => assertCertificateTime(root, verificationTime, "Trusted root"));
    for (let i = 0; i < certs.length - 1; i += 1) {
      if (!await verifyCertificateSignature(certs[i], certs[i + 1])) {
        throw new Error("Certificate chain signature verification failed");
      }
    }
    const last = certs[certs.length - 1];
    for (const root of roots) {
      if (bytesEqual(last.rawBytes, root.rawBytes)) {
        return { leaf: certs[0], rootVerified: "verified" };
      }
      if (await verifyCertificateSignature(last, root)) {
        return { leaf: certs[0], rootVerified: "verified" };
      }
    }
    throw new Error("Certificate chain does not terminate at a trusted Fulcio root");
  }
  function verificationTimeMs(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return Date.now();
  }
  function isoTime(value) {
    return new Date(value).toISOString();
  }
  function parseIdentityDeclaration(value = "") {
    const match = value.match(/^\s*(.*?)\s*(?:\(\s*issuer:\s*([^)]+?)\s*\))?\s*$/i);
    return {
      subject: (match?.[1] || value).trim(),
      issuer: (match?.[2] || "").trim()
    };
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
      const verificationTime = verificationTimeMs(options.verificationTime);
      const trustedRootCertificates = options.trustedRootCertificates || [FULCIO_V1_ROOT_CERT_PEM];
      let chain;
      try {
        chain = await validateCertificateChain(bundle, trustedRootCertificates, verificationTime);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error), "root-verification-failed", {
          digestVerified,
          rootVerified: "failed"
        });
      }
      const certificateIdentity = chain.leaf.identity;
      const signature = parseEcdsaSignature(base64ToBytes(bundle.messageSignature.signature));
      const signatureVerified = verifyEcDigest(chain.leaf.publicKey, digest, signature);
      if (!signatureVerified) {
        return failure("Sigstore signature does not verify against artifact digest", "signature-failed", {
          certificateIdentity: certificateIdentity.subjects[0] || "",
          certificateIssuer: certificateIdentity.issuer,
          certificateNotBefore: isoTime(chain.leaf.notBefore),
          certificateNotAfter: isoTime(chain.leaf.notAfter),
          digestVerified,
          rootVerified: chain.rootVerified
        });
      }
      const expected = parseIdentityDeclaration(options.expectedIdentity || "");
      if (expected.subject && !certificateIdentity.subjects.includes(expected.subject)) {
        return failure("Sigstore certificate identity does not match @require-identity subject", "signature-failed", {
          certificateIdentity: certificateIdentity.subjects[0] || "",
          certificateIssuer: certificateIdentity.issuer,
          certificateNotBefore: isoTime(chain.leaf.notBefore),
          certificateNotAfter: isoTime(chain.leaf.notAfter),
          digestVerified,
          signatureVerified: true,
          rootVerified: chain.rootVerified
        });
      }
      if (expected.issuer && certificateIdentity.issuer !== expected.issuer) {
        return failure("Sigstore certificate issuer does not match @require-identity issuer", "signature-failed", {
          certificateIdentity: certificateIdentity.subjects[0] || "",
          certificateIssuer: certificateIdentity.issuer,
          certificateNotBefore: isoTime(chain.leaf.notBefore),
          certificateNotAfter: isoTime(chain.leaf.notAfter),
          digestVerified,
          signatureVerified: true,
          rootVerified: chain.rootVerified
        });
      }
      return {
        success: true,
        status: "verified",
        verification: "signature-verified",
        certificateIdentity: certificateIdentity.subjects[0] || "",
        certificateIssuer: certificateIdentity.issuer,
        certificateNotBefore: isoTime(chain.leaf.notBefore),
        certificateNotAfter: isoTime(chain.leaf.notAfter),
        digestVerified,
        signatureVerified: true,
        rootVerified: chain.rootVerified
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

// ============================================================================
// Generated from src/bg/analyzer.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptAnalyzer = (() => {
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

  // src/bg/analyzer.ts
  var analyzer_exports = {};
  __export(analyzer_exports, {
    ScriptAnalyzer: () => ScriptAnalyzer
  });
  module.exports = __toCommonJS(analyzer_exports);
  function debugLogSafe(...args) {
    const maybeDebugLog = globalThis.debugLog;
    if (typeof maybeDebugLog === "function") {
      maybeDebugLog(...args);
    }
  }
  async function analyzeAsync(code) {
    const offscreenSupported = _supportsOffscreen();
    try {
      const result = await sendOffscreenMessage({ type: "offscreen_analyze", code });
      if (result && !result.parseError) return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe("[Analyzer] Offscreen analysis failed:", message);
    }
    if (!offscreenSupported) {
      try {
        const result = await analyzeInline(code);
        if (result && !result.parseError) return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        debugLogSafe("[Analyzer] Inline AST failed, using regex fallback:", message);
      }
    }
    return analyze(code);
  }
  function getOffscreenApi() {
    const maybeChrome = chrome;
    const offscreen = maybeChrome?.offscreen;
    if (!offscreen || typeof offscreen.hasDocument !== "function" || typeof offscreen.createDocument !== "function") {
      return null;
    }
    return offscreen;
  }
  function _supportsOffscreen() {
    return getOffscreenApi() !== null;
  }
  async function _ensureOffscreen() {
    const offscreen = getOffscreenApi();
    if (!offscreen) return false;
    if (!ScriptAnalyzer._offscreenPromise) {
      ScriptAnalyzer._offscreenPromise = (async () => {
        const existing = await offscreen.hasDocument().catch(() => false);
        if (!existing) {
          await offscreen.createDocument({
            url: chrome.runtime.getURL("offscreen.html"),
            reasons: ["DOM_SCRAPING"],
            justification: "AST-based script analysis with Acorn parser"
          });
        }
        return true;
      })().catch((e) => {
        ScriptAnalyzer._offscreenPromise = null;
        throw e;
      });
    }
    return ScriptAnalyzer._offscreenPromise;
  }
  async function sendOffscreenMessage(message) {
    if (!await _ensureOffscreen()) return void 0;
    return chrome.runtime.sendMessage(message);
  }
  function getGlobalValue(name) {
    const value = globalThis[name];
    return value ? value : null;
  }
  function getNativeImportScripts() {
    const loader = globalThis.importScripts;
    if (typeof loader !== "function") return null;
    const source = Function.prototype.toString.call(loader);
    if (!source.includes("[native code]")) return null;
    return loader;
  }
  async function loadRuntimeScript(path) {
    const url = chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path;
    const workerLoader = getNativeImportScripts();
    if (workerLoader) {
      workerLoader(url);
      return;
    }
    const doc = globalThis.document;
    if (!doc?.createElement) {
      throw new Error(`No runtime script loader available for ${path}`);
    }
    const parent = doc.head || doc.documentElement;
    if (!parent?.appendChild) {
      throw new Error(`No document root available to load ${path}`);
    }
    await new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      const timer = globalThis.setTimeout(() => {
        script.remove();
        reject(new Error(`Timed out loading ${path}`));
      }, 5e3);
      script.src = url;
      script.async = false;
      script.onload = () => {
        globalThis.clearTimeout(timer);
        script.remove();
        resolve();
      };
      script.onerror = () => {
        globalThis.clearTimeout(timer);
        script.remove();
        reject(new Error(`Failed to load ${path}`));
      };
      parent.appendChild(script);
    });
  }
  async function ensureInlineLibrary(path, globalName) {
    if (getGlobalValue(globalName)) return;
    const key = `${globalName}:${path}`;
    if (!ScriptAnalyzer._inlineLibraryPromises[key]) {
      ScriptAnalyzer._inlineLibraryPromises[key] = loadRuntimeScript(path).then(() => {
        if (!getGlobalValue(globalName)) {
          throw new Error(`${globalName} did not initialize from ${path}`);
        }
      }).catch((e) => {
        ScriptAnalyzer._inlineLibraryPromises[key] = void 0;
        throw e;
      });
    }
    return ScriptAnalyzer._inlineLibraryPromises[key];
  }
  async function ensureInlineAcorn() {
    await ensureInlineLibrary("lib/acorn.min.js", "acorn");
  }
  async function ensureInlineDiff() {
    await ensureInlineLibrary("lib/diff.min.js", "Diff");
  }
  function getAcorn() {
    const parser = getGlobalValue("acorn");
    if (!parser || typeof parser.parse !== "function") {
      throw new Error("Acorn parser is not available");
    }
    return parser;
  }
  function getDiff() {
    const diff = getGlobalValue("Diff");
    if (!diff || typeof diff.merge !== "function" || typeof diff.applyPatch !== "function") {
      throw new Error("Diff library is not available");
    }
    return diff;
  }
  async function analyzeInline(code) {
    await ensureInlineAcorn();
    return handleInlineAnalyze(code);
  }
  async function analyzeESMImports(code) {
    const offscreenSupported = _supportsOffscreen();
    try {
      const offscreenResult = await sendOffscreenMessage({ type: "offscreen_esm_imports", code });
      if (offscreenResult) return offscreenResult;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe("[Analyzer] Offscreen ESM parse failed:", message);
    }
    if (offscreenSupported) {
      return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: "ESM parse error: offscreen parser unavailable" };
    }
    try {
      await ensureInlineAcorn();
      return parseESMImportsInline(code);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: "ESM parse error: " + message };
    }
  }
  async function mergeText(base, local, remote) {
    const offscreenSupported = _supportsOffscreen();
    try {
      const offscreenResult = await sendOffscreenMessage({
        type: "offscreen_merge",
        base,
        local,
        remote
      });
      if (offscreenResult) return offscreenResult;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe("[Analyzer] Offscreen merge failed:", message);
    }
    if (offscreenSupported) {
      return { merged: resolveWithMarkers(local, remote), conflicts: true, error: "offscreen merge unavailable" };
    }
    try {
      await ensureInlineDiff();
      return mergeTextInline(base, local, remote);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { merged: resolveWithMarkers(local, remote), conflicts: true, error: message };
    }
  }
  var patterns = [
    { id: "eval", regex: /\beval\s*\(/g, label: "eval() call", risk: 30, category: "execution", desc: "Dynamic code execution can run arbitrary code" },
    { id: "function-ctor", regex: /\bnew\s+Function\s*\(/g, label: "new Function()", risk: 30, category: "execution", desc: "Creates functions from strings, equivalent to eval" },
    { id: "settimeout-str", regex: /setTimeout\s*\(\s*['\"`]/g, label: "setTimeout with string", risk: 20, category: "execution", desc: "String argument to setTimeout acts like eval" },
    { id: "setinterval-str", regex: /setInterval\s*\(\s*['\"`]/g, label: "setInterval with string", risk: 20, category: "execution", desc: "String argument to setInterval acts like eval" },
    { id: "document-write", regex: /document\.write\s*\(/g, label: "document.write()", risk: 10, category: "execution", desc: "Can overwrite entire page content" },
    { id: "innerhtml-assign", regex: /\.innerHTML\s*=/g, label: "innerHTML assignment", risk: 5, category: "execution", desc: "Can inject HTML including scripts (XSS risk)" },
    { id: "cookie-access", regex: /document\.cookie/g, label: "Cookie access", risk: 25, category: "data", desc: "Can read or modify browser cookies" },
    { id: "localstorage", regex: /localStorage\.(get|set|remove)Item/g, label: "localStorage access", risk: 10, category: "data", desc: "Reads or writes persistent page data" },
    { id: "sessionstorage", regex: /sessionStorage\.(get|set|remove)Item/g, label: "sessionStorage access", risk: 5, category: "data", desc: "Reads or writes session data" },
    { id: "indexeddb", regex: /indexedDB\.open/g, label: "IndexedDB access", risk: 10, category: "data", desc: "Opens browser database" },
    { id: "fetch-call", regex: /\bfetch\s*\(/g, label: "fetch() call", risk: 10, category: "network", desc: "Makes network requests (same-origin)" },
    { id: "xhr-open", regex: /XMLHttpRequest|\.open\s*\(\s*['""](?:GET|POST|PUT|DELETE)/gi, label: "XMLHttpRequest", risk: 10, category: "network", desc: "Makes network requests" },
    { id: "websocket", regex: /new\s+WebSocket\s*\(/g, label: "WebSocket", risk: 20, category: "network", desc: "Opens persistent connection to a server" },
    { id: "beacon", regex: /navigator\.sendBeacon/g, label: "sendBeacon()", risk: 15, category: "network", desc: "Sends data to a server, often used for tracking" },
    { id: "canvas-fp", regex: /\.toDataURL\s*\(|\.getImageData\s*\(/g, label: "Canvas fingerprinting", risk: 20, category: "fingerprint", desc: "Can generate unique device fingerprint via canvas" },
    { id: "webgl-fp", regex: /getExtension\s*\(\s*['""]WEBGL/g, label: "WebGL fingerprinting", risk: 20, category: "fingerprint", desc: "Can identify GPU for device fingerprinting" },
    { id: "audio-fp", regex: /AudioContext|OfflineAudioContext/g, label: "Audio fingerprinting", risk: 15, category: "fingerprint", desc: "Can generate audio-based device fingerprint" },
    { id: "navigator-props", regex: /navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g, label: "Navigator property access", risk: 5, category: "fingerprint", desc: "Reads browser/device information" },
    { id: "atob-long", regex: /atob\s*\(\s*['""][A-Za-z0-9+/=]{100,}['"]\s*\)/g, label: "Large base64 decode", risk: 25, category: "obfuscation", desc: "Decodes large embedded base64 data (possible obfuscation)" },
    { id: "hex-escape", regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g, label: "Hex escape sequences", risk: 20, category: "obfuscation", desc: "Long hex-encoded strings suggest obfuscated code" },
    { id: "char-fromcode", regex: /String\.fromCharCode\s*\([^)]{20,}\)/g, label: "String.fromCharCode chain", risk: 15, category: "obfuscation", desc: "Building strings from char codes (obfuscation technique)" },
    { id: "wasm-mining", regex: /WebAssembly\.(instantiate|compile|Module)/g, label: "WebAssembly usage", risk: 15, category: "mining", desc: "WebAssembly can be used for crypto mining" },
    { id: "worker-creation", regex: /new\s+Worker\s*\(/g, label: "Web Worker creation", risk: 10, category: "mining", desc: "Workers can run background computations" },
    { id: "form-submit", regex: /\.submit\s*\(\s*\)/g, label: "Form auto-submit", risk: 15, category: "hijack", desc: "Automatically submits forms" },
    { id: "window-open", regex: /window\.open\s*\(/g, label: "window.open()", risk: 5, category: "hijack", desc: "Opens new windows/popups" },
    { id: "location-assign", regex: /(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g, label: "Page redirect", risk: 10, category: "hijack", desc: "Redirects the page to another URL" },
    { id: "event-prevent", regex: /addEventListener\s*\(\s*['""](?:beforeunload|unload)['"]/g, label: "Unload handler", risk: 10, category: "hijack", desc: "Prevents or intercepts page navigation" },
    { id: "proto-pollution", regex: /__proto__|Object\.setPrototypeOf\s*\(|prototype\[/g, label: "Prototype manipulation", risk: 25, category: "hijack", desc: "Modifying object prototypes can corrupt global state and affect other scripts" },
    { id: "document-domain", regex: /document\.domain\s*=/g, label: "document.domain assignment", risk: 20, category: "hijack", desc: "Changing document.domain relaxes same-origin restrictions" },
    { id: "postmessage-noorigin", regex: /postMessage\s*\([^,)]+,\s*['"]\*['"]/g, label: "postMessage with wildcard origin", risk: 15, category: "hijack", desc: "Sending postMessage to any origin (* target) can leak data to malicious frames" },
    { id: "defineProperty-global", regex: /Object\.defineProperty\s*\(\s*(?:window|globalThis|self|unsafeWindow)\s*,/g, label: "Global property definition", risk: 10, category: "hijack", desc: "Defining properties on the global object can interfere with page code" }
  ];
  var AST_RISK_PATTERNS = [
    {
      id: "eval",
      label: "eval() call",
      risk: 30,
      category: "execution",
      desc: "Dynamic code execution can run arbitrary code",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "eval")
    },
    {
      id: "function-ctor",
      label: "new Function()",
      risk: 30,
      category: "execution",
      desc: "Creates functions from strings, equivalent to eval",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "Function")
    },
    {
      id: "indirect-eval",
      label: "Indirect eval ((0, eval))",
      risk: 30,
      category: "execution",
      desc: "Indirect eval runs in global scope, bypassing local closures (obfuscation pattern)",
      match: (node) => {
        if (node?.type !== "CallExpression") return false;
        const callee = node.callee;
        if (callee?.type !== "SequenceExpression") return false;
        const exprs = callee.expressions;
        if (!Array.isArray(exprs) || exprs.length === 0) return false;
        return isIdent(exprs[exprs.length - 1], "eval");
      }
    },
    {
      id: "dynamic-property-call",
      label: "Dynamic-property global call",
      risk: 25,
      category: "obfuscation",
      desc: "Calls a globally-scoped function via computed property access (eval obfuscation)",
      match: (node) => {
        if (node?.type !== "CallExpression") return false;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.computed !== true) return false;
        if (callee.property?.type === "Literal" && typeof callee.property.value === "string") return false;
        return isIdent(callee.object, "window") || isIdent(callee.object, "globalThis") || isIdent(callee.object, "self") || isIdent(callee.object, "unsafeWindow");
      }
    },
    {
      id: "function-ctor-apply",
      label: "Function constructor via .apply/.call/.bind",
      risk: 25,
      category: "execution",
      desc: "Calling Function() via .apply/.call/.bind is equivalent to new Function()",
      match: (node) => {
        if (node?.type !== "CallExpression") return false;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression") return false;
        const methodName = callee.property?.name;
        if (methodName !== "apply" && methodName !== "call" && methodName !== "bind") return false;
        if (isIdent(callee.object, "Function")) return true;
        if (callee.object?.type === "MemberExpression") {
          if (isMember(callee.object, "Function", "prototype")) return true;
          if (callee.object?.property?.name === "constructor" && callee.object?.object?.type === "MemberExpression" && isMember(callee.object.object, "Function", "prototype")) return true;
        }
        return false;
      }
    },
    {
      id: "settimeout-str",
      label: "setTimeout with string",
      risk: 20,
      category: "execution",
      desc: "String argument to setTimeout acts like eval",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "setTimeout") && node.arguments?.[0]?.type === "Literal" && typeof node.arguments[0].value === "string"
    },
    {
      id: "setinterval-str",
      label: "setInterval with string",
      risk: 20,
      category: "execution",
      desc: "String argument to setInterval acts like eval",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "setInterval") && node.arguments?.[0]?.type === "Literal" && typeof node.arguments[0].value === "string"
    },
    {
      id: "document-write",
      label: "document.write()",
      risk: 10,
      category: "execution",
      desc: "Can overwrite entire page content",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "document", "write")
    },
    {
      id: "innerhtml-assign",
      label: "innerHTML assignment",
      risk: 5,
      category: "execution",
      desc: "Can inject HTML including scripts (XSS risk)",
      match: (node) => (node.type === "AssignmentExpression" || node.type === "AssignmentPattern") && node.left?.property?.name === "innerHTML"
    },
    {
      id: "cookie-access",
      label: "Cookie access",
      risk: 25,
      category: "data",
      desc: "Can read or modify browser cookies",
      match: (node) => node.type === "MemberExpression" && isMember(node, "document", "cookie")
    },
    {
      id: "localstorage",
      label: "localStorage access",
      risk: 10,
      category: "data",
      desc: "Reads or writes persistent page data",
      match: (node) => node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "localStorage") && ["getItem", "setItem", "removeItem"].includes(node.callee?.property?.name)
    },
    {
      id: "sessionstorage",
      label: "sessionStorage access",
      risk: 5,
      category: "data",
      desc: "Reads or writes session data",
      match: (node) => node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "sessionStorage") && ["getItem", "setItem", "removeItem"].includes(node.callee?.property?.name)
    },
    {
      id: "indexeddb",
      label: "IndexedDB access",
      risk: 10,
      category: "data",
      desc: "Opens browser database",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "indexedDB", "open")
    },
    {
      id: "fetch-call",
      label: "fetch() call",
      risk: 10,
      category: "network",
      desc: "Makes network requests (same-origin)",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "fetch")
    },
    {
      id: "xhr-open",
      label: "XMLHttpRequest",
      risk: 10,
      category: "network",
      desc: "Makes network requests via XHR",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "XMLHttpRequest") || node.type === "CallExpression" && node.callee?.property?.name === "open" && node.arguments?.[0]?.type === "Literal" && /^(GET|POST|PUT|DELETE|PATCH|HEAD)$/i.test(String(node.arguments[0].value))
    },
    {
      id: "websocket",
      label: "WebSocket",
      risk: 20,
      category: "network",
      desc: "Opens persistent connection to a server",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "WebSocket")
    },
    {
      id: "beacon",
      label: "sendBeacon()",
      risk: 15,
      category: "network",
      desc: "Sends data to a server, often used for tracking",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "navigator", "sendBeacon")
    },
    {
      id: "canvas-fp",
      label: "Canvas fingerprinting",
      risk: 20,
      category: "fingerprint",
      desc: "Can generate unique device fingerprint via canvas",
      match: (node) => node.type === "CallExpression" && ["toDataURL", "getImageData"].includes(node.callee?.property?.name)
    },
    {
      id: "webgl-fp",
      label: "WebGL fingerprinting",
      risk: 20,
      category: "fingerprint",
      desc: "Can identify GPU for device fingerprinting",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "getExtension" && node.arguments?.[0]?.type === "Literal" && String(node.arguments[0].value).startsWith("WEBGL")
    },
    {
      id: "audio-fp",
      label: "Audio fingerprinting",
      risk: 15,
      category: "fingerprint",
      desc: "Can generate audio-based device fingerprint",
      match: (node) => node.type === "NewExpression" && ["AudioContext", "OfflineAudioContext"].includes(node.callee?.name)
    },
    {
      id: "navigator-props",
      label: "Navigator property access",
      risk: 5,
      category: "fingerprint",
      desc: "Reads browser/device information",
      match: (node) => node.type === "MemberExpression" && isIdent(node.object, "navigator") && ["platform", "userAgent", "language", "hardwareConcurrency", "deviceMemory", "plugins"].includes(node.property?.name)
    },
    {
      id: "atob-long",
      label: "Large base64 decode",
      risk: 25,
      category: "obfuscation",
      desc: "Decodes large embedded base64 data (possible obfuscation)",
      match: (node) => node.type === "CallExpression" && isIdent(node.callee, "atob") && node.arguments?.[0]?.type === "Literal" && typeof node.arguments[0].value === "string" && node.arguments[0].value.length >= 100
    },
    {
      id: "char-fromcode",
      label: "String.fromCharCode chain",
      risk: 15,
      category: "obfuscation",
      desc: "Building strings from char codes (obfuscation technique)",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "String", "fromCharCode") && node.arguments.length > 5
    },
    {
      id: "wasm-module",
      label: "WebAssembly usage",
      risk: 15,
      category: "mining",
      desc: "WebAssembly can be used for crypto mining",
      match: (node) => node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "WebAssembly") && ["instantiate", "compile", "Module"].includes(node.callee?.property?.name)
    },
    {
      id: "worker-creation",
      label: "Web Worker creation",
      risk: 10,
      category: "mining",
      desc: "Workers can run background computations",
      match: (node) => node.type === "NewExpression" && isIdent(node.callee, "Worker")
    },
    {
      id: "form-submit",
      label: "Form auto-submit",
      risk: 15,
      category: "hijack",
      desc: "Automatically submits forms",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "submit" && node.arguments.length === 0
    },
    {
      id: "window-open",
      label: "window.open()",
      risk: 5,
      category: "hijack",
      desc: "Opens new windows/popups",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "window", "open")
    },
    {
      id: "location-assign",
      label: "Page redirect",
      risk: 10,
      category: "hijack",
      desc: "Redirects the page to another URL",
      match: (node) => node.type === "AssignmentExpression" && (isMember(node.left, "location", "href") || isIdent(node.left, "location")) || node.type === "CallExpression" && node.callee?.type === "MemberExpression" && isIdent(node.callee.object, "location") && ["assign", "replace"].includes(node.callee?.property?.name)
    },
    {
      id: "event-prevent",
      label: "Unload handler",
      risk: 10,
      category: "hijack",
      desc: "Prevents or intercepts page navigation",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "addEventListener" && node.arguments?.[0]?.type === "Literal" && ["beforeunload", "unload"].includes(node.arguments[0].value)
    },
    {
      id: "proto-pollution",
      label: "Prototype manipulation",
      risk: 25,
      category: "hijack",
      desc: "Modifying object prototypes can corrupt global state",
      match: (node) => node.type === "MemberExpression" && node.property?.name === "__proto__" || node.type === "CallExpression" && isMember(node.callee, "Object", "setPrototypeOf") || node.type === "MemberExpression" && node.property?.name === "prototype" && node._parent?.type === "MemberExpression"
    },
    {
      id: "document-domain",
      label: "document.domain assignment",
      risk: 20,
      category: "hijack",
      desc: "Changing document.domain relaxes same-origin restrictions",
      match: (node) => node.type === "AssignmentExpression" && isMember(node.left, "document", "domain")
    },
    {
      id: "postmessage-wildcard",
      label: "postMessage with wildcard origin",
      risk: 15,
      category: "hijack",
      desc: "Sending postMessage to any origin (*) can leak data to malicious frames",
      match: (node) => node.type === "CallExpression" && node.callee?.property?.name === "postMessage" && node.arguments?.[1]?.type === "Literal" && node.arguments[1].value === "*"
    },
    {
      id: "defineProperty-global",
      label: "Global property definition",
      risk: 10,
      category: "hijack",
      desc: "Defining properties on the global object can interfere with page code",
      match: (node) => node.type === "CallExpression" && isMember(node.callee, "Object", "defineProperty") && node.arguments?.[0]?.type === "Identifier" && ["window", "globalThis", "self", "unsafeWindow"].includes(node.arguments[0].name)
    }
  ];
  function isIdent(node, name) {
    return node?.type === "Identifier" && node.name === name;
  }
  function isMember(node, obj, prop) {
    return node?.type === "MemberExpression" && isIdent(node.object, obj) && node.property?.name === prop;
  }
  function handleInlineAnalyze(code) {
    try {
      if (code && code.length > 2e6) {
        return {
          totalRisk: 0,
          riskLevel: "unknown",
          findings: [],
          categories: {},
          summary: "Script too large for AST analysis",
          astAnalyzed: false,
          skipped: true
        };
      }
      return analyzeAST(code);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        totalRisk: 0,
        riskLevel: "unknown",
        findings: [],
        categories: {},
        summary: "Parse error: " + message,
        astAnalyzed: false,
        parseError: true
      };
    }
  }
  function analyzeAST(code) {
    const parser = getAcorn();
    let ast;
    try {
      ast = parser.parse(code, { ecmaVersion: 2022, sourceType: "script", allowHashBang: true, locations: true });
    } catch {
      ast = parser.parse(code, { ecmaVersion: 2022, sourceType: "module", allowHashBang: true, locations: true });
    }
    const hits = /* @__PURE__ */ new Map();
    const hitNodes = /* @__PURE__ */ new Map();
    walkAST(ast, (node) => {
      for (const pattern of AST_RISK_PATTERNS) {
        try {
          if (pattern.match(node)) {
            hits.set(pattern.id, (hits.get(pattern.id) || 0) + 1);
            if (!hitNodes.has(pattern.id) && node.loc) {
              hitNodes.set(pattern.id, { line: node.loc.start.line, col: node.loc.start.column });
            }
          }
        } catch {
        }
      }
    });
    const entropyResult = checkHighEntropyStrings(ast);
    const findings = [];
    let totalRisk = 0;
    for (const pattern of AST_RISK_PATTERNS) {
      const count = hits.get(pattern.id) || 0;
      if (count > 0) {
        const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
        totalRisk += adjustedRisk;
        findings.push({
          id: pattern.id,
          label: pattern.label,
          category: pattern.category,
          desc: pattern.desc,
          risk: pattern.risk,
          count,
          adjustedRisk,
          location: hitNodes.get(pattern.id) || null
        });
      }
    }
    if (entropyResult) {
      totalRisk += entropyResult.adjustedRisk;
      findings.push(entropyResult);
    }
    const riskLevel = totalRisk >= 80 ? "high" : totalRisk >= 40 ? "medium" : totalRisk >= 15 ? "low" : "minimal";
    const categories = {};
    for (const f of findings) {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(f);
    }
    return {
      totalRisk: Math.min(totalRisk, 100),
      riskLevel,
      findings,
      categories,
      summary: generateSummary(riskLevel, findings),
      astAnalyzed: true
    };
  }
  function parseESMImportsInline(code) {
    const parser = getAcorn();
    try {
      const ast = parser.parse(code, { ecmaVersion: 2022, sourceType: "module", allowHashBang: true, locations: true });
      const imports = [];
      const exports = [];
      const dynamicImports = [];
      const unsupportedExports = [];
      walkAST(ast, (node) => {
        if (node.type === "ImportDeclaration") {
          imports.push({
            start: node.start,
            end: node.end,
            source: node.source?.value || "",
            specifiers: (node.specifiers || []).map((spec) => {
              if (spec.type === "ImportDefaultSpecifier") {
                return { kind: "default", local: spec.local.name };
              }
              if (spec.type === "ImportNamespaceSpecifier") {
                return { kind: "namespace", local: spec.local.name };
              }
              return {
                kind: "named",
                imported: spec.imported?.name || spec.imported?.value,
                local: spec.local.name
              };
            })
          });
        } else if (node.type === "ImportExpression" || node.type === "CallExpression" && node.callee?.type === "Import") {
          dynamicImports.push({
            line: node.loc?.start?.line || null,
            column: node.loc?.start?.column || null
          });
        } else if (node.type === "ExportDefaultDeclaration") {
          const declaration = node.declaration;
          exports.push({
            kind: "default",
            start: node.start,
            end: node.end,
            declarationStart: declaration.start,
            declarationEnd: declaration.end,
            localName: declaration.id?.name || null
          });
        } else if (node.type === "ExportNamedDeclaration") {
          if (node.source) {
            unsupportedExports.push({ type: "re-export" });
          } else if (node.declaration) {
            exports.push({
              kind: "named-declaration",
              start: node.start,
              end: node.end,
              declarationStart: node.declaration.start,
              declarationEnd: node.declaration.end,
              names: declaredExportNames(node.declaration)
            });
          } else {
            exports.push({
              kind: "named-specifiers",
              start: node.start,
              end: node.end,
              declarationStart: node.start,
              declarationEnd: node.end,
              specifiers: (node.specifiers || []).map((spec) => ({
                local: spec.local?.name || spec.local?.value,
                exported: spec.exported?.name || spec.exported?.value
              }))
            });
          }
        } else if (node.type === "ExportAllDeclaration") {
          unsupportedExports.push({ type: "export-all" });
        }
      });
      return { imports, exports, dynamicImports, unsupportedExports };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: "ESM parse error: " + message };
    }
  }
  function declaredExportNames(declaration) {
    if (!declaration) return [];
    if ((declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") && declaration.id?.name) {
      return [declaration.id.name];
    }
    if (declaration.type === "VariableDeclaration") {
      const names = [];
      for (const decl of declaration.declarations || []) {
        collectPatternNames(decl.id, names);
      }
      return names;
    }
    return [];
  }
  function collectPatternNames(pattern, names) {
    if (!pattern) return;
    if (pattern.type === "Identifier") {
      names.push(pattern.name);
    } else if (pattern.type === "ObjectPattern") {
      for (const prop of pattern.properties || []) {
        collectPatternNames(prop.value || prop.argument, names);
      }
    } else if (pattern.type === "ArrayPattern") {
      for (const item of pattern.elements || []) {
        collectPatternNames(item, names);
      }
    } else if (pattern.type === "AssignmentPattern") {
      collectPatternNames(pattern.left, names);
    } else if (pattern.type === "RestElement") {
      collectPatternNames(pattern.argument, names);
    }
  }
  function walkAST(node, visitor, parent = null) {
    if (!node || typeof node !== "object") return;
    if (node.type) {
      node._parent = parent;
      visitor(node);
      delete node._parent;
    }
    for (const key of Object.keys(node)) {
      if (key === "_parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof c === "object" && c.type) walkAST(c, visitor, node);
        }
      } else if (child && typeof child === "object" && child.type) {
        walkAST(child, visitor, node);
      }
    }
  }
  function checkHighEntropyStrings(ast) {
    const longStrings = [];
    walkAST(ast, (node) => {
      if (node.type === "Literal" && typeof node.value === "string" && node.value.length >= 80) {
        longStrings.push(node.value);
      }
    });
    if (!longStrings.length) return null;
    let maxEntropy = 0;
    let maxStr = longStrings[0];
    for (const s of longStrings) {
      const entropy = calculateEntropy(s);
      if (entropy > maxEntropy) {
        maxEntropy = entropy;
        maxStr = s;
      }
    }
    const threshold = maxStr.length >= 200 ? 4.5 : 5.2;
    if (maxEntropy <= threshold) return null;
    return {
      id: "high-entropy",
      label: "High-entropy string detected",
      category: "obfuscation",
      desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${maxEntropy.toFixed(1)})`,
      risk: 20,
      count: longStrings.length,
      adjustedRisk: 20
    };
  }
  function mergeTextInline(base, local, remote) {
    if (base == null || local == null || remote == null) return { error: "Missing merge inputs" };
    if (local === remote) return { merged: local, conflicts: false };
    if (local === base) return { merged: remote, conflicts: false };
    if (remote === base) return { merged: local, conflicts: false };
    try {
      const diff = getDiff();
      const merged = diff.merge(local, remote, base);
      const hasConflicts = Array.isArray(merged.hunks) && merged.hunks.some(
        (hunk) => Array.isArray(hunk.lines) && hunk.lines.some((line) => typeof line === "object" && line !== null && line.conflict)
      );
      if (hasConflicts) {
        return { merged: resolveWithMarkers(local, remote), conflicts: true };
      }
      const mergedText = diff.applyPatch(base, merged);
      if (mergedText === false) {
        return { merged: resolveWithMarkers(local, remote), conflicts: true };
      }
      return { merged: mergedText, conflicts: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { merged: resolveWithMarkers(local, remote), conflicts: true, error: message };
    }
  }
  function resolveWithMarkers(local, remote) {
    return [
      "<<<<<<< LOCAL (your device)",
      local,
      "=======",
      remote,
      ">>>>>>> REMOTE (cloud)"
    ].join("\n");
  }
  function analyze(code) {
    const findings = [];
    let totalRisk = 0;
    const strippedCode = code.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const matches = strippedCode.match(pattern.regex);
      if (matches && matches.length > 0) {
        const count = matches.length;
        const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
        totalRisk += adjustedRisk;
        findings.push({ id: pattern.id, label: pattern.label, category: pattern.category, desc: pattern.desc, risk: pattern.risk, count, adjustedRisk });
      }
    }
    const longStrings = strippedCode.match(/['"][^'"]{80,}['"]/g);
    if (longStrings && longStrings.length > 0) {
      let maxEntropy = 0;
      let maxStr = longStrings[0];
      for (const s of longStrings) {
        const entropy = calculateEntropy(s);
        if (entropy > maxEntropy) {
          maxEntropy = entropy;
          maxStr = s;
        }
      }
      const threshold = maxStr.length >= 200 ? 4.5 : 5.2;
      if (maxEntropy > threshold) {
        findings.push({ id: "high-entropy", label: "High-entropy string detected", category: "obfuscation", desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${maxEntropy.toFixed(1)})`, risk: 20, count: longStrings.length, adjustedRisk: 20 });
        totalRisk += 20;
      }
    }
    const riskLevel = totalRisk >= 80 ? "high" : totalRisk >= 40 ? "medium" : totalRisk >= 15 ? "low" : "minimal";
    const categories = {};
    for (const f of findings) {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(f);
    }
    return { totalRisk: Math.min(totalRisk, 100), riskLevel, findings, categories, summary: generateSummary(riskLevel, findings), astAnalyzed: false };
  }
  function calculateEntropy(str) {
    const freq = {};
    for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
  function generateSummary(riskLevel, findings) {
    if (!findings.length) return "No suspicious patterns detected.";
    const cats = [...new Set(findings.map((f) => f.category))];
    const catLabels = { execution: "dynamic code execution", data: "data access", network: "network activity", fingerprint: "device fingerprinting", obfuscation: "code obfuscation", mining: "potential mining", hijack: "page manipulation" };
    return `Found ${findings.length} pattern(s) involving ${cats.map((c) => catLabels[c] ?? c).join(", ")}.`;
  }
  var ScriptAnalyzer = {
    analyzeAsync,
    analyzeESMImports,
    mergeText,
    _ensureOffscreen,
    _supportsOffscreen,
    _offscreenPromise: null,
    _inlineLibraryPromises: {},
    patterns,
    analyze,
    calculateEntropy,
    generateSummary
  };
  return module.exports.default || module.exports.ScriptAnalyzer || module.exports;
})();

// ============================================================================
// Generated from src/bg/esm-bundler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ESMUserscriptBundler = (() => {
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

  // src/bg/esm-bundler.ts
  var esm_bundler_exports = {};
  __export(esm_bundler_exports, {
    ESMUserscriptBundler: () => ESMUserscriptBundler,
    bundle: () => bundle,
    bundleIfNeeded: () => bundleIfNeeded,
    isESMMetadata: () => isESMMetadata,
    resolveImportSpecifier: () => resolveImportSpecifier,
    rewriteModuleSyntax: () => rewriteModuleSyntax
  });
  module.exports = __toCommonJS(esm_bundler_exports);
  function isESMMetadata(meta) {
    return !!meta && (meta.module === "1" || meta["inject-into"] === "module" || meta.esm === true);
  }
  function resolveImportSpecifier(specifier, parentUrl) {
    if (/^https?:\/\//i.test(specifier)) return specifier;
    if (/^[./]/.test(specifier) && /^https?:\/\//i.test(parentUrl || "")) {
      return new URL(specifier, parentUrl).toString();
    }
    throw new Error(`Unsupported ESM import specifier: ${specifier}`);
  }
  async function collectSyntaxViaOffscreen(code) {
    if (typeof ScriptAnalyzer !== "undefined" && typeof ScriptAnalyzer.analyzeESMImports === "function") {
      const result2 = await ScriptAnalyzer.analyzeESMImports(code);
      if (!result2 || result2.error) throw new Error(result2?.error || "ESM parse failed");
      if (Array.isArray(result2.dynamicImports) && result2.dynamicImports.length > 0) {
        const first = result2.dynamicImports[0];
        const where = first?.line ? ` at line ${first.line}` : "";
        throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
      }
      if (Array.isArray(result2.unsupportedExports) && result2.unsupportedExports.length > 0) {
        throw new Error(`Unsupported ESM export syntax: ${result2.unsupportedExports[0]?.type}`);
      }
      return result2;
    }
    if (typeof ScriptAnalyzer === "undefined" || !ScriptAnalyzer?._ensureOffscreen) {
      throw new Error("ESM bundler requires the offscreen Acorn parser");
    }
    const ready = await ScriptAnalyzer._ensureOffscreen();
    if (!ready) throw new Error("ESM bundler requires an Acorn parser");
    const result = await chrome.runtime.sendMessage({ type: "offscreen_esm_imports", code });
    if (!result || result.error) throw new Error(result?.error || "ESM parse failed");
    if (Array.isArray(result.dynamicImports) && result.dynamicImports.length > 0) {
      const first = result.dynamicImports[0];
      const where = first?.line ? ` at line ${first.line}` : "";
      throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
    }
    if (Array.isArray(result.unsupportedExports) && result.unsupportedExports.length > 0) {
      throw new Error(`Unsupported ESM export syntax: ${result.unsupportedExports[0]?.type}`);
    }
    return result;
  }
  function assertSupportedSyntax(analysis) {
    if (Array.isArray(analysis.dynamicImports) && analysis.dynamicImports.length > 0) {
      const first = analysis.dynamicImports[0];
      const where = first?.line ? ` at line ${first.line}` : "";
      throw new Error(`Dynamic import() is not supported by ScriptVault's ESM bundler${where}.`);
    }
    if (Array.isArray(analysis.unsupportedExports) && analysis.unsupportedExports.length > 0) {
      throw new Error(`Unsupported ESM export syntax: ${analysis.unsupportedExports[0]?.type}`);
    }
  }
  function importReplacement(imp) {
    const id = JSON.stringify(imp.resolvedSource || imp.source);
    if (!imp.specifiers || imp.specifiers.length === 0) {
      return `__require(${id});`;
    }
    const lines = [];
    const named = [];
    for (const spec of imp.specifiers) {
      if (spec.kind === "default") {
        lines.push(`const ${spec.local} = __require(${id}).default;`);
      } else if (spec.kind === "namespace") {
        lines.push(`const ${spec.local} = __require(${id});`);
      } else if (spec.kind === "named") {
        named.push(spec.imported === spec.local ? spec.imported : `${spec.imported}: ${spec.local}`);
      }
    }
    if (named.length) lines.push(`const { ${named.join(", ")} } = __require(${id});`);
    return lines.join("\n");
  }
  function exportReplacement(exp, code) {
    if (exp.kind === "named-specifiers") {
      return (exp.specifiers || []).map((spec) => `__exports.${spec.exported} = ${spec.local};`).join("\n");
    }
    const declaration = code.slice(exp.declarationStart, exp.declarationEnd);
    if (exp.kind === "default") {
      if (exp.localName) return [declaration, `__exports.default = ${exp.localName};`].join("\n");
      return `__exports.default = ${declaration};`;
    }
    const assignments = (exp.names || []).map((name) => `__exports.${name} = ${name};`).join("\n");
    return [declaration, assignments].join("\n");
  }
  function rewriteModuleSyntax(code, analysis) {
    const replacements = [];
    for (const imp of analysis.imports || []) {
      replacements.push({ start: imp.start, end: imp.end, text: importReplacement(imp) });
    }
    for (const exp of analysis.exports || []) {
      replacements.push({ start: exp.start, end: exp.end, text: exportReplacement(exp, code) });
    }
    replacements.sort((a, b) => b.start - a.start);
    let out = code;
    for (const item of replacements) {
      out = out.slice(0, item.start) + item.text + out.slice(item.end);
    }
    return out;
  }
  function buildBundle(entryCode, modules) {
    const moduleDefs = [...modules.values()].map((mod) => [
      `__modules[${JSON.stringify(mod.url)}] = function(__module, __exports, __require) {`,
      mod.code,
      "};"
    ].join("\n")).join("\n");
    return [
      "(function () {",
      "'use strict';",
      "const __modules = Object.create(null);",
      "const __cache = Object.create(null);",
      moduleDefs,
      "function __require(id) {",
      "  if (__cache[id]) return __cache[id].exports;",
      "  const factory = __modules[id];",
      '  if (!factory) throw new Error("Missing ESM module: " + id);',
      "  const module = { exports: {} };",
      "  __cache[id] = module;",
      "  factory(module, module.exports, __require);",
      "  return module.exports;",
      "}",
      "const __exports = {};",
      entryCode,
      "})();"
    ].filter(Boolean).join("\n");
  }
  async function bundleModule(url, code, context) {
    if (context.modules.has(url)) return;
    context.modules.set(url, { url, code: "" });
    const analysis = await context.collectSyntax(code);
    assertSupportedSyntax(analysis);
    for (const imp of analysis.imports || []) {
      imp.resolvedSource = resolveImportSpecifier(imp.source, url);
      const depCode = await context.fetchImport(imp.resolvedSource);
      if (!depCode) throw new Error(`Failed to fetch ESM import: ${imp.resolvedSource}`);
      await bundleModule(imp.resolvedSource, depCode, context);
    }
    context.modules.set(url, {
      url,
      code: rewriteModuleSyntax(code, analysis),
      bytes: code.length
    });
  }
  async function bundle(code, options = {}) {
    const entryUrl = options.sourceUrl || "scriptvault:entry";
    const context = {
      modules: /* @__PURE__ */ new Map(),
      fetchImport: options.fetchImport || fetchRequireScript,
      collectSyntax: options.collectSyntax || collectSyntaxViaOffscreen
    };
    const entryAnalysis = await context.collectSyntax(code);
    assertSupportedSyntax(entryAnalysis);
    for (const imp of entryAnalysis.imports || []) {
      imp.resolvedSource = resolveImportSpecifier(imp.source, entryUrl);
      const depCode = await context.fetchImport(imp.resolvedSource);
      if (!depCode) throw new Error(`Failed to fetch ESM import: ${imp.resolvedSource}`);
      await bundleModule(imp.resolvedSource, depCode, context);
    }
    const rewrittenEntry = rewriteModuleSyntax(code, entryAnalysis);
    return {
      code: buildBundle(rewrittenEntry, context.modules),
      imports: [...context.modules.values()].map((mod) => ({ url: mod.url, bytes: mod.bytes || 0 })),
      entryUrl
    };
  }
  async function bundleIfNeeded(code, meta, settings, options = {}) {
    if (!isESMMetadata(meta)) {
      return { bundled: false, code, imports: [], entryUrl: options.sourceUrl || "" };
    }
    if (!settings?.experimentalESMUserscripts) {
      throw new Error("ESM userscripts are experimental and require the experimentalESMUserscripts setting.");
    }
    const result = await bundle(code, options);
    return { bundled: true, ...result };
  }
  var ESMUserscriptBundler = {
    isESMMetadata,
    resolveImportSpecifier,
    rewriteModuleSyntax,
    bundle,
    bundleIfNeeded
  };
  return module.exports.default || module.exports.ESMUserscriptBundler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.ESMUserscriptBundler = ESMUserscriptBundler;
}

// ============================================================================
// Generated from src/bg/netlog.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const NetworkLog = (() => {
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

  // src/bg/netlog.ts
  var netlog_exports = {};
  __export(netlog_exports, {
    NetworkLog: () => NetworkLog
  });
  module.exports = __toCommonJS(netlog_exports);
  var NetworkLog = {
    _log: [],
    _maxEntries: 2e3,
    add(entry) {
      const full = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: Date.now(),
        ...entry
      };
      this._log.push(full);
      if (this._log.length > this._maxEntries) {
        this._log = this._log.slice(-this._maxEntries);
      }
    },
    getAll(filters = {}) {
      let results = [...this._log].reverse();
      if (filters.scriptId) {
        const scriptId = filters.scriptId;
        results = results.filter((e) => e.scriptId === scriptId);
      }
      if (filters.method) {
        const method = filters.method;
        results = results.filter((e) => e.method?.toUpperCase() === method.toUpperCase());
      }
      if (filters.domain) {
        const domain = filters.domain;
        results = results.filter((e) => {
          try {
            return new URL(e.url).hostname.includes(domain);
          } catch {
            return false;
          }
        });
      }
      if (filters.status) {
        if (filters.status === "error") {
          results = results.filter((e) => e.error || e.status != null && e.status >= 400);
        } else if (filters.status === "success") {
          results = results.filter((e) => !e.error && e.status != null && e.status < 400);
        }
      }
      return results.slice(0, filters.limit ?? 100);
    },
    getStats() {
      const byScript = {};
      const byDomain = {};
      let totalRequests = 0;
      let totalErrors = 0;
      let totalBytes = 0;
      for (const entry of this._log) {
        totalRequests++;
        if (entry.error || entry.status != null && entry.status >= 400) totalErrors++;
        totalBytes += entry.responseSize ?? 0;
        const sid = entry.scriptId ?? "unknown";
        const existingScript = byScript[sid];
        if (!existingScript) {
          byScript[sid] = { count: 0, errors: 0, bytes: 0, scriptName: entry.scriptName ?? sid };
        }
        const scriptEntry = byScript[sid];
        scriptEntry.count++;
        const isError = !!(entry.error || entry.status != null && entry.status >= 400);
        if (isError) scriptEntry.errors++;
        scriptEntry.bytes += entry.responseSize ?? 0;
        try {
          const domain = new URL(entry.url).hostname;
          const existingDomain = byDomain[domain];
          if (!existingDomain) {
            byDomain[domain] = { count: 0, errors: 0, bytes: 0 };
          }
          const domainEntry = byDomain[domain];
          domainEntry.count++;
          if (isError) domainEntry.errors++;
          domainEntry.bytes += entry.responseSize ?? 0;
        } catch {
        }
      }
      return { totalRequests, totalErrors, totalBytes, byScript, byDomain };
    },
    clear(scriptId) {
      if (scriptId) {
        this._log = this._log.filter((e) => e.scriptId !== scriptId);
      } else {
        this._log = [];
      }
    }
  };
  return module.exports.default || module.exports.NetworkLog || module.exports;
})();

// ============================================================================
// Generated from src/bg/signing.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptSigning = (() => {
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

  // src/bg/signing.ts
  var signing_exports = {};
  __export(signing_exports, {
    ScriptSigning: () => ScriptSigning
  });
  module.exports = __toCommonJS(signing_exports);
  var ScriptSigning = {
    // ── Key management ───────────────────────────────────────────────────────
    async getOrCreateKeypair() {
      const stored = await chrome.storage.local.get("signingKeypair");
      if (stored["signingKeypair"]) {
        return stored["signingKeypair"];
      }
      return this.generateAndStoreKeypair();
    },
    async generateAndStoreKeypair() {
      const keypair = await crypto.subtle.generateKey(
        { name: "Ed25519" },
        true,
        // extractable
        ["sign", "verify"]
      );
      const publicKeyJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);
      const privateKeyJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);
      const stored = { publicKeyJwk, privateKeyJwk };
      await chrome.storage.local.set({ signingKeypair: stored });
      return stored;
    },
    async getPublicKeyJwk() {
      const kp = await this.getOrCreateKeypair();
      return kp.publicKeyJwk;
    },
    // ── Signing ──────────────────────────────────────────────────────────────
    async signScript(code) {
      const kp = await this.getOrCreateKeypair();
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        kp.privateKeyJwk,
        { name: "Ed25519" },
        false,
        ["sign"]
      );
      const encoder = new TextEncoder();
      const signatureBuffer = await crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        encoder.encode(code)
      );
      const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const publicKeyB64 = kp.publicKeyJwk.x;
      return {
        signature: signatureB64,
        publicKey: publicKeyB64,
        algorithm: "Ed25519",
        timestamp: Date.now()
      };
    },
    // ── Verification ──────────────────────────────────────────────────────────
    async verifyScript(code, signatureInfo) {
      if (!signatureInfo?.signature || !signatureInfo?.publicKey) {
        return { valid: false, reason: "Missing signature or public key" };
      }
      try {
        const publicKeyJwk = {
          kty: "OKP",
          crv: "Ed25519",
          x: signatureInfo.publicKey,
          key_ops: ["verify"]
        };
        const publicKey = await crypto.subtle.importKey(
          "jwk",
          publicKeyJwk,
          { name: "Ed25519" },
          false,
          ["verify"]
        );
        const encoder = new TextEncoder();
        const sigB64 = signatureInfo.signature.replace(/-/g, "+").replace(/_/g, "/");
        const sigBytes = new Uint8Array(Array.from(atob(sigB64), (c) => c.charCodeAt(0)));
        const valid = await crypto.subtle.verify(
          { name: "Ed25519" },
          publicKey,
          sigBytes,
          encoder.encode(code)
        );
        if (!valid) return { valid: false, reason: "Signature verification failed" };
        const settings = await SettingsManager.get();
        const trustedKeys = settings.trustedSigningKeys ?? {};
        const trusted = Object.hasOwn(trustedKeys, signatureInfo.publicKey) ? trustedKeys[signatureInfo.publicKey] : null;
        return {
          valid: true,
          trusted: !!trusted,
          trustedName: trusted?.name ?? null,
          publicKey: signatureInfo.publicKey,
          timestamp: signatureInfo.timestamp
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { valid: false, reason: "Verification error: " + message };
      }
    },
    // ── Trust management ──────────────────────────────────────────────────────
    async trustKey(publicKey, name) {
      if (["__proto__", "constructor", "prototype"].includes(publicKey)) {
        return { error: "Invalid key" };
      }
      const settings = await SettingsManager.get();
      const trustedKeys = settings.trustedSigningKeys ?? {};
      trustedKeys[publicKey] = { name: name || publicKey.slice(0, 12) + "\u2026", addedAt: Date.now() };
      await SettingsManager.set({ trustedSigningKeys: trustedKeys });
      return { success: true };
    },
    async untrustKey(publicKey) {
      const settings = await SettingsManager.get();
      const trustedKeys = settings.trustedSigningKeys ?? {};
      delete trustedKeys[publicKey];
      await SettingsManager.set({ trustedSigningKeys: trustedKeys });
      return { success: true };
    },
    async getTrustedKeys() {
      const settings = await SettingsManager.get();
      return settings.trustedSigningKeys ?? {};
    },
    // ── Metadata embed helpers ────────────────────────────────────────────────
    // Signs a script and embeds the signature in the userscript metadata header.
    // Format: @signature <base64signature>|<base64pubkey>|<timestamp>
    async signAndEmbedInCode(code) {
      const stripped = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, "");
      const sig = await this.signScript(stripped);
      const sigLine = `// @signature ${sig.signature}|${sig.publicKey}|${sig.timestamp}`;
      if (stripped.includes("==/UserScript==")) {
        return stripped.replace(/(\/\/\s*==\/UserScript==)/, sigLine + "\n$1");
      }
      return sigLine + "\n" + stripped;
    },
    extractSignatureFromCode(code) {
      const match = code.match(/\/\/\s*@signature\s+([^\r\n]+)/);
      if (!match) return null;
      const matchedGroup = match[1];
      if (!matchedGroup) return null;
      const parts = matchedGroup.trim().split("|");
      const sig = parts[0];
      const pub = parts[1];
      if (!sig || !pub) return null;
      const tsStr = parts[2];
      return {
        signature: sig,
        publicKey: pub,
        timestamp: tsStr ? parseInt(tsStr, 10) : null
      };
    },
    async verifyCodeSignature(code) {
      const sigInfo = this.extractSignatureFromCode(code);
      if (!sigInfo) return { valid: false, reason: "No signature found in script" };
      const strippedCode = code.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g, "");
      return this.verifyScript(strippedCode, sigInfo);
    }
  };
  return module.exports.default || module.exports.ScriptSigning || module.exports;
})();

// ============================================================================
// Generated from src/bg/workspaces.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const WorkspaceManager = (() => {
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

  // src/bg/workspaces.ts
  var workspaces_exports = {};
  __export(workspaces_exports, {
    WorkspaceManager: () => WorkspaceManager
  });
  module.exports = __toCommonJS(workspaces_exports);
  var WorkspaceManager = {
    _cache: null,
    _initPromise: null,
    async _init() {
      if (this._cache !== null) return;
      if (!this._initPromise) {
        this._initPromise = (async () => {
          const data = await chrome.storage.local.get("workspaces");
          if (this._cache === null) {
            this._cache = data["workspaces"] || { active: null, list: [] };
          }
        })();
      }
      try {
        return await this._initPromise;
      } finally {
        this._initPromise = null;
      }
    },
    async _save() {
      await chrome.storage.local.set({ workspaces: this._cache });
    },
    async getAll() {
      await this._init();
      return { active: this._cache.active, list: this._cache.list };
    },
    async create(name) {
      await this._init();
      const scripts = await ScriptStorage.getAll();
      const snapshot = {};
      for (const s of scripts) {
        snapshot[s.id] = s.enabled !== false;
      }
      const workspace = {
        id: generateId(),
        name,
        snapshot,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this._cache.list.push(workspace);
      try {
        await this._save();
      } catch (e) {
        this._cache.list = this._cache.list.filter((w) => w.id !== workspace.id);
        throw e;
      }
      return workspace;
    },
    async update(id, updates) {
      await this._init();
      const ws = this._cache.list.find((w) => w.id === id);
      if (!ws) return null;
      const prev = { name: ws.name, updatedAt: ws.updatedAt };
      if (updates.name !== void 0) ws.name = updates.name;
      ws.updatedAt = Date.now();
      try {
        await this._save();
      } catch (e) {
        ws.name = prev.name;
        ws.updatedAt = prev.updatedAt;
        throw e;
      }
      return ws;
    },
    async save(id) {
      await this._init();
      const ws = this._cache.list.find((w) => w.id === id);
      if (!ws) return null;
      const scripts = await ScriptStorage.getAll();
      const prev = { snapshot: { ...ws.snapshot }, updatedAt: ws.updatedAt };
      ws.snapshot = {};
      for (const s of scripts) {
        ws.snapshot[s.id] = s.enabled !== false;
      }
      ws.updatedAt = Date.now();
      try {
        await this._save();
      } catch (e) {
        ws.snapshot = prev.snapshot;
        ws.updatedAt = prev.updatedAt;
        throw e;
      }
      return ws;
    },
    async activate(id) {
      await this._init();
      const ws = this._cache.list.find((w) => w.id === id);
      if (!ws) return { error: "Workspace not found" };
      const scripts = await ScriptStorage.getAll();
      const now = Date.now();
      const previousActive = this._cache.active;
      const changedScripts = [];
      try {
        for (const s of scripts) {
          const shouldBeEnabled = ws.snapshot[s.id];
          if (shouldBeEnabled !== void 0 && s.enabled !== false !== shouldBeEnabled) {
            changedScripts.push({ ...s });
            await ScriptStorage.set(s.id, { ...s, enabled: shouldBeEnabled, updatedAt: now });
          }
        }
        this._cache.active = id;
        await this._save();
      } catch (e) {
        this._cache.active = previousActive;
        for (const script of changedScripts.reverse()) {
          try {
            await ScriptStorage.set(script.id, script);
          } catch (rollbackError) {
            console.warn("[ScriptVault] Failed to roll back workspace activation for script:", script.id, rollbackError);
          }
        }
        throw e;
      }
      await registerAllScripts();
      await updateBadge();
      return { success: true, name: ws.name };
    },
    async delete(id) {
      await this._init();
      const index = this._cache.list.findIndex((w) => w.id === id);
      if (index === -1) return null;
      const removed = this._cache.list[index];
      this._cache.list.splice(index, 1);
      const previousActive = this._cache.active;
      if (this._cache.active === id) this._cache.active = null;
      try {
        await this._save();
      } catch (e) {
        this._cache.list.splice(index, 0, removed);
        this._cache.active = previousActive;
        throw e;
      }
      return removed;
    }
  };
  return module.exports.default || module.exports.WorkspaceManager || module.exports;
})();

// ============================================================================
// Generated from src/background/core.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

// @ts-nocheck
console.log('[ScriptVault] Service worker starting...');

// ============================================================================
// Debug Logger — conditional logging based on settings
// ============================================================================

/**
 * Log a debug message. Only outputs if debugMode is enabled in settings.
 * Falls back to no-op in production to avoid Chrome DevTools spam.
 * @param {...any} args - Arguments to log
 */
let _debugEnabled = false;
function debugLog(...args) {
  if (_debugEnabled) console.log('[ScriptVault]', ...args);
}
function debugWarn(...args) {
  if (_debugEnabled) console.warn('[ScriptVault]', ...args);
}
async function mergeScriptText(base, local, remote) {
  if (typeof ScriptAnalyzer !== 'undefined' && typeof ScriptAnalyzer.mergeText === 'function') {
    return ScriptAnalyzer.mergeText(base, local, remote);
  }
  if (typeof ScriptAnalyzer !== 'undefined' && typeof ScriptAnalyzer._ensureOffscreen === 'function') {
    const ready = await ScriptAnalyzer._ensureOffscreen();
    if (!ready) throw new Error('No script merge engine available');
    return chrome.runtime.sendMessage({
      type: 'offscreen_merge',
      base,
      local,
      remote
    });
  }
  throw new Error('No script merge engine available');
}

// Load debug setting on startup (async — logs before this completes go to console.log)
(async () => {
  try {
    const data = await chrome.storage.local.get('settings');
    _debugEnabled = data.settings?.debugMode === true;
  } catch {}
})();

// ============================================================================
// Session State — persist GM_* runtime maps to chrome.storage.session so
// onclose / onclick / onclose callbacks survive MV3 service-worker termination.
// chrome.storage.session is in-memory but persists across SW restarts within
// the browser session, which is exactly the GM_openInTab / GM_notification
// callback lifetime.
// ============================================================================
const SessionState = {
  _NC_KEY: 'sessionNotifCallbacks',
  _OTT_KEY: 'sessionOpenTabTrackers',
  _AWT_KEY: 'sessionAudioWatchedTabs',
  _hydrated: false,
  async hydrate() {
    if (this._hydrated) return;
    this._hydrated = true;
    if (!chrome?.storage?.session) return;
    try {
      const data = await chrome.storage.session.get([this._NC_KEY, this._OTT_KEY, this._AWT_KEY]);
      const nc = data[this._NC_KEY];
      if (nc && typeof nc === 'object') {
        if (!self._notifCallbacks) self._notifCallbacks = new Map();
        for (const [k, v] of Object.entries(nc)) self._notifCallbacks.set(k, v);
      }
      const ott = data[this._OTT_KEY];
      if (ott && typeof ott === 'object') {
        if (!self._openTabTrackers) self._openTabTrackers = new Map();
        for (const [k, v] of Object.entries(ott)) self._openTabTrackers.set(Number(k), v);
      }
      const awt = data[this._AWT_KEY];
      if (Array.isArray(awt)) {
        if (!self._audioWatchedTabs) self._audioWatchedTabs = new Set();
        for (const id of awt) self._audioWatchedTabs.add(id);
      }
    } catch (_) { /* session storage unavailable */ }
  },
  _persist(key, source) {
    if (!chrome?.storage?.session) return;
    let value;
    if (source instanceof Map) value = Object.fromEntries(source);
    else if (source instanceof Set) value = [...source];
    else value = source ?? null;
    chrome.storage.session.set({ [key]: value }).catch(() => {});
  },
  persistNotifCallbacks() { this._persist(this._NC_KEY, self._notifCallbacks); },
  persistOpenTabTrackers() { this._persist(this._OTT_KEY, self._openTabTrackers); },
  persistAudioWatchedTabs() { this._persist(this._AWT_KEY, self._audioWatchedTabs); },
};
self.SessionState = SessionState;

// ============================================================================
// Userscript Parser
// ============================================================================

/**
 * Parse a userscript's metadata block and extract all supported directives.
 * @param {string} code - The full userscript source code
 * @returns {{ meta?: Object, code?: string, metaBlock?: string, error?: string }} Parsed result or error
 */
function parseUserscript(code) {
  const metaBlockMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!metaBlockMatch) {
    return { error: 'No metadata block found. Scripts must include ==UserScript== header.' };
  }

  const meta = {
    name: 'Unnamed Script',
    namespace: 'scriptvault',
    version: '1.0.0',
    description: '',
    author: '',
    match: [],
    include: [],
    exclude: [],
    excludeMatch: [],
    // Phase 39.11 — TM #2784 top-level origin gates.
    matchTop: [],
    excludeTop: [],
    grant: [],
    require: [],
    requireProvenance: [],
    requireIdentity: [],
    resource: {},
    'run-at': 'document-idle',
    noframes: false,
    icon: '',
    icon64: '',
    homepage: '',
    homepageURL: '',
    website: '',
    source: '',
    updateURL: '',
    downloadURL: '',
    supportURL: '',
    connect: [],
    antifeature: [],
    unwrap: false,
    'inject-into': 'auto',
    module: '',
    sandbox: '',
    tag: [],
    'run-in': '',
    'top-level-await': false,
    license: '',
    copyright: '',
    contributionURL: '',
    compatible: [],
    incompatible: [],
    webRequest: null,
    priority: 0,
    weight: 0,
    crontab: ''
  };

  const metaBlock = metaBlockMatch[1];
  const lines = metaBlock.split('\n');

  for (const line of lines) {
    const match = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
    if (!match) continue;

    const key = match[1].trim();
    const value = (match[2] || '').trim();

    switch (key) {
      case 'name':
      case 'namespace':
      case 'version':
      case 'description':
      case 'author':
      case 'icon':
      case 'icon64':
      case 'homepage':
      case 'homepageURL':
      case 'website':
      case 'source':
      case 'updateURL':
      case 'downloadURL':
      case 'supportURL':
      case 'run-at':
      case 'inject-into':
      case 'module':
      case 'sandbox':
      case 'run-in':
      case 'license':
      case 'copyright':
      case 'contributionURL':
      case 'crontab':
        meta[key] = value;
        break;
      case 'match':
      case 'include':
      case 'exclude':
      case 'exclude-match':
      case 'excludeMatch':
      case 'grant':
      case 'require':
      case 'require-provenance':
      case 'requireProvenance':
      case 'require-identity':
      case 'requireIdentity':
      case 'connect':
      case 'antifeature':
      case 'tag':
      case 'compatible':
      case 'incompatible':
      // Phase 39.11 — TM #2784 top-level-origin gates. Patterns are matched
      // against window.top.location.href at runtime (in the wrapper). Same
      // array-directive shape as @match/@exclude so the parser, dedup, and
      // splittable-comma conveniences carry over.
      case 'match-top':
      case 'matchTop':
      case 'exclude-top':
      case 'excludeTop':
        const arrayKey = key === 'exclude-match' ? 'excludeMatch'
          : key === 'match-top' ? 'matchTop'
          : key === 'exclude-top' ? 'excludeTop'
          : key === 'require-provenance' ? 'requireProvenance'
          : key === 'require-identity' ? 'requireIdentity'
          : key;
        if (!meta[arrayKey]) meta[arrayKey] = [];
        if (value) {
          // Phase 36.6 — comma-separated convenience syntax for URL pattern
          // directives. Commas are not valid in match patterns per Chrome's
          // match syntax, so we can split safely. `tag` keeps raw values so
          // multi-word tags like `// @tag my util` stay intact.
          const splittable =
            arrayKey === 'match' ||
            arrayKey === 'include' ||
            arrayKey === 'exclude' ||
            arrayKey === 'excludeMatch' ||
            arrayKey === 'matchTop' ||
            arrayKey === 'excludeTop' ||
            arrayKey === 'requireProvenance' ||
            arrayKey === 'requireIdentity' ||
            arrayKey === 'connect';
          if (splittable && value.includes(',')) {
            for (const part of value.split(',')) {
              const trimmed = part.trim();
              if (trimmed) meta[arrayKey].push(trimmed);
            }
          } else {
            meta[arrayKey].push(value);
          }
        }
        break;
      case 'resource':
        const resourceMatch = value.match(/^(\S+)\s+(.+)$/);
        if (resourceMatch) {
          meta.resource[resourceMatch[1]] = resourceMatch[2];
        }
        break;
      case 'noframes':
        meta.noframes = true;
        break;
      case 'unwrap':
        meta.unwrap = true;
        break;
      case 'nodownload':
        meta.nodownload = true;
        break;
      case 'delay':
        meta.delay = Math.max(0, parseInt(value, 10) || 0);
        break;
      case 'top-level-await':
        meta['top-level-await'] = true;
        break;
      case 'priority':
        meta.priority = parseInt(value, 10) || 0;
        break;
      case 'weight': {
        // Phase 11.7 — Userscripts (Safari) `@weight 1..999`. Integer
        // injection priority where higher = earlier within the same
        // `@run-at`. Clamp to the documented range so an `@weight 99999`
        // typo can't dominate the sort.
        const w = parseInt(value, 10);
        if (Number.isFinite(w)) meta.weight = Math.max(1, Math.min(999, w));
        break;
      }
      case 'webRequest':
        try {
          // @webRequest accepts either a single rule object or an array of
          // rules. Normalize to array, then drop entries that don't match
          // the documented shape so the DNR rule builder downstream never
          // receives malformed input. Mirrors src/background/parser.ts.
          const raw = JSON.parse(value);
          const candidates = Array.isArray(raw) ? raw : [raw];
          const validated = [];
          for (const entry of candidates) {
            if (!entry || typeof entry !== 'object') continue;
            const action = entry.action;
            const selector = entry.selector;
            let validAction = false;
            if (typeof action === 'string' && action.length > 0) {
              validAction = true;
            } else if (action && typeof action === 'object') {
              if (typeof action.cancel === 'boolean' || typeof action.redirect === 'string') {
                validAction = true;
              }
            }
            if (!validAction) continue;
            if (selector != null && typeof selector !== 'object') continue;
            if (selector && typeof selector === 'object') {
              if (selector.include != null && !Array.isArray(selector.include)) continue;
              if (selector.exclude != null && !Array.isArray(selector.exclude)) continue;
            }
            validated.push(entry);
          }
          meta.webRequest = validated.length > 0 ? validated : null;
        } catch (e) {}
        break;
      default:
        // Handle localized metadata like @name:ja or @name:zh-Hans
        if (key.includes(':')) {
          const colonIdx = key.indexOf(':');
          const baseKey = key.slice(0, colonIdx);
          const locale = key.slice(colonIdx + 1);
          // SECURITY: reject prototype-pollution keys. A malicious script
          // with `// @name:__proto__ EVIL` would otherwise reach
          // `meta.localized["__proto__"]["name"] = "EVIL"` — the bracket
          // accessor returns Object.prototype, and the subsequent
          // `.name = ...` mutates it directly. That contaminates every
          // object in the SW context (e.g. `{}.name === "EVIL"`),
          // corrupting all downstream code that reads `.name`/`.constructor`/
          // `.toString` etc. via inheritance.
          const POLLUTED = ['__proto__', 'constructor', 'prototype'];
          if (baseKey && locale
              && !POLLUTED.includes(baseKey)
              && !POLLUTED.includes(locale)) {
            if (!meta.localized) meta.localized = Object.create(null);
            if (!Object.hasOwn(meta.localized, locale)) {
              meta.localized[locale] = Object.create(null);
            }
            meta.localized[locale][baseKey] = value;
          }
        }
    }
  }

  // Default grant if none specified
  if (meta.grant.length === 0) {
    meta.grant = ['none'];
  }
  meta.esm = meta.module === '1' || meta['inject-into'] === 'module';

  return { meta, code, metaBlock: metaBlockMatch[0] };
}

// ============================================================================
// URL Matching
// ============================================================================

// ============================================================================
// Update System
// ============================================================================

function _receiptArray(value) {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && item.length > 0);
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function _receiptHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function _receiptLineCount(code) {
  if (!code) return 0;
  return code.split(/\r\n|\r|\n/).length;
}

function _receiptLineDiff(previousCode, nextCode) {
  const previousLines = previousCode ? previousCode.split(/\r\n|\r|\n/) : [];
  const nextLines = nextCode ? nextCode.split(/\r\n|\r|\n/) : [];
  const previousCounts = new Map();
  for (const line of previousLines) {
    previousCounts.set(line, (previousCounts.get(line) || 0) + 1);
  }
  let unchangedLines = 0;
  for (const line of nextLines) {
    const count = previousCounts.get(line) || 0;
    if (count > 0) {
      unchangedLines++;
      if (count === 1) previousCounts.delete(line);
      else previousCounts.set(line, count - 1);
    }
  }
  return {
    previousLines: previousLines.length,
    nextLines: nextLines.length,
    addedLines: Math.max(0, nextLines.length - unchangedLines),
    removedLines: Math.max(0, previousLines.length - unchangedLines)
  };
}

function _receiptDiffList(previous, next) {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    added: next.filter(value => !previousSet.has(value)),
    removed: previous.filter(value => !nextSet.has(value)),
    unchanged: next.filter(value => previousSet.has(value))
  };
}

function _knownDependencySnapshots(previousScript) {
  const map = new Map();
  const deps = previousScript?.trustReceipt?.dependencies?.require || [];
  for (const dep of deps) {
    if (dep?.url) map.set(dep.url, dep);
  }
  return map;
}

function _receiptErrorMessage(error) {
  return error?.message || (typeof error === 'string' ? error : 'Dependency body unavailable');
}

async function _receiptDependencyProvenance(bundleUrl = '', identity = '', body = '', fetchProvenanceBundle = null) {
  if (!bundleUrl && !identity) return undefined;
  const base = {
    bundleUrl,
    identity,
    status: bundleUrl && identity
      ? 'declared'
      : bundleUrl
        ? 'missing-identity'
        : 'missing-bundle',
    verification: 'not-yet-implemented'
  };
  if (!bundleUrl || !identity || !body || typeof fetchProvenanceBundle !== 'function') return base;
  if (!self.SigstoreBundleVerifier?.verifyMessageSignature && typeof SigstoreBundleVerifier === 'undefined') {
    return { ...base, verification: 'signature-failed', error: 'Sigstore verifier unavailable' };
  }

  try {
    const bundle = await fetchProvenanceBundle(bundleUrl);
    if (typeof bundle !== 'string' || bundle.length === 0) {
      return { ...base, verification: 'bundle-unavailable', error: 'Provenance bundle unavailable' };
    }
    const verifier = self.SigstoreBundleVerifier || SigstoreBundleVerifier;
    const result = await verifier.verifyMessageSignature({ bundle, artifact: body, expectedIdentity: identity });
    return {
      ...base,
      verification: result.success
        ? 'signature-verified'
        : result.verification === 'unsupported-bundle'
          ? 'unsupported-bundle'
          : result.verification === 'root-verification-failed'
            ? 'root-verification-failed'
          : 'signature-failed',
      error: result.error,
      certificateIdentity: result.certificateIdentity,
      certificateIssuer: result.certificateIssuer,
      certificateNotBefore: result.certificateNotBefore,
      certificateNotAfter: result.certificateNotAfter,
      digestVerified: result.digestVerified,
      signatureVerified: result.signatureVerified,
      rootVerified: result.rootVerified
    };
  } catch (error) {
    return { ...base, verification: 'signature-failed', error: _receiptErrorMessage(error) };
  }
}

function _isVerifiedRequireProvenance(provenance) {
  return provenance?.verification === 'signature-verified' && provenance?.rootVerified === 'verified';
}

function _requireProvenancePreviewEntry(index, url, provenance) {
  return {
    index,
    url,
    bundleUrl: provenance?.bundleUrl || '',
    identity: provenance?.identity || '',
    status: provenance?.status || 'not-declared',
    verification: provenance?.verification || 'not-declared',
    error: provenance?.error || '',
    certificateIdentity: provenance?.certificateIdentity || '',
    certificateIssuer: provenance?.certificateIssuer || '',
    certificateNotBefore: provenance?.certificateNotBefore || '',
    certificateNotAfter: provenance?.certificateNotAfter || '',
    digestVerified: provenance?.digestVerified === true,
    signatureVerified: provenance?.signatureVerified === true,
    rootVerified: provenance?.rootVerified || ''
  };
}

function _summarizeRequireProvenancePreview(entries) {
  const counts = {
    total: entries.length,
    declared: 0,
    verified: 0,
    missing: 0,
    failed: 0,
    notDeclared: 0
  };

  for (const entry of entries) {
    if (entry.status === 'not-declared') {
      counts.notDeclared += 1;
      continue;
    }
    counts.declared += 1;
    if (_isVerifiedRequireProvenance(entry)) {
      counts.verified += 1;
    } else if (
      entry.status !== 'declared' ||
      ['signature-failed', 'root-verification-failed', 'bundle-unavailable', 'unsupported-bundle'].includes(entry.verification)
    ) {
      counts.failed += 1;
    } else {
      counts.missing += 1;
    }
  }

  let status = 'not-declared';
  if (counts.total === 0) status = 'no-requires';
  else if (counts.failed > 0 || counts.missing > 0) status = 'review-required';
  else if (counts.declared > 0 && counts.verified === counts.declared && counts.notDeclared === 0) status = 'verified';
  else if (counts.declared > 0 && counts.verified === counts.declared) status = 'partial';

  return { status, counts };
}

function _getRequireProvenanceFailure(receipt = {}) {
  const deps = receipt?.dependencies?.require || [];
  for (const dep of deps) {
    const provenance = dep?.provenance;
    if (!provenance) continue;
    if (_isVerifiedRequireProvenance(provenance)) continue;

    const reason = provenance.error
      || (provenance.status === 'missing-identity' ? 'missing @require-identity'
        : provenance.status === 'missing-bundle' ? 'missing @require-provenance'
        : provenance.verification === 'bundle-unavailable' ? 'bundle unavailable'
        : provenance.verification === 'unsupported-bundle' ? 'unsupported Sigstore bundle'
        : provenance.verification === 'root-verification-failed' ? 'Fulcio root verification failed'
        : provenance.verification === 'signature-failed' ? 'signature verification failed'
        : provenance.verification === 'not-yet-implemented' ? 'verification did not run'
        : 'verification incomplete');

    return {
      url: dep.url || '',
      provenance,
      message: `@require provenance verification failed for ${dep.url || 'dependency'}: ${reason}`
    };
  }
  return null;
}

async function previewRequireProvenance(data = {}) {
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const requireUrls = _receiptArray(data.requires || data.require || meta.require);
  const bundleUrls = _receiptArray(data.requireProvenance || meta.requireProvenance);
  const identities = _receiptArray(data.requireIdentity || meta.requireIdentity);
  const entries = [];

  for (let index = 0; index < requireUrls.length; index += 1) {
    const url = requireUrls[index];
    const bundleUrl = bundleUrls[index] || '';
    const identity = identities[index] || '';
    let provenance = null;

    if (!bundleUrl && !identity) {
      provenance = { bundleUrl: '', identity: '', status: 'not-declared', verification: 'not-declared' };
    } else if (!bundleUrl || !identity) {
      provenance = await _receiptDependencyProvenance(bundleUrl, identity, '', null);
    } else {
      try {
        const body = await fetchRequireScript(url);
        if (typeof body !== 'string' || body.length === 0) {
          provenance = {
            bundleUrl,
            identity,
            status: 'declared',
            verification: 'signature-failed',
            error: 'Dependency body unavailable'
          };
        } else {
          provenance = await _receiptDependencyProvenance(bundleUrl, identity, body, fetchProvenanceBundle);
        }
      } catch (error) {
        provenance = {
          bundleUrl,
          identity,
          status: 'declared',
          verification: 'signature-failed',
          error: _receiptErrorMessage(error)
        };
      }
    }

    entries.push(_requireProvenancePreviewEntry(index, url, provenance));
  }

  const summary = _summarizeRequireProvenancePreview(entries);
  return {
    success: true,
    status: summary.status,
    counts: summary.counts,
    entries
  };
}

async function _snapshotDependency(url, fetchDependencyBody, known, bundleUrl = '', identity = '', fetchProvenanceBundle = null) {
  const withProvenance = async (dependency, body = '') => {
    const provenance = await _receiptDependencyProvenance(bundleUrl, identity, body, fetchProvenanceBundle);
    return provenance ? { ...dependency, provenance } : dependency;
  };
  if (known?.sha256) return withProvenance(known);
  if (typeof fetchDependencyBody !== 'function') return withProvenance(known || { url });
  try {
    const body = await fetchDependencyBody(url);
    if (typeof body !== 'string') return withProvenance({ url, error: 'Dependency body unavailable' });
    return withProvenance({
      url,
      sha256: await _sha256Hex(body),
      bytes: new TextEncoder().encode(body).length
    }, body);
  } catch (error) {
    return withProvenance({ url, error: _receiptErrorMessage(error) });
  }
}

async function _snapshotDependencies(urls, fetchDependencyBody, known, bundleUrls = [], identities = [], fetchProvenanceBundle = null) {
  const snapshots = [];
  for (const [index, url] of urls.entries()) {
    snapshots.push(await _snapshotDependency(
      url,
      fetchDependencyBody,
      known.get(url),
      bundleUrls[index] || '',
      identities[index] || '',
      fetchProvenanceBundle
    ));
  }
  return snapshots;
}

function _receiptDependencyChanges(previous, next) {
  const previousMap = new Map(previous.map(dep => [dep.url, dep]));
  const nextMap = new Map(next.map(dep => [dep.url, dep]));
  const urls = [...previous.map(dep => dep.url), ...next.map(dep => dep.url).filter(url => !previousMap.has(url))];
  return urls.map(url => {
    const before = previousMap.get(url);
    const after = nextMap.get(url);
    let change = 'unverified';
    if (!before && after) change = 'added';
    else if (before && !after) change = 'removed';
    else if (before?.sha256 && after?.sha256) change = before.sha256 === after.sha256 ? 'unchanged' : 'changed';
    return {
      url,
      change,
      previousSha256: before?.sha256,
      nextSha256: after?.sha256,
      previousBytes: before?.bytes,
      nextBytes: after?.bytes,
      previousError: before?.error,
      nextError: after?.error
    };
  });
}

async function _sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text || ''));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function createScriptTrustReceipt({ operation, code, meta, sourceUrl = '', previousScript = null, rollbackIndex = -1, fetchDependencyBody = null, fetchProvenanceBundle = null, optionalPermissions = null }) {
  const installUrl = sourceUrl || meta.source || meta.downloadURL || meta.updateURL || '';
  const previousCode = previousScript?.code || '';
  const nextHash = await _sha256Hex(code);
  const previousHash = previousScript ? await _sha256Hex(previousCode) : '';
  const requireUrls = _receiptArray(meta.require);
  const requireProvenance = _receiptArray(meta.requireProvenance);
  const requireIdentity = _receiptArray(meta.requireIdentity);
  const previousRequireUrls = _receiptArray(previousScript?.meta?.require);
  const previousRequireProvenance = _receiptArray(previousScript?.meta?.requireProvenance);
  const previousRequireIdentity = _receiptArray(previousScript?.meta?.requireIdentity);
  const previousRequireSnapshots = await _snapshotDependencies(previousRequireUrls, fetchDependencyBody, _knownDependencySnapshots(previousScript), previousRequireProvenance, previousRequireIdentity, fetchProvenanceBundle);
  const requireSnapshots = await _snapshotDependencies(requireUrls, fetchDependencyBody, new Map(), requireProvenance, requireIdentity, fetchProvenanceBundle);
  const resources = meta.resource && typeof meta.resource === 'object'
    ? Object.entries(meta.resource)
        .filter(([, url]) => typeof url === 'string' && url.length > 0)
        .map(([name, url]) => ({ name, url }))
    : [];

  return {
    schemaVersion: 1,
    operation,
    createdAt: Date.now(),
    source: {
      installUrl,
      installHost: installUrl ? _receiptHost(installUrl) : '',
      updateUrl: meta.updateURL || '',
      downloadUrl: meta.downloadURL || '',
      homepageUrl: meta.homepage || meta.homepageURL || meta.website || ''
    },
    hashes: {
      sha256: nextHash,
      previousSha256: previousScript ? previousHash : undefined
    },
    grants: _receiptArray(meta.grant),
    hostScope: {
      match: _receiptArray(meta.match),
      include: _receiptArray(meta.include),
      exclude: _receiptArray(meta.exclude),
      excludeMatch: _receiptArray(meta.excludeMatch),
      connect: _receiptArray(meta.connect)
    },
    dependencies: {
      require: requireSnapshots,
      resource: resources,
      requireCount: requireUrls.length,
      resourceCount: resources.length
    },
    dependencyChanges: {
      require: _receiptDependencyChanges(previousRequireSnapshots, requireSnapshots)
    },
    permissionChanges: {
      grant: _receiptDiffList(_receiptArray(previousScript?.meta?.grant), _receiptArray(meta.grant)),
      connect: _receiptDiffList(_receiptArray(previousScript?.meta?.connect), _receiptArray(meta.connect)),
      match: _receiptDiffList(_receiptArray(previousScript?.meta?.match), _receiptArray(meta.match))
    },
    // Optional Chrome permissions the install page requested for grants like
    // GM_cookie / GM_setClipboard. `null` means the install path didn't
    // surface a prompt (older receipts, ScriptVault-internal saves, etc.).
    optionalPermissions: optionalPermissions && typeof optionalPermissions === 'object'
      ? {
          requested: Array.isArray(optionalPermissions.requested) ? optionalPermissions.requested.slice() : [],
          granted: Array.isArray(optionalPermissions.granted) ? optionalPermissions.granted.slice() : [],
          denied: Array.isArray(optionalPermissions.denied) ? optionalPermissions.denied.slice() : [],
          unavailable: Array.isArray(optionalPermissions.unavailable) ? optionalPermissions.unavailable.slice() : []
        }
      : null,
    diff: {
      previousVersion: previousScript?.meta?.version || '',
      nextVersion: meta.version || '',
      previousHash,
      nextHash,
      ..._receiptLineDiff(previousCode, code)
    },
    rollback: previousScript
      ? {
          available: true,
          action: 'rollbackScript',
          scriptId: previousScript.id,
          version: previousScript.meta?.version || '',
          updatedAt: previousScript.updatedAt || null,
          historyIndex: Number.isInteger(rollbackIndex) && rollbackIndex >= 0 ? rollbackIndex : null
        }
      : {
          available: false,
          action: 'rollbackScript',
          scriptId: '',
          version: '',
          updatedAt: null,
          historyIndex: null
        },
    lineCount: _receiptLineCount(code)
  };
}

const UpdateSystem = {
  // Phase 6.1 — exponential backoff bookkeeping. Per-script failure count
  // doubles the wait between retries (1m, 2m, 4m, …) up to a 24h cap so a
  // dead update URL doesn't consume bandwidth on every periodic alarm.
  // Successful checks (200 or 304) clear the count.
  _BACKOFF_BASE_MS: 60 * 1000,         // 1 minute
  _BACKOFF_MAX_MS: 24 * 60 * 60 * 1000, // 24 hours
  _MAX_BACKOFF_EXP: 10,                 // 2^10 * 1m = ~17 hours; capped by _BACKOFF_MAX_MS
  _FETCH_TIMEOUT_MS: 15 * 1000,
  _MAX_UPDATE_BYTES: 5 * 1024 * 1024,
  _PENDING_UPDATES_KEY: 'pendingUpdates',
  _MAX_PENDING_UPDATES: 50,
  _pendingUpdates: null,

  /** Compute the next-check timestamp for a failure-count value. */
  _nextRetryAt(failures) {
    const exp = Math.min(this._MAX_BACKOFF_EXP, Math.max(0, failures - 1));
    const wait = Math.min(this._BACKOFF_MAX_MS, this._BACKOFF_BASE_MS * (2 ** exp));
    return Date.now() + wait;
  },

  async fetchUpdateCandidate(updateUrl, fetchOptions = {}) {
    // Pre-flight: refuse update URLs that point at internal/loopback/link-local
    // hosts. Userscript update URLs are stored from prior installs, so this
    // catches both adversarial @updateURL metadata and rebinds that turned a
    // public host into an internal one between checks.
    const preCheck = InternalHostGuard.classifyFetchUrl(updateUrl, ['http:', 'https:']);
    if (!preCheck.ok) {
      throw new Error('Update URL rejected: ' + preCheck.message);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(updateUrl, { ...fetchOptions, signal: controller.signal });

      if (response.status === 304 || !response.ok) {
        return { response, code: '' };
      }

      // Post-flight: catch redirect targets that resolved to an internal host
      // even though the original update URL was external.
      const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
      if (!postCheck.ok) {
        throw new Error('Update URL redirected to ' + postCheck.message);
      }

      // Stream-bounded read: a hostile update server can omit/lie about
      // Content-Length and serve an unbounded body; _fetchTextBounded
      // cancels the stream the moment the running byte total exceeds the cap.
      const code = await _fetchTextBounded(response, this._MAX_UPDATE_BYTES, 'Update');

      return { response, code };
    } catch (e) {
      if (e?.name === 'AbortError') {
        throw new Error(`Update fetch timed out after ${Math.round(this._FETCH_TIMEOUT_MS / 1000)} seconds`);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async checkForUpdates(scriptId = null) {
    // A manual single-script check (caller passed scriptId) bypasses backoff —
    // user explicitly asked, so honor it and let them see fresh failure
    // surface immediately.
    const isManualSingle = !!scriptId;
    const scripts = scriptId
      ? [await ScriptStorage.get(scriptId)].filter(Boolean)
      : await ScriptStorage.getAll();

    const updates = [];
    const now = Date.now();

    for (const script of scripts) {
      if (script.meta.nodownload) continue; // @nodownload prevents auto-updates
      if (!script.meta.updateURL && !script.meta.downloadURL) continue;

      // Skip scripts in backoff cooldown (auto-update path only).
      if (!isManualSingle && script._updateNextCheck && script._updateNextCheck > now) {
        continue;
      }

      try {
        const updateUrl = script.meta.updateURL || script.meta.downloadURL;
        const headers = {};

        // Conditional request using stored etag/last-modified
        if (script._httpEtag) headers['If-None-Match'] = script._httpEtag;
        if (script._httpLastModified) headers['If-Modified-Since'] = script._httpLastModified;

        const { response, code: newCode } = await this.fetchUpdateCandidate(updateUrl, { headers });

        // 304 Not Modified — counts as success; clear any backoff state.
        if (response.status === 304) {
          if (script._updateFailureCount || script._updateNextCheck) {
            script._updateFailureCount = 0;
            script._updateNextCheck = 0;
            await ScriptStorage.set(script.id, script);
          }
          continue;
        }
        if (!response.ok) {
          // Non-2xx — record failure and bump the cooldown.
          script._updateFailureCount = (script._updateFailureCount || 0) + 1;
          script._updateNextCheck = this._nextRetryAt(script._updateFailureCount);
          await ScriptStorage.set(script.id, script);
          continue;
        }

        // Store HTTP cache headers for next check + clear backoff on success.
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        const hadBackoff = script._updateFailureCount || script._updateNextCheck;
        if (etag || lastModified) {
          script._httpEtag = etag || '';
          script._httpLastModified = lastModified || '';
        }
        if (hadBackoff) {
          script._updateFailureCount = 0;
          script._updateNextCheck = 0;
        }
        if (etag || lastModified || hadBackoff) {
          await ScriptStorage.set(script.id, script);
        }

        const parsed = parseUserscript(newCode);
        if (parsed.error) continue;

        if (this.compareVersions(parsed.meta.version, script.meta.version) > 0) {
          updates.push({
            id: script.id,
            name: script.meta.name,
            currentVersion: script.meta.version,
            newVersion: parsed.meta.version,
            code: newCode,
            sourceUrl: updateUrl
          });
        }
      } catch (e) {
        console.error('[ScriptVault] Update check failed for:', script.meta.name, e);
        // Network error counts as a failure too.
        script._updateFailureCount = (script._updateFailureCount || 0) + 1;
        script._updateNextCheck = this._nextRetryAt(script._updateFailureCount);
        try { await ScriptStorage.set(script.id, script); } catch (_) { /* best effort */ }
      }
    }

    return updates;
  },
  
  compareVersions(v1, v2) {
    // Strip pre-release suffix (e.g. "1.2.0-beta.1" → "1.2.0") before numeric comparison.
    // A version with a pre-release suffix is treated as less than the same version without one.
    const preRelease1 = v1.includes('-');
    const preRelease2 = v2.includes('-');
    const clean1 = (typeof v1 === 'string' ? v1 : String(v1)).replace(/-.*$/, '');
    const clean2 = (typeof v2 === 'string' ? v2 : String(v2)).replace(/-.*$/, '');
    const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    // Numeric parts are equal — a pre-release is less than a release of the same version
    if (preRelease1 && !preRelease2) return -1;
    if (!preRelease1 && preRelease2) return 1;
    return 0;
  },
  
  async applyUpdate(scriptId, newCode, { force = false, sourceUrl = '', fetchDependencyBody = null, fetchProvenanceBundle: fetchProvenanceBundleOption = null } = {}) {
    const script = await ScriptStorage.get(scriptId);
    if (!script) return { error: 'Script not found' };
    // Don't auto-update scripts the user has locally edited (unless force=true from forceUpdate)
    if (!force && script.settings?.userModified) return { skipped: true, reason: 'user-modified' };

    let parsed = parseUserscript(newCode);
    if (parsed.error) return parsed;
    const updateSettings = await SettingsManager.get();
    const bundleResult = await ESMUserscriptBundler.bundleIfNeeded(newCode, parsed.meta, updateSettings, { sourceUrl });
    if (bundleResult.bundled) {
      newCode = bundleResult.code;
      parsed = parseUserscript(newCode);
      if (parsed.error) return parsed;
      parsed.meta.esmBundle = {
        entryUrl: bundleResult.entryUrl,
        imports: bundleResult.imports,
        bundledAt: Date.now()
      };
    }
    const previousScript = {
      ...script,
      meta: { ...script.meta },
      code: script.code,
      updatedAt: script.updatedAt || Date.now()
    };

    // Store previous version for rollback (keep last 3)
    if (!script.versionHistory) script.versionHistory = [];
    const historyEntry = {
      version: script.meta.version,
      code: script.code,
      updatedAt: script.updatedAt || Date.now()
    };
    script.versionHistory.push(historyEntry);
    // Trim to last 5 versions
    if (script.versionHistory.length > 5) {
      script.versionHistory = script.versionHistory.slice(-5);
    }
    const rollbackIndex = script.versionHistory.indexOf(historyEntry);
    const trustReceipt = await createScriptTrustReceipt({
      operation: force ? 'manual-update' : 'auto-update',
      code: newCode,
      meta: parsed.meta,
      sourceUrl: sourceUrl || script.meta.downloadURL || script.meta.updateURL,
      previousScript,
      rollbackIndex,
      fetchDependencyBody: fetchDependencyBody || fetchRequireScript,
      fetchProvenanceBundle: fetchProvenanceBundleOption || fetchProvenanceBundle
    });
    const provenanceFailure = _getRequireProvenanceFailure(trustReceipt);
    if (provenanceFailure) {
      return { error: provenanceFailure.message };
    }
    historyEntry.trustReceipt = previousScript.trustReceipt || await createScriptTrustReceipt({
      operation: 'rollback-point',
      code: previousScript.code,
      meta: previousScript.meta,
      sourceUrl: previousScript.trustReceipt?.source?.installUrl || previousScript.meta.downloadURL || previousScript.meta.updateURL
    });

    script.code = newCode;
    script.meta = parsed.meta;
    script.updatedAt = Date.now();
    script.trustReceipt = trustReceipt;

    // Re-classify the install source. If the update came from a different
    // registry than the install, flag it for the dashboard banner.
    const updateSourceUrl = sourceUrl || parsed.meta.downloadURL || parsed.meta.updateURL || '';
    const updatedSource = classifyInstallSource(updateSourceUrl);
    if (script.installSource?.id && updatedSource.id !== 'local'
        && script.installSource.id !== updatedSource.id) {
      script.settings = { ...(script.settings || {}), sourceIdentityChanged: true };
      script.previousInstallSource = script.installSource;
      script.installSource = updatedSource;
    } else if (!script.installSource && updatedSource.id !== 'local') {
      script.installSource = updatedSource;
    }

    // Re-register FIRST so we can verify the new code works before persisting
    try {
      await unregisterScript(scriptId);
      if (script.enabled !== false) {
        await registerScript(script);
      }
    } catch (regError) {
      console.error(`[ScriptVault] Failed to re-register ${script.meta.name} after update:`, regError);
      // Registration failed — still save the updated code (user can manually fix)
      // but mark the failure so the UI can show it
      script.settings = script.settings || {};
      script.settings._registrationError = regError.message || 'Registration failed after update';
    }

    await ensurePersistentStorageForScriptWrite('script-update', newCode);

    // Persist to storage after registration attempt
    await ScriptStorage.set(scriptId, script);

    // Phase 12.10 — applyUpdate no longer fires a per-script OS notification.
    // Instead, the autoUpdate caller aggregates successful updates into a
    // single summary notification (or none, when notifyOnUpdate is off), and
    // pushes them onto the recent-updates ring so the dashboard can surface
    // an in-app banner. Manual single-script updates (popup "Check for
    // Update", dashboard force-update) get their feedback inline via the
    // returned { success, script } payload.
    return { success: true, script };
  },

  // Phase 12.10 — recently-applied updates ring buffer surfaced to the
  // dashboard via the `getRecentUpdates` background message. Capped at 20.
  _recentUpdates: [],

  async _loadPendingUpdates() {
    if (Array.isArray(this._pendingUpdates)) return this._pendingUpdates;
    const data = await chrome.storage.local.get(this._PENDING_UPDATES_KEY);
    this._pendingUpdates = Array.isArray(data[this._PENDING_UPDATES_KEY])
      ? data[this._PENDING_UPDATES_KEY].filter(item => item && item.id && typeof item.code === 'string')
      : [];
    return this._pendingUpdates;
  },

  async _savePendingUpdates(list = this._pendingUpdates) {
    const normalized = (Array.isArray(list) ? list : [])
      .filter(item => item && item.id && typeof item.code === 'string')
      .slice(0, this._MAX_PENDING_UPDATES);
    this._pendingUpdates = normalized;
    await chrome.storage.local.set({ [this._PENDING_UPDATES_KEY]: normalized });
    return normalized.slice();
  },

  _hasAddedPermission(permissionChanges = {}) {
    const changes = permissionChanges || {};
    return ['grant', 'connect', 'match'].some(key => {
      const group = changes[key] || {};
      return Array.isArray(group.added) && group.added.length > 0;
    });
  },

  _hasRiskyDependencyChange(dependencyChanges = {}) {
    const requireChanges = dependencyChanges.require || [];
    return requireChanges.some(change =>
      ['added', 'changed', 'unverified'].includes(change.change)
      || change.nextError
    );
  },

  _hasProvenanceReviewFlag(receipt = {}) {
    const deps = receipt.dependencies?.require || [];
    return deps.some(dep => {
      const provenance = dep?.provenance;
      if (!provenance) return false;
      if (provenance.status && provenance.status !== 'declared') return true;
      return ['signature-failed', 'root-verification-failed', 'bundle-unavailable', 'unsupported-bundle']
        .includes(provenance.verification || '');
    });
  },

  _getUpdateReviewReasons(receipt, sourceIdentityChanged) {
    const reasons = [];
    if (this._hasAddedPermission(receipt.permissionChanges)) {
      reasons.push('Adds permissions or host scope');
    }
    if (this._hasRiskyDependencyChange(receipt.dependencyChanges)) {
      reasons.push('Changes external dependencies');
    }
    if (this._hasProvenanceReviewFlag(receipt)) {
      reasons.push('Fails @require provenance verification');
    }
    if (sourceIdentityChanged) {
      reasons.push('Changes install source');
    }
    return reasons;
  },

  async _buildPendingUpdate(update, source = 'manual-check') {
    if (!update?.id || typeof update.code !== 'string') return null;
    const script = await ScriptStorage.get(update.id);
    if (!script) return null;
    const parsed = parseUserscript(update.code);
    if (parsed.error) return null;

    const sourceUrl = update.sourceUrl || parsed.meta.downloadURL || parsed.meta.updateURL || '';
    const nextSource = classifyInstallSource(sourceUrl);
    const previousSource = script.installSource || classifyInstallSource(script.meta?.downloadURL || script.meta?.updateURL || '');
    const sourceIdentityChanged = !!previousSource?.id
      && previousSource.id !== 'local'
      && nextSource.id !== 'local'
      && previousSource.id !== nextSource.id;
    const receipt = await createScriptTrustReceipt({
      operation: 'pending-update',
      code: update.code,
      meta: parsed.meta,
      sourceUrl,
      previousScript: script,
      fetchDependencyBody: fetchRequireScript,
      fetchProvenanceBundle
    });
    const reviewReasons = this._getUpdateReviewReasons(receipt, sourceIdentityChanged);
    const now = Date.now();

    return {
      kind: 'update',
      id: update.id,
      name: script.meta?.name || update.name || update.id,
      currentVersion: script.meta?.version || update.currentVersion || '',
      newVersion: parsed.meta.version || update.newVersion || '',
      code: update.code,
      sourceUrl,
      source,
      queuedAt: now,
      checkedAt: now,
      safeToApply: reviewReasons.length === 0,
      reviewReasons,
      sourceIdentityChanged,
      installSource: nextSource,
      previousInstallSource: previousSource,
      trustReceipt: receipt,
      dependencyChanges: receipt.dependencyChanges || { require: [] },
      permissionChanges: receipt.permissionChanges || null,
      diff: receipt.diff || null,
      sourceInfo: receipt.source || null,
      rollback: {
        ...(receipt.rollback || {}),
        available: Array.isArray(script.versionHistory) && script.versionHistory.length > 0,
        historyIndex: Array.isArray(script.versionHistory) && script.versionHistory.length > 0
          ? script.versionHistory.length - 1
          : null
      }
    };
  },

  async _buildPendingSubscriptionInstall(update, source = 'subscription') {
    if (!update?.id || typeof update.code !== 'string') return null;
    const parsed = parseUserscript(update.code);
    if (parsed.error) return null;

    const sourceUrl = update.sourceUrl || parsed.meta.downloadURL || parsed.meta.updateURL || '';
    const receipt = await createScriptTrustReceipt({
      operation: 'subscription-install',
      code: update.code,
      meta: parsed.meta,
      sourceUrl,
      fetchDependencyBody: fetchRequireScript,
      fetchProvenanceBundle
    });
    const now = Date.now();

    return {
      kind: 'subscription-install',
      id: update.id,
      name: parsed.meta.name || update.name || update.id,
      currentVersion: 'new',
      newVersion: parsed.meta.version || update.newVersion || '',
      code: update.code,
      sourceUrl,
      source,
      queuedAt: now,
      checkedAt: now,
      safeToApply: false,
      reviewReasons: ['New script from subscription'],
      sourceIdentityChanged: false,
      subscriptionId: update.subscriptionId || '',
      subscriptionName: update.subscriptionName || '',
      installSource: classifyInstallSource(sourceUrl),
      previousInstallSource: null,
      trustReceipt: receipt,
      dependencyChanges: receipt.dependencyChanges || { require: [] },
      permissionChanges: receipt.permissionChanges || null,
      diff: receipt.diff || null,
      sourceInfo: receipt.source || null,
      rollback: {
        available: false,
        action: 'rollbackScript',
        scriptId: '',
        version: '',
        updatedAt: null,
        historyIndex: null
      }
    };
  },

  async queueUpdates(updates = [], { source = 'manual-check' } = {}) {
    const incoming = Array.isArray(updates) ? updates : [];
    const existing = await this._loadPendingUpdates();
    const incomingIds = new Set(incoming.map(update => update?.id).filter(Boolean));
    const retained = existing.filter(item => !incomingIds.has(item.id));
    const queued = [];

    for (const update of incoming) {
      try {
        const pending = await this._buildPendingUpdate(update, source);
        if (pending) queued.push(pending);
      } catch (error) {
        console.warn('[ScriptVault] Failed to queue update:', update?.name || update?.id, error?.message || error);
      }
    }

    const pendingUpdates = await this._savePendingUpdates([...queued, ...retained]);
    return {
      success: true,
      queued: queued.length,
      pendingUpdates,
      safeCount: pendingUpdates.filter(item => item.safeToApply).length,
      reviewCount: pendingUpdates.filter(item => !item.safeToApply).length
    };
  },

  async queueSubscriptionInstalls(installs = [], { source = 'subscription' } = {}) {
    const incoming = Array.isArray(installs) ? installs : [];
    const existing = await this._loadPendingUpdates();
    const incomingIds = new Set(incoming.map(update => update?.id).filter(Boolean));
    const retained = existing.filter(item => !incomingIds.has(item.id));
    const queued = [];

    for (const install of incoming) {
      try {
        const pending = await this._buildPendingSubscriptionInstall(install, source);
        if (pending) queued.push(pending);
      } catch (error) {
        console.warn('[ScriptVault] Failed to queue subscription script:', install?.name || install?.id, error?.message || error);
      }
    }

    const pendingUpdates = await this._savePendingUpdates([...queued, ...retained]);
    return {
      success: true,
      queued: queued.length,
      pendingUpdates,
      safeCount: pendingUpdates.filter(item => item.safeToApply).length,
      reviewCount: pendingUpdates.filter(item => !item.safeToApply).length
    };
  },

  async getPendingUpdates() {
    return (await this._loadPendingUpdates()).slice();
  },

  async clearPendingUpdates(scriptId = null) {
    if (!scriptId) {
      await this._savePendingUpdates([]);
      return { success: true, cleared: 'all', pendingUpdates: [] };
    }
    const existing = await this._loadPendingUpdates();
    const next = existing.filter(item => item.id !== scriptId);
    const pendingUpdates = await this._savePendingUpdates(next);
    return { success: true, cleared: existing.length - next.length, pendingUpdates };
  },

  _recordRecentUpdates(entries) {
    const successful = (Array.isArray(entries) ? entries : []).filter(Boolean);
    if (successful.length === 0) return;
    this._recentUpdates = [...successful, ...this._recentUpdates].slice(0, 20);
  },

  async applyPendingUpdate(scriptId, { force = false } = {}) {
    const pendingUpdates = await this._loadPendingUpdates();
    const item = pendingUpdates.find(update => update.id === scriptId);
    if (!item) return { error: 'Pending update not found' };

    if (item.kind === 'subscription-install') {
      const result = await installFromCode(item.code, {
        sourceUrl: item.sourceUrl || '',
        operation: 'subscription-install'
      });
      if (result?.success) {
        await this.clearPendingUpdates(scriptId);
        this._recordRecentUpdates([{
          id: item.id,
          name: item.name,
          previousVersion: 'new',
          newVersion: item.newVersion,
          dependencyChanges: result.script?.trustReceipt?.dependencyChanges || item.dependencyChanges || { require: [] },
          permissionChanges: result.script?.trustReceipt?.permissionChanges || item.permissionChanges || null,
          appliedAt: Date.now()
        }]);
      }
      return result;
    }

    const result = await this.applyUpdate(scriptId, item.code, { force, sourceUrl: item.sourceUrl || '' });
    if (result?.success) {
      await this.clearPendingUpdates(scriptId);
      this._recordRecentUpdates([{
        id: item.id,
        name: item.name,
        previousVersion: item.currentVersion,
        newVersion: item.newVersion,
        dependencyChanges: result.script?.trustReceipt?.dependencyChanges || item.dependencyChanges || { require: [] },
        permissionChanges: result.script?.trustReceipt?.permissionChanges || item.permissionChanges || null,
        appliedAt: Date.now()
      }]);
    }
    return result;
  },

  async applySafePendingUpdates(scriptIds = null) {
    const idSet = Array.isArray(scriptIds) && scriptIds.length > 0 ? new Set(scriptIds) : null;
    const pendingUpdates = await this._loadPendingUpdates();
    const candidates = pendingUpdates.filter(item => item.safeToApply && (!idSet || idSet.has(item.id)));
    const results = [];

    for (const item of candidates) {
      try {
        results.push({
          id: item.id,
          result: await this.applyPendingUpdate(item.id, { force: false })
        });
      } catch (error) {
        results.push({ id: item.id, result: { error: error?.message || 'Update failed' } });
      }
    }

    const applied = results.filter(entry => entry.result?.success).length;
    const skipped = results.filter(entry => entry.result?.skipped).length;
    const failed = results.filter(entry => entry.result?.error).length;
    return {
      success: true,
      applied,
      skipped,
      failed,
      results,
      pendingUpdates: await this.getPendingUpdates()
    };
  },

  async autoUpdate() {
    const settings = await SettingsManager.get();
    if (!settings.autoUpdate) return;

    const updates = await this.checkForUpdates();
    const queueResult = await this.queueUpdates(updates, { source: 'auto-check' });
    let applyResult = null;
    if (settings.autoUpdateMode === 'apply-safe') {
      applyResult = await this.applySafePendingUpdates(updates.map(update => update.id));
    }

    const pendingAfter = applyResult?.pendingUpdates || queueResult.pendingUpdates;
    const reviewCount = pendingAfter.filter(item => updates.some(update => update.id === item.id)).length;
    const appliedCount = applyResult?.applied || 0;
    if ((queueResult.queued > 0 || appliedCount > 0) && settings.notifyOnUpdate) {
      const title = appliedCount > 0
        ? `${appliedCount} safe update${appliedCount === 1 ? '' : 's'} applied`
        : `${queueResult.queued} update${queueResult.queued === 1 ? '' : 's'} ready`;
      const messageParts = [];
      if (reviewCount > 0) messageParts.push(`${reviewCount} waiting in the Updates queue`);
      if (appliedCount > 0) messageParts.push(`${appliedCount} installed`);
      const message = messageParts.join(', ') || 'Open ScriptVault to review updates';
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title,
          message
        });
      } catch (_e) { /* notifications may be disabled; non-fatal */ }
    }

    await SettingsManager.set('lastUpdateCheck', Date.now());
  },

  /** Return the most recent successful auto-updates (newest first). */
  getRecentUpdates() {
    return this._recentUpdates.slice();
  },

  /** Clear the recent-updates ring (called when the dashboard banner is dismissed). */
  clearRecentUpdates() {
    this._recentUpdates = [];
  }
};

const LOCAL_HEALTH_SCHEMA = 'scriptvault-local-health/v1';
const LOCAL_HEALTH_STALE_REMOTE_MS = 180 * 24 * 60 * 60 * 1000;
const LOCAL_HEALTH_SLOW_SCRIPT_MS = 200;
const LOCAL_HEALTH_STORAGE_WARNING_PERCENT = 85;
const LOCAL_HEALTH_STORAGE_CRITICAL_PERCENT = 95;
const LOCAL_HEALTH_CALLBACK_WARNING_PERCENT = 80;

function _localHealthRoundPercent(value) {
  return Math.round(value * 10) / 10;
}

function _localHealthSanitizeError(error) {
  return error?.message || String(error || 'unknown error');
}

async function buildLocalHealthStorageSummary() {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
    return {
      available: false,
      usageBytes: 0,
      quotaBytes: 0,
      usagePercent: 0,
      usageFormatted: '0 B',
      quotaFormatted: '0 B',
      level: 'unavailable'
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usageBytes = Math.max(0, Number(estimate?.usage || 0));
    const quotaBytes = Math.max(0, Number(estimate?.quota || 0));
    const usagePercent = quotaBytes > 0 ? _localHealthRoundPercent((usageBytes / quotaBytes) * 100) : 0;
    const level = usagePercent >= LOCAL_HEALTH_STORAGE_CRITICAL_PERCENT
      ? 'critical'
      : usagePercent >= LOCAL_HEALTH_STORAGE_WARNING_PERCENT
        ? 'warning'
        : 'ok';

    return {
      available: true,
      usageBytes,
      quotaBytes,
      usagePercent,
      usageFormatted: formatBytes(usageBytes),
      quotaFormatted: formatBytes(quotaBytes),
      level
    };
  } catch (error) {
    return {
      available: false,
      usageBytes: 0,
      quotaBytes: 0,
      usagePercent: 0,
      usageFormatted: '0 B',
      quotaFormatted: '0 B',
      level: 'error',
      error: _localHealthSanitizeError(error)
    };
  }
}

function buildLocalHealthScriptSummary(scripts = []) {
  const now = Date.now();
  const summary = {
    total: scripts.length,
    enabled: 0,
    disabled: 0,
    registrationErrors: 0,
    scriptsWithExecutionErrors: 0,
    slowScripts: 0,
    staleRemoteScripts: 0,
    sourceIdentityChanged: 0,
    userModified: 0,
    syncLocked: 0,
    slowScriptThresholdMs: LOCAL_HEALTH_SLOW_SCRIPT_MS,
    staleRemoteThresholdDays: Math.round(LOCAL_HEALTH_STALE_REMOTE_MS / (24 * 60 * 60 * 1000))
  };

  for (const script of scripts) {
    if (script?.enabled === false) summary.disabled++;
    else summary.enabled++;

    if (script?.settings?._registrationError) summary.registrationErrors++;
    if ((script?.stats?.errors || 0) > 0) summary.scriptsWithExecutionErrors++;
    if ((script?.stats?.avgTime || 0) >= LOCAL_HEALTH_SLOW_SCRIPT_MS) summary.slowScripts++;
    if (script?.settings?.sourceIdentityChanged) summary.sourceIdentityChanged++;
    if (script?.settings?.userModified) summary.userModified++;
    if (script?.settings?.syncLock) summary.syncLocked++;

    const hasRemoteUpdateSource = !!(script?.meta?.updateURL || script?.meta?.downloadURL);
    if (hasRemoteUpdateSource && script?.updatedAt && now - script.updatedAt >= LOCAL_HEALTH_STALE_REMOTE_MS) {
      summary.staleRemoteScripts++;
    }
  }

  return summary;
}

function buildLocalHealthCallbackSummary() {
  const capSummary = (size, cap) => {
    const percentOfCap = cap > 0 ? _localHealthRoundPercent((size / cap) * 100) : 0;
    return {
      size,
      cap,
      percentOfCap,
      level: percentOfCap >= 100
        ? 'critical'
        : percentOfCap >= LOCAL_HEALTH_CALLBACK_WARNING_PERCENT
          ? 'warning'
          : 'ok'
    };
  };

  return {
    notificationCallbacks: capSummary(self._notifCallbacks?.size || 0, 500),
    openTabTrackers: capSummary(self._openTabTrackers?.size || 0, 1000),
    audioWatchedTabs: {
      size: self._audioWatchedTabs?.size || 0,
      level: 'ok'
    }
  };
}

function buildLocalHealthWarningList({ runtime, storage, scripts, updates, callbacks, collectionErrors }) {
  const warnings = [];
  const push = (id, level, message) => warnings.push({ id, level, message });

  if (runtime?.setupRequired) {
    push('userScriptsSetup', 'warning', runtime.setupMessage || 'UserScripts API setup requires attention');
  }
  if (storage?.level === 'warning' || storage?.level === 'critical') {
    push('storagePressure', storage.level, `Extension storage is ${storage.usagePercent}% full`);
  }
  if (scripts?.registrationErrors > 0) {
    push('registrationErrors', 'warning', `${scripts.registrationErrors} script registration error${scripts.registrationErrors === 1 ? '' : 's'} recorded`);
  }
  if (scripts?.scriptsWithExecutionErrors > 0) {
    push('executionErrors', 'warning', `${scripts.scriptsWithExecutionErrors} script${scripts.scriptsWithExecutionErrors === 1 ? '' : 's'} have recorded execution errors`);
  }
  if (scripts?.slowScripts > 0) {
    push('slowScripts', 'warning', `${scripts.slowScripts} script${scripts.slowScripts === 1 ? '' : 's'} average at least ${scripts.slowScriptThresholdMs}ms per run`);
  }
  if (scripts?.staleRemoteScripts > 0) {
    push('staleRemoteScripts', 'info', `${scripts.staleRemoteScripts} remote-backed script${scripts.staleRemoteScripts === 1 ? '' : 's'} have not been updated in ${scripts.staleRemoteThresholdDays}+ days`);
  }
  if (scripts?.sourceIdentityChanged > 0) {
    push('sourceIdentityChanged', 'warning', `${scripts.sourceIdentityChanged} script${scripts.sourceIdentityChanged === 1 ? '' : 's'} changed install source identity`);
  }
  if (updates?.reviewPendingUpdates > 0) {
    push('pendingUpdateReview', 'info', `${updates.reviewPendingUpdates} queued update${updates.reviewPendingUpdates === 1 ? '' : 's'} need review`);
  }
  for (const [id, block] of Object.entries(callbacks || {})) {
    if (block?.level === 'warning' || block?.level === 'critical') {
      push(id, block.level, `${id} is at ${block.percentOfCap}% of its cap`);
    }
  }
  for (const entry of collectionErrors || []) {
    push(entry.id, 'warning', entry.message);
  }

  return warnings;
}

async function buildLocalHealthReport() {
  const collectionErrors = [];
  const [runtimeResult, scriptsResult, pendingResult, recentResult, storageResult] = await Promise.allSettled([
    probeUserScriptsAvailability(),
    ScriptStorage.getAll(),
    UpdateSystem.getPendingUpdates(),
    Promise.resolve(UpdateSystem.getRecentUpdates()),
    buildLocalHealthStorageSummary()
  ]);

  const runtime = runtimeResult.status === 'fulfilled'
    ? runtimeResult.value
    : buildUserScriptsStatus({
        userScriptsAvailable: false,
        chromeVersion: _getChromeVersion(),
        probeError: _localHealthSanitizeError(runtimeResult.reason)
      });
  if (runtimeResult.status === 'rejected') {
    collectionErrors.push({ id: 'runtimeProbeFailed', message: 'Runtime setup probe failed' });
  }

  const scripts = scriptsResult.status === 'fulfilled' && Array.isArray(scriptsResult.value)
    ? buildLocalHealthScriptSummary(scriptsResult.value)
    : buildLocalHealthScriptSummary([]);
  if (scriptsResult.status === 'rejected') {
    collectionErrors.push({ id: 'scriptSummaryFailed', message: 'Script inventory health summary failed' });
  }

  const pendingUpdates = pendingResult.status === 'fulfilled' && Array.isArray(pendingResult.value)
    ? pendingResult.value
    : [];
  if (pendingResult.status === 'rejected') {
    collectionErrors.push({ id: 'pendingUpdatesFailed', message: 'Pending update queue health summary failed' });
  }
  const recentUpdates = recentResult.status === 'fulfilled' && Array.isArray(recentResult.value)
    ? recentResult.value
    : [];
  const updates = {
    pendingUpdates: pendingUpdates.length,
    safePendingUpdates: pendingUpdates.filter(item => item?.safeToApply).length,
    reviewPendingUpdates: pendingUpdates.filter(item => !item?.safeToApply).length,
    recentUpdates: recentUpdates.length,
    pendingCap: UpdateSystem._MAX_PENDING_UPDATES
  };

  const storage = storageResult.status === 'fulfilled'
    ? storageResult.value
    : {
        available: false,
        usageBytes: 0,
        quotaBytes: 0,
        usagePercent: 0,
        usageFormatted: '0 B',
        quotaFormatted: '0 B',
        level: 'error',
        error: _localHealthSanitizeError(storageResult.reason)
      };
  if (storageResult.status === 'rejected') {
    collectionErrors.push({ id: 'storageEstimateFailed', message: 'Storage estimate health summary failed' });
  }

  const callbacks = buildLocalHealthCallbackSummary();
  const warnings = buildLocalHealthWarningList({ runtime, storage, scripts, updates, callbacks, collectionErrors });

  return {
    schema: LOCAL_HEALTH_SCHEMA,
    generatedAt: new Date().toISOString(),
    privacy: {
      localOnly: true,
      includesScriptSource: false,
      includesScriptNames: false,
      includesUrls: false,
      includesExternalBeacons: false
    },
    runtime: {
      userScriptsAvailable: !!runtime.userScriptsAvailable,
      setupRequired: !!runtime.setupRequired,
      setupState: runtime.setupState,
      setupTitle: runtime.setupTitle,
      setupAction: runtime.setupAction,
      setupMessage: runtime.setupMessage,
      chromeVersion: runtime.chromeVersion,
      apiProbeError: runtime.apiProbeError || ''
    },
    storage,
    scripts,
    updates,
    callbacks,
    warnings
  };
}

// ============================================================================
// Script Subscriptions
// ============================================================================

const SubscriptionSystem = {
  _FETCH_TIMEOUT_MS: 15 * 1000,
  _MAX_FEED_BYTES: 512 * 1024,
  _MAX_SCRIPT_BYTES: MAX_SCRIPT_SIZE,
  _MAX_SCRIPTS_PER_REFRESH: 50,

  async fetchText(url, label, maxBytes) {
    InternalHostGuard.assertExternalFetchUrl(url, label, ['http:', 'https:']);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`${label} fetch failed with HTTP ${response.status}`);
      }
      const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
      if (!postCheck.ok) {
        throw new Error(`${label} redirected to ${postCheck.message}`);
      }
      return await _fetchTextBounded(response, maxBytes, label);
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`${label} fetch timed out after ${Math.round(this._FETCH_TIMEOUT_MS / 1000)} seconds`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async fetchFeed(url) {
    const feedUrl = ScriptSubscriptions.normalizeFeedUrl(url);
    const text = await this.fetchText(feedUrl, 'Subscription feed', this._MAX_FEED_BYTES);
    return ScriptSubscriptions.parseFeed(text, feedUrl);
  },

  async fetchScript(url) {
    const scriptUrl = ScriptSubscriptions.normalizeFeedUrl(url);
    return await this.fetchText(scriptUrl, 'Subscription script', this._MAX_SCRIPT_BYTES);
  },

  hashString(input) {
    let hash = 2166136261;
    const text = String(input || '');
    for (let i = 0; i < text.length; i++) {
      hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    }
    return hash.toString(36);
  },

  scriptIdentity(meta = {}) {
    const name = meta.name || '';
    if (!name) return '';
    return `${name}\n${meta.namespace || ''}`;
  },

  collectScriptSourceUrls(script) {
    return [
      script?.meta?.downloadURL,
      script?.meta?.updateURL,
      script?.trustReceipt?.source?.downloadUrl,
      script?.trustReceipt?.source?.updateUrl,
      script?.trustReceipt?.source?.installUrl,
      script?.installSource?.url
    ].filter(Boolean);
  },

  async buildInstallCandidates(subscription, scripts = []) {
    const installedScripts = await ScriptStorage.getAll();
    const installedIdentities = new Set();
    const installedSources = new Set();
    installedScripts.forEach(script => {
      const identity = this.scriptIdentity(script?.meta || {});
      if (identity) installedIdentities.add(identity);
      this.collectScriptSourceUrls(script).forEach(url => installedSources.add(url));
    });

    const pending = await UpdateSystem.getPendingUpdates();
    const pendingSources = new Set(pending.map(item => item.sourceUrl).filter(Boolean));
    const pendingIdentities = new Set(pending.map(item => item.kind === 'subscription-install' ? `${item.name || ''}\n` : '').filter(Boolean));
    const installs = [];
    const errors = [];
    let skipped = 0;

    for (const item of (Array.isArray(scripts) ? scripts : []).slice(0, this._MAX_SCRIPTS_PER_REFRESH)) {
      if (!item?.url) {
        skipped++;
        continue;
      }
      if (installedSources.has(item.url) || pendingSources.has(item.url)) {
        skipped++;
        continue;
      }
      const hintedIdentity = item.name ? `${item.name}\n${item.namespace || ''}` : '';
      if (hintedIdentity && (installedIdentities.has(hintedIdentity) || pendingIdentities.has(hintedIdentity))) {
        skipped++;
        continue;
      }

      try {
        const code = await this.fetchScript(item.url);
        const parsed = parseUserscript(code);
        if (parsed.error) {
          errors.push(`${item.url}: ${parsed.error}`);
          skipped++;
          continue;
        }
        const identity = this.scriptIdentity(parsed.meta || {});
        if (identity && (installedIdentities.has(identity) || pendingIdentities.has(identity))) {
          skipped++;
          continue;
        }
        if (identity) pendingIdentities.add(identity);
        pendingSources.add(item.url);
        installs.push({
          id: `subscription_${subscription.id}_${this.hashString(item.url || identity)}`,
          code,
          sourceUrl: item.url,
          name: parsed.meta?.name || item.name || item.url,
          newVersion: parsed.meta?.version || item.version || '',
          subscriptionId: subscription.id,
          subscriptionName: subscription.name
        });
      } catch (error) {
        errors.push(`${item.url}: ${error?.message || error}`);
        skipped++;
      }
    }

    return { installs, skipped, errors };
  },

  async list() {
    return {
      success: true,
      subscriptions: await ScriptSubscriptions.list()
    };
  },

  async addSubscription(url, name = '') {
    if (!url) return { success: false, error: 'Subscription URL is required' };
    try {
      const feed = await this.fetchFeed(url);
      const subscription = await ScriptSubscriptions.upsertFromFeed(feed.sourceUrl, feed, { name });
      return await this.refreshSubscription(subscription.id, { feed, subscription });
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  },

  async refreshSubscription(id, options = {}) {
    if (!id) return { success: false, error: 'Subscription id is required' };
    try {
      let subscription = options.subscription || await ScriptSubscriptions.get(id);
      if (!subscription) return { success: false, error: 'Subscription not found' };
      let feed = options.feed || null;
      if (!feed) {
        feed = await this.fetchFeed(subscription.url);
        subscription = await ScriptSubscriptions.upsertFromFeed(subscription.url, feed, {
          name: subscription.name,
          enabled: subscription.enabled
        });
      }

      const { installs, skipped, errors } = await this.buildInstallCandidates(subscription, feed.scripts);
      const queueResult = await UpdateSystem.queueSubscriptionInstalls(installs, {
        source: `subscription:${subscription.id}`
      });
      const updated = await ScriptSubscriptions.markRefreshResult(subscription.id, {
        queued: queueResult.queued,
        skipped,
        errors
      });

      return {
        success: true,
        subscription: updated || subscription,
        queued: queueResult.queued,
        skipped,
        errors,
        pendingUpdates: queueResult.pendingUpdates
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  },

  async refreshSubscriptions() {
    const subscriptions = await ScriptSubscriptions.list();
    const results = [];
    let queued = 0;
    let skipped = 0;
    const errors = [];

    for (const subscription of subscriptions.filter(item => item.enabled !== false)) {
      const result = await this.refreshSubscription(subscription.id);
      results.push(result);
      if (result?.success) {
        queued += result.queued || 0;
        skipped += result.skipped || 0;
        errors.push(...(result.errors || []));
      } else if (result?.error) {
        errors.push(`${subscription.name}: ${result.error}`);
      }
    }

    return {
      success: true,
      queued,
      skipped,
      errors,
      results,
      subscriptions: await ScriptSubscriptions.list(),
      pendingUpdates: await UpdateSystem.getPendingUpdates()
    };
  },

  async removeSubscription(id) {
    if (!id) return { success: false, error: 'Subscription id is required' };
    const removed = await ScriptSubscriptions.remove(id);
    return {
      success: true,
      removed,
      subscriptions: await ScriptSubscriptions.list()
    };
  }
};

// ============================================================================
// Cloud Sync
// ============================================================================

const CloudSync = {
  // Use providers from imported CloudSyncProviders module
  get providers() {
    return CloudSyncProviders;
  },

  _syncInProgress: false,
  // Phase 40.12 — Hoisted AbortController lets the 90s timeout actually cancel
  // the in-flight provider fetches (Promise.race alone does not cancel the
  // loser, leaving orphaned writes that can race a subsequent sync). Providers
  // that accept `opts.signal` short-circuit their fetches when the controller
  // aborts; providers that haven't been threaded yet still time out on their
  // own internal `fetch()` timeouts (slower fallback, but correct).
  _abortController: null,

  async sync() {
    // Prevent concurrent syncs — second call defers until first completes
    if (this._syncInProgress) {
      debugLog('[CloudSync] Sync already in progress, skipping');
      return { skipped: true };
    }
    this._syncInProgress = true;
    this._abortController = new AbortController();

    let _timeoutId;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        _timeoutId = setTimeout(() => {
          // Cancel any in-flight provider fetches before the race rejects.
          try { this._abortController.abort(new Error('Sync timed out after 90s')); } catch {}
          reject(new Error('Sync timed out after 90s'));
        }, 90000);
      });
      return await Promise.race([this._performSync({ signal: this._abortController.signal }), timeoutPromise]);
    } catch (e) {
      console.error('[ScriptVault] Sync failed:', e);
      return { error: e.message };
    } finally {
      clearTimeout(_timeoutId);
      this._syncInProgress = false;
      this._abortController = null;
    }
  },

  async _buildLocalData(tombstones = {}) {
    const scripts = await ScriptStorage.getAll();
    return {
      scripts,
      localData: {
        version: 1,
        timestamp: Date.now(),
        scripts: scripts.map(s => ({
          id: s.id,
          code: s.code,
          enabled: s.enabled,
          position: s.position,
          settings: s.settings || {},
          updatedAt: s.updatedAt,
          syncBaseCode: s.syncBaseCode ?? null,
          name: s.meta?.name || s.metadata?.name || s.name || s.id
        })),
        tombstones
      }
    };
  },

  async preview(providerName) {
    const settings = await SettingsManager.get();
    const selectedProvider = providerName || settings.syncProvider;
    if (!selectedProvider || selectedProvider === 'none') {
      return { success: false, error: 'Choose a sync provider first' };
    }
    const provider = this.providers[selectedProvider];
    if (!provider) return { success: false, error: `Unknown provider: ${selectedProvider}` };
    if (provider.supportsDryRun === false || typeof provider.download !== 'function') {
      return { success: false, error: `Dry-run preview is not available for ${provider.name || selectedProvider}` };
    }

    const tombstoneData = await chrome.storage.local.get('syncTombstones');
    const tombstones = tombstoneData.syncTombstones || {};
    const { localData } = await this._buildLocalData(tombstones);
    let remoteData = null;
    try {
      remoteData = await provider.download(settings);
    } catch (e) {
      return {
        success: false,
        provider: selectedProvider,
        providerLabel: provider.name || selectedProvider,
        error: e?.message || String(e)
      };
    }

    return {
      success: true,
      ...this.previewData(localData, remoteData, {
        provider: selectedProvider,
        providerLabel: provider.name || selectedProvider,
        lastSync: settings.lastSync || null
      })
    };
  },

  previewData(local, remote, options = {}) {
    const localScripts = Array.isArray(local?.scripts) ? local.scripts : [];
    const remoteScripts = Array.isArray(remote?.scripts) ? remote.scripts : [];
    const tombstones = { ...(local?.tombstones || {}), ...(remote?.tombstones || {}) };
    const localById = new Map(localScripts.map(script => [script.id, script]));
    const remoteById = new Map(remoteScripts.map(script => [script.id, script]));
    const ids = new Set([...localById.keys(), ...remoteById.keys()]);
    const summary = {
      localScripts: localScripts.length,
      remoteScripts: remoteScripts.length,
      localOnly: 0,
      remoteOnly: 0,
      localNewer: 0,
      remoteNewer: 0,
      unchanged: 0,
      tombstoned: 0,
      conflicts: 0,
      wouldUpload: false,
      wouldDownload: false
    };
    const conflicts = [];

    for (const id of ids) {
      if (tombstones[id]) {
        summary.tombstoned += 1;
        continue;
      }
      const localScript = localById.get(id);
      const remoteScript = remoteById.get(id);
      if (!localScript && remoteScript) {
        summary.remoteOnly += 1;
        continue;
      }
      if (localScript && !remoteScript) {
        summary.localOnly += 1;
        continue;
      }
      if (!localScript || !remoteScript) continue;

      const base = localScript.syncBaseCode;
      const localChanged = base != null && localScript.code !== base;
      const remoteChanged = base != null && remoteScript.code !== base;
      if (base != null && localChanged && remoteChanged && localScript.code !== remoteScript.code) {
        summary.conflicts += 1;
        if (conflicts.length < 20) {
          conflicts.push({
            id,
            name: localScript.name || remoteScript.name || id,
            localUpdatedAt: localScript.updatedAt || null,
            remoteUpdatedAt: remoteScript.updatedAt || null,
            reason: 'Both local and remote changed since the last sync base'
          });
        }
        continue;
      }

      if ((localScript.updatedAt || 0) > (remoteScript.updatedAt || 0)) {
        summary.localNewer += 1;
      } else if ((remoteScript.updatedAt || 0) > (localScript.updatedAt || 0)) {
        summary.remoteNewer += 1;
      } else {
        summary.unchanged += 1;
      }
    }

    summary.wouldUpload = summary.localOnly > 0 || summary.localNewer > 0 || summary.conflicts > 0 || !remote;
    summary.wouldDownload = summary.remoteOnly > 0 || summary.remoteNewer > 0 || summary.conflicts > 0;

    return {
      dryRun: true,
      noWrites: true,
      provider: options.provider || null,
      providerLabel: options.providerLabel || options.provider || null,
      lastSync: options.lastSync || null,
      remoteFound: !!remote,
      summary,
      conflicts
    };
  },

  async _performSync(opts = {}) {
    const { signal } = opts;
    const settings = await SettingsManager.get();
    if (!settings.syncEnabled || settings.syncProvider === 'none') return;
    if (signal?.aborted) throw new Error('Sync aborted');

    const provider = this.providers[settings.syncProvider];
    if (!provider) return;

    // Load tombstones (IDs of locally-deleted scripts, to prevent sync re-importing them)
    const tombstoneData = await chrome.storage.local.get('syncTombstones');
    const tombstones = tombstoneData.syncTombstones || {};

    // Get local data
    const scripts = await ScriptStorage.getAll();
    const localData = {
      version: 1,
      timestamp: Date.now(),
      scripts: scripts.map(s => ({
        id: s.id,
        code: s.code,
        enabled: s.enabled,
        position: s.position,
        settings: s.settings || {},
        updatedAt: s.updatedAt
      })),
      tombstones
    };

    // Get remote data
    const remoteData = await provider.download(settings, { signal });
    if (signal?.aborted) throw new Error('Sync aborted');

    if (remoteData) {
      // Merge tombstones from remote so deletions propagate across devices
      const mergedTombstones = { ...tombstones, ...(remoteData.tombstones || {}) };

      // Merge: prefer newer versions
      const merged = this.mergeData(localData, remoteData);

      // Apply merged data locally, skipping tombstoned (deleted) scripts
      // Uses 3-way text merge when both sides have changed since sync base.
      // Chrome routes through the offscreen document; Firefox runs Diff inline.
      for (const script of merged.scripts) {
        if (mergedTombstones[script.id]) continue; // deleted on some device, don't re-import
        const existing = await ScriptStorage.get(script.id);
        // Skip scripts marked as locally modified — user edits take precedence over remote
        if (existing?.settings?.userModified) continue;

        const remoteScript = remoteData.scripts?.find(s => s.id === script.id);
        const localScript = localData.scripts?.find(s => s.id === script.id);

        let codeToSave = script.code;
        let mergeConflict = false;

        // 3-way merge: both sides changed since last known base
        if (existing && remoteScript && localScript &&
            existing.code !== remoteScript.code &&
            existing.code !== localScript.code) {
          const base = existing.syncBaseCode ?? existing.code;
          if (base != null && base !== localScript.code && base !== remoteScript.code) {
            try {
              const mergeResult = await mergeScriptText(base, localScript.code, remoteScript.code);
              if (mergeResult && !mergeResult.error) {
                codeToSave = mergeResult.merged;
                mergeConflict = mergeResult.conflicts || false;
                debugLog(`[CloudSync] 3-way merge for ${script.id}: conflicts=${mergeConflict}`);
              }
            } catch (e) {
              debugLog('[CloudSync] 3-way merge failed, using timestamp winner:', e.message);
              // Fall back to last-write-wins but flag as potential conflict
              mergeConflict = true;
            }
          }
        }

        if (!existing || script.updatedAt > existing.updatedAt || mergeConflict) {
          const parsed = parseUserscript(codeToSave);
          if (!parsed.error) {
            await ScriptStorage.set(script.id, {
              id: script.id,
              code: codeToSave,
              meta: parsed.meta,
              enabled: script.enabled,
              position: script.position,
              settings: {
                ...(existing?.settings || {}),
                ...(mergeConflict ? { mergeConflict: true } : {})
              },
              updatedAt: Math.max(script.updatedAt, existing?.updatedAt || 0),
              createdAt: existing?.createdAt || script.updatedAt,
              syncBaseCode: codeToSave // record merged result as new base for future syncs
            });
          }
        }
      }

      // Apply remote tombstone deletions locally so a delete on another device
      // propagates to this one. Without this, a script deleted elsewhere keeps
      // running here (we'd merely stop re-importing it). Skip user-modified
      // scripts so local edits take precedence, matching the import path above.
      let deletedAny = false;
      for (const tombstonedId of Object.keys(mergedTombstones)) {
        if (tombstones[tombstonedId]) continue; // already deleted locally
        const existing = await ScriptStorage.get(tombstonedId);
        if (existing && !existing.settings?.userModified) {
          try { await unregisterScript(tombstonedId); } catch (_) { /* best effort */ }
          await ScriptStorage.delete(tombstonedId);
          deletedAny = true;
        }
      }

      // Persist merged tombstones locally
      if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
        await chrome.storage.local.set({ syncTombstones: mergedTombstones });
      }

      if (deletedAny) {
        try { await updateBadge(); } catch (_) { /* best effort */ }
      }

      // Upload merged data (includes tombstones)
      merged.timestamp = Date.now();
      merged.tombstones = mergedTombstones;
      if (signal?.aborted) throw new Error('Sync aborted');
      await provider.upload(merged, settings, { signal });
    } else {
      // First sync, just upload (include tombstones so remote gets deletion info)
      if (signal?.aborted) throw new Error('Sync aborted');
      await provider.upload(localData, settings, { signal });
    }

    await SettingsManager.set('lastSync', Date.now());
    return { success: true };
  },
  
  mergeData(local, remote) {
    const scriptsMap = new Map();
    const mergedTombstones = { ...(local.tombstones || {}), ...(remote.tombstones || {}) };

    // Add all local scripts
    for (const script of (local.scripts || [])) {
      scriptsMap.set(script.id, script);
    }

    // Merge remote scripts (prefer newer)
    for (const script of (remote.scripts || [])) {
      const existing = scriptsMap.get(script.id);
      if (!existing || script.updatedAt > existing.updatedAt) {
        scriptsMap.set(script.id, script);
      }
    }

    return {
      version: 1,
      timestamp: Date.now(),
      scripts: Array.from(scriptsMap.values()).filter(s => !mergedTombstones[s.id]),
      tombstones: mergedTombstones
    };
  }
};

async function buildSyncProviderHealth(providerName) {
  if (!providerName || providerName === 'none') {
    return {
      success: true,
      provider: 'none',
      providerLabel: 'Not configured',
      connected: false,
      status: 'not_configured',
      lastSync: null,
      canRevoke: false,
      canManualSync: false,
      canDryRun: false,
      storageDisclosure: null
    };
  }

  const provider = CloudSyncProviders[providerName];
  if (!provider) return { success: false, connected: false, error: `Unknown provider: ${providerName}` };

  const settings = await SettingsManager.get();
  let status = {};
  try {
    if (typeof provider.getStatus === 'function') {
      status = await provider.getStatus(settings);
    } else if (typeof provider.test === 'function') {
      const test = await provider.test(settings);
      status = {
        connected: test?.success === true || test?.ok === true,
        error: test?.error || test?.message || null
      };
    }
  } catch (e) {
    status = { connected: false, error: e?.message || String(e) };
  }

  let storageDisclosure = null;
  try {
    storageDisclosure = typeof provider.getStorageDisclosure === 'function'
      ? provider.getStorageDisclosure(settings)
      : null;
  } catch (_e) {
    storageDisclosure = null;
  }

  const connected = status?.connected === true || status?.success === true || status?.ok === true;
  return {
    success: true,
    provider: providerName,
    providerLabel: provider.name || providerName,
    connected,
    status: status?.status || (connected ? 'ok' : 'not_connected'),
    error: status?.error || null,
    user: status?.user || null,
    endpointHost: status?.endpointHost || null,
    lastSync: status?.lastSync || settings.lastSync || null,
    canRevoke: typeof provider.disconnect === 'function',
    canManualSync: provider.supportsManualSync !== false && typeof provider.upload === 'function',
    canDryRun: provider.supportsDryRun !== false && typeof provider.download === 'function',
    storageDisclosure
  };
}

// ============================================================================
// Import/Export
// ============================================================================

async function exportAllScripts(options = {}) {
  const {
    includeSettings = true,
    includeStorage = false
  } = options;
  const scripts = await ScriptStorage.getAll();
  const settings = includeSettings ? await SettingsManager.get() : null;

  const exportedScripts = await Promise.all(scripts.map(async s => {
    const entry = {
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
    if (includeSettings && s.settings && typeof s.settings === 'object') {
      entry.settings = { ...s.settings };
    }
    if (s.versionHistory && s.versionHistory.length > 0) {
      entry.versionHistory = s.versionHistory;
    }
    if (includeStorage) {
      const values = await ScriptValues.getAll(s.id);
      if (values && Object.keys(values).length > 0) {
        entry.storage = values;
      }
    }
    return entry;
  }));
  
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    ...(includeSettings ? { settings } : {}),
    scripts: exportedScripts
  };
}

async function ensurePersistentStorageForScriptWrite(reason, code = '') {
  try {
    if (typeof QuotaManager === 'undefined' || typeof QuotaManager.ensurePersistentStorageForWrite !== 'function') {
      return null;
    }
    const bytes = typeof code === 'string'
      ? new TextEncoder().encode(code).length
      : 0;
    return await QuotaManager.ensurePersistentStorageForWrite({ reason, bytes });
  } catch (error) {
    console.warn('[ScriptVault] Persistent storage request failed:', error?.message || error);
    return null;
  }
}

// Phase 39.31 — WECG #935 pre-emptive string clamping. Chrome's
// chrome.notifications.create() silently truncates `title` past ~100 chars
// and `message` past ~300 chars; chrome.contextMenus.create() truncates
// `title` past ~75 chars with ellipsis. WECG #935 proposes formalizing
// these limits, after which silent truncation may become an explicit error.
// Clamp at the source so a future spec change can't break us.
const SV_NOTIF_TITLE_MAX = 96;     // Chrome notification title cap
const SV_NOTIF_MESSAGE_MAX = 280;  // Chrome notification message cap
const SV_CONTEXT_MENU_TITLE_MAX = 64; // visible context-menu label
function _clampString(s, max) {
  if (typeof s !== 'string') return s;
  if (s.length <= max) return s;
  // Use a single ellipsis char so we land exactly on `max`.
  return s.slice(0, max - 1) + '\u2026';
}

// Phase 39.22 — bound any await chain that could deadlock on a CSP-strict /
// hung remote target (VM #2513). Rejects with a labelled timeout error after
// `ms` milliseconds; the caller is responsible for treating the rejection as
// a soft failure (Promise.allSettled, .catch, etc.).
function _withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    timeout
  ]);
}

// Stream-read a fetch Response body up to `maxBytes`, throwing if exceeded.
//
// The naive pattern `await response.text(); if (text.length > N) throw` buffers
// the *full* body into memory before checking — a malicious server that omits
// or lies about Content-Length can OOM the service worker (DoS) before the
// size check ever fires. content-length is a hint, not a guarantee.
//
// This helper reads the body in chunks and aborts the moment the running
// byte total exceeds the cap. The caller's AbortSignal (if any) is still
// honored via the response's own underlying reader.
//
// Returns the decoded text on success; throws `Error("<label> too large …")`
// if the body exceeds `maxBytes`. Falls back to a buffered `response.text()`
// only when `response.body` is unreadable (e.g. some test mocks return a
// Response without a stream).
async function _fetchTextBounded(response, maxBytes, label) {
  if (!response || typeof response.text !== 'function') {
    throw new Error(`${label}: invalid response`);
  }
  // content-length check first — it's still useful as a cheap pre-flight when
  // the server is honest.
  const declaredLen = parseInt(response.headers?.get?.('content-length') || '0', 10);
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    throw new Error(`${label} too large (${formatBytes(declaredLen)}). Maximum is ${formatBytes(maxBytes)}.`);
  }

  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    // No stream available (test mock, opaque response). Fall through to the
    // buffered path but still cap defensively.
    const text = await response.text();
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text).byteLength : 0;
    if (bytes > maxBytes) {
      throw new Error(`${label} too large (${formatBytes(bytes)}). Maximum is ${formatBytes(maxBytes)}.`);
    }
    return text;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const chunks = [];
  let bytesRead = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        // Cancel the underlying stream so the server stops sending. Defensive
        // try/catch — `cancel()` rejects on already-cancelled streams.
        try { await reader.cancel(); } catch (_e) { /* ignore */ }
        throw new Error(`${label} too large (${formatBytes(bytesRead)}+). Maximum is ${formatBytes(maxBytes)}.`);
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch (_e) { /* already released */ }
  }
  // Decode in a single pass to handle multi-byte UTF-8 sequences that span
  // chunk boundaries. `stream: false` flushes any pending state.
  // Concatenate chunks into one Uint8Array for the final decode.
  const total = new Uint8Array(bytesRead);
  let offset = 0;
  for (const c of chunks) {
    total.set(c, offset);
    offset += c.byteLength;
  }
  return decoder.decode(total);
}

// chrome.cookies.* only accepts http(s) URLs. Front-validate to give scripts a
// clear error instead of leaking the raw Chrome exception, and to reject
// chrome-extension://, javascript:, data:, blob:, file: payloads up-front.
function isHttpCookieUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const RESERVED_IMPORT_SCRIPT_IDS = new Set(['__proto__', 'prototype', 'constructor']);
function isSafeImportedScriptId(id) {
  return (
    typeof id === 'string' &&
    /^script_[A-Za-z0-9._:-]{1,160}$/.test(id) &&
    !RESERVED_IMPORT_SCRIPT_IDS.has(id)
  );
}

function allocateImportedScriptId(preferredId, usedScriptIds) {
  if (isSafeImportedScriptId(preferredId) && !usedScriptIds.has(preferredId)) {
    return preferredId;
  }
  let nextId;
  do {
    nextId = generateId();
  } while (usedScriptIds.has(nextId));
  return nextId;
}

async function importScripts(data, options = {}) {
  const {
    overwrite = false,
    importSettings = false,
    importStorage = false,
    recordReceipt = true,
    sourceLabel = ''
  } = options;
  const results = {
    imported: 0,
    skipped: 0,
    errors: [],
    settingsImported: false,
    storageImported: 0,
    replacedScripts: []
  };

  if (!data.scripts || !Array.isArray(data.scripts)) {
    return { error: 'Invalid import format' };
  }

  // Cache existing count once to avoid O(n²) getAll() inside the loop
  const allExistingScripts = await ScriptStorage.getAll();
  const usedScriptIds = new Set(allExistingScripts.map(script => script.id));
  let _importPosition = allExistingScripts.length;
  // Capture pre-import snapshot for receipt + rollback. Only the scripts and
  // values that will actually be replaced need to be retained, but it's
  // cheaper to snapshot once up-front than to look each one up later.
  const replacedSnapshots = [];
  const valuesSnapshots = {};

  for (const script of data.scripts) {
    const rawScriptId = script && typeof script === 'object' ? script.id : undefined;
    const requestedScriptId = isSafeImportedScriptId(rawScriptId) ? rawScriptId : '';
    const errorName = requestedScriptId || (typeof rawScriptId === 'string' ? rawScriptId : '<unknown>');
    try {
      if (!script || typeof script.code !== 'string') {
        results.errors.push({ name: errorName, error: 'Invalid script entry' });
        continue;
      }

      const parsed = parseUserscript(script.code);
      if (parsed.error) {
        results.errors.push({ name: errorName, error: parsed.error });
        continue;
      }

      const existing = requestedScriptId ? await ScriptStorage.get(requestedScriptId) : null;
      if (existing && !overwrite) {
        results.skipped++;
        continue;
      }

      const scriptId = existing?.id && isSafeImportedScriptId(existing.id)
        ? existing.id
        : allocateImportedScriptId(requestedScriptId, usedScriptIds);
      usedScriptIds.add(scriptId);

      const nextSettings = importSettings && script.settings && typeof script.settings === 'object'
        ? { ...script.settings }
        : { ...(existing?.settings || {}) };

      const importEntry = {
        id: scriptId,
        code: script.code,
        meta: parsed.meta,
        enabled: script.enabled !== false,
        settings: nextSettings,
        position: Number.isFinite(script.position) ? script.position : _importPosition++,
        createdAt: Number.isFinite(script.createdAt) ? script.createdAt : Date.now(),
        updatedAt: Number.isFinite(script.updatedAt) ? script.updatedAt : Date.now()
      };

      // Snapshot the prior script for both versionHistory and the receipt
      // rollback path before the overwrite happens.
      if (existing) {
        const priorClone = structuredClone(existing);
        replacedSnapshots.push(priorClone);
        try {
          const priorValues = await ScriptValues.getAll(scriptId);
          if (priorValues && Object.keys(priorValues).length > 0) {
            valuesSnapshots[scriptId] = structuredClone(priorValues);
          }
        } catch (_) { /* values snapshot is best effort */ }

        const inheritedHistory = Array.isArray(existing.versionHistory)
          ? [...existing.versionHistory]
          : [];
        inheritedHistory.push({
          version: existing.meta?.version || '',
          code: existing.code || '',
          updatedAt: existing.updatedAt || Date.now(),
          source: 'import',
          sourceLabel: sourceLabel || 'import'
        });
        if (inheritedHistory.length > 5) inheritedHistory.splice(0, inheritedHistory.length - 5);
        importEntry.versionHistory = inheritedHistory;
        results.replacedScripts.push({
          id: scriptId,
          name: existing.meta?.name || scriptId,
          priorVersion: existing.meta?.version || ''
        });
      } else if (script.versionHistory && Array.isArray(script.versionHistory)) {
        importEntry.versionHistory = script.versionHistory;
      }
      await ensurePersistentStorageForScriptWrite('script-import', importEntry.code);
      await ScriptStorage.set(scriptId, importEntry);
      if (importStorage) {
        const storedValues = script.storage && typeof script.storage === 'object' ? script.storage : {};
        if (Object.keys(storedValues).length > 0) {
          await ScriptValues.deleteAll(scriptId);
          await ScriptValues.setAll(scriptId, storedValues);
          results.storageImported++;
        } else if (existing) {
          await ScriptValues.deleteAll(scriptId);
        }
      }
      results.imported++;
    } catch (e) {
      results.errors.push({ name: errorName, error: e.message });
    }
  }
  
  // Import settings if present
  if (data.settings && importSettings) {
    await SettingsManager.set(data.settings);
    results.settingsImported = true;
  }

  // Re-register all scripts after import
  await registerAllScripts(true);
  await updateBadge();

  // Persist an import receipt so the user can roll back when overwrite=true
  // replaced existing scripts.
  if (recordReceipt && typeof BackupScheduler !== 'undefined' && replacedSnapshots.length > 0) {
    try {
      const scriptIdsBefore = allExistingScripts
        .map(script => script.id)
        .filter(id => typeof id === 'string');
      let scriptIdsAfter = [];
      try {
        const after = await ScriptStorage.getAll();
        scriptIdsAfter = after.map(script => script.id).filter(id => typeof id === 'string');
      } catch (_) {}
      const beforeIdSet = new Set(scriptIdsBefore);
      const addedScriptIds = scriptIdsAfter.filter(id => !beforeIdSet.has(id));
      const receiptMeta = await BackupScheduler.recordReceipt({
        type: 'import',
        source: 'import-json',
        sourceLabel: sourceLabel || 'JSON import (overwrite)',
        result: {
          imported: results.imported,
          skipped: results.skipped,
          replacedScripts: results.replacedScripts.length,
          errors: results.errors.slice()
        },
        snapshot: {
          scriptsBefore: replacedSnapshots,
          valuesBefore: valuesSnapshots,
          scriptIdsBefore,
          addedScriptIds
        }
      });
      if (receiptMeta) results.receiptId = receiptMeta.id;
    } catch (e) {
      console.warn('[ScriptVault] importScripts failed to persist receipt:', e);
    }
  }

  return results;
}

// Export to ZIP (Tampermonkey-compatible format)
async function exportToZip(options = {}) {
  const { includeStorage = true } = options;
  const scripts = await ScriptStorage.getAll();
  const files = {}; // fflate uses { filename: Uint8Array } format
  const usedNames = new Set();

  for (const script of scripts) {
    // Create safe filename, deduplicating collisions
    let safeName = (script.meta.name || 'unnamed')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    if (usedNames.has(safeName)) {
      let counter = 2;
      while (usedNames.has(`${safeName}_${counter}`)) counter++;
      safeName = `${safeName}_${counter}`;
    }
    usedNames.add(safeName);

    // Add the userscript file
    files[`${safeName}.user.js`] = fflate.strToU8(script.code);
    
    // Add options.json (Tampermonkey format)
    const scriptOptions = {
      scriptId: script.id,
      settings: {
        enabled: script.enabled,
        'run-at': script.meta['run-at'] || 'document-idle',
        override: {
          use_includes: [],
          use_matches: [],
          use_excludes: [],
          use_connects: [],
          merge_includes: true,
          merge_matches: true,
          merge_excludes: true,
          merge_connects: true
        }
      },
      meta: {
        name: script.meta.name,
        namespace: script.meta.namespace || '',
        version: script.meta.version || '1.0',
        description: script.meta.description || '',
        author: script.meta.author || '',
        match: script.meta.match || [],
        include: script.meta.include || [],
        exclude: script.meta.exclude || [],
        grant: script.meta.grant || [],
        require: script.meta.require || [],
        resource: script.meta.resource || {}
      }
    };
    files[`${safeName}.options.json`] = fflate.strToU8(JSON.stringify(scriptOptions, null, 2));
    
    // Add storage.json if script has stored values
    const values = includeStorage ? await ScriptValues.getAll(script.id) : null;
    if (values && Object.keys(values).length > 0) {
      const storage = { data: values };
      files[`${safeName}.storage.json`] = fflate.strToU8(JSON.stringify(storage, null, 2));
    }
  }
  
  // Generate zip as Uint8Array then convert to base64 in chunks (avoid stack overflow)
  const zipData = fflate.zipSync(files, { level: 6 });
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < zipData.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, zipData.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return { zipData: base64, filename: `scriptvault-archive-${new Date().toISOString().replace(/[:.]/g, '-')}.zip` };
}

// Import from ZIP (supports Tampermonkey and other formats)
async function importFromZip(zipData, options = {}) {
  const results = { imported: 0, skipped: 0, errors: [], replacedScripts: [] };
  const recordReceipt = options.recordReceipt !== false;
  const sourceLabel = typeof options.sourceLabel === 'string' && options.sourceLabel.trim()
    ? options.sourceLabel.trim()
    : 'ZIP import (overwrite)';
  // Pre-import snapshot for replaced scripts so the import is reversible.
  const replacedSnapshots = [];
  const valuesSnapshots = {};

  try {
    // Convert base64 to Uint8Array if needed
    let zipBytes;
    if (typeof zipData === 'string') {
      // Base64 string
      const binaryString = atob(zipData);
      zipBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        zipBytes[i] = binaryString.charCodeAt(i);
      }
    } else if (zipData instanceof ArrayBuffer) {
      zipBytes = new Uint8Array(zipData);
    } else {
      zipBytes = zipData;
    }

    // Load the zip file using fflate
    const unzipped = fflate.unzipSync(zipBytes);
    const fileNames = Object.keys(unzipped);

    // Find all .user.js files
    const userScripts = fileNames.filter(name => name.endsWith('.user.js'));
    const allExistingScripts = await ScriptStorage.getAll();
    const usedScriptIds = new Set(allExistingScripts.map(script => script.id));
    // Starting position for newly-imported scripts (avoids O(n²) getAll() per script)
    let _importPosition = allExistingScripts.length;

    for (const filename of userScripts) {
      try {
        const code = fflate.strFromU8(unzipped[filename]);

        // Validate it's a userscript
        if (!code.includes('==UserScript==')) {
          results.errors.push({ name: filename, error: 'Not a valid userscript' });
          continue;
        }

        const parsed = parseUserscript(code);
        if (parsed.error) {
          results.errors.push({ name: filename, error: parsed.error });
          continue;
        }

        // Look for associated options and storage files
        const baseName = filename.replace('.user.js', '');
        const optionsFileData = unzipped[`${baseName}.options.json`];
        const storageFileData = unzipped[`${baseName}.storage.json`];
        
        let enabled = true;
        let storedValues = {};
        let preferredScriptId = '';
        
        // Parse options file if exists
        if (optionsFileData) {
          try {
            const optionsData = JSON.parse(fflate.strFromU8(optionsFileData));
            enabled = optionsData.settings?.enabled !== false;
            preferredScriptId = isSafeImportedScriptId(optionsData.scriptId) ? optionsData.scriptId : '';
          } catch (e) {
            console.warn('Failed to parse options file:', e);
          }
        }
        
        // Parse storage file if exists
        if (storageFileData) {
          try {
            const storageData = JSON.parse(fflate.strFromU8(storageFileData));
            storedValues = storageData.data || storageData || {};
          } catch (e) {
            console.warn('Failed to parse storage file:', e);
          }
        }

        // Prefer ScriptVault's stable scriptId metadata when present. Name or
        // namespace can change over time, but backup restore should still
        // update the same script record.
        const existingById = preferredScriptId
          ? allExistingScripts.find(s => s.id === preferredScriptId)
          : null;
        const existing = existingById || allExistingScripts.find(s =>
          s.meta.name === parsed.meta.name &&
          (s.meta.namespace === parsed.meta.namespace || (!s.meta.namespace && !parsed.meta.namespace))
        );

        if (existing && !options.overwrite) {
          results.skipped++;
          continue;
        }

        // Create or update script
        let scriptId;
        if (existing?.id && isSafeImportedScriptId(existing.id)) {
          scriptId = existing.id;
        } else {
          scriptId = allocateImportedScriptId(preferredScriptId, usedScriptIds);
        }
        usedScriptIds.add(scriptId);
        const script = {
          id: scriptId,
          code: code,
          meta: parsed.meta,
          enabled: enabled,
          position: existing?.position ?? _importPosition++,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now()
        };

        // Snapshot before overwrite — feeds both versionHistory and the
        // restore receipt rollback path.
        if (existing) {
          const priorClone = structuredClone(existing);
          replacedSnapshots.push(priorClone);
          try {
            const priorValues = await ScriptValues.getAll(scriptId);
            if (priorValues && Object.keys(priorValues).length > 0) {
              valuesSnapshots[scriptId] = structuredClone(priorValues);
            }
          } catch (_) {}

          const inheritedHistory = Array.isArray(existing.versionHistory)
            ? [...existing.versionHistory]
            : [];
          inheritedHistory.push({
            version: existing.meta?.version || '',
            code: existing.code || '',
            updatedAt: existing.updatedAt || Date.now(),
            source: 'import',
            sourceLabel
          });
          if (inheritedHistory.length > 5) inheritedHistory.splice(0, inheritedHistory.length - 5);
          script.versionHistory = inheritedHistory;
          results.replacedScripts.push({
            id: scriptId,
            name: existing.meta?.name || scriptId,
            priorVersion: existing.meta?.version || ''
          });
        }

        await ensurePersistentStorageForScriptWrite(existing ? 'zip-import-update' : 'zip-import', script.code);
        await ScriptStorage.set(scriptId, script);

        // Import stored values
        if (Object.keys(storedValues).length > 0) {
          await ScriptValues.setAll(scriptId, storedValues);
        }

        results.imported++;
      } catch (e) {
        results.errors.push({ name: filename, error: e.message });
      }
    }
    
    // If no .user.js files found, try importing raw JS files
    if (userScripts.length === 0) {
      const jsFiles = fileNames.filter(name => 
        name.endsWith('.js') && !name.includes('/')
      );
      
      for (const filename of jsFiles) {
        try {
          const code = fflate.strFromU8(unzipped[filename]);
          if (!code.includes('==UserScript==')) continue;
          
          const parsed = parseUserscript(code);
          if (parsed.error) continue;
          
          const scriptId = generateId();
          await ensurePersistentStorageForScriptWrite('zip-import', code);
          await ScriptStorage.set(scriptId, {
            id: scriptId,
            code: code,
            meta: parsed.meta,
            enabled: true,
            position: _importPosition++,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          results.imported++;
        } catch (e) {
          results.errors.push({ name: filename, error: e.message });
        }
      }
    }
    
    await updateBadge();

    // Re-register all scripts after import
    await registerAllScripts(true);

    // Persist an import receipt if the import actually replaced existing
    // scripts. Backup-restore goes through restoreBackup which records its
    // own receipt; only standalone ZIP imports need their own receipt here.
    if (recordReceipt && typeof BackupScheduler !== 'undefined' && replacedSnapshots.length > 0) {
      try {
        const scriptIdsBefore = allExistingScripts
          .map(script => script.id)
          .filter(id => typeof id === 'string');
        let scriptIdsAfter = [];
        try {
          const after = await ScriptStorage.getAll();
          scriptIdsAfter = after.map(script => script.id).filter(id => typeof id === 'string');
        } catch (_) {}
        const beforeIdSet = new Set(scriptIdsBefore);
        const addedScriptIds = scriptIdsAfter.filter(id => !beforeIdSet.has(id));
        const receiptMeta = await BackupScheduler.recordReceipt({
          type: 'import',
          source: 'import-zip',
          sourceLabel,
          result: {
            imported: results.imported,
            skipped: results.skipped,
            replacedScripts: results.replacedScripts.length,
            errors: results.errors.slice()
          },
          snapshot: {
            scriptsBefore: replacedSnapshots,
            valuesBefore: valuesSnapshots,
            scriptIdsBefore,
            addedScriptIds
          }
        });
        if (receiptMeta) results.receiptId = receiptMeta.id;
      } catch (e) {
        console.warn('[ScriptVault] importFromZip failed to persist receipt:', e);
      }
    }

    return results;
  } catch (e) {
    console.error('[ScriptVault] importFromZip error:', e);
    return { ...results, error: e.message };
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

// USER_SCRIPT world message listener (for GM_* APIs)
// This is SEPARATE from onMessage and required for messaging: true to work
//
// Security: userscripts are semi-trusted code. Restrict this path to the
// action set the GM_* wrapper actually needs. Without this allowlist a
// malicious userscript could invoke privileged dashboard actions like
// factoryReset, deleteScript, importScripts, or setSettings.
const USER_SCRIPT_ALLOWED_EXTRAS = new Set([
  'netlog_record',
  'reportExecError',
  'reportExecTime'
]);
function isUserScriptAllowedAction(action) {
  if (typeof action !== 'string') return false;
  if (action.startsWith('GM_') || action.startsWith('GM.')) return true;
  return USER_SCRIPT_ALLOWED_EXTRAS.has(action);
}

// True when the dedicated user-script messaging API is available (Chrome 131+).
// On older runtimes the wrapper's chrome.runtime.sendMessage calls fall back to
// onMessage, so the same allowlist must gate tab-origin messages there.
const USER_SCRIPT_MESSAGING_AVAILABLE = typeof chrome !== 'undefined'
  && !!(chrome.runtime && chrome.runtime.onUserScriptMessage);

// Decide whether a chrome.runtime.onMessage sender represents a trusted
// extension surface (popup, dashboard, install page, sidebar) versus a tab
// context (content script or — on Chrome <131 — a user script falling back to
// onMessage). Extension surfaces may call any handleMessage action; tab
// contexts are restricted to the user-script allowlist.
function isExtensionSurfaceSender(sender) {
  if (!sender) return false;
  const extensionId = chrome.runtime?.id;
  if (!extensionId) return false;
  const ownExtensionPrefix = 'chrome-extension://' + extensionId + '/';
  const url = typeof sender.url === 'string' ? sender.url : '';
  if (url.startsWith(ownExtensionPrefix)) return true;
  // Service-worker → service-worker self-messages have no sender.tab/url; treat
  // them as trusted since only this extension's own code can originate them.
  if (sender.id === extensionId && !sender.tab && !url) return true;
  return false;
}

// Regular message listener (content scripts, popup, dashboard).
//
// Tab-origin messages are gated by isUserScriptAllowedAction so that, when the
// dedicated user-script channel is unavailable (Chrome <131 / Firefox without
// onUserScriptMessage), the same allowlist still applies. Extension surfaces
// (popup, dashboard, install page) keep full access.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isExtensionSurfaceSender(sender)) {
    if (!message || !isUserScriptAllowedAction(message.action)) {
      sendResponse({ error: 'Action not permitted from non-extension context' });
      return false;
    }
  }
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(e => {
      console.error('[ScriptVault] Unhandled message error:', e);
      sendResponse({ error: e.message });
    });
  return true;
});

function normalizeConnectHost(value) {
  if (typeof value !== 'string') return '';
  let pattern = value.trim().toLowerCase();
  if (!pattern) return '';
  if (pattern === '*' || pattern === 'self' || pattern === 'localhost') return pattern;

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pattern)) {
      pattern = new URL(pattern.replace(/\*/g, 'x')).hostname.toLowerCase();
    }
  } catch (_) {
    // Fall through to best-effort host extraction below.
  }

  pattern = pattern.replace(/^\/\//, '').split('/')[0].split('?')[0].split('#')[0];
  if (pattern.startsWith('*.')) pattern = pattern.slice(2);
  if (pattern.startsWith('x.')) pattern = pattern.slice(2);
  if (pattern.startsWith('.')) pattern = pattern.slice(1);
  if (pattern.startsWith('[') && pattern.includes(']')) {
    pattern = pattern.slice(1, pattern.indexOf(']'));
  } else {
    pattern = pattern.split(':')[0];
  }
  return pattern;
}

function hostMatchesConnectPattern(hostname, pattern) {
  const host = normalizeConnectHost(hostname);
  const target = normalizeConnectHost(pattern);
  if (!host || !target) return false;
  if (target === 'localhost') return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return host === target || host.endsWith('.' + target);
}

function selfConnectDomains(script) {
  const patterns = [
    ...(script?.meta?.match || []),
    ...(script?.meta?.include || [])
  ];
  return patterns.map(pattern => {
    try {
      return normalizeConnectHost(new URL(String(pattern).replace(/\*/g, 'x')).hostname);
    } catch (_) {
      return '';
    }
  }).filter(Boolean);
}

function evaluateConnectPolicy(script, requestUrl) {
  let hostname;
  try {
    hostname = new URL(requestUrl).hostname;
  } catch (_) {
    return { allowed: false, error: 'Invalid URL', hostname: '' };
  }

  const connectList = Array.isArray(script?.meta?.connect) ? script.meta.connect : [];
  if (connectList.length === 0 || connectList.some(pattern => String(pattern).trim() === '*')) {
    return { allowed: true, hostname };
  }

  const selfDomains = selfConnectDomains(script);
  const allowed = connectList.some(pattern => {
    const normalized = normalizeConnectHost(pattern);
    if (normalized === 'self') {
      return selfDomains.some(domain => hostMatchesConnectPattern(hostname, domain));
    }
    return hostMatchesConnectPattern(hostname, normalized);
  });

  return {
    allowed,
    hostname,
    error: allowed ? '' : `Connection to ${hostname} blocked by @connect policy`
  };
}

if (chrome.runtime.onUserScriptMessage) {
  chrome.runtime.onUserScriptMessage.addListener((message, sender, sendResponse) => {
    if (!message || !isUserScriptAllowedAction(message.action)) {
      sendResponse({ error: 'Action not permitted from user script' });
      return false;
    }
    handleMessage(message, sender)
      .then(sendResponse)
      .catch(e => {
        console.error('[ScriptVault] Unhandled user script message error:', e);
        sendResponse({ error: e.message });
      });
    return true;
  });
  debugLog('User script message listener registered');
}

async function handleMessage(message, sender) {
  // Wait for SW init (SettingsManager/ScriptStorage) to finish before handling
  // any message. Without this, fast popup/dashboard opens after wake can hit
  // handlers with uninitialised state and return empty results or throw.
  try { await ensureInitialized(); } catch (e) { /* init failure is logged in init() */ }
  const { action } = message;
  // Support both patterns: { action, data: { ... } } and { action, prop1, prop2, ... }
  const data = message.data || message;
  
  try {
    switch (action) {
      // Script Management
      case 'getScripts': {
        const scripts = await ScriptStorage.getAll();
        // Convert meta -> metadata for dashboard compatibility
        return { scripts: scripts.map(s => ({ ...s, metadata: s.meta })) };
      }
        
      case 'getScript': {
        const script = await ScriptStorage.get(data.id);
        if (script) {
          return { ...script, metadata: script.meta };
        }
        return null;
      }
        
      case 'saveScript': {
        if (data.code && data.code.length > MAX_SCRIPT_SIZE) {
          return { error: `Script too large (${formatBytes(data.code.length)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.` };
        }
        const parsed = parseUserscript(data.code);
        if (parsed.error) return { error: parsed.error };
        
        const id = data.id || data.scriptId || generateId();
        const existing = await ScriptStorage.get(id);
        
        const scriptSettings = { ...(existing?.settings || {}) };
        delete scriptSettings.mergeConflict;
        // Mark as locally modified when saved from editor — prevents sync from overwriting
        if (data.markModified) scriptSettings.userModified = true;
        const receiptOptions = data.trust && typeof data.trust === 'object' ? data.trust : null;
        const shouldRecordReceipt = !!receiptOptions?.recordReceipt || !!receiptOptions?.operation || !!receiptOptions?.sourceUrl;
        const previousScript = existing && existing.code !== data.code
          ? {
              ...existing,
              meta: { ...existing.meta },
              code: existing.code,
              updatedAt: existing.updatedAt || Date.now()
            }
          : null;
        const versionHistory = Array.isArray(existing?.versionHistory) ? [...existing.versionHistory] : [];
        let historyEntry = null;
        let rollbackIndex = -1;
        if (shouldRecordReceipt && previousScript) {
          historyEntry = {
            version: existing.meta.version,
            code: existing.code,
            updatedAt: existing.updatedAt || Date.now()
          };
          versionHistory.push(historyEntry);
          if (versionHistory.length > 5) {
            versionHistory.splice(0, versionHistory.length - 5);
          }
          rollbackIndex = versionHistory.indexOf(historyEntry);
        }
        const trustReceipt = shouldRecordReceipt
          ? await createScriptTrustReceipt({
              operation: receiptOptions?.operation || (existing ? 'update' : 'install'),
              code: data.code,
              meta: parsed.meta,
              sourceUrl: receiptOptions?.sourceUrl || '',
              previousScript,
              rollbackIndex,
              fetchDependencyBody: fetchRequireScript,
              fetchProvenanceBundle,
              optionalPermissions: receiptOptions?.optionalPermissions || null
            })
          : existing?.trustReceipt;
        const provenanceFailure = shouldRecordReceipt ? _getRequireProvenanceFailure(trustReceipt) : null;
        if (provenanceFailure) {
          return { error: provenanceFailure.message };
        }
        if (historyEntry && previousScript) {
          historyEntry.trustReceipt = previousScript.trustReceipt || await createScriptTrustReceipt({
            operation: 'rollback-point',
            code: previousScript.code,
            meta: previousScript.meta,
            sourceUrl: previousScript.trustReceipt?.source?.installUrl || previousScript.meta.downloadURL || previousScript.meta.updateURL
          });
        }

        const script = {
          ...existing,
          id,
          code: data.code,
          meta: parsed.meta,
          enabled: data.enabled !== undefined ? data.enabled : (existing?.enabled ?? true),
          settings: scriptSettings,
          position: existing?.position ?? (await ScriptStorage.getAll()).length,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
          trustReceipt
        };
        if (versionHistory.length > 0) script.versionHistory = versionHistory;
        
        await ensurePersistentStorageForScriptWrite(existing ? 'script-save' : 'script-create', script.code);
        await ScriptStorage.set(id, script);
        await updateBadge();

        // Re-register BEFORE reloading tabs so reloaded pages pick up the new
        // script. reregisterScript uses chrome.userScripts.update on Chrome
        // 138+ to avoid the unregister/register flicker; older Chrome falls
        // back to the explicit two-step cycle.
        await reregisterScript(script);

        // Live reload takes priority over debounced auto-reload (prevents double reload)
        try {
          const lrData = await chrome.storage.local.get('liveReloadScripts');
          if (lrData.liveReloadScripts?.[id]) {
            // Force reload all matching tabs immediately (new registration already active)
            const allTabs = await chrome.tabs.query({});
            for (const tab of allTabs) {
              if (tab.url && doesScriptMatchUrl(script, tab.url)) {
                try { chrome.tabs.reload(tab.id).catch(() => {}); } catch {}
              }
            }
          } else {
            // Debounced auto-reload for normal saves (gated by settings.autoReload)
            await autoReloadMatchingTabs(script);
          }
        } catch {
          // Fallback: attempt debounced auto-reload if live-reload check failed
          await autoReloadMatchingTabs(script);
        }

        const settings = await SettingsManager.get();
        if (!existing && settings.notifyOnInstall) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Script Installed',
            message: `${script.meta.name} v${script.meta.version}`
          });
        }
        
        // Return with metadata property for dashboard compatibility
        return { success: true, scriptId: id, script: { ...script, metadata: script.meta } };
      }
      
      case 'createScript': {
        // Create a new script - similar to saveScript but always generates new ID
        const parsed = parseUserscript(data.code);
        if (parsed.error) return { error: parsed.error };
        
        const id = generateId();
        const script = {
          id,
          code: data.code,
          meta: parsed.meta,
          enabled: true,
          position: (await ScriptStorage.getAll()).length,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        await ensurePersistentStorageForScriptWrite('script-create', script.code);
        await ScriptStorage.set(id, script);
        await updateBadge();

        // Register the new script
        await registerScript(script);
        
        const settings = await SettingsManager.get();
        if (settings.notifyOnInstall) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Script Created',
            message: `${script.meta.name} v${script.meta.version}`
          });
        }
        
        // Return scriptId for dashboard compatibility
        return { success: true, scriptId: id, script: { ...script, metadata: script.meta } };
      }
      
      case 'deleteScript': {
        const scriptId = data.id || data.scriptId;
        if (!scriptId) return { error: 'No script ID provided' };
        const script = await ScriptStorage.get(scriptId);
        if (!script) return { error: 'Script not found' };
        const settings = await SettingsManager.get();
        const trashMode = settings.trashMode || '30';

        if (trashMode !== 'disabled') {
          // Move to trash instead of permanent delete
          const trashData = await chrome.storage.local.get('trash');
          const trash = trashData.trash || [];
          trash.push({ ...script, trashedAt: Date.now() });
          await chrome.storage.local.set({ trash });
        }

        await unregisterScript(scriptId);
        await ScriptStorage.delete(scriptId);

        // Clean up menu commands for deleted script
        try {
          const cmdData = await chrome.storage.session.get('menuCommands');
          if (cmdData?.menuCommands?.[scriptId]) {
            delete cmdData.menuCommands[scriptId];
            await chrome.storage.session.set(cmdData);
          }
        } catch {}

        // Record tombstone so sync won't re-import this script from remote
        const tombstoneData = await chrome.storage.local.get('syncTombstones');
        const tombstones = tombstoneData.syncTombstones || {};
        tombstones[scriptId] = Date.now();
        await chrome.storage.local.set({ syncTombstones: tombstones });

        await updateBadge();
        return {
          success: true,
          scriptId,
          scriptName: script.meta?.name || scriptId
        };
      }

      case 'getTrash': {
        const trashData = await chrome.storage.local.get('trash');
        const trash = trashData.trash || [];
        // Clean expired entries
        const settings = await SettingsManager.get();
        const trashMode = settings.trashMode || '30';
        const maxAge = trashMode === '1' ? 86400000 : trashMode === '7' ? 604800000 : trashMode === '30' ? 2592000000 : 0;
        const now = Date.now();
        const valid = maxAge > 0 ? trash.filter(s => now - s.trashedAt < maxAge) : trash;
        if (valid.length !== trash.length) {
          await chrome.storage.local.set({ trash: valid });
        }
        return { trash: valid };
      }

      case 'restoreFromTrash': {
        const scriptId = data.scriptId;
        const trashData = await chrome.storage.local.get('trash');
        const trash = trashData.trash || [];
        const idx = trash.findIndex(s => s.id === scriptId);
        if (idx === -1) return { error: 'Not found in trash' };

        const script = trash[idx];
        delete script.trashedAt;
        trash.splice(idx, 1);
        await chrome.storage.local.set({ trash });
        await ScriptStorage.set(script.id, script);
        if (script.enabled !== false) await registerScript(script);
        await updateBadge();
        return { success: true };
      }

      case 'emptyTrash': {
        await chrome.storage.local.set({ trash: [] });
        return { success: true };
      }

      case 'restart': {
        chrome.runtime.reload();
        return { success: true };
      }

      case 'permanentlyDelete': {
        const scriptId = data.scriptId;
        const trashData = await chrome.storage.local.get('trash');
        const trash = trashData.trash || [];
        const filtered = trash.filter(s => s.id !== scriptId);
        await chrome.storage.local.set({ trash: filtered });
        return { success: true };
      }
        
      case 'toggleScript': {
        const scriptId = data.id || data.scriptId;
        // Per-script chained lock to prevent rapid toggle race conditions
        // Each toggle chains onto the previous one, ensuring serial execution
        if (!self._toggleLocks) self._toggleLocks = new Map();
        const prev = self._toggleLocks.get(scriptId) || Promise.resolve();
        const togglePromise = prev.then(async () => {
          const script = await ScriptStorage.get(scriptId);
          if (!script) {
            return { error: 'Script not found' };
          }

          script.enabled = data.enabled !== undefined ? !!data.enabled : !script.enabled;
          script.updatedAt = Date.now();
          await ScriptStorage.set(scriptId, script);

          // Toggle re-registration goes through reregisterScript so Chrome
          // 138+ swaps the registration in place when enabling/disabling
          // settings without dropping the script briefly.
          await reregisterScript(script);

          await updateBadge();

          try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              if (tab.url && doesScriptMatchUrl(script, tab.url)) {
                chrome.tabs.reload(tab.id).catch(() => {});
              }
            }
          } catch (e) {
            debugLog('Toggle reload failed:', e.message);
          }

          return {
            success: true,
            script: {
              id: script.id,
              enabled: script.enabled
            }
          };
        }).catch(e => {
          debugLog('Toggle error:', e);
          return { error: e?.message || 'Failed to update script' };
        }).finally(() => {
          // Clean up if this is still the latest promise (not superseded by a newer toggle)
          if (self._toggleLocks.get(scriptId) === togglePromise) {
            self._toggleLocks.delete(scriptId);
          }
        });
        self._toggleLocks.set(scriptId, togglePromise);
        return await togglePromise;
      }

      case 'importScript': {
        const parsed = parseUserscript(data.code);
        if (parsed.error) return { error: parsed.error };
        
        const id = generateId();
        const script = {
          id,
          code: data.code,
          meta: parsed.meta,
          enabled: true,
          position: (await ScriptStorage.getAll()).length,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        await ScriptStorage.set(id, script);
        await registerScript(script);
        await updateBadge();
        // Return with metadata property for dashboard compatibility
        return { success: true, script: { ...script, metadata: script.meta } };
      }

      case 'duplicateScript': {
        const newScript = await ScriptStorage.duplicate(data.id);
        if (newScript) {
          // Honor the duplicated script's `enabled` state — duplicating a disabled
          // script was silently re-enabling it because register was unconditional.
          if (newScript.enabled !== false) {
            await registerScript(newScript);
          }
          await updateBadge();
          // Return with metadata property for dashboard compatibility
          return { success: true, script: { ...newScript, metadata: newScript.meta } };
        }
        return { error: 'Script not found' };
      }
      
      case 'searchScripts': {
        const scripts = await ScriptStorage.search(data.query);
        return { scripts: scripts.map(s => ({ ...s, metadata: s.meta })) };
      }
        
      case 'reorderScripts':
        await ScriptStorage.reorder(data.orderedIds);
        return { success: true };
        
      // Script Values
      case 'GM_getValue':
        return await ScriptValues.get(data.scriptId, data.key, data.defaultValue);
        
      case 'GM_setValue':
        return await ScriptValues.set(data.scriptId, data.key, data.value, sender.tab?.id ?? null);
        
      case 'GM_deleteValue':
        await ScriptValues.delete(data.scriptId, data.key, sender.tab?.id ?? null);
        return { success: true };

      case 'deleteScriptValue':
        await ScriptValues.delete(data.scriptId, data.key);
        return { success: true };
        
      case 'GM_listValues':
        return await ScriptValues.list(data.scriptId);
        
      case 'GM_getValues':
        return await ScriptValues.getAll(data.scriptId);
        
      case 'GM_setValues':
        await ScriptValues.setAll(data.scriptId, data.values, sender.tab?.id ?? null);
        return { success: true };
        
      case 'GM_deleteValues':
        await ScriptValues.deleteMultiple(data.scriptId, data.keys, sender.tab?.id ?? null);
        return { success: true };
        
      case 'getScriptStorage':
      case 'getScriptValues': {
        const values = await ScriptValues.getAll(data.scriptId);
        return { values };
      }
        
      case 'setScriptStorage':
        await ScriptValues.setAll(data.scriptId, data.values);
        return { success: true };
        
      case 'getStorageSize':
        return await ScriptValues.getStorageSize(data.scriptId);
        
      // Tab Storage
      case 'GM_getTab':
        if (!sender.tab?.id) return {};
        return TabStorage.get(sender.tab.id);
        
      case 'GM_saveTab':
        if (!sender.tab?.id) return { error: 'GM_saveTab requires a tab context' };
        TabStorage.set(sender.tab.id, data.data);
        return { success: true };
        
      case 'GM_getTabs':
        return TabStorage.getAll();
        
      // Settings
      case 'prefetchResources': {
        await ResourceCache.prefetchResources(data.resources);
        return { success: true };
      }

      case 'getSettings': {
        const settings = await SettingsManager.get();
        return { settings };
      }

      case 'getExtensionStatus': {
        let status = await probeUserScriptsAvailability();
        // The toggle may have flipped on while the SW was already running.
        // Configure the world now so script registration works on next save.
        if (status.userScriptsAvailable) {
          status = await configureUserScriptsWorld(status);
        }
        return status;
      }

      case 'getLocalHealthReport':
        return await buildLocalHealthReport();

      case 'repairRuntimeState': {
        try {
          const status = await configureUserScriptsWorld();
          await setupContextMenus();
          if (status.userScriptsAvailable) {
            await registerAllScripts(true);
          }
          await updateBadge();
          await setupAlarms();

          return { success: true, ...status };
        } catch (error) {
          return { success: false, error: error?.message || 'Runtime repair failed' };
        }
      }
        
      case 'getSetting':
        return await SettingsManager.get(data.key);
        
      case 'setSettings': {
        const oldSettings = await SettingsManager.get();
        const result = await SettingsManager.set(data.settings);
        const changed = data.settings;

        // If global enabled state changed, re-register all scripts
        if ('enabled' in changed && changed.enabled !== oldSettings.enabled) {
          await registerAllScripts(true);
        }

        // If update/sync intervals changed, reconfigure alarms
        if ('checkInterval' in changed || 'autoUpdate' in changed ||
            'syncEnabled' in changed || 'syncProvider' in changed || 'syncInterval' in changed) {
          await setupAlarms();
        }

        // If badge settings changed, refresh badge
        if ('badgeColor' in changed || 'badgeInfo' in changed || 'showBadge' in changed) {
          await updateBadge();
        }

        // If context menu setting changed, rebuild menus
        if ('enableContextMenu' in changed) {
          await setupContextMenus();
        }

        // If page filter settings changed, re-register scripts
        if ('pageFilterMode' in changed || 'whitelistedPages' in changed ||
            'blacklistedPages' in changed || 'deniedHosts' in changed) {
          await registerAllScripts(true);
        }

        return result;
      }
        
      case 'resetSettings':
        return await SettingsManager.reset();
        
      // Updates
      case 'checkUpdates':
        return await UpdateSystem.checkForUpdates(data?.scriptId);

      case 'queueUpdates': {
        const updates = Array.isArray(data?.updates)
          ? data.updates
          : await UpdateSystem.checkForUpdates(data?.scriptId || null);
        return await UpdateSystem.queueUpdates(updates, { source: data?.source || 'manual-check' });
      }

      case 'getPendingUpdates':
        return await UpdateSystem.getPendingUpdates();

      case 'clearPendingUpdates':
        return await UpdateSystem.clearPendingUpdates(data?.scriptId || null);

      case 'applyPendingUpdate':
        return await UpdateSystem.applyPendingUpdate(data.scriptId, { force: data?.force === true });

      case 'applySafePendingUpdates':
        return await UpdateSystem.applySafePendingUpdates(data?.scriptIds || null);

      case 'getSubscriptions':
        return await SubscriptionSystem.list();

      case 'addSubscription':
        return await SubscriptionSystem.addSubscription(data?.url || '', data?.name || '');

      case 'refreshSubscription':
        return await SubscriptionSystem.refreshSubscription(data?.subscriptionId || data?.id || data?.url || '');

      case 'refreshSubscriptions':
        return await SubscriptionSystem.refreshSubscriptions();

      case 'removeSubscription':
        return await SubscriptionSystem.removeSubscription(data?.subscriptionId || data?.id || data?.url || '');

      // Phase 12.10 — recently-applied updates for the in-app dashboard banner.
      case 'getRecentUpdates':
        return UpdateSystem.getRecentUpdates();

      case 'clearRecentUpdates':
        UpdateSystem.clearRecentUpdates();
        return { success: true };

      case 'forceUpdate': {
        // Force re-download bypassing HTTP cache
        const scriptId = data.scriptId;
        const script = await ScriptStorage.get(scriptId);
        if (!script) return { error: 'Script not found' };
        const downloadUrl = script.meta.downloadURL || script.meta.updateURL;
        if (!downloadUrl) return { error: 'No download URL configured' };
        try {
          const { response, code: newCode } = await UpdateSystem.fetchUpdateCandidate(downloadUrl, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          });
          if (!response.ok) return { error: `HTTP ${response.status}` };
          const parsed = parseUserscript(newCode);
          if (parsed.error) return parsed;
          // Apply as update (force=true bypasses userModified guard)
          return await UpdateSystem.applyUpdate(scriptId, newCode, { force: true, sourceUrl: downloadUrl });
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'applyUpdate':
        return await UpdateSystem.applyUpdate(data.scriptId, data.code, { sourceUrl: data.sourceUrl || '' });

      case 'getVersionHistory': {
        const script = await ScriptStorage.get(data.scriptId);
        return { history: script?.versionHistory || [] };
      }

      case 'rollbackScript': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script) return { error: 'Script not found' };
        if (!script.versionHistory || script.versionHistory.length === 0) {
          return { error: 'No version history available' };
        }
        const targetIdx = data.index !== undefined ? data.index : script.versionHistory.length - 1;
        const target = script.versionHistory[targetIdx];
        if (!target) return { error: 'Version not found' };

        const parsed = parseUserscript(target.code);
        if (parsed.error) return parsed;

        // Save current version before rolling back (so user can undo the rollback)
        script.versionHistory.push({
          version: script.meta.version,
          code: script.code,
          updatedAt: script.updatedAt || Date.now()
        });
        // Remove the target entry we're rolling back to (prevents duplicates)
        script.versionHistory.splice(targetIdx, 1);
        // Trim to last 5 versions
        if (script.versionHistory.length > 5) {
          script.versionHistory = script.versionHistory.slice(-5);
        }

        script.code = target.code;
        script.meta = parsed.meta;
        script.updatedAt = Date.now();

        await ScriptStorage.set(data.scriptId, script);
        // Same Chrome 138+ in-place swap behavior as saveScript above.
        await reregisterScript(script);
        return { success: true, script: { ...script, metadata: script.meta } };
      }

      // Sync
      case 'sync': {
        const result = await CloudSync.sync();
        // Phase 39.26 — persist last-sync outcome so the dashboard's sync chip
        // can render "Last sync: 5 min ago — OK" without requiring a separate
        // round-trip on every popup open.
        try {
          await chrome.storage.local.set({
            lastSyncResult: {
              timestamp: Date.now(),
              ok: !!(result?.success || result?.skipped),
              skipped: !!result?.skipped,
              error: result?.error || null
            }
          });
        } catch (_e) { /* non-critical */ }
        return result;
      }

      case 'testSync': {
        // Phase 39.26 — VM #2486: explicit Test Connection with structured
        // status. Accept an optional `data.provider` override so the dashboard
        // can test a provider not currently selected (e.g. "verify the new
        // WebDAV URL before saving").
        const settings = await SettingsManager.get();
        const providerName = data?.provider || settings.syncProvider;
        const provider = CloudSync.providers[providerName];
        if (!provider) {
          return { ok: false, error: `Unknown provider: ${providerName}` };
        }
        try {
          const raw = await provider.test(settings);
          // Providers vary in return shape — normalize to { ok, error?, hint? }.
          if (typeof raw === 'boolean') return { ok: raw };
          if (raw && typeof raw === 'object') {
            const ok = raw.success === true || raw.ok === true;
            const error = raw.error || raw.message || null;
            const hint = !ok ? (
              error?.toLowerCase().includes('401') ? 'Authentication failed — re-connect the account.' :
              error?.toLowerCase().includes('403') ? 'Server rejected the credentials — check the user has write access.' :
              error?.toLowerCase().includes('404') ? 'Endpoint not found — verify the URL.' :
              error?.toLowerCase().includes('network') ? 'Network error — check connectivity and CORS.' :
              null
            ) : null;
            return hint ? { ok, error, hint } : { ok, error };
          }
          return { ok: false, error: 'Provider returned no status' };
        } catch (e) {
          return { ok: false, error: e?.message || String(e) };
        }
      }

      case 'getLastSyncResult':
        return (await chrome.storage.local.get('lastSyncResult'))?.lastSyncResult || null;

      case 'syncProviderHealth': {
        const settings = await SettingsManager.get();
        return await buildSyncProviderHealth(data?.provider || settings.syncProvider);
      }

      case 'syncDryRunPreview': {
        return await CloudSync.preview(data?.provider);
      }
      
      // Cloud Sync Provider Management
      case 'connectSyncProvider': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider' };
        
        try {
          const settings = await SettingsManager.get();
          const result = await provider.connect(settings);
          
          if (result.success) {
            const updates = {};
            if (providerName === 'googledrive') {
              updates.googleDriveConnected = true;
              updates.googleDriveUser = result.user;
            } else if (providerName === 'dropbox') {
              updates.dropboxToken = result.token;
              updates.dropboxRefreshToken = result.refreshToken || '';
              if (result.user) updates.dropboxUser = result.user;
              // Fetch user info after connecting
              const status = await provider.getStatus({ dropboxToken: result.token });
              if (status.user) updates.dropboxUser = status.user;
            }
            updates.syncProvider = providerName;
            await SettingsManager.set(updates);
          }
          return result;
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      case 'disconnectSyncProvider':
      case 'revokeSyncProvider': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider' };
        
        try {
          const settings = await SettingsManager.get();
          await provider.disconnect(settings);
          
          const updates = { syncProvider: 'none' };
          if (providerName === 'googledrive') {
            updates.googleDriveConnected = false;
            updates.googleDriveUser = null;
          } else if (providerName === 'dropbox') {
            updates.dropboxToken = '';
            updates.dropboxRefreshToken = '';
            updates.dropboxUser = null;
          } else if (providerName === 'onedrive') {
            updates.onedriveToken = '';
            updates.onedriveRefreshToken = '';
            updates.onedriveConnected = false;
            updates.onedriveUser = null;
          } else if (providerName === 'webdav') {
            updates.webdavUrl = '';
            updates.webdavUsername = '';
            updates.webdavPassword = '';
          }
          updates.syncEnabled = false;
          await SettingsManager.set(updates);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      case 'getSyncProviderStatus': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { connected: false };
        
        const settings = await SettingsManager.get();
        if (provider.getStatus) {
          return await provider.getStatus(settings);
        }
        return { connected: false };
      }
      
      case 'syncNow': {
        const result = await CloudSync.sync();
        try {
          await chrome.storage.local.set({
            lastSyncResult: {
              timestamp: Date.now(),
              ok: !!(result?.success || result?.skipped),
              skipped: !!result?.skipped,
              error: result?.error || null
            }
          });
        } catch (_e) { /* non-critical */ }
        return result;
      }

      case 'cloudExport': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider: ' + providerName };

        try {
          const includeSettings = data?.includeSettings !== false;
          const includeStorage = data?.includeStorage !== false;
          const exportData = await exportAllScripts({ includeSettings, includeStorage });
          const settings = await SettingsManager.get();
          await provider.upload(exportData, settings);
          return {
            success: true,
            exported: exportData.scripts?.length || 0,
            settingsIncluded: includeSettings,
            storageIncluded: includeStorage
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      case 'cloudImport': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider: ' + providerName };

        try {
          const settings = await SettingsManager.get();
          const remoteData = await provider.download(settings);
          if (!remoteData) return { success: false, error: 'No backup found on ' + providerName };
          const result = await importScripts(remoteData, {
            overwrite: true,
            importSettings: data?.importSettings === true,
            importStorage: data?.importStorage !== false
          });
          return { success: !result.error, ...result };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      case 'cloudStatus': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { connected: false };

        try {
          const settings = await SettingsManager.get();
          if (provider.getStatus) return await provider.getStatus(settings);
          return { connected: false };
        } catch (e) {
          return { connected: false, error: e.message };
        }
      }

      // Values Editor - Get all scripts' values
      case 'getAllScriptsValues': {
        const scripts = await ScriptStorage.getAll();
        const allValuesResults = await Promise.all(scripts.map(s => ScriptValues.getAll(s.id)));
        const allValues = {};
        scripts.forEach((script, i) => {
          const values = allValuesResults[i];
          if (values && Object.keys(values).length > 0) {
            allValues[script.id] = {
              scriptName: script.meta?.name || 'Unknown Script',
              values
            };
          }
        });
        return { allValues };
      }
      
      // Values Editor - Set a single value
      case 'setScriptValue': {
        await ScriptValues.set(data.scriptId, data.key, data.value);
        return { success: true };
      }
      
      // Values Editor - Clear all values for a script
      case 'clearScriptStorage': {
        await ScriptValues.deleteAll(data.scriptId);
        return { success: true };
      }

      // Values Editor - Rename a key
      case 'renameScriptValue': {
        const { scriptId, oldKey, newKey } = data;
        if (!scriptId || !oldKey || !newKey || oldKey === newKey) return { error: 'Invalid rename parameters' };
        const current = await ScriptValues.get(scriptId, oldKey);
        if (current === undefined) return { error: 'Key not found' };
        const existingNew = await ScriptValues.get(scriptId, newKey);
        if (existingNew !== undefined) return { error: `Key "${newKey}" already exists` };
        await ScriptValues.set(scriptId, newKey, current);
        await ScriptValues.delete(scriptId, oldKey);
        return { success: true };
      }
      
      // Per-Script Settings
      case 'getScriptSettings': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script) return { error: 'Script not found' };
        return { settings: script.settings || {} };
      }
      
      case 'setScriptSettings': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script) return { error: 'Script not found' };

        const oldSettings = script.settings || {};
        const oldEnabled = script.enabled;
        script.settings = { ...oldSettings, ...data.settings };
        script.updatedAt = Date.now();

        // Handle enabled change BEFORE saving (from sidepanel toggle)
        if ('enabled' in data.settings) {
          script.enabled = !!data.settings.enabled;
        }

        // Persist ALL changes including enabled state
        await ScriptStorage.set(data.scriptId, script);

        // If enabled state changed, re-register and reload tabs
        if ('enabled' in data.settings && script.enabled !== oldEnabled) {
          await unregisterScript(data.scriptId);
          if (script.enabled) {
            await registerScript(script);
          }
          await updateBadge();
          try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              if (tab.url && doesScriptMatchUrl(script, tab.url)) {
                chrome.tabs.reload(tab.id).catch(() => {});
              }
            }
          } catch {}
          return { success: true };
        }

        // Only re-register if execution-affecting settings changed.
        // Guard with `k in data.settings` — otherwise comparing `oldSettings[k]`
        // against `undefined` (from an unrelated partial update) triggers a needless
        // re-register cycle every time any other setting is changed.
        const EXEC_KEYS = ['runAt', 'injectInto', 'useOriginalMatches', 'useOriginalIncludes',
                           'useOriginalExcludes', 'userMatches', 'userIncludes', 'userExcludes',
                           'frameMode'];
        const needsReregister = EXEC_KEYS.some(k =>
          k in data.settings &&
          JSON.stringify(oldSettings[k]) !== JSON.stringify(data.settings[k])
        );
        if (needsReregister && script.enabled !== false) {
          await unregisterScript(data.scriptId);
          await registerScript(script);
        }

        return { success: true };
      }
      
      // Import/Export
      case 'exportAll':
        return await exportAllScripts(data?.options || {});
        
      case 'importAll':
        return await importScripts(data.data, data.options);

      case 'importTampermonkeyBackup': {
        // Parse Tampermonkey .txt backup format
        // Format: multiple scripts separated by blank lines, each with ==UserScript== blocks
        const text = data.text || '';
        const scriptBlocks = [];
        // Split on double newlines that precede ==UserScript== headers
        const parts = text.split(/\n\s*\n(?=\/\/\s*==UserScript==)/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes('==UserScript==') && trimmed.includes('==/UserScript==')) {
            scriptBlocks.push(trimmed);
          }
        }
        if (scriptBlocks.length === 0) {
          return { error: 'No valid userscripts found in backup file' };
        }
        const results = { imported: 0, skipped: 0, errors: [] };
        const allExisting = await ScriptStorage.getAll();
        let nextPosition = allExisting.length;
        for (const code of scriptBlocks) {
          try {
            const parsed = parseUserscript(code);
            if (parsed.error) { results.errors.push({ error: parsed.error }); continue; }
            const existing = allExisting.find(s =>
              s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
            );
            if (existing && !data.overwrite) { results.skipped++; continue; }
            const id = existing?.id || generateId();
            await ensurePersistentStorageForScriptWrite(existing ? 'tampermonkey-import-update' : 'tampermonkey-import', code);
            await ScriptStorage.set(id, {
              id, code, meta: parsed.meta,
              enabled: true,
              position: existing?.position ?? nextPosition++,
              createdAt: existing?.createdAt || Date.now(),
              updatedAt: Date.now()
            });
            results.imported++;
          } catch (e) {
            results.errors.push({ error: e.message });
          }
        }
        await registerAllScripts(true);
        await updateBadge();
        return results;
      }

      // v2.0: Storage Quota
      case 'getStorageUsage': {
        if (typeof QuotaManager !== 'undefined') return await QuotaManager.getUsage();
        return { bytesUsed: 0, quota: 10485760, percentage: 0, level: 'ok' };
      }
      case 'getStorageBreakdown': {
        if (typeof QuotaManager !== 'undefined') return await QuotaManager.getBreakdown();
        return {};
      }
      case 'cleanupStorage': {
        if (typeof QuotaManager !== 'undefined') return await QuotaManager.cleanup(data.options || {});
        return { freedBytes: 0, actions: [] };
      }

      // v2.0: Backup Scheduler
      case 'createBackup': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.createBackup(data.reason || 'manual');
        return { error: 'BackupScheduler not available' };
      }
      case 'getBackups': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.getBackups();
        return { backups: [] };
      }
      case 'restoreBackup': {
        if (typeof BackupScheduler !== 'undefined') {
          const result = await BackupScheduler.restoreBackup(data.backupId, data.options);
          // Restoring scripts means new IDs may now be live — make sure
          // chrome.userScripts reflects the post-restore state.
          if (result && result.success) {
            try { await registerAllScripts(true); } catch (_) {}
            try { await updateBadge(); } catch (_) {}
          }
          return result;
        }
        return { error: 'BackupScheduler not available' };
      }
      case 'verifyBackup': {
        if (typeof BackupScheduler !== 'undefined') {
          return await BackupScheduler.verifyBackup(data.backupId, { parseUserscript });
        }
        return { error: 'BackupScheduler not available' };
      }
      case 'getRestoreReceipts': {
        if (typeof BackupScheduler !== 'undefined') return { receipts: await BackupScheduler.listReceipts() };
        return { receipts: [] };
      }
      case 'getRestoreReceipt': {
        if (typeof BackupScheduler !== 'undefined') {
          const receipt = await BackupScheduler.getReceipt(data.receiptId);
          return { receipt };
        }
        return { receipt: null };
      }
      case 'rollbackRestore': {
        if (typeof BackupScheduler !== 'undefined') {
          const result = await BackupScheduler.rollbackRestoreReceipt(data.receiptId, data.options || {});
          if (result && result.success) {
            try { await registerAllScripts(true); } catch (_) {}
            try { await updateBadge(); } catch (_) {}
          }
          return result;
        }
        return { error: 'BackupScheduler not available' };
      }
      case 'clearRestoreReceipts': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.clearReceipts();
        return { success: false, error: 'BackupScheduler not available' };
      }
      case 'deleteBackup': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.deleteBackup(data.backupId);
        return { error: 'BackupScheduler not available' };
      }
      case 'importBackup': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.importBackup(data.zipData);
        return { error: 'BackupScheduler not available' };
      }
      case 'exportBackup': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.exportBackup(data.backupId);
        return { error: 'BackupScheduler not available' };
      }
      case 'inspectBackup': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.inspectBackup(data.backupId);
        return { error: 'BackupScheduler not available' };
      }
      case 'getBackupSettings': {
        if (typeof BackupScheduler !== 'undefined') return BackupScheduler.getSettings();
        return {};
      }
      case 'setBackupSettings': {
        if (typeof BackupScheduler !== 'undefined') {
          const settings = await BackupScheduler.setSettings(data.settings);
          return { success: true, settings };
        }
        return { error: 'BackupScheduler not available' };
      }

      // v2.0: Script Analytics
      // v2.0: Profiles
      case 'getProfiles': {
        const pData = await chrome.storage.local.get(['profiles', 'activeProfileId']);
        return { profiles: pData.profiles || [], activeProfileId: pData.activeProfileId || null };
      }
      case 'switchProfile': {
        const pData2 = await chrome.storage.local.get('profiles');
        const profiles = pData2.profiles || [];
        const profile = profiles.find(p => p.id === data.profileId);
        if (!profile) return { error: 'Profile not found' };
        // Apply script states from profile (parallel writes)
        const scripts = await ScriptStorage.getAll();
        const updates = [];
        for (const script of scripts) {
          const newEnabled = profile.scriptStates?.[script.id] ?? script.enabled;
          if (script.enabled !== newEnabled) {
            script.enabled = newEnabled;
            updates.push(ScriptStorage.set(script.id, script));
          }
        }
        if (updates.length) await Promise.all(updates);
        await chrome.storage.local.set({ activeProfileId: data.profileId });
        await registerAllScripts(true);
        await updateBadge();
        return { success: true };
      }
      case 'saveProfile': {
        const pData3 = await chrome.storage.local.get('profiles');
        const profiles3 = pData3.profiles || [];
        const idx = profiles3.findIndex(p => p.id === data.profile.id);
        if (idx >= 0) profiles3[idx] = data.profile;
        else profiles3.push(data.profile);
        await chrome.storage.local.set({ profiles: profiles3 });
        return { success: true };
      }
      case 'deleteProfile': {
        const pData4 = await chrome.storage.local.get(['profiles', 'activeProfileId']);
        const profiles4 = (pData4.profiles || []).filter(p => p.id !== data.profileId);
        const updates = { profiles: profiles4 };
        if (pData4.activeProfileId === data.profileId) updates.activeProfileId = null;
        await chrome.storage.local.set(updates);
        return { success: true };
      }

      // v2.0: Collections
      case 'getCollections': {
        const cData = await chrome.storage.local.get('scriptCollections');
        return { collections: cData.scriptCollections || [] };
      }
      case 'saveCollection': {
        const cData2 = await chrome.storage.local.get('scriptCollections');
        const collections = cData2.scriptCollections || [];
        const cidx = collections.findIndex(c => c.id === data.collection.id);
        if (cidx >= 0) collections[cidx] = data.collection;
        else collections.push(data.collection);
        await chrome.storage.local.set({ scriptCollections: collections });
        return { success: true };
      }
      case 'deleteCollection': {
        const cData3 = await chrome.storage.local.get('scriptCollections');
        const collections3 = (cData3.scriptCollections || []).filter(c => c.id !== data.collectionId);
        await chrome.storage.local.set({ scriptCollections: collections3 });
        return { success: true };
      }

      // v2.0: CSP Reports
      case 'reportCSPFailure': {
        const cspData = await chrome.storage.local.get('cspReports');
        let reports = cspData.cspReports || [];
        reports.push({ url: data.url, scriptId: data.scriptId, directive: data.directive, timestamp: Date.now() });
        // Keep last 500 reports (slice is cheaper than splice-from-head)
        if (reports.length > 510) reports = reports.slice(-500);
        await chrome.storage.local.set({ cspReports: reports });
        return { success: true };
      }
      case 'getCSPReports': {
        const cspData2 = await chrome.storage.local.get('cspReports');
        return { reports: cspData2.cspReports || [] };
      }

      // v2.0: Gist Integration
      case 'getGistSettings': {
        const gData = await chrome.storage.local.get('gistSettings');
        return gData.gistSettings || {};
      }
      case 'saveGistSettings': {
        await chrome.storage.local.set({ gistSettings: data.settings });
        return { success: true };
      }

      // v2.0: Violentmonkey backup import
      case 'importViolentmonkeyBackup': {
        // VM exports as ZIP containing individual .user.js files + a violentmonkey JSON
        // Or as individual .user.js files pasted as text
        const text = data.text || '';
        const results = { imported: 0, skipped: 0, errors: [] };

        // Try JSON format first (VM settings export)
        try {
          const vmData = JSON.parse(text);
          if (vmData.scripts && Array.isArray(vmData.scripts)) {
            const allExistingVM = await ScriptStorage.getAll();
            let nextPosVM = allExistingVM.length;
            for (const vmScript of vmData.scripts) {
              try {
                const code = vmScript.code || vmScript.custom?.code || '';
                if (!code) { results.skipped++; continue; }
                const parsed = parseUserscript(code);
                if (parsed.error) { results.errors.push({ name: vmScript.props?.name, error: parsed.error }); continue; }
                const existing = allExistingVM.find(s =>
                  s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
                );
                if (existing && !data.overwrite) { results.skipped++; continue; }
                const id = existing?.id || generateId();
                await ScriptStorage.set(id, {
                  id, code, meta: parsed.meta,
                  enabled: vmScript.config?.enabled !== false,
                  position: existing?.position ?? nextPosVM++,
                  createdAt: existing?.createdAt || Date.now(),
                  updatedAt: Date.now()
                });
                results.imported++;
              } catch (e) {
                results.errors.push({ error: e.message });
              }
            }
            await registerAllScripts(true);
            await updateBadge();
            return results;
          }
        } catch { /* Not JSON — try text format */ }

        // Fallback: same as Tampermonkey text format
        const allExistingVMFB = await ScriptStorage.getAll();
        let nextPosVMFB = allExistingVMFB.length;
        const parts = text.split(/\n\s*\n(?=\/\/\s*==UserScript==)/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes('==UserScript==') && trimmed.includes('==/UserScript==')) {
            try {
              const parsed = parseUserscript(trimmed);
              if (parsed.error) { results.errors.push({ error: parsed.error }); continue; }
              const existing = allExistingVMFB.find(s =>
                s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
              );
              if (existing && !data.overwrite) { results.skipped++; continue; }
              const id = existing?.id || generateId();
              await ScriptStorage.set(id, {
                id, code: trimmed, meta: parsed.meta,
                enabled: true,
                position: existing?.position ?? nextPosVMFB++,
                createdAt: existing?.createdAt || Date.now(),
                updatedAt: Date.now()
              });
              results.imported++;
            } catch (e) {
              results.errors.push({ error: e.message });
            }
          }
        }
        await registerAllScripts(true);
        await updateBadge();
        return results;
      }

      // v2.0: Greasemonkey backup import (GM4 JSON format)
      case 'importGreasemonkeyBackup': {
        const text = data.text || '';
        const results = { imported: 0, skipped: 0, errors: [] };
        try {
          const gmData = JSON.parse(text);
          // GM4 exports as array of script objects
          const scripts = Array.isArray(gmData) ? gmData : (gmData.scripts || []);
          const allExistingGM = await ScriptStorage.getAll();
          let nextPosGM = allExistingGM.length;
          for (const gmScript of scripts) {
            try {
              const code = gmScript.source || gmScript.code || gmScript.content || '';
              if (!code) { results.skipped++; continue; }
              const parsed = parseUserscript(code);
              if (parsed.error) { results.errors.push({ name: gmScript.name, error: parsed.error }); continue; }
              const existing = allExistingGM.find(s =>
                s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
              );
              if (existing && !data.overwrite) { results.skipped++; continue; }
              const id = existing?.id || generateId();
              await ScriptStorage.set(id, {
                id, code, meta: parsed.meta,
                enabled: gmScript.enabled !== false,
                position: existing?.position ?? nextPosGM++,
                createdAt: existing?.createdAt || Date.now(),
                updatedAt: Date.now()
              });
              results.imported++;
            } catch (e) {
              results.errors.push({ error: e.message });
            }
          }
        } catch (e) {
          return { error: 'Invalid Greasemonkey backup format: ' + e.message };
        }
        await registerAllScripts(true);
        await updateBadge();
        return results;
      }

      case 'exportZip':
        return await exportToZip(data?.options || {});

      // Folders
      // Workspaces
      case 'getWorkspaces':
        return await WorkspaceManager.getAll();

      case 'createWorkspace':
        return { workspace: await WorkspaceManager.create(data.name) };

      case 'saveWorkspace': {
        const workspace = await WorkspaceManager.save(data.id);
        return workspace
          ? { success: true, workspace }
          : { error: 'Workspace not found' };
      }

      case 'activateWorkspace':
        return await WorkspaceManager.activate(data.id);

      case 'updateWorkspace':
        return { workspace: await WorkspaceManager.update(data.id, data.updates) };

      case 'deleteWorkspace': {
        const workspace = await WorkspaceManager.delete(data.id);
        return workspace
          ? { success: true, workspace }
          : { error: 'Workspace not found' };
      }

      // Network Log — returns flat array (limit optional) + stats
      case 'getNetworkLog': {
        const filters = typeof data === 'object' && data ? data : {};
        const log = NetworkLog.getAll(filters);
        const stats = NetworkLog.getStats();
        // Support both flat-array callers (DevTools) and object callers (dashboard)
        return log; // stats available via getNetworkLogStats
      }

      case 'getNetworkLogStats':
        return NetworkLog.getStats();

      case 'clearNetworkLog':
        NetworkLog.clear(data?.scriptId);
        return { success: true };

      // Record a network request from the in-page proxy (fetch/XHR/WebSocket/sendBeacon)
      case 'netlog_record':
        NetworkLog.add({
          method: data.method || 'GET',
          url: data.url || '',
          status: data.status,
          statusText: data.statusText,
          duration: data.duration,
          responseSize: data.responseSize,
          responseHeaders: data.responseHeaders,
          scriptId: data.scriptId,
          scriptName: data.scriptName,
          error: data.error,
          type: data.type || 'fetch'
        });
        return { ok: true };

      // Static Analysis — routes through offscreen document for AST analysis
      case 'analyzeScript': {
        const code = data.code || '';
        return ScriptAnalyzer.analyzeAsync(code);
      }

      // ── Script Signing (Ed25519) ──────────────────────────────────────────
      case 'signing_getPublicKey':
        return { publicKey: await ScriptSigning.getPublicKeyJwk() };

      case 'signing_sign': {
        if (!data.code) return { error: 'No code provided' };
        return ScriptSigning.signAndEmbedInCode(data.code);
      }

      case 'signing_verify': {
        if (!data.code) return { error: 'No code provided' };
        return ScriptSigning.verifyCodeSignature(data.code);
      }

      case 'signing_verifyRaw': {
        if (!data.code || !data.signatureInfo) return { error: 'Missing inputs' };
        return ScriptSigning.verifyScript(data.code, data.signatureInfo);
      }

      case 'signing_trustKey': {
        if (!data.publicKey) return { error: 'No public key' };
        return ScriptSigning.trustKey(data.publicKey, data.name);
      }

      case 'signing_untrustKey': {
        if (!data.publicKey) return { error: 'No public key' };
        return ScriptSigning.untrustKey(data.publicKey);
      }

      case 'signing_getTrustedKeys':
        return { keys: await ScriptSigning.getTrustedKeys() };

      case 'publicApi_getTrustedOrigins':
        if (typeof PublicAPI === 'undefined') return { origins: [] };
        return { origins: PublicAPI.getTrustedOrigins() };

      case 'publicApi_setTrustedOrigins':
        if (typeof PublicAPI === 'undefined') return { error: 'Public API controls unavailable' };
        await PublicAPI.setTrustedOrigins(Array.isArray(data.origins) ? data.origins : []);
        return { success: true, origins: PublicAPI.getTrustedOrigins() };

      case 'publicApi_getPermissions':
        if (typeof PublicAPI === 'undefined') return { permissions: {} };
        return { permissions: PublicAPI.getPermissions() };

      case 'publicApi_getAuditLog':
        if (typeof PublicAPI === 'undefined') return { entries: [] };
        return { entries: PublicAPI.getAuditLog(data.limit || 50) };

      case 'publicApi_clearAuditLog':
        if (typeof PublicAPI === 'undefined') return { error: 'Public API controls unavailable' };
        await PublicAPI.clearAuditLog();
        return { success: true };

      case 'signing_generateNewKeypair':
        return ScriptSigning.generateAndStoreKeypair();

      case 'getFolders':
        return { folders: await FolderStorage.getAll() };

      case 'createFolder':
        return { folder: await FolderStorage.create(data.name, data.color) };

      case 'updateFolder':
        return { folder: await FolderStorage.update(data.id, data.updates) };

      case 'deleteFolder':
        await FolderStorage.delete(data.id);
        return { success: true };

      case 'addScriptToFolder':
        await FolderStorage.addScript(data.folderId, data.scriptId);
        return { success: true };

      case 'removeScriptFromFolder':
        await FolderStorage.removeScript(data.folderId, data.scriptId);
        return { success: true };

      case 'moveScriptToFolder':
        await FolderStorage.moveScript(data.scriptId, data.fromFolderId, data.toFolderId);
        return { success: true };

      case 'importFromZip':
        return await importFromZip(data.zipData, data.options || {});
      
      case 'installFromUrl':
        return await installFromUrl(data.url);

      case 'installFromCode':
        return await installFromCode(data.code, {
          sourceUrl: data.sourceUrl || '',
          operation: data.operation || 'install'
        });

      case 'verifyRequireProvenancePreview':
        return await previewRequireProvenance(data);
        
      // Resources
      case 'fetchResource':
        return await ResourceCache.fetchResource(data.url);

      case 'GM_getResourceText': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script || !script.meta.resource) return null;
        const url = script.meta.resource[data.name];
        if (!url) return null;
        try {
          return await ResourceCache.fetchResource(url);
        } catch (e) {
          return null;
        }
      }

      case 'GM_getResourceURL': {
        const script2 = await ScriptStorage.get(data.scriptId);
        if (!script2 || !script2.meta.resource) return null;
        const url2 = script2.meta.resource[data.name];
        if (!url2) return null;
        try {
          return await ResourceCache.getDataUri(url2);
        } catch (e) {
          return null;
        }
      }

      // GM_loadScript - Fetch a script URL and return its source code
      // Allows userscripts to dynamically load libraries at runtime
      case 'GM_loadScript': {
        try {
          if (!data.url) return { error: 'No URL provided' };
          if (!data.scriptId) return { error: 'Missing script context' };
          const lsScript = await ScriptStorage.get(data.scriptId);
          if (!lsScript) return { error: 'Script context not found' };

          // Enforce @connect for GM_loadScript (same rules as GM_xmlhttpRequest)
          const lsPolicy = evaluateConnectPolicy(lsScript, data.url);
          if (!lsPolicy.allowed) {
            return { error: lsPolicy.error };
          }
          const lsPreCheck = InternalHostGuard.classifyFetchUrl(data.url, ['http:', 'https:']);
          if (!lsPreCheck.ok) {
            return { error: 'GM_loadScript URL rejected: ' + lsPreCheck.message };
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), data.timeout || 30000);
          let code;
          try {
            const response = await fetch(data.url, { signal: controller.signal });
            if (!response.ok) return { error: `HTTP ${response.status}` };
            const lsPostCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
            if (!lsPostCheck.ok) {
              return { error: 'GM_loadScript URL redirected to ' + lsPostCheck.message };
            }
            // Stream-bounded read so a remote script source can't OOM us
            // by serving an unbounded body. See _fetchTextBounded for
            // rationale.
            try {
              code = await _fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script');
            } catch (sizeErr) {
              return { error: sizeErr?.message || String(sizeErr) };
            }
          } finally {
            clearTimeout(timeoutId);
          }
          if (!code || code.length === 0) return { error: 'Empty response' };
          return { code };
        } catch (e) {
          return { error: e?.message || 'Fetch failed' };
        }
      }

      // XHR - Using fetch() since XMLHttpRequest is not available in Service Workers
      // Provides abort support via AbortController and simulates events
      case 'GM_xmlhttpRequest': {
        try {
          if (!data.url) {
            return { error: 'No URL provided', type: 'error' };
          }

          if (!data.scriptId) {
            return { error: 'Missing script context', type: 'error' };
          }
          const xhrScript = await ScriptStorage.get(data.scriptId);
          if (!xhrScript) {
            return { error: 'Script context not found', type: 'error' };
          }

          // @connect enforcement
          const connectPolicy = evaluateConnectPolicy(xhrScript, data.url);
          if (!connectPolicy.allowed) {
            if (connectPolicy.hostname) {
              console.warn(`[ScriptVault] @connect blocked: ${connectPolicy.hostname} not in allowed list for ${xhrScript.meta.name}`);
            }
            return { error: connectPolicy.error, type: 'error' };
          }

          const tabId = sender.tab?.id;
          const request = XhrManager.create(tabId, data.scriptId, data);
          const { id: requestId } = request;

          // Log to network log
          const _netLogStartTime = Date.now();
          const _netLogEntry = {
            scriptId: data.scriptId,
            scriptName: '',
            method: (data.method || 'GET').toUpperCase(),
            url: data.url,
            requestSize: data.data ? (typeof data.data === 'string' ? data.data.length : 0) : 0
          };
          // Resolve script name
          try {
            const _xhrScript = await ScriptStorage.get(data.scriptId);
            _netLogEntry.scriptName = _xhrScript?.meta?.name || data.scriptId;
          } catch {};
          
          // Create AbortController for this request
          const controller = new AbortController();
          request.controller = controller;
          
          // Function to send event to content script
          const sendEvent = (type, eventData = {}) => {
            if (request.aborted && type !== 'abort') return;
            
            try {
              chrome.tabs.sendMessage(tabId, {
                action: 'xhrEvent',
                data: {
                  requestId,
                  scriptId: data.scriptId,
                  type,
                  ...eventData
                }
              }).catch(() => {});
            } catch (e) {
              // Tab might be closed
            }
          };
          
          // Build fetch options via the shared helper so the noCache /
          // redirect / credentials translation rules stay unit-testable.
          // No 'mode' override — Chrome extensions with <all_urls> host
          // permissions bypass CORS automatically. Forcing mode:'cors'
          // breaks requests to servers that don't echo the extension origin
          // (e.g. localhost with null CORS).
          const method = String(data.method || 'GET').toUpperCase();
          const fetchOptions = XhrManager.buildFetchOptions(data);
          fetchOptions.signal = controller.signal;

          // Add body for non-GET/HEAD requests; deserialize tagged body objects
          if (data.data && method !== 'GET' && method !== 'HEAD') {
            const rawBody = data.data;
            if (rawBody && typeof rawBody === 'object' && !ArrayBuffer.isView(rawBody) && !(rawBody instanceof ArrayBuffer)) {
              if (rawBody.__sv_blob__) {
                const bytes = Uint8Array.from(atob(rawBody.b64), c => c.charCodeAt(0));
                fetchOptions.body = rawBody.name
                  ? new File([bytes], rawBody.name, { type: rawBody.type || '' })
                  : new Blob([bytes], { type: rawBody.type || '' });
              } else if (rawBody.__sv_formdata__) {
                const fd = new FormData();
                for (const entry of rawBody.entries) {
                  if (entry.b64 !== undefined) {
                    const bytes = Uint8Array.from(atob(entry.b64), c => c.charCodeAt(0));
                    fd.append(entry.name, new Blob([bytes], { type: entry.type || '' }), entry.filename || 'blob');
                  } else {
                    fd.append(entry.name, entry.value);
                  }
                }
                fetchOptions.body = fd;
              } else {
                fetchOptions.body = rawBody;
              }
            } else {
              fetchOptions.body = rawBody;
            }
          }
          
          // Set timeout
          const settings = await SettingsManager.get();
          const timeoutMs = data.timeout || settings.xhrTimeout || 30000;
          const timeoutId = setTimeout(() => {
            if (!request.aborted) {
              request.aborted = true;
              controller.abort();
              sendEvent('timeout', {
                readyState: 4,
                status: 0,
                statusText: '',
                error: 'Request timed out'
              });
              sendEvent('loadend', { readyState: 4 });
              XhrManager.remove(requestId);
            }
          }, timeoutMs);
          
          // Send loadstart event
          sendEvent('loadstart', {
            readyState: 1,
            status: 0,
            lengthComputable: false,
            loaded: 0,
            total: 0
          });
          
          // Execute the fetch
          (async () => {
            try {
              const response = await fetch(data.url, fetchOptions);
              
              if (request.aborted) return;
              
              // Get response headers as string
              const responseHeaders = [...response.headers.entries()]
                .map(([k, v]) => `${k}: ${v}`)
                .join('\r\n');
              
              // Send readystatechange for headers received
              sendEvent('readystatechange', {
                readyState: 2,
                status: response.status,
                statusText: response.statusText,
                responseHeaders,
                finalUrl: response.url
              });
              
              // Get content length for progress
              const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
              
              // Read response based on responseType
              let responseData;
              let responseText = '';
              
              if (data.responseType === 'arraybuffer') {
                const buffer = await response.arrayBuffer();
                // Encode as base64 for efficient transfer (33% overhead vs 800%+ for number arrays)
                const bytes = new Uint8Array(buffer);
                let binary = '';
                // Process in 32KB chunks to avoid call stack overflow
                for (let offset = 0; offset < bytes.length; offset += 32768) {
                  binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 32768));
                }
                responseData = { __sv_base64__: true, data: btoa(binary) };
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: buffer.byteLength,
                  total: contentLength || buffer.byteLength
                });
              } else if (data.responseType === 'blob') {
                const blob = await response.blob();
                // Convert blob to data URL for transfer
                responseData = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = () => resolve(null);
                  reader.readAsDataURL(blob);
                });
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: blob.size,
                  total: contentLength || blob.size
                });
              } else if (data.responseType === 'json') {
                responseText = await response.text();
                try {
                  responseData = JSON.parse(responseText);
                } catch (e) {
                  responseData = responseText;
                }
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: responseText.length,
                  total: contentLength || responseText.length
                });
              } else if (data.responseType === 'stream') {
                // Stream response - send chunks as progress events
                const reader = response.body?.getReader();
                if (reader) {
                  let loaded = 0;
                  const chunks = [];
                  const decoder = new TextDecoder();
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done || request.aborted) break;
                      loaded += value.byteLength;
                      const chunkText = decoder.decode(value, { stream: true });
                      chunks.push(chunkText);
                      sendEvent('progress', {
                        readyState: 3,
                        lengthComputable: contentLength > 0,
                        loaded,
                        total: contentLength || 0,
                        responseText: chunkText,
                        streamChunk: true
                      });
                    }
                  } finally {
                    reader.releaseLock();
                  }
                  responseText = chunks.join('');
                  responseData = responseText;
                } else {
                  responseText = await response.text();
                  responseData = responseText;
                }
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: responseText.length,
                  total: contentLength || responseText.length
                });
              } else {
                // Default: text
                responseText = await response.text();
                responseData = responseText;
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: responseText.length,
                  total: contentLength || responseText.length
                });
              }
              
              if (request.aborted) return;
              
              // Build final response object
              const finalResponse = {
                readyState: 4,
                status: response.status,
                statusText: response.statusText,
                responseHeaders,
                response: responseData,
                responseText: responseText || (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)),
                finalUrl: response.url,
                lengthComputable: true,
                loaded: responseText?.length || 0,
                total: responseText?.length || 0
              };
              
              // Send load event
              sendEvent('load', finalResponse);

              // Log successful request
              NetworkLog.add({
                ..._netLogEntry,
                status: finalResponse.status,
                statusText: finalResponse.statusText,
                responseSize: responseText?.length || 0,
                duration: Date.now() - _netLogStartTime,
                finalUrl: finalResponse.finalUrl
              });

              // Send loadend event
              sendEvent('loadend', finalResponse);

              // Clean up
              XhrManager.remove(requestId);
              
            } catch (e) {
              if (request.aborted) {
                // Already handled by abort
                return;
              }
              
              const isAbort = e.name === 'AbortError';
              const errorType = isAbort ? 'abort' : 'error';
              const errorMsg = isAbort ? 'Request aborted' : (e.message || 'Network error');
              
              // Log failed request
              NetworkLog.add({ ..._netLogEntry, status: 0, error: errorMsg, duration: Date.now() - _netLogStartTime });

              sendEvent(errorType, {
                readyState: 4,
                status: 0,
                statusText: '',
                error: errorMsg
              });
              
              sendEvent('loadend', {
                readyState: 4,
                status: 0
              });
              
              XhrManager.remove(requestId);
            } finally {
              clearTimeout(timeoutId);
            }
          })().catch(e => {
            // Guard against any unexpected exception escaping the try/catch above
            console.error('[ScriptVault] Unexpected XHR handler error:', e);
            XhrManager.remove(requestId);
          });

          // Return request ID immediately so content script can track/abort
          return { requestId, started: true };
          
        } catch (e) {
          console.error('[ScriptVault] GM_xmlhttpRequest setup error:', e);
          return { error: e.message || 'Request setup failed', type: 'error' };
        }
      }
      
      // Abort an XHR request
      case 'GM_xmlhttpRequest_abort': {
        const request = XhrManager.get(data.requestId);
        if (request && !request.aborted) {
          request.aborted = true;
          if (request.controller) {
            request.controller.abort();
          }
          XhrManager.remove(data.requestId);
          return { success: true };
        }
        return { success: false };
      }
      
      // Download (with callbacks: onload, onerror, onprogress, ontimeout)
      case 'GM_download': {
        try {
          const downloadOpts = {
            url: data.url,
            filename: data.name,
            saveAs: data.saveAs || false,
            conflictAction: data.conflictAction || 'uniquify'
          };
          const downloadId = await chrome.downloads.download(downloadOpts);
          const tabId = sender.tab?.id;
          // Track download for event callbacks
          if (tabId && data.hasCallbacks) {
            const sendDlEvent = (type, eventData = {}) => {
              chrome.tabs.sendMessage(tabId, {
                action: 'downloadEvent',
                data: { downloadId, scriptId: data.scriptId, type, ...eventData }
              }).catch(() => {});
            };
            let dlTimeoutId = null;
            let dlSafetyId = null;
            // Remove listener and clear all associated timers
            const cleanupDlListener = () => {
              chrome.downloads.onChanged.removeListener(dlListener);
              if (dlTimeoutId) clearTimeout(dlTimeoutId);
              if (dlSafetyId) clearTimeout(dlSafetyId);
            };
            // Monitor download state changes
            const dlListener = (delta) => {
              if (delta.id !== downloadId) return;
              if (delta.state) {
                if (delta.state.current === 'complete') {
                  sendDlEvent('load', { url: data.url });
                  cleanupDlListener();
                } else if (delta.state.current === 'interrupted') {
                  sendDlEvent('error', { error: delta.error?.current || 'Download interrupted' });
                  cleanupDlListener();
                }
              }
              if (delta.bytesReceived) {
                sendDlEvent('progress', {
                  loaded: delta.bytesReceived.current,
                  total: delta.totalBytes?.current || 0
                });
              }
            };
            chrome.downloads.onChanged.addListener(dlListener);
            // Timeout
            if (data.timeout) {
              dlTimeoutId = setTimeout(() => {
                chrome.downloads.cancel(downloadId).catch(() => {});
                sendDlEvent('timeout');
                cleanupDlListener();
              }, data.timeout);
            }
            // Safety: remove listener after 5 minutes max to prevent leaks
            dlSafetyId = setTimeout(cleanupDlListener, 300000);
          }
          return { success: true, downloadId };
        } catch (e) {
          return { error: e.message };
        }
      }
      
      // Notifications (with callbacks: onclick, ondone, timeout, tag)
      case 'GM_notification': {
        // Phase 11.11 — progress + buttons (ScriptCat parity).
        // Chrome's chrome.notifications API supports both natively:
        //   - type: 'progress' + progress: 0..100 → progress bar
        //   - buttons: [{ title, iconUrl }] up to 2 → action buttons with
        //     chrome.notifications.onButtonClicked routing.
        const hasProgress = typeof data.progress === 'number';
        const notifOpts = {
          type: hasProgress ? 'progress' : 'basic',
          iconUrl: data.image || 'images/icon128.png',
          // Phase 39.31 — clamp to documented Chrome notification limits
          // so the future WECG #935 spec change can't break user scripts
          // that pass long titles/messages.
          title: _clampString(data.title || 'ScriptVault', SV_NOTIF_TITLE_MAX),
          message: _clampString(data.text || '', SV_NOTIF_MESSAGE_MAX),
          silent: data.silent || false
        };
        // Phase 41 — pass `requireInteraction` through so scripts can pin a
        // notification until the user acts on it (Tampermonkey/ViolentMonkey
        // parity). Chrome 50+ supports this for `basic` and `image` types;
        // ignored on `progress`. Boolean coercion guards against truthy-but-
        // non-boolean values producing unexpected chrome.notifications shape.
        if (typeof data.requireInteraction === 'boolean' && data.requireInteraction) {
          notifOpts.requireInteraction = true;
        }
        if (hasProgress) {
          notifOpts.progress = Math.max(0, Math.min(100, Math.floor(data.progress)));
        }
        // Buttons — Chrome caps at 2; we silently truncate to honour the
        // platform contract instead of failing the whole notification.
        if (Array.isArray(data.buttons) && data.buttons.length > 0) {
          notifOpts.buttons = data.buttons.slice(0, 2).map((b) => ({
            title: String(b?.title ?? '').slice(0, 200),
            ...(b?.iconUrl ? { iconUrl: b.iconUrl } : {})
          }));
        }
        // Use tag as notification ID for updates
        const notifId = data.tag
          ? await chrome.notifications.create(data.tag, notifOpts)
          : await chrome.notifications.create(notifOpts);
        const tabId = sender.tab?.id;
        // Track notification for callbacks
        if (tabId && (data.hasOnclick || data.hasOndone || data.hasOnbuttonclick)) {
          if (!self._notifCallbacks) self._notifCallbacks = new Map();
          // Evict oldest if map grows too large (prevents unbounded growth)
          if (self._notifCallbacks.size > 500) {
            const oldest = self._notifCallbacks.keys().next().value;
            self._notifCallbacks.delete(oldest);
          }
          self._notifCallbacks.set(notifId, {
            tabId, scriptId: data.scriptId,
            hasOnclick: data.hasOnclick,
            hasOndone: data.hasOndone,
            hasOnbuttonclick: data.hasOnbuttonclick
          });
          SessionState.persistNotifCallbacks();
        }
        // Auto-close after timeout
        if (data.timeout && data.timeout > 0) {
          if (data.timeout >= 30000) {
            // Long timeouts use chrome.alarms to survive service worker shutdown
            const alarmName = `notif_clear_${notifId}`;
            chrome.alarms.create(alarmName, { delayInMinutes: data.timeout / 60000 });
          } else {
            setTimeout(() => {
              chrome.notifications.clear(notifId).catch(() => {});
              if (self._notifCallbacks) {
                self._notifCallbacks.delete(notifId);
                SessionState.persistNotifCallbacks();
              }
            }, data.timeout);
          }
        }
        return { success: true, id: notifId };
      }

      // Phase 11.11 — Update an existing notification by id (tag).
      // Skips fields the caller didn't specify so partial updates don't blank
      // out the title/message. Mirrors chrome.notifications.update() behaviour.
      case 'GM_updateNotification': {
        if (!data.id) return { success: false, error: 'Missing notification id' };
        const updateOpts = {};
        if (typeof data.title === 'string') updateOpts.title = data.title;
        if (typeof data.text === 'string') updateOpts.message = data.text;
        if (typeof data.image === 'string') updateOpts.iconUrl = data.image;
        if (typeof data.progress === 'number') {
          updateOpts.type = 'progress';
          updateOpts.progress = Math.max(0, Math.min(100, Math.floor(data.progress)));
        }
        if (Array.isArray(data.buttons)) {
          updateOpts.buttons = data.buttons.slice(0, 2).map((b) => ({
            title: String(b?.title ?? '').slice(0, 200),
            ...(b?.iconUrl ? { iconUrl: b.iconUrl } : {})
          }));
        }
        if (typeof data.silent === 'boolean') updateOpts.silent = data.silent;
        if (typeof data.requireInteraction === 'boolean') updateOpts.requireInteraction = data.requireInteraction;
        try {
          const wasUpdated = await chrome.notifications.update(data.id, updateOpts);
          return { success: !!wasUpdated };
        } catch (e) {
          return { success: false, error: e?.message || 'Update failed' };
        }
      }

      // Phase 11.11 — Programmatically close a notification by id (tag).
      case 'GM_closeNotification': {
        if (!data.id) return { success: false, error: 'Missing notification id' };
        try {
          await chrome.notifications.clear(data.id);
          if (self._notifCallbacks) {
            self._notifCallbacks.delete(data.id);
            SessionState.persistNotifCallbacks();
          }
          return { success: true };
        } catch (e) {
          return { success: false, error: e?.message || 'Close failed' };
        }
      }
      
      // Open tab (with close tracking for onclose callback)
      case 'GM_openInTab': {
        const newTabOpts = {
          url: data.url,
          active: data.active !== undefined ? data.active : !data.background
        };
        // Insert next to current tab if requested
        if (data.insert && sender.tab?.index !== undefined) {
          newTabOpts.index = sender.tab.index + 1;
        }
        // Set opener tab
        if (data.setParent && sender.tab?.id) {
          newTabOpts.openerTabId = sender.tab.id;
        }
        const tab = await chrome.tabs.create(newTabOpts);
        // Track tab for onclose notification via shared listener
        const callerTabId = sender.tab?.id;
        if (callerTabId && data.trackClose) {
          if (!self._openTabTrackers) self._openTabTrackers = new Map();
          // Evict oldest if map grows too large (prevents unbounded growth from orphaned tabs)
          if (self._openTabTrackers.size > 1000) {
            const oldest = self._openTabTrackers.keys().next().value;
            self._openTabTrackers.delete(oldest);
          }
          self._openTabTrackers.set(tab.id, { callerTabId, scriptId: data.scriptId });
          SessionState.persistOpenTabTrackers();
        }
        return { success: true, tabId: tab.id };
      }
      
      // Focus tab
      case 'GM_focusTab':
        if (sender.tab?.id) {
          await chrome.tabs.update(sender.tab.id, { active: true });
        }
        return { success: true };

      // Close opened tab (from GM_openInTab handle.close())
      case 'GM_closeTab':
        if (data.tabId) {
          try { await chrome.tabs.remove(data.tabId); } catch (e) {}
        }
        return { success: true };

      // Get scripts for URL
      case 'getScriptsForUrl': {
        const settings = await SettingsManager.get();
        const url = data.url || data;

        if (isUrlBlockedByGlobalSettings(url, settings)) {
          return [];
        }

        // Filter scripts that match this URL (both enabled and disabled for popup display).
        // Use the cached MatchSet so we test only candidate scripts, not every script.
        const matchSet = await getMatchSet();
        const filtered = matchSet.getMatching(url)
          .sort((a, b) => (a.position || 0) - (b.position || 0));
        
        // Return with metadata property for popup compatibility (strip code to reduce message size)
        return filtered.map(({ code, ...rest }) => ({ ...rest, metadata: rest.meta }));
      }
      
      // Update badge for specific tab
      case 'updateBadgeForTab': {
        if (data.tabId && data.url) {
          await updateBadgeForTab(data.tabId, data.url);
        }
        return { success: true };
      }

      // Phase 11.4 — Run a script once on a specific tab without registering
      // it for future page loads. Uses chrome.userScripts.execute() (Chrome
      // 135+); falls back to chrome.scripting.executeScript so older Chrome
      // can still run the wrapper-less code body. The script doesn't need
      // to be enabled, and registration state is not modified.
      case 'runScriptNow': {
        const scriptId = data.scriptId || data.id;
        const tabId = data.tabId;
        if (!scriptId) return { success: false, error: 'Missing scriptId' };
        try {
          const script = await ScriptStorage.get(scriptId);
          if (!script) return { success: false, error: 'Script not found' };

          // Resolve the target tab — caller usually passes an explicit id;
          // fall back to the active tab so the popup's "Run on current tab"
          // affordance can omit it.
          let targetTabId = tabId;
          if (typeof targetTabId !== 'number') {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            targetTabId = activeTab?.id;
          }
          if (typeof targetTabId !== 'number') {
            return { success: false, error: 'No target tab' };
          }

          // Resolve @require dependencies the same way the context-menu
          // injector does, so the one-shot run sees the same library set as
          // a normal injection. Per-require failures are non-fatal — the
          // user-script body still runs.
          const reqList = Array.isArray(script.meta?.require)
            ? script.meta.require
            : (script.meta?.require ? [script.meta.require] : []);
          const requireScripts = [];
          for (const url of reqList) {
            try {
              const code = await fetchRequireScript(url);
              if (code) requireScripts.push({ url, code });
            } catch (_e) { /* require fetch failed — keep going */ }
          }

          let storedValues = {};
          try { storedValues = await ScriptValues.getAll(script.id) || {}; } catch (_e) {}

          const wrappedCode = buildWrappedScript(script, requireScripts, storedValues, [], []);

          // Phase 39.28 — Chrome 149+ makes injectImmediately: true reliable
          // for document-start one-shots. Pass it when the script declares
          // @run-at document-start so the body runs before first paint
          // instead of after.
          const wantsDocumentStart = (script?.meta?.['run-at'] === 'document-start');

          // Prefer userScripts.execute() (Chrome 135+) — runs in the same
          // USER_SCRIPT world as a normal injection so unsafeWindow / GM_*
          // APIs behave identically.
          if (typeof chrome.userScripts?.execute === 'function') {
            try {
              await chrome.userScripts.execute({
                target: { tabId: targetTabId },
                js: [{ code: wrappedCode }],
                world: 'USER_SCRIPT',
                ...(wantsDocumentStart ? { injectImmediately: true } : {})
              });
              return { success: true, mode: 'userScripts.execute' };
            } catch (e) {
              // Fall through to chrome.scripting fallback below.
              debugLog('userScripts.execute failed, falling back:', e?.message);
            }
          }

          // Fallback: chrome.scripting.executeScript — runs in MAIN world,
          // GM_* APIs unavailable but the user-script body still executes.
          // Acceptable for "Run now" use because the user explicitly opted in.
          try {
            await chrome.scripting.executeScript({
              target: { tabId: targetTabId },
              world: 'MAIN',
              func: (code) => {
                try { (0, eval)(code); } catch (err) { console.error('[ScriptVault Run Now]', err); }
              },
              args: [wrappedCode],
              ...(wantsDocumentStart ? { injectImmediately: true } : {})
            });
            return { success: true, mode: 'scripting.executeScript' };
          } catch (e) {
            return { success: false, error: e?.message || 'Run failed' };
          }
        } catch (e) {
          console.error('[ScriptVault] runScriptNow error:', e);
          return { success: false, error: e?.message || 'Run failed' };
        }
      }
      
      // Get info
      case 'getExtensionInfo':
        return {
          name: 'ScriptVault',
          version: chrome.runtime.getManifest().version,
          scriptHandler: 'ScriptVault',
          scriptMetaStr: null
        };
        
      // Register menu command (with extended options: id, accessKey, autoClose, title)
      case 'registerMenuCommand':
      case 'GM_registerMenuCommand': {
        const commands = await chrome.storage.session.get('menuCommands') || {};
        if (!commands.menuCommands) commands.menuCommands = {};
        if (!commands.menuCommands[data.scriptId]) commands.menuCommands[data.scriptId] = [];

        // If command with same id exists, update it instead of adding duplicate
        const existing = commands.menuCommands[data.scriptId].findIndex(c => c.id === data.commandId);
        const cmdEntry = {
          id: data.commandId,
          caption: data.caption,
          accessKey: data.accessKey || '',
          autoClose: data.autoClose !== false,
          title: data.title || ''
        };
        if (existing >= 0) {
          commands.menuCommands[data.scriptId][existing] = cmdEntry;
        } else {
          commands.menuCommands[data.scriptId].push(cmdEntry);
        }

        await chrome.storage.session.set(commands);
        return { success: true };
      }
      
      case 'unregisterMenuCommand':
      case 'GM_unregisterMenuCommand': {
        const commands = await chrome.storage.session.get('menuCommands') || {};
        if (commands.menuCommands?.[data.scriptId]) {
          commands.menuCommands[data.scriptId] = commands.menuCommands[data.scriptId].filter(
            c => c.id !== data.commandId
          );
          if (commands.menuCommands[data.scriptId].length === 0) {
            delete commands.menuCommands[data.scriptId];
          }
          await chrome.storage.session.set(commands);
        }
        return { success: true };
      }

      // Get menu commands
      case 'getMenuCommands': {
        const result = await chrome.storage.session.get('menuCommands');
        const allCommands = result?.menuCommands || {};
        const commands = [];
        
        // Flatten commands and add script info
        const scripts = await ScriptStorage.getAll();
        for (const [scriptId, cmds] of Object.entries(allCommands)) {
          const script = scripts.find(s => s.id === scriptId);
          if (script && cmds) {
            cmds.forEach(cmd => {
              commands.push({
                ...cmd,
                scriptId,
                scriptName: script.meta?.name || 'Unknown Script'
              });
            });
          }
        }
        
        return { commands };
      }
      
      // Execute menu command
      case 'executeMenuCommand': {
        // Send to content script
        if (sender.tab?.id) {
          await chrome.tabs.sendMessage(sender.tab.id, {
            action: 'executeMenuCommand',
            data: { scriptId: data.scriptId, commandId: data.commandId }
          });
        }
        return { success: true };
      }
      
      // GM_cookie API
      // chrome.cookies.* only accepts http(s) URLs. Front-validate so blob:/
      // data:/javascript:/chrome-extension: URLs from a malicious script return
      // a clear error instead of leaking the raw Chrome error (and to make sure
      // we never pass an attacker-controlled URL into a future Chrome API that
      // is more permissive about schemes).
      case 'GM_cookie_list': {
        try {
          const details = {};
          if (data.url) {
            if (!isHttpCookieUrl(data.url)) return { error: 'url must be http(s)://' };
            details.url = data.url;
          }
          if (data.domain) details.domain = data.domain;
          if (data.name) details.name = data.name;
          if (data.path) details.path = data.path;
          const cookies = await chrome.cookies.getAll(details);
          return { success: true, cookies };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'GM_cookie_set': {
        try {
          if (!data.url) return { error: 'url is required for cookie set' };
          if (!data.name) return { error: 'name is required for cookie set' };
          if (!isHttpCookieUrl(data.url)) return { error: 'url must be http(s)://' };
          const cookie = await chrome.cookies.set({
            url: data.url,
            name: data.name,
            value: data.value || '',
            domain: data.domain,
            path: data.path || '/',
            secure: data.secure || false,
            httpOnly: data.httpOnly || false,
            expirationDate: data.expirationDate,
            sameSite: data.sameSite || 'unspecified'
          });
          return { success: true, cookie };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'GM_cookie_delete': {
        try {
          if (!data.url || !data.name) return { error: 'url and name are required for cookie delete' };
          if (!isHttpCookieUrl(data.url)) return { error: 'url must be http(s)://' };
          await chrome.cookies.remove({
            url: data.url,
            name: data.name
          });
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      }

      // GM_webRequest — runtime rule update from script
      case 'GM_webRequest': {
        const scriptId = sender.userScriptId || data.scriptId;
        if (!scriptId) return { error: 'No script context' };
        // Verify the script has @grant GM_webRequest
        const script = await ScriptStorage.get(scriptId);
        if (!script?.meta?.grant?.includes('GM_webRequest')) return { error: 'Not granted' };
        const rules = Array.isArray(data.rules) ? data.rules : (data.rules ? [data.rules] : []);
        await applyWebRequestRules(scriptId, rules);
        return { success: true, count: rules.length };
      }

      // Execution profiling - get stats for dashboard
      case 'getScriptStats': {
        const scriptId = data.scriptId;
        if (scriptId) {
          const script = await ScriptStorage.get(scriptId);
          return { stats: script?.stats || null };
        }
        // Get stats for all scripts
        const scripts = await ScriptStorage.getAll();
        const allStats = {};
        for (const s of scripts) {
          if (s.stats) allStats[s.id] = s.stats;
        }
        return { allStats };
      }

      case 'resetScriptStats': {
        const scriptId = data.scriptId;
        const script = await ScriptStorage.get(scriptId);
        if (script) {
          script.stats = { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 };
          await ScriptStorage.set(scriptId, script);
        }
        return { success: true };
      }

      case 'reportExecTime': {
        const scriptId = data.scriptId;
        const script = await ScriptStorage.get(scriptId);
        if (script) {
          if (!script.stats) script.stats = { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 };
          script.stats.runs++;
          script.stats.totalTime += data.time;
          script.stats.avgTime = Math.round(script.stats.totalTime / script.stats.runs * 100) / 100;
          script.stats.lastRun = Date.now();
          script.stats.lastUrl = data.url;
          // Update cache only (debounced save to avoid excessive storage writes)
          _debouncedStatsSave();
        }
        return { success: true };
      }

      case 'reportExecError': {
        const scriptId = data.scriptId;
        const script = await ScriptStorage.get(scriptId);
        if (script) {
          if (!script.stats) script.stats = { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 };
          script.stats.errors++;
          script.stats.lastError = data.error;
          script.stats.lastErrorTime = Date.now();
          // Update cache only (debounced save to avoid excessive storage writes)
          _debouncedStatsSave();
        }
        return { success: true };
      }

      // GM_audio API - Tab mute control (Tampermonkey-compatible)
      case 'GM_audio_setMute': {
        try {
          const tabId = sender.tab?.id;
          if (!tabId) return { error: 'No tab context' };
          const mute = typeof data.mute === 'object' ? data.mute.mute : !!data.mute;
          await chrome.tabs.update(tabId, { muted: mute });
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'GM_audio_getState': {
        try {
          const tabId = sender.tab?.id;
          if (!tabId) return { error: 'No tab context' };
          const tab = await chrome.tabs.get(tabId);
          return {
            muted: tab.mutedInfo?.muted || false,
            reason: tab.mutedInfo?.reason || 'user',
            audible: tab.audible || false
          };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'GM_audio_watchState': {
        // Start watching tab audio state changes for the requesting tab
        const tabId = sender.tab?.id;
        if (!tabId) return { error: 'No tab context' };
        if (!self._audioWatchedTabs) self._audioWatchedTabs = new Set();
        self._audioWatchedTabs.add(tabId);
        SessionState.persistAudioWatchedTabs();
        return { success: true };
      }

      case 'GM_audio_unwatchState': {
        const tabId = sender.tab?.id;
        if (tabId && self._audioWatchedTabs?.delete(tabId)) {
          SessionState.persistAudioWatchedTabs();
        }
        return { success: true };
      }

      // ── v2.0 Module Handlers ──────────────────────────────────────────────

      // NPM Package Resolution
      case 'npmResolve': {
        if (typeof NpmResolver !== 'undefined') {
          return await NpmResolver.resolve(data.spec);
        }
        return { error: 'NpmResolver not available' };
      }

      case 'npmResolveAll': {
        if (typeof NpmResolver !== 'undefined') {
          return await NpmResolver.resolveAll(data.requires);
        }
        return { error: 'NpmResolver not available' };
      }

      // Error Log
      case 'logError': {
        if (typeof ErrorLog !== 'undefined') {
          await ErrorLog.log(data.entry || data);
          return { success: true };
        }
        return { error: 'ErrorLog not available' };
      }

      case 'getErrorLog': {
        if (typeof ErrorLog !== 'undefined') {
          return await ErrorLog.getAll(data.filters);
        }
        return { log: [] };
      }

      case 'getErrorLogGrouped': {
        if (typeof ErrorLog !== 'undefined') {
          return await ErrorLog.getGrouped();
        }
        return { groups: [] };
      }

      case 'exportErrorLog': {
        if (typeof ErrorLog !== 'undefined') {
          const format = data.format || 'json';
          if (format === 'csv') return { data: await ErrorLog.exportCSV() };
          if (format === 'text') return { data: await ErrorLog.exportText() };
          return { data: await ErrorLog.exportJSON() };
        }
        return { error: 'ErrorLog not available' };
      }

      case 'clearErrorLog': {
        if (typeof ErrorLog !== 'undefined') {
          await ErrorLog.clear();
          return { success: true };
        }
        return { error: 'ErrorLog not available' };
      }

      // Notification System
      case 'getNotificationPrefs': {
        if (typeof NotificationSystem !== 'undefined') {
          return await NotificationSystem.getPreferences();
        }
        return {};
      }

      case 'setNotificationPrefs': {
        if (typeof NotificationSystem !== 'undefined') {
          await NotificationSystem.setPreferences(data.prefs);
          return { success: true };
        }
        return { error: 'NotificationSystem not available' };
      }

      case 'generateDigest': {
        if (typeof NotificationSystem !== 'undefined') {
          return await NotificationSystem.generateDigest();
        }
        return { error: 'NotificationSystem not available' };
      }

      // Performance History
      // Easy Cloud Sync
      case 'easyCloudConnect': {
        if (typeof EasyCloudSync !== 'undefined') {
          return await EasyCloudSync.connect();
        }
        return { error: 'EasyCloudSync not available' };
      }

      case 'easyCloudDisconnect': {
        if (typeof EasyCloudSync !== 'undefined') {
          return await EasyCloudSync.disconnect();
        }
        return { error: 'EasyCloudSync not available' };
      }

      case 'easyCloudSync': {
        if (typeof EasyCloudSync !== 'undefined') {
          return await EasyCloudSync.sync();
        }
        return { error: 'EasyCloudSync not available' };
      }

      case 'easyCloudStatus': {
        if (typeof EasyCloudSync !== 'undefined') {
          return await EasyCloudSync.getStatus();
        }
        return { connected: false };
      }

      // Script Console Capture (for debugger)
      case 'scriptConsoleCapture': {
        // Append captured console entries to session storage
        const key = `console_${data.scriptId}`;
        const existing = await chrome.storage.session.get(key);
        const entries = existing[key] || [];
        const incoming = (data.entries || []).slice(-200);
        entries.push(...incoming);
        // Keep last 200 entries per script
        const trimmedEntries = entries.slice(-200);
        await chrome.storage.session.set({ [key]: trimmedEntries });
        return { success: true };
      }

      case 'getScriptConsole': {
        const consoleData = await chrome.storage.session.get(`console_${data.scriptId}`);
        return { entries: consoleData[`console_${data.scriptId}`] || [] };
      }

      case 'clearScriptConsole': {
        await chrome.storage.session.remove(`console_${data.scriptId}`);
        return { success: true };
      }

      // Live Reload toggle
      case 'setLiveReload': {
        const lrData = await chrome.storage.local.get('liveReloadScripts');
        const lrScripts = lrData.liveReloadScripts || {};
        if (data.enabled) {
          lrScripts[data.scriptId] = true;
        } else {
          delete lrScripts[data.scriptId];
        }
        await chrome.storage.local.set({ liveReloadScripts: lrScripts });
        return { success: true };
      }

      case 'getLiveReloadScripts': {
        const lrData2 = await chrome.storage.local.get('liveReloadScripts');
        return { scripts: lrData2.liveReloadScripts || {} };
      }

      case 'openDashboard': {
        const dashUrl = chrome.runtime.getURL('pages/dashboard.html');
        const scriptParam = data.scriptId ? `#script_${encodeURIComponent(data.scriptId)}` : '';
        const newParam = data.newScript ? '#new_script' : '';
        const tabParam = data.tab ? `#tab=${encodeURIComponent(data.tab)}` : '';
        await chrome.tabs.create({ url: dashUrl + (scriptParam || newParam || tabParam) });
        return { success: true };
      }

      case 'factoryReset': {
        // Clear all scripts through the storage abstraction so per-script
        // values, IDB rows, and in-memory caches stay consistent.
        const allScripts = await ScriptStorage.getAll();
        for (const s of allScripts) {
          await unregisterScript(s.id);
        }
        await ScriptStorage.clear();
        // Reset settings
        await SettingsManager.reset();
        await updateBadge();
        return { success: true };
      }

      case 'resetScriptSettings': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script) return { error: 'Script not found' };
        script.settings = {};
        await ScriptStorage.set(data.scriptId, script);
        return { success: true };
      }

      default:
        return { error: 'Unknown action: ' + action };
    }
  } catch (e) {
    console.error('[ScriptVault] Message handler error:', e);
    // Log to error system if available
    if (typeof ErrorLog !== 'undefined') {
      try { ErrorLog.log({ timestamp: Date.now(), error: e.message, stack: e.stack, context: 'handleMessage', action: action }); } catch {}
    }
    return { error: e.message };
  }
}

// ============================================================================
// Auto-reload matching tabs
// ============================================================================

// Debounced auto-reload to prevent mass tab reloads on rapid saves
let _autoReloadTimer = null;
let _autoReloadScriptsMap = new Map(); // scriptId → script (deduplicates rapid saves)

async function autoReloadMatchingTabs(script) {
  const settings = await SettingsManager.get();
  if (!settings.autoReload) return;

  _autoReloadScriptsMap.set(script.id, script);
  if (_autoReloadTimer) clearTimeout(_autoReloadTimer);

  _autoReloadTimer = setTimeout(async () => {
    const scripts = [..._autoReloadScriptsMap.values()];
    _autoReloadScriptsMap.clear();
    _autoReloadTimer = null;

    try {
      const tabs = await chrome.tabs.query({});
      const reloaded = new Set();
      for (const tab of tabs) {
        if (reloaded.has(tab.id)) continue;
        if (tab.url && scripts.some(s => doesScriptMatchUrl(s, tab.url))) {
          chrome.tabs.reload(tab.id).catch(() => {});
          reloaded.add(tab.id);
        }
      }
    } catch (e) {
      console.error('[ScriptVault] Auto-reload failed:', e);
    }
  }, 500);
}

// ============================================================================
// Badge Management
// ============================================================================

// chrome.action.* rejects if the target tab was closed between query and
// update ("No tab with id N"). These rejections surface as unhandled
// promises in the SW error log. All badge writes are fire-and-forget by
// design (a vanished tab is a non-event, not an error), so wrap once
// instead of sprinkling `.catch(() => {})` on every call.
function _setBadgeText(opts) {
  try {
    chrome.action.setBadgeText(opts).catch(() => {});
  } catch (_e) { /* synchronous throws (rare) — ignore */ }
}
function _setBadgeBackgroundColor(opts) {
  try {
    chrome.action.setBadgeBackgroundColor(opts).catch(() => {});
  } catch (_e) { /* see above */ }
}

async function updateBadge(tabId = null) {
  const settings = await SettingsManager.get();

  if (!settings.showBadge || settings.enabled === false) {
    _setBadgeText({ text: '', tabId: tabId || undefined });
    return;
  }

  if (tabId) {
    // Update a specific tab
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url) {
        await updateBadgeForTab(tabId, tab.url, settings);
      }
    } catch (e) {
      _setBadgeText({ text: '', tabId });
    }
    return;
  }

  // No specific tab — update all tabs in parallel
  try {
    const [tabs, scripts] = await Promise.all([
      chrome.tabs.query({}),
      ScriptStorage.getAll()
    ]);
    await Promise.allSettled(
      tabs.filter(t => t.id && t.url).map(t => updateBadgeForTab(t.id, t.url, settings, scripts))
    );
  } catch (e) {
    _setBadgeText({ text: '' });
  }
}

// Update badge for a specific tab based on its URL.
// Accepts optional pre-fetched settings/scripts to avoid redundant cache reads when
// called from updateBadge() in a loop over many tabs.
async function updateBadgeForTab(tabId, url, settings, scripts) {
  if (!settings) settings = await SettingsManager.get();

  if (!settings.showBadge || settings.enabled === false) {
    _setBadgeText({ text: '', tabId });
    return;
  }

  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    _setBadgeText({ text: '', tabId });
    return;
  }

  try {
    // Check global page filter
    if (isUrlBlockedByGlobalSettings(url, settings)) {
      _setBadgeText({ text: '', tabId });
      return;
    }

    if (!scripts) scripts = await ScriptStorage.getAll();
    const matchingScripts = scripts.filter(script => script.enabled && doesScriptMatchUrl(script, url));

    const badgeInfo = settings.badgeInfo || 'running';
    let badgeText = '';
    if (badgeInfo === 'running') {
      badgeText = matchingScripts.length > 0 ? String(matchingScripts.length) : '';
    } else if (badgeInfo === 'total') {
      const allEnabled = scripts.filter(s => s.enabled).length;
      badgeText = allEnabled > 0 ? String(allEnabled) : '';
    }
    // badgeInfo === 'none' leaves badgeText empty
    _setBadgeText({ text: badgeText, tabId });
    _setBadgeBackgroundColor({ color: settings.badgeColor || '#22c55e', tabId });
  } catch (e) {
    console.error('[ScriptVault] Failed to update badge:', e);
  }
}

// Check if URL is blocked by global page filter or denied hosts
function isUrlBlockedByGlobalSettings(url, globalSettings) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // Denied hosts
    const denied = globalSettings.deniedHosts;
    if (denied && Array.isArray(denied)) {
      for (const host of denied) {
        if (host && (urlObj.hostname === host || urlObj.hostname.endsWith('.' + host))) {
          return true;
        }
      }
    }
    // Page filter mode
    const mode = globalSettings.pageFilterMode || 'blacklist';
    if (mode === 'whitelist') {
      const whitelist = (globalSettings.whitelistedPages || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (whitelist.length > 0) {
        const matched = whitelist.some(p => matchIncludePattern(p, url, urlObj));
        if (!matched) return true;
      }
    } else if (mode === 'blacklist') {
      const blacklist = (globalSettings.blacklistedPages || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (blacklist.length > 0) {
        const matched = blacklist.some(p => matchIncludePattern(p, url, urlObj));
        if (matched) return true;
      }
    }
  } catch (e) {}
  return false;
}

// Check if a script matches a URL (with URL override support)
function doesScriptMatchUrl(script, url) {
  const meta = script.meta || {};
  const settings = script.settings || {};

  try {
    const urlObj = new URL(url);

    // Build effective patterns based on settings
    let effectiveMatches = [];
    let effectiveIncludes = [];
    let effectiveExcludes = [];
    
    // Original @match patterns (if enabled)
    if (settings.useOriginalMatches !== false) {
      const origMatches = Array.isArray(meta.match) ? meta.match : (meta.match ? [meta.match] : []);
      effectiveMatches.push(...origMatches);
    }
    
    // User @match patterns
    if (settings.userMatches && settings.userMatches.length > 0) {
      effectiveMatches.push(...settings.userMatches);
    }
    
    // Original @include patterns (if enabled)
    if (settings.useOriginalIncludes !== false) {
      const origIncludes = Array.isArray(meta.include) ? meta.include : (meta.include ? [meta.include] : []);
      effectiveIncludes.push(...origIncludes);
    }
    
    // User @include patterns
    if (settings.userIncludes && settings.userIncludes.length > 0) {
      effectiveIncludes.push(...settings.userIncludes);
    }
    
    // Original @exclude patterns (if enabled)
    if (settings.useOriginalExcludes !== false) {
      const origExcludes = Array.isArray(meta.exclude) ? meta.exclude : (meta.exclude ? [meta.exclude] : []);
      effectiveExcludes.push(...origExcludes);
    }
    
    // User @exclude patterns
    if (settings.userExcludes && settings.userExcludes.length > 0) {
      effectiveExcludes.push(...settings.userExcludes);
    }
    
    // Also check @exclude-match (stored as excludeMatch by parser)
    const excludeMatchPatterns = Array.isArray(meta.excludeMatch) ? meta.excludeMatch :
                          (meta.excludeMatch ? [meta.excludeMatch] : []);
    
    // First check if URL matches any exclude pattern
    for (const pattern of effectiveExcludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return false;
    }
    for (const pattern of excludeMatchPatterns) {
      if (matchPattern(pattern, url, urlObj)) return false;
    }
    
    // Then check if URL matches any include/match pattern
    for (const pattern of effectiveMatches) {
      if (matchPattern(pattern, url, urlObj)) return true;
    }
    for (const pattern of effectiveIncludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

// Match a @match pattern against a URL
function matchPattern(pattern, url, urlObj) {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;
  if (pattern === '*') return true;
  
  try {
    // Parse the pattern
    const patternMatch = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]+)(\/.*)$/);
    if (!patternMatch) return false;
    
    const [, scheme, host, path] = patternMatch;
    
    // Check scheme
    if (scheme !== '*' && scheme !== urlObj.protocol.slice(0, -1)) {
      return false;
    }
    
    // Check host (use urlObj.host when pattern includes port, urlObj.hostname otherwise)
    if (host !== '*') {
      const hasPort = host.includes(':');
      const urlHost = hasPort ? urlObj.host : urlObj.hostname;
      if (host.startsWith('*.')) {
        const baseDomain = host.slice(2);
        if (hasPort) {
          // For *.example.com:8080, compare host (includes port) against baseDomain
          if (urlHost !== baseDomain && !urlHost.endsWith('.' + baseDomain)) {
            return false;
          }
        } else {
          // For *.example.com, compare hostname only
          if (urlObj.hostname !== baseDomain && !urlObj.hostname.endsWith('.' + baseDomain)) {
            return false;
          }
        }
      } else if (host !== urlHost) {
        return false;
      }
    }
    
    // Check path (convert glob to regex). Collapse consecutive `*` first so a
    // crafted @match like `/****…****a` can't produce `(.*){N}` — catastrophic
    // backtracking that freezes the SW per evaluated URL (matches matchIncludePattern).
    const pathRegex = new RegExp('^' + path.replace(/\*+/g, '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    if (!pathRegex.test(urlObj.pathname + urlObj.search)) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

// Match an @include pattern (glob-style or regex)
function matchIncludePattern(pattern, url, urlObj) {
  if (!pattern) return false;
  if (pattern === '*') return true;

  try {
    // Handle regex patterns: /regex/ or /regex/flags
    if (isRegexPattern(pattern)) {
      const re = parseRegexPattern(pattern);
      return re ? re.test(url) : false;
    }

    // Convert glob to regex — collapse consecutive wildcards to prevent ReDoS
    let regex = pattern
      .replace(/\*{2,}/g, '*')                // Collapse consecutive * to single
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special chars
      .replace(/\*/g, '.*')                   // * -> .*
      .replace(/\?/g, '.');                   // ? -> .

    // Handle scheme wildcards
    regex = regex.replace(/^(\\\*):\/\//, '(https?|file|ftp)://');

    const re = new RegExp('^' + regex + '$', 'i');
    return re.test(url);
  } catch (e) {
    return false;
  }
}

// ============================================================================
// MatchSet — precompiled host index (Phase 4.2)
//
// `getScriptsForUrl` and the badge/tab-reload paths previously walked every
// script and every pattern on every URL. With 200+ scripts that's hundreds
// of regex tests per popup open. MatchSet precomputes a hostname → script
// index so the candidate set drops to scripts whose patterns could possibly
// match before the slow per-pattern check runs.
//
// See `src/background/url-matcher.ts` for the typed mirror; logic must
// stay aligned.
// ============================================================================

function _extractHostHint(pattern, kind) {
  if (!pattern) return null;
  if (pattern === '*' || pattern === '<all_urls>') return null;
  if ((kind === 'include' || kind === 'exclude') && isRegexPattern(pattern)) return null;

  const m = pattern.match(/^(?:\*|https?|file|ftp):\/\/([^/]+)/);
  if (!m) return null;
  const host = m[1];
  if (!host || host === '*') return null;
  const noPort = host.replace(/:\d+$/, '');
  if (noPort.startsWith('*.')) return noPort.slice(2).toLowerCase();
  if (noPort.includes('*')) return null;
  return noPort.toLowerCase();
}

function _getEffectivePatterns(script) {
  const meta = script.meta || {};
  const settings = script.settings || {};
  const out = [];
  const pushAll = (arr, kind) => {
    if (!arr) return;
    const list = Array.isArray(arr) ? arr : [arr];
    for (const p of list) {
      if (typeof p === 'string' && p) out.push({ pattern: p, kind });
    }
  };
  if (settings.useOriginalMatches !== false) pushAll(meta.match, 'match');
  pushAll(settings.userMatches, 'match');
  if (settings.useOriginalIncludes !== false) pushAll(meta.include, 'include');
  pushAll(settings.userIncludes, 'include');
  pushAll(meta.excludeMatch, 'excludeMatch');
  return out;
}

class MatchSet {
  constructor(scripts) {
    this.universal = [];
    this.byHost = new Map();
    this.size = scripts.length;

    for (const script of scripts) {
      if (!script || !script.id) continue;
      const patterns = _getEffectivePatterns(script);
      const positive = patterns.filter(p => p.kind === 'match' || p.kind === 'include');
      if (positive.length === 0) continue;

      let allUniversal = false;
      const hosts = new Set();
      for (const p of positive) {
        if (p.pattern === '*' || p.pattern === '<all_urls>') {
          allUniversal = true;
          break;
        }
        const hint = _extractHostHint(p.pattern, p.kind);
        if (hint == null) {
          allUniversal = true;
          break;
        }
        hosts.add(hint);
      }

      if (allUniversal) {
        this.universal.push(script);
      } else {
        for (const host of hosts) {
          let bucket = this.byHost.get(host);
          if (!bucket) {
            bucket = [];
            this.byHost.set(host, bucket);
          }
          bucket.push(script);
        }
      }
    }
  }

  /**
   * Return scripts whose @match/@include patterns *could* match `url`.
   * The result is a superset — callers must run `doesScriptMatchUrl` for
   * the authoritative answer.
   */
  getCandidates(url) {
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return this.universal.slice();
    }

    const seen = new Set();
    const out = [];
    for (const s of this.universal) {
      if (!seen.has(s)) { seen.add(s); out.push(s); }
    }

    let cursor = hostname;
    while (cursor) {
      const bucket = this.byHost.get(cursor);
      if (bucket) {
        for (const s of bucket) {
          if (!seen.has(s)) { seen.add(s); out.push(s); }
        }
      }
      const dot = cursor.indexOf('.');
      if (dot < 0) break;
      cursor = cursor.slice(dot + 1);
    }
    return out;
  }

  /**
   * Return scripts that actually match `url` after running candidates
   * through `doesScriptMatchUrl`.
   */
  getMatching(url) {
    return this.getCandidates(url).filter(s => doesScriptMatchUrl(s, url));
  }
}

// Cached MatchSet — invalidated whenever the script set changes.
let _matchSetCache = null;
let _matchSetCacheVersion = 0;

function invalidateMatchSet() {
  _matchSetCache = null;
  _matchSetCacheVersion++;
}

if (typeof setScriptChangeListener === 'function') {
  setScriptChangeListener(invalidateMatchSet);
}

async function getMatchSet() {
  if (_matchSetCache) return _matchSetCache;
  const scripts = await ScriptStorage.getAll();
  _matchSetCache = new MatchSet(scripts);
  return _matchSetCache;
}

// ============================================================================
// Context Menu
// ============================================================================

async function setupContextMenus() {
  await chrome.contextMenus.removeAll();
  const settings = await SettingsManager.get();
  if (settings.enableContextMenu === false) return;

  chrome.contextMenus.create({
    id: 'scriptvault-new',
    title: 'Create script for this site',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'scriptvault-dashboard',
    title: 'Open ScriptVault Dashboard',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'scriptvault-toggle',
    title: 'Toggle all scripts',
    contexts: ['page']
  });

  // v2.0: Install from link — right-click a .user.js link to install
  chrome.contextMenus.create({
    id: 'scriptvault-install-link',
    title: 'Install userscript from link',
    contexts: ['link'],
    targetUrlPatterns: ['*://*/*.user.js', '*://*/*.user.js?*']
  });

  // Add context menu entries for @run-at context-menu scripts
  const scripts = await ScriptStorage.getAll();
  const contextScripts = scripts.filter(s => s.enabled !== false && s.meta && s.meta['run-at'] === 'context-menu');
  if (contextScripts.length > 0) {
    chrome.contextMenus.create({
      id: 'scriptvault-separator',
      type: 'separator',
      contexts: ['page', 'selection', 'link', 'image']
    });
    for (const script of contextScripts) {
      chrome.contextMenus.create({
        id: `scriptvault-ctx-${script.id}`,
        // Phase 39.31 — pre-emptive clamp; Chrome visually ellipsises long
        // context-menu titles but the spec proposal may make oversize titles
        // an error in the future.
        title: _clampString(script.meta.name || script.id, SV_CONTEXT_MENU_TITLE_MAX),
        contexts: ['page', 'selection', 'link', 'image']
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  setupContextMenus();

  // v2.0: Initialize backup scheduler (needs alarm registration on install)
  if (typeof BackupScheduler !== 'undefined') {
    try { await BackupScheduler.init(); } catch (e) { console.error('[ScriptVault] BackupScheduler init error:', e); }
  }

  // v2.0: Schedule notification digest (needs alarm registration on install)
  if (typeof NotificationSystem !== 'undefined') {
    try { await NotificationSystem.scheduleDigest(); } catch (e) { console.error('[ScriptVault] Digest schedule error:', e); }
  }

  // v2.0: Register public API listeners
  if (typeof PublicAPI !== 'undefined') {
    try { PublicAPI.init(); } catch (e) { console.error('[ScriptVault] PublicAPI init error:', e); }
  }

  // Note: Migration.run() is called in the main init() function, not here,
  // to avoid running it twice on install (onInstalled + init both fire).
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'scriptvault-new': {
      if (!tab?.url) break;
      try {
        const url = new URL(tab.url);
        chrome.tabs.create({
          url: `pages/dashboard.html?new=1&host=${encodeURIComponent(url.hostname)}`
        });
      } catch { chrome.tabs.create({ url: 'pages/dashboard.html?new=1' }); }
      break;
    }
    case 'scriptvault-dashboard':
      chrome.tabs.create({ url: 'pages/dashboard.html' });
      break;
    case 'scriptvault-toggle': {
      const settings = await SettingsManager.get();
      await SettingsManager.set('enabled', !settings.enabled);
      await registerAllScripts(true);
      await updateBadge();
      break;
    }
    case 'scriptvault-install-link': {
      // v2.0: Install userscript from a right-clicked .user.js link
      const linkUrl = info.linkUrl;
      if (linkUrl) {
        try {
          InternalHostGuard.assertExternalFetchUrl(linkUrl, 'Script source', ['http:', 'https:']);
          const response = await fetch(linkUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
          if (!postCheck.ok) {
            throw new Error('Script source redirected to ' + postCheck.message);
          }
          const code = await _fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script');
          if (code.includes('==UserScript==')) {
            await chrome.storage.local.set({
              pendingInstall: { code, url: linkUrl, timestamp: Date.now() }
            });
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/install.html') });
          } else {
            chrome.notifications.create({
              type: 'basic', iconUrl: 'images/icon128.png',
              title: 'Not a Userscript',
              message: 'The linked file does not contain a valid ==UserScript== block.'
            });
          }
        } catch (e) {
          chrome.notifications.create({
            type: 'basic', iconUrl: 'images/icon128.png',
            title: 'Install Failed',
            message: `Could not fetch script: ${e.message}`
          });
        }
      }
      break;
    }
    default: {
      // Handle @run-at context-menu script execution
      if (info.menuItemId && typeof info.menuItemId === 'string' && info.menuItemId.startsWith('scriptvault-ctx-')) {
        const scriptId = info.menuItemId.replace('scriptvault-ctx-', '');
        const script = await ScriptStorage.get(scriptId);
        if (script && tab?.id) {
          try {
            // Build wrapped script with GM API support (same as auto-registered scripts)
            const meta = script.meta;
            const requires = Array.isArray(meta.require) ? meta.require : (meta.require ? [meta.require] : []);
            const requireScripts = [];
            for (const url of requires) {
              try {
                const code = await fetchRequireScript(url);
                if (code) requireScripts.push({ url, code });
              } catch (e) {}
            }
            const storedValues = await ScriptValues.getAll(script.id) || {};
            const wrappedCode = buildWrappedScript(script, requireScripts, storedValues, [], []);
            // Execute in ISOLATED world (content script context) which has chrome.runtime access
            // The wrapper's sendToBackground uses chrome.runtime.sendMessage directly
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (code) => { (0, eval)(code); },
              args: [wrappedCode]
            });
            // Feedback notification
            const settings = await SettingsManager.get();
            if (settings.notifyOnError !== false) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon128.png',
                title: 'Script Executed',
                message: `${script.meta.name} ran via context menu`
              });
            }
          } catch (e) {
            console.error(`[ScriptVault] Context-menu script execution failed:`, e);
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'images/icon128.png',
              title: 'Script Failed',
              message: `${script.meta.name}: ${e.message || 'Unknown error'}`
            });
          }
        }
      }
      break;
    }
  }
});

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

chrome.commands.onCommand.addListener(async (command) => {
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
  switch (command) {
    case 'open_dashboard':
      chrome.tabs.create({ url: 'pages/dashboard.html' });
      break;
    case 'toggle_scripts': {
      const settings = await SettingsManager.get();
      await SettingsManager.set('enabled', !settings.enabled);
      await registerAllScripts(true);
      await updateBadge();

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'ScriptVault',
        message: settings.enabled ? 'Scripts disabled' : 'Scripts enabled'
      });
      break;
    }
  }
});

// ============================================================================
// Phase 39.29 — Omnibox keyword "sv"
// ============================================================================
// Type `sv ` in the address bar, then a fragment of any installed script's
// name or @tag. Suggestions surface inline; Enter opens the script in the
// dashboard editor. Chrome 149+ stabilized the Omnibox API for MV3 SW
// contexts (previously the listeners required a DOM-backed page).
//
// Suggestion budget: Chrome shows at most ~6 suggestions; we cap our matches
// at 8 to leave room for default-suggestion render slop. Matching is a simple
// case-insensitive substring across name + namespace + tags — Phase 12.2's
// fuzzy index isn't wired through to the SW yet.

if (chrome.omnibox?.onInputChanged) {
  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
    const query = (text || '').trim().toLowerCase();
    if (!query) {
      suggest([]);
      return;
    }
    try {
      const scripts = await ScriptStorage.getAll();
      const matches = [];
      for (const s of scripts) {
        const name = (s.meta?.name || '').toLowerCase();
        const ns = (s.meta?.namespace || '').toLowerCase();
        const tags = Array.isArray(s.meta?.tag) ? s.meta.tag.map(t => String(t).toLowerCase()) : [];
        if (name.includes(query) || ns.includes(query) || tags.some(t => t.includes(query))) {
          matches.push(s);
          if (matches.length >= 8) break;
        }
      }
      suggest(matches.map(s => ({
        // `content` is the value that becomes the URL bar text on Enter; we
        // encode the script ID so onInputEntered can dispatch without a
        // second lookup.
        content: `id:${s.id}`,
        // `description` is HTML-allowed but limited — clamp the script name
        // through the same WECG #935 string-length guard used for context-
        // menu titles.
        description: `<match>${_clampString((s.meta?.name || s.id), SV_CONTEXT_MENU_TITLE_MAX)}</match>` +
          (s.meta?.version ? ` <dim>v${escapeOmnibox(s.meta.version)}</dim>` : '') +
          (s.enabled === false ? ' <dim>(disabled)</dim>' : '')
      })));
    } catch (e) {
      console.warn('[ScriptVault] Omnibox onInputChanged failed:', e?.message || e);
      suggest([]);
    }
  });

  chrome.omnibox.onInputEntered.addListener(async (text, _disposition) => {
    try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
    let scriptId = null;
    const m = (text || '').match(/^id:(.+)$/);
    if (m) {
      scriptId = m[1].trim();
    } else {
      // User typed a query and hit Enter without picking a suggestion — open
      // the dashboard with the search pre-filled.
      chrome.tabs.create({ url: `pages/dashboard.html?search=${encodeURIComponent(text || '')}` });
      return;
    }
    chrome.tabs.create({ url: `pages/dashboard.html#script/${encodeURIComponent(scriptId)}` });
  });
}

// Minimal HTML-entity escape for omnibox description strings. The omnibox
// renderer accepts a small XML subset (<match>, <dim>, <url>); content
// outside those tags must be escaped or Chrome silently drops the suggestion.
function escapeOmnibox(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================================
// Alarms (Auto-update & Sync)
// ============================================================================

// Stats save coalescing — chrome.alarms instead of setTimeout so the debounce
// survives MV3 service-worker termination. Minimum delayInMinutes is 0.5 in
// production (Chrome enforces a 30s floor for non-development extensions); in
// dev builds the smaller value below applies.
const STATS_SAVE_ALARM = 'statsSave';
function _debouncedStatsSave() {
  // delayInMinutes 0.1 = 6s in unpacked dev; production extensions clamp to 30s.
  // ScriptStorage.save is idempotent, so creating the alarm repeatedly while
  // pending only resets the timer — that's the intended debounce.
  try {
    chrome.alarms.create(STATS_SAVE_ALARM, { delayInMinutes: 0.1 });
  } catch (_) { /* alarms unavailable (e.g. SW shutting down) — drop the write */ }
}

let _backgroundTaskRunning = false;
let _backgroundTaskToken = 0;
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Cold-start: an alarm can wake the SW before init() finishes. Wait for it
  // so handlers below see a fully-initialised ScriptStorage / SettingsManager.
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }

  // Stats save (coalesces rapid reportExecTime/Error writes)
  if (alarm.name === STATS_SAVE_ALARM) {
    try { await ScriptStorage.save(); } catch (_) { /* non-critical */ }
    return;
  }

  // Handle notification auto-close alarms
  if (alarm.name.startsWith('notif_clear_')) {
    const notifId = alarm.name.slice('notif_clear_'.length);
    chrome.notifications.clear(notifId).catch(() => {});
    if (self._notifCallbacks) {
      self._notifCallbacks.delete(notifId);
      SessionState.persistNotifCallbacks();
    }
    return;
  }

  // Handle notification context cleanup alarms
  if (alarm.name.startsWith('notifCtx_clean_')) {
    const notifId = alarm.name.slice('notifCtx_clean_'.length);
    chrome.storage.local.remove(`notifCtx_${notifId}`).catch(() => {});
    return;
  }

  // Handle @crontab script execution alarms (independent of the update/sync mutex)
  if (alarm.name.startsWith('crontab_')) {
    const scriptId = alarm.name.slice('crontab_'.length);
    handleCrontabAlarm(scriptId).catch(e => console.error('[ScriptVault] Crontab alarm error:', e));
    return;
  }

  // Delegate to NotificationSystem for weekly-digest + internal context alarms.
  // Without this dispatch the `scriptvault-weekly-digest` alarm would fire into
  // nothing (the branches below only handle autoUpdate/autoSync), so the digest
  // notification — which users explicitly opt into via prefs.digest — would
  // silently never generate.
  if (typeof NotificationSystem !== 'undefined' && typeof NotificationSystem.handleAlarm === 'function') {
    try {
      const handled = await NotificationSystem.handleAlarm(alarm);
      if (handled) return;
    } catch (e) {
      console.error('[ScriptVault] NotificationSystem alarm error:', e);
    }
  }

  // Mutual exclusion — don't run update and sync concurrently
  if (_backgroundTaskRunning) {
    debugLog('Skipping alarm', alarm.name, '- another task is running');
    return;
  }
  _backgroundTaskRunning = true;
  // Safety timeout: release mutex after 5 minutes even if the task hangs.
  // Each task gets a unique token so the late-finishing task can tell whether
  // the safety timer has already released the mutex for the next task — if so,
  // the stale finally block must NOT clobber the new task's `true` flag.
  const myToken = ++_backgroundTaskToken;
  const safetyTimer = setTimeout(() => {
    if (_backgroundTaskToken === myToken) _backgroundTaskRunning = false;
  }, 300000);
  try {
    if (alarm.name === 'autoUpdate') {
      await UpdateSystem.autoUpdate();
    } else if (alarm.name === 'autoSync') {
      await CloudSync.sync();
    }
  } catch (e) {
    console.error('[ScriptVault] Alarm handler error:', e);
  } finally {
    clearTimeout(safetyTimer);
    if (_backgroundTaskToken === myToken) _backgroundTaskRunning = false;
  }
});

// ============================================================================
// @crontab Support
// ============================================================================

// Convert a simplified cron expression to a period in minutes.
// Chrome alarms have a minimum of 1 minute.
// Supports: every-N-minutes, hourly, every-N-hours, daily.
// Falls back to 1 minute for complex expressions.
function parseCronToMinutes(expr) {
  if (!expr || typeof expr !== 'string') return 60;
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return 60;
  const [min, hour, dom, month, dow] = parts;
  if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(min.slice(2), 10);
    return isNaN(n) || n < 1 ? 1 : Math.min(n, 1440);
  }
  if (min === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(hour.slice(2), 10);
    return isNaN(n) || n < 1 ? 60 : Math.min(n * 60, 1440);
  }
  if (min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 60;
  }
  if (min === '0' && hour === '0' && dom === '*' && month === '*' && dow === '*') {
    return 1440;
  }
  // Complex expression not supported by simplified parser — fall back to hourly
  debugLog(`[parseCronToMinutes] Unrecognized cron expression: "${expr}", defaulting to 60 min`);
  return 60;
}

/** Execute a @crontab script in all currently-open matching tabs. */
async function handleCrontabAlarm(scriptId) {
  const script = await ScriptStorage.get(scriptId);
  if (!script || !script.enabled || !script.meta?.crontab) {
    chrome.alarms.clear('crontab_' + scriptId).catch(() => {});
    return;
  }

  const meta = script.meta;
  const hasMatches = (meta.match && meta.match.length > 0) || (meta.include && meta.include.length > 0);
  if (!hasMatches) {
    debugLog(`@crontab script ${meta.name} has no @match patterns, skipping`);
    return;
  }

  // Fetch @require scripts
  const requireScripts = [];
  const requires = Array.isArray(meta.require) ? meta.require : (meta.require ? [meta.require] : []);
  for (const url of requires) {
    try {
      const code = await fetchRequireScript(url);
      if (code) requireScripts.push({ url, code });
    } catch (e) {}
  }

  const storedValues = await ScriptValues.getAll(script.id) || {};
  // Extract regex @include/@exclude patterns for runtime URL guard in wrapper
  const regexIncludes = [];
  const regexExcludes = [];
  for (const inc of (meta.include || [])) {
    if (/^\/.*\/$|^\/.*\/[gimsuy]+$/.test(inc)) regexIncludes.push(inc);
  }
  for (const exc of (meta.exclude || [])) {
    if (/^\/.*\/$|^\/.*\/[gimsuy]+$/.test(exc)) regexExcludes.push(exc);
  }
  const wrappedCode = buildWrappedScript(script, requireScripts, storedValues, regexIncludes, regexExcludes);

  const tabs = await chrome.tabs.query({ status: 'complete' });
  for (const tab of tabs) {
    if (!tab.url || !tab.id) continue;
    if (!doesScriptMatchUrl(script, tab.url)) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => { (new Function(code))(); },
        args: [wrappedCode],
        world: 'ISOLATED'
      });
      debugLog(`@crontab ${meta.name}: executed in tab ${tab.id}`);
    } catch (e) {
      debugLog(`@crontab ${meta.name}: failed in tab ${tab.id}: ${e.message}`);
    }
  }
}

/** Create/refresh chrome alarms for all enabled @crontab scripts. */
async function setupCrontabAlarms() {
  const scripts = await ScriptStorage.getAll();
  for (const script of scripts) {
    const alarmName = 'crontab_' + script.id;
    await chrome.alarms.clear(alarmName).catch(() => {});
    if (script.enabled && script.meta?.crontab) {
      const minutes = Math.max(1, parseCronToMinutes(script.meta.crontab));
      chrome.alarms.create(alarmName, { periodInMinutes: minutes });
    }
  }
}

async function setupAlarms() {
  const settings = await SettingsManager.get();
  
  // Clear only the alarms we manage here (preserve notification/backup alarms)
  await chrome.alarms.clear('autoUpdate').catch(() => {});
  await chrome.alarms.clear('autoSync').catch(() => {});
  
  // Setup auto-update alarm
  // checkInterval is hours from dashboard, updateInterval is ms legacy
  if (settings.autoUpdate) {
    const intervalMs = settings.checkInterval
      ? parseInt(settings.checkInterval) * 3600000
      : (settings.updateInterval || 86400000);
    chrome.alarms.create('autoUpdate', {
      periodInMinutes: Math.max(1, intervalMs / 60000)
    });
  }
  
  // Setup sync alarm
  if (settings.syncEnabled && settings.syncProvider !== 'none') {
    const syncMs = settings.syncInterval || 3600000; // Default 1 hour
    chrome.alarms.create('autoSync', {
      periodInMinutes: Math.max(1, syncMs / 60000)
    });
  }

  // Setup @crontab alarms for all enabled scripts
  await setupCrontabAlarms();
}

// ============================================================================
// Tab Listeners (for badge updates)
// ============================================================================

// Update badge when tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await updateBadgeForTab(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // Tab might not exist
  }
});

// Update badge when tab URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
  if (changeInfo.url || changeInfo.status === 'complete') {
    if (tab.url) {
      await updateBadgeForTab(tabId, tab.url);
    }
  }

  // Forward audio state changes to watched tabs
  if (('audible' in changeInfo || 'mutedInfo' in changeInfo) && self._audioWatchedTabs?.has(tabId)) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'audioStateChanged',
        data: {
          muted: tab.mutedInfo?.muted || false,
          reason: tab.mutedInfo?.reason || 'user',
          audible: tab.audible || false
        }
      });
    } catch (e) {
      // Tab may have been closed
      self._audioWatchedTabs.delete(tabId);
      SessionState.persistAudioWatchedTabs();
    }
  }
});

// GM_openInTab onclose: fire callback when tracked tab closes
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
  const tracker = self._openTabTrackers?.get(tabId);
  if (tracker) {
    chrome.tabs.sendMessage(tracker.callerTabId, {
      action: 'openedTabClosed',
      data: { tabId, scriptId: tracker.scriptId }
    }).catch(() => {});
    self._openTabTrackers.delete(tabId);
    SessionState.persistOpenTabTrackers();
  }
  // Clean up audio watch tracking for closed tabs
  if (self._audioWatchedTabs?.delete(tabId)) {
    SessionState.persistAudioWatchedTabs();
  }
});

// GM_notification onclick/ondone: fire callbacks on notification interaction
chrome.notifications.onClicked.addListener(async (notifId) => {
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
  const cb = self._notifCallbacks?.get(notifId);
  if (cb && cb.hasOnclick) {
    chrome.tabs.sendMessage(cb.tabId, {
      action: 'notificationEvent',
      data: { notifId, scriptId: cb.scriptId, type: 'click' }
    }).catch(() => {});
  }
});

chrome.notifications.onClosed.addListener(async (notifId, byUser) => {
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
  const cb = self._notifCallbacks?.get(notifId);
  if (cb && cb.hasOndone) {
    chrome.tabs.sendMessage(cb.tabId, {
      action: 'notificationEvent',
      data: { notifId, scriptId: cb.scriptId, type: 'done', byUser }
    }).catch(() => {});
  }
  if (self._notifCallbacks) {
    self._notifCallbacks.delete(notifId);
    SessionState.persistNotifCallbacks();
  }
});

// Phase 11.11 — Notification button click routing.
// ScriptCat exposes `e.buttonClickIndex` on the onclick event when the user
// clicks an action button. Forward the index to the originating tab so the
// wrapper-side onbuttonclick callback can fire.
chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  try { await ensureInitialized(); } catch (_) { /* logged in init() */ }
  const cb = self._notifCallbacks?.get(notifId);
  if (cb && cb.hasOnbuttonclick) {
    chrome.tabs.sendMessage(cb.tabId, {
      action: 'notificationEvent',
      data: { notifId, scriptId: cb.scriptId, type: 'buttonClick', buttonIndex }
    }).catch(() => {});
  }
});

// Update badge when window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.id && tab.url) {
      await updateBadgeForTab(tab.id, tab.url);
    }
  } catch (e) {
    // Window might not exist
  }
});

// ============================================================================
// Userscript Installation Handler
// ============================================================================

// Intercept navigation to .user.js files
// Map<url, Promise<'install' | 'pass-through'>> dedups concurrent fetches for
// the same URL and lets later callers reuse the first fetch's result. Without
// this, opening the same .user.js in two tabs at once left the second tab on
// the raw script source (the dedup short-circuit returned before it could
// redirect to install.html).
const _pendingFetches = new Map();
const MAX_SCRIPT_SIZE = 5 * 1024 * 1024; // 5MB limit

async function _fetchPendingUserscript(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    // Pre-flight: reject internal/loopback/link-local install URLs before any
    // network I/O.
    InternalHostGuard.assertExternalFetchUrl(url, 'Script source', ['http:', 'https:']);

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    // Post-flight: catch public URLs that redirect into internal address space.
    const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
    if (!postCheck.ok) {
      throw new Error('Script source redirected to ' + postCheck.message);
    }
    // Stream-bounded read so a hostile server can't OOM us by serving an
    // unbounded body (the previous content-length check was advisory and
    // ran AFTER `response.text()` already buffered everything).
    const code = await _fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script');
    if (!code.includes('==UserScript==')) {
      return { action: 'pass-through' };
    }
    // Defensive: storage.set can reject (quota, disk full). Surface the
    // failure so the caller can still navigate the tab somewhere sensible
    // rather than dropping the user on a blank install page.
    try {
      await chrome.storage.local.set({
        pendingInstall: { url, code, timestamp: Date.now() }
      });
    } catch (storageErr) {
      console.error('[ScriptVault] Failed to persist pendingInstall:', storageErr);
      throw storageErr;
    }
    return { action: 'install' };
  } catch (error) {
    console.error('[ScriptVault] Failed to fetch script:', error);
    // Best-effort: try to record the error for install.html. If that also
    // fails (quota exhausted, disk full), there's nothing more we can do
    // from the SW — at least we logged the original fetch failure above.
    try {
      await chrome.storage.local.set({
        pendingInstall: { url, error: error?.message || String(error), timestamp: Date.now() }
      });
    } catch (_e) { /* see above */ }
    return { action: 'install' };
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId !== 0) return;

  const url = details.url;

  // Check if this is a .user.js URL
  if (!url.match(/\.user\.js(\?.*)?$/i)) return;

  // Don't intercept extension pages
  if (url.startsWith('chrome-extension://')) return;

  debugLog('Intercepting userscript URL:', url);

  let pending = _pendingFetches.get(url);
  if (!pending) {
    pending = _fetchPendingUserscript(url).finally(() => {
      _pendingFetches.delete(url);
    });
    _pendingFetches.set(url, pending);
  }

  try {
    const result = await pending;
    if (result.action === 'install') {
      // The tab may have been closed between the fetch start and resolution;
      // chrome.tabs.update on a vanished tab rejects with an unhandled error
      // that bubbles out of this async listener. Swallow that specific case
      // (the user closed the tab — there's nothing to redirect).
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('pages/install.html')
      }).catch((updateErr) => {
        debugLog('[ScriptVault] tab.update post-fetch failed (tab likely closed):', updateErr?.message || updateErr);
      });
    } else {
      // Not a userscript — let this tab's navigation continue and clear any
      // stale pendingInstall written by an earlier interception of the same URL.
      await chrome.storage.local.remove('pendingInstall').catch(() => {});
    }
  } catch (e) {
    // _fetchPendingUserscript catches its own errors; any throw here means the
    // tab update or storage cleanup failed. Surface so it appears in logs.
    console.error('[ScriptVault] webNav handler error:', e);
  }
}, {
  url: [
    { urlMatches: '.*\\.user\\.js(\\?.*)?$' }
  ]
});

// Handle direct script installation from raw source code (file picker, drag/drop)
async function installFromCode(code, receiptOptions = {}) {
  try {
    if (typeof code !== 'string' || !code) {
      throw new Error('No script content provided');
    }

    if (code.length > MAX_SCRIPT_SIZE) {
      throw new Error(`Script too large (${formatBytes(code.length)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`);
    }

    if (!code.includes('==UserScript==')) {
      throw new Error('Not a valid userscript');
    }

    let parsed = parseUserscript(code);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    let meta = parsed.meta;
    const installSettings = await SettingsManager.get();
    const bundleResult = await ESMUserscriptBundler.bundleIfNeeded(code, meta, installSettings, {
      sourceUrl: receiptOptions.sourceUrl || meta.downloadURL || meta.updateURL || ''
    });
    if (bundleResult.bundled) {
      code = bundleResult.code;
      parsed = parseUserscript(code);
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      meta = parsed.meta;
      meta.esmBundle = {
        entryUrl: bundleResult.entryUrl,
        imports: bundleResult.imports,
        bundledAt: Date.now()
      };
    }
    const allScripts = await ScriptStorage.getAll();

    const existing = allScripts.find(s => s.meta.name === meta.name && s.meta.namespace === meta.namespace);
    const id = existing ? existing.id : generateId();
    const previousScript = existing && existing.code !== code
      ? {
          ...existing,
          meta: { ...existing.meta },
          code: existing.code,
          updatedAt: existing.updatedAt || Date.now()
        }
      : null;
    const versionHistory = Array.isArray(existing?.versionHistory) ? [...existing.versionHistory] : [];
    let historyEntry = null;
    let rollbackIndex = -1;
    if (previousScript) {
      historyEntry = {
        version: existing.meta.version,
        code: existing.code,
        updatedAt: existing.updatedAt || Date.now()
      };
      versionHistory.push(historyEntry);
      if (versionHistory.length > 5) {
        versionHistory.splice(0, versionHistory.length - 5);
      }
      rollbackIndex = versionHistory.indexOf(historyEntry);
    }
    const trustReceipt = await createScriptTrustReceipt({
      operation: receiptOptions.operation || (existing ? 'update' : 'install'),
      code,
      meta,
      sourceUrl: receiptOptions.sourceUrl || '',
      previousScript,
      rollbackIndex,
      fetchDependencyBody: fetchRequireScript,
      fetchProvenanceBundle
    });
    const provenanceFailure = _getRequireProvenanceFailure(trustReceipt);
    if (provenanceFailure) {
      throw new Error(provenanceFailure.message);
    }
    if (historyEntry && previousScript) {
      historyEntry.trustReceipt = previousScript.trustReceipt || await createScriptTrustReceipt({
        operation: 'rollback-point',
        code: previousScript.code,
        meta: previousScript.meta,
        sourceUrl: previousScript.trustReceipt?.source?.installUrl || previousScript.meta.downloadURL || previousScript.meta.updateURL
      });
    }

    // Classify the install source (Greasy Fork / OpenUserJS / GitHub / ...)
    // so the dashboard can render a durable trust badge and so a future
    // update from a different registry surfaces as a "source changed" flag.
    const effectiveSourceUrl = receiptOptions.sourceUrl || meta.downloadURL || meta.updateURL || '';
    const installSource = classifyInstallSource(effectiveSourceUrl);
    let sourceIdentityChanged = false;
    if (existing && existing.installSource && existing.installSource.id && installSource.id !== 'local'
        && existing.installSource.id !== installSource.id) {
      sourceIdentityChanged = true;
    }

    const script = {
      ...existing,
      id,
      code,
      meta,
      enabled: existing ? existing.enabled : true,
      position: existing ? existing.position : allScripts.length,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      trustReceipt,
      installSource: installSource.id === 'local' && existing?.installSource
        ? existing.installSource
        : installSource
    };
    if (sourceIdentityChanged) {
      script.settings = { ...(script.settings || existing?.settings || {}), sourceIdentityChanged: true };
      script.previousInstallSource = existing.installSource;
    }
    if (versionHistory.length > 0) script.versionHistory = versionHistory;

    await ensurePersistentStorageForScriptWrite(existing ? 'script-reinstall' : 'script-install', script.code);
    await ScriptStorage.set(id, script);
    await registerAllScripts(true);
    await updateBadge();
    await autoReloadMatchingTabs(script);

    return { success: true, script };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle direct script installation from URL
async function installFromUrl(url) {
  try {
    // Reject non-http(s) schemes (file://, data:, blob:, chrome-extension://,
    // javascript:). The dashboard/popup are the only legitimate callers, but
    // defense-in-depth keeps a malformed install request from triggering a
    // fetch on an unexpected scheme.
    if (typeof url !== 'string' || !url) {
      throw new Error('No URL provided');
    }
    InternalHostGuard.assertExternalFetchUrl(url, 'Script source', ['http:', 'https:']);
    // Timeout after 30 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let code;
    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
      if (!postCheck.ok) {
        throw new Error('Script source redirected to ' + postCheck.message);
      }

      // Stream-bounded read (same protection as the webNavigation handler);
      // see _fetchTextBounded for rationale.
      code = await _fetchTextBounded(response, MAX_SCRIPT_SIZE, 'Script');
    } finally {
      clearTimeout(timeoutId);
    }

    return await installFromCode(code, { sourceUrl: url, operation: 'install' });
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  await SettingsManager.init();

  // Rehydrate ephemeral runtime maps (notification callbacks, opened-tab
  // trackers, audio-watched tabs) from chrome.storage.session so callbacks
  // registered before the SW was killed still fire after wake.
  await SessionState.hydrate();

  // v2.0: Run migration BEFORE ScriptStorage.init() so that any migration-driven
  // rewrites of `userscripts` storage are visible to the in-memory cache. Running
  // it after ScriptStorage.init() left the cache pinned to pre-migration data,
  // causing every subsequent cached read (dashboard, registration, badge) to see
  // the old shape until the next SW cold start.
  if (typeof Migration !== 'undefined') {
    try { await Migration.run(); } catch (e) { console.error('[ScriptVault] Migration error:', e); }
  }

  await ScriptStorage.init();

  // Apply language setting to I18n
  const settings = await SettingsManager.get();
  if (settings.language && settings.language !== 'default' && settings.language !== 'auto') {
    I18n.setLocale(settings.language);
  }

  // Configure userScripts world
  await configureUserScriptsWorld();

  // Setup context menus
  await setupContextMenus();

  // Register all enabled scripts — force re-registration on extension install/update
  // (new GM_* wrappers / match patterns require rewriting all registered scripts).
  // On plain SW wake within the same extension version, skip the destructive cycle.
  let needsForceReregister = false;
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    const stored = await chrome.storage.local.get('_lastRegisteredVersion');
    if (stored._lastRegisteredVersion !== currentVersion) {
      needsForceReregister = true;
      await chrome.storage.local.set({ _lastRegisteredVersion: currentVersion });
    }
  } catch (e) {
    // Unable to read version — force re-register to be safe on update
    needsForceReregister = true;
  }
  await registerAllScripts(needsForceReregister);

  await updateBadge();
  await setupAlarms();

  // Clean up stale persistent caches (require_cache_, res_cache_)
  cleanupStaleCaches();

  // v2.0: Auto-cleanup storage if above threshold
  if (typeof QuotaManager !== 'undefined') {
    try { await QuotaManager.autoCleanup(); } catch (e) { console.error('[ScriptVault] Quota cleanup error:', e); }
  }

  // v2.0: Register global error handlers for ErrorLog
  if (typeof ErrorLog !== 'undefined' && typeof ErrorLog.registerGlobalHandlers === 'function') {
    ErrorLog.registerGlobalHandlers();
  }

  // v2.0 module initializers: these register alarm/message listeners and
  // load per-module state. Previously they were only called from
  // chrome.runtime.onInstalled, which only fires at install/update — after
  // the first SW shutdown (~30s idle) the listeners were gone and modules
  // were dormant until the next extension update. Each module is
  // `_initialized`-guarded so calling them every wake is cheap and safe.
  if (typeof BackupScheduler !== 'undefined') {
    try { await BackupScheduler.init(); } catch (e) { console.error('[ScriptVault] BackupScheduler init error:', e); }
  }
  if (typeof NotificationSystem !== 'undefined' && typeof NotificationSystem.init === 'function') {
    try { await NotificationSystem.init(); } catch (e) { console.error('[ScriptVault] NotificationSystem init error:', e); }
  }
  if (typeof PublicAPI !== 'undefined') {
    try { await PublicAPI.init(); } catch (e) { console.error('[ScriptVault] PublicAPI init error:', e); }
  }
  if (typeof EasyCloudSync !== 'undefined') {
    try { await EasyCloudSync.init(); } catch (e) { console.error('[ScriptVault] EasyCloudSync init error:', e); }
  }

  // Phase 39.8 — OS-policy script provisioning. Read chrome.storage.managed
  // for an array of admin-pushed userscripts; install/update each. The
  // managed-storage change listener (wired below) re-runs this on policy
  // updates so admins can roll out new scripts without re-shipping the
  // extension.
  applyManagedScripts().catch(e => {
    console.warn('[ScriptVault] Managed-script provisioning failed:', e?.message || e);
  });

  // Phase 40.10 — Reconcile DNR rule map against live DNR + ScriptStorage now
  // that both are hydrated. Catches orphan rules left behind when the SW was
  // killed mid-delete or mid-update. Fire-and-forget so a slow DNR query
  // doesn't block the rest of the wake path.
  reconcileWebRequestRuleMap().catch(e => {
    console.warn('[ScriptVault] DNR reconcile failed on init:', e?.message || e);
  });

  console.log('[ScriptVault] Service worker ready');
}

// Phase 39.8 — OS-policy script provisioning (TM 5.5.0 parity).
//
// Admins push userscripts via the standard Chrome enterprise policy mechanism
// (`ExtensionSettings` JSON → `chrome.storage.managed`). The expected shape is:
//
//   chrome.storage.managed.managedScripts = [
//     { url: "https://internal.corp/foo.user.js" },   // fetched + installed
//     { code: "// ==UserScript== ... " }              // installed inline
//   ]
//
// Each managed script is flagged `script.settings.managed = true`. A future
// dashboard pass surfaces this with a "Managed by your organization" pill
// (deferred — UI scope, dashboard.js). Managed scripts are NOT auto-deleted
// from local storage when removed from policy; admins can clear via an explicit
// `chrome.storage.managed.managedScriptsCleanup = true` toggle if needed.
async function applyManagedScripts() {
  if (!chrome.storage?.managed) return; // Not all browsers expose .managed
  let policy;
  try {
    policy = await chrome.storage.managed.get(['managedScripts', 'managedScriptsCleanup']);
  } catch (e) {
    // No managed policy attached or restricted-by-policy — silently skip.
    return;
  }
  const items = Array.isArray(policy?.managedScripts) ? policy.managedScripts : [];
  if (items.length === 0 && !policy?.managedScriptsCleanup) return;

  const allScripts = await ScriptStorage.getAll();
  const installedByOrigin = new Map();
  for (const s of allScripts) {
    if (s?.settings?.managed && s?.settings?.managedOriginKey) {
      installedByOrigin.set(s.settings.managedOriginKey, s);
    }
  }
  const policyOriginKeys = new Set();

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const originKey = typeof item.url === 'string' ? `url:${item.url}` :
                      typeof item.code === 'string' ? `code:${item.code.slice(0, 64)}` : null;
    if (!originKey) continue;
    policyOriginKeys.add(originKey);

    let code;
    if (typeof item.url === 'string') {
      try {
        const res = await installFromUrl(item.url);
        if (res?.error) {
          console.warn('[ScriptVault] Managed script install (URL) failed:', item.url, res.error);
          continue;
        }
      } catch (e) {
        console.warn('[ScriptVault] Managed script fetch failed:', item.url, e?.message || e);
        continue;
      }
    } else if (typeof item.code === 'string' && item.code) {
      code = item.code;
      try {
        const res = await installFromCode(code);
        if (res?.error) {
          console.warn('[ScriptVault] Managed script install (inline) failed:', res.error);
          continue;
        }
      } catch (e) {
        console.warn('[ScriptVault] Managed inline install failed:', e?.message || e);
        continue;
      }
    } else {
      continue;
    }

    // Tag the installed script as managed. installFromUrl/installFromCode
    // dedup by name+namespace so we have to look it up post-install.
    try {
      const fresh = await ScriptStorage.getAll();
      const lastInstalled = fresh.find(s =>
        !s?.settings?.managed && s.updatedAt && Date.now() - s.updatedAt < 30000
      );
      if (lastInstalled) {
        await ScriptStorage.set(lastInstalled.id, {
          ...lastInstalled,
          settings: {
            ...(lastInstalled.settings || {}),
            managed: true,
            managedOriginKey: originKey,
            managedAppliedAt: Date.now()
          }
        });
      }
    } catch (e) {
      console.warn('[ScriptVault] Managed-flag tagging failed:', e?.message || e);
    }
  }

  // Optional cleanup: remove managed scripts whose origin key is no longer in
  // the policy AND the admin opted into pruning. Without the explicit
  // `managedScriptsCleanup: true` flag, we leave orphans alone — better to keep
  // a script than silently delete one a sysadmin still wants users to have.
  if (policy?.managedScriptsCleanup === true) {
    for (const [originKey, script] of installedByOrigin.entries()) {
      if (!policyOriginKeys.has(originKey)) {
        try {
          await ScriptStorage.delete(script.id);
          debugLog(`[ManagedScripts] Pruned ${script.meta?.name} (no longer in policy)`);
        } catch (e) {
          console.warn('[ScriptVault] Managed prune failed:', script.id, e?.message || e);
        }
      }
    }
  }
}

// Re-run provisioning whenever the managed-storage area changes.
if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'managed') return;
    if (!('managedScripts' in changes) && !('managedScriptsCleanup' in changes)) return;
    applyManagedScripts().catch(e => {
      console.warn('[ScriptVault] Managed-storage onChanged handler failed:', e?.message || e);
    });
  });
}

// Remove expired persistent cache entries and stale trash items to prevent storage bloat.
//
// Phase 39.25 — VM #2453 @require cache invalidation on dependency update.
// In addition to age-based TTL eviction, drop require_cache_* entries whose
// URL hash is no longer referenced by any installed script. A script that
// bumps its @require from `lib@1.0.0` to `lib@1.1.0` previously kept the old
// entry until the 7-day TTL fired; now the orphan is evicted on the next
// cleanup tick.
async function cleanupStaleCaches() {
  try {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const maxRequireAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const maxResourceAge = ResourceCache.maxAge; // 24 hours
    const keysToRemove = [];

    // Phase 39.25 — compute the live set of `require_cache_<sha256(url)>` keys
    // from every script's @require list. Anything in storage outside this set
    // is an orphan (no script references it).
    let liveRequireKeys = null;
    try {
      const scripts = await ScriptStorage.getAll();
      const urls = new Set();
      for (const s of scripts || []) {
        const reqs = Array.isArray(s?.meta?.require) ? s.meta.require : [];
        for (const u of reqs) if (typeof u === 'string' && u) urls.add(u);
      }
      // The cache key is sha256(full URL including any #sri fragment) — match
      // the same hashing the fetcher uses (line 5765 region).
      liveRequireKeys = new Set();
      for (const u of urls) {
        const buf = new TextEncoder().encode(u);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        liveRequireKeys.add(`require_cache_${hex}`);
      }
    } catch (e) {
      // If we can't enumerate live keys, fall back to age-only eviction
      // (better than nothing). Logging only — non-critical.
      debugLog('[Cache cleanup] live-key enumeration failed, falling back to age-only:', e?.message || e);
      liveRequireKeys = null;
    }

    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('require_cache_') && value?.timestamp) {
        const expired = now - value.timestamp > maxRequireAge;
        const orphaned = liveRequireKeys !== null && !liveRequireKeys.has(key);
        if (expired || orphaned) keysToRemove.push(key);
      } else if (key.startsWith('res_cache_') && value?.timestamp) {
        if (now - value.timestamp > maxResourceAge) keysToRemove.push(key);
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      debugLog(`Cleaned up ${keysToRemove.length} stale cache entries`);
    }
  } catch (e) {
    // Non-critical, ignore errors
  }

  // Prune sync tombstones older than 30 days (they're only needed during the sync window)
  try {
    const tombstoneData = await chrome.storage.local.get('syncTombstones');
    const tombstones = tombstoneData.syncTombstones || {};
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const pruned = Object.fromEntries(Object.entries(tombstones).filter(([, ts]) => ts > cutoff));
    if (Object.keys(pruned).length !== Object.keys(tombstones).length) {
      await chrome.storage.local.set({ syncTombstones: pruned });
    }
  } catch (e) { /* non-critical */ }

  // Prune expired trash entries based on trashMode retention setting
  try {
    const settings = await SettingsManager.get();
    const trashMode = settings.trashMode || '30';
    if (trashMode === 'disabled') return;
    const maxAge = trashMode === '1' ? 86400000 : trashMode === '7' ? 604800000 : 2592000000; // 1/7/30 days
    const trashData = await chrome.storage.local.get('trash');
    const trash = trashData.trash || [];
    const now = Date.now();
    const valid = trash.filter(s => now - s.trashedAt < maxAge);
    if (valid.length !== trash.length) {
      await chrome.storage.local.set({ trash: valid });
      debugLog(`Pruned ${trash.length - valid.length} expired trash entries`);
    }
  } catch (e) {
    // Non-critical, ignore errors
  }
}

// Detect Chrome major version from user agent (available in service worker via self.navigator)
function _getChromeVersion() {
  try {
    const m = (self.navigator?.userAgent || '').match(/(?:Chrome|Chromium)\/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  } catch (e) {
    return 0;
  }
}

function _isFirefoxRuntime() {
  try {
    return /Firefox\//.test(self.navigator?.userAgent || '') ||
      (typeof browser !== 'undefined' && !!browser.runtime?.id);
  } catch (e) {
    return false;
  }
}

function _supportsUserScriptsWorldId() {
  return !_isFirefoxRuntime() && _getChromeVersion() >= 133;
}

function getExtensionDetailsUrl() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      return `chrome://extensions/?id=${chrome.runtime.id}`;
    }
  } catch (e) {
    // Fall through to the generic extensions page.
  }
  return 'chrome://extensions';
}

function buildUserScriptsStatus({ userScriptsAvailable, chromeVersion = _getChromeVersion(), probeError = '' }) {
  let setupState = 'available';
  let setupTitle = '';
  let setupMessage = '';
  let setupAction = '';
  let setupUrl = '';

  if (!userScriptsAvailable) {
    if (chromeVersion >= 138) {
      setupState = 'allow-user-scripts-disabled';
      setupTitle = 'Allow User Scripts is off';
      setupMessage = 'Open Extension Details, enable "Allow User Scripts" for ScriptVault, then refresh status; reload the extension if this banner remains.';
      setupAction = 'Open Extension Details';
      setupUrl = getExtensionDetailsUrl();
    } else if (chromeVersion >= 120) {
      setupState = 'developer-mode-disabled';
      setupTitle = 'Developer Mode required';
      setupMessage = 'Open chrome://extensions and enable Developer Mode to run userscripts.';
      setupAction = 'Open Extensions Page';
      setupUrl = 'chrome://extensions';
    } else {
      setupState = 'unsupported-browser';
      setupTitle = 'Unsupported browser';
      setupMessage = 'ScriptVault userscripts require Chrome 120 or newer.';
      setupAction = 'Open Extensions Page';
      setupUrl = 'chrome://extensions';
    }
  }

  const status = {
    userScriptsAvailable,
    setupRequired: !userScriptsAvailable,
    setupMessage,
    chromeVersion,
    setupState,
    setupTitle,
    setupAction,
    setupUrl
  };
  if (probeError) {
    status.apiProbeError = String(probeError);
  }
  return status;
}

async function persistUserScriptsStatus(status) {
  try {
    await SettingsManager.set({
      _userScriptsAvailable: status.userScriptsAvailable,
      _chromeVersion: status.chromeVersion
    });
  } catch (e) {
    console.warn('[ScriptVault] Failed to persist userScripts status:', e);
  }
}

async function probeUserScriptsAvailability() {
  const chromeVersion = _getChromeVersion();
  let userScriptsAvailable = false;
  let probeError = '';

  try {
    if (!chrome.userScripts || typeof chrome.userScripts.getScripts !== 'function') {
      probeError = 'chrome.userScripts is unavailable';
    } else {
      await chrome.userScripts.getScripts();
      userScriptsAvailable = true;
    }
  } catch (e) {
    probeError = e?.message || String(e || 'chrome.userScripts probe failed');
  }

  const status = buildUserScriptsStatus({ userScriptsAvailable, chromeVersion, probeError });
  await persistUserScriptsStatus(status);
  return status;
}

function logUserScriptsSetupWarning(status) {
  const message = status?.setupMessage || 'userScripts API not available';
  console.warn(`[ScriptVault] ${message}`);
}

// Configure the userScripts execution world
async function configureUserScriptsWorld(status = null) {
  const availability = status || await probeUserScriptsAvailability();
  if (!availability.userScriptsAvailable) {
    logUserScriptsSetupWarning(availability);
    return availability;
  }

  try {
    // Configure the default USER_SCRIPT world
    await chrome.userScripts.configureWorld({
      csp: "script-src 'self' 'unsafe-inline' 'unsafe-eval' *",
      messaging: true
    });

    debugLog('userScripts world configured (Chrome', availability.chromeVersion, ')');
    return availability;
  } catch (e) {
    console.error('[ScriptVault] Failed to configure userScripts world:', e);
    const failedStatus = buildUserScriptsStatus({
      userScriptsAvailable: false,
      chromeVersion: availability.chromeVersion,
      probeError: e?.message || String(e || 'chrome.userScripts.configureWorld failed')
    });
    await persistUserScriptsStatus(failedStatus);
    return failedStatus;
  }
}

// Register all enabled scripts with the userScripts API
async function registerAllScripts(forceReregister = false) {
  try {
    const availability = await probeUserScriptsAvailability();
    if (!availability.userScriptsAvailable) {
      logUserScriptsSetupWarning(availability);
      return;
    }

    // On normal SW wake, check if scripts are already registered to avoid
    // the destructive unregister→register cycle that creates a gap where
    // scripts aren't active on page navigations.
    //
    // Round 11: Compute a diff between enabled-in-storage and currently-registered.
    // If a previous `Promise.allSettled` registration partially failed, the registered
    // set may be missing some scripts indefinitely — register just the missing subset
    // rather than short-circuiting the whole call.
    if (!forceReregister) {
      try {
        const existing = await chrome.userScripts.getScripts();
        if (existing && existing.length > 0) {
          const settings = await SettingsManager.get();
          if (!settings.enabled) {
            debugLog(`Skipping re-registration: scripts globally disabled`);
            return;
          }
          const scripts = await ScriptStorage.getAll();
          const enabledScripts = scripts.filter(s => s.enabled !== false);
          const registeredIds = new Set(existing.map(s => s.id));
          const enabledIds = new Set(enabledScripts.map(s => s.id));
          const missing = enabledScripts.filter(s => !registeredIds.has(s.id));
          // Stale = registered but no longer in storage OR now disabled.
          // Unregister so wake doesn't leave dead injections active until the
          // next forceReregister cycle.
          const stale = existing
            .map(s => s.id)
            .filter(id => !enabledIds.has(id));

          if (missing.length === 0 && stale.length === 0) {
            debugLog(`Skipping re-registration: ${existing.length} scripts already registered, no diff`);
            return;
          }

          if (stale.length > 0) {
            debugLog(`Unregistering ${stale.length} stale script(s) on wake`);
            try {
              await chrome.userScripts.unregister({ ids: stale });
            } catch (e) {
              console.warn('[ScriptVault] Failed to unregister stale scripts:', e?.message || e);
            }
          }

          if (missing.length === 0) return;

          // Preload @require deps for the missing subset in parallel
          const missingRequires = new Set();
          for (const script of missing) {
            for (const req of (script.meta?.require || [])) {
              missingRequires.add(req);
            }
          }
          if (missingRequires.size > 0) {
            debugLog(`Preloading ${missingRequires.size} @require deps for ${missing.length} missing scripts`);
            // Phase 39.22 — bound each fetch so a CSP-strict / slow server can't
            // deadlock the whole wake path.
            await Promise.allSettled([...missingRequires].map(url => _withTimeout(fetchRequireScript(url), 15000, `fetchRequire:${url}`)));
          }

          debugLog(`Registering ${missing.length} missing script(s) (diff from ${existing.length} already registered)`);
          // Phase 39.22 — per-script registration timeout (VM #2513). Without
          // this, one chrome.userScripts.register() hang blocks the rest.
          const diffResults = await Promise.allSettled(missing.map(script => _withTimeout(registerScript(script), 5000, `registerScript:${script.id}`)));
          const diffFailures = diffResults.filter(r => r.status === 'rejected');
          if (diffFailures.length > 0) {
            console.warn(`[ScriptVault] ${diffFailures.length} missing script(s) failed to register:`, diffFailures.map(r => r.reason?.message || r.reason));
          }
          return;
        }
      } catch (e) {
        // getScripts not available or failed — fall through to full registration
      }
    }

    // Full re-registration: unregister all, then register fresh
    await chrome.userScripts.unregister().catch(() => {});
    
    const scripts = await ScriptStorage.getAll();
    const settings = await SettingsManager.get();
    
    if (!settings.enabled) {
      debugLog('Scripts globally disabled');
      return;
    }
    
    const enabledScripts = scripts.filter(s => s.enabled !== false);

    // Sort by combined @priority + @weight (higher = first), then position.
    // @priority is the legacy ScriptVault directive; @weight is the Userscripts
    // (Safari) standard (1..999). Either bumps a script earlier within the same
    // @run-at — we take the max so authors who set both don't get surprised by
    // the lower one winning.
    enabledScripts.sort((a, b) => {
      const pa = Math.max(a.meta?.priority || 0, a.meta?.weight || 0);
      const pb = Math.max(b.meta?.priority || 0, b.meta?.weight || 0);
      if (pb !== pa) return pb - pa;
      return (a.position || 0) - (b.position || 0);
    });

    debugLog(`Registering ${enabledScripts.length} scripts`);

    // v2.0: Preload all @require dependencies in parallel before registration
    // This prevents N sequential fetches during registration
    const allRequires = new Set();
    for (const script of enabledScripts) {
      for (const req of (script.meta?.require || [])) {
        allRequires.add(req);
      }
    }
    if (allRequires.size > 0) {
      debugLog(`Preloading ${allRequires.size} @require dependencies`);
      const preloadStart = Date.now();
      // Phase 39.22 — see diff-path comment above.
      await Promise.allSettled([...allRequires].map(url => _withTimeout(fetchRequireScript(url), 15000, `fetchRequire:${url}`)));
      debugLog(`Preloaded in ${Date.now() - preloadStart}ms`);
    }

    // Register all scripts in parallel — significantly faster on large script collections
    // Phase 39.22 — per-script timeout (VM #2513).
    const results = await Promise.allSettled(enabledScripts.map(script => _withTimeout(registerScript(script), 5000, `registerScript:${script.id}`)));
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[ScriptVault] ${failures.length} script(s) failed to register:`, failures.map(r => r.reason?.message || r.reason));
    }
  } catch (e) {
    console.error('[ScriptVault] Failed to register scripts:', e);
  }
}

/**
 * Feature-detect chrome.userScripts.update (Chrome 138+). When present, the
 * runtime can replace a single script's registration in place instead of
 * round-tripping through unregister + register, which avoids the brief
 * unregistered window where a tab navigation could miss the script.
 */
function _supportsUserScriptsUpdate() {
  return typeof chrome?.userScripts?.update === 'function';
}

/**
 * Replace a script's registration without an unregister/register flicker.
 *
 * Behavior matrix:
 *   - script.enabled === false   → unregister and return; nothing to update.
 *   - chrome.userScripts.update supported (Chrome 138+) → re-run registerScript
 *     with useUpdate so the same registration payload is swapped via update().
 *     Falls back to the full cycle on any update failure.
 *   - Older Chrome → existing unregister + register cycle.
 *
 * Callers that previously wrote `await unregisterScript(id); if
 * (script.enabled !== false) await registerScript(script);` can replace the
 * pair with `await reregisterScript(script)`.
 */
async function reregisterScript(script) {
  if (!chrome.userScripts || !script) return;
  if (script.enabled === false) {
    await unregisterScript(script.id);
    return;
  }
  if (_supportsUserScriptsUpdate()) {
    try {
      // Drop any prior @webRequest DNR rules before the update; the update
      // path doesn't call unregisterScript so the rule reconciliation has
      // to happen here. applyWebRequestRules() inside registerScript will
      // re-establish the rules for the new metadata.
      await removeWebRequestRules(script.id).catch(() => {});
      await registerScript(script, { useUpdate: true });
      return;
    } catch (e) {
      // Fall through to the full cycle. The unregister below is a safety
      // net — update failures usually leave the prior registration intact,
      // but unregistering guarantees a clean slate before re-registering.
    }
  }
  await unregisterScript(script.id);
  await registerScript(script);
}

// Register a single script
async function registerScript(script, { useUpdate = false } = {}) {
  try {
    const meta = script.meta;
    const settings = script.settings || {};

    // @crontab scripts execute on a schedule rather than on page load.
    // Register a chrome alarm instead of a chrome.userScripts entry.
    if (meta.crontab) {
      const alarmName = 'crontab_' + script.id;
      await chrome.alarms.clear(alarmName).catch(() => {});
      // Metadata may have just gained @crontab on an in-place update (the
      // Chrome 138+ update path never calls unregisterScript). Drop any prior
      // page-load registration so the script doesn't run BOTH on load and on
      // schedule.
      if (chrome.userScripts) {
        try { await chrome.userScripts.unregister({ ids: [script.id] }); } catch (_) {}
      }
      const minutes = Math.max(1, parseCronToMinutes(meta.crontab));
      chrome.alarms.create(alarmName, { periodInMinutes: minutes });
      debugLog(`Registered @crontab: ${meta.name} (every ${minutes} min)`);
      return;
    }

    if (!chrome.userScripts) return;
    // Not a @crontab script — clear any stale crontab alarm left over from a
    // prior version of this script's metadata (e.g. @crontab was just removed
    // on an in-place update) so it stops firing on schedule.
    await chrome.alarms.clear('crontab_' + script.id).catch(() => {});
    
    // Build match patterns with URL override support
    const matches = [];
    const excludeMatches = [];
    
    // Process @match (if enabled in settings)
    if (settings.useOriginalMatches !== false && meta.match && Array.isArray(meta.match)) {
      for (const m of meta.match) {
        if (isValidMatchPattern(m)) {
          matches.push(m);
        }
      }
    }
    
    // Process user @match patterns
    if (settings.userMatches && Array.isArray(settings.userMatches)) {
      for (const m of settings.userMatches) {
        if (isValidMatchPattern(m)) {
          matches.push(m);
        } else {
          // Try to convert glob-style to match pattern
          const converted = convertIncludeToMatch(m);
          if (converted && isValidMatchPattern(converted)) {
            matches.push(converted);
          }
        }
      }
    }
    
    // Collect regex @include/@exclude patterns for runtime filtering
    const regexIncludes = [];
    const regexExcludes = [];

    // Process @include (if enabled in settings)
    if (settings.useOriginalIncludes !== false && meta.include && Array.isArray(meta.include)) {
      for (const inc of meta.include) {
        if (isRegexPattern(inc)) {
          // Regex pattern - extract broad match patterns for registration, filter at runtime
          regexIncludes.push(inc);
          const broad = extractMatchPatternsFromRegex(inc);
          if (broad.length > 0) {
            matches.push(...broad);
          }
        } else {
          const converted = convertIncludeToMatch(inc);
          if (converted && isValidMatchPattern(converted)) {
            matches.push(converted);
          } else if (inc === '*') {
            matches.push('<all_urls>');
          }
        }
      }
    }
    
    // Process user @include patterns
    if (settings.userIncludes && Array.isArray(settings.userIncludes)) {
      for (const inc of settings.userIncludes) {
        const converted = convertIncludeToMatch(inc);
        if (converted && isValidMatchPattern(converted)) {
          matches.push(converted);
        } else if (inc === '*') {
          matches.push('<all_urls>');
        }
      }
    }
    
    // Process @exclude-match (stored as excludeMatch by parser)
    if (meta.excludeMatch && Array.isArray(meta.excludeMatch)) {
      for (const m of meta.excludeMatch) {
        if (isValidMatchPattern(m)) {
          excludeMatches.push(m);
        }
      }
    }
    
    // Process @exclude (if enabled) - convert to exclude matches where possible
    if (settings.useOriginalExcludes !== false && meta.exclude && Array.isArray(meta.exclude)) {
      for (const exc of meta.exclude) {
        if (isRegexPattern(exc)) {
          regexExcludes.push(exc);
          continue;
        }
        const converted = convertIncludeToMatch(exc);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }
    
    // Process user @exclude patterns
    if (settings.userExcludes && Array.isArray(settings.userExcludes)) {
      for (const exc of settings.userExcludes) {
        const converted = convertIncludeToMatch(exc);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }
    
    // Add denied hosts as exclude patterns
    const globalSettings = await SettingsManager.get();
    const deniedHosts = globalSettings.deniedHosts;
    if (deniedHosts && Array.isArray(deniedHosts)) {
      for (const host of deniedHosts) {
        if (host) excludeMatches.push(`*://${host}/*`, `*://*.${host}/*`);
      }
    }
    // Add blacklisted pages as exclude patterns
    if (globalSettings.pageFilterMode === 'blacklist' && globalSettings.blacklistedPages) {
      const blacklist = globalSettings.blacklistedPages.split('\n').map(s => s.trim()).filter(Boolean);
      for (const p of blacklist) {
        const converted = convertIncludeToMatch(p);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }

    // If no matches, use <all_urls> (some scripts use @include *)
    if (matches.length === 0) {
      matches.push('<all_urls>');
    }
    
    // Map run-at values (with per-script setting override)
    const runAtMap = {
      'document-start': 'document_start',
      'document-end': 'document_end',
      'document-idle': 'document_idle',
      'document-body': 'document_end',
      'context-menu': 'document_idle' // context-menu scripts register idle, triggered via context menu
    };

    // @run-in: filter by tab type (normal-tabs, incognito-tabs)
    const runIn = meta['run-in'] || '';
    if (runIn === 'incognito-tabs') {
      // Only run in incognito — skip registration for normal context
      // (chrome.userScripts doesn't support incognito filtering natively,
      // so we inject a runtime guard into the wrapper)
    } else if (runIn === 'normal-tabs') {
      // Only run in normal tabs — runtime guard injected
    }

    // Check for per-script runAt override
    let effectiveRunAt = meta['run-at'];
    if (settings.runAt && settings.runAt !== 'default') {
      effectiveRunAt = settings.runAt;
    }
    const isContextMenu = effectiveRunAt === 'context-menu';
    if (isContextMenu) {
      // Context-menu scripts are not auto-registered; they run on-demand via context menu click
      debugLog(`Skipping auto-register for context-menu script: ${meta.name}`);
      return;
    }
    const runAt = runAtMap[effectiveRunAt] || 'document_idle';

    // Determine execution world based on @inject-into and @sandbox
    // chrome.userScripts API only supports 'USER_SCRIPT' world, not 'MAIN'
    // For @inject-into page / @sandbox raw, we still register in USER_SCRIPT world
    // but pass a flag so the wrapper injects the user's code into the page context via <script>
    const world = 'USER_SCRIPT';
    const injectInto = meta['inject-into'] || 'auto';
    const sandbox = meta.sandbox || '';
    const injectIntoPage = (injectInto === 'page' || sandbox === 'raw');
    
    // Fetch @require dependencies
    const requireScripts = [];
    const requires = Array.isArray(meta.require) ? meta.require : (meta.require ? [meta.require] : []);
    
    const failedRequires = [];
    for (const url of requires) {
      try {
        const code = await fetchRequireScript(url);
        if (code) {
          requireScripts.push({ url, code });
        } else {
          failedRequires.push(url);
        }
      } catch (e) {
        console.warn(`[ScriptVault] Failed to fetch @require ${url}:`, e.message);
        failedRequires.push(url);
      }
    }

    // Track failed @require dependencies on the script for UI notification
    if (failedRequires.length > 0) {
      script.settings = script.settings || {};
      script.settings._failedRequires = failedRequires;
      await ScriptStorage.set(script.id, script);
      debugWarn(`${meta.name}: ${failedRequires.length} @require dependency(s) failed to load`);
    } else if (script.settings?._failedRequires) {
      // Clear previous failures
      delete script.settings._failedRequires;
      await ScriptStorage.set(script.id, script);
    }
    
    // Pre-fetch @resource dependencies
    await ResourceCache.prefetchResources(meta.resource);

    // Pre-fetch storage values for this script
    const storedValues = await ScriptValues.getAll(script.id) || {};
    
    // Build the script code with GM API wrapper, @require scripts, and pre-loaded storage
    if (injectIntoPage) {
      debugLog(`Note: @inject-into page / @sandbox raw not fully supported in MV3, running in USER_SCRIPT world: ${meta.name}`);
    }
    const wrappedCode = buildWrappedScript(script, requireScripts, storedValues, regexIncludes, regexExcludes);
    
    // Per-script frame-mode override (settings.frameMode): 'top' forces top
    // frame only, 'all' forces all frames, and any other value (including
    // 'default'/undefined) falls back to the `@noframes` metadata.
    const frameMode = script.settings?.frameMode;
    let allFrames;
    if (frameMode === 'top') allFrames = false;
    else if (frameMode === 'all') allFrames = true;
    else allFrames = !meta.noframes;

    // Register the script
    const registration = {
      id: script.id,
      matches: matches,
      excludeMatches: excludeMatches.length > 0 ? excludeMatches : undefined,
      js: [{ code: wrappedCode }],
      runAt: runAt,
      allFrames: allFrames,
      world: world
    };

    // Chrome 133+: configure and use a per-script worldId for isolation.
    // Firefox MV3 exposes userScripts differently and rejects Chrome's
    // worldId extension, so never send that field outside supported Chromium.
    let worldConfigured = false;
    if (_supportsUserScriptsWorldId()) {
      try {
        await chrome.userScripts.configureWorld({
          worldId: script.id,
          csp: "script-src 'self' 'unsafe-inline' 'unsafe-eval' *",
          messaging: true
        });
        worldConfigured = true;
      } catch (e) {
        // Chrome <133 doesn't support worldId on configureWorld — fall through to default world
      }
    }

    if (worldConfigured) {
      registration.worldId = script.id;
    }

    try {
      // Chrome 138+: when reregisterScript routed us here with useUpdate, swap
      // the existing registration in place instead of failing on "already
      // registered". Chrome 131+ supports messaging in USER_SCRIPT world for
      // both register() and update(); keep the same fallback semantics.
      const payload = [{ ...registration, messaging: world === 'USER_SCRIPT' }];
      if (useUpdate && _supportsUserScriptsUpdate()) {
        try {
          await chrome.userScripts.update(payload);
        } catch (updateErr) {
          // update() throws on "no matching script" — fall back to register
          // so the first save after a SW restart still registers cleanly.
          await chrome.userScripts.register(payload);
        }
      } else {
        await chrome.userScripts.register(payload);
      }
    } catch (e) {
      if (e.message?.includes('messaging')) {
        // Fallback for older Chrome versions that don't support the messaging property
        await chrome.userScripts.register([registration]);
      } else {
        throw e;
      }
    }
    
    debugLog(`Registered: ${meta.name} (${requires.length} @require, ${Object.keys(storedValues).length} stored values)`);

    // Apply @webRequest declarativeNetRequest rules if defined
    if (meta.webRequest) {
      const rules = Array.isArray(meta.webRequest) ? meta.webRequest : [meta.webRequest];
      await applyWebRequestRules(script.id, rules);
    }
  } catch (e) {
    console.error(`[ScriptVault] Failed to register ${script.meta?.name || script.id}:`, e);
    // Mark script with registration failure for UI display
    try {
      script.settings = script.settings || {};
      script.settings._registrationError = e.message || 'Registration failed';
      await ScriptStorage.set(script.id, script);
    } catch {}
  }
}

// Cache for @require scripts (in-memory for current session)
// Capped at 500 entries to prevent unbounded memory growth; evicts oldest entry on overflow.
const requireCache = new Map();
const REQUIRE_CACHE_MAX = 500;

function requireCacheSet(key, value) {
  if (!requireCache.has(key) && requireCache.size >= REQUIRE_CACHE_MAX) {
    requireCache.delete(requireCache.keys().next().value);
  }
  requireCache.set(key, value);
}

// Common library fallback URLs
const LIBRARY_FALLBACKS = {
  'jquery': [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
    'https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js'
  ],
  'jquery@3': [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js'
  ],
  'jquery@2': [
    'https://code.jquery.com/jquery-2.2.4.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js'
  ],
  'gm_config': [
    'https://cdn.jsdelivr.net/npm/gm_config@2024.12.1/gm_config.min.js',
    'https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@master/gm_config.js',
    'https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js',
    'https://greasyfork.org/scripts/1884-gm-config/code/gm_config.js',
    'https://openuserjs.org/src/libs/sizzle/GM_config.js'
  ],
  'mutation-summary': [
    'https://cdn.jsdelivr.net/npm/mutation-summary@1.0.1/dist/mutation-summary.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/mutation-summary/1.0.1/mutation-summary.min.js',
    'https://unpkg.com/mutation-summary@1.0.1/dist/mutation-summary.min.js'
  ]
};

// Find fallback URLs for a library
function getFallbackUrls(url) {
  const lowerUrl = url.toLowerCase();
  
  // Check for known libraries
  if (lowerUrl.includes('gm_config') || lowerUrl.includes('gm-config') || 
      lowerUrl.includes('gm4_config') || lowerUrl.includes('sizzle/gm_config') ||
      lowerUrl.includes('1884-gm-config')) {
    return LIBRARY_FALLBACKS['gm_config'];
  }
  if (lowerUrl.includes('mutation-summary') || lowerUrl.includes('mutationsummary')) {
    return LIBRARY_FALLBACKS['mutation-summary'];
  }
  if (lowerUrl.includes('jquery')) {
    if (lowerUrl.includes('@2') || lowerUrl.includes('2.')) {
      return LIBRARY_FALLBACKS['jquery@2'];
    }
    return LIBRARY_FALLBACKS['jquery'];
  }
  
  // For unpkg URLs, try jsdelivr as fallback
  if (lowerUrl.includes('unpkg.com')) {
    const jsdelivrUrl = url.replace('unpkg.com', 'cdn.jsdelivr.net/npm');
    return [jsdelivrUrl];
  }
  
  // For rawgit/raw.githubusercontent, try jsdelivr gh
  if (lowerUrl.includes('raw.githubusercontent.com')) {
    // Convert: https://raw.githubusercontent.com/user/repo/branch/path
    // To: https://cdn.jsdelivr.net/gh/user/repo@branch/path
    const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
    if (match) {
      const [, user, repo, branch, path] = match;
      return [`https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`];
    }
  }
  
  return [];
}

// Check if a URL is known to be unfetchable (requires auth, blocked by CORS, etc.)
function isUnfetchableUrl(url) {
  const lowerUrl = url.toLowerCase();
  
  // Font Awesome kit URLs require authentication
  if (lowerUrl.includes('kit.fontawesome.com')) {
    return true;
  }
  
  // Google Fonts CSS (not JS, but sometimes used)
  if (lowerUrl.includes('fonts.googleapis.com')) {
    return true;
  }
  
  // URLs with authentication tokens that will fail
  if (lowerUrl.includes('?token=') || lowerUrl.includes('&token=')) {
    return true;
  }
  
  return false;
}

// Fetch a @require script with caching and fallbacks
// Verify SRI hash for fetched content
// Normalize a base64 / base64url value (with or without padding) to canonical
// padded standard base64 so SRI hashes pasted in either encoding compare equal.
function _normalizeSriBase64(value) {
  let s = String(value).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const rem = s.length % 4;
  if (rem === 2) s += '==';
  else if (rem === 3) s += '=';
  return s;
}

async function verifySRI(code, hashStr) {
  if (!hashStr) return true; // No integrity requested — nothing to verify.
  // Support formats: sha256-<base64>, sha384/512, md5-<hex>, with - or = separator.
  const match = hashStr.match(/^(sha256|sha384|sha512|md5)[-=](.+)$/i);
  if (!match) return true; // Not an SRI hash string — nothing enforceable to verify.
  const [, algo, expected] = match;
  if (!expected) return true;
  const algoMap = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  const algoName = algoMap[algo.toLowerCase()];
  // MD5 (and anything SubtleCrypto can't compute) is unverifiable; treat as
  // "no enforceable integrity" rather than failing closed and breaking scripts.
  if (!algoName) {
    console.warn('[ScriptVault] SRI: hash algorithm cannot be verified with SubtleCrypto; skipping integrity check for', hashStr);
    return true;
  }
  try {
    const digest = await crypto.subtle.digest(algoName, new TextEncoder().encode(code));
    const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return _normalizeSriBase64(actual) === _normalizeSriBase64(expected);
  } catch (e) {
    // Integrity WAS requested with a verifiable algorithm but verification could
    // not complete — fail CLOSED. Accepting unverified bytes would make the SRI
    // pin a no-op and defeat protection against a compromised/MITM'd CDN.
    console.warn('[ScriptVault] SRI verification error for hash', hashStr, '—', e.message, '; rejecting require');
    return false;
  }
}

async function fetchRequireScript(url) {
  // Extract SRI hash from URL fragment (e.g., url#sha256=abc123 or url#md5=abc123)
  let sriHash = null;
  let fetchUrl = url;
  const hashIdx = url.indexOf('#');
  if (hashIdx > 0) {
    const fragment = url.slice(hashIdx + 1);
    if (/^(sha256|sha384|sha512|md5)[-=]/i.test(fragment)) {
      sriHash = fragment;
      fetchUrl = url.slice(0, hashIdx);
    }
  }

  debugLog('Fetching @require:', fetchUrl);

  // Skip URLs that are known to be unfetchable
  if (isUnfetchableUrl(fetchUrl)) {
    console.warn(`[ScriptVault] Skipping unfetchable @require: ${url}`);
    return null;
  }

  // Check in-memory cache first
  if (requireCache.has(fetchUrl)) {
    debugLog('Using cached @require:', fetchUrl);
    return requireCache.get(fetchUrl);
  }
  
  // Check persistent cache in chrome.storage.local
  // Hash the URL to create a fixed-length collision-resistant cache key
  const cacheKey = await (async () => {
    const data = new TextEncoder().encode(url);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `require_cache_${hex}`;
  })();
  try {
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]?.code) {
      // Check if cache is less than 7 days old
      const age = Date.now() - (cached[cacheKey].timestamp || 0);
      if (age < 7 * 24 * 60 * 60 * 1000) {
        debugLog('Using persistent cached @require:', url);
        requireCacheSet(fetchUrl, cached[cacheKey].code);
        return cached[cacheKey].code;
      }
    }
  } catch (e) {
    // Ignore cache errors
  }
  
  // Build list of URLs to try (original + fallbacks)
  const fallbacks = getFallbackUrls(fetchUrl);
  const urlsToTry = [fetchUrl, ...fallbacks];
  debugLog(`Will try ${urlsToTry.length} URLs for:`, fetchUrl);

  for (const tryUrl of urlsToTry) {
    try {
      debugLog('Trying:', tryUrl);
      const code = await fetchWithRetry(tryUrl);
      if (code) {
        // Verify SRI hash if provided
        if (sriHash) {
          const valid = await verifySRI(code, sriHash);
          if (!valid) {
            console.warn(`[ScriptVault] SRI hash mismatch for ${tryUrl}, skipping`);
            continue;
          }
        }
        // Store in both caches
        requireCacheSet(fetchUrl, code);
        
        // Store in persistent cache
        try {
          await chrome.storage.local.set({
            [cacheKey]: { code, timestamp: Date.now(), url: tryUrl }
          });
        } catch (e) {
          // Ignore storage errors
        }
        
        if (tryUrl !== url) {
          debugLog(`Successfully fetched ${url} from fallback:`, tryUrl);
        } else {
          debugLog('Successfully fetched:', url);
        }
        return code;
      }
    } catch (e) {
      console.warn(`[ScriptVault] Failed to fetch ${tryUrl}: ${e.message}`);
      // Try next URL
      continue;
    }
  }
  
  console.error(`[ScriptVault] Failed to fetch ${url} (tried ${urlsToTry.length} URLs)`);
  return null;
}

async function fetchProvenanceBundle(url) {
  const preCheck = InternalHostGuard.classifyFetchUrl(url, ['http:', 'https:']);
  if (!preCheck.ok) {
    throw new Error('@require-provenance URL rejected: ' + preCheck.message);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.dev.sigstore.bundle.v0.3+json, application/json, text/plain, */*',
        'Cache-Control': 'no-cache'
      },
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
    if (!postCheck.ok) {
      throw new Error('@require-provenance URL redirected to ' + postCheck.message);
    }

    const MAX_PROVENANCE_BUNDLE_BYTES = 256 * 1024;
    const text = await _fetchTextBounded(response, MAX_PROVENANCE_BUNDLE_BYTES, 'Provenance bundle');
    return text && text.trim().length > 0 ? text : null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetch with retry and proper options
async function fetchWithRetry(url, retries = 2) {
  const preCheck = InternalHostGuard.classifyFetchUrl(url, ['http:', 'https:']);
  if (!preCheck.ok) {
    throw new Error('@require URL rejected: ' + preCheck.message);
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      let code;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/javascript, application/javascript, text/plain, */*',
            'Cache-Control': 'no-cache'
          },
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const postCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
        if (!postCheck.ok) {
          throw new Error('@require URL redirected to ' + postCheck.message);
        }

        // Reject excessively large @require scripts (>5MB) to prevent memory
        // issues. Use the stream-bounded helper so a hostile CDN serving an
        // unbounded body can't OOM the SW before the size check fires.
        const MAX_REQUIRE_BYTES = 5 * 1024 * 1024;
        code = await _fetchTextBounded(response, MAX_REQUIRE_BYTES, 'Response');
      } finally {
        clearTimeout(timeoutId);
      }

      // Basic validation - should look like JavaScript
      if (code && code.length > 0) {
        return code;
      }

      throw new Error('Empty response');
    } catch (e) {
      if (i === retries) {
        throw e;
      }
      // Wait before retry
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}

// Unregister a single script
// ============================================================================
// GM_webRequest — declarativeNetRequest rule management
// ============================================================================

// Maps scriptId -> array of rule IDs applied via @webRequest / GM_webRequest
// Round 11: Persisted to chrome.storage.local under `_webRequestRuleMap` so the
// map survives SW shutdown. Without persistence, once the SW is killed,
// `removeWebRequestRules` can no longer clean up rules inserted by prior SW
// generations — script deletion would leak DNR rules permanently.
const _webRequestRuleMap = new Map();
let _webRequestRuleMapHydrated = false;
let _webRequestRuleMapHydratingPromise = null;

async function _hydrateWebRequestRuleMap() {
  if (_webRequestRuleMapHydrated) return;
  if (_webRequestRuleMapHydratingPromise) return _webRequestRuleMapHydratingPromise;
  _webRequestRuleMapHydratingPromise = (async () => {
    try {
      const result = await chrome.storage.local.get('_webRequestRuleMap');
      const stored = result?._webRequestRuleMap;
      if (stored && typeof stored === 'object') {
        for (const [scriptId, ruleIds] of Object.entries(stored)) {
          if (Array.isArray(ruleIds) && ruleIds.length > 0) {
            _webRequestRuleMap.set(scriptId, ruleIds);
          }
        }
      }
    } catch (e) {
      console.warn('[ScriptVault] Failed to hydrate _webRequestRuleMap:', e?.message || e);
    } finally {
      _webRequestRuleMapHydrated = true;
      _webRequestRuleMapHydratingPromise = null;
    }
  })();
  return _webRequestRuleMapHydratingPromise;
}

async function _persistWebRequestRuleMap() {
  try {
    const obj = {};
    for (const [scriptId, ruleIds] of _webRequestRuleMap.entries()) {
      obj[scriptId] = ruleIds;
    }
    await chrome.storage.local.set({ _webRequestRuleMap: obj });
    return true;
  } catch (e) {
    console.warn('[ScriptVault] Failed to persist _webRequestRuleMap:', e?.message || e);
    return false;
  }
}

// Stable numeric rule ID from a string (scriptId + rule index)
function _makeRuleId(scriptId, index) {
  // Use a hash-like approach: sum char codes * position, full 31-bit range
  // Reserve low bits for rule index (up to 1000 rules per script)
  let h = 0;
  for (let i = 0; i < scriptId.length; i++) h = (h * 31 + scriptId.charCodeAt(i)) & 0x7fffffff;
  // Use upper 21 bits for script hash (2M buckets) + lower 10 bits for index (1024 rules)
  return (((h & 0x1fffff) << 10) | (index & 0x3ff)) + 1;
}

// Translate GM_webRequest rule selector/action to declarativeNetRequest format
function _translateWebRequestRule(rule, ruleId) {
  const dnr = { id: ruleId, priority: rule.priority || 1, condition: {}, action: {} };

  // Selector -> condition
  const sel = rule.selector || {};
  if (sel.url) {
    const urlFilter = sel.url;
    if (Array.isArray(urlFilter)) {
      // Multiple URL patterns: pick first include (DNR only supports one urlFilter per rule)
      const incl = urlFilter.find(u => u.include);
      if (incl) dnr.condition.urlFilter = incl.include;
      const excl = urlFilter.find(u => u.exclude);
      if (excl) dnr.condition.excludedInitiatorDomains = [excl.exclude.replace(/\*/g, '')].filter(Boolean);
    } else if (typeof urlFilter === 'string') {
      dnr.condition.urlFilter = urlFilter;
    }
  }
  if (sel.tab) dnr.condition.tabIds = Array.isArray(sel.tab) ? sel.tab : [sel.tab];
  if (sel.type) dnr.condition.resourceTypes = Array.isArray(sel.type) ? sel.type : [sel.type];

  // Action
  const act = rule.action || {};
  if (act.cancel) {
    dnr.action.type = 'block';
  } else if (act.redirect) {
    dnr.action.type = 'redirect';
    dnr.action.redirect = typeof act.redirect === 'string'
      ? { url: act.redirect }
      : { url: act.redirect.url || act.redirect.regexSubstitution || '' };
  } else if (act.setRequestHeaders) {
    dnr.action.type = 'modifyHeaders';
    dnr.action.requestHeaders = Object.entries(act.setRequestHeaders).map(([name, value]) =>
      value === null ? { header: name, operation: 'remove' } : { header: name, operation: 'set', value }
    );
  } else if (act.setResponseHeaders) {
    dnr.action.type = 'modifyHeaders';
    dnr.action.responseHeaders = Object.entries(act.setResponseHeaders).map(([name, value]) =>
      value === null ? { header: name, operation: 'remove' } : { header: name, operation: 'set', value }
    );
  } else {
    return null; // unsupported action
  }

  return dnr;
}

async function applyWebRequestRules(scriptId, rules) {
  if (!chrome.declarativeNetRequest || !Array.isArray(rules) || rules.length === 0) return;
  try {
    // Round 11: Ensure map is rehydrated from storage before mutating (SW may have restarted)
    await _hydrateWebRequestRuleMap();
    // Remove any existing rules for this script first
    await removeWebRequestRules(scriptId);

    const dnrRules = [];
    const ruleIds = [];
    rules.forEach((rule, idx) => {
      const ruleId = _makeRuleId(scriptId, idx);
      const dnr = _translateWebRequestRule(rule, ruleId);
      if (dnr) {
        dnrRules.push(dnr);
        ruleIds.push(ruleId);
      }
    });

    if (dnrRules.length > 0) {
      // Check dynamic rule quota (Chrome limit: 30,000)
      const existing = await chrome.declarativeNetRequest.getDynamicRules();
      if (existing.length + dnrRules.length > 30000) {
        console.warn(`[ScriptVault] DNR rule limit would be exceeded: ${existing.length} + ${dnrRules.length} > 30000`);
        return;
      }
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: dnrRules });
      _webRequestRuleMap.set(scriptId, ruleIds);
      const persisted = await _persistWebRequestRuleMap();
      if (!persisted) {
        _webRequestRuleMap.delete(scriptId);
        try {
          await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
        } catch (cleanupErr) {
          console.warn('[ScriptVault] GM_webRequest rule rollback failed after map persist failure:', cleanupErr?.message || cleanupErr);
        }
        return;
      }
      debugLog(`[GM_webRequest] Applied ${dnrRules.length} rules for script ${scriptId}`);
    }
  } catch (e) {
    console.warn('[ScriptVault] GM_webRequest rule apply failed:', e.message);
  }
}

async function removeWebRequestRules(scriptId) {
  if (!chrome.declarativeNetRequest) return;
  // Round 11: Rehydrate from storage before reading — the SW may have restarted
  // since the rules were originally inserted, and without this the in-memory Map
  // would be empty and we'd silently leak the DNR rules.
  await _hydrateWebRequestRuleMap();
  const existing = _webRequestRuleMap.get(scriptId);
  if (existing && existing.length > 0) {
    let removed = false;
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing });
      removed = true;
    } catch (e) {
      try {
        const liveRules = await chrome.declarativeNetRequest.getDynamicRules();
        const liveRuleIds = new Set((liveRules || []).map(r => r.id));
        removed = !existing.some(id => liveRuleIds.has(id));
      } catch (probeErr) {
        console.warn('[ScriptVault] GM_webRequest rule removal failed and live-state probe failed:', e?.message || e, probeErr?.message || probeErr);
      }
    }
    if (!removed) {
      console.warn(`[ScriptVault] GM_webRequest kept rule map for ${scriptId}; DNR removal did not complete.`);
      return;
    }
    _webRequestRuleMap.delete(scriptId);
    await _persistWebRequestRuleMap();
  }
}

// Phase 40.10 — Reconcile persisted DNR rule map against the live DNR state
// and the current ScriptStorage on SW wake. Without this, three drift modes
// silently accumulate orphans:
//   (a) A script was deleted while a previous SW was alive: its DNR rules were
//       removed correctly but the map entry might have lagged if `_persist`
//       failed mid-delete.
//   (b) The SW was killed mid-delete: the script record is gone from
//       ScriptStorage but the DNR rules and the map entry both survive.
//   (c) `updateDynamicRules` was applied by a prior SW generation but the
//       persist write failed: rules exist in DNR with no map entry to clean
//       them up later.
//
// Reconciliation is best-effort and lossy in the (c) direction: if a rule
// exists in DNR with no map entry pointing at any script, we leave it alone
// rather than risk removing a rule another extension might have inserted.
async function reconcileWebRequestRuleMap() {
  if (!chrome.declarativeNetRequest) return;
  await _hydrateWebRequestRuleMap();

  let mutated = false;
  let scripts;
  try {
    scripts = await ScriptStorage.getAll();
  } catch (e) {
    console.warn('[ScriptVault] DNR reconcile: ScriptStorage.getAll failed:', e?.message || e);
    return;
  }
  const scriptIds = new Set((scripts || []).map(s => s.id));

  // Pass 1: find map entries whose script no longer exists; queue the DNR
  // rule IDs for removal so the live engine catches up. Keep the map entries
  // until the DNR removal succeeds, otherwise a transient DNR failure would
  // strand live rules with no stored owner to retry later.
  const toRemoveRuleIds = [];
  const orphanScriptIds = [];
  for (const [scriptId, ruleIds] of _webRequestRuleMap.entries()) {
    if (!scriptIds.has(scriptId)) {
      if (Array.isArray(ruleIds)) toRemoveRuleIds.push(...ruleIds);
      orphanScriptIds.push(scriptId);
    }
  }

  // Pass 2: drop map rule IDs that no longer exist in DNR (stale entries).
  let liveRuleIds;
  try {
    const liveRules = await chrome.declarativeNetRequest.getDynamicRules();
    liveRuleIds = new Set(liveRules.map(r => r.id));
  } catch (e) {
    console.warn('[ScriptVault] DNR reconcile: getDynamicRules failed:', e?.message || e);
    liveRuleIds = null;
  }
  if (liveRuleIds) {
    for (const [scriptId, ruleIds] of _webRequestRuleMap.entries()) {
      if (orphanScriptIds.includes(scriptId)) continue;
      const filtered = (ruleIds || []).filter(id => liveRuleIds.has(id));
      if (filtered.length !== (ruleIds || []).length) {
        if (filtered.length === 0) _webRequestRuleMap.delete(scriptId);
        else _webRequestRuleMap.set(scriptId, filtered);
        mutated = true;
      }
    }
  }

  // Apply the queued DNR removal in one batched call, then drop the now-cleaned
  // map entries. If the DNR call fails, keep the entries for the next wake.
  if (toRemoveRuleIds.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemoveRuleIds });
      for (const scriptId of orphanScriptIds) {
        _webRequestRuleMap.delete(scriptId);
      }
      mutated = true;
      debugLog(`[GM_webRequest] Reconcile removed ${toRemoveRuleIds.length} orphan DNR rule(s)`);
    } catch (e) {
      console.warn('[ScriptVault] DNR reconcile: updateDynamicRules removal failed:', e?.message || e);
    }
  } else if (orphanScriptIds.length > 0) {
    for (const scriptId of orphanScriptIds) {
      _webRequestRuleMap.delete(scriptId);
    }
    mutated = true;
  }

  if (mutated) {
    await _persistWebRequestRuleMap();
  }
}

async function unregisterScript(scriptId) {
  // Clear @crontab alarm if present
  chrome.alarms.clear('crontab_' + scriptId).catch(() => {});
  // Remove any @webRequest declarativeNetRequest rules
  await removeWebRequestRules(scriptId);
  try {
    if (!chrome.userScripts) return;
    await chrome.userScripts.unregister({ ids: [scriptId] });
    // Chrome 133+: reset the per-script world configuration to free resources
    if (_supportsUserScriptsWorldId()) {
      try {
        await chrome.userScripts.resetWorldConfiguration({ worldId: scriptId });
      } catch (e) {
        // Chrome <133 doesn't support resetWorldConfiguration — ignore
      }
    }
  } catch (e) {
    // Script might not be registered
  }
}

// Build wrapped script code with GM API
function buildWrappedScript(script, requireScripts = [], preloadedStorage = {}, regexIncludes = [], regexExcludes = []) {
  const meta = script.meta;
  const grants = meta.grant || ['none'];
  
  // Build @require scripts section
  // Code runs INSIDE the main IIFE after GM APIs are available
  // No try/catch wrapper because let/const are block-scoped and wouldn't escape
  let requireCode = '';
  for (const req of requireScripts) {
    const safeUrl = req.url.replace(/\*\//g, '* /');
    requireCode += `
// @require ${safeUrl}
${req.code}
`;
  }
  
  // After @require code, expose common libraries to window for cross-script access
  const libraryExports = requireCode ? `
  // Expose common @require libraries to window
  if (typeof GM_config !== 'undefined' && typeof window.GM_config === 'undefined') window.GM_config = GM_config;
  if (typeof GM_configStruct !== 'undefined' && typeof window.GM_configStruct === 'undefined') window.GM_configStruct = GM_configStruct;
  if (typeof $ !== 'undefined' && typeof window.$ === 'undefined') window.$ = $;
  if (typeof jQuery !== 'undefined' && typeof window.jQuery === 'undefined') window.jQuery = jQuery;
  if (typeof Fuse !== 'undefined' && typeof window.Fuse === 'undefined') window.Fuse = Fuse;
  if (typeof JSZip !== 'undefined' && typeof window.JSZip === 'undefined') window.JSZip = JSZip;
` : '';
  
  // Build the GM API initialization with pre-loaded storage
  // Get the extension ID at build time so it's available in the wrapper
  const extId = chrome.runtime.id;
  
  const apiInit = `
(function() {
  'use strict';
  
  // ============ Console Capture (v2.0) ============
  // Intercept console.log/warn/error for per-script debugging
  {
    const _origConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
    const _scriptId = ${JSON.stringify(script.id)};
    const _captureLimit = 200;
    let _captureBuffer = [];
    function _captureConsole(level, args) {
      try {
        _captureBuffer.push({ level, args: Array.from(args).map(a => { try { return typeof a === 'object' ? JSON.stringify(a).slice(0, 500) : String(a); } catch { return String(a); } }), timestamp: Date.now() });
        if (_captureBuffer.length > _captureLimit) _captureBuffer.shift();
        // Batch-send every 2 seconds
        if (!_captureConsole._timer) {
          _captureConsole._timer = setTimeout(() => {
            try { chrome.runtime.sendMessage({ action: 'scriptConsoleCapture', scriptId: _scriptId, entries: _captureBuffer.splice(0) }); } catch {}
            _captureConsole._timer = null;
          }, 2000);
        }
      } catch {}
    }
    console.log = function() { _captureConsole('log', arguments); return _origConsole.log.apply(console, arguments); };
    console.warn = function() { _captureConsole('warn', arguments); return _origConsole.warn.apply(console, arguments); };
    console.error = function() { _captureConsole('error', arguments); return _origConsole.error.apply(console, arguments); };
    console.info = function() { _captureConsole('info', arguments); return _origConsole.info.apply(console, arguments); };
    console.debug = function() { _captureConsole('debug', arguments); return _origConsole.debug.apply(console, arguments); };
  }
  // ============ End Console Capture ============

  // ============ Error Suppression ============
  // Suppress uncaught errors and unhandled rejections from userscripts
  // to prevent them from appearing on chrome://extensions error page.
  // Chrome captures any error/warn/log from USER_SCRIPT world, so we
  // must silently swallow these without any console output.
  window.addEventListener('error', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
    // Report to error log
    try { chrome.runtime.sendMessage({ action: 'logError', entry: { scriptId: ${JSON.stringify(script.id)}, scriptName: ${JSON.stringify(meta.name)}, error: event.message || 'Unknown error', url: location.href, line: event.lineno, col: event.colno, timestamp: Date.now() } }); } catch {}
    return true;
  }, true);
  window.addEventListener('unhandledrejection', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
    try { chrome.runtime.sendMessage({ action: 'logError', entry: { scriptId: ${JSON.stringify(script.id)}, scriptName: ${JSON.stringify(meta.name)}, error: event.reason?.message || String(event.reason) || 'Unhandled rejection', url: location.href, timestamp: Date.now() } }); } catch {}
  }, true);
  // ============ End Error Suppression ============

  ${meta['run-in'] === 'incognito-tabs' ? `
  // ============ @run-in incognito-tabs Guard ============
  if (!chrome?.extension?.inIncognitoContext) return;
  // ============ End @run-in Guard ============
` : meta['run-in'] === 'normal-tabs' ? `
  // ============ @run-in normal-tabs Guard ============
  if (chrome?.extension?.inIncognitoContext) return;
  // ============ End @run-in Guard ============
` : ''}
  ${(() => {
    const validIncludes = regexIncludes.map(p => {
      const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
      return m ? `new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})` : null;
    }).filter(Boolean);
    const validExcludes = regexExcludes.map(p => {
      const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
      return m ? `new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})` : null;
    }).filter(Boolean);
    if (validIncludes.length === 0 && validExcludes.length === 0) return '';
    return `
  // ============ Regex @include/@exclude URL Guard ============
  {
    const __url = location.href;
    ${validIncludes.length > 0 ? `const __regexIncludes = [${validIncludes.join(', ')}];
    const __includeMatch = __regexIncludes.some(re => re.test(__url));
    if (!__includeMatch) return;` : ''}
    ${validExcludes.length > 0 ? `const __regexExcludes = [${validExcludes.join(', ')}];
    const __excludeMatch = __regexExcludes.some(re => re.test(__url));
    if (__excludeMatch) return;` : ''}
  }
  // ============ End URL Guard ============
`;
  })()}
  ${(() => {
    // Phase 39.11 — @match-top / @exclude-top runtime gates.
    // Patterns are matched against window.top.location.href. Cross-origin
    // top frames throw on access, so we treat opaque top as "no match" for
    // @match-top (do not run — author asked for a specific top origin we
    // can't verify) and "match" for @exclude-top (do not run — author asked
    // to keep the script away from frames whose top we can't audit).
    const matchTop = Array.isArray(meta.matchTop) ? meta.matchTop : [];
    const excludeTop = Array.isArray(meta.excludeTop) ? meta.excludeTop : [];
    if (matchTop.length === 0 && excludeTop.length === 0) return '';

    // Build a runtime matcher that handles both glob (@match-style) and
    // regex (`/.../flags`) patterns. Keep the matcher inside the wrapper
    // so it doesn't depend on the background's matchPattern helper.
    const patternsToLiteral = (arr) => arr.map(p => {
      const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
      if (m) return `{re: new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})}`;
      return `{glob: ${JSON.stringify(p)}}`;
    }).join(', ');

    return `
  // ============ @match-top / @exclude-top Guard (Phase 39.11) ============
  {
    let __topUrl;
    try { __topUrl = window.top && window.top.location && window.top.location.href; } catch (_e) { __topUrl = null; }
    const __testTop = (pattern) => {
      if (pattern.re) return pattern.re.test(__topUrl);
      // Glob: convert @match-style to RegExp on-demand. Handles * / scheme / host / path
      // wildcards conservatively -- anchored ^...$ with .* substituted for *.
      const escaped = pattern.glob.replace(/[.+^$()|[\\]{}]/g, '\\\\$&').replace(/\\*/g, '.*').replace(/\\?/g, '.');
      try { return new RegExp('^' + escaped + '$').test(__topUrl); } catch { return false; }
    };
    ${matchTop.length > 0 ? `
    const __matchTopPatterns = [${patternsToLiteral(matchTop)}];
    if (!__topUrl) return; // Cross-origin top → cannot verify match-top → bail.
    if (!__matchTopPatterns.some(__testTop)) return;` : ''}
    ${excludeTop.length > 0 ? `
    const __excludeTopPatterns = [${patternsToLiteral(excludeTop)}];
    if (!__topUrl) return; // Cross-origin top → conservatively bail.
    if (__excludeTopPatterns.some(__testTop)) return;` : ''}
  }
  // ============ End @match-top / @exclude-top Guard ============
`;
  })()}
  const scriptId = ${JSON.stringify(script.id)};
  const meta = ${JSON.stringify(meta)};
  const grants = ${JSON.stringify(grants)};
  const grantSet = new Set(grants);
  
  // Channel ID for communication with content script bridge
  // Extension ID is injected at build time since chrome.runtime isn't available in USER_SCRIPT world
  const CHANNEL_ID = ${JSON.stringify('ScriptVault_' + extId)};
  
  // console.log('[ScriptVault] Script initializing:', meta.name, 'Channel:', CHANNEL_ID);
  
  // Grant checking - @grant none or empty grants means NO APIs except GM_info
  const hasNone = grantSet.has('none');
  const hasGrant = (n) => {
    if (hasNone || grants.length === 0) return false;
    return grantSet.has(n) || grantSet.has('*');
  };
  
  // GM_info - always available
  const GM_info = {
    script: {
      name: meta.name || 'Unknown',
      namespace: meta.namespace || '',
      description: meta.description || '',
      version: meta.version || '1.0',
      author: meta.author || '',
      homepage: meta.homepage || meta.homepageURL || '',
      icon: meta.icon || '',
      icon64: meta.icon64 || '',
      matches: meta.match || [],
      includes: meta.include || [],
      excludes: meta.exclude || [],
      excludeMatches: meta.excludeMatch || [],
      grants: grants,
      resources: meta.resource || {},
      requires: meta.require || [],
      runAt: meta['run-at'] || 'document-idle',
      connect: meta.connect || [],
      noframes: meta.noframes || false,
      unwrap: meta.unwrap || false,
      antifeatures: meta.antifeature || [],
      tags: meta.tag || [],
      license: meta.license || '',
      updateURL: meta.updateURL || '',
      downloadURL: meta.downloadURL || '',
      supportURL: meta.supportURL || '',
      // Phase 11.7 — Userscripts (Safari) injection priority.
      weight: meta.weight || 0,
      priority: meta.priority || 0,
      // Phase 38.12 -- VM v2.37.0 renamed tag to tags. Older scripts written
      // against pre-2026 Violentmonkey read the singular form; expose a getter
      // that returns the first tag for back-compat. Non-enumerable so it does
      // not pollute structured clones / JSON serialization of GM_info.script.
      get tag() { return Array.isArray(this.tags) ? this.tags[0] : undefined; }
    },
    scriptMetaStr: ${JSON.stringify(script.code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)?.[0] || '')},
    scriptHandler: 'ScriptVault',
    scriptSource: 'ScriptVault',
    version: ${JSON.stringify(chrome.runtime.getManifest().version)},
    scriptWillUpdate: !!(meta.updateURL || meta.downloadURL),
    isIncognito: typeof chrome !== 'undefined' && chrome.extension ? chrome.extension.inIncognitoContext : false,
    injectInto: ${JSON.stringify(meta['inject-into'] || 'auto')},
    downloadMode: 'browser',
    platform: {
      os: navigator.userAgentData?.platform || navigator.platform || 'unknown',
      arch: navigator.userAgentData?.architecture || 'unknown',
      browserName: navigator.userAgentData?.brands?.find(b => /chrome|chromium|edge/i.test(b.brand))?.brand || 'Chrome',
      browserVersion: navigator.userAgentData?.brands?.[0]?.version || (navigator.userAgent?.match(/Chrome\\/([\\d.]+)/)?.[1]) || 'unknown',
      // Phase 11.1 — fullVersionList + mobile parity with Violentmonkey.
      fullVersionList: navigator.userAgentData?.brands?.map(b => ({ brand: b.brand, version: b.version })) || [],
      mobile: navigator.userAgentData?.mobile === true
    },
    // Phase 11.1 — Tampermonkey-compatible userAgent strings sourced from
    // the page context. Exposed so scripts have a consistent reference even
    // when tests mock navigator.userAgent.
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    userAgentData: typeof navigator !== 'undefined' && navigator.userAgentData
      ? {
          platform: navigator.userAgentData.platform,
          mobile: navigator.userAgentData.mobile,
          brands: (navigator.userAgentData.brands || []).map(b => ({ brand: b.brand, version: b.version }))
        }
      : null,
    uuid: ${JSON.stringify(script.id)}
  };
  
  // Storage cache - mutable so we can refresh it with fresh values from background
  // Pre-loaded values serve as fallback if background fetch fails
  let _cache = ${JSON.stringify(preloadedStorage)};
  let _cacheReady = false; // Track if we've fetched fresh values
  let _cacheReadyPromise = null;
  let _cacheReadyResolve = null;
  
  // XHR request tracking (like Violentmonkey's idMap)
  const _xhrRequests = new Map(); // requestId -> { details, aborted }
  let _xhrSeqId = 0;
  
  // Value change listeners (like Tampermonkey)
  const _valueChangeListeners = new Map(); // listenerId -> { key, callback }
  let _valueChangeListenerId = 0;
  
  // Listen for messages from content script (for menu commands, value changes, and XHR events)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
    
    // Handle menu command execution
    if (msg.type === 'menuCommand' && msg.scriptId === scriptId) {
      const cmd = _menuCmds.get(msg.commandId);
      if (cmd?.callback) try { cmd.callback(); } catch(err) { /* silently ignore menu command errors */ }
    }
    
    // Handle value change notifications (cross-tab sync)
    if (msg.type === 'valueChanged' && msg.scriptId === scriptId) {
      const oldValue = _cache[msg.key];
      if (msg.newValue === undefined) {
        delete _cache[msg.key];
      } else {
        _cache[msg.key] = msg.newValue;
      }
      // Notify value change listeners
      _valueChangeListeners.forEach((listener) => {
        if (listener.key === msg.key || listener.key === null) {
          try {
            listener.callback(msg.key, oldValue, msg.newValue, msg.remote !== false);
          } catch (e) {
            /* silently ignore value change listener errors */
          }
        }
      });
    }
    
    // Handle XHR events
    if (msg.type === 'xhrEvent' && msg.scriptId === scriptId) {
      const request = _xhrRequests.get(msg.requestId);
      if (!request || request.aborted) return;
      
      const { details } = request;
      const eventType = msg.eventType;
      const eventData = msg.data || {};
      
      // Decode binary responses transferred as base64/dataURL
      let responseValue = eventData.response;
      if (responseValue && typeof responseValue === 'object' && responseValue.__sv_base64__) {
        // arraybuffer: base64 -> ArrayBuffer
        const binary = atob(responseValue.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        responseValue = bytes.buffer;
      } else if (details.responseType === 'blob' && typeof responseValue === 'string' && responseValue.startsWith('data:')) {
        // blob: data URL -> Blob
        try {
          const [header, b64] = responseValue.split(',');
          const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          responseValue = new Blob([bytes], { type: mime });
        } catch (e) {
          // Fall through with data URL string if conversion fails
        }
      }

      // Build response object matching GM_xmlhttpRequest spec
      const response = {
        readyState: eventData.readyState || 0,
        status: eventData.status || 0,
        statusText: eventData.statusText || '',
        responseHeaders: eventData.responseHeaders || '',
        response: responseValue,
        responseText: eventData.responseText || '',
        responseXML: eventData.responseXML,
        finalUrl: eventData.finalUrl || details.url,
        context: details.context,
        lengthComputable: eventData.lengthComputable,
        loaded: eventData.loaded,
        total: eventData.total
      };
      
      // Call appropriate callback
      const callbackName = 'on' + eventType;
      if (eventType.startsWith('upload.')) {
        const uploadEvent = eventType.replace('upload.', '');
        if (details.upload && details.upload['on' + uploadEvent]) {
          try {
            details.upload['on' + uploadEvent](response);
          } catch (e) {
            /* silently ignore XHR upload callback errors */
          }
        }
      } else if (details[callbackName]) {
        try {
          details[callbackName](response);
        } catch (e) {
          /* silently ignore XHR callback errors */
        }
      }
      
      // Clean up on loadend
      if (eventType === 'loadend') {
        _xhrRequests.delete(msg.requestId);
      }
    }
  });
  
  // Bridge ready state tracking
  let _bridgeReady = false;
  let _bridgeReadyPromise = null;
  let _bridgeReadyResolve = null;
  
  // Wait for bridge to be ready
  function waitForBridge() {
    // Check if already ready (content script sets this global)
    if (window.__ScriptVault_BridgeReady__ || _bridgeReady) {
      _bridgeReady = true;
      return Promise.resolve();
    }
    
    // Return existing promise if already waiting
    if (_bridgeReadyPromise) return _bridgeReadyPromise;
    
    // Create promise to wait for bridge ready message
    _bridgeReadyPromise = new Promise((resolve) => {
      _bridgeReadyResolve = resolve;
      
      // Listen for bridgeReady message from content script
      function bridgeReadyHandler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.type === 'bridgeReady') {
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }
      window.addEventListener('message', bridgeReadyHandler);
      
      // Also check global flag periodically (fallback)
      const checkInterval = setInterval(() => {
        if (window.__ScriptVault_BridgeReady__) {
          clearInterval(checkInterval);
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }, 10);
      
      // Timeout after 1 second - bridge should be ready much faster
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', bridgeReadyHandler);
        if (!_bridgeReady) {
          // This is normal in some contexts, proceed without warning spam
          _bridgeReady = true;
          resolve();
        }
      }, 1000);
    });
    
    return _bridgeReadyPromise;
  }
  
  function canUsePostMessageBridge(action) {
    return action === 'netlog_record' || action === 'reportExecError' || action === 'reportExecTime';
  }

  // Send message to background script.
  // Prefers chrome.runtime.sendMessage (direct, no bridge needed) when available via messaging: true.
  // The postMessage bridge is telemetry-only because page scripts can forge window messages.
  async function sendToBackground(action, data) {
    // Try direct messaging first (available when userScripts world has messaging: true)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        return await chrome.runtime.sendMessage({ action, data });
      } catch (e) {
        // Extension context invalidated or messaging not available, fall through to bridge
      }
    }

    if (!canUsePostMessageBridge(action)) {
      return { error: 'ScriptVault requires Chrome userScripts messaging for GM API calls.' };
    }

    // Fallback: use the telemetry-only content script bridge via postMessage.
    await waitForBridge();

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Set timeout for response
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(undefined);
      }, 10000);

      // Listen for response
      function handler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.id !== id) return;

        window.removeEventListener('message', handler);
        clearTimeout(timeout);

        if (msg.success) {
          resolve(msg.result);
        } else {
          resolve(undefined);
        }
      }

      window.addEventListener('message', handler);

      // Send to content script bridge
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-background',
        id: id,
        action: action,
        data: data
      }, '*');
    });
  }

  // Refresh storage cache from background
  // This ensures we have the latest values, not stale values from registration time
  async function _refreshStorageCache() {
    if (_cacheReady) return;
    
    try {
      const freshValues = await sendToBackground('GM_getValues', { scriptId });
      if (freshValues && typeof freshValues === 'object') {
        // Merge fresh values with any local changes made before refresh completed
        _cache = { ..._cache, ...freshValues };
      }
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    } catch (e) {
      // If refresh fails, continue with pre-loaded values
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    }
  }
  
  // Start refreshing cache immediately (don't await - let script start running)
  // Scripts can use GM_getValue immediately with pre-loaded values
  // Fresh values will be available after the async refresh completes
  _refreshStorageCache();
  
  // Synchronous GM_getValue - returns from cache (pre-loaded or refreshed)
  function GM_getValue(key, defaultValue) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue')) return defaultValue;
    if (key in _cache) return _cache[key];
    return defaultValue;
  }
  
  // GM_setValue - updates cache IMMEDIATELY, persists async (like Tampermonkey/Violentmonkey)
  function GM_setValue(key, value) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue')) {
      return;
    }
    // Update local cache IMMEDIATELY - this makes subsequent GM_getValue instant
    _cache[key] = value;
    // Persist async (fire and forget) - background handles debouncing
    sendToBackground('GM_setValue', { scriptId, key, value }).catch(() => {});
    return value;
  }
  
  // GM_deleteValue
  function GM_deleteValue(key) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue')) return;
    delete _cache[key];
    sendToBackground('GM_deleteValue', { scriptId, key }).catch(() => {});
  }
  
  // GM_listValues - returns cached keys synchronously
  function GM_listValues() {
    if (!hasGrant('GM_listValues') && !hasGrant('GM.listValues')) return [];
    return Object.keys(_cache);
  }
  
  // GM_getValues - Get multiple values at once (like Violentmonkey)
  // Accepts array of keys or object with default values
  function GM_getValues(keysOrDefaults) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue') && 
        !hasGrant('GM_getValues') && !hasGrant('GM.getValues')) {
      return Array.isArray(keysOrDefaults) ? {} : keysOrDefaults;
    }
    const result = {};
    if (Array.isArray(keysOrDefaults)) {
      // Array of keys - return values or undefined
      for (const key of keysOrDefaults) {
        if (key in _cache) {
          result[key] = _cache[key];
        }
      }
    } else if (typeof keysOrDefaults === 'object' && keysOrDefaults !== null) {
      // Object with defaults - return values or defaults
      for (const key of Object.keys(keysOrDefaults)) {
        result[key] = key in _cache ? _cache[key] : keysOrDefaults[key];
      }
    }
    return result;
  }
  
  // GM_setValues - Set multiple values at once (like Violentmonkey)
  function GM_setValues(values) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue') &&
        !hasGrant('GM_setValues') && !hasGrant('GM.setValues')) {
      return;
    }
    if (typeof values !== 'object' || values === null) return;
    
    // Update local cache immediately for all values
    for (const [key, value] of Object.entries(values)) {
      _cache[key] = value;
    }
    // Persist all values to background in one call
    sendToBackground('GM_setValues', { scriptId, values }).catch(() => {});
  }
  
  // GM_deleteValues - Delete multiple values at once (like Violentmonkey)
  function GM_deleteValues(keys) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue') &&
        !hasGrant('GM_deleteValues') && !hasGrant('GM.deleteValues')) {
      return;
    }
    if (!Array.isArray(keys)) return;
    
    // Delete from local cache immediately
    for (const key of keys) {
      delete _cache[key];
    }
    // Persist deletions to background in one call
    sendToBackground('GM_deleteValues', { scriptId, keys }).catch(() => {});
  }
  
  // GM_addStyle - inject CSS with robust DOM handling
  function GM_addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-scriptvault', scriptId);
    
    // Try to inject immediately
    function inject() {
      const target = document.head || document.documentElement || document.body;
      if (target && target.appendChild) {
        try {
          target.appendChild(style);
          return true;
        } catch (e) {
          // appendChild failed, will retry
        }
      }
      return false;
    }
    
    if (!inject()) {
      // DOM not ready - wait for it
      if (document.readyState === 'loading') {
        // Document still loading, wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => inject(), { once: true });
      } else {
        // Document loaded but no valid target - use MutationObserver
        const observer = new MutationObserver(() => {
          if (inject()) {
            observer.disconnect();
          }
        });
        
        // Observe whatever root we can find
        const root = document.documentElement || document;
        if (root && root.nodeType === Node.ELEMENT_NODE) {
          observer.observe(root, { childList: true, subtree: true });
        }
        
        // Fallback timeout - try one more time after a delay
        setTimeout(() => {
          observer.disconnect();
          if (!style.parentNode) {
            inject();
          }
        }, 1000);
      }
    }
    
    return style;
  }
  
  // GM_xmlhttpRequest - Full implementation with all events (like Violentmonkey)
  function GM_xmlhttpRequest(details) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      if (details.onerror) details.onerror({ error: 'Permission denied', status: 0 });
      return { abort: () => {} };
    }
    
    // Generate unique request ID
    const localId = 'xhr_' + (++_xhrSeqId) + '_' + Date.now().toString(36);
    let requestId = null;
    let aborted = false;
    let currentMapKey = localId;

    // Store request details for event handling
    const requestEntry = { details, aborted: false };
    _xhrRequests.set(localId, requestEntry);

    // Control object returned to the script
    const control = {
      abort: () => {
        aborted = true;
        requestEntry.aborted = true;
        // Send abort using server ID if available, clean up both keys
        if (requestId) {
          sendToBackground('GM_xmlhttpRequest_abort', { requestId }).catch(() => {});
        }
        // Call onabort callback
        if (details.onabort) {
          try {
            details.onabort({ error: 'Aborted', status: 0 });
          } catch (e) {}
        }
        // Clean up both possible keys to avoid orphans
        _xhrRequests.delete(localId);
        if (requestId) _xhrRequests.delete(requestId);
      }
    };

    // Serialize request body to a structured-clone-safe format.
    // Blob/File/FormData cannot cross the extension messaging boundary natively.
    async function _serializeBody(d) {
      if (!d || typeof d === 'string' || d instanceof ArrayBuffer || ArrayBuffer.isView(d)) return d;
      if (d instanceof URLSearchParams) return d.toString();
      function _ab2b64(buf) {
        const bytes = new Uint8Array(buf), chunk = 8192;
        let s = '';
        for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
        return btoa(s);
      }
      if (d instanceof Blob || d instanceof File) {
        const buf = await d.arrayBuffer();
        return { __sv_blob__: true, b64: _ab2b64(buf), type: d.type, name: d instanceof File ? d.name : undefined };
      }
      if (d instanceof FormData) {
        const entries = [];
        for (const [name, val] of d.entries()) {
          if (val instanceof Blob || val instanceof File) {
            const buf = await val.arrayBuffer();
            entries.push({ name, b64: _ab2b64(buf), type: val.type, filename: val instanceof File ? val.name : 'blob' });
          } else {
            entries.push({ name, value: val });
          }
        }
        return { __sv_formdata__: true, entries };
      }
      return d;
    }

    // Start the request (async to allow body serialization)
    (async () => {
      const serializedData = await _serializeBody(details.data);
      const response = await sendToBackground('GM_xmlhttpRequest', {
        scriptId,
        method: details.method || 'GET',
        url: details.url,
        headers: details.headers,
        data: serializedData,
        timeout: details.timeout,
        responseType: details.responseType,
        overrideMimeType: details.overrideMimeType,
        user: details.user,
        password: details.password,
        context: details.context,
        anonymous: details.anonymous,
        // VM #2168 / TM noCache: bypass intermediate caches.
        // Accept both noCache (VM camelCase) and nocache (TM lowercase).
        noCache: details.noCache === true || details.nocache === true,
        // VM #2359: expose RequestInit.redirect so scripts can detect/block redirects.
        redirect: details.redirect,
        // Track which callbacks are registered so background knows what to send
        hasCallbacks: {
          onload: !!details.onload,
          onerror: !!details.onerror,
          onprogress: !!details.onprogress,
          onreadystatechange: !!details.onreadystatechange,
          ontimeout: !!details.ontimeout,
          onabort: !!details.onabort,
          onloadstart: !!details.onloadstart,
          onloadend: !!details.onloadend,
          upload: !!(details.upload && (
            details.upload.onprogress || 
            details.upload.onloadstart || 
            details.upload.onload || 
            details.upload.onerror
          ))
        }
      });
      if (aborted) return;

      if (!response) {
        // No response (bridge failure)
        if (details.onerror) details.onerror({ error: 'Request failed - no response', status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.error) {
        // Immediate error
        if (details.onerror) details.onerror({ error: response.error, status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.requestId) {
        // Re-key: add server ID entry, then remove local ID
        requestId = response.requestId;
        _xhrRequests.set(requestId, requestEntry);
        _xhrRequests.delete(localId);
        currentMapKey = requestId;
      }
    })().catch(err => {
      if (aborted) return;
      if (details.onerror) details.onerror({ error: err.message || 'Request failed', status: 0 });
      _xhrRequests.delete(currentMapKey);
    });
    
    return control;
  }
  
  // GM_addValueChangeListener - Watch for value changes (like Tampermonkey)
  function GM_addValueChangeListener(key, callback) {
    if (!hasGrant('GM_addValueChangeListener') && !hasGrant('GM.addValueChangeListener')) return null;
    if (typeof callback !== 'function') return null;
    
    const listenerId = ++_valueChangeListenerId;
    _valueChangeListeners.set(listenerId, { key, callback });
    return listenerId;
  }
  
  // GM_removeValueChangeListener - Stop watching for value changes
  function GM_removeValueChangeListener(listenerId) {
    if (!hasGrant('GM_removeValueChangeListener') && !hasGrant('GM.removeValueChangeListener')) return false;
    return _valueChangeListeners.delete(listenerId);
  }
  
  // GM_setClipboard
  function GM_setClipboard(text, type) {
    if (!hasGrant('GM_setClipboard') && !hasGrant('GM.setClipboard')) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  }
  
  function fallbackCopyText(text) {
    const target = document.body || document.documentElement;
    if (!target) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    target.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
  }
  
  // GM_head — convenience wrapper for HEAD requests
  function GM_head(url, callback) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      if (typeof callback === 'function') callback({ error: 'Missing @grant GM_xmlhttpRequest' });
      return;
    }
    GM_xmlhttpRequest({ method: 'HEAD', url, onload: callback, onerror: callback });
  }

  // GM_notification (with onclick, ondone, onbuttonclick, timeout, tag, silent,
  // highlight, url, plus Phase 11.11 progress + buttons + update + close).
  // Returns a control object with { close(), update(details) } so script
  // authors don't have to keep notification IDs around manually.
  // Wrapper-side LRU cap mirrors the 500-entry cap on the background side at
  // self._notifCallbacks — without this, a misbehaving script that spams
  // GM_notification and never receives click/done events can grow the Map
  // unbounded for the lifetime of the host tab.
  //
  // Phase 40.14 — Eviction counter surfaces leaks via the existing console
  // capture pipe (the wrapper already pipes console.* into the per-script
  // DevTools panel via _captureConsole). A non-zero count for any script is
  // a smell — the script is missing an ondone/onload/onclose handler.
  const _notifCallbacks = new Map();
  const _NOTIF_CALLBACKS_CAP = 500;
  let _notifCallbacksEvicted = 0;
  function GM_notification(details, ondone) {
    if (!hasGrant('GM_notification') && !hasGrant('GM.notification')) {
      return { close: () => {}, update: () => {} };
    }
    let opts;
    if (typeof details === 'string') {
      // GM_notification(text, title, image, onclick)
      opts = { text: details, title: ondone, image: arguments[2] };
      const onclickArg = arguments[3];
      if (typeof onclickArg === 'function') opts.onclick = onclickArg;
      ondone = undefined;
    } else {
      opts = details;
    }
    if (typeof ondone === 'function') opts.ondone = ondone;
    const notifTag = opts.tag || ('notif_' + Math.random().toString(36).substring(2));
    // Store callbacks; evict oldest when capped to avoid memory growth.
    if (_notifCallbacks.size >= _NOTIF_CALLBACKS_CAP) {
      const oldest = _notifCallbacks.keys().next().value;
      if (oldest !== undefined) _notifCallbacks.delete(oldest);
      _notifCallbacksEvicted += 1;
      if (_notifCallbacksEvicted === 1 || _notifCallbacksEvicted % 100 === 0) {
        console.warn('[ScriptVault] GM_notification callback cap evict — script may be missing ondone/onclick handler. Evicted so far:', _notifCallbacksEvicted);
      }
    }
    _notifCallbacks.set(notifTag, {
      onclick: opts.onclick,
      ondone: opts.ondone,
      onbuttonclick: opts.onbuttonclick
    });
    // Highlight tab instead of notification
    if (opts.highlight) {
      sendToBackground('GM_focusTab', {}).catch(() => {});
      if (opts.ondone) { try { opts.ondone(); } catch(e) {} }
      _notifCallbacks.delete(notifTag); // Clean up — no notification created
      return { close: () => {}, update: () => {} };
    }
    // Sanitize buttons[] so the background's truncate-to-2 contract stays
    // explicit at the wrapper boundary.
    const wireButtons = Array.isArray(opts.buttons)
      ? opts.buttons.slice(0, 2).map((b) => ({
          title: String(b?.title ?? ''),
          ...(typeof b?.iconUrl === 'string' ? { iconUrl: b.iconUrl } : {})
        }))
      : undefined;
    sendToBackground('GM_notification', {
      scriptId,
      title: opts.title || GM_info.script.name,
      text: opts.text || opts.body || '',
      image: opts.image,
      timeout: opts.timeout || 0,
      tag: notifTag,
      silent: opts.silent || false,
      // Tampermonkey/Violentmonkey parity — when set, Chrome pins the
      // notification until the user explicitly dismisses or acts on it.
      requireInteraction: typeof opts.requireInteraction === 'boolean' ? opts.requireInteraction : undefined,
      progress: typeof opts.progress === 'number' ? opts.progress : undefined,
      buttons: wireButtons,
      hasOnclick: !!opts.onclick,
      hasOndone: !!opts.ondone,
      hasOnbuttonclick: typeof opts.onbuttonclick === 'function'
    }).catch(() => { _notifCallbacks.delete(notifTag); });

    return {
      close: () => {
        _notifCallbacks.delete(notifTag);
        sendToBackground('GM_closeNotification', { id: notifTag }).catch(() => {});
      },
      update: (patch) => {
        if (!patch || typeof patch !== 'object') return;
        sendToBackground('GM_updateNotification', {
          id: notifTag,
          title: typeof patch.title === 'string' ? patch.title : undefined,
          text: typeof patch.text === 'string' ? patch.text
              : typeof patch.body === 'string' ? patch.body : undefined,
          image: typeof patch.image === 'string' ? patch.image : undefined,
          progress: typeof patch.progress === 'number' ? patch.progress : undefined,
          buttons: Array.isArray(patch.buttons)
            ? patch.buttons.slice(0, 2).map((b) => ({
                title: String(b?.title ?? ''),
                ...(typeof b?.iconUrl === 'string' ? { iconUrl: b.iconUrl } : {})
              }))
            : undefined,
          silent: typeof patch.silent === 'boolean' ? patch.silent : undefined,
          requireInteraction: typeof patch.requireInteraction === 'boolean' ? patch.requireInteraction : undefined
        }).catch(() => {});
      }
    };
  }

  // Phase 11.11 — Standalone GM_updateNotification / GM_closeNotification
  // for callers that hold onto the tag from a prior GM_notification(tag: ...).
  function GM_updateNotification(notificationId, details) {
    if (!hasGrant('GM_notification') && !hasGrant('GM.notification')) return;
    if (!notificationId || !details || typeof details !== 'object') return;
    sendToBackground('GM_updateNotification', {
      id: notificationId,
      title: typeof details.title === 'string' ? details.title : undefined,
      text: typeof details.text === 'string' ? details.text
          : typeof details.body === 'string' ? details.body : undefined,
      image: typeof details.image === 'string' ? details.image : undefined,
      progress: typeof details.progress === 'number' ? details.progress : undefined,
      buttons: Array.isArray(details.buttons)
        ? details.buttons.slice(0, 2).map((b) => ({
            title: String(b?.title ?? ''),
            ...(typeof b?.iconUrl === 'string' ? { iconUrl: b.iconUrl } : {})
          }))
        : undefined,
      silent: typeof details.silent === 'boolean' ? details.silent : undefined,
      requireInteraction: typeof details.requireInteraction === 'boolean' ? details.requireInteraction : undefined
    }).catch(() => {});
  }
  function GM_closeNotification(notificationId) {
    if (!hasGrant('GM_notification') && !hasGrant('GM.notification')) return;
    if (!notificationId) return;
    _notifCallbacks.delete(notificationId);
    sendToBackground('GM_closeNotification', { id: notificationId }).catch(() => {});
  }
  
  // GM_openInTab (with close(), onclose, insert, setParent, incognito)
  // Cap the handle map so a misbehaving script that never receives the
  // openedTabClosed event (background crashed, content bridge missed the
  // signal, tab killed before bridge attached) can't leak unbounded handles
  // in the USER_SCRIPT world for the lifetime of the host tab.
  // Phase 40.14 — Eviction counter (see _notifCallbacks for rationale).
  const _openedTabs = new Map();
  const _OPENED_TABS_CAP = 200;
  let _openedTabsEvicted = 0;
  function GM_openInTab(url, options) {
    if (!hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return null;
    const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    const tabHandle = { closed: false, onclose: null, close: () => {} };

    // Phase 39.13 — TM #2669: blob: URLs are bound to the creating context's
    // blob registry. chrome.tabs.create() in the background SW cannot resolve
    // a blob URL minted by a USER_SCRIPT world. Route blob: through window.open()
    // in-context instead; that preserves the registry binding. data: and
    // about:blank also resolve here without a background round-trip.
    const isLocalOnly = typeof url === 'string' && /^(blob|data|about):/i.test(url);
    if (isLocalOnly) {
      try {
        const target = opts.active === false || opts.background ? '_blank' : '_blank';
        const features = opts.active === false ? 'noopener=yes' : '';
        const win = window.open(url, target, features);
        if (!win) {
          // Pop-up blocker engaged. Surface a clear log so the script author
          // knows GM_openInTab requires a user-gesture for blob: URLs.
          console.warn('[ScriptVault] GM_openInTab(blob:) blocked by pop-up settings — call within a user-gesture handler');
        }
      } catch (e) {
        console.warn('[ScriptVault] GM_openInTab(blob:) failed:', e?.message || e);
      }
      // window.open returns a Window we can't message-pass with; tabHandle
      // gets a no-op close() and no onclose tracking (Chrome doesn't expose
      // the new tab's id to the page).
      return tabHandle;
    }

    sendToBackground('GM_openInTab', {
      url, scriptId, trackClose: true,
      active: opts.active, insert: opts.insert,
      setParent: opts.setParent, background: opts.background
    }).then(result => {
      if (result && result.tabId) {
        if (_openedTabs.size >= _OPENED_TABS_CAP) {
          const oldest = _openedTabs.keys().next().value;
          if (oldest !== undefined) _openedTabs.delete(oldest);
          _openedTabsEvicted += 1;
          if (_openedTabsEvicted === 1 || _openedTabsEvicted % 100 === 0) {
            console.warn('[ScriptVault] GM_openInTab cap evict — script may be opening tabs without listening for openedTabClosed. Evicted so far:', _openedTabsEvicted);
          }
        }
        _openedTabs.set(result.tabId, tabHandle);
        tabHandle.close = () => {
          sendToBackground('GM_closeTab', { tabId: result.tabId }).catch(() => {});
          tabHandle.closed = true;
        };
      }
    }).catch(() => {});
    return tabHandle;
  }

  // GM_download (with onload, onerror, onprogress, ontimeout callbacks)
  // Same LRU eviction as _openedTabs — protects a long-lived tab from a script
  // that fires GM_download in a loop where the load/error/timeout event never
  // arrives (download removed from history, SW restart between request and
  // response, etc.).
  // Phase 40.14 — Eviction counter (see _notifCallbacks for rationale).
  const _downloadCallbacks = new Map();
  const _DOWNLOAD_CALLBACKS_CAP = 200;
  let _downloadCallbacksEvicted = 0;
  function GM_download(details) {
    if (!hasGrant('GM_download') && !hasGrant('GM.download')) return;
    let opts;
    if (typeof details === 'string') {
      opts = { url: details, name: arguments[1] || details.split('/').pop() };
    } else {
      opts = { ...details };
    }
    const callbacks = {
      onload: opts.onload, onerror: opts.onerror,
      onprogress: opts.onprogress, ontimeout: opts.ontimeout
    };
    delete opts.onload; delete opts.onerror;
    delete opts.onprogress; delete opts.ontimeout;
    opts.scriptId = scriptId;
    opts.hasCallbacks = !!(callbacks.onload || callbacks.onerror || callbacks.onprogress || callbacks.ontimeout);
    sendToBackground('GM_download', opts).then(result => {
      if (result && result.downloadId) {
        if (_downloadCallbacks.size >= _DOWNLOAD_CALLBACKS_CAP) {
          const oldest = _downloadCallbacks.keys().next().value;
          if (oldest !== undefined) _downloadCallbacks.delete(oldest);
          _downloadCallbacksEvicted += 1;
          if (_downloadCallbacksEvicted === 1 || _downloadCallbacksEvicted % 100 === 0) {
            console.warn('[ScriptVault] GM_download cap evict — script may be missing onload/onerror handlers. Evicted so far:', _downloadCallbacksEvicted);
          }
        }
        _downloadCallbacks.set(result.downloadId, callbacks);
      }
      if (result && result.error) {
        if (callbacks.onerror) try { callbacks.onerror({ error: result.error }); } catch(e) {}
        if (result.downloadId) _downloadCallbacks.delete(result.downloadId);
      }
    }).catch(e => {
      if (callbacks.onerror) try { callbacks.onerror({ error: e.message || 'Download failed' }); } catch(ex) {}
    });
  }
  
  // GM_log
  function GM_log(...args) {
    console.log('[' + GM_info.script.name + ']', ...args);
  }
  
  // GM_registerMenuCommand (with extended options: id, accessKey, autoClose, title)
  const _menuCmds = new Map();
  function GM_registerMenuCommand(caption, callback, accessKeyOrOptions) {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand')) return null;
    let opts = {};
    if (typeof accessKeyOrOptions === 'string') {
      opts.accessKey = accessKeyOrOptions;
    } else if (accessKeyOrOptions && typeof accessKeyOrOptions === 'object') {
      opts = accessKeyOrOptions;
    }
    const id = opts.id || Math.random().toString(36).substring(2);
    _menuCmds.set(id, { callback, caption });
    sendToBackground('GM_registerMenuCommand', {
      scriptId, commandId: id, caption,
      accessKey: opts.accessKey || '',
      autoClose: opts.autoClose !== false,
      title: opts.title || ''
    }).catch(() => {});
    return id;
  }

  function GM_unregisterMenuCommand(id) {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand') &&
        !hasGrant('GM_unregisterMenuCommand') && !hasGrant('GM.unregisterMenuCommand')) return;
    _menuCmds.delete(id);
    sendToBackground('GM_unregisterMenuCommand', { scriptId, commandId: id }).catch(() => {});
  }

  function GM_getMenuCommands() {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand')) return [];
    return Array.from(_menuCmds.entries()).map(([id, entry]) => ({ id, name: entry.caption || id, caption: entry.caption || id }));
  }
  
  // GM_getResourceText / GM_getResourceURL
  async function GM_getResourceText(name) {
    if (!hasGrant('GM_getResourceText') && !hasGrant('GM.getResourceText')) return null;
    return await sendToBackground('GM_getResourceText', { scriptId, name });
  }
  
  async function GM_getResourceURL(name, isBlobUrl) {
    if (!hasGrant('GM_getResourceURL') && !hasGrant('GM.getResourceUrl')) return null;
    const dataUri = await sendToBackground('GM_getResourceURL', { scriptId, name });
    if (!dataUri) return null;
    // Return data URI by default, or convert to blob URL if requested
    if (isBlobUrl !== true) return dataUri;
    try {
      const resp = await fetch(dataUri);
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      return dataUri;
    }
  }
  
  // GM_addElement
  const _urlAttrs = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'xlink:href', 'data']);
  function _isUnsafeElementAttribute(name, value) {
    const lowerName = String(name || '').trim().toLowerCase();
    if (!lowerName || lowerName.startsWith('on')) return true;
    if (!_urlAttrs.has(lowerName)) return false;
    const normalizedValue = String(value ?? '').replace(/[\\u0000-\\u0020\\u007f\\ufffd]+/g, '').toLowerCase();
    return /^(javascript|vbscript|data|blob|file):/.test(normalizedValue);
  }

  function GM_addElement(parentOrTag, tagOrAttrs, attrsOrUndefined) {
    if (!hasGrant('GM_addElement') && !hasGrant('GM.addElement')) return null;
    // Phase 38.1 — VM v2.37.0 + TM 5.5.6237 contract: return null on any
    // failure (missing tag, createElement throws, missing/detached parent,
    // appendChild throws). Never throw out of GM_addElement.
    let parent, tag, attrs;
    if (typeof parentOrTag === 'string') {
      tag = parentOrTag;
      attrs = tagOrAttrs;
      parent = document.head || document.documentElement;
    } else {
      parent = parentOrTag;
      tag = tagOrAttrs;
      attrs = attrsOrUndefined;
    }
    if (typeof tag !== 'string' || !tag) return null;
    let el;
    try { el = document.createElement(tag); } catch { return null; }
    if (!el) return null;
    // Reject arrays — Object.entries(array) returns numeric-index pairs that
    // would silently create attributes like 0="value". TM/VM contract says
    // attrs is an object map, never an array.
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
      try {
        Object.entries(attrs).forEach(([k, v]) => {
          if (k === 'textContent') el.textContent = v;
          else if (k === 'innerHTML') {
            const temp = document.createElement('template');
            temp.innerHTML = v;
            temp.content.querySelectorAll('script').forEach(s => s.remove());
            temp.content.querySelectorAll('*').forEach(node => {
              for (const attr of [...node.attributes]) {
                if (_isUnsafeElementAttribute(attr.name, attr.value)) {
                  node.removeAttribute(attr.name);
                }
              }
            });
            el.innerHTML = temp.innerHTML;
          }
          else {
            if (_isUnsafeElementAttribute(k, v)) return;
            try { el.setAttribute(k, v); } catch { /* ignore invalid attribute names */ }
          }
        });
      } catch { /* attribute-application errors do not abort, but a missing
                   parent below will. */ }
    }
    if (!parent || typeof parent.appendChild !== 'function') return null;
    try { parent.appendChild(el); } catch { return null; }
    return el;
  }
  
  // GM_loadScript - Dynamically fetch and eval a script URL at runtime
  // Fetches via background service worker (bypasses CORS/CSP), evals in userscript scope
  // Masks module/define/exports to force UMD libraries to set globals on window
  const _loadedScripts = new Set();
  async function GM_loadScript(url, options = {}) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      throw new Error('GM_loadScript requires @grant GM_xmlhttpRequest');
    }
    if (!url) throw new Error('GM_loadScript: No URL provided');
    if (!options.force && _loadedScripts.has(url)) return;
    const result = await sendToBackground('GM_loadScript', { scriptId, url, timeout: options.timeout });
    if (!result || result.error) throw new Error('GM_loadScript: ' + (result?.error || 'request timed out'));
    // Temporarily mask module systems so UMD scripts create window globals
    const _savedModule = window.module;
    const _savedExports = window.exports;
    const _savedDefine = window.define;
    try {
      window.module = undefined;
      window.exports = undefined;
      window.define = undefined;
      const fn = new Function(result.code);
      fn.call(window);
    } finally {
      window.module = _savedModule;
      window.exports = _savedExports;
      window.define = _savedDefine;
    }
    _loadedScripts.add(url);
  }

  // GM_getTab / GM_saveTab / GM_getTabs (real implementations via background)
  let _tabData = {};
  function GM_getTab(callback) {
    if (!hasGrant('GM_getTab') && !hasGrant('GM.getTab')) { if (callback) callback(_tabData); return _tabData; }
    sendToBackground('GM_getTab', { scriptId }).then(data => {
      _tabData = data || {};
      if (callback) callback(_tabData);
    }).catch(() => { if (callback) callback(_tabData); });
    return _tabData;
  }
  function GM_saveTab(tab) {
    if (!hasGrant('GM_saveTab') && !hasGrant('GM.saveTab')) return;
    _tabData = tab || {};
    sendToBackground('GM_saveTab', { scriptId, data: _tabData }).catch(() => {});
  }
  function GM_getTabs(callback) {
    if (!hasGrant('GM_getTabs') && !hasGrant('GM.getTabs')) { if (callback) callback({}); return; }
    sendToBackground('GM_getTabs', { scriptId }).then(data => {
      if (callback) callback(data || {});
    }).catch(() => { if (callback) callback({}); });
  }

  function GM_focusTab() {
    if (!hasGrant('GM_focusTab') && !hasGrant('GM.focusTab') &&
        !hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return;
    sendToBackground('GM_focusTab', {}).catch(() => {});
  }

  // unsafeWindow
  const unsafeWindow = window;
  
  // Helper to wait for cache to be ready (used by async GM.* API)
  function _waitForCache() {
    if (_cacheReady) return Promise.resolve();
    if (!_cacheReadyPromise) {
      _cacheReadyPromise = new Promise(resolve => {
        _cacheReadyResolve = resolve;
      });
    }
    return _cacheReadyPromise;
  }
  
  // GM.* Promise-based API
  // These wait for storage to be refreshed before returning, ensuring fresh values
  // GM_cookie (list, set, delete)
  const GM_cookie = {
    list: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback([], new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_list', details || {}).then(r => {
        if (callback) callback(r?.cookies || [], r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback([], e); });
    },
    set: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_set', details || {}).then(r => {
        if (callback) callback(r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    delete: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_delete', details || {}).then(r => {
        if (callback) callback(r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    }
  };

  // Event listener for notification/download/tab close events from background
  // Content.js forwards these with 'type' field (not 'action') and flat structure (not nested 'data')
  window.addEventListener('message', function __svEventHandler(event) {
    if (!event.data || event.data.channel !== CHANNEL_ID || event.data.direction !== 'to-userscript') return;

    // Notification events (content.js sends: type, scriptId, notifTag, eventType)
    if (event.data.type === 'notificationEvent' && event.data.scriptId === scriptId) {
      const tag = event.data.notifTag;
      const cbs = _notifCallbacks.get(tag);
      if (!cbs) return;
      if (event.data.eventType === 'click' && cbs.onclick) { try { cbs.onclick(); } catch(e) {} }
      // Phase 11.11 — buttonClick fires onbuttonclick({buttonClickIndex}).
      if (event.data.eventType === 'buttonClick' && cbs.onbuttonclick) {
        try { cbs.onbuttonclick({ buttonClickIndex: event.data.buttonIndex | 0 }); } catch(e) {}
      }
      if (event.data.eventType === 'done') {
        if (cbs.ondone) { try { cbs.ondone(); } catch(e) {} }
        _notifCallbacks.delete(tag);
      }
    }

    // Download events (content.js sends: type, scriptId, downloadId, eventType, data)
    if (event.data.type === 'downloadEvent' && event.data.scriptId === scriptId) {
      const d = event.data.data || {};
      const cbs = _downloadCallbacks.get(event.data.downloadId);
      if (!cbs) return;
      const evType = event.data.eventType;
      if (evType === 'load' && cbs.onload) { try { cbs.onload({ url: d.url }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'error' && cbs.onerror) { try { cbs.onerror({ error: d.error }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'progress' && cbs.onprogress) { try { cbs.onprogress({ loaded: d.loaded, total: d.total }); } catch(e) {} }
      if (evType === 'timeout' && cbs.ontimeout) { try { cbs.ontimeout(); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
    }

    // Tab close events (content.js sends: type, scriptId, closedTabId)
    if (event.data.type === 'openedTabClosed' && event.data.scriptId === scriptId) {
      const tabId = event.data.closedTabId;
      const handle = _openedTabs.get(tabId);
      if (handle) {
        handle.closed = true;
        if (typeof handle.onclose === 'function') { try { handle.onclose(); } catch(e) {} }
        _openedTabs.delete(tabId);
      }
    }
  });

  // GM.* Promise-based API
  const GM = {
    info: GM_info,
    getValue: async (k, d) => {
      await _waitForCache();
      return GM_getValue(k, d);
    },
    setValue: (k, v) => Promise.resolve(GM_setValue(k, v)),
    deleteValue: (k) => Promise.resolve(GM_deleteValue(k)),
    listValues: async () => {
      await _waitForCache();
      return GM_listValues();
    },
    getValues: async (keys) => {
      await _waitForCache();
      return GM_getValues(keys);
    },
    setValues: (vals) => Promise.resolve(GM_setValues(vals)),
    deleteValues: (keys) => Promise.resolve(GM_deleteValues(keys)),
    addStyle: (css) => Promise.resolve(GM_addStyle(css)),
    xmlHttpRequest: (d) => {
      let control;
      const promise = new Promise((res, rej) => {
        control = GM_xmlhttpRequest({
          ...d,
          onload: (r) => { if (d.onload) d.onload(r); res(r); },
          onerror: (e) => { if (d.onerror) d.onerror(e); rej(e.error || e); },
          ontimeout: (e) => { if (d.ontimeout) d.ontimeout(e); rej(new Error('timeout')); },
          onabort: (e) => { if (d.onabort) d.onabort(e); rej(new Error('aborted')); }
        });
      });
      promise.abort = () => control.abort();
      return promise;
    },
    notification: (d, ondone) => Promise.resolve(GM_notification(d, ondone)),
    setClipboard: (t, type) => Promise.resolve(GM_setClipboard(t, type)),
    openInTab: (u, o) => Promise.resolve(GM_openInTab(u, o)),
    download: (d) => Promise.resolve(GM_download(d)),
    getResourceText: (n) => GM_getResourceText(n),
    getResourceUrl: (n) => GM_getResourceURL(n),
    registerMenuCommand: (c, cb, o) => Promise.resolve(GM_registerMenuCommand(c, cb, o)),
    unregisterMenuCommand: (id) => Promise.resolve(GM_unregisterMenuCommand(id)),
    addValueChangeListener: (k, cb) => Promise.resolve(GM_addValueChangeListener(k, cb)),
    removeValueChangeListener: (id) => Promise.resolve(GM_removeValueChangeListener(id)),
    getTab: () => new Promise(r => GM_getTab(r)),
    saveTab: (t) => Promise.resolve(GM_saveTab(t)),
    getTabs: () => new Promise(r => GM_getTabs(r)),
    loadScript: (url, opts) => GM_loadScript(url, opts),
    cookies: {
      list: (d) => new Promise((res, rej) => GM_cookie.list(d, (cookies, err) => err ? rej(err) : res(cookies))),
      set: (d) => new Promise((res, rej) => GM_cookie.set(d, (err) => err ? rej(err) : res())),
      delete: (d) => new Promise((res, rej) => GM_cookie.delete(d, (err) => err ? rej(err) : res()))
    }
  };

  // CRITICAL: Expose all GM_* functions to window for Tampermonkey/Violentmonkey compatibility
  window.GM_info = GM_info;
  window.GM_getValue = GM_getValue;
  window.GM_setValue = GM_setValue;
  window.GM_deleteValue = GM_deleteValue;
  window.GM_listValues = GM_listValues;
  window.GM_getValues = GM_getValues;
  window.GM_setValues = GM_setValues;
  window.GM_deleteValues = GM_deleteValues;
  window.GM_addStyle = GM_addStyle;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_head = GM_head;
  window.GM_setClipboard = GM_setClipboard;
  window.GM_notification = GM_notification;
  window.GM_updateNotification = GM_updateNotification;
  window.GM_closeNotification = GM_closeNotification;
  window.GM_openInTab = GM_openInTab;
  window.GM_download = GM_download;
  window.GM_log = GM_log;
  window.GM_registerMenuCommand = GM_registerMenuCommand;
  window.GM_unregisterMenuCommand = GM_unregisterMenuCommand;
  window.GM_getMenuCommands = GM_getMenuCommands;
  window.GM_getResourceText = GM_getResourceText;
  window.GM_getResourceURL = GM_getResourceURL;
  window.GM_addElement = GM_addElement;
  window.GM_loadScript = GM_loadScript;
  window.GM_getTab = GM_getTab;
  window.GM_saveTab = GM_saveTab;
  window.GM_getTabs = GM_getTabs;
  window.GM_addValueChangeListener = GM_addValueChangeListener;
  window.GM_removeValueChangeListener = GM_removeValueChangeListener;
  window.GM_cookie = GM_cookie;
  window.GM_focusTab = GM_focusTab;

  // ========== GM_webRequest (Tampermonkey-compatible, declarativeNetRequest-backed) ==========
  function GM_webRequest(rules, listener) {
    if (!hasGrant('GM_webRequest')) {
      console.warn('[ScriptVault] GM_webRequest requires @grant GM_webRequest');
      return;
    }
    const ruleArray = Array.isArray(rules) ? rules : [rules];
    sendToBackground('GM_webRequest', { rules: ruleArray }).catch(e =>
      console.warn('[ScriptVault] GM_webRequest failed:', e.message)
    );
    // listener is called with (info, message, details) when a rule matches;
    // declarativeNetRequest doesn't support runtime callbacks, so we no-op this.
    if (typeof listener === 'function') {
      console.info('[ScriptVault] GM_webRequest: runtime listener not supported in MV3 — use @webRequest metadata for static rules');
    }
  }
  window.GM_webRequest = GM_webRequest;

  window.unsafeWindow = unsafeWindow;
  window.GM = GM;

  // ========== window.onurlchange (SPA navigation detection) ==========
  // Tampermonkey-compatible: fires when URL changes via pushState/replaceState/popstate.
  //
  // Phase 40.11 — Page-scoped monkey-patch + shared dispatcher.
  //
  // Previously every wrapper registration patched history.pushState / replaceState,
  // added popstate / hashchange listeners, and Proxied window.addEventListener /
  // removeEventListener on its own. Re-injection (script update applied while the
  // host tab is open) stacked new patches on top of the old ones; old wrap's
  // _urlChangeHandlers closures stayed reachable in the proxy chain forever.
  //
  // Now the page-level monkey-patch runs at most once per host tab, gated by
  // window.__svUrlChangeBound__ (non-enumerable, non-writable). The patch fires
  // a CustomEvent('__sv_urlchange__') on every URL change; each script's wrapper
  // attaches its own per-script listener to that event, scoped to its own
  // _urlChangeHandlers array. On the next re-injection, the page-level guard
  // short-circuits — only the per-script listener is re-attached, and the old
  // one is implicitly orphaned with the previous wrapper's closure.
  if (hasGrant('window.onurlchange')) {
    const _urlChangeHandlers = [];

    function __dispatchUrlChangeToHandlers(detail) {
      _urlChangeHandlers.forEach(fn => { try { fn(detail); } catch (e) {} });
      if (typeof window.onurlchange === 'function') {
        try { window.onurlchange(detail); } catch (e) {}
      }
    }

    // One-time page-level setup. The defineProperty guard survives the
    // wrapper-closure swap on re-injection.
    if (!window.__svUrlChangeBound__) {
      try {
        Object.defineProperty(window, '__svUrlChangeBound__', {
          value: true, writable: false, configurable: false, enumerable: false
        });
      } catch (_e) {
        // Property already locked by an earlier ScriptVault wrapper; treat as bound.
      }

      let _lastUrl = location.href;
      function __checkUrlChange() {
        const newUrl = location.href;
        if (newUrl !== _lastUrl) {
          const oldUrl = _lastUrl;
          _lastUrl = newUrl;
          const detail = { url: newUrl, oldUrl };
          // Fan out to every wrapper that subscribed.
          window.dispatchEvent(new CustomEvent('__sv_urlchange__', { detail }));
        }
      }

      // Phase 38.6 — Native Navigation API (Chrome 102+, our min-Chrome is
      // 130 so always present in supported Chromium builds; missing on
      // Safari and older Firefox where the polling shim below still wins).
      // The 'navigate' event fires for every SPA navigation including
      // direct location assignment, which the pushState/replaceState patch
      // misses, and runs in microtask order so the dispatch lands before
      // the next page paint. Falls through to the polling shim if the API
      // is missing (Firefox port path).
      const _nav = (typeof window !== 'undefined') ? window.navigation : undefined;
      if (_nav && typeof _nav.addEventListener === 'function') {
        try {
          _nav.addEventListener('navigate', (event) => {
            // Schedule on a microtask so location.href reflects the new URL
            // by the time __checkUrlChange reads it. The navigate event
            // fires BEFORE the document URL updates for traverse-style
            // navigations, but always before render.
            Promise.resolve().then(__checkUrlChange);
          });
        } catch (_e) { /* fall through to polling shim */ }
      }

      const _origPushState = history.pushState;
      const _origReplaceState = history.replaceState;
      history.pushState = function () {
        _origPushState.apply(this, arguments);
        __checkUrlChange();
      };
      history.replaceState = function () {
        _origReplaceState.apply(this, arguments);
        __checkUrlChange();
      };
      window.addEventListener('popstate', __checkUrlChange);
      window.addEventListener('hashchange', __checkUrlChange);
    }

    // Per-script subscription to the page-level event. Detaches itself if the
    // wrapper IIFE returns or throws (the closure becomes unreachable; the
    // function reference passed to addEventListener is its only liveness root).
    const __svUrlChangeListener = (event) => __dispatchUrlChangeToHandlers(event.detail);
    window.addEventListener('__sv_urlchange__', __svUrlChangeListener);

    // Allow adding multiple per-script handlers via the addEventListener pattern.
    // The Proxy is per-wrapper; re-injection installs a new proxy on the prior
    // (possibly-still-proxied) addEventListener. Each layer only intercepts
    // 'urlchange' and forwards everything else, so the chain stays correct.
    window.addEventListener = new Proxy(window.addEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          if (!_urlChangeHandlers.includes(args[1])) {
            _urlChangeHandlers.push(args[1]);
          }
          return;
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    window.removeEventListener = new Proxy(window.removeEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          const idx = _urlChangeHandlers.indexOf(args[1]);
          if (idx >= 0) _urlChangeHandlers.splice(idx, 1);
          return;
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    if (typeof window.onurlchange === 'undefined') window.onurlchange = null;
  }

  // ========== window.close / window.focus grants ==========
  if (hasGrant('window.close')) {
    // Already available in USER_SCRIPT world, but explicitly expose
    window.close = window.close.bind(window);
  }
  if (hasGrant('window.focus')) {
    window.focus = window.focus.bind(window);
  }

  // ========== GM_audio API (Tampermonkey-compatible tab mute control) ==========
  const GM_audio = {
    setMute: (details, callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(new Error('Permission denied')); return; }
      sendToBackground('GM_audio_setMute', { mute: details?.mute ?? details }).then(r => {
        if (callback) callback(r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    getState: (callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(null, new Error('Permission denied')); return; }
      sendToBackground('GM_audio_getState', {}).then(r => {
        if (callback) callback(r, r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(null, e); });
    },
    _listeners: [],
    _watching: false,
    _msgHandler: null,
    addStateChangeListener: (listener, callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(new Error('Permission denied')); return; }
      GM_audio._listeners.push(listener);
      if (!GM_audio._watching) {
        GM_audio._watching = true;
        sendToBackground('GM_audio_watchState', {});
        // Listen for audio state change events from content script bridge
        GM_audio._msgHandler = (e) => {
          if (e.source !== window || !e.data || e.data.channel !== CHANNEL_ID) return;
          if (e.data.type === 'audioStateChanged') {
            const state = e.data.data;
            for (const fn of GM_audio._listeners) {
              try { fn(state); } catch (err) { console.error('[GM_audio listener]', err); }
            }
          }
        };
        window.addEventListener('message', GM_audio._msgHandler);
      }
      if (callback) callback();
    },
    removeStateChangeListener: (listener, callback) => {
      const idx = GM_audio._listeners.indexOf(listener);
      if (idx >= 0) GM_audio._listeners.splice(idx, 1);
      if (GM_audio._listeners.length === 0 && GM_audio._watching) {
        GM_audio._watching = false;
        if (GM_audio._msgHandler) {
          window.removeEventListener('message', GM_audio._msgHandler);
          GM_audio._msgHandler = null;
        }
        sendToBackground('GM_audio_unwatchState', {});
      }
      if (callback) callback();
    }
  };
  window.GM_audio = GM_audio;

  // ========== DOM HELPER FUNCTIONS ==========
  // These help userscripts handle DOM timing issues gracefully
  // Use these when document.body/head might not exist yet
  
  // Wait for any element matching selector to appear in DOM
  function __waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      
      let resolved = false;
      const observer = new MutationObserver((mutations, obs) => {
        if (resolved) return;
        const el = document.querySelector(selector);
        if (el) {
          resolved = true;
          obs.disconnect();
          resolve(el);
        }
      });
      
      // Start observing - handle case where documentElement might not exist yet
      const root = document.documentElement || document;
      if (root && typeof root.nodeType !== 'undefined') {
        observer.observe(root, { childList: true, subtree: true });
      }
      
      // Timeout with final check
      setTimeout(() => {
        if (resolved) return;
        observer.disconnect();
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
        } else {
          reject(new Error('[ScriptVault] Timeout waiting for element: ' + selector));
        }
      }, timeout);
    });
  }
  
  // Wait for document.body to be available
  function __waitForBody(timeout = 10000) {
    if (document.body) return Promise.resolve(document.body);
    return __waitForElement('body', timeout);
  }
  
  // Wait for document.head to be available
  function __waitForHead(timeout = 10000) {
    if (document.head) return Promise.resolve(document.head);
    return __waitForElement('head', timeout);
  }
  
  // Safe MutationObserver that waits for target element to exist
  // Prevents "parameter 1 is not of type 'Node'" errors
  function __safeObserve(target, options, callback) {
    // Handle selector string or element
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    
    // If element exists and is valid, observe immediately
    if (element && element.nodeType === Node.ELEMENT_NODE) {
      const observer = new MutationObserver(callback);
      observer.observe(element, options);
      return { observer, promise: Promise.resolve(observer) };
    }
    
    // Element doesn't exist yet - wait for it
    const selectorToWait = typeof target === 'string' ? target : 'body';
    const promise = __waitForElement(selectorToWait)
      .then(el => {
        const observer = new MutationObserver(callback);
        observer.observe(el, options);
        return observer;
      })
      .catch(() => null);
    
    return { observer: null, promise };
  }
  
  // Expose DOM helpers to window for userscripts to use
  window.__ScriptVault_waitForElement = __waitForElement;
  window.__ScriptVault_waitForBody = __waitForBody;
  window.__ScriptVault_waitForHead = __waitForHead;
  window.__ScriptVault_safeObserve = __safeObserve;

  // Also expose as shorter aliases
  window.waitForElement = __waitForElement;
  window.waitForBody = __waitForBody;
  window.waitForHead = __waitForHead;
  window.safeObserve = __safeObserve;

  // ========== Network Proxy (full capture: fetch, XHR, WebSocket, sendBeacon) ==========
  // Intercepts all network calls made by this script and logs them to the network log.
  // Logs are viewable in the DevTools panel and the dashboard Network Log.
  (function __svNetProxy() {
    const _scriptName = ${JSON.stringify(meta.name || script.id)};
    const _scriptId = ${JSON.stringify(script.id)};

    function _log(entry) {
      sendToBackground('netlog_record', { scriptId: _scriptId, scriptName: _scriptName, ...entry }).catch(() => {});
    }

    function _safeSet(target, prop, value) {
      try {
        Object.defineProperty(target, prop, { configurable: true, writable: true, value });
        return true;
      } catch (e) {
        try {
          target[prop] = value;
          return target[prop] === value;
        } catch (e2) {
          return false;
        }
      }
    }

    // ── fetch ──────────────────────────────────────────────────────────────
    const _origFetch = window.fetch;
    if (typeof _origFetch === 'function') {
      _safeSet(window, 'fetch', function __svFetch(input, init) {
        const method = (init?.method || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : input?.url || String(input);
        const t0 = performance.now();
        return _origFetch.apply(this, arguments).then(resp => {
          const duration = Math.round(performance.now() - t0);
          const cl = parseInt(resp.headers.get('content-length') || '0') || 0;
          _log({ type: 'fetch', method, url, status: resp.status, statusText: resp.statusText, duration, responseSize: cl, responseHeaders: Object.fromEntries(resp.headers.entries()) });
          return resp;
        }, err => {
          const duration = Math.round(performance.now() - t0);
          _log({ type: 'fetch', method, url, error: err?.message || String(err), duration });
          throw err;
        });
      });
    }

    // ── XMLHttpRequest ─────────────────────────────────────────────────────
    const _OrigXHR = window.XMLHttpRequest;
    if (typeof _OrigXHR === 'function') {
      const _WrappedXHR = function __svXHR() {
        const xhr = new _OrigXHR();
        let _method = 'GET', _url = '', _t0 = 0;
        const _origOpen = xhr.open.bind(xhr);
        xhr.open = function(method, url) {
          _method = (method || 'GET').toUpperCase();
          _url = String(url);
          return _origOpen.apply(this, arguments);
        };
        const _origSend = xhr.send.bind(xhr);
        xhr.send = function() {
          _t0 = performance.now();
          xhr.addEventListener('loadend', () => {
            const duration = Math.round(performance.now() - _t0);
            if (xhr.status) {
              _log({ type: 'xhr', method: _method, url: _url, status: xhr.status, statusText: xhr.statusText, duration, responseSize: (xhr.responseText || '').length });
            } else {
              _log({ type: 'xhr', method: _method, url: _url, error: 'Request failed', duration });
            }
          }, { once: true });
          return _origSend.apply(this, arguments);
        };
        return xhr;
      };
      _WrappedXHR.prototype = _OrigXHR.prototype;
      _safeSet(window, 'XMLHttpRequest', _WrappedXHR);
    }

    // ── WebSocket ──────────────────────────────────────────────────────────
    const _OrigWS = window.WebSocket;
    if (typeof _OrigWS === 'function') {
      const _WrappedWS = function __svWebSocket(url, protocols) {
        const ws = protocols ? new _OrigWS(url, protocols) : new _OrigWS(url);
        const t0 = performance.now();
        let bytesSent = 0, bytesRecv = 0;
        ws.addEventListener('open', () => {
          _log({ type: 'websocket', method: 'WS', url: String(url), status: 101, statusText: 'Switching Protocols', duration: Math.round(performance.now() - t0) });
        });
        ws.addEventListener('message', e => { bytesRecv += (e.data?.length || 0); });
        ws.addEventListener('close', e => {
          _log({ type: 'websocket', method: 'WS_CLOSE', url: String(url), status: e.code, duration: Math.round(performance.now() - t0), responseSize: bytesRecv });
        });
        const _origSendWS = ws.send.bind(ws);
        ws.send = function(data) { bytesSent += (data?.length || 0); return _origSendWS(data); };
        return ws;
      };
      _WrappedWS.prototype = _OrigWS.prototype;
      Object.assign(_WrappedWS, {
        CONNECTING: _OrigWS.CONNECTING ?? 0,
        OPEN: _OrigWS.OPEN ?? 1,
        CLOSING: _OrigWS.CLOSING ?? 2,
        CLOSED: _OrigWS.CLOSED ?? 3
      });
      _safeSet(window, 'WebSocket', _WrappedWS);
    }

    // ── sendBeacon ─────────────────────────────────────────────────────────
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const _origBeacon = navigator.sendBeacon.bind(navigator);
      _safeSet(navigator, 'sendBeacon', function __svBeacon(url, data) {
        const result = _origBeacon(url, data);
        const size = data ? (typeof data === 'string' ? data.length : (data?.byteLength || data?.size || 0)) : 0;
        _log({ type: 'beacon', method: 'POST', url: String(url), status: result ? 200 : 0, duration: 0, responseSize: size });
        return result;
      });
    }
  })();
  // ========== End Network Proxy ==========

  // GM APIs exposed log disabled for performance
  // console.log('[ScriptVault] GM APIs exposed to window for:', meta.name);

  // ============ @require Scripts ============
  // These run after GM APIs are available on window
${requireCode}
${libraryExports}
  // ============ End @require Scripts ============

  // Wait for storage to be refreshed, then execute the userscript
  // This ensures scripts see fresh values when using GM_getValue
  (async function __scriptMonkeyRunner() {
    await _waitForCache();
    const __startTime = performance.now();
    try {
`;

  const apiClose = `
    } catch (e) {
      // Report error to background for profiling
      sendToBackground('reportExecError', { scriptId, error: (e?.message || String(e)).slice(0, 200) }).catch(() => {});
    } finally {
      // Report execution time to background for profiling
      const __elapsed = Math.round((performance.now() - __startTime) * 100) / 100;
      sendToBackground('reportExecTime', { scriptId, time: __elapsed, url: location.href }).catch(() => {});
    }
  })();
})();
`;

  // @top-level-await: wrap user code in async IIFE so top-level await works
  let userCode = meta['top-level-await']
    ? `(async () => {\n${script.code}\n})();`
    : script.code;

  // @delay: postpone script execution by N milliseconds
  if (meta.delay > 0) {
    userCode = `setTimeout(() => {\n${userCode}\n}, ${meta.delay});`;
  }

  // Phase 11.2 — `// @unwrap` (Violentmonkey parity).
  // When set, emit the script body verbatim without the GM API IIFE wrapper.
  // Useful for ESM-style top-level imports/exports and scripts that
  // intentionally modify the top-level scope. GM_* APIs are NOT available
  // in this mode (no apiInit/apiClose); we log a one-line console.warn so
  // authors who set @unwrap by mistake can spot it. Console-capture and
  // error suppression are also disabled in this mode.
  if (meta.unwrap === true) {
    // JSON.stringify produces a properly-escaped double-quoted JS string.
    // Don't slice off the quotes — a name like "John's Script" contains a
    // single quote, which the previous slice-based interpolation surfaced
    // verbatim into a single-quoted host string and broke the wrapper's
    // syntax. The full JSON-quoted form is a valid JS string literal.
    const nameLit = JSON.stringify(meta.name || 'Unnamed');
    const banner = `console.warn('[ScriptVault] ' + ${nameLit} + ': @unwrap is set — GM_* APIs are unavailable.');`;
    return banner + '\n' + userCode;
  }

  return apiInit + userCode + apiClose;
}

// Helper: Check if a pattern is a valid match pattern
function isValidMatchPattern(pattern) {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;

  // Match pattern validation (allows ports: http://localhost:3000/*)
  const matchRegex = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*:]+(?::\d+)?)\/.*$/;
  return matchRegex.test(pattern);
}

// Check if a pattern is a regex @include (wrapped in /regex/)
function isRegexPattern(pattern) {
  if (!pattern || !pattern.startsWith('/') || pattern.length <= 2) return false;
  const match = pattern.match(/^\/(.+?)\/([gimsuy]*)$/);
  if (!match) return false;
  // Require at least one regex metacharacter to distinguish from plain URL paths like /path/to/file/
  return /[\\^$\[(+?{|]/.test(match[1]);
}

// Parse a regex @include pattern string into a RegExp object
function parseRegexPattern(pattern) {
  const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (!match) return null;
  try {
    return new RegExp(match[1], match[2]);
  } catch (e) {
    return null;
  }
}

// Extract broad match patterns from a regex to use for Chrome registration
// The actual fine-grained filtering happens at runtime in the injected wrapper
function extractMatchPatternsFromRegex(regexStr) {
  // Remove the /.../ wrapper and flags
  const inner = regexStr.replace(/^\//, '').replace(/\/[gimsuy]*$/, '');
  const patterns = [];

  // Strategy 1: Find domain patterns like "name\.(tld1|tld2|tld3)" or "name\.tld"
  // Handles: 1337x\.(to|st|ws|eu|se|is|gd|unblocked\.dk)
  const domainWithAlts = /([a-z0-9][-a-z0-9]*)\\\.\(([^)]+)\)/gi;
  let match;
  while ((match = domainWithAlts.exec(inner)) !== null) {
    const base = match[1];
    const altsRaw = match[2];
    // Split alternatives, handling escaped dots within them (e.g. unblocked\.dk)
    const alts = altsRaw.split('|').map(a => a.replace(/\\\./g, '.'));
    for (const alt of alts) {
      // Only use clean TLD/domain alternatives (no regex metacharacters)
      if (/^[a-z0-9][-a-z0-9.]*$/i.test(alt) && alt.length >= 2 && alt.length <= 30) {
        patterns.push(`*://*.${base}.${alt}/*`);
        patterns.push(`*://${base}.${alt}/*`);
      }
    }
  }

  // Strategy 2: Find simple "domain\.tld" patterns not inside groups
  const simpleDomain = /(?:^|\/\/)(?:\([^)]*\))?([a-z0-9][-a-z0-9]*(?:\\\.)[a-z]{2,10})(?:[\\\/\$\)]|$)/gi;
  while ((match = simpleDomain.exec(inner)) !== null) {
    const domain = match[1].replace(/\\\./g, '.');
    if (/^[a-z0-9][-a-z0-9]*\.[a-z]{2,10}$/i.test(domain)) {
      patterns.push(`*://*.${domain}/*`);
      patterns.push(`*://${domain}/*`);
    }
  }

  // Deduplicate
  return [...new Set(patterns)];
}

// Helper: Convert @include glob to @match pattern
function convertIncludeToMatch(include) {
  if (!include) return null;
  
  // If it's already a valid match pattern, return it
  if (isValidMatchPattern(include)) return include;
  
  // Handle common patterns
  if (include === '*') return '<all_urls>';
  
  // Try to convert glob to match pattern
  // Replace ** with * and handle http/https
  let pattern = include;
  
  // Handle patterns like *://example.com/*
  if (pattern.startsWith('*://')) {
    const afterScheme = pattern.slice(4);
    if (!afterScheme.includes('/')) pattern += '/*';
    return isValidMatchPattern(pattern) ? pattern : null;
  }

  // Handle patterns like http://example.com/*
  if (pattern.match(/^https?:\/\//)) {
    if (!pattern.includes('/*') && !pattern.endsWith('/')) pattern += '/*';
    return isValidMatchPattern(pattern) ? pattern : null;
  }

  // Handle patterns like *.example.com
  if (pattern.startsWith('*.')) {
    const result = '*://' + pattern + '/*';
    return isValidMatchPattern(result) ? result : null;
  }

  // Handle patterns like example.com
  if (!pattern.includes('://') && !pattern.startsWith('/')) {
    const result = '*://' + pattern + '/*';
    return isValidMatchPattern(result) ? result : null;
  }

  return null;
}

// MV3 cold-start guard: store the init promise on self so all event listeners
// (onMessage, onAlarm, onCommand, onTab*) can await it before touching state.
// Without this, an event firing during the SW wake races init() and hits
// handlers before ScriptStorage / SettingsManager are ready.
self._initPromise = init();
function ensureInitialized() {
  if (!self._initPromise) self._initPromise = init();
  return self._initPromise;
}
self.ensureInitialized = ensureInitialized;
