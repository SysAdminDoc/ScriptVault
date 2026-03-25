// ScriptVault v2.0.0 - Background Service Worker
// Comprehensive userscript manager with cloud sync and auto-updates
// NOTE: This file is built from source modules. Edit the individual files in
// shared/, modules/, and lib/, then run build-background.sh to regenerate.

// @ts-check
// ScriptVault Shared Utilities
// Used by background.js (inlined at build time) and HTML pages (via <script src>)

/**
 * Escape HTML special characters to prevent XSS.
 * Works in both DOM (pages) and non-DOM (service worker) contexts.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a unique script ID using crypto.randomUUID().
 * @returns {string} A unique ID prefixed with 'script_'
 */
function generateId() {
  return 'script_' + crypto.randomUUID();
}

/**
 * Validate and sanitize a URL for safe use in href attributes.
 * Returns the URL if safe, or null if potentially dangerous.
 * @param {string} url - The URL to sanitize
 * @returns {string|null} The sanitized URL or null if unsafe
 */
function sanitizeUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript|blob):/i.test(trimmed)) return null;
  if (/^(https?|ftp|mailto):/i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Format byte count as human-readable string.
 * @param {number} bytes - The byte count to format
 * @returns {string} Human-readable string like '1.5 MB'
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================================
// INLINED: fflate v0.8.2 - Browser-only ZIP library
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
    ,
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
        if (ev.data.length) {
            strm.push(ev.data[0], ev.data[1]);
            postMessage([ev.data[0].length]);
        }
        else
            strm.flush();
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
        w.postMessage([d, t = f], [d.buffer]);
    };
    strm.terminate = function () { w.terminate(); };
    if (flush) {
        strm.flush = function () { w.postMessage([]); };
    }
};
// read 2 bytes
var b2 = function (d, b) { return d[b] | (d[b + 1] << 8); };
// read 4 bytes
var b4 = function (d, b) { return (d[b] | (d[b + 1] << 8) | (d[b + 2] << 16) | (d[b + 3] << 24)) >>> 0; };
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
    };
    /**
     * Flushes buffered uncompressed data. Useful to immediately retrieve the
     * deflated output for small inputs.
     */
    Deflate.prototype.flush = function () {
        if (!this.ondata)
            err(5);
        if (this.s.l)
            err(4);
        this.p(this.b, false);
        this.s.w = this.s.i, this.s.i -= 2;
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
/**
 * Expands DEFLATE data with no wrapper
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
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
     */
    Gzip.prototype.flush = function () {
        Deflate.prototype.flush.call(this);
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
        Inflate.prototype.c.call(this, final);
        // process concatenated GZIP
        if (this.s.f && !this.s.l && !final) {
            this.v = shft(this.s.p) + 9;
            this.s = { i: 0 };
            this.o = new u8(0);
            this.push(new u8(0), final);
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
/**
 * Expands GZIP data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
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
     */
    Zlib.prototype.flush = function () {
        Deflate.prototype.flush.call(this);
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
/**
 * Expands Zlib data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
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
        if (val instanceof u8)
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
    var fnl = b2(d, b + 28), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl, bs = b4(d, b + 20);
    var _a = z && bs == 4294967295 ? z64e(d, es) : [bs, b4(d, b + 24), b4(d, b + 42)], sc = _a[0], su = _a[1], off = _a[2];
    return [b2(d, b + 10), sc, su, fn, es + b2(d, b + 30) + b2(d, b + 32), off];
};
// read zip64 extra field
var z64e = function (d, b) {
    for (; b2(d, b) != 1; b += 4 + b2(d, b + 2))
        ;
    return [b8(d, b + 12), b8(d, b + 4), b8(d, b + 20)];
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
    UnzipPassThrough.prototype.push = function (data, final) {
        this.ondata(null, data, final);
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
    UnzipInflate.prototype.push = function (data, final) {
        try {
            this.i.push(data, final);
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
    AsyncUnzipInflate.prototype.push = function (data, final) {
        if (this.i.terminate)
            data = slc(data, 0);
        this.i.push(data, final);
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
                var _a;
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
                        var sc_1 = b4(buf, i + 18), su_1 = b4(buf, i + 22);
                        var fn_1 = strFromU8(buf.subarray(i + 30, i += 30 + fnl), !u);
                        if (sc_1 == 4294967295) {
                            _a = dd ? [-2] : z64e(buf, i), sc_1 = _a[0], su_1 = _a[1];
                        }
                        else if (dd)
                            sc_1 = -1;
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
        var z = o == 4294967295 || c == 65535;
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
    var z = o == 4294967295 || c == 65535;
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
// INLINED: cloud-sync.js - Cloud Sync Providers
// (inlined to bypass Chrome service worker importScripts caching)
// ============================================================================
var CloudSyncProviders = {
  // ============================================================================
  // WebDAV Provider
  // ============================================================================
  webdav: {
    name: 'WebDAV',
    icon: '☁️',
    requiresAuth: true,
    
    async upload(data, settings) {
      if (!settings.webdavUrl) throw new Error('WebDAV URL is required');
      const url = `${settings.webdavUrl.replace(/\/$/, '')}/scriptvault-backup.json`;
      const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
      return { success: true, timestamp: Date.now() };
    },
    
    async download(settings) {
      if (!settings.webdavUrl) throw new Error('WebDAV URL is required');
      const url = `${settings.webdavUrl.replace(/\/$/, '')}/scriptvault-backup.json`;
      const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
      });
      
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`WebDAV download failed: HTTP ${response.status}`);
      
      return await response.json();
    },
    
    async test(settings) {
      try {
        const url = settings.webdavUrl.replace(/\/$/, '');
        const auth = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);
        
        const response = await fetch(url, {
          method: 'PROPFIND',
          headers: { 'Authorization': `Basic ${auth}`, 'Depth': '0' }
        });
        
        return { success: response.ok || response.status === 207 };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },

  // ============================================================================
  // Google Drive Provider
  // ============================================================================
  googledrive: {
    name: 'Google Drive',
    icon: '📁',
    requiresOAuth: true,
    fileName: 'scriptvault-backup.json',
    // Google OAuth client ID (public, installed-app type)
    // Users can override via settings.googleClientId
    clientId: '287129963438-mcc1mod1m5jm8vjr3icb7ensdtcfq44l.apps.googleusercontent.com',

    async getToken() {
      const settings = await SettingsManager.get();
      return settings.googleDriveToken || null;
    },

    async refreshToken() {
      const settings = await SettingsManager.get();
      const refreshToken = settings.googleDriveRefreshToken;
      if (!refreshToken) return null;

      const clientId = settings.googleClientId || this.clientId;
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!resp.ok) {
        console.warn('[CloudSync] Google token refresh failed:', resp.status);
        return null;
      }
      const data = await resp.json();
      if (data.access_token) {
        await SettingsManager.set({ googleDriveToken: data.access_token });
        if (data.refresh_token) {
          await SettingsManager.set({ googleDriveRefreshToken: data.refresh_token });
        }
        return data.access_token;
      }
      return null;
    },

    async getValidToken() {
      let token = await this.getToken();
      if (!token) return null;

      // Test if token is still valid
      const test = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (test.ok) return token;

      // Try refresh
      token = await this.refreshToken();
      return token;
    },

    async connect() {
      try {
        const settings = await SettingsManager.get();
        const clientId = settings.googleClientId || this.clientId;
        const redirectUri = chrome.identity.getRedirectURL();
        const scopes = [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ].join(' ');

        // PKCE code verifier
        const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
          b => b.toString(16).padStart(2, '0')).join('');
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scopes,
          access_type: 'offline',
          prompt: 'consent',
          code_challenge: codeChallenge,
          code_challenge_method: 'S256'
        }).toString();

        const responseUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        });

        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        if (!code) throw new Error('No authorization code received');

        // Exchange code for tokens
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            code: code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
          })
        });

        if (!tokenResp.ok) {
          const err = await tokenResp.text();
          throw new Error('Token exchange failed: ' + err);
        }

        const tokens = await tokenResp.json();

        // Get user info
        const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        const user = userResp.ok ? await userResp.json() : {};

        await SettingsManager.set({
          googleDriveToken: tokens.access_token,
          googleDriveRefreshToken: tokens.refresh_token || settings.googleDriveRefreshToken || '',
          googleDriveConnected: true,
          googleDriveUser: { email: user.email, name: user.name }
        });

        return {
          success: true,
          user: { email: user.email, name: user.name, picture: user.picture }
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async disconnect() {
      try {
        const token = await this.getToken();
        if (token) {
          await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
        }
        await SettingsManager.set({
          googleDriveToken: '',
          googleDriveRefreshToken: '',
          googleDriveConnected: false,
          googleDriveUser: null
        });
      } catch (e) {
        console.warn('[CloudSync] Google disconnect error:', e);
      }
      return { success: true };
    },

    async findFile(token) {
      // Search in root and appDataFolder
      const query = encodeURIComponent(`name='${this.fileName}' and trashed=false`);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error(`Failed to search files: ${response.status}`);
      const data = await response.json();
      return data.files?.[0] || null;
    },

    async upload(data, settings) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with Google Drive');

      const existingFile = await this.findFile(token);
      const metadata = {
        name: this.fileName,
        mimeType: 'application/json'
      };

      const boundary = '-------ScriptVault' + crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        JSON.stringify(data),
        `--${boundary}--`
      ].join('\r\n');

      const url = existingFile
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const response = await fetch(url, {
        method: existingFile ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      return { success: true, timestamp: Date.now() };
    },

    async download(settings) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with Google Drive');

      const file = await this.findFile(token);
      if (!file) return null;

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return await response.json();
    },

    async test(settings) {
      try {
        const token = await this.getValidToken();
        if (!token) return { success: false, error: 'Not authenticated' };

        const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        return { success: response.ok };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async getStatus(settings) {
      try {
        if (!settings) settings = await SettingsManager.get();
        if (!settings.googleDriveConnected || !settings.googleDriveToken) {
          return { connected: false };
        }

        const token = await this.getValidToken();
        if (!token) return { connected: false };

        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return { connected: false };

        const user = await response.json();
        return { connected: true, user: { email: user.email, name: user.name } };
      } catch (e) {
        return { connected: false };
      }
    }
  },

  // ============================================================================
  // Dropbox Provider
  // ============================================================================
  dropbox: {
    name: 'Dropbox',
    icon: '📦',
    requiresOAuth: true,
    fileName: '/scriptvault-backup.json',
    
    async connect(settings) {
      if (!settings.dropboxClientId) {
        throw new Error('Dropbox App Key is required. Create one at https://www.dropbox.com/developers/apps');
      }

      const clientId = settings.dropboxClientId;
      const redirectUri = chrome.identity.getRedirectURL('dropbox');

      // PKCE code verifier + challenge
      const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
        b => b.toString(16).padStart(2, '0')).join('');
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // CSRF state parameter
      const state = Array.from(crypto.getRandomValues(new Uint8Array(16)),
        b => b.toString(16).padStart(2, '0')).join('');

      const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        token_access_type: 'offline',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state
      }).toString();

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });

      const url = new URL(responseUrl);
      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) {
        throw new Error('OAuth state mismatch - possible CSRF attack');
      }
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorization code received');

      // Exchange code for tokens
      const tokenResp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      if (!tokenResp.ok) {
        const err = await tokenResp.text();
        throw new Error('Token exchange failed: ' + err);
      }

      const tokens = await tokenResp.json();
      return {
        success: true,
        token: tokens.access_token,
        refreshToken: tokens.refresh_token || ''
      };
    },
    
    async refreshToken(settings) {
      const refreshTok = settings.dropboxRefreshToken;
      const clientId = settings.dropboxClientId;
      if (!refreshTok || !clientId) return null;

      const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshTok
        })
      });

      if (!resp.ok) {
        console.warn('[CloudSync] Dropbox token refresh failed:', resp.status);
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
      if (!settings.dropboxToken) return null;
      // Test current token
      const test = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
      });
      if (test.ok) return settings.dropboxToken;
      // Try refresh
      return await this.refreshToken(settings);
    },

    async disconnect(settings) {
      if (settings.dropboxToken) {
        try {
          await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
          });
        } catch (e) {
          console.warn('[CloudSync] Dropbox revoke error:', e);
        }
      }
      return { success: true };
    },

    async upload(data, settings) {
      if (!settings.dropboxToken) throw new Error('Not authenticated with Dropbox');
      
      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.dropboxToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: this.fileName,
            mode: 'overwrite',
            autorename: false,
            mute: true
          }),
          'Content-Type': 'application/octet-stream'
        },
        body: JSON.stringify(data)
      });
      
      if (response.status === 401) throw new Error('Dropbox token expired. Please reconnect.');
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }
      
      return { success: true, timestamp: Date.now() };
    },
    
    async download(settings) {
      if (!settings.dropboxToken) throw new Error('Not authenticated with Dropbox');
      
      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.dropboxToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: this.fileName })
        }
      });
      
      if (response.status === 409) return null; // File not found
      if (response.status === 401) throw new Error('Dropbox token expired. Please reconnect.');
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      
      return await response.json();
    },
    
    async test(settings) {
      if (!settings.dropboxToken) return { success: false, error: 'Not authenticated' };
      
      try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
        });
        
        if (response.status === 401) return { success: false, error: 'Token expired' };
        return { success: response.ok };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    
    async getStatus(settings) {
      if (!settings) settings = await SettingsManager.get();
      if (!settings.dropboxToken) return { connected: false };

      try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${settings.dropboxToken}` }
        });

        if (!response.ok) return { connected: false };

        const user = await response.json();
        return {
          connected: true,
          user: { email: user.email, name: user.name?.display_name || user.display_name || '' }
        };
      } catch (e) {
        return { connected: false };
      }
    }
  },

  // ============================================================================
  // OneDrive Provider
  // ============================================================================
  onedrive: {
    name: 'OneDrive',
    icon: '📁',
    requiresOAuth: true,
    fileName: 'scriptvault-backup.json',
    // Microsoft OAuth - users must provide their own client ID from Azure AD
    // Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps

    async connect(settings) {
      const clientId = settings.onedriveClientId;
      if (!clientId) {
        throw new Error('OneDrive Client ID required. Create one at https://portal.azure.com → App registrations');
      }
      const redirectUri = chrome.identity.getRedirectURL('onedrive');
      const scopes = 'Files.ReadWrite.AppFolder User.Read offline_access';

      const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
        b => b.toString(16).padStart(2, '0')).join('');
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const authUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      }).toString();

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl, interactive: true
      });

      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorization code received');

      const tokenResp = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: scopes
        })
      });

      if (!tokenResp.ok) throw new Error('Token exchange failed: ' + await tokenResp.text());
      const tokens = await tokenResp.json();

      const userResp = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      const user = userResp.ok ? await userResp.json() : {};

      await SettingsManager.set({
        onedriveToken: tokens.access_token,
        onedriveRefreshToken: tokens.refresh_token || '',
        onedriveConnected: true,
        onedriveUser: { email: user.mail || user.userPrincipalName || '', name: user.displayName || '' }
      });

      return { success: true, user: { email: user.mail || user.userPrincipalName, name: user.displayName } };
    },

    async refreshToken() {
      const settings = await SettingsManager.get();
      const refreshTok = settings.onedriveRefreshToken;
      const clientId = settings.onedriveClientId;
      if (!refreshTok || !clientId) return null;

      const resp = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshTok,
          scope: 'Files.ReadWrite.AppFolder User.Read offline_access'
        })
      });

      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.access_token) {
        await SettingsManager.set({
          onedriveToken: data.access_token,
          onedriveRefreshToken: data.refresh_token || refreshTok
        });
        return data.access_token;
      }
      return null;
    },

    async getValidToken() {
      const settings = await SettingsManager.get();
      let token = settings.onedriveToken;
      if (!token) return null;

      const test = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (test.ok) return token;

      return await this.refreshToken();
    },

    async disconnect() {
      await SettingsManager.set({
        onedriveToken: '', onedriveRefreshToken: '',
        onedriveConnected: false, onedriveUser: null
      });
      return { success: true };
    },

    async upload(data) {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with OneDrive');
      if (!data || typeof data !== 'object') throw new Error('Invalid backup data');

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) throw new Error('Upload failed: ' + await response.text());
      return { success: true, timestamp: Date.now() };
    },

    async download() {
      const token = await this.getValidToken();
      if (!token) throw new Error('Not authenticated with OneDrive');

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Download failed: ' + response.status);
      return await response.json();
    },

    async test() {
      try {
        const token = await this.getValidToken();
        if (!token) return { success: false, error: 'Not authenticated' };
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return { success: response.ok };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async getStatus(settings) {
      try {
        if (!settings) settings = await SettingsManager.get();
        if (!settings.onedriveConnected || !settings.onedriveToken) return { connected: false };
        const token = await this.getValidToken();
        if (!token) return { connected: false };
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return { connected: false };
        const user = await response.json();
        return { connected: true, user: { email: user.mail || user.userPrincipalName, name: user.displayName } };
      } catch (e) {
        return { connected: false };
      }
    }
  }
};

// Export for use in background.js
if (typeof self !== 'undefined') {
  self.CloudSyncProviders = CloudSyncProviders;
}


// ============================================================================
// INLINED: i18n.js - Internationalization Module
// (inlined to bypass Chrome service worker importScripts caching)
// ============================================================================
var I18n = (function() {
  'use strict';

  let currentLocale = 'en';
  
  // All translations
  const translations = {
    en: {
      // General
      appName: 'ScriptVault',
      enabled: 'Enabled',
      disabled: 'Disabled',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      loading: 'Loading...',
      search: 'Search',
      refresh: 'Refresh',
      
      // Navigation
      tabScripts: 'Installed Userscripts',
      tabSettings: 'Settings',
      tabUtilities: 'Utilities',
      tabHelp: 'Help',
      tabValues: 'Values Editor',
      
      // Scripts
      newScript: 'New Script',
      importScript: 'Import',
      checkUpdates: 'Check Updates',
      searchScripts: 'Search scripts...',
      noScripts: 'No userscripts installed',
      noScriptsDesc: 'Create a new script or import one to get started.',
      scriptName: 'Name',
      scriptVersion: 'Version',
      scriptAuthor: 'Author',
      scriptDescription: 'Description',
      scriptSize: 'Size',
      scriptUpdated: 'Updated',
      scriptEnabled: 'Script Enabled',
      scriptDisabled: 'Script Disabled',
      
      // Editor
      editorCode: 'Code',
      editorInfo: 'Info',
      editorStorage: 'Storage',
      editorSettings: 'Settings',
      editorSave: 'Save',
      editorClose: 'Close',
      editorToggle: 'Toggle',
      editorDuplicate: 'Duplicate',
      editorDelete: 'Delete',
      
      // Settings sections
      settingsGeneral: 'General',
      settingsNotifications: 'Notifications',
      settingsEditor: 'Editor',
      settingsUpdates: 'Updates',
      settingsSync: 'Cloud Sync',
      settingsAdvanced: 'Advanced',
      
      // Sync
      syncProvider: 'Sync Provider',
      syncProviderNone: 'Disabled',
      syncProviderWebdav: 'WebDAV',
      syncProviderGoogleDrive: 'Google Drive',
      syncProviderDropbox: 'Dropbox',
      syncConnected: 'Connected',
      syncDisconnected: 'Not connected',
      syncConnect: 'Connect',
      syncDisconnect: 'Disconnect',
      syncNow: 'Sync Now',
      syncTest: 'Test',
      lastSync: 'Last sync',
      syncSuccess: 'Sync completed successfully',
      syncError: 'Sync failed',
      
      // Values Editor
      valuesTitle: 'Script Values Editor',
      valuesDesc: 'View and edit GM_getValue/GM_setValue storage',
      valuesAllScripts: 'All Scripts',
      valuesNoData: 'No stored values found',
      valuesKey: 'Key',
      valuesValue: 'Value',
      valuesType: 'Type',
      valuesScript: 'Script',
      valuesAdd: 'Add Value',
      valuesEdit: 'Edit Value',
      valuesDelete: 'Delete',
      valuesDeleteSelected: 'Delete Selected',
      valuesSaved: 'Value saved',
      valuesDeleted: 'Value deleted',
      
      // Per-script settings
      scriptSettingsTitle: 'Per-Script Settings',
      scriptAutoUpdate: 'Auto-update this script',
      scriptNotifyUpdates: 'Notify on updates',
      scriptNotifyErrors: 'Notify on errors',
      scriptRunAt: 'Run at',
      scriptInjectInto: 'Inject into',
      scriptExcludes: 'Additional excludes',
      runAtDefault: 'Default (from metadata)',
      runAtDocumentStart: 'Document Start',
      runAtDocumentEnd: 'Document End',
      runAtDocumentIdle: 'Document Idle',
      injectAuto: 'Auto',
      injectPage: 'Page Context',
      injectContent: 'Content Script',
      
      // Utilities
      exportAll: 'Export All',
      exportZip: 'Export as ZIP',
      importFile: 'Import from File',
      importUrl: 'Import from URL',
      importText: 'Import from Text',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',
      
      // Messages
      scriptInstalled: 'Script installed',
      scriptUpdated: 'Script updated',
      scriptDeleted: 'Script deleted',
      settingsSaved: 'Settings saved',
      confirmDelete: 'Are you sure you want to delete this script?',
      confirmDeleteMultiple: 'Delete {count} selected scripts?',
      updateAvailable: 'Update available',
      noUpdates: 'All scripts are up to date'
    },
    
    es: {
      appName: 'ScriptVault',
      enabled: 'Activado',
      disabled: 'Desactivado',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      confirm: 'Confirmar',
      yes: 'Sí',
      no: 'No',
      ok: 'OK',
      error: 'Error',
      success: 'Éxito',
      warning: 'Advertencia',
      loading: 'Cargando...',
      search: 'Buscar',
      refresh: 'Actualizar',
      tabScripts: 'Scripts Instalados',
      tabSettings: 'Configuración',
      tabUtilities: 'Utilidades',
      tabHelp: 'Ayuda',
      tabValues: 'Editor de Valores',
      newScript: 'Nuevo Script',
      importScript: 'Importar',
      checkUpdates: 'Buscar Actualizaciones',
      searchScripts: 'Buscar scripts...',
      noScripts: 'No hay scripts instalados',
      noScriptsDesc: 'Crea un nuevo script o importa uno para comenzar.',
      syncProvider: 'Proveedor de Sincronización',
      syncProviderNone: 'Desactivado',
      syncConnect: 'Conectar',
      syncDisconnect: 'Desconectar',
      syncNow: 'Sincronizar Ahora',
      lastSync: 'Última sincronización',
      valuesTitle: 'Editor de Valores',
      valuesAllScripts: 'Todos los Scripts',
      valuesNoData: 'No se encontraron valores almacenados'
    },
    
    fr: {
      appName: 'ScriptVault',
      enabled: 'Activé',
      disabled: 'Désactivé',
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      close: 'Fermer',
      confirm: 'Confirmer',
      yes: 'Oui',
      no: 'Non',
      ok: 'OK',
      error: 'Erreur',
      success: 'Succès',
      warning: 'Avertissement',
      loading: 'Chargement...',
      search: 'Rechercher',
      refresh: 'Actualiser',
      tabScripts: 'Scripts Installés',
      tabSettings: 'Paramètres',
      tabUtilities: 'Utilitaires',
      tabHelp: 'Aide',
      tabValues: 'Éditeur de Valeurs',
      newScript: 'Nouveau Script',
      importScript: 'Importer',
      checkUpdates: 'Vérifier les Mises à Jour',
      searchScripts: 'Rechercher des scripts...',
      noScripts: 'Aucun script installé',
      syncProvider: 'Fournisseur de Synchronisation',
      syncProviderNone: 'Désactivé',
      syncConnect: 'Connecter',
      syncDisconnect: 'Déconnecter',
      syncNow: 'Synchroniser',
      lastSync: 'Dernière synchronisation'
    },
    
    de: {
      appName: 'ScriptVault',
      enabled: 'Aktiviert',
      disabled: 'Deaktiviert',
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      close: 'Schließen',
      confirm: 'Bestätigen',
      yes: 'Ja',
      no: 'Nein',
      ok: 'OK',
      error: 'Fehler',
      success: 'Erfolg',
      warning: 'Warnung',
      loading: 'Laden...',
      search: 'Suchen',
      refresh: 'Aktualisieren',
      tabScripts: 'Installierte Scripts',
      tabSettings: 'Einstellungen',
      tabUtilities: 'Werkzeuge',
      tabHelp: 'Hilfe',
      tabValues: 'Werte-Editor',
      newScript: 'Neues Script',
      importScript: 'Importieren',
      checkUpdates: 'Updates prüfen',
      searchScripts: 'Scripts suchen...',
      noScripts: 'Keine Scripts installiert',
      syncProvider: 'Sync-Anbieter',
      syncProviderNone: 'Deaktiviert',
      syncConnect: 'Verbinden',
      syncDisconnect: 'Trennen',
      syncNow: 'Jetzt synchronisieren',
      lastSync: 'Letzte Synchronisation'
    },
    
    zh: {
      appName: 'ScriptVault',
      enabled: '已启用',
      disabled: '已禁用',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      close: '关闭',
      confirm: '确认',
      yes: '是',
      no: '否',
      ok: '确定',
      error: '错误',
      success: '成功',
      warning: '警告',
      loading: '加载中...',
      search: '搜索',
      refresh: '刷新',
      tabScripts: '已安装脚本',
      tabSettings: '设置',
      tabUtilities: '工具',
      tabHelp: '帮助',
      tabValues: '值编辑器',
      newScript: '新建脚本',
      importScript: '导入',
      checkUpdates: '检查更新',
      searchScripts: '搜索脚本...',
      noScripts: '没有安装脚本',
      syncProvider: '同步服务',
      syncProviderNone: '禁用',
      syncConnect: '连接',
      syncDisconnect: '断开',
      syncNow: '立即同步',
      lastSync: '上次同步'
    },
    
    ja: {
      appName: 'ScriptVault',
      enabled: '有効',
      disabled: '無効',
      save: '保存',
      cancel: 'キャンセル',
      delete: '削除',
      edit: '編集',
      close: '閉じる',
      confirm: '確認',
      yes: 'はい',
      no: 'いいえ',
      ok: 'OK',
      error: 'エラー',
      success: '成功',
      warning: '警告',
      loading: '読み込み中...',
      search: '検索',
      refresh: '更新',
      tabScripts: 'インストール済みスクリプト',
      tabSettings: '設定',
      tabUtilities: 'ユーティリティ',
      tabHelp: 'ヘルプ',
      tabValues: '値エディタ',
      newScript: '新規スクリプト',
      importScript: 'インポート',
      checkUpdates: '更新を確認',
      searchScripts: 'スクリプトを検索...',
      noScripts: 'スクリプトがインストールされていません',
      syncProvider: '同期プロバイダー',
      syncProviderNone: '無効',
      syncConnect: '接続',
      syncDisconnect: '切断',
      syncNow: '今すぐ同期',
      lastSync: '最終同期'
    },
    
    pt: {
      appName: 'ScriptVault',
      enabled: 'Ativado',
      disabled: 'Desativado',
      save: 'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir',
      edit: 'Editar',
      close: 'Fechar',
      confirm: 'Confirmar',
      yes: 'Sim',
      no: 'Não',
      ok: 'OK',
      error: 'Erro',
      success: 'Sucesso',
      warning: 'Aviso',
      loading: 'Carregando...',
      search: 'Pesquisar',
      refresh: 'Atualizar',
      tabScripts: 'Scripts Instalados',
      tabSettings: 'Configurações',
      tabUtilities: 'Utilitários',
      tabHelp: 'Ajuda',
      tabValues: 'Editor de Valores',
      newScript: 'Novo Script',
      importScript: 'Importar',
      checkUpdates: 'Verificar Atualizações',
      searchScripts: 'Pesquisar scripts...',
      noScripts: 'Nenhum script instalado',
      syncProvider: 'Provedor de Sincronização',
      syncProviderNone: 'Desativado',
      syncConnect: 'Conectar',
      syncDisconnect: 'Desconectar',
      syncNow: 'Sincronizar Agora',
      lastSync: 'Última sincronização'
    },
    
    ru: {
      appName: 'ScriptVault',
      enabled: 'Включено',
      disabled: 'Отключено',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      edit: 'Редактировать',
      close: 'Закрыть',
      confirm: 'Подтвердить',
      yes: 'Да',
      no: 'Нет',
      ok: 'OK',
      error: 'Ошибка',
      success: 'Успешно',
      warning: 'Предупреждение',
      loading: 'Загрузка...',
      search: 'Поиск',
      refresh: 'Обновить',
      tabScripts: 'Установленные скрипты',
      tabSettings: 'Настройки',
      tabUtilities: 'Утилиты',
      tabHelp: 'Помощь',
      tabValues: 'Редактор значений',
      newScript: 'Новый скрипт',
      importScript: 'Импорт',
      checkUpdates: 'Проверить обновления',
      searchScripts: 'Поиск скриптов...',
      noScripts: 'Нет установленных скриптов',
      syncProvider: 'Провайдер синхронизации',
      syncProviderNone: 'Отключено',
      syncConnect: 'Подключить',
      syncDisconnect: 'Отключить',
      syncNow: 'Синхронизировать',
      lastSync: 'Последняя синхронизация'
    }
  };

  // Detect browser language
  function detectLocale() {
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    const shortLang = browserLang.split('-')[0].toLowerCase();
    return translations[shortLang] ? shortLang : 'en';
  }

  // Get message with optional placeholder substitution
  function getMessage(key, placeholders = {}) {
    const locale = translations[currentLocale] || translations.en;
    let message = locale[key] || translations.en[key] || key;
    
    // Replace placeholders like {count}, {name}, etc.
    Object.keys(placeholders).forEach(placeholder => {
      message = message.replace(new RegExp(`\{${placeholder}\}`, 'g'), placeholders[placeholder]);
    });
    
    return message;
  }

  return {
    init(locale) {
      currentLocale = locale === 'auto' ? detectLocale() : (translations[locale] ? locale : 'en');
      console.log('[I18n] Initialized with locale:', currentLocale);
      return currentLocale;
    },
    
    setLocale(locale) {
      if (translations[locale]) {
        currentLocale = locale;
        return true;
      }
      return false;
    },
    
    getLocale() {
      return currentLocale;
    },
    
    getMessage,
    t: getMessage, // Shorthand alias
    
    getAvailableLocales() {
      return Object.keys(translations).map(code => ({
        code,
        name: {
          en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
          zh: '中文', ja: '日本語', pt: 'Português', ru: 'Русский'
        }[code] || code
      }));
    },
    
    // Apply translations to DOM elements with data-i18n attribute
    applyToDOM(container = document) {
      container.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = getMessage(key);
      });
      container.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = getMessage(key);
      });
      container.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = getMessage(key);
      });
    }
  };
})();

// Export for use in pages
if (typeof window !== 'undefined') {
  window.I18n = I18n;
}
if (typeof self !== 'undefined') {
  self.I18n = I18n;
}

// ============================================================================
// END INLINED MODULES
// ============================================================================

// ============================================================================
// Settings Manager
// ============================================================================

const SettingsManager = {
  defaults: {
    // General
    enabled: true,
    showBadge: true,
    badgeColor: '#22c55e',
    theme: 'dark',
    
    // Notifications
    notifyOnInstall: true,
    notifyOnUpdate: true,
    notifyOnError: false,
    
    // Editor
    editorTheme: 'material-darker',
    editorFontSize: 13,
    editorTabSize: 2,
    editorLineWrapping: false,
    editorAutoComplete: true,
    editorMatchBrackets: true,
    editorAutoCloseBrackets: true,
    editorHighlightActiveLine: true,
    editorShowInvisibles: false,
    editorKeyMap: 'default',
    
    // Updates
    autoUpdate: true,
    updateInterval: 86400000, // 24 hours
    lastUpdateCheck: 0,
    
    // Sync
    syncEnabled: false,
    syncProvider: 'none',
    syncInterval: 3600000, // 1 hour
    lastSync: 0,
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    // Google Drive (uses chrome.identity)
    googleDriveConnected: false,
    googleDriveUser: null,
    // Dropbox
    dropboxToken: '',
    dropboxUser: null,
    dropboxClientId: '',
    // Language
    language: 'auto',
    
    // Advanced
    debugMode: false,
    injectIntoFrames: true,
    xhrTimeout: 30000,
    
    // Global Blacklist
    blacklist: []
  },
  
  cache: null,
  
  async init() {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('settings');
    this.cache = { ...this.defaults, ...data.settings };
    console.log('[ScriptVault] Settings loaded');
  },
  
  async get(key) {
    await this.init();
    return key ? this.cache[key] : { ...this.cache };
  },
  
  async set(key, value) {
    await this.init();
    if (typeof key === 'object') {
      this.cache = { ...this.cache, ...key };
    } else {
      this.cache[key] = value;
    }
    await chrome.storage.local.set({ settings: this.cache });
    return this.cache;
  },
  
  async reset() {
    this.cache = { ...this.defaults };
    await chrome.storage.local.set({ settings: this.cache });
    return this.cache;
  }
};

// Debug logging helper - only logs when debugMode is enabled
function debugLog(...args) {
  if (SettingsManager.cache?.debugMode) {
    console.log('[ScriptVault]', ...args);
  }
}

// ============================================================================
// Script Storage
// ============================================================================

const ScriptStorage = {
  cache: null,
  
  async init() {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('userscripts');
    this.cache = data.userscripts || {};
    console.log('[ScriptVault] Loaded', Object.keys(this.cache).length, 'scripts');
  },
  
  async save() {
    await chrome.storage.local.set({ userscripts: this.cache });
  },
  
  async getAll() {
    await this.init();
    return Object.values(this.cache);
  },
  
  async get(id) {
    await this.init();
    return this.cache[id] || null;
  },
  
  async set(id, script) {
    await this.init();
    this.cache[id] = script;
    await this.save();
    return script;
  },
  
  async delete(id) {
    await this.init();
    delete this.cache[id];
    // Also delete associated values
    await ScriptValues.deleteAll(id);
    await this.save();
  },
  
  async clear() {
    this.cache = {};
    await this.save();
  },
  
  async search(query) {
    await this.init();
    const q = query.toLowerCase();
    return Object.values(this.cache).filter(s => 
      s.meta.name.toLowerCase().includes(q) ||
      s.meta.description?.toLowerCase().includes(q) ||
      s.meta.author?.toLowerCase().includes(q)
    );
  },
  
  async getByNamespace(namespace) {
    await this.init();
    return Object.values(this.cache).filter(s => s.meta.namespace === namespace);
  },
  
  async reorder(orderedIds) {
    await this.init();
    orderedIds.forEach((id, index) => {
      if (this.cache[id]) {
        this.cache[id].position = index;
      }
    });
    await this.save();
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
        name: original.meta.name + ' (Copy)'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.cache[newId] = newScript;
    await this.save();
    return newScript;
  }
};

// ============================================================================
// Script Values Storage (GM_getValue/setValue)
// ============================================================================

const ScriptValues = {
  cache: {},
  listeners: new Map(),
  pendingNotifications: new Map(), // Debounce notifications only (not saves!)
  
  async init(scriptId) {
    if (this.cache[scriptId]) return;
    const data = await chrome.storage.local.get(`values_${scriptId}`);
    this.cache[scriptId] = data[`values_${scriptId}`] || {};
  },
  
  async get(scriptId, key, defaultValue) {
    await this.init(scriptId);
    const value = this.cache[scriptId][key];
    return value !== undefined ? value : defaultValue;
  },
  
  // FIXED: Save immediately to prevent data loss on service worker termination
  // MV3 service workers can be killed at any time - setTimeout-based debouncing is unsafe
  async set(scriptId, key, value) {
    await this.init(scriptId);
    const oldValue = this.cache[scriptId][key];
    
    // Update cache immediately
    this.cache[scriptId][key] = value;
    
    // Save IMMEDIATELY - don't debounce persistence in MV3!
    // Service workers can be terminated at any time, losing unsaved data
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
    
    // Debounce notifications only (these are less critical)
    this.scheduleNotification(scriptId, key, oldValue, value);
    
    return value;
  },
  
  // Debounced notifications - batches rapid changes (notification loss is acceptable)
  scheduleNotification(scriptId, key, oldValue, newValue) {
    const notifKey = `${scriptId}_${key}`;
    const existing = this.pendingNotifications.get(notifKey);
    if (existing) {
      clearTimeout(existing.timeout);
      // Keep original oldValue for batched notification
      oldValue = existing.oldValue;
    }
    
    const timeout = setTimeout(() => {
      this.pendingNotifications.delete(notifKey);
      this.notifyChange(scriptId, key, oldValue, newValue, false);
    }, 100);
    
    this.pendingNotifications.set(notifKey, { timeout, oldValue });
  },
  
  async delete(scriptId, key) {
    await this.init(scriptId);
    const oldValue = this.cache[scriptId][key];
    delete this.cache[scriptId][key];
    // Save immediately
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
    this.scheduleNotification(scriptId, key, oldValue, undefined);
  },
  
  async list(scriptId) {
    await this.init(scriptId);
    return Object.keys(this.cache[scriptId]);
  },
  
  async getAll(scriptId) {
    await this.init(scriptId);
    return { ...this.cache[scriptId] };
  },
  
  async setAll(scriptId, values) {
    await this.init(scriptId);
    for (const [key, value] of Object.entries(values)) {
      const oldValue = this.cache[scriptId][key];
      this.cache[scriptId][key] = value;
      this.scheduleNotification(scriptId, key, oldValue, value);
    }
    // Save immediately
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
  },
  
  async deleteAll(scriptId) {
    delete this.cache[scriptId];
    await chrome.storage.local.remove(`values_${scriptId}`);
  },
  
  // Delete multiple specific keys at once
  async deleteMultiple(scriptId, keys) {
    await this.init(scriptId);
    for (const key of keys) {
      const oldValue = this.cache[scriptId][key];
      delete this.cache[scriptId][key];
      this.scheduleNotification(scriptId, key, oldValue, undefined);
    }
    // Save immediately
    await chrome.storage.local.set({ 
      [`values_${scriptId}`]: this.cache[scriptId] 
    });
  },
  
  async getStorageSize(scriptId) {
    await this.init(scriptId);
    return JSON.stringify(this.cache[scriptId] || {}).length;
  },
  
  addListener(scriptId, listenerId, callback) {
    const key = `${scriptId}_${listenerId}`;
    this.listeners.set(key, { scriptId, callback });
    return key;
  },
  
  removeListener(key) {
    this.listeners.delete(key);
  },
  
  notifyChange(scriptId, key, oldValue, newValue, remote) {
    // Skip if value didn't actually change
    if (oldValue === newValue) return;
    
    // Notify local listeners
    this.listeners.forEach((listener) => {
      if (listener.scriptId === scriptId) {
        try {
          listener.callback(key, oldValue, newValue, remote);
        } catch (e) {
          console.error('[ScriptVault] Value change listener error:', e);
        }
      }
    });
    
    // Broadcast value change to all loaded tabs
    chrome.tabs.query({ status: 'complete' }).then(tabs => {
      const msg = { action: 'valueChanged', data: { scriptId, key, oldValue, newValue, remote: true } };
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    }).catch(() => {});
  }
};

// ============================================================================
// Tab Storage (GM_getTab/saveTab)
// ============================================================================

const TabStorage = {
  data: new Map(),
  
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

// Global notification callback tracker (initialized once, used by GM_notification handler)
if (!self._notifCallbacks) self._notifCallbacks = new Map();

// Clean up tab data when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  TabStorage.delete(tabId);
  // Also abort any pending XHR requests for this tab
  XhrManager.abortByTab(tabId);
  // Clean up notification callbacks for this tab
  for (const [notifId, info] of self._notifCallbacks) {
    if (info.tabId === tabId) self._notifCallbacks.delete(notifId);
  }
});

// Notification click/close listeners for GM_notification callbacks
chrome.notifications.onClicked.addListener((notifId) => {
  if (!self._notifCallbacks) return;
  const info = self._notifCallbacks.get(notifId);
  if (!info) return;
  if (info.hasOnclick) {
    chrome.tabs.sendMessage(info.tabId, {
      action: 'notificationEvent',
      data: { notifId, scriptId: info.scriptId, type: 'click' }
    }).catch(() => {});
  }
});

chrome.notifications.onClosed.addListener((notifId, byUser) => {
  if (!self._notifCallbacks) return;
  const info = self._notifCallbacks.get(notifId);
  if (!info) return;
  if (info.hasOndone) {
    chrome.tabs.sendMessage(info.tabId, {
      action: 'notificationEvent',
      data: { notifId, scriptId: info.scriptId, type: 'done' }
    }).catch(() => {});
  }
  self._notifCallbacks.delete(notifId);
});

// ============================================================================
// Folder Storage
// ============================================================================

const FolderStorage = {
  cache: null,

  async init() {
    if (this.cache !== null) return;
    const data = await chrome.storage.local.get('scriptFolders');
    this.cache = data.scriptFolders || [];
  },

  async save() {
    await chrome.storage.local.set({ scriptFolders: this.cache });
  },

  async getAll() {
    await this.init();
    return this.cache;
  },

  async create(name, color = '#60a5fa') {
    await this.init();
    const folder = { id: generateId(), name, color, collapsed: false, scriptIds: [], createdAt: Date.now() };
    this.cache.push(folder);
    await this.save();
    return folder;
  },

  async update(id, updates) {
    await this.init();
    const folder = this.cache.find(f => f.id === id);
    if (folder) {
      Object.assign(folder, updates);
      await this.save();
    }
    return folder;
  },

  async delete(id) {
    await this.init();
    this.cache = this.cache.filter(f => f.id !== id);
    await this.save();
  },

  async addScript(folderId, scriptId) {
    await this.init();
    const folder = this.cache.find(f => f.id === folderId);
    if (folder && !folder.scriptIds.includes(scriptId)) {
      folder.scriptIds.push(scriptId);
      await this.save();
    }
  },

  async removeScript(folderId, scriptId) {
    await this.init();
    const folder = this.cache.find(f => f.id === folderId);
    if (folder) {
      folder.scriptIds = folder.scriptIds.filter(id => id !== scriptId);
      await this.save();
    }
  },

  async moveScript(scriptId, fromFolderId, toFolderId) {
    await this.init();
    if (fromFolderId) {
      const from = this.cache.find(f => f.id === fromFolderId);
      if (from) from.scriptIds = from.scriptIds.filter(id => id !== scriptId);
    }
    if (toFolderId) {
      const to = this.cache.find(f => f.id === toFolderId);
      if (to && !to.scriptIds.includes(scriptId)) to.scriptIds.push(scriptId);
    }
    await this.save();
  },

  getFolderForScript(scriptId) {
    if (!this.cache) return null;
    return this.cache.find(f => f.scriptIds.includes(scriptId)) || null;
  }
};

// Shared tracker for GM_openInTab close notifications (avoids per-call listener leak)
const _openTabTrackers = new Map(); // openedTabId -> { callerTabId, scriptId }
chrome.tabs.onRemoved.addListener((closedTabId) => {
  const info = _openTabTrackers.get(closedTabId);
  if (info) {
    _openTabTrackers.delete(closedTabId);
    chrome.tabs.sendMessage(info.callerTabId, {
      action: 'openedTabClosed',
      data: { tabId: closedTabId, scriptId: info.scriptId }
    }).catch(() => {});
  }
});

// ============================================================================
// XHR Request Manager (tracks requests for abort support)
// ============================================================================

const XhrManager = {
  requests: new Map(), // requestId -> { controller, tabId, scriptId, etc }
  nextId: 1,
  
  // Create a new tracked request (controller added later by caller)
  create(tabId, scriptId, details) {
    const requestId = `xhr_${this.nextId++}_${Date.now()}`;
    
    const request = {
      id: requestId,
      controller: null, // AbortController added by caller
      tabId,
      scriptId,
      details,
      aborted: false,
      startTime: Date.now()
    };
    
    this.requests.set(requestId, request);
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
        } catch (e) {
          // Ignore abort errors
        }
      }
      return true;
    }
    return false;
  },
  
  // Remove a completed/aborted request
  remove(requestId) {
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
  }
};

// ============================================================================
// Resource Cache
// ============================================================================

const ResourceCache = {
  cache: {},
  maxAge: 86400000, // 24 hours
  STORAGE_PREFIX: 'res_cache_',

  async get(url) {
    const cached = this.cache[url];
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached;
    }
    // Clean up expired in-memory entry
    if (cached) delete this.cache[url];

    // Try persistent storage
    try {
      const key = this.STORAGE_PREFIX + url;
      const stored = await chrome.storage.local.get(key);
      if (stored[key] && Date.now() - stored[key].timestamp < this.maxAge) {
        this.cache[url] = stored[key];
        return stored[key];
      }
      // Clean up expired persistent entry
      if (stored[key]) chrome.storage.local.remove(key).catch(() => {});
    } catch (e) {}
    return null;
  },

  async set(url, text, dataUri) {
    const entry = { text, dataUri, timestamp: Date.now() };
    this.cache[url] = entry;
    try {
      const key = this.STORAGE_PREFIX + url;
      await chrome.storage.local.set({ [key]: entry });
    } catch (e) {}
  },

  async fetchResource(url) {
    const cached = await this.get(url);
    if (cached) return cached.text;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || 'text/plain';
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Generate text representation
      let text;
      if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('css') || contentType.includes('javascript')) {
        text = new TextDecoder().decode(bytes);
      } else {
        text = '';
      }

      // Generate data URI for binary resources (images, fonts, etc.)
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const dataUri = `data:${contentType};base64,${base64}`;

      await this.set(url, text, dataUri);
      return text;
    } catch (e) {
      console.error('[ScriptVault] Failed to fetch resource:', url, e);
      throw e;
    }
  },

  async getDataUri(url) {
    const cached = await this.get(url);
    if (cached && cached.dataUri) return cached.dataUri;
    // Fetch it first
    await this.fetchResource(url);
    const entry = await this.get(url);
    return entry ? entry.dataUri : null;
  },

  async prefetchResources(resources) {
    if (!resources || typeof resources !== 'object') return;
    const promises = Object.values(resources).map(url =>
      this.fetchResource(url).catch(e => console.warn('[ScriptVault] Resource prefetch failed:', url, e.message))
    );
    await Promise.allSettled(promises);
  },

  async clear() {
    this.cache = {};
    // Also clear persistent resource cache entries
    try {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter(k => k.startsWith(this.STORAGE_PREFIX));
      if (keys.length > 0) await chrome.storage.local.remove(keys);
    } catch (e) {}
  }
};


// ============================================================================
// NPM Package Resolver for @require directives
// ============================================================================
// Resolves `@require npm:package-name` and `@require npm:package-name@version`
// to CDN URLs with fallback chain and integrity verification.
// Designed for service worker context (no DOM, fetch API only).
// ============================================================================

const NpmResolver = {
  CACHE_KEY: 'npmCache',
  CACHE_TTL: 86400000, // 24 hours
  REGISTRY_URL: 'https://registry.npmjs.org',
  REQUEST_TIMEOUT: 10000, // 10 seconds

  // Pre-mapped shortcuts for popular packages (name -> CDN path overrides)
  POPULAR_PACKAGES: {
    'lodash':       { cdn: 'lodash', file: 'lodash.min.js' },
    'jquery':       { cdn: 'jquery', file: 'jquery.min.js' },
    'axios':        { cdn: 'axios', file: 'axios.min.js' },
    'moment':       { cdn: 'moment', file: 'moment.min.js' },
    'dayjs':        { cdn: 'dayjs', file: 'dayjs.min.js' },
    'rxjs':         { cdn: 'rxjs', file: 'rxjs.umd.min.js' },
    'underscore':   { cdn: 'underscore', file: 'underscore-min.js' },
    'ramda':        { cdn: 'ramda', file: 'ramda.min.js' },
    'dompurify':    { cdn: 'dompurify', file: 'purify.min.js' },
    'marked':       { cdn: 'marked', file: 'marked.min.js' },
    'highlight.js': { cdn: 'highlight.js', file: 'highlight.min.js' },
    'chart.js':     { cdn: 'Chart.js', file: 'chart.umd.js' },
    'three':        { cdn: 'three', file: 'three.min.js' },
    'd3':           { cdn: 'd3', file: 'd3.min.js' },
    'gsap':         { cdn: 'gsap', file: 'gsap.min.js' },
    'animejs':      { cdn: 'animejs', file: 'anime.min.js' },
    'anime.js':     { cdn: 'animejs', file: 'anime.min.js' },
    'sweetalert2':  { cdn: 'sweetalert2', file: 'sweetalert2.all.min.js' },
    'tippy.js':     { cdn: 'tippy.js', file: 'tippy-bundle.umd.min.js' },
    'sortablejs':   { cdn: 'Sortable', file: 'Sortable.min.js' },
    'luxon':        { cdn: 'luxon', file: 'luxon.min.js' }
  },

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check if a require URL uses the npm: prefix.
   * @param {string} url
   * @returns {boolean}
   */
  isNpmRequire(url) {
    return typeof url === 'string' && url.startsWith('npm:');
  },

  /**
   * Resolve a single npm require spec to a CDN URL.
   * @param {string} requireSpec - e.g. "npm:lodash" or "npm:lodash@4.17.21"
   * @returns {Promise<{url: string, integrity: string, version: string}>}
   */
  async resolve(requireSpec) {
    if (!this.isNpmRequire(requireSpec)) {
      throw new Error(`Not an npm require: ${requireSpec}`);
    }

    const { name, version: requestedVersion } = this._parseSpec(requireSpec);
    const cacheKey = `${name}@${requestedVersion || 'latest'}`;

    // Check cache first
    const cached = await this._getCache(cacheKey);
    if (cached) return cached;

    // Resolve version if not pinned
    const version = requestedVersion || await this._resolveLatestVersion(name);
    if (!version) {
      throw new Error(`Failed to resolve version for package: ${name}`);
    }

    // Try CDN chain with fallback
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
        lastError = err;
        // Continue to next CDN
      }
    }

    throw new Error(
      `Failed to resolve npm:${name}@${version} from all CDNs: ${lastError?.message || 'unknown error'}`
    );
  },

  /**
   * Batch-resolve multiple npm require specs.
   * @param {string[]} requires - Array of require specs
   * @returns {Promise<Map<string, {url: string, integrity: string, version: string}>>}
   */
  async resolveAll(requires) {
    const results = new Map();
    const promises = requires.map(async (spec) => {
      try {
        const result = await this.resolve(spec);
        results.set(spec, result);
      } catch (err) {
        results.set(spec, { error: err.message });
      }
    });
    await Promise.allSettled(promises);
    return results;
  },

  /**
   * Fetch metadata for a package from the npm registry.
   * @param {string} packageName
   * @returns {Promise<{name: string, version: string, description: string, homepage: string, main: string}>}
   */
  async getPackageInfo(packageName) {
    const sanitized = this._sanitizePackageName(packageName);
    const url = `${this.REGISTRY_URL}/${encodeURIComponent(sanitized).replace('%40', '@')}/latest`;

    const response = await this._fetchWithTimeout(url, { isJson: true });
    const data = JSON.parse(response);

    return {
      name: data.name,
      version: data.version,
      description: data.description || '',
      homepage: data.homepage || '',
      main: data.main || 'index.js'
    };
  },

  /**
   * Clear all cached npm resolution data.
   */
  async clearCache() {
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
    } catch (e) {
      // Ignore storage errors
    }
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse an npm require spec into name and optional version.
   * Handles scoped packages (e.g. npm:@scope/name@version).
   * @param {string} spec
   * @returns {{name: string, version: string|null}}
   */
  _parseSpec(spec) {
    // Strip "npm:" prefix
    const raw = spec.slice(4);
    if (!raw) throw new Error('Empty npm package spec');

    let name, version = null;

    if (raw.startsWith('@')) {
      // Scoped package: @scope/name or @scope/name@version
      const slashIdx = raw.indexOf('/');
      if (slashIdx === -1) throw new Error(`Invalid scoped package: ${raw}`);
      const afterScope = raw.indexOf('@', slashIdx);
      if (afterScope > slashIdx) {
        name = raw.slice(0, afterScope);
        version = raw.slice(afterScope + 1);
      } else {
        name = raw;
      }
    } else {
      // Regular package: name or name@version
      const atIdx = raw.indexOf('@');
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
   * @param {string} name
   * @returns {string}
   */
  _sanitizePackageName(name) {
    const trimmed = name.trim();
    // npm package names: lowercase, can contain hyphens, dots, underscores, scoped with @
    if (!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(trimmed)) {
      throw new Error(`Invalid package name: ${trimmed}`);
    }
    return trimmed;
  },

  /**
   * Validate and sanitize a version string.
   * @param {string} version
   * @returns {string}
   */
  _sanitizeVersion(version) {
    const trimmed = version.trim();
    // Allow semver, ranges, and tags (e.g. "4.17.21", "^1.0.0", "latest", "next")
    if (!/^[a-z0-9\-._^~>=<| *]+$/i.test(trimmed)) {
      throw new Error(`Invalid version: ${trimmed}`);
    }
    return trimmed;
  },

  /**
   * Resolve the latest version of a package from the npm registry.
   * @param {string} name
   * @returns {Promise<string|null>}
   */
  async _resolveLatestVersion(name) {
    try {
      const info = await this.getPackageInfo(name);
      return info.version;
    } catch (e) {
      return null;
    }
  },

  /**
   * Build the ordered CDN URL list for a package.
   * Prefers UMD/IIFE bundles for userscript compatibility.
   * @param {string} name
   * @param {string} version
   * @returns {string[]}
   */
  _buildCdnUrls(name, version) {
    const popular = this.POPULAR_PACKAGES[name];
    const urls = [];

    if (popular) {
      // Use known-good paths for popular packages
      urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/dist/${popular.file}`);
      urls.push(`https://unpkg.com/${name}@${version}/dist/${popular.file}`);
      urls.push(
        `https://cdnjs.cloudflare.com/ajax/libs/${popular.cdn}/${version}/${popular.file}`
      );
    }

    // Generic CDN chain (always included as final fallback)
    // jsdelivr +esm endpoint auto-detects the right entry point
    urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/+esm`);
    urls.push(`https://unpkg.com/${name}@${version}`);
    urls.push(
      `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${name}.min.js`
    );

    // Deduplicate while preserving order
    return [...new Set(urls)];
  },

  /**
   * Fetch a URL with a timeout. Returns the response body as text.
   * @param {string} url
   * @param {{isJson?: boolean}} options
   * @returns {Promise<string>}
   */
  async _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: options.isJson ? { 'Accept': 'application/json' } : {}
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Compute SHA-256 SRI hash from content string.
   * Uses the Web Crypto API (available in service workers).
   * @param {string} content
   * @returns {Promise<string>} - SRI hash in "sha256-..." format
   */
  async _computeSriHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    // Convert to base64
    let binary = '';
    for (let i = 0; i < hashArray.length; i++) {
      binary += String.fromCharCode(hashArray[i]);
    }
    return `sha256-${btoa(binary)}`;
  },

  /**
   * Read a single entry from the npm cache.
   * @param {string} key
   * @returns {Promise<{url: string, integrity: string, version: string}|null>}
   */
  async _getCache(key) {
    try {
      const stored = await chrome.storage.local.get(this.CACHE_KEY);
      const cache = stored[this.CACHE_KEY];
      if (!cache || typeof cache !== 'object') return null;

      const entry = cache[key];
      if (!entry) return null;

      // Check TTL
      if (Date.now() - entry.timestamp > this.CACHE_TTL) {
        // Expired — remove lazily
        delete cache[key];
        chrome.storage.local.set({ [this.CACHE_KEY]: cache }).catch(() => {});
        return null;
      }

      return { url: entry.url, integrity: entry.integrity, version: entry.version };
    } catch (e) {
      return null;
    }
  },

  /**
   * Write a single entry to the npm cache.
   * @param {string} key
   * @param {{url: string, integrity: string, version: string}} result
   */
  async _setCache(key, result) {
    try {
      const stored = await chrome.storage.local.get(this.CACHE_KEY);
      const cache = (stored[this.CACHE_KEY] && typeof stored[this.CACHE_KEY] === 'object')
        ? stored[this.CACHE_KEY]
        : {};

      cache[key] = {
        url: result.url,
        integrity: result.integrity,
        version: result.version,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
    } catch (e) {
      // Storage write failures are non-fatal
    }
  }
};

// ============================================================================
// Error Reporting / Log Export
// ============================================================================

const ErrorLog = {
  STORAGE_KEY: 'errorLog',
  MAX_ENTRIES: 500,

  // In-memory cache; loaded on first access
  _cache: null,

  // ---------------------------------------------------------------------------
  // Core Operations
  // ---------------------------------------------------------------------------

  /**
   * Log an error entry.
   * entry: { scriptId, scriptName?, error, stack?, url?, line?, col?, context? }
   */
  async log(entry) {
    const entries = await this._load();

    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      scriptId: entry.scriptId || null,
      scriptName: entry.scriptName || null,
      error: typeof entry.error === 'string' ? entry.error : (entry.error?.message || String(entry.error)),
      stack: entry.stack || entry.error?.stack || null,
      url: entry.url || null,
      line: entry.line ?? null,
      col: entry.col ?? null,
      context: entry.context || null
    };

    // Resolve script name if not provided
    if (!record.scriptName && record.scriptId) {
      try {
        if (typeof ScriptStorage !== 'undefined') {
          const script = await ScriptStorage.get(record.scriptId);
          if (script?.meta?.name) record.scriptName = script.meta.name;
        }
      } catch (_) { /* ignore */ }
    }

    entries.push(record);

    // FIFO: trim to max entries
    if (entries.length > this.MAX_ENTRIES) {
      entries.splice(0, entries.length - this.MAX_ENTRIES);
    }

    this._cache = entries;
    await this._save();

    return record;
  },

  /**
   * Get all log entries, optionally filtered.
   * filters: { scriptId?, startDate?, endDate?, errorType?, search? }
   */
  async getAll(filters) {
    let entries = await this._load();

    if (!filters) return [...entries];

    if (filters.scriptId) {
      entries = entries.filter(e => e.scriptId === filters.scriptId);
    }
    if (filters.startDate) {
      const start = typeof filters.startDate === 'number' ? filters.startDate : new Date(filters.startDate).getTime();
      entries = entries.filter(e => e.timestamp >= start);
    }
    if (filters.endDate) {
      const end = typeof filters.endDate === 'number' ? filters.endDate : new Date(filters.endDate).getTime();
      entries = entries.filter(e => e.timestamp <= end);
    }
    if (filters.errorType) {
      const type = filters.errorType.toLowerCase();
      entries = entries.filter(e => {
        const msg = (e.error || '').toLowerCase();
        return msg.includes(type);
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      entries = entries.filter(e =>
        (e.error || '').toLowerCase().includes(q) ||
        (e.scriptName || '').toLowerCase().includes(q) ||
        (e.stack || '').toLowerCase().includes(q) ||
        (e.url || '').toLowerCase().includes(q) ||
        (e.context || '').toLowerCase().includes(q)
      );
    }

    return entries;
  },

  // ---------------------------------------------------------------------------
  // Error Grouping
  // ---------------------------------------------------------------------------

  /**
   * Group identical errors by (error message + scriptId).
   * Returns array of { key, error, scriptId, scriptName, count, firstSeen, lastSeen, sampleStack }
   */
  async getGrouped(filters) {
    const entries = await this.getAll(filters);
    const groups = new Map();

    for (const entry of entries) {
      const key = `${entry.scriptId || ''}::${entry.error || ''}`;

      if (groups.has(key)) {
        const group = groups.get(key);
        group.count++;
        if (entry.timestamp < group.firstSeen) group.firstSeen = entry.timestamp;
        if (entry.timestamp > group.lastSeen) group.lastSeen = entry.timestamp;
        // Keep the most recent stack trace
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

    // Sort by most recent occurrence descending
    return [...groups.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  },

  // ---------------------------------------------------------------------------
  // Export Formats
  // ---------------------------------------------------------------------------

  /**
   * Export as structured JSON string.
   */
  async exportJSON(filters) {
    const entries = await this.getAll(filters);
    return JSON.stringify({
      exported: new Date().toISOString(),
      count: entries.length,
      entries
    }, null, 2);
  },

  /**
   * Export as human-readable text log.
   */
  async exportText(filters) {
    const entries = await this.getAll(filters);
    const lines = [
      `ScriptVault Error Log - Exported ${new Date().toISOString()}`,
      `Total entries: ${entries.length}`,
      '='.repeat(80),
      ''
    ];

    for (const e of entries) {
      const time = new Date(e.timestamp).toISOString();
      lines.push(`[${time}] ${e.scriptName || e.scriptId || 'Unknown'}`);
      lines.push(`  Error: ${e.error}`);
      if (e.url) lines.push(`  URL: ${e.url}${e.line != null ? `:${e.line}` : ''}${e.col != null ? `:${e.col}` : ''}`);
      if (e.context) lines.push(`  Context: ${e.context}`);
      if (e.stack) {
        lines.push('  Stack:');
        for (const sLine of e.stack.split('\n').slice(0, 5)) {
          lines.push(`    ${sLine.trim()}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  },

  /**
   * Export as CSV string.
   */
  async exportCSV(filters) {
    const entries = await this.getAll(filters);
    const headers = ['timestamp', 'datetime', 'scriptId', 'scriptName', 'error', 'url', 'line', 'col', 'context'];

    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = [headers.join(',')];
    for (const e of entries) {
      rows.push([
        e.timestamp,
        new Date(e.timestamp).toISOString(),
        escapeCSV(e.scriptId),
        escapeCSV(e.scriptName),
        escapeCSV(e.error),
        escapeCSV(e.url),
        e.line ?? '',
        e.col ?? '',
        escapeCSV(e.context)
      ].join(','));
    }

    return rows.join('\n');
  },

  // ---------------------------------------------------------------------------
  // Management
  // ---------------------------------------------------------------------------

  /**
   * Clear all log entries, or entries for a specific script.
   */
  async clear(scriptId) {
    if (scriptId) {
      const entries = await this._load();
      this._cache = entries.filter(e => e.scriptId !== scriptId);
      await this._save();
    } else {
      this._cache = [];
      await this._save();
    }
  },

  /**
   * Get error log statistics.
   * Returns { total, byScript, oldest, newest, storageBytes }
   */
  async getStats() {
    const entries = await this._load();

    const byScript = {};
    for (const e of entries) {
      const key = e.scriptId || 'unknown';
      if (!byScript[key]) {
        byScript[key] = { scriptId: e.scriptId, scriptName: e.scriptName, count: 0 };
      }
      byScript[key].count++;
    }

    const storageBytes = JSON.stringify(entries).length;

    return {
      total: entries.length,
      maxEntries: this.MAX_ENTRIES,
      byScript: Object.values(byScript).sort((a, b) => b.count - a.count),
      oldest: entries.length > 0 ? entries[0].timestamp : null,
      newest: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
      storageBytes
    };
  },

  // ---------------------------------------------------------------------------
  // Capture Helpers
  // ---------------------------------------------------------------------------

  /**
   * Register global error listeners on the service worker.
   * Call once during service worker initialization.
   */
  registerGlobalHandlers() {
    // Unhandled errors
    self.addEventListener('error', (event) => {
      this.log({
        scriptId: null,
        scriptName: 'ServiceWorker',
        error: event.message || 'Unknown error',
        stack: event.error?.stack || null,
        url: event.filename || null,
        line: event.lineno ?? null,
        col: event.colno ?? null,
        context: 'global-error-handler'
      }).catch(() => { /* prevent infinite loop */ });
    });

    // Unhandled promise rejections
    self.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.log({
        scriptId: null,
        scriptName: 'ServiceWorker',
        error: reason?.message || String(reason),
        stack: reason?.stack || null,
        context: 'unhandled-rejection'
      }).catch(() => { /* prevent infinite loop */ });
    });

    console.log('[ScriptVault] Error log global handlers registered');
  },

  /**
   * Log a script execution error (from USER_SCRIPT world messages).
   */
  async logScriptError(scriptId, scriptName, errorData) {
    return this.log({
      scriptId,
      scriptName,
      error: errorData.message || errorData.error || 'Script execution error',
      stack: errorData.stack || null,
      url: errorData.url || null,
      line: errorData.line ?? errorData.lineno ?? null,
      col: errorData.col ?? errorData.colno ?? null,
      context: 'script-execution'
    });
  },

  /**
   * Log a GM API call failure.
   */
  async logGMError(scriptId, scriptName, apiName, error) {
    return this.log({
      scriptId,
      scriptName,
      error: `GM API ${apiName}: ${typeof error === 'string' ? error : (error?.message || String(error))}`,
      stack: error?.stack || null,
      context: `gm-api-${apiName}`
    });
  },

  // ---------------------------------------------------------------------------
  // Internal Storage
  // ---------------------------------------------------------------------------

  async _load() {
    if (this._cache) return this._cache;
    const data = await chrome.storage.local.get(this.STORAGE_KEY);
    this._cache = data[this.STORAGE_KEY] || [];
    return this._cache;
  },

  async _save() {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: this._cache });
  }
};

// ============================================================================
// Notification & Alert System
// ============================================================================

const NotificationSystem = {
  ALARM_WEEKLY_DIGEST: 'scriptvault-weekly-digest',
  STORAGE_KEY_PREFS: 'notificationPrefs',
  STORAGE_KEY_DIGEST: 'weeklyDigest',
  STORAGE_KEY_ERROR_COUNTS: 'notifErrorCounts',
  STORAGE_KEY_RATE_LIMITS: 'notifRateLimits',

  // Default notification preferences
  defaultPrefs: {
    updates: true,
    errors: true,
    digest: false,
    security: true,
    quietHoursEnabled: false,
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 7     // 7 AM
  },

  // In-memory caches (rebuilt from storage on service worker wake)
  _prefsCache: null,
  _errorCounts: null,   // { scriptId: consecutiveCount }
  _rateLimits: null,    // { scriptId: lastNotifTimestamp }

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  async getPreferences() {
    if (this._prefsCache) return { ...this._prefsCache };
    const data = await chrome.storage.local.get(this.STORAGE_KEY_PREFS);
    this._prefsCache = { ...this.defaultPrefs, ...data[this.STORAGE_KEY_PREFS] };
    return { ...this._prefsCache };
  },

  async setPreferences(prefs) {
    const current = await this.getPreferences();
    this._prefsCache = { ...current, ...prefs };
    await chrome.storage.local.set({ [this.STORAGE_KEY_PREFS]: this._prefsCache });

    // If digest was toggled, manage the alarm
    if ('digest' in prefs) {
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

    const now = new Date();
    const hour = now.getHours();
    const { quietHoursStart, quietHoursEnd } = prefs;

    // Handle overnight ranges (e.g., 22 to 7)
    if (quietHoursStart > quietHoursEnd) {
      return hour >= quietHoursStart || hour < quietHoursEnd;
    }
    // Same-day range (e.g., 1 to 6)
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
    if (await this._isQuietHours()) return;

    const list = Array.isArray(scripts) ? scripts : [scripts];
    if (list.length === 0) return;

    // Track for weekly digest
    await this._addDigestData('updatedScripts', list.map(s => ({
      id: s.id,
      name: s.name,
      version: s.version,
      oldVersion: s.oldVersion || null,
      timestamp: Date.now()
    })));

    let title, message, notifId;

    if (list.length === 1) {
      const s = list[0];
      title = 'Script Updated';
      message = `${s.name} updated to v${s.version}`;
      notifId = `update-${s.id}-${Date.now()}`;
    } else {
      title = `${list.length} Scripts Updated`;
      message = list.map(s => s.name).join(', ');
      notifId = `update-batch-${Date.now()}`;
    }

    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title,
        message,
        priority: 0
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create update notification:', e);
    }

    // Store click context so we can open the dashboard to the right script
    await this._setClickContext(notifId, {
      action: 'openScript',
      scriptId: list.length === 1 ? list[0].id : null
    });
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

    // Load/init error count tracker
    if (!this._errorCounts) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
      this._errorCounts = data[this.STORAGE_KEY_ERROR_COUNTS] || {};
    }
    if (!this._rateLimits) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_RATE_LIMITS);
      this._rateLimits = data[this.STORAGE_KEY_RATE_LIMITS] || {};
    }

    // Increment consecutive error count
    this._errorCounts[scriptId] = (this._errorCounts[scriptId] || 0) + 1;
    await chrome.storage.local.set({ [this.STORAGE_KEY_ERROR_COUNTS]: this._errorCounts });

    // Track for digest
    await this._addDigestData('errors', [{
      scriptId,
      message: typeof error === 'string' ? error : (error?.message || 'Unknown error'),
      timestamp: Date.now()
    }]);

    // Only notify after 3 consecutive errors
    if (this._errorCounts[scriptId] < 3) return;

    // Rate limit: max 1 notification per script per hour
    const lastNotif = this._rateLimits[scriptId] || 0;
    const ONE_HOUR = 3600000;
    if (Date.now() - lastNotif < ONE_HOUR) return;

    // Check quiet hours
    if (await this._isQuietHours()) return;

    // Build notification
    const errorMsg = typeof error === 'string' ? error : (error?.message || 'Unknown error');
    const snippet = errorMsg.length > 120 ? errorMsg.substring(0, 117) + '...' : errorMsg;

    // Try to resolve script name
    let scriptName = scriptId;
    try {
      if (typeof ScriptStorage !== 'undefined') {
        const script = await ScriptStorage.get(scriptId);
        if (script?.meta?.name) scriptName = script.meta.name;
      }
    } catch (_) { /* ignore */ }

    const notifId = `error-${scriptId}-${Date.now()}`;
    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: `Script Error: ${scriptName}`,
        message: `${this._errorCounts[scriptId]} consecutive errors\n${snippet}`,
        priority: 1
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create error notification:', e);
    }

    // Update rate limit
    this._rateLimits[scriptId] = Date.now();
    await chrome.storage.local.set({ [this.STORAGE_KEY_RATE_LIMITS]: this._rateLimits });

    await this._setClickContext(notifId, {
      action: 'openScript',
      scriptId
    });
  },

  /**
   * Reset the consecutive error count for a script (call on successful execution).
   */
  async resetErrorCount(scriptId) {
    if (!this._errorCounts) {
      const data = await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);
      this._errorCounts = data[this.STORAGE_KEY_ERROR_COUNTS] || {};
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
    // Security alerts ignore quiet hours — they are urgent

    let scriptName = scriptId;
    try {
      if (typeof ScriptStorage !== 'undefined') {
        const script = await ScriptStorage.get(scriptId);
        if (script?.meta?.name) scriptName = script.meta.name;
      }
    } catch (_) { /* ignore */ }

    const notifId = `blacklist-${scriptId}-${Date.now()}`;
    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'Security Warning',
        message: `${scriptName}: ${reason}`,
        priority: 2,
        requireInteraction: true
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create blacklist notification:', e);
    }

    // Track for digest
    await this._addDigestData('securityAlerts', [{
      scriptId,
      scriptName,
      reason,
      timestamp: Date.now()
    }]);

    await this._setClickContext(notifId, {
      action: 'openScript',
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

    // Check if alarm already exists
    const existing = await chrome.alarms.get(this.ALARM_WEEKLY_DIGEST);
    if (existing) return;

    // Schedule to fire in 7 days, repeating weekly
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    await chrome.alarms.create(this.ALARM_WEEKLY_DIGEST, {
      delayInMinutes: WEEK_MS / 60000,
      periodInMinutes: WEEK_MS / 60000
    });
    console.log('[ScriptVault] Weekly digest alarm scheduled');
  },

  /**
   * Generate and display the weekly digest.
   * Compiles: scripts updated, errors encountered, storage usage, stale scripts.
   */
  async generateDigest() {
    const data = await chrome.storage.local.get(this.STORAGE_KEY_DIGEST);
    const digest = data[this.STORAGE_KEY_DIGEST] || this._emptyDigest();

    // Calculate storage usage
    let storageUsage = null;
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate) {
        storageUsage = {
          used: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      }
    } catch (_) { /* storage estimate not available in all contexts */ }

    // Find stale scripts (not updated in 90+ days)
    let staleScripts = [];
    try {
      if (typeof ScriptStorage !== 'undefined') {
        const all = await ScriptStorage.getAll();
        const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        staleScripts = all
          .filter(s => s.updatedAt && (now - s.updatedAt) > NINETY_DAYS)
          .map(s => ({ id: s.id, name: s.meta?.name || 'Unknown', lastUpdated: s.updatedAt }));
      }
    } catch (_) { /* ignore */ }

    const summary = {
      period: {
        start: digest.periodStart || Date.now() - (7 * 24 * 60 * 60 * 1000),
        end: Date.now()
      },
      updatedScripts: digest.updatedScripts || [],
      totalErrors: (digest.errors || []).length,
      uniqueErrorScripts: [...new Set((digest.errors || []).map(e => e.scriptId))].length,
      securityAlerts: digest.securityAlerts || [],
      storageUsage,
      staleScripts,
      generatedAt: Date.now()
    };

    // Build notification message
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
    if (storageUsage) {
      const pct = ((storageUsage.used / storageUsage.quota) * 100).toFixed(1);
      lines.push(`Storage: ${pct}% used`);
    }

    if (lines.length === 0) {
      lines.push('No activity this week');
    }

    // Show notification (skip quiet hours check for digest — it fires at its scheduled time)
    const notifId = `digest-${Date.now()}`;
    try {
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'ScriptVault Weekly Digest',
        message: lines.join('\n'),
        priority: 0
      });
    } catch (e) {
      console.error('[ScriptVault] Failed to create digest notification:', e);
    }

    // Store the compiled digest for dashboard access
    summary.message = lines.join('\n');
    await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: {
      ...this._emptyDigest(),
      lastSummary: summary
    }});

    await this._setClickContext(notifId, { action: 'openDashboard' });

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
    const data = await chrome.storage.local.get(ctxKey);
    const ctx = data[ctxKey];
    await chrome.storage.local.remove(ctxKey);
    chrome.notifications.clear(notifId);

    if (!ctx) return;

    const dashboardUrl = chrome.runtime.getURL('pages/dashboard.html');

    if (ctx.action === 'openScript' && ctx.scriptId) {
      try {
        await chrome.tabs.create({ url: `${dashboardUrl}#script=${ctx.scriptId}` });
      } catch (_) {
        await chrome.tabs.create({ url: dashboardUrl });
      }
    } else if (ctx.action === 'openDashboard') {
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
    const digest = data[this.STORAGE_KEY_DIGEST] || this._emptyDigest();

    if (!digest[field]) digest[field] = [];
    digest[field].push(...items);

    // Cap stored digest entries to prevent unbounded growth
    const MAX_DIGEST_ENTRIES = 200;
    if (digest[field].length > MAX_DIGEST_ENTRIES) {
      digest[field] = digest[field].slice(-MAX_DIGEST_ENTRIES);
    }

    await chrome.storage.local.set({ [this.STORAGE_KEY_DIGEST]: digest });
  },

  async _setClickContext(notifId, context) {
    const ctxKey = `notifCtx_${notifId}`;
    await chrome.storage.local.set({ [ctxKey]: context });

    // Auto-clean after 5 minutes to avoid storage cruft
    setTimeout(async () => {
      try {
        await chrome.storage.local.remove(ctxKey);
      } catch (_) { /* ignore */ }
    }, 5 * 60 * 1000);
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
    console.log('[ScriptVault] Notification system initialized');
  }
};

// ============================================================================
// INLINED: sync-easycloud.js - Zero-Config Google Cloud Sync (EasyCloud)
// Uses chrome.identity.getAuthToken for one-click Google Drive sync
// (inlined to bypass Chrome service worker importScripts caching)
// ============================================================================

var EasyCloudSync = (() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const TAG = '[EasyCloud]';
  const ALARM_NAME = 'easycloud-periodic-sync';
  const ALARM_PERIOD_MINUTES = 15;
  const DEBOUNCE_MS = 5000;
  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
  const SYNC_FILE_NAME = 'scriptvault-sync.json';
  const STORAGE_KEY_PREFIX = 'easycloud_';

  // Storage keys
  const KEYS = {
    CONNECTED:    STORAGE_KEY_PREFIX + 'connected',
    DEVICE_ID:    STORAGE_KEY_PREFIX + 'deviceId',
    LAST_SYNC:    STORAGE_KEY_PREFIX + 'lastSync',
    STATUS:       STORAGE_KEY_PREFIX + 'status',
    OFFLINE_QUEUE: STORAGE_KEY_PREFIX + 'offlineQueue',
    USER_EMAIL:   STORAGE_KEY_PREFIX + 'userEmail',
    USER_NAME:    STORAGE_KEY_PREFIX + 'userName',
    FILE_ID:      STORAGE_KEY_PREFIX + 'fileId',
  };

  // Sync statuses
  const STATUS = {
    IDLE:    'synced',
    SYNCING: 'syncing',
    ERROR:   'error',
    OFFLINE: 'offline',
  };

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------

  let _status = STATUS.IDLE;
  let _syncInProgress = false;
  let _debounceTimer = null;
  let _statusListeners = [];
  let _cachedToken = null;
  let _cachedFileId = null;
  let _deviceId = null;
  let _initialized = false;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function log(...args) {
    console.log(TAG, ...args);
  }

  function warn(...args) {
    console.warn(TAG, ...args);
  }

  function setStatus(newStatus) {
    if (_status === newStatus) return;
    _status = newStatus;
    _persistStatus(newStatus);
    for (const cb of _statusListeners) {
      try { cb(newStatus); } catch (e) { warn('Status listener error:', e); }
    }
  }

  async function _persistStatus(status) {
    try {
      await chrome.storage.local.set({ [KEYS.STATUS]: status });
    } catch (_) { /* best effort */ }
  }

  async function _getStorageValues(keys) {
    return chrome.storage.local.get(keys);
  }

  async function _setStorageValues(obj) {
    return chrome.storage.local.set(obj);
  }

  /**
   * Generate or retrieve a stable device ID for conflict resolution.
   */
  async function _ensureDeviceId() {
    if (_deviceId) return _deviceId;
    const data = await _getStorageValues([KEYS.DEVICE_ID]);
    if (data[KEYS.DEVICE_ID]) {
      _deviceId = data[KEYS.DEVICE_ID];
      return _deviceId;
    }
    // Generate a new device ID
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    _deviceId = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    await _setStorageValues({ [KEYS.DEVICE_ID]: _deviceId });
    return _deviceId;
  }

  function _isOnline() {
    // In service worker context, navigator.onLine is available
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // ---------------------------------------------------------------------------
  // Token management via chrome.identity
  // ---------------------------------------------------------------------------

  /**
   * Get a valid OAuth token using Chrome's built-in identity API.
   * This is the zero-config path: no client ID, no manual OAuth.
   */
  async function _getAuthToken(interactive = false) {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      throw new Error('chrome.identity API not available. Grant the "identity" permission.');
    }

    try {
      // chrome.identity.getAuthToken returns { token } in MV3
      const result = await chrome.identity.getAuthToken({
        interactive,
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
      });

      const token = result?.token || result;
      if (!token || typeof token !== 'string') {
        throw new Error('No token returned from chrome.identity');
      }

      _cachedToken = token;
      return token;
    } catch (e) {
      _cachedToken = null;
      throw e;
    }
  }

  /**
   * Remove cached token and force a fresh one.
   */
  async function _refreshToken() {
    if (_cachedToken) {
      try {
        await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
      } catch (_) { /* ignore */ }
      _cachedToken = null;
    }
    return _getAuthToken(false);
  }

  /**
   * Get a valid token, refreshing if needed.
   */
  async function _getValidToken() {
    // Try cached first
    if (_cachedToken) {
      const ok = await _testToken(_cachedToken);
      if (ok) return _cachedToken;
      // Invalidate and retry
      try {
        await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
      } catch (_) { /* ignore */ }
      _cachedToken = null;
    }

    // Try non-interactive (uses cached Chrome session)
    try {
      return await _getAuthToken(false);
    } catch (_) {
      return null;
    }
  }

  async function _testToken(token) {
    try {
      const resp = await fetch(`${DRIVE_API}/about?fields=user`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return resp.ok;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Google Drive operations (appDataFolder)
  // ---------------------------------------------------------------------------

  /**
   * Find the sync file in appDataFolder.
   */
  async function _findSyncFile(token) {
    // Check cached file ID first
    if (_cachedFileId) {
      // Verify it still exists
      try {
        const resp = await fetch(
          `${DRIVE_API}/files/${_cachedFileId}?fields=id,modifiedTime`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (resp.ok) return _cachedFileId;
      } catch (_) { /* fall through to search */ }
      _cachedFileId = null;
    }

    // Search for the file
    const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
    const resp = await fetch(
      `${DRIVE_API}/files?q=${query}&spaces=appDataFolder&fields=files(id,modifiedTime)`,
      { headers: { 'Authorization': `Bearer ${token}` } }
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
    return file?.id || null;
  }

  /**
   * Download sync data from Drive appDataFolder.
   */
  async function _downloadFromDrive(token) {
    const fileId = await _findSyncFile(token);
    if (!fileId) return null;

    const resp = await fetch(
      `${DRIVE_API}/files/${fileId}?alt=media`,
      { headers: { 'Authorization': `Bearer ${token}` } }
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

  /**
   * Upload sync data to Drive appDataFolder.
   */
  async function _uploadToDrive(token, data) {
    const fileId = await _findSyncFile(token);

    const metadata = {
      name: SYNC_FILE_NAME,
      mimeType: 'application/json',
    };
    if (!fileId) {
      metadata.parents = ['appDataFolder'];
    }

    const boundary = '---EasyCloud' + crypto.getRandomValues(new Uint8Array(8))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      JSON.stringify(data),
      `--${boundary}--`,
    ].join('\r\n');

    const url = fileId
      ? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart`
      : `${DRIVE_UPLOAD_API}/files?uploadType=multipart`;

    const resp = await fetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Drive upload failed (${resp.status}): ${errText}`);
    }

    const result = await resp.json();
    if (result.id && !_cachedFileId) {
      _cachedFileId = result.id;
      await _setStorageValues({ [KEYS.FILE_ID]: result.id });
    }
  }

  // ---------------------------------------------------------------------------
  // Offline queue
  // ---------------------------------------------------------------------------

  async function _enqueueOfflineChange(change) {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const queue = data[KEYS.OFFLINE_QUEUE] || [];
    queue.push({ ...change, queuedAt: Date.now() });
    // Cap queue to 500 entries to avoid storage bloat
    if (queue.length > 500) queue.splice(0, queue.length - 500);
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: queue });
  }

  async function _drainOfflineQueue() {
    const data = await _getStorageValues([KEYS.OFFLINE_QUEUE]);
    const queue = data[KEYS.OFFLINE_QUEUE] || [];
    if (queue.length === 0) return;

    log(`Draining offline queue (${queue.length} entries)`);
    // Clear queue first (sync will pick up current state)
    await _setStorageValues({ [KEYS.OFFLINE_QUEUE]: [] });
    // Trigger a full sync — the current local state already includes queued changes
    await _performSync();
  }

  // ---------------------------------------------------------------------------
  // Merge logic
  // ---------------------------------------------------------------------------

  /**
   * Merge local and remote sync data with multi-device conflict resolution.
   * - Newest wins for enable/disable and metadata
   * - 3-way merge for code changes (delegated to offscreen document)
   * - Tombstone propagation for deletes
   */
  async function _mergeData(localData, remoteData, deviceId) {
    const localScripts = new Map((localData.scripts || []).map(s => [s.id, s]));
    const remoteScripts = new Map((remoteData.scripts || []).map(s => [s.id, s]));

    // Merge tombstones — union of all known deletions
    const localTombstones = localData.tombstones || {};
    const remoteTombstones = remoteData.tombstones || {};
    const mergedTombstones = { ...localTombstones, ...remoteTombstones };

    // Collect all script IDs
    const allIds = new Set([...localScripts.keys(), ...remoteScripts.keys()]);
    const mergedScripts = [];

    for (const id of allIds) {
      // Skip tombstoned scripts
      if (mergedTombstones[id]) continue;

      const local = localScripts.get(id);
      const remote = remoteScripts.get(id);

      if (!remote) {
        // Only local — keep it
        mergedScripts.push(local);
        continue;
      }

      if (!local) {
        // Only remote — import it
        mergedScripts.push(remote);
        continue;
      }

      // Both exist — merge
      const merged = { ...local };
      const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);

      // Enable/disable: newest wins
      if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
        merged.enabled = remote.enabled;
        merged.position = remote.position;
        merged.settings = { ...local.settings, ...remote.settings };
      }

      // Code merge
      if (local.code !== remote.code) {
        const base = local.syncBaseCode || remote.syncBaseCode || null;

        if (base && base !== local.code && base !== remote.code) {
          // Both sides changed since base — attempt 3-way merge
          try {
            if (typeof ScriptAnalyzer !== 'undefined' && ScriptAnalyzer._ensureOffscreen) {
              await ScriptAnalyzer._ensureOffscreen();
              const mergeResult = await chrome.runtime.sendMessage({
                type: 'offscreen_merge',
                base,
                local: local.code,
                remote: remote.code,
              });
              if (mergeResult && !mergeResult.error) {
                merged.code = mergeResult.merged;
                if (mergeResult.conflicts) {
                  merged.settings = { ...(merged.settings || {}), mergeConflict: true };
                }
                log(`3-way merge for ${id}: conflicts=${mergeResult.conflicts || false}`);
              } else {
                // Merge failed — newest wins
                merged.code = localNewer ? local.code : remote.code;
              }
            } else {
              // No offscreen available — newest wins
              merged.code = localNewer ? local.code : remote.code;
            }
          } catch (e) {
            warn(`3-way merge failed for ${id}:`, e.message);
            merged.code = localNewer ? local.code : remote.code;
          }
        } else {
          // Only one side changed, or no base — newest wins
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
      tombstones: mergedTombstones,
    };
  }

  // ---------------------------------------------------------------------------
  // Core sync
  // ---------------------------------------------------------------------------

  async function _performSync() {
    if (_syncInProgress) {
      log('Sync already in progress, skipping');
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
        return { error: 'Not authenticated' };
      }

      const deviceId = await _ensureDeviceId();

      // Load tombstones
      const tombstoneData = await _getStorageValues(['syncTombstones']);
      const tombstones = tombstoneData.syncTombstones || {};

      // Build local data snapshot
      const scripts = await ScriptStorage.getAll();
      const localData = {
        version: 1,
        timestamp: Date.now(),
        deviceId,
        scripts: scripts.map(s => ({
          id: s.id,
          code: s.code,
          enabled: s.enabled,
          position: s.position,
          settings: s.settings || {},
          updatedAt: s.updatedAt || 0,
          syncBaseCode: s.syncBaseCode || null,
        })),
        tombstones,
      };

      // Download remote
      const remoteData = await _downloadFromDrive(token);

      if (remoteData) {
        // Merge
        const merged = await _mergeData(localData, remoteData, deviceId);

        // Apply merged scripts locally
        for (const script of merged.scripts) {
          if (merged.tombstones[script.id]) continue;

          const existing = await ScriptStorage.get(script.id);

          // Skip user-modified scripts
          if (existing?.settings?.userModified) continue;

          if (!existing || script.updatedAt > (existing.updatedAt || 0)) {
            const parsed = typeof parseUserscript === 'function'
              ? parseUserscript(script.code)
              : { meta: {}, error: null };

            if (!parsed.error) {
              await ScriptStorage.set(script.id, {
                id: script.id,
                code: script.code,
                meta: parsed.meta,
                enabled: script.enabled,
                position: script.position,
                settings: {
                  ...(existing?.settings || {}),
                  ...(script.settings || {}),
                  userModified: false,
                },
                updatedAt: script.updatedAt,
                createdAt: existing?.createdAt || script.updatedAt,
                syncBaseCode: script.code,
                lastSyncDevice: deviceId,
              });
            }
          }
        }

        // Persist merged tombstones
        const mergedTombstones = merged.tombstones || {};
        if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
          await chrome.storage.local.set({ syncTombstones: mergedTombstones });
        }

        // Upload merged data
        merged.timestamp = Date.now();
        await _uploadToDrive(token, merged);
      } else {
        // First sync — upload local data
        await _uploadToDrive(token, localData);
      }

      const now = Date.now();
      await _setStorageValues({ [KEYS.LAST_SYNC]: now });

      // Also update the global lastSync for compatibility with existing CloudSync
      try {
        await SettingsManager.set('lastSync', now);
      } catch (_) { /* best effort */ }

      setStatus(STATUS.IDLE);
      log('Sync completed successfully');
      return { success: true, timestamp: now };
    } catch (e) {
      warn('Sync failed:', e);
      setStatus(STATUS.ERROR);
      return { error: e.message };
    } finally {
      _syncInProgress = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Debounced sync trigger
  // ---------------------------------------------------------------------------

  function _debouncedSync() {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
    }
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      _performSync().catch(e => warn('Debounced sync error:', e));
    }, DEBOUNCE_MS);
  }

  // ---------------------------------------------------------------------------
  // Alarm-based periodic sync
  // ---------------------------------------------------------------------------

  async function _setupPeriodicSync() {
    try {
      await chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: ALARM_PERIOD_MINUTES,
        periodInMinutes: ALARM_PERIOD_MINUTES,
      });
    } catch (e) {
      warn('Failed to create periodic sync alarm:', e);
    }
  }

  async function _clearPeriodicSync() {
    try {
      await chrome.alarms.clear(ALARM_NAME);
    } catch (_) { /* ignore */ }
  }

  function _handleAlarm(alarm) {
    if (alarm.name !== ALARM_NAME) return;
    _performSync().catch(e => warn('Periodic sync error:', e));
  }

  // ---------------------------------------------------------------------------
  // Online/offline handling
  // ---------------------------------------------------------------------------

  function _handleOnline() {
    log('Back online, draining queue and syncing');
    _drainOfflineQueue().catch(e => warn('Queue drain error:', e));
  }

  function _handleOffline() {
    log('Went offline');
    setStatus(STATUS.OFFLINE);
  }

  // ---------------------------------------------------------------------------
  // Event listeners for auto-sync on script changes
  // ---------------------------------------------------------------------------

  function _setupStorageListener() {
    // Listen for script storage changes to trigger auto-sync
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      // Check if userscripts data changed (ScriptStorage uses 'userscripts' key)
      if (changes.userscripts) {
        const data = _getStorageValues([KEYS.CONNECTED]).then(d => {
          if (d[KEYS.CONNECTED]) {
            _debouncedSync();
          }
        }).catch(() => {});
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const api = {
    /**
     * Initialize EasyCloud sync. Call once on extension startup.
     * Sets up alarms, listeners, and triggers initial sync if connected.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;

      // Restore cached state
      const data = await _getStorageValues([
        KEYS.CONNECTED,
        KEYS.DEVICE_ID,
        KEYS.STATUS,
        KEYS.FILE_ID,
      ]);

      _deviceId = data[KEYS.DEVICE_ID] || null;
      _cachedFileId = data[KEYS.FILE_ID] || null;

      if (data[KEYS.STATUS]) {
        _status = data[KEYS.STATUS];
      }

      // Set up storage change listener for auto-sync
      _setupStorageListener();

      // Set up alarm listener
      chrome.alarms.onAlarm.addListener(_handleAlarm);

      // Online/offline events (available in service workers)
      if (typeof self !== 'undefined') {
        self.addEventListener('online', _handleOnline);
        self.addEventListener('offline', _handleOffline);
      }

      // If already connected, start periodic sync and do initial sync
      if (data[KEYS.CONNECTED]) {
        if (!_isOnline()) {
          setStatus(STATUS.OFFLINE);
        } else {
          await _setupPeriodicSync();
          // Fire initial sync without blocking init
          _performSync().catch(e => warn('Init sync error:', e));
        }
      }

      log('Initialized');
    },

    /**
     * Connect to Google Drive via chrome.identity (interactive sign-in).
     * Returns { success, user } or { success: false, error }.
     */
    async connect() {
      try {
        // Request identity permission if not already granted
        if (chrome.permissions && chrome.permissions.request) {
          const granted = await chrome.permissions.request({
            permissions: ['identity'],
          });
          if (!granted) {
            return { success: false, error: 'Identity permission denied' };
          }
        }

        // Interactive auth
        const token = await _getAuthToken(true);
        if (!token) {
          return { success: false, error: 'Authentication failed' };
        }

        // Fetch user info
        let user = {};
        try {
          const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (resp.ok) {
            user = await resp.json();
          }
        } catch (_) { /* non-fatal */ }

        await _ensureDeviceId();

        // Persist connected state
        await _setStorageValues({
          [KEYS.CONNECTED]: true,
          [KEYS.USER_EMAIL]: user.email || '',
          [KEYS.USER_NAME]: user.name || '',
        });

        // Start periodic sync
        await _setupPeriodicSync();

        // Trigger immediate sync
        _performSync().catch(e => warn('Post-connect sync error:', e));

        setStatus(STATUS.IDLE);
        log('Connected as', user.email || '(unknown)');

        return {
          success: true,
          user: { email: user.email, name: user.name, picture: user.picture },
        };
      } catch (e) {
        warn('Connect failed:', e);
        return { success: false, error: e.message };
      }
    },

    /**
     * Disconnect from Google Drive. Revokes token and clears state.
     */
    async disconnect() {
      try {
        // Revoke token
        if (_cachedToken) {
          try {
            await chrome.identity.removeCachedAuthToken({ token: _cachedToken });
            await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${_cachedToken}`)
              .catch(() => {});
          } catch (_) { /* best effort */ }
          _cachedToken = null;
        }

        // Clear periodic sync
        await _clearPeriodicSync();

        // Clear stored state
        await _setStorageValues({
          [KEYS.CONNECTED]: false,
          [KEYS.USER_EMAIL]: '',
          [KEYS.USER_NAME]: '',
          [KEYS.FILE_ID]: '',
          [KEYS.OFFLINE_QUEUE]: [],
          [KEYS.STATUS]: STATUS.IDLE,
        });

        _cachedFileId = null;
        _status = STATUS.IDLE;

        // Notify listeners
        for (const cb of _statusListeners) {
          try { cb(STATUS.IDLE); } catch (_) { /* ignore */ }
        }

        log('Disconnected');
        return { success: true };
      } catch (e) {
        warn('Disconnect error:', e);
        return { success: false, error: e.message };
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
        return { error: 'Not connected. Call connect() first.' };
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
        KEYS.DEVICE_ID,
      ]);

      return {
        connected: !!data[KEYS.CONNECTED],
        status: data[KEYS.STATUS] || _status,
        lastSync: data[KEYS.LAST_SYNC] || null,
        user: data[KEYS.CONNECTED]
          ? { email: data[KEYS.USER_EMAIL], name: data[KEYS.USER_NAME] }
          : null,
        deviceId: data[KEYS.DEVICE_ID] || null,
        online: _isOnline(),
      };
    },

    /**
     * Check if currently connected (synchronous, uses cached state).
     */
    isConnected() {
      // This is a fast synchronous check based on in-memory state.
      // For authoritative state, use getStatus().
      return _status !== STATUS.ERROR && _cachedToken !== null;
    },

    /**
     * Register a status change callback. Returns an unsubscribe function.
     */
    onStatusChange(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('onStatusChange requires a function callback');
      }
      _statusListeners.push(callback);
      return () => {
        _statusListeners = _statusListeners.filter(cb => cb !== callback);
      };
    },

    /**
     * Notify EasyCloud that a script was saved (triggers debounced sync).
     */
    notifyScriptSaved(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: 'save', scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    },

    /**
     * Notify EasyCloud that a script was deleted (triggers debounced sync).
     */
    notifyScriptDeleted(scriptId) {
      if (!_isOnline()) {
        _enqueueOfflineChange({ type: 'delete', scriptId, timestamp: Date.now() });
        return;
      }
      _debouncedSync();
    },
  };

  return api;
})();

// ---------------------------------------------------------------------------
// Register as a CloudSyncProvider for integration with existing sync UI
// ---------------------------------------------------------------------------

if (typeof CloudSyncProviders !== 'undefined') {
  CloudSyncProviders.easycloud = {
    name: 'EasyCloud (Google)',
    icon: '⚡',
    requiresAuth: false,
    requiresOAuth: false,
    isZeroConfig: true,

    async connect() {
      return EasyCloudSync.connect();
    },

    async disconnect() {
      return EasyCloudSync.disconnect();
    },

    async upload(data, settings) {
      // EasyCloud manages its own upload via sync(); this is for compatibility
      const result = await EasyCloudSync.sync();
      if (result.error) throw new Error(result.error);
      return { success: true, timestamp: Date.now() };
    },

    async download(settings) {
      // For compatibility: trigger sync and return null (data is applied locally by sync)
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
        lastSync: status.lastSync,
      };
    },
  };
}

// Export for service worker global scope
if (typeof self !== 'undefined') {
  self.EasyCloudSync = EasyCloudSync;
}

// ============================================================================
// ScriptVault — Automated Backup Scheduler
// Runs in the service worker (no DOM). Provides scheduled and on-change
// backups using chrome.alarms, with configurable retention and recovery.
// ============================================================================

const BackupScheduler = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY_BACKUPS = 'autoBackups';
  const STORAGE_KEY_SETTINGS = 'backupSchedulerSettings';
  const ALARM_NAME = 'sv_backup_scheduled';
  const DEBOUNCE_ALARM = 'sv_backup_debounce';
  const DEBOUNCE_MINUTES = 5;
  const STORAGE_WARNING_BYTES = 8 * 1024 * 1024; // 8 MB

  const DEFAULT_SETTINGS = {
    enabled: false,
    scheduleType: 'daily',    // 'daily' | 'weekly' | 'onChange' | 'manual'
    hour: 3,                  // 0-23, default 3:00 AM
    dayOfWeek: 0,             // 0=Sun .. 6=Sat (for weekly)
    maxBackups: 5,            // retention limit
    notifyOnSuccess: true,
    notifyOnFailure: true,
    warnOnStorageFull: true
  };

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _settings = null;
  let _initialized = false;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  /** Compute the next Date for a given hour (and optional dayOfWeek). */
  function _nextScheduledTime(hour, dayOfWeek) {
    const now = new Date();
    const target = new Date(now);
    target.setHours(hour, 0, 0, 0);

    if (dayOfWeek !== undefined && dayOfWeek !== null) {
      // Weekly — advance to the correct day
      const currentDay = now.getDay();
      let daysUntil = (dayOfWeek - currentDay + 7) % 7;
      if (daysUntil === 0 && now >= target) daysUntil = 7;
      target.setDate(target.getDate() + daysUntil);
    } else {
      // Daily — if the hour already passed today, schedule for tomorrow
      if (now >= target) target.setDate(target.getDate() + 1);
    }
    return target;
  }

  /** Send a chrome notification (best-effort, no throw). */
  function _notify(title, message, isError = false) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: `ScriptVault — ${title}`,
        message
      });
    } catch (_) { /* notifications permission may not exist */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Settings                                                           */
  /* ------------------------------------------------------------------ */

  async function _loadSettings() {
    if (_settings) return _settings;
    const data = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
    _settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEY_SETTINGS] || {}) };
    return _settings;
  }

  async function _saveSettings(settings) {
    _settings = { ...DEFAULT_SETTINGS, ...settings };
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: _settings });
  }

  /* ------------------------------------------------------------------ */
  /*  Backup data collection                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Collect all data that should be in a backup and produce a base64 ZIP
   * by reusing the same fflate-based pattern as exportToZip.
   */
  async function _collectBackupData() {
    // Scripts — code + metadata + settings
    const scripts = await ScriptStorage.getAll();
    const files = {};
    const usedNames = new Set();

    for (const script of scripts) {
      let safeName = (script.meta?.name || 'unnamed')
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

      // Userscript code
      files[`scripts/${safeName}.user.js`] = fflate.strToU8(script.code || '');

      // Options / metadata
      const options = {
        settings: {
          enabled: script.enabled,
          'run-at': script.meta?.['run-at'] || 'document-idle'
        },
        meta: {
          name: script.meta?.name,
          namespace: script.meta?.namespace || '',
          version: script.meta?.version || '1.0',
          description: script.meta?.description || '',
          author: script.meta?.author || '',
          match: script.meta?.match || [],
          include: script.meta?.include || [],
          exclude: script.meta?.exclude || [],
          grant: script.meta?.grant || [],
          require: script.meta?.require || [],
          resource: script.meta?.resource || {}
        }
      };
      files[`scripts/${safeName}.options.json`] = fflate.strToU8(JSON.stringify(options, null, 2));

      // Script values (GM_getValue data)
      try {
        const values = await ScriptValues.getAll(script.id);
        if (values && Object.keys(values).length > 0) {
          files[`scripts/${safeName}.storage.json`] = fflate.strToU8(JSON.stringify({ data: values }, null, 2));
        }
      } catch (_) { /* ScriptValues may not be available */ }
    }

    // Global settings
    try {
      const globalSettings = await SettingsManager.get();
      files['global-settings.json'] = fflate.strToU8(JSON.stringify(globalSettings, null, 2));
    } catch (_) {}

    // Folder structure (if any)
    try {
      const folderData = await chrome.storage.local.get('scriptFolders');
      if (folderData.scriptFolders) {
        files['folders.json'] = fflate.strToU8(JSON.stringify(folderData.scriptFolders, null, 2));
      }
    } catch (_) {}

    // Workspace snapshots
    try {
      const wsData = await chrome.storage.local.get('workspaces');
      if (wsData.workspaces) {
        files['workspaces.json'] = fflate.strToU8(JSON.stringify(wsData.workspaces, null, 2));
      }
    } catch (_) {}

    // Compress
    const zipData = fflate.zipSync(files, { level: 6 });
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < zipData.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, zipData.subarray(i, i + chunkSize));
    }
    return { base64: btoa(binary), scriptCount: scripts.length };
  }

  /* ------------------------------------------------------------------ */
  /*  Storage helpers                                                    */
  /* ------------------------------------------------------------------ */

  async function _getBackupList() {
    const data = await chrome.storage.local.get(STORAGE_KEY_BACKUPS);
    return data[STORAGE_KEY_BACKUPS] || [];
  }

  async function _saveBackupList(list) {
    await chrome.storage.local.set({ [STORAGE_KEY_BACKUPS]: list });
  }

  /** Estimate combined size of all stored backups (bytes). */
  function _estimateBackupSize(backups) {
    let total = 0;
    for (const b of backups) {
      // base64 string length is ~4/3 of binary; approximate storage cost
      total += (b.data?.length || 0);
    }
    return total;
  }

  /* ------------------------------------------------------------------ */
  /*  Alarm management                                                   */
  /* ------------------------------------------------------------------ */

  async function _registerAlarms() {
    // Clear existing backup alarms
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(DEBOUNCE_ALARM);

    const settings = await _loadSettings();
    if (!settings.enabled) return;

    if (settings.scheduleType === 'daily') {
      const nextRun = _nextScheduledTime(settings.hour);
      const delayMs = nextRun.getTime() - Date.now();
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 24 * 60 // repeat every 24 hours
      });
    } else if (settings.scheduleType === 'weekly') {
      const nextRun = _nextScheduledTime(settings.hour, settings.dayOfWeek);
      chrome.alarms.create(ALARM_NAME, {
        when: nextRun.getTime(),
        periodInMinutes: 7 * 24 * 60 // repeat every 7 days
      });
    }
    // 'onChange' and 'manual' don't need periodic alarms
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  const api = {

    /**
     * Initialize the backup scheduler. Call once on service worker start.
     * Re-registers alarms and attaches the alarm listener.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;

      await _loadSettings();
      await _registerAlarms();

      // Listen for backup-related alarms
      chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === ALARM_NAME) {
          await api.createBackup('scheduled');
        } else if (alarm.name === DEBOUNCE_ALARM) {
          await api.createBackup('onChange');
        }
      });
    },

    /**
     * Trigger a backup.
     * @param {string} reason - 'scheduled' | 'onChange' | 'manual'
     * @returns {{ success: boolean, backupId?: string, error?: string }}
     */
    async createBackup(reason = 'manual') {
      try {
        const { base64, scriptCount } = await _collectBackupData();
        const sizeBytes = Math.round(base64.length * 0.75); // approximate binary size
        const settings = await _loadSettings();

        const backup = {
          id: _generateId(),
          timestamp: Date.now(),
          version: chrome.runtime.getManifest?.()?.version || '1.0',
          reason,
          scriptCount,
          size: sizeBytes,
          sizeFormatted: _formatBytes(sizeBytes),
          data: base64
        };

        const backups = await _getBackupList();
        backups.unshift(backup); // newest first
        await _saveBackupList(backups);

        // Prune old backups
        await api.pruneOldBackups();

        // Storage warning check
        if (settings.warnOnStorageFull) {
          const allBackups = await _getBackupList();
          const totalSize = _estimateBackupSize(allBackups);
          if (totalSize > STORAGE_WARNING_BYTES) {
            _notify('Storage Warning',
              `Backup storage is using ${_formatBytes(totalSize)}. Consider reducing the backup limit or deleting old backups.`,
              true);
          }
        }

        // Success notification
        if (settings.notifyOnSuccess) {
          _notify('Backup Complete',
            `${reason.charAt(0).toUpperCase() + reason.slice(1)} backup created with ${scriptCount} scripts (${_formatBytes(sizeBytes)}).`);
        }

        return { success: true, backupId: backup.id };
      } catch (err) {
        const settings = await _loadSettings();
        if (settings.notifyOnFailure) {
          _notify('Backup Failed', `Error: ${err.message || err}`, true);
        }
        console.error('[BackupScheduler] createBackup error:', err);
        return { success: false, error: err.message || String(err) };
      }
    },

    /**
     * Get all stored backups (without full data blobs to save memory).
     * @returns {Array<{ id, timestamp, version, reason, scriptCount, size, sizeFormatted }>}
     */
    async getBackups() {
      const backups = await _getBackupList();
      return backups.map(b => ({
        id: b.id,
        timestamp: b.timestamp,
        version: b.version,
        reason: b.reason,
        scriptCount: b.scriptCount,
        size: b.size,
        sizeFormatted: b.sizeFormatted
      }));
    },

    /**
     * Restore from a backup.
     * @param {string} backupId
     * @param {{ selective?: boolean, scriptIds?: string[] }} options
     *   If selective = true, only restore scripts whose original IDs are in scriptIds.
     *   Otherwise full restore (scripts, settings, folders, workspaces).
     */
    async restoreBackup(backupId, options = {}) {
      const backups = await _getBackupList();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return { success: false, error: 'Backup not found' };

      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);
        let restoredScripts = 0;

        // --- Restore scripts ---
        const userScripts = fileNames.filter(n => n.endsWith('.user.js'));
        for (const filename of userScripts) {
          const code = fflate.strFromU8(unzipped[filename]);
          const baseName = filename.replace(/\.user\.js$/, '');

          // Parse metadata to get script identity
          let optionsMeta = {};
          const optionsFile = `${baseName}.options.json`;
          if (unzipped[optionsFile]) {
            try { optionsMeta = JSON.parse(fflate.strFromU8(unzipped[optionsFile])); } catch (_) {}
          }

          // Selective filtering: match by name
          if (options.selective && Array.isArray(options.scriptIds)) {
            const scriptName = optionsMeta.meta?.name || baseName.replace(/^scripts\//, '');
            if (!options.scriptIds.includes(scriptName)) continue;
          }

          // Use the existing importFromZip pipeline for each script
          try {
            await importFromZip(backup.data, { overwrite: true });
            restoredScripts = userScripts.length;
            break; // importFromZip handles all scripts at once
          } catch (importErr) {
            console.warn('[BackupScheduler] Script import error:', importErr);
          }
          break; // only call once
        }

        // --- Restore global settings (full restore only) ---
        if (!options.selective) {
          if (unzipped['global-settings.json']) {
            try {
              const settings = JSON.parse(fflate.strFromU8(unzipped['global-settings.json']));
              await SettingsManager.set(settings);
            } catch (_) {}
          }

          // Restore folders
          if (unzipped['folders.json']) {
            try {
              const folders = JSON.parse(fflate.strFromU8(unzipped['folders.json']));
              await chrome.storage.local.set({ scriptFolders: folders });
            } catch (_) {}
          }

          // Restore workspaces
          if (unzipped['workspaces.json']) {
            try {
              const workspaces = JSON.parse(fflate.strFromU8(unzipped['workspaces.json']));
              await chrome.storage.local.set({ workspaces });
            } catch (_) {}
          }
        }

        return { success: true, restoredScripts };
      } catch (err) {
        console.error('[BackupScheduler] restoreBackup error:', err);
        return { success: false, error: err.message || String(err) };
      }
    },

    /**
     * Delete a specific backup.
     * @param {string} backupId
     */
    async deleteBackup(backupId) {
      const backups = await _getBackupList();
      const filtered = backups.filter(b => b.id !== backupId);
      if (filtered.length === backups.length) return { success: false, error: 'Backup not found' };
      await _saveBackupList(filtered);
      return { success: true };
    },

    /**
     * Export a backup as a downloadable object (base64 ZIP + suggested filename).
     * @param {string} backupId
     * @returns {{ zipData: string, filename: string } | null}
     */
    async exportBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return null;

      const dateStr = new Date(backup.timestamp).toISOString().replace(/[:.]/g, '-');
      return {
        zipData: backup.data,
        filename: `scriptvault-autobackup-${dateStr}.zip`
      };
    },

    /**
     * Import a backup from externally provided base64 ZIP data.
     * @param {string} data - base64-encoded ZIP
     * @returns {{ success: boolean, backupId?: string, error?: string }}
     */
    async importBackup(data) {
      try {
        // Validate that the data is a valid ZIP
        const binaryString = atob(data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const scriptFiles = Object.keys(unzipped).filter(n => n.endsWith('.user.js'));

        const sizeBytes = Math.round(data.length * 0.75);
        const backup = {
          id: _generateId(),
          timestamp: Date.now(),
          version: 'imported',
          reason: 'imported',
          scriptCount: scriptFiles.length,
          size: sizeBytes,
          sizeFormatted: _formatBytes(sizeBytes),
          data
        };

        const backups = await _getBackupList();
        backups.unshift(backup);
        await _saveBackupList(backups);
        await api.pruneOldBackups();

        return { success: true, backupId: backup.id };
      } catch (err) {
        console.error('[BackupScheduler] importBackup error:', err);
        return { success: false, error: err.message || String(err) };
      }
    },

    /**
     * Get current scheduler settings.
     * @returns {object}
     */
    getSettings() {
      return { ...(DEFAULT_SETTINGS), ...(_settings || {}) };
    },

    /**
     * Update scheduler settings and re-register alarms.
     * @param {object} settings - partial settings to merge
     */
    async setSettings(settings) {
      const merged = { ...(await _loadSettings()), ...settings };
      await _saveSettings(merged);
      await _registerAlarms();
      return { ..._settings };
    },

    /**
     * Remove old backups exceeding the retention limit.
     */
    async pruneOldBackups() {
      const settings = await _loadSettings();
      const backups = await _getBackupList();
      if (backups.length <= settings.maxBackups) return;

      // Keep the newest N
      const pruned = backups.slice(0, settings.maxBackups);
      await _saveBackupList(pruned);
    },

    /**
     * Called externally when a script is installed, updated, or deleted.
     * If scheduleType is 'onChange', sets a debounce alarm.
     */
    async onScriptChanged() {
      const settings = await _loadSettings();
      if (!settings.enabled || settings.scheduleType !== 'onChange') return;

      // Debounce: clear any pending alarm and set a new one
      await chrome.alarms.clear(DEBOUNCE_ALARM);
      chrome.alarms.create(DEBOUNCE_ALARM, {
        delayInMinutes: DEBOUNCE_MINUTES
      });
    },

    /**
     * Get a detailed manifest of what's inside a specific backup
     * (script names and sizes) without decompressing the whole thing to memory.
     * @param {string} backupId
     * @returns {Array<{ name: string, hasStorage: boolean }>}
     */
    async inspectBackup(backupId) {
      const backups = await _getBackupList();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return null;

      try {
        const binaryString = atob(backup.data);
        const zipBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          zipBytes[i] = binaryString.charCodeAt(i);
        }
        const unzipped = fflate.unzipSync(zipBytes);
        const fileNames = Object.keys(unzipped);

        const scripts = fileNames
          .filter(n => n.endsWith('.user.js'))
          .map(n => {
            const baseName = n.replace(/\.user\.js$/, '');
            const displayName = baseName.replace(/^scripts\//, '');
            return {
              name: displayName,
              hasStorage: !!unzipped[`${baseName}.storage.json`]
            };
          });

        return scripts;
      } catch (err) {
        console.error('[BackupScheduler] inspectBackup error:', err);
        return null;
      }
    }
  };

  return api;
})();

// ============================================================================
// ScriptVault — UserStyles/CSS Engine
// ============================================================================
// Parses UserCSS (==UserStyle==) format, manages CSS style registration,
// variable substitution, Stylus backup import, and userscript conversion.
// Runs in service worker context (no DOM).

const UserStylesEngine = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_userstyles';
  const VARS_STORAGE_KEY = 'sv_userstyle_vars';
  const META_REGEX = /\/\*\s*==UserStyle==\s*([\s\S]*?)==\/UserStyle==\s*\*\//;
  const VAR_TYPES = ['color', 'text', 'number', 'select', 'checkbox', 'range'];
  const DIRECTIVE_REGEX = /^@(\S+)\s+(.*?)\s*$/;

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _styles = {};       // { styleId: styleObject }
  let _customVars = {};   // { styleId: { varName: value } }
  let _initialized = false;
  let _registeredTabs = new Map(); // tabId -> Set<styleId>

  /* ------------------------------------------------------------------ */
  /*  Storage helpers                                                    */
  /* ------------------------------------------------------------------ */

  async function _loadState() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, VARS_STORAGE_KEY]);
      _styles = data[STORAGE_KEY] || {};
      _customVars = data[VARS_STORAGE_KEY] || {};
    } catch (e) {
      console.error('[UserStylesEngine] Failed to load state:', e);
      _styles = {};
      _customVars = {};
    }
  }

  async function _saveStyles() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _styles });
    } catch (e) {
      console.error('[UserStylesEngine] Failed to save styles:', e);
    }
  }

  async function _saveVars() {
    try {
      await chrome.storage.local.set({ [VARS_STORAGE_KEY]: _customVars });
    } catch (e) {
      console.error('[UserStylesEngine] Failed to save variables:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  @var parsing                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Parse a single @var directive.
   * Formats:
   *   @var color  my-color  "Label"  #ff0000
   *   @var select my-select "Label"  {opt1:val1|opt2:val2}
   *   @var range  my-range  "Label"  [0, 100, 1, 50]
   *   @var number my-num    "Label"  42
   *   @var text   my-text   "Label"  "default value"
   *   @var checkbox my-chk  "Label"  0
   */
  function _parseVarDirective(type, rest) {
    // Extract: varName "Label" defaultValue
    const nameMatch = rest.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);
    if (!nameMatch) {
      const simpleMatch = rest.match(/^(\S+)\s+(.*)$/);
      if (!simpleMatch) return null;
      return {
        type,
        name: simpleMatch[1],
        label: simpleMatch[1],
        default: simpleMatch[2].trim(),
        options: null,
      };
    }

    const varName = nameMatch[1];
    const label = nameMatch[2];
    let defaultVal = nameMatch[3].trim();
    let options = null;

    switch (type) {
      case 'color':
        // Default is a color value like #ff0000 or rgba(...)
        break;

      case 'text':
        // Strip surrounding quotes if present
        if (/^".*"$/.test(defaultVal)) {
          defaultVal = defaultVal.slice(1, -1);
        }
        break;

      case 'number':
        defaultVal = parseFloat(defaultVal) || 0;
        break;

      case 'checkbox':
        defaultVal = defaultVal === '1' || defaultVal === 'true';
        break;

      case 'select': {
        // {opt1:"Label 1"|opt2:"Label 2"} or {"Label 1":"val1","Label 2":"val2"}
        const braceMatch = defaultVal.match(/^\{([\s\S]*)\}$/);
        if (braceMatch) {
          options = {};
          const inner = braceMatch[1];
          // Try JSON-style first
          try {
            options = JSON.parse(`{${inner}}`);
            defaultVal = Object.keys(options)[0] || '';
          } catch {
            // Pipe-separated: key:value|key:value or "label":value
            const pairs = inner.split('|');
            let firstKey = null;
            for (const pair of pairs) {
              const kv = pair.match(/^"?([^":]+)"?\s*:\s*"?([^"|]*)"?\s*$/);
              if (kv) {
                options[kv[1].trim()] = kv[2].trim();
                if (!firstKey) firstKey = kv[1].trim();
              }
            }
            defaultVal = firstKey || '';
          }
        }
        break;
      }

      case 'range': {
        // [min, max, step, default] e.g. [0, 100, 1, 50]
        const arrMatch = defaultVal.match(/^\[([\s\S]*)\]$/);
        if (arrMatch) {
          const parts = arrMatch[1].split(',').map(s => parseFloat(s.trim()));
          options = {
            min: parts[0] ?? 0,
            max: parts[1] ?? 100,
            step: parts[2] ?? 1,
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

  /* ------------------------------------------------------------------ */
  /*  UserCSS parser                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Parse UserCSS source code.
   * @param {string} code - Full UserCSS file content
   * @returns {{ meta: Object, variables: Object[], css: string, error?: string }}
   */
  function parseUserCSS(code) {
    const metaMatch = code.match(META_REGEX);
    if (!metaMatch) {
      return { error: 'No ==UserStyle== metadata block found.' };
    }

    const meta = {
      name: 'Unnamed Style',
      namespace: 'scriptvault',
      version: '1.0.0',
      description: '',
      author: '',
      license: '',
      preprocessor: 'default',
      homepageURL: '',
      supportURL: '',
      updateURL: '',
    };
    const variables = [];

    const metaBlock = metaMatch[1];
    const lines = metaBlock.split('\n');

    for (const line of lines) {
      const trimmed = line.replace(/^\s*\*?\s*/, '').trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      const match = trimmed.match(DIRECTIVE_REGEX);
      if (!match) continue;

      const key = match[1];
      const value = match[2];

      if (key === 'var') {
        // @var type name "label" default
        const varTypeMatch = value.match(/^(\S+)\s+([\s\S]+)$/);
        if (varTypeMatch && VAR_TYPES.includes(varTypeMatch[1])) {
          const parsed = _parseVarDirective(varTypeMatch[1], varTypeMatch[2]);
          if (parsed) variables.push(parsed);
        }
      } else if (key in meta) {
        meta[key] = value;
      }
    }

    // Extract CSS body (everything outside the meta block)
    const metaEnd = code.indexOf('==/UserStyle==');
    const afterMeta = code.indexOf('*/', metaEnd);
    let css = '';
    if (afterMeta !== -1) {
      css = code.substring(afterMeta + 2).trim();
    }

    return { meta, variables, css };
  }

  /* ------------------------------------------------------------------ */
  /*  Variable substitution                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Apply variable values to CSS template.
   * Replaces /*[[varName]]*​/ patterns (UserCSS convention)
   * and var(--varName) custom property patterns.
   */
  function _substituteVariables(css, variables, customValues) {
    let result = css;

    for (const v of variables) {
      const val = customValues && customValues[v.name] !== undefined
        ? customValues[v.name]
        : v.default;

      // Replace /*[[varName]]*/ placeholders
      const placeholder = new RegExp(
        '/\\*\\[\\[' + _escapeRegex(v.name) + '\\]\\]\\*/', 'g'
      );
      result = result.replace(placeholder, String(val));

      // Replace <<varName>> placeholders (less-style)
      const anglePlaceholder = new RegExp(
        '<<' + _escapeRegex(v.name) + '>>', 'g'
      );
      result = result.replace(anglePlaceholder, String(val));
    }

    return result;
  }

  function _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ------------------------------------------------------------------ */
  /*  Style registration via chrome.scripting                            */
  /* ------------------------------------------------------------------ */

  /**
   * Build the final CSS for a style, applying variable substitutions.
   */
  function _buildCSS(styleId) {
    const style = _styles[styleId];
    if (!style) return '';
    const vars = style.variables || [];
    const custom = _customVars[styleId] || {};
    return _substituteVariables(style.css, vars, custom);
  }

  /**
   * Register a style for injection.
   * @param {Object} style - Parsed style object with meta, variables, css
   * @returns {Promise<string>} The assigned style ID
   */
  async function registerStyle(style) {
    if (!_initialized) await _loadState();

    const id = style.id || `usercss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      type: 'usercss',
      meta: style.meta || {},
      variables: style.variables || [],
      css: style.css || '',
      rawCode: style.rawCode || '',
      enabled: style.enabled !== false,
      match: style.match || ['*://*/*'],
      installDate: style.installDate || Date.now(),
      updateDate: Date.now(),
    };

    _styles[id] = entry;
    await _saveStyles();

    if (entry.enabled) {
      await _injectStyleToMatchingTabs(id);
    }

    return id;
  }

  /**
   * Unregister and remove a style.
   */
  async function unregisterStyle(styleId) {
    if (!_initialized) await _loadState();

    await _removeStyleFromAllTabs(styleId);

    delete _styles[styleId];
    delete _customVars[styleId];

    await Promise.all([_saveStyles(), _saveVars()]);
  }

  /**
   * Enable or disable a style.
   */
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

  /**
   * Inject a style's CSS into all matching tabs.
   */
  async function _injectStyleToMatchingTabs(styleId) {
    const style = _styles[styleId];
    if (!style || !style.enabled) return;

    const css = _buildCSS(styleId);
    if (!css) return;

    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (_urlMatchesPatterns(tab.url, style.match)) {
          try {
            await chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              css,
            });
            if (!_registeredTabs.has(tab.id)) {
              _registeredTabs.set(tab.id, new Set());
            }
            _registeredTabs.get(tab.id).add(styleId);
          } catch {
            // Tab may not be injectable (chrome://, etc.)
          }
        }
      }
    } catch (e) {
      console.error('[UserStylesEngine] Inject failed:', e);
    }
  }

  /**
   * Remove a style's CSS from all tabs.
   */
  async function _removeStyleFromAllTabs(styleId) {
    const css = _buildCSS(styleId);
    if (!css) return;

    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        const tabStyles = _registeredTabs.get(tab.id);
        if (tabStyles && tabStyles.has(styleId)) {
          try {
            await chrome.scripting.removeCSS({
              target: { tabId: tab.id },
              css,
            });
            tabStyles.delete(styleId);
          } catch {
            // Tab may have been closed
          }
        }
      }
    } catch (e) {
      console.error('[UserStylesEngine] Remove failed:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  URL matching                                                       */
  /* ------------------------------------------------------------------ */

  function _urlMatchesPatterns(url, patterns) {
    if (!url || !patterns || patterns.length === 0) return false;

    for (const pattern of patterns) {
      if (pattern === '*://*/*' || pattern === '<all_urls>') return true;

      try {
        const regex = _matchPatternToRegex(pattern);
        if (regex.test(url)) return true;
      } catch {
        // Fallback: treat as glob
        if (_globMatch(url, pattern)) return true;
      }
    }
    return false;
  }

  function _matchPatternToRegex(pattern) {
    // Chrome extension match pattern: scheme://host/path
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    return new RegExp('^' + escaped + '$');
  }

  function _globMatch(url, glob) {
    const regex = glob
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp('^' + regex + '$').test(url);
  }

  /* ------------------------------------------------------------------ */
  /*  Variable management                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Get variable definitions and current values for a style.
   */
  function getVariables(styleId) {
    const style = _styles[styleId];
    if (!style) return null;

    const custom = _customVars[styleId] || {};
    return (style.variables || []).map(v => ({
      ...v,
      current: custom[v.name] !== undefined ? custom[v.name] : v.default,
    }));
  }

  /**
   * Set variable values for a style and re-inject.
   * @param {string} styleId
   * @param {Object} values - { varName: value }
   */
  async function setVariables(styleId, values) {
    if (!_initialized) await _loadState();

    const style = _styles[styleId];
    if (!style) return;

    if (!_customVars[styleId]) _customVars[styleId] = {};

    for (const [key, val] of Object.entries(values)) {
      _customVars[styleId][key] = val;
    }

    await _saveVars();

    // Re-inject with updated values
    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Conversion: UserCSS -> Userscript                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Convert a UserCSS source to a regular userscript that uses GM_addStyle.
   */
  function convertToUserscript(usercssCode) {
    const parsed = parseUserCSS(usercssCode);
    if (parsed.error) return { error: parsed.error };

    const { meta, variables, css } = parsed;

    // Build the default variable values for substitution
    const defaults = {};
    for (const v of variables) {
      defaults[v.name] = v.default;
    }
    const finalCSS = _substituteVariables(css, variables, defaults);

    // Escape backticks and backslashes for template literal
    const escapedCSS = finalCSS
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');

    const matchDirectives = '// @match        *://*/*';
    const grantDirective = '// @grant        GM_addStyle';

    const script = [
      '// ==UserScript==',
      `// @name         ${meta.name}`,
      `// @namespace    ${meta.namespace}`,
      `// @version      ${meta.version}`,
      `// @description  ${meta.description}`,
      `// @author       ${meta.author}`,
      matchDirectives,
      grantDirective,
      '// @run-at       document-start',
      '// ==/UserScript==',
      '',
      '(function () {',
      '  \'use strict\';',
      '',
      '  const css = `',
      escapedCSS,
      '  `;',
      '',
      '  if (typeof GM_addStyle === \'function\') {',
      '    GM_addStyle(css);',
      '  } else {',
      '    const style = document.createElement(\'style\');',
      '    style.textContent = css;',
      '    (document.head || document.documentElement).appendChild(style);',
      '  }',
      '})();',
    ].join('\n');

    return { script, meta };
  }

  /* ------------------------------------------------------------------ */
  /*  Import from Stylus JSON backup                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Import styles from a Stylus JSON backup.
   * @param {string|Object} json - JSON string or parsed array of Stylus style objects
   * @returns {Promise<{ imported: number, errors: string[] }>}
   */
  async function importStylusBackup(json) {
    if (!_initialized) await _loadState();

    let stylusStyles;
    try {
      stylusStyles = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
      return { imported: 0, errors: ['Invalid JSON: ' + e.message] };
    }

    if (!Array.isArray(stylusStyles)) {
      stylusStyles = [stylusStyles];
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
          errors.push(`Skipped style: ${sStyle.name || 'unknown'} (no usable sections)`);
        }
      } catch (e) {
        errors.push(`Failed to import "${sStyle.name || 'unknown'}": ${e.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Convert a single Stylus backup style object to our internal format.
   */
  function _convertStylusStyle(sStyle) {
    if (!sStyle.sections || sStyle.sections.length === 0) return null;

    // Build CSS from sections
    const cssParts = [];
    const matchPatterns = new Set();

    for (const section of sStyle.sections) {
      let sectionCSS = section.code || '';

      // Build selector from urls/urlPrefixes/domains/regexps
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
        // Can't convert regex to match pattern; use catch-all
        matchPatterns.add('*://*/*');
      }
      if (!section.urls?.length && !section.urlPrefixes?.length &&
          !section.domains?.length && !section.regexps?.length) {
        matchPatterns.add('*://*/*');
      }

      cssParts.push(sectionCSS);
    }

    const match = [...matchPatterns];
    if (match.length === 0) match.push('*://*/*');

    return {
      meta: {
        name: sStyle.name || 'Imported Style',
        namespace: 'stylus-import',
        version: '1.0.0',
        description: `Imported from Stylus on ${new Date().toISOString().split('T')[0]}`,
        author: sStyle.author || '',
        license: '',
        preprocessor: 'default',
      },
      variables: [],
      css: cssParts.join('\n\n'),
      rawCode: '',
      match,
      enabled: sStyle.enabled !== false,
      installDate: sStyle.installDate || Date.now(),
    };
  }

  function _urlToMatchPattern(url) {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch {
      return '*://*/*';
    }
  }

  function _urlPrefixToMatchPattern(prefix) {
    try {
      const u = new URL(prefix);
      return `${u.protocol}//${u.hostname}${u.pathname}*`;
    } catch {
      return '*://*/*';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  .user.css URL detection                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Check if a URL points to a UserCSS file.
   */
  function isUserCSSUrl(url) {
    if (!url) return false;
    try {
      const pathname = new URL(url).pathname;
      return pathname.endsWith('.user.css');
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Tab navigation handler                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Handle tab navigation — inject matching styles into newly loaded pages.
   * Call from background.js webNavigation.onCommitted or tabs.onUpdated.
   */
  async function onTabUpdated(tabId, url) {
    if (!_initialized) await _loadState();
    if (!url) return;

    for (const [styleId, style] of Object.entries(_styles)) {
      if (!style.enabled) continue;
      if (!_urlMatchesPatterns(url, style.match)) continue;

      const css = _buildCSS(styleId);
      if (!css) continue;

      try {
        await chrome.scripting.insertCSS({
          target: { tabId },
          css,
        });
        if (!_registeredTabs.has(tabId)) {
          _registeredTabs.set(tabId, new Set());
        }
        _registeredTabs.get(tabId).add(styleId);
      } catch {
        // Tab not injectable
      }
    }
  }

  /**
   * Clean up when a tab is closed.
   */
  function onTabRemoved(tabId) {
    _registeredTabs.delete(tabId);
  }

  /* ------------------------------------------------------------------ */
  /*  Initialization                                                     */
  /* ------------------------------------------------------------------ */

  async function init() {
    if (_initialized) return;
    await _loadState();
    _initialized = true;
  }

  /* ------------------------------------------------------------------ */
  /*  Get all styles (for dashboard display)                             */
  /* ------------------------------------------------------------------ */

  function getStyles() {
    return { ..._styles };
  }

  function getStyle(styleId) {
    return _styles[styleId] || null;
  }

  /* ------------------------------------------------------------------ */
  /*  Update raw CSS for a style                                         */
  /* ------------------------------------------------------------------ */

  async function updateCSS(styleId, newCSS) {
    if (!_initialized) await _loadState();

    const style = _styles[styleId];
    if (!style) return;

    // Re-parse if full UserCSS provided
    if (META_REGEX.test(newCSS)) {
      const parsed = parseUserCSS(newCSS);
      if (!parsed.error) {
        style.meta = parsed.meta;
        style.variables = parsed.variables;
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

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
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
    onTabRemoved,
  };
})();

// Export for module environments (tests, bundlers)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserStylesEngine;
}

// ScriptVault — Public Extension API
// Allows other extensions and web pages to interact with ScriptVault.
// Designed for service worker (no DOM dependencies).

const PublicAPI = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const API_VERSION = '1.0.0';
  const STORAGE_KEY_PERMS = 'publicapi_permissions';
  const STORAGE_KEY_AUDIT = 'publicapi_audit';
  const STORAGE_KEY_WEBHOOKS = 'publicapi_webhooks';
  const STORAGE_KEY_ORIGINS = 'publicapi_trusted_origins';
  const MAX_AUDIT_ENTRIES = 500;
  const RATE_LIMIT_WINDOW = 1000; // ms
  const RATE_LIMIT_MAX = 10;      // requests per window

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _permissions = null;    // { [apiName]: 'allow' | 'deny' | 'prompt' }
  let _auditLog = [];
  let _webhooks = {};         // { [eventType]: { url, enabled } }
  let _trustedOrigins = [];
  let _initialized = false;
  let _rateLimitMap = new Map(); // senderId -> [timestamps]

  /* ------------------------------------------------------------------ */
  /*  Default Permissions                                                */
  /* ------------------------------------------------------------------ */

  const DEFAULT_PERMISSIONS = {
    ping:                'allow',
    getVersion:          'allow',
    getAPISchema:        'allow',
    getInstalledScripts: 'allow',
    getScriptStatus:     'allow',
    toggleScript:        'prompt',
    installScript:       'prompt'
  };

  /* ------------------------------------------------------------------ */
  /*  API Schema (self-documenting)                                      */
  /* ------------------------------------------------------------------ */

  const API_SCHEMA = {
    version: API_VERSION,
    endpoints: {
      ping: {
        description: 'Health check. Returns { ok: true, version }.',
        params: null,
        auth: 'none',
        rateLimit: true
      },
      getVersion: {
        description: 'Return the ScriptVault version string.',
        params: null,
        auth: 'none',
        rateLimit: true
      },
      getInstalledScripts: {
        description: 'List all installed scripts with name, version, and enabled status.',
        params: null,
        auth: 'basic',
        rateLimit: true
      },
      getScriptStatus: {
        description: 'Get detailed status for a single script.',
        params: { scriptId: 'string — the script ID' },
        auth: 'basic',
        rateLimit: true
      },
      toggleScript: {
        description: 'Enable or disable a script. Requires user approval.',
        params: { scriptId: 'string', enabled: 'boolean' },
        auth: 'prompt',
        rateLimit: true
      },
      installScript: {
        description: 'Install a new userscript. Requires user approval.',
        params: { code: 'string — full userscript source' },
        auth: 'prompt',
        rateLimit: true
      },
      getAPISchema: {
        description: 'Return the full API schema (this document).',
        params: null,
        auth: 'none',
        rateLimit: false
      }
    },
    webPageEndpoints: {
      'scriptvault:getScripts': {
        description: 'Returns list of scripts matching the current page.',
        params: null
      },
      'scriptvault:isInstalled': {
        description: 'Check if a script by name is installed.',
        params: { name: 'string' }
      },
      'scriptvault:install': {
        description: 'Trigger install flow for a script URL.',
        params: { url: 'string' }
      }
    },
    webhookEvents: ['script.installed', 'script.updated', 'script.error', 'script.toggled']
  };

  /* ------------------------------------------------------------------ */
  /*  Storage Helpers                                                    */
  /* ------------------------------------------------------------------ */

  async function loadState() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEY_PERMS,
        STORAGE_KEY_AUDIT,
        STORAGE_KEY_WEBHOOKS,
        STORAGE_KEY_ORIGINS
      ]);
      _permissions = { ...DEFAULT_PERMISSIONS, ...(result[STORAGE_KEY_PERMS] || {}) };
      _auditLog = result[STORAGE_KEY_AUDIT] || [];
      _webhooks = result[STORAGE_KEY_WEBHOOKS] || {};
      _trustedOrigins = result[STORAGE_KEY_ORIGINS] || [];
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
      console.warn('[PublicAPI] save permissions failed:', e);
    }
  }

  async function saveAuditLog() {
    try {
      // Trim to max entries
      if (_auditLog.length > MAX_AUDIT_ENTRIES) {
        _auditLog = _auditLog.slice(-MAX_AUDIT_ENTRIES);
      }
      await chrome.storage.local.set({ [STORAGE_KEY_AUDIT]: _auditLog });
    } catch (e) {
      console.warn('[PublicAPI] save audit failed:', e);
    }
  }

  async function saveWebhooks() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_WEBHOOKS]: _webhooks });
    } catch (e) {
      console.warn('[PublicAPI] save webhooks failed:', e);
    }
  }

  async function saveTrustedOrigins() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_ORIGINS]: _trustedOrigins });
    } catch (e) {
      console.warn('[PublicAPI] save origins failed:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Audit Logging                                                      */
  /* ------------------------------------------------------------------ */

  function audit(action, sender, details, result) {
    const entry = {
      timestamp: Date.now(),
      action,
      sender: describeSender(sender),
      details: details || null,
      result: result || 'ok'
    };
    _auditLog.push(entry);
    // Async save, don't await in hot path
    saveAuditLog();
    return entry;
  }

  function describeSender(sender) {
    if (!sender) return 'unknown';
    if (sender.id) return `extension:${sender.id}`;
    if (sender.origin) return `origin:${sender.origin}`;
    if (sender.url) return `url:${sender.url}`;
    return 'unknown';
  }

  /* ------------------------------------------------------------------ */
  /*  Rate Limiting                                                      */
  /* ------------------------------------------------------------------ */

  function checkRateLimit(senderId) {
    const now = Date.now();
    let timestamps = _rateLimitMap.get(senderId);

    if (!timestamps) {
      timestamps = [];
      _rateLimitMap.set(senderId, timestamps);
    }

    // Purge old timestamps outside the window
    const cutoff = now - RATE_LIMIT_WINDOW;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= RATE_LIMIT_MAX) {
      return false; // rate limited
    }

    timestamps.push(now);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Permission Checking                                                */
  /* ------------------------------------------------------------------ */

  function getPermission(apiName) {
    return _permissions[apiName] || 'deny';
  }

  async function requestUserApproval(apiName, sender, details) {
    // In a service worker we cannot show DOM prompts.
    // Use chrome.notifications for approval, but for safety we deny by default
    // and require pre-approval via setPermissions().
    // If running in a context with chrome.notifications, send one.
    try {
      if (chrome.notifications) {
        const notifId = `sv-api-approval-${Date.now()}`;
        await chrome.notifications.create(notifId, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'ScriptVault API Request',
          message: `External request: ${apiName} from ${describeSender(sender)}. Pre-approve via settings to allow.`,
          priority: 2
        });
      }
    } catch { /* notifications not available */ }

    // Default: deny unless explicitly allowed
    return false;
  }

  async function authorize(apiName, sender) {
    const perm = getPermission(apiName);
    if (perm === 'allow') return true;
    if (perm === 'deny') return false;
    if (perm === 'prompt') {
      return requestUserApproval(apiName, sender);
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  Script Data Access                                                 */
  /* ------------------------------------------------------------------ */

  async function getScripts() {
    try {
      const result = await chrome.storage.local.get('scripts');
      return result.scripts || [];
    } catch {
      return [];
    }
  }

  async function getScriptById(scriptId) {
    const scripts = await getScripts();
    return scripts.find(s => s.id === scriptId || s.name === scriptId) || null;
  }

  async function getExtensionVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      return manifest.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  API Handlers (External Messages)                                   */
  /* ------------------------------------------------------------------ */

  const HANDLERS = {
    async ping(_msg, _sender) {
      return { ok: true, version: await getExtensionVersion(), api: API_VERSION };
    },

    async getVersion(_msg, _sender) {
      return { version: await getExtensionVersion(), api: API_VERSION };
    },

    async getInstalledScripts(_msg, _sender) {
      const scripts = await getScripts();
      return {
        scripts: scripts.map(s => ({
          id: s.id,
          name: s.name || s.id,
          version: s.version || '1.0',
          enabled: s.enabled !== false,
          matchUrls: s.matches || s.match || []
        }))
      };
    },

    async getScriptStatus(msg, _sender) {
      const scriptId = msg.scriptId || msg.id;
      if (!scriptId) return { error: 'Missing scriptId parameter' };

      const script = await getScriptById(scriptId);
      if (!script) return { error: 'Script not found', scriptId };

      return {
        id: script.id,
        name: script.name || script.id,
        version: script.version || '1.0',
        enabled: script.enabled !== false,
        matches: script.matches || script.match || [],
        lastModified: script.lastModified || null,
        runAt: script.runAt || 'document_idle'
      };
    },

    async toggleScript(msg, sender) {
      const scriptId = msg.scriptId || msg.id;
      const enabled = !!msg.enabled;
      if (!scriptId) return { error: 'Missing scriptId parameter' };

      const allowed = await authorize('toggleScript', sender);
      if (!allowed) return { error: 'Permission denied', action: 'toggleScript' };

      try {
        const result = await chrome.storage.local.get('scripts');
        const scripts = result.scripts || [];
        const idx = scripts.findIndex(s => s.id === scriptId || s.name === scriptId);
        if (idx === -1) return { error: 'Script not found', scriptId };

        scripts[idx].enabled = enabled;
        await chrome.storage.local.set({ scripts });

        fireWebhook('script.toggled', { scriptId, enabled });
        return { ok: true, scriptId, enabled };
      } catch (e) {
        return { error: 'Failed to toggle script', detail: e.message };
      }
    },

    async installScript(msg, sender) {
      const code = msg.code;
      if (!code || typeof code !== 'string') return { error: 'Missing or invalid code parameter' };

      const allowed = await authorize('installScript', sender);
      if (!allowed) return { error: 'Permission denied', action: 'installScript' };

      try {
        // Parse basic userscript metadata
        const meta = parseUserscriptMeta(code);
        const scriptId = meta.name
          ? meta.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
          : `ext_${Date.now()}`;

        const newScript = {
          id: scriptId,
          name: meta.name || scriptId,
          version: meta.version || '1.0',
          description: meta.description || '',
          matches: meta.match || ['*://*/*'],
          code,
          enabled: true,
          installedAt: Date.now(),
          installedBy: describeSender(sender),
          runAt: meta.runAt || 'document_idle'
        };

        const result = await chrome.storage.local.get('scripts');
        const scripts = result.scripts || [];

        // Check for duplicate
        const existing = scripts.findIndex(s => s.id === scriptId);
        if (existing !== -1) {
          scripts[existing] = { ...scripts[existing], ...newScript, updatedAt: Date.now() };
        } else {
          scripts.push(newScript);
        }

        await chrome.storage.local.set({ scripts });

        fireWebhook('script.installed', { scriptId, name: newScript.name, version: newScript.version });
        return { ok: true, scriptId, name: newScript.name };
      } catch (e) {
        return { error: 'Failed to install script', detail: e.message };
      }
    },

    async getAPISchema(_msg, _sender) {
      return { schema: API_SCHEMA };
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Userscript Metadata Parser (minimal)                               */
  /* ------------------------------------------------------------------ */

  function parseUserscriptMeta(code) {
    const meta = {};
    const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!headerMatch) return meta;

    const lines = headerMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/\/\/\s*@(\S+)\s+(.*)/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();

      if (key === 'match' || key === 'include') {
        if (!meta.match) meta.match = [];
        meta.match.push(val);
      } else if (key === 'run-at') {
        meta.runAt = val.replace(/-/g, '_');
      } else {
        meta[key] = val;
      }
    }
    return meta;
  }

  /* ------------------------------------------------------------------ */
  /*  Web Page Message Handlers                                          */
  /* ------------------------------------------------------------------ */

  const WEB_HANDLERS = {
    'scriptvault:getScripts': async (data, origin) => {
      const scripts = await getScripts();
      return {
        type: 'scriptvault:getScripts:response',
        scripts: scripts.map(s => ({
          name: s.name || s.id,
          version: s.version || '1.0',
          enabled: s.enabled !== false
        }))
      };
    },

    'scriptvault:isInstalled': async (data, origin) => {
      const name = data.name;
      if (!name) return { type: 'scriptvault:isInstalled:response', error: 'Missing name' };

      const scripts = await getScripts();
      const found = scripts.find(s =>
        (s.name || '').toLowerCase() === name.toLowerCase() ||
        (s.id || '').toLowerCase() === name.toLowerCase()
      );
      return {
        type: 'scriptvault:isInstalled:response',
        installed: !!found,
        name,
        version: found ? (found.version || '1.0') : null
      };
    },

    'scriptvault:install': async (data, origin) => {
      const url = data.url;
      if (!url || typeof url !== 'string') {
        return { type: 'scriptvault:install:response', error: 'Missing or invalid url' };
      }

      // Fetch the script
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const code = await resp.text();

        // Delegate to install handler with a synthetic sender
        const result = await HANDLERS.installScript(
          { action: 'installScript', code },
          { origin }
        );
        return { type: 'scriptvault:install:response', ...result };
      } catch (e) {
        return { type: 'scriptvault:install:response', error: 'Fetch failed', detail: e.message };
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Webhook Support                                                    */
  /* ------------------------------------------------------------------ */

  async function fireWebhook(eventType, payload) {
    const hook = _webhooks[eventType];
    if (!hook || !hook.enabled || !hook.url) return;

    const body = {
      event: eventType,
      timestamp: Date.now(),
      version: API_VERSION,
      data: payload
    };

    try {
      await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.warn(`[PublicAPI] webhook ${eventType} failed:`, e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Message Dispatchers                                                */
  /* ------------------------------------------------------------------ */

  async function dispatchExternal(message, sender) {
    const action = message && message.action;
    if (!action || typeof action !== 'string') {
      return { error: 'Missing action field' };
    }

    const handler = HANDLERS[action];
    if (!handler) {
      return { error: `Unknown action: ${action}`, availableActions: Object.keys(HANDLERS) };
    }

    // Rate limit
    const senderId = describeSender(sender);
    if (API_SCHEMA.endpoints[action]?.rateLimit !== false) {
      if (!checkRateLimit(senderId)) {
        audit(action, sender, null, 'rate_limited');
        return { error: 'Rate limited. Max 10 requests per second.' };
      }
    }

    // Permission check (ping, getVersion, getAPISchema are always allowed)
    const perm = getPermission(action);
    if (perm === 'deny') {
      audit(action, sender, null, 'denied');
      return { error: 'Permission denied', action };
    }

    // Execute
    try {
      const result = await handler(message, sender);
      audit(action, sender, message, result.error ? 'error' : 'ok');
      return result;
    } catch (e) {
      audit(action, sender, message, 'exception');
      return { error: 'Internal error', detail: e.message };
    }
  }

  function dispatchWebMessage(event) {
    // Validate origin
    if (_trustedOrigins.length > 0 && !_trustedOrigins.includes(event.origin) && !_trustedOrigins.includes('*')) {
      return; // ignore untrusted origins
    }

    const data = event.data;
    if (!data || typeof data !== 'object' || !data.type) return;
    if (!data.type.startsWith('scriptvault:')) return;

    const senderId = `web:${event.origin}`;
    if (!checkRateLimit(senderId)) {
      // Silently drop rate-limited web messages
      return;
    }

    const handler = WEB_HANDLERS[data.type];
    if (!handler) return;

    audit(data.type, { origin: event.origin }, data, 'processing');

    handler(data, event.origin).then(response => {
      if (response && event.source) {
        try {
          event.source.postMessage(response, event.origin === 'null' ? '*' : event.origin);
        } catch { /* cross-origin post failed */ }
      }
    }).catch(e => {
      console.warn('[PublicAPI] web handler error:', e);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Listener Management                                                */
  /* ------------------------------------------------------------------ */

  function onExternalMessage(message, sender, sendResponse) {
    // chrome.runtime.onMessageExternal is async-capable via sendResponse
    dispatchExternal(message, sender).then(result => {
      try { sendResponse(result); } catch { /* port closed */ }
    });
    return true; // keep message channel open for async response
  }

  /* ------------------------------------------------------------------ */
  /*  Public Interface                                                   */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialize the Public API: load state, register listeners.
     * Safe for service workers (no DOM).
     */
    async init() {
      if (_initialized) return;

      await loadState();

      // Register external message listener
      if (chrome.runtime.onMessageExternal) {
        chrome.runtime.onMessageExternal.addListener(onExternalMessage);
      }

      // Register web page message listener (only in contexts that have window)
      if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
        self.addEventListener('message', dispatchWebMessage);
      }

      _initialized = true;
      console.log('[PublicAPI] initialized, version', API_VERSION);
    },

    /**
     * Handle an external message manually (if not using auto-listener).
     * @param {object} message — { action, ...params }
     * @param {object} sender  — chrome sender object
     * @returns {Promise<object>} response
     */
    async handleExternalMessage(message, sender) {
      if (!_initialized) await this.init();
      return dispatchExternal(message, sender);
    },

    /**
     * Handle a web page message event manually.
     * @param {MessageEvent} event
     */
    handleWebMessage(event) {
      dispatchWebMessage(event);
    },

    /**
     * Return the full API schema.
     * @returns {object}
     */
    getAPISchema() {
      return { ...API_SCHEMA };
    },

    /**
     * Return the audit log (most recent entries).
     * @param {number} [limit=50]
     * @returns {Array}
     */
    getAuditLog(limit = 50) {
      const start = Math.max(0, _auditLog.length - limit);
      return _auditLog.slice(start);
    },

    /**
     * Set permissions for API actions.
     * @param {object} perms — { [apiName]: 'allow' | 'deny' | 'prompt' }
     */
    async setPermissions(perms) {
      if (!_permissions) await loadState();
      for (const [key, val] of Object.entries(perms)) {
        if (['allow', 'deny', 'prompt'].includes(val)) {
          _permissions[key] = val;
        }
      }
      await savePermissions();
    },

    /**
     * Set trusted web page origins.
     * @param {string[]} origins — array of origin strings (e.g., 'https://example.com')
     */
    async setTrustedOrigins(origins) {
      _trustedOrigins = Array.isArray(origins) ? origins.slice() : [];
      await saveTrustedOrigins();
    },

    /**
     * Get trusted web page origins.
     * @returns {string[]}
     */
    getTrustedOrigins() {
      return _trustedOrigins.slice();
    },

    /**
     * Configure a webhook for an event type.
     * @param {string} eventType — one of API_SCHEMA.webhookEvents
     * @param {object} config — { url: string, enabled: boolean }
     */
    async setWebhook(eventType, config) {
      if (!API_SCHEMA.webhookEvents.includes(eventType)) {
        throw new Error(`Unknown event type: ${eventType}`);
      }
      _webhooks[eventType] = {
        url: config.url || '',
        enabled: !!config.enabled
      };
      await saveWebhooks();
    },

    /**
     * Get all configured webhooks.
     * @returns {object}
     */
    getWebhooks() {
      return { ..._webhooks };
    },

    /**
     * Fire a webhook event programmatically (used by other modules).
     * @param {string} eventType
     * @param {object} payload
     */
    async fireEvent(eventType, payload) {
      audit('fireEvent', { id: 'internal' }, { eventType, payload }, 'ok');
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
})();

// ScriptVault v2.0.0 — Migration System
// Handles data migration from v1.x to v2.0.0 on first run after update.
// Runs in the service worker context (no DOM).

const Migration = (() => {
  'use strict';

  const CURRENT_VERSION = '2.0.0';
  const MIGRATION_KEY = 'sv_lastMigratedVersion';

  /**
   * Check if migration is needed and run it.
   * Called on service worker startup.
   */
  async function run() {
    try {
      const data = await chrome.storage.local.get(MIGRATION_KEY);
      const lastVersion = data[MIGRATION_KEY] || '0.0.0';

      if (lastVersion === CURRENT_VERSION) return; // Already migrated

      console.log(`[Migration] Migrating from ${lastVersion} to ${CURRENT_VERSION}`);

      // Run migrations in order
      if (compareVersions(lastVersion, '2.0.0') < 0) {
        await migrateToV2();
      }

      // Mark migration complete
      await chrome.storage.local.set({ [MIGRATION_KEY]: CURRENT_VERSION });
      console.log('[Migration] Complete');
    } catch (e) {
      console.error('[Migration] Error:', e);
    }
  }

  /**
   * v1.x → v2.0.0 migration
   */
  async function migrateToV2() {
    console.log('[Migration] Running v1.x → v2.0 migration...');

    // 1. Set install date if not present (for CWS review prompt)
    const installData = await chrome.storage.local.get('installDate');
    if (!installData.installDate) {
      await chrome.storage.local.set({ installDate: Date.now() });
    }

    // 2. Initialize notification preferences with defaults
    const notifData = await chrome.storage.local.get('notificationPrefs');
    if (!notifData.notificationPrefs) {
      await chrome.storage.local.set({
        notificationPrefs: {
          updates: true,
          errors: true,
          digest: false,
          security: true,
          quietStart: null,
          quietEnd: null
        }
      });
    }

    // 3. Initialize backup scheduler defaults
    const backupData = await chrome.storage.local.get('backupSchedulerSettings');
    if (!backupData.backupSchedulerSettings) {
      await chrome.storage.local.set({
        backupSchedulerSettings: {
          enabled: true,
          type: 'weekly',
          hour: 3,
          day: 0, // Sunday
          maxBackups: 5,
          onChange: true
        }
      });
    }

    // 4. Migrate script settings format if needed
    // v1.x stored some settings differently
    const scripts = await getAllScripts();
    let migrated = 0;
    for (const [id, script] of Object.entries(scripts)) {
      let changed = false;

      // Ensure settings object exists
      if (!script.settings) {
        script.settings = {};
        changed = true;
      }

      // Ensure stats object exists
      if (!script.stats) {
        script.stats = { runs: 0, totalTime: 0, avgTime: 0, errors: 0 };
        changed = true;
      }

      // Migrate old 'metadata' key to 'meta' if present
      if (script.metadata && !script.meta) {
        script.meta = script.metadata;
        delete script.metadata;
        changed = true;
      }

      // Ensure installedAt is set
      if (!script.installedAt && script.createdAt) {
        script.installedAt = script.createdAt;
        changed = true;
      }

      if (changed) {
        await chrome.storage.local.set({ [`script_${id}`]: script });
        migrated++;
      }
    }

    if (migrated > 0) {
      console.log(`[Migration] Migrated ${migrated} script(s)`);
    }

    // 5. Clean up deprecated storage keys
    const deprecatedKeys = [
      'tm_settings', // Old Tampermonkey-named settings
      'lastChecked',  // Replaced by lastUpdateCheck
    ];
    await chrome.storage.local.remove(deprecatedKeys).catch(() => {});

    // 6. Set default gamification state
    const gamData = await chrome.storage.local.get('gamification');
    if (!gamData.gamification) {
      await chrome.storage.local.set({
        gamification: {
          achievements: {},
          streaks: { daily: { current: 0, longest: 0, lastDate: null }, creation: { current: 0, longest: 0, lastDate: null } },
          points: 0,
          level: 1,
          firstSeen: Date.now()
        }
      });
    }

    // 7. Create initial performance snapshot
    try {
      const perfHistory = await chrome.storage.local.get('perfHistory');
      if (!perfHistory.perfHistory || perfHistory.perfHistory.length === 0) {
        const allScripts = Object.values(scripts);
        const snapshot = {};
        for (const s of allScripts) {
          if (s.stats) {
            snapshot[s.id] = { avgTime: s.stats.avgTime || 0, runs: s.stats.runs || 0, errors: s.stats.errors || 0 };
          }
        }
        await chrome.storage.local.set({
          perfHistory: [{ timestamp: Date.now(), data: snapshot }]
        });
      }
    } catch {}

    console.log('[Migration] v2.0 migration complete');
  }

  /**
   * Get all scripts from storage (raw, without ScriptStorage cache)
   */
  async function getAllScripts() {
    const all = await chrome.storage.local.get(null);
    const scripts = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('script_') && value && typeof value === 'object' && value.code) {
        scripts[key.replace('script_', '')] = value;
      }
    }
    return scripts;
  }

  /**
   * Simple version comparison
   */
  function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] || 0, b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  return { run };
})();

// ScriptVault v2.0.0 — Storage Quota Manager
// Monitors chrome.storage.local usage and provides cleanup utilities.
// Runs in service worker (no DOM).

const QuotaManager = (() => {
  'use strict';

  const QUOTA_LIMIT = 10 * 1024 * 1024; // 10MB Chrome limit for storage.local
  const WARNING_THRESHOLD = 0.85; // Warn at 85%
  const CRITICAL_THRESHOLD = 0.95; // Critical at 95%

  /**
   * Get current storage usage.
   * @returns {{ bytesUsed: number, quota: number, percentage: number, level: string }}
   */
  async function getUsage() {
    const bytesUsed = await chrome.storage.local.getBytesInUse(null);
    const percentage = bytesUsed / QUOTA_LIMIT;
    const level = percentage >= CRITICAL_THRESHOLD ? 'critical'
      : percentage >= WARNING_THRESHOLD ? 'warning'
      : 'ok';
    return { bytesUsed, quota: QUOTA_LIMIT, percentage, level };
  }

  /**
   * Get storage breakdown by category.
   */
  async function getBreakdown() {
    const all = await chrome.storage.local.get(null);
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
      const size = JSON.stringify(value).length;
      if (key.startsWith('script_')) { categories.scripts.count++; categories.scripts.bytes += size; }
      else if (key.startsWith('values_') || key.startsWith('SV_GM_')) { categories.scriptValues.count++; categories.scriptValues.bytes += size; }
      else if (key.startsWith('require_cache_')) { categories.requireCache.count++; categories.requireCache.bytes += size; }
      else if (key.startsWith('res_cache_')) { categories.resourceCache.count++; categories.resourceCache.bytes += size; }
      else if (key.startsWith('autoBackup') || key === 'autoBackups') { categories.backups.count++; categories.backups.bytes += size; }
      else if (key.startsWith('sv_analytics') || key === 'analytics' || key === 'perfHistory') { categories.analytics.count++; categories.analytics.bytes += size; }
      else if (key === 'settings' || key.startsWith('sv_') || key.startsWith('notification') || key.startsWith('gamification')) { categories.settings.count++; categories.settings.bytes += size; }
      else { categories.other.count++; categories.other.bytes += size; }
    }

    return categories;
  }

  /**
   * Clean up storage to free space.
   * @param {object} options - What to clean
   * @returns {{ freedBytes: number, actions: string[] }}
   */
  async function cleanup(options = {}) {
    const actions = [];
    let freedBytes = 0;

    // 1. Clear expired require cache (>7 days)
    if (options.requireCache !== false) {
      const all = await chrome.storage.local.get(null);
      const expiredKeys = [];
      const now = Date.now();
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith('require_cache_') && value.timestamp) {
          if (now - value.timestamp > 7 * 24 * 60 * 60 * 1000) {
            expiredKeys.push(key);
            freedBytes += JSON.stringify(value).length;
          }
        }
        if (key.startsWith('res_cache_') && value.timestamp) {
          if (now - value.timestamp > 7 * 24 * 60 * 60 * 1000) {
            expiredKeys.push(key);
            freedBytes += JSON.stringify(value).length;
          }
        }
      }
      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys);
        actions.push(`Removed ${expiredKeys.length} expired cache entries`);
      }
    }

    // 2. Trim analytics data to 30 days (from 90)
    if (options.analytics !== false) {
      const analyticsData = await chrome.storage.local.get('analytics');
      if (analyticsData.analytics) {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const old = Object.keys(analyticsData.analytics).filter(d => d < cutoff);
        if (old.length > 0) {
          for (const date of old) delete analyticsData.analytics[date];
          await chrome.storage.local.set({ analytics: analyticsData.analytics });
          actions.push(`Pruned ${old.length} days of old analytics`);
          freedBytes += old.length * 500; // Estimate
        }
      }
    }

    // 3. Trim performance history to 14 days
    if (options.perfHistory !== false) {
      const perfData = await chrome.storage.local.get('perfHistory');
      if (perfData.perfHistory && perfData.perfHistory.length > 14) {
        const trimmed = perfData.perfHistory.slice(-14);
        const removed = perfData.perfHistory.length - trimmed.length;
        await chrome.storage.local.set({ perfHistory: trimmed });
        actions.push(`Pruned ${removed} perf history entries`);
        freedBytes += removed * 200;
      }
    }

    // 4. Trim error log to 200 entries
    if (options.errorLog !== false) {
      const errData = await chrome.storage.local.get('errorLog');
      if (errData.errorLog && errData.errorLog.length > 200) {
        const trimmed = errData.errorLog.slice(-200);
        const removed = errData.errorLog.length - trimmed.length;
        await chrome.storage.local.set({ errorLog: trimmed });
        actions.push(`Pruned ${removed} error log entries`);
        freedBytes += removed * 300;
      }
    }

    // 5. Trim CSP reports to 100
    if (options.cspReports !== false) {
      const cspData = await chrome.storage.local.get('sv_csp_reports');
      if (cspData.sv_csp_reports && cspData.sv_csp_reports.length > 100) {
        const trimmed = cspData.sv_csp_reports.slice(-100);
        await chrome.storage.local.set({ sv_csp_reports: trimmed });
        actions.push('Pruned old CSP reports');
      }
    }

    // 6. Clear old sync tombstones (>30 days)
    if (options.tombstones !== false) {
      const tombData = await chrome.storage.local.get('syncTombstones');
      if (tombData.syncTombstones) {
        const now = Date.now();
        const cutoff = 30 * 24 * 60 * 60 * 1000;
        let pruned = 0;
        for (const [id, ts] of Object.entries(tombData.syncTombstones)) {
          if (now - ts > cutoff) { delete tombData.syncTombstones[id]; pruned++; }
        }
        if (pruned > 0) {
          await chrome.storage.local.set({ syncTombstones: tombData.syncTombstones });
          actions.push(`Pruned ${pruned} sync tombstones`);
        }
      }
    }

    // 7. Remove npm cache if critical
    if (options.npmCache) {
      await chrome.storage.local.remove('npmCache');
      actions.push('Cleared npm package cache');
      freedBytes += 5000;
    }

    return { freedBytes, actions };
  }

  /**
   * Auto-cleanup if storage is above warning threshold.
   */
  async function autoCleanup() {
    const usage = await getUsage();
    if (usage.level === 'ok') return null;

    console.log(`[QuotaManager] Storage at ${(usage.percentage * 100).toFixed(1)}% — running cleanup`);
    const result = await cleanup({
      npmCache: usage.level === 'critical'
    });

    if (usage.level === 'critical' && result.freedBytes < 500000) {
      // Still critical — try more aggressive cleanup
      await cleanup({ analytics: true, perfHistory: true, errorLog: true, cspReports: true });
    }

    return result;
  }

  return { getUsage, getBreakdown, cleanup, autoCleanup };
})();


// ScriptVault - Static Analysis Engine v2
// AST-based analysis via offscreen document (Acorn parser).
// Falls back to regex patterns if offscreen is unavailable.

const ScriptAnalyzer = {
  // ── Offscreen dispatch ─────────────────────────────────────────────────────
  // Try to run analysis in the offscreen document where Acorn is loaded.
  // The offscreen document is created on first use and kept alive.

  async analyzeAsync(code) {
    try {
      await ScriptAnalyzer._ensureOffscreen();
      const result = await chrome.runtime.sendMessage({ type: 'offscreen_analyze', code });
      if (result && !result.parseError) return result;
    } catch (e) {
      debugLog('[Analyzer] Offscreen failed, using regex fallback:', e.message);
    }
    return ScriptAnalyzer.analyze(code);
  },

  async _ensureOffscreen() {
    if (!chrome.offscreen) throw new Error('Offscreen API not available');
    const existing = await chrome.offscreen.hasDocument().catch(() => false);
    if (!existing) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen.html'),
        reasons: ['DOM_SCRAPING'],
        justification: 'AST-based script analysis with Acorn parser'
      });
    }
  },

  // ── Regex fallback (kept for parity & offline use) ─────────────────────────
  patterns: [
    { id: 'eval', regex: /\beval\s*\(/g, label: 'eval() call', risk: 30, category: 'execution', desc: 'Dynamic code execution can run arbitrary code' },
    { id: 'function-ctor', regex: /\bnew\s+Function\s*\(/g, label: 'new Function()', risk: 30, category: 'execution', desc: 'Creates functions from strings, equivalent to eval' },
    { id: 'settimeout-str', regex: /setTimeout\s*\(\s*['\"`]/g, label: 'setTimeout with string', risk: 20, category: 'execution', desc: 'String argument to setTimeout acts like eval' },
    { id: 'setinterval-str', regex: /setInterval\s*\(\s*['\"`]/g, label: 'setInterval with string', risk: 20, category: 'execution', desc: 'String argument to setInterval acts like eval' },
    { id: 'document-write', regex: /document\.write\s*\(/g, label: 'document.write()', risk: 10, category: 'execution', desc: 'Can overwrite entire page content' },
    { id: 'innerhtml-assign', regex: /\.innerHTML\s*=/g, label: 'innerHTML assignment', risk: 5, category: 'execution', desc: 'Can inject HTML including scripts (XSS risk)' },
    { id: 'cookie-access', regex: /document\.cookie/g, label: 'Cookie access', risk: 25, category: 'data', desc: 'Can read or modify browser cookies' },
    { id: 'localstorage', regex: /localStorage\.(get|set|remove)Item/g, label: 'localStorage access', risk: 10, category: 'data', desc: 'Reads or writes persistent page data' },
    { id: 'sessionstorage', regex: /sessionStorage\.(get|set|remove)Item/g, label: 'sessionStorage access', risk: 5, category: 'data', desc: 'Reads or writes session data' },
    { id: 'indexeddb', regex: /indexedDB\.open/g, label: 'IndexedDB access', risk: 10, category: 'data', desc: 'Opens browser database' },
    { id: 'fetch-call', regex: /\bfetch\s*\(/g, label: 'fetch() call', risk: 10, category: 'network', desc: 'Makes network requests (same-origin)' },
    { id: 'xhr-open', regex: /XMLHttpRequest|\.open\s*\(\s*['""](?:GET|POST|PUT|DELETE)/gi, label: 'XMLHttpRequest', risk: 10, category: 'network', desc: 'Makes network requests' },
    { id: 'websocket', regex: /new\s+WebSocket\s*\(/g, label: 'WebSocket', risk: 20, category: 'network', desc: 'Opens persistent connection to a server' },
    { id: 'beacon', regex: /navigator\.sendBeacon/g, label: 'sendBeacon()', risk: 15, category: 'network', desc: 'Sends data to a server, often used for tracking' },
    { id: 'canvas-fp', regex: /\.toDataURL\s*\(|\.getImageData\s*\(/g, label: 'Canvas fingerprinting', risk: 20, category: 'fingerprint', desc: 'Can generate unique device fingerprint via canvas' },
    { id: 'webgl-fp', regex: /getExtension\s*\(\s*['""]WEBGL/g, label: 'WebGL fingerprinting', risk: 20, category: 'fingerprint', desc: 'Can identify GPU for device fingerprinting' },
    { id: 'audio-fp', regex: /AudioContext|OfflineAudioContext/g, label: 'Audio fingerprinting', risk: 15, category: 'fingerprint', desc: 'Can generate audio-based device fingerprint' },
    { id: 'navigator-props', regex: /navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g, label: 'Navigator property access', risk: 5, category: 'fingerprint', desc: 'Reads browser/device information' },
    { id: 'atob-long', regex: /atob\s*\(\s*['""][A-Za-z0-9+/=]{100,}['"]\s*\)/g, label: 'Large base64 decode', risk: 25, category: 'obfuscation', desc: 'Decodes large embedded base64 data (possible obfuscation)' },
    { id: 'hex-escape', regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g, label: 'Hex escape sequences', risk: 20, category: 'obfuscation', desc: 'Long hex-encoded strings suggest obfuscated code' },
    { id: 'char-fromcode', regex: /String\.fromCharCode\s*\([^)]{20,}\)/g, label: 'String.fromCharCode chain', risk: 15, category: 'obfuscation', desc: 'Building strings from char codes (obfuscation technique)' },
    { id: 'wasm-mining', regex: /WebAssembly\.(instantiate|compile|Module)/g, label: 'WebAssembly usage', risk: 15, category: 'mining', desc: 'WebAssembly can be used for crypto mining' },
    { id: 'worker-creation', regex: /new\s+Worker\s*\(/g, label: 'Web Worker creation', risk: 10, category: 'mining', desc: 'Workers can run background computations' },
    { id: 'form-submit', regex: /\.submit\s*\(\s*\)/g, label: 'Form auto-submit', risk: 15, category: 'hijack', desc: 'Automatically submits forms' },
    { id: 'window-open', regex: /window\.open\s*\(/g, label: 'window.open()', risk: 5, category: 'hijack', desc: 'Opens new windows/popups' },
    { id: 'location-assign', regex: /(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g, label: 'Page redirect', risk: 10, category: 'hijack', desc: 'Redirects the page to another URL' },
    { id: 'event-prevent', regex: /addEventListener\s*\(\s*['""](?:beforeunload|unload)['"]/g, label: 'Unload handler', risk: 10, category: 'hijack', desc: 'Prevents or intercepts page navigation' },
    { id: 'proto-pollution', regex: /__proto__|Object\.setPrototypeOf\s*\(|prototype\[/g, label: 'Prototype manipulation', risk: 25, category: 'hijack', desc: 'Modifying object prototypes can corrupt global state and affect other scripts' },
    { id: 'document-domain', regex: /document\.domain\s*=/g, label: 'document.domain assignment', risk: 20, category: 'hijack', desc: 'Changing document.domain relaxes same-origin restrictions' },
    { id: 'postmessage-noorigin', regex: /postMessage\s*\([^,)]+,\s*['"]\*['"]/g, label: 'postMessage with wildcard origin', risk: 15, category: 'hijack', desc: 'Sending postMessage to any origin (* target) can leak data to malicious frames' },
    { id: 'defineProperty-global', regex: /Object\.defineProperty\s*\(\s*(?:window|globalThis|self|unsafeWindow)\s*,/g, label: 'Global property definition', risk: 10, category: 'hijack', desc: 'Defining properties on the global object can interfere with page code' },
  ],

  analyze(code) {
    const findings = [];
    let totalRisk = 0;
    const strippedCode = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const pattern of this.patterns) {
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
      const entropy = this.calculateEntropy(longStrings[0]);
      const threshold = longStrings[0].length >= 200 ? 4.5 : 5.2;
      if (entropy > threshold) {
        findings.push({ id: 'high-entropy', label: 'High-entropy string detected', category: 'obfuscation', desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${entropy.toFixed(1)})`, risk: 20, count: longStrings.length, adjustedRisk: 20 });
        totalRisk += 20;
      }
    }
    const riskLevel = totalRisk >= 80 ? 'high' : totalRisk >= 40 ? 'medium' : totalRisk >= 15 ? 'low' : 'minimal';
    const categories = {};
    for (const f of findings) {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(f);
    }
    return { totalRisk: Math.min(totalRisk, 100), riskLevel, findings, categories, summary: this.generateSummary(riskLevel, findings), astAnalyzed: false };
  },

  calculateEntropy(str) {
    const freq = {};
    for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) { const p = count / len; entropy -= p * Math.log2(p); }
    return entropy;
  },

  generateSummary(riskLevel, findings) {
    if (!findings.length) return 'No suspicious patterns detected.';
    const cats = [...new Set(findings.map(f => f.category))];
    const catLabels = { execution: 'dynamic code execution', data: 'data access', network: 'network activity', fingerprint: 'device fingerprinting', obfuscation: 'code obfuscation', mining: 'potential mining', hijack: 'page manipulation' };
    return `Found ${findings.length} pattern(s) involving ${cats.map(c => catLabels[c] || c).join(', ')}.`;
  }
};

// ScriptVault - Network Request Logger
// Logs all GM_xmlhttpRequest calls for transparency and debugging

const NetworkLog = {
  _log: [],
  _maxEntries: 2000,

  add(entry) {
    this._log.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      ...entry
    });
    if (this._log.length > this._maxEntries) {
      this._log = this._log.slice(0, this._maxEntries);
    }
  },

  getAll(filters = {}) {
    let results = this._log;
    if (filters.scriptId) {
      results = results.filter(e => e.scriptId === filters.scriptId);
    }
    if (filters.method) {
      results = results.filter(e => e.method?.toUpperCase() === filters.method.toUpperCase());
    }
    if (filters.domain) {
      results = results.filter(e => {
        try { return new URL(e.url).hostname.includes(filters.domain); } catch { return false; }
      });
    }
    if (filters.status) {
      if (filters.status === 'error') {
        results = results.filter(e => e.error || (e.status && e.status >= 400));
      } else if (filters.status === 'success') {
        results = results.filter(e => !e.error && e.status && e.status < 400);
      }
    }
    return results.slice(0, filters.limit || 100);
  },

  getStats() {
    const byScript = {};
    const byDomain = {};
    let totalRequests = 0;
    let totalErrors = 0;
    let totalBytes = 0;

    for (const entry of this._log) {
      totalRequests++;
      if (entry.error || (entry.status && entry.status >= 400)) totalErrors++;
      totalBytes += entry.responseSize || 0;

      // By script
      const sid = entry.scriptId || 'unknown';
      if (!byScript[sid]) byScript[sid] = { count: 0, errors: 0, bytes: 0, scriptName: entry.scriptName || sid };
      byScript[sid].count++;
      if (entry.error) byScript[sid].errors++;
      byScript[sid].bytes += entry.responseSize || 0;

      // By domain
      try {
        const domain = new URL(entry.url).hostname;
        if (!byDomain[domain]) byDomain[domain] = { count: 0, errors: 0, bytes: 0 };
        byDomain[domain].count++;
        if (entry.error) byDomain[domain].errors++;
        byDomain[domain].bytes += entry.responseSize || 0;
      } catch {}
    }

    return { totalRequests, totalErrors, totalBytes, byScript, byDomain };
  },

  clear(scriptId) {
    if (scriptId) {
      this._log = this._log.filter(e => e.scriptId !== scriptId);
    } else {
      this._log = [];
    }
  }
};

// ScriptVault - Script Signing (Ed25519 via Web Crypto API)
// Provides cryptographic signing and verification for user scripts.
//
// Architecture:
//   - The extension generates an Ed25519 keypair per-user, stored in chrome.storage.local
//   - Script authors can sign their scripts with their private key
//   - Installing users verify the signature against the author's published public key
//   - Trust anchors: user explicitly trusts specific public keys (stored in settings)
//
// Web Crypto Ed25519 support: Chrome 113+

const ScriptSigning = {
  // ── Key management ───────────────────────────────────────────────────────

  async getOrCreateKeypair() {
    const stored = await chrome.storage.local.get('signingKeypair');
    if (stored.signingKeypair) {
      return stored.signingKeypair; // { publicKeyJwk, privateKeyJwk }
    }
    return this.generateAndStoreKeypair();
  },

  async generateAndStoreKeypair() {
    const keypair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true, // extractable
      ['sign', 'verify']
    );
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
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
      'jwk', kp.privateKeyJwk,
      { name: 'Ed25519' },
      false, ['sign']
    );
    const encoder = new TextEncoder();
    const signatureBuffer = await crypto.subtle.sign(
      { name: 'Ed25519' },
      privateKey,
      encoder.encode(code)
    );
    // Convert to base64url to match JWK's x field encoding
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const publicKeyB64 = kp.publicKeyJwk.x; // JWK x field is base64url-encoded
    return {
      signature: signatureB64,
      publicKey: publicKeyB64,
      algorithm: 'Ed25519',
      timestamp: Date.now()
    };
  },

  // ── Verification ──────────────────────────────────────────────────────────

  async verifyScript(code, signatureInfo) {
    if (!signatureInfo?.signature || !signatureInfo?.publicKey) {
      return { valid: false, reason: 'Missing signature or public key' };
    }

    try {
      // Reconstruct the public key JWK from the x coordinate
      const publicKeyJwk = {
        kty: 'OKP',
        crv: 'Ed25519',
        x: signatureInfo.publicKey,
        key_ops: ['verify']
      };

      const publicKey = await crypto.subtle.importKey(
        'jwk', publicKeyJwk,
        { name: 'Ed25519' },
        false, ['verify']
      );

      const encoder = new TextEncoder();
      // Convert base64url back to standard base64 for atob()
      const sigB64 = signatureInfo.signature.replace(/-/g, '+').replace(/_/g, '/');
      const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));

      const valid = await crypto.subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        sigBytes,
        encoder.encode(code)
      );

      if (!valid) return { valid: false, reason: 'Signature verification failed' };

      // Check if this public key is in the trust store
      const settings = await SettingsManager.get();
      const trustedKeys = settings.trustedSigningKeys || {};
      const trusted = trustedKeys[signatureInfo.publicKey];

      return {
        valid: true,
        trusted: !!trusted,
        trustedName: trusted?.name || null,
        publicKey: signatureInfo.publicKey,
        timestamp: signatureInfo.timestamp
      };
    } catch (e) {
      return { valid: false, reason: 'Verification error: ' + e.message };
    }
  },

  // ── Trust management ──────────────────────────────────────────────────────

  async trustKey(publicKey, name) {
    const settings = await SettingsManager.get();
    const trustedKeys = settings.trustedSigningKeys || {};
    trustedKeys[publicKey] = { name: name || publicKey.slice(0, 12) + '…', addedAt: Date.now() };
    await SettingsManager.set({ trustedSigningKeys: trustedKeys });
    return { success: true };
  },

  async untrustKey(publicKey) {
    const settings = await SettingsManager.get();
    const trustedKeys = settings.trustedSigningKeys || {};
    delete trustedKeys[publicKey];
    await SettingsManager.set({ trustedSigningKeys: trustedKeys });
    return { success: true };
  },

  async getTrustedKeys() {
    const settings = await SettingsManager.get();
    return settings.trustedSigningKeys || {};
  },

  // ── Metadata embed helpers ────────────────────────────────────────────────
  // Signs a script and embeds the signature in the userscript metadata header.
  // Format: @signature <base64signature>|<base64pubkey>|<timestamp>

  async signAndEmbedInCode(code) {
    // Strip any existing signature tag
    const stripped = code.replace(/\/\/\s*@signature\s+[^\n]+\n/g, '');
    const sig = await this.signScript(stripped);
    const sigLine = `// @signature ${sig.signature}|${sig.publicKey}|${sig.timestamp}`;

    // Insert just before ==/UserScript==
    if (stripped.includes('==/UserScript==')) {
      return stripped.replace('// ==/UserScript==', sigLine + '\n// ==/UserScript==');
    }
    return sigLine + '\n' + stripped;
  },

  extractSignatureFromCode(code) {
    const match = code.match(/\/\/\s*@signature\s+([^\n]+)/);
    if (!match) return null;
    const parts = match[1].trim().split('|');
    if (parts.length < 2) return null;
    return {
      signature: parts[0],
      publicKey: parts[1],
      timestamp: parts[2] ? parseInt(parts[2]) : null
    };
  },

  async verifyCodeSignature(code) {
    const sigInfo = this.extractSignatureFromCode(code);
    if (!sigInfo) return { valid: false, reason: 'No signature found in script' };
    // Strip the signature line before verifying (we signed the code without it)
    const strippedCode = code.replace(/\/\/\s*@signature\s+[^\n]+\n?/g, '');
    return this.verifyScript(strippedCode, sigInfo);
  }
};

// ScriptVault - Workspaces
// Named sets of enabled/disabled script states for quick context switching

const WorkspaceManager = {
  _cache: null,

  async _init() {
    if (this._cache !== null) return;
    const data = await chrome.storage.local.get('workspaces');
    this._cache = data.workspaces || { active: null, list: [] };
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
    // Snapshot current enabled states
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
    await this._save();
    return workspace;
  },

  async update(id, updates) {
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
    if (!ws) return null;
    if (updates.name !== undefined) ws.name = updates.name;
    ws.updatedAt = Date.now();
    await this._save();
    return ws;
  },

  async save(id) {
    // Save current state into existing workspace
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
    if (!ws) return null;
    const scripts = await ScriptStorage.getAll();
    ws.snapshot = {};
    for (const s of scripts) {
      ws.snapshot[s.id] = s.enabled !== false;
    }
    ws.updatedAt = Date.now();
    await this._save();
    return ws;
  },

  async activate(id) {
    await this._init();
    const ws = this._cache.list.find(w => w.id === id);
    if (!ws) return { error: 'Workspace not found' };

    // Apply snapshot — mutate cache directly, then flush once to avoid N storage writes
    const scripts = await ScriptStorage.getAll();
    let changed = false;
    const now = Date.now();
    for (const s of scripts) {
      const shouldBeEnabled = ws.snapshot[s.id];
      if (shouldBeEnabled !== undefined && (s.enabled !== false) !== shouldBeEnabled) {
        s.enabled = shouldBeEnabled;
        s.updatedAt = now;
        ScriptStorage.cache[s.id] = s;
        changed = true;
      }
    }
    if (changed) await ScriptStorage.save();

    this._cache.active = id;
    await this._save();

    // Re-register all scripts
    await registerAllScripts();
    await updateBadge();

    return { success: true, name: ws.name };
  },

  async delete(id) {
    await this._init();
    this._cache.list = this._cache.list.filter(w => w.id !== id);
    if (this._cache.active === id) this._cache.active = null;
    await this._save();
  }
};

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

// Load debug setting on startup (async — logs before this completes go to console.log)
(async () => {
  try {
    const data = await chrome.storage.local.get('settings');
    _debugEnabled = data.settings?.debugMode === true;
  } catch {}
})();

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
    grant: [],
    require: [],
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
    priority: 0
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
      case 'sandbox':
      case 'run-in':
      case 'license':
      case 'copyright':
      case 'contributionURL':
        meta[key] = value;
        break;
      case 'match':
      case 'include':
      case 'exclude':
      case 'exclude-match':
      case 'excludeMatch':
      case 'grant':
      case 'require':
      case 'connect':
      case 'antifeature':
      case 'tag':
      case 'compatible':
      case 'incompatible':
        const arrayKey = key === 'exclude-match' ? 'excludeMatch' : key;
        if (!meta[arrayKey]) meta[arrayKey] = [];
        if (value) meta[arrayKey].push(value);
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
      case 'top-level-await':
        meta['top-level-await'] = true;
        break;
      case 'priority':
        meta.priority = parseInt(value, 10) || 0;
        break;
      case 'webRequest':
        try { meta.webRequest = JSON.parse(value); } catch (e) {}
        break;
      default:
        // Handle localized metadata like @name:ja
        if (key.includes(':')) {
          const [baseKey, locale] = key.split(':');
          if (!meta.localized) meta.localized = {};
          if (!meta.localized[locale]) meta.localized[locale] = {};
          meta.localized[locale][baseKey] = value;
        }
    }
  }

  // Default grant if none specified
  if (meta.grant.length === 0) {
    meta.grant = ['none'];
  }

  return { meta, code, metaBlock: metaBlockMatch[0] };
}

// ============================================================================
// URL Matching
// ============================================================================

// ============================================================================
// Update System
// ============================================================================

const UpdateSystem = {
  async checkForUpdates(scriptId = null) {
    const scripts = scriptId 
      ? [await ScriptStorage.get(scriptId)].filter(Boolean)
      : await ScriptStorage.getAll();
    
    const updates = [];
    
    for (const script of scripts) {
      if (!script.meta.updateURL && !script.meta.downloadURL) continue;
      
      try {
        const updateUrl = script.meta.updateURL || script.meta.downloadURL;
        const headers = {};

        // Conditional request using stored etag/last-modified
        if (script._httpEtag) headers['If-None-Match'] = script._httpEtag;
        if (script._httpLastModified) headers['If-Modified-Since'] = script._httpLastModified;

        const response = await fetch(updateUrl, { headers });

        // 304 Not Modified - no update needed
        if (response.status === 304) continue;
        if (!response.ok) continue;

        // Store HTTP cache headers for next check
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        if (etag || lastModified) {
          script._httpEtag = etag || '';
          script._httpLastModified = lastModified || '';
          await ScriptStorage.set(script.id, script);
        }

        const newCode = await response.text();
        const parsed = parseUserscript(newCode);
        if (parsed.error) continue;

        if (this.compareVersions(parsed.meta.version, script.meta.version) > 0) {
          updates.push({
            id: script.id,
            name: script.meta.name,
            currentVersion: script.meta.version,
            newVersion: parsed.meta.version,
            code: newCode
          });
        }
      } catch (e) {
        console.error('[ScriptVault] Update check failed for:', script.meta.name, e);
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
  
  async applyUpdate(scriptId, newCode) {
    const script = await ScriptStorage.get(scriptId);
    if (!script) return { error: 'Script not found' };
    // Don't auto-update scripts the user has locally edited
    if (script.settings?.userModified) return { skipped: true, reason: 'user-modified' };

    const parsed = parseUserscript(newCode);
    if (parsed.error) return parsed;

    // Store previous version for rollback (keep last 3)
    if (!script.versionHistory) script.versionHistory = [];
    script.versionHistory.push({
      version: script.meta.version,
      code: script.code,
      updatedAt: script.updatedAt || Date.now()
    });
    // Trim to last 3 versions
    if (script.versionHistory.length > 3) {
      script.versionHistory = script.versionHistory.slice(-3);
    }

    script.code = newCode;
    script.meta = parsed.meta;
    script.updatedAt = Date.now();

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

    // Persist to storage after registration attempt
    await ScriptStorage.set(scriptId, script);

    const settings = await SettingsManager.get();
    if (settings.notifyOnUpdate) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Script Updated',
        message: `${script.meta.name} updated to v${script.meta.version}`
      });
    }

    return { success: true, script };
  },
  
  async autoUpdate() {
    const settings = await SettingsManager.get();
    if (!settings.autoUpdate) return;

    const updates = await this.checkForUpdates();
    // Apply all pending updates in parallel — each applyUpdate is independent
    const results = await Promise.allSettled(updates.map(update => this.applyUpdate(update.id, update.code)));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('[ScriptVault] Auto-update failures:', failed.map(r => r.reason?.message || r.reason));
    }

    await SettingsManager.set('lastUpdateCheck', Date.now());
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

  async sync() {
    // Prevent concurrent syncs — second call defers until first completes
    if (this._syncInProgress) {
      debugLog('[CloudSync] Sync already in progress, skipping');
      return { skipped: true };
    }
    this._syncInProgress = true;

    let _timeoutId;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        _timeoutId = setTimeout(() => reject(new Error('Sync timed out after 90s')), 90000);
      });
      return await Promise.race([this._performSync(), timeoutPromise]);
    } catch (e) {
      console.error('[ScriptVault] Sync failed:', e);
      return { error: e.message };
    } finally {
      clearTimeout(_timeoutId);
      this._syncInProgress = false;
    }
  },

  async _performSync() {
    const settings = await SettingsManager.get();
    if (!settings.syncEnabled || settings.syncProvider === 'none') return;

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
    const remoteData = await provider.download(settings);

    if (remoteData) {
      // Merge tombstones from remote so deletions propagate across devices
      const mergedTombstones = { ...tombstones, ...(remoteData.tombstones || {}) };

      // Merge: prefer newer versions
      const merged = this.mergeData(localData, remoteData);

      // Apply merged data locally, skipping tombstoned (deleted) scripts
      // Uses 3-way text merge (via offscreen doc) when both sides have changed since sync base
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
          const base = existing.syncBaseCode || existing.code;
          if (base && base !== localScript.code && base !== remoteScript.code) {
            try {
              await ScriptAnalyzer._ensureOffscreen();
              const mergeResult = await chrome.runtime.sendMessage({
                type: 'offscreen_merge',
                base,
                local: localScript.code,
                remote: remoteScript.code
              });
              if (mergeResult && !mergeResult.error) {
                codeToSave = mergeResult.merged;
                mergeConflict = mergeResult.conflicts || false;
                debugLog(`[CloudSync] 3-way merge for ${script.id}: conflicts=${mergeConflict}`);
              }
            } catch (e) {
              debugLog('[CloudSync] 3-way merge failed, using timestamp winner:', e.message);
              // Fall back to last-write-wins (already set via merged.scripts)
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

      // Persist merged tombstones locally
      if (Object.keys(mergedTombstones).length > Object.keys(tombstones).length) {
        await chrome.storage.local.set({ syncTombstones: mergedTombstones });
      }

      // Upload merged data (includes tombstones)
      merged.timestamp = Date.now();
      merged.tombstones = mergedTombstones;
      await provider.upload(merged, settings);
    } else {
      // First sync, just upload (include tombstones so remote gets deletion info)
      await provider.upload(localData, settings);
    }

    await SettingsManager.set('lastSync', Date.now());
    return { success: true };
  },
  
  mergeData(local, remote) {
    const scriptsMap = new Map();
    
    // Add all local scripts
    for (const script of local.scripts) {
      scriptsMap.set(script.id, script);
    }
    
    // Merge remote scripts (prefer newer)
    for (const script of remote.scripts) {
      const existing = scriptsMap.get(script.id);
      if (!existing || script.updatedAt > existing.updatedAt) {
        scriptsMap.set(script.id, script);
      }
    }
    
    return {
      version: 1,
      timestamp: Date.now(),
      scripts: Array.from(scriptsMap.values())
    };
  }
};

// ============================================================================
// Import/Export
// ============================================================================

async function exportAllScripts() {
  const scripts = await ScriptStorage.getAll();
  const settings = await SettingsManager.get();
  
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: settings,
    scripts: scripts.map(s => ({
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  };
}

async function importScripts(data, options = {}) {
  const { overwrite = false } = options;
  const results = { imported: 0, skipped: 0, errors: [] };

  if (!data.scripts || !Array.isArray(data.scripts)) {
    return { error: 'Invalid import format' };
  }

  // Cache existing count once to avoid O(n²) getAll() inside the loop
  let _importPosition = (await ScriptStorage.getAll()).length;

  for (const script of data.scripts) {
    try {
      const parsed = parseUserscript(script.code);
      if (parsed.error) {
        results.errors.push({ name: script.id, error: parsed.error });
        continue;
      }

      const existing = await ScriptStorage.get(script.id);
      if (existing && !overwrite) {
        results.skipped++;
        continue;
      }

      await ScriptStorage.set(script.id, {
        id: script.id,
        code: script.code,
        meta: parsed.meta,
        enabled: script.enabled ?? true,
        position: script.position ?? _importPosition++,
        createdAt: script.createdAt || Date.now(),
        updatedAt: script.updatedAt || Date.now()
      });
      results.imported++;
    } catch (e) {
      results.errors.push({ name: script.id, error: e.message });
    }
  }
  
  // Import settings if present
  if (data.settings && options.importSettings) {
    await SettingsManager.set(data.settings);
  }
  
  // Re-register all scripts after import
  await registerAllScripts();
  
  return results;
}

// Export to ZIP (Tampermonkey-compatible format)
async function exportToZip() {
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
    const options = {
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
    files[`${safeName}.options.json`] = fflate.strToU8(JSON.stringify(options, null, 2));
    
    // Add storage.json if script has stored values
    const values = await ScriptValues.getAll(script.id);
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
  return { zipData: base64, filename: `scriptvault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip` };
}

// Import from ZIP (supports Tampermonkey and other formats)
async function importFromZip(zipData, options = {}) {
  const results = { imported: 0, skipped: 0, errors: [] };
  
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

        // Check for existing script with same name/namespace
        const existing = allExistingScripts.find(s =>
          s.meta.name === parsed.meta.name && 
          (s.meta.namespace === parsed.meta.namespace || (!s.meta.namespace && !parsed.meta.namespace))
        );
        
        if (existing && !options.overwrite) {
          results.skipped++;
          continue;
        }
        
        // Look for associated options and storage files
        const baseName = filename.replace('.user.js', '');
        const optionsFileData = unzipped[`${baseName}.options.json`];
        const storageFileData = unzipped[`${baseName}.storage.json`];
        
        let enabled = true;
        let storedValues = {};
        
        // Parse options file if exists
        if (optionsFileData) {
          try {
            const optionsData = JSON.parse(fflate.strFromU8(optionsFileData));
            enabled = optionsData.settings?.enabled !== false;
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
        
        // Create or update script
        const scriptId = existing?.id || generateId();
        const script = {
          id: scriptId,
          code: code,
          meta: parsed.meta,
          enabled: enabled,
          position: existing?.position ?? _importPosition++,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        
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
    await registerAllScripts();

    return results;
  } catch (e) {
    console.error('[ScriptVault] importFromZip error:', e);
    return { ...results, error: e.message };
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

// Regular message listener (content scripts, popup, dashboard)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(e => {
      console.error('[ScriptVault] Unhandled message error:', e);
      sendResponse({ error: e.message });
    });
  return true;
});

// USER_SCRIPT world message listener (for GM_* APIs)
// This is SEPARATE from onMessage and required for messaging: true to work
if (chrome.runtime.onUserScriptMessage) {
  chrome.runtime.onUserScriptMessage.addListener((message, sender, sendResponse) => {
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
        // Mark as locally modified when saved from editor — prevents sync from overwriting
        if (data.markModified) scriptSettings.userModified = true;

        const script = {
          ...existing,
          id,
          code: data.code,
          meta: parsed.meta,
          enabled: data.enabled !== undefined ? data.enabled : (existing?.enabled ?? true),
          settings: scriptSettings,
          position: existing?.position ?? (await ScriptStorage.getAll()).length,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        
        await ScriptStorage.set(id, script);
        await updateBadge();
        await autoReloadMatchingTabs(script);

        // v2.0: Live reload — also reload if script has live reload enabled
        try {
          const lrData = await chrome.storage.local.get('liveReloadScripts');
          if (lrData.liveReloadScripts?.[id]) {
            // Force reload all matching tabs immediately (bypass debounce)
            const allTabs = await chrome.tabs.query({});
            for (const tab of allTabs) {
              if (tab.url && doesScriptMatchUrl(script, tab.url)) {
                try { chrome.tabs.reload(tab.id); } catch {}
              }
            }
          }
        } catch {}

        // Re-register the script with userScripts API
        await unregisterScript(id);
        if (script.enabled !== false) {
          await registerScript(script);
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
        const settings = await SettingsManager.get();
        const trashMode = settings.trashMode || '30';

        if (trashMode !== 'disabled') {
          // Move to trash instead of permanent delete
          const script = await ScriptStorage.get(scriptId);
          if (script) {
            const trashData = await chrome.storage.local.get('trash');
            const trash = trashData.trash || [];
            trash.push({ ...script, trashedAt: Date.now() });
            await chrome.storage.local.set({ trash });
          }
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
        return { success: true };
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
        const script = await ScriptStorage.get(scriptId);
        if (script) {
          script.enabled = data.enabled;
          script.updatedAt = Date.now();
          await ScriptStorage.set(scriptId, script);
          
          // Update userScripts registration
          await unregisterScript(scriptId);
          if (script.enabled) {
            await registerScript(script);
          }

          await updateBadge();
          await autoReloadMatchingTabs(script);
        }
        return { success: true };
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
          await registerScript(newScript);
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
        return await ScriptValues.set(data.scriptId, data.key, data.value);
        
      case 'GM_deleteValue':
      case 'deleteScriptValue':
        await ScriptValues.delete(data.scriptId, data.key);
        return { success: true };
        
      case 'GM_listValues':
        return await ScriptValues.list(data.scriptId);
        
      case 'GM_getValues':
        return await ScriptValues.getAll(data.scriptId);
        
      case 'GM_setValues':
        await ScriptValues.setAll(data.scriptId, data.values);
        return { success: true };
        
      case 'GM_deleteValues':
        await ScriptValues.deleteMultiple(data.scriptId, data.keys);
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
        return TabStorage.get(sender.tab?.id);
        
      case 'GM_saveTab':
        TabStorage.set(sender.tab?.id, data.data);
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
        const settings = await SettingsManager.get();
        const ver = settings._chromeVersion || _getChromeVersion();
        const userScriptsAvailable = settings._userScriptsAvailable !== false && !!chrome.userScripts;
        let setupRequired = false;
        let setupMessage = '';
        if (!userScriptsAvailable) {
          setupRequired = true;
          if (ver >= 138) {
            setupMessage = 'Enable "Allow User Scripts" for ScriptVault in chrome://extensions';
          } else if (ver >= 120) {
            setupMessage = 'Enable Developer Mode in chrome://extensions to run userscripts';
          } else {
            setupMessage = 'Chrome 120 or newer is required';
          }
        }
        return { userScriptsAvailable, setupRequired, setupMessage, chromeVersion: ver };
      }
        
      case 'getSetting':
        return await SettingsManager.get(data.key);
        
      case 'setSettings': {
        const oldSettings = await SettingsManager.get();
        const result = await SettingsManager.set(data.settings);
        const changed = data.settings;

        // If global enabled state changed, re-register all scripts
        if ('enabled' in changed && changed.enabled !== oldSettings.enabled) {
          await registerAllScripts();
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
          await registerAllScripts();
        }

        return result;
      }
        
      case 'resetSettings':
        return await SettingsManager.reset();
        
      // Updates
      case 'checkUpdates':
        return await UpdateSystem.checkForUpdates(data?.scriptId);

      case 'forceUpdate': {
        // Force re-download bypassing HTTP cache
        const scriptId = data.scriptId;
        const script = await ScriptStorage.get(scriptId);
        if (!script) return { error: 'Script not found' };
        const downloadUrl = script.meta.downloadURL || script.meta.updateURL;
        if (!downloadUrl) return { error: 'No download URL configured' };
        try {
          const response = await fetch(downloadUrl, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          });
          if (!response.ok) return { error: `HTTP ${response.status}` };
          const newCode = await response.text();
          const parsed = parseUserscript(newCode);
          if (parsed.error) return parsed;
          // Apply as update (saves version history)
          return await UpdateSystem.applyUpdate(scriptId, newCode);
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'applyUpdate':
        return await UpdateSystem.applyUpdate(data.scriptId, data.code);

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
        // Trim to last 5 versions (allow extra room for rollback undos)
        if (script.versionHistory.length > 5) {
          script.versionHistory = script.versionHistory.slice(-5);
        }

        script.code = target.code;
        script.meta = parsed.meta;
        script.updatedAt = Date.now();

        await ScriptStorage.set(data.scriptId, script);
        await unregisterScript(data.scriptId);
        if (script.enabled !== false) {
          await registerScript(script);
        }
        return { success: true, script: { ...script, metadata: script.meta } };
      }

      // Sync
      case 'sync':
        return await CloudSync.sync();
        
      case 'testSync': {
        const settings = await SettingsManager.get();
        const provider = CloudSync.providers[settings.syncProvider];
        if (provider) {
          return await provider.test(settings);
        }
        return false;
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
      
      case 'disconnectSyncProvider': {
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
          }
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
        return await CloudSync.sync();
      }

      case 'cloudExport': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider: ' + providerName };

        try {
          const exportData = await exportAllScripts();
          const settings = await SettingsManager.get();
          await provider.upload(exportData, settings);
          return { success: true };
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
          const result = await importScripts(remoteData, { overwrite: true });
          return { success: true, imported: result.imported };
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
        const allValues = {};
        for (const script of scripts) {
          const values = await ScriptValues.getAll(script.id);
          if (values && Object.keys(values).length > 0) {
            allValues[script.id] = {
              scriptName: script.meta?.name || 'Unknown Script',
              values
            };
          }
        }
        return { allValues };
      }
      
      // Values Editor - Set a single value
      case 'setScriptValue': {
        await ScriptValues.set(data.scriptId, data.key, data.value);
        return { success: true };
      }
      
      // Values Editor - Delete a value
      case 'deleteScriptValue': {
        await ScriptValues.delete(data.scriptId, data.key);
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
        script.settings = { ...oldSettings, ...data.settings };
        script.updatedAt = Date.now();
        await ScriptStorage.set(data.scriptId, script);

        // Only re-register if execution-affecting settings changed
        const EXEC_KEYS = ['runAt', 'injectInto', 'useOriginalMatches', 'useOriginalIncludes',
                           'useOriginalExcludes', 'userMatches', 'userIncludes', 'userExcludes'];
        const needsReregister = EXEC_KEYS.some(k =>
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
        return await exportAllScripts();
        
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
        for (const code of scriptBlocks) {
          try {
            const parsed = parseUserscript(code);
            if (parsed.error) { results.errors.push({ error: parsed.error }); continue; }
            const existing = (await ScriptStorage.getAll()).find(s =>
              s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
            );
            if (existing && !data.overwrite) { results.skipped++; continue; }
            const id = existing?.id || generateId();
            await ScriptStorage.set(id, {
              id, code, meta: parsed.meta,
              enabled: true,
              position: existing?.position ?? (await ScriptStorage.getAll()).length,
              createdAt: existing?.createdAt || Date.now(),
              updatedAt: Date.now()
            });
            results.imported++;
          } catch (e) {
            results.errors.push({ error: e.message });
          }
        }
        await registerAllScripts();
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
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.restoreBackup(data.backupId, data.options);
        return { error: 'BackupScheduler not available' };
      }
      case 'deleteBackup': {
        if (typeof BackupScheduler !== 'undefined') return await BackupScheduler.deleteBackup(data.backupId);
        return { error: 'BackupScheduler not available' };
      }
      case 'getBackupSettings': {
        if (typeof BackupScheduler !== 'undefined') return BackupScheduler.getSettings();
        return {};
      }
      case 'setBackupSettings': {
        if (typeof BackupScheduler !== 'undefined') { await BackupScheduler.setSettings(data.settings); return { success: true }; }
        return { error: 'BackupScheduler not available' };
      }

      // v2.0: Script Analytics
      case 'recordAnalytics': {
        const analyticsData = await chrome.storage.local.get('analytics');
        const analytics = analyticsData.analytics || {};
        const today = new Date().toISOString().slice(0, 10);
        if (!analytics[today]) analytics[today] = {};
        const sid = data.scriptId;
        if (!analytics[today][sid]) analytics[today][sid] = { runs: 0, totalTime: 0, errors: 0, urls: [] };
        analytics[today][sid].runs++;
        analytics[today][sid].totalTime += data.duration || 0;
        if (data.error) analytics[today][sid].errors++;
        if (data.url && !analytics[today][sid].urls.includes(data.url)) {
          analytics[today][sid].urls.push(data.url);
          if (analytics[today][sid].urls.length > 50) analytics[today][sid].urls = analytics[today][sid].urls.slice(-50);
        }
        // Prune data older than 90 days
        const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        for (const date of Object.keys(analytics)) {
          if (date < cutoffDate) delete analytics[date];
        }
        await chrome.storage.local.set({ analytics });
        return { success: true };
      }
      case 'getAnalytics': {
        const aData = await chrome.storage.local.get('analytics');
        return { analytics: aData.analytics || {} };
      }
      case 'getAnalyticsForScript': {
        const aData2 = await chrome.storage.local.get('analytics');
        const analytics2 = aData2.analytics || {};
        const scriptData = {};
        for (const [date, scripts] of Object.entries(analytics2)) {
          if (scripts[data.scriptId]) scriptData[date] = scripts[data.scriptId];
        }
        return { data: scriptData };
      }

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
        // Apply script states from profile
        const scripts = await ScriptStorage.getAll();
        for (const script of scripts) {
          const newEnabled = profile.scriptStates?.[script.id] ?? script.enabled;
          if (script.enabled !== newEnabled) {
            script.enabled = newEnabled;
            await ScriptStorage.set(script.id, script);
          }
        }
        await chrome.storage.local.set({ activeProfileId: data.profileId });
        await registerAllScripts();
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
        const reports = cspData.cspReports || [];
        reports.push({ url: data.url, scriptId: data.scriptId, directive: data.directive, timestamp: Date.now() });
        // Keep last 500 reports
        if (reports.length > 500) reports.splice(0, reports.length - 500);
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
            for (const vmScript of vmData.scripts) {
              try {
                const code = vmScript.code || vmScript.custom?.code || '';
                if (!code) { results.skipped++; continue; }
                const parsed = parseUserscript(code);
                if (parsed.error) { results.errors.push({ name: vmScript.props?.name, error: parsed.error }); continue; }
                const existing = (await ScriptStorage.getAll()).find(s =>
                  s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
                );
                if (existing && !data.overwrite) { results.skipped++; continue; }
                const id = existing?.id || generateId();
                await ScriptStorage.set(id, {
                  id, code, meta: parsed.meta,
                  enabled: vmScript.config?.enabled !== false,
                  position: existing?.position ?? (await ScriptStorage.getAll()).length,
                  createdAt: existing?.createdAt || Date.now(),
                  updatedAt: Date.now()
                });
                results.imported++;
              } catch (e) {
                results.errors.push({ error: e.message });
              }
            }
            await registerAllScripts();
            await updateBadge();
            return results;
          }
        } catch { /* Not JSON — try text format */ }

        // Fallback: same as Tampermonkey text format
        const parts = text.split(/\n\s*\n(?=\/\/\s*==UserScript==)/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes('==UserScript==') && trimmed.includes('==/UserScript==')) {
            try {
              const parsed = parseUserscript(trimmed);
              if (parsed.error) { results.errors.push({ error: parsed.error }); continue; }
              const existing = (await ScriptStorage.getAll()).find(s =>
                s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
              );
              if (existing && !data.overwrite) { results.skipped++; continue; }
              const id = existing?.id || generateId();
              await ScriptStorage.set(id, {
                id, code: trimmed, meta: parsed.meta,
                enabled: true,
                position: existing?.position ?? (await ScriptStorage.getAll()).length,
                createdAt: existing?.createdAt || Date.now(),
                updatedAt: Date.now()
              });
              results.imported++;
            } catch (e) {
              results.errors.push({ error: e.message });
            }
          }
        }
        await registerAllScripts();
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
          for (const gmScript of scripts) {
            try {
              const code = gmScript.source || gmScript.code || gmScript.content || '';
              if (!code) { results.skipped++; continue; }
              const parsed = parseUserscript(code);
              if (parsed.error) { results.errors.push({ name: gmScript.name, error: parsed.error }); continue; }
              const existing = (await ScriptStorage.getAll()).find(s =>
                s.meta.name === parsed.meta.name && s.meta.namespace === parsed.meta.namespace
              );
              if (existing && !data.overwrite) { results.skipped++; continue; }
              const id = existing?.id || generateId();
              await ScriptStorage.set(id, {
                id, code, meta: parsed.meta,
                enabled: gmScript.enabled !== false,
                position: existing?.position ?? (await ScriptStorage.getAll()).length,
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
        await registerAllScripts();
        await updateBadge();
        return results;
      }

      case 'exportZip':
        return await exportToZip();

      // Folders
      // Workspaces
      case 'getWorkspaces':
        return await WorkspaceManager.getAll();

      case 'createWorkspace':
        return { workspace: await WorkspaceManager.create(data.name) };

      case 'saveWorkspace':
        return { workspace: await WorkspaceManager.save(data.id) };

      case 'activateWorkspace':
        return await WorkspaceManager.activate(data.id);

      case 'updateWorkspace':
        return { workspace: await WorkspaceManager.update(data.id, data.updates) };

      case 'deleteWorkspace':
        await WorkspaceManager.delete(data.id);
        return { success: true };

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
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), data.timeout || 30000);
          const response = await fetch(data.url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok) return { error: `HTTP ${response.status}` };
          const code = await response.text();
          if (!code || code.length === 0) return { error: 'Empty response' };
          return { code };
        } catch (e) {
          return { error: e.message || 'Fetch failed' };
        }
      }

      // XHR - Using fetch() since XMLHttpRequest is not available in Service Workers
      // Provides abort support via AbortController and simulates events
      case 'GM_xmlhttpRequest': {
        try {
          if (!data.url) {
            return { error: 'No URL provided', type: 'error' };
          }

          // @connect enforcement
          if (data.scriptId) {
            const xhrScript = await ScriptStorage.get(data.scriptId);
            if (xhrScript && xhrScript.meta.connect && xhrScript.meta.connect.length > 0) {
              const connectList = xhrScript.meta.connect;
              const hasWildcard = connectList.includes('*');
              if (!hasWildcard) {
                try {
                  const reqUrl = new URL(data.url);
                  const hostname = reqUrl.hostname;
                  const isAllowed = connectList.some(pattern => {
                    if (pattern === 'self') {
                      // @connect self - allow same origin as script match domains
                      return true;
                    }
                    if (pattern === 'localhost') {
                      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
                    }
                    // Check exact match or subdomain match
                    return hostname === pattern || hostname.endsWith('.' + pattern);
                  });
                  if (!isAllowed) {
                    console.warn(`[ScriptVault] @connect blocked: ${hostname} not in allowed list for ${xhrScript.meta.name}`);
                    return { error: `Connection to ${hostname} blocked by @connect policy`, type: 'error' };
                  }
                } catch (e) {}
              }
            }
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
          
          // Build fetch options
          // No 'mode' override — Chrome extensions with <all_urls> host permissions
          // bypass CORS automatically. Forcing mode:'cors' breaks requests to servers
          // that don't echo the extension origin (e.g. localhost with null CORS).
          const fetchOptions = {
            method: data.method || 'GET',
            headers: data.headers || {},
            signal: controller.signal,
            credentials: data.anonymous ? 'omit' : 'include'
          };
          
          // Add body for non-GET/HEAD requests
          if (data.data && data.method !== 'GET' && data.method !== 'HEAD') {
            fetchOptions.body = data.data;
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
              clearTimeout(timeoutId);
              
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
              clearTimeout(timeoutId);
              
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
        const notifOpts = {
          type: 'basic',
          iconUrl: data.image || 'images/icon128.png',
          title: data.title || 'ScriptVault',
          message: data.text || '',
          silent: data.silent || false
        };
        // Use tag as notification ID for updates
        const notifId = data.tag
          ? await chrome.notifications.create(data.tag, notifOpts)
          : await chrome.notifications.create(notifOpts);
        const tabId = sender.tab?.id;
        // Track notification for callbacks
        if (tabId && (data.hasOnclick || data.hasOndone)) {
          self._notifCallbacks.set(notifId, {
            tabId, scriptId: data.scriptId,
            hasOnclick: data.hasOnclick, hasOndone: data.hasOndone
          });
        }
        // Auto-close after timeout
        if (data.timeout && data.timeout > 0) {
          setTimeout(() => {
            chrome.notifications.clear(notifId).catch(() => {});
            // Clean up callback tracker (onClosed listener may not fire on all platforms)
            self._notifCallbacks.delete(notifId);
          }, data.timeout);
        }
        return { success: true, id: notifId };
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
          _openTabTrackers.set(tab.id, { callerTabId, scriptId: data.scriptId });
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
        const allScripts = await ScriptStorage.getAll();
        const settings = await SettingsManager.get();
        const url = data.url || data;
        
        // Filter scripts that match this URL (both enabled and disabled for popup display)
        const filtered = allScripts.filter(script => 
          doesScriptMatchUrl(script, url)
        ).sort((a, b) => (a.position || 0) - (b.position || 0));
        
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
      case 'GM_cookie_list': {
        try {
          const details = {};
          if (data.url) details.url = data.url;
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
        return { success: true };
      }

      case 'GM_audio_unwatchState': {
        const tabId = sender.tab?.id;
        if (tabId && self._audioWatchedTabs) self._audioWatchedTabs.delete(tabId);
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
      case 'getPerfHistory': {
        const histData = await chrome.storage.local.get('perfHistory');
        return { history: histData.perfHistory || [] };
      }

      case 'savePerfSnapshot': {
        const histData2 = await chrome.storage.local.get('perfHistory');
        const history = histData2.perfHistory || [];
        history.push({ timestamp: Date.now(), data: data.snapshot });
        // Keep last 30 days
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const trimmed = history.filter(h => h.timestamp > cutoff);
        await chrome.storage.local.set({ perfHistory: trimmed });
        return { success: true };
      }

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
        entries.push(...(data.entries || []));
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
let _autoReloadScripts = [];

async function autoReloadMatchingTabs(script) {
  const settings = await SettingsManager.get();
  if (!settings.autoReload) return;

  _autoReloadScripts.push(script);
  if (_autoReloadTimer) clearTimeout(_autoReloadTimer);

  _autoReloadTimer = setTimeout(async () => {
    const scripts = _autoReloadScripts;
    _autoReloadScripts = [];
    _autoReloadTimer = null;

    try {
      const tabs = await chrome.tabs.query({});
      const reloaded = new Set();
      for (const tab of tabs) {
        if (reloaded.has(tab.id)) continue;
        if (tab.url && scripts.some(s => doesScriptMatchUrl(s, tab.url))) {
          chrome.tabs.reload(tab.id);
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

async function updateBadge(tabId = null) {
  const settings = await SettingsManager.get();

  if (!settings.showBadge || settings.enabled === false) {
    chrome.action.setBadgeText({ text: '', tabId: tabId || undefined });
    return;
  }

  // If no specific tab, update all tabs in parallel — fetch settings+scripts once and share
  if (!tabId) {
    try {
      const [tabs, scripts] = await Promise.all([
        chrome.tabs.query({}),
        ScriptStorage.getAll()
      ]);
      await Promise.allSettled(
        tabs.filter(t => t.id && t.url).map(t => updateBadgeForTab(t.id, t.url, settings, scripts))
      );
    } catch (e) {
      chrome.action.setBadgeText({ text: '' });
    }
    return;
  }
}

// Update badge for a specific tab based on its URL.
// Accepts optional pre-fetched settings/scripts to avoid redundant cache reads when
// called from updateBadge() in a loop over many tabs.
async function updateBadgeForTab(tabId, url, settings, scripts) {
  if (!settings) settings = await SettingsManager.get();

  if (!settings.showBadge || settings.enabled === false) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  try {
    // Check global page filter
    if (isUrlBlockedByGlobalSettings(url, settings)) {
      chrome.action.setBadgeText({ text: '', tabId });
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
    chrome.action.setBadgeText({ text: badgeText, tabId });
    chrome.action.setBadgeBackgroundColor({ color: settings.badgeColor || '#22c55e', tabId });
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
    
    // Check path (convert glob to regex)
    const pathRegex = new RegExp('^' + path.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
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

    // Convert glob to regex
    let regex = pattern
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
        title: script.meta.name || script.id,
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
      const url = new URL(tab.url);
      chrome.tabs.create({
        url: `pages/dashboard.html?new=1&host=${encodeURIComponent(url.hostname)}`
      });
      break;
    }
    case 'scriptvault-dashboard':
      chrome.tabs.create({ url: 'pages/dashboard.html' });
      break;
    case 'scriptvault-toggle': {
      const settings = await SettingsManager.get();
      await SettingsManager.set('enabled', !settings.enabled);
      await updateBadge();
      break;
    }
    case 'scriptvault-install-link': {
      // v2.0: Install userscript from a right-clicked .user.js link
      const linkUrl = info.linkUrl;
      if (linkUrl) {
        try {
          const response = await fetch(linkUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const code = await response.text();
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
  switch (command) {
    case 'open_dashboard':
      chrome.tabs.create({ url: 'pages/dashboard.html' });
      break;
    case 'toggle_scripts': {
      const settings = await SettingsManager.get();
      await SettingsManager.set('enabled', !settings.enabled);
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
// Alarms (Auto-update & Sync)
// ============================================================================

// Debounced stats save — coalesces rapid reportExecTime/Error writes into a single storage write
let _statsSaveTimer = null;
function _debouncedStatsSave() {
  if (_statsSaveTimer) clearTimeout(_statsSaveTimer);
  _statsSaveTimer = setTimeout(() => {
    _statsSaveTimer = null;
    ScriptStorage.save().catch(() => {});
  }, 5000);
}

let _backgroundTaskRunning = false;
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Mutual exclusion — don't run update and sync concurrently
  if (_backgroundTaskRunning) {
    debugLog('Skipping alarm', alarm.name, '- another task is running');
    return;
  }
  _backgroundTaskRunning = true;
  try {
    if (alarm.name === 'autoUpdate') {
      await UpdateSystem.autoUpdate();
    } else if (alarm.name === 'autoSync') {
      await CloudSync.sync();
    }
  } catch (e) {
    console.error('[ScriptVault] Alarm handler error:', e);
  } finally {
    _backgroundTaskRunning = false;
  }
});

async function setupAlarms() {
  const settings = await SettingsManager.get();
  
  // Clear existing alarms
  await chrome.alarms.clearAll();
  
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
}

// ============================================================================
// Tab Listeners (for badge updates)
// ============================================================================

// Update badge when tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
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
    }
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
const _pendingFetches = new Set(); // Dedup concurrent fetches
const MAX_SCRIPT_SIZE = 5 * 1024 * 1024; // 5MB limit

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId !== 0) return;

  const url = details.url;

  // Check if this is a .user.js URL
  if (!url.match(/\.user\.js(\?.*)?$/i)) return;

  // Don't intercept extension pages
  if (url.startsWith('chrome-extension://')) return;

  // Dedup concurrent fetches for same URL
  if (_pendingFetches.has(url)) return;
  _pendingFetches.add(url);

  debugLog('Intercepting userscript URL:', url);

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content length before reading body
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_SCRIPT_SIZE) {
      throw new Error(`Script too large (${formatBytes(contentLength)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`);
    }

    const code = await response.text();

    if (code.length > MAX_SCRIPT_SIZE) {
      throw new Error(`Script too large (${formatBytes(code.length)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`);
    }
    
    // Verify it looks like a userscript
    if (!code.includes('==UserScript==')) {
      debugLog('Not a valid userscript, allowing normal navigation');
      _pendingFetches.delete(url);
      return;
    }
    
    // Store pending install data
    await chrome.storage.local.set({
      pendingInstall: {
        url: url,
        code: code,
        timestamp: Date.now()
      }
    });
    
    // Redirect to install page
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('pages/install.html')
    });
    
  } catch (error) {
    console.error('[ScriptVault] Failed to fetch script:', error);
    // Store error for install page to display
    await chrome.storage.local.set({
      pendingInstall: {
        url: url,
        error: error.message,
        timestamp: Date.now()
      }
    });
    
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('pages/install.html')
    });
  } finally {
    _pendingFetches.delete(url);
  }
}, {
  url: [
    { urlMatches: '.*\\.user\\.js(\\?.*)?$' }
  ]
});

// Handle direct script installation from URL
async function installFromUrl(url) {
  try {
    // Timeout after 30 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Size limit: 5MB (same as webNavigation handler)
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_SCRIPT_SIZE) {
      throw new Error(`Script too large (${formatBytes(contentLength)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`);
    }

    const code = await response.text();

    // Post-read size check (content-length may be missing)
    if (code.length > MAX_SCRIPT_SIZE) {
      throw new Error(`Script too large (${formatBytes(code.length)}). Maximum is ${formatBytes(MAX_SCRIPT_SIZE)}.`);
    }

    if (!code.includes('==UserScript==')) {
      throw new Error('Not a valid userscript');
    }
    
    // Parse and save
    const parsed = parseUserscript(code);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    const meta = parsed.meta;
    const allScripts = await ScriptStorage.getAll();

    // Check for existing script with same name+namespace (update instead of duplicate)
    const existing = allScripts.find(s => s.meta.name === meta.name && s.meta.namespace === meta.namespace);
    const id = existing ? existing.id : generateId();

    const script = {
      id,
      code,
      meta,
      enabled: existing ? existing.enabled : true,
      position: existing ? existing.position : allScripts.length,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    await ScriptStorage.set(id, script);
    await registerAllScripts();
    await updateBadge();
    await autoReloadMatchingTabs(script);

    return { success: true, script };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  await SettingsManager.init();
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

  // Register all enabled scripts
  await registerAllScripts();

  await updateBadge();
  await setupAlarms();

  // Clean up stale persistent caches (require_cache_, res_cache_)
  cleanupStaleCaches();

  // v2.0: Run migration if needed
  if (typeof Migration !== 'undefined') {
    try { await Migration.run(); } catch (e) { console.error('[ScriptVault] Migration error:', e); }
  }

  // v2.0: Auto-cleanup storage if above threshold
  if (typeof QuotaManager !== 'undefined') {
    try { await QuotaManager.autoCleanup(); } catch (e) { console.error('[ScriptVault] Quota cleanup error:', e); }
  }

  // v2.0: Register global error handlers for ErrorLog
  if (typeof ErrorLog !== 'undefined' && typeof ErrorLog.registerGlobalHandlers === 'function') {
    ErrorLog.registerGlobalHandlers();
  }

  console.log('[ScriptVault] Service worker ready');
}

// Remove expired persistent cache entries and stale trash items to prevent storage bloat
async function cleanupStaleCaches() {
  try {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const maxRequireAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const maxResourceAge = ResourceCache.maxAge; // 24 hours
    const keysToRemove = [];

    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('require_cache_') && value?.timestamp) {
        if (now - value.timestamp > maxRequireAge) keysToRemove.push(key);
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
    const m = (self.navigator?.userAgent || '').match(/Chrome\/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  } catch (e) {
    return 0;
  }
}

// Configure the userScripts execution world
async function configureUserScriptsWorld() {
  try {
    // Check if userScripts API is available
    if (!chrome.userScripts) {
      // Determine why: Chrome 120+ requires either Developer Mode (pre-138)
      // or the "Allow User Scripts" toggle (138+)
      const ver = _getChromeVersion();
      if (ver >= 138) {
        console.warn('[ScriptVault] userScripts API not available — enable the "Allow User Scripts" toggle in chrome://extensions for ScriptVault');
      } else if (ver >= 120) {
        console.warn('[ScriptVault] userScripts API not available — enable Developer Mode in chrome://extensions');
      } else {
        console.warn('[ScriptVault] userScripts API not available — Chrome 120+ required');
      }
      await SettingsManager.set({ _userScriptsAvailable: false, _chromeVersion: ver });
      return;
    }

    await SettingsManager.set({ _userScriptsAvailable: true, _chromeVersion: _getChromeVersion() });

    // Configure the default USER_SCRIPT world
    await chrome.userScripts.configureWorld({
      csp: "script-src 'self' 'unsafe-inline' 'unsafe-eval' *",
      messaging: true
    });

    debugLog('userScripts world configured (Chrome', _getChromeVersion(), ')');
  } catch (e) {
    console.error('[ScriptVault] Failed to configure userScripts world:', e);
  }
}

// Register all enabled scripts with the userScripts API
async function registerAllScripts() {
  try {
    if (!chrome.userScripts) {
      console.warn('[ScriptVault] userScripts API not available');
      return;
    }
    
    // First, unregister all existing scripts
    await chrome.userScripts.unregister().catch(() => {});
    
    const scripts = await ScriptStorage.getAll();
    const settings = await SettingsManager.get();
    
    if (!settings.enabled) {
      debugLog('Scripts globally disabled');
      return;
    }
    
    const enabledScripts = scripts.filter(s => s.enabled !== false);

    // Sort by @priority (higher = first), then position
    enabledScripts.sort((a, b) => {
      const pa = a.meta?.priority || 0;
      const pb = b.meta?.priority || 0;
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
      await Promise.allSettled([...allRequires].map(url => fetchRequireScript(url)));
      debugLog(`Preloaded in ${Date.now() - preloadStart}ms`);
    }

    // Register all scripts in parallel — significantly faster on large script collections
    const results = await Promise.allSettled(enabledScripts.map(script => registerScript(script)));
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[ScriptVault] ${failures.length} script(s) failed to register:`, failures.map(r => r.reason?.message || r.reason));
    }
  } catch (e) {
    console.error('[ScriptVault] Failed to register scripts:', e);
  }
}

// Register a single script
async function registerScript(script) {
  try {
    if (!chrome.userScripts) return;
    
    const meta = script.meta;
    const settings = script.settings || {};
    
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
    
    // Register the script
    const registration = {
      id: script.id,
      matches: matches,
      excludeMatches: excludeMatches.length > 0 ? excludeMatches : undefined,
      js: [{ code: wrappedCode }],
      runAt: runAt,
      allFrames: !meta.noframes,
      world: world
    };

    // Chrome 133+: configure and use a per-script worldId for isolation.
    // Each script gets its own USER_SCRIPT world so globals don't bleed across scripts.
    let worldConfigured = false;
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

    if (worldConfigured) {
      registration.worldId = script.id;
    }

    try {
      // Chrome 131+ supports messaging in USER_SCRIPT world
      await chrome.userScripts.register([{ ...registration, messaging: world === 'USER_SCRIPT' }]);
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
    console.error(`[ScriptVault] Failed to register ${script.meta.name}:`, e);
    // Mark script with registration failure for UI display
    try {
      script.settings = script.settings || {};
      script.settings._registrationError = e.message || 'Registration failed';
      await ScriptStorage.set(script.id, script);
    } catch {}
  }
}

// Cache for @require scripts (in-memory for current session)
const requireCache = new Map();

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
async function verifySRI(code, hashStr) {
  if (!hashStr) return true;
  // Support formats: sha256-<base64>, md5-<hex>, or just <hex>
  const match = hashStr.match(/^(sha256|sha384|sha512|md5)[-=](.+)$/i);
  if (!match) return true; // Unknown format, skip verification
  const [, algo, expected] = match;
  if (algo.toLowerCase() === 'md5') return true; // Can't verify MD5 with SubtleCrypto
  const algoMap = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  try {
    const digest = await crypto.subtle.digest(algoMap[algo.toLowerCase()], new TextEncoder().encode(code));
    const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return actual === expected;
  } catch (e) {
    return true; // Verification not possible, allow
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
        requireCache.set(url, cached[cacheKey].code);
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
        requireCache.set(fetchUrl, code);
        
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

// Fetch with retry and proper options
async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
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
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Reject excessively large @require scripts (>5MB) to prevent memory issues
      const MAX_REQUIRE_BYTES = 5 * 1024 * 1024;
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_REQUIRE_BYTES) {
        throw new Error(`Response too large (${Math.round(contentLength / 1024)}KB, max 5MB)`);
      }

      const code = await response.text();

      if (code.length > MAX_REQUIRE_BYTES) {
        throw new Error(`Response too large (${Math.round(code.length / 1024)}KB, max 5MB)`);
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
const _webRequestRuleMap = new Map();

// Stable numeric rule ID from a string (scriptId + rule index)
function _makeRuleId(scriptId, index) {
  // Use a hash-like approach: sum char codes * position, mod safe range
  let h = 0;
  for (let i = 0; i < scriptId.length; i++) h = (h * 31 + scriptId.charCodeAt(i)) & 0x7fffffff;
  return ((h % 100000) * 100 + (index % 100)) || (index + 1);
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
      debugLog(`[GM_webRequest] Applied ${dnrRules.length} rules for script ${scriptId}`);
    }
  } catch (e) {
    console.warn('[ScriptVault] GM_webRequest rule apply failed:', e.message);
  }
}

async function removeWebRequestRules(scriptId) {
  if (!chrome.declarativeNetRequest) return;
  const existing = _webRequestRuleMap.get(scriptId);
  if (existing && existing.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing });
    } catch (e) {}
    _webRequestRuleMap.delete(scriptId);
  }
}

async function unregisterScript(scriptId) {
  // Remove any @webRequest declarativeNetRequest rules
  await removeWebRequestRules(scriptId);
  try {
    if (!chrome.userScripts) return;
    await chrome.userScripts.unregister({ ids: [scriptId] });
    // Chrome 133+: reset the per-script world configuration to free resources
    try {
      await chrome.userScripts.resetWorldConfiguration({ worldId: scriptId });
    } catch (e) {
      // Chrome <133 doesn't support resetWorldConfiguration — ignore
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
  const scriptId = ${JSON.stringify(script.id)};
  const meta = ${JSON.stringify(meta)};
  const grants = ${JSON.stringify(grants)};
  const grantSet = new Set(grants);
  
  // Channel ID for communication with content script bridge
  // Extension ID is injected at build time since chrome.runtime isn't available in USER_SCRIPT world
  const CHANNEL_ID = ${JSON.stringify('ScriptVault_' + extId)};
  
  // console.log('[ScriptVault] Script initializing:', meta.name, 'Channel:', CHANNEL_ID);
  
  // Grant checking - @grant none means NO APIs except GM_info
  const hasNone = grantSet.has('none');
  const hasGrant = (n) => {
    if (hasNone) return false;
    if (grants.length === 0) return true;
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
      supportURL: meta.supportURL || ''
    },
    scriptMetaStr: ${JSON.stringify(script.code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)?.[0] || '')},
    scriptHandler: 'ScriptVault',
    scriptSource: 'ScriptVault',
    version: ${JSON.stringify(chrome.runtime.getManifest().version)},
    scriptWillUpdate: !!(meta.updateURL || meta.downloadURL),
    isIncognito: typeof chrome !== 'undefined' && chrome.extension ? chrome.extension.inIncognitoContext : false,
    downloadMode: 'browser',
    platform: {
      os: navigator.userAgentData?.platform || navigator.platform || 'unknown',
      arch: navigator.userAgentData?.architecture || 'unknown',
      browserName: 'Chrome',
      browserVersion: navigator.userAgent?.match(/Chrome\\/([\\d.]+)/)?.[1] || 'unknown'
    },
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
      const cb = _menuCmds.get(msg.commandId);
      if (cb) try { cb(); } catch(err) { /* silently ignore menu command errors */ }
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
  
  // Send message to background script
  // Prefers chrome.runtime.sendMessage (direct, no bridge needed) when available via messaging: true
  // Falls back to postMessage bridge for older Chrome versions
  async function sendToBackground(action, data) {
    // Try direct messaging first (available when userScripts world has messaging: true)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        return await chrome.runtime.sendMessage({ action, data });
      } catch (e) {
        // Extension context invalidated or messaging not available, fall through to bridge
      }
    }

    // Fallback: use content script bridge via postMessage
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
      }, '/');
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

    // Start the request
    sendToBackground('GM_xmlhttpRequest', {
      scriptId,
      method: details.method || 'GET',
      url: details.url,
      headers: details.headers,
      data: details.data,
      timeout: details.timeout,
      responseType: details.responseType,
      overrideMimeType: details.overrideMimeType,
      user: details.user,
      password: details.password,
      context: details.context,
      anonymous: details.anonymous,
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
    }).then(response => {
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
    }).catch(err => {
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
  
  // GM_notification (with onclick, ondone, timeout, tag, silent, highlight, url)
  const _notifCallbacks = new Map();
  function GM_notification(details, ondone) {
    if (!hasGrant('GM_notification') && !hasGrant('GM.notification')) return;
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
    // Store callbacks
    _notifCallbacks.set(notifTag, {
      onclick: opts.onclick, ondone: opts.ondone
    });
    // Highlight tab instead of notification
    if (opts.highlight) {
      sendToBackground('GM_focusTab', {}).catch(() => {});
      if (opts.ondone) { try { opts.ondone(); } catch(e) {} }
      return;
    }
    sendToBackground('GM_notification', {
      scriptId,
      title: opts.title || GM_info.script.name,
      text: opts.text || opts.body || '',
      image: opts.image,
      timeout: opts.timeout || 0,
      tag: notifTag,
      silent: opts.silent || false,
      hasOnclick: !!opts.onclick,
      hasOndone: !!opts.ondone
    }).catch(() => {});
  }
  
  // GM_openInTab (with close(), onclose, insert, setParent, incognito)
  const _openedTabs = new Map();
  function GM_openInTab(url, options) {
    if (!hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return null;
    const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    const tabHandle = { closed: false, onclose: null, close: () => {} };
    sendToBackground('GM_openInTab', {
      url, scriptId, trackClose: true,
      active: opts.active, insert: opts.insert,
      setParent: opts.setParent, background: opts.background
    }).then(result => {
      if (result && result.tabId) {
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
  const _downloadCallbacks = new Map();
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
        _downloadCallbacks.set(result.downloadId, callbacks);
      }
      if (result && result.error && callbacks.onerror) {
        try { callbacks.onerror({ error: result.error }); } catch(e) {}
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
    _menuCmds.set(id, callback);
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
    return Array.from(_menuCmds.entries()).map(([id, cb]) => ({ id, name: id }));
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
    if (isBlobUrl === false) return dataUri;
    try {
      const resp = await fetch(dataUri);
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      return dataUri;
    }
  }
  
  // GM_addElement
  function GM_addElement(parentOrTag, tagOrAttrs, attrsOrUndefined) {
    if (!hasGrant('GM_addElement') && !hasGrant('GM.addElement')) return null;
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
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'textContent') el.textContent = v;
        else if (k === 'innerHTML') el.innerHTML = v;
        else el.setAttribute(k, v);
      });
    }
    if (parent) parent.appendChild(el);
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
    const result = await sendToBackground('GM_loadScript', { url, timeout: options.timeout });
    if (result.error) throw new Error('GM_loadScript: ' + result.error);
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
    sendToBackground('GM_getTab', { scriptId }).then(data => {
      _tabData = data || {};
      if (callback) callback(_tabData);
    }).catch(() => { if (callback) callback(_tabData); });
    return _tabData;
  }
  function GM_saveTab(tab) {
    _tabData = tab || {};
    sendToBackground('GM_saveTab', { scriptId, data: _tabData }).catch(() => {});
  }
  function GM_getTabs(callback) {
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
        if (callback) callback(r.cookies || [], r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback([], e); });
    },
    set: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_set', details || {}).then(r => {
        if (callback) callback(r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    delete: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_delete', details || {}).then(r => {
        if (callback) callback(r.error ? new Error(r.error) : undefined);
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
  window.GM_setClipboard = GM_setClipboard;
  window.GM_notification = GM_notification;
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
  // Tampermonkey-compatible: fires when URL changes via pushState/replaceState/popstate
  if (hasGrant('window.onurlchange')) {
    let _lastUrl = location.href;
    const _urlChangeHandlers = [];

    function __checkUrlChange() {
      const newUrl = location.href;
      if (newUrl !== _lastUrl) {
        const oldUrl = _lastUrl;
        _lastUrl = newUrl;
        const event = { url: newUrl, oldUrl };
        _urlChangeHandlers.forEach(fn => { try { fn(event); } catch(e) {} });
        if (typeof window.onurlchange === 'function') {
          try { window.onurlchange(event); } catch(e) {}
        }
      }
    }

    // Intercept history API
    const _origPushState = history.pushState;
    const _origReplaceState = history.replaceState;
    history.pushState = function() {
      _origPushState.apply(this, arguments);
      __checkUrlChange();
    };
    history.replaceState = function() {
      _origReplaceState.apply(this, arguments);
      __checkUrlChange();
    };
    window.addEventListener('popstate', __checkUrlChange);
    window.addEventListener('hashchange', __checkUrlChange);

    // Allow adding multiple handlers via addEventListener pattern
    window.addEventListener = new Proxy(window.addEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          _urlChangeHandlers.push(args[1]);
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
    window.onurlchange = null; // Initialize as settable
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

    // ── fetch ──────────────────────────────────────────────────────────────
    const _origFetch = window.fetch;
    window.fetch = function __svFetch(input, init) {
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
    };

    // ── XMLHttpRequest ─────────────────────────────────────────────────────
    const _OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function __svXHR() {
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
    window.XMLHttpRequest.prototype = _OrigXHR.prototype;

    // ── WebSocket ──────────────────────────────────────────────────────────
    const _OrigWS = window.WebSocket;
    window.WebSocket = function __svWebSocket(url, protocols) {
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
    window.WebSocket.prototype = _OrigWS.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

    // ── sendBeacon ─────────────────────────────────────────────────────────
    const _origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function __svBeacon(url, data) {
      const result = _origBeacon(url, data);
      const size = data ? (typeof data === 'string' ? data.length : (data?.byteLength || data?.size || 0)) : 0;
      _log({ type: 'beacon', method: 'POST', url: String(url), status: result ? 200 : 0, duration: 0, responseSize: size });
      return result;
    };
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
  const userCode = meta['top-level-await']
    ? `(async () => {\n${script.code}\n})();`
    : script.code;

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
  return pattern && pattern.startsWith('/') && pattern.length > 2 &&
    (pattern.endsWith('/') || /\/[gimsuy]*$/.test(pattern));
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

init();
