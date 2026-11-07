/* Alignment (requirement REQ-002): move objects so that they line up with a target.
 *
 * 1. Select objects and press "Set alignment target" (menu Align in the toolbar). Their bounding box becomes the target
 *    (one control point, one guide, or the crossing of two guides are a point or a line). The target stays until it is cleared.
 * 2. Select the objects to move (click, or drag an area; Shift adds, Ctrl removes). A box with nine handles appears around
 *    them. Near a handle an arrow shows where it would go and ghosts show the result; a click moves the objects there.
 *    Press on a handle and drag it onto a point of the target (exactly there) or onto a line of the target (the nearest point
 *    of the line); releasing on nothing cancels. Alt held: every object moves by itself.
 * 3. The quick buttons of the menu align left, centre, right, top, middle and bottom, place next to the target, and distribute.
 *    Without a target they align each selected object to the box around the selection.
 * Boxes are the geometry as it is (the thickness of lines is not counted). Nothing is a lasting constraint: one undo step. */
(function (PTD) {
  "use strict";
  var A = PTD.align = {};
  var G = PTD.geom;
  var ORANGE = "#ffa31a", CYAN = "#5ad1ff", YELLOW = "#ffe14d";
  var HANDLES = [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.5, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]];
  var S = { items: [], target: null, hover: null, preview: null, drag: false, alt: false, lastQ: null, desc: null, p: null, mod: "", cancelled: false };
  function C() { return PTD.core; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function layerOf(key) { var uid = key.slice(5); return C().state().layers.filter(function (l) { return l.uid === uid; })[0]; }
  function typeOf(key) { return key.split(":")[0]; }
  function idOf(key) { return key.slice(typeOf(key).length + 1); }

  /* ---------- the box of an object (world coordinates) ---------- */
  /* { kind: "box" | "point", x0, y0, x1, y1 } or { kind: "line", line: "v" | "h", pos }, or null when it is not there. */
  A.boxOf = function (key) {
    var core = C(), u = core.ui, t = typeOf(key), id = idOf(key);
    if (t === "text") {
      var l = layerOf(key); if (!l || l.hidden) return null;
      var b = u.bounds[l.id]; return b ? { kind: "box", x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h } : null;
    }
    if (t === "band") {
      var bb = u.bounds.band; if (!bb) return null;
      var bx = { kind: "box", x0: bb.x, y0: bb.y, x1: bb.x + bb.w, y1: bb.y + bb.h }, bd = core.state().band, AO = core.artOrigin();
      /* the stage bounds of the lines include half the thickness; the box is the geometry as it is (centre lines) */
      if (bd.show && !bd.hidden) {
        var topOuter = AO.y + bd.y - bd.gap / 2 - bd.thick / 2, botOuter = AO.y + bd.y + bd.gap / 2 + bd.thick / 2;
        if (Math.abs(bx.y0 - topOuter) < 0.05) bx.y0 += bd.thick / 2;
        if (Math.abs(bx.y1 - botOuter) < 0.05) bx.y1 -= bd.thick / 2;
      }
      return bx;
    }
    if (t === "bet") {
      var tt = PTD.tables.get(id); if (!tt) return null;
      var geo = PTD.tables.geo(tt); if (!geo.bet || geo.bet.pts.length < 2) return null;
      var cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
      geo.bet.pts.forEach(function (q) { cx0 = Math.min(cx0, q[0]); cx1 = Math.max(cx1, q[0]); cy0 = Math.min(cy0, q[1]); cy1 = Math.max(cy1, q[1]); });
      return { kind: "curve", pts: geo.bet.pts, closed: !!geo.bet.closed, x0: cx0, y0: cy0, x1: cx1, y1: cy1 };
    }
    if (t === "cp") {
      var cp = PTD.cpoints.get(id); if (!cp || !cp.visible) return null;
      var p = PTD.cpoints.pos(id); return p ? { kind: "point", x0: p.x, y0: p.y, x1: p.x, y1: p.y } : null;
    }
    if (t === "table") {
      var tb = PTD.tables.get(id); if (!tb) return null;
      var pts = G.flatten(PTD.tables.worldNodes(tb), 1), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
      return isFinite(x0) ? { kind: "box", x0: x0, y0: y0, x1: x1, y1: y1 } : null;
    }
    if (t === "guide") {
      var g = PTD.guides.get(id); if (!g) return null;
      return { kind: "line", line: g.axis === "x" ? "v" : "h", pos: PTD.guides.abs(g) };
    }
    return null;
  };
  function boxesOf(keys) { return keys.map(function (k) { return { k: k, b: A.boxOf(k) }; }).filter(function (x) { return x.b; }); }
  /* the objects that can be moved: the player-area line cannot (it follows its table) */
  function movables(keys) { return boxesOf(keys).filter(function (x) { return typeOf(x.k) !== "bet"; }); }
  function unionBox(list) {
    var bs = list.filter(function (x) { return x.b.kind !== "line"; });
    if (!bs.length) return null;
    var u = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    bs.forEach(function (x) { u.x0 = Math.min(u.x0, x.b.x0); u.y0 = Math.min(u.y0, x.b.y0); u.x1 = Math.max(u.x1, x.b.x1); u.y1 = Math.max(u.y1, x.b.y1); });
    return u;
  }
  function asBox(b) { return b.kind === "line" ? (b.line === "v" ? { x0: b.pos, x1: b.pos, y0: 0, y1: 0 } : { x0: 0, x1: 0, y0: b.pos, y1: b.pos }) : b; }
  function handlePt(b, fx, fy) { return { x: b.x0 + (b.x1 - b.x0) * fx, y: b.y0 + (b.y1 - b.y0) * fy }; }

  /* ---------- what is selected ---------- */
  /* The ordinary selection of the program as keys. */
  function normalItems() {
    var core = C(), s = core.state(), u = core.ui, out = [];
    [s.selected].concat(Object.keys(u.extra || {})).forEach(function (id) {
      if (!id) return;
      if (id === "band") { if (out.indexOf("band") < 0) out.push("band"); return; }
      var l = core.getLayer(id); if (l && l.uid && out.indexOf("text:" + l.uid) < 0) out.push("text:" + l.uid);
    });
    if (u.selCp) out.push("cp:" + u.selCp);
    if (u.selTable) out.push("table:" + u.selTable);
    if (u.selGuide) out.push("guide:" + u.selGuide);
    return out;
  }
  function currentKeys() { return C().ui.tool === "align" ? S.items.slice() : normalItems(); }
  /* The object under a click: control point, guide, table, text or the lines and cards. */
  A.keyFromEvent = function (e) {
    var tg = e.target, hn = tg && tg.closest && tg.closest("[data-h]");
    if (hn) {
      var a = hn.dataset.h.split(":");
      if (a[0] === "cp") return "cp:" + a[1];
      if (a[0] === "guide") return "guide:" + a[1];
      if (a[0] === "tbet" && PTD.tables.get(a[1])) return "bet:" + a[1];
      if (a[0] !== "meas" && PTD.tables.get(a[1])) return "table:" + a[1];
    }
    var idn = tg && tg.closest && tg.closest("[data-id]");
    if (idn) {
      var id = idn.dataset.id;
      if (id === "band") return "band";
      var l = C().getLayer(id); if (l && l.uid) return "text:" + l.uid;
    }
    return null;
  };
  function applySel(key, e) {
    var i = S.items.indexOf(key);
    if (e.ctrlKey || e.metaKey) { if (i >= 0) S.items.splice(i, 1); }   /* Ctrl removes */
    else if (e.shiftKey) { if (i < 0) S.items.push(key); }              /* Shift adds */
    else S.items = [key];
  }
  function itemsInRect(x0, y0, w, h) {
    var core = C(), s = core.state(), u = core.ui, out = [];
    function hit(b) { return b.x < x0 + w && b.x + b.w > x0 && b.y < y0 + h && b.y + b.h > y0; }
    s.layers.forEach(function (l) { var b = u.bounds[l.id]; if (b && l.uid && hit(b)) out.push("text:" + l.uid); });
    if (u.bounds.band && hit(u.bounds.band)) out.push("band");
    (s.cpoints || []).forEach(function (cp) {
      var bx = A.boxOf("cp:" + cp.id); if (bx && bx.x0 >= x0 && bx.x0 <= x0 + w && bx.y0 >= y0 && bx.y0 <= y0 + h) out.push("cp:" + cp.id);
    });
    s.tables.forEach(function (tb) {   /* a table only when the whole outline lies inside the area */
      var bx = A.boxOf("table:" + tb.id);
      if (bx && bx.x0 >= x0 && bx.x1 <= x0 + w && bx.y0 >= y0 && bx.y1 <= y0 + h) out.push("table:" + tb.id);
    });
    return out;
  }

  /* ---------- the target ---------- */
  A.makeTarget = function (keys) {
    var list = boxesOf(keys); if (!list.length) return null;
    var guides = list.filter(function (x) { return x.b.kind === "line"; }), rest = list.filter(function (x) { return x.b.kind !== "line"; });
    if (!rest.length) {
      if (guides.length === 2 && guides[0].b.line !== guides[1].b.line) {
        var v = guides.filter(function (x) { return x.b.line === "v"; })[0], h = guides.filter(function (x) { return x.b.line === "h"; })[0];
        return { kind: "point", x: v.b.pos, y: h.b.pos, label: "the crossing of two guides" };
      }
      return { kind: "line", dir: guides[0].b.line, pos: guides[0].b.pos, label: "a guide" };
    }
    if (rest.length === 1 && rest[0].b.kind === "point") return { kind: "point", x: rest[0].b.x0, y: rest[0].b.y0, label: "a control point" };
    if (rest.length === 1 && rest[0].b.kind === "curve") { var cb = rest[0].b; return { kind: "curve", pts: cb.pts, closed: cb.closed, box: { x0: cb.x0, y0: cb.y0, x1: cb.x1, y1: cb.y1 }, label: "the player-area line" }; }
    return { kind: "box", box: unionBox(rest), label: rest.length === 1 ? "one object" : rest.length + " objects" };
  };
  /* The nearest point of a polyline (closed or open) to q, with its distance. */
  function nearestOnPoly(pts, closed, q) {
    var best = null, n = pts.length, last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
      var t = len2 ? Math.max(0, Math.min(1, ((q.x - a[0]) * dx + (q.y - a[1]) * dy) / len2)) : 0;
      var px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(px - q.x, py - q.y);
      if (!best || d < best.d) best = { d: d, x: px, y: py };
    }
    return best;
  }
  function targetPoints(T) {
    if (T.kind === "box") return HANDLES.map(function (hd) { return handlePt(T.box, hd[0], hd[1]); });
    if (T.kind === "point") return [{ x: T.x, y: T.y }];
    return [];   /* a line or a curve has no points of its own to drop on */
  }
  /* Drop lines are infinite: the four edges and the two centre lines of a box, the two lines through a point, a guide. */
  function targetLines(T) {
    if (T.kind === "curve") return [];
    if (T.kind === "box") {
      var b = T.box, mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
      return [{ dir: "v", pos: b.x0 }, { dir: "v", pos: b.x1 }, { dir: "v", pos: mx }, { dir: "h", pos: b.y0 }, { dir: "h", pos: b.y1 }, { dir: "h", pos: my }];
    }
    if (T.kind === "point") return [{ dir: "v", pos: T.x }, { dir: "h", pos: T.y }];
    return [{ dir: T.dir, pos: T.pos }];
  }
  function lineDist(l, q) { return Math.abs((l.dir === "v" ? q.x : q.y) - l.pos); }
  function onLine(l, H) { return l.dir === "v" ? { x: l.pos, y: H.y } : { x: H.x, y: l.pos }; }
  /* Where a click on a control point goes: the point of the same name for a box, the nearest point for a line, the point itself. */
  function defaultDesc(T, hd) {
    if (T.kind === "box") return { type: "same", fx: hd[0], fy: hd[1] };
    if (T.kind === "point") return { type: "point", p: { x: T.x, y: T.y } };
    if (T.kind === "curve") return { type: "curve" };
    return { type: "line", l: { dir: T.dir, pos: T.pos } };
  }
  function resolveDrop(T, q, thr) {
    var best = null, bl = null;
    targetPoints(T).forEach(function (p) { var d = Math.hypot(p.x - q.x, p.y - q.y); if (d < thr && (!best || d < best.d)) best = { d: d, p: p }; });
    if (best) return { type: "point", p: { x: best.p.x, y: best.p.y } };
    if (T.kind === "curve") { var nc = nearestOnPoly(T.pts, T.closed, q); return nc && nc.d < thr ? { type: "curve" } : null; }
    targetLines(T).forEach(function (l) { var d = lineDist(l, q); if (d < thr && (!bl || d < bl.d)) bl = { d: d, l: l }; });
    return bl ? { type: "line", l: bl.l } : null;
  }
  function destOf(desc, T, H) {
    if (desc.type === "point") return desc.p;
    if (desc.type === "line") return onLine(desc.l, H);
    if (desc.type === "curve") { var nc = nearestOnPoly(T.pts, T.closed, H); return nc ? { x: nc.x, y: nc.y } : null; }
    return handlePt(T.box, desc.fx, desc.fy);
  }

  /* ---------- planning a move ---------- */
  function project(it, dx, dy) { return it.b.kind === "line" ? (it.b.line === "v" ? { dx: dx, dy: 0 } : { dx: 0, dy: dy }) : { dx: dx, dy: dy }; }
  /* moves: key -> {dx, dy}; arrows: [{from, to}]. alt: every object by itself. */
  function planMove(T, keys, hd, desc, alt) {
    var list = movables(keys), gb = unionBox(list), plan = { moves: {}, arrows: [], ghosts: [] };
    if (!list.length) return null;
    if (!alt && gb) {
      var H = handlePt(gb, hd[0], hd[1]), D = destOf(desc, T, H);
      if (!D) return null;
      list.forEach(function (it) { plan.moves[it.k] = project(it, D.x - H.x, D.y - H.y); });
      plan.arrows.push({ from: H, to: D });
    } else {
      list.forEach(function (it) {
        var Hi = handlePt(asBox(it.b), hd[0], hd[1]), Di = destOf(desc, T, Hi);
        if (!Di) return;
        plan.moves[it.k] = project(it, Di.x - Hi.x, Di.y - Hi.y); plan.arrows.push({ from: Hi, to: Di });
      });
    }
    list.forEach(function (it) { var m = plan.moves[it.k]; if (m) plan.ghosts.push({ b: it.b, dx: m.dx, dy: m.dy }); });
    return Object.keys(plan.moves).length ? plan : null;
  }

  /* ---------- applying a move ---------- */
  A.apply = function (moves, what) {
    var core = C(), s = core.state(), cps = [], moved = 0, notes = [];
    Object.keys(moves).forEach(function (k) { if (typeOf(k) === "cp") { var p = PTD.cpoints.pos(idOf(k)); if (p) cps.push({ id: idOf(k), d: moves[k], start: p }); } });
    Object.keys(moves).forEach(function (k) {
      var d = moves[k], t = typeOf(k), id = idOf(k);
      if (!d.dx && !d.dy) return;
      if (t === "text") { var l = layerOf(k); if (l) { l.x = r2(l.x + d.dx); l.y = r2(l.y + d.dy); moved++; } }
      else if (t === "band") { s.band.x = r2(s.band.x + d.dx); s.band.y = r2(s.band.y + d.dy); moved++; }
      else if (t === "table") {
        var tb = PTD.tables.get(id); if (!tb) return;
        if (tb.locked) { notes.push(tb.name + " is locked"); return; }
        tb.x = r2(tb.x + d.dx); tb.y = r2(tb.y + d.dy); moved++;
      } else if (t === "guide") {
        var g = PTD.guides.get(id); if (!g) return;
        if (g.locked) { notes.push(g.name + " is locked"); return; }
        var pos = PTD.guides.abs(g) + (g.axis === "x" ? d.dx : d.dy), res = PTD.guides.resolve({ id: g.id, axis: g.axis, pos: pos });
        if (!res.ok) { notes.push(PTD.guides.conflictText(res)); return; }
        PTD.guides.setAbs(g, r2(pos)); moved++;
      }
    });
    /* control points last: they get their absolute place, whatever happened to their parents */
    cps.forEach(function (c) {
      if (!c.d.dx && !c.d.dy) return;
      var cp = PTD.cpoints.get(c.id); if (!cp) return;
      PTD.cpoints.setWorld(cp, c.start.x + c.d.dx, c.start.y + c.d.dy); moved++;
    });
    S.preview = null; S.hover = null;
    core.renderPanels(); core.renderStage(); core.syncInputs();
    if (moved) core.save();
    core.say((moved ? (what || "Aligned") + " " + moved + " object" + (moved > 1 ? "s" : "") + "." : "Nothing moved: already aligned.") + (notes.length ? " " + notes.join("; ") + "." : ""));
    return moved;
  };

  /* ---------- the menu: target, quick buttons, distribute ---------- */
  A.targetButton = function () {
    var core = C(), u = core.ui, seed = null;
    if (u.tool !== "align") { seed = normalItems(); core.setTool("align"); S.items = seed; }
    if (!S.items.length) { core.say("Select the target objects first (click, or drag an area; Shift adds, Ctrl removes), then press Set alignment target."); core.renderStage(); return; }
    var T = A.makeTarget(S.items);
    if (!T) { core.say("These objects have no place to aim at (hidden or missing). Select something else."); return; }
    S.target = T; S.items = []; S.preview = null; S.hover = null;
    core.say("Target set: " + T.label + ". Now select the objects to move, then click a handle of their box (or drag it onto the target). Alt moves them one by one, Esc ends.");
    core.renderStage();
  };
  A.clearTarget = function () {
    var core = C(); S.target = null; S.items = []; S.preview = null; S.hover = null;
    core.say(core.ui.tool === "align" ? "Target cleared. Select the target objects and press Set alignment target." : "No target is set.");
    core.renderStage();
  };
  function axisCoord(it, axis, f) {
    var b = it.b;
    if (b.kind === "line") return (axis === "x") === (b.line === "v") ? b.pos : null;
    return axis === "x" ? b.x0 + (b.x1 - b.x0) * f : b.y0 + (b.y1 - b.y0) * f;
  }
  /* Moves the objects along one axis. f: which coordinate of each object (0 low edge, 0.5 centre, 1 high edge);
   * tcoord: where it must go. group: the box around all moves as one (Alt: each by itself). */
  function moveAxis(list, axis, f, tcoord, group, what) {
    var moves = {}, gb = unionBox(list), gcoord = null;
    if (group && gb) gcoord = axis === "x" ? gb.x0 + (gb.x1 - gb.x0) * f : gb.y0 + (gb.y1 - gb.y0) * f; else group = false;
    list.forEach(function (it) {
      var own = axisCoord(it, axis, f);
      if (own === null) return;   /* a guide that cannot move along this axis */
      var d = group ? tcoord - gcoord : tcoord - own;
      moves[it.k] = axis === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    });
    A.apply(moves, what);
  }
  /* The coordinate of the target along an axis: a box or curve edge or centre, a point, or a line across the axis. null if none. */
  function targetCoord(T, axis, f) {
    if (T.kind === "box" || T.kind === "curve") return axis === "x" ? T.box.x0 + (T.box.x1 - T.box.x0) * f : T.box.y0 + (T.box.y1 - T.box.y0) * f;
    if (T.kind === "point") return axis === "x" ? T.x : T.y;
    return (axis === "x") === (T.dir === "v") ? T.pos : null;
  }
  function noExtent(T, axis) { return "The target is a " + (T.dir === "v" ? "vertical" : "horizontal") + " line: it has no " + (axis === "x" ? "horizontal" : "vertical") + " extent to align to."; }
  /* what: L C R T M B */
  A.quick = function (what, alt) {
    var core = C(), keys = currentKeys(), list = movables(keys), axis = what === "L" || what === "C" || what === "R" ? "x" : "y";
    var f = { L: 0, C: 0.5, R: 1, T: 0, M: 0.5, B: 1 }[what];
    if (list.length < 1 || (!S.target && list.length < 2)) { core.say(S.target ? "Select the objects to align first." : "Select two or more objects to align (or set a target first)."); return; }
    if (S.target && core.ui.tool === "align") {
      var tcoord = targetCoord(S.target, axis, f);
      if (tcoord === null) { core.say(noExtent(S.target, axis)); return; }
      moveAxis(list, axis, f, tcoord, !alt, "Aligned");
    } else {
      /* no target: every object to the box around the selection */
      var lo = Infinity, hi = -Infinity;
      list.forEach(function (it) { var a = axisCoord(it, axis, 0), b = axisCoord(it, axis, 1); if (a !== null) lo = Math.min(lo, a); if (b !== null) hi = Math.max(hi, b); });
      moveAxis(list, axis, f, lo + (hi - lo) * f, false, "Aligned");
    }
  };
  /* Next to the target: dir is "nl" (left of it), "nr" (right of it), "na" (above it), "nb" (below it). The objects touch the target. */
  A.nextTo = function (dir, alt) {
    var core = C(), list = movables(currentKeys()), T = S.target;
    if (!T || core.ui.tool !== "align") { core.say("Set an alignment target first, then select the objects to place next to it."); return; }
    if (!list.length) { core.say("Select the objects to place next to the target first."); return; }
    var axis = dir === "nl" || dir === "nr" ? "x" : "y", f = dir === "nl" || dir === "na" ? 1 : 0;   /* left of: our right edge; right of: our left edge */
    var tcoord = targetCoord(T, axis, f === 1 ? 0 : 1);
    if (tcoord === null) { core.say(noExtent(T, axis)); return; }
    moveAxis(list, axis, f, tcoord, !alt, "Placed");
  };
  /* Distribute: equal gaps between the boxes along the axis; the two outermost stay. */
  A.distribute = function (axis) {
    var core = C(), list = movables(currentKeys()).filter(function (x) { return x.b.kind !== "line"; });
    if (list.length < 3) { core.say("Distribute needs three or more objects. Select them first."); return; }
    var lo = axis === "x" ? "x0" : "y0", hi = axis === "x" ? "x1" : "y1";
    list.sort(function (a, b) { return (a.b[lo] + a.b[hi]) - (b.b[lo] + b.b[hi]); });
    var first = list[0].b[lo], last = list[list.length - 1].b[hi], sum = 0;
    list.forEach(function (it) { sum += it.b[hi] - it.b[lo]; });
    var gap = (last - first - sum) / (list.length - 1), pos = first, moves = {};
    list.forEach(function (it) {
      var d = pos - it.b[lo]; moves[it.k] = axis === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d };
      pos += it.b[hi] - it.b[lo] + gap;
    });
    A.apply(moves, "Distributed");
  };

  /* ---------- the mode ---------- */
  A.exit = function () { S.items = []; S.target = null; S.preview = null; S.hover = null; S.drag = false; S.desc = null; S.p = null; S.mod = ""; S.cancelled = false; };
  A.state = function () { return { tool: C().ui.tool, items: S.items.slice(), target: S.target ? JSON.parse(JSON.stringify(S.target)) : null, hasPreview: !!S.preview, drag: S.drag, mod: S.mod }; };
  A.select = function (keys) { S.items = keys.slice(); C().renderStage(); };   /* used by the tests and the help examples */
  A.plan = function (hd, alt) { return S.target ? planMove(S.target, S.items, hd, defaultDesc(S.target, hd), !!alt) : null; };

  function handleSet(b, z) {
    var px = Math.max(b.x1 - b.x0, b.y1 - b.y0) * z;
    if (px < 16) return [[0.5, 0.5]];
    if (px < 40) return [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]];
    return HANDLES;
  }
  A.handles = function () { var gb = unionBox(movables(S.items)); return gb ? handleSet(gb, C().ui.view.z).map(function (hd) { return { f: hd, p: handlePt(gb, hd[0], hd[1]) }; }) : []; };
  function handleAt(gb, q, z) {
    var best = null;
    handleSet(gb, z).forEach(function (hd) {
      var p = handlePt(gb, hd[0], hd[1]), d = Math.hypot((p.x - q.x) * z, (p.y - q.y) * z);
      if (d <= 12 && (!best || d < best.d)) best = { d: d, hd: hd };
    });
    return best ? best.hd : null;
  }
  function marquee(e, p) {
    var core = C(), u = core.ui, mode = e.ctrlKey || e.metaKey ? "rem" : e.shiftKey ? "add" : "set", base = S.items.slice();
    if (mode === "set") S.items = [];
    core.startDrag(e, {
      op: "align-marquee", ownEsc: true,
      readout: function () { return u.marquee ? core.fmtLen(u.marquee.w) + " x " + core.fmtLen(u.marquee.h) + "   " + S.items.length + " selected" : ""; },
      move: function (q) {
        var x0 = Math.min(p.x, q.x), y0 = Math.min(p.y, q.y), w = Math.abs(q.x - p.x), h = Math.abs(q.y - p.y);
        u.marquee = { x: x0, y: y0, w: w, h: h };
        var hit = itemsInRect(x0, y0, w, h);
        if (mode === "set") S.items = hit;
        else if (mode === "add") S.items = base.concat(hit.filter(function (k) { return base.indexOf(k) < 0; }));
        else S.items = base.filter(function (k) { return hit.indexOf(k) < 0; });
        core.renderStage();
      },
      up: function () { u.marquee = null; S.preview = null; core.renderStage(); }
    });
  }
  function startHandleDrag(e, hd) {
    var core = C(), u = core.ui, cx = e.clientX, cy = e.clientY, moved = false, T = S.target;
    S.drag = true; S.hover = hd; S.cancelled = false;
    core.startDrag(e, {
      op: "align-handle", ownEsc: true,
      readout: function () {
        var pv = S.preview, ks = pv ? Object.keys(pv.moves) : [];
        if (!ks.length) return "nothing to drop on";
        var m = pv.moves[ks[0]];
        return "dx " + core.fmtLen(m.dx) + "   dy " + core.fmtLen(m.dy) + (ks.length > 1 && S.alt ? "   (each by itself)" : "");
      },
      move: function (q, ev) {
        if (S.cancelled) return;
        if (!moved && Math.hypot(ev.clientX - cx, ev.clientY - cy) < 4) return;
        moved = true; S.lastQ = q; S.alt = ev.altKey;
        S.desc = resolveDrop(T, q, 12 / u.view.z);
        S.preview = S.desc ? planMove(T, S.items, hd, S.desc, ev.altKey) : null;
        core.renderStage();
      },
      up: function (ev) {
        S.drag = false;
        if (S.cancelled) { S.cancelled = false; S.preview = null; S.desc = null; S.hover = null; core.renderStage(); return; }
        if (u.tool !== "align" || !S.target) return;
        var plan = moved ? S.preview : planMove(T, S.items, hd, defaultDesc(T, hd), ev.altKey);
        S.preview = null; S.desc = null; S.hover = null;
        if (plan) A.apply(plan.moves, "Aligned");
        else { core.say(moved ? "Dropped on nothing: cancelled, nothing moved." : "There is nothing to align to."); core.renderStage(); }
      }
    });
  }
  /* pointer: a press in the align mode */
  A.down = function (p, e) {
    var core = C(), u = core.ui, gb = S.target ? unionBox(movables(S.items)) : null, hd = gb ? handleAt(gb, p, u.view.z) : null;
    if (hd) { startHandleDrag(e, hd); return; }
    var key = A.keyFromEvent(e);
    if (key) { applySel(key, e); S.preview = null; core.renderStage(); return; }
    marquee(e, p);
  };
  /* pointer: hover over a handle shows the arrow and the ghosts of a click */
  A.move = function (p, e) {
    var core = C(), u = core.ui, mod = e.ctrlKey || e.metaKey ? "rem" : e.shiftKey ? "add" : "";
    var modChanged = mod !== S.mod;
    S.p = p; S.mod = mod;
    if (S.drag) return;
    if (!S.target) { if (mod || modChanged) core.renderStage(); return; }
    var gb = unionBox(movables(S.items)), hd = gb ? handleAt(gb, p, u.view.z) : null;
    var key = hd ? hd.join(",") : "", old = S.hover ? S.hover.join(",") : "";
    if (key === old && !!e.altKey === S.alt && !mod && !modChanged) return;
    S.alt = !!e.altKey; S.hover = hd;
    S.preview = hd ? planMove(S.target, S.items, hd, defaultDesc(S.target, hd), S.alt) : null;
    core.renderStage();
  };
  function refreshAlt(down) {
    if (C().ui.tool !== "align" || !S.target) return;
    if (!!down === S.alt) return;
    S.alt = !!down;
    if (S.drag && S.lastQ && S.hover) { S.preview = S.desc ? planMove(S.target, S.items, S.hover, S.desc, S.alt) : null; C().renderStage(); }
    else if (S.hover) { S.preview = planMove(S.target, S.items, S.hover, defaultDesc(S.target, S.hover), S.alt); C().renderStage(); }
  }
  function inMode() { return !!(PTD.core && PTD.core.ui && PTD.core.ui.tool === "align"); }
  function modOf(e) { return e.ctrlKey || e.metaKey ? "rem" : e.shiftKey ? "add" : ""; }
  function modKey(e) { if (!inMode() || !S.p || (e.key !== "Shift" && e.key !== "Control" && e.key !== "Meta")) return; var m = modOf(e); if (m !== S.mod) { S.mod = m; C().renderStage(); } }
  document.addEventListener("keydown", modKey);
  document.addEventListener("keyup", modKey);
  /* Esc during a drag cancels the drag only (a second Esc ends the align mode) */
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && inMode() && S.drag) {
      e.preventDefault(); e.stopPropagation();
      S.cancelled = true; S.preview = null; S.desc = null; C().say("Drag cancelled, nothing moved."); C().renderStage();
    }
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Alt" && inMode()) { e.preventDefault(); refreshAlt(true); } });
  document.addEventListener("keyup", function (e) { if (e.key === "Alt" && inMode()) { e.preventDefault(); refreshAlt(false); } });

  /* ---------- the tooltips of the menu say why a button cannot act now ---------- */
  function reasonFor(what) {
    var core = C(), inA = core.ui.tool === "align", list = movables(currentKeys()), T = S.target;
    if (what === "target") return "";
    if (what === "clear") return T ? "" : "there is no target";
    if (what === "distx" || what === "disty") return list.filter(function (x) { return x.b.kind !== "line"; }).length >= 3 ? "" : "select three or more objects";
    if (what === "nl" || what === "nr" || what === "na" || what === "nb") {
      if (!T || !inA) return "set an alignment target first";
      if (!list.length) return "select the objects to place";
      return targetCoord(T, what === "nl" || what === "nr" ? "x" : "y", 0) === null ? "the target line has no extent in that direction" : "";
    }
    var axis = what === "L" || what === "C" || what === "R" ? "x" : "y";
    if (T && inA) {
      if (!list.length) return "select the objects to align";
      return targetCoord(T, axis, 0) === null ? "the target line has no " + (axis === "x" ? "horizontal" : "vertical") + " extent" : "";
    }
    return list.length >= 2 ? "" : "select two or more objects, or set a target first";
  }
  A.reason = reasonFor;
  function menuTips() {
    var m = document.getElementById("alignMenu"); if (!m || !PTD.core || !PTD.core.state) return;
    m.querySelectorAll("[data-align]").forEach(function (b) {
      if (!b.dataset.base) b.dataset.base = b.getAttribute("title") || "";
      var r = reasonFor(b.dataset.align);
      b.setAttribute("title", b.dataset.base + (r ? " (Not available now: " + r + ".)" : ""));
      b.classList.toggle("dim", !!r);
    });
  }

  /* ---------- drawing ---------- */
  A.render = function (parent, ctx) {
    var core = C(), u = core.ui, el = core.el, z = ctx.z, w = ctx.world, btn = document.getElementById("alignBtn");
    if (btn) btn.classList.toggle("on", u.tool === "align");
    menuTips();
    if (u.tool !== "align") return;
    var g = el("g", { "pointer-events": "none" }, parent), T = S.target;
    function line(a, b, c, d, col, wd, dash) { return el("line", { x1: a, y1: b, x2: c, y2: d, stroke: col, "stroke-width": wd, "stroke-dasharray": dash || "none", "vector-effect": "non-scaling-stroke" }, g); }
    if (T) {
      if (T.kind === "box") {
        el("rect", { x: T.box.x0, y: T.box.y0, width: T.box.x1 - T.box.x0, height: T.box.y1 - T.box.y0, fill: "rgba(255,163,26,0.10)", stroke: ORANGE, "stroke-width": 2.5, "vector-effect": "non-scaling-stroke" }, g);
        var cxm = (T.box.x0 + T.box.x1) / 2, cym = (T.box.y0 + T.box.y1) / 2;
        line(cxm - 7 / z, cym, cxm + 7 / z, cym, ORANGE, 1.5); line(cxm, cym - 7 / z, cxm, cym + 7 / z, ORANGE, 1.5);
      } else if (T.kind === "point") {
        el("circle", { cx: T.x, cy: T.y, r: 8 / z, fill: "rgba(255,163,26,0.15)", stroke: ORANGE, "stroke-width": 2.5, "vector-effect": "non-scaling-stroke" }, g);
        line(T.x - 12 / z, T.y, T.x + 12 / z, T.y, ORANGE, 1.5); line(T.x, T.y - 12 / z, T.x, T.y + 12 / z, ORANGE, 1.5);
      } else if (T.kind === "curve") {
        el("polyline", { points: T.pts.concat(T.closed ? [T.pts[0]] : []).map(function (q) { return q[0] + "," + q[1]; }).join(" "), fill: "none", stroke: ORANGE, "stroke-width": 3, "vector-effect": "non-scaling-stroke" }, g);
      } else if (T.dir === "v") line(T.pos, w.y0, T.pos, w.y1, ORANGE, 3);
      else line(w.x0, T.pos, w.x1, T.pos, ORANGE, 3);
    }
    var list = boxesOf(S.items), dropped = S.items.length - list.length;
    if (dropped) S.items = list.map(function (x) { return x.k; });
    list.forEach(function (it) {
      var b = it.b;
      if (b.kind === "line") { if (b.line === "v") line(b.pos, w.y0, b.pos, w.y1, CYAN, 2.5, "6 4"); else line(w.x0, b.pos, w.x1, b.pos, CYAN, 2.5, "6 4"); }
      else if (b.kind === "point") { el("circle", { cx: b.x0, cy: b.y0, r: 9 / z, fill: "none", stroke: CYAN, "stroke-width": 1.5, "stroke-dasharray": "3 3", "vector-effect": "non-scaling-stroke" }, g); }
      else if (b.kind === "curve") el("polyline", { points: b.pts.concat(b.closed ? [b.pts[0]] : []).map(function (q) { return q[0] + "," + q[1]; }).join(" "), fill: "none", stroke: CYAN, "stroke-width": 2.5, "stroke-dasharray": "6 4", "vector-effect": "non-scaling-stroke" }, g);
      else el("rect", { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, fill: "none", stroke: CYAN, "stroke-width": 1, "stroke-dasharray": "4 3", "vector-effect": "non-scaling-stroke" }, g);
    });
    var gb = unionBox(list.filter(function (x) { return typeOf(x.k) !== "bet"; }));
    if (gb) {
      el("rect", { x: gb.x0, y: gb.y0, width: gb.x1 - gb.x0, height: gb.y1 - gb.y0, fill: "none", stroke: CYAN, "stroke-width": 1.8, "vector-effect": "non-scaling-stroke" }, g);
      if (T) handleSet(gb, z).forEach(function (hd) {
        var p = handlePt(gb, hd[0], hd[1]), on = S.hover && S.hover[0] === hd[0] && S.hover[1] === hd[1], s = 9 / z;
        el("rect", { x: p.x - s / 2, y: p.y - s / 2, width: s, height: s, fill: on ? YELLOW : "#ffffff", stroke: on ? "#000000" : CYAN, "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }, g);
      });
    }
    if (S.p && S.mod) {   /* a plus (Shift adds) or a minus (Ctrl removes) next to the pointer */
      var mk = el("g", { transform: "translate(" + (S.p.x + 14 / z) + " " + (S.p.y - 14 / z) + ")" }, g);
      el("circle", { r: 8 / z, fill: "#0d2b22", stroke: S.mod === "add" ? "#7cff3d" : "#ff6b6b", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }, mk);
      el("path", { d: "M " + (-4.5 / z) + " 0 H " + (4.5 / z) + (S.mod === "add" ? " M 0 " + (-4.5 / z) + " V " + (4.5 / z) : ""), fill: "none", stroke: S.mod === "add" ? "#7cff3d" : "#ff6b6b", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }, mk);
    }
    var pv = S.preview, calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (pv) {
      pv.ghosts.forEach(function (gh) {
        var b = gh.b, n;
        if (b.kind === "line") n = b.line === "v" ? line(b.pos + gh.dx, w.y0, b.pos + gh.dx, w.y1, YELLOW, 2.5, "6 4") : line(w.x0, b.pos + gh.dy, w.x1, b.pos + gh.dy, YELLOW, 2.5, "6 4");
        else if (b.kind === "point") n = el("circle", { cx: b.x0 + gh.dx, cy: b.y0 + gh.dy, r: 8 / z, fill: "rgba(255,225,77,0.3)", stroke: YELLOW, "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }, g);
        else n = el("rect", { x: b.x0 + gh.dx, y: b.y0 + gh.dy, width: b.x1 - b.x0, height: b.y1 - b.y0, fill: "rgba(255,225,77,0.22)", stroke: YELLOW, "stroke-width": 1.5, "stroke-dasharray": "5 3", "vector-effect": "non-scaling-stroke" }, g);
        if (!calm) { var an = document.createElementNS("http://www.w3.org/2000/svg", "animate"); an.setAttribute("attributeName", "opacity"); an.setAttribute("values", "0.3;1;0.3"); an.setAttribute("dur", "1.4s"); an.setAttribute("repeatCount", "indefinite"); n.appendChild(an); }
      });
      pv.arrows.forEach(function (a) {
        if (Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) * z < 2) return;
        line(a.from.x, a.from.y, a.to.x, a.to.y, YELLOW, 2);
        var ang = Math.atan2(a.to.y - a.from.y, a.to.x - a.from.x), hl = 11 / z, hw = 5 / z, bx = a.to.x - Math.cos(ang) * hl, by = a.to.y - Math.sin(ang) * hl;
        el("polygon", { points: a.to.x + "," + a.to.y + " " + (bx - Math.sin(ang) * hw) + "," + (by + Math.cos(ang) * hw) + " " + (bx + Math.sin(ang) * hw) + "," + (by - Math.cos(ang) * hw), fill: YELLOW }, g);
      });
    }
  };

  /* ---------- wiring of the toolbar menu ---------- */
  var wrap = document.getElementById("alignWrap"), btnA = document.getElementById("alignBtn"), menu = document.getElementById("alignMenu");
  function menuOpen(open) { if (!wrap) return; if (open) menuTips(); wrap.classList.toggle("open", open); wrap.classList.remove("shut"); btnA.setAttribute("aria-expanded", open ? "true" : "false"); }
  var tgtBtn = document.getElementById("alignTargetBtn");
  if (tgtBtn) tgtBtn.onclick = function () { A.targetButton(); };
  if (wrap && btnA && menu) {
    btnA.onclick = function () { menuOpen(!wrap.classList.contains("open")); };
    wrap.addEventListener("mouseleave", function () { wrap.classList.remove("shut"); });
    menu.addEventListener("click", function (e) {
      var b = e.target.closest("[data-align]"); if (!b) return;
      var a = b.dataset.align;
      menuOpen(false); wrap.classList.add("shut");
      if (a === "target") A.targetButton();
      else if (a === "clear") A.clearTarget();
      else if (a === "distx") A.distribute("x");
      else if (a === "disty") A.distribute("y");
      else if (a === "nl" || a === "nr" || a === "na" || a === "nb") A.nextTo(a, e.altKey);
      else A.quick(a, e.altKey);
    });
    document.addEventListener("mousedown", function (e) { if (!wrap.contains(e.target)) menuOpen(false); });
    wrap.addEventListener("mouseenter", menuTips);
  }
})(window.PTD = window.PTD || {});
