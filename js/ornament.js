/* The Ornament generator: a stepped Art Deco ornament that sits in the corners of a path (a table outline), or at even places along a path that has
 * no corners (a round table, a ring). No browser parts: tested with Node.
 *
 * Every ornament lives in a corner frame: V is the corner, e1 runs along the incoming edge back from V, e2 along the outgoing edge, theta is the angle
 * between them (90 degrees in a rectangle). A design point (p, q) is V + p * e1 + q * e2. All the distances between parallel lines (the offsets from
 * the edges, the gap between the lines of a band, the width and height of a step, the size of a frame) are divided by sin(theta), so in a corner that
 * is not square the same design turns into rhombuses (diamonds) and the gaps between the lines stay what they are; lengths along an edge (the arms) are
 * not. Elements, all drawn as thin lines and merged into one shape:
 *   - the stair band: arm 1 runs along edge 1, then `steps` steps lead across to arm 2 along edge 2; the band is `lines` parallel lines;
 *   - `frames`: nested rectangles (rhombuses) whose corner and size change by a fixed step from one to the next; the sides can run past the corners;
 *   - roundness 0 to 1 rounds every bend: 1 is the biggest round that fits; the lines of a band are concentric.
 * The picture the maintainer showed (a table corner with a stair band and two nested frames) is the default setting of every parameter. */
(function (PTD) {
  "use strict";
  var P = typeof window !== "undefined" ? PTD.paths : require("./paths.js");
  var O = {}, H = P._h, RAD = Math.PI / 180, warn = "";
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  O.takeWarn = function () { var w = warn; warn = ""; return w; };

  /* ---------- plain geometry ---------- */
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  /* A polyline moved sideways by d (to the right of the walking direction, y down); a vertex is where the neighbouring moved lines meet (a mitre). */
  function offsetPoly(pts, d, closed) {
    var n = pts.length, out = [], i, segs = [];
    var m = closed ? n : n - 1;
    for (i = 0; i < m; i++) {
      var a = pts[i], b = pts[(i + 1) % n], l = dist(a, b) || 1, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
      segs.push({ a: [a[0] - ty * d, a[1] + tx * d], t: [tx, ty] });
    }
    function meet(s0, s1, fallback) {
      var cr = s0.t[0] * s1.t[1] - s0.t[1] * s1.t[0];
      if (Math.abs(cr) < 1e-9) return fallback;
      var dx = s1.a[0] - s0.a[0], dy = s1.a[1] - s0.a[1], u = (dx * s1.t[1] - dy * s1.t[0]) / cr;
      return [s0.a[0] + s0.t[0] * u, s0.a[1] + s0.t[1] * u];
    }
    for (i = 0; i < n; i++) {
      if (!closed && i === 0) out.push(segs[0].a);
      else if (!closed && i === n - 1) { var s = segs[m - 1]; out.push([s.a[0] + s.t[0] * dist(pts[n - 2], pts[n - 1]), s.a[1] + s.t[1] * dist(pts[n - 2], pts[n - 1])]); }
      else out.push(meet(segs[(i - 1 + m) % m], segs[i % m], [pts[i][0] - segs[i % m].t[1] * d, pts[i][1] + segs[i % m].t[0] * d]));
    }
    return out;
  }
  /* Rounds the bends of a polyline: radii[i] is the radius at vertex i (0 leaves it sharp). The radius is cut down to what the neighbouring lengths allow. */
  function fillet(pts, radii, closed) {
    var n = pts.length, out = [], i;
    for (i = 0; i < n; i++) {
      var V = pts[i], r = radii[i] || 0;
      if ((!closed && (i === 0 || i === n - 1)) || r <= 1e-6) { out.push(V); continue; }
      var A = pts[(i - 1 + n) % n], B = pts[(i + 1) % n], la = dist(V, A), lb = dist(V, B);
      if (la < 1e-9 || lb < 1e-9) { out.push(V); continue; }
      var ux = (A[0] - V[0]) / la, uy = (A[1] - V[1]) / la, wx = (B[0] - V[0]) / lb, wy = (B[1] - V[1]) / lb;
      var cos = clamp(ux * wx + uy * wy, -1, 1), ang = Math.acos(cos);
      if (ang < 1e-3 || ang > Math.PI - 1e-3) { out.push(V); continue; }
      var half = ang / 2, tn = Math.tan(half), lim = Math.min(la, lb) / 2;
      var rr = Math.min(r, lim * tn), d = rr / tn;
      var T1 = [V[0] + ux * d, V[1] + uy * d], T2 = [V[0] + wx * d, V[1] + wy * d];
      var bx = ux + wx, by = uy + wy, bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      var cd = rr / Math.sin(half), C = [V[0] + bx * cd, V[1] + by * cd];
      var a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]), a2 = Math.atan2(T2[1] - C[1], T2[0] - C[0]), da = a2 - a1;
      while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      var k = Math.max(2, Math.ceil(Math.abs(da) / (4 * RAD))), j;
      for (j = 0; j <= k; j++) { var aa = a1 + da * j / k; out.push([C[0] + rr * Math.cos(aa), C[1] + rr * Math.sin(aa)]); }
    }
    return out;
  }
  /* A polyline as thin ink: mitred corners, flat ends. */
  function stroke(pts, w, closed) {
    var C = H.clip(), K = H.toInt([[1, 0]])[0].X, co = new C.ClipperOffset(3, 0.02 * K), sol = [];
    if (pts.length < 2 || w <= 0) return [];
    co.AddPath(H.toInt(pts), C.JoinType.jtMiter, closed ? C.EndType.etClosedLine : C.EndType.etOpenButt);
    co.Execute(sol, w / 2 * K);
    return sol;
  }

  /* ---------- the parameters ---------- */
  O.defaults = function () {
    return {
      where: "auto", kind: "convex", minTurn: 25, count: 4, phase: 0, sside: "inside", sang: 90,
      rib: true, lines: 2, gap: 10, thick: 1.5, oa: 18, ob: 30, steps: 1, sw: 75, sh: 70, arm: 120,
      frames: 2, fp: 35, fq: 26, fh: 50, fw: 54, fdp: 37.5, fdq: 39, fdh: -17.5, fdw: -21.5, flines: 1, fgap: 6, fover: 8,
      round: 0
    };
  };
  O.norm = function (o) {
    var g = Object.assign(O.defaults(), o || {});
    g.where = ["auto", "corners", "spaced"].indexOf(g.where) >= 0 ? g.where : "auto"; g.kind = ["convex", "concave", "both"].indexOf(g.kind) >= 0 ? g.kind : "convex";
    g.minTurn = clamp(num(g.minTurn, 25), 1, 170); g.count = Math.max(1, Math.round(num(g.count, 4))); g.phase = num(g.phase, 0);
    g.sside = ["inside", "outside", "left", "right"].indexOf(g.sside) >= 0 ? g.sside : "inside"; g.sang = clamp(num(g.sang, 90), 15, 165);
    g.rib = !!g.rib; g.lines = clamp(Math.round(num(g.lines, 2)), 1, 8); g.gap = Math.max(0.2, num(g.gap, 10)); g.thick = Math.max(0.2, num(g.thick, 1.5));
    g.oa = Math.max(0, num(g.oa, 18)); g.ob = Math.max(0, num(g.ob, 30)); g.steps = clamp(Math.round(num(g.steps, 1)), 0, 10);
    g.sw = Math.max(0.5, num(g.sw, 75)); g.sh = Math.max(0.5, num(g.sh, 70)); g.arm = Math.max(1, num(g.arm, 120));
    g.frames = clamp(Math.round(num(g.frames, 2)), 0, 10);
    ["fp", "fq", "fdp", "fdq", "fdh", "fdw"].forEach(function (k) { g[k] = num(g[k], O.defaults()[k]); });
    g.fh = Math.max(0.5, num(g.fh, 50)); g.fw = Math.max(0.5, num(g.fw, 54)); g.flines = clamp(Math.round(num(g.flines, 1)), 1, 8); g.fgap = Math.max(0.2, num(g.fgap, 6)); g.fover = Math.max(0, num(g.fover, 8));
    g.round = clamp(num(g.round, 0), 0, 1);
    return g;
  };

  /* ---------- where the ornaments go ---------- */
  function cornerFrames(sm, g, flip) {
    var segs = sm.segs, n = segs.length, out = [];
    for (var i = 0; i < n; i++) {
      if (!sm.closed && i === 0) continue;
      var a = segs[(i - 1 + n) % n], b = segs[i], cr = a.tx * b.ty - a.ty * b.tx, dt = a.tx * b.tx + a.ty * b.ty;
      var turn = Math.abs(Math.atan2(cr, dt)) / RAD;
      if (turn <= g.minTurn) continue;
      if (sm.closed && g.kind !== "both") {   /* a clockwise loop turns right at its convex corners (a reversed one turns left) */
        var convex = (flip ? -cr : cr) > 0;
        if ((g.kind === "convex") !== convex) continue;
      }
      out.push({ V: b.a, e1: [-a.tx, -a.ty], e2: [b.tx, b.ty] });
    }
    return out;
  }
  function spacedFrames(sm, g) {
    var out = [], L = sm.L;
    for (var k = 0; k < g.count; k++) {
      var u = (k + g.phase) / g.count * L;
      if (sm.closed) u = ((u % L) + L) % L; else u = clamp(u, 0, L);
      var f = P.frameAt(sm, u), t = [f.tx, f.ty], nrm = g.sside === "outside" || g.sside === "left" ? [t[1], -t[0]] : [-t[1], t[0]];
      var e1 = [-t[0], -t[1]], c = Math.cos(g.sang * RAD), s = Math.sin(g.sang * RAD);
      out.push({ V: [f.x, f.y], e1: e1, e2: [c * e1[0] + s * nrm[0], c * e1[1] + s * nrm[1]] });
    }
    return out;
  }

  /* ---------- one ornament ---------- */
  function buildOne(fr, g, acc) {
    var V = fr.V, e1 = fr.e1, e2 = fr.e2, cth = clamp(e1[0] * e2[0] + e1[1] * e2[1], -1, 1), sth = clamp(Math.sqrt(1 - cth * cth), 0.2, 1);
    function W(p, q) { return [V[0] + p * e1[0] + q * e2[0], V[1] + p * e1[1] + q * e2[1]]; }
    function D(x) { return x / sth; }   /* a distance between parallel lines, in design units */
    /* the lines of one element: centre line (design points) -> parallel lines (world points) with roundness */
    function rails(centre, closed, nLines, gap) {
      var out = [], wc = centre.map(function (q) { return W(q[0], q[1]); }), n = centre.length, j;
      var lens = []; for (j = 0; j < n; j++) lens.push(dist(wc[j], wc[(j + 1) % n]));
      var Rc = wc.map(function (v, i) {
        if (!g.round) return 0;
        if (!closed && (i === 0 || i === n - 1)) return 0;
        var la = lens[(i - 1 + n) % n], lb = lens[i];
        return g.round * Math.min(la, lb) / 2;
      });
      for (j = 0; j < nLines; j++) {
        var del = (j - (nLines - 1) / 2) * gap, dp = offsetPoly(centre, D(del), closed), wp = dp.map(function (q) { return W(q[0], q[1]); });
        var radii = wp.map(function (v, i) {
          if (!Rc[i]) return 0;
          var A = wc[(i - 1 + n) % n], B = wc[(i + 1) % n], C0 = wc[i];
          var ux = A[0] - C0[0], uy = A[1] - C0[1], wx = B[0] - C0[0], wy = B[1] - C0[1], lu = Math.hypot(ux, uy) || 1, lw = Math.hypot(wx, wy) || 1;
          var bx = ux / lu + wx / lw, by = uy / lu + wy / lw;
          var outer = (v[0] - C0[0]) * bx + (v[1] - C0[1]) * by < 0;
          return Math.max(0, Rc[i] + (outer ? 1 : -1) * Math.abs(del));
        });
        out.push({ pts: g.round ? fillet(wp, radii, closed) : wp, closed: closed });
      }
      return out;
    }
    function ink(list) { list.forEach(function (l) { acc.push.apply(acc, stroke(l.pts, g.thick, l.closed)); }); }
    /* the stair band */
    if (g.rib) {
      var oa = D(g.oa), ob = D(g.ob), sw = D(g.sw), sh = D(g.sh), n = g.steps, c = [[g.arm, oa]];
      c.push([ob + n * sh, oa]);
      for (var i = 1; i <= n; i++) { c.push([ob + (n - i + 1) * sh, oa + i * sw]); c.push([ob + (n - i) * sh, oa + i * sw]); }
      c.push([ob, oa + n * sw + g.arm]);
      c = c.filter(function (q, k) { return k === 0 || Math.hypot(q[0] - c[k - 1][0], q[1] - c[k - 1][1]) > 1e-9; });
      ink(rails(c, false, g.lines, g.gap));
    }
    /* the nested frames: rectangles (rhombuses) that step along and change size */
    for (var f = 0; f < g.frames; f++) {
      var p0 = D(g.fp + f * g.fdp), q0 = D(g.fq + f * g.fdq), hh = g.fh + f * g.fdh, ww = g.fw + f * g.fdw;
      if (hh < 0.5 || ww < 0.5) continue;
      var h2 = D(hh), w2 = D(ww), rect = [[p0, q0], [p0, q0 + w2], [p0 + h2, q0 + w2], [p0 + h2, q0]];
      var rs = rails(rect, true, g.flines, g.fgap);
      if (g.fover > 0 && !g.round) {   /* the sides run past the corners */
        rs.forEach(function (l) {
          var pts = l.pts, m = pts.length;
          for (var s = 0; s < m; s++) {
            var a = pts[s], b = pts[(s + 1) % m], len = dist(a, b) || 1, tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
            acc.push.apply(acc, stroke([[a[0] - tx * g.fover, a[1] - ty * g.fover], [b[0] + tx * g.fover, b[1] + ty * g.fover]], g.thick, false));
          }
        });
      } else ink(rs);
    }
  }

  /* One loop of a path. Returns Clipper integer paths (the shape). */
  O.onLoop = function (sm, g, flip) {
    var frames = [], corners = cornerFrames(sm, g, flip), spaced = false;
    if (g.where === "corners" || (g.where === "auto" && corners.length)) frames = corners;
    else { frames = spacedFrames(sm, g); spaced = true; }
    if (!frames.length) { warn = "There is no corner in the path; set Where to Evenly spaced (or Automatic) to place the ornaments at even distances."; return []; }
    var acc = [];
    frames.forEach(function (fr) { buildOne(fr, g, acc); });
    if (!acc.length) return [];
    return H.unionPaths(acc, false);
  };
  P.ornament = O;
  if (typeof module !== "undefined" && module.exports) module.exports = O;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
