/* Paths and patterns: the browser part (REQ-046, REQ-047, REQ-048). The maths is in paths.js.
 * - The Paths section of the Artwork tab lists the paths (invisible lines) and edits them.
 * - A pattern is a layer (glyph-like, flag `pattern`, recipe `pattern`) whose shape is cached in `frozen` (millimetres) and made again by
 *   refresh() whenever its recipe, its path or the objects the path follows have changed. */
(function (PTD) {
  "use strict";
  var U = {}, cache = {}, status = {}, busy = false;
  function C() { return PTD.core; }
  function S() { return C().state(); }
  function esc(t) { return C().esc(t); }
  function say(t) { C().say(t); }
  function pathOf(id) { return (S().paths || []).filter(function (p) { return p.id === id; })[0]; }
  function patterns() { return S().layers.filter(function (l) { return l.pattern; }); }
  function layerByUid(u) { return S().layers.filter(function (l) { return l.uid === u || l.id === u; })[0]; }
  function AO() { return C().artOrigin(); }

  /* ---------- the environment of the maths ---------- */
  function itemLayers(items) {
    var out = [], seen = {};
    (items || []).forEach(function (it) {
      var ls = it.g ? PTD.groups.layersIn(S(), it.g) : [layerByUid(it.l)].filter(Boolean);
      ls.forEach(function (l) { if (!seen[l.id]) { seen[l.id] = 1; out.push(l); } });
    });
    return out;
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
    return env;
  }
  function srcSig(l) {
    var f = l.frozen;
    return [l.uid, l.x, l.y, l.rot, l.size, l.text, l.font, l.ls, l.weight, l.italic, l.upper, l.exact, l.outline, l.outlineW, l.box && [l.box.w, l.box.h, l.box.dy], f && [f.d.length, f.x0, f.y0, f.x1, f.y1, f.d.slice(0, 40), f.d.slice(-40)]];
  }
  function sigOf(l, p) {
    var parts = [l.pattern, p];
    if (p && p.kind === "objects") parts.push(itemLayers(p.items).map(srcSig));
    if (p && p.kind === "table") parts.push(S().tables.map(function (t) { return [t.id, t.nodes, t.x, t.y, t.rot, t.railW, t.wrap, t.bet]; }), AO());
    if (p) parts.push(AO());
    return JSON.stringify(parts);
  }
  /* Makes the shape of a pattern layer again when something it depends on has changed. `visiting` guards against cycles. */
  function ensure(l, visiting) {
    var key = l.uid || l.id, p = pathOf(l.pattern.path);
    if (visiting[key]) { status[key] = "Cycle: this pattern depends on itself. Change the path or the objects it follows."; return; }
    visiting[key] = 1;
    var sig = sigOf(l, p);
    if (cache[key] === sig) { delete visiting[key]; return; }
    var env = makeEnv(visiting); env.path = p;
    var res;
    try { res = PTD.paths.build(l.pattern, env); } catch (e) { res = { shape: null, err: "The pattern could not be made: " + (e && e.message || "error") }; }
    if (res.shape) l.frozen = res.shape;
    status[key] = (res.err || (!res.shape ? "The pattern is empty." : "")) + (env.rough && res.shape ? (res.err ? " " : "") + "Text outlines are traced (rough); load the font file for exact rings." : "");
    if (!env.pending) cache[key] = sig;
    delete visiting[key];
  }
  U.refresh = function () {
    if (busy) return; busy = true;
    try { patterns().forEach(function (l) { ensure(l, {}); }); } finally { busy = false; }
  };
  U.status = function (l) { return status[l.uid || l.id] || ""; };
  U.forget = function () { cache = {}; };

  /* ---------- dependencies and the cycle check ---------- */
  function deps() {
    return {
      layersOfPath: function (id) { var p = pathOf(id); return p && p.kind === "objects" ? itemLayers(p.items).map(function (l) { return l.uid || l.id; }) : []; },
      pathOfLayer: function (u) { var l = layerByUid(u); return l && l.pattern ? l.pattern.path : ""; },
      isPattern: function (u) { var l = layerByUid(u); return !!(l && l.pattern); }
    };
  }
  function cycleMsg() {
    var d = deps(), bad = patterns().filter(function (l) { return l.pattern.path && PTD.paths.dependsOn(l.pattern.path, l.uid || l.id, d); })[0];
    if (!bad) return "";
    var p = pathOf(bad.pattern.path);
    return "That would make a loop: pattern “" + bad.text + "” → path “" + (p ? p.name : "?") + "” → pattern “" + bad.text + "”. The change was not made.";
  }
  /* Runs a change; when it makes a cycle, everything is put back and the message says so. */
  function guarded(change) {
    var s = S(), before = JSON.stringify([s.paths, patterns().map(function (l) { return [l.id, l.pattern]; })]);
    change();
    var m = cycleMsg();
    if (m) {
      var b = JSON.parse(before); s.paths = b[0];
      b[1].forEach(function (x) { var l = s.layers.filter(function (q) { return q.id === x[0]; })[0]; if (l) l.pattern = x[1]; });
      say(m); C().renderPanels(); C().renderStage(); return false;
    }
    return true;
  }
  function commit(tag) { U.forget(); C().save(tag + ":" + Date.now()); C().renderPanels(); C().renderStage(); }

  /* ---------- editing ---------- */
  function setByKey(o, key, raw, el) {
    var cur = o[key];
    if (el && el.type === "checkbox") o[key] = el.checked;
    else if (typeof cur === "number") { var v = parseFloat(raw); if (isFinite(v)) o[key] = v; }
    else if (typeof cur === "boolean") o[key] = raw === "true" || raw === true;
    else o[key] = raw;
  }
  function onField(el) {
    var a = el.dataset.pu.split("|"), s = S();
    if (a[0] === "path") {
      var p = pathOf(a[1]); if (!p) return;
      if (a[2] === "node") { var q = p.pts[+a[3]]; if (q) setByKey(q, a[4], el.value); }
      else setByKey(p, a[2], el.value, el);
      if (a[2] === "reverse" || a[2] === "closed") { /* checkbox */ }
      guarded(function () { s.paths[s.paths.indexOf(p)] = PTD.paths.normPath(p, p.id); });
      commit("path");
    } else if (a[0] === "pat") {
      var l = layerByUid(a[1]); if (!l || !l.pattern) return;
      guarded(function () { l.pattern.path = el.value; });
      commit("patpath");
    } else if (a[0] === "gen") {
      var l2 = layerByUid(a[1]); if (!l2 || !l2.pattern) return;
      var g = l2.pattern.stack[+a[2]]; if (!g) return;
      setByKey(g, a[3], el.value, el);
      l2.pattern = PTD.paths.normRecipe(l2.pattern);
      commit("gen");
    }
  }
  function addPath(kind) {
    var s = S(), p = PTD.paths.defaultPath(kind), a = AO(), v = C().ui.view || { cx: 0, cy: 0 };
    var cx = Math.round(v.cx - a.x), cy = Math.round(v.cy - a.y);
    if (p.cx != null) { p.cx = cx; p.cy = cy; }
    if (p.pts) p.pts.forEach(function (q) { q.x += cx; q.y += cy; });
    if (kind === "table") p.table = (s.tables[0] && s.tables[0].id) || "";
    var id = "pa1", n = 1; while (pathOf(id)) id = "pa" + (++n);
    p.name = (PTD.paths.KINDS.filter(function (k) { return k[0] === kind; })[0] || ["", "Path"])[1] + " " + n;
    s.paths = s.paths || []; s.paths.push(PTD.paths.normPath(p, id));
    C().ui.pathSel = id; commit("pathadd"); return id;
  }
  function addPattern() {
    var s = S(), pid = C().ui.pathSel && pathOf(C().ui.pathSel) ? C().ui.pathSel : (s.paths && s.paths[0] ? s.paths[0].id : "");
    if (!pid) pid = addPath("circle");
    var n = patterns().length + 1;
    var l = C().mkLayer("Pattern " + n, "Mea Culpa", 100, 0, 0, 0, 0, true, false);
    l.pattern = PTD.paths.normRecipe({ path: pid }); l.glyph = true; l.exact = false; l.outline = false;
    l.frozen = { d: "M0 0Z", x0: 0, y0: 0, x1: 1, y1: 1 }; l.x = 0; l.y = 0;
    l.id = "l" + (s.layers.length + 1); s.layers.push(l); s.selected = l.id; C().ui.open[l.id] = true;
    C().save("pattern:" + Date.now()); U.refresh(); C().renderPanels(); C().renderStage();
    return l;
  }
  function useSelected(id) {
    var p = pathOf(id); if (!p || p.kind !== "objects") return;
    var ids = C().selectedIds().map(C().getLayer).filter(Boolean), items = [];
    var G = PTD.groups, cg = C().curGroup && C().curGroup();
    if (cg) items.push({ g: cg.uid });
    else ids.forEach(function (l) { if (l.uid) items.push({ l: l.uid }); });
    if (!items.length) { say("Select the texts, glyphs or patterns first, then press this button."); return; }
    guarded(function () { p.items = items; });
    commit("pathobj");
  }
  function freezePath(id) {
    var p = pathOf(id); if (!p || p.kind !== "objects") return;
    var env = makeEnv(), res = PTD.paths.loops(Object.assign({}, p, { halo: p.halo === "frozen" ? "ink" : p.halo }), env);
    if (!res.loops.length) { say("Nothing to freeze: " + (res.err || "the path has no loops") + "."); return; }
    p.frozen = res.loops.map(function (l) { return { closed: l.closed, pts: l.pts.map(function (q) { return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; }) }; });
    p.halo = "frozen"; commit("pathfreeze");
    say("The path is frozen: it no longer follows the objects.");
  }
  function click(b) {
    var act = b.dataset.pa, id = b.dataset.id, s = S();
    if (act === "padd") addPath(document.getElementById("pathKind").value);
    else if (act === "pattern") addPattern();
    else if (act === "pdel") {
      var users = patterns().filter(function (l) { return l.pattern.path === id; });
      if (users.length) { say("The path is used by " + users.length + " pattern" + (users.length > 1 ? "s" : "") + ". Choose another path for them first."); return; }
      s.paths = s.paths.filter(function (p) { return p.id !== id; }); commit("pathdel");
    } else if (act === "psel") { C().ui.pathSel = id; U.paint(); }
    else if (act === "pobj") useSelected(id);
    else if (act === "pfreeze") freezePath(id);
    else if (act === "pnode+" || act === "pnode-") {
      var p = pathOf(id); if (!p || !p.pts) return;
      if (act === "pnode+") { var last = p.pts[p.pts.length - 1], prev = p.pts[p.pts.length - 2] || last; p.pts.push({ x: Math.round(last.x + (last.x - prev.x || 100)), y: Math.round(last.y + (last.y - prev.y)), r: 0 }); }
      else if (p.pts.length > 2) p.pts.splice(+b.dataset.idx, 1);
      commit("pnode");
    } else if (act === "grev") { var pp = pathOf(id); pp.reverse = !pp.reverse; commit("prev"); }
    else if (act === "gadd") {
      var l = layerByUid(b.dataset.uid), sel = b.parentNode.querySelector("select");
      if (l && l.pattern) { l.pattern.stack.push(PTD.paths.defaultGen(sel.value)); commit("gadd"); }
    } else if (act === "gup" || act === "gdown" || act === "gdel") {
      var l2 = layerByUid(b.dataset.uid), i = +b.dataset.idx; if (!l2 || !l2.pattern) return;
      var st = l2.pattern.stack;
      if (act === "gdel") { if (st.length > 1) st.splice(i, 1); else { say("A pattern needs at least one layer."); return; } }
      else { var j = act === "gup" ? i + 1 : i - 1; if (j < 0 || j >= st.length) return; var t = st[i]; st[i] = st[j]; st[j] = t; }
      commit("gmove");
    }
  }

  /* ---------- markup ---------- */
  function opts(list, cur) { return list.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === cur ? " selected" : "") + ">" + esc(k[1]) + "</option>"; }).join(""); }
  function fld(label, key, val, tip, step, extra) {
    return '<label class="fld" title="' + esc(tip) + '"><span>' + esc(label) + '</span><input type="number" step="' + (step || "any") + '" data-pu="' + key + '" value="' + val + '" title="' + esc(tip) + '"' + (extra || "") + "></label>";
  }
  function txt(label, key, val, tip) { return '<label class="fld" title="' + esc(tip) + '"><span>' + esc(label) + '</span><input type="text" data-pu="' + key + '" value="' + esc(val) + '" autocomplete="off" title="' + esc(tip) + '"></label>'; }
  function sel(label, key, list, cur, tip) { return '<label class="fld" title="' + esc(tip) + '"><span>' + esc(label) + '</span><select data-pu="' + key + '" title="' + esc(tip) + '">' + opts(list, cur) + "</select></label>"; }
  function chk(label, key, on, tip) { return '<label class="chk" title="' + esc(tip) + '"><input type="checkbox" data-pu="' + key + '"' + (on ? " checked" : "") + ' title="' + esc(tip) + '"><span>' + esc(label) + "</span></label>"; }
  function btn(label, act, attrs, tip) { return '<button class="btn" type="button" data-pa="' + act + '" ' + (attrs || "") + ' title="' + esc(tip) + '">' + esc(label) + "</button>"; }
  function r1(v) { return Math.round(v * 100) / 100; }

  function pathCard(p) {
    var k = "path|" + p.id + "|", h = "";
    var users = patterns().filter(function (l) { return l.pattern.path === p.id; }).length;
    h += '<div class="panel pathcard' + (C().ui.pathSel === p.id ? " on" : "") + '" data-pid="' + p.id + '"><div class="body">';
    h += '<div class="btnrow">' + txt("Name", k + "name", p.name, "The name of the path.") + btn("Use", "psel", 'data-id="' + p.id + '"', "Make this the path that + Add pattern uses.") + btn("✕", "pdel", 'data-id="' + p.id + '"', "Delete this path (only when no pattern uses it).") + "</div>";
    h += '<p class="small">' + esc((PTD.paths.KINDS.filter(function (q) { return q[0] === p.kind; })[0] || ["", ""])[1]) + (users ? "; used by " + users + " pattern" + (users > 1 ? "s" : "") : "; not used yet") + "</p>";
    if (p.kind === "circle" || p.kind === "polygon") {
      h += '<div class="row2">' + fld("Centre X (mm)", k + "cx", r1(p.cx), "Centre of the path, millimetres from the artwork origin.") + fld("Centre Y (mm)", k + "cy", r1(p.cy), "Centre of the path, millimetres from the artwork origin.") + "</div>";
      h += fld("Radius (mm)", k + "r", r1(p.r), "Radius of the circle (for a polygon: of its corner points).", "any", ' min="1"');
    }
    if (p.kind === "polygon") {
      h += '<div class="row2">' + fld("Sides", k + "sides", p.sides, "Number of sides, 3 to 64.", "1") + fld("Turn (°)", k + "rot", r1(p.rot), "Turns the polygon. 0 puts a corner at the top.") + "</div>";
      h += fld("Corner radius (mm)", k + "cr", r1(p.cr), "Rounds every corner of the polygon. 0 is sharp.", "any", ' min="0"');
    }
    if (p.kind === "lines") {
      h += chk("Closed (the last point joins the first)", k + "closed", p.closed, "A closed path is a loop; an open one has a start and an end.");
      h += '<table class="ptnodes"><tr><th>#</th><th>X</th><th>Y</th><th title="Rounding radius at this point. The ends of an open line stay sharp.">Radius</th><th></th></tr>';
      p.pts.forEach(function (q, i) {
        var kk = k + "node|" + i + "|";
        h += "<tr><td>" + (i + 1) + '</td><td><input type="number" step="any" data-pu="' + kk + 'x" value="' + r1(q.x) + '" title="X of this point, millimetres from the artwork origin."></td><td><input type="number" step="any" data-pu="' + kk + 'y" value="' + r1(q.y) + '" title="Y of this point, millimetres from the artwork origin."></td><td><input type="number" step="any" min="0" data-pu="' + kk + 'r" value="' + r1(q.r) + '" title="Rounding radius at this point. 0 is a sharp corner."></td><td><button class="tbtn" type="button" data-pa="pnode-" data-id="' + p.id + '" data-idx="' + i + '" title="Remove this point (a path keeps at least two points).">✕</button></td></tr>';
      });
      h += "</table>" + btn("+ Add point", "pnode+", 'data-id="' + p.id + '"', "Adds a point after the last one.");
    }
    if (p.kind === "table") {
      var tl = S().tables.map(function (t) { return [t.id, t.name]; });
      h += sel("Table", k + "table", tl, p.table || (tl[0] && tl[0][0]), "The table whose line the path follows.");
      h += sel("Line", k + "which", PTD.paths.TABLE_LINES, p.which, "Which line of the table: outline, rail, wrap line or player-area line.");
      h += fld("Distance (mm)", k + "dist", r1(p.dist), "Moves a closed line outward (positive) or inward (negative).");
    }
    if (p.kind === "objects") {
      h += '<p class="small">Follows the outer edge of ' + (p.items.length ? p.items.length + " chosen object" + (p.items.length > 1 ? "s" : "") : "no objects yet") + ". Select texts, glyphs, patterns or one group, then press the button.</p>";
      h += btn("Use selected objects", "pobj", 'data-id="' + p.id + '"', "Takes the selected texts, glyphs and patterns (or the selected group) as the objects this path follows.");
      h += fld("Distance (mm)", k + "dist", r1(p.dist), "Moves the edge outward (positive) or inward (negative) from the ink.");
      h += fld("Closing (mm)", k + "close", r1(p.close), "Fills gaps and notches narrower than twice this value, so the outline is smooth. 0 follows every detail.", "any", ' min="0"');
      h += sel("Islands", k + "shape", [["islands", "Each piece (islands)"], ["hull", "Convex hull of all"], ["box", "Rounded box of all"]], p.shape, "What to do with separate pieces: follow each, wrap all in a hull, or in a rounded box.");
      h += chk("Follow holes too", k + "holes", p.holes, "Also make a path round the holes (the middle of an O). Off by default.");
      h += sel("Halo", k + "halo", [["ink", "Follow the ink only"], ["halo", "Ink plus the halo"], ["frozen", "Frozen (no longer follows)"]], p.halo, "Follow only the letters, the letters with their outline halo, or keep the shape as it is now.");
      h += btn("Freeze", "pfreeze", 'data-id="' + p.id + '"', "Keeps the path as it is now; it stops following the objects.");
    }
    if (p.kind !== "circle" || true) {
      h += '<div class="btnrow">' + btn(p.reverse ? "Direction: reversed" : "Direction: normal", "grev", 'data-id="' + p.id + '"', "Turns the path around. Open path: left and right swap. Closed path: inside and outside swap.") + "</div>";
      h += fld("Start (0 to 1)", k + "start", r1(p.start), "Where a closed path starts, as a fraction of its length. Patterns begin here.", "0.05", ' min="0" max="1"');
    }
    return h + "</div></div>";
  }
  U.paint = function () {
    if (!PTD.core) return;
    var box = document.getElementById("pathsList"); if (!box) return;
    var ks = document.getElementById("pathKind");
    if (ks && !ks.options.length) ks.innerHTML = opts(PTD.paths.KINDS, "circle");
    var list = S().paths || [];
    box.innerHTML = list.length ? list.map(pathCard).join("") : '<p class="small">No paths yet. A path is an invisible line that a pattern follows.</p>';
  };
  function genCard(l, g, i, n) {
    var k = "gen|" + (l.uid || l.id) + "|" + i + "|", h = '<div class="panel gencard"><div class="body">';
    h += '<div class="btnrow"><strong class="small">' + (n - i) + ". " + esc((PTD.paths.GENS.filter(function (q) { return q[0] === g.type; })[0] || ["", g.type])[1]) + "</strong>" +
      chk("On", k + "on", g.on, "Draws this layer. Off hides it without removing it.") +
      '<button class="tbtn" type="button" data-pa="gup" data-uid="' + (l.uid || l.id) + '" data-idx="' + i + '" title="Move this layer up (drawn later, on top).">▲</button>' +
      '<button class="tbtn" type="button" data-pa="gdown" data-uid="' + (l.uid || l.id) + '" data-idx="' + i + '" title="Move this layer down.">▼</button>' +
      '<button class="tbtn" type="button" data-pa="gdel" data-uid="' + (l.uid || l.id) + '" data-idx="' + i + '" title="Remove this layer.">✕</button></div>';
    h += sel("Type", k + "type", PTD.paths.GENS, g.type, "The kind of pattern this layer draws along the path.");
    h += fld("Thickness (mm)", k + "thick", r1(g.thick), "Thickness of the line this layer draws.", "any", ' min="0.5"');
    if (g.type !== "line") h += fld("Height (mm)", k + "height", r1(g.height), "How far the wave swings across the path, peak to peak.", "any", ' min="0"');
    if (g.type === "interlace") h += '<div class="row2">' + fld("Strands", k + "strands", g.strands, "Number of strands woven together: 2 is a chain, 3 a braid.", "1") + fld("Gap (mm)", k + "gap", r1(g.gap), "Gap cut into the strand that goes under at each crossing.", "any", ' min="0"') + "</div>";
    if (g.type !== "line") {
      h += sel("Repeat by", k + "mode", [["count", "Number of repeats"], ["length", "Length of one repeat"]], g.mode, "Number of repeats always ends exactly where it starts; a length is a distance in millimetres.");
      if (g.mode === "count") h += fld("Repeats", k + "n", g.n, "How many repeats fit on the whole path.", "1", ' min="1"');
      else { h += fld("Repeat length (mm)", k + "len", r1(g.len), "Length of one repeat along the path.", "any", ' min="5"'); h += chk("Fit to a whole number", k + "fit", g.fit, "On: the length is adjusted a little so a whole number of repeats fits. Off: the exact length is kept and the end may be cut."); }
      h += fld("Phase (0 to 1)", k + "phase", r1(g.phase), "Slides the pattern along the path by a fraction of one repeat.", "0.05");
    }
    h += sel("Side", k + "side", [["centre", "On the path"], ["outside", "Outside"], ["inside", "Inside"], ["left", "Left of the path"], ["right", "Right of the path"]], g.side, "Where the layer lies. Outside and inside are for closed paths, left and right for open ones (the Reverse button swaps them).");
    h += fld("Distance (mm)", k + "dist", r1(g.dist), "How far from the path the layer lies (on the chosen side).", "any", ' min="0"');
    h += fld("Gap to layers below (mm)", k + "gapBelow", r1(g.gapBelow), "Cuts a clear gap of this width round this layer out of the layers below it. 0 is off.", "any", ' min="0"');
    h += sel("Corners", k + "scope", [["whole", "One pattern over the whole path"], ["sides", "Repeat on every side"]], g.scope, "Over the whole path, or restarted on every straight side between corners.");
    return h + "</div></div>";
  }
  U.body = function (l, sc, nSel) {
    var H = C().h, p = pathOf(l.pattern.path), key = l.uid || l.id, n = l.pattern.stack.length;
    var pl = [["", "(none)"]].concat((S().paths || []).map(function (q) { return [q.id, q.name]; }));
    var st = U.status(l);
    return '<div class="body">' +
      (nSel > 1 ? '<p class="small multi">' + nSel + " items are selected. Changes here apply to all of them, except the name and the position.</p>" : "") +
      '<p class="small multi">A pattern is drawn along a path, layer by layer, bottom first. It turns about the artwork origin; Centre X and Y nudge it.</p>' +
      '<label class="fld"><span>Name</span><input type="text" data-scope="' + sc + '" data-key="text" autocomplete="off"></label>' +
      sel("Path", "pat|" + key + "|path", pl, l.pattern.path, "The path this pattern follows. Make paths in the Paths section.") +
      (p ? "" : '<p class="small warn">The path is missing: the pattern keeps its last shape.</p>') +
      (st ? '<p class="small warn" data-pstatus="1">' + esc(st) + "</p>" : "") +
      H.pair("Rotation", sc, "rot", -180, 180, 1, -360, 360) + H.pair("Opacity", sc, "opacity", 0, 1, 0.01, 0, 1) +
      '<div class="colorrow" data-colour="' + sc + ':color:Colour"></div>' +
      '<div class="checks">' + H.chk("Gold shading (shaded preview only)", sc, "gradient") + "</div>" +
      '<div class="checks">' + H.chk("Halo (hides what is below)", sc, "outline") + H.chk("Use cloth colour", sc, "outlineAuto") + "</div>" +
      H.pair("Halo width", sc, "outlineW", 0, 50, 0.5, 0, 300) +
      '<div class="colorrow" data-colour="' + sc + ':outlineColor:Halo colour, used when the cloth colour is off"></div>' +
      '<div class="row2">' + H.len("Centre X", sc, "x") + H.len("Centre Y", sc, "y") + "</div>" +
      '<h4 class="small">Layers (the last one is drawn on top)</h4>' +
      l.pattern.stack.map(function (g, i) { return genCard(l, g, i, n); }).reverse().join("") +
      '<div class="btnrow"><select title="The kind of layer to add.">' + opts(PTD.paths.GENS, "line") + "</select>" + btn("+ Add layer", "gadd", 'data-uid="' + key + '"', "Adds a layer on top of the stack.") + "</div>" +
      "</div>";
  };

  /* ---------- wiring ---------- */
  function init() {
    document.addEventListener("change", function (e) { var t = e.target; if (t && t.dataset && t.dataset.pu) onField(t); });
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-pa]"); if (b) click(b); });
    var kinds = document.getElementById("pathKind"); if (kinds) kinds.innerHTML = opts(PTD.paths.KINDS, "circle");
  }
  U.addPath = addPath; U.addPattern = addPattern; U.cycleMsg = cycleMsg; U.ensure = U.refresh;
  PTD.pathsui = U;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window.PTD = window.PTD || {});
