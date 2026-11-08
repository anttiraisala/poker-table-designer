/* The procedural graph (REQ-049 to REQ-052): one node graph for the whole project. Nodes make, change and combine PATHS and SHAPES;
 * an Output node is the end of a chain and belongs to one layer of the artwork. No browser parts, so it is tested with Node.
 * graph = { nodes: [{ id, type, x, y, p: { parameters }, exp: [{ key, label, min, max }] }], wires: [{ from, to, port }] }
 * A path value is { kind: "path", loops: [{ pts, closed, flip, start }] }, a shape value { kind: "shape", paths: [Clipper integer paths] }. */
(function (PTD) {
  "use strict";
  var G = {}, P = null;
  function paths() { return P || (P = typeof window !== "undefined" ? PTD.paths : require("./paths.js")); }
  G.useClipper = function (c) { paths().useClipper(c); };
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rngOf(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- the node types ---------- */
  var N = function (key, label, tip, o) { return Object.assign({ key: key, label: label, tip: tip, t: "num", step: "any" }, o || {}); };
  var COMMON_GEN = [
    N("thick", "Thickness (mm)", "Thickness of the line that is drawn.", { min: 0.5, def: 12 }),
    N("side", "Side", "Where the line lies. Outside and inside are for closed paths, left and right for open ones.", { t: "sel", opts: [["centre", "On the path"], ["outside", "Outside"], ["inside", "Inside"], ["left", "Left"], ["right", "Right"]], def: "centre" }),
    N("dist", "Distance (mm)", "How far from the path the line lies, on the chosen side.", { min: 0, def: 0 }),
    N("scope", "Corners", "Over the whole path, or restarted on every straight side between corners.", { t: "sel", opts: [["whole", "One pattern over the whole path"], ["sides", "Repeat on every side"]], def: "whole" })
  ];
  var REPEAT = [
    N("mode", "Repeat by", "Number of repeats always ends exactly where it starts; a length is a distance in millimetres.", { t: "sel", opts: [["count", "Number of repeats"], ["length", "Length of one repeat"]], def: "count" }),
    N("n", "Repeats", "How many repeats fit on the whole path.", { t: "int", min: 1, def: 12, step: "1", when: function (p) { return p.mode === "count"; } }),
    N("len", "Repeat length (mm)", "Length of one repeat along the path.", { min: 5, def: 150, when: function (p) { return p.mode === "length"; } }),
    N("fit", "Fit to a whole number", "On: the length is adjusted a little so a whole number of repeats fits. Off: the exact length is kept and the end may be cut.", { t: "chk", when: function (p) { return p.mode === "length"; } }),
    N("phase", "Phase (0 to 1)", "Slides the pattern along the path by a fraction of one repeat.", { min: 0, max: 1, step: "0.05", def: 0 })
  ];
  var T = {};
  function add(key, o) { o.key = key; T[key] = o; }
  /* sources */
  var PATHKEYS = [N("reverse", "Reversed", "Walk the path the other way: left and right swap on an open path, inside and outside on a closed one.", { t: "chk" }), N("start", "Start (0 to 1)", "Where a closed path starts, as a fraction of its length.", { min: 0, max: 1, step: "0.05", def: 0 })];
  add("circle", { cat: "Sources", label: "Circle", out: "path", ins: [], params: [N("cx", "Centre X (mm)", "Centre of the circle, millimetres from the artwork origin.", { def: 0 }), N("cy", "Centre Y (mm)", "Centre of the circle, millimetres from the artwork origin.", { def: 0 }), N("r", "Radius (mm)", "Radius of the circle.", { min: 1, def: 300 })].concat(PATHKEYS) });
  add("polygon", { cat: "Sources", label: "Polygon", out: "path", ins: [], params: [N("cx", "Centre X (mm)", "Centre of the polygon.", { def: 0 }), N("cy", "Centre Y (mm)", "Centre of the polygon.", { def: 0 }), N("r", "Radius (mm)", "Radius of the corner points.", { min: 1, def: 300 }), N("sides", "Sides", "Number of sides, 3 to 64.", { t: "int", min: 3, max: 64, step: "1", def: 6 }), N("rot", "Turn (°)", "Turns the polygon. 0 puts a corner at the top.", { def: 0 }), N("cr", "Corner radius (mm)", "Rounds every corner. 0 is sharp.", { min: 0, def: 0 })].concat(PATHKEYS) });
  add("lines", { cat: "Sources", label: "Lines", out: "path", ins: [], params: [N("closed", "Closed", "A closed path is a loop; an open one has a start and an end.", { t: "chk" })].concat(PATHKEYS), custom: "lines" });
  add("table", { cat: "Sources", label: "Table line", out: "path", ins: [], params: [N("which", "Line", "Which line of the table.", { t: "sel", opts: [["outline", "Table outline"], ["rail", "Rail (outer edge)"], ["wrap", "Wrap line"], ["bet", "Player-area line"]], def: "outline" }), N("dist", "Distance (mm)", "Moves a closed line outward (positive) or inward (negative).", { def: 0 })].concat(PATHKEYS), custom: "table" });
  add("objects", { cat: "Sources", label: "Objects: outer edge (path)", out: "path", ins: [], params: [N("dist", "Distance (mm)", "Moves the edge outward (positive) or inward (negative) from the ink.", { def: 20 }), N("close", "Closing (mm)", "Fills gaps and notches narrower than twice this value, so the outline is smooth.", { min: 0, def: 40 }), N("shape", "Islands", "What to do with separate pieces.", { t: "sel", opts: [["islands", "Each piece (islands)"], ["hull", "Convex hull of all"], ["box", "Rounded box of all"]], def: "islands" }), N("holes", "Follow holes too", "Also make a path round the holes (the middle of an O).", { t: "chk" }), N("halo", "Halo", "Follow only the letters, the letters with their halo, or keep the shape as it is now.", { t: "sel", opts: [["ink", "Follow the ink only"], ["halo", "Ink plus the halo"], ["frozen", "Frozen (no longer follows)"]], def: "ink" })].concat(PATHKEYS), custom: "objects" });
  /* inputs that take another element of the artwork or a table as a SHAPE (their geometry); the edge of objects as a path is "objects" above */
  add("layer", { cat: "Sources", plain: true, items: true, label: "Objects: geometry (shape)", out: "shape", ins: [], tip: "The real shape of the chosen texts, glyphs or patterns (or one group), as it is now and following them when they change. Use it to cut, combine or follow the actual letters; Objects: outer edge makes a path round them instead.", params: [N("halo", "Halo", "Take only the letters, or the letters with their halo.", { t: "sel", opts: [["ink", "The ink only"], ["halo", "Ink plus the halo"]], def: "ink" }), N("dist", "Grow (mm)", "Grows (positive) or shrinks (negative) the shape.", { def: 0 })] });
  add("tablearea", { cat: "Sources", plain: true, tablekey: true, label: "Table: area (shape)", out: "shape", ins: [], tip: "The area inside a line of a table, as a shape: use it to intersect a pattern with the table, or to subtract the table from a box.", params: [N("which", "Line", "Which line of the table.", { t: "sel", opts: [["outline", "Table outline"], ["rail", "Rail (outer edge)"], ["wrap", "Wrap line"], ["bet", "Player-area line"]], def: "outline" }), N("dist", "Grow (mm)", "Grows (positive) or shrinks (negative) the area.", { def: 0 })] });
  /* path modifiers */
  add("offsetp", { cat: "Path", label: "Offset path", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("dist", "Distance (mm)", "Moves a closed path outward (positive) or inward (negative); an open path sideways (left is positive).", { def: 10 })] });
  add("round", { cat: "Path", label: "Round corners", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("radius", "Radius (mm)", "Rounds every corner of the path with this radius.", { min: 0, def: 20 })] });
  add("trim", { cat: "Path", label: "Trim", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("from", "From (0 to 1)", "Where the piece starts, as a fraction of the path length.", { min: 0, max: 1, step: "0.05", def: 0 }), N("len", "Length (0 to 1)", "How much of the path is kept, as a fraction of its length.", { min: 0.01, max: 1, step: "0.05", def: 0.5 })] });
  add("outline", { cat: "Path", label: "Edge of shape (path)", out: "path", ins: [{ port: "in", kind: "shape" }], tip: "Turns the outlines of a shape into closed paths, so patterns can follow the edge of any shape.", params: [N("holes", "Holes too", "Also make a path round every hole.", { t: "chk" })] });
  add("reverse", { cat: "Path", label: "Reverse", out: "path", ins: [{ port: "in", kind: "path" }], params: [] });
  add("sinep", { cat: "Path", label: "Sine bend", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("amp", "Amplitude (mm)", "How far the path swings sideways.", { min: 0, def: 10 }), N("freq", "Frequency (repeats)", "How many waves fit along the whole path (0 to 1 of its length). A closed path uses whole waves.", { min: 0.1, def: 8, step: "0.5" }), N("phase", "Phase (0 to 1)", "Slides the wave along the path.", { min: 0, max: 1, step: "0.05", def: 0 })] });
  add("wobble", { cat: "Path", label: "Wiggle", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("amp", "Amplitude (mm)", "How far the path wanders sideways.", { min: 0, def: 8 }), N("size", "Size (mm)", "How long one wobble is along the path: small is nervous, large is slow.", { min: 2, def: 80 }), N("seed", "Seed", "A different number gives a different wobble.", { t: "int", step: "1", def: 1 })] });
  /* shape makers */
  function genType(key, label, gen, extra) { add(key, { cat: "Shapes", label: label, out: "shape", ins: [{ port: "in", kind: "path" }], gen: gen, params: extra }); }
  genType("stroke", "Stroke", "line", [N("thick", "Thickness (mm)", "Thickness of the line.", { min: 0.5, def: 12 })].concat(COMMON_GEN.slice(1)));
  genType("gsine", "Sine wave", "sine", [COMMON_GEN[0], N("height", "Height (mm)", "How far the wave swings across the path, peak to peak.", { min: 0, def: 60 })].concat(REPEAT, COMMON_GEN.slice(1)));
  genType("gscroll", "Running dog", "scroll", [COMMON_GEN[0], N("height", "Height (mm)", "Height of the scroll across the path.", { min: 0, def: 90 })].concat(REPEAT, COMMON_GEN.slice(1)));
  genType("ginterlace", "Interlace", "interlace", [COMMON_GEN[0], N("height", "Height (mm)", "Width of the band the strands weave in.", { min: 0, def: 70 }), N("strands", "Strands", "Number of strands: 2 is a chain, 3 a braid.", { t: "int", min: 2, max: 8, step: "1", def: 2 }), N("gap", "Gap (mm)", "Gap cut into the strand that goes under at a crossing.", { min: 0, def: 5 })].concat(REPEAT, COMMON_GEN.slice(1)));
  genType("gfoliage", "Foliage", "foliage", [N("thick", "Stem thickness (mm)", "Thickness of the stem along the path.", { min: 0.5, def: 5 }), N("stem", "Stem", "Draw a stem along the path.", { t: "chk" }), N("height", "Leaf length (mm)", "Length of a leaf.", { min: 1, def: 70 }), N("leafW", "Leaf width (mm)", "Width of a leaf.", { min: 1, def: 26 }), N("angle", "Leaf angle (°)", "Angle between a leaf and the path.", { min: 0, max: 89, def: 50 }), N("jit", "Randomness (0 to 1)", "How much the leaves differ in size and angle.", { min: 0, max: 1, step: "0.05", def: 0.3 }), N("seed", "Seed", "A different number gives different leaves.", { t: "int", step: "1", def: 1 }), N("mode", "Leaves by", "Number of leaves, or the distance between them.", { t: "sel", opts: [["count", "Number of leaves"], ["length", "Distance between leaves"]], def: "count" }), N("n", "Leaves", "How many leaves.", { t: "int", min: 1, def: 14, step: "1", when: function (p) { return p.mode === "count"; } }), N("len", "Distance (mm)", "Distance between leaves.", { min: 5, def: 60, when: function (p) { return p.mode === "length"; } }), COMMON_GEN[2]].map(function (x) { return x; }));
  /* shape operators */
  add("union", { cat: "Shapes", label: "Union", out: "shape", ins: [{ port: "in", kind: "shape", multi: true }], params: [] });
  add("intersect", { cat: "Shapes", label: "Intersect", out: "shape", ins: [{ port: "in", kind: "shape", multi: true }], params: [] });
  add("subtract", { cat: "Shapes", label: "Subtract", out: "shape", ins: [{ port: "in", kind: "shape", multi: true }], params: [], tip: "The first shape wired in minus all the others." });
  add("xor", { cat: "Shapes", label: "Xor", out: "shape", ins: [{ port: "in", kind: "shape", multi: true }], params: [] });
  add("offset", { cat: "Shapes", label: "Offset", out: "shape", ins: [{ port: "in", kind: "shape" }], params: [N("dist", "Distance (mm)", "Grows (positive) or shrinks (negative) the shape.", { def: 10 })] });
  add("fill", { cat: "Shapes", label: "Fill holes", out: "shape", ins: [{ port: "in", kind: "shape" }], tip: "Closes holes in a shape: every hole, or only holes smaller than a limit, so that holes you made on purpose can stay. Use it after shapes that overlap and cut holes into each other.", params: [N("all", "Every hole", "On: all holes are closed. Off: only holes with an area up to the limit below are closed.", { t: "chk", def: true }), N("maxArea", "Largest hole to close (mm²)", "Holes with at most this area are closed; bigger ones stay.", { min: 0, def: 500, when: function (p) { return !p.all; } })] });
  add("negate", { cat: "Shapes", label: "Negate", out: "shape", ins: [{ port: "in", kind: "shape" }, { port: "universe", kind: "path", optional: true }], params: [N("margin", "Margin (mm)", "When no closed path is wired to Universe, the universe is the box round the shape plus this margin.", { min: 0, def: 50 })] });
  add("output", { cat: "Output", label: "Output", out: null, ins: [{ port: "in", kind: "any" }], params: [] });
  G.TYPES = T;
  G.catalog = function () { return Object.keys(T).filter(function (k) { return k !== "output"; }).map(function (k) { return [k, T[k].label, T[k].cat]; }); };

  /* ---------- the model ---------- */
  G.empty = function () { return { nodes: [], wires: [] }; };
  G.node = function (g, id) { for (var i = 0; i < g.nodes.length; i++) if (g.nodes[i].id === id) return g.nodes[i]; return null; };
  G.nextId = function (g) { var m = 0; g.nodes.forEach(function (n) { var k = parseInt(String(n.id).slice(1), 10); if (isFinite(k) && k > m) m = k; }); return "n" + (m + 1); };
  /* the parameters of a node, normalised and with the defaults */
  G.normParams = function (type, p, id) {
    var ty = T[type], P_ = paths(); p = p && typeof p === "object" ? p : {};
    if (!ty) return {};
    if (ty.cat === "Sources" && !ty.plain) return P_.normPath(Object.assign({}, p, { kind: type }), id);
    if (ty.gen) return P_.normGen(Object.assign({}, P_.defaultGen(ty.gen), p, { type: ty.gen }));
    var o = {};
    ty.params.forEach(function (s) {
      var v = p[s.key];
      if (s.t === "chk") o[s.key] = v == null ? !!s.def : !!v;
      else if (s.t === "sel") o[s.key] = s.opts.some(function (q) { return q[0] === v; }) ? v : s.def;
      else { v = num(v, s.def); if (s.min != null) v = Math.max(s.min, v); if (s.max != null) v = Math.min(s.max, v); o[s.key] = s.t === "int" ? Math.round(v) : v; }
    });
    if (ty.items) o.items = (Array.isArray(p.items) ? p.items : []).map(function (it) { return it && it.g ? { g: String(it.g) } : it && it.l ? { l: String(it.l) } : null; }).filter(Boolean);
    if (ty.tablekey) o.table = String(p.table || "");
    return o;
  };
  G.defaultParams = function (type, id) { return G.normParams(type, T[type] && T[type].cat === "Sources" && !T[type].plain ? paths().defaultPath(type) : {}, id); };
  G.addNode = function (g, type, x, y, p) {
    if (!T[type]) return null;
    var id = G.nextId(g), n = { id: id, type: type, x: Math.round(num(x, 0)), y: Math.round(num(y, 0)), p: G.normParams(type, p || G.defaultParams(type, id), id), exp: [] };
    g.nodes.push(n); return n;
  };
  G.norm = function (o) {
    var g = G.empty(), seen = {};
    o = o && typeof o === "object" ? o : {};
    (Array.isArray(o.nodes) ? o.nodes : []).forEach(function (n) {
      if (!n || !T[n.type]) return;
      var id = String(n.id || ""); if (!id || seen[id]) return; seen[id] = 1;
      var exp = (Array.isArray(n.exp) ? n.exp : []).map(function (e) { return e && e.key ? { key: String(e.key), label: String(e.label || e.key).slice(0, 40), min: num(e.min, 0), max: num(e.max, 100) } : null; }).filter(Boolean);
      g.nodes.push({ id: id, type: n.type, x: Math.round(num(n.x, 0)), y: Math.round(num(n.y, 0)), p: G.normParams(n.type, n.p, id), exp: exp });
    });
    (Array.isArray(o.wires) ? o.wires : []).forEach(function (w) {
      if (!w || !seen[w.from] || !seen[w.to]) return;
      var to = G.node(g, w.to), ins = T[to.type].ins, port = String(w.port || "in");
      if (!ins.some(function (q) { return q.port === port; }) || w.from === w.to) return;
      g.wires.push({ from: String(w.from), to: String(w.to), port: port });
    });
    /* single-input ports take one wire; a graph with a cycle loses the wire that closes it */
    var out = G.empty(); out.nodes = g.nodes;
    g.wires.forEach(function (w) { var r = G.canConnect(out, w.from, w.to, w.port); if (r === "") out.wires.push(w); });
    return out;
  };
  function upstream(g, id, set) {
    set = set || {}; if (set[id]) return set; set[id] = 1;
    g.wires.forEach(function (w) { if (w.to === id) upstream(g, w.from, set); });
    return set;
  }
  G.upstream = function (g, id) { return Object.keys(upstream(g, id)); };
  G.inputsOf = function (g, id, port) { return g.wires.filter(function (w) { return w.to === id && w.port === port; }).map(function (w) { return w.from; }); };
  G.kindOut = function (g, id) { var n = G.node(g, id); return n ? T[n.type].out : null; };
  /* "" when the wire can be made, otherwise the reason */
  G.canConnect = function (g, from, to, port) {
    var a = G.node(g, from), b = G.node(g, to);
    if (!a || !b) return "A node is missing.";
    if (from === to) return "A node cannot be wired to itself.";
    var ty = T[b.type], pin = ty.ins.filter(function (q) { return q.port === port; })[0];
    if (!pin) return "That node has no such input.";
    var ko = T[a.type].out;
    if (!ko) return "The Output node has nothing to give.";
    if (pin.kind !== "any" && pin.kind !== ko) return "A " + ko + " cannot go into a " + pin.kind + " input.";
    if (upstream(g, from)[to]) return "That would make a loop in the graph.";
    return "";
  };
  G.connect = function (g, from, to, port) {
    var why = G.canConnect(g, from, to, port); if (why) return why;
    var b = G.node(g, to), pin = T[b.type].ins.filter(function (q) { return q.port === port; })[0];
    if (!pin.multi) g.wires = g.wires.filter(function (w) { return !(w.to === to && w.port === port); });
    if (!g.wires.some(function (w) { return w.from === from && w.to === to && w.port === port; })) g.wires.push({ from: from, to: to, port: port });
    return "";
  };
  G.removeNode = function (g, id) { g.nodes = g.nodes.filter(function (n) { return n.id !== id; }); g.wires = g.wires.filter(function (w) { return w.from !== id && w.to !== id; }); };

  /* ---------- evaluation ---------- */
  var cache = {}, order = [];
  G.clearCache = function () { cache = {}; order = []; };
  function remember(k, v) { if (!cache[k]) { order.push(k); if (order.length > 400) delete cache[order.shift()]; } cache[k] = v; return v; }
  function eachLoop(loops, f) { return loops.map(f).filter(Boolean); }
  /* points along a loop: the corners and a point at least every `step`, with the arc length of each */
  function dense(l, step) {
    var P_ = paths(), sm = P_.sample({ pts: l.pts, closed: l.closed }, 0), pts = [], us = [], segs = [];
    sm.segs.forEach(function (s) {
      var n = Math.max(1, Math.ceil(s.len / step));
      for (var i = 0; i < n; i++) { var t = s.len * i / n; pts.push([s.a[0] + s.tx * t, s.a[1] + s.ty * t]); us.push(s.s0 + t); segs.push(s); }
    });
    if (!l.closed && sm.segs.length) { var last = sm.segs[sm.segs.length - 1]; pts.push([last.b[0], last.b[1]]); us.push(sm.L); segs.push(last); }
    return { pts: pts, us: us, segs: segs, L: sm.L };
  }
  function displace(l, f) {   /* f(t, u, L) gives the sideways distance; left of the walking direction is positive on the screen */
    var d = dense(l, 2); if (d.L < 1e-6 || d.pts.length < 2) return null;
    var pts = d.pts.map(function (p, i) { var s = d.segs[i], v = f(d.us[i] / d.L, d.us[i], d.L); return [p[0] + s.ty * v, p[1] - s.tx * v]; });
    return Object.assign({}, l, { pts: pts });
  }
  function valueNoise(seed, cells, closed) {
    var r = rngOf(seed), v = [], i; for (i = 0; i < cells + 1; i++) v.push(r() * 2 - 1);
    if (closed) v[cells] = v[0];
    return function (t) { var x = t * cells, i0 = Math.min(cells - 1, Math.floor(x)), f = x - i0, s = f * f * (3 - 2 * f); return v[i0] * (1 - s) + v[i0 + 1] * s; };
  }
  function modifyPath(type, p, loops) {
    var P_ = paths(), C = P_._clip;
    return eachLoop(loops, function (l) {
      if (type === "reverse") return Object.assign({}, l, { pts: l.pts.slice().reverse(), flip: !l.flip });
      if (type === "round") { var rad = l.pts.map(function () { return p.radius; }); return p.radius > 0 ? Object.assign({}, l, { pts: P_.roundCorners(l.pts, rad, l.closed) }) : l; }
      if (type === "offsetp") {
        if (!l.closed) return displace(l, function () { return p.dist; });
        var o = C.offsetPaths([C.toInt(l.pts)], p.dist); if (!o.length) return null;
        var best = o.map(function (q) { return C.fromInt(q); }).sort(function (a, b) { return b.length - a.length; })[0];
        var pts = best, s = 0; for (var i = 0; i < pts.length; i++) { var q = pts[(i + 1) % pts.length]; s += pts[i][0] * q[1] - q[0] * pts[i][1]; }
        if (s < 0) pts = pts.slice().reverse();
        if (l.flip) pts = pts.slice().reverse();
        return Object.assign({}, l, { pts: pts });
      }
      if (type === "sinep") {
        var fr = l.closed ? Math.max(1, Math.round(p.freq)) : p.freq;
        return displace(l, function (t) { return p.amp * Math.sin(2 * Math.PI * (fr * t + p.phase)); });
      }
      if (type === "wobble") {
        var dd = dense(l, 2), cells = Math.max(1, Math.round(dd.L / Math.max(2, p.size))), nz = valueNoise(p.seed, cells, l.closed);
        return displace(l, function (t) { return p.amp * nz(Math.min(t, 0.999999)); });
      }
      if (type === "trim") {
        var dn = dense(l, 2); if (dn.L < 1e-6) return null;
        var a = p.from * dn.L, b = a + p.len * dn.L, out = [];
        if (l.closed && p.from === 0 && p.len >= 1) return l;
        var n = dn.pts.length, sm = P_.sample({ pts: l.pts, closed: l.closed }, 0), cnt = Math.max(2, Math.ceil((b - a) / 2));
        for (var k = 0; k <= cnt; k++) {
          var u = a + (b - a) * k / cnt; if (l.closed) u = ((u % dn.L) + dn.L) % dn.L; else u = Math.min(u, dn.L - 1e-9);
          var f = P_.frameAt(sm, u); out.push([f.x, f.y]);
        }
        return out.length > 1 ? Object.assign({}, l, { pts: out, closed: false }) : null;
      }
      return l;
    });
  }
  function shapeOp(type, p, ins) {
    var C = paths()._clip, CL = null;
    function clipOp(a, b, kind) {
      var Lb = typeof window !== "undefined" ? window.ClipperLib : require("./clipper.js"), c = new Lb.Clipper(), sol = [];
      c.AddPaths(a, Lb.PolyType.ptSubject, true); c.AddPaths(b, Lb.PolyType.ptClip, true);
      c.Execute(kind(Lb), sol, Lb.PolyFillType.pftNonZero, Lb.PolyFillType.pftNonZero); return sol;
    }
    if (type === "union") return C.unionPaths([].concat.apply([], ins), false);
    if (type === "intersect") { var acc = ins[0]; for (var i = 1; i < ins.length; i++) acc = clipOp(acc, ins[i], function (L) { return L.ClipType.ctIntersection; }); return acc; }
    if (type === "xor") { var ac2 = ins[0]; for (var j = 1; j < ins.length; j++) ac2 = clipOp(ac2, ins[j], function (L) { return L.ClipType.ctXor; }); return ac2; }
    if (type === "subtract") { var rest = ins.slice(1); return rest.length ? C.diffPaths(ins[0], C.unionPaths([].concat.apply([], rest), false)) : ins[0]; }
    if (type === "offset") return C.offsetPaths(ins[0], p.dist);
    if (type === "fill") {
      var CLb = typeof window !== "undefined" ? window.ClipperLib : require("./clipper.js");
      return C.unionPaths(ins[0].filter(function (q) { return CLb.Clipper.Orientation(q) || (!p.all && Math.abs(CLb.Clipper.Area(q)) / 1e6 > p.maxArea); }), false);
    }
    return [];
  }
  /* a signature of the node and everything that feeds it; env.sigOf(node) adds what the node reads from outside (tables, objects) */
  G.sig = function (g, id, env, memo) {
    memo = memo || {}; if (memo[id] != null) return memo[id];
    var n = G.node(g, id); if (!n) return "?";
    memo[id] = "…";
    var parts = [n.type, n.p], ins = g.wires.filter(function (w) { return w.to === id; }).map(function (w) { return w.port + ":" + G.sig(g, w.from, env, memo); });
    parts.push(ins); if (env && env.sigOf) parts.push(env.sigOf(n));
    return (memo[id] = JSON.stringify(parts));
  };
  /* Evaluates a node: { kind, loops | paths, err } */
  G.evaluate = function (g, id, env, memo) {
    env = env || {}; memo = memo || { sig: {}, val: {} };
    if (memo.val[id]) return memo.val[id];
    var n = G.node(g, id); if (!n) return { kind: null, err: "The node is missing." };
    var sg = G.sig(g, id, env, memo.sig), hit = cache[sg];
    if (hit) { memo.val[id] = hit; return hit; }
    var ty = T[n.type], P_ = paths(), res;
    memo.val[id] = { kind: null, err: "The graph has a loop." };
    function get(port) {
      return G.inputsOf(g, id, port).map(function (f) { return G.evaluate(g, f, env, memo); });
    }
    function missing(what) { return { kind: null, err: "“" + ty.label + "” has no " + what + " connected." }; }
    if (n.type === "layer") {
      var C0 = P_._clip, srcs = env.sources ? env.sources(n.p.items) : [], parts = [];
      srcs.forEach(function (sr) {
        var rings = sr.rings.filter(function (r) { return r.length > 2; }).map(C0.toInt); if (!rings.length) return;
        var one = C0.unionPaths(rings, true);
        if (n.p.halo === "halo" && sr.halo > 0) one = C0.offsetPaths(one, sr.halo);
        one.forEach(function (q) { parts.push(q); });
      });
      var all = parts.length ? C0.unionPaths(parts, false) : [];
      if (all.length && Math.abs(n.p.dist) > 1e-9) all = C0.offsetPaths(all, n.p.dist);
      res = all.length ? { kind: "shape", paths: all, err: "" } : { kind: null, err: n.p.items.length ? "The chosen objects have no shape yet." : "“Objects: geometry” has no objects chosen." };
    } else if (n.type === "tablearea") {
      var C1 = P_._clip, tl = env.tableLoops ? env.tableLoops(n.p.table, n.p.which) : [], tp = tl.filter(function (l) { return l.closed && l.pts.length > 2; }).map(function (l) { return C1.toInt(l.pts); });
      if (tp.length) { tp = C1.unionPaths(tp, false); if (Math.abs(n.p.dist) > 1e-9) tp = C1.offsetPaths(tp, n.p.dist); }
      res = tp.length ? { kind: "shape", paths: tp, err: "" } : { kind: null, err: "That table line is closed nowhere: there is no area." };
    } else if (n.type === "outline") {
      var sv = get("in")[0], C2 = P_._clip;
      if (!sv) res = missing("shape"); else if (!sv.kind) res = sv;
      else if (sv.kind !== "shape") res = { kind: null, err: "“Edge of shape” needs a shape." };
      else {
        var lp = [];
        sv.paths.forEach(function (q) {
          var sg = 0; for (var i = 0; i < q.length; i++) { var w = q[(i + 1) % q.length]; sg += q[i].X * w.Y - w.X * q[i].Y; }
          var pts = C2.fromInt(q);
          /* outer rings are positive in Clipper's own axes; holes negative */
          if (sg < 0 && !n.p.holes) return;
          if (sg < 0) pts = pts.slice().reverse();   /* every loop is walked clockwise on the screen, holes too */
          lp.push({ pts: pts, closed: true, flip: false, start: 0 });
        });
        res = lp.length ? { kind: "path", loops: lp, err: "" } : { kind: null, err: "The shape has no outer edge." };
      }
    } else if (ty.cat === "Sources") {
      var pobj = Object.assign({}, n.p, { kind: n.type }), r = P_.loops(pobj, env);
      if (r.err && !r.loops.length) res = { kind: null, err: r.err };
      else res = { kind: "path", loops: r.loops.map(function (l) { return Object.assign({}, l, { start: pobj.start }); }), err: r.err || "" };
    } else if (n.type === "output") {
      var iv = get("in")[0]; res = iv || missing("input");
    } else if (ty.out === "path") {
      var pin = get("in")[0];
      if (!pin) res = missing("path"); else if (!pin.kind) res = pin;
      else { var ls = modifyPath(n.type, n.p, pin.loops); res = ls.length ? { kind: "path", loops: ls, err: "" } : { kind: null, err: "“" + ty.label + "” left nothing of the path." }; }
    } else if (ty.gen) {
      var pv = get("in")[0];
      if (!pv) res = missing("path"); else if (!pv.kind) res = pv;
      else {
        var gp = P_.normGen(Object.assign({}, n.p, { type: ty.gen })), acc = [];
        pv.loops.forEach(function (l) { var sm = P_.sample(l, l.closed ? (l.start || 0) : 0); if (sm.L >= 1) acc = acc.concat(P_.genOnLoop(sm, gp, l.flip)); });
        acc = acc.length ? P_._clip.unionPaths(acc, false) : acc;
        res = acc.length ? { kind: "shape", paths: acc, err: "" } : { kind: null, err: "“" + ty.label + "” drew nothing." };
      }
    } else if (ty.out === "shape") {
      var vals = get("in"), bad = vals.filter(function (v) { return !v.kind; })[0];
      if (!vals.length) res = missing("shape"); else if (bad) res = bad;
      else if (vals.some(function (v) { return v.kind !== "shape"; })) res = { kind: null, err: "“" + ty.label + "” needs shapes, not paths." };
      else if (n.type === "negate") {
        var C = P_._clip, shp = vals[0].paths, uni = get("universe")[0], box;
        if (uni && uni.kind === "path") box = C.unionPaths(uni.loops.filter(function (l) { return l.closed; }).map(function (l) { return C.toInt(l.pts); }), false);
        if (!box || !box.length) {
          var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; shp.forEach(function (q) { q.forEach(function (v) { x0 = Math.min(x0, v.X); x1 = Math.max(x1, v.X); y0 = Math.min(y0, v.Y); y1 = Math.max(y1, v.Y); }); });
          var m = n.p.margin * 1000; box = [[{ X: x0 - m, Y: y0 - m }, { X: x1 + m, Y: y0 - m }, { X: x1 + m, Y: y1 + m }, { X: x0 - m, Y: y1 + m }]];
        }
        var d = C.diffPaths(box, shp); res = d.length ? { kind: "shape", paths: d, err: "" } : { kind: null, err: "“Negate” left nothing." };
      } else {
        var o = shapeOp(n.type, n.p, vals.map(function (v) { return v.paths; }));
        res = o.length ? { kind: "shape", paths: o, err: "" } : { kind: null, err: "“" + ty.label + "” left nothing." };
      }
    } else res = { kind: null, err: "Unknown node." };
    remember(sg, res); memo.val[id] = res; return res;
  };
  G.newMemo = function () { return { sig: {}, val: {} }; };
  G.round = function (v) { return Math.round(v * 100) / 100; };
  PTD.graph = G;
  if (typeof module !== "undefined" && module.exports) module.exports = G;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
