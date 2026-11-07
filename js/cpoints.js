/* Control points: points that belong to something (a parent) and keep their place relative to it.
 *
 * A control point has a parent (the cloth centre "world", the artwork origin, a text, a table or another control
 * point) and an offset (dx, dy) in millimetres. Moving the parent moves the point; dragging the point changes the
 * offset. The offset vector turns with the rotation of the parent and scales with its size (each can be switched off
 * on the point). `ref` remembers the rotation and size of the parent when the offset was measured, so that the point
 * stays exactly where it was at that moment and only follows later changes.
 *
 * Things snap to control points (texts, guides, measurements, other control points). A control point is never cut,
 * exported, or drawn in the picture, the Blender texture or the layout sheet picture. */
(function (PTD) {
  "use strict";
  var CP = PTD.cpoints = {};
  var COLOUR = "#c79bff";   /* light violet, used by nothing else */
  function C() { return PTD.core; }
  function num(v, d) { var n = Number(v); return isFinite(n) && v !== "" && v !== null && v !== undefined ? n : d; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function rot(x, y, deg) { var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }
  var KINDS = ["world", "origin", "text", "table", "point"];

  CP.list = function () { var s = C().state(); if (!s.cpoints) s.cpoints = []; return s.cpoints; };
  CP.get = function (id) { return CP.list().filter(function (c) { return c.id === id; })[0]; };

  /* ---------- parents and their frames ---------- */
  function layerByUid(uid, s) { return s.layers.filter(function (l) { return l.uid === uid; })[0]; }
  function tableOf(id, s) { return s.tables.filter(function (t) { return t.id === id; })[0]; }
  /* Width and height of a table outline (also a free one): the size that "follows scaling" is measured against. */
  function tableBox(t) {
    var pts = PTD.geom.flatten(t.nodes, 1), x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return { w: isFinite(x1 - x0) ? x1 - x0 : 0, h: isFinite(y1 - y0) ? y1 - y0 : 0 };
  }
  /* The frame of a parent that is not a control point: anchor in the world, rotation in degrees, raw size, hidden. */
  function rootFrame(par, s) {
    var k = par && par.kind;
    if (k === "world") return { x: 0, y: 0, rot: 0, raw: null, hid: false };
    if (k === "origin") return { x: s.origin.x, y: s.origin.y, rot: 0, raw: null, hid: false };
    if (k === "text") {
      var l = layerByUid(par.id, s); if (!l) return null;
      return { x: s.origin.x + l.x, y: s.origin.y + l.y, rot: l.rot || 0, raw: { a: l.size, b: l.size }, hid: !!l.hidden };
    }
    if (k === "table") {
      var t = tableOf(par.id, s); if (!t) return null;
      var bb = tableBox(t);
      return { x: t.x, y: t.y, rot: t.rot || 0, raw: { a: bb.w, b: bb.h }, hid: !t.visible };
    }
    return null;
  }
  function refOf(F) { return { rot: F.rot || 0, a: F.raw ? F.raw.a : 0, b: F.raw ? F.raw.b : 0 }; }

  /* Positions of all control points, parents first. Result: id -> { x, y, ax, ay (the anchor of the parent), fr (the
   * frame of the root of the chain), phid (hidden because the text or table it hangs on is hidden) }. */
  CP.resolve = function () {
    var s = C().state(), list = CP.list(), map = {}, busy = {};
    function res(cp) {
      if (map[cp.id]) return map[cp.id];
      if (busy[cp.id]) return null;
      busy[cp.id] = 1;
      var par = cp.parent || { kind: "world" }, F = null;
      if (par.kind === "point") {
        var pc = list.filter(function (q) { return q.id === par.id; })[0], pr = pc ? res(pc) : null;
        if (pr) F = { x: pr.x, y: pr.y, rot: pr.fr.rot, raw: pr.fr.raw, hid: pr.phid };
      } else F = rootFrame(par, s);
      if (!F) F = { x: 0, y: 0, rot: 0, raw: null, hid: false };   /* a missing parent counts as the world (normalize repairs the data) */
      var ref = cp.ref || { rot: 0, a: 0, b: 0 }, rotRef = ref.rot || 0, rotNow = cp.followRot !== false ? F.rot : rotRef, sx = 1, sy = 1;
      if (cp.followScale !== false && F.raw && ref.a > 0 && ref.b > 0 && F.raw.a > 0 && F.raw.b > 0) { sx = F.raw.a / ref.a; sy = F.raw.b / ref.b; }
      var l = rot(cp.dx, cp.dy, -rotRef), w = rot(l[0] * sx, l[1] * sy, rotNow);
      map[cp.id] = { x: F.x + w[0], y: F.y + w[1], ax: F.x, ay: F.y, fr: { rot: F.rot, raw: F.raw }, phid: F.hid };
      return map[cp.id];
    }
    list.forEach(res);
    return map;
  };
  CP.frameFor = function (par) {
    if (par && par.kind === "point") { var pr = CP.resolve()[par.id]; return pr ? { x: pr.x, y: pr.y, rot: pr.fr.rot, raw: pr.fr.raw, hid: pr.phid } : null; }
    return rootFrame(par, C().state());
  };
  CP.worldPos = function (cp) { var r = CP.resolve()[cp.id]; return r ? { x: r.x, y: r.y } : { x: 0, y: 0 }; };
  /* Position of the point with this id, hidden or not (null when it does not exist). */
  CP.pos = function (id) { var r = CP.resolve()[id]; return r ? { x: r.x, y: r.y } : null; };

  /* ---------- editing ---------- */
  CP.make = function (par, wx, wy) {
    var list = CP.list(), F = CP.frameFor(par) || CP.frameFor({ kind: "world" });
    if (!CP.frameFor(par)) par = { kind: "world" };
    var id = C().nextId("cp", list), cp = { id: id, name: "Point " + id.slice(2), parent: par, dx: r2(wx - F.x), dy: r2(wy - F.y), visible: true, followRot: true, followScale: true, ref: refOf(F) };
    list.push(cp);
    return cp;
  };
  /* Sets the offset so that the point lies at (wx, wy) now, keeping the parent. */
  CP.setWorld = function (cp, wx, wy) {
    var F = CP.frameFor(cp.parent) || { x: 0, y: 0, rot: 0, raw: null }, ref = cp.ref || { rot: 0, a: 0, b: 0 }, rotRef = ref.rot || 0;
    var rotNow = cp.followRot !== false ? F.rot : rotRef, sx = 1, sy = 1;
    if (cp.followScale !== false && F.raw && ref.a > 0 && ref.b > 0 && F.raw.a > 0 && F.raw.b > 0) { sx = F.raw.a / ref.a; sy = F.raw.b / ref.b; }
    var l = rot(wx - F.x, wy - F.y, -rotNow), v = rot(l[0] / sx, l[1] / sy, rotRef);
    cp.dx = r2(v[0]); cp.dy = r2(v[1]);
  };
  /* Takes the current rotation and size of the parent as the reference and keeps the point at pos. */
  CP.rebaseTo = function (cp, pos) {
    var F = CP.frameFor(cp.parent) || { x: 0, y: 0, rot: 0, raw: null };
    cp.ref = refOf(F); cp.dx = r2(pos.x - F.x); cp.dy = r2(pos.y - F.y);
  };
  CP.reparent = function (cp, par, pos) {
    pos = pos || CP.worldPos(cp);
    cp.parent = par;
    CP.rebaseTo(cp, pos);
  };
  /* True when the chain of parents of cp passes through the point with this id (or cp is that point). */
  CP.dependsOn = function (cp, id) {
    var cur = cp, n = 0;
    while (cur && n++ < 1000) {
      if (cur.id === id) return true;
      if (!cur.parent || cur.parent.kind !== "point") return false;
      cur = CP.get(cur.parent.id);
    }
    return false;
  };
  CP.descendantIds = function (id) {
    return CP.list().filter(function (c) { return c.id !== id && CP.dependsOn(c, id); }).map(function (c) { return c.id; });
  };
  /* Hands the children of something that is about to be deleted over to the world, keeping their places. */
  CP.detach = function (kind, id) {
    var list = CP.list(), pos = {};
    list.forEach(function (cp) { if (cp.parent.kind === kind && cp.parent.id === id) pos[cp.id] = CP.worldPos(cp); });
    list.forEach(function (cp) { if (pos[cp.id]) CP.reparent(cp, { kind: "world" }, pos[cp.id]); });
  };
  CP.remove = function (id) {
    var core = C(), s = core.state();
    if (!CP.get(id)) return;
    CP.detach("point", id);
    s.cpoints = CP.list().filter(function (c) { return c.id !== id; });
    if (core.ui.selCp === id) core.ui.selCp = null;
    core.renderPanels(); core.renderStage(); core.save();
  };
  /* Removes the control points whose text is gone (used by the randomizer, which owns the texts it replaces), and
   * the points that hung on them. Returns how many were removed. */
  CP.prune = function () {
    var s = C().state(), removed = 0, again = true;
    while (again) {
      again = false;
      var list = CP.list(), keep = list.filter(function (cp) {
        var p = cp.parent;
        if (p.kind === "text") return !!layerByUid(p.id, s);
        if (p.kind === "point") return list.some(function (q) { return q.id === p.id; });
        return true;
      });
      if (keep.length !== list.length) { removed += list.length - keep.length; s.cpoints = keep; again = true; }
    }
    if (removed && C().ui.selCp && !CP.get(C().ui.selCp)) C().ui.selCp = null;
    return removed;
  };
  /* Makes saved data safe: unknown parents become the world, cycles are broken. s holds the layers and tables. */
  CP.normalize = function (arr, s) {
    var seen = {}, out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (o) {
      if (!o || typeof o !== "object") return;
      var id = String(o.id || "");
      if (!id || seen[id]) { var n = 1; while (seen["cp" + n]) n++; id = "cp" + n; }
      seen[id] = 1;
      var p = o.parent && typeof o.parent === "object" ? o.parent : { kind: "world" };
      var par = { kind: KINDS.indexOf(p.kind) >= 0 ? p.kind : "world" };
      if (par.kind === "text" || par.kind === "table" || par.kind === "point") par.id = String(p.id || "");
      var rf = o.ref && typeof o.ref === "object" ? o.ref : {};
      out.push({ id: id, name: String(o.name || ("Point " + id.replace(/^cp/, ""))), parent: par, dx: num(o.dx, 0), dy: num(o.dy, 0),
        visible: o.visible !== false, followRot: o.followRot !== false, followScale: o.followScale !== false,
        ref: { rot: num(rf.rot, 0), a: Math.max(0, num(rf.a, 0)), b: Math.max(0, num(rf.b, 0)) } });
    });
    var byId = {}; out.forEach(function (c) { byId[c.id] = c; });
    out.forEach(function (c) {
      var p = c.parent;
      if (p.kind === "text" && !s.layers.some(function (l) { return l.uid === p.id; })) c.parent = { kind: "world" };
      else if (p.kind === "table" && !s.tables.some(function (t) { return t.id === p.id; })) c.parent = { kind: "world" };
      else if (p.kind === "point" && (!byId[p.id] || p.id === c.id)) c.parent = { kind: "world" };
    });
    out.forEach(function (c) {
      var cur = c, steps = 0;
      while (cur && cur.parent.kind === "point" && steps++ <= out.length) cur = byId[cur.parent.id];
      if (steps > out.length) c.parent = { kind: "world" };
    });
    return out;
  };

  /* ---------- snapping ---------- */
  /* Visible control points as snap points. skip: ids to leave out (a point being dragged and its children). */
  CP.snapPoints = function (skip) {
    var map = CP.resolve(), out = [];
    CP.list().forEach(function (cp) {
      var r = map[cp.id];
      if (!r || !cp.visible || r.phid || (skip && skip.indexOf(cp.id) >= 0)) return;
      out.push({ id: cp.id, x: r.x, y: r.y, tag: cp.name });
    });
    return out;
  };

  /* ---------- selection ---------- */
  CP.select = function (id) {
    var core = C(), ui = core.ui;
    core.deselectAll();
    ui.selMeasure = null; ui.selCp = id;
    core.setTab("guides");
    core.renderPanels(); core.renderStage();
    var n = document.querySelector('[data-cp-panel="' + id + '"]');
    if (n && n.scrollIntoView) n.scrollIntoView({ block: "nearest" });
  };

  /* ---------- drawing ---------- */
  CP.render = function (parent, ctx) {
    var core = C(), el = core.el, z = ctx.z, ui = core.ui, map = CP.resolve();
    CP.list().forEach(function (cp) {
      var r = map[cp.id]; if (!r || !cp.visible || r.phid) return;
      var sel = ui.selCp === cp.id, g = el("g", { transform: "translate(" + r.x + " " + r.y + ")" }, parent);
      if (sel || ui.tool === "cpoint") {
        el("line", { x1: r.ax - r.x, y1: r.ay - r.y, x2: 0, y2: 0, stroke: COLOUR, "stroke-width": 1, "stroke-dasharray": "2 4", "vector-effect": "non-scaling-stroke", "pointer-events": "none", opacity: 0.8 }, g);
      }
      el("circle", { r: 4.5 / z, fill: "rgba(199,155,255,0.35)", stroke: COLOUR, "stroke-width": 1.5, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
      el("path", { d: "M " + (-8 / z) + " 0 H " + (8 / z) + " M 0 " + (-8 / z) + " V " + (8 / z), fill: "none", stroke: COLOUR, "stroke-width": 1, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
      if (sel) {
        el("circle", { r: 10 / z, fill: "none", stroke: "#ffffff", "stroke-width": 1, "stroke-dasharray": "3 3", "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
        var t = el("text", { x: 13 / z, y: -9 / z, "font-size": 12 / z, fill: COLOUR, "pointer-events": "none", "font-family": "sans-serif" }, g); t.textContent = cp.name;
      }
      el("circle", { r: 11 / z, fill: "rgba(0,0,0,0)", "data-h": "cp:" + cp.id, "data-tip": cp.name + ": control point (drag to move, drop on another point to hang on it)", style: "cursor:pointer" }, g);
    });
  };

  /* ---------- the pointer ---------- */
  /* Press on a control point: select it and drag it. Dropping it on another control point hangs it on that one. */
  CP.pointerDown = function (e, h) {
    var core = C(), cfg = core.cfg(), ui = core.ui, id = h.slice(3), cp = CP.get(id);
    if (!cp) return false;
    if (ui.selCp !== id || ui.tab !== "guides") CP.select(id);
    var skip = [id].concat(CP.descendantIds(id)), target = null, moved = false;
    core.startDrag(e, {
      op: "cpoint",
      readout: function () { return "dx " + core.fmtLen(cp.dx) + "   dy " + core.fmtLen(cp.dy) + (target ? "   hangs on " + (target.name || target.id) : ""); },
      move: function (q, ev) {
        var free = !cfg.snap || ev.altKey || ev.ctrlKey, thr = 10 / ui.view.z, w;
        target = null;
        if (!free) {
          var best = null;
          CP.snapPoints(skip).forEach(function (sp) { var d = Math.hypot(sp.x - q.x, sp.y - q.y); if (d < thr && (!best || d < best.d)) best = { d: d, sp: sp }; });
          if (best) target = best.sp;
          else {
            var bad = CP.snapPoints(null).filter(function (sp) { return skip.indexOf(sp.id) > 0 && Math.hypot(sp.x - q.x, sp.y - q.y) < thr; })[0];
            if (bad) core.say("Circular dependency: a control point cannot hang on one of its own children.");
          }
        }
        if (target) { w = { x: target.x, y: target.y }; ui.snapLines = { x: [w.x], y: [w.y] }; }
        else if (free) { w = { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }; ui.snapLines = null; }
        else w = core.snapXY(q, { skipCps: skip });
        CP.setWorld(cp, w.x, w.y);
        moved = true;
        core.renderStage(); core.syncInputs();
      },
      up: function () {
        ui.snapLines = null;
        if (moved && target) { CP.reparent(cp, { kind: "point", id: target.id }, { x: target.x, y: target.y }); core.renderPanels(); }
        core.renderStage(); core.syncInputs();
        if (moved) core.save("cpmove");
      }
    });
    return true;
  };
  /* A click with the Point tool: the parent is the text (or control point) clicked, otherwise the artwork origin. */
  CP.click = function (p, e) {
    var core = C(), cfg = core.cfg(), ui = core.ui, par = null, onPoint = e.target.closest && e.target.closest('[data-h^="cp:"]');
    if (onPoint) par = { kind: "point", id: onPoint.dataset.h.slice(3) };
    else {
      var idn = e.target.closest && e.target.closest("[data-id]");
      if (idn && idn.dataset.id !== "band") { var l = core.getLayer(idn.dataset.id); if (l && l.uid) par = { kind: "text", id: l.uid }; }
    }
    if (!par) par = { kind: "origin" };
    var w = cfg.snap && !e.altKey && !e.ctrlKey && !onPoint ? core.snapXY(p, {}) : { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
    ui.snapLines = null;
    if (onPoint) {   /* a child on top of its parent would be hard to grab: give it a small offset */
      var pp = CP.pos(par.id);
      if (pp && Math.hypot(pp.x - w.x, pp.y - w.y) < 6 / ui.view.z) { w = { x: pp.x + 14 / ui.view.z, y: pp.y - 14 / ui.view.z }; }
    }
    var cp = CP.make(par, w.x, w.y);
    core.deselectAll(); ui.selMeasure = null; ui.selCp = cp.id;
    core.renderPanels(); core.renderStage(); core.save();
    core.say(cp.name + " added. It hangs on " + parentName(cp.parent) + ". Click again to add more, Esc to stop.");
  };

  /* ---------- keyboard ---------- */
  CP.key = function (e) {
    var core = C(), cp = core.ui.selCp && CP.get(core.ui.selCp);
    if (!cp) return false;
    if (e.key === "Delete" || e.key === "Backspace") { CP.remove(cp.id); return true; }
    var arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!arrows[e.key]) return false;
    var step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1, pos = CP.worldPos(cp);
    CP.setWorld(cp, pos.x + arrows[e.key][0] * step, pos.y + arrows[e.key][1] * step);
    core.renderStage(); core.syncInputs(); core.save("cpnudge");
    return true;
  };

  /* The visible control points for the layout sheet: place from the cloth centre, parent and offset from the parent. */
  CP.describe = function () {
    var map = CP.resolve(), out = [];
    CP.list().forEach(function (cp) {
      var r = map[cp.id]; if (!r || !cp.visible || r.phid) return;
      out.push({ name: cp.name, x: r.x, y: r.y, parent: parentName(cp.parent), ox: r.x - r.ax, oy: r.y - r.ay });
    });
    return out;
  };

  /* ---------- the panel ---------- */
  function parentName(par) {
    var s = C().state();
    if (par.kind === "world") return "the cloth centre";
    if (par.kind === "origin") return "the artwork origin";
    if (par.kind === "text") { var l = layerByUid(par.id, s); return l ? "the text \"" + String(l.text).slice(0, 24) + "\"" : "a missing text"; }
    if (par.kind === "table") { var t = tableOf(par.id, s); return t ? t.name : "a missing table"; }
    var c = CP.get(par.id); return c ? c.name : "a missing point";
  }
  function parentOptions(cp) {
    var core = C(), s = core.state(), esc = core.esc, o = '<option value="world">Cloth centre</option><option value="origin">Artwork origin</option>';
    s.layers.forEach(function (l) { o += '<option value="text|' + esc(l.uid) + '">Text: ' + esc(String(l.text).slice(0, 28) || "(empty)") + '</option>'; });
    s.tables.forEach(function (t) { o += '<option value="table|' + esc(t.id) + '">Table: ' + esc(t.name) + '</option>'; });
    CP.list().forEach(function (q) { if (!CP.dependsOn(q, cp.id)) o += '<option value="point|' + esc(q.id) + '">Point: ' + esc(q.name) + '</option>'; });
    return o;
  }
  CP.panelHTML = function () {
    var core = C(), ui = core.ui, esc = core.esc, h = core.h, list = CP.list(), map = CP.resolve();
    var out = '<h3 class="sec">Control points</h3>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="cpadd">+ Control point</button></div>' +
      '<p class="small">A control point belongs to something (its parent) and keeps its place relative to it; things snap to it. With the Point tool, click a text to hang the point on it, or an empty place for the artwork origin. Drag a point to move it; drop it on another point to hang it there.</p>';
    if (!list.length) out += '<p class="small">No control points yet.</p>';
    list.forEach(function (cp) {
      var sc = "cp:" + cp.id, sel = ui.selCp === cp.id, r = map[cp.id];
      out += '<section class="panel' + (sel ? " sel" : "") + '" data-cp-panel="' + esc(cp.id) + '"><div class="body">' +
        '<div class="colorrow"><button type="button" class="tbtn" data-act="cpsel" data-id="' + esc(cp.id) + '" title="Select this control point on the canvas" aria-label="Select control point">◎</button>' +
        '<input type="text" data-scope="' + sc + '" data-key="name" aria-label="Control point name" autocomplete="off">' +
        core.eyeBtn(cp.id, !cp.visible, "this control point", "cpeye") +
        '<button type="button" class="tbtn" data-act="cpdel" data-id="' + esc(cp.id) + '" aria-label="Delete control point" title="Delete this control point">✕</button></div>' +
        '<div class="row2"><label class="fld"><span>Hangs on</span><select data-scope="cpparent:' + esc(cp.id) + '" data-key="sel" aria-label="Parent of the control point">' + parentOptions(cp) + '</select></label><div></div></div>' +
        '<div class="row2">' + h.len("Offset X", sc, "dx") + h.len("Offset Y", sc, "dy") + '</div>' +
        '<div class="checks">' + h.chk("Follows rotation", sc, "followRot") + h.chk("Follows scaling", sc, "followScale") + '</div>' +
        '<p class="small">Now at X ' + esc(r ? core.fmtLen(r.x) : "?") + ", Y " + esc(r ? core.fmtLen(r.y) : "?") + ' from the cloth centre.</p>' +
        '</div></section>';
    });
    return out;
  };
  CP.act = function (act, d) {
    var core = C();
    if (act === "cpadd") { core.setTool("cpoint"); return true; }
    if (act === "cpsel") { CP.select(d.id); return true; }
    if (act === "cpdel") { CP.remove(d.id); return true; }
    if (act === "cpeye") { var cp = CP.get(d.id); if (cp) { cp.visible = !cp.visible; core.renderPanels(); core.renderStage(); core.save(); } return true; }
    return false;
  };

  /* ---------- scopes for the fields ---------- */
  PTD.scopes.cp = function (id) { return CP.get(id); };
  PTD.onChange.cp = function (cp, key, id, v, old) {
    if (key === "followRot" || key === "followScale") {   /* keep the point where it is when a switch changes */
      cp[key] = old; var pos = CP.worldPos(cp); cp[key] = v; CP.rebaseTo(cp, pos);
      C().renderPanels();
    }
  };
  PTD.scopes.cpparent = function (id) {
    var cp = CP.get(id); if (!cp) return null;
    var proxy = {};
    Object.defineProperty(proxy, "sel", {
      get: function () { var p = cp.parent; return p.kind === "world" || p.kind === "origin" ? p.kind : p.kind + "|" + p.id; },
      set: function (v) {
        var a = String(v).split("|"), par = a.length > 1 ? { kind: a[0], id: a.slice(1).join("|") } : { kind: a[0] };
        if (par.kind === "point") {
          var t = CP.get(par.id);
          if (!t || CP.dependsOn(t, cp.id)) { C().say("Circular dependency: a control point cannot hang on itself or on one of its own children."); return; }
        }
        CP.reparent(cp, par);
      }
    });
    return proxy;
  };
  PTD.onChange.cpparent = function () { C().renderPanels(); };
})(window.PTD = window.PTD || {});
