/* The procedural graph: the browser part (REQ-049 to REQ-052). The engine is in graph.js, the path maths in paths.js.
 * - A pattern is a layer (glyph-like, flags `pattern` and `glyph`) with `pattern = { out: id of its Output node }`. Its shape is cached in
 *   `frozen` (millimetres, artwork coordinates) and made again by refresh() when the graph, the objects it follows or a table changed.
 * - The graph editor lives in the dock under the stage (js/layout.js). The layer panel shows the exposed ("pinned") parameters. */
(function (PTD) {
  "use strict";
  var U = {}, cache = {}, status = {}, busy = false, ed = { wanted: false, pin: "", interacted: false, sel: "", set: {}, focus: false, only: true, vb: null, lastLayer: "" };
  var GRID = 20, WN = 160, EMPTY = { d: "M0 0Z", x0: 0, y0: 0, x1: 1, y1: 1 };
  function C() { return PTD.core; }
  function S() { return C().state(); }
  function G() { return PTD.graph; }
  function esc(t) { return C().esc(t); }
  function say(t) { C().say(t); }
  function gr() { var s = S(); if (!s.graph) s.graph = G().empty(); return s.graph; }
  function patterns() { return S().layers.filter(function (l) { return l.pattern; }); }
  function layerByUid(u) { return S().layers.filter(function (l) { return l.uid === u || l.id === u; })[0]; }
  function AO() { return C().artOrigin(); }
  function r1(v) { return Math.round(v * 100) / 100; }

  /* ---------- the environment of the maths ---------- */
  function itemLayers(items) {
    var out = [], seen = {};
    (items || []).forEach(function (it) {
      var ls = it.g ? PTD.groups.layersIn(S(), it.g) : [layerByUid(it.l)].filter(Boolean);
      ls.forEach(function (l) { if (!seen[l.id]) { seen[l.id] = 1; out.push(l); } });
    });
    return out;
  }
  function srcSig(l) {
    var f = l.frozen;
    return [l.uid, l.x, l.y, l.rot, l.size, l.text, l.font, l.ls, l.weight, l.italic, l.upper, l.exact, l.outline, l.outlineW, l.box && [l.box.w, l.box.h, l.box.dy], f && [f.d.length, f.x0, f.y0, f.x1, f.y1, f.d.slice(0, 40), f.d.slice(-40)]];
  }
  function makeEnv(visiting) {
    var env = { pending: false, rough: false };
    env.tableLoops = function (tid, which) {
      var tabs = S().tables, t = tabs.filter(function (q) { return q.id === tid; })[0] || tabs.filter(function (q) { return !q.hidden; })[0] || tabs[0];
      if (!t) return [];
      var g = PTD.tables.geo(t), a = AO(), pts = null, closed = true;
      if (which === "rail") pts = g.rail; else if (which === "wrap") pts = g.wrap;
      else if (which === "bet") { if (g.bet) { pts = g.bet.pts; closed = g.bet.closed; } } else pts = g.poly;
      if (!pts || pts.length < 2) return [];
      return [{ pts: pts.map(function (p) { return [p[0] - a.x, p[1] - a.y]; }), closed: closed }];
    };
    env.sources = function (items) {
      var a = AO(), out = [];
      itemLayers(items).forEach(function (l) {
        if (l.pattern) ensure(l, visiting || {});
        var f = PTD.measure.textFeature(l);
        if (!f) { env.pending = true; return; }
        if (f.how === "box" && !l.frozen) env.pending = true;
        if (f.how === "traced") env.rough = true;
        out.push({ rings: f.rings.map(function (r) { return r.pts.map(function (p) { return [p[0] - a.x, p[1] - a.y]; }); }), halo: l.outline && l.outlineW > 0 ? l.outlineW : 0 });
      });
      return out;
    };
    env.sigOf = function (n) {
      var parts = [AO()];
      if (n.type === "objects" || n.type === "layer") parts.push(itemLayers(n.p.items).map(srcSig));
      if (n.type === "table" || n.type === "tablearea") parts.push(S().tables.map(function (t) { return [t.id, t.nodes, t.x, t.y, t.rot, t.railW, t.wrap, t.bet]; }));
      return JSON.stringify(parts);
    };
    return env;
  }
  /* Makes the shape of a pattern layer again when something it depends on has changed. `visiting` guards against cycles. */
  function ensure(l, visiting) {
    var key = l.uid || l.id, g = gr(), out = l.pattern.out, n = G().node(g, out);
    if (visiting[key]) { status[key] = "Cycle: this pattern depends on itself. Change the objects it follows."; return; }
    if (!n) { status[key] = "The Output node of this pattern is missing."; return; }
    visiting[key] = 1;
    var env = makeEnv(visiting), sg = G().sig(g, out, env);
    if (cache[key] === sg) { delete visiting[key]; return; }
    if (g.manual && !U.forced && l.frozen && l.frozen.d) { status[key] = "Out of date: the graph is on manual compute. Press Compute in the graph editor."; delete visiting[key]; return; }
    var r = G().evaluate(g, out, env, G().newMemo()), note = "";
    if (r.kind === "shape") { l.frozen = PTD.paths.shapeOf(r.paths) || EMPTY; note = r.err || ""; }
    else if (r.kind === "path") { l.frozen = EMPTY; note = "Only a path reaches this Output, so nothing is drawn or cut. Wire a shape node in; select a node in the graph to see its result."; }
    else note = r.err || "The pattern is empty.";
    if (env.rough && r.kind === "shape") note += (note ? " " : "") + "Text outlines are traced (rough); load the font file for exact rings.";
    status[key] = note;
    if (env.pending) G().clearCache(); else cache[key] = sg;
    delete visiting[key];
  }
  U.refresh = function () {
    if (busy) return; busy = true;
    try {
      var g = gr(), used = {};
      patterns().forEach(function (l) { used[l.pattern.out] = 1; });
      g.nodes.filter(function (n) { return n.type === "output" && !used[n.id]; }).forEach(function (n) { G().removeNode(g, n.id); if (ed.sel === n.id) ed.sel = ""; });
      patterns().forEach(function (l) { ensure(l, {}); });
    } finally { busy = false; }
  };
  U.compute = function () { U.forced = true; try { U.refresh(); } finally { U.forced = false; } C().renderStage(); C().renderPanels(); };
  U.status = function (l) { return status[l.uid || l.id] || ""; };
  U.forget = function () { cache = {}; G().clearCache(); };

  /* ---------- cycles between patterns (a pattern that follows objects) ---------- */
  function readsOf(l) {
    var g = gr(), out = [];
    G().upstream(g, l.pattern.out).forEach(function (id) { var n = G().node(g, id); if (n && (n.type === "objects" || n.type === "layer")) itemLayers(n.p.items).forEach(function (x) { if (x.pattern) out.push(x); }); });
    return out;
  }
  function cycleMsg() {
    function walk(l, target, chain, seen) {
      var rs = readsOf(l);
      for (var i = 0; i < rs.length; i++) {
        if (rs[i] === target) return chain.concat([rs[i]]);
        if (!seen[rs[i].id]) { seen[rs[i].id] = 1; var r = walk(rs[i], target, chain.concat([rs[i]]), seen); if (r) return r; }
      }
      return null;
    }
    var ps = patterns();
    for (var i = 0; i < ps.length; i++) {
      var ch = walk(ps[i], ps[i], [ps[i]], {});
      if (ch) return "That would make a loop: " + ch.map(function (l) { return "pattern “" + l.text + "”"; }).join(" → ") + ". The change was not made.";
    }
    return "";
  }
  function guarded(change) {
    var s = S(), before = JSON.stringify(s.graph);
    change();
    var m = cycleMsg();
    if (m) { s.graph = G().norm(JSON.parse(before)); U.forget(); say(m); C().renderPanels(); C().renderStage(); return false; }
    return true;
  }
  function commit(tag, light) {
    U.forget(); C().save(tag + ":" + Date.now());
    if (light) { paintCanvas(); return; }
    C().renderPanels(); C().renderStage();
  }

  /* ---------- making patterns ---------- */
  function viewCentre() { var a = AO(), v = C().ui.view || { cx: 0, cy: 0 }; return { x: Math.round(v.cx - a.x), y: Math.round(v.cy - a.y) }; }
  function newLayer(outId) {
    var s = S(), n = patterns().length + 1;
    var l = C().mkLayer("Pattern " + n, "Mea Culpa", 100, 0, 0, 0, 0, true, false);
    l.pattern = { out: outId }; l.glyph = true; l.exact = false; l.outline = false;
    l.frozen = { d: EMPTY.d, x0: 0, y0: 0, x1: 1, y1: 1 }; l.x = 0; l.y = 0;
    l.id = "l" + (s.layers.length + 1); s.layers.push(l); s.selected = l.id; C().ui.open[l.id] = true;
    return l;
  }
  function placeFree(x, y) {   /* a free spot near (x, y) */
    var g = gr(), tries = 0;
    while (tries++ < 40 && g.nodes.some(function (n) { return Math.abs(n.x - x) < 120 && Math.abs(n.y - y) < 70; })) y += 90;
    return { x: x, y: y };
  }
  function addPattern() {
    var g = gr(), c = viewCentre();
    var base = placeFree(20, g.nodes.length ? Math.max.apply(0, g.nodes.map(function (n) { return n.y; })) + 100 : 20);
    var src = G().addNode(g, "circle", base.x, base.y, Object.assign(G().defaultParams("circle"), { cx: c.x, cy: c.y }));
    var st = G().addNode(g, "stroke", base.x + 220, base.y), out = G().addNode(g, "output", base.x + 440, base.y);
    G().connect(g, src.id, st.id, "in"); G().connect(g, st.id, out.id, "in");
    var l = newLayer(out.id); setSel([st.id]); ed.only = true; ed.vb = null; ed.wanted = true;
    U.forget(); C().save("pattern:" + Date.now()); C().renderPanels(); C().renderStage();
    return l;
  }
  U.addPattern = addPattern;
  U.openEditor = function () { ed.wanted = true; if (PTD.layout) { PTD.layout.dock.open(); PTD.layout.update && PTD.layout.update(); } };

  /* Context-menu helpers (REQ-049..052): new pattern layers made from objects. The source is an input node that follows the object, so the copy stays alive when the original changes. */
  var MAKERS = {
    graph: { label: "Generate graph", tip: "Makes a new pattern whose graph is the shape of this object going straight to an Output: a procedural copy that you can build on.", chain: [] },
    outline: { label: "Generate outline pattern", tip: "A new pattern: a line of constant width along the edge of this object (Edge of shape, then Stroke).", chain: [["outline", {}], ["stroke", {}]] },
    border: { label: "Generate border ring pattern", tip: "A new pattern: a ring around this object (the object grown by 10 mm, minus the object).", chain: "border" },
    grown: { label: "Generate grown pattern", tip: "A new pattern: this object grown by 10 mm (Offset).", chain: [["offset", { dist: 10 }]] },
    filled: { label: "Generate hole-free pattern", tip: "A new pattern: this object with all its holes closed (Fill holes).", chain: [["fill", {}]] }
  };
  U.makers = MAKERS;
  U.make = function (kind, srcLayer) {
    var mk = MAKERS[kind], g = gr(), src = srcLayer && srcLayer.uid ? srcLayer : null; if (!mk || !src) return null;
    var base = placeFree(20, g.nodes.length ? Math.max.apply(0, g.nodes.map(function (n) { return n.y; })) + 100 : 20);
    var lay = G().addNode(g, "layer", base.x, base.y), x = base.x + 220, last = lay;
    lay.p.items = [{ l: src.uid }];
    function add(type, p) { var n = G().addNode(g, type, x, base.y, p ? Object.assign(G().defaultParams(type), p) : null); G().connect(g, last.id, n.id, "in"); last = n; x += 220; return n; }
    if (mk.chain === "border") { var of = add("offset", { dist: 10 }), sb = G().addNode(g, "subtract", x, base.y); G().connect(g, of.id, sb.id, "in"); G().connect(g, lay.id, sb.id, "in"); last = sb; x += 220; }
    else mk.chain.forEach(function (c) { add(c[0], c[1]); });
    var out = G().addNode(g, "output", x, base.y); G().connect(g, last.id, out.id, "in");
    var l = newLayer(out.id);
    l.text = (src.text || "Pattern") + (kind === "graph" ? " (graph)" : " (" + kind + ")");
    var off = Math.max(10, Math.round(Math.max((C().ui.bounds[src.id] || {}).w || 0, 0) * 0.1));
    l.x = round1((src.x || 0) + off); l.y = round1((src.y || 0) + off);   /* a little down and to the right of the original */
    l.size = src.pattern ? src.size : 100;
    setSel([last.id]); ed.only = true; ed.vb = null; ed.wanted = true;
    U.forget(); C().save("pattern:" + Date.now()); C().renderPanels(); C().renderStage();
    return l;
  };
  function round1(v) { return Math.round(v * 10) / 10; }
  function addOutputLayer(fromId) {
    var g = gr(), out = G().addNode(g, "output", 0, 0), src = fromId && G().node(g, fromId);
    var pos = placeFree(src ? src.x + 220 : 20, src ? src.y : 20); out.x = pos.x; out.y = pos.y;
    if (src) { var why = G().connect(g, fromId, out.id, "in"); if (why) say(why); }
    newLayer(out.id); ed.only = true; commit("output");
  }
  U.cloneOut = function (pattern) {
    var g = gr(), old = G().node(g, pattern.out), out = G().addNode(g, "output", old ? old.x : 0, old ? old.y + 90 : 0);
    if (old) G().inputsOf(g, old.id, "in").forEach(function (f) { G().connect(g, f, out.id, "in"); });
    return { out: out.id };
  };

  /* ---------- the nodes of the selected layer, the pins ---------- */
  function selLayer() {
    var ids = C().selectedIds().map(C().getLayer).filter(Boolean).filter(function (l) { return l.pattern; });
    return ids[0] || null;
  }
  /* The layer the editor shows: the selected pattern, or (so that objects can be picked on the stage for an input node while the editor is open) the last one edited. */
  function editLayer() {
    var l = selLayer(); if (l) { ed.pin = l.id; return l; }
    if (ed.interacted && ed.pin) { var q = C().getLayer(ed.pin); if (q && q.pattern) return q; }
    return null;
  }
  function outputsOf(id) {   /* the Output nodes that this node feeds */
    var g = gr(), seen = {}, outs = {};
    (function walk(n) {
      if (seen[n]) return; seen[n] = 1;
      var nd = G().node(g, n); if (nd && nd.type === "output") outs[n] = 1;
      g.wires.forEach(function (w) { if (w.from === n) walk(w.to); });
    })(id);
    return Object.keys(outs);
  }
  function spec(n, key) { var ty = G().TYPES[n.type]; return ty && ty.params.filter(function (q) { return q.key === key; })[0]; }
  function setParam(n, key, raw, el) {
    var s = spec(n, key), p = Object.assign({}, n.p), v;
    if (s && s.t === "chk") v = el ? el.checked : !!raw;
    else if (s && s.t === "sel") v = raw;
    else if (typeof p[key] === "number" || (s && (s.t === "num" || s.t === "int"))) { v = parseFloat(raw); if (!isFinite(v)) return false; }
    else if (typeof p[key] === "boolean") v = raw === true || raw === "true";
    else v = raw;
    p[key] = v; n.p = G().normParams(n.type, p, n.id); return true;
  }
  function onField(el) {
    var d = el.dataset, g = gr(), a;
    if (d.gp) {
      a = d.gp.split("|"); var n = G().node(g, a[0]); if (!n) return;
      guarded(function () {
        if (a[1] === "pt") { var q = n.p.pts[+a[2]]; if (q) { var v = parseFloat(el.value); if (isFinite(v)) q[a[3]] = v; } n.p = G().normParams(n.type, n.p, n.id); }
        else setParam(n, a[1], el.value, el);
      });
      commit("gparam"); paintPreview();
    } else if (d.gx) {
      a = d.gx.split("|"); var n2 = G().node(g, a[0]); if (!n2) return;
      guarded(function () { setParam(n2, a[1], el.value, null); });
      commit("gpin"); paintPreview();
    } else if (d.gpe) {
      a = d.gpe.split("|"); var n3 = G().node(g, a[0]), e = n3 && n3.exp.filter(function (q) { return q.key === a[1]; })[0]; if (!e) return;
      if (a[2] === "label") e.label = el.value.slice(0, 40); else { var vv = parseFloat(el.value); if (isFinite(vv)) e[a[2]] = vv; }
      commit("gpinedit");
    } else if (d.gsel) {
      var sl = layerByUid(d.gsel); if (sl) { /* not used */ }
    }
  }
  function togglePin(nid, key) {
    var n = G().node(gr(), nid); if (!n) return;
    var i = -1; n.exp.forEach(function (e, k) { if (e.key === key) i = k; });
    if (i >= 0) n.exp.splice(i, 1);
    else {
      var s = spec(n, key), cur = n.p[key], span = Math.max(10, Math.abs(cur) * 2);
      n.exp.push({ key: key, label: (s ? s.label : key).replace(/ \(.*\)$/, ""), min: s && s.min != null ? s.min : -span, max: s && s.max != null ? s.max : Math.max(span, cur * 3) });
    }
    commit("gpin");
  }

  /* ---------- markup: the parameter fields ---------- */
  function opts(list, cur) { return list.map(function (k) { return '<option value="' + esc(k[0]) + '"' + (k[0] === cur ? " selected" : "") + ">" + esc(k[1]) + "</option>"; }).join(""); }
  function scrubAttr(s) {   /* the step of a drag over the number: fine for small ranges, one unit otherwise */
    if (s.t === "int") return ' data-scrub="1"';
    var rg = s.min != null && s.max != null ? s.max - s.min : 1e9;
    return ' data-scrub="' + (rg <= 10 ? 0.01 : rg <= 100 ? 0.5 : 1) + '"';
  }
  function fieldHtml(n, s) {
    var key = n.id + "|" + s.key, v = n.p[s.key], pin = n.exp.some(function (e) { return e.key === s.key; }), h;
    var pinBtn = (s.t === "num" || s.t === "int") ? '<button class="tbtn gxpin' + (pin ? " on" : "") + '" type="button" data-pa="gpin" data-nid="' + n.id + '" data-key="' + s.key + '" title="' + (pin ? "Unpin: remove this value from the layer panel." : "Pin: show this value as a slider in the panel of the layer.") + '">' + (pin ? "●" : "○") + "</button>" : "";
    if (s.t === "chk") return '<label class="chk" title="' + esc(s.tip) + '"><input type="checkbox" data-gp="' + key + '"' + (v ? " checked" : "") + ' title="' + esc(s.tip) + '"><span>' + esc(s.label) + "</span></label>";
    if (s.t === "sel") h = '<select data-gp="' + key + '" title="' + esc(s.tip) + '">' + opts(s.opts, v) + "</select>";
    else h = '<input type="number"' + scrubAttr(s) + ' step="' + (s.step || "any") + '"' + (s.min != null ? ' min="' + s.min + '"' : "") + (s.max != null ? ' max="' + s.max + '"' : "") + ' data-gp="' + key + '" value="' + r1(v) + '" title="' + esc(s.tip) + '">';
    var pe = "";
    if (pin) { var e = n.exp.filter(function (q) { return q.key === s.key; })[0], k2 = n.id + "|" + s.key + "|"; pe = '<div class="gxpe small">Panel label <input type="text" data-gpe="' + k2 + 'label" value="' + esc(e.label) + '" title="The label of this slider in the layer panel."> from <input type="number" step="any" data-gpe="' + k2 + 'min" value="' + r1(e.min) + '" title="Left end of the slider."> to <input type="number" step="any" data-gpe="' + k2 + 'max" value="' + r1(e.max) + '" title="Right end of the slider."></div>'; }
    var dice = s.key === "seed" ? '<button class="tbtn gxdice" type="button" data-pa="gdice" data-nid="' + n.id + '" data-key="seed" title="A new random seed: gives a different random result.">🎲</button>' : "";
    return '<label class="fld" title="' + esc(s.tip) + '"><span>' + esc(s.label) + "</span>" + h + dice + pinBtn + "</label>" + pe;
  }
  function nodeFields(n) {
    var ty = G().TYPES[n.type], h = "";
    ty.params.forEach(function (s) { if (!s.when || s.when(n.p)) h += fieldHtml(n, s); });
    if (n.type === "lines") {
      h += '<table class="ptnodes"><tr><th>#</th><th>X</th><th>Y</th><th title="Rounding radius at this point. The ends of an open line stay sharp.">Radius</th><th></th></tr>';
      n.p.pts.forEach(function (q, i) {
        var kk = n.id + "|pt|" + i + "|";
        h += "<tr><td>" + (i + 1) + '</td><td><input type="number" step="any" data-gp="' + kk + 'x" value="' + r1(q.x) + '" title="X of this point, millimetres from the artwork origin."></td><td><input type="number" step="any" data-gp="' + kk + 'y" value="' + r1(q.y) + '" title="Y of this point, millimetres from the artwork origin."></td><td><input type="number" step="any" min="0" data-gp="' + kk + 'r" value="' + r1(q.r) + '" title="Rounding radius at this point. 0 is a sharp corner."></td><td><button class="tbtn" type="button" data-pa="gpt-" data-nid="' + n.id + '" data-idx="' + i + '" title="Remove this point (a path keeps at least two points).">✕</button></td></tr>';
      });
      h += '</table><button class="btn" type="button" data-pa="gpt+" data-nid="' + n.id + '" title="Adds a point after the last one.">+ Add point</button>';
    }
    if (n.type === "table" || n.type === "tablearea") {
      var tl = S().tables.map(function (t) { return [t.id, t.name]; });
      h += '<label class="fld" title="The table whose line the path follows."><span>Table</span><select data-gp="' + n.id + '|table" title="The table whose line the path follows.">' + opts(tl, n.p.table || (tl[0] && tl[0][0])) + "</select></label>";
    }
    if (n.type === "objects" || n.type === "layer") {
      h += '<p class="small">' + (n.type === "layer" ? "Takes the shape of " : "Follows the outer edge of ") + (n.p.items.length ? n.p.items.length + " chosen object" + (n.p.items.length > 1 ? "s" : "") : "no objects yet") + ". Select texts, glyphs, patterns or one group, then press the button.</p>" +
        '<div class="btnrow"><button class="btn" type="button" data-pa="gobj" data-nid="' + n.id + '" title="Takes the selected texts, glyphs and patterns (or the selected group) as the objects this path follows.">Use selected objects</button>' + (n.type === "objects" ? '<button class="btn" type="button" data-pa="gfreeze" data-nid="' + n.id + '" title="Keeps the path as it is now; it stops following the objects.">Freeze</button>' : "") + "</div>";
    }
    return h;
  }

  /* ---------- bake, variants, speed (REQ-059) ---------- */
  function thumbSvg(r) {
    var d = "", x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    function add(q, i) { var x = r1(q[0]), y = r1(q[1]); d += (i ? "L" : "M") + x + " " + y; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (r.kind === "shape") r.paths.forEach(function (p) { p.forEach(function (q, i) { add([q.X / 1000, q.Y / 1000], i); }); d += "Z"; });
    else r.loops.forEach(function (l) { l.pts.forEach(add); if (l.closed) d += "Z"; });
    if (!d) return "";
    var m = Math.max(x1 - x0, y1 - y0) * 0.05 + 1;
    return '<svg viewBox="' + (x0 - m) + " " + (y0 - m) + " " + (x1 - x0 + 2 * m) + " " + (y1 - y0 + 2 * m) + '" preserveAspectRatio="xMidYMid meet"><path d="' + d + '" fill="' + (r.kind === "shape" ? "#d4af5a" : "none") + '" fill-rule="evenodd" stroke="' + (r.kind === "shape" ? "#5a4513" : "#4fd1d9") + '" stroke-width="' + ((x1 - x0) / 300 + 0.3) + '"></path></svg>';
  }
  function bakeInfoText(n) {
    var env = makeEnv({}), r = G().evaluate(gr(), n.id, env, G().newMemo());
    if (!r.kind) return "This node has no result to bake yet.";
    var prec = n.prec != null ? n.prec : 0.05, now = G().pointsOf(r), after = G().pointsOf(G().simplify(r, prec));
    return "Now " + now + " points; baked at " + r1(prec) + " mm: " + after + " points.";
  }
  function bakeHtml(n) {
    if (n.type === "output") return "";
    var env = makeEnv({}), prec = n.prec != null ? n.prec : 0.05, h = '<h4 class="small gxh">Bake</h4>';
    if (n.bake) {
      h += '<p class="small">Baked: ' + n.bake.pts + " points, " + (G().bakeSize(n) / 1024).toFixed(1) + " kB, precision " + r1(n.bake.prec) + ' mm. This node no longer computes; its values and inputs are kept for Unbake.</p>';
      if (G().isStale(gr(), n.id, env)) h += '<p class="small warn">Out of date: this node or what feeds it has changed since the bake. Press Re-bake to update it, or Unbake.</p>';
    } else {
      var r = G().peek(gr(), n.id, env);
      if (r && r.ms > 1000) h += '<p class="small warn">This node took ' + (r.ms / 1000).toFixed(1) + " s to compute. Bake it so that it stops computing?</p>";
    }
    h += '<label class="fld" title="How closely the baked outline follows the exact one: points closer than this are removed. Smaller keeps more detail and a bigger file."><span>Precision (mm)</span><input type="number" step="0.01" min="0.001" max="5" data-bk="prec" data-nid="' + n.id + '" value="' + r1(prec) + '" title="How closely the baked outline follows the exact one, in millimetres."></label>';
    if (!n.bake) h += '<p class="small" id="gxbkinfo">' + esc(gr().manual && !G().peek(gr(), n.id, env) ? "Press Compute to see the point count." : bakeInfoText(n)) + "</p>";
    h += '<div class="btnrow"><button class="btn" type="button" data-pa="gbake" data-nid="' + n.id + '" title="Keeps the result of this node as fixed geometry at the chosen precision. The node stops computing.">' + (n.bake ? "Re-bake" : "Bake") + "</button>" +
      (n.bake ? '<button class="btn" type="button" data-pa="gunbake" data-nid="' + n.id + '" title="Makes the node live again: it computes from its values and inputs.">Unbake</button>' : "") + "</div>";
    if (spec(n, "seed")) h += '<div class="btnrow"><button class="btn" type="button" data-pa="gvar" data-nid="' + n.id + '" title="Rolls twelve different seeds and shows them as small pictures; click one to use it.">Try variants</button></div><div class="gxvar" id="gxvar"></div>';
    return h;
  }
  function slowHtml() {
    var g = gr(), env = makeEnv({}), rows = [];
    g.nodes.forEach(function (n) { if (n.type === "output" || n.bake) return; var r = G().peek(g, n.id, env); if (r && r.ms >= 1) rows.push({ n: n, ms: r.ms, pts: G().pointsOf(r) }); });
    if (!rows.length) return "";
    rows.sort(function (a, b) { return b.ms - a.ms; });
    var tot = rows.reduce(function (s, r) { return s + r.ms; }, 0);
    return '<h4 class="small gxh">Slowest nodes (total ' + (tot < 1000 ? Math.round(tot) + " ms" : (tot / 1000).toFixed(1) + " s") + ')</h4><ul class="gxslow">' + rows.slice(0, 6).map(function (r) { return '<li><button class="tbtn" type="button" data-pa="gsel" data-nid="' + r.n.id + '" title="Select this node.">' + esc(labelOf(r.n)) + "</button> " + (r.ms < 10 ? r.ms.toFixed(1) : Math.round(r.ms)) + " ms, " + r.pts + " points</li>"; }).join("") + "</ul>";
  }
  function runVariants(nid) {
    var g = gr(), n = G().node(g, nid), box = document.getElementById("gxvar"); if (!n || !box) return;
    var keep = n.p.seed, base = Math.max(1, Math.round(keep)), seeds = [], i, token = (ed.varToken = (ed.varToken || 0) + 1);
    for (i = 0; i < 12; i++) seeds.push(i === 0 ? keep : base + 1 + Math.floor(Math.random() * 9998));
    box.innerHTML = seeds.map(function (s, k) { return '<button class="gxvthumb" type="button" data-pa="gpick" data-nid="' + nid + '" data-seed="' + s + '" id="gxv' + k + '" title="Use seed ' + s + '"><small>' + s + "</small></button>"; }).join("");
    var k = 0;
    (function next() {
      if (token !== ed.varToken || k >= seeds.length) return;
      var nn = G().node(gr(), nid), btn = document.getElementById("gxv" + k); if (!nn || !btn) return;
      var old = nn.p.seed; nn.p.seed = seeds[k];
      var r = G().evaluate(gr(), nid, makeEnv({}), G().newMemo()); nn.p.seed = old;
      btn.insertAdjacentHTML("afterbegin", r && r.kind ? thumbSvg(r) : "");
      k++; setTimeout(next, 0);
    })();
  }
  /* turns a pattern into a plain static glyph: the graph is no longer needed for it */
  U.detach = function (l) {
    if (!l || !l.pattern) return;
    if (Math.abs(l.rot || 0) > 1e-9) { say("Set the rotation to 0 first: a detached pattern turns about its own centre."); return; }
    var fz = l.frozen;   /* what is drawn now is what is kept: the stored outline, moved to the centre and scaled to 1000 units high */
    if (!fz || !fz.d) { say("Nothing to detach: the pattern has no shape yet."); return; }
    var k = l.size > 0 ? l.size / 100 : 1, cx = (fz.x0 + fz.x1) / 2, cy = (fz.y0 + fz.y1) / 2, h = fz.y1 - fz.y0, s = 1000 / h, d = "";
    d = fz.d.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, function (m, c, x, y) { return c + (Math.round((x - cx) * s * 100) / 100) + " " + (Math.round((y - cy) * s * 100) / 100); });
    var hw = (fz.x1 - fz.x0) * s / 2;
    l.x = l.x + k * cx; l.y = l.y + k * cy; l.size = h * k; l.frozen = { d: d, x0: -hw, y0: -500, x1: hw, y1: 500 }; l.pattern = null;
    commit("gdetach"); say("The pattern is now a plain glyph; its graph nodes stay in the graph editor but no longer make a layer.");
  };

  /* ---------- the layer panel ---------- */
  U.body = function (l, sc, nSel) {
    var H = C().h, g = gr(), st = U.status(l), up = G().upstream(g, l.pattern.out), pins = "";
    g.nodes.forEach(function (n) {
      if (up.indexOf(n.id) < 0) return;
      n.exp.forEach(function (e) {
        var cur = n.p[e.key], outs = outputsOf(n.id), key = n.id + "|" + e.key, tip = "Pinned value of the node “" + G().TYPES[n.type].label + "”.";
        pins += '<div class="fld gxexp" title="' + esc(tip) + '"><span>' + esc(e.label) + (outs.length > 1 ? ' <em class="gxshared" title="This node also feeds ' + (outs.length - 1) + ' other output' + (outs.length > 2 ? "s" : "") + ': changing it changes them too.">shared</em>' : "") + '</span><input type="range" min="' + e.min + '" max="' + e.max + '" step="any" data-gx="' + key + '" value="' + cur + '" title="' + esc(tip) + '"><input type="number" step="any" data-gx="' + key + '" value="' + r1(cur) + '" title="' + esc(tip) + '"></div>';
      });
    });
    return '<div class="body">' +
      (nSel > 1 ? '<p class="small multi">' + nSel + " items are selected. Changes here apply to all of them, except the name and the position.</p>" : "") +
      '<p class="small multi">A pattern is the result of a chain in the graph under the stage. It scales and turns about the artwork origin; the corner handles on the stage change the scale; Centre X and Y nudge it.</p>' +
      '<label class="fld"><span>Name</span><input type="text" data-scope="' + sc + '" data-key="text" autocomplete="off"></label>' +
      '<div class="btnrow"><button class="btn" type="button" data-pa="gopen" title="Opens the graph editor under the stage for this pattern.">Edit graph</button><button class="btn" type="button" data-pa="gdetach" data-lid="' + l.id + '" title="Turns this pattern into a plain glyph with no graph behind it: smaller file, but it can no longer be changed through the graph. Undo takes it back.">Make plain glyph</button></div>' +
      (st ? '<p class="small warn" data-pstatus="1">' + esc(st) + "</p>" : "") +
      (pins ? '<h4 class="small">Pinned values</h4>' + pins : '<p class="small">No pinned values. In the graph, press ○ next to a value to show it here.</p>') +
      H.pair("Scale (%)", sc, "size", 5, 400, 1, 1, 3000) + '<p class="small multi">Scales the whole pattern (100 % is the size the graph made); the corner handles on the stage do the same. When the pattern is bigger than the view the handles are outside it: press Fit view.</p>' + H.pair("Rotation", sc, "rot", -180, 180, 1, -360, 360) + H.pair("Opacity", sc, "opacity", 0, 1, 0.01, 0, 1) +
      '<div class="colorrow" data-colour="' + sc + ':color:Colour"></div>' +
      '<div class="checks">' + H.chk("Gold shading (shaded preview only)", sc, "gradient") + "</div>" +
      '<div class="checks">' + H.chk("Halo (hides what is below)", sc, "outline") + H.chk("Use cloth colour", sc, "outlineAuto") + "</div>" +
      H.pair("Halo width", sc, "outlineW", 0, 50, 0.5, 0, 300) +
      '<div class="colorrow" data-colour="' + sc + ':outlineColor:Halo colour, used when the cloth colour is off"></div>' +
      '<div class="row2">' + H.len("Centre X", sc, "x") + H.len("Centre Y", sc, "y") + "</div>" +
      "</div>";
  };

  /* ---------- the editor ---------- */
  var COL = { path: "#4fd1d9", shape: "#d4af5a", any: "#9aa0a6" };   /* shapes are gold like the cloth art, paths blue */
  function nodeH(n) { var ty = G().TYPES[n.type]; return 26 + 18 * Math.max(1, ty.ins.length); }
  function labelOf(n) { return n.name || shortName(G().TYPES[n.type].label); }
  function vmBuild() { var g = gr(); ed.vm = G().view(g, { nodes: visible().map(function (n) { return n.id; }), WN: WN, nodeH: nodeH, label: labelOf }); return ed.vm; }
  function vm() { return ed.vm || vmBuild(); }
  function itemOf(id) { var g = gr(); return G().node(g, id) || G().group(g, id); }
  /* Where a wire meets a node, or the black box that hides it. */
  function inPos(n, i) {
    var v = vm(), b = v.hidden[n.id], port = G().TYPES[n.type].ins[i] ? G().TYPES[n.type].ins[i].port : "in";
    if (b && v.boxes[b]) { var bx = v.boxes[b], k = 0; bx.ins.forEach(function (q, j) { if (q.node === n.id && q.port === port) k = j; }); return { x: bx.x, y: bx.y + 26 + 18 * k + 9 }; }
    var p = v.pos[n.id] || n; return { x: p.x, y: p.y + 26 + 18 * i + 9 };
  }
  function outPos(n) {
    var v = vm(), b = v.hidden[n.id];
    if (b && v.boxes[b]) { var bx = v.boxes[b], k = 0; bx.outs.forEach(function (q, j) { if (q.node === n.id) k = j; }); return { x: bx.x + bx.w, y: bx.y + 26 + 18 * k + 9 }; }
    var p = v.pos[n.id] || n; return { x: p.x + WN, y: p.y + 26 + 9 };
  }
  function visible() {
    var g = gr(), l = editLayer();
    if (ed.only && l) {   /* the chain of this layer, and loose nodes that feed no output yet (so a new node never disappears) */
      var up = G().upstream(g, l.pattern.out), fed = {};
      g.nodes.forEach(function (n) { if (n.type === "output") G().upstream(g, n.id).forEach(function (i) { fed[i] = 1; }); });
      return g.nodes.filter(function (n) { return up.indexOf(n.id) >= 0 || !fed[n.id]; });
    }
    return g.nodes;
  }
  function fit() {
    var ns = visible(), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, v = vmBuild();
    ns.forEach(function (n) { var q = v.pos[n.id]; if (!q) return; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + WN); y1 = Math.max(y1, q.y + nodeH(n)); });
    Object.keys(v.boxes).forEach(function (k) { var b = v.boxes[k]; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
    v.frames.forEach(function (f) { x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y); x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h); });
    if (x0 > x1) return { x: 0, y: 0, w: 800, h: 300 };
    return { x: x0 - 30, y: y0 - 30, w: Math.max(400, x1 - x0 + 60), h: Math.max(160, y1 - y0 + 60) };
  }
  function setSel(ids) { ed.set = {}; ids.forEach(function (i) { ed.set[i] = 1; }); ed.sel = ids.length ? ids[ids.length - 1] : ""; }
  function syncSel() { if (ed.sel && !ed.set[ed.sel]) ed.set = (function (o) { o[ed.sel] = 1; return o; })({}); if (!ed.sel) ed.set = {}; Object.keys(ed.set).forEach(function (i) { if (!itemOf(i)) delete ed.set[i]; }); if (ed.sel && !ed.set[ed.sel]) ed.sel = Object.keys(ed.set)[0] || ""; }
  function nodeSvg(n) {
    var ty = G().TYPES[n.type], h = nodeH(n), sel = !!ed.set[n.id], col = COL[ty.out || "any"], vp = vm().pos[n.id] || n, ttl = labelOf(n);
    if (ttl.length > 21) ttl = ttl.slice(0, 20) + "…";
    var s = '<g class="gxnode' + (sel ? " sel" : "") + (n.bake ? " baked" : "") + (n.off ? " off" : "") + '" data-nid="' + n.id + '" transform="translate(' + vp.x + " " + vp.y + ')"><title>' + esc(labelOf(n) + (n.name ? " (" + ty.label + ")" : "")) + ". Double-click the header to rename it.</title>" +
      '<rect class="gxbox" width="' + WN + '" height="' + h + '" rx="5"></rect><rect class="gxhead" width="' + WN + '" height="22" rx="5" style="fill:' + col + '"></rect>' +
      '<text class="gxtitle" x="8" y="15">' + esc(ttl) + (n.exp.length ? " ●" : "") + (n.bake ? (G().isStale(gr(), n.id, makeEnv({})) ? " 🔒 !" : " 🔒") : "") + "</text>";
    if (n.off) s += '<rect class="gxstripes" x="0" y="0" width="' + WN + '" height="22" rx="5" fill="url(#gxoff)" pointer-events="none"></rect>';
    if (n.type === "output") { var l = patterns().filter(function (q) { return q.pattern.out === n.id; })[0]; s += '<text class="gxsub" x="8" y="' + (h - 6) + '">' + esc(l ? l.text : "(no layer)") + "</text>"; }
    ty.ins.forEach(function (q, i) {
      s += '<circle class="gxport in" data-pin="' + n.id + '" data-port="' + q.port + '" cx="0" cy="' + (35 + 18 * i) + '" r="6" style="fill:' + COL[q.kind] + '"><title>' + esc(q.port + " (" + q.kind + (q.multi ? ", many" : "") + (q.optional ? ", optional" : "") + ")") + '</title></circle><text class="gxport-l" x="10" y="' + (39 + 18 * i) + '">' + esc(q.port === "in" ? "" : q.port) + "</text>";
    });
    if (ty.out) s += '<circle class="gxport out" data-pout="' + n.id + '" cx="' + WN + '" cy="35" r="6" style="fill:' + COL[ty.out] + '"><title>Drag from here to an input to make a wire (' + ty.out + ")</title></circle>";
    return s + "</g>";
  }
  function boxSvg(bx) {
    var q = bx.g, sel = !!ed.set[q.id], nm = q.name || "Group", nt = nm.length > 24 ? nm.slice(0, 23) + "…" : nm;
    var s = '<g class="gxnode gxblack' + (sel ? " sel" : "") + (q.off ? " off" : "") + '" data-nid="' + q.id + '" data-box="1" transform="translate(' + bx.x + " " + bx.y + ')"><title>' + esc(nm) + ": a group, shown as a black box. Double-click to open it.</title>" +
      '<rect class="gxbox" width="' + bx.w + '" height="' + bx.h + '" rx="5"></rect><rect class="gxhead" width="' + bx.w + '" height="22" rx="5" style="fill:#7d8590"></rect><text class="gxtitle" x="8" y="15">▣ ' + esc(nt) + "</text>";
    if (q.off) s += '<rect class="gxstripes" x="0" y="0" width="' + bx.w + '" height="22" rx="5" fill="url(#gxoff)" pointer-events="none"></rect>';
    bx.ins.forEach(function (k, i) { s += '<circle class="gxport in" data-pin="' + k.node + '" data-port="' + k.port + '" cx="0" cy="' + (35 + 18 * i) + '" r="6" style="fill:' + COL[k.kind] + '"><title>' + esc(k.label) + '</title></circle><text class="gxport-l" x="10" y="' + (39 + 18 * i) + '">' + esc(k.label.length > 26 ? k.label.slice(0, 25) + "…" : k.label) + "</text>"; });
    bx.outs.forEach(function (k, i) { s += '<circle class="gxport out" data-pout="' + k.node + '" cx="' + bx.w + '" cy="' + (35 + 18 * i) + '" r="6" style="fill:' + COL[k.kind] + '"><title>' + esc(k.label) + '</title></circle><text class="gxport-l" text-anchor="end" x="' + (bx.w - 10) + '" y="' + (39 + 18 * i) + '">' + esc(k.label.length > 26 ? k.label.slice(0, 25) + "…" : k.label) + "</text>"; });
    return s + "</g>";
  }
  function frameSvg(f) {
    var q = f.g, sel = !!ed.set[q.id], nm = q.name || "Group", nt = nm.length > 40 ? nm.slice(0, 39) + "…" : nm;
    return '<g class="gxframe' + (sel ? " sel" : "") + (q.off ? " off" : "") + '" data-nid="' + q.id + '" data-frame="1"><rect class="gxfbody" x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '" rx="8" pointer-events="none"></rect>' +
      '<rect class="gxfhead" x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="22" rx="8"><title>' + esc(nm) + ": an open group. Drag the header to move it all, double-click to close it.</title></rect>" +
      (q.off ? '<rect class="gxstripes" x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="22" rx="8" fill="url(#gxoff)" pointer-events="none"></rect>' : "") +
      '<text class="gxftitle" x="' + (f.x + 10) + '" y="' + (f.y + 15) + '" pointer-events="none">▾ ' + esc(nt) + "</text></g>";
  }
  function wirePath(a, b) { var dx = Math.max(40, Math.abs(b.x - a.x) / 2); return "M" + a.x + " " + a.y + " C" + (a.x + dx) + " " + a.y + " " + (b.x - dx) + " " + b.y + " " + b.x + " " + b.y; }
  function canvasHtml() {
    syncSel();
    ed.vm = null; var g = gr(), ns = visible(), ids = {}, vb = ed.vb || fit(), v = vm();
    ns.forEach(function (n) { ids[n.id] = n; });
    var s = '<svg id="gxsvg" tabindex="0" viewBox="' + vb.x + " " + vb.y + " " + vb.w + " " + vb.h + '" preserveAspectRatio="xMidYMid meet" aria-label="Graph editor" title="Drag a node by its header, drag from a round output to an input to wire, double-click a wire to remove it, Delete removes the selected node, wheel zooms, drag the background to pan.">';
    s += '<defs><pattern id="gxoff" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.5" height="14" fill="#fff"></rect></pattern><pattern id="gxgrid" width="' + GRID + '" height="' + GRID + '" patternUnits="userSpaceOnUse"><path d="M' + GRID + ' 0H0V' + GRID + '" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="1"></path></pattern></defs><rect x="' + (vb.x - 4000) + '" y="' + (vb.y - 4000) + '" width="' + (vb.w + 8000) + '" height="' + (vb.h + 8000) + '" fill="url(#gxgrid)" pointer-events="none"></rect>';
    v.frames.forEach(function (f) { s += frameSvg(f); });
    g.wires.forEach(function (w) {
      var a = ids[w.from], b = ids[w.to]; if (!a || !b) return;
      if (v.hidden[w.from] && v.hidden[w.from] === v.hidden[w.to]) return;   /* inside a black box */
      var ty = G().TYPES[b.type], i = 0; ty.ins.forEach(function (q, k) { if (q.port === w.port) i = k; });
      var wd = wirePath(outPos(a), inPos(b, i)), wk = w.from + "|" + w.to + "|" + w.port;
      s += '<path class="gxwire" d="' + wd + '" style="stroke:' + COL[G().TYPES[a.type].out] + '"></path><path class="gxwirehit" data-wire="' + wk + '" d="' + wd + '"><title>Drag an end to move or detach this wire, double-click to remove it, right-click for a menu.</title></path>';
    });
    ns.forEach(function (n) { if (!v.hidden[n.id]) s += nodeSvg(n); });
    Object.keys(v.boxes).forEach(function (k) { s += boxSvg(v.boxes[k]); });
    return s + '<path id="gxrubber" class="gxrubber" d=""></path></svg>';
  }
  function shortName(label) { return label.replace(/ \(.*\)$/, ""); }
  function paletteHtml() {
    var cats = {}; G().catalog().forEach(function (k) { (cats[k[2]] = cats[k[2]] || []).push(k); });
    return '<div class="gxpal" aria-label="Node palette">' + Object.keys(cats).map(function (c) {
      return '<div class="gxpalh">' + c + "</div>" + cats[c].map(function (k) {
        var ty = G().TYPES[k[0]], out = ty.out || "any";
        return '<button class="gxpb ' + out + '" type="button" data-pa="gnew" data-type="' + k[0] + '" title="Add a ' + esc(shortName(k[1])) + ' node (' + (ty.out ? "gives a " + ty.out : "") + '). Click to add it next to the selected node and wire it when the types fit, or drag it onto the canvas.">' + esc(shortName(k[1])) + "</button>";
      }).join("");
    }).join("") + "</div>";
  }
  function barHtml() {
    return '<div class="gxbar">' +
      '<button class="btn" type="button" data-pa="gedge" title="Adds an input node that follows the OUTER EDGE of the objects selected on the stage (a path), wired to the selected node when it fits.">+ Edge of selection</button><button class="btn" type="button" data-pa="gshape" title="Adds an input node that takes the real SHAPE (geometry) of the objects selected on the stage, wired to the selected node when it fits.">+ Shape of selection</button><button class="btn" type="button" data-pa="goutput" title="Adds a new Output node and a new pattern layer; the selected node is wired to it. Use this to share one chain between several layers.">+ Output layer</button>' +
      '<label class="chk" title="Show only the nodes that feed the selected pattern."><input type="checkbox" id="gxOnly"' + (ed.only ? " checked" : "") + ' title="Show only the nodes that feed the selected pattern."><span>Only this layer</span></label>' +
      '<button class="btn" type="button" data-pa="gbakeall" title="Bakes the node that feeds each Output (the whole graph): its result is kept and nothing upstream computes any more. Uses the precision of each node.">Bake graph</button><button class="btn" type="button" data-pa="gunbakeall" title="Makes every baked node live again.">Unbake all</button>' +
      '<label class="chk" title="On: the pattern is recomputed whenever something changes. Off: only when you press Compute, so a heavy graph stays quiet."><input type="checkbox" id="gxAuto"' + (gr().manual ? "" : " checked") + ' title="On: the pattern is recomputed whenever something changes. Off: only when you press Compute."><span>Auto compute</span></label><button class="btn" type="button" data-pa="gcompute" title="Recomputes the patterns now (for manual compute).">Compute</button>' +
      '<button class="btn" type="button" data-pa="gtidy" title="Packs the visible nodes close together in columns, sources on the left and outputs on the right.">Tidy</button><button class="btn" type="button" data-pa="gfit" title="Fits the whole graph in the window (Home).">Fit</button>' +
      '<span class="gxkeys small" title="Mouse and keys of the editor.">Left drag: select · Right drag: pan · Wheel: zoom · Shift+A or double-click: search a node · Del: delete · Ctrl+A: all · Ctrl+D: copy · Home: fit</span></div>';
  }
  function ringArea(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var q = pts[(i + 1) % pts.length]; a += pts[i][0] * q[1] - q[0] * pts[i][1]; } return a / 2; }
  function previewSvg(n) {
    var r;
    if (gr().manual && !U.forced && !n.bake) { r = G().peek(gr(), n.id, makeEnv({})); if (!r) return '<div class="gxprevbox"><p class="small warn">Manual compute is on: press Compute to see this node.</p></div>'; }
    else r = G().evaluate(gr(), n.id, makeEnv({}), G().newMemo());
    if (!r.kind) return '<div class="gxprevbox"><p class="small warn">' + esc(r.err || "No result.") + "</p></div>";
    var pts = [], d = "", info = [], rings = [];
    if (r.kind === "path") {
      var len = 0, closed = 0;
      r.loops.forEach(function (l) { l.pts.forEach(function (q, i) { pts.push(q); d += (i ? "L" : "M") + r1(q[0]) + " " + r1(q[1]); if (i) len += Math.hypot(q[0] - l.pts[i - 1][0], q[1] - l.pts[i - 1][1]); }); if (l.closed) { d += "Z"; closed++; len += Math.hypot(l.pts[0][0] - l.pts[l.pts.length - 1][0], l.pts[0][1] - l.pts[l.pts.length - 1][1]); } });
      info = [["Data", "path"], ["Loops", r.loops.length + " (" + closed + " closed, " + (r.loops.length - closed) + " open)"], ["Length", r1(len) + " mm"]];
    } else {
      var area = 0, holes = 0;
      r.paths.forEach(function (p) { var rp = p.map(function (q) { return [q.X / 1000, q.Y / 1000]; }); rp.forEach(function (q, i) { pts.push(q); d += (i ? "L" : "M") + r1(q[0]) + " " + r1(q[1]); }); d += "Z"; var a = ringArea(rp); area += a; if (a < 0) holes++; });
      info = [["Data", "shape"], ["Outlines", r.paths.length + " (" + holes + " holes)"], ["Area", r1(Math.abs(area)) + " mm²"]];
    }
    if (!pts.length) return "";
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    info.push(["Points", pts.length], ["Time", r.ms == null ? "-" : (r.ms < 10 ? r.ms.toFixed(1) : Math.round(r.ms)) + " ms (this node, when last computed)"], ["Size", r1(x1 - x0) + " × " + r1(y1 - y0) + " mm"], ["Centre", r1((x0 + x1) / 2) + ", " + r1((y0 + y1) / 2) + " mm"]);
    var m = Math.max(x1 - x0, y1 - y0) * 0.05 + 1;
    return '<div class="gxprevbox"><svg class="gxprev" viewBox="' + (x0 - m) + " " + (y0 - m) + " " + (x1 - x0 + 2 * m) + " " + (y1 - y0 + 2 * m) + '" preserveAspectRatio="xMidYMid meet" aria-label="Result of the selected node"><path d="' + d + '" fill="' + (r.kind === "shape" ? COL.shape : "none") + '" fill-rule="evenodd" stroke="' + (r.kind === "shape" ? "#5a4513" : COL.path) + '" vector-effect="non-scaling-stroke" stroke-width="1.5"></path></svg>' +
      '<dl class="gxdata">' + info.map(function (k) { return "<dt>" + k[0] + "</dt><dd>" + esc(String(k[1])) + "</dd>"; }).join("") + "</dl>" + (r.err ? '<p class="small warn">' + esc(r.err) + "</p>" : "") + "</div>";
  }
  function prevHtml() {   /* the content of the fixed preview column */
    var n = G().node(gr(), ed.sel), el = editLayer();
    if (!n) { var on = el && G().node(gr(), el.pattern.out); return '<h4 class="small gxh">Preview: ' + (on ? "result of the layer “" + esc(el.text) + "”" : "nothing") + "</h4>" + (on ? previewSvg(on) : ""); }
    return '<h4 class="small gxh">Preview: what this node gives</h4>' + previewSvg(n);
  }
  function paintPreview() { var box = document.querySelector("#gxside .gxpcol"); if (box) box.innerHTML = prevHtml(); }
  function nameField(id, name, ph) {
    return '<label class="fld" title="Your own name for this item. It shows in the header instead of the type, and works as documentation. Empty gives the default name back."><span>Name</span><input type="text" maxlength="60" data-pa="gname" data-nid="' + id + '" value="' + esc(name || "") + '" placeholder="' + esc(ph) + '"></label>';
  }
  function stateField(id, off) {
    return '<label class="fld" title="Enabled: it works. Off, pass through: what comes in goes out unchanged (a path into a shape node becomes a hairline of its form). Off, gives nothing: it outputs an empty value. Off, cut loose: it is as if it were not wired in."><span>State</span><select data-pa="goffsel" data-nid="' + id + '"><option value=""' + (off ? "" : " selected") + '>Enabled</option><option value="bypass"' + (off === "bypass" ? " selected" : "") + '>Off: pass through</option><option value="empty"' + (off === "empty" ? " selected" : "") + '>Off: gives nothing</option><option value="cut"' + (off === "cut" ? " selected" : "") + '>Off: cut loose</option></select></label>';
  }
  function groupSideHtml(q) {
    var g = gr(), mem = G().members(g, q.id), h = "";
    mem.forEach(function (id) {
      var n = G().node(g, id); if (!n || !n.exp.length) return;
      var rows = ""; G().TYPES[n.type].params.forEach(function (sp) { if (n.exp.some(function (e) { return e.key === sp.key; }) && (!sp.when || sp.when(n.p))) rows += fieldHtml(n, sp); });
      if (rows) h += '<h4 class="small gxh">' + esc(labelOf(n)) + "</h4>" + rows;
    });
    var sub = G().groups ? 0 : 0, ng = mem.length;
    return '<div class="gxpcol"><h4 class="small gxh">Group</h4><p class="small">' + ng + " node" + (ng === 1 ? "" : "s") + " inside" + (q.off ? ", switched off" : "") + '.</p></div><div class="gxfcol" data-nid="' + q.id + '">' +
      '<div class="btnrow"><strong>▣ ' + esc(q.name || "Group") + '</strong><button class="tbtn" type="button" data-pa="gtogopen" data-nid="' + q.id + '" title="' + (q.open ? "Close the group into a black box." : "Open the group: its nodes show inside a frame.") + '">' + (q.open ? "Close" : "Open") + '</button><button class="tbtn" type="button" data-pa="gungroup" data-nid="' + q.id + '" title="Dissolves the group: its nodes and groups go one level up.">Ungroup</button></div>' +
      '<p class="small">A group is a way to order the nodes; it does not change the result. Closed it is a black box with the wires that cross its border. The values you pin with ○ in the nodes inside show here.</p>' +
      nameField(q.id, q.name, "Group") + stateField(q.id, q.off) + (h || '<p class="small">No values are pinned in this group. Open it and press ○ next to a value to pin it here.</p>') + "</div>";
  }
  function sideHtml() {
    var gq = G().group(gr(), ed.sel); if (gq) return groupSideHtml(gq);
    var n = G().node(gr(), ed.sel), el = editLayer();
    if (!n) {
      return '<div class="gxpcol">' + prevHtml() + '</div><div class="gxfcol"><p class="small">Select a node to edit its values and to see what it gives. Press ○ next to a value to pin it to the panel of the layer.</p>' + slowHtml() + "</div>";
    }
    var ty = G().TYPES[n.type], g0 = gr();
    var need = ty.ins.filter(function (q) { return !q.optional && !g0.wires.some(function (w) { return w.to === n.id && w.port === q.port; }); }).map(function (q) { return q.kind === "any" ? "a path or a shape" : "a " + q.kind; });
    return '<div class="gxpcol">' + prevHtml() + '</div><div class="gxfcol" data-nid="' + n.id + '">' +
      (need.length ? '<p class="small warn">Nothing is wired into this node yet: it needs ' + need.join(" and ") + ". Add a node while this one is selected, or drag a wire to its round input.</p>" : "") + '<div class="btnrow"><strong>' + esc(n.name ? n.name + " (" + shortName(ty.label) + ")" : ty.label) + '</strong><button class="tbtn" type="button" data-pa="gdelnode" data-nid="' + n.id + '" title="' + (n.type === "output" ? "An Output node goes away with its layer: delete the layer instead." : "Delete this node and its wires.") + '"' + (n.type === "output" ? " disabled" : "") + ">✕</button></div>" +
      (ty.tip ? '<p class="small">' + esc(ty.tip) + "</p>" : "") + nameField(n.id, n.name, shortName(ty.label)) + (n.type === "output" ? "" : stateField(n.id, n.off)) + nodeFields(n) + bakeHtml(n) + "</div>";
  }
  function paintInfo() {
    var box = document.getElementById("nodeInfo"); if (!box) return;
    var n = G().node(gr(), ed.sel), ty = n && G().TYPES[n.type];
    box.textContent = ty ? ty.label + ": " + (ty.tip || "") : "";
  }
  function paintCanvas() { var box = document.getElementById("gxcanvas"); if (box) { box.innerHTML = canvasHtml(); } }
  /* a rebuild of the editor must not throw the user back to the top of the fields: the scroll position of the same node is kept */
  function keepScroll(fn) {
    var f = document.querySelector("#gxside .gxfcol"), c = document.getElementById("gxcanvas"), old = f ? { id: f.dataset.nid || "", top: f.scrollTop } : null, ct = c ? [c.scrollLeft, c.scrollTop] : null;
    fn();
    var f2 = document.querySelector("#gxside .gxfcol"), c2 = document.getElementById("gxcanvas");
    if (old && f2 && (f2.dataset.nid || "") === old.id) f2.scrollTop = old.top;
    if (ct && c2) { c2.scrollLeft = ct[0]; c2.scrollTop = ct[1]; }
  }
  function paintSide() { var box = document.getElementById("gxside"); if (box) keepScroll(function () { box.innerHTML = sideHtml(); }); paintInfo(); }
  U.paint = function () {
    if (!PTD.core) return;
    var body = PTD.layout && PTD.layout.dock.body(); if (!body) return;
    var l = editLayer();
    if (l && l.id !== ed.lastLayer) { ed.lastLayer = l.id; ed.vb = null; var n = G().node(gr(), ed.sel); if (!n || G().upstream(gr(), l.pattern.out).indexOf(ed.sel) < 0) ed.sel = ""; }
    if (!l) ed.lastLayer = "";
    var keep = document.activeElement && body.contains(document.activeElement) && document.activeElement.matches("input,select") ? null : 0;
    if (keep === null) return;   /* the user is typing in the editor: do not rebuild under the cursor */
    keepScroll(function () { body.innerHTML = '<div class="gx"><div class="gxmain">' + barHtml() + '<div class="gxrow">' + paletteHtml() + '<div id="gxcanvas" class="gxcanvas">' + canvasHtml() + '</div></div></div><div id="gxside" class="gxside">' + sideHtml() + "</div></div>"; });
    paintInfo();
  };

  /* ---------- editor actions ---------- */
  function svgPoint(svg, e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
  function curVb(svg) { var b = svg.viewBox.baseVal; return { x: b.x, y: b.y, w: b.width, h: b.height }; }
  function inIndex(n, port) { var i = 0; G().TYPES[n.type].ins.forEach(function (q, k) { if (q.port === port) i = k; }); return i; }
  /* A wire being dragged. dir "out": the fixed end is an output (node id), the loose end looks for an input. dir "in": the fixed end is an input (node id, port), the loose end looks for an output. */
  function dragWire(svg, e, dir, id, port) {
    var g = gr(), rub = svg.querySelector("#gxrubber"), n = G().node(g, id), anchor = dir === "out" ? outPos(n) : inPos(n, inIndex(n, port));
    var move = function (ev) { var q = svgPoint(svg, ev); rub.setAttribute("d", dir === "out" ? wirePath(anchor, q) : wirePath(q, anchor)); };
    var up = function (ev) {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); rub.setAttribute("d", "");
      var t = document.elementFromPoint(ev.clientX, ev.clientY), why = "", done = false;
      var pin = t && t.closest && t.closest("[data-pin]"), po = t && t.closest && t.closest("[data-pout]"), nd = t && t.closest && t.closest("[data-nid]");
      if (dir === "out") {
        if (pin) { why = connectGuarded(id, pin.dataset.pin, pin.dataset.port); done = true; }
        else if (nd && nd.dataset.nid !== id) {
          var to = G().node(g, nd.dataset.nid);
          G().TYPES[to.type].ins.forEach(function (q) { if (!done && G().canConnect(g, id, to.id, q.port) === "") { why = connectGuarded(id, to.id, q.port); done = true; } });
          if (!done) { why = G().canConnect(g, id, to.id, G().TYPES[to.type].ins[0] ? G().TYPES[to.type].ins[0].port : "in") || "That node has no free input."; done = true; }
        }
      } else {
        if (po) { why = connectGuarded(po.dataset.pout, id, port); done = true; }
        else if (nd && nd.dataset.nid !== id && G().TYPES[G().node(g, nd.dataset.nid).type].out) { why = connectGuarded(nd.dataset.nid, id, port); done = true; }
      }
      if (why) say(why);
      if (!done || why) { commit("gunwire", true); paintSide(); }   /* a detached wire stays gone; the canvas shows it */
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); e.preventDefault();
  }
  function detach(from, to, port) { var g = gr(); g.wires = g.wires.filter(function (x) { return !(x.from === from && x.to === to && x.port === port); }); }
  function pointerdown(e) {
    ed.focus = !!(e.target.closest && e.target.closest("#graphDock"));
    if (ed.focus) ed.interacted = true;
    if (e.target.closest && e.target.closest("#dockClose")) ed.interacted = false;
    closeMenu(e);
    var pal = e.target.closest && e.target.closest('[data-pa="gnew"]');
    if (pal && e.button === 0) { dragPalette(pal, e); return; }
    var svg = e.target.closest && e.target.closest("#gxsvg"); if (!svg) return;
    if (e.button === 1 || e.button === 2) { ed.panMoved = false; ed.rightDown = e.button === 2; ed.vb = curVb(svg); startPan(svg, e); return; }   /* the right (or middle) button pans */
    if (e.button !== 0) return;
    var g = gr(), pt = svgPoint(svg, e), out = e.target.closest("[data-pout]"), pin = e.target.closest("[data-pin]"), wire = e.target.closest("[data-wire]"), nodeEl = e.target.closest("[data-nid]");
    svg.focus({ preventScroll: true });
    ed.vb = curVb(svg);   /* the view must not change while something is dragged */
    if (out) { dragWire(svg, e, "out", out.dataset.pout); return; }
    if (pin) {
      var nid = pin.dataset.pin, port = pin.dataset.port, ws = g.wires.filter(function (w) { return w.to === nid && w.port === port; });
      if (ws.length) {   /* take the wire off this input and carry its output end somewhere else */
        var w0 = ws[ws.length - 1]; detach(w0.from, w0.to, w0.port); paintCanvas(); svg = document.getElementById("gxsvg"); dragWire(svg, e, "out", w0.from);
      } else dragWire(svg, e, "in", nid, port);
      return;
    }
    if (wire) {
      var a = wire.dataset.wire.split("|"), na = G().node(g, a[0]), nb = G().node(g, a[1]), po = outPos(na), pi = inPos(nb, inIndex(nb, a[2]));
      var dO = Math.hypot(pt.x - po.x, pt.y - po.y), dI = Math.hypot(pt.x - pi.x, pt.y - pi.y);
      detach(a[0], a[1], a[2]); paintCanvas(); svg = document.getElementById("gxsvg");
      if (dO < dI) dragWire(svg, e, "in", a[1], a[2]); else dragWire(svg, e, "out", a[0]);
      return;
    }
    if (nodeEl) {
      var n = itemOf(nodeEl.dataset.nid); if (!n) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey) { var ids = Object.keys(ed.set); var k = ids.indexOf(n.id); if (k >= 0) ids.splice(k, 1); else ids.push(n.id); setSel(ids); paintCanvas(); paintSide(); return; }
      if (!ed.set[n.id]) setSel([n.id]);
      paintCanvas(); paintSide(); svg = document.getElementById("gxsvg");
      var V0 = vm(), moving = groupMovers(Object.keys(ed.set)).map(function (m) { var dp = V0.pos[m.id] || (V0.boxes[m.id] ? V0.boxes[m.id] : null); return { n: m, x: m.x, y: m.y, ox: dp ? dp.x - m.x : 0, oy: dp ? dp.y - m.y : 0 }; }), moved = false;
      var withGroup = Object.keys(ed.set).some(function (i) { return G().isGroupId(g, i); });
      var mv = function (ev) {
        var q = svgPoint(svg, ev), ddx = Math.round((q.x - pt.x) / GRID) * GRID, ddy = Math.round((q.y - pt.y) / GRID) * GRID;
        moving.forEach(function (m) { m.n.x = m.x + ddx; m.n.y = m.y + ddy; moved = true; });
        if (withGroup) { if (moved) { paintCanvas(); svg = document.getElementById("gxsvg"); } return; }   /* a group moves its frame and its pushes along: draw again */
        moving.forEach(function (m) { var el = svg.querySelector('[data-nid="' + m.n.id + '"]'); if (el) el.setAttribute("transform", "translate(" + (m.n.x + m.ox) + " " + (m.n.y + m.oy) + ")"); });
      };
      var fin = function () {
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", fin);
        if (moved) commit("gmove", true);   /* the wires are drawn again from the new places */
      };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", fin); e.preventDefault(); return;
    }
    /* the background with the left button: a rubber band. Plain: replaces the selection; Shift adds; Ctrl removes; a click without a drag clears it. */
    var base = e.shiftKey || e.ctrlKey || e.metaKey ? Object.keys(ed.set) : [], mode = e.ctrlKey || e.metaKey ? "sub" : "add";
    var box = document.createElementNS("http://www.w3.org/2000/svg", "rect"); box.setAttribute("class", "gxmarq"); svg.appendChild(box);
    var sx0 = e.clientX, sy0 = e.clientY, dragged = false;
    var mm = function (ev) {
      var q = svgPoint(svg, ev); if (Math.hypot(ev.clientX - sx0, ev.clientY - sy0) > 3) dragged = true;
      box.setAttribute("x", Math.min(pt.x, q.x)); box.setAttribute("y", Math.min(pt.y, q.y)); box.setAttribute("width", Math.abs(q.x - pt.x)); box.setAttribute("height", Math.abs(q.y - pt.y));
    };
    var mu = function (ev) {
      window.removeEventListener("pointermove", mm); window.removeEventListener("pointerup", mu);
      var q = svgPoint(svg, ev), x0 = Math.min(pt.x, q.x), x1 = Math.max(pt.x, q.x), y0 = Math.min(pt.y, q.y), y1 = Math.max(pt.y, q.y), ids = base.slice();
      if (dragged) {
        var V1 = vm(), pick = function (id, rx, ry, rw, rh) {
          if (!(rx < x1 && rx + rw > x0 && ry < y1 && ry + rh > y0)) return;
          var k = ids.indexOf(id); if (mode === "sub") { if (k >= 0) ids.splice(k, 1); } else if (k < 0) ids.push(id);
        };
        visible().forEach(function (m) { var q2 = V1.pos[m.id]; if (q2) pick(m.id, q2.x, q2.y, WN, nodeH(m)); });
        Object.keys(V1.boxes).forEach(function (bk) { var b2 = V1.boxes[bk]; pick(bk, b2.x, b2.y, b2.w, b2.h); });
      }
      setSel(ids); paintCanvas(); paintSide();
    };
    window.addEventListener("pointermove", mm); window.addEventListener("pointerup", mu); e.preventDefault();
  }
  function startPan(svg, e) {
    var vb = curVb(svg), sx = e.clientX, sy = e.clientY, sc = 1 / (svg.getScreenCTM() ? svg.getScreenCTM().a : 1);   /* user units per pixel, whatever the aspect ratio */
    var pm = function (ev) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) ed.panMoved = true; svg.setAttribute("viewBox", (vb.x - (ev.clientX - sx) * sc) + " " + (vb.y - (ev.clientY - sy) * sc) + " " + vb.w + " " + vb.h); };
    var pu = function () { window.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu); ed.vb = curVb(svg); var was = ed.rightDown; ed.rightDown = false; if (was && ed.ctx) showContext(); };
    window.addEventListener("pointermove", pm); window.addEventListener("pointerup", pu); e.preventDefault();
  }
  /* a palette button can be dragged onto the canvas; a plain click is handled as a click */
  function dragPalette(btn, e) {
    var sx = e.clientX, sy = e.clientY, moved = false;
    var mv = function (ev) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true; };
    var up = function (ev) {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      if (!moved) return;
      var t = document.elementFromPoint(ev.clientX, ev.clientY), svg = t && t.closest && t.closest("#gxsvg");
      if (svg) { addNode(btn.dataset.type, svgPoint(svg, ev)); ed.dropped = true; setTimeout(function () { ed.dropped = false; }, 50); }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }
  /* ---------- the right-click menu of the editor ---------- */
  var menuEl = null;
  function closeMenu(e) { if (menuEl && !(e && e.target.closest && e.target.closest("#gxMenu"))) { menuEl.remove(); menuEl = null; } }
  function openMenu(e, items) {
    closeMenu(); menuEl = document.createElement("div"); menuEl.id = "gxMenu"; menuEl.className = "gxmenu"; menuEl.setAttribute("role", "menu");
    menuEl.innerHTML = items.map(function (it) {
      return it === "-" ? '<hr>' : '<button type="button" role="menuitem" data-gm="' + esc(it.a) + '"' + (it.off ? " disabled" : "") + ' title="' + esc(it.tip || it.t) + '">' + esc(it.t) + "</button>";
    }).join("");
    document.body.appendChild(menuEl);
    var r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.min(e.clientX, window.innerWidth - r.width - 4) + "px"; menuEl.style.top = Math.max(4, Math.min(e.clientY, window.innerHeight - r.height - 4)) + "px";
  }
  function contextmenu(e) {
    var svg = e.target.closest && e.target.closest("#gxsvg"); if (!svg) return;
    e.preventDefault(); e.stopPropagation();
    /* Some systems send this on the press, others on the release. The right button also pans, so the menu opens only when the pointer is up and did not move. */
    ed.ctx = { target: e.target, clientX: e.clientX, clientY: e.clientY };
    if (!ed.rightDown) showContext();
  }
  function showContext() {
    var c = ed.ctx; ed.ctx = null; if (!c || ed.panMoved) { ed.panMoved = false; return; }
    var e = c, svg = c.target.closest("#gxsvg"); if (!svg) return;
    var g = gr(), pt = svgPoint(svg, e), nodeEl = e.target.closest("[data-nid]"), wire = e.target.closest("[data-wire]"), items = [];
    if (nodeEl) {
      var n = itemOf(nodeEl.dataset.nid); if (!n) return; if (!ed.set[n.id]) { setSel([n.id]); paintCanvas(); paintSide(); }
      var outs = !!(ed.sel && G().node(g, ed.sel) && G().node(g, ed.sel).type === "output"), sids = selIds(), hasG = sids.some(function (i) { return G().isGroupId(g, i); }), inG = sids.some(function (i) { return !!G().parentOf(g, i); }), oneG = sids.filter(function (i) { return G().isGroupId(g, i); });
      items = [{ t: "Delete", a: "del", off: false, tip: "Deletes the selected nodes and their wires (an Output node goes away with its layer)." },
        { t: "Disconnect inputs", a: "cutin", tip: "Removes every wire that comes into the selected nodes." }, { t: "Disconnect outputs", a: "cutout", tip: "Removes every wire that leaves the selected nodes." },
        { t: "Enable", a: "off:", off: outs, tip: "Switches the selected nodes on." },
        { t: "Disable: pass through", a: "off:bypass", off: outs, tip: "What comes in goes out unchanged (a path into a shape node becomes a hairline of its form)." },
        { t: "Disable: gives nothing", a: "off:empty", off: outs, tip: "The node outputs an empty value." },
        { t: "Disable: cut loose", a: "off:cut", off: outs, tip: "The node is as if it were not wired in: its users skip it." },
        { t: "Duplicate", a: "dup", off: outs || hasG, tip: "Copies the selected nodes (without wires)." }, "-",
        { t: "Group selected", a: "mkgroup", tip: "Makes a group of the selected items (Ctrl+G). A group is shown as a black box with the wires that cross its border." },
        { t: hasG ? (G().group(g, oneG[0]).open ? "Close group" : "Open group") : "Open group", a: "togopen", off: !hasG, tip: "Opens a group (its nodes show inside a frame and push the others aside) or closes it into a black box." },
        { t: "Ungroup", a: "ungroup", off: !hasG, tip: "Dissolves the selected groups: their items go one level up." },
        { t: "Remove from group", a: "rmgroup", off: !inG, tip: "Takes the selected items out of their group (open the group first to see them)." },
        { t: "Add the others to this group", a: "addgroup", off: !(oneG.length === 1 && sids.length > 1), tip: "Select one group and other items, then this puts the others into the group." }];
    } else if (wire) { items = [{ t: "Remove wire", a: "wire:" + wire.dataset.wire, tip: "Removes this wire." }]; }
    else {
      items = [{ t: "Tidy", a: "tidy", tip: "Packs the nodes close together." }, { t: "Fit view", a: "fit", tip: "Fits the whole graph in the window." }, "-"];
      G().catalog().forEach(function (k) { items.push({ t: "Add " + k[1] + " (" + k[2].toLowerCase() + ")", a: "add:" + k[0] + ":" + Math.round(pt.x / GRID) * GRID + ":" + Math.round(pt.y / GRID) * GRID, tip: "Adds a " + k[1] + " node here." }); });
    }
    openMenu(e, items);
  }
  function setOff(ids, mode) {
    var g = gr(), ns = ids.map(function (i) { return itemOf(i); }).filter(function (q) { return q && q.type !== "output"; });
    if (!ns.length) return;
    ns.forEach(function (q) { if (mode) q.off = mode; else delete q.off; });
    commit("goff");
  }
  function menuAct(a) {
    var g = gr(), ids = selIds();
    closeMenu();
    if (a === "del") deleteSelected();
    else if (a === "cutin" || a === "cutout") { g.wires = g.wires.filter(function (w) { return !(ids.indexOf(a === "cutin" ? w.to : w.from) >= 0); }); commit("gcut"); }
    else if (a.indexOf("off:") === 0) setOff(ids, a.slice(4));
    else if (a === "mkgroup") makeGroupOfSelection();
    else if (a === "togopen") { ids.forEach(function (i) { var q = G().group(g, i); if (q) q.open = !q.open; }); commit("gopen", true); paintSide(); }
    else if (a === "ungroup") { ids.forEach(function (i) { G().ungroup(g, i); }); setSel([]); commit("gungroup", true); paintSide(); }
    else if (a === "rmgroup") { G().removeFromGroup(g, ids); commit("grm", true); paintSide(); }
    else if (a === "addgroup") { var tg = ids.filter(function (i) { return G().isGroupId(g, i); })[0]; var why2 = G().addToGroup(g, tg, ids.filter(function (i) { return i !== tg; })); if (why2) say(why2); setSel([tg]); commit("gaddgrp", true); paintSide(); }
    else if (a === "dup") {
      var made = ids.map(function (i) { var o = G().node(g, i); if (o.type === "output") return null; var c = G().addNode(g, o.type, o.x + 40, o.y + 40, JSON.parse(JSON.stringify(o.p))); c.exp = JSON.parse(JSON.stringify(o.exp)); return c.id; }).filter(Boolean);
      setSel(made); commit("gdup");
    } else if (a === "tidy") tidy(); else if (a === "fit") { ed.vb = null; paintCanvas(); }
    else if (a.indexOf("wire:") === 0) { var k = a.slice(5).split("|"); detach(k[0], k[1], k[2]); commit("gunwire"); }
    else if (a.indexOf("add:") === 0) { var q = a.split(":"), nn = G().addNode(g, q[1], +q[2], +q[3], q[1] === "circle" || q[1] === "polygon" ? Object.assign(G().defaultParams(q[1]), { cx: viewCentre().x, cy: viewCentre().y }) : null); if (nn.type === "table" || nn.type === "tablearea") nn.p.table = (S().tables[0] && S().tables[0].id) || ""; setSel([nn.id]); commit("gadd"); }
  }
  /* the search box that adds a node (Shift+A or a double click on the background) */
  function openSearch(cx, cy, at) {
    closeMenu(); menuEl = document.createElement("div"); menuEl.id = "gxMenu"; menuEl.className = "gxmenu gxsearch";
    menuEl.innerHTML = '<input type="text" placeholder="Search a node…" aria-label="Search a node" title="Type to filter the node types; Enter adds the first one, Esc closes.">' + '<div class="gxlist"></div>';
    document.body.appendChild(menuEl);
    var inp = menuEl.querySelector("input"), list = menuEl.querySelector(".gxlist"), all = G().catalog();
    function fill() {
      var q = inp.value.trim().toLowerCase(), hits = all.filter(function (k) { return !q || (k[1] + " " + k[2]).toLowerCase().indexOf(q) >= 0; });
      list.innerHTML = hits.map(function (k) { return '<button type="button" role="menuitem" data-gm="add:' + k[0] + ':' + Math.round(at.x / GRID) * GRID + ":" + Math.round(at.y / GRID) * GRID + '" title="Add a ' + esc(shortName(k[1])) + ' node here.">' + esc(shortName(k[1])) + ' <em>' + k[2] + "</em></button>"; }).join("");
    }
    inp.addEventListener("input", fill);
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { var b = list.querySelector("button"); if (b) menuAct(b.dataset.gm); ev.preventDefault(); } if (ev.key === "Escape") { closeMenu(); ev.stopPropagation(); } });
    fill();
    var r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.min(cx, window.innerWidth - r.width - 4) + "px"; menuEl.style.top = Math.max(4, Math.min(cy, window.innerHeight - r.height - 4)) + "px";
    inp.focus();
  }
  function selIds() { syncSel(); return Object.keys(ed.set); }
  function connectGuarded(from, to, port) {
    var g = gr(), why = G().canConnect(g, from, to, port);
    if (why) return why;
    var ok = guarded(function () { G().connect(g, from, to, port); });
    if (ok) commit("gwire");
    return "";
  }
  function wheel(e) {
    var svg = e.target.closest && e.target.closest("#gxsvg"); if (!svg) return;
    e.preventDefault();
    var vb = curVb(svg), p = svgPoint(svg, e), k = e.deltaY < 0 ? 0.85 : 1 / 0.85;
    var nw = Math.max(120, Math.min(8000, vb.w * k)), kk = nw / vb.w;
    ed.vb = { x: p.x - (p.x - vb.x) * kk, y: p.y - (p.y - vb.y) * kk, w: nw, h: vb.h * kk };
    svg.setAttribute("viewBox", ed.vb.x + " " + ed.vb.y + " " + ed.vb.w + " " + ed.vb.h);
  }
  /* Packs the visible nodes: a column per depth (longest way from a source), rows stacked tightly, the first column at the left. */
  function tidy() {
    var g = gr(), ns = visible().filter(function (n) { return !G().parentOf(g, n.id); }), ids = {}, depth = {};
    if (!ns.length) return;
    ns.forEach(function (n) { ids[n.id] = n; });
    function d(id) {
      if (depth[id] != null) return depth[id]; depth[id] = 0;
      var m = 0; g.wires.forEach(function (w) { if (w.to === id && ids[w.from]) m = Math.max(m, d(w.from) + 1); });
      return (depth[id] = m);
    }
    ns.forEach(function (n) { d(n.id); });
    var x0 = Math.min.apply(0, ns.map(function (n) { return n.x; })), y0 = Math.min.apply(0, ns.map(function (n) { return n.y; })), cols = {};
    ns.forEach(function (n) { (cols[depth[n.id]] = cols[depth[n.id]] || []).push(n); });
    Object.keys(cols).forEach(function (c) {
      var y = y0; cols[c].sort(function (a, b) { return a.y - b.y; });
      cols[c].forEach(function (n) { n.x = x0 + c * (WN + 40); n.y = y; y += nodeH(n) + 20; });
    });
    ed.vb = null; commit("gtidy", true);
  }
  function toggleOpen(gid) { var q = G().group(gr(), gid); if (!q) return; q.open = !q.open; commit("gopen", true); paintSide(); }
  function makeGroupOfSelection() {
    var g = gr(), ids = selIds(); if (!ids.length) { say("Select the nodes to group first."); return; }
    var r = G().makeGroup(g, ids, ""); if (r.err) { say(r.err); return; }
    setSel([r.id]); commit("ggroup", true); paintSide();
  }
  function groupMovers(ids) {   /* the objects that move when these items are dragged: nodes, and for a group itself, its nodes and its groups */
    var g = gr(), out = [], seen = {};
    function add(o) { if (o && !seen[o.id]) { seen[o.id] = 1; out.push(o); } }
    function addGroup(q) { add(q); q.nodes.forEach(function (i) { add(G().node(g, i)); }); q.groups.forEach(function (c) { addGroup(G().group(g, c)); }); }
    ids.forEach(function (i) { var q = G().group(g, i); if (q) addGroup(q); else add(G().node(g, i)); });
    return out;
  }
  function deleteSelected() {
    var g = gr(), ids = selIds(), skipped = 0, did = 0;
    ids = ids.reduce(function (acc, i) { if (G().isGroupId(g, i)) { G().members(g, i).forEach(function (m) { acc.push(m); }); } else acc.push(i); return acc; }, []);
    ids.forEach(function (i) { var n = G().node(g, i); if (!n) return; if (n.type === "output") { skipped++; return; } G().removeNode(g, i); did++; });
    if (skipped) say("An Output node goes away with its layer: delete the layer instead.");
    if (did) { setSel([]); commit("gdel"); }
  }
  var deleteSelectedNode = deleteSelected;
  function selectionItems() {
    var ids = C().selectedIds().map(C().getLayer).filter(Boolean).filter(function (l) { return !l.pattern || true; }), items = [], cg = C().curGroup && C().curGroup();
    if (cg) items.push({ g: cg.uid }); else ids.forEach(function (l) { if (l.uid) items.push({ l: l.uid }); });
    return items;
  }
  function addNode(type, at) {
    var g = gr(), sel = at ? null : G().node(g, ed.sel), svg = document.getElementById("gxsvg");
    var vb = svg ? curVb(svg) : fit(), c = viewCentre(),
      pos = at ? { x: Math.round((at.x - WN / 2) / GRID) * GRID, y: Math.round((at.y - 12) / GRID) * GRID } : sel ? placeFree(sel.x + 220, sel.y) : placeFree(vb.x + vb.w / 2 - WN / 2, vb.y + vb.h / 2 - 30);
    var p = null;
    if (type === "circle" || type === "polygon") p = Object.assign(G().defaultParams(type), { cx: c.x, cy: c.y });
    var n = G().addNode(g, type, pos.x, pos.y, p);
    if (n.type === "table" || n.type === "tablearea") n.p.table = (S().tables[0] && S().tables[0].id) || "";
    if (n.type === "objects" || n.type === "layer") { var it = selectionItems(); if (it.length) n.p.items = it; }
    if (sel) {
      var T = G().TYPES, done = false;
      /* the new node takes the selected node's output when it has an input that fits ... */
      if (T[sel.type].out) T[n.type].ins.forEach(function (q) { if (!done && G().canConnect(g, sel.id, n.id, q.port) === "") { G().connect(g, sel.id, n.id, q.port); done = true; } });
      /* ... otherwise it feeds a free input of the selected node, and sits to the left of it */
      if (!done && T[n.type].out) {
        var free = T[sel.type].ins.filter(function (q) { return !g.wires.some(function (w) { return w.to === sel.id && w.port === q.port; }) && G().canConnect(g, n.id, sel.id, q.port) === ""; })[0];
        if (free) { var pl = placeFree(sel.x - 220, sel.y); n.x = pl.x; n.y = pl.y; G().connect(g, n.id, sel.id, free.port); }
      }
    }
    setSel([n.id]); commit("gadd");
  }
  function click(b) {
    var a = b.dataset.pa, g = gr();
    if (a === "pattern") addPattern();
    else if (a === "gopen") { U.openEditor(); }
    else if (a === "gnew") { if (!ed.dropped) addNode(b.dataset.type); }
    else if (a === "gedge") addNode("objects");
    else if (a === "gshape") addNode("layer");
    else if (a === "goutput") addOutputLayer(ed.sel);
    else if (a === "gtidy") tidy();
    else if (a === "gfit") { ed.vb = null; paintCanvas(); }
    else if (a === "gdelnode") deleteSelected();
    else if (a === "gtogopen") toggleOpen(b.dataset.nid);
    else if (a === "gungroup") { G().ungroup(g, b.dataset.nid); setSel([]); commit("gungroup"); }
    else if (a === "gpin") togglePin(b.dataset.nid, b.dataset.key);
    else if (a === "gbake") { var nb = G().node(g, b.dataset.nid); if (nb) { var why = ""; guarded(function () { why = G().bake(g, nb.id, makeEnv({}), nb.prec != null ? nb.prec : 0.05); }); if (why) say(why); commit("gbake"); } }
    else if (a === "gunbake") { G().unbake(g, b.dataset.nid); commit("gunbake"); }
    else if (a === "gbakeall") { var errs = []; G().finalNodes(g).forEach(function (id) { var nb2 = G().node(g, id); if (nb2 && !nb2.bake) { var w = G().bake(g, id, makeEnv({}), nb2.prec != null ? nb2.prec : 0.05); if (w) errs.push(w); } }); if (errs.length) say(errs[0]); else say("Baked the nodes that feed the outputs."); commit("gbakeall"); }
    else if (a === "gunbakeall") { g.nodes.forEach(function (nn) { delete nn.bake; }); commit("gunbakeall"); }
    else if (a === "gcompute") U.compute();
    else if (a === "gsel") { setSel([b.dataset.nid]); paintCanvas(); paintSide(); }
    else if (a === "gvar") runVariants(b.dataset.nid);
    else if (a === "gpick") { var nv = G().node(g, b.dataset.nid); if (nv) { ed.varToken = (ed.varToken || 0) + 1; guarded(function () { setParam(nv, "seed", b.dataset.seed, null); }); commit("gparam"); } }
    else if (a === "gdetach") U.detach(C().getLayer(b.dataset.lid));
    else if (a === "gdice") { var nd = G().node(g, b.dataset.nid); if (nd) { guarded(function () { setParam(nd, "seed", String(1 + Math.floor(Math.random() * 9999)), null); }); commit("gparam"); paintPreview(); } }
    else if (a === "gpt+" || a === "gpt-") {
      var n = G().node(g, b.dataset.nid); if (!n || !n.p.pts) return;
      if (a === "gpt+") { var last = n.p.pts[n.p.pts.length - 1], prev = n.p.pts[n.p.pts.length - 2] || last; n.p.pts.push({ x: Math.round(last.x + (last.x - prev.x || 100)), y: Math.round(last.y + (last.y - prev.y)), r: 0 }); }
      else if (n.p.pts.length > 2) n.p.pts.splice(+b.dataset.idx, 1);
      commit("gpt");
    } else if (a === "gobj") {
      var no = G().node(g, b.dataset.nid); if (!no) return;
      var ids = C().selectedIds().map(C().getLayer).filter(Boolean), items = [], cg = C().curGroup && C().curGroup();
      if (cg) items.push({ g: cg.uid }); else ids.forEach(function (l) { if (l.uid) items.push({ l: l.uid }); });
      if (!items.length) { say("Select the texts, glyphs or patterns first, then press this button."); return; }
      guarded(function () { no.p.items = items; }); commit("gobj");
    } else if (a === "gfreeze") {
      var nf = G().node(g, b.dataset.nid); if (!nf) return;
      var res = PTD.paths.loops(Object.assign({}, nf.p, { kind: "objects", halo: nf.p.halo === "frozen" ? "ink" : nf.p.halo }), makeEnv({}));
      if (!res.loops.length) { say("Nothing to freeze: " + (res.err || "the path has no loops") + "."); return; }
      nf.p.frozen = res.loops.map(function (l) { return { closed: l.closed, pts: l.pts.map(function (q) { return [r1(q[0]), r1(q[1])]; }) }; });
      nf.p.halo = "frozen"; commit("gfreeze"); say("The path is frozen: it no longer follows the objects.");
    }
  }

  function init() {
    /* live: while a slider is dragged or a number is typed, the stage follows at once; the undo step and the panels wait for the change */
    document.addEventListener("input", function (e) {
      var t = e.target, d = t && t.dataset;
      if (d && d.bk === "prec") { var nbk = G().node(gr(), d.nid), v = parseFloat(t.value); if (nbk && isFinite(v) && v > 0) { nbk.prec = Math.min(5, v); var inf = document.getElementById("gxbkinfo"); if (inf && !nbk.bake) inf.textContent = bakeInfoText(nbk); } return; }
      if (d && d.pa === "gname") { var nm = itemOf(d.nid); if (nm) { var tv = t.value.trim().slice(0, 60); if (tv) nm.name = tv; else delete nm.name; paintCanvas(); } return; }
      if (d && d.pa === "goffsel") { var oi = itemOf(d.nid); if (oi && oi.type !== "output") { if (t.value) oi.off = t.value; else delete oi.off; paintCanvas(); C().renderStage(); paintPreview(); } return; }   /* a preview while the arrow keys move in the list */
      if (!d || !(d.gx || d.gp) || t.type === "checkbox") return;
      if (t.type === "number" || t.type === "range") { G().draft = true; clearTimeout(ed.draftT); ed.draftT = setTimeout(function () { G().draft = false; C().renderStage(); paintPreview(); }, 450); }   /* draft quality while a value is dragged; full quality shortly after */
      var a = (d.gx || d.gp).split("|"), n = G().node(gr(), a[0]); if (!n || a[1] === "pt") return;
      if (!setParam(n, a[1], t.value, null)) return;
      if (d.gx) document.querySelectorAll('[data-gx="' + d.gx + '"]').forEach(function (o) { if (o !== t) o.value = t.value; });
      C().renderStage(); paintPreview();
    });
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.dataset && t.dataset.bk) { commit("gbk", true); return; }
      if (t && t.dataset && t.dataset.pa === "gname") { var nm2 = itemOf(t.dataset.nid); if (nm2) { var tv2 = t.value.trim().slice(0, 60); if (tv2) nm2.name = tv2; else delete nm2.name; commit("gname"); } return; }
      if (t && t.dataset && t.dataset.pa === "goffsel") { var on = itemOf(t.dataset.nid); if (on && on.type !== "output") { if (t.value) on.off = t.value; else delete on.off; commit("goff"); } return; }
      if (t && t.id === "gxAuto") { gr().manual = !t.checked; commit("gauto"); return; }
      clearTimeout(ed.draftT); G().draft = false;
      if (t && t.dataset && (t.dataset.gp || t.dataset.gx || t.dataset.gpe)) onField(t);
      else if (t && t.id === "gxOnly") { ed.only = t.checked; ed.vb = null; paintCanvas(); }
    });
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-pa]"); if (b) click(b); });
    document.addEventListener("pointerdown", pointerdown);
    document.addEventListener("wheel", wheel, { passive: false });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuEl) { closeMenu(); e.stopPropagation(); return; }
      var inDock = ed.focus && PTD.layout && PTD.layout.dock.isOpen() && !(e.target.closest && e.target.closest("input,select,textarea")), K = e.key.length === 1 ? e.key.toLowerCase() : e.key, mod = e.ctrlKey || e.metaKey;
      if (inDock && editLayer()) {
        var handled = true;
        if (K === "a" && e.shiftKey && !mod) { var sv = document.getElementById("gxsvg"), at = sv ? svgPoint(sv, { clientX: ed.mx || 0, clientY: ed.my || 0 }) : { x: 0, y: 0 }; openSearch(ed.mx || 200, ed.my || 200, at); }
        else if (K === "a" && mod) { setSel(visible().map(function (n) { return n.id; })); paintCanvas(); paintSide(); }
        else if (K === "d" && mod) { var ids0 = selIds(); if (ids0.length) menuAct("dup"); }
        else if (K === "g" && mod && !e.shiftKey) makeGroupOfSelection();
        else if (K === "g" && mod && e.shiftKey) { var ids1 = selIds(); if (ids1.length) menuAct("ungroup"); }
        else if (K === "Home" || (K === "f" && !mod && !e.altKey)) { ed.vb = null; paintCanvas(); }
        else if (K === "Escape" && selIds().length) { setSel([]); paintCanvas(); paintSide(); }
        else handled = false;
        if (handled) { e.preventDefault(); e.stopPropagation(); return; }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && ed.focus && PTD.layout && PTD.layout.dock.isOpen() && selIds().length && !(e.target.closest && e.target.closest("input,select,textarea"))) {
        e.preventDefault(); e.stopPropagation(); deleteSelected();   /* the keys belong to the editor while the pointer last worked in it */
      }
    }, true);
    document.addEventListener("contextmenu", contextmenu, true);
    document.addEventListener("pointermove", function (e) { ed.mx = e.clientX; ed.my = e.clientY; });
    document.addEventListener("dblclick", function (e) {
      var svg = e.target.closest && e.target.closest("#gxsvg"); if (!svg) return;
      var dn = e.target.closest("[data-nid]");
      if (dn && !e.target.closest("[data-pin],[data-pout]")) {
        if (dn.dataset.box || dn.dataset.frame) { if (!e.target.closest(".gxfbody")) toggleOpen(dn.dataset.nid); return; }
        if (e.target.closest(".gxhead,.gxtitle")) { var ni = document.querySelector('#gxside input[data-pa="gname"]'); if (ni) { ni.focus(); ni.select(); } }
        return;
      }
      if (e.target.closest("[data-wire]")) return;
      openSearch(e.clientX, e.clientY, svgPoint(svg, e));
    });
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-gm]"); if (b) menuAct(b.dataset.gm); });
    /* the layer input of the sliders: keep dragging smooth without a full rebuild of the dock */
    if (PTD.layout) PTD.layout.dock.want = function () { var on = !!(PTD.core && editLayer()); if (!on) ed.wanted = false; return on && ed.wanted; };   /* a click on a pattern only selects it: the editor opens from Edit graph, the menu or a double click */
  }
  U.cycleMsg = cycleMsg; U.ensure = U.refresh;
  U.editor = ed;
  PTD.pathsui = U;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window.PTD = window.PTD || {});
