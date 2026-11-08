/* Paths and patterns (REQ-046, REQ-047, REQ-048).
 * A PATH is an invisible open or closed line: a circle, a regular polygon, lines in a row with a rounding at each node, a reference to a
 * table line (outline, rail, wrap line, player-area line) or the outer edge of selected objects. All coordinates are millimetres in the
 * artwork coordinates (the same as the position of a text).
 * A PATTERN is a stack of generators (plain line, sine wave, running dog, interlace) drawn along the loops of a path, bottom first.
 * The stack is united into one flat shape (Clipper); the halo of the whole result is the halo of the pattern layer.
 * This file has no browser parts, so that it can be tested with Node. The browser parts are in pathsui.js. */
(function (PTD) {
  "use strict";
  var P = {};
  var CL = null, K = 1000;   /* Clipper works in integers: one millimetre is K units */
  P.useClipper = function (c) { CL = c; };
  function clip() {
    if (CL) return CL;
    if (typeof window !== "undefined" && window.ClipperLib) return window.ClipperLib;
    if (typeof require === "function") { try { return require("./clipper.js"); } catch (e) { /* none */ } }
    throw new Error("The polygon library (Clipper) is not available.");
  }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- the recipes: what is saved ---------- */
  P.KINDS = [["circle", "Circle"], ["polygon", "Polygon"], ["lines", "Lines in a row"], ["table", "Table line"], ["objects", "Around objects"]];
  P.TABLE_LINES = [["outline", "Table outline"], ["rail", "Rail (outer edge)"], ["wrap", "Wrap line"], ["bet", "Player-area line"]];
  P.defaultPath = function (kind) {
    var o = { name: "Path", kind: kind || "circle", reverse: false, start: 0 };
    if (o.kind === "circle") { o.cx = 0; o.cy = 0; o.r = 500; }
    else if (o.kind === "polygon") { o.cx = 0; o.cy = 0; o.r = 500; o.sides = 6; o.rot = 0; o.cr = 0; }
    else if (o.kind === "lines") { o.closed = false; o.pts = [{ x: -400, y: 0, r: 0 }, { x: 0, y: 250, r: 0 }, { x: 400, y: 0, r: 0 }]; }
    else if (o.kind === "table") { o.table = ""; o.which = "outline"; o.dist = 0; }
    else if (o.kind === "objects") { o.items = []; o.dist = 20; o.close = 40; o.shape = "islands"; o.holes = false; o.halo = "ink"; o.frozen = null; }
    return o;
  };
  P.normPath = function (o, id) {
    o = o && typeof o === "object" ? o : {};
    var kind = P.KINDS.some(function (k) { return k[0] === o.kind; }) ? o.kind : "circle";
    var d = P.defaultPath(kind), p = Object.assign(d, o);
    p.id = id; p.kind = kind; p.name = String(p.name || "Path");
    p.reverse = !!p.reverse; p.start = clamp(num(p.start, 0), 0, 1);
    if (kind === "circle") { p.cx = num(p.cx, 0); p.cy = num(p.cy, 0); p.r = Math.max(1, num(p.r, 500)); }
    if (kind === "polygon") { p.cx = num(p.cx, 0); p.cy = num(p.cy, 0); p.r = Math.max(1, num(p.r, 500)); p.sides = clamp(Math.round(num(p.sides, 6)), 3, 64); p.rot = num(p.rot, 0); p.cr = Math.max(0, num(p.cr, 0)); }
    if (kind === "lines") {
      p.closed = !!p.closed;
      p.pts = (Array.isArray(p.pts) ? p.pts : []).map(function (q) { return { x: num(q && q.x, 0), y: num(q && q.y, 0), r: Math.max(0, num(q && q.r, 0)) }; });
      if (p.pts.length < 2) p.pts = d.pts;
    }
    if (kind === "table") { p.table = String(p.table || ""); p.which = P.TABLE_LINES.some(function (k) { return k[0] === p.which; }) ? p.which : "outline"; p.dist = num(p.dist, 0); }
    if (kind === "objects") {
      p.items = (Array.isArray(p.items) ? p.items : []).map(function (it) { return it && it.g ? { g: String(it.g) } : it && it.l ? { l: String(it.l) } : null; }).filter(Boolean);
      p.dist = num(p.dist, 20); p.close = Math.max(0, num(p.close, 40));
      p.shape = ["islands", "hull", "box"].indexOf(p.shape) >= 0 ? p.shape : "islands"; p.holes = !!p.holes;
      p.halo = ["ink", "halo", "frozen"].indexOf(p.halo) >= 0 ? p.halo : "ink";
      p.frozen = Array.isArray(p.frozen) ? p.frozen.map(function (l) { return { closed: l.closed !== false, pts: (l.pts || []).map(function (q) { return [num(q[0], 0), num(q[1], 0)]; }) }; }).filter(function (l) { return l.pts.length > 1; }) : null;
    }
    return p;
  };
  P.normAll = function (arr) {
    var out = [], seen = {};
    (Array.isArray(arr) ? arr : []).forEach(function (o) {
      if (!o || typeof o !== "object") return;
      var id = String(o.id || ""); if (!id || seen[id]) { var n = out.length + 1; id = "pa" + n; while (seen[id]) id = "pa" + (++n); }
      seen[id] = 1; out.push(P.normPath(o, id));
    });
    return out;
  };
  P.GENS = [["line", "Plain line"], ["sine", "Sine wave"], ["scroll", "Running dog"], ["interlace", "Interlace"], ["foliage", "Foliage"]];
  P.defaultGen = function (type) {
    var g = { type: type || "line", on: true, thick: 12, height: 60, mode: "count", n: 12, len: 150, fit: true, scope: "whole", side: "centre", dist: 0, phase: 0, strands: 2, gap: 4, gapBelow: 0, seed: 1, angle: 50, jit: 0.3, leafW: 26, stem: true };
    if (g.type === "scroll") { g.height = 90; g.thick = 8; g.n = 14; }
    if (g.type === "interlace") { g.height = 70; g.thick = 14; g.n = 10; g.gap = 5; }
    if (g.type === "foliage") { g.height = 70; g.thick = 5; g.n = 14; g.leafW = 26; }
    return g;
  };
  P.normGen = function (o) {
    var g = Object.assign(P.defaultGen(o && o.type), o || {});
    if (!P.GENS.some(function (k) { return k[0] === g.type; })) g.type = "line";
    g.on = g.on !== false; g.thick = Math.max(0.5, num(g.thick, 12)); g.height = Math.max(0, num(g.height, 60));
    g.mode = g.mode === "length" ? "length" : "count"; g.n = Math.max(1, Math.round(num(g.n, 12))); g.len = Math.max(5, num(g.len, 150)); g.fit = g.fit !== false;
    g.scope = g.scope === "sides" ? "sides" : "whole";
    g.side = ["centre", "outside", "inside", "left", "right"].indexOf(g.side) >= 0 ? g.side : "centre"; g.dist = Math.max(0, num(g.dist, 0));
    g.phase = num(g.phase, 0); g.strands = clamp(Math.round(num(g.strands, 2)), 2, 8); g.gap = Math.max(0, num(g.gap, 4)); g.gapBelow = Math.max(0, num(g.gapBelow, 0));
    g.seed = Math.round(num(g.seed, 1)); g.angle = clamp(num(g.angle, 50), 0, 89); g.jit = clamp(num(g.jit, 0.3), 0, 1); g.leafW = Math.max(1, num(g.leafW, 26)); g.stem = g.stem !== false;
    return g;
  };
  P.normRecipe = function (o) {
    o = o && typeof o === "object" ? o : {};
    var st = (Array.isArray(o.stack) ? o.stack : []).map(P.normGen);
    return { path: String(o.path || ""), stack: st.length ? st : [P.defaultGen("line")] };
  };

  /* ---------- loops ---------- */
  function area(pts) { var s = 0; for (var i = 0; i < pts.length; i++) { var q = pts[(i + 1) % pts.length]; s += pts[i][0] * q[1] - q[0] * pts[i][1]; } return s / 2; }
  /* the points of an arc round (cx, cy) from angle a0 by sweep, flattened with the tolerance tol */
  function arcPts(cx, cy, r, a0, sweep, tol) {
    var step = 2 * Math.acos(Math.max(0, 1 - tol / Math.max(r, tol * 2))), cnt = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(step, 0.02))), out = [];
    for (var k = 0; k <= cnt; k++) { var a = a0 + sweep * k / cnt; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  /* Rounds the corners of a polyline: radii[i] is the radius at node i (ends of an open line stay sharp). */
  function roundCorners(pts, radii, closed) {
    var n = pts.length, tol = 0.05, out = [];
    function unit(a, b) { var x = b[0] - a[0], y = b[1] - a[1], L = Math.hypot(x, y) || 1; return [x / L, y / L, L]; }
    var tl = [], phi = [], len = [];
    for (var i = 0; i < n; i++) len[i] = Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]);
    for (i = 0; i < n; i++) {
      var has = closed || (i > 0 && i < n - 1), r = has ? (radii[i] || 0) : 0;
      if (!has || r <= 1e-9) { tl[i] = 0; phi[i] = 0; continue; }
      var a = unit(pts[(i - 1 + n) % n], pts[i]), b = unit(pts[i], pts[(i + 1) % n]);
      phi[i] = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
      tl[i] = Math.abs(phi[i]) > 1e-6 ? r * Math.tan(Math.abs(phi[i]) / 2) : 0;
    }
    for (var pass = 0; pass < 8; pass++) for (i = 0; i < (closed ? n : n - 1); i++) {
      var j = (i + 1) % n, sum = tl[i] + tl[j];
      if (sum > len[i] + 1e-9) { var f = len[i] / sum; tl[i] *= f; tl[j] *= f; }
    }
    for (i = 0; i < n; i++) {
      var p = pts[i];
      if (tl[i] <= 1e-9) { out.push([p[0], p[1]]); continue; }
      var u0 = unit(pts[(i - 1 + n) % n], p), u1 = unit(p, pts[(i + 1) % n]), t = tl[i], ph = phi[i];
      var P0 = [p[0] - u0[0] * t, p[1] - u0[1] * t], rr = t / Math.tan(Math.abs(ph) / 2), sgn = ph > 0 ? 1 : -1;
      var cx = P0[0] - u0[1] * sgn * rr, cy = P0[1] + u0[0] * sgn * rr;
      var a0 = Math.atan2(P0[1] - cy, P0[0] - cx);
      arcPts(cx, cy, rr, a0, ph, tol).forEach(function (q) { out.push(q); });
    }
    return out;
  }
  P.roundCorners = roundCorners;
  /* the loops of a path that need nothing from outside: [{ pts: [[x, y]], closed }] */
  function ownLoops(p) {
    if (p.kind === "circle") {
      var n = Math.max(24, Math.ceil(Math.PI / Math.acos(Math.max(0, 1 - 0.05 / p.r)))), pts = [];
      for (var i = 0; i < n; i++) { var a = 2 * Math.PI * i / n; pts.push([p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a)]); }
      return [{ pts: pts, closed: true }];
    }
    if (p.kind === "polygon") {
      var vs = [], rad = [];
      for (var k = 0; k < p.sides; k++) { var b = (p.rot - 90) * Math.PI / 180 + 2 * Math.PI * k / p.sides; vs.push([p.cx + p.r * Math.cos(b), p.cy + p.r * Math.sin(b)]); rad.push(p.cr); }
      return [{ pts: p.cr > 0 ? roundCorners(vs, rad, true) : vs, closed: true, corners: p.cr > 0 ? null : true }];
    }
    if (p.kind === "lines") {
      var vs2 = p.pts.map(function (q) { return [q.x, q.y]; }), rad2 = p.pts.map(function (q) { return q.r; });
      var any = rad2.some(function (r) { return r > 0; });
      return [{ pts: any ? roundCorners(vs2, rad2, p.closed) : vs2, closed: !!p.closed }];
    }
    return [];
  }
  /* Orients a closed loop clockwise on the screen (y points down): then "outward" is the left normal of the walking direction. */
  function normalise(l, reverse) {
    var pts = l.pts.slice();
    if (pts.length < 2) return null;
    if (l.closed && area(pts) < 0) pts.reverse();
    var flip = false;
    if (reverse) { pts.reverse(); flip = true; }
    return { pts: pts, closed: l.closed, flip: flip };
  }
  /* A sampled loop: cumulative lengths and the segments, for positions by arc length. */
  P.sample = function (l, start) {
    var pts = l.pts.slice(), n = pts.length;
    if (l.closed && start > 0 && n > 2) {   /* the start point: rotate the loop to the point at the fraction start of its length */
      var tot = 0, c0 = [0], i;
      for (i = 0; i < n; i++) { tot += Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]); c0.push(tot); }
      var target = start * tot, si = 0;
      while (si < n - 1 && c0[si + 1] <= target) si++;
      var seg0 = c0[si + 1] - c0[si] || 1, f0 = (target - c0[si]) / seg0, pa = pts[si], pb = pts[(si + 1) % n];
      var sp = [pa[0] + (pb[0] - pa[0]) * f0, pa[1] + (pb[1] - pa[1]) * f0], np = [sp];
      for (i = 1; i <= n; i++) np.push(l.pts[(si + i) % n]);
      pts = np.filter(function (q, idx, arr) { return idx === 0 || Math.hypot(q[0] - arr[idx - 1][0], q[1] - arr[idx - 1][1]) > 1e-9; });
      if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts.pop();
      n = pts.length;
    }
    var cum = [0], m = l.closed ? n : n - 1, L = 0, segs = [];
    for (var s = 0; s < m; s++) {
      var q0 = pts[s], q1 = pts[(s + 1) % n], len = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
      if (len < 1e-9) continue;
      segs.push({ a: q0, b: q1, s0: L, len: len, tx: (q1[0] - q0[0]) / len, ty: (q1[1] - q0[1]) / len });
      L += len;
    }
    return { pts: pts, segs: segs, L: L, closed: l.closed };
  };
  function segAt(sm, u) {
    var lo = 0, hi = sm.segs.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (sm.segs[mid].s0 <= u) lo = mid; else hi = mid - 1; }
    return sm.segs[lo];
  }
  /* position and walking direction at arc length u (segment index forced when a corner is met twice) */
  function frameAt(sm, u, seg) {
    seg = seg || segAt(sm, u);
    var t = clamp(u - seg.s0, 0, seg.len);
    return { x: seg.a[0] + seg.tx * t, y: seg.a[1] + seg.ty * t, tx: seg.tx, ty: seg.ty };
  }
  P.frameAt = frameAt;
  /* Cuts a loop into the runs between sharp corners (for the pattern setting "per side"). */
  function runsOf(sm, minTurn) {
    var segs = sm.segs, n = segs.length, cuts = [];
    for (var i = 0; i < n; i++) {
      var a = segs[(i - 1 + n) % n], b = segs[i];
      if (!sm.closed && i === 0) continue;
      var turn = Math.abs(Math.atan2(a.tx * b.ty - a.ty * b.tx, a.tx * b.tx + a.ty * b.ty)) * 180 / Math.PI;
      if (turn > minTurn) cuts.push(i);
    }
    if (!cuts.length) return [{ pts: null, whole: true }];
    var runs = [];
    for (var c = 0; c < cuts.length; c++) {
      var from = cuts[c], to = cuts[(c + 1) % cuts.length], pts = [segs[from].a], i2 = from;
      if (!sm.closed && c === cuts.length - 1) to = n;
      do { pts.push(segs[i2].b); i2 = (i2 + 1) % n; } while (i2 !== to && (sm.closed || i2 < to) && pts.length <= n + 1);
      runs.push({ pts: pts, closed: false });
    }
    if (!sm.closed) {   /* the first run: from the start of the line to the first corner; the last: from the last corner to the end */
      var firstPts = [segs[0].a], k = 0; while (k < cuts[0]) { firstPts.push(segs[k].b); k++; }
      runs.unshift({ pts: firstPts, closed: false });
    }
    return runs;
  }
  P.runsOf = runsOf;

  /* ---------- Clipper helpers (integers) ---------- */
  function toInt(pts) { return pts.map(function (q) { return { X: Math.round(q[0] * K), Y: Math.round(q[1] * K) }; }); }
  function fromInt(path) { return path.map(function (q) { return [q.X / K, q.Y / K]; }); }
  function strokePaths(pts, width, closed, round) {
    var C = clip(), co = new C.ClipperOffset(2, 0.02 * K), sol = [];
    if (pts.length < 2 || width <= 0) return [];
    co.AddPath(toInt(pts), C.JoinType.jtRound, closed ? C.EndType.etClosedLine : (round ? C.EndType.etOpenRound : C.EndType.etOpenButt));
    co.Execute(sol, width / 2 * K);
    return sol;
  }
  function unionPaths(list, evenOdd) {
    var C = clip(), c = new C.Clipper(), sol = [];
    c.AddPaths(list, C.PolyType.ptSubject, true);
    var ft = evenOdd ? C.PolyFillType.pftEvenOdd : C.PolyFillType.pftNonZero;
    c.Execute(C.ClipType.ctUnion, sol, ft, ft);
    return sol;
  }
  function diffPaths(subj, cut) {
    var C = clip(), c = new C.Clipper(), sol = [];
    c.AddPaths(subj, C.PolyType.ptSubject, true); c.AddPaths(cut, C.PolyType.ptClip, true);
    c.Execute(C.ClipType.ctDifference, sol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    return sol;
  }
  function offsetPaths(paths, delta) {
    var C = clip(), co = new C.ClipperOffset(2, 0.02 * K), sol = [];
    if (!paths.length) return [];
    co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
    co.Execute(sol, delta * K);
    return sol;
  }
  function orientationOf(path) { return clip().Clipper.Orientation(path); }
  P._clip = { strokePaths: strokePaths, unionPaths: unionPaths, diffPaths: diffPaths, offsetPaths: offsetPaths, toInt: toInt, fromInt: fromInt };

  /* ---------- the loops of any path ---------- */
  function hull(points) {
    var p = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), lo = [], up = [], i;
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    for (i = 0; i < p.length; i++) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  /* The outline of objects (REQ-048). env.sources(items) gives [{ rings: [[[x, y]]], halo }] in artwork coordinates. */
  function objectLoops(p, env) {
    var srcs = env.sources ? env.sources(p.items) : [], parts = [];
    srcs.forEach(function (s) {
      var rings = s.rings.filter(function (r) { return r.length > 2; }).map(toInt);
      if (!rings.length) return;
      var one = unionPaths(rings, true);   /* the counters of the letters are holes: even-odd */
      if (p.halo === "halo" && s.halo > 0) one = offsetPaths(one, s.halo);
      one.forEach(function (q) { parts.push(q); });
    });
    if (!parts.length) return [];
    var all = unionPaths(parts, false);
    if (p.shape === "hull" || p.shape === "box") {
      var pts = []; all.forEach(function (q) { fromInt(q).forEach(function (v) { pts.push(v); }); });
      if (pts.length < 3) return [];
      var base;
      if (p.shape === "hull") base = hull(pts);
      else {
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        pts.forEach(function (v) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); });
        var rr = Math.min(p.close, (x1 - x0) / 2, (y1 - y0) / 2);
        base = [[x0 + rr, y0 + rr], [x1 - rr, y0 + rr], [x1 - rr, y1 - rr], [x0 + rr, y1 - rr]];
        var shaped = offsetPaths([toInt(base)], rr + p.dist);
        return shaped.map(function (q) { return { pts: fromInt(q), closed: true }; });
      }
      var o = offsetPaths([toInt(base)], p.dist);
      return o.map(function (q) { return { pts: fromInt(q), closed: true }; });
    }
    var res = all;
    if (p.close > 0) res = offsetPaths(offsetPaths(res, p.close), -p.close);   /* closing: narrow notches and gaps fill up, the outline is smooth */
    if (Math.abs(p.dist) > 1e-9) res = offsetPaths(res, p.dist);
    var out = [];
    res.forEach(function (q) {
      var outer = orientationOf(q);
      if (outer || p.holes) out.push({ pts: fromInt(q), closed: true });
    });
    return out;
  }
  /* The loops of a path in artwork coordinates, with the direction and start applied. Returns { loops, err }. */
  P.loops = function (p, env) {
    env = env || {};
    var raw = [], err = "";
    if (p.kind === "table") {
      var tl = env.tableLoops ? env.tableLoops(p.table, p.which) : [];
      if (!tl.length) err = "The table line is not there.";
      raw = tl.map(function (l) {
        if (l.closed && Math.abs(p.dist) > 1e-9) {
          var o = offsetPaths([toInt(l.pts)], p.dist);
          return o.length ? { pts: fromInt(o[0]), closed: true } : l;
        }
        return l;
      });
    } else if (p.kind === "objects") {
      if (p.halo === "frozen" && p.frozen) raw = p.frozen.map(function (l) { return { pts: l.pts, closed: l.closed !== false }; });
      else { raw = objectLoops(p, env); if (!raw.length) err = p.items.length ? "Nothing to follow: the objects have no shape." : "No objects are chosen."; }
    } else raw = ownLoops(p);
    var loops = raw.map(function (l) { return normalise(l, p.reverse); }).filter(Boolean);
    return { loops: loops, err: err };
  };

  /* ---------- the generators ---------- */
  /* The run: a polyline to put the pattern on, as { sm, closed }. lengths and counts are decided here. */
  function planRun(sm, g) {
    var L = sm.L, n, lam;
    if (g.mode === "count") { n = g.n; lam = L / n; }
    else if (g.fit) { n = Math.max(1, Math.round(L / g.len)); lam = L / n; }
    else { lam = g.len; n = L / lam; }
    return { lam: lam, n: n, whole: g.mode === "count" || g.fit };
  }
  function sideSign(sm, g, flip) {
    /* the lateral direction is the left normal of the walking direction (for a closed loop this is outward before reversing) */
    var s = g.side === "outside" || g.side === "left" ? 1 : g.side === "inside" || g.side === "right" ? -1 : 0;
    /* a closed loop is walked clockwise on the screen, so the left is outside; the Reverse button turns it (inside and outside swap) */
    return s;
  }
  /* A centre line: v(u) is the offset across the path at arc length u. Returns an array of points. */
  function centre(sm, vfun, off, from, to, closedRun, step, flipN) {
    var us = [], u;
    var cnt = Math.max(2, Math.ceil((to - from) / step));
    for (var i = 0; i <= cnt; i++) us.push(from + (to - from) * i / cnt);
    /* the corners of the path are sample points too, with the direction before and after */
    var items = us.map(function (x) { return { u: x, seg: null }; });
    sm.segs.forEach(function (sg, si) {
      if (si === 0) return;
      if (sg.s0 > from + 1e-6 && sg.s0 < to - 1e-6) { items.push({ u: sg.s0, seg: sm.segs[si - 1] }); items.push({ u: sg.s0, seg: sg }); }
    });
    items.sort(function (a, b) { return a.u - b.u || 0; });
    var pts = [];
    items.forEach(function (it) {
      var f = frameAt(sm, Math.min(it.u, sm.L - 1e-9), it.seg), nx = f.ty, ny = -f.tx, v = off + vfun(it.u - from);
      pts.push([f.x + nx * v * flipN, f.y + ny * v * flipN]);
    });
    if (closedRun && pts.length > 1) pts.pop();
    return pts;
  }
  function stepFor(g, lam) { return Math.max(0.2, Math.min(lam / 36, Math.max(g.thick, 1) * 1.5, 3)); }
  /* the polygons (Clipper paths) of one generator on one loop */
  function genOnLoop(sm, g, flip) {
    var out = [], runs;
    if (g.scope === "sides") {
      runs = runsOf(sm, 25);
      runs = runs.map(function (r) { if (r.whole) return { sm: sm, closed: sm.closed }; var pts = r.pts; return { sm: P.sample({ pts: pts, closed: false }, 0), closed: false }; });
    } else runs = [{ sm: sm, closed: sm.closed }];
    runs.forEach(function (run) {
      var s = run.sm; if (s.L < 1e-6) return;
      var plan = planRun(s, g), lam = plan.lam, shift = g.phase * lam;
      var closedRun = run.closed && plan.whole;
      var to = plan.whole ? s.L : s.L;
      var off = (function () { var sg = sideSign(s, g, flip); return sg * g.dist; })();
      var flipN = 1;
      var step = stepFor(g, lam);
      if (g.type === "line") {
        out = out.concat(strokePaths(centre(s, function () { return 0; }, off, 0, to, closedRun, Math.max(1, step * 4), flipN), g.thick, closedRun));
      } else if (g.type === "sine") {
        var A = g.height / 2;
        out = out.concat(strokePaths(centre(s, function (u) { return A * Math.sin(2 * Math.PI * (u + shift) / lam); }, off, 0, to, closedRun, step, flipN), g.thick, closedRun));
      } else if (g.type === "scroll") {
        out = out.concat(scrollPaths(s, g, lam, shift, off, to, closedRun, flipN));
      } else if (g.type === "interlace") {
        out = out.concat(interlacePaths(s, g, lam, shift, off, to, closedRun, flipN));
      } else if (g.type === "foliage") {
        out = out.concat(foliagePaths(s, g, plan, off, to, closedRun, step));
      }
    });
    return out;
  }
  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* Foliage: leaves on alternate sides of the path, with a seed for the small random changes, and an optional stem along the path. */
  function foliagePaths(sm, g, plan, off, to, closedRun, step) {
    var out = [], rnd = rng(g.seed), n = Math.max(1, Math.round(plan.n)), lam = to / n, i, k;
    if (g.stem) out = out.concat(strokePaths(centre(sm, function () { return 0; }, off, 0, to, closedRun, Math.max(1, step * 4), 1), g.thick, closedRun));
    for (i = 0; i < n; i++) {
      var u = closedRun ? i * lam : (i + 0.5) * lam; if (u >= sm.L) continue;
      var side = i % 2 ? 1 : -1, f = frameAt(sm, Math.min(u, sm.L - 1e-9)), nx = f.ty, ny = -f.tx;
      var bx = f.x + nx * off, by = f.y + ny * off;
      var a = (g.angle + (rnd() - 0.5) * 2 * g.jit * 30) * Math.PI / 180, len = g.height * (1 + (rnd() - 0.5) * g.jit), w = g.leafW * len / Math.max(1, g.height);
      var dx = f.tx * Math.cos(a) + nx * side * Math.sin(a), dy = f.ty * Math.cos(a) + ny * side * Math.sin(a), px = -dy, py = dx, top = [], bot = [];
      for (k = 0; k <= 12; k++) { var t = k / 12, wd = w / 2 * Math.sin(Math.PI * t); top.push([bx + dx * len * t + px * wd, by + dy * len * t + py * wd]); bot.push([bx + dx * len * t - px * wd, by + dy * len * t - py * wd]); }
      out.push(toInt(top.concat(bot.reverse().slice(1, -1))));
    }
    return out;
  }
  /* Running dog: a prolate trochoid (a wave with loops), x = a t - b sin t, y = b cos t. */
  function scrollPaths(sm, g, lam, shift, off, to, closedRun, flipN) {
    var b = g.height / 2, a = lam / (2 * Math.PI), pts = [];
    var turns = to / lam, tmax = 2 * Math.PI * turns, tmin = 0;
    var per = Math.max(24, Math.ceil(Math.min(120, 2 * Math.PI * b / Math.max(0.5, g.thick * 0.6))));
    var cnt = Math.max(8, Math.ceil(turns * per));
    for (var i = 0; i <= cnt; i++) {
      var t = tmin + (tmax - tmin) * i / cnt, ts = t + 2 * Math.PI * shift / lam;
      var u = a * ts - b * Math.sin(ts), v = b * Math.cos(ts), uu = u - (a * (2 * Math.PI * shift / lam) - b * Math.sin(2 * Math.PI * shift / lam));
      pts.push([uu, v]);
    }
    var line = mapUV(sm, pts, off, flipN, closedRun, to);
    return strokePaths(line, g.thick, closedRun);
  }
  /* Takes points given as (u, v) to the plane along the loop. u outside [0, L] is wrapped on a closed loop, clamped on an open one. */
  function mapUV(sm, uv, off, flipN, closedRun, to) {
    var pts = [];
    uv.forEach(function (q) {
      var u = q[0];
      if (closedRun) { u = ((u % sm.L) + sm.L) % sm.L; } else u = clamp(u, 0, sm.L - 1e-9);
      var f = frameAt(sm, u), v = off + q[1];
      pts.push([f.x + f.ty * v * flipN, f.y - f.tx * v * flipN]);
    });
    if (closedRun && pts.length > 1) pts.pop();
    return pts;
  }
  /* Interlace: N strands sin(2 pi u / lam + 2 pi k / N); at every crossing one strand passes over, the over-under alternates along a strand. */
  function interlacePaths(sm, g, lam, shift, off, to, closedRun, flipN) {
    var N = g.strands, A = g.height / 2, M, polys = [], strandPts = [], vs = [], us = [];
    var step = Math.max(0.3, Math.min(lam / 60, g.thick * 0.7, 2));
    M = Math.max(16, Math.ceil(to / step));
    var cntU = closedRun ? M : M + 1;
    for (var m = 0; m < cntU; m++) us.push(to * m / M);
    function vOf(k, u) { return A * Math.sin(2 * Math.PI * (u + shift) / lam + 2 * Math.PI * k / N); }
    for (var k = 0; k < N; k++) {
      vs.push(us.map(function (u) { return vOf(k, u); }));
      var pts = us.map(function (u, i) { var f = frameAt(sm, Math.min(u, sm.L - 1e-9)), v = off + vs[k][i]; return [f.x + f.ty * v * flipN, f.y - f.tx * v * flipN]; });
      strandPts.push(pts);
      polys.push(strokePaths(pts, g.thick, closedRun));
    }
    /* crossings of the strands */
    var cross = [], total = us.length;
    for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) {
      for (var c = 0; c < (closedRun ? total : total - 1); c++) {
        var c2 = (c + 1) % total, d0 = vs[i][c] - vs[j][c], d1 = vs[i][c2] - vs[j][c2];
        if ((d0 < 0 && d1 >= 0) || (d0 > 0 && d1 <= 0)) {
          var f = d0 / (d0 - d1), u0 = us[c], u1 = c2 === 0 ? to : us[c2];
          cross.push({ i: i, j: j, u: u0 + (u1 - u0) * f, up: vs[i][c2] > vs[i][c] });
        }
      }
    }
    cross.sort(function (a, b) { return a.u - b.u; });
    var state = [], cuts = [];
    for (var s2 = 0; s2 < N; s2++) { state.push(null); cuts.push([]); }
    cross.forEach(function (x) {
      var a = x.i, b = x.j, over;
      if (state[a] === "under" && state[b] !== "under") over = a;
      else if (state[b] === "under" && state[a] !== "under") over = b;
      else if (state[a] === "over" && state[b] !== "over") over = b;
      else if (state[b] === "over") over = a;
      else over = x.up ? a : b;
      var under = over === a ? b : a;
      state[over] = "over"; state[under] = "under";
      /* the part of the over strand near the crossing, widened by the gap, is cut out of the under strand */
      var vv = function (u) { return vOf(over, u); };
      var slope = Math.abs(2 * Math.PI * A / lam * (Math.cos(2 * Math.PI * (x.u + shift) / lam + 2 * Math.PI * a / N) - Math.cos(2 * Math.PI * (x.u + shift) / lam + 2 * Math.PI * b / N))) / 1;
      var sinT = clamp(slope / Math.sqrt(1 + slope * slope), 0.25, 1);
      var w = (g.thick / 2 + g.gap) / sinT + g.thick * 0.6, win = [], steps = 12;
      for (var q = 0; q <= steps; q++) {
        var u = x.u - w + 2 * w * q / steps, uw = u;
        if (closedRun) uw = ((u % to) + to) % to; else if (u < 0 || u > to) continue;
        var f2 = frameAt(sm, Math.min(uw, sm.L - 1e-9)), v2 = off + vv(uw);
        win.push([f2.x + f2.ty * v2 * flipN, f2.y - f2.tx * v2 * flipN]);
      }
      if (win.length > 1) strokePaths(win, g.thick + 2 * g.gap, false).forEach(function (pp) { cuts[under].push(pp); });
    });
    var pieces = [];
    for (var s3 = 0; s3 < N; s3++) pieces = pieces.concat(cuts[s3].length ? diffPaths(polys[s3], cuts[s3]) : polys[s3]);
    return pieces;
  }

  P.genOnLoop = genOnLoop;
  /* The flat shape of a pattern: the union of its stack; a layer with gapBelow cuts a gap into the layers below it.
   * Returns { paths, shape } with shape = { d, x0, y0, x1, y1 } in artwork coordinates, or null when it is empty. */
  P.build = function (recipe, env) {
    var path = env.path;
    if (!path) return { shape: null, err: "The path is missing." };
    var res = P.loops(path, env);
    if (res.err && !res.loops.length) return { shape: null, err: res.err };
    var acc = [];
    recipe.stack.forEach(function (g) {
      if (!g.on) return;
      var mine = [];
      res.loops.forEach(function (l) {
        var sm = P.sample(l, l.closed ? path.start : 0);
        if (sm.L < 1) return;
        mine = mine.concat(genOnLoop(sm, g, l.flip));
      });
      if (!mine.length) return;
      mine = unionPaths(mine, false);
      if (g.gapBelow > 0 && acc.length) acc = diffPaths(acc, offsetPaths(mine, g.gapBelow));
      acc = acc.length ? unionPaths(acc.concat(mine), false) : mine;
    });
    if (!acc.length) return { shape: null, err: res.err || "The pattern is empty." };
    return { shape: shapeOf(acc), err: res.err };
  };
  function shapeOf(paths) {
    var d = "", x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    paths.forEach(function (p) {
      if (p.length < 3) return;
      p.forEach(function (q, i) {
        var x = Math.round(q.X / 10) / 100, y = Math.round(q.Y / 10) / 100;
        d += (i ? "L" : "M") + x + " " + y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      });
      d += "Z";
    });
    return d ? { d: d, x0: x0, y0: y0, x1: x1, y1: y1 } : null;
  }
  P.shapeOf = shapeOf;

  /* ---------- dependencies (REQ-048) ---------- */
  /* deps: { pathOfLayer(uid) -> path id or "", layersOfPath(path id) -> [layer uid] (groups expanded), isPattern(uid) }.
   * True when the path depends on the layer, directly or through other patterns and paths. */
  P.dependsOn = function (pathId, layerUid, deps, seen) {
    seen = seen || {};
    if (seen[pathId]) return false; seen[pathId] = 1;
    var us = deps.layersOfPath(pathId);
    for (var i = 0; i < us.length; i++) {
      if (us[i] === layerUid) return true;
      if (deps.isPattern(us[i])) { var pp = deps.pathOfLayer(us[i]); if (pp && P.dependsOn(pp, layerUid, deps, seen)) return true; }
    }
    return false;
  };
  P.round2 = r2;
  PTD.paths = P;
  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
