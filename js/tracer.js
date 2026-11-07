/* Vectorising engine (REQ-035): a bitmap in, smooth closed outlines out. No DOM; tested in Node (tests/tracer.test.js).
 *
 * Image effects work on a grey field `ink` (0..255, high = part of the shape). `PTD.tracer.process(img, opts)` runs the whole chain:
 *   transparency on white -> grey scale -> levels (automatic stretch, brightness, contrast) -> blur -> threshold (automatic by
 *   Otsu, or a value) -> grow or shrink -> contours at the threshold level by marching squares with linear interpolation (so the
 *   edge is found between the pixels, not on their steps) -> specks and tiny holes dropped -> corners found -> every stretch
 *   between corners fitted with cubic Beziers (Schneider's curve fitting; stretches that are straight stay straight lines).
 * The result is a list of contours in the glyph format (see glyph.js), in pixel units with y down. Own implementation; the method
 * of Potrace is public but Potrace itself is GPL and is not used here. */
(function (PTD) {
  "use strict";
  var T = {};

  /* ---------- the effects ---------- */
  /* RGBA bytes to a grey field where dark is high (ink). Transparent pixels count as white paper. */
  T.inkFromRGBA = function (rgba, w, h) {
    var n = w * h, ink = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var a = rgba[i * 4 + 3] / 255, r = rgba[i * 4] * a + 255 * (1 - a), g = rgba[i * 4 + 1] * a + 255 * (1 - a), b = rgba[i * 4 + 2] * a + 255 * (1 - a);
      ink[i] = 255 - (0.299 * r + 0.587 * g + 0.114 * b);
    }
    return ink;
  };
  function percentile(a, p) {
    var hist = new Uint32Array(256), i; for (i = 0; i < a.length; i++) hist[Math.max(0, Math.min(255, Math.round(a[i])))]++;
    var target = a.length * p, acc = 0; for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= target) return i; }
    return 255;
  }
  /* Levels: auto stretches the 1 % and 99 % points to 0 and 255; then brightness (-100..100) and contrast (-100..100). */
  T.levels = function (ink, o) {
    var out = new Float32Array(ink.length), lo = 0, hi = 255;
    if (o.auto) { lo = percentile(ink, 0.01); hi = percentile(ink, 0.99); if (hi - lo < 16) { lo = 0; hi = 255; } }
    var k = 255 / (hi - lo), br = (o.brightness || 0) * 2.55, c = (o.contrast || 0) / 100, cf = c >= 0 ? 1 / Math.max(0.02, 1 - c) : 1 + c;
    for (var i = 0; i < ink.length; i++) {
      var v = (ink[i] - lo) * k + br;
      v = (v - 127.5) * cf + 127.5;
      out[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    return out;
  };
  T.blur = function (a, w, h, sigma) {
    if (!(sigma > 0.05)) return a;
    var r = Math.max(1, Math.ceil(sigma * 3)), ker = new Float32Array(2 * r + 1), s = 0, i, x, y;
    for (i = -r; i <= r; i++) { ker[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += ker[i + r]; }
    for (i = 0; i < ker.length; i++) ker[i] /= s;
    var tmp = new Float32Array(a.length), out = new Float32Array(a.length);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var acc = 0; for (i = -r; i <= r; i++) { var xx = Math.min(w - 1, Math.max(0, x + i)); acc += a[y * w + xx] * ker[i + r]; }
      tmp[y * w + x] = acc;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var ac2 = 0; for (i = -r; i <= r; i++) { var yy = Math.min(h - 1, Math.max(0, y + i)); ac2 += tmp[yy * w + x] * ker[i + r]; }
      out[y * w + x] = ac2;
    }
    return out;
  };
  /* Otsu's automatic threshold of a 0..255 field. */
  T.otsu = function (a) {
    var hist = new Float64Array(256), i, n = a.length;
    for (i = 0; i < n; i++) hist[Math.max(0, Math.min(255, Math.round(a[i])))]++;
    var sum = 0; for (i = 0; i < 256; i++) sum += i * hist[i];
    var wB = 0, sB = 0, lo = 127, hi = 127, bv = -1;
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      var wF = n - wB; if (!wF) break;
      sB += i * hist[i];
      var mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > bv * (1 + 1e-9)) { bv = v; lo = hi = i; } else if (v >= bv * (1 - 1e-9)) hi = i;   /* a flat top (two clean levels): the middle of it */
    }
    return Math.max(8, Math.min(247, (lo + hi) / 2 + 0.5));
  };
  /* The picture is mostly paper: when the border of the image is mostly ink, the shape is the light part. */
  T.borderIsInk = function (ink, w, h, level) {
    var c = 0, n = 0, x, y;
    for (x = 0; x < w; x++) { n += 2; if (ink[x] >= level) c++; if (ink[(h - 1) * w + x] >= level) c++; }
    for (y = 1; y < h - 1; y++) { n += 2; if (ink[y * w] >= level) c++; if (ink[y * w + w - 1] >= level) c++; }
    return n > 0 && c / n > 0.5;
  };
  /* Grow (r > 0: the ink gets thicker) or shrink (r < 0) the shape by r pixels: a max or min filter with a round window. */
  T.grow = function (a, w, h, r) {
    var m = Math.round(Math.abs(r)); if (!m) return a;
    var up = r > 0, out = new Float32Array(a.length), offs = [], dx, dy;
    for (dy = -m; dy <= m; dy++) for (dx = -m; dx <= m; dx++) if (dx * dx + dy * dy <= m * m + 0.5) offs.push([dx, dy]);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var v = up ? 0 : 255;
      for (var k = 0; k < offs.length; k++) {
        var xx = x + offs[k][0], yy = y + offs[k][1];
        var q = (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : a[yy * w + xx];
        if (up ? q > v : q < v) v = q;
      }
      out[y * w + x] = v;
    }
    return out;
  };
  /* A smaller copy (average of blocks) so that big pictures stay quick. Returns { ink, w, h, f } with f = old size / new size. */
  T.shrinkTo = function (ink, w, h, maxSide) {
    var big = Math.max(w, h); if (big <= maxSide) return { ink: ink, w: w, h: h, f: 1 };
    var f = big / maxSide, nw = Math.max(1, Math.round(w / f)), nh = Math.max(1, Math.round(h / f)), out = new Float32Array(nw * nh);
    for (var y = 0; y < nh; y++) for (var x = 0; x < nw; x++) {
      var x0 = Math.floor(x * w / nw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / nw)), y0 = Math.floor(y * h / nh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / nh)), s = 0, c = 0;
      for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { s += ink[yy * w + xx]; c++; }
      out[y * nw + x] = s / c;
    }
    return { ink: out, w: nw, h: nh, f: w / nw };
  };

  /* ---------- contours at a level (marching squares, linear interpolation, padded with paper) ---------- */
  T.contoursAt = function (ink, w, h, level) {
    var W = w + 2;
    function val(x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? 0 : ink[y * w + x]; }
    function eH(x, y) { return ((y + 1) * W + (x + 1)) * 2; }       /* edge between (x,y) and (x+1,y) */
    function eV(x, y) { return ((y + 1) * W + (x + 1)) * 2 + 1; }   /* edge between (x,y) and (x,y+1) */
    var pts = new Map(), segA = [], segB = [], adj = new Map();
    function pointH(x, y) { var id = eH(x, y); if (!pts.has(id)) { var a = val(x, y), b = val(x + 1, y); pts.set(id, [x + (level - a) / (b - a), y]); } return id; }
    function pointV(x, y) { var id = eV(x, y); if (!pts.has(id)) { var a = val(x, y), b = val(x, y + 1); pts.set(id, [x, y + (level - a) / (b - a)]); } return id; }
    function seg(a, b) {
      var k = segA.length; segA.push(a); segB.push(b);
      var l = adj.get(a); if (l) l.push(k); else adj.set(a, [k]);
      l = adj.get(b); if (l) l.push(k); else adj.set(b, [k]);
    }
    for (var y = -1; y < h; y++) for (var x = -1; x < w; x++) {
      var tl = val(x, y), tr = val(x + 1, y), br = val(x + 1, y + 1), bl = val(x, y + 1);
      var c = (tl >= level ? 1 : 0) | (tr >= level ? 2 : 0) | (br >= level ? 4 : 0) | (bl >= level ? 8 : 0);
      if (c === 0 || c === 15) continue;
      var top = function () { return pointH(x, y); }, bot = function () { return pointH(x, y + 1); }, lef = function () { return pointV(x, y); }, rig = function () { return pointV(x + 1, y); };
      switch (c) {
        case 1: case 14: seg(lef(), top()); break;
        case 2: case 13: seg(top(), rig()); break;
        case 3: case 12: seg(lef(), rig()); break;
        case 4: case 11: seg(rig(), bot()); break;
        case 6: case 9: seg(top(), bot()); break;
        case 7: case 8: seg(lef(), bot()); break;
        case 5: if ((tl + tr + br + bl) / 4 >= level) { seg(top(), rig()); seg(lef(), bot()); } else { seg(lef(), top()); seg(rig(), bot()); } break;
        case 10: if ((tl + tr + br + bl) / 4 >= level) { seg(lef(), top()); seg(rig(), bot()); } else { seg(top(), rig()); seg(lef(), bot()); } break;
      }
    }
    var used = new Uint8Array(segA.length), loops = [];
    for (var s0 = 0; s0 < segA.length; s0++) {
      if (used[s0]) continue;
      var start = segA[s0], cur = segB[s0], seg0 = s0, loop = [pts.get(start)], guard = 0;
      used[s0] = 1;
      while (cur !== start && guard++ < 50000000) {
        loop.push(pts.get(cur));
        var l = adj.get(cur), nx = -1;
        for (var q = 0; q < l.length; q++) if (l[q] !== seg0 && !used[l[q]]) { nx = l[q]; break; }
        if (nx < 0) break;
        used[nx] = 1; seg0 = nx; cur = segA[nx] === cur ? segB[nx] : segA[nx];
      }
      if (loop.length > 2) loops.push(loop);
    }
    return loops;
  };
  function area(p) { var a = 0; for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }

  /* ---------- corners and curve fitting ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function len(a) { return Math.hypot(a[0], a[1]); }
  function unit(a) { var l = len(a); return l < 1e-12 ? [0, 0] : [a[0] / l, a[1] / l]; }
  function bez(c, t) { var u = 1 - t; return [u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0], u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]]; }
  function bez1(c, t) { var u = 1 - t; return [3 * u * u * (c[1][0] - c[0][0]) + 6 * u * t * (c[2][0] - c[1][0]) + 3 * t * t * (c[3][0] - c[2][0]), 3 * u * u * (c[1][1] - c[0][1]) + 6 * u * t * (c[2][1] - c[1][1]) + 3 * t * t * (c[3][1] - c[2][1])]; }
  function bez2(c, t) { var u = 1 - t; return [6 * u * (c[2][0] - 2 * c[1][0] + c[0][0]) + 6 * t * (c[3][0] - 2 * c[2][0] + c[1][0]), 6 * u * (c[2][1] - 2 * c[1][1] + c[0][1]) + 6 * t * (c[3][1] - 2 * c[2][1] + c[1][1])]; }
  function chordParam(P, a, b) {
    var u = [0]; for (var i = a + 1; i <= b; i++) u.push(u[u.length - 1] + len(sub(P[i], P[i - 1])));
    var tot = u[u.length - 1] || 1; return u.map(function (v) { return v / tot; });
  }
  function genBezier(P, a, b, u, t1, t2) {
    var n = b - a + 1, A = [], i, c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0, p0 = P[a], p3 = P[b];
    for (i = 0; i < n; i++) { var t = u[i], m = 1 - t, b1 = 3 * t * m * m, b2 = 3 * t * t * m; A.push([mul(t1, b1), mul(t2, b2)]); }
    for (i = 0; i < n; i++) {
      c00 += dot(A[i][0], A[i][0]); c01 += dot(A[i][0], A[i][1]); c11 += dot(A[i][1], A[i][1]);
      var tt = u[i], mm = 1 - tt, base = add(add(mul(p0, mm * mm * mm), mul(p0, 3 * tt * mm * mm)), add(mul(p3, 3 * tt * tt * mm), mul(p3, tt * tt * tt)));
      var tmp = sub(P[a + i], base);
      x0 += dot(A[i][0], tmp); x1 += dot(A[i][1], tmp);
    }
    var det = c00 * c11 - c01 * c01, al1, al2, seg = len(sub(p3, p0));
    if (Math.abs(det) > 1e-12) { al1 = (x0 * c11 - x1 * c01) / det; al2 = (c00 * x1 - c01 * x0) / det; } else { al1 = al2 = 0; }
    var eps = 1e-6 * seg;
    if (al1 < eps || al2 < eps) { al1 = al2 = seg / 3; }
    return [p0, add(p0, mul(t1, al1)), add(p3, mul(t2, al2)), p3];
  }
  function newton(c, p, t) {
    var d = sub(bez(c, t), p), d1 = bez1(c, t), d2 = bez2(c, t), num = dot(d, d1), den = dot(d1, d1) + dot(d, d2);
    return Math.abs(den) < 1e-12 ? t : t - num / den;
  }
  function maxErr(P, a, b, c, u) {
    var worst = 0, at = Math.floor((a + b) / 2);
    for (var i = a + 1; i < b; i++) { var d = sub(bez(c, u[i - a]), P[i]), e = d[0] * d[0] + d[1] * d[1]; if (e > worst) { worst = e; at = i; } }
    return { e: worst, at: at };
  }
  /* Fits cubic Beziers to P[a..b] (an open stretch) with tangent directions t1 (leaving a) and t2 (entering b, pointing back). */
  function fitCubic(P, a, b, t1, t2, tol, out, depth) {
    var n = b - a + 1;
    if (n === 2) { out.push(["L", P[b][0], P[b][1]]); return; }
    /* straight stretch: a line */
    var ch = unit(sub(P[b], P[a])), flat = len(sub(P[b], P[a])) > 1e-9, i;
    for (i = a + 1; flat && i < b; i++) { var v = sub(P[i], P[a]); if (Math.abs(v[0] * ch[1] - v[1] * ch[0]) > tol * 0.5) { flat = false; break; } }
    if (flat) { out.push(["L", P[b][0], P[b][1]]); return; }
    var u = chordParam(P, a, b), c = genBezier(P, a, b, u, t1, t2), er = maxErr(P, a, b, c, u), tol2 = tol * tol;
    if (er.e < tol2) { out.push(["C", c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1]]); return; }
    if (er.e < tol2 * 16) {
      for (var it = 0; it < 6; it++) {
        for (i = 0; i < n; i++) u[i] = newton(c, P[a + i], u[i]);
        c = genBezier(P, a, b, u, t1, t2); er = maxErr(P, a, b, c, u);
        if (er.e < tol2) { out.push(["C", c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1]]); return; }
      }
    }
    var at = Math.max(a + 1, Math.min(b - 1, er.at)), tc = unit(sub(P[at - 1], P[Math.min(b, at + 1)]));
    if (depth > 40 || at <= a || at >= b) { out.push(["L", P[b][0], P[b][1]]); return; }
    fitCubic(P, a, at, t1, tc, tol, out, depth + 1);
    fitCubic(P, at, b, mul(tc, -1), t2, tol, out, depth + 1);
  }
  function tangentFwd(P, i, k) { var j = Math.min(P.length - 1, i + k); return unit(sub(P[j], P[i])); }
  function tangentBack(P, i, k) { var j = Math.max(0, i - k); return unit(sub(P[j], P[i])); }

  /* Corner indices of a closed loop: places where the direction turns by more than `deg` degrees over a window of `win` pixels. */
  function corners(P, win, deg) {
    var n = P.length, cum = [0], i;
    for (i = 1; i <= n; i++) cum.push(cum[i - 1] + len(sub(P[i % n], P[i - 1])));
    var total = cum[n]; if (total < 6 * win) return [];
    function at(i, dist) {   /* the point `dist` away along the loop from index i (dist may be negative) */
      var target = cum[i] + dist; target = ((target % total) + total) % total;
      var lo = 0, hi = n; while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
      return P[lo % n];
    }
    var turn = new Float32Array(n), thr = deg * Math.PI / 180;
    for (i = 0; i < n; i++) {
      var a = sub(P[i], at(i, -win)), b = sub(at(i, win), P[i]), la = len(a), lb = len(b);
      if (la < 1e-9 || lb < 1e-9) continue;
      turn[i] = Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb))));
    }
    var out = [];
    for (i = 0; i < n; i++) {
      if (turn[i] < thr) continue;
      var best = true, d;
      for (var j = 1; j < n && best; j++) {
        var k = (i + j) % n; d = Math.min(Math.abs(cum[k] - cum[i]), total - Math.abs(cum[k] - cum[i]));
        if (d > win) { if (cum[k] - cum[i] > win && cum[k] - cum[i] < total - win) { j = n; } continue; }
        if (turn[k] > turn[i] || (turn[k] === turn[i] && k < i)) best = false;
      }
      if (best) out.push(i);
    }
    return out;
  }
  /* A closed polyline to a closed contour of lines and cubic Beziers. */
  T.fitLoop = function (P, tol, win, cornerDeg) {
    var n = P.length, k = Math.max(1, Math.min(4, Math.floor(n / 8))), cs = cornerDeg < 180 ? corners(P, win, cornerDeg) : [], segs = [], out = [];
    if (!cs.length) {
      /* no corner: two halves, with the same tangent where they meet (so the outline is smooth everywhere) */
      var m = n >> 1, Q = P.concat([P[0]]);
      var tA = unit(sub(P[1 % n], P[n - 1])), tB = unit(sub(P[(m + 1) % n], P[m - 1]));
      fitCubic(Q, 0, m, tA, mul(tB, -1), tol, segs, 0);
      fitCubic(Q, m, n, tB, mul(tA, -1), tol, segs, 0);
      return { s: [P[0][0], P[0][1]], segs: segs, closed: true };
    }
    for (var c = 0; c < cs.length; c++) {
      var i0 = cs[c], i1 = cs[(c + 1) % cs.length], piece = [], i = i0;
      do { piece.push(P[i]); i = (i + 1) % n; } while (i !== i1 && piece.length <= n);
      piece.push(P[i1]);
      if (piece.length < 2) continue;
      fitCubic(piece, 0, piece.length - 1, tangentFwd(piece, 0, k), tangentBack(piece, piece.length - 1, k), tol, segs, 0);
    }
    out = segs;
    var f = P[cs[0]];
    return { s: [f[0], f[1]], segs: out, closed: true };
  };

  /* ---------- the whole chain ---------- */
  /* img = { w, h, rgba } (bytes) or { w, h, ink } (a field). Options (all optional):
   *   levels { auto, brightness, contrast }, blur (sigma, px), threshold (null = automatic), invert ("auto", true, false), grow (px),
   *   speck (smallest island or hole, px squared), tol (curve error, px), cornerDeg (corner turn angle), maxSide (work size).
   * Returns { contours, ink (the field after the effects), w, h, threshold, inverted, stats }. */
  T.process = function (img, o) {
    o = o || {};
    var w = img.w, h = img.h, ink = img.ink || T.inkFromRGBA(img.rgba, w, h);
    var sh = T.shrinkTo(ink, w, h, o.maxSide || 1600); ink = sh.ink; w = sh.w; h = sh.h;
    ink = T.levels(ink, o.levels || { auto: true });
    var lvl0 = o.threshold != null ? o.threshold : T.otsu(ink), inv = o.invert === "auto" || o.invert == null ? T.borderIsInk(ink, w, h, lvl0) : !!o.invert;
    if (inv) { var f = new Float32Array(ink.length); for (var i = 0; i < ink.length; i++) f[i] = 255 - ink[i]; ink = f; }
    ink = T.blur(ink, w, h, o.blur == null ? 0.8 : o.blur);
    var level = o.threshold != null ? (inv ? 255 - o.threshold : o.threshold) : T.otsu(ink);
    if (o.grow) ink = T.grow(ink, w, h, o.grow);
    var loops = T.contoursAt(ink, w, h, level), speck = o.speck != null ? o.speck : 8, kept = loops.filter(function (l) { return Math.abs(area(l)) >= speck; });
    var tol = o.tol != null ? o.tol : 0.6, win = Math.max(2.5, tol * 3), cd = o.cornerDeg != null ? o.cornerDeg : 55;
    var contours = kept.map(function (l) { return T.fitLoop(l, tol, win, cd); });
    var nodes = 0; contours.forEach(function (c) { nodes += c.segs.length; });
    return { contours: contours, ink: ink, w: w, h: h, threshold: level, inverted: inv, scale: sh.f, stats: { loops: loops.length, kept: kept.length, nodes: nodes } };
  };

  PTD.tracer = T;
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
