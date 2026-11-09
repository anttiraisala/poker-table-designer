/* Node test of the procedural graph (js/graph.js). Run: node tests/graph.test.js */
"use strict";
var G = require("../js/graph.js"), CL = require("../js/clipper.js");
G.useClipper(CL);
var fails = 0;
function ok(c, m) { if (c) console.log("ok   " + m); else { fails++; console.log("FAIL " + m); } }
function areaOf(paths) { var a = 0; paths.forEach(function (p) { var s = 0; for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; s += p[i].X * q.Y - q.X * p[i].Y; } a += s / 2; }); return a / 1e6; }

var g = G.empty();
var c = G.addNode(g, "circle", 0, 0), s = G.addNode(g, "stroke", 200, 0), o = G.addNode(g, "output", 400, 0);
ok(G.connect(g, c.id, s.id, "in") === "" && G.connect(g, s.id, o.id, "in") === "", "wire circle -> stroke -> output");
ok(G.canConnect(g, c.id, o.id, "in") === "", "output accepts a path");
ok(G.canConnect(g, o.id, s.id, "in") !== "", "output gives nothing");
var u = G.addNode(g, "union", 0, 100);
ok(G.canConnect(g, c.id, u.id, "in").indexOf("path") >= 0, "type mismatch refused with reason");
G.connect(g, s.id, u.id, "in");
var m2 = G.addNode(g, "offset", 0, 200); G.connect(g, u.id, m2.id, "in");
ok(G.canConnect(g, m2.id, u.id, "in").indexOf("loop") >= 0, "loop refused");

var r = G.evaluate(g, o.id, {});
ok(r.kind === "shape" && r.paths.length > 0, "stroke makes a shape");
var A = areaOf(r.paths), expect = 2 * Math.PI * 500 * 12;
ok(Math.abs(Math.abs(A) - expect) / expect < 0.03, "ring area ~ circumference x thickness (" + Math.round(A) + ")");

/* sine modifier keeps closed circle closed and changes the shape */
var g2 = G.empty(), a = G.addNode(g2, "circle", 0, 0), sn = G.addNode(g2, "sinep", 0, 0), st = G.addNode(g2, "stroke", 0, 0);
G.connect(g2, a.id, sn.id, "in"); G.connect(g2, sn.id, st.id, "in");
sn.p = G.normParams("sinep", { amp: 20, freq: 8 });
var rs = G.evaluate(g2, sn.id, {});
ok(rs.kind === "path" && rs.loops[0].closed, "sine bend gives a closed path");
var radii = rs.loops[0].pts.map(function (p) { return Math.hypot(p[0], p[1]); }), mn = Math.min.apply(0, radii), mx = Math.max.apply(0, radii);
ok(mx - mn > 35 && mx - mn < 41, "sine swing is 2 x amplitude (" + (mx - mn).toFixed(1) + ")");
/* frequency = repeats: count zero crossings of (r-300) */
var cross = 0, nR = radii.length; for (var i = 0; i < nR; i++) if (radii[i] > radii[(i + nR - 1) % nR] && radii[i] >= radii[(i + 1) % nR] && radii[i] > 510) cross++;
ok(cross === 8, "8 repeats give 8 crests (" + cross + ")");
ok(G.evaluate(g2, st.id, {}).kind === "shape", "sine path can be stroked");

/* wiggle: deterministic by seed, differs by seed, amplitude bounded */
var wg = G.empty(), wc = G.addNode(wg, "circle", 0, 0), ww = G.addNode(wg, "wobble", 0, 0);
G.connect(wg, wc.id, ww.id, "in");
ww.p = G.normParams("wobble", { amp: 15, size: 60, seed: 3 });
var w1 = G.evaluate(wg, ww.id, {}), w1b; G.clearCache(); w1b = G.evaluate(wg, ww.id, {});
ok(JSON.stringify(w1.loops[0].pts) === JSON.stringify(w1b.loops[0].pts), "wiggle is repeatable for a seed");
ww.p = G.normParams("wobble", { amp: 15, size: 60, seed: 4 });
var w2 = G.evaluate(wg, ww.id, {});
ok(JSON.stringify(w1.loops[0].pts) !== JSON.stringify(w2.loops[0].pts), "another seed gives another wiggle");
var wr = w1.loops[0].pts.map(function (p) { return Math.hypot(p[0], p[1]); });
ok(Math.max.apply(0, wr) <= 515.5 && Math.min.apply(0, wr) >= 484.5, "wiggle stays within amplitude");
ok(Math.hypot(w1.loops[0].pts[0][0] - w1.loops[0].pts[w1.loops[0].pts.length - 1][0], w1.loops[0].pts[0][1] - w1.loops[0].pts[w1.loops[0].pts.length - 1][1]) < 10, "closed wiggle has no seam jump");

/* shape operators */
var g3 = G.empty(), c1 = G.addNode(g3, "circle", 0, 0), c2 = G.addNode(g3, "circle", 0, 0), k1 = G.addNode(g3, "stroke", 0, 0), k2 = G.addNode(g3, "stroke", 0, 0);
c1.p = G.normParams("circle", { r: 300 }); c2.p = G.normParams("circle", { cx: 300, cy: 0, r: 300 });
k1.p = G.normParams("stroke", { thick: 40 }); k2.p = G.normParams("stroke", { thick: 40 });
G.connect(g3, c1.id, k1.id, "in"); G.connect(g3, c2.id, k2.id, "in");
function op(t) { var n = G.addNode(g3, t, 0, 0); G.connect(g3, k1.id, n.id, "in"); G.connect(g3, k2.id, n.id, "in"); return Math.abs(areaOf(G.evaluate(g3, n.id, {}).paths)); }
var a1 = Math.abs(areaOf(G.evaluate(g3, k1.id, {}).paths)), U = op("union"), I = op("intersect"), S = op("subtract"), X = op("xor");
ok(Math.abs(U + I - 2 * a1) / a1 < 0.02, "union + intersect = sum of both");
ok(Math.abs(S - (a1 - I)) / a1 < 0.02, "subtract = A minus the overlap");
ok(Math.abs(X - (U - I)) / a1 < 0.02, "xor = union minus intersect");
var ng = G.addNode(g3, "negate", 0, 0); G.connect(g3, k1.id, ng.id, "in");
ng.p = G.normParams("negate", { margin: 50 });
var nr = G.evaluate(g3, ng.id, {});
ok(nr.kind === "shape" && Math.abs(areaOf(nr.paths)) > 0, "negate gives box minus shape");
var of = G.addNode(g3, "offset", 0, 0); G.connect(g3, k1.id, of.id, "in"); of.p = G.normParams("offset", { dist: 10 });
ok(Math.abs(areaOf(G.evaluate(g3, of.id, {}).paths)) > a1, "offset grows the shape");

/* errors and cache */
var g4 = G.empty(), st4 = G.addNode(g4, "stroke", 0, 0);
ok(G.evaluate(g4, st4.id, {}).err.indexOf("path") >= 0, "missing input gives a message");
var n0 = Object.keys(JSON.parse(JSON.stringify({}))).length;
G.clearCache(); var t0 = Date.now(); G.evaluate(g, o.id, {}); var t1 = Date.now(); G.evaluate(g, o.id, {}); ok(Date.now() - t1 <= t1 - t0 + 2, "second evaluation is cached");

/* norm: bad data, cycles, single input */
var bad = G.norm({ nodes: [{ id: "a", type: "circle" }, { id: "b", type: "stroke" }, { id: "x", type: "nope" }], wires: [{ from: "a", to: "b", port: "in" }, { from: "b", to: "a", port: "in" }, { from: "a", to: "zz", port: "in" }] });
ok(bad.nodes.length === 2 && bad.wires.length === 1, "norm drops unknown nodes and bad wires");
var rt = G.norm(JSON.parse(JSON.stringify(g)));
ok(rt.nodes.length === g.nodes.length && rt.wires.length === g.wires.length, "JSON round trip");
G.connect(g, c.id, s.id, "in");
ok(g.wires.filter(function (w) { return w.to === s.id; }).length === 1, "single input replaces the wire");
G.removeNode(g, s.id);
ok(!g.wires.some(function (w) { return w.from === s.id || w.to === s.id; }), "removing a node removes its wires");

/* generator nodes all work on a circle */
["gsine", "gscroll", "ginterlace", "gfoliage"].forEach(function (t) {
  var gg = G.empty(), cc = G.addNode(gg, "circle", 0, 0), nn = G.addNode(gg, t, 0, 0); G.connect(gg, cc.id, nn.id, "in");
  var rr = G.evaluate(gg, nn.id, {}); ok(rr.kind === "shape" && rr.paths.length > 0, t + " makes a shape");
});
/* trim and round and reverse and offsetp */
["trim", "round", "reverse", "offsetp"].forEach(function (t) {
  var gg = G.empty(), cc = G.addNode(gg, "polygon", 0, 0), nn = G.addNode(gg, t, 0, 0); G.connect(gg, cc.id, nn.id, "in");
  var rr = G.evaluate(gg, nn.id, {}); ok(rr.kind === "path" && rr.loops.length > 0, t + " makes a path");
});
/* inputs: geometry of objects, table area, edge of a shape */
var gi = G.empty(), ly = G.addNode(gi, "layer", 0, 0), ta = G.addNode(gi, "tablearea", 0, 0), sb = G.addNode(gi, "subtract", 0, 0), ol = G.addNode(gi, "outline", 0, 0), sk = G.addNode(gi, "stroke", 0, 0);
ly.p = G.normParams("layer", { items: [{ l: "a" }, { bad: 1 }], dist: 0 });
ok(ly.p.items.length === 1, "layer node keeps only valid items");
var envI = { sources: function () { return [{ rings: [[[0, 0], [100, 0], [100, 60], [0, 60]]], halo: 0 }]; }, tableLoops: function () { return [{ pts: [[0, 0], [50, 0], [50, 100], [0, 100]], closed: true }]; } };
var rl = G.evaluate(gi, ly.id, envI);
ok(rl.kind === "shape" && Math.abs(Math.abs(areaOf(rl.paths)) - 6000) < 5, "objects geometry is the shape of the object (area 6000)");
ta.p = G.normParams("tablearea", { table: "t1", which: "outline" });
ok(Math.abs(Math.abs(areaOf(G.evaluate(gi, ta.id, envI).paths)) - 5000) < 5, "table area is a shape (5000)");
G.connect(gi, ly.id, sb.id, "in"); G.connect(gi, ta.id, sb.id, "in");
ok(Math.abs(Math.abs(areaOf(G.evaluate(gi, sb.id, envI).paths)) - 3000) < 5, "object minus table area (3000)");
G.connect(gi, sb.id, ol.id, "in"); G.connect(gi, ol.id, sk.id, "in");
var ro = G.evaluate(gi, ol.id, envI);
ok(ro.kind === "path" && ro.loops.length === 1 && ro.loops[0].closed, "edge of a shape is a closed path");
ok(G.evaluate(gi, sk.id, envI).kind === "shape", "the edge of a shape can be stroked");
ok(G.canConnect(gi, ly.id, ol.id, "in") === "" && G.canConnect(gi, ol.id, sb.id, "in") !== "", "a path cannot go into a shape input");
/* foliage leaves over the stem and each other must merge, not cut holes; Fill holes closes holes on request */
var CLO = require("../js/clipper.js");
function holesOf(ps) { return ps.filter(function (q) { return !CLO.Clipper.Orientation(q); }).length; }
var gf = G.empty(), lf = G.addNode(gf, "lines", 0, 0), ff = G.addNode(gf, "gfoliage", 0, 0); G.connect(gf, lf.id, ff.id, "in");
lf.p = G.normParams("lines", { closed: false, pts: [{ x: -500, y: 0, r: 0 }, { x: 500, y: 0, r: 0 }] });
ff.p = G.normParams("gfoliage", { n: 40, height: 120, leafW: 50, angle: 20, jit: 0.3, stem: true, thick: 6, seed: 2 });
ok(holesOf(G.evaluate(gf, ff.id, {}).paths) === 0, "overlapping leaves and stem make no holes");
var gh = G.empty(), cc = G.addNode(gh, "circle", 0, 0), s1 = G.addNode(gh, "stroke", 0, 0), fl = G.addNode(gh, "fill", 0, 0);
G.connect(gh, cc.id, s1.id, "in"); G.connect(gh, s1.id, fl.id, "in");
var ringA = Math.abs(areaOf(G.evaluate(gh, s1.id, {}).paths)), hole = Math.PI * Math.pow(500 - 10, 2);
var fa = G.evaluate(gh, fl.id, {}); ok(holesOf(fa.paths) === 0 && Math.abs(Math.abs(areaOf(fa.paths)) - ringA - hole) / hole < 0.03, "Fill holes closes every hole");
fl.p = G.normParams("fill", { all: false, maxArea: 100 }); ok(holesOf(G.evaluate(gh, fl.id, {}).paths) === 1, "Fill holes keeps a hole bigger than the limit");
fl.p = G.normParams("fill", { all: false, maxArea: 1e7 }); ok(holesOf(G.evaluate(gh, fl.id, {}).paths) === 0, "Fill holes closes a hole below the limit");
/* Fringe (REQ-058): every form draws, overlapping parts merge without holes, the seed decides, layering cuts gaps */
function fringeRes(p, shape) {
  var gz = G.empty(), cz = G.addNode(gz, shape || "circle", 0, 0, shape === "lines" ? undefined : { r: 300 }), fz = G.addNode(gz, "fringe", 0, 0);
  G.connect(gz, cz.id, fz.id, "in"); fz.p = G.normParams("fringe", p);
  return G.evaluate(gz, fz.id, {});
}
["straight", "curl", "lightning", "wave", "flame", "feather"].forEach(function (form) {
  var r1 = fringeRes({ form: form, n: 12, length: 70, width: 22, inner: false, licks: false, forks: 0 }), r2 = fringeRes({ form: form, n: 12, length: 70, width: 22, inner: false, licks: false, forks: 0 });
  ok(r1.kind === "shape" && r1.paths.length > 0 && Math.abs(areaOf(r1.paths)) > 100, "Fringe " + form + " draws a shape");
  ok(JSON.stringify(r1.paths) === JSON.stringify(r2.paths), "Fringe " + form + " is the same twice (seeded)");
  ok(holesOf(r1.paths) === 0, "Fringe " + form + " makes no holes when items overlap or touch");
});
var fa1 = fringeRes({ form: "lightning", seed: 1, n: 6 }), fa2 = fringeRes({ form: "lightning", seed: 2, n: 6 });
ok(JSON.stringify(fa1.paths) !== JSON.stringify(fa2.paths), "a different seed gives a different bolt");
var fm = fringeRes({ form: "straight", n: 20, length: 40, width: 10, tmix: 1 }), fl2 = fringeRes({ form: "straight", n: 20, length: 40, width: 10, tmix: 1, overlap: "layered", gap: 2 });
ok(fm.paths.length === 20, "Fringe makes one piece per spike (" + fm.paths.length + ")");
var fw = fringeRes({ form: "straight", n: 40, length: 160, width: 90, tmix: 1, overlap: "merge" }), fy = fringeRes({ form: "straight", n: 40, length: 160, width: 90, tmix: 1, overlap: "layered", gap: 3 });
ok(fy.paths.length > fw.paths.length && Math.abs(areaOf(fy.paths)) < Math.abs(areaOf(fw.paths)), "layered items are cut by gaps (more pieces, less area)");
var fb = fringeRes({ form: "straight", n: 10, length: 40, width: 10, both: "mirror" });
ok(fb.paths.length >= 10, "both sides give items on both sides");
var fh = fringeRes({ form: "flame", n: 4, inner: true, innerSize: 50 });
ok(holesOf(fh.paths) >= 1, "a flame can have a hollow inner flame");
var fe = fringeRes({ form: "feather", n: 4, shaft: true, barbs: true });
ok(fe.kind === "shape" && fe.paths.length > 4, "feather gaps cut the feather into pieces");
var fbig = fringeRes({ n: 3000, form: "straight", length: 20, width: 2 });
ok(fbig.err && fbig.err.length > 0, "a huge fringe warns (" + fbig.err.slice(0, 40) + ")");
/* Mirror (REQ-055): the mirrored pattern is exactly the reflection of the plain one across the path, and differs from it */
(function () {
  function mk(type, p) { var gm = G.empty(), lm = G.addNode(gm, "lines", 0, 0), nm = G.addNode(gm, type, 0, 0); G.connect(gm, lm.id, nm.id, "in"); lm.p = G.normParams("lines", { closed: false, pts: [{ x: -600, y: 0, r: 0 }, { x: 600, y: 0, r: 0 }] }); nm.p = G.normParams(type, p); return G.evaluate(gm, nm.id, {}).paths; }
  function xorArea(a, b) { var c = new CL.Clipper(), so = []; c.AddPaths(a, CL.PolyType.ptSubject, true); c.AddPaths(b, CL.PolyType.ptClip, true); c.Execute(CL.ClipType.ctXor, so, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero); return Math.abs(areaOf(so)); }
  ["gsine", "gscroll", "ginterlace", "gfoliage"].forEach(function (t) {
    var a = mk(t, { n: 6, seed: 3 }), b = mk(t, { n: 6, seed: 3, mirror: true }), r = a.map(function (q) { return q.map(function (v) { return { X: v.X, Y: -v.Y }; }).reverse(); });
    ok(xorArea(r, b) < 1, t + ": Mirror is the exact reflection across the path");
    ok(xorArea(a, b) > 100, t + ": the plain pattern is not symmetric, so Mirror changes it");
  });
})();
/* Bake (REQ-059) */
(function () {
  var gb = G.empty(), cb = G.addNode(gb, "circle", 0, 0, { r: 300 }), fb2 = G.addNode(gb, "fringe", 0, 0), ob = G.addNode(gb, "output", 0, 0);
  G.connect(gb, cb.id, fb2.id, "in"); G.connect(gb, fb2.id, ob.id, "in"); fb2.p = G.normParams("fringe", { form: "lightning", n: 10 });
  var before = G.evaluate(gb, fb2.id, {}), nb = G.pointsOf(before);
  ok(G.bake(gb, fb2.id, {}, 0.5) === "" && fb2.bake && fb2.bake.kind === "shape", "a node can be baked");
  ok(G.pointsOf(G.evaluate(gb, fb2.id, {})) < nb, "the precision removes points (" + nb + " to " + G.pointsOf(G.evaluate(gb, fb2.id, {})) + ")");
  ok(G.evaluate(gb, fb2.id, {}).baked === true, "a baked node returns its stored result");
  var o1 = JSON.stringify(G.evaluate(gb, ob.id, {}).paths); fb2.p = G.normParams("fringe", { form: "lightning", n: 10, seed: 77 });
  ok(JSON.stringify(G.evaluate(gb, ob.id, {}).paths) === o1, "a baked node ignores changes of its own values");
  ok(G.isStale(gb, fb2.id, {}), "a changed value marks the bake as out of date");
  var js = JSON.parse(JSON.stringify(gb)), gn = G.norm(js);
  ok(G.node(gn, fb2.id).bake && G.pointsOf(G.evaluate(gn, fb2.id, {})) === G.node(gn, fb2.id).bake.pts, "the bake survives a save and load");
  ok(G.bakeSize(fb2) > 100, "the size of a bake is known (" + G.bakeSize(fb2) + " bytes)");
  G.unbake(gb, fb2.id); ok(!fb2.bake && !G.evaluate(gb, fb2.id, {}).baked, "Unbake makes the node live again");
  ok(G.finalNodes(gb).join() === fb2.id, "the nodes that feed an Output are found");
  var gl = G.empty(), cl = G.addNode(gl, "circle", 0, 0, { r: 300 }); G.bake(gl, cl.id, {}, 5);
  ok(G.node(gl, cl.id).bake.kind === "path" && G.evaluate(gl, cl.id, {}).loops[0].pts.length < 200, "a path can be baked and simplified");
  G.draft = true; var dr = fringeRes({ form: "lightning", n: 6, detail: 8 }); G.draft = false; var fu = fringeRes({ form: "lightning", n: 6, detail: 8 });
  ok(G.pointsOf(dr) < G.pointsOf(fu), "draft quality gives fewer points than full quality");
})();
/* Second side: a mirror image, or turned half a round (the other way along the path) */
(function () {
  var m = fringeRes({ form: "curl", n: 6, both: "mirror", second: "mirror", length: 80, width: 8 }), r = fringeRes({ form: "curl", n: 6, both: "mirror", second: "rotated", length: 80, width: 8 }), old = fringeRes({ form: "curl", n: 6, both: "mirror", sameDir: true, length: 80, width: 8 });
  ok(JSON.stringify(m.paths) !== JSON.stringify(r.paths), "the second side turns the other way along the path when asked");
  ok(JSON.stringify(r.paths) === JSON.stringify(old.paths), "an old file with sameDir loads as Other way along the path");
  ok(Math.abs(Math.abs(areaOf(m.paths)) - Math.abs(areaOf(r.paths))) / Math.abs(areaOf(m.paths)) < 0.02, "both give the same amount of material");
})();
/* Taper: a power curve mixed with the straight cone; no kink at the root */
(function () {
  var lin = Math.abs(areaOf(fringeRes({ form: "straight", n: 1, length: 100, width: 20, tmix: 1 }).paths)), thorn = Math.abs(areaOf(fringeRes({ form: "straight", n: 1, length: 100, width: 20, power: 3 }).paths)), horn = Math.abs(areaOf(fringeRes({ form: "straight", n: 1, length: 100, width: 20, power: 0.4 }).paths));
  ok(Math.abs(lin - 1000) < 30, "a straight cone 20 mm wide and 100 mm long has area 1000 (" + lin.toFixed(0) + ")");
  ok(thorn < lin * 0.6 && horn > lin * 1.2, "power above 1 is a thin thorn, below 1 a fat horn (" + thorn.toFixed(0) + ", " + lin.toFixed(0) + ", " + horn.toFixed(0) + ")");
  ok(Math.abs(Math.abs(areaOf(fringeRes({ form: "straight", n: 1, length: 100, width: 20, power: 3, tmix: 1 }).paths)) - lin) < 1, "linear mix 1 ignores the power");
  var fr0 = require("../js/fringe.js").norm({ power: 500, tmix: 7 }); ok(fr0.power === 100 && fr0.tmix === 1, "power and mix are limited");
})();
var tm = fringeRes({ form: "lightning", n: 6 }); ok(typeof tm.ms === "number" && tm.ms > 0, "a node result carries its own compute time (" + (tm.ms || 0).toFixed(1) + " ms)");

/* Enable / disable (V136): a disabled node is a bypass */
(function () {
  var g = G.empty(), c = G.addNode(g, "circle", 0, 0), r2 = G.addNode(g, "round", 100, 0), st = G.addNode(g, "stroke", 200, 0), o = G.addNode(g, "output", 300, 0);
  G.connect(g, c.id, r2.id, "in"); G.connect(g, r2.id, st.id, "in"); G.connect(g, st.id, o.id, "in");
  var a0 = areaOf(G.evaluate(g, o.id, {}).paths);
  G.node(g, r2.id).off = "bypass";
  var pr = G.evaluate(g, r2.id, {}), cr = G.evaluate(g, c.id, {});
  ok(pr.kind === "path" && pr.loops === cr.loops, "a disabled path node passes the path through unchanged");
  G.node(g, st.id).off = "bypass";
  var sv = G.evaluate(g, o.id, {});
  ok(sv.kind === "shape" && areaOf(sv.paths) > 0 && areaOf(sv.paths) < 5e5, "a disabled stroke turns the closed path into a hairline of its form, not a filled disc (" + Math.round(areaOf(sv.paths)) + ")");
  ok(areaOf(sv.paths) !== a0, "the result changes when nodes are switched off");
  var back = G.norm(JSON.parse(JSON.stringify(g)));
  ok(G.node(back, st.id).off === "bypass" && G.norm({nodes:[{id:"a",type:"circle",off:true}],wires:[]}).nodes[0].off === "bypass", "the off flag survives save and load");
  delete G.node(g, st.id).off; delete G.node(g, r2.id).off;
  ok(areaOf(G.evaluate(g, o.id, {}).paths) === a0, "enabling brings the result back");
  G.node(g, c.id).off = "cut";
  ok(!G.evaluate(g, o.id, {}).kind, "a cut source leaves its user without input");
  G.node(g, c.id).off = "empty"; var ee = G.evaluate(g, c.id, {}); ok(ee.kind === "path" && ee.loops.length === 0, "off, gives nothing: an empty value");
  var g2 = G.empty(), c1 = G.addNode(g2, "circle", 0, 0), c2 = G.addNode(g2, "circle", 0, 0, { cx: 300, cy: 0, r: 50 }), s1 = G.addNode(g2, "stroke", 0, 0), s2 = G.addNode(g2, "stroke", 0, 0), un = G.addNode(g2, "union", 0, 0);
  G.connect(g2, c1.id, s1.id, "in"); G.connect(g2, c2.id, s2.id, "in"); G.connect(g2, s1.id, un.id, "in"); G.connect(g2, s2.id, un.id, "in");
  var both = areaOf(G.evaluate(g2, un.id, {}).paths); G.node(g2, s2.id).off = "cut";
  var one = G.evaluate(g2, un.id, {});
  ok(one.kind === "shape" && areaOf(one.paths) < both, "a union skips a disabled input");
})();
/* Phase may be negative (V136) */
(function () {
  var pd = G.TYPES.gsine.params.filter(function (q) { return q.key === "phase"; })[0];
  ok(pd && pd.min === -1 && pd.max === 1, "the generator phase runs from -1 to 1");
  var g = G.empty(), c = G.addNode(g, "circle", 0, 0), n = G.addNode(g, "gsine", 0, 0, Object.assign(G.defaultParams("gsine"), { phase: -0.5 }));
  G.connect(g, c.id, n.id, "in"); var r = G.evaluate(g, n.id, {});
  ok(r.kind === "shape" && r.paths.length > 0, "a negative phase draws the pattern");
})();
/* Offset path keeps its points steady (V140) */
(function () {
  function counts(step) {
    var out = [];
    for (var d = 0; d <= 40; d += 2) {
      var g = G.empty(), c = G.addNode(g, "polygon", 0, 0), o = G.addNode(g, "offsetp", 0, 0, Object.assign(G.defaultParams("offsetp"), { dist: d, step: step }));
      G.connect(g, c.id, o.id, "in"); var r = G.evaluate(g, o.id, {});
      out.push(r.kind === "path" ? r.loops[0].pts.length : 0);
    }
    return out;
  }
  var a = counts(0.5), b = counts(0), ja = 0, jb = 0;
  for (var i = 1; i < a.length; i++) { ja = Math.max(ja, Math.abs(a[i] - a[i - 1]) / a[i - 1]); jb = Math.max(jb, Math.abs(b[i] - b[i - 1]) / b[i - 1]); }
  ok(a.every(function (n) { return n > 8; }), "the offset path always has points");
  ok(ja <= jb + 1e-9 && ja < 0.6, "the point count changes more gently than with the points of the offset itself (" + (ja * 100).toFixed(0) + "% against " + (jb * 100).toFixed(0) + "% per step)");
  var g = G.empty(), c = G.addNode(g, "polygon", 0, 0), o = G.addNode(g, "offsetp", 0, 0, Object.assign(G.defaultParams("offsetp"), { dist: 10, step: 1 }));
  G.connect(g, c.id, o.id, "in"); var src = G.evaluate(g, c.id, {}).loops[0], r = G.evaluate(g, o.id, {}).loops[0], sp = [];
  for (var k = 0; k < r.pts.length; k++) sp.push(Math.hypot(r.pts[(k + 1) % r.pts.length][0] - r.pts[k][0], r.pts[(k + 1) % r.pts.length][1] - r.pts[k][1]));
  ok(Math.max.apply(null, sp) - Math.min.apply(null, sp) < 0.2 * Math.max.apply(null, sp) + 1e-6, "the points are equally spaced");
  var d0 = Math.hypot(r.pts[0][0] - src.pts[0][0], r.pts[0][1] - src.pts[0][1]);
  ok(d0 < 25, "the loop starts near where the loop that went in started (" + d0.toFixed(1) + " mm)");
})();
/* Interlace smooths the direction of the path it follows (V140) */
(function () {
  var g = G.empty(), c = G.addNode(g, "circle", 0, 0), w = G.addNode(g, "wobble", 0, 0, Object.assign(G.defaultParams("wobble"), { amp: 0.6, size: 2 })), i = G.addNode(g, "ginterlace", 0, 0, Object.assign(G.defaultParams("ginterlace"), { strands: 3, height: 70, thick: 10 }));
  G.connect(g, c.id, w.id, "in"); G.connect(g, w.id, i.id, "in");
  var r = G.evaluate(g, i.id, {}), n = 0, rough = 0;
  r.paths.forEach(function (p) { for (var k = 0; k < p.length; k++) { var a = p[k], b = p[(k + 1) % p.length], c2 = p[(k + 2) % p.length], d = Math.abs(Math.atan2(c2.Y - b.Y, c2.X - b.X) - Math.atan2(b.Y - a.Y, b.X - a.X)); if (d > Math.PI) d = 2 * Math.PI - d; if (d > 0.05 && d < 1) rough++; n++; } });
  ok(r.kind === "shape" && n > 1000, "interlace on a wobbling path still makes a shape");
  ok(rough / n < 0.85, "the strands are smoother than the path they follow (" + (rough / n * 100).toFixed(0) + "% of the edge points still turn slightly, 91% before)");
})();
/* Groups and names (V142) */
(function () {
  var g = G.empty(), c = G.addNode(g, "circle", 0, 0), r2 = G.addNode(g, "round", 100, 0), st = G.addNode(g, "stroke", 200, 0), o = G.addNode(g, "output", 300, 0);
  G.connect(g, c.id, r2.id, "in"); G.connect(g, r2.id, st.id, "in"); G.connect(g, st.id, o.id, "in");
  var a0 = areaOf(G.evaluate(g, o.id, {}).paths);
  var mk = G.makeGroup(g, [r2.id, st.id], "Ring maker");
  ok(!mk.err && G.group(g, mk.id).nodes.length === 2, "two nodes make a group");
  var pt = G.groupPorts(g, mk.id);
  ok(pt.ins.length === 1 && pt.ins[0].node === r2.id && pt.outs.length === 1 && pt.outs[0].node === st.id, "the ports are the wires that cross the border");
  ok(areaOf(G.evaluate(g, o.id, {}).paths) === a0, "a group does not change the result");
  G.group(g, mk.id).off = "cut";
  ok(!G.evaluate(g, o.id, {}).kind, "a group that is cut loose leaves its user without input");
  ok(G.evaluate(g, st.id, {}).kind === "shape", "the nodes inside still work on their own");
  G.group(g, mk.id).off = "empty";
  var em = G.evaluate(g, o.id, {}); ok(em.kind === "shape" && em.paths.length === 0, "a group that gives nothing gives an empty shape to its users");
  G.group(g, mk.id).off = "bypass";
  var bp = G.evaluate(g, o.id, {}); ok(bp.kind === "shape" && areaOf(bp.paths) !== a0, "a group in pass through shows the input of its output node");
  delete G.group(g, mk.id).off;
  ok(areaOf(G.evaluate(g, o.id, {}).paths) === a0, "enabling the group brings the result back");
  var back = G.norm(JSON.parse(JSON.stringify(g)));
  ok(G.group(back, mk.id) && G.group(back, mk.id).name === "Ring maker" && G.members(back, mk.id).length === 2, "groups survive save and load");
  var outer = G.makeGroup(g, [mk.id, c.id], "Everything");
  ok(!outer.err && G.members(g, outer.id).length === 3 && G.parentOf(g, mk.id).id === outer.id, "a group can hold a group");
  var bad = G.makeGroup(g, [r2.id, o.id]);
  ok(!!bad.err, "items from different levels are refused");
  G.removeFromGroup(g, [mk.id]); ok(G.parentOf(g, mk.id) === null, "an item can be taken out of a group");
  G.ungroup(g, outer.id); ok(!G.group(g, outer.id) && G.group(g, mk.id), "ungroup dissolves one level");
  G.removeNode(g, r2.id); G.removeNode(g, st.id);
  ok(!G.group(g, mk.id), "an empty group disappears");
  var n2 = G.norm({ nodes: [{ id: "n1", type: "circle", x: 0, y: 0, name: "  Middle  " }], wires: [] });
  ok(n2.nodes[0].name === "Middle", "a node keeps its own name");
})();
/* The view of groups (V142) */
(function () {
  var g = G.empty(), a = G.addNode(g, "circle", 0, 0), b = G.addNode(g, "round", 200, 0), c = G.addNode(g, "stroke", 400, 0), d = G.addNode(g, "output", 600, 0), e = G.addNode(g, "circle", 200, 60);
  G.connect(g, a.id, b.id, "in"); G.connect(g, b.id, c.id, "in"); G.connect(g, c.id, d.id, "in");
  var m = G.makeGroup(g, [b.id, c.id], "X"), o = { nodes: g.nodes.map(function (n) { return n.id; }), WN: 160, nodeH: function () { return 44; }, label: function (n) { return G.TYPES[n.type].label; } };
  var v = G.view(g, o);
  ok(Object.keys(v.boxes).length === 1 && v.hidden[b.id] === m.id && v.hidden[c.id] === m.id && !v.pos[b.id], "a closed group is one black box and hides its nodes");
  ok(v.boxes[m.id].ins.length === 1 && v.boxes[m.id].outs.length === 1 && v.boxes[m.id].w >= 160, "the box has a port for each wire across its border");
  G.group(g, m.id).open = true; v = G.view(g, o);
  ok(v.frames.length === 1 && v.pos[b.id] && !v.boxes[m.id], "an open group is a frame round its nodes");
  var f = v.frames[0], pe = v.pos[e.id];
  ok(!(pe.x < f.x + f.w && pe.x + 160 > f.x && pe.y < f.y + f.h && pe.y + 44 > f.y), "an item in the way is pushed out of the frame");
  ok(G.node(g, e.id).x === 200 && G.node(g, e.id).y === 60, "the push is only a view: the stored place stays");
  var inner = G.makeGroup(g, [b.id], "inner"); G.group(g, inner.id).open = false;
  v = G.view(g, o);
  ok(v.boxes[inner.id] && v.frames.length === 1, "a closed group inside an open one is a box inside the frame");
})();
console.log(fails ? fails + " FAILED" : "all passed"); process.exit(fails ? 1 : 0);
