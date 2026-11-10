/* The procedural graph (REQ-049 to REQ-052): one node graph for the whole project. Nodes make, change and combine PATHS and SHAPES;
 * an Output node is the end of a chain and belongs to one layer of the artwork. No browser parts, so it is tested with Node.
 * graph = { nodes: [{ id, type, x, y, p: { parameters }, exp: [{ key, label, min, max }] }], wires: [{ from, to, port }] }
 * A path value is { kind: "path", loops: [{ pts, closed, flip, start }] }, a shape value { kind: "shape", paths: [Clipper integer paths] }. */
(function (PTD) {
  "use strict";
  var G = {}, P = null;
  function fringeMod() { var p = paths(); return p.fringe || (typeof window === "undefined" ? require("./fringe.js") : p.fringe); }
  function ornMod() { var p = paths(); return p.ornament || (typeof window === "undefined" ? require("./ornament.js") : p.ornament); }
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
    N("phase", "Phase (-1 to 1)", "Slides the pattern along the path by a fraction of one repeat.", { min: -1, max: 1, step: "0.05", def: 0 })
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
  add("offsetp", { cat: "Path", label: "Offset path", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("dist", "Distance (mm)", "Moves a closed path outward (positive) or inward (negative); an open path sideways (left is positive).", { def: 10 }), N("step", "Point spacing (mm)", "The result is cut into points this far apart, so the number of points follows the length of the path and does not jump when a corner appears or vanishes (nodes after this one then behave steadily). 0 keeps the points the offset makes.", { min: 0, max: 20, step: "0.1", def: 0.5 })] });
  add("round", { cat: "Path", label: "Round corners", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("radius", "Radius (mm)", "Rounds every corner of the path with this radius.", { min: 0, def: 20 })] });
  add("trim", { cat: "Path", label: "Trim", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("from", "From (0 to 1)", "Where the piece starts, as a fraction of the path length.", { min: 0, max: 1, step: "0.05", def: 0 }), N("len", "Length (0 to 1)", "How much of the path is kept, as a fraction of its length.", { min: 0.01, max: 1, step: "0.05", def: 0.5 })] });
  add("outline", { cat: "Path", label: "Edge of shape (path)", out: "path", ins: [{ port: "in", kind: "shape" }], tip: "Turns the outlines of a shape into closed paths, so patterns can follow the edge of any shape.", params: [N("holes", "Holes too", "Also make a path round every hole.", { t: "chk" })] });
  add("reverse", { cat: "Path", label: "Reverse", out: "path", ins: [{ port: "in", kind: "path" }], params: [] });
  add("sinep", { cat: "Path", label: "Sine bend", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("amp", "Amplitude (mm)", "How far the path swings sideways.", { min: 0, def: 10 }), N("freq", "Frequency (repeats)", "How many waves fit along the whole path (0 to 1 of its length). A closed path uses whole waves.", { min: 0.1, def: 8, step: "0.5" }), N("phase", "Phase (0 to 1)", "Slides the wave along the path.", { min: 0, max: 1, step: "0.05", def: 0 })] });
  add("wobble", { cat: "Path", label: "Wiggle", out: "path", ins: [{ port: "in", kind: "path" }], params: [N("amp", "Amplitude (mm)", "How far the path wanders sideways.", { min: 0, def: 8 }), N("size", "Size (mm)", "How long one wobble is along the path: small is nervous, large is slow.", { min: 2, def: 80 }), N("seed", "Seed", "A different number gives a different wobble.", { t: "int", step: "1", def: 1 })] });
  /* shape makers */
  function fr(k, l, tip, o) { return N(k, l, tip, o); }
  var FRINGE = [
    fr("form", "Form", "What stands on the path.", { t: "sel", opts: [["straight", "Spike"], ["curl", "Curl"], ["lightning", "Lightning"], ["wave", "Wave"], ["flame", "Flame"], ["feather", "Feather"], ["glyph", "Glyph"]], def: "straight" }),
    fr("gpick", "Glyph order", "Which glyph stands at each place when there are several: in turn, or at random.", { t: "sel", opts: [["cycle", "In turn"], ["random", "Random"]], def: "cycle", when: function (p) { return p.form === "glyph"; } }),
    fr("gturn", "Glyph turn (°)", "Turns every glyph about its middle on top of the path direction.", { min: -360, max: 360, step: "1", def: 0, when: function (p) { return p.form === "glyph"; } }),
    fr("side", "Side", "Which side of the path the items stand on.", { t: "sel", opts: [["outside", "Outside / left"], ["inside", "Inside / right"]], def: "outside" }),
    fr("both", "Both sides", "Also put items on the other side: mirrored, or each side with its own random choices.", { t: "sel", opts: [["off", "One side"], ["mirror", "Both, mirrored"], ["independent", "Both, independent"]], def: "off" }),
    fr("second", "Second side", "How the items on the second side relate to the first: a mirror image (they lean and curl the same way along the path, like a herringbone), or turned half a round about the root (they lean and curl the other way along the path, like a pinwheel).", { t: "sel", opts: [["mirror", "Mirror image"], ["rotated", "Other way along the path"]], def: "mirror", when: function (p) { return p.both !== "off"; } }),
    fr("dist", "Distance from path (mm)", "Where the roots stand, measured from the path.", { min: 0, def: 0 }),
    fr("length", "Length (mm)", "Length of one item.", { min: 1, def: 80 }),
    fr("width", "Width at root (mm)", "Width of an item at its root (the widest part of a flame or feather).", { min: 0.2, def: 14 }),
    fr("wfollow", "Width follows length", "Items with a variable length are narrower in proportion.", { t: "chk" }),
    fr("power", "Taper power", "How the item thins from root to tip: (1 - t) raised to this power. 1 is a straight cone; above 1 is concave, a thorn that stays thin toward the tip; below 1 is convex, a bulging horn. A float from 0.1 to 100.", { min: 0.1, max: 100, step: "0.1", def: 2, when: function (p) { return p.form === "straight" || p.form === "curl" || p.form === "lightning" || p.form === "wave"; } }),
    fr("tmix", "Linear mix (0 to 1)", "How much of the straight cone is mixed into the power curve: 0 is the pure power curve, 1 a straight cone.", { min: 0, max: 1, step: "0.05", def: 0, when: function (p) { return p.form === "straight" || p.form === "curl" || p.form === "lightning" || p.form === "wave"; } }),
    fr("tip", "Tip width (mm)", "Width at the tip. 0 is a point.", { min: 0, def: 0, when: function (p) { return p.form === "straight" || p.form === "curl" || p.form === "lightning" || p.form === "wave"; } }),
    fr("lean", "Lean (°)", "Tilts every item away from straight out: positive leans forward along the path, negative backward.", { min: -85, max: 85, step: "1", def: 0 }),
    fr("fan", "Fan (°)", "Turns the lean gradually along the path, so items spread like a fan.", { min: -360, max: 360, step: "5", def: 0 }),
    fr("mode", "Place by", "Number of items, or the distance between them.", { t: "sel", opts: [["count", "Number of items"], ["length", "Distance between items"]], def: "count" }),
    fr("n", "Items", "How many items.", { t: "int", min: 1, def: 24, step: "1", when: function (p) { return p.mode === "count"; } }),
    fr("len", "Distance (mm)", "Distance between items.", { min: 1, def: 60, when: function (p) { return p.mode === "length"; } }),
    fr("fit", "Fit to a whole number", "Adjust the distance a little so a whole number of items fits.", { t: "chk", when: function (p) { return p.mode === "length"; } }),
    fr("phase", "Phase (0 to 1)", "Slides all items along the path by a fraction of the spacing.", { min: -1, max: 1, step: "0.05", def: 0 }),
    fr("scope", "Corners", "Over the whole path, or restarted on every straight side.", { t: "sel", opts: [["whole", "One run over the whole path"], ["sides", "Repeat on every side"]], def: "whole" }),
    fr("place", "Places", "Evenly spaced, or each item moved a random amount along the path.", { t: "sel", opts: [["even", "Even"], ["jitter", "Jittered"]], def: "even" }),
    fr("jitter", "Jitter (%)", "How far an item may move along the path, as a percent of the spacing.", { min: 0, max: 100, step: "5", def: 40, when: function (p) { return p.place === "jitter"; } }),
    fr("lvar", "Length varies", "Make the items different lengths.", { t: "sel", opts: [["none", "All the same"], ["alternate", "Alternate long and short"], ["wave", "Wave"], ["random", "Random"]], def: "none" }),
    fr("lamt", "Variation (%)", "How much shorter the short items are.", { min: 0, max: 95, step: "5", def: 40, when: function (p) { return p.lvar !== "none"; } }),
    fr("lperiod", "Wave period (items)", "How many items one length wave takes.", { min: 2, def: 8, step: "1", when: function (p) { return p.lvar === "wave"; } }),
    fr("seed", "Seed", "A different number gives different random choices.", { t: "int", step: "1", def: 1 }),
    fr("overlap", "Overlapping items", "Merge them into one shape, or layer them so each item is cut by a gap round the ones above.", { t: "sel", opts: [["merge", "Merge"], ["layered", "Layered"]], def: "merge" }),
    fr("gap", "Gap (mm)", "Gap round the item that lies on top.", { min: 0, def: 2, when: function (p) { return p.overlap === "layered"; } }),
    fr("order", "Stacking order", "Which items lie on top.", { t: "sel", opts: [["shingled", "In a row"], ["alternate", "Odd over even"], ["random", "Random"]], def: "shingled", when: function (p) { return p.overlap === "layered"; } }),
    fr("dir", "Direction", "Whether the next item lies over or under the previous one.", { t: "sel", opts: [["forward", "Later over earlier"], ["backward", "Earlier over later"]], def: "forward", when: function (p) { return p.overlap === "layered" && p.order === "shingled"; } }),
    fr("bend", "Curl (° in total)", "How far the item turns from root to tip. 360 is a full circle, more makes a spiral.", { min: 0, max: 1440, step: "15", def: 360, when: function (p) { return p.form === "curl"; } }),
    fr("bpow", "Curl lateness", "1 turns evenly; larger keeps the root straight and curls only the tip.", { min: 0.2, max: 8, step: "0.1", def: 2, when: function (p) { return p.form === "curl"; } }),
    fr("turn", "Curl direction", "Which way curls turn.", { t: "sel", opts: [["clockwise", "Clockwise"], ["anticlockwise", "Anticlockwise"], ["alternate", "Alternate"], ["random", "Random"]], def: "clockwise", when: function (p) { return p.form === "curl" || p.form === "wave" || p.form === "flame" || p.form === "feather"; } }),
    fr("waves", "Waves", "How many full waves along an item.", { min: 0.25, max: 12, step: "0.25", def: 1.5, when: function (p) { return p.form === "wave"; } }),
    fr("amp", "Wave height (mm)", "How far a wave swings sideways.", { min: 0, def: 12, when: function (p) { return p.form === "wave"; } }),
    fr("detail", "Detail", "How many times the bolt is subdivided: more is more jagged.", { t: "int", min: 1, max: 8, step: "1", def: 5, when: function (p) { return p.form === "lightning"; } }),
    fr("jag", "Jaggedness (%)", "Size of the zigzags as a percent of the length.", { min: 0, max: 80, step: "1", def: 18, when: function (p) { return p.form === "lightning"; } }),
    fr("rough", "Roughness", "How much of the zigzag is left at each finer level: low is smooth, high is wild.", { min: 0.2, max: 0.95, step: "0.05", def: 0.55, when: function (p) { return p.form === "lightning"; } }),
    fr("forks", "Forks per bolt", "Branches growing from each bolt.", { t: "int", min: 0, max: 12, step: "1", def: 4, when: function (p) { return p.form === "lightning"; } }),
    fr("flevels", "Fork levels", "Branches on branches.", { t: "int", min: 0, max: 5, step: "1", def: 2, when: function (p) { return p.form === "lightning"; } }),
    fr("fangle", "Fork angle (°)", "How sharply forks leave their bolt.", { min: 0, max: 85, step: "1", def: 30, when: function (p) { return p.form === "lightning"; } }),
    fr("fspread", "Fork angle spread (°)", "Random change of the fork angle.", { min: 0, max: 60, step: "1", def: 15, when: function (p) { return p.form === "lightning"; } }),
    fr("flen", "Fork length (%)", "Length of a fork relative to its bolt.", { min: 5, max: 95, step: "1", def: 45, when: function (p) { return p.form === "lightning"; } }),
    fr("fwid", "Fork width (%)", "Width of a fork relative to its bolt.", { min: 5, max: 100, step: "1", def: 55, when: function (p) { return p.form === "lightning"; } }),
    fr("sameBolt", "Same bolt every time", "Every item is the same bolt (the seed picks which).", { t: "chk", when: function (p) { return p.form === "lightning"; } }),
    fr("smooth", "Smooth", "Round off the zigzag corners.", { t: "chk", when: function (p) { return p.form === "lightning"; } }),
    fr("curl", "Curliness (0 to 100)", "How much the flame sways.", { min: 0, max: 100, step: "5", def: 50, when: function (p) { return p.form === "flame"; } }),
    fr("belly", "Belly position", "Where the flame is widest, from root (0.1) to tip (0.7).", { min: 0.1, max: 0.7, step: "0.05", def: 0.3, when: function (p) { return p.form === "flame"; } }),
    fr("licks", "Side licks", "Small flames growing out of the sides.", { t: "chk", when: function (p) { return p.form === "flame"; } }),
    fr("lickN", "Licks", "How many side licks.", { t: "int", min: 1, max: 8, step: "1", def: 2, when: function (p) { return p.form === "flame" && p.licks; } }),
    fr("lickSize", "Lick size (%)", "Size of a lick relative to the flame.", { min: 10, max: 80, step: "5", def: 35, when: function (p) { return p.form === "flame" && p.licks; } }),
    fr("inner", "Hollow inner flame", "A smaller flame cut out of the middle.", { t: "chk", when: function (p) { return p.form === "flame"; } }),
    fr("innerSize", "Inner flame size (%)", "Size of the hollow.", { min: 15, max: 85, step: "5", def: 50, when: function (p) { return p.form === "flame" && p.inner; } }),
    fr("vshape", "Feather shape", "Pointed or round tip.", { t: "sel", opts: [["pointed", "Pointed"], ["round", "Round"]], def: "pointed", when: function (p) { return p.form === "feather"; } }),
    fr("asym", "Asymmetry (%)", "Makes one side of the feather wider.", { min: -90, max: 90, step: "5", def: 0, when: function (p) { return p.form === "feather"; } }),
    fr("fbend", "Feather bend (°)", "How far the shaft curves.", { min: 0, max: 180, step: "5", def: 30, when: function (p) { return p.form === "feather"; } }),
    fr("shaft", "Gap along the shaft", "A thin cut along the centre.", { t: "chk", when: function (p) { return p.form === "feather"; } }),
    fr("shaftW", "Shaft gap (mm)", "Width of the shaft cut.", { min: 0.1, def: 1.5, when: function (p) { return p.form === "feather" && p.shaft; } }),
    fr("barbs", "Barb gaps", "Thin cuts slanting from the shaft.", { t: "chk", when: function (p) { return p.form === "feather"; } }),
    fr("barbN", "Barbs", "Barb cuts per side.", { t: "int", min: 1, max: 60, step: "1", def: 10, when: function (p) { return p.form === "feather" && p.barbs; } }),
    fr("barbW", "Barb gap (mm)", "Width of a barb cut.", { min: 0.1, def: 1, when: function (p) { return p.form === "feather" && p.barbs; } }),
    fr("barbAng", "Barb angle (°)", "Angle between a barb cut and the shaft.", { min: 10, max: 80, step: "1", def: 40, when: function (p) { return p.form === "feather" && p.barbs; } }),
    fr("notch", "Notch at the tip", "A V cut at the tip.", { t: "chk", when: function (p) { return p.form === "feather"; } }),
    fr("notchD", "Notch depth (%)", "Depth of the notch.", { min: 5, max: 70, step: "5", def: 25, when: function (p) { return p.form === "feather"; } })
  ];
  add("fringe", { cat: "Shapes", label: "Fringe", out: "shape", ins: [{ port: "in", kind: "path" }], fringe: true, params: FRINGE });
  /* the ornament node: a stepped Art Deco corner ornament made straight from a path (no separate Stroke node) */
  var ORN = [
    N("where", "Where", "Corners: at the corners of the path. Evenly spaced: at even distances along the path (for a round table or a ring). Automatic: corners when the path has any, otherwise evenly spaced.", { t: "sel", opts: [["auto", "Automatic"], ["corners", "At the corners"], ["spaced", "Evenly spaced"]], def: "auto" }),
    N("kind", "Corner kind", "Which corners get an ornament: convex (the outer corners of a table), concave (the inner ones) or both. Open paths ignore it.", { t: "sel", opts: [["convex", "Convex"], ["concave", "Concave"], ["both", "Both"]], def: "convex", when: function (p) { return p.where !== "spaced"; } }),
    N("minTurn", "Smallest turn (°)", "A bend turns the path less than this does not count as a corner.", { min: 1, max: 170, step: "1", def: 25, when: function (p) { return p.where !== "spaced"; } }),
    N("count", "Count", "How many ornaments along the path (per closed loop).", { t: "int", min: 1, max: 200, step: "1", def: 4, when: function (p) { return p.where !== "corners"; } }),
    N("phase", "Phase", "Moves the ornaments along the path; 1 is one whole spacing.", { def: 0, step: "0.05", when: function (p) { return p.where !== "corners"; } }),
    N("sside", "Side", "Which side of the path the evenly spaced ornaments open towards.", { t: "sel", opts: [["inside", "Inside"], ["outside", "Outside"]], def: "inside", when: function (p) { return p.where !== "corners"; } }),
    N("sang", "Corner angle (°)", "The angle of the imagined corner for evenly spaced ornaments: 90 is square, less is a sharper diamond.", { min: 15, max: 165, step: "1", def: 90, when: function (p) { return p.where !== "corners"; } }),
    N("thick", "Line thickness (mm)", "Thickness of every thin line.", { min: 0.2, def: 1.5 }),
    N("round", "Roundness (0 to 1)", "0 is all straight lines, 1 rounds every bend as much as fits; lines of a band stay concentric.", { min: 0, max: 1, step: "0.05", def: 0 }),
    N("rib", "Stair band", "The stepped ribbon: an arm along each edge joined by steps.", { t: "chk", def: true }),
    N("lines", "Lines in the band", "Parallel lines of the band.", { t: "int", min: 1, max: 8, step: "1", def: 2, when: function (p) { return p.rib; } }),
    N("gap", "Gap between lines (mm)", "Distance between the parallel lines of the band.", { min: 0.2, def: 10, when: function (p) { return p.rib; } }),
    N("oa", "Arm 1 from edge (mm)", "How far the band's first arm lies from the first edge.", { min: 0, def: 18, when: function (p) { return p.rib; } }),
    N("ob", "Arm 2 from edge (mm)", "How far the band's last arm lies from the second edge.", { min: 0, def: 30, when: function (p) { return p.rib; } }),
    N("steps", "Steps", "Number of steps in the stair.", { t: "int", min: 0, max: 10, step: "1", def: 1, when: function (p) { return p.rib; } }),
    N("sw", "Step width (mm)", "How far each step runs across.", { min: 0.5, def: 75, when: function (p) { return p.rib; } }),
    N("sh", "Step height (mm)", "How far each step runs along.", { min: 0.5, def: 70, when: function (p) { return p.rib; } }),
    N("arm", "Arm length (mm)", "Length of the straight arm at each end of the band.", { min: 1, def: 120, when: function (p) { return p.rib; } }),
    N("frames", "Frames", "Number of nested rectangles (rhombuses in a sharp corner).", { t: "int", min: 0, max: 10, step: "1", def: 2 }),
    N("fp", "Frame 1 along edge 1 (mm)", "Where the first frame starts, measured from the corner along edge 1.", { def: 35, when: function (p) { return p.frames > 0; } }),
    N("fq", "Frame 1 along edge 2 (mm)", "Where the first frame starts, measured along edge 2.", { def: 26, when: function (p) { return p.frames > 0; } }),
    N("fh", "Frame 1 size along 1 (mm)", "Size of the first frame along edge 1.", { min: 0.5, def: 50, when: function (p) { return p.frames > 0; } }),
    N("fw", "Frame 1 size along 2 (mm)", "Size of the first frame along edge 2.", { min: 0.5, def: 54, when: function (p) { return p.frames > 0; } }),
    N("fdp", "Step of start along 1 (mm)", "How much the start moves along edge 1 from one frame to the next.", { def: 37.5, when: function (p) { return p.frames > 1; } }),
    N("fdq", "Step of start along 2 (mm)", "How much the start moves along edge 2 from one frame to the next.", { def: 39, when: function (p) { return p.frames > 1; } }),
    N("fdh", "Size change along 1 (mm)", "How much the size along edge 1 changes per frame.", { def: -17.5, when: function (p) { return p.frames > 1; } }),
    N("fdw", "Size change along 2 (mm)", "How much the size along edge 2 changes per frame.", { def: -21.5, when: function (p) { return p.frames > 1; } }),
    N("flines", "Lines per frame", "Parallel lines of every frame.", { t: "int", min: 1, max: 8, step: "1", def: 1, when: function (p) { return p.frames > 0; } }),
    N("fgap", "Gap in frames (mm)", "Distance between the lines of a frame.", { min: 0.2, def: 6, when: function (p) { return p.frames > 0 && p.flines > 1; } }),
    N("fover", "Overshoot (mm)", "Frame sides run this far past the corners (not with roundness).", { min: 0, def: 8, when: function (p) { return p.frames > 0 && !(p.round > 0); } })
  ];
  add("ornament", { cat: "Shapes", label: "Ornament", out: "shape", ins: [{ port: "in", kind: "path" }], orn: true, params: ORN });
  function genType(key, label, gen, extra) { add(key, { cat: "Shapes", label: label, out: "shape", ins: [{ port: "in", kind: "path" }], gen: gen, params: extra }); }
  genType("stroke", "Stroke", "line", [N("thick", "Thickness (mm)", "Thickness of the line.", { min: 0.5, def: 12 })].concat(COMMON_GEN.slice(1)));
  genType("gsine", "Sine wave", "sine", [COMMON_GEN[0], N("height", "Height (mm)", "How far the wave swings across the path, peak to peak.", { min: 0, def: 60 })].concat(REPEAT, [N("mirror", "Mirror", "Flips the pattern across the path, like a reflection in a mirror laid along it. The Side setting is not flipped.", { t: "chk" })], COMMON_GEN.slice(1)));
  genType("gscroll", "Running dog", "scroll", [COMMON_GEN[0], N("height", "Height (mm)", "Height of the scroll across the path.", { min: 0, def: 90 })].concat(REPEAT, [N("mirror", "Mirror", "Flips the pattern across the path, like a reflection in a mirror laid along it. The Side setting is not flipped.", { t: "chk" })], COMMON_GEN.slice(1)));
  genType("ginterlace", "Interlace", "interlace", [COMMON_GEN[0], N("height", "Height (mm)", "Width of the band the strands weave in.", { min: 0, def: 70 }), N("strands", "Strands", "Number of strands: 2 is a chain, 3 a braid.", { t: "int", min: 2, max: 8, step: "1", def: 2 }), N("gap", "Gap (mm)", "Gap cut into the strand that goes under at a crossing.", { min: 0, def: 5 })].concat(REPEAT, [N("mirror", "Mirror", "Flips the pattern across the path, like a reflection in a mirror laid along it. The Side setting is not flipped.", { t: "chk" })], COMMON_GEN.slice(1)));
  genType("gfoliage", "Foliage", "foliage", [N("thick", "Stem thickness (mm)", "Thickness of the stem along the path.", { min: 0.5, def: 5 }), N("stem", "Stem", "Draw a stem along the path.", { t: "chk" }), N("height", "Leaf length (mm)", "Length of a leaf.", { min: 1, def: 70 }), N("leafW", "Leaf width (mm)", "Width of a leaf.", { min: 1, def: 26 }), N("angle", "Leaf angle (°)", "Angle between a leaf and the path.", { min: 0, max: 89, def: 50 }), N("jit", "Randomness (0 to 1)", "How much the leaves differ in size and angle.", { min: 0, max: 1, step: "0.05", def: 0.3 }), N("seed", "Seed", "A different number gives different leaves.", { t: "int", step: "1", def: 1 }), N("mirror", "Mirror", "Flips the pattern across the path, like a reflection in a mirror laid along it. The Side setting is not flipped.", { t: "chk" }), N("mode", "Leaves by", "Number of leaves, or the distance between them.", { t: "sel", opts: [["count", "Number of leaves"], ["length", "Distance between leaves"]], def: "count" }), N("n", "Leaves", "How many leaves.", { t: "int", min: 1, def: 14, step: "1", when: function (p) { return p.mode === "count"; } }), N("len", "Distance (mm)", "Distance between leaves.", { min: 5, def: 60, when: function (p) { return p.mode === "length"; } }), COMMON_GEN[2]].map(function (x) { return x; }));
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

  /* one line for every node type: shown under the stage when a node is selected */
  var TIPS = {
    circle: "Generates a circular path with a centre and a radius.", polygon: "Generates a regular polygon path: centre, radius, number of sides, turn and rounded corners.",
    lines: "Generates a path from points you type: a polyline, open or closed, with optional rounded corners.", table: "Gives the path of a line of a table: outline, rail, wrap line or player-area line.",
    objects: "Gives the outer edge of the chosen texts, glyphs, patterns or group as a path, following them as they change.",
    offsetp: "Moves a path sideways by a distance, outwards or inwards.", round: "Rounds the corners of a path with a radius.", trim: "Cuts a piece out of a path, between two fractions of its length.",
    reverse: "Walks a path the other way round.", sinep: "Bends a path into a sine wave: repeats over the path, amplitude and phase.", wobble: "Makes a path wander sideways at random, smoothly (amplitude, size, seed).",
    stroke: "Turns a path into a shape: a line of a given width with chosen ends and corners.", gsine: "Makes a wave pattern shape along a path.", gscroll: "Makes a running-dog scroll shape along a path.",
    ornament: "Draws a stepped Art Deco ornament (stair band and nested frames, thin double lines) at the corners of a path, or at even places along a path with no corners. It makes the shape directly; no Stroke node is needed.", fringe: "Stands spikes, curls, lightning, waves, flames or feathers along a path: count, side, length, lean, randomness and layering are adjustable.", ginterlace: "Makes an interlaced band shape along a path.", gfoliage: "Makes a leafy vine shape along a path.",
    union: "Joins shapes into one shape.", intersect: "Keeps only the area that all the shapes share.", xor: "Keeps the areas that belong to an odd number of the shapes.",
    offset: "Grows or shrinks a shape by a distance.", negate: "Turns a shape inside out: what was inside becomes outside, within a box or a path you give.", output: "The end of a chain: its result is the pattern layer on the cloth."
  };
  Object.keys(TIPS).forEach(function (k) { if (T[k] && !T[k].tip) T[k].tip = TIPS[k]; });
  G.normParams = function (type, p, id) {
    var ty = T[type], P_ = paths(); p = p && typeof p === "object" ? p : {};
    if (!ty) return {};
    if (ty.cat === "Sources" && !ty.plain) return P_.normPath(Object.assign({}, p, { kind: type }), id);
    if (ty.fringe) return fringeMod().norm(p);
    if (ty.orn) return ornMod().norm(p);
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
    if (T[type].params.some(function (q) { return q.key === "cx"; }) && T[type].params.some(function (q) { return q.key === "cy"; })) {   /* a centre is pinned from the start: it shows in the panel of the layer */
      var nm = T[type].label;
      n.exp = [{ key: "cx", label: nm + ": centre X", min: -1500, max: 1500 }, { key: "cy", label: nm + ": centre Y", min: -1500, max: 1500 }];
    }
    g.nodes.push(n); return n;
  };
  G.norm = function (o) {
    var g = G.empty(), seen = {};
    o = o && typeof o === "object" ? o : {};
    (Array.isArray(o.nodes) ? o.nodes : []).forEach(function (n) {
      if (!n || !T[n.type]) return;
      var id = String(n.id || ""); if (!id || seen[id]) return; seen[id] = 1;
      var exp = (Array.isArray(n.exp) ? n.exp : []).map(function (e) { return e && e.key ? { key: String(e.key), label: String(e.label || e.key).slice(0, 40), min: num(e.min, 0), max: num(e.max, 100) } : null; }).filter(Boolean);
      var nn = { id: id, type: n.type, x: Math.round(num(n.x, 0)), y: Math.round(num(n.y, 0)), p: G.normParams(n.type, n.p, id), exp: exp };
      if (n.prec != null) nn.prec = Math.max(0.001, Math.min(5, num(n.prec, 0.05)));
      var bk = G.normBake(n.bake); if (bk) nn.bake = bk;
      if (n.name != null && String(n.name).trim()) nn.name = String(n.name).trim().slice(0, 60);
      if (n.type !== "output" && n.off) nn.off = n.off === "empty" || n.off === "cut" ? n.off : "bypass";   /* true from V135 files is the pass-through */
      g.nodes.push(nn);
    });
    (Array.isArray(o.wires) ? o.wires : []).forEach(function (w) {
      if (!w || !seen[w.from] || !seen[w.to]) return;
      var to = G.node(g, w.to), ins = T[to.type].ins, port = String(w.port || "in");
      if (!ins.some(function (q) { return q.port === port; }) || w.from === w.to) return;
      g.wires.push({ from: String(w.from), to: String(w.to), port: port });
    });
    /* single-input ports take one wire; a graph with a cycle loses the wire that closes it */
    var out = G.empty(); out.nodes = g.nodes; if (o.manual) out.manual = true;
    g.wires.forEach(function (w) { var r = G.canConnect(out, w.from, w.to, w.port); if (r === "") out.wires.push(w); });
    G.normGroups(out, o.groups);
    return out;
  };
  /* ---------- groups: a way to order the nodes, the graph itself stays flat ----------
     group = { id: "G1", name, nodes: [node ids], groups: [group ids], x, y (the black box), open, off: "bypass"|"empty"|"cut"|undefined, color } */
  G.normGroups = function (g, src) {
    var list = Array.isArray(src) ? src : [], used = {}, seenG = {}, ok = [];
    list.forEach(function (q) {
      if (!q || !q.id) return; var id = String(q.id); if (seenG[id]) return; seenG[id] = 1;
      var gg = { id: id, name: String(q.name || "").trim().slice(0, 60), nodes: [], groups: [], x: Math.round(num(q.x, 0)), y: Math.round(num(q.y, 0)), open: !!q.open };
      if (q.off) gg.off = q.off === "empty" || q.off === "cut" ? q.off : "bypass";
      if (q.color) gg.color = String(q.color).slice(0, 20);
      if (q.ports && typeof q.ports === "object") {   /* the external ports the group remembers (see groupPorts) */
        var okIn = function (k) { var nd = k && G.node(g, String(k.node)); return nd && T[nd.type].ins.some(function (z) { return z.port === String(k.port); }); };
        var okOut = function (k) { var nd = k && G.node(g, String(k.node)); return nd && T[nd.type].out; };
        var pi = (Array.isArray(q.ports.ins) ? q.ports.ins : []).filter(okIn).map(function (k) { return { node: String(k.node), port: String(k.port) }; });
        var po = (Array.isArray(q.ports.outs) ? q.ports.outs : []).filter(okOut).map(function (k) { return { node: String(k.node) }; });
        if (pi.length || po.length) gg.ports = { ins: pi, outs: po };
      }
      (Array.isArray(q.nodes) ? q.nodes : []).forEach(function (nid) { nid = String(nid); if (G.node(g, nid) && !used[nid]) { used[nid] = 1; gg.nodes.push(nid); } });
      gg._g = (Array.isArray(q.groups) ? q.groups : []).map(String);
      ok.push(gg);
    });
    var byId = {}; ok.forEach(function (q) { byId[q.id] = q; });
    var taken = {};
    ok.forEach(function (q) { q._g.forEach(function (c) { if (byId[c] && c !== q.id && !taken[c]) { taken[c] = 1; q.groups.push(c); } }); });
    ok.forEach(function (q) { delete q._g; });
    /* a group inside itself (a loop of groups) loses the child that closes the loop */
    ok.forEach(function (q) { q.groups = q.groups.filter(function (c) { return !(function walk(id, seen) { if (id === q.id) return true; if (seen[id]) return false; seen[id] = 1; return byId[id].groups.some(function (k) { return walk(k, seen); }); })(c, {}); }); });
    ok = ok.filter(function (q) { return q.nodes.length || q.groups.length; });
    var alive = {}; ok.forEach(function (q) { alive[q.id] = 1; }); ok.forEach(function (q) { q.groups = q.groups.filter(function (c) { return alive[c]; }); });
    if (ok.length) g.groups = ok; else delete g.groups;
    G.pruneGroups(g);
  };
  G.group = function (g, id) { var l = g.groups || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; };
  G.isGroupId = function (g, id) { return !!G.group(g, id); };
  G.parentOf = function (g, id) { var l = g.groups || []; for (var i = 0; i < l.length; i++) if (l[i].nodes.indexOf(id) >= 0 || l[i].groups.indexOf(id) >= 0) return l[i]; return null; };
  /* all nodes inside a group, at any depth */
  G.members = function (g, gid, out) {
    out = out || []; var q = G.group(g, gid); if (!q) return out;
    q.nodes.forEach(function (n) { out.push(n); }); q.groups.forEach(function (c) { G.members(g, c, out); });
    return out;
  };
  /* the groups a node sits in, innermost first */
  G.chainOf = function (g, id) { var out = [], p = G.parentOf(g, id); while (p) { out.push(p); p = G.parentOf(g, p.id); } return out; };
  G.nextId2 = function (g, prefix) { var m = 0; (g.groups || []).forEach(function (q) { var k = parseInt(String(q.id).slice(prefix.length), 10); if (k > m) m = k; }); return prefix + (m + 1); };
  /* Makes a group of the given items (node ids and group ids). They must all sit directly in the same parent (or at the top). */
  G.makeGroup = function (g, ids, name) {
    ids = ids.filter(function (i, k) { return ids.indexOf(i) === k; });
    if (!ids.length) return { err: "Nothing is selected." };
    if (ids.length === 1 && G.isGroupId(g, ids[0])) return { err: "A group cannot be grouped on its own: select it together with something else." };
    var parents = ids.map(function (i) { var p = G.parentOf(g, i); return p ? p.id : ""; });
    if (parents.some(function (p) { return p !== parents[0]; })) return { err: "The selected items sit in different groups. Open the group they share, or select items from one level." };
    var par = parents[0] ? G.group(g, parents[0]) : null, id = G.nextId2(g, "G"), q = { id: id, name: name || "", nodes: [], groups: [], x: 0, y: 0, open: false };
    var sx = 0, sy = 0, c = 0;
    ids.forEach(function (i) {
      var gi = G.group(g, i);
      if (gi) { q.groups.push(i); } else { var n = G.node(g, i); if (n) { q.nodes.push(i); sx += n.x; sy += n.y; c++; } }
    });
    if (!q.nodes.length && !q.groups.length) return { err: "Nothing to group." };
    if (par) { par.nodes = par.nodes.filter(function (i) { return ids.indexOf(i) < 0; }); par.groups = par.groups.filter(function (i) { return ids.indexOf(i) < 0; }); par.groups.push(id); }
    g.groups = g.groups || []; g.groups.push(q);
    q.groups.forEach(function (c2) { var gi = G.group(g, c2); sx += gi.x; sy += gi.y; c++; });
    q.x = c ? Math.round(sx / c) : 0; q.y = c ? Math.round(sy / c) : 0;
    return { id: id };
  };
  /* Dissolves a group: its items go to the parent (or the top). */
  G.ungroup = function (g, gid) {
    var q = G.group(g, gid); if (!q) return;
    var par = G.parentOf(g, gid);
    if (par) { par.groups = par.groups.filter(function (i) { return i !== gid; }); par.nodes = par.nodes.concat(q.nodes); par.groups = par.groups.concat(q.groups); }
    g.groups = g.groups.filter(function (x) { return x.id !== gid; }); if (!g.groups.length) delete g.groups;
  };
  /* Moves items out of their group into its parent (or the top). */
  G.removeFromGroup = function (g, ids) {
    ids.forEach(function (i) {
      var p = G.parentOf(g, i); if (!p) return; var pp = G.parentOf(g, p.id);
      p.nodes = p.nodes.filter(function (k) { return k !== i; }); p.groups = p.groups.filter(function (k) { return k !== i; });
      if (pp) { if (G.group(g, i)) pp.groups.push(i); else pp.nodes.push(i); }
    });
    G.pruneGroups(g);
  };
  G.addToGroup = function (g, gid, ids) {
    var q = G.group(g, gid); if (!q) return "No such group.";
    var inside = G.members(g, gid); inside.push(gid);
    ids = ids.filter(function (i) { return i !== gid && inside.indexOf(i) < 0 && !(G.isGroupId(g, i) && G.members(g, i).indexOf(gid) >= 0); });
    /* a group cannot be put into one of its own children */
    ids.forEach(function (i) {
      var p = G.parentOf(g, i); if (p) { p.nodes = p.nodes.filter(function (k) { return k !== i; }); p.groups = p.groups.filter(function (k) { return k !== i; }); }
      if (G.isGroupId(g, i)) q.groups.push(i); else q.nodes.push(i);
    });
    G.pruneGroups(g); return "";
  };
  /* A group holds something, and never only one group (that would be a wrapper with nothing of its own): such a wrapper goes away. */
  G.pruneGroups = function (g) {
    var changed = true;
    while (changed && g.groups) {
      changed = false;
      g.groups = g.groups.filter(function (q) {
        if (q.nodes.length || q.groups.length) return true;
        var p = G.parentOf(g, q.id); if (p) p.groups = p.groups.filter(function (i) { return i !== q.id; });
        changed = true; return false;
      });
      var w = (g.groups || []).filter(function (q) { return !q.nodes.length && q.groups.length === 1; })[0];
      if (w) { G.ungroup(g, w.id); changed = true; }
    }
    if (g.groups && !g.groups.length) delete g.groups;
  };
  /* The ports of a group seen from outside: one input per member input that a wire from outside reaches, one output per member that feeds something outside.
     The group remembers the ports it has had (q.ports, see syncPorts), so a copy of a group, or a group whose wire was removed, keeps its ports. */
  G.groupPorts = function (g, gid) {
    var q = G.group(g, gid), mem = G.members(g, gid), set = {}; mem.forEach(function (i) { set[i] = 1; });
    var ins = [], outs = [], seenI = {}, seenO = {};
    function addI(n, port) { var k = n + "|" + port; if (!seenI[k]) { seenI[k] = 1; ins.push({ node: n, port: port }); } }
    function addO(n) { if (!seenO[n]) { seenO[n] = 1; outs.push({ node: n }); } }
    if (q && q.ports) {
      q.ports.ins.forEach(function (k) { var nd = G.node(g, k.node); if (set[k.node] && nd && T[nd.type].ins.some(function (z) { return z.port === k.port; })) addI(k.node, k.port); });
      q.ports.outs.forEach(function (k) { var nd = G.node(g, k.node); if (set[k.node] && nd && T[nd.type].out) addO(k.node); });
    }
    g.wires.forEach(function (w) {
      if (!set[w.from] && set[w.to]) addI(w.to, w.port);
      if (set[w.from] && !set[w.to]) addO(w.from);
    });
    function by(a, b) { var x = G.node(g, a.node), y = G.node(g, b.node); return (x.y - y.y) || (x.x - y.x) || (a.port || "").localeCompare(b.port || ""); }
    ins.sort(by); outs.sort(by);
    return { ins: ins, outs: outs };
  };
  /* Writes the ports that wires give right now into the groups (call it before a wire is removed or a node leaves its group). */
  G.syncPorts = function (g) {
    (g.groups || []).forEach(function (q) {
      var p = G.groupPorts(g, q.id);
      if (p.ins.length || p.outs.length) q.ports = { ins: p.ins, outs: p.outs }; else delete q.ports;
    });
  };
  /* What the editor draws. o = { nodes: [visible node ids], WN, nodeH(n), label(n) }.
     A closed group is one black box (its members are hidden); an open group is a frame round its members, and the other items are pushed
     away from it along the rays from its centre (a view only: the stored places do not change). Returns
     { pos: {nodeId: {x,y}}, boxes: {gid: {x,y,w,h,ins,outs}}, frames: [{id,x,y,w,h}], hidden: {nodeId: gid} } */
  G.view = function (g, o) {
    var vis = {}; o.nodes.forEach(function (i) { vis[i] = 1; });
    var pos = {}, boxes = {}, hidden = {}, leafRect = {}, WN = o.WN, PAD = 14, HEAD = 24, MARGIN = 20;
    function show(gid) { var q = G.group(g, gid); return G.members(g, gid).some(function (i) { return vis[i]; }) && q; }
    /* which items are drawn: a node is hidden when a group above it is closed, and the outermost closed one is the box */
    function boxOf(chain) { for (var k = chain.length - 1; k >= 0; k--) if (!chain[k].open) return chain[k]; return null; }
    g.nodes.forEach(function (n) {
      if (!vis[n.id]) return;
      var b = boxOf(G.chainOf(g, n.id));
      if (b) hidden[n.id] = b.id; else { pos[n.id] = { x: n.x, y: n.y }; leafRect[n.id] = { x: n.x, y: n.y, w: WN, h: o.nodeH(n) }; }
    });
    (g.groups || []).forEach(function (q) {
      if (!show(q.id)) return;
      if (boxOf(G.chainOf(g, q.id).concat([q])) !== q) return;   /* it is a box only when it is the outermost closed one */
      var pt = G.groupPorts(g, q.id), len = function (a) { return a.reduce(function (m, k) { return Math.max(m, k.label.length); }, 0); };
      pt.ins = pt.ins.filter(function (k) { return vis[k.node]; }); pt.outs = pt.outs.filter(function (k) { return vis[k.node]; });
      pt.ins.forEach(function (k) { var n = G.node(g, k.node); k.label = o.label(n) + " · " + k.port; k.kind = (T[n.type].ins.filter(function (z) { return z.port === k.port; })[0] || {}).kind || "any"; });
      pt.outs.forEach(function (k) { var n = G.node(g, k.node); k.label = o.label(n); k.kind = T[n.type].out || "any"; });
      var w = Math.max(WN, Math.ceil(40 + 6.2 * (len(pt.ins) + len(pt.outs))), Math.ceil(24 + 7 * (q.name || "Group").length)), h = 26 + 18 * Math.max(1, pt.ins.length, pt.outs.length);
      boxes[q.id] = { x: q.x, y: q.y, w: w, h: h, ins: pt.ins, outs: pt.outs, g: q };
      leafRect[q.id] = { x: q.x, y: q.y, w: w, h: h };
    });
    /* leaves of a group (drawn nodes and boxes inside it) */
    function leavesOf(gid) {
      var out = [], q = G.group(g, gid); if (!q) return out;
      q.nodes.forEach(function (i) { if (leafRect[i]) out.push(i); });
      q.groups.forEach(function (c) { if (leafRect[c]) out.push(c); else if (G.group(g, c).open) leavesOf(c).forEach(function (k) { out.push(k); }); });
      return out;
    }
    function rectOf(id) { return leafRect[id]; }
    function frameOf(gid) {
      var l = leavesOf(gid); if (!l.length) return null;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      l.forEach(function (i) { var r = rectOf(i); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); });
      return { x: x0 - PAD, y: y0 - PAD - HEAD, w: x1 - x0 + 2 * PAD, h: y1 - y0 + 2 * PAD + HEAD };
    }
    var opens = (g.groups || []).filter(function (q) { return q.open && show(q.id) && leavesOf(q.id).length; });
    opens.sort(function (a, b) { return G.chainOf(g, b.id).length - G.chainOf(g, a.id).length; });
    opens.forEach(function (q) {
      var fr = frameOf(q.id); if (!fr) return;
      var mine = {}; leavesOf(q.id).forEach(function (i) { mine[i] = 1; });
      var cx = fr.x + fr.w / 2, cy = fr.y + fr.h / 2;
      Object.keys(leafRect).forEach(function (i) {
        if (mine[i]) return; var r = leafRect[i];
        if (r.x >= fr.x + fr.w + MARGIN || r.x + r.w <= fr.x - MARGIN || r.y >= fr.y + fr.h + MARGIN || r.y + r.h <= fr.y - MARGIN) return;
        var px = r.x + r.w / 2 - cx, py = r.y + r.h / 2 - cy;
        if (Math.abs(px) < 1 && Math.abs(py) < 1) px = 1;
        var tx = Math.abs(px) > 0.01 ? (fr.w / 2 + r.w / 2 + MARGIN) / Math.abs(px) : 1e9, ty = Math.abs(py) > 0.01 ? (fr.h / 2 + r.h / 2 + MARGIN) / Math.abs(py) : 1e9, t = Math.max(1, Math.min(tx, ty));
        r.x = Math.round(cx + px * t - r.w / 2); r.y = Math.round(cy + py * t - r.h / 2);
        if (pos[i]) { pos[i].x = r.x; pos[i].y = r.y; } else if (boxes[i]) { boxes[i].x = r.x; boxes[i].y = r.y; }
      });
    });
    var frames = [];
    opens.slice().reverse().forEach(function (q) { var fr = frameOf(q.id); if (fr) { fr.id = q.id; fr.g = q; frames.push(fr); } });
    /* an outer frame is built last so that it holds the inner ones */
    frames.sort(function (a, b) { return G.chainOf(g, b.id).length - G.chainOf(g, a.id).length; });
    return { pos: pos, boxes: boxes, frames: frames, hidden: hidden };
  };
  /* The kind of off that a group puts on the wire from "from" to "to": the innermost group that holds "from" but not "to" and is switched off. */
  G.groupOffFor = function (g, from, to) {
    if (!g.groups) return null;
    var ch = G.chainOf(g, from), toCh = G.chainOf(g, to).map(function (q) { return q.id; });
    for (var i = 0; i < ch.length; i++) { if (toCh.indexOf(ch[i].id) >= 0) break; if (ch[i].off) return ch[i].off; }
    return null;
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
  G.removeNode = function (g, id) { g.nodes = g.nodes.filter(function (n) { return n.id !== id; }); g.wires = g.wires.filter(function (w) { return w.from !== id && w.to !== id; }); (g.groups || []).forEach(function (q) { q.nodes = q.nodes.filter(function (k) { return k !== id; }); }); G.pruneGroups(g); };

  /* Removes a node, or a group together with everything in it. */
  G.removeItem = function (g, id) {
    if (G.isGroupId(g, id)) { G.members(g, id).forEach(function (n) { G.removeNode(g, n); }); }
    else G.removeNode(g, id);
  };
  /* Copies nodes and groups (a group with everything inside it, at any depth), moved by dx, dy. Only wires between copied nodes are copied; the
     wires from outside are not, but a copied group keeps its external ports. An Output node is never copied (it belongs to a layer).
     Returns { ids: the new top level items, map: old id -> new id, skipped: Output nodes left out }. */
  G.cloneItems = function (g, ids, dx, dy) {
    G.syncPorts(g);
    var nodeIds = [], groupIds = [], seen = {}, map = {}, skipped = 0;
    function addN(i) { if (!seen[i] && G.node(g, i)) { seen[i] = 1; nodeIds.push(i); } }
    function addG(q) { if (!q || seen[q.id]) return; seen[q.id] = 1; groupIds.push(q.id); q.nodes.forEach(addN); q.groups.forEach(function (c) { addG(G.group(g, c)); }); }
    ids.forEach(function (i) { var q = G.group(g, i); if (q) addG(q); else addN(i); });
    var js = function (v) { return JSON.parse(JSON.stringify(v)); };
    nodeIds.forEach(function (i) {
      var o = G.node(g, i); if (o.type === "output") { skipped++; return; }
      var c = G.addNode(g, o.type, o.x + dx, o.y + dy, js(o.p)); c.exp = js(o.exp);
      if (o.name) c.name = o.name; if (o.off) c.off = o.off; if (o.prec != null) c.prec = o.prec;
      map[i] = c.id;
    });
    var made = [];
    groupIds.forEach(function (gid) {
      var q = G.group(g, gid), c = { id: G.nextId2(g, "G"), name: q.name ? q.name + " copy" : "", nodes: [], groups: [], x: q.x + dx, y: q.y + dy, open: q.open };
      if (q.off) c.off = q.off; if (q.color) c.color = q.color;
      g.groups = g.groups || []; g.groups.push(c); map[gid] = c.id; made.push([q, c]);
    });
    made.forEach(function (m) {
      var q = m[0], c = m[1];
      c.nodes = q.nodes.filter(function (i) { return map[i]; }).map(function (i) { return map[i]; });
      c.groups = q.groups.filter(function (i) { return map[i]; }).map(function (i) { return map[i]; });
      if (q.ports) {
        var pi = q.ports.ins.filter(function (k) { return map[k.node]; }).map(function (k) { return { node: map[k.node], port: k.port }; });
        var po = q.ports.outs.filter(function (k) { return map[k.node]; }).map(function (k) { return { node: map[k.node] }; });
        if (pi.length || po.length) c.ports = { ins: pi, outs: po };
      }
    });
    g.wires.slice().forEach(function (w) { if (map[w.from] && map[w.to] && nodeIds.indexOf(w.from) >= 0 && nodeIds.indexOf(w.to) >= 0) g.wires.push({ from: map[w.from], to: map[w.to], port: w.port }); });
    var inside = {}; groupIds.forEach(function (gid) { var q = G.group(g, gid); q.nodes.forEach(function (n) { inside[n] = 1; }); q.groups.forEach(function (k) { inside[k] = 1; }); });
    var tops = [];
    nodeIds.forEach(function (i) { if (map[i] && !inside[i]) tops.push(map[i]); });
    groupIds.forEach(function (i) { if (!inside[i]) tops.push(map[i]); });
    G.pruneGroups(g);
    tops = tops.filter(function (i) { return G.node(g, i) || G.group(g, i); });
    return { ids: tops, map: map, skipped: skipped };
  };
  /* The ports of a node or a group as { ins: [{node, port, kind}], outs: [{node, kind}] }. */
  G.itemPorts = function (g, id) {
    var n = G.node(g, id);
    if (n) return { ins: T[n.type].ins.map(function (q) { return { node: id, port: q.port, kind: q.kind }; }), outs: T[n.type].out ? [{ node: id, kind: T[n.type].out }] : [] };
    var P = G.groupPorts(g, id);
    return {
      ins: P.ins.map(function (k) { var nd = G.node(g, k.node); return { node: k.node, port: k.port, kind: (T[nd.type].ins.filter(function (z) { return z.port === k.port; })[0] || {}).kind || "any" }; }),
      outs: P.outs.map(function (k) { return { node: k.node, kind: T[G.node(g, k.node).type].out || "any" }; })
    };
  };
  /* Whether something with these ports fits into the wire w. Returns { inP, outP } (the ports it would use) or { why }. */
  G.wireFit = function (g, w, P) {
    var a = G.node(g, w.from), b = G.node(g, w.to); if (!a || !b) return { why: "The wire is gone." };
    var fk = T[a.type].out, tp = T[b.type].ins.filter(function (q) { return q.port === w.port; })[0], tk = tp ? tp.kind : "any";
    var inP = P.ins.filter(function (q) { return q.kind === "any" || q.kind === fk; })[0];
    if (!inP) return { why: P.ins.length ? "A " + fk + " cannot go into it: it takes " + P.ins.map(function (q) { return q.kind; }).join(" or ") + "." : "It has no input to take this wire." };
    var outP = P.outs.filter(function (q) { return tk === "any" || tk === q.kind; })[0];
    if (!outP) return { why: P.outs.length ? "It gives a " + P.outs[0].kind + ", but this wire goes into a " + tk + " input." : "It gives nothing, so it cannot sit in a wire." };
    return { inP: inP, outP: outP };
  };
  /* Ports of a node type that does not exist yet (for the lists of what fits). */
  G.typePorts = function (type) { var t = T[type]; return { ins: t.ins.map(function (q) { return { node: "", port: q.port, kind: q.kind }; }), outs: t.out ? [{ node: "", kind: t.out }] : [] }; };
  /* Puts a new node (ref { type }) or a copy of a node or group (ref { item }) into the wire w: from -> it -> to. at is where its top left corner goes.
     Returns { ids: [the new item] } or { why }. Nothing changes when it fails. */
  G.insertOnWire = function (g, w, ref, at) {
    var a = G.node(g, w.from), b = G.node(g, w.to); if (!a || !b || !g.wires.some(function (x) { return x.from === w.from && x.to === w.to && x.port === w.port; })) return { why: "The wire is gone." };
    var id, made;
    if (ref.type) {
      if (!T[ref.type]) return { why: "Unknown node type." };
      var f0 = G.wireFit(g, w, G.typePorts(ref.type)); if (f0.why) return f0;
      id = G.addNode(g, ref.type, at.x, at.y).id; made = [id];
    } else {
      var src = G.node(g, ref.item) || G.group(g, ref.item); if (!src) return { why: "That item is gone." };
      var f1 = G.wireFit(g, w, G.itemPorts(g, ref.item)); if (f1.why) return f1;
      var cl = G.cloneItems(g, [ref.item], at.x - src.x, at.y - src.y);
      if (!cl.ids.length) return { why: "An Output node cannot be copied." };
      id = cl.ids[0]; made = cl.ids;
    }
    var P = G.itemPorts(g, id), f = G.wireFit(g, w, P);
    var undo = function (why) { made.forEach(function (i) { G.removeItem(g, i); }); return { why: why }; };
    if (f.why) return undo(f.why);
    var old = g.wires.filter(function (x) { return x.from === w.from && x.to === w.to && x.port === w.port; })[0];
    g.wires = g.wires.filter(function (x) { return x !== old; });
    var w1 = G.connect(g, w.from, f.inP.node, f.inP.port), w2 = w1 || G.connect(g, f.outP.node, w.to, w.port);
    if (w1 || w2) { g.wires = g.wires.filter(function (x) { return !(x.to === f.inP.node && x.port === f.inP.port && x.from === w.from); }); g.wires.push(old); return undo(w1 || w2); }
    var pa = G.parentOf(g, w.from), pb = G.parentOf(g, w.to);
    if (pa && pb && pa === pb) { if (G.node(g, id)) pa.nodes.push(id); else pa.groups.push(id); }   /* a wire inside one group: what sits in it stays in the group */
    return { ids: made };
  };

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
  /* A closed loop cut into equally spaced points, starting at the point nearest to "from" (the start of the loop that went in), so the points
     move gently when a parameter changes instead of jumping. */
  function steady(pts, from, step) {
    var n0 = pts.length; if (n0 < 3) return pts;
    var bi = 0, bd = Infinity; for (var i = 0; i < n0; i++) { var d = (pts[i][0] - from[0]) * (pts[i][0] - from[0]) + (pts[i][1] - from[1]) * (pts[i][1] - from[1]); if (d < bd) { bd = d; bi = i; } }
    var q = pts.slice(bi).concat(pts.slice(0, bi)), cum = [0];
    for (var j = 0; j < n0; j++) { var a = q[j], b = q[(j + 1) % n0]; cum.push(cum[j] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    var L = cum[n0]; if (L < 1e-9) return pts;
    var n = Math.max(8, Math.round(L / step)), out = [], k = 0;
    for (var m = 0; m < n; m++) {
      var u = L * m / n; while (k < n0 - 1 && cum[k + 1] < u) k++;
      var a2 = q[k], b2 = q[(k + 1) % n0], seg = cum[k + 1] - cum[k], t = seg > 1e-12 ? (u - cum[k]) / seg : 0;
      out.push([a2[0] + (b2[0] - a2[0]) * t, a2[1] + (b2[1] - a2[1]) * t]);
    }
    return out;
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
        if (p.step > 0) pts = steady(pts, l.pts[0], p.step);
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
  G.sig = function (g, id, env, memo, asOff) {
    memo = memo || {}; var mk = asOff ? id + "@" + asOff : id; if (memo[mk] != null) return memo[mk];
    var n = G.node(g, id); if (!n) return "?";
    memo[mk] = "…";
    var parts = [n.type, n.p], ins = g.wires.filter(function (w) { return w.to === id; }).map(function (w) { return w.port + ":" + G.sig(g, w.from, env, memo, G.groupOffFor(g, w.from, id)); });
    parts.push(ins); if (env && env.sigOf) parts.push(env.sigOf(n));
    var om = asOff || n.off; if (om) parts.push("OFF:" + om); if (n.bake) parts.push("B" + n.bake.at + ":" + n.bake.pts); if (G.draft && T[n.type].fringe) parts.push("draft");
    return (memo[mk] = JSON.stringify(parts));
  };
  /* ---------- bake (REQ-059): a node keeps its result and stops computing; the graph stays so Unbake can bring it back ---------- */
  function flat(path) { var o = []; path.forEach(function (q) { o.push(q.X, q.Y); }); return o; }
  function unflat(a) { var o = []; for (var i = 0; i + 1 < a.length; i += 2) o.push({ X: a[i], Y: a[i + 1] }); return o; }
  G.normBake = function (b) {
    if (!b || typeof b !== "object") return null;
    var o = { kind: b.kind === "path" ? "path" : b.kind === "shape" ? "shape" : "", prec: num(b.prec, 0.05), sig: String(b.sig || ""), pts: Math.max(0, Math.round(num(b.pts, 0))), at: Math.round(num(b.at, 0)) };
    if (o.kind === "shape" && Array.isArray(b.p)) o.p = b.p.filter(Array.isArray).map(function (a) { return a.map(Number); });
    else if (o.kind === "path" && Array.isArray(b.l)) o.l = b.l.filter(function (l) { return l && Array.isArray(l.q); }).map(function (l) { return { c: l.c ? 1 : 0, f: l.f ? 1 : 0, s: num(l.s, 0), q: l.q.map(Number) }; });
    else return null;
    return o;
  };
  G.bakedResult = function (n) {
    var b = n.bake;
    if (b.kind === "shape") return { kind: "shape", paths: b.p.map(unflat), err: "", baked: true, ms: 0 };
    return { kind: "path", loops: b.l.map(function (l) { var pts = []; for (var i = 0; i + 1 < l.q.length; i += 2) pts.push([l.q[i], l.q[i + 1]]); return { pts: pts, closed: !!l.c, flip: !!l.f, start: l.s }; }), err: "", baked: true, ms: 0 };
  };
  function dp(pts, tol, closed) {   /* Douglas-Peucker; a closed loop is cut at its two farthest-apart points first */
    if (pts.length < 4) return pts;
    function run(a) {
      if (a.length < 3) return a;
      var keep = new Array(a.length).fill(false); keep[0] = keep[a.length - 1] = true;
      var stack = [[0, a.length - 1]];
      while (stack.length) {
        var s = stack.pop(), i0 = s[0], i1 = s[1], dmax = 0, im = -1, ax = a[i0][0], ay = a[i0][1], bx = a[i1][0], by = a[i1][1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
        for (var i = i0 + 1; i < i1; i++) { var d = L < 1e-12 ? Math.hypot(a[i][0] - ax, a[i][1] - ay) : Math.abs(dy * a[i][0] - dx * a[i][1] + bx * ay - by * ax) / L; if (d > dmax) { dmax = d; im = i; } }
        if (dmax > tol && im > 0) { keep[im] = true; stack.push([i0, im], [im, i1]); }
      }
      return a.filter(function (q, i) { return keep[i]; });
    }
    if (!closed) return run(pts);
    var m = 0, best = -1; for (var i = 1; i < pts.length; i++) { var d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > best) { best = d; m = i; } }
    var a1 = run(pts.slice(0, m + 1)), a2 = run(pts.slice(m).concat([pts[0]]));
    return a1.slice(0, -1).concat(a2.slice(0, -1));
  }
  /* the result with every outline simplified to a tolerance in millimetres */
  G.simplify = function (res, tolMm) {
    if (!res || !res.kind) return res;
    var tol = Math.max(0, tolMm);
    if (res.kind === "shape") {
      var C = paths()._h, Lb = C.clip(), ps = res.paths.map(function (p) { return p.slice(); });
      if (tol > 0) ps = Lb.Clipper.CleanPolygons(ps, tol * 1000);
      ps = ps.filter(function (p) { return p.length >= 3 && Math.abs(Lb.Clipper.Area(p)) > 50; });
      return Object.assign({}, res, { paths: ps });
    }
    return Object.assign({}, res, { loops: res.loops.map(function (l) { return Object.assign({}, l, { pts: tol > 0 ? dp(l.pts, tol, l.closed) : l.pts }); }) });
  };
  G.pointsOf = function (res) {
    if (!res || !res.kind) return 0;
    var n = 0; if (res.kind === "shape") res.paths.forEach(function (p) { n += p.length; }); else res.loops.forEach(function (l) { n += l.pts.length; });
    return n;
  };
  /* Bakes a node: its current result, simplified to the precision, goes into the node. Returns "" or a reason. */
  G.bake = function (g, id, env, tolMm) {
    var n = G.node(g, id); if (!n) return "The node is missing.";
    if (n.type === "output") return "An Output node has nothing to bake; bake the node that feeds it.";
    var keep = n.bake, sigNow; delete n.bake;
    var r = G.evaluate(g, id, env, G.newMemo()); sigNow = G.sigPlain(g, id, env);
    if (!r.kind) { if (keep) n.bake = keep; return r.err || "This node has no result to bake."; }
    var s = G.simplify(r, tolMm);
    n.prec = tolMm;
    var b = { kind: s.kind, prec: tolMm, sig: sigNow, pts: G.pointsOf(s), at: Date.now() % 1e9 };
    if (s.kind === "shape") b.p = s.paths.map(flat);
    else b.l = s.loops.map(function (l) { var q = []; l.pts.forEach(function (v) { q.push(Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000); }); return { c: l.closed ? 1 : 0, f: l.flip ? 1 : 0, s: l.start || 0, q: q }; });
    n.bake = b; return "";
  };
  G.unbake = function (g, id) { var n = G.node(g, id); if (n) delete n.bake; };
  G.bakeSize = function (n) { return n && n.bake ? JSON.stringify(n.bake).length : 0; };
  /* the signature a node would have without its own bake: it changes when something upstream changed after the bake */
  G.sigPlain = function (g, id, env) {
    var n = G.node(g, id); if (!n) return "?"; var b = n.bake; delete n.bake;
    try { return G.sig(g, id, env, {}); } finally { if (b) n.bake = b; }
  };
  G.isStale = function (g, id, env) { var n = G.node(g, id); return !!(n && n.bake && n.bake.sig !== G.sigPlain(g, id, env)); };
  /* the nodes that feed an Output: the "whole graph" bake goes to these */
  G.finalNodes = function (g) {
    var out = [];
    g.nodes.forEach(function (n) { if (n.type !== "output") return; G.inputsOf(g, n.id, "in").forEach(function (f) { if (out.indexOf(f) < 0) out.push(f); }); });
    return out;
  };
  /* a cached result without computing (null when there is none) */
  G.peek = function (g, id, env) {
    var n = G.node(g, id); if (!n) return null;
    if (n.bake) return G.bakedResult(n);
    return cache[G.sig(g, id, env, {})] || null;
  };

  /* Evaluates a node: { kind, loops | paths, err } */
  G.evaluate = function (g, id, env, memo, asOff) {
    env = env || {}; memo = memo || { sig: {}, val: {} };
    var mk = asOff ? id + "@" + asOff : id, om;
    if (memo.val[mk]) return memo.val[mk];
    var n = G.node(g, id); if (!n) return { kind: null, err: "The node is missing." };
    if (n.type === "output") asOff = null;
    om = asOff || n.off;
    if (n.bake && !asOff) { var br = G.bakedResult(n); memo.val[mk] = br; return br; }
    var sg = G.sig(g, id, env, memo.sig, asOff), hit = cache[sg];
    if (hit) { memo.val[mk] = hit; return hit; }
    var ty = T[n.type], P_ = paths(), res, nowMs = function () { return typeof performance !== "undefined" ? performance.now() : Date.now(); }, t0 = nowMs(), k0 = memo.spent || 0;
    memo.val[mk] = { kind: null, err: "The graph has a loop." };
    function get(port) {
      return G.inputsOf(g, id, port).map(function (f) { return G.evaluate(g, f, env, memo, G.groupOffFor(g, f, id)); }).filter(function (v) { return !v.off; });   /* a node that is cut loose is as if its wire were not there */
    }
    function missing(what) { return { kind: null, err: "“" + ty.label + "” has no " + what + " connected." }; }
    if (om && n.type !== "output") {
      /* Disabled, three ways. "bypass": what comes in goes out (a path into a shape node becomes a hairline, 0.1 mm wide, of its form; a
         shape into a path node becomes closed loops). "empty": the node gives an empty value. "cut": the node is as if it were not wired in. */
      var dins = ty.ins || [], dv = dins.length ? get(dins[0].port)[0] : null, C3 = P_._clip;
      if (om === "cut") res = { kind: null, off: true, err: "“" + ty.label + "” is cut loose." };
      else if (om === "empty") res = ty.out === "path" ? { kind: "path", loops: [], err: "" } : { kind: "shape", paths: [], err: "" };
      else if (!dv) res = { kind: null, err: "“" + ty.label + "” is disabled and has no input to pass on." };
      else if (!dv.kind) res = dv;
      else if (ty.out === dv.kind) res = dv.kind === "path" ? { kind: "path", loops: dv.loops, err: "" } : { kind: "shape", paths: dv.paths, err: "" };
      else if (ty.out === "shape") {
        var dl = []; dv.loops.forEach(function (l) { if (l.pts.length > 1) C3.strokePaths(l.pts, 0.1, !!l.closed, false).forEach(function (q) { dl.push(q); }); });
        var du = dl.length ? C3.unionPaths(dl, false) : [];
        res = du.length ? { kind: "shape", paths: du, err: "" } : { kind: null, err: "“" + ty.label + "” is disabled and the path gave no line." };
      } else {
        var dq = dv.paths.map(function (q) { return { pts: C3.fromInt(q), closed: true, flip: false, start: 0 }; });
        res = dq.length ? { kind: "path", loops: dq, err: "" } : { kind: null, err: "“" + ty.label + "” is disabled." };
      }
    } else if (n.type === "layer") {
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
    } else if (ty.fringe) {
      var fv = get("in")[0];
      if (!fv) res = missing("path"); else if (!fv.kind) res = fv;
      else {
        var FM = fringeMod(), fg = FM.norm(n.p), facc = [];
        if (G.draft) { fg.detail = Math.min(fg.detail, 3); fg.flevels = Math.min(fg.flevels, 1); fg.forks = Math.min(fg.forks, 2); }   /* draft quality while a value is dragged */
        FM.takeWarn();
        fv.loops.forEach(function (l) { var sm = P_.sample(l, l.closed ? (l.start || 0) : 0); if (sm.L >= 1) facc = facc.concat(FM.onLoop(sm, fg, l.flip)); });
        facc = facc.length ? P_._clip.unionPaths(facc, false) : facc;
        var fw = FM.takeWarn();
        res = facc.length ? { kind: "shape", paths: facc, err: fw } : { kind: null, err: "“Fringe” drew nothing." };
      }
    } else if (ty.orn) {
      var ov = get("in")[0];
      if (!ov) res = missing("path"); else if (!ov.kind) res = ov;
      else {
        var OM = ornMod(), og = OM.norm(n.p), oacc = [];
        OM.takeWarn();
        ov.loops.forEach(function (l) { var sm = P_.sample(l, l.closed ? (l.start || 0) : 0); if (sm.L >= 1) oacc = oacc.concat(OM.onLoop(sm, og, l.flip)); });
        oacc = oacc.length ? P_._clip.unionPaths(oacc, false) : oacc;
        var ow = OM.takeWarn();
        res = oacc.length ? { kind: "shape", paths: oacc, err: ow } : { kind: null, err: ow || "“Ornament” drew nothing." };
      }
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
    var own = Math.max(0, nowMs() - t0 - ((memo.spent || 0) - k0)); memo.spent = (memo.spent || 0) + own; res.ms = own;   /* this node's own time, without its inputs */
    remember(sg, res); memo.val[mk] = res; return res;
  };
  G.newMemo = function () { return { sig: {}, val: {} }; };
  G.round = function (v) { return Math.round(v * 100) / 100; };
  PTD.graph = G;
  if (typeof module !== "undefined" && module.exports) module.exports = G;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
