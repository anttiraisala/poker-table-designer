/* The procedural graph: the browser part (REQ-049 to REQ-052). The engine is in graph.js, the path maths in paths.js.
 * - A pattern is a layer (glyph-like, flags `pattern` and `glyph`) with `pattern = { out: id of its Output node }`. Its shape is cached in
 *   `frozen` (millimetres, artwork coordinates) and made again by refresh() when the graph, the objects it follows or a table changed.
 * - The graph editor lives in the dock under the stage (js/layout.js). The layer panel shows the exposed ("pinned") parameters. */
(function (PTD) {
  "use strict";
  var U = {}, cache = {}, status = {}, busy = false, ed = { sel: "", only: true, vb: null, lastLayer: "" };
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
      if (n.type === "objects") parts.push(itemLayers(n.p.items).map(srcSig));
      if (n.type === "table") parts.push(S().tables.map(function (t) { return [t.id, t.nodes, t.x, t.y, t.rot, t.railW, t.wrap, t.bet]; }));
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
  U.status = function (l) { return status[l.uid || l.id] || ""; };
  U.forget = function () { cache = {}; G().clearCache(); };

  /* ---------- cycles between patterns (a pattern that follows objects) ---------- */
  function readsOf(l) {
    var g = gr(), out = [];
    G().upstream(g, l.pattern.out).forEach(function (id) { var n = G().node(g, id); if (n && n.type === "objects") itemLayers(n.p.items).forEach(function (x) { if (x.pattern) out.push(x); }); });
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
    var l = newLayer(out.id); ed.sel = st.id; ed.only = true; ed.vb = null;
    U.forget(); C().save("pattern:" + Date.now()); C().renderPanels(); C().renderStage();
    return l;
  }
  U.addPattern = addPattern;
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
      commit("gparam");
    } else if (d.gx) {
      a = d.gx.split("|"); var n2 = G().node(g, a[0]); if (!n2) return;
      guarded(function () { setParam(n2, a[1], el.value, null); });
      commit("gpin");
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
  function fieldHtml(n, s) {
    var key = n.id + "|" + s.key, v = n.p[s.key], pin = n.exp.some(function (e) { return e.key === s.key; }), h;
    var pinBtn = (s.t === "num" || s.t === "int") ? '<button class="tbtn gxpin' + (pin ? " on" : "") + '" type="button" data-pa="gpin" data-nid="' + n.id + '" data-key="' + s.key + '" title="' + (pin ? "Unpin: remove this value from the layer panel." : "Pin: show this value as a slider in the panel of the layer.") + '">' + (pin ? "●" : "○") + "</button>" : "";
    if (s.t === "chk") return '<label class="chk" title="' + esc(s.tip) + '"><input type="checkbox" data-gp="' + key + '"' + (v ? " checked" : "") + ' title="' + esc(s.tip) + '"><span>' + esc(s.label) + "</span></label>";
    if (s.t === "sel") h = '<select data-gp="' + key + '" title="' + esc(s.tip) + '">' + opts(s.opts, v) + "</select>";
    else h = '<input type="number" step="' + (s.step || "any") + '"' + (s.min != null ? ' min="' + s.min + '"' : "") + (s.max != null ? ' max="' + s.max + '"' : "") + ' data-gp="' + key + '" value="' + r1(v) + '" title="' + esc(s.tip) + '">';
    var pe = "";
    if (pin) { var e = n.exp.filter(function (q) { return q.key === s.key; })[0], k2 = n.id + "|" + s.key + "|"; pe = '<div class="gxpe small">Panel label <input type="text" data-gpe="' + k2 + 'label" value="' + esc(e.label) + '" title="The label of this slider in the layer panel."> from <input type="number" step="any" data-gpe="' + k2 + 'min" value="' + r1(e.min) + '" title="Left end of the slider."> to <input type="number" step="any" data-gpe="' + k2 + 'max" value="' + r1(e.max) + '" title="Right end of the slider."></div>'; }
    return '<label class="fld" title="' + esc(s.tip) + '"><span>' + esc(s.label) + "</span>" + h + pinBtn + "</label>" + pe;
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
    if (n.type === "table") {
      var tl = S().tables.map(function (t) { return [t.id, t.name]; });
      h += '<label class="fld" title="The table whose line the path follows."><span>Table</span><select data-gp="' + n.id + '|table" title="The table whose line the path follows.">' + opts(tl, n.p.table || (tl[0] && tl[0][0])) + "</select></label>";
    }
    if (n.type === "objects") {
      h += '<p class="small">Follows the outer edge of ' + (n.p.items.length ? n.p.items.length + " chosen object" + (n.p.items.length > 1 ? "s" : "") : "no objects yet") + ". Select texts, glyphs, patterns or one group, then press the button.</p>" +
        '<div class="btnrow"><button class="btn" type="button" data-pa="gobj" data-nid="' + n.id + '" title="Takes the selected texts, glyphs and patterns (or the selected group) as the objects this path follows.">Use selected objects</button><button class="btn" type="button" data-pa="gfreeze" data-nid="' + n.id + '" title="Keeps the path as it is now; it stops following the objects.">Freeze</button></div>';
    }
    return h;
  }

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
      '<p class="small multi">A pattern is the result of a chain in the graph under the stage. It turns about the artwork origin; Centre X and Y nudge it.</p>' +
      '<label class="fld"><span>Name</span><input type="text" data-scope="' + sc + '" data-key="text" autocomplete="off"></label>' +
      '<div class="btnrow"><button class="btn" type="button" data-pa="gopen" title="Opens the graph editor under the stage for this pattern.">Edit graph</button></div>' +
      (st ? '<p class="small warn" data-pstatus="1">' + esc(st) + "</p>" : "") +
      (pins ? '<h4 class="small">Pinned values</h4>' + pins : '<p class="small">No pinned values. In the graph, press ○ next to a value to show it here.</p>') +
      H.pair("Rotation", sc, "rot", -180, 180, 1, -360, 360) + H.pair("Opacity", sc, "opacity", 0, 1, 0.01, 0, 1) +
      '<div class="colorrow" data-colour="' + sc + ':color:Colour"></div>' +
      '<div class="checks">' + H.chk("Gold shading (shaded preview only)", sc, "gradient") + "</div>" +
      '<div class="checks">' + H.chk("Halo (hides what is below)", sc, "outline") + H.chk("Use cloth colour", sc, "outlineAuto") + "</div>" +
      H.pair("Halo width", sc, "outlineW", 0, 50, 0.5, 0, 300) +
      '<div class="colorrow" data-colour="' + sc + ':outlineColor:Halo colour, used when the cloth colour is off"></div>' +
      '<div class="row2">' + H.len("Centre X", sc, "x") + H.len("Centre Y", sc, "y") + "</div>" +
      "</div>";
  };

  /* ---------- the editor ---------- */
  var COL = { path: "#d4af5a", shape: "#4fd1d9", any: "#9aa0a6" };
  function nodeH(n) { var ty = G().TYPES[n.type]; return 26 + 18 * Math.max(1, ty.ins.length); }
  function inPos(n, i) { return { x: n.x, y: n.y + 26 + 18 * i + 9 }; }
  function outPos(n) { return { x: n.x + WN, y: n.y + 26 + 9 }; }
  function visible() {
    var g = gr(), l = selLayer();
    if (ed.only && l) {   /* the chain of this layer, and loose nodes that feed no output yet (so a new node never disappears) */
      var up = G().upstream(g, l.pattern.out), fed = {};
      g.nodes.forEach(function (n) { if (n.type === "output") G().upstream(g, n.id).forEach(function (i) { fed[i] = 1; }); });
      return g.nodes.filter(function (n) { return up.indexOf(n.id) >= 0 || !fed[n.id]; });
    }
    return g.nodes;
  }
  function fit() {
    var ns = visible(), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ns.forEach(function (n) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + WN); y1 = Math.max(y1, n.y + nodeH(n)); });
    if (!ns.length) return { x: 0, y: 0, w: 800, h: 300 };
    return { x: x0 - 30, y: y0 - 30, w: Math.max(400, x1 - x0 + 60), h: Math.max(160, y1 - y0 + 60) };
  }
  function nodeSvg(n) {
    var ty = G().TYPES[n.type], h = nodeH(n), sel = ed.sel === n.id, col = COL[ty.out || "any"];
    var s = '<g class="gxnode' + (sel ? " sel" : "") + '" data-nid="' + n.id + '" transform="translate(' + n.x + " " + n.y + ')">' +
      '<rect class="gxbox" width="' + WN + '" height="' + h + '" rx="5"></rect><rect class="gxhead" width="' + WN + '" height="22" rx="5" style="fill:' + col + '"></rect>' +
      '<text class="gxtitle" x="8" y="15">' + esc(ty.label) + (n.exp.length ? " ●" : "") + "</text>";
    if (n.type === "output") { var l = patterns().filter(function (q) { return q.pattern.out === n.id; })[0]; s += '<text class="gxsub" x="8" y="' + (h - 6) + '">' + esc(l ? l.text : "(no layer)") + "</text>"; }
    ty.ins.forEach(function (q, i) {
      s += '<circle class="gxport in" data-pin="' + n.id + '" data-port="' + q.port + '" cx="0" cy="' + (35 + 18 * i) + '" r="6" style="fill:' + COL[q.kind] + '"><title>' + esc(q.port + " (" + q.kind + (q.multi ? ", many" : "") + (q.optional ? ", optional" : "") + ")") + '</title></circle><text class="gxport-l" x="10" y="' + (39 + 18 * i) + '">' + esc(q.port === "in" ? "" : q.port) + "</text>";
    });
    if (ty.out) s += '<circle class="gxport out" data-pout="' + n.id + '" cx="' + WN + '" cy="35" r="6" style="fill:' + COL[ty.out] + '"><title>Drag from here to an input to make a wire (' + ty.out + ")</title></circle>";
    return s + "</g>";
  }
  function wirePath(a, b) { var dx = Math.max(40, Math.abs(b.x - a.x) / 2); return "M" + a.x + " " + a.y + " C" + (a.x + dx) + " " + a.y + " " + (b.x - dx) + " " + b.y + " " + b.x + " " + b.y; }
  function canvasHtml() {
    var g = gr(), ns = visible(), ids = {}, vb = ed.vb || fit();
    ns.forEach(function (n) { ids[n.id] = n; });
    var s = '<svg id="gxsvg" tabindex="0" viewBox="' + vb.x + " " + vb.y + " " + vb.w + " " + vb.h + '" preserveAspectRatio="xMidYMid meet" aria-label="Graph editor" title="Drag a node by its header, drag from a round output to an input to wire, double-click a wire to remove it, Delete removes the selected node, wheel zooms, drag the background to pan.">';
    s += '<defs><pattern id="gxgrid" width="' + GRID + '" height="' + GRID + '" patternUnits="userSpaceOnUse"><path d="M' + GRID + ' 0H0V' + GRID + '" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="1"></path></pattern></defs><rect x="' + (vb.x - 4000) + '" y="' + (vb.y - 4000) + '" width="' + (vb.w + 8000) + '" height="' + (vb.h + 8000) + '" fill="url(#gxgrid)" pointer-events="none"></rect>';
    g.wires.forEach(function (w) {
      var a = ids[w.from], b = ids[w.to]; if (!a || !b) return;
      var ty = G().TYPES[b.type], i = 0; ty.ins.forEach(function (q, k) { if (q.port === w.port) i = k; });
      s += '<path class="gxwire" data-wire="' + w.from + "|" + w.to + "|" + w.port + '" d="' + wirePath(outPos(a), inPos(b, i)) + '" style="stroke:' + COL[G().TYPES[a.type].out] + '"><title>Double-click to remove this wire.</title></path>';
    });
    ns.forEach(function (n) { s += nodeSvg(n); });
    return s + '<path id="gxrubber" class="gxrubber" d=""></path></svg>';
  }
  function barHtml() {
    var cats = {}; G().catalog().forEach(function (k) { (cats[k[2]] = cats[k[2]] || []).push(k); });
    var o = Object.keys(cats).map(function (c) { return '<optgroup label="' + c + '">' + cats[c].map(function (k) { return '<option value="' + k[0] + '">' + esc(k[1]) + "</option>"; }).join("") + "</optgroup>"; }).join("");
    return '<div class="gxbar"><select id="gxType" title="The kind of node to add. A new node is wired to the selected node when the types fit.">' + o + '</select>' +
      '<button class="btn" type="button" data-pa="gaddnode" title="Adds the chosen node next to the selected one and wires it when the types fit.">+ Add node</button>' +
      '<button class="btn" type="button" data-pa="goutput" title="Adds a new Output node and a new pattern layer; the selected node is wired to it. Use this to share one chain between several layers.">+ Output layer</button>' +
      '<label class="chk" title="Show only the nodes that feed the selected pattern."><input type="checkbox" id="gxOnly"' + (ed.only ? " checked" : "") + ' title="Show only the nodes that feed the selected pattern."><span>Only this layer</span></label>' +
      '<button class="btn" type="button" data-pa="gtidy" title="Packs the visible nodes close together in columns, sources on the left and outputs on the right.">Tidy</button><button class="btn" type="button" data-pa="gfit" title="Fits the whole graph in the window.">Fit</button></div>';
  }
  function previewSvg(n) {
    var r = G().evaluate(gr(), n.id, makeEnv({}), G().newMemo());
    if (!r.kind) return '<p class="small warn">' + esc(r.err || "No result.") + "</p>";
    var pts = [], d = "";
    if (r.kind === "path") r.loops.forEach(function (l) { l.pts.forEach(function (q, i) { pts.push(q); d += (i ? "L" : "M") + r1(q[0]) + " " + r1(q[1]); }); if (l.closed) d += "Z"; });
    else r.paths.forEach(function (p) { p.forEach(function (q, i) { var x = q.X / 1000, y = q.Y / 1000; pts.push([x, y]); d += (i ? "L" : "M") + r1(x) + " " + r1(y); }); d += "Z"; });
    if (!pts.length) return "";
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    var m = Math.max(x1 - x0, y1 - y0) * 0.05 + 1;
    return '<svg class="gxprev" viewBox="' + (x0 - m) + " " + (y0 - m) + " " + (x1 - x0 + 2 * m) + " " + (y1 - y0 + 2 * m) + '" preserveAspectRatio="xMidYMid meet" aria-label="Result of the selected node"><path d="' + d + '" fill="' + (r.kind === "shape" ? COL.shape : "none") + '" fill-rule="evenodd" stroke="' + (r.kind === "shape" ? "none" : COL.path) + '" vector-effect="non-scaling-stroke" stroke-width="1.5"></path></svg>' +
      '<p class="small">' + (r.kind === "path" ? "A path: " + r.loops.length + " loop" + (r.loops.length > 1 ? "s" : "") : "A shape: " + r.paths.length + " outline" + (r.paths.length > 1 ? "s" : "")) + (r.err ? ". " + esc(r.err) : "") + "</p>";
  }
  function sideHtml() {
    var n = G().node(gr(), ed.sel);
    if (!n) return '<p class="small">Select a node to edit its values and to see its result. Press ○ next to a value to pin it to the panel of the layer.</p>';
    var ty = G().TYPES[n.type];
    return '<div class="btnrow"><strong>' + esc(ty.label) + '</strong><button class="tbtn" type="button" data-pa="gdelnode" data-nid="' + n.id + '" title="' + (n.type === "output" ? "An Output node goes away with its layer: delete the layer instead." : "Delete this node and its wires.") + '"' + (n.type === "output" ? " disabled" : "") + ">✕</button></div>" +
      (ty.tip ? '<p class="small">' + esc(ty.tip) + "</p>" : "") + nodeFields(n) + previewSvg(n);
  }
  function paintCanvas() { var box = document.getElementById("gxcanvas"); if (box) { box.innerHTML = canvasHtml(); } }
  function paintSide() { var box = document.getElementById("gxside"); if (box) box.innerHTML = sideHtml(); }
  U.paint = function () {
    if (!PTD.core) return;
    var body = PTD.layout && PTD.layout.dock.body(); if (!body) return;
    var l = selLayer();
    if (l && l.id !== ed.lastLayer) { ed.lastLayer = l.id; ed.vb = null; var n = G().node(gr(), ed.sel); if (!n || G().upstream(gr(), l.pattern.out).indexOf(ed.sel) < 0) ed.sel = ""; }
    if (!l) ed.lastLayer = "";
    var keep = document.activeElement && body.contains(document.activeElement) && document.activeElement.matches("input,select") ? null : 0;
    if (keep === null) return;   /* the user is typing in the editor: do not rebuild under the cursor */
    body.innerHTML = '<div class="gx"><div class="gxmain">' + barHtml() + '<div id="gxcanvas" class="gxcanvas">' + canvasHtml() + '</div></div><div id="gxside" class="gxside">' + sideHtml() + "</div></div>";
  };

  /* ---------- editor actions ---------- */
  function svgPoint(svg, e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
  function curVb(svg) { var b = svg.viewBox.baseVal; return { x: b.x, y: b.y, w: b.width, h: b.height }; }
  function pointerdown(e) {
    var svg = e.target.closest && e.target.closest("#gxsvg"); if (!svg || e.button !== 0) return;
    var g = gr(), pt = svgPoint(svg, e), out = e.target.closest("[data-pout]"), nodeEl = e.target.closest("[data-nid]");
    svg.focus({ preventScroll: true });
    if (out) {
      var from = out.dataset.pout, rub = svg.querySelector("#gxrubber"), a = G().node(g, from), ap = outPos(a);
      var move = function (ev) { var q = svgPoint(svg, ev); rub.setAttribute("d", wirePath(ap, q)); };
      var up = function (ev) {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); rub.setAttribute("d", "");
        var t = document.elementFromPoint(ev.clientX, ev.clientY), pin = t && t.closest && t.closest("[data-pin]"), nd = t && t.closest && t.closest("[data-nid]"), why = "";
        if (pin) why = connectGuarded(from, pin.dataset.pin, pin.dataset.port);
        else if (nd && nd.dataset.nid !== from) {   /* dropped on a node body: the first input of the right type */
          var to = G().node(g, nd.dataset.nid), ok = false;
          G().TYPES[to.type].ins.forEach(function (q) { if (!ok && G().canConnect(g, from, to.id, q.port) === "") { why = connectGuarded(from, to.id, q.port); ok = true; } });
          if (!ok) why = G().canConnect(g, from, to.id, G().TYPES[to.type].ins[0] ? G().TYPES[to.type].ins[0].port : "in") || "That node has no free input.";
        } else return;
        if (why) say(why);
      };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); e.preventDefault(); return;
    }
    if (nodeEl && !e.target.closest("[data-pin]")) {
      var n = G().node(g, nodeEl.dataset.nid), dx = pt.x - n.x, dy = pt.y - n.y, moved = false;
      ed.vb = curVb(svg);   /* the view must not change while a node is dragged */
      if (ed.sel !== n.id) { ed.sel = n.id; paintCanvas(); paintSide(); svg = document.getElementById("gxsvg"); }
      var mv = function (ev) {
        var q = svgPoint(svg, ev); n.x = Math.round((q.x - dx) / GRID) * GRID; n.y = Math.round((q.y - dy) / GRID) * GRID; moved = true;
        var el = svg.querySelector('[data-nid="' + n.id + '"]'); if (el) el.setAttribute("transform", "translate(" + n.x + " " + n.y + ")");
      };
      var fin = function () {
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", fin);
        if (moved) { commit("gmove", true); }
      };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", fin); e.preventDefault(); return;
    }
    if (e.target.closest("[data-wire]")) return;
    /* the background: pan */
    var vb = curVb(svg), sx = e.clientX, sy = e.clientY, sc = vb.w / svg.clientWidth;
    ed.vb = vb;
    if (ed.sel) { ed.sel = ""; paintCanvas(); paintSide(); svg = document.getElementById("gxsvg"); }
    var pm = function (ev) { svg.setAttribute("viewBox", (vb.x - (ev.clientX - sx) * sc) + " " + (vb.y - (ev.clientY - sy) * sc) + " " + vb.w + " " + vb.h); };
    var pu = function () { window.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu); ed.vb = curVb(svg); };
    window.addEventListener("pointermove", pm); window.addEventListener("pointerup", pu); e.preventDefault();
  }
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
    var g = gr(), ns = visible(), ids = {}, depth = {};
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
  function deleteSelectedNode() {
    var n = G().node(gr(), ed.sel); if (!n) return;
    if (n.type === "output") { say("An Output node goes away with its layer: delete the layer instead."); return; }
    G().removeNode(gr(), n.id); ed.sel = ""; commit("gdel");
  }
  function addNode() {
    var type = document.getElementById("gxType").value, g = gr(), sel = G().node(g, ed.sel), svg = document.getElementById("gxsvg");
    var vb = svg ? curVb(svg) : fit(), pos = sel ? placeFree(sel.x + 220, sel.y) : placeFree(vb.x + vb.w / 2 - WN / 2, vb.y + vb.h / 2 - 30), c = viewCentre();
    var p = null;
    if (type === "circle" || type === "polygon") p = Object.assign(G().defaultParams(type), { cx: c.x, cy: c.y });
    var n = G().addNode(g, type, pos.x, pos.y, p), msg = "";
    if (sel && G().TYPES[sel.type].out) {
      var done = false; G().TYPES[n.type].ins.forEach(function (q) { if (!done && G().canConnect(g, sel.id, n.id, q.port) === "") { G().connect(g, sel.id, n.id, q.port); done = true; } });
    }
    if (n.type === "table") n.p.table = (S().tables[0] && S().tables[0].id) || "";
    ed.sel = n.id; commit(msg || "gadd");
  }
  function click(b) {
    var a = b.dataset.pa, g = gr();
    if (a === "pattern") addPattern();
    else if (a === "gopen") { if (PTD.layout) PTD.layout.dock.open(); }
    else if (a === "gaddnode") addNode();
    else if (a === "goutput") addOutputLayer(ed.sel);
    else if (a === "gtidy") tidy();
    else if (a === "gfit") { ed.vb = null; paintCanvas(); }
    else if (a === "gdelnode") deleteSelectedNode();
    else if (a === "gpin") togglePin(b.dataset.nid, b.dataset.key);
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
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.dataset && (t.dataset.gp || t.dataset.gx || t.dataset.gpe)) onField(t);
      else if (t && t.id === "gxOnly") { ed.only = t.checked; ed.vb = null; paintCanvas(); }
    });
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-pa]"); if (b) click(b); });
    document.addEventListener("pointerdown", pointerdown);
    document.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("dblclick", function (e) {
      var w = e.target.closest && e.target.closest("[data-wire]"); if (!w) return;
      var a = w.dataset.wire.split("|"), g = gr();
      g.wires = g.wires.filter(function (x) { return !(x.from === a[0] && x.to === a[1] && x.port === a[2]); }); commit("gunwire");
    });
    document.addEventListener("keydown", function (e) {
      var svg = e.target.closest && e.target.closest("#gxsvg");
      if (svg && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); e.stopPropagation(); deleteSelectedNode(); }
    }, true);
    /* the layer input of the sliders: keep dragging smooth without a full rebuild of the dock */
    if (PTD.layout) PTD.layout.dock.want = function () { return !!(PTD.core && selLayer()); };
  }
  U.cycleMsg = cycleMsg; U.ensure = U.refresh;
  U.editor = ed;
  PTD.pathsui = U;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window.PTD = window.PTD || {});
