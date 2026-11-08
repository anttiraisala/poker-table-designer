/* Glyphs (REQ-033, REQ-034): single-colour vector pictures. No DOM; tested in Node (tests/glyph.test.js).
 *
 * A glyph is stored like a frozen text: `shape = { d, x0, y0, x1, y1 }`, where d is an SVG path (M L C Z, absolute) in "glyph units",
 * centred on (0, 0) and exactly GLYPH_H units high (so x0 = -w/2, y0 = -H/2, ...). The layer's `size` is the height in millimetres, so
 * one glyph unit is size / GLYPH_H mm. Every sub-path is oriented so that the non-zero rule gives the same picture as the even-odd rule
 * (outer outlines one way, holes the other way): islands and holes work and nothing depends on the fill rule.
 *
 * A contour is { s: [x, y], segs: [["L", x, y] | ["C", x1, y1, x2, y2, x, y]], closed: true|false }.
 * An item is { kind: "fill", contours, rule } or { kind: "stroke", contours, width, join, cap, miter }; strokes are turned into filled
 * shapes (with Clipper's offset), so everything ends up as filled shapes like letters. Several items are merged (union) with Clipper;
 * a single plain fill keeps its curves. */
(function (PTD) {
  "use strict";
  var Gl = {};
  var H = 1000;   /* glyph units in the height of every glyph */
  Gl.H = H;
  var CL = null;  /* ClipperLib, set by Gl.useClipper or found as a global / module */
  Gl.useClipper = function (c) { CL = c; };
  function clip() {
    if (CL) return CL;
    if (typeof window !== "undefined" && window.ClipperLib) return window.ClipperLib;
    if (typeof require === "function") { try { return require("./clipper.js"); } catch (e) { /* none */ } }
    throw new Error("The polygon library (Clipper) is not available.");
  }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function num3(v) { var s = (Math.round(v * 1000) / 1000).toString(); return s === "-0" ? "0" : s; }

  /* ---------- geometry of contours ---------- */
  Gl.nodes = function (c) { var p = [c.s]; c.segs.forEach(function (g) { p.push([g[g.length - 2], g[g.length - 1]]); }); return p; };
  function flatSeg(p0, g, tol, out) {
    if (g[0] === "L") { out.push([g[1], g[2]]); return; }
    var x0 = p0[0], y0 = p0[1], x1 = g[1], y1 = g[2], x2 = g[3], y2 = g[4], x3 = g[5], y3 = g[6];
    (function rec(ax, ay, bx, by, cx, cy, dx, dy, depth) {
      var ux = dx - ax, uy = dy - ay, L = Math.hypot(ux, uy);
      var d1 = L < 1e-12 ? Math.hypot(bx - ax, by - ay) : Math.abs((bx - ax) * uy - (by - ay) * ux) / L;
      var d2 = L < 1e-12 ? Math.hypot(cx - ax, cy - ay) : Math.abs((cx - ax) * uy - (cy - ay) * ux) / L;
      if (depth > 14 || Math.max(d1, d2) <= tol) { out.push([dx, dy]); return; }
      var abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cdx = (cx + dx) / 2, cdy = (cy + dy) / 2;
      var abcx = (abx + bcx) / 2, abcy = (aby + bcy) / 2, bcdx = (bcx + cdx) / 2, bcdy = (bcy + cdy) / 2, mx = (abcx + bcdx) / 2, my = (abcy + bcdy) / 2;
      rec(ax, ay, abx, aby, abcx, abcy, mx, my, depth + 1);
      rec(mx, my, bcdx, bcdy, cdx, cdy, dx, dy, depth + 1);
    })(x0, y0, x1, y1, x2, y2, x3, y3, 0);
  }
  /* The corner points of a contour with the curves cut into short straight pieces (tol = the largest error, in the unit of the contour). */
  Gl.flatten = function (c, tol) {
    var out = [[c.s[0], c.s[1]]], p = c.s;
    c.segs.forEach(function (g) { flatSeg(p, g, tol, out); p = [g[g.length - 2], g[g.length - 1]]; });
    if (c.closed && out.length > 1) { var f = out[0], l = out[out.length - 1]; if (Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) out.pop(); }
    return out;
  };
  function area(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function inside(pt, pts) {
    var c = false, x = pt[0], y = pt[1];
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if ((pts[i][1] > y) !== (pts[j][1] > y) && x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c;
    }
    return c;
  }
  function reverse(c) {
    var n = Gl.nodes(c), segs = [];
    for (var i = c.segs.length - 1; i >= 0; i--) {
      var g = c.segs[i], to = n[i];
      segs.push(g[0] === "L" ? ["L", to[0], to[1]] : ["C", g[3], g[4], g[1], g[2], to[0], to[1]]);
    }
    var last = n[n.length - 1];
    return { s: [last[0], last[1]], segs: segs, closed: c.closed };
  }
  function mapPts(c, f) {
    function m(x, y) { var q = f(x, y); return q; }
    var s = m(c.s[0], c.s[1]);
    return { s: s, closed: c.closed, segs: c.segs.map(function (g) {
      if (g[0] === "L") { var a = m(g[1], g[2]); return ["L", a[0], a[1]]; }
      var a1 = m(g[1], g[2]), a2 = m(g[3], g[4]), a3 = m(g[5], g[6]); return ["C", a1[0], a1[1], a2[0], a2[1], a3[0], a3[1]];
    }) };
  }
  Gl.mapContour = mapPts;
  /* Outer outlines positive, holes negative (by how many other outlines contain a contour: even = outer, odd = hole). */
  Gl.orient = function (contours) {
    var polys = contours.map(function (c) { return Gl.flatten(c, 0.05); });
    return contours.map(function (c, i) {
      var depth = 0;
      for (var j = 0; j < contours.length; j++) if (j !== i && polys[j].length > 2 && inside(polys[i][0], polys[j])) depth++;
      var a = area(polys[i]), wantPos = depth % 2 === 0;
      return (a > 0) === wantPos ? c : reverse(c);
    });
  };
  function bbox(contours, tol) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    contours.forEach(function (c) { Gl.flatten(c, tol).forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function pathD(contours) {
    return contours.map(function (c) {
      var d = "M" + num3(c.s[0]) + " " + num3(c.s[1]);
      c.segs.forEach(function (g) {
        d += g[0] === "L" ? "L" + num3(g[1]) + " " + num3(g[2]) : "C" + num3(g[1]) + " " + num3(g[2]) + " " + num3(g[3]) + " " + num3(g[4]) + " " + num3(g[5]) + " " + num3(g[6]);
      });
      return d + "Z";
    }).join("");
  }
  /* Contours (closed, not crossing themselves) to a glyph shape: orient, centre, scale to H units high. Throws when there is no area. */
  Gl.shapeOf = function (contours) {
    contours = contours.filter(function (c) { return c.segs.length >= 2; }).map(function (c) { return Object.assign({}, c, { closed: true }); });
    if (!contours.length) throw new Error("There is nothing to fill in the picture.");
    var b = bbox(contours, 0.01), w = b.x1 - b.x0, h = b.y1 - b.y0;
    if (!(w > 1e-9) || !(h > 1e-9)) throw new Error("The picture has no width or no height.");
    var k = H / h, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    var moved = Gl.orient(contours.map(function (c) { return mapPts(c, function (x, y) { return [(x - cx) * k, (y - cy) * k]; }); }));
    var hw = w * k / 2;
    return { d: pathD(moved), x0: r3(-hw), y0: -H / 2, x1: r3(hw), y1: H / 2 };
  };

  /* ---------- the contours of the shapes (units are free) ---------- */
  var KAPPA = 0.5522847498;
  Gl.circle = function (cx, cy, r) { return Gl.ellipse(cx, cy, r, r); };
  Gl.ellipse = function (cx, cy, rx, ry) {
    var kx = rx * KAPPA, ky = ry * KAPPA;
    return { s: [cx + rx, cy], closed: true, segs: [
      ["C", cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry], ["C", cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
      ["C", cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry], ["C", cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy]] };
  };
  Gl.polygon = function (pts, closed) {
    return { s: [pts[0][0], pts[0][1]], closed: closed !== false, segs: pts.slice(1).map(function (p) { return ["L", p[0], p[1]]; }).concat(closed !== false ? [["L", pts[0][0], pts[0][1]]] : []) };
  };
  function fill(contours, rule) { return { kind: "fill", contours: contours, rule: rule || "nonzero" }; }
  function ring(cx, cy, r0, r1) { return [Gl.circle(cx, cy, r1), Gl.circle(cx, cy, r0)]; }
  function sector(cx, cy, r0, r1, a0, a1) {
    var pts = [], n = 8, i;
    for (i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]); }
    for (i = n; i >= 0; i--) { var b = a0 + (a1 - a0) * i / n; pts.push([cx + r0 * Math.cos(b), cy + r0 * Math.sin(b)]); }
    return Gl.polygon(pts, true);
  }
  function heartContour(cx, cy, s, flip) {
    /* two lobes and a point: about 1 unit wide and 1.1 high (y grows downwards on the screen); flip = upside down (for the spade) */
    var f = flip ? -1 : 1;
    function P(x, y) { return [cx + x * s, cy + f * y * s]; }
    var tip = P(0, 0.9), notch = P(0, 0.2);
    var segs = [
      ["C"].concat(P(-0.18, 0.7), P(-0.5, 0.52), P(-0.5, 0.24)),
      ["C"].concat(P(-0.5, -0.12), P(-0.38, -0.2), P(-0.25, -0.2)),
      ["C"].concat(P(-0.12, -0.2), P(-0.03, -0.08), notch),
      ["C"].concat(P(0.03, -0.08), P(0.12, -0.2), P(0.25, -0.2)),
      ["C"].concat(P(0.38, -0.2), P(0.5, -0.12), P(0.5, 0.24)),
      ["C"].concat(P(0.5, 0.52), P(0.18, 0.7), tip)
    ];
    return { s: tip, closed: true, segs: segs };
  }
  var SHAPES = {
    circle: { name: "Circle", items: function () { return [fill([Gl.circle(0, 0, 500)])]; } },
    diamond: { name: "Diamond", items: function () { return [fill([Gl.polygon([[0, -500], [330, 0], [0, 500], [-330, 0]])])]; } },
    heart: { name: "Heart", items: function () { return [fill([heartContour(0, 0, 1000, false)])]; } },
    spade: { name: "Spade", items: function () {
      return [fill([heartContour(0, 0, 1000, true)]), fill([Gl.polygon([[-60, -300], [60, -300], [190, 520], [-190, 520]])])]; } },
    club: { name: "Club", items: function () {
      return [fill([Gl.circle(0, -230, 215)]), fill([Gl.circle(-235, 110, 215)]), fill([Gl.circle(235, 110, 215)]),
        fill([Gl.polygon([[-70, 60], [70, 60], [190, 520], [-190, 520]])])]; } },
    star: { name: "Star", items: function () {
      var pts = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 200 : 500; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
      return [fill([Gl.polygon(pts)])]; } },
    chip: { name: "Chip (from above)", items: function () {
      var cs = [], i;
      for (i = 0; i < 8; i++) { var a0 = i * Math.PI / 4 + 0.18, a1 = (i + 1) * Math.PI / 4 - 0.18; cs.push(sector(0, 0, 400, 500, a0, a1)); }
      return [fill(cs), fill(ring(0, 0, 320, 360)), fill(ring(0, 0, 170, 230)), fill([Gl.circle(0, 0, 90)])]; } },
    scribble: { name: "Scribble (random blob)", items: function (seed) {
      var s = (seed == null ? Math.floor(Math.random() * 1e9) : seed) >>> 0;
      function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
      var lobes = 3 + Math.floor(rnd() * 4), ph = [], amp = [], k;
      for (k = 1; k <= lobes; k++) { ph.push(rnd() * 6.283); amp.push((0.5 + rnd()) * 0.5 / k); }
      var N = 12, nodes = [], i;
      for (i = 0; i < N; i++) {
        var th = i * 2 * Math.PI / N, r = 1;
        for (k = 0; k < lobes; k++) r += amp[k] * Math.sin((k + 2) * th + ph[k]) * 0.55;
        r = Math.max(0.35, r);
        nodes.push([r * 450 * Math.cos(th), r * 450 * Math.sin(th)]);
      }
      /* a closed smooth curve through the nodes (Catmull-Rom as cubic Beziers); a star-shaped blob never crosses itself */
      var segs = [];
      for (i = 0; i < N; i++) {
        var p0 = nodes[(i + N - 1) % N], p1 = nodes[i], p2 = nodes[(i + 1) % N], p3 = nodes[(i + 2) % N];
        segs.push(["C", p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]]);
      }
      return [fill([{ s: [nodes[0][0], nodes[0][1]], closed: true, segs: segs }])]; } }
  };
  Gl.shapeList = Object.keys(SHAPES).map(function (k) { return { id: k, name: SHAPES[k].name }; });

  /* ---------- items to one glyph shape ---------- */
  function toClipPaths(contours, tol, k) {
    return contours.map(function (c) { return Gl.flatten(c, tol).map(function (p) { return { X: Math.round(p[0] * k), Y: Math.round(p[1] * k) }; }); }).filter(function (p) { return p.length > 2; });
  }
  function fromClip(paths, k) {
    return paths.filter(function (p) { return p.length > 2; }).map(function (p) { return Gl.polygon(p.map(function (q) { return [q.X / k, q.Y / k]; }), true); });
  }
  /* A stroke as filled polygons: the contour offset by half the width (with the line join and end), in clipper integer units. */
  function strokePaths(it, k) {
    var C = clip(), co = new C.ClipperOffset(it.miter > 0 ? it.miter : 2, 0.25 * k / 10), sol = [], any = false;
    var jt = it.join === "round" ? C.JoinType.jtRound : it.join === "bevel" ? C.JoinType.jtSquare : C.JoinType.jtMiter;
    it.contours.forEach(function (c) {
      var pts = Gl.flatten(c, 0.05).map(function (q) { return { X: Math.round(q[0] * k), Y: Math.round(q[1] * k) }; }); if (pts.length < 2) return;
      var et = c.closed ? C.EndType.etClosedLine : it.cap === "round" ? C.EndType.etOpenRound : it.cap === "square" ? C.EndType.etOpenSquare : C.EndType.etOpenButt;
      co.AddPath(pts, jt, et); any = true;
    });
    if (!any) return [];
    co.Execute(sol, it.width / 2 * k);
    return sol;
  }
  /* items -> { shape, notes }.  `opts.keepCurves` is on by default: a single fill item is not flattened. */
  Gl.fromItems = function (items, opts) {
    var notes = [];
    items = items.filter(function (it) { return it.contours && it.contours.length; });
    if (!items.length) throw new Error("No filled shapes were found in the picture.");
    /* coarse scale so that the integer arithmetic of Clipper is exact enough (the final scale is exact afterwards) */
    var all = [], half = 0;
    items.forEach(function (it) { all = all.concat(it.contours); if (it.kind === "stroke") half = Math.max(half, it.width / 2); });
    var b0 = bbox(all, 1e9), hh = (b0.y1 - b0.y0) + 2 * half, ww = (b0.x1 - b0.x0) + 2 * half;
    var size = Math.max(hh, ww);
    if (!(size > 1e-9)) throw new Error("The picture has no size.");
    var s = H / size, cx = (b0.x0 + b0.x1) / 2, cy = (b0.y0 + b0.y1) / 2;
    function sc(c) { return mapPts(c, function (x, y) { return [(x - cx) * s, (y - cy) * s]; }); }
    items = items.map(function (it) { return Object.assign({}, it, { contours: it.contours.map(sc), width: (it.width || 0) * s }); });
    var out;
    if (items.length === 1 && items[0].kind === "fill" && (!opts || opts.merge !== true)) {
      out = items[0].contours;
    } else {
      var C = clip(), K = 1000, tol = 0.1, acc = new C.Clipper(), any = false;
      items.forEach(function (it) {
        var paths;
        if (it.kind === "stroke") paths = strokePaths(it, K);
        else {
          var cl = new C.Clipper(), pp = toClipPaths(it.contours, tol, K); paths = [];
          if (!pp.length) return;
          cl.AddPaths(pp, C.PolyType.ptSubject, true);
          cl.Execute(C.ClipType.ctUnion, paths, it.rule === "evenodd" ? C.PolyFillType.pftEvenOdd : C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
        }
        if (paths.length) { acc.AddPaths(paths, C.PolyType.ptSubject, true); any = true; }
      });
      if (!any) throw new Error("No filled shapes were found in the picture.");
      var res = [];
      acc.Execute(C.ClipType.ctUnion, res, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
      out = fromClip(res, K);
    }
    return { shape: Gl.shapeOf(out), notes: notes };
  };

  /* ---------- SVG text in ---------- */
  function parseTransform(str) {
    var m = [1, 0, 0, 1, 0, 0], re = /([a-zA-Z]+)\s*\(([^)]*)\)/g, t;
    function mul(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
    while ((t = re.exec(str || ""))) {
      var v = (t[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(parseFloat), n = t[1], k = null;
      if (n === "matrix" && v.length >= 6) k = v.slice(0, 6);
      else if (n === "translate") k = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
      else if (n === "scale") k = [v[0] == null ? 1 : v[0], 0, 0, v.length > 1 ? v[1] : (v[0] == null ? 1 : v[0]), 0, 0];
      else if (n === "rotate") { var a = (v[0] || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); k = [c, sn, -sn, c, 0, 0]; if (v.length >= 3) k = mul(mul([1, 0, 0, 1, v[1], v[2]], k), [1, 0, 0, 1, -v[1], -v[2]]); }
      else if (n === "skewX") k = [1, 0, Math.tan((v[0] || 0) * Math.PI / 180), 1, 0, 0];
      else if (n === "skewY") k = [1, Math.tan((v[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      if (k) m = mul(m, k);
    }
    return m;
  }
  Gl.parseTransform = parseTransform;
  function mulM(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  function applyM(c, m) { return mapPts(c, function (x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }); }
  /* An SVG arc (endpoint form) as cubic Beziers. */
  function arcSegs(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
    if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [["L", x2, y2]];
    rx = Math.abs(rx); ry = Math.abs(ry);
    var p = phi * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p);
    var dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    var lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
    if (lam > 1) { var q = Math.sqrt(lam); rx *= q; ry *= q; }
    var num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    var co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    var cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
    var cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    function ang(ux, uy, vx, vy) { var a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; }
    var th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dth > 0) dth -= 2 * Math.PI; else if (fs && dth < 0) dth += 2 * Math.PI;
    var n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2 + 1e-9))), segs = [], d = dth / n, t = 4 / 3 * Math.tan(d / 4);
    function pt(a, ox, oy, sgn) { return [cx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp, cy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp]; }
    void pt;
    function E(a) { return [cx + cp * rx * Math.cos(a) - sp * ry * Math.sin(a), cy + sp * rx * Math.cos(a) + cp * ry * Math.sin(a)]; }
    function D(a) { return [-cp * rx * Math.sin(a) - sp * ry * Math.cos(a), -sp * rx * Math.sin(a) + cp * ry * Math.cos(a)]; }
    for (var i = 0; i < n; i++) {
      var a0 = th1 + i * d, a1 = a0 + d, e0 = E(a0), e1 = E(a1), d0 = D(a0), d1 = D(a1);
      segs.push(["C", e0[0] + t * d0[0], e0[1] + t * d0[1], e1[0] - t * d1[0], e1[1] - t * d1[1], i === n - 1 ? x2 : e1[0], i === n - 1 ? y2 : e1[1]]);
    }
    return segs;
  }
  /* The contours of an SVG path string (in the units of the path). */
  Gl.parsePathData = function (d) {
    var s = String(d || ""), i = 0, n = s.length, out = [], cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = "", lc = null, lq = null, first = true;
    function ws() { while (i < n && /[\s,]/.test(s[i])) i++; }
    function number() {
      ws(); var m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(s.slice(i, i + 40)); if (!m) throw new Error("A path in the SVG is malformed.");
      i += m[0].length; return parseFloat(m[0]);
    }
    function flag() { ws(); var ch = s[i]; if (ch !== "0" && ch !== "1") throw new Error("A path in the SVG is malformed."); i++; return ch === "1"; }
    function start(px, py) { cur = { s: [px, py], segs: [], closed: false }; out.push(cur); }
    function more() { ws(); return i < n && !/[A-Za-z]/.test(s[i]); }
    while (true) {
      ws(); if (i >= n) break;
      if (/[A-Za-z]/.test(s[i])) cmd = s[i++]; else if (!cmd) throw new Error("A path in the SVG is malformed.");
      var up = cmd.toUpperCase(), rel = cmd !== up, px = rel ? x : 0, py = rel ? y : 0;
      if (first && up !== "M") throw new Error("A path in the SVG does not start with a move.");
      first = false;
      if (up === "M") {
        x = px + number(); y = py + number(); sx = x; sy = y; start(x, y); lc = lq = null; cmd = rel ? "l" : "L";
        continue;
      }
      if (up === "Z") { if (cur) { cur.closed = true; } x = sx; y = sy; cur = null; lc = lq = null; cmd = ""; continue; }
      if (!cur) start(x, y);
      if (up === "L") { x = px + number(); y = py + number(); cur.segs.push(["L", x, y]); lc = lq = null; }
      else if (up === "H") { x = (rel ? x : 0) + number(); cur.segs.push(["L", x, y]); lc = lq = null; }
      else if (up === "V") { y = (rel ? y : 0) + number(); cur.segs.push(["L", x, y]); lc = lq = null; }
      else if (up === "C") { var a = px + number(), b = py + number(), c = px + number(), dd = py + number(), e = px + number(), f = py + number(); cur.segs.push(["C", a, b, c, dd, e, f]); lc = [c, dd]; lq = null; x = e; y = f; }
      else if (up === "S") {
        var r1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y], c2 = px + number(), d2 = py + number(), e2 = px + number(), f2 = py + number();
        cur.segs.push(["C", r1[0], r1[1], c2, d2, e2, f2]); lc = [c2, d2]; lq = null; x = e2; y = f2;
      }
      else if (up === "Q" || up === "T") {
        var qc;
        if (up === "Q") { qc = [px + number(), py + number()]; } else qc = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
        var ex = px + number(), ey = py + number();
        cur.segs.push(["C", x + 2 / 3 * (qc[0] - x), y + 2 / 3 * (qc[1] - y), ex + 2 / 3 * (qc[0] - ex), ey + 2 / 3 * (qc[1] - ey), ex, ey]);
        lq = qc; lc = null; x = ex; y = ey;
      }
      else if (up === "A") {
        var rx = number(), ry = number(), ph = number(), fa = flag(), fs = flag(), ax = px + number(), ay = py + number();
        arcSegs(x, y, rx, ry, ph, fa, fs, ax, ay).forEach(function (g) { cur.segs.push(g); });
        x = ax; y = ay; lc = lq = null;
      }
      else throw new Error("A path in the SVG uses the command “" + cmd + "”, which is not understood.");
      if (!more()) { /* next command letter or the end */ }
    }
    return out.filter(function (c) { return c.segs.length > 0; });
  };

  function parseColour(v) {
    v = String(v || "").trim().toLowerCase();
    if (!v) return "";
    if (v === "none" || v === "transparent") return "none";
    if (v === "white" || v === "#fff" || v === "#ffffff" || /^rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)$/.test(v)) return "white";
    return v;
  }
  var SKIP = { defs: 1, clippath: 1, mask: 1, symbol: 1, style: 1, script: 1, metadata: 1, title: 1, desc: 1, text: 1, image: 1, foreignobject: 1, filter: 1, pattern: 1, marker: 1, lineargradient: 1, radialgradient: 1, "sodipodi:namedview": 1, switch: 0 };
  function attrsOf(s) {
    var o = {}, re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, m;
    while ((m = re.exec(s))) o[m[1]] = m[2] != null ? m[2] : m[3];
    if (o.style) o.style.split(";").forEach(function (kv) { var p = kv.indexOf(":"); if (p > 0) o[kv.slice(0, p).trim()] = kv.slice(p + 1).trim(); });
    return o;
  }
  /* SVG text -> { items, notes }. Only shapes are read; see the header of this file. */
  Gl.parseSVG = function (text) {
    var src = String(text || "");
    if (!/<svg[\s>]/i.test(src)) throw new Error("This is not an SVG picture (no <svg> element).");
    src = src.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "");
    var re = /<(\/?)([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g, m;
    var stack = [{ tag: "#root", st: { fill: "black", stroke: "none", sw: 1, rule: "nonzero", join: "miter", cap: "butt", miter: 4 }, m: [1, 0, 0, 1, 0, 0], skip: false }];
    var items = [], notes = {}, white = 0;
    function note(s) { notes[s] = 1; }
    while ((m = re.exec(src))) {
      var closing = m[1] === "/", tag = m[2].toLowerCase(), selfc = m[4] === "/" || /\/\s*$/.test(m[3]);
      if (closing) { if (stack.length > 1) stack.pop(); continue; }
      var parent = stack[stack.length - 1], a = attrsOf(m[3]);
      var st = Object.assign({}, parent.st);
      if (a.fill != null) st.fill = parseColour(a.fill) || st.fill;
      if (a.stroke != null) st.stroke = parseColour(a.stroke) || st.stroke;
      if (a["stroke-width"] != null && isFinite(parseFloat(a["stroke-width"]))) st.sw = parseFloat(a["stroke-width"]);
      if (a["fill-rule"]) st.rule = a["fill-rule"] === "evenodd" ? "evenodd" : "nonzero";
      if (a["stroke-linejoin"]) st.join = a["stroke-linejoin"];
      if (a["stroke-linecap"]) st.cap = a["stroke-linecap"];
      if (a["stroke-miterlimit"] != null && isFinite(parseFloat(a["stroke-miterlimit"]))) st.miter = parseFloat(a["stroke-miterlimit"]);
      if (a["fill-opacity"] != null && parseFloat(a["fill-opacity"]) === 0) st.fill = "none";
      if (a["stroke-opacity"] != null && parseFloat(a["stroke-opacity"]) === 0) st.stroke = "none";
      var hidden = a.display === "none" || a.visibility === "hidden" || (a.opacity != null && parseFloat(a.opacity) === 0);
      var skip = parent.skip || hidden || SKIP[tag] === 1;
      var mat = a.transform ? mulM(parent.m, parseTransform(a.transform)) : parent.m;
      if (tag === "use" || tag === "image" || tag === "text") note("“" + tag + "” elements are ignored");
      if (/^url\(/i.test(st.fill)) { note("gradient or pattern fills were drawn as plain fills"); }
      var contours = null;
      if (!skip) {
        var num = function (k, d) { var v = parseFloat(a[k]); return isFinite(v) ? v : (d || 0); };
        if (tag === "path") contours = Gl.parsePathData(a.d);
        else if (tag === "rect") {
          var rx = num("x"), ry = num("y"), w = num("width"), h = num("height"), r1 = a.rx != null ? num("rx") : (a.ry != null ? num("ry") : 0), r2 = a.ry != null ? num("ry") : r1;
          if (w > 0 && h > 0) {
            if (r1 > 0 || r2 > 0) {
              r1 = Math.min(r1, w / 2); r2 = Math.min(r2, h / 2);
              contours = Gl.parsePathData("M" + (rx + r1) + " " + ry + "H" + (rx + w - r1) + "A" + r1 + " " + r2 + " 0 0 1 " + (rx + w) + " " + (ry + r2) + "V" + (ry + h - r2) + "A" + r1 + " " + r2 + " 0 0 1 " + (rx + w - r1) + " " + (ry + h) + "H" + (rx + r1) + "A" + r1 + " " + r2 + " 0 0 1 " + rx + " " + (ry + h - r2) + "V" + (ry + r2) + "A" + r1 + " " + r2 + " 0 0 1 " + (rx + r1) + " " + ry + "Z");
            } else contours = [Gl.polygon([[rx, ry], [rx + w, ry], [rx + w, ry + h], [rx, ry + h]])];
          }
        }
        else if (tag === "circle") { var cr = num("r"); if (cr > 0) contours = [Gl.circle(num("cx"), num("cy"), cr)]; }
        else if (tag === "ellipse") { var erx = num("rx"), ery = num("ry"); if (erx > 0 && ery > 0) contours = [Gl.ellipse(num("cx"), num("cy"), erx, ery)]; }
        else if (tag === "line") contours = [Gl.polygon([[num("x1"), num("y1")], [num("x2"), num("y2")]], false)];
        else if (tag === "polygon" || tag === "polyline") {
          var v = (a.points || "").match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [], pts = [];
          for (var q = 0; q + 1 < v.length; q += 2) pts.push([parseFloat(v[q]), parseFloat(v[q + 1])]);
          if (pts.length >= 2) contours = [Gl.polygon(pts, tag === "polygon")];
        }
      }
      if (contours && contours.length) {
        contours = contours.map(function (c) { return applyM(c, mat); });
        var sc = Math.sqrt(Math.abs(mat[0] * mat[3] - mat[1] * mat[2])) || 1;
        if (st.fill !== "none") {
          if (st.fill === "white") white++;
          else items.push({ kind: "fill", contours: contours.map(function (c) { return Object.assign({}, c, { closed: true }); }), rule: st.rule });
        }
        if (st.stroke !== "none" && st.sw > 0) {
          if (st.stroke === "white") white++;
          else items.push({ kind: "stroke", contours: contours, width: st.sw * sc, join: st.join, cap: st.cap, miter: st.miter });
        }
      }
      if (!selfc) stack.push({ tag: tag, st: st, m: mat, skip: skip });
    }
    if (white) note("white shapes were left out (white is taken as the background)");
    var ns = Object.keys(notes);
    if (items.some(function (it) { return it.kind === "stroke"; })) ns.push("lines were turned into filled shapes");
    return { items: items, notes: ns };
  };
  /* SVG text -> { shape, notes }. */
  Gl.fromSVG = function (text) {
    var p = Gl.parseSVG(text), r = Gl.fromItems(p.items);
    return { shape: r.shape, notes: p.notes.concat(r.notes) };
  };
  Gl.fromShape = function (id, seed) {
    var s = SHAPES[id]; if (!s) throw new Error("Unknown shape.");
    return { shape: Gl.fromItems(s.items(seed)).shape, name: s.name.replace(/ \(.*\)$/, "") };
  };

  /* ---------- SVG text out ---------- */
  /* The glyph as an SVG picture: one path, one colour, the real size in the width and height (millimetres) when sizeMm is given. */
  Gl.toSVG = function (shape, o) {
    o = o || {};
    var w = shape.x1 - shape.x0, h = shape.y1 - shape.y0, k = o.sizeMm > 0 ? o.sizeMm / h : 0;
    var fillc = /^#[0-9a-f]{6}$/i.test(o.colour || "") ? o.colour : "#000000";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + num3(shape.x0) + " " + num3(shape.y0) + " " + num3(w) + " " + num3(h) + '"' +
      (k ? ' width="' + num3(w * k) + 'mm" height="' + num3(h * k) + 'mm"' : "") + '>\n' +
      '<path fill="' + fillc + '" fill-rule="evenodd" d="' + shape.d + '"/>\n</svg>\n';
  };
  /* The vertical size of one glyph unit: millimetres per unit for a layer of this size. */
  Gl.mmPerUnit = function (size, shape) { return size / (shape.y1 - shape.y0); };
  /* The scale of a layer's frozen shape: millimetres per unit for a glyph, 1 for a frozen text. */
  Gl.k = function (l) { if (l && l.pattern) return l.size > 0 ? l.size / 100 : 1;   /* a pattern: the size is its scale in percent */ return l && l.glyph && l.frozen && l.frozen.y1 > l.frozen.y0 ? l.size / (l.frozen.y1 - l.frozen.y0) : 1; };

  Gl.pathD = pathD;
  PTD.glyph = Gl;
  if (typeof module !== "undefined" && module.exports) module.exports = Gl;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
