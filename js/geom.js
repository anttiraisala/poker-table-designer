/* Geometry helpers for outlines made of straight lines and circular arcs.
 *
 * An outline is a closed list of nodes {x, y, b}. Node i is joined to node i+1 (the last
 * one to the first). b is the "bulge" of the segment that starts at node i, as in CAD:
 * b = tan(theta / 4), where theta is the signed angle the arc turns through.
 * b = 0 is a straight line, b > 0 curves to the right of the travel direction and
 * |b| = 1 is a half circle. All lengths are millimetres. */
(function (PTD) {
  "use strict";
  var G = {};
  var EPS = 1e-9;

  G.dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };

  /* ---- arcs ---- */
  /* Returns {cx, cy, r, a0, sweep} for the segment p -> q with bulge b, or null for a line. */
  G.arc = function (p, q, b) {
    if (Math.abs(b) < 1e-9) return null;
    var dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    if (L < EPS) return null;
    var k = (L / 2) * (1 - b * b) / (2 * b);
    var cx = (p.x + q.x) / 2 + (-dy / L) * k, cy = (p.y + q.y) / 2 + (dx / L) * k;
    var r = L * (1 + b * b) / (4 * Math.abs(b));
    return { cx: cx, cy: cy, r: r, a0: Math.atan2(p.y - cy, p.x - cx), sweep: 4 * Math.atan(b) };
  };

  /* Points along the outline. tol is the largest allowed distance between an arc and its chords. */
  G.flatten = function (nodes, tol) {
    tol = tol || 0.25;
    var out = [], n = nodes.length;
    for (var i = 0; i < n; i++) {
      var p = nodes[i], q = nodes[(i + 1) % n];
      out.push([p.x, p.y]);
      var a = G.arc(p, q, p.b || 0);
      if (!a) continue;
      var step = 2 * Math.acos(Math.max(0, 1 - tol / a.r));
      var cnt = Math.max(2, Math.ceil(Math.abs(a.sweep) / Math.max(step, 0.01)));
      for (var k = 1; k < cnt; k++) {
        var ang = a.a0 + a.sweep * k / cnt;
        out.push([a.cx + a.r * Math.cos(ang), a.cy + a.r * Math.sin(ang)]);
      }
    }
    return out;
  };

  G.area = function (poly) {
    var s = 0;
    for (var i = 0, n = poly.length; i < n; i++) {
      var p = poly[i], q = poly[(i + 1) % n];
      s += p[0] * q[1] - q[0] * p[1];
    }
    return s / 2;
  };
  G.bbox = function (poly) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    poly.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
  };
  G.pointInPolygon = function (pt, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };

  /* ---- node list operations ---- */
  G.reverseNodes = function (nodes) {
    var n = nodes.length, out = [];
    for (var k = 0; k < n; k++) {
      var src = nodes[n - 1 - k];
      out.push({ x: src.x, y: src.y, b: -(nodes[(n - 2 - k + 2 * n) % n].b || 0) });
    }
    return out;
  };
  /* The canonical direction has a positive shoelace area. */
  G.ensureCanonical = function (nodes) {
    return G.area(G.flatten(nodes, 1)) < 0 ? G.reverseNodes(nodes) : nodes;
  };
  G.cleanNodes = function (nodes, eps) {
    eps = eps || 0.01;
    var out = nodes.map(function (n) { return { x: n.x, y: n.y, b: n.b || 0 }; });
    var changed = true;
    while (changed && out.length > 3) {
      changed = false;
      for (var i = 0; i < out.length; i++) {
        var q = out[(i + 1) % out.length];
        if (Math.hypot(out[i].x - q.x, out[i].y - q.y) < eps) {
          /* drop node i, the previous node keeps its bulge */
          out.splice(i, 1); changed = true; break;
        }
      }
    }
    return out;
  };
  G.transformNodes = function (nodes, tx, ty, rotDeg) {
    var a = (rotDeg || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return nodes.map(function (n) { return { x: n.x * c - n.y * s + tx, y: n.x * s + n.y * c + ty, b: n.b || 0 }; });
  };
  G.transformPoints = function (pts, tx, ty, rotDeg) {
    var a = (rotDeg || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return pts.map(function (p) { return [p[0] * c - p[1] * s + tx, p[0] * s + p[1] * c + ty]; });
  };
  G.mirrorNodes = function (nodes, horizontal) {
    var m = nodes.map(function (n) { return { x: horizontal ? -n.x : n.x, y: horizontal ? n.y : -n.y, b: -(n.b || 0) }; });
    return G.ensureCanonical(m);
  };
  /* Splits segment i in two. A line gets a node in the middle, an arc gets one at its apex. */
  G.splitSegment = function (nodes, i) {
    var n = nodes.length, p = nodes[i], q = nodes[(i + 1) % n], b = p.b || 0, mid, b2 = 0;
    var a = G.arc(p, q, b);
    if (!a) mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    else {
      var ang = a.a0 + a.sweep / 2;
      mid = { x: a.cx + a.r * Math.cos(ang), y: a.cy + a.r * Math.sin(ang) };
      b2 = Math.tan(a.sweep / 8);
    }
    var out = nodes.map(function (x) { return { x: x.x, y: x.y, b: x.b || 0 }; });
    out[i].b = b2;
    out.splice(i + 1, 0, { x: mid.x, y: mid.y, b: b2 });
    return out;
  };
  /* Bulge for an arc from p to q whose apex lies at point x. */
  G.bulgeFromApex = function (p, q, x) {
    var dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    if (L < EPS) return 0;
    /* right-hand normal of the travel direction */
    var nx = dy / L, ny = -dx / L;
    var s = (x.x - (p.x + q.x) / 2) * nx + (x.y - (p.y + q.y) / 2) * ny;
    return 2 * s / L;
  };
  G.apexOf = function (p, q, b) {
    var a = G.arc(p, q, b);
    if (!a) return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    var ang = a.a0 + a.sweep / 2;
    return { x: a.cx + a.r * Math.cos(ang), y: a.cy + a.r * Math.sin(ang) };
  };

  /* Points of one segment, both ends included. */
  G.segPoints = function (p, q, b, tol) {
    var a = G.arc(p, q, b || 0), pts = [[p.x, p.y]];
    if (a) {
      var step = 2 * Math.acos(Math.max(0, 1 - (tol || 0.25) / a.r));
      var cnt = Math.max(2, Math.ceil(Math.abs(a.sweep) / Math.max(step, 0.01)));
      for (var k = 1; k < cnt; k++) {
        var ang = a.a0 + a.sweep * k / cnt;
        pts.push([a.cx + a.r * Math.cos(ang), a.cy + a.r * Math.sin(ang)]);
      }
    }
    pts.push([q.x, q.y]);
    return pts;
  };
  /* The segment of the outline closest to a point: {i, d, q: [x, y]}. */
  G.nearestSegment = function (nodes, pt) {
    var best = { i: 0, d: Infinity, q: null }, n = nodes.length;
    for (var i = 0; i < n; i++) {
      var pts = G.segPoints(nodes[i], nodes[(i + 1) % n], nodes[i].b, 0.2);
      for (var k = 0; k + 1 < pts.length; k++) {
        var a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        var t = L2 ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2)) : 0;
        var q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(pt[0] - q[0], pt[1] - q[1]);
        if (d < best.d) best = { i: i, d: d, q: q };
      }
    }
    return best;
  };
  /* Inserts a node on segment i at the point of the segment closest to pt, keeping the shape. */
  G.splitAt = function (nodes, i, pt) {
    var n = nodes.length, p = nodes[i], q = nodes[(i + 1) % n], a = G.arc(p, q, p.b || 0), mid, b1 = 0, b2 = 0;
    if (!a) {
      var dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy;
      var t = L2 ? Math.max(0.02, Math.min(0.98, ((pt.x - p.x) * dx + (pt.y - p.y) * dy) / L2)) : 0.5;
      mid = { x: p.x + dx * t, y: p.y + dy * t };
    } else {
      var s = a.sweep >= 0 ? 1 : -1, total = Math.abs(a.sweep);
      var d = Math.atan2(pt.y - a.cy, pt.x - a.cx) - a.a0;
      while (s * d < 0) d += s * 2 * Math.PI;
      while (s * d >= 2 * Math.PI) d -= s * 2 * Math.PI;
      var dd = Math.abs(d);
      if (dd > total) dd = (dd - total) < (2 * Math.PI - dd) ? total : 0;
      dd = Math.min(Math.max(dd, 0.02 * total), 0.98 * total);
      var ang = a.a0 + s * dd;
      mid = { x: a.cx + a.r * Math.cos(ang), y: a.cy + a.r * Math.sin(ang) };
      b1 = Math.tan(s * dd / 4); b2 = Math.tan(s * (total - dd) / 4);
    }
    var out = nodes.map(function (x) { return { x: x.x, y: x.y, b: x.b || 0 }; });
    out[i].b = b1;
    out.splice(i + 1, 0, { x: mid.x, y: mid.y, b: b2 });
    return out;
  };

  /* SVG path data for the outline after the given placement. */
  G.svgPath = function (nodes) {
    var n = nodes.length, d = "";
    function f(v) { return Math.round(v * 1000) / 1000; }
    for (var i = 0; i < n; i++) {
      var p = nodes[i], q = nodes[(i + 1) % n];
      if (i === 0) d += "M" + f(p.x) + " " + f(p.y);
      var a = G.arc(p, q, p.b || 0);
      if (!a) d += "L" + f(q.x) + " " + f(q.y);
      else d += "A" + f(a.r) + " " + f(a.r) + " 0 " + (Math.abs(a.sweep) > Math.PI ? 1 : 0) + " " + (a.sweep > 0 ? 1 : 0) + " " + f(q.x) + " " + f(q.y);
    }
    return d + "Z";
  };
  G.polyPath = function (poly, closed) {
    function f(v) { return Math.round(v * 1000) / 1000; }
    return poly.map(function (p, i) { return (i ? "L" : "M") + f(p[0]) + " " + f(p[1]); }).join("") + (closed === false ? "" : "Z");
  };

  /* ---- intersections and offsets ---- */
  function segHit(a, b, c, d) {
    var rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
    var den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) return null;
    var t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
    var u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
    if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
    return [a[0] + t * rx, a[1] + t * ry];
  }
  /* Cuts the loops out of a self-crossing polygon and returns the simple polygons left. */
  function splitLoops(poly) {
    var result = [], work = [poly], guard = 0;
    while (work.length && guard++ < 4000) {
      var cur = work.pop(), n = cur.length, found = null;
      for (var i = 0; i < n && !found; i++) {
        var a = cur[i], b = cur[(i + 1) % n];
        for (var j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          var h = segHit(a, b, cur[j], cur[(j + 1) % n]);
          if (h) { found = { i: i, j: j, p: h }; break; }
        }
      }
      if (!found) { result.push(cur); continue; }
      var loopA = [found.p].concat(cur.slice(found.i + 1, found.j + 1));
      var loopB = cur.slice(0, found.i + 1).concat([found.p], cur.slice(found.j + 1));
      work.push(loopA, loopB);
    }
    return result;
  }
  /* Offsets a closed polygon with a positive shoelace area. d > 0 grows it, d < 0 shrinks it.
   * Corners that open up get round joins. Returns a polygon, or [] when nothing is left. */
  G.offsetPolygon = function (poly, d, tol) {
    tol = tol || 0.25;
    var n = poly.length;
    if (!n) return [];
    if (Math.abs(d) < 1e-9) return poly.slice();
    var pts = [];
    function unit(a, b) { var x = b[0] - a[0], y = b[1] - a[1], L = Math.hypot(x, y) || 1; return [x / L, y / L]; }
    for (var i = 0; i < n; i++) {
      var p = poly[i], e0 = unit(poly[(i - 1 + n) % n], p), e1 = unit(p, poly[(i + 1) % n]);
      var n0 = [e0[1], -e0[0]], n1 = [e1[1], -e1[0]];
      var cross = e0[0] * e1[1] - e0[1] * e1[0];
      if (cross * d > 1e-12) {
        var phi = Math.atan2(cross, e0[0] * e1[0] + e0[1] * e1[1]);
        var a0 = Math.atan2(n0[1] * Math.sign(d), n0[0] * Math.sign(d));
        var rr = Math.abs(d), step = 2 * Math.acos(Math.max(0, 1 - tol / rr));
        var cnt = Math.max(1, Math.ceil(Math.abs(phi) / Math.max(step, 0.02)));
        for (var k = 0; k <= cnt; k++) {
          var ang = a0 + phi * k / cnt;
          pts.push([p[0] + rr * Math.cos(ang), p[1] + rr * Math.sin(ang)]);
        }
      } else {
        pts.push([p[0] + n0[0] * d, p[1] + n0[1] * d], [p[0] + n1[0] * d, p[1] + n1[1] * d]);
      }
    }
    var clean = [];
    pts.forEach(function (q) {
      var last = clean[clean.length - 1];
      if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-6) clean.push(q);
    });
    var sign = G.area(poly) >= 0 ? 1 : -1;
    var best = null, bestA = 0;
    splitLoops(clean).forEach(function (loop) {
      var a = G.area(loop) * sign;
      if (a > bestA) { bestA = a; best = loop; }
    });
    return best || [];
  };
  /* Edge-to-edge offset for an open polyline, using averaged normals. Positive d is to the right of travel. */
  G.offsetOpen = function (line, d) {
    var n = line.length, out = [];
    for (var i = 0; i < n; i++) {
      var a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
      var x = b[0] - a[0], y = b[1] - a[1], L = Math.hypot(x, y) || 1;
      out.push([line[i][0] + (y / L) * d, line[i][1] - (x / L) * d]);
    }
    return out;
  };

  /* Triangles between two loops with the same direction, joined by walking both at once. */
  G.zipper = function (outer, inner) {
    var m = outer.length, n = inner.length, start = 0, best = Infinity;
    for (var j = 0; j < n; j++) { var dd = G.dist(outer[0], inner[j]); if (dd < best) { best = dd; start = j; } }
    var tris = [], i = 0, k = 0;
    while (i < m || k < n) {
      var oi = i % m, ok = (i + 1) % m, ik = (start + k) % n, ik2 = (start + k + 1) % n;
      var advO = i < m, advI = k < n;
      if (advO && advI) {
        if (G.dist(outer[ok], inner[ik]) <= G.dist(outer[oi], inner[ik2])) advI = false; else advO = false;
      }
      if (advO) { tris.push([oi, ok, m + ik]); i++; } else { tris.push([oi, m + ik2, m + ik]); k++; }
    }
    return tris;
  };

  /* ---- shapes ---- */
  /* Rounds the corners of a polygon. radii[i] is the radius at vertex i; segBulges[i] overrides the
   * bulge of the edge that starts at vertex i (only where the adjoining corners are not rounded). */
  G.roundPolygon = function (pts, radii, segBulges) {
    var n = pts.length, out = [], i;
    var len = [], u = [], phi = [], tl = [];
    for (i = 0; i < n; i++) {
      var q = pts[(i + 1) % n];
      len[i] = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]);
      u[i] = [(q[0] - pts[i][0]) / len[i], (q[1] - pts[i][1]) / len[i]];
    }
    for (i = 0; i < n; i++) {
      var a = u[(i - 1 + n) % n], b = u[i];
      phi[i] = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
      var r = radii ? (radii[i] || 0) : 0;
      tl[i] = (r > 1e-9 && Math.abs(phi[i]) > 1e-6) ? r * Math.tan(Math.abs(phi[i]) / 2) : 0;
    }
    /* two corners may not use more than the edge between them: shrink both in proportion */
    for (var pass = 0; pass < 8; pass++) {
      for (i = 0; i < n; i++) {
        var j = (i + 1) % n, sum = tl[i] + tl[j];
        if (sum > len[i] + 1e-9) { var f = len[i] / sum; tl[i] *= f; tl[j] *= f; }
      }
    }
    for (i = 0; i < n; i++) {
      var p = pts[i], seg = segBulges && segBulges[i] ? segBulges[i] : 0, t = tl[i];
      if (t <= 1e-9) { out.push({ x: p[0], y: p[1], b: seg }); continue; }
      var u0 = u[(i - 1 + n) % n], u1 = u[i];
      out.push({ x: p[0] - u0[0] * t, y: p[1] - u0[1] * t, b: Math.tan(phi[i] / 4) });
      out.push({ x: p[0] + u1[0] * t, y: p[1] + u1[1] * t, b: seg });
    }
    return out;
  };

  /* Builds the nodes of a table preset.
   * p: {type: rect|stadium|octagon|circle, w, h, r, chamfer,
   *     notch: {on, style: box|scoop, side: top|right|bottom|left, w, d, r, rm}} */
  G.preset = function (p) {
    var w = Math.max(10, +p.w || 2400), h = Math.max(10, +p.h || 1200), nodes;
    if (p.type === "circle") {
      var rr = Math.min(w, h) / 2;
      return G.ensureCanonical([{ x: -rr, y: 0, b: 1 }, { x: rr, y: 0, b: 1 }]);
    }
    var r = p.type === "stadium" ? Math.min(w, h) / 2 : Math.max(0, Math.min(+p.r || 0, Math.min(w, h) / 2));
    var c = p.type === "octagon" ? Math.max(1, Math.min(+p.chamfer || 200, Math.min(w, h) / 2 - 1)) : 0;
    var hw = w / 2, hh = h / 2;
    var corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    var sides = ["top", "right", "bottom", "left"];
    var pts = [], radii = [], bulges = [];
    var nt = p.notch && p.notch.on ? p.notch : null;
    corners.forEach(function (cn, ci) {
      var next = corners[(ci + 1) % 4];
      if (c) {
        /* chamfered corner: two vertices instead of one */
        var prev = corners[(ci + 3) % 4];
        var d0 = [(cn[0] - prev[0]) / Math.hypot(cn[0] - prev[0], cn[1] - prev[1]), (cn[1] - prev[1]) / Math.hypot(cn[0] - prev[0], cn[1] - prev[1])];
        var d1 = [(next[0] - cn[0]) / Math.hypot(next[0] - cn[0], next[1] - cn[1]), (next[1] - cn[1]) / Math.hypot(next[0] - cn[0], next[1] - cn[1])];
        pts.push([cn[0] - d0[0] * c, cn[1] - d0[1] * c], [cn[0] + d1[0] * c, cn[1] + d1[1] * c]);
        radii.push(0, 0); bulges.push(0, 0);
      } else { pts.push(cn); radii.push(r); bulges.push(0); }
      if (nt && nt.side === sides[ci]) {
        var e = [next[0] - cn[0], next[1] - cn[1]], L = Math.hypot(e[0], e[1]);
        e = [e[0] / L, e[1] / L];
        var inw = [-e[1], e[0]], mid = [(cn[0] + next[0]) / 2, (cn[1] + next[1]) / 2];
        var nw = Math.max(1, Math.min(+nt.w || 600, L - 2)), nd = Math.max(1, +nt.d || 150);
        var m1 = [mid[0] - e[0] * nw / 2, mid[1] - e[1] * nw / 2], m2 = [mid[0] + e[0] * nw / 2, mid[1] + e[1] * nw / 2];
        if (nt.style === "scoop") {
          pts.push(m1, m2); radii.push(0, 0); bulges.push(-2 * nd / nw, 0);
          /* the edge from the previous vertex ends at m1, the scoop runs m1 -> m2 */
        } else {
          pts.push(m1, [m1[0] + inw[0] * nd, m1[1] + inw[1] * nd], [m2[0] + inw[0] * nd, m2[1] + inw[1] * nd], m2);
          radii.push(+nt.rm || 0, +nt.r || 0, +nt.r || 0, +nt.rm || 0); bulges.push(0, 0, 0, 0);
        }
      }
    });
    nodes = G.roundPolygon(pts, radii, bulges);
    return G.ensureCanonical(G.cleanNodes(nodes));
  };

  /* Closest distance from a point to the flattened outline, with the segment index it lies on. */
  G.nearestOnPoly = function (poly, pt) {
    var best = { d: Infinity, i: 0, q: null };
    for (var i = 0, n = poly.length; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      var t = L2 ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2)) : 0;
      var q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(pt[0] - q[0], pt[1] - q[1]);
      if (d < best.d) best = { d: d, i: i, q: q };
    }
    return best;
  };
  G.polyLength = function (poly, closed) {
    var s = 0, n = poly.length;
    for (var i = 0; i < n - (closed ? 0 : 1); i++) s += G.dist(poly[i], poly[(i + 1) % n]);
    return s;
  };

  PTD.geom = G;
  if (typeof module !== "undefined") module.exports = G;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
