/* A small linear constraint solver for guide lines.
 *
 * Guides on one axis are numbers (positions in mm). Constraints are linear relations between
 * them. The solver moves the guides as little as possible so that every driving constraint holds
 * and reports a conflict, naming the constraints involved, when that is impossible.
 *
 * Constraint types (c.type), with c.ids = guide ids and c.value = a number in mm:
 *   pos    x[a] = value
 *   dist   x[b] - x[a] = value
 *   min    x[b] - x[a] >= value
 *   max    x[b] - x[a] <= value
 *   equal  equal spacing between consecutive guides in ids
 *   sym    x[a] + x[b] = 2 * x[c]   (ids a, b, c)   or  = 2 * value  (ids a, b)
 *   ratio  (x[b] - x[a]) : (x[c] - x[b]) = value : 1   (ids a, b, c)
 * c.kind = "reference" constraints are only measured, never enforced. */
(function (PTD) {
  "use strict";
  var S = {};
  var TOL = 1e-6;

  S.TYPES = {
    pos: { label: "Fixed position", n: 1, unit: "len" },
    dist: { label: "Distance", n: 2, unit: "len" },
    min: { label: "Minimum distance", n: 2, unit: "len" },
    max: { label: "Maximum distance", n: 2, unit: "len" },
    equal: { label: "Equal spacing", n: 3, unit: null, many: true },
    sym: { label: "Symmetric about", n: 3, unit: null },
    ratio: { label: "Ratio of two gaps", n: 3, unit: "ratio" }
  };

  /* Linear rows for one constraint: [{coef: {guideId: number}, rhs, ineq: null|"ge"|"le"}] */
  function rowsOf(c, x) {
    var ids = c.ids || [], v = Number(c.value) || 0, rows = [];
    function row(coef, rhs, ineq) { rows.push({ coef: coef, rhs: rhs, ineq: ineq || null, cid: c.id }); }
    var a = ids[0], b = ids[1], d = ids[2];
    if (c.type === "pos") row(one(a, 1), v);
    else if (c.type === "dist") row(two(a, -1, b, 1), v);
    else if (c.type === "min") row(two(a, -1, b, 1), v, "ge");
    else if (c.type === "max") row(two(a, -1, b, 1), v, "le");
    else if (c.type === "equal") {
      var s = ids.slice().sort(function (p, q) { return x[p] - x[q]; });
      for (var i = 1; i + 1 < s.length; i++) {
        var co = {};
        add(co, s[i + 1], 1); add(co, s[i], -1); add(co, s[i], -1); add(co, s[i - 1], 1);
        row(co, 0);
      }
    } else if (c.type === "sym") {
      var cs = {}; add(cs, a, 1); add(cs, b, 1);
      if (d) { add(cs, d, -2); row(cs, 0); } else row(cs, 2 * v);
    } else if (c.type === "ratio") {
      var cr = {}; var w = v || 1;
      add(cr, b, 1 + w); add(cr, a, -1); add(cr, d, -w);   /* (b-a) - w (c-b) = 0 */
      row(cr, 0);
    }
    return rows;
  }
  function add(co, id, k) { co[id] = (co[id] || 0) + k; }
  function one(a, k) { var o = {}; add(o, a, k); return o; }
  function two(a, ka, b, kb) { var o = {}; add(o, a, ka); add(o, b, kb); return o; }

  /* Minimum-norm correction for equality rows A d = r. Returns {d, conflict: [row indices] | null}. */
  function solveEq(A, r, n) {
    var m = A.length;
    if (!m) return { d: new Array(n).fill(0), conflict: null };
    /* G = A A^T, augmented with r and the identity (to know which rows combine) */
    var M = [];
    for (var i = 0; i < m; i++) {
      var row = [];
      for (var j = 0; j < m; j++) { var s = 0; for (var k = 0; k < n; k++) s += A[i][k] * A[j][k]; row.push(s); }
      row.push(r[i]);
      for (var q = 0; q < m; q++) row.push(i === q ? 1 : 0);
      M.push(row);
    }
    var piv = [], used = {};
    for (var col = 0; col < m; col++) {
      var best = -1, bv = 1e-9;
      for (var rr = 0; rr < m; rr++) if (!used[rr] && Math.abs(M[rr][col]) > bv) { bv = Math.abs(M[rr][col]); best = rr; }
      if (best < 0) continue;
      used[best] = true; piv.push([best, col]);
      var pv = M[best][col];
      for (var c2 = 0; c2 < M[best].length; c2++) M[best][c2] /= pv;
      for (var r3 = 0; r3 < m; r3++) {
        if (r3 === best) continue;
        var f = M[r3][col];
        if (Math.abs(f) < 1e-15) continue;
        for (var c3 = 0; c3 < M[r3].length; c3++) M[r3][c3] -= f * M[best][c3];
      }
    }
    for (var z = 0; z < m; z++) {
      if (used[z]) continue;
      if (Math.abs(M[z][m]) > 1e-6) {
        var who = [];
        for (var w = 0; w < m; w++) if (Math.abs(M[z][m + 1 + w]) > 1e-9) who.push(w);
        return { d: null, conflict: who };
      }
    }
    var y = new Array(m).fill(0);
    piv.forEach(function (p) { y[p[1]] = M[p[0]][m]; });
    var d = new Array(n).fill(0);
    for (var i2 = 0; i2 < m; i2++) for (var k2 = 0; k2 < n; k2++) d[k2] += A[i2][k2] * y[i2];
    return { d: d, conflict: null };
  }

  /* Solves one axis.
   * guides: [{id, pos}], constraints: [...] (only this axis), anchor: {id, pos} | null
   * Returns {ok, positions: {id: pos}, conflicts: [{message, ids}]} */
  S.solveAxis = function (guides, constraints, anchor) {
    var idx = {}, x0 = [], n = guides.length;
    guides.forEach(function (g, i) { idx[g.id] = i; x0.push(g.pos); });
    var cur = {}; guides.forEach(function (g) { cur[g.id] = g.pos; });
    if (anchor && idx[anchor.id] != null) { x0[idx[anchor.id]] = anchor.pos; cur[anchor.id] = anchor.pos; }
    var eq = [], ineq = [];
    constraints.forEach(function (c) {
      if (c.kind === "reference" || c.enabled === false) return;
      if (!(c.ids || []).every(function (id) { return idx[id] != null; })) return;
      rowsOf(c, cur).forEach(function (r) { (r.ineq ? ineq : eq).push(r); });
    });
    if (anchor && idx[anchor.id] != null) eq.unshift({ coef: one(anchor.id, 1), rhs: anchor.pos, ineq: null, cid: "anchor" });
    function toVec(coefs) { var v = new Array(n).fill(0); for (var id in coefs) v[idx[id]] += coefs[id]; return v; }
    var active = [], x = x0.slice(), conflicts = [];
    for (var iter = 0; iter < 30; iter++) {
      var rows = eq.concat(active), A = rows.map(function (r) { return toVec(r.coef); });
      var r = rows.map(function (rw, i) { var s = 0; for (var k = 0; k < n; k++) s += A[i][k] * x0[k]; return rw.rhs - s; });
      var res = solveEq(A, r, n);
      if (res.conflict) {
        var ids = {};
        res.conflict.forEach(function (i) { if (rows[i].cid !== "anchor") ids[rows[i].cid] = true; });
        conflicts.push({ message: "These constraints cannot all be satisfied" + (res.conflict.some(function (i) { return rows[i].cid === "anchor"; }) ? " with the guide where you put it" : "") + ".", ids: Object.keys(ids) });
        return { ok: false, positions: cur, conflicts: conflicts };
      }
      x = x0.map(function (v, k) { return v + res.d[k]; });
      var worst = null, wv = TOL;
      ineq.forEach(function (rw) {
        if (active.indexOf(rw) >= 0) return;
        var a = toVec(rw.coef), s = 0; for (var k = 0; k < n; k++) s += a[k] * x[k];
        var viol = rw.ineq === "ge" ? rw.rhs - s : s - rw.rhs;
        if (viol > wv) { wv = viol; worst = rw; }
      });
      if (!worst) break;
      active.push(worst);
    }
    var out = {};
    guides.forEach(function (g, i) { out[g.id] = x[i]; });
    /* final check of the inequalities */
    var bad = {};
    ineq.forEach(function (rw) {
      var s = 0; for (var id in rw.coef) s += rw.coef[id] * out[id];
      var viol = rw.ineq === "ge" ? rw.rhs - s : s - rw.rhs;
      if (viol > 1e-4) bad[rw.cid] = true;
    });
    if (Object.keys(bad).length) return { ok: false, positions: cur, conflicts: [{ message: "A limit cannot be met together with the other constraints.", ids: Object.keys(bad) }] };
    return { ok: true, positions: out, conflicts: [] };
  };

  /* Solves both axes. guides: [{id, axis: "x"|"y", pos}] */
  S.solve = function (guides, constraints, anchor) {
    var result = { ok: true, positions: {}, conflicts: [] };
    ["x", "y"].forEach(function (ax) {
      var gs = guides.filter(function (g) { return g.axis === ax; });
      var cs = constraints.filter(function (c) { return c.axis === ax; });
      var r = S.solveAxis(gs, cs, anchor && anchor.axis === ax ? anchor : null);
      if (!r.ok) result.ok = false;
      Object.assign(result.positions, r.positions);
      result.conflicts = result.conflicts.concat(r.conflicts);
    });
    return result;
  };

  /* The measured value of a constraint, for display. */
  S.measure = function (c, pos) {
    var ids = c.ids || [], g = function (i) { return pos[ids[i]]; };
    if (c.type === "pos") return g(0);
    if (c.type === "dist" || c.type === "min" || c.type === "max") return g(1) - g(0);
    if (c.type === "ratio") return (g(1) - g(0)) / ((g(2) - g(1)) || 1e-9);
    if (c.type === "sym") return g(0) + g(1) - 2 * (ids[2] ? g(2) : Number(c.value) || 0);
    if (c.type === "equal") {
      var s = ids.map(function (id) { return pos[id]; }).sort(function (a, b) { return a - b; });
      var gaps = []; for (var i = 1; i < s.length; i++) gaps.push(s[i] - s[i - 1]);
      return gaps.length ? Math.max.apply(null, gaps) - Math.min.apply(null, gaps) : 0;
    }
    return 0;
  };

  PTD.solver = S;
  if (typeof module !== "undefined") module.exports = S;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
