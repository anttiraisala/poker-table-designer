/* Calibration maths: from the measured sizes of the cut test strips to a scale correction and the blade offset (kerf).
 * Pure functions, no page needed (also runs in Node, see tests/calfit.test.js).
 *
 * The strip (see calibration.js): a bar of length L with 10 x 10 mm blocks every 20 mm and 10 mm gaps between them.
 * Four things can be measured on the piece that is kept (the positive shape):
 *   outer  the overall length            = a * L + 2 d
 *   span   the first block's left edge to the last block's left edge (both on the same side, so the blade offset cancels)
 *                                        = a * S           (S = 20 * floor((L - 10) / 20))
 *   block  the width of one block        = a * 10 + 2 d
 *   gap    the width of one gap          = a * 10 - 2 d
 * where a is the scale of the cutter (cut size / drawn size) and d the blade offset per edge (positive: the kept
 * pieces come out bigger). The correction factor that makes the cutter cut true is 1 / a. Every given number is one
 * equation y = a x + c d' with d' = 2 d; the least squares solution gives a and d. When the numbers cannot separate the
 * two (for example only one overall length), the offset is taken as 0 and everything is scale. */
(function (root) {
  "use strict";
  var F = {};
  F.BLOCK = 10; F.PITCH = 20;

  F.spanNominal = function (L) { return Math.max(0, Math.floor((L - F.BLOCK) / F.PITCH + 1e-9) * F.PITCH); };

  function val(v) { if (v === null || v === undefined || v === "") return null; var n = Number(v); return isFinite(n) && n > 0 ? n : null; }

  /* strips: [{ len, outer, span, block, gap }]; mode "simple" (only the overall length of strips[use]) or "detail" (everything given).
   * Returns { a, f, d, n, obs: [{ strip, kind, nominal, measured, err, errPct, resid }], maxResid, warn, separated }. */
  F.fit = function (strips, mode, use) {
    var obs = [], simple = mode === "simple";
    (strips || []).forEach(function (s, i) {
      if (simple && i !== (use || 0)) return;
      var L = Number(s.len), o;
      if ((o = val(s.outer)) !== null && L > 0) obs.push({ strip: i, kind: "outer", x: L, c: 1, y: o });
      if (simple) return;
      var S = F.spanNominal(L);
      if ((o = val(s.span)) !== null && S > 0) obs.push({ strip: i, kind: "span", x: S, c: 0, y: o });
      if ((o = val(s.block)) !== null) obs.push({ strip: i, kind: "block", x: F.BLOCK, c: 1, y: o });
      if ((o = val(s.gap)) !== null) obs.push({ strip: i, kind: "gap", x: F.BLOCK, c: -1, y: o });
    });
    var res = { a: 1, f: 1, d: 0, n: obs.length, obs: [], maxResid: 0, warn: "", separated: false };
    if (!obs.length) return res;
    var Saa = 0, Sad = 0, Sdd = 0, Say = 0, Sdy = 0;
    obs.forEach(function (q) { Saa += q.x * q.x; Sad += q.x * q.c; Sdd += q.c * q.c; Say += q.x * q.y; Sdy += q.c * q.y; });
    var det = Saa * Sdd - Sad * Sad, a, dd = 0;
    if (Sdd > 0 && det > 1e-9 * Saa * Sdd) {
      a = (Say * Sdd - Sdy * Sad) / det; dd = (Saa * Sdy - Sad * Say) / det; res.separated = true;
    } else a = Say / Saa;
    res.a = a; res.f = 1 / a; res.d = dd / 2;
    obs.forEach(function (q) {
      var fit = a * q.x + q.c * dd, r = q.y - fit;
      res.obs.push({ strip: q.strip, kind: q.kind, nominal: q.x, measured: q.y, err: q.y - q.x, errPct: (q.y - q.x) / q.x * 100, resid: r });
      res.maxResid = Math.max(res.maxResid, Math.abs(r));
    });
    if (a < 0.9 || a > 1.1) res.warn = "The scale is more than 10 % off. Check the numbers (a typing mistake or a wrong strip?).";
    else if (res.separated && Math.abs(res.d) > 1) res.warn = "The blade offset is more than 1 mm. Check the numbers.";
    else if (res.n > 2 && res.maxResid > 0.3) res.warn = "The numbers do not fit together well (the largest leftover is " + res.maxResid.toFixed(2) + " mm). A measurement may be wrong, or the cutter is not linear.";
    return res;
  };

  /* The correction factor in its three forms: factor, percent and millimetres over the reference length. */
  F.forms = function (f, ref) { return { factor: f, percent: (f - 1) * 100, mm: (f - 1) * ref }; };
  F.fromPercent = function (p) { return 1 + p / 100; };
  F.fromMm = function (mm, ref) { return ref > 0 ? 1 + mm / ref : 1; };

  /* The blade offset of a cutter from both directions: the mean of the ones that could be found, and their difference. */
  F.kerf = function (fx, fy) {
    var v = [];
    [fx, fy].forEach(function (r) { if (r && r.separated) v.push(r.d); });
    if (!v.length) return { d: 0, diff: 0, n: 0 };
    return { d: v.reduce(function (s, x) { return s + x; }, 0) / v.length, diff: v.length > 1 ? Math.abs(v[0] - v[1]) : 0, n: v.length };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = F;
  else (root.PTD = root.PTD || {}).calfit = F;
})(typeof window !== "undefined" ? window : this);
