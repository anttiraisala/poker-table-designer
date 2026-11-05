/* Measurements: lasting, visible distances between things on the cloth (CAD: dimensions).
 * A measurement is attached to objects, not to coordinates, so it follows them when they move.
 * Kinds (phase 1):
 *   points  distance between two attached points (aligned, horizontal or vertical)
 *   ray     from a start point in a direction (towards a table centre, or along an axis) to the first crossing of a target line
 *   near    shortest distance between two line elements (shows where the two nearest points are)
 *   span    distance along a guide between two of its crossings with other elements
 * Attachable: table outlines, rails, player-area lines, the two card lines, texts (traced outline, or exact vectors when
 * frozen), guides, the cloth centre and the artwork origin. Not chips, cards, the dealer button or players.
 * Measurements are design aids: saved in the project, never cut. */
(function (PTD) {
  "use strict";
  var M = {};
  var C = function () { return PTD.core; };
  var KIND_NAME = { points: "Point to point", ray: "Ray", near: "Shortest distance", span: "Along a guide" };
  M.KINDS = KIND_NAME;
  var ARROW_PX = 5 * 96 / 25.4;
  var COL = "#3dff7a", COL_BAD = "#ff6b6b", COL_GHOST = "#7be3ff";

  /* ---------- small geometry ---------- */
  function segInt(p, q, r, s) {
    var d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = s[0] - r[0], d2y = s[1] - r[1], den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return null;
    var t = ((r[0] - p[0]) * d2y - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1y - (r[1] - p[1]) * d1x) / den;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return [p[0] + d1x * t, p[1] + d1y * t, t, u];
  }
  function ptSeg(pt, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    var t = L2 ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2)) : 0;
    var q = [a[0] + dx * t, a[1] + dy * t];
    return { d: Math.hypot(pt[0] - q[0], pt[1] - q[1]), q: q };
  }
  function segSeg(a, b, c, d) {
    var x = segInt(a, b, c, d);
    if (x) return { d: 0, p: [x[0], x[1]], q: [x[0], x[1]] };
    var best = null;
    function tryIt(pt, s0, s1, flip) {
      var r = ptSeg(pt, s0, s1);
      if (!best || r.d < best.d) best = flip ? { d: r.d, p: r.q, q: pt } : { d: r.d, p: pt, q: r.q };
    }
    tryIt(a, c, d, false); tryIt(b, c, d, false); tryIt(c, a, b, true); tryIt(d, a, b, true);
    return best;
  }
  function eachSeg(ring, fn) {
    var p = ring.pts, n = p.length, last = ring.closed ? n : n - 1;
    for (var i = 0; i < last; i++) fn(p[i], p[(i + 1) % n], i);
  }
  function ringsBox(rings) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    rings.forEach(function (r) { r.pts.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function ringLen(r) { var s = 0; eachSeg(r, function (a, b) { s += Math.hypot(b[0] - a[0], b[1] - a[1]); }); return s; }
  function featLen(f) { var s = 0; f.rings.forEach(function (r) { s += ringLen(r); }); return s; }
  /* Point at a fraction of the total length of all rings of a feature. */
  function pointAt(f, frac) {
    var total = featLen(f), want = Math.max(0, Math.min(1, frac)) * total, acc = 0, out = null;
    for (var k = 0; k < f.rings.length && !out; k++) {
      eachSeg(f.rings[k], function (a, b) {
        if (out) return;
        var L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc + L >= want - 1e-9) { var t = L ? (want - acc) / L : 0; out = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
        acc += L;
      });
    }
    if (!out && f.rings[0] && f.rings[0].pts.length) out = f.rings[0].pts[0].slice();
    return out;
  }
  /* Point at a fraction of the length of a feature, with the unit tangent of the segment it lies on. */
  function pointTangentAt(f, frac) {
    var total = featLen(f), want = Math.max(0, Math.min(1, frac)) * total, acc = 0, out = null, last = null;
    f.rings.forEach(function (r) {
      eachSeg(r, function (a, b) {
        var L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 1e-9) return;
        last = { p: b.slice(), t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
        if (!out && acc + L >= want - 1e-9) { var u = (want - acc) / L; out = { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], t: last.t }; }
        acc += L;
      });
    });
    return out || last;
  }
  /* The inner or outer edge point of a thick centre line (the player-area line): the centre point moved half the thickness
   * along the normal; "outer" is the side closer to the table outline. */
  function edgePoint(f, fm, s, w) {
    var pt = pointTangentAt(f, s); if (!pt) return null;
    var h = f.thick / 2, n = [-pt.t[1], pt.t[0]], c1 = [pt.p[0] + n[0] * h, pt.p[1] + n[1] * h], c2 = [pt.p[0] - n[0] * h, pt.p[1] - n[1] * h];
    var of = fm[f.outlineId], d1 = of ? nearestOn(of, c1).d : 0, d2 = of ? nearestOn(of, c2).d : 1, outer = d1 <= d2 ? c1 : c2, inner = d1 <= d2 ? c2 : c1;
    return w === "in" ? inner : outer;
  }
  /* A thick line seen at one of its edges: every segment moved half the thickness to its inner or outer side
   * (w = "in" or "out"). The result is a feature of short open pieces, so rays and distances work on it as on any line. */
  function edgeFeature(f, fm, w) {
    var h = f.thick / 2, of = f.outlineId ? fm[f.outlineId] : null, rings = [];
    f.rings.forEach(function (r) {
      eachSeg(r, function (a, b) {
        var L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) return;
        var n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L], outerSign;
        if (of) { var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; outerSign = nearestOn(of, [mid[0] + n[0] * h, mid[1] + n[1] * h]).d <= nearestOn(of, [mid[0] - n[0] * h, mid[1] - n[1] * h]).d ? 1 : -1; }
        else outerSign = n[1] * f.inDir > 0 ? -1 : 1;
        var sg = (w === "out" ? outerSign : -outerSign) * h;
        rings.push({ closed: false, pts: [[a[0] + n[0] * sg, a[1] + n[1] * sg], [b[0] + n[0] * sg, b[1] + n[1] * sg]] });
      });
    });
    return Object.assign({}, f, { rings: rings, bb: ringsBox(rings) });
  }
  function withRef(f, ref, fm) { return f && f.thick && (ref === "in" || ref === "out") ? edgeFeature(f, fm, ref) : f; }
  /* Nearest point of a feature to a point, with the fraction along the feature. */
  function nearestOn(f, pt) {
    var best = { d: Infinity, q: null, frac: 0 }, acc = 0, total = featLen(f) || 1;
    f.rings.forEach(function (r) {
      eachSeg(r, function (a, b) {
        var res = ptSeg(pt, a, b);
        if (res.d < best.d) best = { d: res.d, q: res.q, frac: (acc + Math.hypot(res.q[0] - a[0], res.q[1] - a[1])) / total };
        acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
      });
    });
    return best;
  }

  /* ---------- text outlines ---------- */
  var traceCache = {};
  function cfgRes() { var r = Number(C().cfg().traceRes); return isFinite(r) ? Math.max(2, Math.min(40, r)) : 10; }
  /* Marching squares on a binary mask; returns closed rings in pixel coordinates (sample centres at i+0.5). */
  function traceMask(mask, W, H) {
    var segs = [];
    function e(kind, i, j) { return kind + i + "," + j; }
    function pos(key) {
      var k = key.charAt(0), p = key.slice(1).split(","), i = +p[0], j = +p[1];
      return k === "h" ? [i + 1, j + 0.5] : [i + 0.5, j + 1];
    }
    for (var j = 0; j < H - 1; j++) {
      for (var i = 0; i < W - 1; i++) {
        var c = (mask[j * W + i] ? 1 : 0) | (mask[j * W + i + 1] ? 2 : 0) | (mask[(j + 1) * W + i + 1] ? 4 : 0) | (mask[(j + 1) * W + i] ? 8 : 0);
        if (c === 0 || c === 15) continue;
        var T = e("h", i, j), R = e("v", i + 1, j), B = e("h", i, j + 1), L = e("v", i, j);
        switch (c) {
          case 1: case 14: segs.push([L, T]); break;
          case 2: case 13: segs.push([T, R]); break;
          case 3: case 12: segs.push([L, R]); break;
          case 4: case 11: segs.push([R, B]); break;
          case 5: segs.push([L, T], [R, B]); break;
          case 6: case 9: segs.push([T, B]); break;
          case 7: case 8: segs.push([L, B]); break;
          case 10: segs.push([T, R], [L, B]); break;
        }
      }
    }
    var adj = {};
    segs.forEach(function (s, idx) { (adj[s[0]] = adj[s[0]] || []).push(idx); (adj[s[1]] = adj[s[1]] || []).push(idx); });
    var used = new Array(segs.length), rings = [];
    for (var s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      used[s0] = true;
      var chain = [segs[s0][0], segs[s0][1]], cur = segs[s0][1], guard = 0;
      while (guard++ < segs.length + 2) {
        var next = null;
        (adj[cur] || []).forEach(function (k) { if (!next && !used[k]) next = k; });
        if (next === null) break;
        used[next] = true;
        var sg = segs[next], other = sg[0] === cur ? sg[1] : sg[0];
        chain.push(other); cur = other;
        if (other === chain[0]) break;
      }
      if (chain.length > 3) { chain.pop(); rings.push(chain.map(pos)); }
    }
    return rings;
  }
  /* Douglas-Peucker for a closed ring. */
  function simplifyRing(pts, tol) {
    var n = pts.length;
    if (n < 5) return pts;
    var far = 0, fd = -1;
    for (var i = 1; i < n; i++) { var d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
    function dp(a, b, out) {
      var maxd = 0, idx = -1, A = pts[a], B = pts[b % n];
      for (var k = a + 1; k < b; k++) { var dd = ptSeg(pts[k], A, B).d; if (dd > maxd) { maxd = dd; idx = k; } }
      if (idx >= 0 && maxd > tol) { dp(a, idx, out); out.push(pts[idx]); dp(idx, b, out); }
    }
    var out = [pts[0]]; dp(0, far, out); out.push(pts[far]); dp(far, n, out);
    return out;
  }
  function famCss(name) { return '"' + String(name).replace(/["\\]/g, "") + '", "Georgia", serif'; }
  /* The outline of a live text, in millimetres relative to its anchor (x, y), or null when it cannot be drawn yet. */
  function traceLive(l) {
    if (PTD.fonts.status(l.font) !== "ok") return null;
    var k = cfgRes();
    var key = JSON.stringify([l.text, l.font, l.size, l.ls, l.weight, l.italic, l.upper, l.cap, l.capScale, l.capAll, k]);
    if (traceCache[key]) return traceCache[key];
    var full = l.upper ? String(l.text).toUpperCase() : String(l.text);
    var runs = [], buf = "", big = true;
    if (l.cap && l.capScale > 0 && l.capScale !== 1) {
      Array.from(full).forEach(function (ch) {
        var space = /\s/.test(ch);
        if (!space && big) { if (buf) { runs.push({ t: buf, s: l.size }); buf = ""; } runs.push({ t: ch, s: l.size * l.capScale }); big = false; } else buf += ch;
        if (space && l.capAll) big = true;
      });
      if (buf) runs.push({ t: buf, s: l.size });
    } else runs.push({ t: full, s: l.size });
    var cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    var kk = k;
    /* keep the canvas within a sane size: lower the resolution for very large texts */
    for (var tries = 0; tries < 6; tries++) {
      var total = 0;
      runs.forEach(function (r) {
        ctx.font = (l.italic ? "italic " : "") + l.weight + " " + (r.s * kk) + "px " + famCss(l.font);
        if ("letterSpacing" in ctx) ctx.letterSpacing = (l.ls * kk) + "px";
        total += ctx.measureText(r.t).width;
      });
      var pad = l.size * kk * 0.3, W = Math.ceil(total + 2 * pad), H = Math.ceil(l.size * kk * 2.2);
      if (W * H <= 16e6 && W < 16000) break;
      kk = kk * 0.6;
    }
    cv.width = W; cv.height = H;
    ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#000"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    var x = pad, baseline = l.size * kk * 1.55;
    runs.forEach(function (r) {
      ctx.font = (l.italic ? "italic " : "") + l.weight + " " + (r.s * kk) + "px " + famCss(l.font);
      if ("letterSpacing" in ctx) ctx.letterSpacing = (l.ls * kk) + "px";
      ctx.fillText(r.t, x, baseline); x += ctx.measureText(r.t).width;
    });
    var img = ctx.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
    for (var i = 0, n = W * H; i < n; i++) mask[i] = img[i * 4 + 3] > 127 ? 1 : 0;
    var anchorX = pad + total / 2;
    var rings = traceMask(mask, W, H).map(function (r) { return simplifyRing(r, 0.45); }).filter(function (r) { return r.length > 2; })
      .map(function (r) { return { pts: r.map(function (p) { return [(p[0] - anchorX) / kk, (p[1] - baseline) / kk]; }), closed: true }; });
    var res = { rings: rings, exact: false, res: kk };
    traceCache[key] = res;
    return res;
  }
  /* Parses an absolute SVG path (M L H V Q C Z) into flattened rings. */
  function pathRings(d) {
    var tok = String(d).match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [], i = 0, rings = [], cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = "";
    function num() { return parseFloat(tok[i++]); }
    function push(px, py) { if (cur) cur.pts.push([px, py]); }
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
      if (cmd === "M") { x = num(); y = num(); sx = x; sy = y; cur = { pts: [[x, y]], closed: true }; rings.push(cur); cmd = "L"; }
      else if (cmd === "L") { x = num(); y = num(); push(x, y); }
      else if (cmd === "H") { x = num(); push(x, y); }
      else if (cmd === "V") { y = num(); push(x, y); }
      else if (cmd === "Q") { var qx = num(), qy = num(), ex = num(), ey = num(); for (var s = 1; s <= 8; s++) { var t = s / 8, u = 1 - t; push(u * u * x + 2 * u * t * qx + t * t * ex, u * u * y + 2 * u * t * qy + t * t * ey); } x = ex; y = ey; }
      else if (cmd === "C") { var a1 = num(), b1 = num(), a2 = num(), b2 = num(), ex2 = num(), ey2 = num(); for (var s2 = 1; s2 <= 10; s2++) { var t2 = s2 / 10, u2 = 1 - t2; push(u2 * u2 * u2 * x + 3 * u2 * u2 * t2 * a1 + 3 * u2 * t2 * t2 * a2 + t2 * t2 * t2 * ex2, u2 * u2 * u2 * y + 3 * u2 * u2 * t2 * b1 + 3 * u2 * t2 * t2 * b2 + t2 * t2 * t2 * ey2); } x = ex2; y = ey2; }
      else if (cmd === "Z" || cmd === "z") { x = sx; y = sy; cmd = ""; }
      else if (cmd === "m" || cmd === "l" || cmd === "h" || cmd === "v" || cmd === "q" || cmd === "c") { return rings.filter(function (r) { return r.pts.length > 2; }); }
      else i++;
    }
    return rings.filter(function (r) { return r.pts.length > 2; });
  }
  /* World rings of a text layer: frozen vectors, the traced outline, or (font not ready) the text box. */
  function textFeature(l) {
    var core = C(), AO = core.artOrigin(), rings = null, exact = false, how = "box";
    if (l.frozen && l.frozen.d) { rings = pathRings(l.frozen.d); exact = true; how = "exact"; }
    else { var tr = traceLive(l); if (tr && tr.rings.length) { rings = tr.rings; how = "traced"; } }
    if (!rings) {   /* the font is not ready: use the box the stage measured for the text (world coordinates) */
      var bd = core.ui.bounds && core.ui.bounds[l.id];
      if (!bd) return null;
      return { id: "x:" + l.uid, label: "Text “" + String(l.text).slice(0, 24) + "”", rings: [{ closed: true, pts: [[bd.x, bd.y], [bd.x + bd.w, bd.y], [bd.x + bd.w, bd.y + bd.h], [bd.x, bd.y + bd.h]] }], how: "box", text: true };
    }
    var a = (l.rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    var world = rings.map(function (r) {
      return { closed: true, pts: r.pts.map(function (p) { return [AO.x + l.x + p[0] * ca - p[1] * sa, AO.y + l.y + p[0] * sa + p[1] * ca]; }) };
    });
    return { id: "x:" + l.uid, label: "Text “" + String(l.text).slice(0, 24) + "”", rings: world, how: how, text: true };
  }

  /* ---------- features (the things that can be measured) ---------- */
  function mk(id, label, rings, extra) {
    var f = { id: id, label: label, rings: rings };
    if (rings.length) f.bb = ringsBox(rings);
    return Object.assign(f, extra || {});
  }
  function allFeatures() {
    var core = C(), st = core.state(), out = [];
    PTD.tables.visible().forEach(function (t) {
      var g = PTD.tables.geo(t);
      out.push(mk("t:" + t.id + ":outline", t.name + " outline", [{ pts: g.poly, closed: true }], { table: t.id }));
      if (g.rail && g.rail.length) out.push(mk("t:" + t.id + ":rail", t.name + " rail", [{ pts: g.rail, closed: true }], { table: t.id }));
      if (g.bet) out.push(mk("t:" + t.id + ":bet", t.name + " player-area line", [{ pts: g.bet.pts, closed: g.bet.closed }], { table: t.id, thick: t.bet.thick, outlineId: "t:" + t.id + ":outline" }));
    });
    var b = st.band, AO = core.artOrigin();
    if (b && b.show && !b.hidden) {
      /* a line is its centre line; the thickness is spread on both sides (the edges are separate anchors) */
      [b.y - b.gap / 2, b.y + b.gap / 2].forEach(function (yy, i) {
        var x0 = AO.x + b.x - b.len / 2, x1 = AO.x + b.x + b.len / 2, yc = AO.y + yy;
        out.push(mk("band:" + i, i === 0 ? "Upper card line" : "Lower card line", [{ pts: [[x0, yc], [x1, yc]], closed: false }], { thick: b.thick, inDir: i === 0 ? 1 : -1 }));
      });
    }
    st.layers.forEach(function (l) {
      if (l.hidden || !l.uid) return;
      var f = textFeature(l);
      if (f) { f.bb = ringsBox(f.rings); out.push(f); }
    });
    st.guides.forEach(function (g) { out.push({ id: "g:" + g.id, label: g.name || "Guide", rings: [], guide: { axis: g.axis, v: PTD.guides.abs(g) } }); });
    return out;
  }
  M._features = allFeatures;
  function featMap() { var m = {}; allFeatures().forEach(function (f) { m[f.id] = f; }); return m; }

  /* ---------- intersections and distances between features ---------- */
  function guideCross(gd, f) {
    var out = [];
    f.rings.forEach(function (r) {
      eachSeg(r, function (a, b) {
        var ax = gd.axis === "x" ? 0 : 1, da = a[ax] - gd.v, db = b[ax] - gd.v;
        if ((da <= 0 && db >= 0) || (da >= 0 && db <= 0)) {
          if (da === db) return;
          var t = da / (da - db), pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          out.push(pt);
        }
      });
    });
    return out;
  }
  function crossings(f1, f2) {
    if (f1.guide && f2.guide) {
      if (f1.guide.axis === f2.guide.axis) return [];
      return [f1.guide.axis === "x" ? [f1.guide.v, f2.guide.v] : [f2.guide.v, f1.guide.v]];
    }
    if (f1.guide) return guideCross(f1.guide, f2);
    if (f2.guide) return guideCross(f2.guide, f1);
    var out = [];
    if (f1.bb && f2.bb && (f1.bb.x1 < f2.bb.x0 || f2.bb.x1 < f1.bb.x0 || f1.bb.y1 < f2.bb.y0 || f2.bb.y1 < f1.bb.y0)) return out;
    f1.rings.forEach(function (r1) {
      eachSeg(r1, function (a, b) {
        var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        f2.rings.forEach(function (r2) {
          eachSeg(r2, function (c, d) {
            if (Math.max(c[0], d[0]) < x0 || Math.min(c[0], d[0]) > x1 || Math.max(c[1], d[1]) < y0 || Math.min(c[1], d[1]) > y1) return;
            var h = segInt(a, b, c, d);
            if (h) out.push([h[0], h[1]]);
          });
        });
      });
    });
    return out;
  }
  /* Shortest distance between two features: { d, p, q } */
  function nearestPair(f1, f2) {
    if (f1.guide && f2.guide) {
      if (f1.guide.axis === f2.guide.axis) {
        var ax = f1.guide.axis;
        return ax === "x" ? { d: Math.abs(f1.guide.v - f2.guide.v), p: [f1.guide.v, 0], q: [f2.guide.v, 0] } : { d: Math.abs(f1.guide.v - f2.guide.v), p: [0, f1.guide.v], q: [0, f2.guide.v] };
      }
      var x = f1.guide.axis === "x" ? f1.guide.v : f2.guide.v, y = f1.guide.axis === "x" ? f2.guide.v : f1.guide.v;
      return { d: 0, p: [x, y], q: [x, y] };
    }
    if (f1.guide || f2.guide) {
      var g = f1.guide ? f1 : f2, o = f1.guide ? f2 : f1, ix = g.guide.axis === "x" ? 0 : 1, best = null;
      o.rings.forEach(function (r) {
        r.pts.forEach(function (pt) {
          var d = Math.abs(pt[ix] - g.guide.v);
          if (!best || d < best.d) { var on = pt.slice(); on[ix] = g.guide.v; best = { d: d, o: pt, g: on }; }
        });
      });
      var cr = guideCross(g.guide, o);
      if (cr.length) best = { d: 0, o: cr[0], g: cr[0] };
      if (!best) return null;
      return f1.guide ? { d: best.d, p: best.g, q: best.o } : { d: best.d, p: best.o, q: best.g };
    }
    var res = null;
    f1.rings.forEach(function (r1) {
      eachSeg(r1, function (a, b) {
        f2.rings.forEach(function (r2) {
          eachSeg(r2, function (c, d) {
            if (res && res.d === 0) return;
            if (res) {
              var gap = res.d;
              if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) - gap || Math.min(a[0], b[0]) > Math.max(c[0], d[0]) + gap ||
                Math.max(a[1], b[1]) < Math.min(c[1], d[1]) - gap || Math.min(a[1], b[1]) > Math.max(c[1], d[1]) + gap) return;
            }
            var r = segSeg(a, b, c, d);
            if (!res || r.d < res.d) res = r;
          });
        });
      });
    });
    return res;
  }
  /* First crossing of a ray with a feature. */
  function rayHit(origin, dir, f) {
    var best = null, far = [origin[0] + dir[0] * 1e7, origin[1] + dir[1] * 1e7];
    if (f.guide) {
      var ix = f.guide.axis === "x" ? 0 : 1;
      if (Math.abs(dir[ix]) < 1e-12) return null;
      var t = (f.guide.v - origin[ix]) / dir[ix];
      return t > 1e-6 ? [origin[0] + dir[0] * t, origin[1] + dir[1] * t] : null;
    }
    f.rings.forEach(function (r) {
      eachSeg(r, function (a, b) {
        var h = segInt(origin, far, a, b);
        if (h && h[2] * 1e7 > 1e-6 && (!best || h[2] < best.t)) best = { t: h[2], p: [h[0], h[1]] };
      });
    });
    return best ? best.p : null;
  }

  /* ---------- anchors ---------- */
  /* Quadrant point q (angle q * 90 degrees, y down) of the arc p to q with its bulge, or null when the arc does not pass it. */
  function onArc(ar, th) {
    var d = th - ar.a0, TAU = 2 * Math.PI;
    d = ((d % TAU) + TAU) % TAU;
    var along = ar.sweep >= 0 ? d : (d === 0 ? 0 : TAU - d);
    return along <= Math.abs(ar.sweep) + 1e-9;
  }
  function quadPoint(p, q, qi) {
    var ar = PTD.geom.arc(p, q, p.b || 0); if (!ar) return null;
    var th = qi * Math.PI / 2;
    return onArc(ar, th) ? [ar.cx + ar.r * Math.cos(th), ar.cy + ar.r * Math.sin(th)] : null;
  }
  /* The point of the arc p to q where a line from A touches it (k picks one of the two tangents), or null. */
  function tangentPoint(p, q, A, k) {
    var ar = PTD.geom.arc(p, q, p.b || 0); if (!ar || !A) return null;
    var d = Math.hypot(A[0] - ar.cx, A[1] - ar.cy); if (d <= ar.r + 1e-6) return null;
    var th = Math.atan2(A[1] - ar.cy, A[0] - ar.cx) + (k ? -1 : 1) * Math.acos(ar.r / d);
    return onArc(ar, th) ? [ar.cx + ar.r * Math.cos(th), ar.cy + ar.r * Math.sin(th)] : null;
  }
  var lastHint = new WeakMap();   /* where a crossing anchor was found last time (not saved) */
  function anchorPoint(a, fm) {
    var core = C(), st = core.state();
    if (!a) return null;
    switch (a.t) {
      case "pt": return [a.x, a.y];
      case "centre": return [0, 0];
      case "origin": { var O = core.artOrigin(); return [O.x, O.y]; }
      case "tctr": { var t0 = PTD.tables.get(a.table); return t0 && t0.visible ? [t0.x, t0.y] : null; }
      case "tnode": { var t1 = PTD.tables.get(a.table); if (!t1 || !t1.visible) return null; var wn = PTD.tables.worldNodes(t1); return wn[a.i] ? [wn[a.i].x, wn[a.i].y] : null; }
      case "tmid": {
        var t2 = PTD.tables.get(a.table); if (!t2 || !t2.visible) return null;
        var w2 = PTD.tables.worldNodes(t2), n = w2.length; if (!w2[a.i]) return null;
        var ap = PTD.geom.apexOf(w2[a.i], w2[(a.i + 1) % n], w2[a.i].b || 0); return [ap.x, ap.y];
      }
      case "tquad": {   /* a quadrant point (0 right, 1 down, 2 left, 3 up) of an arc of a table outline */
        var t3 = PTD.tables.get(a.table); if (!t3 || !t3.visible) return null;
        var w3 = PTD.tables.worldNodes(t3), n3 = w3.length; if (!w3[a.i]) return null;
        return quadPoint(w3[a.i], w3[(a.i + 1) % n3], a.q);
      }
      case "tang": {   /* where a line from another anchor touches an arc of a table outline */
        var t4 = PTD.tables.get(a.table), A1 = a.from && a.from.t !== "perp" && a.from.t !== "tang" ? anchorPoint(a.from, fm) : null;
        if (!t4 || !t4.visible || !A1) return null;
        var w4 = PTD.tables.worldNodes(t4); if (!w4[a.i]) return null;
        return tangentPoint(w4[a.i], w4[(a.i + 1) % w4.length], A1, a.k);
      }
      case "perp": {   /* the foot of the perpendicular from another anchor onto a line */
        var fp = fm[a.f], A0 = a.from && a.from.t !== "perp" && a.from.t !== "tang" ? anchorPoint(a.from, fm) : null;
        if (!fp || !A0) return null;
        var nq = nearestOn(fp, A0); return nq.q ? nq.q.slice() : null;
      }
      case "vtx": { var f = fm[a.f]; return f && f.rings[0] && f.rings[0].pts[a.i] ? f.rings[0].pts[a.i].slice() : null; }
      case "ext": {
        var f2 = fm[a.f]; if (!f2 || !f2.rings.length) return null;
        var bb = f2.bb, best = null, key = { left: [0, -1], right: [0, 1], top: [1, -1], bottom: [1, 1] }[a.w];
        if (a.w === "mid") return [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2];
        if (!key) return null;
        f2.rings.forEach(function (r) { r.pts.forEach(function (p) { var v = p[key[0]] * key[1]; if (!best || v > best.v) best = { v: v, p: p }; }); });
        return best ? best.p.slice() : null;
      }
      case "bedge": {   /* a point on the inner or outer edge of a thick line, s = fraction along its length */
        var fb = fm[a.f]; if (!fb || !fb.rings[0] || !fb.thick) return null;
        var q0 = fb.rings[0].pts[0], q1 = fb.rings[0].pts[1], sgn = (a.w === "in" ? 1 : -1) * fb.inDir;
        return [q0[0] + (q1[0] - q0[0]) * a.s, q0[1] + sgn * fb.thick / 2];
      }
      case "boff": { var fo = fm[a.f]; return fo && fo.rings.length && fo.thick ? edgePoint(fo, fm, a.s, a.w) : null; }
      case "along": { var f3 = fm[a.f]; return f3 && f3.rings.length ? pointAt(f3, a.s) : null; }
      case "cross": {
        var f4 = fm[a.f1], f5 = fm[a.f2]; if (!f4 || !f5) return null;
        var list = crossings(f4, f5); if (!list.length) return null;
        var hint = lastHint.get(a) || [a.x, a.y], best2 = null;
        list.forEach(function (p) { var d = Math.hypot(p[0] - hint[0], p[1] - hint[1]); if (!best2 || d < best2.d) best2 = { d: d, p: p }; });
        lastHint.set(a, best2.p);
        return best2.p.slice();
      }
    }
    return null;
  }

  /* ---------- resolving a measurement ---------- */
  function dirOf(m, A, fm) {
    var d = m.dir || {};
    if (d.type === "centre") { var t = PTD.tables.get(d.table); if (!t) return null; var v = [t.x - A[0], t.y - A[1]], L = Math.hypot(v[0], v[1]); return L < 1e-9 ? null : [v[0] / L, v[1] / L]; }
    if (d.type === "axis") return { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d.axis] || null;
    return null;
  }
  /* Returns { ok, A, B, val, mode, why } for a measurement (saved or being previewed). */
  M.resolve = function (m, fm) {
    fm = fm || featMap();
    var bad = function (why) { return { ok: false, why: why }; };
    var A, B, mode = "aligned";
    if (m.kind === "points" || m.kind === "span") {
      A = anchorPoint(m.a, fm); B = anchorPoint(m.b, fm);
      if (!A || !B) return bad("an attached object is missing");
      mode = m.kind === "points" ? (m.mode || "aligned") : "aligned";
    } else if (m.kind === "ray") {
      A = anchorPoint(m.a, fm); if (!A) return bad("the start point is missing");
      var f = withRef(fm[m.target], m.tref, fm); if (!f) return bad("the target line is missing");
      var dir = dirOf(m, A, fm); if (!dir) return bad("no direction");
      B = rayHit(A, dir, f); if (!B) return bad("the ray does not reach the target");
    } else if (m.kind === "near") {
      var f1 = withRef(fm[m.f1], m.r1, fm), f2 = withRef(fm[m.f2], m.r2, fm); if (!f1 || !f2) return bad("an attached object is missing");
      var r = nearestPair(f1, f2); if (!r) return bad("nothing to measure");
      A = r.p; B = r.q;
    } else return bad("unknown kind");
    var val = mode === "h" ? Math.abs(B[0] - A[0]) : mode === "v" ? Math.abs(B[1] - A[1]) : Math.hypot(B[0] - A[0], B[1] - A[1]);
    var off = Number(m.off) || 0, P, Q, n;
    if (mode === "h") { var y0 = (A[1] + B[1]) / 2 + off; P = [A[0], y0]; Q = [B[0], y0]; n = [0, 1]; }
    else if (mode === "v") { var x0 = (A[0] + B[0]) / 2 + off; P = [x0, A[1]]; Q = [x0, B[1]]; n = [1, 0]; }
    else {
      var L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      n = L > 1e-9 ? [-(B[1] - A[1]) / L, (B[0] - A[0]) / L] : [0, -1];
      P = [A[0] + n[0] * off, A[1] + n[1] * off]; Q = [B[0] + n[0] * off, B[1] + n[1] * off];
    }
    return { ok: true, A: A, B: B, P: P, Q: Q, n: n, val: val, mode: mode };
  };
  M.value = function (m) { var r = M.resolve(m); return r.ok ? r.val : null; };

  /* ---------- drawing ---------- */
  function drawMeasure(g, res, o) {
    var core = C(), el = core.el, z = o.z, col = o.broken ? COL_BAD : (o.ghost ? COL_GHOST : COL), sw = 1;   /* thin lines of one pixel, whatever the zoom */
    var attrs = function (extra) { return Object.assign({ stroke: col, "stroke-width": sw, "vector-effect": "non-scaling-stroke", fill: "none", "pointer-events": "none" }, o.ghost ? { "stroke-dasharray": "5 4" } : {}, extra || {}); };
    var ux = res.Q[0] - res.P[0], uy = res.Q[1] - res.P[1], L = Math.hypot(ux, uy);
    el("line", attrs({ x1: res.A[0], y1: res.A[1], x2: res.P[0], y2: res.P[1], opacity: 0.8 }), g);
    el("line", attrs({ x1: res.B[0], y1: res.B[1], x2: res.Q[0], y2: res.Q[1], opacity: 0.8 }), g);
    el("line", attrs({ x1: res.P[0], y1: res.P[1], x2: res.Q[0], y2: res.Q[1] }), g);
    if (L > 1e-9) {
      /* arrow heads keep one size on the screen (5 mm at 96 dpi) so that they are always visible; short lines get smaller heads */
      var dx = ux / L, dy = uy / L, ah = Math.min(ARROW_PX / z, L / 3), aw = ah * 0.34;
      [[res.P, 1], [res.Q, -1]].forEach(function (e) {
        var p = e[0], sg = e[1], bx = p[0] + dx * ah * sg, by = p[1] + dy * ah * sg;
        el("path", attrs({ d: "M" + p[0] + " " + p[1] + "L" + (bx - dy * aw) + " " + (by + dx * aw) + "L" + (bx + dy * aw) + " " + (by - dx * aw) + "Z", fill: col }), g);
      });
    }
    [res.A, res.B].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 3 / z, fill: col, "pointer-events": "none" }, g); });
    var label = core.fmtLen(res.val) + (o.name ? "  " + o.name : ""), fs = 13 / z, tw = label.length * fs * 0.55;
    var mx = (res.P[0] + res.Q[0]) / 2, my = (res.P[1] + res.Q[1]) / 2;
    var hit = el("g", o.id ? { "data-h": "meas:" + o.id, style: "cursor:grab" } : { "pointer-events": "none" }, g);
    el("rect", { x: mx - tw / 2 - 4 / z, y: my - fs * 0.95, width: tw + 8 / z, height: fs * 1.35, rx: 2 / z, fill: "rgba(8,28,22,0.9)", stroke: col, "stroke-width": o.sel ? 1.6 : 0.8, "vector-effect": "non-scaling-stroke" }, hit);
    var t = el("text", { x: mx, y: my + fs * 0.1, "text-anchor": "middle", "font-size": fs, fill: col }, hit);
    t.style.fontFamily = "'Josefin Sans', sans-serif"; t.textContent = label;
    if (o.id) el("line", { x1: res.P[0], y1: res.P[1], x2: res.Q[0], y2: res.Q[1], stroke: "transparent", "stroke-width": 12, "vector-effect": "non-scaling-stroke", "data-h": "meas:" + o.id, style: "cursor:grab" }, hit);
    if (o.sel && o.id) {
      [["a", res.A], ["b", res.B]].forEach(function (e) {
        el("circle", { cx: e[1][0], cy: e[1][1], r: 7 / z, fill: "rgba(61,255,122,0.18)", stroke: col, "stroke-width": 1, "vector-effect": "non-scaling-stroke", "data-h": "meas:" + o.id + ":" + e[0], style: "cursor:crosshair" }, g);
      });
    }
  }
  M.render = function (g, ctx) {
    var core = C(), st = core.state(), cfg = core.cfg();
    if (cfg.showMeasures === false || !st.measures || !st.measures.length) return;
    var fm = featMap();
    st.measures.forEach(function (m) {
      var res = M.resolve(m, fm);
      if (!res.ok) return;
      drawMeasure(g, res, { z: ctx.z, id: m.id, name: m.name, sel: core.ui.selMeasure === m.id });
    });
  };

  /* ---------- the tool: ghost preview while adding ---------- */
  function ui() { return C().ui; }
  function tid(a) { return a && a.table; }
  function thr() { return 11 / ui().view.z; }

  /* Candidate points near p for attaching, best first. only: optional list of feature ids that crossings must involve. */
  M.candidates = function (p, opts) {
    opts = opts || {};
    var core = C(), fs = allFeatures(), th = thr(), out = [], fmId = {};
    fs.forEach(function (f) { fmId[f.id] = f; });
    function add(kind, label, x, y, anchor, tier) {
      var d = Math.hypot(x - p.x, y - p.y);
      if (d <= th) out.push({ kind: kind, label: label, x: x, y: y, a: anchor, tier: tier, d: d });
    }
    if (!opts.only) {
      add("centre", "cloth centre", 0, 0, { t: "centre" }, 0);
      var O = core.artOrigin(); add("centre", "artwork origin", O.x, O.y, { t: "origin" }, 0);
      PTD.tables.visible().forEach(function (t) {
        add("centre", t.name + " centre", t.x, t.y, { t: "tctr", table: t.id }, 0);
        var wn = PTD.tables.worldNodes(t), n = wn.length;
        wn.forEach(function (q, i) {
          add("node", t.name + " node " + (i + 1), q.x, q.y, { t: "tnode", table: t.id, i: i }, 0);
          var ap = PTD.geom.apexOf(q, wn[(i + 1) % n], q.b || 0);
          add("middle", t.name + (q.b ? " arc middle" : " edge middle"), ap.x, ap.y, { t: "tmid", table: t.id, i: i }, 1);
          if (q.b && opts.from) { var Af = anchorPoint(opts.from, fmId); for (var tk = 0; tk < 2; tk++) { var tp = Af && tangentPoint(q, wn[(i + 1) % n], Af, tk); if (tp) add("tangent", t.name + " arc tangent", tp[0], tp[1], { t: "tang", table: t.id, i: i, k: tk, from: opts.from }, 1); } }
          if (q.b) for (var qi = 0; qi < 4; qi++) { var qp = quadPoint(q, wn[(i + 1) % n], qi); if (qp) add("quadrant", t.name + " arc quadrant", qp[0], qp[1], { t: "tquad", table: t.id, i: i, q: qi }, 1); }
        });
      });
      fs.forEach(function (f) {
        if (f.id.indexOf("band:") === 0) {
          f.rings[0].pts.forEach(function (q, i) { add("end", f.label + " end", q[0], q[1], { t: "vtx", f: f.id, i: i }, 0); });
          var e0 = f.rings[0].pts[0], e1 = f.rings[0].pts[1], len = e1[0] - e0[0], th2 = f.thick / 2;
          if (p.x >= e0[0] - thr() && p.x <= e1[0] + thr() && Math.abs(p.y - e0[1]) <= th2 + thr()) {
            var sx = Math.max(0, Math.min(1, (p.x - e0[0]) / len)), px = e0[0] + len * sx;
            [["centre", "line centre", 0, 0], ["in", "inner edge", 1, 1], ["out", "outer edge", -1, 1]].forEach(function (k) {
              var yy = e0[1] + k[2] * f.inDir * th2, anchor = k[0] === "centre" ? { t: "along", f: f.id, s: Math.round(sx * 1e6) / 1e6 } : { t: "bedge", f: f.id, w: k[0], s: Math.round(sx * 1e6) / 1e6 };
              out.push({ kind: k[1], label: f.label, x: px, y: yy, a: anchor, tier: 1, d: Math.hypot(px - p.x, yy - p.y) });
            });
          }
        }
        if (/:bet$/.test(f.id)) {
          var nb = nearestOn(f, [p.x, p.y]);
          if (nb.q && nb.d <= f.thick / 2 + thr()) {
            var sb = Math.round(nb.frac * 1e6) / 1e6;
            [["centre", "line centre"], ["in", "inner edge"], ["out", "outer edge"]].forEach(function (k) {
              var an = k[0] === "centre" ? { t: "along", f: f.id, s: sb } : { t: "boff", f: f.id, w: k[0], s: sb }, q = anchorPoint(an, fmId);
              if (q) out.push({ kind: k[1], label: f.label, x: q[0], y: q[1], a: an, tier: 1, d: Math.hypot(q[0] - p.x, q[1] - p.y) });
            });
          }
        }
        if (f.text) {
          ["left", "right", "top", "bottom"].forEach(function (w) {
            var q = anchorPoint({ t: "ext", f: f.id, w: w }, fmId); if (q) add("extreme", f.label + " " + w + " extreme", q[0], q[1], { t: "ext", f: f.id, w: w }, 0);
          });
          var q2 = anchorPoint({ t: "ext", f: f.id, w: "mid" }, fmId); if (q2) add("middle", f.label + " centre", q2[0], q2[1], { t: "ext", f: f.id, w: "mid" }, 1);
        }
      });
    }
    /* crossings of two features near the pointer */
    var near = fs.filter(function (f) {
      if (f.guide) return Math.abs((f.guide.axis === "x" ? p.x : p.y) - f.guide.v) <= th;
      return f.bb && p.x >= f.bb.x0 - th && p.x <= f.bb.x1 + th && p.y >= f.bb.y0 - th && p.y <= f.bb.y1 + th;
    });
    for (var i = 0; i < near.length; i++) for (var j = i + 1; j < near.length; j++) {
      if (opts.only && near[i].id !== opts.only && near[j].id !== opts.only) continue;
      var pts = crossings(near[i], near[j]);
      for (var k = 0; k < pts.length; k++) {
        var a = near[i].id < near[j].id ? [near[i], near[j]] : [near[j], near[i]];
        add("intersection", a[0].label + " × " + a[1].label, pts[k][0], pts[k][1], { t: "cross", f1: a[0].id, f2: a[1].id, x: pts[k][0], y: pts[k][1] }, 0);
      }
    }
    if (!opts.only && opts.from) {   /* perpendicular to a line from the first point */
      var A0 = anchorPoint(opts.from, fmId);
      if (A0) near.forEach(function (f) {
        if (f.guide || f.text) return;
        var nq = nearestOn(f, A0);
        if (nq.q) add("perpendicular", f.label, nq.q[0], nq.q[1], { t: "perp", f: f.id, from: opts.from }, 1);
      });
    }
    if (!opts.only) near.forEach(function (f) {
      if (f.guide) return;
      var nr = nearestOn(f, [p.x, p.y]);
      if (nr.q) add("nearest", f.label, nr.q[0], nr.q[1], { t: "along", f: f.id, s: Math.round(nr.frac * 1e6) / 1e6 }, 2);
    });
    out.sort(function (a, b) { return a.tier - b.tier || a.d - b.d; });
    return out;
  };
  /* ---------- the temporary Measure tool: snaps to named anchors so that a result can be pinned ---------- */
  function round1(v) { return Math.round(v * 10) / 10; }
  function tempPoint(p, e, from) {
    var core = C(), snapOn = core.cfg().snap && !(e && (e.altKey || e.ctrlKey));
    var list = snapOn ? M.candidates(p, { from: from }) : []; cyc.n = list.length;
    if (list.length) { var i = cyc.idx % list.length, c = list[i]; return { x: c.x, y: c.y, a: c.a, kind: c.kind, label: c.label, nth: i, of: list.length }; }
    var s = snapOn ? core.snapXY(p, {}) : p;
    return { x: s.x, y: s.y, a: { t: "pt", x: round1(s.x), y: round1(s.y) }, kind: "free", label: "point" };
  }
  M.tempMove = function (p, e, keep) {
    var core = C(), m = core.ui.measure; if (!keep) cycReset(p); cyc.e = e;
    var q = tempPoint(p, e, m && m.a && !m.b ? m.aa : null);
    core.ui.tempHover = q; PTD.guides.measureMove(q); core.renderStage();
  };
  M.tempClick = function (p, e) {
    var core = C(), m0 = core.ui.measure, q;
    cycReset(p); cyc.e = e;
    q = tempPoint(p, e, m0 && m0.a && !m0.b ? m0.aa : null);
    PTD.guides.measureClick(q);
    var m = core.ui.measure;
    if (m) { if (m.b) m.ab = q.a; else { m.aa = q.a; m.ab = null; } }
    core.say(m && m.b ? "Press Pin (or Enter) to keep this measurement, or click for a new one." : "Click the second point. Tab cycles through the snap points.");
    M.syncPin();
  };
  /* The toolbar Pin button: only shown when the temporary measurement is complete. */
  M.syncPin = function () {
    var b = document.getElementById("pinBtn"), u = ui(), m = u.measure;
    if (b) b.hidden = !(u.tool === "measure" && m && m.a && m.b);
  };
  M.pin = function () {
    var core = C(), m = core.ui.measure;
    if (!m || !m.a || !m.b) return false;
    var a = m.aa || { t: "pt", x: round1(m.a.x), y: round1(m.a.y) }, b = m.ab || { t: "pt", x: round1(m.b.x), y: round1(m.b.y) };
    core.ui.measure = null; core.ui.tempHover = null;
    finish({ kind: "points", mode: "aligned", a: a, b: b });
    core.say("Pinned as a lasting measurement (see Guides and measurements).");
    M.syncPin();
    return true;
  };

  /* ---------- examples: a script of pointer steps that the help runner plays on the stage ---------- */
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  /* World box that is visible on the stage now, shrunk a little. */
  function viewBox() {
    var u = ui(), r = document.getElementById("stage").getBoundingClientRect(), v = u.view, hw = r.width / 2 / v.z * 0.85, hh = r.height / 2 / v.z * 0.85;
    return { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh };
  }
  function insideBox(p, b) { return p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1; }
  /* Points that a measurement can attach to and that are in view, in random order. */
  function examplePoints() {
    var fm = featMap(), box = viewBox(), out = [], core = C();
    function add(a) { var q = anchorPoint(a, fm); if (q && insideBox(q, box)) out.push({ a: a, p: q }); }
    add({ t: "centre" }); add({ t: "origin" });
    PTD.tables.visible().forEach(function (t) {
      add({ t: "tctr", table: t.id });
      PTD.tables.worldNodes(t).forEach(function (n, i) { add({ t: "tnode", table: t.id, i: i }); add({ t: "tmid", table: t.id, i: i }); });
    });
    Object.keys(fm).forEach(function (id) {
      var f = fm[id];
      if (id.indexOf("band:") === 0) { add({ t: "vtx", f: id, i: 0 }); add({ t: "vtx", f: id, i: 1 }); }
      if (f.text) ["left", "right", "top", "bottom"].forEach(function (w) { add({ t: "ext", f: id, w: w }); });
    });
    var seen = {};
    return shuffle(out.filter(function (o) { var k = Math.round(o.p[0] / 5) + "," + Math.round(o.p[1] / 5); if (seen[k]) return false; seen[k] = 1; return true; }));
  }
  function lineFeatures() { var box = viewBox(); return shuffle(allFeatures().filter(function (f) { return !f.guide && f.rings.length && f.bb !== null && f.rings[0].pts.length > 1; })); }
  function pointOnFeature(f, box) {
    var best = null;
    f.rings.forEach(function (r) { r.pts.forEach(function (q, i) { if (insideBox(q, box) && (!best || Math.random() < 0.3)) best = q; }); });
    if (best) return best;
    return null;
  }
  /* type is a kind that M.start knows (points, h, v, rayc, raya, near, span). Returns { setup, steps } or { error }. */
  M.exampleSteps = function (type) {
    var pts = examplePoints(), box = viewBox(), fm = featMap(), steps = [], tries;
    function st(p, click, say) { steps.push({ x: p[0], y: p[1], click: !!click, say: say }); }
    var setup = function () { M.start(type); };
    if (type === "points" || type === "h" || type === "v") {
      if (pts.length < 2) return { error: "There are not enough points in view. Zoom out or show a table first." };
      var a = pts[0], b = pts[1];
      if (type === "h") { for (var i = 1; i < pts.length; i++) if (Math.abs(pts[i].p[0] - a.p[0]) > 40) { b = pts[i]; break; } }
      if (type === "v") { for (var j = 1; j < pts.length; j++) if (Math.abs(pts[j].p[1] - a.p[1]) > 40) { b = pts[j]; break; } }
      st(a.p, true, "First point: " + "the pointer snaps to a named point"); st(b.p, true, "Second point");
      return { setup: setup, steps: steps };
    }
    if (type === "near") {
      var fs = lineFeatures().filter(function (f) { return pointOnFeature(f, box); });
      if (fs.length < 2) return { error: "There are not two lines or texts in view." };
      st(pointOnFeature(fs[0], box), true, "First line or text"); st(pointOnFeature(fs[1], box), true, "Second line or text");
      return { setup: setup, steps: steps };
    }
    if (type === "rayc" || type === "raya") {
      var tbl = PTD.tables.visible()[0]; if (!tbl) return { error: "A ray needs a table. Add a table first." };
      var starts = pts.filter(function (o) { return o.a.t === "tnode" || o.a.t === "tmid" || o.a.t === "ext" || o.a.t === "vtx"; });
      var fl = lineFeatures();
      for (var s0 = 0; s0 < starts.length; s0++) {
        var A = starts[s0], axes = type === "raya" ? shuffle(["up", "down", "left", "right"]) : [null];
        for (var ax = 0; ax < axes.length; ax++) {
          for (var k = 0; k < fl.length; k++) {
            if (A.a.f && fl[k].id === A.a.f) continue;
            var m = { kind: "ray", a: A.a, dir: axes[ax] ? { type: "axis", axis: axes[ax] } : { type: "centre", table: tbl.id }, target: fl[k].id }, r = M.resolve(m);
            if (!r.ok || !insideBox(r.B, box) || Math.hypot(r.B[0] - r.A[0], r.B[1] - r.A[1]) < 30) continue;
            st(A.p, true, "Start point");
            if (axes[ax]) { var v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[axes[ax]], z = ui().view.z; st([A.p[0] + v[0] * 70 / z, A.p[1] + v[1] * 70 / z], true, "Move to choose the direction (" + axes[ax] + ") and click"); }
            st(r.B, true, "Click the line the ray should reach");
            return { setup: setup, steps: steps };
          }
        }
      }
      return { error: "No ray found that stays in view. Zoom out and try again." };
    }
    if (type === "span") {
      var gf = allFeatures().filter(function (f) { return f.guide; }), others = allFeatures().filter(function (f) { return !f.guide && f.rings.length; });
      shuffle(gf);
      for (var g = 0; g < gf.length; g++) {
        var cr = [];
        others.forEach(function (f) { crossings(gf[g], f).forEach(function (q) { if (insideBox(q, box)) cr.push(q); }); });
        if (cr.length < 2) continue;
        cr.sort(function (p, q) { return p[0] + p[1] - q[0] - q[1]; });
        var c1 = cr[0], c2 = cr[cr.length - 1];
        if (Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) < 20) continue;
        st(c1, true, "Click the guide"); st(c1, true, "First crossing on the guide"); st(c2, true, "Second crossing on the guide");
        return { setup: setup, steps: steps };
      }
      return { error: "This needs a guide that crosses two lines in view. Place a guide first (Guide | or Guide — in the toolbar)." };
    }
    return { error: "No example for this kind." };
  };
  /* The pinned-measurement example: two points with the temporary Measure tool, then Pin. */
  M.examplePin = function () {
    var pts = examplePoints(); if (pts.length < 2) return { error: "There are not enough points in view. Zoom out or show a table first." };
    return { setupTool: "measure", steps: [{ x: pts[0].p[0], y: pts[0].p[1], click: true, say: "First point of the temporary measurement" }, { x: pts[1].p[0], y: pts[1].p[1], click: true, say: "Second point" }, { button: "pinBtn", say: "Pin keeps it as a lasting measurement" }] };
  };

  M.pickFeature = function (p, filter) {
    var th = thr() * 1.4, best = null;
    allFeatures().forEach(function (f) {
      if (filter && !filter(f)) return;
      var d;
      if (f.guide) d = Math.abs((f.guide.axis === "x" ? p.x : p.y) - f.guide.v);
      else { if (f.bb && (p.x < f.bb.x0 - th || p.x > f.bb.x1 + th || p.y < f.bb.y0 - th || p.y > f.bb.y1 + th)) return; d = nearestOn(f, [p.x, p.y]).d; }
      if (d <= th && (!best || d < best.d)) best = { f: f, d: d };
    });
    return best ? best.f : null;
  };

  var HINT = {
    points: ["Click the first point", "Click the second point"],
    h: ["Click the first point (horizontal distance)", "Click the second point"],
    v: ["Click the first point (vertical distance)", "Click the second point"],
    rayc: ["Click the start point (it can be on a table edge)", "Click the line to measure to, along the ray towards the table centre"],
    raya: ["Click the start point", "Move to choose up, down, left or right and click", "Click the line to measure to"],
    near: ["Click the first line or text", "Click the second line or text"],
    span: ["Click a guide", "Click the first crossing on the guide", "Click the second crossing on the guide"]
  };
  M.start = function (type) {
    var core = C();
    core.ui.tool = "dim"; core.ui.measure = null; cyc.idx = 0; cyc.p = null;
    core.ui.dim = { type: type, picks: [], hover: null, prev: null, feat: null };
    core.say(HINT[type][0] + ". Esc cancels.");
    core.renderPanels(); core.renderStage();
  };
  M.cancel = function () { var u = ui(); u.dim = null; };
  function typeInfo(type) {
    return { points: { kind: "points", mode: "aligned", n: 2 }, h: { kind: "points", mode: "h", n: 2 }, v: { kind: "points", mode: "v", n: 2 },
      rayc: { kind: "ray", n: 2 }, raya: { kind: "ray", n: 3 }, near: { kind: "near", n: 2 }, span: { kind: "span", n: 3 } }[type];
  }
  function freePt(p, e) { return { kind: "free", label: "point", x: p.x, y: p.y, a: { t: "pt", x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 } }; }
  /* Tab cycles through the snap candidates at the pointer: idx is the chosen one, n how many there are. */
  var cyc = { idx: 0, n: 0, p: null, e: null, temp: false };
  function bestCand(p, e, opts) {
    var snapOn = C().cfg().snap && !(e && (e.altKey || e.ctrlKey));
    var list = snapOn ? M.candidates(p, opts) : [];
    if (opts && opts.cyc) { cyc.n = list.length; if (list.length) { var c0 = list[cyc.idx % list.length]; c0.nth = cyc.idx % list.length; c0.of = list.length; return c0; } }
    else if (list.length) return list[0];
    return opts && opts.only ? null : freePt(p, e);
  }
  function cycReset(p) { if (!cyc.p || Math.hypot(p.x - cyc.p.x, p.y - cyc.p.y) > 2 / ui().view.z) { cyc.idx = 0; cyc.p = { x: p.x, y: p.y }; } }
  /* Tab while placing or measuring: the next snap candidate at the pointer. */
  M.cycle = function () {
    var u = ui(); if (!(u.tool === "dim" && u.dim) && u.tool !== "measure") return false;
    if (!cyc.p) return true;
    cyc.idx++;
    if (u.tool === "dim") M.move(cyc.p, cyc.e, true); else M.tempMove(cyc.p, cyc.e, true);
    var h = u.tool === "dim" ? u.dim.hover : u.tempHover;
    if (h && h.of) C().say("Snap " + (h.nth + 1) + " of " + h.of + ": " + h.kind + ", " + h.label + ". Tab for the next one.");
    return true;
  };
  function axisFrom(A, p) {
    var dx = p.x - A[0], dy = p.y - A[1];
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }
  function rayDirFor(d, A) {
    if (d.type === "raya") return { type: "axis", axis: d.picks[1] && d.picks[1].axis };
    var tbl = d.picks[0] && d.picks[0].a && tid(d.picks[0].a);
    var t = (tbl && PTD.tables.get(tbl)) || PTD.tables.visible()[0];
    return t ? { type: "centre", table: t.id } : null;
  }
  /* The partly built measurement for the ghost, or null. */
  function draft(d, p, e) {
    var info = typeInfo(d.type), n = d.picks.length;
    if (info.kind === "points" && n === 1 && d.hover) return { kind: "points", mode: info.mode, a: d.picks[0].a, b: d.hover.a };
    if (info.kind === "near" && n === 1 && d.feat) return { kind: "near", f1: d.picks[0].id, f2: d.feat.id };
    if (info.kind === "span" && n === 2 && d.hover) return { kind: "span", guide: d.picks[0].id, a: d.picks[1].a, b: d.hover.a };
    if (info.kind === "ray") {
      var last = d.type === "raya" ? 2 : 1;
      if (n === last && d.feat) { var dir = rayDirFor(d); return dir && dir.type ? { kind: "ray", a: d.picks[0].a, dir: dir, target: d.feat.id } : null; }
    }
    return null;
  }
  M.move = function (p, e, keep) {
    var d = ui().dim; if (!d) return;
    if (!keep) cycReset(p);
    cyc.e = e;
    var info = typeInfo(d.type), n = d.picks.length;
    d.hover = null; d.feat = null; d.prev = null; d.axisHint = null;
    if (info.kind === "points") d.hover = bestCand(p, e, { cyc: true, from: n === 1 ? d.picks[0].a : null });
    else if (info.kind === "near") d.feat = M.pickFeature(p, function (f) { return n === 0 || f.id !== d.picks[0].id; });
    else if (info.kind === "span") {
      if (n === 0) d.feat = M.pickFeature(p, function (f) { return !!f.guide; });
      else { d.hover = bestCand(p, e, { only: d.picks[0].id, cyc: true }); }
    } else if (info.kind === "ray") {
      if (n === 0) d.hover = bestCand(p, e, { cyc: true });
      else if (d.type === "raya" && n === 1) { var A = anchorPoint(d.picks[0].a, featMap()); if (A) d.axisHint = axisFrom(A, p); }
      else d.feat = M.pickFeature(p, function (f) { return !(d.picks[0].a && f.id === d.picks[0].a.f); });
    }
    var m = draft(d, p, e);
    if (m) { var r = M.resolve(m); d.prev = r.ok ? r : null; d.prevM = m; }
    C().renderStage();
  };
  function finish(m) {
    var core = C(), st = core.state();
    st.measures = st.measures || [];
    m.id = core.nextId("m", st.measures); m.off = 0; m.name = "";
    st.measures.push(m);
    ui().selMeasure = m.id;
    var d = ui().dim; if (d) { d.picks = []; d.hover = null; d.prev = null; d.feat = null; core.say("Added. Click to add another, or press Esc."); }
    core.renderPanels(); core.renderStage(); core.save();
  }
  M.click = function (p, e) {
    var d = ui().dim; if (!d) return false;
    M.move(p, e);
    var info = typeInfo(d.type), n = d.picks.length, core = C();
    if (info.kind === "points") {
      if (!d.hover) return true;
      d.picks.push(d.hover);
      if (d.picks.length === 2) { finish({ kind: "points", mode: info.mode, a: d.picks[0].a, b: d.picks[1].a }); return true; }
    } else if (info.kind === "near") {
      if (!d.feat) { core.say("Click on a line or a text."); return true; }
      d.picks.push(d.feat);
      if (d.picks.length === 2) { finish({ kind: "near", f1: d.picks[0].id, f2: d.picks[1].id }); return true; }
    } else if (info.kind === "span") {
      if (n === 0) { if (!d.feat) { core.say("Click on a guide."); return true; } d.picks.push(d.feat); }
      else {
        if (!d.hover || d.hover.a.t !== "cross") { core.say("Click on a crossing of the guide with another line."); return true; }
        d.picks.push(d.hover);
        if (d.picks.length === 3) { finish({ kind: "span", guide: d.picks[0].id.slice(2), a: d.picks[1].a, b: d.picks[2].a }); return true; }
      }
    } else if (info.kind === "ray") {
      if (n === 0) { if (!d.hover) return true; d.picks.push(d.hover); }
      else if (d.type === "raya" && n === 1) {
        var A = anchorPoint(d.picks[0].a, featMap()); if (!A) return true;
        d.picks.push({ axis: axisFrom(A, p) });
      } else {
        if (!d.feat) { core.say("Click on the line the ray should reach."); return true; }
        var dir = rayDirFor(d);
        if (!dir) { core.say("There is no table to point towards."); return true; }
        var m = { kind: "ray", a: d.picks[0].a, dir: dir, target: d.feat.id };
        if (!M.resolve(m).ok) { core.say("The ray does not reach that line."); return true; }
        finish(m); return true;
      }
    }
    core.say((HINT[d.type][d.picks.length] || "") + ". Esc cancels.");
    core.renderStage();
    return true;
  };

  M.renderGhost = function (g, ctx) {
    var core = C(), d = core.ui.dim, el = core.el, z = ctx.z;
    if (core.ui.endDrag) {
      var ed = core.ui.endDrag;
      el("circle", { cx: ed.x, cy: ed.y, r: 6 / z, fill: "none", stroke: COL_GHOST, "stroke-width": 2, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
      var et = el("text", { x: ed.x + 10 / z, y: ed.y - 10 / z, "font-size": 11 / z, fill: COL_GHOST, "pointer-events": "none" }, g);
      et.style.fontFamily = "'Josefin Sans', sans-serif"; et.textContent = ed.kind === "free" ? "free point" : ed.kind + ": " + ed.label;
    }
    if (core.ui.tool === "measure" && core.ui.tempHover && core.ui.tempHover.kind !== "free") {
      var th = core.ui.tempHover;
      el("circle", { cx: th.x, cy: th.y, r: 6 / z, fill: "none", stroke: COL_GHOST, "stroke-width": 2, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
      var tt = el("text", { x: th.x + 10 / z, y: th.y - 10 / z, "font-size": 11 / z, fill: COL_GHOST, "pointer-events": "none" }, g);
      tt.style.fontFamily = "'Josefin Sans', sans-serif"; tt.textContent = th.kind + ": " + th.label;
    }
    if (core.ui.tool !== "dim" || !d) return;
    function hi(f) {
      if (!f) return;
      if (f.guide) { var big = 1e5; el("line", f.guide.axis === "x" ? { x1: f.guide.v, y1: -big, x2: f.guide.v, y2: big, stroke: COL_GHOST, "stroke-width": 4, opacity: 0.45, "vector-effect": "non-scaling-stroke", "pointer-events": "none" } : { x1: -big, y1: f.guide.v, x2: big, y2: f.guide.v, stroke: COL_GHOST, "stroke-width": 4, opacity: 0.45, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g); return; }
      f.rings.forEach(function (r) { el("path", { d: "M" + r.pts.map(function (q) { return q[0] + " " + q[1]; }).join("L") + (r.closed ? "Z" : ""), fill: "none", stroke: COL_GHOST, "stroke-width": 4, opacity: 0.45, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g); });
    }
    var fm = featMap();
    d.picks.forEach(function (pk) {
      if (pk.rings || pk.guide) hi(pk);
      else if (pk.id && fm[pk.id]) hi(fm[pk.id]);
      else if (pk.a) { var q = anchorPoint(pk.a, fm); if (q) el("circle", { cx: q[0], cy: q[1], r: 5 / z, fill: COL_GHOST, "pointer-events": "none" }, g); }
    });
    d.picks.forEach(function (pk) { if (pk.id && fm[pk.id]) hi(fm[pk.id]); });
    if (d.feat) hi(d.feat);
    var h = d.hover;
    if (h) {
      el("circle", { cx: h.x, cy: h.y, r: 6 / z, fill: "none", stroke: COL_GHOST, "stroke-width": 2, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
      var t = el("text", { x: h.x + 10 / z, y: h.y - 10 / z, "font-size": 11 / z, fill: COL_GHOST, "pointer-events": "none" }, g);
      t.style.fontFamily = "'Josefin Sans', sans-serif"; t.textContent = h.kind === "free" ? "free point" : h.kind + ": " + h.label;
    }
    if (d.axisHint) {
      var A = anchorPoint(d.picks[0].a, fm);
      if (A) { var v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d.axisHint]; el("line", { x1: A[0], y1: A[1], x2: A[0] + v[0] * 80 / z, y2: A[1] + v[1] * 80 / z, stroke: COL_GHOST, "stroke-width": 2, "stroke-dasharray": "5 4", "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g); }
    }
    if (d.prev) drawMeasure(g, d.prev, { z: z, ghost: true });
  };

  /* ---------- dragging the dimension line sideways ---------- */
  M.pointerDown = function (e, h, p) {
    var core = C(), parts = h.split(":"), id = parts[1], end = parts[2], st = core.state(), m = (st.measures || []).filter(function (x) { return x.id === id; })[0];
    if (!m) return false;
    var was = core.ui.selMeasure === id;
    core.ui.selMeasure = id;
    var moved = false, res0 = M.resolve(m);
    if (!res0.ok) { core.renderPanels(); core.renderStage(); return true; }
    var refKey = end === "b" && m.kind === "ray" ? "tref" : (m.kind === "near" && end ? (end === "a" ? "r1" : "r2") : null);
    var refFeat = refKey ? featMap()[refKey === "tref" ? m.target : refKey === "r1" ? m.f1 : m.f2] : null;
    if (refKey && refFeat && refFeat.thick) {
      /* the end lies on a thick line: dragging chooses its centre, inner edge or outer edge, whichever is nearest to the pointer */
      var oldRef = m[refKey] || "centre";
      core.startDrag(e, {
        move: function (q) {
          var best = null;
          ["centre", "in", "out"].forEach(function (w) {
            var r = M.resolve(Object.assign({}, m, (function () { var o = {}; o[refKey] = w; return o; })()));
            if (!r.ok) return;
            var pt = end === "a" ? r.A : r.B, d = Math.hypot(pt[0] - q.x, pt[1] - q.y);
            if (!best || d < best.d) best = { d: d, w: w, pt: pt };
          });
          if (best) { m[refKey] = best.w; moved = true; core.ui.endDrag = { x: best.pt[0], y: best.pt[1], kind: best.w === "centre" ? "line centre" : best.w === "in" ? "inner edge" : "outer edge", label: refFeat.label }; }
          core.renderStage();
        },
        up: function () { core.ui.endDrag = null; core.renderPanels(); core.renderStage(); if (moved && (m[refKey] || "centre") !== oldRef) core.save("measref:" + id); }
      });
      return true;
    }
    if (end && (m.kind === "points" || m.kind === "span" || (m.kind === "ray" && end === "a"))) {
      /* dragging an end point attaches it to another snap point (centre or edge of a line, node, crossing ...) */
      var old = JSON.stringify(m[end]);
      core.startDrag(e, {
        move: function (q, ev) {
          var c = bestCand(q, ev, m.kind === "span" ? { only: "g:" + m.guide } : null);
          if (c) { m[end] = c.a; core.ui.endDrag = c; moved = true; }
          core.renderStage();
        },
        up: function () {
          core.ui.endDrag = null; core.renderPanels(); core.renderStage();
          if (moved && JSON.stringify(m[end]) !== old) core.save("measend:" + id);
        }
      });
      return true;
    }
    if (!was) core.renderPanels();
    var o0 = Number(m.off) || 0, base = M.resolve(Object.assign({}, m, { off: 0 }));
    core.startDrag(e, {
      move: function (q) {
        var r = base, nn = r.n, v = [q.x - r.P[0], q.y - r.P[1]];
        m.off = Math.round((v[0] * nn[0] + v[1] * nn[1]) * 10) / 10; moved = true;
        core.renderStage();
      },
      up: function () { core.renderPanels(); core.renderStage(); if (moved && m.off !== o0) core.save("meas:" + id); }
    });
    core.renderStage();
    return true;
  };
  /* Delete key: removes the selected measurement. */
  M.removeSelected = function () {
    var core = C(), id = core.ui.selMeasure; if (!id) return false;
    core.state().measures = (core.state().measures || []).filter(function (m) { return m.id !== id; });
    core.ui.selMeasure = null; core.renderPanels(); core.renderStage(); core.save(); return true;
  };

  /* ---------- panel ---------- */
  function isLineAnchor(a) { return a && ((a.t === "bedge") || (a.t === "boff") || (a.t === "along" && (String(a.f).indexOf("band:") === 0 || /:bet$/.test(String(a.f))))); }
  function refSelects(m, fm) {
    var out = "";
    var line = function (key, label, fid) {
      var f = fm && fm[fid]; if (!f || !f.thick) return;
      out += '<label class="fld"><span>' + label + '</span><select data-scope="mref:' + m.id + ':' + key + '" data-key="w"><option value="centre">Line centre</option><option value="in">Inner edge</option><option value="out">Outer edge</option></select></label>';
    };
    if (m.kind === "ray") line("tref", "Target line: measure to its", m.target);
    if (m.kind === "near") { line("r1", "First line: measure to its", m.f1); line("r2", "Second line: measure to its", m.f2); }
    ["a", "b"].forEach(function (k) {
      if (!isLineAnchor(m[k])) return;
      out += '<label class="fld"><span>End ' + k.toUpperCase() + ' on the line</span><select data-scope="mref:' + m.id + ':' + k + '" data-key="w">' +
        '<option value="centre">Line centre</option><option value="in">Inner edge</option><option value="out">Outer edge</option></select></label>';
    });
    return out;
  }
  /* A stand-in object for the select above: reading and writing `w` reads and rewrites the anchor. */
  PTD.scopes = PTD.scopes || {};
  PTD.scopes.mref = function (key) {
    var parts = String(key).split(":"), id = parts[0], k = parts[1];
    var m = (C().state().measures || []).filter(function (x) { return x.id === id; })[0];
    if (m && (k === "tref" || k === "r1" || k === "r2")) {
      return Object.defineProperty({}, "w", { get: function () { return m[k] || "centre"; }, set: function (v) { m[k] = v === "in" || v === "out" ? v : "centre"; }, enumerable: true });
    }
    if (!m || !isLineAnchor(m[k])) return null;
    return Object.defineProperty({}, "w", {
      get: function () { return m[k].t === "bedge" || m[k].t === "boff" ? m[k].w : "centre"; },
      set: function (v) { var a = m[k], ty = /:bet$/.test(a.f) ? "boff" : "bedge"; m[k] = v === "centre" ? { t: "along", f: a.f, s: a.s } : { t: ty, f: a.f, w: v, s: a.s }; },
      enumerable: true
    });
  };
  M.panelHTML = function () {
    var core = C(), st = core.state(), esc = core.esc, h = core.h, list = st.measures || [];
    var out = '<h3 class="sec">Measurements</h3>' +
      '<p class="small">A measurement is a lasting distance between two things. It follows them when they move, is saved with the project and is never cut. Pick the kind, then point at the canvas: a ghost shows what would be added and its value before you click. Snap points are named next to the marker (node, middle, centre, corner, extreme, intersection, nearest). Hold Alt or Ctrl for a free point. Click a measurement to select it: drag the number to move the dimension line sideways, drag an end point to attach it elsewhere (line centre or an edge of a thick line), press Delete to remove it. Esc cancels.</p>' +
      '<div class="btnrow">' +
      '<button class="btn" type="button" data-act="madd" data-k="points">+ Point to point</button>' +
      '<button class="btn" type="button" data-act="madd" data-k="h">+ Horizontal</button>' +
      '<button class="btn" type="button" data-act="madd" data-k="v">+ Vertical</button></div><div class="btnrow">' +
      '<button class="btn" type="button" data-act="madd" data-k="rayc">+ Ray towards table centre</button>' +
      '<button class="btn" type="button" data-act="madd" data-k="raya">+ Ray along an axis</button>' +
      '<button class="btn" type="button" data-act="madd" data-k="near">+ Shortest distance</button>' +
      '<button class="btn" type="button" data-act="madd" data-k="span">+ Along a guide</button></div>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="mexample">Generate example</button><button class="btn" type="button" data-act="mhelp" title="Open the help about measurements (F1)">Help</button></div>';
    if (!list.length) out += '<p class="small">No measurements yet.</p>';
    var fm = list.length ? featMap() : {};
    list.forEach(function (m) {
      var r = M.resolve(m, fm), sel = core.ui.selMeasure === m.id;
      var what = KIND_NAME[m.kind] + (m.kind === "points" && m.mode !== "aligned" ? (m.mode === "h" ? " (horizontal)" : " (vertical)") : "");
      out += '<div class="panel' + (sel ? " sel" : "") + '"><div class="body"><div class="row2">' +
        '<div><b>' + esc(r.ok ? core.fmtLen(r.val) : "broken") + '</b> <span class="small">' + esc(what) + (r.ok ? "" : " · " + esc(r.why)) + '</span></div>' +
        '<div class="btnrow"><button class="btn" type="button" data-act="msel" data-id="' + m.id + '">Select</button><button class="btn" type="button" data-act="mdel" data-id="' + m.id + '">Delete</button></div></div>' +
        '<label class="fld"><span>Name</span><input type="text" data-scope="meas:' + m.id + '" data-key="name" autocomplete="off"></label>' +
        h.len("Dimension line offset", "meas:" + m.id, "off") + refSelects(m, fm) + '</div></div>';
    });
    out += '<div class="row2">' + h.numField("Text outline precision (pixels per mm)", "cfg", "traceRes", "1") + '<div></div></div>' +
      '<p class="small">Text edges are found by drawing the text on a hidden canvas at this resolution and tracing the outline: about 0.1 mm at 10 pixels per mm for a 100 mm text. Frozen texts use their exact vectors. This setting is shared by all projects.</p>';
    return out;
  };
  M.act = function (act, d) {
    var core = C(), st = core.state();
    if (act === "madd") { M.start(d.k); return true; }
    if (act === "mexample") { PTD.help.randomExample(core.ui.dim && core.ui.dim.type); return true; }
    if (act === "mhelp") { PTD.help.open("measure"); return true; }
    if (act === "msel") { core.ui.selMeasure = d.id; core.renderPanels(); core.renderStage(); return true; }
    if (act === "mdel") {
      st.measures = (st.measures || []).filter(function (m) { return m.id !== d.id; });
      if (core.ui.selMeasure === d.id) core.ui.selMeasure = null;
      core.renderPanels(); core.renderStage(); core.save(); return true;
    }
    return false;
  };
  PTD.scopes = PTD.scopes || {}; PTD.onChange = PTD.onChange || {};
  PTD.scopes.meas = function (id) { return (C().state().measures || []).filter(function (m) { return m.id === id; })[0]; };
  PTD.onChange.meas = function (obj, key) { if (key === "off") obj.off = Math.round((Number(obj.off) || 0) * 10) / 10; };

  /* Normalises measurements read from a project file. Unknown or damaged entries are dropped. */
  M.normalize = function (arr) {
    var out = [], seen = {};
    (Array.isArray(arr) ? arr : []).forEach(function (m) {
      if (!m || !KIND_NAME[m.kind]) return;
      var o = JSON.parse(JSON.stringify(m));
      o.id = String(o.id || ""); if (!o.id || seen[o.id]) o.id = "m" + (out.length + 1 + Math.floor(Math.random() * 1e6));
      seen[o.id] = 1;
      o.off = Number(o.off) || 0; o.name = String(o.name || "").slice(0, 80);
      if (o.kind === "points" && ["aligned", "h", "v"].indexOf(o.mode) < 0) o.mode = "aligned";
      out.push(o);
    });
    return out;
  };
  PTD.measure = M;
})(window.PTD = window.PTD || {});
