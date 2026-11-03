/* Run with: node tests/solver.test.js */
const S = require("../js/solver.js");
let failed = 0;
function ok(c, m) { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); }
function near(a, b, m) { ok(Math.abs(a - b) < 1e-6, m + " (" + a + " vs " + b + ")"); }
const gs = (arr) => arr.map((p, i) => ({ id: "g" + i, axis: "x", pos: p }));

// distance
let r = S.solve(gs([0, 100]), [{ id: "c1", type: "dist", axis: "x", ids: ["g0", "g1"], value: 250 }]);
ok(r.ok, "dist ok"); near(r.positions.g1 - r.positions.g0, 250, "dist enforced");

// dragging g1 keeps the distance by moving g0
r = S.solve(gs([0, 250]), [{ id: "c1", type: "dist", axis: "x", ids: ["g0", "g1"], value: 250 }], { id: "g1", axis: "x", pos: 400 });
near(r.positions.g1, 400, "anchor stays"); near(r.positions.g0, 150, "partner follows");

// equal spacing of three guides
r = S.solve(gs([0, 30, 100]), [{ id: "c1", type: "equal", axis: "x", ids: ["g0", "g1", "g2"] }]);
near(r.positions.g1 - r.positions.g0, r.positions.g2 - r.positions.g1, "equal spacing");

// symmetry about the centre (value 0)
r = S.solve(gs([-80, 100]), [{ id: "c1", type: "sym", axis: "x", ids: ["g0", "g1"], value: 0 }]);
near(r.positions.g0 + r.positions.g1, 0, "symmetric about centre");

// ratio 2:1 with fixed ends
r = S.solve(gs([0, 10, 90]), [
  { id: "c1", type: "pos", axis: "x", ids: ["g0"], value: 0 },
  { id: "c2", type: "pos", axis: "x", ids: ["g2"], value: 900 },
  { id: "c3", type: "ratio", axis: "x", ids: ["g0", "g1", "g2"], value: 2 }]);
near(r.positions.g1, 600, "proportional chain");

// conflict
r = S.solve(gs([0, 100]), [
  { id: "c1", type: "dist", axis: "x", ids: ["g0", "g1"], value: 250 },
  { id: "c2", type: "dist", axis: "x", ids: ["g0", "g1"], value: 300 }]);
ok(!r.ok && r.conflicts.length === 1 && r.conflicts[0].ids.length === 2, "conflict names both constraints");

// redundant constraints are fine
r = S.solve(gs([0, 100]), [
  { id: "c1", type: "dist", axis: "x", ids: ["g0", "g1"], value: 250 },
  { id: "c2", type: "dist", axis: "x", ids: ["g0", "g1"], value: 250 }]);
ok(r.ok, "redundant constraints accepted");

// minimum distance pushes apart, maximum pulls together
r = S.solve(gs([0, 50]), [{ id: "c1", type: "min", axis: "x", ids: ["g0", "g1"], value: 200 }]);
ok(r.ok && r.positions.g1 - r.positions.g0 >= 200 - 1e-6, "minimum enforced");
r = S.solve(gs([0, 500]), [{ id: "c1", type: "max", axis: "x", ids: ["g0", "g1"], value: 300 }]);
ok(r.ok && r.positions.g1 - r.positions.g0 <= 300 + 1e-6, "maximum enforced");
r = S.solve(gs([0, 100]), [{ id: "c1", type: "min", axis: "x", ids: ["g0", "g1"], value: 200 }, { id: "c2", type: "max", axis: "x", ids: ["g0", "g1"], value: 100 }]);
ok(!r.ok, "min above max conflicts");

// reference constraints are not enforced
r = S.solve(gs([0, 100]), [{ id: "c1", type: "dist", axis: "x", ids: ["g0", "g1"], value: 999, kind: "reference" }]);
near(r.positions.g1, 100, "reference constraint not enforced");

// anchor against a fixed guide conflicts
r = S.solve(gs([0, 100]), [{ id: "c1", type: "pos", axis: "x", ids: ["g0"], value: 0 }], { id: "g0", axis: "x", pos: 50 });
ok(!r.ok, "dragging a fixed guide conflicts");
process.exit(failed ? 1 : 0);
