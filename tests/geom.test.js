/* Run with: node tests/geom.test.js */
const G = require("../js/geom.js");
let failed = 0;
function ok(cond, msg) { if (!cond) { failed++; console.log("FAIL", msg); } else console.log("ok  ", msg); }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + " (" + a + " vs " + b + ")"); }

// stadium area = rectangle + circle
const st = G.preset({ type: "stadium", w: 2400, h: 1200 });
const stArea = G.area(G.flatten(st, 0.02));
near(stArea, (2400 - 1200) * 1200 + Math.PI * 600 * 600, 200, "stadium area");
ok(G.area(G.flatten(st, 1)) > 0, "canonical direction");

// outward offset of a stadium by 150 mm is a stadium of 2700 x 1500
const off = G.offsetPolygon(G.flatten(st, 0.05), 150, 0.05);
near(G.area(off), (2700 - 1500) * 1500 + Math.PI * 750 * 750, 600, "outward offset area");
const inn = G.offsetPolygon(G.flatten(st, 0.05), -100, 0.05);
near(G.area(inn), (2200 - 1000) * 1000 + Math.PI * 500 * 500, 600, "inward offset area");
ok(G.offsetPolygon(G.flatten(st, 0.05), -700, 0.05).length === 0, "too deep inward offset vanishes");

// rectangle with rounded corners
const rr = G.preset({ type: "rect", w: 1000, h: 600, r: 100 });
near(G.area(G.flatten(rr, 0.02)), 1000 * 600 - (4 - Math.PI) * 100 * 100, 20, "rounded rectangle area");

// octagon
const oc = G.preset({ type: "octagon", w: 1000, h: 600, chamfer: 100 });
near(G.area(G.flatten(oc, 1)), 1000 * 600 - 4 * 100 * 100 / 2, 1, "octagon area");
ok(oc.length === 8, "octagon has 8 nodes");

// dealer notch (box) removes area and keeps one closed loop
const nb = G.preset({ type: "stadium", w: 2400, h: 1200, notch: { on: true, style: "box", side: "bottom", w: 600, d: 150, r: 40, rm: 40 } });
const nbArea = G.area(G.flatten(nb, 0.02));
ok(nbArea < stArea - 600 * 150 * 0.8 && nbArea >= stArea - 600 * 150 - 1, "box notch removes about w*d: " + (stArea - nbArea));
// scoop notch
const ns = G.preset({ type: "rect", w: 2400, h: 1200, r: 0, notch: { on: true, style: "scoop", side: "bottom", w: 600, d: 150 } });
const R = (300 * 300 + 150 * 150) / (2 * 150), th = 2 * Math.asin(300 / R);
const seg = R * R / 2 * (th - Math.sin(th));
near(G.area(G.flatten(ns, 0.01)), 2400 * 1200 - seg, 5, "scoop notch area");

// offsetting a notched outline outward keeps a valid loop that is larger
const nbPoly = G.flatten(nb, 0.1);
const nbOff = G.offsetPolygon(nbPoly, 80, 0.1);
ok(G.area(nbOff) > G.area(nbPoly), "notched outline offset outward grows");
const nbIn = G.offsetPolygon(nbPoly, -80, 0.1);
ok(G.area(nbIn) < G.area(nbPoly) && G.area(nbIn) > 0, "notched outline offset inward shrinks");
// every point of the inward offset is about 80 mm from the outline
let worst = 0;
nbIn.forEach(p => { worst = Math.max(worst, Math.abs(G.nearestOnPoly(nbPoly, p).d - 80)); });
ok(worst < 1.0, "inward offset keeps its distance (worst error " + worst.toFixed(3) + ")");

// reverse nodes keeps the shape
const rev = G.reverseNodes(nb);
near(Math.abs(G.area(G.flatten(rev, 0.02))), nbArea, 5, "reverse keeps area");
ok(G.area(G.flatten(rev, 1)) < 0, "reverse flips direction");

// splitSegment keeps the outline
const sp = G.splitSegment(st, 1);
near(G.area(G.flatten(sp, 0.02)), stArea, 200, "split arc keeps area");
ok(sp.length === st.length + 1, "split adds a node");

// bulge from apex round trip
const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
const apex = G.apexOf(a, b, 0.5);
near(G.bulgeFromApex(a, b, apex), 0.5, 1e-9, "bulge round trip");

// zipper triangulation covers the ring area
const outerP = G.offsetPolygon(G.flatten(st, 0.2), 150, 0.2), innerP = G.flatten(st, 0.2);
const tris = G.zipper(outerP, innerP);
const all = outerP.concat(innerP);
let triArea = 0;
tris.forEach(t => { triArea += Math.abs(G.area(t.map(i => all[i]))); });
near(triArea, G.area(outerP) - G.area(innerP), 800, "zipper covers ring area");

// svg path of a stadium has arcs
ok(/A/.test(G.svgPath(st)), "svg path uses arcs");

// splitAt keeps the shape: split a stadium arc at an off-centre point
const st2 = G.preset({ type: "stadium", w: 2400, h: 1200 });
let arcIdx = st2.findIndex(n => Math.abs(n.b) > 0.3);
const ap = G.apexOf(st2[arcIdx], st2[(arcIdx + 1) % st2.length], st2[arcIdx].b);
const sp2 = G.splitAt(st2, arcIdx, { x: ap.x + 5, y: ap.y - 300 });
near(G.area(G.flatten(sp2, 0.02)), stArea, 200, "splitAt on an arc keeps the area");
const lineIdx = st2.findIndex(n => Math.abs(n.b) < 1e-9);
const q0 = st2[lineIdx], q1 = st2[(lineIdx + 1) % st2.length];
const sp3 = G.splitAt(st2, lineIdx, { x: (q0.x + q1.x) / 2 + 50, y: (q0.y + q1.y) / 2 + 40 });
near(G.area(G.flatten(sp3, 0.02)), stArea, 200, "splitAt on a line keeps the area");
ok(sp3.length === st2.length + 1, "splitAt adds one node");
const ns2 = G.nearestSegment(st2, [0, -700]);
ok(ns2.d > 90 && ns2.d < 110, "nearestSegment distance " + ns2.d.toFixed(1));
// inward offset of an octagon with short end edges stays mirror symmetric (a short edge must not collapse into a tip on one side only)
const oct = [[110, 290], [267, 132], [875, 132], [1032, 290], [1032, 388], [875, 545], [267, 545], [110, 388]];
const oo = G.offsetPolygon(oct, -75, 0.1);
ok(oo.length === 8, "short end edges survive an inward offset: " + oo.length + " points");
const xs0 = oo.map(p => p[0]), cx0 = (Math.min(...xs0) + Math.max(...xs0)) / 2;
const mirrorOk = oo.every(p => oo.some(q => Math.abs((2 * cx0 - p[0]) - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5 || Math.abs(p[1] - q[1]) < 0.5 && Math.abs((2 * (Math.min(...oo.map(r => r[0])) + Math.max(...oo.map(r => r[0]))) / 2 - p[0]) - q[0]) < 0.5));
ok(mirrorOk, "the offset octagon is mirror symmetric");
process.exit(failed ? 1 : 0);
