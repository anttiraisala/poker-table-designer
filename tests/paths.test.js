/* Node tests for js/paths.js (REQ-046 to REQ-048). */
var P = require("../js/paths.js"), CL = require("../js/clipper.js");
P.useClipper(CL);
var fails = 0;
function ok(c, m) { if (c) console.log("ok   " + m); else { fails++; console.log("FAIL " + m); } }
function bbox(sh) { return [sh.x0, sh.y0, sh.x1, sh.y1]; }

var circ = P.normPath({ kind: "circle", r: 300 }, "p1");
var L = P.loops(circ, {});
ok(L.loops.length === 1 && L.loops[0].closed, "circle gives one closed loop");
var sm = P.sample(L.loops[0], 0);
ok(Math.abs(sm.L - 2 * Math.PI * 300) < 1, "circle length is 2 pi r");

var rec = P.normRecipe({ path: "p1", stack: [{ type: "line", thick: 10 }] });
var b = P.build(rec, { path: circ });
ok(b.shape && Math.abs((b.shape.x1 - b.shape.x0) - 610) < 1, "plain line ring has outer diameter 610");

var inner = P.normRecipe({ path: "p1", stack: [{ type: "line", thick: 10, side: "inside", dist: 50 }] });
var bi = P.build(inner, { path: circ });
ok(bi.shape && Math.abs((bi.shape.x1 - bi.shape.x0) - 510) < 1, "line 50 mm inside: outer diameter 510");
var circR = P.normPath({ kind: "circle", r: 300, reverse: true }, "p1");
var bi2 = P.build(inner, { path: circR });
ok(bi2.shape && Math.abs((bi2.shape.x1 - bi2.shape.x0) - 710) < 1, "reverse turns inside to outside on a closed loop");

var open = P.normPath({ kind: "lines", pts: [{ x: 0, y: 0, r: 0 }, { x: 1000, y: 0, r: 0 }] }, "p2");
var sine = P.normRecipe({ path: "p2", stack: [{ type: "sine", thick: 4, height: 100, mode: "count", n: 5 }] });
var bs = P.build(sine, { path: open });
ok(bs.shape && bs.shape.y1 - bs.shape.y0 > 95 && bs.shape.y1 - bs.shape.y0 < 110, "sine wave height about 100 + thickness");
var left = P.normRecipe({ path: "p2", stack: [{ type: "line", thick: 4, side: "left", dist: 30 }] });
var right = P.normRecipe({ path: "p2", stack: [{ type: "line", thick: 4, side: "right", dist: 30 }] });
var bl = P.build(left, { path: open }).shape, br = P.build(right, { path: open }).shape;
ok(bl.y1 < -20 && br.y0 > 20, "left of the walking direction is up on the screen, right is down");
var rev = P.normPath({ kind: "lines", reverse: true, pts: open.pts }, "p2");
var bl2 = P.build(left, { path: rev }).shape;
ok(bl2.y0 > 20 && bl.y1 < 0, "reverse swaps left and right on an open path");

var rounded = P.normPath({ kind: "lines", closed: true, pts: [{ x: 0, y: 0, r: 40 }, { x: 400, y: 0, r: 40 }, { x: 400, y: 300, r: 40 }, { x: 0, y: 300, r: 40 }] }, "p3");
var rl = P.loops(rounded, {}).loops[0];
var rs = P.sample(rl, 0);
ok(Math.abs(rs.L - (2 * 400 + 2 * 300 - 8 * 40 + 2 * Math.PI * 40)) < 1, "rounded rectangle length is right");

var run = P.normRecipe({ path: "p1", stack: [{ type: "scroll", thick: 6, height: 80, mode: "count", n: 10 }] });
var br2 = P.build(run, { path: circ });
ok(br2.shape && br2.shape.d.length > 1000, "running dog makes a shape");
var il = P.normRecipe({ path: "p1", stack: [{ type: "interlace", thick: 12, height: 60, strands: 3, mode: "count", n: 8, gap: 4 }] });
var bl3 = P.build(il, { path: circ });
ok(bl3.shape && bl3.shape.d.length > 1000, "interlace makes a shape");
var two = P.normRecipe({ path: "p1", stack: [{ type: "line", thick: 10 }, { type: "line", thick: 4, side: "inside", dist: 20, gapBelow: 3 }] });
ok(!!P.build(two, { path: circ }).shape, "two layers with a gap below build");

var env = { sources: function () { return [{ rings: [[[0, 0], [100, 0], [100, 50], [0, 50]]], halo: 0 }, { rings: [[[150, 0], [250, 0], [250, 50], [150, 50]]], halo: 0 }] } };
var ob = P.normPath({ kind: "objects", items: [{ l: "a" }], dist: 10, close: 0 }, "p4");
var ol = P.loops(ob, env);
ok(ol.loops.length === 2, "objects: two islands, two loops");
var hb = P.loops(P.normPath({ kind: "objects", items: [{ l: "a" }], shape: "hull", dist: 0 }, "p4"), env);
ok(hb.loops.length === 1, "objects: hull is one loop");
var cl = P.loops(P.normPath({ kind: "objects", items: [{ l: "a" }], dist: 0, close: 40 }, "p4"), env);
ok(cl.loops.length === 1, "objects: closing joins the islands 50 mm apart");
var emp = P.loops(P.normPath({ kind: "objects", items: [] }, "p4"), { sources: function () { return []; } });
ok(emp.err && !emp.loops.length, "objects: nothing to follow gives a message");

var deps = { layersOfPath: function (id) { return id === "A" ? ["pB"] : id === "B" ? ["t1"] : []; }, pathOfLayer: function (u) { return u === "pB" ? "B" : ""; }, isPattern: function (u) { return u === "pB"; } };
ok(P.dependsOn("A", "t1", deps), "dependsOn finds a chain");
ok(!P.dependsOn("B", "pB", deps), "dependsOn: no false cycle");
var n = P.normPath({ kind: "bogus", sides: 1 }, "x"); ok(n.kind === "circle", "bad kind falls back");
console.log(fails ? fails + " FAILED" : "all passed"); process.exit(fails ? 1 : 0);
