/* Guides, the measuring tool and constraints between guides.
 * A guide is a vertical (axis "x") or horizontal (axis "y") line. Its position is stored as a
 * distance from a reference: the cloth centre, or the left/top ("min") or right/bottom ("max")
 * edge of a table. Constraints between guides are solved by PTD.solver. */
(function (PTD) {
  "use strict";
  var Q = {}, G = PTD.geom;
  var C = function () { return PTD.core; };
  var newType = "dist";

  Q.get = function (id) { return C().state().guides.filter(function (g) { return g.id === id; })[0]; };
  Q.normalize = function (o, id) {
    var g = { id: id, name: "Guide", axis: "x", ref: { type: "centre" }, dist: 0, locked: false, hidden: false };
    Object.assign(g, o || {});
    g.id = id; g.axis = g.axis === "y" ? "y" : "x";
    g.dist = isFinite(Number(g.dist)) ? Number(g.dist) : 0;
    g.ref = g.ref && g.ref.type === "outline" ? { type: "outline", table: String(g.ref.table || ""), side: g.ref.side === "max" ? "max" : "min" } : { type: "centre" };
    g.name = String(g.name || "Guide"); g.locked = !!g.locked; g.hidden = !!g.hidden;
    return g;
  };
  Q.normalizeCons = function (o, id) {
    var c = Object.assign({ id: id, type: "dist", axis: "x", ids: [], value: 0, kind: "driving", enabled: true }, o || {});
    c.id = id; c.axis = c.axis === "y" ? "y" : "x";
    c.ids = Array.isArray(c.ids) ? c.ids.map(String) : [];
    c.value = isFinite(Number(c.value)) ? Number(c.value) : 0;
    c.kind = c.kind === "reference" ? "reference" : "driving"; c.enabled = c.enabled !== false;
    if (!PTD.solver.TYPES[c.type]) c.type = "dist";
    return c;
  };

  function base(g) {
    if (g.ref.type !== "outline") return 0;
    var t = PTD.tables.get(g.ref.table);
    if (!t) return null;
    var b = PTD.tables.geo(t).bbox;
    return g.axis === "x" ? (g.ref.side === "min" ? b.x0 : b.x1) : (g.ref.side === "min" ? b.y0 : b.y1);
  }
  Q.abs = function (g) {
    var b = base(g);
    if (b === null) return g.dist;
    if (g.ref.type !== "outline") return g.dist;
    return g.ref.side === "min" ? b + g.dist : b - g.dist;
  };
  Q.setAbs = function (g, v) {
    var b = base(g);
    if (b === null || g.ref.type !== "outline") { g.dist = round(v); return; }
    g.dist = round(g.ref.side === "min" ? v - b : b - v);
  };
  function round(v) { return Math.round(v * 1000) / 1000; }
  Q.positions = function () {
    var xs = [], ys = [];
    C().state().guides.forEach(function (g) { if (!g.hidden) (g.axis === "x" ? xs : ys).push({ v: Q.abs(g), tag: g.name }); });
    return { xs: xs, ys: ys };
  };

  /* ---- solving ---- */
  /* Runs the solver over every guide. With anchor ({id, axis, pos}) that guide is held at pos.
   * Guides move only when all constraints can be met. Returns the solver result. */
  Q.resolve = function (anchor) {
    var core = C(), st = core.state();
    var guides = st.guides.map(function (g) { return { id: g.id, axis: g.axis, pos: Q.abs(g) }; });
    var cons = st.constraints.slice();
    st.guides.forEach(function (g) {
      if (g.locked && (!anchor || anchor.id !== g.id)) cons.push({ id: "lock:" + g.id, type: "pos", axis: g.axis, ids: [g.id], value: Q.abs(g), kind: "driving", enabled: true });
    });
    if (!cons.length && !anchor) { core.ui.conflicts = []; return { ok: true, positions: {}, conflicts: [] }; }
    var res = PTD.solver.solve(guides, cons, anchor || null);
    if (res.ok) {
      st.guides.forEach(function (g) {
        var p = res.positions[g.id];
        if (p != null && Math.abs(p - Q.abs(g)) > 1e-6) Q.setAbs(g, p);
      });
      core.ui.conflicts = [];
    } else core.ui.conflicts = res.conflicts;
    return res;
  };
  function conflictText(res) {
    var st = C().state(), names = {};
    st.constraints.forEach(function (c, i) { names[c.id] = "#" + (i + 1) + " " + PTD.solver.TYPES[c.type].label; });
    return res.conflicts.map(function (k) {
      return k.message + (k.ids.length ? " (" + k.ids.map(function (i) { return names[i] || (i.indexOf("lock:") === 0 ? "a locked guide" : i); }).join(", ") + ")" : "");
    }).join(" ");
  }
  Q.conflictText = conflictText;

  /* ---- editing ---- */
  Q.add = function (axis, pos) {
    var core = C(), st = core.state(), id = core.nextId("g", st.guides);
    var n = st.guides.filter(function (g) { return g.axis === axis; }).length + 1;
    var g = Q.normalize({ name: (axis === "x" ? "Vertical " : "Horizontal ") + n, axis: axis, dist: round(pos || 0) }, id);
    st.guides.push(g);
    core.ui.selGuide = id; core.ui.selTable = null; core.ui.selNode = null;
    core.setTab("guides");
    core.renderPanels(); core.renderStage(); core.save();
    return g;
  };
  Q.remove = function (id) {
    var core = C(), st = core.state();
    st.guides = st.guides.filter(function (g) { return g.id !== id; });
    st.constraints = st.constraints.filter(function (c) { return c.ids.indexOf(id) < 0; });
    if (core.ui.selGuide === id) core.ui.selGuide = null;
    core.renderPanels(); core.renderStage(); core.save();
  };
  Q.addConstraint = function (axis) {
    var core = C(), st = core.state(), gs = st.guides.filter(function (g) { return g.axis === axis; });
    var spec = PTD.solver.TYPES[newType], need = spec.n;
    if (gs.length < Math.min(need, newType === "sym" ? 2 : need)) { core.say("Add more " + (axis === "x" ? "vertical" : "horizontal") + " guides first (this constraint needs " + (newType === "sym" ? 2 : need) + ")."); return; }
    var sorted = gs.slice().sort(function (a, b) { return Q.abs(a) - Q.abs(b); });
    var ids = sorted.slice(0, need).map(function (g) { return g.id; });
    var c = Q.normalizeCons({ type: newType, axis: axis, ids: ids, kind: "driving" }, core.nextId("c", st.constraints));
    var pos = {}; st.guides.forEach(function (g) { pos[g.id] = Q.abs(g); });
    var m = PTD.solver.measure(c, pos);
    if (newType === "sym") { c.ids = ids.slice(0, 2); c.value = 0; }
    else if (spec.unit === "len") c.value = round(m);
    else if (newType === "ratio") c.value = Math.round(m * 100) / 100;
    st.constraints.push(c);
    var res = Q.resolve();
    if (!res.ok) { st.constraints.pop(); core.say(conflictText(res)); core.ui.conflicts = []; core.renderPanels(); return; }
    core.renderPanels(); core.renderStage(); core.save();
  };

  /* ---- measure tool ---- */
  Q.measureClick = function (p) {
    var ui = C().ui, m = ui.measure;
    if (!m || (m.a && m.b)) ui.measure = { a: { x: p.x, y: p.y }, b: null, cur: { x: p.x, y: p.y } };
    else m.b = { x: p.x, y: p.y };
    C().renderStage();
  };
  Q.measureMove = function (p) {
    var m = C().ui.measure;
    if (m && m.a && !m.b) { m.cur = { x: p.x, y: p.y }; C().renderStage(); }
  };

  /* ---- drawing ---- */
  Q.render = function (g, ctx) {
    var core = C(), el = core.el, z = ctx.z, st = core.state(), w = ctx.world, ui = core.ui, cfg = core.cfg();
    if (cfg.showExtremes) {
      var ex = PTD.tables.snapPoints().extremes;
      ex.forEach(function (e) {
        var a = e.axis === "x" ? { x1: e.v, x2: e.v, y1: w.y0, y2: w.y1 } : { y1: e.v, y2: e.v, x1: w.x0, x2: w.x1 };
        a.stroke = "rgba(160,190,175,0.35)"; a["stroke-width"] = 1; a["stroke-dasharray"] = "2 5"; a["vector-effect"] = "non-scaling-stroke"; a["pointer-events"] = "none";
        el("line", a, g);
      });
    }
    st.guides.forEach(function (gd) {
      if (gd.hidden) return;
      var v = Q.abs(gd), sel = ui.selGuide === gd.id, x = gd.axis === "x";
      var a = x ? { x1: v, x2: v, y1: w.y0, y2: w.y1 } : { y1: v, y2: v, x1: w.x0, x2: w.x1 };
      var vis = Object.assign({ stroke: sel ? "#ffd27a" : "#ffb347", "stroke-width": sel ? 2 : 1.2, "stroke-dasharray": gd.locked ? "" : "9 4", "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, a);
      el("line", vis, g);
      var hit = Object.assign({ stroke: "rgba(0,0,0,0)", "stroke-width": 10, "vector-effect": "non-scaling-stroke", "pointer-events": "stroke", "data-h": "guide:" + gd.id, style: "cursor:" + (gd.locked ? "not-allowed" : x ? "ew-resize" : "ns-resize") }, a);
      el("line", hit, g);
      var tx = x ? v + 5 / z : w.x0 + 6 / z, ty = x ? w.y0 + 16 / z : v - 5 / z;
      var t = el("text", { x: tx, y: ty, "font-size": 12 / z, fill: "#ffb347", "pointer-events": "none" }, g);
      t.style.fontFamily = "'Josefin Sans', sans-serif";
      t.textContent = gd.name + " · " + core.fmtLen(v) + (gd.ref.type === "outline" ? " (" + core.fmtLen(gd.dist) + " from edge)" : "");
    });
  };
  Q.renderMeasure = function (g, ctx) {
    var core = C(), el = core.el, z = ctx.z, m = core.ui.measure;
    if (!m || !m.a) return;
    var b = m.b || m.cur;
    el("line", { x1: m.a.x, y1: m.a.y, x2: b.x, y2: b.y, stroke: "#7be38a", "stroke-width": 1.8, "vector-effect": "non-scaling-stroke" }, g);
    [m.a, m.b].forEach(function (p) { if (p) el("circle", { cx: p.x, cy: p.y, r: 4 / z, fill: "#7be38a" }, g); });
    var dx = b.x - m.a.x, dy = b.y - m.a.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    var ang = Math.atan2(-dy, dx) * 180 / Math.PI;
    var tx = (m.a.x + b.x) / 2, ty = (m.a.y + b.y) / 2;
    var label = core.fmtLen(d) + "  (Δx " + core.fmtLen(dx) + ", Δy " + core.fmtLen(dy) + ", " + (Math.round(ang * 10) / 10) + "°)";
    var fs = 13 / z, tw = label.length * fs * 0.52;
    el("rect", { x: tx - tw / 2 - 4 / z, y: ty - fs * 1.05 - 6 / z, width: tw + 8 / z, height: fs * 1.4, fill: "rgba(8,28,22,0.88)", rx: 2 / z }, g);
    var t = el("text", { x: tx, y: ty - 8 / z, "text-anchor": "middle", "font-size": fs, fill: "#7be38a" }, g);
    t.style.fontFamily = "'Josefin Sans', sans-serif";
    t.textContent = label;
  };

  /* ---- pointer ---- */
  Q.pointerDown = function (e, h, p) {
    var core = C(), parts = h.split(":"), g = Q.get(parts[1]);
    if (!g) return false;
    core.ui.selGuide = g.id; core.ui.selTable = null; core.ui.selNode = null;
    core.setTab("guides"); core.renderPanels();
    if (g.locked) { core.renderStage(); core.say("This guide is locked."); return true; }
    var oldAbs = Q.abs(g), moved = false;
    core.startDrag(e, {
      move: function (q, ev) {
        var raw = g.axis === "x" ? q.x : q.y;
        if (core.cfg().snap && !ev.altKey && !ev.ctrlKey) {
          var s = core.snapXY(g.axis === "x" ? { x: raw, y: 1e9 } : { x: 1e9, y: raw }, { skipGuide: g.id });
          raw = g.axis === "x" ? s.x : s.y;
        } else raw = Math.round(raw * 10) / 10;
        var res = Q.resolve({ id: g.id, axis: g.axis, pos: raw });
        if (res.ok) { Q.setAbs(g, raw); moved = true; core.say(""); }
        else core.say(conflictText(res));
        core.renderStage(); core.syncInputs();
      },
      up: function () { core.ui.snapLines = null; core.renderPanels(); core.renderStage(); if (moved) core.save("guide:" + g.id); }
    });
    return true;
  };

  /* ---- panel ---- */
  function refOptions(g) {
    var st = C().state(), x = g.axis === "x";
    var o = '<option value="centre">Cloth centre</option>';
    st.tables.forEach(function (t) {
      o += '<option value="' + t.id + '|min">' + C().esc(t.name) + (x ? " left edge" : " top edge") + '</option>' +
        '<option value="' + t.id + '|max">' + C().esc(t.name) + (x ? " right edge" : " bottom edge") + '</option>';
    });
    return o;
  }
  function guideSelect(c, i, scope) {
    var st = C().state(), esc = C().esc;
    var opts = st.guides.filter(function (g) { return g.axis === c.axis; }).map(function (g) {
      return '<option value="' + g.id + '">' + esc(g.name) + " · " + esc(C().fmtLen(Q.abs(g))) + '</option>';
    }).join("");
    return '<select data-scope="' + scope + '" data-key="g' + i + '" aria-label="Guide ' + (i + 1) + '">' + opts + '</select>';
  }
  Q.panelHTML = function () {
    var core = C(), st = core.state(), ui = core.ui, esc = core.esc, h = core.h;
    var conflict = ui.conflicts && ui.conflicts.length ? ui.conflicts.reduce(function (a, k) { return a.concat(k.ids); }, []) : [];
    var out = '<h3 class="sec">Display and snapping</h3><div class="panel"><div class="body"><div class="checks">' +
      h.chk("Show table edge lines", "cfg", "showExtremes") + h.chk("Show grid", "cfg", "showGrid") + '</div>' +
      '<div class="row2">' + h.len("Grid / snap step (0 = off)", "cfg", "gridMm") + '<div></div></div>' +
      '<p class="small">Snapping pulls moved items to the cloth centre, guides, table nodes and edges, other items and the grid. Hold Alt or Ctrl to move freely.</p></div></div>' +
      '<h3 class="sec">Guides</h3>';
    var tools = '<div class="btnrow"><button class="btn" type="button" data-act="gadd" data-axis="x">+ Vertical guide</button><button class="btn" type="button" data-act="gadd" data-axis="y">+ Horizontal guide</button></div>';
    if (!st.guides.length) out += '<p class="small">No guides yet. Add one here, or use the Guide tools in the toolbar and click the canvas. Guides are measured from the cloth centre or from a table edge, and can be locked.</p>';
    st.guides.forEach(function (g) {
      var sc = "guide:" + g.id, sel = ui.selGuide === g.id, bad = conflict.indexOf("lock:" + g.id) >= 0;
      out += '<section class="panel' + (sel ? " sel" : "") + (bad ? " bad" : "") + '"><div class="body">' +
        '<div class="colorrow"><span class="chip on" style="cursor:default">' + (g.axis === "x" ? "|" : "—") + '</span><input type="text" data-scope="' + sc + '" data-key="name" aria-label="Guide name" autocomplete="off">' +
        core.eyeBtn(g.id, g.hidden, "this guide", "geye") +
        '<button type="button" class="tbtn" data-act="gdel" data-id="' + g.id + '" aria-label="Delete guide" title="Delete this guide">✕</button></div>' +
        '<div class="row2"><label class="fld"><span>Measured from</span><select data-scope="guideref:' + g.id + '" data-key="sel">' + refOptions(g) + '</select></label>' +
        h.len("Distance", sc, "dist") + '</div>' +
        '<div class="checks">' + h.chk("Locked", sc, "locked") + '<span class="small">Position ' + esc(core.fmtLen(Q.abs(g))) + ' from the cloth centre</span></div>' +
        '</div></section>';
    });
    out += tools;
    out += '<h3 class="sec">Constraints</h3>';
    if (conflict.length) out += '<div class="errtxt">' + esc(conflictText({ conflicts: ui.conflicts })) + '</div>';
    var pos = {}; st.guides.forEach(function (g) { pos[g.id] = Q.abs(g); });
    st.constraints.forEach(function (c, i) {
      var sc = "cons:" + c.id, spec = PTD.solver.TYPES[c.type], bad = conflict.indexOf(c.id) >= 0;
      var measured = PTD.solver.measure(c, pos), mt = spec.unit === "ratio" ? (Math.round(measured * 100) / 100) : core.fmtLen(measured);
      var gsel = "";
      c.ids.forEach(function (id, k) { gsel += guideSelect(c, k, sc); });
      out += '<section class="panel' + (bad ? " bad" : "") + '"><div class="body">' +
        '<div class="colorrow"><b style="font-weight:400">#' + (i + 1) + ' ' + esc(spec.label) + '</b><span class="small" style="margin-left:auto">now ' + esc(String(mt)) + '</span>' +
        '<button type="button" class="tbtn" data-act="cdel" data-id="' + c.id + '" aria-label="Delete constraint" title="Delete this constraint">✕</button></div>' +
        '<div class="' + (c.ids.length > 2 ? "row3" : "row2") + '">' + gsel + '</div>';
      if (spec.unit === "len" || spec.unit === "ratio" || c.type === "sym") {
        out += '<div class="row2">' + (spec.unit === "len" ? h.len("Value", sc, "value") : spec.unit === "ratio" ? h.numField("First gap : second gap", sc, "value", "0.01") : (c.ids.length < 3 ? h.len("Centre line at", sc, "value") : '<div></div>')) +
          '<div class="fld"><span>Kind</span><select data-scope="' + sc + '" data-key="kind"><option value="driving">Driving (enforced)</option><option value="reference">Reference (shown only)</option></select></div></div>';
      } else out += '<div class="row2"><div class="fld"><span>Kind</span><select data-scope="' + sc + '" data-key="kind"><option value="driving">Driving (enforced)</option><option value="reference">Reference (shown only)</option></select></div><div></div></div>';
      if (c.type === "equal") out += '<div class="btnrow"><button class="tbtn" type="button" data-act="cequalmore" data-id="' + c.id + '">+ guide</button><button class="tbtn" type="button" data-act="cequalless" data-id="' + c.id + '">− guide</button></div>';
      out += '<div class="checks">' + h.chk("Enabled", sc, "enabled") + '</div></div></section>';
    });
    var typeOpts = Object.keys(PTD.solver.TYPES).map(function (k) { return '<option value="' + k + '"' + (k === newType ? " selected" : "") + '>' + PTD.solver.TYPES[k].label + '</option>'; }).join("");
    out += '<div class="panel"><div class="body"><label class="fld"><span>New constraint</span><select id="newConsType">' + typeOpts + '</select></label>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="cadd" data-axis="x">Add on vertical guides</button><button class="btn" type="button" data-act="cadd" data-axis="y">Add on horizontal guides</button></div>' +
      '<p class="small">Driving constraints move the guides as little as needed to keep every rule true. If the rules contradict each other the change is refused and the constraints involved are named. Reference constraints only show the current value. Examples: a fixed distance between two guides, equal spacing of three or more, a pair of guides symmetric about the centre, two gaps in the ratio 2 : 1, or a minimum or maximum gap.</p></div></div>';
    return out;
  };

  Q.act = function (act, d) {
    var core = C(), st = core.state();
    if (act === "gadd") { Q.add(d.axis, 0); return true; }
    if (act === "gdel") { Q.remove(d.id); return true; }
    if (act === "geye") { var g = Q.get(d.id); if (g) { g.hidden = !g.hidden; core.renderPanels(); core.renderStage(); core.save(); } return true; }
    if (act === "cadd") { Q.addConstraint(d.axis); return true; }
    if (act === "cdel") { st.constraints = st.constraints.filter(function (c) { return c.id !== d.id; }); core.ui.conflicts = []; core.renderPanels(); core.renderStage(); core.save(); return true; }
    if (act === "cequalmore" || act === "cequalless") {
      var c = st.constraints.filter(function (k) { return k.id === d.id; })[0]; if (!c) return true;
      if (act === "cequalless") { if (c.ids.length > 3) c.ids.pop(); }
      else {
        var free = st.guides.filter(function (g) { return g.axis === c.axis && c.ids.indexOf(g.id) < 0; });
        if (free.length) c.ids.push(free[0].id); else core.say("No more guides on this axis.");
      }
      var res = Q.resolve(); if (!res.ok) { core.say(conflictText(res)); }
      core.renderPanels(); core.renderStage(); core.save();
      return true;
    }
    return false;
  };

  PTD.scopes = PTD.scopes || {};
  PTD.onChange = PTD.onChange || {};
  PTD.scopes.guide = function (id) { return Q.get(id); };
  PTD.scopes.guideref = function (id) {
    var g = Q.get(id); if (!g) return null;
    var proxy = {};
    Object.defineProperty(proxy, "sel", {
      get: function () { return g.ref.type === "outline" ? g.ref.table + "|" + g.ref.side : "centre"; },
      set: function (v) {
        var a = Q.abs(g);
        if (v === "centre") g.ref = { type: "centre" };
        else { var p = String(v).split("|"); g.ref = { type: "outline", table: p[0], side: p[1] === "max" ? "max" : "min" }; }
        Q.setAbs(g, a);
      }
    });
    return proxy;
  };
  PTD.scopes.cons = function (id) {
    var c = C().state().constraints.filter(function (k) { return k.id === id; })[0];
    if (!c) return null;
    var proxy = Object.create(c);
    /* g0, g1, ... address entries of ids */
    c.ids.forEach(function (_, i) {
      Object.defineProperty(proxy, "g" + i, { get: function () { return c.ids[i]; }, set: function (v) { c.ids[i] = v; } });
    });
    ["value", "kind", "enabled"].forEach(function (k) { Object.defineProperty(proxy, k, { get: function () { return c[k]; }, set: function (v) { c[k] = v; } }); });
    return proxy;
  };
  /* After an edit: guides must satisfy the constraints, otherwise the edit is undone. */
  function guard(obj, key, old, revert) {
    var res = Q.resolve();
    if (!res.ok) { revert(); C().say(conflictText(res)); Q.resolve(); C().renderPanels(); }
  }
  PTD.onChange.guide = function (obj, key, id, v, old) {
    if (key === "dist") {
      var res = Q.resolve({ id: obj.id, axis: obj.axis, pos: Q.abs(obj) });
      if (!res.ok) { obj.dist = old; C().say(conflictText(res)); Q.resolve(); }
    } else if (key === "locked") { /* nothing to solve */ }
    if (key === "name") { /* panel text stays as typed */ }
  };
  PTD.onChange.guideref = function () { C().renderPanels(); };
  PTD.onChange.cons = function (obj, key, id, v, old) {
    var c = C().state().constraints.filter(function (k) { return k.id === id; })[0];
    guard(c, key, old, function () {
      if (/^g\d+$/.test(key)) c.ids[Number(key.slice(1))] = old; else c[key] = old;
    });
    C().renderPanels();
  };
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "newConsType") newType = e.target.value;
  });

  PTD.guides = Q;
})(window.PTD = window.PTD || {});
