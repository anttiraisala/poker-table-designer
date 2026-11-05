/* EPS output for Roland CutStudio.
 *
 * CutStudio cannot import SVG. Its EPS reader is very crude: it only understands the path commands
 * "x y m" (moveto), "x y l" (lineto) and "x1 y1 x2 y2 x3 y3 c" (curveto), wants closed paths closed by repeating the first
 * point with "l" (not "h"), and needs one extra "0 0 m" at the end or it skips the last line. Groups, clipping, fills,
 * transparency and text are not used; only thin outlines are written because the cutter follows lines.
 *
 * The file layout follows what the Inkscape plugin "inkscape-roland-cutstudio" (Max Gaukler, GPL-2.0-or-later,
 * https://github.com/mgmax/inkscape-roland-cutstudio) writes, because that output is known to open in CutStudio.
 * This module does NOT contain code or text copied from that plugin (this project is MIT): the template below is written
 * from scratch with the same structure (header comments, bounding box -10000..10000, a prolog that defines the short
 * operators, one stroked path, "0 0 m", the closing lines). Whether CutStudio accepts this independent template has to be
 * confirmed on a real CutStudio, see README, "EPS for Roland CutStudio".
 *
 * Input: paths in millimetres with y growing downwards (the program's own coordinates). Output: PostScript points
 * (1 pt = 25.4 / 72 mm) with y growing upwards, as PostScript wants, so the drawing is not upside down. The drawing is moved
 * so that its lower left corner is at 0 0. A later mirror (or any other change) goes through the `post` matrix. Also runs in Node. */
(function (PTD) {
  "use strict";
  var E = {};
  E.PT_PER_MM = 72 / 25.4;
  E.LIMIT_PT = 10000;          /* the fixed bounding box of the template */
  E.LINE_WIDTH_PT = 1.41732;   /* 0.5 mm; the cutter follows the centre line, the width is only a picture */

  var HEAD = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    "%%LanguageLevel: 2",
    "%%BoundingBox: -10000 -10000 10000 10000",
    "%%EndComments",
    "%%BeginSetup",
    "%%EndSetup",
    "%%BeginProlog",
    "% Short operator names used by the path below (standard PostScript, one line each).",
    "50 dict begin",
    "/q { gsave } bind def",
    "/Q { grestore } bind def",
    "/w { setlinewidth } bind def",
    "/J { setlinecap } bind def",
    "/j { setlinejoin } bind def",
    "/M { setmiterlimit } bind def",
    "/d { setdash } bind def",
    "/g { setgray } bind def",
    "/m { moveto } bind def",
    "/l { lineto } bind def",
    "/c { curveto } bind def",
    "/h { closepath } bind def",
    "/S { stroke } bind def",
    "/n { newpath } bind def",
    "%%EndProlog",
    "%%Page: 1 1",
    "%%BeginPageSetup",
    "%%PageBoundingBox: -10000 -10000 10000 10000",
    "%%EndPageSetup",
    "% Cut lines only: thin outlines, no fills, no groups, no clipping.",
    "q q",
    "0 g",
    E.LINE_WIDTH_PT + " w",
    "0 J",
    "0 j",
    "[] 0.0 d",
    "4 M q"
  ];
  var TAIL = [
    "% CutStudio skips the last line unless one more moveto follows it:",
    "0 0 m",
    "S Q",
    "Q Q",
    "showpage",
    "%%Trailer",
    "end",
    "%%EOF"
  ];
  E.HEAD = HEAD.slice(); E.TAIL = TAIL.slice();

  /* An arc as cubic Beziers. The arc runs from angle a0 through `sweep` radians (signed), centre cx cy, radius r. Each piece
   * covers at most 90 degrees, which keeps the radius error below 0.03 % (a full circle is 4 curves). Returns [[x1,y1,x2,y2,x3,y3], ...]. */
  E.arcToBeziers = function (cx, cy, r, a0, sweep) {
    var n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9)), d = sweep / n, k = 4 / 3 * Math.tan(d / 4), out = [];
    for (var i = 0; i < n; i++) {
      var s = a0 + i * d, e = s + d, c1 = Math.cos(s), s1 = Math.sin(s), c2 = Math.cos(e), s2 = Math.sin(e);
      out.push([cx + r * (c1 - k * s1), cy + r * (s1 + k * c1), cx + r * (c2 + k * s2), cy + r * (s2 - k * c2), cx + r * c2, cy + r * s2]);
    }
    return out;
  };
  /* A full circle as ops. */
  E.circle = function (cx, cy, r) { return { ops: [["M", cx + r, cy], ["A", cx, cy, r, 0, 2 * Math.PI], ["Z"]] }; };

  function fmt(v) {
    var s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, "");
    return s === "-0" || s === "" ? "0" : s;
  }
  /* paths: [{ pts: [[x, y], ...], closed }] or [{ ops: [["M", x, y], ["L", x, y], ["C", x1, y1, x2, y2, x3, y3], ["A", cx, cy, r, a0, sweep], ["Z"]] }].
   * Coordinates in mm, y down. opts: post (a 2 x 3 matrix [a, b, c, d, e, f] applied last to the points, default identity;
   * the place for a later mirror), origin ({ x, y } in mm that becomes 0 0; default: the lower left corner of the drawing).
   * Returns { text, warnings, widthMm, heightMm, bboxPt, pathCount }. */
  E.build = function (paths, opts) {
    opts = opts || {};
    var warnings = [], list = [];
    (paths || []).forEach(function (p, i) {
      var ops = p.ops;
      if (!ops) {
        var pts = (p.pts || []).filter(function (q) { return isFinite(q[0]) && isFinite(q[1]); });
        ops = pts.map(function (q, j) { return [j ? "L" : "M", q[0], q[1]]; });
        if (p.closed && ops.length) ops.push(["Z"]);
      }
      /* expand arcs, count distinct points */
      var flat = [], cur = null, start = null, distinct = 0, bad = false;
      ops.forEach(function (o) {
        if (o[0] === "M") { cur = [o[1], o[2]]; start = cur; flat.push(["M", cur[0], cur[1]]); distinct++; }
        else if (o[0] === "L") { if (!cur) { bad = true; return; } if (Math.hypot(o[1] - cur[0], o[2] - cur[1]) > 1e-9) distinct++; cur = [o[1], o[2]]; flat.push(["L", cur[0], cur[1]]); }
        else if (o[0] === "C") { if (!cur) { bad = true; return; } distinct++; cur = [o[5], o[6]]; flat.push(o.slice()); }
        else if (o[0] === "A") {
          if (!cur) { bad = true; return; }
          E.arcToBeziers(o[1], o[2], o[3], o[4], o[5]).forEach(function (c) { flat.push(["C", c[0], c[1], c[2], c[3], c[4], c[5]]); cur = [c[4], c[5]]; });
          distinct += 1;
        } else if (o[0] === "Z") { if (start) { flat.push(["Z", start[0], start[1]]); cur = start; } }
      });
      if (bad || !isFinite(distinct)) { warnings.push("Path " + (i + 1) + " was skipped: it does not start with a moveto."); return; }
      if (distinct < 2) { warnings.push("Path " + (i + 1) + " was skipped: it has only one point."); return; }
      list.push(flat);
    });
    /* bounding box in mm (control points included, a little generous for curves) */
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (flat) { flat.forEach(function (o) { for (var i = 1; i + 1 < o.length; i += 2) { if (o[0] === "Z") continue; x0 = Math.min(x0, o[i]); x1 = Math.max(x1, o[i]); y0 = Math.min(y0, o[i + 1]); y1 = Math.max(y1, o[i + 1]); } }); });
    if (!list.length) { warnings.push("There is nothing to export: no path with two or more points."); x0 = y0 = 0; x1 = y1 = 0; }
    var ox = opts.origin ? opts.origin.x : x0, oy = opts.origin ? opts.origin.y : y1, k = E.PT_PER_MM, post = opts.post || [1, 0, 0, 1, 0, 0];
    function tx(x, y) {
      var X = (x - ox) * k, Y = (oy - y) * k;   /* y flips: PostScript grows upwards */
      return [post[0] * X + post[2] * Y + post[4], post[1] * X + post[3] * Y + post[5]];
    }
    var lines = [], bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, far = false;
    function pt(x, y) { var q = tx(x, y); bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); if (Math.abs(q[0]) > E.LIMIT_PT || Math.abs(q[1]) > E.LIMIT_PT) far = true; return fmt(q[0]) + " " + fmt(q[1]); }
    list.forEach(function (flat) {
      flat.forEach(function (o) {
        if (o[0] === "M") lines.push(pt(o[1], o[2]) + " m");
        else if (o[0] === "L") lines.push(pt(o[1], o[2]) + " l");
        else if (o[0] === "C") lines.push(pt(o[1], o[2]) + " " + pt(o[3], o[4]) + " " + pt(o[5], o[6]) + " c");
        else if (o[0] === "Z") lines.push(pt(o[1], o[2]) + " l");   /* a closed path repeats its first point with lineto, never "h" */
      });
    });
    if (far) warnings.push("The drawing does not fit the fixed page of the EPS (+-10000 pt = +-3527 mm around the lower left corner). CutStudio may clip or ignore it.");
    if (!list.length) { bx0 = by0 = bx1 = by1 = 0; }
    return {
      text: HEAD.concat(lines, TAIL).join("\n") + "\n", warnings: warnings, pathCount: list.length,
      widthMm: x1 - x0, heightMm: y1 - y0, bboxPt: { x0: bx0, y0: by0, x1: bx1, y1: by1 }
    };
  };
  PTD.eps = E;
  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
